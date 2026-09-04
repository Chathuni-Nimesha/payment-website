import type { InputHTMLAttributes } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  invalid?: boolean;
  className?: string;
};

export function Input({ invalid = false, className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={[
        "h-11 w-full rounded-[8px] border bg-surface px-3 text-[15px] text-foreground",
        "placeholder:text-muted/80",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:bg-background disabled:text-muted",
        invalid ? "border-danger" : "border-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
