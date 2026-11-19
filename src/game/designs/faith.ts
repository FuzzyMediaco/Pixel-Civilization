import {
  type Ctx,
  PixelVox,
  band,
  bench,
  bush,
  byLv,
  car,
  clockFace,
  colonnade,
  column,
  door,
  fence,
  flowerBed,
  fountain,
  gable,
  hedge,
  hip,
  lamp,
  lot,
  onionDome,
  parking,
  pediment,
  person,
  ring,
  speckle,
  spire,
  stairs,
  tree,
  waterPlane,
} from "./kit";
import { defineDesigns } from "./registry";

/* =============================================================================================
 * Shared faith helpers
 * ============================================================================================= */

type V = PixelVox;
const STAINED = ["blue", "crimson", "gold", "purple", "teal", "blue"];
const SANDSTONE = "#b5523b";
const MARBLE_W = "#f4f1ea";
const GREEN_TILE = "#2f7d4f";
const LEAD = "#8f9aa6";

/** Triangle (gable end) face on the plane z, base [x0,x1) at y, rising 1 per row */
function triFace(v: V, x0: number, x1: number, y: number, z: number, col: string, emit = 0): void {
  for (let s = 0; x0 + s < x1 - s; s++) v.box(x0 + s, y + s, z, x1 - s, y + s + 1, z + 1, col, emit);
}

/** Latin cross standing on (x,y,z) facing +z. Returns top y. */
function cross(v: V, x: number, y: number, z: number, col = "gold", h = 4, emit = 0.35): number {
  v.box(x, y, z, x + 1, y + h, z + 1, col, emit);
  v.box(x - 1, y + h - 2, z, x + 2, y + h - 1, z + 1, col, emit);
  return y + h;
}

/** Orthodox 3-bar cross */
function orthoCross(v: V, x: number, y: number, z: number, col = "gold"): void {
  v.box(x, y, z, x + 1, y + 5, z + 1, col, 0.4);
  v.box(x - 1, y + 3, z, x + 2, y + 4, z + 1, col, 0.4);
  v.put(x - 1, y + 1, z, col, 0.4);
}

/** Crescent finial (gold) on top of a point */
function crescent(v: V, x: number, y: number, z: number): void {
  v.box(x, y, z, x + 1, y + 2, z + 1, "gold", 0.5);
  v.put(x - 1, y + 2, z, "gold", 0.5);
  v.put(x - 1, y + 3, z, "gold", 0.5);
  v.put(x, y + 4, z, "gold", 0.5);
  v.put(x + 1, y + 3, z, "gold", 0.5);
}

/** Crenellations around a rectangle top at height y */
function crenel(v: V, x0: number, y: number, z0: number, x1: number, z1: number, col: string): void {
  for (let x = x0; x < x1; x++) {
    if ((x - x0) % 2 === 0) {
      v.put(x, y, z0, col);
      v.put(x, y, z1 - 1, col);
    }
  }
  for (let z = z0; z < z1; z++) {
    if ((z - z0) % 2 === 0) {
      v.put(x0, y, z, col);
      v.put(x1 - 1, y, z, col);
    }
  }
}

/** Tall windows on the ±x faces of a block, every `step` along z */
function sideLancets(c: Ctx, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, step = 3, stained = true): void {
  for (let z = z0; z < z1; z += step) {
    for (const xf of [x0, x1 - 1]) {
      const col = stained ? c.pick(STAINED) : "glass";
      c.v.box(xf, y0, z, xf + 1, y1, z + 1, col, stained ? 0.55 : 0.4);
    }
  }
}

/** Tall windows on the ±z faces, every `step` along x */
function frontLancets(c: Ctx, x0: number, x1: number, zs: number[], y0: number, y1: number, step = 3, stained = true): void {
  for (let x = x0; x < x1; x += step) {
    for (const zf of zs) {
      const col = stained ? c.pick(STAINED) : "glass";
      c.v.box(x, y0, zf, x + 1, y1, zf + 1, col, stained ? 0.55 : 0.4);
    }
  }
}

/** Gothic rose window on the plane z */
function rose(v: V, cx: number, cy: number, z: number, r: number, frame = "marbleShade"): void {
  v.ringZ(cx, cy, z, z + 1, r + 0.8, 0, frame);
  v.ringZ(cx, cy, z, z + 1, r, 0, "blue", 0.7);
  v.ringZ(cx, cy, z, z + 1, r - 0.4, r - 1.5, "crimson", 0.8);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    for (let k = 1; k < r; k++) v.put(Math.floor(cx + Math.cos(ang) * k), Math.floor(cy + Math.sin(ang) * k), z, frame);
  }
  v.ringZ(cx, cy, z, z + 1, 1.2, 0, "gold", 0.9);
}

/** Star of David (9x9) on the plane z, centred at cx (left col = cx-4) */
const HEXAGRAM = [
  "....#....",
  "...#.#...",
  "#########",
  ".##...##.",
  ".#.....#.",
  ".##...##.",
  "#########",
  "...#.#...",
  "....#....",
];
function starOfDavid(v: V, cx: number, cy: number, z: number, col = "gold", emit = 0.6, back?: string): void {
  for (let r = 0; r < 9; r++) {
    for (let k = 0; k < 9; k++) {
      if (HEXAGRAM[r][k] === "#") v.put(cx - 4 + k, cy + 4 - r, z, col, emit);
      else if (back) v.put(cx - 4 + k, cy + 4 - r, z, back, 0.2);
    }
  }
}

/** Small (5x5) star of David */
function smallStar(v: V, cx: number, cy: number, z: number, col = "gold"): void {
  const P = ["..#..", "#####", ".#.#.", "#####", "..#.."];
  for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) if (P[r][k] === "#") v.put(cx - 2 + k, cy + 2 - r, z, col, 0.6);
}

/** Bulbous onion dome with swirled two-colour stripes (St Basil's style) */
function swirlOnion(v: V, cx: number, cz: number, y0: number, r: number, c1: string, c2: string, tip = "gold"): number {
  const h = Math.round(r * 2.6);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const rr = Math.max(0.45, r * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.15)) * (1 - t * 0.35));
    const ri = Math.ceil(rr) + 1;
    for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++) {
      for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - cz;
        if (dx * dx + dz * dz <= rr * rr + 0.15) {
          const a = Math.atan2(dz, dx);
          const k = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 8 + y * 0.5);
          v.put(x, y0 + y, z, k % 2 === 0 ? c1 : c2);
        }
      }
    }
  }
  v.box(Math.floor(cx), y0 + h, Math.floor(cz), Math.floor(cx) + 1, y0 + h + 2, Math.floor(cz) + 1, tip, 0.4);
  return y0 + h + 2;
}

/** Spooky bare tree */
function deadTree(v: V, x: number, z: number, h = 7, col = "charcoal"): void {
  v.box(x, 1, z, x + 1, 1 + h, z + 1, col);
  v.put(x + 1, h - 1, z, col);
  v.put(x + 2, h, z, col);
  v.put(x + 2, h + 1, z + 1, col);
  v.put(x - 1, h - 2, z, col);
  v.put(x - 2, h - 1, z, col);
  v.put(x - 2, h, z - 1, col);
  v.put(x, h, z + 1, col);
  v.put(x, h + 1, z + 2, col);
  v.put(x, h - 1, z - 1, col);
  v.put(x, h, z - 2, col);
  v.put(x + 1, h + 1, z - 2, col);
}

/** Saguaro cactus */
function cactus(v: V, x: number, z: number, h = 5): void {
  v.box(x, 1, z, x + 1, 1 + h, z + 1, "leafDark");
  v.box(x + 1, 3, z, x + 2, 4, z + 1, "leafDark");
  v.box(x + 2, 3, z, x + 3, 5, z + 1, "leafDark");
  v.box(x - 1, 2, z, x, 3, z + 1, "leafDark");
  v.box(x - 2, 2, z, x - 1, 5, z + 1, "leafDark");
}

/** Glowing lantern on a post */
function lantern(v: V, x: number, z: number, h = 3, post = "iron", light = "warmGlow"): void {
  v.box(x, 1, z, x + 1, 1 + h, z + 1, post);
  v.put(x, 1 + h, z, light, 1.4);
  v.put(x, 2 + h, z, post);
}

/** Steep stepped roof (2 rows per inward step) — stave / Asian / Thai roofs */
function steepHip(v: V, x0: number, y: number, z0: number, x1: number, z1: number, col: string, rowsPerStep = 2, edge?: string): number {
  let s = 0;
  let yy = y;
  for (; x0 + s < x1 - s && z0 + s < z1 - s; s++) {
    v.box(x0 + s, yy, z0 + s, x1 - s, yy + rowsPerStep, z1 - s, s === 0 && edge ? edge : col);
    yy += rowsPerStep;
  }
  return yy;
}

/** Asian eave slab with upturned corners. Returns y above the slab. */
function upturnedEave(v: V, x0: number, y: number, z0: number, x1: number, z1: number, col: string, edge: string): number {
  v.box(x0, y, z0, x1, y + 1, z1, edge);
  v.box(x0 + 1, y + 1, z0 + 1, x1 - 1, y + 2, z1 - 1, col);
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.put(px, y + 1, pz, edge);
  for (const [px, pz] of [[x0 - 1, z0 - 1], [x1, z0 - 1], [x0 - 1, z1], [x1, z1]]) v.put(px, y + 2, pz, edge);
  return y + 2;
}

/** Headstone styles */
function headstone(c: Ctx, x: number, z: number, kind: number, col = "stone"): void {
  const v = c.v;
  v.box(x, 0, z + 1, x + 2, 1, z + 4, "grass3");
  switch (kind) {
    case 0: // slab with rounded shoulders
      v.box(x, 1, z, x + 2, 3, z + 1, col);
      v.put(x, 3, z, col);
      break;
    case 1: // cross
      v.box(x, 1, z, x + 1, 5, z + 1, col);
      v.box(x - 1, 3, z, x + 2, 4, z + 1, col);
      break;
    case 2: // obelisk
      v.box(x, 1, z, x + 2, 2, z + 2, col);
      v.box(x, 2, z, x + 1, 6, z + 1, col);
      v.put(x, 6, z, "marbleShade");
      break;
    case 3: // tall slab
      v.box(x, 1, z, x + 2, 4, z + 1, col);
      break;
    case 4: // angel statue
      v.box(x, 1, z, x + 2, 2, z + 2, "stone");
      v.box(x, 2, z, x + 1, 5, z + 1, "marble");
      v.put(x - 1, 4, z, "marble");
      v.put(x + 1, 4, z, "marble");
      v.put(x - 1, 5, z, "marble");
      v.put(x + 1, 5, z, "marble");
      break;
    default: // small flat marker
      v.box(x, 1, z, x + 2, 2, z + 1, col);
  }
}

/** Golden angel-with-trumpet statue on top of a spire tip */
function angel(v: V, x: number, y: number, z: number): number {
  v.put(x, y, z, "gold", 0.6);
  v.box(x, y + 1, z, x + 1, y + 4, z + 1, "gold", 0.7);
  v.put(x, y + 4, z, "gold", 0.7);
  v.put(x, y + 3, z + 1, "gold", 0.7);
  v.put(x, y + 4, z + 2, "gold", 0.7);
  v.put(x - 1, y + 2, z, "gold", 0.6);
  return y + 5;
}

/* =============================================================================================
 * CHURCH — classic parish church growing into a cathedral.
 *  V0 Gothic stone (lancets, buttresses, spire → twin-tower cathedral with rose window)
 *  V1 New England clapboard (white, shutters, tiered white steeple → columned meeting house)
 *  V2 Italian Romanesque (striped brick, campanile → duomo with crossing dome & baptistery)
 *  V3 English Norman (granite, square crenellated tower, lych gate → minster with crossing tower)
 * ============================================================================================= */
function buildChurch(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.1);
  const W = byLv(c, [8, 10, 12, 14, 18]);
  const H = byLv(c, [5, 7, 8, 10, 13]);
  const zF = hz - byLv(c, [2, 5, 6, 6, 8]);
  const L = Math.min(byLv(c, [10, 18, 18, 24, 34]), zF + hz - 3);
  const z0 = zF - L;
  const x0 = -W / 2;
  const x1 = W / 2;
  const wall = ["limestone", "white", "cream", "#b8ae9c"][s];
  const wall2 = ["marbleShade", "white", "brick", "stone"][s];
  const roof = ["slate", "charcoal", "terracotta", "slateLight"][s];
  const stained = s !== 1;

  v.box(-2, 0, zF, 2, 1, hz, s === 1 ? "path" : "stone");

  // apse (rounded east end)
  if (s !== 1 && lv >= 3) {
    v.cylinderY(0, z0, 1, 1 + H, W / 2 - 1, wall);
    v.cone(0, 1 + H, 1 + H + W / 2 - 1, z0, W / 2, 0.6, roof);
    v.clear(x0, 1, z0, x1, 2 + H + W, zF);
  }
  // transept
  let tz0 = 0;
  const tw = 8;
  if (lv >= 4) {
    tz0 = z0 + Math.floor(L * 0.3);
    const ext = lv >= 5 ? 7 : 5;
    v.hollowBox(x0 - ext, 1, tz0, x1 + ext, 1 + H, tz0 + tw, wall);
    if (s === 2) for (let y = 2; y < 1 + H; y += 2) band(v, x0 - ext, y, tz0, x1 + ext, tz0 + tw, "brick");
    gable(v, x0 - ext - 1, 1 + H, tz0 - 1, x1 + ext + 1, tz0 + tw + 1, "x", roof);
    for (const xe of [x0 - ext, x1 + ext - 1]) {
      if (stained) v.box(xe, 3, tz0 + 3, xe + 1, H, tz0 + 5, c.pick(STAINED), 0.6);
      else v.box(xe, 3, tz0 + 3, xe + 1, H, tz0 + 5, "glass", 0.4);
    }
  }
  // nave
  v.hollowBox(x0, 1, z0, x1, 1 + H, zF, wall);
  if (s === 2) {
    for (let y = 2; y < 1 + H; y += 2) band(v, x0, y, z0, x1, zF, "brick");
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 1 + H, zF - 1);
  }
  band(v, x0, H, z0, x1, zF, wall2);
  for (let z = z0 + 2; z < zF - 2; z += 3) {
    if (lv >= 4 && z >= tz0 - 1 && z <= tz0 + tw) continue;
    for (const xf of [x0, x1 - 1]) {
      if (stained) v.box(xf, 3, z, xf + 1, H - 1, z + 1, c.pick(STAINED), 0.55);
      else {
        v.box(xf, 3, z, xf + 1, H - 1, z + 1, "glass", 0.4);
        v.box(xf, 3, z - 1, xf + 1, H - 1, z, "leafDark");
        v.box(xf, 3, z + 1, xf + 1, H - 1, z + 2, "leafDark");
      }
    }
  }
  // Gothic flying buttresses
  if (s === 0 && lv >= 3) {
    for (let z = z0 + 1; z < zF - 1; z += 4) {
      if (lv >= 4 && z >= tz0 - 1 && z <= tz0 + tw) continue;
      for (const [bx, d] of [[x0 - 2, 1], [x1 + 1, -1]] as const) {
        v.box(bx, 1, z, bx + 1, H - 1, z + 1, wall2);
        v.put(bx + d, H - 1, z, wall2);
        v.put(bx, H - 1, z, wall2);
        v.put(bx, H, z, "slate");
      }
    }
  }
  const rise = Math.ceil((W + 2) / 2);
  const ridge = 1 + H + rise;
  gable(v, x0 - 1, 1 + H, z0 - 1, x1 + 1, zF, "z", roof, s === 1 ? "white" : undefined);
  triFace(v, x0 + 1, x1 - 1, 1 + H, zF - 1, wall);
  // facade door + window
  door(v, -1, 1, zF - 1, "woodDark", 2, 4);
  v.put(-1, 5, zF - 1, wall2);
  v.put(0, 5, zF - 1, wall2);

  // ---- towers ----
  if (lv === 1) {
    // bell-cote on the front of the ridge
    const by = ridge - 2;
    v.hollowBox(-1, by, zF - 3, 1, by + 4, zF - 1, wall);
    v.box(-1, by + 1, zF - 3, 1, by + 3, zF - 1, null);
    v.put(-1, by + 2, zF - 2, "gold", 0.3);
    v.box(-2, by + 4, zF - 4, 2, by + 5, zF, roof);
    cross(v, -1, by + 5, zF - 2, s === 1 ? "white" : "gold", 3);
    if (s === 2) rose(v, 0, H - 1, zF - 1, 1.5);
    else if (s === 0) frontLancets(c, -1, 1, [zF - 1], H - 2, H + 2, 2);
  } else if (s === 0) {
    if (lv <= 4) {
      gothicTower(c, -3, zF - 3, 3, zF + 3, ridge + byLv(c, [0, 6, 8, 10, 0]), byLv(c, [0, 10, 14, 18, 0]), wall, wall2, roof);
      if (lv >= 3) clockFace(v, 0, ridge + 1, zF + 3, 1, "white", "black");
    } else {
      gothicTower(c, x0 - 3, zF - 4, x0 + 4, zF + 3, ridge + 12, 16, wall, wall2, roof);
      gothicTower(c, x1 - 4, zF - 4, x1 + 3, zF + 3, ridge + 12, 16, wall, wall2, roof);
      v.box(x0 + 4, 1, zF - 1, x1 - 4, ridge - 2, zF, wall);
      rose(v, 0, H + 1, zF, 3.6);
      // three portals
      for (const px of [-1, -7, 5]) {
        v.box(px, 1, zF - 1, px + 2, 5, zF + 2, null);
        v.box(px - 1, 1, zF, px + 3, 7, zF + 1, wall2);
        v.box(px, 1, zF, px + 2, 6, zF + 1, null);
        v.box(px, 1, zF - 1, px + 2, 5, zF, "woodDark");
      }
      // crossing flèche
      spire(v, 0, tz0 + tw / 2, ridge - 1, 12, 1.6, "slate", "gold");
    }
  } else if (s === 1) {
    newEnglandSteeple(c, ridge, zF);
    if (lv >= 5) {
      v.box(x0 - 1, 1, zF, x1 + 1, 2, zF + 7, "marble");
      for (const px of [x0, x0 + 3, x1 - 4, x1 - 1]) column(v, px, zF + 5, 2, 1 + H, "white", "white");
      v.box(x0 - 1, 1 + H, zF - 1, x1 + 1, 2 + H, zF + 7, "white");
      pediment(v, x0 - 1, x1 + 1, 2 + H, zF + 4, zF + 7, "white", "cream");
    }
  } else if (s === 2) {
    const tH = H + byLv(c, [0, 10, 14, 18, 26]);
    let tx0: number;
    let tzz: number;
    if (hx - x1 >= 9) {
      tx0 = x1 + 2;
      tzz = lv >= 4 ? zF - 10 : z0 + 2;
    } else {
      tx0 = x1 - 5;
      tzz = zF - 6;
    }
    campanile(c, tx0, tzz, tx0 + 6, tzz + 6, tH);
    if (lv >= 2) {
      rose(v, 0, H + 1, zF - 1, 2);
      for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, H - 2, zF - 1, "brick");
    }
    if (lv >= 5) {
      const cz = tz0 + tw / 2;
      v.cylinderY(0, cz, ridge - 3, ridge + 3, 7, "cream");
      for (let a = 0; a < 12; a++) {
        const ang = (a * Math.PI) / 6;
        v.box(Math.floor(Math.cos(ang) * 7), ridge - 1, Math.floor(cz + Math.sin(ang) * 7), Math.floor(Math.cos(ang) * 7) + 1, ridge + 2, Math.floor(cz + Math.sin(ang) * 7) + 1, "glass", 0.5);
      }
      v.dome(0, ridge + 3, cz, 7, "terracotta");
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4;
        for (let k = 0; k < 7; k++) {
          const rr = 7 * Math.cos((k / 7) * (Math.PI / 2));
          v.put(Math.floor(Math.cos(ang) * rr), ridge + 3 + Math.round(7 * Math.sin((k / 7) * (Math.PI / 2))), Math.floor(cz + Math.sin(ang) * rr), "white");
        }
      }
      v.cylinderY(0, cz, ridge + 10, ridge + 13, 1.6, "white");
      v.cone(0, ridge + 13, ridge + 15, cz, 1.6, 0.5, "terracotta");
      v.put(0, ridge + 15, Math.floor(cz), "gold", 0.6);
      // octagonal baptistery
      const bx = x0 - 10;
      const bz = zF - 2;
      v.cylinderY(bx, bz, 1, 9, 5, "cream");
      for (let y = 2; y < 9; y += 2) ring(v, bx, bz, y, y + 1, 5, 4, "brick");
      v.cone(bx, 9, 14, bz, 5.5, 0.6, "terracotta");
      v.box(bx - 1, 1, bz + 4, bx + 1, 4, bz + 5, "woodDark");
    }
  } else {
    // Norman
    if (lv <= 4) {
      normanTower(c, -3, zF - 3, 3, zF + 3, H + byLv(c, [0, 8, 10, 13, 0]), lv >= 4);
    } else {
      normanTower(c, x0 - 2, zF - 4, x0 + 4, zF + 2, H + 10, false);
      normanTower(c, x1 - 4, zF - 4, x1 + 2, zF + 2, H + 10, false);
      normanTower(c, -6, tz0 - 2, 6, tz0 + tw + 2, ridge + 10, true);
      v.box(x0 + 4, 1, zF - 1, x1 - 4, ridge - 3, zF, wall);
      rose(v, 0, H, zF, 3);
      for (const [px, pz] of [[-6, tz0 - 2], [5, tz0 - 2], [-6, tz0 + tw + 1], [5, tz0 + tw + 1]]) spire(v, px + 0.5, pz + 0.5, ridge + 11, 4, 0.9, "stone", "gold");
    }
    if (lv >= 3) {
      // lych gate
      const gz = hz - 3;
      v.box(-3, 1, gz, -2, 4, gz + 1, "woodDark");
      v.box(2, 1, gz, 3, 4, gz + 1, "woodDark");
      gable(v, -4, 4, gz - 1, 4, gz + 2, "x", "slate");
    }
  }

  // ---- churchyard & grounds ----
  if (lv >= 2) {
    for (const lx of [-3, 2]) lamp(v, lx, 1, hz - 2, 4);
  }
  if (lv >= 3) {
    const gx0 = x1 + (lv >= 4 ? 9 : 3);
    for (let x = gx0; x < hx - 2; x += 4) {
      for (let z = z0 + 2; z < zF; z += 5) {
        if (c.rand() < 0.7) headstone(c, x, z, c.ri(0, 3), s === 3 ? "slateLight" : "stone");
      }
    }
    const tk = (["oak", "round", "cypress", "pine"] as const)[s];
    tree(v, -hx + 3, 1, zF - 2, tk, 1.3, 1);
    tree(v, -hx + 4, 1, z0 + 3, tk, 1.1, 2);
    if (lv >= 4) tree(v, hx - 4, 1, hz - 4, tk, 1.4, 3);
    flowerBed(c, -6, hz - 3, -3, hz - 1, 1);
    flowerBed(c, 3, hz - 3, 6, hz - 1, 1);
  }
  if (lv >= 4) {
    bench(v, -6, 1, zF + 3);
    person(v, 3, 1, zF + 4, "blue");
    person(v, -4, 1, zF + 5, "crimson", "charcoal");
  }
  if (lv >= 5) {
    for (let z = z0; z < zF - 2; z += 6) {
      lamp(v, -hx + 1, 1, z, 4);
      lamp(v, hx - 2, 1, z, 4);
    }
  }
}

