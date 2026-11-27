// Four dispensaries from the street: a divided capsule, a ceramic mixing bowl, a luminous cross and a row of jars.
import { type Ctx, type PixelVox, byLv, door, lot, pave, person, ring } from "./kit";
import { disc, glassFront, neon, sculpt } from "./commerceKit";
import { override } from "./commerceIcons";

const mint = "#4a9686",
  pine = "#255a52",
  ivory = "#f1ead5",
  rubber = "#4e5b60",
  pale = "#bad6c5";
function counter(v: PixelVox, x: number, y: number, z: number) {
  v.box(x - 3, y, z - 2, x + 3, y + 3, z, mint);
  v.box(x - 3, y + 2, z - 2, x + 3, y + 3, z, ivory);
  v.box(x, y + 3, z - 1, x + 2, y + 4, z, rubber);
  v.put(x + 1, y + 4, z - 1, "screenCyan", 0.55);
}
function jar(v: PixelVox, x: number, y: number, z: number, col: string) {
  v.box(x, y, z, x + 2, y + 3, z + 2, col);
  v.put(x, y + 1, z + 2, ivory);
  v.box(x, y + 3, z, x + 2, y + 4, z + 2, rubber);
}
function storeWindow(c: Ctx, x: number, z: number, w: number) {
  const { v } = c;
  v.box(x, 1, z - 3, x + w, 6, z, rubber);
  glassFront(v, x + 1, x + w - 1, 2, 5, z - 1, pine, 4, "#ffe2a8");
  v.box(x - 1, 5, z - 2, x + w + 1, 6, z + 2, ivory);
  door(v, x + 1, 1, z, "glassDark", 2, 4);
  person(v, x + w - 2, 1, z + 1, mint, "charcoal");
}
function capsule(
  v: PixelVox,
  x: number,
  y: number,
  z: number,
  length: number,
  r: number,
  alongZ = false,
  open = false,
) {
  const dx = alongZ ? r : Math.ceil(length / 2),
    dz = alongZ ? Math.ceil(length / 2) : r;
  const reach = length * 0.5 - r;
  sculpt(v, x - dx, y, z - dz, x + dx, y + 2 * r, z + dz, (_u, _h, _w, xx, yy, zz) => {
    const a = alongZ ? zz + 0.5 - z : xx + 0.5 - x;
    const b = alongZ ? xx + 0.5 - x : zz + 0.5 - z;
    if (Math.max(0, Math.abs(a) - reach) ** 2 + (yy + 0.5 - y - r) ** 2 + b * b > r * r) return null;
    if (open && Math.abs(a) < 2.5) return null;
    if (Math.abs(a) < 0.85) return "#ebc5ae";
    return a < 0 ? "#b64e50" : ivory;
  });
}
function capsuleShop(c: Ctx) {
  const { v, lv, hz } = c;
  const radius = byLv(c, [3, 5, 5, 7, 7]),
    length = byLv(c, [12, 14, 26, 26, 25]);
  const y = lv === 1 ? 2 : 4,
    z = lv < 4 ? -1 : -3;
  capsule(v, 0, y, z, length, radius, false, lv >= 4);
  for (const x of [-1, 1])
    v.box(x * Math.floor(length / 3) - 1, 1, z - 2, x * Math.floor(length / 3) + 2, y + 2, z + 2, pine);
  storeWindow(c, lv === 1 ? -3 : -5, z + radius - 1, lv === 1 ? 6 : 10);
  if (lv >= 3) {
    v.box(-13, 1, z - 2, -7, 5, z + 2, mint);
    v.box(-14, 5, z - 3, -7, 6, z + 4, pale);
    counter(v, 10, 1, z + 2);
    // A street-facing blister display has two rows of raised pearl blisters on its foil awning.
    for (const px of [-12, -9, -6]) {
      for (const pz of [z - 2, z + 2]) v.sphere(px, 7, pz, 1.4, 1.5, 1.4, "#d9e6d7");
    }
    v.box(-14, 6, z - 4, -4, 7, z + 4, "steelLight");
  }
  if (lv >= 4) {
    v.box(-3, y + 1, z - radius + 1, 3, y + 2, z + radius - 1, pine);
    for (const zz of [z - 3, z + 1]) jar(v, -1, y + 2, zz, "#87583d");
    v.box(-8, 0, z + radius, 9, 1, hz - 1, "path2");
    for (const xx of [-7, 6]) v.box(xx, 1, 8, xx + 1, 6, 9, rubber);
    v.box(-8, 6, 7, 8, 7, 10, mint);
  }
  if (lv === 5) {
    // An elevated second capsule crosses the visible dispensing seam at a right angle.
    for (const zz of [-10, 5]) v.box(5, 7, zz, 8, 13, zz + 2, ivory);
    capsule(v, 7, 12, -1, 25, 5, true);
    neon(v, "RX", -8, 8, 9, pine, { back: ivory });
  }
}
function mortar(v: PixelVox, x: number, y: number, z: number, r: number, h: number) {
  for (let row = 0; row < h; row++) {
    const t = row / (h - 1);
    const radius = r * (0.43 + 0.57 * Math.sin(t * Math.PI * 0.5));
    const tint = row === 0 || row === h - 2 ? "#689f91" : ivory;
    ring(v, x, z, y + row, y + row + 1, radius, Math.max(0, radius - 2), tint);
  }
  disc(v, x, z, y, y + 2, Math.max(1, r * 0.5), mint);
  disc(v, x, z, y + h - 1, y + h, r + 0.7, ivory, r - 1.6);
  // Dried herbs stay visible around the grinding head.
  for (let a = 0; a < 4; a++) {
    const dx = Math.cos(a * 1.9) * r * 0.37,
      dz = Math.sin(a * 1.9) * r * 0.35;
    v.sphere(x + dx, y + h - 2, z + dz, r * 0.27, 1.5, r * 0.24, a % 2 ? "#778954" : "#93ad61");
  }
}
function pestle(v: PixelVox, x: number, y: number, z: number, h: number, side: number) {
  const head = h > 10 ? 3 : 2;
  v.sphere(x, y, z, head, head + 1, head, "#855a41");
  for (let i = 1; i <= h; i++) {
    const xx = x + side * Math.round(i * 0.43),
      zz = z - Math.round(i * 0.25),
      r = i === h ? 2 : 1;
    v.box(xx - r, y + i, zz - 1, xx + r + 1, y + i + 1, zz + 2, i === h - 2 ? mint : "#af8259");
  }
}
function mortarShop(c: Ctx) {
  const { v, lv } = c;
  const x = lv < 3 ? 0 : -4,
    z = lv < 4 ? -1 : -3,
    r = byLv(c, [4, 6, 6, 10, 9]),
    h = byLv(c, [4, 6, 6, 9, 10]);
  const stand = lv === 1 ? 1 : 4;
  if (lv > 1) {
    disc(v, x, z, 1, 5, r * 0.63, pine);
    v.box(x - 3, 2, z + 2, x + 3, 5, z + 4, mint);
  }
  mortar(v, x, stand, z, r, h);
  pestle(v, x, stand + h - 2, z, byLv(c, [5, 8, 9, 13, 16]), lv > 3 ? -1 : 1);
  counter(v, x, 1, z + r - 1);
  if (lv >= 3) {
    const rx = 8,
      rz = lv === 3 ? -1 : 2;
    v.hollowBox(rx - 4, 1, rz - 3, rx + 5, 7, rz + 2, "#b19069");
    for (let yy = 2; yy <= 5; yy += 3) {
      v.box(rx - 5, yy, rz + 1, rx + 5, yy + 1, rz + 4, "woodDark");
      for (const dx of [-3, 0, 3]) v.put(rx + dx, yy + 1, rz + 2, "#8d9f5b");
    }
  }
  if (lv >= 4) {
    v.box(-10, 1, 8, 0, 5, 12, pine);
    glassFront(v, -9, -1, 2, 5, 11, pine, 4);
    v.box(-11, 5, 7, 1, 6, 13, mint);
    person(v, -1, 1, 13, "cream");
  }
  if (lv === 5) {
    mortar(v, 8, 7, 4, 5, 5);
    pestle(v, 8, 9, 4, 7, 1);
    for (let i = 0; i < 4; i++) v.box(3 + i, 2 + i, 5, 5 + i, 3 + i, 8, "oak");
    v.box(-9, 2, 12, -7, 5, 13, ivory);
  }
}
function cross(
  v: PixelVox,
  x: number,
  y: number,
  z: number,
  r: number,
  thickness: number,
  col: string,
  horizontal = false,
) {
  const arm = Math.max(1, Math.floor(r * 0.38));
  if (horizontal) {
    v.box(x - arm, y, z - r, x + arm + 1, y + thickness, z + r + 1, col);
    v.box(x - r, y, z - arm, x + r + 1, y + thickness, z + arm + 1, col);
  } else {
    v.box(x - arm, y - r, z, x + arm + 1, y + r + 1, z + thickness, col, 0.45);
    v.box(x - r, y - arm, z, x + r + 1, y + arm + 1, z + thickness, col, 0.45);
  }
}
function crossShop(c: Ctx) {
  const { v, lv } = c,
    cx = lv < 3 ? 0 : -5,
    cz = lv < 4 ? -1 : -4;
  const w = byLv(c, [4, 5, 5, 8, 9]),
    y = byLv(c, [4, 6, 6, 8, 11]);
  cross(v, cx, 1, cz, w, Math.max(2, y - 1), ivory, true);
  cross(v, cx, y, cz, w + 1, 2, mint, true);
  v.box(cx - 1, 2, cz + w, cx + 2, 4, cz + w + 1, "glassDark");
  if (lv >= 2) {
    const px = cx + 2;
    v.box(px, 1, cz - 2, px + 2, y + 10, cz, "#78887e");
    cross(v, px, y + 7, cz, lv > 3 ? 6 : 4, 2, pine);
    cross(v, px, y + 7, cz + 2, lv > 3 ? 5 : 3, 1, "#8be398");
  }
  if (lv >= 3) {
    v.hollowBox(4, 1, cz - 2, 14, 6, cz + 3, "#b4d7c7");
    storeWindow(c, 5, cz + 4, 8);
    v.box(-2, 3, cz - 1, 5, 5, cz + 2, pine);
  }
  if (lv >= 4) {
    storeWindow(c, -6, 8, 11);
    v.box(-10, 5, 3, 2, 6, 7, ivory);
    for (const x of [-10, 2]) v.box(x, 1, 5, x + 1, 6, 6, mint);
    person(v, 7, 1, 9, "blue");
  }
  if (lv === 5) {
    // A second occupied cross is raised above the plaza on four light wells.
    for (const [dx, dz] of [
      [-5, 0],
      [5, 0],
      [0, -5],
      [0, 5],
    ]) {
      v.box(4 + dx, 1, 4 + dz, 6 + dx, 12, 6 + dz, pine);
      v.box(5 + dx, 3, 4 + dz, 6 + dx, 10, 5 + dz, "glass", 0.5);
    }
    cross(v, 5, 12, 5, 8, 3, pale, true);
    cross(v, 5, 15, 5, 8, 1, mint, true);
    v.box(-5, 14, 0, 4, 16, 2, ivory);
  }
}
function bottle(
  v: PixelVox,
  x: number,
  z: number,
  r: number,
  h: number,
  glass: string,
  cap: string,
  open = false,
) {
  // Silhouette of a wide jar with sloped shoulder, narrow neck and a glass or cork stopper.
  const body = Math.round(h * 0.58),
    neck = Math.max(1, Math.round(r * 0.45));
  for (let y = 1; y < h; y++) {
    let radius = r;
    if (y > body) radius = Math.max(neck, r - (y - body));
    ring(v, x, z, y, y + 1, radius, Math.max(0, radius - 1.4), glass);
    if (y === 2 || y === body) ring(v, x, z, y, y + 1, radius + 0.35, radius - 1, glass);
  }
  disc(v, x, z, h - 2, h - 1, neck + 0.8, glass);
  disc(v, x, z, h - 1, h + 1, neck + 0.8, cap);
  disc(v, x, z, h + 1, h + 3, neck + 0.1, cap);
  for (let y = 3; y <= Math.max(4, body - 2); y++) {
    for (let dx = -Math.floor(r * 0.5); dx < Math.ceil(r * 0.5); dx++) {
      const zz = Math.floor(Math.sqrt(r * r - dx * dx));
      v.put(x + dx, y, z + zz - 1, ivory);
    }
  }
  if (open) {
    v.clear(x - Math.floor(r * 0.65), 2, z, x + Math.ceil(r * 0.65), body + 1, z + r + 1);
    for (let y = 3; y < body; y += 4) {
      v.box(x - r + 2, y, z - 2, x + r - 1, y + 1, z + 1, "wood");
      for (let dx = -r + 3; dx < r - 2; dx += 3) jar(v, x + dx, y + 1, z - 2, mint);
    }
  }
}
function bottleShop(c: Ctx) {
  const { v, lv } = c,
    cx = lv < 3 ? -1 : -5,
    cz = lv < 4 ? -1 : -5,
    r = byLv(c, [4, 5, 5, 8, 8]);
  bottle(v, cx, cz, r, byLv(c, [8, 12, 15, 20, 31]), "#97653e", lv < 4 ? "wood" : "#d0b083", lv === 5);
  if (lv >= 2) {
    const xx = lv === 2 ? 4 : 6;
    bottle(v, xx, cz - 1, lv < 3 ? 2 : 4, lv < 3 ? 7 : 10, "#4f9d88", "tealDark");
  }
  if (lv >= 3) {
    bottle(v, 10, cz + 2, 3, 8, "#766990", "cream");
    v.box(2, 5, cz - 2, 5, 6, cz + 2, ivory);
  }
  if (lv >= 4) {
    bottle(v, lv === 5 ? 8 : 5, lv === 5 ? 5 : 6, 6, lv === 5 ? 18 : 14, "#59958b", "wood");
    storeWindow(c, -7, 7, 11);
    v.box(-7, 6, 1, 4, 7, 9, ivory);
  } else counter(v, cx, 1, cz + r);
  if (lv === 5) {
    // The gallery at the amber jar's open shoulder links the stock floor to the green bottle.
    v.box(-4, 16, -1, 8, 18, 2, ivory);
    for (const xx of [-4, 0, 4, 7]) v.box(xx, 18, 1, xx + 1, 20, 2, pine);
    v.box(-4, 20, 1, 8, 21, 2, pine);
    v.box(-13, 1, 5, -10, 12, 7, pine);
    neon(v, "RX", -13, 8, 7, "cream", { back: pine, emit: 0.5 });
    counter(v, -9, 1, 10);
    person(v, -1, 1, 10, "cream");
  }
}
const shops = [capsuleShop, mortarShop, crossShop, bottleShop];
override("neighborhood_pharmacy", (c) => {
  lot(c, "grass2");
  pave(c.v, -c.hx + 1, c.hz - 4, c.hx - 1, c.hz, "path");
  shops[c.variant % 4](c);
});
