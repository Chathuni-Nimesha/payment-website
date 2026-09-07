import {
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "./cookie";

export function jsonWithSession(
  body: unknown,
  token: string,
  status = 200,
) {
  const response = Response.json(body, { status });
  response.headers.set("Set-Cookie", serializeSessionCookie(token));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function jsonWithoutSession(
  body: unknown,
  status = 200,
  clearCookie = false,
) {
  const response = Response.json(body, { status });
  if (clearCookie) {
    response.headers.set("Set-Cookie", serializeClearedSessionCookie());
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