function gothicTower(c: Ctx, x0: number, z0: number, x1: number, z1: number, top: number, spireH: number, wall: string, wall2: string, roof: string): void {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, top, z1, wall);
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, 1, pz, px + 1, top + 2, pz + 1, wall2);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const mx = Math.floor(cx) - 1;
  const mz = Math.floor(cz) - 1;
  // belfry lancets
  v.box(mx, top - 6, z1 - 1, mx + 2, top - 2, z1, null);
  v.box(mx, top - 6, z0, mx + 2, top - 2, z0 + 1, null);
  v.box(x0, top - 6, mz, x0 + 1, top - 2, mz + 2, null);
  v.box(x1 - 1, top - 6, mz, x1, top - 2, mz + 2, null);
  v.box(mx, top - 5, mz, mx + 2, top - 3, mz + 2, "gold", 0.3);
  // lower stained window
  v.box(mx, top - 13, z1 - 1, mx + 2, top - 8, z1, c.pick(STAINED), 0.55);
  band(v, x0, top - 1, z0, x1, z1, wall2, 0);
  spire(v, cx, cz, top, spireH, (x1 - x0) / 2 + 0.3, roof, "gold");
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
    v.box(px, top + 2, pz, px + 1, top + 4, pz + 1, wall2);
    v.put(px, top + 4, pz, "gold", 0.3);
  }
}

function newEnglandSteeple(c: Ctx, ridge: number, zF: number): void {
  const { v, lv } = c;
  const tz0 = zF - 2;
  const tz1 = zF + 2;
  const baseTop = ridge + 1;
  v.box(-2, 1, tz0, 2, baseTop, tz1, "white");
  v.box(-1, 1, tz1 - 1, 1, 5, tz1, "woodDark");
  v.box(-1, 6, tz1 - 1, 1, 9, tz1, "glass", 0.4);
  if (lv >= 3) clockFace(v, 0, baseTop - 2, tz1, 1, "white", "black");
  // belfry
  band(v, -2, baseTop, tz0, 2, tz1, "white", 1);
  v.hollowBox(-2, baseTop + 1, tz0, 2, baseTop + 6, tz1, "white");
  v.box(-1, baseTop + 2, tz0, 1, baseTop + 5, tz1, null);
  v.box(-2, baseTop + 2, tz0 + 1, 2, baseTop + 5, tz1 - 1, null);
  v.box(-1, baseTop + 3, tz0 + 1, 1, baseTop + 5, tz1 - 1, "gold", 0.3);
  band(v, -2, baseTop + 6, tz0, 2, tz1, "white", 1);
  let y = baseTop + 7;
  if (lv >= 3) {
    // second (lantern) stage
    v.box(-2, y, tz0, 2, y + 3 + (lv >= 4 ? 2 : 0), tz1, "white");
    v.box(-1, y + 1, tz0, 1, y + 3, tz1, "glassDark");
    v.box(-2, y + 1, tz0 + 1, 2, y + 3, tz1 - 1, "glassDark");
    y += 3 + (lv >= 4 ? 2 : 0);
    band(v, -2, y, tz0, 2, tz1, "white", 0);
    y += 1;
  }
  const sh = byLv(c, [0, 7, 9, 12, 16]);
  v.cone(0, y, y + sh, zF, 2.2, 0.3, "white");
  v.box(0, y + sh, zF, 1, y + sh + 2, zF + 1, "gold", 0.5);
  v.put(1, y + sh + 1, zF, "gold", 0.5);
}

function campanile(c: Ctx, x0: number, z0: number, x1: number, z1: number, top: number): void {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, top, z1, "cream");
  for (let y = 2; y < top; y += 3) band(v, x0, y, z0, x1, z1, "brick");
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top, z1 - 1);
  const mx = Math.floor((x0 + x1) / 2) - 1;
  const mz = Math.floor((z0 + z1) / 2) - 1;
  for (const yy of [top - 4, top - 9]) {
    v.box(mx, yy, z0, mx + 2, yy + 3, z1, null);
    v.box(x0, yy, mz, x1, yy + 3, mz + 2, null);
  }
  v.box(mx, top - 4, mz, mx + 2, top - 2, mz + 2, "gold", 0.3);
  band(v, x0, top, z0, x1, z1, "white", 1);
  hip(v, x0 - 1, top + 1, z0 - 1, x1 + 1, z1 + 1, "terracotta");
  const cx = Math.floor((x0 + x1) / 2);
  const cz = Math.floor((z0 + z1) / 2);
  cross(c.v, cx, top + 1 + Math.ceil((x1 - x0 + 2) / 2), cz, "gold", 3);
}

function normanTower(c: Ctx, x0: number, z0: number, x1: number, z1: number, top: number, flagOn: boolean): void {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, top, z1, "#a9a192");
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, 1, pz, px + 1, top, pz + 1, "stone");
  const mx = Math.floor((x0 + x1) / 2) - 1;
  const mz = Math.floor((z0 + z1) / 2) - 1;
  for (let y = 6; y < top - 4; y += 5) {
    v.box(mx, y, z1 - 1, mx + 2, y + 2, z1, "glassDark", 0.2);
    v.box(x0, y, mz, x0 + 1, y + 2, mz + 2, "glassDark", 0.2);
    v.box(x1 - 1, y, mz, x1, y + 2, mz + 2, "glassDark", 0.2);
  }
  v.box(mx, top - 4, z1 - 1, mx + 2, top - 1, z1, null);
  v.box(mx, top - 4, z0, mx + 2, top - 1, z0 + 1, null);
  band(v, x0, top - 1, z0, x1, z1, "stone", 0);
  v.box(x0 + 1, top - 1, z0 + 1, x1 - 1, top, z1 - 1, "slate");
  crenel(v, x0, top, z0, x1, z1, "stone");
  if (flagOn) {
    const fx = Math.floor((x0 + x1) / 2);
    const fz = Math.floor((z0 + z1) / 2);
    v.box(fx, top, fz, fx + 1, top + 6, fz + 1, "silver");
    v.box(fx + 1, top + 3, fz, fx + 4, top + 6, fz + 1, "white");
    v.box(fx + 2, top + 3, fz, fx + 3, top + 6, fz + 1, "red");
    v.box(fx + 1, top + 4, fz, fx + 4, top + 5, fz + 1, "red");
  }
}

/* =============================================================================================
 * CHRISTIAN CHURCH — distinct traditions from the Church element.
 *  V0 Russian Orthodox (white walls, blue/gold onion domes → St-Basil's swirl domes)
 *  V1 Spanish Mission (adobe, bell-gable espadaña with bells → twin white towers & dome)
 *  V2 Modern Evangelical (storefront → A-frame → megachurch arena → Crystal Cathedral)
 *  V3 Nordic Stave church (tiered tarred-wood roofs with dragon heads)
 * ============================================================================================= */
function buildChristianChurch(c: Ctx): void {
  const s = c.variant % 4;
  if (s === 0) orthodoxChurch(c);
  else if (s === 1) missionChurch(c);
  else if (s === 2) megaChurch(c);
  else staveChurch(c);
}

function orthodoxChurch(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "leafLight", 0.06);
  const W = byLv(c, [8, 10, 14, 20, 24]);
  const D = byLv(c, [8, 10, 14, 18, 24]);
  const H = byLv(c, [6, 7, 9, 10, 12]);
  const zF = Math.min(hz - 3, D / 2 + 2);
  const z0 = zF - D;
  const x0 = -W / 2;
  const x1 = W / 2;
  const wall = lv >= 5 ? "brick" : "cream";
  v.box(-2, 0, zF, 2, 1, hz, "path");
  v.hollowBox(x0, 1, z0, x1, 1 + H, zF, wall);
  band(v, x0, H, z0, x1, zF, "white", 0);
  band(v, x0, 1, z0, x1, zF, "white", 0);
  // kokoshnik arches on roofline (front & sides)
  for (let x = x0; x < x1; x += 4) {
    v.box(x, 1 + H, zF - 1, x + 3, 2 + H, zF, "white");
    v.put(x + 1, 3 + H, zF - 1, "white");
  }
  v.box(x0, 1 + H, z0, x1, 2 + H, zF, wall === "brick" ? "brick" : "cream");
  v.box(x0 + 1, 2 + H, z0 + 1, x1 - 1, 3 + H, zF - 1, "tealDark");
  for (let z = z0 + 2; z < zF - 1; z += 3) {
    v.box(x0, 4, z, x0 + 1, H - 1, z + 1, "glass", 0.5);
    v.box(x1 - 1, 4, z, x1, H - 1, z + 1, "glass", 0.5);
  }
  for (let x = x0 + 2; x < x1 - 1; x += 3) if (Math.abs(x + 0.5) > 2) v.box(x, 4, zF - 1, x + 1, H - 1, zF, "glass", 0.5);
  door(v, -1, 1, zF - 1, "woodDark", 2, 4);
  v.box(-2, 5, zF - 1, 2, 6, zF, "gold", 0.4);
  // icon above door
  v.box(-1, 6, zF - 1, 1, 8, zF, "blue", 0.4);
  const roofY = 3 + H;
  const zc = (z0 + zF) / 2;
  const domes: [number, number, number, string, string][] = []; // x, z, r, c1, c2
  if (lv <= 2) domes.push([0, zc, 3, "blue", "blue"]);
  else if (lv <= 4) {
    domes.push([0, zc, 4, "gold", "gold"]);
    const o = W / 2 - 3;
    if (lv === 3) {
      domes.push([-o, zc + o, 2.2, "blue", "blue"], [o, zc + o, 2.2, "blue", "blue"]);
    } else {
      for (const dx of [-o, o]) for (const dz of [-o, o]) domes.push([dx, zc + dz, 2.5, "blue", "blue"]);
    }
  } else {
    domes.push([0, zc, 5.5, "gold", "goldDark"]);
    const o = 8;
    const cols: [string, string][] = [["red", "lime"], ["blue", "white"], ["yellow", "leaf"], ["crimson", "white"], ["teal", "gold"], ["orange", "leafDark"], ["purple", "yellow"], ["red", "white"]];
    let k = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4 + Math.PI / 8;
      const [c1, c2] = cols[k++ % cols.length];
      domes.push([Math.cos(ang) * o, zc + Math.sin(ang) * o, a % 2 ? 2.8 : 3.4, c1, c2]);
    }
  }
  domes.forEach(([dx, dz, r, c1, c2], i) => {
    const drumH = i === 0 ? byLv(c, [3, 4, 5, 6, 10]) : byLv(c, [2, 2, 3, 4, 5]) + (lv >= 5 ? (i % 2) * 3 : 0);
    v.cylinderY(dx, dz, roofY, roofY + drumH, r * 0.75, "white");
    for (let y = roofY + 1; y < roofY + drumH - 1; y += 2) {
      v.put(Math.floor(dx), y, Math.floor(dz + r * 0.75), "glass", 0.5);
      v.put(Math.floor(dx + r * 0.75), y, Math.floor(dz), "glass", 0.5);
    }
    let top: number;
    if (c1 === c2) {
      top = onionDome(v, dx, dz, roofY + drumH, r, c1, "gold");
      if (c1 === "blue") {
        for (let q = 0; q < 6; q++) v.put(Math.floor(dx + Math.cos(q) * r * 0.8), roofY + drumH + 2 + (q % 3), Math.floor(dz + Math.sin(q) * r * 0.8), "gold", 0.6);
      }
    } else top = swirlOnion(v, dx, dz, roofY + drumH, r, c1, c2, "gold");
    orthoCross(v, Math.floor(dx), top, Math.floor(dz));
  });
  // bell tower (shatyor tent roof)
  if (lv >= 2) {
    const bx0 = Math.min(hx - 6, x1 + 2);
    const bz0 = zF - 5;
    const bt = H + byLv(c, [0, 6, 8, 10, 12]);
    v.hollowBox(bx0, 1, bz0, bx0 + 5, bt, bz0 + 5, "cream");
    v.box(bx0 + 1, bt - 4, bz0, bx0 + 4, bt - 1, bz0 + 5, null);
    v.box(bx0, bt - 4, bz0 + 1, bx0 + 5, bt - 1, bz0 + 4, null);
    v.box(bx0 + 2, bt - 3, bz0 + 2, bx0 + 3, bt - 1, bz0 + 3, "gold", 0.4);
    band(v, bx0, bt, bz0, bx0 + 5, bz0 + 5, "white", 0);
    v.cone(bx0 + 2.5, bt + 1, bt + 9, bz0 + 2.5, 2.8, 0.4, "tealDark");
    v.cylinderY(bx0 + 2.5, bz0 + 2.5, bt + 9, bt + 10, 0.8, "gold");
    orthoCross(v, bx0 + 2, bt + 10, bz0 + 2);
  }
  // grounds
  if (lv >= 3) {
    tree(v, -hx + 3, 1, hz - 4, "birch", 1.2);
    tree(v, -hx + 3, 1, -hz + 4, "birch", 1);
    tree(v, hx - 3, 1, -hz + 4, "birch", 1.1);
    flowerBed(c, -5, hz - 2, -3, hz, 1, ["red", "yellow"]);
    flowerBed(c, 3, hz - 2, 5, hz, 1, ["red", "yellow"]);
  }
  if (lv >= 4) {
    fence(v, -hx, -hz, hx, hz, 1, 2, "white", [-3, 3]);
    person(v, 3, 1, zF + 2, "charcoal", "black");
  }
  if (lv >= 5) for (const lx of [-hx + 2, hx - 3]) lamp(v, lx, 1, hz - 3, 4);
}

