/**
 * NETWORK PIECES — auto-connecting 1x1 tiles (roads, paths, bridges, rails, water ways).
 *
 * Every piece is drawn on a 16x16 voxel tile ([-8,8) on x and z) from its connection mask (see `conn`
 * in kit.ts).  The guiding rule: the EDGE PROFILE of a type (surface widths, kerbs, deck height, water
 * level) is identical for every level and variant, so neighbouring tiles of the same type always line
 * up seamlessly.  Levels and variants change what happens *inside* the tile: markings, lamps, trees,
 * signals, medians, trusses, towers, boats, reeds...
 *
 * Geometry helpers:
 *  - Every arm is drawn in a canonical frame (arm pointing to -z / North) and rotated into place with
 *    `RotVox`, which applies exact 90° cell rotations about the tile centre.  All cross-sections are
 *    symmetric under x -> -1-x so the N arm of one tile meets the S arm of its neighbour perfectly.
 *  - Surfaces are painted from a per-cell distance field (`computeD`): distance to the nearest arm
 *    centre-line, with square / rounded junction boxes, round cul-de-sac bulbs on dead ends and true
 *    circular arcs for organic corners (rivers, trails, rails).
 *  - Elevated / sunken pieces use `deckH` (per-cell deck height) that slopes to ground level toward
 *    ramp sides, and can split into a grade-separated crossing.
 */
import { type Ctx, PixelVox, bench, bush, lamp, person, rocks, solarRow, tree, type TreeKind } from "./kit";
import { defineDesigns } from "./registry";
import { separatedDeckAxis } from "../roadTopology";

// ---------------------------------------------------------------------------------------------
// Rotation frame
// ---------------------------------------------------------------------------------------------

/** rotate a cell k quarter-turns about the tile centre (N->E->S->W) */
function rotK(k: number, x: number, z: number): [number, number] {
  let a = x;
  let b = z;
  const n = ((k % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    const t = -b - 1;
    b = a;
    a = t;
  }
  return [a, b];
}

/** A PixelVox proxy that writes into `tgt` rotated by k quarter turns (canonical N frame -> arm k). */
class RotVox extends PixelVox {
  tgt: PixelVox;
  k: number;
  constructor(tgt: PixelVox, k: number) {
    super(1);
    this.tgt = tgt;
    this.k = k;
  }
  override put(x: number, y: number, z: number, color: string | null, emit = 0): this {
    const [a, b] = rotK(this.k, Math.round(x), Math.round(z));
    this.tgt.put(a, y, b, color, emit);
    return this;
  }
  override box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string | null, emit = 0): this {
    const ax0 = Math.round(Math.min(x0, x1));
    const ax1 = Math.round(Math.max(x0, x1));
    const az0 = Math.round(Math.min(z0, z1));
    const az1 = Math.round(Math.max(z0, z1));
    if (ax1 <= ax0 || az1 <= az0) return this;
    const [p, q] = rotK(this.k, ax0, az0);
    const [r, s] = rotK(this.k, ax1 - 1, az1 - 1);
    this.tgt.box(Math.min(p, r), y0, Math.min(q, s), Math.max(p, r) + 1, y1, Math.max(q, s) + 1, color, emit);
    return this;
  }
}

// ---------------------------------------------------------------------------------------------
// Connection analysis
// ---------------------------------------------------------------------------------------------

interface Net {
  mask: number;
  c: Ctx;
  v: PixelVox;
  R: RotVox[];
  lv: number;
  vr: number;
  arm: boolean[];
  drive: boolean[];
  ramp: boolean[];
  water: boolean;
  /** arms after the "lonely piece" default */
  nArms: number;
  realArms: number;
  lonely: boolean;
  /** dead-end arm direction or -1 */
  dead: number;
  /** 0 = straight N-S, 1 = straight E-W, -1 otherwise */
  straight: number;
  /** corner index k (arms k and k+1) or -1 */
  corner: number;
  junction: boolean;
  D: Float32Array;
  ap: Uint8Array;
  used: Uint8Array;
}

const idx = (x: number, z: number) => (x + 8) * 16 + (z + 8);
const inT = (x: number, z: number) => x >= -8 && x < 8 && z >= -8 && z < 8;

function networkLayout(m: number, lonelyArms: boolean) {
  const arm = [0, 1, 2, 3].map((k) => ((m >> k) & 1) === 1);
  const drive = [0, 1, 2, 3].map((k) => ((m >> (k + 4)) & 1) === 1 && !arm[k]);
  const ramp = [0, 1, 2, 3].map((k) => ((m >> (k + 8)) & 1) === 1 && arm[k]);
  const realArms = arm.filter(Boolean).length;
  let lonely = false;
  if (realArms === 0 && lonelyArms) {
    lonely = true;
    if ((drive[1] || drive[3]) && !(drive[0] || drive[2])) {
      arm[1] = arm[3] = true;
    } else {
      arm[0] = arm[2] = true;
    }
  }
  const nArms = arm.filter(Boolean).length;
  const straight = arm[0] && arm[2] && !arm[1] && !arm[3] ? 0 : arm[1] && arm[3] && !arm[0] && !arm[2] ? 1 : -1;
  let corner = -1;
  if (nArms === 2 && straight < 0) {
    for (let k = 0; k < 4; k++) if (arm[k] && arm[(k + 1) % 4]) corner = k;
  }
  return {
    mask: m,
    arm,
    drive,
    ramp,
    water: (m & 4096) !== 0,
    nArms,
    realArms,
    lonely,
    dead: nArms === 1 ? arm.indexOf(true) : -1,
    straight,
    corner,
    junction: nArms >= 3,
  };
}

function mkNet(c: Ctx, lonelyArms = true): Net {
  return {
    ...networkLayout(c.conn, lonelyArms),
    c,
    v: c.v,
    R: [0, 1, 2, 3].map((k) => new RotVox(c.v, k)),
    lv: Math.max(1, Math.min(5, c.lv)),
    vr: ((c.variant % 4) + 4) % 4,
    D: new Float32Array(256),
    ap: new Uint8Array(256),
    used: new Uint8Array(256),
  };
}

type DMode = "box" | "round" | "arc";

function distAt(n: Net, x: number, z: number, mode: DMode, bulb: number): number {
  const ex = x >= 0 ? x : -1 - x;
  const ez = z >= 0 ? z : -1 - z;
  if (mode === "arc" && n.corner >= 0) {
    const [cx, cz] = rotK(4 - n.corner, x, z);
    const r = Math.hypot(8 - (cx + 0.5), cz + 0.5 + 8);
    return Math.max(0, Math.round(Math.abs(r - 8) - 0.5));
  }
  let d = 99;
  if (n.arm[0] && z < 0) d = Math.min(d, ex);
  if (n.arm[2] && z >= 0) d = Math.min(d, ex);
  if (n.arm[1] && x >= 0) d = Math.min(d, ez);
  if (n.arm[3] && x < 0) d = Math.min(d, ez);
  const cen = mode === "box" ? Math.max(ex, ez) : Math.hypot(ex + 0.5, ez + 0.5) - 0.5;
  return Math.min(d, cen - (n.dead >= 0 ? bulb : 0));
}

function computeD(n: Net, mode: DMode, bulb = 0): void {
  for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) n.D[idx(x, z)] = distAt(n, x, z, mode, bulb);
}

/** mark driveway apron cells (perpendicular half-width w) outside the carriageway (D >= minD) */
function aprons(n: Net, w: number, minD: number): void {
  for (let k = 0; k < 4; k++) {
    if (!n.drive[k]) continue;
    for (let x = -w; x < w; x++) {
      for (let z = -8; z < 0; z++) {
        const [wx, wz] = rotK(k, x, z);
        const i = idx(wx, wz);
        if (n.D[i] >= minD) n.ap[i] = 1;
      }
    }
  }
}

function forCells(f: (x: number, z: number, i: number) => void): void {
  for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) f(x, z, idx(x, z));
}

/** Is world-space cell free for a prop (outside the travelled surface, no apron, unused)? */
function freeW(n: Net, x: number, z: number, minD: number, maxD = 99): boolean {
  if (!inT(x, z)) return false;
  const i = idx(x, z);
  const d = n.D[i];
  return d >= minD && d < maxD && !n.ap[i] && !n.used[i];
}
/** Same in arm frame k */
function freeK(n: Net, k: number, x: number, z: number, minD: number, maxD = 99): boolean {
  const [wx, wz] = rotK(k, x, z);
  return freeW(n, wx, wz, minD, maxD);
}
function claimK(n: Net, k: number, x: number, z: number, r = 0): void {
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      const [wx, wz] = rotK(k, x + dx, z + dz);
      if (inT(wx, wz)) n.used[idx(wx, wz)] = 1;
    }
  }
}
/** Place a prop in arm frame k at (x,z) if free; returns whether placed */
function propK(n: Net, k: number, x: number, z: number, minD: number, f: (R: PixelVox) => void, r = 0, maxD = 99): boolean {
  if (!freeK(n, k, x, z, minD, maxD)) return false;
  claimK(n, k, x, z, r);
  f(n.R[k]);
  return true;
}

/** first "a" index (distance from centre) where plain arm markings start */
function armStart(n: Net, jh: number): number {
  if (n.straight >= 0) return 0;
  if (n.dead >= 0) return jh;
  return jh;
}

/** deterministic per-cell hash 0..1 (so textures are stable and symmetric where needed) */
function h2(x: number, z: number, s = 0): number {
  let h = Math.imul(x * 374761393 + z * 668265263 + s * 1442695041, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Variant-flavoured props shared by many street types --------------------------------------------

const TREE_BY_VAR: TreeKind[] = ["round", "birch", "oak", "palm"];

function streetLamp(v: PixelVox, x: number, y: number, z: number, vr: number, h = 6, lv = 3): void {
  switch (vr) {
    case 1: // modern LED arm lamp
      v.box(x, y, z, x + 1, y + h, z + 1, "silver");
      v.box(x, y + h, z, x + 1, y + h + 1, z + 1, "silver");
      v.put(x, y + h - 1, z, "screenCyan", 0.9);
      break;
    case 2: // heritage double-globe lamp
      v.box(x, y, z, x + 1, y + 1, z + 1, "black");
      v.box(x, y + 1, z, x + 1, y + h, z + 1, "iron");
      v.put(x, y + h, z, "warmGlow", 1.2);
      v.put(x, y + h + 1, z, "black");
      if (lv >= 4) v.put(x, y + h - 2, z, "gold");
      break;
    case 3: // white coastal lamp
      v.box(x, y, z, x + 1, y + h, z + 1, "white");
      v.put(x, y + h, z, "amber", 1.1);
      v.put(x, y + h + 1, z, "white");
      break;
    default:
      lamp(v, x, y, z, h, "iron", "warmGlow");
  }
}

function streetTree(v: PixelVox, x: number, y: number, z: number, vr: number, size = 1, seed = 0): void {
  tree(v, x, y, z, TREE_BY_VAR[vr], size, seed);
}

// ---------------------------------------------------------------------------------------------
// Generic paved street (roads / two-lane / pretty / sidewalks / walking paths ...)
// ---------------------------------------------------------------------------------------------

interface StreetCfg {
  half: number;
  walk: number;
  raise: boolean;
  mode: DMode;
  bulb: number;
  apronW: number;
  apron: string;
  road: (x: number, z: number, d: number) => string;
  side: (x: number, z: number, d: number) => string;
  verge: (x: number, z: number, d: number) => string;
  kerb?: string;
}

function street(n: Net, cfg: StreetCfg): void {
  const v = n.v;
  computeD(n, cfg.mode, cfg.bulb);
  aprons(n, cfg.apronW, cfg.half);
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < cfg.half) v.put(x, 0, z, cfg.road(x, z, d));
    else if (n.ap[i]) v.put(x, 0, z, cfg.apron);
    else if (d < cfg.walk) {
      if (cfg.raise) {
        v.put(x, 0, z, cfg.kerb ?? "concreteDark");
        v.put(x, 1, z, cfg.side(x, z, d));
      } else v.put(x, 0, z, cfg.side(x, z, d));
    } else v.put(x, 0, z, cfg.verge(x, z, d));
  });
}

function grassVerge(x: number, z: number): string {
  const r = h2(x, z, 7);
  return r < 0.12 ? "grass3" : r < 0.2 ? "grass" : "grass2";
}

/** Zebra crossing + stop bar on arm frame R (half = carriageway half width) */
function crossing(R: PixelVox, half: number, a: number, stop = true, col = "white"): void {
  for (let x = -half; x < half; x++) {
    if (((x + 64) & 1) === 0) R.box(x, 0, -a - 2, x + 1, 1, -a, col);
  }
  if (stop) R.box(-half, 0, -a - 3, 0, 1, -a - 2, col);
}

/** Traffic signal on the right-hand corner of the incoming arm (canonical frame). */
function signal(R: PixelVox, half: number, y0: number, state: number, lv: number, vr: number): void {
  const px = -half - 1;
  const pz = -half - 1;
  const pole = vr === 1 ? "silver" : vr === 3 ? "white" : "iron";
  if (lv <= 1) {
    // stop sign
    R.box(px, y0, pz, px + 1, y0 + 4, pz + 1, "steelLight");
    R.box(px, y0 + 4, pz, px + 1, y0 + 6, pz + 1, "red");
    R.put(px, y0 + 5, pz, "white");
    return;
  }
  const top = y0 + 6;
  R.box(px, y0, pz, px + 1, top, pz + 1, pole);
  R.box(px + 1, top - 1, pz, px + 3, top, pz + 1, pole);
  const hx = px + 2;
  R.box(hx, top - 4, pz, hx + 1, top - 1, pz + 1, "black");
  R.put(hx, top - 2, pz - 1, state === 0 ? "red" : "redDark", state === 0 ? 1.2 : 0);
  R.put(hx, top - 3, pz - 1, state === 1 ? "amber" : "#5a4a20", state === 1 ? 1.2 : 0);
  R.put(hx, top - 4, pz - 1, state === 2 ? "screenGreen" : "#24502f", state === 2 ? 1.2 : 0);
  if (lv >= 3) {
    // pedestrian signal box on the pole
    R.put(px, y0 + 3, pz - 1, state === 2 ? "white" : "orange", 0.8);
  }
  if (lv >= 5) R.put(px, top, pz, "gold");
}

// ---------------------------------------------------------------------------------------------
// ROADS — 2-lane asphalt with white dashes, raised sidewalks, grass verge.
//  V0 Classic (iron lamps, round trees)   V1 Modern (LED arm lamps, birches)
//  V2 Heritage (double-globe lamps, oaks) V3 Coastal (white lamps, palms)
// ---------------------------------------------------------------------------------------------

function buildRoads(c: Ctx): void {
  const n = mkNet(c);
  const { lv, vr } = n;
  const half = 4;
  street(n, {
    half,
    walk: 6,
    raise: true,
    mode: "round",
    bulb: 2,
    apronW: 3,
    apron: "concrete2",
    road: (x, z) => (h2(x, z, 3) < 0.06 ? "asphaltDark" : "asphalt"),
    side: (x, z) => (lv >= 4 && ((x + z) & 3) === 0 ? "concreteDark" : "concrete"),
    verge: grassVerge,
  });
  streetDressing(n, half, 6, "white", lv, vr, { dash: true });
}

interface DressOpts {
  dash?: boolean;
  double?: boolean;
  bike?: boolean;
  noTrees?: boolean;
  roundabout?: boolean;
}

