import "server-only";

import Stripe from "stripe";

let stripe: Stripe | null = null;

export function readStripeSecretKey():
  | { status: "ready"; key: string }
  | { status: "missing" }
  | { status: "live" } {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    return { status: "missing" };
  }

  if (!key.startsWith("sk_test_")) {
    return { status: "live" };
  }

  return { status: "ready", key };
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export function getStripe() {
  const secret = readStripeSecretKey();

  if (secret.status !== "ready") {
    throw new Error("STRIPE_SECRET_KEY is not configured for test mode.");
  }

  if (!stripe) {
    stripe = new Stripe(secret.key);
  }

  return stripe;
}
