"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { describedBy, FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Notice } from "@/components/Notice";
import { Spinner } from "@/components/Spinner";
import {
  type AuthFieldErrors,
  validateAuthCredentials,
} from "@/lib/auth/validation";

type AuthFormMode = "login" | "register";

type AuthResponse = {
  error?: string;
  fieldErrors?: AuthFieldErrors;
  user?: { id: string; email: string };
};

export function AuthForm({ mode }: { mode: AuthFormMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
  const submitLabel = mode === "register" ? "Create account" : "Sign in";
  const pendingLabel =
    mode === "register" ? "Creating account..." : "Signing in...";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = validateAuthCredentials({ email, password });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: parsed.email,
          password: parsed.password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as AuthResponse;

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
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

      <FormField label="Email" htmlFor="auth-email" error={fieldErrors.email}>
        <Input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          invalid={Boolean(fieldErrors.email)}
          aria-describedby={describedBy("auth-email", fieldErrors.email)}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="auth-password"
        error={fieldErrors.password}
        hint={
          mode === "register" && !fieldErrors.password
            ? "Use at least 10 characters."
            : undefined
        }
      >
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          invalid={Boolean(fieldErrors.password)}
          aria-describedby={describedBy(
            "auth-password",
            fieldErrors.password,
            mode === "register" ? "Use at least 10 characters." : undefined,
          )}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
      </FormField>

      <Button type="submit" fullWidth disabled={submitting} aria-busy={submitting}>
        {submitting ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