/** markings, signals and street furniture for kerbed city streets (roads, two-lane, pretty roads) */
function streetDressing(n: Net, half: number, walk: number, line: string, lv: number, vr: number, o: DressOpts): void {
  const v = n.v;
  const sy = 2; // top of raised sidewalk
  // Municipal curb patterns run through crossings and terminate at every driveway.
  forCells((x, z, i) => {
    if (n.ap[i] || n.D[i] < half || n.D[i] >= walk) return;
    if (vr === 1 && ((x + z) & 3) === 0) v.put(x, 1, z, "slateLight");
    if (vr === 2) v.put(x, 1, z, ((x >> 1) + z) % 3 ? "brick" : "terracotta");
    if (vr === 3 && (x - z) % 3 === 0) v.put(x, 1, z, "sand");
  });
  if (lv === 1) {
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, walk, -6, walk, R => {
        if (vr === 0) {
          R.box(walk, 1, -6, walk + 1, 3, -5, "red");
          R.put(walk, 3, -6, "iron");
        } else if (vr === 1) {
          R.box(walk, 1, -6, walk + 1, 5, -5, "steelDark");
          R.put(walk, 4, -5, "screenCyan", 0.5);
        } else if (vr === 2) {
          R.box(walk, 1, -6, walk + 1, 4, -5, "stone");
          R.put(walk, 4, -6, "brass");
        } else {
          R.box(walk, 1, -6, walk + 1, 3, -5, "terracotta");
          R.put(walk, 3, -6, "leaf");
        }
      }, 1)) break;
    }
  }
  const a0 = armStart(n, half);
  // ---- markings
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    const jn = n.junction;
    const start = n.dead >= 0 ? 3 : a0;
    if (o.bike) {
      for (let a = jn ? half + 3 : start; a < 8; a++) {
        R.box(-half, 0, -1 - a, -half + 1, 1, -a, "#3f9a5a");
        R.box(half - 1, 0, -1 - a, half, 1, -a, "#3f9a5a");
      }
      if (lv >= 4 && n.straight >= 0) {
        R.put(-half, 0, -5, "white");
        R.put(half - 1, 0, -3, "white");
      }
    }
    if (o.double) {
      for (let a = jn ? half + 3 : start; a < 8; a++) R.box(-1, 0, -1 - a, 1, 1, -a, line);
    } else if (o.dash) {
      for (let a = jn ? half + 3 : start; a < 8; a++) {
        if (a % 4 === 1 || a % 4 === 2) R.box(-1, 0, -1 - a, 1, 1, -a, line);
      }
    }
    if (jn) {
      crossing(R, half, half, true);
      signal(R, half, sy, k % 2 === 0 ? 2 : 0, lv, vr);
    } else if (n.corner >= 0 && lv >= 3) {
      // gentle give-way triangle at the corner arm
      R.put(-2, 0, -6, "white");
    }
  }
  if (n.corner >= 0 && (o.double || o.dash)) {
    // corner centre-line curve
    const [cx, cz] = [0, -1];
    const R = n.R[n.corner];
    if (o.double) R.box(-1, 0, -half - 1 + 1, 1, 1, 1, line);
    R.box(-1, 0, -1, half, 1, 1, line);
    void cx;
    void cz;
  }
  // ---- dead end: cul-de-sac island
  if (n.dead >= 0) {
    const R = n.R[n.dead];
    if (lv >= 2) {
      v.box(-2, 0, -2, 2, 1, 2, "concreteDark");
      v.box(-2, 1, -2, 2, 2, 2, lv >= 4 ? "grass3" : "concrete");
      v.box(-1, 1, -3, 1, 2, 3, lv >= 4 ? "grass3" : "concrete");
      v.box(-3, 1, -1, 3, 2, 1, lv >= 4 ? "grass3" : "concrete");
      if (lv >= 3) streetTree(v, -1, 2, -1, vr, 1, 1);
      if (lv >= 5) for (const [fx, fz] of [[-2, 0], [1, -2], [0, 1]]) v.put(fx, 2, fz, "pink");
    } else {
      v.box(-1, 0, -1, 1, 1, 1, "white");
    }
    // "no through road" sign
    R.box(4, sy, 0, 5, sy + 4, 1, "steelLight");
    R.box(4, sy + 4, 0, 5, sy + 6, 1, "blue");
    R.put(4, sy + 5, 0, "white");
  }
  // ---- driveway kerb ramps get tiny bollards at L4+
  // ---- furniture on straights / corners / junction quadrants
  const lampH = lv >= 4 ? 7 : 6;
  for (let q = 0; q < 4; q++) {
    // canonical NE quadrant cells; sidewalk is d in [half, walk)
    const lampOk = lv >= 2 && (q === 0 || q === 2) && !n.junction;
    if (lampOk) {
      const placed =
        propK(n, q, half + 1, -half - 1 - (q % 2 === 0 ? 1 : 2), half, (R) => streetLamp(R, half + 1, sy, -half - 2 - (q % 2), vr, lampH, lv), 1, walk) ||
        propK(n, q, half + 1, -7, half, (R) => streetLamp(R, half + 1, sy, -7, vr, lampH, lv), 1, walk);
      if (placed && lv >= 5 && vr !== 1) {
        // banner flags on the lamp
        const [bx, bz] = [half + 1, -half - 2 - (q % 2)];
        n.R[q].put(bx + 1, sy + lampH - 2, bz, vr === 2 ? "crimson" : "blue");
        n.R[q].put(bx + 1, sy + lampH - 3, bz, vr === 2 ? "gold" : "white");
      }
    }
    if (lv >= 3 && !o.noTrees) {
      // street trees in the verge
      const tz = q % 2 === 0 ? -3 : -6;
      propK(n, q, walk, tz, walk, (R) => streetTree(R, walk, 1, tz, vr, lv >= 5 ? 1.3 : 1.05, q), 1);
    }
    if (lv >= 4) {
      // hydrant / bin / bench depending on quadrant
      const fx = half + 1;
      const fz = q % 2 === 0 ? -6 : -3;
      propK(n, q, fx, fz, half, (R) => {
        if (q === 0) {
          R.box(fx, sy, fz, fx + 1, sy + 2, fz + 1, "red");
          R.put(fx, sy + 2, fz, "redDark");
        } else if (q === 1) {
          R.box(fx, sy, fz, fx + 1, sy + 2, fz + 1, "leafDark");
          R.put(fx, sy + 2, fz, "charcoal");
        } else if (q === 2) {
          R.box(fx, sy, fz, fx + 1, sy + 1, fz + 1, "wood");
          R.box(fx + 1, sy, fz, fx + 2, sy + 2, fz + 1, "wood");
        } else {
          person(R, fx, sy, fz, ["red", "teal", "yellow", "purple"][vr], "blueDark");
        }
      }, 0, walk);
    }
    if (lv >= 5) {
      // flower planter at the outer corner
      propK(n, q, 6, -7, walk, (R) => {
        R.box(6, 1, -7, 8, 2, -5, vr === 1 ? "concreteDark" : "terracotta");
        R.put(6, 2, -7, ["pink", "yellow", "red", "orange"][vr]);
        R.put(7, 2, -6, ["yellow", "pink", "purple", "white"][vr]);
        R.put(6, 2, -6, "leaf");
        R.put(7, 2, -7, "leafLight");
      }, 1);
    }
  }
  // ---- bus stop on straights at L4+ (variant 0 and 2 tiles)
  if (lv >= 4 && n.straight >= 0 && (vr === 0 || vr === 2)) {
    const k = n.straight === 0 ? 0 : 1;
    if (freeK(n, k, half + 1, 2, half, walk) && freeK(n, k, half + 1, 5, half, walk)) {
      const R = n.R[k];
      claimK(n, k, half + 1, 3, 2);
      R.box(half + 1, sy, 2, half + 2, sy + 4, 3, "steelLight");
      R.box(half + 1, sy, 5, half + 2, sy + 4, 6, "steelLight");
      R.box(half + 1, sy + 1, 3, half + 2, sy + 4, 5, "glass", 0.2);
      R.box(half, sy + 4, 2, half + 2, sy + 5, 6, vr === 0 ? "red" : "teal");
      R.put(half, sy + 3, 2, "busYellow", 0.6);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// TWO-LANE ROADS — wider arterial: double yellow centre, white edge lines, bike lanes at Lv3+.
//  V0 Classic iron lamps   V1 Modern LED   V2 Heritage   V3 Coastal palms
// ---------------------------------------------------------------------------------------------

function buildTwoLane(c: Ctx): void {
  const n = mkNet(c);
  const { lv, vr } = n;
  const half = 5;
  street(n, {
    half,
    walk: 7,
    raise: true,
    mode: "round",
    bulb: 1,
    apronW: 3,
    apron: "concrete2",
    road: (x, z) => (h2(x, z, 5) < 0.05 ? "asphalt" : "asphaltDark"),
    side: (x, z) => (((x * 3 + z) & 3) === 0 ? "concreteDark" : "concrete2"),
    verge: grassVerge,
  });
  // white edge lines along arms (inside the bike lane)
  const a0 = n.junction ? half + 3 : n.dead >= 0 ? 2 : armStart(n, half);
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    for (let a = a0; a < 8; a++) {
      R.put(-half + 1, 0, -1 - a, "white");
      R.put(half - 2, 0, -1 - a, "white");
    }
  }
  streetDressing(n, half, 7, "busYellow", lv, vr, { double: true, bike: lv >= 3 });
}

// ---------------------------------------------------------------------------------------------
// PRETTY ROADS — cobblestone boulevard, brick herringbone sidewalks, flower verge, lamps & trees.
//  V0 Parisian (plane trees, black lamps)   V1 Mediterranean (palms, terracotta pots)
//  V2 Japanese (cherry blossom, stone lanterns)   V3 Victorian (gas lamps, topiary)
//  Lv5 4-way crossings become a roundabout with a fountain.
// ---------------------------------------------------------------------------------------------

function buildPretty(c: Ctx): void {
  const n = mkNet(c);
  const { lv, vr, v } = n;
  const half = 4;
  street(n, {
    half,
    walk: 6,
    raise: true,
    mode: "round",
    bulb: 2,
    apronW: 3,
    apron: "brick2",
    kerb: "granite",
    road: (x, z) => {
      const r = h2(x, z, 11);
      return r < 0.33 ? "granite" : r < 0.66 ? "stone" : "slateLight";
    },
    side: (x, z) => ((((x >> 1) + z) & 3) < 2 ? "brick" : "brick2"),
    verge: (x, z, d) => (d < 7 ? (h2(x, z, 2) < 0.5 ? "leaf" : "leafDark") : grassVerge(x, z)),
  });
  // flower beds in the verge band
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d >= 6 && d < 7 && !n.ap[i] && lv >= 2) {
      const r = h2(x, z, 9);
      if (r < 0.35) v.put(x, 1, z, ["pink", "yellow", "red", "purple"][(vr + Math.floor(r * 12)) % 4]);
      else if (r < 0.5) v.put(x, 1, z, "leafLight");
    }
  });
  // Roundabout at Lv4+ 4-way
  if (n.nArms === 4 && lv >= 4) {
    for (let x = -3; x < 3; x++) {
      for (let z = -3; z < 3; z++) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r < 2.2) v.put(x, 1, z, "marbleShade");
        else if (r < 3.1) v.put(x, 0, z, "brick2");
      }
    }
    v.box(-1, 1, -1, 1, 2, 1, "grass3");
    if (lv >= 5) {
      v.box(-1, 2, -1, 1, 3, 1, "water", 0.2);
      v.box(-1, 3, -1, 0, 5, 0, "marble");
      v.put(-1, 5, -1, "foam", 0.3);
      v.put(0, 2, 0, "foam", 0.3);
      v.put(-1, 6, -1, "gold");
    } else {
      v.put(-1, 2, -1, "pink");
      v.put(0, 2, 0, "yellow");
      v.put(-1, 2, 0, "leafLight");
    }
    for (let k = 0; k < 4; k++) {
      const R = n.R[k];
      // little arrows
      R.put(-2, 0, -4, "white");
      R.put(-3, 0, -5, "white");
    }
  }
  // granite centre seam
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    const s = n.junction ? half + 3 : n.dead >= 0 ? 3 : armStart(n, half);
    for (let a = s; a < 8; a++) if (a % 2 === 0) R.box(-1, 0, -1 - a, 1, 1, -a, "marbleShade");
    if (n.junction && !(n.nArms === 4 && lv >= 4)) crossing(R, half, half, false, "marble");
  }
  // lamps & trees
  const sy = 2;
  const prettyLamp = (R: PixelVox, x: number, z: number) => {
    if (vr === 2) {
      // stone lantern (toro)
      R.box(x, sy, z, x + 1, sy + 2, z + 1, "stone");
      R.put(x, sy + 2, z, "warmGlow", 1.1);
      R.put(x, sy + 3, z, "granite");
    } else {
      const pole = vr === 0 ? "black" : vr === 1 ? "brass" : "iron";
      R.box(x, sy, z, x + 1, sy + 6, z + 1, pole);
      R.put(x, sy + 6, z, "warmGlow", 1.2);
      R.put(x, sy + 7, z, lv >= 5 ? "gold" : pole);
      if (lv >= 4) {
        // hanging flower basket
        R.put(x + 1, sy + 4, z, ["pink", "red", "magenta", "purple"][vr]);
        R.put(x + 1, sy + 5, z, pole);
      }
    }
  };
  const treeKind: TreeKind[] = ["oak", "palm", "blossom", "cypress"];
  for (let q = 0; q < 4; q++) {
    if (q === 0 || q === 2) {
      propK(n, q, half + 1, -half - 2, half, (R) => prettyLamp(R, half + 1, -half - 2), 1, 6) ||
        propK(n, q, half + 1, -7, half, (R) => prettyLamp(R, half + 1, -7), 1, 6);
    }
    if (lv >= 3) {
      const tz = q % 2 === 0 ? -4 : -6;
      propK(n, q, 6, tz, 6, (R) => {
        if (vr === 3) {
          // topiary ball
          R.box(6, 1, tz, 7, 2, tz + 1, "woodDark");
          bush(R, 6, 2, tz, 1.4, "leafDark");
        } else tree(R, 6, 1, tz, treeKind[vr], lv >= 5 ? 1.25 : 1, q + 1);
      }, 1);
    }
    if (lv >= 2 && vr === 1) propK(n, q, 7, -7, 6, (R) => {
      R.box(7, 1, -7, 8, 2, -6, "terracotta");
      R.put(7, 2, -7, "leafLight");
    });
    if (lv >= 4) propK(n, q, half + 1, -4, half, (R) => bench(R, half + 1, sy, -5, "z", vr === 3 ? "black" : "woodDark"), 1, 6);
  }
  if (n.dead >= 0) {
    // circular plaza with statue at the turnaround
    v.box(-2, 1, -2, 2, 2, 2, "marbleShade");
    v.box(-1, 2, -1, 1, 3 + Math.min(3, lv), 1, lv >= 5 ? "gold" : "marble");
    v.put(-1, 3 + Math.min(3, lv), -1, "copper");
  }
}

// ---------------------------------------------------------------------------------------------
// DIRT ROADS — wheel ruts in packed earth, ragged grass edges, rural props.
//  V0 Farm (split-rail fence, haybales)   V1 Prairie (wire fence, cattle grid, sunflowers)
//  V2 English Lane (dry-stone walls, hedgerows)   V3 Autumn (orange trees, pumpkins)
// ---------------------------------------------------------------------------------------------

function buildDirt(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "arc", 1);
  aprons(n, 2, 3);
  const dirt = ["#b8905c", "#c49d6d", "#988677", "#a77348"][vr];
  forCells((x, z, i) => {
    const d = n.D[i];
    const r = h2(x, z, 21);
    if (d < 3 || (d < 4 && r < 0.35) || n.ap[i]) {
      let col = r < 0.15 ? "#a5804f" : dirt;
      if (lv >= 4 && r > 0.75) col = "concreteDark"; // gravel topping
      v.put(x, 0, z, col);
    } else v.put(x, 0, z, d < 5 && r < 0.3 ? "olive" : grassVerge(x, z));
    if (lv === 1 && d > 5 && r < 0.035) {
      if (vr === 1) v.box(x, 1, z, x + 1, 3, z + 1, "grass3");
      if (vr === 2) v.put(x, 1, z, "stone");
      if (vr === 3) v.put(x, 1, z, "orange");
    }
  });
  // ruts: cells at perpendicular offset 1 from centre-line on each side (x = -2 and 1)
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d === 1 && !n.ap[i]) v.put(x, 0, z, h2(x, z, 4) < 0.25 ? "#7a5232" : "soil");
  });
  // puddle
  if (n.straight >= 0 && vr !== 1) {
    const R = n.R[n.straight === 0 ? 0 : 1];
    R.box(-2, 0, 2, -1, 1, 4, "water", 0.1);
  }
  // Fences / walls / hedges along the verge at d = 6..7
  if (lv >= 2) {
    forCells((x, z, i) => {
      const d = n.D[i];
      if (d !== 6 || n.ap[i]) return;
      if (vr === 2) {
        if (lv >= 5) v.box(x, 1, z, x + 1, 3, z + 1, h2(x, z, 1) < 0.3 ? "leaf" : "leafDark");
        else v.box(x, 1, z, x + 1, 2, z + 1, h2(x, z, 1) < 0.5 ? "stone" : "granite");
      } else if (vr === 1) {
        if (((x + z) & 3) === 0) v.box(x, 1, z, x + 1, 4, z + 1, "woodDark");
        else v.put(x, 3, z, "steelDark");
      } else {
        if (((x ^ z) & 3) === 0) v.box(x, 1, z, x + 1, 4, z + 1, "woodDark");
        else {
          v.put(x, 2, z, "wood");
          v.put(x, 3, z, "woodLight");
        }
      }
    });
  }
  // props in the free corners
  for (let q = 0; q < 4; q++) {
    if (lv >= 3) {
      propK(n, q, 4, -5, 4, (R) => {
        if (vr === 3) {
          R.box(4, 1, -5, 6, 2, -3, "orange");
          R.put(4, 2, -5, "leafDark");
        } else if (vr === 1) {
          // sunflowers
          for (const [sx, sz] of [[4, -5], [5, -4]]) {
            R.box(sx, 1, sz, sx + 1, 4, sz + 1, "leaf");
            R.put(sx, 4, sz, "yellow");
          }
        } else {
          // round hay bale
          R.box(4, 1, -5, 6, 3, -3, "yellow");
          R.box(4, 1, -4, 6, 3, -4, "busYellow");
        }
      }, 1, 6);
    }
    if (lv >= 5 && q % 2 === 0) {
      propK(n, q, 6, -7, 6, (R) => tree(R, 7, 1, -7, vr === 3 ? "autumn" : vr === 1 ? "birch" : "oak", 1.1, q), 1);
    }
    if (lv >= 4 && q === 1) {
      // lantern post
      propK(n, q, 4, -7, 4, (R) => {
        R.box(4, 1, -7, 5, 5, -6, "woodDark");
        R.put(4, 5, -7, "warmGlow", 1.1);
      }, 0, 6);
    }
  }
  // wildflowers at L5
  if (lv >= 5) {
    forCells((x, z, i) => {
      const d = n.D[i];
      if (d >= 4 && d < 6 && h2(x, z, 33) < 0.18 && !n.ap[i]) v.put(x, 1, z, ["pink", "yellow", "white", "purple"][Math.floor(h2(x, z, 34) * 4)]);
    });
  }
  // signpost at junctions
  if (n.junction || (n.dead >= 0 && lv >= 2)) {
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, 4, -4, 4, (R) => {
        R.box(4, 1, -4, 5, 6, -3, "woodDark");
        R.box(2, 5, -4, 7, 6, -3, "wood");
        R.box(4, 4, -6, 5, 5, -1, "woodLight");
      }, 1, 6)) break;
    }
  }
  // farm cart at L4 on straights
  if (lv >= 4 && n.straight >= 0 && vr !== 2) {
    const k = n.straight === 0 ? 0 : 1;
    propK(n, k, 4, 1, 4, (R) => {
      R.box(4, 2, 0, 6, 3, 4, "wood");
      R.box(4, 3, 0, 6, 4, 1, "woodDark");
      R.put(3, 1, 1, "woodDark");
      R.put(6, 1, 1, "woodDark");
      R.put(4, 3, 2, "orange");
      R.put(5, 3, 3, "red");
    }, 2, 7);
  }
}

