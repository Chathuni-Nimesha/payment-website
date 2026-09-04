import type { ReactNode } from "react";

type NoticeTone = "info" | "danger" | "warning";

const toneClass: Record<NoticeTone, string> = {
  info: "border-border bg-background text-muted",
  danger: "border-danger/20 bg-danger-soft text-danger",
  warning: "border-warning/20 bg-warning-soft text-warning",
};

export function Notice({
  tone = "info",
  children,
  id,
  role,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  id?: string;
  role?: "alert" | "status";
}) {
  return (
    <p
      id={id}
      role={role}
      className={`rounded-[8px] border px-3 py-2.5 text-sm leading-6 break-words ${toneClass[tone]}`}
    >
      {children}
    </p>
  );
}
