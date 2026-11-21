import assert from "node:assert/strict";
import test from "node:test";
import {
  ELEMENT_BY_ID,
  getStandardFootprintForLevel,
} from "../src/game/catalog";
import { addLine, stepMobility } from "../src/game/mobility";
import { siteOf, advanceEconomy } from "../src/game/cityEconomy";
import { railBodies } from "../src/game/railMovement";
import {
  assignContract,
  advanceRailFreightStock,
  freightCall,
  freightAvailable,
  changeFormation,
  defaultFormation,
  installYardWork,
  railFreightBonus,
  setTurnout,
  trainFor,
} from "../src/game/railOperations";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { getTravelNetwork } from "../src/game/travelNetwork";
import { visitPracticeRailway } from "../src/game/practiceRailway";
import { buildRailModel } from "../src/game/railModels";

function put(
  s: GameState,
  id: string,
  x: number,
  z: number,
  level = 1,
  rotation = 0,
) {
  const [sx, sz] = getStandardFootprintForLevel(ELEMENT_BY_ID[id], level);
  const e: PlacedElement = {
    id: id + x + "," + z,
    defId: id,
    gx: x,
    gz: z,
    spanX: rotation % 2 ? sz : sx,
    spanZ: rotation % 2 ? sx : sz,
    level,
    rotation,
    variant: 1,
    connected: true,
    hasPoliceCover: true,
    hasFireCover: true,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
  s.elements.push(e);
  return e;
}
function district() {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = -9; x <= 10; x++) put(s, "train_tracks", x, 0);
  for (let x = -10; x <= 11; x++) put(s, "roads", x, 3);
  const depot = put(s, "train_depots", -9, 1, 2),
    a = put(s, "train_stops", -4, 1, 2),
    b = put(s, "train_stops", 7, 1, 2);
  const cargoA = put(s, "freight_rail_terminal", -6, -1, 1, 2),
    cargoB = put(s, "freight_rail_terminal", 5, -1, 1, 2);
  const farm = put(s, "farms", -7, -1),
    shop = put(s, "grocery_store", 7, -1);
  put(s, "train_tracks", 1, -1);
  put(s, "train_tracks", 1, -2);
  put(s, "train_tracks", 2, -2);
  for (let x = -8; x <= 9; x++) if (x % 3 === 0) put(s, "house", x, 4, 1, 2);
  s.population = 60;
  return { s, depot, a, b, cargoA, cargoB, farm, shop };
}
function step(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) {
    s.activePlaySec += 0.25;
    stepMobility(s, 0.25);
  }
}
// ---------------------------------------------------------------- round 2: blocks, lines with N trains, physics
import { addTrainToLine, lineHeadway, transitReadout } from "../src/game/mobility";
import { railLeg } from "../src/game/railMovement";
function loopDistrict(withLoop: boolean) {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = -12; x <= 12; x++) put(s, "train_tracks", x, 0);
  if (withLoop) {
    for (const x of [-3, 3]) put(s, "train_tracks", x, -1);
    for (let x = -3; x <= 3; x++) put(s, "train_tracks", x, -2);
  }
  for (let x = -13; x <= 13; x++) put(s, "roads", x, 3);
  const depot = put(s, "train_depots", -12, 1, 2),
    west = put(s, "train_stops", -9, 1, 2),
    east = put(s, "train_stops", 9, 1, 2),
    eastDepot = put(s, "train_depots", 11, 1, 2);
  for (let x = -11; x <= 11; x += 2) put(s, "house", x, 4, 1, 2);
  s.population = 80;
  return { s, depot, west, east, eastDepot };
}
test("dbg", () => {
  const { s, depot, west, east, eastDepot } = loopDistrict(true);
  addLine(s, "rail", depot.id, [west.id, east.id], defaultFormation());
  addLine(s, "rail", eastDepot.id, [east.id, west.id], { ...defaultFormation(), name: "Counter" });
  for (let t = 0; t < 160; t += 0.25) { s.activePlaySec += 0.25; stepMobility(s, 0.25);
    if (t % 2 === 0) console.log(t, s.mobility!.lines.map(l => `${l.status.slice(0,30)+' '+(l.rail!.claimEnd??'').toString().slice(0,4)+' p='+l.path.map(p=>p.map(Math.round).join(',')).filter((_,i)=>i%2==0).join(' ')} @${l.position?.map(v=>v.toFixed(1))} y=${l.rail!.yielding??""} by=${l.rail!.blockedBy??""}`).join(" || "));
  }
});
