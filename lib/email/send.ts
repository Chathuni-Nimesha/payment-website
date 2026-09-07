import "server-only";

import { logger } from "@/lib/logging/logger";
import { recordDevEmail } from "./dev-mailbox";
import { buildAuthEmail } from "./templates";
import type { AuthEmailPurpose } from "./types";

export async function sendAuthEmail(input: {
  to: string;
  purpose: AuthEmailPurpose;
  token: string;
}) {
  const message = buildAuthEmail(input);
  recordDevEmail(message);
  logger.info("email.queued", { purpose: message.purpose });
  return message;
}
