import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { createExampleWorld } from "../src/game/exampleWorlds";
import type { PlacedElement } from "../src/game/simulation";
import { BuildingCollisionIndex } from "../src/game/buildingCollision";
import { RenderLayout } from "../src/game/renderLayout";
import { TILE_SIZE } from "../src/game/voxelCore";

function slowCollision(elements:PlacedElement[],x:number,z:number,margin:number){
  for(let pass=0;pass<2;pass++)for(const site of elements){
    const def=ELEMENT_BY_ID[site.defId];
    if(!def||def.isNetwork||def.passiveNature||def.domain!=="land")continue;
    const left=site.gx*TILE_SIZE-margin,right=(site.gx+site.spanX)*TILE_SIZE+margin;
    const top=site.gz*TILE_SIZE-margin,bottom=(site.gz+site.spanZ)*TILE_SIZE+margin;
    if(x>left&&x<right&&z>top&&z<bottom){
      const d=Math.min(x-left,right-x,z-top,bottom-z);
      if(d===x-left)x=left;else if(d===right-x)x=right;else if(d===z-top)z=top;else z=bottom;
    }
  }
  return [x,z];
}
test("indexed walking and rescue collisions preserve two-pass ordering at corners, coast, long and overlapping lots",()=>{
  const city=createExampleWorld("rome-district","god"), house=city.elements.find(e=>e.defId==="house")??city.elements[0];
  const sites=[...city.elements,...Array.from({length:7},(_,i)=>({...house,id:"stack"+i,defId:"house",gx:i-4,gz:i%2-2,spanX:i%3+1,spanZ:2}))];
  for(const elements of [sites,[...sites].reverse()]){
    const grid=new BuildingCollisionIndex(elements);
    for(const margin of [0,.27,.36,.45,1.1]){
      for(let x=-24;x<24;x+=.9)for(let z=-12;z<18;z+=1.35){
        assert.deepEqual(grid.resolve(x,z,margin),slowCollision(elements,x,z,margin));
      }
      for(const {gx,gz} of elements.slice(0,12)){
        for(const [dx,dz] of [[0,0],[.5,.5],[-margin,.25],[0,.8],[margin,-margin]]){
          const x=gx*TILE_SIZE+dx,z=gz*TILE_SIZE+dz;
          assert.deepEqual(grid.resolve(x,z,margin),slowCollision(elements,x,z,margin));
        }
      }
    }
  }
});
test("render layout reuses ordinary ticks and refreshes parcel joins, corridors, dimensions, overlaps and terrain edits",()=>{
  const state=createExampleWorld("rome-starter","god"),cache=new RenderLayout(),height=()=>0;
  state.infrastructure??={revision:0,cells:{},spans:{},conduits:{},streets:{},storage:{},undo:[]};
  assert.equal(cache.update(state,height),true);
  const home=state.elements.find(e=>e.defId==="house")!, parcela=cache.parcels.get(home.id), collision=cache.blockers;
  state.timeOfDay=22;home.animProgress=.8;home.connected=!home.connected;
  assert.equal(cache.update(state,height),false);
  state.elements=state.elements.map(e=>({...e}));assert.equal(cache.update(state,height),false);
  assert.equal(cache.blockers,collision);assert.equal(cache.parcels.get(home.id),parcela);
  const el=state.elements.find(e=>e.id===home.id)!;
  for(const change of [()=>{el.rotation=(el.rotation+1)%4;},()=>{el.edgeOverrides={front:"closed"};},
    ()=>{el.edgeOverrides!.front="open";},()=>{el.autoDrive={side:"left",slot:1};},()=>{el.autoDrive!.slot=0;},()=>{el.spanX++;},
    ()=>{el.level++;},()=>{el.gx--;},()=>{el.sculptsTerrain=true;},()=>{el.roadAxis="x";},()=>{el.variant=(el.variant+1)%4;},
    ()=>{state.elements.reverse();},()=>{state.terrainVersion=(state.terrainVersion??1)+1;},()=>{state.infrastructure!.revision++;}]){
    change();assert.equal(cache.update(state,height),true);
    const fresh=new RenderLayout();fresh.update(state,height);
    assert.deepEqual([...cache.parcels.entries()],[...fresh.parcels.entries()]);
    assert.equal(cache.update(state,height),false);
  }
  state.elements=state.elements.filter(e=>e!==el);
  assert.equal(cache.update(state,height),true);assert.equal(cache.parcels.has(el.id),false);
});
