// Parliamentary chambers are cut away towards +z so the street can see the delegates and speaker.
import { byLv, person, type Ctx, type PixelVox } from "./kit";
import { beam, entrance, finish as f, oval, planter, slab } from "./sculpturalKit";

const stone = "#d6c3a3",
  ivory = "#f4e7cc",
  gold = "#d5a05b",
  bronze = "#946a49";
const timber = "#975f46",
  bench = "#397577",
  glass = "#709a9b",
  lamp = "#ffe2a2";
function speaker(v: PixelVox, x: number, z: number, y = 1) {
  v.box(x - 3, y, z - 2, x + 3, y + 1, z + 2, stone);
  v.box(x - 2, y + 1, z, x + 2, y + 3, z + 1, timber);
  v.box(x - 2, y + 3, z, x + 2, y + 4, z + 1, gold);
  v.put(x + 1, y + 4, z, lamp, 0.55);
  person(v, x, y + 1, z - 2, "#556a76");
}

function colors(v: PixelVox, x: number, z: number, y: number, h: number) {
  v.box(x, y, z, x + 1, y + h, z + 1, bronze);
  v.box(x + 1, y + h - 3, z, x + 4, y + h - 1, z + 1, bench);
  v.box(x + 1, y + h - 1, z, x + 5, y + h, z + 1, "#ba664f");
}

