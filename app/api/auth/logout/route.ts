import { isTrustedOriginRequest } from "@/lib/auth/csrf";
import { jsonWithoutSession } from "@/lib/auth/http";
import { AUTH_REQUEST_UNVERIFIED } from "@/lib/auth/messages";
import { readSessionToken } from "@/lib/auth/session";
import { deleteSession } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isTrustedOriginRequest(request)) {
    return jsonWithoutSession({ error: AUTH_REQUEST_UNVERIFIED }, 403);
  }

  const token = await readSessionToken(request);

  try {
    await deleteSession(token);
  } catch {
    // Always clear the cookie so the browser session ends.
  }

  return jsonWithoutSession({ ok: true }, 200, true);
}