function missionChurch(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "sand");
  speckle(c, "sandDark", 0.12);
  speckle(c, "grass3", 0.04);
  const W = byLv(c, [8, 10, 12, 14, 16]);
  const H = byLv(c, [5, 6, 8, 9, 11]);
  const zF = hz - byLv(c, [2, 2, 5, 5, 8]);
  const L = Math.min(byLv(c, [11, 11, 18, 22, 30]), zF + hz - 2);
  const z0 = zF - L;
  const xc = lv >= 4 ? -hx + W / 2 + 3 : 0; // nave shifts left to leave room for the courtyard
  const x0 = xc - W / 2;
  const x1 = xc + W / 2;
  const wall = lv >= 5 ? "white" : "plaster";
  v.box(xc - 2, 0, zF, xc + 2, 1, hz, "sandDark");
  v.hollowBox(x0, 1, z0, x1, 1 + H, zF, wall);
  for (let z = z0 + 3; z < zF - 2; z += 4) {
    v.box(x0, 4, z, x0 + 1, 6, z + 1, "glassDark", 0.3);
    v.box(x1 - 1, 4, z, x1, 6, z + 1, "glassDark", 0.3);
  }
  gable(v, x0 - 1, 1 + H, z0 - 1, x1 + 1, zF, "z", "terracotta");
  // espadaña (curved bell-gable)
  const eH = H + byLv(c, [6, 8, 9, 10, 10]);
  const eW = W / 2 + 1;
  for (let y = 1 + H; y < eH; y++) {
    const t = (y - 1 - H) / (eH - 1 - H);
    const half = Math.max(1, Math.round(eW * Math.cos(t * Math.PI * 0.5) + 0.4));
    v.box(xc - half, y, zF - 2, xc + half, y + 1, zF, wall);
  }
  v.box(x0, 1, zF - 2, x1, 1 + H, zF, wall);
  v.box(xc - 1, eH, zF - 2, xc + 1, eH + 1, zF, wall);
  cross(v, xc, eH + 1, zF - 2, "woodDark", 3, 0);
  const nb = byLv(c, [1, 2, 3, 3, 3]);
  const bellY = H + 3;
  const pos = nb === 1 ? [xc - 1] : nb === 2 ? [xc - 3, xc + 1] : [xc - 4, xc - 1, xc + 2];
  for (const bx of pos) {
    v.box(bx, bellY, zF - 2, bx + 2, bellY + 3, zF, null);
    v.box(bx, bellY + 1, zF - 2, bx + 2, bellY + 3, zF - 1, "brass", 0.3);
  }
  if (nb === 3) {
    v.box(xc - 1, bellY + 4, zF - 2, xc + 1, bellY + 6, zF, null);
    v.box(xc - 1, bellY + 5, zF - 2, xc + 1, bellY + 6, zF - 1, "brass", 0.3);
  }
  v.box(xc - 1, 1, zF - 1, xc + 1, 5, zF, "woodDark");
  v.box(xc - 2, 5, zF - 1, xc + 2, 6, zF, "terracotta");
  v.ringZ(xc, H, zF - 1, zF, 1.2, 0, "glass", 0.6);
  // side arcade (corridor)
  if (lv >= 2) {
    const ax = x1;
    const aW = 4;
    v.box(ax, 5, z0 + 2, Math.min(hx, ax + aW), 6, zF - 1, "terracotta");
    for (let z = z0 + 2; z < zF - 1; z += 3) v.box(ax + aW - 1, 1, z, ax + aW, 5, z + 1, wall);
    v.box(ax, 1, z0 + 2, ax + aW, 1, zF - 1, "sandDark");
  }
  // bell tower with dome (lv4 one tower, lv5 twin towers)
  const towers: number[] = lv >= 5 ? [x0 - 3, x1 - 3] : lv >= 4 ? [x1 - 3] : [];
  for (const tx of towers) {
    const tz = zF - 4;
    const th = H + 10;
    v.box(tx, 1, tz, tx + 6, th, tz + 6, wall);
    band(v, tx, th - 7, tz, tx + 6, tz + 6, "terracotta", 0);
    v.box(tx, th - 6, tz + 2, tx + 6, th - 2, tz + 4, null);
    v.box(tx + 2, th - 6, tz, tx + 4, th - 2, tz + 6, null);
    v.box(tx + 2, th - 4, tz + 2, tx + 4, th - 2, tz + 4, "brass", 0.3);
    band(v, tx, th, tz, tx + 6, tz + 6, wall, 0);
    v.dome(tx + 3, th + 1, tz + 3, 2.6, lv >= 5 ? "white" : "terracotta");
    cross(v, tx + 3, th + 3, tz + 3, "woodDark", 3, 0);
  }
  if (lv >= 5) {
    const zc = z0 + 8;
    v.cylinderY(xc, zc, 1 + H + 2, 1 + H + 6, 4.2, "white");
    v.dome(xc, 1 + H + 6, zc, 4.6, "white");
    cross(v, xc, 1 + H + 11, Math.floor(zc), "woodDark", 3, 0);
  }
  // courtyard with fountain, palms, cacti
  if (lv >= 3) {
    const qx0 = lv >= 4 ? x1 + 5 : x1 + 5;
    const qx1 = hx - 1;
    if (qx1 - qx0 > 6) {
      v.box(qx0, 0, z0 + 2, qx1, 1, zF, "terracotta");
      if (lv >= 4) fountain(v, (qx0 + qx1) / 2, 1, (z0 + 2 + zF) / 2, 3, "plaster");
      tree(v, qx1 - 3, 1, zF - 3, "palm", 1.3);
    }
    cactus(v, -hx + 2, hz - 3);
    cactus(v, hx - 3, hz - 2, 4);
    tree(v, -hx + 3, 1, -hz + 3, "palm", 1.4);
  }
  if (lv >= 2) {
    lantern(v, xc - 4, hz - 2, 3, "woodDark");
    lantern(v, xc + 3, hz - 2, 3, "woodDark");
  }
  if (lv >= 4) {
    person(v, xc + 3, 1, zF + 2, "woodLight", "woodDark");
    v.box(-hx, 1, -hz, hx, 3, -hz + 1, wall);
    v.box(-hx, 1, -hz, -hx + 1, 3, hz, wall);
  }
}

function megaChurch(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  if (lv === 1) {
    // storefront church
    lot(c, "concrete2");
    v.box(-hx, 0, hz - 3, hx, 1, hz, "concrete");
    v.box(-6, 1, -hz + 2, 6, 8, hz - 4, "sky");
    v.box(-6, 7, -hz + 2, 6, 8, hz - 4, "white");
    v.box(-5, 2, hz - 5, 5, 6, hz - 4, "glass", 0.5);
    v.box(-1, 1, hz - 5, 1, 5, hz - 4, "glassDark");
    // neon cross sign
    v.box(-1, 9, hz - 6, 1, 16, hz - 5, "white", 1.3);
    v.box(-3, 13, hz - 6, 3, 15, hz - 5, "white", 1.3);
    v.box(-6, 8, hz - 7, 6, 9, hz - 5, "steelDark");
    for (let x = -6; x < 6; x++) v.put(x, 6, hz - 3, x % 2 ? "sky" : "white");
    v.box(-6, 6, hz - 4, 6, 7, hz - 3, "sky");
    person(v, 3, 1, hz - 2, "yellow");
    bench(v, -5, 1, hz - 2);
    return;
  }
  if (lv === 2) {
    // A-frame chapel
    lot(c, "grass2");
    speckle(c, "grass3", 0.06);
    const zF = hz - 3;
    const z0 = -hz + 2;
    v.box(-2, 0, zF, 2, 1, hz, "concrete");
    for (let s = 0; s < 9; s++) v.box(-9 + s, 1 + s * 2, z0, 9 - s, 3 + s * 2, zF, s === 0 ? "woodLight" : "charcoal");
    v.clear(-7, 1, z0 + 1, 7, 18, zF - 1);
    for (let s = 1; s < 8; s++) v.box(-8 + s, 1 + s * 2, zF - 1, 8 - s, 3 + s * 2, zF, "glass", 0.55);
    v.box(-1, 3, zF - 1, 1, 15, zF, "white", 1);
    v.box(-3, 11, zF - 1, 3, 12, zF, "white", 1);
    v.box(-1, 1, zF - 1, 1, 4, zF, "woodDark");
    parking(c, 10, -hz + 1, hx, hz - 1, { cars: 0.6, axis: "z" });
    tree(v, -hx + 3, 1, hz - 3, "birch", 1);
    return;
  }
  lot(c, "grass2");
  speckle(c, "grass3", 0.05);
  if (lv === 3) {
    // modern worship center + freestanding glowing cross tower
    const zF = hz - 7;
    v.box(-hx, 0, zF + 1, hx, 1, hz, "concrete");
    v.box(-12, 1, -hz + 3, 8, 9, zF, "white");
    v.box(-12, 9, -hz + 3, 8, 10, zF, "concrete");
    for (let y = 1; y < 12; y++) v.box(-6 + Math.floor(y / 3), y, zF - 1, 6, y + 1, zF + 1, y < 9 ? "glass" : "white", y < 9 ? 0.45 : 0);
    v.box(-12, 1, zF - 1, -6, 12, zF + 1, "white");
    v.box(-2, 1, zF, 2, 4, zF + 1, "glassDark");
    // cross tower
    v.box(10, 1, zF - 3, 13, 26, zF - 1, "concrete");
    v.box(11, 4, zF - 1, 12, 24, zF, "white", 1.4);
    v.box(9, 19, zF - 1, 14, 20, zF, "white", 1.4);
    parking(c, -hx + 1, zF + 2, hx - 1, hz, { cars: 0.5 });
    tree(v, -hx + 2, 1, -hz + 3, "round", 1);
    return;
  }
  if (lv === 4) {
    // megachurch arena: big drum auditorium + glass lobby + LED sign + parking
    const zc = -hz + 12;
    v.cylinderY(0, zc, 1, 11, 11, "white");
    v.cylinderY(0, zc, 11, 12, 11.5, "silver");
    v.cylinderY(0, zc, 12, 14, 9, "silver");
    v.cylinderY(0, zc, 14, 15, 5, "glass", 0.4);
    for (let a = 0; a < 24; a++) {
      const ang = (a * Math.PI) / 12;
      v.box(Math.floor(Math.cos(ang) * 11), 3, Math.floor(zc + Math.sin(ang) * 11), Math.floor(Math.cos(ang) * 11) + 1, 9, Math.floor(zc + Math.sin(ang) * 11) + 1, a % 2 ? "glass" : "white", 0.4);
    }
    v.box(-8, 1, zc + 8, 8, 8, zc + 14, "glass", 0.45);
    v.box(-9, 8, zc + 7, 9, 9, zc + 15, "white");
    v.box(-1, 9, zc + 13, 1, 22, zc + 14, "white", 1.4);
    v.box(-4, 17, zc + 13, 4, 19, zc + 14, "white", 1.4);
    v.box(-2, 1, zc + 14, 2, 4, zc + 15, "glassDark");
    // LED sign
    v.box(hx - 6, 1, hz - 4, hx - 5, 7, hz - 3, "steelDark");
    v.box(hx - 9, 6, hz - 4, hx - 2, 10, hz - 3, "screenCyan", 1);
    parking(c, -hx + 1, zc + 16, hx - 10, hz - 1, { cars: 0.7 });
    tree(v, -hx + 3, 1, -hz + 3, "round", 1.1);
    tree(v, hx - 3, 1, -hz + 3, "round", 1.1);
    return;
  }
  // lv5 Crystal Cathedral
  const zF = hz - 12;
  const z0 = -hz + 4;
  for (let s = 0; s < 15; s++) {
    const half = 18 - s;
    const y = 1 + s * 2;
    const zz0 = z0 + Math.floor(s / 2);
    const zz1 = zF - Math.floor(s / 2);
    v.box(-half, y, zz0, half, y + 2, zz1, s % 3 === 2 ? "silver" : "glass", s % 3 === 2 ? 0 : 0.35);
    if (half > 2) v.clear(-half + 1, y, zz0 + 1, half - 1, y + 2, zz1 - 1);
  }
  for (let x = -18; x <= 15; x += 6) {
    for (let s = 0; s < 15; s++) {
      if (Math.abs(x) >= 18 - s) continue;
      v.box(x, 1 + s * 2, zF - Math.floor(s / 2) - 1, x + 1, 3 + s * 2, zF - Math.floor(s / 2), "silver");
    }
  }
  v.box(-2, 1, zF - 1, 2, 5, zF + 1, "glassDark");
  v.box(-1, 6, zF, 1, 20, zF + 1, "white", 1.4);
  v.box(-4, 15, zF, 4, 17, zF + 1, "white", 1.4);
  // prism spire tower
  const tx = hx - 8;
  const tz = zF - 4;
  for (let k = 0; k < 6; k++) {
    const r = 3.4 - k * 0.45;
    v.cylinderY(tx, tz, 1 + k * 7, 8 + k * 7, r, k % 2 ? "silver" : "glass", 0.4);
  }
  v.cone(tx, 43, 52, tz, 1.2, 0.3, "chrome");
  c.blink(Math.floor(tx), 52, Math.floor(tz), "white");
  fountain(v, -12, 1, zF + 5, 3, "white");
  fountain(v, 12, 1, zF + 5, 3, "white");
  for (let x = -hx + 2; x < hx - 2; x += 3) v.put(x, 1, hz - 1, "leaf");
  parking(c, -hx + 1, hz - 7, hx - 1, hz - 1, { cars: 0.7 });
  for (const lx of [-hx + 2, hx - 3]) lamp(v, lx, 1, zF + 2, 5);
}

function staveChurch(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "moss", 0.15);
  speckle(c, "snow", 0.04);
  const tar = "#3b2a1e";
  const tar2 = "#5a3d28";
  const zc = byLv(c, [0, 0, -2, -2, -4]);
  const base = byLv(c, [8, 10, 12, 14, 18]);
  v.box(-2, 0, zc + base / 2, 2, 1, hz, "path2");
  // svalgang (covered gallery) for lv>=3
  if (lv >= 3) {
    const g = base / 2 + 2;
    v.box(-g, 1, zc - g, g, 4, zc + g, tar2);
    for (let x = -g + 1; x < g - 1; x += 2) {
      v.box(x, 2, zc + g - 1, x + 1, 4, zc + g, null);
      v.box(x, 2, zc - g, x + 1, 4, zc - g + 1, null);
    }
    steepHip(v, -g - 1, 4, zc - g - 1, g + 1, zc + g + 1, tar, 1, tar, );
    v.box(-g + 2, 4, zc - g + 2, g - 2, 8, zc + g - 2, tar);
  }
  // tiered core: wall band, then a two-step steep skirt roof, repeated
  const tiers = byLv(c, [1, 2, 3, 4, 5]);
  const wallC = "#8a5a35";
  let y = 1;
  let half = base / 2;
  for (let t = 0; t < tiers; t++) {
    const wh = t === 0 ? 6 : 3;
    v.box(-half, y, zc - half, half, y + wh, zc + half, wallC);
    for (let x = -half; x < half; x += 2) v.box(x, y, zc + half - 1, x + 1, y + wh, zc + half, tar2);
    for (let x = -half + 1; x < half - 1; x += 3) v.put(x, y + wh - 2, zc + half - 1, "warmGlow", 0.6);
    y += wh;
    v.box(-half - 2, y, zc - half - 2, half + 2, y + 1, zc + half + 2, tar);
    v.box(-half - 1, y + 1, zc - half - 1, half + 1, y + 2, zc + half + 1, "#4a3524");
    v.box(-half, y + 2, zc - half, half, y + 3, zc + half, tar);
    // dragon heads at the corners
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = dx < 0 ? -half - 3 : half + 2;
      const pz = dz < 0 ? zc - half - 3 : zc + half + 2;
      v.put(px, y + 1, pz, "red");
      v.put(px + dx, y + 2, pz + dz, "gold", 0.3);
    }
    y += 3;
    half = Math.max(2, half - 2);
  }
  // central spire
  const sh = byLv(c, [6, 8, 10, 12, 16]);
  v.cone(0, y, y + sh, zc, half + 0.5, 0.3, tar);
  cross(v, 0, y + sh, zc, "gold", 3);
  // cross gables on the lowest tier
  if (lv >= 2) {
    for (const side of [-1, 1]) {
      const fz = zc + side * (base / 2);
      v.box(-3, 1, Math.min(fz, fz + side * 3), 3, 7, Math.max(fz, fz + side * 3), tar2);
      v.box(-3, 1, Math.min(fz, fz + side * 3), 3, 7, Math.max(fz, fz + side * 3), wallC);
      for (let k = 0; k < 4; k++) v.box(-4 + k, 7 + k, Math.min(fz, fz + side * 4), 4 - k, 8 + k, Math.max(fz, fz + side * 4), tar);
      v.put(0, 11, fz + side * 4 - (side > 0 ? 1 : 0), "red");
    }
    v.box(-1, 1, zc + base / 2 + 2, 1, 5, zc + base / 2 + 3, "crimson");
  } else {
    door(v, -1, 1, zc + half - 1, "crimson", 2, 3);
  }
  // pines, bell tower, graves
  const pines = byLv(c, [1, 2, 3, 4, 6]);
  for (let i = 0; i < pines; i++) {
    const px = i % 2 ? -hx + 2 + c.ri(0, 3) : hx - 3 - c.ri(0, 3);
    const pz = -hz + 3 + Math.floor((i / pines) * (2 * hz - 6));
    tree(v, px, 1, pz, "pine", 1.2 + c.rand() * 0.8);
  }
  if (lv >= 3) {
    const bx = hx - 9;
    const bz = hz - 8;
    v.box(bx, 1, bz, bx + 4, 8, bz + 4, tar2);
    v.box(bx + 1, 6, bz, bx + 3, 8, bz + 4, null);
    v.put(bx + 2, 7, bz + 2, "brass", 0.3);
    steepHip(v, bx - 1, 8, bz - 1, bx + 5, bz + 5, tar, 2);
  }
  if (lv >= 4) {
    for (let x = -hx + 6; x < -6; x += 4) for (let z = zc - 6; z < zc + 8; z += 5) headstone(c, x, z, 1, "woodDark");
    fence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 2, "woodDark", [-3, 3]);
  }
  if (lv >= 5) for (const lx of [-3, 2]) lantern(v, lx, hz - 3, 3, "woodDark");
}

/* =============================================================================================
 * GRAVEYARD — sprawls from a few headstones into a grand necropolis.
 *  V0 Victorian Gothic (iron fence, dead trees, obelisks, gothic mausoleums, fog lanterns)
 *  V1 New England churchyard (slate stones, drystone walls, autumn maples, white chapel)
 *  V2 Military memorial (uniform white rows, flags, black memorial wall, eternal flame)
 *  V3 Día de Muertos (painted crypts, marigold carpets, candles, papel picado)
 * ============================================================================================= */
