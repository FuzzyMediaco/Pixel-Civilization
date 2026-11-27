/**
 * Grand Cinema Theater (Egyptian Revival · Deco Palace · Starlight Drive-In · Projector & Reels)
 * and Late-Night Jazz Club (Music Note · Spinning Trumpet · Rooftop Bandstands · Grand Piano).
 */
import { type Ctx, lamp, person, tree } from "./kit";
import { band, bulbFrame, bulbs, classicCar, crowd, disc, glassFront, neon, neonWidth, palm, sculpt, smooth, spinner, type Fill } from "./commerceKit";
import { override } from "./commerceIcons";

const P = (c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "path") => c.v.box(x0, 0, z0, x1, 1, z1, col);

// =============================================================================================
// CINEMA
// =============================================================================================

/** Battered (inward-sloping) pylon tower with a cavetto cornice. */
function pylon(c: Ctx, x0: number, x1: number, z0: number, z1: number, h: number, wall: string, band2: string): void {
  const { v } = c;
  for (let y = 1; y < h; y++) {
    const k = Math.floor((y - 1) / 5);
    v.box(x0 + k, y, z0 + k, x1 - k, y + 1, z1 - k, y % 6 === 0 ? band2 : wall);
  }
  const k = Math.floor((h - 2) / 5);
  v.box(x0 + k - 1, h, z0 + k - 1, x1 - k + 1, h + 1, z1 - k + 1, band2);
  v.box(x0 + k - 2, h + 1, z0 + k - 2, x1 - k + 2, h + 2, z1 - k + 2, wall);
  // hieroglyph panel
  for (let y = 4; y < h - 3; y += 2) for (let x = x0 + k + 1; x < x1 - k - 1; x += 2) if ((x * 3 + y * 7) % 5 < 2) v.put(x, y, z1 - Math.floor((y - 1) / 5), ["#1f4e79", "#b4232c", "#2f6b45"][(x + y) % 3]);
}

function papyrus(c: Ctx, x: number, z: number, h: number): void {
  const { v } = c;
  v.box(x, 1, z, x + 2, h - 2, z + 2, "#e7cf9a");
  for (let y = 3; y < h - 2; y += 4) v.box(x, y, z, x + 2, y + 1, z + 2, "#b4232c");
  v.box(x - 1, h - 2, z - 1, x + 3, h - 1, z + 3, "#2f6b45");
  v.box(x - 1, h - 1, z - 1, x + 3, h, z + 3, "#e8b93a");
}

function sunDisk(c: Ctx, cx: number, y: number, z: number, span: number): void {
  const { v } = c;
  disc(v, cx, z - 1, y - 1, y + 2, 2, "#e8b93a");
  for (let i = 3; i < span; i++) {
    const droop = Math.floor(i / 5);
    for (const sgn of [-1, 1]) {
      v.put(cx + sgn * i, y + 1 - droop, z, i % 2 ? "#1f4e79" : "#35a0c8");
      v.put(cx + sgn * i, y - droop, z, "#b4232c");
    }
  }
}

function sphinx(c: Ctx, x: number, z: number, facing: 1 | -1): void {
  // lying lion body along z with a headdressed head toward the street
  sculpt(c.v, x, 1, z, x + 4, 7, z + 10, (u, h, w) => {
    const head = w > 0.7;
    if (head) return h > 0.95 ? null : h > 0.55 ? (Math.floor(h * 10) % 2 ? "#1f4e79" : "#e8b93a") : "#d9b77a";
    return h < 0.5 ? "#d9b77a" : null;
  });
  void facing;
}

function obelisk(c: Ctx, x: number, z: number, h: number): void {
  for (let y = 1; y < h; y++) {
    const r = y < h - 3 ? (y < h / 2 ? 1 : 1) : 0;
    c.v.box(x - r, y, z - r, x + r + 1, y + 1, z + r + 1, y >= h - 3 ? "#e8b93a" : "#d9b77a");
  }
}

