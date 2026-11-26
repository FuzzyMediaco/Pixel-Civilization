import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { openAccountDatabase } from "../src/server/localAccounts.mjs";
import { accountRequest } from "../worker/accounts.mjs";
import { createInitialGameState } from "../src/game/simulation";
import { creditIslandGift, giftIslandId } from "../src/game/islandGifts.mjs";

const real = "pixel_civ_save_v1_real", slot = "pixel_civ_slot_0";
const pack = (value: unknown) => "pcgz1:" + gzipSync(JSON.stringify(value)).toString("base64");
const unpack = (value: string) => JSON.parse(value.startsWith("pcgz1:") ? gunzipSync(Buffer.from(value.slice(6),"base64")).toString() : value);

async function fixture() {
  const { db, sqlite } = openAccountDatabase(":memory:");
  const call = async (who: string, url: string, data?: unknown, method = data === undefined ? "GET" : "POST") => {
    const request = new Request("https://pixelcivilization.app/api/account/" + url, {
      method, headers: { Cookie: who, "Content-Type": "application/json" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const response = await accountRequest(request, {GAME_ACCOUNTS: db});
    return { status: response.status, data: await response.json() as any, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
  };
  const owner = await call("", "register", {email:"giver@example.test",password:"treasury tests"});
  const player = await call("", "register", {email:"player@example.test",password:"island tests"});
  sqlite.prepare("INSERT INTO island_gift_issuers(user_id) VALUES(?)").run(owner.data.user.id);
  const state = createInitialGameState("real");
  delete state.islandId;
  state.money = 37.5;
  const sendSave = (key: string, version: number, data: string) =>
    call(player.cookie, "saves/" + key, { baseVersion: version, data }, "PUT");
  await sendSave(real,0,pack(state));
  await sendSave(slot,0,JSON.stringify({name:"Harbor",state:{...state,islandId:"old-harbor"},money:37}));
  await sendSave("pixel_civ_last_mode",0,"real");
  const intent = { requestId:randomUUID(),recipientId:player.data.user.id,saveKey:real,islandId:"legacy",amount:500 };
  return { sqlite, call, owner, player, intent, state, sendSave };
}

test("only the designated account can find a recipient's individual islands and issue funds", async () => {
  const f = await fixture();
  try {
    const find = "island-gifts/islands", send = "island-gifts/send";
    const email = { email:"PLAYER@example.test" };
    assert.equal((await f.call("",find,email)).status,401);
    assert.deepEqual((await f.call(f.player.cookie,"island-gifts/access")).data,{canGive:false});
    assert.equal((await f.call(f.player.cookie,find,email)).status,403);
    assert.equal((await f.call(f.player.cookie,send,f.intent)).status,403);
    assert.deepEqual((await f.call(f.owner.cookie,"island-gifts/access")).data,{canGive:true});
    const { islands } = (await f.call(f.owner.cookie,find,email)).data;
    assert.deepEqual(islands.map((x: {name: string; active: boolean}) => [x.name,x.active]),[["Real mode island",true],["Harbor",false]]);
    assert.ok(islands.every((x: object) => !("state" in x)));
    assert.equal((await f.call(f.owner.cookie,find,{email:"absent@example.test"})).status,404);
    for (const patch of [{amount:0},{amount:-1},{amount:1.5},{amount:"500"},{saveKey:"pixel_civ_last_mode"},{islandId:"different"}])
      assert.ok((await f.call(f.owner.cookie,send,{...f.intent,...patch})).status>=400);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM island_gifts").get()!.n,0);
  } finally { f.sqlite.close(); }
});

test("a gift credits the live island once across retries, ongoing play, spending and cloud reads", async () => {
  const f = await fixture();
  try {
    const send = () => f.call(f.owner.cookie,"island-gifts/send",f.intent);
    const results = await Promise.all([send(),send()]);
    assert.ok(results.every(result => result.status === 200));
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM island_gifts").get()!.n,1);
    assert.equal((await f.call(f.owner.cookie,"island-gifts/send",{...f.intent,amount:600})).status,409);
    const read = async (key: string) => unpack((await f.call(f.player.cookie,"saves/"+key)).data.data);
    assert.equal((await read(real)).money,537.5);
    assert.equal((await read(slot)).state.money,37.5);
    // An open older copy spent money before it received the gift. Its normal save still succeeds.
    f.state.money = 20;
    assert.equal((await f.sendSave(real,1,pack(f.state))).status,200);
    const after = await read(real);
    assert.equal(after.money,520);
    assert.equal((await read(real+"?stored=1")).money,20);
    assert.equal((await read(real+"?previous=1")).money,37.5);
    const {islandGifts} = (await f.call(f.player.cookie,"saves")).data;
    assert.equal(creditIslandGift(f.state,f.intent.recipientId,real,islandGifts[0]),500);
    assert.equal(creditIslandGift(f.state,f.intent.recipientId,real,islandGifts[0]),0);
    assert.equal(f.state.money,after.money);
    after.money -= 100;
    assert.equal((await f.sendSave(real,2,pack(after))).status,200);
    assert.equal((await read(real)).money,420);
    assert.equal((await read(real)).economy.ledger.filter((x:{label:string})=>x.label==="Island gift").length,1);
    const second = {...f.intent,requestId:randomUUID(),amount:75};
    assert.equal((await f.call(f.owner.cookie,"island-gifts/send",second)).status,200);
    assert.equal((await read(real)).money,495);
    assert.equal((await read(slot)).money,37);
  } finally { f.sqlite.close(); }
});

test("a named island receives its own funds and a replacement never inherits the old grant", async () => {
  const f = await fixture();
  try {
    const intent = { ...f.intent, saveKey:slot, islandId:"old-harbor" };
    await f.sendSave("pixel_civ_last_mode",1,"slot-0");
    const found = (await f.call(f.owner.cookie,"island-gifts/islands",{email:"player@example.test"})).data.islands;
    assert.deepEqual([found[0].name,found[0].active],["Harbor",true]);
    assert.equal((await f.call(f.owner.cookie,"island-gifts/send",intent)).status,200);
    const edited = unpack((await f.call(f.player.cookie,"saves/"+slot)).data.data);
    assert.equal(edited.state.money,537.5);
    assert.equal(edited.money,537);
    assert.equal(unpack((await f.call(f.player.cookie,"saves/"+real)).data.data).money,37.5);
    const replacement = createInitialGameState("survival");
    assert.notEqual(giftIslandId(replacement),"old-harbor");
    await f.sendSave(slot,1,JSON.stringify({name:"New Harbor",state:replacement,money:replacement.money}));
    assert.equal(unpack((await f.call(f.player.cookie,"saves/"+slot)).data.data).state.money,replacement.money);
    assert.equal((await f.call(f.owner.cookie,"island-gifts/send",{...intent,requestId:randomUUID()})).status,409);
    await f.sendSave(real,1,"null");
    const vanished = await f.call(f.owner.cookie,"island-gifts/send",f.intent);
    assert.equal(vanished.status,409);
  } finally { f.sqlite.close(); }
});
