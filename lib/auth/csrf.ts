import { siteUrl } from "@/lib/brand";

export function isTrustedOriginRequest(request: Request) {
  const allowed = allowedOrigins(request);
  const origin = request.headers.get("origin")?.trim();

  if (origin) {
    return allowed.has(origin);
  }

  const referer = request.headers.get("referer")?.trim();
  if (!referer) {
    return false;
  }

  try {
    return allowed.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

function allowedOrigins(request: Request) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed request URLs and rely on the configured site origin.
  }

  try {
    origins.add(new URL(siteUrl()).origin);
  } catch {
    // Ignore invalid NEXT_PUBLIC_SITE_URL values.
  }

  return origins;
}