/** A movie screen showing a sunset over mountains. */
function screenPic(u: number, h: number): Fill {
  const mount = 0.25 + 0.18 * Math.abs(Math.sin(u * 7)) + 0.08 * Math.sin(u * 19);
  if (h < mount) return ["#3b2f5c", 0.5];
  if (Math.hypot(u - 0.66, h - 0.48) < 0.1) return ["#ffd166", 1.2];
  return [h < 0.5 ? "#ff8c61" : h < 0.75 ? "#e85d75" : "#6c4ab6", 0.9];
}

function buildCinema(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  if (s === 0) {
    // Egyptian Revival
    const wall = "#d9b77a", band2 = "#1f4e79";
    const [x0, x1, z0, z1] = lv === 1 ? [-15, 15, -7, 3] : lv === 2 ? [-15, 15, -15, 6] : lv === 3 ? [-22, 22, -15, 6] : [-22, 22, -22, 6];
    const H = [10, 13, 16, 18, 22][lv - 1];
    // auditorium hall
    v.box(x0 + 3, 1, z0, x1 - 3, H - 2, z1 - 3, "#c9a46a");
    v.box(x0 + 3, H - 3, z0, x1 - 3, H - 2, z1 - 3, band2);
    // pylon towers flank the entrance
    const tw = lv === 1 ? 7 : lv === 2 ? 8 : 10;
    pylon(c, x0, x0 + tw, z1 - 6, z1, H + (lv >= 3 ? 4 : 2), wall, band2);
    pylon(c, x1 - tw, x1, z1 - 6, z1, H + (lv >= 3 ? 4 : 2), wall, band2);
    // portico with papyrus columns, winged sun disk and marquee
    const cols = lv === 1 ? [-3, 1] : lv === 2 ? [-6, -2, 2, 6].slice(0, 4) : [-9, -5, -1, 3, 7];
    for (const x of cols) papyrus(c, x, z1 - 2, H);
    v.box(x0 + tw, H, z1 - 4, x1 - tw, H + 2, z1 + 1, wall);
    sunDisk(c, 0, H + 1, z1 + 1, Math.min(10, (x1 - x0 - 2 * tw) / 2));
    // marquee
    const mw = lv === 1 ? 12 : 18;
    v.box(-mw / 2, 6, z1 + 1, mw / 2, 9, z1 + 4, "#1b1b1f");
    bulbFrame(v, -mw / 2, mw / 2, 6, 9, z1 + 4);
    neon(v, lv === 1 ? "FILM" : "CINEMA", -Math.floor(neonWidth(lv === 1 ? "FILM" : "CINEMA") / 2), 9, z1 + 3, "#ffd27a");
    glassFront(v, -mw / 2 + 1, mw / 2 - 1, 1, 5, z1 - 1, "#e8b93a", 3, "#ffd9a0");
    if (lv >= 3) {
      // vertical blade sign
      const bx = x1 - tw + 2;
      v.box(bx, H, z1, bx + 3, H + 38 - (lv === 3 ? 10 : 0), z1 + 2, "#1b1b1f");
      neon(v, lv === 3 ? "NILE" : "CINEMA", bx, H + 2, z1 + 2, "#ffd27a", { vertical: true, emit: 1.4 });
    }
    P(c, -24, z1, 24, Math.min(lv >= 4 ? 24 : 16, z1 + 18), "#e7cf9a");
    if (lv >= 4) { sphinx(c, -12, z1 + 4, 1); sphinx(c, 8, z1 + 4, -1); }
    if (lv === 5) { obelisk(c, -20, 18, 22); obelisk(c, 19, 18, 22); palm(v, -16, 20); palm(v, 14, 20); v.box(-6, 0, 16, 6, 1, 22, "water"); }
    crowd(c, 3 + lv * 2, -14, z1 + 4, 14, Math.min(lv >= 4 ? 23 : 15, z1 + 10));
  } else if (s === 1) {
    // Deco Palace: setback tower, chaser-bulb marquee, blade sign
    const cream = "#efe3c8", teal = "#1a7f7a", gold = "#e8b93a";
    const [x0, x1, z0, z1] = lv === 1 ? [-15, 15, -7, 4] : lv === 2 ? [-15, 15, -15, 6] : lv === 3 ? [-22, 22, -15, 6] : [-22, 22, -22, 6];
    const H = [9, 12, 14, 16, 18][lv - 1];
    v.box(x0 + 1, 1, z0, x1 - 1, H, z1 - 2, cream);
    for (let x = x0 + 2; x < x1 - 1; x += 3) v.box(x, 2, z1 - 2, x + 1, H - 1, z1 - 1, teal);
    v.box(x0 + 1, H - 1, z0, x1 - 1, H, z1 - 1, gold);
    // stepped central tower
    const steps = Math.min(lv + 1, 5);
    let y = H, half = lv === 1 ? 6 : 9;
    for (let i = 0; i < steps && half > 1; i++) {
      v.box(-half, y, z1 - 6 - i, half, y + 5, z1 - 1 - i, i % 2 ? teal : cream);
      for (let x = -half + 1; x < half; x += 2) v.box(x, y + 1, z1 - 1 - i, x + 1, y + 4, z1 - i, gold, 0.4);
      y += 5;
      half -= 2;
    }
    v.box(-1, y, z1 - 4, 1, y + 4, z1 - 2, gold, 0.6);
    // triangular marquee
    for (let k = 0; k < 4; k++) {
      v.box(-12 + k * 2, 6 + k, z1 - 1, 12 - k * 2, 7 + k, z1 + 5 - k, k === 0 ? "#1b1b1f" : "#b4232c");
      for (let x = -12 + k * 2; x < 12 - k * 2; x++) v.put(x, 6 + k, z1 + 5 - k, (x + k) % 2 ? "#fff3b0" : "#ffd23f", 1.2);
    }
    neon(v, "DELUXE", -11, 2, z1 + 4, "#ffd23f", { emit: 1 });
    glassFront(v, -9, 9, 1, 5, z1 - 1, gold, 3, "#ffd9a0");
    if (lv >= 2) {
      const word = lv === 2 ? "BIJOU" : "ROYAL";
      v.box(x1 - 7, H, z1 - 1, x1 - 4, H + word.length * 6 + 3, z1 + 1, teal);
      neon(v, word, x1 - 7, H + 2, z1 + 1, "#ff3b4e", { vertical: true, emit: 1.4 });
    }
    P(c, -24, z1, 24, Math.min(lv >= 4 ? 24 : 16, z1 + 14), "#d8d2c4");
    if (lv >= 3) for (let x = -18; x <= 18; x += 6) v.put(x, 0, z1 + 3, "#e8b93a", 0.6); // sidewalk stars
    if (lv === 5) for (const x of [-20, 20]) { v.box(x, 1, 18, x + 2, 3, 20, "#3a3a44"); for (let k = 0; k < 18; k++) v.put(x + (x < 0 ? Math.floor(k / 3) : -Math.floor(k / 3)), 3 + k, 19 - Math.floor(k / 4), "#fff6c9", 0.9); }
    crowd(c, 3 + lv * 2, -16, z1 + 5, 16, Math.min(lv >= 4 ? 23 : 15, z1 + 10));
  } else if (s === 2) {
    // Starlight Drive-In
    const screens = lv >= 4 ? 2 : 1;
    const sw = [14, 20, 26, 22, 22][lv - 1];
    const sh = [8, 11, 14, 13, 16][lv - 1];
    const zs = lv <= 1 ? -6 : lv === 2 ? -13 : -13;
    P(c, -24, -24, 24, 24, "asphaltDark");
    const centers = screens === 1 ? [0] : lv === 4 ? [-12, 12] : [-12, 12];
    centers.forEach((cx, si) => {
      const x0 = Math.round(cx - sw / 2), x1 = x0 + sw;
      for (const x of [x0 + 1, x1 - 2]) v.box(x, 1, zs - 2, x + 1, 4 + sh, zs, "woodDark");
      v.box(x0 - 1, 3, zs, x1 + 1, 4 + sh, zs + 1, "#f2f2f2");
      for (let x = x0; x < x1; x++) for (let y = 4; y < 3 + sh; y++) {
        const f = screenPic((x - x0) / sw + si * 0.3, (y - 4) / (sh - 1));
        if (f && typeof f !== "string") v.put(x, y, zs + 1, f[0], f[1]);
      }
      // rows of cars and speaker posts
      const rows = lv === 1 ? 1 : lv <= 3 ? 2 : 2;
      for (let r = 0; r < rows; r++) for (let k = 0; k < Math.floor(sw / 7); k++) {
        const x = x0 + 1 + k * 7, z = zs + 6 + r * 8;
        classicCar(v, x, z, "z", ["#d62b35", "#7fd1c7", "#ffd23f", "#2c5ea8", "#f28aa0"][(k + r + si) % 5]);
        v.box(x + 4, 1, z + 2, x + 5, 3, z + 3, "iron");
      }
    });
    // snack bar
    const sz = lv === 1 ? 5 : 14;
    disc(v, 0, sz, 1, 6, lv === 1 ? 3 : 5, (x, y, z, d) => (d < (lv === 1 ? 1.8 : 3.8) && y < 5 ? null : y >= 5 ? "#ff7a3c" : y < 2 ? "#f2f2f2" : ["#ffe9b8", 0.6]));
    if (lv >= 3) {
      // entrance sign with bulb arrow
      v.box(20, 1, 18, 21, 14, 19, "iron");
      v.box(15, 14, 18, 23, 19, 19, "#1b1b1f");
      neon(v, "STARS", 15, 14, 19, "#ffd23f", { emit: 1.2 });
      bulbs(v, 14, 20, 23, 20, 12);
    }
  } else {
    // Projector & Reels
    const body = "#3a3d46", trim = "#c9ced6";
    const sizes: [number, number, number, number, number][] = [
      [-10, 6, -5, 4, 8], [-12, 8, -10, 6, 12], [-16, 10, -10, 8, 15], [-18, 10, -14, 10, 18], [-20, 12, -16, 12, 22],
    ];
    const [x0, x1, z0, z1, H] = sizes[lv - 1];
    sculpt(v, x0, 1, z0, x1, H, z1, (u, h, w) => {
      const edge = Math.min(u, 1 - u, w, 1 - w, 1 - h);
      if (edge < 0.04 && h > 0.85) return null;
      if (Math.abs(h - 0.32) < 0.06) return Math.floor(u * (x1 - x0)) % 3 === 0 ? "white" : "#14141a"; // film strip band
      if (h < 0.1) return "#14141a";
      return h > 0.9 ? trim : body;
    });
    // lens barrel toward +x with a light beam
    const ly = Math.round(H * 0.62), lz = Math.round((z0 + z1) / 2);
    const lr = Math.max(2, Math.round(H / 6));
    for (let x = x1; x < x1 + 4; x++) for (let dy = -lr; dy <= lr; dy++) for (let dz = -lr; dz <= lr; dz++) {
      const d = Math.hypot(dy, dz);
      if (d <= lr) v.put(x, ly + dy, lz + dz, x === x1 + 3 && d < lr - 0.5 ? "#fff6c9" : trim, x === x1 + 3 ? 1.4 : 0);
    }
    for (let x = x1 + 4; x < 24; x++) {
      const r = lr + (x - x1 - 4) * 0.25;
      for (let dy = -r; dy <= r; dy += 1) for (let dz = -r; dz <= r; dz += 1) {
        if (Math.abs(Math.hypot(dy, dz) - r) < 0.6 && (x + Math.round(dy) + Math.round(dz)) % 3 === 0) v.put(x, Math.round(ly + dy), Math.round(lz + dz), "#fff6c9", 0.9);
      }
    }
    // two spinning reels on top (spin about z)
    const rr = Math.max(3, Math.round((x1 - x0) / 5));
    [x0 + rr + 1, x1 - rr - 2].forEach((rx, i) => {
      v.box(rx, H, lz, rx + 1, H + 2, lz + 1, trim);
      const reel = spinner(c, rx + 0.5, H + 2 + rr, lz + 0.5, "z", i ? -1.2 : 1.2);
      for (let dx = -rr; dx <= rr; dx++) for (let dy = -rr; dy <= rr; dy++) {
        const d = Math.hypot(dx, dy);
        if (d > rr + 0.3) continue;
        const ang = Math.atan2(dy, dx);
        const spoke = d < 1.2 || d > rr - 1 || Math.abs(Math.sin(ang * 3)) < 0.25;
        if (spoke) for (const dz of [-1, 0]) reel.put(dx, dy, dz, d < 1.2 ? "#e8b93a" : "#c9ced6");
        else if (d > rr - 2.5) reel.put(dx, dy, 0, "#14141a");
      }
    });
    // entrance and marquee
    glassFront(v, -6, 4, 1, 6, z1 - 1, "#e8b93a", 3, "#ffd9a0");
    v.box(-8, 6, z1, 6, 9, z1 + 3, "#14141a");
    bulbFrame(v, -8, 6, 6, 9, z1 + 3);
    neon(v, "REEL", -5, 9, z1 + 2, "#ffd27a");
    P(c, -24, z1, 24, Math.min(lv >= 4 ? 24 : 16, z1 + 10));
    crowd(c, 2 + lv * 2, -16, z1 + 4, 14, Math.min(lv >= 4 ? 23 : 15, z1 + 9));
  }
}

