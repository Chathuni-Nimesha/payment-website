import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { securityHeaders } from "./lib/security/headers";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    const headers = securityHeaders({ production });
    return [
      { source: "/", headers },
      { source: "/:path*", headers },
    ];
  },
};

export default nextConfig;
