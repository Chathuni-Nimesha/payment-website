import { beforeEach, describe, expect, it, vi } from "vitest";
import { firstQueryValue, resolveReceipt } from "@/lib/payments/receipt";
import * as stripeServer from "@/lib/stripe/server";
import { transactionStore } from "@/lib/transactions/store";
import {
  makeTransaction,
  receiptDecision,
  TEST_REFERENCE,
} from "./helpers";

const retrieve = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  readStripeSecretKey: vi.fn(),
  getStripe: vi.fn(() => ({
    paymentIntents: {
      retrieve: (...args: unknown[]) => retrieve(...args),
    },
  })),
}));

vi.mock("@/lib/transactions/store", () => ({
  transactionStore: {
    create: vi.fn(),
    update: vi.fn(),
    getById: vi.fn(),
    getByPaymentIntentId: vi.fn(),
  },
}));

const readStripeSecretKey = vi.mocked(stripeServer.readStripeSecretKey);

describe("firstQueryValue", () => {
  it("reads a missing, string, or array query value", () => {
    expect(firstQueryValue(undefined)).toBe("");
    expect(firstQueryValue("nl_aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(firstQueryValue(["first", "second"])).toBe("first");
    expect(firstQueryValue([])).toBe("");
  });
});

describe("resolveReceipt", () => {
  beforeEach(() => {
    transactionStore.getById.mockReset();
    transactionStore.update.mockReset();
    retrieve.mockReset();
    readStripeSecretKey.mockReturnValue({ status: "missing" });
  });

  it("returns null for a missing or invalid reference", async () => {
    await expect(resolveReceipt("")).resolves.toBeNull();
    await expect(resolveReceipt("not-a-ref")).resolves.toBeNull();
    await expect(resolveReceipt("pi_123")).resolves.toBeNull();
    expect(transactionStore.getById).not.toHaveBeenCalled();
  });

  it("returns null for an unknown reference", async () => {
    transactionStore.getById.mockResolvedValue(null);

    await expect(resolveReceipt(TEST_REFERENCE)).resolves.toBeNull();
  });

  it("marks a known record unverified when Stripe is not ready", async () => {
    transactionStore.getById.mockResolvedValue(
      makeTransaction({ status: "paid" }),
    );

    const receipt = await resolveReceipt(TEST_REFERENCE);

    expect(receipt).toMatchObject({
      reference: TEST_REFERENCE,
      status: "paid",
      verifiedWithStripe: false,
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(receiptDecision(receipt).isPaid).toBe(false);
    expect(receiptDecision(receipt).unconfirmed).toBe(true);
  });

  it("returns a verified paid receipt from Stripe, not the local status", async () => {
    transactionStore.getById.mockResolvedValue(
      makeTransaction({ status: "pending", amountMajor: "1.00" }),
    );
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    retrieve.mockResolvedValue({
      amount: 2500,
      currency: "usd",
      status: "succeeded",
    });
    transactionStore.update.mockResolvedValue(
      makeTransaction({ status: "paid" }),
    );

    const receipt = await resolveReceipt(TEST_REFERENCE);

    expect(retrieve).toHaveBeenCalledWith("pi_test_northline_1");
    expect(receipt).toMatchObject({
      amountMajor: "25.00",
      currency: "USD",
      status: "paid",
      verifiedWithStripe: true,
    });
    expect(transactionStore.update).toHaveBeenCalledWith(TEST_REFERENCE, {
      status: "paid",
    });
    expect(receiptDecision(receipt).isPaid).toBe(true);
  });

  it("returns a verified failed receipt", async () => {
    transactionStore.getById.mockResolvedValue(makeTransaction());
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    retrieve.mockResolvedValue({
      amount: 2500,
      currency: "usd",
      status: "requires_payment_method",
    });
    transactionStore.update.mockResolvedValue(
      makeTransaction({ status: "failed" }),
    );

    const receipt = await resolveReceipt(TEST_REFERENCE);

    expect(receipt?.status).toBe("failed");
    expect(receipt?.verifiedWithStripe).toBe(true);
    expect(receiptDecision(receipt).declined).toBe(true);
    expect(receiptDecision(receipt).isPaid).toBe(false);
  });

  it("returns a verified processing receipt", async () => {
    transactionStore.getById.mockResolvedValue(makeTransaction());
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    retrieve.mockResolvedValue({
      amount: 2500,
      currency: "usd",
      status: "processing",
    });
    transactionStore.update.mockResolvedValue(
      makeTransaction({ status: "processing" }),
    );

    const receipt = await resolveReceipt(TEST_REFERENCE);
    expect(receiptDecision(receipt).isProcessing).toBe(true);
    expect(receiptDecision(receipt).isPaid).toBe(false);
  });

  it("stays unverified when Stripe retrieve fails", async () => {
    transactionStore.getById.mockResolvedValue(
      makeTransaction({ status: "paid" }),
    );
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    retrieve.mockRejectedValue(new Error("network"));

    const receipt = await resolveReceipt(TEST_REFERENCE);
    expect(receipt?.verifiedWithStripe).toBe(false);
    expect(receiptDecision(receipt).isPaid).toBe(false);
  });

  it("ignores amount and status query parameters when resolving a receipt", async () => {
    const query = {
      ref: "not-a-ref",
      amount: "9999.00",
      status: "paid",
      client_secret: "pi_fake_secret",
    };
    const reference = firstQueryValue(query.ref);
    const receipt = reference ? await resolveReceipt(reference) : null;

    expect(receipt).toBeNull();
    expect(receiptDecision(receipt).isPaid).toBe(false);
    expect(transactionStore.getById).not.toHaveBeenCalled();
  });
});
