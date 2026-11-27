/**
 * ORIGINAL PUBLIC LIBRARY: the books are the architecture.
 *
 * Massing class (docs/redesign/CIVIC-FIVE-SPEC.md): low and open. Reading rooms built from giant books wrap or
 * overlook outdoor reading space, and the library never outgrows the courthouse or the city-offices tower. The
 * kit of parts shared by every variant: cloth covers with gilt-banded spines and red/white headbands, pale
 * page-edge strata, warm lit reading niches lined with shelves, bookmark ribbons used as stairs and bridges,
 * readers on benches and steps, and a front door (+z) that is a dark leaf in a pale frame with a fanlight,
 * lamps and a path, so it reads even in grayscale. Library spines carry white call-number stickers: this
 * building lends books, the Indie Bookstore sells them.
 *
 *  A · Stacked Hardbacks: hardbacks lying flat, piled like a desk stack. Flat tops show the cover cloth with
 *      gilt frames, terraces and gardens, never a bare roof plane.
 *      L1 one thick book whose fore-edge opens into a tiny reading room · L2 a second, offset book on pencil
 *      columns makes a deep porch over the return slot · L3 three staggered books make an L round a reading
 *      garden · L4 two stacks straddle a daylight slot crossed by a bookmark footbridge · L5 a terraced pile
 *      climbs to a roof garden and a ribbon stair cascades down the terraces to curl out onto the street.
 *  B · Open Folio: open books used as butterfly roofs. Printed pages on top, cloth soffits below, the
 *      bookmark in the gutter.
 *      L1 two splayed pages shelter a reading bench in the binding · L2 a long thick leaf roofs the stacks, a
 *      short leaf a street terrace · L3 a broad V over sunken reading steps, with a ribbon stair from the gutter
 *      to the street · L4 the book turns sideways and its fanned back leaves lift over a reading amphitheater ·
 *      L5 a giant atlas: fanned halves printed with raised map relief either side of a glass spine atrium.
 *  C · Bookend Alley: upright volumes standing on a shelf plank, spines to the street, held by brass bookends.
 *      L1 two volumes frame a walk-in slot · L2 three uneven spines line a covered passage with a shop-window
 *      view into the stacks · L3 two tall bookends face each other across an open reading alley · L4 a
 *      reading-bridge book links a row of short spines to a tall archive volume · L5 a skyline of volumes rings
 *      a reading square, entered through the tall gap of a missing volume that lies on the plaza as a bench.
 *  D · Pop-up Storybook: a storybook lies open on the lawn and die-cut paper folds up out of its gutter.
 *      L1 a folded paper tree rises from a lending kiosk · L2 a second fold opens a storybook lane of paper
 *      cottages under the tree · L3 a paper village folds up around a walk-in courtyard · L4 a die-cut
 *      proscenium frames a storytelling stage between tent-folded reading wings · L5 the book unfolds into a
 *      great paper tree whose branches carry occupied reading balconies.
 */
import { type Ctx, PALETTE, PixelVox, bench, bush, flowerBed, lamp, lot, person, speckle, tree } from "./kit";
import { packVoxKey } from "../voxelCore";

type V = PixelVox;
type Side = "n" | "s" | "e" | "w";

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------

const PAGE_HI = "#fbf6e8";
const PAGE_LO = "#e0d1b1";
const PAPER = "#fffcf3";
const INK = "#cbbfa6";
const GILT = "gold";
const DOOR = "#4a2b19";
const FRAME = "#f3e6c4";
const RIBBON = "#c8283a";
const RIBBON_D = "#93202e";
const HEADBAND = ["#d23c3c", "#f6efe0"] as const;
const SPINE_COLS = ["crimson", "#27406b", "#2f6b4f", "#d39a2f", "#6d3b6b", "teal", "orange", "#8e2a2a", "#3f6b3a", "#4f86c6"];
const SHIRTS = ["red", "sky", "yellow", "teal", "pink", "orange", "purple", "lime", "white", "blue"];
const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];

const pageCol = (k: number): string => (((k % 2) + 2) % 2 === 1 ? PAGE_HI : PAGE_LO);

function hexOf(col: string): number {
  const hex = PALETTE[col] ?? col;
  return hex.startsWith("#") && hex.length === 7 ? parseInt(hex.slice(1), 16) : 0xeae4d7;
}