// Leave a south-facing opening in the seating. Reading lights alternate with the desk bays.
function seating(v: PixelVox, x: number, z: number, rx: number, rz: number, n: number, opening = 0.12) {
  slab(v, oval(x, z, rx + 1, rz + 1), 0, 1, stone);
  for (let k = 0; k < n; k++) {
    const ratio = 0.49 + (0.48 * (k + 1)) / n,
      h = 1 + k * 2;
    const points = Math.ceil(rx * 3);
    for (let j = 0; j <= points; j++) {
      const a = Math.PI * (1 - opening) + (Math.PI * (1 + 2 * opening) * j) / points;
      const px = Math.round(x + Math.cos(a) * rx * ratio),
        pz = Math.round(z + Math.sin(a) * rz * ratio);
      v.box(px - 1, 1, pz - 1, px + 1, h + 1, pz + 1, k % 2 ? stone : ivory);
      v.box(px - 1, h + 1, pz - 1, px + 1, h + 2, pz + 1, bench);
      if (j % 7 === 0) {
        v.put(px, h + 2, pz, bronze);
        v.put(px, h + 2, pz + 1, lamp, 0.3);
      }
    }
  }
  // Seated delegates leave the central axis and the public entrance clear.
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1.13 + (0.73 * (i + 0.5)) / n),
      ratio = 0.49 + (0.48 * (i + 1)) / n;
    const px = Math.round(x + Math.cos(a) * rx * ratio),
      pz = Math.round(z + Math.sin(a) * rz * ratio);
    v.put(px, 3 + i * 2, pz, i % 2 ? "#af7259" : "#687c98");
    v.put(px, 4 + i * 2, pz, i % 2 ? "#946b58" : "#c99b76");
  }
  speaker(v, x, z + 1);
}
function stair(c: Ctx, x: number, z: number, w: number) {
  entrance(c, x, z - 1, Math.floor(w / 2), stone);
  const { v, hz } = c;
  for (let i = 0; i < 3; i++) {
    const p = Math.min(hz - 1, z + 3 - i);
    v.box(x - w / 2, 1, p, x + w / 2, 2 + i, p + 1, ivory);
  }
}
function chamberArc(
  v: PixelVox,
  x: number,
  z: number,
  rx: number,
  rz: number,
  a0: number,
  a1: number,
  y: number,
  width: number,
  color: string,
) {
  const count = Math.ceil((a1 - a0) * Math.max(rx, rz) * 1.6);
  for (let j = 0; j <= count; j++) {
    const a = a0 + ((a1 - a0) * j) / count;
    for (let lane = 0; lane < width; lane++) {
      const px = x + (rx + lane) * Math.cos(a),
        pz = z + (rz + lane) * Math.sin(a);
      v.box(px, y, pz, px + 1, y + 1, pz + 1, color);
    }
  }
}
function hemicycle(c: Ctx) {
  const { v, lv, hx, hz } = c,
    rx = hx - 7,
    rz = Math.min(hz - 7, Math.floor(rx * 0.74)),
    z = lv < 3 ? 1 : 3;
  const tiers = lv + 1;
  seating(v, 0, z, rx, rz, tiers);
  const angles = [Math.PI * 1.03, Math.PI * 1.28, Math.PI * 1.5, Math.PI * 1.72, Math.PI * 1.97];
  const high = tiers * 2 + byLv(c, [2, 4, 7, 9, 13]);
  for (const a of angles) {
    const x = (rx + 2) * Math.cos(a),
      bz = z + (rz + 2) * Math.sin(a);
    v.box(x - 1, 1, bz - 1, x + 1, high, bz + 1, bronze);
    v.put(x, high, bz, lamp, 0.4);
  }
  chamberArc(v, 0, z, rx + 1, rz + 1, Math.PI, Math.PI * 2, high, 2, stone);
  if (lv < 5) colors(v, 0, z - rz - 2, high + (lv >= 3 ? 3 : 0), 5);
  if (lv >= 2) {
    const side = -hx + 4;
    v.hollowBox(side - 2, 1, z, side + 3, 8, z + 6, stone);
    v.box(side - 1, 2, z + 5, side + 2, 5, z + 6, glass, 0.2);
    colors(v, side + 1, z + 1, 8, 4);
  }
  if (lv >= 3) {
    chamberArc(v, 0, z, rx + 1, rz + 1, Math.PI * 1.16, Math.PI * 1.84, high + 1, 3, bronze);
    chamberArc(v, 0, z, rx + 1, rz + 1, Math.PI * 1.24, Math.PI * 1.76, high + 3, 4, ivory);
    for (const a of angles.slice(1, 4)) {
      const x = (rx + 2) * Math.cos(a),
        bz = z + (rz + 2) * Math.sin(a);
      v.box(x, high, bz, x + 1, high + 4, bz + 1, stone);
    }
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      const x = side * (rx - 3),
        start = z + 1;
      v.box(x - 2, 1, start, x + 2, 9, start + 2, bronze);
      v.box(x - 3, 9, start - 1, x + 3, 11, start + 7, ivory);
      planter(v, x, 0, start + 8, 2);
    }
  }
  if (lv === 5) {
    for (const a of [1.24, 1.5, 1.76])
      colors(
        v,
        Math.round((rx + 2) * Math.cos(a * Math.PI)),
        z + Math.round((rz + 2) * Math.sin(a * Math.PI)),
        high + 4,
        8,
      );
    for (const side of [-1, 1]) {
      const x = side * (rx - 4);
      v.box(x - 3, 1, hz - 9, x + 3, 4, hz - 5, stone);
      v.box(x - 2, 4, hz - 8, x + 2, 5, hz - 6, bench);
    }
  }
  stair(c, 0, z + 6, byLv(c, [5, 7, 9, 11, 13]));
}

