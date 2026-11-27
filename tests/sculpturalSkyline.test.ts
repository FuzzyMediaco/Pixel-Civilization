import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { PRODUCTION_ERAS } from "../src/game/designs/periodArtCatalog";
import type { EraKey } from "../src/game/eraStyles";
import { loadEraArt } from "../src/game/eraArtLoader";
import { SKYLINE_DESIGNS } from "../src/game/skylineCatalog";
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
