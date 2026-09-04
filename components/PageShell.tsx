import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  width?: "default" | "narrow";
  className?: string;
};

export function PageShell({
  children,
  width = "default",
  className = "",
}: PageShellProps) {
  const widthClass =
    width === "narrow" ? "max-w-lg" : "max-w-5xl";

  return (
    <div
      className={`mx-auto w-full min-w-0 ${widthClass} px-4 py-8 sm:px-6 sm:py-12 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
