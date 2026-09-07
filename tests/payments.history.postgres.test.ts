import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { GET } from "@/app/api/payments/route";
import { AUTH_UNAUTHENTICATED } from "@/lib/auth/messages";
import { createUserWithSession } from "@/lib/auth/store";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
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

describeWithDatabase("authenticated payment history", () => {
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

  it("keeps user_id nullable and indexed", async () => {
    const column = await getPool().query<{ is_nullable: string }>(
      `
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_name = 'transactions'
          AND column_name = 'user_id'
      `,
    );
    expect(column.rows[0]?.is_nullable).toBe("YES");

    const index = await getPool().query<{ indexname: string }>(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'transactions'
          AND indexname = 'idx_transactions_user_created'
      `,
    );
    expect(index.rows).toHaveLength(1);
  });

  it("clears transaction ownership when the user is deleted", async () => {
    const created = await createUserWithSession({
      email: "delete-me@example.com",
      password: "longenough1",
    });
    if (!created.ok) {
      throw new Error("Could not create user.");
    }

    await transactionStore.create(
      makeTransaction({
        id: "nl_bbbbbbbbbbbbbbbbbbbbbbbb",
        paymentIntentId: "pi_owned_deleted",
        userId: created.user.id,
      }),
    );

    await getPool().query("DELETE FROM users WHERE id = $1", [created.user.id]);

    const stored = await transactionStore.getById("nl_bbbbbbbbbbbbbbbbbbbbbbbb");
    expect(stored?.userId).toBeNull();
  });

  it("does not let a webhook overwrite an existing owner", async () => {
    const created = await createUserWithSession({
      email: "owner@example.com",
      password: "longenough1",
    });
    if (!created.ok) {
      throw new Error("Could not create user.");
    }

    await transactionStore.create(
      makeTransaction({
        id: "nl_cccccccccccccccccccccccc",
        paymentIntentId: "pi_keep_owner",
        userId: created.user.id,
        status: "pending",
      }),
    );

    await transactionStore.applyPaymentIntentEvent({
      eventId: "evt_keep_owner",
      eventType: "payment_intent.succeeded",
      eventCreatedAt: new Date("2026-01-15T12:05:00.000Z"),
      paymentIntentId: "pi_keep_owner",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      email: "owner@example.com",
      status: "paid",
      reference: "nl_cccccccccccccccccccccccc",
    });

    await expect(
      transactionStore.getByPaymentIntentId("pi_keep_owner"),
    ).resolves.toMatchObject({
      status: "paid",
      userId: created.user.id,
    });
  });

  it("returns 401 without a session and never lists another user's payments", async () => {
    const owner = await createUserWithSession({
      email: "alpha@example.com",
      password: "longenough1",
    });
    const other = await createUserWithSession({
      email: "bravo@example.com",
      password: "longenough1",
    });
    if (!owner.ok || !other.ok) {
      throw new Error("Could not create users.");
    }

    await transactionStore.create(
      makeTransaction({
        id: "nl_dddddddddddddddddddddddd",
        paymentIntentId: "pi_alpha",
        userId: owner.user.id,
      }),
    );
    await transactionStore.create(
      makeTransaction({
        id: "nl_eeeeeeeeeeeeeeeeeeeeeeee",
        paymentIntentId: "pi_bravo",
        userId: other.user.id,
      }),
    );

    const unauthenticated = await GET(
      new Request("http://localhost/api/payments"),
    );
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      error: AUTH_UNAUTHENTICATED,
    });

    const owned = await GET(
      new Request("http://localhost/api/payments?userId=" + other.user.id, {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${owner.token}`,
        },
      }),
    );
    expect(owned.status).toBe(200);
    const body = await owned.json();
    expect(body.total).toBe(1);
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].id).toBe("nl_dddddddddddddddddddddddd");
    expect(JSON.stringify(body)).not.toContain(other.user.id);
    expect(JSON.stringify(body)).not.toContain("pi_bravo");
    expect(JSON.stringify(body)).not.toContain("password_hash");
  });
});
