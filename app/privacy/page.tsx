import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Northline privacy template. Replace this copy with the client’s actual privacy policy.",
};

export default function PrivacyPage() {
  return (
    <main>
      <LegalPage
        title="Privacy"
        description="How Northline describes payment data handling in this product demo."
      >
        <LegalSection title="What this page is">
          <p>
            This is a template for a future client privacy policy. It is not a
            binding privacy statement for a live merchant.
          </p>
        </LegalSection>
        <LegalSection title="Payment details">
          <p>
            Card numbers, expiry dates, and CVV are entered in Stripe’s
            Payment Element. Northline does not store raw card data.
          </p>
        </LegalSection>
        <LegalSection title="Checkout details">
          <p>
            Amount, currency, optional email, payment status, and Stripe
            PaymentIntent identifiers may be stored so a receipt can be shown.
            Email is optional and used only on the receipt if provided.
          </p>
        </LegalSection>
        <LegalSection title="Test mode">
          <p>
            This application uses Stripe test mode. It does not operate a live
            production payment service.
          </p>
        </LegalSection>
      </LegalPage>
    </main>
  );
}
