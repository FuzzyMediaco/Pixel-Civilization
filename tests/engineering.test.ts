import { setEconomicControl } from "../src/game/cityEconomy";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialGameState,
  checkPlacementValid,
  recomputeConnectivityAndMetrics,
  type PlacedElement,
} from "../src/game/simulation";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import {
  applyInfrastructureStroke as draw,
  getTerrainCell,
  buildWaterNavigation,
  requestVesselPassage,
  roadTravelOpen,
  surfaceTravelHeight,
  hydraulics,
  undoInfrastructure,
  readWaterService,
  registerRoadDemand,
} from "../src/game/terrain";
const p = (gx: number, gz: number) => ({ gx, gz });
test("a carved channel is navigable, persists below a bridge, and opens lift traffic in sequence", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "canal", depth: 2 }, [p(0, -3), p(0, 3)]).valid);
  assert.equal(getTerrainCell(s, 0, 0).depth, 2);
  assert.ok(checkPlacementValid(s, ELEMENT_BY_ID.boats, 0, 0, 1, 1).valid);
  assert.ok(draw(s, { kind: "bridge", shape: "arch", mode: "foot", height: 1 }, [p(-1, 0), p(1, 0)]).valid);
  const gondola = { draft: 0.24, beam: 1.35, height: 0.7 },
    mast = { ...gondola, height: 4 };
  assert.ok(buildWaterNavigation(s).canStep(0, -1, 0, 0, gondola));
  assert.ok(!buildWaterNavigation(s).canPass(0, 0, mast));
  assert.equal(s.elements.find((e) => e.gx === 0)?.defId, "walking_paths");
  assert.ok(draw(s, { kind: "bridge", mode: "foot", shape: "lift", height: 1 }, [p(0, 0)]).valid);
  assert.ok(buildWaterNavigation(s).canPass(0, 0, mast));
  assert.equal(requestVesselPassage(s, 0, 0, 4), false);
  assert.equal(roadTravelOpen(s, 0, 0, 1, 0), false);
  s.activePlaySec += 6;
  assert.equal(requestVesselPassage(s, 0, 0, 4), true);
  assert.ok(surfaceTravelHeight(s, 0, 0, "x", 0.5) > 4);
  s.activePlaySec += 11;
  assert.ok(roadTravelOpen(s, 0, 0, 1, 0));
  const copy = JSON.parse(JSON.stringify(s));
  assert.ok(undoInfrastructure(copy));
  assert.equal(copy.infrastructure.spans["0,0"].shape, "arch");
  assert.ok(undoInfrastructure(copy));
  assert.equal(copy.elements.length, 0);
  assert.equal(getTerrainCell(copy, 0, 0).depth, 2);
});
test("pressure, branch sharing, storage and caps agree with wet geometry", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  draw(s, { kind: "spring", depth: 1, flow: 12 }, [p(-1, 0)]);
  draw(s, { kind: "aqueduct", height: 2 }, [p(0, 0), p(4, 0)]);
  draw(s, { kind: "aqueduct", height: 2 }, [p(2, 0), p(2, 2)]);
  const farm = (id: string, gx: number, gz: number) => ({
    id,
    defId: "farms",
    gx,
    gz,
    spanX: 1,
    spanZ: 1,
    rotation: 0,
    level: 1,
    variant: 0,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animKind: "place" as const,
    animProgress: 0,
  });
  const a = farm("f1", 5, 0),
    b = farm("f2", 2, 3);
  s.elements.push(a, b);
  const result = hydraulics(s);
  assert.ok(result.runs.get("4,0")?.flow);
  assert.ok(result.runs.get("2,2")?.flow);
  const total = readWaterService(s, a).irrigation + readWaterService(s, b).irrigation;
  assert.ok(total > 0 && total <= 12);
  draw(s, { kind: "aqueduct", height: 9 }, [p(3, 0)]);
  assert.equal(hydraulics(s).runs.get("4,0")?.flow, 0);
  draw(s, { kind: "aqueduct", height: 2, outlet: "cap" }, [p(1, 0)]);
  assert.equal(hydraulics(s).runs.get("2,2")?.flow, 0);
});
test("an unaffordable or locked stroke never leaves a partial edit and undo refunds the full price", () => {
  const s = createInitialGameState("real");
  s.elements = [];
  s.money = 100;
  assert.equal(draw(s, { kind: "canal" }, [p(0, 0)]).valid, false);
  let before = s.money;
  const input = [p(0, 0), p(3, 0)];
  const paid = draw(s, { kind: "paint", material: "sand" }, input);
  assert.ok(paid.valid);
  assert.equal(s.money, before - paid.cost);
  assert.ok(undoInfrastructure(s));
  assert.equal(s.money, before);
  s.money = 1;
  assert.equal(draw(s, { kind: "paint" }, input).valid, false);
  assert.equal(Object.keys(s.infrastructure!.cells).length, 0);
});

