import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import {
  analyzeTileContext,
  createEmptyBuildHabits,
  recordBuildHabit,
  recommendInstantQuickElements,
  recommendQuickCategories,
  recommendQuickElements,
} from "../src/game/adaptiveQuickBuild";
import {
  GRID_MAX,
  GRID_MIN,
  createInitialGameState,
  getTileTerrainKind,
  isWaterTile,
  makeElementId,
  planConstruction,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";

function placeSimple(state: GameState, defId: string, gx: number, gz: number): PlacedElement {
  const def = ELEMENT_BY_ID[defId];
  assert.ok(def, `Missing def ${defId}`);
  const plan = planConstruction(state, def, gx, gz, 1, 0, false);
  const el: PlacedElement = {
    id: makeElementId(),
    defId: plan.valid ? plan.def.id : def.id,
    gx,
    gz,
    spanX: plan.valid ? plan.spanX : def.baseSpanX,
    spanZ: plan.valid ? plan.spanZ : def.baseSpanZ,
    rotation: plan.valid ? plan.rotation : 0,
    level: 1,
    variant: 0,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
  state.elements.push(el);
  recomputeConnectivityAndMetrics(state);
  return el;
}

function findWaterTile(state: GameState): [number, number] {
  for (let gx = GRID_MIN; gx <= GRID_MAX; gx++) {
    for (let gz = GRID_MIN; gz <= GRID_MAX; gz++) {
      if (getTileTerrainKind(gx, gz, state) === "water") return [gx, gz];
    }
  }
  throw new Error("No water tile found on initial map");
}

function findLandTile(state: GameState): [number, number] {
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      if (!isWaterTile(state.elements, gx, gz, state)) return [gx, gz];
    }
  }
  throw new Error("No land tile found near center");
}

test("Stage 1 on fresh island recommends 6 starter-appropriate categories including roads and housing", () => {
  const state = createInitialGameState("real");
  const [gx, gz] = findLandTile(state);
  const habits = createEmptyBuildHabits();

  const cats = recommendQuickCategories(state, gx, gz, habits, 6);
  assert.equal(cats.length, 6, "Should return 6 adaptive categories on land");

  const ids = cats.map((c) => c.category);
  assert.ok(ids.includes("roads_transit"), "Fresh island should suggest Roads & Transit");
  assert.ok(ids.includes("housing"), "Fresh island should suggest Homes");
  assert.equal(new Set(ids).size, 6, "All 6 categories should be unique");
});

test("Stage 1 on open water prioritizes maritime/bridges and excludes land-only categories like housing", () => {
  const state = createInitialGameState("god");
  const [wx, wz] = findWaterTile(state);
  const habits = createEmptyBuildHabits();

  const ctx = analyzeTileContext(state, wx, wz);
  assert.equal(ctx.isWater, true);

  const cats = recommendQuickCategories(state, wx, wz, habits, 6);
  assert.ok(cats.length >= 2, "Water tiles should offer at least maritime & bridges");
  const ids = cats.map((c) => c.category);
  assert.ok(!ids.includes("housing"), "Land-only housing must not be suggested on open water");
  assert.ok(ids.includes("maritime") || ids.includes("roads_transit"), "Water should prioritize maritime or bridges");

  // Stage 2 inside roads_transit on water should offer placeable water crossings (bridges)
  if (ids.includes("roads_transit")) {
    const roadEls = recommendQuickElements(state, "roads_transit", wx, wz, habits, 6);
    assert.ok(roadEls.length > 0, "Should suggest bridges/crossings on water");
    for (const item of roadEls) {
      const plan = planConstruction(state, item.def, wx, wz, 1, 0, false);
      assert.equal(plan.valid, true, `Suggested water element ${item.def.id} must be placeable at (${wx},${wz})`);
    }
  }
});

