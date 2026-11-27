import { type Ctx, type PixelVox, lamp, person } from "./kit";
import { bulbs, glassFront, neon, sculpt, spinner } from "./commerceKit";

const timber = "#925927";
const oak = "#dca45d";
const foliage = "#538549";
const green = "#285d46";
const ivory = "#fff1ca";
const colors = ["#c93435", "#ed9f24", "#7eaa42", "#884764"];

function produceBin(v: PixelVox, x: number, y: number, z: number, color: string) {
  v.box(x, y, z, x + 4, y + 1, z + 3, timber);
  v.box(x, y + 1, z, x + 4, y + 2, z + 1, oak);
  for (let i = 0; i < 3; i++) v.put(x + i, y + 1 + (i % 2), z + 1, color);
  v.put(x + 3, y + 2, z + 2, ivory);
}

function apple(v: PixelVox, x: number, z: number, r: number, tall: number, hue: string, entrance: boolean) {
  const rise = Math.floor(tall * 0.87);
  sculpt(v, x - r, 1, z - r, x + r, tall + 1, z + r, (u, h, w) => {
    const dx = 2 * u - 1,
      dz = 2 * w - 1,
      radial = Math.hypot(dx, dz);
    const shoulder = 0.84 + 0.12 * Math.sin(h * Math.PI) + 0.1 * h;
    const lobes = 1 + 0.045 * Math.cos(5 * Math.atan2(dz, dx));
    if ((radial / (shoulder * lobes)) ** 2 + ((h - 0.5) * 1.91) ** 2 > 1) return null;
    if (h > 0.82 + 0.65 * radial || h < 0.055 * (1 - radial)) return null;
    const arch = (dx / 0.36) ** 2 + (Math.max(0, h - 0.19) / 0.21) ** 2;
    if (entrance && arch < 1 && dz > 0.24) return null;
    if (entrance && arch < 1.3 && dz > 0.4 && h < 0.44) return "#e1b06e";
    if (((dx - 0.48) / 0.18) ** 2 + ((h - 0.73) / 0.09) ** 2 < 1 && dz > 0.25) return "#ff9a72";
    return hue;
  });
  for (let i = 0; i <= Math.ceil(r / 3); i++) {
    const stemX = x + Math.floor(i / 2);
    v.box(stemX, rise + i, z - 1, stemX + 2, rise + i + 1, z + 1, "#634526");
  }
  const leafY = rise + Math.ceil(r / 3);
  const length = Math.max(4, r);
  for (let i = 0; i < length; i++) {
    const width = Math.round(Math.sin((Math.PI * (i + 0.5)) / length) * length * 0.23);
    for (let j = -width; j <= width; j++)
      v.put(x - i, leafY + Math.round(Math.sin((Math.PI * i) / length) * 2), z + j, j === 0 ? green : foliage);
  }
  if (entrance) {
    const doorZ = z + Math.floor(r * 0.18);
    v.box(x - 2, 1, doorZ, x + 2, Math.max(5, Math.floor(tall * 0.34)), doorZ + 1, "#ffd88d", 0.65);
    v.box(x - 2, 1, doorZ + 1, x + 2, 2, z + r + 1, "#dbbd90");
    const canopyY = Math.max(4, Math.ceil(tall * 0.32));
    const half = Math.max(2, Math.floor(r * 0.41));
    for (let dx = -half; dx <= half; dx++) {
      const edge = z + r + (Math.abs(dx) % 2);
      v.box(
        x + dx,
        canopyY,
        z + Math.floor(r * 0.72),
        x + dx + 1,
        canopyY + 1,
        edge + 1,
        (dx + half) % 4 < 2 ? "#4c8958" : ivory,
      );
    }
    for (const dx of [-half, half]) v.box(x + dx, 1, z + r, x + dx + 1, canopyY, z + r + 1, timber);
  }
}