test("a dry viaduct accepts a later river and removing its deck leaves the carved channel intact", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "bridge", mode: "rail", shape: "truss", height: 2 }, [p(-2, 0), p(2, 0)]).valid);
  assert.ok(draw(s, { kind: "river", depth: 2 }, [p(0, -3), p(0, 3)]).valid);
  assert.equal(s.elements.find((e) => e.gx === 0)?.defId, "train_tracks");
  assert.ok(draw(s, { kind: "erase", eraseLayer: "deck" }, [p(0, 0)]).valid);
  assert.equal(s.elements.length, 0);
  assert.equal(getTerrainCell(s, 0, 0).form, "river");
});
test("salt at an outlet stays downstream; a closed lock cuts navigation and reopening restores it", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "river", depth: 2 }, [p(15, 0), p(31, 0)]).valid);
  assert.equal(getTerrainCell(s, 15, 0).water, "fresh");
  assert.equal(getTerrainCell(s, 30, 0).water, "salt");
  const hull = { draft: 0.25, beam: 1.5, height: 0.6 };
  assert.ok(buildWaterNavigation(s).canStep(16, 0, 17, 0, hull));
  assert.ok(draw(s, { kind: "lock", gate: "closed" }, [p(17, 0)]).valid);
  assert.ok(!buildWaterNavigation(s).canStep(16, 0, 17, 0, hull));
  assert.ok(draw(s, { kind: "lock", gate: "open" }, [p(17, 0)]).valid);
  assert.ok(buildWaterNavigation(s).canStep(16, 0, 17, 0, hull));
});
test("raising a bridge reserves additional approach tiles, and the interchange maintains separate through axes", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "canal" }, [p(0, -2), p(0, 2)]).valid);
  assert.ok(draw(s, { kind: "bridge", mode: "road", height: 1 }, [p(-1, 0), p(1, 0)]).valid);
  const run = s.infrastructure!.spans["0,0"].run;
  const bridge = draw(s, { kind: "bridge", mode: "road", height: 5 }, [p(0, 0)]);
  assert.equal(s.infrastructure!.spans["-3,0"].run, run);
  assert.ok(bridge.valid);
  assert.equal(bridge.points.length, 7);
  const ramp = s.infrastructure!.spans["-3,0"];
  assert.equal(ramp.startHeight, 0);
  assert.ok(ramp.endHeight < 2);
  const cross = draw(s, { kind: "interchange", layout: "diamond", orientation: 1 }, [p(10, 10)]);
  assert.ok(cross.valid);
  assert.equal(s.elements.find((e) => e.gx === 10 && e.gz === 10)?.crossingAxis, "z");
  assert.ok(cross.points.length > 13);
});

