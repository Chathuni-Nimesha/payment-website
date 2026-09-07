import { createHash } from "node:crypto";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
