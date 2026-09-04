import type { TransactionStatus } from "@/lib/transactions/types";

export function mapPaymentIntentStatus(
  status: string,
): TransactionStatus {
  switch (status) {
    case "succeeded":
      return "paid";
    case "processing":
    case "requires_action":
    case "requires_confirmation":
    case "requires_capture":
      return "processing";
    case "requires_payment_method":
    case "canceled":
      return "failed";
    default:
      return "pending";
  }
}
