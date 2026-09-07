export const SESSION_COOKIE_NAME = "nl_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function sessionCookieOptions(
  maxAge = SESSION_MAX_AGE_SECONDS,
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function serializeSessionCookie(
  token: string,
  maxAge = SESSION_MAX_AGE_SECONDS,
) {
  return serializeCookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(maxAge));
}

export function serializeClearedSessionCookie() {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

export function readSessionTokenFromHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    if (!value) {
      return null;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function serializeCookie(
  name: string,
  value: string,
  options: SessionCookieOptions,
) {
  const parts = [
    `${name}=${value ? encodeURIComponent(value) : ""}`,
    `Path=${options.path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