// ---------------------------------------------------------------------------------------------
// PATHS — stepping stones through a lawn.
//  V0 Cottage (limestone & flowers)   V1 Zen (grey stones in raked gravel, bamboo)
//  V2 Woodland (log-round steppers, mushrooms)   V3 Seaside (white stones in sand, shells)
// ---------------------------------------------------------------------------------------------

function buildPaths(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "arc", 0);
  aprons(n, 1, 2);
  const stone = ["limestone", "slateLight", "oak", "white"][vr];
  const stone2 = ["path", "stone", "wood", "marble"][vr];
  const bed = ["grass2", "path2", "grass2", "sand"][vr];
  forCells((x, z, i) => {
    const d = n.D[i];
    if (vr === 1 && d < 3) v.put(x, 0, z, ((x + z) & 1) === 0 || d >= 2 ? "path2" : "path");
    else if (vr === 3 && d < 3) v.put(x, 0, z, h2(x, z) < 0.5 ? "sand" : "sandDark");
    else v.put(x, 0, z, grassVerge(x, z));
    void bed;
  });
  const step = (R: PixelVox, x: number, z: number, big: boolean) => {
    const raised = lv >= 2 ? 1 : 0;
    R.box(x, raised, z, x + 2, raised + 1, z + 2, stone);
    if (big) R.put(x + 1, raised, z + 1, stone2);
    if (vr === 2) R.put(x, raised, z, "woodDark");
  };
  if (n.corner >= 0) {
    // stones along the arc
    const R = n.R[n.corner];
    const pts: [number, number][] = [[-1, -7], [0, -4], [2, -2], [4, 0], [6, -1]];
    for (const [px, pz] of pts) step(R, px, pz, true);
  } else {
    for (let k = 0; k < 4; k++) {
      if (!n.arm[k]) continue;
      const R = n.R[k];
      step(R, -2, -3, lv >= 3);
      step(R, 0, -7, lv >= 3);
    }
    if (n.dead < 0 || true) step(v, -1, -1, true);
  }
  for (let k = 0; k < 4; k++) {
    if (!n.drive[k]) continue;
    const R = n.R[k];
    R.box(-1, 0, -7, 1, 1, -5, stone);
  }
  if (n.dead >= 0) {
    // birdbath / sundial at the end
    const R = n.R[(n.dead + 2) % 4];
    R.box(-1, 1, -5, 0, 3, -4, "marble");
    R.box(-2, 3, -6, 1, 4, -3, "marbleShade");
    R.put(-1, 3, -5, vr === 1 ? "slate" : "water", 0.1);
  }
  // borders: flowers, lanterns, hedges, rose arch
  forCells((x, z, i) => {
    const d = n.D[i];
    if (n.ap[i]) return;
    if (lv >= 2 && d >= 3 && d < 4) {
      const r = h2(x, z, 5);
      if (vr === 0 && r < 0.6) v.put(x, 1, z, r < 0.3 ? ["pink", "yellow", "purple"][Math.floor(r * 10) % 3] : "leafLight");
      if (vr === 1 && r < 0.2) v.put(x, 1, z, "moss");
      if (vr === 2 && r < 0.12) {
        v.put(x, 1, z, "white");
        v.put(x, 2, z, "red");
      }
      if (vr === 3 && r < 0.2) v.put(x, 1, z, r < 0.08 ? "pink" : "white");
    }
    if (lv >= 4 && d >= 4 && d < 5 && vr !== 3) {
      if (vr === 1) {
        if (h2(x, z, 8) < 0.4) v.box(x, 1, z, x + 1, 5, z + 1, "lime");
      } else v.box(x, 1, z, x + 1, 3, z + 1, vr === 2 ? "moss" : "leafDark");
    }
  });
  for (let q = 0; q < 4; q++) {
    if (lv >= 3) {
      propK(n, q, 3, -6, 3, (R) => {
        if (vr === 1) {
          R.box(3, 1, -6, 4, 3, -5, "stone");
          R.put(3, 3, -6, "warmGlow", 1);
          R.box(3, 4, -6, 4, 5, -5, "slate");
        } else if (vr === 2) {
          R.box(3, 1, -6, 4, 2, -5, "white");
          R.put(3, 2, -6, "red");
          R.put(3, 2, -5, "white");
        } else {
          R.box(3, 1, -6, 4, 3, -5, vr === 3 ? "white" : "iron");
          R.put(3, 3, -6, "warmGlow", 1.1);
        }
      }, 0, 5);
    }
    if (lv >= 4) propK(n, q, 6, -6, 5, (R) => {
      if (vr === 3) tree(R, 6, 1, -6, "palm", 1, q);
      else if (vr === 1) tree(R, 6, 1, -6, "pine", 1, q);
      else bush(R, 6, 1, -6, 1.5, "leaf", ["pink", "red", "yellow", "white"][q]);
    }, 1);
  }
  // Rose arch (Lv5) over a straight
  if (lv >= 5 && n.straight >= 0) {
    const R = n.R[n.straight === 0 ? 0 : 1];
    const col = vr === 1 ? "red" : vr === 2 ? "woodDark" : "white";
    R.box(-4, 1, -1, -3, 7, 1, col);
    R.box(2, 1, -1, 3, 7, 1, col);
    R.box(-4, 7, -1, 3, 8, 1, col);
    if (vr !== 1) {
      for (let x = -4; x < 3; x++) if (h2(x, 1) < 0.6) R.put(x, 8, h2(x, 2) < 0.5 ? -1 : 0, h2(x, 3) < 0.5 ? "pink" : "leaf");
      R.put(-4, 5, 1, "pink");
      R.put(2, 4, -2, "red");
    } else {
      R.box(-5, 6, -1, 4, 7, 1, "red");
    }
  }
}

// ---------------------------------------------------------------------------------------------
// WALKING PATHS — gravel footpath with stone edging, lamps, benches, flowerbeds, pergolas.
//  V0 Park (green lamps, wood benches)   V1 Promenade (white lamps, marble)
//  V2 Rustic (wooden lamps, log benches)  V3 Modern (bollard lights, concrete benches)
// ---------------------------------------------------------------------------------------------

function buildWalking(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "arc", 1);
  aprons(n, 2, 3);
  const edge = ["limestone", "marble", "woodDark", "concreteDark"][vr];
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < 3 || n.ap[i]) v.put(x, 0, z, h2(x, z, 6) < 0.25 ? "path2" : "path");
    else if (d < 4) {
      v.put(x, 0, z, "grass2");
      v.put(x, 1, z, edge);
    } else v.put(x, 0, z, grassVerge(x, z));
  });
  // break edging where aprons cross
  forCells((x, z, i) => {
    if (n.ap[i]) v.put(x, 1, z, null);
  });
  const lampF = (R: PixelVox, x: number, z: number) => {
    if (vr === 3) {
      R.box(x, 1, z, x + 1, 3, z + 1, "charcoal");
      R.put(x, 3, z, "screenCyan", 0.9);
    } else if (vr === 2) {
      R.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
      R.put(x, 5, z, "woodDark");
      R.put(x, 4, z - 1, "warmGlow", 1.1);
    } else {
      R.box(x, 1, z, x + 1, 6, z + 1, vr === 0 ? "leafDark" : "white");
      R.put(x, 6, z, "warmGlow", 1.2);
      R.put(x, 7, z, vr === 0 ? "leafDark" : "white");
    }
  };
  const benchF = (R: PixelVox, x: number, z: number) => {
    if (vr === 2) {
      R.box(x, 1, z, x + 1, 2, z + 3, "oak");
    } else if (vr === 3) {
      R.box(x, 1, z, x + 1, 2, z + 3, "concrete");
    } else bench(R, x, 1, z, "z", vr === 1 ? "marble" : "wood");
  };
  for (let q = 0; q < 4; q++) {
    if (lv >= 3 && q % 2 === 0) {
      if (freeK(n, q, 5, -5, 4) && freeK(n, q, 5, -3, 4)) {
        claimK(n, q, 4, -4, 1);
        benchF(n.R[q], 5, -5);
        if (lv >= 4) person(n.R[q], 4, 1, -4, ["red", "teal", "yellow", "pink"][vr]);
      }
    }
    if (lv >= 2) propK(n, q, 4, q % 2 ? -3 : -7, 4, (R) => lampF(R, 4, q % 2 ? -3 : -7), 1, 7) || propK(n, q, 4, -1, 4, (R) => lampF(R, 4, -1), 1, 7);
    if (lv >= 4) {
      propK(n, q, 6, -7, 5, (R) => {
        R.box(5, 0, -8, 8, 1, -5, "soil");
        for (let x = 5; x < 8; x++) for (let z = -8; z < -5; z++) if (h2(x, z, q) < 0.7) R.put(x, 1, z, ["pink", "yellow", "red", "purple", "white"][Math.floor(h2(x, z, 9) * 5)]);
      }, 1);
    }
    if (lv >= 5 && q % 2 === 1) propK(n, q, 6, -4, 6, (R) => tree(R, 6, 1, -4, vr === 2 ? "autumn" : vr === 3 ? "birch" : "blossom", 1.1, q), 1);
  }
  // pergola over straights at Lv5
  if (lv >= 5 && n.straight >= 0) {
    const R = n.R[n.straight === 0 ? 0 : 1];
    const pc = vr === 1 ? "marble" : vr === 3 ? "charcoal" : "woodDark";
    for (const pz of [-7, -1, 5]) {
      R.box(-4, 1, pz, -3, 7, pz + 1, pc);
      R.box(3, 1, pz, 4, 7, pz + 1, pc);
    }
    for (let z = -8; z < 8; z += 2) R.box(-5, 7, z, 5, 8, z + 1, pc);
    R.box(-4, 8, -8, -3, 9, 8, "leaf");
    R.box(3, 8, -8, 4, 9, 8, "leaf");
    for (let z = -8; z < 8; z++) if (h2(z, 4) < 0.4) R.put(h2(z, 5) < 0.5 ? -4 : 3, 6, z, vr === 0 ? "purple" : "pink");
  }
}

// ---------------------------------------------------------------------------------------------
// TRAILS — earthen forest trail with roots & pebble border through woodland.
//  V0 Pine forest   V1 Birch woods   V2 Autumn maples   V3 Jungle (palms, ferns)
// ---------------------------------------------------------------------------------------------

function buildTrails(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "arc", 0);
  aprons(n, 1, 2);
  const floor = ["moss", "grass2", "olive", "leafDark"][vr];
  forCells((x, z, i) => {
    const d = n.D[i];
    const r = h2(x, z, 13);
    if (d < 2 || n.ap[i]) v.put(x, 0, z, r < 0.3 ? "soilDark" : "soil");
    else if (d < 3) {
      v.put(x, 0, z, r < 0.5 ? "soil" : floor);
      if (r < 0.3) v.put(x, 1, z, r < 0.15 ? "stone" : "granite");
    } else v.put(x, 0, z, r < 0.35 ? floor : r < 0.45 && vr === 2 ? "orange" : "grass2");
  });
  // roots crossing the trail
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k] || n.corner >= 0) continue;
    const R = n.R[k];
    R.box(-2, 0, -6, 2, 1, -5, "woodDark");
    if (lv >= 3) {
      // log steps
      R.box(-2, 1, -3, 2, 2, -2, "oak");
      R.put(-2, 1, -3, "wood");
    }
  }
  const kinds: TreeKind[] = ["pine", "birch", "autumn", "palm"];
  // forest: trees in free quadrants, more and bigger with level
  const spots: [number, number][] = [[6, -6], [7, -2], [3, -7]];
  for (let q = 0; q < 4; q++) {
    const cnt = lv >= 3 ? 2 : 1;
    for (let s = 0; s < cnt; s++) {
      const [tx, tz] = spots[(s + q) % spots.length];
      propK(n, q, tx, tz, 5, (R) => tree(R, tx, 1, tz, kinds[vr], (lv >= 5 && s === 0 && q % 2 === 0 ? 1.7 : 0.8 + lv * 0.06) + h2(tx, q) * 0.2, q + s), 1);
    }
    // ferns / mushrooms
    propK(n, q, 3, -4, 3, (R) => {
      if (vr === 3 || vr === 0) bush(R, 3, 1, -4, 1, vr === 3 ? "leafLight" : "leafDark");
      else {
        R.put(3, 1, -4, "white");
        R.put(3, 2, -4, "red");
      }
    }, 0, 5);
  }
  if (lv >= 2) {
    // signpost
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, 3, -3, 3, (R) => {
        R.box(3, 1, -3, 4, 6, -2, "woodDark");
        R.box(3, 5, -4, 4, 6, -1, "wood");
        R.put(3, 4, -3, ["yellow", "white", "orange", "red"][vr]);
      }, 0, 5)) break;
    }
  }
  if (lv >= 4) {
    for (let q = 1; q < 4; q += 2) {
      propK(n, q, 3, -6, 3, (R) => R.box(3, 1, -6, 4, 2, -3, "oak"), 1, 5); // fallen-log bench
    }
  }
  if (lv >= 5) {
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, 6, -6, 5, (R) => {
        // stone cairn + lantern
        R.box(6, 1, -6, 8, 2, -4, "stone");
        R.box(6, 2, -6, 7, 3, -5, "granite");
        R.put(6, 3, -6, "stone");
        R.put(7, 2, -5, "warmGlow", 1.1);
      }, 1)) break;
    }
  }
  if (n.dead >= 0) {
    // lookout / ranger notice board at the trail head
    const R = n.R[(n.dead + 2) % 4];
    R.box(-3, 1, -4, -2, 5, -3, "woodDark");
    R.box(1, 1, -4, 2, 5, -3, "woodDark");
    R.box(-3, 4, -4, 2, 6, -3, "wood");
    R.box(-2, 4, -5, 1, 6, -4, ["leafDark", "white", "orange", "leaf"][vr]);
  }
}

// ---------------------------------------------------------------------------------------------
// SIDEWALKS — wide paved pedestrian esplanade with joint grid, planters & benches.
//  V0 Urban (concrete planters)   V1 Garden (wooden planters, flowers)
//  V2 Modern (steel & glass, LED bollards)   V3 Plaza (terracotta pots, café umbrellas)
// ---------------------------------------------------------------------------------------------

