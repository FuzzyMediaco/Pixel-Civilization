CREATE TABLE game_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE game_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX game_sessions_expiry ON game_sessions(expires_at);
CREATE INDEX game_sessions_user ON game_sessions(user_id);

CREATE TABLE game_auth_attempts (
  subject TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (subject, window_start)
);
CREATE INDEX game_attempts_expiry ON game_auth_attempts(window_start);

CREATE TABLE game_saves (
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  save_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  revision TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  previous_revision TEXT,
  previous_updated_at INTEGER,
  previous_deleted INTEGER,
  PRIMARY KEY (user_id, save_key)
);

-- Chunks stay below D1's individual row limit. An atomic write retains the preceding generation.
CREATE TABLE game_save_chunks (
  user_id TEXT NOT NULL,
  save_key TEXT NOT NULL,
  revision TEXT NOT NULL,
  part INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, save_key, revision, part),
  FOREIGN KEY (user_id, save_key) REFERENCES game_saves(user_id, save_key) ON DELETE CASCADE
);
