import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getElementUnlockStage, getStandardFootprintForLevel, getUpgradeCost } from "../src/game/catalog";
import { CHRISTMAS_ELEMENTS, CHRISTMAS_GROUPS } from "../src/game/christmasCatalog";
import { canDecorateForChristmas, toggleChristmasDecorations } from "../src/game/christmasDecorations";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import { santaSkin } from "../src/game/designs/christmasKit";
import { loadEraArt } from "../src/game/eraArtLoader";
import { eraElementName } from "../src/game/eraStyles";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import { getDecisionTreeLeafElements } from "../src/game/quickBuildTree";
import { buildingLockReason, createInitialGameState, planConstruction, upgradeElementDirect, type PlacedElement } from "../src/game/simulation";
import { PixelVox, packVoxKey } from "../src/game/voxelCore";
import { buildDesignVoxels, getOrBuildElementAsset } from "../src/game/voxelArchitect";
import { readWorldFile, serializeWorld } from "../src/game/worldTransfer";

test("all 400 Christmas configurations change physical geometry and stay in their footprints", () => {
  const skin = new PixelVox().put(0,0,0,santaSkin).v.get(packVoxKey(0,0,0));
  assert.equal(CHRISTMAS_ELEMENTS.length,20);
  for (const def of CHRISTMAS_ELEMENTS) {
    const shapes=new Set<string>();
    for(let lv=1;lv<=5;lv++) for(let variant=0;variant<4;variant++) {
      const c=buildDesignVoxels(def,lv,variant,...getStandardFootprintForLevel(def,lv),0);
      const mesh=new Map(c.v.v);
      for(const rotor of c.rotors) for(const [key,style] of rotor.vox.v) {
        const x=((key>>>20)&1023)-512+rotor.pivot[0], z=(key&1023)-512+rotor.pivot[2];
        assert.ok(Math.abs(x)<=c.hx && Math.abs(z)<=c.hz);
        mesh.set(packVoxKey(x,((key>>>10)&1023)-512+rotor.pivot[1],z),style);
      }
      if(def.id==="santas_sleigh" || def.id==="black_santa_grotto") {
        const visibleCheeks=[...mesh].filter(([key,s])=>s===skin && !mesh.has(key+1));
        assert.ok(visibleCheeks.length>=4,def.id+" has visible skin");
      }
      const keys=Int32Array.from([...mesh.keys()].sort((a,b)=>a-b));
      const digest=createHash("sha256").update(keys).digest("hex");
      assert.ok(!shapes.has(digest),def.id+" repeated geometry at L"+lv+" V"+variant);
      shapes.add(digest);
    }
    assert.equal(shapes.size,20);
  }
});

test("decorations persist per building through save, transfer and undo", () => {
  const before=createInitialGameState("god");
  const home:PlacedElement={id:"home",defId:"house",gx:0,gz:0,spanX:1,spanZ:1,rotation:0,level:1,variant:2,
    connected:true,hasPoliceCover:false,hasFireCover:false,nuisancePenalty:0,maintTimerSec:0,disrepair:false,onFire:false,animProgress:0,animKind:"place"};
  before.elements=[home,{...home,id:"second",gx:4}];
  const after=cloneGameStateSnapshot(before);
  assert.ok(canDecorateForChristmas(ELEMENT_BY_ID.malls));
  assert.ok(!toggleChristmasDecorations(after.elements[0],ELEMENT_BY_ID.roads));
  assert.ok(toggleChristmasDecorations(after.elements[0],ELEMENT_BY_ID.house));
  rememberBuildingEdit(before,after,"Decorate for Christmas");
  const saved=readWorldFile(serializeWorld("Christmas test",cloneGameStateSnapshot(after)))[0].state;
  assert.ok(saved.elements[0].christmasDecorated);
  assert.equal(saved.elements[1].christmasDecorated,undefined);
  assert.ok(undoBuildingEdit(after).ok);
  assert.equal(after.elements[0].christmasDecorated,undefined);
  toggleChristmasDecorations(saved.elements[0],ELEMENT_BY_ID.house);
  assert.equal(saved.elements[0].christmasDecorated,undefined);
});

