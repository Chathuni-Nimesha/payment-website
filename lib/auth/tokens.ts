import "server-only";

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { createAuthTokenId } from "./ids";
import { hashSecret } from "./secret";

export const AUTH_TOKEN_PURPOSES = [
  "email_verification",
  "password_reset",
] as const;

export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type Queryable = {
  query: PoolClient["query"];
};

export function createAuthToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSecret(token) };
}

export function ttlForPurpose(purpose: AuthTokenPurpose) {
  return purpose === "password_reset"
    ? PASSWORD_RESET_TTL_MS
    : EMAIL_VERIFICATION_TTL_MS;
}

export async function issueAuthToken(
  queryable: Queryable,
  userId: string,
  purpose: AuthTokenPurpose,
) {
  const { token, tokenHash } = createAuthToken();
  const id = createAuthTokenId();
  const expiresAt = new Date(Date.now() + ttlForPurpose(purpose));

  await queryable.query(
    `
      UPDATE auth_tokens
      SET used_at = now()
      WHERE user_id = $1
        AND purpose = $2
        AND used_at IS NULL
    `,
    [userId, purpose],
  );

  await queryable.query(
    `
      INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [id, userId, purpose, tokenHash, expiresAt],
  );

  return { id, token, tokenHash, expiresAt };
}

export async function consumeAuthToken(
  queryable: Queryable,
  token: string,
  purpose: AuthTokenPurpose,
) {
  const tokenHash = hashSecret(token);
  const result = await queryable.query<{ user_id: string; id: string }>(
    `
      UPDATE auth_tokens
      SET used_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING id, user_id
    `,
    [tokenHash, purpose],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return { id: row.id, userId: row.user_id, tokenHash };
}

export async function issueAuthTokenForUser(
  userId: string,
  purpose: AuthTokenPurpose,
) {
  return issueAuthToken(getPool(), userId, purpose);
}
