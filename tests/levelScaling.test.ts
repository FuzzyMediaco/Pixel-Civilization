import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENTS, ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { elementLevelStats, upkeepFor, type ElementLevelStats } from "../src/game/cityDynamics";
import { siteOf, pondCisternCapacity } from "../src/game/cityEconomy";
import { levelMultiplier, scaledRadius, type LevelCurve } from "../src/game/levelScaling";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics as recalc,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";

const LEVELS = [1, 2, 3, 4, 5];
const CURVES: LevelCurve[] = [
  "output", "crop", "retail", "draw", "trips", "radius", "reach", "storage", "amenity", "pollution", "desirability", "upkeep",
];

test("every level curve starts at 1 and rises strictly from Lv.1 to Lv.5; radii grow sublinearly", () => {
  for (const curve of CURVES) {
    const values = LEVELS.map((l) => levelMultiplier(curve, l));
    assert.equal(values[0], 1, curve);
    for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `${curve} Lv${i}→Lv${i + 1}: ${values}`);
  }
  assert.deepEqual(LEVELS.map((l) => levelMultiplier("output", l)), [1, 2, 4, 8, 16]);
  // Coverage radii must grow far slower than outputs: at most 2x the distance at Lv.5.
  assert.ok(levelMultiplier("radius", 5) <= 2 && levelMultiplier("radius", 5) < levelMultiplier("output", 5) / 4);
  // Running costs rise with level so a high level is not free.
  assert.ok(levelMultiplier("upkeep", 5) > 4 && levelMultiplier("pollution", 5) > 2);
  // Out-of-range levels clamp instead of exploding (roads reach Lv.11).
  assert.equal(levelMultiplier("output", 11), 16);
  assert.equal(levelMultiplier("output", 0), 1);
  assert.equal(scaledRadius(10, 5), 20);
});

const BENEFITS: (keyof ElementLevelStats)[] = [
  "population", "jobs", "power", "water", "waste", "food", "education", "recreation",
  "government", "police", "military", "policeRadius", "fireRadius", "income",
];
const ALL_KEYS: (keyof ElementLevelStats)[] = [
  ...BENEFITS, "powerDraw", "waterDraw", "nuisanceRadius", "upkeep", "trips",
];

test("every benefit-providing element's contribution never drops and its primary metric strictly rises Lv.1→Lv.5", () => {
  let providers = 0;
  for (const def of ELEMENTS) {
    if (def.isNetwork) continue;
    const rows = LEVELS.map((l) => elementLevelStats(def, l));
    for (const key of ALL_KEYS)
      for (let i = 1; i < rows.length; i++)
        assert.ok(rows[i][key] >= rows[i - 1][key], `${def.id}.${key} drops at Lv${i + 1}: ${rows.map((r) => r[key])}`);
    // Emitters pollute more and absorbers clean more as they grow.
    for (let i = 1; i < rows.length; i++) assert.ok(Math.abs(rows[i].pollution) >= Math.abs(rows[i - 1].pollution), def.id);
    const primary = BENEFITS.find((key) => rows[0][key] > 0);
    if (!primary) continue;
    providers++;
    for (let i = 1; i < rows.length; i++)
      assert.ok(rows[i][primary] > rows[i - 1][primary], `${def.id}.${primary} flat at Lv${i + 1}: ${rows.map((r) => r[primary])}`);
    // Every benefit the element advertises grows, not just the headline one.
    for (const key of BENEFITS)
      if (rows[0][key] > 0) assert.ok(rows[4][key] > rows[0][key], `${def.id}.${key} does not scale`);
  }
  assert.ok(providers > 150, `expected the bulk of the catalog to provide something, got ${providers}`);
});

test("named owner examples scale: farms, landfills, hydro dams, nuclear plants and malls", () => {
  const at = (id: string, l: number) => elementLevelStats(ELEMENT_BY_ID[id], l);
  assert.ok(at("farms", 5).food > at("farms", 1).food * 16);
  assert.equal(at("landfill", 5).waste, at("landfill", 1).waste * 16);
  assert.equal(at("hydro_electric_power_plants", 5).power, at("hydro_electric_power_plants", 1).power * 16);
  assert.equal(at("nuclear_power_plants", 5).power, at("nuclear_power_plants", 1).power * 16);
  const mall1 = at("malls", 1), mall5 = at("malls", 5);
  for (const key of ["jobs", "recreation", "food", "income"] as const) assert.ok(mall5[key] > mall1[key] * 10, key);
  // Higher levels cost more to run.
  assert.ok(upkeepFor(ELEMENT_BY_ID.nuclear_power_plants, 5) > 5 * upkeepFor(ELEMENT_BY_ID.nuclear_power_plants, 1));
  assert.ok(pondCisternCapacity(5) > pondCisternCapacity(4));
});

function put(s: GameState, defId: string, gx: number, level: number, south = false): PlacedElement {
  const [spanX, spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[defId], level);
  const p: PlacedElement = {
    id: defId + "@" + gx, defId, gx, gz: south ? 1 : -spanZ, spanX, spanZ, level,
    rotation: south ? 2 : 0, variant: 0, connected: false, disrepair: false, onFire: false,
    hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0, animKind: "place", animProgress: 0,
  };
  s.elements.push(p);
  return p;
}
function town(id: string, level: number) {
  const s = createInitialGameState("god");
  s.timeLocked = s.weatherLocked = true;
  for (let i = -14; i < 16; i++) Object.assign(put(s, "roads", i, 1), { gz: 0, rotation: 0 });
  // A large, fully settled workforce so staffing never caps a high-level site.
  for (let x = -14; x < 14; ) x += put(s, "house", x, 5, true).spanX;
  const site = put(s, id, 2, level);
  recalc(s);
  s.growthPool = 1e9;
  recalc(s);
  return { s, site };
}

test("the live simulation reports a larger city-wide metric for each level of a utility, service or park", () => {
  const cases: [string, (s: GameState) => number][] = [
    ["wells", (s) => s.metrics.waterSupply],
    ["landfill", (s) => s.metrics.wasteCapacity],
    ["elementary_school", (s) => s.metrics.educationSupply],
    ["little_parks", (s) => s.metrics.recreationSupply],
    ["coal_powerplants", (s) => s.metrics.powerSupply],
  ];
  for (const [id, metric] of cases) {
    assert.ok(ELEMENT_BY_ID[id], id);
    const values = LEVELS.map((l) => {
      const { s, site } = town(id, l);
      assert.ok(site.connected, `${id} Lv${l} should be road-connected`);
      return metric(s);
    });
    for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `${id}: ${values}`);
  }
});

test("the economy's farm harvest, grocer throughput and mall earnings rise with level", () => {
  const cases: [string, (a: ReturnType<typeof siteOf>) => number][] = [
    ["farms", (a) => a.yieldRate],
    ["grocery_store", (a) => a.retail],
    ["malls", (a) => a.retail],
    ["malls", (a) => a.exportRate],
    ["banks", (a) => a.exportRate],
  ];
  for (const [id, read] of cases) {
    const values = LEVELS.map((l) => {
      const { s, site } = town(id, l);
      return read(siteOf(s, site));
    });
    for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `${id}: ${values}`);
  }
});
