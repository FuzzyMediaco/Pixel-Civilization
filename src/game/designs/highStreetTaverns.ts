import { type Ctx, byLv, person, bench, ring } from "./kit";
import { band, bulbs, cafeTable, glassFront, palm, spinner } from "./commerceKit";
import { beam } from "./sculpturalKit";
import { override } from "./commerceIcons";
import { frontage, counter, shopWindow } from "./highStreetParts";

function stein(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = byLv(c, [3, 4, 5, 7, 8]),
    h = byLv(c, [6, 9, 12, 17, 21]),
    x = lv >= 3 ? -3 : -1,
    z = lv >= 4 ? -3 : 0;
  for (let y = 1; y <= h; y++)
    ring(v, x + 0.5, z + 0.5, y, y + 1, r, Math.max(0, r - 1.5), y < 3 || y === h ? "cream" : "#bc833d");
  for (let a = 0; a < 12; a++) {
    const angle = (a * Math.PI) / 6;
    const xx = x + Math.round((r - 0.6) * Math.cos(angle)),
      zz = z + Math.round((r - 0.6) * Math.sin(angle));
    v.box(xx, 3, zz, xx + 1, h - 1, zz + 1, a % 2 ? "#de9e47" : "#a56b32");
  }
  const hr = Math.max(2, Math.round(h * 0.33));
  for (let i = -12; i <= 12; i++) {
    const a = (i * Math.PI) / 24;
    v.box(
      x + r - 1 + Math.round(Math.cos(a) * hr),
      Math.round(h * 0.52 + Math.sin(a) * hr),
      z - 1,
      x + r + 1 + Math.round(Math.cos(a) * hr),
      Math.round(h * 0.52 + Math.sin(a) * hr) + 2,
      z + 1,
      "#f3d495",
    );
  }
  v.cylinderY(x + 0.5, z + 0.5, h, h + 1, r, "cream");
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    v.sphere(
      x + Math.cos(a) * r * 0.6,
      h + 1,
      z + Math.sin(a) * r * 0.6,
      r * 0.45 + 0.5,
      1.5 + r * 0.18,
      r * 0.45 + 0.5,
      i % 2 ? "cream" : "#f3dcae",
    );
  }
  if (lv >= 2) shopWindow(c, x - 3, 1, z + r - 1, 6, "woodDark");
  if (lv >= 3) {
    counter(c, hx - 7, 1, 5, "woodDark");
    for (let n = 0; n < 3; n++) beam(v, [hx - 7 + n * 2, 3, 1], [hx - 7 + n * 2, 6, 1], "brass");
  }
  if (lv >= 4) {
    for (const xx of [-8, 1]) cafeTable(c, xx, hz - 5, "woodLight");
    bulbs(v, -8, hz - 4, 6, hz - 4, 6, ["brass", "warmGlow"]);
    for (const xx of [-8, 6]) v.box(xx, 1, hz - 4, xx + 1, 7, hz - 3, "oak");
  }
  if (lv === 5) {
    v.box(x - r - 1, h - 4, z, x + r, h - 3, z + r + 3, "oak");
    for (let i = x - r; i < x + r; i += 3) v.put(i, h - 2, z + r + 2, "brass");
    person(v, x + 1, h - 3, z + r + 1, "teal");
  }
}

function cocktail(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = byLv(c, [3, 5, 6, 9, 11]),
    x = lv >= 3 ? -3 : 0,
    z = lv >= 4 ? -3 : 0;
  const stem = byLv(c, [3, 5, 7, 10, 13]),
    rim = stem + r;
  v.cone(x + 0.5, 1, 3, z + 0.5, r * 0.68, 1, "#a8bbc3");
  v.cylinderY(x + 0.5, z + 0.5, 2, stem + 1, lv >= 4 ? 1.6 : 1, "chrome");
  for (let y = stem; y <= rim; y++) {
    const rr = Math.max(1, y - stem + 1);
    ring(v, x + 0.5, z + 0.5, y, y + 1, rr, Math.max(0, rr - 1.5), y === rim ? "cream" : "#819eac");
  }
  v.cylinderY(x + 0.5, z + 0.5, rim - 1, rim, r - 1, "#cda989");
  const garnish = spinner(c, x, rim, z, "y", 0.22);
  beam(garnish, [-r * 0.45, -1, 0], [r * 0.5, 6, 0], "brass");
  garnish.sphere(r * 0.25, 4, 0, 1 + r * 0.15, 1 + r * 0.14, 1 + r * 0.13, "olive");
  garnish.put(Math.round(r * 0.25), 4, Math.round(1 + r * 0.13), "red");
  counter(c, Math.max(-hx + 2, x - r + 1), z + Math.min(r, 4), Math.min(7, 2 * r), "#68536a");
  if (lv >= 2) {
    v.box(x - r + 1, 3, z + 2, x + r, 4, z + 4, "#8d6679");
    person(v, x - r + 2, 1, z + 5, "red");
  }
  if (lv >= 3) {
    cafeTable(c, hx - 5, 2, "brass");
    v.box(hx - 6, 1, -4, hx - 3, stem + 3, -2, "#725d6b");
  }
  if (lv >= 4) {
    const x0 = x + 1;
    for (let s = 0; s < 7; s++) {
      v.box(x0 + s, 1, z + r - 1 - s, x0 + s + 2, 2 + s, z + r + 2 - s, "#a69a9c");
    }
    v.box(x + 4, stem, z + 1, hx - 4, stem + 1, z + 3, "chrome");
  }
  if (lv === 5) {
    ring(v, x + 0.5, z + 0.5, stem + 2, stem + 3, r * 0.75, r * 0.49, "brass");
    for (const xx of [-8, 2, 8]) {
      cafeTable(c, xx, hz - 5, "cream");
    }
    v.box(hx - 4, 1, hz - 6, hx - 3, 9, hz - 5, "brass");
    bulbs(v, 0, hz - 6, hx - 3, hz - 6, 8, ["pink", "warmGlow"]);
    v.box(0, 1, hz - 6, 1, 9, hz - 5, "brass");
  }
}

