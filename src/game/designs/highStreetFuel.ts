import { type Ctx, byLv, person } from "./kit";
import { classicCar, glassFront, neon } from "./commerceKit";
import { beam } from "./sculpturalKit";
import { override } from "./commerceIcons";
import { frontage, shopWindow } from "./highStreetParts";

function dispenser(c: Ctx, x: number, z: number, col: string) {
  const { v } = c;
  v.box(x - 1, 1, z - 1, x + 2, 4, z + 2, col);
  v.box(x - 1, 4, z - 1, x + 2, 6, z + 2, "cream");
  v.put(x, 5, z + 1, "glassDark", 0.6);
  v.box(x + 2, 2, z, x + 3, 5, z + 1, "charcoal");
}
function fuelIsland(c: Ctx, x: number, z: number) {
  c.v.box(x - 2, 0, z - 4, x + 3, 1, z + 4, "concrete");
  dispenser(c, x, z - 1, "red");
}
function service(c: Ctx, x: number, z: number, w: number, d: number) {
  const { v } = c;
  v.hollowBox(x, 1, z, x + w, 6, z + d, "#c9b59b");
  glassFront(v, x + 1, x + w - 1, 2, 5, z + d - 1, "iron", 4, "warmGlow");
  v.box(x - 1, 6, z - 1, x + w + 1, 7, z + d + 1, "cream");
}
function googie(c: Ctx) {
  const { v, hx, hz, lv } = c,
    w = byLv(c, [6, 12, 13, 18, 21]),
    d = byLv(c, [4, 5, 8, 8, 10]);
  const x = lv >= 3 ? -2 : 0,
    z = lv >= 3 ? -2 : 0;
  const height = byLv(c, [6, 8, 9, 11, 13]);
  for (let dx = -w; dx <= w; dx++)
    for (let dz = -d; dz <= d; dz++) {
      if (Math.abs(dx) > w * 0.72 && Math.abs(dz) > d * (1.18 - (0.7 * Math.abs(dx)) / w)) continue;
      const y = height + Math.round((dx / w) * (dz / d) * 4 + Math.abs(dx / w) * 2);
      v.put(x + dx, y, z + dz, Math.abs(dx) > w - 2 || Math.abs(dz) > d - 2 ? "#cb5c4e" : "#e8dcb6");
    }
  const arms = Math.min(5, Math.floor(w * 0.6));
  for (const sign of [-1, 1]) beam(v, [x, 1, z], [x + sign * arms, height + 1, z], "#527f83", 2);
  dispenser(c, x - 2, z + 2, "tealDark");
  if (lv >= 2) {
    fuelIsland(c, hx - 5, 0);
    v.box(-hx + 2, 1, -4, -hx + 4, height + 4, -2, "#be584d");
  }
  if (lv >= 3) {
    service(c, -hx + 3, -hz + 2, 10, 6);
    classicCar(v, hx - 4, 5, "z", "orange");
  }
  if (lv >= 4) {
    service(c, hx - 12, -hz + 2, 8, 6);
    const px = hx - 5,
      pz = -hz + 4;
    v.box(px, 1, pz, px + 1, 24, pz + 1, "#526875");
    const cy = 20;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(v, [px, cy, pz], [px + Math.round(Math.cos(a) * 4), cy + Math.round(Math.sin(a) * 6), pz], "#e6ab58");
    }
    v.sphere(px + 0.5, cy, pz, 2, 2, 1, "#d95847", 0.5);
  }
  if (lv === 5) {
    for (const bx of [-11, 6]) {
      fuelIsland(c, bx, hz - 6);
    }
    v.box(-15, 7, hz - 8, 12, 8, hz - 5, "#579b97");
    for (const bx of [-11, 6]) v.box(bx, 1, hz - 7, bx + 1, 7, hz - 6, "steelDark");
  }
}
function oilCan(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = lv >= 3 ? -5 : -2,
    z = lv >= 3 ? -3 : 0,
    r = byLv(c, [3, 5, 6, 8, 9]),
    h = byLv(c, [6, 9, 13, 17, 21]);
  for (let y = 1; y <= h; y++)
    v.cylinderY(
      x + 0.5,
      z + 0.5,
      y,
      y + 1,
      r,
      y < 3 || y >= h - 1 ? "steelLight" : y > h * 0.62 && y < h * 0.78 ? "#efe0ae" : "#48867a",
    );
  v.cone(x + 0.5, h, h + 3, z + 0.5, r, Math.max(1, r - 3), "steelLight");
  const left = x + r - 1;
  beam(v, [left, h - 2, z], [x + r + Math.min(5, r), h + 4, z], "steelLight", 2);
  beam(v, [x + r + Math.min(5, r), h + 4, z], [x + r + Math.min(7, r + 2), h + 5, z], "chrome", 2);
  if (lv >= 2) {
    shopWindow(c, x - 3, 1, z + r - 1, 6, "#416458");
    for (let i = 0; i < 3; i++) v.box(x - 2 + i * 2, h + 2, z - 2, x - 1 + i * 2, h + 5, z - 1, "iron");
  }
  if (lv >= 3) {
    fuelIsland(c, hx - 6, 0);
    v.box(x + r + 1, h + 2, z - 1, hx - 4, h + 3, z + 2, "steelLight");
  }
  if (lv >= 4) {
    classicCar(v, 4, hz - 6, "x", "teal");
    service(c, -hx + 3, hz - 10, 8, 5);
  }
  if (lv === 5) {
    const dx = hx - 9,
      dz = -hz + 6;
    for (let i = 0; i < 2; i++) {
      const px = dx + i * 4;
      v.cylinderY(px, dz, 1, 8 - i * 2, 2, "#ad6746");
      v.cylinderY(px, dz, 7 - i * 2, 9 - i * 2, 2.2, "steel");
    }
    v.box(dx - 1, 6, dz, dx + 1, 7, z, "#a9afad");
  }
}
function charging(c: Ctx) {
  const { v, hx, hz, lv } = c,
    w = byLv(c, [3, 4, 5, 6, 8]),
    x = lv >= 3 ? -6 : 0,
    z = lv >= 3 ? -4 : 0,
    h = byLv(c, [6, 9, 12, 17, 20]);
  const shoulder = h - 2;
  v.hollowBox(x - w, 2, z - w + 1, x + w + 1, shoulder, z + w, "#526d67");
  v.box(x - w - 1, shoulder, z - w, x + w + 2, h + 1, z + w + 1, "#63a69a");
  for (const side of [-1, 1]) {
    const px = x + side * Math.max(1, w - 1);
    v.box(px - 1, h + 1, z - 1, px + 1, h + 4 + lv, z + 2, "chrome");
    if (lv >= 3) v.put(px, h + 3 + lv, z + 1, "charcoal");
  }
  const targetX = hx - 3,
    targetZ = hz - 4;
  const startX = x + w;
  for (let i = 0; i < 35; i++) {
    const t = i / 34,
      xx = startX + (targetX - startX) * t,
      zz = z + (targetZ - z) * t + Math.sin(2 * Math.PI * t) * Math.min(3, hz / 5);
    v.box(xx, 1 + Math.round((1 - t) ** 3 * 3), zz, xx + 1.5, 3 + Math.round((1 - t) ** 3 * 3), zz + 1.5, "#35464a");
  }
  dispenser(c, targetX, targetZ, "tealDark");
  if (lv >= 2) {
    shopWindow(c, x - w, 2, z + w - 1, 2 * w + 1, "#305753");
  }
  if (lv >= 3) {
    v.box(-hx + 2, 1, hz - 6, -hx + 3, 9, hz - 5, "iron");
    classicCar(v, 0, hz - 5, "x", "blue");
  }
  if (lv >= 4) {
    for (let i = 0; i < 2; i++) {
      const px = 6 + i * 6;
      v.box(px, 1, -hz + 5, px + 1, 7, -hz + 4, "iron");
      for (let j = 0; j < 5; j++)
        v.box(
          px - 2,
          7 + Math.floor(j / 2),
          -hz + 3 + j,
          px + 4,
          8 + Math.floor(j / 2),
          -hz + 4 + j,
          j % 2 ? "#477986" : "#32515d",
        );
    }
  }
  if (lv === 5) {
    v.box(-hx + 2, 1, 5, -hx + 10, 7, 13, "#549384");
    shopWindow(c, -hx + 2, 1, 12, 8, "iron");
    v.box(-hx + 3, 7, 6, -hx + 8, 9, 10, "#89b778");
    for (let yy = 3; yy < 14; yy += 3) v.box(x - w, yy, z + w, x - w + 3, yy + 1, z + w + 1, "warmGlow", 0.6);
  }
}
function retro(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = lv >= 3 ? -5 : 0,
    z = lv >= 3 ? -4 : 0,
    w = byLv(c, [2, 3, 4, 5, 6]),
    h = byLv(c, [7, 10, 14, 19, 25]);
  v.box(x - w - 1, 1, z - w, x + w + 2, 3, z + w + 1, "chrome");
  v.hollowBox(x - w, 3, z - w, x + w + 1, h - 2, z + w, "#b45146", "cream");
  v.hollowBox(x - w - 1, h - 3, z - w - 1, x + w + 2, h + 2, z + w + 1, "#eee2c6");
  const front = z + w;
  v.box(x - w, h - 2, front, x + w + 1, h + 1, front + 1, "#586166");
  for (let dx = -w + 1; dx < w; dx += 2) v.box(x + dx, h - 1, front, x + dx + 1, h + 1, front + 1, "warmGlow", 0.55);
  v.sphere(x, h + 4, z, Math.max(2, w - 1), Math.max(2, w - 1), Math.max(1, w - 2), "#e7d3a0", 0.35);
  v.box(x + Math.floor(w / 2), h - 5, z, x + w + 4, h - 4, z + 2, "charcoal");
  for (let y = 3; y < h - 4; y++) {
    const px = x + w + 3 + Math.round(Math.sin(((y - 3) / (h - 7)) * Math.PI) * 1.2);
    v.put(px, y, z, "charcoal");
  }
  v.box(x + w + 1, 3, z, x + w + 4, 4, z + 1, "charcoal");
  if (lv >= 2) {
    dispenser(c, hx - 4, 1, "redDark");
  }
  if (lv >= 3) {
    service(c, 3, -hz + 3, 8, 7);
    classicCar(v, 2, hz - 6, "x", "crimson");
  }
  if (lv >= 4) {
    const xx = hx - 9;
    v.box(xx - 4, 1, 1, xx - 2, 10, 8, "#ad5349");
    v.box(xx + 2, 1, 1, xx + 4, 10, 8, "#ad5349");
    v.box(xx - 4, 9, 1, xx + 4, 11, 8, "cream");
    for (let i = 0; i < 4; i++) v.box(xx - 2 + i, 5 + (i % 2), 3, xx - 1 + i, 9, 4, "#649d9c");
  }
  if (lv === 5) {
    const xx = -hx + 3;
    v.box(xx, 1, 7, xx + 2, 17, 9, "chrome");
    v.box(xx, 13, 7, xx + 10, 19, 9, "#a54e44");
    neon(v, "GO", xx + 1, 14, 9, "warmGlow");
    person(v, xx + 7, 1, 9, "teal");
  }
}
override(
  "gas_stations",
  (c) => {
    frontage(c, "#747778");
    for (let z = -c.hz + 2; z < c.hz - 4; z += 6) c.v.box(c.hx - 5, 0, z, c.hx - 4, 1, z + 3, "cream");
    [googie, oilCan, charging, retro][c.variant](c);
  },
  ["Roadside Pump", "Service Island", "Motor Court", "Travel Plaza", "Highway Landmark"],
  "A single roadside stop grows sheltered pumps, service bays and a skyline marker visible from the highway.",
);
