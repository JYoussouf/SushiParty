CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider      TEXT NOT NULL,
  provider_uid  TEXT NOT NULL,
  user_uid      TEXT NOT NULL,
  email         TEXT,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (provider, provider_uid),
  FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS oauth_accounts_user_uid_idx ON oauth_accounts(user_uid);
