import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readDatabaseUrl } from "@/lib/db/client";
import {
  AUTH_UNAUTHENTICATED,
  AUTH_UNAVAILABLE,
} from "./messages";
import { readSessionTokenFromHeader, SESSION_COOKIE_NAME } from "./cookie";
import { deleteSession, getUserBySessionToken } from "./store";
import type { AuthUser } from "./types";

export async function readSessionToken(request?: Request) {
  if (request) {
    return readSessionTokenFromHeader(request.headers.get("cookie"));
  }

  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUser(request?: Request): Promise<AuthUser | null> {
  const token = await readSessionToken(request);

  if (!readDatabaseUrl()) {
    return null;
  }

  try {
    return await getUserBySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireApiUser(request: Request): Promise<
  { ok: true; user: AuthUser } | { ok: false; response: Response }
> {
  const token = await readSessionToken(request);
  if (!token) {
    return {
      ok: false,
      response: Response.json({ error: AUTH_UNAUTHENTICATED }, { status: 401 }),
    };
  }

  if (!readDatabaseUrl()) {
    return {
      ok: false,
      response: Response.json({ error: AUTH_UNAVAILABLE }, { status: 503 }),
    };
  }

  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return {
        ok: false,
        response: Response.json({ error: AUTH_UNAUTHENTICATED }, { status: 401 }),
      };
    }

    return { ok: true, user };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: AUTH_UNAVAILABLE }, { status: 503 }),
    };
  }
}

export { deleteSession };
