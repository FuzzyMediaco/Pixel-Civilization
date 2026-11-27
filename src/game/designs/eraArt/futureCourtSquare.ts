import { bench, byLv, person, stairs, type Ctx, type PixelVox } from "../kit";
import { arc, glass, glow, gold, night, pearl, planter, port, publicWalk, slab, span, steel, teal } from "./futureCivicKit";

const robe = "#865c72",
  audience = "#ac8065",
  courtStone = "#b3bdc9";

// The clerk, judge and petitioner face one another across the floor. The higher back rail leaves the public approach open.
function hearing(v: PixelVox, y: number, z: number, r: number) {
  v.cylinderY(0, z, y, y + 1, r, pearl);
  v.box(-2, y + 1, z - r + 1, 3, y + 3, z - r + 2, night);
  person(v, 0, y + 1, z - r, robe);
  slab(v, -1, y + 1, z + 1, 3, 2, gold);
  person(v, 0, y + 1, z + 3, audience);
  for (const side of [-1, 1]) {
    bench(v, side * (r - 1), y + 1, z - 1, "z", steel);
    person(v, side * (r - 1), y + 2, z - 1, teal);
  }
}
function ribbonCourt(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = -Math.round(hz * 0.21),
    r = byLv(c, [4, 5, 7, 9, 12]),
    y = 2 + lv;
  const spread = r + 1;
  for (const side of [-1, 1]) {
    const x = side * spread;
    for (let step = 0; step < y; step++) {
      const xx = x - side * Math.round(step / 3),
        zz = z + 1 + step;
      v.box(xx - 1, 1, zz, xx + 2, y - step + 1, zz + 2, courtStone);
      v.put(xx + side, y - step + 1, zz, gold);
    }
    span(v, x, 1, z - 2, x, y, z, 1, steel);
  }
  hearing(v, y, z, r);
  const chambers = lv < 3 ? 3 : 5,
    back = z - r + 1;
  v.box(-chambers, y, back - 1, chambers + 1, y + 5, back + 1, courtStone);
  v.box(-chambers + 1, y + 1, back + 1, chambers, y + 4, back + 2, glass, 0.29);
  for (let i = -chambers - 1; i <= chambers + 1; i++) {
    const roof = y + 5 + Math.floor((chambers + 1 - Math.abs(i)) / 2);
    v.box(i, roof, back - 1, i + 1, roof + 1, back + 3, pearl);
  }
  v.box(-1, y + 1, back + 2, 2, y + 3, back + 3, gold);
  person(v, 0, y + 2, back + 1, robe);
  arc(v, 0, z, y + 2, r, r, 0, 1.7, 4.6, courtStone);
  publicWalk(v, 0, z + r, hz);
  if (lv >= 2) {
    arc(v, 0, z, y + 4, r, r - 1, 0, 2.1, 4.1, glass);
    for (const side of [-1, 1]) span(v, side * (r - 1), y + 1, z - 2, side * (r - 1), y + 4, z - 2, 0, steel);
  }
  if (lv >= 3) {
    arc(v, 0, z, y + 5, r + 2, r, 1, 2, 4.3, pearl);
    bench(v, -1, 1, z + r + 3);
  }
  if (lv >= 4) {
    port(v, -hx + 3, 1, 4, 6, 7, 5, courtStone);
    port(v, hx - 9, 1, 4, 6, 7, 5, courtStone);
    planter(v, 3, 1, hz - 4);
  }
  if (lv === 5) {
    arc(v, 0, z, y + 8, r - 2, r - 2, 1, 1.9, 4.4, teal);
    for (const side of [-1, 1]) span(v, side * r, y + 4, z - 2, side * (r - 2), y + 8, z - 3, 0, steel);
    bench(v, 0, 1, z + r + 4);
  }
}
function prismCourt(c: Ctx) {
  const { v, lv, hx, hz } = c,
    base = -hz + 3,
    z = -Math.round(hz * 0.18),
    r = lv < 3 ? 3 : 5 + Math.floor(lv / 2),
    half = byLv(c, [5, 8, 10, 11, 14]),
    h = 7 + lv * 2;
  hearing(v, 2, z, r);
  publicWalk(v, 0, z + 3, hz);
  stairs(v, -2, 3, 1, z + r, 2);
  // Two tapering prismatic wings surround the public central opening. Daylight strips run through their folded planes.
  for (const side of [-1, 1]) {
    const root = side * half;
    for (let i = 0; i < h; i++) {
      const x = root - side * Math.floor(((half - 1) * i) / h),
        zz = base + Math.floor((i / h) * 2);
      const depth = Math.max(3, Math.floor((z - base + 4) * (1 - (0.45 * i) / h)));
      v.box(x - 1, i + 2, zz, x + 1, i + 3, zz + depth, i % 4 === 1 ? glass : pearl, i % 4 === 1 ? 0.28 : 0);
      v.box(root - 1, i + 2, zz, root + 1, i + 3, zz + 1, steel);
    }
    span(v, root, 2, z + 3, side * 2, h + 1, base + 2, 0, gold);
  }
  if (lv >= 2) {
    bench(v, -half, 2, z + 3);
    bench(v, half - 2, 2, z + 3);
  }
  if (lv >= 3) {
    port(v, -hx + 3, 1, z + 5, 6, 4, 5, courtStone);
    port(v, hx - 9, 1, z + 5, 6, 4, 5, courtStone);
  }
  if (lv >= 4) {
    span(v, -half, 7, z + 4, half, 7, z + 4, 0, glass);
    for (const side of [-1, 1]) stairs(v, side * half - 1, side * half + 2, 1, z + 5, 6);
  }
  if (lv === 5) {
    for (const side of [-1, 1]) span(v, side * (half + 3), 2, 4, side * (half - 3), h + 1, base + 3, 1, steel);
    arc(v, 0, 5, 2, half, 7, 1, -1.4, 1.4, teal);
  }
}
function oculusCourt(c: Ctx) {
  const { v, lv, hz } = c,
    z = lv > 2 ? -3 : -1,
    r = byLv(c, [5, 6, 9, 10, 13]),
    h = byLv(c, [6, 8, 10, 12, 15]);
  hearing(v, 1, z, lv < 3 ? 3 : 5);
  publicWalk(v, 0, z + 3, hz);
  // A cutaway in the front of the shell preserves the view from street to witness bench.
  for (let y = 1; y < h; y++) {
    const fraction = y / h;
    const radius = Math.round(r * (0.55 + 0.5 * Math.sin(Math.PI * fraction)));
    const depth = lv <= 2 ? Math.min(radius, 5) : radius;
    arc(v, 0, z, y + 1, radius, depth, 0, 0.75 + fraction * 0.25, 5.53 - fraction * 0.25, y % 4 === 0 ? glass : courtStone);
  }
  arc(v, 0, z, h + 1, Math.max(2, Math.round(0.55 * r)), lv <= 2 ? 3 : Math.round(0.55 * r), 1, 0, Math.PI * 2, gold);
  if (lv >= 2) {
    port(v, -c.hx + 3, 1, -4, 5, 6, 5, courtStone);
    bench(v, c.hx - 6, 1, 4);
  }
  if (lv >= 3) {
    arc(v, 0, z, 5, r - 1, r - 1, 1, 1.2, 5.1, teal);
    for (const side of [-1, 1]) person(v, side * (r - 1), 6, z, audience);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      stairs(v, side * 6 - 1, side * 6 + 2, 1, z + 6, 5);
      bench(v, side * 6 - 1, 2, z + 11);
    }
  }
  if (lv === 5) {
    for (const side of [-1, 1]) port(v, side * 15 - 3, 1, z - 6, 7, 12, 7, courtStone);
    arc(v, 0, z, 8, r + 3, r, 0, 1.6, 4.7, teal);
  }
}
function foldedCourt(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = lv < 3 ? -2 : -4,
    r = lv < 3 ? 3 : 5,
    w = byLv(c, [5, 9, 11, 13, 16]);
  hearing(v, 2, z, r);
  stairs(v, -2, 3, 1, z + r, 2);
  const depth = Math.min(hz - 2, Math.abs(z) + r);
  for (let i = -3; i <= 3; i++) {
    const h = byLv(c, [7, 9, 11, 13, 16]) - Math.floor(Math.abs(i) / 2),
      zz = -depth;
    v.box(i, 2, zz, i + 1, h, zz + 1, steel);
    v.box(i, h, zz, i + 1, h + 1, zz + 4, pearl);
  }
  v.box(-1, 4, -depth + 1, 2, 6, -depth + 2, glass, 0.42);
  publicWalk(v, 0, z + 3, hz);
  for (const side of [-1, 1]) {
    for (let i = 0; i < lv + 1; i++) {
      const x = side * (w - i),
        y = 2 + 2 * i,
        z0 = z - 3 + i,
        z1 = Math.min(hz - 2, z + 4 + i);
      v.box(x - 1, y, z0, x + 2, y + 1, z1, pearl);
      v.box(x, y + 1, z0, x + 1, y + 2, z1, steel);
      span(v, side * (w + 1), 1, z0, x, y, z0, 0, teal);
      if (i % 2 === 0) person(v, x, y + 1, z0 + 2, robe);
    }
  }
  if (lv >= 2) {
    v.box(-3, 2, z - 4, 4, 8, z - 3, teal);
    v.put(0, 7, z - 3, glow, 0.6);
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) stairs(v, side * (w - 2) - 1, side * (w - 2) + 2, 1, z + 5, 5);
    bench(v, -1, 1, z + 9);
  }
  if (lv >= 4) {
    arc(v, 0, z - 1, 8, w - 3, 5, 1, 2.2, 4.1, glass);
    planter(v, 4, 1, hz - 4);
    planter(v, -4, 1, hz - 4);
  }
  if (lv === 5) {
    v.box(-6, 3, z - 11, 7, 13, z - 9, courtStone);
    v.box(-4, 6, z - 9, 5, 11, z - 8, glass, 0.4);
    slab(v, -8, 13, z - 13, 17, 7, pearl);
    person(v, 4, 4, z - 8, robe);
  }
}
// Paired ribbon stairs, prism walls, a cutaway oculus and folded jury stands all keep the judge on the central axis.
export function daylightCourt(c: Ctx, active: boolean) {
  c.vpick([ribbonCourt, prismCourt, oculusCourt, foldedCourt])(c);
  const { v, lv, hz } = c;
  const z = c.vpick([-Math.round(hz * 0.21), -Math.round(hz * 0.18), lv > 2 ? -3 : -1, lv < 3 ? -2 : -4]);
  const dais = c.vpick([2 + lv, 2, 1, 2]);
  // The clerk stands at a reading desk beside the petitioner when the court is in session.
  if (active) {
    person(v, -2, dais + 1, z + 1, "#775c83");
    v.put(-2, dais + 2, z, glow, 0.8);
  }
}

