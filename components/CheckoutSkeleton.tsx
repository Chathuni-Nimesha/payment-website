import { Spinner } from "@/components/Spinner";

export function CheckoutSkeleton() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="rounded-[12px] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="skeleton-pulse h-7 w-36 rounded-[8px] bg-border" />
        <div className="skeleton-pulse mt-3 h-4 w-56 rounded-[8px] bg-border" />
        <div className="mt-8 space-y-4">
          <div className="skeleton-pulse h-11 w-full rounded-[8px] bg-border" />
          <div className="skeleton-pulse h-11 w-full rounded-[8px] bg-border" />
          <div className="skeleton-pulse h-28 w-full rounded-[8px] bg-border" />
        </div>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 border-muted/40 border-t-muted" />
          Preparing checkout...
        </p>
      </div>
      <div className="rounded-[12px] border border-border bg-surface p-5 sm:p-6">
        <div className="skeleton-pulse h-4 w-28 rounded-[8px] bg-border" />
        <div className="skeleton-pulse mt-4 h-10 w-40 rounded-[8px] bg-border" />
        <div className="skeleton-pulse mt-8 h-24 w-full rounded-[8px] bg-border" />
      </div>
    </div>
  );
}