override(
  "cinema_theater",
  buildCinema,
  ["Nickelodeon", "Picture House", "Movie Palace", "Grand Movie Palace", "Legendary Movie House"],
  "A nickelodeon grows into a legendary movie house: an Egyptian Revival temple with papyrus columns and a blade sign, a Deco palace with a chaser-bulb marquee, a starlit drive-in, or a giant projector with spinning reels.",
);

// =============================================================================================
// JAZZ CLUB
// =============================================================================================

/** Eighth note: oval head room, stem tower and flag. */
function note(c: Ctx, cx: number, cz: number, y0: number, s: number, flag = true, glow = "#ff4fa3"): number {
  const { v } = c;
  const rx = 3 * s, ry = 2 * s, rz = 2.2 * s;
  sculpt(v, Math.floor(cx - rx), y0, Math.floor(cz - rz), Math.ceil(cx + rx), y0 + 2 * ry, Math.ceil(cz + rz), (u, h, w) => {
    const X = (u - 0.5) * 2, Y = (h - 0.5) * 2, Z = (w - 0.5) * 2;
    const Xr = X * 0.9 + Y * 0.35, Yr = Y * 0.9 - X * 0.35;
    if (Xr * Xr + Yr * Yr + Z * Z > 1) return null;
    return Math.abs(Yr) < 0.12 && s >= 2 ? [glow, 0.9] : "#16161c";
  });
  const sx = Math.round(cx + rx - 1), top = y0 + ry + 9 * s;
  v.box(sx, y0 + ry, Math.round(cz), sx + Math.max(1, Math.round(s * 0.8)), top, Math.round(cz) + Math.max(1, Math.round(s * 0.8)), "#16161c");
  if (flag) for (let i = 0; i < 4 * s; i++) v.box(sx + Math.round(i * 0.6), top - i, Math.round(cz), sx + Math.round(i * 0.6) + Math.max(1, s), top - i + 1, Math.round(cz) + Math.max(1, Math.round(s * 0.8)), i % 3 === 0 ? glow : "#16161c", i % 3 === 0 ? 0.9 : 0);
  return top;
}

