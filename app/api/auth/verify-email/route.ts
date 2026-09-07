import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { jsonWithoutSession } from "@/lib/auth/http";
import {
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAVAILABLE,
  AUTH_VERIFY_CONFIRMED,
  AUTH_VERIFY_INVALID,
} from "@/lib/auth/messages";
import { verifyEmailWithToken } from "@/lib/auth/store";
import { readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { limitAuthVerifyEmailByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthVerifyEmailByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithoutSession({ error: AUTH_VERIFY_INVALID }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonWithoutSession({ error: AUTH_VERIFY_INVALID }, 400);
  }

  const payload = body as Record<string, unknown>;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";

  if (!token) {
    return jsonWithoutSession({ error: AUTH_VERIFY_INVALID }, 400);
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = await verifyEmailWithToken(token);
    if (!result.ok) {
      return jsonWithoutSession({ error: AUTH_VERIFY_INVALID }, 400);
    }

    return jsonWithoutSession({ ok: true, message: AUTH_VERIFY_CONFIRMED });
  } catch {
    logger.error("auth.verify_email_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
