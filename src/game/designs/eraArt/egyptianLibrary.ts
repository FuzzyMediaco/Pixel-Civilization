import { bench, type Ctx, type PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import {
  approach,
  attendant,
  bundle,
  cedar,
  desk,
  faience,
  gold,
  ivory,
  lapis,
  limestone,
  oil,
  papyrus,
  reed,
  red,
  water,
} from "./egyptianCraft";

// A closed cross-section of coiled papyrus with a visible spiral down both cut ends.
function roller(v: PixelVox, x: number, y: number, z0: number, z1: number, r: number) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.2) continue;
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      const ink = Math.abs(d - r * (0.24 + 0.62 * angle)) < 0.55 || d < 0.8;
      v.box(x + dx, y + dy, z0, x + dx + 1, y + dy + 1, z1, d > r - 0.7 ? reed : ivory);
      for (const z of [z0, z1 - 1]) v.put(x + dx, y + dy, z, ink ? cedar : ivory);
    }
  for (let z = z0 + 3; z < z1 - 1; z += 7) {
    v.put(x, y + r, z, gold);
    v.put(x + r, y - 1, z, "#dcab6e", 0.35);
  }
}
function reading(v: PixelVox, x: number, z: number, active: boolean) {
  bench(v, x - 1, 1, z, "x", cedar);
  attendant(v, x, 1, z - 1, active);
  oil(v, x + 2, 1, z, active);
}
function scrollCourt(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    r = lv < 3 ? 2 : 3,
    d = lv === 1 ? 3 : Math.min(hx - 5, 6 + lv);
  const rear = -hz + 2,
    front = lv >= 3 ? 1 : 2,
    y = lv >= 4 ? 8 : 5;
  for (const side of [-1, 1]) {
    roller(v, side * d, y, rear, front + 1, r);
    for (let z = rear + 1; z < front; z += 5) bundle(v, side * d, 1, z, y - r + 1);
    v.box(side * d - 1, 1, front - 1, side * d + 2, 3, front + 1, limestone);
  }
  // A single sheet starts at one roll, bridging a shaded public return window.
  const bindingDepth = lv === 1 ? 3 : Math.min(11, 3 + lv);
  for (let z = rear; z < rear + bindingDepth; z++) {
    const sag = z === rear || z === rear + bindingDepth - 1 ? 0 : 1;
    for (let x = -d; x <= d; x++) v.put(x, y - sag, z, z - rear === 2 && (x + d) % 6 < 3 ? lapis : ivory);
  }
  if (lv >= 2) {
    desk(v, -d + 2, 1, front + 1, active);
    reading(v, d - 1, front + 3, active);
  }
  if (lv >= 3) {
    v.box(-d, 1, front + 5, d + 1, 2, front + 8, limestone);
    bench(v, -1, 2, front + 6);
  }
  if (lv >= 4) {
    roller(v, -hx + 5, 5, front + 3, hz - 3, 2);
    bundle(v, -hx + 5, 1, hz - 4, 5);
  }
  if (lv >= 5) {
    roller(v, d, 7, 4, hz - 5, r);
    v.box(-d, 6, hz - 9, d + 1, 7, hz - 6, ivory);
    bundle(v, -d, 1, hz - 8, 6);
    papyrus(v, 0, 9, 6);
    for (let z = rear + 4; z < -2; z += 4) {
      const a = d - 3;
      bundle(v, a, 1, z, 8);
      desk(v, a - 2, 1, z, active);
    }
    // A single enlarged listening roll lifts up above the ground-floor collection.
    roller(v, -d, 10, rear + 4, -3, 4);
    v.box(-d, 8, -6, 1, 9, -2, ivory);
    bundle(v, -1, 1, -4, 8);
  }
  reading(v, 0, lv >= 3 ? 3 : 5, active);
}
function openSheet(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x0 = -hx + 2,
    x1 = lv >= 3 ? hx - 6 : hx - 2;
  const z0 = -hz + 2,
    z1 = lv >= 3 ? Math.floor(hz * 0.32) : 2;
  for (let x = x0; x < x1; x++) {
    const t = (x - x0) / (x1 - x0),
      y = 4 + Math.round((2 + lv * 0.55) * t * t);
    const back = z0 + Math.floor(t * (lv >= 3 ? 6 : 2));
    v.box(x, y, back, x + 1, y + 1, z1, (x - x0) % 10 === 2 ? reed : ivory);
    // Short ink columns and rubric marks are written directly on the occupied page.
    const withinLine = (x - x0) % 6;
    if (withinLine < 3 && x > x0 + 1)
      for (let z = back + 2; z < z1 - 1; z += 4)
        v.put(x, y, z, withinLine === 2 && (z - back) % 8 === 2 ? red : cedar);
    if ((x - x0) % 8 === 0) {
      bundle(v, x, 1, back + 1, y);
      v.put(x, y, z1 - 1, "#e3ad69", 0.34);
    }
  }
  roller(v, x1 - 1, 7 + Math.floor(lv / 2), z0 + (lv >= 3 ? 6 : 2), z1 + 1, 2);
  if (lv >= 2) {
    v.box(x0 + 1, 1, z1 - 2, x0 + 6, 4, z1, limestone);
    desk(v, x0 + 4, 1, z1 + 1, active);
  }
  if (lv >= 3) {
    v.box(x1 - 1, 0, z1 + 2, hx - 1, 1, hz - 2, water);
    for (let z = z1 + 3; z < hz - 2; z += 6) papyrus(v, hx - 3, z, 5);
  }
  if (lv >= 4) {
    for (let n = 0; n < 3; n++) v.box(x0 + 2 + n * 2, 1, z1 + 3 + n * 2, 4 - n * 2, 2 + n, z1 + 5 + n * 2, limestone);
  }
  if (lv >= 5) {
    const ox = -hx + 4;
    roller(v, ox, 7, z1 + 3, hz - 2, 3);
    for (let z = z1 + 4; z < hz - 3; z += 5) bundle(v, ox, 1, z, 5);
  }
  reading(v, lv >= 3 ? 1 : 0, z1 + 3, active);
}
function reedAisles(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    z0 = -hz + 3,
    z1 = lv >= 3 ? hz - 5 : 2;
  const left = -hx + 3,
    right = lv === 1 ? 2 : Math.min(hx - 5, 4 + lv);
  for (const [x, top, end] of [
    [left, 6 + lv, z1],
    [right, 4 + lv, z1 - (lv >= 3 ? 6 : 3)],
  ]) {
    for (let z = z0; z <= end; z += 5) {
      bundle(v, x, 1, z, top);
      for (const [dx, dz, h] of [
        [-1, 0, -1],
        [1, 0, -2],
        [0, 1, 0],
      ]) {
        v.box(x + dx, 2, z + dz, x + dx + 1, top + h, z + dz + 1, reed);
        v.put(x + dx, top + h - 1, z + dz, faience);
      }
    }
    v.box(x - 1, top, z0 - 1, x + 2, top + 1, end + 1, ivory);
    for (let z = z0 + 2; z < end; z += 7) v.put(x + 1, top, z, "#e2ac6f", 0.32);
  }
  if (lv >= 2) {
    // Shelves between the colonnade piers hold short rolled manuscripts on their sides.
    for (let z = z0 + 1; z < z1 - 1; z += 5) {
      v.box(left + 1, 2, z, left + 4, 3, z + 4, cedar);
      v.box(left + 1, 5, z, left + 4, 6, z + 4, cedar);
      for (let i = 0; i < 3; i++) {
        v.box(left + 1, 3, z + i, left + 4, 4, z + i + 1, i === 1 ? reed : ivory);
        v.put(left + 3, 4, z + i, i === 1 ? red : ivory);
      }
    }
  }
  if (lv >= 2) {
    desk(v, left + 4, 1, z0 + 1, active);
    v.box(left, 6 + lv, z0 - 1, right + 1, 7 + lv, z0 + 1, reed);
  }
  if (lv >= 3) {
    reading(v, right - 2, 5, active);
    v.box(right + 2, 1, z0, right + 4, 4, z0 + 7, cedar);
  }
  if (lv >= 4) {
    for (let z = z0 + 3; z < z1; z += 6) roller(v, left + 5, 5, z, z + 3, 2);
  }
  if (lv >= 5) {
    const x = hx - 7;
    for (let z = 1; z < hz - 3; z += 5) bundle(v, x, 1, z, 10);
    v.box(right, 9, 1, x + 2, 10, 4, ivory);
    v.box(x - 1, 10, 0, x + 2, 11, hz - 3, reed);
    for (let k = 0; k < 3; k++) {
      const z = -hz + 5 + k * 5;
      v.box(-6, 2, z, 3, 3, z + 2, limestone);
      reading(v, -3, z + 2, active);
    }
    v.box(-5, 0, 5, 6, 1, 12, water);
    papyrus(v, 4, 7, 5);
  }
  reading(v, 0, z1 + 2, active);
}
function mapGarden(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    rear = -hz + 2;
  const half = lv === 1 ? 5 : Math.min(hx - 4, 8 + lv);
  // A folded route map rises on opposing creases. The river is drawn across the actual relief.
  for (let x = -half; x <= half; x++) {
    const wave = Math.abs(((x + half) % 9) - 4),
      depth = 4 + Math.floor((x + half) * 0.24) + (lv >= 3 ? lv : 0);
    for (let z = 0; z < depth; z++) {
      const y = 3 + wave + Math.floor(z / 5) + (lv >= 4 && x > 0 ? Math.floor(x / 5) : 0);
      const river = Math.round(depth * (0.48 + 0.2 * Math.sin(x / 4)));
      v.put(
        x,
        y,
        rear + z,
        Math.abs(z - river) < (lv >= 3 ? 1.4 : 0.6)
          ? faience
          : (x + half) % 9 === 4
            ? gold
            : z === river + 3 && x % 5 === 0
              ? red
              : ivory,
      );
    }
    if ((x + half) % 9 === 4) {
      bundle(v, x, 1, rear + 1, 7);
      oil(v, x, 1, rear + depth, active);
    }
  }
  if (lv >= 2) {
    roller(v, -half + 1, 3, rear + 2, 2, 2);
    desk(v, half - 1, 1, -1, active);
  }
  if (lv >= 3) {
    v.box(-5, 0, 2, 5, 1, hz - 3, water);
    v.box(-6, 1, 7, 7, 2, 9, cedar);
    papyrus(v, 4, 4, 5);
  }
  if (lv >= 4) {
    for (let i = 0; i < 3; i++) {
      const x = hx - 7;
      v.box(x - i, 1, 2 + i * 2, x + 3, 2 + i, 4 + i * 2, limestone);
    }
  }
  if (lv >= 5) {
    for (let n = 0; n < 7; n++)
      v.box(-hx + 3 + n, 4 + Math.abs(n - 3), 6, -hx + 4 + n, 5 + Math.abs(n - 3), hz - 3, ivory);
    for (const z of [7, hz - 5]) bundle(v, -hx + 6, 1, z, 6);
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 3;
      for (let j = 0; j < 4; j++)
        v.box(
          x + j,
          5 + Math.abs(j - 2) + i,
          1 + i * 3,
          x + j + 1,
          6 + Math.abs(j - 2) + i,
          10 + i * 3,
          j === 0 ? faience : ivory,
        );
      bundle(v, x + 1, 1, 7 + i * 3, 6 + i);
    }
  }
  reading(v, lv >= 3 ? -7 : 0, hz - 3, active);
}
// Papyrus is an inhabited roll, a single outstretched sheet, bundled aisle or a folded river map.
export const library: SignatureBuilder = (c, _p, active) => {
  approach(c, 2);
  [scrollCourt, openSheet, reedAisles, mapGarden][c.variant](c, active);
  if (c.lv === 1) desk(c.v, -2, 1, 0, active);
};
