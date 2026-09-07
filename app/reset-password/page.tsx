import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/Notice";
import { PageShell } from "@/components/PageShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new Northline password.",
  robots: { index: false, follow: false },
};

function tokenFromQuery(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return value?.trim() ?? "";
}

export default async function ResetPasswordPage({
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
          Reset password
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">
          Choose a new password. After it is saved you will need to sign in
          again.
        </p>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="mt-8">
            <Notice tone="danger" role="alert">
              This reset link is missing. Request a new one from the forgot
              password page.
            </Notice>
          </div>
        )}
        <p className="mt-6 text-sm text-muted">
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Request a new reset link
          </Link>
        </p>
      </PageShell>
    </main>
  );
}
