import "server-only";

import { Pool, type PoolConfig } from "pg";

const globalForPg = globalThis as typeof globalThis & {
  northlinePgPool?: Pool;
};

export function readDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function databaseSslEnabled() {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "require";
}

export function postgresSslOption() {
  if (!databaseSslEnabled()) {
    return undefined;
  }

  return { rejectUnauthorized: true as const };
}

export function databasePoolOptions(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: postgresSslOption(),
  };
}

export function getPool() {
  const connectionString = readDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!globalForPg.northlinePgPool) {
    globalForPg.northlinePgPool = new Pool(databasePoolOptions(connectionString));
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
