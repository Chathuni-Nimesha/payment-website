import { getCurrency } from "./currencies";

export const MAX_AMOUNT_MAJOR = 1_000_000;

export type ParsedAmount =
  | { ok: true; major: string; minor: number }
  | { ok: false; error: string };

export function getFractionDigits(currencyCode: string): number {
  return getCurrency(currencyCode)?.fractionDigits ?? 2;
}

export function parseAmount(
  raw: string,
  currencyCode: string,
): ParsedAmount {
  const value = raw.trim();

  if (!value) {
    return { ok: false, error: "Enter an amount." };
  }

  if (/[eE+\s,]/.test(value)) {
    return { ok: false, error: "Enter a valid numeric amount." };
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return { ok: false, error: "Enter a valid numeric amount." };
  }

  const digits = getFractionDigits(currencyCode);
  const [, fraction = ""] = value.split(".");

  if (digits === 0 && fraction.length > 0) {
    return {
      ok: false,
      error: `${currencyCode} amounts cannot include decimals.`,
    };
  }

  if (fraction.length > digits) {
    return {
      ok: false,
      error: `Use up to ${digits} decimal ${digits === 1 ? "place" : "places"}.`,
    };
  }

  const minor = toMinorUnits(value, digits);

  if (minor <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const maxMinor = MAX_AMOUNT_MAJOR * 10 ** digits;
  if (minor > maxMinor) {
    return { ok: false, error: "Amount exceeds the maximum of 1,000,000." };
  }

  return { ok: true, major: fromMinorUnits(minor, digits), minor };
}

export function formatMoney(major: string, currencyCode: string): string {
  const digits = getFractionDigits(currencyCode);
  const amount = Number(major);

  if (!Number.isFinite(amount)) {
    return `${major} ${currencyCode}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

function toMinorUnits(major: string, digits: number): number {
  const [whole, fraction = ""] = major.split(".");
  const paddedFraction = fraction.padEnd(digits, "0").slice(0, digits);
  return Number(whole) * 10 ** digits + (digits === 0 ? 0 : Number(paddedFraction));
}

export function majorFromMinor(minor: number, currencyCode: string): string {
  return fromMinorUnits(minor, getFractionDigits(currencyCode));
}

function fromMinorUnits(minor: number, digits: number): string {
  if (digits === 0) {
    return String(minor);
  }

  const padded = String(minor).padStart(digits + 1, "0");
  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
}