test("Stage 1 reacts urgently to power and water deficits in a growing city", () => {
  const state = createInitialGameState("real");
  state.money = 50000;
  state.currentStage = 4;
  const [cx, cz] = findLandTile(state);

  // Build a road and several homes so power & water demand spikes
  placeSimple(state, "roads", cx, cz);
  placeSimple(state, "roads", cx + 1, cz);
  placeSimple(state, "roads", cx + 2, cz);
  placeSimple(state, "house", cx, cz - 1);
  placeSimple(state, "house", cx + 1, cz - 1);
  placeSimple(state, "house", cx + 2, cz - 1);
  placeSimple(state, "cottages", cx, cz + 1);
  placeSimple(state, "cottages", cx + 1, cz + 1);

  // Ensure power & water deficit is active
  state.metrics.powerSupply = 0;
  state.metrics.powerDemand = 80;
  state.metrics.waterSupply = 0;
  state.metrics.waterDemand = 80;

  const cats = recommendQuickCategories(state, cx + 2, cz + 1, createEmptyBuildHabits(), 6);
  const top3 = cats.slice(0, 3).map((c) => c.category);
  assert.ok(
    top3.includes("power_waste") || top3.includes("water_util"),
    `Expected power_waste or water_util in top 3 during utility shortage, got: ${top3.join(", ")}`,
  );
  const powerCat = cats.find((c) => c.category === "power_waste");
  assert.ok(powerCat?.urgent, "Power category should be flagged urgent during power shortage");
});

test("Adaptive habits learn player category & element preferences and bubble them up", () => {
  const state = createInitialGameState("god");
  const [cx, cz] = findLandTile(state);
  placeSimple(state, "roads", cx, cz);

  const targetX = cx + 1;
  const targetZ = cz;
  const ctx = analyzeTileContext(state, targetX, targetZ);

  let habits = createEmptyBuildHabits();
  const churchDef = ELEMENT_BY_ID["churches"];
  assert.ok(churchDef);

  // Player repeatedly places Faith buildings in this context
  for (let i = 0; i < 6; i++) {
    habits = recordBuildHabit(habits, churchDef, ctx.contextTag);
  }

  const cats = recommendQuickCategories(state, targetX, targetZ, habits, 6);
  assert.ok(
    cats.some((c) => c.category === "faith"),
    `Learned player habit for Faith should surface faith in top 6, got: ${cats.map((c) => c.category).join(", ")}`,
  );

  const faithEls = recommendQuickElements(state, "faith", targetX, targetZ, habits, 6);
  assert.ok(faithEls.length > 0);
  assert.equal(faithEls[0].def.id, "churches", "Habit-learned element 'churches' should rank #1 in Faith Stage 2");
});

test("Stage 2 recommends rail elements next to train tracks and guarantees every suggestion fits the tile", () => {
  const state = createInitialGameState("god");
  const [cx, cz] = findLandTile(state);
  placeSimple(state, "train_tracks", cx, cz);

  const targetX = cx + 1;
  const targetZ = cz;
  const ctx = analyzeTileContext(state, targetX, targetZ);
  assert.equal(ctx.adjRail, true, "Adjacent tile should detect neighboring rail track");

  const transitEls = recommendQuickElements(state, "roads_transit", targetX, targetZ, createEmptyBuildHabits(), 6);
  assert.equal(transitEls.length, 6, "Should offer 6 roads & transit options in Stage 2");
  const topIds = transitEls.slice(0, 3).map((e) => e.def.id);
  assert.ok(
    topIds.some((id) => ELEMENT_BY_ID[id]?.isRailNetwork || id.includes("train") || id.includes("station")),
    `Expected rail-related element in top 3 beside tracks, got: ${topIds.join(", ")}`,
  );

  for (const item of transitEls) {
    const plan = planConstruction(state, item.def, targetX, targetZ, 1, 0, false);
    assert.equal(plan.valid, true, `Every Stage 2 element (${item.def.id}) must be spatially valid at target tile`);
  }
});

