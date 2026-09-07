import { randomBytes } from "node:crypto";

export function createUserId() {
  return `usr_${randomBytes(12).toString("hex")}`;
}

export function createSessionId() {
  return `ses_${randomBytes(12).toString("hex")}`;
}

export function createAuthTokenId() {
  return `atk_${randomBytes(12).toString("hex")}`;
}

export function isUserId(value: string) {
  return /^usr_[a-f0-9]{24}$/.test(value);
}
