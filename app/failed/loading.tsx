import { PageShell } from "@/components/PageShell";

export default function FailedLoading() {
  return (
    <main>
      <PageShell width="narrow">
        <div className="rounded-[12px] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="skeleton-pulse h-12 w-12 rounded-full bg-border" />
          <div className="skeleton-pulse mt-5 h-4 w-20 rounded-[8px] bg-border" />
          <div className="skeleton-pulse mt-3 h-8 w-64 rounded-[8px] bg-border" />
          <p className="mt-5 text-sm text-muted">Loading payment status...</p>
        </div>
      </PageShell>
    </main>
  );
}
