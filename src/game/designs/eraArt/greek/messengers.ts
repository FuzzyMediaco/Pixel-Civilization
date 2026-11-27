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
  papyrus,
  resident,
  scrollRack,
  sea,
  signsOfArrival,
  sky,
  stoa,
  stone,
  vermilion,
  wood,
} from "./craft";

function handcart(c: Ctx, x: number, z: number, side = 1) {
  const v = c.v;
  v.box(x - 1, 2, z - 1, x + 2, 3, z + 2, wood);
  v.put(x - 2, 1, z, bronze).put(x + 2, 1, z, bronze);
  v.box(x - 1, 3, z, x + 2, 4, z + 1, papyrus);
  v.put(x + side, 2, z + 2, wood);
}

function runnerGate(c: Ctx, x: number, z: number, h: number) {
  column(c, x - 2, 1, z, h);
  column(c, x + 2, 1, z, h);
  c.v.box(x - 3, h + 1, z - 1, x + 4, h + 2, z + 1, vermilion);
  c.v.put(x, h + 2, z, gilt);
}

function relay(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 1,
    back = -hz + 1,
    end = hx - 3;
  const front = back + 4 + lv;
  stoa(c, left, back, end, front, 1, 3 + Math.floor(lv / 2));
  scrollRack(c, left + 1, 1, front - 3, Math.min(9, end - left - 2));
  v.box(left + 1, 1, front, left + 4, 3, front + 2, wood);
  handcart(c, Math.max(1, Math.round(hx * 0.48)), hz - 5);
  if (lv >= 2) runnerGate(c, end - 2, front + 2, 4);
  if (lv >= 3) {
    v.box(left + 2, 0, front + 4, end - 2, 1, front + 6, limestone);
    resident(c, -4, 1, front + 5, clay);
  }
  if (lv >= 4) {
    stoa(c, left, front, left + 6, hz - 2, 1, 4, true, sky);
    handcart(c, 0, hz - 6);
  }
  if (lv === 5) {
    v.hollowBox(end - 6, 1, back, end, 9, front - 1, stone);
    stoa(c, end - 8, back, end + 1, front, 9, 3);
    resident(c, end - 3, 9, front - 2);
  }
}

function sailLane(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 2,
    back = -hz + 2;
  const reach = lv === 1 ? 5 : Math.max(7, Math.floor(hx * 0.65)),
    bays = lv === 1 ? 1 : lv - 1;
  const length = 2 * hz - 5,
    along = Math.max(4, Math.floor(length / bays));
  for (let i = 0; i < bays; i++) {
    const z = back + i * along,
      d = Math.min(along, hz - 2 - z),
      height = 5 + lv + (i % 2) * 2;
    beam(c, left, 1, z, left, height, z, wood);
    beam(c, left + reach, 1, z + d - 1, left + reach, 3, z + d - 1, wood);
    for (let j = 0; j < d; j++) {
      const width = Math.max(1, Math.round((reach * (j + 1)) / d));
      for (let k = 0; k <= width; k++) {
        const h = height - Math.floor((j / d) * 2 + (k / reach) * (height - 4));
        v.put(left + k, h, z + j, i % 2 ? sky : papyrus);
      }
    }
    v.put(left, height + 1, z, clay);
    scrollRack(c, left + 1, 1, z, Math.min(5, reach - 1));
  }
  // A low plaster sorting bench gives the sail a sheltered working side.
  v.box(left, 0, back, left + reach + 1, 1, hz - 3, limestone);
  v.box(left, 1, back, left + 2, 3, hz - 3, sky);
  for (let z = back + 2; z < hz - 3; z += 3) {
    v.box(left + 1, 3, z, left + 3, 4, z + 1, wood);
    v.put(left + 2, 4, z, papyrus);
  }
  resident(c, left + 3, 1, Math.min(hz - 4, back + 4), vermilion);
  handcart(c, hx - 4, lv === 1 ? 1 : -hz + 4);
  if (lv >= 2) runnerGate(c, hx - 5, hz - 6, 3 + Math.floor(lv / 2));
  if (lv >= 3) {
    stoa(c, 0, back, hx - 1, back + 4, 1, 3);
    v.box(1, 0, back + 6, hx - 2, 1, back + 8, limestone);
  }
  if (lv >= 4) stoa(c, left, hz - 5, 0, hz - 1, 1, 3);
  if (lv === 5) {
    stoa(c, hx - 8, -2, hx - 2, hz - 4, 3, 5, true, sky);
    handcart(c, 5, hz - 7, -1);
  }
}

