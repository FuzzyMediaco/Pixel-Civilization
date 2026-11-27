/**
 * Boutique Hotel — Lakeside Grand · Alpine Palace · Halo Ring · Wave Terraces.
 */
import { type Ctx, lamp, tree, flowerBed } from "./kit";
import { crowd, disc, palm, sculpt, umbrella } from "./commerceKit";
import { override } from "./commerceIcons";

const P = (c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "path") => c.v.box(x0, 0, z0, x1, 1, z1, col);

function pool(c: Ctx, x0: number, z0: number, x1: number, z1: number): void {
  const { v } = c;
  v.box(x0 - 1, 0, z0 - 1, x1 + 1, 1, z1 + 1, "#f1ead8");
  v.box(x0, 0, z0, x1, 1, z1, "#45c3bd", 0.15);
  for (let x = x0; x < x1; x += 3) v.put(x, 0, Math.floor((z0 + z1) / 2), "#7fe0da", 0.2);
}

/** Arched window bay on plane z (wall faces +z). */
function archWin(c: Ctx, x: number, y: number, z: number, h: number, glow = "#ffe1a6"): void {
  c.v.box(x, y, z, x + 2, y + h - 1, z + 1, glow, 0.55);
  c.v.put(x, y + h - 1, z, glow, 0.55);
  c.v.put(x + 1, y + h - 1, z, glow, 0.55);
  c.v.box(x - 1, y - 1, z, x + 3, y, z + 1, "#f6efe0");
}

