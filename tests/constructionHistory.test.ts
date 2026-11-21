import assert from "node:assert/strict";
import { test } from "node:test";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import { transfer } from "../src/game/cityEconomy";
import { ensureInfrastructure, getTerrainCell, applyLandformPlacement } from "../src/game/terrain";
import { createInitialGameState, removePlacedElements, type PlacedElement } from "../src/game/simulation";

function site(id:string,gx=0,gz=0):PlacedElement {
  return {id,defId:"house",gx,gz,spanX:1,spanZ:1,rotation:0,level:1,variant:0,connected:false,
    hasPoliceCover:false,hasFireCover:false,nuisancePenalty:0,maintTimerSec:0,disrepair:false,onFire:false,animProgress:0,animKind:"place"};
}

test("undo placement refunds its receipt, preserving elapsed time, later income and neighboring construction",()=>{
  const s=createInitialGameState("real");s.money=300;
  const before=structuredClone(s);
  transfer(s,"treasury","outside",35,"Construction");s.elements.push(site("new"));
  rememberBuildingEdit(before,s,"Place house");
  const saved=JSON.parse(JSON.stringify(s)) as typeof s;
  saved.activePlaySec=90;saved.timeOfDay=16.25;saved.money+=9;saved.elements.push(site("untouched",3,4));
  assert.deepEqual(undoBuildingEdit(saved),{ok:true,label:"Place house",refunded:35});
  assert.equal(saved.money,309);assert.equal(saved.timeOfDay,16.25);assert.equal(saved.activePlaySec,90);
  assert.deepEqual(saved.elements.map(e=>e.id),["untouched"]);
  assert.equal(saved.economy!.ledger.at(-1)?.label,"Building edit refund");
  assert.equal(undoBuildingEdit(saved).ok,false);
});

test("undo move and upgrade keep the active island and protect a newly occupied former site",()=>{
  const s=createInitialGameState("god");s.elements=[site("mover")];
  const before=structuredClone(s);s.elements[0].gx=2;
  rememberBuildingEdit(before,s,"Move house");
  s.elements.push(site("later",0,0));
  assert.match(undoBuildingEdit(s).reason!,/occupied/);assert.equal(s.elements[0].gx,2);
  s.elements.pop();
  const placed=s.elements[0];placed.onFire=true;placed.maintTimerSec=41;
  assert.ok(undoBuildingEdit(s).ok);assert.equal(placed.gx,0);assert.equal(placed.onFire,true);assert.equal(placed.maintTimerSec,41);
  const next=structuredClone(s);placed.level=2;placed.spanX=2;s.money=200;
  transfer(s,"treasury","outside",40,"Building upgrade");
  rememberBuildingEdit(next,s,"Upgrade house");
  placed.variant=1;
  assert.match(undoBuildingEdit(s).reason!,/later edit/i);
  placed.variant=0;
  assert.ok(undoBuildingEdit(s).ok);assert.equal(placed.level,1);assert.equal(placed.spanX,1);assert.equal(s.money,200);
});

test("batch demolition is atomic and paint undo refuses later ground work",()=>{
  const s=createInitialGameState("god");s.elements=[site("A"),site("B",1,0)];
  const before=structuredClone(s);
  removePlacedElements(s,new Set(["A","B"]));rememberBuildingEdit(before,s,"Remove two homes");
  s.elements.push(site("occupied",1,0));assert.equal(undoBuildingEdit(s).ok,false);assert.equal(s.elements.length,1);
  s.elements=[];assert.ok(undoBuildingEdit(s).ok);assert.deepEqual(s.elements.map(e=>e.id).sort(),["A","B"]);
  const beforePaint=structuredClone(s),paint=site("desert",4,4);paint.defId="deserts";
  s.elements.push(paint);applyLandformPlacement(s,paint);rememberBuildingEdit(beforePaint,s,"Place desert");
  const inf=ensureInfrastructure(s),fresh=structuredClone(inf.cells["4,4"]);
  inf.cells["4,4"]={...fresh,elevation:3};
  assert.match(undoBuildingEdit(s).reason!,/public works/);
  inf.cells["4,4"]=fresh;
  assert.ok(undoBuildingEdit(s).ok);assert.equal(getTerrainCell(s,4,4).material,"grass");
});
