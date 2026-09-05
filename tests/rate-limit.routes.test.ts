import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIntentBody, jsonRequest } from "./helpers";

const limitCreateIntentByIp = vi.fn();
const limitCreateIntentByIdentity = vi.fn();
const limitUnsignedWebhook = vi.fn();
const constructEvent = vi.fn();
const createPaymentIntent = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  limitCreateIntentByIp: (...args: unknown[]) => limitCreateIntentByIp(...args),
  limitCreateIntentByIdentity: (...args: unknown[]) =>
    limitCreateIntentByIdentity(...args),
  limitUnsignedWebhook: (...args: unknown[]) => limitUnsignedWebhook(...args),
  RATE_LIMITED_MESSAGE: "Too many requests. Please try again shortly.",
}));

vi.mock("@/lib/payments/create-intent", () => ({
  createPaymentIntent: (...args: unknown[]) => createPaymentIntent(...args),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeWebhookSecret: vi.fn(() => "whsec_test_placeholder"),
  readStripeSecretKey: vi.fn(() => ({
    status: "ready",
    key: "sk_test_placeholder",
  })),
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEvent(...args),
    },
  })),
}));

vi.mock("@/lib/transactions/store", () => ({
  transactionStore: {
    getByPaymentIntentId: vi.fn(),
    applyPaymentIntentEvent: vi.fn(),
  },
}));

import { POST as createIntent } from "@/app/api/payments/create-intent/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { transactionStore } from "@/lib/transactions/store";
import { RATE_LIMITED_MESSAGE } from "@/lib/rate-limit/config";

describe("create-intent rate limit responses", () => {
  beforeEach(() => {
    limitCreateIntentByIp.mockReset();
    limitCreateIntentByIdentity.mockReset();
    createPaymentIntent.mockReset();
    limitCreateIntentByIp.mockResolvedValue({ ok: true });
    limitCreateIntentByIdentity.mockResolvedValue({ ok: true });
    createPaymentIntent.mockResolvedValue({
      ok: true,
      clientSecret: "cs_test_placeholder",
      reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      intentStatus: "requires_confirmation",
    });
  });

  it("allows requests within the limit", async () => {
    const response = await createIntent(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );

    expect(response.status).toBe(200);
    expect(createPaymentIntent).toHaveBeenCalled();
    expect(limitCreateIntentByIdentity).toHaveBeenCalledWith(
      expect.any(Request),
      "client@example.com",
    );
  });

  it("returns 429 with a safe body when the IP limit is exceeded", async () => {
    limitCreateIntentByIp.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: RATE_LIMITED_MESSAGE }),
        {
          status: 429,
          headers: { "Retry-After": "30", "Content-Type": "application/json" },
        },
      ),
    });

    const response = await createIntent(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: RATE_LIMITED_MESSAGE,
    });
  });

  it("does not create a PaymentIntent after a 429", async () => {
    limitCreateIntentByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    });

    await createIntent(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
      ),
    );

    expect(limitCreateIntentByIdentity).not.toHaveBeenCalled();
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });

  it("returns 429 when the identity limit is exceeded", async () => {
    limitCreateIntentByIdentity.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: { "Retry-After": "45", "Content-Type": "application/json" },
      }),
    });

    const response = await createIntent(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
        { "x-forwarded-for": "203.0.113.10" },
      ),
    );

    expect(response.status).toBe(429);
    expect(createPaymentIntent).not.toHaveBeenCalled();
  });
});

describe("webhook retry compatibility", () => {
  beforeEach(() => {
    limitUnsignedWebhook.mockReset();
    constructEvent.mockReset();
    vi.mocked(transactionStore.getByPaymentIntentId).mockResolvedValue(null);
    vi.mocked(transactionStore.applyPaymentIntentEvent).mockResolvedValue(
      "applied",
    );
  });

  it("does not rate-limit a valid signed Stripe event", async () => {
    constructEvent.mockReturnValue({
      id: "evt_retry_1",
      created: 1_700_000_000,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test_northline_1",
          amount: 2500,
          currency: "usd",
          status: "succeeded",
          receipt_email: "client@example.com",
          metadata: { northline_reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa" },
        },
      },
    });

    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=valid" },
      body: "{}",
    });

    const first = await stripeWebhook(request);
    const second = await stripeWebhook(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=valid" },
        body: "{}",
      }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(limitUnsignedWebhook).not.toHaveBeenCalled();
    expect(transactionStore.applyPaymentIntentEvent).toHaveBeenCalledTimes(2);
    expect(constructEvent).toHaveBeenCalledTimes(2);
  });

  it("can 429 unsigned webhook floods without touching Stripe events", async () => {
    limitUnsignedWebhook.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await stripeWebhook(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(429);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });
});
