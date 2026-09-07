import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { withDevPreview } from "@/lib/auth/dev-preview";
import { jsonWithoutSession } from "@/lib/auth/http";
import {
  AUTH_INVALID_INPUT,
  AUTH_RECOVERY_SENT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAVAILABLE,
} from "@/lib/auth/messages";
import { requestPasswordReset } from "@/lib/auth/store";
import { normalizeEmail, validateAuthEmail } from "@/lib/auth/validation";
import { readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import {
  limitAuthForgotPasswordByIdentity,
  limitAuthForgotPasswordByIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthForgotPasswordByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithoutSession({ error: AUTH_INVALID_INPUT }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonWithoutSession({ error: AUTH_INVALID_INPUT }, 400);
  }

  const payload = body as Record<string, unknown>;
  const email =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";

  const identityLimit = await limitAuthForgotPasswordByIdentity(request, email);
  if (!identityLimit.ok) {
    return identityLimit.response;
  }

  const emailError = validateAuthEmail(email);
  if (emailError) {
    return jsonWithoutSession(
      { error: AUTH_INVALID_INPUT, fieldErrors: { email: emailError } },
      400,
    );
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = await requestPasswordReset(email);
    return jsonWithoutSession(
      withDevPreview(
        { ok: true, message: AUTH_RECOVERY_SENT },
        result.sent ? result.previewUrl : undefined,
      ),
    );
  } catch {
    logger.error("auth.forgot_password_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