function site(defId: string, gx: number, gz: number, sx = 1, sz = 1, level = 1): PlacedElement {
  return {
    id: defId + "-" + gx + "-" + gz,
    defId,
    gx,
    gz,
    spanX: sx,
    spanZ: sz,
    level,
    variant: 0,
    rotation: 0,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animKind: "place",
    animProgress: 1,
  };
}
test("a working boat lift connects different water levels and the ocean ring keeps four approach berths", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "pond", depth: 2, waterLevel: 0 }, [p(0, -1)]).valid);
  assert.ok(draw(s, { kind: "pond", depth: 2, waterLevel: 3 }, [p(0, 2)]).valid);
  const lift = site("canal_boat_lift", 0, 0, 2, 2, 3),
    ring = site("ocean_habitat_ring", 27, 23, 3, 3, 3);
  s.elements.push(lift, ring);
  const nav = buildWaterNavigation(s),
    boat = { draft: 0.3, beam: 1.2, height: 1 };
  assert.ok(nav.canStep(0, -1, 0, 0, boat));
  assert.ok(nav.canStep(0, 0, 0, 1, boat));
  assert.ok(nav.canStep(0, 1, 0, 2, boat));
  assert.ok(!nav.canStep(0, 0, 1, 0, boat));
  assert.ok(!nav.canPass(0, 0, { ...boat, height: 10 }));
  assert.ok(!requestVesselPassage(s, 0, 0, boat.height));
  s.activePlaySec += 4;
  assert.ok(requestVesselPassage(s, 0, 0, boat.height));
  assert.ok(!nav.canPass(28, 24, boat));
  for (const [x, z] of [
    [27, 23],
    [29, 23],
    [27, 25],
    [29, 25],
  ])
    assert.ok(nav.canPass(x, z, boat), "berth " + x + "," + z);
  assert.equal(nav.cell(27, 23).ports, 9);
  assert.ok(!nav.canStep(27, 23, 28, 23, boat));
  s.mode = "real";
  s.metrics.powerSupply = 0;
  assert.ok(!buildWaterNavigation(s).canPass(0, 0, boat));
});
test("a fed channel delivers irrigation across its length and banks stop receiving when the gate shuts", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  assert.ok(draw(s, { kind: "canal", depth: 1.5 }, [p(-4, 0), p(4, 0)]).valid);
  const farm = site("farms", 4, -1);
  s.elements.push(farm);
  recomputeConnectivityAndMetrics(s);
  const baseline = s.metrics.waterSupply;
  assert.equal(readWaterService(s, farm).irrigation, 0);
  assert.ok(draw(s, { kind: "spring", depth: 1.5, flow: 10 }, [p(-4, 0)]).valid);
  recomputeConnectivityAndMetrics(s);
  assert.equal(readWaterService(s, farm).irrigation, 10);
  assert.equal(s.metrics.waterSupply, baseline + 10);
  assert.ok(draw(s, { kind: "lock", gate: "closed" }, [p(0, 0)]).valid);
  recomputeConnectivityAndMetrics(s);
  assert.equal(readWaterService(s, farm).irrigation, 0);
  assert.equal(s.metrics.waterSupply, baseline);
  const pump = site("water_pumping_station", 2, 1);
  s.elements.push(pump);
  assert.equal(readWaterService(s, farm).irrigation, 12);
});
test("God works obey held stage and charge controls and traffic signals adapt to the approach queue", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  s.money = 500;
  setEconomicControl(s, "charge", 1, true);
  setEconomicControl(s, "stageRules", 1, true);
  assert.ok(!draw(s, { kind: "bridge", shape: "lift" }, [p(0, 0), p(4, 0)]).valid);
  const paid = draw(s, { kind: "paint" }, [p(3, 0)]);
  assert.ok(paid.valid && paid.cost > 0);
  assert.equal(s.money, 500 - paid.cost);
  assert.ok(s.economy?.ledger.some((e) => e.label === "Public works" && e.amount === paid.cost));
  assert.ok(undoInfrastructure(s));
  assert.equal(s.money, 500);
  assert.ok(s.economy?.ledger.some((e) => e.label === "Public works refund"));
  s.highestStageReached = 20;
  s.elements = [site("roads", 0, 0), site("roads", 1, 0), site("roads", 0, 1)];
  assert.ok(draw(s, { kind: "street", signal: "auto", period: 10, lanes: 2 }, [p(0, 0)]).valid);
  s.activePlaySec = 0;
  registerRoadDemand(s, 0, 0, 0, 1, 20);
  s.activePlaySec = 16;
  assert.ok(roadTravelOpen(s, 0, 0, 0, 1));
  assert.ok(!roadTravelOpen(s, 0, 0, 1, 0));
  s.activePlaySec = 17.8;
  assert.ok(roadTravelOpen(s, 0, 0, 1, 0));
});

test("lowering an adjoining outlet lets a pond spill with conserved volume and undo returns its original shoreline", () => {
  const s = createInitialGameState("god");
  s.elements = [];
  draw(s, { kind: "pond", depth: 2, waterLevel: 0 }, [p(0, 0)]);
  draw(s, { kind: "lower", height: 1 }, [p(1, 0)]);
  const pond = getTerrainCell(s, 0, 0),
    outlet = getTerrainCell(s, 1, 0);
  assert.equal(pond.waterLevel, outlet.waterLevel);
  assert.ok(outlet.depth > 0 && pond.depth < 2);
  assert.equal(pond.depth + outlet.depth, 2);
  assert.equal(getTerrainCell(s, 2, 0).depth, 0);
  assert.ok(undoInfrastructure(s));
  assert.equal(getTerrainCell(s, 0, 0).depth, 2);
  assert.equal(getTerrainCell(s, 1, 0).depth, 0);
});
