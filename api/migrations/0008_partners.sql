-- Restaurant partner portal: accounts, profiles (claimed to a Google place),
-- uploaded photos, and the lightweight application leads from the app.

CREATE TABLE IF NOT EXISTS partner_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_profiles (
  partner_id TEXT PRIMARY KEY,
  place_id TEXT,
  restaurant_name TEXT,
  address TEXT,
  description TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (partner_id) REFERENCES partner_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_partner_profiles_place ON partner_profiles(place_id);

CREATE TABLE IF NOT EXISTS partner_photos (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (partner_id) REFERENCES partner_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_partner_photos_partner ON partner_photos(partner_id);

CREATE TABLE IF NOT EXISTS partner_applications (
  id TEXT PRIMARY KEY,
  restaurant_name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL
);
