import { createIdempotencyKey, isIdempotencyKey } from "@/lib/idempotency-key";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currencies";

const STORAGE_KEY = "northline.checkout.v1";

export type CheckoutSessionState = {
  amount: string;
  currency: CurrencyCode;
  email: string;
  idempotencyKey: string;
  phase: "details" | "payment";
};

export function checkoutFingerprint(
  amount: string,
  currency: string,
  email: string,
) {
  return `${amount}|${currency.toUpperCase()}|${email.trim().toLowerCase()}`;
}

export function loadCheckoutSession(): CheckoutSessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CheckoutSessionState>;
    if (
      typeof parsed.amount !== "string" ||
      typeof parsed.currency !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.idempotencyKey !== "string" ||
      (parsed.phase !== "details" && parsed.phase !== "payment") ||
      !isCurrencyCode(parsed.currency) ||
      !isIdempotencyKey(parsed.idempotencyKey)
    ) {
      clearCheckoutSession();
      return null;
    }

    return {
      amount: parsed.amount,
      currency: parsed.currency,
      email: parsed.email,
      idempotencyKey: parsed.idempotencyKey,
      phase: parsed.phase,
    };
  } catch {
    clearCheckoutSession();
    return null;
  }
}

export function saveCheckoutSession(session: CheckoutSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearCheckoutSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function idempotencyKeyFor(input: {
  amount: string;
  currency: string;
  email: string;
}) {
  const stored = loadCheckoutSession();
  if (
    stored &&
    checkoutFingerprint(stored.amount, stored.currency, stored.email) ===
      checkoutFingerprint(input.amount, input.currency, input.email)
  ) {
    return stored.idempotencyKey;
  }

  return createIdempotencyKey();
}
