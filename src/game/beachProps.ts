import type { BufferGeometry } from "three";
import type { Ctx } from "./designs/kit";

/** Move each complete parasol, rock, towel, pier or hut as one rigid object. Applying
 * offsets to the existing quads keeps the entire plot in a single draw call. */
export function seatBeachProps(geometry: BufferGeometry, c: Ctx, unit: number, groundShift: number,
  surface: (x: number, z: number) => number) {
  const w = c.hx * 2, h = c.hz * 2, count = w * h;
  const lowest = new Int16Array(count).fill(32767);
  for (const key of c.v.v.keys()) {
    const x = ((key >> 20) & 1023) - 512 + c.hx, z = (key & 1023) - 512 + c.hz;
    const y = ((key >> 10) & 1023) - 512;
    lowest[z * w + x] = Math.min(y, lowest[z * w + x]);
  }

  const seen = new Uint8Array(count), offsets = new Float32Array(count);
  for (let start = 0; start < count; start++) {
    if (seen[start] || lowest[start] === 32767) continue;
    const group = [start], contact: number[] = [];
    seen[start] = 1;
    for (let n = 0; n < group.length; n++) {
      const i = group[n], x = i % w, z = Math.floor(i / w);
      if (lowest[i] <= 1) contact.push(surface((x - c.hx + 0.5) * unit, (z - c.hz + 0.5) * unit));
      const visit = (j: number) => {
        if (!seen[j] && lowest[j] !== 32767) { seen[j] = 1; group.push(j); }
      };
      if (x > 0) visit(i - 1);
      if (x + 1 < w) visit(i + 1);
      if (z > 0) visit(i - w);
      if (z + 1 < h) visit(i + w);
    }
    if (!contact.length) continue;
    contact.sort((a, b) => a - b);
    const offset = contact[Math.floor((contact.length - 1) * 0.65)] - unit - groundShift - 0.008;
    for (const i of group) offsets[i] = offset;
  }
  const pos = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  for (let i = 0; i < pos.count; i += 4) {
    // The center projected just inside the face identifies its source voxel, including vertical faces.
    const x = Math.floor((pos.getX(i) + pos.getX(i + 2)) / (2 * unit) - normal.getX(i) * 0.01) + c.hx;
    const z = Math.floor((pos.getZ(i) + pos.getZ(i + 2)) / (2 * unit) - normal.getZ(i) * 0.01) + c.hz;
    const dy = offsets[z * w + x] || 0;
    for (let j = i; j < i + 4; j++) pos.setY(j, pos.getY(j) + dy);
  }
  geometry.computeBoundingSphere();
}
