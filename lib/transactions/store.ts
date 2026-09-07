import "server-only";

import type { QueryResult } from "pg";
import { isUserId } from "@/lib/auth/ids";
import { getPool } from "@/lib/db/client";
import { PAYMENTS_DEFAULT_PAGE_SIZE, PAYMENTS_MAX_PAGE_SIZE } from "@/lib/payments/history";
import type {
  ListByUserOptions,
  StripePaymentIntentEventInput,
  Transaction,
  TransactionStatus,
  TransactionStore,
} from "./types";

type TransactionRow = {
  id: string;
  payment_intent_id: string;
  amount_minor: number;
  amount_major: string;
  currency: string;
  email: string;
  status: TransactionStatus;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

const TRANSACTION_COLUMNS = `
  id,
  payment_intent_id,
  amount_minor,
  amount_major,
  currency,
  email,
  status,
  user_id,
  created_at,
  updated_at
`;

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    paymentIntentId: row.payment_intent_id,
    amountMinor: row.amount_minor,
    amountMajor: row.amount_major,
    currency: row.currency,
    email: row.email,
    status: row.status,
    userId: row.user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
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

function normalizeListOptions(options: ListByUserOptions = {}) {
  const page = Number.isInteger(options.page) && (options.page ?? 0) > 0 ? options.page! : 1;
  const requested =
    Number.isInteger(options.pageSize) && (options.pageSize ?? 0) > 0
      ? options.pageSize!
      : PAYMENTS_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requested, PAYMENTS_MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

export const transactionStore: TransactionStore = {
  async create(transaction: Transaction) {
    const pool = getPool();
    const userId =
      transaction.userId && isUserId(transaction.userId) ? transaction.userId : null;

    try {
      await pool.query(
        `
          INSERT INTO transactions (
            id,
            payment_intent_id,
            amount_minor,
            amount_major,
            currency,
            email,
            status,
            user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (payment_intent_id) DO NOTHING
        `,
        [
          transaction.id,
          transaction.paymentIntentId,
          transaction.amountMinor,
          transaction.amountMajor,
          transaction.currency,
          transaction.email,
          transaction.status,
          userId,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return;
      }

      throw error;
    }
  },

  async update(
    id: string,
    patch: Partial<Pick<Transaction, "status" | "paymentIntentId">>,
  ) {
    const pool = getPool();
    const result: QueryResult<TransactionRow> = await pool.query(
      `
        UPDATE transactions
        SET
          status = COALESCE($2::transaction_status, status),
          payment_intent_id = COALESCE($3, payment_intent_id),
          updated_at = now()
        WHERE id = $1
        RETURNING ${TRANSACTION_COLUMNS}
      `,
      [id, patch.status ?? null, patch.paymentIntentId ?? null],
    );

    return result.rows[0] ? toTransaction(result.rows[0]) : null;
  },

  async attachUserIfUnset(id: string, userId: string) {
    if (!isUserId(userId)) {
      return null;
    }

    const pool = getPool();
    const result: QueryResult<TransactionRow> = await pool.query(
      `
        UPDATE transactions
        SET
          user_id = $2,
          updated_at = now()
        WHERE id = $1
          AND user_id IS NULL
        RETURNING ${TRANSACTION_COLUMNS}
      `,
      [id, userId],
    );

    return result.rows[0] ? toTransaction(result.rows[0]) : null;
  },

  async getById(id: string) {
    const pool = getPool();
    const result: QueryResult<TransactionRow> = await pool.query(
      `
        SELECT ${TRANSACTION_COLUMNS}
        FROM transactions
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? toTransaction(result.rows[0]) : null;
  },

  async getByPaymentIntentId(paymentIntentId: string) {
    const pool = getPool();
    const result: QueryResult<TransactionRow> = await pool.query(
      `
        SELECT ${TRANSACTION_COLUMNS}
        FROM transactions
        WHERE payment_intent_id = $1
      `,
      [paymentIntentId],
    );

    return result.rows[0] ? toTransaction(result.rows[0]) : null;
  },

  async listByUser(userId: string, options: ListByUserOptions = {}) {
    if (!isUserId(userId)) {
      return {
        items: [],
        page: 1,
        pageSize: PAYMENTS_DEFAULT_PAGE_SIZE,
        total: 0,
      };
    }

    const { page, pageSize, offset } = normalizeListOptions(options);
    const pool = getPool();
    const count = await pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM transactions WHERE user_id = $1",
      [userId],
    );
    const result: QueryResult<TransactionRow> = await pool.query(
      `
        SELECT ${TRANSACTION_COLUMNS}
        FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2 OFFSET $3
      `,
      [userId, pageSize, offset],
    );

    return {
      items: result.rows.map(toTransaction),
      page,
      pageSize,
      total: count.rows[0]?.total ?? 0,
    };
  },

  async applyPaymentIntentEvent(input: StripePaymentIntentEventInput) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO stripe_events (id, type, payment_intent_id, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `,
        [
          input.eventId,
          input.eventType,
          input.paymentIntentId,
          input.eventCreatedAt,
        ],
      );

      if ((inserted.rowCount ?? 0) === 0) {
        await client.query("COMMIT");
        return "duplicate";
      }

      try {
        await client.query(
          `
            INSERT INTO transactions (
              id,
              payment_intent_id,
              amount_minor,
              amount_major,
              currency,
              email,
              status,
              last_event_created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (payment_intent_id) DO UPDATE SET
              status = CASE
                WHEN transactions.status = 'paid' AND EXCLUDED.status <> 'paid'
                  THEN transactions.status
                WHEN transactions.last_event_created_at IS NOT NULL
                  AND transactions.last_event_created_at > EXCLUDED.last_event_created_at
                  THEN transactions.status
                ELSE EXCLUDED.status
              END,
              last_event_created_at = CASE
                WHEN transactions.last_event_created_at IS NOT NULL
                  AND transactions.last_event_created_at > EXCLUDED.last_event_created_at
                  THEN transactions.last_event_created_at
                ELSE EXCLUDED.last_event_created_at
              END,
              email = CASE
                WHEN transactions.email <> '' THEN transactions.email
                ELSE EXCLUDED.email
              END,
              updated_at = now()
          `,
          [
            input.reference,
            input.paymentIntentId,
            input.amountMinor,
            input.amountMajor,
            input.currency,
            input.email,
            input.status,
            input.eventCreatedAt,
          ],
        );
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        await client.query(
          `
            UPDATE transactions
            SET
              status = CASE
                WHEN status = 'paid' AND $2::transaction_status <> 'paid'
                  THEN status
                WHEN last_event_created_at IS NOT NULL
                  AND last_event_created_at > $3
                  THEN status
                ELSE $2::transaction_status
              END,
              last_event_created_at = CASE
                WHEN last_event_created_at IS NOT NULL
                  AND last_event_created_at > $3
                  THEN last_event_created_at
                ELSE $3
              END,
              updated_at = now()
            WHERE payment_intent_id = $1
          `,
          [input.paymentIntentId, input.status, input.eventCreatedAt],
        );
      }

      await client.query("COMMIT");
      return "applied";
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
