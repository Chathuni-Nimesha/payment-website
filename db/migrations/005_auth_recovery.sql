ALTER TABLE users
  ADD COLUMN email_verified_at TIMESTAMPTZ;

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY
    CHECK (id ~ '^atk_[a-f0-9]{24}$'),

  user_id TEXT NOT NULL
    REFERENCES users (id)
    ON DELETE CASCADE,

  purpose TEXT NOT NULL
    CHECK (purpose IN ('email_verification', 'password_reset')),

  token_hash TEXT NOT NULL
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_auth_tokens_token_hash ON auth_tokens (token_hash);
CREATE INDEX idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens (expires_at);
