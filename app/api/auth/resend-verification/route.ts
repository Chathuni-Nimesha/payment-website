import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { withDevPreview } from "@/lib/auth/dev-preview";
import { jsonWithoutSession } from "@/lib/auth/http";
import {
  AUTH_ALREADY_VERIFIED,
  AUTH_INVALID_INPUT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAVAILABLE,
  AUTH_VERIFY_SENT,
} from "@/lib/auth/messages";
import { getCurrentUser } from "@/lib/auth/session";
import { resendEmailVerification } from "@/lib/auth/store";
import { normalizeEmail, validateAuthEmail } from "@/lib/auth/validation";
import { readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import {
  limitAuthResendVerificationByIdentity,
  limitAuthResendVerificationByIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthResendVerificationByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

  const currentUser = await getCurrentUser(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";

  if (!currentUser) {
    const identityLimit = await limitAuthResendVerificationByIdentity(
      request,
      email,
    );
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
  } else {
    const identityLimit = await limitAuthResendVerificationByIdentity(
      request,
      currentUser.email,
    );
    if (!identityLimit.ok) {
      return identityLimit.response;
    }
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = currentUser
      ? await resendEmailVerification({ userId: currentUser.id })
      : await resendEmailVerification({ email });

    if (currentUser && result.status === "already_verified") {
      return jsonWithoutSession({ ok: true, message: AUTH_ALREADY_VERIFIED });
    }

    return jsonWithoutSession(
      withDevPreview(
        { ok: true, message: AUTH_VERIFY_SENT },
        result.status === "sent" ? result.previewUrl : undefined,
      ),
    );
  } catch {
    logger.error("auth.resend_verification_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