function orchard(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = [5, 6, 11, 13, 15][lv - 1];
  const cx = [0, -6, 0, -7, -6][lv - 1];
  const cz = [0, -1, -2, -2, -5][lv - 1];
  apple(v, cx, cz, r, [9, 13, 21, 26, 33][lv - 1], "#c63a3b", true);
  if (lv === 1) produceBin(v, -2, 1, 5, colors[0]);
  if (lv === 2) {
    produceBin(v, 4, 1, 0, colors[0]);
    produceBin(v, 9, 1, 0, colors[2]);
    for (let x = 3; x <= 13; x++) v.box(x, 6, -2, x + 1, 7, 2, x % 4 < 2 ? green : ivory);
    for (const x of [3, 13]) v.box(x, 1, -2, x + 1, 6, -1, timber);
  }
  if (lv >= 3) {
    const stalls = lv === 5 ? 6 : 3;
    for (let i = 0; i < stalls; i++) produceBin(v, -hx + 2 + i * 6, 1, hz - 5, colors[i % 4]);
  }
  if (lv >= 4) {
    // A watermelon sliced open along the promenade, with the rind, pith and pips exposed.
    const x0 = 5,
      x1 = hx - 2,
      z1 = lv === 5 ? 7 : 2;
    sculpt(v, x0, 1, -hz + 1, x1, lv === 5 ? 20 : 14, z1, (u, h, w, x, y) => {
      const d = Math.hypot((u - 0.5) * 1.95, h - 1);
      if (d > 1 || h > 0.96 - 0.22 * u) return null;
      if (d > 0.89 || w < 0.12) return x % 5 < 2 ? green : foliage;
      if (d > 0.8) return "#d3e896";
      if (w > 0.84 && (x + Math.floor(y / 3) * 2) % 5 === 0 && y % 4 < 2) return "#472f35";
      return "#ec645f";
    });
  }
  if (lv === 5) {
    // The second entrance sits under a timber trellis that joins the two fruit halls.
    for (const x of [-13, 1, 14]) v.box(x, 1, 11, x + 2, 10, 13, timber);
    v.box(-13, 9, 11, 17, 11, 13, green);
    for (let x = -13; x < 17; x += 3) v.box(x, 10, 8, x + 1, 11, 16, foliage);
    neon(v, "FRUIT", -9, 10, 14, ivory, { emit: 0.6 });
  }
}

function wheel(v: PixelVox, x: number, y: number, z: number, r: number) {
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++) {
      const radius = Math.hypot(dx, dy);
      if (radius <= r + 0.2) v.put(x + dx, y + dy, z, radius > r - 1.1 ? "#374547" : "#b4c6bd");
    }
}

