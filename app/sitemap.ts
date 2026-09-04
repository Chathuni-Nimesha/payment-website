import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    "",
    "/payment",
    "/privacy",
    "/terms",
    "/refund",
    "/support",
  ].map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: path === "/payment" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
