import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/payments/route";
import { AUTH_UNAUTHENTICATED } from "@/lib/auth/messages";
import { parsePage, parsePageSize, toPublicPayment } from "@/lib/payments/history";
import { transactionStore } from "@/lib/transactions/store";
import { makeTransaction } from "./helpers";

vi.mock("@/lib/auth/session", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("@/lib/transactions/store", () => ({
  transactionStore: {
    listByUser: vi.fn(),
  },
}));

import { requireApiUser } from "@/lib/auth/session";

const requireUser = vi.mocked(requireApiUser);
const listByUser = vi.mocked(transactionStore.listByUser);

describe("payment history helpers", () => {
  it("maps safe public fields only", () => {
    const publicPayment = toPublicPayment(
      makeTransaction({
        paymentIntentId: "pi_secret_row",
        email: "hidden@example.com",
        userId: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    );

    expect(publicPayment).toEqual({
      id: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      reference: "nl_aaaaaaaaaaaaaaaaaaaaaaaa",
      amountMinor: 2500,
      amountMajor: "25.00",
      currency: "USD",
      status: "pending",
      createdAt: "2026-01-15T12:00:00.000Z",
      updatedAt: "2026-01-15T12:00:00.000Z",
    });
    expect(JSON.stringify(publicPayment)).not.toContain("pi_secret_row");
    expect(JSON.stringify(publicPayment)).not.toContain("hidden@example.com");
    expect(JSON.stringify(publicPayment)).not.toContain("usr_");
  });

  it("clamps pagination", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("2")).toBe(2);
    expect(parsePageSize("500")).toBe(50);
    expect(parsePageSize("abc")).toBe(10);
  });
});

describe("GET /api/payments", () => {
  beforeEach(() => {
    requireUser.mockReset();
    listByUser.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: AUTH_UNAUTHENTICATED }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/payments"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: AUTH_UNAUTHENTICATED,
    });
    expect(listByUser).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's payments and ignores a query userId", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      user: {
        id: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
        email: "owner@example.com",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
    });
    listByUser.mockResolvedValue({
      items: [makeTransaction({ userId: "usr_aaaaaaaaaaaaaaaaaaaaaaaa" })],
      page: 2,
      pageSize: 10,
      total: 11,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/payments?page=2&userId=usr_bbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    );

    expect(response.status).toBe(200);
    expect(listByUser).toHaveBeenCalledWith("usr_aaaaaaaaaaaaaaaaaaaaaaaa", {
      page: 2,
      pageSize: 10,
    });
    const body = await response.json();
    expect(body.page).toBe(2);
    expect(body.total).toBe(11);
    expect(body.transactions[0].reference).toBe("nl_aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("client_secret");
    expect(JSON.stringify(body)).not.toContain("pi_test_northline_1");
  });

  it("clamps invalid pagination instead of listing another user", async () => {
    requireUser.mockResolvedValue({
      ok: true,
      user: {
        id: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
        email: "owner@example.com",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
    });
    listByUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
    });

    const response = await GET(
      new Request("http://localhost/api/payments?page=0&pageSize=500"),
    );

    expect(response.status).toBe(200);
    expect(listByUser).toHaveBeenCalledWith("usr_aaaaaaaaaaaaaaaaaaaaaaaa", {
      page: 1,
      pageSize: 50,
    });
  });
});
