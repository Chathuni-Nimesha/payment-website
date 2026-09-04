"use client";

import { useEffect } from "react";
import { clearCheckoutSession } from "@/lib/checkout-session";

export function ClearCheckoutSession() {
  useEffect(() => {
    clearCheckoutSession();
  }, []);

  return null;
}
