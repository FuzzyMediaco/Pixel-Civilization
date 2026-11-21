import assert from "node:assert/strict";
import test from "node:test";
import { persistMode, resumeIsland } from "../src/game/activeIsland";
import { siteOf } from "../src/game/cityEconomy";
import { createExampleWorld } from "../src/game/exampleWorlds";
import { HISTORICAL_WONDERS } from "../src/game/historicalCatalog";
import { createInitialGameState, type GameState } from "../src/game/simulation";

test("Meridian's eight monuments, staffed herds and offshore ferry operate in Real mode", () => {
  const city = createExampleWorld("meridian-fair", "real");
  const site = (id: string) => {
    const el = city.elements.find(e => e.defId === id);
    assert.ok(el?.connected, id);
    return el;
  };
  const monuments = HISTORICAL_WONDERS.map(w => site(w.id));
  assert.equal(monuments.length, 8);
  assert.deepEqual([...new Set(monuments.map(el => el.level))].sort(), [1, 2, 3, 4, 5]);
  for (const id of ["dairy_farm", "cattle_ranch", "poultry_farm", "horse_ranch", "spaceport", "teleportation_depot"])
    assert.ok(siteOf(city, site(id)).workers >= 1, id);
  const ring = site("ocean_habitat_ring");
  const route = city.mobility?.lines.find(l => l.mode === "ferry" && l.stops.includes(ring.id));
  assert.ok(route?.enabled && !route.blocked);
  assert.ok(route.delivered > 0);
  const ops = city.projectOps;
  assert.ok(ops?.flights.some(f => f.kind === "rocket"));
  assert.ok(city.elements.some(e => e.defId === "teleportation_depot" && (ops.completed[e.id] ?? 0) > 0));
  assert.ok(city.metrics.waterSupply >= city.metrics.waterDemand);
  assert.ok(city.metrics.powerSupply >= city.metrics.powerDemand);
  assert.ok(city.metrics.wasteCapacity >= city.metrics.wasteDemand);
});

test("God and Real tours resume their own edits and preserve the player's ordinary island", t => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  const home = createInitialGameState("real");
  const stage = (city: GameState, number: number) => { city.activePlaySec = number; assert.ok(persistMode(city)); };
  stage(home, 101);
  const god = createInitialGameState("god");
  god.exampleWorldId = "meridian-fair";
  god.exampleReturnMode = "real";
  stage(god, 202);
  const real = { ...home, exampleWorldId: god.exampleWorldId, exampleReturnMode: god.exampleReturnMode };
  real.exampleViewpoint = 3;
  stage(real, 303);
  assert.equal(resumeIsland("#world=meridian-fair&mode=real&view=1").exampleViewpoint, 1);
  assert.equal(resumeIsland("#world=meridian-fair&mode=real&view=99").exampleViewpoint, 3);
  assert.equal(resumeIsland("#world=meridian-fair&mode=real").exampleViewpoint, 3);
  assert.equal(resumeIsland().activePlaySec, 303);
  assert.equal(resumeIsland("#world=meridian-fair").activePlaySec, 202);
  assert.equal(resumeIsland("#world=meridian-fair&mode=real").activePlaySec, 303);
  assert.equal(values.has("pixel_civ_save_v1_example-meridian-fair"), true);
  assert.equal(JSON.parse(values.get("pixel_civ_save_v1_real")!).activePlaySec, 101);
});
