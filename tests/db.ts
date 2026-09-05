import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe } from "vitest";
import { closePool, getPool } from "@/lib/db/client";

export function testDatabaseUrl() {
  return process.env.TEST_DATABASE_URL?.trim() || "";
}

export const describeWithDatabase = testDatabaseUrl()
  ? describe
  : describe.skip;

export function useTestDatabase() {
  const url = testDatabaseUrl();
  if (url) {
    process.env.DATABASE_URL = url;
  }
  return url;
}

export function migrateTestDatabase(url: string) {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: url,
    },
    stdio: "pipe",
  });
}

export async function resetTestDatabase() {
  const pool = getPool();
  await pool.query(
    "TRUNCATE stripe_events, transactions, rate_limit_windows",
  );
}

export async function teardownTestDatabase() {
  await closePool();
}
