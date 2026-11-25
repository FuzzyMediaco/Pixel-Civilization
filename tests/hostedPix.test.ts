import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { accountRequest } from "../worker/accounts.mjs";
import { commerceRequest } from "../worker/commerce.mjs";
import { STORE_PRODUCTS } from "../src/game/storeCatalog.mjs";

const local = "http://127.0.0.1:8765",
  live = "https://pixelcivilization.app";
const secret = "test-event-signing-fixture";
const tiers = STORE_PRODUCTS.filter((p) => p.kind === "subscription");
const offers = Object.fromEntries(
  tiers.map((p, i) => [
    p.id,
    {
      id: "plink_Test" + i,
      price: "price_Test" + i,
      url: "https://buy.stripe.com/test_ABC" + i,
    },
  ]),
);
const sec = Math.floor(Date.now() / 1000),
  month = 30 * 86400;

async function fixture(t: any) {
  const { db, sqlite } = openAccountDatabase(":memory:");
  t.after(() => sqlite.close());
  // Older checkouts of the local dev server apply known migrations individually.
  if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='game_pix_link_offers'").get())
    sqlite.exec(readFileSync(new URL("../migrations/0007_hosted_pix.sql", import.meta.url), "utf8"));
  const env: any = {
    GAME_ACCOUNTS: db,
    STRIPE_RECURRING_LINKS_SANDBOX: "true",
    STRIPE_WEBHOOK_SECRET: secret,
    STRIPE_TAX_READY: "true",
    STRIPE_RECURRING_PORTAL_URL: "https://billing.stripe.com/p/login/test_Portal",
    STRIPE_RECURRING_PAYMENT_LINKS: JSON.stringify(offers),
    OPENAI_API_KEY: "test-provider",
    ANTHROPIC_API_KEY: "test-provider",
    GEMINI_API_KEY: "test-provider",
  };
  const request = (path: string, body?: any, cookie = "", origin = local) =>
    new Request(origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const register = async (email: string) => {
    const res = await accountRequest(
      request("/api/account/register", {
        email,
        password: "island game password",
      }),
      env,
    );
    return res.headers.get("set-cookie")!.split(";")[0];
  };
  const owner = await register("owner@example.test"),
    other = await register("other@example.test");
  const call = (path: string, body?: any, cookie = owner, origin = local) =>
    commerceRequest(request("/api/commerce/" + path, body, cookie, origin), env);
  const send = async (type: string, data: any, eventTime = sec, liveMode = false) => {
    const text = JSON.stringify({
      id: "evt_" + crypto.randomUUID().replaceAll("-", ""),
      type,
      created: eventTime,
      livemode: liveMode,
      data: { object: { ...data, livemode: liveMode } },
    });
    const at = Math.floor(Date.now() / 1000),
      hash = createHmac("sha256", secret)
        .update(at + "." + text)
        .digest("hex");
    const response = await commerceRequest(
      new Request(local + "/api/commerce/stripe/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "t=" + at + ",v1=" + hash },
        body: text,
      }),
      env,
    );
    assert.equal(response.status, 200, await response.text());
  };
  const remove = () =>
    accountRequest(
      new Request(local + "/api/account/me", {
        method: "DELETE",
        headers: { Cookie: owner, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "island game password" }),
      }),
      env,
    );
  return { sqlite, env, call, send, owner, other, remove };
}
const sku = tiers[0],
  offer = offers[sku.id];