test("house and mall trim use separate meshes and Christmas art retains its silhouette across eras", async () => {
  for(const id of ["house","malls"]) {
    const [w,h]=getStandardFootprintForLevel(ELEMENT_BY_ID[id],2);
    const original=getOrBuildElementAsset(id,2,0,w,h);
    const decorated=getOrBuildElementAsset(id,2,0,w,h,0,{christmasDecorated:true});
    assert.notEqual(original,decorated);
    assert.ok(decorated.voxelCount!>original.voxelCount!);
    assert.equal(getOrBuildElementAsset(id,2,0,w,h),original);
  }
  await loadEraArt("art-deco");
  for(const def of CHRISTMAS_ELEMENTS) {
    const [w,h]=def.footprints[0];
    assert.equal(eraElementName(def.id,"art-deco"),def.name);
    assert.deepEqual(buildDesignVoxels(def,1,1,w,h,0,{era:"art-deco"}).v.v,buildDesignVoxels(def,1,1,w,h,0).v.v);
  }
});

test("Real islands can build the whole Christmas Village at every city stage", () => {
  const state = createInitialGameState("real");
  for (let stage = 1; stage <= 20; stage++) {
    state.currentStage = state.highestStageReached = stage;
    for (const def of CHRISTMAS_ELEMENTS) {
      assert.equal(buildingLockReason(def, state), undefined, def.id + " at stage " + stage);
      assert.equal(getElementUnlockStage(def, state.mode), 1);
    }
    const leaves = CHRISTMAS_GROUPS.flatMap(group =>
      getDecisionTreeLeafElements(state, "christmas_village", group.id, 0, 0));
    assert.equal(new Set(leaves.map(item => item.def.id)).size, 20);
    assert.ok(leaves.every(item => item.canPlace && item.canAfford && item.lockReason === null));
  }
  const newCity = createInitialGameState("real");
  assert.ok(buildingLockReason(ELEMENT_BY_ID.skyscrapers, newCity));
  for (const mode of ["survival", "manager", "idle"] as const) {
    assert.ok(buildingLockReason(ELEMENT_BY_ID.christmas_carousel, createInitialGameState(mode)));
  }
});

test("every Christmas level can be placed directly for the same price as upgrading", () => {
  const state = createInitialGameState("real");
  state.money = 100_000;
  for (const def of CHRISTMAS_ELEMENTS) {
    let expectedCost = def.cost;
    for (let level = 1; level <= 5; level++) {
      const plan = planConstruction(state, def, 0, 0, level, 0, true);
      assert.ok(plan.valid, def.id + " " + plan.reason);
      assert.equal(plan.level, level);
      assert.deepEqual([plan.spanX, plan.spanZ], getStandardFootprintForLevel(def, level));
      assert.equal(plan.cost, expectedCost);
      expectedCost += getUpgradeCost(def, level);
    }
  }
  const snowman = ELEMENT_BY_ID.christmas_snowman;
  const price = planConstruction(state, snowman, 0, 0, 5, 0).cost;
  state.money = price - 1;
  assert.match(planConstruction(state, snowman, 0, 0, 5, 0).reason!, /Need \$/);
  assert.equal(planConstruction(state, snowman, 2000, 2000, 5, 0).valid, false);
  const ordinary = planConstruction(state, ELEMENT_BY_ID.house, 0, 0, 5, 0);
  assert.equal(ordinary.level, 1);
  assert.equal(ordinary.cost, ELEMENT_BY_ID.house.cost);
  const god = planConstruction(createInitialGameState("god"), snowman, 0, 0, 5, 0);
  assert.equal(god.level, 5);
  assert.equal(god.cost, 0);
});

test("returning Real islands can upgrade a Christmas site from level one through five immediately", () => {
  const before = createInitialGameState("real");
  const def = ELEMENT_BY_ID.christmas_snowman;
  before.elements.push({
    id: "saved-snowman", defId: def.id, gx: 0, gz: 0, spanX: 1, spanZ: 1, rotation: 0, level: 1, variant: 2,
    connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0,
    disrepair: false, onFire: false, animProgress: 0, animKind: "place",
  });
  const state = readWorldFile(serializeWorld("Winter island", before))[0].state;
  const site = state.elements[0];
  site.onFire = true;
  assert.match(upgradeElementDirect(state, site.id).reason!, /Restore/);
  site.onFire = false;
  for (let current = 1; current < 5; current++) {
    const funds = state.money;
    assert.ok(upgradeElementDirect(state, site.id).ok);
    assert.equal(state.money, funds - getUpgradeCost(def, current));
    assert.equal(site.level, current + 1);
    assert.deepEqual([site.spanX, site.spanZ], getStandardFootprintForLevel(def, current + 1));
  }
  assert.equal(state.highestStageReached, 1);
  assert.equal(site.variant, 2);
  assert.match(upgradeElementDirect(state, site.id).reason!, /maximum/);
});
