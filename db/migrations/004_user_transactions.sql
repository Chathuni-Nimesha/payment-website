ALTER TABLE transactions
  ADD COLUMN user_id TEXT
    REFERENCES users (id)
    ON DELETE SET NULL;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_user_id_format
  CHECK (
    user_id IS NULL
    OR user_id ~ '^usr_[a-f0-9]{24}$'
  );

CREATE INDEX idx_transactions_user_created
  ON transactions (user_id, created_at DESC);
