import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

import { clientIp, trustedProxyEnabled } from "@/lib/rate-limit/client-ip";
import {
  hashRateLimitIdentity,
  limitAuthLoginByIdentity,
  limitAuthLoginByIp,
  limitAuthRegisterByIp,
  limitAuthForgotPasswordByIdentity,
  limitAuthForgotPasswordByIp,
  limitAuthResetPasswordByIp,
  limitAuthResendVerificationByIdentity,
  limitAuthVerifyEmailByIp,
  limitCreateIntentByIdentity,
  limitCreateIntentByIp,
  limiterUnavailableBehavior,
  limitUnsignedWebhook,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const originalTrustedProxy = process.env.TRUSTED_PROXY;
const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.TRUSTED_PROXY = "true";
});

afterEach(() => {
  if (originalTrustedProxy === undefined) {
    delete process.env.TRUSTED_PROXY;
  } else {
    process.env.TRUSTED_PROXY = originalTrustedProxy;
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe("clientIp", () => {
  const spoofed = new Request("http://localhost/api/payments/create-intent", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.2",
    },
  });

  it("uses the first x-forwarded-for hop when a proxy is trusted", () => {
    process.env.TRUSTED_PROXY = "true";
    expect(clientIp(spoofed)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    process.env.TRUSTED_PROXY = "true";
    expect(
      clientIp(
        new Request("http://localhost/api/payments/create-intent", {
          headers: { "x-real-ip": "198.51.100.2" },
        }),
      ),
    ).toBe("198.51.100.2");
  });

  it("returns unknown when trusted headers are missing", () => {
    process.env.TRUSTED_PROXY = "true";
    expect(clientIp(new Request("http://localhost/api/payments/create-intent"))).toBe(
      "unknown",
    );
  });

  it("ignores spoofed x-forwarded-for when proxy trust is disabled", () => {
    process.env.TRUSTED_PROXY = "false";
    expect(clientIp(spoofed)).toBe("unknown");
  });

  it("ignores spoofed x-real-ip when proxy trust is disabled", () => {
    process.env.TRUSTED_PROXY = "false";
    expect(
      clientIp(
        new Request("http://localhost/api/payments/create-intent", {
          headers: { "x-real-ip": "198.51.100.2" },
        }),
      ),
    ).toBe("unknown");
  });

  it("has no direct socket IP on the Fetch Request, so untrusted mode is unknown", () => {
    process.env.TRUSTED_PROXY = "false";
    expect(clientIp(new Request("http://localhost/api/payments/create-intent"))).toBe(
      "unknown",
    );
  });

  it("defaults to trusting forwarded headers outside production", () => {
    delete process.env.TRUSTED_PROXY;
    process.env.NODE_ENV = "test";
    expect(trustedProxyEnabled()).toBe(true);
    expect(clientIp(spoofed)).toBe("203.0.113.10");
  });

  it("defaults to ignoring forwarded headers in production", () => {
    delete process.env.TRUSTED_PROXY;
    process.env.NODE_ENV = "production";
    expect(trustedProxyEnabled()).toBe(false);
    expect(clientIp(spoofed)).toBe("unknown");
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

  it("fails closed for auth when a database URL is configured", () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    expect(limiterUnavailableBehavior("auth")).toBe("deny");
  });

  it("fails open for auth when no database URL is configured", () => {
    readDatabaseUrl.mockReturnValue(null);
    expect(limiterUnavailableBehavior("auth")).toBe("allow");
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

describe("limitAuthLoginByIp", () => {
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

    const result = await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(true);
    expect(consumeOrThrow).toHaveBeenCalledWith(
      "auth:login:ip:203.0.113.10",
      10,
      60_000,
    );
  });

  it("returns 429 with Retry-After when the IP limit is exceeded", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 37,
    });

    const result = await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("37");
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

    await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );
    await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.11" },
      }),
    );

    expect(consumeOrThrow.mock.calls[0]?.[0]).toBe("auth:login:ip:203.0.113.10");
    expect(consumeOrThrow.mock.calls[1]?.[0]).toBe("auth:login:ip:203.0.113.11");
  });

  it("fails closed with a generic 503 when the limiter throws and a database is configured", async () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    consumeOrThrow.mockRejectedValue(new Error("connection refused"));

    const result = await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login"),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      const body = await result.response.json();
      expect(JSON.stringify(body)).not.toContain("connection refused");
      expect(JSON.stringify(body)).not.toMatch(/postgres|password/i);
    }
  });

  it("fails open when the limiter throws and no database is configured", async () => {
    readDatabaseUrl.mockReturnValue(null);
    consumeOrThrow.mockRejectedValue(new Error("DATABASE_URL is not configured."));

    const result = await limitAuthLoginByIp(
      new Request("http://localhost/api/auth/login"),
    );

    expect(result.ok).toBe(true);
  });
});

