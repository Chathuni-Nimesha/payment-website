"use client";

import { Button } from "@/components/Button";
import { PageShell } from "@/components/PageShell";
import { StatusCard } from "@/components/StatusCard";

export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main>
      <PageShell width="narrow">
        <StatusCard
          tone="danger"
          eyebrow="Error"
          title="Something went wrong"
        >
          <p className="text-[15px] leading-6 text-muted">
            The page could not be loaded. Nothing was charged. You can try
            again, or return to checkout.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button type="button" fullWidth onClick={() => unstable_retry()}>
              Try again
            </Button>
            <Button href="/payment" variant="secondary" fullWidth>
              Open checkout
            </Button>
          </div>
        </StatusCard>
      </PageShell>
    </main>
  );
}