// All four city forms keep an outdoor assembly area at the foot of the office that addresses it.
function assembly(c: Ctx, x: number, z: number, r: number) {
  const { v, lv, hz } = c;
  const rear = -Math.floor(hz * 0.4);
  // Pavers lead the speaker and crowd from the tower to the circle and the street.
  span(v, 0, 0, rear, x, 0, z, lv < 3 ? 1 : 2, "path2");
  v.cylinderY(x, z, 0, 1, r, pearl);
  if (lv >= 2) arc(v, x, z, 0, r + 1, r + 1, 0, 1.2, 4.9, "#9aaaa3");
  arc(v, x, z, 1, r, r, 0, 1, 4.9, teal);
  slab(v, x - 1, 1, z - 1, 3, 2, gold);
  publicWalk(v, x, z + 1, hz);
  person(v, x + 1, 1, z, "#c0796c");
  if (lv >= 2) {
    bench(v, x - r + 1, 1, z, "z");
    person(v, x + 2, 1, z + 1, "#7c7fa4");
  }
  if (lv >= 3) {
    bench(v, x + r - 1, 1, z, "z");
    planter(v, x + r, 1, z - r + 1);
  }
}
function sailHall(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = -hz + 3,
    x = -hx + 4,
    h = byLv(c, [13, 16, 20, 24, 28]),
    w = byLv(c, [8, 10, 16, 19, 22]);
  assembly(c, lv < 3 ? 1 : 4, Math.floor(hz * 0.39), lv < 3 ? 3 : 6);
  port(v, x, 1, z, lv < 3 ? 7 : 12, lv < 3 ? 4 : 7, lv < 3 ? 4 : 7);
  for (let y = 3; y <= h; y++) {
    const t = (y - 3) / (h - 3),
      left = x - Math.round(t * 2),
      right = left + Math.max(2, w - Math.floor(t * (w - 2)));
    const zz = z + 1 + Math.floor(3 * t + 1.5 * Math.sin(t * Math.PI));
    if (right <= left) continue;
    v.box(left, y, zz, right, y + 1, zz + 2, y % 5 === 0 ? glass : teal, y % 5 === 0 ? 0.32 : 0);
    v.put(left, y, zz - 1, pearl);
    v.put(right - 1, y, zz + 2, gold);
  }
  if (lv >= 2) {
    port(v, x, 4, z + 1, 6, 4, 4, teal);
    span(v, x, 4, z + 6, x + 3, 7, z + 9, 0, steel);
  }
  if (lv >= 3) {
    slab(v, x + 2, 7, z + 6, 14, 5, pearl);
    person(v, x + 8, 8, z + 9, steel);
    bench(v, x + 3, 8, z + 8);
  }
  if (lv >= 4) {
    // The fourth promotion projects the council balcony out into the square. Its tapered pier leaves the approach clear.
    const bx = hx - 8,
      bz = z + 9;
    for (let y = 1; y < 9; y++) {
      const xx = bx - 3 + Math.floor(y / 3);
      v.box(xx, y, bz, xx + 2, y + 1, bz + 3, steel);
    }
    port(v, bx - 3, 9, bz - 1, 7, 5, 5, glass);
    slab(v, bx - 4, 9, bz + 2, 9, 5, pearl);
    person(v, bx + 2, 10, bz + 5, teal);
    span(v, x + 6, 10, z + 2, bx, 9, bz, 1, pearl);
    span(v, x + 6, 13, z + 2, bx + 4, 10, bz + 1, 0, gold);
  }
  if (lv === 5) {
    port(v, hx - 10, 1, z + 8, 7, 13, 8, teal);
    span(v, x + 6, 14, z + 4, hx - 7, 9, z + 13, 1, pearl);
    planter(v, -2, 1, hz - 5);
  }
}
function haloHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -1 : -3,
    z = -Math.floor(hz * 0.49),
    h = byLv(c, [9, 12, 15, 19, 23]),
    r = byLv(c, [3, 4, 5, 6, 8]);
  assembly(c, lv < 3 ? 1 : 3, Math.floor(hz * 0.43), lv < 3 ? 3 : 5);
  v.box(x - 1, 1, z - 1, x + 2, h, z + 2, night);
  for (let y = 3; y < h; y += 3) v.box(x - 2, y, z - 1, x + 3, y + 1, z + 2, glass, 0.25);
  // A vertical address halo is deliberately legible end-on from below the public square.
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI) / 32,
      xx = x + Math.round(r * Math.sin(a)),
      yy = h + Math.round(r * Math.cos(a));
    v.box(xx - 1, yy, z - 1, xx + 1, yy + 1, z + 1, Math.cos(a) > 0.2 ? pearl : teal);
    v.put(xx, yy, z + 1, glow, 0.55);
  }
  port(v, x - 3, 1, z - 2, 6, 5, 4);
  if (lv >= 2) {
    slab(v, x - 4, h - 5, z - 3, 9, 7, pearl);
    person(v, x + 2, h - 4, z + 2, steel);
  }
  if (lv >= 3) {
    port(v, -hx + 3, 1, z, 7, 8, 6, teal);
    span(v, -hx + 7, 6, z + 3, x, 8, z + 1, 1, pearl);
  }
  if (lv >= 4) {
    port(v, x + 4, 1, z - 4, 7, 6, 10);
    slab(v, x - 5, h - 3, z - 4, 11, 7, pearl);
  }
  if (lv === 5) {
    port(v, -hx + 3, 8, z - 5, 8, 12, 6, glass);
    span(v, -hx + 7, 13, z + 2, x, 15, z, 1, teal);
    planter(v, 2, 1, hz - 5);
  }
}
function rostrumHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -5 : -10,
    z = -hz + 2,
    tiers = lv + 1,
    w = byLv(c, [7, 8, 13, 15, 17]),
    rise = lv >= 3 ? 4 : 3;
  assembly(c, lv < 3 ? 1 : 5, Math.floor(hz * 0.5), lv < 3 ? 3 : 5);
  for (let i = 0; i < tiers; i++) {
    const y = 1 + i * rise,
      ww = w - Math.floor(i * 0.8),
      zz = z + (tiers - i - 1) * 2;
    v.box(x, y, zz - 2, x + ww, y + rise, zz + 3, steel);
    v.box(x + 1, y + 1, zz + 2, x + ww - 1, y + rise - 1, zz + 3, glass, 0.35);
    slab(v, x - 1, y + rise - 1, zz - 2, ww + 2, 6, pearl);
    if (i % 2 === 0) {
      person(v, x + ww - 2, y + rise, zz + 3, "#955970");
      v.put(x + 1, y + rise, zz + 3, glow, 0.55);
    }
    if (i > 0) span(v, x + 1, 1, z - 1, x + 1, y + rise, z, 0, night);
  }
  const crown = 1 + tiers * rise;
  v.box(x + 1, crown, z - 1, x + 3, crown + 4, z + 1, steel);
  v.box(x + 1, crown + 4, z - 1, x + 5, crown + 5, z + 1, teal);
  v.put(x + 4, crown + 4, z + 1, glow, 0.8);
  if (lv >= 2) stairs(v, x + w - 3, x + w, 1, z + tiers * 2 + 2, 3);
  if (lv >= 3) {
    port(v, -hx + 2, 1, z + 8, 6, 9, 5, teal);
    planter(v, -5, 1, 7);
  }
  if (lv >= 4) {
    span(v, x + 2, tiers * rise, z, x + w + 4, 6, z + 7, 1, teal);
    port(v, x + w + 1, 1, z + 4, 5, 6, 6);
  }
  if (lv === 5) {
    port(v, -hx + 2, 1, z + 15, 7, 13, 7, glass);
    span(v, -hx + 4, 8, z + 22, x, 9, z + 7, 1, pearl);
  }
}
function finHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = -Math.floor(hz * 0.5),
    spread = byLv(c, [3, 4, 7, 8, 9]),
    h = byLv(c, [12, 15, 18, 22, 26]);
  assembly(c, 0, Math.floor(hz * 0.45), lv < 3 ? 3 : 6);
  for (const side of [-1, 1]) {
    const base = side * spread,
      top = h - (side < 0 ? 3 : 0);
    for (let y = 1; y <= top; y++) {
      const t = y / top,
        x = base + Math.round(side * (lv === 2 ? 2 : 3) * t),
        zz = z + Math.round(side * (lv === 1 ? 2 : 3) * t);
      v.box(x - 1, y, zz - 2, x + 1, y + 1, zz + 2, side < 0 ? teal : pearl);
      v.put(x + 1, y, zz + 1, y % 4 === 0 ? glow : glass, y % 4 === 0 ? 0.65 : 0);
    }
  }
  port(v, -3, 1, z, 6, 4, 4, steel);
  if (lv >= 2) {
    slab(v, -spread, 5, z - 1, spread * 2 + 1, 5, pearl);
    person(v, -1, 6, z + 2, teal);
  }
  if (lv >= 3) {
    port(v, -spread, 6, z - 3, spread + 4, 5, 5, glass);
    span(v, -spread, 10, z + 1, spread + 1, 7, z + 1, 0, gold);
  }
  if (lv >= 4) {
    span(v, -spread - 2, h - 4, z - 2, spread + 2, h - 11, z + 2, 1, glass);
    bench(v, -4, 1, 5);
  }
  if (lv === 5) {
    port(v, -hx + 3, 1, z + 6, 8, 12, 8, teal);
    span(v, -spread, 13, z - 1, -hx + 6, 9, z + 13, 1, pearl);
    planter(v, 1, 1, hz - 5);
  }
}
// A sail, broadcast halo, speaking rostrum or offset fins address the visible assembly below.
export function signalSquare(c: Ctx, active: boolean) {
  c.vpick([sailHall, haloHall, rostrumHall, finHall])(c);
  if (active) {
    const { v, lv, hz } = c;
    const x = c.vpick([lv < 3 ? 1 : 4, lv < 3 ? 1 : 3, lv < 3 ? 1 : 5, 0]);
    const z = Math.floor(hz * c.vpick([0.39, 0.43, 0.5, 0.45]));
    person(v, x - 1, 2, z - 1, "#9e5685");
    v.put(x, 2, z - 1, glow, 0.65);
  }
}
