import { afterEach, describe, expect, it, vi } from "vitest";
import { metadata as forgotMetadata } from "@/app/forgot-password/page";
import { metadata as resetMetadata } from "@/app/reset-password/page";
import { metadata as verifyMetadata } from "@/app/verify-email/page";
import { withDevPreview } from "@/lib/auth/dev-preview";
import { AUTH_RECOVERY_SENT } from "@/lib/auth/messages";
import { hashSecret } from "@/lib/auth/secret";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendAuthEmail } from "@/lib/email/send";
import { buildAuthEmail } from "@/lib/email/templates";
import { formatLogLine } from "@/lib/logging/logger";

describe("auth recovery tokens", () => {
  it("creates a long random token and stores only a SHA-256 hash", () => {
    const issued = createAuthToken();
    expect(issued.token.length).toBeGreaterThanOrEqual(40);
    expect(issued.tokenHash).toBe(hashSecret(issued.token));
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.tokenHash).not.toBe(issued.token);
  });

  it("puts the token only in the dedicated query parameter", () => {
    const issued = createAuthToken();
    const mail = buildAuthEmail({
      to: "client@example.com",
      purpose: "password_reset",
      token: issued.token,
    });
    const url = new URL(mail.url);
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBe(issued.token);
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.has("password")).toBe(false);
  });
});

describe("dev mail preview", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it("omits preview URLs in production", () => {
    process.env.NODE_ENV = "production";
    expect(
      withDevPreview(
        { ok: true, message: AUTH_RECOVERY_SENT },
        "http://localhost:3000/reset-password?token=raw-token-value",
      ),
    ).toEqual({ ok: true, message: AUTH_RECOVERY_SENT });
  });

  it("includes a preview URL outside production", () => {
    process.env.NODE_ENV = "test";
    expect(
      withDevPreview(
        { ok: true, message: AUTH_RECOVERY_SENT },
        "http://localhost:3000/reset-password?token=raw-token-value",
      ),
    ).toEqual({
      ok: true,
      message: AUTH_RECOVERY_SENT,
      devUrl: "http://localhost:3000/reset-password?token=raw-token-value",
    });
  });
});

describe("recovery page indexing", () => {
  it("marks recovery pages as noindex", () => {
    expect(forgotMetadata.robots).toEqual({ index: false, follow: false });
    expect(resetMetadata.robots).toEqual({ index: false, follow: false });
    expect(verifyMetadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("recovery logging", () => {
  it("does not emit raw tokens, passwords, or emails in log lines", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method as keyof Console).mockImplementation(() => {}),
    );
    const token = "raw-recovery-token-should-not-appear";

    try {
      await sendAuthEmail({
        to: "owner@example.com",
        purpose: "password_reset",
        token,
      });

      const serialized = spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => JSON.stringify(args))
        .join("\n");
      expect(serialized).not.toContain(token);
      expect(serialized).not.toContain("owner@example.com");
      expect(
        formatLogLine("info", "email.queued", { token, password: "secret" }),
      ).not.toContain(token);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
