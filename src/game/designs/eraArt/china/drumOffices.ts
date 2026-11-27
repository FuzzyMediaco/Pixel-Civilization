import { type Ctx, type PixelVox } from "../../kit";
import { beam, oval, slab } from "../../sculpturalKit";
import {
  streetLamp,
  clerk,
  courtPath,
  cypress,
  ink,
  lantern,
  stairs,
  tileRoof,
  timberBay,
} from "./civicParts";

function noticeBoard(v: PixelVox, x: number, z: number, width: number) {
  v.box(x, 1, z, x + 1, 5, z + 1, ink.sill);
  v.box(x + width, 1, z, x + width + 1, 5, z + 1, ink.sill);
  v.box(x, 3, z, x + width + 1, 6, z + 1, ink.cord);
  for (let i = 1; i < width; i += 2) {
    v.box(x + i, 3, z + 1, x + i + 1, 5 + Number(i % 3 === 0), z + 2, ink.paper);
    v.put(x + i, 4, z + 1, ink.sill);
  }
}

function gong(v: PixelVox, x: number, y: number, z: number, r: number) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++) {
      const d = Math.hypot(dx, dy);
      if (d <= r + 0.15)
        v.box(x + dx, y + dy, z, x + dx + 1, y + dy + 1, z + 2, d > r - 0.8 ? ink.bronze : "#dca75e");
    }
  v.put(x, y, z + 2, ink.bronze);
}

function timberTower(
  c: Ctx,
  x: number,
  z: number,
  wide: number,
  floor: number,
  cap: number,
  gongTower = false,
) {
  const { v, lv } = c;
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const ax = x + s * wide,
        az = z + t * wide;
      v.box(ax, 1, az, ax + 2, cap, az + 2, ink.post);
      beam(v, [ax, 2, az], [x - s * wide, Math.max(4, floor - 1), az], ink.sill);
    }
  v.box(x - wide - 1, floor, z - wide - 1, x + wide + 2, floor + 1, z + wide + 2, ink.sill);
  if (gongTower) {
    gong(v, x, floor + 4, z, Math.min(wide, 3));
    v.box(x, floor + 5, z, x + 1, cap, z + 1, ink.cord);
  } else {
    for (let dz = -2; dz <= 2; dz++) {
      const rad = Math.abs(dz) === 2 ? 2 : 3;
      for (let dx = -rad; dx <= rad; dx++)
        for (let dy = -rad; dy <= rad; dy++) {
          if (dx * dx + dy * dy <= rad * rad)
            v.put(x + dx, floor + 4 + dy, z + dz, Math.abs(dz) === 2 ? ink.bamboo : ink.post);
        }
    }
    beam(v, [x - 2, floor + 1, z + 3], [x + 2, floor + 5, z + 4], ink.sill);
  }
  tileRoof(v, x, z, wide + 2, wide + 1, cap, Math.max(3, Math.ceil(lv / 2)));
}

function stairDrum(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = -hx + 6,
    z = -hz + 6,
    floor = 7 + lv * 2;
  timberTower(c, x, z, 3 + Number(lv >= 4), floor, floor + 8);
  timberBay(v, hx - 5, 0, 4, Math.min(6, hz - 2), 1, 4);
  noticeBoard(v, Math.max(x + 3, -2), hz - 4, 4);
  courtPath(c, 1, -hz + 5);
  if (lv >= 2) stairs(v, x, z + Math.min(floor, hz), 2, floor - 1, Math.min(hz - 2, floor));
  if (lv >= 3) {
    timberBay(v, hx - 5, -hz + 5, 4, 3, 1, 4);
    clerk(v, 4, 1, 2);
  }
  if (lv >= 4) {
    tileRoof(v, x, z, 5, 4, floor - 2, 3);
    // Raised petition gallery crosses the notice square beneath the tower balcony.
    const deck = 6;
    v.box(x + 2, deck, z - 2, hx - 5, deck + 1, z + 2, ink.sill);
    for (let post = x + 4; post < hx - 5; post += 5) v.box(post, 1, z, post + 1, deck, z + 1, ink.post);
    timberBay(v, 0, z, Math.min(7, hx - 4), 3, deck + 1, 4);
    stairs(v, hx - 7, z + 7, 2, deck, 5);
  }
  if (lv === 5) {
    timberBay(v, 0, hz - 5, 5, 3, 1, 5);
    cypress(v, hx - 4, hz - 4, 9);
  }
}

