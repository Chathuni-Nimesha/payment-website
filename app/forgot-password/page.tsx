import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { PageShell } from "@/components/PageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a Northline password reset link.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main>
      <PageShell width="narrow">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Forgot password
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          Enter the email for your account. If it is registered, we will send a
          reset link. Checkout does not require an account.
        </p>
        <ForgotPasswordForm />
        <p className="mt-6 text-sm text-muted">
          Remembered it?{" "}
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
