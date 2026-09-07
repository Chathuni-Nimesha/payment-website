import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Northline account.",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
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
          Create an account
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          This stores only your email and a password hash. It does not store
          card details or create a live merchant account.
        </p>
        <AuthForm mode="register" />
        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
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