/** Trumpet rotor along x, bell at +x. */
function trumpet(c: Ctx, x: number, y: number, z: number, L: number, speed = 0.9): void {
  const t = spinner(c, x, y, z, "y", speed);
  const brass = "#e8b93a", shade = "#c99a24";
  for (let i = 0; i < L; i++) {
    const k = i / L;
    const r = k > 0.72 ? 0.6 + Math.pow((k - 0.72) / 0.28, 2) * (L / 7) : 0.6;
    const R = Math.round(r);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dy, dz);
      if (d > r + 0.2 || (R > 1 && d < r - 1.1 && i === L - 1 ? false : R > 1 && d < r - 1.1)) continue;
      t.put(i - Math.floor(L / 2), dy, dz, k > 0.98 && d < r - 0.8 ? "#3a2a10" : brass);
    }
  }
  // tubing loop and valves
  for (let i = Math.floor(L * 0.25); i < Math.floor(L * 0.65); i++) t.put(i - Math.floor(L / 2), -2, 0, shade);
  t.put(Math.floor(L * 0.25) - Math.floor(L / 2), -1, 0, shade);
  for (const k of [0.38, 0.46, 0.54]) for (let dy = 0; dy < 3; dy++) t.put(Math.floor(L * k) - Math.floor(L / 2), dy, 0, dy === 2 ? "white" : shade);
  t.put(-Math.floor(L / 2) - 1, 0, 0, "#c0c0c0");
}

