import type { PublicPayment, Transaction } from "@/lib/transactions/types";

export const PAYMENTS_DEFAULT_PAGE_SIZE = 10;
export const PAYMENTS_MAX_PAGE_SIZE = 50;

export function toPublicPayment(transaction: Transaction): PublicPayment {
  return {
    id: transaction.id,
    reference: transaction.id,
    amountMinor: transaction.amountMinor,
    amountMajor: transaction.amountMajor,
    currency: transaction.currency,
    status: transaction.status,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export function parsePage(value: string | string[] | null | undefined, fallback = 1) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function parsePageSize(
  value: string | string[] | null | undefined,
  fallback = PAYMENTS_DEFAULT_PAGE_SIZE,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, PAYMENTS_MAX_PAGE_SIZE);
}
