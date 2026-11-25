import assert from "node:assert/strict";
import test from "node:test";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { expirePixReports, pixReport } from "../worker/pix-reports.mjs";

test("guest reports are private, retryable and capped, and expire after the review period", async () => {
  const { db, sqlite } = openAccountDatabase(":memory:");
  const env = { GAME_ACCOUNTS: db };
  const path = "https://pixelcivilization.app/api/pix/report";
  const body = { id: crypto.randomUUID(), kind: "design", reason: "inappropriate", excerpt: "A description selected by the player." };
  const call = (payload = body, origin = new URL(path).origin) => pixReport(new Request(path, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(payload),
  }), env);
  try {
    assert.equal((await pixReport(new Request(path), env)).status, 405);
    assert.equal((await call(body, "https://example.com")).status, 403);
    assert.equal((await call({ ...body, excerpt: " " })).status, 400);
    assert.equal((await call({ ...body, excerpt: "z".repeat(3100) })).status, 400);
    assert.equal((await call()).status, 200);
    assert.equal((await call({ ...body, excerpt: "changed on retry" })).status, 200);
    const records = sqlite.prepare("SELECT * FROM game_pix_reports").all();
    assert.equal(records.length, 1);
    assert.equal(records[0].excerpt, body.excerpt);
    assert.deepEqual(Object.keys(records[0]).sort(), ["id","kind","reason","excerpt","created_at"].sort());
    for (let i = 1; i < 12; i++) assert.equal((await call({ ...body, id: crypto.randomUUID() })).status, 200);
    assert.equal((await call({ ...body, id: crypto.randomUUID() })).status, 429);
    assert.equal((await call()).status, 200);
    sqlite.prepare("UPDATE game_pix_reports SET created_at=0 WHERE id=?").run(body.id);
    await expirePixReports(env);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM game_pix_reports").get()!.n, 11);
  } finally { sqlite.close(); }
});
