import Link from "next/link";
import { brand } from "@/lib/brand";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-[8px] bg-accent text-[11px] font-semibold tracking-wide text-white ${className}`}
      aria-hidden
    >
      N
    </span>
  );
}

export function Logo({
  href = "/",
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={brand.name}
      className="flex min-w-0 items-center gap-2 rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-2.5"
    >
      <LogoMark className="h-7 w-7 shrink-0" />
      <span
        className={`truncate text-[15px] font-semibold tracking-tight text-foreground ${compact ? "max-[360px]:hidden" : ""}`}
      >
        {brand.name}
      </span>
    </Link>
  );
}
