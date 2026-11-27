/** Original tax counters, ministries and local hearing rooms. The street is +z. */
import { bench, bush, colonnade, flag, lamp, lot, person, type Ctx, type PixelVox } from "./kit";
import { disc, glassFront } from "./commerceKit";
import { beam, entrance, facade, finish as f, oval, plate, slab, storey, TAU } from "./sculpturalKit";

const paper = "#f8edd1",
  ochre = "#c48c45",
  ink = "#455963",
  timber = "#9c684d";
const teal = "#548378",
  plaster = "#e6cda4",
  glow = "#f0ca85";

function clerk(v: PixelVox, x: number, z: number, length: number, y = 1): void {
  v.box(x, y, z, x + length, y + 2, z + 2, timber);
  v.box(x, y + 2, z, x + length, y + 3, z + 2, plaster);
  v.box(x + 1, y + 3, z, x + 3, y + 4, z + 1, paper);
  v.put(x + length - 1, y + 3, z, ink);
  v.put(x + length - 1, y + 4, z, glow, 0.6);
  person(v, x + 1, y, z - 1, teal, ink);
}

function receiptOffice(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  const back = -hz + 2,
    z0 = back + 4,
    x = lv >= 4 ? -5 : 0;
  const r = [3, 4, 4, 5, 6][lv - 1],
    w = lv < 4 ? 5 : 7,
    cy = r + 2;
  // Looking through either end of the paper roll reveals the spiral and the roller.
  for (let xx = x - w; xx <= x + w; xx++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dy, dz);
        if (d > r || d < 1.1) continue;
        const edge = Math.abs(xx - x) === w;
        if (!edge && d < r - 1) continue;
        const spiral = Math.abs((d - (Math.atan2(dy, dz) / TAU) * 2) % 2) < 0.5;
        v.put(xx, cy + dy, z0 + dz, edge && spiral ? "#b79a71" : paper);
      }
  }
  v.box(x - w - 1, cy, z0, x + w + 2, cy + 1, z0 + 1, ochre);
  const start = z0,
    end = hz - 4;
  for (let z = start; z <= end; z++) {
    const t = (z - start) / Math.max(1, end - start);
    const y = Math.round(5 + (cy + r - 5) * (1 - t) + (lv >= 3 ? Math.sin(t * Math.PI * 2) * 1.8 : 0));
    for (let xx = x - w; xx <= x + w; xx++) {
      const margin = Math.abs(xx - x) === w;
      if ((margin && z % 3 === 0) || (z === end && (xx + w) % 2 === 0)) continue;
      const ruled = z > start + 1 && z % 4 === 0 && Math.abs(xx - x) < w - 1;
      v.put(xx, y, z, ruled ? "#78908d" : margin ? "#c17d73" : paper);
    }
  }
  for (const xx of [x - w + 1, x + w - 1]) v.box(xx, 1, end - 1, xx + 1, 5, end, timber);
  clerk(v, x - 2, end - 1, 5);
  if (lv >= 2) {
    v.box(x + w - 2, 1, -1, x + w + 1, 4, 2, ink);
    v.box(x + w - 2, 4, -1, x + w + 1, 5, 2, "#ede1bf");
    v.put(x + w - 1, 4, 2, glow, 0.8);
  }
  if (lv >= 4) {
    const annex = plate(8, 0, 5, hz * 0.64, 0.25);
    storey(v, annex, annex, 1, 7, "#7ca198", "#b07b62");
    clerk(v, 5, Math.round(hz * 0.57), 6);
    if (lv === 5) {
      const rr = 4;
      v.ringZ(8, 12, -5, 3, rr, 1, paper);
      v.ringZ(8, 12, 3, 4, rr, rr - 1, "#bba477");
      for (let z = 4; z < 11; z++)
        v.box(5, 11 - Math.floor((z - 4) / 2), z, 12, 12 - Math.floor((z - 4) / 2), z + 1, z % 3 ? paper : "#a4afa0");
    }
  }
}

