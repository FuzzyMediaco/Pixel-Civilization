import {
  type Ctx,
  PixelVox,
  bush,
  car,
  chimney,
  door,
  fence,
  flag,
  flowerBed,
  gable,
  hip,
  lamp,
  lot,
  person,
  speckle,
  tree,
  truck,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";
import type { CritterKind } from "./kit";

// =============================================================================================
// Shared rural / nature helpers (also imported by nature.ts)
// =============================================================================================

/** integer hash → [0,1) */
export function h2(x: number, z: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((s | 0) + 1013, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** smooth value noise in [0,1) */
export function vnoise(x: number, z: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = h2(x0, z0, seed);
  const b = h2(x0 + 1, z0, seed);
  const cc = h2(x0, z0 + 1, seed);
  const d = h2(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sz) + (cc + (d - cc) * sx) * sz;
}

/**
 * Natural-shoreline water body drawn in the ground layer. Returns an `inside(x,z)` test.
 * d<0.45 → deep water, then water, then a shore ring of `shore` colour.
 */
export function waterBlob(c: Ctx, cx: number, cz: number, rx: number, rz: number, seed: number, shore = "sand", wobble = 0.55, deepCol = "waterDeep", col = "water"): (x: number, z: number) => boolean {
  const v = c.v;
  const dist = (x: number, z: number) => Math.sqrt(((x + 0.5 - cx) / rx) ** 2 + ((z + 0.5 - cz) / rz) ** 2) - (vnoise(x, z, 4, seed) - 0.5) * wobble;
  const x0 = Math.floor(cx - rx * 1.6) - 2;
  const x1 = Math.ceil(cx + rx * 1.6) + 2;
  const z0 = Math.floor(cz - rz * 1.6) - 2;
  const z1 = Math.ceil(cz + rz * 1.6) + 2;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (x < -c.hx || x >= c.hx || z < -c.hz || z >= c.hz) continue;
    const d = dist(x, z);
    if (d <= 1) v.put(x, 0, z, d < 0.5 ? deepCol : col, 0.1);
    else if (d <= 1 + 1.6 / Math.min(rx, rz) && shore) v.put(x, 0, z, shore);
  }
  return (x, z) => dist(x, z) <= 1;
}

/**
 * Heightfield terrain: H(x,z) = top voxel y of each column (<=0 → ground only).
 * Only the visible shell of each column is filled (cheap even for big mountains).
 * paint(x, y, z, h, top) returns the colour of a voxel (top = topmost voxel of its column).
 */
export function terrain(
  c: Ctx,
  H: (x: number, z: number) => number,
  paint: (x: number, y: number, z: number, h: number, top: boolean) => string | null,
  emit?: (x: number, y: number, z: number) => number,
): (x: number, z: number) => number {
  const { hx, hz, v } = c;
  const W = hx * 2;
  const D = hz * 2;
  const hm = new Int16Array(W * D);
  for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) hm[(x + hx) * D + (z + hz)] = Math.max(0, Math.round(H(x, z)));
  const get = (x: number, z: number) => (x < -hx || x >= hx || z < -hz || z >= hz ? 0 : hm[(x + hx) * D + (z + hz)]);
  for (let x = -hx; x < hx; x++) {
    for (let z = -hz; z < hz; z++) {
      const h = get(x, z);
      if (h <= 0) continue;
      const lo = Math.min(h, get(x - 1, z) + 1, get(x + 1, z) + 1, get(x, z - 1) + 1, get(x, z + 1) + 1);
      for (let y = Math.max(1, lo); y <= h; y++) {
        const col = paint(x, y, z, h, y === h);
        if (col) v.put(x, y, z, col, emit ? emit(x, y, z) : 0);
      }
    }
  }
  return get;
}

/** Local oriented drawing frame (a = along/forward, b = up, w = across). */
export function frame(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z", dir: 1 | -1) {
  const put = (a: number, b: number, w: number, col: string, e = 0) => {
    const aa = dir * a;
    const ww = dir * w;
    if (axis === "x") v.put(x + aa, y + b, z + ww, col, e);
    else v.put(x - ww, y + b, z + aa, col, e);
  };
  const box = (a0: number, b0: number, w0: number, a1: number, b1: number, w1: number, col: string, e = 0) => {
    for (let a = a0; a < a1; a++) for (let b = b0; b < b1; b++) for (let w = w0; w < w1; w++) put(a, b, w, col, e);
  };
  return { put, box };
}

// ---------------------------------------------------------------------------------------------
// Critters (tiny voxel animals). All face +a along their axis.
// ---------------------------------------------------------------------------------------------
export type Critter = "cow" | "sheep" | "pig" | "chicken" | "duck" | "horse" | "goat" | "donkey" | "camel" | "heron" | "frog" | "bunny";

export function critter(v: PixelVox, kind: Critter, x: number, y: number, z: number, axis: "x" | "z" = "x", dir: 1 | -1 = 1, seed = 0): void {
  const f = frame(v, x, y, z, axis, dir);
  const { put, box } = f;
  switch (kind) {
    case "cow": {
      const body = seed % 3 === 2 ? "#8a5a3a" : "white";
      const spot = seed % 3 === 2 ? "white" : "black";
      for (const [a, w] of [[0, 0], [0, 1], [3, 0], [3, 1]]) put(a, 0, w, "charcoal");
      box(0, 1, 0, 4, 3, 2, body);
      put(1, 2, 0, spot); put(2, 1, 1, spot); put(3, 2, 1, spot); put(1, 1, 1, spot);
      box(4, 2, 0, 5, 4, 2, body);
      put(5, 2, 0, "pink"); put(5, 2, 1, "pink");
      put(4, 3, 0, "black"); put(4, 3, 1, "black");
      put(4, 4, 0, "cream"); put(4, 4, 1, "cream");
      put(-1, 2, 0, spot);
      put(2, 0, 0, "pink");
      break;
    }
    case "sheep": {
      const wool = seed % 4 === 3 ? "#5a5048" : "white";
      for (const [a, w] of [[0, 0], [0, 1], [2, 0], [2, 1]]) put(a, 0, w, "charcoal");
      box(0, 1, 0, 3, 3, 2, wool);
      put(1, 3, 0, wool); put(1, 3, 1, wool);
      box(3, 2, 0, 4, 3, 2, "charcoal");
      put(3, 1, 0, "charcoal");
      break;
    }
    case "goat": {
      for (const [a, w] of [[0, 0], [2, 0]]) put(a, 0, w, "charcoal");
      box(0, 1, 0, 3, 2, 1, "#e9e2d2");
      put(3, 2, 0, "#e9e2d2"); put(3, 3, 0, "#c8b8a0"); put(4, 2, 0, "#e9e2d2");
      put(-1, 2, 0, "#e9e2d2");
      break;
    }
    case "pig": {
      const pk = "#f4a3bb";
      for (const [a, w] of [[0, 0], [0, 1], [2, 0], [2, 1]]) put(a, 0, w, "#d97c9a");
      box(0, 1, 0, 3, 3, 2, pk);
      box(3, 1, 0, 4, 2, 2, "#e88aa6");
      put(2, 3, 0, "#e88aa6"); put(2, 3, 1, "#e88aa6");
      put(-1, 2, 0, "#e88aa6");
      if (seed % 2) { put(1, 2, 0, "soilDark"); put(0, 1, 1, "soilDark"); }
      break;
    }
    case "chicken": {
      const col = seed % 3 === 0 ? "#b5652e" : "white";
      put(0, 0, 0, col); put(0, 1, 0, col); put(-1, 1, 0, col);
      put(1, 1, 0, "orange"); put(0, 2, 0, "red");
      break;
    }
    case "duck": {
      put(0, 0, 0, seed % 2 ? "white" : "#9a7a52"); put(-1, 0, 0, seed % 2 ? "white" : "#9a7a52");
      put(0, 1, 0, seed % 2 ? "white" : "leafDark"); put(1, 1, 0, "orange");
      break;
    }
    case "horse":
    case "donkey": {
      const col = kind === "donkey" ? "#8d8378" : seed % 2 ? "#7a4a2a" : "#3c2a20";
      const mane = kind === "donkey" ? "charcoal" : "black";
      for (const [a, w] of [[0, 0], [0, 1], [3, 0], [3, 1]]) { put(a, 0, w, col); put(a, 1, w, col); }
      box(0, 2, 0, 4, 4, 2, col);
      box(4, 3, 0, 5, 6, 2, col);
      put(5, 4, 0, col); put(5, 4, 1, col);
      put(4, 6, 0, mane); put(3, 4, 0, mane); put(3, 4, 1, mane);
      if (kind === "donkey") { put(4, 6, 0, col); put(4, 7, 0, col); put(4, 6, 1, col); put(4, 7, 1, col); }
      put(-1, 3, 0, mane); put(-1, 2, 0, mane);
      break;
    }
    case "camel": {
      const col = "#c9a26a";
      for (const [a, w] of [[0, 0], [0, 1], [3, 0], [3, 1]]) for (let b = 0; b < 3; b++) put(a, b, w, col);
      box(0, 3, 0, 4, 5, 2, col);
      box(1, 5, 0, 3, 6, 2, "#b88c55");
      put(2, 6, 0, "#b88c55");
      box(4, 4, 0, 5, 7, 1, col);
      put(5, 6, 0, col); put(5, 6, 1, col);
      put(1, 6, 1, "red"); // saddle blanket
      break;
    }
    case "heron": {
      put(0, 0, 0, "charcoal"); put(0, 1, 0, "charcoal");
      put(0, 2, 0, "#c9d3dc"); put(-1, 2, 0, "#9aa7b4"); put(0, 3, 0, "#c9d3dc"); put(0, 4, 0, "white"); put(1, 4, 0, "hazard");
      break;
    }
    case "frog": {
      put(0, 0, 0, "lime"); put(1, 0, 0, "lime"); put(1, 1, 0, "leaf");
      break;
    }
    case "bunny": {
      const col = seed % 2 ? "#c9b49a" : "white";
      put(0, 0, 0, col); put(1, 0, 0, col); put(1, 1, 0, col); put(1, 2, 0, col); put(-1, 0, 0, "white");
      break;
    }
  }
}

/** Alligator / crocodile of a given length (>=6). Lies along `axis`, snout towards +dir. */
export function gator(v: PixelVox, x: number, y: number, z: number, len: number, axis: "x" | "z", dir: 1 | -1, skin = "#4f7a3a", belly = "#c9c27a", open = false, eye = "#ffd23a"): void {
  const { put, box } = frame(v, x, y, z, axis, dir);
  const L = Math.max(6, len);
  const tail = Math.round(L * 0.4);
  const bodyL = Math.round(L * 0.35);
  const head = L - tail - bodyL;
  const W = L >= 14 ? 4 : L >= 9 ? 3 : 2;
  const off = W >= 3 ? -Math.floor((W - 1) / 2) : 0;
  // tail tapers
  for (let a = 0; a < tail; a++) {
    const tw = Math.max(1, Math.round((W * (a + 1)) / tail));
    const w0 = off + Math.floor((W - tw) / 2);
    box(a, 0, w0, a + 1, 1, w0 + tw, skin);
    if (a % 2 === 0) put(a, 1, off + Math.floor(W / 2), "#3a5c2c");
  }
  // body
  box(tail, 0, off, tail + bodyL, L >= 12 ? 3 : 2, off + W, skin);
  for (let a = tail; a < tail + bodyL; a += 2) for (let w = off; w < off + W; w += 2) put(a, L >= 12 ? 3 : 2, w, "#3a5c2c");
  box(tail, 0, off - 1, tail + 1, 1, off, skin); box(tail, 0, off + W, tail + 1, 1, off + W + 1, skin);
  box(tail + bodyL - 1, 0, off - 1, tail + bodyL, 1, off, skin); box(tail + bodyL - 1, 0, off + W, tail + bodyL, 1, off + W + 1, skin);
  // head + snout
  const hw = Math.max(2, W - 1);
  const hoff = off + Math.floor((W - hw) / 2);
  const a0 = tail + bodyL;
  box(a0, 0, hoff, a0 + head, 1, hoff + hw, skin);
  if (open) {
    box(a0 + 1, 1, hoff, a0 + head, 2, hoff + hw, "#d9636a");
    box(a0 + 1, 2, hoff, a0 + head, 3, hoff + hw, skin);
    for (let a = a0 + 1; a < a0 + head; a += 1) { put(a, 1, hoff, "white"); put(a, 1, hoff + hw - 1, "white"); }
  } else {
    box(a0, 1, hoff, a0 + 2, 2, hoff + hw, skin);
    for (let a = a0 + 2; a < a0 + head; a += 2) { put(a, 0, hoff - 0, "white"); }
  }
  put(a0 + 1, open ? 3 : 2, hoff, eye, 0.3); put(a0 + 1, open ? 3 : 2, hoff + hw - 1, eye, 0.3);
  put(a0 + head - 1, open ? 3 : 1, hoff, "charcoal");
  void belly;
}

// ---------------------------------------------------------------------------------------------
// Farm props & machines
// ---------------------------------------------------------------------------------------------

export function tractor(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", dir: 1 | -1 = 1, col = "red", trailer?: string): void {
  const { put, box } = frame(v, x, y, z, axis, dir);
  box(0, 0, -2, 2, 3, -1, "rubber"); box(0, 0, 2, 2, 3, 3, "rubber");
  put(0, 1, -2, "hazard"); put(0, 1, 2, "hazard");
  box(4, 0, -2, 5, 2, -1, "rubber"); box(4, 0, 2, 5, 2, 3, "rubber");
  box(0, 1, -1, 6, 3, 2, col);
  put(6, 1, 0, "charcoal"); put(6, 2, 0, "silver"); put(6, 2, -1, "warmGlow", 0.8); put(6, 2, 1, "warmGlow", 0.8);
  box(0, 3, -1, 2, 5, 2, "glass", 0.2);
  box(-1, 5, -2, 3, 6, 3, col);
  put(4, 3, -1, "iron"); put(4, 4, -1, "iron");
  if (trailer) {
    box(-7, 0, -1, -6, 1, 0, "rubber"); box(-7, 0, 2, -6, 1, 3, "rubber");
    box(-8, 1, -2, -1, 2, 3, "woodDark");
    box(-8, 2, -2, -1, 3, -1, "wood"); box(-8, 2, 2, -1, 3, 3, "wood");
    box(-7, 2, -1, -2, 3, 2, trailer);
  }
}

export function combine(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", dir: 1 | -1 = 1, col = "leaf"): void {
  const { put, box } = frame(v, x, y, z, axis, dir);
  box(0, 0, -3, 3, 3, -2, "rubber"); box(0, 0, 3, 3, 3, 4, "rubber");
  box(7, 0, -3, 8, 2, -2, "rubber"); box(7, 0, 3, 8, 2, 4, "rubber");
  box(-1, 1, -2, 9, 5, 3, col);
  box(5, 5, -1, 9, 8, 2, "glass", 0.25);
  box(5, 8, -2, 10, 9, 3, col);
  box(0, 5, -2, 4, 7, 3, "hazard");
  // header reel
  box(9, 0, -6, 12, 1, 7, "steelDark");
  box(10, 1, -6, 12, 3, 7, col);
  for (let w = -6; w < 7; w += 2) put(12, 2, w, "hazard");
  // unloading auger
  for (let k = 0; k < 7; k++) put(2 - Math.floor(k / 3), 6 + Math.floor(k / 2), -3 - k, "steelLight");
}

export function haybale(v: PixelVox, x: number, y: number, z: number, round = true): void {
  if (round) {
    v.cylinderY(x + 0.5, z + 0.5, y, y + 3, 1.7, "#e2bd55");
    v.cylinderY(x + 0.5, z + 0.5, y + 2, y + 3, 1.0, "#c99f3c");
  } else {
    v.box(x, y, z, x + 3, y + 2, z + 2, "#e6c45c");
    v.box(x + 1, y, z, x + 2, y + 2, z + 2, "#c99f3c");
  }
}

export function scarecrow(v: PixelVox, x: number, y: number, z: number, shirt = "red"): void {
  v.box(x, y, z, x + 1, y + 6, z + 1, "woodDark");
  v.box(x - 2, y + 4, z, x + 3, y + 5, z + 1, "woodDark");
  v.box(x - 1, y + 3, z, x + 2, y + 5, z + 1, shirt);
  v.put(x, y + 2, z, "blueDark");
  v.put(x - 2, y + 4, z, "#e8c45a"); v.put(x + 2, y + 4, z, "#e8c45a");
  v.put(x, y + 5, z, "#e8c45a");
  v.box(x - 1, y + 6, z - 1, x + 2, y + 7, z + 2, "woodDark");
  v.put(x, y + 7, z, "woodDark");
}

export function silo(v: PixelVox, cx: number, cz: number, y: number, h: number, r: number, col = "silver", roof = "steelLight", band?: string): number {
  v.cylinderY(cx, cz, y, y + h, r, col);
  if (band) for (let k = 3; k < h; k += 4) v.cylinderY(cx, cz, y + k, y + k + 1, r + 0.05, band);
  v.dome(cx, y + h, cz, r, roof);
  return y + h + Math.ceil(r);
}

/** corrugated grain bin with a cone roof */
export function grainBin(v: PixelVox, cx: number, cz: number, y: number, h: number, r: number): number {
  v.cylinderY(cx, cz, y, y + h, r, "silver");
  for (let k = 1; k < h; k += 2) v.cylinderY(cx, cz, y + k, y + k + 1, r, "steelLight");
  v.cone(cx, y + h, y + h + Math.ceil(r * 0.8), cz, r + 0.3, 0.4, "chrome");
  return y + h + Math.ceil(r * 0.8);
}

/** Gambrel (or gable) barn. Ridge runs along z, big doors on the +z gable end. Returns roof top y. */
export function barn(v: PixelVox, x0: number, z0: number, x1: number, z1: number, h: number, wall = "red", roof = "slate", trim = "white", gambrel = true): number {
  v.box(x0, 1, z0, x1, 1 + h, z1, wall);
  if (x1 - x0 > 2 && z1 - z0 > 2 && h > 2) v.clear(x0 + 1, 2, z0 + 1, x1 - 1, h, z1 - 1);
  for (const px of [x0, x1 - 1]) for (const pz of [z0, z1 - 1]) v.box(px, 1, pz, px + 1, 1 + h, pz + 1, trim);
  // board stripes
  for (let z = z0 + 2; z < z1 - 1; z += 3) { v.box(x0, 1, z, x0 + 1, 1 + h, z + 1, trim === "white" ? wall : trim); }
  const half = (x1 - x0) / 2;
  const insets: number[] = [];
  if (gambrel) {
    let i = -1;
    insets.push(-1, -1, 0);
    i = 0;
    while (i < half - 1) {
      i += i < half * 0.4 ? 1 : 2;
      insets.push(Math.min(i, Math.floor(half) - 1));
      if (i < half * 0.4) insets.push(Math.min(i, Math.floor(half) - 1));
    }
  } else {
    for (let i = -1; i < half; i++) insets.push(i);
  }
  let y = 1 + h;
  for (const ins of insets) {
    const a = Math.floor(x0 + ins);
    const b = Math.ceil(x1 - ins);
    if (b - a <= 0) break;
    v.box(a, y, z0 - 1, b, y + 1, z1 + 1, roof);
    if (b - a > 2) {
      v.box(a + 1, y, z0, b - 1, y + 1, z0 + 1, wall);
      v.box(a + 1, y, z1 - 1, b - 1, y + 1, z1, wall);
    }
    y++;
  }
  // front doors with white X
  const cx = Math.floor((x0 + x1) / 2);
  const dw = Math.max(2, Math.min(3, Math.floor(half) - 2));
  const dh = Math.min(h - 1, 5);
  for (const zz of [z1 - 1]) {
    v.box(cx - dw, 1, zz, cx + dw, 1 + dh, zz + 1, trim);
    v.box(cx - dw + 1, 2, zz, cx + dw - 1, dh, zz + 1, wall === "red" ? "redDark" : "woodDark");
    for (let k = 0; k < dh - 2; k++) {
      const t = k / Math.max(1, dh - 3);
      const xl = Math.round(cx - dw + 1 + t * (dw - 1.5));
      v.put(xl, 2 + k, zz, trim);
      v.put(Math.round(cx + dw - 2 - t * (dw - 1.5)), 2 + k, zz, trim);
    }
    // loft door
    if (h + 2 < y) {
      v.box(cx - 1, h + 2, zz, cx + 1, h + 4, zz + 1, trim);
      v.put(cx, h + 5, zz + 1, "woodDark");
    }
  }
  return y;
}

/** Simple farmhouse with gable roof, porch, chimney smoke. Front = +z. */
export function farmhouse(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number, wall: string, roof: string, trim: string, porch = true): number {
  const v = c.v;
  const top = 1 + floors * 4;
  v.box(x0, 1, z0, x1, top, z1, wall);
  if (x1 - x0 > 2 && z1 - z0 > 2) v.clear(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, z1 - 1);
  for (const px of [x0, x1 - 1]) for (const pz of [z0, z1 - 1]) v.box(px, 1, pz, px + 1, top, pz + 1, trim);
  windows(c, x0, 1, z0, x1, top, z1, { stepV: 4, stepH: 3, h: 2, emit: 0.5, sill: trim });
  const rt = gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", roof, trim);
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "woodDark");
  if (porch) {
    v.box(x0, 1, z1, x1, 2, z1 + 3, "woodLight");
    for (let px = x0; px < x1; px += Math.max(2, Math.floor((x1 - x0 - 1) / 3))) v.box(px, 2, z1 + 2, px + 1, 5, z1 + 3, trim);
    v.box(x1 - 1, 2, z1 + 2, x1, 5, z1 + 3, trim);
    v.box(x0, 5, z1, x1, 6, z1 + 3, roof);
  }
  const ch = chimney(v, x1 - 3, top - 1, z0 + 1, rt - top + 3, "brickDark");
  c.smoke(x1 - 2, ch, z0 + 2, "smoke");
  return rt;
}

