import { STORE_PRODUCTS } from "../src/game/storeCatalog.mjs";
import { GATEWAY_MODELS } from "./pix-gateway.mjs";
import { DAY } from "./store-data.mjs";

export const plans = STORE_PRODUCTS.filter((product) => product.kind === "subscription");
const catalogRows = plans.map(() => "(?,?)").join(",");
const catalogParams = plans.flatMap((p) => [p.id, p.budgetMicros]);
export const maxTerm = 32 * DAY;

// All values use millionths of a US dollar of provider inference. The merchant pays the top-up fee separately.
// Managed periods hold the remaining allowance. Pre-existing receipts also count even when no
// checkout reservation exists. Near-simultaneous inferences may not yet appear in Cloudflare's balance.
export const capacitySql = `WITH bounds(now,observed,wallet,ignore_id) AS (VALUES(?,?,?,?)),
  plans(product_id,budget) AS (VALUES ${catalogRows}),
  managed AS (
    SELECT COALESCE(SUM(CASE WHEN t.state='active' THEN MAX(0,t.budget_micros-(
      SELECT COALESCE(SUM(u.cost_micros),0) FROM game_pix_usage u WHERE u.user_id=t.user_id
        AND u.started_at>=t.period_start AND u.started_at<t.period_end AND u.state='settled'
    )) ELSE t.budget_micros END),0) AS held
    FROM game_pix_funded_terms t,bounds b WHERE t.id!=b.ignore_id AND (
      (t.state='held' AND t.hold_until>b.now) OR t.state='committed' OR (t.state='active' AND t.period_end>b.now))
  ), legacy AS (
    SELECT COALESCE(SUM(MAX(0,plans.budget-CASE WHEN p.expires_at-p.period_start<=${maxTerm} THEN (
      SELECT COALESCE(SUM(u.cost_micros),0) FROM game_pix_usage u WHERE u.user_id=p.user_id
        AND u.started_at>=p.period_start AND u.started_at<p.expires_at AND u.state='settled'
    ) ELSE 0 END)),0) AS held
    FROM game_purchases p JOIN plans ON plans.product_id=p.product_id CROSS JOIN bounds b
    WHERE p.active=1 AND p.expires_at>b.now AND NOT EXISTS(
      SELECT 1 FROM game_pix_funded_terms t WHERE p.store='stripe' AND t.subscription_id=p.receipt_key
        AND t.user_id=p.user_id AND t.product_id=p.product_id AND t.period_start=p.period_start AND t.period_end=p.expires_at
        AND t.state IN ('committed','active'))
  ), recent AS (
    SELECT COALESCE(SUM(u.cost_micros),0) AS spent FROM game_pix_usage u,bounds b
    WHERE u.model IN (?,?,?) AND ((u.state='settled' AND u.started_at>=b.observed-120000)
      OR (u.state='reserved' AND EXISTS (SELECT 1 FROM game_complimentary_access g WHERE g.user_id=u.user_id)))
  ), capacity AS (SELECT b.wallet-managed.held-legacy.held-recent.spent AS available FROM bounds b,managed,legacy,recent)
`;
export function capacityParams(access, now, ignore = "") {
  return [
    now,
    access?.checkedAt ?? now,
    access?.availableMicros ?? 0,
    ignore,
    ...catalogParams,
    ...Object.values(GATEWAY_MODELS),
  ];
}
