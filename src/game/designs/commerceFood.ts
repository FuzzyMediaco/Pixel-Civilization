/**
 * Artisan Bakery (Bread Loaf · Layer Cake · Spinning Sandwich · Cupcake Corner) and
 * Classic Chrome Diner (Silver Streamliner · Red Drum Marquee · Googie Drive-In · Neon Rooftop).
 */
import { type Ctx, awning, lamp, person, flowerBed } from "./kit";
import { bulbs, cafeTable, classicCar, crowd, disc, glassFront, neon, neonWidth, sculpt, smooth, spinner, umbrella, type Fill } from "./commerceKit";
import { override } from "./commerceIcons";

const P = (c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "path") => c.v.box(x0, 0, z0, x1, 1, z1, col);

// =============================================================================================
// BAKERY
// =============================================================================================

/** A crusty loaf along x; `slice` cuts the +x end to show crumb with windows. */
function loaf(slice: boolean) {
  return (u: number, h: number, w: number): Fill => {
    const cw = Math.abs(w - 0.5) * 2;
    const endR = Math.min(1, (slice ? u : Math.min(u, 1 - u)) / 0.12);
    const prof = 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - cw * cw));
    const top = prof * (0.55 + 0.45 * Math.sqrt(Math.max(0, endR)));
    if (h > top || cw > 0.98) return null;
    if (slice && u > 0.93) return null;
    if (slice && u > 0.88) {
      if (h > top - 0.06 || cw > 0.9) return "#8a4a1c";
      const hole = (Math.sin(h * 40) * Math.cos(w * 37) > 0.75);
      if (Math.abs(w - 0.5) < 0.08 && h < 0.42) return ["#ffd9a0", 0.8]; // door
      if (hole && h > 0.2) return ["#ffcf83", 0.7];
      return "#f2deb0";
    }
    // diagonal scoring on the crown
    if (h > top - 0.12 && cw < 0.55 && (((u * 5 + w * 1.6) % 1) + 1) % 1 < 0.13) return "#f3e2c0";
    if (h < 0.08) return "#7a3e12";
    return h > top - 0.12 ? "#b36a2a" : "#c98b45";
  };
}

/** Layered cake tier with frosting drips, candles drawn separately. */
function tier(c: Ctx, cx: number, cz: number, y0: number, h: number, rx: number, rz: number, sponge: string, frost: string, windows = true): number {
  const { v } = c;
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (z + 0.5 - cz) / rz);
    if (d > 1) continue;
    const rim = d > 1 - 1.6 / Math.min(rx, rz);
    for (let y = y0; y < y0 + h; y++) {
      if (!rim && y < y0 + h - 1) continue;
      let col = y >= y0 + h - 1 ? frost : (y - y0) % 3 === 1 ? "#fff3e0" : sponge;
      // drips
      if (rim && y >= y0 + h - 1 - ((x * 7 + z * 13) % 4)) col = frost;
      if (rim && windows && (y - y0) % 4 === 2 && (x + z) % 4 === 0 && y < y0 + h - 2) {
        v.put(x, y, z, "#ffe1a6", 0.7);
        continue;
      }
      v.put(x, y, z, col);
    }
  }
  return y0 + h;
}

function candles(c: Ctx, cx: number, cz: number, y: number, r: number, n: number, h = 3): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
    c.v.box(x, y, z, x + 1, y + h, z + 1, i % 2 ? "#ff9ec4" : "#a7d8ff");
    c.v.put(x, y + h, z, "#ffcf3f", 1.4);
  }
}