function countingFrame(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  function abacus(cx: number, z: number, width: number, rods: number, base: number, dark: string): void {
    const top = base + rods * 3 + 2;
    for (const x of [cx - width, cx + width - 1]) {
      v.box(x, 1, z - 1, x + 2, top, z + 2, dark);
      v.box(x - 1, 1, z - 2, x + 3, 2, z + 3, ochre);
    }
    v.box(cx - width, top - 1, z - 1, cx + width + 1, top + 1, z + 2, dark);
    for (let i = 0; i < rods; i++) {
      const y = base + i * 3;
      v.box(cx - width + 1, y, z, cx + width, y + 1, z + 1, "#c6ac74");
      for (let n = 0; n < Math.max(2, Math.floor(width / 2)); n++) {
        const x = n <= i % 3 ? cx - width + 2 + n * 2 : cx + width - 2 - n * 2;
        v.sphere(x + 0.5, y + 0.5, z + 0.5, 1.3, 1.5, 1.5, i % 2 ? "#68a297" : "#c88258");
      }
    }
  }
  const z = lv < 3 ? -1 : Math.round(-hz * 0.3);
  abacus(0, z, hx - 3, [2, 3, 3, 4, 5][lv - 1], 3, "#71533e");
  if (lv >= 2) {
    v.box(-hx + 1, 1, z + 3, hx - 1, 2, z + 6, "#ba9f73");
    glassFront(v, -hx + 2, hx - 2, 2, 5, z + 3, timber, 4, "#d2c49b");
  }
  if (lv >= 3) {
    const stand = plate(0, -hz + 4, hx - 2, 3, 0.25);
    storey(v, stand, stand, 1, lv + 3, "#788d83", plaster);
  }
  if (lv >= 4) abacus(-Math.floor(hx * 0.48), hz - 5, Math.floor(hx * 0.36), lv - 2, 2, "#a8714e");
  if (lv === 5) abacus(Math.floor(hx * 0.49), Math.floor(hz * 0.35), Math.floor(hx * 0.32), 3, 4, teal);
  clerk(v, -2, lv < 3 ? 4 : 2, 5);
}

function stampOffice(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const cx = lv >= 4 ? -4 : 0,
    cz = lv < 3 ? -1 : -Math.round(hz * 0.31);
  const r = [4, 4, 5, 7, 8][lv - 1],
    press = [5, 7, 9, 11, 14][lv - 1];
  const die = plate(cx, cz, r + 1, r, 0.36);
  storey(v, die, die, 1, 5, "#71867b", "#a37056");
  // A red rubber die, brass ferrule and turned wood handle make a civic seal.
  slab(v, die, press, 2, "#934d50");
  slab(v, die, press + 2, 2, plaster);
  v.cone(cx, press + 4, press + 8, cz, r * 0.63, 1.5, ochre);
  v.sphere(cx, press + 9, cz, r * 0.75, r * 0.66, r * 0.66, "#845744");
  if (lv >= 2) {
    const pinX = Math.max(-hx + 2, cx - r - 2);
    v.box(pinX, 1, cz - 1, pinX + 2, press + 8, cz + 1, "#946c53");
    beam(v, [pinX, press + 7, cz], [cx + 1, press + 10, cz], "#bc9c66", 2);
  }
  if (lv >= 2)
    for (const side of [-1, 1]) {
      const x = cx + side * (r - 1);
      v.box(x, 4, cz - 1, x + 1, press, cz + 1, "#ad9e83");
    }
  if (lv >= 3) {
    const z = Math.round(hz * 0.45);
    v.box(-hx + 2, 1, z, hx - 2, 2, z + 5, paper);
    disc(v, cx, z + 2, 2, 3, 2.3, "#ae6667", 1);
    if (lv >= 4) {
      const inkpad = plate(8, cz + 3, 5, 5, 0.38);
      storey(v, inkpad, inkpad, 1, 5, "#957285", "#694d68");
      if (lv === 5)
        for (let i = 0; i < 6; i++) {
          v.box(4, 5 + 2 * i, cz + 3 - i, 13, 7 + 2 * i, cz + 4 - i, i % 2 ? "#916b79" : "#c49ca0");
        }
    }
  }
  clerk(v, cx - 2, cz + r, 5);
}

