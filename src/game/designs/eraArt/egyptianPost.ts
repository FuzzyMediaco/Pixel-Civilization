import { type Ctx, type PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import {
  approach,
  attendant,
  banner,
  brick,
  bundle,
  cedar,
  desk,
  faience,
  gold,
  ivory,
  lapis,
  limestone,
  linen,
  mud,
  oil,
  papyrus,
  red,
  reed,
  strut,
  water,
} from "./egyptianCraft";

function packet(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 2, y + 2, z + 2, reed);
  v.put(x, y + 2, z, red);
}
function skiff(v: PixelVox, x: number, z: number, half: number, active: boolean) {
  for (let i = -half; i <= half; i++) {
    const r = Math.abs(i) >= half - 1 ? 0 : 1,
      y = Math.abs(i) === half ? 2 : 1;
    v.box(x + i, y, z - r, x + i + 1, y + 1, z + r + 1, cedar);
    if (r) for (const side of [-1, 1]) v.put(x + i, y + 1, z + side, reed);
  }
  v.put(x + half - 1, 3, z, "#f1be78", 0.62);
  if (active && half > 3) attendant(v, x - 1, 2, z, active);
  v.put(x + 1, 3, z, red);
}
function counter(c: Ctx, x: number, z: number, active: boolean) {
  desk(c.v, x, 1, z, active);
  attendant(c.v, x - 1, 1, z - 2, active, lapis);
  oil(c.v, x + 2, 1, z, active);
}
// Height tapers at the ends of the courier's shade like a sheet just coming off its roll.
function paperHall(v: PixelVox, x0: number, z: number, x1: number, depth: number, y: number) {
  for (let x = x0; x < x1; x++) {
    const k = Math.min(x - x0, x1 - 1 - x),
      h = y + Math.max(0, 2 - k);
    v.box(x, h, z, x + 1, h + 1, z + depth, k === 0 ? reed : ivory);
    if (k === 1 || (x - x0) % 8 === 3) bundle(v, x, 1, z + 1, y);
  }
}
function boatQuay(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = -hx + 2,
    X = hx - 2,
    z = -hz + 2;
  paperHall(v, x, z, X - (lv >= 3 ? 6 : 0), 5, 4 + Math.floor(lv / 2));
  counter(c, x + 3, z + 5, active);
  const canal = lv === 1 ? 4 : hz - 4;
  v.box(x, 0, canal - 1, X, 1, canal + 2, water);
  skiff(v, lv === 1 ? 0 : hx - 8, canal, lv === 1 ? 4 : 6, active);
  if (lv >= 2) {
    v.box(x, 1, canal - 3, 2, 2, canal - 1, cedar);
    packet(v, x + 3, 2, canal - 3);
  }
  if (lv >= 3) {
    linen(v, -1, -3, X, 2, 6, red);
    for (let i = 0; i < 3; i++) packet(v, i * 3, 1, 0);
  }
  if (lv >= 4) {
    v.box(x + 1, 0, 0, x + 5, 1, hz - 2, water);
    skiff(v, x + 9, canal, 5, active);
    banner(v, x + 2, 1, 2, 10);
  }
  if (lv >= 5) {
    const towerX = X - 4;
    v.hollowBox(towerX - 2, 1, z, towerX + 3, 11, z + 6, mud);
    v.clear(towerX - 1, 7, z + 5, towerX + 2, 10, z + 6);
    linen(v, towerX - 3, z - 1, towerX + 4, z + 7, 12, lapis);
  }
}
function pigeon(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 2, y + 1, z + 1, ivory);
  v.put(x + 1, y + 1, z, ivory);
  v.put(x + 2, y + 1, z, gold);
}
function loft(v: PixelVox, x: number, z: number, r: number, h: number) {
  for (let y = 1; y <= h; y++) {
    const rr = r - (y === h ? 1 : 0);
    v.cylinderY(x, z, y, y + 1, rr, y === h ? ivory : brick);
    if (y % 3 === 0)
      for (const [dx, dz] of [
        [0, rr - 1],
        [rr - 1, 0],
        [-rr, 0],
      ]) {
        v.put(x + dx, y, z + dz, lapis);
        v.put(x + dx, y - 1, z + dz + (dz ? 1 : 0), cedar);
      }
  }
  v.put(x, h - 2, z + r - 1, "#e6b371", 0.56);
  pigeon(v, x - 1, h + 1, z);
}
function pigeonYard(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    ox = -hx + 5,
    oz = -hz + 5;
  loft(v, ox, oz, lv < 3 ? 3 : 4, lv < 3 ? 8 : 12);
  linen(v, lv === 1 ? 0 : ox + 4, oz - 2, hx - 1, oz + 3, 5, red);
  counter(c, lv === 1 ? 2 : 0, oz + 5, active);
  if (lv >= 2) {
    loft(v, hx - 5, oz, 2, 6);
    packet(v, hx - 5, 1, hz - 4);
  }
  if (lv >= 3) {
    paperHall(v, ox + 3, 1, hx - 2, 5, 6);
    for (let n = 0; n < 3; n++) packet(v, -4 + n * 4, 1, 6);
  }
  if (lv >= 4) {
    loft(v, ox, 4, 3, 9);
    v.box(ox - 1, 7, oz, ox + 2, 8, 5, reed);
    pigeon(v, ox, 8, 0);
  }
  if (lv >= 5) {
    loft(v, hx - 5, 5, 4, 15);
    linen(v, hx - 11, 3, hx - 6, hz - 2, 8, lapis);
    banner(v, hx - 5, 1, hz - 6, 8);
  }
}
function donkey(v: PixelVox, x: number, z: number, active: boolean) {
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) v.put(x + dx, 1, z + dz, mud);
  v.box(x - 2, 2, z - 1, x + 2, 4, z + 2, mud);
  v.box(x + 1, 3, z, x + 3, 6, z + 1, mud);
  v.put(x + 2, 6, z, cedar);
  v.box(x - 1, 4, z - 1, x + 1, 5, z + 2, faience);
  if (active) {
    v.put(x - 1, 3, z + 2, reed);
    v.put(x, 4, z + 2, red);
  }
}
function runnerYard(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = -hx + 2,
    z = -hz + 2,
    upper = hx - 2;
  // Three separately pitched bays face the pack route through the yard.
  const spans = lv === 1 ? 1 : lv === 2 ? 2 : 3,
    w = Math.floor((upper - x) / spans);
  for (let n = 0; n < spans; n++) {
    const a = x + n * w;
    for (let k = 0; k < w - 1; k++) {
      const h = 4 + Math.floor(k * 0.52);
      v.box(a + k, h, z, a + k + 1, h + 1, z + 4, n % 2 ? ivory : reed);
    }
    bundle(v, a + 1, 1, z + 1, 5);
    v.box(a + w - 3, 1, z, a + w - 2, 4 + Math.floor((w - 3) * 0.52), z + 2, cedar);
    packet(v, a + 2, 1, z + 1);
  }
  for (let i = 0; i < spans; i++) oil(v, x + i * w + 1, 2, z + 3, active);
  counter(c, x + 3, z + 6, active);
  donkey(v, hx - 5, lv === 1 ? 3 : 0, active);
  if (lv >= 2) {
    v.box(x + 7, 1, 1, hx - 3, 2, 3, cedar);
    packet(v, x + 9, 2, 1);
  }
  if (lv >= 3) {
    donkey(v, 2, 9, active);
    linen(v, x, 3, x + 9, 9, 6, faience);
  }
  if (lv >= 4) {
    for (let i = 0; i < 3; i++) donkey(v, -5 + i * 7, 6 + (i % 2) * 4, active);
    banner(v, hx - 5, 1, 2, 10);
  }
  if (lv >= 5) {
    v.box(-4, 1, 2, 2, 8, 5, brick);
    v.clear(-2, 1, 2, 0, 6, 5);
    strut(v, [-5, 8, 3], [6, 12, 3], cedar);
    linen(v, 4, 1, 14, 6, 9, red);
    const right = hx - 8;
    v.hollowBox(right - 2, 1, 5, right + 4, 12, 11, brick);
    v.clear(right - 1, 2, 10, right + 2, 6, 11);
    linen(v, right - 4, 3, right + 6, 13, 13, red);
    v.box(3, 7, 8, right - 1, 8, 11, cedar);
    bundle(v, 5, 1, 9, 7);
  }
}
function ferryYard(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    west = -hx + 2,
    X = hx - 2,
    z = -hz + 2;
  const canal = lv < 3 ? 1 : 3;
  v.box(west, 0, canal - 2, X, 1, canal + 3, water);
  const cx = lv === 1 ? 0 : Math.floor(hx * 0.2),
    r = lv === 1 ? 4 : 7;
  skiff(v, cx, canal, r, active);
  const h = lv < 3 ? 7 : 10 + lv;
  v.box(cx, 2, canal, cx + 1, h + 1, canal + 1, cedar);
  for (let y = 4; y < h; y++) {
    const extent = Math.max(1, Math.round((h - y) * 0.68));
    v.box(cx - extent, y, canal, cx, y + 1, canal + 1, y % 4 ? ivory : faience);
  }
  counter(c, west + 2, z + 1, active);
  if (lv >= 2) {
    paperHall(v, west, z, 1, 4, 5);
    packet(v, west + 5, 1, z + 2);
  }
  if (lv >= 3) {
    v.box(west + 1, 1, canal + 3, X - 2, 2, canal + 5, reed);
    linen(v, 2, canal + 5, X, hz - 2, 6, lapis);
    papyrus(v, west + 2, canal + 1, 5);
  }
  if (lv >= 4) {
    skiff(v, west + 7, canal, 5, active);
    v.box(0, 1, z + 2, 3, 2, canal, cedar);
    for (let i = 0; i < 3; i++) packet(v, 4 + i * 3, 1, z + 2);
  }
  if (lv >= 5) {
    const east = X - 5;
    loft(v, east, z + 2, 3, 9);
    strut(v, [east, 8, z + 3], [east - 5, 10, canal - 2], cedar);
    v.box(east - 5, 4, canal - 2, east - 4, 10, canal - 1, reed);
    packet(v, east - 6, 3, canal - 3);
  }
}
// River quay, pigeon dispatch, pack relay and a triangular-sailed ferry sort sealed packets in public.
export const post: SignatureBuilder = (c, _p, active) => {
  approach(c, 2);
  [boatQuay, pigeonYard, runnerYard, ferryYard][c.variant](c, active);
};
