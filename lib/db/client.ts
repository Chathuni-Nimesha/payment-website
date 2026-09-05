import "server-only";

import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  northlinePgPool?: Pool;
};

export function readDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function getPool() {
  const connectionString = readDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalForPg.northlinePgPool) {
    globalForPg.northlinePgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalForPg.northlinePgPool;
}

export async function closePool() {
  const pool = globalForPg.northlinePgPool;
  if (!pool) {
    return;
  }

  globalForPg.northlinePgPool = undefined;
  await pool.end();
}
