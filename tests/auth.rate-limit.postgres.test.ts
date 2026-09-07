import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { RATE_LIMITED_MESSAGE } from "@/lib/rate-limit/config";
import { postgresRateLimiter } from "@/lib/rate-limit/postgres";
import { hashRateLimitIdentity } from "@/lib/rate-limit";
import { getPool } from "@/lib/db/client";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";
import { jsonRequest } from "./helpers";

function authRequest(
  url: string,
  body: unknown,
  headers?: HeadersInit,
) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    "x-forwarded-for": "198.51.100.20",
    ...headers,
  });
}

describeWithDatabase("authentication rate limits with PostgreSQL", () => {
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

  it("stores a hashed login identity and never the raw email", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "owner@example.com",
        password: "longenough1",
      }),
    );

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "Owner@Example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(200);

    const keys = await getPool().query<{ key: string }>(
      "SELECT key FROM rate_limit_windows",
    );
    const digest = hashRateLimitIdentity("owner@example.com");

    expect(keys.rows.some((row) => row.key.includes(digest))).toBe(true);
    expect(keys.rows.every((row) => !row.key.includes("owner@example.com"))).toBe(
      true,
    );
    expect(keys.rows.every((row) => !row.key.includes("longenough1"))).toBe(true);
  });

  it("returns 429 after the login IP window is exhausted", async () => {
    for (let i = 0; i < 10; i += 1) {
      const result = await postgresRateLimiter.consume(
        "auth:login:ip:198.51.100.20",
        10,
        60_000,
      );
      expect(result.allowed).toBe(true);
    }

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "owner@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: RATE_LIMITED_MESSAGE,
    });
  });

  it("returns 429 after the register IP window is exhausted", async () => {
    for (let i = 0; i < 5; i += 1) {
      const result = await postgresRateLimiter.consume(
        "auth:register:ip:198.51.100.20",
        5,
        60_000,
      );
      expect(result.allowed).toBe(true);
    }

    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "new@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: RATE_LIMITED_MESSAGE,
    });
  });
});
