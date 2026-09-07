import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import {
  ResendVerificationForm,
  VerifyEmailForm,
} from "@/components/VerifyEmailForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Confirm your Northline email address.",
  robots: { index: false, follow: false },
};

function tokenFromQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return value?.trim() ?? "";
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const token = tokenFromQuery(query.token);

  return (
    <main>
      <PageShell width="narrow">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Verify email
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          {token
            ? "Confirm this email address for your Northline account. Checkout still works without verification."
            : "Request a new verification email. We send a link only when the account still needs to be verified."}
        </p>
        {token ? <VerifyEmailForm token={token} /> : null}
        <div className={token ? "mt-10 border-t border-border pt-8" : undefined}>
          {token ? (
            <h2 className="text-sm font-medium text-foreground">
              Need a new link?
            </h2>
          ) : null}
          <ResendVerificationForm />
        </div>
        <p className="mt-6 text-sm text-muted">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Sign in
          </Link>
        </p>
      </PageShell>
    </main>
  );
}
