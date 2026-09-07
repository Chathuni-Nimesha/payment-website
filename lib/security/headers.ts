export type SecurityHeader = {
  key: string;
  value: string;
};

/**
 * Stripe.js / Payment Element origins from Stripe's CSP guide.
 * Address Element Google Maps origins are omitted because Northline does not use it.
 * Hosted Checkout origins are omitted because checkout uses Payment Element.
 * Apple Pay / Google Pay origins are omitted; wallets are disabled in
 * StripePaymentStep so this policy does not need pay.google.com wildcards.
 */
export const STRIPE_SCRIPT_ORIGINS = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
] as const;

export const STRIPE_FRAME_ORIGINS = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
] as const;

export const STRIPE_CONNECT_ORIGINS = ["https://api.stripe.com"] as const;

export const STRIPE_IMG_ORIGINS = ["https://*.stripe.com"] as const;

export function contentSecurityPolicy(options: { production: boolean }) {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...STRIPE_SCRIPT_ORIGINS,
    options.production ? "" : "'unsafe-eval'",
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = [
    "'self'",
    ...STRIPE_CONNECT_ORIGINS,
    options.production ? "" : "ws:",
    options.production ? "" : "wss:",
  ]
    .filter(Boolean)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${STRIPE_IMG_ORIGINS.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    `frame-src ${STRIPE_FRAME_ORIGINS.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    options.production ? "upgrade-insecure-requests" : "",
  ].filter(Boolean);

  return directives.join("; ");
}

export function securityHeaders(options: { production: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(options),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=(), browsing-topics=()",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
  ];

  if (options.production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
