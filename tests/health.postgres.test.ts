import { afterAll, beforeAll, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import {
  describeWithDatabase,
  migrateTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";

describeWithDatabase("GET /api/health PostgreSQL", () => {
  const url = useTestDatabase();

  beforeAll(() => {
    migrateTestDatabase(url);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("returns 200 after a lightweight connectivity check", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(JSON.stringify(body)).not.toMatch(/postgres|DATABASE_URL|password/i);
  });
});
