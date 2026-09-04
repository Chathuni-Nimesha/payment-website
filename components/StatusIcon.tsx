type StatusIconTone = "success" | "danger" | "warning" | "processing";

const toneClass: Record<StatusIconTone, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  processing: "bg-processing-soft text-processing",
};

export function StatusIcon({
  tone,
  animated = false,
}: {
  tone: StatusIconTone;
  animated?: boolean;
}) {
  return (
    <span
      className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full ${toneClass[tone]} ${animated ? "confirm-mark" : ""}`}
      aria-hidden
    >
      {tone === "success" ? <CheckIcon /> : null}
      {tone === "danger" ? <CrossIcon /> : null}
      {tone === "warning" ? <AlertIcon /> : null}
      {tone === "processing" ? <ClockIcon /> : null}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12.5 9.5 17 19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.5v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
      <path
        d="M12 4.5 3.8 19h16.4L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4.2l2.6 1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
