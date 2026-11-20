import assert from "node:assert/strict";
import { EXPANSION_ELEMENTS } from "../src/game/expansionCatalog";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { getOrBuildElementAsset } from "../src/game/voxelArchitect";

// Runtime smoke-check every new architecture at its small, medium and final forms.
// Vite's TypeScript compilation does not execute voxel generation; this does.
let rendered = 0;
for (const def of EXPANSION_ELEMENTS) {
  for (const level of [1, 3, 5]) {
    const [sx, sz] = getStandardFootprintForLevel(def, level);
    const asset = getOrBuildElementAsset(def.id, level, 0, sx, sz, 0);
    const positions = asset.baseGeo.getAttribute("position");
    assert.ok(positions?.count > 0, `${def.id} level ${level}: no geometry generated`);
    assert.ok(Number.isFinite(asset.topY), `${def.id} level ${level}: invalid geometry height`);
    rendered++;
  }
}

const roadTypes = ["roads", "two_lane_roads", "highways", "freeways"];
for (const id of roadTypes) {
  const def = ELEMENT_BY_ID[id];
  for (const level of [1, 5, 11]) {
    const asset = getOrBuildElementAsset(def.id, level, 0, 1, 1, 5);
    assert.ok(asset.baseGeo.getAttribute("position").count > 0);
    rendered++;
  }
}

console.log(`Voxel geometry smoke test: PASS (${rendered} models)`);
