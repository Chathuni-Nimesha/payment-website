import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { getPool } from "@/lib/db/client";
import { transactionStore } from "@/lib/transactions/store";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";
import { makeTransaction } from "./helpers";

describeWithDatabase("PostgreSQL webhook persistence", () => {
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

  it("creates a transaction from a webhook when create-intent has not persisted", async () => {
    const result = await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_created_first",
      eventType: "payment_intent.succeeded",
      eventCreatedAt: new Date("2026-01-15T12:00:00.000Z"),
      paymentIntentId: "pi_webhook_first",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "paid",
      reference: "nl_dddddddddddddddddddddddd",
    });

    expect(result).toBe("applied");
    await expect(
      transactionStore.getByPaymentIntentId("pi_webhook_first"),
    ).resolves.toMatchObject({
      id: "nl_dddddddddddddddddddddddd",
      status: "paid",
    });
  });

  it("ignores a duplicate Stripe event id", async () => {
    const input = {
      eventId: "evt_duplicate",
      eventType: "payment_intent.payment_failed" as const,
      eventCreatedAt: new Date("2026-01-15T12:00:00.000Z"),
      paymentIntentId: "pi_duplicate_event",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "failed" as const,
      reference: "nl_eeeeeeeeeeeeeeeeeeeeeeee",
    };

    await expect(transactionStore.applyPaymentIntentEvent(input)).resolves.toBe(
      "applied",
    );
    await expect(transactionStore.applyPaymentIntentEvent(input)).resolves.toBe(
      "duplicate",
    );

    const events = await getPool().query(
      "SELECT count(*)::int AS count FROM stripe_events WHERE id = $1",
      ["evt_duplicate"],
    );
    expect(events.rows[0].count).toBe(1);

    const stored = await transactionStore.getByPaymentIntentId(
      "pi_duplicate_event",
    );
    expect(stored?.status).toBe("failed");
  });

  it("does not let an older failed event downgrade a paid transaction", async () => {
    await transactionStore.create(
      makeTransaction({
        id: "nl_ffffffffffffffffffffffff",
        paymentIntentId: "pi_paid_first",
        status: "pending",
      }),
    );

    await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_newer_paid",
      eventType: "payment_intent.succeeded",
      eventCreatedAt: new Date("2026-01-15T12:05:00.000Z"),
      paymentIntentId: "pi_paid_first",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "paid",
      reference: "nl_ffffffffffffffffffffffff",
    });

    await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_older_failed",
      eventType: "payment_intent.payment_failed",
      eventCreatedAt: new Date("2026-01-15T12:00:00.000Z"),
      paymentIntentId: "pi_paid_first",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "failed",
      reference: "nl_ffffffffffffffffffffffff",
    });

    await expect(
      transactionStore.getByPaymentIntentId("pi_paid_first"),
    ).resolves.toMatchObject({ status: "paid" });
  });

  it("lets a newer succeeded event move failed or processing to paid", async () => {
    await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_failed_first",
      eventType: "payment_intent.payment_failed",
      eventCreatedAt: new Date("2026-01-15T12:00:00.000Z"),
      paymentIntentId: "pi_retry_success",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "failed",
      reference: "nl_111111111111111111111111",
    });

    await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_later_paid",
      eventType: "payment_intent.succeeded",
      eventCreatedAt: new Date("2026-01-15T12:10:00.000Z"),
      paymentIntentId: "pi_retry_success",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "paid",
      reference: "nl_111111111111111111111111",
    });

    await expect(
      transactionStore.getByPaymentIntentId("pi_retry_success"),
    ).resolves.toMatchObject({ status: "paid" });
  });

  it("keeps repeated concurrent webhook delivery safe", async () => {
    const input = {
      eventId: "evt_concurrent",
      eventType: "payment_intent.succeeded" as const,
      eventCreatedAt: new Date("2026-01-15T12:00:00.000Z"),
      paymentIntentId: "pi_concurrent",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "client@example.com",
      status: "paid" as const,
      reference: "nl_222222222222222222222222",
    };

    const results = await Promise.all([
      transactionStore.applyPaymentIntentEvent(input),
      transactionStore.applyPaymentIntentEvent(input),
      transactionStore.applyPaymentIntentEvent(input),
    ]);

    expect(results.filter((item) => item === "applied")).toHaveLength(1);
    expect(results.filter((item) => item === "duplicate")).toHaveLength(2);

    const events = await getPool().query(
      "SELECT count(*)::int AS count FROM stripe_events WHERE id = $1",
      ["evt_concurrent"],
    );
    const rows = await getPool().query(
      "SELECT count(*)::int AS count FROM transactions WHERE payment_intent_id = $1",
      ["pi_concurrent"],
    );
    expect(events.rows[0].count).toBe(1);
    expect(rows.rows[0].count).toBe(1);
  });
});
