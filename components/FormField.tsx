import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  optional = false,
  children,
}: FormFieldProps) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal text-muted">Optional</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(htmlFor: string, error?: string, hint?: string) {
  if (error) {
    return `${htmlFor}-error`;
  }

  if (hint) {
    return `${htmlFor}-hint`;
  }

  return undefined;
}