/** Lattice windpump tower with a spinning multi-blade wheel (faces +z). */
export function windpump(c: Ctx, x: number, z: number, y: number, h: number, blade = "white"): void {
  const v = c.v;
  for (let k = 0; k < h; k++) {
    const ins = Math.round(2 * (1 - k / h));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.put(x + sx * ins, y + k, z + sz * ins, "steelDark");
    if (k % 4 === 2) {
      v.box(x - ins, y + k, z - ins, x + ins + 1, y + k + 1, z - ins + 1, "steel");
      v.box(x - ins, y + k, z + ins, x + ins + 1, y + k + 1, z + ins + 1, "steel");
    }
  }
  v.box(x - 1, y + h, z - 1, x + 2, y + h + 1, z + 2, "iron");
  v.box(x, y + h, z - 5, x + 1, y + h + 1, z - 1, "steelDark");
  v.box(x, y + h - 1, z - 6, x + 1, y + h + 3, z - 4, "red");
  const r = new PixelVox();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (let d = 1; d <= 4; d++) r.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, d >= 2 ? (i % 2 ? blade : "red") : "steelLight");
  }
  r.put(0, 0, 0, "iron");
  c.addRotor({ vox: r, pivot: [x, y + h + 1, z + 2], axis: "z", speed: 2.2, wind: true });
}

/** Center-pivot irrigation: tower + rotating sprinkler arm of length L (sweeps a crop circle). */
export function pivotIrrigation(c: Ctx, cx: number, cz: number, L: number): void {
  const v = c.v;
  v.box(cx - 1, 1, cz - 1, cx + 1, 6, cz + 1, "steel");
  v.box(cx - 1, 6, cz - 1, cx + 1, 7, cz + 1, "hazard");
  const r = new PixelVox();
  for (let i = 0; i <= L; i++) {
    r.put(i, 0, 0, "steelLight");
    if (i % 2 === 1) r.put(i, -1, 0, "cyan", 0.4);
    if (i > 0 && i % 5 === 0) {
      for (let d = 1; d <= 4; d++) { r.put(i, -d, d >= 3 ? 1 : 0, "steel"); r.put(i, -d, d >= 3 ? -1 : 0, "steel"); }
      r.put(i, -5, 1, "rubber"); r.put(i, -5, -1, "rubber");
    }
    if (i > 0 && i < L && i % 5 !== 0) r.put(i, 1, 0, i % 2 ? "steel" : "steelDark");
  }
  r.put(L, -1, 0, "cyan", 0.6);
  c.addRotor({ vox: r, pivot: [cx, 6, cz], axis: "y", speed: 0.18 });
}

/** Glass greenhouse, ridge along x. */
export function greenhouse(v: PixelVox, x0: number, z0: number, x1: number, z1: number, h = 4, plants = "leaf"): void {
  v.box(x0, 1, z0, x1, 1 + h, z1, "glass", 0.12);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 1 + h, z1 - 1);
  for (let x = x0; x < x1; x += 3) { v.box(x, 1, z0, x + 1, 1 + h, z0 + 1, "white"); v.box(x, 1, z1 - 1, x + 1, 1 + h, z1, "white"); }
  v.box(x1 - 1, 1, z0, x1, 1 + h, z1, "white");
  v.box(x0, 1, z0, x0 + 1, 1 + h, z1, "white");
  const rise = Math.ceil((z1 - z0) / 2);
  for (let s = 0; s < rise; s++) v.box(x0, 1 + h + s, z0 + s, x1, 2 + h + s, z1 - s, s === rise - 1 ? "white" : "glass", 0.15);
  for (let z = z0 + 2; z < z1 - 2; z += 2) v.box(x0 + 1, 1, z, x1 - 1, 2, z + 1, plants);
  for (let z = z0 + 2; z < z1 - 2; z += 2) for (let x = x0 + 2; x < x1 - 1; x += 3) v.put(x, 2, z, plants === "leaf" ? "red" : "yellow");
  v.box(x0 + 1, 1, z1 - 1, x0 + 3, 4, z1, "glass", 0.2);
}

/** Cluster of tall concrete grain-elevator tubes + headhouse. */
export function grainElevator(v: PixelVox, x0: number, z: number, n: number, h: number): number {
  const r = 2.4;
  for (let i = 0; i < n; i++) v.cylinderY(x0 + 2.5 + i * 4.6, z + 0.5, 1, 1 + h, r, i % 2 ? "concrete" : "concrete2");
  const xEnd = Math.round(x0 + 2.5 + (n - 1) * 4.6 + 3);
  v.box(x0, 1 + h, z - 2, xEnd, 3 + h, z + 3, "concreteDark");
  v.box(x0 + 2, 3 + h, z - 1, x0 + 7, 9 + h, z + 2, "concrete");
  v.box(x0 + 2, 9 + h, z - 1, x0 + 7, 10 + h, z + 2, "redDark");
  v.box(x0 + 3, 6 + h, z + 2, x0 + 6, 7 + h, z + 3, "red", 0.4);
  return 10 + h;
}

export type Crop =
  | "wheat" | "corn" | "sunflower" | "lavender" | "rice" | "pumpkin" | "cabbage" | "potato"
  | "tea" | "coffee" | "cane" | "vine" | "strawberry" | "tulip" | "pasture";

