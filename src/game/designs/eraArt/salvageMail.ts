import { byLv, type Ctx, type PixelVox } from "../kit";
import {
  board,
  cabin,
  canvas,
  copper,
  garden,
  iron,
  lamp,
  linen,
  resident,
  rust,
  steel,
  timber,
  tin,
  walk,
  wood,
} from "./salvageCivicKit";

function bag(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 2, y + 2, z + 2, "#c38d57");
  v.put(x, y + 2, z, iron);
}
function bicycle(v: PixelVox, x: number, z: number) {
  for (const dx of [0, 3]) {
    v.put(x + dx, 1, z, iron);
    v.put(x + dx, 2, z, steel);
  }
  timber(v, x, 2, z, x + 2, 3, z, canvas);
  timber(v, x + 2, 3, z, x + 3, 2, z, canvas);
  v.put(x + 1, 4, z, wood);
  v.put(x + 3, 4, z, iron);
}
function carriage(v: PixelVox, x: number, z: number, w: number, col: string) {
  for (const xx of [x + 1, x + w - 2]) {
    v.box(xx, 1, z, xx + 1, 3, z + 1, iron);
    v.box(xx, 1, z + 3, xx + 1, 3, z + 4, iron);
  }
  board(v, x, 3, z, w, 5, wood);
  v.box(x, 4, z, x + w, 7, z + 1, col);
  for (let i = 0; i < w; i++) {
    if (i % 5 === 0 || i === w - 1) {
      v.box(x + i, 4, z, x + i + 1, 7, z + 5, col);
      v.put(x + i, 6, z + 4, tin);
    }
    if (i < w * 0.6 || i > w - 4) board(v, x + i, 7, z - 1, 1, 7, i % 4 === 0 ? tin : col);
    if (i % 4 === 2) v.put(x + i, 5, z + 4, linen);
  }
  v.box(x + 1, 4, z + 4, x + w - 1, 5, z + 5, col);
  v.put(x + w - 2, 6, z + 4, lamp, 0.55);
}
function counter(v: PixelVox, x: number, z: number, active: boolean) {
  board(v, x, 2, z, 4, 2, wood);
  bag(v, x, 3, z);
  resident(v, x + 1, 1, z - 1, canvas);
  if (active) resident(v, x + 3, 1, z + 2, "#b37568");
}
function mailLine(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    x = -hx + 2,
    z = -hz + 3,
    w = byLv(c, [10, 19, 23, 27, 30]);
  carriage(v, x, z, w, canvas);
  v.box(x, 0, z + 1, hx - 2, 1, z + 2, iron);
  v.box(x, 0, z + 4, hx - 2, 1, z + 5, iron);
  counter(v, x + 1, z + 7, active);
  walk(v, x + 2, z + 7, hz);
  if (lv >= 2) {
    bicycle(v, hx - 7, 3);
    bag(v, active ? x + 5 : x + 2, 4, z + 3);
  }
  if (lv >= 3) {
    carriage(v, hx - 13, z + 9, 10, rust);
    timber(v, x + w - 6, 5, z + 4, hx - 8, 4, z + 10, wood, 1);
    bicycle(v, -hx + 4, 8);
  }
  if (lv >= 4) {
    cabin(v, -hx + 3, 1, 2, 10, 6, 6, linen);
    timber(v, x + 6, 9, z, hx - 8, 7, z + 9, iron);
    bag(v, 0, 6, z + 5);
  }
  if (lv === 5) {
    carriage(v, hx - 16, 6, 13, steel);
    timber(v, hx - 9, 9, z + 10, hx - 9, 7, 7, iron);
    garden(v, 1, 1, 6, 6, 4);
  }
}
function pulley(v: PixelVox, x: number, z: number, height: number) {
  for (const side of [-1, 1]) timber(v, x + side * 2, 1, z + side, x, height, z, wood);
  v.box(x - 1, height, z - 1, x + 2, height + 2, z + 2, steel);
  v.put(x, height + 1, z + 2, copper);
}
function mailBridge(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    left = -hx + 3,
    right = hx - 4,
    z = lv < 3 ? -2 : -5,
    h = byLv(c, [6, 7, 9, 11, 13]);
  pulley(v, left, z, h);
  pulley(v, right, z + 2, h - 1);
  timber(v, left, h + 1, z, 0, h - 1, z + 1, iron);
  timber(v, 0, h - 1, z + 1, right, h, z + 2, iron);
  const cart = active ? Math.floor(right * 0.45) : Math.round(left * 0.5);
  timber(v, cart, h - 1, z + 1, cart, h - 3, z + 1, iron);
  bag(v, cart, h - 5, z + 1);
  counter(v, Math.max(left, -5), z + 5, active);
  walk(v, Math.max(left, -5) + 2, z + 4, hz);
  if (lv >= 2) {
    carriage(v, left, z - 3, 8, canvas);
    bicycle(v, right - 3, 4);
  }
  if (lv >= 3) {
    board(v, left, 2, z + 6, right - left + 1, 3, wood);
    cabin(v, right - 6, 1, z + 5, 8, 6, 5, linen);
    bicycle(v, left + 3, 4);
  }
  if (lv >= 4) {
    timber(v, left, 6, z - 1, right - 3, 8, z - 1, wood);
    for (let xx = left + 3; xx < right - 2; xx += 6) timber(v, xx, 6, z - 1, xx + 3, h - 1, z, steel);
    carriage(v, 2, 6, 12, rust);
  }
  if (lv === 5) {
    carriage(v, left + 1, 6, 14, steel);
    pulley(v, left + 5, 10, 10);
    timber(v, left, h, z, left + 5, 11, 10, iron);
    bag(v, left + 3, 7, 5);
  }
}
function bikeCourt(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? 0 : -2,
    z = lv < 3 ? 0 : 2,
    r = byLv(c, [4, 5, 7, 8, 10]);
  v.cylinderY(x, z, 0, 1, r, wood);
  for (let i = 0; i < lv + 2; i++) {
    const a = 0.2 + (i / (lv + 2)) * 5.7,
      xx = x + Math.round((r - 1) * Math.sin(a)),
      zz = z + Math.round((r - 1) * Math.cos(a));
    bicycle(v, xx - 1, zz);
    v.put(xx - 1, 0, zz + 1, linen);
  }
  counter(v, x - 2, z - 1, active);
  walk(v, x, z + 2, hz);
  if (lv >= 2) {
    carriage(v, -hx + 2, -hz + 2, 8, canvas);
    bag(v, x + 2, 1, z - 2);
  }
  if (lv >= 3) {
    carriage(v, 0, -hz + 3, 12, steel);
    timber(v, x - r, 5, z - 3, x + r, 5, z - 3, iron);
    board(v, x - r + 2, 5, z - 4, r + 2, 3, linen);
  }
  if (lv >= 4) {
    cabin(v, -hx + 3, 1, 0, 8, 7, 5, rust);
    garden(v, hx - 8, 1, 4, 5, 6);
  }
  if (lv === 5) {
    pulley(v, hx - 6, -hz + 6, 9);
    pulley(v, x, 2, 7);
    timber(v, x, 8, 2, hx - 6, 10, -hz + 6, iron);
    bag(v, hx - 12, 6, -4);
    carriage(v, hx - 14, 5, 10, canvas);
  }
}
function signalPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    x = -hx + 3,
    z = -hz + 3,
    h = lv < 3 ? 5 : 7;
  for (const dx of [0, 4]) for (const dz of [0, 3]) v.box(x + dx, 1, z + dz, x + dx + 1, h + 1, z + dz + 1, iron);
  cabin(v, x - 1, h, z - 1, 7, 6, 4, rust);
  resident(v, x + 2, h + 1, z + 3, canvas);
  timber(v, x + 3, h, z + 3, x + 6, 1, z + 7, wood);
  counter(v, x + 4, z + 7, active);
  walk(v, x + 6, z + 8, hz);
  if (lv >= 2) {
    carriage(v, x + 9, z + 1, 12, steel);
    bag(v, active ? x + 12 : x + 10, 4, z + 4);
    bicycle(v, hx - 5, 4);
  }
  if (lv >= 3) {
    carriage(v, 0, 2, 12, canvas);
    timber(v, x + 2, h + 4, z, 5, 8, 2, iron);
    bag(v, -2, 5, -3);
  }
  if (lv >= 4) {
    board(v, x, h + 2, z + 4, 9, 4, wood);
    timber(v, x + 3, h + 2, z + 6, 0, 4, 4, wood, 1);
    bicycle(v, -hx + 7, 8);
  }
  if (lv === 5) {
    cabin(v, hx - 13, 1, -hz + 2, 9, 8, 7, linen);
    timber(v, hx - 6, 9, -hz + 3, hx - 9, 6, 4, iron);
    garden(v, 2, 1, 9, 6, 4);
  }
}
// Cutaway postal carriages, a line of suspended bags, a wheel-filled dispatch court and an elevated signal box each reveal the route.
export function handlineMail(c: Ctx, active: boolean) {
  c.vpick([mailLine, mailBridge, bikeCourt, signalPost])(c, active);
}
