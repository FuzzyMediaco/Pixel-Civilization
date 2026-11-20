import assert from "node:assert/strict";
import { ELEMENT_BY_ID, getElementMaxLevel, getRoadLaneCount } from "../src/game/catalog";
import { analyzeFarmNetworks, getFarmAdjacencyMask } from "../src/game/farmNetworks";
import { analyzeDistrictSynergies, getDistrictEdgeMasks } from "../src/game/districtSynergies";
import { analyzeTraffic } from "../src/game/trafficModel";
import {
  createInitialGameState, recomputeConnectivityAndMetrics,
  upgradeElementDirect, type PlacedElement,
} from "../src/game/simulation";

function place(id: string, defId: string, gx: number, gz: number, level = 1): PlacedElement {
  return {
    id, defId, gx, gz, spanX: 1, spanZ: 1, level, rotation: 0, variant: 0,
    connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
    maintTimerSec: 0, disrepair: false, onFire: false, animProgress: 0, animKind: "place",
  };
}

const roadDef = ELEMENT_BY_ID.roads;
assert.equal(getElementMaxLevel(roadDef), 11, "Roads must have 10 upgrades");
assert.equal(getElementMaxLevel(ELEMENT_BY_ID.school), 5, "Schools remain five levels");
assert.equal(getRoadLaneCount(roadDef, 1), 2, "Starter road is two-lane");
assert.ok(getRoadLaneCount(ELEMENT_BY_ID.highways, 1) > getRoadLaneCount(roadDef, 1));
assert.ok(getRoadLaneCount(ELEMENT_BY_ID.freeways, 1) > getRoadLaneCount(ELEMENT_BY_ID.highways, 1));

const real = createInitialGameState("real");
real.elements.push(place("road1", "roads", 0, 0), place("house1", "house", 1, 0));
recomputeConnectivityAndMetrics(real);
assert.equal(real.elements[1].connected, true, "One adjacent road must connect a building");
assert.equal(real.metrics.connectedHouses, 1);

const roadGod = createInitialGameState("god");
roadGod.elements.push(place("road2", "roads", 0, 0));
for (let level = 2; level <= 11; level++) {
  const prev = analyzeTraffic(roadGod.elements).capacity;
  const res = upgradeElementDirect(roadGod, "road2");
  assert.equal(res.ok, true, res.reason);
  assert.equal(roadGod.elements[0].level, level);
  assert.ok(analyzeTraffic(roadGod.elements).capacity > prev, `Level ${level} must increase capacity`);
}
assert.equal(upgradeElementDirect(roadGod, "road2").ok, false, "11 is maximum level");

const farm = createInitialGameState("real");
// Compact 10x10 plot grid stays inside the actual 64x64 game world.
farm.highestStageReached = 20;
farm.elements.push(place("street", "roads", -7, -5), place("anchor", "plantations", -6, -5));
for (let i = 0; i < 100; i++) {
  const gx = -5 + (i % 10);
  const gz = -5 + Math.floor(i / 10);
  farm.elements.push(place(`field${i}`, "vegetable_fields", gx, gz));
}
assert.ok(getFarmAdjacencyMask(farm.elements, farm.elements[2]) > 0, "Field paths must connect visually");
recomputeConnectivityAndMetrics(farm);
assert.equal(farm.metrics.farmModuleCount, 100);
assert.equal(farm.elements.find(el => el.id === "field99")?.connected, true);
const network = analyzeFarmNetworks(farm.elements, new Set(["anchor"]));
assert.equal(network.ownerByModuleId.size, 100);
assert.equal(network.moduleCountByAnchorId.get("anchor"), 100);
assert.ok((network.multiplierByAnchorId.get("anchor") ?? 1) > 4, "Large fields give nonlinear yield");

const orphan = createInitialGameState("real");
orphan.elements.push(place("orphanField", "fields", 5, 5));
recomputeConnectivityAndMetrics(orphan);
assert.equal(orphan.elements[0].connected, false, "Isolated field requires a connected anchor");

const bonuses = createInitialGameState("god");
bonuses.elements.push(
  place("hs", "high_school", 0, 0), place("sport", "sports_field", 1, 0),
  place("dairy", "dairy_farm", 5, 0), place("grain", "grain_farm", 6, 0),
  place("uni", "university", 10, 0), place("research", "research_institute", 11, 0),
  place("orchard", "orchards", 15, 0), place("hive", "apiary", 16, 0),
);
recomputeConnectivityAndMetrics(bonuses);
const d = analyzeDistrictSynergies(bonuses.elements);
assert.deepEqual(new Set(d.active.map(a => a.kind)),
  new Set(["athletic_campus", "feed_production", "innovation_district", "orchard_pollination"]));
assert.ok((d.educationMultiplier.get("hs") ?? 1) > 1);
assert.ok((d.foodMultiplier.get("dairy") ?? 1) > 1);
assert.ok((d.incomeMultiplier.get("uni") ?? 1) > 1);
const edgeMasks = getDistrictEdgeMasks(bonuses.elements, d.active);
assert.equal(edgeMasks.get("hs"), 2, "School path should open east toward sports field");
assert.equal(edgeMasks.get("sport"), 8, "Sports path should open west toward school");

const noAdjacency = createInitialGameState("god");
noAdjacency.elements.push(place("u", "university", 0, 0), place("r", "research_institute", 2, 0));
recomputeConnectivityAndMetrics(noAdjacency);
assert.equal(analyzeDistrictSynergies(noAdjacency.elements).active.length, 0);

const twoAnchors = createInitialGameState("god");
twoAnchors.elements.push(place("a", "farms", 0, 0), place("f", "fields", 1, 0), place("b", "farms", 2, 0));
const owned = analyzeFarmNetworks(twoAnchors.elements, new Set(["a", "b"]));
assert.equal(owned.ownerByModuleId.size, 1, "Shared field cannot be double-counted");

console.log("Pixel Civilization expansion simulations: PASS");