function galleryHall(v: PixelVox, x: number, z: number, w: number, d: number, h: number, side: number) {
  // Each hall opens inwards onto the division street. Light enters between the tall piers.
  const outer = x + side * w;
  for (let a = z; a < z + d; a += 4) {
    v.box(outer - 1, 1, a, outer + 1, h, a + 2, stone);
    v.box(outer, 3, a + 2, outer + 1, h - 1, Math.min(a + 4, z + d), glass, 0.2);
  }
  for (let a = 0; a <= w; a++) {
    const px = x + side * a,
      top = h + Math.round(3 * Math.sin((a * Math.PI) / w));
    v.box(px, top, z, px + 1, top + 2, z + d, a === 0 || a === w ? gold : ivory);
  }
  for (const a of [z + 1, z + d - 2]) v.box(x, 1, a, x + 1, h + 1, a + 1, bronze);
  for (let a = z + 2; a < z + d - 2; a += 4) {
    v.box(x + side * 2, 2, a, x + side * (w - 1) + 1, 3, a + 2, bench);
    v.put(x + side * 2, 3, a + 1, lamp, 0.4);
    if ((a - z - 2) % 8 === 0) {
      v.put(x + side * 3, 3, a, "#8d6e74");
      v.put(x + side * 3, 4, a, "#c79b79");
    }
  }
}
function bridge(v: PixelVox, left: number, right: number, z: number, y: number, width: number) {
  v.box(left, y, z, right, y + 1, z + width, bronze);
  for (const side of [z, z + width - 1]) {
    v.box(left, y + 3, side, right, y + 4, side + 1, gold);
    for (let x = left; x < right; x += 3) v.box(x, y + 1, side, x + 1, y + 3, side + 1, stone);
  }
}
function divisionBridges(c: Ctx) {
  const { v, lv, hx, hz } = c,
    gap = byLv(c, [3, 5, 6, 8, 10]),
    z = -hz + 5;
  const d = byLv(c, [14, 19, 25, 31, 40]),
    w = byLv(c, [4, 6, 7, 9, 10]),
    h = byLv(c, [6, 9, 12, 15, 18]);
  for (const side of [-1, 1])
    galleryHall(v, side * gap, z + (side === 1 ? 2 : 0), w, d, h + (side === 1 ? 0 : 3), side);
  v.box(-gap + 1, 0, z, gap, 1, hz, stone);
  speaker(v, 0, z + 5);
  if (lv >= 2) {
    bridge(v, -gap - 2, gap + 3, z + 4, h, 4);
    person(v, 0, h + 1, z + 5, "#aa6c55");
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) {
      const x = side * (gap + w);
      v.box(x - 1, 1, z + d - 3, x + 2, h + 3, z + d + 1, stone);
      colors(v, x, z + d - 2, h + 3, 4 + lv);
    }
    bridge(v, -gap - 2, gap + 3, z + d - 7, 4, 4);
  }
  if (lv >= 4) {
    const y = h + 7;
    for (const side of [-1, 1]) {
      const x = side * gap;
      v.box(x - 1, h, z + 9, x + 1, y, z + 12, bronze);
    }
    bridge(v, -gap - 2, gap + 3, z + 9, y, 4);
    person(v, 3, y + 1, z + 10, "#53827b");
    for (let i = 0; i < 4; i++) v.box(-gap - 3, 1 + i, hz - 4 - i, -gap + 1, 2 + i, hz - 3 - i, ivory);
  }
  if (lv === 5) {
    galleryHall(v, -gap - 5, hz - 13, 6, 9, 8, -1);
    galleryHall(v, gap + 5, hz - 16, 6, 10, 10, 1);
    for (const side of [-1, 1]) planter(v, side * (gap + 4), 0, hz - 4, 2);
  }
  stair(c, 0, Math.min(z + d + 1, hz - 5), gap * 2);
}

function sail(v: PixelVox, x: number, z: number, w: number, d: number, h: number, side: number) {
  // A suspended limestone shell rises above its outer spine. The open inner edge clears the chamber.
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1),
      length = Math.max(2, Math.round(d * (0.34 + 0.66 * t)));
    const top = 5 + Math.round(h * (0.18 + 0.82 * t * t));
    const start = z + Math.round(d * 0.38 * (1 - t));
    for (let j = 0; j < length; j++) {
      const roof = top + Math.round(2 * Math.sin((Math.PI * j) / length));
      const px = x + side * i,
        pz = start + j;
      v.box(px, roof, pz, px + 1, roof + 2, pz + 1, j % 7 === 0 ? stone : ivory);
      if ((i === w - 1 || i === 0) && j % 5 === 0) v.put(px, roof - 1, pz, gold);
    }
  }
  const outside = x + side * (w - 1);
  for (const dz of [1, Math.floor(d / 2), d - 2]) {
    const top = 5 + h + Math.round(2 * Math.sin((Math.PI * dz) / d));
    beam(v, [outside - side * 3, 1, z + dz], [outside, top, z + dz], bronze, 2);
    v.put(outside, top - 1, z + dz, lamp, 0.5);
  }
}
function sails(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = -hz + 4,
    w = byLv(c, [8, 12, 13, 16, 18]),
    d = byLv(c, [13, 19, 25, 32, 38]);
  const centre = Math.min(4, Math.floor(hx * 0.16)),
    h = byLv(c, [10, 13, 16, 20, 24]);
  seating(v, 0, 3, byLv(c, [7, 10, 12, 15, 18]), byLv(c, [5, 6, 8, 9, 11]), Math.min(4, lv + 1));
  sail(v, -centre, z, w, d, h, -1);
  if (lv >= 2) sail(v, centre + 1, z + 6, w - 3, Math.floor(d * 0.77), Math.round(h * 0.55), 1);
  if (lv >= 3) {
    const x = -hx + 4;
    v.hollowBox(x, 1, hz - 11, x + 8, 6, hz - 5, stone);
    v.box(x + 1, 2, hz - 6, x + 7, 5, hz - 5, glass, 0.25);
    v.box(x - 1, 6, hz - 12, x + 9, 7, hz - 4, ivory);
  }
  if (lv >= 4) {
    sail(v, 1, -hz + 2, 10, 13, 11, 1);
    colors(v, -centre - w + 2, z + 3, h + 5, 8);
    colors(v, centre + w - 3, z + 8, h + 1, 6);
  }
  if (lv === 5) {
    bridge(v, -centre - w + 1, centre + w - 3, z + 9, 8, 4);
    for (const side of [-1, 1]) planter(v, side * 13, 0, hz - 8, 2);
    v.box(-8, 0, hz - 10, 9, 1, hz, stone);
  }
  stair(c, 0, 9, 7 + lv);
}

