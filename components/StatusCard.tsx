import type { ReactNode } from "react";
import { StatusIcon } from "@/components/StatusIcon";

type StatusTone = "success" | "danger" | "warning" | "processing";

type StatusCardProps = {
  tone: StatusTone;
  eyebrow: string;
  title: string;
  children: ReactNode;
};

const eyebrowClass: Record<StatusTone, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  processing: "text-processing",
};

export function StatusCard({
  tone,
  eyebrow,
  title,
  children,
}: StatusCardProps) {
  return (
    <section className="w-full min-w-0 rounded-[12px] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <StatusIcon tone={tone} animated={tone === "success"} />
      <p
        className={`text-xs font-medium uppercase tracking-wide ${eyebrowClass[tone]}`}
      >
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      <div className="mt-5">{children}</div>
    </section>
  );
}
