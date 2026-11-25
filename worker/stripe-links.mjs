import { asId, DAY, requireStore, utf8 } from "./store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";

function links(env) {
  const items = new Map();
  const seen = new Set();
  let config;
  try {
    config = JSON.parse(env.STRIPE_PAYMENT_LINKS || "{}");
  } catch {
    return items;
  }
  for (const [sku, link] of Object.entries(config || {})) {
    const product = productById(sku);
    if (!product || product.kind === "subscription" || !/^plink_[a-zA-Z0-9]+$/.test(link?.id || "")) continue;
    // Only Stripe's canonical HTTPS checkout URL can be sent to a browser.
    if (typeof link.url !== "string" || !/^https:\/\/buy\.stripe\.com\/[a-zA-Z0-9_]+$/.test(link.url))
      continue;
    if (seen.has(link.id) || seen.has(link.url)) return new Map();
    seen.add(link.id);
    seen.add(link.url);
    items.set(sku, link);
  }
  return items;
}
export function paymentLinksReady(env) {
  return Boolean(env.STRIPE_WEBHOOK_SECRET && env.STRIPE_TAX_READY === "true" && links(env).size);
}
export async function linkCheckout(env, user, productId) {
  const link = links(env).get(productId);
  requireStore(
    paymentLinksReady(env) && link,
    503,
    "This item is not yet available for web purchase.",
    "unavailable_product",
  );
  const db = env.GAME_ACCOUNTS,
    now = Date.now();
  const existing = await db
    .prepare(
      "SELECT reference FROM game_link_tickets WHERE user_id=? AND product_id=? AND link_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1",
    )
    .bind(user.id, productId, link.id, now + 60000)
    .first();
  const reference = existing?.reference || crypto.randomUUID();
  if (!existing)
    await db
      .prepare(
        "INSERT INTO game_link_tickets(reference,user_id,product_id,link_id,issued_at,expires_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(reference, user.id, productId, link.id, now, now + 30 * 60000)
      .run();
  const url = new URL(link.url);
  url.searchParams.set("client_reference_id", reference);
  return { url: url.href };
}
export async function digestStripeReference(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(value))), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
const returnedSession = /^cs_(?:test_|live_)?[a-zA-Z0-9]{16,220}$/;
const paymentId = /^pi_[a-zA-Z0-9]+$/;

