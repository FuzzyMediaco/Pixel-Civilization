import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHmac } from "node:crypto";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { accountRequest } from "../worker/accounts.mjs";
import { commerceRequest } from "../worker/commerce.mjs";
import { reserveGeneration, pixWithPlans } from "../worker/pix-plans.mjs";
import { GATEWAY_MODELS } from "../worker/pix-gateway.mjs";
import { activeGrants, recordPurchase, usageWindow } from "../worker/store-data.mjs";
import { STORE_PRODUCTS, canUseProduct, productForEra, productForMode } from "../src/game/storeCatalog.mjs";

const origin = "https://pixelcivilization.app";
async function setup(vars: Record<string, unknown> = {}) {
  const { db, sqlite } = openAccountDatabase(":memory:");
  const env = { GAME_ACCOUNTS: db, ...vars };
  const req = (path: string, method: string, cookie: string, body?: unknown, headers = {}) =>
    new Request(origin + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const reg = await accountRequest(
    req("/api/account/register", "POST", "", { email: "ada@example.com", password: "city password 9" }),
    env,
  );
  const user = (await reg.json()).user.id,
    cookie = reg.headers.get("set-cookie")!.split(";")[0];
  const call = (path: string, body?: unknown, headers = {}) =>
    commerceRequest(
      req("/api/commerce/" + path, body === undefined ? "GET" : "POST", cookie, body, headers),
      env,
    );
  return { db, sqlite, env, user, cookie, req, call };
}
function json(value: unknown) {
  return Response.json(value);
}
test("sixteen products gate only premium modes and ten era packs, including both Rome directions", () => {
  assert.equal(STORE_PRODUCTS.length, 16);
  assert.equal(new Set(STORE_PRODUCTS.map((p) => p.id)).size, 16);
  assert.equal(productForEra("rome-forum"), "era_rome");
  assert.equal(productForEra("original"), undefined);
  assert.equal(productForMode("manager"), undefined);
  assert.equal(productForMode("god"), "mode_god");
  const access = { accountId: "one", plan: "pix_complete", owned: [], validUntil: Date.now() + 5000 } as any;
  assert.ok(
    STORE_PRODUCTS.filter((p) => p.kind !== "subscription").every((p) => canUseProduct(access, p.id)),
  );
  assert.equal(canUseProduct({ ...access, validUntil: Date.now() - 10 }, "era_rome"), false);
});
test("native verification uses an authoritative Apple lookup, updates revocations, and never accepts a different account", async (t) => {
  const key = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const app = await setup({
    APPLE_IAP_KEY: key.privateKey,
    APPLE_IAP_KEY_ID: "test",
    APPLE_IAP_ISSUER: "issuer",
  });
  t.after(() => app.sqlite.close());
  let revoked = false,
    owner = app.user;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://api.storekit.apple.com/inApps/v1/transactions/12345");
    const claim = {
      transactionId: "12345",
      originalTransactionId: "12345",
      appAccountToken: owner,
      bundleId: "app.pixelcivilization.game",
      productId: "era_rome",
      environment: "Production",
      purchaseDate: Date.now() - 3000,
      ...(revoked ? { revocationDate: Date.now() } : {}),
    };
    return json({
      signedTransactionInfo:
        "header." + Buffer.from(JSON.stringify(claim)).toString("base64url") + ".signature",
    });
  });
  const receipt = {
    platform: "apple",
    productId: "mode_god",
    transactionId: "12345",
    signedTransaction: "client-content-is-ignored",
  };
  assert.deepEqual((await (await app.call("purchase", receipt)).json()).owned, ["era_rome"]);
  assert.deepEqual((await (await app.call("purchase", receipt)).json()).owned, ["era_rome"]);
  revoked = true;
  assert.deepEqual((await (await app.call("purchase", receipt)).json()).owned, []);
  owner = crypto.randomUUID();
  assert.equal((await app.call("purchase", receipt)).status, 403);
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_purchases").get() as any).n, 1);
});
test("Google restore acknowledges only after durable grant, binds the account, and honors cancellations", async (t) => {
  const key = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
  });
  const app = await setup({
    GOOGLE_PLAY_SERVICE_ACCOUNT: JSON.stringify({
      private_key: key.privateKey,
      private_key_id: "fixture",
      client_email: "test@example.test",
    }),
  });
  t.after(() => app.sqlite.close());
  let state = "PENDING",
    acks = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url === "https://oauth2.googleapis.com/token")
      return json({ access_token: "test-token", expires_in: 3600 });
    if (url.endsWith(":acknowledge")) {
      assert.equal((app.sqlite.prepare("SELECT active FROM game_purchases").get() as any).active, 1);
      acks++;
      return new Response(null, { status: 204 });
    }
    assert.ok(url.includes("/app.pixelcivilization.game/purchases/productsv2/tokens/"));
    return json({
      purchaseStateContext: { purchaseState: state },
      productLineItem: [{ productId: "era_deco", productOfferDetails: { refundableQuantity: 1 } }],
      obfuscatedExternalAccountId: app.user,
      purchaseCompletionTime: new Date(1700000000000).toISOString(),
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    });
  });
  const receipt = { platform: "google", productId: "era_deco", purchaseToken: "test-purchase-token" };
  assert.equal((await app.call("purchase", receipt)).status, 409);
  state = "PURCHASED";
  assert.deepEqual((await (await app.call("purchase", receipt)).json()).owned, ["era_deco"]);
  assert.equal(acks, 1);
  state = "CANCELLED";
  assert.deepEqual((await (await app.call("purchase", receipt)).json()).owned, []);
});
test("premium Pix authenticates, atomically reserves, settles reported provider usage and handles duplicate requests", async (t) => {
  const app = await setup({ OPENAI_API_KEY: "unit-test-key" });
  t.after(() => app.sqlite.close());
  const now = Date.now(),
    id = app.user;
  const req = (requestId: string) =>
    app.req(
      "/api/pix/advise",
      "POST",
      app.cookie,
      { question: "Improve my transit?", mode: "real" },
      { "X-Pix-Provider": "openai", "Idempotency-Key": requestId },
    );
  assert.equal((await pixWithPlans(req("request-before-plan"), app.env, null)).status, 402);
  await recordPurchase(app.db, {
    store: "stripe",
    key: "sub_fixture",
    user: id,
    product: "pix_starter",
    active: true,
    start: now - 10000,
    end: now + 26 * 86400000,
    checked: now,
    next: now,
    source: "sub_fixture",
  });
  // Actual endpoint expects metrics and player request; use the world endpoint with a simple sketch.
  const draw = (requestId: string) =>
    app.req(
      "/api/pix/world",
      "POST",
      app.cookie,
      { prompt: "Put a farm by the market", mode: "real" },
      { "X-Pix-Provider": "openai", "Idempotency-Key": requestId },
    );
  const transport = t.mock.method(globalThis, "fetch", async () =>
    json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ operations: [] }) }] }],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 40, cache_write_tokens: 8 },
      },
    }),
  );
  assert.equal((await pixWithPlans(draw("request-once"), app.env, null)).status, 200);
  const row = app.sqlite
    .prepare("SELECT input_tokens,output_tokens,cost_micros,state FROM game_pix_usage")
    .get() as any;
  assert.deepEqual({ ...row }, { input_tokens: 100, output_tokens: 20, cost_micros: 17, state: "settled" });
  assert.equal((await pixWithPlans(draw("request-once"), app.env, null)).status, 409);
  assert.equal(transport.mock.callCount(), 1);
  const grant = { product_id: "pix_starter", period_start: now - 10000, expires_at: now + 26 * 86400000 };
  await Promise.allSettled(
    Array.from({ length: 120 }, (_, i) =>
      reserveGeneration(app.db, id, "batch" + i, grant, "openai", 1, now),
    ),
  );
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_pix_usage").get() as any).n, 100);
  assert.equal((await pixWithPlans(draw("request-over-limit"), app.env, null)).status, 429);
});
test("Stripe requires tax readiness, verifies prices, requires a signed state change and handles a refund", async (t) => {
  const app = await setup({
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-webhook",
    STRIPE_PORTAL_CONFIG: "bpc_fixture",
    STRIPE_PRICE_IDS: '{"era_rome":"price_rome"}',
  });
  t.after(() => app.sqlite.close());
  let complete = false,
    refunded = false,
    created = 0;
  const session = () => ({
    id: "cs_test_1234567890",
    mode: "payment",
    status: complete ? "complete" : "open",
    url: "https://checkout.stripe.com/test",
    payment_status: "paid",
    customer: "cus_game",
    metadata: { pixel_account: app.user, pixel_product: "era_rome" },
    client_reference_id: app.user,
    line_items: { data: [{ quantity: 1, price: { id: "price_rome" } }] },
    expires_at: Math.floor(Date.now() / 1000) + 1000,
    created: Math.floor(Date.now() / 1000),
    payment_intent: {
      id: "pi_test",
      status: "succeeded",
      latest_charge: { id: "ch_test", amount: 99, amount_refunded: refunded ? 99 : 0, refunded },
    },
  });
  t.mock.method(globalThis, "fetch", async (url: string, opts: any) => {
    const path = new URL(url).pathname;
    if (path === "/v1/customers") return json({ id: "cus_game" });
    if (path === "/v1/prices/price_rome")
      return json({ active: true, currency: "usd", unit_amount: 99, type: "one_time" });
    if (path === "/v1/checkout/sessions" && opts.method === "POST") {
      assert.equal(opts.body.get("allowed_payment_method_types[0]"), "card");
      assert.equal(opts.body.has("payment_method_types[0]"), false);
      assert.equal(opts.body.get("automatic_tax[enabled]"), "true");
      assert.equal(opts.body.get("billing_address_collection"), "required");
      created++;
      return json(session());
    }
    if (path === "/v1/checkout/sessions" && opts.method === "GET") return json({ data: [session()] });
    if (path === "/v1/checkout/sessions/cs_test_1234567890") return json(session());
    if (path === "/v1/charges/ch_test")
      return json({ id: "ch_test", payment_intent: "pi_test", customer: "cus_game" });
    if (path === "/v1/invoice_payments") return json({ data: [] });
    throw Error(path);
  });
  assert.equal((await app.call("checkout", { productId: "era_rome" })).status, 503);
  Object.assign(app.env, { STRIPE_TAX_READY: "true" });
  assert.equal((await app.call("checkout", { productId: "era_rome" })).status, 200);
  assert.equal((await app.call("checkout", { productId: "era_rome" })).status, 200);
  assert.equal(created, 1);
  const fire = (type: string, obj: string, eventId: string, valid = true) => {
    const body = JSON.stringify({ id: eventId, type, data: { object: { id: obj } } }),
      time = Math.floor(Date.now() / 1000);
    const mac = createHmac("sha256", valid ? "test-webhook" : "incorrect")
      .update(time + "." + body)
      .digest("hex");
    return commerceRequest(
      new Request(origin + "/api/commerce/stripe/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "t=" + time + ",v1=" + mac },
        body,
      }),
      app.env,
    );
  };
  complete = true;
  assert.equal((await fire("checkout.session.completed", "cs_test_1234567890", "evt_1", false)).status, 400);
  assert.deepEqual((await (await app.call("access")).json()).owned, []);
  assert.equal((await fire("checkout.session.completed", "cs_test_1234567890", "evt_1")).status, 200);
  assert.equal((await fire("checkout.session.completed", "cs_test_1234567890", "evt_1")).status, 200);
  assert.deepEqual((await (await app.call("access")).json()).owned, ["era_rome"]);
  refunded = true;
  assert.equal((await fire("charge.refunded", "ch_test", "evt_2")).status, 200);
  assert.deepEqual((await (await app.call("access")).json()).owned, []);
});
test("closing an account requires its password and removes online saves, entitlements, usage and sessions", async (t) => {
  const app = await setup();
  t.after(() => app.sqlite.close());
  await recordPurchase(app.db, {
    store: "apple",
    key: "123",
    user: app.user,
    product: "era_deco",
    active: true,
    start: 1,
    end: null,
    checked: Date.now(),
    next: Date.now() + 86400000,
    source: "123",
  });
  const remove = (password: string) =>
    accountRequest(app.req("/api/account/me", "DELETE", app.cookie, { password }), app.env);
  assert.equal((await remove("wrong password")).status, 401);
  assert.equal((await remove("city password 9")).status, 200);
  for (const name of ["game_users", "game_sessions", "game_purchases"])
    assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM " + name).get() as any).n, 0);
  assert.equal((await (await app.call("access")).json()).accountId, null);
});

