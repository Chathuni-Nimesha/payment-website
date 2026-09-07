import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/payments/create-intent/route";
import { getCurrentUser } from "@/lib/auth/session";
import { createPaymentIntent } from "@/lib/payments/create-intent";
import {
  STRIPE_LIVE_KEYS_DISABLED,
  STRIPE_TEST_NOT_CONFIGURED,
} from "@/lib/stripe/messages";
import * as stripeServer from "@/lib/stripe/server";
import { transactionStore } from "@/lib/transactions/store";
import { createIntentBody, jsonRequest, makeTransaction, TEST_IDEMPOTENCY_KEY } from "./helpers";

vi.mock("@/lib/stripe/server", () => ({
  readStripeSecretKey: vi.fn(),
  getStripe: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
}));

vi.mock("@/lib/transactions/store", () => ({
  transactionStore: {
    create: vi.fn(),
    update: vi.fn(),
    attachUserIfUnset: vi.fn(),
    getById: vi.fn(),
    getByPaymentIntentId: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  limitCreateIntentByIp: vi.fn(async () => ({ ok: true })),
  limitCreateIntentByIdentity: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => null),
}));

const readStripeSecretKey = vi.mocked(stripeServer.readStripeSecretKey);
const getStripe = vi.mocked(stripeServer.getStripe);
const currentUser = vi.mocked(getCurrentUser);

function mockRequiresActionIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_test_northline_1",
    amount: 2500,
    currency: "usd",
    status: "requires_confirmation",
    client_secret: "pi_test_northline_1_secret_test",
    metadata: { northline_reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa" },
    ...overrides,
  };
}

