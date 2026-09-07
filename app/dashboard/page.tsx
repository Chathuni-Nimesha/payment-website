import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { PaymentHistory } from "@/components/PaymentHistory";
import { PageShell } from "@/components/PageShell";
import { ResendVerificationForm } from "@/components/VerifyEmailForm";
import { requireUser } from "@/lib/auth/session";
import {
  parsePage,
  PAYMENTS_DEFAULT_PAGE_SIZE,
  toPublicPayment,
} from "@/lib/payments/history";
import { transactionStore } from "@/lib/transactions/store";
import type { TransactionList } from "@/lib/transactions/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payments",
  description: "Your Northline test-mode payment history.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[] }>;
} = {}) {
  const user = await requireUser();
  const query = (await searchParams) ?? {};
  const page = parsePage(query.page);
  let history: TransactionList | null = null;

  try {
    history = await transactionStore.listByUser(user.id, {
      page,
      pageSize: PAYMENTS_DEFAULT_PAGE_SIZE,
    });
  } catch {
    history = null;
  }

  return (
    <main>
      <PageShell>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Payments
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">
          Signed in as{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
          This list is your test-mode payment history. Receipts are confirmed
          with Stripe, not from this page alone.
        </p>
        {user.emailVerified ? null : (
          <div className="mt-6 max-w-xl">
            <Notice tone="warning" role="status">
              Confirm your email to finish setting up this account. Checkout
              still works while it is unverified.
            </Notice>
            <ResendVerificationForm defaultEmail={user.email} />
          </div>
        )}
        <div className="mt-6">
          <Button href="/payment">Make a payment</Button>
        </div>
        {history ? (
          <PaymentHistory
            payments={history.items.map(toPublicPayment)}
            total={history.total}
            page={history.page}
            pageSize={history.pageSize}
          />
        ) : (
          <div className="mt-10">
            <Notice tone="danger" role="alert">
              Payment history could not be loaded. Please try again.
            </Notice>
          </div>
        )}
      </PageShell>
    </main>
  );
}