test("paid Gemini and Claude settle their reported tokens, a rejected generation releases the reservation", async (t) => {
  const app = await setup({ GEMINI_API_KEY: "test-gemini", ANTHROPIC_API_KEY: "test-claude" });
  t.after(() => app.sqlite.close());
  const now = Date.now();
  await recordPurchase(app.db, {
    store: "stripe",
    key: "sub_models",
    user: app.user,
    product: "pix_studio",
    active: true,
    start: now - 20000,
    end: now + 28 * 86400000,
    checked: now,
    next: now,
    source: "sub_models",
  });
  let reject = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (reject) return new Response("", { status: 429 });
    if (url.includes("anthropic.com"))
      return json({
        content: [{ type: "tool_use", name: "city_response", input: { operations: [] } }],
        usage: { input_tokens: 100, cache_read_input_tokens: 30, output_tokens: 10 },
      });
    return json({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ operations: [] }) }] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 25, thoughtsTokenCount: 5 },
    });
  });
  for (const provider of ["gemini", "anthropic"]) {
    const request = app.req(
      "/api/pix/world",
      "POST",
      app.cookie,
      { prompt: "Add roads" },
      { "X-Pix-Provider": provider, "Idempotency-Key": "models-" + provider },
    );
    assert.equal((await pixWithPlans(request, app.env, null)).status, 200);
  }
  reject = true;
  assert.equal(
    (
      await pixWithPlans(
        app.req(
          "/api/pix/world",
          "POST",
          app.cookie,
          { prompt: "Add trees" },
          { "X-Pix-Provider": "anthropic", "Idempotency-Key": "models-declined" },
        ),
        app.env,
        null,
      )
    ).status,
    502,
  );
  const rows = app.sqlite
    .prepare("SELECT provider,state,cost_micros FROM game_pix_usage ORDER BY started_at")
    .all()
    .map((x) => ({ ...x }));
  assert.deepEqual(rows, [
    { provider: "gemini", state: "settled", cost_micros: 24 },
    { provider: "anthropic", state: "settled", cost_micros: 153 },
    { provider: "anthropic", state: "failed", cost_micros: 0 },
  ]);
});
test("a subscription renewal switches the allowance to the actual new period and expires without further usage", async (t) => {
  const app = await setup({
    STRIPE_SECRET_KEY: "test",
    STRIPE_WEBHOOK_SECRET: "renewal-secret",
    STRIPE_PRICE_IDS: '{"pix_starter":"price_start","pix_builder":"price_build"}',
  });
  t.after(() => app.sqlite.close());
  app.sqlite.prepare("INSERT INTO game_stripe_customers VALUES(?,?)").run(app.user, "cus_bill");
  const now = Math.floor(Date.now() / 1000),
    day = 86400;
  let start = now - 28 * day,
    end = now + 2 * day,
    price = "price_start",
    status = "active";
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith("subscriptions/sub_recurring"))
      return json({
        id: "sub_recurring",
        customer: "cus_bill",
        status,
        items: { data: [{ price: { id: price }, current_period_start: start, current_period_end: end }] },
        latest_invoice: { id: "in_new", status: "paid", amount_paid: 499 },
      });
    if (path.endsWith("invoice_payments"))
      return json({ data: [{ status: "paid", payment: { payment_intent: "pi_month" } }] });
    if (path.endsWith("payment_intents/pi_month"))
      return json({ status: "succeeded", latest_charge: { amount: 499, amount_refunded: 0 } });
    throw Error(path);
  });
  async function event(type: string, id: string) {
    const obj = type.startsWith("invoice")
      ? { parent: { subscription_details: { subscription: "sub_recurring" } } }
      : { id: "sub_recurring" };
    const body = JSON.stringify({ id: "evt_" + id, type, data: { object: obj } }),
      time = Math.floor(Date.now() / 1000),
      mac = createHmac("sha256", "renewal-secret")
        .update(time + "." + body)
        .digest("hex");
    return commerceRequest(
      new Request(origin + "/api/commerce/stripe/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "t=" + time + ",v1=" + mac },
        body,
      }),
      app.env,
    );
  }
  assert.equal((await event("customer.subscription.created", "created")).status, 200);
  assert.equal((await (await app.call("access")).json()).usage.limit, 100);
  app.sqlite
    .prepare("INSERT INTO game_pix_usage VALUES(?,?,?,?,?,?,?,?,?)")
    .run(app.user, "past-usage", (now - 10 * day) * 1000, "gemini", "fixture", "settled", 3, 4, 5);
  assert.equal((await (await app.call("access")).json()).usage.messages, 1);
  start = now - 100;
  end = now + 30 * day;
  price = "price_build";
  assert.equal((await event("invoice.paid", "renewed")).status, 200);
  const renewed = await (await app.call("access")).json();
  assert.equal(renewed.plan, "pix_builder");
  assert.equal(renewed.usage.limit, 350);
  assert.equal(renewed.usage.messages, 0);
  status = "canceled";
  await event("customer.subscription.deleted", "deleted");
  assert.equal((await (await app.call("access")).json()).plan, null);
});
test("signed offline lease is bound to the actual account and expires at the paid term", async (t) => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const app = await setup({
    STORE_LEASE_SIGNING_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", keys.privateKey)),
  });
  t.after(() => app.sqlite.close());
  const now = Date.now();
  await recordPurchase(app.db, {
    store: "stripe",
    key: "sub_lease",
    user: app.user,
    product: "pix_builder",
    active: true,
    start: now - 100,
    end: now + 100000,
    checked: now,
    next: now,
    source: "sub_lease",
  });
  const result = await (await app.call("access")).json(),
    [head, body, sig] = result.lease.split(".");
  assert.ok(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keys.publicKey,
      Buffer.from(sig, "base64url"),
      Buffer.from(head + "." + body),
    ),
  );
  const grant = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.equal(grant.sub, app.user);
  assert.equal(grant.plan, "pix_builder");
  assert.ok(grant.exp * 1000 <= now + 100000);
});
test("a pre-rollout 1490-site God island and a named-only Survival island retain lifelong access; later uploads do not", async (t) => {
  const app = await setup();
  t.after(() => app.sqlite.close());
  const now = Date.now();
  function save(key: string, data: string) {
    app.sqlite
      .prepare(
        "INSERT INTO game_saves(user_id,save_key,version,revision,updated_at,deleted) VALUES(?,?,1,'1-free',?,0)",
      )
      .run(app.user, key, now);
    app.sqlite
      .prepare("INSERT INTO game_save_chunks VALUES(?,?,'1-free',0,?)")
      .run(app.user, key, gzipSync(data).toString("base64"));
  }
  save(
    "pixel_civ_save_v1_god",
    JSON.stringify({ mode: "god", elements: Array.from({ length: 1490 }, (_, id) => ({ id })) }),
  );
  save(
    "pixel_civ_slot_3",
    "pcgz1:" +
      gzipSync(
        JSON.stringify({
          name: "Coastal City",
          mode: "survival",
          state: { mode: "survival", elements: [{ id: 1 }] },
        }),
      ).toString("base64"),
  );
  app.sqlite.exec("DROP TABLE game_legacy_mode_chunks; DROP TABLE game_legacy_mode_slots;");
  app.sqlite.exec(
    readFileSync(new URL("../migrations/0004_existing_game_modes.sql", import.meta.url), "utf8"),
  );
  app.sqlite
    .prepare("UPDATE game_save_chunks SET payload=? WHERE save_key='pixel_civ_slot_3'")
    .run(gzipSync("null").toString("base64"));
  assert.deepEqual((await (await app.call("access")).json()).owned.sort(), ["mode_god", "mode_survival"]);
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_legacy_mode_slots").get() as any).n, 0);
  app.sqlite.prepare("DELETE FROM game_purchases WHERE product_id='mode_survival'").run();
  save("pixel_civ_save_v1_survival", JSON.stringify({ mode: "survival", elements: [] }));
  assert.deepEqual((await (await app.call("access")).json()).owned, ["mode_god"]);
  app.sqlite.prepare("UPDATE game_purchases SET checked_at=0 WHERE store='legacy'").run();
  assert.deepEqual((await (await app.call("access")).json()).owned, ["mode_god"]);
});

