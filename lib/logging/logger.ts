import "server-only";

export type LogLevel = "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

const SENSITIVE_KEY =
  /password|passwd|token|cookie|authorization|secret|client_secret|card|pan|cvv|cvc|expiry|database_url|connectionstring|session|nl_session/i;

const SECRET_VALUE =
  /sk_live_|sk_test_|pk_live_|pk_test_|whsec_|postgres(ql)?:\/\/|client_secret|pi_[a-zA-Z0-9]+_secret/i;

const REDACTED = "[redacted]";

function maskEmail(value: string) {
  const at = value.indexOf("@");
  if (at < 1 || at === value.length - 1) {
    return REDACTED;
  }

  return `${value[0]}***${value.slice(at)}`;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function redactValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    if (SECRET_VALUE.test(value) || looksLikeEmail(value)) {
      return looksLikeEmail(value) && !SECRET_VALUE.test(value)
        ? maskEmail(value)
        : REDACTED;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(nested);
    }
    return output;
  }

  return value;
}

export function formatLogLine(
  level: LogLevel,
  event: string,
  meta?: LogMeta,
): string {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = redactValue(meta);
  }

  return JSON.stringify(payload);
}

function write(level: LogLevel, event: string, meta?: LogMeta) {
  const line = formatLogLine(level, event, meta);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info(event: string, meta?: LogMeta) {
    write("info", event, meta);
  },
  warn(event: string, meta?: LogMeta) {
    write("warn", event, meta);
  },
  error(event: string, meta?: LogMeta) {
    write("error", event, meta);
  },
};
