import { formatMoney, parseAmount } from "@/lib/money";

type PaymentSummaryProps = {
  amountMajor: string;
  currency: string;
  email: string;
  reference?: string | null;
};

export function PaymentSummary({
  amountMajor,
  currency,
  email,
  reference,
}: PaymentSummaryProps) {
  const parsed = parseAmount(amountMajor, currency);
  const displayAmount = parsed.ok
    ? formatMoney(parsed.major, currency)
    : "—";

  return (
    <aside className="rounded-[12px] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-sm font-medium text-muted">Payment summary</h2>
      <p className="mt-4 max-w-full text-[1.75rem] leading-none font-semibold tracking-tight text-foreground break-words tabular-nums sm:text-[2rem]">
        {displayAmount}
      </p>
      <p className="mt-2 text-sm text-muted">{currency}</p>

      <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
        <SummaryRow label="Customer" value={email.trim() || "Not provided"} />
        {reference ? (
          <SummaryRow label="Reference" value={reference} mono />
        ) : null}
        <SummaryRow label="Mode" value="Stripe test mode" />
      </dl>

      <p className="mt-5 text-sm leading-6 text-muted">
        Card details are entered in Stripe’s Payment Element. Northline does
        not store card numbers, expiry dates, or CVV.
      </p>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`max-w-[62%] text-right text-foreground break-words ${mono ? "font-mono text-[13px]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