function waterClock(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = hx - 6,
    z = -Math.floor(hz * 0.3),
    high = 11 + lv * 2;
  slab(v, oval(x, z, 4, 4, 8), 1, 3, ink.brick);
  for (let tier = 0; tier < Math.min(lv + 1, 4); tier++) {
    const y = 3 + tier * 3 + 1,
      rx = Math.max(2, 4 - tier * 0.45);
    slab(v, oval(x, z, rx, rx * 0.8, 8), y, 2, ink.bronze);
    slab(v, oval(x, z, rx - 1, Math.max(1, rx * 0.8 - 1), 8), y + 2, 1, "#689a98");
  }
  timberTower(c, x, z, 3, high, high + 8, true);
  timberBay(v, -hx + 5, Math.floor(hz * 0.22), 4, Math.min(6, hz - 2), 1, 4);
  courtPath(c, -1, -hz + 3);
  if (lv >= 2) noticeBoard(v, -hx + 3, -hz + 4, 5);
  if (lv >= 3) {
    v.box(x - 2, 0, z + 4, x + 1, 1, hz - 3, "#689a98");
    clerk(v, -3, 1, 0);
  }
  if (lv >= 4) {
    timberBay(v, -hx + 6, -hz + 6, 5, 4, 1, 5);
    lantern(v, x, high - 1, z + 3);
  }
  if (lv === 5) {
    v.box(-5, 3, z + 4, x + 1, 4, z + 7, ink.sill);
    timberBay(v, -3, z + 5, 4, 3, 4, 4);
  }
}

function lanternSquare(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = -hx + 6,
    z = Math.floor(hz * 0.25),
    high = 8 + lv * 2;
  // Corner tower overlooking an eight-sided meeting ground. The street side is always open.
  const r = Math.max(4, Math.min(hx, hz) * 0.55);
  slab(v, oval(2, -1, r, r * 0.85, 8), 0, 1, ink.stone);
  timberTower(c, x, z, 3, high, high + 8, true);
  for (const side of [-1, 1]) lantern(v, x + side * 3, high - 1, z + 3);
  timberBay(v, hx - 5, -hz + 5, 4, 3, 1, 3);
  if (lv >= 2) {
    noticeBoard(v, 0, -hz + 5, 5);
    courtPath(c, 2, 1);
  }
  if (lv >= 3) {
    timberBay(v, hx - 5, hz - 5, 4, 3, 1, 5);
    clerk(v, 3, 1, 1);
  }
  if (lv >= 4) {
    slab(v, oval(2, -1, r * 0.5, r * 0.45, 8), 1, 2, ink.brick);
    stairs(v, 2, 4, 2, 2, 2);
    tileRoof(v, x, z, 5, 5, high - 3, 3);
  }
  if (lv === 5) {
    timberBay(v, -hx + 6, -hz + 5, 4, 3, 1, 4);
    noticeBoard(v, hx - 9, 2, 5);
  }
}

function balconyWalk(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = hx - 6,
    z = hz - 6,
    high = 8 + lv * 2,
    walkway = 3 + lv;
  timberTower(c, x, z, 3, high, high + 8);
  const end = -hx + 4;
  v.box(end, walkway, z - 2, x - 2, walkway + 1, z + 2, ink.sill);
  for (let post = end; post < x - 2; post += 5) {
    v.box(post, 1, z, post + 1, walkway, z + 1, ink.post);
    v.box(post, walkway + 1, z + 1, post + 1, walkway + 3, z + 2, ink.post);
  }
  v.box(end, walkway + 2, z + 1, x - 2, walkway + 3, z + 2, ink.post);
  timberBay(v, end + 1, z, 3, 3, walkway + 1, 3);
  noticeBoard(v, 0, -2, 4);
  courtPath(c, 0, 0);
  if (lv >= 2) stairs(v, end + 1, z - 2, 2, walkway, Math.min(6, hz - 3));
  if (lv >= 3) {
    timberBay(v, end + 2, -hz + 5, 4, 3, 1, 4);
    clerk(v, x - 3, walkway + 1, z);
  }
  if (lv >= 4) {
    timberBay(v, 0, z, 4, 3, walkway + 1, 4);
    lantern(v, 0, walkway - 1, z);
    // The public ledger hall and lantern bridge occupy the formerly open rear of the square.
    const hallZ = -hz + 5;
    timberBay(v, 0, hallZ, Math.min(8, hx - 5), 4, 1, 9);
    lantern(v, 0, 8, hallZ + 3);
    beam(v, [end + 3, walkway, z - 2], [-3, 5, hallZ + 4], ink.sill, 2);
  }
  if (lv === 5) {
    timberBay(v, x, -hz + 6, 4, 4, 1, 5);
    cypress(v, -3, -hz + 4, 9);
  }
}

export function buildDrumOffices(c: Ctx) {
  [stairDrum, waterClock, lanternSquare, balconyWalk][c.variant](c);
  const [x, z] = [
    [2, c.hz - 2],
    [-c.hx + 4, c.hz - 4],
    [c.hx - 2, c.hz - 2],
    [c.hx - 2, -c.hz + 4],
  ][c.variant];
  streetLamp(c.v, x, z, 4 + Number(c.lv >= 3));
}
