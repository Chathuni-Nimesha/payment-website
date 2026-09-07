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
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicPayment = {
  id: string;
  reference: string;
  amountMinor: number;
  amountMajor: string;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ListByUserOptions = {
  page?: number;
  pageSize?: number;
};

export type TransactionList = {
  items: Transaction[];
  page: number;
  pageSize: number;
  total: number;
};

export type StripePaymentIntentEventInput = {
  eventId: string;
  eventType: string;
  eventCreatedAt: Date;
  paymentIntentId: string;
  amountMinor: number;
  amountMajor: string;
  currency: string;
  email: string;
  status: TransactionStatus;
  reference: string;
};

export type TransactionStore = {
  create(transaction: Transaction): Promise<void>;
  update(
    id: string,
    patch: Partial<Pick<Transaction, "status" | "paymentIntentId">>,
  ): Promise<Transaction | null>;
  attachUserIfUnset(id: string, userId: string): Promise<Transaction | null>;
  getById(id: string): Promise<Transaction | null>;
  getByPaymentIntentId(paymentIntentId: string): Promise<Transaction | null>;
  listByUser(userId: string, options?: ListByUserOptions): Promise<TransactionList>;
  applyPaymentIntentEvent(
    input: StripePaymentIntentEventInput,
  ): Promise<"applied" | "duplicate">;
};