function addingOffice(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const z0 = -hz + 2,
    front = hz - 4,
    w = Math.min(hx - 2, 6 + lv),
    total = 5 + 2 * lv;
  // The adding machine has a narrow, inclined keyboard and a separate upright tally drum.
  for (let z = z0 + 2; z <= front; z++) {
    const t = (z - z0 - 2) / Math.max(1, front - z0 - 2);
    const y = Math.round(4 + (1 - t) * 4),
      half = Math.round(w * (1 - 0.26 * t));
    v.box(-half, 1, z, half, y, z + 1, "#396667");
    v.box(-half, y, z, half, y + 1, z + 1, "#698b82");
    if ((z - z0) % 3 === 0)
      for (let x = -half + 2; x < half - 1; x += 3) {
        v.put(x, y + 1, z, x === -half + 2 ? "#b76c58" : paper, 0.24);
      }
  }
  v.hollowBox(-w, 3, z0, w, total + 3, z0 + 4, ink);
  for (let x = -w + 2; x < w - 1; x += 3) {
    v.box(x, total - 1, z0 + 3, x + 2, total + 2, z0 + 4, "#e4d39f", 0.45);
    v.put(x, total, z0 + 4, "#657d72");
  }
  if (lv >= 2) {
    const lift = lv < 3 ? 8 : 5;
    beam(v, [w - 1, 5, -1], [w, 9 + lv + lift, 1], "#b09368");
    v.sphere(w, 10 + lv + lift, 1, 1.8, 1.8, 1.8, "#b77654");
  }
  if (lv >= 3) {
    v.ringZ(-w + 1, total + 2, z0 - 1, z0 + 1, 3, 1, plaster);
    if (lv >= 4) {
      const annex = plate(-hx + 4, 0, 3, hz * 0.6, 0.34);
      storey(v, annex, annex, 1, 6, teal, plaster);
      if (lv === 5) {
        const cabinet = plate(hx - 5, -1, 3, hz * 0.57, 0.3);
        storey(v, cabinet, cabinet, 1, 8, "#7a8e98", paper);
      }
    }
  }
  clerk(v, -2, front, 5);
}

export const TAX_OFFICE = {
  levels: ["Tax Counter", "Filing Office", "District Assessment Room", "Revenue Hall", "Metropolitan Tax Bureau"] as [
    string,
    string,
    string,
    string,
    string,
  ],
  growth:
    "A public filing counter grows into a staffed revenue hall with separate records, assessment desks and room for residents.",
};

export function buildTaxOffice(c: Ctx): void {
  lot(c, "#c4b89b");
  [receiptOffice, countingFrame, stampOffice, addingOffice][c.variant](c);
  person(c.v, 2, 1, c.hz - 2, "#747899");
  if (c.lv >= 3) bench(c.v, -c.hx + 4, 1, c.hz - 2);
}

function ministryDome(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const z = -Math.round(hz * 0.24),
    r = Math.min(hx * 0.54, 6 + lv * 2);
  const base = 5 + lv * 2,
    chamber = oval(0, z, r, r * 0.88, 16);
  facade(v, chamber, 1, base, "#5a8a85", "#b69d78", 4);
  slab(v, chamber, base, 2, plaster);
  // A slice out of the copper dome exposes the circular clerk's gallery.
  for (let y = 0; y < r; y++) {
    const ring = Math.max(1, r * Math.sqrt(1 - (y / r) ** 2));
    disc(v, 0, z, base + 2 + y, base + 3 + y, ring, (x, _y, zz, d, a) => {
      if (zz > z && Math.abs(x) < ring * 0.34 && y < r * 0.65) return null;
      if (d < ring - 1.6) return null;
      return Math.abs(Math.sin(a * 6)) < 0.25 ? "#c5a369" : "#599083";
    });
  }
  const crown = Math.floor(base + r + 2);
  disc(v, 0, z, crown, crown + 3, lv >= 3 ? 2.3 : 1.4, paper);
  if (lv >= 2) {
    const wing = plate(-hx * 0.56, z + 1, hx * 0.32, hz * 0.32, 0.32);
    storey(v, wing, wing, 1, 6, "#ad8d71", plaster);
    for (let x = Math.ceil(-hx * 0.8); x < -hx * 0.35; x += 3)
      v.box(x, 1, z + hz * 0.25, x + 1, 6, z + hz * 0.25 + 1, paper);
  }
  if (lv >= 3) {
    const wing = plate(hx * 0.61, z - 2, hx * 0.29, hz * 0.29, 0.18);
    storey(v, wing, wing, 1, 8, "#82a192", "#c5ae88");
    if (lv === 5) storey(v, wing, wing, 8, 5, "#9baf99", paper);
  }
  for (let i = 0; i < 3 + lv; i++) {
    const width = lv + 5 - Math.floor(i / 2);
    v.box(-width, 1, z + r - 2 + i, width + 1, 2 + lv - Math.floor((i * lv) / (3 + lv)), z + r - 1 + i, plaster);
  }
  const doorZ = z + Math.round(r * 0.86);
  glassFront(v, -3, 3, 1, Math.min(base, 6), doorZ, "#886a4e", 4, "#ecbc83");
  if (lv >= 4) {
    flag(v, 0, crown + 2, z, lv + 2, ["#587e85", paper]);
    for (const side of [-1, 1]) {
      bench(v, side * Math.floor(hx * 0.54), 1, Math.round(hz * 0.55));
      lamp(v, side * (lv + 5), 1, Math.floor(hz * 0.46));
    }
  }
}

