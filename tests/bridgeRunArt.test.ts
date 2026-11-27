import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import * as THREE from "three";
import { packVoxKey } from "../src/game/voxelCore";
import { buildBridgeBay } from "../src/game/bridgeBay";
import { bridgeRunProfile, bridgeRunProfiles } from "../src/game/bridgeWorks";
import { EngineeringView } from "../src/game/engineeringView";
import { BRIDGE_STUDIES, pitchedBridge } from "../src/review/bridgeRunFixtures";
import { getNetworkConnMask } from "../src/game/simulation";
import { LIFT_TRAVEL, surfaceTravelHeight, type Crossing } from "../src/game/terrain";
import { getOrBuildElementAsset, buildPlacedGroupFromAsset } from "../src/game/voxelArchitect";
import "../src/game/designs/networks";

const crossing: Crossing = { run: "old-road", mode: "road", shape: "suspension", axis: "x",
  deck: 4, startHeight: 4, endHeight: 4, direction: 1, end: false, ramp: false, lift: "closed" };

test("interior lengths determine symmetric tower spacing independently of height, direction and paid tier", () => {
  for (const [length, towers] of [[1, []], [2, []], [3, [1]], [6, [1,4]], [12, [2,9]], [15, [2,7,12]]] as const) {
    const a = bridgeRunProfile(crossing, -9, length);
    const b = bridgeRunProfile({ ...crossing, direction: -1, axis: "z", tier: 11 }, -9, length);
    assert.deepEqual(a.towers, towers);
    assert.deepEqual(b.towers, towers);
    assert.ok(b.towerHeight > a.towerHeight);
  }
  assert.equal(bridgeRunProfile(crossing, 0, 23).towers.length, 4);
});

test("reversed pitched Works spans, legacy widths and catalog variants preserve stored geometry and joins", () => {
  const { state, left, right } = pitchedBridge({ ...BRIDGE_STUDIES.landmarks[1], length: 6 });
  const spans = state.infrastructure!.spans;
  const coordinates = Object.entries(spans).sort(([a], [b]) => +a.split(",")[1] - +b.split(",")[1]);
  for (let i = 0; i < coordinates.length - 1; i++) {
    const z = +coordinates[i][0].split(",")[1];
    assert.equal(surfaceTravelHeight(state, 0, z, "z", 1), surfaceTravelHeight(state, 0, z + 1, "z", 0));
  }
  assert.equal(surfaceTravelHeight(state, 0, left - 2, "z", 0), 0);
  assert.equal(surfaceTravelHeight(state, 0, right + 2, "z", 1), 1.5);
  const view = new EngineeringView();
  try {
    const legacy = JSON.parse(JSON.stringify(state));
    for (const value of Object.values(legacy.infrastructure.spans) as Crossing[]) {
      value.mode = "highway";
      delete value.corridorWidth;
    }
    const serialized = JSON.stringify(legacy.infrastructure.spans);
    view.sync(legacy);
    assert.equal(JSON.stringify(legacy.infrastructure.spans), serialized);
    // A Works road's ordinary parcel style never selects the bridge's landmark.
    const center = state.elements.find(e => e.gx === 0 && e.gz === left + 3)!;
    center.variant = 2;
    assert.equal(bridgeRunProfiles(state).get("0," + left)!.variant, 0);
    for (const [, span] of coordinates) span.catalog = true;
    center.defId = "stone_bridges";
    const serializedCatalog = JSON.stringify(spans);
    const mask = getNetworkConnMask(state.elements, center, undefined, state);
    assert.equal(mask & 15, 5);
    for (const variant of [0, 1, 2, 3]) {
      center.variant = variant;
      const profiles = bridgeRunProfiles(state);
      assert.equal(profiles.get("0," + left)!.variant, variant);
      assert.equal(profiles.get("0," + left), profiles.get("0," + right));
      const before = view.group.children.at(-1);
      view.sync(state);
      assert.notEqual(view.group.children.at(-1), before);
    }
    assert.equal(JSON.stringify(spans), serializedCatalog);
    // Raycasting the hidden per-element proxy is how the world renderer selects a promoted tile.
    const proxy = buildPlacedGroupFromAsset(getOrBuildElementAsset(center.defId, center.level, center.variant, 1, 1, mask));
    proxy.userData.elementId = center.id;
    proxy.traverse(o => { if (o instanceof THREE.Mesh) o.visible = false; });
    proxy.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(new THREE.Vector3(0, 40, 0), new THREE.Vector3(0, -1, 0)).intersectObject(proxy);
    assert.equal(hits[0]?.object.parent?.userData.elementId, center.id);
    // Interrupted old runs keep separate tower profiles on each surviving stretch.
    delete spans["0," + (left + 2)];
    const split = bridgeRunProfiles(state);
    assert.equal(split.get("0," + left)!.length, 2);
    assert.equal(split.get("0," + right)!.length, 3);
  } finally { view.dispose(); }
});