/** Fill a rectangle with a crop. Rows run along `axis`. */
export function crops(c: Ctx, x0: number, z0: number, x1: number, z1: number, crop: Crop, axis: "x" | "z" = "z", mask?: (x: number, z: number) => boolean): void {
  const v = c.v;
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      if (mask && !mask(x, z)) continue;
      const ac = axis === "z" ? x - x0 : z - z0;
      const al = axis === "z" ? z - z0 : x - x0;
      const r = h2(x, z, 77);
      switch (crop) {
        case "wheat":
          if (ac % 4 === 3) { v.put(x, 0, z, "soilDark"); break; }
          v.put(x, 0, z, "soil");
          v.put(x, 1, z, "goldDark");
          if (r < 0.9) v.put(x, 2, z, r < 0.45 ? "hazard" : r < 0.75 ? "yellow" : "amber");
          if (r < 0.12 && ac % 4 === 1) v.put(x, 3, z, "yellow");
          break;
        case "corn":
          v.put(x, 0, z, ac % 2 ? "soilDark" : "soil");
          if (ac % 2 === 0) {
            v.box(x, 1, z, x + 1, 4, z + 1, al % 2 ? "leaf" : "leafDark");
            v.put(x, 4, z, al % 2 ? "leafLight" : "yellow");
            if (r < 0.2) v.put(x + (axis === "z" ? 1 : 0), 2, z + (axis === "x" ? 1 : 0), "yellow");
          }
          break;
        case "sunflower":
          v.put(x, 0, z, "soil");
          if (ac % 3 === 0 && al % 3 === 0) {
            v.box(x, 1, z, x + 1, 4, z + 1, "leaf");
            v.put(x, 4, z, "woodDark");
            v.put(x - 1, 4, z, "yellow"); v.put(x + 1, 4, z, "yellow"); v.put(x, 5, z, "yellow"); v.put(x, 3, z + 1, "leafLight");
            v.put(x, 4, z - 1, "hazard");
          } else if (r < 0.3) v.put(x, 1, z, "leafLight");
          break;
        case "lavender":
          if (ac % 3 === 2) { v.put(x, 0, z, "soil"); break; }
          v.put(x, 0, z, "soilDark");
          v.put(x, 1, z, "#7d9a6c");
          v.put(x, 2, z, r < 0.5 ? "purple" : r < 0.8 ? "#b48be0" : "indigo");
          break;
        case "rice":
          if (ac % 8 === 7 || al % 10 === 9) { v.put(x, 0, z, "grass"); if (r < 0.1) v.put(x, 1, z, "grass3"); break; }
          v.put(x, 0, z, r < 0.5 ? "#79c3cf" : "#6ab7c8", 0.1);
          if (ac % 2 === 0 && al % 2 === 0) { v.put(x, 1, z, "lime"); if (r < 0.6) v.put(x, 2, z, "leafLight"); }
          break;
        case "pumpkin":
          v.put(x, 0, z, ac % 4 === 3 ? "soilDark" : "soil");
          if (r < 0.35) v.put(x, 1, z, "leaf");
          if (ac % 4 === 1 && al % 4 === 1 && r < 0.75) {
            v.box(x, 1, z, x + 2, 3, z + 2, r < 0.5 ? "orange" : "amber");
            v.put(x, 3, z, "leafDark");
          }
          break;
        case "cabbage":
          v.put(x, 0, z, ac % 2 ? "soilDark" : "soil");
          if (ac % 2 === 0 && al % 2 === 0) { v.put(x, 1, z, "#9fd67a"); if (r < 0.5) v.put(x, 2, z, "#c3eaa0"); }
          break;
        case "potato":
          v.put(x, 0, z, ac % 2 ? "soilDark" : "soil");
          if (ac % 2 === 0) { v.put(x, 1, z, "leafDark"); if (r < 0.2) v.put(x, 2, z, r < 0.1 ? "white" : "purple"); }
          break;
        case "tea":
          if (ac % 3 === 2) { v.put(x, 0, z, "path2"); break; }
          v.put(x, 0, z, "soil");
          v.put(x, 1, z, "leafDark");
          v.put(x, 2, z, r < 0.4 ? "leaf" : r < 0.8 ? "#52a64a" : "lime");
          break;
        case "coffee":
          v.put(x, 0, z, "soilDark");
          if (ac % 3 === 0 && al % 2 === 0) {
            v.box(x, 1, z, x + 1, 4, z + 1, "leafDark");
            v.put(x + 1, 2, z, r < 0.5 ? "red" : "leafDark"); v.put(x - 1, 3, z, r < 0.6 ? "redDark" : "leaf");
          }
          break;
        case "cane":
          if (ac % 4 === 3) { v.put(x, 0, z, "path2"); break; }
          v.put(x, 0, z, "soil");
          if (ac % 4 !== 1 || r < 0.5) {
            const hh = 4 + Math.floor(r * 4);
            v.box(x, 1, z, x + 1, hh, z + 1, al % 3 ? "#a7cf6a" : "#8fbf55");
            v.put(x, hh, z, r < 0.3 ? "#e8eec8" : "leafLight");
            if (r < 0.25) v.put(x, hh - 2, z + (axis === "x" ? 1 : 0), "leaf");
          }
          break;
        case "vine":
          if (ac % 4 !== 0) { v.put(x, 0, z, r < 0.5 ? "grass3" : "grass"); break; }
          v.put(x, 0, z, "soil");
          if (al % 7 === 0) { v.box(x, 1, z, x + 1, 5, z + 1, "woodDark"); break; }
          v.put(x, 1, z, "woodDark");
          v.box(x, 2, z, x + 1, 4, z + 1, al % 2 ? "leaf" : "olive");
          v.put(x, 4, z, "steelDark");
          if (r < 0.35) v.put(x + (axis === "z" ? (r < 0.17 ? 1 : -1) : 0), 2, z + (axis === "x" ? (r < 0.17 ? 1 : -1) : 0), c.variant === 3 && r < 0.1 ? "lime" : "purpleDark");
          break;
        case "strawberry":
          v.put(x, 0, z, ac % 2 ? "#e6c45c" : "soil");
          if (ac % 2 === 0) { v.put(x, 1, z, "leaf"); if (r < 0.35) v.put(x, 1, z, "red"); }
          break;
        case "tulip": {
          const cols = ["red", "yellow", "pink", "purple", "white", "orange"];
          if (ac % 3 === 2) { v.put(x, 0, z, "soil"); break; }
          v.put(x, 0, z, "soilDark");
          v.put(x, 1, z, "leaf");
          v.put(x, 2, z, cols[Math.floor((ac / 3)) % cols.length]);
          break;
        }
        case "pasture":
          v.put(x, 0, z, r < 0.2 ? "grass3" : "grass");
          if (r > 0.97) v.put(x, 1, z, r > 0.985 ? "white" : "yellow");
          break;
      }
    }
  }
}

/** Fruit / orchard tree. kind: apple|cherry|orange|peach|olive|lemon. Returns top y. */
export function fruitTree(c: Ctx, x: number, y: number, z: number, kind: string, size = 1): number {
  const v = c.v;
  const s = Math.max(0.5, size);
  if (kind === "olive") {
    const th = Math.max(2, Math.round(2.5 * s));
    const trunk = "#7a6a55";
    for (let k = 0; k < th; k++) {
      const dx = k % 3 === 1 ? 1 : 0;
      v.put(x + dx, y + k, z, trunk);
      if (s > 1.3) { v.put(x + 1, y + k, z + 1, "#6a5a48"); v.put(x - 1 + dx, y + k, z, trunk); }
    }
    if (s > 1.3) { v.put(x - 1, y, z - 1, trunk); v.put(x + 2, y, z + 1, trunk); }
    const R = 1.6 * s + 0.6;
    v.sphere(x + 0.5, y + th + R * 0.4, z + 0.5, R, R * 0.55, R, "#a9bf98");
    v.sphere(x + 0.5 + R * 0.5, y + th + R * 0.65, z + 0.5 - R * 0.3, R * 0.6, R * 0.4, R * 0.6, "#cad8bd");
    v.sphere(x + 0.5 - R * 0.5, y + th + R * 0.55, z + 0.5 + R * 0.35, R * 0.6, R * 0.45, R * 0.6, "#97ad86");
    for (let i = 0; i < 2 + s * 2; i++) {
      const a = c.rand() * Math.PI * 2;
      v.put(x + Math.round(Math.cos(a) * R * 0.95), y + th + Math.round(R * 0.3), z + Math.round(Math.sin(a) * R * 0.95), "#3d4430");
    }
    return y + th + Math.round(R);
  }
  const th = Math.max(2, Math.round(2 + 1.6 * s));
  v.box(x, y, z, x + 1, y + th, z + 1, "woodDark");
  const leaf = kind === "cherry" ? "pink" : kind === "orange" || kind === "lemon" ? "leafDark" : kind === "peach" ? "leafLight" : "leaf";
  const leaf2 = kind === "cherry" ? "#f6b9d0" : kind === "orange" || kind === "lemon" ? "leaf" : kind === "peach" ? "lime" : "leafLight";
  const fruit = kind === "apple" ? "red" : kind === "orange" ? "orange" : kind === "peach" ? "#f6a77a" : kind === "lemon" ? "yellow" : "white";
  const R = 1.5 * s + 0.7;
  const cy = y + th + R * 0.55;
  v.sphere(x + 0.5, cy, z + 0.5, R, R * 0.85, R, leaf);
  v.sphere(x + 0.5 + R * 0.35, cy + R * 0.35, z + 0.5 - R * 0.25, R * 0.6, R * 0.55, R * 0.6, leaf2);
  const n = Math.round(4 + s * 5);
  for (let i = 0; i < n; i++) {
    const a = c.rand() * Math.PI * 2;
    const yy = cy + (c.rand() - 0.5) * R;
    const rr = Math.sqrt(Math.max(0, 1 - ((yy - cy) / (R * 0.85)) ** 2)) * R;
    v.put(Math.floor(x + 0.5 + Math.cos(a) * rr), Math.floor(yy), Math.floor(z + 0.5 + Math.sin(a) * rr), kind === "cherry" ? (i % 2 ? "magenta" : "white") : fruit);
  }
  if (kind === "cherry") {
    // fallen petals
    for (let i = 0; i < 6; i++) v.put(x + c.ri(-3, 3), y - 1, z + c.ri(-3, 3), "pink");
  }
  return Math.ceil(cy + R * 0.85);
}

export function crate(v: PixelVox, x: number, y: number, z: number, fruit?: string): void {
  v.box(x, y, z, x + 2, y + 1, z + 2, "crate");
  if (fruit) { v.put(x, y + 1, z, fruit); v.put(x + 1, y + 1, z + 1, fruit); }
}

export function ladder(v: PixelVox, x: number, y: number, z: number, h = 5): void {
  for (let k = 0; k < h; k++) { v.put(x, y + k, z, "woodLight"); v.put(x + 2, y + k, z, "woodLight"); if (k % 2) v.put(x + 1, y + k, z, "wood"); }
}

export function beehive(v: PixelVox, x: number, y: number, z: number): void {
  v.box(x, y, z, x + 2, y + 1, z + 2, "woodDark");
  v.box(x, y + 1, z, x + 2, y + 3, z + 2, "white");
  v.box(x, y + 2, z, x + 2, y + 3, z + 2, "yellow");
  v.box(x, y + 3, z, x + 2, y + 4, z + 2, "slate");
}

function pen(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col = "woodLight"): void {
  if (x1 - x0 < 3 || z1 - z0 < 3) return;
  fence(v, x0, z0, x1, z1, 1, 2, col, [Math.floor((x0 + x1) / 2) - 1, Math.floor((x0 + x1) / 2) + 1]);
}

/** Animated livestock wandering inside a pen (see c.critters / farmActivity.ts). */
function scatterCritters(c: Ctx, kind: CritterKind, x0: number, z0: number, x1: number, z1: number, n: number): void {
  c.critters({ kind, count: n, area: [x0 + 2, z0 + 2, x1 - 2, z1 - 2] });
}

function dirtPath(v: PixelVox, x0: number, z0: number, x1: number, z1: number): void {
  v.box(x0, 0, z0, x1, 1, z1, "path2");
}

