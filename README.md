# Northline

Northline is a professional payment checkout for freelance products, invoices, retainers, and client work.

This repository is a client-presentable product demo. It currently uses **Stripe TEST MODE** only. It does not enable production or live payment processing. It does not collect or store card numbers, expiry dates, or CVV. Payment details are entered in Stripe’s Payment Element.

Stripe credentials are required for real Stripe test transactions. Missing keys do not invent a successful payment.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Stripe Payment Element (`@stripe/react-stripe-js`)
- Stripe Node SDK for PaymentIntents and webhooks
- PostgreSQL (`pg`) for transactions, webhook event ids, public API rate limits, users, and sessions
- Argon2id (`@node-rs/argon2`) for password hashing

## Architecture

Browser checkout posts to `POST /api/payments/create-intent`. The server creates a Stripe PaymentIntent in test mode, then the client confirms with Stripe’s Payment Element.

`POST /api/webhooks/stripe` verifies the Stripe signature before writing to PostgreSQL. Receipt pages retrieve the PaymentIntent from Stripe. A browser redirect is never treated as proof of payment.

`POST /api/payments/create-intent` is rate-limited per client IP and per IP plus hashed email. `POST /api/auth/login` is limited per IP and per IP plus hashed email. `POST /api/auth/register` is limited per IP. Valid signed Stripe webhook deliveries are not rate-limited, so legitimate retries are not dropped. Requests that fail signature verification are limited per IP. Exceeded limits return HTTP 429. The limiter is PostgreSQL-backed and can be replaced with Redis later.

Idempotency keys are reused for the same amount, currency, and email in a browser tab so refresh does not create a new PaymentIntent. Stripe’s Idempotency-Key remains the server-side duplicate guard. Checkout idempotency is not stored in PostgreSQL.

Transactions and Stripe webhook event ids are stored in PostgreSQL. Card numbers, CVV, expiry, client secrets, and Stripe keys are never stored.

Duplicate webhook deliveries (`evt_…`) are ignored. An older Stripe event cannot downgrade a transaction that is already `paid`. A newer `succeeded` event can move `failed` or `processing` to `paid`.

Accounts are optional. Checkout stays public. A signed-in checkout stores the server-side session user on the transaction. Guest payments keep `user_id` empty. `GET /api/payments` and `/dashboard` list only that user’s payments. Receipt status is still confirmed with Stripe.

## Local development

1. Install dependencies and copy environment files:

```bash
npm install
cp .env.example .env.local
```

2. Start PostgreSQL locally (example with Docker):

```bash
docker run --name northline-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=northline -p 5432:5432 -d postgres:16
```

3. Set `DATABASE_URL` in `.env.local`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/northline
```

Leave `DATABASE_SSL` unset for this local Docker database. Hosted PostgreSQL should set `DATABASE_SSL=true` so connections use TLS with certificate validation (`rejectUnauthorized: true`).

For rate limiting, Next.js route handlers do not expose a trustworthy socket IP. Local development trusts `X-Forwarded-For` / `X-Real-IP` by default. Production ignores those headers unless `TRUSTED_PROXY=true`. If you terminate TLS at a reverse proxy, set `TRUSTED_PROXY=true` and configure the proxy to overwrite forwarded headers. Do not enable that flag if clients can set those headers themselves.

`GET /api/health` returns `{ "status": "ok" }` when PostgreSQL answers a `SELECT 1` check, or HTTP 503 `{ "status": "unavailable" }` when the database is missing or unreachable. It does not call Stripe and does not write data.

4. Run migrations:

```bash
npm run db:migrate
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs without Stripe keys. Checkout, receipts, legal pages, and failure states stay available. PaymentIntent creation and webhook handling return a controlled error until valid **test** credentials are present. Live keys (`sk_live_` / `pk_live_`) are rejected. Persisting a transaction or creating an account requires `DATABASE_URL`.

After `npm run db:migrate`, open `/register` or `/login` to create a session and visit `/dashboard`. Checkout at `/payment` does not require an account.

Never commit `.env.local`.