function cloisterMinistry(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const back = -hz + 3,
    front = hz - 4;
  const depth = Math.max(4, Math.round(hx * 0.23));
  const office = (x0: number, z0: number, x1: number, z1: number, floors: number) => {
    const plan = plate((x1 + x0) / 2, (z1 + z0) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0.14);
    for (let i = 0; i < floors; i++) storey(v, plan, plan, 1 + i * 5, 5, "#72938e", plaster);
    const y = 1 + floors * 5;
    slab(v, plan, y, 1, "#a56e53");
    for (let x = Math.ceil(x0) + 1; x < x1; x += 4) v.put(x, y + 1, z0 + 1, "#bb8866");
  };
  office(-hx + 2, back, hx - 3, back + depth, lv >= 3 ? 2 : 1);
  office(-hx + 2, back + depth, -hx + 2 + depth, lv === 1 ? 2 : front, 1);
  if (lv >= 2) office(hx - 3 - depth, back + depth, hx - 3, front - 3, lv >= 4 ? 2 : 1);
  const well = lv < 3 ? 2.5 : 4;
  disc(v, 0, 1, 1, 2, well + 1, "#ad9a76");
  disc(v, 0, 1, 2, 3, well, "#83a9a0");
  bush(v, 0, 3, 1, 1.4, "#82965e");
  if (lv >= 3) {
    const tx = -hx + 3 + depth,
      tz = back + Math.round(depth / 2);
    const plan = plate(tx, tz, depth * 0.56, depth * 0.58, 0.3);
    const top = [0, 0, 14, 18, 22][lv - 1];
    storey(v, plan, plan, 1, top, "#bb966e", paper);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        v.box(tx + sx * 2, top, tz + sz * 2, tx + sx * 2 + 1, top + 4, tz + sz * 2 + 1, timber);
      }
    slab(v, plan, top + 4, 1, "#708b7d");
    if (lv >= 4) {
      colonnade(v, back + depth, front, -hx + 3 + depth, 1, 6, "z", 4, paper);
      if (lv === 5) {
        v.box(-hx + 4 + depth, 6, front - 3, hx - 3 - depth, 7, front, "#b88b63");
        glassFront(v, -hx + 4 + depth, hx - 3 - depth, 7, 10, front - 1, timber, 4, "#d4b889");
      }
    }
  }
  entrance(c, 3, 2, 2);
  clerk(v, -4, back + depth + 1, 6);
  for (const x of [-Math.round(hx * 0.47), Math.round(hx * 0.47)]) bush(v, x, 1, front - 1, 2, "#739261");
}