// =============================================================================================
// FARMS — mixed livestock + crops homestead that SPRAWLS into an agri-business.
//  V0 Dairy Farm (Holstein cows, red barn, blue silos, corn)
//  V1 Hog Farm (pink pigs in mud wallows, long white hog barns, potatoes & cabbages)
//  V2 Wheat Farm (golden wheat, grain bins, combine harvester, chickens)
//  V3 Pumpkin Patch (pumpkins, scarecrows, hay bales, sheep, corn maze & farm stand)
// =============================================================================================
function buildFarms(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);
  const animal: Critter = (["cow", "pig", "chicken", "sheep"] as const)[V];
  const mainCrop: Crop = (["corn", "cabbage", "wheat", "pumpkin"] as const)[V];
  const crop2: Crop = (["wheat", "potato", "sunflower", "corn"] as const)[V];
  const barnWall = ["red", "white", "redDark", "#c4572e"][V];
  const barnRoof = ["slate", "concreteDark", "slate", "woodDark"][V];
  const tractorCol = ["red", "leaf", "leafDark", "orange"][V];

  const W = hx * 2;
  // homestead width
  const homeW = lv === 1 ? Math.min(W, 16) : Math.min(W - 8, [16, 16, 18, 22, 26][lv - 1]);
  const hx0 = -hx;
  const hx1 = -hx + homeW;
  const fx0 = lv === 1 ? -hx : hx1 + 1;

  if (lv === 1) {
    // tiny homestead: shed + pen at back, garden plot at the front
    const sx1 = Math.min(-hx + 7, hx - 1);
    v.box(-hx + 1, 1, -hz + 1, sx1, 5, -hz + 6, barnWall);
    v.box(-hx + 3, 1, -hz + 5, -hx + 5, 4, -hz + 6, "woodDark");
    gable(v, -hx, 5, -hz, sx1 + 1, -hz + 7, "x", barnRoof, "white");
    pen(v, sx1 + 1, -hz + 1, hx - 1, -1);
    c.critters({ kind: animal, count: hx >= 8 ? 2 : 1, area: [sx1 + 2, -hz + 2, hx - 2, -2] });
    v.box(-hx, 0, -1, hx, 1, 1, "path2");
    crops(c, -hx + 1, 1, hx - 1, hz - 1, mainCrop, "z");
    if (V === 3 || V === 2) scarecrow(v, 0, 1, Math.floor(hz / 2) + 1, V === 3 ? "orange" : "red");
    else haybale(v, hx - 3, 1, hz - 3, true);
    return;
  }

  // ---- homestead block (x: hx0..hx1) ----
  dirtPath(v, hx0, -1, hx1 + 1, 2);
  dirtPath(v, hx1, -hz, hx1 + 1, hz);
  const bw = [0, 10, 11, 12, 12][lv - 1];
  const bd = Math.min(hz - 2, [0, 7, 11, 12, 13][lv - 1]);
  const bx0 = hx0 + 1;
  const bz0 = -hz + 1;
  if (V === 1) {
    // long low hog barns
    v.box(bx0, 1, bz0, bx0 + bw, 4, bz0 + bd, "white");
    v.box(bx0, 2, bz0 + 1, bx0 + bw, 3, bz0 + bd - 1, "steelLight");
    gable(v, bx0 - 1, 4, bz0 - 1, bx0 + bw + 1, bz0 + bd + 1, "x", barnRoof, "steelDark");
    for (let x = bx0 + 2; x < bx0 + bw - 1; x += 3) v.put(x, Math.floor(4 + bd / 2), Math.floor(bz0 + bd / 2), "steel");
  } else {
    barn(v, bx0, bz0, bx0 + bw, bz0 + bd, lv >= 4 ? 7 : 6, barnWall, barnRoof, V === 0 || V === 2 ? "white" : "cream", true);
  }
  // silo(s)
  const sx = bx0 + bw + 3;
  if (lv >= 3 && sx + 2 < hx1 + 2) {
    if (V === 0) { silo(v, sx, bz0 + 3, 1, 14 + lv * 2, 2.6, "blueDark", "silver", "blue"); }
    else if (V === 1) { v.cone(sx, 1, 5, bz0 + 3, 0.8, 2.2, "steel"); v.cylinderY(sx, bz0 + 3, 5, 11, 2.2, "silver"); v.cone(sx, 11, 13, bz0 + 3, 2.4, 0.5, "chrome"); }
    else if (V === 2) { grainBin(v, sx, bz0 + 3, 1, 7, 2.6); }
    else silo(v, sx, bz0 + 3, 1, 12 + lv * 2, 2.4, "brick", "terracotta");
    if (lv >= 4 && bz0 + 10 < 0) {
      if (V === 2) grainBin(v, sx, bz0 + 9, 1, 6, 2.4);
      else if (V === 0) silo(v, sx, bz0 + 9, 1, 12 + lv * 2, 2.4, "blueDark", "silver", "blue");
    }
  }
  // pen / pasture in front of barn
  const pz0 = bz0 + bd + 2;
  const pz1 = hz - 1;
  if (pz1 - pz0 >= 5) {
    pen(v, hx0 + 1, pz0, hx1 - 1, pz1, V === 1 ? "woodDark" : "white");
    if (V === 1) {
      for (let i = 0; i < 3; i++) v.cylinderY(c.ri(hx0 + 4, hx1 - 5), c.ri(pz0 + 3, pz1 - 3), 0, 1, 2.2, "soilDark");
      v.box(hx0 + 2, 1, pz1 - 3, hx0 + 6, 2, pz1 - 2, "steelDark");
    }
    if (V === 2) {
      // chicken coop
      v.box(hx1 - 7, 2, pz0 + 2, hx1 - 2, 5, pz0 + 6, "woodLight");
      v.box(hx1 - 7, 1, pz0 + 2, hx1 - 6, 2, pz0 + 3, "woodDark"); v.box(hx1 - 3, 1, pz0 + 5, hx1 - 2, 2, pz0 + 6, "woodDark");
      gable(v, hx1 - 8, 5, pz0 + 1, hx1 - 1, pz0 + 7, "x", "red", "white");
      for (let k = 0; k < 3; k++) v.put(hx1 - 8 - k, 1 + Math.max(0, 1 - k), pz0 + 4, "wood");
    }
    const n = Math.max(2, Math.floor(((hx1 - hx0) * (pz1 - pz0)) / 70));
    scatterCritters(c, animal, hx0 + 1, pz0, hx1 - (V === 2 ? 8 : 1), pz1, Math.min(n, 2 + lv));
    if (V === 0) { v.box(hx0 + 2, 1, pz1 - 3, hx0 + 5, 2, pz1 - 2, "steelLight"); v.box(hx0 + 2, 1, pz1 - 3, hx0 + 5, 2, pz1 - 2, "water"); }
  }
  // tractor & windpump
  if (lv >= 3) {
    tractor(v, hx1 - 4, 1, 0, "x", -1, tractorCol, lv >= 4 ? (V === 3 ? "orange" : "#e2bd55") : undefined);
    if (pz1 - pz0 >= 8) windpump(c, hx1 - 3, pz1 - 3, 1, 12 + lv, V === 3 ? "orange" : "white");
  }
  if (lv === 2) {
    haybale(v, bx0 + bw + 2, 1, bz0 + 2, V !== 1);
    haybale(v, bx0 + bw + 2, 1, bz0 + 5, V !== 1);
  }

  // ---- fields (x: fx0..hx) ----
  const fx1 = hx - 1;
  const fz0 = -hz + 1;
  const fz1 = hz - 1;
  const fw = fx1 - fx0;
  const fd = fz1 - fz0;
  if (fw < 4) return;
  if (lv >= 4 && fw >= 24 && fd >= 24) {
    // centre-pivot crop circle (back-left at Lv4, front-right at Lv5 to leave room for the elevator)
    const R = Math.floor(Math.min(fw, fd, lv === 5 ? 30 : fd) / 2) - 1;
    const far = lv >= 5;
    const cx = far ? fx1 - R - 1 : fx0 + R + 1;
    const cz = far ? fz1 - R - 1 : fz0 + R + 1;
    crops(c, cx - R, cz - R, cx + R + 1, cz + R + 1, mainCrop, "z", (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= R * R);
    for (let x = cx - R - 1; x <= cx + R + 1; x++) for (let z = cz - R - 1; z <= cz + R + 1; z++) {
      const d = (x - cx) ** 2 + (z - cz) ** 2;
      if (d > R * R && d <= (R + 1) ** 2) v.put(x, 0, z, "soilDark");
    }
    v.box(cx - 1, 0, cz - 1, cx + 2, 1, cz + 2, "concrete");
    pivotIrrigation(c, cx, cz, R - 1);
    if (!far) {
      const rx0 = cx + R + 3;
      if (fx1 - rx0 >= 4) {
        crops(c, rx0, fz0, fx1, cz, crop2, "z");
        crops(c, rx0, cz + 1, fx1, cz + R + 1, mainCrop, "x");
      }
      const sz0 = cz + R + 3;
      if (fz1 - sz0 >= 4) {
        const mid = Math.floor((fx0 + fx1) / 2);
        crops(c, fx0, sz0, mid, fz1, crop2, "x");
        crops(c, mid + 2, sz0, fx1, fz1, V === 3 ? "corn" : "strawberry", "z");
        dirtPath(v, mid, sz0, mid + 2, fz1);
        if (fz1 - sz0 >= 8) greenhouse(v, fx0, sz0, Math.min(fx0 + 12, fx1), sz0 + 8, 3, V === 3 ? "leafDark" : "leaf");
      }
    } else {
      // left strip of the fields
      const lx1 = cx - R - 2;
      if (lx1 - fx0 >= 4) crops(c, fx0, cz - R, lx1, fz1, crop2, "z");
      // back strip: works yard with the landmark building + more crops
      const bz1 = cz - R - 2;
      if (bz1 - fz0 >= 6) {
        v.box(fx0, 0, fz0, fx0 + 22, 1, bz1, "concrete2");
        crops(c, fx0 + 23, fz0, fx1, bz1, mainCrop === "wheat" ? "sunflower" : "wheat", "x");
        if (V === 0) { grainElevator(v, fx0 + 1, fz0 + 6, 4, 24); truck(v, fx0 + 10, 1, bz1 - 3, "x", "white", "blue"); v.box(fx0 + 4, 1, bz1 - 4, fx0 + 9, 3, bz1 - 2, "chrome"); }
        else if (V === 2) { grainElevator(v, fx0 + 1, fz0 + 6, 4, 26); truck(v, fx0 + 12, 1, bz1 - 3, "x", "hazard", "red"); }
        else if (V === 1) { for (let i = 0; i < 3; i++) { v.cone(fx0 + 4 + i * 6, 1, 5, fz0 + 5, 0.8, 2.4, "steel"); v.cylinderY(fx0 + 4 + i * 6, fz0 + 5, 5, 13, 2.4, "silver"); v.cone(fx0 + 4 + i * 6, 13, 15, fz0 + 5, 2.6, 0.5, "chrome"); } truck(v, fx0 + 10, 1, bz1 - 3, "x", "pink", "white"); }
        else { for (let i = 0; i < 4; i++) for (let k = 0; k < 3 - (i % 2); k++) haybale(v, fx0 + 2 + i * 5, 1 + k * 3, fz0 + 3, true); greenhouse(v, fx0 + 1, fz0 + 8, fx0 + 21, Math.min(bz1 - 1, fz0 + 16), 3, "leafDark"); }
      }
    }
  } else {
    // simple strips
    const half = Math.floor(fd / 2);
    crops(c, fx0, fz0, fx1, fz0 + half - 1, crop2, "x");
    crops(c, fx0, fz0 + half + 1, fx1, fz1, mainCrop, "z");
    dirtPath(v, fx0, fz0 + half - 1, fx1, fz0 + half + 1);
    if (V === 3 || V === 2) scarecrow(v, Math.floor((fx0 + fx1) / 2), 1, fz0 + half + 4, V === 3 ? "orange" : "blue");
    if (lv >= 3) for (let i = 0; i < 3; i++) haybale(v, fx0 + 2 + i * 4, 1, fz0 + half - 4, V !== 1);
  }

  // ---- Lv5 agri-business extras ----
  if (lv >= 5) {
    const gx = hx0 + 1;
    const gz = Math.max(-hz + 2, pz1 - 4);
    if (V === 2 || V === 0) {
      // grain elevator / feed mill landmark at the back corner beyond the barn
      combine(v, fx0 + 27, 1, -hz + 9, "x", 1, V === 2 ? "leaf" : "red");
    } else if (V === 3) {
      // farm stand with pumpkin pyramid + sign
      v.box(gx + 1, 1, gz - 4, gx + 9, 4, gz, "woodLight");
      v.box(gx, 4, gz - 5, gx + 10, 5, gz + 1, "orange");
      for (let i = 0; i < 4; i++) v.box(gx + 1 + i * 2, 1, gz + 1, gx + 2 + i * 2, 2, gz + 2, i % 2 ? "orange" : "amber");
      v.box(gx + 2, 5, gz - 1, gx + 8, 8, gz, "cream");
      v.box(gx + 3, 6, gz, gx + 7, 7, gz + 1, "orange", 0.6);
      tractor(v, fx0 + 8, 1, hz - 5, "x", 1, "orange", "#e2bd55");
      person(v, gx + 5, 1, gz + 3, "orange"); person(v, gx + 8, 1, gz + 3, "purple", "blue");
    } else {
      c.critters({ kind: "pig", count: 3, area: [fx0 + 1, hz - 7, fx0 + 12, hz - 1] });
    }
    // farmhouse in the homestead corner? keep the flag & lamp posts
    flag(v, hx1 - 1, 1, -hz + 1, 12, ["red", "white", "blue"]);
    lamp(v, hx1 - 1, 1, 2, 5);
  }
}

