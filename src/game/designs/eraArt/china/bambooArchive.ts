import { bench, type Ctx } from "../../kit";
import { beam, oval, slab } from "../../sculpturalKit";
import { streetLamp, clerk, courtPath, cypress, ink, lantern, slip, stairs, timberBay } from "./civicParts";

function fanCourt(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = hz - 5,
    count = 4 + lv * 2;
  // Cut slats splay out from a silk binding; the courtyard remains open beneath them.
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1),
      endX = Math.round((t * 2 - 1) * (hx - 3));
    const endZ = -hz + 2 + Math.round(Math.abs(t * 2 - 1) * (hz * 0.45));
    const top = 5 + lv + Math.round(3 * Math.sin(t * Math.PI));
    slip(v, [Math.round((t - 0.5) * (lv + 1)), 3, z], [endX, top, endZ], 2);
    if (i === 0 || i === count - 1 || i % 3 === 1) v.box(endX, 1, endZ, endX + 1, top, endZ + 1, ink.sill);
  }
  beam(v, [-Math.min(4, lv + 1), 3, z], [Math.min(4, lv + 1), 3, z], ink.cord);
  bench(v, -3, 1, z - 1);
  courtPath(c, 0, z);
  if (lv >= 2) timberBay(v, -hx + 5, hz - 5, 4, 3, 1, 3);
  if (lv >= 3) {
    cypress(v, hx - 4, hz - 4, 7);
    clerk(v, -hx + 5, 2, hz - 4);
  }
  if (lv >= 4) {
    const x = hx - 5;
    timberBay(v, x, 3, 4, 3, 1, 5);
    lantern(v, x, 5, 5);
    v.box(-hx + 4, 0, 4, hx - 2, 1, 6, ink.stone);
  }
  if (lv === 5) {
    timberBay(v, -hx + 6, -hz + 6, 5, 4, 1, 5);
    stairs(v, 0, -hz + 9, 4, 3, 4);
  }
}

function hingedWalk(c: Ctx) {
  const { v, lv, hx, hz } = c,
    turns = lv + 1;
  // An accordion manuscript changes direction at every silk hinge. The reading walk follows its folds.
  let x = -hx + 3,
    z = 2;
  for (let i = 0; i < turns; i++) {
    const nx = Math.round(-hx + 3 + ((2 * hx - 7) * (i + 1)) / turns),
      nz = i % 2 ? Math.round(hz * 0.36) : -hz + 3;
    const h = 5 + lv + (i % 2) * 3;
    for (let q = 0; q <= 3; q++) {
      slip(v, [x, Math.max(3, h - 3 + q), z + q], [nx, h + q, nz + q], 1);
    }
    v.box(x, 1, z, x + 2, h, z + 2, ink.post);
    beam(v, [x, 1, z + 3], [nx, 1, nz + 3], ink.stone, 2);
    if (i % 2 === 0) lantern(v, x, Math.max(2, h - 3), z + 1);
    x = nx;
    z = nz;
  }
  v.box(x, 1, z, x + 2, 6 + lv, z + 2, ink.post);
  courtPath(c, -hx + 3, 3);
  if (lv >= 2) {
    bench(v, 1, 1, 1);
    clerk(v, 0, 1, 3);
  }
  if (lv >= 3) timberBay(v, hx - 6, hz - 6, 4, 3, 1, 4);
  if (lv >= 4) timberBay(v, -hx + 6, -hz + 6, 4, 4, 1, 5);
  if (lv === 5) {
    cypress(v, 7, hz - 5, 9);
    timberBay(v, 0, hz - 7, 5, 3, 1, 5);
  }
}

