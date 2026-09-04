import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

type ButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = SharedProps & {
  href: string;
  replace?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover disabled:bg-[#9aaec8] disabled:text-white",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-background disabled:text-muted",
  ghost: "text-foreground hover:bg-background disabled:text-muted",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium",
    "transition-[background-color,color,border-color,transform,box-shadow] duration-150",
    "active:translate-y-px",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed disabled:active:translate-y-0",
    variantClass[variant],
    sizeClass[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button(props: ButtonProps) {
  const className = buttonClassName({
    variant: props.variant,
    size: props.size,
    fullWidth: props.fullWidth,
    className: props.className,
  });

  if ("href" in props && typeof props.href === "string") {
    return (
      <Link href={props.href} replace={props.replace} className={className}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      className={className}
      disabled={props.disabled}
      name={props.name}
      value={props.value}
      onClick={props.onClick}
      form={props.form}
      id={props.id}
      aria-busy={props["aria-busy"]}
    >
      {props.children}
    </button>
  );
}