function buildSidewalks(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const half = 5;
  street(n, {
    half,
    walk: 6,
    raise: true,
    mode: "box",
    bulb: 1,
    apronW: 3,
    apron: "concrete",
    kerb: "concreteDark",
    road: (x, z) => {
      const jx = ((x + 64) & 3) === 0;
      const jz = ((z + 64) & 3) === 0;
      return jx || jz ? "concrete2" : "concrete";
    },
    side: () => "granite",
    verge: grassVerge,
  });
  const sy = 1;
  const planter = (R: PixelVox, x: number, z: number, lvl: number) => {
    const col = ["concreteDark", "wood", "steel", "terracotta"][vr];
    R.box(x, sy, z, x + 2, sy + 1, z + 2, col);
    if (lvl >= 4 && vr !== 3) tree(R, x, sy + 1, z, vr === 2 ? "birch" : "round", 0.9, x);
    else bush(R, x, sy + 1, z, 1.1, vr === 3 ? "leafLight" : "leaf", lvl >= 2 ? ["red", "pink", "yellow", "orange"][vr] : undefined);
  };
  const cell: [number, number][] = [[2, -6], [-4, -6]];
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k] || n.junction) continue;
    if (n.corner >= 0 && k === n.corner) continue;
    const R = n.R[k];
    if (lv >= 2) {
      const [px, pz] = cell[(k + vr) % 2];
      planter(R, px, pz, lv);
    }
  }
  // benches / lamps / bike racks
  for (let q = 0; q < 4; q++) {
    propK(n, q, 6, -7, 6, (R) => {
      if (vr === 2) {
        R.box(6, 1, -7, 7, 3, -6, "charcoal");
        R.put(6, 3, -7, "screenCyan", 1);
      } else {
        R.box(6, 1, -7, 7, 2, -6, "granite");
        R.put(6, 2, -7, "concreteDark");
      }
    }, 0);
    if (lv >= 3) propK(n, q, 5, -3, 5, (R) => streetLamp(R, 5, 2, -3, vr === 3 ? 2 : vr, 6, lv), 0, 6);
    if (lv >= 2) propK(n, q, 7, -5, 6, (R) => {
      if (vr === 3) {
        // café table w/ umbrella
        R.box(7, 1, -5, 8, 4, -4, "white");
        R.box(6, 4, -6, 9, 5, -3, ["red", "teal", "yellow", "orange"][q]);
      } else bush(R, 7, 1, -5, 1.1, "leafDark");
    }, 1);
  }
  if (n.straight >= 0 && lv >= 3) {
    const R = n.R[n.straight === 0 ? 0 : 1];
    if (vr === 3) {
      R.box(2, 1, 1, 3, 4, 2, "white");
      R.box(1, 4, 0, 4, 5, 3, "red");
      R.put(1, 4, 0, "white");
      R.put(3, 4, 2, "white");
      R.box(3, 1, 1, 4, 2, 2, "woodDark");
    } else {
      R.box(-4, sy, 1, -3, sy + 1, 4, vr === 2 ? "steel" : "wood");
      if (lv >= 4) person(R, 2, sy, 3, ["blue", "pink", "orange", "red"][vr]);
    }
    if (lv >= 4) {
      // bike rack
      for (let z = -6; z < -2; z += 2) R.box(3, sy, z, 4, sy + 2, z + 1, "steelLight");
      R.put(3, sy, -5, ["red", "blue", "yellow", "teal"][vr]);
    }
  }
  if (n.junction || (n.dead >= 0 && lv >= 3)) {
    // central feature: fountain / sculpture / clock
    if (lv >= 5) {
      v.box(-3, 1, -3, 3, 2, 3, "granite");
      v.box(-2, 1, -2, 2, 2, 2, "water", 0.25);
      v.box(-1, 1, -1, 1, 4, 1, vr === 3 ? "terracotta" : "marble");
      v.put(0, 5, 0, "foam", 0.4);
      v.put(-1, 4, -1, "foam", 0.4);
    } else if (lv >= 3) {
      v.box(-1, 1, -1, 1, 2, 1, "granite");
      v.box(-1, 2, -1, 0, 6, 0, "iron");
      v.box(-1, 6, -2, 0, 8, 1, "white", 0.3);
      v.put(-1, 7, -2, "black");
    } else {
      v.box(-1, 0, -1, 1, 1, 1, ["concreteDark", "brick", "slateLight", "terracotta"][vr]);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// HIGHWAYS (4-lane, concrete median) and FREEWAYS (6-lane, jersey barriers, gantries)
//  V0 Green signs & pines   V1 Blue signs & palms   V2 Brown scenic signs & rocks   V3 Urban
// ---------------------------------------------------------------------------------------------

function buildMotorway(c: Ctx, free: boolean): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "box", 1);
  aprons(n, 3, 7);
  const asphalt = free ? "asphaltDark" : "asphalt";
  const glow = lv >= 5 ? 0.6 : 0;
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < 7) v.put(x, 0, z, h2(x, z, 17) < 0.05 ? "slate" : asphalt);
    else if (n.ap[i]) v.put(x, 0, z, "concrete2");
    else v.put(x, 0, z, free ? "concreteDark" : h2(x, z) < 0.5 ? "grass3" : "grass2");
  });
  const sign = ["leafDark", "blue", "woodDark", "tealDark"][vr];
  if (free && n.straight >= 0) {
    // Compact distance marker, twin reflective paddles, scenic shield or urban call box.
    const R = n.R[n.straight];
    R.box(7, 2, -5, 8, 5, -4, vr === 2 ? "oak" : "steelDark");
    if (vr === 0) R.box(7, 4, -6, 8, 6, -3, sign);
    if (vr === 1) for (const z of [-6, -4]) R.box(7, 4, z, 8, 7, z + 1, "white", 0.3);
    if (vr === 2) {
      R.box(7, 4, -6, 8, 6, -3, sign);
      R.put(7, 6, -5, "brass");
    }
    if (vr === 3) {
      R.box(6, 3, -5, 8, 7, -3, "orange");
      R.put(6, 5, -3, "screenCyan", 0.9);
    }
  }
  const lineW = lv >= 5 ? "screenCyan" : "white";
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    const s = n.straight >= 0 ? 0 : n.dead >= 0 ? 3 : 7;
    for (let a = s; a < 8; a++) {
      const z = -1 - a;
      // median
      if (free) {
        R.box(-1, 0, z, 1, 1, z + 1, "concrete");
        R.box(-1, 1, z, 1, 2, z + 1, "concrete");
        R.box(-1, 2, z, 1, 3, z + 1, a % 2 === 0 ? "busYellow" : "concrete", a % 2 === 0 ? glow : 0);
      } else {
        R.box(-1, 0, z, 1, 1, z + 1, "concreteDark");
        R.box(-1, 1, z, 1, 2, z + 1, lv >= 2 ? "concrete" : "grass3");
        if (lv >= 2 && a % 4 === 2) {
          R.put(-1, 1, z, "red", 0.4);
          R.put(0, 1, z, "red", 0.4);
        }
      }
      R.put(-2, 0, z, "busYellow", glow);
      R.put(1, 0, z, "busYellow", glow);
      // lane lines
      if (free) {
        if (a % 4 < 2) {
          R.put(-4, 0, z, lineW, glow);
          R.put(3, 0, z, lineW, glow);
        }
        if (a % 4 >= 2) {
          R.put(-6, 0, z, lineW, glow);
          R.put(5, 0, z, lineW, glow);
        }
      } else if (a % 4 < 2) {
        R.put(-5, 0, z, lineW, glow);
        R.put(4, 0, z, lineW, glow);
      }
      R.put(-7, 0, z, "white", glow);
      R.put(6, 0, z, "white", glow);
      // outer barrier / guard rail on the shoulder
      if (free) {
        R.box(-8, 0, z, -7, 2, z + 1, "concrete");
        R.box(7, 0, z, 8, 2, z + 1, "concrete");
        if (lv >= 4) {
          // sound wall
          R.box(-8, 2, z, -7, 6, z + 1, a % 4 === 0 ? "concreteDark" : vr === 3 ? "glass" : "#8fb0a8", vr === 3 ? 0.15 : 0);
          R.box(7, 2, z, 8, 6, z + 1, a % 4 === 0 ? "concreteDark" : vr === 3 ? "glass" : "#8fb0a8", vr === 3 ? 0.15 : 0);
          if (lv >= 5) {
            R.put(-8, 6, z, "screenCyan", 0.8);
            R.put(7, 6, z, "screenCyan", 0.8);
          }
        }
      } else if (lv >= 2) {
        if (a % 3 === 0) {
          R.box(-8, 1, z, -7, 2, z + 1, "steelDark");
          R.box(7, 1, z, 8, 2, z + 1, "steelDark");
        }
        R.put(-8, 2, z, "steelLight");
        R.put(7, 2, z, "steelLight");
      }
    }
    if (n.junction || n.corner >= 0) {
      // stop line / chevrons at the junction mouth
      R.box(-7, 0, -8, -2, 1, -7, "white");
    }
  }
  // dead end: turnaround loop with chevron barrier
  if (n.dead >= 0) {
    const R = n.R[n.dead];
    R.box(-6, 1, 4, 6, 3, 5, "white");
    for (let x = -6; x < 6; x += 2) R.box(x, 1, 4, x + 1, 3, 5, "red", 0.3);
    R.box(-1, 0, -2, 1, 1, 2, "concreteDark");
  }
  // junction box chevrons
  if (n.junction || n.corner >= 0) {
    for (let x = -3; x < 3; x++) if (((x + 64) & 1) === 0) v.put(x, 0, x, "busYellow");
  }
  // overhead gantry on straights (freeways all levels >=3, highways >=4)
  const gantryLv = free ? 3 : 4;
  if (n.straight >= 0 && lv >= gantryLv) {
    const R = n.R[n.straight === 0 ? 0 : 1];
    const top = free ? 11 : 9;
    R.box(-8, 1, 0, -7, top, 1, "steel");
    R.box(7, 1, 0, 8, top, 1, "steel");
    R.box(-8, top - 1, 0, 8, top, 1, "steelLight");
    R.box(-6, top - 4, 1, -1, top - 1, 2, sign);
    R.box(1, top - 4, 1, 6, top - 1, 2, free ? "blue" : sign);
    R.box(-5, top - 3, 2, -2, top - 2, 2 + 1, "white", 0.5);
    R.box(2, top - 3, 2, 5, top - 2, 3, "white", 0.5);
    if (lv >= 5) {
      R.box(-6, top - 4, 2, -1, top - 3, 3, "amber", 1.0);
      R.box(1, top - 4, 2, 6, top - 3, 3, "screenGreen", 0.9);
    }
  }
  // high-mast / median lights
  if (lv >= (free ? 2 : 3) && (n.straight >= 0 || n.dead >= 0)) {
    const k = n.straight >= 0 ? (n.straight === 0 ? 0 : 1) : n.dead;
    const R = n.R[k];
    const lz = n.dead >= 0 ? -6 : -5;
    const h = free ? 13 : 9;
    R.box(-1, 2, lz, 0, h, lz + 1, "steel");
    R.box(-4, h, lz, 4, h + 1, lz + 1, "steelLight");
    R.put(-4, h - 1, lz, "warmGlow", 1.3);
    R.put(3, h - 1, lz, "warmGlow", 1.3);
    if (free && lv >= 3) {
      R.box(-3, h + 1, lz, 3, h + 2, lz + 1, "steelLight");
      R.put(-3, h, lz, "warmGlow", 1.3);
      R.put(2, h, lz, "warmGlow", 1.3);
    }
  }
  // Junction crossheads grow with traffic capacity. The structure sits beyond the running lanes.
  if (n.junction) {
    const R = n.R[n.arm.findIndex(Boolean)];
    const top = free ? 10 : 8;
    R.box(7, 1, -7, 8, top + 1, -6, "steel");
    R.box(lv >= 3 ? -7 : 1, top, -7, 8, top + 1, -6, "steel");
    R.put(2, top - 1, -7, "red", 1.1);
    R.put(4, top - 1, -7, "screenGreen", 1.1);
    if (lv >= 2) {
      R.box(6, top + 1, -7, 8, top + 2, -6, "silver");
      R.put(6, top, -6, "warmGlow", 1);
    }
    if (lv >= 3) {
      R.box(-8, 1, -7, -7, top + 1, -6, "steel");
      R.box(-6, top - 2, -7, -1, top + 1, -6, sign);
      R.box(-5, top - 1, -6, -2, top, -5, "white");
    }
    if (lv >= 4) {
      R.box(-6, top + 1, -7, 6, top + 3, -6, lv === 5 ? "black" : "steelDark");
      for (let x = -5; x < 6; x += 2) R.put(x, top + 1, -6, lv === 5 ? "screenGreen" : "amber", 0.9);
    }
    if (lv === 5) {
      solarRow(R, -6, 6, top + 3, -7);
      R.put(7, top + 1, -7, "screenCyan", 1.2);
    }
  }
  // roadside props in non-arm verge (only highways have a verge)
  if (!free) {
    const kinds: TreeKind[] = ["pine", "palm", "pine", "round"];
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, 7, -7, 7, (R) => {
        if (vr === 2) rocks(n.c, 7, 1, -7, 2);
        else tree(R, 7, 1, -7, kinds[vr], 0.9, q);
      }, 0)) continue;
    }
    // roadside sign on straights
    if (n.straight >= 0 && lv >= 1) {
      const R = n.R[n.straight === 0 ? 0 : 1];
      R.box(7, 2, 3, 8, 6, 4, "steel");
      R.box(7, 5, 1, 8, 8, 6, sign);
      R.box(7, 6, 2, 8, 7, 5, "white", 0.3);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Elevated / sunken deck geometry
// ---------------------------------------------------------------------------------------------

interface DeckInfo {
  /** height for each cell */
  H: Int8Array;
  /** grade-separated crossing: elevated axis (0 = N-S, 1 = E-W) or -1 */
  sep: number;
  full: number;
}

/**
 * Deck heights.  Straight pieces slope across the whole tile toward ramp sides; junctions keep the
 * centre at full height and slope ramp arms within their half.  A tile whose ramp arms are all on one
 * axis while elevated arms are on the other becomes a grade-separated crossing.
 */
function deckH(n: ReturnType<typeof networkLayout>, full: number): DeckInfo {
  const H = new Int8Array(256);
  const sep = separatedDeckAxis(n.mask);
  forCells((x, z, i) => {
    let h = full;
    if (sep >= 0) h = full;
    else if (n.straight >= 0 || n.lonely) {
      const ax = n.straight === 1 ? 1 : 0;
      const p = ax === 0 ? z : x; // -8..7
      const rm = ax === 0 ? n.ramp[0] : n.ramp[3];
      const rp = ax === 0 ? n.ramp[2] : n.ramp[1];
      const fromMinus = p + 8; // 0..15
      const fromPlus = 7 - p; // 15..0
      if (rm && rp) h = Math.round(full * Math.min(1, (Math.min(fromMinus, fromPlus) + 0.5) / 6));
      else if (rm) h = Math.round((full * (fromMinus + 0.5)) / 16);
      else if (rp) h = Math.round((full * (fromPlus + 0.5)) / 16);
    } else {
      for (let k = 0; k < 4; k++) {
        if (!n.ramp[k]) continue;
        const [cx, cz] = rotK(4 - k, x, z);
        if (cz < 0 && Math.abs(cx + 0.5) < 7) {
          const a = -1 - cz; // 0..7
          h = Math.min(h, Math.round(full * (1 - (a + 0.5) / 8)));
        }
      }
    }
    H[i] = Math.max(0, h);
  });
  return { H, sep, full };
}

/** Ground below an elevated deck: water + foam ripples when over water, otherwise grass & shrubs */
function underGround(n: Net): void {
  const v = n.v;
  forCells((x, z) => {
    if (n.water) v.put(x, 0, z, "water", 0.08);
    else v.put(x, 0, z, grassVerge(x, z));
  });
  if (n.water) {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(h2(i, 3) * 14) - 7;
      const z = Math.floor(h2(i, 4) * 14) - 7;
      v.put(x, 0, z, "foam", 0.12);
    }
  }
}

/** Simple ground road (used beneath grade-separated crossings) along axis ax (0 = N-S) */
function groundRoadUnder(n: Net, ax: number): void {
  const R = n.R[ax === 0 ? 0 : 1];
  R.box(-5, 0, -8, 5, 1, 8, "concrete");
  R.box(-4, 0, -8, 4, 1, 8, "asphalt");
  for (let z = -8; z < 8; z++) if (((z + 64) & 3) === 1 || ((z + 64) & 3) === 2) R.box(-1, 0, z, 1, 1, z + 1, "white");
}

/** cells on the deck (within half-width hw of any arm, or the junction box) */
function deckCells(n: Net, hw: number, f: (x: number, z: number, i: number, d: number) => void): void {
  computeD(n, "box", 0);
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < hw) f(x, z, i, d);
  });
}

// ---------------------------------------------------------------------------------------------
// BRIDGES — steel truss road bridge, deck at y=4.
//  Four truss systems in the same municipal paint: Warren, crossed lattice, Pratt and bowstring.
//  Lv1 girder span -> Lv2 pony truss -> Lv3 through truss -> Lv4 lit truss -> Lv5 camelback landmark
// ---------------------------------------------------------------------------------------------

const BRIDGE_H = 4;

function railingsAround(n: Net, dk: DeckInfo, hw: number, col: string, h = 1, post?: string): void {
  const v = n.v;
  // a deck cell whose 4-neighbour is off-deck gets a rail
  forCells((x, z, i) => {
    if (n.D[i] >= hw) return;
    const dh = dk.H[i];
    if (dh <= 0) return;
    let edge = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inT(nx, nz)) continue;
      if (n.D[idx(nx, nz)] >= hw) edge = true;
    }
    if (!edge) return;
    v.box(x, dh + 1, z, x + 1, dh + 1 + h, z + 1, col);
    if (post && ((x + z) & 3) === 0) v.put(x, dh + 1 + h, z, post);
  });
}

