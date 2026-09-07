import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import {
  AUTH_DUPLICATE_EMAIL,
  AUTH_INVALID_CREDENTIALS,
  AUTH_UNAUTHENTICATED,
} from "@/lib/auth/messages";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie";
import { createSession, deleteSession } from "@/lib/auth/store";
import { getCurrentUser } from "@/lib/auth/session";
import { getPool } from "@/lib/db/client";
import {
  describeWithDatabase,
  migrateTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
  useTestDatabase,
} from "./db";
import { jsonRequest } from "./helpers";

const password = "correct-horse";
const email = "client@example.com";

function authRequest(url: string, body: unknown, headers?: HeadersInit) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    ...headers,
  });
}

function cookieHeader(response: Response) {
  return response.headers.get("Set-Cookie") ?? "";
}

function sessionTokenFrom(response: Response) {
  const header = cookieHeader(response);
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function requestWithSession(url: string, token: string, method = "GET") {
  return new Request(url, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : "{}",
  });
}

describeWithDatabase("authentication with PostgreSQL", () => {
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

  it("registers a user, hashes the password, and creates a session", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "  Client@Example.com ",
        password,
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe(email);
    expect(body.user.emailVerified).toBe(false);
    expect(body.user.id).toMatch(/^usr_[a-f0-9]{24}$/);
    expect(body.user.password_hash).toBeUndefined();
    expect(body.password).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(password);

    const cookie = cookieHeader(response);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain(password);

    const stored = await getPool().query<{
      email: string;
      password_hash: string;
      email_verified_at: Date | null;
    }>("SELECT email, password_hash, email_verified_at FROM users");
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].email).toBe(email);
    expect(stored.rows[0].email_verified_at).toBeNull();
    expect(stored.rows[0].password_hash).not.toBe(password);
    expect(stored.rows[0].password_hash.startsWith("$argon2id$")).toBe(true);

    const sessions = await getPool().query("SELECT token_hash FROM sessions");
    expect(sessions.rows).toHaveLength(1);
    expect(sessions.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sessions.rows[0].token_hash).not.toBe(sessionTokenFrom(response));
  });

  it("rejects a duplicate email", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "CLIENT@example.com",
        password: "another-long",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: AUTH_DUPLICATE_EMAIL,
    });
  });

  it("logs in with the correct password and rejects the wrong password", async () => {
    await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );

    const success = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "CLIENT@example.com",
        password,
      }),
    );
    expect(success.status).toBe(200);
    const successBody = await success.json();
    expect(successBody.user.email).toBe(email);
    expect(successBody.user.password_hash).toBeUndefined();
    expect(sessionTokenFrom(success)).toBeTruthy();

    const failure = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email,
        password: "wrong-password",
      }),
    );
    expect(failure.status).toBe(401);
    await expect(failure.json()).resolves.toEqual({
      error: AUTH_INVALID_CREDENTIALS,
    });
  });

  it("returns the current user from a valid session and 401 without one", async () => {
    const created = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const token = sessionTokenFrom(created);
    expect(token).toBeTruthy();

    const authenticated = await me(
      requestWithSession("http://localhost:3000/api/auth/me", token ?? ""),
    );
    expect(authenticated.status).toBe(200);
    const body = await authenticated.json();
    expect(body.user.email).toBe(email);
    expect(body.user.password_hash).toBeUndefined();

    const unauthenticated = await me(
      new Request("http://localhost:3000/api/auth/me"),
    );
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      error: AUTH_UNAUTHENTICATED,
    });
  });

  it("logs out by revoking the session and clearing the cookie", async () => {
    const created = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const token = sessionTokenFrom(created) ?? "";

    const response = await logout(
      requestWithSession("http://localhost:3000/api/auth/logout", token, "POST"),
    );
    expect(response.status).toBe(200);
    expect(cookieHeader(response)).toContain("Max-Age=0");

    const remaining = await getPool().query("SELECT count(*)::int AS count FROM sessions");
    expect(remaining.rows[0].count).toBe(0);

    const after = await me(
      requestWithSession("http://localhost:3000/api/auth/me", token),
    );
    expect(after.status).toBe(401);
  });

  it("treats expired and invalid sessions as unauthenticated", async () => {
    const created = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const token = sessionTokenFrom(created) ?? "";
    const user = await getCurrentUser(
      requestWithSession("http://localhost:3000/api/auth/me", token),
    );
    expect(user?.email).toBe(email);

    await getPool().query(
      "UPDATE sessions SET expires_at = now() - interval '1 minute'",
    );
    await expect(
      getCurrentUser(requestWithSession("http://localhost:3000/api/auth/me", token)),
    ).resolves.toBeNull();

    await expect(
      getCurrentUser(
        requestWithSession("http://localhost:3000/api/auth/me", "not-a-real-session"),
      ),
    ).resolves.toBeNull();
  });

  it("creates a server-side session that stores only the token hash", async () => {
    const created = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email,
        password,
      }),
    );
    const body = await created.json();
    const session = await createSession(body.user.id);
    expect(session.token).toMatch(/^[A-Za-z0-9_-]+$/);

    const rows = await getPool().query(
      "SELECT token_hash FROM sessions WHERE user_id = $1",
      [body.user.id],
    );
    expect(rows.rows.some((row) => row.token_hash === session.token)).toBe(false);

    const beforeDelete = await getPool().query(
      "SELECT count(*)::int AS count FROM sessions WHERE user_id = $1",
      [body.user.id],
    );
    await deleteSession(session.token);
    const after = await getPool().query(
      "SELECT count(*)::int AS count FROM sessions WHERE user_id = $1",
      [body.user.id],
    );
    expect(after.rows[0].count).toBe(beforeDelete.rows[0].count - 1);
  });

  it("handles a concurrent duplicate registration race", async () => {
    const payload = {
      email: "race@example.com",
      password,
    };

    const [first, second] = await Promise.all([
      register(authRequest("http://localhost:3000/api/auth/register", payload)),
      register(authRequest("http://localhost:3000/api/auth/register", payload)),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const users = await getPool().query(
      "SELECT count(*)::int AS count FROM users WHERE email = $1",
      ["race@example.com"],
    );
    expect(users.rows[0].count).toBe(1);
  });

  it("stores SQL-like passwords as hashes and does not interpolate them", async () => {
    const injectionPassword = "'; DROP TABLE users;--";
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "safe@example.com",
        password: injectionPassword,
      }),
    );
    expect(response.status).toBe(201);

    const tables = await getPool().query(
      "SELECT count(*)::int AS count FROM users",
    );
    expect(tables.rows[0].count).toBe(1);

    const stored = await getPool().query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      ["safe@example.com"],
    );
    expect(stored.rows[0].password_hash).not.toBe(injectionPassword);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(injectionPassword);
  });
});