// =============================================================================================
// FARM HOUSES — the farmstead family home + barn, growing into a proud homestead.
//  V0 Americana (white farmhouse, wraparound porch, red gambrel barn)
//  V1 Alpine (chalet with deep eaves, stone base, flower boxes, timber hay barn)
//  V2 Dutch (huge thatched long roof, green shutters, little windmill)
//  V3 Frontier Log Ranch (log cabin, stone chimney, horse corral, windpump)
// =============================================================================================
function buildFarmHouses(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  lot(c, V === 3 ? "grass" : "grass2");
  speckle(c, V === 3 ? "#c9b26a" : "grass3", 0.08);

  // House sits front-left, barn back-right
  const hw = Math.min(hx * 2 - 4, byLvn(lv, [9, 10, 11, 12, 13]));
  const hd = byLvn(lv, [6, 7, 7, 8, 9]);
  const floors = lv >= 2 ? 2 : 1;
  const x0 = -hx + 2;
  const x1 = x0 + hw;
  const z1 = hz - 4;
  const z0 = z1 - hd;
  dirtPath(v, Math.floor((x0 + x1) / 2) - 1, z1, Math.floor((x0 + x1) / 2) + 1, hz);

  const wall = ["white", "#f3e2c3", "brickDark", "#9a6a3e"][V];
  const roof = ["slate", "woodDark", "#c7a35a", "#5b4632"][V];
  const trim = ["woodDark", "woodDark", "white", "#6b4a2a"][V];
  const top = 1 + floors * 4;

  if (V === 3) {
    // log cabin walls: alternating log colours
    for (let y = 1; y < top; y++) v.box(x0, y, z0, x1, y + 1, z1, y % 2 ? "#9a6a3e" : "#7d5530");
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, z1 - 1);
    for (let y = 1; y < top; y += 2) for (const px of [x0 - 1, x1]) for (const pz of [z0, z1 - 1]) v.put(px, y, pz, "#b07c48");
  } else if (V === 1) {
    v.box(x0, 1, z0, x1, 4, z1, "stone");
    v.box(x0, 4, z0, x1, top, z1, "woodLight");
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, z1 - 1);
  } else {
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, z1 - 1);
    for (const px of [x0, x1 - 1]) for (const pz of [z0, z1 - 1]) v.box(px, 1, pz, px + 1, top, pz + 1, trim);
  }
  windows(c, x0, 1, z0, x1, top, z1, { stepV: 4, stepH: 3, h: 2, emit: 0.5, sill: V === 1 ? "red" : V === 2 ? "#2f7a46" : trim, faces: "sew" });
  let rt: number;
  if (V === 1) {
    // alpine: low, very wide eaves
    rt = gable(v, x0 - 3, top, z0 - 2, x1 + 3, z1 + 2, "z", roof, "woodDark");
    v.box(x0, top - 3, z1, x1, top - 2, z1 + 2, "woodDark");
    for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, top - 2, z1 + 1, x % 4 ? "red" : "pink");
  } else if (V === 2) {
    // thatched long roof dropping low
    rt = hip(v, x0 - 2, top - 2, z0 - 2, x1 + 2, z1 + 2, roof, "#a8873f");
    v.box(Math.floor((x0 + x1) / 2) - 1, top - 2, z1 + 1, Math.floor((x0 + x1) / 2) + 2, top + 1, z1 + 2, wall);
    for (let y = 2; y < top; y += 4) { v.put(x0 - 1, y + 1, z1 - 3, "#2f7a46"); v.put(x1, y + 1, z1 - 3, "#2f7a46"); }
  } else {
    rt = gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", roof, trim);
  }
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, V === 2 ? "#2f7a46" : V === 0 ? "red" : "woodDark");
  // porch (wraparound for americana)
  if (V === 0 || V === 3) {
    const pz1 = Math.min(hz - 1, z1 + 3);
    v.box(x0 - (V === 0 && lv >= 3 ? 1 : 0), 1, z1, x1 + (V === 0 && lv >= 3 ? 2 : 0), 2, pz1, "woodLight");
    for (let px = x0; px <= x1; px += 3) v.box(Math.min(px, x1 - 1), 2, pz1 - 1, Math.min(px, x1 - 1) + 1, 5, pz1, V === 0 ? "white" : "#7d5530");
    v.box(x0 - 1, 5, z1, x1 + 1, 6, pz1, roof);
    if (lv >= 4) { v.box(x0 + 1, 3, z1 + 1, x0 + 3, 4, z1 + 2, "woodDark"); person(v, x0 + 4, 2, z1 + 1, "blue", "blueDark", "#c98a5a"); }
  }
  // chimney with smoke
  const chx = V === 3 ? x1 : x0 + 1;
  const ch = chimney(v, chx, V === 3 ? 1 : top - 1, z0 + 2, V === 3 ? rt + 1 : rt - top + 3, V === 3 ? "stone" : "brickDark");
  c.smoke(chx + 1, ch, z0 + 3, "smoke");

  // ---- barn / outbuildings ----
  const roomR = hx - 1 - (x1 + 2);
  const bw = byLvn(lv, [5, 8, 11, 12, 14]);
  const bd = Math.min(hz * 2 - 3, byLvn(lv, [6, 9, 12, 13, 15]));
  let bx0 = x1 + 2;
  let bz0 = -hz + 1;
  let barnFits = roomR >= bw;
  if (!barnFits) {
    // stack behind the house instead (1x1 lots)
    bx0 = Math.max(-hx + 1, hx - 1 - bw);
    bz0 = -hz + 1;
    barnFits = z0 - bz0 >= 6;
  }
  const bdd = barnFits && bx0 <= x1 ? Math.min(bd, z0 - 1 - bz0) : bd;
  if (barnFits && bdd >= 4) {
    if (V === 0) {
      const bt = barn(v, bx0, bz0, bx0 + bw, bz0 + bdd, lv >= 4 ? 7 : 5, "red", "slate", "white", lv >= 3);
      if (lv >= 5) {
        const cx = Math.floor((2 * bx0 + bw) / 2);
        const cz = Math.floor((2 * bz0 + bdd) / 2);
        v.box(cx - 1, bt - 1, cz - 1, cx + 2, bt + 2, cz + 2, "white");
        v.box(cx - 2, bt + 2, cz - 2, cx + 3, bt + 3, cz + 3, "slate");
        v.box(cx, bt + 3, cz, cx + 1, bt + 6, cz + 1, "iron");
        v.box(cx - 1, bt + 5, cz, cx + 2, bt + 6, cz + 1, "gold");
      }
    }
    else if (V === 1) {
      v.box(bx0, 1, bz0, bx0 + bw, 4, bz0 + bdd, "stone");
      v.box(bx0, 4, bz0, bx0 + bw, 8, bz0 + bdd, "wood");
      for (let x = bx0 + 1; x < bx0 + bw; x += 2) v.box(x, 4, bz0 + bdd - 1, x + 1, 8, bz0 + bdd, "woodDark");
      gable(v, bx0 - 2, 8, bz0 - 1, bx0 + bw + 2, bz0 + bdd + 1, "z", "woodDark", "wood");
      if (lv >= 3) for (let i = 0; i < 3; i++) haybale(v, bx0 + 1 + i * 4, 1, bz0 + bdd + 2, false);
    } else if (V === 2) {
      v.box(bx0, 1, bz0, bx0 + bw, 4, bz0 + bdd, "brickDark");
      hip(v, bx0 - 1, 4, bz0 - 1, bx0 + bw + 1, bz0 + bdd + 1, "#c7a35a", "#a8873f");
      v.box(bx0 + 1, 1, bz0 + bdd - 1, bx0 + 4, 4, bz0 + bdd, "#2f7a46");
    } else {
      barn(v, bx0, bz0, bx0 + bw, bz0 + bdd, 5, "#8a5a32", "#5b4632", "#c9935b", false);
    }
  } else if (lv === 1) {
    // tiny shed + chickens
    const sx = hx - 6;
    v.box(sx, 1, -hz + 1, sx + 4, 4, -hz + 4, V === 0 ? "red" : "wood");
    gable(v, sx - 1, 4, -hz, sx + 5, -hz + 5, "x", roof);
  }
  // chickens everywhere
  c.critters({ kind: "chicken", count: 2 + lv, area: [-hx + 2, z1 + 2, hx - 2, hz - 1] });
  if (lv >= 2) {
    // vegetable garden / flower box
    if (V === 1) flowerBed(c, x0, hz - 2, x0 + 4, hz - 1);
    else if (lv < 5) crops(c, -hx + 1, -hz + 1, Math.min(-hx + 7, x1), Math.max(-hz + 3, z0 - 1), "cabbage", "z");
  }
  if (lv >= 3) {
    if (V === 3) {
      // horse corral
      const cx0 = Math.max(x1 + 2, hx - 13);
      pen(v, cx0, hz - 9, hx - 1, hz - 1, "#7d5530");
      c.critters({ kind: "horse", count: hx - cx0 > 10 ? 2 : 1, area: [cx0 + 1, hz - 8, hx - 2, hz - 2], coat: V });
    } else if (V === 2) {
      // little Dutch windmill
      const mx = hx - 4;
      const mz = hz - 4;
      v.cone(mx, 1, 12, mz, 3, 1.8, "#4a5a48");
      v.cone(mx, 12, 15, mz, 2.2, 0.5, "#c7a35a");
      const r = new PixelVox();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        for (let d = 1; d <= 7; d++) { r.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, d > 2 ? "white" : "woodDark"); }
      }
      r.put(0, 0, 0, "woodDark");
      c.addRotor({ vox: r, pivot: [mx, 12, mz + 3], axis: "z", speed: 0.9, wind: true });
    } else {
      // chicken coop + laundry line
      const lx = -hx + 2;
      const lz = lv >= 5 ? z0 - 2 : z0 - 4;
      v.box(lx, 1, lz, lx + 1, 5, lz + 1, "woodDark"); v.box(lx + 8, 1, lz, lx + 9, 5, lz + 1, "woodDark");
      for (let k = 1; k < 8; k++) v.put(lx + k, 4, lz, k % 2 ? ["white", "pink", "sky", "yellow"][k % 4] : "steelLight");
      for (let k = 1; k < 8; k += 2) v.put(lx + k, 3, lz, ["white", "pink", "sky", "red"][k % 4]);
    }
  }
  if (lv >= 4) {
    if (V === 0 || V === 3) windpump(c, hx - 3, -hz + bd + 4 < hz - 2 ? -hz + bd + 4 : 0, 1, 14, V === 3 ? "#c9935b" : "white");
    if (V === 0) silo(v, bx0 + bw + 3 > hx - 3 ? bx0 - 3 : bx0 + bw + 3, bz0 + 3, 1, 16, 2.4, "silver", "red", "steelLight");
    tractor(v, x1 + 4, 1, hz - 3, "x", 1, V === 1 ? "orange" : V === 2 ? "blue" : "red");
    tree(v, -hx + 2, 1, -hz + 2, V === 1 ? "pine" : V === 2 ? "willow" : "oak", 1.3, 1);
  }
  if (lv >= 5) {
    flag(v, x0 - 1 >= -hx ? x0 - 1 : x0, 1, hz - 2, 11, V === 1 ? ["red", "white", "red"] : V === 2 ? ["red", "white", "blue"] : ["red", "white", "blue"]);
    car(v, x1 + 6, 1, hz - 7, "x", V === 3 ? "red" : "sky");
    if (V === 1) {
      c.critters({ kind: "cow", count: 1, area: [hx - 10, hz - 5, hx - 2, hz - 1], coat: 2 });
      c.critters({ kind: "goat", count: 2, area: [hx - 6, -2, hx - 1, 4], coat: 0 });
    }
    if (V === 2) { crops(c, x1 + 2, hz - 8, hx - 9, hz - 1, "tulip", "z"); }
    // duck pond behind the house + beehives
    if (hz >= 12) {
      waterBlob(c, -hx + 8, -hz + 5.5, 6, 3.6, 7, "grass3");
      c.critters({ kind: "duck", count: 3, area: [-hx + 4, -hz + 4, -hx + 12, -hz + 8], coat: 1 });
      for (let k = 0; k < 4; k++) v.box(-hx + 2 + k * 4, 1, -hz + 2, -hx + 3 + k * 4, 3, -hz + 3, "leafLight");
    }
    beehive(v, x1 - 3, 1, -hz + 2);
    // proud front: picket fence, flower borders, mailbox, hay wagon
    const gx = Math.floor((x0 + x1) / 2);
    const fcol = V === 3 ? "#7d5530" : V === 1 ? "woodDark" : "white";
    for (let x = -hx + 1; x < hx - 1; x++) if (Math.abs(x - gx) > 1) v.box(x, 1, hz - 1, x + 1, x % 2 ? 3 : 2, hz, fcol);
    flowerBed(c, -hx + 1, hz - 3, gx - 2, hz - 2, 1, V === 1 ? ["red", "pink", "white"] : ["pink", "yellow", "red", "purple", "white"]);
    v.box(gx + 3, 1, hz - 2, gx + 4, 3, hz - 1, "woodDark"); v.box(gx + 3, 3, hz - 2, gx + 5, 4, hz - 1, V === 0 ? "red" : "slate");
    const wx = x1 + 3;
    v.box(wx, 1, 2, wx + 1, 2, 3, "rubber"); v.box(wx + 5, 1, 2, wx + 6, 2, 3, "rubber");
    v.box(wx - 1, 2, 1, wx + 7, 3, 5, "woodDark");
    v.box(wx, 3, 1, wx + 6, 5, 5, "#e2bd55");
    lamp(v, Math.floor((x0 + x1) / 2) + 2, 1, hz - 1, 5);
  }
}

function byLvn(lv: number, arr: number[]): number {
  return arr[Math.max(1, Math.min(5, lv)) - 1];
}

