import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { AUTH_INVALID_CREDENTIALS, AUTH_UNAVAILABLE } from "@/lib/auth/messages";
import { RATE_LIMITED_MESSAGE } from "@/lib/rate-limit/config";
import { jsonRequest } from "./helpers";

const limitAuthLoginByIp = vi.fn();
const limitAuthLoginByIdentity = vi.fn();
const limitAuthRegisterByIp = vi.fn();
const authenticateUser = vi.fn();
const createUserWithSession = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  limitAuthLoginByIp: (...args: unknown[]) => limitAuthLoginByIp(...args),
  limitAuthLoginByIdentity: (...args: unknown[]) =>
    limitAuthLoginByIdentity(...args),
  limitAuthRegisterByIp: (...args: unknown[]) => limitAuthRegisterByIp(...args),
}));

vi.mock("@/lib/auth/store", () => ({
  authenticateUser: (...args: unknown[]) => authenticateUser(...args),
  createUserWithSession: (...args: unknown[]) => createUserWithSession(...args),
}));

vi.mock("@/lib/db/client", () => ({
  readDatabaseUrl: () => "postgres://localhost/northline",
}));

function authRequest(
  url: string,
  body: unknown,
  headers?: HeadersInit,
) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    "x-forwarded-for": "203.0.113.10",
    ...headers,
  });
}

describe("auth login rate limit responses", () => {
  beforeEach(() => {
    limitAuthLoginByIp.mockReset();
    limitAuthLoginByIdentity.mockReset();
    authenticateUser.mockReset();
    limitAuthLoginByIp.mockResolvedValue({ ok: true });
    limitAuthLoginByIdentity.mockResolvedValue({ ok: true });
    authenticateUser.mockResolvedValue({
      ok: true,
      user: {
        id: "usr_aaaaaaaaaaaaaaaaaaaaaaaa",
        email: "owner@example.com",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
      token: "session-token",
    });
  });

  it("allows login within the limit", async () => {
    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "owner@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(200);
    expect(authenticateUser).toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the login IP limit is exceeded", async () => {
    limitAuthLoginByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: {
          "Retry-After": "41",
          "Content-Type": "application/json",
        },
      }),
    });

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "owner@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("41");
    await expect(response.json()).resolves.toEqual({
      error: RATE_LIMITED_MESSAGE,
    });
    expect(limitAuthLoginByIdentity).not.toHaveBeenCalled();
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it("does not reveal whether an account exists after a 429", async () => {
    limitAuthLoginByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "missing@example.com",
        password: "longenough1",
      }),
    );

    const body = await response.json();
    expect(body.error).toBe(RATE_LIMITED_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/exist|unknown user|password_hash/i);
  });

  it("returns a generic 503 when the limiter fails closed", async () => {
    limitAuthLoginByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: AUTH_UNAVAILABLE }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "owner@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe(AUTH_UNAVAILABLE);
    expect(JSON.stringify(body)).not.toContain("connection refused");
  });

  it("never logs the password", async () => {
    const spies = ["log", "info", "warn", "error", "debug"].map((method) =>
      vi.spyOn(console, method as keyof Console).mockImplementation(() => {}),
    );

    try {
      await login(
        authRequest("http://localhost:3000/api/auth/login", {
          email: "owner@example.com",
          password: "super-secret-password",
        }),
      );

      for (const spy of spies) {
        for (const args of spy.mock.calls) {
          expect(JSON.stringify(args)).not.toContain("super-secret-password");
        }
      }
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it("keeps the generic login error and does not return the password", async () => {
    authenticateUser.mockResolvedValue({ ok: false });

    const response = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "owner@example.com",
        password: "wrong-password-value",
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe(AUTH_INVALID_CREDENTIALS);
    expect(JSON.stringify(body)).not.toContain("wrong-password-value");
  });
});

describe("auth register rate limit responses", () => {
  beforeEach(() => {
    limitAuthRegisterByIp.mockReset();
    createUserWithSession.mockReset();
    limitAuthRegisterByIp.mockResolvedValue({ ok: true });
    createUserWithSession.mockResolvedValue({
      ok: true,
      user: {
        id: "usr_bbbbbbbbbbbbbbbbbbbbbbbb",
        email: "new@example.com",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
      token: "session-token",
    });
  });

  it("allows registration within the limit", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "new@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(201);
    expect(createUserWithSession).toHaveBeenCalled();
  });

  it("returns 429 when the register IP limit is exceeded", async () => {
    limitAuthRegisterByIp.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: RATE_LIMITED_MESSAGE }), {
        status: 429,
        headers: {
          "Retry-After": "18",
          "Content-Type": "application/json",
        },
      }),
    });

    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "new@example.com",
        password: "longenough1",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("18");
    await expect(response.json()).resolves.toEqual({
      error: RATE_LIMITED_MESSAGE,
    });
    expect(createUserWithSession).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