function buildBridge(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const paint = "#3e7169";
  const paint2 = "#73a394";
  const dk = deckH(n, BRIDGE_H);
  underGround(n);
  const hw = 7;
  if (dk.sep >= 0) groundRoadUnder(n, dk.sep === 0 ? 1 : 0);
  // deck + girder
  const deckFn = (x: number, z: number, i: number, d: number) => {
    const h = dk.H[i];
    const col = d < 4 ? "asphalt" : d < 6 ? "steelLight" : "steelDark";
    v.put(x, h, z, col);
    if (h >= 1) v.put(x, h - 1, z, d >= 5 ? paint : "steelDark");
  };
  if (dk.sep >= 0) {
    // only the elevated axis carries the deck
    const R = n.R[dk.sep === 0 ? 0 : 1];
    for (let z = -8; z < 8; z++) {
      for (let x = -7; x < 7; x++) {
        const d = x >= 0 ? x : -1 - x;
        R.put(x, BRIDGE_H, z, d < 4 ? "asphalt" : d < 6 ? "steelLight" : "steelDark");
        R.put(x, BRIDGE_H - 1, z, d >= 5 ? paint : "steelDark");
      }
      R.put(-7, BRIDGE_H + 1, z, paint);
      R.put(6, BRIDGE_H + 1, z, paint);
      if (((z + 64) & 3) === 1 || ((z + 64) & 3) === 2) R.box(-1, BRIDGE_H, z, 1, BRIDGE_H + 1, z + 1, "white");
    }
    // piers either side of the road beneath
    for (const pz of [-8, 6]) {
      R.box(-6, 0, pz, -4, BRIDGE_H - 1, pz + 2, "concreteDark");
      R.box(4, 0, pz, 6, BRIDGE_H - 1, pz + 2, "concreteDark");
    }
    // girder side plates
    R.box(-7, BRIDGE_H - 2, -8, -6, BRIDGE_H - 1, 8, paint);
    R.box(6, BRIDGE_H - 2, -8, 7, BRIDGE_H - 1, 8, paint);
    return;
  }
  deckCells(n, hw, deckFn);
  // centre dashes
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    for (let a = armStart(n, 4); a < 8; a++) {
      if (a % 4 === 1 || a % 4 === 2) {
        const [wx, wz] = rotK(k, 0, -1 - a);
        const h = dk.H[idx(wx, wz)];
        R.box(-1, h, -1 - a, 1, h + 1, -a, "white");
      }
    }
  }
  // piers (under full-height deck)
  const pierAt = (x: number, z: number) => {
    const i = idx(x, z);
    const h = dk.H[i];
    if (h < 2) return;
    v.box(x, 0, z, x + 2, h - 1, z + 2, "concreteDark");
    if (n.water) v.box(x - 1, 0, z, x + 3, 1, z + 2, "concrete");
  };
  if (n.straight >= 0 || n.lonely) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    // pier pair at tile centre with cap beam
    for (const px of [-6, 4]) {
      const [wx, wz] = rotK(n.straight === 1 ? 1 : 0, px, -1);
      if (dk.H[idx(wx, wz)] >= 2) {
        R.box(px, 0, -1, px + 2, BRIDGE_H - 1, 1, "concreteDark");
        if (n.water) R.box(px, 0, -2, px + 2, 1, 2, "concrete");
      }
    }
    // side girder plates
    for (let z = -8; z < 8; z++) {
      const [wx, wz] = rotK(n.straight === 1 ? 1 : 0, -7, z);
      const h = dk.H[idx(wx, wz)];
      if (h >= 2) {
        R.put(-7, h - 2, z, paint);
        R.put(6, h - 2, z, paint);
      }
    }
  } else {
    pierAt(-2, -2);
  }
  // Truss on straight full-height tiles
  const fullStraight = (n.straight >= 0 || n.lonely) && !n.ramp.some(Boolean);
  if (fullStraight && lv === 1) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    for (const side of [-7, 6]) {
      if (vr === 1) {
        for (let z = -7; z < 8; z += 4) R.box(side, 1, z, side + 1, BRIDGE_H, z + 1, paint2);
      } else if (vr === 2) {
        for (const z of [-4, 3]) R.box(side, 0, z, side + 1, BRIDGE_H + 2, z + 1, "concreteDark");
      } else if (vr === 3) {
        for (let z = -5; z <= 5; z++) R.put(side, BRIDGE_H + Math.round(2 * Math.cos(z * Math.PI / 12)), z, paint2);
      }
    }
  }
  if (fullStraight && lv >= 2) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    const y0 = BRIDGE_H + 1;
    const th = lv === 2 ? 3 : lv === 3 ? 7 : 8;
    const topAt = (z: number) => {
      const rise = vr === 3 ? 3 + lv : lv >= 5 ? 3 : 0;
      return th + Math.round(rise * Math.sin((Math.PI * (z + 8.5)) / 16));
    };
    for (const sx of [-7, 6]) {
      for (let z = -8; z < 8; z++) {
        const t = topAt(z);
        R.put(sx, y0, z, paint); // bottom chord
        R.put(sx, y0 + t, z, paint); // top chord
        if (lv >= 5) R.put(sx, y0 + t - 1, z, paint);
        const p = ((z + 8) % 8 + 8) % 8; // 0..7 period
        if (p === 0) R.box(sx, y0, z, sx + 1, y0 + t, z + 1, paint2);
        const phase = vr === 2 ? (z < 0 ? 7 - p : p) / 7 : (p < 4 ? p : 8 - p) / 4;
        const diagY = Math.round(phase * t);
        if (vr !== 3) R.box(sx, y0 + diagY, z, sx + 1, y0 + Math.min(t, diagY + Math.ceil(t / 5)) + 1, z + 1, paint);
        if (vr === 1) R.box(sx, y0 + t - diagY, z, sx + 1, y0 + Math.min(t, t - diagY + 1) + 1, z + 1, paint2);
        if (vr === 3 && p % 3 === 1) R.box(sx, y0 + 1, z, sx + 1, y0 + t, z + 1, "silver");
        if (lv >= 4 && p === 4) R.put(sx, y0 + 1, z, "warmGlow", 1.0);
      }
    }
    if (lv >= 3) {
      // overhead lateral bracing
      for (let z = -8; z < 8; z++) {
        const p = ((z + 8) % 8 + 8) % 8;
        const t = topAt(z);
        if (p === 0 || p === 4) R.box(-7, y0 + t, z, 7, y0 + t + 1, z + 1, paint);
        else if (p === 2 || p === 6) {
          R.put(-1, y0 + t, z, paint2);
          R.put(0, y0 + t, z, paint2);
        }
      }
      for (let z = -8; z < 8; z++) R.box(-1, y0 + topAt(z), z, 1, y0 + topAt(z) + 1, z + 1, paint2);
    }
    if (lv >= 4) {
      // deck lamps hanging from the top bracing
      R.put(-3, y0 + topAt(-4) - 1, -4, "warmGlow", 1.2);
      R.put(2, y0 + topAt(4) - 1, 4, "warmGlow", 1.2);
    }
    if (lv >= 5) {
      // flags + nameplate
      R.box(-1, y0 + topAt(0) + 1, -1, 0, y0 + topAt(0) + 5, 0, "steelLight");
      R.box(0, y0 + topAt(0) + 3, -1, 2, y0 + topAt(0) + 5, 0, vr === 1 ? "blue" : "red");
      R.put(-7, y0 + 3, 0, "gold", 0.6);
      R.put(6, y0 + 3, 0, "gold", 0.6);
    }
  } else {
    railingsAround(n, dk, hw, paint, 1, lv >= 2 ? paint2 : undefined);
    if (!fullStraight && (n.junction || n.corner >= 0)) {
      // portal posts on junction corners
      for (let q = 0; q < 4; q++) {
        const [px, pz] = rotK(q, 6, -7);
        if (n.D[idx(px, pz)] < hw && !(n.arm[q] && n.arm[(q + 1) % 4])) continue;
        const h = dk.H[idx(px, pz)] ?? BRIDGE_H;
        if (lv >= 3) v.box(px, BRIDGE_H + 1, pz, px + 1, BRIDGE_H + 7, pz + 1, paint);
        if (lv >= 4) v.put(px, BRIDGE_H + 7, pz, "warmGlow", 1.1);
        void h;
      }
    }
  }
  if (lv >= 1) railingsLamp(n, dk, lv);
}

function railingsLamp(n: Net, dk: DeckInfo, lv: number): void {
  // ramp tiles get a lamp near the abutment at Lv3+
  if (lv < 3) return;
  for (let k = 0; k < 4; k++) {
    if (!n.ramp[k]) continue;
    const R = n.R[k];
    const [wx, wz] = rotK(k, 6, -4);
    const h = dk.H[idx(wx, wz)];
    R.box(6, h + 1, -4, 7, h + 6, -3, "iron");
    R.put(6, h + 6, -4, "warmGlow", 1.2);
  }
}

// ---------------------------------------------------------------------------------------------
// STONE BRIDGES — arched masonry, deck at y=5, parapets & lanterns.
//  V0 Limestone   V1 Red sandstone   V2 Grey granite   V3 Mossy old stone
// ---------------------------------------------------------------------------------------------

const STONE_H = 5;

function buildStoneBridge(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const wall = ["limestone", "#c98a6a", "granite", "stone"][vr];
  const wall2 = ["marbleShade", "#b07357", "slateLight", "moss"][vr];
  const dk = deckH(n, STONE_H);
  underGround(n);
  const hw = 8;
  if (dk.sep >= 0) groundRoadUnder(n, dk.sep === 0 ? 1 : 0);
  computeD(n, "box", 0);
  // arch openings: along the axis perpendicular to straight runs; both axes on junctions
  const sepAxis = dk.sep;
  const archOpen = (x: number, z: number, y: number): boolean => {
    const openAlongX = (px: number) => {
      const offset = Math.abs(px + 0.5);
      const t = vr === 1 ? Math.abs(offset - 3.5) / 3 : offset / 6.5;
      if (t >= 1) return false;
      const rise = vr === 2 ? 1 - t : Math.sqrt(1 - t * t);
      return y < 1 + rise * (vr === 3 ? 2.5 : 3.4);
    };
    if (sepAxis >= 0) {
      // grade-separated: a big tunnel carrying the ground road under
      const q = sepAxis === 0 ? z : x;
      const t = Math.abs(q + 0.5) / 6.5;
      return t < 1 && y < 1 + Math.sqrt(1 - t * t) * 3.4;
    }
    const ns = n.straight === 0 || (n.lonely && n.straight !== 1);
    const ew = n.straight === 1;
    if (ns) return openAlongX(z);
    if (ew) return openAlongX(x);
    return openAlongX(z) || openAlongX(x);
  };
  forCells((x, z, i) => {
    const d = n.D[i];
    if (sepAxis >= 0) {
      const dd = sepAxis === 0 ? (x >= 0 ? x : -1 - x) : z >= 0 ? z : -1 - z;
      if (dd >= hw) return;
    } else if (d >= hw) return;
    const h = sepAxis >= 0 ? STONE_H : dk.H[i];
    const dd = sepAxis >= 0 ? (sepAxis === 0 ? (x >= 0 ? x : -1 - x) : z >= 0 ? z : -1 - z) : d;
    // masonry body
    for (let y = n.water ? 1 : 0; y < h; y++) {
      if (h >= STONE_H && archOpen(x, z, y)) continue;
      const course = ((y + (((x + z) >> 1) & 1)) & 1) === 0;
      v.put(x, y, z, course ? wall : wall2);
    }
    if (n.water && !(h >= STONE_H && archOpen(x, z, 0))) v.put(x, 0, z, wall2);
    // deck surface
    v.put(x, h, z, dd < 5 ? (h2(x, z, 3) < 0.4 ? "granite" : "stone") : dd < 6 ? "path2" : wall);
    // parapet
    if (dd >= 6) {
      v.put(x, h + 1, z, wall);
      if (lv >= 2) v.put(x, h + 2, z, ((x + z) & 1) === 0 ? wall2 : wall);
    }
  });
  // lanterns on parapets
  if (lv >= 3) {
    const lant = vr === 2 ? "iron" : "black";
    const spots: [number, number][] = [[-8, -4], [7, -4], [-8, 3], [7, 3]];
    const straightK = n.straight === 1 ? 1 : 0;
    if (n.straight >= 0 || n.lonely) {
      const R = n.R[straightK];
      for (const [lx, lz] of spots) {
        const [wx, wz] = rotK(straightK, lx, lz);
        const h = dk.H[idx(wx, wz)];
        const top = h + (lv >= 2 ? 3 : 2);
        R.box(lx, top, lz, lx + 1, top + 3, lz + 1, lv >= 5 ? "goldDark" : lant);
        R.put(lx, top + 3, lz, "warmGlow", 1.2);
        if (lv >= 5) R.put(lx, top + 4, lz, "gold");
      }
    } else {
      for (let q = 0; q < 4; q++) {
        const [wx, wz] = rotK(q, 7, -8);
        const h = dk.H[idx(wx, wz)];
        v.box(wx, h + 3, wz, wx + 1, h + 6, wz + 1, lant);
        v.put(wx, h + 6, wz, "warmGlow", 1.2);
      }
    }
  }
  // Lv4+: statues on the central pier refuges of straights; Lv5 gilded
  if (lv >= 4 && (n.straight >= 0 || n.lonely) && !n.ramp.some(Boolean)) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    for (const sx of [-8, 7]) {
      R.box(sx, STONE_H + 3, -8, sx + 1, STONE_H + 4, -7, wall2);
      R.box(sx, STONE_H + 4, -8, sx + 1, STONE_H + 7, -7, lv >= 5 ? "gold" : "marble");
      R.put(sx, STONE_H + 7, -8, lv >= 5 ? "gold" : "marbleShade");
    }
  }
  // flower boxes at Lv4
  if (lv >= 4) {
    forCells((x, z, i) => {
      if (n.D[i] === 6 && h2(x, z, 77) < 0.18 && dk.H[i] >= STONE_H) v.put(x, STONE_H + 1, z, ["red", "pink", "purple", "yellow"][vr]);
    });
  }
  // keystones (arch crown) on side faces of straight spans
  if ((n.straight >= 0 || n.lonely) && !n.ramp.some(Boolean)) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    // straight N-S: arch tunnel along x, crown at z in {-1,0}, y = 4
    for (const sx of [-8, 7]) {
      R.box(sx, STONE_H - 1, -1, sx + 1, STONE_H, 1, lv >= 5 ? "gold" : wall2);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// SUSPENSION BRIDGES — tower per straight span with catenary cables & hangers, deck at y=6.
//  International-orange towers with rectangular, peaked, forked or finial-topped portals.
// ---------------------------------------------------------------------------------------------

const SUSP_H = 6;

function buildSuspension(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const paint = "#d15640";
  const paint2 = "#964137";
  const cableCol = lv >= 2 ? paint2 : "woodDark";
  const dk = deckH(n, SUSP_H);
  underGround(n);
  const hw = 8;
  if (dk.sep >= 0) groundRoadUnder(n, dk.sep === 0 ? 1 : 0);
  const sepK = dk.sep >= 0 ? (dk.sep === 0 ? 0 : 1) : -1;
  // deck
  const putDeck = (R: PixelVox, x: number, z: number, h: number, d: number) => {
    R.put(x, h, z, d < 5 ? "asphalt" : d < 6 ? "concrete" : "steelDark");
    if (h >= 1) R.put(x, h - 1, z, d >= 6 ? paint2 : "steelDark");
    if (d === 7 && h >= 1) R.put(x, h + 1, z, "steelLight");
  };
  if (sepK >= 0) {
    const R = n.R[sepK];
    for (let z = -8; z < 8; z++) for (let x = -8; x < 8; x++) putDeck(R, x, z, SUSP_H, x >= 0 ? x : -1 - x);
    for (const pz of [-8, 6]) {
      R.box(-8, 0, pz, -6, SUSP_H - 1, pz + 2, paint);
      R.box(6, 0, pz, 8, SUSP_H - 1, pz + 2, paint);
    }
  } else {
    deckCells(n, hw, (x, z, i, d) => putDeck(v, x, z, dk.H[i], d));
  }
  // centre dashes
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k] || (sepK >= 0 && k % 2 !== sepK)) continue;
    const R = n.R[k];
    for (let a = armStart(n, 5); a < 8; a++) {
      if (a % 4 === 1 || a % 4 === 2) {
        const [wx, wz] = rotK(k, 0, -1 - a);
        const h = sepK >= 0 ? SUSP_H : dk.H[idx(wx, wz)];
        R.box(-1, h, -1 - a, 1, h + 1, -a, "white");
      }
    }
  }
  const straightFull = (n.straight >= 0 || n.lonely) && !n.ramp.some(Boolean);
  const towerTop = SUSP_H + [9, 13, 17, 21, 26][lv - 1];
  const cableLow = SUSP_H + 3;
  if (straightFull) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    // tower legs straddling the deck at z = -1..0
    for (const lx of [-8, 6]) {
      R.box(lx, 0, -1, lx + 2, towerTop, 1, paint);
      if (lv >= 3) {
        // art-deco setbacks
        R.box(lx, SUSP_H + 5, -2, lx + 2, SUSP_H + 6, 2, paint2);
        R.box(lx, Math.floor((SUSP_H + towerTop) / 2) + 2, -2, lx + 2, Math.floor((SUSP_H + towerTop) / 2) + 3, 2, paint2);
      }
      if (n.water) R.box(lx - 1, 0, -2, lx + 3, 1, 2, "concrete");
    }
    // portal beams
    R.box(-6, towerTop - 2, -1, 6, towerTop, 1, paint);
    // Each style keeps the same deck and cable anchorage but has a different portal silhouette.
    if (vr === 1 || vr === 2) {
      const rise = vr === 1 ? 3 + lv : 3;
      for (let x = -7; x <= 6; x++) {
        const lift = vr === 1 ? 1 - Math.abs(x + 0.5) / 7 : Math.abs(x + 0.5) / 7;
        const y = towerTop - 1 + Math.round(rise * lift);
        R.box(x, y - 1, -1, x + 1, y + 1, 1, paint);
      }
    } else if (vr === 3) {
      for (const x of [-7, 6]) {
        R.box(x - 1, towerTop, -2, x + 2, towerTop + 2, 2, "brass");
        R.box(x, towerTop + 2, -1, x + 1, towerTop + 4 + lv, 1, paint);
      }
    }
    if (lv >= 2) R.box(-6, Math.floor((SUSP_H + towerTop) / 2), -1, 6, Math.floor((SUSP_H + towerTop) / 2) + 1, 1, paint);
    if (lv >= 4) R.box(-6, SUSP_H + 6, -1, 6, SUSP_H + 7, 1, paint);
    if (lv >= 5) {
      R.put(-8, towerTop, -1, "red", 1.2);
      R.put(7, towerTop, 0, "red", 1.2);
      n.c.blink(-8, towerTop, -1, "red");
      n.c.blink(7, towerTop, 0, "red");
    }
    // main cables (sag between towers => lowest at the tile edges)
    const K = towerTop - 1 - cableLow;
    for (const sx of [-7, 6]) {
      let prev = -1;
      for (let z = -8; z < 8; z++) {
        const e = 7.5 - Math.abs(z + 0.5);
        const off = Math.abs(z + 0.5) < 1 ? 1 : 0;
        const cy = Math.round(cableLow + K * Math.pow(e / 7.5, 2.2));
        const lo = prev < 0 ? cy : Math.min(prev, cy);
        const hi = prev < 0 ? cy : Math.max(prev, cy);
        if (!off) R.box(sx, lo, z, sx + 1, hi + 1, z + 1, cableCol);
        if (lv >= 4 && !off && z % 2 === 0) R.put(sx, cy + 1, z, "warmGlow", 1.0);
        prev = cy;
        // hangers
        if (!off && ((z + 64) & 1) === 0 && cy > SUSP_H + 2) R.box(sx, SUSP_H + 1, z, sx + 1, cy, z + 1, lv >= 2 ? "steelLight" : "wood");
      }
    }
  } else if (sepK < 0) {
    // anchorage blocks / approach on ramp tiles; corner pylons on junctions
    for (let k = 0; k < 4; k++) {
      if (!n.arm[k] || n.ramp[k]) continue;
      // cable coming in from the neighbouring span and anchoring on this tile
      const R = n.R[k];
      if (!n.ramp[(k + 2) % 4]) continue;
      for (const sx of [-7, 6]) {
        for (let a = 7; a >= 0; a--) {
          const z = -1 - a;
          const [wx, wz] = rotK(k, sx, z);
          const deck = dk.H[idx(wx, wz)];
          const cy = Math.round(cableLow - (7 - a) * ((cableLow - 1) / 9));
          if (cy > deck + 1) R.box(sx, cy, z, sx + 1, cy + 1, z + 1, cableCol);
        }
        R.box(sx - (sx < 0 ? 0 : 1), 0, 1, sx + (sx < 0 ? 2 : 1), 4, 4, "concrete");
      }
    }
    if (n.junction || n.corner >= 0) {
      for (let q = 0; q < 4; q++) {
        if (!n.arm[q] || !n.arm[(q + 1) % 4]) continue;
        const R = n.R[q];
        const top = SUSP_H + 2 + lv * 2;
        R.box(6, 0, -7, 8, top, -5, paint);
        R.box(6, top, -7, 8, top + 1, -5, lv >= 4 ? "warmGlow" : paint2, lv >= 4 ? 1 : 0);
        if (lv >= 3) {
          for (let d = 1; d <= 6; d++) {
            const y = top - 1 - Math.round((lv + 1) * d / 6);
            R.put(7, y, -6 + d, "steelLight");
            R.put(7 - d, y, -7, "steelLight");
          }
        }
        if (lv >= 5) R.box(6, top + 1, -7, 7, top + 4, -6, "gold");
      }
    }
  }
  if (!straightFull) railingsAround(n, dk, 7, "steelLight", 1);
}

