import "server-only";

import { majorFromMinor } from "@/lib/money";
import { getStripe, readStripeSecretKey } from "@/lib/stripe/server";
import { mapPaymentIntentStatus } from "@/lib/stripe/status";
import { isTransactionId } from "@/lib/transactions/reference";
import { transactionStore } from "@/lib/transactions/store";
import type { TransactionStatus } from "@/lib/transactions/types";

export type ReceiptView = {
  reference: string;
  amountMajor: string;
  currency: string;
  email: string;
  createdAt: string;
  status: TransactionStatus;
  verifiedWithStripe: boolean;
};

export async function resolveReceipt(
  reference: string,
): Promise<ReceiptView | null> {
  if (!isTransactionId(reference)) {
    return null;
  }

  const record = await transactionStore.getById(reference);
  if (!record) {
    return null;
  }

  if (readStripeSecretKey().status !== "ready") {
    return {
      reference: record.id,
      amountMajor: record.amountMajor,
      currency: record.currency,
      email: record.email,
      createdAt: record.createdAt,
      status: record.status,
      verifiedWithStripe: false,
    };
  }

  try {
    const paymentIntent = await getStripe().paymentIntents.retrieve(
      record.paymentIntentId,
    );
    const status = mapPaymentIntentStatus(paymentIntent.status);
    const amountMajor = majorFromMinor(
      paymentIntent.amount,
      paymentIntent.currency.toUpperCase(),
    );

    if (status !== record.status) {
      await transactionStore.update(record.id, { status });
    }

    return {
      reference: record.id,
      amountMajor,
      currency: paymentIntent.currency.toUpperCase(),
      email: record.email,
      createdAt: record.createdAt,
      status,
      verifiedWithStripe: true,
    };
  } catch {
    return {
      reference: record.id,
      amountMajor: record.amountMajor,
      currency: record.currency,
      email: record.email,
      createdAt: record.createdAt,
      status: record.status,
      verifiedWithStripe: false,
    };
  }
}

export function firstQueryValue(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
