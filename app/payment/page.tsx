import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Northline checkout. Stripe test mode — live cards are not charged.",
};

export default function PaymentPage() {
  return (
    <main>
      <PageShell>
        <CheckoutForm />
      </PageShell>
    </main>
  );
}
