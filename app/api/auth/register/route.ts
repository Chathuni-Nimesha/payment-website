import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { jsonWithoutSession, jsonWithSession } from "@/lib/auth/http";
import {
  AUTH_DUPLICATE_EMAIL,
  AUTH_INVALID_INPUT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAVAILABLE,
} from "@/lib/auth/messages";
import { logger } from "@/lib/logging/logger";
import { createUserWithSession } from "@/lib/auth/store";
import { validateAuthCredentials } from "@/lib/auth/validation";
import { readDatabaseUrl } from "@/lib/db/client";
import { limitAuthRegisterByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const ipLimit = await limitAuthRegisterByIp(request);
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
  const parsed = validateAuthCredentials({
    email: payload.email,
    password: payload.password,
  });

  if (!parsed.ok) {
    return jsonWithoutSession(
      { error: AUTH_INVALID_INPUT, fieldErrors: parsed.fieldErrors },
      400,
    );
  }

  if (!readDatabaseUrl()) {
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }

  try {
    const result = await createUserWithSession({
      email: parsed.email,
      password: parsed.password,
    });

    if (!result.ok) {
      return jsonWithoutSession({ error: AUTH_DUPLICATE_EMAIL }, 409);
    }

    return jsonWithSession({ user: result.user }, result.token, 201);
  } catch {
    logger.error("auth.register_unavailable");
    return jsonWithoutSession({ error: AUTH_UNAVAILABLE }, 503);
  }
}
