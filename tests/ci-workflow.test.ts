import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("GitHub Actions CI workflow", () => {
  const yaml = readFileSync(
    path.resolve(__dirname, "../.github/workflows/ci.yml"),
    "utf8",
  );

  it("runs install, tests, lint, and build on main", () => {
    expect(yaml).toContain("push:");
    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("branches: [main]");
    expect(yaml).toContain("npm ci");
    expect(yaml).toContain("npm test");
    expect(yaml).toContain("npm run lint");
    expect(yaml).toContain("npm run build");
    expect(yaml).toContain("npm run db:migrate");
  });

  it("provides PostgreSQL for integration tests without Stripe secrets", () => {
    expect(yaml).toContain("postgres:16");
    expect(yaml).toContain("TEST_DATABASE_URL:");
    expect(yaml).toContain("DATABASE_URL:");
    expect(yaml).not.toMatch(/STRIPE_/);
    expect(yaml).not.toMatch(/sk_test_|sk_live_|whsec_/);
  });
});
