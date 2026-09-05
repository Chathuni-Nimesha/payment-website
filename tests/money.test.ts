import { describe, expect, it } from "vitest";
import {
  currencies,
  DEFAULT_CURRENCY,
  getCurrency,
  isCurrencyCode,
} from "@/lib/currencies";
import {
  formatMoney,
  getFractionDigits,
  majorFromMinor,
  MAX_AMOUNT_MAJOR,
  parseAmount,
} from "@/lib/money";

describe("parseAmount", () => {
  it("parses a two-decimal amount into minor units", () => {
    expect(parseAmount("25.00", "USD")).toEqual({
      ok: true,
      major: "25.00",
      minor: 2500,
    });
  });

  it("pads a whole-dollar amount to two decimal places", () => {
    expect(parseAmount("25", "USD")).toEqual({
      ok: true,
      major: "25.00",
      minor: 2500,
    });
  });

  it("converts JPY without decimals", () => {
    expect(parseAmount("1000", "JPY")).toEqual({
      ok: true,
      major: "1000",
      minor: 1000,
    });
  });

  it("rejects JPY amounts with decimals", () => {
    expect(parseAmount("1000.5", "JPY")).toEqual({
      ok: false,
      error: "JPY amounts cannot include decimals.",
    });
  });

  it("rejects more than two decimal places for USD", () => {
    expect(parseAmount("25.123", "USD")).toEqual({
      ok: false,
      error: "Use up to 2 decimal places.",
    });
  });

  it("rejects an empty amount", () => {
    expect(parseAmount("   ", "USD")).toEqual({
      ok: false,
      error: "Enter an amount.",
    });
  });

  it("rejects commas, spaces, and plus signs", () => {
    expect(parseAmount("1,000", "USD").ok).toBe(false);
    expect(parseAmount("10 00", "USD").ok).toBe(false);
    expect(parseAmount("+10", "USD").ok).toBe(false);
  });

  it("rejects zero and leading-dot amounts", () => {
    expect(parseAmount("0.00", "USD")).toEqual({
      ok: false,
      error: "Amount must be greater than zero.",
    });
    expect(parseAmount(".50", "USD").ok).toBe(false);
  });

  it("rejects amounts above the configured maximum", () => {
    expect(parseAmount(String(MAX_AMOUNT_MAJOR + 1), "USD")).toEqual({
      ok: false,
      error: "Amount exceeds the maximum of 1,000,000.",
    });
  });

  it("accepts the maximum major amount", () => {
    expect(parseAmount("1000000", "USD")).toEqual({
      ok: true,
      major: "1000000.00",
      minor: 100000000,
    });
  });
});

describe("minor unit conversion", () => {
  it("converts minor units back to a major string", () => {
    expect(majorFromMinor(2500, "USD")).toBe("25.00");
    expect(majorFromMinor(99, "USD")).toBe("0.99");
    expect(majorFromMinor(1000, "JPY")).toBe("1000");
  });

  it("uses two fraction digits for unknown currencies", () => {
    expect(getFractionDigits("XYZ")).toBe(2);
  });
});

describe("currencies", () => {
  it("lists the supported checkout currencies", () => {
    expect(currencies.map((item) => item.code)).toEqual([
      "USD",
      "EUR",
      "GBP",
      "LKR",
      "JPY",
      "AUD",
      "CAD",
      "SGD",
      "AED",
      "INR",
    ]);
    expect(DEFAULT_CURRENCY).toBe("USD");
  });

  it("accepts supported codes and rejects others", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("usd")).toBe(false);
    expect(isCurrencyCode("XYZ")).toBe(false);
    expect(getCurrency("JPY")?.fractionDigits).toBe(0);
    expect(getCurrency("XYZ")).toBeUndefined();
  });
});

describe("formatMoney", () => {
  it("formats a USD amount", () => {
    expect(formatMoney("25.00", "USD")).toBe("$25.00");
  });

  it("returns a fallback when the major amount is not finite", () => {
    expect(formatMoney("not-a-number", "USD")).toBe("not-a-number USD");
  });
});
