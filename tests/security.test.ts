import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntentBody, jsonRequest } from "./helpers";
import { getPublishableKey, readPublishableKey } from "@/lib/stripe/client";
import {
  getStripe,
  getStripeWebhookSecret,
  readStripeSecretKey,
} from "@/lib/stripe/server";
import { mapPaymentIntentStatus } from "@/lib/stripe/status";

vi.mock("@/lib/rate-limit", () => ({
  limitCreateIntentByIp: vi.fn(async () => ({ ok: true })),
  limitCreateIntentByIdentity: vi.fn(async () => ({ ok: true })),
  limitUnsignedWebhook: vi.fn(async () => ({ ok: true })),
}));

const originalEnv = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
};

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = originalEnv.STRIPE_SECRET_KEY;
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
    originalEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = originalEnv.STRIPE_WEBHOOK_SECRET;
});

describe("Stripe key restrictions", () => {
  it("treats a missing secret key as missing", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(readStripeSecretKey()).toEqual({ status: "missing" });
  });

  it("rejects live secret keys", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_should_never_be_used";
    expect(readStripeSecretKey()).toEqual({ status: "live" });
    expect(() => getStripe()).toThrow(
      /STRIPE_SECRET_KEY is not configured for test mode/,
    );
  });

  it("accepts only sk_test_ secret keys", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    expect(readStripeSecretKey()).toEqual({
      status: "ready",
      key: "sk_test_placeholder",
    });
  });

  it("rejects live publishable keys and does not return them", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_should_never_be_used";
    expect(readPublishableKey()).toEqual({ status: "live" });
    expect(getPublishableKey()).toBeNull();
  });

  it("accepts only pk_test_ publishable keys", () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
    expect(getPublishableKey()).toBe("pk_test_placeholder");
  });

  it("does not invent a webhook secret", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(getStripeWebhookSecret()).toBeNull();
  });
});

describe("create-intent does not accept card data", () => {
  it("ignores cardNumber, cvv, cvc, and expiry fields", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { POST } = await import("@/app/api/payments/create-intent/route");
    const { createPaymentIntent } = await import("@/lib/payments/create-intent");

    const payload = createIntentBody({
      cardNumber: "4242424242424242",
      cvv: "123",
      cvc: "123",
      expiry: "12/34",
      pan: "4242424242424242",
    });

    const result = await createPaymentIntent({
      amount: payload.amount,
      currency: payload.currency,
      email: payload.email,
      idempotencyKey: payload.idempotencyKey,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
    expect(JSON.stringify(result)).not.toContain("4242424242424242");
    expect(JSON.stringify(result)).not.toContain("cvv");

    const response = await POST(
      jsonRequest("http://localhost/api/payments/create-intent", payload),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("4242");
    expect(body.cardNumber).toBeUndefined();
    expect(body.cvv).toBeUndefined();
    expect(body.expiry).toBeUndefined();
  });
});

describe("webhook signature verification cannot be skipped", () => {
  it("never reaches constructEvent without a configured webhook secret", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=forged" },
        body: JSON.stringify({
          type: "payment_intent.succeeded",
          data: { object: { status: "succeeded" } },
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toMatch(/Signature verification cannot run/);
  });
});

describe("payment status mapping", () => {
  it("does not treat unknown Stripe statuses as paid", () => {
    expect(mapPaymentIntentStatus("succeeded")).toBe("paid");
    expect(mapPaymentIntentStatus("processing")).toBe("processing");
    expect(mapPaymentIntentStatus("requires_payment_method")).toBe("failed");
    expect(mapPaymentIntentStatus("canceled")).toBe("failed");
    expect(mapPaymentIntentStatus("made_up")).toBe("pending");
  });
});