test("Payment Links bind timed checkouts, permit one claim of direct purchases and handle late, replayed or reversed events without a Stripe API key", async (t) => {
  const app = await setup({
    STRIPE_WEBHOOK_SECRET: "links-secret",
    STRIPE_TAX_READY: "true",
    STRIPE_PAYMENT_LINKS: JSON.stringify({
      era_rome: { id: "plink_rome", url: "https://buy.stripe.com/test_rome" },
    }),
  });
  t.after(() => app.sqlite.close());
  t.mock.method(globalThis, "fetch", async () => {
    throw Error("The link-only flow must work without an API call");
  });
  const other = await accountRequest(
    app.req("/api/account/register", "POST", "", {
      email: "grace@example.com",
      password: "another city password",
    }),
    app.env,
  );
  const otherCookie = other.headers.get("set-cookie")!.split(";")[0],
    otherId = (await other.json()).user.id;
  const otherClaim = (sessionId: string) =>
    commerceRequest(app.req("/api/commerce/checkout/complete", "POST", otherCookie, { sessionId }), app.env);
  const access = await (await app.call("access")).json();
  assert.ok(access.readyStores.includes("stripe"));
  assert.equal(access.webSubscriptionsReady, false);
  const url = new URL((await (await app.call("checkout", { productId: "era_rome" })).json()).url);
  assert.equal(url.origin, "https://buy.stripe.com");
  const ticket = url.searchParams.get("client_reference_id");
  assert.ok(ticket);
  assert.equal(
    new URL((await (await app.call("checkout", { productId: "era_rome" })).json()).url).searchParams.get(
      "client_reference_id",
    ),
    ticket,
  );
  const now = Math.floor(Date.now() / 1000);
  const session = (n: number, ref: string | null = ticket) => ({
    object: "checkout.session",
    id: "cs_test_" + String(n).padStart(25, "1"),
    payment_intent: "pi_test" + n,
    payment_link: "plink_rome",
    status: "complete",
    mode: "payment",
    payment_status: "paid",
    client_reference_id: ref,
    created: now,
    currency: "usd",
    amount_subtotal: 99,
    amount_total: 105,
    total_details: { amount_discount: 0 },
    automatic_tax: { enabled: true, status: "complete" },
  });
  const event = async (
    type: string,
    obj: unknown,
    time = now,
    id = crypto.randomUUID().replaceAll("-", ""),
  ) => {
    const payload = JSON.stringify({ id: "evt_" + id, created: time, type, data: { object: obj } });
    const at = Math.floor(Date.now() / 1000),
      sig = createHmac("sha256", "links-secret")
        .update(at + "." + payload)
        .digest("hex");
    return commerceRequest(
      new Request(origin + "/api/commerce/stripe/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": `t=${at},v1=${sig}` },
        body: payload,
      }),
      app.env,
    );
  };
  const s = session(1),
    claim = (id: string) => app.call("checkout/complete", { sessionId: id });
  assert.equal((await (await claim(s.id)).json()).code, "checkout_pending");
  // The session began while its ticket was valid. The signed webhook can arrive after expiration.
  app.sqlite
    .prepare("UPDATE game_link_tickets SET issued_at=?,expires_at=?")
    .run(now * 1000 - 30000, now * 1000);
  assert.equal((await event("checkout.session.completed", s)).status, 200);
  assert.deepEqual((await (await claim(s.id)).json()).owned, ["era_rome"]);
  assert.equal((await otherClaim(s.id)).status, 403);
  assert.equal(
    (
      await event(
        "charge.dispute.created",
        { id: "dp_game", payment_intent: s.payment_intent, status: "needs_response" },
        now + 1,
      )
    ).status,
    200,
  );
  assert.equal((await (await claim(s.id)).json()).code, "payment_reversed");
  await event(
    "charge.dispute.closed",
    { id: "dp_game", payment_intent: s.payment_intent, status: "won" },
    now + 2,
  );
  await event(
    "charge.dispute.updated",
    { id: "dp_game", payment_intent: s.payment_intent, status: "under_review" },
    now + 1,
  );
  assert.ok((await (await claim(s.id)).json()).owned.includes("era_rome"));
  await event("charge.refunded", {
    id: "ch_test",
    payment_intent: s.payment_intent,
    amount: 105,
    amount_refunded: 105,
    refunded: true,
  });
  await event("checkout.session.completed", s);
  assert.equal((await (await claim(s.id)).json()).code, "payment_reversed");
  const direct = session(2, null);
  await event("checkout.session.completed", { ...direct, payment_status: "unpaid" });
  const claims = await Promise.all([claim(direct.id), otherClaim(direct.id)]);
  assert.deepEqual(claims.map((r) => r.status).sort(), [403, 409]);
  await event("checkout.session.async_payment_succeeded", direct);
  const originalWon = claims[0].status === 409;
  const winningClaim = originalWon ? claim : otherClaim;
  assert.ok((await (await winningClaim(direct.id)).json()).owned.includes("era_rome"));
  const prior = session(3, null);
  await event("charge.refunded", {
    id: "ch_prior",
    payment_intent: prior.payment_intent,
    amount: 105,
    amount_refunded: 105,
    refunded: true,
  });
  await event("checkout.session.completed", prior);
  assert.equal((await (await claim(prior.id)).json()).code, "payment_reversed");
  assert.equal(
    (await event("checkout.session.completed", { ...session(4), amount_subtotal: 1 })).status,
    409,
  );
  assert.equal(
    (await event("checkout.session.completed", { ...session(5), automatic_tax: { enabled: false } })).status,
    409,
  );
  assert.equal(
    (await event("checkout.session.completed", { ...session(6), payment_link: "plink_other" })).status,
    200,
  );
  assert.equal((await (await claim(session(6).id)).json()).code, "checkout_pending");
  // Even when a link is retired, a valid game checkout opened on it can finish.
  const rotated = session(7);
  const appVars = app.env as Record<string, unknown>;
  appVars.STRIPE_PAYMENT_LINKS = "{}";
  assert.equal((await event("checkout.session.completed", rotated)).status, 200);
  assert.equal((await otherClaim(rotated.id)).status, 403);
  assert.ok((await (await claim(rotated.id)).json()).owned.includes("era_rome"));
  app.sqlite.prepare("DELETE FROM game_users WHERE id=?").run(originalWon ? app.user : otherId);
  await event("checkout.session.completed", direct);
  assert.equal((await event("charge.refunded", {
    id: "ch_afterdelete",
    payment_intent: direct.payment_intent,
    amount: 105,
    amount_refunded: 105,
    refunded: true,
  })).status, 200);
  assert.equal((await (originalWon ? otherClaim : claim)(direct.id)).status, 403);
  assert.equal(
    (
      app.sqlite
        .prepare("SELECT COUNT(*) AS n FROM game_link_receipts WHERE session_key=? OR payment_key=?")
        .get(direct.id, direct.payment_intent) as any
    ).n,
    0,
  );
});

