import { STORE_PRODUCTS, productById } from "../src/game/storeCatalog.mjs";
import { digestStripeReference } from "./stripe-links.mjs";
import { asId, DAY, requireStore } from "./store-data.mjs";

const plans = STORE_PRODUCTS.filter((product) => product.kind === "subscription");
const valid = (value, pattern) => typeof value === "string" && pattern.test(value);
const subscriptionId = (value) => valid(value, /^sub_[A-Za-z0-9]+$/);
const customerId = (value) => valid(value, /^cus_[A-Za-z0-9]+$/);
const invoiceId = (value) => valid(value, /^in_[A-Za-z0-9]+$/);
const intentId = (value) => valid(value, /^pi_[A-Za-z0-9]+$/);
const checkoutId = (value) => valid(value, /^cs_test_[A-Za-z0-9]{12,220}$/);
const epoch = (value) => Number.isSafeInteger(value) && value > 0;
const cents = (value) => Number.isSafeInteger(value) && value > 0;

export function recurringSandbox(env, url) {
  if (env.STRIPE_RECURRING_LINKS_SANDBOX !== "true" || !url) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
function catalog(env) {
  try {
    const config = JSON.parse(env.STRIPE_RECURRING_PAYMENT_LINKS || "{}");
    const result = new Map(),
      seen = new Set();
    for (const plan of plans) {
      const item = config[plan.id];
      if (
        !valid(item?.id, /^plink_[A-Za-z0-9]+$/) ||
        !valid(item.price, /^price_[A-Za-z0-9]+$/) ||
        !valid(item.url, /^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+$/)
      )
        return new Map();
      for (const unique of [item.id, item.price, item.url]) {
        if (seen.has(unique)) return new Map();
        seen.add(unique);
      }
      result.set(plan.id, item);
    }
    return result;
  } catch {
    return new Map();
  }
}
function portalUrl(env) {
  return valid(
    env.STRIPE_RECURRING_PORTAL_URL,
    /^https:\/\/billing\.stripe\.com\/p\/login\/test_[A-Za-z0-9]+$/,
  )
    ? env.STRIPE_RECURRING_PORTAL_URL
    : null;
}
export function recurringLinksReady(env, url) {
  return Boolean(
    recurringSandbox(env, url) &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_TAX_READY === "true" &&
      portalUrl(env) &&
      catalog(env).size === plans.length,
  );
}

export async function existingHostedPlan(db, user) {
  return db
    .prepare(
      `SELECT s.subscription, st.status, st.cancel_at_end FROM game_pix_link_sessions s
    LEFT JOIN game_pix_link_status st ON st.subscription=s.subscription WHERE s.user_id=?
    AND (st.status IS NULL OR st.status NOT IN ('canceled','incomplete_expired')) LIMIT 1`,
    )
    .bind(user)
    .first();
}
export function recurringPortal(env, user) {
  requireStore(portalUrl(env), 503, "The billing portal is temporarily unavailable.", "portal_unavailable");
  const url = new URL(portalUrl(env));
  url.searchParams.set("prefilled_email", user.email);
  return { url: url.href };
}
export async function recurringCheckout(env, user, id, url) {
  requireStore(
    recurringLinksReady(env, url),
    503,
    "This payment method is unavailable.",
    "unavailable_product",
  );
  const db = env.GAME_ACCOUNTS,
    offer = catalog(env).get(id);
  requireStore(offer, 400, "Unknown subscription.", "bad_product");
  if (await existingHostedPlan(db, user.id)) return recurringPortal(env, user);
  const now = Date.now(),
    expires = now + 30 * 60000,
    ticket = crypto.randomUUID();
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO game_pix_link_offers(link_id,product_id,price_id) VALUES(?,?,?)")
      .bind(offer.id, id, offer.price),
    db
      .prepare(
        `INSERT INTO game_checkouts(user_id,scope,product_id,ticket,expires_at) VALUES(?,'monthly',?,?,?)
      ON CONFLICT(user_id,scope) DO UPDATE SET product_id=excluded.product_id,ticket=excluded.ticket,session_id=NULL,
      expires_at=excluded.expires_at WHERE game_checkouts.expires_at<=?`,
      )
      .bind(user.id, id, ticket, expires, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO game_link_tickets(reference,user_id,product_id,link_id,issued_at,expires_at)
      SELECT c.ticket,c.user_id,c.product_id,o.link_id,?,c.expires_at FROM game_checkouts c JOIN game_pix_link_offers o
      ON o.product_id=c.product_id AND o.price_id=? AND o.link_id=? WHERE c.user_id=? AND c.scope='monthly' AND c.ticket=?`,
      )
      .bind(now, offer.price, offer.id, user.id, ticket),
  ]);
  const owned = await db
    .prepare(
      `SELECT t.reference,t.product_id FROM game_checkouts c JOIN game_link_tickets t
    ON t.reference=c.ticket AND t.link_id=? WHERE c.user_id=? AND c.scope='monthly' AND c.expires_at>?`,
    )
    .bind(offer.id, user.id, now)
    .first();
  requireStore(owned?.product_id === id, 409, "Another monthly checkout is pending.", "checkout_pending");
  const next = new URL(offer.url);
  next.searchParams.set("client_reference_id", owned.reference);
  next.searchParams.set("locked_prefilled_email", user.email);
  return { url: next.href };
}

async function rememberCheckout(db, object) {
  if (
    !checkoutId(object.id) ||
    object.mode !== "subscription" ||
    object.status !== "complete" ||
    object.payment_status !== "paid" ||
    object.currency !== "usd" ||
    !customerId(asId(object.customer)) ||
    !subscriptionId(asId(object.subscription)) ||
    !epoch(object.created)
  )
    return;
  const ticket = await db
    .prepare(
      `SELECT t.reference,t.user_id,t.product_id,u.email,o.price_id
    FROM game_link_tickets t JOIN game_users u ON u.id=t.user_id JOIN game_pix_link_offers o
    ON t.link_id=o.link_id AND o.product_id=t.product_id WHERE t.reference=? AND t.link_id=?
    AND t.issued_at<=? AND t.expires_at>=?`,
    )
    .bind(
      object.client_reference_id ?? "",
      asId(object.payment_link) ?? "",
      object.created * 1000 + 999,
      object.created * 1000,
    )
    .first();
  if (!ticket) return;
  const product = productById(ticket.product_id);
  if (
    ticket.email.toLowerCase() !== object.customer_details?.email?.toLowerCase() ||
    object.amount_subtotal !== product.usdCents ||
    !(object.amount_total >= product.usdCents) ||
    object.total_details?.amount_discount !== 0 ||
    object.automatic_tax?.status !== "complete" ||
    !object.automatic_tax.enabled
  )
    return;
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_pix_link_sessions(subscription,session_hash,customer,ticket,product_id,price_id,user_id)
    VALUES(?,?,?,?,?,?,?)`,
    )
    .bind(
      asId(object.subscription),
      await digestStripeReference(object.id),
      asId(object.customer),
      ticket.reference,
      ticket.product_id,
      ticket.price_id,
      ticket.user_id,
    )
    .run();
}

async function rememberSubscription(db, event, object) {
  if (!subscriptionId(object.id) || !customerId(asId(object.customer)) || !epoch(event.created)) return;
  const items = object.items?.data ?? [],
    item = items[0],
    price = asId(item?.price);
  const known =
    price &&
    (await db.prepare("SELECT product_id FROM game_pix_link_offers WHERE price_id=?").bind(price).first());
  const prior = await db
    .prepare("SELECT price_id FROM game_pix_link_status WHERE subscription=?")
    .bind(object.id)
    .first();
  if (!known && !prior) return;
  const removed =
    event.type === "customer.subscription.deleted" ||
    ["incomplete_expired", "canceled"].includes(object.status);
  const accepted =
    known &&
    items.length === 1 &&
    !object.items.has_more &&
    item.quantity === 1 &&
    item.price?.recurring?.interval === "month" &&
    item.price.recurring.interval_count === 1 &&
    item.price.currency === "usd" &&
    item.price.unit_amount === productById(known.product_id).usdCents;
  const status = removed ? "canceled" : accepted ? String(object.status) : "unsupported";
  const precedence = removed ? 3 : status === "active" ? 1 : 2;
  await db
    .prepare(
      `INSERT INTO game_pix_link_status(subscription,customer,price_id,status,cancel_at_end,event_time,precedence)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(subscription) DO UPDATE SET price_id=excluded.price_id,status=excluded.status,
    cancel_at_end=excluded.cancel_at_end,event_time=excluded.event_time,precedence=excluded.precedence
    WHERE game_pix_link_status.customer=excluded.customer AND game_pix_link_status.precedence<3 AND
    (excluded.precedence=3 OR excluded.event_time>game_pix_link_status.event_time OR
    (excluded.event_time=game_pix_link_status.event_time AND excluded.precedence>game_pix_link_status.precedence))`,
    )
    .bind(
      object.id,
      asId(object.customer),
      price || prior.price_id,
      status,
      Number(object.cancel_at_period_end === true),
      event.created,
      precedence,
    )
    .run();
}

async function rememberInvoice(db, o) {
  const items = o.lines?.data ?? [],
    line = items[0],
    price = asId(line?.pricing?.price_details?.price);
  const sub = asId(o.parent?.subscription_details?.subscription);
  if (
    !invoiceId(o.id) ||
    !customerId(asId(o.customer)) ||
    !subscriptionId(sub) ||
    !price ||
    !["subscription_create", "subscription_cycle"].includes(o.billing_reason) ||
    o.status !== "paid" ||
    o.currency !== "usd" ||
    o.collection_method !== "charge_automatically" ||
    items.length !== 1 ||
    o.lines.has_more ||
    line.quantity !== 1 ||
    line.parent?.type !== "subscription_item_details" ||
    line.parent.subscription_item_details?.proration !== false ||
    o.automatic_tax?.enabled !== true ||
    o.automatic_tax.status !== "complete" ||
    o.amount_remaining !== 0 ||
    !cents(o.amount_paid) ||
    o.amount_paid !== o.total ||
    o.amount_paid !== o.amount_due ||
    !epoch(line.period?.start) ||
    !epoch(line.period?.end)
  )
    return;
  const days = (line.period.end - line.period.start) / 86400;
  if (days < 27 || days > 32) return;
  const offer = await db
    .prepare("SELECT product_id FROM game_pix_link_offers WHERE price_id=?")
    .bind(price)
    .first();
  if (!offer) return;
  const amount = productById(offer.product_id).usdCents;
  if (
    o.subtotal !== amount ||
    line.amount !== amount ||
    o.amount_paid < amount ||
    o.total_discount_amounts?.some((d) => d.amount > 0)
  )
    return;
  await db
    .prepare(
      `INSERT OR IGNORE INTO game_pix_link_invoices(invoice,subscription,customer,price_id,period_start,period_end,amount_paid)
    VALUES(?,?,?,?,?,?,?)`,
    )
    .bind(o.id, sub, asId(o.customer), price, line.period.start * 1000, line.period.end * 1000, o.amount_paid)
    .run();
}

async function rememberPayment(db, o) {
  if (
    o.status !== "paid" ||
    o.currency !== "usd" ||
    !cents(o.amount_paid) ||
    o.amount_paid !== o.amount_requested ||
    o.payment?.type !== "payment_intent" ||
    !intentId(asId(o.payment.payment_intent)) ||
    !invoiceId(asId(o.invoice))
  )
    return;
  const hash = await digestStripeReference(asId(o.payment.payment_intent));
  await db
    .prepare(
      "INSERT OR IGNORE INTO game_pix_link_invoice_payments(invoice,intent_hash,amount_paid,observed_at) VALUES(?,?,?,?)",
    )
    .bind(asId(o.invoice), hash, o.amount_paid, Date.now())
    .run();
}

export async function recurringEvent(env, event, url) {
  if (!recurringSandbox(env, url) || event.livemode !== false || event.data?.object?.livemode !== false)
    return false;
  const db = env.GAME_ACCOUNTS,
    object = event.data.object;
  if (event.type === "checkout.session.completed" && object.mode === "subscription" && object.payment_link) {
    await rememberCheckout(db, object);
    return true;
  }
  if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    await rememberSubscription(db, event, object);
  else if (event.type === "invoice.paid") await rememberInvoice(db, object);
  else if (event.type === "invoice_payment.paid") await rememberPayment(db, object);
  // Allow API-backed orders and existing refund/dispute processing to run independently.
  return false;
}

export async function hostedReceipt(db, id, user) {
  const bound = await db
    .prepare("SELECT subscription,user_id FROM game_pix_link_sessions WHERE session_hash=?")
    .bind(await digestStripeReference(id))
    .first();
  if (!bound) return false;
  requireStore(bound.user_id === user, 403, "Sign in to the account that opened checkout.", "receipt_owner");
  const active = await db
    .prepare(
      "SELECT 1 FROM game_pix_link_entitlements WHERE subscription=? AND expires_at>? AND period_start<=?",
    )
    .bind(bound.subscription, Date.now(), Date.now())
    .first();
  if (!active) {
    const facts = await db
      .prepare(
        `SELECT st.status, MAX(i.period_end) AS last_end,
      MAX(CASE WHEN i.period_start <= ? AND i.period_end > ? THEN r.blocked ELSE 0 END) AS reversed
      FROM game_pix_link_status st LEFT JOIN game_pix_link_invoices i ON i.subscription=st.subscription
      LEFT JOIN game_pix_link_invoice_payments p ON p.invoice=i.invoice
      LEFT JOIN game_link_reversals r ON r.payment_key=p.intent_hash WHERE st.subscription=? GROUP BY st.subscription`,
      )
      .bind(Date.now(), Date.now(), bound.subscription)
      .first();
    requireStore(
      !facts?.reversed,
      409,
      "The paid period was refunded or is under dispute.",
      "payment_reversed",
    );
    requireStore(
      !["canceled", "unpaid", "past_due", "paused", "unsupported"].includes(facts?.status),
      409,
      "This subscription is inactive. Check its status in the billing portal.",
      "manage_subscription",
    );
    requireStore(
      !facts?.last_end || facts.last_end > Date.now(),
      409,
      "This paid period has ended.",
      "period_ended",
    );
    requireStore(false, 409, "Waiting for the paid subscription and its billing period.", "checkout_pending");
  }
  return true;
}
export async function cleanOrphanPayments(db, now) {
  await db
    .prepare(
      `DELETE FROM game_pix_link_invoice_payments WHERE observed_at<? AND NOT EXISTS
    (SELECT 1 FROM game_pix_link_invoices i WHERE i.invoice=game_pix_link_invoice_payments.invoice)`,
    )
    .bind(now - 60 * DAY)
    .run();
}
