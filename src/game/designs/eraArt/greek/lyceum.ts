import type { Ctx } from "../../kit";
import {
  beam,
  bronze,
  clay,
  column,
  gilt,
  limestone,
  marble,
  oilLamp,
  olive,
  oliveTree,
  papyrus,
  resident,
  scrollRack,
  sea,
  signsOfArrival,
  sky,
  stoa,
  stone,
  tiers,
  wood,
} from "./craft";

function listeningSteps(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = Math.min(hx - 3, hz - 2),
    tx = lv === 1 ? 1 : Math.floor(hx * 0.24);
  tiers(c, tx, -1, r, Math.max(2, Math.floor(r / 2)), 1, 0.72, 0.83);
  oliveTree(c, tx, 1, 0, 2 + Math.floor(lv / 2));
  stoa(c, -hx + 1, -hz + 2, -hx + 5 + (lv > 2 ? 2 : 0), hz - 3, 1, 2 + lv, true);
  scrollRack(c, -hx + 1, 1, -hz + 2, 3);
  if (lv >= 2) resident(c, tx - 3, 2, 1);
  if (lv >= 3) {
    const back = -hz + 2;
    v.box(tx - 4, 1, back, tx + 6, 3, back + 3, limestone);
    scrollRack(c, tx - 3, 3, back, 7);
  }
  if (lv >= 4) stoa(c, tx + 2, -hz + 1, hx - 2, -hz + 6, 3, 4, false, sky);
  if (lv === 5) {
    oliveTree(c, -hx + 7, 3, -hz + 6, 4);
    v.box(-hx + 3, 1, hz - 7, tx - 3, 3, hz - 4, marble);
    resident(c, -hx + 6, 3, hz - 5, clay);
  }
}

function foldedStoa(c: Ctx) {
  const { v, hx, hz, lv } = c,
    tip = -hz + 2,
    end = Math.max(2, hz - 5),
    width = lv < 3 ? 2 : 3;
  for (const side of [-1, 1]) {
    const reach = hx - (lv === 1 ? 3 : 4);
    const endZ = end - (side < 0 && lv >= 3 ? 4 : 0);
    for (let z = tip; z <= endZ; z++) {
      const t = (z - tip) / (endZ - tip),
        x = side * Math.round(reach * t),
        h = 4 + Math.floor((1 - t) * lv);
      v.box(x - width, h, z, x + width + 1, h + 1, z + 1, side < 0 ? clay : sky);
      v.put(x, h + 1, z, side < 0 ? marble : sea);
      if ((z - tip) % 4 === 0 || z === endZ) {
        column(c, x, 1, z, h - 1);
        v.put(x + side, 2, z, papyrus);
      }
    }
  }
  oliveTree(c, 0, 1, Math.max(1, Math.floor(hz * 0.2)), lv >= 4 ? 4 : 2);
  tiers(c, 0, end, Math.min(4, Math.floor(hx * 0.34)), 1, 1, 0.9, 0.7);
  if (lv >= 2) scrollRack(c, -hx + 2, 1, end + 1, Math.min(6, hx - 2));
  if (lv >= 3) stoa(c, -hx + 2, -hz + 2, -2, -hz + 6, 1, 3);
  if (lv >= 4) {
    v.box(2, 1, -hz + 1, hx - 3, 3, -hz + 7, stone);
    oliveTree(c, hx - 7, 3, -hz + 4, 3);
  }
  if (lv === 5) stoa(c, -hx + 1, 1, -hx + 6, hz - 2, 3, 4, true, sky);
}

function cabinetPassage(c: Ctx) {
  const { v, hx, hz, lv } = c,
    width = hx - 2,
    z = -Math.round(hz * 0.35),
    span = lv < 3 ? 3 : 5;
  for (const side of [-1, 1]) {
    const x = side < 0 ? -width : span;
    const length = width - span + 1,
      h = 4 + lv;
    v.hollowBox(x, 1, z - 2, x + length, h, z + 3, stone);
    for (let y = 1; y < h; y += 3) scrollRack(c, x, y, z + 2, length);
    for (let t = x; t < x + length; t += 3) {
      v.box(t, h, z - 2, t + 2, h + 2, z + 4, papyrus);
      v.put(t, h + 1, z + 3, bronze);
    }
  }
  const deck = 5 + lv;
  v.box(-span - 1, deck, z - 2, span + 1, deck + 1, z + 3, wood);
  for (let x = -span; x <= span; x += 2) v.put(x, deck + 1, z + 2, gilt);
  oliveTree(c, -width + 2, 1, hz - 4, lv >= 4 ? 3 : 2);
  if (lv >= 2) stoa(c, -hx + 2, -hz + 1, 0, -hz + 5, 1, 3);
  if (lv >= 3) {
    for (let i = 0; i < deck - 1; i++) v.box(hx - 5, i + 1, z + deck - i, hx - 2, i + 2, z + deck - i + 1, limestone);
    resident(c, 0, deck + 1, z + 1);
  }
  if (lv >= 4) stoa(c, 2, z - 4, hx - 2, z + 2, deck, 3, false, clay);
  if (lv === 5) {
    tiers(c, 3, hz - 9, 7, 3, 1, 0.8);
    oliveTree(c, 3, 1, hz - 9, 3);
  }
}

function readingCircle(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = lv === 1 ? 0 : -2;
  const rx = hx - 3,
    rz = hz - 3;
  for (let x = -rx; x <= rx; x++)
    for (let dz = -rz; dz <= rz; dz++) {
      const r = Math.hypot(x / rx, dz / rz);
      if (r < 0.72 || r > 1 || (dz > 0 && Math.abs(x) < Math.max(1, rx * 0.25))) continue;
      v.put(x, 1, z + dz, limestone);
      if (dz < 0 || (lv >= 3 && x > rx * 0.68)) v.put(x, 4 + Math.floor(lv / 2), z + dz, olive);
    }
  const h = 4 + Math.floor(lv / 2);
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i * Math.PI) / 6;
    const x = Math.round(rx * 0.87 * Math.cos(a)),
      zz = z + Math.round(rz * 0.86 * Math.sin(a));
    column(c, x, 1, zz, h - 1);
    if (i % 2 === 0) v.put(x, h + 1, zz, sky);
  }
  oliveTree(c, 0, 1, z, 2 + Math.floor(lv / 2));
  if (lv >= 2) scrollRack(c, -4, 1, z - rz, 7);
  if (lv >= 3) oliveTree(c, -Math.round(rx * 0.65), 1, z + Math.round(rz * 0.45), 3);
  if (lv >= 4) stoa(c, hx - 9, -hz + 3, hx - 2, 0, 2, 5, true, clay);
  if (lv === 5) {
    tiers(c, -7, hz - 8, 6, 2, 1, 0.55, 0.8);
    oliveTree(c, 6, 1, hz - 7, 3);
  }
}

export function buildLyceum(c: Ctx) {
  [listeningSteps, foldedStoa, cabinetPassage, readingCircle][c.variant](c);
  signsOfArrival(c, 0, c.hz - 3);
  beam(c, -2, 2, c.hz - 4, 0, 2, c.hz - 4, wood);
  oilLamp(c, 0, 2, c.hz - 4);
}
