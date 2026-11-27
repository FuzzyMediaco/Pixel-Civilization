import type { Ctx, PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import {
  approach,
  attendant,
  brick,
  cedar,
  desk,
  faience,
  gold,
  ivory,
  lapis,
  limestone,
  mud,
  oil,
  red,
  reed,
} from "./egyptianCraft";

// Mudbrick is thickest at the base. Keep an empty interior under the sealed inspection collar.
function bin(v: PixelVox, x: number, z: number, r: number, h: number, top = faience) {
  for (let y = 1; y <= h; y++) {
    const radius = r * (1 - 0.29 * Math.max(0, (y - h * 0.36) / (h * 0.64)));
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx + 0.5, dz + 0.5);
        if (d > radius || (d < radius - 1.15 && y > 1 && y < h)) continue;
        v.put(x + dx, y, z + dz, y === h ? ivory : y % 5 === 0 ? mud : brick);
      }
  }
  v.cylinderY(x, z, h + 1, h + 2, Math.max(1, r * 0.43), top);
}
function door(v: PixelVox, x: number, z: number, y: number, active: boolean) {
  v.box(x - 2, y, z - 1, x + 3, y + 5, z + 1, limestone);
  v.clear(x - 1, y, z - 1, x + 2, y + 4, z + 1);
  v.box(x - 1, y, z - 2, x + 2, y + 4, z - 1, cedar);
  v.put(x, y + 2, z - 1, gold);
  v.box(x - 1, y + 3, z - 1, x + 2, y + 4, z, "#d79e5d", active ? 0.38 : 0.24);
  attendant(v, x - 2, y, z + 1, active, lapis);
  oil(v, x + 2, y, z + 1, active);
}
function bullion(v: PixelVox, x: number, y: number, z: number) {
  v.box(x - 1, y, z - 1, x + 2, y + 1, z + 1, gold);
  v.box(x, y + 1, z - 1, x + 1, y + 2, z + 1, ivory);
}
function drumTreasury(c: Ctx, active: boolean) {
  const { v, hx, lv } = c,
    x = lv === 2 ? -4 : 0,
    z = lv < 3 ? -1 : -3,
    r = lv < 3 ? 5 : 7,
    h = lv < 3 ? 5 : 6 + lv;
  bin(v, x, z, r, h);
  if (lv >= 2) {
    bin(v, hx - 5, -3, 3, 5, red);
    desk(v, hx - 6, 1, 2, active);
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) {
      v.box(x + side * 5 - 1, 1, 3, x + side * 5 + 2, 5, 9, mud);
    }
    v.box(x - 5, 4, 5, x + 6, 5, 7, ivory);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) bin(v, x + side * 8, -8, 4, 7 + Number(side > 0), lapis);
    v.box(-8, 6, -9, 9, 7, -7, ivory);
  }
  if (lv >= 5) {
    v.cylinderY(x, z, h + 2, h + 5, 3.3, brick);
    v.cylinderY(x, z, h + 5, h + 6, 2.7, gold);
    for (let n = 0; n < 4; n++) {
      const i = -6 + n * 4;
      v.box(i, 1, 8, i + 2, 4, 11, red);
    }
    bullion(v, 6, 1, 5);
    for (const side of [-1, 1]) bin(v, side * 8, 7, 4, 7, red);
    v.box(-8, 6, 6, 9, 7, 8, ivory);
  }
  door(v, x, lv >= 3 ? 7 : z + r, 1, active);
}
function mastaba(c: Ctx, active: boolean) {
  const { v, hx, lv } = c,
    w = lv === 1 ? 6 : Math.min(hx - 3, 7 + lv),
    d = lv === 1 ? 3 : lv === 2 ? 4 : 8,
    z = lv < 3 ? -1 : -3;
  // A cut through the sloping battered wall leads into the strongroom.
  for (let y = 1; y <= 5 + lv; y++) {
    const inset = Math.floor((y - 1) / 3);
    v.hollowBox(
      -w + inset,
      y,
      z - d + inset,
      w + 1 - inset,
      y + 1,
      z + d - inset,
      y === 5 + lv ? ivory : y % 3 ? mud : brick,
    );
  }
  if (lv >= 2) {
    // Open the ceiling over the descending rock cut. The long rims flank a sunlit weighing chamber.
    const top = 5 + lv,
      cut = lv === 2 ? 2 : 3;
    const rear = z - d + 2;
    v.clear(-cut, 3, rear, cut + 1, top + 1, z + d + 1);
    for (let row = 0; row < 3; row++) {
      const end = z + d - row * 2;
      v.box(-cut, 1, end - 1, cut + 1, 2 + row, end + 1, limestone);
    }
    v.box(-cut, 2, rear, cut + 1, 4, rear + 2, lapis);
    bullion(v, 0, 4, rear + 1);
    for (const side of [-1, 1]) {
      const x = side * (cut + 1);
      for (let k = 0; k < 3; k++)
        v.box(x, Math.max(3, top - 2), rear + k * 3, x + 1, top + 1, rear + k * 3 + 1, k === 1 ? red : gold);
    }
  }
  v.clear(-1, 1, z + d - 4, 2, 5, z + d + 1);
  if (lv === 1) {
    v.box(-5, 6, z - 2, 2, 8, z + 1, ivory);
    bullion(v, -3, 8, z - 1);
    v.hollowBox(-6, 1, 2, -2, 5, 6, brick);
    v.box(-7, 5, 1, -1, 6, 7, limestone);
    v.clear(-5, 1, 4, -3, 4, 7);
  }
  if (lv >= 2) {
    v.box(-w, 1, z + d - 1, -w + 4, 4, z + d + 2, limestone);
    bullion(v, -w + 2, 4, z + d);
  }
  if (lv >= 3) {
    bin(v, -w + 1, z - d + 1, 4, 7, lapis);
    v.box(3, 1, 5, w, 4, 8, mud);
    desk(v, 6, 1, 8, active);
  }
  if (lv >= 4) {
    const q = w - 3;
    v.hollowBox(q - 3, 6, z - 3, q + 3, 12, z + 3, brick);
    v.box(q - 4, 12, z - 4, q + 4, 13, z + 4, ivory);
    bullion(v, q, 13, z);
  }
  if (lv >= 5) {
    for (let k = 0; k < 5; k++) {
      v.box(-w - 1 + k, 1, z + 7, -w + 2 + k, 3 + k, z + 10, limestone);
    }
    v.box(-w + 1, 7, z - 1, -2, 8, z + 3, ivory);
    bin(v, -w + 4, z, 3, 11, red);
    v.hollowBox(-12, 1, 4, -4, 8, 12, brick);
    v.box(-13, 8, 3, -3, 9, 13, limestone);
    v.box(-9, 7, 9, 7, 8, 12, ivory);
    v.box(6, 1, 9, 8, 7, 12, mud);
  }
  door(v, 0, z + d, 1, active);
}
function honeycomb(c: Ctx, active: boolean) {
  const { v, hx, lv } = c,
    z = lv < 3 ? -1 : -3,
    r = lv < 3 ? 3 : 4;
  const spread = lv === 1 ? 3 : lv === 2 ? 6 : 5;
  for (const side of [-1, 1])
    bin(v, side * spread, z, r, lv === 1 ? (side < 0 ? 5 : 7) : 6 + Number(side > 0) * 2, side < 0 ? red : lapis);
  v.box(-spread, 1, z + 1, spread + 1, 4, z + 4, mud);
  if (lv >= 2) {
    bin(v, hx - 4, z + 1, 2, 4);
    v.box(-spread, 4, z + 1, spread + 1, 5, z + 3, reed);
  }
  if (lv >= 3) {
    bin(v, 0, z - 5, r + 1, 10, gold);
    v.box(-8, 1, 2, -4, 4, 8, brick);
    bullion(v, -6, 4, 5);
  }
  if (lv >= 4) {
    bin(v, -9, 0, 4, 9);
    bin(v, 8, 2, 4, 7, red);
    v.box(-9, 6, -3, -4, 7, 3, ivory);
  }
  if (lv >= 5) {
    bin(v, 0, -7, 4, 15, lapis);
    v.box(4, 8, -3, 9, 9, 3, ivory);
    bin(v, -7, 6, 3, 5);
    bin(v, 7, 7, 3, 6, gold);
  }
  door(v, 0, z + 4, 1, active);
}
function sealedCourt(c: Ctx, active: boolean) {
  const { v, hx, lv } = c,
    r = lv === 1 ? 5 : lv === 2 ? 6 : 9,
    z = lv < 3 ? -1 : -3;
  // Hollow horseshoe curtain, with a narrow gated crack and a counting floor inside.
  for (let x = -r; x <= r; x++)
    for (let dz = -r; dz <= r; dz++) {
      const dist = Math.hypot(x, dz * 0.88);
      if (dist >= r - 2 && dist < r + 0.4 && (dz < 0 || Math.abs(x) > 2)) {
        const h = dz < 0 ? 6 + lv : 3 + Math.floor(lv / 2);
        v.box(x, 1, z + dz, x + 1, h, z + dz + 1, mud);
        v.put(x, h, z + dz, ivory);
      }
    }
  const gateZ = z + r - 1;
  if (lv >= 2) {
    bin(v, -hx + 4, -1, 3, 5, red);
    desk(v, 0, 1, z, active);
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) bin(v, side * 5, gateZ - 1, 3, 6, lapis);
    v.box(-4, 1, z - 6, 5, 3, z - 3, limestone);
    bullion(v, 0, 3, z - 5);
  }
  if (lv >= 4) {
    const back = z - r + 2;
    v.box(-6, 6, back, 7, 9, back + 2, brick);
    for (let x = -4; x <= 4; x += 4) v.box(x, 9, back, x + 2, 11, back + 2, ivory);
    for (const side of [-1, 1]) bin(v, side * 9, 7, 4, 7, red);
    v.box(-9, 6, 6, 10, 7, 9, limestone);
  }
  if (lv >= 5) {
    bin(v, -7, -7, 4, 11, gold);
    bin(v, 7, -7, 4, 11, gold);
    v.box(-7, 9, -8, 8, 10, -6, limestone);
    for (const side of [-1, 1]) v.box(side * 6 - 2, 1, gateZ, side * 6 + 2, 4, gateZ + 5, brick);
  }
  door(v, 0, gateZ, 1, active);
}
// Sealed grain drum, battered mastaba, clustered grain bins and guarded horseshoe compound.
export const treasury: SignatureBuilder = (c, _p, active) => {
  approach(c, 1);
  [drumTreasury, mastaba, honeycomb, sealedCourt][c.variant](c, active);
};
