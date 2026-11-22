import assert from "node:assert/strict";
import test from "node:test";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, ELEMENTS } from "../src/game/catalog";
import { NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS } from "../src/game/expansionSafetyMilitaryCommerce";
import { createInitialGameState } from "../src/game/simulation";
import {
  applyManagerChoice,
  createAutoCivProfile,
  generateManagerDecision,
  runAutoCivStep,
} from "../src/game/autoCivilization";
import { enforceModeBalance, registerCustomElement, removeCustomElement } from "../src/game/customElements";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { EXTRA_PLAYBOOK_CHAPTERS, PLAYBOOK_MODES, getModeChapterBrief } from "../src/handbook/modePlaybook";

test("all 58 safety, military, and commerce expansion elements are registered and build valid 3D voxels", () => {
  assert.equal(NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS.length, 58);
  assert.ok(ELEMENTS.length >= 270, `Expected >= 270 catalog elements, got ${ELEMENTS.length}`);

  for (const entry of NEW_SAFETY_MILITARY_COMMERCE_ELEMENTS) {
    const def = ELEMENT_BY_ID[entry.id];
    assert.ok(def, `Missing catalog entry for ${entry.id}`);
    const [sx, sz] = entry.footprints[0];
    const ctx = buildDesignVoxels(def, 1, 0, sx, sz, 0);
    assert.ok(ctx.v.size > 10, `Expected non-empty voxel build for ${entry.id}, got ${ctx.v.size}`);
  }
});

test("Idle & Manager algorithmic planner grows connected roads and structures cleanly", () => {
  const state = createInitialGameState("idle");
  const profile = createAutoCivProfile(4242);

  let acts = 0;
  for (let i = 0; i < 18; i++) {
    const out = runAutoCivStep(state, profile, i + 1);
    if (out.didAct) acts++;
  }
  assert.ok(acts >= 8, `Expected at least 8 autonomous actions, got ${acts}`);
  assert.ok(state.elements.length >= 8, `Expected >= 8 placed elements, got ${state.elements.length}`);

  const roads = state.elements.filter((e) => ELEMENT_BY_ID[e.defId]?.isRoadNetwork);
  const nonRoads = state.elements.filter((e) => !ELEMENT_BY_ID[e.defId]?.isRoadNetwork);
  assert.ok(roads.length > 0, "Expected algorithmic planner to lay roads");
  assert.ok(nonRoads.length > 0, "Expected algorithmic planner to place buildings");

  // Manager Mode executive decision & choice execution
  const mgr = createInitialGameState("manager");
  for (let i = 0; i < 5; i++) runAutoCivStep(mgr, profile, i + 1);
  const decision = generateManagerDecision(mgr, profile, 6);
  assert.ok(decision, "Expected Manager Mode to generate a decision card");
  assert.ok(decision!.choices.length >= 2, "Expected at least 2 executive choices");
  const applied = applyManagerChoice(mgr, profile, decision!.choices[0], 7);
  assert.ok(applied.summary.length > 0, "Expected manager choice to return a summary");
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
  assert.equal(EXTRA_PLAYBOOK_CHAPTERS.length, 3);
  for (const m of PLAYBOOK_MODES) {
    const brief = getModeChapterBrief("safety_military", m.id);
    assert.ok(brief.goal.length > 10 && brief.checklist.length >= 2);
  }
});