/** Blend two colours (t = 0 gives a, 1 gives b). */
function mix(a: string, b: string, t: number): string {
  const p = hexOf(a);
  const q = hexOf(b);
  const ch = (s: number) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function shade(col: string, k: number): string {
  const hex = PALETTE[col] ?? col;
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

const has = (v: V, x: number, y: number, z: number): boolean => v.v.has(packVoxKey(x, y, z));

/** First free layer above the highest voxel at (x, z) at or below `from - 1` (1 = standing on the lot). */
function surfaceAt(v: V, x: number, z: number, from: number): number {
  for (let y = from; y >= 1; y--) if (has(v, x, y - 1, z)) return y;
  return 1;
}

// ---------------------------------------------------------------------------------------------
// Facade-relative boxes: `a` runs along the face, `d` is depth into the building (0 = the facade layer)
// ---------------------------------------------------------------------------------------------

function faceBox(v: V, face: Side, plane: number, a0: number, a1: number, y0: number, y1: number, d0: number, d1: number, col: string | null, emit = 0): void {
  if (face === "s") v.box(a0, y0, plane - d1 + 1, a1, y1, plane - d0 + 1, col, emit);
  else if (face === "n") v.box(a0, y0, plane + d0, a1, y1, plane + d1, col, emit);
  else if (face === "e") v.box(plane - d1 + 1, y0, a0, plane - d0 + 1, y1, a1, col, emit);
  else v.box(plane + d0, y0, a0, plane + d1, y1, a1, col, emit);
}

function facePut(v: V, face: Side, plane: number, a: number, y: number, d: number, col: string | null, emit = 0): void {
  faceBox(v, face, plane, a, a + 1, y, y + 1, d, d + 1, col, emit);
}

/** A wall of little coloured spines on shelf boards; the top row glows like a reading lamp. */
function shelves(c: Ctx, face: Side, plane: number, a0: number, a1: number, y0: number, y1: number, d: number, glowTop = true): void {
  for (let y = y0; y < y1; y++) {
    for (let a = a0; a < a1; a++) {
      const top = glowTop && y === y1 - 1 && y1 - y0 > 1;
      const board = !top && (y - y0) % 3 === 2;
      const col = top ? "warmGlow" : board ? "woodDark" : c.rand() < 0.1 ? "woodDark" : c.pick(SPINE_COLS);
      facePut(c.v, face, plane, a, y, d, col, top ? 1.1 : board ? 0 : 0.15);
    }
  }
}

/** A warm reading niche cut into a facade: wood-lined, shelves on the back wall, optional reader. */
function niche(c: Ctx, face: Side, plane: number, a0: number, a1: number, y0: number, y1: number, o: { depth?: number; reader?: boolean; frame?: string } = {}): void {
  const v = c.v;
  const dp = o.depth ?? 2;
  faceBox(v, face, plane, a0 - 1, a1 + 1, y0 - 1, y1 + 1, 1, dp + 1, "woodDark");
  faceBox(v, face, plane, a0, a1, y0, y1, 0, dp, null);
  shelves(c, face, plane, a0, a1, y0, y1, dp);
  if (o.frame) {
    faceBox(v, face, plane, a0 - 1, a1 + 1, y0 - 1, y0, 0, 1, o.frame);
    faceBox(v, face, plane, a0 - 1, a1 + 1, y1, y1 + 1, 0, 1, o.frame);
  }
  if (o.reader && dp >= 2 && y1 - y0 >= 3) {
    const a = a0 + ((a1 - a0) >> 1);
    facePut(v, face, plane, a, y0, dp - 1, "blueDark");
    facePut(v, face, plane, a, y0 + 1, dp - 1, c.pick(SHIRTS));
    facePut(v, face, plane, a, y0 + 2, dp - 1, c.pick(SKIN));
  }
}

/** The library door: dark leaves recessed one voxel inside a pale protruding frame, glowing fanlight, lamps. */
function libDoor(c: Ctx, face: Side, plane: number, a0: number, w: number, y0: number, h: number, o: { frame?: string; lamps?: boolean; steps?: string } = {}): void {
  const v = c.v;
  const frame = o.frame ?? FRAME;
  faceBox(v, face, plane, a0 - 1, a0 + w + 1, y0, y0 + h + 2, -1, 1, frame);
  faceBox(v, face, plane, a0, a0 + w, y0, y0 + h + 1, -1, 1, null);
  faceBox(v, face, plane, a0, a0 + w, y0, y0 + h, 1, 2, DOOR);
  faceBox(v, face, plane, a0, a0 + w, y0 + h, y0 + h + 1, 1, 2, "warmGlow", 0.9);
  if (w >= 2) facePut(v, face, plane, a0 + (w >> 1), y0 + (h >> 1), 1, "brass");
  if (o.lamps !== false) {
    facePut(v, face, plane, a0 - 2, y0 + h, -1, "warmGlow", 1.1);
    facePut(v, face, plane, a0 + w + 1, y0 + h, -1, "warmGlow", 1.1);
  }
  if (o.steps) for (let k = 0; y0 - k > 1; k++) faceBox(v, face, plane, a0 - 1, a0 + w + 1, 1, y0 - k, -2 - k, -1 - k, o.steps);
}

/** A seated or standing reader holding an open book toward `face`. */
function reader(c: Ctx, x: number, y: number, z: number, face: Side = "s", shirt?: string): void {
  const v = c.v;
  person(v, x, y, z, shirt ?? c.pick(SHIRTS), c.pick(["blueDark", "charcoal", "woodDark", "indigo"]), c.pick(SKIN));
  const [dx, dz] = face === "s" ? [0, 1] : face === "n" ? [0, -1] : face === "e" ? [1, 0] : [-1, 0];
  v.put(x + dx, y + 1, z + dz, c.pick(["white", "crimson", "sky", "yellow"]));
}

/** A row of seated readers along a bench top, each with a book. */
function readersOn(c: Ctx, x0: number, x1: number, y: number, z: number, face: Side, gap = 2): void {
  for (let x = x0; x < x1; x += gap) if (c.rand() < 0.8) reader(c, x, y, z, face);
}

/** A hexagonal pencil standing on its eraser, sharpened tip up into whatever it carries. */
function pencil(v: V, x: number, z: number, y0: number, y1: number, body = "#f2c230"): void {
  v.box(x, y0, z, x + 2, y0 + 1, z + 2, "#f08aa0");
  v.box(x, y0 + 1, z, x + 2, y0 + 2, z + 2, "silver");
  v.box(x, y0 + 2, z, x + 2, y1 - 2, z + 2, body);
  v.box(x + 1, y0 + 2, z + 1, x + 2, y1 - 2, z + 2, shade(body, 0.8));
  v.box(x, y1 - 2, z, x + 2, y1 - 1, z + 2, "woodLight");
  v.put(x, y1 - 1, z + 1, "charcoal");
}

/** A small pile of ordinary-sized books used as street furniture (bench, step, planter base). */
function miniStack(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number): number {
  const v = c.v;
  let y = 1;
  for (let i = 0; i < n; i++) {
    const cov = c.pick(SPINE_COLS);
    const sx = i % 2 ? 1 : 0;
    v.box(x0 + sx, y, z0, x1 + sx - 1, y + 1, z1, cov);
    if (x1 - x0 > 2) v.box(x0 + sx + 1, y, z1 - 1, x1 + sx - 2, y + 1, z1, PAGE_HI);
    y++;
  }
  return y;
}

function grassLot(c: Ctx, col = "grass", fleck = "grass2"): void {
  lot(c, col);
  speckle(c, fleck, 0.12);
}

function walk(v: V, x0: number, z0: number, x1: number, z1: number, col = "path"): void {
  v.box(x0, 0, z0, x1, 1, z1, col);
}

// ---------------------------------------------------------------------------------------------
// Book primitives
// ---------------------------------------------------------------------------------------------

interface FlatOpts {
  /** gilt frame on the top board (false = none) */
  frame?: string | false;
  gilt?: boolean;
  label?: string;
  hollow?: boolean;
}

/**
 * A hardback lying flat. Outer box [x0,x1)×[y0,y0+t)×[z0,z1); its rounded spine is on side `spine`; the page
 * block is inset one voxel on the three open sides and shows striped page edges. Returns the top (free) y.
 */
function flatBook(v: V, x0: number, y0: number, z0: number, x1: number, z1: number, t: number, cover: string, spine: Side, o: FlatOpts = {}): number {
  const y1 = y0 + t;
  const dark = shade(cover, 0.68);
  for (let y = y0 + 1; y < y1 - 1; y++) v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, o.gilt ? (y & 1 ? GILT : "goldDark") : pageCol(y));
  if (o.hollow !== false && x1 - x0 > 6 && z1 - z0 > 6 && t > 3) v.clear(x0 + 2, y0 + 1, z0 + 2, x1 - 2, y1 - 1, z1 - 2);
  // lamplight leaking between the pages: a warm row along the open faces (pale by day, glowing at night)
  if (t >= 5 && !o.gilt) {
    const yg = y0 + ((t - 1) >> 1);
    const lit = (a: number) => ((a % 7) + 7) % 7 >= 2;
    for (let x = x0 + 2; x < x1 - 2; x++) {
      if (!lit(x)) continue;
      if (spine !== "s") v.put(x, yg, z1 - 2, "warmGlow", 0.9);
      if (spine !== "n") v.put(x, yg, z0 + 1, "warmGlow", 0.9);
    }
    for (let z = z0 + 2; z < z1 - 2; z++) {
      if (!lit(z)) continue;
      if (spine !== "e") v.put(x1 - 2, yg, z, "warmGlow", 0.9);
      if (spine !== "w") v.put(x0 + 1, yg, z, "warmGlow", 0.9);
    }
  }
  const bx0 = spine === "w" ? x0 + 1 : x0;
  const bx1 = spine === "e" ? x1 - 1 : x1;
  const bz0 = spine === "n" ? z0 + 1 : z0;
  const bz1 = spine === "s" ? z1 - 1 : z1;
  v.box(bx0, y0, bz0, bx1, y0 + 1, bz1, cover);
  v.box(bx0, y1 - 1, bz0, bx1, y1, bz1, cover);
  // spine: rounded (proud of the boards), gilt bands, title label
  const alongX = spine === "n" || spine === "s";
  const A0 = alongX ? x0 : z0;
  const A1 = alongX ? x1 : z1;
  const sp = (a: number, y: number, col: string) => {
    if (spine === "w") v.put(x0, y, a, col);
    else if (spine === "e") v.put(x1 - 1, y, a, col);
    else if (spine === "n") v.put(a, y, z0, col);
    else v.put(a, y, z1 - 1, col);
  };
  for (let a = A0; a < A1; a++) for (let y = y0 + 1; y < y1 - 1; y++) sp(a, y, cover);
  const L = A1 - A0;
  const bands = L >= 16 ? [1, 3, L - 4, L - 2] : [1, L - 2];
  for (const b of bands) for (let y = y0 + 1; y < y1 - 1; y++) sp(A0 + b, y, GILT);
  const in0 = A0 + (L >= 16 ? 6 : 3);
  const in1 = A1 - (L >= 16 ? 6 : 3);
  if (t >= 5 && in1 - in0 >= 2) {
    const ym = y0 + (t >> 1);
    const rows = t >= 8 ? [ym - 1, ym] : [ym];
    for (const y of rows) for (let a = in0; a < in1; a++) sp(a, y, o.label ?? "#f1e4c2");
    for (let a = in0 + 1; a < in1 - 1; a += 2) sp(a, rows[rows.length - 1], dark);
  }
  // headbands where the page block meets the spine
  for (let y = y0 + 1; y < y1 - 1; y++) {
    const hb = HEADBAND[(y - y0) & 1];
    if (spine === "w") { v.put(x0 + 1, y, z0 + 1, hb); v.put(x0 + 1, y, z1 - 2, hb); }
    else if (spine === "e") { v.put(x1 - 2, y, z0 + 1, hb); v.put(x1 - 2, y, z1 - 2, hb); }
    else if (spine === "n") { v.put(x0 + 1, y, z0 + 1, hb); v.put(x1 - 2, y, z0 + 1, hb); }
    else { v.put(x0 + 1, y, z1 - 2, hb); v.put(x1 - 2, y, z1 - 2, hb); }
  }
  // top board: hinge groove beside the spine, gilt frame, leather corners
  const yt = y1 - 1;
  if (spine === "w") v.box(x0 + 3, yt, bz0, x0 + 4, yt + 1, bz1, dark);
  else if (spine === "e") v.box(x1 - 4, yt, bz0, x1 - 3, yt + 1, bz1, dark);
  else if (spine === "n") v.box(bx0, yt, z0 + 3, bx1, yt + 1, z0 + 4, dark);
  else v.box(bx0, yt, z1 - 4, bx1, yt + 1, z1 - 3, dark);
  const fx0 = spine === "w" ? x0 + 5 : x0 + 2;
  const fx1 = spine === "e" ? x1 - 5 : x1 - 2;
  const fz0 = spine === "n" ? z0 + 5 : z0 + 2;
  const fz1 = spine === "s" ? z1 - 5 : z1 - 2;
  if (o.frame !== false && fx1 - fx0 >= 4 && fz1 - fz0 >= 4) {
    const fc = o.frame ?? GILT;
    v.box(fx0, yt, fz0, fx1, yt + 1, fz0 + 1, fc);
    v.box(fx0, yt, fz1 - 1, fx1, yt + 1, fz1, fc);
    v.box(fx0, yt, fz0, fx0 + 1, yt + 1, fz1, fc);
    v.box(fx1 - 1, yt, fz0, fx1, yt + 1, fz1, fc);
  }
  const corners: [number, number, number, number][] =
    spine === "w" ? [[x1 - 1, z0, -1, 1], [x1 - 1, z1 - 1, -1, -1]]
      : spine === "e" ? [[x0, z0, 1, 1], [x0, z1 - 1, 1, -1]]
        : spine === "n" ? [[x0, z1 - 1, 1, -1], [x1 - 1, z1 - 1, -1, -1]]
          : [[x0, z0, 1, 1], [x1 - 1, z0, -1, 1]];
  for (const [cx, cz, sx, sz] of corners) {
    v.put(cx, yt, cz, dark);
    v.put(cx + sx, yt, cz, dark);
    v.put(cx, yt, cz + sz, dark);
  }
  return y1;
}

interface UprightOpts {
  /** lit title-label windows instead of a printed label */
  windows?: number;
  door?: boolean;
  sticker?: boolean;
  label?: string;
}

/**
 * A volume standing upright on a shelf. Box [x0,x1)×[y0,y0+h)×[z0,z1); its spine faces `spine`. Covers are the
 * two broad faces, the page head (top) and fore-edge show page strata.
 */
function uprightBook(c: Ctx, x0: number, y0: number, z0: number, x1: number, z1: number, h: number, cover: string, spine: Side, o: UprightOpts = {}): void {
  const v = c.v;
  const thinX = spine === "n" || spine === "s";
  const T = thinX ? x1 - x0 : z1 - z0;
  const D = thinX ? z1 - z0 : x1 - x0;
  const at = (u: number, w: number): [number, number] =>
    spine === "s" ? [x0 + u, z1 - 1 - w] : spine === "n" ? [x0 + u, z0 + w] : spine === "e" ? [x1 - 1 - w, z0 + u] : [x0 + w, z0 + u];
  const lbox = (u0: number, u1: number, ya: number, yb: number, w0: number, w1: number, col: string | null, emit = 0) => {
    if (u1 <= u0 || w1 <= w0 || yb <= ya) return;
    const [ax, az] = at(u0, w0);
    const [bx, bz] = at(u1 - 1, w1 - 1);
    v.box(Math.min(ax, bx), ya, Math.min(az, bz), Math.max(ax, bx) + 1, yb, Math.max(az, bz) + 1, col, emit);
  };
  const y1 = y0 + h;
  const dark = shade(cover, 0.68);
  for (let u = 1; u < T - 1; u++) lbox(u, u + 1, y0, y1 - 1, 1, D - 1, pageCol(u));
  if (T > 4 && D > 4 && h > 4) lbox(2, T - 2, y0, y1 - 2, 2, D - 2, null);
  lbox(0, 1, y0, y1, 0, D, cover);
  lbox(T - 1, T, y0, y1, 0, D, cover);
  lbox(1, T - 1, y0, y1, 0, 1, cover);
  for (let u = 1; u < T - 1; u++) lbox(u, u + 1, y1 - 2, y1 - 1, 1, 2, HEADBAND[u & 1]);
  // blind-stamped panel with a gilt ornament on both broad covers
  if (D >= 8 && h >= 8) {
    const pc = shade(cover, 0.78);
    const my = y0 + (h >> 1);
    const mw = D >> 1;
    for (const u of [0, T - 1]) {
      lbox(u, u + 1, y0 + 2, y0 + 3, 2, D - 2, pc);
      lbox(u, u + 1, y1 - 3, y1 - 2, 2, D - 2, pc);
      lbox(u, u + 1, y0 + 2, y1 - 2, 2, 3, pc);
      lbox(u, u + 1, y0 + 2, y1 - 2, D - 3, D - 2, pc);
      lbox(u, u + 1, my - 1, my + 1, mw - 1, mw + 1, GILT);
    }
  }
  // spine: gilt bands at the foot and a double band under the head
  const bands = h >= 10 ? [y0 + 1, y1 - 3, y1 - 5] : [y0 + 1, y1 - 3];
  for (const yb of bands) lbox(1, T - 1, yb, yb + 1, 0, 1, GILT);
  const lab0 = y0 + Math.max(4, Math.floor(h * 0.45));
  const lab1 = Math.min(y1 - 6, lab0 + (h >= 14 ? 3 : 2));
  if (o.windows) {
    // stacked lit title labels: reading floors behind the spine
    for (let k = 0; k < o.windows; k++) {
      const wy = lab0 - 1 + k * 4 - (o.windows > 1 ? 4 : 0);
      if (wy < y0 + 3 || wy + 2 > y1 - 5) continue;
      lbox(1, T - 1, wy, wy + 2, 0, 1, "warmGlow", 0.75);
      if (T >= 6) lbox(T >> 1, (T >> 1) + 1, wy, wy + 2, 0, 1, dark);
      lbox(1, T - 1, wy - 1, wy, 0, 1, dark);
    }
  } else if (lab1 > lab0) {
    lbox(1, T - 1, lab0, lab1, 0, 1, o.label ?? "#f1e4c2");
    for (let y = lab0; y < lab1; y++) if ((y - lab0) % 2 === 0 && T >= 5) lbox(2, T - 2, y, y + 1, 0, 1, dark);
  }
  if (o.sticker !== false && T >= 3) {
    const u = T >> 1;
    lbox(u, u + 1, y0 + 2, y0 + 4, 0, 1, "white");
    if (T >= 5) lbox(u - 1, u, y0 + 3, y0 + 4, 0, 1, "white");
  }
  if (o.door && T >= 4) {
    const u = (T >> 1) - 1;
    lbox(u - 1, u + 3, y0, y0 + 5, 0, 1, FRAME);
    lbox(u, u + 2, y0, y0 + 4, 0, 1, null);
    lbox(u, u + 2, y0, y0 + 3, 1, 2, DOOR);
    lbox(u, u + 2, y0 + 3, y0 + 4, 1, 2, "warmGlow", 0.9);
  }
}

interface OpenBookSpec {
  /** gutter direction */
  axis: "x" | "z";
  /** across coordinate where the high-side wing starts; the gutter is the two columns g-1 and g */
  g: number;
  aMin: number;
  aMax: number;
  /** extent of the boards along the gutter */
  l0: number;
  l1: number;
  /** page-surface height at the gutter */
  yG: number;
  rise: [number, number];
  thick?: [number, number];
  cover: string;
  /** extra fanned leaves peeling off each wing */
  leaves?: [number, number];
  /** page print: return a colour for the surface voxel (or null for plain paper) */
  print?: (a: number, l: number, d: number, side: 0 | 1, W: number) => string | null;
  ribbon?: boolean;
  /** columns (across) to leave open, e.g. for a glass spine */
  skip?: (a: number) => boolean;
}

/**
 * An open book used as a butterfly roof: two wings rise from the gutter and flatten toward the fore-edges.
 * Returns the y of the underside (lowest cover voxel) for any across coordinate, so walls can rise to meet it.
 */
function openBook(c: Ctx, s: OpenBookSpec): (a: number) => number {
  const v = c.v;
  const P = (a: number, y: number, l: number, col: string, emit = 0) => (s.axis === "z" ? v.put(a, y, l, col, emit) : v.put(l, y, a, col, emit));
  const thick = s.thick ?? [2, 2];
  const under = new Map<number, number>();
  const topOf = (a: number): number => {
    const side: 0 | 1 = a < s.g ? 0 : 1;
    const W = side ? s.aMax - s.g : s.g - s.aMin;
    const d = side ? a - s.g : s.g - 1 - a;
    const t = W > 1 ? d / (W - 1) : 0;
    return s.yG + Math.round(s.rise[side] * (1 - (1 - t) * (1 - t)));
  };
  const lineEnd = (l: number) => 3 + ((l * 7 + 3) % 4);
  for (let a = s.aMin; a < s.aMax; a++) {
    if (s.skip?.(a)) continue;
    const side: 0 | 1 = a < s.g ? 0 : 1;
    const W = side ? s.aMax - s.g : s.g - s.aMin;
    const d = side ? a - s.g : s.g - 1 - a;
    const top = topOf(a);
    const thk = thick[side];
    const coverY = top - thk;
    const inner = side ? a - 1 : a + 1;
    const innerCover = inner >= s.aMin && inner < s.aMax && d > 0 ? topOf(inner) - thick[side] : coverY;
    const fore = a === s.aMin || a === s.aMax - 1;
    let low = coverY;
    // where this column steps up from its inner neighbour the riser is paper, so the curve reads as one sheet
    const innerTop = inner >= s.aMin && inner < s.aMax && d > 0 ? topOf(inner) : top;
    const flat = innerTop === top;
    for (let l = s.l0; l < s.l1; l++) {
      for (let y = Math.min(coverY, innerCover + 1); y <= coverY; y++) P(a, y, l, s.cover);
      if (d === 0) P(a, coverY - 1, l, s.cover);
      if (fore || l === s.l0 || l === s.l1 - 1) continue;
      const face = l === s.l0 + 1 || l === s.l1 - 2;
      for (let y = coverY + 1; y < top; y++) P(a, y, l, face || a === s.aMin + 1 || a === s.aMax - 2 ? pageCol(y) : y >= innerTop ? PAPER : PAGE_LO);
      const lineL = l - s.l0;
      let col: string | null = s.print ? s.print(a, l, d, side, W) : null;
      if (col === null && !s.print) {
        const text = flat && lineL % 2 === 0 && lineL > 2 && s.l1 - l > 3 && d >= 2 && d <= W - lineEnd(l) && (lineL % 14) !== 8 && (d * 3 + lineL * 5) % 7 !== 0;
        col = text ? INK : PAPER;
      }
      P(a, top, l, col ?? PAPER);
      if (l === s.l0 + 1 || l === s.l1 - 2) if (d === 0) P(a, top - 1, l, HEADBAND[a & 1]);
    }
    if (d === 0) low = coverY - 1;
    under.set(a, low);
  }
  // fanned leaves peel up out of the gutter, shorter and steeper each time, leaving clerestory gaps
  for (const side of [0, 1] as const) {
    const n = s.leaves?.[side] ?? 0;
    const W = side ? s.aMax - s.g : s.g - s.aMin;
    for (let k = 1; k <= n; k++) {
      const Wk = W - 3 * k;
      const rk = s.rise[side] + 2 * k + 1;
      const lt = (d: number) => s.yG + 1 + Math.round(rk * (1 - (1 - d / (Wk - 1)) ** 2));
      for (let d = 1; d < Wk; d++) {
        const a = side ? s.g + d : s.g - 1 - d;
        const y = lt(d);
        const yPrev = lt(d - 1);
        for (let l = s.l0 + 1 + k; l < s.l1 - 1 - k; l++) {
          for (let yy = Math.min(y, yPrev + 1); yy <= y; yy++) P(a, yy, l, yy === y ? PAPER : PAGE_LO);
          if (d === Wk - 1) P(a, y, l, PAGE_HI);
        }
      }
    }
  }
  if (s.ribbon) {
    for (let l = s.l0 + 1; l < s.l1 - 1; l++) {
      P(s.g - 1, topOf(s.g - 1), l, RIBBON);
      P(s.g, topOf(s.g), l, RIBBON);
    }
    for (let y = s.yG - 3; y <= s.yG; y++) P(s.g - 1, y, s.l1, y === s.yG - 3 ? RIBBON_D : RIBBON);
    P(s.g, s.yG, s.l1, RIBBON);
  }
  return (a: number) => under.get(a) ?? s.yG - thick[0];
}

/**
 * An open book laid face-down as a tent (ridge along z): cloth covers outside with gilt frames, the rounded
 * spine as a banded ridge, the page block underneath with strata at both ends. Returns the clear height under
 * each across column.
 */
function tentBook(c: Ctx, g: number, aMin: number, aMax: number, l0: number, l1: number, yR: number, rise: number, thk: number, cover: string): (a: number) => number {
  const v = c.v;
  const under = new Map<number, number>();
  const info = (a: number) => {
    const side = a < g ? 0 : 1;
    const W = side ? aMax - g : g - aMin;
    const d = side ? a - g : g - 1 - a;
    return { W, d, top: yR - Math.round(rise * (W > 1 ? d / (W - 1) : 0) ** 1.15) };
  };
  const dark = shade(cover, 0.7);
  for (let a = aMin; a < aMax; a++) {
    const { W, d, top } = info(a);
    const outer = a < g ? a - 1 : a + 1;
    const outerTop = outer >= aMin && outer < aMax ? info(outer).top : 1;
    const yc0 = Math.max(1, Math.min(top, outerTop + 1));
    for (let l = l0; l < l1; l++) {
      v.box(a, yc0, l, a + 1, top + 1, l + 1, cover);
      const frame = d >= 3 && d <= W - 4 && l >= l0 + 2 && l <= l1 - 3 && (l === l0 + 2 || l === l1 - 3 || d === 3 || d === W - 4);
      if (frame) v.put(a, top, l, GILT);
      if (l === l0 || l === l1 - 1) continue;
      const face = l === l0 + 1 || l === l1 - 2;
      for (let k = 1; k <= thk; k++) {
        const y = yc0 - k;
        if (y < 1) break;
        v.put(a, y, l, face ? pageCol(y) : k === thk ? PAPER : PAGE_LO);
      }
    }
    if (d === 0) {
      for (let l = l0; l < l1; l++) {
        const L = l - l0;
        const band = L === 1 || L === 3 || L === l1 - l0 - 2 || L === l1 - l0 - 4;
        const label = L >= 6 && L < l1 - l0 - 6;
        v.put(a, top + 1, l, band ? GILT : label ? (L % 2 ? "#f1e4c2" : dark) : cover);
      }
      v.put(a, top, l0 + 1, HEADBAND[a & 1]);
      v.put(a, top, l1 - 2, HEADBAND[a & 1]);
    }
    under.set(a, yc0 - thk - 1);
  }
  return (a: number) => under.get(a) ?? 1;
}

/**
 * A bookmark ribbon draped down terraces as a stair, walking toward +z from z0 to z1 starting at yStart. Each
 * tread sits on whatever is below (flat across a terrace, one step down per voxel where the surface drops).
 * Returns the tread y at the end.
 */
function ribbonStair(v: V, x0: number, x1: number, z0: number, z1: number, yStart: number): number {
  let y = yStart;
  for (let z = z0; z < z1; z++) {
    let floor = 1;
    for (let x = x0; x < x1; x++) floor = Math.max(floor, surfaceAt(v, x, z, y + 1));
    y = Math.max(floor, y - 1);
    if (y > floor) v.box(x0, floor, z, x1, y, z + 1, RIBBON_D);
    v.box(x0, y, z, x1, y + 1, z + 1, RIBBON);
    v.put(x0, y, z, GILT);
    v.put(x1 - 1, y, z, GILT);
  }
  return y;
}

// ---------------------------------------------------------------------------------------------
// Paper (pop-up) primitives
// ---------------------------------------------------------------------------------------------

interface Cell { col: string; emit: number; keep: boolean }
class Cut {
  cells = new Map<string, Cell>();
  set(a: number, y: number, col: string, emit = 0, keep = false): void {
    this.cells.set(`${a},${y}`, { col, emit, keep });
  }
  rect(a0: number, a1: number, y0: number, y1: number, col: string, emit = 0, keep = false): void {
    for (let a = a0; a < a1; a++) for (let y = y0; y < y1; y++) this.set(a, y, col, emit, keep);
  }
  disc(ca: number, cy: number, r: number, col: string, sy = 1, keep = false): void {
    for (let a = Math.floor(ca - r); a <= Math.ceil(ca + r); a++) {
      for (let y = Math.floor(cy - r * sy); y <= Math.ceil(cy + r * sy); y++) {
        if ((a + 0.5 - ca) ** 2 + ((y + 0.5 - cy) / sy) ** 2 <= r * r) this.set(a, y, col, 0, keep);
      }
    }
  }
  /** a gable / triangle rising from row y0 over [a0,a1) */
  gable(a0: number, a1: number, y0: number, col: string, step = 1): void {
    for (let s = 0; a0 + s * step < a1 - s * step; s++) this.rect(a0 + s * step, a1 - s * step, y0 + s, y0 + s + 1, col);
  }
  /** Draw on a vertical plane: axis "x" spans x at z = plane, axis "z" spans z at x = plane. Edges become white paper. */
  draw(v: V, axis: "x" | "z", plane: number, off = 0, edge = PAPER): void {
    for (const [k, cell] of this.cells) {
      const [a, y] = k.split(",").map(Number);
      const rim = !cell.keep && (!this.cells.has(`${a - 1},${y}`) || !this.cells.has(`${a + 1},${y}`) || !this.cells.has(`${a},${y + 1}`));
      const col = rim ? mix(cell.col, edge, 0.62) : cell.col;
      if (axis === "x") v.put(a + off, y, plane, col, rim ? 0 : cell.emit);
      else v.put(plane, y, a + off, col, rim ? 0 : cell.emit);
    }
  }
}

/**
 * The storybook itself, lying open on the lawn with its gutter along x at rows gz-1, gz. Pages print text
 * lines and little coloured vignettes. Returns the standing y on the pages.
 */
function storyBook(c: Ctx, x0: number, x1: number, z0: number, z1: number, gz: number, cover: string, ribbonX?: number): number {
  const v = c.v;
  // hard cover with a rim, three page layers whose edges show as strata, pages dipping into the gutter
  v.box(x0, 1, z0, x1, 2, z1, cover);
  for (const y of [2, 3]) v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, pageCol(y));
  if (x1 - x0 > 6 && z1 - z0 > 6) v.clear(x0 + 2, 2, z0 + 2, x1 - 2, 4, z1 - 2);
  for (let x = x0 + 1; x < x1 - 1; x++) {
    for (let z = z0 + 1; z < z1 - 1; z++) {
      const gutter = z === gz - 1 || z === gz;
      const dz = z < gz ? gz - 1 - z : z - gz;
      const span = z < gz ? gz - 1 - (z0 + 1) : z1 - 2 - gz;
      const text = (x - x0) % 2 === 0 && dz >= 2 && dz <= span - 2 - ((x * 5) % 3) && x > x0 + 2 && x < x1 - 3 && (dz * 3 + x * 5) % 7 !== 0;
      if (gutter) v.put(x, 3, z, "#d6c7a5");
      else v.put(x, 4, z, text ? "#a99d86" : PAPER);
      if (!gutter && (x === x0 + 1 || x === x1 - 2 || z === z0 + 1 || z === z1 - 2)) v.put(x, 3, z, PAGE_HI);
    }
  }
  // the spine shows as a cover-coloured rim at both ends of the gutter, with gilt bands and headbands
  for (const sx of [x0, x1 - 1]) {
    v.box(sx, 1, gz - 1, sx + 1, 4, gz + 1, cover);
    v.put(sx, 2, gz - 1, GILT);
    v.put(sx, 2, gz, GILT);
  }
  // a dog-eared corner on the back page
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) v.put(x1 - 2 - k, 5, z0 + 1 + j, k + j === 2 ? PAGE_LO : PAPER);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) v.put(x1 - 2 - k, 4, z0 + 1 + j, "#d6c7a5");
  // bookmark ribbon across the front page and over the fore-edge
  if (ribbonX !== undefined) {
    for (let z = gz + 1; z < z1 - 1; z++) v.put(ribbonX, 4, z, RIBBON);
    v.box(ribbonX, 1, z1 - 1, ribbonX + 1, 4, z1, RIBBON);
    v.box(ribbonX, 1, z1, ribbonX + 1, 2, z1 + 1, RIBBON_D);
  }
  return 5;
}

