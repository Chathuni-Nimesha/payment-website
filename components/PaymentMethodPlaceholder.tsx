export function PaymentMethodPlaceholder() {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-background px-4 py-5">
      <p className="text-sm font-medium text-foreground">Payment method</p>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
        Continue to open Stripe’s secure payment form. Northline never
        collects card numbers, expiry dates, or CVV.
      </p>
    </div>
  );
}