// ---------------------------------------------------------------------------------------------
// OVERPASSES — concrete viaduct, deck at y=7, hammerhead piers; grade-separated crossings.
//  V0 Grey concrete   V1 Sandstone   V2 Blue steel girder   V3 White modern w/ red accent
// ---------------------------------------------------------------------------------------------

const OVER_H = 7;

function buildOverpass(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const body = ["concrete", "limestone", "concrete2", "white"][vr];
  const girder = ["concreteDark", "#c9a77a", "blue", "concrete"][vr];
  const accent = ["busYellow", "terracotta", "steelLight", "red"][vr];
  const dk = deckH(n, OVER_H);
  underGround(n);
  const sepK = dk.sep >= 0 ? (dk.sep === 0 ? 0 : 1) : -1;
  if (sepK >= 0) groundRoadUnder(n, sepK === 0 ? 1 : 0);
  const putDeck = (R: PixelVox, x: number, z: number, h: number, d: number) => {
    R.put(x, h, z, d < 6 ? "asphalt" : body);
    if (h >= 1) R.put(x, h - 1, z, d >= 6 ? girder : body);
    if (h >= 2 && d === 7) R.put(x, h - 2, z, girder);
    if (d >= 6) {
      R.put(x, h + 1, z, body);
      if (lv >= 4) R.put(x, h + 2, z, d === 7 ? (vr === 3 ? "glass" : "#8fb0a8") : body, vr === 3 ? 0.2 : 0);
      if (lv >= 4 && d === 7) R.put(x, h + 3, z, vr === 3 ? "glass" : "#8fb0a8", vr === 3 ? 0.2 : 0);
    }
    if (d === 5 && h > 0) R.put(x, h, z, "white");
    if (lv >= 5 && h >= 2 && d === 6) R.put(x, h - 2, z, "screenCyan", 1.0);
  };
  if (sepK >= 0) {
    const R = n.R[sepK];
    for (let z = -8; z < 8; z++) for (let x = -8; x < 8; x++) putDeck(R, x, z, OVER_H, x >= 0 ? x : -1 - x);
    // twin columns outside the road beneath
    for (const pz of [-8, 6]) {
      R.box(-2, 0, pz, 0, OVER_H - 1, pz + 2, body);
      R.box(0, 0, pz, 2, OVER_H - 1, pz + 2, body);
      R.box(-6, OVER_H - 3, pz, 6, OVER_H - 1, pz + 2, girder);
    }
    for (let z = -8; z < 8; z++) if (((z + 64) & 3) === 1 || ((z + 64) & 3) === 2) R.box(-1, OVER_H, z, 1, OVER_H + 1, z + 1, "white");
  } else {
    deckCells(n, 8, (x, z, i, d) => putDeck(v, x, z, dk.H[i], d));
    // embankment fill under low ramp sections (h <= 3) so ramps read as solid approaches
    forCells((x, z, i) => {
      const h = dk.H[i];
      if (n.D[i] < 8 && h >= 1 && h <= 3) v.box(x, 0, z, x + 1, h - 1, z + 1, n.D[i] >= 6 ? girder : body);
    });
    for (let k = 0; k < 4; k++) {
      if (!n.arm[k]) continue;
      const R = n.R[k];
      for (let a = armStart(n, 6); a < 8; a++) {
        if (a % 4 === 1 || a % 4 === 2) {
          const [wx, wz] = rotK(k, 0, -1 - a);
          const h = dk.H[idx(wx, wz)];
          R.box(-1, h, -1 - a, 1, h + 1, -a, "white");
        }
      }
    }
    // hammerhead pier at the centre when the centre is high
    if (dk.H[idx(0, 0)] >= 4) {
      v.box(-2, 0, -2, 2, OVER_H - 3, 2, body);
      v.box(-6, OVER_H - 3, -2, 6, OVER_H - 1, 2, body);
      v.box(-2, OVER_H - 3, -6, 2, OVER_H - 1, 6, body);
      if (lv >= 5) {
        // vertical garden on the pier
        v.box(-2, 1, 2, 2, OVER_H - 4, 3, "leaf");
        v.box(-3, 1, -2, -2, OVER_H - 4, 2, "leafLight");
      }
      if (vr === 3) v.box(-2, OVER_H - 4, 2, 2, OVER_H - 3, 3, accent);
    }
  }
  // lamps on straights
  if (lv >= 2 && (n.straight >= 0 || sepK >= 0)) {
    const k = sepK >= 0 ? sepK : n.straight === 1 ? 1 : 0;
    const R = n.R[k];
    for (const [lx, lz] of [[-7, -4], [6, 3]] as const) {
      const [wx, wz] = rotK(k, lx, lz);
      const h = sepK >= 0 ? OVER_H : dk.H[idx(wx, wz)];
      if (h < 2) continue;
      const top = h + (lv >= 4 ? 9 : 7);
      R.box(lx, h + 1, lz, lx + 1, top, lz + 1, "steel");
      const dir = lx < 0 ? 1 : -1;
      R.put(lx + dir, top, lz, "steel");
      R.put(lx + 2 * dir, top - 1, lz, "warmGlow", 1.3);
    }
  }
  // sign gantry at Lv3+
  if (lv >= 3 && (n.straight >= 0 && !n.ramp.some(Boolean))) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    const top = OVER_H + 8;
    R.box(-8, OVER_H + 1, 0, -7, top, 1, "steel");
    R.box(7, OVER_H + 1, 0, 8, top, 1, "steel");
    R.box(-8, top - 1, 0, 8, top, 1, "steelLight");
    R.box(-5, top - 4, 1, 5, top - 1, 2, vr === 1 ? "blue" : "leafDark");
    R.box(-4, top - 3, 2, 4, top - 2, 3, "white", 0.6);
    R.put(3, top - 3, 2, accent, 0.6);
  }
}

// ---------------------------------------------------------------------------------------------
// UNDERPASSES — sunken road between retaining walls; walls/berms 4 high; cut-and-cover lid.
//  V0 Concrete   V1 Brick portal   V2 Stone portal   V3 Modern tiled (cyan lights)
// ---------------------------------------------------------------------------------------------

const UNDER_H = 4;

function underpassCrossingHeight(axisCell: number): number {
  return Math.min(UNDER_H + 1, Math.round((UNDER_H + 1) * (7.5 - Math.abs(axisCell + 0.5)) / 2));
}

/** Y-index of each road voxel; index (x + 8) * 16 + z + 8. The other axis at a crossing is at y=0. */
export function networkRoadProfile(id: string, mask: number): { heights: Int8Array; elevatedAxis: number } | undefined {
  let full: number;
  switch (id) {
    case "bridges": full = BRIDGE_H; break;
    case "stone_bridges": full = STONE_H; break;
    case "suspension_bridges": full = SUSP_H; break;
    case "over_passes": full = OVER_H; break;
    case "underpasses": full = UNDER_H; break;
    default: return undefined;
  }
  const { H, sep } = deckH(networkLayout(mask, true), full);
  if (id !== "underpasses") return { heights: H, elevatedAxis: sep };
  if (sep < 0) return { heights: H.fill(0), elevatedAxis: -1 };
  const elevatedAxis = 1 - sep;
  forCells((x, z, i) => { H[i] = underpassCrossingHeight(elevatedAxis === 0 ? z : x); });
  return { heights: H, elevatedAxis };
}

function buildUnderpass(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const dk = deckH(n, UNDER_H);
  const wallC = ["concrete", "brick", "granite", "white"][vr];
  const wall2 = ["concreteDark", "brickDark", "stone", "teal"][vr];
  const sepK = dk.sep >= 0 ? (dk.sep === 0 ? 0 : 1) : -1;
  computeD(n, "box", 1);
  if (sepK >= 0) forCells((x, z, i) => {
    n.D[i] = Math.floor(Math.abs((sepK === 0 ? x : z) + 0.5));
  });
  // terrain berm everywhere outside the trench, height follows the deck profile
  forCells((x, z, i) => {
    const d = n.D[i];
    const h = sepK >= 0 ? UNDER_H : dk.H[i];
    if (d < 5) {
      v.put(x, 0, z, d === 4 ? "concreteDark" : "asphalt");
      return;
    }
    if (d < 6) {
      // retaining wall
      v.box(x, 0, z, x + 1, Math.max(1, h + 1), z + 1, ((x ^ z) & 2) === 0 ? wallC : wall2);
      if (h >= 1) v.put(x, h + 1, z, "concreteDark");
      return;
    }
    // berm: ground slopes from wall top down to ground at the edges
    const bh = Math.max(0, Math.min(h, h - (d - 6)));
    v.box(x, 0, z, x + 1, Math.max(1, bh + 1), z + 1, "soil");
    v.put(x, bh, z, grassVerge(x, z));
  });
  // lane markings in the trench
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k]) continue;
    const R = n.R[k];
    for (let a = armStart(n, 5); a < 8; a++) if (a % 4 === 1 || a % 4 === 2) R.box(-1, 0, -1 - a, 1, 1, -a, "white");
  }
  // cut-and-cover lid over full-depth cells
  const lidRows = (f: (x: number, z: number) => void) => {
    forCells((x, z, i) => {
      const h = sepK >= 0 ? UNDER_H : dk.H[i];
      if (n.D[i] < 5 && h >= UNDER_H) f(x, z);
    });
  };
  const lidOn = sepK >= 0 || n.junction || !(n.straight >= 0 || n.lonely) || n.ramp.some(Boolean) || lv >= 2;
  if (lidOn) {
    lidRows((x, z) => {
      v.put(x, UNDER_H + 1, z, lv >= 4 ? grassVerge(x, z) : "concrete");
      v.put(x, UNDER_H, z, "concreteDark");
    });
    // portal facades on lid edges that face lower ground
    forCells((x, z, i) => {
      const h = sepK >= 0 ? UNDER_H : dk.H[i];
      if (n.D[i] >= 5 || h < UNDER_H) return;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inT(nx, nz)) continue;
        const j = idx(nx, nz);
        if (n.D[j] < 5 && dk.H[j] < UNDER_H && sepK < 0) {
          // face cell: portal ring
          v.box(x, UNDER_H, z, x + 1, UNDER_H + 3, z + 1, wallC);
          v.put(x, UNDER_H + 2, z, wall2);
          if (lv >= 3) v.put(nx, UNDER_H - 1, nz, vr === 3 ? "screenCyan" : "warmGlow", 1.1);
          if (lv >= 5 && (x === 0 || x === -1 || z === 0 || z === -1)) v.put(x, UNDER_H + 3, z, "gold", 0.4);
        }
      }
    });
    // park details on the lid
    if (lv >= 4 && sepK < 0) {
      let placed = 0;
      lidRows((x, z) => {
        if (placed < 2 && h2(x, z, 41) < 0.06) {
          tree(v, x, UNDER_H + 2, z, ["round", "blossom", "oak", "birch"][vr] as TreeKind, 0.9, x);
          placed++;
        } else if (h2(x, z, 42) < 0.08) v.put(x, UNDER_H + 2, z, ["pink", "yellow", "white", "purple"][vr]);
      });
    }
    if (lv >= 3 && sepK < 0) {
      // vents
      lidRows((x, z) => {
        if (((x + 64) % 6 === 2) && ((z + 64) % 6 === 2)) v.box(x, UNDER_H + 2, z, x + 1, UNDER_H + 3, z + 1, "steelLight");
      });
    }
  }
  if (sepK >= 0) {
    // ground road crosses over the top on the lid
    const R = n.R[sepK === 0 ? 1 : 0];
    for (let z = -8; z < 8; z++) {
      const a = Math.abs(z + 0.5);
      const h = underpassCrossingHeight(z);
      if (h < UNDER_H + 1) R.box(-5, h, z, 5, UNDER_H + 3, z + 1, null);
      R.box(-4, h, z, 4, h + 1, z + 1, "asphalt");
      R.box(-5, h, z, -4, h + 2, z + 1, "concrete");
      R.box(4, h, z, 5, h + 2, z + 1, "concrete");
      if (((z + 64) & 3) === 1 || ((z + 64) & 3) === 2) R.box(-1, h, z, 1, h + 1, z + 1, "white");
      if (h > 1 && a >= 5) R.box(-5, 1, z, 5, h, z + 1, "soil");
    }
  }
  // tunnel sign / lights on approach walls
  if (lv >= 2) {
    for (let k = 0; k < 4; k++) {
      if (!n.ramp[k]) continue;
      const R = n.R[k];
      R.box(-6, 1, -3, -5, 3, -2, "steel");
      R.box(-6, 3, -3, -5, 5, -2, vr === 3 ? "teal" : "blue");
      R.put(-6, 4, -3, "white", 0.6);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// BOARDWALKS — timber planks on posts, works over sand or water.
//  V0 Beach (umbrellas)   V1 Marsh (reeds, bird hide)   V2 Harbor (crates, nets)
//  V3 Tropical (palms, tiki torches)
// ---------------------------------------------------------------------------------------------

function buildBoardwalk(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  computeD(n, "box", 1);
  aprons(n, 2, 4);
  // base: water or sand
  forCells((x, z) => {
    if (n.water) v.put(x, 0, z, h2(x, z, 1) < 0.05 ? "foam" : "water", h2(x, z, 1) < 0.05 ? 0.12 : 0.08);
    else v.put(x, 0, z, h2(x, z, 2) < 0.2 ? "sandDark" : vr === 1 && h2(x, z, 4) < 0.4 ? "olive" : "sand");
  });
  // deck
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d >= 5 && !n.ap[i]) return;
    if (d >= 4 && !n.ap[i]) {
      v.put(x, 1, z, "woodDark");
      return;
    }
    // planks run across the direction of travel: alternate by the coordinate along travel
    const ex = x >= 0 ? x : -1 - x;
    const ez = z >= 0 ? z : -1 - z;
    const ns = (n.arm[0] || n.arm[2]) && ex < 4 && (ez >= 4 || !(n.arm[1] || n.arm[3]));
    const alongZ = ns ? z : x;
    const ax = n.D[i] === (x >= 0 ? x : -1 - x) && z !== x ? z : x;
    void ax;
    v.put(x, 1, z, ((alongZ + 64) & 1) === 0 ? "woodLight" : "wood");
    if (h2(x, z, 9) < 0.04) v.put(x, 1, z, "oak");
  });
  // posts + rails on deck edge
  forCells((x, z, i) => {
    if (n.D[i] < 4 || n.D[i] >= 5 || n.ap[i]) return;
    const post = ((x + z + 64) & 3) === 0;
    if (post) {
      v.box(x, 0, z, x + 1, 1, z + 1, "woodDark");
      v.box(x, 2, z, x + 1, lv >= 2 ? 4 : 3, z + 1, "woodDark");
    } else if (lv >= 2) {
      v.put(x, 3, z, lv >= 4 ? "woodLight" : "#d8c49a");
    }
  });
  // props
  for (let q = 0; q < 4; q++) {
    if (lv >= 3) {
      propK(n, q, 4, -6, 4, (R) => {
        if (vr === 3) {
          R.box(4, 2, -6, 5, 6, -5, "woodDark");
          R.put(4, 6, -6, "fire", 1.3);
        } else {
          R.box(4, 2, -6, 5, 7, -5, vr === 2 ? "iron" : "white");
          R.put(4, 7, -6, "warmGlow", 1.2);
        }
      }, 0, 5);
    }
    if (lv >= 3 && q % 2 === 0) {
      const [bx, bz] = [2, -6];
      if (freeK(n, q, bx, bz, 0, 4) && n.straight >= 0) {
        n.R[q].box(2, 2, -6, 3, 3, -3, "wood");
      }
    }
    if (!n.water) {
      propK(n, q, 6, -6, 6, (R) => {
        if (vr === 0 && lv >= 2) {
          R.box(6, 1, -6, 7, 6, -5, "white");
          R.box(5, 6, -7, 8, 7, -4, ["red", "orange", "teal", "pink"][q]);
        } else if (vr === 1) {
          for (let k2 = 0; k2 < 3; k2++) R.box(5 + k2, 1, -6, 6 + k2, 3 + k2, -5, "olive");
        } else if (vr === 3) tree(R, 6, 1, -6, "palm", 1, q);
        else rocks(n.c, 6, 1, -6, 2);
      }, 1);
    }
  }
  if (lv >= 4) {
    // people & a cart on straights
    if (n.straight >= 0) {
      const R = n.R[n.straight === 0 ? 0 : 1];
      person(R, -2, 2, 2, ["red", "teal", "yellow", "pink"][vr]);
      if (vr === 2) {
        R.box(1, 2, -4, 3, 4, -2, "crate");
        R.box(1, 4, -3, 2, 5, -2, "crate");
      } else {
        // ice-cream / coconut cart
        R.box(1, 2, -5, 3, 4, -3, vr === 3 ? "woodLight" : "white");
        R.box(0, 5, -6, 4, 6, -2, vr === 3 ? "leaf" : "pink");
        R.box(2, 4, -4, 3, 5, -3, "white");
      }
    }
    if (n.water) {
      // fishing line
      for (let q = 0; q < 4; q++) {
        if (propK(n, q, 3, -5, 4, (R) => {
          person(R, 3, 2, -5, "orange");
          R.box(4, 4, -5, 7, 5, -4, "woodDark");
          R.box(7, 1, -5, 8, 4, -4, "silver");
        }, 0, 5)) break;
      }
    }
  }
  if (lv >= 5) {
    // carnival string lights between posts
    const cols = ["red", "yellow", "screenCyan", "pink", "screenGreen"];
    forCells((x, z, i) => {
      if (n.D[i] >= 4 && n.D[i] < 5 && !n.ap[i] && ((x + z + 64) & 3) === 2) {
        v.put(x, 5, z, cols[(x * 7 + z * 3 + 64) % cols.length], 1.2);
        v.box(x, 4, z, x + 1, 5, z + 1, "woodDark");
      }
    });
    if (n.dead >= 0 || n.junction) {
      // flag mast
      v.box(-1, 2, -1, 0, 12, 0, "white");
      v.box(0, 10, -1, 3, 12, 0, ["blue", "red", "teal", "yellow"][vr]);
      c.blink(-1, 12, -1, "red");
    }
  }
  if (n.dead >= 0) {
    // pier-end platform with bench & ladder
    const R = n.R[(n.dead + 2) % 4];
    R.box(-3, 2, -4, 3, 3, -3, "woodDark");
    R.box(-3, 3, -4, 3, 4, -3, "wood");
  }
}