/** A printed vignette (sun, waves, hills) on the page surface at y = 3. */
function vignette(c: Ctx, x0: number, z0: number, w: number, d: number, kind: number): void {
  const v = c.v;
  for (let x = x0; x < x0 + w; x++) {
    for (let z = z0; z < z0 + d; z++) {
      const u = (x - x0) / Math.max(1, w - 1);
      const t = (z - z0) / Math.max(1, d - 1);
      let col = "#cfe6f2";
      if (kind === 0) col = (u - 0.5) ** 2 + (t - 0.5) ** 2 < 0.12 ? "#f6c84c" : "#cfe6f2";
      else if (kind === 1) col = (x + Math.round(Math.sin(z * 0.9) * 1.2)) % 3 === 0 ? "#3f8fd6" : "#9fd0ef";
      else col = t > 0.55 - 0.25 * Math.sin(u * 6) ? "#7cc46a" : "#cfe6f2";
      v.put(x, 3, z, col);
    }
  }
}

/** Crossed-plane pop-up tree with a die-cut canopy. Returns the canopy top y. */
function paperTree(c: Ctx, cx: number, cz: number, y0: number, H: number, R: number, both = true): number {
  const t = new Cut();
  const trunkTop = y0 + H - Math.round(R * 1.2);
  const tw = R >= 6 ? 2 : 1;
  t.rect(-tw, tw, y0, trunkTop + 1, "#9a6a3c", 0, true);
  if (R >= 4) {
    t.rect(-tw - 2, -tw, trunkTop - 2, trunkTop - 1, "#9a6a3c", 0, true);
    t.rect(tw, tw + 2, trunkTop - 3, trunkTop - 2, "#9a6a3c", 0, true);
  }
  const cy = y0 + H - R;
  t.disc(0, cy, R, "#4fae55");
  t.disc(-R * 0.7, cy - R * 0.35, R * 0.62, "#3f9a4a");
  t.disc(R * 0.7, cy - R * 0.2, R * 0.66, "#3f9a4a");
  t.disc(-R * 0.25, cy + R * 0.3, R * 0.5, "#86cf6a");
  for (let i = 0; i < Math.max(3, R); i++) {
    const ang = i * 2.39;
    t.set(Math.round(Math.cos(ang) * R * 0.6), Math.round(cy + Math.sin(ang) * R * 0.6), i % 3 === 0 ? "warmGlow" : "#e04a3c", i % 3 === 0 ? 0.8 : 0, true);
  }
  t.draw(c.v, "x", cz, cx);
  if (both) t.draw(c.v, "z", cx, cz);
  return cy + R + 1;
}