function scrollHoist(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 2,
    right = hx - 4,
    back = -hz + 2;
  stoa(c, left, back, left + Math.max(5, Math.floor(hx * 0.65)), hz - 4, 1, 3 + Math.floor(lv / 2), true);
  const tower = 5 + 2 * lv;
  column(c, left + 2, 1, back + 2, tower);
  column(c, right, 1, 1, tower - 3);
  beam(c, left + 2, tower + 1, back + 2, right, tower - 2, 1, wood);
  beam(c, left + 2, tower + 2, back + 2, right, tower - 1, 1, bronze);
  for (let i = 1; i <= lv; i++) {
    const t = i / (lv + 1),
      x = left + 2 + (right - left - 2) * t,
      z = back + 2 + (-back - 1) * t,
      h = tower + 1 - 3 * t;
    v.put(x, h - 1, z, wood).put(x, h - 2, z, papyrus);
  }
  handcart(c, right, hz - 4);
  if (lv >= 2) scrollRack(c, right - 3, 1, -1, 5);
  if (lv >= 3) {
    v.box(right - 3, 1, -3, right + 3, 4, 3, stone);
    resident(c, right - 1, 4, 1);
  }
  if (lv >= 4) stoa(c, 1, back, hx - 2, back + 5, 1, 4, false, sky);
  if (lv === 5) {
    column(c, -2, 1, hz - 5, tower - 1);
    beam(c, right, tower - 2, 1, -2, tower, hz - 5, bronze);
    v.box(-5, tower - 1, hz - 7, 1, tower, hz - 3, sea);
    v.put(-1, tower - 4, hz - 5, papyrus);
  }
}

function pigeonFork(c: Ctx) {
  const { v, hx, hz, lv } = c,
    left = -hx + 1,
    back = -hz + 1,
    h = 6 + lv,
    x = hx - 5;
  stoa(c, left, back, hx - 2, back + 4, 1, 3);
  v.hollowBox(x - 2, 1, back + 1, x + 3, h, back + 6, limestone);
  for (let y = 3; y < h; y += 2) {
    v.put(x - 1, y, back + 5, wood).put(x + 1, y, back + 5, wood);
    v.box(x - 2, y - 1, back + 5, x + 3, y, back + 7, clay);
  }
  v.cone(x + 0.5, h, h + 3, back + 3, 3.8, 0.6, sea);
  v.put(x, h + 3, back + 3, marble);
  handcart(c, -hx + 5, hz - 4);
  if (lv >= 2) {
    scrollRack(c, -3, 1, back + 4, 5);
    v.box(x + 1, 0, back + 7, x + 3, 1, hz - 2, limestone);
  }
  if (lv >= 3) stoa(c, left, back + 4, left + 5, hz - 3, 1, 3, true, sky);
  if (lv >= 4) {
    stoa(c, 2, back + 7, hx - 2, back + 12, 1, 3);
    runnerGate(c, 0, hz - 5, 4);
  }
  if (lv === 5) {
    v.hollowBox(left + 2, 1, back + 1, left + 8, h + 3, back + 7, stone);
    v.cone(left + 5, h + 3, h + 7, back + 4, 4.3, 0.7, vermilion);
    for (let y = 4; y < h + 2; y += 2) v.put(left + 5, y, back + 6, wood);
    handcart(c, 8, hz - 5, -1);
  }
}

export function buildMessengerStoa(c: Ctx) {
  [relay, sailLane, scrollHoist, pigeonFork][c.variant](c);
  signsOfArrival(c, -1, c.hz - 3);
  oilLamp(c, -1, 2, c.hz - 3);
}
