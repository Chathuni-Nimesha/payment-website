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

## Architecture

Browser checkout posts to `POST /api/payments/create-intent`. The server creates a Stripe PaymentIntent in test mode, then the client confirms with Stripe’s Payment Element.

`POST /api/webhooks/stripe` verifies the Stripe signature before updating the local transaction record. Receipt pages retrieve the PaymentIntent from Stripe. A browser redirect is never treated as proof of payment.

Idempotency keys are reused for the same amount, currency, and email in a browser tab so refresh does not create a new PaymentIntent.

P1 uses a file-backed store at `data/transactions.json` (gitignored). It is a stand-in for PostgreSQL and is not suitable for a multi-instance production deployment.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs without Stripe keys. Checkout, receipts, legal pages, and failure states stay available. PaymentIntent creation and webhook handling return a controlled error until valid **test** credentials are present. Live keys (`sk_live_` / `pk_live_`) are rejected.

Never commit `.env.local`.

## Environment variables

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` is optional. It is used for metadata, sitemap, and Open Graph URLs.

## Stripe test-mode integration

Northline talks to Stripe test mode only:

- Checkout creates a PaymentIntent on the server.
- Stripe Payment Element collects the payment method.
- Webhook signature verification is required. It is not bypassed.
- Receipts are confirmed by retrieving the PaymentIntent.

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

The handler verifies the Stripe signature and updates the local transaction record for `payment_intent.succeeded` and `payment_intent.payment_failed`.

## Security model

- Secret keys stay on the server.
- Only `sk_test_` / `pk_test_` keys are accepted.
- Webhook events are rejected without a valid Stripe signature.
- Northline does not handle raw card data.
- Paid status is not derived from query parameters such as `amount` or `status`.
- Legal pages are templates. They do not invent a company, address, or certification.

## What is and is not production-ready

Ready for a client walkthrough of checkout UX, test-mode Stripe architecture, and honest empty/error states.

Not ready as a live merchant account. There is no dashboard, authentication, refunds, PostgreSQL, multi-tenant setup, or live Stripe processing.

Privacy, Terms, and Refund Policy pages are placeholders for a client’s actual legal copy.

## Future improvements

Later phases may consider a merchant dashboard, authentication, PostgreSQL, refunds, and live Stripe — none of those are in this build.