function ministryGate(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const offset = Math.floor(hx * 0.45),
    cz = -Math.floor(hz * 0.14);
  const floors = lv + 1,
    w = hx * 0.22,
    depth = hz * 0.44;
  for (const side of [-1, 1]) {
    const n = floors + (lv >= 3 && side < 0 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const taper = 1 - i * 0.06;
      const p = plate(side * offset, cz + side * 2, w * taper, depth * taper, 0.38);
      storey(v, p, p, 1 + 4 * i, 4, side < 0 ? "#667f8a" : "#608c89", i % 2 ? plaster : "#bd9065");
    }
  }
  const skybridge = (y: number, z: number, d: number) => {
    v.box(-offset, y, z, offset + 1, y + 1, z + d, "#987352");
    for (const zz of [z, z + d - 1]) glassFront(v, -offset + 2, offset - 1, y + 1, y + 4, zz, ink, 4, "#c0cbb3");
    v.box(-offset, y + 4, z, offset + 1, y + 5, z + d, plaster);
  };
  skybridge(4 + lv, cz - 1, lv + 2);
  if (lv >= 2) {
    const lobby = plate(-offset, cz + depth, w * 0.9, 3, 0.3);
    storey(v, lobby, lobby, 1, 5, "#8eab9d", paper);
    entrance(c, -offset, cz + depth + 1, 2);
  }
  if (lv >= 3) skybridge(floors * 4 - 1, cz - 4, 4);
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      const pavilion = oval(side * hx * 0.63, hz * 0.55, w, 3.5, 8);
      storey(v, pavilion, pavilion, 1, 5, "#ab9478", plaster);
    }
  }
  if (lv === 5) {
    // Delegates can cross a third, high glazed passage between the two departments.
    skybridge(floors * 4 + 2, cz + 2, 3);
    const cap = plate(-offset, cz - 2, w * 0.7, depth * 0.66, 0.36);
    slab(v, cap, 1 + (floors + 1) * 4, 2, "#93744f");
    flag(v, -offset, 3 + (floors + 1) * 4, cz, 6, ["#ba805e", paper]);
  }
  person(v, 0, 1, cz + depth + 2, "#a37666");
}

function fanMinistry(c: Ctx): void {
  const { v, lv, hx, hz } = c,
    wings = lv + 2;
  const hingeZ = hz * 0.18,
    length = hz * (lv === 1 ? 0.94 : 1.1);
  for (let i = 0; i < wings; i++) {
    const angle = -1.12 + (2.24 * i) / (wings - 1),
      dx = Math.sin(angle),
      dz = -Math.cos(angle);
    const reach = length * (0.8 + 0.2 * Math.cos(angle));
    const wingWidth = hx * (lv === 1 ? 0.18 : 0.15);
    const y = 5 + lv + Math.round((1 - Math.abs(angle) / 1.2) * lv * 1.5);
    const cx = dx * reach * 0.65,
      cz = hingeZ + dz * reach * 0.65;
    // Each wedge is a staffed department. Open slots lead between fanning roofs.
    const point = (along: number, across: number): [number, number] => [
      cx + dx * along - dz * across,
      cz + dz * along + dx * across,
    ];
    const plan = [
      point(-reach * 0.47, -wingWidth * 0.45),
      point(reach * 0.45, -wingWidth),
      point(reach * 0.53, 0),
      point(reach * 0.45, wingWidth),
      point(-reach * 0.47, wingWidth * 0.45),
    ];
    facade(v, plan, 1, y, "#72928f", "#9b7358", 4);
    slab(v, plan, y + 1, 1, i % 2 ? "#b28265" : "#c79a71");
    const [x0, z0] = point(-reach * 0.45, 0),
      [x1, z1] = point(reach * 0.48, 0);
    beam(v, [x0, y + 2, z0], [x1, y + 2 + lv, z1], paper, 2);
  }
  const rotunda = oval(0, hingeZ, 4 + lv, 4 + lv * 0.4, 12);
  storey(v, rotunda, rotunda, 1, 5, "#7b9f98", paper);
  glassFront(v, -2, 3, 1, 5, Math.round(hingeZ + 4 + lv * 0.4), timber, 4, glow);
  if (lv >= 2) for (const side of [-1, 1]) bench(v, side * (4 + lv), 1, Math.round(hz * 0.55));
  if (lv >= 3) {
    const z = Math.round(hz * 0.58);
    for (const x of [-lv - 1, lv + 1]) v.box(x, 1, z, x + 1, 7, z + 1, timber);
    v.box(-lv - 2, 7, z - 1, lv + 3, 8, z + 2, plaster);
    if (lv >= 4) for (const x of [-1, 1]) lamp(v, x * (lv + 4), 1, z + 2);
    if (lv === 5) flag(v, 0, 7, z, 6, ["#638b87", paper]);
  }
}