function buildGraveyard(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, ["grass3", "grass2", "grass", "sandDark"][s]);
  speckle(c, ["moss", "grass3", "grass2", "sand"][s], 0.12);
  // central path
  v.box(-1, 0, -hz + 1, 1, 1, hz, ["path2", "path", "concrete", "sand"][s]);
  if (lv >= 3) v.box(-hx + 1, 0, -2, hx - 1, 1, 0, ["path2", "path", "concrete", "sand"][s]);

  // reserved zones (x0,z0,x1,z1) that rows avoid
  const zones: [number, number, number, number][] = [];
  const reserve = (x0: number, z0: number, x1: number, z1: number) => zones.push([x0, z0, x1, z1]);
  const free = (x: number, z: number) => !zones.some(([a, b, cc, d]) => x >= a - 1 && x < cc + 1 && z >= b - 1 && z < d + 2);

  // feature buildings first
  const mausCol = ["stone", "marble", "marble", "pink"][s];
  if (lv >= 3) {
    const mx = -hx + 3;
    const mz = -hz + 3;
    mausoleum(c, mx, mz, s, mausCol);
    reserve(mx - 1, mz - 1, mx + 8, mz + 9);
  }
  if (lv >= 4) {
    const mx = hx - 11;
    const mz = -hz + 3;
    if (s === 1) {
      // little white chapel
      v.box(mx, 1, mz, mx + 8, 7, mz + 10, "white");
      gable(v, mx - 1, 7, mz - 1, mx + 9, mz + 11, "z", "charcoal");
      triFace(v, mx, mx + 8, 7, mz + 9, "white");
      v.box(mx + 3, 1, mz + 9, mx + 5, 4, mz + 10, "woodDark");
      v.box(mx + 3, 11, mz + 7, mx + 5, 14, mz + 9, "white");
      v.cone(mx + 4, 14, 19, mz + 8, 1.4, 0.3, "white");
    } else if (s === 2) {
      // black granite memorial wall
      v.box(mx - 4, 1, mz + 2, mx + 9, 6, mz + 4, "black");
      for (let x = mx - 3; x < mx + 8; x++) for (let y = 2; y < 6; y += 1) if (c.rand() < 0.4) v.put(x, y, mz + 4, "silver");
      v.box(mx - 4, 0, mz + 4, mx + 9, 1, mz + 7, "marble");
    } else {
      mausoleum(c, mx, mz, s, s === 3 ? "teal" : "granite");
    }
    reserve(mx - 4, mz - 1, mx + 10, mz + 11);
  }
  if (lv >= 5) {
    // grand centerpiece
    const cz = -hz + 14;
    if (s === 0) {
      // gothic chapel-mausoleum with spire
      v.hollowBox(-5, 1, cz - 6, 5, 11, cz + 4, "stone");
      gable(v, -6, 11, cz - 7, 6, cz + 5, "z", "slate");
      triFace(v, -5, 5, 11, cz + 3, "stone");
      rose(v, 0, 13, cz + 3, 1.6);
      v.box(-1, 1, cz + 3, 1, 6, cz + 4, "black");
      spire(v, 0, cz - 4, 17, 10, 1.6, "slate", "gold");
      for (const px of [-5, 4]) spire(v, px + 0.5, cz + 3.5, 11, 5, 0.9, "stone", "stone");
      for (let z = cz - 5; z < cz + 3; z += 3) {
        v.box(-5, 4, z, -4, 9, z + 1, "purple", 0.6);
        v.box(4, 4, z, 5, 9, z + 1, "purple", 0.6);
      }
    } else if (s === 1) {
      // granite obelisk monument
      v.box(-4, 1, cz - 4, 4, 3, cz + 4, "granite");
      v.box(-2, 3, cz - 2, 2, 5, cz + 2, "stone");
      v.box(-1, 5, cz - 1, 1, 22, cz + 1, "marble");
      v.put(-1, 22, cz - 1, "marbleShade");
      v.put(0, 22, cz, "marbleShade");
      for (const [tx, tz] of [[-6, cz - 6], [5, cz - 6], [-6, cz + 5], [5, cz + 5]]) tree(v, tx, 1, tz, "autumn", 1.2, tx + tz);
    } else if (s === 2) {
      // tomb of the unknown + eternal flame + flags
      v.box(-6, 0, cz - 6, 6, 1, cz + 6, "marble");
      v.box(-3, 1, cz - 2, 3, 4, cz + 2, "marble");
      v.box(-4, 1, cz - 3, 4, 2, cz + 3, "marbleShade");
      v.cylinderY(0, cz + 4, 1, 2, 1.2, "black");
      v.put(0, 2, cz + 4, "fire", 1.6);
      v.put(-1, 2, cz + 4, "orange", 1.4);
      v.put(0, 3, cz + 4, "yellow", 1.4);
      c.smoke(0, 3, cz + 4, "spark");
      for (const fx of [-6, 5]) {
        v.box(fx, 1, cz - 6, fx + 1, 14, cz - 5, "silver");
        v.box(fx + 1, 11, cz - 6, fx + 5, 14, cz - 5, "red");
        v.box(fx + 1, 12, cz - 6, fx + 5, 13, cz - 5, "white");
        v.box(fx + 1, 12, cz - 6, fx + 3, 14, cz - 5, "blue");
      }
    } else {
      // painted chapel with marigold arch
      v.box(-5, 1, cz - 5, 5, 9, cz + 4, "yellow");
      v.box(-5, 9, cz - 5, 5, 10, cz + 4, "magenta");
      v.box(-6, 10, cz - 6, 6, 11, cz + 5, "terracotta");
      v.dome(0, 11, cz, 4, "teal");
      cross(v, 0, 15, cz, "white", 3, 0.2);
      v.box(-1, 1, cz + 3, 1, 5, cz + 4, "woodDark");
      for (let x = -3; x <= 3; x++) {
        const ay = 8 - Math.round(Math.abs(x) * Math.abs(x) * 0.4);
        v.put(x, ay, cz + 6, "orange", 0.3);
        v.box(x, 1, cz + 6, x + 1, ay, cz + 7, Math.abs(x) === 3 ? "orange" : null);
      }
    }
    reserve(-7, cz - 8, 7, cz + 8);
  }
  // rows of graves
  const step = s === 2 ? 3 : 4;
  const zstep = s === 2 ? 4 : 5;
  const margin = 2;
  for (let z = -hz + margin + 1; z < hz - 3; z += zstep) {
    for (let x = -hx + margin; x < hx - 2; x += step) {
      if (x >= -3 && x <= 1) continue;
      if (lv >= 3 && z >= -4 && z <= 0) continue;
      if (!free(x, z)) continue;
      if (s === 2) {
        headstone(c, x, z, 3, "white");
        v.box(x, 3, z, x + 2, 4, z + 1, null);
        v.put(x, 3, z, "white");
        continue;
      }
      if (c.rand() > [0.75, 0.8, 1, 0.8][s]) continue;
      if (s === 0) headstone(c, x, z, c.pick([0, 1, 1, 2, 3, 4]), c.pick(["stone", "granite", "marbleShade"]));
      else if (s === 1) headstone(c, x, z, c.pick([0, 0, 3, 5]), c.pick(["slate", "slateLight", "granite"]));
      else {
        // painted Mexican graves: coloured cross + marigolds + candle
        const col = c.pick(["pink", "teal", "yellow", "sky", "magenta", "white"]);
        headstone(c, x, z, c.pick([1, 3]), col);
        v.box(x, 1, z + 1, x + 2, 2, z + 3, "orange");
        v.put(x + 1, 1, z + 2, "yellow");
        if (c.rand() < 0.6) v.put(x + 1, 2, z + 2, "warmGlow", 1.4);
      }
    }
  }
  // trees
  const tcount = byLv(c, [1, 2, 3, 4, 6]);
  for (let i = 0; i < tcount; i++) {
    const tx = i % 2 === 0 ? -hx + 1 : hx - 2;
    const tz = -hz + 4 + Math.floor(((i + 0.5) / tcount) * (2 * hz - 8));
    if (!free(tx, tz)) continue;
    if (s === 0) deadTree(v, tx, tz, 7 + (i % 3));
    else if (s === 1) tree(v, tx, 1, tz, "autumn", 1.3, i);
    else if (s === 2) tree(v, tx, 1, tz, "oak", 1.2, i);
    else tree(v, tx, 1, tz, c.pick(["palm", "round"]), 1.1, i);
  }
  // boundary
  if (s === 0) {
    if (lv >= 2) {
      for (let x = -hx; x < hx; x++) {
        if (x >= -2 && x <= 1) continue;
        v.box(x, 1, hz - 1, x + 1, x % 2 ? 4 : 3, hz, "black");
        v.box(x, 1, -hz, x + 1, x % 2 ? 4 : 3, -hz + 1, "black");
      }
      for (let z = -hz; z < hz; z++) {
        v.box(-hx, 1, z, -hx + 1, z % 2 ? 4 : 3, z + 1, "black");
        v.box(hx - 1, 1, z, hx, z % 2 ? 4 : 3, z + 1, "black");
      }
      // gate pillars + arch
      v.box(-4, 1, hz - 1, -2, 7, hz, "stone");
      v.box(2, 1, hz - 1, 4, 7, hz, "stone");
      if (lv >= 3) {
        v.box(-4, 7, hz - 1, 4, 8, hz, "black");
        for (let x = -2; x < 2; x++) v.put(x, 8 + (x === -1 || x === 0 ? 1 : 0), hz - 1, "black");
      }
    }
  } else if (s === 1) {
    if (lv >= 2) {
      for (let x = -hx; x < hx; x++) {
        if (x >= -2 && x <= 1) continue;
        v.box(x, 1, hz - 1, x + 1, 3, hz, c.rand() < 0.5 ? "stone" : "granite");
      }
      for (let z = -hz; z < hz; z++) {
        v.box(-hx, 1, z, -hx + 1, 3, z + 1, c.rand() < 0.5 ? "stone" : "granite");
        v.box(hx - 1, 1, z, hx, 3, z + 1, c.rand() < 0.5 ? "stone" : "granite");
      }
    }
  } else if (s === 2) {
    hedge(v, -hx, hz - 1, -2, hz, 1, 1, "leafDark");
    hedge(v, 2, hz - 1, hx, hz, 1, 1, "leafDark");
    v.box(3, 1, hz - 3, 4, 14, hz - 2, "silver");
    v.box(4, 11, hz - 3, 8, 14, hz - 2, "red");
    v.box(4, 12, hz - 3, 8, 13, hz - 2, "white");
    v.box(4, 12, hz - 3, 6, 14, hz - 2, "blue");
  } else {
    if (lv >= 2) {
      v.box(-hx, 1, hz - 1, -2, 3, hz, "pink");
      v.box(2, 1, hz - 1, hx, 3, hz, "pink");
    }
    // papel picado strings
    if (lv >= 2) {
      const py = 6;
      v.box(-hx + 1, 1, hz - 2, -hx + 2, py + 1, hz - 1, "woodDark");
      v.box(hx - 2, 1, hz - 2, hx - 1, py + 1, hz - 1, "woodDark");
      for (let x = -hx + 2; x < hx - 2; x++) v.put(x, py - (x % 3 === 0 ? 1 : 0), hz - 2, ["magenta", "orange", "sky", "yellow", "lime", "purple"][(x + 64) % 6], 0.3);
    }
  }
  // lanterns / candles at night
  if (lv >= 3) {
    const lcol = s === 0 ? "#8fe0ff" : "warmGlow";
    for (let z = -hz + 3; z < hz - 2; z += 8) {
      lantern(v, -3, z, 3, "black", lcol);
      lantern(v, 2, z, 3, "black", lcol);
    }
  }
  if (lv >= 4 && s === 0) {
    // drifting will-o'-wisps
    for (let i = 0; i < 4; i++) v.put(c.ri(-hx + 3, hx - 4), c.ri(4, 7), c.ri(-hz + 4, hz - 4), "#b6f3ff", 1.6);
  }
  if (lv >= 2) {
    person(v, 0, 1, hz - 4, s === 3 ? "magenta" : "charcoal", "black");
    if (s === 3) v.put(1, 2, hz - 4, "orange");
  }
  if (lv === 1) {
    // single tree + a short picket on a tiny plot
    if (s === 0) deadTree(v, -hx + 2, -hz + 2, 6);
    fence(v, -hx, -hz, hx, hz, 1, 2, s === 0 ? "black" : s === 3 ? "pink" : "white", [-2, 2]);
  }
}

function mausoleum(c: Ctx, x: number, z: number, s: number, col: string): void {
  const v = c.v;
  if (s === 3) {
    // painted crypt
    v.box(x, 1, z, x + 7, 7, z + 8, col);
    v.box(x, 7, z, x + 7, 8, z + 8, "yellow");
    v.box(x + 2, 1, z + 7, x + 5, 5, z + 8, "woodDark");
    cross(v, x + 3, 8, z + 4, "white", 3, 0.2);
    for (let k = 0; k < 6; k++) v.put(x + c.ri(0, 6), 1, z + 8 + c.ri(0, 1), c.pick(["orange", "yellow"]));
    v.put(x + 1, 1, z + 8, "warmGlow", 1.4);
    v.put(x + 5, 1, z + 8, "warmGlow", 1.4);
    return;
  }
  v.box(x, 1, z, x + 7, 2, z + 8, "marbleShade");
  v.box(x + 1, 2, z, x + 6, 7, z + 7, col);
  column(v, x + 1, z + 7, 2, 7, "marble", "marbleShade");
  column(v, x + 5, z + 7, 2, 7, "marble", "marbleShade");
  v.box(x + 2, 2, z + 6, x + 5, 6, z + 7, s === 0 ? "black" : "iron");
  v.box(x, 7, z, x + 7, 8, z + 8, "marbleShade");
  if (s === 0) {
    gable(v, x, 8, z, x + 7, z + 8, "z", "slate");
    cross(v, x + 3, 12, z + 7, "stone", 3, 0);
  } else {
    pediment(v, x, x + 7, 8, z, z + 8, "marble");
  }
  v.put(x + 3, 5, z + 7, "#b6f3ff", 0.8);
}

/* =============================================================================================
 * MONASTERY — sprawls from a hermit's cell into a walled hilltop abbey.
 *  V0 Benedictine abbey (limestone, slate roofs, cloister, spire, herb gardens)
 *  V1 Tibetan gompa (white walls, maroon bands, golden roofs, stupas, prayer flags)
 *  V2 Greek Orthodox (whitewash & blue domes → Meteora monastery atop rock pillars)
 *  V3 Provençal Cistercian (honey stone, squat tower, lavender fields, beehives)
 * ============================================================================================= */
function buildMonastery(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, s === 1 ? "sandDark" : "grass2");
  speckle(c, s === 1 ? "stone" : "grass3", 0.1);
  if (s === 2 && lv >= 5) {
    meteora(c);
    return;
  }
  const wall = ["limestone", "white", "white", "sand"][s];
  const roof = ["slate", "goldDark", "blue", "stone"][s];
  let by = 1;
  // lv5: raised hill plinth with stairs
  if (lv >= 5) {
    by = 4;
    v.box(-hx + 2, 1, -hz + 2, hx - 2, by, hz - 8, "stone");
    v.box(-hx + 3, by - 1, -hz + 3, hx - 3, by, hz - 9, s === 1 ? "sandDark" : "grass2");
    stairs(v, -3, 3, 1, hz - 8, 3, "stone");
    for (let x = -hx + 2; x < hx - 2; x += 3) v.put(x, by - 1, hz - 8, "granite");
  }
  const hx2 = hx - (lv >= 5 ? 3 : 0);
  const hz2 = hz - (lv >= 5 ? 9 : 0);
  // --- level 1: hermit cell ---
  if (lv === 1) {
    v.box(-4, 1, -4, 3, 6, 3, wall);
    if (s === 1) {
      v.box(-4, 5, -4, 3, 6, 3, "redDark");
      v.box(-4, 6, -4, 3, 7, 3, "white");
      v.box(-1, 7, -1, 1, 9, 1, "gold", 0.3);
    } else if (s === 2) {
      v.dome(-0.5, 6, -0.5, 3.4, "blue");
      cross(v, -1, 9, -1, "white", 3, 0.2);
    } else gable(v, -5, 6, -5, 4, 4, "x", roof);
    v.box(-1, 1, 2, 1, 4, 3, "woodDark");
    v.put(2, 4, 2, "warmGlow", 0.8);
    flowerBed(c, -7, 4, -2, 7, 1, ["leaf", "red", "orange"]);
    if (s === 3) for (let x = 1; x < 7; x += 2) v.box(x, 1, 4, x + 1, 2, 7, "purple");
    if (s === 1) prayerFlags(c, -hx + 1, hz - 2, hx - 1, hz - 2, 6);
    else cross(v, 5, 1, 5, s === 2 ? "white" : "woodDark", 5, 0);
    tree(v, -hx + 2, 1, -hz + 2, s === 2 ? "cypress" : s === 1 ? "pine" : "fruit", 1);
    return;
  }
  // --- church / main temple hall at the back ---
  const cw = byLv(c, [8, 10, 12, 16, 16]);
  const cl = byLv(c, [0, 10, 12, 14, 14]);
  const cx0 = lv === 2 ? -hx + 2 : -cw / 2;
  const cz0 = -hz2 + 2;
  mainHall(c, s, cx0, cz0, cx0 + cw, cz0 + cl, by, byLv(c, [0, 6, 7, 8, 9]), wall, roof);
  // dormitory range (lv2: single block beside chapel)
  if (lv === 2) {
    const dx0 = cx0 + cw + 2;
    rangeBlock(c, s, dx0, cz0, hx - 2, cz0 + 7, by, wall, roof);
    vegGarden(c, s, -hx + 2, cz0 + cl + 2, hx - 2, hz - 2);
    return;
  }
  // cloister courtyard in front of the church
  const qz0 = cz0 + cl;
  const qhalf = byLv(c, [0, 0, 8, 10, 11]);
  const qz1 = qz0 + qhalf * 2 - 2;
  cloister(c, s, -qhalf, qz0, qhalf, qz1, by, wall, roof);
  // ranges around the cloister
  rangeBlock(c, s, -qhalf - 6, qz0 - 4, -qhalf, qz1, by, wall, roof);
  rangeBlock(c, s, qhalf, qz0 - 4, qhalf + 6, qz1, by, wall, roof);
  // bell tower
  const tx = qhalf - 1;
  const tz = qz0 - 5;
  const th = byLv(c, [0, 0, 16, 20, 24]);
  bellTower(c, s, tx, tz, th, by, wall, roof);
  // gardens
  if (hz2 - qz1 > 4) vegGarden(c, s, -hx2 + 2, qz1 + 2, -3, hz2 - 1);
  if (hz2 - qz1 > 4) vegGarden(c, s, 3, qz1 + 2, hx2 - 2, hz2 - 1);
  if (lv >= 4) {
    // perimeter walls + gatehouse
    const wcol = s === 1 ? "white" : s === 3 ? "sandDark" : "stone";
    const wx0 = -hx2 + 1;
    const wx1 = hx2 - 1;
    const wz0 = -hz2 + 1;
    const wz1 = hz2 - 1;
    v.box(wx0, by, wz0, wx1, by + 4, wz0 + 1, wcol);
    v.box(wx0, by, wz0, wx0 + 1, by + 4, wz1, wcol);
    v.box(wx1 - 1, by, wz0, wx1, by + 4, wz1, wcol);
    v.box(wx0, by, wz1 - 1, wx1, by + 4, wz1, wcol);
    if (s !== 1) {
      crenel(v, wx0, by + 4, wz0, wx1, wz1, wcol);
    } else {
      v.box(wx0, by + 3, wz0, wx1, by + 4, wz0 + 1, "redDark");
      v.box(wx0, by + 3, wz1 - 1, wx1, by + 4, wz1, "redDark");
    }
    v.box(-3, by, wz1 - 2, 3, by + 8, wz1 + 1, wcol);
    v.box(-2, by, wz1 - 2, 2, by + 5, wz1 + 1, null);
    v.box(-2, by, wz1 - 2, 2, by, wz1 + 1, "path");
    if (s === 1) {
      v.box(-4, by + 8, wz1 - 3, 4, by + 9, wz1 + 2, "goldDark");
      v.box(-1, by + 9, wz1 - 1, 1, by + 11, wz1, "gold", 0.4);
    } else if (s === 2) {
      v.dome(0, by + 8, wz1 - 0.5, 2.5, "blue");
    } else {
      crenel(v, -3, by + 8, wz1 - 2, 3, wz1 + 1, wcol);
      cross(v, -1, by + 8, wz1, "gold", 3);
    }
    if (lv >= 5) {
      for (const [px, pz] of [[wx0, wz0], [wx1, wz0], [wx0, wz1], [wx1, wz1]]) {
        v.cylinderY(px, pz, by, by + 9, 2.4, wcol);
        if (s === 1) v.cylinderY(px, pz, by + 7, by + 8, 2.4, "redDark");
        else v.cone(px, by + 9, by + 14, pz, 2.8, 0.4, s === 2 ? "blue" : roof);
      }
    }
  }
  // details
  if (s === 1) {
    stupa(c, -hx2 + 5, hz2 - 6, by, byLv(c, [0, 0, 2, 2.5, 3]));
    prayerFlags(c, -qhalf, qz0 + 1, qhalf, qz1 - 1, by + 8);
    prayerFlags(c, -hx2 + 2, hz2 - 2, hx2 - 2, -hz2 + 2, by + 10);
  }
  if (s === 3 && lv >= 3) {
    for (let k = 0; k < 3; k++) {
      const bx = hx2 - 4 - k * 3;
      v.box(bx, by, hz2 - 3, bx + 2, by + 2, hz2 - 2, "white");
      v.box(bx, by + 2, hz2 - 3, bx + 2, by + 3, hz2 - 2, "woodLight");
    }
  }
  const monks = byLv(c, [0, 1, 2, 3, 5]);
  const robe = ["woodDark", "redDark", "black", "white"][s];
  for (let i = 0; i < monks; i++) person(v, c.ri(-qhalf + 2, qhalf - 3), by, c.ri(qz0 + 2, qz1 - 3), robe, robe);
}

