import "server-only";

import type { OutboundAuthEmail } from "./types";

const mailbox: OutboundAuthEmail[] = [];

export function isDevMailPreviewEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function recordDevEmail(message: OutboundAuthEmail) {
  if (!isDevMailPreviewEnabled()) {
    return;
  }

  mailbox.push(message);
  if (mailbox.length > 20) {
    mailbox.shift();
  }
}

export function lastDevEmail() {
  return mailbox.at(-1) ?? null;
}

export function clearDevMailbox() {
  mailbox.length = 0;
}
