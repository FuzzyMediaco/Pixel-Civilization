-- A held checkout can only save billing details. A committed term may be collected by Stripe and cannot time out locally.
CREATE TABLE game_pix_funded_terms (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES game_users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, budget_micros INTEGER NOT NULL CHECK(budget_micros>0),
  kind TEXT NOT NULL CHECK(kind IN ('initial','renewal')),
  state TEXT NOT NULL CHECK(state IN ('held','committed','active','released')),
  created_at INTEGER NOT NULL, hold_until INTEGER NOT NULL,
  subscription_id TEXT, period_start INTEGER, period_end INTEGER,
  CHECK(period_end IS NULL OR period_end>period_start),
  UNIQUE(subscription_id,period_start)
);
CREATE UNIQUE INDEX game_pix_open_initial ON game_pix_funded_terms(user_id)
  WHERE kind='initial' AND state IN ('held','committed');
CREATE INDEX game_pix_funded_sub ON game_pix_funded_terms(subscription_id,period_end);
CREATE INDEX game_pix_funded_state ON game_pix_funded_terms(state,period_end);
CREATE INDEX game_pix_usage_model_time ON game_pix_usage(model,started_at,state);

-- The fee is a merchant expense paid when buying credits. This estimate never debits a player's allowance.
CREATE VIEW game_pix_settled_costs AS
SELECT provider,model,SUM(cost_micros) AS inference_micros,
  CASE WHEN instr(model,'/')>0 THEN CAST(ROUND(SUM(cost_micros)*0.05) AS INTEGER) ELSE 0 END AS estimated_funding_fee_micros
FROM game_pix_usage WHERE state='settled' GROUP BY provider,model;