function buildHotel(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  if (s === 0) {
    // Lakeside Grand: a pink palazzo with an arched loggia, dormers, pool and striped umbrellas
    const wall = "#e79a86", trim = "#f6efe0", roof = "#5b6170";
    const floors = [2, 3, 4, 5, 6][lv - 1];
    const [x0, x1, z0, z1] = lv === 1 ? [-14, 6, -7, 3] : lv === 2 ? [-14, 14, -15, -3] : lv === 3 ? [-22, 22, -15, -3] : [-22, 22, -22, -8];
    const fh = 5, top = 1 + floors * fh;
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    for (let f = 0; f < floors; f++) {
      const y = 2 + f * fh;
      for (let x = x0 + 2; x < x1 - 2; x += 4) {
        if (f === 0) { v.box(x, 1, z1, x + 3, 5, z1 + 3, trim); v.clear(x, 1, z1, x + 2, 4, z1 + 3); } // loggia arches
        else archWin(c, x, y, z1 - 1, 3);
      }
      v.box(x0, y + fh - 2, z1 - 1, x1, y + fh - 1, z1 + (f === 0 ? 3 : 1), trim); // string course / balconies
    }
    // pitched slate roof with pointed dormers
    for (let k = 0; k < 4; k++) v.box(x0 + k, top + k, z0 + k, x1 - k, top + k + 1, z1 - k, roof);
    for (let x = x0 + 3; x < x1 - 3; x += 6) {
      for (let k = 0; k < 4; k++) v.box(x + k, top + k, z1 - 1, x + 4 - k, top + k + 1, z1, k === 3 ? trim : wall);
      v.put(x + 2, top + 1, z1, "#ffe1a6", 0.6);
    }
    if (lv >= 4) {
      // corner towers with clock
      for (const tx of [x0, x1 - 6]) {
        v.box(tx, 1, z1 - 6, tx + 6, top + 6, z1 + 1, wall);
        for (let y = 3; y < top + 4; y += 5) archWin(c, tx + 2, y, z1, 3);
        for (let k = 0; k < 4; k++) v.box(tx + k, top + 6 + k, z1 - 6 + k, tx + 6 - k, top + 7 + k, z1 + 1 - k, roof);
      }
    }
    // lakeside terrace: pool, umbrellas, palms, balustrade
    const pz0 = z1 + 4, pz1 = Math.min(lv <= 1 ? 8 : 15, pz0 + (lv <= 2 ? 6 : 8));
    P(c, x0 - 1, z1, x1 + 1, Math.min(lv <= 1 ? 8 : 16, pz1 + 2), "#efe6d2");
    if (lv >= 2) pool(c, x0 + 4, pz0, x1 - 4, pz1);
    const nU = lv === 1 ? 2 : lv + 2;
    for (let i = 0; i < nU; i++) umbrella(v, x0 + 3 + Math.round(i * ((x1 - x0 - 6) / Math.max(1, nU - 1))), lv === 1 ? 6 : pz1 + 1 > 15 ? 14 : pz1 + 1, "#e63946", "white");
    if (lv >= 3) { palm(v, x0 + 1, pz0 + 1); palm(v, x1 - 3, pz0 + 1); }
    if (lv >= 2) for (let x = x0; x < x1; x += 2) v.put(x, 1, Math.min(15, pz1 + 3), "#f6efe0");
    crowd(c, 2 + lv * 2, x0 + 2, pz0 - 2, x1 - 2, Math.min(15, pz1 + 1));
  } else if (s === 1) {
    // Alpine Palace: stone and timber with steep copper-green spires
    const stone = "#9a968a", timber = "#f0e6d0", roof = "#4f7d5e", shut = "#b4232c";
    const [x0, x1, z0, z1] = lv === 1 ? [-12, 8, -6, 4] : lv === 2 ? [-14, 14, -14, 4] : lv === 3 ? [-22, 22, -14, 6] : [-22, 22, -20, 8];
    const floors = [2, 3, 4, 5, 6][lv - 1];
    const fh = 5, top = 1 + floors * fh;
    v.box(x0, 1, z0, x1, top, z1, timber);
    v.box(x0, 1, z0, x1, 1 + 2 * fh, z1, stone);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    for (let f = 0; f < floors; f++) for (let x = x0 + 2; x < x1 - 2; x += 4) {
      const y = 2 + f * fh;
      v.box(x, y, z1 - 1, x + 2, y + 3, z1, "#ffd9a0", 0.6);
      v.put(x - 1, y + 1, z1, shut); v.put(x + 2, y + 1, z1, shut);
    }
    // steep roof
    const rh = Math.round((z1 - z0) / 2) + 2;
    for (let k = 0; k < rh; k++) {
      const zz0 = z0 + Math.floor(k * 0.55), zz1 = z1 - Math.floor(k * 0.55);
      if (zz1 <= zz0) break;
      v.box(x0 - 1, top + k, zz0, x1 + 1, top + k + 1, zz1, k % 4 === 3 ? "#3f6a4d" : roof);
    }
    const spire = (cx: number, cz: number, r: number, base: number, h: number) => {
      v.box(cx - r, 1, cz - r, cx + r, base, cz + r, stone);
      for (let y = 4; y < base - 1; y += 5) v.box(cx - 1, y, cz + r - 1, cx + 1, y + 3, cz + r, "#ffd9a0", 0.6);
      for (let k = 0; k < h; k++) {
        const rr = r * (1 - k / h) + 0.5;
        v.box(Math.round(cx - rr), base + k, Math.round(cz - rr), Math.round(cx + rr), base + k + 1, Math.round(cz + rr), roof);
      }
      v.box(cx, base + h, cz, cx + 1, base + h + 4, cz + 1, "#e8b93a");
      v.box(cx + 1, base + h + 2, cz, cx + 4, base + h + 4, cz + 1, "red");
    };
    if (lv >= 2) spire(x1 - 4, z1 - 4, 4, top + 4, 12);
    if (lv >= 4) spire(x0 + 4, z1 - 4, 4, top + 2, 10);
    if (lv === 5) spire(0, z0 + 5, 5, top + 8, 16);
    P(c, x0 - 1, z1, x1 + 1, Math.min(lv >= 4 ? 24 : 16, z1 + 8), "#d7d3c8");
    for (let i = 0; i < lv + 1; i++) tree(v, x0 + 2 + i * 7, 1, Math.min(lv >= 4 ? 21 : 14, z1 + 5), "pine", 1.2, i);
    crowd(c, 2 + lv, x0 + 3, z1 + 1, x1 - 3, z1 + 4);
  } else if (s === 2) {
    // Halo Ring: a horseshoe of glowing bands standing over a reflecting pool
    const R = [7, 12, 17, 21, 23][lv - 1];
    const T = [3, 4, 6, 7, 8][lv - 1];
    const D = [6, 10, 12, 14, 18][lv - 1];
    const cy = Math.round(R * 1.05) + 1;
    const z0 = lv === 1 ? -5 : -Math.round(D / 2) - 2, z1 = z0 + D;
    for (let x = -R; x < R; x++) for (let y = 1; y < cy + R; y++) {
      const d = Math.hypot(x + 0.5, y - cy);
      const ring = y >= cy ? d <= R && d >= R - T : Math.abs(x + 0.5) <= R && Math.abs(x + 0.5) >= R - T;
      if (!ring) continue;
      const lit = y % 2 === 0;
      for (let z = z0; z < z1; z++) {
        const face = z === z0 || z === z1 - 1;
        const outer = y >= cy ? d > R - 1 || d < R - T + 1 : Math.abs(x + 0.5) > R - 1 || Math.abs(x + 0.5) < R - T + 1;
        if (!face && !outer && y !== 1) continue;
        v.put(x, y, z, face && lit ? "#4d7cff" : face ? "#1b2a5c" : outer && lit ? "#5d8cff" : "#24346e", face && lit ? 1.1 : outer && lit ? 0.9 : 0);
      }
    }
    // windows of lit rooms scattered on the faces
    for (let k = 0; k < R * 2; k++) {
      const a = (k / (R * 2)) * Math.PI;
      const rr = R - T / 2;
      const x = Math.round(Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr);
      if ((k * 7) % 3 === 0) v.put(x, y, z1 - 1, "#ffd27a", 1.1);
    }
    // podium and reflecting pool
    if (lv >= 3) { v.box(-R - 1, 1, z0 - 3, R + 1, 4, z0, "#d9dbe6"); }
    const pz0 = z1 + 1, pz1 = Math.min(lv <= 1 ? 8 : lv === 2 ? 15 : 22, pz0 + R);
    v.box(-R, 0, pz0, R, 1, pz1, "#0f1d4a", 0.4);
    for (let x = -R + 2; x < R - 2; x += 3) v.put(x, 0, Math.round((pz0 + pz1) / 2), "#4d7cff", 0.8);
    v.box(-2, 1, z1 - 1, 2, 5, z1, "#ffd27a", 0.9);
    if (lv >= 4) for (const x of [-R - 1, R]) for (let z = pz0; z < pz1; z += 4) lamp(v, x, 1, z, 5, "chrome", "#9db8ff");
    crowd(c, 2 + lv, -R + 2, z1, R - 2, z1 + 1);
  } else {
    // Wave Terraces: a curved crescent of floors stepping back, each with a balcony band
    const floors = [2, 4, 6, 8, 10][lv - 1];
    const cxz: [number, number] = lv === 1 ? [0, 18] : lv === 2 ? [0, 26] : [0, 34];
    const Rout0 = lv === 1 ? 24 : lv === 2 ? 38 : lv === 3 ? 46 : 52;
    const depth0 = lv === 1 ? 8 : lv === 2 ? 12 : 14;
    const fh = 3;
    for (let f = 0; f < floors; f++) {
      const Rout = Rout0 - f * 1.2;
      const Rin = Rout - (depth0 - f * (depth0 / (floors + 2)));
      const y0 = 1 + f * fh;
      for (let x = -24; x < 24; x++) for (let z = -24; z < 24; z++) {
        const d = Math.hypot(x + 0.5 - cxz[0], z + 0.5 - cxz[1]);
        if (d > Rout || d < Rin) continue;
        const outerEdge = d < Rin + 1.2; // the street-facing curve (toward the centre)
        for (let y = y0; y < y0 + fh; y++) {
          const slab = y === y0;
          if (!slab && !outerEdge && d < Rout - 1) continue;
          const glowRow = outerEdge && !slab && y === y0 + 1;
          v.put(x, y, z, slab ? (outerEdge ? "#ffffff" : "#e9e4da") : glowRow ? "#ffd9a0" : outerEdge ? "#bfe3ef" : "#d8d2c4", glowRow ? 0.55 : 0);
        }
        if (outerEdge && (x + z) % 5 === 0) v.put(x, y0 + 1, z, "#4f8a3a"); // balcony planters
      }
    }
    // gardens in the curve
    const gz = lv === 1 ? 6 : 10;
    P(c, -24, gz - 4, 24, 24, "#efe6d2");
    pool(c, -8, gz, 8, Math.min(22, gz + (lv === 1 ? 2 : 6)));
    for (let i = 0; i < lv + 1; i++) palm(v, -20 + i * 9, Math.min(22, gz + 2 + (i % 2) * 3));
    for (let i = 0; i < lv; i++) umbrella(v, -12 + i * 7, Math.min(21, gz + 8), "#1f7a7a", "white");
    crowd(c, 3 + lv * 2, -18, gz - 3, 18, Math.min(22, gz + 9));
  }
}

override(
  "boutique_hotel",
  buildHotel,
  ["Guesthouse", "Corner Inn", "Boutique Hotel", "Grand Hotel", "Iconic Resort"],
  "A guesthouse grows into an iconic resort: a pink lakeside palazzo with a loggia and striped umbrellas, an Alpine castle with copper spires, a glowing halo ring over a reflecting pool, or a crescent of wave terraces.",
);
