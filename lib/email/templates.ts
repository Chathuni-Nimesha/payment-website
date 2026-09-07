import "server-only";

import { siteUrl } from "@/lib/brand";
import type { AuthEmailPurpose, OutboundAuthEmail } from "./types";

export function buildAuthEmail(input: {
  to: string;
  purpose: AuthEmailPurpose;
  token: string;
}): OutboundAuthEmail {
  const base = siteUrl();
  if (input.purpose === "password_reset") {
    const url = `${base}/reset-password?token=${encodeURIComponent(input.token)}`;
    return {
      to: input.to,
      purpose: input.purpose,
      url,
      subject: "Reset your Northline password",
      text: `Use this link to choose a new Northline password. It expires in one hour.\n\n${url}\n`,
    };
  }

  const url = `${base}/verify-email?token=${encodeURIComponent(input.token)}`;
  return {
    to: input.to,
    purpose: input.purpose,
    url,
    subject: "Verify your Northline email",
    text: `Confirm this email for your Northline account. The link expires in 24 hours.\n\n${url}\n`,
  };
}
