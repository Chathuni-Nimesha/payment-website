import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as failedMetadata } from "@/app/failed/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as successMetadata } from "@/app/success/page";

describe("receipt page indexing", () => {
  it("marks /success and /failed as noindex", () => {
    expect(successMetadata.robots).toEqual({ index: false, follow: false });
    expect(failedMetadata.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(successMetadata)).not.toMatch(/ref=|client_secret|sk_/i);
    expect(JSON.stringify(failedMetadata)).not.toMatch(/ref=|client_secret|sk_/i);
  });

  it("disallows receipt routes in robots.txt without blocking checkout", () => {
    const rules = robots();
    const disallow = Array.isArray(rules.rules)
      ? rules.rules[0]?.disallow
      : rules.rules.disallow;

    expect(disallow).toEqual(
      expect.arrayContaining(["/success", "/failed"]),
    );
    expect(disallow).not.toEqual(expect.arrayContaining(["/payment"]));
  });

  it("does not list receipt routes in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/success"))).toBe(false);
    expect(urls.some((url) => url.includes("/failed"))).toBe(false);
    expect(urls.some((url) => url.includes("/payment"))).toBe(true);
  });
});

describe("Stripe wallet CSP decision", () => {
  it("disables Apple Pay and Google Pay in Payment Element", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../components/StripePaymentStep.tsx"),
      "utf8",
    );

    expect(source).toContain('applePay: "never"');
    expect(source).toContain('googlePay: "never"');
    expect(source).not.toContain('applePay: "auto"');
    expect(source).not.toContain('googlePay: "auto"');
  });
});
