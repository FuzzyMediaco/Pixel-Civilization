import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import {
  QUICK_BUILD_TREE,
  auditDecisionTreeCoverage,
  countParentElements,
  getDecisionTreeLeafElements,
} from "../src/game/quickBuildTree";
import {
  MAX_QUICK_SCULPT_SLOTS,
  MIN_QUICK_SCULPT_SLOTS,
  createDefaultQuickMenuPrefs,
  getOrderedDecisionTreeParents,
  moveExactParent,
  moveQuickEditButton,
  moveQuickSculptTool,
  recordQuickEditClick,
  recordQuickSculptUse,
  resolveQuickEditActions,
  resolveQuickSculptTools,
  sanitizeQuickMenuPrefs,
  toggleQuickEditButton,
  toggleQuickSculptTool,
} from "../src/game/quickMenuPrefs";
import { GRID_MAX, GRID_MIN, createInitialGameState, getTileTerrainKind } from "../src/game/simulation";

test("Exact Build keeps its seven original branches and adds four Christmas Village shelves", () => {
  const audit = auditDecisionTreeCoverage();
  assert.equal(audit.parentCount, 8);
  assert.equal(audit.subcategoryCount, 53);
  assert.ok(audit.minLeafSize >= 4, `Smallest leaf has ${audit.minLeafSize} items (expected >= 4)`);
  assert.ok(audit.maxLeafSize <= 6, `Largest leaf has ${audit.maxLeafSize} items (expected <= 6)`);

  for (const parent of QUICK_BUILD_TREE) {
    assert.equal(parent.subcategories.length, parent.id === "christmas_village" ? 4 : 7);
    assert.equal(countParentElements(parent), parent.id === "christmas_village" ? 20 : 42);
    for (const sub of parent.subcategories) {
      assert.ok(ELEMENT_BY_ID[sub.iconDefId], `Subcategory ${sub.id} iconDefId '${sub.iconDefId}' must exist in catalog`);
    }
  }
});

test("Exact Build decision tree partitions 100% of catalog elements with zero omissions and zero duplicates", () => {
  const audit = auditDecisionTreeCoverage();
  assert.deepEqual(audit.missingIds, [], `Missing catalog IDs: ${audit.missingIds.join(", ")}`);
  assert.deepEqual(audit.unknownIds, [], `Unknown IDs in tree: ${audit.unknownIds.join(", ")}`);
  assert.deepEqual(audit.duplicateIds, [], `Duplicate IDs in tree: ${audit.duplicateIds.join(", ")}`);
});

test("Exact Build leaf evaluation accurately reflects land vs water placeability and mode locks", () => {
  const godState = createInitialGameState("god");
  let landPt: [number, number] | null = null;
  let waterPt: [number, number] | null = null;
  for (let gx = GRID_MIN; gx <= GRID_MAX; gx++) {
    for (let gz = GRID_MIN; gz <= GRID_MAX; gz++) {
      const kind = getTileTerrainKind(gx, gz, godState);
      if (!landPt && kind === "land" && Math.abs(gx) <= 4 && Math.abs(gz) <= 4) {
        landPt = [gx, gz];
      }
      if (!waterPt && kind === "water") {
        waterPt = [gx, gz];
      }
      if (landPt && waterPt) break;
    }
    if (landPt && waterPt) break;
  }
  assert.ok(landPt && waterPt, "Initial island should have both land and deep water tiles");

  // Starter homes on land in God Mode: all 6 placeable and free
  const homes = getDecisionTreeLeafElements(godState, "homes_retail", "hr_starter_homes", landPt[0], landPt[1]);
  assert.equal(homes.length, 6);
  assert.ok(homes.every((h) => h.canPlace && h.canAfford && h.cost === 0));

  // Same land-only homes on deep open water: marked unplaceable
  const homesOnWater = getDecisionTreeLeafElements(godState, "homes_retail", "hr_starter_homes", waterPt[0], waterPt[1]);
  assert.ok(homesOnWater.every((h) => !h.canPlace));

  // Warships on open water in God Mode: placeable
  const warshipsOnWater = getDecisionTreeLeafElements(godState, "roads_harbor", "tr_warships", waterPt[0], waterPt[1]);
  assert.equal(warshipsOnWater.length, 6);
  assert.ok(warshipsOnWater.some((w) => w.canPlace));

  // Stage-1 Real mode locks late-stage skyscrapers while keeping starter houses unlocked
  const realState = createInitialGameState("real");
  const towersReal = getDecisionTreeLeafElements(realState, "homes_retail", "hr_towers", landPt[0], landPt[1]);
  const skyscraper = towersReal.find((t) => t.def.id === "skyscrapers");
  assert.ok(skyscraper && skyscraper.lockReason !== null && !skyscraper.canPlace);
});

