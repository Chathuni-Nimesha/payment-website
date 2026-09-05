import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITED_MESSAGE } from "@/lib/rate-limit/config";

const consumeOrThrow = vi.fn();
const readDatabaseUrl = vi.fn();

vi.mock("@/lib/rate-limit/postgres", () => ({
  consumeOrThrow: (...args: unknown[]) => consumeOrThrow(...args),
}));

vi.mock("@/lib/db/client", () => ({
  readDatabaseUrl: () => readDatabaseUrl(),
  getPool: vi.fn(),
}));

import { clientIp } from "@/lib/rate-limit/client-ip";
import {
  limitCreateIntentByIdentity,
  limitCreateIntentByIp,
  limiterUnavailableBehavior,
  limitUnsignedWebhook,
  rateLimitedResponse,
} from "@/lib/rate-limit";

describe("clientIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const request = new Request("http://localhost/api/payments/create-intent", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-real-ip": "198.51.100.2",
      },
    });

    expect(clientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(
      clientIp(
        new Request("http://localhost/api/payments/create-intent", {
          headers: { "x-real-ip": "198.51.100.2" },
        }),
      ),
    ).toBe("198.51.100.2");
    expect(clientIp(new Request("http://localhost/api/payments/create-intent"))).toBe(
      "unknown",
    );
  });
});

describe("limiterUnavailableBehavior", () => {
  it("fails open when create-intent has no database URL", () => {
    readDatabaseUrl.mockReturnValue(null);
    expect(limiterUnavailableBehavior("create-intent")).toBe("allow");
  });

  it("fails closed when create-intent has a database URL", () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    expect(limiterUnavailableBehavior("create-intent")).toBe("deny");
  });

  it("always fails open for unsigned webhook limiting", () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    expect(limiterUnavailableBehavior("webhook-unsigned")).toBe("allow");
  });
});

describe("rateLimitedResponse", () => {
  it("returns a safe 429 without internals", async () => {
    const response = rateLimitedResponse(12);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    const body = await response.json();
    expect(body).toEqual({ error: RATE_LIMITED_MESSAGE });
    expect(JSON.stringify(body)).not.toMatch(/postgres|sk_|card|cvv/i);
  });
});

describe("limitCreateIntentByIp", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("allows requests within the limit", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 60,
    });

    const result = await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(true);
    expect(consumeOrThrow).toHaveBeenCalledWith(
      "payments:create-intent:ip:203.0.113.10",
      10,
      60_000,
    );
  });

  it("returns 429 when the limit is exceeded", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 41,
    });

    const result = await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("41");
      await expect(result.response.json()).resolves.toEqual({
        error: RATE_LIMITED_MESSAGE,
      });
    }
  });

  it("uses independent keys for different IPs", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 60,
    });

    await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent", {
        headers: { "x-forwarded-for": "203.0.113.11" },
      }),
    );

    expect(consumeOrThrow.mock.calls[0]?.[0]).toBe(
      "payments:create-intent:ip:203.0.113.10",
    );
    expect(consumeOrThrow.mock.calls[1]?.[0]).toBe(
      "payments:create-intent:ip:203.0.113.11",
    );
  });

  it("fails open when the limiter throws and no database is configured", async () => {
    readDatabaseUrl.mockReturnValue(null);
    consumeOrThrow.mockRejectedValue(new Error("connection refused"));

    const result = await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent"),
    );

    expect(result.ok).toBe(true);
  });

  it("fails closed when the limiter throws and a database is configured", async () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    consumeOrThrow.mockRejectedValue(new Error("connection refused"));

    const result = await limitCreateIntentByIp(
      new Request("http://localhost/api/payments/create-intent"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      const body = await result.response.json();
      expect(body.error).toBe(
        "The checkout could not be prepared. Please try again.",
      );
      expect(JSON.stringify(body)).not.toContain("connection refused");
    }
  });
});

describe("limitCreateIntentByIdentity", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("skips the identity bucket when email is empty", async () => {
    const result = await limitCreateIntentByIdentity(
      new Request("http://localhost/api/payments/create-intent"),
      "   ",
    );

    expect(result.ok).toBe(true);
    expect(consumeOrThrow).not.toHaveBeenCalled();
  });

  it("hashes email instead of storing it in the key", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 5,
      retryAfterSeconds: 60,
    });

    await limitCreateIntentByIdentity(
      new Request("http://localhost/api/payments/create-intent", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      "Client@Example.com",
    );

    const key = String(consumeOrThrow.mock.calls[0]?.[0]);
    expect(key).toContain("payments:create-intent:ip-email:203.0.113.10:");
    expect(key).not.toContain("client@example.com");
    expect(key).not.toContain("Client@Example.com");
  });
});

describe("limitUnsignedWebhook", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
  });

  it("returns 429 for unsigned floods", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 20,
    });

    const result = await limitUnsignedWebhook(
      new Request("http://localhost/api/webhooks/stripe", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
    }
  });

  it("fails open so Stripe retries are never blocked by limiter errors", async () => {
    consumeOrThrow.mockRejectedValue(new Error("database timeout"));

    const result = await limitUnsignedWebhook(
      new Request("http://localhost/api/webhooks/stripe"),
    );

    expect(result.ok).toBe(true);
  });
});
