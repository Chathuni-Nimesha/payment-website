"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { CheckoutSkeleton } from "@/components/CheckoutSkeleton";
import { describedBy, FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Notice } from "@/components/Notice";
import { PaymentMethodPlaceholder } from "@/components/PaymentMethodPlaceholder";
import { PaymentSummary } from "@/components/PaymentSummary";
import { Select } from "@/components/Select";
import { Spinner } from "@/components/Spinner";
import { StripePaymentStep } from "@/components/StripePaymentStep";
import { currencies, DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currencies";
import {
  clearCheckoutSession,
  idempotencyKeyFor,
  loadCheckoutSession,
  saveCheckoutSession,
} from "@/lib/checkout-session";
import { createIdempotencyKey } from "@/lib/idempotency-key";
import { getPublishableKey, readPublishableKey } from "@/lib/stripe/client";
import { stripePublishableConfigError } from "@/lib/stripe/messages";
import { formatMoney } from "@/lib/money";
import {
  type CheckoutFieldErrors,
  validateCheckoutFields,
} from "@/lib/validation";

type CheckoutPhase = "details" | "payment";

type IntentPayload = {
  clientSecret?: string;
  reference?: string;
  intentStatus?: string;
  error?: string;
  fieldErrors?: CheckoutFieldErrors;
};

export function CheckoutForm() {
  const formErrorId = useId();
  const statusId = useId();
  const creatingLock = useRef(false);
  const restored = useRef(false);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>("details");
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const busy = creating || confirming;
  const publishable = readPublishableKey();
  const stripeConfigured = publishable.status === "ready";
  const validatedPreview = validateCheckoutFields({ amount, currency, email });
  const payLabel = validatedPreview.ok
    ? `Pay ${formatMoney(validatedPreview.value.amountMajor, currency)}`
    : "Pay";
  const statusMessage = confirming
    ? "Processing payment..."
    : creating || restoring
      ? "Preparing checkout..."
      : "";

  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;

    const saved = loadCheckoutSession();
    if (!saved) {
      return;
    }

    /* Sync checkout fields from sessionStorage so a refresh can reuse the same PaymentIntent. */
    /* eslint-disable react-hooks/set-state-in-effect */
    setAmount(saved.amount);
    setCurrency(saved.currency);
    setEmail(saved.email);
    /* eslint-enable react-hooks/set-state-in-effect */

    if (saved.phase === "payment" && getPublishableKey()) {
      setRestoring(true);
      void prepareIntent({
        amount: saved.amount,
        currency: saved.currency,
        email: saved.email,
      }).finally(() => {
        setRestoring(false);
      });
    }
    /* Restore checkout session once on mount. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- prepareIntent is recreated each render */
  }, []);

  function clearFieldError(field: keyof CheckoutFieldErrors) {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetPaymentSession() {
    const saved = loadCheckoutSession();
    if (saved) {
      saveCheckoutSession({
        ...saved,
        amount,
        currency,
        email,
        phase: "details",
      });
    }
    setClientSecret(null);
    setReference(null);
    setPhase("details");
    setConfirming(false);
    setCreating(false);
    creatingLock.current = false;
  }

  async function prepareIntent(input: {
    amount: string;
    currency: string;
    email: string;
  }) {
    if (publishable.status !== "ready") {
      setFormError(stripePublishableConfigError(publishable.status));
      return;
    }

    const result = validateCheckoutFields(input);
    if (!result.ok) {
      setErrors(result.errors);
      setPhase("details");
      return;
    }

    if (creatingLock.current) {
      return;
    }

    creatingLock.current = true;
    setCreating(true);
    setFormError(null);
    setErrors({});

    if (!isCurrencyCode(result.value.currency)) {
      setFormError("Select a supported currency.");
      creatingLock.current = false;
      setCreating(false);
      return;
    }

    const details = {
      amount: result.value.amountMajor,
      currency: result.value.currency,
      email: result.value.email,
    };

    let idempotencyKey = idempotencyKeyFor(details);
    saveCheckoutSession({
      ...details,
      idempotencyKey,
      phase: "payment",
    });

    try {
      let payload = await requestIntent(details, idempotencyKey);

      if (payload.httpStatus === 409) {
        idempotencyKey = createIdempotencyKey();
        saveCheckoutSession({
          ...details,
          idempotencyKey,
          phase: "payment",
        });
        payload = await requestIntent(details, idempotencyKey);
      }

      if (payload.body?.intentStatus === "paid") {
        clearCheckoutSession();
        saveCheckoutSession({
          ...details,
          idempotencyKey: createIdempotencyKey(),
          phase: "details",
        });
        setFormError(
          "This payment was already completed. Continue to start a new one.",
        );
        setClientSecret(null);
        setReference(null);
        setPhase("details");
        setCreating(false);
        creatingLock.current = false;
        return;
      }

      if (!payload.ok || !payload.body?.clientSecret || !payload.body.reference) {
        if (payload.body?.fieldErrors) {
          setErrors(payload.body.fieldErrors);
        }
        setFormError(
          payload.body?.error ||
            (payload.httpStatus === 503
              ? stripePublishableConfigError("missing")
              : "The checkout could not be prepared. Please try again."),
        );
        saveCheckoutSession({
          ...details,
          idempotencyKey,
          phase: "details",
        });
        setClientSecret(null);
        setReference(null);
        setPhase("details");
        setCreating(false);
        creatingLock.current = false;
        return;
      }

      saveCheckoutSession({
        ...details,
        idempotencyKey,
        phase: "payment",
      });
      setAmount(details.amount);
      setCurrency(details.currency);
      setEmail(details.email);
      setClientSecret(payload.body.clientSecret);
      setReference(payload.body.reference);
      setPhase("payment");
      setCreating(false);
      creatingLock.current = false;
    } catch {
      setFormError(
        "A network error occurred. Check your connection and try again.",
      );
      setPhase("details");
      setCreating(false);
      creatingLock.current = false;
    }
  }

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await prepareIntent({ amount, currency, email });
  }

  if (restoring) {
    return <CheckoutSkeleton />;
  }

  const summary = (
    <PaymentSummary
      amountMajor={amount}
      currency={currency}
      email={email}
      reference={reference}
    />
  );

  return (
    <div className="grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="min-w-0 rounded-[12px] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Checkout
            </h1>
            <p className="mt-1 text-sm text-muted">
              Stripe test mode. Live cards are not charged.
            </p>
          </div>
          {phase === "payment" ? (
            <button
              type="button"
              onClick={resetPaymentSession}
              disabled={busy}
              className="text-sm font-medium text-accent transition-colors duration-150 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:text-muted"
            >
              Edit details
            </button>
          ) : null}
        </div>

        <p id={statusId} className="sr-only" aria-live="polite">
          {statusMessage}
        </p>

        {!stripeConfigured && !formError ? (
          <div className="mt-5">
            <Notice>
              Stripe test credentials are not configured. You can fill in this
              form, but a real Stripe test payment cannot be processed until
              test keys are added to .env.local.
            </Notice>
          </div>
        ) : null}

        {formError ? (
          <div className="mt-5">
            <Notice id={formErrorId} tone="danger" role="alert">
              {formError}
            </Notice>
          </div>
        ) : null}

        {phase === "details" ? (
          <form
            onSubmit={handleContinue}
            noValidate
            aria-busy={creating}
            aria-describedby={formError ? formErrorId : statusId}
            className="mt-7"
          >
            <CheckoutFields
              amount={amount}
              currency={currency}
              email={email}
              errors={errors}
              disabled={creating}
              onAmountChange={(value) => {
                setAmount(value);
                clearFieldError("amount");
              }}
              onCurrencyChange={(value) => {
                setCurrency(value);
                clearFieldError("currency");
                clearFieldError("amount");
              }}
              onEmailChange={(value) => {
                setEmail(value);
                clearFieldError("email");
              }}
              onAmountBlur={() => {
                const next = validateCheckoutFields({ amount, currency, email });
                setErrors((current) => ({
                  ...current,
                  amount: next.ok ? undefined : next.errors.amount,
                }));
              }}
              onEmailBlur={() => {
                const next = validateCheckoutFields({ amount, currency, email });
                setErrors((current) => ({
                  ...current,
                  email: next.ok ? undefined : next.errors.email,
                }));
              }}
            />

            <div className="mt-6">
              <PaymentMethodPlaceholder />
            </div>

            <div className="mt-8 lg:hidden">{summary}</div>

            <div className="mt-6">
              <Button
                type="submit"
                size="lg"
                fullWidth
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? (
                  <>
                    <Spinner />
                    Preparing checkout...
                  </>
                ) : (
                  "Continue to payment"
                )}
              </Button>
              <p className="mt-3 text-center text-sm text-muted">
                {creating
                  ? "Preparing checkout..."
                  : "Card details are entered in the next step with Stripe."}
              </p>
            </div>
          </form>
        ) : clientSecret && reference ? (
          <div className="mt-7">
            <PaymentInformation
              amount={amount}
              currency={currency}
              email={email}
            />
            <div className="mt-6">
              <StripePaymentStep
                clientSecret={clientSecret}
                reference={reference}
                email={email.trim()}
                payLabel={payLabel}
                onBusyChange={setConfirming}
                summary={<div className="lg:hidden">{summary}</div>}
              />
            </div>
          </div>
        ) : (
          <div className="mt-7 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4 border-muted/40 border-t-muted" />
            Preparing checkout...
          </div>
        )}
      </div>

      <div className="hidden min-w-0 lg:block lg:sticky lg:top-24">{summary}</div>
    </div>
  );
}

