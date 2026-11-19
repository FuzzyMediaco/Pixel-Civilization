import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID as defs, getStandardFootprintForLevel, getUpgradeCost } from "../src/game/catalog";
import { networkRoadProfile } from "../src/game/designs/networks";
import { createInitialGameState, getConnectedRailCoordSet, getNetworkConnMask, mergeElementsInState,
  planConstruction, recomputeConnectivityAndMetrics, relocatePlacedElement, removePlacedElements,
  upgradeElementDirect, type PlacedElement } from "../src/game/simulation";

function piece(defId: string, gx: number, gz: number, rotation = 0, level = 1): PlacedElement {
  const [sx, sz] = getStandardFootprintForLevel(defs[defId], level);
  return {
    id: defId + "@" + gx + "," + gz, defId, gx, gz, rotation, level, variant: 2,
    spanX: rotation % 2 ? sz : sx, spanZ: rotation % 2 ? sx : sz, connected: false,
    hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0,
    disrepair: false, onFire: false, animProgress: 0, animKind: "place",
  };
}

test("paid upgrades reserve the actual lot and keep the architectural style", () => {
  const st = createInitialGameState("real");
  st.highestStageReached = 20;
  const farm = piece("farms", 0, 0);
  st.elements = [farm, piece("roads", -1, 0), piece("roads", 1, 0), piece("roads", 0, -1), piece("roads", 0, 1)];
  const balance = st.money, original = structuredClone(farm);
  assert.equal(upgradeElementDirect(st, farm.id).ok, false);
  assert.deepEqual(farm, original);
  assert.equal(st.money, balance);
  st.elements.pop();
  assert.equal(upgradeElementDirect(st, farm.id).ok, true);
  assert.deepEqual([farm.gx, farm.gz, farm.spanX, farm.spanZ, farm.level, farm.rotation, farm.variant], [0, 0, 1, 2, 2, 1, 2]);
  assert.equal(st.money, balance - getUpgradeCost(defs.farms, 1));
});

test("a vertical farm merge uses the two plots and preserves the original style", () => {
  const st = createInitialGameState("god");
  const a = piece("farms", 2, 0), b = piece("farms", 2, 1);
  st.elements.push(a, b);
  assert.ok(mergeElementsInState(st, a.id, b.id).ok);
  assert.equal(st.elements.length, 1);
  const merged = st.elements[0];
  assert.deepEqual([merged.gx, merged.gz, merged.spanX, merged.spanZ, merged.rotation % 2, merged.variant], [2, 0, 1, 2, 1, 2]);
});

test("a bridge keeps its river's services and restores the original river when moved or demolished", () => {
  const st = createInitialGameState("god");
  const original = piece("rivers", 0, 0, 0, 3), canal = piece("canals", 2, 0);
  st.elements.push(original, canal);
  recomputeConnectivityAndMetrics(st);
  const water = st.metrics.waterSupply;
  const plan = planConstruction(st, defs.roads, 0, 0, 1, 0);
  assert.ok(plan.valid && plan.overWater && plan.replaceId === original.id);
  const bridge = piece(plan.def.id, 0, 0);
  bridge.waterUnderlay = original;
  bridge.overWater = true;
  st.elements = [bridge, canal];
  recomputeConnectivityAndMetrics(st);
  assert.equal(st.metrics.waterSupply, water);
  assert.ok(relocatePlacedElement(st, bridge, 2, 0));
  assert.equal(bridge.waterUnderlay, canal);
  assert.ok(st.elements.includes(original));
  removePlacedElements(st, new Set([bridge.id]));
  assert.deepEqual(new Set(st.elements), new Set([original, canal]));
});

test("locked routes stay locked over water and auto-bridges use the price of the span", () => {
  const st = createInitialGameState("real");
  st.elements.push(piece("rivers", 0, 0));
  assert.equal(planConstruction(st, defs.roads, 0, 0, 1, 0).valid, false);
  st.highestStageReached = 6;
  assert.equal(planConstruction(st, defs.freeways, 0, 0, 1, 0).valid, false);
  st.money = defs.roads.cost;
  const plan = planConstruction(st, defs.roads, 0, 0, 1, 0);
  assert.equal(plan.valid, false);
  assert.ok(plan.def.cost > st.money);
  st.money = plan.def.cost;
  assert.equal(planConstruction(st, defs.roads, 0, 0, 5, 0).level, 1);
});

test("a grade-separated crossing connects straight through on each level", () => {
  const st = createInitialGameState("real");
  const center = piece("over_passes", 0, 0);
  const house = piece("house", -2, 0), shop = piece("shops", 0, 2);
  st.elements = [center, piece("over_passes", -1, 0), piece("over_passes", 1, 0), piece("roads", 0, -1), piece("roads", 0, 1), house, shop];
  const profile = networkRoadProfile(center.defId, getNetworkConnMask(st.elements, center));
  assert.equal(profile?.elevatedAxis, 1);
  recomputeConnectivityAndMetrics(st);
  assert.ok(!house.connected && !shop.connected);
  st.elements.push(piece("roads", -1, 1));
  recomputeConnectivityAndMetrics(st);
  assert.ok(house.connected && shop.connected);
});

test("rail activates at a train facility, without attaching to bus stops or housing", () => {
  const rail = piece("train_tracks", 1, 1), track = piece("train_tracks", 1, 2);
  const bus = piece("bus_stops", 0, 1);
  assert.equal(getNetworkConnMask([rail, track, bus], rail) & 8, 0);
  assert.equal(getConnectedRailCoordSet([rail, track, bus]).size, 0);
  const station = piece("train_stops", 2, 1);
  assert.equal(getNetworkConnMask([rail, track, station], rail) & 2, 2);
  assert.equal(getConnectedRailCoordSet([rail, track, station]).size, 2);
});

test("legacy saves rebuild their own synergy links even with the same layout and fresh object IDs", () => {
  const st = createInitialGameState("god");
  st.elements = [piece("farms", 0, 0), piece("wells", 1, 0), piece("farm_houses", 0, 1)];
  recomputeConnectivityAndMetrics(st);
  assert.ok(st.elements[0].synergies?.includes("irrigated"));
  const next = structuredClone(st);
  next.elements.forEach(e => {e.id = "other-" + e.id; delete e.synergies;});
  recomputeConnectivityAndMetrics(next);
  assert.deepEqual(next.elements[0].synergies, st.elements[0].synergies);
});
