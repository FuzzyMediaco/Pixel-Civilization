import test from "node:test";
import assert from "node:assert/strict";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, ELEMENTS, getStandardFootprintForLevel } from "../src/game/catalog";
import { BALANCED_EXPANSION_ELEMENTS } from "../src/game/expansionBalancedCatalog";
import { auditDecisionTreeCoverage, QUICK_BUILD_TREE } from "../src/game/quickBuildTree";
import { createInitialGameState, makeElementId, type PlacedElement } from "../src/game/simulation";
import {
  applyInfrastructureStroke,
  getTerrainCell,
  tileKey,
  undoInfrastructure,
  type InfrastructureTool,
} from "../src/game/terrain";
import {
  applyElementTerrainInteraction,
  detectCoastRotation,
  planElementTerrainInteraction,
  TERRAIN_INTERACTION_PROFILES,
} from "../src/game/terrainInteraction";
import { buildDesignVoxels } from "../src/game/voxelArchitect";
import { packVoxKey } from "../src/game/voxelCore";
import { sampleTerrainAt, sampleVoxelColumn, voxelCenterWorld, VOXELS_PER_TILE } from "../src/game/voxelTerrain";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";

test("Exact Build partitions the full catalog including Christmas Village", () => {
  const audit = auditDecisionTreeCoverage();
  assert.equal(audit.parentCount, 8);
  assert.equal(audit.subcategoryCount, 53);
  assert.equal(audit.minLeafSize, 5);
  assert.equal(audit.maxLeafSize, 6);
  assert.deepEqual(audit.missingIds, []);
  assert.deepEqual(audit.unknownIds, []);
  assert.deepEqual(audit.duplicateIds, []);

  const total = QUICK_BUILD_TREE.reduce(
    (sum, p) => sum + p.subcategories.reduce((s, sub) => s + sub.elementIds.length, 0),
    0,
  );
  assert.equal(total, 314);
  assert.ok(ELEMENTS.length >= 314);
});

test("all 24 new balanced catalog elements build valid 3D voxel geometry across all 5 levels and 4 styles", () => {
  assert.equal(BALANCED_EXPANSION_ELEMENTS.length, 24);
  for (const def of BALANCED_EXPANSION_ELEMENTS) {
    assert.ok(ELEMENT_BY_ID[def.id], `missing ${def.id} in ELEMENT_BY_ID`);
    for (let lv = 1; lv <= 5; lv++) {
      const [sx, sz] = getStandardFootprintForLevel(def.id, lv);
      for (let v = 0; v < 4; v++) {
        const built = buildDesignVoxels(def, lv, v, sx, sz, 0);
        assert.ok(built.v.size > 20, `${def.id} L${lv} V${v} has too few voxels (${built.v.size})`);
      }
    }
  }
});

test("every TERRAIN_INTERACTION_PROFILES entry corresponds to a real catalog element", () => {
  for (const id of Object.keys(TERRAIN_INTERACTION_PROFILES)) {
    assert.ok(ELEMENT_BY_ID[id], `unknown TERRAIN_INTERACTION_PROFILES key: ${id}`);
  }
});

test("Spaceport has no full-parcel flat platform slab across all 5 levels and all 4 variants", () => {
  const def = ELEMENT_BY_ID["spaceport"];
  assert.ok(def);
  for (let lv = 1; lv <= 5; lv++) {
    const [sx, sz] = getStandardFootprintForLevel(def.id, lv);
    for (let variant = 0; variant < 4; variant++) {
      const built = buildDesignVoxels(def, lv, variant, sx, sz, 0);
      assert.ok(built.v.size > 150, `spaceport L${lv} V${variant} unexpectedly small`);
      const corners: [number, number][] = [
        [-built.hx, -built.hz],
        [built.hx - 1, -built.hz],
        [-built.hx, built.hz - 1],
        [built.hx - 1, built.hz - 1],
      ];
      for (const [cx, cz] of corners) {
        assert.equal(
          built.v.v.has(packVoxKey(cx, 0, cz)),
          false,
          `spaceport L${lv} V${variant} still has corner slab voxel at (${cx}, 0, ${cz})`,
        );
      }
    }
  }
});

