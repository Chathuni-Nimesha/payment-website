import { describe, expect, it } from "vitest";
import {
  validateCheckoutFields,
  validateOptionalEmail,
} from "@/lib/validation";

describe("validateCheckoutFields", () => {
  it("accepts a valid amount, currency, and email", () => {
    const result = validateCheckoutFields({
      amount: "25.00",
      currency: "USD",
      email: "client@example.com",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        amountMajor: "25.00",
        currency: "USD",
        email: "client@example.com",
      },
    });
  });

  it("normalizes currency case and email whitespace", () => {
    const result = validateCheckoutFields({
      amount: "10",
      currency: " usd ",
      email: "  client@example.com  ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        amountMajor: "10.00",
        currency: "USD",
        email: "client@example.com",
      },
    });
  });

  it("rejects a zero amount", () => {
    const result = validateCheckoutFields({
      amount: "0",
      currency: "USD",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.amount).toBe("Amount must be greater than zero.");
    }
  });

  it("rejects a negative amount", () => {
    const result = validateCheckoutFields({
      amount: "-10",
      currency: "USD",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.amount).toBe("Enter a valid numeric amount.");
    }
  });

  it("rejects a non-numeric amount", () => {
    const result = validateCheckoutFields({
      amount: "twelve",
      currency: "USD",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.amount).toBe("Enter a valid numeric amount.");
    }
  });

  it("rejects an amount above the maximum", () => {
    const result = validateCheckoutFields({
      amount: "1000000.01",
      currency: "USD",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.amount).toBe(
        "Amount exceeds the maximum of 1,000,000.",
      );
    }
  });

  it("accepts a supported currency", () => {
    const result = validateCheckoutFields({
      amount: "100",
      currency: "JPY",
      email: "",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currency).toBe("JPY");
    }
  });

  it("rejects an unsupported currency", () => {
    const result = validateCheckoutFields({
      amount: "25.00",
      currency: "XYZ",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.currency).toBe("Select a supported currency.");
    }
  });

  it("rejects an empty currency", () => {
    const result = validateCheckoutFields({
      amount: "25.00",
      currency: "",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.currency).toBe("Select a currency.");
    }
  });

  it("accepts a valid email", () => {
    expect(validateOptionalEmail("owner@northline.test")).toBeUndefined();
  });

  it("rejects an invalid email", () => {
    const result = validateCheckoutFields({
      amount: "25.00",
      currency: "USD",
      email: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBe("Enter a valid email address.");
    }
  });

  it("allows an empty optional email", () => {
    const result = validateCheckoutFields({
      amount: "25.00",
      currency: "USD",
      email: "",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        amountMajor: "25.00",
        currency: "USD",
        email: "",
      },
    });
  });

  it("rejects malformed scientific-notation amounts", () => {
    const result = validateCheckoutFields({
      amount: "1e3",
      currency: "USD",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.amount).toBe("Enter a valid numeric amount.");
    }
  });

  it("rejects an email longer than 254 characters", () => {
    const local = "a".repeat(250);
    expect(validateOptionalEmail(`${local}@x.com`)).toBe(
      "Enter a shorter email address.",
    );
  });
});
