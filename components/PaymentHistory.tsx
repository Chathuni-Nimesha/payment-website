import Link from "next/link";
import { Button } from "@/components/Button";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";
import { formatMoney } from "@/lib/money";
import type { PublicPayment } from "@/lib/transactions/types";

export function PaymentHistory({
  payments,
  total,
  page,
  pageSize,
}: {
  payments: PublicPayment[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <section className="mt-10" aria-labelledby="payment-history-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="payment-history-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Payment history
          </h2>
          <p className="mt-1 text-sm text-muted">
            {total === 0
              ? "No payments yet"
              : `${total} ${total === 1 ? "payment" : "payments"}`}
          </p>
        </div>
        {total > 0 ? (
          <p className="text-sm text-muted">
            Showing {from}–{to}
          </p>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <div className="mt-6 rounded-[12px] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <p className="text-[15px] leading-6 text-muted">
            No payments yet. Guest checkout stays available, and signed-in
            payments will appear here.
          </p>
          <div className="mt-6">
            <Button href="/payment">Make a payment</Button>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {payments.map((payment) => (
            <li key={payment.id}>
              <article className="rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-tight text-foreground tabular-nums">
                      {formatMoney(payment.amountMajor, payment.currency)}
                    </p>
                    <p className="mt-1 text-sm text-muted">{payment.currency}</p>
                    <p className="mt-3 font-mono text-[13px] break-all text-muted">
                      {payment.reference}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(payment.createdAt))}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <PaymentStatusBadge status={payment.status} />
                    <Link
                      href={`/success?ref=${encodeURIComponent(payment.reference)}`}
                      className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      View receipt
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Payment history pages"
          className="mt-6 flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Button href={`/dashboard?page=${page - 1}`} variant="secondary">
              Previous
            </Button>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted">
            Page {page} of {pageCount}
          </p>
          {page < pageCount ? (
            <Button href={`/dashboard?page=${page + 1}`} variant="secondary">
              Next
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