function committeeWing(v: PixelVox, r: number, a: number, len: number, half: number, h: number) {
  const co = Math.cos(a),
    si = Math.sin(a),
    start = r;
  for (let along = 0; along < len; along++) {
    for (let across = -half; across <= half; across++) {
      const t = across / half,
        y = h + Math.round((1 - t * t) * half * 0.85);
      const x = Math.round((start + along) * co - across * si),
        z = Math.round((start + along) * si + across * co);
      v.box(x, y, z, x + 2, y + 1, z + 2, along % 5 === 0 ? bronze : ivory);
      if (Math.abs(across) === half && along % 4 === 0) {
        v.box(x, 1, z, x + 1, y, z + 1, stone);
        v.put(x, y - 2, z, lamp, 0.35);
      }
    }
  }
  const x = Math.round((start + len * 0.55) * co),
    z = Math.round((start + len * 0.55) * si);
  v.box(x - 1, 2, z - 1, x + 2, 3, z + 2, timber);
}
function committeeCrown(c: Ctx) {
  const { v, lv, hx, hz } = c,
    n = lv + 1,
    r = byLv(c, [4, 6, 8, 9, 11]),
    length = byLv(c, [6, 9, 10, 13, 15]);
  const half = byLv(c, [3, 3, 4, 4, 5]),
    h = byLv(c, [6, 8, 10, 12, 14]);
  seating(v, 0, 1, r + 1, Math.max(3, r - 2), lv < 4 ? 2 : 3, 0.16);
  for (let i = 0; i < n; i++) {
    const angle = (1.02 + (0.96 * i) / (n - 1)) * Math.PI;
    committeeWing(v, r, angle, length, half, h + (i % 2) * 2);
  }
  if (lv >= 2) {
    for (const side of [-1, 1]) {
      const x = side * (r + 2);
      v.box(x, 1, 2, x + 2, 7, 4, bronze);
      v.box(x - 1, 7, 1, x + 3, 8, 5, ivory);
    }
  }
  if (lv >= 3) {
    chamberArc(v, 0, 0, r + 2, r + 2, Math.PI * 1.05, Math.PI * 1.95, h - 2, 2, gold);
    colors(v, 0, -r - length + 2, h + 3, 4 + lv);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      const angle = side < 0 ? 0.84 * Math.PI : 0.19 * Math.PI;
      committeeWing(v, r + 2, angle, 8, 3, h - 4);
      planter(v, side * (r + 5), 0, 10, 1);
    }
  }
  if (lv === 5) {
    for (const side of [-1, 1]) {
      const x = side * (hx - 8);
      v.box(x - 3, 1, -5, x + 3, 9, -2, stone);
      colors(v, x, -4, 9, 7);
    }
    v.box(-6, 0, 6, 7, 1, hz - 2, stone);
    person(v, 4, 1, 10, "#b66750");
  }
  stair(c, 0, r + 4, 6 + lv);
}

export function nationalParliament(c: Ctx): void {
  [hemicycle, divisionBridges, sails, committeeCrown][c.variant % 4](c);
}
