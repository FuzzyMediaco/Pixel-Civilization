-- A checkout's paid term is reserved separately in game_pix_funded_terms (0007).
CREATE TABLE game_stripe_funded (
  first_term TEXT PRIMARY KEY, user_id TEXT REFERENCES game_users(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL, price_id TEXT NOT NULL, customer_id TEXT NOT NULL,
  setup_session TEXT UNIQUE, setup_url TEXT, setup_expires INTEGER NOT NULL, created_at INTEGER NOT NULL,
  create_started INTEGER, schedule_id TEXT UNIQUE, subscription_id TEXT UNIQUE, invoice_id TEXT, invoice_url TEXT, invoice_state TEXT,
  receipt_reversed INTEGER NOT NULL DEFAULT 0, receipt_checked INTEGER NOT NULL DEFAULT 0,
  renews INTEGER NOT NULL DEFAULT 1, stop_confirmed INTEGER NOT NULL DEFAULT 0,
  authorized_end INTEGER, current_end INTEGER, next_check INTEGER NOT NULL,
  lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0, finished INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX game_stripe_funded_user ON game_stripe_funded(user_id,created_at);
CREATE INDEX game_stripe_funded_check ON game_stripe_funded(finished,next_check);
