function positiveInt(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const CREATE_INTENT_LIMIT = {
  max: positiveInt("RATE_LIMIT_CREATE_INTENT_MAX", 10),
  windowMs: positiveInt("RATE_LIMIT_CREATE_INTENT_WINDOW_MS", 60_000),
};

export const CREATE_INTENT_IDENTITY_LIMIT = {
  max: positiveInt("RATE_LIMIT_CREATE_INTENT_IDENTITY_MAX", 6),
  windowMs: positiveInt("RATE_LIMIT_CREATE_INTENT_IDENTITY_WINDOW_MS", 60_000),
};

export const WEBHOOK_UNSIGNED_LIMIT = {
  max: positiveInt("RATE_LIMIT_WEBHOOK_UNSIGNED_MAX", 60),
  windowMs: positiveInt("RATE_LIMIT_WEBHOOK_UNSIGNED_WINDOW_MS", 60_000),
};

export const AUTH_LOGIN_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_LOGIN_IP_MAX", 10),
  windowMs: positiveInt("RATE_LIMIT_AUTH_LOGIN_IP_WINDOW_MS", 60_000),
};

export const AUTH_LOGIN_IDENTITY_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_LOGIN_IDENTITY_MAX", 6),
  windowMs: positiveInt("RATE_LIMIT_AUTH_LOGIN_IDENTITY_WINDOW_MS", 60_000),
};

export const AUTH_REGISTER_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_REGISTER_IP_MAX", 5),
  windowMs: positiveInt("RATE_LIMIT_AUTH_REGISTER_IP_WINDOW_MS", 60_000),
};

export const AUTH_FORGOT_PASSWORD_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_FORGOT_PASSWORD_IP_MAX", 5),
  windowMs: positiveInt("RATE_LIMIT_AUTH_FORGOT_PASSWORD_IP_WINDOW_MS", 60_000),
};

export const AUTH_FORGOT_PASSWORD_IDENTITY_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_FORGOT_PASSWORD_IDENTITY_MAX", 3),
  windowMs: positiveInt(
    "RATE_LIMIT_AUTH_FORGOT_PASSWORD_IDENTITY_WINDOW_MS",
    60_000,
  ),
};

export const AUTH_RESET_PASSWORD_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_RESET_PASSWORD_IP_MAX", 10),
  windowMs: positiveInt("RATE_LIMIT_AUTH_RESET_PASSWORD_IP_WINDOW_MS", 60_000),
};

export const AUTH_VERIFY_EMAIL_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_VERIFY_EMAIL_IP_MAX", 20),
  windowMs: positiveInt("RATE_LIMIT_AUTH_VERIFY_EMAIL_IP_WINDOW_MS", 60_000),
};

export const AUTH_RESEND_VERIFICATION_IP_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_RESEND_VERIFICATION_IP_MAX", 5),
  windowMs: positiveInt(
    "RATE_LIMIT_AUTH_RESEND_VERIFICATION_IP_WINDOW_MS",
    60_000,
  ),
};

export const AUTH_RESEND_VERIFICATION_IDENTITY_LIMIT = {
  max: positiveInt("RATE_LIMIT_AUTH_RESEND_VERIFICATION_IDENTITY_MAX", 3),
  windowMs: positiveInt(
    "RATE_LIMIT_AUTH_RESEND_VERIFICATION_IDENTITY_WINDOW_MS",
    60_000,
  ),
};

export const RATE_LIMITED_MESSAGE =
  "Too many requests. Please try again shortly.";
