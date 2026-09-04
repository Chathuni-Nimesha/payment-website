import "server-only";

import { isIdempotencyKey } from "@/lib/idempotency-key";
import { publicIntentCreationError } from "@/lib/stripe/errors";
import { stripeSecretConfigError } from "@/lib/stripe/messages";
import { getStripe, readStripeSecretKey } from "@/lib/stripe/server";
import { mapPaymentIntentStatus } from "@/lib/stripe/status";
import { createTransactionId } from "@/lib/transactions/reference";
import { transactionStore } from "@/lib/transactions/store";
import type { Transaction, TransactionStatus } from "@/lib/transactions/types";
import { majorFromMinor, parseAmount } from "@/lib/money";
import { validateCheckoutFields } from "@/lib/validation";

export type CreateIntentResult =
  | {
      ok: true;
      clientSecret: string;
      reference: string;
      intentStatus: TransactionStatus;
    }
  | {
      ok: true;
      clientSecret?: undefined;
      reference: string;
      intentStatus: "paid";
    }
  | {
      ok: false;
      status: number;
      error: string;
      fieldErrors?: {
        amount?: string;
        currency?: string;
        email?: string;
      };
    };

export async function createPaymentIntent(input: {
  amount: unknown;
  currency: unknown;
  email: unknown;
  idempotencyKey: unknown;
}): Promise<CreateIntentResult> {
  if (typeof input.idempotencyKey !== "string" || !isIdempotencyKey(input.idempotencyKey)) {
    return {
      ok: false,
      status: 400,
      error: "The checkout could not be prepared. Please try again.",
    };
  }

  if (
    typeof input.amount !== "string" ||
    typeof input.currency !== "string" ||
    typeof input.email !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      error: "Enter a valid amount, currency, and email.",
    };
  }

  const validated = validateCheckoutFields({
    amount: input.amount,
    currency: input.currency,
    email: input.email,
  });

  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: "Please correct the highlighted fields.",
      fieldErrors: validated.errors,
    };
  }

  const parsed = parseAmount(
    validated.value.amountMajor,
    validated.value.currency,
  );

  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: parsed.error,
      fieldErrors: { amount: parsed.error },
    };
  }

  const secret = readStripeSecretKey();
  if (secret.status !== "ready") {
    return {
      ok: false,
      status: 503,
      error: stripeSecretConfigError(secret.status),
    };
  }

  const reference = createTransactionId();

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: parsed.minor,
        currency: validated.value.currency.toLowerCase(),
        description: "Northline test-mode checkout",
        receipt_email: validated.value.email || undefined,
        metadata: {
          northline_reference: reference,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      { idempotencyKey: input.idempotencyKey },
    );

    const storedReference =
      paymentIntent.metadata?.northline_reference || reference;
    const existing =
      (await transactionStore.getByPaymentIntentId(paymentIntent.id)) ||
      (await transactionStore.getById(storedReference));
    const now = new Date().toISOString();
    const currency = paymentIntent.currency.toUpperCase();
    const intentStatus = mapPaymentIntentStatus(paymentIntent.status);

    if (
      paymentIntent.amount !== parsed.minor ||
      paymentIntent.currency !== validated.value.currency.toLowerCase()
    ) {
      return {
        ok: false,
        status: 409,
        error: "Checkout details changed. Continue again to start a new payment.",
      };
    }

    const transaction: Transaction = {
      id: existing?.id ?? storedReference,
      paymentIntentId: paymentIntent.id,
      amountMinor: paymentIntent.amount,
      amountMajor: majorFromMinor(paymentIntent.amount, currency),
      currency,
      email: validated.value.email,
      status: intentStatus,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await transactionStore.update(existing.id, {
        status: transaction.status,
        paymentIntentId: paymentIntent.id,
      });
    } else {
      await transactionStore.create(transaction);
    }

    if (intentStatus === "paid") {
      return {
        ok: true,
        reference: transaction.id,
        intentStatus: "paid",
      };
    }

    if (!paymentIntent.client_secret) {
      return {
        ok: false,
        status: 502,
        error: "The checkout could not be prepared. Please try again.",
      };
    }

    return {
      ok: true,
      clientSecret: paymentIntent.client_secret,
      reference: transaction.id,
      intentStatus,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: publicIntentCreationError(error),
    };
  }
}