// All writers derive the entitlement from the current database facts inside the same D1 transaction.
function synchronize(db, payment) {
  return db
    .prepare(
      `INSERT INTO game_purchases(store,receipt_key,user_id,product_id,active,period_start,expires_at,checked_at,refresh_at,source)
    SELECT 'stripe','link:'||r.payment_key,r.user_id,r.product_id,
      r.paid AND NOT EXISTS(SELECT 1 FROM game_link_reversals v WHERE v.payment_key=r.payment_key AND v.blocked=1),
      r.started_at,NULL,?,?,'payment_link'
    FROM game_link_receipts r WHERE r.payment_key=? AND r.user_id IS NOT NULL
    ON CONFLICT(store,receipt_key) DO UPDATE SET active=excluded.active,checked_at=excluded.checked_at
    WHERE game_purchases.user_id=excluded.user_id AND game_purchases.product_id=excluded.product_id`,
    )
    .bind(Date.now(), Date.now() + 365 * DAY, payment);
}
export async function claimLinkReceipt(db, sessionId, userId) {
  if (!returnedSession.test(sessionId)) return false;
  const key = await digestStripeReference(sessionId);
  const known = await db
    .prepare("SELECT payment_key FROM game_link_receipts WHERE session_key=?")
    .bind(key)
    .first();
  if (!known) return false;
  await db.batch([
    db
      .prepare("UPDATE game_link_receipts SET user_id=?,assigned=1 WHERE session_key=? AND assigned=0")
      .bind(userId, key),
    synchronize(db, known.payment_key),
  ]);
  const receipt = await db
    .prepare(
      `SELECT r.user_id,r.paid,r.failed,p.active FROM game_link_receipts r
    LEFT JOIN game_purchases p ON p.store='stripe' AND p.receipt_key='link:'||r.payment_key WHERE r.session_key=?`,
    )
    .bind(key)
    .first();
  requireStore(
    receipt?.user_id === userId,
    403,
    "Sign in to the game account that owns this purchase.",
    "receipt_owner",
  );
  requireStore(
    !receipt.failed || receipt.paid,
    409,
    "Stripe could not complete that payment.",
    "payment_failed",
  );
  requireStore(
    receipt.paid,
    409,
    "Your payment is still being confirmed. Refresh your purchases shortly.",
    "checkout_pending",
  );
  requireStore(receipt.active, 409, "This purchase was refunded or is under dispute.", "payment_reversed");
  return true;
}
async function receiveSession(db, event, session, product, linkId) {
  const pi = asId(session.payment_intent),
    started = Number(session.created) * 1000;
  requireStore(
    returnedSession.test(session.id) && Number.isSafeInteger(started) && started > 0,
    400,
    "Invalid Stripe session.",
    "bad_session",
  );
  const paid = session.payment_status === "paid";
  const failed = event.type === "checkout.session.async_payment_failed";
  if (!pi && !paid) return;
  requireStore(
    paymentId.test(pi || "") &&
      session.status === "complete" &&
      session.mode === "payment" &&
      session.currency === "usd" &&
      session.amount_subtotal === product.usdCents &&
      session.amount_total >= product.usdCents &&
      session.total_details?.amount_discount === 0 &&
      session.automatic_tax?.enabled === true &&
      (!paid || session.automatic_tax.status === "complete"),
    409,
    "The received payment does not match this game's configured product.",
    "payment_mismatch",
  );
  const ticket =
    typeof session.client_reference_id === "string" && session.client_reference_id.length <= 80
      ? session.client_reference_id
      : "";
  const sessionKey = await digestStripeReference(session.id),
    paymentKey = await digestStripeReference(pi);
  await db.batch([
    db
      .prepare(
        `INSERT INTO game_link_receipts(session_key,payment_key,product_id,user_id,assigned,started_at,paid,failed)
      SELECT ?,?,?,t.user_id,t.reference IS NOT NULL,?,?,? FROM (SELECT 1) AS base
      LEFT JOIN game_link_tickets t ON t.reference=? AND t.product_id=? AND t.link_id=? AND t.issued_at<=? AND t.expires_at>=?
      WHERE 1
      ON CONFLICT(session_key) DO UPDATE SET paid=MAX(game_link_receipts.paid,excluded.paid), failed=MAX(game_link_receipts.failed,excluded.failed)
      WHERE game_link_receipts.payment_key=excluded.payment_key AND game_link_receipts.product_id=excluded.product_id`,
      )
      .bind(
        sessionKey,
        paymentKey,
        product.id,
        started,
        Number(paid),
        Number(failed),
        ticket,
        product.id,
        linkId,
        started + 1000,
        started,
      ),
    synchronize(db, paymentKey),
  ]);
}
const checkoutEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);
const disputeEvents = new Set(["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"]);
export async function applyLinkEvent(db, env, event) {
  const obj = event.data?.object;
  if (checkoutEvents.has(event.type)) {
    const linkId = asId(obj?.payment_link);
    if (!linkId) return false;
    const match = [...links(env)].find(([, link]) => link.id === linkId);
    // A rotated or disabled link can still have valid open checkouts and delayed signed events.
    const historical =
      !match &&
      (await db
        .prepare("SELECT product_id FROM game_link_tickets WHERE link_id=? LIMIT 1")
        .bind(linkId)
        .first());
    const product = productById(match?.[0] || historical?.product_id);
    if (product && product.kind !== "subscription") await receiveSession(db, event, obj, product, linkId);
    return true;
  }
  if (!obj || (event.type !== "charge.refunded" && !disputeEvents.has(event.type))) return false;
  const pi = asId(obj.payment_intent);
  // A Payment Link always uses a PaymentIntent. Legacy stand-alone charges belong to other merchant products.
  if (!paymentId.test(pi || "")) return false;
  let eventKey, blocked, terminal;
  if (event.type === "charge.refunded") {
    if (!obj.refunded && !(obj.amount > 0 && obj.amount_refunded >= obj.amount)) return false;
    eventKey = "full_refund";
    blocked = true;
    terminal = true;
  } else {
    if (!/^dp_[a-zA-Z0-9]+$/.test(obj.id || "")) return false;
    eventKey = await digestStripeReference(obj.id);
    terminal =
      event.type === "charge.dispute.closed" || ["won", "lost", "warning_closed"].includes(obj.status);
    blocked = !["won", "warning_closed"].includes(obj.status);
  }
  const payment = await digestStripeReference(pi);
  if (
    !links(env).size &&
    !(await db
      .prepare("SELECT 1 FROM game_link_tickets UNION ALL SELECT 1 FROM game_link_receipts LIMIT 1")
      .bind()
      .first())
  )
    return false;
  await db.batch([
    db
      .prepare(
        `INSERT INTO game_link_reversals(payment_key,event_key,blocked,terminal,event_time) VALUES(?,?,?,?,?)
      ON CONFLICT(payment_key,event_key) DO UPDATE SET blocked=excluded.blocked,terminal=excluded.terminal,event_time=excluded.event_time
      WHERE excluded.terminal>game_link_reversals.terminal OR (excluded.terminal=game_link_reversals.terminal AND excluded.event_time>=game_link_reversals.event_time)`,
      )
      .bind(payment, eventKey, Number(blocked), Number(terminal), Number(event.created)),
    synchronize(db, payment),
  ]);
  return false; // A key-backed subscription on this merchant may also need reconciliation.
}
