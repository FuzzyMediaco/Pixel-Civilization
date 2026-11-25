import assert from "node:assert/strict";
import test from "node:test";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { activatePixTerm } from "../worker/pix-funding.mjs";
import { GATEWAY_MODELS } from "../worker/pix-gateway.mjs";
import {
  completeFunded,
  fundedSnapshot,
  maintainFunded,
  startFunded,
  stopFunded,
} from "../worker/funded-subscriptions.mjs";
import { recordPurchase, DAY } from "../worker/store-data.mjs";
import { productById } from "../src/game/storeCatalog.mjs";

function simulation(t: any) {
  const { db, sqlite } = openAccountDatabase(":memory:");
  t.after(() => sqlite.close());
  const start = Date.UTC(2027, 0, 31, 12) / 1000,
    end = Date.UTC(2027, 1, 28, 12) / 1000;
  t.mock.timers.enable({ apis: ["Date"], now: start * 1000 });
  const cfg = {
    id: "bpc_game",
    active: true,
    login_page: { enabled: false },
    features: {
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
      payment_method_update: { enabled: true },
    },
  };
  const user = { id: "player", email: "test@example.test" },
    customer = "cus_player",
    price = "price_starter",
    sku = productById("pix_starter");
  sqlite.prepare("INSERT INTO game_users VALUES(?,?,?, ?,?)").run(user.id, user.email, "x", "y", 1);
  let credits = 1000;
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, result: { balance: credits } }),
  );
  const env = {
    GAME_ACCOUNTS: db,
    AI: { run() {} },
    PIX_GATEWAY_ACCOUNT: "a".repeat(32),
    PIX_GATEWAY_ID: "game",
    PIX_GATEWAY_READ_TOKEN: "fixture",
    PIX_GATEWAY_VERIFIED_MODELS: Object.values(GATEWAY_MODELS).join(","),
    STRIPE_FUNDED_PORTAL_CONFIG: cfg.id,
  };
  const calls: { path: string; form: any; idem?: string }[] = [];
  let session: any, first: any, schedule: any;
  let dropCreate = false,
    blockVoid = false,
    root = "";
  const bills: any[] = [];
  const phase = (from: number, to: number, collection: string) => ({
    start_date: from,
    end_date: to,
    items: [{ price, quantity: 1 }],
    collection_method: collection,
    automatic_tax: { enabled: true },
  });
  const bill = (id: string, from: number, to: number) => ({
    id,
    customer,
    subscription: "sub_player",
    status: "draft",
    currency: "usd",
    collection_method: "send_invoice",
    subtotal: sku.usdCents,
    amount_due: sku.usdCents + 33,
    automatic_tax: { enabled: true, status: "complete" },
    hosted_invoice_url: "https://invoice.stripe.com/i/first",
    lines: {
      data: [{ pricing: { price_details: { price } }, quantity: 1, period: { start: from, end: to } }],
    },
  });
  async function stripe(_env: any, path: string, form?: any, idem?: string): Promise<any> {
    calls.push({ path, form, idem });
    if (path.startsWith("billing_portal/configurations/")) return cfg;
    if (path === "checkout/sessions" && form) {
      root = form["metadata[pixel_funded_root]"];
      session = {
        id: "cs_test_checkout",
        mode: "setup",
        customer,
        url: "https://checkout.stripe.com/c/pay/card",
        client_reference_id: user.id,
        status: "open",
        metadata: { pixel_funded_root: root, pixel_product: sku.id, pixel_account: user.id },
      };
      assert.equal(form["consent_collection[terms_of_service]"], "required");
      return session;
    }
    if (path === "checkout/sessions/" + session?.id) return session;
    if (path === "checkout/sessions/" + session?.id + "/expire") {
      session.status = "expired";
      return session;
    }
    if (path === "setup_intents/seti_test")
      return {
        status: "succeeded",
        usage: "off_session",
        customer,
        metadata: { pixel_funded_root: root },
        payment_method: "pm_test",
        payment_method_types: ["card"],
      };
    if (path === "customers/" + customer) {
      assert.equal(form["invoice_settings[default_payment_method]"], "pm_test");
      return { id: customer };
    }
    if (path.startsWith("subscription_schedules?"))
      return { data: schedule ? [schedule] : [], has_more: false };
    if (path === "subscription_schedules") {
      assert.equal(form.end_behavior, "cancel");
      assert.equal(form["phases[0][collection_method]"], "send_invoice");
      assert.equal(form["phases[0][duration][interval]"], "month");
      assert.equal(form["phases[0][duration][interval_count]"], "1");
      assert.equal(form["phases[0][items][0][price]"], price);
      assert.equal(form["phases[0][automatic_tax][enabled]"], "true");
      assert.equal(ledger()[0]?.state, "committed");
      schedule = {
        id: "sub_sched_player",
        subscription: "sub_player",
        customer,
        metadata: { pixel_funded_root: root },
        end_behavior: "cancel",
        status: "active",
        current_phase: { start_date: start, end_date: end },
        phases: [phase(start, end, "send_invoice")],
      };
      first = bill("in_first", start, end);
      bills.push(first);
      if (dropCreate) {
        dropCreate = false;
        throw Error("response lost after Stripe created schedule");
      }
      return schedule;
    }
    if (path === "subscription_schedules/sub_sched_player/cancel") {
      schedule.status = "canceled";
      return schedule;
    }
    if (path === "subscription_schedules/sub_sched_player") {
      if (form) {
        assert.equal(form.end_behavior, "cancel");
        const current = schedule.phases[0];
        schedule.phases = [current];
        if (form["phases[1][end_date]"]) {
          const from = Number(form["phases[1][start_date]"]),
            to = Number(form["phases[1][end_date]"]);
          assert.ok(
            ledger().some(
              (p: any) =>
                p.state === "committed" && p.period_start === from * 1000 && p.period_end === to * 1000,
            ),
          );
          assert.equal(form["phases[1][collection_method]"], "charge_automatically");
          schedule.phases.push(phase(from, to, "charge_automatically"));
        }
      }
      return schedule;
    }
    if (path.startsWith("subscriptions/sub_player"))
      return {
        id: "sub_player",
        customer,
        status: schedule.status === "canceled" ? "canceled" : "active",
        metadata: { pixel_funded_root: root },
        latest_invoice: first,
      };
    if (path.startsWith("invoices?subscription=")) return { data: bills, has_more: false };
    const inv = bills.find((b) => path === "invoices/" + b.id || path.startsWith("invoices/" + b.id + "/"));
    if (inv) {
      if (path.endsWith("/finalize")) {
        assert.equal(form.auto_advance, "false");
        inv.status = "open";
      }
      if (path.endsWith("/void")) {
        if (blockVoid) throw Error("Stripe cancellation unavailable");
        inv.status = "void";
      }
      return inv;
    }
    throw Error("unhandled Stripe request " + path);
  }
  const ledger = () =>
    sqlite.prepare("SELECT * FROM game_pix_funded_terms ORDER BY created_at,id").all() as any[];
  const row = () => sqlite.prepare("SELECT * FROM game_stripe_funded WHERE first_term=?").get(root) as any;
  async function reconcile() {
    if (first.status !== "paid") return;
    await activatePixTerm(db, "sub_player", start * 1000, end * 1000);
    await recordPurchase(db, {
      store: "stripe",
      key: "sub_player",
      user: user.id,
      product: sku.id,
      active: true,
      start: start * 1000,
      end: end * 1000,
      checked: Date.now(),
      next: end * 1000,
      source: "sub_player",
    });
  }
  const begin = () => startFunded(env, user, sku, price, stripe, async () => customer);
  const confirm = async () => {
    session.status = "complete";
    session.consent = { terms_of_service: "accepted" };
    session.setup_intent = "seti_test";
    return completeFunded(env, session, user.id, stripe, reconcile, true);
  };
  const stop = (deleting = false) => stopFunded(env, user.id, stripe, deleting);
  const maintain = (allowed = true) => {
    sqlite.prepare("UPDATE game_stripe_funded SET next_check=0").run();
    return maintainFunded(env, stripe, reconcile, allowed);
  };
  return {
    begin,
    confirm,
    stop,
    maintain,
    ledger,
    row,
    calls,
    cfg,
    env,
    user,
    db,
    start,
    end,
    now: (ms: number) => t.mock.timers.setTime(ms),
    schedule: () => schedule,
    bill: () => first,
    complete: (s: any) => completeFunded(env, s, user.id, stripe, reconcile, true),
    session: () => session,
    appendDraft: () => bills.push(bill("in_extra", end, end + 28 * 86400)),
    state: () => fundedSnapshot(db, user.id),
    credits: (n: number) => (credits = n),
    drop: () => (dropCreate = true),
    blockVoid: (b: boolean) => (blockVoid = b),
    pay: async () => {
      first.status = "paid";
      await confirm();
    },
  };
}

