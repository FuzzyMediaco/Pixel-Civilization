import assert from "node:assert/strict";
import test from "node:test";
import { readAtlasRoute, writeAtlasRoute } from "../src/handbook/atlasRoute";
import { createRomePractice, dispatchPracticeTrain, followPracticeTrain, outletFlow, takeRomeAction } from "../src/handbook/romePractice";

test("both Atlas links preserve the era, selected model and the source lesson",()=>{
  for (const guide of [true,false]) {
    const selected={tab:"atlas" as const,era:"rome-aqueduct" as const,elementId:"roads",level:11,variant:4,courseLesson:"rome-access"};
    const parsed=readAtlasRoute(new URLSearchParams(writeAtlasRoute(selected,guide)),guide);
    for(const key of Object.keys(selected) as (keyof typeof selected)[]) assert.equal(parsed[key],selected[key]);
  }
  assert.equal(readAtlasRoute(new URLSearchParams("era=unknown")).era,"original");
});

test("Roman practice goals read the game simulation and reset to their original state",()=>{
  const access=createRomePractice("rome-access");
  assert.equal(takeRomeAction(access,"rome-access").ok,true);
  assert.equal(access.elements.find(e=>e.defId==="house")?.connected,true);
  const water=createRomePractice("rome-flow");
  assert.equal(outletFlow(water),0);
  assert.equal(takeRomeAction(water,"rome-flow").ok,true);
  assert.ok(outletFlow(water)>0);
  assert.equal(outletFlow(createRomePractice("rome-flow")),0);
  const upgrade=createRomePractice("rome-upgrade"), before=upgrade.metrics.housingBase;
  assert.equal(takeRomeAction(upgrade,"rome-upgrade").ok,true);
  assert.ok(upgrade.metrics.housingBase>before);
  for(const platform of [0,1]) {
    const district=createRomePractice("rome-transit");
    dispatchPracticeTrain(district,platform);
    const line=district.mobility!.lines[0];
    const positions=new Set<number>();
    let arrived=false;
    for(let i=0;i<1440 && !arrived;i++){
      arrived=followPracticeTrain(district).ok;
      if(line.position)positions.add(Math.round(line.position[0]*10));
    }
    assert.ok(positions.size>3);
    assert.ok(arrived);
    assert.equal(line.at,district.elements.filter(e=>e.defId==="train_stops")[platform].id);
  }
});
