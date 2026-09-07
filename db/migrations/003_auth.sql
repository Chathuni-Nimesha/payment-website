CREATE TABLE users (
  id TEXT PRIMARY KEY
    CHECK (id ~ '^usr_[a-f0-9]{24}$'),

  email TEXT NOT NULL
    CHECK (
      email = lower(email)
      AND char_length(email) BETWEEN 3 AND 254
    ),

  password_hash TEXT NOT NULL
    CHECK (char_length(password_hash) >= 20),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY
    CHECK (id ~ '^ses_[a-f0-9]{24}$'),

  user_id TEXT NOT NULL
    REFERENCES users (id)
    ON DELETE CASCADE,

  token_hash TEXT NOT NULL
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),

  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
