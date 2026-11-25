-- Facts from the isolated recurring Payment Links rehearsal. No API credentials or card data.
CREATE TABLE game_pix_link_offers (
  link_id TEXT PRIMARY KEY, product_id TEXT NOT NULL, price_id TEXT NOT NULL UNIQUE
);
CREATE TABLE game_pix_link_sessions (
  subscription TEXT PRIMARY KEY, session_hash TEXT NOT NULL UNIQUE, customer TEXT NOT NULL,
  ticket TEXT NOT NULL REFERENCES game_link_tickets(reference), product_id TEXT NOT NULL,
  price_id TEXT NOT NULL, user_id TEXT REFERENCES game_users(id) ON DELETE SET NULL
);
CREATE INDEX game_pix_link_account ON game_pix_link_sessions(user_id);
CREATE TABLE game_pix_link_status (
  subscription TEXT PRIMARY KEY, customer TEXT NOT NULL, price_id TEXT NOT NULL,
  status TEXT NOT NULL, cancel_at_end INTEGER NOT NULL, event_time INTEGER NOT NULL, precedence INTEGER NOT NULL
);
CREATE TABLE game_pix_link_invoices (
  invoice TEXT PRIMARY KEY, subscription TEXT NOT NULL, customer TEXT NOT NULL, price_id TEXT NOT NULL,
  period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, amount_paid INTEGER NOT NULL
);
CREATE INDEX game_pix_link_billing_period ON game_pix_link_invoices(subscription,period_end DESC);
CREATE TABLE game_pix_link_invoice_payments (
  invoice TEXT NOT NULL, intent_hash TEXT NOT NULL, amount_paid INTEGER NOT NULL, observed_at INTEGER NOT NULL,
  PRIMARY KEY(invoice,intent_hash)
);
CREATE VIEW game_pix_link_entitlements AS
SELECT s.user_id, s.subscription, s.product_id, i.period_start, i.period_end AS expires_at
FROM game_pix_link_sessions s
JOIN game_pix_link_status st ON st.subscription=s.subscription AND st.customer=s.customer AND st.price_id=s.price_id AND st.status='active'
JOIN game_pix_link_invoices i ON i.subscription=s.subscription AND i.customer=s.customer AND i.price_id=s.price_id
JOIN game_pix_link_invoice_payments p ON p.invoice=i.invoice AND p.amount_paid=i.amount_paid
WHERE s.user_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM game_link_reversals r WHERE r.payment_key=p.intent_hash AND r.blocked=1)
AND NOT EXISTS(SELECT 1 FROM game_pix_link_invoices later WHERE later.subscription=i.subscription AND later.period_end>i.period_end AND later.period_start<=unixepoch()*1000);