// =============================================================================================
// FIELDS — pure crop rows that spread into a vast patchwork.
//  V0 Golden Wheat (combine, round bales)   V1 Sunflower (giant heads, bee hives)
//  V2 Lavender (purple stripes, stone distillery hut)   V3 Rice Paddy (flooded terraces, water buffalo, straw hats)
// =============================================================================================
function buildFields(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  const crop: Crop = (["wheat", "sunflower", "lavender", "rice"] as const)[V];
  lot(c, V === 3 ? "grass" : "grass2");
  speckle(c, "grass3", 0.06);
  const inset = 1;
  const x0 = -hx + inset;
  const x1 = hx - inset;
  const z0 = -hz + inset;
  const z1 = hz - inset;

  if (V === 3) {
    // rice paddies: terraced steps along -z with curvy edges
    const steps = Math.min(lv, Math.max(1, Math.floor((hz * 2) / 7)));
    const stepD = (hz * 2) / steps;
    const g = terrain(
      c,
      (x, z) => {
        const k = Math.floor((hz - 1 - z + Math.round(Math.sin(x * 0.25) * 1.5)) / stepD);
        return Math.min(steps - 1, Math.max(0, k)) * 2;
      },
      (_x, y, _z, h, top) => (top ? "grass" : y === h - 1 ? "soil" : "soilDark"),
    );
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      const h = g(x, z);
      const edge = g(x + 1, z) !== h || g(x - 1, z) !== h || g(x, z + 1) !== h || g(x, z - 1) !== h || x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
      if (edge) { v.put(x, h + 1, z, "grass"); continue; }
      v.put(x, h, z, h2(x, z, 4) < 0.5 ? "#79c3cf" : "#6ab7c8", 0.1);
      if (x % 3 === 0 && z % 2 === 0) { v.put(x, h + 1, z, lv >= 3 ? "lime" : "leafLight"); if (lv >= 2 && h2(x, z, 9) < 0.4) v.put(x, h + 2, z, "leafLight"); }
    }
    // farmers with straw hats
    for (let i = 0; i < lv; i++) {
      const px = c.ri(x0 + 2, x1 - 3);
      const pz = c.ri(z0 + 2, z1 - 3);
      const h = g(px, pz);
      person(v, px, h + 1, pz, i % 2 ? "blue" : "white", "blueDark");
      v.box(px - 1, h + 4, pz - 1, px + 2, h + 5, pz + 2, "#e6c45c"); v.put(px, h + 5, pz, "#e6c45c");
    }
    if (lv >= 3) critter(v, "cow", x0 + 3, g(x0 + 3, z1 - 3) + 1, z1 - 3, "x", 1, 2);
    if (lv >= 4) {
      // bamboo hut with thatch
      const hxx = x1 - 8;
      const hzz = z0 + 1;
      const h = g(hxx, hzz);
      v.box(hxx, h + 1, hzz, hxx + 6, h + 5, hzz + 5, "#c9a26a");
      v.box(hxx + 2, h + 1, hzz + 4, hxx + 4, h + 4, hzz + 5, "woodDark");
      hip(v, hxx - 1, h + 5, hzz - 1, hxx + 7, hzz + 6, "#c7a35a", "#a8873f");
    }
    if (lv >= 5) {
      // water wheel turning on the top terrace + lanterns
      const wx = x0 + 4;
      const wz = z0 + 2;
      const h = g(wx, wz);
      const r = new PixelVox();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        for (let d = 1; d <= 4; d++) r.put(0, Math.round(Math.sin(a) * d), Math.round(Math.cos(a) * d), d === 4 ? "woodDark" : "wood");
      }
      c.addRotor({ vox: r, pivot: [wx, h + 5, wz + 4], axis: "x", speed: 0.8 });
      v.box(wx - 1, h + 1, wz + 3, wx, h + 6, wz + 5, "woodDark"); v.box(wx + 1, h + 1, wz + 3, wx + 2, h + 6, wz + 5, "woodDark");
      for (let x = x0 + 8; x < x1; x += 10) { v.box(x, g(x, z1 - 1) + 1, z1 - 1, x + 1, g(x, z1 - 1) + 5, z1, "woodDark"); v.put(x, g(x, z1 - 1) + 5, z1 - 1, "red", 1); }
    }
    return;
  }

  // patchwork: lv1 single plot, then more parcels of the signature crop with alt crops in between
  const parcels: [number, number, number, number, Crop, "x" | "z"][] = [];
  if (lv <= 2) parcels.push([x0, z0, x1, z1, crop, "z"]);
  else {
    const mx = Math.floor((x0 + x1) / 2) + (lv >= 4 ? -4 : 0);
    const mz = Math.floor((z0 + z1) / 2);
    const alt: Crop = (["corn", "wheat", "wheat", "rice"] as const)[V];
    parcels.push([x0, z0, mx - 1, mz - 1, crop, "z"]);
    parcels.push([mx + 1, z0, x1, mz - 1, lv >= 4 ? alt : crop, "x"]);
    parcels.push([x0, mz + 1, mx - 1, z1, lv >= 5 ? "corn" : crop, "x"]);
    parcels.push([mx + 1, mz + 1, x1, z1, crop, "z"]);
    v.box(-hx, 0, mz - 1, hx, 1, mz + 1, "path2");
    v.box(mx - 1, 0, -hz, mx + 1, 1, hz, "path2");
  }
  for (const [a, b, cc, d, cr, ax] of parcels) crops(c, a, b, cc, d, cr, ax);

  // per-variant props
  if (V === 0) {
    if (lv >= 2) for (let i = 0; i < lv; i++) haybale(v, x0 + 2 + i * 5, 1, z1 - 3, true);
    if (lv >= 1) scarecrow(v, 2, 1, -2, "red");
    if (lv >= 3) tractor(v, x1 - 8, 1, z0 + 4, "x", -1, "red");
    if (lv >= 4) {
      // irrigation ditch along the back
      v.box(-hx, 0, -hz, hx, 1, -hz + 1, "water", 0.1);
      windpump(c, -hx + 3, -hz + 3, 1, 14);
    }
    if (lv >= 5) {
      combine(v, Math.floor((x0 + x1) / 2) - 18, 1, Math.floor((z0 + z1) / 2) - 8, "x", 1, "leaf");
      grainBin(v, hx - 5, hz - 5, 1, 8, 3);
      grainBin(v, hx - 12, hz - 5, 1, 6, 2.5);
    }
  } else if (V === 1) {
    v.box(x0 + 1, 1, z1 - 1, x0 + 2, 4, z1, "woodDark"); v.box(x0, 4, z1 - 1, x0 + 4, 6, z1, "yellow", 0.3);
    if (lv >= 2) { beehive(v, x1 - 3, 1, z1 - 2); }
    if (lv >= 3) { beehive(v, x1 - 6, 1, z1 - 2); person(v, x0 + 3, 1, z1 - 2, "yellow", "blue"); }
    if (lv >= 4) {
      // wooden viewing tower
      const tx = x0 + 1;
      const tz = z0 + 1;
      for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) v.box(tx + dx, 1, tz + dz, tx + dx + 1, 9, tz + dz + 1, "woodDark");
      v.box(tx - 1, 9, tz - 1, tx + 5, 10, tz + 5, "wood");
      v.box(tx - 1, 10, tz - 1, tx + 5, 11, tz, "woodLight");
      v.box(tx - 1, 10, tz + 4, tx + 5, 11, tz + 5, "woodLight");
      person(v, tx + 2, 10, tz + 2, "red");
    }
    if (lv >= 5) {
      // giant legendary sunflower
      const gx = Math.floor((x0 + x1) / 2) + 3;
      const gz = Math.floor((z0 + z1) / 2) - 5;
      v.box(gx, 1, gz, gx + 2, 22, gz + 2, "leaf");
      v.box(gx - 3, 10, gz, gx, 11, gz + 2, "leafLight"); v.box(gx + 2, 14, gz, gx + 5, 15, gz + 2, "leafLight");
      for (let dx = -6; dx <= 7; dx++) for (let dy = -6; dy <= 7; dy++) {
        const d = Math.sqrt((dx - 0.5) ** 2 + (dy - 0.5) ** 2);
        if (d < 3.5) v.put(gx + dx, 26 + dy, gz + 2, d < 2 ? "woodDark" : "#6b3e1e");
        else if (d < 7) v.put(gx + dx, 26 + dy, gz + 2, (Math.atan2(dy, dx) * 6) % 2 > 1 ? "yellow" : "hazard");
      }
      v.box(gx, 21, gz, gx + 2, 26, gz + 2, "leaf");
    }
  } else {
    // lavender
    if (lv >= 2) { beehive(v, x1 - 3, 1, z1 - 2); person(v, x0 + 2, 1, z1 - 1, "white", "purple"); }
    if (lv >= 3) {
      // stone distillery hut with terracotta roof
      const sx = x1 - 9;
      const sz = z0;
      v.box(sx, 1, sz, sx + 8, 5, sz + 6, "limestone");
      v.box(sx + 3, 1, sz + 5, sx + 5, 4, sz + 6, "#6d8bb5");
      gable(v, sx - 1, 5, sz - 1, sx + 9, sz + 7, "x", "terracotta");
      const chy = chimney(v, sx + 6, 5, sz + 1, 5, "stone");
      c.smoke(sx + 7, chy, sz + 2, "steam");
    }
    if (lv >= 4) { tree(v, x0 + 2, 1, z0 + 2, "cypress", 1.3); tree(v, x0 + 2, 1, z0 + 8, "cypress", 1.2); v.box(x0, 0, z1 - 1, x1, 1, z1, "path"); }
    if (lv >= 5) {
      // vintage blue tractor + château-style watch tower dovecote
      tractor(v, x0 + 10, 1, z1 - 4, "x", 1, "#6d8bb5", "purple");
      const tx = x0 + 1;
      const tz = z1 - 8;
      v.cylinderY(tx + 2.5, tz + 2.5, 1, 14, 2.6, "limestone");
      v.cone(tx + 2.5, 14, 19, tz + 2.5, 3.2, 0.4, "terracotta");
      for (let y = 4; y < 13; y += 4) v.put(tx + 2, y, tz + 5, "glassDark");
    }
  }
}

// =============================================================================================
// ORCHARDS — rows of fruit trees that mature into a heritage orchard.
//  V0 Apple (red apples, cider barn)  V1 Cherry Blossom (pink canopy, tea pavilion + lanterns)
//  V2 Orange Grove (citrus, mission-style packing house)  V3 Peach (peach fruit, roadside stand & beehives)
// =============================================================================================
function buildOrchards(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  const kind = ["apple", "cherry", "orange", "peach"][V];
  lot(c, V === 2 ? "#a6c46a" : "grass2");
  speckle(c, V === 1 ? "pink" : "grass3", V === 1 ? 0.05 : 0.08);
  const size = byLvn(lv, [0.6, 0.85, 1.0, 1.1, 1.15]);
  const sx = lv === 1 ? 6 : 7;
  const sz = lv === 1 ? 6 : 7;
  const front = lv >= 2 ? 5 : 2;
  // building zone (lv4+) at back-right
  const bW = lv >= 4 ? 14 : 0;
  const bD = lv >= 4 ? 11 : 0;
  const centerFree = lv >= 5;
  const cxm = 0;
  const czm = Math.floor((-hz + hz - front) / 2);
  // mown grass alleys between rows
  for (let z = -hz + 3; z < hz - front; z += sz) v.box(-hx + 1, 0, z - 1, hx - 1, 1, z + 2, V === 2 ? "#b7c977" : "grass3");
  for (let x = -hx + 3; x < hx - 1; x += sx) {
    for (let z = -hz + 3; z < hz - front; z += sz) {
      if (bW && x > hx - bW - 3 && z < -hz + bD + 2) continue;
      if (centerFree && Math.abs(x - cxm) < 9 && Math.abs(z - czm) < 9) continue;
      const treeX = lv === 1 ? x : x + Math.round((h2(x, z, V + 4) - 0.5) * 1.8);
      const treeZ = lv === 1 ? z : z + Math.round((h2(x, z, V + 19) - 0.5) * 1.8);
      v.put(treeX, 0, treeZ, "soil");
      if (lv === 1) {
        // Young whips have a visible stake and graft, before their first harvest.
        v.box(x + 1, 1, z, x + 2, 5, z + 1, "woodLight");
        v.box(x, 1, z, x + 1, 4, z + 1, "woodDark");
        v.put(x, 3, z, "path");
        const leaf = ["leaf", "pink", "leafDark", "leafLight"][V];
        v.put(x - 1, 4, z, leaf);
        v.put(x, 5, z, leaf);
        if (V === 1 || V === 3) v.put(x, 4, z + 1, V === 1 ? "cream" : "pink");
        if (V === 2) v.put(x - 1, 5, z + 1, "leaf");
      } else fruitTree(c, treeX, 1, treeZ, kind, size * (0.84 + c.rand() * 0.35));
    }
  }
  // front lane
  v.box(-hx, 0, hz - front + 1, hx, 1, hz - front + 3, "path2");
  if (lv === 1) { v.box(-hx + 1, 1, hz - 2, -hx + 4, 2, hz - 1, "steelDark"); v.put(-hx + 4, 1, hz - 1, "rubber"); return; }
  const fruit = kind === "apple" ? "red" : kind === "orange" ? "orange" : kind === "peach" ? "#f6a77a" : "pink";
  // crates & pickers
  for (let i = 0; i < lv; i++) {
    const x = -hx + 2 + i * 3, z = hz - 3;
    if (i % 2) {
      // Bent willow handles arch over the harvest, beside the square packing crates.
      v.cylinderY(x + 0.5, z + 0.5, 1, 3, 1.6, "woodLight");
      v.put(x, 2, z, fruit);
      for (const dx of [-1, 1]) v.put(x + dx, 3, z, "oak");
      v.put(x, 4, z, "oak");
    } else crate(v, x, 1, z, fruit);
  }
  if (lv >= 3) {
    for (let i = 0; i < 2; i++) {
      const px = -hx + 4 + i * sx * 2;
      const pz = -hz + 3 + sz;
      if (px < hx - 2) { ladder(v, px + 1, 1, pz + 2, 5); person(v, px + 2, 4, pz + 3, i % 2 ? "blue" : "red"); }
    }
    tractor(v, 0, 1, hz - front + 2, "x", 1, V === 2 ? "orange" : V === 0 ? "red" : "leaf", fruit);
  }
  if (lv >= 4) {
    const x0 = hx - bW;
    const z0 = -hz + 1;
    if (V === 0) {
      barn(v, x0, z0, x0 + 12, z0 + bD - 1, 6, "red", "slate", "white", true);
      v.cylinderY(x0 - 2, z0 + 3, 1, 3, 1.4, "woodDark"); v.cylinderY(x0 - 2, z0 + 6, 1, 3, 1.4, "woodDark");
    } else if (V === 1) {
      // tea pavilion with curved roof + lanterns
      v.box(x0 + 1, 1, z0 + 1, x0 + 12, 2, z0 + bD - 1, "woodLight");
      for (const [px, pz] of [[x0 + 2, z0 + 2], [x0 + 10, z0 + 2], [x0 + 2, z0 + bD - 3], [x0 + 10, z0 + bD - 3]]) v.box(px, 2, pz, px + 1, 6, pz + 1, "redDark");
      hip(v, x0, 6, z0, x0 + 13, z0 + bD, "charcoal", "redDark");
      for (const px of [x0, x0 + 12]) { v.put(px, 5, z0, "red", 1); v.put(px, 5, z0 + bD - 1, "red", 1); }
      person(v, x0 + 6, 2, z0 + 5, "pink", "purpleDark");
    } else if (V === 2) {
      // mission-style packing house: white stucco, terracotta, bell gable
      v.box(x0, 1, z0, x0 + 13, 6, z0 + bD - 1, "plaster");
      v.clear(x0 + 1, 2, z0 + 1, x0 + 12, 5, z0 + bD - 2);
      for (let x = x0 + 1; x < x0 + 12; x += 4) v.box(x, 1, z0 + bD - 2, x + 2, 4, z0 + bD - 1, "woodDark");
      gable(v, x0 - 1, 6, z0 - 1, x0 + 14, z0 + bD, "x", "terracotta");
      v.box(x0 + 4, 6, z0 + bD - 2, x0 + 9, 11, z0 + bD - 1, "plaster");
      v.put(x0 + 6, 9, z0 + bD - 1, "brass");
      v.box(x0 + 3, 7, z0 + bD - 1, x0 + 10, 8, z0 + bD, "orange", 0.5);
      truck(v, x0 + 4, 1, z0 + bD + 2, "x", "orange", "white");
    } else {
      // roadside peach stand
      v.box(x0 + 1, 1, z0 + 2, x0 + 11, 3, z0 + 6, "woodLight");
      for (let x = x0 + 1; x < x0 + 11; x++) v.put(x, 3, z0 + 3 + (x % 2), "#f6a77a");
      for (const px of [x0 + 1, x0 + 10]) v.box(px, 3, z0 + 2, px + 1, 7, z0 + 3, "woodDark");
      for (let x = x0; x < x0 + 12; x++) v.box(x, 7, z0 + 1, x + 1, 8, z0 + 7, x % 2 ? "#f6a77a" : "white");
      v.box(x0 + 3, 8, z0 + 2, x0 + 9, 11, z0 + 3, "#f6a77a", 0.4);
      v.box(x0 + 5, 9, z0 + 3, x0 + 7, 10, z0 + 4, "leaf");
      for (let i = 0; i < 3; i++) beehive(v, x0 + 1 + i * 4, 1, z0 + 8);
    }
  }
  if (lv >= 5) {
    // legendary mother tree in the centre, ringed by a bench circle
    v.cylinderY(cxm + 0.5, czm + 0.5, 0, 1, 6, V === 1 ? "pink" : "path");
    const top = fruitTree(c, cxm, 1, czm, kind, 4.4);
    v.box(cxm - 1, 1, czm - 1, cxm + 2, 6, czm + 2, "woodDark");
    for (const [dx, dz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) v.box(cxm + dx, 1, czm + dz, cxm + dx + 1, 2, czm + dz + 1, "wood");
    if (V === 1) for (const [dx, dz] of [[-6, -6], [6, 6]]) { v.box(cxm + dx, 1, czm + dz, cxm + dx + 1, 5, czm + dz + 1, "stone"); v.put(cxm + dx, 5, czm + dz, "warmGlow", 1.2); }
    if (V === 0) {
      // cider mill water wheel
      const r = new PixelVox();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; for (let d = 1; d <= 3; d++) r.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, "woodDark"); }
      c.addRotor({ vox: r, pivot: [hx - bW - 3, 4, -hz + 4], axis: "z", speed: 0.7 });
    }
    void top;
    beehive(v, hx - 4, 1, hz - 2);
    person(v, cxm - 3, 1, czm + 4, "teal", "blueDark");
  }
}

