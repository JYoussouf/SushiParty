CREATE TABLE IF NOT EXISTS account_credentials (
  user_uid TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS account_credentials_email_idx
ON account_credentials(email_normalized);
