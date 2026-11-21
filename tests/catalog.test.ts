import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import "../src/game/designs/index";
import { ELEMENTS, getElementLevelName, getMaxElementLevel, getStandardFootprintForLevel } from "../src/game/catalog";
import { DESIGNS } from "../src/game/designs/registry";
import {buildDesignVoxels} from "../src/game/voxelArchitect";
import { PixelVox } from "../src/game/voxelCore";

function hashVoxels(voxels: PixelVox, hx = Infinity, hz = Infinity): string {
  const keys = Array.from(voxels.v.keys()).sort((a, b) => a - b);
  const pairs = new Int32Array(keys.length * 2);
  let end = 0;
  for (const k of keys) {
    const x = ((k >>> 20) & 1023) - 512, z = (k & 1023) - 512;
    if (x < -hx || x >= hx || z < -hz || z >= hz) continue;
    pairs[end++] = k;
    pairs[end++] = voxels.v.get(k)!;
  }
  assert.ok(end > 0, "Empty model or moving part");
  return createHash("sha256").update(pairs.subarray(0, end)).digest("hex");
}

test("the catalog and the design registry cover the same elements", () => {
  assert.deepEqual(Object.keys(DESIGNS).sort(), ELEMENTS.map(d => d.id).sort());
});

for (const def of ELEMENTS) {
  test(def.name + " has all buildable stages in four distinct styles", () => {
    const d = DESIGNS[def.id];
    assert.ok(d);
    const cap = getMaxElementLevel(def.id);
    assert.equal(new Set(Array.from({length:cap},(_,i)=>getElementLevelName(def,i+1))).size, cap);
    const states = new Map<string, string>();
    for (let level = 1; level <= cap; level++) {
      const [sx, sz] = d.footprints[Math.min(level,d.footprints.length) - 1];
      assert.deepEqual(getStandardFootprintForLevel(def, level), [sx, sz]);
      assert.ok([sx, sz].every(n => Number.isInteger(n) && n >= 1 && n <= 4));
      for (let v = 0; v < 4; v++) {
        const signature = (def.isNetwork ? [5, 15, 5 | 256 | 4096] : [0]).map(mask => {
          const c = buildDesignVoxels(def,level,v,sx,sz,mask);
          const parts = c.rotors.map(r => [r.pivot, r.axis, hashVoxels(r.vox)]);
          return JSON.stringify([hashVoxels(c.v, c.hx, c.hz), parts]);
        }).join("|");
        const label = "level " + level + ", style " + (v + 1);
        assert.ok(!states.has(signature), label + " duplicates " + states.get(signature));
        states.set(signature, label);
      }
    }
  });
}
