import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { PageShell } from "@/components/PageShell";
import { StatusCard } from "@/components/StatusCard";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This Northline page does not exist.",
};

export default function NotFound() {
  return (
    <main>
      <PageShell width="narrow">
        <StatusCard
          tone="warning"
          eyebrow="404"
          title="This page is not available"
        >
          <p className="text-[15px] leading-6 text-muted">
            The address may be mistyped, or the page was moved. Nothing was
            charged.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/" fullWidth>
              Return home
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
