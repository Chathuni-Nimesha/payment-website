import { createHash } from "node:crypto";
import { readDatabaseUrl } from "@/lib/db/client";
import { clientIp } from "./client-ip";
import {
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

export type RateLimitScope = "create-intent" | "webhook-unsigned";

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

function identityHash(value: string) {
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
    `payments:create-intent:ip-email:${clientIp(request)}:${identityHash(normalizedEmail)}`,
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