describe("POST /api/payments/create-intent", () => {
  beforeEach(() => {
    readStripeSecretKey.mockReturnValue({ status: "missing" });
    getStripe.mockReset();
    currentUser.mockReset();
    currentUser.mockResolvedValue(null);
    transactionStore.create.mockReset();
    transactionStore.update.mockReset();
    transactionStore.attachUserIfUnset.mockReset();
    transactionStore.getById.mockReset();
    transactionStore.getByPaymentIntentId.mockResolvedValue(null);
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a valid amount, currency, and email.",
    });
  });

  it("returns 400 when required fields are the wrong type", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ amount: 25, currency: "USD", email: "" }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Enter a valid amount, currency, and email.");
  });

  it("returns 400 for an invalid amount", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ amount: "0" }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.amount).toBe("Amount must be greater than zero.");
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid currency", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ currency: "XYZ" }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.currency).toBe("Select a supported currency.");
  });

  it("returns 400 for an invalid email", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ email: "nope" }),
      ),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.email).toBe("Enter a valid email address.");
  });

  it("returns 400 for a missing idempotency key", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ idempotencyKey: "bad" }),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("returns a controlled 503 when Stripe test keys are missing", async () => {
    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
      ),
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe(STRIPE_TEST_NOT_CONFIGURED);
    expect(JSON.stringify(body)).not.toMatch(/sk_live_|sk_test_/);
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns a controlled 503 when a live secret key is configured", async () => {
    readStripeSecretKey.mockReturnValue({ status: "live" });

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
      ),
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe(STRIPE_LIVE_KEYS_DISABLED);
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns a safe 502 when Stripe create fails", async () => {
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_super_secret_value",
    });
    getStripe.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockRejectedValue(
          new Error("Invalid API Key: sk_test_super_secret_value"),
        ),
      },
    });

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
      ),
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("The checkout could not be prepared. Please try again.");
    expect(JSON.stringify(body)).not.toContain("sk_test_super_secret_value");
  });

  it("does not expose the Stripe secret on a successful mock create", async () => {
    const create = vi.fn().mockResolvedValue(mockRequiresActionIntent());
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_super_secret_value",
    });
    getStripe.mockReturnValue({
      paymentIntents: { create },
    });
    transactionStore.create.mockResolvedValue(undefined);

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody(),
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clientSecret).toBe("pi_test_northline_1_secret_test");
    expect(body.intentStatus).toBe("processing");
    expect(JSON.stringify(body)).not.toContain("sk_test_super_secret_value");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: "usd",
      }),
      { idempotencyKey: TEST_IDEMPOTENCY_KEY },
    );
  });

  it("associates a signed-in user with a new PaymentIntent", async () => {
    currentUser.mockResolvedValue({
      id: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
      email: "owner@example.com",
      createdAt: "2026-01-15T12:00:00.000Z",
    });
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: { create: vi.fn().mockResolvedValue(mockRequiresActionIntent()) },
    });
    transactionStore.create.mockResolvedValue(undefined);

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ userId: "usr_bbbbbbbbbbbbbbbbbbbbbbbb" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(transactionStore.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    );
    expect(transactionStore.attachUserIfUnset).toHaveBeenCalledWith(
      "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("keeps guest checkout unowned and ignores a body userId", async () => {
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: { create: vi.fn().mockResolvedValue(mockRequiresActionIntent()) },
    });
    transactionStore.create.mockResolvedValue(undefined);

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ userId: "usr_bbbbbbbbbbbbbbbbbbbbbbbb" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(transactionStore.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
    expect(transactionStore.attachUserIfUnset).not.toHaveBeenCalled();
  });

  it("claims a previously guest PaymentIntent for the signed-in user only", async () => {
    currentUser.mockResolvedValue({
      id: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
      email: "owner@example.com",
      createdAt: "2026-01-15T12:00:00.000Z",
    });
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: { create: vi.fn().mockResolvedValue(mockRequiresActionIntent()) },
    });
    transactionStore.getByPaymentIntentId.mockResolvedValue(
      makeTransaction({ userId: null }),
    );
    transactionStore.update.mockResolvedValue(
      makeTransaction({ userId: null }),
    );
    transactionStore.attachUserIfUnset.mockResolvedValue(
      makeTransaction({ userId: "usr_aaaaaaaaaaaaaaaaaaaaaaaa" }),
    );

    const response = await POST(
      jsonRequest(
        "http://localhost/api/payments/create-intent",
        createIntentBody({ userId: "usr_bbbbbbbbbbbbbbbbbbbbbbbb" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(transactionStore.create).not.toHaveBeenCalled();
    expect(transactionStore.attachUserIfUnset).toHaveBeenCalledWith(
      "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });
});

describe("createPaymentIntent mismatch protection", () => {
  beforeEach(() => {
    transactionStore.create.mockReset();
    transactionStore.update.mockReset();
    transactionStore.attachUserIfUnset.mockReset();
    transactionStore.getById.mockResolvedValue(null);
    transactionStore.getByPaymentIntentId.mockResolvedValue(null);
  });

  it("returns 409 when the reused PaymentIntent amount does not match", async () => {
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockResolvedValue(
          mockRequiresActionIntent({ amount: 4000 }),
        ),
      },
    });

    const result = await createPaymentIntent(createIntentBody());

    expect(result).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(transactionStore.create).not.toHaveBeenCalled();
    expect(transactionStore.update).not.toHaveBeenCalled();
  });

  it("returns 409 when the reused PaymentIntent currency does not match", async () => {
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockResolvedValue(
          mockRequiresActionIntent({ currency: "eur" }),
        ),
      },
    });

    const result = await createPaymentIntent(createIntentBody());

    expect(result).toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("does not return a client secret for an already paid intent", async () => {
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    getStripe.mockReturnValue({
      paymentIntents: {
        create: vi.fn().mockResolvedValue(
          mockRequiresActionIntent({
            status: "succeeded",
            client_secret: "should-not-be-returned",
          }),
        ),
      },
    });
    transactionStore.create.mockResolvedValue(undefined);

    const result = await createPaymentIntent(createIntentBody());

    expect(result).toEqual({
      ok: true,
      reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      intentStatus: "paid",
    });
    expect("clientSecret" in result && result.clientSecret).toBeFalsy();
  });
});
