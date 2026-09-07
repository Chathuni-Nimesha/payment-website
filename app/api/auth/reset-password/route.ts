import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { jsonWithoutSession } from "@/lib/auth/http";
import {
  AUTH_INVALID_INPUT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_RESET_COMPLETE,
  AUTH_RESET_INVALID,
  AUTH_UNAVAILABLE,
} from "@/lib/auth/messages";
import { resetPasswordWithToken } from "@/lib/auth/store";
import { validatePassword } from "@/lib/auth/validation";
import { readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { limitAuthResetPasswordByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthResetPasswordByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithoutSession({ error: AUTH_RESET_INVALID }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonWithoutSession({ error: AUTH_RESET_INVALID }, 400);
  }

  const payload = body as Record<string, unknown>;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!token) {
    return jsonWithoutSession({ error: AUTH_RESET_INVALID }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return jsonWithoutSession(
      { error: AUTH_INVALID_INPUT, fieldErrors: { password: passwordError } },
      400,
    );
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = await resetPasswordWithToken({ token, password });
    if (!result.ok) {
      return jsonWithoutSession({ error: AUTH_RESET_INVALID }, 400);
    }

    return jsonWithoutSession({ ok: true, message: AUTH_RESET_COMPLETE }, 200, true);
  } catch {
    logger.error("auth.reset_password_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
