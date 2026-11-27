import assert from "node:assert/strict";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, ELEMENTS } from "../src/game/catalog";
import { NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS } from "../src/game/expansionSafetyMilitaryCommerce";
import { createInitialGameState, stepSimulation } from "../src/game/simulation";
import { getTerrainCell } from "../src/game/terrain";
import { getTravelNetwork, type Point } from "../src/game/travelNetwork";
import {
  applyManagerChoice,
  createAutoCivProfile,
  generateManagerDecision,
  runAutoCivStep,
} from "../src/game/autoCivilization";
import { enforceModeBalance, registerCustomElement, removeCustomElement } from "../src/game/customElements";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { EXTRA_PLAYBOOK_CHAPTERS, PLAYBOOK_MODES, getModeChapterBrief } from "../src/handbook/modePlaybook";

test("all 60 safety, military, and commerce expansion elements are registered and build valid 3D voxels", () => {
  assert.equal(NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS.length, 60);
  assert.ok(ELEMENTS.length >= 270, `Expected >= 270 catalog elements, got ${ELEMENTS.length}`);

  for (const entry of NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS) {
    const def = ELEMENT_BY_ID[entry.id];
    assert.ok(def, `Missing catalog entry for ${entry.id}`);
    const [sx, sz] = entry.footprints[0];
    const ctx = buildDesignVoxels(def, 1, 0, sx, sz, 0);
    assert.ok(ctx.v.size > 10, `Expected non-empty voxel build for ${entry.id}, got ${ctx.v.size}`);
  }
});

test("Idle builds a growing city with reachable services and occupied islands across finished bridges", () => {
  const state = createInitialGameState("idle");
  const profile = createAutoCivProfile(4242);
  state.weatherLocked = state.timeLocked = true;
  for (let i = 1; i <= 225; i++) {
    runAutoCivStep(state, profile, i);
    stepSimulation(state, 1.5, true);
    if (i === 16) {
      assert.ok(state.population > 0);
      assert.ok(state.metrics.connectedHouses >= 2);
      assert.ok(state.metrics.powerSupply > 0 && state.metrics.waterSupply > 0);
      assert.ok(state.metrics.foodSupply > 0 && state.metrics.wasteCapacity > 0);
    }
  }
  const lots = state.elements.filter(e => !ELEMENT_BY_ID[e.defId].isNetwork);
  const groceryStores = lots.filter(e => e.defId === "grocery_store");
  assert.ok(lots.length >= 90 && new Set(lots.map(e => e.defId)).size >= 40);
  assert.ok(groceryStores.length < lots.length / 8);
  assert.ok(state.highestStageReached >= 7);
  assert.ok(new Set(lots.map(e => [Math.floor(e.gx / 12), Math.floor(e.gz / 12)].join())).size >= 10);
  const runs = new Map<string, string[]>();
  for (const [coord, span] of Object.entries(state.infrastructure?.spans ?? {})) {
    if (span.end) runs.set(span.run, [...(runs.get(span.run) ?? []), coord]);
  }
  assert.ok(runs.size >= 2, "Expected at least two island crossings");
  const network = getTravelNetwork(state);
  for (const ends of runs.values()) {
    assert.equal(ends.length, 2);
    const [a,b] = ends.map(end=>end.split(",").map(Number) as Point);
    assert.ok(network.path([a],[b],"bus"), "A vehicle must be able to drive across the bridge");
    for (const [x,z] of [a,b]) assert.equal(getTerrainCell(state,x,z).kind,"land");
  }
  assert.ok(lots.some(e => e.connected && Math.hypot(e.gx,e.gz) > 36));
});

test("Manager can approve a real lot or delegate and resume the same seeded planner after reload", () => {
  const profile = createAutoCivProfile(77);
  const state = createInitialGameState("manager");
  for (let i = 1; i <= 16; i++) {
    if (i % 3 !== 0) runAutoCivStep(state, profile, i);
    else {
      const decision = generateManagerDecision(state, profile, i);
      const choice = decision.choices.find(c => c.action.kind === "build") ?? decision.choices.find(c => c.id === "delegate")!;
      const placed = applyManagerChoice(state, profile, choice, i);
      assert.ok(placed.didAct);
      if (choice.action.kind === "build") assert.equal(placed.placedDefId, choice.action.defId);
    }
    stepSimulation(state,1.5,true);
  }
  assert.ok(state.metrics.connectedHouses > 0);
  const other = createInitialGameState("idle");
  runAutoCivStep(other, createAutoCivProfile(4242), 1);
  assert.notDeepEqual(other.elements.map(e=>[e.gx,e.gz]), state.elements.slice(0,6).map(e=>[e.gx,e.gz]));
  const reloaded = structuredClone(state);
  const decision = generateManagerDecision(state, profile, 17);
  const choice = decision.choices.find(c => c.id === "delegate")!;
  const original = applyManagerChoice(state, profile, choice, 17);
  const resumed = applyManagerChoice(reloaded, createAutoCivProfile(22), choice, 1);
  assert.deepEqual(resumed, original);
  assert.deepEqual(reloaded.autoCiv, {seed:77,turn:17});
});

test("PixBuilder enforceModeBalance respects God vs Real vs Survival limits and custom element registration", () => {
  const overpoweredInput = {
    name: "Mega Orbital Citadel",
    description: "Colossal futuristic tower.",
    category: "landmarks" as const,
    domain: "land" as const,
    footprintCells: 2 as const,
    cost: 50,
    popBase: 500,
    jobs: 400,
    power: 400,
    military: 120,
    boxes: [{ x0: -4, y0: 1, z0: -4, x1: 4, y1: 12, z1: 4, color: "stone" }],
  };

  const godRes = enforceModeBalance(overpoweredInput, "god");
  const realRes = enforceModeBalance(overpoweredInput, "real");
  const survRes = enforceModeBalance(overpoweredInput, "survival");

  assert.equal(godRes.spec.popBase, 500);
  assert.ok(realRes.spec.popBase < godRes.spec.popBase, "Real mode should clamp overpowered popBase");
  assert.ok(survRes.spec.popBase < realRes.spec.popBase, "Survival mode should clamp popBase tighter than Real mode");
  assert.ok(survRes.spec.cost > 50, "Survival mode should raise artificially cheap costs");
  assert.ok(survRes.adjustments.length > 0, "Survival clamping should report balance notes");

  // Register and verify live voxel generation, then clean up so ELEMENTS stays pristine
  const def = registerCustomElement(realRes.spec, false);
  try {
    const ctx = buildDesignVoxels(def, 1, 0, 2, 2, 0);
    assert.ok(ctx.v.size > 20, "Expected custom voxel blueprint to produce voxels");
  } finally {
    removeCustomElement(def.id);
  }
});

test("Mode-specialized Playbook covers all 5 game modes and preserves new chapters", () => {
  assert.equal(PLAYBOOK_MODES.length, 5);
  assert.equal(EXTRA_PLAYBOOK_CHAPTERS.length, 4);
  for (const m of PLAYBOOK_MODES) {
    const brief = getModeChapterBrief("safety_military", m.id);
    assert.ok(brief.goal.length > 10 && brief.checklist.length >= 2);
  }
});
