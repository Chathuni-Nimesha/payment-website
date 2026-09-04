import { HeaderNav } from "@/components/HeaderNav";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl min-w-0 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Logo compact />

        <div className="flex shrink-0 items-center gap-2 sm:gap-5">
          <span
            className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted sm:px-2.5"
            aria-label="Test mode"
          >
            <span className="sm:hidden" aria-hidden>
              Test
            </span>
            <span className="hidden sm:inline">Test mode</span>
          </span>
          <HeaderNav />
        </div>
      </div>
    </header>
  );
}