/** Grand piano with raised lid, keyboard at +z. */
function piano(c: Ctx, x0: number, x1: number, z0: number, z1: number, H: number): void {
  const { v } = c;
  const W = x1 - x0, D = z1 - z0;
  const inPlan = (x: number, z: number) => {
    const u = (x + 0.5 - x0) / W, w = (z + 0.5 - z0) / D; // w=1 keyboard
    if (u < 0 || u > 1 || w < 0 || w > 1) return false;
    if (w > 0.55) return true;
    const curve = 0.35 + 0.65 * Math.pow(w / 0.55, 0.7) * (1 - 0.35 * Math.sin(Math.min(1, (0.55 - w) / 0.55) * Math.PI));
    return u < Math.min(1, curve);
  };
  const legH = Math.max(2, Math.round(H * 0.35));
  for (const [lx, lz] of [[x0 + 1, z1 - 2], [x1 - 2, z1 - 2], [x0 + 2, z0 + 2]]) v.box(lx, 1, lz, lx + 1, legH, lz + 1, "#16161c");
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
    if (!inPlan(x, z)) continue;
    const edge = !inPlan(x - 1, z) || !inPlan(x + 1, z) || !inPlan(x, z - 1) || !inPlan(x, z + 1);
    for (let y = legH; y < H; y++) if (edge || y === legH || y === H - 1) v.put(x, y, z, y === H - 1 && !edge ? "#7a1f2b" : "#16161c");
  }
  // keyboard ledge
  for (let x = x0 + 1; x < x1 - 1; x++) {
    v.put(x, legH + 1, z1, x % 3 === 1 ? "#16161c" : "#f7f3ea");
    v.put(x, legH, z1, "#16161c");
  }
  // raised lid hinged on the -x side, propped by a stick
  const lift = Math.max(3, Math.round(W * 0.45));
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1 - 2; z++) {
    if (!inPlan(x, z)) continue;
    const y = H + Math.round(((x - x0) / W) * lift);
    v.put(x, y, z, "#22222a");
  }
  v.box(x1 - Math.round(W * 0.3), H, Math.round((z0 + z1) / 2), x1 - Math.round(W * 0.3) + 1, H + Math.round(lift * 0.65), Math.round((z0 + z1) / 2) + 1, "#e8b93a");
}

