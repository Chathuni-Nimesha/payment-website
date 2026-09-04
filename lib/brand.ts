export const brand = {
  name: "Northline",
  tagline: "Checkout for independent businesses",
  description:
    "Northline is a professional payment checkout for freelance products and client work. This version uses Stripe test mode and does not take live charges.",
  shortDescription:
    "A focused checkout for invoices, retainers, and client work.",
} as const;

export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : "http://localhost:3000";
}
