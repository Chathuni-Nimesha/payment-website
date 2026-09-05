import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTransactionId, isTransactionId } from "@/lib/transactions/reference";
import { transactionStore } from "@/lib/transactions/store";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  testDatabaseUrl,
  useTestDatabase,
} from "./db";
import { makeTransaction } from "./helpers";

describe("transaction references", () => {
  it("generates an nl_ hex reference", () => {
    const id = createTransactionId();
    expect(isTransactionId(id)).toBe(true);
    expect(id).toMatch(/^nl_[a-f0-9]{24}$/);
  });

  it("rejects malformed references", () => {
    expect(isTransactionId("")).toBe(false);
    expect(isTransactionId("pi_123")).toBe(false);
    expect(isTransactionId("nl_short")).toBe(false);
    expect(isTransactionId("nl_zzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
  });
});

describeWithDatabase("PostgreSQL transaction store", () => {
  const url = useTestDatabase();

  beforeAll(() => {
    migrateTestDatabase(url);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("creates and reads a transaction by id", async () => {
    const record = makeTransaction();
    await transactionStore.create(record);

    const stored = await transactionStore.getById(record.id);
    expect(stored).toMatchObject({
      id: record.id,
      paymentIntentId: record.paymentIntentId,
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "pending",
    });
    expect(stored?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("looks up a transaction by PaymentIntent id", async () => {
    const record = makeTransaction();
    await transactionStore.create(record);

    await expect(
      transactionStore.getByPaymentIntentId(record.paymentIntentId),
    ).resolves.toMatchObject({ id: record.id });
  });

  it("updates status and PaymentIntent id", async () => {
    const record = makeTransaction({ status: "pending" });
    await transactionStore.create(record);

    const updated = await transactionStore.update(record.id, {
      status: "paid",
      paymentIntentId: "pi_updated",
    });

    expect(updated?.status).toBe("paid");
    expect(updated?.paymentIntentId).toBe("pi_updated");
    expect(updated?.updatedAt).not.toBe(record.updatedAt);

    const stored = await transactionStore.getById(record.id);
    expect(stored?.status).toBe("paid");
  });

  it("returns null when updating an unknown id", async () => {
    await expect(
      transactionStore.update("nl_bbbbbbbbbbbbbbbbbbbbbbbb", {
        status: "failed",
      }),
    ).resolves.toBeNull();
  });

  it("does not create a duplicate id or PaymentIntent id", async () => {
    const record = makeTransaction();
    await transactionStore.create(record);
    await transactionStore.create({
      ...record,
      email: "other@example.com",
      status: "paid",
    });

    const stored = await transactionStore.getById(record.id);
    expect(stored?.email).toBe("client@example.com");
    expect(stored?.status).toBe("pending");
  });

  it("does not create a second row for the same PaymentIntent", async () => {
    const record = makeTransaction();
    await transactionStore.create(record);
    await transactionStore.create({
      ...record,
      id: "nl_bbbbbbbbbbbbbbbbbbbbbbbb",
      email: "other@example.com",
    });

    const original = await transactionStore.getById(record.id);
    const other = await transactionStore.getById("nl_bbbbbbbbbbbbbbbbbbbbbbbb");
    expect(original?.paymentIntentId).toBe(record.paymentIntentId);
    expect(other).toBeNull();
  });

  it("returns null for unknown reads", async () => {
    await expect(
      transactionStore.getById("nl_cccccccccccccccccccccccc"),
    ).resolves.toBeNull();
    await expect(
      transactionStore.getByPaymentIntentId("pi_missing"),
    ).resolves.toBeNull();
  });
});

describe("PostgreSQL integration availability", () => {
  it("skips database tests unless TEST_DATABASE_URL is set", () => {
    if (!testDatabaseUrl()) {
      expect(testDatabaseUrl()).toBe("");
    }
  });
});
