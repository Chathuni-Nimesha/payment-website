import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { jsonWithoutSession, jsonWithSession } from "@/lib/auth/http";
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAVAILABLE,
} from "@/lib/auth/messages";
import { logger } from "@/lib/logging/logger";
import { authenticateUser } from "@/lib/auth/store";
import { normalizeEmail } from "@/lib/auth/validation";
import { readDatabaseUrl } from "@/lib/db/client";
import {
  limitAuthLoginByIdentity,
  limitAuthLoginByIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthLoginByIp(request);
  if (!ipLimit.ok) {
    return ipLimit.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithoutSession({ error: AUTH_INVALID_CREDENTIALS }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonWithoutSession({ error: AUTH_INVALID_CREDENTIALS }, 400);
  }

  const payload = body as Record<string, unknown>;
  const email =
    typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  const identityLimit = await limitAuthLoginByIdentity(request, email);
  if (!identityLimit.ok) {
    return identityLimit.response;
  }

  if (!email || !password) {
    return jsonWithoutSession({ error: AUTH_INVALID_CREDENTIALS }, 400);
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = await authenticateUser({ email, password });
    if (!result.ok) {
      return jsonWithoutSession({ error: AUTH_INVALID_CREDENTIALS }, 401);
    }

    return jsonWithSession({ user: result.user }, result.token);
  } catch {
    logger.error("auth.login_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