test("Pix uses funded, verified gateway models with precise merchant costs and releases failed reservations", async (t) => {
  const names = ["openai/gpt-6-luna", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash-lite"];
  let balance = 1000,
    reads = 0,
    declined = false;
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(
      url,
      "https://api.cloudflare.com/client/v4/accounts/" +
        "a".repeat(32) +
        "/ai-gateway/billing/credit-balance",
    );
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer game-read-only-test");
    reads++;
    return json({ success: true, result: { balance } });
  });
  const calls: string[] = [];
  const AI = {
    async run(model: string, body: Record<string, unknown>, opts: any) {
      calls.push(model);
      assert.equal(opts.gateway.id, "pixel-civilization");
      assert.equal(opts.gateway.collectLog, false);
      assert.equal(opts.gateway.skipCache, true);
      assert.equal(opts.returnRawResponse, true);
      assert.equal(body.model, undefined);
      assert.ok(opts.signal);
      if (declined) return new Response(null, { status: 402 });
      if (model === names[0]) {
        assert.equal(body.store, false);
        assert.match(String(body.input), /json/i);
        return json({
          output: [{ content: [{ type: "output_text", text: '{"operations":[]}' }] }],
          usage: { input_tokens: 100, output_tokens: 20 },
        });
      }
      if (model === names[1]) {
        assert.ok(body.tool_choice);
        return json({
          content: [{ type: "tool_use", name: "city_response", input: { operations: [] } }],
          usage: { input_tokens: 100, output_tokens: 20 },
        });
      }
      assert.ok(body.generationConfig);
      return json({
        candidates: [{ content: { parts: [{ text: '{"operations":[]}' }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
      });
    },
  };
  const app = await setup({
    AI,
    PIX_GATEWAY_ACCOUNT: "a".repeat(32),
    PIX_GATEWAY_ID: "pixel-civilization",
    PIX_GATEWAY_READ_TOKEN: "game-read-only-test",
    PIX_GATEWAY_VERIFIED_MODELS: names.join(","),
  });
  t.after(() => app.sqlite.close());
  const opts = app.env as Record<string, unknown>;
  const status = async (env = opts) =>
    (await (await pixWithPlans(app.req("/api/pix/status", "GET", ""), env, null)).json()).providers;
  assert.deepEqual(await status(), ["openai", "anthropic", "gemini"]);
  assert.deepEqual(await status(), ["openai", "anthropic", "gemini"]);
  assert.equal(reads, 1);
  assert.deepEqual(await status({ ...opts, PIX_GATEWAY_VERIFIED_MODELS: names[1] }), ["anthropic"]);
  assert.deepEqual(await status({ ...opts, PIX_GATEWAY_READ_TOKEN: "", OPENAI_API_KEY: "test-key" }), [
    "openai",
  ]);
  const now = Date.now();
  await recordPurchase(app.db, {
    store: "stripe",
    key: "sub_gw",
    user: app.user,
    product: "pix_starter",
    active: true,
    start: now - 100,
    end: now + 20 * 86400000,
    checked: now,
    next: now,
    source: "test",
  });
  const draw = (provider: string, id: string, env = opts) =>
    pixWithPlans(
      app.req(
        "/api/pix/world",
        "POST",
        app.cookie,
        { prompt: "Add a park" },
        { "X-Pix-Provider": provider, "Idempotency-Key": id },
      ),
      env,
      null,
    );
  for (const provider of ["openai", "anthropic", "gemini"])
    assert.equal((await draw(provider, "funded-pix-" + provider)).status, 200);
  assert.deepEqual(calls, names);
  const rows = app.sqlite
    .prepare("SELECT model,cost_micros FROM game_pix_usage ORDER BY started_at, rowid")
    .all()
    .map((r) => ({ ...r }));
  assert.deepEqual(rows, [
    { model: names[0], cost_micros: 20 },
    { model: names[1], cost_micros: 200 },
    { model: names[2], cost_micros: 18 },
  ]);
  const bill = app.sqlite
    .prepare("SELECT inference_micros,estimated_funding_fee_micros FROM game_pix_settled_costs WHERE model=?")
    .get(names[1]);
  assert.deepEqual({ ...bill }, { inference_micros: 200, estimated_funding_fee_micros: 10 });
  assert.equal((await draw("openai", "funded-pix-openai")).status, 409);
  assert.equal(calls.length, 3);
  declined = true;
  assert.equal((await draw("openai", "declined-gateway")).status, 502);
  balance = 0;
  assert.deepEqual(await status(), []);
  assert.deepEqual(await status({ ...opts, OPENAI_API_KEY: "individual-test-key" }), ["openai"]);
  const denied = await draw("gemini", "zero-credit-check");
  assert.equal(denied.status, 503);
  balance = 0.01;
  assert.equal((await draw("anthropic", "low-credit-check", { ...opts })).status, 503);
  assert.equal(calls.length, 4);
});

test("concurrent Pix requests from separate players share one prepaid gateway wallet", async (t) => {
  const app = await setup();
  t.after(() => app.sqlite.close());
  const b = await accountRequest(
    app.req("/api/account/register", "POST", "", {
      email: "wallet@example.test",
      password: "sample-game-wallet",
    }),
    app.env,
  );
  const other = (await b.json()).user.id,
    now = Date.now();
  const grant = { product_id: "pix_starter", period_start: now - 1000, expires_at: now + 86400000 };
  const wallet = { checkedAt: now, availableMicros: 100000 };
  const outcomes = await Promise.allSettled(
    [app.user, other].map((user, i) =>
      reserveGeneration(
        app.db,
        user,
        "shared-wallet-" + i,
        grant,
        "anthropic",
        60000,
        now,
        "anthropic/claude-haiku-4.5",
        wallet,
      ),
    ),
  );
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  const failed = outcomes.find((r) => r.status === "rejected");
  assert.equal((failed as PromiseRejectedResult).reason.code, "provider_unavailable");
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_pix_usage").get() as any).n, 1);
});

test("complimentary access follows one existing account through web, offline leases and Pix", async (t) => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const app = await setup({
    STORE_LEASE_SIGNING_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", keys.privateKey)),
    OPENAI_API_KEY: "local-fixture",
  });
  t.after(() => app.sqlite.close());
  const register = (email: string) =>
    accountRequest(
      app.req("/api/account/register", "POST", "", { email, password: "city password 9" }),
      app.env,
    );
  const peer = await register("other@example.test");
  const peerCookie = peer.headers.get("set-cookie")!.split(";")[0],
    peerId = (await peer.json()).user.id;
  const snapshot = async (cookie: string) =>
    (await commerceRequest(app.req("/api/commerce/access", "GET", cookie), app.env)).json();
  app.sqlite.prepare("INSERT INTO game_complimentary_access(slot,user_id) VALUES(1,?)").run(app.user);
  assert.throws(() =>
    app.sqlite.prepare("INSERT INTO game_complimentary_access(slot,user_id) VALUES(2,?)").run(peerId),
  );
  const access = await snapshot(app.cookie);
  assert.equal(access.plan, "pix_complete");
  assert.equal(access.complimentary, true);
  assert.equal(access.usage.limit, 2500);
  assert.equal(access.pixBilling, null);
  assert.ok(STORE_PRODUCTS.every((p) => canUseProduct(access, p.id)));
  const [head, body, sig] = access.lease.split(".");
  assert.ok(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      keys.publicKey,
      Buffer.from(sig, "base64url"),
      Buffer.from(head + "." + body),
    ),
  );
  const lease = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.equal(lease.sub, app.user);
  assert.equal(lease.complimentary, true);
  assert.ok(lease.exp > Date.now() / 1000 + 6 * 86400 && lease.exp <= Date.now() / 1000 + 7 * 86400);
  for (const cookie of ["", peerCookie]) {
    const other = await snapshot(cookie);
    assert.equal(other.plan, null);
    assert.ok(!other.complimentary);
    assert.ok(!canUseProduct(other, "mode_god"));
  }
  for (const id of ["era_rome", "mode_god", "pix_starter", "pix_complete"]) {
    const response = await app.call("checkout", { productId: id });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "owned");
  }
  assert.equal((await register("ADA@example.COM")).status, 409);
  assert.equal((await app.call("access", undefined, { "X-Game-Account": peerId })).status, 409);
  const generate = (cookie: string) =>
    pixWithPlans(
      app.req(
        "/api/pix/world",
        "POST",
        cookie,
        { prompt: "Plant an orchard" },
        { "X-Pix-Provider": "openai", "Idempotency-Key": "owner-request" },
      ),
      app.env,
      null,
    );
  const provider = t.mock.method(globalThis, "fetch", async () =>
    json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({ operations: [] }) }] }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }),
  );
  assert.equal((await generate(peerCookie)).status, 402);
  assert.equal((await generate(app.cookie)).status, 200);
  assert.equal(provider.mock.callCount(), 1);
  assert.equal((await snapshot(app.cookie)).usage.messages, 1);
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_purchases").get() as any).n, 0);
  const deletion = await accountRequest(
    app.req("/api/account/me", "DELETE", app.cookie, { password: "city password 9" }),
    app.env,
  );
  assert.equal(deletion.status, 200);
  const recreated = await register("ADA@example.com");
  const recreatedCookie = recreated.headers.get("set-cookie")!.split(";")[0];
  assert.notEqual((await recreated.json()).user.id, app.user);
  assert.equal((await snapshot(recreatedCookie)).plan, null);
  assert.equal((app.sqlite.prepare("SELECT COUNT(*) AS n FROM game_complimentary_access").get() as any).n, 0);
});

