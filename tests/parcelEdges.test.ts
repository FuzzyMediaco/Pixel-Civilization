import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENTS, ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel } from "../src/game/catalog";
import { TravelNetwork } from "../src/game/travelNetwork";
import { getNeighborPreview } from "../src/game/connectionPreview";
import { getParcelEdges, getParcelEffectSummary, cellBeyondEdge, PARCEL_SIDES } from "../src/game/parcelEdges";
import { getParcelSoils,applyParcelAppearance } from "../src/game/parcelGeometry";
import { generationExposure } from "../src/game/parcelExposure";
import { buildOccupancyMap, createInitialGameState, planConstruction, recomputeConnectivityAndMetrics, upgradeElementDirect, type PlacedElement } from "../src/game/simulation";
import { getOrBuildElementAsset, buildDesignAsset } from "../src/game/voxelArchitect";
import { makeCtx } from "../src/game/designs/kit";
import { packVoxKey } from "../src/game/voxelCore";
import { ensureInfrastructure, getTerrainCell } from "../src/game/terrain";
import guide from "../src/game/connectionGuide.json";

function piece(defId:string,gx:number,gz:number,rotation=0,level=1): PlacedElement {
  const [sx,sz]=getStandardFootprintForLevel(ELEMENT_BY_ID[defId],level);
  return {id:defId+"@"+gx+","+gz,defId,gx,gz,rotation,level,spanX:rotation%2?sz:sx,spanZ:rotation%2?sx:sz,variant:0,
    connected:true,hasPoliceCover:false,hasFireCover:false,nuisancePenalty:0,maintTimerSec:0,disrepair:false,onFire:false,animProgress:0,animKind:"place"};
}

test("every guide entry can display actual reciprocal neighboring sites at every supported level",()=>{
  assert.equal(new Set(guide.flatMap(g=>g.ids)).size,149);
  for(const d of ELEMENTS) for(let lv=1;lv<=getMaxElementLevel(d.id);lv++) {
    const pair=getNeighborPreview(d.id,lv);
    assert.ok(pair.length>=2,d.id+" level "+lv);
    assert.ok(pair[0].edges.length>0 && pair[1].edges.length>0,d.id+" has no shared boundary");
    assert.ok(pair[0].edges.some(e=>pair[1].edges.some(n=>n.kind===e.kind)));
  }
});

test("guide examples choose back gardens and an uninterrupted track beside the platform",()=>{
  assert.equal(getNeighborPreview("house",2)[0].edges[0].kind,"garden");
  const scene=getNeighborPreview("train_stops",3),track=scene[1];
  assert.equal(track.el.defId,"train_tracks");
  assert.equal(track.mask & 15,10);
  assert.ok(scene[0].edges.every(e=>e.kind==="platform" && e.side==="back"));
});

test("rotation, partial-width garage, close/open overrides and row orientation respect the local side",()=>{
  for(let r=0;r<4;r++) {
    const house=piece("medium_sized_homes",0,0,r,3);
    const [x,z]=cellBeyondEdge(house,"front",1), correct=piece("roads",x,z);
    const [a,b]=cellBeyondEdge(house,"front",0), other=piece("roads",a,b);
    const [u,w]=cellBeyondEdge(house,"back",0), rear=piece("roads",u,w);
    const occ=buildOccupancyMap([house,correct,other,rear]);
    assert.deepEqual(getParcelEdges(house,occ).map(e=>[e.side,e.kind,e.slot]),[["front","drive",1]]);
    assert.equal(getParcelEdges(other,occ).filter(e=>e.kind==="drive").length,0);
    house.edgeOverrides={front:"closed"};
    assert.equal(getParcelEdges(house,occ).length,0);
    assert.equal(getParcelEdges(correct,occ).filter(e=>e.kind==="drive").length,0);
  }
  const a=piece("townhomes",0,0), b=piece("townhomes",a.spanX,0);
  const occ=buildOccupancyMap([a,b]);
  assert.equal(getParcelEdges(a,occ)[0].kind,"party");
  b.rotation=1;
  assert.ok(!getParcelEdges(a,occ).some(e=>e.kind==="party"));
});

test("a shared farm with five field edges and a backyard kitchen garden contribute to real services",()=>{
  const center=piece("farm_houses",0,0,0,3);
  const fields:PlacedElement[]=[];
  for(const side of PARCEL_SIDES) {
    const count=side==="front"||side==="back"?center.spanX:center.spanZ;
    for(let n=0;n<count && fields.length<5;n++) {
      const [x,z]=cellBeyondEdge(center,side,n); fields.push(piece("fields",x,z));
    }
  }
  assert.equal(fields.length,5);
  const edges=getParcelEdges(center,buildOccupancyMap([center,...fields]));
  assert.equal(edges.filter(e=>e.kind==="farm").length,5);
  assert.equal(getParcelEffectSummary(edges).agriculture,.125);
  const st=createInitialGameState("god"), home=piece("house",0,0), plot=piece("gardens",0,-1);
  st.elements=[home,plot,piece("roads",0,1),piece("roads",1,1),piece("shops",1,0)];
  recomputeConnectivityAndMetrics(st);const withGarden=st.metrics.foodSupply;
  home.edgeOverrides={back:"closed"};recomputeConnectivityAndMetrics(st);
  assert.ok(withGarden>st.metrics.foodSupply);
});