export const MINISTRY = {
  levels: ["Ministry Office", "Department Hall", "Metropolitan Ministry", "Government Precinct", "Grand Ministry"] as [
    string,
    string,
    string,
    string,
    string,
  ],
  growth:
    "A ministry opens its first public office, adds departments and galleries, then brings the capital’s public business together around its main entrance.",
};
export function buildMinistry(c: Ctx): void {
  lot(c, "#d5c7a6");
  [ministryDome, cloisterMinistry, ministryGate, fanMinistry][c.variant](c);
  entrance(c, 0, Math.floor(c.hz * 0.35), 2, plaster);
  if (c.lv >= 3) {
    for (const side of [-1, 1]) {
      const x = Math.round(c.hx * side * 0.76),
        z = Math.round(c.hz * 0.68);
      c.v.box(x - 2, 1, z - 1, x + 3, 2, z + 2, "#9c8a67");
      bush(c.v, x, 2, z, 1.8, "#79905f");
      if (c.lv >= 4) lamp(c.v, x + side * 2, 1, z + 2, 5, timber, glow);
    }
  }
  person(c.v, 3, 1, c.hz - 3, "#6e8099", ink);
}

/** Open, concentric rows make the speakers visible even in a frozen overhead view. */
function hearingSeats(
  c: Ctx,
  x: number,
  z: number,
  rx: number,
  rz: number,
  rows: number,
  start: number,
  sweep: number,
): void {
  const { v } = c;
  slab(v, oval(x, z, rx + 0.8, rz + 0.8, 20), 1, 1, "#d2b78d");
  for (let row = 0; row < rows; row++) {
    const radius = 0.42 + (0.53 * (row + 1)) / rows,
      y = 2 + row;
    const segments = Math.max(8, Math.ceil(Math.max(rx, rz) * sweep * 1.5));
    for (let k = 0; k <= segments; k++) {
      if (rows > 2 && k > 0 && k < segments && k % Math.ceil(segments / 3) === 0) continue;
      const a = start + (sweep * k) / segments;
      const xx = Math.round(x + Math.cos(a) * rx * radius),
        zz = Math.round(z + Math.sin(a) * rz * radius);
      v.put(xx, y, zz, row % 2 ? "#ab7755" : "#bc8a60");
      if (row > 0) v.put(xx, y - 1, zz, "#9d8065");
    }
  }
  if (c.lv >= 2) {
    // People occupy the timber row rather than standing in the hearing well.
    const count = Math.max(1, Math.floor((rx + rz) / 7));
    for (let i = 0; i < count; i++) {
      const a = start + (sweep * (i + 0.5)) / count;
      person(
        v,
        Math.round(x + Math.cos(a) * rx * 0.95),
        rows + 2,
        Math.round(z + Math.sin(a) * rz * 0.95),
        ["#68888a", "#af7c65", "#b79866"][i % 3],
        ink,
      );
    }
  }
  v.box(x - 1, 2, z - 1, x + 2, 3, z + 1, "#aa7252");
  v.put(x, 3, z, f.amber, 0.55);
  person(v, Math.round(x), 2, Math.round(z) - 1, "#527e87", ink);
}

function openCircle(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  const rx = hx * 0.78,
    rz = hz * 0.72,
    z = lv < 3 ? 0 : 1;
  hearingSeats(c, 0, z, rx, rz, lv + 1, Math.PI * 0.73, Math.PI * 1.54);
  if (lv >= 2) {
    const p = plate(-hx * 0.47, -hz * 0.53, hx * 0.26, hz * 0.21, 0.38);
    storey(v, p, p, 1, 5, "#88a8a1", plaster);
  }
  if (lv >= 3) {
    const back = -Math.round(rz * 0.78),
      h = 8 + lv;
    for (const side of [-1, 1])
      v.box(side * Math.round(rx * 0.56), 1, back, side * Math.round(rx * 0.56) + 1, h, back + 2, timber);
    for (let x = -Math.floor(rx * 0.65); x <= rx * 0.65; x++) {
      const offset = Math.round(2 * (x / rx) ** 2);
      v.box(x, h + offset, back - 2, x + 1, h + offset + 1, back + 3, "#648d80");
    }
  }
  if (lv >= 4) {
    const rear = oval(hx * 0.48, -hz * 0.47, hx * 0.28, hz * 0.25, 12);
    storey(v, rear, rear, 1, 9, "#809e94", plaster);
    const elevated = Math.round(rx * 0.68);
    for (const x of [-elevated, elevated]) v.box(x, 1, 4, x + 2, 9, 6, timber);
    beam(v, [-elevated, 8, 4], [elevated, 8, 4], plaster, 2);
    beam(v, [-elevated, 11, 4], [elevated, 11, 4], "#b88e65");
    if (lv === 5) {
      const r = Math.round(hx * 0.32),
        top = 13;
      for (let i = 0; i < 28; i++) {
        const a = 0.8 * Math.PI + (1.3 * Math.PI * i) / 28,
          b = 0.8 * Math.PI + (1.3 * Math.PI * (i + 1)) / 28;
        beam(
          v,
          [r * Math.cos(a), top, -hz * 0.48 + r * 0.5 * Math.sin(a)],
          [r * Math.cos(b), top, -hz * 0.48 + r * 0.5 * Math.sin(b)],
          plaster,
          2,
        );
      }
      for (const x of [-r, r]) v.box(x, 1, -hz * 0.48, x + 1, top + 1, -hz * 0.48 + 1, timber);
    }
  }
}

