export { SESSION_COOKIE_NAME, sessionCookieOptions } from "./cookie";
export { isTrustedOriginRequest } from "./csrf";
export {
  AUTH_DUPLICATE_EMAIL,
  AUTH_INVALID_CREDENTIALS,
  AUTH_INVALID_INPUT,
  AUTH_REQUEST_UNVERIFIED,
  AUTH_UNAUTHENTICATED,
  AUTH_UNAVAILABLE,
  AUTH_ALREADY_VERIFIED,
  AUTH_RECOVERY_SENT,
  AUTH_RESET_COMPLETE,
  AUTH_RESET_INVALID,
  AUTH_VERIFY_CONFIRMED,
  AUTH_VERIFY_INVALID,
  AUTH_VERIFY_SENT,
} from "./messages";
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "./validation";
export {
  createSession,
  deleteSession,
} from "./store";
export {
  getCurrentUser,
  requireApiUser,
  requireUser,
} from "./session";
export type { AuthFieldErrors, AuthUser } from "./types";
export { normalizeEmail, validateAuthCredentials } from "./validation";