function shoppingCart(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const left = -hx + 2,
    right = hx - (lv === 1 ? 3 : 5);
  const depth = [4, 5, 10, 10, 15][lv - 1];
  const height = [5, 8, 11, 14, 17][lv - 1];
  const wheelR = [1, 2, 2, 3, 4][lv - 1],
    bottom = wheelR * 2 + 2,
    top = bottom + height;
  for (const x of [left + 3, right - 2]) for (const z of [-depth + 1, depth - 1]) wheel(v, x, wheelR + 1, z, wheelR);
  v.box(left + 1, bottom - 2, -depth + 1, right, bottom - 1, depth, "#5e7771");
  for (let y = 0; y <= height; y++) {
    const inset = Math.round((1 - y / height) * (lv === 1 ? 2 : 4));
    const start = left + inset,
      end = right - Math.floor(inset / 2),
      side = depth - Math.floor(inset / 2);
    for (let x = start; x <= end; x++)
      for (const z of [-side, side]) {
        if (y === height || y === 0 || y % 4 === 0 || (x - start) % 4 === 0 || x === end)
          v.put(x, bottom + y, z, y === height ? green : "#aebfb3");
      }
    for (let z = -side; z <= side; z++)
      for (const x of [start, end])
        if (y === height || y % 4 === 0 || (z + side) % 4 === 0)
          v.put(x, bottom + y, z, y === height ? green : "#aebfb3");
    if (y === 0) v.box(start, bottom, -side, end + 1, bottom + 1, side + 1, oak);
  }
  for (const z of [-depth, depth]) for (let i = 0; i <= 3; i++) v.put(right + i, top + i, z, "#516e65");
  v.box(right + 3, top + 3, -depth, right + 4, top + 4, depth + 1, "#d26836");
  // The load changes from the shopper's first fruit to a stocked hall, with bread above the rim.
  if (lv <= 2) {
    produceBin(v, left + 3, bottom + 1, -2, colors[0]);
    if (lv === 2) produceBin(v, left + 9, bottom + 1, 0, colors[2]);
  } else {
    for (let i = 0; i < (lv === 3 ? 2 : 3); i++) {
      const x = left + 4 + i * 8;
      sculpt(v, x, bottom + 1, -depth + 2, x + 7, top + 4 + i, -depth + 9, (u, h, w) => {
        if (((u - 0.5) * 2) ** 2 + ((h - 0.5) * 2) ** 2 + ((w - 0.5) * 2) ** 2 > 1) return null;
        return colors[i];
      });
    }
    if (lv >= 4) {
      sculpt(v, right - 13, top - 4, -4, right - 4, top + (lv === 5 ? 13 : 8), 3, (u, h, w) => {
        if (Math.hypot((u - 0.5 - 0.18 * (h - 0.5)) * 1.8, (w - 0.5) * 2, (h - 0.5) * 1.94) > 1) return null;
        return Math.abs(((h * 4 + u * 0.5) % 1) - 0.5) < 0.09 ? "#f3cb86" : "#ba773b";
      });
    }
    // Customers enter below the basket through the lit door between the near wheels.
    glassFront(v, -4, 4, 1, bottom - 1, depth - 2, green, 3, "#ffe8aa");
    if (lv === 5) {
      for (const x of [left + 2, -1, right - 3]) v.box(x, 1, depth + 4, x + 1, 8, depth + 5, green);
      for (let x = left + 2; x < right - 2; x++)
        v.box(x, 7, depth + 1, x + 1, 8, depth + 6, x % 4 < 2 ? foliage : ivory);
      for (let i = 0; i < 4; i++) produceBin(v, left + 4 + i * 8, 1, depth + 4, colors[i]);
    }
  }
}

function slatCrate(v: PixelVox, x: number, y: number, z: number, w: number, h: number, d: number, fruit: string) {
  v.box(x, y, z, x + w, y + 1, z + d, "#aa7040");
  for (const dx of [0, w - 2])
    for (const dz of [0, d - 2]) v.box(x + dx, y, z + dz, x + dx + 2, y + h, z + dz + 2, timber);
  for (let s = 2; s < h; s += 3) {
    for (const dz of [0, d - 1]) v.box(x, y + s, z + dz, x + w, y + s + 1, z + dz + 1, oak);
    for (const dx of [0, w - 1]) v.box(x + dx, y + s, z, x + dx + 1, y + s + 1, z + d, oak);
  }
  for (let dx = 2; dx < w - 2; dx += 3)
    for (let dz = 2; dz < d - 2; dz += 3) {
      const pile = h - 2 + ((dx + dz) % 3);
      v.box(x + dx, y + pile, z + dz, x + dx + 2, y + pile + 2, z + dz + 2, fruit);
      v.put(x + dx, y + pile + 2, z + dz, foliage);
    }
}

