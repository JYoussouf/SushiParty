CREATE TABLE IF NOT EXISTS session_participants (
  session_id  TEXT NOT NULL,
  user_uid    TEXT NOT NULL,
  PRIMARY KEY (session_id, user_uid),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_uid)   REFERENCES users(uid)   ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_participants_user_idx ON session_participants(user_uid);
