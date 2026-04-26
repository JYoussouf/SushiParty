CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  friend_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL,
  mode TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  menu_version INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  participants_json TEXT NOT NULL,
  group_code TEXT,
  note TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS sessions_owner_submitted_idx
ON sessions(owner_uid, submitted_at DESC);

CREATE INDEX IF NOT EXISTS sessions_submitted_idx
ON sessions(submitted_at DESC);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  menu_id TEXT NOT NULL DEFAULT 'global-default',
  stats_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS restaurants_latitude_idx
ON restaurants(latitude);

CREATE INDEX IF NOT EXISTS restaurants_name_lower_idx
ON restaurants(name_lower);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT,
  version INTEGER NOT NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
