export const STRIPE_TEST_NOT_CONFIGURED =
  "Stripe test credentials are not configured. Real Stripe test transactions cannot run until test keys are added to .env.local.";

export const STRIPE_LIVE_KEYS_DISABLED =
  "Live Stripe keys are disabled. Use test-mode keys only.";

export const STRIPE_WEBHOOK_NOT_CONFIGURED =
  "Stripe webhook secret is not configured. Signature verification cannot run.";

export const STRIPE_PUBLISHABLE_KEY_REQUIRED =
  "Stripe test credentials are not configured. Add a pk_test_ publishable key to .env.local.";

export function stripeSecretConfigError(status: "missing" | "live") {
  return status === "live"
    ? STRIPE_LIVE_KEYS_DISABLED
    : STRIPE_TEST_NOT_CONFIGURED;
}

export function stripePublishableConfigError(status: "missing" | "live") {
  return status === "live"
    ? STRIPE_LIVE_KEYS_DISABLED
    : STRIPE_PUBLISHABLE_KEY_REQUIRED;
}
