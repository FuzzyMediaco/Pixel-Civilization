import assert from "node:assert/strict";
import test from "node:test";
import { applySharedCommand, sharedWorld } from "../src/game/sharedIsland";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { planConstruction } from "../src/game/simulation";

test("two players cannot occupy the same parcel and rejected edits leave the accepted city intact", () => {
  const original=sharedWorld("god");
  const point=[...Array(15)].map((_,i)=>({gx:i,gz:0})).find(p=>planConstruction(original,ELEMENT_BY_ID.house,p.gx,p.gz,1,0).valid)!;
  assert.ok(point);
  const command={kind:"place" as const,defId:"house",level:1,rotation:0,points:[point]};
  const created=applySharedCommand(original,command,()=>"house-one");
  assert.equal(created.state.elements.length,original.elements.length+1);
  assert.throws(()=>applySharedCommand(created.state,command,()=>"house-two"));
  assert.equal(created.state.elements.at(-1)?.id,"house-one");
  assert.ok(created.undoable);
  const sculpted=applySharedCommand(created.state,{kind:"sculpt",tool:"raise",points:[{gx:4,gz:4}],radius:0});
  assert.equal(sculpted.undoable,false);
  assert.equal(applySharedCommand(created.state,{kind:"undo"}).state.elements.length,original.elements.length);
});

test("an invalid second road tile cannot commit the first tile", () => {
  const island=sharedWorld("god");
  const initial=island.elements.length;
  assert.throws(()=>applySharedCommand(island,{kind:"place",defId:"roads",level:1,rotation:0,points:[{gx:0,gz:0},{gx:45,gz:45}]}));
  assert.equal(island.elements.length,initial);
});

test("copying preserves the original world and the shared mode", () => {
  const original=sharedWorld("survival");
  const copied=sharedWorld("survival",structuredClone(original));
  assert.equal(copied.mode,"survival");
  assert.equal(copied.money,original.money);
  assert.throws(()=>sharedWorld("real",original),/unsupported game data/);
  const paused=applySharedCommand(copied,{kind:"speed",value:0}).state;
  assert.equal(paused.playSpeed,0);
  assert.notEqual(original,paused);
});