test("complimentary Pix uses calendar months and only uncommitted gateway credits", async (t) => {
  const app = await setup();
  t.after(() => app.sqlite.close());
  app.sqlite.prepare("INSERT INTO game_complimentary_access(slot,user_id) VALUES(1,?)").run(app.user);
  const peer = await accountRequest(
    app.req("/api/account/register", "POST", "", {
      email: "neighbor@example.test",
      password: "city password 9",
    }),
    app.env,
  );
  const peerId = (await peer.json()).user.id;
  const now = Date.UTC(2028, 1, 29);
  const grant = (await activeGrants(app.db, app.user, now)).plan;
  assert.deepEqual(usageWindow(grant, now), [Date.UTC(2028, 1, 1), Date.UTC(2028, 2, 1)]);
  assert.deepEqual(usageWindow(grant, Date.UTC(2028, 11, 31)), [Date.UTC(2028, 11, 1), Date.UTC(2029, 0, 1)]);
  const wallet = { availableMicros: 800, checkedAt: now };
  app.sqlite
    .prepare(
      "INSERT INTO game_pix_funded_terms(id,user_id,product_id,budget_micros,kind,state,created_at,hold_until) VALUES('paid',?,'pix_starter',600,'initial','held',?,?)",
    )
    .run(peerId, now, now + 86400000);
  const reserve = (id: string, cost: number) =>
    reserveGeneration(app.db, app.user, id, grant, "openai", cost, now, GATEWAY_MODELS.openai, wallet);
  const results = await Promise.allSettled([
    reserve("owner-simultaneous-a", 150),
    reserve("owner-simultaneous-b", 150),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.ok(results.some((x) => x.status === "rejected" && x.reason.code === "provider_unavailable"));
  await assert.rejects(reserve("owner-over", 51), { code: "provider_unavailable" });
  await reserve("owner-last", 50);
  assert.equal((app.sqlite.prepare("SELECT SUM(cost_micros) AS n FROM game_pix_usage").get() as any).n, 200);
});
