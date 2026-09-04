import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ReceiptActions, ReceiptDetails } from "@/components/ReceiptDetails";
import { StatusCard } from "@/components/StatusCard";
import { ClearCheckoutSession } from "@/components/ClearCheckoutSession";
import { firstQueryValue, resolveReceipt } from "@/lib/payments/receipt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment receipt",
  description:
    "Northline payment receipt. Paid status is only shown after Stripe confirms the PaymentIntent.",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const reference = firstQueryValue(query.ref);
  const receipt = reference ? await resolveReceipt(reference) : null;
  const verified = Boolean(receipt?.verifiedWithStripe);

  if (receipt && verified && receipt.status === "failed") {
    redirect(`/failed?ref=${encodeURIComponent(receipt.reference)}`);
  }

  const isPaid = Boolean(receipt && verified && receipt.status === "paid");
  const isProcessing = Boolean(
    receipt &&
      verified &&
      (receipt.status === "processing" || receipt.status === "pending"),
  );
  const unconfirmed = Boolean(receipt && !verified);

  return (
    <main>
      <PageShell width="narrow">
        <StatusCard
          tone={
            isPaid
              ? "success"
              : isProcessing
                ? "processing"
                : unconfirmed
                  ? "warning"
                  : "danger"
          }
          eyebrow="Test mode"
          title={
            isPaid
              ? "Payment successful"
              : isProcessing
                ? "Payment is processing"
                : unconfirmed
                  ? "Payment could not be confirmed"
                  : "Payment receipt unavailable"
          }
        >
          <p className="text-[15px] leading-6 text-muted">
            {isPaid
              ? "Stripe confirmed this test-mode payment. This page does not treat the browser redirect as proof of payment."
              : isProcessing
                ? "Stripe is still confirming this payment. Refresh this page in a moment. It is not shown as failed."
                : unconfirmed
                  ? "Stripe could not confirm this payment. Northline does not treat a browser redirect or a local record as proof of payment. Real Stripe test transactions require valid test credentials."
                  : "Open this page from checkout after paying. Amounts in the URL are ignored."}
          </p>

          {isPaid || isProcessing ? <ClearCheckoutSession /> : null}

          {receipt ? (
            <div className="mt-6">
              <ReceiptDetails record={receipt} />
            </div>
          ) : null}

          <ReceiptActions />
        </StatusCard>
      </PageShell>
    </main>
  );
}