test("suspension cables remain face-connected across every slice and multibay towers leave a travel opening", () => {
  const run = bridgeRunProfile({ ...crossing, tier: 11 }, -4, 12);
  const bays = Array.from({ length: run.length }, (_, i) => buildBridgeBay(run, i, 2.8, -5.5));
  for (const bay of bays) {
    for (const vox of [bay.fixed, bay.moving, bay.weights])
      for (const key of vox.v.keys()) assert.ok((key >>> 20) - 512 >= -8 && (key >>> 20) - 512 < 8);
    for (let x = -8; x < 8; x++)
      for (let y = 0; y < 8; y++)
        for (let z = -3; z < 3; z++) assert.ok(!bay.fixed.v.has(packVoxKey(x, y, z)));
  }
  for (let i = 1; i < bays.length; i++) {
    const edge = bays[i].halfWidth;
    for (const z of [-edge - 1, edge]) {
      let joined = false;
      for (let y = 2; y <= run.towerHeight + 3; y++)
        if (bays[i-1].fixed.v.has(packVoxKey(7, y, z)) && bays[i].fixed.v.has(packVoxKey(-8, y, z))) joined = true;
      assert.ok(joined, "seam " + i + " at transverse " + z);
    }
  }
});

test("the complete lift deck and its trim rise five metres while separate counterweights descend", () => {
  const { state } = pitchedBridge(BRIDGE_STUDIES.landmarks[4]);
  const spans = state.infrastructure!.spans;
  const view = new EngineeringView();
  try {
    const elements = JSON.stringify(state.elements), savedSpans = JSON.stringify(spans);
    view.sync(state);
    view.animate(state, 0);
    const decks = view.group.children.filter(o => o.name.startsWith("Lift deck "));
    const counterweights = view.group.children.filter(o => o.name.startsWith("Lift counterweight "));
    assert.equal(decks.length, 6);
    assert.equal(counterweights.length, 2);
    assert.ok([...decks, ...counterweights].every(o => o.position.y === 0));
    assert.equal(JSON.stringify(spans), savedSpans);
    assert.equal(JSON.stringify(state.elements), elements);
    for (const span of Object.values(spans)) span.lift = "open";
    view.animate(state, 0);
    assert.ok(decks.every(o => o.position.y === LIFT_TRAVEL));
    assert.ok(counterweights.every(o => o.position.y === -4.5));
    assert.ok(view.group.children.filter(o => !decks.includes(o) && !counterweights.includes(o)).every(o => o.position.y === 0));
    const run = bridgeRunProfiles(state).get("0,0")!;
    const bay = buildBridgeBay(run, 2, 2.8, -6);
    assert.ok(bay.moving.v.has(packVoxKey(1, 1, bay.halfWidth - 1)));
    assert.ok(!bay.fixed.v.has(packVoxKey(1, 1, bay.halfWidth - 1)));
  } finally { view.dispose(); }
});

test("a solitary span keeps eleven visible upgrade stages even without a landmark tower", () => {
  for (const shape of ["suspension", "arch", "truss", "lift", "beam"] as const) {
    const stages = new Set<string>();
    for (let tier = 1; tier <= 11; tier++) {
      const run = bridgeRunProfile({ ...crossing, tier, shape }, 0, 1);
      const bay = buildBridgeBay(run, 0, 2.8, -5.5);
      const hash = createHash("sha256");
      for (const layer of [bay.fixed, bay.moving, bay.weights]) {
        const entries = [...layer.v].sort(([a], [b]) => a - b);
        hash.update(new Int32Array(entries.flat()));
      }
      stages.add(hash.digest("hex"));
    }
    assert.equal(stages.size, 11, shape);
  }
});

test("Gothic portals keep a two-metre opening even at the first three-piece threshold", () => {
  for (const variant of [0, 1, 2, 3]) {
    const run = bridgeRunProfile({ ...crossing, tier: 1, shape: "arch" }, 0, 3, variant);
    const bay = buildBridgeBay(run, 1, 2.8, -4);
    for (let x = -8; x < 8; x++)
      for (let y = 0; y < 8; y++)
        for (let z = -bay.halfWidth + 1; z < bay.halfWidth - 1; z++)
          assert.ok(!bay.fixed.v.has(packVoxKey(x, y, z)), "blocked lane in variant " + variant);
  }
});