test("Stage 2 in police_military recommends fire/police coverage when neighborhood lacks protection", () => {
  const state = createInitialGameState("god");
  const [cx, cz] = findLandTile(state);
  placeSimple(state, "roads", cx, cz);
  placeSimple(state, "house", cx, cz - 1);
  placeSimple(state, "house", cx + 1, cz - 1);

  const targetX = cx + 1;
  const targetZ = cz;
  const ctx = analyzeTileContext(state, targetX, targetZ);
  assert.equal(ctx.needsLocalPolice, true);
  assert.equal(ctx.needsLocalFire, true);

  const safetyEls = recommendQuickElements(state, "police_military", targetX, targetZ, createEmptyBuildHabits(), 6);
  assert.equal(safetyEls.length, 6);
  const hasPolice = safetyEls.some((e) => (e.def.policeRadius ?? 0) > 0);
  const hasFire = safetyEls.some((e) => (e.def.fireRadius ?? 0) > 0);
  assert.ok(hasPolice, "Should include a police coverage element");
  assert.ok(hasFire, "Should include a fire coverage element");
});

test("Instant Smart (2-tap) on fresh island returns 6 diverse, spatially valid starter elements", () => {
  const state = createInitialGameState("real");
  const [gx, gz] = findLandTile(state);
  const picks = recommendInstantQuickElements(state, gx, gz, createEmptyBuildHabits(), 6);

  assert.equal(picks.length, 6, "Should offer 6 immediate elements on land");
  const categories = new Set(picks.map((p) => p.def.category));
  assert.ok(categories.size >= 5, `Instant picks should span diverse categories, got ${categories.size}`);
  assert.ok(picks.some((p) => p.def.isRoadNetwork), "Fresh island instant picks should include a road");
  assert.ok(picks.some((p) => p.def.category === "housing"), "Fresh island instant picks should include housing");

  for (const item of picks) {
    const plan = planConstruction(state, item.def, gx, gz, 1, 0, false);
    assert.equal(plan.valid, true, `Instant pick ${item.def.id} must be spatially placeable at (${gx},${gz})`);
  }
});

test("Instant Smart (2-tap) on open water returns valid water elements and excludes land-only homes", () => {
  const state = createInitialGameState("god");
  const [wx, wz] = findWaterTile(state);
  const picks = recommendInstantQuickElements(state, wx, wz, createEmptyBuildHabits(), 6);

  assert.ok(picks.length > 0, "Should offer placeable water elements");
  assert.ok(picks.every((p) => p.def.domain !== "land"), "Must never offer land-only buildings on open water");
  for (const item of picks) {
    const plan = planConstruction(state, item.def, wx, wz, 1, 0, false);
    assert.equal(plan.valid, true, `Water instant pick ${item.def.id} must be valid at (${wx},${wz})`);
  }
});

test("Instant Smart (2-tap) surfaces an affordable power fix during a power deficit", () => {
  const state = createInitialGameState("real");
  state.money = 50000;
  state.currentStage = 4;
  const [cx, cz] = findLandTile(state);

  placeSimple(state, "roads", cx, cz);
  placeSimple(state, "house", cx, cz - 1);
  placeSimple(state, "house", cx + 1, cz - 1);

  state.metrics.powerSupply = 0;
  state.metrics.powerDemand = 80;

  const picks = recommendInstantQuickElements(state, cx + 1, cz, createEmptyBuildHabits(), 6);
  assert.equal(picks.length, 6);
  assert.ok(
    picks.some((p) => (p.def.power ?? 0) > 0 && p.canAfford),
    `Expected an affordable power producer in instant picks during power crisis, got: ${picks.map((p) => p.def.id).join(", ")}`,
  );
});

test("Instant Smart (2-tap) bubbles recently built & adjacent continuation elements to the top", () => {
  const state = createInitialGameState("god");
  const [cx, cz] = findLandTile(state);
  placeSimple(state, "roads", cx, cz);
  placeSimple(state, "cottages", cx, cz - 1);

  let habits = createEmptyBuildHabits();
  const cottageDef = ELEMENT_BY_ID["cottages"];
  assert.ok(cottageDef);
  habits = recordBuildHabit(habits, cottageDef, "near_road");

  const picks = recommendInstantQuickElements(state, cx + 1, cz - 1, habits, 6);
  assert.equal(picks.length, 6);
  assert.equal(
    picks[0].def.id,
    "cottages",
    `Expected 'cottages' to rank #1 when continuing adjacent row, got: ${picks.map((p) => p.def.id).join(", ")}`,
  );
});
