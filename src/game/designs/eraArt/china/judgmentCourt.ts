import { type Ctx, type PixelVox } from "../../kit";
import { beam, oval, slab } from "../../sculpturalKit";
import { streetLamp, clerk, courtPath, ink, lantern, stairs, timberBay } from "./civicParts";

function screen(v: PixelVox, x: number, z: number, length: number, height: number) {
  v.box(x, 1, z, x + 2, height, z + length, ink.paper);
  v.box(x - 1, height, z - 1, x + 3, height + 1, z + length + 1, ink.tile);
  for (let n = 0; n < length; n += 3) v.box(x, 1, z + n, x + 2, height + 1, z + n + 1, ink.post);
}

function benchOfRecord(v: PixelVox, x: number, z: number, floor: number, half: number) {
  v.box(x - half, floor, z, x + half + 1, floor + 2, z + 2, ink.sill);
  v.box(x - half - 1, floor + 2, z - 1, x + half + 2, floor + 3, z + 2, ink.post);
  clerk(v, x, floor, z - 2);
  v.put(x + 1, floor + 3, z, ink.paper);
}

function screenStair(c: Ctx) {
  const { v, hx, hz, lv } = c,
    back = -Math.floor(hz * 0.38),
    r = Math.min(hx - 3, 4 + lv),
    floor = 2 + lv;
  v.box(-r, 1, back - 3, r + 1, floor + 1, back + 4, ink.brick);
  stairs(v, 0, back + 4 + floor, Math.min(r - 1, 4), floor, floor + 1);
  timberBay(v, 0, back, r, 4, floor, 4 + lv);
  benchOfRecord(v, 0, back + 1, floor + 1, 2);
  for (const sign of [-1, 1]) {
    const x = sign * (hx - 4);
    screen(v, x, back + 4, Math.min(hz - 3, 5 + lv), 3);
    if (lv >= 3) lantern(v, x, 4, back + 6);
    if (lv >= 4) timberBay(v, x - sign, back + 5, 3, 3, 1, 4);
  }
  if (lv === 5) for (const s of [-1, 1]) screen(v, s * (r + 2), -hz + 2, 6, 5);
  courtPath(c, 0, back + 4 + floor);
}

function witnessDrums(c: Ctx) {
  const { v, hx, hz, lv } = c,
    back = -Math.floor(hz * 0.36),
    rise = 3 + lv;
  const side = Math.min(hx - 4, 4 + lv * 2);
  for (const s of [-1, 1]) {
    const x = s * side;
    slab(v, oval(x, back + 6, 2 + lv * 0.26, 3, 8), 1, 2, ink.brick);
    v.cylinderY(x, back + 6, 3, 5 + Math.floor(lv / 2), 2, ink.post);
    v.cylinderY(x, back + 6, 5 + Math.floor(lv / 2), 6 + Math.floor(lv / 2), 2, ink.bamboo);
    const firstScreen = Math.min(hz - 5, back + 9);
    screen(v, x, firstScreen, Math.max(2, hz - firstScreen - 2), 2 + Number(lv >= 3));
    if (lv >= 3) timberBay(v, x, back - 2, 3, 3, 1, 4);
    if (lv >= 4) lantern(v, x, 4, back + 4);
  }
  const r = Math.min(hx - 4, 3 + lv);
  slab(v, oval(0, back, r + 1, 4, 8), 1, rise, ink.brick);
  timberBay(v, 0, back, r, 4, rise + 1, 6 + lv);
  benchOfRecord(v, 0, back + 1, rise + 2, 1);
  stairs(v, 0, back + 3 + rise, 2 + Number(lv >= 3), rise, rise + 1);
  if (lv === 5) timberBay(v, 0, -hz + 4, 5, 3, 1, 8);
  courtPath(c, 0, back + 4 + rise);
}

function listenersFan(c: Ctx) {
  const { v, hx, hz, lv } = c,
    back = -Math.floor(hz * 0.4),
    floor = 3 + lv;
  const rings = 1 + Math.floor(lv / 2),
    r = Math.min(hx - 2, hz - back - 5, 6 + lv * 2);
  // Seating flares out to the street. The middle stays open from the gate to the bench.
  for (let i = 0; i < rings; i++) {
    const radius = Math.max(3, r - i * 3),
      y = 1 + (rings - i - 1);
    for (const s of [-1, 1]) {
      beam(
        v,
        [s * 3, y, back + radius + 3],
        [s * (radius - 1), y, back + Math.floor(radius * 0.66)],
        ink.bamboo,
        2,
      );
      if (lv >= 3)
        beam(
          v,
          [s * (radius - 1), y, back + Math.floor(radius * 0.66)],
          [s * radius, y, back + 2],
          ink.bamboo,
          2,
        );
    }
  }
  slab(v, oval(0, back, Math.min(6, hx - 3), 4, 8), 1, floor, ink.stone);
  timberBay(v, 0, back, Math.min(hx - 2, 3 + lv), 3, floor + 1, 5 + lv);
  benchOfRecord(v, 0, back + 1, floor + 2, 1);
  stairs(v, 0, back + 5 + floor, 2, floor, floor + 1);
  courtPath(c, 0, back + 5 + floor);
  for (const s of [-1, 1]) {
    screen(v, s * (hx - 3), back + 1, Math.min(5, hz), 2);
    if (lv >= 4) lantern(v, s * (hx - 3), 3, back + 3);
    if (lv === 5) timberBay(v, s * (hx - 6), hz - 6, 4, 3, 1, 4);
  }
}

function crossedGalleries(c: Ctx) {
  const { v, hx, hz, lv } = c,
    back = -Math.floor(hz * 0.28),
    floor = 3 + lv;
  for (const s of [-1, 1]) {
    const x = s * Math.min(hx - 4, 4 + lv);
    timberBay(v, x, back, 3, 2, 1, 3 + Number(lv >= 3));
    screen(v, x, back + 4, Math.min(hz - 4, 3 + lv), 2);
    if (lv >= 3) {
      const front = back + 7;
      v.box(x - 2, 1, front, x + 3, 3, front + 2, ink.brick);
      benchOfRecord(v, x, front, 3, 1);
    }
    if (lv >= 4) timberBay(v, x, back - 4, 3, 2, 1, 4);
    if (lv === 5) timberBay(v, s * (hx - 5), hz - 5, 3, 3, 1, 5);
  }
  v.box(-3, 1, back - 4, 4, floor + 1, back + 4, ink.brick);
  timberBay(v, 0, back, 4, Math.min(6, hz - 2), floor + 1, 5 + lv);
  benchOfRecord(v, 0, back + 2, floor + 2, 2);
  stairs(v, 0, back + 4 + floor, 2, floor, floor + 1);
  courtPath(c, 0, back + 4 + floor);
}

export function buildJudgmentCourt(c: Ctx) {
  [screenStair, witnessDrums, listenersFan, crossedGalleries][c.variant](c);
  const [x, z] = [
    [c.hx - 3, c.hz - 3],
    [-c.hx + 5, c.hz - 3],
    [c.hx - 2, c.hz - 3],
    [-c.hx + 4, c.hz - 3],
  ][c.variant];
  streetLamp(c.v, x, z, 4 + Number(c.lv >= 3));
}