test("only the bound, completed, consented session can issue a tax-complete collectible invoice backed by a pinned budget", async (t) => {
  const x = simulation(t);
  x.cfg.features.subscription_update.enabled = true;
  await assert.rejects(x.begin(), { code: "stripe_configuration" });
  assert.equal(x.ledger().length, 0);
  x.cfg.features.subscription_update.enabled = false;
  await x.begin();
  assert.equal(x.ledger()[0].state, "held");
  const forged = {
    ...x.session(),
    id: "cs_other",
    status: "complete",
    consent: { terms_of_service: "accepted" },
  };
  await assert.rejects(x.complete(forged), { code: "stripe_configuration" });
  await assert.rejects(x.complete({ ...x.session(), status: "complete" }), { code: "checkout_pending" });
  assert.equal(x.schedule(), undefined);
  await x.confirm();
  const initial = await x.state();
  assert.equal(initial?.state, "invoice_open");
  assert.equal(initial?.invoiceUrl, "https://invoice.stripe.com/i/first");
  assert.equal(initial?.paidThrough, null);
  assert.equal(x.schedule().phases.length, 1);
  await x.pay();
  assert.equal((await x.state())?.state, "active");
  assert.equal(x.calls.filter((c) => c.path === "subscription_schedules").length, 1);
});

