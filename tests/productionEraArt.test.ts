import {strict as assert} from "node:assert";
import test from "node:test";
import "../src/game/designs/index";
import {ELEMENT_BY_ID,getMaxElementLevel,getStandardFootprintForLevel} from "../src/game/catalog";
import {loadEraArt, isEraArtReady} from "../src/game/eraArtLoader";
import {PRODUCTION_ERAS,PRODUCTION_ART_IDS,productionArtFamily} from "../src/game/designs/periodArtCatalog";
import {buildDesignVoxels,buildCorridorVoxels,getOrBuildElementAsset} from "../src/game/voxelArchitect";
import {networkRoadProfile} from "../src/game/designs/networks";
import {guideCarriageway} from "../src/game/designs/carriageways";
import {packVoxKey} from "../src/game/voxelCore";
import type {EraKey} from "../src/game/eraStyles";

function model(id:string,era:EraKey,conn:number,active=false){
  const def=ELEMENT_BY_ID[id],level=Math.min(3,getMaxElementLevel(id));
  return buildDesignVoxels(def,level,1,...getStandardFootprintForLevel(def,level),conn,{era,eraActivity:active?"active":"idle"});
}
test("all production periods resolve the entire base catalog and keep separate meshes",async()=>{
  assert.equal(PRODUCTION_ART_IDS.length,302);
  assert.equal(PRODUCTION_ERAS.length,10);
  assert.ok(PRODUCTION_ART_IDS.every(id=>Boolean(productionArtFamily(id))));
  assert.equal(productionArtFamily("my-original-custom-studio"),undefined);
  const original=getOrBuildElementAsset("house",1,0,1,1);
  const meshes=new Set([original]);
  for(const era of PRODUCTION_ERAS){
    await Promise.all([loadEraArt(era),loadEraArt(era)]);
    assert.ok(isEraArtReady(era));
    meshes.add(getOrBuildElementAsset("house",1,0,1,1,0,{era}));
  }
  assert.equal(meshes.size,11);
  assert.equal(getOrBuildElementAsset("house",1,0,1,1,0,{era:"original"}),original);
});
test("every period preserves traveled bridge cells and all lane elevations on the divided carriageway",async()=>{
  for(const era of PRODUCTION_ERAS){
    await loadEraArt(era);
    for(const id of ["bridges","stone_bridges","suspension_bridges","over_passes","underpasses"]){
      for(const mask of [3,5,10,15,5|256,15|256|1024,5|4096]){
        const p=networkRoadProfile(id,mask);
        if(!p)continue;
        const original=model(id,"original",mask).v.v,themed=model(id,era,mask).v.v;
        for(let x=-8;x<8;x++)for(let z=-8;z<8;z++){
          const cell=packVoxKey(x,p.heights[(x+8)*16+z+8],z);
          assert.equal(themed.has(cell),original.has(cell),[era,id,mask,x,z].join("/"));
        }
      }
    }
    const art=guideCarriageway("freeways",1);
    const original=buildCorridorVoxels("freeways",6,2,10,{corridor:art})!.v;
    const themed=buildCorridorVoxels("freeways",6,2,10,{corridor:art,era})!.v;
    assert.equal(original.size,themed.size);
    assert.ok([...original.keys()].every(k=>themed.has(k)));
    assert.ok([...original].some(([k,s])=>themed.get(k)!==s),era+" freeway pavement");
  }
});
test("Roman aqueducts and production waterworks display their measured service state",async()=>{
  for(const era of PRODUCTION_ERAS){
    await loadEraArt(era);
    for(const id of ["water_treatment_plant","aqueduct"]){
      const dry=model(id,era,10).v.v,wet=model(id,era,10,true).v.v;
      assert.ok(dry.size!==wet.size || [...dry].some(([k,v])=>wet.get(k)!==v),era+"/"+id);
    }
    const stop=model("train_stops",era,0);
    assert.ok(stop.v.size<10000,era+" commuter halt stays compact");
  }
});
