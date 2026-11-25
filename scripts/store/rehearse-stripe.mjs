// Run directly with Node 24+. The only eligible credential is an explicitly designated Stripe test key.
import { strict as assert } from "node:assert";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { openAccountDatabase } from "../../src/server/localAccounts.mjs";
import { STORE_PRODUCTS } from "../../src/game/storeCatalog.mjs";
import { PIX_BILLING_CONSENT_VERSION } from "../../src/game/pixBillingConsent.mjs";
import { GATEWAY_MODELS, invalidateGatewayBalance } from "../../worker/pix-gateway.mjs";
import { settleFundedCard } from "../../worker/funded-subscriptions.mjs";
import {
  checkout,
  fundedSnapshot,
  maintainPixBilling,
  portal,
  reconcileSession,
  stopPixRenewal,
  STRIPE_API_VERSION,
} from "../../worker/stripe-store.mjs";

const apiBase = "https://api.stripe.com/v1/";
const walletUrl =
  "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/ai-gateway/billing/credit-balance";
const plans = STORE_PRODUCTS.filter((p) => p.kind === "subscription");
const role = "pix_starter";
const realNow = Date.now;
const id = (value) => (typeof value === "string" ? value : value?.id);
const help =
  "Use --check for a read-only test-account preflight, --run for a processor rehearsal, or --run --hosted for human completion of Stripe Checkout and its first invoice. Set PIX_STRIPE_TEST_KEY through a private environment variable. The script ignores production credentials.";

export function allowTestKey(value) {
  if (typeof value !== "string" || !/^([sr]k)_test_[A-Za-z0-9]{8,}$/.test(value))
    throw Error(
      "A Stripe test-mode secret or restricted key is required in PIX_STRIPE_TEST_KEY. No Stripe request was sent.",
    );
}
async function poll(description, fn, timeout = 120000, interval = 1200) {
  const until = realNow() + timeout;
  do {
    const value = await fn();
    if (value) return value;
    await delay(interval);
  } while (realNow() < until);
  throw Error(description + " timed out");
}
function safeHost(value, hosts) {
  const url = new URL(value);
  assert.ok(
    url.protocol === "https:" && hosts.includes(url.hostname) && !url.username && !url.password && !url.port,
    "Unexpected hosted Stripe URL",
  );
  return url.href;
}
export function testTransport(key, nativeFetch, readWallet) {
  allowTestKey(key);
  return async function (input, options = {}) {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.href === walletUrl) return Response.json({ success: true, result: { balance: readWallet() } });
    const headers = new Headers(options.headers ?? (input instanceof Request ? input.headers : undefined));
    if (
      url.origin !== "https://api.stripe.com" ||
      !url.pathname.startsWith("/v1/") ||
      url.username ||
      url.password ||
      headers.get("Authorization") !== "Bearer " + key ||
      headers.get("Stripe-Version") !== STRIPE_API_VERSION
    )
      throw Error("Blocked a request outside the test-mode Stripe API");
    return nativeFetch(input, { ...options, redirect: "error" });
  };
}
function stripeApi(key, run, transport) {
  return async function api(path, fields, method = fields ? "POST" : "GET", idem) {
    const headers = { Authorization: "Bearer " + key, "Stripe-Version": STRIPE_API_VERSION };
    const body = fields ? new URLSearchParams(fields) : undefined;
    if (method === "POST")
      headers["Idempotency-Key"] =
        idem ||
        "pix-qa-" +
          run +
          "-" +
          createHash("sha256")
            .update(path + "\n" + body)
            .digest("hex");
    const url = apiBase + path;
    for (let n = 0; n < 3; n++) {
      let response;
      try {
        response = await transport(url, { method, headers, body, signal: AbortSignal.timeout(20000) });
      } catch (e) {
        if (n < 2) {
          await delay(500 * (n + 1));
          continue;
        }
        throw e;
      }
      const data = await response.json();
      if ((response.status === 429 || response.status >= 500) && n < 2) {
        await delay(500 * (n + 1));
        continue;
      }
      if (!response.ok)
        throw Error(
          method +
            " " +
            new URL(url).pathname +
            " failed (HTTP " +
            response.status +
            ", " +
            (data.error?.code || data.error?.type || "Stripe error") +
            ", request " +
            (response.headers.get("request-id") || "unavailable") +
            ")",
        );
      if (data.livemode === true || data.data?.some((v) => v.livemode === true))
        throw Error("Stripe returned a live-mode object; stopped");
      return data;
    }
  };
}
async function preflight(api) {
  const balance = await api("balance");
  assert.equal(balance.livemode, false, "Stripe must explicitly confirm test mode before any write");
  const tax = await api("tax/settings");
  assert.equal(tax.status, "active", "Activate Stripe Tax in this test environment first");
  return { stripeTestMode: true, taxStatus: tax.status, apiVersion: STRIPE_API_VERSION };
}
async function loopback() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    res.end("Return to the Pixel Civilization test runner to continue.");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { url: "http://127.0.0.1:" + server.address().port, close: () => server.close() };
}

