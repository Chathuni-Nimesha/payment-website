"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export function HeaderNav({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const onCheckout = pathname === "/payment";
  const onPayments = pathname === "/dashboard";
  const onLogin =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email";
  const signedIn = Boolean(email);

  const linkClass = (active: boolean) =>
    [
      "whitespace-nowrap text-sm font-medium transition-colors duration-150",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      active ? "text-accent" : "text-foreground hover:text-accent",
    ].join(" ");

  if (signedIn) {
    return (
      <nav
        aria-label="Primary"
        className="flex min-w-0 items-center gap-2 sm:gap-4"
      >
        <Link
          href="/dashboard"
          aria-current={onPayments ? "page" : undefined}
          className={linkClass(onPayments)}
        >
          Payments
        </Link>
        <Link
          href="/payment"
          aria-current={onCheckout ? "page" : undefined}
          className={linkClass(onCheckout)}
        >
          Checkout
        </Link>
        <span
          className="hidden max-w-[9rem] truncate text-sm text-muted sm:inline"
          title={email ?? undefined}
        >
          {email}
        </span>
        <LogoutButton compact />
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className="flex items-center gap-3 sm:gap-5">
      <Link
        href="/payment"
        aria-current={onCheckout ? "page" : undefined}
        className={linkClass(onCheckout)}
      >
        Checkout
      </Link>
      <Link
        href="/login"
        aria-current={onLogin ? "page" : undefined}
        className={linkClass(onLogin)}
      >
        Sign in
      </Link>
    </nav>
  );
}
