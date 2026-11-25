CREATE TABLE game_link_tickets (
  reference TEXT PRIMARY KEY,
  user_id TEXT REFERENCES game_users(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL, link_id TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX game_link_ticket_product ON game_link_tickets(link_id);
CREATE INDEX game_link_ticket_account ON game_link_tickets(user_id,product_id,expires_at);

-- Session and payment identifiers are hashed. A previously assigned receipt stays assigned after account deletion.
CREATE TABLE game_link_receipts (
  session_key TEXT PRIMARY KEY, payment_key TEXT NOT NULL UNIQUE, product_id TEXT NOT NULL,
  user_id TEXT REFERENCES game_users(id) ON DELETE SET NULL, assigned INTEGER NOT NULL,
  started_at INTEGER NOT NULL, paid INTEGER NOT NULL, failed INTEGER NOT NULL
);
CREATE TABLE game_link_reversals (
  payment_key TEXT NOT NULL, event_key TEXT NOT NULL, blocked INTEGER NOT NULL, terminal INTEGER NOT NULL,
  event_time INTEGER NOT NULL, PRIMARY KEY(payment_key,event_key)
);
