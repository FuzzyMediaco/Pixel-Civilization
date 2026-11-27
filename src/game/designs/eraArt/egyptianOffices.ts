import type { Ctx, PixelVox } from "../kit";
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
  strut,
  water,
} from "./egyptianCraft";

function meeting(c: Ctx, x: number, z: number, active: boolean) {
  desk(c.v, x, 1, z, active);
  attendant(c.v, x - 1, 1, z - 2, active);
  oil(c.v, x + 2, 1, z, active);
  if (c.lv >= 3) attendant(c.v, x + 3, 1, z + 2, active, red);
}
function scribeWalk(v: PixelVox, x: number, z: number, X: number, Z: number, y: number) {
  v.box(x, 1, z, X, y, z + 1, mud);
  for (let xx = x + 1; xx < X - 1; xx += 4) {
    bundle(v, xx, 1, Z - 2, y);
    v.put(xx, 3, z + 1, ivory);
  }
  v.box(x, y, z, X, y + 1, Z, brick);
  v.box(x, y, Z - 1, X, y + 1, Z, ivory);
  for (let q = x + 2; q < X - 1; q += 6) v.put(q, y, Z - 1, "#e4af6a", 0.45);
}
function obelisk(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = -hx + (lv === 1 ? 4 : 5),
    z = -hz + 5,
    h = 12 + lv * 3;
  for (let i = 0; i < 3; i++)
    v.box(x - 3 + i, 1 + i, z - 3 + i, x + 4 - i, 2 + i, z + 4 - i, i === 1 ? red : limestone);
  for (let y = 4; y < h; y++) {
    const r = y < h * 0.54 ? 2 : 1;
    v.box(x - r, y, z - r, x + r + 1, y + 1, z + r + 1, limestone);
    if (y % 4 === 0) v.put(x, y, z + r, lapis);
  }
  v.box(x - 1, h, z - 1, x + 2, h + 1, z + 2, gold);
  v.put(x, h + 1, z, gold, 0.32);
  meeting(c, lv === 1 ? 2 : 1, 1, active);
  if (lv >= 2) {
    scribeWalk(v, x + 3, -hz + 2, hx - 2, -hz + 7, 6);
  }
  if (lv >= 3) {
    linen(v, 1, 2, hx - 2, 8, 6, red);
    v.box(-7, 1, 4, -2, 3, 7, limestone);
  }
  if (lv >= 4) {
    v.box(x - 1, 3, z + 4, x + 2, 4, 3, ivory);
    for (let i = 0; i < 5; i++) v.box(x - 1, 1, 3 + i, x + 2, Math.max(2, 5 - i), 4 + i, limestone);
    banner(v, x + 4, 1, 5, 10);
    scribeWalk(v, -hx + 2, 7, -2, hz - 2, 10);
    v.box(-3, 7, 8, 1, 8, 11, cedar);
  }
  if (lv >= 5) {
    scribeWalk(v, -hx + 2, 5, -hx + 9, hz - 3, 8);
    v.box(-5, 0, 8, 7, 1, hz - 5, water);
    papyrus(v, 7, 9, 6);
  }
}
function riverGauge(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = hx - 5,
    z = -hz + 5,
    h = 13 + lv * 3;
  v.box(x - 2, 1, z - 3, x + 3, h, z + 3, brick);
  for (let y = 2; y < h; y += 3) {
    v.box(x - 2, y, z + 3, x + (y % 2 ? 0 : 2), y + 1, z + 4, ivory);
    v.put(x + 3, y, z + 1, gold);
  }
  v.box(x - 3, h - 2, z - 3, x + 4, h - 1, z + 3, ivory);
  v.box(x - 1, h - 1, z - 1, x + 2, h + 2, z + 2, lapis);
  const len = lv < 3 ? 7 : 12;
  for (let i = 0; i < len; i++) {
    const top = Math.max(2, Math.floor((len - i) * 0.8));
    v.box(x - 2, 1, z + 3 + i, x, top + 1, z + 4 + i, limestone);
    v.put(x, 0, z + 3 + i, water);
  }
  meeting(c, -hx + 4, 2, active);
  if (lv >= 2) {
    v.box(x - 3, 0, 3, x + 3, 1, hz - 2, water);
    scribeWalk(v, -hx + 1, -4, -1, 1, 5);
  }
  if (lv >= 3) {
    for (let i = 0; i < 3; i++) {
      const q = -hx + 2 + i * 3;
      v.box(q, 0, 7, q + 3, 1, 10, water);
    }
    papyrus(v, -3, 9, 5);
  }
  if (lv >= 4) {
    v.box(x - 8, 8, z, x - 1, 9, z + 3, cedar);
    bundle(v, x - 7, 1, z + 1, 8);
    linen(v, -hx + 2, -hz + 2, -3, -hz + 8, 8, faience);
  }
  if (lv >= 5) {
    for (let i = 0; i < 4; i++) v.box(-9 + i * 3, 1, hz - 10 - i, -6 + i * 3, 2 + i, hz - 7 - i, limestone);
    banner(v, -hx + 3, 1, 7, 12, lapis);
  }
}
function signalMast(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = -hx + 4,
    z = lv >= 3 ? 2 : -hz + 5,
    h = 12 + lv * 3;
  // An open A-frame and halyard lift a woven public signal over a timber registry.
  for (const side of [-1, 1]) strut(v, [x + side * 3, 1, z], [x, h, z], cedar);
  v.box(x, h - 6, z, x + 1, h + 1, z + 1, cedar);
  const arm = lv === 1 ? 4 : 6;
  v.box(x - 1, h - 3, z, x + arm + 1, h - 2, z + 1, cedar);
  for (let dx = 1; dx <= arm; dx++)
    v.box(x + dx, h - 7 + Math.floor(dx * 0.45), z, x + dx + 1, h - 3, z + 1, dx % 3 ? red : ivory);
  v.box(x + arm, 3, z, x + arm + 1, h - 3, z + 1, reedCord);
  meeting(c, lv < 3 ? 2 : 0, hz - 4, active);
  if (lv >= 2) {
    scribeWalk(v, -hx + 1, -hz + 2, hx - 1, -hz + 7, 6);
  }
  if (lv >= 3) {
    strut(v, [x, 7, z], [x + 7, 7, z - 6], cedar, 2);
    bundle(v, x + 7, 1, z - 6, 7);
    linen(v, 4, -4, hx - 2, 3, 6, lapis);
  }
  if (lv >= 4) {
    const xx = hx - 5;
    strut(v, [xx - 3, 1, z - 3], [xx, 14, z - 3], cedar);
    strut(v, [xx + 3, 1, z - 3], [xx, 14, z - 3], cedar);
    strut(v, [x, 11, z], [xx, 13, z - 3], ivory);
  }
  if (lv >= 5) {
    scribeWalk(v, 2, 6, hx - 2, hz - 5, 8);
    v.box(-7, 1, 9, 2, 3, 12, limestone);
    banner(v, -6, 3, 10, 10);
  }
}
const reedCord = "#c19c62";
function disk(v: PixelVox, x: number, y: number, z: number, r: number) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++) {
      const d = Math.hypot(dx, dy);
      if (d > r + 0.2) continue;
      v.put(x + dx, y + dy, z, d > r - 1 ? red : dx + dy >= r - 1 ? ivory : gold, d > r - 1 ? 0 : 0.12);
    }
}
function sunSignal(c: Ctx, active: boolean) {
  const { v, hx, hz, lv } = c,
    x = lv === 1 ? 1 : hx - 6,
    z = -hz + 5,
    r = lv === 1 ? 3 : 4 + Math.floor(lv / 3),
    h = 9 + lv * 2;
  v.box(x - 3, 1, z - 2, x + 4, 5, z + 3, mud);
  for (const side of [-1, 1]) {
    const a = x + side * 2;
    v.box(a - 1, 4, z - 1, a + 1, h, z + 2, brick);
    strut(v, [a, h - 2, z], [x + side * r, h + 2, z], faience);
  }
  disk(v, x, h + r, z, r);
  meeting(c, lv === 1 ? -3 : -2, hz - 4, active);
  if (lv >= 2) {
    scribeWalk(v, -hx + 2, -hz + 2, x - 3, -hz + 8, 5);
    v.box(x - 2, 2, z + 3, x + 3, 4, z + 5, limestone);
  }
  if (lv >= 3) {
    v.cylinderY(-5, 4, 0, 1, 4, water);
    papyrus(v, -8, 4, 5);
    linen(v, -hx + 2, -3, -4, 2, 6, faience);
  }
  if (lv >= 4) {
    v.box(x - 8, 7, z - 1, x, 8, z + 2, ivory);
    bundle(v, x - 7, 1, z, 7);
    for (let i = 0; i < 4; i++) v.put(x - 6 + i, 8, z, red);
    const xx = -hx + 5;
    for (const q of [xx - 2, xx + 2]) bundle(v, q, 1, 7, 10);
    disk(v, xx, 13, 7, 3);
    linen(v, -5, 7, 6, 12, 8, red);
  }
  if (lv >= 5) {
    for (let i = 0; i < 3; i++) {
      const q = -7 + i * 5;
      bundle(v, q, 1, hz - 6, 7);
      v.box(q - 2, 7, hz - 7, q + 3, 8, hz - 4, ivory);
    }
    banner(v, x, 1, hz - 9, 12);
  }
}
// Four means of public announcement rise above an occupied civic court and a low scribal office.
export const offices: SignatureBuilder = (c, _p, active) => {
  approach(c, 3);
  [obelisk, riverGauge, signalMast, sunSignal][c.variant](c, active);
  if (c.lv >= 2) {
    // Petitioners cross from the street to the posted notices in front of the clerks.
    const x = c.variant % 2 === 0 ? -c.hx + 4 : c.hx - 4;
    const z = c.hz - 5;
    c.v.box(x - 2, 1, z, x - 1, 5, z + 1, cedar);
    c.v.box(x + 1, 1, z, x + 2, 5, z + 1, cedar);
    c.v.box(x - 2, 3, z, x + 2, 5, z + 1, ivory);
    c.v.put(x - 1, 4, z, red);
    c.v.put(x, 3, z, lapis);
    attendant(c.v, x, 1, z + 2, active);
    oil(c.v, x + 1, 4, z + 1, active);
  }
};
