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
  oliveTree,
  resident,
  scrollRack,
  sea,
  sky,
  stoa,
  stone,
  vermilion,
  wood,
} from "./craft";

const apices = [18, 24, 30, 36, 43];

function signalFire(c: Ctx, x: number, y: number, z: number) {
  c.v.cylinderY(x + 0.5, z + 0.5, y, y + 1, 2, bronze);
  c.v.cylinderY(x + 0.5, z + 0.5, y + 1, y + 2, 1.3, "#e48238", 0.7);
  c.v.put(x, y + 2, z, "#ffdc85", 1.25);
}

function beacon(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = -hx + 4 + Math.floor(lv / 2),
    z = -hz + 4 + Math.floor(lv / 2),
    top = apices[lv - 1];
  const drum = 2 + Math.floor(lv / 2),
    mid = Math.round(top * 0.54);
  v.hollowBox(x - drum - 1, 1, z - drum - 1, x + drum + 2, mid, z + drum + 2, limestone);
  for (let y = 3; y < mid; y += 4) {
    v.box(x - 1, y, z + drum + 1, x + 1, y + 2, z + drum + 2, sea);
    v.box(x + drum + 1, y, z - 1, x + drum + 2, y + 2, z + 1, sea);
    v.box(x - 1, y - 1, z + drum + 1, x + 2, y, z + drum + 3, marble);
  }
  for (const dx of [-drum, drum]) {
    v.box(x + dx, 1, z + drum + 1, x + dx + 1, mid - 2, z + drum + 3, marble);
    v.put(x + dx, mid - 2, z + drum + 2, bronze);
  }
  v.box(x - 1, 1, z + drum + 1, x + 1, 4, z + drum + 2, wood);
  v.box(x - drum - 1, mid - 1, z - drum - 1, x + drum + 2, mid, z + drum + 2, vermilion);
  v.cone(x + 0.5, mid, top - 6, z + 0.5, drum + 0.6, 1.8, marble);
  v.cylinderY(x + 0.5, z + 0.5, top - 6, top - 5, 2.6, sea);
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) v.box(x + dx, top - 5, z + dz, x + dx + 1, top - 2, z + dz + 1, bronze);
  signalFire(c, x, top - 3, z);
  if (lv >= 2) stoa(c, -hx + 1, 3, -hx + 6, hz - 3, 1, 3, true);
  if (lv >= 3) stoa(c, x + drum + 1, -hz + 1, hx - 2, -hz + 7, 1, 4);
  if (lv >= 4) {
    v.box(x + drum, mid - 2, z - 2, hx - 3, mid - 1, z + 2, limestone);
    column(c, hx - 5, 1, z, mid - 3, true);
    resident(c, hx - 6, mid - 1, z);
  }
  if (lv === 5) {
    stoa(c, -2, hz - 10, hx - 2, hz - 4, 1, 4, false, sky);
    oliveTree(c, hx - 7, 1, 1, 3);
  }
}

function bellFrame(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 2,
    right = Math.min(1, hx - 4),
    z = -hz + 4,
    top = apices[lv - 1] + 1;
  for (const x of [left, right]) {
    v.box(x, 1, z - 2, x + 2, top - 3, z + 2, limestone);
    for (let y = 3; y < top - 3; y += 6) v.box(x - 1, y, z - 2, x + 3, y + 1, z + 2, sea);
    v.box(x - 1, top - 4, z - 3, x + 3, top - 3, z + 3, marble);
  }
  v.box(left - 1, top - 3, z - 2, right + 3, top - 2, z + 3, bronze);
  const mid = Math.round((left + right) / 2),
    radius = 1 + Math.floor(lv / 2);
  v.put(mid, top - 4, z, gilt);
  v.cone(mid + 0.5, top - 7, top - 4, z + 0.5, radius + 0.5, 0.7, bronze);
  v.put(mid, top - 8, z, gilt);
  v.box(left - 1, top - 2, z - 3, right + 3, top - 1, z + 4, clay);
  v.box(left - 1, top - 1, z - 1, right + 3, top, z + 2, vermilion);
  v.box(left, 1, z + 2, right + 2, 3, z + 5, stone);
  if (lv >= 2) scrollRack(c, left + 1, 1, hz - 7, Math.min(6, hx));
  if (lv >= 3) stoa(c, 1, -hz + 1, hx - 2, -hz + 8, 2, 4, false, sky);
  if (lv >= 4) {
    const y = Math.floor(top * 0.52);
    v.box(left - 1, y, z - 3, right + 3, y + 1, z + 4, sea);
    v.box(left, y + 1, z + 3, right + 2, y + 2, z + 4, limestone);
    resident(c, mid, y + 1, z + 2);
    const wing = hx - 5;
    v.box(mid, y, z - 2, wing + 3, y + 1, z + 3, limestone);
    v.box(wing - 2, y + 1, z - 3, wing + 3, y + 2, z + 3, sky);
    for (const dx of [-1, 1]) column(c, wing + dx, 1, z, y - 1, true);
    oilLamp(c, wing, y + 2, z + 1);
  }
  if (lv === 5) {
    stoa(c, -hx + 1, 1, -hx + 8, hz - 3, 1, 5, true);
    oliveTree(c, hx - 7, 1, 3, 4);
  }
}

