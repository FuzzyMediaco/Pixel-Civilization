import { GATEWAY_MODELS } from "./pix-gateway.mjs";
import { AccountError } from "./account-http.mjs";
import { DAY, asId, requireStore } from "./store-data.mjs";
import { STORE_PRODUCTS } from "../src/game/storeCatalog.mjs";
import { PIX_BILLING_CONSENT_VERSION, pixBillingConsentText } from "../src/game/pixBillingConsent.mjs";
import {
  reservePixCheckout,
  commitPixCheckout,
  attachPixSubscription,
  reservePixRenewal,
  releaseUnchargeablePixTerm,
} from "./pix-funding.mjs";

const HOUR = 3600000,
  LEASE = 3 * 60000;
const terms = STORE_PRODUCTS.filter((p) => p.kind === "subscription");
const idOf = (o, prefix) =>
  typeof asId(o) === "string" && new RegExp("^" + prefix + "[a-zA-Z0-9_]+$").test(asId(o)) ? asId(o) : null;
const sql = (db, statement, ...args) => db.prepare(statement).bind(...args);
const byTerm = (db, id) => sql(db, "SELECT * FROM game_stripe_funded WHERE first_term=?", id).first();
const byAccount = (db, user) =>
  sql(
    db,
    "SELECT * FROM game_stripe_funded WHERE user_id=? AND finished=0 ORDER BY created_at DESC LIMIT 1",
    user,
  ).first();
const pending = () =>
  new AccountError(409, "Stripe is confirming your billing setup. Check again shortly.", "checkout_pending");
const unsupported = () =>
  new AccountError(
    503,
    "Pix billing is waiting for a verified Stripe configuration.",
    "stripe_configuration",
  );
const doneStatus = (s) => ["canceled", "completed", "released"].includes(s);
const seconds = () => Math.floor(Date.now() / 1000);
const asEpoch = (s) => Number.isSafeInteger(s) && s > 0;
const sameId = (a, b) => typeof a === "string" && a === asId(b);
const q = encodeURIComponent;

