import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { CHRISTMAS_ELEMENTS } from "../src/game/christmasCatalog";
import { canDecorateForChristmas, toggleChristmasDecorations } from "../src/game/christmasDecorations";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import { santaSkin } from "../src/game/designs/christmasKit";
import { loadEraArt } from "../src/game/eraArtLoader";
import { eraElementName } from "../src/game/eraStyles";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import { createInitialGameState, type PlacedElement } from "../src/game/simulation";
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
