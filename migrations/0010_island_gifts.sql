CREATE TABLE island_gift_issuers (
  user_id TEXT PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE island_gifts (
  request_id TEXT PRIMARY KEY,
  issuer_id TEXT REFERENCES game_users(id) ON DELETE SET NULL,
  recipient_id TEXT NOT NULL,
  save_key TEXT NOT NULL,
  island_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(typeof(amount) = 'integer' AND amount BETWEEN 1 AND 9007199254740991),
  created_at INTEGER NOT NULL,
  retired INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipient_id, save_key) REFERENCES game_saves(user_id, save_key) ON DELETE CASCADE
);
CREATE INDEX island_gifts_recipient ON island_gifts(recipient_id, save_key, island_id, retired);