/** Pop-up cottage: a box of card with a gable, door and windows printed on, white die-cut edges. */
function paperHouse(c: Ctx, x0: number, y0: number, z0: number, w: number, d: number, h: number, wall: string, roof: string, face: Side = "s"): void {
  const v = c.v;
  const x1 = x0 + w;
  const z1 = z0 + d;
  v.box(x0, y0, z0, x1, y0 + h, z1, wall);
  if (w > 2 && d > 2) v.clear(x0 + 1, y0, z0 + 1, x1 - 1, y0 + h, z1 - 1);
  // die-cut white corners
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, y0, pz, px + 1, y0 + h, pz + 1, PAPER);
  // gable roof of folded card (ridge along x), white fold line on the ridge
  for (let s = 0; ; s++) {
    const y = y0 + h + s;
    const meet = z0 + s + 1 >= z1 - s - 1;
    v.box(x0 - 1, y, z0 - 1 + s, x1 + 1, y + 1, z0 + s + 1, roof);
    v.box(x0 - 1, y, z1 - s - 1, x1 + 1, y + 1, z1 - s + 1, roof);
    if (meet) {
      v.box(x0 - 1, y, z0 + s, x1 + 1, y + 1, z1 - s, PAPER);
      break;
    }
    v.box(x0, y, z0 + s + 1, x0 + 1, y + 1, z1 - s - 1, wall);
    v.box(x1 - 1, y, z0 + s + 1, x1, y + 1, z1 - s - 1, wall);
  }
  // printed door + windows on the street face
  const fz = face === "s" ? z1 - 1 : z0;
  const dx = x0 + (w >> 1) - (w >= 5 ? 1 : 0);
  if (face === "s" || face === "n") {
    v.box(dx, y0, fz, dx + (w >= 5 ? 2 : 1), y0 + Math.min(3, h - 1), fz + 1, DOOR);
    if (w >= 5 && h >= 4) {
      v.put(x0 + 1, y0 + h - 2, fz, "warmGlow", 0.7);
      v.put(x1 - 2, y0 + h - 2, fz, "warmGlow", 0.7);
    }
  } else {
    const fx = face === "e" ? x1 - 1 : x0;
    const dz = z0 + (d >> 1) - 1;
    v.box(fx, y0, dz, fx + 1, y0 + Math.min(3, h - 1), dz + 2, DOOR);
    if (d >= 5 && h >= 4) {
      v.put(fx, y0 + h - 2, z0 + 1, "warmGlow", 0.7);
      v.put(fx, y0 + h - 2, z1 - 2, "warmGlow", 0.7);
    }
  }
}

// =============================================================================================
// A · STACKED HARDBACKS
// =============================================================================================

const A_OX = "#8e2a2a";
const A_NAVY = "#27406b";
const A_GREEN = "#2f6b4f";
const A_MUSTARD = "#c98f2a";
const A_PLUM = "#6d3b6b";

function stackedHardbacks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  grassLot(c);
  if (lv === 1) {
    walk(v, 0, 4, 2, hz);
    flatBook(v, -7, 1, -6, 6, 5, 7, A_GREEN, "n");
    // the fore-edge opens into a tiny reading room: armchair, reader, standard lamp, shelves
    niche(c, "s", 3, -5, -2, 2, 6, { depth: 3 });
    v.box(-5, 2, 1, -4, 3, 3, "crimson");
    v.box(-5, 3, 1, -4, 4, 2, "crimson");
    reader(c, -4, 2, 2, "s", "yellow");
    v.box(-3, 2, 1, -2, 4, 2, "iron");
    v.put(-3, 4, 1, "warmGlow", 1.1);
    libDoor(c, "s", 3, 0, 2, 2, 3, { steps: "concrete" });
    // book-return slot with a brass flap
    v.put(4, 4, 3, "black");
    v.put(4, 4, 4, "brass");
    v.put(4, 3, 4, "brass");
    // the bookmark slips out of the head and trails across the lawn
    v.box(5, 2, 1, 6, 6, 2, RIBBON);
    v.box(6, 1, 1, 7, 2, 6, RIBBON);
    v.put(6, 1, 5, RIBBON_D);
    readersOn(c, 3, 5, miniStack(c, 2, 5, 5, 7, 3), 6, "w");
    lamp(v, -2, 1, 6, 5);
    flowerBed(c, -7, 5, -4, 7);
    return;
  }
  if (lv === 2) {
    walk(v, -1, 2, 3, hz);
    flatBook(v, -15, 1, -6, 6, 3, 7, A_OX, "n");
    // the second book is offset forward and right: a deep porch on pencil columns
    pencil(v, -4, 4, 1, 8);
    pencil(v, 12, 4, 1, 8, "#5fb0e6");
    pencil(v, 12, -5, 1, 8, "#5fb0e6");
    flatBook(v, -4, 8, -6, 15, 6, 6, A_NAVY, "e");
    libDoor(c, "s", 1, 0, 2, 2, 3);
    niche(c, "s", 1, -13, -10, 3, 6, { reader: true });
    niche(c, "s", 1, -8, -5, 3, 6);
    // the return slot under the porch
    v.box(3, 1, 3, 5, 4, 5, "brass");
    v.box(3, 3, 5, 5, 4, 5, "black");
    v.put(3, 4, 3, "red");
    v.put(4, 4, 3, "red");
    // covered reading nook under the overhang
    bench(v, 7, 1, -2, "x", "woodDark");
    readersOn(c, 7, 10, 2, -2, "s");
    bench(v, 7, 1, 3, "x", "woodDark");
    readersOn(c, 8, 10, 2, 3, "s");
    v.box(10, 1, -4, 11, 3, -3, "leafDark");
    // the bookmark slips out of the upper book's tail and hangs over the porch
    v.box(4, 9, 5, 6, 13, 6, RIBBON);
    v.box(4, 4, 6, 6, 9, 7, RIBBON);
    v.put(5, 4, 6, null);
    lamp(v, -6, 1, hz - 2, 5);
    flowerBed(c, -14, 4, -7, 6);
    return;
  }
  if (lv === 3) {
    // L of books round a reading garden
    flatBook(v, -15, 1, -14, -3, 13, 7, A_NAVY, "e");
    flatBook(v, -3, 1, -14, 15, -2, 7, A_GREEN, "n");
    flatBook(v, -14, 8, -13, 6, 0, 6, A_OX, "s");
    // main door at the street end of the long wing
    walk(v, -11, 13, -7, hz);
    libDoor(c, "s", 11, -10, 2, 2, 3, { steps: "concrete" });
    // the garden-facing spine of the long wing carries lit reading niches
    niche(c, "e", -4, 1, 4, 3, 6, { reader: true });
    niche(c, "e", -4, 6, 9, 3, 6);
    // fore-edge niches looking into the garden
    for (const a of [0, 5, 10]) niche(c, "s", -4, a, a + 3, 2, 6, { reader: a === 5 });
    // garden
    v.box(-2, 0, -1, hx - 1, 1, hz - 1, "grass3");
    walk(v, -2, 3, hx - 1, 5, "path2");
    walk(v, 5, -2, 7, hz, "path2");
    tree(v, 11, 1, 9, "blossom", 1.4, 2);
    tree(v, 1, 1, 10, "round", 1.1, 1);
    bench(v, 0, 1, 7, "x", "woodDark");
    readersOn(c, 0, 3, 2, 7, "s");
    bench(v, 9, 1, 1, "x", "woodDark");
    readersOn(c, 9, 12, 2, 1, "s");
    flowerBed(c, -1, -1, 4, 1);
    flowerBed(c, 9, -1, 14, 0 + 0);
    bush(v, 13, 1, 13, 1.3, "leafDark", "pink");
    for (let x = -1; x < hx - 1; x++) if (x < 4 || x > 8) v.box(x, 1, hz - 2, x + 1, 2, hz - 1, "leafDark");
    // roof terrace on the low wing, reached by the ribbon off the top book
    v.box(-2, 8, -7, 0, 14, -5, RIBBON);
    bench(v, 9, 8, -9, "x", "woodDark");
    readersOn(c, 9, 12, 9, -9, "s");
    lamp(v, -12, 1, hz - 2, 5);
    lamp(v, -6, 1, hz - 2, 5);
    return;
  }
  if (lv === 4) {
    // two stacks straddle a daylight slot
    flatBook(v, -23, 1, -14, -4, 12, 6, A_NAVY, "w");
    flatBook(v, -21, 7, -12, -5, 8, 5, A_OX, "s");
    flatBook(v, -19, 12, -10, -8, 3, 5, "#2d7d74", "e");
    flatBook(v, 4, 1, -14, 23, 13, 6, A_GREEN, "e");
    flatBook(v, 6, 7, -12, 21, 6, 5, A_PLUM, "n");
    // the slot: a paved reading street through the building
    walk(v, -4, -hz + 1, 4, hz, "path2");
    for (let z = -12; z < 10; z += 6) {
      bench(v, -3, 1, z, "z", "woodDark");
      reader(c, -3, 2, z + 1, "e");
    }
    tree(v, 2, 1, -11, "round", 0.9, 1);
    tree(v, 2, 1, 5, "round", 0.8, 2);
    // bookmark footbridge sagging across the slot between the two second-floor books
    for (let x = -8; x < 9; x++) {
      const t = (x + 0.5) / 8.5;
      const y = 11 - Math.round(2 * (1 - t * t));
      v.box(x, y, -6, x + 1, y + 1, -2, RIBBON);
      v.put(x, y, -6, GILT);
      v.put(x, y, -3, GILT);
      if (x % 3 === 0) { v.put(x, y + 1, -6, GILT); v.put(x, y + 1, -3, GILT); }
    }
    v.box(8, 5, -2, 10, 11, -1, RIBBON);
    v.put(9, 5, -2, null);
    reader(c, -1, 10, -4, "e");
    reader(c, 3, 10, -5, "w");
    // doors: main on the street, a second off the slot
    libDoor(c, "s", 10, -10, 3, 2, 3, { steps: "concrete" });
    walk(v, -11, 11, -6, hz);
    libDoor(c, "w", 5, 2, 2, 2, 3);
    niche(c, "s", 10, -20, -16, 2, 5, { reader: true });
    niche(c, "s", 11, 9, 13, 2, 5);
    niche(c, "s", 11, 16, 20, 2, 5, { reader: true });
    niche(c, "s", 7, -19, -15, 8, 10, { reader: false });
    // roof garden on the right stack
    v.box(7, 11, -10, 19, 12, 3, "grass3");
    tree(v, 9, 12, -7, "round", 0.8, 1);
    tree(v, 17, 12, -3, "blossom", 0.8, 2);
    bush(v, 13, 12, 1, 1.1, "leafDark", "yellow");
    bench(v, 11, 12, -4, "x", "woodDark");
    readersOn(c, 11, 14, 13, -4, "s");
    lamp(v, -23 + 1, 1, hz - 2, 5);
    lamp(v, 4, 1, hz - 2, 5);
    flowerBed(c, 6, 13, 20, 15);
    return;
  }
  // L5: a terraced pile of hardbacks climbing to a roof garden; the ribbon stair cascades to the street
  flatBook(v, -23, 1, -22, 23, 14, 6, A_NAVY, "e");
  flatBook(v, -21, 7, -20, 15, 5, 5, A_OX, "s");
  flatBook(v, -19, 12, -19, 8, -3, 3, A_GREEN, "e");
  flatBook(v, -16, 15, -18, 2, -8, 4, A_MUSTARD, "s", { gilt: true, frame: false });
  // roof garden on the top book: lawn inside a cloth rim, flower beds, a little blossom tree
  v.box(-14, 18, -17, 1, 19, -10, "grass3");
  flowerBed(c, -14, -17, -11, -15, 19);
  tree(v, -1, 19, -15, "blossom", 0.6, 1);
  bush(v, -12, 19, -12, 1, "leafDark", "yellow");
  bush(v, -4, 19, -16, 0.9, "leaf", "pink");
  readersOn(c, -9, -5, 19, -12, "s");
  // the ribbon stair: across the terraces and onto the plaza, ending in a curl
  ribbonStair(v, -10, -6, -10, hz - 4, 19);
  // ...and curls out along the pavement in a loop before its forked tail
  v.box(-10, 1, hz - 4, -6, 2, hz - 1, RIBBON);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2;
    const x = Math.round(-3 + Math.sin(ang) * 3);
    const y = Math.round(4 + Math.cos(ang + Math.PI) * 3);
    v.box(x, y, hz - 4, x + 1, y + 1, hz - 1, i % 5 === 0 ? RIBBON_D : RIBBON);
  }
  v.box(-6, 1, hz - 4, 3, 2, hz - 1, RIBBON);
  v.box(-6, 1, hz - 4, 3, 2, hz - 3, GILT);
  v.put(2, 1, hz - 3, null);
  // terraces: readers, planters, lamps
  for (const [x0, x1, y, z] of [[2, 12, 7, 9], [-20, -12, 7, 9], [-2, 10, 12, 1], [-17, -11, 12, 1], [-17, -13, 15, -6], [-2, 5, 15, -6]] as const) {
    bench(v, x0, y, z, "x", "woodDark");
    readersOn(c, x0, Math.min(x0 + 3, x1), y + 1, z, "s");
    bush(v, x1 - 2, y, z, 1, "leaf", "pink");
  }
  for (const [x, y, z] of [[17, 7, -6], [17, 7, 6], [10, 12, -12], [4, 15, -14]] as const) tree(v, x, y, z, "round", 0.8, x);
  // main door on the street face, plaza with lamps
  walk(v, -hx + 1, 14, hx - 1, hz - 1, "path2");
  libDoor(c, "s", 12, 4, 3, 2, 3, { steps: "concrete" });
  niche(c, "s", 12, -18, -14, 2, 5, { reader: true });
  niche(c, "s", 12, 12, 16, 2, 5, { reader: true });
  niche(c, "s", 4, -17, -13, 8, 10);
  niche(c, "e", 22, -16, -12, 2, 5);
  niche(c, "e", 22, 4, 8, 2, 5, { reader: true });
  for (const x of [-21, 0, 10, 21]) lamp(v, x, 1, hz - 2, 6);
  tree(v, 17, 1, hz - 4, "blossom", 1.1, 3);
  flowerBed(c, 9, hz - 6, 15, hz - 4);
}