function PaymentInformation({
  amount,
  currency,
  email,
}: {
  amount: string;
  currency: string;
  email: string;
}) {
  const parsed = validateCheckoutFields({ amount, currency, email });
  const displayAmount = parsed.ok
    ? formatMoney(parsed.value.amountMajor, currency)
    : amount || "—";

  return (
    <section>
      <h2 className="text-sm font-medium text-foreground">Payment information</h2>
      <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-muted">Amount</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {displayAmount}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-muted">Currency</dt>
          <dd className="font-medium text-foreground">{currency}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-muted">Email</dt>
          <dd className="max-w-[65%] text-right font-medium break-words text-foreground">
            {email.trim() || "Not provided"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

async function requestIntent(
  details: { amount: string; currency: string; email: string },
  idempotencyKey: string,
) {
  const response = await fetch("/api/payments/create-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: details.amount,
      currency: details.currency,
      email: details.email,
      idempotencyKey,
    }),
  });

  const body = (await response.json().catch(() => null)) as IntentPayload | null;
  return { ok: response.ok, httpStatus: response.status, body };
}

function CheckoutFields({
  amount,
  currency,
  email,
  errors,
  disabled,
  onAmountChange,
  onCurrencyChange,
  onEmailChange,
  onAmountBlur,
  onEmailBlur,
}: {
  amount: string;
  currency: (typeof currencies)[number]["code"];
  email: string;
  errors: CheckoutFieldErrors;
  disabled: boolean;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: (typeof currencies)[number]["code"]) => void;
  onEmailChange: (value: string) => void;
  onAmountBlur?: () => void;
  onEmailBlur?: () => void;
}) {
  return (
    <div className="grid gap-5">
      <FormField label="Currency" htmlFor="currency" error={errors.currency}>
        <Select
          id="currency"
          name="currency"
          value={currency}
          disabled={disabled}
          required
          aria-required="true"
          invalid={Boolean(errors.currency)}
          aria-describedby={describedBy("currency", errors.currency)}
          onChange={(event) =>
            onCurrencyChange(
              event.target.value as (typeof currencies)[number]["code"],
            )
          }
        >
          {currencies.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} — {item.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Amount"
        htmlFor="amount"
        error={errors.amount}
        hint="Greater than zero, up to 1,000,000."
      >
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          aria-required="true"
          placeholder={currency === "JPY" ? "1000" : "25.00"}
          value={amount}
          disabled={disabled}
          invalid={Boolean(errors.amount)}
          className="tabular-nums"
          aria-describedby={describedBy(
            "amount",
            errors.amount,
            "Greater than zero, up to 1,000,000.",
          )}
          onChange={(event) => onAmountChange(event.target.value)}
          onBlur={onAmountBlur}
        />
      </FormField>

      <FormField
        label="Email"
        htmlFor="email"
        optional
        error={errors.email}
        hint="Used on the receipt if provided."
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@client.com"
          value={email}
          disabled={disabled}
          invalid={Boolean(errors.email)}
          aria-describedby={describedBy(
            "email",
            errors.email,
            "Used on the receipt if provided.",
          )}
          onChange={(event) => onEmailChange(event.target.value)}
          onBlur={onEmailBlur}
        />
      </FormField>
    </div>
  );
}
