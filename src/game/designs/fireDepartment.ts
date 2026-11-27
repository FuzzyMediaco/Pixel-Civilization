// Original public firehouses. The hose reel, bell, ladder and hydrant all shape usable engine bays.
import { byLv, lot, person, type Ctx, type PixelVox } from "./kit";
import { disc } from "./commerceKit";
import { beam } from "./sculpturalKit";

const red = "#b94d42",
  deep = "#713c39",
  cream = "#eedcba",
  steel = "#58636a",
  brass = "#d7ac65",
  lamp = "#ffd18a";
function engine(v: PixelVox, x: number, z: number, large = false) {
  const length = large ? 10 : 7;
  for (const dx of [-2, 2])
    for (const dz of [0, length - 3]) v.box(x + dx, 1, z + dz, x + dx + 1, 3, z + dz + 2, "#343b42");
  v.box(x - 2, 2, z - 1, x + 3, 4, z + length - 1, red);
  v.box(x - 2, 4, z + length - 4, x + 3, 6, z + length - 1, red);
  v.box(x - 1, 4, z + length - 2, x + 2, 6, z + length - 1, "#73939d");
  v.box(x - 2, 6, z + length - 4, x + 3, 7, z + length - 1, cream);
  for (const dx of [-2, 2]) {
    v.put(x + dx, 6, z + length - 3, "#e96451", 0.7);
    v.put(x + dx, 3, z + length - 1, lamp, 0.4);
  }
  for (const dx of [-1, 1]) v.box(x + dx, 4, z, x + dx + 1, 5, z + length - 4, steel);
  for (let bz = z; bz < z + length - 4; bz += 2) v.box(x - 1, 4, bz, x + 2, 5, bz + 1, cream);
}
function bay(v: PixelVox, x: number, z: number, w: number, d: number, h: number) {
  const a = x - Math.floor(w / 2),
    b = a + w;
  v.box(a, 1, z - d, b, h, z - d + 1, deep);
  for (const px of [a, b - 2]) {
    v.box(px, 1, z - d, px + 2, h + 1, z, red);
    v.box(px, 2, z, px + 2, 3, z + 1, cream);
  }
  v.box(a - 1, h, z - d - 1, b + 1, h + 1, z + 1, cream);
  v.box(a + 1, h - 1, z - 1, b - 1, h, z, steel);
  v.put(a + 2, h - 1, z, lamp, 0.6);
}
function publicDesk(v: PixelVox, x: number, z: number) {
  v.box(x - 2, 1, z - 2, x + 3, 4, z, cream);
  v.box(x - 2, 4, z - 3, x + 3, 5, z, red);
  v.put(x + 1, 5, z - 2, lamp, 0.4);
  person(v, x, 1, z - 4, "#516575");
}
function reel(v: PixelVox, x: number, z: number, cy: number, r: number, d: number) {
  // The two flanges bound a reel of hose; the opening beneath its axle is the sheltered engine bay.
  const start = z - d;
  for (const pz of [start, z]) v.ringZ(x, cy, pz, pz + 1, r, r - 1.3, red);
  for (let pz = start + 1; pz < z; pz++)
    v.ringZ(x, cy, pz, pz + 1, r - 1.4, r - 2.7, pz % 2 ? brass : "#976844");
  for (const pz of [start, z]) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      beam(v, [x, cy, pz], [x + (r - 1.2) * Math.cos(a), cy + (r - 1.2) * Math.sin(a), pz], steel);
    }
    v.ringZ(x, cy, pz, pz + 1, 1.7, 0, brass);
    v.put(x, cy, pz, lamp, 0.4);
  }
  for (const dx of [-r + 1, r - 2]) v.box(x + dx, 1, start + 1, x + dx + 2, cy + 1, start + 3, steel);
}
function reelHouse(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 5, 7, 8, 10]),
    x = lv >= 3 ? -Math.floor(hx * 0.34) : -2,
    z = lv === 1 ? -1 : 0;
  const cy = r + 3;
  reel(v, x, z, cy, r, byLv(c, [3, 4, 6, 8, 9]));
  engine(v, lv === 1 ? 3 : hx - 6, hz - 7);
  if (lv >= 2) bay(v, hx - 6, 1, 8, 5, 7);
  if (lv >= 3) {
    v.box(x - 1, 1, z + 2, x + 2, 3, hz - 3, brass);
    v.box(x - 1, 2, hz - 5, x + 5, 3, hz - 3, brass);
    publicDesk(v, -hx + 4, hz - 4);
  }
  if (lv >= 4) {
    reel(v, hx - 12, -4, 8, 5, 4);
    v.box(x, cy + 1, -6, hx - 11, cy + 2, -4, steel);
  }
  if (lv === 5) {
    bay(v, hx - 7, -5, 10, 6, 12);
    engine(v, hx - 8, -8, true);
    v.box(x + 2, 3, hz - 6, x + 5, 7, hz - 3, red);
    v.put(x + 3, 7, hz - 5, lamp, 0.7);
  }
}
function bell(v: PixelVox, x: number, z: number, y: number, r: number) {
  v.cylinderY(x, z, y, y + 1, r, brass);
  for (let i = 1; i < r; i++)
    disc(v, x, z, y + i, y + i + 1, Math.max(1.6, r - i * 0.6), "#c79347", Math.max(0, r - i * 0.6 - 1.6));
  v.box(x - 1, y + r - 1, z - 1, x + 1, y + r + 2, z + 1, steel);
  v.put(x, y - 1, z, lamp, 0.55);
  v.box(x - 1, y, z + r - 1, x + 1, y + 1, z + r, brass, 0.35);
}
function bellHouse(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -3 : -Math.floor(hx * 0.4),
    z = lv >= 3 ? -5 : -3;
  const r = byLv(c, [2, 3, 4, 5, 6]),
    y = byLv(c, [6, 10, 13, 16, 22]);
  for (const a of [-r - 1, r]) v.box(x + a, 1, z - 1, x + a + 2, y + r + 3, z + 1, deep);
  v.box(x - r - 2, y + r + 2, z - 2, x + r + 3, y + r + 4, z + 2, cream);
  bell(v, x, z, y, r);
  engine(v, lv === 1 ? 3 : hx - 6, hz - 7);
  if (lv >= 2) bay(v, hx - 6, 0, 8, 6, 7);
  if (lv >= 3) {
    bay(v, x, z + 2, r * 2 + 2, 7, 7);
    publicDesk(v, x, hz - 4);
    v.box(x - r, y - 3, z + 2, x + r, y - 2, z + 4, red);
  }
  if (lv >= 4) {
    const side = hx - 14;
    bay(v, side, -2, 7, 7, 9);
    engine(v, side, hz - 8);
    bell(v, side, -4, 11, 2);
  }
  if (lv === 5) {
    for (const a of [-r - 1, r]) v.box(x + a, 10, z + 2, x + a + 1, 24, z + 3, brass);
    for (let i = 11; i < 24; i += 3) v.box(x - r - 1, i, z + 2, x - r + 2, i + 1, z + 3, brass);
    v.box(x - r - 2, 19, z - 2, x + r + 3, 20, z + 3, red);
    v.box(x + r, 10, z, hx - 6, 11, z + 2, cream);
    person(v, 2, 11, z, "#7e6770");
  }
}
function ladder(v: PixelVox, x0: number, z: number, x1: number, y: number, width: number) {
  const steps = Math.max(Math.abs(x1 - x0), y);
  for (let j = 0; j <= steps; j++) {
    const x = Math.round(x0 + ((x1 - x0) * j) / steps),
      yy = 2 + Math.round(((y - 2) * j) / steps);
    for (const d of [-width, width]) v.box(x, yy, z + d, x + 2, yy + 1, z + d + 1, cream);
    if (j % 3 === 0) v.box(x, yy, z - width, x + 1, yy + 1, z + width + 1, steel);
  }
}
function ladderCourt(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x0 = -hx + 3,
    x1 = lv === 1 ? 1 : hx - 7,
    z = lv >= 3 ? -3 : -2;
  const high = byLv(c, [8, 12, 16, 20, 24]);
  ladder(v, x0, z, x1, high, 2);
  v.box(x1, 1, z - 2, x1 + 2, high + 1, z + 2, red);
  engine(v, lv === 1 ? 3 : -hx + 6, hz - 7, lv >= 4);
  v.put(x1, high + 1, z, lamp, 0.65);
  if (lv >= 2) {
    bay(v, x1 - 1, z + 1, 7, 4, 6);
    v.box(x1 - 3, high, z - 3, x1 + 3, high + 1, z + 3, red);
  }
  if (lv >= 3) {
    ladder(v, -hx + 7, -hz + 4, x1 - 4, high - 5, 1);
    v.box(x1 - 5, 1, -hz + 4, x1 - 3, high - 4, -hz + 6, steel);
    publicDesk(v, hx - 6, hz - 4);
  }
  if (lv >= 4) {
    bay(v, -2, -hz + 7, 9, 5, 8);
    v.box(-2, 8, -hz + 6, x1 - 1, 9, z - 2, steel);
    engine(v, 1, 3);
  }
  if (lv === 5) {
    v.box(x1 - 4, high + 1, z - 4, x1 + 4, high + 2, z + 4, red);
    v.box(x1 - 2, high + 2, z - 1, x1 + 1, high + 6, z + 1, cream);
    v.put(x1, high + 5, z + 1, lamp, 0.7);
    ladder(v, hx - 5, hz - 6, 4, 13, 2);
    v.box(4, 1, hz - 7, 6, 14, hz - 5, red);
  }
}
function standpipe(v: PixelVox, x: number, z: number, r: number, h: number) {
  disc(v, x, z, 1, 3, r + 1.5, red);
  disc(v, x, z, 3, h, r, red, r - 1.5);
  disc(v, x, z, h - 2, h - 1, r + 0.5, cream, r - 1.3);
  v.cylinderY(x, z, h, h + 2, r + 1, deep);
  for (let i = 0; i < r; i++)
    disc(v, x, z, h + 2 + i, h + 3 + i, r - i * 0.7, red, Math.max(0, r - i * 0.7 - 1.6));
  for (const side of [-1, 1]) {
    v.box(x + side * (r - 1), 4, z - 2, x + side * (r + 2), 7, z + 2, red);
    v.box(x + side * (r + 2), 4, z - 2, x + side * (r + 2) + 1, 7, z + 2, brass);
  }
  v.ringZ(x, Math.max(4, h - 2), z + r - 1, z + r + 1, Math.max(2, r * 0.58), 0, deep);
  v.ringZ(x, Math.max(4, h - 2), z + r + 1, z + r + 2, Math.max(1.5, r * 0.45), 0, brass);
  v.put(x, Math.max(4, h - 2), z + r + 2, lamp, 0.45);
  v.box(x - 2, 2, z + r - 1, x + 2, 6, z + r, steel);
  v.put(x + 1, 5, z + r, lamp, 0.6);
}
function hydrantWorks(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -2 : -Math.floor(hx * 0.4),
    z = lv >= 3 ? -3 : -2,
    r = byLv(c, [3, 4, 5, 6, 7]);
  standpipe(v, x, z, r, byLv(c, [6, 8, 11, 15, 19]));
  engine(v, lv === 1 ? 3 : hx - 6, hz - 7);
  if (lv >= 2) bay(v, hx - 6, -1, 7, 5, 6);
  if (lv >= 3) {
    const x2 = hx - 6;
    v.box(x + r, 5, z - 2, x2 + 1, 7, z, red);
    standpipe(v, x2, z - 3, 3, 8);
    publicDesk(v, x, hz - 4);
  }
  if (lv >= 4) {
    disc(v, x, z, 8, 9, r + 2.5, brass, r + 0.2);
    v.box(x + 1, 8, z, hx - 5, 9, z + 2, cream);
    person(v, 1, 9, z, "#615e6b");
  }
  if (lv === 5) {
    const side = hx - 12;
    standpipe(v, side, -hz + 5, 4, 13);
    bay(v, hx - 14, 3, 8, 5, 8);
    engine(v, hx - 14, 4);
    v.box(side - 1, 8, -hz + 6, side + 1, 10, z, red);
  }
}
export function fireDepartment(c: Ctx): void {
  lot(c, "#b6ae98");
  c.v.box(-c.hx + 1, 0, c.hz - 5, c.hx - 1, 1, c.hz, "#c6bda8");
  const { v, hx, hz, lv } = c;
  const apronX = c.variant === 2 ? -hx + 6 : hx - 6;
  v.box(apronX - 3, 0, 0, apronX + 4, 1, hz, "#a49b8b");
  for (let z = 2; z < hz; z += 4) v.put(apronX + 3, 0, z, cream);
  [reelHouse, bellHouse, ladderCourt, hydrantWorks][c.variant % 4](c);
  const crewX = lv < 3 ? -hx + 2 : apronX - 4;
  person(v, crewX, 1, hz - 3, "#bc7150", steel);
  v.put(crewX, 4, hz - 3, brass);
  if (lv >= 3) {
    // Filled hose baskets stand outside the apparatus bay.
    const cartX = hx - 5,
      cartZ = -hz + 2;
    v.hollowBox(cartX - 2, 1, cartZ, cartX + 3, 4, cartZ + 3, steel);
    for (const dx of [-1, 1]) v.ringZ(cartX + dx, 4, cartZ + 1, cartZ + 3, 1.4, 0.5, brass);
  }
}
