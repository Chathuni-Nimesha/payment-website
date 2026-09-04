import { Button } from "@/components/Button";
import { formatMoney } from "@/lib/money";
import type { TransactionStatus } from "@/lib/transactions/types";

export type ReceiptRecord = {
  reference: string;
  amountMajor: string;
  currency: string;
  email: string;
  createdAt: string;
  status: TransactionStatus;
  verifiedWithStripe?: boolean;
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
};

export function ReceiptDetails({ record }: { record: ReceiptRecord }) {
  const created = new Date(record.createdAt);
  const confirmed = record.verifiedWithStripe !== false;
  const amount = formatMoney(record.amountMajor, record.currency);
  const statusValue = confirmed
    ? STATUS_LABEL[record.status]
    : "Not confirmed";

  return (
    <div>
      <p className="max-w-full text-[1.5rem] font-semibold tracking-tight text-foreground break-words tabular-nums sm:text-[1.75rem]">
        {amount}
      </p>
      <p className="mt-1 text-sm text-muted">{record.currency}</p>

      <dl className="mt-6 divide-y divide-border border-y border-border">
        <ReceiptRow label="Status" value={statusValue} />
        <ReceiptRow label="Reference" value={record.reference} mono />
        <ReceiptRow
          label="Date"
          value={new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(created)}
        />
        <ReceiptRow label="Email" value={record.email || "Not provided"} />
      </dl>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={`text-sm font-medium text-foreground break-all sm:text-right ${mono ? "font-mono text-[13px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function ReceiptActions({
  primaryHref = "/payment",
  primaryLabel = "Make another payment",
}: {
  primaryHref?: string;
  primaryLabel?: string;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Button href={primaryHref} fullWidth>
        {primaryLabel}
      </Button>
      <Button href="/" variant="secondary" fullWidth>
        Return home
      </Button>
    </div>
  );
}
