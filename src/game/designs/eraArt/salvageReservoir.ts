import { byLv, tree, type Ctx, type PixelVox } from "../kit";
import {
  board,
  cabin,
  canvas,
  copper,
  frame,
  garden,
  iron,
  lamp,
  linen,
  rack,
  readingSeat,
  resident,
  rust,
  sage,
  shell,
  steel,
  timber,
  tin,
  walk,
  wood,
} from "./salvageCivicKit";

// Greenhouse ribs shelter a long reading bench. The open bays keep the shelves and residents visible from the street.
function glasshouse(v: PixelVox, x: number, y: number, z: number, w: number, d: number, h: number) {
  const half = Math.floor(w / 2);
  for (let k = 0; k < d; k += Math.max(3, Math.floor(d / 3))) {
    for (const side of [-1, 1]) v.box(x + side * half, y, z + k, x + side * half + 1, y + h, z + k + 1, wood);
    frame(v, x, y + h, z + k, half, 3, tin);
  }
  timber(v, x, y + h + 3, z, x, y + h + 3, z + d - 1, steel);
  for (let k = 1; k < d - 1; k += 4) {
    timber(v, x - half, y + h, z + k, x - 1, y + h + 2, z + k, "#a7c3b0");
    timber(v, x + 1, y + h + 2, z + k, x + half, y + h, z + k, "#a7c3b0");
  }
}
function cistern(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = lv < 3 ? -1 : -3,
    r = byLv(c, [5, 6, 9, 12, 15]),
    rz = lv < 3 ? 4 : Math.min(r, hz - 5),
    h = lv + 3;
  v.cylinderY(0, z, 0, 2, Math.min(r, rz), wood);
  shell(v, 0, z, 1, r, rz, h, 0.9, 5.5, steel);
  for (let a = 1.65; a < 4.9; a += 0.46) {
    const x = Math.round((r - 2) * Math.sin(a)),
      zz = z + Math.round((rz - 2) * Math.cos(a));
    rack(v, x - 1, 2, zz, 3, lv >= 3 ? 2 : 1);
  }
  readingSeat(v, 0, 2, z + 1);
  walk(v, 0, z + 2, hz);
  v.put(2, h, z - rz + 1, lamp, 0.7);
  if (lv >= 2) {
    board(v, -hx + 2, 2, z, 7, 5, wood);
    rack(v, -hx + 3, 3, z, 5);
    timber(v, -r, 2, z, -hx + 6, 2, z + 1, wood, 1);
  }
  if (lv >= 3) {
    board(v, -5, h, z - rz + 1, 11, 6, wood);
    glasshouse(v, 0, h + 1, z - rz + 1, 9, 5, 3);
    garden(v, -4, h + 1, z - rz + 2, 5, 4);
  }
  if (lv >= 4) {
    board(v, r - 4, 3, z + 1, 8, 5, copper);
    readingSeat(v, r - 1, 4, z + 3);
    timber(v, r - 2, h, z - 2, r - 1, 4, z + 3, wood);
  }
  if (lv === 5) {
    glasshouse(v, -r + 1, 3, z, 7, 8, 4);
    garden(v, -6, 1, 7, 10, 5);
    tree(v, 5, 1, 7, "round", 0.65, 8);
    timber(v, -r + 2, 4, z + 7, -5, 2, 9, wood, 1);
  }
}
function splitTank(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = lv < 3 ? -1 : -2,
    r = byLv(c, [3, 4, 6, 8, 9]),
    dx = byLv(c, [3, 8, 8, 11, 12]),
    h = lv + 3;
  for (const side of [-1, 1]) {
    const center = side * dx;
    shell(v, center, z, 1, r, r, h, side < 0 ? Math.PI : 0, side < 0 ? 2 * Math.PI : Math.PI, side < 0 ? rust : steel);
    board(v, center - (side < 0 ? r : 0), 1, z - r, r + 1, 2 * r + 1, wood);
    rack(v, center - (side < 0 ? 2 : 1), 2, z - r + 1, 3);
  }
  board(v, -dx, 2, z + 1, dx * 2 + 1, 3, wood);
  readingSeat(v, 0, 3, z + 2);
  walk(v, 0, z + 3, hz);
  if (lv >= 2) {
    board(v, -dx - 2, h, z - r, 5, 2 * r + 1, wood);
    garden(v, -dx - 1, h + 1, z - r + 1, 3, 4);
  }
  if (lv >= 3) {
    glasshouse(v, dx, h, z - r + 1, 7, r + 2, 3);
    rack(v, dx - 2, h + 1, z - r + 2, 4);
  }
  if (lv >= 4) {
    timber(v, dx, h + 1, z, 0, 5, z + 5, tin, 1);
    timber(v, 0, 5, z + 5, -dx, h, z, wood, 1);
    garden(v, -5, 1, z + 6, 7, 4);
  }
  if (lv === 5) {
    cabin(v, -4, 1, -hz + 3, 9, 7, 5, canvas);
    timber(v, -dx, h, z - r + 2, 0, 5, -hz + 8, wood, 1);
    tree(v, 3, 1, 8, "round", 0.68, 18);
  }
}
function shelfLane(c: Ctx) {
  const { lv, hx, hz, v } = c,
    z = lv < 3 ? -3 : -5,
    len = byLv(c, [8, 20, 21, 31, 36]),
    left = -Math.floor(len / 2),
    tiers = lv < 3 ? 2 : 3;
  board(v, left - 1, 0, z - 1, len + 2, 9, "path");
  for (let x = left; x < left + len - 1; x += 6) {
    rack(v, x, 1, z, Math.min(5, left + len - x), tiers);
    if (x + 4 < left + len) {
      v.box(x - 1, 1, z - 1, x, tiers * 2 + 3, z + 1, steel);
      v.put(x - 1, tiers * 2 + 2, z + 1, lamp, 0.5);
    }
  }
  walk(v, left + 2, z + 3, hz);
  readingSeat(v, left + 3, 1, z + 4);
  if (lv >= 2) {
    rack(v, left + 6, 1, z + 6, 5);
    cabin(v, left + len - 6, 1, z - 2, 5, 5, 4, rust);
  }
  if (lv >= 3) {
    for (let xx = left + 2; xx < left + len - 3; xx += 7) {
      timber(v, xx, 6, z - 1, xx + 2, 5, z + 5, tin);
      board(v, xx, 6, z, 3, 5, linen);
    }
    garden(v, 4, 1, 5, 6, 4);
  }
  if (lv >= 4) {
    board(v, left + 5, 6, z - 4, 13, 4, wood);
    rack(v, left + 7, 7, z - 4, 8);
    timber(v, left + 17, 1, z + 3, left + 8, 6, z - 2, wood, 1);
  }
  if (lv === 5) {
    glasshouse(v, hx - 10, 1, z + 5, 9, 10, 5);
    garden(v, hx - 12, 1, z + 6, 5, 7);
    tree(v, left + 4, 1, z + 9, "round", 0.7, 11);
  }
}
function storyGarden(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -1 : -4,
    z = -Math.floor(hz * 0.33),
    w = byLv(c, [7, 9, 13, 15, 17]),
    d = byLv(c, [7, 8, 12, 14, 16]);
  board(v, x - Math.floor(w / 2), 0, z - 1, w, d, wood);
  glasshouse(v, x, 1, z, w, d, 3 + Math.floor(lv / 2));
  garden(v, x - Math.floor(w / 2) + 1, 1, z + 1, 4, d - 2);
  rack(v, x, 1, z + 1, Math.max(3, Math.floor(w / 2) - 1), 2);
  readingSeat(v, x + 1, 1, z + d - 3);
  walk(v, x + 1, z + d - 2, hz);
  if (lv >= 2) {
    shell(v, hx - 6, 1, 1, 3, 3, 4, 1, 5.4, rust);
    rack(v, hx - 7, 2, 0, 3);
    timber(v, x + 3, 1, z + 4, hx - 6, 1, 2, wood, 1);
  }
  if (lv >= 3) {
    garden(v, -hx + 3, 1, 4, 7, 6);
    cabin(v, hx - 10, 1, -hz + 3, 7, 6, 5, linen);
  }
  if (lv >= 4) {
    glasshouse(v, hx - 10, 2, 2, 9, 9, 4);
    garden(v, hx - 12, 2, 3, 5, 6);
    timber(v, x + 4, 3, z + 5, hx - 10, 2, 6, wood, 1);
  }
  if (lv === 5) {
    tree(v, x + 3, 1, hz - 8, "round", 0.8, 7);
    shell(v, -hx + 8, 7, 1, 5, 5, 5, 0.9, 5.2, steel);
    rack(v, -hx + 10, 2, 5, 4);
    garden(v, -4, 1, 9, 7, 6);
  }
}
// A shelved cistern, split reading tank, spines along a pedestrian lane and greenhouse story rooms give the library four plans.
export function reservoir(c: Ctx, active: boolean) {
  c.vpick([cistern, splitTank, shelfLane, storyGarden])(c);
  if (active) {
    const { v, lv, hz } = c;
    const x = c.vpick([0, 0, -Math.floor(byLv(c, [8, 20, 21, 31, 36]) / 2) + 3, lv < 3 ? 0 : -3]);
    const z = c.vpick([
      lv < 3 ? 1 : 0,
      lv < 3 ? 2 : 1,
      lv < 3 ? 2 : 0,
      -Math.floor(hz * 0.33) + byLv(c, [7, 8, 12, 14, 16]) - 3,
    ]);
    resident(v, x + 1, 2, z + 1, "#a16b79");
    v.put(x, 2, z + 1, linen);
  }
}
