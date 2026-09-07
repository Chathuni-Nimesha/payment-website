"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { describedBy, FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import { AUTH_RESET_COMPLETE } from "@/lib/auth/messages";
import {
  validatePassword,
  type AuthFieldErrors,
} from "@/lib/auth/validation";

type ResetResponse = {
  error?: string;
  message?: string;
  fieldErrors?: AuthFieldErrors;
};

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldErrors({ password: passwordError });
      return;
    }

    if (password !== confirm) {
      setFieldErrors({ password: "Passwords do not match." });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as ResetResponse;

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setPassword("");
      setConfirm("");
      setMessage(payload.message ?? AUTH_RESET_COMPLETE);
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

      <FormField
        label="New password"
        htmlFor="reset-password"
        error={fieldErrors.password}
        hint={!fieldErrors.password ? "Use at least 10 characters." : undefined}
      >
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          invalid={Boolean(fieldErrors.password)}
          aria-describedby={describedBy(
            "reset-password",
            fieldErrors.password,
            "Use at least 10 characters.",
          )}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting || Boolean(message)}
        />
      </FormField>

      <FormField label="Confirm password" htmlFor="reset-password-confirm">
        <Input
          id="reset-password-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={submitting || Boolean(message)}
        />
      </FormField>

      <Button
        type="submit"
        fullWidth
        disabled={submitting || Boolean(message)}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Spinner />
            Updating...
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}
