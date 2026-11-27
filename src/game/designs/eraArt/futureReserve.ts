import { bench, byLv, person, type Ctx, type PixelVox } from "../kit";
import { arc, glass, glow, gold, night, pearl, planter, port, publicWalk, slab, span, steel, teal } from "./futureCivicKit";

const armor = "#747c89",
  panel = "#9aa8af",
  gasket = "#354452",
  bronze = "#a27f66";
function deposit(v: PixelVox, x: number, z: number, top: number, end: number) {
  v.box(x - 2, 1, z, x + 3, top, z + 1, gasket);
  v.box(x - 1, 2, z + 1, x + 2, 3, z + 2, night);
  v.put(x, 2, z + 1, gold);
  v.box(x - 2, top - 1, z + 1, x + 3, top, z + 2, glow, 0.92);
  publicWalk(v, x, z + 1, end);
  person(v, x + 1, 1, Math.min(end - 1, z + 3), "#9a6c63");
}
function sealReserve(c: Ctx) {
  const { v, lv, hz } = c,
    r = byLv(c, [5, 6, 10, 11, 12]),
    rz = lv < 3 ? 4 : r - 2,
    z = lv < 3 ? -1 : -3,
    h = lv + 3;
  for (let x = -r - 1; x <= r + 1; x++)
    for (let dz = -rz - 1; dz <= rz + 1; dz++) {
      const q = Math.hypot(x / r, dz / rz);
      if (q > 1.05) continue;
      const theta = Math.atan2(x, dz),
        segment = ((theta + Math.PI) * 4) / Math.PI;
      const seam = Math.min(segment % 1, 1 - (segment % 1)) < 0.07;
      const high = h + (q < 0.6 ? 2 : q < 0.83 ? 1 : 0) - (seam && q > 0.37 ? 1 : 0);
      if (dz > rz / 2 && Math.abs(x) < 2) continue;
      v.box(x, 1, z + dz, x + 1, high + 1, z + dz + 1, q < 0.42 ? gasket : Math.floor(segment) % 2 === 0 ? armor : panel);
      if (q > 0.58 && q < 0.68) v.put(x, high, z + dz, bronze);
    }
  deposit(v, 0, z + rz - 1, 4, hz);
  if (lv >= 2) {
    port(v, -c.hx + 2, 1, -3, 6, 5, 4, steel);
    bench(v, 4, 1, 4);
  }
  if (lv >= 3) {
    arc(v, 0, z, 2, r + 2, rz + 2, 1, 1.18, 5.1, gasket);
    planter(v, 5, 1, z + rz + 4);
  }
  if (lv >= 4) {
    v.cylinderY(0, z, h + 2, h + 4, 3, bronze);
    slab(v, -2, h + 4, z - 2, 5, 4, armor);
    port(v, -c.hx + 2, 1, 6, 7, 6, 6);
  }
  if (lv === 5) {
    arc(v, 0, z, 7, r + 1, rz, 1, 1.7, 4.6, panel);
    span(v, -r, 3, z, -r, 7, z - 4, 1, gasket);
    span(v, r, 3, z, r, 7, z - 4, 1, gasket);
    bench(v, -2, 1, hz - 4);
  }
}
function crescentReserve(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [4, 7, 9, 10, 11]),
    rz = lv < 3 ? 4 : 8,
    z = lv < 3 ? -1 : -2,
    h = 3 + lv;
  // Broad concentric shells leave a guarded, narrow passage between their offset front tips.
  for (let y = 1; y <= h; y++) {
    arc(v, -1, z, y, r, rz, y === h ? 1 : 2, 1.0, 5.85, y % 4 === 0 ? bronze : y === h ? panel : armor);
  }
  for (let y = 1; y <= h - 1; y++) {
    arc(v, 1, z + 1, y, Math.max(2, r - 3), Math.max(2, rz - 3), 1, -1.4, 2.3, y === h - 1 ? teal : gasket);
  }
  const doorX = lv <= 2 ? 1 : 2;
  deposit(v, doorX, z + rz - 1, 4, hz);
  if (lv >= 2) {
    slab(v, -hx + 3, 1, 3, 6, 3, bronze);
    bench(v, -hx + 4, 2, 4);
  }
  if (lv >= 3) {
    port(v, 0, 1, z - 4, 6, 5, 4, steel);
    arc(v, -1, z, h + 1, r, rz, 1, 2.5, 4.8, panel);
  }
  if (lv >= 4) {
    arc(v, 2, 4, 3, r - 1, 6, 1, -1.5, 1, armor);
    arc(v, 2, 4, 4, r - 1, 6, 1, -1.5, 1, panel);
  }
  if (lv === 5) {
    for (let y = 1; y <= 7; y++) arc(v, -3, z - 2, y, r - 2, rz - 3, 1, 2.05, 4.45, y === 7 ? bronze : gasket);
    slab(v, -hx + 2, 1, hz - 6, 6, 4, pearl);
    person(v, -hx + 5, 2, hz - 4, teal);
  }
}
function ingotReserve(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = -hx + 2,
    z = -hz + 2,
    w = hx * 2 - 5,
    d = byLv(c, [7, 8, 13, 15, 16]);
  const block = (x0: number, y0: number, z0: number, wide: number, deep: number, height: number, col: string) => {
    for (let y = 0; y < height; y++) {
      const bevel = y === height - 1 ? 2 : y === height - 2 ? 1 : 0;
      for (let dz = 0; dz < deep; dz++) {
        const taper = Math.max(0, 3 - Math.min(dz, deep - 1 - dz)) + bevel;
        if (taper * 2 >= wide) continue;
        v.box(
          x0 + taper,
          y0 + y,
          z0 + dz,
          x0 + wide - taper,
          y0 + y + 1,
          z0 + dz + 1,
          y === height - 1 ? panel : y === 1 ? bronze : col,
        );
      }
    }
  };
  block(x, 1, z, w, d, 4, armor);
  deposit(v, x + Math.floor(w / 2), z + d - 1, 4, hz);
  if (lv >= 2) {
    block(x + 2, 5, z + 1, Math.floor(w * 0.65), d - 2, 4, gasket);
    person(v, x + w - 5, 1, z + d + 1, steel);
  }
  if (lv >= 3) {
    block(x + 7, 5, z + 4, w - 8, d - 4, 4, armor);
    block(x + 4, 8, z + 2, 11, 7, 4, bronze);
    bench(v, x + 2, 1, z + d + 4);
  }
  if (lv >= 4) {
    block(x + 9, 9, z + 2, w - 13, d - 4, 5, gasket);
    port(v, x + 1, 1, z + d + 3, 7, 5, 4, steel);
  }
  if (lv === 5) {
    block(x + 3, 1, z + d + 2, w - 4, 7, 4, gasket);
    span(v, x + w - 7, 8, z + 5, x + w - 6, 4, z + d + 5, 1, bronze);
    planter(v, x + 2, 1, hz - 4);
  }
}
function cofferReserve(c: Ctx) {
  const { v, lv, hx, hz } = c,
    z = lv < 3 ? -2 : -4,
    spread = byLv(c, [4, 7, 9, 10, 11]),
    h = byLv(c, [5, 6, 7, 8, 9]);
  // Opposed L-shaped locks meet over an inspectable seam. The two arms remain visible from above.
  for (const side of [-1, 1]) {
    const x = side * spread,
      back = z + (side < 0 ? -2 : 2),
      col = side < 0 ? armor : bronze;
    v.box(x - 2, 1, back - 2, x + 2, h + 1, back + 4, col);
    for (let i = 0; i <= spread; i++) {
      const xx = x - side * i,
        yy = h - Math.floor(i / 4);
      v.box(xx, yy - 2, back - 2, xx + 1, yy + 1, back + 1, col);
      v.put(xx, yy + 1, back - 1, panel);
    }
    slab(v, x - 2, h + 1, back - 2, 4, 6, gasket);
  }
  const vaultWidth = lv < 3 ? 3 : 5;
  v.hollowBox(-vaultWidth, 1, z - 2, vaultWidth + 1, h - 1, z + 3, gasket);
  slab(v, -vaultWidth, h - 2, z - 2, vaultWidth * 2 + 1, 5, armor);
  v.box(-1, 2, z + 2, 2, 4, z + 3, bronze);
  deposit(v, 0, z + 3, 4, hz);
  if (lv >= 2) {
    port(v, -spread + 1, 1, z - 2, 5, 5, 4, steel);
    bench(v, spread - 2, 1, 4);
  }
  if (lv >= 3) {
    span(v, spread, 3, z + 4, -3, 3, z + 10, 1, armor);
    span(v, -spread, 3, z - 3, 5, 3, z - 8, 1, gasket);
    planter(v, 6, 1, hz - 4);
  }
  if (lv >= 4) {
    for (let y = 3; y <= 8; y++) arc(v, 0, z, y, 4, 3, 0, 2, 4.6, y === 8 ? bronze : teal);
    slab(v, -3, 8, z - 2, 6, 4, armor);
  }
  if (lv === 5) {
    port(v, -hx + 3, 1, 6, 8, 6, 6, steel);
    span(v, -spread, 7, z - 3, -hx + 7, 6, 9, 1, gasket);
    slab(v, spread - 3, 1, 7, 7, 4, panel);
  }
}
// A segmented seal, a crescent shell, a stack of beveled ingots and opposed coffers each protect a narrow deposit slot.
export function phaseReserve(c: Ctx, active: boolean) {
  c.vpick([sealReserve, crescentReserve, ingotReserve, cofferReserve])(c);
  if (active) {
    const { v, lv, hx, hz } = c;
    const rz = lv < 3 ? 4 : byLv(c, [5, 6, 10, 11, 12]) - 2;
    const x = c.vpick([0, lv < 3 ? 1 : 2, -hx + 2 + Math.floor((2 * hx - 5) / 2), 0]);
    const z = c.vpick([
      (lv < 3 ? -1 : -3) + rz - 1,
      (lv < 3 ? -1 : -2) + (lv < 3 ? 4 : 8) - 1,
      -hz + 2 + byLv(c, [7, 8, 13, 15, 16]) - 1,
      (lv < 3 ? -2 : -4) + 3,
    ]);
    person(v, x - 2, 1, Math.min(hz - 1, z + 2), steel);
    v.put(x + 1, 2, z + 1, gold, 0.55);
  }
}
