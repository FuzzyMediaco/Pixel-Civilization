CREATE TABLE game_shared_islands (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('god','real','survival')),
  role TEXT NOT NULL CHECK (role IN ('owner','builder','visitor')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX game_shared_islands_user ON game_shared_islands(user_id, joined_at DESC);
