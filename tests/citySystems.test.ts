import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { powerOutputFactor, rushHourFactor, roadCapacity, transitRelief } from "../src/game/cityDynamics";
import { buildDesignAsset } from "../src/game/voxelArchitect";
import { getTileTerrainKind, createInitialGameState, planConstruction } from "../src/game/simulation";

test("sun, wind, rain and rush hour independently change city outputs", () => {
  assert.ok(powerOutputFactor("solar", 13, "clear", 1) > powerOutputFactor("solar", 13, "storm", 1));
  assert.ok(powerOutputFactor("solar", 13, "clear", 1) > powerOutputFactor("solar", 1, "clear", 1));
  assert.ok(powerOutputFactor("wind", 13, "clear", 2) > powerOutputFactor("wind", 13, "clear", 0.5));
  assert.ok(powerOutputFactor("hydro", 13, "rain", 1) > powerOutputFactor("hydro", 13, "clear", 1));
  assert.ok(rushHourFactor(8) > rushHourFactor(12));
  assert.ok(rushHourFactor(17.75) > rushHourFactor(2));
  assert.ok(roadCapacity(ELEMENT_BY_ID.highways, 4) > roadCapacity(ELEMENT_BY_ID.roads, 1));
  assert.ok(transitRelief(ELEMENT_BY_ID.bus_stops, 3) > transitRelief(ELEMENT_BY_ID.bus_stops, 1));
});

test("a small legacy lot preserves the complete wheel and every moving part", () => {
  const d = ELEMENT_BY_ID.the_london_eye;
  const full = buildDesignAsset(d, 5, 2, 4, 4, 0);
  const small = buildDesignAsset(d, 5, 2, 1, 1, 0);
  assert.equal(small.voxelCount, full.voxelCount);
  assert.equal(small.baseGeo.getAttribute("position").count, full.baseGeo.getAttribute("position").count);
  assert.equal(small.rotors?.length, full.rotors?.length);
  assert.ok(small.rotors?.length);
  assert.ok(small.topY < full.topY);
  for (const a of [full, small]) { a.baseGeo.dispose(); a.rotors?.forEach(r => r.geo.dispose()); }
});

test("sea-facing placement respects the player's heading in open water", () => {
  const st = createInitialGameState("god");
  assert.equal(getTileTerrainKind(-31, -31), "water");
  for (const id of ["docks", "water_pumping_station"]) {
    const plan = planConstruction(st, ELEMENT_BY_ID[id], -31, -31, 1, 3);
    assert.ok(plan.valid);
    assert.equal(plan.rotation, 3);
  }
});
