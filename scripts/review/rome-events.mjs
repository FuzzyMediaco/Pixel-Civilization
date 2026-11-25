// Run with node --import tsx scripts/review/rome-events.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createCanvas} from "@napi-rs/canvas";
import "../../src/game/designs/index.ts";
import {createExampleWorld} from "../../src/game/exampleWorlds.ts";
import {visitPracticeRailway} from "../../src/game/practiceRailway.ts";
import {stepSimulation} from "../../src/game/simulation.ts";
import {applyInfrastructureStroke, readWaterService, undoInfrastructure} from "../../src/game/terrain.ts";
import {eraActiveSites, presentationActivity} from "../../src/game/eraActivity.ts";
import {loadEraArt} from "../../src/game/eraArtLoader.ts";
import {faces,raster,voxels} from "../voxel-illustration.mjs";

await loadEraArt("rome-aqueduct");
const siteById = (s,id) => s.elements.find(e=>e.id===id);
function appearance(s,site,family) {
  return presentationActivity(s,site,family,eraActiveSites(s));
}
function capture(s,site,family,label,caption,data) {
  return {label,caption,seconds:s.activePlaySec,id:site.id,baseId:site.defId,level:site.level,variant:site.variant,
    era:s.appearanceEra,activity:appearance(s,site,family),data};
}
function advanceTo(s,predicate) {
  for(let i=0;i<180;i++) {
    stepSimulation(s,1,true);
    if(predicate()) return;
  }
  throw Error("Expected game event did not occur within 180 simulation seconds");
}
function freightSequence() {
  const s=visitPracticeRailway(createExampleWorld("switchyard-city")).state;
  s.appearanceEra="rome-forum";
  const line=s.mobility.lines.find(l=>l.rail?.name==="Harvest Freight");
  const contract=line.rail.contract;
  const market=siteById(s,contract.sink);
  assert.equal(market.defId,"grocery_store");
  const receipt=()=>s.railYard.received?.[market.id]?.grain??0;
  const captureMarket=(label,caption)=>capture(s,market,"market",label,caption,{
    railway:line.rail.name,source:contract.source,drop:contract.drop,trainAt:line.at,loaded:contract.loaded,
    received:receipt(),unloadedHere:contract.unloadedHere??0,marketFood:s.economy?.sites[market.id]?.food??0
  });
  advanceTo(s,()=>contract.loaded>0);
  const before=captureMarket("Freight en route",contract.loaded+" grain aboard the train");
  advanceTo(s,()=>receipt()>0);
  assert.equal(line.at,contract.drop);
  assert.equal(contract.unloadedHere,receipt());
  const during=captureMarket("Unloading",receipt()+" grain received at the market");
  advanceTo(s,()=>appearance(s,market,"market")==="idle");
  const after=captureMarket("Unloading ends",receipt()+" grain in its delivery record");
  assert.deepEqual([before.activity,during.activity,after.activity],["idle","active","idle"]);
  return {title:"Grain to the market",instance:"Switchyard City · Orchard Valley",frames:[before,during,after]};
}
function railSequence() {
  const s=createExampleWorld("rome-district"),line=s.mobility.lines[0];
  const station=siteById(s,line.stops.at(-1));
  const count=()=>line.riders.filter(r=>r.boarded===s.activePlaySec).reduce((n,r)=>n+r.count,0);
  const captureStation=(label,caption)=>capture(s,station,"station",label,caption,{
    trainAt:line.at,railway:line.rail.name,boardedNow:count(),passengersOnTrain:line.riders.reduce((n,r)=>n+r.count,0),
    dwellRemaining:line.dwell
  });
  const before=captureStation("Before arrival","Platform awaiting the train");
  advanceTo(s,()=>line.at===station.id&&count()>0);
  const during=captureStation("Boarding",count()+" riders boarded this train");
  advanceTo(s,()=>appearance(s,station,"station")==="idle");
  const after=captureStation("Boarding ends",line.riders.reduce((n,r)=>n+r.count,0)+" riders aboard the train");
  assert.deepEqual([before.activity,during.activity,after.activity],["idle","active","idle"]);
  return {title:"Passengers on the local",instance:"Porta Fluminis · eastern platform",frames:[before,during,after]};
}
function waterSequence() {
  const s=createExampleWorld("rome-district"),site=s.elements.find(e=>e.defId==="water_treatment_plant");
  const snap=label=>{
    const service=readWaterService(s,site);
    return capture(s,site,"water",label,service.potable+" potable water delivered",{...service,outlet:[3,-2]});
  };
  const before=snap("Connected");
  assert.ok(applyInfrastructureStroke(s,{kind:"erase",eraseLayer:"aqueduct"},[{gx:3,gz:-2}]).valid);
  const during=snap("Outlet removed");
  assert.ok(undoInfrastructure(s));
  const after=snap("Undo restores outlet");
  assert.deepEqual([before.activity,during.activity,after.activity],["active","idle","active"]);
  assert.ok(before.data.potable>0);
  assert.equal(during.data.potable,0);
  assert.deepEqual(before.data,after.data);
  return {title:"Water at the baths",instance:"Porta Fluminis · spring aqueduct",frames:[before,during,after]};
}
const sequences=[freightSequence(),railSequence(),waterSequence()];
const output=path.resolve("docs/review/rome-pilot");
fs.mkdirSync(output,{recursive:true});
const plate=createCanvas(1040,835),ctx=plate.getContext("2d");
function label(text,x,y,size,bold=false,color="#25372d") {
  ctx.font=(bold?"bold ":"")+size+"px Arial";ctx.fillStyle=color;ctx.fillText(text,x,y);
}
ctx.fillStyle="#faf6eb";ctx.fillRect(0,0,plate.width,plate.height);
label("Rome in operation",25,38,32,true);
label("Three moments from each game system, rendered from the saved measurements below each model.",26,66,15);
sequences.forEach((row,r)=>{
  const y=87+r*247;
  ctx.fillStyle="#e8e5d8";ctx.fillRect(25,y,990,1);
  label(row.title,26,y+26,20,true);
  label(row.instance,26,y+47,13);
  const meshes=row.frames.map(f=>faces(voxels(f.baseId,f.level,f.variant,undefined,[],{era:f.era,eraActivity:f.activity})));
  const common=Math.min(...meshes.map(m=>Math.min(250/(m.maxU-m.minU),123/(m.maxV-m.minV))));
  row.frames.forEach((frame,i)=>{
    const x=25+i*339;
    ctx.fillStyle="#e6ede6";ctx.fillRect(x,y+58,314,135);
    ctx.drawImage(raster(meshes[i],common,314,true,135,true),x,y+58);
    label(frame.label,x,y+214,16,true);
    label(frame.caption+"  ·  "+frame.seconds+"s",x,y+235,13);
  });
});
fs.writeFileSync(path.join(output,"events.json"),JSON.stringify(sequences,null,2)+"\n");
fs.writeFileSync(path.join(output,"events.webp"),plate.encodeSync("webp",93));
for(const row of sequences)console.log(row.title,row.frames.map(f=>[f.seconds,f.activity,f.caption]));