test("new bus stops cap at three and saved level four/five retain the compact shelter in every style",()=>{
  const st=createInitialGameState("god"); const stop=piece("bus_stops",0,0,0,3); st.elements=[stop];
  assert.equal(upgradeElementDirect(st,stop.id).ok,false);
  assert.equal(planConstruction(st,ELEMENT_BY_ID.bus_stops,2,0,5,0).level,3);
  for(let v=0;v<4;v++) {
    const current=getOrBuildElementAsset("bus_stops",3,v,1,1);
    assert.ok(current.baseGeo.boundingBox!.min.z>=.5);
    assert.ok(current.baseGeo.boundingBox!.max.y<=3);
    for(const lv of [4,5]) assert.equal(getOrBuildElementAsset("bus_stops",lv,v,1,1),current);
  }
});

test("context opens a real crop gate, preserves structures, and reads rotated painted soil",()=>{
  const c=makeCtx("house",1,0,1,1);
  c.v.box(-8,0,-8,8,1,8,"grass");
  c.v.box(-8,1,-7,8,4,-6,"woodLight");
  c.v.box(-8,1,-8,-6,8,-6,"woodLight");
  applyParcelAppearance(c,{edges:[{side:"back",slot:0,kind:"garden",neighbor:"gardens"}], soils:["sand"]});
  assert.equal(c.v.v.has(packVoxKey(0,1,-7)),false);
  assert.ok(c.v.v.has(packVoxKey(-8,3,-7)));
  assert.ok(c.v.v.has(packVoxKey(-5,1,-6)));
  assert.equal(c.v.v.has(packVoxKey(2,0,5)),false);
  const st=createInitialGameState("god"), i=ensureInfrastructure(st);
  i.cells["0,0"]={...getTerrainCell(st,0,0),material:"sand"};
  const el=piece("house",0,0,1);el.spanX=1;el.spanZ=2;
  assert.deepEqual(getParcelSoils(st,el),["grass","sand"]);
});

test("local solar obstruction follows the day and the lit/dark switch changes night emission",()=>{
  const st=createInitialGameState("god"), panel=piece("solar_panels",0,0), tower=piece("skyscrapers",1,1,0,5);
  tower.spanX=1;tower.spanZ=1;
  const occ=buildOccupancyMap([panel,tower]);
  st.timeOfDay=9;const morning=generationExposure("solar",st,panel,occ);
  st.timeOfDay=17;assert.ok(morning<generationExposure("solar",st,panel,occ));
  const def=ELEMENT_BY_ID.bars;
  const dark=buildDesignAsset(def,1,2,1,1,0,{lighting:"dark"}).baseGeo.getAttribute("aEmit").array;
  const lit=buildDesignAsset(def,1,2,1,1,0,{lighting:"lit"}).baseGeo.getAttribute("aEmit").array;
  assert.ok(dark.every(v=>v===0));assert.ok(lit.some(v=>v>1));
});

test("coastal scenery and an unsupported basin do not create hydraulic service edges",()=>{
  const st=createInitialGameState("god"), el=piece("water_pumping_station",0,0);
  const i=ensureInfrastructure(st), [x,z]=cellBeyondEdge(el,"back",0);
  i.cells[x+","+z]={...getTerrainCell(st,x,z),water:"fresh",depth:1,source:0};
  assert.ok(!getParcelEdges(el,buildOccupancyMap([el]),st).some(e=>e.kind==="intake"));
  i.cells[x+","+z].source=5;
  assert.ok(getParcelEdges(el,buildOccupancyMap([el]),st).some(e=>e.kind==="intake"));
});

test("a road, a transit catchment and a shared garden all respect the actual front gate",()=>{
  const st=createInitialGameState("real"),home=piece("house",0,1),shop=piece("shops",2,1,2);
  const stop=piece("bus_stops",1,-1), garden=piece("gardens",0,2);
  st.elements=[home,shop,stop,garden,piece("roads",0,0),piece("roads",1,0),piece("roads",2,0)];
  recomputeConnectivityAndMetrics(st);
  assert.equal(home.connected,false,"a road against the rear fence must not connect");
  assert.equal(new TravelNetwork(st).catchment(stop).has(home.id),false);
  home.rotation=2;
  recomputeConnectivityAndMetrics(st);
  assert.equal(home.connected,true);
  assert.equal(garden.connected,true);
  assert.equal(new TravelNetwork(st).catchment(stop).has(garden.id),true);
  home.edgeOverrides={front:"closed"};
  recomputeConnectivityAndMetrics(st);
  assert.equal(home.connected,false);
  assert.equal(new TravelNetwork(st).catchment(stop).has(garden.id),false);
});

test("a retail cashpoint faces its shared forecourt and cannot draw customers through a blank wall",()=>{
  const st=createInitialGameState("god"), shop=piece("shops",0,0);
  st.elements=[shop];
  const planned=planConstruction(st,ELEMENT_BY_ID.atms,1,0,1,0);
  assert.equal(planned.rotation,3);
  assert.equal(planConstruction(st,ELEMENT_BY_ID.atms,1,0,1,1,true).rotation,1);
  const atm=piece("atms",1,0,planned.rotation);
  const occupancy=buildOccupancyMap([shop,atm]);
  assert.ok(getParcelEdges(atm,occupancy).some(e=>e.kind==="arcade" && e.side==="front"));
  atm.rotation=1;
  assert.equal(getParcelEdges(atm,occupancy).length,0);
});
