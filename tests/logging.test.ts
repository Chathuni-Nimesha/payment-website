import { describe, expect, it, vi } from "vitest";
import { formatLogLine, logger, redactValue } from "@/lib/logging/logger";

describe("redactValue", () => {
  it("redacts sensitive keys and secret-shaped values", () => {
    const redacted = redactValue({
      password: "hunter2-secret",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$should-not-appear",
      token: "nl_session_raw_token",
      cookie: "nl_session=abc",
      authorization: "Bearer secret-token",
      stripeSecret: "sk_test_should_not_appear",
      webhookSecret: "whsec_should_not_appear",
      client_secret: "pi_test_northline_1_secret_abc",
      clientSecret: "pi_test_northline_1_secret_abc",
      cardNumber: "4242424242424242",
      pan: "4111111111111111",
      cvv: "123",
      cvc: "123",
      expiry: "12/34",
      DATABASE_URL: "postgres://user:pass@localhost:5432/northline",
      email: "client@example.com",
      scope: "create-intent",
    }) as Record<string, unknown>;

    expect(redacted.password).toBe("[redacted]");
    expect(redacted.passwordHash).toBe("[redacted]");
    expect(redacted.token).toBe("[redacted]");
    expect(redacted.cookie).toBe("[redacted]");
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.stripeSecret).toBe("[redacted]");
    expect(redacted.webhookSecret).toBe("[redacted]");
    expect(redacted.client_secret).toBe("[redacted]");
    expect(redacted.clientSecret).toBe("[redacted]");
    expect(redacted.cardNumber).toBe("[redacted]");
    expect(redacted.pan).toBe("[redacted]");
    expect(redacted.cvv).toBe("[redacted]");
    expect(redacted.cvc).toBe("[redacted]");
    expect(redacted.expiry).toBe("[redacted]");
    expect(redacted.DATABASE_URL).toBe("[redacted]");
    expect(redacted.email).toBe("c***@example.com");
    expect(redacted.scope).toBe("create-intent");
  });

  it("redacts secret strings even under safe keys", () => {
    expect(redactValue("sk_live_abc")).toBe("[redacted]");
    expect(redactValue("pk_test_abc")).toBe("[redacted]");
    expect(redactValue("postgres://user:secret@localhost:5432/db")).toBe(
      "[redacted]",
    );
    expect(redactValue("pi_abc123_secret_xyz")).toBe("[redacted]");
  });
});

describe("formatLogLine", () => {
  it("emits structured JSON with timestamp, level, and event", () => {
    const line = formatLogLine("error", "payments.create_intent_failed", {
      scope: "create-intent",
    });
    const parsed = JSON.parse(line) as {
      ts: string;
      level: string;
      event: string;
      meta: { scope: string };
    };

    expect(parsed.level).toBe("error");
    expect(parsed.event).toBe("payments.create_intent_failed");
    expect(parsed.meta.scope).toBe("create-intent");
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not emit passwords, session tokens, Stripe secrets, or PAN", () => {
    const line = formatLogLine("error", "auth.login_unavailable", {
      password: "hunter2-secret",
      token: "raw-session-token",
      cookie: "nl_session=raw-session-token",
      stripeKey: "sk_test_should_not_appear",
      client_secret: "pi_test_northline_1_secret_abc",
      cardNumber: "4242424242424242",
      cvv: "FAKESECRET_i2j3k4l5m6n7o8p9q0r1",
      DATABASE_URL: "postgres://user:pass@localhost:5432/northline",
      email: "owner@example.com",
    });

    expect(line).not.toContain("hunter2-secret");
    expect(line).not.toContain("raw-session-token");
    expect(line).not.toContain("sk_test_should_not_appear");
    expect(line).not.toContain("pi_test_northline_1_secret_abc");
    expect(line).not.toContain("4242424242424242");
    expect(line).not.toContain("cvv-should-not-appear");
    expect(line).not.toContain("postgres://user:pass");
    expect(line).not.toContain("owner@example.com");
    expect(line).toContain("o***@example.com");
  });
});

describe("logger", () => {
  it("writes redacted JSON through console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("payments.webhook_persist_failed", {
      type: "payment_intent.succeeded",
      client_secret: "pi_test_northline_1_secret_abc",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as {
      event: string;
      meta: { type: string; client_secret: string };
    };
    expect(parsed.event).toBe("payments.webhook_persist_failed");
    expect(parsed.meta.type).toBe("payment_intent.succeeded");
    expect(parsed.meta.client_secret).toBe("[redacted]");
    expect(line).not.toContain("pi_test_northline_1_secret_abc");

    spy.mockRestore();
  });
});
