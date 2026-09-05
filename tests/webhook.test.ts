import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import {
  STRIPE_LIVE_KEYS_DISABLED,
  STRIPE_WEBHOOK_NOT_CONFIGURED,
} from "@/lib/stripe/messages";
import * as stripeServer from "@/lib/stripe/server";
import { transactionStore } from "@/lib/transactions/store";

const constructEvent = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  getStripeWebhookSecret: vi.fn(),
  readStripeSecretKey: vi.fn(),
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEvent(...args),
    },
  })),
}));

vi.mock("@/lib/transactions/store", () => ({
  transactionStore: {
    create: vi.fn(),
    update: vi.fn(),
    getById: vi.fn(),
    getByPaymentIntentId: vi.fn(),
    applyPaymentIntentEvent: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  limitUnsignedWebhook: vi.fn(async () => ({ ok: true })),
}));

const getStripeWebhookSecret = vi.mocked(stripeServer.getStripeWebhookSecret);
const readStripeSecretKey = vi.mocked(stripeServer.readStripeSecretKey);

function paymentIntent(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_test_northline_1",
    amount: 2500,
    currency: "usd",
    status,
    receipt_email: "client@example.com",
    metadata: { northline_reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa" },
    ...overrides,
  };
}

function webhookRequest(
  payload: string,
  signature?: string,
): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : undefined,
    body: payload,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    getStripeWebhookSecret.mockReturnValue("whsec_test_placeholder");
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    constructEvent.mockReset();
    transactionStore.create.mockReset();
    transactionStore.update.mockReset();
    transactionStore.getById.mockReset();
    transactionStore.getByPaymentIntentId.mockResolvedValue(null);
    transactionStore.applyPaymentIntentEvent.mockResolvedValue("applied");
  });

  it("returns 503 when the webhook secret is missing", async () => {
    getStripeWebhookSecret.mockReturnValue(null);

    const response = await POST(webhookRequest("{}", "t=1,v1=sig"));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(STRIPE_WEBHOOK_NOT_CONFIGURED);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("returns 503 when the Stripe secret is not test-ready", async () => {
    readStripeSecretKey.mockReturnValue({ status: "live" });

    const response = await POST(webhookRequest("{}", "t=1,v1=sig"));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe(STRIPE_LIVE_KEYS_DISABLED);
    expect(constructEvent).not.toHaveBeenCalled();
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when the Stripe signature header is missing", async () => {
    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Missing signature.");
    expect(constructEvent).not.toHaveBeenCalled();
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("does not update transactions when constructEvent rejects the signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const response = await POST(webhookRequest("{not-json", "t=1,v1=forged"));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid signature.");
    expect(constructEvent).toHaveBeenCalledWith(
      "{not-json",
      "t=1,v1=forged",
      "whsec_test_placeholder",
    );
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("does not persist unsupported event types after a valid signature", async () => {
    constructEvent.mockReturnValue({
      id: "evt_customer",
      created: 1_700_000_000,
      type: "customer.created",
      data: { object: { id: "cus_1" } },
    });

    const response = await POST(webhookRequest("{}", "t=1,v1=valid"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(transactionStore.applyPaymentIntentEvent).not.toHaveBeenCalled();
  });

  it("creates a paid transaction for payment_intent.succeeded", async () => {
    constructEvent.mockReturnValue({
      id: "evt_paid",
      created: 1_700_000_000,
      type: "payment_intent.succeeded",
      data: { object: paymentIntent("succeeded") },
    });

    const response = await POST(webhookRequest("{}", "t=1,v1=valid"));

    expect(response.status).toBe(200);
    expect(transactionStore.applyPaymentIntentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_paid",
        paymentIntentId: "pi_test_northline_1",
        reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
        status: "paid",
        amountMinor: 2500,
        amountMajor: "25.00",
        currency: "USD",
      }),
    );
  });

  it("updates an existing transaction for payment_intent.payment_failed", async () => {
    transactionStore.getByPaymentIntentId.mockResolvedValue({
      id: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      paymentIntentId: "pi_test_northline_1",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "pending",
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z",
    });
    constructEvent.mockReturnValue({
      id: "evt_failed",
      created: 1_700_000_100,
      type: "payment_intent.payment_failed",
      data: { object: paymentIntent("requires_payment_method") },
    });

    const response = await POST(webhookRequest("{}", "t=1,v1=valid"));

    expect(response.status).toBe(200);
    expect(transactionStore.applyPaymentIntentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_failed",
        status: "failed",
        reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    );
  });

  it("maps processing and canceled events", async () => {
    constructEvent.mockReturnValue({
      id: "evt_processing",
      created: 1_700_000_200,
      type: "payment_intent.processing",
      data: { object: paymentIntent("processing") },
    });

    await POST(webhookRequest("{}", "t=1,v1=valid"));
    expect(transactionStore.applyPaymentIntentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" }),
    );

    constructEvent.mockReturnValue({
      id: "evt_canceled",
      created: 1_700_000_300,
      type: "payment_intent.canceled",
      data: { object: paymentIntent("canceled") },
    });
    transactionStore.applyPaymentIntentEvent.mockClear();
    transactionStore.getByPaymentIntentId.mockResolvedValue(null);

    await POST(webhookRequest("{}", "t=1,v1=valid"));
    expect(transactionStore.applyPaymentIntentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