const session = (ref: string) => ({
  id: "cs_test_1234567890abcdefghijkl",
  payment_link: offer.id,
  customer: "cus_Test",
  subscription: "sub_Test",
  client_reference_id: ref,
  created: Math.floor(Date.now() / 1000),
  status: "complete",
  mode: "subscription",
  payment_status: "paid",
  currency: "usd",
  customer_details: { email: "owner@example.test" },
  automatic_tax: { enabled: true, status: "complete" },
  total_details: { amount_discount: 0 },
  amount_subtotal: sku.usdCents,
  amount_total: sku.usdCents + 40,
});
const status = (s = "active", scheduled = false) => ({
  id: "sub_Test",
  customer: "cus_Test",
  status: s,
  cancel_at_period_end: scheduled,
  items: {
    has_more: false,
    data: [
      {
        quantity: 1,
        price: {
          id: offer.price,
          currency: "usd",
          unit_amount: sku.usdCents,
          recurring: { interval: "month", interval_count: 1 },
        },
      },
    ],
  },
});
const invoice = (id = "in_Test", end = sec + month - 20) => ({
  id,
  customer: "cus_Test",
  currency: "usd",
  billing_reason: "subscription_cycle",
  parent: { subscription_details: { subscription: "sub_Test" } },
  status: "paid",
  collection_method: "charge_automatically",
  amount_remaining: 0,
  amount_paid: sku.usdCents + 40,
  total: sku.usdCents + 40,
  amount_due: sku.usdCents + 40,
  subtotal: sku.usdCents,
  total_discount_amounts: [],
  automatic_tax: { enabled: true, status: "complete" },
  lines: {
    has_more: false,
    data: [
      {
        quantity: 1,
        amount: sku.usdCents,
        pricing: { price_details: { price: offer.price } },
        period: { start: end - month, end },
        parent: {
          type: "subscription_item_details",
          subscription_item_details: { proration: false },
        },
      },
    ],
  },
});
const payment = (invoice = "in_Test", pi = "pi_Test") => ({
  status: "paid",
  currency: "usd",
  amount_paid: sku.usdCents + 40,
  amount_requested: sku.usdCents + 40,
  invoice,
  payment: { type: "payment_intent", payment_intent: pi },
});
test("the recurring-link rehearsal never opens on a public origin and requires all providers, tax, test-mode links and billing portal", async (t) => {
  const { env, call } = await fixture(t);
  assert.equal((await (await call("access")).json()).webSubscriptionsReady, true);
  assert.equal(
    (await (await call("access", undefined, undefined, live)).json()).webSubscriptionsReady,
    false,
  );
  assert.equal((await call("checkout", { productId: sku.id }, undefined, live)).status, 503);
  for (const [key, value] of [
    ["STRIPE_RECURRING_PORTAL_URL", "https://example.com/login"],
    ["STRIPE_TAX_READY", "false"],
    [
      "STRIPE_RECURRING_PAYMENT_LINKS",
      JSON.stringify({
        ...offers,
        [sku.id]: { ...offer, url: "https://buy.stripe.com/aLiveLink" },
      }),
    ],
    ["ANTHROPIC_API_KEY", undefined],
  ]) {
    const original = env[key!];
    env[key!] = value;
    assert.equal((await (await call("access")).json()).webSubscriptionsReady, false);
    assert.equal((await call("checkout", { productId: sku.id })).status, 503);
    env[key!] = original;
  }
});
test("a monthly grant joins signed account ticket, plan state, paid invoice and card, independently of delivery order", async (t) => {
  const { env, call, send, other, remove } = await fixture(t);
  const opened = await Promise.all([
    call("checkout", { productId: sku.id }),
    call("checkout", { productId: sku.id }),
  ]);
  const links = await Promise.all(opened.map(async (r) => new URL((await r.json()).url)));
  const ticket = links[0].searchParams.get("client_reference_id")!;
  assert.equal(links[1].searchParams.get("client_reference_id"), ticket);
  assert.equal(links[0].searchParams.get("locked_prefilled_email"), "owner@example.test");
  assert.equal((await call("checkout", { productId: tiers[1].id })).status, 409);
  const plan = async () => (await (await call("access")).json()).plan;
  const receipt = session(ticket);
  await send("invoice_payment.paid", payment());
  await send("invoice.paid", invoice());
  await send("customer.subscription.created", status());
  await send("checkout.session.completed", {
    ...receipt,
    client_reference_id: null,
  });
  await send("checkout.session.completed", {
    ...receipt,
    customer_details: { email: "other@example.test" },
  });
  await send("checkout.session.completed", receipt, sec, true);
  assert.equal(await plan(), null);
  assert.equal((await call("checkout/complete", { sessionId: receipt.id }, other)).status, 409);
  await send("checkout.session.completed", receipt);
  await send("checkout.session.completed", receipt);
  assert.equal(await plan(), sku.id);
  assert.equal((await (await call("access", undefined, undefined, live)).json()).plan, null);
  assert.equal((await call("checkout/complete", { sessionId: receipt.id }, other)).status, 403);
  assert.equal((await call("checkout/complete", { sessionId: receipt.id })).status, 200);
  assert.ok((await (await call("portal", {})).json()).url.startsWith(env.STRIPE_RECURRING_PORTAL_URL + "?"));
  assert.equal((await call("portal", {}, other)).status, 404);
  const rejection = await remove();
  assert.equal(rejection.status, 409);
  assert.equal((await rejection.json()).code, "cancel_in_portal");
  const rev = (s: string) => ({
    id: "dp_Test",
    payment_intent: "pi_Test",
    status: s,
  });
  await send("charge.dispute.created", rev("needs_response"), sec + 1);
  assert.equal(await plan(), null);
  await send("charge.dispute.closed", rev("won"), sec + 4);
  await send("charge.dispute.created", rev("needs_response"), sec + 2);
  assert.equal(await plan(), sku.id);
  await send("charge.refunded", {
    id: "ch_Test",
    payment_intent: "pi_Test",
    amount: sku.usdCents + 40,
    amount_refunded: sku.usdCents + 40,
    refunded: true,
  });
  assert.equal(await plan(), null);
  await send("invoice.paid", invoice("in_Renew", sec + month - 5));
  assert.equal(await plan(), null);
  await send("invoice_payment.paid", payment("in_Renew", "pi_Renew"));
  assert.equal(await plan(), sku.id);
  await send("customer.subscription.updated", status("past_due"), sec + 8);
  assert.equal((await (await call("access")).json()).canManageHostedBilling, true);
  await send("customer.subscription.updated", status("active"), sec + 7);
  assert.equal(await plan(), null);
  await send("customer.subscription.updated", status("active", true), sec + 9);
  assert.equal(await plan(), sku.id);
  assert.equal((await remove()).status, 409);
  await send("customer.subscription.deleted", status("canceled"), sec + 10);
  await send("customer.subscription.updated", status(), sec + 11);
  assert.equal(await plan(), null);
  assert.equal((await remove()).status, 200);
});
test("refund arriving before checkout cannot be undone by late records, and wrong-price renewals never grant", async (t) => {
  const { call, send } = await fixture(t);
  const url = new URL((await (await call("checkout", { productId: sku.id })).json()).url);
  await send("charge.refunded", {
    id: "ch_First",
    payment_intent: "pi_Test",
    amount: sku.usdCents + 40,
    amount_refunded: sku.usdCents + 40,
    refunded: true,
  });
  await send("checkout.session.completed", session(url.searchParams.get("client_reference_id")!));
  await send("customer.subscription.updated", status());
  await send("invoice_payment.paid", payment());
  await send("invoice.paid", invoice());
  assert.equal((await (await call("access")).json()).plan, null);
  const wrong = invoice("in_Next", sec + month - 5);
  wrong.lines.data[0].pricing.price_details.price = offers[tiers[1].id].price;
  await send("invoice_payment.paid", payment("in_Next", "pi_Next"));
  await send("invoice.paid", wrong);
  assert.equal((await (await call("access")).json()).plan, null);
});