function mainHall(c: Ctx, s: number, x0: number, z0: number, x1: number, z1: number, by: number, H: number, wall: string, roof: string): void {
  const v = c.v;
  v.hollowBox(x0, by, z0, x1, by + H, z1, wall);
  const mx = Math.floor((x0 + x1) / 2);
  if (s === 1) {
    // Tibetan: battered walls, maroon frieze, golden roof pavilion
    v.box(x0, by + H - 2, z0, x1, by + H, z1, "redDark");
    for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, by + H - 1, z1 - 1, "gold", 0.3);
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.box(x, by + 2, z1 - 1, x + 1, by + H - 3, z1, "black");
    v.box(x0, by + H, z0, x1, by + H + 1, z1, "white");
    const px0 = x0 + 2;
    const px1 = x1 - 2;
    v.box(px0 + 1, by + H + 1, z0 + 3, px1 - 1, by + H + 4, z1 - 3, "redDark");
    upturnedEave(v, px0, by + H + 4, z0 + 2, px1, z1 - 2, "gold", "goldDark");
    v.box(mx - 1, by + H + 6, Math.floor((z0 + z1) / 2) - 1, mx + 1, by + H + 9, Math.floor((z0 + z1) / 2) + 1, "gold", 0.5);
    v.box(mx - 2, by, z1 - 1, mx + 2, by + 5, z1, "redDark");
    v.box(mx - 1, by, z1 - 1, mx + 1, by + 4, z1, "woodDark");
    return;
  }
  if (s === 2) {
    // Greek: whitewash cross-in-square with blue dome
    for (let z = z0 + 2; z < z1 - 1; z += 3) {
      v.box(x0, by + 2, z, x0 + 1, by + H - 2, z + 1, "blue");
      v.box(x1 - 1, by + 2, z, x1, by + H - 2, z + 1, "blue");
    }
    v.box(x0, by + H, z0, x1, by + H + 1, z1, "white");
    const cz = (z0 + z1) / 2;
    v.cylinderY((x0 + x1) / 2, cz, by + H, by + H + 3, 3, "white");
    v.dome((x0 + x1) / 2, by + H + 3, cz, 3.4, "blue");
    cross(v, mx, by + H + 7, Math.floor(cz), "gold", 3);
    v.box(mx - 1, by, z1 - 1, mx + 1, by + 4, z1, "blue");
    return;
  }
  // V0 / V3: gabled church nave
  for (let z = z0 + 2; z < z1 - 1; z += 3) {
    v.box(x0, by + 2, z, x0 + 1, by + H - 1, z + 1, s === 0 ? c.pick(STAINED) : "glassDark", 0.5);
    v.box(x1 - 1, by + 2, z, x1, by + H - 1, z + 1, s === 0 ? c.pick(STAINED) : "glassDark", 0.5);
  }
  gable(v, x0 - 1, by + H, z0 - 1, x1 + 1, z1 + 1, "z", roof);
  triFace(v, x0 + 1, x1 - 1, by + H, z1, wall);
  triFace(v, x0 + 1, x1 - 1, by + H, z0 - 1, wall);
  if (s === 0) rose(v, mx, by + H + 1, z1, 1.5);
  v.box(mx - 1, by, z1 - 1, mx + 1, by + 4, z1, "woodDark");
}

function rangeBlock(c: Ctx, s: number, x0: number, z0: number, x1: number, z1: number, by: number, wall: string, roof: string): void {
  const v = c.v;
  if (x1 - x0 < 3 || z1 - z0 < 3) return;
  const H = 6;
  v.hollowBox(x0, by, z0, x1, by + H, z1, wall);
  windowsSimple(c, x0, by, z0, x1, by + H, z1);
  if (s === 1) {
    v.box(x0, by + H - 1, z0, x1, by + H, z1, "redDark");
    v.box(x0, by + H, z0, x1, by + H + 1, z1, "white");
  } else if (s === 2) {
    v.box(x0, by + H, z0, x1, by + H + 1, z1, "white");
    for (let x = x0 + 1; x < x1 - 1; x += 3) v.put(x, by + 3, z1 - 1, "blue");
  } else {
    const axis = x1 - x0 >= z1 - z0 ? "x" : "z";
    gable(v, x0 - 1, by + H, z0 - 1, x1 + 1, z1 + 1, axis, roof);
  }
}

function windowsSimple(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  for (let y = y0 + 2; y < y1 - 1; y += 3) {
    for (let x = x0 + 2; x < x1 - 1; x += 3) {
      c.v.put(x, y, z1 - 1, "glass", c.rand() < 0.6 ? 0.5 : 0.05);
      c.v.put(x, y, z0, "glass", 0.3);
    }
    for (let z = z0 + 2; z < z1 - 1; z += 3) {
      c.v.put(x0, y, z, "glass", 0.4);
      c.v.put(x1 - 1, y, z, "glass", 0.4);
    }
  }
}

function cloister(c: Ctx, s: number, x0: number, z0: number, x1: number, z1: number, by: number, wall: string, roof: string): void {
  const v = c.v;
  const d = 3;
  const roofCol = s === 1 ? "redDark" : s === 2 ? "white" : roof;
  // walk floor
  v.box(x0, by - 1, z0, x1, by, z1, s === 1 ? "sand" : "stone");
  // garth (central lawn)
  v.box(x0 + d, by - 1, z0 + d, x1 - d, by, z1 - d, "grass");
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  v.box(Math.floor(cx) - 1, by - 1, z0 + d, Math.floor(cx) + 1, by, z1 - d, "path");
  v.box(x0 + d, by - 1, Math.floor(cz) - 1, x1 - d, by, Math.floor(cz) + 1, "path");
  // roof ring
  for (const [a, b, cc, dd] of [[x0, z0, x1, z0 + d], [x0, z1 - d, x1, z1], [x0, z0, x0 + d, z1], [x1 - d, z0, x1, z1]]) {
    v.box(a, by + 4, b, cc, by + 5, dd, roofCol);
  }
  // inner arcade columns
  for (let x = x0 + d; x < x1 - d; x += 2) {
    v.box(x, by, z0 + d - 1, x + 1, by + 4, z0 + d, wall);
    v.box(x, by, z1 - d, x + 1, by + 4, z1 - d + 1, wall);
  }
  for (let z = z0 + d; z < z1 - d; z += 2) {
    v.box(x0 + d - 1, by, z, x0 + d, by + 4, z + 1, wall);
    v.box(x1 - d, by, z, x1 - d + 1, by + 4, z + 1, wall);
  }
  // outer wall (back side touches church, keep sides)
  v.box(x0, by, z1 - 1, x1, by + 4, z1, wall);
  for (let x = x0 + 2; x < x1 - 2; x += 3) v.put(x, by + 2, z1 - 1, "glass", 0.4);
  v.box(Math.floor(cx) - 1, by, z1 - 1, Math.floor(cx) + 1, by + 3, z1, "woodDark");
  // centrepiece
  if (s === 1) {
    // prayer wheel pavilion
    v.cylinderY(cx, cz, by, by + 3, 1.2, "gold", 0.4);
    v.box(Math.floor(cx) - 2, by + 3, Math.floor(cz) - 2, Math.floor(cx) + 2, by + 4, Math.floor(cz) + 2, "redDark");
  } else if (s === 3) {
    tree(v, Math.floor(cx), by, Math.floor(cz), "fruit", 1, 3);
  } else {
    // well
    ring(v, cx, cz, by, by + 2, 1.8, 1, "stone");
    v.box(Math.floor(cx) - 2, by, Math.floor(cz), Math.floor(cx) - 1, by + 4, Math.floor(cz) + 1, "woodDark");
    v.box(Math.floor(cx) + 1, by, Math.floor(cz), Math.floor(cx) + 2, by + 4, Math.floor(cz) + 1, "woodDark");
    v.box(Math.floor(cx) - 2, by + 4, Math.floor(cz) - 1, Math.floor(cx) + 2, by + 5, Math.floor(cz) + 2, roof);
  }
  // corner trees in the garth
  for (const [tx, tz] of [[x0 + d + 1, z0 + d + 1], [x1 - d - 2, z1 - d - 2]]) {
    bush(v, tx, by, tz, 1.1, s === 3 ? "olive" : "leaf", s === 3 ? "purple" : "pink");
  }
}

function bellTower(c: Ctx, s: number, x: number, z: number, h: number, by: number, wall: string, roof: string): void {
  const v = c.v;
  if (s === 1) {
    // Tibetan: tall white dzong tower with maroon top & gold roof
    v.box(x, by, z, x + 6, by + h - 4, z + 6, "white");
    v.box(x, by + h - 7, z, x + 6, by + h - 4, z + 6, "redDark");
    for (let y = by + 3; y < by + h - 8; y += 4) v.put(x + 2, y, z + 5, "black");
    upturnedEave(v, x - 1, by + h - 4, z - 1, x + 7, z + 7, "gold", "goldDark");
    v.box(x + 2, by + h - 2, z + 2, x + 4, by + h + 2, z + 4, "gold", 0.4);
    return;
  }
  v.hollowBox(x, by, z, x + 5, by + h, z + 5, wall);
  v.box(x + 2, by + h - 4, z, x + 3, by + h - 1, z + 5, null);
  v.box(x, by + h - 4, z + 2, x + 5, by + h - 1, z + 3, null);
  v.put(x + 2, by + h - 3, z + 2, "brass", 0.3);
  if (s === 2) {
    v.dome(x + 2.5, by + h, z + 2.5, 2.6, "blue");
    cross(v, x + 2, by + h + 3, z + 2, "gold", 3);
  } else if (s === 3) {
    v.box(x - 1, by + h, z - 1, x + 6, by + h + 1, z + 6, "stone");
    hip(v, x - 1, by + h + 1, z - 1, x + 6, z + 6, roof);
    cross(v, x + 2, by + h + 4, z + 2, "iron", 3, 0);
  } else {
    spire(v, x + 2.5, z + 2.5, by + h, 9, 3, roof, "gold");
  }
}

function vegGarden(c: Ctx, s: number, x0: number, z0: number, x1: number, z1: number): void {
  const v = c.v;
  if (x1 - x0 < 3 || z1 - z0 < 3) return;
  if (s === 3) {
    // lavender rows
    v.box(x0, 0, z0, x1, 1, z1, "soil");
    for (let x = x0; x < x1; x += 2) v.box(x, 1, z0, x + 1, 2, z1, "purple");
    return;
  }
  v.box(x0, 0, z0, x1, 1, z1, "soilDark");
  const crops = s === 1 ? ["olive", "yellow"] : ["leaf", "lime", "orange", "red", "leafDark"];
  for (let z = z0; z < z1; z += 2) {
    const crop = crops[((z - z0) / 2) % crops.length];
    for (let x = x0; x < x1; x++) if (c.rand() < 0.8) v.put(x, 1, z, crop);
  }
  if (s === 2) for (let x = x0 + 1; x < x1; x += 4) tree(v, x, 1, z1 - 1, "fruit", 0.8, x);
}

function prayerFlags(c: Ctx, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const v = c.v;
  const cols = ["blue", "white", "red", "leaf", "yellow"];
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const z = Math.round(z0 + (z1 - z0) * t);
    const sag = Math.round(Math.sin(t * Math.PI) * 2);
    v.put(x, y - sag, z, cols[i % 5]);
  }
  v.box(x0, 1, z0, x0 + 1, y + 1, z0 + 1, "woodDark");
  v.box(x1, 1, z1, x1 + 1, y + 1, z1 + 1, "woodDark");
}

function stupa(c: Ctx, x: number, z: number, by: number, sc: number): void {
  if (sc <= 0) return;
  const v = c.v;
  const r = 2.4 * sc;
  v.box(Math.floor(x - r), by, Math.floor(z - r), Math.ceil(x + r), by + 2, Math.ceil(z + r), "white");
  v.box(Math.floor(x - r) + 1, by + 2, Math.floor(z - r) + 1, Math.ceil(x + r) - 1, by + 3, Math.ceil(z + r) - 1, "white");
  v.dome(x, by + 3, z, r * 0.8, "white");
  const top = by + 3 + Math.ceil(r * 0.8);
  v.cone(x, top, top + Math.round(3 * sc), z, 0.9 * sc, 0.4, "gold", 0.3);
  v.put(Math.floor(x), top + Math.round(3 * sc), Math.floor(z), "gold", 0.6);
}

function meteora(c: Ctx): void {
  const { v, hx, hz } = c;
  // the great rock pillar
  const cx = -4;
  const cz = -4;
  for (let y = 1; y < 26; y++) {
    const r = 12 - Math.abs(y - 10) * 0.12 + Math.sin(y * 0.7) * 0.6;
    v.cylinderY(cx, cz, y, y + 1, r, y % 5 === 0 ? "granite" : "stone");
  }
  v.cylinderY(cx, cz, 25, 26, 11.5, "grass2");
  // small pillar with hermitage
  const sx = hx - 8;
  const sz = hz - 9;
  for (let y = 1; y < 16; y++) v.cylinderY(sx, sz, y, y + 1, 5 - y * 0.05, y % 4 === 0 ? "granite" : "stone");
  v.box(sx - 3, 16, sz - 3, sx + 3, 20, sz + 3, "white");
  v.box(sx - 3, 20, sz - 3, sx + 3, 21, sz + 3, "terracotta");
  v.dome(sx, 21, sz, 2, "blue");
  v.put(sx, 15, sz + 3, "warmGlow", 1);
  // monastery on top
  const by = 26;
  mainHall(c, 2, cx - 5, cz - 8, cx + 5, cz + 2, by, 7, "white", "blue");
  rangeBlock(c, 2, cx - 10, cz + 2, cx + 3, cz + 9, by, "white", "blue");
  v.box(cx + 4, by, cz + 2, cx + 10, by + 10, cz + 8, "white");
  v.box(cx + 4, by + 10, cz + 2, cx + 10, by + 11, cz + 8, "terracotta");
  for (let y = by + 2; y < by + 10; y += 3) v.put(cx + 7, y, cz + 7, "glass", 0.6);
  bellTower(c, 2, cx - 10, cz - 7, 12, by, "white", "blue");
  // rope winch & basket
  v.box(cx + 7, by + 11, cz - 2, cx + 12, by + 12, cz - 1, "woodDark");
  v.box(cx + 11, by - 10, cz - 2, cx + 12, by + 11, cz - 1, "woodLight");
  v.box(cx + 10, by - 12, cz - 3, cx + 13, by - 10, cz, "woodDark");
  // stairs carved at base & trees
  for (let k = 0; k < 6; k++) v.box(cx + 8 + k, 1, cz + 8 + k, cx + 10 + k, 2 + k, cz + 10 + k, "stone");
  tree(v, -hx + 3, 1, hz - 3, "cypress", 1.4);
  tree(v, hx - 3, 1, -hz + 3, "cypress", 1.2);
  tree(v, -hx + 3, 1, -hz + 3, "pine", 1.2);
  person(v, cx + 2, by, cz + 3, "black", "black");
}

/* =============================================================================================
 * MOSQUE — domes multiply and minarets rise from one to four.
 *  V0 Ottoman (lead-grey cascading domes, pencil minarets with balconies)
 *  V1 Persian (turquoise tiled domes, iwan portal, tiled minarets)
 *  V2 Moorish/Andalusian (square minaret, horseshoe arches, green-tile roofs)
 *  V3 Mughal (red sandstone, white marble onion domes, chhatri-topped minarets)
 * ============================================================================================= */
