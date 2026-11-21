import { createHash } from "node:crypto";
import { guideCarriagewayVoxels } from "../src/game/designs/carriageways";
import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getMaxElementLevel } from "../src/game/catalog";
import {
  widenLegacyRoad,
  placedUpgradeCost,
  createInitialGameState,
  planConstruction,
  buildOccupancyMap,
  recomputeConnectivityAndMetrics,
  upgradeElementDirect,
  resizeCrossing,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { roadReservation, corridorArt, corridorTransform } from "../src/game/roadCorridors";
import { VEHICLE_ROADS, standardRoadLanes } from "../src/game/roadStandards";
import { RAIL_BRIDGES, railClearHeight, railSpanAllows, type RailBridgeKind } from "../src/game/bridgeWorks";
import {
  applyInfrastructureStroke as work,
  buildWaterNavigation,
  surfaceTravelHeight,
  roadPortOpen,
} from "../src/game/terrain";
import { roadCapacity } from "../src/game/cityDynamics";
import { getTravelNetwork } from "../src/game/travelNetwork";
import { getOrBuildElementAsset } from "../src/game/voxelArchitect";
import { settleStreetFacing } from "../src/game/streetFacing";
import { roadSiteAccess } from "../src/game/parcelEdges";
const p = (gx: number, gz: number) => ({ gx, gz });
function add(s: GameState, id: string, x: number, z: number, rotation = 0) {
  const plan = planConstruction(s, ELEMENT_BY_ID[id], x, z, 1, rotation);
  assert.ok(plan.valid, plan.reason);
  const el = {
    ...p(x, z),
    id: id + x + "," + z,
    defId: plan.def.id,
    spanX: plan.spanX,
    spanZ: plan.spanZ,
    roadAxis: plan.roadAxis,
    overWater: plan.overWater,
    rotation: plan.rotation,
    level: 1,
    variant: 0,
    connected: true,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
  } as PlacedElement;
  if (plan.replaceId) s.elements = s.elements.filter((e) => e.id !== plan.replaceId);
  s.elements.push(el);
  return el;
}
test("starter and every motor-road standard increase real carrying capacity through ten paid upgrades", () => {
  for (const id of VEHICLE_ROADS) {
    assert.equal(getMaxElementLevel(id), 11);
    for (let l = 2; l <= 11; l++)
      assert.ok(roadCapacity(ELEMENT_BY_ID[id], l) > roadCapacity(ELEMENT_BY_ID[id], l - 1), id + " L" + l);
  }
  assert.equal(standardRoadLanes("roads", 1), 2);
  const s = createInitialGameState("god"),
    e = add(s, "roads", 0, 0);
  for (let l = 2; l <= 11; l++) assert.ok(upgradeElementDirect(s, e.id).ok);
  assert.equal(e.level, 11);
  assert.equal(upgradeElementDirect(s, e.id).ok, false);
  const paid = createInitialGameState("real"),
    one = add(paid, "roads", 0, 0);
  one.connected = true;
  paid.money = 0;
  assert.equal(upgradeElementDirect(paid, one.id).ok, false);
  const cost = placedUpgradeCost(paid, one);
  paid.money = cost + 50;
  assert.ok(upgradeElementDirect(paid, one.id).ok);
  assert.equal(paid.money, 50);
});
test("new carriageways reserve their full measured width and taper into a shared local approach while legacy sites keep their land", () => {
  for (const [id, width] of [
    ["highways", 2],
    ["freeways", 3],
  ] as const) {
    const s = createInitialGameState("god"),
      e = add(s, id, 0, 0, 1),
      other = add(s, id, 1, 0, 1);
    add(s, id, -1, 0, 1);
    assert.equal(e.roadAxis, "x");
    assert.equal(roadReservation(e).length, width);
    assert.equal(planConstruction(s, ELEMENT_BY_ID.house, 0, 1, 1, 0).valid, false);
    const occ = buildOccupancyMap(s.elements),
      art = corridorArt(e, occ)!;
    const g = getOrBuildElementAsset(id, 1, 0, 1, 1, 10, { corridor: art }).baseGeo.boundingBox!;
    assert.ok(g.max.z - g.min.z > (width - 1) * 4);
    add(s, "roads", 2, 0);
    const taper = corridorArt(other, buildOccupancyMap(s.elements))!;
    assert.equal(corridorTransform(taper, 2, 0.65), 0.65);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.elements.forEach((e) => delete e.roadAxis);
    assert.ok(planConstruction(old, ELEMENT_BY_ID.house, 0, 1, 1, 0).valid);
  }
  const blocked = createInitialGameState("god");
  add(blocked, "house", 0, 1);
  assert.equal(planConstruction(blocked, ELEMENT_BY_ID.highways, 0, 0, 1, 1).valid, false);
});
test("a legacy freeway widens in place once the shoulders are clear", () => {
  const s = createInitialGameState("god"),
    e = add(s, "freeways", 0, 0, 1);
  delete e.roadAxis;
  e.rotation = 1;
  const h = add(s, "house", 0, 1);
  assert.equal(widenLegacyRoad(s, e).ok, false);
  assert.equal(e.roadAxis, undefined);
  s.elements = s.elements.filter((q) => q !== h);
  assert.ok(widenLegacyRoad(s, e).ok);
  assert.equal(roadReservation(e).length, 3);
  assert.equal(e.level, 1);
});
test("rectangular freestanding lots automatically receive an actual side gate when turning would displace their occupied cells", () => {
  const s = createInitialGameState("god"),
    site = add(s, "house", 0, 0);
  site.spanZ = 2;
  site.awaitingStreet = true;
  const road = add(s, "roads", 1, 0);
  settleStreetFacing(s, road, false);
  assert.equal(site.rotation, 0);
  assert.ok(site.autoDrive);
  assert.ok(roadSiteAccess(road, buildOccupancyMap(s.elements), s).some((g) => g.site.id === site.id));
});
test("all five rail structures carry real train paths in both directions and respect water clearance and deck-wide upgrades", () => {
  for (const k of Object.keys(RAIL_BRIDGES) as RailBridgeKind[]) {
    const s = createInitialGameState("god");
    work(s, { kind: "canal", depth: 3 }, [p(0, -2), p(0, 2)]);
    const job = work(s, { kind: "bridge", mode: "rail", railType: k, height: railClearHeight[k] }, [p(-2, 0), p(2, 0)]);
    assert.ok(job.valid, job.reason);
    const sections = Object.entries(s.infrastructure!.spans);
    const end = Math.max(...sections.map(([key]) => Number(key.split(",")[0])));
    add(s, "train_tracks", -end - 1, 0);
    add(s, "train_tracks", end + 1, 0);
    assert.ok(railSpanAllows(s, 0, 0, 1, 0));
    assert.equal(railSpanAllows(s, 0, 0, 0, 1), false);
    assert.ok(getTravelNetwork(s).path([[-end - 1, 0]], [[end + 1, 0]], "rail"));
    const cell = buildWaterNavigation(s).cell(0, 0),
      e = s.elements.find((e) => e.gx === 0 && e.gz === 0)!;
    assert.equal(s.infrastructure!.spans["0,0"].railType, k);
    assert.ok(upgradeElementDirect(s, e.id).ok);
    assert.ok(Object.values(s.infrastructure!.spans).every((x) => x.tier === 2));
    assert.ok(buildWaterNavigation(s).cell(0, 0).clearance > cell.clearance);
    assert.ok(resizeCrossing(s, e, 1));
    assert.ok(Math.abs(buildWaterNavigation(s).cell(0, 0).clearance - cell.clearance) < 0.01);
  }
});
test("a catalog bridge drawn over several water tiles promotes the continuous span, preserves bank height and blocks sideways jumps", () => {
  const s = createInitialGameState("god");
  for (let x = -1; x <= 1; x++) work(s, { kind: "canal", depth: 2 }, [p(x, -1), p(x, 1)]);
  add(s, "roads", -2, 0);
  for (let x = -1; x <= 1; x++) add(s, "roads", x, 0);
  add(s, "roads", 2, 0);
  recomputeConnectivityAndMetrics(s);
  const run = Object.values(s.infrastructure!.spans);
  assert.equal(run.length, 5);
  assert.ok(run.every((p) => p.catalog));
  const e = s.elements.find((e) => e.gx === 0)!;
  assert.equal(roadPortOpen(s, 0, 0, 0, 1), false);
  for (let l = 1; l <= 11; l++) {
    if (l > 1) assert.ok(upgradeElementDirect(s, e.id).ok);
    for (let x = -2; x < 2; x++)
      assert.ok(Math.abs(surfaceTravelHeight(s, x, 0, "x", 1) - surfaceTravelHeight(s, x + 1, 0, "x", 0)) < 0.001);
    assert.equal(surfaceTravelHeight(s, -2, 0, "x", 0), 0);
    assert.ok(run.every((r) => r.tier === l));
  }
  s.elements = s.elements.filter((road) => road !== e);
  recomputeConnectivityAndMetrics(s);
  assert.equal(Object.values(s.infrastructure!.spans).filter((s) => s.catalog).length, 0);
});

test("all 88 physical highway and freeway guide models have distinct visible geometry or materials across eleven stages and four landscape styles", () => {
  const states = new Set<string>();
  for (const id of ["highways", "freeways"])
    for (let level = 1; level <= 11; level++)
      for (let v = 0; v < 4; v++) {
        const vox = guideCarriagewayVoxels(id, level, v),
          ordered = [...vox].sort(([a], [b]) => a - b);
        const hash = createHash("sha256").update(new Int32Array(ordered.flat())).digest("hex");
        assert.ok(!states.has(hash), id + " stage " + level + " style " + v);
        states.add(hash);
      }
});
