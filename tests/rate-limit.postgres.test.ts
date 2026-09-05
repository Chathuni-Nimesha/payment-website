import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { postgresRateLimiter } from "@/lib/rate-limit/postgres";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";

describeWithDatabase("PostgreSQL rate limiter", () => {
  const url = useTestDatabase();

  beforeAll(() => {
    migrateTestDatabase(url);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("allows hits within the window and then rejects", async () => {
    const first = await postgresRateLimiter.consume("test:ip:a", 2, 60_000);
    const second = await postgresRateLimiter.consume("test:ip:a", 2, 60_000);
    const third = await postgresRateLimiter.consume("test:ip:a", 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("tracks independent keys separately", async () => {
    await postgresRateLimiter.consume("test:ip:a", 1, 60_000);
    const other = await postgresRateLimiter.consume("test:ip:b", 1, 60_000);

    expect(other.allowed).toBe(true);
  });
});
