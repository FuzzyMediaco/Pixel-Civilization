import assert from "node:assert/strict";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { accountRequest } from "../worker/accounts.mjs";
import { commerceRequest } from "../worker/commerce.mjs";
import { DAY, activeGrants } from "../worker/store-data.mjs";
import { productById, canUseProduct, STORE_PRODUCTS } from "../src/game/storeCatalog.mjs";
import { isGiftDesignKey } from "../src/game/giftDesignKeys.mjs";
import { reserveGeneration } from "../worker/pix-plans.mjs";
import { GATEWAY_MODELS } from "../worker/pix-gateway.mjs";

async function fixture() {
  const { db, sqlite } = openAccountDatabase(":memory:");
  const env = { GAME_ACCOUNTS:db };
  const request = async (cookie:string, path:string, data?:unknown, method = data === undefined ? "GET" : "POST") => {
    const r = new Request("https://pixelcivilization.app/api/" + path, { method, headers:{ Cookie:cookie, "Content-Type":"application/json" },
      ...(data === undefined ? {} : { body:JSON.stringify(data) }) });
    const response = path.startsWith("commerce/") ? await commerceRequest(r, env) : await accountRequest(r, env);
    return { status:response.status, data:await response.json() as any, cookie:response.headers.get("set-cookie")?.split(";")[0] ?? "",
      cache:response.headers.get("cache-control") };
  };
  const register = (email:string) => request("", "account/register", {email, password:"test game account"});
  const owner = await register("owner@example.test"), player = await register("neighbor@example.test"), treasurer = await register("cashier@example.test");
  const ownerId = owner.data.user.id, recipientId = player.data.user.id;
  sqlite.prepare("INSERT INTO game_account_owner(slot,user_id) VALUES(1,?)").run(ownerId);
  sqlite.prepare("INSERT INTO island_gift_issuers(user_id) VALUES(?),(?)").run(ownerId, treasurer.data.user.id);
  const control = (who:string, path:string, data:unknown = {}) => request(who, "account/controls/" + path, data);
  const give = (kind:string, itemId:string, requestId:string = randomUUID()) => control(owner.cookie,"give",{recipientId,kind,itemId,requestId});
  const access = () => request(player.cookie,"commerce/access");
  return { db, sqlite, request, register, owner, ownerId, recipientId, player, treasurer, control, give, access };
}

test("only the enrolled owner can page and search all accounts or open their controls", async t => {
  const f = await fixture(); t.after(() => f.sqlite.close());
  for (let i=0;i<28;i++) f.sqlite.prepare("INSERT INTO game_users VALUES(?,?, 'fixture','fixture',0)").run(randomUUID(), "list_" + String(i).padStart(2,"0") + "@example.test");
  for (const path of ["directory","player","designs","islands","give"]) {
    assert.equal((await f.control("",path)).status,401);
    assert.equal((await f.control(f.player.cookie,path)).status,403);
    assert.equal((await f.control(f.treasurer.cookie,path)).status,403);
  }
  const page = await f.control(f.owner.cookie,"directory");
  assert.equal(page.data.players.length,25);
  assert.equal(page.cache,"private, no-store");
  assert.deepEqual(Object.keys(page.data.players[0]).sort(),["email","id"]);
  const next = await f.control(f.owner.cookie,"directory",{after:page.data.next});
  assert.equal(next.data.next,null);
  assert.equal(new Set([...page.data.players,...next.data.players].map(p => p.id)).size,31);
  assert.equal((await f.control(f.owner.cookie,"directory",{query:"LIST_0"})).data.players.length,10);
  assert.equal((await f.control(f.owner.cookie,"directory",{query:"%"})).data.players.length,0);
  assert.deepEqual((await f.control(f.owner.cookie,"islands",{recipientId:f.recipientId})).data.islands,[]);
  await f.request(f.owner.cookie,"account/me",{password:"test game account"},"DELETE");
  const replacement = await f.register("owner@example.test");
  assert.equal((await f.control(replacement.cookie,"directory")).status,403);
});

