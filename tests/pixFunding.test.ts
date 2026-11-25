import assert from "node:assert/strict";
import test from "node:test";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { recordPurchase } from "../worker/store-data.mjs";
import { GATEWAY_MODELS } from "../worker/pix-gateway.mjs";
import {
  pixAdmission,
  reservePixCheckout,
  commitPixCheckout,
  attachPixSubscription,
  activatePixTerm,
  reservePixRenewal,
  releaseUnchargeablePixTerm,
} from "../worker/pix-funding.mjs";

function setup(t: any, initialCents = 999.91557) {
  const { db, sqlite } = openAccountDatabase(":memory:");
  t.after(() => sqlite.close());
  let balance = initialCents;
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, result: { balance } }));
  const env = {
    GAME_ACCOUNTS: db,
    AI: { run() {} },
    PIX_GATEWAY_VERIFIED_MODELS: Object.values(GATEWAY_MODELS).join(","),
    PIX_GATEWAY_ACCOUNT: "a".repeat(32),
    PIX_GATEWAY_READ_TOKEN: "test",
    PIX_GATEWAY_ID: "test",
  };
  const user = (id: string) => {
    sqlite
      .prepare(
        "INSERT INTO game_users(id,email,password_salt,password_hash,created_at) VALUES(?,?,'x','y',1)",
      )
      .run(id, id + "@example.test");
    return id;
  };
  const admission = (id?: string) => pixAdmission(env, id, Object.keys(GATEWAY_MODELS), true);
  return {
    db,
    sqlite,
    env,
    user,
    admission,
    setBalance: (cents: number) => {
      balance = cents;
    },
  };
}
test("one prepaid wallet admits just the affordable tiers and cannot oversell concurrent checkouts", async (t) => {
  const x = setup(t);
  const users = ["one", "two", "three", "four", "five"].map(x.user);
  const view = await x.admission();
  assert.equal(view.native, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(view.tiers).map(([k, v]: [string, any]) => [k, v.reason])),
    {
      pix_starter: "available",
      pix_builder: "available",
      pix_studio: "wallet_capacity",
      pix_complete: "wallet_capacity",
    },
  );
  const sales = await Promise.allSettled(
    users.slice(0, 3).map((u) => reservePixCheckout(x.env, u, "pix_builder")),
  );
  assert.equal(sales.filter((res) => res.status === "fulfilled").length, 2);
  assert.equal((sales.find((res) => res.status === "rejected") as any).reason.code, "pix_capacity");
  assert.equal((await x.admission()).tiers.pix_builder.available, false);
  assert.equal((await x.admission()).tiers.pix_starter.available, false);
  await assert.rejects(reservePixCheckout(x.env, users[3], "pix_starter"), { code: "pix_capacity" });
  const winner = users[sales.findIndex((r) => r.status === "fulfilled")];
  const held = await reservePixCheckout(x.env, winner, "pix_builder");
  assert.equal((await reservePixCheckout(x.env, winner, "pix_builder")).id, held.id);
  assert.equal((await x.admission(winner)).tiers.pix_builder.available, true);
});
test("existing subscriptions retain their funded allowance and a settled tracked term is counted once", async (t) => {
  const x = setup(t, 500),
    a = x.user("old-player"),
    b = x.user("new-player"),
    now = Date.now(),
    end = now + 30 * 86400000;
  await recordPurchase(x.db, {
    store: "stripe",
    key: "sub_existing",
    user: a,
    product: "pix_builder",
    active: true,
    start: now - 1000,
    end,
    checked: now,
    next: end,
    source: "sub_existing",
  });
  assert.equal((await x.admission()).tiers.pix_starter.available, false);
  x.sqlite.prepare("UPDATE game_purchases SET active=0 WHERE user_id=?").run(a);
  const term = await reservePixCheckout(x.env, b, "pix_builder");
  await commitPixCheckout(x.env, term.id, b, "pix_builder");
  await attachPixSubscription(x.db, term.id, "sub_new", now, end);
  await assert.rejects(attachPixSubscription(x.db, term.id, "sub_foreign", now, end), {
    code: "pix_term_mismatch",
  });
  await activatePixTerm(x.db, "sub_new", now, end);
  await recordPurchase(x.db, {
    store: "stripe",
    key: "sub_new",
    user: b,
    product: "pix_builder",
    active: true,
    start: now,
    end,
    checked: now,
    next: end,
    source: "sub_new",
  });
  x.setBalance(1000);
  const other = await reservePixCheckout(x.env, a, "pix_builder");
  assert.ok(other.id);
  await releaseUnchargeablePixTerm(x.db, term.id);
  assert.equal(
    (x.sqlite.prepare("SELECT state FROM game_pix_funded_terms WHERE id=?").get(term.id) as any).state,
    "active",
  );
});
test("an expired setup cannot charge after capacity is taken and a pinned invoice never vanishes on a local timeout", async (t) => {
  const x = setup(t, 150),
    a = x.user("early"),
    b = x.user("later");
  const early = await reservePixCheckout(x.env, a, "pix_starter");
  x.sqlite.prepare("UPDATE game_pix_funded_terms SET hold_until=1 WHERE id=?").run(early.id);
  const later = await reservePixCheckout(x.env, b, "pix_starter");
  await assert.rejects(commitPixCheckout(x.env, early.id, a, "pix_starter"), { code: "pix_capacity" });
  await commitPixCheckout(x.env, later.id, b, "pix_starter");
  x.sqlite.prepare("UPDATE game_pix_funded_terms SET hold_until=1 WHERE id=?").run(later.id);
  await assert.rejects(reservePixCheckout(x.env, a, "pix_starter"), { code: "pix_capacity" });
  await releaseUnchargeablePixTerm(x.db, later.id);
  const refreshed = await reservePixCheckout(x.env, a, "pix_starter");
  assert.notEqual(refreshed.id, early.id);
  assert.equal((await commitPixCheckout(x.env, refreshed.id, a, "pix_starter")).id, refreshed.id);
});
test("renewals require a full additional contiguous month and are idempotent under concurrency", async (t) => {
  const x = setup(t, 150),
    u = x.user("renewing");
  const now = Date.now(),
    end = now + 30 * 86400000,
    next = end + 31 * 86400000;
  const term = await reservePixCheckout(x.env, u, "pix_starter");
  await commitPixCheckout(x.env, term.id, u, "pix_starter");
  await attachPixSubscription(x.db, term.id, "sub_recurring", now, end);
  await activatePixTerm(x.db, "sub_recurring", now, end);
  await assert.rejects(reservePixRenewal(x.env, u, "pix_starter", "sub_recurring", end, next), {
    code: "pix_capacity",
  });
  x.setBalance(300);
  const renew = () => reservePixRenewal(x.env, u, "pix_starter", "sub_recurring", end, next);
  const [a, b] = await Promise.all([renew(), renew()]);
  assert.equal(a.id, b.id);
  await assert.rejects(
    reservePixRenewal(x.env, u, "pix_starter", "sub_recurring", next, next + 30 * 86400000),
    { code: "pix_capacity" },
  );
  assert.equal(
    (x.sqlite.prepare("SELECT COUNT(*) n FROM game_pix_funded_terms WHERE kind='renewal'").get() as any).n,
    1,
  );
});

