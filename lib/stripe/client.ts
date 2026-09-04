"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function readPublishableKey():
  | { status: "ready"; key: string }
  | { status: "missing" }
  | { status: "live" } {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  if (!key) {
    return { status: "missing" };
  }

  if (!key.startsWith("pk_test_")) {
    return { status: "live" };
  }

  return { status: "ready", key };
}

export function getPublishableKey() {
  const result = readPublishableKey();
  return result.status === "ready" ? result.key : null;
}

export function getStripePromise() {
  const key = getPublishableKey();

  if (!key) {
    return null;
  }

  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }

  return stripePromise;
}
