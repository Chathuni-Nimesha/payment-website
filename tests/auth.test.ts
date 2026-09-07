import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_INVALID_INPUT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAUTHENTICATED,
} from "@/lib/auth/messages";
import {
  SESSION_COOKIE_NAME,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
} from "@/lib/auth/cookie";
import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  normalizeEmail,
  validateAuthCredentials,
  validatePassword,
} from "@/lib/auth/validation";
import { jsonRequest } from "./helpers";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

function authRequest(
  url: string,
  body: unknown,
  headers?: HeadersInit,
) {
  return jsonRequest(url, body, {
    Origin: "http://localhost:3000",
    ...headers,
  });
}

describe("auth validation", () => {
  it("normalizes email to lowercase", () => {
    expect(normalizeEmail("  Client@Example.COM ")).toBe("client@example.com");
  });

  it("rejects an invalid email", () => {
    const result = validateAuthCredentials({
      email: "not-an-email",
      password: "longenough1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.email).toBe("Enter a valid email address.");
    }
  });

  it("rejects a weak password", () => {
    expect(validatePassword("short")).toBe("Use at least 10 characters.");
    const result = validateAuthCredentials({
      email: "client@example.com",
      password: "123",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.password).toBe("Use at least 10 characters.");
    }
  });

  it("rejects a password that matches the email", () => {
    expect(validatePassword("client@example.com", "client@example.com")).toBe(
      "Choose a password that is different from your email.",
    );
  });

  it("hashes passwords with Argon2id and never stores plaintext", async () => {
    const hashed = await hashPassword("longenough1");
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toContain("longenough1");
    await expect(verifyPassword(hashed, "longenough1")).resolves.toBe(true);
    await expect(verifyPassword(hashed, "wrong-password")).resolves.toBe(false);
  });
});

describe("session cookie security attributes", () => {
  it("sets httpOnly, path, SameSite=Lax, and Secure in production", () => {
    const options = sessionCookieOptions();
    const header = serializeSessionCookie("opaque-token");

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(options.secure).toBe(process.env.NODE_ENV === "production");
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=");
    if (options.secure) {
      expect(header).toContain("Secure");
    }
  });

  it("clears the cookie without leaking a session token", () => {
    const header = serializeClearedSessionCookie();
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
  });
});

describe("CSRF origin checks", () => {
  it("accepts a same-origin POST", () => {
    expect(
      isTrustedOriginRequest(
        authRequest("http://localhost:3000/api/auth/login", {}),
      ),
    ).toBe(true);
  });

  it("rejects a cross-site POST", () => {
    expect(
      isTrustedOriginRequest(
        authRequest("http://localhost:3000/api/auth/login", {}, {
          Origin: "https://evil.example",
        }),
      ),
    ).toBe(false);
  });
});

describe("auth routes without a session", () => {
  it("returns 401 for unauthenticated /api/auth/me", async () => {
    const response = await me(new Request("http://localhost:3000/api/auth/me"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: AUTH_UNAUTHENTICATED });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("rejects register without a trusted origin", async () => {
    const response = await register(
      jsonRequest("http://localhost:3000/api/auth/register", {
        email: "client@example.com",
        password: "longenough1",
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: AUTH_REQUEST_UNVERIFIED,
    });
  });

  it("rejects invalid email on register", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "not-an-email",
        password: "longenough1",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(AUTH_INVALID_INPUT);
    expect(body.fieldErrors.email).toBe("Enter a valid email address.");
  });

  it("rejects a weak password on register", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "client@example.com",
        password: "short",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.password).toBe("Use at least 10 characters.");
  });

  it("returns a generic login error without revealing whether the email exists", async () => {
    const missing = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "missing@example.com",
        password: "longenough1",
      }),
    );
    const empty = await login(
      authRequest("http://localhost:3000/api/auth/login", {
        email: "",
        password: "",
      }),
    );

    expect([400, 401, 503]).toContain(missing.status);
    const missingBody = await missing.json();
    if (missing.status !== 503) {
      expect(missingBody.error).toBe(AUTH_INVALID_CREDENTIALS);
    }
    expect(JSON.stringify(missingBody)).not.toMatch(/exist|unknown user|password_hash/i);

    const emptyBody = await empty.json();
    if (empty.status !== 503) {
      expect(emptyBody.error).toBe(AUTH_INVALID_CREDENTIALS);
    }
  });

  it("treats SQL-like email input as invalid data, not a query", async () => {
    const response = await register(
      authRequest("http://localhost:3000/api/auth/register", {
        email: "'; DROP TABLE users;--",
        password: "longenough1",
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.email).toBe("Enter a valid email address.");
  });

  it("clears the session cookie on logout", async () => {
    const response = await logout(
      authRequest("http://localhost:3000/api/auth/logout", {}),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
  });
});

describe("protected dashboard", () => {
  beforeEach(() => {
    cookieJar.clear();
  });

  it("redirects unauthenticated users to /login", async () => {
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