test("the top-up fee does not create additional sellable credits or reduce any promised inference", async (t) => {
  const x = setup(t, 999.91557);
  const users = Array.from({ length: 7 }, (_, i) => x.user("starter-" + i));
  const attempts = await Promise.allSettled(users.map((u) => reservePixCheckout(x.env, u, "pix_starter")));
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 6);
  assert.equal(
    (
      x.sqlite
        .prepare("SELECT SUM(budget_micros) AS total FROM game_pix_funded_terms WHERE state='held'")
        .get() as any
    ).total,
    8940000,
  );
  assert.equal((await x.admission()).tiers.pix_starter.available, false);
});

test("a disconnected provider blocks a new charge even if a setup had already held enough credits", async (t) => {
  const x = setup(t, 500),
    u = x.user("bad-connection");
  const hold = await reservePixCheckout(x.env, u, "pix_starter");
  const partial = { ...x.env, PIX_GATEWAY_VERIFIED_MODELS: "openai/gpt-6-luna" };
  await assert.rejects(commitPixCheckout(partial, hold.id, u, "pix_starter"), {
    code: "providers_unavailable",
  });
  assert.equal(
    (x.sqlite.prepare("SELECT state FROM game_pix_funded_terms WHERE id=?").get(hold.id) as any).state,
    "held",
  );
});
