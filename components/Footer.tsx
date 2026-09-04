import Link from "next/link";
import { Logo } from "@/components/Logo";
import { brand } from "@/lib/brand";

const productLinks = [
  { href: "/payment", label: "Checkout" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/support", label: "Support" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refund Policy" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))]">
        <div className="min-w-0 max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-muted">
            {brand.shortDescription} Payments are collected through Stripe’s
            Payment Element in test mode.
          </p>
        </div>

        <nav aria-label="Product">
          <p className="text-sm font-medium text-foreground">Product</p>
          <ul className="mt-3 space-y-2">
            {productLinks.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <p className="text-sm font-medium text-foreground">Legal</p>
          <ul className="mt-3 space-y-2">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {brand.name}. Stripe test-mode
            checkout — not a live merchant account.
          </p>
          <p>Card details are handled by Stripe.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