function crateHall(c: Ctx) {
  const { v, lv } = c;
  if (lv === 1) {
    slatCrate(v, -5, 3, -4, 10, 5, 8, colors[1]);
    wheel(v, -3, 2, 4, 2);
    wheel(v, 3, 2, 4, 2);
    v.box(4, 4, 0, 8, 5, 1, timber);
  } else if (lv === 2) {
    slatCrate(v, -14, 1, -6, 12, 7, 11, colors[1]);
    slatCrate(v, -1, 1, -5, 12, 6, 10, colors[0]);
    slatCrate(v, -12, 8, -4, 8, 5, 7, colors[2]);
  } else {
    const lx = lv === 3 ? -14 : -21,
      far = lv === 5 ? -20 : -13,
      doorWidth = lv === 3 ? 5 : 8;
    const bay = lv === 3 ? 10 : 14,
      high = lv === 3 ? 8 : 11;
    slatCrate(v, lx, 1, far, bay, high, bay, colors[1]);
    slatCrate(v, lx + bay + doorWidth, 1, far + 1, bay, high, bay, colors[0]);
    slatCrate(v, lx + 3, high + 1, far + 2, bay + doorWidth + 2, high - 1, bay - 2, colors[2]);
    for (let i = 0; i < lv - 1; i++) produceBin(v, lx + i * 6, 1, lv === 5 ? 14 : 8, colors[i % 4]);
    if (lv >= 4) {
      slatCrate(v, lx + 5, high * 2, far + 3, 10, 8, 9, colors[3]);
      v.box(lx + 1, 1, 2, lx + 3, high * 2 + 7, 4, green);
      v.box(lx + 1, high * 2 + 5, 2, lx + bay + 7, high * 2 + 7, 4, green);
      v.box(lx + bay + 3, high + 5, 2, lx + bay + 4, high * 2 + 5, 3, "#64584c");
      slatCrate(v, lx + bay + 1, high, 1, 6, 5, 5, colors[1]);
    }
    if (lv === 5) {
      slatCrate(v, 5, 1, 2, 14, 12, 10, colors[0]);
      slatCrate(v, 7, 13, 1, 9, 8, 9, colors[2]);
      bulbs(v, -19, 5, 14, 9, 13);
    }
  }
}

function barnWing(v: PixelVox, x0: number, x1: number, z0: number, z1: number, h: number, roof: string) {
  const mid = (x0 + x1 - 1) / 2,
    radius = (x1 - x0) / 2;
  for (let x = x0; x < x1; x++) {
    const q = Math.abs(x - mid) / radius;
    const peak = h + Math.round(h * (q < 0.52 ? 0.68 - 0.35 * q : 0.5 - (q - 0.52)));
    v.box(x, 1, z0, x + 1, peak, z0 + 1, x % 4 === 0 ? "#a74232" : "#b8553d");
    v.box(x, 1, z1 - 1, x + 1, peak, z1, x % 4 === 0 ? "#a74232" : "#b8553d");
    if (x === x0 || x === x1 - 1) v.box(x, 1, z0, x + 1, h, z1, "#a44636");
    v.box(x, peak, z0 - 1, x + 1, peak + 1, z1 + 1, roof);
    v.put(x, peak, z1, ivory);
  }
  const gate = Math.max(2, Math.floor(radius * 0.48)),
    doorX = Math.floor(mid);
  v.box(doorX - gate, 1, z1 - 1, doorX + gate, Math.min(h, 8), z1, null);
  glassFront(v, doorX - gate, doorX + gate, 1, Math.min(h, 8), z1 - 4, green, gate);
  for (const x of [x0, x1 - 1, doorX - gate - 1, doorX + gate]) v.box(x, 1, z1 - 1, x + 1, h, z1, ivory);
  v.box(doorX - gate - 1, Math.min(h, 8), z1 - 1, doorX + gate + 1, Math.min(h, 8) + 1, z1, ivory);
  for (let z = z0 + 2; z < z1 - 2; z += 5) {
    v.box(x1 - 1, 3, z, x1, 6, z + 3, ivory);
    v.box(x1 - 1, 4, z + 1, x1, 6, z + 2, "#f5c777", 0.55);
  }
}

