import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as THREE from "three";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import {
  DefenseDisplayClock,
  exerciseSecond,
  poseDefenseDisplay,
  type DefenseDisplay,
} from "../src/game/defenseDisplay";
import { makeCtx, type Ctx } from "../src/game/designs/kit";
import {
  parkDisplayDrone,
  siloHatchLayout,
  siloHatchPlate,
  swarmDockLayout,
} from "../src/game/designs/militaryDisplayKit";
import { DESIGNS, defineDesigns } from "../src/game/designs/registry";
import {
  buildDesignAsset,
  buildPlacedGroupFromAsset,
  releaseParcelGeometry,
} from "../src/game/voxelArchitect";

const drone = "drone_swarm_base",
  silo = "underground_missile_silo";
function parked(ctx: Ctx) {
  ctx.v.box(-10, 0, -10, 10, 1, 10, "steel");
  ctx.v.box(-1, 0, -2, 1, 10, 2, "cream");
  swarmDockLayout(ctx).forEach((p, i) => parkDisplayDrone(ctx, p, i));
}
function closed(ctx: Ctx) {
  const { center, travel } = siloHatchLayout(ctx);
  for (const side of [-1, 1]) {
    const lid = siloHatchPlate(ctx, center, [side * travel, 0, 0]);
    lid.put(side, 0, 0, "copper");
  }
}

function withDisplay(
  t: TestContext,
  id: string,
  build: (c: Ctx) => void,
  variant = 0,
) {
  const original = DESIGNS[id];
  t.after(() => {
    if (original) DESIGNS[id] = original;
    else delete DESIGNS[id];
  });
  defineDesigns({
    [id]: {
      footprints: [
        [2, 2],
        [2, 2],
        [2, 2],
        [2, 2],
        [2, 2],
      ],
      levels: ["1", "2", "3", "4", "5"],
      growth: "",
      build,
    },
  });
  const def = { ...ELEMENT_BY_ID.military_base, id };
  const asset = buildDesignAsset(def, 5, variant, 1, 1, 0);
  const group = buildPlacedGroupFromAsset(asset);
  t.after(() => {
    asset.baseGeo.dispose();
    for (const r of asset.rotors ?? []) r.geo.dispose();
  });
  return {
    asset,
    group,
    display: group.userData.defenseDisplay as DefenseDisplay,
  };
}

function moved(display: DefenseDisplay) {
  return display.parts.filter(
    (p) => p.pivot.position.distanceToSquared(p.home) > 0.00001,
  );
}

test("each artwork level has distinct dock centers and bounded closed surfaces on its parcel", () => {
  for (let level = 1; level <= 5; level++)
    for (let variant = 0; variant < 4; variant++) {
      const ctx = makeCtx(drone, level, variant, level === 1 ? 1 : 2, 2);
      const docks = swarmDockLayout(ctx);
      assert.equal(docks.length, level + 1);
      assert.equal(new Set(docks.map((p) => p.join(","))).size, level + 1);
      for (const [x, , z] of docks)
        assert.ok(Math.abs(x) + 3 <= ctx.hx && Math.abs(z) + 3 <= ctx.hz);
      const { center, rx, rz, axis, travel } = siloHatchLayout(ctx);
      assert.ok(
        Math.abs(center[0]) + rx + (axis === "x" ? travel : 0) <= ctx.hx,
      );
      assert.ok(
        Math.abs(center[2]) + rz + (axis === "z" ? travel : 0) <= ctx.hz,
      );
    }
});

test("formation lifts from named docks, flies above the roof, reduces to two, and lands; cache and world picks stay isolated", (t) => {
  const { group, display, asset } = withDisplay(t, drone, parked, 3);
  const neighbor = buildPlacedGroupFromAsset(asset);
  // A placed copy shares only immutable voxel geometry. Its transforms survive a neighbor's flight.
  assert.deepEqual(moved(display), []);
  for (let step = 1; step < 22; step++) {
    poseDefenseDisplay(display, "training", step / 10, false);
    for (const part of display.parts)
      if (part.pivot.position.y <= display.roof) {
        assert.equal(part.pivot.position.x, part.home.x);
        assert.equal(part.pivot.position.z, part.home.z);
      }
  }
  poseDefenseDisplay(display, "training", 8, false);
  assert.equal(moved(display).length, 6);
  for (const p of display.parts) {
    assert.ok(p.pivot.position.y > display.roof);
    assert.ok(p.pivot.children[0] instanceof THREE.Mesh);
    assert.equal(p.pivot.children[0].userData.isVoxelMesh, true);
    assert.equal(
      new THREE.Raycaster().intersectObject(p.pivot, true).length,
      0,
    );
  }
  assert.deepEqual(moved(neighbor.userData.defenseDisplay), []);
  group.rotation.y = Math.PI / 2;
  group.position.set(10, 2, 5);
  group.updateMatrixWorld(true);
  const p = display.parts[0];
  assert.ok(
    Math.abs(
      p.pivot.getWorldPosition(new THREE.Vector3()).x -
        (10 + p.pivot.position.z),
    ) < 0.00001,
  );
  poseDefenseDisplay(display, "alert", 8, true);
  assert.equal(moved(display).length, 2);
  poseDefenseDisplay(display, "training", 20, false);
  assert.deepEqual(moved(display), []);
  let disposed = 0;
  asset.rotors?.[0].geo.addEventListener("dispose", () => disposed++);
  releaseParcelGeometry(group);
  assert.equal(disposed, 0);
  group.userData.siteSpecific = true;
  releaseParcelGeometry(group);
  assert.equal(disposed, 1);
});

test("closed hatches translate from the packed model by the fitted voxel scale only during alerts", (t) => {
  const { display } = withDisplay(t, silo, closed);
  poseDefenseDisplay(display, "training", 8, false);
  assert.deepEqual(moved(display), []);
  poseDefenseDisplay(display, "alert", 8, true);
  assert.equal(moved(display).length, 2);
  for (const p of display.parts) {
    assert.equal(p.unit, 0.125);
    assert.ok(p.motion.kind === "hatch");
    assert.equal(p.pivot.position.x, p.home.x + p.motion.travel[0] * p.unit);
  }
  poseDefenseDisplay(display, "idle", 0, false);
  assert.deepEqual(moved(display), []);
});

test("attack, occasional staggered training and return poses stay on the existing simulation timeline", () => {
  const c = new DefenseDisplayClock();
  c.sync(10, { id: "alert", elapsedSec: 5 }, 0);
  assert.equal(c.sample(0, 0).alert, 5);
  assert.equal(c.sample(800, 0).alert, 5);
  assert.equal(c.sample(0.125, 2).alert, 5.25);
  assert.equal(c.sample(15, 1).alert, 5.25);
  c.sync(12, null, 4);
  assert.equal(c.sample(5, 0).returnAmount, 1);
  c.sync(13.25, null, 5.25);
  assert.equal(c.sample(5.25, 0).returnAmount, 0.5);
  c.sync(15, null, 7);
  assert.equal(c.sample(7, 0).returnAmount, 0);
  c.sync(1, { id: "old-save" }, 8);
  assert.equal(c.sample(8, 0).alert, 0);
  assert.equal(c.sample(8, 0).returnAmount, 0);
  const windows = (seed: number) =>
    Array.from({ length: 210 }, (_, i) => exerciseSecond(i, seed));
  const a = windows(131452),
    b = windows(7191822);
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, windows(131452));
  assert.ok(
    a.filter((i) => i >= 0).length > 20 && a.filter((i) => i >= 0).length < 60,
  );
});