// =============================================================================================
// B · OPEN FOLIO
// =============================================================================================

const B_COVER = "#22577a";

/** Bookcase walls rising to meet the roof: shelves facing out, cream piers every `bay`. */
function stackWalls(c: Ctx, x0: number, x1: number, z0: number, z1: number, under: (x: number) => number, opts: { bay?: number; front?: boolean; sides?: boolean } = {}): void {
  const v = c.v;
  const bay = opts.bay ?? 4;
  for (let x = x0; x < x1; x++) {
    const top = under(x);
    const pier = (x - x0) % bay === 0 || x === x1 - 1;
    for (let y = 1; y < top; y++) {
      v.put(x, y, z0, pier ? "#efe3c6" : y === 1 ? "stone" : y === top - 1 ? "warmGlow" : "glass", y === top - 1 ? 0.6 : 0.25);
      if (opts.front !== false) {
        const glow = y === top - 1 || y === 4;
        v.put(x, y, z1 - 1, pier ? "#efe3c6" : y === 1 ? "stone" : glow ? "warmGlow" : c.pick(SPINE_COLS), pier ? 0 : glow ? 0.8 : 0.12);
      }
    }
  }
  if (opts.sides !== false) {
    for (const x of [x0, x1 - 1]) {
      const top = under(x);
      for (let z = z0; z < z1; z++) for (let y = 1; y < top; y++) v.put(x, y, z, (z - z0) % 4 === 0 ? "#efe3c6" : y === 1 ? "stone" : y === top - 1 ? "warmGlow" : "glass", y === top - 1 ? 0.6 : 0.25);
    }
  }
}

/** Raised relief atlas print: sea with graticule, sandy coasts, green land, mountains handled separately. */
function atlasHeight(a: number, l: number): number {
  return Math.sin(a * 0.27 + 1.3) * Math.cos(l * 0.21 - 0.4) + 0.65 * Math.sin((a + l) * 0.15 + 0.5) + 0.45 * Math.cos((a - 2 * l) * 0.11);
}

function openFolio(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  grassLot(c);
  if (lv === 1) {
    const under = openBook(c, { axis: "z", g: 0, aMin: -7, aMax: 7, l0: -6, l1: 6, yG: 7, rise: [4, 4], cover: B_COVER, ribbon: true });
    // bookcase back wall following the V, side cases
    for (let x = -6; x < 6; x++) {
      for (let y = 1; y < under(x); y++) v.put(x, y, -5, y === under(x) - 1 ? "warmGlow" : (y % 3 === 0 ? "woodDark" : c.pick(SPINE_COLS)), y === under(x) - 1 ? 0.8 : 0.1);
    }
    for (const x of [-6, 5]) {
      v.box(x, 1, -4, x + 1, 5, 3, "woodDark");
      for (let z = -4; z < 3; z++) for (let y = 2; y < 5; y++) if (y !== 4 || z % 2) v.put(x + (x < 0 ? 0 : 0), y, z, c.pick(SPINE_COLS), 0.1);
      v.box(x, 5, -4, x + 1, 6, 3, "woodLight");
    }
    // the reading bench sits in the binding
    bench(v, -2, 1, 0, "x", "woodDark");
    reader(c, -2, 2, 0, "s", "yellow");
    walk(v, -2, 0, 2, hz);
    v.box(-1, 1, 3, 1, 2, 4, "concrete");
    lamp(v, -4, 1, 6, 5);
    lamp(v, 3, 1, 6, 5);
    flowerBed(c, -7, 5, -5, 7);
    flowerBed(c, 5, 5, 7, 7);
    return;
  }
  if (lv === 2) {
    // a long thick leaf over the stacks, a short leaf over a street terrace
    const under = openBook(c, { axis: "z", g: 5, aMin: -15, aMax: 15, l0: -6, l1: 6, yG: 7, rise: [5, 4], thick: [3, 2], cover: B_COVER, ribbon: true });
    stackWalls(c, -14, 5, -5, 5, under, { bay: 4 });
    libDoor(c, "s", 4, 1, 2, 1, 3, { lamps: false });
    v.put(0, 4, 5, "warmGlow", 1);
    walk(v, 0, 5, 4, hz);
    // terrace under the short leaf
    walk(v, 5, -5, 14, 6, "path2");
    for (const [x, z] of [[13, -5], [13, 5]] as const) v.box(x, 1, z, x + 1, under(x), z + 1, "#efe3c6");
    for (const [x, z] of [[8, -2], [10, 3]] as const) {
      v.box(x, 1, z, x + 2, 2, z + 2, "woodLight");
      v.box(x, 2, z, x + 2, 3, z + 1, "white");
      reader(c, x - 1, 1, z, "e");
      reader(c, x + 2, 1, z + 1, "w");
    }
    v.box(12, 1, -2, 13, 3, 1, "woodDark");
    for (let z = -2; z < 1; z++) v.put(12, 3, z, c.pick(SPINE_COLS));
    lamp(v, -13, 1, 6, 5);
    flowerBed(c, -12, 6, -3, 7);
    tree(v, hx - 3, 1, hz - 3, "round", 0.6, 1);
    return;
  }
  if (lv === 3) {
    // a broad V over sunken reading steps; the ribbon stair runs from the gutter down to the street
    const under = openBook(c, { axis: "z", g: 0, aMin: -15, aMax: 15, l0: -14, l1: 13, yG: 7, rise: [7, 7], thick: [2, 2], cover: B_COVER, ribbon: true });
    stackWalls(c, -14, -6, -12, 11, under, { bay: 4 });
    stackWalls(c, 6, 14, -12, 11, under, { bay: 4 });
    // sunken reading steps: three tiers wrap the court
    for (let k = 0; k < 3; k++) {
      v.box(-6 + k, 1, -12, -5 + k, 4 - k, 11, "#e9dcc0");
      v.box(5 - k, 1, -12, 6 - k, 4 - k, 11, "#e9dcc0");
      v.box(-6, 1, -12 + k, 6, 4 - k, -11 + k, "#e9dcc0");
    }
    for (let z = -8; z < 10; z += 3) {
      reader(c, -6, 4, z, "e");
      reader(c, 5, 4, z + 1, "w");
      if (z % 2 === 0) reader(c, -4, 2, z + 2, "e");
    }
    v.box(-2, 1, -4, 2, 2, 2, "woodLight");
    reader(c, -1, 1, 3, "n");
    walk(v, -3, -9, 3, hz, "path2");
    libDoor(c, "w", -6, 2, 2, 1, 3, { lamps: false });
    libDoor(c, "e", 5, -4, 2, 1, 3, { lamps: false });
    // ribbon stair from the gutter down to the pavement, along the front of the left hall
    for (let k = 0; k <= 6; k++) {
      const x = -1 - k;
      const y = 7 - k;
      v.box(x, y, 13, x + 1, y + 1, 15, RIBBON);
      v.box(x, Math.max(1, y - 1), 13, x + 1, y, 15, RIBBON_D);
      v.put(x, y, 14, GILT);
    }
    v.box(-11, 1, 13, -7, 2, 15, RIBBON);
    v.put(-11, 1, 14, null);
    reader(c, -4, 5, 13, "s");
    // readers who climbed the ribbon sit out on the printed pages
    for (const [x, z] of [[7, 2], [-8, -4], [10, -8]] as const) reader(c, x, surfaceAt(v, x, z, 24), z, "n");
    for (const x of [-14, 12]) lamp(v, x, 1, hz - 2, 5);
    flowerBed(c, 6, 12, 13, 14);
    return;
  }
  if (lv === 4) {
    // the folio is laid face-down: a cloth tent whose spine is the ridge, sheltering a street-facing
    // reading amphitheater with the stacks lining its back
    const under = tentBook(c, 0, -18, 18, -14, 12, 15, 13, 3, B_COVER);
    // stacks: a bookcase wall closes the back of the tent
    for (let x = -17; x < 17; x++) {
      const top = under(x);
      for (let y = 1; y <= top; y++) {
        const glow = y === top || y === 6;
        v.put(x, y, -13, y === 1 ? "woodDark" : glow ? "warmGlow" : y % 4 === 0 ? "woodDark" : c.pick(SPINE_COLS), glow ? 0.8 : 0.12);
      }
    }
    libDoor(c, "s", -13, -1, 2, 1, 4, { lamps: true });
    // amphitheater tiers rise toward the back, every seat facing the street
    for (let z = -12; z < 6; z++) {
      const tierH = 1 + Math.floor((5 - z) / 3);
      for (let x = -16; x < 16; x++) {
        if (x >= -2 && x < 2) continue;
        if (tierH + 5 > under(x)) continue;
        v.box(x, 1, z, x + 1, tierH + 1, z + 1, Math.floor((5 - z) / 3) % 2 ? "#e9dcc0" : "#f6ecd6");
      }
    }
    for (let z = -11; z < 6; z += 3) {
      for (let x = -14; x < 14; x += 3) {
        if (x >= -3 && x < 2) continue;
        const yb = surfaceAt(v, x, z, 12);
        if (yb > 1 && yb + 4 <= under(x) && c.rand() < 0.75) reader(c, x, yb, z, "s");
      }
    }
    // the reading stage at the mouth, with the bookmark hanging from the ridge above it
    v.box(-6, 1, 7, 6, 2, 10, "woodLight");
    v.box(-1, 2, 8, 1, 4, 9, "woodDark");
    reader(c, 0, 2, 9, "n", "red");
    v.box(-1, 9, 11, 1, 17, 12, RIBBON);
    v.put(0, 9, 11, null);
    // splayed loose leaves at the feet of the covers
    // the page block splays out from under both covers like wings
    for (let k = 0; k < 3; k++) {
      v.box(-21 + k, 1 + k, -12, -18, 2 + k, 10, k % 2 ? PAGE_LO : PAPER);
      v.box(18, 1 + k, -12, 21 - k, 2 + k, 10, k % 2 ? PAGE_LO : PAPER);
    }
    // reading terraces either side of the tent
    for (const x of [-22, 22]) {
      tree(v, x < 0 ? x : x - 1, 1, 11, "round", 0.9, x);
      bench(v, x, 1, -2, "z", "woodDark");
      reader(c, x, 2, -1, x < 0 ? "e" : "w");
    }
    walk(v, -2, 6, 2, hz, "path2");
    for (const x of [-9, 8]) lamp(v, x, 1, hz - 2, 5);
    for (const x of [-20, 17]) {
      bench(v, x, 1, hz - 3, "x", "woodDark");
      readersOn(c, x, x + 3, 2, hz - 3, "s");
    }
    return;
  }
  // L5: the atlas. Fanned halves printed with raised relief either side of a glass spine atrium.
  const g = 0;
  const yG = 8;
  const RISE = 8;
  const print = (a: number, l: number, d: number, side: 0 | 1, W: number): string => {
    if (d < 2 || d > W - 3 || l < -19 || l > 16) return PAPER;
    const h = atlasHeight(a, l);
    if (h > 0.55) return h > 1.15 ? "#9a8a6a" : h > 0.85 ? "#6fae58" : "#8fcf6e";
    if (h > 0.4) return "#ecd9a0";
    return l % 6 === 0 || a % 7 === 0 ? "#7cb8e6" : "#5ea7de";
  };
  const under = openBook(c, { axis: "z", g, aMin: -23, aMax: 23, l0: -21, l1: 18, yG, rise: [RISE, RISE], thick: [3, 3], cover: B_COVER, print, skip: (a) => a >= -2 && a < 2 });
  // raised relief: hills and snowy peaks stand up off the printed pages
  for (let a = -21; a < 21; a++) {
    if (a >= -3 && a < 3) continue;
    for (let l = -19; l < 16; l++) {
      const h = atlasHeight(a, l);
      if (h <= 0.85) continue;
      const side = a < g ? 0 : 1;
      const W = 23;
      const d = side ? a - g : g - 1 - a;
      if (d < 2 || d > W - 3) continue;
      const t = d / (W - 1);
      const top = yG + Math.round(RISE * (1 - (1 - t) * (1 - t)));
      if (surfaceAt(v, a, l, top + 6) > top + 1) continue;
      const bumps = h > 1.3 ? 3 : h > 1.1 ? 2 : 1;
      for (let k = 1; k <= bumps; k++) v.put(a, top + k, l, k === bumps && bumps >= 2 ? "snow" : k === 1 ? "#6fae58" : "#9a8a6a");
    }
  }
  // glass spine atrium along the gutter
  for (let z = -21; z < 18; z++) {
    v.box(-2, 1, z, 2, yG - 3, z + 1, "glass", 0.2);
    v.box(-3, yG - 3, z, 3, yG - 2, z + 1, B_COVER);
    v.box(-2, yG - 2, z, 2, yG + 1, z + 1, "glass", 0.35);
    v.box(-1, yG + 1, z, 1, yG + 2, z + 1, "glass", 0.35);
    if (z % 4 === 0) { v.box(-2, yG - 2, z, 2, yG + 1, z + 1, "steelLight"); v.box(-1, yG + 1, z, 1, yG + 2, z + 1, "steelLight"); }
  }
  v.clear(-1, 1, -20, 1, yG - 3, 17);
  // reading halls under the wings
  stackWalls(c, -22, -3, -19, 17, under, { bay: 4 });
  stackWalls(c, 3, 22, -19, 17, under, { bay: 4 });
  // entrance at the foot of the glass spine
  v.box(-3, 1, 17, 3, yG - 2, 18, "steelLight");
  v.box(-2, 1, 17, 2, yG - 3, 18, "glass", 0.4);
  libDoor(c, "s", 17, -1, 2, 1, 4, { lamps: true });
  walk(v, -3, 18, 3, hz);
  // forecourt: globe on a plinth, benches, lamps
  walk(v, -hx + 2, 19, hx - 2, hz - 1, "path2");
  v.box(-14, 1, 19, -10, 3, 22, "#efe3c6");
  v.sphere(-11.5, 6, 20.5, 2.6, 2.6, 2.6, "#5ea7de");
  for (const [x, y, z] of [[-12, 7, 20], [-11, 6, 21], [-13, 5, 20], [-10, 7, 19], [-12, 8, 21]] as const) v.put(x, y, z, "#6fae58");
  v.box(-12, 3, 20, -11, 4, 21, GILT);
  for (const x of [5, 12]) {
    bench(v, x, 1, 21, "x", "woodDark");
    readersOn(c, x, x + 3, 2, 21, "s");
  }
  for (const x of [-20, -6, 6, 19]) lamp(v, x, 1, hz - 2, 6);
  tree(v, 19, 1, 20, "round", 1, 2);
}