test("store gifts deliver through the real catalog, do not bill, and keep permanent unlocks beyond a Pix pass", async t => {
  const f = await fixture(); t.after(() => f.sqlite.close());
  assert.equal((await f.give("product","unknown")).status,400);
  const id=randomUUID();
  const both=await Promise.all([f.give("product","era_rome",id),f.give("product","era_rome",id)]);
  assert.ok(both.every(r=>r.status===200));
  assert.equal((await f.give("product","era_greece",id)).status,409);
  assert.equal((await f.give("product","era_rome")).data.alreadyGiven,true);
  assert.equal((await f.access()).data.plan,null);
  assert.deepEqual((await f.access()).data.owned,["era_rome"]);
  assert.equal((await f.request(f.player.cookie,"commerce/checkout",{productId:"era_rome"})).data.code,"owned");
  for (const sku of STORE_PRODUCTS.filter(p=>p.kind==="subscription")) {
    const grant = await f.give("product",sku.id);
    assert.equal(grant.status,200);
    assert.ok(Math.abs(grant.data.expiresAt-Date.now()-30*DAY)<5000);
    const access=(await f.access()).data;
    assert.equal(access.plan,sku.id);
    assert.equal(access.usage.limit,sku.messages);
    assert.equal(access.giftEndsAt,grant.data.expiresAt);
    assert.ok(!access.complimentary);
    assert.ok(canUseProduct(access,"mode_survival"));
    assert.equal(canUseProduct(access,"mode_god"),sku.includes.includes("mode_god"));
    assert.equal((await f.request(f.player.cookie,"commerce/checkout",{productId:sku.id})).data.code,"owned");
  }
  for (const table of ["game_purchases","game_stripe_customers","game_pix_funded_terms"]) {
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM "+table).get()!.n,0);
  }
  const after = await activeGrants(f.db,f.recipientId, Date.now()+31*DAY);
  assert.equal(after.plan,undefined); assert.deepEqual(after.owned,["era_rome"]);
  assert.deepEqual((await f.control(f.owner.cookie,"player",{recipientId:f.recipientId})).data.rewards.map((r:any)=>r.itemId).sort(),
    ["era_rome","pix_builder","pix_complete","pix_starter","pix_studio"]);
});

test("gifted Pix uses the surplus gateway balance and honors the selected tier and actual paid receipts", async t => {
  const f=await fixture(); t.after(()=>f.sqlite.close());
  await f.give("product","pix_builder");
  const now=Date.now();
  f.sqlite.prepare(`INSERT INTO game_purchases VALUES('apple','confirmed',?,'pix_starter',1,?,?,?,?,'test')`)
    .run(f.recipientId,now-1000, now+DAY,now,now+DAY);
  const { plan,paidPlan }=await activeGrants(f.db,f.recipientId);
  assert.equal(plan.product_id,"pix_builder"); assert.equal(paidPlan.product_id,"pix_starter");
  const paidBudget=productById("pix_starter")!.budgetMicros!;
  const gateway={checkedAt:now,availableMicros:paidBudget+100};
  await reserveGeneration(f.db,f.recipientId,"gift-first",plan,"openai",75,now,GATEWAY_MODELS.openai,gateway);
  await assert.rejects(reserveGeneration(f.db,f.recipientId,"gift-second",plan,"openai",75,now,GATEWAY_MODELS.openai,gateway),{code:"provider_unavailable"});
  await reserveGeneration(f.db,f.recipientId,"paid-first",paidPlan,"openai",75,now,GATEWAY_MODELS.openai,gateway);
  const rows=f.sqlite.prepare("SELECT discretionary FROM game_pix_usage ORDER BY request_key").all();
  assert.deepEqual(rows.map(r=>r.discretionary),[1,0]);
});

test("saved custom designs arrive as private, independent blueprints without modifying either player's designs or islands", async t => {
  const f=await fixture(); t.after(()=>f.sqlite.close());
  const key="pixel_civ_pix_custom_elements_v1", spec={id:"custom_tower_xy",name:"Tide Clock",boxes:[{x0:0,y0:0,z0:0,x1:2,y1:12,z1:2,color:"stone"}]};
  const library = "pcgz1:"+gzipSync(JSON.stringify([spec])).toString("base64");
  await f.request(f.owner.cookie,"account/saves/"+key,{baseVersion:0,data:library},"PUT");
  await f.request(f.player.cookie,"account/saves/"+key,{baseVersion:0,data:"[]"},"PUT");
  assert.deepEqual((await f.control(f.owner.cookie,"designs")).data.designs,[{id:spec.id,name:spec.name}]);
  assert.equal((await f.give("design","custom_missing")).status,409);
  assert.equal((await f.give("design",spec.id)).status,200);
  assert.equal((await f.give("design",spec.id)).data.alreadyGiven,true);
  const saves=(await f.request(f.player.cookie,"account/saves")).data.saves;
  const gift=saves.find((s:any)=>isGiftDesignKey(s.key));
  assert.equal(saves.length,2); assert.equal(gift.version,1);
  const copy=(await f.request(f.player.cookie,"account/saves/"+gift.key)).data;
  const blueprint=JSON.parse(copy.data);
  assert.equal(blueprint.name,spec.name); assert.deepEqual(blueprint.boxes,spec.boxes);
  assert.match(blueprint.id,/^custom_gift_[0-9a-f]{32}$/);
  assert.equal((await f.request(f.treasurer.cookie,"account/saves/"+gift.key)).status,404);
  assert.equal((await f.request(f.player.cookie,"account/saves/"+gift.key,{baseVersion:1,data:"null"},"PUT")).status,405);
  await f.request(f.owner.cookie,"account/saves/"+key,{baseVersion:1,data:"[]"},"PUT");
  assert.deepEqual((await f.request(f.player.cookie,"account/saves/"+gift.key)).data,copy);
  assert.equal((await f.request(f.player.cookie,"account/saves/"+key)).data.data,"[]");
});