test("an interrupted schedule creation is recovered by its funded reference when the player never returns", async (t) => {
  const x = simulation(t);
  await x.begin();
  x.drop();
  await assert.rejects(x.confirm(), /response lost/);
  assert.equal(x.ledger()[0].state, "committed");
  assert.equal(x.row().schedule_id, null);
  await x.maintain();
  assert.equal(x.row().subscription_id, "sub_player");
  assert.equal(x.calls.filter((c) => c.path === "subscription_schedules").length, 1);
  assert.equal((await x.state())?.state, "invoice_open");
});

test("an expired setup cannot create a charge after cancellation", async (t) => {
  const x = simulation(t);
  await x.begin();
  await x.stop();
  assert.equal(x.ledger()[0].state, "released");
  assert.equal(x.session().status, "expired");
  await x.confirm();
  assert.equal(x.schedule(), undefined);
  assert.equal((await x.state())?.state, "ended");
});

test("the provider-side cutoff holds without money or disabled sales; exactly one prepaid month is added once affordable", async (t) => {
  const x = simulation(t);
  await x.begin();
  await x.confirm();
  await x.pay();
  x.now((x.end - 2 * 86400) * 1000);
  x.credits(100);
  await x.maintain();
  assert.equal(x.schedule().phases.length, 1);
  x.credits(1000);
  await x.maintain(false);
  assert.equal(x.schedule().phases.length, 1);
  await x.maintain();
  assert.equal(x.schedule().phases.length, 2);
  assert.equal(x.schedule().phases[1].start_date, x.end);
  assert.equal(x.schedule().phases[1].end_date, Date.UTC(2027, 2, 28, 12) / 1000);
  assert.equal(x.ledger().filter((p) => p.kind === "renewal" && p.state === "committed").length, 1);
  await x.maintain();
  assert.equal(x.calls.filter((c) => c.idem?.startsWith("pix-renew-")).length, 1);
  await x.stop();
  assert.equal(x.schedule().phases.length, 1);
  assert.equal(x.ledger().find((p) => p.kind === "renewal").state, "released");
  assert.deepEqual(await x.state(), {
    state: "active",
    renews: false,
    paidThrough: x.end * 1000,
    cancelPending: false,
  });
});

test("account closure cannot release an unpaid promise until all drafts and hosted invoices are permanently void", async (t) => {
  const x = simulation(t);
  await x.begin();
  await x.confirm();
  x.appendDraft();
  x.blockVoid(true);
  await assert.rejects(x.stop(true), /cancellation unavailable/);
  assert.equal(x.row().finished, 0);
  assert.equal(x.ledger()[0].state, "committed");
  x.blockVoid(false);
  await x.stop(true);
  assert.equal(x.row().finished, 1);
  assert.equal(x.bill().status, "void");
  assert.ok(x.calls.some((c) => c.path === "invoices/in_extra/finalize"));
  assert.ok(x.calls.some((c) => c.path === "invoices/in_extra/void"));
  assert.equal(x.ledger()[0].state, "released");
});

test("abandoned unpaid first invoices expire on Stripe and unsafe hosted invoice URLs stay private", async (t) => {
  const x = simulation(t);
  await x.begin();
  await x.confirm();
  x.bill().hosted_invoice_url = "https://invoice.stripe.com.evil.example/private";
  await assert.rejects(x.confirm(), { code: "stripe_configuration" });
  x.now(x.start * 1000 + DAY);
  await x.maintain();
  assert.equal(x.bill().status, "void");
  assert.equal((await x.state())?.state, "ended");
  assert.equal(x.ledger()[0].state, "released");
});
