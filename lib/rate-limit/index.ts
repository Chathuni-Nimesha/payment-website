import { createHash } from "node:crypto";
import { AUTH_UNAVAILABLE } from "@/lib/auth/messages";
import { readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { clientIp } from "./client-ip";
import {
  AUTH_FORGOT_PASSWORD_IDENTITY_LIMIT,
  AUTH_FORGOT_PASSWORD_IP_LIMIT,
  AUTH_LOGIN_IDENTITY_LIMIT,
  AUTH_LOGIN_IP_LIMIT,
  AUTH_REGISTER_IP_LIMIT,
  AUTH_RESEND_VERIFICATION_IDENTITY_LIMIT,
  AUTH_RESEND_VERIFICATION_IP_LIMIT,
  AUTH_RESET_PASSWORD_IP_LIMIT,
  AUTH_VERIFY_EMAIL_IP_LIMIT,
  CREATE_INTENT_IDENTITY_LIMIT,
  CREATE_INTENT_LIMIT,
  RATE_LIMITED_MESSAGE,
  WEBHOOK_UNSIGNED_LIMIT,
} from "./config";
import { consumeOrThrow } from "./postgres";
import type { RateLimitResult } from "./types";

export { clientIp } from "./client-ip";
export { RATE_LIMITED_MESSAGE } from "./config";
export type { RateLimitResult, RateLimiter } from "./types";

export type RateLimitScope = "create-intent" | "webhook-unsigned" | "auth";

export function rateLimitedResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: RATE_LIMITED_MESSAGE },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}

export function hashRateLimitIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function limiterUnavailableBehavior(scope: RateLimitScope) {
  if (scope === "webhook-unsigned") {
    return "allow" as const;
  }

  return readDatabaseUrl() ? ("deny" as const) : ("allow" as const);
}

async function consume(
  key: string,
  limit: number,
  windowMs: number,
  scope: RateLimitScope,
): Promise<RateLimitResult & { failedOpen?: boolean; failedClosed?: boolean }> {
  try {
    return await consumeOrThrow(key, limit, windowMs);
  } catch {
    if (limiterUnavailableBehavior(scope) === "allow") {
      return {
        allowed: true,
        remaining: limit,
        retryAfterSeconds: 0,
        failedOpen: true,
      };
    }

    logger.error("rate_limit.backend_failed", { scope });

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      failedClosed: true,
    };
  }
}

function deniedCreateIntent(result: RateLimitResult & { failedClosed?: boolean }) {
  if (result.failedClosed) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "The checkout could not be prepared. Please try again." },
        { status: 503 },
      ),
    };
  }

  return {
    ok: false as const,
    response: rateLimitedResponse(result.retryAfterSeconds),
  };
}

function deniedAuth(result: RateLimitResult & { failedClosed?: boolean }) {
  if (result.failedClosed) {
    return {
      ok: false as const,
      response: Response.json(
        { error: AUTH_UNAVAILABLE },
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }

  return {
    ok: false as const,
    response: rateLimitedResponse(result.retryAfterSeconds),
  };
}

export async function limitCreateIntentByIp(request: Request) {
  const result = await consume(
    `payments:create-intent:ip:${clientIp(request)}`,
    CREATE_INTENT_LIMIT.max,
    CREATE_INTENT_LIMIT.windowMs,
    "create-intent",
  );

  if (!result.allowed) {
    return deniedCreateIntent(result);
  }

  return { ok: true as const };
}

export async function limitCreateIntentByIdentity(
  request: Request,
  email?: string,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: true as const };
  }

  const result = await consume(
    `payments:create-intent:ip-email:${clientIp(request)}:${hashRateLimitIdentity(normalizedEmail)}`,
    CREATE_INTENT_IDENTITY_LIMIT.max,
    CREATE_INTENT_IDENTITY_LIMIT.windowMs,
    "create-intent",
  );

  if (!result.allowed) {
    return deniedCreateIntent(result);
  }

  return { ok: true as const };
}

export async function limitUnsignedWebhook(request: Request) {
  const ip = clientIp(request);
  const result = await consume(
    `payments:webhook-unsigned:ip:${ip}`,
    WEBHOOK_UNSIGNED_LIMIT.max,
    WEBHOOK_UNSIGNED_LIMIT.windowMs,
    "webhook-unsigned",
  );

  if (!result.allowed) {
    return {
      ok: false as const,
      response: rateLimitedResponse(result.retryAfterSeconds),
    };
  }

  return { ok: true as const };
}

export async function limitAuthLoginByIp(request: Request) {
  const result = await consume(
    `auth:login:ip:${clientIp(request)}`,
    AUTH_LOGIN_IP_LIMIT.max,
    AUTH_LOGIN_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthLoginByIdentity(
  request: Request,
  email?: string,
) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: true as const };
  }

  const result = await consume(
    `auth:login:ip-email:${clientIp(request)}:${hashRateLimitIdentity(normalizedEmail)}`,
    AUTH_LOGIN_IDENTITY_LIMIT.max,
    AUTH_LOGIN_IDENTITY_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthRegisterByIp(request: Request) {
  const result = await consume(
    `auth:register:ip:${clientIp(request)}`,
    AUTH_REGISTER_IP_LIMIT.max,
    AUTH_REGISTER_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

async function limitAuthIdentity(
  request: Request,
  email: string | undefined,
  bucket: string,
  limit: { max: number; windowMs: number },
) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: true as const };
  }

  const result = await consume(
    `auth:${bucket}:ip-email:${clientIp(request)}:${hashRateLimitIdentity(normalizedEmail)}`,
    limit.max,
    limit.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthForgotPasswordByIp(request: Request) {
  const result = await consume(
    `auth:forgot-password:ip:${clientIp(request)}`,
    AUTH_FORGOT_PASSWORD_IP_LIMIT.max,
    AUTH_FORGOT_PASSWORD_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthForgotPasswordByIdentity(
  request: Request,
  email?: string,
) {
  return limitAuthIdentity(
    request,
    email,
    "forgot-password",
    AUTH_FORGOT_PASSWORD_IDENTITY_LIMIT,
  );
}

export async function limitAuthResetPasswordByIp(request: Request) {
  const result = await consume(
    `auth:reset-password:ip:${clientIp(request)}`,
    AUTH_RESET_PASSWORD_IP_LIMIT.max,
    AUTH_RESET_PASSWORD_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthVerifyEmailByIp(request: Request) {
  const result = await consume(
    `auth:verify-email:ip:${clientIp(request)}`,
    AUTH_VERIFY_EMAIL_IP_LIMIT.max,
    AUTH_VERIFY_EMAIL_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthResendVerificationByIp(request: Request) {
  const result = await consume(
    `auth:resend-verification:ip:${clientIp(request)}`,
    AUTH_RESEND_VERIFICATION_IP_LIMIT.max,
    AUTH_RESEND_VERIFICATION_IP_LIMIT.windowMs,
    "auth",
  );

  if (!result.allowed) {
    return deniedAuth(result);
  }

  return { ok: true as const };
}

export async function limitAuthResendVerificationByIdentity(
  request: Request,
  email?: string,
) {
  return limitAuthIdentity(
    request,
    email,
    "resend-verification",
    AUTH_RESEND_VERIFICATION_IDENTITY_LIMIT,
  );
}