function buildMosque(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, s === 3 ? "grass" : "sand");
  speckle(c, s === 3 ? "grass2" : "sandDark", 0.08);
  const wall = ["limestone", "sand", "cream", SANDSTONE][s];
  const domeCol = [LEAD, "teal", GREEN_TILE, MARBLE_W][s];
  const trim = ["marbleShade", "teal", "terracotta", MARBLE_W][s];
  const W = byLv(c, [12, 16, 20, 26, 32]);
  const D = byLv(c, [10, 10, 14, 14, 18]);
  const H = byLv(c, [5, 6, 7, 8, 10]);
  const z0 = -hz + 2;
  const z1 = z0 + D;
  const x0 = -W / 2;
  const x1 = W / 2;
  const zc = (z0 + z1) / 2;
  // courtyard (sahn)
  const court = lv >= 3;
  const cz1 = hz - byLv(c, [0, 0, 2, 2, 3]);
  if (court) {
    v.box(x0, 0, z1, x1, 1, cz1, s === 3 ? "marble" : "marbleShade");
    for (let x = x0 + 2; x < x1 - 2; x += 4) for (let z = z1 + 2; z < cz1 - 2; z += 4) v.put(x, 0, z, trim);
    // arcades
    const ah = 5;
    v.box(x0, 1 + ah - 1, z1, x0 + 3, 1 + ah, cz1, wall);
    v.box(x1 - 3, 1 + ah - 1, z1, x1, 1 + ah, cz1, wall);
    v.box(x0, 1 + ah - 1, cz1 - 3, x1, 1 + ah, cz1, wall);
    v.box(x0, 1, z1, x0 + 1, 1 + ah, cz1, wall);
    v.box(x1 - 1, 1, z1, x1, 1 + ah, cz1, wall);
    v.box(x0, 1, cz1 - 1, x1, 1 + ah, cz1, wall);
    for (let z = z1 + 1; z < cz1 - 3; z += 2) {
      v.box(x0 + 2, 1, z, x0 + 3, ah, z + 1, wall);
      v.box(x1 - 3, 1, z, x1 - 2, ah, z + 1, wall);
    }
    for (let x = x0 + 3; x < x1 - 3; x += 2) v.box(x, 1, cz1 - 3, x + 1, ah, cz1 - 2, wall);
    if (s === 0 || s === 1) {
      for (let z = z1 + 2; z < cz1 - 1; z += 4) {
        v.dome(x0 + 1.5, 1 + ah, z, 1.5, domeCol);
        v.dome(x1 - 1.5, 1 + ah, z, 1.5, domeCol);
      }
      for (let x = x0 + 4; x < x1 - 3; x += 4) v.dome(x, 1 + ah, cz1 - 1.5, 1.5, domeCol);
    } else if (s === 2) {
      v.box(x0, 1 + ah, z1, x0 + 3, 2 + ah, cz1, GREEN_TILE);
      v.box(x1 - 3, 1 + ah, z1, x1, 2 + ah, cz1, GREEN_TILE);
      v.box(x0, 1 + ah, cz1 - 3, x1, 2 + ah, cz1, GREEN_TILE);
    }
    // entrance gate
    v.box(-3, 1, cz1 - 1, 3, 1 + ah + 3, cz1 + 1, s === 1 ? "teal" : wall);
    v.box(-2, 1, cz1 - 1, 2, 1 + ah + 1, cz1 + 1, null);
    v.box(-2, 0, cz1 - 3, 2, 1, cz1 + 1, "path");
    // ablution fountain
    const fz = (z1 + cz1 - 3) / 2;
    if (lv >= 4) {
      ring(v, 0, fz, 1, 2, 3.5, 2.5, "marble");
      v.cylinderY(0, fz, 1, 2, 2.5, "water", 0.2);
      for (const [px, pz] of [[-3, fz - 3], [2, fz - 3], [-3, fz + 2], [2, fz + 2]]) v.box(px, 1, Math.floor(pz), px + 1, 6, Math.floor(pz) + 1, wall);
      v.box(-4, 6, Math.floor(fz) - 4, 4, 7, Math.floor(fz) + 4, wall);
      v.dome(0, 7, fz, 3, domeCol);
    } else {
      fountain(v, 0, 1, fz, 2.5, "marble");
    }
    if (s === 3 || s === 2) {
      // Mughal / Moorish water channels
      v.box(-1, 0, z1 + 1, 1, 1, cz1 - 3, "water", 0.15);
    }
  } else {
    v.box(-2, 0, z1, 2, 1, hz, "path");
  }
  // prayer hall
  v.hollowBox(x0, 1, z0, x1, 1 + H, z1, wall);
  band(v, x0, H, z0, x1, z1, trim, 0);
  for (let x = x0 + 2; x < x1 - 2; x += 3) {
    v.box(x, 2, z1 - 1, x + 1, H - 1, z1, "glass", 0.5);
    v.put(x, H - 1, z1 - 1, trim);
  }
  for (let z = z0 + 2; z < z1 - 2; z += 3) {
    v.box(x0, 2, z, x0 + 1, H - 1, z + 1, "glass", 0.5);
    v.box(x1 - 1, 2, z, x1, H - 1, z + 1, "glass", 0.5);
  }
  // portal
  const portalH = H + byLv(c, [2, 3, 5, 6, 8]);
  if (s === 1 || s === 3 || lv >= 3) {
    const pw = byLv(c, [3, 4, 5, 5, 6]);
    v.box(-pw, 1, z1 - 1, pw, portalH, z1 + 1, s === 1 ? "teal" : s === 3 ? SANDSTONE : wall);
    v.box(-pw + 1, 1, z1, pw - 1, portalH - 2, z1 + 1, s === 1 ? "blueDark" : s === 3 ? MARBLE_W : "marbleShade");
    for (let x = -pw; x < pw; x++) if ((x + 64) % 2 === 0) v.put(x, portalH, z1 - 1, trim);
    v.box(-1, 1, z1, 1, 5, z1 + 1, "woodDark");
    if (s === 3) {
      for (const px of [-pw, pw - 1]) {
        v.box(px, portalH, z1, px + 1, portalH + 3, z1 + 1, MARBLE_W);
        v.dome(px + 0.5, portalH + 3, z1 + 0.5, 1, MARBLE_W);
      }
    }
  } else {
    v.box(-1, 1, z1 - 1, 1, 5, z1, "woodDark");
    v.box(-2, 5, z1 - 1, 2, 6, z1, trim);
  }
  // roof & domes
  const roofY = 1 + H;
  const R = byLv(c, [3.5, 4.5, 5.5, 6.5, 8]);
  if (s === 2) {
    // Moorish: green tile hipped roofs + small mihrab dome
    v.box(x0, roofY, z0, x1, roofY + 1, z1, wall);
    const nb = Math.max(1, Math.floor(W / 8));
    const bw = W / nb;
    for (let i = 0; i < nb; i++) {
      const bx0 = Math.round(x0 + i * bw);
      const bx1 = Math.round(x0 + (i + 1) * bw);
      steepHip(v, bx0, roofY + 1, z0, bx1, z1, GREEN_TILE, 1);
    }
    v.cylinderY(0, z0 + 3, roofY + 3, roofY + 6, 2.4, wall);
    v.dome(0, roofY + 6, z0 + 3, 2.6, GREEN_TILE);
    crescent(v, 0, roofY + 9, z0 + 3);
  } else {
    v.box(x0, roofY, z0, x1, roofY + 1, z1, wall);
    const drumH = byLv(c, [1, 2, 2, 3, 4]);
    v.cylinderY(0, zc, roofY + 1, roofY + 1 + drumH, R + 0.5, wall);
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8;
      if (drumH >= 2) v.put(Math.floor(Math.cos(ang) * (R + 0.2)), roofY + drumH, Math.floor(zc + Math.sin(ang) * (R + 0.2)), "glass", 0.6);
    }
    const dy = roofY + 1 + drumH;
    let top: number;
    if (s === 0) {
      v.dome(0, dy, zc, R, domeCol);
      top = dy + Math.ceil(R);
      if (lv >= 4) {
        // cascading semi-domes front and back + corner domes
        v.dome(0, roofY + 1, zc + R, R * 0.65, domeCol);
        v.dome(0, roofY + 1, zc - R, R * 0.65, domeCol);
      }
      if (lv >= 3) {
        for (const dx of [x0 + 2.5, x1 - 2.5]) for (const dz of [z0 + 2.5, z1 - 2.5]) v.dome(dx, roofY + 1, dz, 2, domeCol);
      }
    } else if (s === 1) {
      top = onionDome(v, 0, zc, dy, R * 0.92, "teal", "gold") - 2;
      for (let y = dy; y < dy + R * 1.4; y += 2) {
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6 + y * 0.3;
          const rr = R * 0.9 * Math.sin(Math.PI * Math.min(1, ((y - dy) / (R * 2.4)) * 1.25 + 0.15));
          v.put(Math.floor(Math.cos(ang) * rr), y, Math.floor(zc + Math.sin(ang) * rr), a % 2 ? "yellow" : "blueDark");
        }
      }
    } else {
      // Mughal: tall drum + white onion + chhatris on corners
      top = onionDome(v, 0, zc, dy, R, MARBLE_W, "gold") - 2;
      if (lv >= 2) {
        for (const dx of [x0 + 2, x1 - 2]) for (const dz of [z0 + 2, z1 - 2]) chhatri(v, dx, roofY + 1, dz, 1.6);
      }
    }
    crescent(v, 0, top, Math.floor(zc));
  }
  // minarets
  const nm = byLv(c, [1, 1, 2, 2, 4]);
  const mh = byLv(c, [14, 18, 24, 28, 36]);
  const pos: [number, number][] = [];
  if (nm === 1) pos.push([x1 - 1, z1 - 1]);
  else if (nm === 2) pos.push([x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5]);
  else pos.push([x0 + 0.5, z0 + 1.5], [x1 - 0.5, z0 + 1.5], [x0 + 0.5, cz1 - 1.5], [x1 - 0.5, cz1 - 1.5]);
  for (const [mx, mz] of pos) minaret(c, s, mx, mz, mh, wall);
  // grounds
  if (lv >= 2) {
    const tk = s === 3 ? "cypress" : "palm";
    tree(v, -hx + 2, 1, hz - 3, tk, 1.2);
    tree(v, hx - 3, 1, hz - 3, tk, 1.2);
  }
  if (lv >= 4) {
    for (let x = x0 + 4; x < x1 - 4; x += 6) person(v, x, 1, z1 + 2, "white", "white");
  }
}

function chhatri(v: V, cx: number, y: number, cz: number, r: number): void {
  const x = Math.floor(cx);
  const z = Math.floor(cz);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.box(x + dx, y, z + dz, x + dx + 1, y + 3, z + dz + 1, MARBLE_W);
  v.box(x - 1, y + 3, z - 1, x + 2, y + 4, z + 2, MARBLE_W);
  v.dome(x + 0.5, y + 4, z + 0.5, r, MARBLE_W);
  v.put(x, y + 4 + Math.ceil(r), z, "gold", 0.5);
}

function minaret(c: Ctx, s: number, mx: number, mz: number, h: number, wall: string): void {
  const v = c.v;
  const x = Math.floor(mx);
  const z = Math.floor(mz);
  if (s === 2) {
    // square Moorish tower
    v.box(x - 2, 1, z - 2, x + 2, h, z + 2, wall);
    for (let y = 4; y < h - 2; y += 5) {
      v.box(x - 1, y, z + 1, x + 1, y + 2, z + 2, "glassDark", 0.3);
      v.box(x - 1, y, z - 2, x + 1, y + 2, z - 1, "glassDark", 0.3);
    }
    for (let y = h - 8; y < h - 2; y += 2) for (let k = -2; k < 2; k++) if ((k + y) % 2 === 0) {
      v.put(x + k, y, z + 1, "terracotta");
      v.put(x + k, y, z - 2, "terracotta");
    }
    crenel(v, x - 2, h, z - 2, x + 2, z + 2, "terracotta");
    v.box(x - 1, h, z - 1, x + 1, h + 4, z + 1, wall);
    hip(v, x - 1, h + 4, z - 1, x + 1, z + 1, GREEN_TILE);
    v.box(x, h + 5, z, x + 1, h + 7, z + 1, "gold", 0.5);
    v.put(x - 1, h + 6, z - 1, "gold", 0.5);
    return;
  }
  const r = s === 3 ? 1.6 : 1.3;
  const col = s === 1 ? "sand" : wall;
  v.cylinderY(mx, mz, 1, h, r, col);
  for (let y = 4; y < h; y += s === 3 ? 4 : 6) v.cylinderY(mx, mz, y, y + 1, r, s === 1 ? "teal" : s === 3 ? MARBLE_W : "marbleShade");
  // balconies
  const nb = h > 24 ? 3 : h > 16 ? 2 : 1;
  for (let k = 0; k < nb; k++) {
    const by = h - 3 - k * Math.floor(h / 4);
    v.cylinderY(mx, mz, by, by + 1, r + 1, s === 1 ? "teal" : "marbleShade");
  }
  if (s === 0) {
    v.cone(mx, h, h + 7, mz, r + 0.3, 0.3, LEAD);
    crescent(v, x, h + 7, z);
  } else if (s === 1) {
    v.cylinderY(mx, mz, h, h + 2, r + 0.4, "teal");
    v.dome(mx, h + 2, mz, r + 0.4, "teal");
    crescent(v, x, h + 4, z);
  } else {
    chhatri(v, mx, h, mz, 1.6);
  }
  v.put(x, h - 2, z + 1, "warmGlow", 1);
}

/* =============================================================================================
 * SYNAGOGUE — Star of David façade grows into a great domed synagogue.
 *  V0 Moorish Revival (striped red/cream, horseshoe arches, twin towers with gold domes)
 *  V1 Neoclassical (limestone, columned portico, tablets on pediment, central dome)
 *  V2 Modernist (white concrete wedge, giant glass star window, menorah sculpture)
 *  V3 Wooden (Eastern-European timber synagogue with tiered broken roofs)
 * ============================================================================================= */
function buildSynagogue(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);
  const W = byLv(c, [12, 16, 20, 24, 30]);
  const D = byLv(c, [10, 10, 16, 18, 24]);
  const H = byLv(c, [6, 7, 9, 11, 13]);
  const zF = hz - byLv(c, [3, 3, 5, 6, 8]);
  const z0 = Math.max(-hz + 1, zF - D);
  const x0 = -W / 2;
  const x1 = W / 2;
  v.box(-2, 0, zF, 2, 1, hz, "path");
  if (s === 0) {
    v.hollowBox(x0, 1, z0, x1, 1 + H, zF, "cream");
    for (let y = 2; y < 1 + H; y += 2) band(v, x0, y, z0, x1, zF, "brick");
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 1 + H, zF - 1);
    // horseshoe arched windows
    for (let x = x0 + 2; x < x1 - 2; x += 4) {
      if (Math.abs(x + 1) < 3) continue;
      v.box(x, 3, zF - 1, x + 2, H - 1, zF, "blue", 0.45);
      v.put(x - 1, H - 2, zF - 1, "gold");
      v.put(x + 2, H - 2, zF - 1, "gold");
    }
    for (let z = z0 + 2; z < zF - 2; z += 3) {
      v.box(x0, 3, z, x0 + 1, H - 1, z + 1, "blue", 0.45);
      v.box(x1 - 1, 3, z, x1, H - 1, z + 1, "blue", 0.45);
    }
    v.box(x0, 1 + H, z0, x1, 2 + H, zF, "brick");
    for (let x = x0; x < x1; x += 2) v.put(x, 2 + H, zF - 1, "cream");
    // central raised gable with star
    v.box(-5, 1 + H, zF - 2, 5, 6 + H, zF, "cream");
    for (let y = 2 + H; y < 6 + H; y += 2) v.box(-5, y, zF - 2, 5, y + 1, zF, "brick");
    v.box(-4, 6 + H, zF - 2, 4, 7 + H, zF, "cream");
    starOfDavid(v, 0, H - 1, zF, "gold", 0.6, "blueDark");
    v.box(-1, 1, zF - 1, 1, 5, zF + 1, "woodDark");
    // twin towers
    if (lv >= 3) {
      const th = H + byLv(c, [0, 0, 6, 9, 12]);
      for (const tx of [x0 - 1, x1 - 4]) {
        v.box(tx, 1, zF - 4, tx + 5, th, zF + 1, "cream");
        for (let y = 2; y < th; y += 2) band(v, tx, y, zF - 4, tx + 5, zF + 1, "brick");
        v.box(tx + 2, th - 6, zF, tx + 3, th - 2, zF + 1, "blue", 0.5);
        v.box(tx - 1, th, zF - 5, tx + 6, th + 1, zF + 2, "gold");
        onionDome(v, tx + 2.5, zF - 1.5, th + 1, 2.4, "gold", "gold");
        smallStar(v, tx + 2, th + 9, zF - 1, "gold");
      }
    }
    if (lv >= 5) {
      v.cylinderY(0, (z0 + zF) / 2, 2 + H, 6 + H, 5, "cream");
      v.dome(0, 6 + H, (z0 + zF) / 2, 5.4, "gold");
    }
  } else if (s === 1) {
    v.hollowBox(x0, 1, z0, x1, 1 + H, zF, "limestone");
    windowsSimple(c, x0, 1, z0, x1, 1 + H, zF);
    v.box(x0 - 1, 1 + H, z0 - 1, x1 + 1, 2 + H, zF + 1, "marbleShade");
    const pw = Math.min(W / 2 - 1, byLv(c, [4, 6, 7, 8, 10]));
    const pz = zF + byLv(c, [0, 2, 3, 4, 5]);
    if (lv >= 2) {
      v.box(-pw - 1, 1, zF, pw + 1, 2, pz + 1, "marbleShade");
      stairs(v, -pw + 1, pw - 1, 1, pz + 1, 1, "marbleShade");
      colonnade(v, -pw, pw, pz - 1, 2, 1 + H, "x", 2, "marble", "marbleShade");
      v.box(-pw - 1, 1 + H, zF, pw + 1, 2 + H, pz + 1, "marble");
      pediment(v, -pw - 1, pw + 1, 2 + H, zF, pz + 1, "marble", "marbleShade");
    }
    starOfDavid(v, 0, H - 3, zF, "blue", 0.6);
    v.box(-1, 1, zF - 1, 1, 5, zF, "woodDark");
    // tablets of the law on the ridge
    const ty = 2 + H + (lv >= 2 ? Math.ceil((2 * pw + 2) / 4) : 0);
    v.box(-2, ty, zF - 1, 0, ty + 3, zF, "white");
    v.box(0, ty, zF - 1, 2, ty + 3, zF, "white");
    v.put(-2, ty + 3, zF - 1, "white");
    v.put(1, ty + 3, zF - 1, "white");
    v.put(-1, ty + 1, zF - 1, "black");
    v.put(1, ty + 1, zF - 1, "black");
    if (lv >= 3) {
      const cz = (z0 + zF) / 2 - 1;
      const R = byLv(c, [0, 0, 4, 5, 6.5]);
      v.cylinderY(0, cz, 2 + H, 5 + H, R, "limestone");
      for (let a = 0; a < 12; a++) v.put(Math.floor(Math.cos(a * 0.52) * R), 4 + H, Math.floor(cz + Math.sin(a * 0.52) * R), "glass", 0.5);
      v.dome(0, 5 + H, cz, R + 0.3, "copper");
      smallStar(v, 0, 8 + H + Math.ceil(R), Math.floor(cz), "gold");
    }
  } else if (s === 2) {
    // modernist wedge rising to the front
    const rise = byLv(c, [6, 8, 10, 14, 18]);
    for (let z = z0; z < zF; z++) {
      const t = (z - z0) / (zF - z0);
      const hh = Math.round(H * 0.6 + t * rise);
      v.box(x0, 1, z, x1, 1 + hh, z + 1, "white");
    }
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 1 + H + rise - 2, zF - 1);
    for (let z = z0 + 2; z < zF - 1; z += 2) {
      v.box(x0, 2, z, x0 + 1, 4, z + 1, "glass", 0.4);
      v.box(x1 - 1, 2, z, x1, 4, z + 1, "glass", 0.4);
    }
    const sy = Math.round(H * 0.6 + rise) - 5;
    v.box(-6, 1, zF - 1, 6, sy + 6, zF, "white");
    starOfDavid(v, 0, sy, zF - 1, "glass", 0.9, "sky");
    v.box(-3, 1, zF - 1, 3, 4, zF, "glass", 0.5);
    if (lv >= 3) {
      v.box(x0 - 2, 1, zF - 6, x0, 4, zF, "concrete");
      v.box(x1, 1, zF - 6, x1 + 2, 4, zF, "concrete");
    }
  } else {
    // wooden synagogue
    const woodW = "woodDark";
    v.box(x0, 1, z0, x1, 1 + H, zF, woodW);
    v.clear(x0 + 1, 2, z0 + 1, x1 - 1, H, zF - 1);
    for (let x = x0; x < x1; x += 2) v.box(x, 1, zF - 1, x + 1, 1 + H, zF, "wood");
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.box(x, 3, zF - 1, x + 1, H - 1, zF, "glass", 0.5);
    const tiers = byLv(c, [1, 2, 2, 3, 3]);
    let y = 1 + H;
    let ix = 0;
    for (let t = 0; t < tiers; t++) {
      for (let k = 0; k < 3; k++) v.box(x0 - 1 + ix + k, y + k, z0 - 1 + ix + k, x1 + 1 - ix - k, y + k + 1, zF + 1 - ix - k, "#4a3524");
      y += 3;
      ix += 3;
      if (x0 + ix + 1 >= x1 - ix - 1) break;
      v.box(x0 + ix + 1, y, z0 + ix + 1, x1 - ix - 1, y + 2, zF - ix - 1, woodW);
      y += 2;
    }
    hip(v, x0 + ix, y, z0 + ix, x1 - ix, zF - ix, "#4a3524");
    starOfDavid(v, 0, H + 7, zF + 1 - 3, "gold", 0.5);
    v.box(-1, 1, zF - 1, 1, 5, zF + 1, "crimson");
    // galleries (side porches)
    if (lv >= 2) {
      v.box(x0 - 3, 1, z0 + 2, x0, 5, zF - 2, "wood");
      v.box(x0 - 4, 5, z0 + 1, x0, 6, zF - 1, "#4a3524");
      v.box(x1, 1, z0 + 2, x1 + 3, 5, zF - 2, "wood");
      v.box(x1, 5, z0 + 1, x1 + 4, 6, zF - 1, "#4a3524");
    }
  }
  // menorah sculpture
  if (lv >= 3) {
    const mx = hx - 7;
    const mz = hz - 3;
    v.box(mx + 3, 1, mz, mx + 4, 6, mz + 1, "gold", 0.3);
    v.box(mx, 3, mz, mx + 7, 4, mz + 1, "gold", 0.3);
    for (let k = 0; k < 7; k++) {
      v.box(mx + k, 4, mz, mx + k + 1, 6, mz + 1, "gold", 0.3);
      v.put(mx + k, 6, mz, "fire", 1.5);
    }
    v.box(mx + 2, 1, mz - 1, mx + 5, 2, mz + 2, "marbleShade");
  }
  if (lv >= 2) {
    tree(v, -hx + 3, 1, hz - 4, "oak", 1.1);
    flowerBed(c, -6, hz - 2, -3, hz, 1, ["blue", "white"]);
    flowerBed(c, 3, hz - 2, 6, hz, 1, ["blue", "white"]);
  }
  if (lv >= 4) {
    tree(v, hx - 3, 1, -hz + 4, "round", 1.2);
    tree(v, -hx + 3, 1, -hz + 4, "round", 1.2);
    for (const lx of [-3, 2]) lamp(v, lx, 1, hz - 2, 4);
    person(v, 3, 1, zF + 2, "charcoal", "black");
  }
}

