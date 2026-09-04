import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Northline support for this product demo. There is no live merchant support desk.",
};

export default function SupportPage() {
  return (
    <main>
      <PageShell width="narrow">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Support
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          How to get help
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          Northline is a product demo. It does not operate a live merchant
          support desk, phone line, or ticket system.
        </p>
        <div className="mt-8 space-y-5 text-[15px] leading-7 text-muted">
          <p>
            For implementation questions, contact the developer who provided
            this checkout.
          </p>
          <p>
            Payment method issues in test mode are handled by Stripe’s Payment
            Element. Northline does not see card numbers.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href="/payment" fullWidth>
            Open checkout
          </Button>
          <Button href="/" variant="secondary" fullWidth>
            Return home
          </Button>
        </div>
      </PageShell>
    </main>
  );
}