// =============================================================================================
// GROVES OF OLIVES — silvery olives on dry-stone terraces, growing into an ancient estate.
//  V0 Tuscan (cypress avenue, ochre villa)  V1 Greek Isles (whitewash, blue-domed chapel)
//  V2 Andalusian (red earth, white cortijo, straight rows)  V3 Levantine Ancient (sandstone press, millennia-old trees)
// =============================================================================================
function buildOlives(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  const soil = ["#b98a5a", "#c9a874", "#b5603e", "#c49a62"][V];
  const soil2 = ["#a87a4c", "#b8966a", "#a14f33", "#b38955"][V];
  const wallA = ["stone", "limestone", "#d8cdb8", "sandDark"][V];
  const wallB = ["granite", "white", "limestone", "sand"][V];
  lot(c, soil);
  const steps = Math.max(1, Math.min(lv + 1, Math.floor((hz * 2) / 7)));
  const stepD = (hz * 2) / steps;
  const g = terrain(
    c,
    (x, z) => {
      const edgeDist = Math.min(x + hx, hx - 1 - x, z + hz, hz - 1 - z);
      if (edgeDist === 0) return 0;
      const edgeBlend = Math.min(1, edgeDist / 3);
      const wob = V === 2 ? 0 : Math.round(Math.sin(x * 0.18 + V) * 1.4);
      const k = Math.floor((hz - 1 - z + wob) / stepD);
      return Math.round(Math.min(steps - 1, Math.max(0, k)) * 3 * edgeBlend);
    },
    (x, y, z, _h, top) => (top ? (h2(x, z, 3) < 0.2 ? soil2 : soil) : h2(x, y * 7 + z, 5) < 0.5 ? wallA : wallB),
  );
  speckle(c, soil2, 0.05);
  // villa / press zone
  const bx1 = hx - 1;
  const bW = lv >= 3 ? Math.min(14, hx) : 0;
  const bx0 = bx1 - bW;
  const bz0 = -hz + 1;
  const bD = lv >= 3 ? 10 : 0;
  const ancient = lv >= 5;
  const ax = -4;
  const az = hz - 9;
  for (let x = -hx + 3; x < hx - 2; x += V === 2 ? 7 : 8) {
    for (let z = -hz + 3; z < hz - 2; z += 7) {
      if (bW && x >= bx0 - 3 && z < bz0 + bD + 2) continue;
      if (ancient && Math.abs(x - ax) < 8 && Math.abs(z - az) < 7) continue;
      const xx = x + (V === 2 ? 0 : (Math.floor(z / 7) % 2) * 4);
      if (xx >= hx - 2) continue;
      fruitTree(c, xx, g(xx, z) + 1, z, "olive", byLvn(lv, [0.8, 1.0, 1.1, 1.2, 1.25]) * (0.85 + c.rand() * 0.3));
    }
  }
  // stairs between terraces
  const sx = -hx + 1;
  for (let z = -hz; z < hz; z++) v.put(sx, g(sx, z) + 0, z, "path2");
  // cypress (Tuscan) / props
  if (V === 0 && lv >= 2) for (let z = -hz + 2; z < hz - 1; z += 5) tree(v, hx - 2, g(hx - 2, z) + 1, z, "cypress", 1.3);
  if (lv >= 2) {
    // harvest nets under a tree + baskets
    const nx = -hx + 6;
    const nz = hz - 4;
    v.box(nx - 3, g(nx, nz), nz - 2, nx + 4, g(nx, nz) + 1, nz + 2, V === 1 ? "#3a8a6a" : "#4b8a4b");
    for (let i = 0; i < 6; i++) v.put(nx - 2 + i, g(nx, nz) + 1, nz - 1 + (i % 3), "#3d4430");
    person(v, nx + 3, g(nx, nz) + 1, nz + 2, V === 1 ? "sky" : "white", "woodDark");
  }
  if (lv >= 3) {
    const by = g(bx0 + 2, bz0 + 2);
    const wall = ["#e7c98a", "white", "white", "#e0c48e"][V];
    const roof = ["terracotta", "white", "terracotta", "#c9a26a"][V];
    // press house
    v.box(bx0, by + 1, bz0, bx1, by + 6, bz0 + bD - 2, wall);
    v.clear(bx0 + 1, by + 2, bz0 + 1, bx1 - 1, by + 5, bz0 + bD - 3);
    windows(c, bx0, by + 1, bz0, bx1, by + 6, bz0 + bD - 2, { faces: "s", h: 2, stepH: 4, col: V === 1 ? "blue" : "glass" });
    door(v, bx0 + 2, by + 1, bz0 + bD - 3, V === 1 ? "blue" : "woodDark");
    if (V === 1) {
      v.box(bx0, by + 6, bz0, bx1, by + 7, bz0 + bD - 2, "white");
      v.dome(bx0 + 4, by + 7, bz0 + 4, 3, "blue");
      v.put(bx0 + 4, by + 11, bz0 + 4, "gold");
      v.put(bx0 + 4, by + 12, bz0 + 4, "gold");
    } else if (V === 3) {
      v.box(bx0, by + 6, bz0, bx1, by + 7, bz0 + bD - 2, "sandDark");
      for (let x = bx0 + 1; x < bx1 - 1; x += 3) v.box(x, by + 1, bz0 + bD - 2, x + 2, by + 4, bz0 + bD - 1, "#c49a62");
    } else {
      gable(v, bx0 - 1, by + 6, bz0 - 1, bx1 + 1, bz0 + bD - 1, "x", roof);
    }
    // donkey-mill: millstone turning around a post
    const mx = bx0 + 6;
    const mz = bz0 + bD + 1;
    const my = g(mx, mz);
    v.cylinderY(mx + 0.5, mz + 0.5, my + 1, my + 2, 3, "granite");
    const r = new PixelVox();
    r.box(-1, 0, -1, 2, 3, 2, "stone");
    r.box(0, 3, 0, 1, 5, 1, "woodDark");
    for (let d = 2; d <= 4; d++) r.put(d, 3, 0, "woodDark");
    r.box(5, -1, 0, 6, 1, 1, "#8d8378");
    critter(r, "donkey", 5, -1, -2, "z", 1, 0);
    c.addRotor({ vox: r, pivot: [mx, my + 2, mz], axis: "y", speed: 0.5 });
    // amphorae
    for (let i = 0; i < 3; i++) { const ax2 = bx0 + 1 + i * 2; v.box(ax2, my + 1, mz + 3, ax2 + 1, my + 3, mz + 4, "terracotta"); v.put(ax2, my + 3, mz + 3, "brickDark"); }
  }
  if (lv >= 4) {
    // villa / chapel annex + a stone wall with gate
    const vx0 = -hx + 2;
    const vz0 = -hz + 1;
    const vy = g(vx0 + 2, vz0 + 2);
    if (V === 1) {
      // blue-domed chapel
      v.box(vx0, vy + 1, vz0, vx0 + 7, vy + 7, vz0 + 7, "white");
      v.dome(vx0 + 3.5, vy + 7, vz0 + 3.5, 3.2, "blue");
      v.box(vx0 + 3, vy + 10, vz0 + 3, vx0 + 4, vy + 13, vz0 + 4, "white");
      v.box(vx0 + 2, vy + 12, vz0 + 3, vx0 + 5, vy + 13, vz0 + 4, "white");
      door(v, vx0 + 2, vy + 1, vz0 + 6, "blue", 2, 3, false);
    } else {
      const wall = V === 3 ? "#e0c48e" : V === 2 ? "white" : "#e7c98a";
      v.box(vx0, vy + 1, vz0, vx0 + 10, vy + 9, vz0 + 8, wall);
      v.clear(vx0 + 1, vy + 2, vz0 + 1, vx0 + 9, vy + 8, vz0 + 7);
      windows(c, vx0, vy + 1, vz0, vx0 + 10, vy + 9, vz0 + 8, { stepV: 4, h: 2, emit: 0.5, col: "glass", sill: V === 0 ? "#2f7a46" : "woodDark" });
      if (V === 3) { v.box(vx0, vy + 9, vz0, vx0 + 10, vy + 10, vz0 + 8, "sandDark"); v.box(vx0 + 3, vy + 10, vz0 + 2, vx0 + 7, vy + 12, vz0 + 5, "#e0c48e"); }
      else hip(v, vx0 - 1, vy + 9, vz0 - 1, vx0 + 11, vz0 + 9, "terracotta");
      if (V === 0) { v.box(vx0 + 7, vy + 9, vz0 + 1, vx0 + 10, vy + 15, vz0 + 4, wall); hip(v, vx0 + 6, vy + 15, vz0, vx0 + 11, vz0 + 5, "terracotta"); }
    }
  }
  if (lv >= 5) {
    // ancient 1000-year olive giant
    const ay = g(ax, az);
    v.cylinderY(ax + 0.5, az + 0.5, ay, ay + 1, 5, wallA);
    v.cylinderY(ax + 0.5, az + 0.5, ay, ay + 1, 4.2, soil2);
    fruitTree(c, ax, ay + 1, az, "olive", 3.4);
    person(v, ax + 4, ay + 1, az + 4, "white", "slate");
    for (const [dx, dz] of [[-5, 4], [5, -4]]) { v.box(ax + dx, ay + 1, az + dz, ax + dx + 1, ay + 5, az + dz + 1, "iron"); v.put(ax + dx, ay + 5, az + dz, "warmGlow", 1.2); }
  }
}

