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
import { createTransactionId } from "@/lib/transactions/reference";
import { majorFromMinor } from "@/lib/money";
import { isCurrencyCode } from "@/lib/currencies";

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
  if (!signature) {
    return new Response("Missing signature.", { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.processing" ||
    event.type === "payment_intent.canceled"
  ) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await persistPaymentIntent(paymentIntent);
  }

  return Response.json({ received: true });
}

async function persistPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const status = mapPaymentIntentStatus(paymentIntent.status);
  const existing = await transactionStore.getByPaymentIntentId(paymentIntent.id);
  const now = new Date().toISOString();
  const currency = paymentIntent.currency.toUpperCase();
  const email =
    existing?.email ||
    (typeof paymentIntent.receipt_email === "string"
      ? paymentIntent.receipt_email
      : "");

  if (existing) {
    await transactionStore.update(existing.id, { status });
    return;
  }

  const referenceFromMetadata = paymentIntent.metadata?.northline_reference;
  const id =
    referenceFromMetadata && referenceFromMetadata !== "pending"
      ? referenceFromMetadata
      : createTransactionId();

  await transactionStore.create({
    id,
    paymentIntentId: paymentIntent.id,
    amountMinor: paymentIntent.amount,
    amountMajor: isCurrencyCode(currency)
      ? majorFromMinor(paymentIntent.amount, currency)
      : String(paymentIntent.amount),
    currency,
    email,
    status,
    createdAt: now,
    updatedAt: now,
  });
}