function oppositionBenches(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const length = Math.floor(hz * 0.68),
    rows = Math.min(lv + 1, Math.floor(hx / 3));
  for (const side of [-1, 1]) {
    for (let i = 0; i < rows; i++) {
      const x = side * (2 + Math.round((i * (hx - 5)) / Math.max(1, rows - 1)));
      const half = length - (i === 0 ? 1 : 0),
        y = 2 + i;
      v.box(x, 1, -half, x + 1, y, half + 1, "#ad9c79");
      v.box(x, y, -half, x + 1, y + 1, half + 1, side < 0 ? "#9c684d" : "#718c74");
      for (let z = -half + 2; z < half; z += 5) v.put(x, y + 1, z, timber);
      if (i === 0 || (lv >= 4 && i === rows - 1)) person(v, x, y + 1, side * 2, side < 0 ? "#a67765" : "#638c86", ink);
    }
    if (lv >= 2) {
      const x = side * (hx - 3);
      for (const z of [-length + 1, length - 1]) v.box(x, 1, z, x + 1, 8, z + 1, timber);
      v.box(x - 1, 8, -length, x + 2, 9, length + 1, plaster);
    }
  }
  clerk(v, -2, -length, 5);
  if (lv >= 3) {
    const plan = plate(0, -hz * 0.76, hx * 0.42, 2.5, 0.2);
    storey(v, plan, plan, 1, 5, "#7d9691", paper);
  }
  if (lv >= 4) {
    const y = 10,
      z = length - 1;
    v.box(-hx + 3, y, z - 1, hx - 2, y + 1, z + 2, "#ac7d56");
    for (const x of [-hx + 4, hx - 5]) v.box(x, 1, z, x + 2, y + 1, z + 2, timber);
    v.box(-hx + 3, y + 2, z + 1, hx - 2, y + 3, z + 2, paper);
    if (lv === 5) {
      const p = plate(-hx * 0.63, 0, 3.6, hz * 0.37, 0.3);
      storey(v, p, p, 10, 5, "#8aa9a1", plaster);
      flag(v, -hx * 0.62, 15, 0, 5, ["#637e91", paper]);
    }
  }
}

