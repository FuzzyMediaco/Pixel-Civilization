import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_QUICK_DRAWER_IDS,
  createDefaultQuickDrawerPrefs,
  createEmptyQuickDrawerHabits,
  moveManualDrawerAction,
  recommendQuickDrawerActions,
  recordQuickDrawerAction,
  toggleManualDrawerAction,
  type QuickDrawerContext,
} from "../src/game/adaptiveQuickDrawer";
import { createDefaultQuickMenuPrefs } from "../src/game/quickMenuPrefs";
import { createInitialGameState } from "../src/game/simulation";

function makeCtx(overrides?: Partial<QuickDrawerContext>): QuickDrawerContext {
  return {
    quickBuildMode: "adaptive",
    quickMenuPrefs: createDefaultQuickMenuPrefs(),
    bulkSelectMode: false,
    canManualEdit: true,
    simSpeed: 1,
    activeHeatmap: "none",
    autoSpin: false,
    canUndo: true,
    ...overrides,
  };
}

test("Quick Drawer catalog contains rich simplified features and starts with Bulk Select, 3 Quick Menus, Speed, and contextual utility", () => {
  assert.ok(ALL_QUICK_DRAWER_IDS.length >= 22, "Catalog should cover features and settings broadly");

  const state = createInitialGameState("real");
  const items = recommendQuickDrawerActions(state, makeCtx(), createEmptyQuickDrawerHabits(), 6);
  assert.equal(items.length, 6, "Should drop down exactly 6 floating buttons");

  const ids = items.map((i) => i.id);
  assert.equal(ids[0], "bulk_select", "Default #1 must be Bulk Select");
  assert.ok(ids.includes("mode_smart"), "Default must include Smart Build");
  assert.ok(ids.includes("mode_quick"), "Default must include Quick Build");
  assert.ok(ids.includes("mode_exact"), "Default must include Exact Build");
  assert.ok(ids.includes("sim_speed"), "Default must include Simulation Speed (nested off top bar)");
  assert.ok(ids.includes("undo"), "Default 6th slot surfaces Undo when edits can be undone");
});

test("Quick Drawer adapts live to crises (power shortfall, paused state, Survival disrepair)", () => {
  const state = createInitialGameState("survival");
  state.metrics.powerDemand = 100;
  state.metrics.powerSupply = 10;

  let habits = createEmptyQuickDrawerHabits();
  for (let i = 0; i < 6; i++) habits = recordQuickDrawerAction(habits, "heatmap_power");
  for (let i = 0; i < 4; i++) habits = recordQuickDrawerAction(habits, "save_slots");

  const items = recommendQuickDrawerActions(state, makeCtx({ simSpeed: 0, canUndo: false }), habits, 6);
  const ids = items.map((i) => i.id);

  assert.ok(ids.includes("sim_speed"), "Paused game must keep Simulation Speed visible");
  assert.ok(ids.includes("heatmap_power"), "Power shortfall + usage should surface Power Map");
});

test("Quick Drawer fully adapts all 6 slots to learned player feature & settings habits over time", () => {
  const state = createInitialGameState("god");
  let habits = createEmptyQuickDrawerHabits();

  const favorites = [
    "weather_cycle",
    "day_night",
    "save_slots",
    "handbook",
    "camera_orbit",
    "quick_edit_order",
  ] as const;

  for (let round = 0; round < 5; round++) {
    for (const id of favorites) {
      habits = recordQuickDrawerAction(habits, id);
    }
  }

  const items = recommendQuickDrawerActions(state, makeCtx({ canUndo: false }), habits, 6);
  const ids = items.map((i) => i.id);

  for (const fav of favorites) {
    assert.ok(
      ids.includes(fav),
      `Expected heavily used catalog item '${fav}' to adapt into top 6, got: ${ids.join(", ")}`,
    );
  }
});

test("Quick Drawer Manual mode preserves exact pinned slots and order across all 5 game modes", () => {
  let prefs = createDefaultQuickDrawerPrefs();
  prefs = { ...prefs, mode: "manual", manualIds: ["sim_speed", "handbook", "camera_orbit", "weather_cycle"] };

  // Toggle on a 5th action and reorder
  prefs = toggleManualDrawerAction(prefs, "save_slots");
  assert.deepEqual(prefs.manualIds, ["sim_speed", "handbook", "camera_orbit", "weather_cycle", "save_slots"]);
  prefs = moveManualDrawerAction(prefs, "save_slots", -1);
  assert.deepEqual(prefs.manualIds, ["sim_speed", "handbook", "camera_orbit", "save_slots", "weather_cycle"]);

  // Works in every mode: God, Real, Survival, Idle, Manager
  for (const mode of ["god", "real", "survival", "idle", "manager"] as const) {
    const state = createInitialGameState(mode);
    const canManualEdit = mode !== "idle" && mode !== "manager";
    const items = recommendQuickDrawerActions(
      state,
      makeCtx({ canManualEdit }),
      createEmptyQuickDrawerHabits(),
      6,
      prefs,
    );
    assert.deepEqual(
      items.map((i) => i.id),
      prefs.manualIds,
      `Manual mode in '${mode}' must return exact pinned order`,
    );
    const weatherItem = items.find((i) => i.id === "weather_cycle");
    assert.equal(
      Boolean(weatherItem?.disabled),
      mode !== "god",
      `weather_cycle should be enabled in god mode and disabled in ${mode}`,
    );
  }

  // Min-1 safety guard: removing down to 1 keeps the last item
  let single = { mode: "manual" as const, manualIds: ["sim_speed" as const] };
  single = toggleManualDrawerAction(single, "sim_speed");
  assert.deepEqual(single.manualIds, ["sim_speed"], "Must keep at least 1 pinned action");
});

test("Quick Sculpt (mode_sculpt) is available in the top-right drawer catalog and active when selected", () => {
  assert.ok(ALL_QUICK_DRAWER_IDS.includes("mode_sculpt"));
  const state = createInitialGameState("god");
  const items = recommendQuickDrawerActions(state, makeCtx({ quickBuildMode: "sculpt" }), createEmptyQuickDrawerHabits(), 7);
  const sculpt = items.find((i) => i.id === "mode_sculpt");
  assert.ok(sculpt, "Quick Sculpt should appear in the 7-slot top-right drawer");
  assert.equal(sculpt.active, true);
  assert.equal(sculpt.label, "Quick Sculpt");
});