async function rehearse(key, hosted) {
  const run = randomUUID(),
    originalFetch = globalThis.fetch;
  let credits = 1000,
    simulationTime = null;
  const transport = testTransport(key, originalFetch, () => credits);
  const api = stripeApi(key, run, transport),
    remote = (_env, p, fields, idem) => api(p, fields, fields ? "POST" : "GET", idem);
  const evidence = { run, hosted, ...(await preflight(api)), checks: {}, cleanup: [] };
  const { db, sqlite } = openAccountDatabase(":memory:");
  const local = await loopback(),
    prices = {},
    cleanup = [];
  const own = (kind, obj, remove) => {
    cleanup.push({ kind, id: obj.id, remove });
    return obj;
  };
  const tag = { "metadata[pixel_rehearsal]": run };
  const checks = evidence.checks;
  let env, clock;
  const row = (user) => sqlite.prepare("SELECT * FROM game_stripe_funded WHERE user_id=?").get(user.id);
  const access = (user) => fundedSnapshot(db, user.id);
  const service = async (user) => {
    sqlite.prepare("UPDATE game_stripe_funded SET next_check=0 WHERE user_id=?").run(user.id);
    await maintainPixBilling(env);
    return access(user);
  };
  const advance = async (time) => {
    await api("test_helpers/test_clocks/" + clock.id + "/advance", { frozen_time: String(time) });
    await poll("Stripe clock advance", async () => {
      const state = await api("test_helpers/test_clocks/" + clock.id);
      assert.notEqual(state.status, "internal_failure", "Stripe test clock failed");
      return state.status === "ready" && state.frozen_time === time;
    });
    simulationTime = time;
  };
  async function player(label) {
    const user = { id: randomUUID(), email: label + "-" + run + "@example.invalid" };
    const customer = await api("customers", {
      ...tag,
      "metadata[pixel_account]": user.id,
      test_clock: clock.id,
      email: user.email,
      name: "Pixel test " + label,
      "address[line1]": "1 Market St",
      "address[city]": "San Francisco",
      "address[state]": "CA",
      "address[country]": "US",
      "address[postal_code]": "94105",
    });
    assert.equal(customer.test_clock, clock.id);
    sqlite
      .prepare("INSERT INTO game_users(id,email,password_salt,password_hash,created_at) VALUES(?,?,?, ?,?)")
      .run(user.id, user.email, "fixture", "fixture", Date.now());
    sqlite
      .prepare("INSERT INTO game_stripe_customers(user_id,customer_id) VALUES(?,?)")
      .run(user.id, customer.id);
    return { user, customer: customer.id };
  }
  async function setup(label, useHosted) {
    const { user, customer } = await player(label);
    const result = await checkout(env, user, role, { version: PIX_BILLING_CONSENT_VERSION, accepted: true });
    const saved = row(user);
    assert.equal((await access(user)).state, "setup_open");
    const checkoutUrl = safeHost(result.url, ["checkout.stripe.com"]);
    let payment;
    if (useHosted) {
      console.error(
        "Complete this TEST Checkout with Stripe's test card and a test billing address. This privately generated URL expires shortly.\n" +
          checkoutUrl,
      );
      const session = await poll(
        "Hosted card setup",
        async () => {
          const s = await api("checkout/sessions/" + saved.setup_session);
          if (s.status === "expired") throw Error("Hosted Checkout expired");
          return s.status === "complete" && s;
        },
        16 * 60000,
        2500,
      );
      await reconcileSession(env, session.id, user.id);
      payment = id((await api("setup_intents/" + id(session.setup_intent))).payment_method);
    } else {
      // Hosted Checkout has no public server operation to submit the customer form. Expire its real
      // session, then exercise the same post-SetupIntent billing function with a genuine card fixture.
      const expired = await api("checkout/sessions/" + saved.setup_session + "/expire", {});
      assert.equal(expired.status, "expired");
      const method = await api("payment_methods", {
        type: "card",
        "card[token]": "tok_visa",
        ...tag,
        "metadata[pixel_role]": label,
      });
      const intent = await api("setup_intents", {
        customer,
        payment_method: method.id,
        confirm: "true",
        usage: "off_session",
        "allowed_payment_method_types[0]": "card",
        ...tag,
        "metadata[pixel_funded_root]": saved.first_term,
        "metadata[pixel_consent_version]": PIX_BILLING_CONSENT_VERSION,
      });
      assert.equal(intent.status, "succeeded");
      payment = id(intent.payment_method);
      await settleFundedCard(env, saved.first_term, intent.id, remote, async () => {}, true);
    }
    const billing = await access(user),
      binding = row(user);
    assert.equal(billing.state, "invoice_open");
    safeHost(billing.invoiceUrl, ["invoice.stripe.com", "pay.stripe.com"]);
    const bill = await api("invoices/" + binding.invoice_id);
    assert.equal(bill.automatic_tax.status, "complete");
    assert.equal(bill.collection_method, "send_invoice");
    assert.equal(bill.subtotal, 499);
    const schedule = await api("subscription_schedules/" + binding.schedule_id);
    assert.equal(schedule.end_behavior, "cancel");
    assert.equal(schedule.phases.length, 1);
    return { user, payment, bill, binding, schedule, invoiceUrl: billing.invoiceUrl };
  }

  let failed;
  try {
    globalThis.fetch = transport;
    Date.now = () => (simulationTime === null ? realNow() : simulationTime * 1000);
    console.error("Starting isolated Stripe test run " + run);
    const existing = await api("billing_portal/configurations?limit=100");
    const requested = process.env.PIX_STRIPE_TEST_PORTAL_CONFIG;
    let config;
    if (requested) {
      assert.match(requested, /^bpc_[A-Za-z0-9]+$/);
      config = await api("billing_portal/configurations/" + requested);
      assert.equal(config.is_default, false, "Use a dedicated test portal configuration");
    } else {
      // Leave the merchant's default portal untouched, including in shared test mode.
      assert.ok(
        existing.data.length,
        "Initialize the test customer portal in your existing Stripe test environment, then retry.",
      );
      config = await api("billing_portal/configurations", {
        ...tag,
        "business_profile[headline]": "Pixel Civilization test billing",
        "features[invoice_history][enabled]": "true",
        "features[payment_method_update][enabled]": "true",
        "features[subscription_update][enabled]": "false",
        "features[subscription_cancel][enabled]": "false",
        "login_page[enabled]": "false",
      });
      assert.equal(config.is_default, false, "Refusing to modify a merchant default portal");
      own("portal", config, (id) => api("billing_portal/configurations/" + id, { active: "false" }));
    }
    const product = own(
      "product",
      await api("products", { ...tag, name: "Pixel Civilization test " + run }),
      (id) => api("products/" + id, { active: "false" }),
    );
    for (const p of plans) {
      const price = own(
        "price",
        await api("prices", {
          ...tag,
          product: product.id,
          currency: "usd",
          unit_amount: String(p.usdCents),
          "recurring[interval]": "month",
          tax_behavior: "exclusive",
          "metadata[pixel_product]": p.id,
        }),
        (id) => api("prices/" + id, { active: "false" }),
      );
      prices[p.id] = price.id;
    }
    const frozen = Math.floor(realNow() / 1000);
    clock = own(
      "test_clock",
      await api("test_helpers/test_clocks", { name: "Pixel Pix " + run, frozen_time: String(frozen) }),
      (id) => api("test_helpers/test_clocks/" + id, undefined, "DELETE"),
    );
    assert.equal(clock.frozen_time, frozen);
    // Checkout Session expiry uses real time, even while the customer's billing clock is frozen.
    // Simulate the application's date only once both card setups have finished and billing advances.
    env = {
      GAME_ACCOUNTS: db,
      STRIPE_SECRET_KEY: key,
      STRIPE_WEBHOOK_SECRET: "local-rehearsal-only",
      STRIPE_TAX_READY: "true",
      STRIPE_FUNDED_BILLING_READY: "true",
      STRIPE_PRICE_IDS: JSON.stringify(prices),
      STRIPE_PORTAL_CONFIG: config.id,
      STRIPE_FUNDED_PORTAL_CONFIG: config.id,
      STOREFRONT_ORIGIN: local.url,
      AI: {
        run() {
          throw Error("Inference is disabled in billing rehearsals");
        },
      },
      PIX_GATEWAY_ACCOUNT: "0".repeat(32),
      PIX_GATEWAY_ID: "local",
      PIX_GATEWAY_READ_TOKEN: "fixture",
      PIX_GATEWAY_VERIFIED_MODELS: Object.values(GATEWAY_MODELS).join(","),
    };
    const unpaid = await setup("unpaid", false);
    await stopPixRenewal(env, unpaid.user.id);
    assert.equal((await access(unpaid.user)).state, "ended");
    assert.equal((await api("invoices/" + unpaid.bill.id)).status, "void");
    checks.unpaidInvoiceVoided = true;
    const first = await setup("paid", hosted);
    if (hosted) {
      console.error("Review the TEST tax total and pay the first invoice on Stripe.\n" + first.invoiceUrl);
      await poll(
        "Hosted first payment",
        async () => (await api("invoices/" + first.bill.id)).status === "paid",
        16 * 60000,
        2500,
      );
    } else {
      const paid = await api("invoices/" + first.bill.id + "/pay", { payment_method: first.payment });
      assert.equal(paid.status, "paid");
    }
    assert.equal((await service(first.user)).state, "active");
    const original = await api("invoices/" + first.bill.id);
    checks.firstInvoice = {
      subtotal: original.subtotal,
      total: original.total,
      paid: original.amount_paid,
      currency: original.currency,
      automaticTaxStatus: original.automatic_tax.status,
    };
    checks.hostedSetupAndPayment = hosted
      ? "completed by operator"
      : "hosted session created and expired; actual card SetupIntent and invoice paid through API";
    const portalUrl = safeHost((await portal(env, first.user)).url, ["billing.stripe.com"]);
    checks.restrictedPortalSession = true;
    const customerPath = "customers/" + first.binding.customer_id;
    const previousCard = id((await api(customerPath)).invoice_settings?.default_payment_method);
    assert.ok(previousCard);
    let replacement;
    if (hosted) {
      console.error(
        "Use the TEST billing portal to add another Stripe test card and set it as the default.\n" +
          portalUrl,
      );
      replacement = await poll(
        "Hosted card replacement",
        async () => {
          const current = id((await api(customerPath)).invoice_settings?.default_payment_method);
          return current && current !== previousCard && current;
        },
        16 * 60000,
        2500,
      );
    } else {
      const method = await api("payment_methods", {
        type: "card",
        "card[token]": "tok_visa",
        ...tag,
        "metadata[pixel_role]": "replacement",
      });
      const saved = await api("setup_intents", {
        customer: first.binding.customer_id,
        payment_method: method.id,
        confirm: "true",
        usage: "off_session",
        "allowed_payment_method_types[0]": "card",
        ...tag,
      });
      assert.equal(saved.status, "succeeded");
      replacement = id(saved.payment_method);
      assert.notEqual(replacement, previousCard);
      await api(customerPath, { "invoice_settings[default_payment_method]": replacement });
    }
    const end = first.schedule.phases[0].end_date;
    await advance(end - 2 * 86400);
    credits = 100;
    invalidateGatewayBalance(env);
    await service(first.user);
    assert.equal((await api("subscription_schedules/" + first.schedule.id)).phases.length, 1);
    checks.lowWalletKeptRemoteCutoff = true;
    credits = 1000;
    invalidateGatewayBalance(env);
    await service(first.user);
    const funded = await api("subscription_schedules/" + first.schedule.id);
    assert.equal(funded.end_behavior, "cancel");
    assert.equal(funded.phases.length, 2);
    assert.equal(funded.phases[1].start_date, end);
    assert.equal(funded.phases[1].collection_method, "charge_automatically");
    const reservation = sqlite
      .prepare(
        "SELECT state,period_start,period_end FROM game_pix_funded_terms WHERE subscription_id=? AND kind='renewal'",
      )
      .get(first.binding.subscription_id);
    assert.equal(reservation.state, "committed");
    assert.equal(reservation.period_end, funded.phases[1].end_date * 1000);
    checks.onePrepaidRenewal = true;
    await advance(end + 120);
    await advance(end + 7200);
    const renewal = await poll(
      "Automatically charged renewal invoice",
      async () => {
        const sub = await api("subscriptions/" + first.binding.subscription_id + "?expand[]=latest_invoice");
        const invoice = sub.latest_invoice;
        return invoice?.id !== first.bill.id && invoice?.status === "paid" && invoice;
      },
      90000,
    );
    await service(first.user);
    assert.equal((await access(first.user)).paidThrough, reservation.period_end);
    assert.equal(renewal.automatic_tax.status, "complete");
    checks.renewal = {
      subtotal: renewal.subtotal,
      total: renewal.total,
      paid: renewal.amount_paid,
      currency: renewal.currency,
      automaticTaxStatus: renewal.automatic_tax.status,
    };
    await stopPixRenewal(env, first.user.id);
    const stopped = await access(first.user);
    assert.equal(stopped.state, "active");
    assert.equal(stopped.renews, false);
    checks.stopPreservedPaidTerm = true;
    const payments = await api("invoice_payments?invoice=" + renewal.id + "&limit=10");
    const pi = id(
      payments.data.find((p) => p.status === "paid" && p.payment?.payment_intent)?.payment.payment_intent,
    );
    assert.ok(pi, "Expected an actual card PaymentIntent for the renewal invoice");
    assert.equal(id((await api("payment_intents/" + pi)).payment_method), replacement);
    checks.renewalUsedReplacementCard = hosted
      ? "changed through hosted portal"
      : "changed through Stripe test API";
    const refund = await api("refunds", { payment_intent: pi, ...tag });
    await poll("Stripe test refund", async () => (await api("refunds/" + refund.id)).status === "succeeded");
    await poll("Refunded grant revocation", async () => (await service(first.user)).state === "revoked");
    checks.refundedRenewalRevoked = true;
    checks.webhookEvidence =
      "This rehearsal retrieves authoritative Stripe receipts; it does not certify delivery of the deployed signed webhook.";
  } catch (error) {
    failed = error;
  } finally {
    Date.now = realNow;
    for (const resource of cleanup.reverse()) {
      try {
        await resource.remove(resource.id);
        evidence.cleanup.push({ type: resource.kind, status: "completed" });
      } catch {
        evidence.cleanup.push({
          type: resource.kind,
          id: resource.id,
          status: "requires test-account cleanup",
        });
        failed ??= Error("Some test fixtures require cleanup");
      }
    }
    globalThis.fetch = originalFetch;
    local.close();
    sqlite.close();
    console.log(JSON.stringify(evidence, null, 2));
  }
  if (failed) throw failed;
}
export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes("--help")) {
    console.log(help);
    return;
  }
  if (
    args.some((arg) => !["--check", "--run", "--hosted"].includes(arg)) ||
    args.includes("--check") === args.includes("--run") ||
    (args.includes("--hosted") && !args.includes("--run"))
  )
    throw Error(help);
  const key = process.env.PIX_STRIPE_TEST_KEY;
  allowTestKey(key);
  if (args.includes("--check")) {
    const api = stripeApi(
      key,
      randomUUID(),
      testTransport(key, globalThis.fetch, () => 0),
    );
    console.log(JSON.stringify(await preflight(api), null, 2));
  } else await rehearse(key, args.includes("--hosted"));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
