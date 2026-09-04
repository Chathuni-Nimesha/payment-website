import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Northline terms template. Replace this copy with the client’s actual terms of service.",
};

export default function TermsPage() {
  return (
    <main>
      <LegalPage
        title="Terms"
        description="Placeholder terms for the Northline checkout product demo."
      >
        <LegalSection title="What this page is">
          <p>
            These terms are template copy. They should be replaced with the
            client’s actual terms before any live commercial use.
          </p>
        </LegalSection>
        <LegalSection title="The product">
          <p>
            Northline is a checkout interface that creates Stripe test-mode
            PaymentIntents and shows receipts after Stripe confirms status.
          </p>
        </LegalSection>
        <LegalSection title="No live processing">
          <p>
            This version does not accept live charges, create customer
            accounts, or operate a merchant of record.
          </p>
        </LegalSection>
        <LegalSection title="Availability">
          <p>
            Stripe test credentials are required for real test transactions.
            Missing credentials do not produce a fake successful payment.
          </p>
        </LegalSection>
      </LegalPage>
    </main>
  );
}
