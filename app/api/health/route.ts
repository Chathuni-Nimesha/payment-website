import "server-only";

import { getPool, readDatabaseUrl } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export const runtime = "nodejs";

export async function GET() {
  if (!readDatabaseUrl()) {
    logger.error("health.database_unavailable");
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await getPool().query("SELECT 1");
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    logger.error("health.database_unavailable");
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
