import { CheckoutSkeleton } from "@/components/CheckoutSkeleton";
import { PageShell } from "@/components/PageShell";

export default function PaymentLoading() {
  return (
    <main>
      <PageShell>
        <CheckoutSkeleton />
      </PageShell>
    </main>
  );
}
