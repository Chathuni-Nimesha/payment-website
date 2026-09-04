"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import { stripeAppearance } from "@/lib/stripe/appearance";
import { getStripePromise, readPublishableKey } from "@/lib/stripe/client";
import { publicPaymentError } from "@/lib/stripe/errors";
import { stripePublishableConfigError } from "@/lib/stripe/messages";
import { clearCheckoutSession } from "@/lib/checkout-session";

type StripePaymentStepProps = {
  clientSecret: string;
  reference: string;
  email: string;
  payLabel: string;
  onBusyChange?: (busy: boolean) => void;
  summary?: ReactNode;
};

export function StripePaymentStep({
  clientSecret,
  reference,
  email,
  payLabel,
  onBusyChange,
  summary,
}: StripePaymentStepProps) {
  const stripePromise = getStripePromise();

  if (!stripePromise) {
    const publishable = readPublishableKey();
    return (
      <Notice tone="danger" role="alert">
        {stripePublishableConfigError(
          publishable.status === "live" ? "live" : "missing",
        )}
      </Notice>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: stripeAppearance,
        locale: "en",
      }}
    >
      <ConfirmPaymentForm
        reference={reference}
        email={email}
        payLabel={payLabel}
        onBusyChange={onBusyChange}
        summary={summary}
      />
    </Elements>
  );
}

function ConfirmPaymentForm({
  reference,
  email,
  payLabel,
  onBusyChange,
  summary,
}: Omit<StripePaymentStepProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = "stripe-payment-error";
  const ready = Boolean(stripe && elements);

  function setSubmitting(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements || lock.current) {
      return;
    }

    lock.current = true;
    setSubmitting(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success?ref=${encodeURIComponent(reference)}`,
          receipt_email: email || undefined,
        },
        redirect: "if_required",
      });

      if (result.error) {
        if (
          result.error.type === "card_error" ||
          result.error.code === "card_declined"
        ) {
          router.push(`/failed?ref=${encodeURIComponent(reference)}`);
          return;
        }

        if (result.error.type !== "validation_error") {
          setError(publicPaymentError(result.error));
        }
        setSubmitting(false);
        lock.current = false;
        return;
      }

      const status = result.paymentIntent?.status;

      if (status === "succeeded" || status === "processing") {
        clearCheckoutSession();
        router.push(`/success?ref=${encodeURIComponent(reference)}`);
        return;
      }

      if (status === "requires_action") {
        setError(
          "Additional authentication is required to finish this payment.",
        );
        setSubmitting(false);
        lock.current = false;
        return;
      }

      if (status === "requires_payment_method") {
        router.push(`/failed?ref=${encodeURIComponent(reference)}`);
        return;
      }

      setError("The payment could not be completed. Please try again.");
      setSubmitting(false);
      lock.current = false;
    } catch {
      setError("A network error occurred. Check your connection and try again.");
      setSubmitting(false);
      lock.current = false;
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={busy}
      aria-describedby={error ? errorId : undefined}
    >
      <div className="rounded-[8px] border border-border bg-background px-4 py-4">
        <p className="mb-3 text-sm font-medium text-foreground">
          Payment method
        </p>
        <PaymentElement
          options={{
            layout: "tabs",
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
        <p className="mt-3 text-sm leading-6 text-muted">
          Card details stay with Stripe. Northline does not store payment
          information.
        </p>
      </div>

      {error ? (
        <div className="mt-4">
          <Notice id={errorId} tone="danger" role="alert">
            {error}
          </Notice>
        </div>
      ) : null}

      {summary ? <div className="mt-6">{summary}</div> : null}

      <div className="mt-6">
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={!ready || busy}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <Spinner />
              Processing payment...
            </>
          ) : !ready ? (
            "Loading payment form..."
          ) : (
            payLabel
          )}
        </Button>
        <p className="mt-3 text-center text-sm text-muted">
          {busy
            ? "Processing payment..."
            : "You will only be charged in Stripe test mode."}
        </p>
      </div>
    </form>
  );
}
