import type { AuthFieldErrors } from "./types";

export type { AuthFieldErrors };

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function validatePassword(
  password: string,
  email?: string,
): string | undefined {
  if (!password) {
    return "Enter a password.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return "Use a shorter password.";
  }

  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return "Choose a password that is different from your email.";
  }

  return undefined;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateAuthEmail(value: string): string | undefined {
  const email = normalizeEmail(value);

  if (!email) {
    return "Enter an email address.";
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return "Enter a shorter email address.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }

  return undefined;
}

export function validateAuthCredentials(input: {
  email: unknown;
  password: unknown;
}):
  | { ok: true; email: string; password: string }
  | { ok: false; fieldErrors: AuthFieldErrors } {
  const emailValue = typeof input.email === "string" ? input.email : "";
  const passwordValue = typeof input.password === "string" ? input.password : "";
  const email = normalizeEmail(emailValue);
  const fieldErrors: AuthFieldErrors = {};

  const emailError = validateAuthEmail(emailValue);
  if (emailError) {
    fieldErrors.email = emailError;
  }

  const passwordError = validatePassword(passwordValue, email);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  if (fieldErrors.email || fieldErrors.password) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, email, password: passwordValue };
}