## Environment variables

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/northline
```

Optional reverse-proxy trust for IP rate limits (required in production only when a sanitizing proxy sits in front of the app):

```
TRUSTED_PROXY=true
```

`GET /api/health` is a JSON liveness/readiness check against PostgreSQL. It is not a Stripe check.

Optional rate-limit overrides (defaults in parentheses):

```
RATE_LIMIT_CREATE_INTENT_MAX=10
RATE_LIMIT_CREATE_INTENT_WINDOW_MS=60000
RATE_LIMIT_CREATE_INTENT_IDENTITY_MAX=6
RATE_LIMIT_CREATE_INTENT_IDENTITY_WINDOW_MS=60000
RATE_LIMIT_WEBHOOK_UNSIGNED_MAX=60
RATE_LIMIT_WEBHOOK_UNSIGNED_WINDOW_MS=60000
RATE_LIMIT_AUTH_LOGIN_IP_MAX=10
RATE_LIMIT_AUTH_LOGIN_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_LOGIN_IDENTITY_MAX=6
RATE_LIMIT_AUTH_LOGIN_IDENTITY_WINDOW_MS=60000
RATE_LIMIT_AUTH_REGISTER_IP_MAX=5
RATE_LIMIT_AUTH_REGISTER_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_FORGOT_PASSWORD_IP_MAX=5
RATE_LIMIT_AUTH_FORGOT_PASSWORD_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_FORGOT_PASSWORD_IDENTITY_MAX=3
RATE_LIMIT_AUTH_FORGOT_PASSWORD_IDENTITY_WINDOW_MS=60000
RATE_LIMIT_AUTH_RESET_PASSWORD_IP_MAX=10
RATE_LIMIT_AUTH_RESET_PASSWORD_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_VERIFY_EMAIL_IP_MAX=20
RATE_LIMIT_AUTH_VERIFY_EMAIL_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_RESEND_VERIFICATION_IP_MAX=5
RATE_LIMIT_AUTH_RESEND_VERIFICATION_IP_WINDOW_MS=60000
RATE_LIMIT_AUTH_RESEND_VERIFICATION_IDENTITY_MAX=3
RATE_LIMIT_AUTH_RESEND_VERIFICATION_IDENTITY_WINDOW_MS=60000
```

Optional database TLS for hosted PostgreSQL:

```
DATABASE_SSL=true
```

Leave `DATABASE_SSL` unset for local Docker PostgreSQL. Do not disable certificate validation.

`NEXT_PUBLIC_SITE_URL` is optional. It is used for metadata, sitemap, and Open Graph URLs.

`DATABASE_URL` is required to persist transactions, webhook events, rate-limit counters, users, and sessions. Authentication does not add a separate secret. Do not put real credentials in `.env.example`.

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

`npm test` runs unit and API tests with Stripe mocked. PostgreSQL integration tests, including authentication, are skipped unless `TEST_DATABASE_URL` is set. Do not point that variable at a personal or production database.

To run PostgreSQL integration tests:

```bash
docker run --name northline-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=northline_test -p 5433:5432 -d postgres:16
set TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/northline_test
npm run db:migrate
npm run test:db
```

On PowerShell, set the test URL in the same session before `npm run db:migrate` and `npm run test:db`, or set `DATABASE_URL` for migrate and `TEST_DATABASE_URL` for Vitest.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, migrations, `npm test`, `npm run lint`, and `npm run build` on push and pull request to `main`. A PostgreSQL 16 service supplies `DATABASE_URL` / `TEST_DATABASE_URL` for integration tests. Stripe is not configured in CI; Stripe-dependent tests stay mocked. CI does not process live payments.

## Stripe test-mode integration

Northline talks to Stripe test mode only:

- Checkout creates a PaymentIntent on the server.
- Stripe Payment Element collects the payment method.
- Webhook signature verification is required. It is not bypassed.
- Receipts are confirmed by retrieving the PaymentIntent.
- Webhook event ids are stored so Stripe retries do not apply twice.

Stripe payment processing is not available in every country or region. If you cannot obtain test keys, the UI will not claim that a payment was completed.

Do not add fake test results.

## Real Stripe test transactions

Valid Stripe **test** credentials are required. Never use `sk_live_` / `pk_live_` keys.

When keys are configured:

1. Open `/payment`.
2. Enter an amount such as `25.00` and currency `USD`.
3. Continue to payment.
4. Use Stripe’s test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. The receipt amount and status come from Stripe, not from the URL.

To test a decline, use Stripe’s card `4000 0000 0000 0002`.

## Webhooks (local)

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET` in `.env.local`.
4. Restart `npm run dev`.

