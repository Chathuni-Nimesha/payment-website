import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  securityHeaders,
  STRIPE_CONNECT_ORIGINS,
  STRIPE_FRAME_ORIGINS,
  STRIPE_SCRIPT_ORIGINS,
} from "@/lib/security/headers";

function headerValue(headers: ReturnType<typeof securityHeaders>, key: string) {
  return headers.find((header) => header.key === key)?.value;
}

describe("security headers", () => {
  it("sets the required production headers including HSTS", () => {
    const headers = securityHeaders({ production: true });
    const keys = headers.map((header) => header.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Strict-Transport-Security",
        "X-Frame-Options",
      ]),
    );
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("omits HSTS outside production so local HTTP keeps working", () => {
    const headers = securityHeaders({ production: false });
    expect(headerValue(headers, "Strict-Transport-Security")).toBeUndefined();
    expect(contentSecurityPolicy({ production: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("keeps required Stripe Payment Element origins", () => {
    const csp = contentSecurityPolicy({ production: true });

    for (const origin of STRIPE_SCRIPT_ORIGINS) {
      expect(csp).toContain(origin);
    }
    for (const origin of STRIPE_FRAME_ORIGINS) {
      expect(csp).toContain(origin);
    }
    for (const origin of STRIPE_CONNECT_ORIGINS) {
      expect(csp).toContain(origin);
    }
    expect(csp).toContain("https://hooks.stripe.com");
    expect(csp).toContain("https://api.stripe.com");
    expect(csp).toContain("https://js.stripe.com");
  });

  it("does not use an open wildcard source", () => {
    const csp = contentSecurityPolicy({ production: true });

    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/default-src\s+\*/);
    expect(csp).not.toMatch(/script-src[^;]*\s\*(;|$)/);
    expect(csp).not.toContain("script-src *");
    expect(csp).not.toContain("connect-src *");
  });

  it("does not include 'unsafe-eval' in production", () => {
    expect(contentSecurityPolicy({ production: true })).not.toContain(
      "'unsafe-eval'",
    );
    expect(contentSecurityPolicy({ production: false })).toContain(
      "'unsafe-eval'",
    );
  });

  it("keeps frame-ancestors none and does not add wallet wildcards", () => {
    const csp = contentSecurityPolicy({ production: true });

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("pay.google.com");
    expect(csp).not.toContain("apple.com");
    expect(csp).not.toContain("*.google.com");
  });
});
