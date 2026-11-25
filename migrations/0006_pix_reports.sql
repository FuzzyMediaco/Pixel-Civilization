CREATE TABLE game_pix_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX game_pix_reports_created ON game_pix_reports(created_at);

CREATE TABLE game_pix_report_limits (
  subject TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
CREATE INDEX game_pix_report_limits_window ON game_pix_report_limits(window_start);
