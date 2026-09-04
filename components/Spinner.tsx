export function Spinner({
  className = "h-4 w-4 border-white/40 border-t-white",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 ${className}`}
      aria-hidden
    />
  );
}
