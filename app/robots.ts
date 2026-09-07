import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api/auth/",
        "/success",
        "/failed",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
