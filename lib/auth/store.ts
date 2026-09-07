import "server-only";

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/client";
import { sendAuthEmail } from "@/lib/email/send";
import { createSessionId, createUserId } from "./ids";
import { hashPassword, verifyPasswordAgainstKnownHash } from "./password";
import { SESSION_MAX_AGE_SECONDS } from "./cookie";
import { hashSecret } from "./secret";
import {
  consumeAuthToken,
  issueAuthToken,
  issueAuthTokenForUser,
} from "./tokens";
import type { AuthUser } from "./types";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  created_at: Date;
};

type Queryable = {
  query: PoolClient["query"];
};

function toAuthUser(
  row: Pick<UserRow, "id" | "email" | "created_at" | "email_verified_at">,
): AuthUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at.toISOString(),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function insertSession(queryable: Queryable, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const id = createSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await queryable.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, userId, hashSecret(token), expiresAt],
  );

  return { id, token, expiresAt };
}

export async function createUserWithSession(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; user: AuthUser; token: string; expiresAt: Date }
  | { ok: false; reason: "duplicate" }
> {
  const pool = getPool();
  const client = await pool.connect();
  const passwordHash = await hashPassword(input.password);
  const userId = createUserId();

  try {
    await client.query("BEGIN");
    const userResult = await client.query<UserRow>(
      `
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, password_hash, email_verified_at, created_at
      `,
      [userId, input.email, passwordHash],
    );
    const row = userResult.rows[0];
    const session = await insertSession(client, userId);
    const verification = await issueAuthToken(
      client,
      userId,
      "email_verification",
    );
    await client.query("COMMIT");

    try {
      await sendAuthEmail({
        to: row.email,
        purpose: "email_verification",
        token: verification.token,
      });
    } catch {
      // Registration still succeeds if the development mailbox is unavailable.
    }

    return {
      ok: true,
      user: toAuthUser(row),
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; user: AuthUser; token: string; expiresAt: Date }
  | { ok: false }
> {
  const pool = getPool();
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, email_verified_at, created_at
      FROM users
      WHERE email = $1
    `,
    [input.email],
  );
  const row = result.rows[0] ?? null;
  const passwordOk = await verifyPasswordAgainstKnownHash(
    row?.password_hash ?? null,
    input.password,
  );

  if (!row || !passwordOk) {
    return { ok: false };
  }

  const session = await insertSession(pool, row.id);
  return {
    ok: true,
    user: toAuthUser(row),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function createSession(userId: string) {
  return insertSession(getPool(), userId);
}

export async function getUserBySessionToken(token: string | null) {
  if (!token) {
    return null;
  }

  const pool = getPool();
  const result = await pool.query<UserRow & { session_id: string; expires_at: Date }>(
    `
      SELECT
        users.id,
        users.email,
        users.password_hash,
        users.email_verified_at,
        users.created_at,
        sessions.id AS session_id,
        sessions.expires_at
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1
    `,
    [hashSecret(token)],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (row.expires_at.getTime() <= Date.now()) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [row.session_id]);
    return null;
  }

  return toAuthUser(row);
}

export async function deleteSession(token: string | null) {
  if (!token) {
    return;
  }

  await getPool().query("DELETE FROM sessions WHERE token_hash = $1", [
    hashSecret(token),
  ]);
}

export async function deleteSessionsForUser(userId: string, queryable?: Queryable) {
  await (queryable ?? getPool()).query("DELETE FROM sessions WHERE user_id = $1", [
    userId,
  ]);
}

export async function getUserByEmail(email: string) {
  const result = await getPool().query<UserRow>(
    `
      SELECT id, email, password_hash, email_verified_at, created_at
      FROM users
      WHERE email = $1
    `,
    [email],
  );
  const row = result.rows[0];
  return row ? toAuthUser(row) : null;
}

export async function requestPasswordReset(email: string) {
  const user = await getUserByEmail(email);
  if (!user) {
    void hashSecret(randomBytes(32).toString("base64url"));
    return { sent: false as const };
  }

  const issued = await issueAuthTokenForUser(user.id, "password_reset");
  const mail = await sendAuthEmail({
    to: user.email,
    purpose: "password_reset",
    token: issued.token,
  });
  return { sent: true as const, previewUrl: mail.url };
}

export async function resendEmailVerification(input: {
  email?: string;
  userId?: string;
}) {
  const pool = getPool();
  let row: UserRow | undefined;

  if (input.userId) {
    const result = await pool.query<UserRow>(
      `
        SELECT id, email, password_hash, email_verified_at, created_at
        FROM users
        WHERE id = $1
      `,
      [input.userId],
    );
    row = result.rows[0];
  } else if (input.email) {
    const result = await pool.query<UserRow>(
      `
        SELECT id, email, password_hash, email_verified_at, created_at
        FROM users
        WHERE email = $1
      `,
      [input.email],
    );
    row = result.rows[0];
  }

  if (!row) {
    void hashSecret(randomBytes(32).toString("base64url"));
    return { status: "unknown" as const };
  }

  if (row.email_verified_at) {
    return { status: "already_verified" as const };
  }

  const issued = await issueAuthTokenForUser(row.id, "email_verification");
  const mail = await sendAuthEmail({
    to: row.email,
    purpose: "email_verification",
    token: issued.token,
  });
  return { status: "sent" as const, previewUrl: mail.url };
}

export async function verifyEmailWithToken(token: string) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const consumed = await consumeAuthToken(client, token, "email_verification");
    if (!consumed) {
      await client.query("ROLLBACK");
      return { ok: false as const };
    }

    await client.query(
      `
        UPDATE users
        SET email_verified_at = COALESCE(email_verified_at, now()),
            updated_at = now()
        WHERE id = $1
      `,
      [consumed.userId],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const consumed = await consumeAuthToken(client, input.token, "password_reset");
    if (!consumed) {
      await client.query("ROLLBACK");
      return { ok: false as const };
    }

    await client.query(
      `
        UPDATE users
        SET password_hash = $2, updated_at = now()
        WHERE id = $1
      `,
      [consumed.userId, passwordHash],
    );
    await deleteSessionsForUser(consumed.userId, client);
    await client.query("COMMIT");
    return { ok: true as const, userId: consumed.userId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
