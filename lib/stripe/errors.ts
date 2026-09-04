const SAFE_STRIPE_CODES: Record<string, string> = {
  amount_too_small: "Amount is below the minimum for this currency.",
  balance_insufficient: "This payment could not be completed. Please try another method.",
  card_declined: "Your card was declined. Try another payment method.",
  expired_card: "This card has expired. Try another payment method.",
  incorrect_cvc: "The security code is incorrect. Please try again.",
  incorrect_number: "The card details could not be verified. Please try again.",
  insufficient_funds: "This card does not have sufficient funds.",
  invalid_expiry_month: "The expiry date is invalid. Please try again.",
  invalid_expiry_year: "The expiry date is invalid. Please try again.",
  invalid_number: "The card details could not be verified. Please try again.",
  payment_intent_authentication_failure:
    "Authentication was not completed. Please try again.",
  processing_error: "The payment could not be processed. Please try again.",
};

export function publicPaymentError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "The payment could not be completed. Please try again.";
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  const type =
    "type" in error && typeof error.type === "string" ? error.type : undefined;

  if (code && SAFE_STRIPE_CODES[code]) {
    return SAFE_STRIPE_CODES[code];
  }

  if (type === "card_error" || type === "invalid_request_error") {
    if (code === "parameter_invalid_empty" || code === "parameter_missing") {
      return "Please complete the payment details.";
    }
  }

  return "The payment could not be completed. Please try again.";
}

export function publicIntentCreationError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "The checkout could not be prepared. Please try again.";
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  const param =
    "param" in error && typeof error.param === "string" ? error.param : undefined;

  if (code && SAFE_STRIPE_CODES[code]) {
    return SAFE_STRIPE_CODES[code];
  }

  if (param === "currency" || code === "currency_not_supported") {
    return "This currency is not available for Stripe test payments on this account.";
  }

  return "The checkout could not be prepared. Please try again.";
}
