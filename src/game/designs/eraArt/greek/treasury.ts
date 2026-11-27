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
  papyrus,
  resident,
  sea,
  stone,
  wood,
} from "./craft";

function weighingRecess(c: Ctx, x: number, y: number, z: number, deep: number) {
  const v = c.v;
  v.clear(x - 1, y, z - deep, x + 2, y + 3, z + 1);
  v.box(x - 1, y, z - deep, x + 2, y + 3, z - deep + 1, ink);
  v.box(x - 1, y, z - 1, x + 2, y + 1, z + 1, wood);
  v.put(x, y + 1, z - 1, gilt);
  oilLamp(c, x + 1, y, z);
}

function tallyCourt(c: Ctx, x: number, z: number, s: number) {
  const v = c.v;
  v.box(x - s, 1, z - s, x - s + 1, 3, z + s + 1, stone);
  v.box(x - s, 1, z - s, x + s + 1, 3, z - s + 1, stone);
  v.box(x + s, 1, z - s, x + s + 1, 3, z + s + 1, stone);
  v.box(x - 1, 1, z - 1, x + 2, 2, z + 1, wood);
  v.put(x, 2, z, gilt).put(x + 1, 2, z - 1, papyrus);
}

function talus(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 2,
    back = -hz + 2,
    right = lv === 1 ? 3 : Math.round(hx * 0.34),
    front = lv < 3 ? 2 : Math.round(hz * 0.38);
  const tiers = 2 + Math.floor(lv / 2);
  for (let i = 0; i < tiers; i++) {
    const y = 1 + i * 2;
    v.hollowBox(left + i, y, back + i, right + 1 - i, y + 2, front + 1 - i, i === tiers - 1 ? limestone : stone);
  }
  const y = 1 + tiers * 2;
  v.box(left + tiers - 1, y, back + tiers - 1, right + 2 - tiers, y + 1, front + 2 - tiers, marble);
  const entry = Math.floor((left + right) / 2);
  // The central bullion hatch is riveted and sits between two runs of dressed stone.
  const z = Math.round((front + back) / 2);
  v.box(entry - 2, y + 1, z - 2, entry + 2, y + 2, z + 2, bronze);
  v.box(entry - 1, y + 2, z - 1, entry + 1, y + 3, z + 1, stone);
  for (let xx = left + 1; xx <= right - 1; xx += 4) v.put(xx, 2, front, limestone);
  for (const dx of [-2, 2]) {
    v.box(entry + dx, 1, front - 1, entry + dx + 1, 4, front + 2, limestone);
    v.put(entry + dx, 4, front, bronze);
  }
  weighingRecess(c, entry, 1, front, 3);
  tallyCourt(c, hx - 4, hz - 4, lv >= 3 ? 3 : 2);
  if (lv >= 2) {
    v.box(right + 1, 1, back, right + 5, 4, 0, limestone);
    v.put(right + 2, 4, back + 2, bronze);
  }
  if (lv >= 3) {
    v.cylinderY(left + 6, back + 5, y + 1, y + 3, 3.2, bronze);
    v.cylinderY(left + 6, back + 5, y + 3, y + 4, 2.6, stone);
  }
  if (lv >= 4) {
    v.hollowBox(left, 1, front + 1, left + 7, 5, hz - 2, stone);
    v.box(left - 1, 5, front + 1, left + 8, 6, hz - 2, limestone);
  }
  if (lv === 5) {
    v.hollowBox(right, 1, back, right + 8, 6, back + 8, stone);
    v.box(right - 1, 6, back - 1, right + 9, 7, back + 9, limestone);
    v.cylinderY(right + 4, back + 4, 7, 9, 2.7, bronze);
    // The counting chamber now connects to a second massive coin-weight drum.
    v.cylinderY(right + 5, 0, 1, 9, 4.2, stone);
    v.cylinderY(right + 5, 0, 9, 10, 4.6, limestone);
    v.cylinderY(right + 5, 0, 10, 12, 3.4, bronze);
    v.box(right + 2, 4, back + 4, right + 7, 5, 2, stone);
  }
}

function beehive(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = lv === 1 ? 4 : Math.min(hz - 3, 5 + lv),
    x = lv < 3 ? -2 : -5,
    z = lv < 3 ? -1 : -5;
  v.cylinderY(x + 0.5, z + 0.5, 1, 4, r, stone);
  const h = 4 + lv;
  for (let i = 0; i < h; i++)
    v.cylinderY(x + 0.5, z + 0.5, 4 + i, 5 + i, Math.max(1, r * (1 - i / h)), i % 3 === 1 ? marble : limestone);
  v.put(x, 4 + h, z, bronze);
  const entry = z + r;
  v.hollowBox(x - 2, 1, entry - 2, x + 3, 5, entry + 2, limestone);
  weighingRecess(c, x, 1, entry + 1, 3);
  tallyCourt(c, hx - 4, lv < 3 ? 0 : 3, lv < 3 ? 2 : 3);
  if (lv >= 2) {
    v.box(x + r, 1, z - 2, hx - 2, 3, z + 1, stone);
    resident(c, hx - 5, 1, hz - 3);
  }
  if (lv >= 3) {
    v.cylinderY(hx - 6.5, -hz + 6.5, 1, 4, 4, stone);
    v.cone(hx - 6.5, 4, 7, -hz + 6.5, 4, 0.8, clay);
  }
  if (lv >= 4) {
    v.box(x - 4, 1, entry + 2, x - 2, 4, hz - 2, limestone);
    v.box(x + 3, 1, entry + 2, x + 5, 4, hz - 2, limestone);
  }
  if (lv === 5) {
    const tx = hx - 7,
      tz = hz - 6;
    v.cylinderY(tx, tz, 1, 5, 4.6, stone);
    v.cone(tx, 5, 9, tz, 4.8, 0.8, sea);
  }
}