describe("limitAuthLoginByIdentity", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("hashes email instead of storing it in the key", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 5,
      retryAfterSeconds: 60,
    });

    await limitAuthLoginByIdentity(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      "Client@Example.com",
    );

    const key = String(consumeOrThrow.mock.calls[0]?.[0]);
    const digest = hashRateLimitIdentity("client@example.com");
    expect(key).toBe(`auth:login:ip-email:203.0.113.10:${digest}`);
    expect(key).not.toContain("client@example.com");
    expect(key).not.toContain("Client@Example.com");
  });

  it("uses the same hashed identity for the same email regardless of case", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 5,
      retryAfterSeconds: 60,
    });

    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    await limitAuthLoginByIdentity(request, "Owner@Example.com");
    await limitAuthLoginByIdentity(request, "owner@example.com");

    expect(consumeOrThrow.mock.calls[0]?.[0]).toBe(
      consumeOrThrow.mock.calls[1]?.[0],
    );
  });
});

describe("limitAuthRegisterByIp", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("allows requests within the limit", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });

    const result = await limitAuthRegisterByIp(
      new Request("http://localhost/api/auth/register", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(true);
    expect(consumeOrThrow).toHaveBeenCalledWith(
      "auth:register:ip:203.0.113.10",
      5,
      60_000,
    );
  });

  it("returns 429 when the register IP limit is exceeded", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 22,
    });

    const result = await limitAuthRegisterByIp(
      new Request("http://localhost/api/auth/register", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("22");
    }
  });
});

describe("limitAuthForgotPasswordByIp", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("returns 429 when the forgot-password IP limit is exceeded", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 19,
    });

    const result = await limitAuthForgotPasswordByIp(
      new Request("http://localhost/api/auth/forgot-password", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBe("19");
    }
  });
});

describe("limitAuthForgotPasswordByIdentity", () => {
  beforeEach(() => {
    consumeOrThrow.mockReset();
    readDatabaseUrl.mockReturnValue(null);
  });

  it("hashes email instead of storing it in the key", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 60,
    });

    await limitAuthForgotPasswordByIdentity(
      new Request("http://localhost/api/auth/forgot-password", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      "Client@Example.com",
    );

    const key = String(consumeOrThrow.mock.calls[0]?.[0]);
    expect(key).toBe(
      `auth:forgot-password:ip-email:203.0.113.10:${hashRateLimitIdentity("client@example.com")}`,
    );
    expect(key).not.toContain("client@example.com");
  });
});

describe("limitAuthResetPasswordByIp", () => {
  it("uses a dedicated reset-password bucket", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 60,
    });

    await limitAuthResetPasswordByIp(
      new Request("http://localhost/api/auth/reset-password", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(consumeOrThrow.mock.calls[0]?.[0]).toBe(
      "auth:reset-password:ip:203.0.113.10",
    );
  });
});

describe("limitAuthVerifyEmailByIp", () => {
  it("uses a dedicated verify-email bucket", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterSeconds: 60,
    });

    await limitAuthVerifyEmailByIp(
      new Request("http://localhost/api/auth/verify-email", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(consumeOrThrow.mock.calls[0]?.[0]).toBe(
      "auth:verify-email:ip:203.0.113.10",
    );
  });
});

describe("limitAuthResendVerificationByIdentity", () => {
  it("hashes email instead of storing it in the key", async () => {
    consumeOrThrow.mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 60,
    });

    await limitAuthResendVerificationByIdentity(
      new Request("http://localhost/api/auth/resend-verification", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      "Owner@Example.com",
    );

    const key = String(consumeOrThrow.mock.calls[0]?.[0]);
    expect(key).not.toContain("owner@example.com");
    expect(key).toContain("auth:resend-verification:ip-email:203.0.113.10:");
  });
});
