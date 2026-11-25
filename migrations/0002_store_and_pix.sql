CREATE TABLE game_purchases (
  store TEXT NOT NULL, receipt_key TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, active INTEGER NOT NULL, period_start INTEGER NOT NULL,
  expires_at INTEGER, checked_at INTEGER NOT NULL, refresh_at INTEGER NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY(store, receipt_key)
);
CREATE INDEX game_purchases_account ON game_purchases(user_id, active);
CREATE INDEX game_purchases_refresh ON game_purchases(store,refresh_at);
CREATE TABLE game_stripe_customers (
  user_id TEXT PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE, customer_id TEXT NOT NULL UNIQUE
);
CREATE TABLE game_stripe_events(event_id TEXT PRIMARY KEY, processed_at INTEGER NOT NULL);
CREATE TABLE game_pix_usage (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE, request_key TEXT NOT NULL,
  started_at INTEGER NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, state TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL, PRIMARY KEY(user_id, request_key)
);
CREATE INDEX game_pix_window ON game_pix_usage(user_id,started_at);
CREATE TABLE game_store_checks (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE, window INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,window)
);
