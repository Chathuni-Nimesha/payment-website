"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { describedBy, FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import {
  AUTH_VERIFY_CONFIRMED,
  AUTH_VERIFY_SENT,
} from "@/lib/auth/messages";
import { validateAuthEmail, type AuthFieldErrors } from "@/lib/auth/validation";

type VerifyResponse = {
  error?: string;
  message?: string;
  fieldErrors?: AuthFieldErrors;
  devUrl?: string;
};

export function VerifyEmailForm({ token }: { token: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (!response.ok) {
        setFormError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMessage(payload.message ?? AUTH_VERIFY_CONFIRMED);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {formError ? (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone="info" role="status">
          {message}
        </Notice>
      ) : null}

      <Button
        type="submit"
        fullWidth
        disabled={submitting || Boolean(message)}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Spinner />
            Verifying...
          </>
        ) : (
          "Verify email"
        )}
      </Button>
    </form>
  );
}

export function ResendVerificationForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const signedIn = Boolean(defaultEmail);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setDevUrl(null);

    if (!signedIn) {
      const emailError = validateAuthEmail(email);
      if (emailError) {
        setFieldErrors({ email: emailError });
        return;
      }
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(signedIn ? {} : { email: email.trim().toLowerCase() }),
      });
      const payload = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMessage(payload.message ?? AUTH_VERIFY_SENT);
      if (payload.devUrl) {
        setDevUrl(payload.devUrl);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
      {formError ? (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone="info" role="status">
          {message}
        </Notice>
      ) : null}
      {devUrl ? (
        <Notice tone="warning" role="status">
          Development only:{" "}
          <a
            href={devUrl}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            open the verification link
          </a>
        </Notice>
      ) : null}

      {signedIn ? null : (
        <FormField label="Email" htmlFor="resend-email" error={fieldErrors.email}>
          <Input
            id="resend-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            invalid={Boolean(fieldErrors.email)}
            aria-describedby={describedBy("resend-email", fieldErrors.email)}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
          />
        </FormField>
      )}

      <Button
        type="submit"
        fullWidth={!signedIn}
        variant={signedIn ? "secondary" : "primary"}
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Spinner />
            Sending...
          </>
        ) : (
          "Resend verification email"
        )}
      </Button>
    </form>
  );
}
