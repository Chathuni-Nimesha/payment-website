export type TransactionStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed";

export type Transaction = {
  id: string;
  paymentIntentId: string;
  amountMinor: number;
  amountMajor: string;
  currency: string;
  email: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

export type TransactionStore = {
  create(transaction: Transaction): Promise<void>;
  update(
    id: string,
    patch: Partial<Pick<Transaction, "status" | "paymentIntentId">>,
  ): Promise<Transaction | null>;
  getById(id: string): Promise<Transaction | null>;
  getByPaymentIntentId(paymentIntentId: string): Promise<Transaction | null>;
};
