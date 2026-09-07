import { beforeEach, describe, expect, it, vi } from "vitest";

const readDatabaseUrl = vi.fn();
const query = vi.fn();

vi.mock("@/lib/db/client", () => ({
  readDatabaseUrl: () => readDatabaseUrl(),
  getPool: () => ({ query: (...args: unknown[]) => query(...args) }),
}));

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    readDatabaseUrl.mockReset();
    query.mockReset();
  });

  it("returns 200 when PostgreSQL answers SELECT 1", async () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(query).toHaveBeenCalledWith("SELECT 1");
    expect(JSON.stringify(body)).not.toMatch(/postgres|DATABASE_URL|stack/i);
  });

  it("returns a safe 503 when DATABASE_URL is missing", async () => {
    readDatabaseUrl.mockReturnValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
    expect(query).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|postgres|ECONNREFUSED/i);
  });

  it("returns a safe 503 when the database query fails", async () => {
    readDatabaseUrl.mockReturnValue("postgres://localhost/northline");
    query.mockRejectedValue(
      new Error("ECONNREFUSED postgres://user:secret@localhost:5432/northline"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });
});
