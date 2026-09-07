"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

export function LogoutButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "secondary"}
      fullWidth={!compact}
      disabled={pending}
      aria-busy={pending}
      className={compact ? "h-9 px-3" : undefined}
      onClick={onClick}
    >
      {pending ? (
        <>
          <Spinner className="h-4 w-4 border-foreground/20 border-t-foreground" />
          {compact ? "…" : "Signing out..."}
        </>
      ) : (
        "Sign out"
      )}
    </Button>
  );
}
