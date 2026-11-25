import { AccountError, json } from "./account-http.mjs";
import { DAY, asId, recordPurchase, requireStore, utf8 } from "./store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";

function prices(env) {
  try {
    return JSON.parse(env.STRIPE_PRICE_IDS || "{}");
  } catch {
    return {};
  }
}
export function stripeAvailable(env) {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PORTAL_CONFIG &&
      env.STRIPE_TAX_READY === "true" &&
      Object.keys(prices(env)).length,
  );
}
function skuForPrice(env, id) {
  return Object.entries(prices(env)).find(([, price]) => price === id)?.[0];
}
const escape = encodeURIComponent;
const appUrl = (env) => env.STOREFRONT_ORIGIN || "https://pixelcivilization.app";
async function stripe(env, path, form, idem) {
  requireStore(env.STRIPE_SECRET_KEY, 503, "Web purchases are currently unavailable.", "missing_stripe");
  const headers = { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Stripe-Version": "2026-11-18.endive" };
  if (idem) headers["Idempotency-Key"] = idem;
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: form ? "POST" : "GET",
    headers,
    ...(form ? { body: new URLSearchParams(form) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok)
    throw new AccountError(
      503,
      "Stripe could not complete this request. Try again shortly.",
      "stripe_unavailable",
    );
  return res.json();
}
async function customerFor(env, user) {
  const db = env.GAME_ACCOUNTS;
  let row = await db
    .prepare("SELECT customer_id FROM game_stripe_customers WHERE user_id=?")
    .bind(user.id)
    .first();
  if (row) return row.customer_id;
  const customer = await stripe(
    env,
    "customers",
    { email: user.email, "metadata[pixel_account]": user.id },
    "pixel-customer-" + user.id,
  );
  await db
    .prepare(
      "INSERT INTO game_stripe_customers(user_id,customer_id) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING",
    )
    .bind(user.id, customer.id)
    .run();
  row = await db
    .prepare("SELECT customer_id FROM game_stripe_customers WHERE user_id=?")
    .bind(user.id)
    .first();
  return row.customer_id;
}
export async function checkout(env, user, id) {
  const sku = productById(id),
    price = prices(env)[id];
  requireStore(
    sku && typeof price === "string" && /^price_[a-zA-Z0-9]+$/.test(price) && stripeAvailable(env),
    503,
    "This item is not yet available for web purchase.",
    "unavailable_product",
  );
  const customer = await customerFor(env, user),
    subscription = sku.kind === "subscription";
  const details = await stripe(env, "prices/" + escape(price));
  requireStore(
    details.active === true &&
      details.currency === "usd" &&
      details.unit_amount === sku.usdCents &&
      (subscription
        ? details.type === "recurring" &&
          details.recurring?.interval === "month" &&
          details.recurring.interval_count === 1
        : details.type === "one_time"),
    503,
    "The checkout price is being updated. Try again soon.",
    "price_mismatch",
  );
  const db = env.GAME_ACCOUNTS,
    scope = subscription ? "monthly" : sku.id,
    now = Date.now(),
    origin = appUrl(env);
  const existing = await db
    .prepare("SELECT * FROM game_checkouts WHERE user_id=? AND scope=?")
    .bind(user.id, scope)
    .first();
  if (existing?.session_id && existing.expires_at > now) {
    const previous = await stripe(env, "checkout/sessions/" + escape(existing.session_id));
    if (previous.status === "complete") {
      await reconcileSession(env, previous.id, user.id);
      if (subscription) return portal(env, user);
      throw new AccountError(
        409,
        "This payment was submitted. Refresh your purchases before trying again.",
        "checkout_submitted",
      );
    }
    if (previous.status === "open" && existing.product_id === sku.id) return { url: previous.url };
    if (previous.status === "open")
      await stripe(env, "checkout/sessions/" + escape(previous.id) + "/expire", {});
    await db
      .prepare("DELETE FROM game_checkouts WHERE user_id=? AND scope=? AND ticket=?")
      .bind(user.id, scope, existing.ticket)
      .run();
  }
  const ticket = crypto.randomUUID();
  const slot = await db
    .prepare(
      "INSERT INTO game_checkouts(user_id,scope,product_id,ticket,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET product_id=excluded.product_id,ticket=excluded.ticket,session_id=NULL,expires_at=excluded.expires_at WHERE game_checkouts.expires_at<=? RETURNING ticket",
    )
    .bind(user.id, scope, sku.id, ticket, now + 60000, now)
    .first();
  requireStore(slot, 409, "Checkout is opening. Please try again in a moment.", "checkout_pending");
  const form = {
    customer,
    mode: subscription ? "subscription" : "payment",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "automatic_tax[enabled]": "true",
    billing_address_collection: "required",
    "customer_update[address]": "auto",
    "customer_update[name]": "auto",
    "payment_method_types[0]": "card",
    client_reference_id: user.id,
    "metadata[pixel_account]": user.id,
    "metadata[pixel_product]": sku.id,
    success_url: origin + "/?purchase=complete&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/?purchase=canceled",
    integration_identifier: "pixel_civilization_pqxtsklm",
  };
  if (subscription) form["subscription_data[metadata][pixel_account]"] = user.id;
  else form["payment_intent_data[metadata][pixel_account]"] = user.id;
  // Store the server-created session before exposing its URL. A failed grant or response can be retried.
  const session = await stripe(env, "checkout/sessions", form, "pixel-checkout-" + ticket);
  const saved = await db
    .prepare(
      "UPDATE game_checkouts SET session_id=?,expires_at=? WHERE user_id=? AND scope=? AND ticket=? RETURNING ticket",
    )
    .bind(session.id, session.expires_at * 1000, user.id, scope, ticket)
    .first();
  if (!saved) {
    await stripe(env, "checkout/sessions/" + escape(session.id) + "/expire", {});
    throw new AccountError(409, "Checkout changed. Reopen the store.", "checkout_changed");
  }
  return { url: session.url };
}
export async function portal(env, user) {
  const row = await env.GAME_ACCOUNTS.prepare("SELECT customer_id FROM game_stripe_customers WHERE user_id=?")
    .bind(user.id)
    .first();
  requireStore(row, 404, "This account has no web billing profile.", "no_billing");
  requireStore(
    typeof env.STRIPE_PORTAL_CONFIG === "string" && /^bpc_[a-zA-Z0-9]+$/.test(env.STRIPE_PORTAL_CONFIG),
    503,
    "The game billing portal is currently unavailable.",
    "portal_unavailable",
  );
  return {
    url: (
      await stripe(env, "billing_portal/sessions", {
        customer: row.customer_id,
        configuration: env.STRIPE_PORTAL_CONFIG,
        return_url: appUrl(env) + "/?purchase=manage",
      })
    ).url,
  };
}
async function userForCustomer(env, customer) {
  if (!customer) return null;
  return (
    await env.GAME_ACCOUNTS.prepare("SELECT user_id FROM game_stripe_customers WHERE customer_id=?")
      .bind(asId(customer))
      .first()
  )?.user_id;
}
async function charged(env, pi) {
  if (!pi) return false;
  const intent =
    typeof pi === "object"
      ? pi
      : await stripe(env, "payment_intents/" + escape(pi) + "?expand[]=latest_charge");
  const charge =
    typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : intent.latest_charge && (await stripe(env, "charges/" + escape(intent.latest_charge)));
  if (!charge || intent.status !== "succeeded" || charge.refunded || charge.amount_refunded >= charge.amount)
    return false;
  if (charge.disputed) {
    const disputes = await stripe(env, "disputes?charge=" + escape(charge.id) + "&limit=10");
    if (
      !disputes.data.length ||
      disputes.data.some((d) => d.status !== "won" && d.status !== "warning_closed")
    )
      return false;
  }
  return true;
}
export async function reconcileSession(env, id, expectedUser) {
  const checked = Date.now();
  const session = await stripe(
    env,
    "checkout/sessions/" + escape(id) + "?expand[]=line_items&expand[]=payment_intent.latest_charge",
  );
  const user = await userForCustomer(env, session.customer);
  if (expectedUser)
    requireStore(user === expectedUser, 403, "Sign in to the account that opened checkout.", "receipt_owner");
  if (
    !user ||
    session.client_reference_id !== user ||
    session.metadata?.pixel_account !== user ||
    session.status !== "complete"
  )
    return;
  if (session.mode === "subscription") {
    if (session.subscription) await reconcileSubscription(env, asId(session.subscription), user);
    return;
  }
  const line = session.line_items?.data?.[0],
    product = skuForPrice(env, asId(line?.price)),
    sku = productById(product);
  if (
    !sku ||
    sku.kind === "subscription" ||
    sku.id !== session.metadata?.pixel_product ||
    line.quantity !== 1
  )
    return;
  const active = session.payment_status === "paid" && (await charged(env, session.payment_intent));
  if (!session.payment_intent) return;
  await recordPurchase(env.GAME_ACCOUNTS, {
    store: "stripe",
    key: asId(session.payment_intent),
    user,
    product,
    active,
    start: session.created * 1000,
    end: null,
    checked,
    next: checked + 365 * DAY,
    source: session.id,
  });
}
async function reconcileSubscription(env, id, expectedUser) {
  const checked = Date.now();
  const sub = await stripe(env, "subscriptions/" + escape(id) + "?expand[]=latest_invoice");
  const user = await userForCustomer(env, sub.customer);
  if (!user || (expectedUser && user !== expectedUser)) return;
  const item = sub.items?.data?.find(
    (i) => productById(skuForPrice(env, asId(i.price)))?.kind === "subscription",
  );
  if (!item) {
    await env.GAME_ACCOUNTS.prepare(
      "UPDATE game_purchases SET active=0,checked_at=? WHERE store='stripe' AND receipt_key=? AND user_id=? AND checked_at<=?",
    )
      .bind(checked, id, user, checked)
      .run();
    return;
  }
  let active = ["active", "trialing"].includes(sub.status);
  const invoice = sub.latest_invoice;
  if (active && invoice?.status !== "paid" && sub.status !== "trialing") active = false;
  if (active && invoice?.amount_paid > 0) {
    const payments = await stripe(env, "invoice_payments?invoice=" + escape(invoice.id) + "&limit=10");
    const paid = payments.data.filter((p) => p.status === "paid" && p.payment?.payment_intent);
    // This checkout accepts card payments. Check the latest paid invoice's live refund/dispute state.
    active = false;
    for (const payment of paid)
      if (await charged(env, payment.payment.payment_intent)) {
        active = true;
        break;
      }
  }
  const start = Number(item.current_period_start ?? sub.current_period_start) * 1000,
    end = Number(item.current_period_end ?? sub.current_period_end) * 1000;
  requireStore(
    Number.isFinite(start) && Number.isFinite(end),
    503,
    "Stripe's billing period is unavailable.",
    "bad_period",
  );
  await recordPurchase(env.GAME_ACCOUNTS, {
    store: "stripe",
    key: id,
    user,
    product: skuForPrice(env, asId(item.price)),
    active,
    start,
    end,
    checked,
    next: checked + DAY,
    source: id,
  });
}
async function reconcileCharge(env, chargeId) {
  const charge = await stripe(env, "charges/" + escape(chargeId));
  const pi = asId(charge.payment_intent);
  if (!pi || !(await userForCustomer(env, charge.customer))) return;
  const sessions = await stripe(env, "checkout/sessions?payment_intent=" + escape(pi));
  for (const session of sessions.data) await reconcileSession(env, session.id);
  const payments = await stripe(
    env,
    "invoice_payments?payment[type]=payment_intent&payment[payment_intent]=" + escape(pi),
  );
  for (const payment of payments.data) {
    const invoice = await stripe(env, "invoices/" + escape(asId(payment.invoice)));
    const sub = asId(invoice.parent?.subscription_details?.subscription ?? invoice.subscription);
    if (sub) await reconcileSubscription(env, sub);
  }
}
async function signedEvent(request, secret) {
  requireStore(secret, 503, "Web billing is unavailable.", "missing_stripe");
  const header = request.headers.get("Stripe-Signature") || "";
  const fields = header.split(",").map((s) => s.trim().split("=")),
    time = fields.find(([k]) => k === "t")?.[1];
  requireStore(
    /^\d{9,12}$/.test(time || "") && Math.abs(Date.now() / 1000 - Number(time)) <= 300,
    400,
    "Invalid event date.",
    "bad_signature",
  );
  const reader = request.body?.getReader();
  requireStore(reader, 400, "Missing event.", "bad_event");
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512000) {
      await reader.cancel();
      throw new AccountError(413, "Event too large.", "event_too_large");
    }
    chunks.push(value);
  }
  const prefix = utf8(time + "."),
    bytes = new Uint8Array(prefix.length + size);
  bytes.set(prefix);
  let offset = prefix.length;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const key = await crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const signatures = fields.filter(([k, v]) => k === "v1" && /^[a-f\d]{64}$/i.test(v));
  const checks = await Promise.all(
    signatures.slice(0, 4).map(([, hex]) =>
      crypto.subtle.verify(
        "HMAC",
        key,
        Uint8Array.from(hex.match(/../g), (n) => parseInt(n, 16)),
        bytes,
      ),
    ),
  );
  requireStore(checks.includes(true), 400, "Invalid event signature.", "bad_signature");
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(prefix.length)));
  } catch {
    throw new AccountError(400, "Invalid event.", "bad_event");
  }
}
export async function stripeWebhook(request, env) {
  const event = await signedEvent(request, env.STRIPE_WEBHOOK_SECRET);
  requireStore(
    typeof event.id === "string" && /^evt_[\w]+$/.test(event.id),
    400,
    "Invalid event ID.",
    "bad_event",
  );
  const db = env.GAME_ACCOUNTS;
  if (await db.prepare("SELECT event_id FROM game_stripe_events WHERE event_id=?").bind(event.id).first())
    return json({ received: true });
  const object = event.data?.object;
  // This merchant also sells other products. Only game customers need reconciliation.
  if (object?.customer && !(await userForCustomer(env, object.customer))) return json({ received: true });
  if (!env.STRIPE_SECRET_KEY && !(await db.prepare("SELECT 1 FROM game_stripe_customers LIMIT 1").first()))
    return json({ received: true });
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type))
    await reconcileSession(env, object.id);
  else if (
    [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  )
    await reconcileSubscription(env, object.id);
  else if (["invoice.paid", "invoice.payment_failed"].includes(event.type)) {
    const id = asId(object.parent?.subscription_details?.subscription ?? object.subscription);
    if (id) await reconcileSubscription(env, id);
  } else if (event.type === "charge.refunded") await reconcileCharge(env, object.id);
  else if (["charge.dispute.created", "charge.dispute.closed"].includes(event.type))
    await reconcileCharge(env, asId(object.charge));
  await db
    .prepare("INSERT OR IGNORE INTO game_stripe_events(event_id,processed_at) VALUES(?,?)")
    .bind(event.id, Date.now())
    .run();
  return json({ received: true });
}
export async function cancelWebSubscriptions(env, user) {
  const row = await env.GAME_ACCOUNTS.prepare("SELECT customer_id FROM game_stripe_customers WHERE user_id=?")
    .bind(user)
    .first();
  if (!row) return;
  // Deleting a Stripe customer cancels their recurring subscriptions, including past due or pending ones.
  const response = await fetch("https://api.stripe.com/v1/customers/" + escape(row.customer_id), {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "Stripe-Version": "2026-11-18.endive",
    },
    signal: AbortSignal.timeout(12000),
  });
  requireStore(
    response.ok || response.status === 404,
    503,
    "Web billing could not be closed. Your account is still available.",
    "stripe_unavailable",
  );
}