// ---------------------------------------------------------------------------------------------
// TRAIN TRACKS — ballast, ties, rails; true curves at corners; switches at T's; diamond at 4-ways.
//  V0 Classic grey ballast   V1 Desert red ballast   V2 Basalt   V3 Heritage (moss-grown)
//  Lv1 timber ties -> Lv2 signals -> Lv3 concrete ties -> Lv4 electrified catenary -> Lv5 high-speed
// ---------------------------------------------------------------------------------------------

function buildRails(c: Ctx): void {
  const n = mkNet(c);
  const { v, lv, vr } = n;
  const ballast = ["stone", "#9a6d55", "basalt", "stone"][vr];
  const ballast2 = ["granite", "#7f5845", "ash", "moss"][vr];
  const tie = lv >= 3 ? (lv >= 5 ? "concrete" : "concreteDark") : vr === 3 ? "oak" : "woodDark";
  const railC = lv >= 5 ? "chrome" : "steelLight";
  // ground
  forCells((x, z) => {
    if (n.water) v.put(x, 0, z, "water", 0.08);
    else v.put(x, 0, z, grassVerge(x, z));
  });
  computeD(n, "arc", 0);
  // tracks to draw: straight arms (for straights/junctions/dead ends) + arcs (corners & T branches)
  type Track = { kind: "line"; k: number; from: number } | { kind: "arc"; q: number };
  const tracks: Track[] = [];
  if (n.corner >= 0) tracks.push({ kind: "arc", q: n.corner });
  else {
    for (let k = 0; k < 4; k++) if (n.arm[k]) tracks.push({ kind: "line", k, from: n.dead >= 0 ? 2 : 0 });
    if (n.nArms === 3) {
      // switch: curve(s) from the stem into the through line
      const stem = [0, 1, 2, 3].find((k) => n.arm[k] && !n.arm[(k + 2) % 4])!;
      // stem k: curve to k+1 and k-1 arms
      tracks.push({ kind: "arc", q: stem }); // arms stem & stem+1
      tracks.push({ kind: "arc", q: (stem + 3) % 4 }); // arms stem-1 & stem
    }
  }
  // rasterise per cell: lateral offset from the track centre-line (u) and along coordinate (s)
  const ballastSet = new Uint8Array(256);
  const tieSet = new Uint8Array(256);
  const railSet = new Uint8Array(256);
  const cellsOf = (t: Track, f: (x: number, z: number, u: number, s: number) => void) => {
    if (t.kind === "line") {
      for (let a = t.from; a < 8; a++) {
        for (let x = -4; x < 4; x++) {
          const [wx, wz] = rotK(t.k, x, -1 - a);
          f(wx, wz, x + 0.5, a);
        }
      }
      if (t.from === 0) {
        // fill the centre continuation for a lone arm (dead end handled separately)
      }
    } else {
      for (let x = -8; x < 8; x++) {
        for (let z = -8; z < 8; z++) {
          const [cx, cz] = rotK(4 - t.q, x, z);
          const r = Math.hypot(8 - (cx + 0.5), cz + 0.5 + 8);
          const u = 8 - r; // +: towards centre of tile
          if (Math.abs(u) > 4.2) continue;
          const ang = Math.atan2(cz + 0.5 + 8, 8 - (cx + 0.5)); // 0 at N edge .. pi/2 at E edge
          const s = (ang * 8) - 0.5;
          f(x, z, u, s);
        }
      }
    }
  };
  for (const t of tracks) {
    cellsOf(t, (x, z, u, s) => {
      const i = idx(x, z);
      const au = Math.abs(u);
      if (au < 4) ballastSet[i] = 1;
      if (au < 3.5 && ((Math.round(s) + 64) & 1) === 0) tieSet[i] = 1;
      if (Math.abs(au - 2.5) < 0.55) railSet[i] = 1;
    });
  }
  // over water: timber/steel trestle instead of ballast
  forCells((x, z, i) => {
    if (!ballastSet[i]) return;
    if (n.water) {
      v.put(x, 0, z, lv >= 3 ? "steelDark" : "woodDark");
    } else {
      const edge = n.D[i] >= 3;
      v.put(x, 0, z, edge || h2(x, z, 5) < 0.3 ? ballast2 : ballast);
      if (lv >= 5) v.put(x, 0, z, edge ? "concreteDark" : "concrete2");
    }
  });
  forCells((x, z, i) => {
    if (tieSet[i] && !railSet[i]) v.put(x, 1, z, tie);
    if (railSet[i]) v.put(x, 1, z, railC);
  });
  // diamond crossing centre for 4-ways: ensure rails continuous (already) + guard plates
  if (n.nArms === 4) {
    v.box(-1, 1, -1, 1, 2, 1, "steelDark");
  }
  // dead end buffer stop
  if (n.dead >= 0) {
    const R = n.R[n.dead];
    R.box(-4, 0, -2, 4, 1, 2, ballast);
    R.box(-3, 1, -1, 3, 3, 0, "red");
    R.box(-2, 1, -1, -1, 3, 0, "white");
    R.box(1, 1, -1, 2, 3, 0, "white");
    R.box(-3, 1, 0, -2, 2, 2, "steelDark");
    R.box(2, 1, 0, 3, 2, 2, "steelDark");
    R.put(-1, 3, -1, "red", 1.0);
  }
  // trestle over water
  if (n.water) {
    for (let k = 0; k < 4; k++) {
      if (!n.arm[k] || n.corner >= 0) continue;
      const R = n.R[k];
      for (const pz of [-8, -4]) {
        R.box(-5, 0, pz, -4, 3, pz + 1, lv >= 3 ? "steel" : "woodDark");
        R.box(4, 0, pz, 5, 3, pz + 1, lv >= 3 ? "steel" : "woodDark");
        R.box(-5, 0, pz, 5, 1, pz + 1, lv >= 3 ? "steelDark" : "oak");
      }
      R.box(-5, 2, -8, -4, 3, 0, lv >= 3 ? "steel" : "woodDark");
      R.box(4, 2, -8, 5, 3, 0, lv >= 3 ? "steel" : "woodDark");
    }
  }
  // free-corner props: signal, catenary masts
  const straightK = n.straight >= 0 ? (n.straight === 1 ? 1 : 0) : -1;
  if (lv >= 2) {
    // signal at the right side of a line arm
    let k = straightK >= 0 ? straightK : n.dead >= 0 ? n.dead : [0, 1, 2, 3].find((q) => n.arm[q]) ?? 0;
    if (n.corner >= 0) k = n.corner;
    const R = n.R[k];
    const [wx, wz] = rotK(k, 5, -5);
    if (inT(wx, wz) && !ballastSet[idx(wx, wz)]) {
      R.box(5, 1, -5, 6, 8, -4, "iron");
      R.box(5, 7, -6, 6, 10, -5, "black");
      R.put(5, 9, -7, n.junction ? "amber" : "red", 1.2);
      R.put(5, 8, -7, n.junction ? "#504020" : "screenGreen", n.junction ? 0 : 1.2);
      if (lv >= 4) n.c.blink(5, 10, -6, "amber");
    }
  }
  if (lv >= 4 && (straightK >= 0 || n.corner >= 0)) {
    // catenary: masts either side, contact wire over the track centre
    const k = straightK >= 0 ? straightK : n.corner;
    const R = n.R[k];
    const top = lv >= 5 ? 12 : 11;
    if (straightK >= 0) {
      R.box(-7, 0, -1, -6, top, 0, lv >= 5 ? "silver" : "steelDark");
      R.box(6, 0, -1, 7, top, 0, lv >= 5 ? "silver" : "steelDark");
      R.box(-7, top - 1, -1, 7, top, 0, "steel");
      R.box(-1, top - 3, -8, 0, top - 2, 8, "copper");
      R.box(-1, top - 2, -1, 0, top - 1, 0, "steelDark");
    } else {
      // corner: single mast on the inside, wire following the arc
      R.box(5, 0, -6, 6, top, -5, "steelDark");
      for (let z = -8; z < 0; z++) {
        const ang = ((z + 8.5) / 8) * (Math.PI / 2);
        const x = Math.round(8 - 8 * Math.cos(ang) - 0.5);
        void x;
      }
      for (let s = 0; s < 16; s++) {
        const ang = ((s + 0.5) / 16) * (Math.PI / 2);
        const px = Math.floor(8 - 8 * Math.cos(ang));
        const pz = Math.floor(-8 + 8 * Math.sin(ang));
        R.put(px - 1, top - 3, pz, "copper");
      }
    }
  }
  if (lv >= 5 && straightK >= 0 && !n.water) {
    // high-speed: security fence along both sides
    const R = n.R[straightK];
    if (vr === 1) {
      R.box(6, 2, 3, 8, 5, 6, "brickDark");
      R.box(5, 5, 2, 8, 6, 6, "slate");
    } else if (vr === 2) {
      R.box(6, 2, 2, 7, 8, 3, "iron");
      R.box(5, 8, 1, 8, 9, 4, "solarBlue");
    } else if (vr === 3) {
      R.box(6, 1, 3, 7, 7, 4, "woodDark");
      R.box(3, 6, 3, 7, 7, 4, "red");
      R.put(4, 6, 3, "white");
    }
    for (let z = -8; z < 8; z++) {
      R.put(-8, 1, z, "steelLight");
      R.put(7, 1, z, "steelLight");
      if (((z + 64) & 3) === 0) {
        R.box(-8, 1, z, -7, 3, z + 1, "steel");
        R.box(7, 1, z, 8, 3, z + 1, "steel");
      } else {
        R.put(-8, 2, z, "#9fb8c8");
        R.put(7, 2, z, "#9fb8c8");
      }
    }
  }
  // heritage / milepost decorations
  if (lv <= 2 && vr === 3 && !n.water) {
    for (let q = 0; q < 4; q++) propK(n, q, 6, -7, 6, (R) => bush(R, 6, 1, -7, 1, "leafLight", "yellow"));
  }
}

// ---------------------------------------------------------------------------------------------
// WATER NETWORKS — surface at y=0 (glow 0.08) so every water piece merges with its neighbours.
// ---------------------------------------------------------------------------------------------

const W_EMIT = 0.08;

function waterCell(v: PixelVox, x: number, z: number, col = "water"): void {
  v.put(x, 0, z, col, W_EMIT);
}

/** flow streaks (foam dashes) along arms */
function flowStreaks(n: Net, lateral: number[], col = "foam"): void {
  for (let k = 0; k < 4; k++) {
    if (!n.arm[k] || n.corner >= 0) continue;
    const R = n.R[k];
    for (const u of lateral) {
      const a = 2 + ((u * 5 + 64) % 4);
      R.box(u, 0, -a - 2, u + 1, 1, -a, col, 0.12);
    }
  }
}

// CANALS — stone quays, mooring posts, lock gates.  Per-tile feature by variant:
//  V0 Lock gates   V1 Footbridge   V2 Moored narrowboat   V3 Planters & café
function buildCanal(c: Ctx): void {
  const n = mkNet(c, true);
  const { v, lv, vr } = n;
  computeD(n, "box", 0);
  const quay = lv >= 2 ? "brick" : "stone";
  const quay2 = lv >= 2 ? "brickDark" : "granite";
  const cap = lv >= 3 ? "limestone" : "concreteDark";
  forCells((x, z, i) => {
    const d = n.D[i];
    // fill inner quadrant between two water arms (basin) to avoid pillars in canal blocks
    if (d < 5) waterCell(v, x, z, "water");
    else if (d < 6) {
      v.put(x, 0, z, quay2);
      v.put(x, 1, z, cap);
    } else {
      v.put(x, 0, z, quay);
      v.put(x, 1, z, ((x + z) & 1) === 0 ? "path2" : "path");
    }
  });
  // mooring bollards on quay edge
  forCells((x, z, i) => {
    if (n.D[i] === 5 && ((x * 3 + z * 5 + 64) % 7) === 0) v.put(x, 2, z, "iron");
  });
  // lamps on quays
  if (lv === 1) {
    const R = n.R[n.arm.findIndex(Boolean)];
    if (vr === 1) {
      for (const z of [-6, -3]) R.box(6, 2, z, 7, 5, z + 1, "woodDark");
      R.box(6, 4, -6, 7, 5, -2, "woodLight");
    } else if (vr === 2) {
      R.box(5, 1, -7, 8, 2, -2, "wood");
      R.box(6, 2, -5, 8, 4, -3, "crate");
    } else if (vr === 3) {
      R.box(6, 2, -6, 8, 3, -3, "terracotta");
      R.box(6, 3, -6, 8, 4, -3, "leafDark");
    }
  }
  if (lv >= 3) {
    for (let q = 0; q < 4; q++) {
      propK(n, q, 6, -6, 6, (R) => {
        R.box(6, 2, -6, 7, 7, -5, "black");
        R.put(6, 7, -6, "warmGlow", 1.2);
        if (lv >= 5) R.put(6, 8, -6, "gold");
      });
    }
  }
  if (lv >= 5) {
    for (let q = 0; q < 4; q++) {
      propK(n, q, 7, -3, 6, (R) => {
        R.box(7, 2, -3, 8, 3, -2, "terracotta");
        R.put(7, 3, -3, ["pink", "red", "yellow", "purple"][q]);
      });
    }
  }
  const st = n.straight >= 0 && !n.lonely ? n.straight : n.lonely ? 0 : -1;
  if (st >= 0 && lv >= 2) {
    const R = n.R[st === 1 ? 1 : 0];
    if (vr === 0 && lv >= 3) {
      // mitre lock gates with balance beams
      R.box(-5, 0, -1, -1, 3, 0, "woodDark");
      R.box(1, 0, -1, 5, 3, 0, "woodDark");
      R.box(-1, 0, -1, 1, 3, 0, "oak");
      R.box(-8, 2, -2, -4, 3, -1, "woodLight");
      R.box(4, 2, -2, 8, 3, -1, "woodLight");
      R.box(-5, 3, -1, 5, 4, 0, "steelDark");
      waterCell(v, 0, 0, "foam");
      R.box(-4, 0, 1, 4, 1, 3, "waterDeep", W_EMIT);
    } else if (vr === 1) {
      // humpback footbridge
      const y0 = 2;
      for (let x = -6; x < 6; x++) {
        const bump = Math.round(2 * Math.sin((Math.PI * (x + 6.5)) / 12));
        R.box(x, y0 + bump - 1, -1, x + 1, y0 + bump, 2, lv >= 3 ? "brick" : "wood");
        R.put(x, y0 + bump, -1, lv >= 3 ? "limestone" : "woodDark");
        R.put(x, y0 + bump, 1, lv >= 3 ? "limestone" : "woodDark");
      }
    } else if (vr === 2 && lv >= 2) {
      // narrowboat moored along the quay
      const hull = ["red", "leafDark", "blue", "crimson"][lv % 4];
      R.box(-4, 0, -7, -1, 2, 5, hull);
      R.box(-4, 2, -5, -1, 4, 3, "cream");
      for (let z = -4; z < 3; z += 2) R.put(-4, 3, z, "glass", 0.4);
      R.box(-4, 4, -5, -1, 5, 3, "charcoal");
      R.put(-3, 5, 2, "charcoal");
      R.put(-3, 6, 2, "charcoal");
      if (lv >= 4) n.c.smoke(-3, 7, 2, "smoke");
      R.put(-2, 2, -7, "gold");
    } else if (vr === 3 && lv >= 2) {
      // café umbrellas on the quay
      for (const sz of [-5, 2]) {
        R.box(6, 2, sz, 7, 5, sz + 1, "white");
        R.box(5, 5, sz - 1, 8, 6, sz + 2, sz < 0 ? "red" : "teal");
      }
    }
  }
  if (lv >= 4 && n.junction) {
    // gondola / small boat in the basin
    v.box(-3, 0, -1, 3, 1, 1, "black");
    v.box(-2, 1, -1, 2, 2, 1, "black");
    v.put(-3, 1, 0, "gold");
    person(v, 1, 1, 0, "white", "black");
  }
}

