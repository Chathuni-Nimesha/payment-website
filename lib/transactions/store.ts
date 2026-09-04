import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Transaction, TransactionStore } from "./types";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "transactions.json");

type FilePayload = {
  transactions: Transaction[];
};

let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readPayload(): Promise<FilePayload> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as FilePayload;
    if (!parsed || !Array.isArray(parsed.transactions)) {
      return { transactions: [] };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { transactions: [] };
    }
    throw error;
  }
}

async function writePayload(payload: FilePayload) {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export const transactionStore: TransactionStore = {
  async create(transaction) {
    await enqueue(async () => {
      const payload = await readPayload();
      const existing = payload.transactions.find(
        (item) =>
          item.id === transaction.id ||
          item.paymentIntentId === transaction.paymentIntentId,
      );

      if (existing) {
        return;
      }

      payload.transactions.push(transaction);
      await writePayload(payload);
    });
  },

  async update(id, patch) {
    return enqueue(async () => {
      const payload = await readPayload();
      const index = payload.transactions.findIndex((item) => item.id === id);

      if (index === -1) {
        return null;
      }

      const next: Transaction = {
        ...payload.transactions[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      payload.transactions[index] = next;
      await writePayload(payload);
      return next;
    });
  },

  async getById(id) {
    const payload = await readPayload();
    return payload.transactions.find((item) => item.id === id) ?? null;
  },

  async getByPaymentIntentId(paymentIntentId) {
    const payload = await readPayload();
    return (
      payload.transactions.find(
        (item) => item.paymentIntentId === paymentIntentId,
      ) ?? null
    );
  },
};