/** Cupcake: ribbed wrapper, swirled frosting, sprinkles, cherry. */
function cupcake(c: Ctx, cx: number, cz: number, y0: number, r: number, wrap: string, frost: string): number {
  const { v } = c;
  const wh = Math.round(r * 1.1);
  for (let y = y0; y < y0 + wh; y++) {
    const rr = r * (0.82 + 0.18 * ((y - y0) / wh));
    disc(v, cx, cz, y, y + 1, rr, (_x, _y, _z, d, a) => (d < rr - 1.2 ? null : (Math.floor((a + Math.PI) / (Math.PI / 8)) % 2 ? wrap : "#ffffff")));
  }
  const sprinkles = ["#ff4d5e", "#ffd23f", "#4d9bff", "#4cd47a", "#ffffff"];
  let y = y0 + wh;
  const layers = Math.round(r * 1.2);
  for (let i = 0; i < layers; i++) {
    const rr = (r + 1) * (1 - (i / layers) ** 1.4) + 0.5;
    disc(v, cx, cz, y, y + 1, rr, (x, _y, z, d) => (d < rr - 1.3 ? null : (x * 7 + z * 11 + i * 5) % 9 === 0 ? sprinkles[(x + z + i) % 5] : frost));
    y++;
  }
  v.put(Math.round(cx), y, Math.round(cz), "#d0021b");
  v.put(Math.round(cx), y + 1, Math.round(cz), "#2f6b45");
  // door in the wrapper
  v.box(Math.round(cx) - 1, y0, Math.round(cz + r * 0.8), Math.round(cx) + 1, y0 + Math.min(4, wh - 1), Math.round(cz + r) + 1, "#ffe1a6", 0.8);
  return y;
}

/** Donut ring (lying flat). */
function donut(c: Ctx, cx: number, cz: number, y0: number, R: number, r: number, icing: string): void {
  for (let x = Math.floor(cx - R - r); x <= cx + R + r; x++) for (let z = Math.floor(cz - R - r); z <= cz + R + r; z++) for (let y = y0; y < y0 + 2 * r; y++) {
    const q = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) - R;
    const d = Math.hypot(q, y + 0.5 - (y0 + r));
    if (d > r) continue;
    if (d < r - 1.2) continue;
    const top = y + 0.5 > y0 + r * 0.9;
    c.v.put(x, y, z, top ? ((x * 5 + z * 3) % 7 === 0 ? ["#ffd23f", "#4d9bff", "#ffffff"][(x + z) % 3] : icing) : "#d9a066");
  }
}

/** Spinning sandwich on a mast. */
function sandwichRotor(c: Ctx, x: number, y: number, z: number, r: number): void {
  const t = spinner(c, x, y, z, "y", 0.9);
  const layers: [string, number][] = [["#d9a066", 2], ["#e8c27a", 1], ["#e6b0a0", 1], ["#ffd23f", 1], ["#d0342c", 1], ["#5fb34a", 1], ["#d9a066", 2]];
  let yy = 0;
  layers.forEach(([col, th], li) => {
    for (let k = 0; k < th; k++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) for (let dz = -r - 1; dz <= r + 1; dz++) {
        const half = li === layers.length - 1 && k === th - 1 ? r - 1 : r;
        const ruffle = col === "#5fb34a" || col === "#ffd23f" ? 1 : 0;
        if (Math.abs(dx) > half + ruffle || Math.abs(dz) > half + ruffle) continue;
        if (ruffle && (Math.abs(dx) > half || Math.abs(dz) > half) && (dx + dz) % 2) continue;
        // triangle cut: sandwich shown as a half on a diagonal
        if (dx + dz > r) continue;
        t.put(dx, yy, dz, col);
      }
      yy++;
    }
  });
  t.put(0, yy, 0, "#c0392b");
  for (let k = 1; k < 4; k++) t.put(0, yy + k, 0, "woodLight");
}

