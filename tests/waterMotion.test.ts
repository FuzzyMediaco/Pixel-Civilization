import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EngineeringView } from "../src/game/engineeringView";
import { createInitialGameState } from "../src/game/simulation";
import { applyInfrastructureStroke, hydraulics } from "../src/game/terrain";

test("current highlights follow a fed aqueduct around a bend and down its open outlet without per-frame uploads", () => {
  const state = createInitialGameState("god");
  state.elements = [];
  const p = (gx: number, gz: number) => ({ gx, gz });
  assert.ok(applyInfrastructureStroke(state, {kind: "spring", depth: 1, flow: 12}, [p(-1, 0)]).valid);
  const coast = state.infrastructure!.coastlineStamp;
  assert.ok(applyInfrastructureStroke(state, {kind: "aqueduct", height: 2}, [p(0, 0), p(2, 0), p(2, 1)]).valid);
  assert.ok(applyInfrastructureStroke(state, {kind: "aqueduct", height: 2, outlet: "east"}, [p(2, 1)]).valid);
  assert.equal(state.infrastructure!.coastlineStamp, coast);
  assert.ok(hydraulics(state).runs.get("2,1")?.spill);
  const view = new EngineeringView(true);
  try {
    view.sync(state);
    const mesh = view.group.getObjectByName("Water current highlights");
    assert.ok(mesh instanceof THREE.InstancedMesh);
    const axes = new Set<string>();
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const direction = new THREE.Vector3(1, 0, 0).transformDirection(matrix);
      axes.add(direction.toArray().map(Math.round).join(","));
    }
    for (const axis of ["1,0,0", "0,0,1", "0,-1,0"]) assert.ok(axes.has(axis), axis);
    const shader = { uniforms: {}, vertexShader: "#include <common>\n#include <begin_vertex>" };
    mesh.material.onBeforeCompile(shader);
    const uniforms = shader.uniforms as {uFlowTime: {value: number}};
    const version = mesh.instanceMatrix.version;
    for (const t of [0, 1/60, 0.25, 2.1]) {
      view.animate(state, t);
      assert.equal(uniforms.uFlowTime.value, t);
      assert.equal(mesh.instanceMatrix.version, version);
    }
    assert.ok(applyInfrastructureStroke(state, {kind: "aqueduct", height: 2, outlet: "cap"}, [p(2, 1)]).valid);
    view.sync(state);
    const capped = view.group.getObjectByName("Water current highlights");
    assert.ok(capped instanceof THREE.InstancedMesh);
    assert.ok(capped.count < mesh.count);
  } finally {
    view.dispose();
  }
});