/* =============================================================================================
 * TEMPLE — Asian & South-Asian temples growing from a roadside shrine into a temple city.
 *  V0 Chinese Buddhist (red halls, upturned roofs, pagoda of 3 → 5 → 9 tiers, lotus pond)
 *  V1 Hindu (sandstone shikhara towers, pillared mandapa, gopuram gate, temple tank)
 *  V2 Shinto (vermilion torii gates → torii tunnel, honden with chigi, stone lanterns)
 *  V3 Thai Wat (white walls, stacked red/green roofs with chofa, golden chedi)
 * ============================================================================================= */
function buildTemple(c: Ctx): void {
  const s = c.variant % 4;
  if (s === 0) chineseTemple(c);
  else if (s === 1) hinduTemple(c);
  else if (s === 2) shintoShrine(c);
  else thaiWat(c);
}

function chineseHall(c: Ctx, x0: number, z0: number, x1: number, z1: number, H: number, double: boolean): void {
  const v = c.v;
  v.box(x0 - 1, 0, z0 - 1, x1 + 1, 1, z1 + 1, "marbleShade");
  v.box(x0, 1, z0, x1, 1 + H, z1, "crimson");
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, H, z1 - 1);
  for (let x = x0 + 1; x < x1 - 1; x += 2) v.box(x, 2, z1 - 1, x + 1, H, z1, "#f2c14e", 0.5);
  for (let x = x0; x < x1; x += 3) v.box(x, 1, z1, x + 1, 1 + H, z1 + 1, "red");
  v.box(x0, H, z0, x1, 1 + H, z1 + 1, "tealDark");
  let y = upturnedEave(v, x0 - 2, 1 + H, z0 - 2, x1 + 2, z1 + 3, "goldDark", "gold");
  if (double) {
    v.box(x0 + 2, y, z0 + 2, x1 - 2, y + 3, z1 - 1, "crimson");
    y = upturnedEave(v, x0, y + 3, z0, x1, z1 + 1, "goldDark", "gold");
  }
  v.box(x0 + 1, y, Math.floor((z0 + z1) / 2) - 1, x1 - 1, y + 2, Math.floor((z0 + z1) / 2) + 1, "goldDark");
  v.put(x0, y + 2, Math.floor((z0 + z1) / 2) - 1, "gold", 0.4);
  v.put(x1 - 1, y + 2, Math.floor((z0 + z1) / 2) - 1, "gold", 0.4);
}

function pagoda(c: Ctx, cx: number, cz: number, tiers: number, base: number): void {
  const v = c.v;
  let half = base / 2;
  let y = 1;
  v.box(cx - half - 1, 0, cz - half - 1, cx + half + 1, 2, cz + half + 1, "marbleShade");
  y = 2;
  for (let t = 0; t < tiers; t++) {
    const hh = t === 0 ? 5 : 3;
    v.box(cx - half, y, cz - half, cx + half, y + hh, cz + half, t % 2 ? "cream" : "crimson");
    v.put(cx - 1, y + 1, cz + half - 1, "#f2c14e", 0.6);
    v.put(cx, y + 1, cz + half - 1, "#f2c14e", 0.6);
    y += hh;
    y = upturnedEave(v, cx - half - 2, y, cz - half - 2, cx + half + 2, cz + half + 2, "goldDark", "gold");
    half = Math.max(1.5, half - (base > 8 ? 0.5 : 0.35));
    half = Math.round(half);
  }
  v.cylinderY(cx, cz, y, y + 6, 0.6, "gold", 0.3);
  for (let k = 0; k < 5; k++) v.cylinderY(cx, cz, y + 1 + k, y + 2 + k, 1.2 - k * 0.15, k % 2 ? "gold" : "goldDark");
  v.put(Math.floor(cx), y + 7, Math.floor(cz), "gold", 0.7);
}

function chineseTemple(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);
  v.box(-2, 0, -hz, 2, 1, hz, "stone");
  if (lv === 1) {
    // roadside shrine + incense
    chineseHall(c, -4, -5, 4, 1, 4, false);
    v.box(-1, 1, 3, 1, 3, 5, "brass");
    c.smoke(0, 3, 4, "smoke");
    tree(v, -hx + 2, 1, hz - 3, "blossom", 1, 1);
    lantern(v, 4, 5, 2, "crimson", "warmGlow");
    return;
  }
  const hallW = byLv(c, [8, 12, 14, 16, 20]);
  const hz0 = -hz + 2;
  chineseHall(c, -hallW / 2, hz0, hallW / 2, hz0 + 9, byLv(c, [4, 5, 6, 7, 8]), lv >= 3);
  // incense burner
  v.cylinderY(0, hz0 + 14, 1, 3, 1.4, "brass");
  c.smoke(0, 4, hz0 + 14, "smoke");
  if (lv >= 3) {
    const tiers = byLv(c, [0, 0, 3, 5, 9]);
    const px = lv >= 5 ? hx - 9 : hx - 7;
    pagoda(c, px, lv >= 5 ? -hz + 10 : 2, tiers, lv >= 5 ? 9 : 7);
  }
  if (lv >= 4) {
    // paifang gate at the front
    const gz = hz - 3;
    for (const gx of [-5, 4]) v.box(gx, 1, gz, gx + 1, 9, gz + 1, "red");
    v.box(-7, 9, gz - 1, 7, 10, gz + 2, "tealDark");
    v.box(-6, 10, gz - 1, 6, 11, gz + 2, "gold");
    v.box(-2, 7, gz, 2, 9, gz + 1, "gold", 0.3);
    lantern(v, -4, gz - 2, 4, "crimson", "red");
    lantern(v, 3, gz - 2, 4, "crimson", "red");
  }
  if (lv >= 5) {
    // lotus pond + side hall + bell pavilion
    const pzm = hz - 12;
    waterPlane(v, -hx + 2, pzm - 5, -5, pzm + 5);
    for (let k = 0; k < 6; k++) v.put(c.ri(-hx + 3, -6), 1, c.ri(pzm - 4, pzm + 4), k % 2 ? "pink" : "leaf");
    v.box(-hx + 2, 1, pzm, -5, 2, pzm + 2, "red");
    chineseHall(c, -hx + 3, -hz + 14, -hx + 13, -hz + 22, 5, false);
    tree(v, hx - 4, 1, hz - 4, "blossom", 1.3, 2);
  }
  tree(v, -hx + 2, 1, hz - 3, "blossom", 1.1, 1);
  if (lv >= 3) tree(v, -hx + 3, 1, 0, "pine", 1.2);
}

function hinduShikhara(c: Ctx, cx: number, cz: number, base: number, h: number, y0: number, col: string): number {
  const v = c.v;
  // curvilinear tower: stacked tiers that taper with a curve
  const tiers = Math.round(h / 2);
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const half = (base / 2) * (1 - Math.pow(k, 1.6) * 0.75);
    const yy = y0 + t * 2;
    v.box(Math.round(cx - half), yy, Math.round(cz - half), Math.round(cx + half), yy + 2, Math.round(cz + half), t % 2 ? col : "sandDark");
    // vertical ribs
    v.box(Math.round(cx) - 1, yy, Math.round(cz + half), Math.round(cx) + 1, yy + 2, Math.round(cz + half) + 1, col);
  }
  const top = y0 + tiers * 2;
  v.cylinderY(cx, cz, top, top + 1, base * 0.2 + 0.6, "sandDark");
  v.cylinderY(cx, cz, top + 1, top + 2, base * 0.12 + 0.4, col);
  v.box(Math.floor(cx), top + 2, Math.floor(cz), Math.floor(cx) + 1, top + 4, Math.floor(cz) + 1, "gold", 0.6);
  // saffron flag
  v.box(Math.floor(cx), top + 4, Math.floor(cz), Math.floor(cx) + 1, top + 7, Math.floor(cz) + 1, "woodDark");
  v.box(Math.floor(cx) + 1, top + 5, Math.floor(cz), Math.floor(cx) + 3, top + 7, Math.floor(cz) + 1, "orange");
  return top + 4;
}

function hinduTemple(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "sand");
  speckle(c, "grass2", 0.1);
  const stone = "#d9a066";
  v.box(-2, 0, -hz, 2, 1, hz, "sandDark");
  const base = byLv(c, [8, 10, 12, 14, 18]);
  const sh = byLv(c, [10, 14, 20, 24, 32]);
  const scz = -hz + base / 2 + 2;
  // plinth
  v.box(-base / 2 - 1, 1, scz - base / 2 - 1, base / 2 + 1, 3, scz + base / 2 + 1, "sandDark");
  hinduShikhara(c, 0, scz, base, sh, 3, stone);
  v.box(-1, 3, scz + base / 2 - 1, 1, 7, scz + base / 2 + 1, "woodDark");
  // mandapa (pillared hall) in front
  if (lv >= 2) {
    const mz0 = scz + base / 2 + 1;
    const mz1 = mz0 + byLv(c, [0, 8, 10, 12, 14]);
    const mw = base / 2 + 1;
    v.box(-mw, 1, mz0, mw, 3, mz1, "sandDark");
    for (let x = -mw; x < mw; x += 2) for (const z of [mz0, mz1 - 1]) v.box(x, 3, z, x + 1, 8, z + 1, stone);
    for (let z = mz0; z < mz1; z += 2) {
      v.box(-mw, 3, z, -mw + 1, 8, z + 1, stone);
      v.box(mw - 1, 3, z, mw, 8, z + 1, stone);
    }
    v.box(-mw - 1, 8, mz0 - 1, mw + 1, 9, mz1 + 1, "sandDark");
    steepHip(v, -mw, 9, mz0, mw, mz1, stone, 1);
    v.box(-1, 3, mz0 + 2, 1, 5, mz0 + 4, "orange", 0.3);
    stairs(v, -2, 2, 1, mz1, 2, "sandDark");
  }
  // subsidiary shrines
  if (lv >= 3) {
    for (const sx of [-hx + 5, hx - 5]) {
      v.box(sx - 3, 1, scz - 3, sx + 3, 2, scz + 3, "sandDark");
      hinduShikhara(c, sx, scz, 5, 8, 2, stone);
    }
  }
  // gopuram gateway
  if (lv >= 4) {
    const gz = hz - 4;
    const gw = 7;
    const cols = ["pink", "yellow", "sky", "lime", "orange", "magenta"];
    for (let t = 0; t < byLv(c, [0, 0, 0, 6, 8]); t++) {
      const half = gw - t * 0.6;
      v.box(Math.round(-half), 1 + t * 3, gz - 2, Math.round(half), 4 + t * 3, gz + 2, cols[t % cols.length]);
      for (let x = Math.round(-half) + 1; x < Math.round(half) - 1; x += 2) v.put(x, 2 + t * 3, gz + 1, "white");
    }
    const gt = 1 + byLv(c, [0, 0, 0, 6, 8]) * 3;
    v.box(-3, gt, gz - 1, 3, gt + 2, gz + 1, "orange");
    for (let x = -3; x < 3; x += 2) v.put(x, gt + 2, gz, "gold", 0.6);
    v.box(-2, 1, gz - 2, 2, 7, gz + 2, null);
  }
  // temple tank
  if (lv >= 5) {
    const tx0 = -hx + 2;
    const tz0 = 2;
    v.box(tx0, 0, tz0, tx0 + 14, 1, tz0 + 14, "sandDark");
    v.box(tx0 + 2, 0, tz0 + 2, tx0 + 12, 1, tz0 + 12, "stone");
    waterPlane(v, tx0 + 3, tz0 + 3, tx0 + 11, tz0 + 11);
    v.box(tx0 + 6, 1, tz0 + 6, tx0 + 8, 5, tz0 + 8, stone);
    v.dome(tx0 + 7, 5, tz0 + 7, 1.5, stone);
  }
  if (lv >= 2) {
    tree(v, hx - 3, 1, hz - 3, "palm", 1.2);
    tree(v, -hx + 3, 1, hz - 3, "round", 1.3, 1);
    lantern(v, -3, hz - 2, 2, "brass", "fire");
    lantern(v, 2, hz - 2, 2, "brass", "fire");
  }
  if (lv >= 3) for (let k = 0; k < 4; k++) v.put(c.ri(-hx + 2, hx - 3), 1, hz - 1, "orange");
}

function torii(v: V, cx: number, z: number, h = 7, w = 4, col = "#e2401c"): void {
  v.box(cx - w, 1, z, cx - w + 1, h, z + 1, col);
  v.box(cx + w - 1, 1, z, cx + w, h, z + 1, col);
  v.box(cx - w - 1, h, z, cx + w + 1, h + 1, z + 1, "black");
  v.put(cx - w - 2, h + 1, z, "black");
  v.put(cx + w + 1, h + 1, z, "black");
  v.box(cx - w, h - 2, z, cx + w, h - 1, z + 1, col);
  v.put(cx - 1, h - 1, z, col);
}

function shintoHall(c: Ctx, x0: number, z0: number, x1: number, z1: number, H: number, roofCol: string): void {
  const v = c.v;
  v.box(x0 - 1, 0, z0 - 1, x1 + 1, 2, z1 + 1, "woodDark");
  v.box(x0, 2, z0, x1, 2 + H, z1, "woodLight");
  v.box(x0 + 1, 3, z1 - 1, x1 - 1, 1 + H, z1, "white");
  for (let x = x0; x < x1; x += 3) v.box(x, 2, z1 - 1, x + 1, 2 + H, z1, "#e2401c");
  const ry = gable(v, x0 - 2, 2 + H, z0 - 2, x1 + 2, z1 + 2, "z", roofCol);
  // chigi (crossed finials) and katsuogi logs
  const mx = Math.floor((x0 + x1) / 2);
  for (const zz of [z0 - 2, z1 + 1]) {
    v.put(mx - 1, ry, zz, "woodDark");
    v.put(mx - 2, ry + 1, zz, "woodDark");
    v.put(mx, ry, zz, "woodDark");
    v.put(mx + 1, ry + 1, zz, "woodDark");
  }
  for (let z = z0; z < z1; z += 3) v.box(mx - 1, ry, z, mx + 1, ry + 1, z + 1, "gold");
  // shimenawa rope
  v.box(x0, 1 + H, z1, x1, 2 + H, z1 + 1, "#e8d8a8");
  v.put(mx - 1, H, z1, "white");
  v.put(mx + 1, H, z1, "white");
}

function shintoShrine(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "moss", 0.15);
  v.box(-2, 0, -hz, 2, 1, hz, "path2");
  const H = byLv(c, [3, 4, 5, 6, 7]);
  const hw = byLv(c, [5, 6, 8, 9, 11]);
  const hz0 = -hz + 2;
  const hz1 = hz0 + byLv(c, [6, 8, 9, 10, 12]);
  shintoHall(c, -hw, hz0, hw, hz1, H, lv >= 3 ? "tealDark" : "#7a5c3a");
  if (lv >= 3) shintoHall(c, -hw + 2, hz1 + 2, hw - 2, hz1 + 8, H - 1, "tealDark");
  // torii count
  const nt = byLv(c, [1, 2, 3, 6, 14]);
  const tz1 = hz - 2;
  const tz0 = lv >= 3 ? hz1 + 10 : hz1 + 2;
  for (let i = 0; i < nt; i++) {
    const z = nt === 1 ? tz1 : Math.round(tz1 - (i * (tz1 - tz0)) / Math.max(1, nt - 1));
    torii(v, 0, z, i === 0 ? 9 : 7, i === 0 ? 4 : 3);
  }
  // stone lanterns
  const nl = byLv(c, [1, 2, 2, 3, 4]);
  for (let i = 0; i < nl; i++) {
    const z = hz1 + 3 + i * 5;
    for (const lx of [-5, 4]) {
      if (z >= hz - 1) continue;
      v.box(lx, 1, z, lx + 1, 3, z + 1, "stone");
      v.box(lx - 1, 3, z - 1, lx + 2, 4, z + 2, "stone");
      v.put(lx, 4, z, "warmGlow", 1.2);
      v.box(lx - 1, 5, z - 1, lx + 2, 6, z + 2, "stone");
    }
  }
  // sacred cedar with rope
  if (lv >= 2) {
    const tx = -hx + 4;
    const tz = 0;
    tree(v, tx, 1, tz, "pine", byLv(c, [1, 1.5, 2, 2.3, 2.6]));
    v.cylinderY(tx + 0.5, tz + 0.5, 3, 4, 1.3, "#e8d8a8");
  }
  if (lv >= 4) {
    // koi pond with red arched bridge
    const px0 = hx - 13;
    const pz0 = hz1 + 2;
    waterPlane(v, px0, pz0, hx - 2, pz0 + 10);
    for (let k = 0; k < 4; k++) v.put(c.ri(px0 + 1, hx - 3), 0, c.ri(pz0 + 1, pz0 + 9), k % 2 ? "orange" : "white", 0.2);
    for (let x = px0; x < hx - 2; x++) {
      const t = (x - px0) / (hx - 2 - px0);
      v.box(x, 1 + Math.round(Math.sin(t * Math.PI) * 2), pz0 + 4, x + 1, 2 + Math.round(Math.sin(t * Math.PI) * 2), pz0 + 7, "#e2401c");
    }
    tree(v, hx - 3, 1, -hz + 3, "blossom", 1.2, 1);
  }
  if (lv >= 5) {
    // five-storey pagoda behind
    pagoda(c, -hx + 7, -hz + 7, 5, 6);
    v.put(1, 1, hz - 5, "white");
    person(v, 1, 1, hz - 6, "white", "#e2401c");
  }
}

