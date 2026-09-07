import { afterEach, describe, expect, it } from "vitest";
import {
  databasePoolOptions,
  databaseSslEnabled,
  postgresSslOption,
} from "@/lib/db/client";

const original = process.env.DATABASE_SSL;

afterEach(() => {
  if (original === undefined) {
    delete process.env.DATABASE_SSL;
  } else {
    process.env.DATABASE_SSL = original;
  }
});

describe("PostgreSQL SSL configuration", () => {
  it("keeps SSL off for local Docker by default", () => {
    delete process.env.DATABASE_SSL;
    expect(databaseSslEnabled()).toBe(false);
    expect(postgresSslOption()).toBeUndefined();
    expect(
      databasePoolOptions("postgres://postgres:postgres@localhost:5432/northline")
        .ssl,
    ).toBeUndefined();
  });

  it("enables certificate validation when DATABASE_SSL=true", () => {
    process.env.DATABASE_SSL = "true";
    expect(databaseSslEnabled()).toBe(true);
    expect(postgresSslOption()).toEqual({ rejectUnauthorized: true });
  });

  it("does not disable certificate validation", () => {
    process.env.DATABASE_SSL = "require";
    expect(postgresSslOption()?.rejectUnauthorized).toBe(true);
  });

  it("does not enable SSL for false, 0, or unknown values", () => {
    process.env.DATABASE_SSL = "false";
    expect(databaseSslEnabled()).toBe(false);
    expect(postgresSslOption()).toBeUndefined();

    process.env.DATABASE_SSL = "0";
    expect(databaseSslEnabled()).toBe(false);

    process.env.DATABASE_SSL = "yes";
    expect(databaseSslEnabled()).toBe(false);
    expect(postgresSslOption()).toBeUndefined();
  });

  it("never sets rejectUnauthorized to false", () => {
    for (const value of ["true", "1", "require", "false", "0", "yes", ""]) {
      process.env.DATABASE_SSL = value;
      const ssl = postgresSslOption();
      if (ssl) {
        expect(ssl.rejectUnauthorized).toBe(true);
      }
    }
  });
});
