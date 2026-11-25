import { strict as assert } from "node:assert";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel } from "../src/game/catalog";
import { buildDesignVoxels, getOrBuildElementAsset } from "../src/game/voxelArchitect";
import { loadEraArt } from "../src/game/eraArtLoader";
import { ERA_LABELS, eraElementName, eraElementSpec, normalizeEra, ROME_PILOT_IDS, type EraKey } from "../src/game/eraStyles";
import { networkRoadProfile } from "../src/game/designs/networks";
import { packVoxKey } from "../src/game/voxelCore";

function vox(id:string,level:number,variant:number,era:EraKey,mask=0,active=false) {
  const def=ELEMENT_BY_ID[id];
  return buildDesignVoxels(def,level,variant,...getStandardFootprintForLevel(def,level),mask,{
    era,eraActivity:active?"active":"idle",
  });
}

test("every authored pilot identity has four variant descriptions and all canonical level names", () => {
  assert.equal(normalizeEra("removed-world-pack"),"original");
  assert.equal(eraElementName("house","removed-world-pack"),ELEMENT_BY_ID.house.name);
  for (const id of ROME_PILOT_IDS) {
    assert.ok(ELEMENT_BY_ID[id],id);
    for(const era of Object.keys(ERA_LABELS).filter(k=>k!=="original")){
      const spec=eraElementSpec(id,era)!;
      assert.ok(spec.levels.length >= getMaxElementLevel(id),id);
      assert.equal(new Set(spec.variants).size,4,id);
    }
  }
  assert.equal(eraElementSpec("custom-private-studio-design","rome-forum"),undefined);
});

test("loading Roman art leaves Original cached and keeps the two architecture and activity keys separate",async()=>{
  const original=getOrBuildElementAsset("house",1,0,1,1);
  await Promise.all([loadEraArt("rome-forum"),loadEraArt("rome-aqueduct")]);
  const forum=getOrBuildElementAsset("house",1,0,1,1,0,{era:"rome-forum"});
  const aqueduct=getOrBuildElementAsset("house",1,0,1,1,0,{era:"rome-aqueduct"});
  assert.notEqual(forum,aqueduct);
  assert.notEqual(forum,original);
  assert.equal(getOrBuildElementAsset("house",1,0,1,1,0,{era:"original"}),original);
  const id="water_treatment_plant", def=ELEMENT_BY_ID[id], span=getStandardFootprintForLevel(def,2);
  const idle=getOrBuildElementAsset(id,2,0,...span,0,{era:"rome-forum",eraActivity:"idle"});
  const active=getOrBuildElementAsset(id,2,0,...span,0,{era:"rome-forum",eraActivity:"active"});
  assert.notEqual(idle,active);
  assert.notDeepEqual(idle.baseGeo.getAttribute("color").array,active.baseGeo.getAttribute("color").array);
  assert.equal(vox("aqueduct",4,0,"rome-aqueduct").rotors[0].speed,0);
  assert.ok(vox("aqueduct",4,0,"rome-aqueduct",0,true).rotors[0].speed!==0);
});

test("Roman bridge art retains every traveled deck cell through corners, ramps, and crossings",async()=>{
  await loadEraArt("rome-forum");
  for(const id of ["bridges","stone_bridges"])for(const mask of [0,1,3,5,7,10,15,5|256,15|256|1024,5|4096]){
    const level=4,profile=networkRoadProfile(id,mask)!;
    const original=vox(id,level,1,"original",mask).v.v;
    for(const era of ["rome-forum","rome-aqueduct"] as const) {
      const themed=vox(id,level,1,era,mask).v.v;
      for(let x=-8;x<8;x++)for(let z=-8;z<8;z++){
        const h=profile.heights[(x+8)*16+z+8],key=packVoxKey(x,h,z);
        assert.equal(themed.has(key),original.has(key),[id,era,mask,x,z].join("/"));
      }
    }
  }
});