function thatch(c: Ctx, x: number, z: number, r: number, h: number) {
  const { v } = c;
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const px = x + Math.round(side * r * 0.62),
        pz = z + Math.round(end * r * 0.62);
      v.box(px, 1, pz, px + 1, h, pz + 1, "woodDark");
      v.put(px, 3, pz + 1, "cream");
      v.put(px, 4, pz + 1, "teal");
    }
  for (let k = 0; k < r + 1; k++)
    v.cylinderY(x + 0.5, z + 0.5, h + k, h + k + 1, r - k + 0.8, k % 2 ? "#c39b61" : "#ad8151");
}
function palms(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = lv >= 3 ? -5 : 0,
    z = lv >= 4 ? -3 : -1,
    r = byLv(c, [3, 5, 5, 7, 8]);
  thatch(c, x, z, r, 3 + lv);
  counter(c, x - r + 1, z + 1, Math.min(7, r * 2), "#9b6444");
  if (lv >= 2) {
    palm(v, Math.min(hx - 3, x + r + 1), z - 2, 1, 7 + lv);
    v.box(x - r, 1, z + r, x + r + 1, 2, z + r + 2, "oak");
  }
  if (lv >= 3) {
    thatch(c, hx - 5, 0, 3, 4);
    ring(v, hx - 5, 0, 1, 3, 3, 2, "wood");
  }
  if (lv >= 4) {
    const shortZ = hz - 7;
    v.box(-hx + 3, 1, shortZ, hx - 4, 3, shortZ + 4, "woodLight");
    band(v, -3, shortZ, 3, "brass");
    person(v, -7, 3, shortZ + 2, "red");
    palm(v, hx - 5, shortZ, 1, 10);
  }
  if (lv === 5) {
    thatch(c, 5, -8, 4, 12);
    v.box(-2, 6, -8, 7, 7, -6, "woodLight");
    for (let dz = 0; dz < 5; dz++) v.box(-hx + 2, 0, hz - 11 + dz, -hx + 5 + dz, 1, hz - 10 + dz, "water");
    bulbs(v, -8, hz - 5, 9, hz - 5, 8, ["warmGlow", "pink"]);
    for (const bx of [-8, 9]) v.box(bx, 1, hz - 5, bx + 1, 9, hz - 4, "oak");
  }
}

function terraces(c: Ctx) {
  const { v, hx, hz, lv } = c,
    n = byLv(c, [1, 2, 3, 4, 5]),
    w = byLv(c, [7, 8, 13, 16, 17]),
    d = byLv(c, [5, 5, 6, 8, 9]);
  const x0 = lv > 2 ? -hx + 3 : -Math.floor(w / 2),
    z0 = -hz + 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i % 2 ? 3 : 0),
      z = z0 + Math.round((n - i - 1) * Math.min(2, (hz - 3) / n)),
      y = 1 + i * 5;
    v.hollowBox(x, y, z, x + w, y + 4, z + d, "#3e4e61");
    glassFront(v, x + 1, x + w - 1, y + 1, y + 3, z + d - 1, "charcoal", 3, "#d9be82");
    v.box(x - 1, y + 4, z - 1, x + w + 1, y + 5, z + d + 3, i % 2 ? "#c38666" : "#9fac93");
    for (let k = x; k < x + w; k += 3) v.put(k, y + 5, z + d + 2, "brass");
    // Illuminated dance tiles follow the exposed edge of each club terrace.
    for (let dx = 1; dx < w - 1; dx += 2) {
      v.put(x + dx, y + 4, z + d + 1, dx % 4 === 1 ? "#cb8caa" : "#9ec9be", 0.55);
    }
    if (i > 0) person(v, x + 2, y + 5, z + d + 1, i % 2 ? "red" : "teal");
    else {
      shopWindow(c, x + 1, y, z + d - 1, w - 2, "#814f67");
      person(v, x + w - 2, y + 5, z + d, "teal");
    }
  }
  if (lv >= 2) {
    counter(c, 0, hz - 4, 5, "#885d61");
  }
  if (lv >= 3) {
    v.box(hx - 5, 1, -3, hx - 3, 13, -1, "#ba806c");
    for (let y = 4; y <= 12; y += 4) v.box(hx - 5, y, -2, hx - 1, y + 1, 1, "warmGlow", 0.65);
  }
  if (lv >= 4) {
    for (const xx of [2, 9]) cafeTable(c, xx, 6, "brass");
    bench(v, -hx + 3, 1, hz - 3);
  }
  if (lv === 5) {
    const y = 1 + (n - 1) * 5 + 5;
    const x = x0 + 3;
    band(v, x, z0 + 2, y, "brass");
    for (const sx of [x0, x0 + w - 1])
      beam(v, [sx, y, z0 + 1], [sx + (sx === x0 ? 2 : -2), y + 5, z0 + 1], "cream", 1, 0.6);
    v.box(x0 + 1, y + 4, z0 + 1, x0 + w - 1, y + 5, z0 + 2, "#bd7888");
  }
}
override(
  "bars",
  (c) => {
    frontage(c, "path2");
    [stein, cocktail, palms, terraces][c.variant](c);
  },
  ["Corner Tap", "Neighborhood Lounge", "Courtyard Bar", "Evening Social Club", "Skyline Supper Bar"],
  "The first drinks counter gains communal seating, an outdoor lounge and a landmark gathering place after dark.",
);