function buildJazz(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const club = (x0: number, z0: number, x1: number, z1: number, h: number, wall: string, sign: string, col: string) => {
    v.box(x0, 1, z0, x1, h, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, h - 1, z1 - 1);
    glassFront(v, x0 + 1, x1 - 1, 2, Math.min(h - 1, 5), z1 - 1, "#e8b93a", 3, "#ff9ec4");
    v.box(Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, Math.floor((x0 + x1) / 2) + 1, 4, z1, "#3a0d1e");
    v.box(x0, h - 1, z0, x1, h, z1 + 1, "#e8b93a");
    const w = neonWidth(sign);
    if (w < x1 - x0) neon(v, sign, Math.round((x0 + x1) / 2 - w / 2), h - 6 > 5 ? h - 6 : 6, z1, col);
  };
  if (s === 0) {
    // Music Note
    if (lv === 1) { P(c, -8, 4, 8, 8); club(-6, -5, 6, 4, 7, "#2a1a3a", "JAZZ", "#ff4fa3"); note(c, -1, -1, 7, 1); }
    else if (lv === 2) { P(c, -8, 4, 8, 8); club(-7, -6, 7, 4, 11, "#3a0d1e", "JAZZ", "#ffd23f"); note(c, -2, -2, 11, 1.5 as number); }
    else if (lv === 3) {
      P(c, -16, 4, 16, 8);
      note(c, -6, -1, 1, 3);
      club(4, -6, 15, 4, 8, "#2a1a3a", "JAZZ", "#ff4fa3");
      v.box(-6, 4, 4, -2, 7, 5, "#ffd9a0", 0.9);
      crowd(c, 4, -14, 5, 14, 8);
    } else {
      P(c, -16, -16, 16, 16, "#2a2a33");
      const s2 = lv === 5 ? 3 : 2.5;
      const t1 = note(c, -9, 2, 1, s2, false, "#ff4fa3");
      const t2 = note(c, 6, -6, lv === 5 ? 6 : 4, s2, false, "#7df9ff");
      // beam = rooftop lounge bridge between the stems
      const xs = Math.round(-9 + 3 * s2 - 1), xe = Math.round(6 + 3 * s2 - 1);
      for (let x = xs; x <= xe + 1; x++) {
        const t = (x - xs) / (xe - xs);
        const y = Math.round(t1 + (t2 - t1) * t);
        const z = Math.round(2 + (-6 - 2) * t);
        v.box(x, y - 2, z - 1, x + 1, y + 1, z + 3, "#16161c");
        v.put(x, y + 1, z + 1, "#ffd23f", 1.0);
      }
      if (lv === 5) for (let i = 0; i < 5; i++) for (let x = -15; x < 15; x++) if ((x + i) % 2 === 0) v.put(x, 0, 9 + i, "#ffd23f", 0.6); // glowing staff lines
      crowd(c, 8, -14, 10, 14, 16);
      band(v, -2, 13, 1);
    }
  } else if (s === 1) {
    // Spinning Trumpet; the club itself becomes a brass horn with a walk-in bell
    if (lv <= 2) {
      P(c, -8, 4, 8, 8);
      club(-7, -6, 7, 4, lv === 1 ? 7 : 11, lv === 1 ? "#1d1d2b" : "#3a0d1e", "JAZZ", "#ffd23f");
      v.box(-1, lv === 1 ? 7 : 11, -2, 0, (lv === 1 ? 7 : 11) + 3, -1, "iron");
      trumpet(c, -0.5, (lv === 1 ? 7 : 11) + 4, -1.5, lv === 1 ? 10 : 14);
    } else {
      const big = lv === 5;
      const z1 = lv === 3 ? 7 : 15;
      const L = lv === 3 ? 12 : big ? 26 : 20;
      const R = lv === 3 ? 6 : big ? 13 : 10;
      // low dark room at the back opening into a flared horn bell facing the street
      v.box(-14, 1, -15 + (lv === 3 ? 8 : 0), 14, 7, -15 + (lv === 3 ? 8 : 0) + 6, "#16161c");
      const zb = z1 - L;
      for (let z = zb; z < z1; z++) {
        const k = (z - zb) / L;
        const r = 2 + Math.pow(k, 2.4) * (R - 2);
        const cy = 1 + r;
        for (let x = Math.floor(-r - 1); x <= Math.ceil(r + 1); x++) for (let y = 1; y < cy + r + 1; y++) {
          const d = Math.hypot(x, y - cy);
          if (d > r || d < r - 1.3) continue;
          v.put(x, y, z, z === z1 - 1 ? "#f2cf5b" : "#e8b93a");
        }
        if (z === z1 - 1) for (let x = Math.floor(-r + 1); x < r - 1; x++) v.put(x, 1, z, "#3a0d1e");
      }
      for (let z = zb; z < z1 - 1; z++) v.put(0, 1, z, "#ff4fa3", 0.8); // glowing walkway into the bell
      const top = lv === 3 ? 14 : big ? 30 : 24;
      v.box(-11, 7, -10, -10, top, -9, "iron");
      trumpet(c, -10.5, top + 1, -9.5, big ? 22 : 16, 0.8);
      crowd(c, 4 + lv, -14, z1 - 2, 14, Math.min(16, z1 + 1));
      if (lv >= 4) band(v, 9, -12, 7);
    }
  } else if (s === 2) {
    // Rooftop Bandstands: every level adds a tier, every tier has a band
    const tiers = lv;
    const W = lv <= 2 ? 14 : 30, D = lv <= 3 ? 12 : 28;
    const x0 = -Math.floor(W / 2), z0 = lv <= 3 ? -7 : -14;
    const cols = ["#3a0d1e", "#1d1d2b", "#2a1a3a", "#0f2a3a", "#3a2a0d"];
    const neonC = ["#ff4fa3", "#7df9ff", "#ffd23f", "#b38cff", "#4cd47a"];
    let y = 1;
    for (let i = 0; i < tiers; i++) {
      const step = lv <= 2 ? 3 : 4;
      const tx0 = x0 + i * (lv >= 4 ? 2 : 1), tx1 = x0 + W - i * (lv >= 4 ? 2 : 1);
      const tz0 = z0, tz1 = z0 + D - i * step;
      const h = 5;
      v.box(tx0, y, tz0, tx1, y + h, tz1, cols[i % 5]);
      glassFront(v, tx0 + 1, tx1 - 1, y + 1, y + h - 1, tz1 - 1, neonC[i % 5], 3, "#ffc9e3");
      v.box(tx0, y + h - 1, tz1 - 1, tx1, y + h, tz1, neonC[i % 5], 0.9);
      y += h;
      // band at the front of this tier's roof
      const bz = tz0 + D - (i + 1) * step - 3;
      band(v, Math.round((tx0 + tx1) / 2) - 1, Math.max(tz0 + 2, i === tiers - 1 ? Math.round((tz0 + tz1) / 2) : bz + 1), y, i % 2 ? "#c0c0c0" : "#e8b93a");
      bulbs(v, tx0, tz1 - 1, tx1 - 1, tz1 - 1, y + 3, [neonC[i % 5], "#ffffff"]);
    }
    if (lv >= 2) neon(v, "JAZZ", x0 + 1, 2, z0 + D, "#ff4fa3");
    P(c, -16, z0 + D, 16, 16);
    crowd(c, 2 + lv, x0, z0 + D + 1, x0 + W, Math.min(16, z0 + D + 4));
  } else {
    // Grand Piano
    if (lv === 1) {
      P(c, -8, 3, 8, 8);
      // upright piano kiosk
      v.box(-6, 1, -3, 6, 12, 2, "#16161c");
      v.box(-6, 5, 2, 6, 6, 4, "#16161c");
      for (let x = -5; x < 5; x++) v.put(x, 6, 3, x % 3 === 1 ? "#16161c" : "#f7f3ea");
      v.box(-4, 8, 2, 4, 11, 3, "#ffc9e3", 0.6);
      person(v, 0, 1, 5, "black", "black", "#8d5a3b");
    } else {
      const [x0, x1, z0, z1, H] = lv === 2 ? [-7, 7, -7, 4, 8] : lv === 3 ? [-15, 13, -7, 5, 10] : lv === 4 ? [-15, 9, -15, 8, 13] : [-15, 15, -15, 10, 16];
      piano(c, x0, x1, z0, z1, H);
      // the lit club sits between the legs
      glassFront(v, x0 + 2, x1 - 2, 1, Math.max(2, Math.round(H * 0.35)), z1 - 2, "#e8b93a", 3, "#ffc9e3");
      if (lv >= 4) band(v, Math.round((x0 + x1) / 2) - 2, Math.round((z0 + z1) / 2) + 2, H);
      if (lv === 4) { v.box(11, 1, -4, 16, 5, 6, "#16161c"); v.box(11, 5, -4, 16, 6, 6, "#7a1f2b"); }
      P(c, -16, z1, 16, Math.min(16, z1 + 6));
      crowd(c, 2 + lv, -14, z1 + 1, 14, Math.min(16, z1 + 5));
    }
  }
}

override(
  "jazz_club",
  buildJazz,
  ["Cellar Stage", "Velvet Lounge", "Jazz Club", "Music Hall", "Grand Supper Club"],
  "A cellar stage grows into a landmark you can hear: giant beamed music notes, a brass horn with a walk-in bell and a spinning trumpet, a terrace stack with a band on every roof, or a grand piano with its lid raised.",
);