function speakingTerraces(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = hx - 4,
    z = -hz + 4,
    top = apices[lv - 1],
    n = 3 + Math.floor(lv / 2);
  for (let i = 0; i < n; i++) {
    const x1 = x + 2 - i,
      x0 = x1 - (n - i) * 2 - 1,
      zz = z + i,
      y0 = Math.floor((i * (top - 4)) / n) + 1,
      y1 = Math.floor(((i + 1) * (top - 4)) / n) + 1;
    v.hollowBox(x0, y0, zz - 3, x1, y1, zz + 3, marble);
    v.box(x0 - 1, y1 - 1, zz - 3, x1 + 1, y1, zz + 4, clay);
    v.put(x1 - 1, y0 + 2, zz, sea).put(x0 + 1, y0 + 2, zz + 2, sea);
  }
  const tx = x + 1 - n;
  v.box(tx, top - 3, z + n - 2, tx + 1, top + 1, z + n - 1, wood);
  v.box(tx - 3, top - 1, z + n - 2, tx, top + 1, z + n - 1, sea);
  const radius = lv === 1 ? 2 : 3 + lv;
  for (let dx = -radius; dx <= radius; dx++) {
    const zz = Math.round(Math.sqrt(radius * radius - dx * dx) * 0.7);
    v.box(dx, 1, zz, dx + 1, 3, zz + 2, limestone);
    if (dx % 3 === 0) v.put(dx, 3, zz, vermilion);
  }
  if (lv >= 2) {
    stoa(c, -hx + 1, -hz + 1, -hx + 5, 2, 1, 3, true, sky);
    scrollRack(c, -hx + 1, 1, 1, 4);
  }
  if (lv >= 3) oliveTree(c, -hx + 5, 1, 6, 3);
  if (lv >= 4) {
    const y = Math.floor((top - 4) / n) + 1;
    v.box(x - 12, y, z + 1, x - 3, y + 1, z + 8, limestone);
    column(c, x - 9, 1, z + 6, y - 1, true);
    resident(c, x - 8, y + 1, z + 5);
  }
  if (lv === 5) stoa(c, -hx + 2, hz - 9, 1, hz - 4, 1, 5, false, clay);
}

function spiral(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = -hx + 5,
    z = Math.round(-hz * 0.03),
    top = apices[lv - 1] + 2,
    rad = 2 + Math.floor(lv / 2);
  v.cylinderY(x + 0.5, z + 0.5, 1, top - 3, rad, stone);
  for (let y = 2; y < top - 3; y++) {
    const a = (y * Math.PI) / 6,
      dx = Math.round(Math.cos(a) * (rad + 0.7)),
      dz = Math.round(Math.sin(a) * (rad + 0.7));
    v.box(x + dx - 1, y, z + dz - 1, x + dx + 2, y + 1, z + dz + 2, marble);
    v.put(x + dx, y + 1, z + dz, sky);
  }
  v.cylinderY(x + 0.5, z + 0.5, top - 4, top - 3, rad + 1.5, bronze);
  signalFire(c, x, top - 2, z);
  if (lv >= 2) {
    stoa(c, -hx + 1, -hz + 2, hx - 2, -hz + 6, 1, 3);
    scrollRack(c, -hx + 2, 1, -hz + 4, 5);
  }
  if (lv >= 3) {
    v.cylinderY(5.5, 3.5, 1, 2, 3.4, limestone);
    v.cylinderY(5.5, 3.5, 2, 3, 2.1, sky);
    resident(c, 5, 3, 3);
  }
  if (lv >= 4) {
    const y = Math.floor(top * 0.45);
    beam(c, x, y, z, x + 7, y, z + 1, bronze);
    column(c, x + 7, 1, z + 1, y - 1, true);
    v.box(x + 5, y, z - 1, x + 10, y + 1, z + 4, limestone);
    resident(c, x + 7, y + 1, z + 2, clay);
  }
  if (lv === 5) {
    oliveTree(c, 6, 1, -hz + 10, 4);
    stoa(c, 1, hz - 8, hx - 2, hz - 3, 1, 4, false, sky);
  }
}

export function buildAgora(c: Ctx) {
  [beacon, bellFrame, speakingTerraces, spiral][c.variant](c);
  const x = Math.min(c.hx - 4, 3),
    z = c.hz - 5;
  c.v.box(x - 2, 1, z - 1, x + 2, 2, z + 2, limestone);
  resident(c, x, 2, z, vermilion);
  resident(c, x - 4, 1, z + 1);
  oilLamp(c, x - 2, 2, z - 1);
  c.v.box(x - 2, 0, z + 2, x + 2, 1, c.hz - 1, limestone);
}