function weighingBeam(c: Ctx) {
  const { v, hx, hz, lv } = c,
    w = lv === 1 ? 6 : hx - 3,
    back = -hz + 2,
    front = lv < 3 ? 2 : 0;
  const y = 4 + lv,
    opening = lv < 3 ? 1 : 3;
  for (const side of [-1, 1]) {
    const x = side < 0 ? -w : opening + 1,
      end = side < 0 ? -opening : w + 1;
    v.hollowBox(x, 1, back, end, y, front + 1, stone);
    v.box(x - 1, y - 1, back, end + 1, y, front + 2, limestone);
    v.box(x, y, back, end, y + 1, front + 1, marble);
  }
  v.box(-w + 1, 1, back, w, 4, back + 2, stone);
  v.box(-w + 1, y, back, w, y + 1, back + 2, limestone);
  // Leave the light well open between the two stone vaults and cap each independently.
  for (const side of [-1, 1]) {
    const x = side < 0 ? -w + 1 : opening + 2,
      end = side < 0 ? -opening - 1 : w;
    v.box(x, y + 1, back + 1, end, y + 2, front, limestone);
    for (let zz = back + 2; zz < front; zz += 3) {
      v.box(x, y + 2, zz, end, y + 3, zz + 1, side < 0 ? marble : bronze);
    }
    v.put(x + 1, 3, front, bronze);
  }
  const hook = y + 2;
  v.box(-opening - 2, y + 1, front - 1, opening + 3, hook + 1, front + 2, bronze);
  for (const x of [-opening, opening]) {
    v.box(x, 3, front + 1, x + 1, hook, front + 2, wood);
    v.box(x - 1, 3, front, x + 2, 4, front + 3, gilt);
  }
  weighingRecess(c, -w + 2, 1, front, 3);
  if (lv >= 2) tallyCourt(c, w - 3, hz - 4, 2);
  if (lv >= 3) {
    v.box(-w, 1, front + 1, -w + 4, 4, hz - 4, stone);
    oilLamp(c, -w + 1, 4, hz - 5);
  }
  if (lv >= 4) {
    v.box(w - 5, 1, back - 1, w + 1, y + 3, back + 4, limestone);
    v.put(w - 2, y + 3, back + 1, bronze);
    const gate = w - 3;
    v.hollowBox(gate - 3, 1, front + 2, gate + 3, 6, hz - 3, stone);
    v.box(gate - 4, 6, front + 1, gate + 4, 7, hz - 2, limestone);
    v.box(gate - 1, 7, front + 4, gate + 2, 9, hz - 5, bronze);
    weighingRecess(c, gate, 1, hz - 4, 3);
  }
  if (lv === 5) {
    v.hollowBox(-w + 1, 1, hz - 7, 0, 6, hz - 2, stone);
    v.box(-w, 6, hz - 8, 1, 7, hz - 1, limestone);
    v.box(-1, 4, hz - 6, w - 3, 5, hz - 4, bronze);
  }
}

function bronzeShields(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 2,
    back = -hz + 2,
    right = lv === 1 ? 4 : hx - 6,
    front = lv < 3 ? 0 : Math.floor(hz * 0.23),
    h = 4 + lv;
  v.hollowBox(left, 1, back, right + 1, h, front + 1, limestone);
  for (let x = left; x <= right; x += 3) {
    v.box(x, h, back, x + 2, h + 1, front + 1, marble);
    v.box(x, 1, front, x + 1, h + 1, front + 2, stone);
    v.put(x, h - 2, front + 2, bronze);
  }
  if (lv === 1) {
    // Stack the starter reserve behind its weighing room, leaving the front open.
    v.hollowBox(0, 1, back - 1, right + 2, 8, back + 4, stone);
    v.box(-1, 8, back - 1, right + 3, 9, back + 4, marble);
    v.put(right, 7, back + 3, bronze);
  }
  const x = left + 3;
  weighingRecess(c, x, 1, front, 3);
  tallyCourt(c, hx - 4, hz - 4, 2);
  if (lv >= 2) {
    v.hollowBox(right - 3, 1, back - 1, right + 4, h + 2, back + 5, stone);
    v.box(right - 4, h + 2, back - 1, right + 5, h + 3, back + 6, clay);
  }
  if (lv >= 3) {
    v.box(left, 1, front + 1, left + 5, 4, hz - 3, stone);
    v.box(left, 4, front + 1, left + 5, 5, hz - 3, limestone);
    oilLamp(c, left + 1, 5, hz - 5);
  }
  if (lv >= 4) {
    v.cylinderY(right - 2, front - 1, h, h + 3, 3.4, bronze);
    v.cylinderY(right - 2, front - 1, h + 3, h + 4, 2.8, sea);
  }
  if (lv === 5) {
    v.hollowBox(right - 3, 1, front + 3, right + 4, 7, hz - 4, stone);
    v.box(right - 4, 7, front + 2, right + 5, 8, hz - 3, marble);
    for (const xx of [right - 3, right + 3]) column(c, xx, 1, front + 1, 4);
    v.box(right - 4, 5, front, right + 5, 6, front + 4, clay);
  }
}

export function buildTreasury(c: Ctx) {
  [talus, beehive, weighingBeam, bronzeShields][c.variant](c);
  const z = c.hz - 3;
  c.v.box(-3, 0, z - 1, 0, 1, c.hz - 1, limestone);
  resident(c, -2, 1, z, sea);
  oilLamp(c, -1, 1, z);
}
