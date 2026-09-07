import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as resendVerification } from "@/app/api/auth/resend-verification/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_RECOVERY_SENT,
  AUTH_RESET_COMPLETE,
  AUTH_RESET_INVALID,
  AUTH_VERIFY_CONFIRMED,
  AUTH_VERIFY_INVALID,
  AUTH_VERIFY_SENT,
} from "@/lib/auth/messages";
import { hashSecret } from "@/lib/auth/secret";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getPool } from "@/lib/db/client";
import { clearDevMailbox, lastDevEmail } from "@/lib/email/dev-mailbox";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";
import { jsonRequest } from "./helpers";

const password = "correct-horse";
const email = "client@example.com";

function authRequest(url: string, body: unknown, headers?: HeadersInit) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    ...headers,
  });
}

function sessionTokenFrom(response: Response) {
  const header = response.headers.get("Set-Cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function requestWithSession(url: string, token: string) {
  return new Request(url, {
    method: "GET",
    headers: {
      Origin: "http://localhost:3000",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

function tokenFromMail() {
  const mail = lastDevEmail();
  expect(mail?.url).toBeTruthy();
  return new URL(mail?.url ?? "http://localhost").searchParams.get("token") ?? "";
}

describeWithDatabase("account recovery with PostgreSQL", () => {
  const url = useTestDatabase();

  beforeAll(() => {
    migrateTestDatabase(url);
  });

  beforeEach(async () => {
    await resetTestDatabase();
    clearDevMailbox();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("registers an unverified user and stores a hashed verification token", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.emailVerified).toBe(false);

    const raw = tokenFromMail();
    const stored = await getPool().query<{
      token_hash: string;
      purpose: string;
      used_at: Date | null;
    }>("SELECT token_hash, purpose, used_at FROM auth_tokens");

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].purpose).toBe("email_verification");
    expect(stored.rows[0].used_at).toBeNull();
    expect(stored.rows[0].token_hash).toBe(hashSecret(raw));
    expect(JSON.stringify(stored.rows)).not.toContain(raw);
  });

  it("verifies email with a valid token and rejects replay", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const token = tokenFromMail();

    const success = await verifyEmail(
      authRequest("http://localhost:3000/api/auth/verify-email", { token }),
    );
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toEqual({
      ok: true,
      message: AUTH_VERIFY_CONFIRMED,
    });

    const user = await getPool().query<{ email_verified_at: Date | null }>(
      "SELECT email_verified_at FROM users WHERE email = $1",
      [email],
    );
    expect(user.rows[0].email_verified_at).toBeTruthy();

    const replay = await verifyEmail(
      authRequest("http://localhost:3000/api/auth/verify-email", { token }),
    );
    expect(replay.status).toBe(400);
    await expect(replay.json()).resolves.toEqual({ error: AUTH_VERIFY_INVALID });
  });

  it("rejects expired verification tokens", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const token = tokenFromMail();
    await getPool().query(
      "UPDATE auth_tokens SET expires_at = now() - interval '1 minute'",
    );

    const response = await verifyEmail(
      authRequest("http://localhost:3000/api/auth/verify-email", { token }),
    );
    expect(response.status).toBe(400);
    const verified = await getPool().query<{ email_verified_at: Date | null }>(
      "SELECT email_verified_at FROM users WHERE email = $1",
      [email],
    );
    expect(verified.rows[0].email_verified_at).toBeNull();
  });

  it("returns equivalent public responses for forgot-password", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );

    const existing = await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
    );
    const missing = await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", {
        email: "missing@example.com",
      }),
    );

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    const existingBody = await existing.json();
    const missingBody = await missing.json();
    expect(existingBody.message).toBe(AUTH_RECOVERY_SENT);
    expect(missingBody.message).toBe(AUTH_RECOVERY_SENT);
    expect(existingBody.ok).toBe(true);
    expect(missingBody.ok).toBe(true);
    expect(missingBody.devUrl).toBeUndefined();
  });

  it("stores a hashed reset token and never the raw value", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
    );
    const raw = tokenFromMail();
    const rows = await getPool().query<{ token_hash: string; purpose: string }>(
      "SELECT token_hash, purpose FROM auth_tokens WHERE purpose = 'password_reset'",
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].token_hash).toBe(hashSecret(raw));
    expect(JSON.stringify(rows.rows)).not.toContain(raw);
  });

  it("resets the password with Argon2id, blocks the old password, and is one-time", async () => {
    const created = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const oldSession = sessionTokenFrom(created) ?? "";
    await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
    );
    const token = tokenFromMail();
    const nextPassword = "replacement-password";

    const reset = await resetPassword(
      authRequest("http://localhost:3000/api/auth/reset-password", {
        token,
        password: nextPassword,
      }),
    );
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toEqual({
      ok: true,
      message: AUTH_RESET_COMPLETE,
    });

    const stored = await getPool().query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      [email],
    );
    expect(stored.rows[0].password_hash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword(stored.rows[0].password_hash, nextPassword)).resolves.toBe(
      true,
    );
    await expect(verifyPassword(stored.rows[0].password_hash, password)).resolves.toBe(
      false,
    );

    const oldLogin = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email,
        password,
      }),
    );
    expect(oldLogin.status).toBe(401);
    await expect(oldLogin.json()).resolves.toEqual({
      error: AUTH_INVALID_CREDENTIALS,
    });

    const replay = await resetPassword(
      authRequest("http://localhost:3000/api/auth/reset-password", {
        token,
        password: "another-long-password",
      }),
    );
    expect(replay.status).toBe(400);
    await expect(replay.json()).resolves.toEqual({ error: AUTH_RESET_INVALID });

    const afterReset = await me(requestWithSession("http://localhost:3000/api/auth/me", oldSession));
    expect(afterReset.status).toBe(401);
    expect(oldSession).toBeTruthy();
  });

  it("rejects expired reset tokens", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
    );
    const token = tokenFromMail();
    await getPool().query(
      "UPDATE auth_tokens SET expires_at = now() - interval '1 minute' WHERE purpose = 'password_reset'",
    );

    const response = await resetPassword(
      authRequest("http://localhost:3000/api/auth/reset-password", {
        token,
        password: "replacement-password",
      }),
    );
    expect(response.status).toBe(400);

    const stillOld = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email,
        password,
      }),
    );
    expect(stillOld.status).toBe(200);
  });

  it("invalidates only the reset user's sessions", async () => {
    const first = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const second = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "other@example.com",
        password,
      }),
    );
    const firstToken = sessionTokenFrom(first) ?? "";
    const secondToken = sessionTokenFrom(second) ?? "";

    await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
    );
    const resetToken = tokenFromMail();
    await resetPassword(
      authRequest("http://localhost:3000/api/auth/reset-password", {
        token: resetToken,
        password: "replacement-password",
      }),
    );

    expect(
      (await me(requestWithSession("http://localhost:3000/api/auth/me", firstToken))).status,
    ).toBe(401);
    expect(
      (await me(requestWithSession("http://localhost:3000/api/auth/me", secondToken))).status,
    ).toBe(200);
    await expect(
      getCurrentUser(requestWithSession("http://localhost:3000/api/auth/me", secondToken)),
    ).resolves.toMatchObject({ email: "other@example.com" });
  });

  it("resends verification with a generic public response", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const existing = await resendVerification(
      authRequest("http://localhost:3000/api/auth/resend-verification", { email }),
    );
    const missing = await resendVerification(
      authRequest("http://localhost:3000/api/auth/resend-verification", {
        email: "missing@example.com",
      }),
    );

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    expect((await existing.json()).message).toBe(AUTH_VERIFY_SENT);
    expect((await missing.json()).message).toBe(AUTH_VERIFY_SENT);
  });

  it("does not log the raw reset token", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method as keyof Console).mockImplementation(() => {}),
    );

    try {
      await register(
        authRequest("http://localhost:3000/api/auth/register", {
          email,
          password,
        }),
      );
      await forgotPassword(
        authRequest("http://localhost:3000/api/auth/forgot-password", { email }),
      );
      const raw = tokenFromMail();
      const serialized = spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => JSON.stringify(args))
        .join("\n");
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(password);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
