export function trustedProxyEnabled() {
  const raw = process.env.TRUSTED_PROXY?.trim().toLowerCase();
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function firstForwardedHop(value: string | null) {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Client IP for rate limiting.
 *
 * Next.js route handlers do not expose a trustworthy socket address.
 * Forwarded headers are used only when TRUSTED_PROXY is enabled (or by
 * default in non-production so local development keeps working).
 * Production behind a reverse proxy must set TRUSTED_PROXY=true and the
 * proxy must overwrite/sanitize X-Forwarded-For / X-Real-IP.
 */
export function clientIp(request: Request) {
  if (!trustedProxyEnabled()) {
    return "unknown";
  }

  const forwarded = firstForwardedHop(request.headers.get("x-forwarded-for"));
  if (forwarded) {
    return forwarded;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
