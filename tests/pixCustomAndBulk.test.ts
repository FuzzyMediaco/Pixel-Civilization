import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/game/designs/index";
import { DESIGNS } from "../src/game/designs/registry";
import { ELEMENT_BY_ID, type GameMode } from "../src/game/catalog";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import {
  applyGeneratedLevelsToSpec,
  registerCustomElement,
  synthesizeLowerLevelsFromLv5,
  type CustomElementSpec,
} from "../src/game/customElements";
import {
  createInitialGameState,
  makeElementId,
  recomputeConnectivityAndMetrics,
  removePlacedElements,
  type PlacedElement,
} from "../src/game/simulation";

function place(defId: string, gx: number, gz: number, rotation = 0): PlacedElement {
  return {
    id: makeElementId(),
    defId,
    gx,
    gz,
    spanX: 1,
    spanZ: 1,
    rotation,
    level: 1,
    variant: 0,
    connected: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
}

test("roads automatically link to adjacent buildings on all four sides across every game mode without manual linking", () => {
  const modes: GameMode[] = ["god", "real", "survival", "idle", "manager"];
  const neighborOffsets: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  for (const mode of modes) {
    for (const [dx, dz] of neighborOffsets) {
      for (let rot = 0; rot < 4; rot++) {
        const state = createInitialGameState(mode);
        const road = place("roads", 0, 0, 0);
        const home = place("house", dx, dz, rot);
        const shop = place("shops", -dx, -dz, (rot + 2) % 4);
        state.elements = [road, home, shop];
        recomputeConnectivityAndMetrics(state);
        assert.equal(home.connected, true, `${mode} house at (${dx},${dz}) rot=${rot} must auto-connect`);
        assert.equal(shop.connected, true, `${mode} shop at (${-dx},${-dz}) rot=${(rot + 2) % 4} must auto-connect`);
      }
    }
  }
});

test("PixBuilder generates Lv5 flagship by default and auto-synthesizes distinct Lv1-4 visuals and scaled stats on confirm", () => {
  const lv5Draft: CustomElementSpec = {
    id: "custom_test_observatory",
    name: "Grand Sky Observatory",
    category: "civic_parks",
    domain: "land",
    description: "Level 5 flagship observatory with twin domes and glowing telescope atrium.",
    footprintCells: 3,
    cost: 4200,
    popBase: 0,
    jobs: 48,
    food: 0,
    power: -12,
    water: -6,
    waste: 4,
    education: 85,
    recreation: 50,
    government: 18,
    police: 0,
    policeRadius: 0,
    fireRadius: 0,
    military: 0,
    income: 42,
    accentHex: "#2d6a7a",
    lotGround: "concrete",
    boxes: [
      { x0: -12, y0: 1, z0: -12, x1: 12, y1: 6, z1: 12, color: "#d8e2e6" },
      { x0: -9, y0: 7, z0: -9, x1: 9, y1: 14, z1: 9, color: "#2d6a7a" },
      { x0: -9, y0: 8, z0: 9, x1: 9, y1: 13, z1: 9, color: "#82e8ff", emit: 0.7 },
    ],
    cylinders: [
      { cx: 0, cz: 0, y0: 15, y1: 23, radius: 6, color: "#40596b" },
    ],
    roof: {
      style: "dome",
      x0: -6,
      y: 23,
      z0: -6,
      x1: 6,
      z1: 6,
      color: "#f0d38c",
    },
    createdAt: Date.now(),
  };

  const levels = synthesizeLowerLevelsFromLv5(lv5Draft);
  assert.equal(levels.length, 5);
  assert.equal(levels[4].level, 5);
  assert.equal(levels[4].stats.cost, lv5Draft.cost);
  assert.equal(levels[4].boxes.length, lv5Draft.boxes.length);

  // Footprints and costs scale monotonically from Lv1 up to Lv5
  for (let i = 0; i < 4; i++) {
    assert.ok(levels[i].footprintCells <= levels[i + 1].footprintCells, "footprints must be non-decreasing");
    assert.ok(levels[i].stats.cost < levels[i + 1].stats.cost, "costs must scale up toward Lv5");
    assert.ok(levels[i].stats.education < levels[i + 1].stats.education, "education must scale up toward Lv5");
    assert.ok(levels[i].boxes.length >= 1, `Lv ${i + 1} must have valid voxel geometry`);
  }

  const confirmed = applyGeneratedLevelsToSpec(lv5Draft);
  assert.equal(confirmed.confirmedLevels, true);
  assert.equal(confirmed.levelSpecs?.length, 5);
  const def = registerCustomElement(confirmed);
  assert.equal(ELEMENT_BY_ID[def.id]?.name, lv5Draft.name);
  assert.equal(DESIGNS[def.id]?.levels?.length, 5);
  assert.equal(def.cost, confirmed.levelSpecs![0].stats.cost);
});

test("bulk delete removes multiple selected roads and buildings in one undoable edit and restores all of them on undo", () => {
  const state = createInitialGameState("god");
  const r1 = place("roads", 0, 0);
  const r2 = place("roads", 1, 0);
  const r3 = place("roads", 2, 0);
  const h1 = place("house", 0, 1);
  const keep = place("shops", 5, 5);
  state.elements = [r1, r2, r3, h1, keep];
  recomputeConnectivityAndMetrics(state);

  const before = structuredClone(state);
  const bulkIds = new Set([r1.id, r2.id, r3.id, h1.id]);
  removePlacedElements(state, bulkIds);
  recomputeConnectivityAndMetrics(state);
  rememberBuildingEdit(before, state, "Remove 4 items");

  assert.equal(state.elements.length, 1);
  assert.equal(state.elements[0].id, keep.id);

  const undoRes = undoBuildingEdit(state);
  assert.equal(undoRes.ok, true);
  assert.equal(state.elements.length, 5);
  assert.ok(state.elements.some((e) => e.id === r1.id));
  assert.ok(state.elements.some((e) => e.id === h1.id));
});
