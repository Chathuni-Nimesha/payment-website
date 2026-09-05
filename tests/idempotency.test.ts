/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it } from "vitest";
import {
  checkoutFingerprint,
  clearCheckoutSession,
  idempotencyKeyFor,
  loadCheckoutSession,
  saveCheckoutSession,
} from "@/lib/checkout-session";
import { createIdempotencyKey, isIdempotencyKey } from "@/lib/idempotency-key";

const KEY = "550e8400-e29b-41d4-a716-446655440000";

describe("idempotency keys", () => {
  it("accepts a UUID and rejects other strings", () => {
    expect(isIdempotencyKey(KEY)).toBe(true);
    expect(isIdempotencyKey(createIdempotencyKey())).toBe(true);
    expect(isIdempotencyKey("not-a-uuid")).toBe(false);
    expect(isIdempotencyKey("")).toBe(false);
  });
});

describe("checkout session fingerprinting", () => {
  it("normalizes currency and email", () => {
    expect(checkoutFingerprint("25.00", "usd", "  Client@Example.com  ")).toBe(
      "25.00|USD|client@example.com",
    );
  });
});

describe("same-tab checkout session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("reuses the stored key when the fingerprint matches", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    expect(
      idempotencyKeyFor({
        amount: "25.00",
        currency: "USD",
        email: "client@example.com",
      }),
    ).toBe(KEY);
  });

  it("reuses the key when only email casing changes", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    expect(
      idempotencyKeyFor({
        amount: "25.00",
        currency: "usd",
        email: "Client@Example.com",
      }),
    ).toBe(KEY);
  });

  it("creates a new key when the amount changes", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    const next = idempotencyKeyFor({
      amount: "40.00",
      currency: "USD",
      email: "client@example.com",
    });

    expect(next).not.toBe(KEY);
    expect(isIdempotencyKey(next)).toBe(true);
  });

  it("creates a new key when the currency changes", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    expect(
      idempotencyKeyFor({
        amount: "25.00",
        currency: "EUR",
        email: "client@example.com",
      }),
    ).not.toBe(KEY);
  });

  it("creates a new key when the email changes", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    expect(
      idempotencyKeyFor({
        amount: "25.00",
        currency: "USD",
        email: "other@example.com",
      }),
    ).not.toBe(KEY);
  });

  it("restores the same session after a same-tab refresh", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });

    expect(loadCheckoutSession()).toEqual({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "payment",
    });
  });

  it("clears a corrupt session instead of reusing it", () => {
    sessionStorage.setItem(
      "northline.checkout.v1",
      JSON.stringify({ amount: "25.00" }),
    );

    expect(loadCheckoutSession()).toBeNull();
    expect(sessionStorage.getItem("northline.checkout.v1")).toBeNull();
  });

  it("clears the session on demand", () => {
    saveCheckoutSession({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
      idempotencyKey: KEY,
      phase: "details",
    });

    clearCheckoutSession();
    expect(loadCheckoutSession()).toBeNull();
  });
});
