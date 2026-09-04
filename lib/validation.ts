import { isCurrencyCode } from "./currencies";
import { parseAmount } from "./money";

export type CheckoutFieldErrors = {
  amount?: string;
  currency?: string;
  email?: string;
};

export type ValidatedCheckout = {
  amountMajor: string;
  currency: string;
  email: string;
};

export function validateCheckoutFields(input: {
  amount: string;
  currency: string;
  email: string;
}): { ok: true; value: ValidatedCheckout } | { ok: false; errors: CheckoutFieldErrors } {
  const errors: CheckoutFieldErrors = {};
  const currency = input.currency.trim().toUpperCase();

  if (!currency) {
    errors.currency = "Select a currency.";
  } else if (!isCurrencyCode(currency)) {
    errors.currency = "Select a supported currency.";
  }

  const parsedAmount = parseAmount(input.amount, isCurrencyCode(currency) ? currency : "USD");
  if (!parsedAmount.ok) {
    errors.amount = parsedAmount.error;
  }

  const email = input.email.trim();
  const emailError = validateOptionalEmail(email);
  if (emailError) {
    errors.email = emailError;
  }

  if (!parsedAmount.ok || errors.currency || errors.email) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      amountMajor: parsedAmount.major,
      currency,
      email,
    },
  };
}

export function validateOptionalEmail(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.length > 254) {
    return "Enter a shorter email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }

  return undefined;
}
