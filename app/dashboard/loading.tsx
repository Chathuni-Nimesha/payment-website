import { PageShell } from "@/components/PageShell";

export default function DashboardLoading() {
  return (
    <main>
      <PageShell>
        <div className="animate-pulse space-y-4" aria-hidden>
          <div className="h-3 w-16 rounded bg-border" />
          <div className="h-8 w-40 rounded bg-border" />
          <div className="h-4 w-72 max-w-full rounded bg-border" />
          <div className="mt-8 h-24 rounded-[12px] border border-border bg-surface" />
          <div className="h-24 rounded-[12px] border border-border bg-surface" />
        </div>
        <p className="sr-only">Loading payment history</p>
      </PageShell>
    </main>
  );
}
