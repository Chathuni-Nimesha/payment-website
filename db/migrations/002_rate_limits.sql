CREATE TABLE rate_limit_windows (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX idx_rate_limit_windows_start
ON rate_limit_windows (window_start);