function buildBakery(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  if (s === 0) {
    // Bread Loaf
    if (lv === 1) {
      P(c, -8, 3, 8, 8, "sand");
      v.box(-6, 1, -3, 5, 4, 3, "woodLight");
      for (const x of [-5, 3]) disc(v, x, 3.5, 1, 2, 1.6, "woodDark");
      awning(v, -6, 5, 7, 3, "#c98b45", "white");
      for (const x of [-6, 4]) v.box(x, 4, -3, x + 1, 7, -2, "woodDark");
      sculpt(v, -5, 7, -3, 5, 12, 3, loaf(false));
      for (let i = 0; i < 4; i++) v.box(-5 + i * 2, 4, 0, -4 + i * 2, 5, 3, "#c98b45");
      person(v, 6, 1, 5, "white", "blueDark", "#e8b38f");
    } else if (lv === 2) {
      P(c, -8, 5, 8, 8, "sand");
      v.box(-7, 1, -6, 7, 7, 4, "#f3e2c0");
      v.clear(-6, 1, -5, 6, 6, 3);
      glassFront(v, -6, 6, 2, 5, 3, "#8a4a1c", 3);
      v.box(-1, 1, 3, 1, 5, 4, "woodDark");
      awning(v, -7, 7, 6, 4, "#8a4a1c", "#f3e2c0");
      sculpt(v, -8, 7, -7, 8, 15, 5, loaf(false));
      cafeTable(c, 5, 6);
    } else {
      const big = lv >= 4;
      const [x0, x1, z0, z1, y1] = lv === 3 ? [-16, 16, -7, 6, 16] : lv === 4 ? [-16, 16, -12, 6, 22] : [-16, 16, -14, 8, 28];
      P(c, -16, z1, 16, z1 + (lv === 3 ? 2 : 6), "sand");
      sculpt(v, x0, 1, z0, x1, y1, z1, loaf(lv === 5));
      // door and shop windows in the crust
      glassFront(v, -10, 6, 2, 6, z1 - 2, "#7a3e12", 4);
      v.box(-2, 1, z1 - 2, 2, 6, z1 - 1, "#ffe1a6", 0.9);
      v.box(-2, 1, z1 - 1, 2, 6, z1, null);
      if (big) {
        // baguette chimneys
        for (const [x, z] of [[-9, -6], [-5, -8]]) {
          sculpt(v, x, Math.round(y1 * 0.7), z, x + 3, y1 + 6, z + 3, (_u, h) => (h > 0.96 ? null : Math.floor(h * 8) % 2 ? "#c98b45" : "#f3e2c0"));
          c.smoke(x + 1, y1 + 6, z + 1, "steam");
        }
        for (let i = 0; i < (lv === 5 ? 4 : 3); i++) { cafeTable(c, -12 + i * 7, z1 + 3); umbrella(v, -12 + i * 7, z1 + 3, "#8a4a1c", "#f3e2c0"); }
      } else crowd(c, 4, -14, z1, 14, z1 + 2);
    }
  } else if (s === 1) {
    // Layer Cake
    const frost = "#ffd1e0", sponge = "#f2c48d";
    if (lv === 1) {
      P(c, -8, 4, 8, 8, "marble");
      // a single slice: wedge with visible layers
      sculpt(v, -6, 1, -6, 6, 10, 5, (u, h, w) => {
        if (w < 1 - u * 1.1) return null;
        if (h > 0.9) return frost;
        if (w > 0.92) return Math.floor(h * 9) % 3 === 1 ? "#fff3e0" : Math.floor(h * 9) % 3 === 2 ? "#e63946" : sponge;
        return Math.floor(h * 9) % 3 === 1 ? "#fff3e0" : sponge;
      });
      v.box(2, 1, 4, 4, 4, 5, "#ffe1a6", 0.8);
      v.put(3, 10, 2, "#d0021b");
      person(v, -5, 1, 6, "pink", "blueDark", "#c68a62");
    } else {
      const tiers = lv - 1;
      const rx0 = lv === 2 ? 7 : lv === 3 ? 14 : 15;
      const rz0 = lv === 2 ? 6 : lv === 3 ? 7 : 14;
      const cz = lv === 3 ? -1 : lv === 2 ? -1 : -1;
      let y = 1;
      const fr = ["#ffd1e0", "#ffffff", "#c8f0e0", "#ffe7a3"];
      for (let i = 0; i < tiers; i++) {
        const k = 1 - i * 0.24;
        y = tier(c, 0, cz, y, lv === 2 ? 8 : 7, rx0 * k, rz0 * k, i % 2 ? "#7b3f1d" : sponge, fr[i % 4], true);
      }
      candles(c, 0, cz, y, Math.max(1.5, rx0 * (1 - (tiers - 1) * 0.24) - 2), Math.min(8, 3 + tiers), 3);
      v.put(0, y, cz, "#d0021b");
      v.put(0, y + 1, cz, "#d0021b");
      // front door in the bottom tier
      v.box(-2, 1, cz + rz0 - 2, 2, 5, cz + rz0 + 1, "#ffe1a6", 0.9);
      P(c, -16, cz + rz0, 16, 16, "marble");
      crowd(c, 2 + lv, -12, cz + rz0 + 1, 12, Math.min(16, cz + rz0 + 4));
      if (lv >= 4) crowd(c, 4, -8, -6, 8, 4, 8); // diners on the first terrace
    }
  } else if (s === 2) {
    // Spinning Sandwich deli
    const wall = ["#f4e1c1", "#f4e1c1", "#2f6b45", "#2f6b45", "#2f6b45"][lv - 1];
    if (lv === 1) {
      P(c, -8, 4, 8, 8);
      v.box(-6, 1, -4, 6, 6, 3, wall);
      glassFront(v, -5, 5, 2, 5, 2, "#2f6b45", 3);
      awning(v, -6, 6, 6, 3, "#2f6b45", "white");
      v.box(-1, 6, -1, 0, 9, 0, "iron");
      sandwichRotor(c, -0.5, 9, -0.5, 3);
    } else {
      const [x0, x1, z0, z1, fl] = lv === 2 ? [-7, 7, -6, 4, 1] : lv === 3 ? [-15, 15, -7, 4, 2] : lv === 4 ? [-15, 15, -14, 6, 2] : [-15, 15, -14, 8, 3];
      const top = 1 + fl * 6;
      v.box(x0, 1, z0, x1, top, z1, wall);
      v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
      glassFront(v, x0 + 1, x1 - 1, 2, 6, z1 - 1, "#f4e1c1", 3);
      for (let f = 1; f < fl; f++) glassFront(v, x0 + 2, x1 - 2, 2 + f * 6, 5 + f * 6, z1 - 1, wall, 3, "#ffe7b0");
      awning(v, x0, x1, 7, z1, "#c0392b", "white");
      v.box(x0, top - 1, z0, x1, top, z1 + 1, "#f4e1c1");
      neon(v, "DELI", -7, top - 5 + (fl > 1 ? 0 : 0), z1, "#ffd23f", { scale: 1 });
      const r = lv === 2 ? 4 : lv === 3 ? 5 : lv === 4 ? 6 : 8;
      v.box(-1, top, (z0 + z1) / 2 - 1, 1, top + 4 + lv, (z0 + z1) / 2 + 1, "chrome");
      sandwichRotor(c, 0, top + 4 + lv, (z0 + z1) / 2, r);
      P(c, -16, z1, 16, Math.min(16, z1 + 6));
      for (let i = 0; i < lv - 1; i++) cafeTable(c, x0 + 3 + i * 7, z1 + 2);
    }
  } else {
    // Cupcake Corner
    const wraps = ["#ff7aa8", "#7ac7ff", "#b38cff", "#ffd23f"];
    const frosts = ["#fff0f6", "#ffd1e0", "#c8f0e0", "#7b3f1d"];
    if (lv === 1) { P(c, -8, 5, 8, 8, "marble"); cupcake(c, 0, -1, 1, 5, wraps[0], frosts[1]); person(v, 5, 1, 6, "pink", "blueDark", "#e8b38f"); }
    else if (lv === 2) { P(c, -8, 5, 8, 8, "marble"); cupcake(c, 0, -1, 1, 7, wraps[1], frosts[0]); crowd(c, 2, -6, 6, 6, 8); }
    else if (lv === 3) {
      P(c, -16, 5, 16, 8, "marble");
      cupcake(c, -7, -1, 1, 7, wraps[0], frosts[1]);
      cupcake(c, 8, 0, 1, 5, wraps[2], frosts[3]);
      crowd(c, 3, -14, 6, 14, 8);
    } else {
      P(c, -16, -16, 16, 16, "marble");
      cupcake(c, -6, -6, 1, lv === 5 ? 10 : 9, wraps[0], frosts[1]);
      cupcake(c, 9, -9, 1, lv === 5 ? 6 : 5, wraps[2], frosts[3]);
      if (lv === 5) cupcake(c, 10, 5, 1, 5, wraps[3], frosts[0]);
      donut(c, lv === 5 ? -6 : 6, 9, 1, lv === 5 ? 5 : 4, 2, "#ff7aa8");
      for (let i = 0; i < 3; i++) cafeTable(c, -14 + i * 5, 13);
    }
  }
}