test("single-voxel (0.25m) sculpt raises one column cleanly and undo restores losslessly", () => {
  const state = createInitialGameState("god");
  const gx = 0;
  const gz = 0;
  const beforeTarget = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 4, gz * VOXELS_PER_TILE + 4);
  const beforeFar = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 14, gz * VOXELS_PER_TILE + 14);

  const tool: InfrastructureTool = {
    kind: "raise",
    radius: 1,
    precision: "voxel",
    voxelRadius: 0,
    strength: 1,
  };
  const res = applyInfrastructureStroke(state, tool, [{ gx, gz, vx: 4, vz: 4 }]);
  assert.equal(res.valid, true);

  const afterTarget = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 4, gz * VOXELS_PER_TILE + 4);
  const afterFar = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 14, gz * VOXELS_PER_TILE + 14);
  assert.ok(afterTarget.elevation > beforeTarget.elevation);
  assert.ok(Math.abs(afterFar.elevation - beforeFar.elevation) < 0.005);
  assert.ok(state.infrastructure?.voxels?.[tileKey(gx, gz)]);

  const [wx, wz] = voxelCenterWorld(gx * VOXELS_PER_TILE + 4, gz * VOXELS_PER_TILE + 4);
  assert.ok(Math.abs(sampleTerrainAt(state, wx, wz).elevation - afterTarget.elevation) < 0.02);

  const undone = undoInfrastructure(state);
  assert.equal(undone, true);
  const restored = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 4, gz * VOXELS_PER_TILE + 4);
  assert.ok(Math.abs(restored.elevation - beforeTarget.elevation) < 0.005);
});

test("new voxel sculpt, shape, and water tools (lake, mountain, sharpen, flatten, valley) apply cleanly", () => {
  const state = createInitialGameState("god");

  const lakeRes = applyInfrastructureStroke(
    state,
    { kind: "lake", radius: 1, precision: "voxel", voxelRadius: 6, strength: 1 },
    [{ gx: 2, gz: 2, vx: 2 * VOXELS_PER_TILE + 8, vz: 2 * VOXELS_PER_TILE + 8 }],
  );
  assert.equal(lakeRes.valid, true);
  const lakeCol = sampleVoxelColumn(state, 2 * VOXELS_PER_TILE + 8, 2 * VOXELS_PER_TILE + 8);
  assert.ok(lakeCol.depth > 0.2);

  const mtnRes = applyInfrastructureStroke(
    state,
    { kind: "mountain", radius: 1, precision: "voxel", voxelRadius: 6, height: 2, strength: 1 },
    [{ gx: -3, gz: -3, vx: -3 * VOXELS_PER_TILE + 8, vz: -3 * VOXELS_PER_TILE + 8 }],
  );
  assert.equal(mtnRes.valid, true);
  const peakBefore = sampleVoxelColumn(state, -3 * VOXELS_PER_TILE + 8, -3 * VOXELS_PER_TILE + 8).elevation;
  assert.ok(peakBefore > 2);

  const sharpRes = applyInfrastructureStroke(
    state,
    { kind: "sharpen", radius: 1, precision: "voxel", voxelRadius: 5, strength: 1 },
    [{ gx: -3, gz: -3, vx: -3 * VOXELS_PER_TILE + 8, vz: -3 * VOXELS_PER_TILE + 8 }],
  );
  assert.equal(sharpRes.valid, true);

  const flatRes = applyInfrastructureStroke(
    state,
    { kind: "flatten", radius: 1, precision: "voxel", voxelRadius: 5, strength: 1, targetElevation: 1.5 },
    [{ gx: -3, gz: -3, vx: -3 * VOXELS_PER_TILE + 8, vz: -3 * VOXELS_PER_TILE + 8 }],
  );
  assert.equal(flatRes.valid, true);
  const afterFlat = sampleVoxelColumn(state, -3 * VOXELS_PER_TILE + 8, -3 * VOXELS_PER_TILE + 8).elevation;
  assert.ok(Math.abs(afterFlat - 1.5) < Math.abs(peakBefore - 1.5));

  const valleyRes = applyInfrastructureStroke(
    state,
    { kind: "valley", radius: 1, precision: "voxel", voxelRadius: 6, strength: 1 },
    [{ gx: 0, gz: -4, vx: 8, vz: -4 * VOXELS_PER_TILE + 8 }],
  );
  assert.equal(valleyRes.valid, true);
});