// =============================================================================================
// PLANTATIONS — big agricultural estates crowned by a manor.
//  V0 Tea Terraces (bright contour hedges on stepped hillside, pickers, tea factory)
//  V1 Coffee Hacienda (coffee shrubs under shade trees, bean drying patios, terracotta hacienda)
//  V2 Sugarcane Estate (tall cane, sugar mill with smokestack, cane cart, white pillared manor)
//  V3 Vineyard Château (vine rows on rolling slopes, barrels, turreted château, cypresses)
// =============================================================================================
function buildPlantations(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const V = c.variant % 4;
  lot(c, V === 1 ? "grass" : "grass2");
  speckle(c, "grass3", 0.06);
  // manor zone: back-left
  const mW = byLvn(lv, [9, 12, 15, 18, 20]);
  const mD = byLvn(lv, [8, 9, 11, 12, 14]);
  const mx0 = -hx + 2;
  const mz0 = -hz + 2;
  const mx1 = Math.min(hx - 2, mx0 + mW);
  const mz1 = Math.min(hz - 6, mz0 + mD);
  // crop area: everything else
  let g: (x: number, z: number) => number = () => 0;
  if (V === 0) {
    // stepped tea hillside rising to the back-right, hedges follow the contours
    const steps = Math.min(1 + lv, Math.floor(hz / 3));
    const contour = (x: number, z: number) => (hz - z) * 0.7 + (x + hx) * 0.35 + Math.sin(x * 0.2) * 2;
    const inManor = (x: number, z: number) => x < mx1 + 3 && z < mz1 + 3;
    g = terrain(
      c,
      (x, z) => {
        if (inManor(x, z)) return 0;
        const edgeDist = Math.min(x + hx, hx - 1 - x, z + hz, hz - 1 - z);
        if (edgeDist === 0) return 0;
        const edgeBlend = Math.min(1, edgeDist / 3);
        return Math.round(Math.min(steps, Math.max(0, Math.floor(contour(x, z) / 7))) * 2 * edgeBlend);
      },
      (x, y, z, h, top) => (top ? "soil" : y >= h - 1 && h2(x, z, 2) < 0.5 ? "leafDark" : "soilDark"),
    );
    for (let x = -hx + 1; x < hx - 1; x++) for (let z = -hz + 1; z < hz - 1; z++) {
      if (inManor(x, z) || (x > hx - 17 && z < -hz + 13 && lv >= 4)) continue;
      const h = g(x, z);
      if (Math.floor(contour(x, z)) % 3 !== 2) {
        v.put(x, h + 1, z, "leafDark");
        v.put(x, h + 2, z, h2(x, z, 8) < 0.45 ? "leaf" : h2(x, z, 8) < 0.8 ? "#52a64a" : "lime");
      } else v.put(x, h, z, "path2");
    }
  } else {
    const crop: Crop = (["tea", "coffee", "cane", "vine"] as const)[V];
    const ax: "x" | "z" = V === 3 ? "z" : "x";
    // rows around the manor: right block + front block
    crops(c, mx1 + 3, -hz + 1, hx - 1, hz - 1, crop, ax);
    crops(c, -hx + 1, mz1 + 3, mx1 + 2, hz - 1, crop, ax);
    v.box(mx1 + 1, 0, -hz, mx1 + 3, 1, hz, "path2");
    v.box(-hx, 0, mz1 + 1, mx1 + 1, 1, mz1 + 3, "path2");
    if (V === 1) {
      // shade trees
      for (let x = mx1 + 6; x < hx - 2; x += 10) for (let z = -hz + 4; z < hz - 2; z += 10) tree(v, x, 1, z, "round", 1.2, x + z);
    }
  }

  // ---- manor / processing buildings ----
  const roofCol = ["#2f6b5c", "terracotta", "slate", "slate"][V];
  const wall = ["#f3e2c3", "#f2e1c0", "white", "limestone"][V];
  const floors = lv >= 3 ? 2 : 1;
  const top = 1 + floors * 4;
  // hens scratch about on the lane in front of the manor
  if (lv >= 2 && V !== 0) c.critters({ kind: "chicken", count: 1 + lv, area: [mx0, mz1 + 1, mx1, mz1 + 3], coat: V });
  if (lv === 1) {
    // planter's hut
    v.box(mx0, 1, mz0, mx0 + 7, 5, mz0 + 6, V === 0 ? "woodLight" : "wood");
    door(v, mx0 + 2, 1, mz0 + 5, "woodDark");
    hip(v, mx0 - 1, 5, mz0 - 1, mx0 + 8, mz0 + 7, V === 0 ? "#2f6b5c" : "#c7a35a", "#a8873f");
  } else {
    v.box(mx0, 1, mz0, mx1, top, mz1, wall);
    v.clear(mx0 + 1, 2, mz0 + 1, mx1 - 1, top - 1, mz1 - 1);
    windows(c, mx0, 1, mz0, mx1, top, mz1, { stepV: 4, stepH: 3, h: 2, emit: 0.55, sill: V === 2 ? "#2f7a46" : "woodDark" });
    // verandah with columns
    v.box(mx0 - 1, 1, mz1, mx1 + 1, 2, mz1 + 3, V === 1 ? "terracotta" : "marbleShade");
    for (let x = mx0; x < mx1; x += 3) v.box(x, 2, mz1 + 2, x + 1, top, mz1 + 3, V === 1 ? "#f2e1c0" : "white");
    v.box(mx0 - 1, top, mz1, mx1 + 1, top + 1, mz1 + 3, V === 2 ? "white" : roofCol);
    if (floors >= 2) v.box(mx0 - 1, 5, mz1, mx1 + 1, 6, mz1 + 3, "white");
    door(v, Math.floor((mx0 + mx1) / 2) - 1, 2, mz1 - 1, "woodDark");
    let rt: number;
    if (V === 0) {
      // pagoda-flared roof
      rt = hip(v, mx0 - 2, top, mz0 - 2, mx1 + 2, mz1 + 2, roofCol, "#e6c45c");
      for (const [px, pz] of [[mx0 - 2, mz0 - 2], [mx1 + 1, mz0 - 2], [mx0 - 2, mz1 + 1], [mx1 + 1, mz1 + 1]]) v.put(px, top + 1, pz, roofCol);
    } else if (V === 1) {
      rt = hip(v, mx0 - 1, top, mz0 - 1, mx1 + 1, mz1 + 1, "terracotta");
    } else if (V === 2) {
      rt = hip(v, mx0 - 1, top, mz0 - 1, mx1 + 1, mz1 + 1, roofCol, "white");
      // pediment-ish gable over the porch
      if (lv >= 4) {
        const cx = Math.floor((mx0 + mx1) / 2);
        for (let k = 0; k < 4; k++) v.box(cx - 5 + k, top + 1 + k, mz1, cx + 5 - k, top + 2 + k, mz1 + 3, "white");
      }
    } else {
      // château mansard + corner towers
      rt = hip(v, mx0 - 1, top, mz0 - 1, mx1 + 1, mz1 + 1, "slate", "steelDark");
      if (lv >= 3) for (const [tx, tz] of [[mx0, mz1 - 1], [mx1 - 1, mz1 - 1]]) {
        v.cylinderY(tx + 0.5, tz + 0.5, 1, top + 3, 2.2, "limestone");
        v.cone(tx + 0.5, top + 3, top + 10, tz + 0.5, 2.8, 0.3, "slate");
        v.put(tx, top + 10, tz, "gold");
      }
    }
    const chy = chimney(v, mx0 + 2, top, mz0 + 2, rt - top + 2, "brickDark");
    c.smoke(mx0 + 3, chy, mz0 + 3, "smoke");
    if (lv >= 5) {
      // belvedere / cupola crowning the manor
      const cx = Math.floor((mx0 + mx1) / 2);
      const cz = Math.floor((mz0 + mz1) / 2);
      v.box(cx - 2, rt - 1, cz - 2, cx + 3, rt + 3, cz + 3, V === 1 ? "#f2e1c0" : "white");
      v.box(cx - 1, rt, cz - 2, cx + 2, rt + 2, cz + 3, "glass", 0.5);
      v.box(cx - 2, rt, cz - 1, cx + 3, rt + 2, cz + 2, "glass", 0.5);
      if (V === 3) v.cone(cx + 0.5, rt + 3, rt + 8, cz + 0.5, 3.2, 0.3, "slate");
      else if (V === 0) { v.box(cx - 3, rt + 3, cz - 3, cx + 4, rt + 4, cz + 4, "#2f6b5c"); v.box(cx - 1, rt + 4, cz - 1, cx + 2, rt + 5, cz + 2, "#2f6b5c"); v.put(cx, rt + 5, cz, "gold"); }
      else v.dome(cx + 0.5, rt + 3, cz + 0.5, 2.6, V === 1 ? "terracotta" : "copper");
      // side wings
      if (mx1 + 8 < hx) {
        v.box(mx1, 1, mz0 + 2, mx1 + 6, 6, mz1 - 1, wall);
        windows(c, mx1, 1, mz0 + 2, mx1 + 6, 6, mz1 - 1, { h: 2, emit: 0.55, faces: "se" });
        hip(v, mx1 - 1, 6, mz0 + 1, mx1 + 7, mz1, V === 2 ? roofCol : V === 1 ? "terracotta" : roofCol);
      }
    }
  }

  // ---- processing / estate features ----
  if (lv >= 2) {
    const fx = hx - 12;
    const fz = hz - 10;
    if (V === 0) {
      for (let i = 0; i < lv + 1; i++) { const px = c.ri(mx1 + 4, hx - 3); const pz = c.ri(-hz + 3, hz - 3); const h = g(px, pz); person(v, px, h + 1, pz, ["pink", "orange", "yellow", "teal"][i % 4], "purpleDark"); v.box(px, h + 2, pz - 1, px + 1, h + 3, pz, "#c9a26a"); }
    } else if (V === 1) {
      // bean drying patio
      const px0 = -hx + 2;
      const pz0 = mz1 + 4;
      if (pz0 + 6 < hz) {
        v.box(px0, 0, pz0, px0 + 12, 1, pz0 + 6, "concrete");
        for (let x = px0 + 1; x < px0 + 11; x++) for (let z = pz0 + 1; z < pz0 + 5; z++) v.put(x, 1, z, h2(x, z, 1) < 0.5 ? "#6b3e1e" : "#8a5a32");
        person(v, px0 + 6, 1, pz0 + 5, "white", "woodDark");
      }
    } else if (V === 2) {
      // cane cart
      critter(v, "cow", fx, 1, fz + 2, "x", 1, 2);
      v.box(fx - 7, 1, fz + 1, fx - 1, 3, fz + 4, "woodDark");
      v.box(fx - 7, 3, fz + 1, fx - 1, 5, fz + 4, "lime");
      v.box(fx - 6, 0, fz, fx - 4, 2, fz + 1, "woodDark");
    } else {
      // barrels
      for (let i = 0; i < lv + 2; i++) { v.cylinderY(mx1 + 4 + i * 3, hz - 3, 1, 4, 1.3, "oak"); v.cylinderY(mx1 + 4 + i * 3, hz - 3, 2, 3, 1.4, "iron"); }
    }
  }
  if (lv >= 3) {
    if (V === 3 || V === 0) {
      // cypress / camellia avenue along the drive
      for (let z = mz1 + 4; z < hz - 1; z += 4) tree(v, Math.floor((mx0 + mx1) / 2) - 4, g(0, z) + 1, z, V === 3 ? "cypress" : "round", V === 3 ? 1.3 : 0.8, z);
      for (let z = mz1 + 4; z < hz - 1; z += 4) tree(v, Math.floor((mx0 + mx1) / 2) + 4, g(0, z) + 1, z, V === 3 ? "cypress" : "round", V === 3 ? 1.3 : 0.8, z + 1);
      v.box(Math.floor((mx0 + mx1) / 2) - 2, 0, mz1 + 3, Math.floor((mx0 + mx1) / 2) + 2, 1, hz, "path");
    } else {
      for (let z = mz1 + 4; z < hz - 1; z += 5) { tree(v, mx0 + 1, 1, z, "palm", 1.3); tree(v, mx1 - 2, 1, z, "palm", 1.3); }
      v.box(Math.floor((mx0 + mx1) / 2) - 2, 0, mz1 + 3, Math.floor((mx0 + mx1) / 2) + 2, 1, hz, "path");
    }
  }
  if (lv >= 4) {
    // processing works: tea factory / roastery / sugar mill / winery
    const wx1 = hx - 2;
    const wx0 = wx1 - 14;
    const wz0 = -hz + 2;
    const wy = g(wx0, wz0);
    const wcol = ["#e8e0d0", "#f2e1c0", "brick", "limestone"][V];
    v.box(wx0, wy + 1, wz0, wx1, wy + 8, wz0 + 9, wcol);
    v.clear(wx0 + 1, wy + 2, wz0 + 1, wx1 - 1, wy + 7, wz0 + 8);
    windows(c, wx0, wy + 1, wz0, wx1, wy + 8, wz0 + 9, { stepV: 3, stepH: 2, emit: 0.5 });
    if (V === 2) {
      gable(v, wx0 - 1, wy + 8, wz0 - 1, wx1 + 1, wz0 + 10, "x", "steelDark");
      const st = chimney(v, wx1 - 4, wy + 1, wz0 + 3, 18, "brickDark", 2, "charcoal");
      c.smoke(wx1 - 3, st, wz0 + 4, "dark");
      // crushing wheel
      const r = new PixelVox();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; for (let d = 1; d <= 4; d++) r.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, d === 4 ? "iron" : "steelDark"); }
      c.addRotor({ vox: r, pivot: [wx0 + 4, wy + 6, wz0 + 10], axis: "z", speed: 1.2 });
    } else if (V === 0) {
      for (let k = 0; k < 3; k++) v.box(wx0 - 1 + k, wy + 8 + k * 2, wz0 - 1 + k, wx1 + 1 - k, wy + 9 + k * 2, wz0 + 10 - k, "#2f6b5c");
      c.smoke(wx0 + 4, wy + 14, wz0 + 4, "steam");
    } else if (V === 1) {
      gable(v, wx0 - 1, wy + 8, wz0 - 1, wx1 + 1, wz0 + 10, "x", "terracotta");
      const st = chimney(v, wx0 + 2, wy + 8, wz0 + 4, 6, "brick");
      c.smoke(wx0 + 3, st, wz0 + 5, "smoke");
    } else {
      hip(v, wx0 - 1, wy + 8, wz0 - 1, wx1 + 1, wz0 + 10, "terracotta");
      for (let i = 0; i < 3; i++) v.cylinderY(wx0 + 3 + i * 4, wz0 + 11.5, 1, 7, 1.6, "chrome");
    }
  }
  if (lv >= 5) {
    // grand finale: fountain on the forecourt, flag, cars, lamps
    const cx = Math.floor((mx0 + mx1) / 2);
    const cz = Math.min(hz - 4, mz1 + 7);
    v.cylinderY(cx, cz, 0, 1, 4.5, "path");
    v.cylinderY(cx, cz, 1, 2, 3, "marble");
    v.cylinderY(cx, cz, 1, 2, 2.2, "water", 0.2);
    v.box(cx, 2, cz - 1, cx + 1, 5, cz, "marble");
    c.smoke(cx, 5, cz - 1, "steam");
    flag(v, mx1 + 1, top + 1, mz0, 8, V === 3 ? ["blue", "white", "red"] : ["leafDark", "gold", "white"]);
    for (const lx of [cx - 6, cx + 6]) lamp(v, lx, 1, cz, 5);
    car(v, cx - 3, 1, hz - 2, "x", V === 3 ? "black" : "crimson");
    if (V === 0) {
      // pagoda viewing pavilion on the hilltop
      const px = hx - 6;
      const pz = -hz + 14;
      const py = g(px, pz);
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) v.box(px + dx, py + 1, pz + dz, px + dx + 1, py + 5, pz + dz + 1, "redDark");
      v.cone(px + 0.5, py + 5, py + 9, pz + 0.5, 4, 0.4, "#2f6b5c");
    }
  }
}

defineDesigns({
  farms: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [4, 3]],
    levels: ["Backyard Smallholding", "Family Farm & Barn", "Silo & Windpump Farm", "Crop-Circle Pivot Farm", "Agri-Empire Ranch"],
    growth: "Sprawls from a shed and garden plot into barns, silos, windpumps, center-pivot crop circles and a grain elevator.",
    build: buildFarms,
  },
  farm_houses: {
    footprints: [[1, 1], [2, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Homesteader's Cabin", "Farmhouse & Barn", "Homestead with Coop", "Prosperous Farmstead", "Grand Family Farmstead"],
    growth: "The farmhouse gains a storey, then a barn, coop and corral, then windpumps, silos and tractors.",
    build: buildFarmHouses,
  },
  fields: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [4, 2]],
    levels: ["Seed Plot", "Long Furrow Field", "Patchwork Fields", "Rolling Acreage", "Breadbasket Prairie"],
    growth: "One plot spreads into a patchwork of parcels with tractors, hay bales, towers and a legendary centrepiece.",
    build: buildFields,
  },
  orchards: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Staked Saplings", "Young Orchard", "Harvest-Time Orchard", "Orchard & Packing House", "Heritage Mother-Tree Orchard"],
    growth: "Staked saplings grow into fruit-heavy rows with pickers, then a packing house and an ancient mother tree.",
    build: buildOrchards,
  },
  groves_of_olives: {
    footprints: [[2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    levels: ["Terraced Olive Patch", "Stone-Wall Terraces", "Olive Press Farm", "Hillside Olive Villa", "Thousand-Year Olive Estate"],
    growth: "More dry-stone terraces climb the hill; a donkey-driven press, a villa and finally a millennia-old olive giant appear.",
    build: buildOlives,
  },
  plantations: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Planter's Smallholding", "Estate Rows", "Planter's Manor", "Grand Estate & Works", "Legendary Estate"],
    growth: "Rows of tea, coffee, cane or vines spread around a hut that becomes a manor with an avenue, works and fountain.",
    build: buildPlantations,
  },
});
