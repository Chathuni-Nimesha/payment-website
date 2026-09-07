"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { describedBy, FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import { AUTH_RECOVERY_SENT } from "@/lib/auth/messages";
import { validateAuthEmail, type AuthFieldErrors } from "@/lib/auth/validation";

type RecoveryResponse = {
  error?: string;
  message?: string;
  fieldErrors?: AuthFieldErrors;
  devUrl?: string;
};

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);
    setDevUrl(null);

    const emailError = validateAuthEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const payload = (await response.json().catch(() => ({}))) as RecoveryResponse;

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setMessage(payload.message ?? AUTH_RECOVERY_SENT);
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
            open the reset link
          </a>
        </Notice>
      ) : null}

      <FormField label="Email" htmlFor="forgot-email" error={fieldErrors.email}>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          invalid={Boolean(fieldErrors.email)}
          aria-describedby={describedBy("forgot-email", fieldErrors.email)}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </FormField>

      <Button type="submit" fullWidth disabled={submitting} aria-busy={submitting}>
        {submitting ? (
          <>
            <Spinner />
            Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </Button>
    </form>
  );
}