test("beaches auto-orient to water, sculpt voxel shore, strip flat slab in world mode, and undo cleanly", () => {
  const state = createInitialGameState("god");
  const beachDef = ELEMENT_BY_ID["beaches"];
  assert.ok(beachDef);

  let coastX = 0;
  let coastZ = 0;
  let found = false;
  for (let z = -30; z <= 30 && !found; z++) {
    for (let x = -30; x <= 30 && !found; x++) {
      const cell = getTerrainCell(state, x, z);
      if (cell.kind === "coast" && cell.depth <= 0.05) {
        const rotCheck = detectCoastRotation(state, x, z, 2, 1);
        if (rotCheck.foundWater) {
          coastX = x;
          coastZ = z;
          found = true;
        }
      }
    }
  }
  assert.equal(found, true);

  const plan = planElementTerrainInteraction(state, beachDef, coastX, coastZ, 2, 1, 1, 0, 0);
  assert.ok(plan);
  assert.equal(plan.profile.kind, "beach");
  assert.ok(plan.edits.size > 100);

  const atlasModel = buildDesignVoxels(beachDef, 2, 0, 2, 2, 0, { worldSculpted: false });
  const worldModel = buildDesignVoxels(beachDef, 2, 0, 2, 2, 0, { worldSculpted: true });
  assert.ok(atlasModel.v.size > worldModel.v.size);
  assert.ok(worldModel.v.size > 15);

  const before = structuredClone(state);
  const beachEl: PlacedElement = {
    id: makeElementId(),
    defId: "beaches",
    gx: coastX,
    gz: coastZ,
    spanX: 2,
    spanZ: 1,
    level: 1,
    variant: 0,
    rotation: 0,
    placedAt: state.activePlaySec,
  };
  state.elements.push(beachEl);
  const applied = applyElementTerrainInteraction(state, beachEl);
  assert.ok(applied && applied.edits.size > 100);
  assert.equal(beachEl.sculptsTerrain, true);
  assert.ok(state.infrastructure?.voxels?.[tileKey(coastX, coastZ)]);

  rememberBuildingEdit(before, state, "Place Beach");
  const undone = undoBuildingEdit(state);
  assert.equal(undone.ok, true);
  assert.equal(state.infrastructure?.voxels?.[tileKey(coastX, coastZ)], undefined);
});

test("deserts, hills, mountains, and canyons plan smooth voxel terrain edits", () => {
  const state = createInitialGameState("god");
  for (const id of ["deserts", "hills", "mountains", "canyons"]) {
    const def = ELEMENT_BY_ID[id];
    assert.ok(def);
    const plan = planElementTerrainInteraction(state, def, 0, 0, 2, 2, 1, 0, 0);
    assert.ok(plan);
    assert.ok(plan.edits.size > 200);
  }
});

test("Starter 10 elements exist via isStarter and Duplex Cottage has balanced starter capacity", () => {
  const starters = ELEMENTS.filter((d) => d.isStarter);
  assert.ok(starters.length >= 10);
  const duplex = ELEMENT_BY_ID["rowhouse_duplex"];
  assert.ok(duplex);
  assert.equal(duplex.popBase, 16);
  assert.equal(duplex.cost, 45);
});

test("Beach House omits flat sand slab in-world while retaining Atlas diorama and parcel occupancy", () => {
  const def = ELEMENT_BY_ID["beach_houses"];
  assert.ok(def);
  const profile = TERRAIN_INTERACTION_PROFILES["beach_houses"];
  assert.ok(profile);
  assert.equal(profile.sculptsTerrain, false);
  assert.equal(profile.orientToWater, true);

  const atlasModel = buildDesignVoxels(def, 5, 0, 2, 2, 0, { worldSculpted: false });
  const worldModel = buildDesignVoxels(def, 5, 0, 2, 2, 0, { worldSculpted: true });
  assert.ok(atlasModel.v.size > worldModel.v.size);
  assert.ok(worldModel.v.size > 200);
  // Corner flat sand slab voxels must exist in Atlas diorama and be absent in-world
  assert.equal(atlasModel.v.v.has(packVoxKey(-atlasModel.hx, 0, atlasModel.hz - 1)), true);
  assert.equal(worldModel.v.v.has(packVoxKey(-worldModel.hx, 0, worldModel.hz - 1)), false);
});

test("base world terrain elevations are natively quantized to 0.25m voxel steps in all modes", () => {
  for (const mode of ["real", "god", "sandbox", "survival"] as const) {
    const state = createInitialGameState(mode);
    for (let gx = -26; gx <= 26; gx += 4) {
      for (let gz = -26; gz <= 26; gz += 4) {
        const col = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + 8, gz * VOXELS_PER_TILE + 8);
        const steps = col.elevation / 0.25;
        assert.ok(
          Math.abs(steps - Math.round(steps)) < 1e-6,
          `mode=${mode} (${gx},${gz}) elevation ${col.elevation} is not a 0.25m voxel multiple`,
        );
      }
    }
  }
});

test("coordinate-only canal stroke populates 0.25m voxel patches natively with synced water", () => {
  const state = createInitialGameState("real");
  state.currentStage = 6;
  state.highestStageReached = 6;
  state.money = 50_000;
  const res = applyInfrastructureStroke(state, { kind: "canal", depth: 1.5, radius: 1 }, [
    { gx: 0, gz: 0 },
    { gx: 1, gz: 0 },
  ]);
  assert.equal(res.valid, true, res.reason);
  assert.ok(state.infrastructure?.voxels?.[tileKey(0, 0)]);
  assert.ok(state.infrastructure?.voxels?.[tileKey(1, 0)]);
  const col = sampleVoxelColumn(state, 8, 8);
  assert.ok(col.depth > 0);
  const steps = col.elevation / 0.25;
  assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6);
});
