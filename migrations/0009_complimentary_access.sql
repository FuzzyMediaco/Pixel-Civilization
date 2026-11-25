-- This private grant follows the immutable account and is removed with it.
CREATE TABLE game_complimentary_access (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  user_id TEXT NOT NULL UNIQUE REFERENCES game_users(id) ON DELETE CASCADE
);
