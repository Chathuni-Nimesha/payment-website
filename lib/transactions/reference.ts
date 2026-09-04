import { randomBytes } from "node:crypto";

export { isIdempotencyKey } from "@/lib/idempotency-key";

export function createTransactionId() {
  return `nl_${randomBytes(12).toString("hex")}`;
}

export function isTransactionId(value: string) {
  return /^nl_[a-f0-9]{16,32}$/.test(value);
}
