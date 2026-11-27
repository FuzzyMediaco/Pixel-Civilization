-- Enroll the existing owner's immutable game user ID once, separately from checkout and registration.
CREATE TABLE game_account_owner (
  slot INTEGER PRIMARY KEY CHECK(slot=1),
  user_id TEXT NOT NULL UNIQUE REFERENCES game_users(id) ON DELETE CASCADE
);

CREATE TABLE game_account_rewards (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  issuer_id TEXT REFERENCES game_users(id) ON DELETE SET NULL,
  recipient_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('product','design')),
  item_id TEXT NOT NULL,
  label TEXT NOT NULL,
  design TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  CHECK((kind='design')=(design IS NOT NULL)),
  CHECK(expires_at IS NULL OR (kind='product' AND expires_at>created_at))
);
CREATE INDEX game_rewards_recipient ON game_account_rewards(recipient_id,kind,item_id,expires_at);
CREATE UNIQUE INDEX game_rewards_permanent ON game_account_rewards(recipient_id,kind,item_id) WHERE expires_at IS NULL;

ALTER TABLE game_pix_usage ADD COLUMN discretionary INTEGER NOT NULL DEFAULT 0 CHECK(discretionary IN (0,1));
