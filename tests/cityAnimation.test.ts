import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ChimneyPlumes, type ChimneyOutlet } from "../src/game/chimneyPlumes";
import { CritterHerds, farmJobPose } from "../src/game/farmActivity";
import { CRITTER_TUNING, type BuiltCritterPen } from "../src/game/critterModels";
import type { PlacedElement } from "../src/game/simulation";

const outlet = (group: THREE.Group, kind: ChimneyOutlet["kind"] = "smoke"): ChimneyOutlet =>
  ({ id: "stack:0", group, kind, local: new THREE.Vector3(0, 1, 0) });
function puffs(fx: ChimneyPlumes) {
  const attr = fx.mesh.geometry.getAttribute("puffOriginTime");
  return Array.from({ length: fx.mesh.geometry.instanceCount }, (_, i) => [attr.getX(i), attr.getY(i), attr.getZ(i), attr.getW(i)]);
}

test("puff births follow wall time across irregular frames and emitter rebuilds", t => {
  t.mock.method(Math, "random", () => .5);
  const group = new THREE.Group(), fx = new ChimneyPlumes(), other = new ChimneyPlumes();
  for (const effect of [fx, other]) {
    effect.setOutlets([outlet(group)]);
    effect.update(0, 1, false);
  }
  for (let frame = 1; frame <= 120; frame++) fx.update(frame / 60, 1, false);
  for (const time of [.17, .32, .72, .8, 1.15, 1.62, 2]) {
    other.setOutlets([outlet(group)]);
    other.update(time, 1, false);
  }
  assert.deepEqual(puffs(other), puffs(fx));
  const before = puffs(fx);
  assert.ok(before.length >= 5);
  group.position.x = 12;
  fx.update(2.25, 1, false);
  assert.deepEqual(puffs(fx).slice(0, before.length), before);
  assert.equal(puffs(fx).at(-1)![0], 12);
  fx.setOutlets([]);
  fx.update(2000, 1, false);
  assert.equal(fx.mesh.visible, false);
  assert.equal(fx.mesh.geometry.instanceCount, 0);
  for (const effect of [fx, other]) effect.dispose();
});

test("the full island shares a bounded pool and leaves no suspended-tab backlog", t => {
  let seed = 42;
  t.mock.method(Math, "random", () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296));
  const fx = new ChimneyPlumes(), group = new THREE.Group();
  fx.setOutlets(Array.from({ length: 700 }, (_, i) => ({...outlet(group), id: String(i)})));
  fx.update(0, 1, false);
  for (let i = 1; i <= 12; i++) fx.update(i, 1, false);
  assert.ok(fx.mesh.geometry.instanceCount <= 700 && fx.mesh.visible);
  fx.update(8000, 1, false);
  assert.ok(puffs(fx).every(puff => puff[3] >= 7999));
  fx.dispose();
});

function herdFixture(kind: BuiltCritterPen["kind"], distance: number) {
  const scene = new THREE.Scene(), group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(0, 3, distance);
  camera.lookAt(0, 0, 0);
  group.userData.critters = [{ kind, coat: 0, count: 3, area: [-3, -2, 3, 2], scale: 1, y: 0 } satisfies BuiltCritterPen];
  scene.add(group);
  const herds = new CritterHerds(scene, () => camera);
  herds.sync([{ id: "pen" } as PlacedElement], new Map([["pen", { group }]]));
  const parts: THREE.InstancedMesh[] = [];
  scene.traverse(obj => { if (obj instanceof THREE.InstancedMesh) parts.push(obj); });
  const pose = () => parts.flatMap(mesh => Array.from(mesh.instanceMatrix.array.slice(0, 3 * 16)));
  return { herds, pose, parts, camera };
}

test("all eight livestock species animate every visible frame, including distant pens", () => {
  for (const kind of Object.keys(CRITTER_TUNING) as BuiltCritterPen["kind"][]) {
    const near = herdFixture(kind, 20), far = herdFixture(kind, 160);
    for (let i = 0; i < 180; i++) near.herds.update(1 / 60);
    for (let i = 0; i < 15; i++) {
      far.herds.update(.13);
      far.herds.update(.07);
    }
    const reference = near.pose();
    const largestDifference = Math.max(...far.pose().map((v, i) => Math.abs(v - reference[i])));
    assert.ok(largestDifference < 1e-5, kind + " differs by " + largestDifference + " after three seconds");
    const before = far.pose(); far.herds.update(1 / 60);
    assert.notDeepEqual(far.pose(), before, kind + " moves between steering ticks");
    far.camera.lookAt(0, 3, 320);
    far.herds.update(1 / 60);
    const version = far.parts[0].instanceMatrix.version;
    assert.ok(far.parts.every(mesh => !mesh.visible), kind + " skips draws for hidden pens");
    far.herds.update(.2);
    assert.equal(far.parts[0].instanceMatrix.version, version, kind + " avoids uploads outside the view");
    near.herds.dispose(); far.herds.dispose();
  }
});

test("farm patrols turn continuously through the ends of a field", () => {
  const run = { key: "rider", job: "herd" as const, path: [[0,0],[4,0]] as [number,number][], period: 10, offset: 0 };
  let prev = farmJobPose(run, 0);
  for (let i = 1; i <= 600; i++) {
    const next = farmJobPose(run, i / 60), turn = next.angle - prev.angle;
    assert.ok(Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) < .2);
    assert.ok(next.x >= 0 && next.x <= 4 && Math.abs(next.z) <= .081);
    prev = next;
  }
});
