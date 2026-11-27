import type { Ctx } from "../../kit";
import {
  bronze,
  clay,
  column,
  gilt,
  ink,
  limestone,
  marble,
  oilLamp,
  resident,
  sea,
  sky,
  stone,
  tiers,
  vermilion,
  wood,
} from "./craft";

function judgmentSeat(c: Ctx, y: number, z: number) {
  c.v.box(-2, y, z - 1, 3, y + 1, z + 2, limestone);
  c.v.box(-1, y + 1, z, 2, y + 2, z + 2, vermilion);
  c.v.box(-1, y + 1, z - 1, 2, y + 4, z, wood);
  c.v.put(0, y + 3, z, gilt);
  oilLamp(c, -2, y + 1, z + 1);
  oilLamp(c, 2, y + 1, z + 1);
}

function stair(c: Ctx, z: number, steps: number, wide: number) {
  for (let i = 0; i < steps; i++) {
    const width = wide + Math.floor((steps - i - 1) / 4);
    c.v.box(-width, 1, z - i, width + 1, i + 2, z - i + 1, i % 3 ? limestone : marble);
  }
}

function pediment(c: Ctx, z0: number, z1: number, y: number, w: number, tile: string, pitch = 2) {
  for (let x = -w; x <= w; x++) {
    const h = y + Math.floor((w - Math.abs(x)) / pitch);
    c.v.box(x, h, z0, x + 1, h + 1, z1, tile);
    c.v.box(x, y, z1 - 1, x + 1, h + 1, z1, marble);
    c.v.put(x, h, z1 - 1, limestone);
    if (x % 3 === 0) c.v.box(x, h, z0, x + 1, h + 1, z1 - 1, vermillionTile(tile));
  }
  c.v.box(-w, y - 1, z1 - 1, w + 1, y, z1, sea);
  c.v.put(0, y + Math.floor(w / pitch) + 1, z1 - 1, gilt);
}

function vermillionTile(tile: string) {
  return tile === sky ? sea : vermilion;
}

function peristyle(c: Ctx) {
  const { v, hx, hz, lv } = c,
    w = Math.min(hx - 2, 3 + lv * 2),
    back = -hz + 2,
    front = lv === 1 ? -1 : -2;
  const base = 3 + lv,
    eaves = base + 3 + lv;
  v.box(-w + 1, 1, back, w, base, front + 1, stone);
  v.box(-w + 1, base, back, w, base + 2, back + 1, limestone);
  judgmentSeat(c, base, back + 2);
  for (const x of [-w + 1, w - 1]) {
    column(c, x, base, front - 1, eaves - base);
    column(c, x, base, back, eaves - base);
  }
  if (lv >= 2) for (const x of [-2, 2]) column(c, x, base, front - 1, eaves - base);
  pediment(c, back - 1, front + 1, eaves, w, clay);
  stair(c, Math.min(hz - 2, front + base), base, 2 + Math.floor(lv / 2));
  if (lv >= 2) for (const side of [-1, 1]) tiers(c, side * (hx - 6), hz - 4, 3, 1, 1, 0.55, 0.7);
  if (lv >= 3) tiers(c, 0, front + 2, Math.min(w + 4, hz - 2), 2 + Math.floor(lv / 2), 1, 0.66, 0.83);
  if (lv >= 4)
    for (const side of [-1, 1]) {
      const x = side * (w + 2);
      v.box(x - 1, 1, back, x + 2, base, front + 1, limestone);
      column(c, x, base, back + 1, 4, true);
      v.put(x, base + 4, back + 1, bronze);
    }
  if (lv === 5) {
    v.box(-w + 2, eaves + 2, back, w - 1, eaves + 3, back + 3, limestone);
    resident(c, 0, base, front, sea);
  }
}

function openJury(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = Math.min(hx - 2, lv === 1 ? hz - 2 : Math.floor(hz * 1.12));
  const depth = Math.min(0.83, (hz - 2) / r),
    z = lv >= 3 ? 2 : 0,
    base = 3 + lv;
  tiers(c, 0, z, r, Math.max(2, Math.floor(r / 2)), 1, 0.5, depth);
  v.box(-3, 1, -hz + 2, 4, base, -hz + 6, stone);
  judgmentSeat(c, base, -hz + 4);
  const h = 7 + 2 * lv;
  for (const x of [-2, 2]) column(c, x, base, -hz + 3, h - base, true);
  pediment(c, -hz + 1, -hz + 6, h, 3 + Math.floor(lv / 2), sky, 1);
  if (lv >= 2)
    for (const side of [-1, 1]) {
      const x = side * (hx - 3);
      v.box(x - 1, 1, -hz + 1, x + 2, 5, -hz + 5, stone);
      oilLamp(c, x, 5, -hz + 3);
    }
  if (lv >= 3) stair(c, hz - 3, 4, 2);
  if (lv >= 4) {
    const outer = Math.min(hx - 2, hz - 3);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const x = side * (outer - i * 2),
          zz = 2 + i * 3;
        column(c, x, 1, zz, 3 + i);
        oilLamp(c, x, 4 + i, zz);
      }
  }
  if (lv === 5)
    for (const side of [-1, 1]) {
      const x = side * 9;
      v.box(x - 3, 1, -hz + 2, x + 4, 6, -hz + 9, stone);
      v.box(x - 4, 6, -hz + 1, x + 5, 7, -hz + 10, limestone);
      resident(c, x, 7, -hz + 5);
    }
}