// =============================================================================================
// C · BOOKEND ALLEY
// =============================================================================================

const C_BOOKS = ["#6d3b6b", "#2d7d74", "#b5492f", "#d6a43a", "#34508a", "#7c2d3b", "#3f6b3a", "#c76b98"];
const BRASS = "#c9963c";
const BRASS_D = "#8a6324";

/** Wooden shelf plank the volumes stand on (lip shows at the front). */
function plank(v: V, x0: number, x1: number, z0: number, z1: number): void {
  v.box(x0, 1, z0, x1, 2, z1, "#8f5e36");
  v.box(x0, 1, z1 - 1, x1, 2, z1, "#a87444");
}

/**
 * A brass bookend: a tall plate across [x0,x1) with a quarter-round top falling away from the books (`out` = -1
 * for books on the +x side) and a lit porthole, plus a foot plate slid under the first volume.
 */
function bookend(c: Ctx, x0: number, x1: number, z0: number, z1: number, h: number, out: 1 | -1, foot = 4): void {
  const v = c.v;
  const T = x1 - x0;
  // plate: an arched top along its depth, stepping down on the side away from the books
  const zc = (z0 + z1) / 2;
  const hz2 = (z1 - z0) / 2;
  const archH = (z: number) => Math.round(h * (0.62 + 0.38 * Math.sqrt(Math.max(0, 1 - ((z + 0.5 - zc) / hz2) ** 2))));
  for (let i = 0; i < T; i++) {
    const x = out < 0 ? x0 + i : x1 - 1 - i;
    const drop = T > 1 ? Math.round(((T - 1 - i) / (T - 1)) ** 1.6 * Math.min(2, T - 1)) : 0;
    for (let z = z0; z < z1; z++) {
      const top = archH(z) - drop;
      v.box(x, 1, z, x + 1, 1 + top, z + 1, BRASS);
      v.put(x, top, z, i === T - 1 ? BRASS_D : "#e2b75a");
    }
  }
  // deco ribs following the arch on the outer face and a dark base course
  const ox = out < 0 ? x0 : x1 - 1;
  for (let z = z0 + 2; z < z1 - 2; z += 3) v.box(ox, 2, z, ox + 1, Math.max(3, archH(z) - 2), z + 1, BRASS_D);
  v.box(x0, 1, z0, x1, 2, z1, BRASS_D);
  // lit porthole through the plate
  if (h >= 8) {
    const cy = Math.round(1 + h * 0.55);
    const cz = Math.floor((z0 + z1) / 2);
    v.box(x0, cy - 2, cz - 2, x1, cy + 3, cz + 3, BRASS_D);
    v.box(x0, cy - 1, cz - 1, x1, cy + 2, cz + 2, "warmGlow", 0.85);
  }
  if (foot > 0) {
    const fx0 = out < 0 ? x1 : x0 - foot;
    v.box(fx0, 1, z0, fx0 + foot, 2, z1, BRASS_D);
  }
}

/** A row of upright volumes from x0 to the right; returns x after the last. */
function shelfRow(c: Ctx, x0: number, z0: number, z1: number, widths: number[], heights: number[], cols: string[], spine: Side = "s", o: (i: number) => UprightOpts = () => ({})): number {
  let x = x0;
  for (let i = 0; i < widths.length; i++) {
    uprightBook(c, x, 2, z0, x + widths[i], z1, heights[i], cols[i % cols.length], spine, o(i));
    x += widths[i];
  }
  return x;
}

