import "server-only";

import { getPool, readDatabaseUrl } from "@/lib/db/client";
import type { RateLimitResult, RateLimiter } from "./types";

function windowStart(now: Date, windowMs: number) {
  const ms = now.getTime();
  return new Date(Math.floor(ms / windowMs) * windowMs);
}

export const postgresRateLimiter: RateLimiter = {
  async consume(key, limit, windowMs) {
    if (!readDatabaseUrl()) {
      throw new Error("DATABASE_URL is not configured.");
    }

    const pool = getPool();
    const start = windowStart(new Date(), windowMs);
    const result = await pool.query<{ count: number }>(
      `
        INSERT INTO rate_limit_windows (key, window_start, count)
        VALUES ($1, $2, 1)
        ON CONFLICT (key, window_start)
        DO UPDATE SET count = rate_limit_windows.count + 1
        RETURNING count
      `,
      [key, start],
    );

    const count = result.rows[0]?.count ?? 1;
    const remaining = Math.max(0, limit - count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((start.getTime() + windowMs - Date.now()) / 1000),
    );

    await pool.query(
      "DELETE FROM rate_limit_windows WHERE window_start < now() - interval '2 hours'",
    );

    return {
      allowed: count <= limit,
      remaining,
      retryAfterSeconds,
    };
  },
};

/** Default backend. Replace this export to switch to Redis/Upstash. */
export async function consumeOrThrow(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return postgresRateLimiter.consume(key, limit, windowMs);
}