override(
  "artisan_bakery",
  buildBakery,
  ["Bread Stall", "Corner Bakery", "Signature Bake", "Bakehouse Landmark", "Grand Bakehouse"],
  "A market stall grows into a bakery shaped like what it sells: a scored loaf sliced open to its crumb, a tiered cake with candles, a deli with a spinning sandwich, or a cluster of cupcakes.",
);

// =============================================================================================
// DINER
// =============================================================================================

/** Stainless railcar diner along x with barrel roof, red bands and rounded windows. */
function railcar(c: Ctx, x0: number, x1: number, z0: number, z1: number, y0: number, h: number, band = "#d62b35"): void {
  sculpt(c.v, x0, y0, z0, x1, y0 + h + 3, z1, (u, hh, w) => {
    const cw = Math.abs(w - 0.5) * 2;
    const endR = Math.min(1, Math.min(u, 1 - u) * (x1 - x0) / 3);
    if (cw > 0.4 + 0.6 * Math.sqrt(Math.max(0, endR))) return null;
    const y = hh * (h + 3);
    const roofTop = h + 3 * Math.sqrt(Math.max(0, 1 - cw * cw));
    if (y > roofTop) return null;
    if (y < 1.2) return Math.floor(u * (x1 - x0)) % 2 === Math.floor(w * (z1 - z0)) % 2 ? "black" : "white"; // checker base
    if (y > h) return Math.floor(u * (x1 - x0) / 3) % 4 === 0 ? band : "#c9ced6";
    const yy = Math.floor(y);
    if (yy === 2 || yy === h - 1) return band;
    if (yy >= 3 && yy <= h - 3 && cw > 0.6 && Math.floor(u * (x1 - x0)) % 4 !== 0) return ["#ffe9b8", 0.65];
    return yy % 2 ? "#dfe3e8" : "#b9bfc8";
  });
}

