import assert from "node:assert/strict";
import test from "node:test";
import { allowTestKey, main, testTransport } from "../scripts/store/rehearse-stripe.mjs";
import { STRIPE_API_VERSION } from "../worker/stripe-store.mjs";

test("the processor rehearsal refuses missing, live, publishable and generic credentials before any network request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw Error("should never contact a provider");
  });
  const prev = process.env.PIX_STRIPE_TEST_KEY;
  t.after(() => {
    if (prev === undefined) delete process.env.PIX_STRIPE_TEST_KEY;
    else process.env.PIX_STRIPE_TEST_KEY = prev;
  });
  for (const value of [
    "",
    "sk_live_example",
    "rk_live_example",
    "pk_test_example",
    "someoneelse_test_example",
  ]) {
    process.env.PIX_STRIPE_TEST_KEY = value;
    await assert.rejects(main(["--run"]), /test-mode secret or restricted key/);
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.doesNotThrow(() => allowTestKey("rk_test_fixture1234"));
});
test("even a test key must get an explicitly test-mode Stripe balance before any fixture is created", async (t) => {
  const prev = process.env.PIX_STRIPE_TEST_KEY;
  process.env.PIX_STRIPE_TEST_KEY = "sk_test_fixture1234";
  t.after(() => {
    if (prev === undefined) delete process.env.PIX_STRIPE_TEST_KEY;
    else process.env.PIX_STRIPE_TEST_KEY = prev;
  });
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL | string, init: RequestInit = {}) => {
    calls.push(String(init.method) + " " + String(url));
    return Response.json({ livemode: true });
  });
  await assert.rejects(main(["--run"]), /live-mode object/);
  assert.deepEqual(calls, ["GET https://api.stripe.com/v1/balance"]);
});
test("test transport isolates gaming credit, pins the deployed API version and never follows redirects", async () => {
  const key = "sk_test_fixture1234",
    requests: any[] = [];
  const send = testTransport(
    key,
    async (url: any, opts: any) => {
      requests.push([url, opts]);
      return Response.json({});
    },
    () => 100,
  );
  const options = { headers: { Authorization: "Bearer " + key, "Stripe-Version": STRIPE_API_VERSION } };
  for (const target of [
    "https://api.stripe.com.bad.test/v1/balance",
    "https://pixelcivilization.app/api/commerce/checkout",
    "https://api.stripe.com/v2/accounts",
  ])
    await assert.rejects(send(target, options), /Blocked/);
  await assert.rejects(
    send("https://api.stripe.com/v1/balance", { headers: { ...options.headers, "Stripe-Version": "wrong" } }),
    /Blocked/,
  );
  await assert.rejects(
    send("https://api.stripe.com/v1/balance", {
      headers: { ...options.headers, Authorization: "Bearer sk_live_wrong" },
    }),
    /Blocked/,
  );
  const wallet = await send(
    "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/ai-gateway/billing/credit-balance",
  );
  assert.equal((await wallet.json()).result.balance, 100);
  assert.equal(requests.length, 0);
  await send("https://api.stripe.com/v1/balance", options);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].redirect, "error");
});
