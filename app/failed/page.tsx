import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ReceiptActions, ReceiptDetails } from "@/components/ReceiptDetails";
import { StatusCard } from "@/components/StatusCard";
import { firstQueryValue, resolveReceipt } from "@/lib/payments/receipt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment unsuccessful",
  description: "The Northline payment was not completed.",
};

export default async function FailedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const reference = firstQueryValue(query.ref);
  const receipt = reference ? await resolveReceipt(reference) : null;
  const verified = Boolean(receipt?.verifiedWithStripe);

  if (receipt && verified && receipt.status === "paid") {
    redirect(`/success?ref=${encodeURIComponent(receipt.reference)}`);
  }

  if (
    receipt &&
    verified &&
    (receipt.status === "processing" || receipt.status === "pending")
  ) {
    redirect(`/success?ref=${encodeURIComponent(receipt.reference)}`);
  }

  const declined = Boolean(receipt && verified && receipt.status === "failed");
  const unconfirmed = Boolean(receipt && !verified);

  return (
    <main>
      <PageShell width="narrow">
        <StatusCard
          tone={unconfirmed ? "warning" : "danger"}
          eyebrow="Test mode"
          title={
            declined
              ? "The payment did not go through"
              : unconfirmed
                ? "Payment could not be confirmed"
                : "Payment receipt unavailable"
          }
        >
          <p className="text-[15px] leading-6 text-muted">
            {declined
              ? "The payment method could not be completed. No live charge was made. You can try again with another test card."
              : unconfirmed
                ? "Stripe could not confirm this payment. Northline does not report a decline or a successful charge without Stripe. Real Stripe test transactions require valid test credentials."
                : "Open this page from checkout after a failed attempt. Amounts in the URL are ignored, and no live charge was made."}
          </p>

          {receipt ? (
            <div className="mt-6">
              <ReceiptDetails record={receipt} />
            </div>
          ) : null}

          <ReceiptActions
            primaryHref="/payment"
            primaryLabel="Retry payment"
          />
        </StatusCard>
      </PageShell>
    </main>
  );
}
