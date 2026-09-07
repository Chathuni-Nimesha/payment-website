import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Northline account.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main>
      <PageShell width="narrow">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Account
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Sign in
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          Use the email and password for your Northline account. Checkout does
          not require an account.
        </p>
        <AuthForm mode="login" />
        <p className="mt-4 text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Forgot password?
          </Link>
        </p>
        <p className="mt-6 text-sm text-muted">
          Need an account?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create one
          </Link>
        </p>
      </PageShell>
    </main>
  );
}
