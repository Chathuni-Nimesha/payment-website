import "server-only";

import type Stripe from "stripe";
import {
  STRIPE_WEBHOOK_NOT_CONFIGURED,
  stripeSecretConfigError,
} from "@/lib/stripe/messages";
import {
  getStripe,
  getStripeWebhookSecret,
  readStripeSecretKey,
} from "@/lib/stripe/server";
import { mapPaymentIntentStatus } from "@/lib/stripe/status";
import { transactionStore } from "@/lib/transactions/store";
import { createTransactionId, isTransactionId } from "@/lib/transactions/reference";
import { majorFromMinor } from "@/lib/money";
import { isCurrencyCode } from "@/lib/currencies";
import { logger } from "@/lib/logging/logger";
import { limitUnsignedWebhook } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return new Response(STRIPE_WEBHOOK_NOT_CONFIGURED, { status: 503 });
  }

  const stripeSecret = readStripeSecretKey();
  if (stripeSecret.status !== "ready") {
    return new Response(stripeSecretConfigError(stripeSecret.status), {
      status: 503,
    });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature) {
    const unsignedLimit = await limitUnsignedWebhook(request);
    if (!unsignedLimit.ok) {
      return unsignedLimit.response;
    }

    return new Response("Missing signature.", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    const unsignedLimit = await limitUnsignedWebhook(request);
    if (!unsignedLimit.ok) {
      return unsignedLimit.response;
    }

    return new Response("Invalid signature.", { status: 400 });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.processing" ||
    event.type === "payment_intent.canceled"
  ) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    try {
      await persistPaymentIntentEvent(event, paymentIntent);
    } catch {
      logger.error("payments.webhook_persist_failed", { type: event.type });
      return new Response("Webhook handler failed.", { status: 500 });
    }
  }

  return Response.json({ received: true });
}

async function persistPaymentIntentEvent(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent,
) {
  const status = mapPaymentIntentStatus(paymentIntent.status);
  const existing = await transactionStore.getByPaymentIntentId(paymentIntent.id);
  const currency = paymentIntent.currency.toUpperCase();
  const email =
    existing?.email ||
    (typeof paymentIntent.receipt_email === "string"
      ? paymentIntent.receipt_email
      : "");
  const referenceFromMetadata = paymentIntent.metadata?.northline_reference;
  const reference =
    existing?.id ||
    (referenceFromMetadata && isTransactionId(referenceFromMetadata)
      ? referenceFromMetadata
      : createTransactionId());

  await transactionStore.applyPaymentIntentEvent({
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt: new Date(event.created * 1000),
    paymentIntentId: paymentIntent.id,
    amountMinor: paymentIntent.amount,
    amountMajor: isCurrencyCode(currency)
      ? majorFromMinor(paymentIntent.amount, currency)
      : String(paymentIntent.amount),
    currency,
    email,
    status,
    reference,
  });
}