export function fundedReady(env, keyReady, prices) {
  const ids = terms.map((p) => prices[p.id]);
  const verified = new Set((env.PIX_GATEWAY_VERIFIED_MODELS || "").split(",").map((value) => value.trim()));
  return Boolean(
    Object.values(GATEWAY_MODELS).every((model) => verified.has(model)) &&
      keyReady &&
      env.STRIPE_FUNDED_BILLING_READY === "true" &&
      /^bpc_[A-Za-z0-9]+$/.test(env.STRIPE_FUNDED_PORTAL_CONFIG || "") &&
      ids.every((id) => typeof id === "string" && /^price_[A-Za-z0-9]+$/.test(id)) &&
      new Set(ids).size === terms.length,
  );
}
export async function checkFundedPortal(env, stripe) {
  const config = await stripe(
    env,
    "billing_portal/configurations/" + q(env.STRIPE_FUNDED_PORTAL_CONFIG || ""),
  );
  if (
    !config.active ||
    config.id !== env.STRIPE_FUNDED_PORTAL_CONFIG ||
    config.login_page?.enabled === true ||
    config.features?.subscription_pause?.enabled === true ||
    config.features?.subscription_update?.enabled !== false ||
    config.features?.subscription_cancel?.enabled !== false ||
    config.features?.payment_method_update?.enabled !== true
  )
    throw unsupported();
  return config.id;
}
function invoiceUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ["invoice.stripe.com", "pay.stripe.com"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function phase(n, { start, end, price, sku, user, root, collection }) {
  const prefix = "phases[" + n + "]";
  const settings = {
    "items[0][price]": price,
    "items[0][quantity]": "1",
    "automatic_tax[enabled]": "true",
    billing_cycle_anchor: "phase_start",
    proration_behavior: "none",
    collection_method: collection,
    "metadata[pixel_account]": user,
    "metadata[pixel_product]": sku,
    "metadata[pixel_funded_root]": root,
    ...(start ? { start_date: String(start) } : {}),
    ...(end ? { end_date: String(end) } : { "duration[interval]": "month", "duration[interval_count]": "1" }),
    ...(collection === "send_invoice" ? { "invoice_settings[days_until_due]": "1" } : {}),
  };
  return Object.fromEntries(
    Object.entries(settings).map(([k, v]) => {
      const [name, ...nested] = k.split("[");
      return [prefix + "[" + name + "]" + (nested.length ? "[" + nested.join("[") : ""), v];
    }),
  );
}
function nextMonth(s) {
  const d = new Date(s * 1000),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime() / 1000;
}
function proveSchedule(schedule, row) {
  if (
    schedule.default_settings?.default_payment_method ||
    !idOf(schedule, "sub_sched_") ||
    !sameId(row.customer_id, schedule.customer) ||
    schedule.metadata?.pixel_funded_root !== row.first_term ||
    schedule.end_behavior !== "cancel"
  )
    throw unsupported();
}
function proveInvoice(invoice, row) {
  const sub = asId(invoice.parent?.subscription_details?.subscription ?? invoice.subscription);
  if (!idOf(invoice, "in_") || !sameId(row.customer_id, invoice.customer) || sub !== row.subscription_id)
    throw unsupported();
}
async function withLock(db, id, fn) {
  const tick = Date.now(),
    token = crypto.randomUUID();
  const row = await sql(
    db,
    "UPDATE game_stripe_funded SET lock_token=?,lock_until=? WHERE first_term=? AND lock_until<=? RETURNING *",
    token,
    tick + LEASE,
    id,
    tick,
  ).first();
  if (!row) throw pending();
  try {
    return await fn(row);
  } finally {
    await sql(
      db,
      "UPDATE game_stripe_funded SET lock_token=NULL,lock_until=0 WHERE first_term=? AND lock_token=?",
      id,
      token,
    ).run();
  }
}
export async function fundedSnapshot(db, user) {
  const r = await sql(
    db,
    "SELECT * FROM game_stripe_funded WHERE user_id=? ORDER BY finished,created_at DESC LIMIT 1",
    user,
  ).first();
  if (!r) return null;
  const grant =
    r.subscription_id &&
    (await sql(
      db,
      "SELECT expires_at FROM game_purchases WHERE store='stripe' AND receipt_key=? AND user_id=? AND active=1 AND expires_at>?",
      r.subscription_id,
      user,
      Date.now(),
    ).first());
  let state = "processing";
  if (r.finished) state = "ended";
  else if (grant) state = "active";
  else if (r.receipt_reversed) state = "revoked";
  else if (r.invoice_state === "open" && invoiceUrl(r.invoice_url)) state = "invoice_open";
  else if (r.renews && r.setup_session && r.setup_url && !r.create_started && r.setup_expires > Date.now())
    state = "setup_open";
  return {
    state,
    renews: !r.finished && Boolean(r.renews),
    paidThrough: grant?.expires_at ?? null,
    ...(state === "setup_open"
      ? { setupUrl: r.setup_url, productId: r.product_id, setupExpires: r.setup_expires }
      : {}),
    ...(state === "invoice_open" ? { invoiceUrl: r.invoice_url } : {}),
    cancelPending: !r.finished && !r.renews && !r.stop_confirmed,
  };
}
export async function startFunded(env, user, sku, price, stripe, customerFor, consent) {
  requireStore(
    consent?.accepted === true && consent.version === PIX_BILLING_CONSENT_VERSION,
    400,
    "Review and accept the monthly card authorization for this Pix plan before continuing.",
    "billing_consent_required",
  );
  const db = env.GAME_ACCOUNTS,
    current = await byAccount(db, user.id),
    now = Date.now();
  if (current && current.create_started) {
    if (current.product_id === sku.id && current.invoice_state === "open" && invoiceUrl(current.invoice_url))
      return { url: current.invoice_url };
    throw new AccountError(
      409,
      "A Pix billing agreement already exists. Check its billing status in the store.",
      "manage_subscription",
    );
  }
  await checkFundedPortal(env, stripe);
  const term = await reservePixCheckout(env, user.id, sku.id),
    customer = await customerFor(env, user);
  const expires = Math.floor(now / 1000) + 31 * 60;
  await sql(
    db,
    `INSERT OR IGNORE INTO game_stripe_funded(first_term,user_id,product_id,price_id,customer_id,consent_version,consent_text,consent_at,consent_price_cents,created_at,setup_expires,next_check)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    term.id,
    user.id,
    sku.id,
    price,
    customer,
    PIX_BILLING_CONSENT_VERSION,
    pixBillingConsentText(sku),
    now,
    sku.usdCents,
    now,
    expires * 1000,
    expires * 1000,
  ).run();
  return withLock(db, term.id, async (row) => {
    if (
      row.user_id !== user.id ||
      row.product_id !== sku.id ||
      row.price_id !== price ||
      row.finished ||
      !row.renews
    )
      throw pending();
    if (row.setup_session && row.setup_url && row.setup_expires > now) {
      const existing = await stripe(env, "checkout/sessions/" + q(row.setup_session));
      if (existing.status === "open") return { url: row.setup_url };
      if (existing.status === "complete")
        return {
          url:
            (env.STOREFRONT_ORIGIN || "https://pixelcivilization.app") +
            "/?purchase=complete&session_id=" +
            q(row.setup_session),
        };
      throw pending();
    }
    const origin = env.STOREFRONT_ORIGIN || "https://pixelcivilization.app";
    const session = await stripe(
      env,
      "checkout/sessions",
      {
        customer,
        mode: "setup",
        currency: "usd",
        billing_address_collection: "required",
        "customer_update[address]": "auto",
        "customer_update[name]": "auto",
        "payment_method_types[0]": "card",
        "custom_text[submit][message]": row.consent_text,
        "metadata[pixel_consent_version]": row.consent_version,
        "setup_intent_data[metadata][pixel_consent_version]": row.consent_version,
        "setup_intent_data[metadata][pixel_funded_root]": term.id,
        "metadata[pixel_funded_root]": term.id,
        "metadata[pixel_account]": user.id,
        "metadata[pixel_product]": sku.id,
        client_reference_id: user.id,
        expires_at: String(Math.floor(row.setup_expires / 1000)),
        success_url: origin + "/?purchase=complete&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/?purchase=canceled",
      },
      "pix-setup-" + term.id,
    );
    if (!idOf(session, "cs_") || session.mode !== "setup" || !sameId(customer, session.customer))
      throw unsupported();
    let url;
    try {
      url = new URL(session.url);
    } catch {
      throw unsupported();
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "checkout.stripe.com" ||
      url.port ||
      url.username ||
      url.password
    )
      throw unsupported();
    await sql(
      db,
      "UPDATE game_stripe_funded SET setup_session=?,setup_url=? WHERE first_term=?",
      session.id,
      url.href,
      term.id,
    ).run();
    return { url: url.href };
  });
}
async function findExistingSchedule(env, row, stripe) {
  let after = "",
    match = null;
  for (let page = 0; page < 20; page++) {
    const list = await stripe(
      env,
      "subscription_schedules?customer=" + q(row.customer_id) + "&limit=100" + after,
    );
    const matches = list.data.filter((s) => s.metadata?.pixel_funded_root === row.first_term);
    if (matches.length > 1 || (match && matches.length)) throw unsupported();
    if (matches.length) match = matches[0];
    if (!list.has_more) return match;
    if (!list.data.length) throw unsupported();
    after = "&starting_after=" + q(list.data.at(-1).id);
  }
  throw unsupported();
}
async function refreshFirstInvoice(env, row, invoice, stripe) {
  try {
    return await verifyFirstInvoice(env, row, invoice, stripe);
  } catch (error) {
    if (error?.code === "stripe_configuration" && ["open", "draft"].includes(invoice?.status)) {
      const binding = await byTerm(env.GAME_ACCOUNTS, row.first_term);
      const schedule = await stripe(env, "subscription_schedules/" + q(binding.schedule_id));
      proveSchedule(schedule, binding);
      await finishRemote(env, binding, schedule, stripe);
    }
    throw error;
  }
}
async function verifyFirstInvoice(env, row, invoice, stripe) {
  proveInvoice(invoice, row);
  const line = invoice.lines?.data?.[0];
  if (
    ["draft", "open"].includes(invoice.status) &&
    (invoice.collection_method !== "send_invoice" ||
      invoice.currency !== "usd" ||
      invoice.automatic_tax?.enabled !== true ||
      invoice.subtotal !== row.consent_price_cents ||
      invoice.lines?.has_more ||
      invoice.lines?.data?.length !== 1 ||
      line.quantity !== 1 ||
      !sameId(row.price_id, line.pricing?.price_details?.price ?? line.price))
  )
    throw unsupported();
  if (invoice.status === "draft")
    invoice = await stripe(
      env,
      "invoices/" + q(invoice.id) + "/finalize",
      { auto_advance: "false" },
      "pix-finalize-" + row.first_term,
    );
  proveInvoice(invoice, row);
  const url = invoiceUrl(invoice.hosted_invoice_url);
  if (
    invoice.status === "open" &&
    (!url ||
      invoice.collection_method !== "send_invoice" ||
      invoice.currency !== "usd" ||
      invoice.automatic_tax?.enabled !== true ||
      invoice.automatic_tax.status !== "complete" ||
      invoice.subtotal !== row.consent_price_cents ||
      !Number.isSafeInteger(invoice.amount_due) ||
      invoice.amount_due < invoice.subtotal)
  )
    throw unsupported();
  await sql(
    env.GAME_ACCOUNTS,
    "UPDATE game_stripe_funded SET invoice_id=?,invoice_state=?,invoice_url=? WHERE first_term=?",
    invoice.id,
    invoice.status,
    invoice.status === "open" ? url : null,
    row.first_term,
  ).run();
}
export async function completeFunded(env, session, expectedUser, stripe, reconcile, allowNew = false) {
  const db = env.GAME_ACCOUNTS,
    id = session.metadata?.pixel_funded_root;
  if (typeof id !== "string") return false;
  const saved = await byTerm(db, id);
  requireStore(
    saved && (!expectedUser || expectedUser === saved.user_id),
    403,
    "Sign in to the account that opened billing.",
    "receipt_owner",
  );
  if (!saved.user_id || saved.finished) return true;
  if (!saved.setup_session) throw pending();
  if (
    !sameId(saved.setup_session, session.id) ||
    !sameId(saved.customer_id, session.customer) ||
    session.client_reference_id !== saved.user_id ||
    session.metadata.pixel_account !== saved.user_id ||
    session.metadata.pixel_product !== saved.product_id ||
    session.mode !== "setup"
  )
    throw unsupported();
  if (
    !saved.consent_at ||
    !saved.consent_text ||
    session.metadata.pixel_consent_version !== saved.consent_version
  )
    throw unsupported();
  if (session.status !== "complete") throw pending();
  await withLock(db, id, async (row) => {
    if (row.finished) return;
    if (row.subscription_id && row.invoice_id) {
      const bill = await stripe(env, "invoices/" + q(row.invoice_id));
      await refreshFirstInvoice(env, row, bill, stripe);
      if (bill.status === "paid") await reconcile(env, row.subscription_id, row.user_id);
      return;
    }
    let schedule;
    if (row.schedule_id) schedule = await stripe(env, "subscription_schedules/" + q(row.schedule_id));
    else {
      const intentId = idOf(session.setup_intent, "seti_");
      if (!intentId) throw pending();
      const setup = await stripe(env, "setup_intents/" + q(intentId));
      if (
        setup.status !== "succeeded" ||
        setup.usage !== "off_session" ||
        !sameId(row.customer_id, setup.customer) ||
        setup.metadata?.pixel_funded_root !== id ||
        setup.metadata?.pixel_consent_version !== row.consent_version ||
        setup.payment_method_types?.length !== 1 ||
        setup.payment_method_types[0] !== "card"
      )
        throw unsupported();
      const payment = idOf(setup.payment_method, "pm_");
      if (!payment) throw unsupported();
      if (row.create_started) schedule = await findExistingSchedule(env, row, stripe);
      if (!schedule) {
        if (!row.renews || !allowNew) throw pending();
        if (row.create_started && Date.now() - row.create_started > 20 * HOUR)
          throw new AccountError(
            503,
            "Your saved payment method is being checked before an invoice can be issued.",
            "billing_review",
          );
        await checkFundedPortal(env, stripe);
        await commitPixCheckout(env, id, row.user_id, row.product_id);
        // The successful, customer-scoped card SetupIntent automatically attached the method. Using
        // the customer default lets the dedicated portal replace it for later authorized renewals.
        await stripe(
          env,
          "customers/" + q(row.customer_id),
          { "invoice_settings[default_payment_method]": payment },
          "pix-card-" + id,
        );
        await sql(
          db,
          "UPDATE game_stripe_funded SET create_started=COALESCE(create_started,?) WHERE first_term=?",
          Date.now(),
          id,
        ).run();
        schedule = await stripe(
          env,
          "subscription_schedules",
          {
            customer: row.customer_id,
            start_date: "now",
            end_behavior: "cancel",
            "metadata[pixel_funded_root]": id,
            ...phase(0, {
              sku: row.product_id,
              root: id,
              user: row.user_id,
              price: row.price_id,
              collection: "send_invoice",
            }),
          },
          "pix-schedule-" + id,
        );
      }
    }
    proveSchedule(schedule, row);
    const subId = idOf(schedule.subscription, "sub_");
    const first = schedule.phases[0];
    if (doneStatus(schedule.status)) throw pending();
    if (
      !subId ||
      !first ||
      !asEpoch(first.start_date) ||
      !asEpoch(first.end_date) ||
      first.collection_method !== "send_invoice" ||
      !sameId(row.price_id, first.items?.[0]?.price)
    )
      throw unsupported();
    phaseFields(row, first);
    await attachPixSubscription(db, id, subId, first.start_date * 1000, first.end_date * 1000);
    await sql(
      db,
      `UPDATE game_stripe_funded SET schedule_id=?,subscription_id=?,setup_url=NULL,current_end=COALESCE(current_end,?),
      authorized_end=COALESCE(authorized_end,?),next_check=? WHERE first_term=?`,
      schedule.id,
      subId,
      first.end_date * 1000,
      first.end_date * 1000,
      Date.now() + HOUR,
      id,
    ).run();
    const sub = await stripe(env, "subscriptions/" + q(subId) + "?expand[]=latest_invoice");
    if (!sameId(row.customer_id, sub.customer) || sub.metadata?.pixel_funded_root !== id) throw unsupported();
    let invoice = sub.latest_invoice;
    if (row.invoice_id && asId(invoice) !== row.invoice_id)
      invoice = await stripe(env, "invoices/" + q(row.invoice_id));
    else if (typeof invoice === "string") invoice = await stripe(env, "invoices/" + q(invoice));
    if (!invoice) throw pending();
    const fresh = await byTerm(db, id);
    if (!fresh.renews && invoice.status !== "paid") {
      await finishRemote(env, fresh, schedule, stripe);
      return;
    }
    await refreshFirstInvoice(env, { ...row, subscription_id: subId }, invoice, stripe);
    if (invoice.status === "paid") await reconcile(env, subId, row.user_id);
  });
  return true;
}

// The schedule, not a browser redirect or the cron job, is the final stop on Stripe's side.
function currentPhase(schedule) {
  const start = schedule.current_phase?.start_date,
    end = schedule.current_phase?.end_date;
  return schedule.phases.find((p) => p.start_date === start && p.end_date === end);
}
function phaseFields(row, remote) {
  if (
    !remote ||
    remote.items?.length !== 1 ||
    !sameId(row.price_id, remote.items[0].price) ||
    remote.items[0].quantity !== 1 ||
    remote.default_payment_method ||
    !["send_invoice", "charge_automatically"].includes(remote.collection_method) ||
    remote.automatic_tax?.enabled !== true
  )
    throw unsupported();
  return {
    start: remote.start_date,
    end: remote.end_date,
    price: row.price_id,
    sku: row.product_id,
    user: row.user_id,
    root: row.first_term,
    collection: remote.collection_method,
  };
}
async function invoicesFor(env, row, stripe) {
  const result = [];
  let after = "";
  for (let page = 0; page < 8; page++) {
    const list = await stripe(env, "invoices?subscription=" + q(row.subscription_id) + "&limit=100" + after);
    for (const bill of list.data) {
      proveInvoice(bill, row);
      result.push(bill);
    }
    if (!list.has_more) return result;
    if (!list.data.length) throw unsupported();
    after = "&starting_after=" + q(list.data.at(-1).id);
  }
  throw unsupported();
}
async function voidOutstanding(env, row, stripe) {
  for (let bill of await invoicesFor(env, row, stripe)) {
    if (bill.status === "draft") {
      bill = await stripe(
        env,
        "invoices/" + q(bill.id) + "/finalize",
        { auto_advance: "false" },
        "pix-close-final-" + bill.id,
      );
      proveInvoice(bill, row);
    }
    if (["open", "uncollectible"].includes(bill.status)) {
      bill = await stripe(env, "invoices/" + q(bill.id) + "/void", {}, "pix-void-" + bill.id);
      proveInvoice(bill, row);
    }
    if (!["paid", "void"].includes(bill.status)) throw pending();
  }
}
async function finishRemote(env, row, schedule, stripe) {
  const db = env.GAME_ACCOUNTS;
  if (!doneStatus(schedule.status)) {
    schedule = await stripe(
      env,
      "subscription_schedules/" + q(schedule.id) + "/cancel",
      { invoice_now: "false", prorate: "false" },
      "pix-end-" + row.first_term,
    );
    if (!doneStatus(schedule.status)) throw pending();
  }
  // A released schedule may leave a regular, indefinitely renewing subscription. Refuse to free funds.
  const sub = await stripe(env, "subscriptions/" + q(row.subscription_id));
  if (!sameId(row.customer_id, sub.customer) || !["canceled", "incomplete_expired"].includes(sub.status))
    throw pending();
  await voidOutstanding(env, row, stripe);
  const dbTerms = await sql(
    db,
    "SELECT id,period_start,period_end FROM game_pix_funded_terms WHERE (subscription_id=? OR id=?) AND state='committed'",
    row.subscription_id,
    row.first_term,
  ).all();
  // A delayed paid event still owns its period. Only release periods proven absent from every paid invoice.
  const paid = (await invoicesFor(env, row, stripe)).filter((b) => b.status === "paid");
  for (const term of dbTerms.results) {
    if (
      paid.every(
        (b) =>
          term.period_start &&
          term.period_end &&
          Array.isArray(b.lines?.data) &&
          !b.lines.has_more &&
          b.lines.data.every(
            (l) =>
              asEpoch(l.period?.end) &&
              asEpoch(l.period?.start) &&
              (l.period.end * 1000 <= term.period_start || l.period.start * 1000 >= term.period_end),
          ),
      )
    )
      await releaseUnchargeablePixTerm(db, term.id);
  }
  await sql(
    db,
    "UPDATE game_stripe_funded SET finished=1,renews=0,stop_confirmed=1,invoice_url=NULL WHERE first_term=?",
    row.first_term,
  ).run();
}
async function trimSchedule(env, row, schedule, current, stripe) {
  const db = env.GAME_ACCOUNTS,
    end = current.end_date,
    tail = schedule.phases.at(-1).end_date;
  if (tail > end) {
    const revised = await stripe(
      env,
      "subscription_schedules/" + q(schedule.id),
      { end_behavior: "cancel", proration_behavior: "none", ...phase(0, phaseFields(row, current)) },
      "pix-stop-" + row.first_term + "-" + end,
    );
    proveSchedule(revised, row);
    if (revised.phases.at(-1)?.end_date !== end) throw pending();
  }
  const holds = await sql(
    db,
    "SELECT id,period_start FROM game_pix_funded_terms WHERE subscription_id=? AND state='committed' AND period_start>=?",
    row.subscription_id,
    end * 1000,
  ).all();
  if (holds.results.length) {
    const bills = await invoicesFor(env, row, stripe);
    for (const hold of holds.results) {
      const collectible = bills.some(
        (b) =>
          b.status !== "void" &&
          b.lines?.data?.some((line) => line.period?.start * 1000 >= hold.period_start),
      );
      if (!collectible && bills.every((b) => !b.lines?.has_more && Array.isArray(b.lines?.data)))
        await releaseUnchargeablePixTerm(db, hold.id);
    }
  }
  await sql(
    db,
    "UPDATE game_stripe_funded SET stop_confirmed=1,authorized_end=?,current_end=?,next_check=? WHERE first_term=?",
    end * 1000,
    end * 1000,
    end * 1000 + 60000,
    row.first_term,
  ).run();
}
async function serviceSchedule(env, row, stripe, deleting = false, reconcile, allowRenew = false) {
  const db = env.GAME_ACCOUNTS;
  if (!row.schedule_id) {
    if (row.create_started) {
      const found = await findExistingSchedule(env, row, stripe);
      if (!found && Date.now() - row.create_started > DAY && (deleting || !row.renews)) {
        // The customer-scoped history includes completed and canceled schedules. After Stripe's
        // idempotency window and with starts closed, an empty history proves nothing can collect.
        await sql(
          db,
          "UPDATE game_stripe_funded SET finished=1,renews=0,stop_confirmed=1,setup_url=NULL WHERE first_term=?",
          row.first_term,
        ).run();
        await releaseUnchargeablePixTerm(db, row.first_term);
        return;
      }
      if (!found || !idOf(found.subscription ?? found.released_subscription, "sub_")) throw pending();
      proveSchedule(found, row);
      row = {
        ...row,
        schedule_id: found.id,
        subscription_id: asId(found.subscription ?? found.released_subscription),
      };
      await sql(
        db,
        "UPDATE game_stripe_funded SET schedule_id=?,subscription_id=? WHERE first_term=?",
        row.schedule_id,
        row.subscription_id,
        row.first_term,
      ).run();
    } else {
      if (!row.setup_session && Date.now() < row.setup_expires) throw pending();
      if (row.setup_session) {
        const setup = await stripe(env, "checkout/sessions/" + q(row.setup_session));
        if (!sameId(row.customer_id, setup.customer) || setup.metadata?.pixel_funded_root !== row.first_term)
          throw unsupported();
        if (setup.status === "open")
          await stripe(
            env,
            "checkout/sessions/" + q(setup.id) + "/expire",
            {},
            "pix-expire-" + row.first_term,
          );
      }
      await sql(
        db,
        "UPDATE game_stripe_funded SET finished=1,stop_confirmed=1,renews=0,setup_url=NULL WHERE first_term=?",
        row.first_term,
      ).run();
      await releaseUnchargeablePixTerm(db, row.first_term);
      return;
    }
  }
  const schedule = await stripe(env, "subscription_schedules/" + q(row.schedule_id));
  proveSchedule(schedule, row);
  if (deleting || doneStatus(schedule.status) || (!row.renews && !row.invoice_id))
    return finishRemote(env, row, schedule, stripe);
  const current = currentPhase(schedule);
  const currentConfig = phaseFields(row, current),
    now = seconds();
  if (row.invoice_id && row.invoice_state !== "paid") {
    const first = await stripe(env, "invoices/" + q(row.invoice_id));
    proveInvoice(first, row);
    if (first.status !== "paid" && (Date.now() - row.create_started >= 23 * HOUR || !row.renews))
      return finishRemote(env, row, schedule, stripe);
    await refreshFirstInvoice(env, row, first, stripe);
    row.invoice_state = first.status;
  }
  if (reconcile && row.invoice_state === "paid") {
    await reconcile(env, row.subscription_id, row.user_id);
    row = await byTerm(db, row.first_term);
  }
  if (!row.renews) return trimSchedule(env, row, schedule, current, stripe);
  const tail = schedule.phases.at(-1);
  const updateNext = (when) =>
    sql(
      db,
      "UPDATE game_stripe_funded SET current_end=?,next_check=CASE WHEN renews=0 AND stop_confirmed=0 THEN 0 ELSE ? END WHERE first_term=?",
      current.end_date * 1000,
      when,
      row.first_term,
    ).run();
  if (row.invoice_state !== "paid") {
    await updateNext(Date.now() + HOUR);
    return;
  }
  if (tail.end_date > current.end_date) {
    const funding = await sql(
      db,
      "SELECT id FROM game_pix_funded_terms WHERE subscription_id=? AND period_start=? AND period_end=? AND state IN ('committed','active')",
      row.subscription_id,
      current.end_date * 1000,
      tail.end_date * 1000,
    ).first();
    if (!funding) throw unsupported();
    await sql(
      db,
      "UPDATE game_stripe_funded SET authorized_end=? WHERE first_term=?",
      tail.end_date * 1000,
      row.first_term,
    ).run();
    await updateNext(current.end_date * 1000 + 60000);
    return;
  }
  if (current.end_date - now > (3 * DAY) / 1000) {
    await updateNext((current.end_date - (3 * DAY) / 1000) * 1000);
    return;
  }
  if (current.end_date - now < 300) {
    await updateNext(current.end_date * 1000 + 60000);
    return;
  }
  const currentGrant = await sql(
    db,
    "SELECT receipt_key FROM game_purchases WHERE store='stripe' AND receipt_key=? AND user_id=? AND active=1 AND expires_at>?",
    row.subscription_id,
    row.user_id,
    Date.now(),
  ).first();
  if (!currentGrant || !allowRenew) {
    await updateNext(Math.min(current.end_date * 1000, Date.now() + HOUR));
    return;
  }
  const nextEnd = nextMonth(current.end_date);
  let reservation;
  try {
    reservation = await reservePixRenewal(
      env,
      row.user_id,
      row.product_id,
      row.subscription_id,
      current.end_date * 1000,
      nextEnd * 1000,
    );
  } catch (error) {
    if (error instanceof AccountError && error.code === "pix_capacity") {
      await updateNext(Math.min(Date.now() + HOUR, current.end_date * 1000));
      return;
    }
    throw error;
  }
  // Never lift the final cap. Add exactly one month which has already been funded.
  const fresh = await byTerm(db, row.first_term);
  if (!fresh.renews) return trimSchedule(env, fresh, schedule, current, stripe);
  const update = await stripe(
    env,
    "subscription_schedules/" + q(schedule.id),
    {
      end_behavior: "cancel",
      proration_behavior: "none",
      ...phase(0, currentConfig),
      ...phase(1, {
        ...currentConfig,
        start: current.end_date,
        end: nextEnd,
        collection: "charge_automatically",
      }),
    },
    "pix-renew-" + reservation.id,
  );
  proveSchedule(update, row);
  const future = update.phases.at(-1);
  if (
    future.start_date !== current.end_date ||
    future.end_date !== nextEnd ||
    !sameId(row.price_id, future.items?.[0]?.price)
  )
    throw unsupported();
  const requested = await byTerm(db, row.first_term);
  if (!requested.renews) return trimSchedule(env, requested, update, current, stripe);
  await sql(
    db,
    "UPDATE game_stripe_funded SET current_end=?,authorized_end=?,next_check=CASE WHEN renews=0 THEN 0 ELSE ? END WHERE first_term=?",
    current.end_date * 1000,
    nextEnd * 1000,
    current.end_date * 1000 + 60000,
    row.first_term,
  ).run();
}
export async function stopFunded(env, user, stripe, deleting = false) {
  const db = env.GAME_ACCOUNTS,
    rows = await sql(
      db,
      "SELECT first_term FROM game_stripe_funded WHERE user_id=? AND finished=0",
      user,
    ).all();
  if (!rows.results.length) return false;
  for (const { first_term: id } of rows.results) {
    await sql(
      db,
      "UPDATE game_stripe_funded SET renews=0,next_check=? WHERE first_term=?",
      Date.now(),
      id,
    ).run();
    await withLock(db, id, (row) => serviceSchedule(env, row, stripe, deleting));
  }
  return true;
}
export async function maintainFunded(env, stripe, reconcile, allowRenew = false) {
  const db = env.GAME_ACCOUNTS;
  const pendingRows = await sql(
    db,
    "SELECT first_term FROM game_stripe_funded WHERE finished=0 AND next_check<=? AND lock_until<=? ORDER BY next_check LIMIT 16",
    Date.now(),
    Date.now(),
  ).all();
  for (const { first_term: id } of pendingRows.results) {
    try {
      const row = await byTerm(db, id);
      if (row.setup_session && row.renews && !row.invoice_id) {
        const session = await stripe(env, "checkout/sessions/" + q(row.setup_session));
        if (
          session.status === "complete" &&
          (row.create_started || (allowRenew && Date.now() < row.setup_expires))
        ) {
          await completeFunded(env, session, row.user_id, stripe, reconcile, allowRenew);
          continue;
        }
      }
      await withLock(db, id, (locked) => serviceSchedule(env, locked, stripe, false, reconcile, allowRenew));
    } catch (error) {
      await sql(
        db,
        "UPDATE game_stripe_funded SET next_check=? WHERE first_term=?",
        Date.now() + 15 * 60000,
        id,
      ).run();
      console.warn(
        "Pix subscription reconciliation deferred",
        error instanceof AccountError ? error.code : "stripe_unavailable",
      );
    }
  }
}