function bookendAlley(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  grassLot(c);
  if (lv === 1) {
    plank(v, -7, 7, -6, 5);
    bookend(c, -7, -5, -5, 4, 8, -1, 0);
    uprightBook(c, -5, 2, -5, 0, 4, 11, C_BOOKS[0], "s", { windows: 1 });
    uprightBook(c, 4, 2, -4, 7, 4, 9, C_BOOKS[1], "s");
    // the walk-in slot between the volumes: a door at its far end, a bookmark swag and lantern above
    v.box(0, 1, -5, 4, 2, 5, "path2");
    shelves(c, "s", 0, 0, 4, 2, 10, 0);
    v.box(0, 2, 0, 4, 8, 1, FRAME);
    v.box(1, 2, 0, 3, 6, 1, DOOR);
    v.box(1, 6, 0, 3, 7, 1, "warmGlow", 0.9);
    v.box(0, 2, -1, 4, 10, 0, "woodDark");
    shelves(c, "e", -1, 1, 4, 2, 8, 0);
    for (const [x, y] of [[-1, 12], [0, 11], [1, 10], [2, 10], [3, 10]] as const) v.box(x, y, 3, x + 1, y + 1, 4, RIBBON);
    v.box(2, 9, 3, 3, 10, 4, "iron");
    v.put(2, 8, 3, "warmGlow", 1.2);
    reader(c, 3, 2, 2, "w");
    walk(v, 0, 5, 3, hz);
    bench(v, 4, 1, 6, "x", "woodDark");
    reader(c, 5, 2, 5, "w");
    lamp(v, -2, 1, 6, 5);
    bush(v, -5, 1, 5, 0.9, "leaf", "pink");
    return;
  }
  if (lv === 2) {
    plank(v, -15, 12, -6, 5);
    bookend(c, 9, 12, -5, 4, 10, 1, 0);
    uprightBook(c, -14, 2, -5, -8, 4, 12, C_BOOKS[0], "s", { windows: 2 });
    uprightBook(c, -8, 2, -5, -3, 4, 9, C_BOOKS[3], "s");
    uprightBook(c, 2, 2, -5, 9, 4, 14, C_BOOKS[4], "s", { door: true });
    // covered passage roofed by a lying volume; a shop-window view into the stacks off the passage
    flatBook(v, -8, 11, -5, 2, 4, 3, C_BOOKS[5], "s", { frame: false });
    niche(c, "e", -4, -3, 1, 3, 7, { depth: 2 });
    v.box(-3, 1, -5, 2, 2, 5, "path2");
    libDoor(c, "s", -5, -2, 2, 2, 3, { lamps: false });
    v.box(-1, 10, 3, 0, 11, 4, "iron");
    v.put(-1, 9, 3, "warmGlow", 1.2);
    reader(c, 0, 2, 0, "w");
    walk(v, -3, 5, 2, hz);
    // a reading yard beside the bookend
    tree(v, 13, 1, -3, "round", 0.9, 1);
    bench(v, 12, 1, 4, "x", "woodDark");
    readersOn(c, 12, 15, 2, 4, "s");
    lamp(v, -5, 1, 6, 5);
    lamp(v, 3, 1, 6, 5);
    flowerBed(c, -14, 6, -7, 7);
    return;
  }
  if (lv === 3) {
    // two tall bookends face each other across an open reading alley
    plank(v, -15, -4, -12, 9);
    plank(v, 4, 15, -12, 9);
    bookend(c, -15, -12, -11, 8, 15, -1, 0);
    bookend(c, 12, 15, -11, 8, 15, 1, 0);
    shelfRow(c, -12, -11, 8, [5, 3], [13, 10], [C_BOOKS[1], C_BOOKS[3]], "s", (i) => ({ windows: i === 0 ? 2 : 0 }));
    shelfRow(c, 4, -11, 8, [3, 5], [9, 12], [C_BOOKS[7], C_BOOKS[4]], "s", (i) => ({ windows: i === 1 ? 2 : 0 }));
    // a volume lying across the head of the alley holds the front door
    flatBook(v, -4, 1, -14, 4, -6, 7, C_BOOKS[0], "n", { frame: false });
    libDoor(c, "s", -8, -1, 2, 2, 3, { lamps: true });
    // the alley: paving, long reading table, string of reading lamps between the volumes
    walk(v, -4, -6, 4, hz, "path2");
    v.box(-1, 1, -3, 1, 2, 7, "woodLight");
    v.box(-1, 2, -3, 1, 3, 7, "woodDark");
    for (let z = -2; z < 7; z += 2) {
      reader(c, -2, 1, z, "e");
      reader(c, 1, 1, z + 1, "w");
    }
    for (let x = -4; x < 4; x++) v.put(x, 12 - (x === -4 || x === 3 ? 0 : 1), 0, x & 1 ? "warmGlow" : "iron", x & 1 ? 1 : 0);
    for (let x = -4; x < 4; x++) v.put(x, 11 - (x === -4 || x === 3 ? 0 : 1), 6, x & 1 ? "warmGlow" : "iron", x & 1 ? 1 : 0);
    tree(v, -14, 1, 12, "round", 1, 1);
    tree(v, 13, 1, 12, "blossom", 1, 2);
    bench(v, -10, 1, 13, "x", "woodDark");
    readersOn(c, -10, -7, 2, 13, "s");
    bench(v, 7, 1, 13, "x", "woodDark");
    readersOn(c, 7, 10, 2, 13, "s");
    flowerBed(c, -12, 10, -5, 11);
    flowerBed(c, 5, 10, 12, 11);
    return;
  }
  if (lv === 4) {
    // a row of short spines, a reading-bridge book, one tall archive volume
    plank(v, -23, 0, -12, 7);
    bookend(c, -23, -21, -11, 6, 8, -1, 0);
    shelfRow(c, -21, -11, 6, [4, 3, 4, 3, 4], [9, 11, 8, 10, 9], [C_BOOKS[1], C_BOOKS[3], C_BOOKS[7], C_BOOKS[2], C_BOOKS[6]], "s", (i) => ({ windows: i === 1 || i === 3 ? 1 : 0 }));
    plank(v, 6, 21, -14, 7);
    uprightBook(c, 7, 2, -13, 19, 6, 17, C_BOOKS[5], "s", { windows: 3, door: false });
    libDoor(c, "s", 5, 11, 2, 2, 4, { steps: "concrete" });
    // the reading bridge: a volume laid across from the short row to the archive
    flatBook(v, -10, 12, -8, 8, 1, 4, C_BOOKS[4], "s", { frame: GILT });
    for (let x = -5; x < 6; x += 2) v.box(x, 13, -1, x + 1, 15, 0, "warmGlow", 0.7);
    v.box(-5, 13, -1, 6, 14, 0, "warmGlow", 0.5);
    reader(c, -2, 16, -4, "s");
    reader(c, 3, 16, -5, "s");
    // alley under the bridge, garden in front
    walk(v, -3, -12, 6, hz, "path2");
    walk(v, 11, 7, 15, hz);
    tree(v, 1, 1, -9, "round", 0.9, 1);
    bench(v, -2, 1, 2, "z", "woodDark");
    reader(c, -2, 2, 3, "e");
    for (const [x, z] of [[-18, 11], [-10, 11]] as const) {
      bench(v, x, 1, z, "x", "woodDark");
      readersOn(c, x, x + 3, 2, z, "s");
    }
    tree(v, 21, 1, 11, "blossom", 1.1, 2);
    tree(v, -22, 1, 12, "round", 1, 1);
    flowerBed(c, 17, 8, 21, 10);
    for (const x of [-14, 4, 17]) lamp(v, x, 1, hz - 2, 5);
    return;
  }
  // L5: a skyline of volumes rings a reading square; the tall gap of a missing volume is the way in
  plank(v, -22, 22, -23, -9);
  shelfRow(c, -21, -22, -9, [5, 4, 6, 3, 5, 4, 6, 5, 4], [15, 17, 13, 18, 14, 16, 18, 13, 15], C_BOOKS, "s", (i) => ({ windows: i % 3 === 1 ? 2 : 0 }));
  plank(v, -23, -12, -9, 10);
  shelfRow2(c, -23, -12, -9, [4, 5, 3, 5, 4], [15, 13, 12, 10, 9], "e");
  plank(v, 12, 23, -9, 10);
  shelfRow2(c, 12, 23, -9, [4, 5, 3, 5, 4], [11, 9, 8, 7, 6], "w");
  // front row with the missing volume
  plank(v, -22, 22, 10, 18);
  bookend(c, -23, -21, 11, 17, 10, -1, 0);
  bookend(c, 21, 23, 11, 17, 10, 1, 0);
  shelfRow(c, -21, 11, 17, [4, 5, 3, 4, 5], [6, 7, 5, 6, 16], [C_BOOKS[6], C_BOOKS[2], C_BOOKS[3], C_BOOKS[0], C_BOOKS[4]], "s", (i) => ({ windows: i === 4 ? 2 : 0, door: i === 1 }));
  shelfRow(c, 3, 11, 17, [5, 4, 3, 6], [16, 6, 5, 7], [C_BOOKS[5], C_BOOKS[1], C_BOOKS[7], C_BOOKS[3]], "s", (i) => ({ windows: i === 0 ? 2 : 0 }));
  // the gap: a lit doorway at its far end, the fallen volume lies on the plaza as a bench
  walk(v, -3, -9, 3, hz, "path2");
  v.box(-3, 1, 10, 3, 2, 18, "path2");
  flatBook(v, -8, 1, 19, 8, 23, 3, C_BOOKS[6], "n", { frame: GILT });
  readersOn(c, -6, 7, 4, 21, "s", 3);
  // the reading square
  v.box(-11, 0, -8, 11, 1, 9, "grass3");
  walk(v, -11, -1, 11, 1, "path2");
  tree(v, -6, 1, -4, "oak", 1.5, 1);
  tree(v, 7, 1, 4, "blossom", 1.2, 2);
  for (const [x, z, f] of [[-9, 4, "e"], [3, -6, "s"], [-2, 5, "n"], [7, -3, "w"]] as const) {
    bench(v, x, 1, z, f === "e" || f === "w" ? "z" : "x", "woodDark");
    reader(c, x + (f === "w" ? 0 : 1), 2, z + 1, f);
  }
  libDoor(c, "s", -10, -2, 2, 2, 4, { lamps: true });
  for (const x of [-17, -9, 9, 17]) lamp(v, x, 1, hz - 2, 5);
}

/** A row of volumes along z (spines facing +x for "e" or -x for "w"). */
function shelfRow2(c: Ctx, x0: number, x1: number, z0: number, widths: number[], heights: number[], spine: Side): void {
  let z = z0;
  for (let i = 0; i < widths.length; i++) {
    uprightBook(c, x0, 2, z, x1, z + widths[i], heights[i], C_BOOKS[(i * 3 + (spine === "e" ? 1 : 4)) % C_BOOKS.length], spine, { windows: i === 1 ? 1 : 0 });
    z += widths[i];
  }
}

// =============================================================================================
// D · POP-UP STORYBOOK
// =============================================================================================

const D_COVER = "#d8453a";
const D_WALLS = ["#f2c14e", "#7fc4e8", "#f19ab6", "#9ad37a", "#c9a6e8", "#f6a15a"];
const D_ROOFS = ["#3f6fb0", "#d8453a", "#7a4fb0", "#2f8a6a", "#e07a2e"];
const CUSHIONS = ["#f19ab6", "#7fc4e8", "#f2c14e", "#9ad37a"];

/** Steps up over the storybook's front cover edge (the cover row is at zEdge). */
function bookSteps(v: V, x0: number, x1: number, zEdge: number): void {
  v.box(x0, 2, zEdge, x1, 4, zEdge + 1, "woodLight");
  v.box(x0, 1, zEdge + 1, x1, 3, zEdge + 2, "woodLight");
  v.box(x0, 1, zEdge + 2, x1, 2, zEdge + 3, "woodLight");
}

/** Lending kiosk: a card booth with a lit counter, librarian, striped paper awning. */
function kiosk(c: Ctx, x0: number, y0: number, z0: number, w: number, d: number, h = 4): void {
  const v = c.v;
  const x1 = x0 + w;
  const z1 = z0 + d;
  paperHouse(c, x0, y0, z0, w, d, h, "#f2c14e", "#3f6fb0", "s");
  v.box(x0 + 1, y0 + 1, z1 - 1, x1 - 1, y0 + 3, z1, null);
  v.box(x0 + 1, y0 + 1, z1 - 2, x1 - 1, y0 + 3, z1 - 1, "warmGlow", 0.7);
  v.box(x0, y0, z1, x1, y0 + 1, z1 + 1, "woodLight");
  for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, y0 + 1, z1, c.pick(SPINE_COLS));
  person(v, x0 + 2, y0, z1 - 2, "purple", "charcoal", c.pick(SKIN));
  for (let x = x0 - 1; x < x1 + 1; x++) {
    v.put(x, y0 + h - 1, z1, x & 1 ? "white" : RIBBON);
    v.put(x, y0 + h - 2, z1 + 1, x & 1 ? "white" : RIBBON);
  }
}

/**
 * A row of die-cut house fronts: two-ply card (printed face, blank back) standing on the page, with fold tabs
 * behind. `face` is the printed side: the row runs along x for "s"/"n" and along z for "e"/"w".
 */
function storyFlats(c: Ctx, face: Side, plane: number, a0: number, y0: number, widths: number[], heights: number[], k0 = 0): void {
  const front = new Cut();
  const back = new Cut();
  let a = a0;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    const h = heights[i];
    front.rect(a, a + w, y0, y0 + h, D_WALLS[(i + k0) % D_WALLS.length]);
    front.gable(a - 1, a + w + 1, y0 + h, D_ROOFS[(i + k0) % D_ROOFS.length]);
    const dm = a + (w >> 1) - (w >= 4 ? 1 : 0);
    front.rect(dm, dm + (w >= 4 ? 2 : 1), y0, y0 + 3, DOOR, 0, true);
    if (h >= 5) {
      front.set(a + 1, y0 + h - 2, "warmGlow", 0.7, true);
      front.set(a + w - 2, y0 + h - 2, "warmGlow", 0.7, true);
    }
    a += w + 1;
  }
  for (const [k, cell] of front.cells) back.cells.set(k, { col: mix(cell.col === DOOR || cell.col === "warmGlow" ? "#ece2cc" : cell.col, PAPER, 0.7), emit: 0, keep: true });
  const along = face === "s" || face === "n" ? "x" : "z";
  const out = face === "s" || face === "e" ? 1 : -1;
  front.draw(c.v, along, plane);
  back.draw(c.v, along, plane - out);
  for (let t = a0 + 1; t < a - 1; t += 3) {
    const n0 = out > 0 ? plane - 3 : plane + 2;
    if (along === "x") c.v.box(t, y0, n0, t + 1, y0 + 2, n0 + 2, PAPER);
    else c.v.box(n0, y0, t, n0 + 2, y0 + 2, t + 1, PAPER);
  }
}

/** Die-cut gatehouse with an arched door, cut twice for thickness. */
function gatehouse(c: Ctx, y: number, z: number, half: number): void {
  const t = new Cut();
  t.rect(-half, half, y, y + 8, "#c9a6e8");
  for (let a = -half; a < half; a += 2) t.rect(a, a + 1, y + 8, y + 10, "#c9a6e8");
  t.rect(-2, 2, y, y + 4, DOOR, 0, true);
  t.rect(-1, 1, y + 4, y + 5, "warmGlow", 0.9, true);
  t.set(-half + 1, y + 6, "warmGlow", 0.7, true);
  t.set(half - 2, y + 6, "warmGlow", 0.7, true);
  t.draw(c.v, "x", z);
  t.draw(c.v, "x", z - 1);
}

