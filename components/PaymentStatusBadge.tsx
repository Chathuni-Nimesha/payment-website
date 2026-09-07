import type { TransactionStatus } from "@/lib/transactions/types";

const STATUS_CLASS: Record<TransactionStatus, string> = {
  paid: "border-success/20 bg-success-soft text-success",
  processing: "border-processing/20 bg-processing-soft text-processing",
  failed: "border-danger/20 bg-danger-soft text-danger",
  pending: "border-border bg-background text-muted",
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  paid: "Paid",
  processing: "Processing",
  failed: "Failed",
  pending: "Pending",
};

export function PaymentStatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
