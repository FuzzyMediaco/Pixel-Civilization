import { type Ctx, type PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import {
  approach,
  attendant,
  banner,
  brick,
  bundle,
  cedar,
  faience,
  gold,
  ivory,
  lapis,
  limestone,
  mud,
  oil,
  red,
  strut,
} from "./egyptianCraft";

function dais(v: PixelVox, cz: number, rear: number, w: number, y: number) {
  v.box(-w, 1, rear, w + 1, y + 1, cz + 1, limestone);
  v.box(-w, y, cz, w + 1, y + 1, cz + 1, ivory);
  for (let n = 0; n < y; n++) {
    const z = cz + y - n;
    v.box(-w + 1, 1, z, w, n + 2, z + 1, n % 2 ? limestone : ivory);
  }
}
function seat(v: PixelVox, y: number, z: number, active: boolean) {
  v.box(-2, y, z - 1, 3, y + 1, z + 2, faience);
  v.box(-1, y + 1, z - 1, 2, y + 4, z, lapis);
  v.box(-2, y + 1, z, 3, y + 2, z + 1, ivory);
  attendant(v, 0, y + 1, z, active, ivory);
}
function gateWing(v: PixelVox, x: number, z: number, w: number, d: number, h: number) {
  for (let i = 0; i < h; i++) {
    const taper = Math.min(Math.floor(w / 3), Math.floor(i / 4));
    const depth = Math.min(Math.floor((d - 2) / 2), Math.floor(i / 5));
    v.box(
      x + taper,
      1 + i,
      z + depth,
      x + w - taper,
      2 + i,
      z + d - depth,
      i === h - 1 ? ivory : i % 7 === 4 ? red : brick,
    );
  }
  v.box(x + 1, h, z + 1, x + w - 1, h + 1, z + d - 1, faience);
}
function scales(v: PixelVox, x: number, y: number, z: number, r: number, active: boolean) {
  const h = 4 + r;
  v.box(x, y, z, x + 1, y + h, z + 1, cedar);
  strut(v, [x - r, y + h - 2, z], [x, y + h, z], gold);
  strut(v, [x, y + h, z], [x + r, y + h - 2, z], gold);
  for (const side of [-1, 1]) {
    const dx = x + r * side;
    v.box(dx, y + h - 4, z, dx + 1, y + h - 1, z + 1, cedar);
    v.box(dx - 1, y + h - 5, z - 1, dx + 2, y + h - 4, z + 1, faience);
  }
  oil(v, x + 1, y, z + 1, active);
}
function hearing(c: Ctx, y: number, cz: number, active: boolean) {
  seat(c.v, y + 1, cz - 1, active);
  for (const side of [-1, 1]) oil(c.v, side * 3, 1, Math.min(c.hz - 2, cz + y + 1), active);
  if (c.lv >= 3) for (const side of [-1, 1]) oil(c.v, side * 5, 2, cz + 1, active);
  oil(c.v, 2, y + 1, cz, active);
  if (c.lv >= 2) attendant(c.v, -3, 1, c.hz - 3, active, lapis);
}
function pylonCourt(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    y = lv < 3 ? 2 : lv + 1,
    cz = lv === 1 ? 0 : Math.floor(hz * 0.13),
    z = -hz + 2;
  const w = lv === 1 ? 4 : Math.min(9, hx - 6),
    end = lv < 3 ? 2 : 0;
  dais(v, cz, z, lv === 1 ? 3 : 5, y);
  for (const side of [-1, 1]) {
    const x = side < 0 ? -3 - w : 3;
    gateWing(v, x, z, w, Math.max(5, end - z), 7 + lv * 2);
    v.box(x + 1, 2, end, x + 2, 6 + lv, end + 1, lapis);
  }
  if (lv >= 2) {
    v.box(-4, 7 + lv, z + 1, 5, 9 + lv, z + 3, ivory);
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) banner(v, side * 8, 1, 4, 9, red);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) gateWing(v, side < 0 ? -11 : 7, 3, 4, 7, 8);
    scales(v, 0, y + 2, z + 3, 3, active);
  }
  if (lv >= 5) {
    for (const side of [-1, 1]) {
      gateWing(v, side < 0 ? -20 : 13, z + 8, 7, 13, 12);
      v.box(side < 0 ? -16 : 8, 7, z + 9, side < 0 ? -7 : 17, 8, z + 13, limestone);
    }
  }
  // Painted stripes run down the stone faces, below a narrow limestone cornice.
  for (const side of [-1, 1]) {
    const x = side < 0 ? -3 - w : 3;
    for (let zz = z + 2; zz < end - 1; zz += 5) v.box(x + 1, 7 + lv * 2, zz, x + w - 1, 8 + lv * 2, zz + 1, ivory);
  }
  hearing(c, y, cz, active);
}
function arcSteps(v: PixelVox, cz: number, r: number, y: number) {
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= 2; z++) {
      const d = Math.hypot(x, z);
      if (d >= r - 2 && d <= r + 0.3)
        v.box(x, 1, cz + z, x + 1, y + 1, cz + z + 1, Math.abs(x) % 6 === 0 ? brick : limestone);
    }
}
function crescentCourt(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    cz = lv < 3 ? 1 : 4,
    r = Math.min(hx - 2, hz + cz - 2),
    y = lv + 1;
  for (let i = 0; i < Math.min(4, 1 + lv); i++) {
    const radius = r - i * 2;
    if (radius > 2) arcSteps(v, cz, radius, 4 + 2 * (lv - i));
  }
  if (lv >= 3)
    for (const side of [-1, 1]) {
      const x = side * (r - 2);
      // A side passage under the raised seating lets the public enter the crescent.
      v.clear(x - 1, 1, cz - 5, x + 2, 5, cz + 3);
      for (const z of [cz - 10, cz - 7]) v.box(x - 1, 2, z, x + 2, 4, z + 1, red);
    }
  dais(v, cz, cz - 3, 3, y);
  if (lv >= 2) {
    for (const side of [-1, 1]) {
      gateWing(v, side < 0 ? -hx + 2 : hx - 6, cz - 2, 4, 4, 8);
    }
  }
  if (lv >= 3) {
    const z = cz - r;
    v.box(-3, 3, z - 1, 4, 9, z + 2, red);
    v.box(-2, 9, z - 1, 3, 10, z + 2, gold);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      bundle(v, side * 6, 1, cz + 6, 9);
      v.box(side < 0 ? -10 : 4, 1, cz + 4, side < 0 ? -3 : 11, 3, cz + 6, limestone);
    }
  }
  if (lv >= 5) {
    for (let i = -3; i <= 3; i++) {
      const x = i * 4,
        z = cz - Math.round(Math.sqrt((r - 3) ** 2 - x * x));
      bundle(v, x, 7, z, 16);
      v.box(x - 2, 16, z - 1, x + 3, 17, z + 2, ivory);
    }
  }
  hearing(c, y, cz, active);
}
function balanceCourt(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    cz = lv < 3 ? -1 : 2,
    z = -hz + 3,
    y = lv + 1,
    r = lv === 1 ? 4 : Math.min(hx - 4, 5 + lv);
  dais(v, cz, z, lv === 1 ? 3 : 6, y);
  // The two stone pans are witnesses' boxes joined by a beam over the judgment seat.
  scales(v, 0, y + 2, Math.max(z + 1, cz - 3), r, active);
  for (const side of [-1, 1]) {
    const x = side * r;
    v.cylinderY(x, cz - 3, 1, 3, 2.2, mud);
    if (lv >= 2) {
      bundle(v, x, 3, cz - 3, y + 6);
      v.box(x - 2, y + 5, cz - 4, x + 3, y + 6, cz - 1, ivory);
    }
    if (lv >= 3) {
      v.box(x - 2, 1, z, x + 3, 5, z + 4, brick);
      v.box(x - 3, 5, z - 1, x + 4, 6, z + 5, limestone);
    }
    if (lv >= 4) {
      const q = side * (r - 1);
      strut(v, [q, 4, cz + 6], [q, 8, cz], limestone, 2);
      banner(v, q, 1, cz + 7, 8);
    }
    if (lv >= 5) {
      const q = side * (hx - 6);
      gateWing(v, q - 3, z + 3, 6, 9, 12);
      v.box(Math.min(q, x), 9, z + 4, Math.max(q, x) + 1, 10, z + 7, ivory);
    }
  }
  hearing(c, y, cz, active);
}
function lotusCourt(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    y = lv + 1,
    cz = lv < 3 ? 0 : 3,
    z = lv < 3 ? -4 : -Math.floor(hz * 0.45);
  dais(v, cz, -hz + 2, lv === 1 ? 4 : 7, y);
  // Six flared stone petals leave the raised public hearing open on its street side.
  const count = lv === 1 ? 2 : lv < 4 ? 4 : 6;
  const r = lv === 1 ? 3 : Math.min(hx - 5, 6 + lv);
  for (let i = 0; i < count; i++) {
    const theta = (Math.PI * i) / (count - 1),
      xx = Math.round(r * Math.cos(theta)),
      zz = z - Math.round((lv < 3 ? 2 : 4) * Math.sin(theta));
    const top = y + 6 + Math.round((lv < 3 ? 2 : 4) * Math.sin(theta));
    bundle(v, xx, y, zz, top);
    // Painted petal soffits spring towards the centre, leaving the street-facing part open.
    if (lv >= 2) {
      const length = 3 + lv,
        toward = Math.sign(xx);
      for (let k = 0; k < length; k++) {
        const px = xx - toward * k,
          py = top + Math.floor((length - k) * 0.28);
        const width = 1 + Math.floor(2 * Math.sin((Math.PI * k) / length));
        v.box(px, py, zz - width, px + 1, py + 1, zz + width + 1, k % 4 === 0 ? gold : faience);
      }
    }
    for (let d = 0; d < 4; d++) {
      const dx = Math.round(Math.cos(theta) * d * 0.7);
      v.box(xx + dx - 1, top + d, zz - 1, xx + dx + 2, top + d + 1, zz + 2, d === 3 ? gold : faience);
    }
  }
  if (lv >= 2) {
    v.box(-r, 7 + lv, z - 1, r + 1, 8 + lv, z + 1, ivory);
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) gateWing(v, side < 0 ? -10 : 6, 2, 4, 6, 6);
  }
  if (lv >= 4) {
    for (const side of [-1, 1]) {
      strut(v, [side * 8, 2, cz + 8], [side * 8, 7, cz + 2], limestone, 2);
      banner(v, side * 6, 1, cz + 10, 9, faience);
    }
  }
  if (lv >= 5) {
    arcSteps(v, z + 3, Math.min(r + 5, hz + z + 2), 8);
    v.box(-4, 10, z - 7, 5, 12, z - 4, red);
  }
  hearing(c, y, cz, active);
}
// Formal paired pylons, an open hearing crescent, a walk-in balance and high lotus judgment canopy.
export const court: SignatureBuilder = (c, _p, active) => {
  approach(c, 3);
  [pylonCourt, crescentCourt, balanceCourt, lotusCourt][c.variant](c, active);
};
