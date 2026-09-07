import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resendVerification } from "@/app/api/auth/resend-verification/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import {
  AUTH_RECOVERY_SENT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_RESET_INVALID,
  AUTH_VERIFY_INVALID,
} from "@/lib/auth/messages";
import { RATE_LIMITED_MESSAGE } from "@/lib/rate-limit/config";
import { jsonRequest } from "./helpers";

const limitAuthForgotPasswordByIp = vi.fn();
const limitAuthForgotPasswordByIdentity = vi.fn();
const limitAuthResetPasswordByIp = vi.fn();
const limitAuthVerifyEmailByIp = vi.fn();
const limitAuthResendVerificationByIp = vi.fn();
const limitAuthResendVerificationByIdentity = vi.fn();
const requestPasswordReset = vi.fn();
const resetPasswordWithToken = vi.fn();
const verifyEmailWithToken = vi.fn();
const resendEmailVerification = vi.fn();
const getCurrentUser = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  limitAuthForgotPasswordByIp: (...args: unknown[]) =>
    limitAuthForgotPasswordByIp(...args),
  limitAuthForgotPasswordByIdentity: (...args: unknown[]) =>
    limitAuthForgotPasswordByIdentity(...args),
  limitAuthResetPasswordByIp: (...args: unknown[]) =>
    limitAuthResetPasswordByIp(...args),
  limitAuthVerifyEmailByIp: (...args: unknown[]) =>
    limitAuthVerifyEmailByIp(...args),
  limitAuthResendVerificationByIp: (...args: unknown[]) =>
    limitAuthResendVerificationByIp(...args),
  limitAuthResendVerificationByIdentity: (...args: unknown[]) =>
    limitAuthResendVerificationByIdentity(...args),
}));

vi.mock("@/lib/auth/store", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  resetPasswordWithToken: (...args: unknown[]) => resetPasswordWithToken(...args),
  verifyEmailWithToken: (...args: unknown[]) => verifyEmailWithToken(...args),
  resendEmailVerification: (...args: unknown[]) =>
    resendEmailVerification(...args),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

vi.mock("@/lib/db/client", () => ({
  readDatabaseUrl: () => "postgres://localhost/northline",
}));

function authRequest(url: string, body: unknown, headers?: HeadersInit) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    "x-forwarded-for": "203.0.113.10",
    ...headers,
  });
}

describe("auth recovery route guards", () => {
  beforeEach(() => {
    limitAuthForgotPasswordByIp.mockResolvedValue({ ok: true });
    limitAuthForgotPasswordByIdentity.mockResolvedValue({ ok: true });
    limitAuthResetPasswordByIp.mockResolvedValue({ ok: true });
    limitAuthVerifyEmailByIp.mockResolvedValue({ ok: true });
    limitAuthResendVerificationByIp.mockResolvedValue({ ok: true });
    limitAuthResendVerificationByIdentity.mockResolvedValue({ ok: true });
    requestPasswordReset.mockResolvedValue({ sent: false });
    resetPasswordWithToken.mockResolvedValue({ ok: true, userId: "usr_a" });
    verifyEmailWithToken.mockResolvedValue({ ok: true });
    resendEmailVerification.mockResolvedValue({ status: "unknown" });
    getCurrentUser.mockResolvedValue(null);
  });

  it("rejects forgot-password, reset, verify, and resend without CSRF", async () => {
    const body = { email: "client@example.com", token: "abc", password: "longenough1" };
    const forgot = await forgotPassword(
      jsonRequest("http://localhost:3000/api/auth/forgot-password", body),
    );
    const reset = await resetPassword(
      jsonRequest("http://localhost:3000/api/auth/reset-password", body),
    );
    const verify = await verifyEmail(
      jsonRequest("http://localhost:3000/api/auth/verify-email", body),
    );
    const resend = await resendVerification(
      jsonRequest("http://localhost:3000/api/auth/resend-verification", body),
    );

    expect(forgot.status).toBe(403);
    expect(reset.status).toBe(403);
    expect(verify.status).toBe(403);
    expect(resend.status).toBe(403);
    await expect(forgot.json()).resolves.toEqual({ error: AUTH_REQUEST_UNVERIFIED });
  });

  it("returns 429 with Retry-After for forgot-password", async () => {
    limitAuthForgotPasswordByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: {
          "Retry-After": "33",
          "Content-Type": "application/json",
        },
      }),
    });

    const response = await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", {
        email: "client@example.com",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("33");
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns the same generic forgot-password message for missing accounts", async () => {
    requestPasswordReset.mockResolvedValue({ sent: false });
    const response = await forgotPassword(
      authRequest("http://localhost:3000/api/auth/forgot-password", {
        email: "missing@example.com",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.message).toBe(AUTH_RECOVERY_SENT);
    expect(JSON.stringify(body)).not.toMatch(/exist|unknown user/i);
  });

  it("rejects an invalid reset token with a generic error", async () => {
    resetPasswordWithToken.mockResolvedValue({ ok: false });
    const response = await resetPassword(
      authRequest("http://localhost:3000/api/auth/reset-password", {
        token: "used-or-expired",
        password: "brand-new-password",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(AUTH_RESET_INVALID);
    expect(JSON.stringify(body)).not.toContain("brand-new-password");
    expect(JSON.stringify(body)).not.toContain("used-or-expired");
  });

  it("does not trust a client-provided verified flag", async () => {
    verifyEmailWithToken.mockResolvedValue({ ok: false });
    const response = await verifyEmail(
      authRequest("http://localhost:3000/api/auth/verify-email", {
        token: "not-valid",
        verified: true,
        emailVerified: true,
      }),
    );

    expect(response.status).toBe(400);
    expect(verifyEmailWithToken).toHaveBeenCalledWith("not-valid");
    await expect(response.json()).resolves.toEqual({ error: AUTH_VERIFY_INVALID });
  });

  it("returns 429 for verification resend", async () => {
    limitAuthResendVerificationByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: {
          "Retry-After": "12",
          "Content-Type": "application/json",
        },
      }),
    });

    const response = await resendVerification(
      authRequest("http://localhost:3000/api/auth/resend-verification", {
        email: "client@example.com",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(resendEmailVerification).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
