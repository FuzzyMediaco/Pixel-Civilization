import test from "node:test";
import assert from "node:assert/strict";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";

import { randomBytes } from "node:crypto";
import { accountRequest } from "../worker/accounts.mjs";

function setup() {
  const { sqlite, db } = openAccountDatabase(":memory:");
  let cookie = "";
  const call = async (path: string, method = "GET", payload?: unknown, headers?: Record<string, string>) => {
    const req = new Request("https://pixelcivilization.app/api/account/" + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });
    const res = await accountRequest(req, { GAME_ACCOUNTS: db });
    const issued = res.headers.get("set-cookie");
    if (issued) cookie = issued.split(";")[0];
    return { status: res.status, body: await res.json() as any, cookie, issued };
  };
  return { sqlite, call };
}

test("email accounts and sessions are isolated, expire, and can be revoked", async () => {
  const { sqlite, call } = setup();
  try {
    assert.deepEqual((await call("me")).body, { user: null });
    const body = { email: "Ada@Example.org", password: "an island password" };
    const first = await call("register", "POST", body);
    assert.equal(first.status, 201);
    assert.equal(first.body.user.email, "ada@example.org");
    assert.match(first.issued!, /Secure; HttpOnly; SameSite=Lax/);
    assert.equal((await call("me")).body.user.id, first.body.user.id);
    assert.equal((await call("register", "POST", body)).status, 409);
    assert.equal((await call("login", "POST", { ...body, password: "other password" })).status, 401);
    assert.equal((await call("logout", "POST", {}, { Origin: "https://another.example" })).status, 403);
    assert.equal((await call("saves", "GET", undefined, { "X-Game-Account": "different" })).body.code, "account_changed");
    assert.equal((await call("logout", "POST", {})).status, 200);
    assert.equal((await call("saves", "GET", undefined, { Cookie: first.cookie })).status, 401);
    assert.equal((await call("login", "POST", body)).status, 200);
    sqlite.exec("UPDATE game_sessions SET expires_at=0");
    assert.equal((await call("me")).body.user, null);
    const credentials = sqlite.prepare("SELECT password_hash,password_salt FROM game_users").get()!;
    assert.notEqual(credentials.password_hash, body.password);
    assert.match(String(credentials.password_salt), /^[a-f0-9]{32}$/);
  } finally { sqlite.close(); }
});

test("large account saves survive interleaved writes, retries, deletion and backup restoration", async () => {
  const { sqlite, call } = setup();
  try {
    const first = await call("register", "POST", { email: "one@example.org", password: "private test1" });
    const big = '{"terrain":"' + "tile".repeat(1500000) + randomBytes(880000).toString("base64") + '"}';
    const path = "saves/example-real-meridian";
    const upload = { baseVersion: 0, data: big };
    assert.equal((await call(path, "PUT", upload)).body.version, 1);
    assert.equal((await call(path, "PUT", upload)).body.version, 1);
    assert.equal((await call(path)).body.data, big);
    assert.ok(Number(sqlite.prepare("SELECT count(*) AS n FROM game_save_chunks").get()!.n) >= 2);
    const writes = await Promise.all(["east", "west"].map(data => call(path, "PUT", { baseVersion: 1, data })));
    assert.deepEqual(writes.map(x => x.status).sort(), [200, 409]);
    const city = (await call(path)).body;
    assert.equal(city.version, 2);
    assert.equal((await call(path + "?previous=1")).body.data, big);
    const different = await call("register", "POST", { email: "two@example.org", password: "private test2" });
    assert.notEqual(first.body.user.id, different.body.user.id);
    assert.deepEqual((await call("saves")).body.saves, []);
    assert.equal((await call(path)).status, 404);
    const headers = { Cookie: first.cookie };
    const del = await call(path, "DELETE", { baseVersion: 2 }, headers);
    assert.deepEqual([del.body.version, del.body.deleted], [3, true]);
    assert.equal((await call(path, "GET", undefined, headers)).body.data, null);
    const previous = await call(path + "?previous=1", "GET", undefined, headers);
    assert.equal(previous.body.data, city.data);
    assert.equal((await call(path, "PUT", { baseVersion: 3, data: previous.body.data }, headers)).body.version, 4);
    assert.equal((await call("saves", "GET", undefined, headers)).body.saves[0].deleted, false);
    assert.equal((await call("saves/unknown", "PUT", { baseVersion: 999, data: "x" })).body.code, "conflict");
  } finally { sqlite.close(); }
});

test("a failed chunk write rolls back the revision and previous bytes", async () => {
  const { sqlite, call } = setup();
  try {
    await call("register", "POST", { email: "roll@example.org", password: "a decent password" });
    await call("saves/town", "PUT", { baseVersion: 0, data: "original" });
    sqlite.exec("CREATE TRIGGER fail_storage BEFORE INSERT ON game_save_chunks BEGIN SELECT RAISE(ABORT,'full'); END");
    assert.equal((await call("saves/town", "PUT", { baseVersion: 1, data: "changed" })).status, 503);
    const original = (await call("saves/town")).body;
    assert.deepEqual([original.version, original.data], [1, "original"]);
  } finally { sqlite.close(); }
});