The handler verifies the Stripe signature, records `event.id`, and updates the PostgreSQL transaction for `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, and `payment_intent.canceled`.

## Security model

- Secret keys stay on the server.
- Only `sk_test_` / `pk_test_` keys are accepted.
- Webhook events are rejected without a valid Stripe signature.
- Public create-intent requests are rate-limited. Login, register, forgot password, password reset, and email verification resend are rate-limited. Unsigned or invalid webhook requests are rate-limited. Valid signed Stripe retries are not.
- Passwords are hashed with Argon2id. Session cookies are HTTP-only, SameSite=Lax, and Secure in production. PostgreSQL stores a hash of the session token.
- State-changing auth routes require a same-origin `Origin` or `Referer`.
- Responses include Content-Security-Policy (Stripe.js / Payment Element origins only), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and production `Strict-Transport-Security`. Apple Pay and Google Pay are disabled in Payment Element so CSP does not need wallet wildcards. This does not make the app production-ready on its own.
- Hosted PostgreSQL should set `DATABASE_SSL=true`. Local Docker PostgreSQL should leave it unset.
- Production rate limiting ignores forwarded IP headers unless `TRUSTED_PROXY=true` and the reverse proxy overwrites them.
- `/success` and `/failed` are `noindex` and disallowed in `robots.txt`. Public checkout at `/payment` stays allowed.
- Server logs are JSON. Passwords, session tokens, Stripe secrets, `client_secret`, card data, and connection strings are redacted. Successful requests are not logged by default.
- Northline does not handle raw card data and does not store PAN, CVV, expiry, or client secrets.
- Paid status is not derived from query parameters such as `amount` or `status`.
- Legal pages are templates. They do not invent a company, address, or certification.

## What is and is not production-ready

Ready for a client walkthrough of checkout UX, test-mode Stripe architecture, PostgreSQL persistence, public API rate limiting, email/password authentication, and honest empty/error states.

Not ready as a live merchant account. There are no refunds, multi-tenant setup, or live Stripe processing. `/dashboard` shows the signed-in user’s own test-mode payment history. Operational checks (health, CI, trusted-proxy IP handling, structured logs) are present; they are not an uptime or PCI claim.

Privacy, Terms, and Refund Policy pages are placeholders for a client’s actual legal copy.

## Future improvements

Later phases may consider a merchant dashboard, refunds, and live Stripe — none of those are in this build.

## Authentication

Northline uses server-side sessions, not JWTs in localStorage.

1. Run migrations, including `003_auth.sql`, `004_user_transactions.sql`, and `005_auth_recovery.sql`, with `npm run db:migrate`.
2. Open `/register` to create an account, or `/login` to sign in.
3. A successful register or login sets `nl_session` and redirects to `/dashboard`. New accounts start unverified. Checkout is not blocked.
4. `/dashboard` lists payments created while that account was signed in. Guest checkout remains available and is not added to that list.
5. `/forgot-password` and `/reset-password` reset a password. All sessions for that user are revoked after a successful reset.
6. `/verify-email` confirms an email. `/api/auth/resend-verification` requests another link. Both use generic public responses except for a signed-in user who is already verified.
7. Sign out from the header or by clearing the session.

Passwords must be at least 10 characters. Email is stored lowercase and unique. Login failures use a single generic error so the response does not reveal whether the email exists. Auth API routes do not return `password_hash` or the raw session token. Login, register, forgot password, reset, and verification resend are rate-limited; email addresses are hashed before they are used as limiter keys.

No real email provider is configured. In development and tests, verification and reset links are stored in an in-memory mailbox and may appear as `devUrl` on JSON responses. Production never includes `devUrl` and does not log raw tokens.
