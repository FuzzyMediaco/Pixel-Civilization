import { PIX_BILLING_CONSENT_VERSION } from "../src/game/pixBillingConsent.mjs";
const billingConsent = { version: PIX_BILLING_CONSENT_VERSION, accepted: true };
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test, { type TestContext } from "node:test";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { canUseProduct } from "../src/game/storeCatalog.mjs";
import { accountRequest } from "../worker/accounts.mjs";
import { pixWithPlans } from "../worker/pix-plans.mjs";
import { commerceRequest } from "../worker/commerce.mjs";
import { GATEWAY_MODELS, invalidateGatewayBalance } from "../worker/pix-gateway.mjs";

const origin = "https://game.example.test";
const customer = "cus_fixture";
const setupId = "cs_test_pixsetup";
const subscription = "sub_fixture";
const price = "price_Starter";
const webhookSecret = "local-test-signing-secret";

function storefront(t: TestContext) {
  const { db, sqlite } = openAccountDatabase(":memory:");
  t.after(() => sqlite.close());
  const env = {
    GAME_ACCOUNTS: db,
    STOREFRONT_ORIGIN: origin,
    STRIPE_SECRET_KEY: "sk_test_local_fixture",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_TAX_READY: "true",
    STRIPE_PORTAL_CONFIG: "bpc_Default",
    STRIPE_FUNDED_PORTAL_CONFIG: "bpc_Funded",
    STRIPE_FUNDED_BILLING_READY: "true",
    STRIPE_PRICE_IDS: JSON.stringify({
      pix_starter: price,
      pix_builder: "price_Builder",
      pix_studio: "price_Studio",
      pix_complete: "price_Complete",
    }),
    PIX_GATEWAY_ACCOUNT: "a".repeat(32),
    PIX_GATEWAY_ID: "local-fixture",
    PIX_GATEWAY_READ_TOKEN: "local-only",
    PIX_GATEWAY_VERIFIED_MODELS: Object.values(GATEWAY_MODELS).join(","),
    AI: {
      async run(model: string) {
        assert.equal(model, GATEWAY_MODELS.openai);
        vendor.generations++;
        return Response.json({
          output: [{ content: [{ type: "output_text", text: JSON.stringify({ operations: [] }) }] }],
          usage: { input_tokens: 100, output_tokens: 20 },
        });
      },
    },
  };
  const start = Math.floor(Date.now() / 1000),
    end = start + 30 * 86400;
  const vendor = {
    walletCents: 999.91557,
    owner: "",
    root: "",
    saved: false,
    invoice: "open",
    refunded: false,
    generations: 0,
    schedules: 0,
    setups: 0,
  };
  const stripeInvoice = () => ({
    id: "in_fixture",
    customer,
    status: vendor.invoice,
    parent: { subscription_details: { subscription } },
    lines: { data: [{ pricing: { price_details: { price } }, quantity: 1, period: { start, end } }] },
    currency: "usd",
    subtotal: 499,
    amount_due: 534,
    amount_paid: vendor.invoice === "paid" ? 534 : 0,
    automatic_tax: { enabled: true, status: "complete" },
    collection_method: "send_invoice",
    hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
  });
  const stripeSession = () => ({
    id: setupId,
    customer,
    mode: "setup",
    status: vendor.saved ? "complete" : "open",
    client_reference_id: vendor.owner,
    metadata: {
      pixel_account: vendor.owner,
      pixel_consent_version: PIX_BILLING_CONSENT_VERSION,
      pixel_funded_root: vendor.root,
      pixel_product: "pix_starter",
    },
    setup_intent: "seti_fixture",
    url: "https://checkout.stripe.com/c/pay/fixture",
  });
  const charge = () => ({
    id: "ch_fixture",
    customer,
    payment_intent: "pi_fixture",
    amount: 534,
    amount_refunded: vendor.refunded ? 534 : 0,
    refunded: vendor.refunded,
  });
  const unexpected: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit = {}) => {
    const url = new URL(input),
      form = new URLSearchParams(init.body as string);
    if (url.hostname === "api.cloudflare.com" && url.pathname.endsWith("/credit-balance"))
      return Response.json({ success: true, result: { balance: vendor.walletCents } });
    assert.equal(url.origin, "https://api.stripe.com");
    const method = init.method || "GET",
      path = url.pathname.slice("/v1/".length);
    const action = method + " " + path;
    let fixture;
    switch (action) {
      case "GET prices/price_Starter":
        fixture = {
          id: price,
          active: true,
          currency: "usd",
          unit_amount: 499,
          type: "recurring",
          recurring: { interval: "month", interval_count: 1 },
        };
        break;
      case "GET billing_portal/configurations/bpc_Funded":
        fixture = {
          id: "bpc_Funded",
          active: true,
          features: {
            subscription_update: { enabled: false },
            subscription_cancel: { enabled: false },
            payment_method_update: { enabled: true },
          },
        };
        break;
      case "POST customers":
        vendor.owner = form.get("metadata[pixel_account]")!;
        fixture = { id: customer };
        break;
      case "POST checkout/sessions":
        assert.equal(form.get("mode"), "setup");
        assert.equal(form.get("consent_collection[terms_of_service]"), null);
        assert.equal(
          form.get("setup_intent_data[metadata][pixel_consent_version]"),
          PIX_BILLING_CONSENT_VERSION,
        );
        assert.match(form.get("custom_text[submit][message]")!, /US\$4\.99/);
        assert.equal(form.get("billing_address_collection"), "required");
        assert.equal(form.get("client_reference_id"), vendor.owner);
        assert.equal(
          form.get("success_url"),
          origin + "/?purchase=complete&session_id={CHECKOUT_SESSION_ID}",
        );
        vendor.root = form.get("metadata[pixel_funded_root]")!;
        assert.ok(vendor.root);
        vendor.setups++;
        fixture = stripeSession();
        break;
      case "GET checkout/sessions/" + setupId:
        fixture = stripeSession();
        break;
      case "GET setup_intents/seti_fixture":
        fixture = {
          id: "seti_fixture",
          customer,
          status: "succeeded",
          usage: "off_session",
          metadata: { pixel_funded_root: vendor.root, pixel_consent_version: PIX_BILLING_CONSENT_VERSION },
          payment_method_types: ["card"],
          payment_method: "pm_fixture",
        };
        break;
      case "POST customers/" + customer:
        assert.equal(form.get("invoice_settings[default_payment_method]"), "pm_fixture");
        fixture = { id: customer };
        break;
      case "POST subscription_schedules":
        assert.equal(form.get("end_behavior"), "cancel");
        assert.equal(form.get("phases[0][collection_method]"), "send_invoice");
        assert.equal(form.get("phases[0][items][0][price]"), price);
        assert.equal(form.get("phases[0][automatic_tax][enabled]"), "true");
        assert.equal(form.get("phases[0][duration][interval]"), "month");
        vendor.schedules++;
        fixture = {
          id: "sub_sched_fixture",
          subscription,
          customer,
          end_behavior: "cancel",
          metadata: { pixel_funded_root: vendor.root },
          phases: [
            {
              start_date: start,
              end_date: end,
              collection_method: "send_invoice",
              automatic_tax: { enabled: true },
              items: [{ price, quantity: 1 }],
            },
          ],
        };
        break;
      case "GET subscriptions/" + subscription:
        fixture = {
          id: subscription,
          customer,
          status: "active",
          metadata: { pixel_funded_root: vendor.root },
          items: { data: [{ price, quantity: 1, current_period_start: start, current_period_end: end }] },
          latest_invoice: stripeInvoice(),
        };
        break;
      case "GET invoices/in_fixture":
        fixture = stripeInvoice();
        break;
      case "GET invoice_payments":
        fixture = {
          data: [
            {
              invoice: "in_fixture",
              status: "paid",
              payment: { type: "payment_intent", payment_intent: "pi_fixture" },
            },
          ],
        };
        break;
      case "GET payment_intents/pi_fixture":
        fixture = { id: "pi_fixture", customer, status: "succeeded", latest_charge: charge() };
        break;
      case "GET charges/ch_fixture":
        fixture = charge();
        break;
      case "GET checkout/sessions":
        assert.equal(url.searchParams.get("payment_intent"), "pi_fixture");
        fixture = { data: [] };
        break;
      case "POST billing_portal/sessions":
        assert.equal(form.get("customer"), customer);
        assert.equal(form.get("configuration"), "bpc_Funded");
        fixture = { url: "https://billing.stripe.com/p/session/fixture" };
        break;
      default:
        unexpected.push(action);
        return Response.json({ error: "Unsupported test fixture" }, { status: 404 });
    }
    return Response.json(fixture);
  });
  t.after(() => assert.deepEqual(unexpected, []));
  async function http(path: string, cookie = "", payload?: unknown, headers: Record<string, string> = {}) {
    const request = new Request(origin + path, {
      method: payload === undefined ? "GET" : "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", ...headers },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    const res = path.startsWith("/api/account/")
      ? await accountRequest(request, env)
      : await commerceRequest(request, env);
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }
  async function register(name: string) {
    const registered = await http("/api/account/register", "", {
      email: name + "@example.test",
      password: "test-password-123456",
    });
    assert.ok([200, 201].includes(registered.status));
    assert.ok(registered.cookie);
    return { id: registered.body.user.id, cookie: registered.cookie };
  }
  async function event(id: string, type: string, object: Record<string, unknown>, valid = true) {
    const data = { id, type, created: Math.floor(Date.now() / 1000), data: { object } };
    const digest = createHmac("sha256", valid ? webhookSecret : "incorrect")
      .update(data.created + "." + JSON.stringify(data))
      .digest("hex");
    return http("/api/commerce/stripe/webhook", "", data, {
      "Stripe-Signature": `t=${data.created},v1=${digest}`,
    });
  }
  function draw(cookie: string, id: string) {
    return pixWithPlans(
      new Request(origin + "/api/pix/world", {
        method: "POST",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Pix-Provider": "openai",
          "Idempotency-Key": id,
        },
        body: JSON.stringify({ prompt: "Place a pond", mode: "real" }),
      }),
      env,
      null,
    );
  }
  return { http, event, register, vendor, end, env, sql: sqlite, draw };
}