function popUpStorybook(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  grassLot(c);
  if (lv === 1) {
    // a folded paper tree rises out of the gutter beside a little lending kiosk
    const y = storyBook(c, -7, 7, -7, 5, -1, D_COVER, 4);
    vignette(c, 0, 1, 3, 2, 0);
    kiosk(c, -6, y, 0, 5, 3, 4);
    paperTree(c, 2, -1, y, 9, 4);
    bookSteps(v, -1, 2, 4);
    reader(c, 1, y, 2, "s");
    lamp(v, -6, 1, 6, 4);
    bush(v, 5, 1, 6, 0.8, "leaf", "yellow");
    return;
  }
  if (lv === 2) {
    // a second fold opens a storybook lane of paper cottages under the tree
    const y = storyBook(c, -15, 15, -7, 5, -1, D_COVER, 11);
    vignette(c, -6, 1, 4, 2, 1);
    kiosk(c, -14, y, 0, 5, 3, 4);
    paperTree(c, -4, -1, y, 10, 4.5);
    storyFlats(c, "s", -4, 1, y, [4, 3, 4], [5, 6, 4], 1);
    for (let x = 0; x < 14; x += 2) v.box(x, y, 2, x + 1, y + 2, 3, PAPER);
    v.box(0, y + 1, 2, 14, y + 2, 3, PAPER);
    readersOn(c, 1, 10, y, 0, "e", 4);
    bookSteps(v, -6, -2, 4);
    for (const x of [-14, 13]) lamp(v, x, 1, 6, 5);
    return;
  }
  if (lv === 3) {
    // a paper village folds up around a walk-in courtyard
    const y = storyBook(c, -15, 15, -14, 13, -1, D_COVER, 8);
    paperTree(c, 0, -2, y, 11, 5);
    storyFlats(c, "s", -9, -14, y, [5, 4, 6, 4, 5], [5, 7, 4, 6, 5], 0);
    storyFlats(c, "e", -12, -6, y, [4, 5, 4], [5, 4, 6], 2);
    storyFlats(c, "w", 11, -6, y, [4, 5, 4], [4, 6, 5], 3);
    gatehouse(c, y, 10, 4);
    for (const [a0, a1] of [[-14, -5], [5, 14]] as const) {
      const w = new Cut();
      w.rect(a0, a1, y, y + 2, "#9ad37a");
      for (let a = a0; a < a1; a += 2) w.set(a, y + 2, "#9ad37a");
      w.draw(v, "x", 10);
    }
    bookSteps(v, -2, 2, 12);
    // the courtyard: readers on cushions round a paper well
    for (const [rx, rz] of [[-6, 3], [-3, 6], [4, 3], [6, 6], [-7, -3], [6, -4], [-4, 1]] as const) {
      v.put(rx, y, rz, c.pick(CUSHIONS));
      reader(c, rx, y + 1, rz, "n");
    }
    v.box(-1, y, 3, 1, y + 2, 5, "#7fc4e8");
    v.box(-1, y + 1, 3, 1, y + 2, 5, "water", 0.2);
    for (const x0 of [-hx + 1, hx - 2]) lamp(v, x0, 1, hz - 2, 5);
    return;
  }
  if (lv === 4) {
    // a die-cut proscenium frames a storytelling stage between tent-folded reading wings
    const gz = -4;
    const y = storyBook(c, -23, 23, -15, 13, gz, D_COVER);
    // stage and scenery flats behind the proscenium
    v.box(-9, y, -13, 9, y + 1, gz - 1, "woodLight");
    const sky = new Cut();
    sky.rect(-9, 9, y + 1, y + 11, "#2e3f7a");
    sky.disc(5, y + 8, 2, "#f6e7a8", 1, true);
    for (const [a, yy] of [[-7, 9], [-3, 10], [1, 8], [-5, 6], [7, 4]] as const) sky.set(a, y + yy, "#fff6c8", 1, true);
    sky.draw(v, "x", -13);
    const castle = new Cut();
    castle.rect(-8, -2, y + 1, y + 6, "#8a7ab8");
    castle.rect(-7, -5, y + 6, y + 8, "#8a7ab8");
    castle.gable(-8, -4, y + 8, "#d8453a");
    castle.set(-5, y + 4, "warmGlow", 0.8, true);
    castle.draw(v, "x", -10);
    const hills = new Cut();
    for (let a = -9; a < 9; a++) hills.rect(a, a + 1, y + 1, y + 3 + Math.round(1.5 + 1.5 * Math.sin(a * 0.5)), a & 4 ? "#7cc46a" : "#5aa94f");
    hills.draw(v, "x", -7);
    v.box(-1, y + 1, -9, 1, y + 2, -8, "#d8453a");
    reader(c, 0, y + 1, -8, "s", "purple");
    // the proscenium itself
    const pro = new Cut();
    pro.rect(-13, 13, y, y + 11, "#c8283a");
    pro.gable(-13, 13, y + 11, "#c8283a", 4);
    for (let a = -9; a < 9; a++) {
      const top = y + 9 + Math.round(1.6 * Math.sqrt(Math.max(0, 1 - ((a + 0.5) / 9) ** 2)));
      for (let yy = y; yy < top; yy++) pro.cells.delete(`${a},${yy}`);
    }
    for (let yy = y; yy < y + 10; yy++) {
      pro.set(-9, yy, "#8f1b2a", 0, true);
      pro.set(-8, yy, "#a51f30", 0, yy > y + 4);
      pro.set(8, yy, "#8f1b2a", 0, true);
      pro.set(7, yy, "#a51f30", 0, yy > y + 4);
    }
    for (let a = -11; a < 12; a += 2) pro.set(a, y + 10, GILT, 0.3, true);
    pro.rect(-4, 4, y + 12, y + 14, GILT, 0.3, true);
    pro.draw(v, "x", gz);
    pro.draw(v, "x", gz - 1);
    // tent-folded reading wings, open toward the audience
    for (const [wx, col] of [[-22, "#7fc4e8"], [13, "#f2c14e"]] as const) {
      for (let k = 0; k < 5; k++) {
        const edge = (z: number) => (z === -12 || z === 9 ? PAPER : (z + k) % 4 === 0 ? "#ffffff" : col);
        for (let z = -12; z < 10; z++) {
          v.box(wx + k, y + k, z, wx + k + 1, y + k + 2, z + 1, edge(z));
          v.box(wx + 9 - k, y + k, z, wx + 10 - k, y + k + 2, z + 1, edge(z));
        }
      }
      v.box(wx + 5, y + 5, -12, wx + 6, y + 7, 10, PAPER);
      shelves(c, "s", -11, wx + 2, wx + 8, y, y + 3, 0);
      v.box(wx + 3, y, 7, wx + 7, y + 1, 9, "woodLight");
      reader(c, wx + 5, y, 6, "s");
    }
    // audience on cushions on the front page
    for (let z = 0; z < 10; z += 3) {
      for (let x = -9 + (z % 2); x < 10; x += 3) {
        v.put(x, y, z, c.pick(CUSHIONS));
        if (c.rand() < 0.75) reader(c, x, y + 1, z, "n");
      }
    }
    bookSteps(v, -3, 3, 12);
    for (const x of [-20, -8, 8, 20]) lamp(v, x, 1, hz - 2, 5);
    return;
  }
  // L5: the book unfolds into a great paper tree whose branches carry occupied reading balconies
  const y = storyBook(c, -23, 23, -22, 20, -2, D_COVER, 9);
  vignette(c, -20, 4, 6, 5, 1);
  vignette(c, 14, 4, 6, 5, 0);
  vignette(c, -20, -18, 6, 5, 2);
  // trunk: two crossed, doubled card planes
  const trunk = new Cut();
  for (let yy = y; yy < y + 13; yy++) {
    const w = yy < y + 2 ? 5 : yy < y + 6 ? 3 : 2;
    trunk.rect(-w, w, yy, yy + 1, "#9a6a3c", 0, true);
  }
  for (const [ax, p] of [["x", -3], ["x", -2], ["z", -1], ["z", 0]] as const) trunk.draw(v, ax, p, ax === "x" ? 0 : -2);
  // branches carry round reading balconies
  const balcony = (bx: number, by: number, bz: number, r: number) => {
    v.cylinderY(bx, bz, by, by + 1, r, "woodLight");
    for (let a = 0; a < 18; a++) {
      const ang = (a / 18) * Math.PI * 2;
      v.put(Math.round(bx - 0.5 + Math.cos(ang) * (r - 0.4)), by + 1, Math.round(bz - 0.5 + Math.sin(ang) * (r - 0.4)), a % 2 ? PAPER : "#9a6a3c");
    }
    v.put(Math.floor(bx), by + 1, Math.floor(bz), "warmGlow", 1);
    reader(c, Math.floor(bx) + 1, by + 1, Math.floor(bz), "s");
    reader(c, Math.floor(bx) - 1, by + 1, Math.floor(bz) + 1, "e");
  };
  const limb = (x0: number, x1: number, z0: number, z1: number, by: number) => v.box(x0, by, z0, x1, by + 1, z1, "#9a6a3c");
  limb(-9, -2, -3, -1, y + 4);
  balcony(-11, y + 4, -2, 3.4);
  limb(1, 9, -3, -1, y + 7);
  balcony(11, y + 7, -2, 3.4);
  limb(-1, 1, -12, -3, y + 8);
  balcony(0, y + 8, -13, 3.2);
  limb(-1, 1, 0, 8, y + 2);
  balcony(0, y + 2, 9, 3.2);
  // a layered die-cut canopy
  for (const [cy, r, col, ox, oz] of [[y + 12, 10, "#3f9a4a", 0, -2], [y + 14, 7.5, "#4fae55", -1, -3], [y + 16, 4.5, "#86cf6a", 1, -1]] as const) {
    for (let x = Math.floor(ox - r); x <= Math.ceil(ox + r); x++) {
      for (let z = Math.floor(oz - r); z <= Math.ceil(oz + r); z++) {
        const dd = Math.hypot(x + 0.5 - ox, z + 0.5 - oz);
        const scallop = r - 0.9 * Math.abs(Math.sin(Math.atan2(z - oz, x - ox) * 4));
        if (dd > scallop) continue;
        v.put(x, cy, z, dd > scallop - 1 ? mix(col, PAPER, 0.6) : col);
        if (dd < scallop - 2.5 && cy === y + 12) v.put(x, cy - 1, z, shade(col, 0.85));
      }
    }
  }
  for (const [x, yy, z, cl] of [[5, y + 13, 2, "#e04a3c"], [-6, y + 13, -6, "#f2c14e"], [3, y + 15, -6, "#e04a3c"], [-3, y + 15, 1, "#f2c14e"], [7, y + 13, -7, "#e04a3c"], [-8, y + 13, 1, "#e04a3c"]] as const) v.put(x, yy, z, cl === "#f2c14e" ? "warmGlow" : cl, cl === "#f2c14e" ? 0.9 : 0);
  // paper lanterns hang from the canopy rim over the balconies
  for (const [x, z] of [[-9, -6], [8, 3], [-3, 6], [6, -9], [-10, 2], [9, -5]] as const) {
    v.put(x, y + 11, z, "#f6e7a8");
    v.put(x, y + 10, z, "warmGlow", 1);
  }
  // ribbon stair spiralling up round the trunk to the low balcony
  for (let k = 0; k < 8; k++) {
    const ang = 1.2 + k * 0.85;
    const sx = Math.round(-1 + Math.cos(ang) * 4.5);
    const sz = Math.round(-2.5 + Math.sin(ang) * 4.5);
    v.box(sx, y, sz, sx + 2, y + k + 1, sz + 2, k % 2 ? RIBBON : RIBBON_D);
  }
  // paper village houses in the corners, gatehouse at the front
  storyFlats(c, "s", -16, -21, y, [5, 4, 3], [6, 4, 5], 0);
  storyFlats(c, "s", -16, 8, y, [3, 4, 5], [4, 5, 7], 3);
  storyFlats(c, "e", -20, -8, y, [4, 5], [4, 5], 1);
  storyFlats(c, "w", 19, -8, y, [5, 4], [5, 4], 4);
  kiosk(c, 12, y, 11, 6, 4, 4);
  gatehouse(c, y, 17, 5);
  for (const [rx, rz] of [[-12, 6], [-8, 12], [9, 7], [12, 13], [-14, -6], [13, -8], [-5, 14], [6, 14]] as const) {
    v.put(rx, y, rz, c.pick(CUSHIONS));
    reader(c, rx, y + 1, rz, c.pick(["n", "e", "w"] as const));
  }
  bookSteps(v, -2, 2, 19);
  for (const x of [-20, -8, 8, 20]) lamp(v, x, 1, hz - 2, 5);
}

// =============================================================================================

export function buildPublicLibrary(c: Ctx): void {
  const s = ((c.variant % 4) + 4) % 4;
  if (s === 0) stackedHardbacks(c);
  else if (s === 1) openFolio(c);
  else if (s === 2) bookendAlley(c);
  else popUpStorybook(c);
}