function judgesBridge(c: Ctx) {
  const { v, hx, hz, lv } = c,
    w = Math.min(hx - 2, 3 + lv * 2),
    back = -hz + 2,
    pier = Math.max(2, Math.floor(w * 0.45)),
    deck = 6 + 2 * lv;
  for (const side of [-1, 1]) {
    const x = side < 0 ? -w : w - pier + 1;
    v.hollowBox(x, 1, back, x + pier, deck, 1, limestone);
    v.box(x, deck - 2, back, x + pier, deck - 1, 2, sea);
    for (let y = 3; y < deck - 2; y += 3) v.put(x + Math.floor(pier / 2), y, 0, ink);
  }
  v.box(-w, deck, back, w + 1, deck + 1, 2, stone);
  judgmentSeat(c, deck + 1, back + 2);
  // An open judicial bridge carries a central canopy. Its outer bays remain sky-lit.
  const canopy = Math.max(2, Math.floor(w * 0.45));
  for (const x of [-canopy + 1, canopy - 1]) column(c, x, deck + 1, -1, 4);
  pediment(c, Math.max(back - 1, -6), 2, deck + 5, canopy, sky, 1);
  for (const x of [-w + 1, w - 1]) {
    v.box(x - 1, deck + 1, back, x + 2, deck + 2, 2, limestone);
    v.cylinderY(x + 0.5, 0.5, deck + 2, deck + 3, 1.5, bronze);
    oilLamp(c, x, deck + 3, 0);
  }
  stair(c, hz - 2, Math.min(hz - 2, deck - 2), 2);
  if (lv >= 2) {
    const x = Math.max(6, hx - 4);
    for (const side of [-1, 1]) {
      v.box(side * x - 1, 1, back, side * x + 2, 3, 2, limestone);
      resident(c, side * x, 3, 0);
    }
  }
  if (lv >= 3) tiers(c, 0, 3, w + 2, 2 + Math.floor(lv / 2), 1, 0.65, 0.7);
  if (lv >= 4)
    for (const side of [-1, 1]) {
      const x = side * (w - 2);
      v.box(x - 2, 1, 2, x + 3, Math.floor(deck / 2), hz - 5, stone);
      for (let z = 5; z < hz - 5; z += 5) oilLamp(c, x, Math.floor(deck / 2), z);
    }
  if (lv === 5)
    for (const side of [-1, 1]) {
      const x = side * (w + 4);
      column(c, x, 1, back + 3, deck - 3, true);
      v.cylinderY(x + 0.5, back + 3.5, deck - 2, deck, 2, bronze);
    }
}

function roundHearing(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = 3 + Math.floor(lv * 1.35),
    z = lv === 1 ? -1 : -Math.floor(hz * 0.36);
  const base = 3 + lv,
    eaves = 5 + 2 * lv;
  v.cylinderY(0.5, z + 0.5, 1, base, r + 0.45, stone);
  v.cylinderY(0.5, z + 0.5, base - 1, base, r + 1.1, marble);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.round(Math.cos(a) * r),
      zz = z + Math.round(Math.sin(a) * r);
    if (i !== 2) column(c, x, base, zz, eaves - base, lv >= 4);
  }
  judgmentSeat(c, base, z);
  v.cone(0.5, eaves, eaves + 3 + lv, z + 0.5, r + 1, 0.8, vermilion);
  pediment(c, z + r - 2, z + r + 1, eaves, 2 + Math.floor(lv / 2), clay);
  stair(c, Math.min(hz - 2, z + r + base - 1), base, 2 + Math.floor(lv / 2));
  if (lv >= 2)
    for (const side of [-1, 1]) {
      const x = side * (hx - 4);
      v.box(x - 1, 1, -hz + 2, x + 2, 3, hz - 3, limestone);
      oilLamp(c, x, 3, -hz + 3);
    }
  if (lv >= 3) tiers(c, 0, z + r + 2, Math.min(hx - 3, r + 4), 2, 1, 0.7, 0.65);
  if (lv >= 4)
    for (const side of [-1, 1]) {
      const x = side * (hx - 5);
      column(c, x, 1, hz - 7, base + 1, true);
      v.cylinderY(x + 0.5, hz - 6.5, base + 2, base + 3, 2, bronze);
    }
  if (lv === 5) tiers(c, 0, 4, hx - 3, 4, 1, 0.64, 0.7);
}

export function buildTribunal(c: Ctx) {
  [peristyle, openJury, judgesBridge, roundHearing][c.variant](c);
  c.v.box(-1, 0, c.hz - 4, 2, 1, c.hz - 1, marble);
  resident(c, 3, 1, c.hz - 3, clay);
  oilLamp(c, -3, 1, c.hz - 3);
  oilLamp(c, 3, 1, c.hz - 2);
}
