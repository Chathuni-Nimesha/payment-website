"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNav() {
  const pathname = usePathname();
  const onCheckout = pathname === "/payment";

  return (
    <Link
      href="/payment"
      aria-current={onCheckout ? "page" : undefined}
      className={[
        "whitespace-nowrap text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        onCheckout ? "text-accent" : "text-foreground hover:text-accent",
      ].join(" ")}
    >
      Checkout
    </Link>
  );
}