function thaiRoof(v: V, x0: number, y: number, z0: number, x1: number, z1: number, layers: number): number {
  let yy = y;
  for (let l = 0; l < layers; l++) {
    const ins = l * 2;
    const steps = Math.ceil((x1 - x0 - ins * 2) / 2);
    for (let s = 0; s < steps; s++) {
      v.box(x0 + ins + s, yy + s * 2, z0 + l * 2, x1 - ins - s, yy + s * 2 + 2, z1 - l * 2, s === 0 ? "leaf" : "red");
    }
    // chofa finials at gable ends
    v.put(x0 + ins, yy + 2, z1 - l * 2, "gold", 0.4);
    v.put(x1 - ins - 1, yy + 2, z1 - l * 2, "gold", 0.4);
    yy += 3;
  }
  const mx = Math.floor((x0 + x1) / 2);
  v.box(mx - 1, yy + Math.ceil((x1 - x0) / 2) * 2 - 6, z1 - 1, mx + 1, yy + Math.ceil((x1 - x0) / 2) * 2 - 3, z1, "gold", 0.5);
  return yy;
}

function chedi(c: Ctx, cx: number, cz: number, y0: number, sc: number): void {
  const v = c.v;
  const r = 3 * sc;
  for (let k = 0; k < 3; k++) v.box(Math.round(cx - r - 2 + k), y0 + k, Math.round(cz - r - 2 + k), Math.round(cx + r + 2 - k), y0 + k + 1, Math.round(cz + r + 2 - k), "white");
  v.dome(cx, y0 + 3, cz, r, "gold", 0.15);
  v.cylinderY(cx, cz, y0 + 3 + Math.round(r * 0.6), y0 + 3 + Math.round(r), r * 0.4, "goldDark");
  v.cone(cx, y0 + 3 + Math.round(r), y0 + 3 + Math.round(r) + Math.round(7 * sc), cz, r * 0.45, 0.3, "gold", 0.2);
  for (let k = 0; k < Math.round(4 * sc); k += 2) v.cylinderY(cx, cz, y0 + 4 + Math.round(r) + k, y0 + 5 + Math.round(r) + k, r * 0.4 - k * 0.12, "goldDark");
  v.put(Math.floor(cx), y0 + 3 + Math.round(r) + Math.round(7 * sc), Math.floor(cz), "white", 0.8);
}

function thaiWat(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);
  v.box(-2, 0, -hz, 2, 1, hz, "marbleShade");
  const W = byLv(c, [8, 10, 12, 14, 16]);
  const D = byLv(c, [10, 14, 14, 18, 20]);
  const H = byLv(c, [4, 5, 6, 7, 8]);
  const x0 = -W / 2;
  const x1 = W / 2;
  const z0 = -hz + 2;
  const z1 = Math.min(hz - 3, z0 + D);
  v.box(x0 - 1, 1, z0 - 1, x1 + 1, 2, z1 + 1, "white");
  v.box(x0, 2, z0, x1, 2 + H, z1, "white");
  for (let z = z0 + 2; z < z1 - 1; z += 3) {
    v.box(x0, 3, z, x0 + 1, 1 + H, z + 1, "gold", 0.3);
    v.box(x1 - 1, 3, z, x1, 1 + H, z + 1, "gold", 0.3);
  }
  v.box(-2, 2, z1 - 1, 2, 2 + H, z1, "red");
  v.box(-1, 2, z1 - 1, 1, 6, z1, "gold", 0.4);
  thaiRoof(v, x0 - 1, 2 + H, z0 - 1, x1 + 1, z1 + 1, byLv(c, [1, 2, 2, 3, 3]));
  // naga balustrades on the stairs
  v.box(-3, 1, z1 + 1, -2, 2, z1 + 4, "gold", 0.2);
  v.box(2, 1, z1 + 1, 3, 2, z1 + 4, "gold", 0.2);
  v.put(-3, 2, z1 + 3, "leaf");
  v.put(2, 2, z1 + 3, "leaf");
  if (lv >= 3) {
    const sc = byLv(c, [0, 0, 1, 1.3, 2.2]);
    const cx = lv >= 5 ? hx - 11 : hx - 6;
    chedi(c, cx, lv >= 5 ? hz - 12 : hz - 7, 1, sc);
  }
  if (lv >= 4) {
    // small prangs
    chedi(c, -hx + 5, hz - 5, 1, 0.6);
  }
  if (lv >= 5) {
    chedi(c, -hx + 5, -hz + 6, 1, 0.6);
    // monks' sala + bodhi tree
    v.box(-hx + 2, 1, -2, -hx + 10, 5, 6, "white");
    thaiRoof(v, -hx + 1, 5, -3, -hx + 11, 7, 1);
    tree(v, hx - 4, 1, -hz + 5, "oak", 1.6);
  }
  if (lv >= 2) {
    tree(v, -hx + 2, 1, hz - 2, "palm", 1.1);
    person(v, 3, 1, z1 + 3, "orange", "orange");
  }
  if (lv >= 3) for (const lx of [-4, 3]) lantern(v, lx, hz - 2, 2, "gold", "warmGlow");
}

/* =============================================================================================
 * LDS TEMPLE — white granite temple with golden-angel spire, reflecting pool and gardens.
 *  V0 Salt Lake neo-gothic (grey granite, crenellated towers → six spires)
 *  V1 Modern standard (white, single central spire, art-glass)
 *  V2 Washington-style (white marble, gold-tipped needle spires → six)
 *  V3 Pacific (white stepped terraces, palms, cascading pools)
 * ============================================================================================= */
function buildLdsTemple(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass");
  speckle(c, "grass2", 0.05);
  const wall = ["granite", "white", MARBLE_W, "white"][s];
  const W = byLv(c, [12, 14, 16, 20, 24]);
  const D = byLv(c, [12, 14, 18, 22, 28]);
  const H = byLv(c, [7, 8, 10, 12, 14]);
  const z0 = -hz + 3;
  const z1 = z0 + D;
  const x0 = -W / 2;
  const x1 = W / 2;
  const zc = (z0 + z1) / 2;
  // manicured grounds: walk, reflecting pool, flower beds, hedges
  v.box(-2, 0, z1, 2, 1, hz, "marble");
  if (lv >= 2 && hz - z1 > 6) {
    const pz0 = z1 + 2;
    const pz1 = hz - 2;
    v.box(-hx + 3, 0, pz0, -3, 1, pz1, "marble");
    waterPlane(v, -hx + 4, pz0 + 1, -4, pz1 - 1, 0, "sky");
    v.box(3, 0, pz0, hx - 3, 1, pz1, "marble");
    waterPlane(v, 4, pz0 + 1, hx - 4, pz1 - 1, 0, "sky");
  }
  for (const fx of [x0 - 3, x1 + 1]) flowerBed(c, fx, z0 + 2, fx + 2, z1 - 2, 1, ["pink", "white", "purple", "yellow"]);
  // the temple body
  if (s === 3) {
    // stepped terraces
    const steps = byLv(c, [2, 2, 3, 3, 4]);
    for (let k = 0; k < steps; k++) {
      const ins = k * 2;
      const hh = Math.round(H / steps) + 2;
      v.box(x0 + ins, 1 + k * hh, z0 + ins, x1 - ins, 1 + (k + 1) * hh, z1 - ins, "white");
      v.box(x0 + ins, k * hh + hh, z0 + ins, x1 - ins, 1 + k * hh + hh, z1 - ins, "marbleShade");
      for (let x = x0 + ins + 2; x < x1 - ins - 1; x += 3) v.box(x, 2 + k * hh, z1 - ins - 1, x + 1, k * hh + hh - 1, z1 - ins, "sky", 0.5);
      if (k > 0) for (let x = x0 + ins - 1; x < x1 - ins + 1; x += 2) v.put(x, 1 + k * hh, z1 - ins + 1, "leaf");
    }
  } else {
    v.hollowBox(x0, 1, z0, x1, 1 + H, z1, wall);
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.box(x, 3, z1 - 1, x + 1, H - 1, z1, s === 1 ? "sky" : "glass", 0.55);
    for (let z = z0 + 2; z < z1 - 2; z += 3) {
      v.box(x0, 3, z, x0 + 1, H - 1, z + 1, "glass", 0.5);
      v.box(x1 - 1, 3, z, x1, H - 1, z + 1, "glass", 0.5);
    }
    band(v, x0, H, z0, x1, z1, s === 0 ? "stone" : "marbleShade", 0);
    v.box(x0, 1 + H, z0, x1, 2 + H, z1, s === 0 ? "stone" : "marbleShade");
    if (s === 0) crenel(v, x0, 2 + H, z0, x1, z1, "granite");
    if (s === 2) {
      // tall vertical piers
      for (let x = x0; x < x1; x += 2) v.box(x, 1, z1, x + 1, 1 + H, z1 + 1, MARBLE_W);
    }
  }
  v.box(-2, 1, z1 - 1, 2, 5, z1 + 1, "gold", 0.3);
  v.box(-1, 1, z1, 1, 4, z1 + 1, "glass", 0.6);
  // spires
  const top = s === 3 ? 1 + H + byLv(c, [2, 2, 3, 3, 4]) * 2 : 2 + H;
  const mainH = byLv(c, [10, 13, 16, 20, 26]);
  const spirePts: [number, number, number][] = []; // x, z, height
  if (s === 0) {
    // towers at ends: lv1 one, lv3 two, lv5 six
    const n = byLv(c, [1, 1, 2, 2, 3]);
    const ends = lv >= 3 ? [z0 + 3, z1 - 3] : [z1 - 3];
    for (const ez of ends) {
      for (let i = 0; i < n; i++) {
        const tx = n === 1 ? 0 : n === 2 ? (i === 0 ? x0 + 2 : x1 - 2) : [x0 + 2, 0, x1 - 2][i];
        const isCenter = n === 1 || (n === 3 && i === 1);
        const isMain = isCenter && ez === ends[0];
        const th = isCenter ? mainH : Math.round(mainH * 0.65);
        spirePts.push([tx, ez, th + (isMain ? 2 : 0)]);
      }
    }
    for (const [tx, tz, th] of spirePts) {
      v.box(tx - 2, 1, tz - 2, tx + 2, top + th - 6, tz + 2, "granite");
      for (let y = 4; y < top + th - 8; y += 4) v.box(tx - 1, y, tz + 1, tx + 1, y + 2, tz + 2, "glass", 0.5);
      crenel(v, tx - 2, top + th - 6, tz - 2, tx + 2, tz + 2, "stone");
      v.cone(tx, top + th - 6, top + th, tz, 1.4, 0.4, "stone");
    }
    const [mx, mz, mh] = spirePts.reduce((a, b) => (b[2] > a[2] ? b : a));
    angel(v, mx, top + mh, mz);
  } else if (s === 1 || s === 3) {
    const sz = s === 1 ? (lv >= 3 ? z1 - 4 : zc) : zc;
    const base = s === 3 ? top : 2 + H;
    v.box(-3, base, sz - 3, 3, base + 4, sz + 3, "white");
    v.box(-2, base + 4, sz - 2, 2, base + 8, sz + 2, "white");
    for (const [ax, az] of [[-3, sz], [2, sz]]) v.box(ax, base + 1, az - 1, ax + 1, base + 3, az + 1, "sky", 0.6);
    v.box(-1, base + 5, sz + 1, 1, base + 7, sz + 2, "sky", 0.6);
    v.cone(0, base + 8, base + 8 + mainH, sz, 2, 0.3, "white");
    v.box(0, base + 8 + mainH, Math.floor(sz), 1, base + 9 + mainH, Math.floor(sz) + 1, "gold", 0.5);
    angel(v, 0, base + 9 + mainH, Math.floor(sz));
    if (lv >= 4 && s === 1) {
      // secondary spire at the back
      v.box(-2, 2 + H, z0 + 2, 2, 6 + H, z0 + 6, "white");
      v.cone(0, 6 + H, 6 + H + 8, z0 + 4, 1.6, 0.3, "white");
    }
  } else {
    // Washington: needle spires with gold tips
    const n = byLv(c, [1, 2, 2, 4, 6]);
    const pts: [number, number, boolean][] = [];
    if (n === 1) pts.push([0, z1 - 4, true]);
    else if (n === 2) pts.push([0, z1 - 4, true], [0, z0 + 4, false]);
    else if (n === 4) pts.push([x0 + 3, z1 - 4, true], [x1 - 3, z1 - 4, false], [x0 + 3, z0 + 4, false], [x1 - 3, z0 + 4, false]);
    else pts.push([0, z1 - 4, true], [x0 + 3, z1 - 4, false], [x1 - 3, z1 - 4, false], [0, z0 + 4, false], [x0 + 3, z0 + 4, false], [x1 - 3, z0 + 4, false]);
    for (const [tx, tz, main] of pts) {
      const th = main ? mainH : Math.round(mainH * (n >= 6 && tx === 0 ? 0.85 : 0.7));
      v.box(tx - 2, 2 + H, tz - 2, tx + 2, 2 + H + th * 0.4, tz + 2, MARBLE_W);
      for (let y = 3 + H; y < 2 + H + th * 0.4 - 1; y += 2) v.put(tx, y, tz + 1, "glass", 0.5);
      v.cone(tx, 2 + H + th * 0.4, 2 + H + th, tz, 1.6, 0.35, MARBLE_W);
      v.box(tx, 2 + H + th - 3, tz, tx + 1, 2 + H + th + 1, tz + 1, "gold", 0.5);
      if (main) angel(v, tx, 3 + H + th, tz);
    }
  }
  // grounds by level
  const tk = s === 3 ? "palm" : s === 0 ? "pine" : "round";
  tree(v, -hx + 2, 1, hz - 3, tk, 1.1);
  tree(v, hx - 3, 1, hz - 3, tk, 1.1);
  if (lv >= 3) {
    tree(v, -hx + 2, 1, -hz + 3, tk, 1.3);
    tree(v, hx - 3, 1, -hz + 3, tk, 1.3);
    hedge(v, -hx + 1, -hz + 1, hx - 1, -hz + 2, 1, 2);
    for (const lx of [-hx + 1, hx - 2]) lamp(v, lx, 1, hz - 1, 4);
  }
  if (lv >= 4) {
    fence(v, -hx, -hz, hx, hz, 1, 3, "black", [-3, 3]);
    for (let z = z0; z < z1; z += 6) {
      tree(v, -hx + 3, 1, z, "cypress", 1);
      tree(v, hx - 4, 1, z, "cypress", 1);
    }
  }
  if (lv >= 5) {
    fountain(v, -hx + 7, 1, hz - 6, 3, "marble");
    fountain(v, hx - 7, 1, hz - 6, 3, "marble");
    person(v, 3, 1, hz - 4, "white", "white");
    person(v, -4, 1, hz - 5, "white", "charcoal");
  }
}

/* ============================================================================================= */

defineDesigns({
  churches: {
    footprints: [[1, 1], [1, 2], [2, 2], [2, 3], [3, 4]],
    levels: ["Bell-Cote Chapel", "Village Parish Church", "Steepled Church & Churchyard", "Transept Basilica", "Grand Cathedral"],
    growth: "Gains a tower, then a churchyard and apse, then transepts, finally a twin-towered cathedral with a rose window.",
    build: buildChurch,
  },
  christian_churches: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Humble Chapel", "Mission Church", "Community Church", "Great Church", "Cathedral of Glory"],
    growth: "Each tradition swells: more onion domes, more bells, bigger halls, tiered roofs — up to a landmark cathedral.",
    build: buildChristianChurch,
  },
  graveyards: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Lonely Burial Plot", "Churchyard Cemetery", "Memorial Cemetery", "Mausoleum Necropolis", "Eternal Garden Necropolis"],
    growth: "Rows of headstones spread out; mausoleums, a chapel, lanterns and a grand central monument appear.",
    build: buildGraveyard,
  },
  monasteries: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 3], [4, 4]],
    levels: ["Hermit's Cell", "Humble Priory", "Cloistered Abbey", "Walled Abbey", "Hilltop Monastery Citadel"],
    growth: "A hermit's hut gains a chapel and gardens, then a cloister and bell tower, walls and gatehouse, then rises onto a hill.",
    build: buildMonastery,
  },
  mosques: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Neighborhood Masjid", "Domed Mosque", "Courtyard Mosque", "Grand Mosque", "Great Four-Minaret Mosque"],
    growth: "The dome swells and multiplies, a courtyard with ablution fountain appears, and minarets rise from one to four.",
    build: buildMosque,
  },
  synagogues: {
    footprints: [[1, 1], [2, 1], [2, 2], [2, 2], [3, 3]],
    levels: ["Shtiebel Prayer House", "Community Shul", "Great Synagogue", "Twin-Tower Synagogue", "Grand Temple Synagogue"],
    growth: "Star of David façade grows a portico, towers and a dome, with a glowing menorah in the garden.",
    build: buildSynagogue,
  },
  temples: {
    footprints: [[1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
    levels: ["Roadside Shrine", "Temple Hall", "Pagoda Temple", "Temple Compound", "Sacred Temple City"],
    growth: "A small shrine gains halls, then a tower (pagoda / shikhara / chedi), a great gate, and finally a sacred pond complex.",
    build: buildTemple,
  },
  lds_temples: {
    footprints: [[2, 2], [2, 2], [2, 3], [3, 3], [3, 4]],
    levels: ["Small Temple", "Regional Temple", "District Temple", "Grand Temple", "Flagship Temple"],
    growth: "White temple grows longer and taller, spires multiply under the golden angel, with reflecting pools and gardens.",
    build: buildLdsTemple,
  },
});