function glassBlock(c: Ctx, x0: number, x1: number, z0: number, z1: number, h: number): void {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) for (let y = 1; y < h; y++) {
    if (x > x0 && x < x1 - 1 && z > z0 && z < z1 - 1 && y < h - 1) continue;
    c.v.put(x, y, z, (x + y + z) % 2 ? "#cfeef5" : "#e8fbff", 0.35);
  }
  c.v.box(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 1, "#d62b35");
}

function clock(c: Ctx, x: number, y: number, z: number, r: number): void {
  disc(c.v, x, y, 0, 1, 0, "white"); // no-op placeholder to keep imports tidy
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const d = Math.hypot(dx, dy);
    if (d > r + 0.3) continue;
    const ring = d > r - 1;
    const hand = (dx === 0 && dy >= 0 && dy < r - 1) || (dy === 0 && dx >= 0 && dx < r - 2);
    c.v.put(x + dx, y + dy, z, ring ? "#d62b35" : hand ? "black" : "white", ring ? 0.6 : 0.5);
  }
}

function buildDiner(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  if (s === 0) {
    // Silver Streamliner
    if (lv === 1) {
      P(c, -8, 3, 8, 8);
      railcar(c, -7, 7, -3, 3, 2, 6);
      for (const x of [-5, 3]) disc(v, x, 3.5, 0, 2, 1.5, "charcoal");
      for (let x = -5; x < 5; x += 2) { v.put(x, 1, 5, "chrome"); v.put(x, 2, 5, "#d62b35"); }
      person(v, 6, 1, 5, "white", "blueDark", "#c68a62");
    } else {
      const [x0, x1, z0, z1] = lv === 2 ? [-7, 7, -5, 3] : lv === 3 ? [-15, 15, -6, 3] : lv === 4 ? [-15, 9, -6, 3] : [-15, 15, -6, 3];
      railcar(c, x0, x1, z0, z1, 1, lv === 2 ? 7 : 8);
      glassBlock(c, -3, 3, z1 - 1, z1 + 3, 8);
      v.box(-1, 1, z1 + 2, 1, 6, z1 + 3, "#ffe1a6", 0.9);
      P(c, -16, z1, 16, Math.min(16, z1 + 5));
      if (lv === 3) neon(v, "DINER", -9, 12, 0, "#ff3b4e", { scale: 1 });
      if (lv >= 4) {
        // vertical fin pylon with stacked letters and a clock
        const fx = lv === 4 ? 12 : -1;
        const fz = lv === 4 ? -2 : z1 + 1;
        v.box(fx - 1, 1, fz - 2, fx + 2, 30, fz + 1, "#e6e9ee");
        for (let y = 2; y < 30; y += 3) v.box(fx - 1, y, fz + 1, fx + 2, y + 1, fz + 2, "#d62b35", 0.8);
        neon(v, "DINER", fx, 3, fz + 2, "#ff3b4e", { vertical: true, emit: 1.4 });
        clock(c, fx, 33, fz + 1, 3);
        if (lv === 5) {
          railcar(c, -15, -4, -15, -7, 1, 7, "#2c5ea8");
          railcar(c, 4, 15, -15, -7, 1, 7, "#2c5ea8");
        }
        classicCar(v, -14, 10, "x", "#d62b35");
        classicCar(v, 6, 10, "x", "#7fd1c7");
        flowerBed(c, -15, 5, -5, 6);
        flowerBed(c, 5, 5, 15, 6);
      }
    }
  } else if (s === 1) {
    // Red Drum Marquee (round red sign over the doors, yellow sign and clock above)
    const drum = (cx: number, cz: number, y0: number, r: number, h: number) => {
      // stadium-shaped red marquee: flat lettered face, rounded ends, white rims
      const half = r + 4;
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) for (let z = Math.round(cz - 3); z <= Math.round(cz + 2); z++) {
        const dx = Math.max(0, Math.abs(x + 0.5 - cx) - (half - 3));
        const dd = Math.hypot(dx, (z - cz) * 1.0);
        if (dd > 3) continue;
        const rim = dd > 2.2 || Math.abs(x + 0.5 - cx) > half - 1;
        for (let y = y0; y < y0 + h; y++) v.put(x, y, z, (y === y0 || y === y0 + h - 1) && rim ? "#f4f4f4" : "#d62b35");
      }
      const word = "DINER";
      const w = neonWidth(word);
      neon(v, word, Math.round(cx - w / 2), y0 + Math.max(1, Math.floor((h - 5) / 2)), Math.round(cz + 3), "#ffffff", { emit: 0.9 });
    };
    const base = (x0: number, x1: number, z0: number, z1: number, h: number) => {
      v.box(x0, 1, z0, x1, h, z1, "#c9ced6");
      v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
      for (let x = x0; x < x1; x++) for (const y of [1, 2]) v.put(x, y, z1 - 1, (x + y) % 2 ? "black" : "white");
      for (let x = x0 + 2; x < x1 - 2; x += 5) disc(v, x + 1.5, h / 2 + 1.5, 0, 0, 0, "white");
      for (let x = x0 + 2; x < x1 - 3; x += 5) v.box(x, 4, z1 - 1, x + 3, 7, z1, "#ffe9b8", 0.6);
      v.box(x0, h - 1, z0, x1, h, z1, "#d62b35");
    };
    if (lv === 1) {
      P(c, -8, 4, 8, 8);
      base(-6, 6, -5, 3, 8);
      drum(0, 1, 8, 4, 6);
      person(v, 4, 1, 5, "red", "blueDark", "#e8b38f");
    } else {
      const [x0, x1, z0, z1] = lv === 2 ? [-7, 7, -6, 2] : lv === 3 ? [-15, 15, -6, 2] : [-15, 15, -12, 2];
      base(x0, x1, z0, z1, 9);
      glassBlock(c, -3, 3, z1 - 1, z1 + 3, 8);
      v.box(-1, 1, z1 + 2, 1, 7, z1 + 3, "chrome");
      const r = lv === 2 ? 5 : 7;
      drum(0, z1, 9, r, lv === 2 ? 6 : 7);
      let y = 9 + (lv === 2 ? 6 : 7);
      if (lv >= 3) {
        // yellow sign above the drum
        v.box(-6, y, z1 - 1, 7, y + 4, z1 + 2, "#ffc72c");
        neon(v, "EAT", -5, y + 1, z1 + 2, "#ffffff", { scale: 1, emit: 0.6 });
        neon(v, "★", 4, y, z1 + 2, "#ff3b4e");
        y += 4;
      }
      if (lv >= 4) { v.box(0, y, z1, 1, y + 2, z1 + 1, "#ffc72c"); clock(c, 0, y + 5, z1 + 1, 3); }
      if (lv === 5) {
        // red band wings with lettering
        v.box(-16, 9, z1 - 1, -7, 12, z1 + 1, "#d62b35");
        v.box(8, 9, z1 - 1, 16, 12, z1 + 1, "#d62b35");
        neon(v, "PIES", -15, 10 - 1 + 0, z1 + 1, "#ffffff", { emit: 0.7 });
        neon(v, "MALT", 9, 9, z1 + 1, "#ffffff", { emit: 0.7 });
        classicCar(v, -14, 11, "x", "#d62b35");
        classicCar(v, 7, 12, "x", "#2c5ea8");
      }
      P(c, -16, z1, 16, Math.min(16, z1 + 6));
      crowd(c, 2 + lv, -12, z1 + 3, 12, Math.min(16, z1 + 6));
    }
  } else if (s === 2) {
    // Googie Drive-In: boomerang canopies, starburst sign, carhop bays
    const star = (x: number, y: number, z: number, r: number) => {
      v.box(x, 1, z, x + 1, y, z + 1, "#e6e9ee");
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const len = a % 2 ? r : r * 0.6;
        for (let k = 1; k <= len; k++) v.put(x + Math.round(Math.cos(ang) * k), y + Math.round(Math.sin(ang) * k), z, a % 2 ? "#ffd23f" : "#ff7a3c", 1.0);
      }
      v.put(x, y, z, "white", 1.2);
    };
    const boomerang = (x0: number, x1: number, z: number, y: number, depth: number, col: string) => {
      const mid = (x0 + x1) / 2;
      for (let x = x0; x < x1; x++) {
        const yy = y + Math.round(Math.abs(x - mid) * 0.35);
        v.box(x, yy, z - depth, x + 1, yy + 1, z, col);
      }
    };
    if (lv === 1) {
      P(c, -8, 3, 8, 8);
      disc(v, -1, -1, 1, 6, 4, (x, y, z, d) => (d < 2.8 ? null : y < 3 ? "#7fd1c7" : ["#ffe9b8", 0.6]));
      boomerang(-7, 6, 4, 6, 9, "#ff7a3c");
      star(5, 10, -5, 3);
    } else {
      const big = lv >= 4;
      const [x0, x1] = lv === 2 ? [-7, 7] : [-15, 15];
      const zB = lv <= 3 ? -1 : -4;
      disc(v, lv === 2 ? 0 : -6, zB - 2, 1, 7, lv === 2 ? 5 : 6, (x, y, z, d) => (d < (lv === 2 ? 3.8 : 4.8) ? null : y < 3 ? "#7fd1c7" : ["#ffe9b8", 0.6]));
      boomerang(x0, x1, lv === 2 ? 3 : 4, 7, lv === 2 ? 8 : 10, "#ff7a3c");
      if (big) {
        boomerang(-15, 15, 14, 6, 6, "#7fd1c7");
        for (let i = 0; i < (lv === 5 ? 4 : 3); i++) classicCar(v, -14 + i * 8, 9, "z", ["#d62b35", "#ffd23f", "#2c5ea8", "#7fd1c7"][i]);
        for (let x = -15; x < 15; x += 8) v.box(x, 1, 13, x + 1, 6, 14, "chrome");
      }
      star(lv === 2 ? 5 : 11, lv === 5 ? 24 : big ? 18 : 13, lv === 2 ? -5 : -10, lv === 5 ? 6 : 4);
      neon(v, "DRIVE IN", lv === 2 ? -7 : -15, 11, lv === 2 ? 3 : 4, "#ff7a3c");
      P(c, -16, 4, 16, 16, "asphalt");
      crowd(c, lv + 1, -12, 5, 12, 8);
    }
  } else {
    // Neon Rooftop: big neon letters on scaffolding plus a spinning coffee cup
    const word = ["EAT", "EAT", "DINER", "EAT", "EATS"][lv - 1];
    const sc = lv >= 4 ? 2 : 1;
    const [x0, x1, z0, z1, h] = lv <= 2 ? [-7, 7, -5, 3, 7] : lv === 3 ? [-15, 15, -6, 3, 8] : [-15, 15, -12, 4, 9];
    v.box(x0, 1, z0, x1, h, z1, "#e6e9ee");
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
    for (let x = x0; x < x1; x++) for (const y of [1, 2]) v.put(x, y, z1 - 1, (x + y) % 2 ? "#14b8a6" : "white");
    glassFront(v, x0 + 1, x1 - 1, 3, h - 2, z1 - 1, "chrome", 3, "#ffe9b8");
    v.box(x0, h - 1, z0, x1, h, z1 + 1, "#14b8a6");
    awning(v, x0, x1, h - 2, z1, "#14b8a6", "white");
    const w = neonWidth(word, sc);
    const sx = Math.round(-w / 2), sy = h + 2;
    for (let x = sx; x < sx + w; x += 4) v.box(x, h, z1 - 3, x + 1, sy, z1 - 2, "iron");
    v.box(sx - 1, sy - 1, z1 - 3, sx + w + 1, sy, z1 - 2, "iron");
    neon(v, word, sx, sy, z1 - 2, lv % 2 ? "#ff3fb4" : "#ffd23f", { scale: sc, emit: 1.4 });
    if (lv >= 2) {
      const cup = spinner(c, x1 - 4, h + (lv >= 4 ? 10 : 4), z0 + 3, "y", 1.1);
      const r = lv >= 4 ? 3 : 2;
      for (let y = 0; y < r * 2; y++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > r || (d < r - 1 && y > 0)) continue;
        cup.put(dx, y, dz, y === r * 2 - 1 && d < r - 1 ? "#5b3a1e" : "white");
      }
      for (let y = 1; y < r * 2 - 1; y++) cup.put(r + 1, y, 0, "white");
      cup.put(r + 1, 1, 0, "white");
      for (let k = 1; k <= 3; k++) cup.put(0, r * 2 + k, k % 2, "#e6e6e6", 0.4);
      v.box(x1 - 5, h, z0 + 2, x1 - 3, h + (lv >= 4 ? 10 : 4), z0 + 4, "iron");
    }
    P(c, x0 - 1, z1, x1 + 1, Math.min(16, z1 + 5));
    if (lv >= 4) { classicCar(v, -14, 10, "x", "#ff3fb4"); classicCar(v, 6, 10, "x", "#14b8a6"); }
    crowd(c, lv + 1, x0 + 1, z1 + 1, x1 - 1, Math.min(16, z1 + 4));
  }
}

override(
  "retro_diner",
  buildDiner,
  ["Lunch Car", "Chrome Diner", "Neon Diner", "Boulevard Diner", "All-Night Palace"],
  "A chrome lunch car grows into a full roadside diner: stainless railcars with a clock pylon, a red drum marquee, a Googie drive-in under a starburst, or a rooftop of giant neon letters and a spinning coffee cup.",
);
