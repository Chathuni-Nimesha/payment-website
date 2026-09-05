export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Swap `postgresRateLimiter` for Redis/Upstash by implementing this contract. */
export type RateLimiter = {
  consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult>;
};
