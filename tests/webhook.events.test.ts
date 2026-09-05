import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { getPool } from "@/lib/db/client";
import * as stripeServer from "@/lib/stripe/server";
import { transactionStore } from "@/lib/transactions/store";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";

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

const getStripeWebhookSecret = vi.mocked(stripeServer.getStripeWebhookSecret);
const readStripeSecretKey = vi.mocked(stripeServer.readStripeSecretKey);

function paymentIntent(
  status: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "pi_route_event",
    amount: 2500,
    currency: "usd",
    status,
    receipt_email: "client@example.com",
    metadata: { northline_reference: "nl_333333333333333333333333" },
    ...overrides,
  };
}

function webhookRequest(signature = "t=1,v1=valid") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: "{}",
  });
}

describeWithDatabase("webhook event route with PostgreSQL", () => {
  const url = useTestDatabase();

  beforeAll(() => {
    migrateTestDatabase(url);
  });

  beforeEach(async () => {
    await resetTestDatabase();
    getStripeWebhookSecret.mockReturnValue("whsec_test_placeholder");
    readStripeSecretKey.mockReturnValue({
      status: "ready",
      key: "sk_test_placeholder",
    });
    constructEvent.mockReset();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("persists a signed succeeded event and can create the transaction", async () => {
    constructEvent.mockReturnValue({
      id: "evt_route_paid",
      created: 1_700_000_000,
      type: "payment_intent.succeeded",
      data: { object: paymentIntent("succeeded") },
    });

    const response = await POST(webhookRequest());
    expect(response.status).toBe(200);
    expect(constructEvent).toHaveBeenCalled();

    await expect(
      transactionStore.getByPaymentIntentId("pi_route_event"),
    ).resolves.toMatchObject({
      id: "nl_333333333333333333333333",
      status: "paid",
    });
  });

  it("returns 200 and does not re-apply a duplicate event id", async () => {
    constructEvent.mockReturnValue({
      id: "evt_route_dup",
      created: 1_700_000_100,
      type: "payment_intent.succeeded",
      data: { object: paymentIntent("succeeded") },
    });

    expect((await POST(webhookRequest())).status).toBe(200);
    expect((await POST(webhookRequest())).status).toBe(200);

    const events = await getPool().query(
      "SELECT count(*)::int AS count FROM stripe_events WHERE id = $1",
      ["evt_route_dup"],
    );
    expect(events.rows[0].count).toBe(1);
  });

  it("still requires constructEvent before any database write", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature.");
    });

    const response = await POST(webhookRequest("t=1,v1=forged"));
    expect(response.status).toBe(400);

    const events = await getPool().query(
      "SELECT count(*)::int AS count FROM stripe_events",
    );
    const rows = await getPool().query(
      "SELECT count(*)::int AS count FROM transactions",
    );
    expect(events.rows[0].count).toBe(0);
    expect(rows.rows[0].count).toBe(0);
  });
});
