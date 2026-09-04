import type { ReactNode } from "react";
import { Notice } from "@/components/Notice";
import { PageShell } from "@/components/PageShell";

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageShell width="narrow">
      <article>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          Template
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-muted">{description}</p>
        <div className="mt-5">
          <Notice tone="warning">
            This is placeholder copy for the Northline product demo. Replace it
            with the client’s actual legal terms before any live use. It does
            not describe a registered company, address, or certification.
          </Notice>
        </div>
        <div className="mt-8 space-y-6 text-[15px] leading-7 text-muted">
          {children}
        </div>
      </article>
    </PageShell>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
