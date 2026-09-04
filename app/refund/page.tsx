import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Northline refund policy template. Replace this copy with the client’s actual refund terms.",
};

export default function RefundPage() {
  return (
    <main>
      <LegalPage
        title="Refund Policy"
        description="Placeholder refund language for the Northline product demo."
      >
        <LegalSection title="What this page is">
          <p>
            This is template copy. A live business should replace it with its
            own refund rules, timelines, and contact process.
          </p>
        </LegalSection>
        <LegalSection title="This demo">
          <p>
            Northline does not currently provide a refund dashboard or
            automated refunds. Test-mode payments are not live charges.
          </p>
        </LegalSection>
        <LegalSection title="If a client deploys this checkout">
          <p>
            Refunds, if offered, should be handled through the client’s Stripe
            account and written policy. Do not treat this page as a promise to
            refund.
          </p>
        </LegalSection>
      </LegalPage>
    </main>
  );
}
