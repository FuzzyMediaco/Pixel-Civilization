import { plans, maxTerm, capacitySql, capacityParams } from "./pix-capacity.mjs";
import { enabledModels } from "./pix-plans.mjs";
import { productById } from "../src/game/storeCatalog.mjs";
import { gatewayAccess } from "./pix-gateway.mjs";
import { requireStore } from "./store-data.mjs";

const setupWindow = 30 * 60000;
const capacityMessage = "This Pix plan is at capacity. Your card has not been charged.";
function planFor(id) {
  const product = productById(id);
  requireStore(product?.kind === "subscription", 400, "Unknown Pix membership.", "bad_product");
  return product;
}
function ref(row) {
  return { id: row.id, productId: row.product_id };
}
function openInitial(db, user) {
  return db
    .prepare(
      "SELECT * FROM game_pix_funded_terms WHERE user_id=? AND kind='initial' AND state IN ('held','committed')",
    )
    .bind(user)
    .first();
}
async function wallet(env) {
  const result = await gatewayAccess(env, true);
  requireStore(result, 409, capacityMessage, "pix_capacity");
  requireStore(
    (await enabledModels(env)).length === 3,
    503,
    "All included Pix providers must be available before starting another paid term.",
    "providers_unavailable",
  );
  return result;
}
export async function pixAdmission(env, user, providers, billingReady) {
  const access = await gatewayAccess(env),
    now = Date.now();
  const db = env.GAME_ACCOUNTS;
  const [capacity, open] = await Promise.all([
    access
      ? db
          .prepare(capacitySql + "SELECT available FROM capacity")
          .bind(...capacityParams(access, now))
          .first()
      : null,
    user ? openInitial(db, user) : null,
  ]);
  const tiers = Object.fromEntries(
    plans.map((plan) => {
      const resume = open?.product_id === plan.id && (open.state === "committed" || open.hold_until > now);
      const reason =
        providers.length !== 3
          ? "providers_unavailable"
          : !access || (!resume && (capacity?.available ?? 0) < plan.budgetMicros)
            ? "wallet_capacity"
            : !billingReady
              ? "billing_unavailable"
              : "available";
      return [plan.id, { available: reason === "available", reason }];
    }),
  );
  return { native: false, tiers };
}
export async function reservePixCheckout(env, user, productId) {
  const plan = planFor(productId),
    db = env.GAME_ACCOUNTS,
    now = Date.now();
  const previous = await openInitial(db, user);
  if (previous?.product_id === productId && (previous.state === "committed" || previous.hold_until > now))
    return ref(previous);
  const access = await wallet(env),
    id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        "UPDATE game_pix_funded_terms SET state='released' WHERE user_id=? AND kind='initial' AND state='held' AND (hold_until<=? OR product_id!=?)",
      )
      .bind(user, now, productId),
    db
      .prepare(
        capacitySql +
          `INSERT OR IGNORE INTO game_pix_funded_terms(id,user_id,product_id,budget_micros,kind,state,created_at,hold_until)
      SELECT ?,?,?,?,'initial','held',?,? FROM capacity WHERE available>=?
      AND NOT EXISTS(SELECT 1 FROM game_purchases p JOIN plans ON plans.product_id=p.product_id WHERE p.user_id=? AND p.active=1 AND p.expires_at>?)`,
      )
      .bind(
        ...capacityParams(access, now),
        id,
        user,
        productId,
        plan.budgetMicros,
        now,
        now + setupWindow,
        plan.budgetMicros,
        user,
        now,
      ),
  ]);
  const row = await openInitial(db, user);
  requireStore(
    !row || row.product_id === productId,
    409,
    "Finish or cancel your existing Pix invoice first.",
    "pix_checkout_pending",
  );
  requireStore(row, 409, capacityMessage, "pix_capacity");
  return ref(row);
}
export async function commitPixCheckout(env, id, user, productId) {
  const db = env.GAME_ACCOUNTS,
    plan = planFor(productId),
    now = Date.now();
  const select = () =>
    db
      .prepare(
        "SELECT * FROM game_pix_funded_terms WHERE id=? AND user_id=? AND product_id=? AND kind='initial'",
      )
      .bind(id, user, productId)
      .first();
  let row = await select();
  requireStore(
    row && row.state !== "released",
    409,
    "Reopen the store to start a new checkout.",
    "pix_term_expired",
  );
  if (row.state !== "held") return ref(row);
  const access = await wallet(env);
  await db
    .prepare(
      capacitySql +
        `UPDATE game_pix_funded_terms SET state='committed' WHERE id=? AND user_id=? AND state='held'
    AND (SELECT available FROM capacity)>=? AND NOT EXISTS(SELECT 1 FROM game_purchases p JOIN plans ON plans.product_id=p.product_id
      WHERE p.user_id=? AND p.active=1 AND p.expires_at>?)`,
    )
    .bind(...capacityParams(access, now, id), id, user, plan.budgetMicros, user, now)
    .run();
  row = await select();
  requireStore(row && ["committed", "active"].includes(row.state), 409, capacityMessage, "pix_capacity");
  return ref(row);
}
function requirePeriod(start, end) {
  requireStore(
    Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start > 0 &&
      end > start &&
      end - start <= maxTerm,
    409,
    "The membership dates need a billing review.",
    "pix_term_dates",
  );
}
export async function attachPixSubscription(db, id, subscriptionId, start, end) {
  requirePeriod(start, end);
  const attached = await db
    .prepare(
      `UPDATE game_pix_funded_terms SET subscription_id=?,period_start=?,period_end=?
    WHERE id=? AND state IN ('committed','active') AND (subscription_id IS NULL OR
      (subscription_id=? AND period_start=? AND period_end=?)) RETURNING id`,
    )
    .bind(subscriptionId, start, end, id, subscriptionId, start, end)
    .first();
  requireStore(attached, 409, "The invoice does not match its Pix funding reservation.", "pix_term_mismatch");
}
export async function activatePixTerm(db, subscriptionId, start, end) {
  requirePeriod(start, end);
  return db
    .prepare(
      `UPDATE game_pix_funded_terms SET state='active' WHERE subscription_id=? AND period_start=? AND period_end=?
    AND state IN ('committed','active') RETURNING id`,
    )
    .bind(subscriptionId, start, end)
    .first();
}
export async function reservePixRenewal(env, user, productId, subscriptionId, start, end) {
  requirePeriod(start, end);
  const db = env.GAME_ACCOUNTS,
    plan = planFor(productId),
    now = Date.now();
  const current = () =>
    db
      .prepare(`SELECT * FROM game_pix_funded_terms WHERE subscription_id=? AND period_start=?`)
      .bind(subscriptionId, start)
      .first();
  const existing = await current();
  if (!existing) {
    const access = await wallet(env);
    await db
      .prepare(
        capacitySql +
          `INSERT OR IGNORE INTO game_pix_funded_terms
      (id,user_id,product_id,budget_micros,kind,state,created_at,hold_until,subscription_id,period_start,period_end)
      SELECT ?,?,?,?,'renewal','committed',?,0,?,?,? FROM capacity WHERE available>=? AND EXISTS(
        SELECT 1 FROM game_pix_funded_terms WHERE user_id=? AND product_id=? AND subscription_id=? AND period_end=? AND state='active')`,
      )
      .bind(
        ...capacityParams(access, now),
        crypto.randomUUID(),
        user,
        productId,
        plan.budgetMicros,
        now,
        subscriptionId,
        start,
        end,
        plan.budgetMicros,
        user,
        productId,
        subscriptionId,
        start,
      )
      .run();
  }
  const row = existing ?? (await current());
  requireStore(
    row &&
      row.user_id === user &&
      row.product_id === productId &&
      row.period_end === end &&
      row.state !== "released",
    409,
    capacityMessage,
    "pix_capacity",
  );
  return ref(row);
}
// Only the Stripe lifecycle calls this after confirming no invoice or renewal can still collect.
export async function releaseUnchargeablePixTerm(db, id) {
  return db
    .prepare("UPDATE game_pix_funded_terms SET state='released' WHERE id=? AND state IN ('held','committed')")
    .bind(id)
    .run();
}
