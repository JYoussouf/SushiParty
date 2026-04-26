CREATE TABLE IF NOT EXISTS friendships (
  user_uid    TEXT NOT NULL,
  friend_uid  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_uid, friend_uid),
  FOREIGN KEY (user_uid)   REFERENCES users(uid) ON DELETE CASCADE,
  FOREIGN KEY (friend_uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS friendships_friend_uid_idx ON friendships(friend_uid);
