CREATE TYPE transaction_status AS ENUM (
  'pending',
  'processing',
  'paid',
  'failed'
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY
      CHECK (id ~ '^nl_[a-f0-9]{16,32}$'),

  payment_intent_id TEXT NOT NULL UNIQUE
      CHECK (payment_intent_id LIKE 'pi_%'),

  amount_minor INTEGER NOT NULL
      CHECK (amount_minor > 0),

  amount_major TEXT NOT NULL,

  currency TEXT NOT NULL
      CHECK (currency = upper(currency)),

  email TEXT NOT NULL DEFAULT '',

  status transaction_status NOT NULL,

  last_event_created_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_status
ON transactions (status);

CREATE INDEX idx_transactions_created_at
ON transactions (created_at DESC);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY
      CHECK (id LIKE 'evt_%'),

  type TEXT NOT NULL,

  payment_intent_id TEXT,

  created_at TIMESTAMPTZ NOT NULL,

  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_events_pi
ON stripe_events (payment_intent_id);

CREATE INDEX idx_stripe_events_type
ON stripe_events (type);