test("public purchase routes bind the first Pix invoice to the signed-in player and revoke a refunded term", async (t) => {
  const { http, event, register, vendor, end, env, sql, draw } = storefront(t);
  const access = (cookie = "") => http("/api/commerce/access", cookie);
  const checkout = (cookie: string, productId = "pix_starter") =>
    http("/api/commerce/checkout", cookie, { productId, billingConsent });
  const complete = (cookie: string) =>
    http("/api/commerce/checkout/complete", cookie, { sessionId: setupId });
  const guest = (await access()).body;
  assert.equal(guest.plan, null);
  assert.equal(guest.pixAdmission.native, false);
  assert.equal(guest.pixAdmission.tiers.pix_starter.available, true);
  assert.equal(guest.pixAdmission.tiers.pix_complete.reason, "wallet_capacity");
  assert.equal((await checkout("")).status, 401);
  const owner = await register("owner"),
    other = await register("other");
  assert.equal((await checkout(owner.cookie, "pix_studio")).body.code, "pix_capacity");
  for (const declined of [
    undefined,
    { accepted: false, version: PIX_BILLING_CONSENT_VERSION },
    { accepted: true, version: "old" },
  ]) {
    assert.equal(
      (
        await http("/api/commerce/checkout", owner.cookie, {
          productId: "pix_starter",
          billingConsent: declined,
        })
      ).body.code,
      "billing_consent_required",
    );
  }
  assert.equal(vendor.setups, 0);
  const opened = await checkout(owner.cookie);
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.equal(opened.body.url, "https://checkout.stripe.com/c/pay/fixture");
  assert.deepEqual((await checkout(owner.cookie)).body, opened.body);
  assert.equal(vendor.setups, 1);
  assert.equal((await complete(owner.cookie)).body.code, "checkout_pending");
  vendor.saved = true;
  const foreign = await complete(other.cookie);
  assert.equal(foreign.status, 403);
  assert.equal(foreign.body.code, "receipt_owner");
  assert.equal(vendor.schedules, 0);

  const returned = await complete(owner.cookie);
  assert.equal(returned.status, 200, JSON.stringify(returned.body));
  assert.equal(returned.body.plan, null);
  assert.equal(returned.body.pixBilling.state, "invoice_open");
  assert.equal(returned.body.pixBilling.invoiceUrl, "https://invoice.stripe.com/i/fixture");
  assert.deepEqual((await complete(owner.cookie)).body.pixBilling, returned.body.pixBilling);
  assert.equal(
    (await event("evt_setup", "checkout.session.completed", { id: setupId, customer })).status,
    200,
  );
  assert.equal(vendor.schedules, 1);
  assert.equal((await access(other.cookie)).body.pixBilling, null);

  assert.equal((await draw(owner.cookie, "before-payment")).status, 402);
  const stub = { id: "in_fixture", customer, parent: { subscription_details: { subscription } } };
  vendor.invoice = "paid";
  assert.equal((await event("evt_paid", "invoice.paid", stub, false)).status, 400);
  assert.equal((await access(owner.cookie)).body.plan, null);
  assert.equal((await event("evt_paid", "invoice.paid", stub)).status, 200);
  assert.equal((await event("evt_paid", "invoice.paid", stub)).status, 200);
  const purchased = (await access(owner.cookie)).body;
  assert.equal(purchased.accountId, owner.id);
  assert.equal(purchased.plan, "pix_starter");
  assert.deepEqual(purchased.usage, {
    messages: 0,
    spendMicros: 0,
    limit: 100,
    budgetMicros: 1490000,
    periodEnd: end * 1000,
  });
  assert.equal(purchased.pixBilling.state, "active");
  assert.equal(purchased.pixBilling.paidThrough, end * 1000);
  assert.equal(canUseProduct(purchased, "pix_starter"), true);
  assert.equal((await access(other.cookie)).body.plan, null);
  assert.equal((sql.prepare("SELECT count(*) AS n FROM game_purchases").get() as any).n, 1);

  assert.equal((await draw(other.cookie, "other-player")).status, 402);
  assert.equal((await draw(owner.cookie, "first-paid-draw")).status, 200);
  assert.equal((await draw(owner.cookie, "first-paid-draw")).status, 409);
  assert.equal((await access(owner.cookie)).body.usage.spendMicros, 20);
  assert.equal(vendor.generations, 1);
  // A prior generation near the budget is sufficient to test the hard limit without charging a provider.
  sql
    .prepare(
      "INSERT INTO game_pix_usage(user_id,request_key,started_at,provider,model,state,cost_micros) VALUES(?,?,?,?,?,'settled',?)",
    )
    .run(owner.id, "prior-usage", Date.now(), "openai", GATEWAY_MODELS.openai, 1489979);
  assert.equal((await draw(owner.cookie, "over-term-budget")).status, 429);
  assert.equal(vendor.generations, 1);
  vendor.walletCents = 0;
  invalidateGatewayBalance(env);
  assert.equal((await access()).body.webSubscriptionsReady, false);
  const portal = await checkout(owner.cookie);
  assert.equal(portal.status, 200);
  assert.equal(portal.body.url, "https://billing.stripe.com/p/session/fixture");
  assert.equal((await access(owner.cookie)).body.pixBilling.paidThrough, end * 1000);

  vendor.refunded = true;
  const reversal = await event("evt_refund", "charge.refunded", {
    id: "ch_fixture",
    customer,
    payment_intent: "pi_fixture",
    amount: 534,
    amount_refunded: 534,
    refunded: true,
  });
  assert.equal(reversal.status, 200, JSON.stringify(reversal.body));
  assert.equal((await access(owner.cookie)).body.plan, null);
  assert.equal((await access(owner.cookie)).body.pixBilling.state, "revoked");
  assert.equal((await access(owner.cookie)).body.pixBilling.renews, false);
  // Another delivery of the older paid event must consult current Stripe state.
  assert.equal((await event("evt_latepaid", "invoice.paid", stub)).status, 200);
  assert.equal((await complete(owner.cookie)).body.plan, null);
  vendor.walletCents = 999.91557;
  invalidateGatewayBalance(env);
  assert.equal((await draw(owner.cookie, "after-refund")).status, 402);
  assert.equal(vendor.generations, 1);
  assert.equal((await access(other.cookie)).body.plan, null);
});

test("a delayed setup webhook rechecks cash before issuing the first invoice and can be retried", async (t) => {
  const { http, event, register, vendor } = storefront(t);
  const player = await register("delayed");
  const opened = await http("/api/commerce/checkout", player.cookie, {
    productId: "pix_starter",
    billingConsent,
  });
  assert.equal(opened.status, 200);
  vendor.saved = true;
  // All three model routes are affordable, but the full $1.49 Starter term is not.
  vendor.walletCents = 100;
  const session = { id: setupId, customer };
  const blocked = await event("evt_setup_retry", "checkout.session.completed", session);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "pix_capacity");
  assert.equal(vendor.schedules, 0);
  assert.equal((await http("/api/commerce/access", player.cookie)).body.plan, null);
  // Retry the same vendor delivery after enough prepaid inference is available.
  vendor.walletCents = 200;
  assert.equal((await event("evt_setup_retry", "checkout.session.completed", session)).status, 200);
  assert.equal(vendor.schedules, 1);
  const resumed = await http("/api/commerce/checkout/complete", player.cookie, { sessionId: setupId });
  assert.equal(resumed.body.pixBilling.state, "invoice_open");
  assert.equal(resumed.body.plan, null);
  assert.equal(vendor.generations, 0);
});
