import type { Transaction } from "@/lib/transactions/types";

export const TEST_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_REFERENCE = "nl_aaaaaaaaaaaaaaaaaaaaaaaa";
export const TEST_PAYMENT_INTENT_ID = "pi_test_northline_1";

export function makeTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  const now = "2026-01-15T12:00:00.000Z";

  return {
    id: TEST_REFERENCE,
    paymentIntentId: TEST_PAYMENT_INTENT_ID,
    amountMinor: 2500,
    amountMajor: "25.00",
    currency: "USD",
    email: "client@example.com",
    status: "pending",
    userId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function jsonRequest(
  url: string,
  body: unknown,
  headers?: HeadersInit,
): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function createIntentBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    amount: "25.00",
    currency: "USD",
    email: "client@example.com",
    idempotencyKey: TEST_IDEMPOTENCY_KEY,
    ...overrides,
  };
}

export function receiptDecision(receipt: {
  verifiedWithStripe: boolean;
  status: string;
} | null) {
  const verified = Boolean(receipt?.verifiedWithStripe);

  return {
    isPaid: Boolean(receipt && verified && receipt.status === "paid"),
    isProcessing: Boolean(
      receipt &&
        verified &&
        (receipt.status === "processing" || receipt.status === "pending"),
    ),
    declined: Boolean(receipt && verified && receipt.status === "failed"),
    unconfirmed: Boolean(receipt && !verified),
  };
}