function fanChamber(c: Ctx): void {
  const { v, hx, hz, lv } = c,
    z = Math.round(hz * 0.26);
  hearingSeats(c, 0, z, hx * 0.85, hz * 0.94, lv + 2, Math.PI * 1.03, Math.PI * 0.94);
  const back = -Math.round(hz * 0.63);
  const blades = lv + 2;
  for (let i = 0; i < blades; i++) {
    const a = -1.1 + (2.2 * i) / (blades - 1);
    const tipX = Math.round(Math.sin(a) * hx * 0.8),
      tipZ = Math.round(z - Math.cos(a) * hz * 0.78);
    const h = 5 + lv + Math.round(Math.abs(a) * 4);
    beam(v, [tipX, 1, tipZ], [tipX, h, tipZ], timber);
    beam(v, [0, 5, z - 2], [tipX, h, tipZ], i % 2 ? plaster : "#bd7252", lv >= 3 ? 2 : 1);
    if (lv >= 2) {
      const ex = Math.round(tipX * 0.72),
        ez = Math.round(tipZ * 0.72 + z * 0.28);
      beam(v, [tipX, h, tipZ], [ex, h + 2, ez], "#c77e5d", 2);
      // Short canvas sails span adjacent radial rafters above the last seating row.
      if (i < blades - 1) {
        const next = a + 2.2 / (blades - 1);
        const nx = Math.round(Math.sin(next) * hx * 0.8),
          nz = Math.round(z - Math.cos(next) * hz * 0.78);
        const nextH = 5 + lv + Math.round(Math.abs(next) * 4);
        for (let j = 0; j <= 6; j++) {
          const t = j / 6,
            xx = tipX * (1 - t) + nx * t,
            zz = tipZ * (1 - t) + nz * t,
            yy = h * (1 - t) + nextH * t;
          beam(v, [xx, yy, zz], [xx * 0.76, yy + 2, zz * 0.76 + z * 0.24], i % 2 ? "#ddb680" : "#b78366", 2);
        }
      }
    }
  }
  if (lv >= 3) {
    clerk(v, -hx + 3, back, 5);
    const cx = Math.round(hx * .64), cz = Math.round(hz * .39);
    const press = oval(cx, cz, 3, 3, 8);
    slab(v, press, 1, 3, "#a47f5e");
    person(v, cx, 4, cz, "#6d7795", ink);
    v.box(cx - 2, 4, cz - 1, cx - 1, 10, cz, timber);
    v.box(cx - 3, 10, cz - 2, cx + 2, 11, cz + 2, plaster);
  }
  if (lv >= 4) {
    const gallery = plate(0, back - 2, hx * 0.48, 2.8, 0.32);
    storey(v, gallery, gallery, lv + 1, 4, "#91a89b", plaster);
    for (const x of [-0.38, 0.38]) v.box(hx * x, 1, back - 2, hx * x + 1, lv + 1, back - 1, timber);
    if (lv === 5) flag(v, 0, lv + 5, back - 2, 5, [teal, paper]);
  }
}

function twinCouncils(c: Ctx): void {
  const { v, hx, hz, lv } = c;
  const x1 = -Math.round(hx * 0.43),
    x2 = Math.round(hx * 0.45);
  const z1 = -Math.round(hz * 0.38),
    z2 = Math.round(hz * 0.36);
  hearingSeats(c, x1, z1, hx * 0.44, hz * 0.42, lv + 1, Math.PI * 0.53, Math.PI * 1.56);
  // A square petition booth grows into a second chamber with its own speaker and canopy.
  if (lv === 1) {
    const booth = plate(x2, z2, 2.5, 2.5, 0.3);
    storey(v, booth, booth, 1, 5, "#78968d", plaster);
    v.cone(x2, 6, 10, z2, 3, 1, "#779182");
    return;
  }
  hearingSeats(c, x2, z2, hx * 0.38, hz * 0.39, lv, Math.PI * 0.85, Math.PI * 1.55);
  const plan = oval(x2, z2, hx * 0.23, hz * 0.24, 8);
  const h = 4 + lv;
  for (const [x, z] of plan.filter((_, i) => i % 2 === 0)) v.box(x, 2, z, x + 1, h, z + 1, timber);
  slab(v, plan, h, 1, "#6e9183");
  if (lv >= 3) {
    const top = h + 1;
    beam(v, [x1 + 2, top, z1 + 1], [x2 - 2, top, z2 - 1], plaster, 2);
    beam(v, [x1 + 2, top + 2, z1 + 2], [x2 - 2, top + 2, z2], timber, 1);
    for (const [x, z] of [
      [x1 + 2, z1 + 1],
      [x2 - 2, z2 - 1],
    ])
      v.box(x, 1, z, x + 1, top, z + 1, "#947156");
  }
  if (lv >= 4) {
    const p = plate(x1, -hz * 0.76, hx * 0.31, 2.8, 0.28);
    storey(v, p, p, 1, 8, "#859e98", plaster);
    if (lv === 5) {
      const crown = oval(x1, -hz * 0.49, hx * 0.23, hz * 0.19, 10);
      facade(v, crown, 9, 4, "#bc9f7b", timber);
      slab(v, crown, 13, 1, paper);
      flag(v, x1, 14, -hz * 0.49, 4, [teal, paper]);
    }
  }
}
export function boroughAssembly(c: Ctx): void {
  [openCircle, oppositionBenches, fanChamber, twinCouncils][c.variant](c);
  entrance(c, 0, Math.round(c.hz * 0.4), 2);
  person(c.v, 2, 1, c.hz - 2, "#92728a");
  if (c.lv >= 3) lamp(c.v, -3, 1, c.hz - 3, 4, timber, glow);
}
