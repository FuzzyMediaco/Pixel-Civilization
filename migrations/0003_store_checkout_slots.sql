-- One outstanding Checkout per account and item (all monthly tiers share one slot).
CREATE TABLE game_checkouts (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE, scope TEXT NOT NULL, product_id TEXT NOT NULL,
  ticket TEXT NOT NULL, session_id TEXT, expires_at INTEGER NOT NULL, PRIMARY KEY(user_id,scope)
);