// WATER TILE — open water with rim, matures from pond to crystal lagoon.
//  V0 Sandy beach rim   V1 Rocky rim   V2 Reedy grass rim   V3 Marble pool coping
function buildWaterTile(c: Ctx): void {
  const n = mkNet(c, false);
  const { v, lv, vr } = n;
  const rim = ["sand", "stone", "grass2", "marble"][vr];
  const rim2 = ["sandDark", "granite", "leaf", "marbleShade"][vr];
  const lonely = n.realArms === 0;
  forCells((x, z) => {
    let water = true;
    if (lonely) {
      water = Math.hypot(x + 0.5, z + 0.5) < 7;
    } else {
      // a 1-2 cell rim on sides without water neighbours; quadrant corners rounded off
      const ex = x >= 0 ? x : -1 - x;
      const ez = z >= 0 ? z : -1 - z;
      const sideX = x >= 0 ? 1 : 3;
      const sideZ = z >= 0 ? 2 : 0;
      const openX = n.arm[sideX];
      const openZ = n.arm[sideZ];
      const lim = 6.5;
      const dx = openX ? 0 : Math.max(0, ex + 0.5 - lim + 1);
      const dz = openZ ? 0 : Math.max(0, ez + 0.5 - lim + 1);
      if (openX && openZ) water = true;
      else water = Math.hypot(dx, dz) < 1;
    }
    if (water) waterCell(v, x, z, "water");
    else v.put(x, 0, z, h2(x, z, 3) < 0.3 ? rim2 : rim);
  });
  // rim decorations
  if (vr === 1) {
    forCells((x, z) => {
      if (!lonely && v.v.size && h2(x, z, 6) < 0.08) {
        /* rocks added below */
      }
    });
  }
  const isWaterAt = (x: number, z: number) => {
    if (lonely) return Math.hypot(x + 0.5, z + 0.5) < 7;
    const ex = x >= 0 ? x : -1 - x;
    const ez = z >= 0 ? z : -1 - z;
    const openX = n.arm[x >= 0 ? 1 : 3];
    const openZ = n.arm[z >= 0 ? 2 : 0];
    const dx = openX ? 0 : Math.max(0, ex - 5);
    const dz = openZ ? 0 : Math.max(0, ez - 5);
    return (openX && openZ) || Math.hypot(dx, dz) < 1;
  };
  forCells((x, z) => {
    if (isWaterAt(x, z)) return;
    const r = h2(x, z, 8);
    if (vr === 2 && r < 0.45) v.box(x, 1, z, x + 1, 2 + Math.floor(r * 6), z + 1, r < 0.15 ? "olive" : "leaf");
    if (vr === 1 && r < 0.2) v.put(x, 1, z, r < 0.1 ? "stone" : "granite");
    if (vr === 3) v.put(x, 1, z, ((x + z) & 1) === 0 ? "marble" : "marbleShade");
    if (vr === 0 && r < 0.06) v.put(x, 1, z, "white"); // shells
  });
  // in-water decor by level
  const pts: [number, number][] = [[-3, -2], [2, 3], [-1, 4], [3, -4], [-4, 1], [1, -1]];
  pts.forEach(([x, z], j) => {
    if (j < 2) v.put(x, 0, z, "foam", 0.14);
    if (lv >= 2 && j >= 2 && j < 2 + (lv - 1)) {
      // lily pads (+ flowers)
      v.box(x, 0, z, x + 2, 1, z + 1, "leaf", 0.05);
      if (lv >= 3) v.put(x, 1, z, j % 2 ? "pink" : "white");
    }
  });
  if (lv >= 3) {
    // jumping fish
    v.put(4, 1, 1, "orange");
    v.put(5, 2, 1, "orange");
    v.put(3, 0, 1, "foam", 0.2);
  }
  if (lv >= 4) {
    // duck family
    for (const [dx, dz, s] of [[-4, -4, 1], [-2, -4, 0], [-1, -4, 0]] as const) {
      v.put(dx, 1, dz, s ? "white" : "yellow");
      if (s) {
        v.put(dx, 2, dz, "leafDark");
        v.put(dx + 1, 2, dz, "orange");
      }
    }
  }
  if (lv >= 5) {
    // crystal lagoon: glowing shallows + little fountain jet
    v.box(-1, 0, -1, 1, 1, 1, "cyan", 0.4);
    v.box(-1, 1, -1, 0, 4, 0, "foam", 0.5);
    v.put(-1, 4, -1, "white", 0.6);
  }
}

// RIVERS & WIDE RIVERS — natural banks, reeds/rocks, sandbars.
//  Bank styles: V0 Grassy reeds   V1 Sandy pebbles   V2 Rocky stream (rapids)   V3 Marsh (cattails)
function buildRiver(c: Ctx, wide: boolean): void {
  const n = mkNet(c, true);
  const { v, lv, vr } = n;
  computeD(n, wide ? "round" : "arc", 0);
  // wide rivers & 2x2 blocks: fill quadrant between two adjacent water arms
  const halfW = wide ? 6 : 4;
  const fillQuad = (x: number, z: number) => wide && n.arm[x >= 0 ? 1 : 3] && n.arm[z >= 0 ? 2 : 0];
  const bank = ["grass2", "sand", "stone", "olive"][vr];
  const bankEdge = ["soil", "sandDark", "granite", "soilDark"][vr];
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < halfW || fillQuad(x, z)) {
      // deeper channel colour in the middle
      const deep = d < halfW - 2 && wide;
      waterCell(v, x, z, deep ? "waterDeep" : "water");
    } else if (d < halfW + 1) v.put(x, 0, z, bankEdge);
    else v.put(x, 0, z, d < halfW + 2 ? bank : grassVerge(x, z));
  });
  // flow streaks
  flowStreaks(n, wide ? [-4, -1, 2] : [-2, 1]);
  if (vr === 2 || lv >= 3) {
    // rapids foam
    if (vr === 2) forCells((x, z, i) => {
      if (n.D[i] < halfW && h2(x, z, 31) < 0.07) v.put(x, 0, z, "foam", 0.15);
    });
  }
  // bank decoration
  forCells((x, z, i) => {
    const d = n.D[i];
    if (d < halfW || fillQuad(x, z)) return;
    const r = h2(x, z, 50 + vr);
    if (d < halfW + 2) {
      if ((vr === 0 || vr === 3) && r < 0.3 + lv * 0.04) {
        const h = 1 + Math.floor(r * 8) % 3;
        v.box(x, 1, z, x + 1, 1 + h, z + 1, vr === 3 ? "olive" : "leaf");
        if (vr === 3 && lv >= 2 && r < 0.15) v.put(x, 1 + h, z, "soilDark"); // cattail
      } else if (vr === 1 && r < 0.15) v.put(x, 1, z, r < 0.07 ? "white" : "stone");
      else if (vr === 2 && r < 0.3) v.box(x, 1, z, x + 1, 2 + (r < 0.1 ? 1 : 0), z + 1, r < 0.15 ? "stone" : "granite");
    }
  });
  // stepping rocks in channel (rivers Lv3+, rocky variant)
  if (!wide && lv >= 3 && (n.straight >= 0 || n.lonely)) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    if (vr === 2) {
      for (const x of [-3, -1, 1]) R.box(x, 0, 2, x + 1, 2, 3, "granite");
    } else {
      R.put(-2, 1, -3, "stone");
      R.put(2, 0, 4, "granite");
    }
  }
  // trees on banks (willows at Lv4+)
  for (let q = 0; q < 4; q++) {
    const lvTree = wide ? 3 : 2;
    if (lv >= lvTree) {
      propK(n, q, 6, -6, halfW + 1, (R) => {
        const kind: TreeKind = lv >= 4 ? (vr === 1 ? "palm" : "willow") : vr === 2 ? "pine" : "round";
        tree(R, 6, 1, -6, kind, wide ? 0.9 : 1, q);
      }, 1);
    }
  }
  // ducks / logs / boats / buoys
  if (lv >= 2 && (n.straight >= 0 || n.lonely)) {
    const R = n.R[n.straight === 1 ? 1 : 0];
    if (wide) {
      // drifting log
      R.box(-3, 1, -5, -2, 2, -1, "oak");
      R.put(-3, 1, -1, "woodDark");
    } else {
      R.put(1, 1, -2, "white");
      R.put(1, 2, -2, "leafDark");
      R.put(2, 2, -2, "orange");
    }
  }
  if (wide && lv >= 3 && (n.straight >= 0 || n.lonely || n.junction)) {
    // sandbar island
    for (let x = -3; x < 3; x++) {
      for (let z = -4; z < 4; z++) {
        const r = Math.hypot((x + 0.5) / 2.6, (z + 0.5) / 3.8);
        if (r < 1) {
          v.put(x, 0, z, r < 0.6 ? "sand" : "sandDark");
          if (r < 0.5 && lv >= 4) v.put(x, 1, z, h2(x, z) < 0.5 ? "leaf" : "olive");
        }
      }
    }
    if (lv >= 4) {
      tree(v, -1, 1, 0, vr === 1 ? "palm" : "round", 0.8, 3);
    }
    // gulls
    v.put(1, 1, -3, "white");
    v.put(-2, 1, 2, "white");
  }
  if (wide && lv >= 4 && (n.straight >= 0 || n.lonely)) {
    // channel buoys
    const R = n.R[n.straight === 1 ? 1 : 0];
    R.box(-6, 0, -6, -5, 2, -5, "red");
    R.put(-6, 2, -6, "red", 0.9);
    R.box(4, 0, 5, 5, 2, 6, "leaf");
    R.put(4, 2, 5, "screenGreen", 0.9);
    if (lv >= 5) {
      // river barge
      R.box(-5, 0, 0, -1, 2, 7, "redDark");
      R.box(-5, 2, 1, -1, 3, 5, "busYellow");
      R.box(-4, 2, 5, -2, 5, 7, "white");
      R.put(-3, 4, 7, "glass", 0.4);
      n.c.blink(-3, 6, 6, "red");
    }
  }
  if (!wide && lv >= 5) {
    // fishing jetty + kingfisher
    for (let q = 0; q < 4; q++) {
      if (propK(n, q, 6, -2, halfW + 1, (R) => {
        R.box(3, 1, -3, 8, 2, -1, "wood");
        R.box(3, 0, -3, 4, 1, -2, "woodDark");
        person(R, 4, 2, -2, "orange");
        R.put(6, 3, -1, "blue");
        R.put(6, 3, -2, "orange");
      }, 1)) break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

type FP = [[number, number], [number, number], [number, number], [number, number], [number, number]];
const ONE: FP = [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]];

defineDesigns({
  roads: {
    footprints: ONE,
    levels: ["Fresh Asphalt Lane", "Lamplit Street", "Tree-Lined Street", "Main Street", "Grand Avenue"],
    growth: "Kerbed asphalt street that gains lamps, street trees, hydrants, bus stops, signals and flower planters.",
    build: buildRoads,
  },
  dirt_roads: {
    footprints: ONE,
    levels: ["Wagon Ruts", "Fenced Farm Track", "Haybale Lane", "Gravel Byway", "Scenic Hedgerow Lane"],
    growth: "Rutted earth lane that picks up fences, hay bales, carts, lanterns, gravel and wildflowers.",
    build: buildDirt,
  },
  paths: {
    footprints: ONE,
    levels: ["Stepping Stones", "Flower-Border Path", "Lantern Walk", "Hedged Garden Path", "Rose-Arch Garden Path"],
    growth: "Stepping stones through the lawn that grow flower borders, lanterns, hedges and a rose arch.",
    build: buildPaths,
  },
  walking_paths: {
    footprints: ONE,
    levels: ["Gravel Footpath", "Lamplit Footpath", "Bench-Lined Stroll", "Flowerbed Promenade", "Grand Pergola Promenade"],
    growth: "Edged gravel footpath gaining lamps, benches, strollers, flowerbeds and a vine pergola.",
    build: buildWalking,
  },
  trails: {
    footprints: ONE,
    levels: ["Deer Track", "Marked Hiking Trail", "Root & Log-Step Trail", "Ranger Trail", "Ancient Forest Trail"],
    growth: "Earthen trail whose woodland thickens into an ancient forest with signposts, log steps and cairns.",
    build: buildTrails,
  },
  side_walks: {
    footprints: ONE,
    levels: ["Concrete Footway", "Planter Walk", "Lamplit Esplanade", "Bike-Rack Plaza Walk", "Civic Fountain Esplanade"],
    growth: "Paved pedestrian esplanade adding planters, benches, lamps, bike racks and fountain plazas.",
    build: buildSidewalks,
  },
  two_lane_roads: {
    footprints: ONE,
    levels: ["Striped Arterial", "Lit Arterial", "Bike-Lane Avenue", "Transit Boulevard", "Smart Avenue"],
    growth: "Wide double-yellow arterial that adds lighting, green bike lanes, bus stops and smart signals.",
    build: buildTwoLane,
  },
  pretty_roads: {
    footprints: ONE,
    levels: ["Cobble Lane", "Flower-Verge Cobbles", "Tree-Lined Boulevard", "Flower-Basket Roundabout", "Fountain Roundabout Boulevard"],
    growth: "Cobblestone boulevard that blooms with flower verges, avenue trees, baskets and fountain roundabouts.",
    build: buildPretty,
  },
  highways: {
    footprints: ONE,
    levels: ["Divided Highway", "Reflector Highway", "Lit Expressway", "Gantry Expressway", "Smart Highway"],
    growth: "Four-lane divided highway gaining guard rails, median lighting, sign gantries and glowing smart lanes.",
    build: (c) => buildMotorway(c, false),
  },
  freeways: {
    footprints: ONE,
    levels: ["Six-Lane Freeway", "High-Mast Freeway", "Gantry Freeway", "Sound-Wall Freeway", "Mega Freeway"],
    growth: "Six-lane jersey-barrier freeway adding high-mast lights, overhead gantries, sound walls and LED signage.",
    build: (c) => buildMotorway(c, true),
  },
  over_passes: {
    footprints: ONE,
    levels: ["Concrete Flyover", "Lit Flyover", "Signed Viaduct", "Sound-Wall Viaduct", "Neon Skyway"],
    growth: "Elevated viaduct on hammerhead piers that adds lamps, sign gantries, sound walls and neon underglow.",
    build: buildOverpass,
  },
  underpasses: {
    footprints: ONE,
    levels: ["Open Cutting", "Portal Underpass", "Lit Tunnel", "Park-Lid Tunnel", "Grand Tunnel Portal"],
    growth: "Sunken road between retaining walls that gets a covered lid, tunnel lights and a park on top.",
    build: buildUnderpass,
  },
  bridges: {
    footprints: ONE,
    levels: ["Steel Girder Span", "Pony Truss Bridge", "Through-Truss Bridge", "Lit Truss Bridge", "Camelback Truss Landmark"],
    growth: "Steel road bridge whose truss grows from a low girder to a lit, arched camelback landmark.",
    build: buildBridge,
  },
  stone_bridges: {
    footprints: ONE,
    levels: ["Fieldstone Arch", "Dressed-Stone Arch", "Lantern Arch Bridge", "Statue Bridge", "Gilded Royal Bridge"],
    growth: "Masonry arch bridge that gains coped parapets, lanterns, flower boxes, statues and gilding.",
    build: buildStoneBridge,
  },
  suspension_bridges: {
    footprints: ONE,
    levels: ["Cable Footbridge Span", "Twin-Tower Suspension", "Art-Deco Suspension", "Necklace-Lit Suspension", "Golden Gate Legend"],
    growth: "Suspension span whose towers soar higher every level, adding art-deco tiers, necklace lights and beacons.",
    build: buildSuspension,
  },
  boardwalks: {
    footprints: ONE,
    levels: ["Plank Walk", "Rope-Rail Boardwalk", "Lamplit Boardwalk", "Seaside Promenade", "Carnival Pier Promenade"],
    growth: "Timber walkway on posts that adds rope rails, lamps, carts and anglers, then carnival string lights.",
    build: buildBoardwalk,
  },
  train_tracks: {
    footprints: ONE,
    levels: ["Timber-Tie Line", "Signalled Branch Line", "Concrete-Tie Mainline", "Electrified Mainline", "High-Speed Rail"],
    growth: "Railway that upgrades from timber ties to concrete, signals, overhead catenary and fenced high-speed slab track.",
    build: buildRails,
  },
  canals: {
    footprints: ONE,
    levels: ["Ditch Canal", "Brick-Quay Canal", "Lamplit Canal", "Narrowboat & Lock Canal", "Grand Venetian Canal"],
    growth: "Quay-walled canal that gains brick, lamps, lock gates, footbridges, narrowboats and gondolas.",
    build: buildCanal,
  },
  water_tile: {
    footprints: ONE,
    levels: ["Puddle Pond", "Lily Pond", "Fish Lagoon", "Duck Lagoon", "Crystal Lagoon"],
    growth: "Open water that fills with lily pads, leaping fish, ducks and finally a glowing crystal lagoon.",
    build: buildWaterTile,
  },
  rivers: {
    footprints: ONE,
    levels: ["Babbling Brook", "Reedy Stream", "Rocky River", "Willow River", "Kingfisher River"],
    growth: "Meandering river whose banks grow reeds, rocks, willows and a fishing jetty.",
    build: (c) => buildRiver(c, false),
  },
  wide_rivers: {
    footprints: ONE,
    levels: ["Broad River", "Log-Drift River", "Sandbar River", "Navigable River", "Delta Giant"],
    growth: "Broad river that forms sandbar islands, channel buoys and finally carries barges.",
    build: (c) => buildRiver(c, true),
  },
});
