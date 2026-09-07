"use client";

import { Button } from "@/components/Button";
import { PageShell } from "@/components/PageShell";
import { StatusCard } from "@/components/StatusCard";

export default function DashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main>
      <PageShell>
        <StatusCard
          tone="danger"
          eyebrow="Payments"
          title="Payment history could not be loaded"
        >
          <p className="text-[15px] leading-6 text-muted">
            Your account is still signed in. Nothing was charged. Try again, or
            continue to checkout.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={() => unstable_retry()}>
              Try again
            </Button>
            <Button href="/payment" variant="secondary">
              Make a payment
            </Button>
          </div>
        </StatusCard>
      </PageShell>
    </main>
  );
}