test("Quick Edit customization protects core Delete & Details buttons and supports adaptive click-frequency order", () => {
  let prefs = createDefaultQuickMenuPrefs();

  // Attempting to hide core buttons ('delete', 'more') must be safely ignored
  prefs = toggleQuickEditButton(prefs, "delete");
  prefs = toggleQuickEditButton(prefs, "more");
  assert.deepEqual(prefs.quickEdit.hiddenButtons, []);

  // Optional buttons like 'bulk' can be toggled off safely
  prefs = toggleQuickEditButton(prefs, "bulk");
  assert.deepEqual(prefs.quickEdit.hiddenButtons, ["bulk"]);

  // Reordering in Fixed order moves 'rotate' up
  const beforeIdx = prefs.quickEdit.buttonOrder.indexOf("rotate");
  prefs = moveQuickEditButton(prefs, "rotate", -1);
  assert.equal(prefs.quickEdit.buttonOrder.indexOf("rotate"), beforeIdx - 1);

  // Adaptive click order puts the most-clicked button first, while keeping emergency 'fire' at 12 o'clock
  prefs = { ...prefs, quickEdit: { ...prefs.quickEdit, orderMode: "adaptive" } };
  for (let i = 0; i < 5; i++) prefs = recordQuickEditClick(prefs, "variant");
  for (let i = 0; i < 2; i++) prefs = recordQuickEditClick(prefs, "move");

  const sampleActions = [
    { id: "upgrade" },
    { id: "delete" },
    { id: "bulk" },
    { id: "variant" },
    { id: "move" },
    { id: "rotate" },
    { id: "more" },
    { id: "fire" },
  ];
  const resolved = resolveQuickEditActions(sampleActions, prefs.quickEdit);
  assert.ok(!resolved.some((a) => a.id === "bulk"), "Hidden optional button 'bulk' should be omitted");
  assert.ok(resolved.some((a) => a.id === "delete"), "Core 'delete' must always remain visible");
  assert.ok(resolved.some((a) => a.id === "more"), "Core 'more' must always remain visible");
  assert.equal(resolved[0].id, "fire", "Emergency fire crew must always sit first when burning");
  assert.equal(resolved[1].id, "variant", "Most-clicked button 'variant' should adapt to top spot");
  assert.equal(resolved[2].id, "move", "Second most-clicked button 'move' should follow");
});

test("Exact Build branch reordering preserves all eight branches without breaking tree coverage", () => {
  let prefs = createDefaultQuickMenuPrefs();
  assert.equal(prefs.exactParentOrder.length, 8);
  prefs = moveExactParent(prefs, "police_military", -1);
  const parents = getOrderedDecisionTreeParents(prefs.exactParentOrder);
  assert.equal(parents.length, 8);
  assert.equal(new Set(parents.map((p) => p.id)).size, 8);

  // Sanitization recovers gracefully even from corrupted/partial saved prefs
  const recovered = sanitizeQuickMenuPrefs({
    quickEdit: {
      orderMode: "adaptive",
      buttonOrder: ["rotate"],
      hiddenButtons: ["delete", "more", "undo"],
      clickCounts: { rotate: 4 },
    },
    exactParentOrder: ["police_military"],
  });
  assert.equal(recovered.quickEdit.buttonOrder.length, 9);
  assert.deepEqual(recovered.quickEdit.hiddenButtons, ["undo"]);
  assert.equal(recovered.exactParentOrder.length, 8);
  assert.equal(recovered.exactParentOrder[0], "police_military");
});

test("Quick Sculpt customization enforces slot bounds, supports reordering, and adapts to clicks", () => {
  let prefs = createDefaultQuickMenuPrefs();
  assert.equal(prefs.quickSculpt.tools.length, 6);

  // Add up to MAX_QUICK_SCULPT_SLOTS (8)
  prefs = toggleQuickSculptTool(prefs, "mountain");
  prefs = toggleQuickSculptTool(prefs, "lake");
  assert.equal(prefs.quickSculpt.tools.length, MAX_QUICK_SCULPT_SLOTS);
  // Adding a 9th is safely ignored
  prefs = toggleQuickSculptTool(prefs, "canyon");
  assert.equal(prefs.quickSculpt.tools.length, MAX_QUICK_SCULPT_SLOTS);

  // Move 'mountain' up one slot
  const idxBefore = prefs.quickSculpt.tools.indexOf("mountain");
  prefs = moveQuickSculptTool(prefs, "mountain", -1);
  assert.equal(prefs.quickSculpt.tools.indexOf("mountain"), idxBefore - 1);

  // Adaptive mode bubbles most-used sculpt tool to slot 0
  prefs = { ...prefs, quickSculpt: { ...prefs.quickSculpt, orderMode: "adaptive" } };
  for (let i = 0; i < 4; i++) prefs = recordQuickSculptUse(prefs, "lake");
  const resolved = resolveQuickSculptTools(prefs.quickSculpt);
  assert.equal(resolved[0], "lake");

  // Minimum slot guard preserves at least MIN_QUICK_SCULPT_SLOTS tools
  for (const id of [...prefs.quickSculpt.tools]) {
    prefs = toggleQuickSculptTool(prefs, id);
  }
  assert.equal(prefs.quickSculpt.tools.length, MIN_QUICK_SCULPT_SLOTS);
});

