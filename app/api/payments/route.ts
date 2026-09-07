import { requireApiUser } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { parsePage, parsePageSize, toPublicPayment } from "@/lib/payments/history";
import { transactionStore } from "@/lib/transactions/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));

  try {
    const result = await transactionStore.listByUser(auth.user.id, {
      page,
      pageSize,
    });

    return Response.json({
      transactions: result.items.map(toPublicPayment),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  } catch {
    logger.error("payments.history_unavailable");
    return Response.json(
      { error: "Payment history could not be loaded. Please try again." },
      { status: 503 },
    );
  }
}