function farmersBarn(c: Ctx) {
  const { v, lv, hx, hz } = c;
  if (lv === 1) {
    for (const x of [-5, 4]) for (const z of [-3, 3]) v.box(x, 1, z, x + 1, 6, z + 1, timber);
    for (let x = -6; x < 6; x++)
      v.box(
        x,
        7 - Math.floor(Math.abs(x + 0.5) / 3),
        -4,
        x + 1,
        8 - Math.floor(Math.abs(x + 0.5) / 3),
        5,
        x % 4 < 2 ? ivory : green,
      );
    produceBin(v, -4, 1, 3, colors[0]);
    produceBin(v, 1, 1, 3, colors[1]);
    return;
  }
  const x0 = lv === 2 ? -13 : -hx + 3,
    x1 = lv === 2 ? 1 : lv === 3 ? 7 : 3,
    z0 = -hz + 3,
    z1 = lv === 2 ? 3 : lv === 5 ? 3 : 7;
  barnWing(v, x0, x1, z0, z1, lv === 2 ? 6 : lv === 3 ? 9 : 12, green);
  if (lv === 2) {
    produceBin(v, 4, 1, 0, colors[0]);
    produceBin(v, 9, 1, 0, colors[1]);
    bulbs(v, -3, 4, 11, 1, 6);
  }
  if (lv >= 3) {
    for (let x = x0; x < x1; x++) v.box(x, 6, z1, x + 1, 7, z1 + 3, x % 4 < 2 ? ivory : "#72a269");
    for (let x = x0 + 1; x < x1 - 2; x += 6) produceBin(v, x, 1, z1 + 2, colors[Math.abs(x) % 4]);
    const side = lv === 3 ? 9 : 8;
    barnWing(v, side, hx - 2, z0 + 2, lv === 5 ? 7 : z1 - 2, lv === 3 ? 5 : 8, "#5a8072");
  }
  if (lv >= 4) {
    const ridge = Math.floor((x0 + x1) / 2);
    v.box(ridge - 3, 19, z0 + 3, ridge + 3, 24, z0 + 9, ivory);
    glassFront(v, ridge - 2, ridge + 2, 20, 23, z0 + 8, green, 2);
    for (let i = 0; i < 4; i++) v.box(ridge - 4 + i, 24 + i, z0 + 2 + i, ridge + 4 - i, 25 + i, z0 + 10 - i, green);
  }
  if (lv === 5) {
    // Two covered market aisles open towards a central path and the clock cupola.
    for (const x of [-16, 12])
      for (let i = 0; i < 3; i++) {
        const z = 10 + 4 * i;
        v.box(x, 1, z, x + 1, 6, z + 1, timber);
        v.box(x - 3, 6, z - 1, x + 4, 7, z + 2, i % 2 ? ivory : "#e3aa41");
        produceBin(v, x - 2, 1, z, colors[(i + (x > 0 ? 1 : 0)) % 4]);
      }
    bulbs(v, -16, 18, 12, 18, 8);
    // A lattice windpump marks the entry to the permanent growers' court.
    const mx = 16,
      mz = -7;
    for (let y = 1; y < 24; y++) {
      const spread = Math.max(1, 4 - Math.floor(y / 6));
      for (const i of [-1, 1]) for (const j of [-1, 1]) v.put(mx + i * spread, y, mz + j * spread, "#757e70");
      if (y % 5 === 0) v.box(mx - spread, y, mz + spread, mx + spread + 1, y + 1, mz + spread + 1, oak);
    }
    const fan = spinner(c, mx + 0.5, 24.5, mz + 1.5, "z", 0.38);
    for (let blade = 0; blade < 8; blade++) {
      const angle = (blade * Math.PI) / 4;
      for (let r = 1; r <= 6; r++) {
        const dx = Math.round(r * Math.cos(angle)),
          dy = Math.round(r * Math.sin(angle));
        fan.put(dx, dy, 0, r > 4 ? ivory : oak);
        if (r >= 4) fan.put(dx + Math.round(Math.sin(angle)), dy - Math.round(Math.cos(angle)), 0, ivory);
      }
    }
    fan.put(0, 0, 1, "#b75135");
  }
}

export function buildGrocery(c: Ctx) {
  const { v, hx, hz, lv } = c;
  v.box(-hx + 1, 0, hz - 4, hx - 1, 1, hz, "#d9c6a4");
  const aisle = Math.max(1, Math.floor(hx / 8));
  v.box(-aisle, 0, 0, aisle + 1, 1, hz - 4, "#e3cb9c");
  [orchard, shoppingCart, crateHall, farmersBarn][c.variant % 4](c);
  person(v, Math.min(hx - 3, 4), 1, hz - 2, "#4a7766", "blueDark", "#825739");
  if (lv >= 2) person(v, -hx + 3, 1, hz - 2, "#e49140", "charcoal", "#edbb91");
  if (lv >= 3) lamp(v, hx - 3, 1, hz - 3, 6, green, ivory);
}