function slipAlleys(c: Ctx) {
  const { v, lv, hx, hz } = c,
    rear = -hz + 3,
    rows = Math.min(lv + 1, 5);
  // Tall bound bundles separate narrow aisles. The central visitor path and the ends remain open.
  for (let row = 0; row < rows; row++) {
    const x = Math.round(-hx + 3 + ((2 * hx - 8) * row) / (rows - 1)),
      start = rear + (row % 2) * 2;
    const span = Math.max(5, hz - 1 + (lv >= 3 ? 3 : 0)),
      h = 6 + lv + ((row + 1) % 3) * 2;
    for (let k = 0; k < span; k += 2) {
      const high = h + (k % 5 === 0 ? 2 : 0);
      v.box(x, 1, start + k, x + 2, high, start + k + 2, k % 4 === 0 ? ink.bamboo : ink.inside);
      v.put(x + 1, high, start + k, ink.sill);
      v.put(x + 1, high - 2, start + k + 1, ink.cord);
    }
    for (const y of [3, h - 2]) v.box(x - 1, y, start, x, y + 1, start + span, ink.cord);
    if (lv >= 2 && row % 2 === 0) bench(v, x, 1, start + span + 2, "z");
  }
  courtPath(c, 0, -hz + 3);
  if (lv >= 2) clerk(v, 2, 1, hz - 4);
  if (lv >= 3) timberBay(v, 0, hz - 6, 4, 3, 1, 3);
  if (lv >= 4) {
    v.box(-hx + 3, 8, -hz + 5, hx - 3, 9, -hz + 3 + 4, ink.sill);
    lantern(v, 0, 7, -hz + 7);
  }
  if (lv === 5) {
    timberBay(v, -hx + 7, hz - 7, 5, 3, 1, 5);
    cypress(v, hx - 5, hz - 5, 8);
  }
}

function storyGarden(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const centerZ = -Math.floor(hz * 0.25),
    r = Math.max(4, Math.min(hx - 4, hz - 3));
  const platforms = lv >= 3 ? 3 : lv;
  // A fold-out garden theatre has tiers of face-out illustrated strips framing a model landscape.
  for (let tier = 0; tier < platforms; tier++) {
    const radius = r * (1 - tier * 0.19),
      floor = 1 + tier * 2;
    slab(v, oval(0, centerZ, radius, radius * 0.65, 16), floor, 2, tier % 2 ? ink.sill : ink.bamboo);
    const blades = 4 + tier + lv;
    for (let i = 0; i < blades; i++) {
      const a = Math.PI * (0.05 + (0.9 * i) / (blades - 1)),
        x = Math.round(Math.cos(a) * radius);
      const z = centerZ - Math.round(Math.sin(a) * radius * 0.61),
        h = 4 + lv + tier * 2 + Number(i % 3 === 1) * 3;
      slip(v, [x, floor + 1, z], [x + Math.sign(x), floor + h, z - 1], 2);
    }
  }
  stairs(v, 0, centerZ + r, 2, 2 + platforms, Math.max(3, r - 1));
  courtPath(c, 0, centerZ + r);
  if (lv >= 2) {
    bench(v, -hx + 3, 1, hz - 3);
    clerk(v, 2, 3, centerZ);
  }
  if (lv >= 3) cypress(v, hx - 4, hz - 6, 9);
  if (lv >= 4) {
    timberBay(v, -hx + 7, hz - 6, 5, 3, 1, 4);
    lantern(v, -hx + 7, 4, hz - 4);
  }
  if (lv === 5) {
    timberBay(v, hx - 8, hz - 7, 6, 4, 1, 5);
    cypress(v, -hx + 4, -hz + 5, 7);
  }
}

export function buildBambooArchive(c: Ctx) {
  [fanCourt, hingedWalk, slipAlleys, storyGarden][c.variant](c);
  const [x, z] = [
    [-c.hx + 4, c.hz - 3],
    [c.hx - 2, c.hz - 3],
    [1, c.hz - 3],
    [-c.hx + 5, c.hz - 4],
  ][c.variant];
  streetLamp(c.v, x, z, 4 + Number(c.lv >= 3));
}
