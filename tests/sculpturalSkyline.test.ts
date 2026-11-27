import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { PRODUCTION_ERAS } from "../src/game/designs/periodArtCatalog";
import type { EraKey } from "../src/game/eraStyles";
import { loadEraArt } from "../src/game/eraArtLoader";
import { CIVIC_ADMINISTRATION_ELEMENTS, SKYLINE_DESIGNS } from "../src/game/skylineCatalog";
import { buildDesignVoxels } from "../src/game/voxelArchitect";

function model(id: string, level: number, variant: number, era: EraKey = "original") {
  const def=ELEMENT_BY_ID[id];
  return buildDesignVoxels(def,level,variant,...getStandardFootprintForLevel(def,level),0,{era}).v.v;
}
function height(mesh: Map<number,number>) {
  let top=0;
  for(const key of mesh.keys()) top=Math.max(top,((key>>>10)&1023)-511);
  return top;
}

test("new civic campuses have their commissioned levels, footprints and service values", () => {
  const expected = {
    climbing_city_hall: [8,640,185,[[2,2],[2,2],[3,2],[3,3],[4,3]]],
    civic_viaduct_exchange: [12,1070,310,[[2,2],[3,2],[3,3],[4,3],[4,4]]],
    levitating_civic_tower: [18,3200,625,[[2,2],[2,2],[3,3],[3,3],[4,4]]],
  };
  assert.deepEqual(CIVIC_ADMINISTRATION_ELEMENTS.map(def => def.id).sort(), Object.keys(expected).sort());
  for (const def of CIVIC_ADMINISTRATION_ELEMENTS) {
    const spans = def.levelNames.map((_,i) => getStandardFootprintForLevel(def,i+1));
    assert.deepEqual([def.stage,def.cost,def.government,spans],expected[def.id as keyof typeof expected]);
    assert.equal(new Set(def.levelNames).size, 5);
    assert.equal(new Set(def.styleNames).size, 4);
    assert.ok(def.searchAliases?.length, def.id);
  }
});

test("each sculptural design has twenty distinct occupied shapes regardless of color",()=>{
  for(const def of SKYLINE_DESIGNS){
    const shapes=new Set<string>();
    for(let level=1;level<=5;level++)for(let variant=0;variant<4;variant++){
      const mesh=model(def.id,level,variant);
      const keys=Int32Array.from(mesh.keys()).sort();
      assert.ok(keys.length>160,def.id);
      shapes.add(createHash("sha256").update(keys).digest("hex"));
    }
    assert.equal(shapes.size,20,def.id);
  }
});

test("all supertall variants start above the previous skyline and grow at every level",async()=>{
  const oldRecord=Math.max(...[0,1,2,3].map(v=>height(model("skyscrapers",5,v))));
  for(let variant=0;variant<4;variant++){
    let last=oldRecord;
    for(let level=1;level<=5;level++){
      const h=height(model("mega_skyscraper",level,variant));
      assert.ok(h>last,"style "+variant+", level "+level);
      last=h;
    }
  }
  const base=model("mega_skyscraper",1,2);
  for(const era of PRODUCTION_ERAS){
    await loadEraArt(era);
    const themed=model("mega_skyscraper",1,2,era);
    assert.equal(height(themed),height(base),era);
    assert.ok([...base].some(([key,style])=>themed.has(key)&&themed.get(key)!==style),era);
  }
});

test("the levitating offices reach the city skyline with a clear gap at every level", () => {
  const skyline = Math.max(...[0, 1, 2, 3].map(variant => height(model("skyscrapers", 5, variant))));
  for (let variant = 0; variant < 4; variant++) {
    for (let level = 1; level <= 5; level++) {
      const mesh = model("levitating_civic_tower", level, variant);
      const occupied = new Set(Array.from(mesh.keys(), key => ((key >>> 10) & 1023) - 512));
      const top = height(mesh);
      let consecutive = 0;
      let gap = 0;
      for (let layer = 1; layer < top; layer++) {
        consecutive = occupied.has(layer) ? 0 : consecutive + 1;
        gap = Math.max(gap, consecutive);
      }
      assert.ok(gap >= 10, `level ${level} variant ${variant}: gap of ${gap}`);
      if (level === 5) assert.ok(top >= skyline, `flagship ${variant} reaches the skyline`);
    }
  }
});
