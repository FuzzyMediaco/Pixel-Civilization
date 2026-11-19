import {
  type Ctx,
  PixelVox,
  barrelRoof,
  container,
  crane,
  flag,
  flatRoof,
  gable,
  helipad,
  hip,
  lamp,
  person,
  ring,
  tree,
  waterPlane,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";

type V = PixelVox;

// =============================================================================================
// Shared vessel helpers (also imported by security.ts for naval / sub / air bases)
// =============================================================================================

export interface HullOpts {
  cx?: number;
  y0?: number;
  /** stern z (inclusive) and bow z (exclusive) — the bow points to +z */
  z0: number;
  z1: number;
  beam: number;
  /** hull height in voxels (deck is the top layer) */
  h: number;
  /** length of the bow taper */
  bow?: number;
  /** bow rake: how much lower layers are set back per voxel of height */
  rake?: number;
  /** stern rounding (rows) */
  stern?: number;
  col: string;
  bottom?: string;
  /** number of layers painted with the bottom colour */
  water?: number;
  stripe?: string;
  stripeY?: number;
  deck?: string;
  rail?: string;
  /** optional custom paint (dazzle camo etc.) — return undefined to fall back */
  paint?: (x: number, y: number, z: number) => string | undefined;
  /** add a 1-voxel bulwark ring above the deck edge */
  bulwark?: string;
  /** hollow the top deck (open boat) leaving the rim */
  open?: boolean;
}

export function hullRange(o: HullOpts, y: number, z: number): [number, number] | null {
  const y0 = o.y0 ?? 0;
  const yf = y - y0;
  if (yf < 0 || yf >= o.h || z < o.z0 || z >= o.z1) return null;
  const bowLen = o.bow ?? Math.max(2, o.beam);
  const rake = o.rake ?? 0.6;
  const t = o.z1 - 1 - z - (o.h - 1 - yf) * rake;
  if (t < 0) return null;
  let f = t < bowLen ? Math.pow((t + 0.5) / bowLen, 0.55) : 1;
  const u = z - o.z0;
  const st = o.stern ?? 1;
  if (u < st) f *= 1 - (st - u) * 0.14;
  if (u < Math.floor((o.h - 1 - yf) * 0.35)) return null;
  let hw = (o.beam / 2) * f;
  if (yf === 0 && o.h > 2) hw -= 0.8;
  if (hw < 0.35) return null;
  const cx = o.cx ?? 0;
  const a = Math.round(cx - hw);
  const b = Math.round(cx + hw);
  if (b <= a) return [Math.floor(cx), Math.floor(cx) + 1];
  return [a, b];
}

/** Draw a ship hull (shell only). Returns the deck surface y (first free layer above deck). */
export function hull(v: V, o: HullOpts): number {
  const y0 = o.y0 ?? 0;
  const inside = (x: number, y: number, z: number): boolean => {
    const r = hullRange(o, y, z);
    return !!r && x >= r[0] && x < r[1];
  };
  const water = o.water ?? 1;
  for (let z = o.z0; z < o.z1; z++) {
    for (let y = y0; y < y0 + o.h; y++) {
      const r = hullRange(o, y, z);
      if (!r) continue;
      const yf = y - y0;
      const top = yf === o.h - 1;
      for (let x = r[0]; x < r[1]; x++) {
        const side = !inside(x - 1, y, z) || !inside(x + 1, y, z) || !inside(x, y, z + 1) || !inside(x, y, z - 1);
        if (!top && !side && yf > 0) continue;
        let col: string;
        if (top) {
          if (o.open && !side) {
            v.put(x, y - 1, z, o.deck ?? "woodLight");
            continue;
          }
          col = side ? o.rail ?? o.col : o.deck ?? "woodLight";
        } else {
          col = (o.paint && o.paint(x, y, z)) || (yf < water ? o.bottom ?? o.col : o.stripe && yf === (o.stripeY ?? 1) ? o.stripe : o.col);
        }
        v.put(x, y, z, col);
        if (top && side && o.bulwark) v.put(x, y + 1, z, o.bulwark);
      }
    }
  }
  return y0 + o.h;
}

/** Row of portholes along both hull sides at height y */
export function portholes(v: V, o: HullOpts, y: number, step = 3, col = "glass", emit = 0.45): void {
  for (let z = o.z0 + 2; z < o.z1 - 3; z += step) {
    const r = hullRange(o, y, z);
    if (!r) continue;
    v.put(r[0], y, z, col, emit);
    v.put(r[1] - 1, y, z, col, emit);
  }
}

/** Foam wake trailing behind the stern (toward -z) */
export function wake(v: V, cx: number, z: number, w: number, len: number, minZ: number): void {
  for (let k = 0; k < len; k++) {
    const zz = z - 1 - k;
    if (zz < minZ) break;
    const spread = Math.floor(w / 2 + k * 0.7);
    v.put(cx - spread, 0, zz, "foam", 0.15);
    v.put(cx + spread - 1, 0, zz, "foam", 0.15);
    if (k < 2) v.box(cx - Math.floor(w / 2), 0, zz, cx + Math.ceil(w / 2), 1, zz + 1, "foam", 0.15);
  }
}

/** Box deckhouse with window bands on every storey and an optional overhanging roof */
export function deckhouse(
  c: Ctx,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  wall: string,
  glass = "glass",
  roof?: string,
  every = 3,
): void {
  const v = c.v;
  v.box(x0, y0, z0, x1, y1, z1, wall);
  if (x1 - x0 > 2 && z1 - z0 > 2 && y1 - y0 > 2) v.clear(x0 + 1, y0, z0 + 1, x1 - 1, y1 - 1, z1 - 1);
  for (let y = y0 + 1; y < y1 - 1; y += every) {
    const lit = c.rand() < 0.8;
    const cc = lit ? glass : "glassDark";
    const e = lit ? 0.45 : 0.05;
    v.box(x0 + 1, y, z1 - 1, x1 - 1, y + 1, z1, cc, e);
    v.box(x0 + 1, y, z0, x1 - 1, y + 1, z0 + 1, cc, e);
    v.box(x0, y, z0 + 1, x0 + 1, y + 1, z1 - 1, cc, e);
    v.box(x1 - 1, y, z0 + 1, x1, y + 1, z1 - 1, cc, e);
  }
  if (roof) v.box(x0 - 1, y1, z0 - 1, x1 + 1, y1 + 1, z1 + 1, roof);
}

/** Ship funnel with band + smoke. Returns top y. */
export function funnel(c: Ctx, cx: number, cz: number, y: number, h: number, r: number, col: string, bandCol: string, kind: "smoke" | "dark" | "steam" = "smoke"): number {
  const v = c.v;
  v.cylinderY(cx, cz, y, y + h, r, col);
  v.cylinderY(cx, cz, y + h - 3, y + h - 1, r + 0.05, bandCol);
  v.cylinderY(cx, cz, y + h - 1, y + h, r + 0.05, "black");
  c.smoke(cx, y + h + 1, cz, kind);
  return y + h;
}

/** Spinning radar bar on a mast top */
export function radar(c: Ctx, x: number, y: number, z: number, w = 6, col = "white", speed = 1.8): void {
  const r = new PixelVox(77);
  const hw = Math.floor(w / 2);
  r.box(-hw, 0, 0, hw, 1, 1, col);
  r.box(-hw + 1, 1, 0, hw - 1, 2, 1, col);
  r.put(0, 0, -1, "steelDark");
  r.put(-1, 0, -1, "steelDark");
  c.addRotor({ vox: r, pivot: [x + 0.5, y, z + 0.5], axis: "y", speed });
}

/** Spinning radar dish (bigger, for bases) */
export function radarDish(c: Ctx, x: number, y: number, z: number, r0 = 3, col = "white", speed = 1.2): void {
  const r = new PixelVox(78);
  for (let a = -r0; a < r0; a++) {
    for (let b = -1; b < Math.ceil(r0 * 1.3); b++) {
      const d = (a + 0.5) ** 2 / (r0 * r0) + (b + 0.5 - r0 * 0.5) ** 2 / ((r0 * 0.9) ** 2);
      if (d <= 1) r.put(a, b, -((a + 0.5) ** 2 < r0 ? 0 : 1) + 1, col);
    }
  }
  r.put(0, 1, -1, "steelDark");
  r.put(0, 1, -2, "red", 0.8);
  c.addRotor({ vox: r, pivot: [x + 0.5, y, z + 0.5], axis: "y", speed });
}

type Dir = "z" | "-z" | "x" | "-x";

function plotter(v: V, x: number, y: number, z: number, dir: Dir) {
  return (a: number, b: number, dy: number, col: string, e = 0): void => {
    let px: number;
    let pz: number;
    switch (dir) {
      case "z":
        px = x + b;
        pz = z + a;
        break;
      case "-z":
        px = x - b;
        pz = z - a;
        break;
      case "x":
        px = x + a;
        pz = z - b;
        break;
      default:
        px = x - a;
        pz = z + b;
    }
    v.put(px, y + dy, pz, col, e);
  };
}

/** Delta-wing fighter jet (9 long × 7 wide). dir = nose direction. */
export function jet(v: V, x: number, y: number, z: number, dir: Dir = "z", col = "steelLight", accent = "steelDark"): void {
  const P = plotter(v, x, y, z, dir);
  for (let a = -4; a <= 3; a++) P(a, 0, 0, col);
  P(4, 0, 0, accent);
  P(1, 0, 1, "glass", 0.35);
  P(2, 0, 1, "glass", 0.35);
  for (let a = -3; a <= 0; a++) {
    const span = Math.min(3, 1 - a);
    for (let b = 1; b <= span; b++) {
      P(a, b, 0, col);
      P(a, -b, 0, col);
    }
  }
  P(-3, 3, 0, accent);
  P(-3, -3, 0, accent);
  P(-4, 1, 0, col);
  P(-4, -1, 0, col);
  P(-4, 0, 1, accent);
  P(-3, 0, 1, accent);
  P(-4, 0, 2, accent);
  P(-5, 0, 0, "orange", 0.6);
}

/** Stealth flying-wing bomber (big, 9 long × 15 wide) */
export function stealthWing(v: V, x: number, y: number, z: number, dir: Dir = "z", col = "charcoal"): void {
  const P = plotter(v, x, y, z, dir);
  for (let a = -4; a <= 4; a++) {
    const span = Math.max(0, 7 - Math.abs(a - 1) * 0 - (4 - a));
    for (let b = -span; b <= span; b++) {
      const zig = Math.abs(b) % 4 === 0 ? 0 : 1;
      if (a === -4 && zig === 0) continue;
      P(a, b, 0, col);
    }
  }
  P(2, 0, 1, "glassDark", 0.2);
  P(3, 0, 1, "glassDark", 0.2);
  P(1, 0, 1, col);
}

/** Propeller plane (WWII fighter / seaplane). floats adds pontoons. */
export function propPlane(v: V, x: number, y: number, z: number, dir: Dir = "z", col = "oliveDrab", accent = "white", floats = false): void {
  const P = plotter(v, x, y, z, dir);
  const dy = floats ? 1 : 0;
  for (let a = -3; a <= 3; a++) P(a, 0, dy, col);
  P(4, 0, dy, "charcoal");
  P(4, 1, dy, "silver");
  P(4, -1, dy, "silver");
  P(4, 0, dy + 1, "silver");
  P(1, 0, dy + 1, "glass", 0.35);
  for (let b = 1; b <= 4; b++) {
    P(1, b, dy, col);
    P(1, -b, dy, col);
    P(2, b, dy, b === 3 ? accent : col);
    P(2, -b, dy, b === 3 ? accent : col);
  }
  P(-3, 1, dy, col);
  P(-3, -1, dy, col);
  P(-3, 0, dy + 1, col);
  P(-3, 0, dy + 2, accent);
  if (floats) {
    for (let a = -1; a <= 3; a++) {
      P(a, 2, 0, "white");
      P(a, -2, 0, "white");
    }
  }
}

/** Helicopter with a spinning main rotor. Body centred on the x/z seam at (x, z). */
export function helicopter(c: Ctx, x: number, y: number, z: number, col = "charcoal", axis: "x" | "z" = "z", speed = 14): void {
  const v = c.v;
  if (axis === "z") {
    v.box(x - 2, y, z - 2, x - 1, y + 1, z + 3, "steelDark");
    v.box(x + 1, y, z - 2, x + 2, y + 1, z + 3, "steelDark");
    v.box(x - 1, y + 1, z - 2, x + 1, y + 3, z + 3, col);
    v.box(x - 1, y + 2, z + 2, x + 1, y + 3, z + 3, "glass", 0.3);
    v.box(x - 1, y + 1, z + 3, x + 1, y + 2, z + 4, "glass", 0.3);
    v.box(x, y + 2, z - 7, x + 1, y + 3, z - 2, col);
    v.box(x, y + 3, z - 8, x + 1, y + 5, z - 6, col);
  } else {
    v.box(x - 2, y, z - 2, x + 3, y + 1, z - 1, "steelDark");
    v.box(x - 2, y, z + 1, x + 3, y + 1, z + 2, "steelDark");
    v.box(x - 2, y + 1, z - 1, x + 3, y + 3, z + 1, col);
    v.box(x + 2, y + 2, z - 1, x + 3, y + 3, z + 1, "glass", 0.3);
    v.box(x + 3, y + 1, z - 1, x + 4, y + 2, z + 1, "glass", 0.3);
    v.box(x - 7, y + 2, z, x - 2, y + 3, z + 1, col);
    v.box(x - 8, y + 3, z, x - 6, y + 5, z + 1, col);
  }
  v.box(x - 1, y + 3, z - 1, x + 1, y + 4, z + 1, "steelDark");
  const r = new PixelVox(91);
  r.box(-7, 0, 0, 7, 1, 1, "black");
  r.box(0, 0, -7, 1, 1, 7, "black");
  c.addRotor({ vox: r, pivot: [x, y + 4, z], axis: "y", speed });
}

/** Gun turret: square base + barrels pointing along +z (dir 1) or -z (dir -1). */
export function turret(v: V, cx: number, y: number, cz: number, size: number, barrels: number, len: number, dir: 1 | -1, col: string, barrelCol = "steelDark"): number {
  const h = Math.max(2, Math.round(size * 0.5));
  const hs = Math.floor(size / 2);
  v.cylinderY(cx, cz, y, y + 1, hs + 0.6, barrelCol);
  v.box(cx - hs, y + 1, cz - hs, cx - hs + size, y + h + 1, cz - hs + size, col);
  v.box(cx - hs + 1, y + h + 1, cz - hs + 1, cx - hs + size - 1, y + h + 2, cz - hs + size - 1, col);
  const span = barrels === 1 ? [0] : barrels === 2 ? [-1, 1] : [-2, 0, 2];
  for (const b of span) {
    const bx = cx + b;
    if (dir === 1) v.box(bx, y + 2, cz - hs + size, bx + 1, y + 3, cz - hs + size + len, barrelCol);
    else v.box(bx, y + 2, cz - hs - len, bx + 1, y + 3, cz - hs, barrelCol);
  }
  return y + h + 2;
}

/** Simple lattice mast with yardarm. Returns top y. */
export function mast(v: V, x: number, y: number, z: number, h: number, col = "steelDark", yard = 3): number {
  v.box(x, y, z, x + 1, y + h, z + 1, col);
  if (yard > 0) v.box(x - yard, y + h - 3, z, x + yard + 1, y + h - 2, z + 1, col);
  return y + h;
}

/** Submarine pressure hull (half submerged cylinder along z, nose at +z). Returns top y. */
export function subHull(v: V, cx: number, z0: number, z1: number, r: number, col: string, belly = "black", cy = 0.2, flat = false): number {
  const L = z1 - z0;
  let top = 0;
  for (let z = z0; z < z1; z++) {
    const t = (z - z0 + 0.5) / L; // 0 stern .. 1 nose
    let f: number;
    if (t > 0.82) f = Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2));
    else if (t < 0.3) f = 0.25 + 0.75 * Math.pow(t / 0.3, 0.7);
    else f = 1;
    const rr = Math.max(0.6, r * f);
    const rx = rr;
    const ry = flat ? rr * 0.75 : rr;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      for (let y = 0; y <= Math.ceil(cy + ry); y++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d > 1) continue;
        const dIn = ((x + 0.5 - cx) / Math.max(0.1, rx - 1.2)) ** 2 + ((y + 0.5 - cy) / Math.max(0.1, ry - 1.2)) ** 2;
        if (dIn < 1 && y > 0 && z > z0 && z < z1 - 1) continue;
        v.put(x, y, z, y === 0 ? belly : col);
        top = Math.max(top, y + 1);
      }
    }
  }
  return top;
}

/** Propeller rotor spinning around z at the stern */
export function screwProp(c: Ctx, x: number, y: number, z: number, r = 2, col = "brass", speed = 9): void {
  const p = new PixelVox(55);
  for (let k = -r; k < r; k++) {
    p.put(k, 0, 0, col);
    p.put(0, k, 0, col);
  }
  c.addRotor({ vox: p, pivot: [x, y, z], axis: "z", speed });
}

/** Triangular fore-and-aft sail in the x=x plane: luff on the mast at z=zm, foot extends to zm-len (aft). */
export function triSail(v: V, x: number, y0: number, y1: number, zm: number, len: number, col: string | ((y: number, z: number) => string), dir: 1 | -1 = -1): void {
  const H = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const l = Math.max(1, Math.round(len * (1 - (y - y0) / H)));
    for (let k = 1; k <= l; k++) {
      const z = zm + dir * k;
      v.put(x, y, z, typeof col === "string" ? col : col(y, z));
    }
  }
}

/** Square sail spanning x across the beam at plane z, slightly bellied forward */
export function squareSail(v: V, cx: number, y0: number, y1: number, z: number, w: number, col: string | ((x: number, y: number) => string), yard = "woodDark"): void {
  const hw = Math.floor(w / 2);
  for (let y = y0; y < y1; y++) {
    const shrink = y === y0 ? 1 : 0;
    for (let x = cx - hw + shrink; x < cx + hw - shrink; x++) {
      const belly = Math.abs(x + 0.5 - cx) < hw * 0.6 && y > y0 && y < y1 - 1 ? 1 : 0;
      v.put(x, y, z + belly, typeof col === "string" ? col : col(x, y));
    }
  }
  v.box(cx - hw - 1, y1, z, cx + hw + 1, y1 + 1, z + 1, yard);
}

/** A simple moored boat silhouette (for docks / bases). Bow toward +z. */
export function mooredBoat(c: Ctx, cx: number, z0: number, len: number, beam: number, col: string, kind: "row" | "motor" | "sail" | "fish" | "yacht"): void {
  const v = c.v;
  const o: HullOpts = { cx, z0, z1: z0 + len, beam, h: kind === "row" ? 2 : 3, col, bottom: "white", deck: "woodLight", bow: Math.max(3, Math.floor(len * 0.35)), open: kind === "row" };
  if (kind === "row") o.bottom = col;
  const dy = hull(v, o);
  const xm = cx - (beam % 2 === 0 ? 0 : 0.5);
  const mx = Math.floor(xm);
  if (kind === "motor" || kind === "yacht") {
    const cz = z0 + Math.floor(len * 0.3);
    v.box(mx - 1, dy, cz, mx + 1 + (beam > 5 ? 1 : 0), dy + 2, cz + Math.max(3, Math.floor(len * 0.3)), "white");
    v.box(mx - 1, dy + 1, cz + Math.max(3, Math.floor(len * 0.3)) - 1, mx + 1 + (beam > 5 ? 1 : 0), dy + 2, cz + Math.max(3, Math.floor(len * 0.3)), "glassDark", 0.2);
  }
  if (kind === "sail") {
    const mz = z0 + Math.floor(len * 0.55);
    v.box(mx, dy, mz, mx + 1, dy + len + 2, mz + 1, "silver");
    v.box(mx, dy + 1, mz - Math.floor(len * 0.45), mx + 1, dy + 2, mz, "steelDark");
    v.box(mx, dy + 2, mz - Math.floor(len * 0.45) + 1, mx + 1, dy + 3, mz, "white");
  }
  if (kind === "fish") {
    const cz = z0 + Math.floor(len * 0.45);
    v.box(mx - 1, dy, cz, mx + 2, dy + 3, cz + 3, "white");
    v.box(mx - 1, dy + 2, cz + 2, mx + 2, dy + 3, cz + 3, "glass", 0.4);
    v.box(mx, dy, cz - 3, mx + 1, dy + 7, cz - 2, "woodDark");
    v.box(mx - 1, dy, z0 + 1, mx + 1, dy + 1, z0 + 3, "leafDark");
  }
  if (kind === "row") {
    v.put(mx, dy - 1, z0 + Math.floor(len / 2), "woodDark");
  }
}

/** Piles + deck for a pier rectangle. Deck at y=1 (top surface y=2). */
export function pier(v: V, x0: number, z0: number, x1: number, z1: number, deck = "wood", pile = "woodDark", step = 4, y = 1): void {
  v.box(x0, y, z0, x1, y + 1, z1, deck);
  for (let x = x0; x < x1; x += step) {
    v.box(x, 0, z0, x + 1, y + 2, z0 + 1, pile);
    v.box(x, 0, z1 - 1, x + 1, y + 2, z1, pile);
  }
  for (let z = z0; z < z1; z += step) {
    v.box(x0, 0, z, x0 + 1, y + 2, z + 1, pile);
    v.box(x1 - 1, 0, z, x1, y + 2, z + 1, pile);
  }
  v.box(x0, 0, z1 - 1, x0 + 1, y + 2, z1, pile);
  v.box(x1 - 1, 0, z1 - 1, x1, y + 2, z1, pile);
}

const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];
function crew(c: Ctx, x: number, y: number, z: number, shirt: string, pants = "blueDark"): void {
  person(c.v, x, y, z, shirt, pants, c.pick(SKIN));
}

// =============================================================================================
// BOATS — hull class grows: rowboat → fishing boat → trawler → ferry → cruise liner
//  V0 Harbor Classic (white hull, red bottom, blue stripe)   V1 Retro Red (crimson hull, cream cabins)
//  V2 Tropical (teal hull, yellow trim, orange roofs)        V3 Ocean-Liner Navy (navy hull, varnished wood, gold)
// =============================================================================================
const BOAT_PAL = [
  { hull: "white", bottom: "red", stripe: "blue", deck: "woodLight", cabin: "white", roof: "blue", accent: "red", funnel: "red" },
  { hull: "crimson", bottom: "black", stripe: "cream", deck: "wood", cabin: "cream", roof: "crimson", accent: "cream", funnel: "cream" },
  { hull: "teal", bottom: "#f6d55c", stripe: "yellow", deck: "woodLight", cabin: "white", roof: "orange", accent: "yellow", funnel: "orange" },
  { hull: "blueDark", bottom: "redDark", stripe: "gold", deck: "oak", cabin: "white", roof: "wood", accent: "gold", funnel: "black" },
];

function buildBoat(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const p = BOAT_PAL[c.variant % 4];
  const z0 = -hz + 2;
  const z1 = hz - 1;
  if (lv === 1) {
    // Rowboat with oars and a rower
    const o: HullOpts = { z0: -6, z1: 7, beam: 6, h: 3, col: p.hull, bottom: p.hull, stripe: p.stripe, stripeY: 1, deck: "wood", bow: 5, open: true, rail: p.accent };
    const dy = hull(v, o);
    v.box(-2, dy - 1, -1, 2, dy, 0, "woodLight");
    v.box(-2, dy - 1, 3, 2, dy, 4, "woodLight");
    for (const sx of [-1, 1]) {
      for (let k = 2; k < 7; k++) v.put(sx * k - (sx < 0 ? 1 : 0), dy - (k > 4 ? 1 : 0), 1, "woodLight");
      v.put(sx * 7 - (sx < 0 ? 1 : 0), 0, 1, "woodLight");
      v.put(sx * 7 - (sx < 0 ? 1 : 0), 0, 2, "woodLight");
    }
    person(v, 0, dy - 1, 1, p.accent === "gold" ? "yellow" : "orange", "blueDark");
    v.put(-1, dy - 1, -4, "crate");
    v.put(0, dy - 1, 5, "amber", 0.8);
    wake(v, 0, -6, 2, 3, -hz);
    return;
  }
  if (lv === 2) {
    // Little fishing boat: wheelhouse, mast with boom, nets & buoys
    const o: HullOpts = { z0, z1, beam: 9, h: 4, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 2, deck: p.deck, bow: 7, rail: p.accent };
    const dy = hull(v, o);
    deckhouse(c, -3, dy, -5, 3, dy + 5, 1, p.cabin, "glass", p.roof);
    v.box(-2, dy + 6, -3, -1, dy + 8, -2, "steelDark");
    lamp(v, 2, dy + 6, -1, 1, "steelDark", "warmGlow");
    mast(v, 0, dy, 4, 11, "woodDark", 0);
    v.box(0, dy + 8, -1, 1, dy + 9, 4, "woodDark");
    v.box(-2, dy, 6, 2, dy + 1, 9, "leafDark");
    v.box(-1, dy + 1, 7, 1, dy + 2, 8, "leaf");
    v.put(-3, dy, -9, "orange");
    v.put(2, dy, -9, "orange");
    v.box(-2, dy, -10, 2, dy + 1, -8, "crate");
    crew(c, 1, dy, 4, "yellow");
    wake(v, 0, z0, 4, 3, -hz);
    return;
  }
  if (lv === 3) {
    // Trawler: forward bridge, big stern A-frame gantry, net drum, outrigger booms, funnel
    const o: HullOpts = { z0, z1, beam: 11, h: 5, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 3, deck: p.deck, bow: 8, rail: p.accent, bulwark: p.accent };
    const dy = hull(v, o);
    portholes(v, o, 2, 3);
    deckhouse(c, -4, dy, 1, 4, dy + 4, 8, p.cabin, "glass");
    deckhouse(c, -3, dy + 4, 2, 3, dy + 7, 7, p.cabin, "glass", p.roof);
    mast(v, 0, dy + 8, 4, 5, "steelDark", 2);
    v.put(0, dy + 13, 4, "red", 1);
    c.blink(0, dy + 13, 4, "red");
    funnel(c, 0, -1, dy, 7, 1.2, p.funnel, p.accent === "red" ? "black" : p.accent, "dark");
    // stern A-frame gantry
    v.box(-5, dy, z0 + 1, -4, dy + 9, z0 + 2, "hazard");
    v.box(4, dy, z0 + 1, 5, dy + 9, z0 + 2, "hazard");
    v.box(-5, dy + 9, z0 + 1, 5, dy + 10, z0 + 2, "hazard");
    v.box(-3, dy, -6, 3, dy + 3, -3, "steelDark");
    v.box(-2, dy + 1, -6, 2, dy + 3, -3, "leafDark");
    // outrigger booms angled outward
    for (let k = 0; k < 7; k++) {
      v.put(-5 - Math.floor(k * 0.7), dy + 1 + k, -1, "steelDark");
      v.put(4 + Math.floor(k * 0.7), dy + 1 + k, -1, "steelDark");
    }
    for (const bx of [-3, 2]) v.box(bx, dy, -11, bx + 1, dy + 1, -9, "orange");
    crew(c, -2, dy, -8, "orange");
    crew(c, 2, dy, -2, "yellow");
    wake(v, 0, z0, 6, 3, -hz);
    return;
  }
  if (lv === 4) {
    // Passenger ferry: twin cabin decks with ribbon windows, sun deck with people, funnel, lifeboats
    const beam = Math.min(13, hx * 2 - 2);
    const o: HullOpts = { z0, z1, beam, h: 5, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 3, deck: p.deck, bow: 10, stern: 3, rail: p.hull };
    const dy = hull(v, o);
    portholes(v, o, 2, 2);
    const hw = Math.floor(beam / 2) - 1;
    deckhouse(c, -hw, dy, z0 + 4, hw, dy + 4, z1 - 12, p.cabin, "glass", p.roof);
    deckhouse(c, -hw + 1, dy + 5, z0 + 7, hw - 1, dy + 8, z1 - 14, p.cabin, "glass", p.roof);
    // bridge
    v.box(-hw, dy + 5, z1 - 16, hw, dy + 8, z1 - 13, p.cabin);
    v.box(-hw + 1, dy + 6, z1 - 14, hw - 1, dy + 7, z1 - 13, "glassDark", 0.3);
    funnel(c, 0, z0 + 12, dy + 9, 6, 1.6, p.funnel, p.accent);
    radar(c, 0, dy + 10, z1 - 15, 4, "white");
    // lifeboats
    for (const z of [z0 + 9, z0 + 17]) {
      v.box(-hw - 1, dy + 4, z, -hw, dy + 5, z + 4, "orange");
      v.box(hw, dy + 4, z, hw + 1, dy + 5, z + 4, "orange");
    }
    // flags & passengers on the upper deck
    for (let i = 0; i < 4; i++) crew(c, c.ri(-hw + 2, hw - 2), dy + 9, c.ri(z0 + 8, z1 - 16), c.pick(["red", "yellow", "pink", "sky", "white"]));
    flag(v, 0, dy, z1 - 6, 6, [p.accent, "white", p.accent]);
    flag(v, 0, dy, z0 + 1, 5, ["red", "white", "blue"]);
    wake(v, 0, z0, beam - 4, 2, -hz);
    return;
  }
  // Lv5 Cruise liner: tiered decks, balconies, pools, water-slide, twin funnels
  const beam = Math.min(24, hx * 2 - 6);
  const o: HullOpts = { z0, z1, beam, h: 7, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 5, deck: p.deck, bow: 16, stern: 3, rail: p.hull };
  const dy = hull(v, o);
  portholes(v, o, 2, 2);
  portholes(v, o, 3, 2);
  const hw = Math.floor(beam / 2) - 1;
  const decks = 4;
  for (let d = 0; d < decks; d++) {
    const y = dy + d * 3;
    const inset = d === decks - 1 ? 2 : 0;
    const za = z0 + 3 + d * 2;
    const zb = z1 - 14 - d * 2;
    v.box(-hw + inset, y, za, hw - inset, y + 3, zb, p.cabin);
    v.clear(-hw + inset + 1, y, za + 1, hw - inset - 1, y + 2, zb - 1);
    // balcony windows (lit)
    for (let z = za + 1; z < zb - 1; z++) {
      const lit = c.rand() < 0.8;
      const col = (z & 1) === 0 ? (lit ? "glass" : "glassDark") : p.cabin;
      v.put(-hw + inset, y + 1, z, col, lit ? 0.45 : 0.05);
      v.put(hw - inset - 1, y + 1, z, col, lit ? 0.45 : 0.05);
    }
    v.box(-hw + inset, y + 2, za, hw - inset, y + 3, zb, d % 2 ? p.stripe : p.cabin);
  }
  const top = dy + decks * 3;
  // bridge with wings
  v.box(-hw - 1, top - 3, z1 - 18, hw + 1, top, z1 - 15, p.cabin);
  v.box(-hw - 1, top - 2, z1 - 16, hw + 1, top - 1, z1 - 15, "glassDark", 0.3);
  // sun deck: pools, slide, loungers
  v.box(-hw + 2, top, z0 + 9, hw - 2, top + 1, z1 - 18, p.deck);
  v.box(-4, top, z0 + 18, 4, top + 1, z0 + 26, "white");
  v.box(-3, top, z0 + 19, 3, top + 1, z0 + 25, "cyan", 0.2);
  v.box(-3, top, z0 + 12, 1, top + 1, z0 + 16, "cyan", 0.2);
  for (let z = z0 + 28; z < z1 - 20; z += 2) {
    v.put(-hw + 3, top + 1, z, "white");
    v.put(hw - 4, top + 1, z, "white");
  }
  // spiral water slide
  for (let k = 0; k < 18; k++) {
    const a = k * 0.7;
    v.put(hw - 4 + Math.round(Math.cos(a) * 2), top + 9 - Math.floor(k / 2), z0 + 9 + Math.round(Math.sin(a) * 2), k % 2 ? "yellow" : p.accent === "red" ? "red" : "magenta");
  }
  v.box(hw - 5, top, z0 + 8, hw - 3, top + 9, z0 + 10, "white");
  funnel(c, 0, z0 + 16, top + 1, 8, 2.3, p.funnel, p.accent);
  if (beam >= 20) funnel(c, 0, z0 + 11, top + 1, 6, 1.8, p.funnel, p.accent);
  radar(c, 0, top + 4, z1 - 17, 6, "white");
  v.box(0, top, z1 - 17, 1, top + 4, z1 - 16, "steelDark");
  for (const z of [z0 + 6, z0 + 12, z0 + 18, z0 + 24, z0 + 30]) {
    if (z + 4 > z1 - 16) break;
    v.box(-hw - 1, dy + 2, z, -hw, dy + 3, z + 4, "orange");
    v.box(hw, dy + 2, z, hw + 1, dy + 3, z + 4, "orange");
  }
  for (let i = 0; i < 8; i++) crew(c, c.ri(-hw + 3, hw - 4), top + 1, c.ri(z0 + 9, z1 - 20), c.pick(["red", "yellow", "pink", "sky", "white", "orange"]));
  flag(v, 0, dy, z1 - 4, 5, [p.accent, "white"]);
  wake(v, 0, z0, beam - 6, 2, -hz);
}

// =============================================================================================
// SAIL BOATS — rig grows: dinghy → sloop → schooner → brigantine → full-rigged tall ship
//  V0 Yacht-Club White (white hull, white sails)  V1 Classic Varnished Wood (cream sails, green bottom)
//  V2 Pirate (black hull, gold stripe, charcoal sails, skull flag)  V3 Regatta Racer (sky hull, rainbow sails)
// =============================================================================================
const SAIL_PAL = [
  { hull: "white", bottom: "blueDark", stripe: "blueDark", deck: "woodLight", sail: "white", sail2: "silver", accent: "blueDark", flag: ["blue", "white", "blue"] },
  { hull: "oak", bottom: "#2f6b3f", stripe: "gold", deck: "woodLight", sail: "cream", sail2: "#e6d3a8", accent: "gold", flag: ["red", "white", "red"] },
  { hull: "#25262b", bottom: "redDark", stripe: "gold", deck: "woodDark", sail: "#3b3d44", sail2: "#55575e", accent: "gold", flag: ["black", "white", "black"] },
  { hull: "sky", bottom: "white", stripe: "yellow", deck: "woodLight", sail: "white", sail2: "yellow", accent: "red", flag: ["yellow", "red", "yellow"] },
];

function buildSailBoat(c: Ctx): void {
  const { v, lv, hz } = c;
  const s = c.variant % 4;
  const p = SAIL_PAL[s];
  const rainbow = ["red", "orange", "yellow", "lime", "sky", "purple"];
  const sailPaint = (y: number, z: number): string => {
    if (s === 3) return rainbow[Math.floor(y / 3) % rainbow.length];
    if (s === 2) return (y + z) % 7 === 0 ? p.sail2 : p.sail;
    return (y % 4 === 0) ? p.sail2 : p.sail;
  };
  const sqPaint = (x: number, y: number): string => {
    if (s === 3) return rainbow[(Math.floor(y / 2) + 6) % rainbow.length];
    if (s === 2) return x === 0 && y % 7 === 3 ? "white" : p.sail;
    return y % 3 === 0 ? p.sail2 : p.sail;
  };
  const z0 = -hz + 2;
  const z1 = hz - 1;
  if (lv === 1) {
    const o: HullOpts = { z0: -6, z1: 7, beam: 6, h: 3, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 1, deck: p.deck, bow: 5, open: true };
    const dy = hull(v, o);
    v.box(0, dy - 1, 1, 1, dy + 13, 2, "silver");
    triSail(v, 0, dy + 1, dy + 13, 1, 7, sailPaint);
    v.box(0, dy, -6, 1, dy + 1, 1, "steelDark");
    person(v, -1, dy - 1, -3, "orange", "blueDark");
    v.box(0, 0, -7, 1, 2, -6, "woodDark");
    wake(v, 0, -6, 2, 2, -hz);
    return;
  }
  if (lv === 2) {
    // Sloop: one tall mast, mainsail + jib, cabin
    const o: HullOpts = { z0, z1, beam: 8, h: 4, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 2, deck: p.deck, bow: 9, rail: p.hull };
    const dy = hull(v, o);
    v.box(-2, dy, -5, 2, dy + 2, 3, p.hull === "#25262b" ? "woodDark" : "white");
    v.box(-2, dy + 1, -5, 2, dy + 2, 3, "glassDark", 0.3);
    v.box(-2, dy + 2, -5, 2, dy + 3, 3, p.deck);
    const mz = 3;
    v.box(0, dy, mz, 1, dy + 24, mz + 1, "silver");
    v.box(0, dy + 3, mz - 12, 1, dy + 4, mz, "steelDark");
    triSail(v, 0, dy + 4, dy + 24, mz, 11, sailPaint);
    triSail(v, 0, dy + 2, dy + 20, mz, 9, s === 3 ? "yellow" : p.sail, 1);
    v.put(0, dy + 24, mz, "red", 0.8);
    crew(c, -1, dy, -8, "red");
    crew(c, 1, dy, -9, "white");
    wake(v, 0, z0, 3, 3, -hz);
    return;
  }
  if (lv === 3) {
    // Schooner: two gaff-rigged masts + jibs + bowsprit
    const o: HullOpts = { z0, z1: z1 - 2, beam: 9, h: 4, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 2, deck: p.deck, bow: 8, rail: p.accent, bulwark: p.hull };
    const dy = hull(v, o);
    v.box(0, dy - 1, z1 - 3, 1, dy, z1, "woodDark");
    v.box(-2, dy, -9, 2, dy + 2, -4, "woodDark");
    v.box(-1, dy + 1, -9, 1, dy + 2, -4, "glass", 0.4);
    for (const [mz, mh] of [[6, 20], [-3, 24]] as const) {
      v.box(0, dy, mz, 1, dy + mh, mz + 1, "woodDark");
      // gaff sail: quadrilateral
      for (let y = dy + 2; y < dy + mh - 2; y++) {
        const l = 8 - Math.floor((y - dy) * 0.12);
        for (let k = 1; k <= l; k++) v.put(0, y, mz - k, sailPaint(y, mz - k));
      }
      v.box(0, dy + mh - 2, mz - 7, 1, dy + mh - 1, mz, "woodDark");
      v.put(0, dy + mh, mz, p.flag[0]);
    }
    triSail(v, 0, dy + 1, dy + 18, 6, 9, s === 3 ? "lime" : p.sail, 1);
    crew(c, 1, dy, -6, "white");
    wake(v, 0, z0, 3, 3, -hz);
    return;
  }
  // Lv4 brigantine & Lv5 tall ship
  const big = lv === 5;
  const beam = big ? 16 : 12;
  const o: HullOpts = { z0, z1: z1 - 3, beam, h: big ? 6 : 5, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: big ? 4 : 3, deck: p.deck, bow: big ? 12 : 10, stern: 2, rail: p.accent, bulwark: p.hull };
  const dy = hull(v, o);
  // gun ports / lit windows
  for (let z = o.z0 + 4; z < o.z1 - 6; z += 3) {
    const r = hullRange(o, dy - 3, z);
    if (!r) continue;
    const col = s === 2 ? "black" : "glass";
    v.put(r[0], dy - 3, z, col, s === 2 ? 0 : 0.4);
    v.put(r[1] - 1, dy - 3, z, col, s === 2 ? 0 : 0.4);
  }
  // bowsprit + figurehead
  for (let k = 0; k < (big ? 7 : 5); k++) v.put(0, dy + Math.floor(k / 2), o.z1 - 2 + k, "woodDark");
  v.put(0, dy - 2, o.z1, "gold");
  // raised stern castle with lantern
  const hw = Math.floor(beam / 2);
  v.box(-hw + 1, dy, o.z0 + 1, hw - 1, dy + 3, o.z0 + (big ? 9 : 7), p.hull);
  v.box(-hw + 2, dy + 1, o.z0 + 1, hw - 2, dy + 2, o.z0 + 2, "warmGlow", 0.8);
  v.box(-hw + 1, dy + 3, o.z0 + 1, hw - 1, dy + 4, o.z0 + (big ? 9 : 7), p.accent);
  v.put(0, dy + 4, o.z0 + 1, "amber", 1.2);
  const masts: { z: number; h: number; square: boolean }[] = big
    ? [{ z: 10, h: 34, square: true }, { z: -1, h: 38, square: true }, { z: -11, h: 30, square: true }]
    : [{ z: 9, h: 28, square: true }, { z: -4, h: 30, square: false }];
  for (const m of masts) {
    v.box(0, dy, m.z, 1, dy + m.h, m.z + 1, "woodDark");
    if (m.square) {
      const tiers = big ? 4 : 3;
      let y = dy + 4;
      const segH = Math.floor((m.h - 6) / tiers);
      for (let t = 0; t < tiers; t++) {
        const w = Math.max(5, (big ? 16 : 13) - t * 3);
        squareSail(v, 0, y, y + segH - 1, m.z + 1, w, sqPaint);
        y += segH;
      }
      // crow's nest
      v.box(-1, dy + m.h - 5, m.z - 1, 2, dy + m.h - 4, m.z + 2, "woodDark");
    } else {
      for (let y = dy + 3; y < dy + m.h - 3; y++) {
        const l = 10 - Math.floor((y - dy) * 0.12);
        for (let k = 1; k <= l; k++) v.put(0, y, m.z - k, sailPaint(y, m.z - k));
      }
      v.box(0, dy + m.h - 3, m.z - 9, 1, dy + m.h - 2, m.z, "woodDark");
    }
    // pennant
    v.box(1, dy + m.h - 1, m.z, 4, dy + m.h, m.z + 1, p.flag[1] === "white" && s === 2 ? "black" : p.flag[0]);
    // shrouds (rigging) down to the rails
    for (let k = 1; k < hw; k++) {
      const yy = dy + m.h - 6 - Math.floor(k * ((m.h - 8) / hw));
      v.put(-k, yy, m.z, "woodDark");
      v.put(k, yy, m.z, "woodDark");
    }
  }
  // jibs from foremast to bowsprit
  triSail(v, 0, dy + 2, dy + (big ? 24 : 20), masts[0].z, big ? 11 : 9, s === 3 ? "orange" : p.sail, 1);
  // pirate skull flag / ensign at stern
  const fy = dy + 4;
  v.box(0, fy, o.z0, 1, fy + 8, o.z0 + 1, "woodDark");
  v.box(1, fy + 5, o.z0, 5, fy + 8, o.z0 + 1, s === 2 ? "black" : p.flag[0]);
  if (s === 2) v.put(3, fy + 6, o.z0, "white");
  for (let i = 0; i < (big ? 5 : 3); i++) crew(c, c.ri(-hw + 2, hw - 3), dy, c.ri(o.z0 + 10, o.z1 - 6), s === 2 ? c.pick(["red", "black", "white"]) : c.pick(["white", "blue", "red"]));
  wake(v, 0, z0, beam - 6, 2, -hz);
}

// =============================================================================================
// SPEED BOATS — jet ski → runabout → cigarette racer → flybridge cruiser → megayacht with helipad
//  V0 Racing Red/White   V1 Black & Gold Luxury   V2 Miami Vice (pink/teal)   V3 Riva Mahogany Classic
// =============================================================================================
const SPEED_PAL = [
  { hull: "white", bottom: "red", stripe: "red", deck: "white", accent: "red", glass: "glassDark", cabin: "white" },
  { hull: "#1f2024", bottom: "gold", stripe: "gold", deck: "charcoal", accent: "gold", glass: "glassDark", cabin: "#1f2024" },
  { hull: "white", bottom: "teal", stripe: "pink", deck: "white", accent: "magenta", glass: "teal", cabin: "white" },
  { hull: "#8a4a2a", bottom: "cream", stripe: "cream", deck: "#a0603a", accent: "cream", glass: "glass", cabin: "cream" },
];

function buildSpeedBoat(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const p = SPEED_PAL[c.variant % 4];
  if (lv === 1) {
    // Jet ski + rider + spray
    v.box(-1, 0, -3, 2, 2, 3, p.hull);
    v.box(0, 0, 3, 1, 1, 5, p.hull);
    v.box(-1, 0, -3, 2, 1, 3, p.accent);
    v.box(0, 2, -2, 1, 3, 1, "charcoal");
    v.box(-1, 3, 1, 2, 4, 2, "steelDark");
    person(v, 0, 2, -1, p.accent === "cream" ? "red" : p.accent, "black");
    v.put(0, 5, -1, "yellow");
    for (let k = 0; k < 4; k++) {
      v.put(0, 1 + Math.floor(k / 2), -4 - k, "foam", 0.3);
      v.put(-2 - Math.floor(k / 2), 0, -3 - k, "foam", 0.2);
      v.put(3 + Math.floor(k / 2), 0, -3 - k, "foam", 0.2);
    }
    return;
  }
  const z0 = -hz + 3;
  const z1 = hz - 1;
  if (lv === 2) {
    const o: HullOpts = { z0: -6, z1: 8, beam: 6, h: 3, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 1, deck: p.deck, bow: 6, rake: 1 };
    const dy = hull(v, o);
    v.box(-2, dy - 1, -4, 2, dy, 1, "leather");
    v.box(-2, dy, 1, 2, dy + 1, 2, p.glass, 0.4);
    v.box(-1, dy, -4, 1, dy + 1, -3, "white");
    v.box(-1, 0, -7, 1, 4, -6, "charcoal");
    person(v, -1, dy - 1, -1, "sky", "white");
    person(v, 0, dy - 1, -3, "yellow", "red");
    wake(v, 0, -6, 4, 2, -hz);
    return;
  }
  if (lv === 3) {
    // Cigarette racer: long narrow arrow hull, twin outboards, rooster tail
    const o: HullOpts = { z0, z1, beam: 7, h: 3, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 1, deck: p.deck, bow: 14, rake: 1.2, rail: p.accent };
    const dy = hull(v, o);
    for (let z = z0 + 2; z < z1 - 4; z++) v.put(0, dy - 1, z, p.accent);
    v.box(-2, dy - 1, -6, 3, dy, -1, "leather");
    v.box(-2, dy, -1, 3, dy + 1, 0, p.glass, 0.45);
    v.box(-3, 0, z0 - 1, -1, 4, z0, "charcoal");
    v.box(1, 0, z0 - 1, 3, 4, z0, "charcoal");
    person(v, 0, dy - 1, -3, "white", "black");
    for (let k = 0; k < 3; k++) v.box(-1, 1 + k, z0 - 2 - k, 2, 2 + k, z0 - 1 - k, "foam", 0.3);
    wake(v, 0, z0 - 1, 6, 3, -hz);
    return;
  }
  if (lv === 4) {
    // Flybridge cabin cruiser
    const o: HullOpts = { z0, z1, beam: 10, h: 4, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 2, deck: p.deck, bow: 10, rake: 0.8, rail: p.hull };
    const dy = hull(v, o);
    v.box(-4, dy, -8, 4, dy + 4, 4, p.cabin);
    v.box(-4, dy + 1, -8, 4, dy + 3, 4, p.glass, 0.35);
    v.box(-3, dy + 1, -7, 3, dy + 4, 3, p.cabin);
    v.box(-4, dy + 4, -9, 4, dy + 5, 3, p.cabin);
    v.box(-3, dy + 5, -6, 3, dy + 6, 1, "leather");
    for (const x of [-3, 2]) v.box(x, dy + 5, -8, x + 1, dy + 8, -7, "silver");
    v.box(-3, dy + 8, -9, 4, dy + 9, -4, p.accent === "gold" ? "gold" : "white");
    v.put(0, dy + 9, -6, "steelDark");
    radar(c, 0, dy + 9, -6, 4, "white", 2);
    v.box(-4, 1, z0 - 1, 4, 2, z0, p.deck);
    person(v, -1, dy + 5, -3, "white", "blueDark");
    person(v, 2, dy, -11, "pink", "white");
    wake(v, 0, z0 - 1, 6, 2, -hz);
    return;
  }
  // Lv5 Megayacht: tiered streamlined decks, bow helipad w/ helicopter, aft jacuzzi, tender
  const beam = Math.min(18, hx * 2 - 6);
  const o: HullOpts = { z0, z1, beam, h: 6, col: p.hull, bottom: p.bottom, stripe: p.stripe, stripeY: 4, deck: p.deck === "white" ? "woodLight" : p.deck, bow: 14, rake: 0.9, stern: 2, rail: p.hull };
  const dy = hull(v, o);
  const hw = Math.floor(beam / 2);
  for (let z = z0 + 3; z < z1 - 12; z += 2) {
    const r = hullRange(o, 3, z);
    if (r) {
      v.put(r[0], 3, z, "glassDark", 0.4);
      v.put(r[1] - 1, 3, z, "glassDark", 0.4);
    }
  }
  const tiers = [
    { a: z0 + 4, b: z1 - 14, w: hw - 1 },
    { a: z0 + 8, b: z1 - 18, w: hw - 2 },
    { a: z0 + 12, b: z1 - 22, w: hw - 3 },
  ];
  let y = dy;
  for (const t of tiers) {
    v.box(-t.w, y, t.a, t.w, y + 3, t.b, p.cabin);
    v.clear(-t.w + 1, y, t.a + 1, t.w - 1, y + 2, t.b - 1);
    v.box(-t.w, y + 1, t.a, t.w, y + 2, t.b, p.glass === "glass" ? "glassDark" : p.glass, 0.35);
    // raked front
    v.box(-t.w + 1, y + 2, t.b, t.w - 1, y + 3, t.b + 1, p.cabin);
    v.box(-t.w - 1, y + 3, t.a - 1, t.w + 1, y + 4, t.b + 1, p.cabin);
    y += 4;
  }
  // mast + radar domes
  v.box(-1, y, z1 - 26, 1, y + 4, z1 - 24, p.cabin);
  v.sphere(-1.5, y + 5, z1 - 25, 1.4, 1.4, 1.4, "white");
  radar(c, 0, y + 4, z1 - 25, 6, p.accent === "gold" ? "gold" : "white", 2);
  // bow helipad + helicopter
  const hz2 = z1 - 9;
  helipad(v, 0, dy, hz2, 4.5);
  helicopter(c, 0, dy + 1, hz2, p.accent === "gold" ? "gold" : p.accent === "magenta" ? "magenta" : "white", "z", 10);
  // aft jacuzzi + loungers
  v.box(-3, dy, z0 + 1, 3, dy + 1, z0 + 4, "white");
  v.box(-2, dy, z0 + 2, 2, dy + 1, z0 + 3, "cyan", 0.3);
  for (const x of [-hw + 2, hw - 3]) v.box(x, dy, z0 + 1, x + 1, dy + 1, z0 + 3, "white");
  // tender on swim platform
  v.box(-2, 1, z0 - 2, 3, 2, z0, p.accent === "gold" ? "gold" : "orange");
  crew(c, -2, dy, z0 + 1, "pink", "white");
  crew(c, 3, dy + 4, z0 + 9, "white", "blueDark");
  flag(v, 0, dy, z0 + 1, 4, ["red", "white", "red"]);
  wake(v, 0, z0 - 2, beam - 6, 2, -hz);
}

// =============================================================================================
// NAVAL VESSELS — patrol boat → corvette → frigate → destroyer → battleship
//  V0 Modern Haze-Grey   V1 WWII Dazzle Camo   V2 Coast-Guard White (racing stripe)   V3 Stealth Charcoal
// =============================================================================================
const NAVY_PAL = [
  { hull: "#8b97a3", bottom: "redDark", deck: "#5d6670", sup: "#a7b1bb", accent: "steelDark", gun: "#6f7a85" },
  { hull: "#9aa6b0", bottom: "redDark", deck: "woodLight", sup: "#b5bfc8", accent: "blueDark", gun: "#59636d" },
  { hull: "white", bottom: "redDark", deck: "#6a737c", sup: "white", accent: "red", gun: "#7d8790" },
  { hull: "#3d4248", bottom: "black", deck: "#2b2f34", sup: "#4a5057", accent: "#7ad0ff", gun: "#2b2f34" },
];

function navyPaint(s: number, hullCol: string): ((x: number, y: number, z: number) => string | undefined) | undefined {
  if (s === 1) {
    return (x, y, z) => {
      if (y === 0) return undefined;
      const band = Math.floor((z + y * 2 + (x > 0 ? 3 : 0)) / 5) % 4;
      return band === 0 ? "#2c3e5a" : band === 1 ? "white" : band === 2 ? "#6f8aa8" : hullCol;
    };
  }
  if (s === 2) {
    return (_x, y, z) => {
      if (y === 0) return undefined;
      const d = z - y * 1;
      if (d >= 6 && d < 9) return "red";
      if (d >= 9 && d < 10) return "blue";
      return undefined;
    };
  }
  return undefined;
}

function buildNavalVessel(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = NAVY_PAL[s];
  const z0 = -hz + 2;
  const z1 = hz - 1;
  const beam = byLvN(lv, [6, 8, 10, 12, Math.min(20, hx * 2 - 8)]);
  const h = byLvN(lv, [3, 4, 4, 5, 6]);
  const stealth = s === 3;
  const paintFn = navyPaint(s, p.hull);
  const o: HullOpts = {
    z0,
    z1,
    beam,
    h,
    col: p.hull,
    bottom: p.bottom,
    deck: p.deck,
    bow: Math.round(beam * (lv === 5 ? 1.4 : 1.6)),
    rake: stealth ? -0.4 : 0.7,
    stern: 1,
    rail: p.hull,
    paint: paintFn,
  };
  if (stealth) o.rake = 0.2;
  const dy = hull(v, o);
  const hw = Math.floor(beam / 2);
  // hull number on bow
  const r0 = hullRange(o, h - 2, z1 - beam - 2);
  if (r0 && h > 3) {
    v.put(r0[0], h - 2, z1 - beam - 2, "white");
    v.put(r0[1] - 1, h - 2, z1 - beam - 2, "white");
  }
  const sup = (x0: number, y0: number, za: number, x1: number, y1: number, zb: number): void => {
    if (stealth) {
      // faceted pyramid-ish block
      for (let y = y0; y < y1; y++) {
        const k = Math.floor((y - y0) / 2);
        v.box(x0 + k, y, za + k, x1 - k, y + 1, zb - k, p.sup);
      }
      v.box(x0 + 1, y0 + 2, zb - 1 - Math.floor(2 / 2), x1 - 1, y0 + 3, zb - Math.floor(2 / 2), "glassDark", 0.3);
    } else {
      v.box(x0, y0, za, x1, y1, zb, p.sup);
      v.box(x0 + 1, y1 - 2, zb - 1, x1 - 1, y1 - 1, zb, "glassDark", 0.3);
    }
  };
  if (lv === 1) {
    // patrol boat
    sup(-2, dy, -3, 2, dy + 4, 2);
    mast(v, 0, dy + 4, -1, 4, p.accent, 1);
    radar(c, 0, dy + 8, -1, 4, "white", 2.4);
    turret(v, 0, dy, 4, 2, 1, 2, 1, p.gun);
    v.put(-2, 0, z0 - 1, "foam");
    v.put(1, 0, z0 - 1, "foam");
    flag(v, 0, dy, z0, 3, ["red", "white", "blue"]);
    return;
  }
  if (lv === 2) {
    // corvette
    sup(-3, dy, -6, 3, dy + 5, 2);
    v.box(-2, dy + 5, -4, 2, dy + 7, 1, p.sup);
    mast(v, 0, dy + 7, -2, 5, p.accent, 2);
    radar(c, 0, dy + 12, -2, 4, "white");
    c.blink(0, dy + 13, -2, "red");
    turret(v, 0, dy, 6, 3, 1, 3, 1, p.gun);
    v.box(-3, dy, -10, 3, dy + 2, -7, p.gun);
    for (let x = -2; x < 3; x += 2) v.put(x, dy + 2, -9, "steelDark");
    flag(v, 0, dy, z0, 3, ["red", "white", "blue"]);
    wake(v, 0, z0, 4, 2, -hz);
    return;
  }
  if (lv === 3) {
    // frigate: superstructure, funnel, hangar + helideck aft with helicopter
    sup(-4, dy, -6, 4, dy + 6, 4);
    v.box(-3, dy + 6, -4, 3, dy + 8, 2, p.sup);
    mast(v, 0, dy + 8, -1, 7, p.accent, 3);
    radar(c, 0, dy + 15, -1, 6, "white");
    c.blink(0, dy + 16, -1, "red");
    funnel(c, 0, -9, dy, 6, 1.6, p.sup, "black", "dark");
    turret(v, 0, dy, 9, 3, 1, 4, 1, p.gun);
    v.box(-3, dy, 5, 3, dy + 1, 7, p.gun);
    v.box(-4, dy, -13, 4, dy + 4, -11, p.sup);
    helipad(v, 0, dy - 1, -17, 3.6);
    helicopter(c, 0, dy, -17, s === 2 ? "red" : p.gun, "z", 0.001);
    flag(v, 0, dy, z0, 3, ["red", "white", "blue"]);
    wake(v, 0, z0, 6, 2, -hz);
    return;
  }
  if (lv === 4) {
    // destroyer: twin gun turrets, VLS grid, tall integrated mast, helideck
    sup(-5, dy, -8, 5, dy + 7, 5);
    sup(-4, dy + 7, -6, 4, dy + 10, 3);
    mast(v, 0, dy + 10, -2, 9, p.accent, 3);
    radar(c, 0, dy + 19, -2, 6, "white");
    c.blink(0, dy + 20, -2, "red");
    // fixed phased-array panels
    v.box(-2, dy + 7, 3, 2, dy + 10, 4, "#4c5a6a");
    funnel(c, 0, -12, dy, 6, 1.8, p.sup, "black", "dark");
    turret(v, 0, dy, 14, 3, 1, 4, 1, p.gun);
    for (let x = -3; x < 4; x += 2) for (let z = 8; z < 12; z += 2) v.put(x, dy, z, "steelDark");
    turret(v, 0, dy, -18, 3, 1, 4, -1, p.gun);
    helipad(v, 0, dy - 1, z0 + 5, 3.6);
    flag(v, 0, dy, z0, 4, ["red", "white", "blue"]);
    wake(v, 0, z0, 8, 2, -hz);
    return;
  }
  // Lv5 battleship: three triple turrets, pagoda tower, twin funnels, AA guns
  const big = hw >= 9;
  turret(v, 0, dy, z1 - 20, big ? 7 : 5, 3, big ? 9 : 6, 1, p.gun);
  turret(v, 0, dy + 3, z1 - 30, big ? 7 : 5, 3, big ? 9 : 6, 1, p.gun);
  v.box(-3, dy, z1 - 33, 3, dy + 3, z1 - 27, p.gun);
  turret(v, 0, dy, z0 + 9, big ? 7 : 5, 3, big ? 8 : 6, -1, p.gun);
  // pagoda superstructure
  sup(-6, dy, -6, 6, dy + 6, 8);
  sup(-5, dy + 6, -4, 5, dy + 12, 6);
  sup(-4, dy + 12, -2, 4, dy + 17, 5);
  v.box(-3, dy + 17, 0, 3, dy + 20, 4, p.sup);
  v.box(-3, dy + 18, 3, 3, dy + 19, 4, "glassDark", 0.4);
  mast(v, 0, dy + 20, 1, 7, p.accent, 3);
  radar(c, 0, dy + 27, 1, 8, "white", 1.4);
  c.blink(0, dy + 28, 1, "red");
  funnel(c, 0, -10, dy + 2, 9, 2.4, p.sup, "black", "dark");
  funnel(c, 0, -16, dy, 8, 2, p.sup, "black", "dark");
  // AA gun tubs along the sides
  for (let z = -18; z < 10; z += 4) {
    for (const x of [-hw + 2, hw - 3]) {
      v.box(x, dy, z, x + 1, dy + 1, z + 2, p.gun);
      v.put(x, dy + 1, z + 1, "steelDark");
    }
  }
  flag(v, 0, dy, z0, 6, ["red", "white", "blue"]);
  wake(v, 0, z0, 12, 2, -hz);
}

function byLvN(lv: number, arr: [number, number, number, number, number]): number {
  return arr[Math.max(1, Math.min(5, lv)) - 1];
}
function byLv<T>(c: Ctx, arr: readonly [T, T, T, T, T]): T {
  return arr[Math.max(1, Math.min(5, c.lv)) - 1];
}

// =============================================================================================
// SUBMARINES — mini-sub → diesel attack sub → nuclear attack sub → missile sub (hatches open) → Typhoon twin-hull
//  V0 Modern Black   V1 WWII U-Boat Grey (deck gun)   V2 Yellow Submarine (portholes, whimsy)   V3 Steampunk Nautilus (brass & copper)
// =============================================================================================
const SUB_PAL = [
  { hull: "#2a2d33", belly: "black", sail: "#2a2d33", accent: "redDark", prop: "brass" },
  { hull: "#7b858f", belly: "#4d555e", sail: "#6a737c", accent: "white", prop: "brass" },
  { hull: "yellow", belly: "orange", sail: "yellow", accent: "red", prop: "red" },
  { hull: "#3a6b67", belly: "copper", sail: "brass", accent: "copper", prop: "brass" },
];

function buildSubmarine(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = SUB_PAL[s];
  const z0 = -hz + 3;
  const z1 = hz - 1;
  const r = byLvN(lv, [3, 3.5, 4.2, 5, 5]);
  const twin = lv === 5 && hx >= 16;
  const cxs = twin ? [-5, 5] : [0];
  let top = 0;
  for (const cx of cxs) top = Math.max(top, subHull(v, cx, z0, z1, r, p.hull, p.belly, 0.2, lv >= 4));
  if (twin) {
    // flat casing over both hulls
    for (let z = z0 + 6; z < z1 - 4; z++) v.box(-7, top - 1, z, 7, top, z + 1, p.hull);
    top = top;
  }
  const L = z1 - z0;
  const sailZ = lv === 1 ? 0 : twin ? Math.floor(z0 + L * 0.35) : Math.floor(z0 + L * 0.62);
  const sh = byLvN(lv, [2, 4, 5, 6, 7]);
  const sl = byLvN(lv, [3, 5, 6, 7, 9]);
  const sw = lv === 1 ? 2 : 2;
  if (lv === 1) {
    // mini-sub: bubble window nose, thrusters, little light
    v.sphere(0, 2, z1 - 2, 2.2, 2.2, 2.2, "glass", 0.5);
    v.box(-1, top, -1, 1, top + 2, 2, p.sail);
    v.box(0, top + 2, 0, 1, top + 4, 1, "steelDark");
    v.put(0, top + 4, 0, "red", 1);
    c.blink(0, top + 4, 0, "red");
    v.box(-4, 1, z0 + 1, -3, 3, z0 + 3, p.accent);
    v.box(3, 1, z0 + 1, 4, 3, z0 + 3, p.accent);
    v.put(-1, 2, z1, "warmGlow", 1.2);
    screwProp(c, 0, 1.5, z0 - 0.5, 1, p.prop, 8);
    return;
  }
  // sail / conning tower
  const sx0 = twin ? -2 : -sw / 2;
  const tz0 = sailZ - Math.floor(sl / 2);
  if (s === 1) {
    // U-boat style wide conning tower with rail & deck gun
    v.box(-2, top - 1, tz0 - 1, 2, top + sh - 1, tz0 + sl, p.sail);
    v.box(-2, top + sh - 1, tz0 - 1, 2, top + sh, tz0 + sl, "steelDark");
    v.clear(-1, top + sh - 1, tz0, 1, top + sh, tz0 + sl - 1);
    v.box(0, top, tz0 + sl + 2, 1, top + 2, tz0 + sl + 3, "#59636d");
    v.box(0, top + 1, tz0 + sl + 3, 1, top + 2, tz0 + sl + 7, "steelDark");
    // deck rail along spine
    for (let z = z0 + 6; z < z1 - 6; z++) v.put(0, top - 1, z, "woodDark");
    person(v, 0, top + sh - 2, tz0 + 2, "#6a737c", "black");
  } else if (s === 3) {
    // Nautilus: ornate brass dorsal fin + big viewing windows + bow ram spikes
    for (let y = 0; y < sh + 2; y++) v.box(sx0, top - 1 + y, tz0 + y, sx0 + sw, top + y, tz0 + sl + 2 - Math.floor(y / 2), p.sail);
    for (let z = z0 + 6; z < z1 - 8; z += 5) {
      v.put(-Math.ceil(r) + 1, 2, z, "warmGlow", 0.9);
      v.put(Math.ceil(r) - 2, 2, z, "warmGlow", 0.9);
    }
    for (let k = 0; k < 4; k++) v.put(0, 1 + (k % 2), z1 + k - 1, "brass");
    for (let z = z0 + 3; z < z1 - 3; z += 3) v.put(0, top - 1, z, "copper");
  } else {
    v.box(sx0, top - 1, tz0, sx0 + sw, top + sh, tz0 + sl, p.sail);
    v.box(sx0, top + sh - 1, tz0 + sl - 1, sx0 + sw, top + sh, tz0 + sl, s === 2 ? "glass" : p.sail, 0.2);
    // fairwater planes
    v.box(sx0 - 3, top + Math.floor(sh / 2), tz0 + Math.floor(sl / 2), sx0 + sw + 3, top + Math.floor(sh / 2) + 1, tz0 + Math.floor(sl / 2) + 2, p.sail);
    if (s === 2) {
      for (let z = z0 + 5; z < z1 - 6; z += 3) {
        v.put(-Math.ceil(r) + 1, 2, z, "white", 0.4);
        v.put(Math.ceil(r) - 2, 2, z, "white", 0.4);
      }
    }
  }
  // periscope + masts
  const pTop = top + sh + (s === 1 ? 2 : 3);
  v.box(0, top + sh - 1, tz0 + 1, 1, pTop, tz0 + 2, "steelDark");
  v.put(0, pTop, tz0 + 2, s === 2 ? "red" : "steelDark");
  v.box(-1, top + sh - 1, tz0 + 3, 0, pTop - 1, tz0 + 4, "steelDark");
  if (lv >= 3) c.blink(-1, pTop - 1, tz0 + 3, "red");
  // stern rudder + planes
  const sternZ = z0 + 1;
  v.box(0, 1, sternZ, 1, Math.ceil(r) + 3, sternZ + 3, p.sail);
  v.box(-Math.ceil(r) - 1, 1, sternZ, Math.ceil(r) + 1, 2, sternZ + 2, p.sail);
  for (const cx of cxs) screwProp(c, cx, 1.5, z0 - 0.5, Math.max(2, Math.round(r * 0.5)), p.prop, 7);
  if (lv >= 4) {
    // missile deck with open hatches
    const rows = twin ? [-3, 2] : [-2, 1];
    const zs = twin ? sailZ + Math.floor(sl / 2) + 3 : z0 + 6;
    const ze = twin ? z1 - 10 : tz0 - 2;
    let n = 0;
    for (let z = zs; z < ze; z += 3) {
      for (const x of rows) {
        n++;
        v.box(x, top - 1, z, x + 2, top, z + 2, "black");
        if (n % 3 !== 0) {
          // hatch lid standing up + missile nose
          v.box(x, top, z + 2, x + 2, top + 2, z + 3, p.hull);
          v.put(x, top - 1, z, "white");
          v.put(x, top, z, s === 2 ? "red" : "white");
        }
      }
    }
  }
  // crew on deck
  if (lv >= 2) person(v, 1, top - 1, z1 - 8, s === 2 ? "sky" : "#3a4a5a", "black");
  if (lv >= 4) person(v, -1, top - 1, z1 - 10, s === 2 ? "pink" : "#3a4a5a", "black");
  // bubbles / wake
  v.put(-1, 0, z0 - 2, "foam", 0.3);
  v.put(1, 0, z0 - 3, "foam", 0.3);
  v.put(0, 0, z0 - 2, "foam", 0.3);
}

// =============================================================================================
// AIRCRAFT CARRIERS — seaplane tender → escort carrier → fleet carrier → supercarrier → nuclear supercarrier (angled deck)
//  V0 Modern Grey (jets)   V1 WWII Wooden Deck (prop fighters)   V2 Royal Navy Ski-Jump   V3 Neon Stealth (black, cyan deck lights, drones)
// =============================================================================================
const CARRIER_PAL = [
  { hull: "#8b97a3", bottom: "redDark", deck: "#4a4f56", island: "#a7b1bb", line: "white", plane: "#b9c3cc" },
  { hull: "#6f7c88", bottom: "redDark", deck: "#b88a57", island: "#7f8b96", line: "white", plane: "#3c5a82" },
  { hull: "#7c8a99", bottom: "black", deck: "#56606a", island: "#8f9cab", line: "yellow", plane: "#9fb0c2" },
  { hull: "#25282d", bottom: "black", deck: "#1b1d21", island: "#33373d", line: "#4fe3ff", plane: "#2f3338" },
];

function buildCarrier(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = CARRIER_PAL[s];
  const z0 = -hz + 2;
  const z1 = hz - 1;
  const lineEmit = s === 3 ? 1 : 0;
  const plane = (x: number, y: number, z: number, dir: "z" | "-z" | "x" | "-x"): void => {
    if (s === 1) propPlane(v, x, y, z, dir, p.plane, "white");
    else if (s === 3 && c.rand() < 0.5) stealthWing(v, x, y, z, dir, p.plane);
    else jet(v, x, y, z, dir, p.plane, s === 3 ? "#4fe3ff" : "steelDark");
  };
  if (lv === 1) {
    // seaplane tender: hull + aft crane + seaplane on deck
    const o: HullOpts = { z0, z1, beam: 9, h: 4, col: p.hull, bottom: p.bottom, deck: p.deck, bow: 8, rail: p.hull };
    const dy = hull(v, o);
    deckhouse(c, -3, dy, 2, 3, dy + 5, 7, p.island, "glass", p.island);
    mast(v, 0, dy + 6, 4, 4, "steelDark", 2);
    radar(c, 0, dy + 10, 4, 4, "white");
    propPlane(v, 0, dy, -6, "z", s === 1 ? "#3c5a82" : s === 3 ? "#2f3338" : "silver", "red", true);
    v.box(3, dy, -12, 4, dy + 8, -11, "hazard");
    for (let k = 0; k < 5; k++) v.put(3 - k, dy + 8 - Math.floor(k / 2), -11, "hazard");
    v.box(-1, dy + 1, -11, 0, dy + 6, -10, "steelDark");
    wake(v, 0, z0, 4, 2, -hz);
    return;
  }
  const beam = byLvN(lv, [9, 12, 20, 24, 24]);
  const dw = byLvN(lv, [9, 14, 24, 28, 30]);
  const h = byLvN(lv, [4, 4, 5, 6, 6]);
  const o: HullOpts = { z0, z1: z1 - 2, beam, h, col: p.hull, bottom: p.bottom, deck: p.hull, bow: Math.round(beam * 1.2), rail: p.hull };
  hull(v, o);
  const fy = h; // flight deck layer
  const hw = Math.floor(dw / 2);
  // flight deck slab (overhangs), bow tapered
  const angled = lv === 5;
  for (let z = z0; z < z1; z++) {
    const t = z1 - 1 - z;
    let a = -hw;
    let b = hw;
    if (t < 8) {
      const f = 0.55 + 0.45 * (t / 8);
      a = Math.round(-hw * f);
      b = Math.round(hw * f);
    }
    if (angled && z >= z0 + 4 && z < z0 + Math.floor((z1 - z0) * 0.6)) a = Math.max(-hx + 1, a - 6);
    if (z < z0 + 2) {
      a += 2;
      b -= 2;
    }
    v.box(a, fy, z, b, fy + 1, z + 1, p.deck);
    // gallery edge
    v.box(a, fy - 1, z, a + 1, fy, z + 1, p.hull);
    v.box(b - 1, fy - 1, z, b, fy, z + 1, p.hull);
  }
  const top = fy + 1;
  // ski jump (Royal Navy)
  if (s === 2) {
    for (let k = 0; k < 6; k++) {
      const z = z1 - 1 - k;
      const ww = Math.round(hw * 0.55);
      v.box(-ww, top, z, ww, top + Math.max(0, 3 - Math.floor(k / 2)), z + 1, p.deck);
    }
  }
  // deck markings
  for (let z = z0 + 2; z < z1 - 3; z++) if (z % 3 !== 0) v.put(0, fy, z, p.line, lineEmit);
  for (let z = z0 + 1; z < z1 - 2; z += 2) {
    v.put(-hw + 1, fy, z, p.line, lineEmit);
    v.put(hw - 2, fy, z, p.line, lineEmit);
  }
  if (lv >= 3) {
    // angled landing strip line
    const zl = z0 + 3;
    const zh = z0 + Math.floor((z1 - z0) * 0.65);
    for (let z = zl; z < zh; z++) {
      const x = Math.round(-2 - ((z - zl) / (zh - zl)) * (hw - 3) * 0.9);
      v.put(x, fy, z, "yellow", lineEmit);
      v.put(x + 6, fy, z, p.line, lineEmit);
    }
    // catapult tracks at bow
    if (s !== 2) {
      for (const cx of [-4, 3]) for (let z = z1 - 18; z < z1 - 4; z++) v.put(cx, fy, z, "#2a2d31", 0);
    }
    // arresting wires
    for (let k = 0; k < 3; k++) v.box(-hw + 4, fy, z0 + 6 + k * 2, 3, fy + 1, z0 + 7 + k * 2, "#2a2d31");
  }
  // island on starboard (+x)
  const iz = z0 + Math.floor((z1 - z0) * 0.55);
  const il = byLvN(lv, [6, 7, 9, 11, 12]);
  const ih = byLvN(lv, [6, 6, 9, 11, 13]);
  const ix0 = hw - 5;
  if (s === 3) {
    for (let y = 0; y < ih; y++) {
      const k = Math.floor(y / 3);
      v.box(ix0 + Math.min(1, k), top + y, iz - Math.floor(il / 2) + k, hw - 1, top + y + 1, iz + Math.ceil(il / 2) - k, p.island);
    }
    v.box(ix0 + 1, top + ih - 3, iz + 1, hw - 1, top + ih - 2, iz + 2, "#4fe3ff", 1);
  } else {
    deckhouse(c, ix0, top, iz - Math.floor(il / 2), hw - 1, top + ih, iz + Math.ceil(il / 2), p.island, "glass");
    v.box(ix0, top + ih - 3, iz + Math.ceil(il / 2) - 1, hw - 1, top + ih - 1, iz + Math.ceil(il / 2), "glassDark", 0.4);
  }
  if (s === 2 && lv >= 3) {
    // twin islands
    deckhouse(c, ix0, top, iz - il - 4, hw - 1, top + ih - 2, iz - Math.floor(il / 2) - 3, p.island, "glass");
    funnel(c, hw - 3, iz - il, top + ih - 2, 3, 1.2, p.island, "black", "dark");
  }
  const mx = hw - 3;
  mast(v, mx, top + ih, iz, 6, "steelDark", 2);
  radar(c, mx, top + ih + 6, iz, lv >= 4 ? 8 : 6, "white");
  c.blink(mx, top + ih + 7, iz, "red");
  if (lv >= 4) {
    v.sphere(mx - 1.5, top + ih + 1.5, iz - 3, 1.5, 1.5, 1.5, "white");
    radarDish(c, mx - 1, top + ih, iz + 3, 2, "white", -0.9);
  }
  if (s === 0 && lv >= 2) {
    v.box(hw - 4, top + 2, iz + 1, hw - 1, top + 3, iz + 3, "white");
    v.put(hw - 3, top + ih - 4, iz + Math.ceil(il / 2), "white");
  }
  // aircraft parked on deck
  const nPlanes = byLvN(lv, [1, 3, 5, 8, 12]);
  const spots: [number, number, "z" | "-z" | "x" | "-x"][] = [];
  for (let z = z1 - 10; z > z0 + 6 && spots.length < nPlanes; z -= 9) {
    spots.push([-hw + 5, z, "x"]);
    if (spots.length < nPlanes && z < iz - il) spots.push([hw - 6, z, "-x"]);
  }
  for (const [x, z, d] of spots.slice(0, nPlanes)) plane(x, top, z, d);
  // planes on catapult ready to launch
  if (lv >= 3) plane(-4, top, z1 - 9, "z");
  if (lv >= 4) plane(3, top, z1 - 16, "z");
  if (lv >= 4) helicopter(c, -hw + 5, top, z0 + 6, s === 3 ? "#33373d" : "#6f7c88", "z", lv === 5 ? 12 : 0.001);
  // deck crew (coloured shirts)
  const shirts = ["yellow", "red", "lime", "purple", "white", "sky"];
  for (let i = 0; i < lv + 1; i++) crew(c, c.ri(-hw + 3, hw - 7), top, c.ri(z0 + 4, z1 - 8), shirts[i % shirts.length], "#3a4a5a");
  if (s === 3) {
    for (let z = z0 + 2; z < z1 - 4; z += 6) {
      c.blink(-hw + 1, fy + 1, z, "cyan");
    }
  }
  flag(v, 0, fy, z0, 4, ["red", "white", "blue"]);
  wake(v, 0, z0, beam - 6, 2, -hz);
}

// =============================================================================================
// DOCKS (coast/water) — fishing pier → boat jetty → marina → wharf → ferry terminal
//  V0 New England (weathered wood, red shacks, lobster pots)   V1 Tropical (teak, thatch huts, palms)
//  V2 Industrial (concrete piers, steel bollards, hazard edges)  V3 Mediterranean (white stucco, blue doors, terracotta)
// =============================================================================================
const DOCK_PAL = [
  { deck: "#9b8c78", pile: "woodDark", wall: "crimson", roof: "slate", trim: "white", land: "path", boat: ["red", "white", "sky", "yellow"] },
  { deck: "woodLight", pile: "wood", wall: "#d8b880", roof: "#c9a25a", trim: "woodDark", land: "sand", boat: ["teal", "orange", "yellow", "white"] },
  { deck: "concrete", pile: "concreteDark", wall: "#6c8fb3", roof: "steelDark", trim: "hazard", land: "concrete2", boat: ["orange", "blue", "white", "red"] },
  { deck: "#c7b49a", pile: "woodDark", wall: "white", roof: "terracotta", trim: "blue", land: "limestone", boat: ["blue", "yellow", "red", "teal"] },
];

function shack(c: Ctx, x0: number, y: number, z0: number, x1: number, z1: number, h: number, s: number): void {
  const v = c.v;
  const p = DOCK_PAL[s];
  v.box(x0, y, z0, x1, y + h, z1, p.wall);
  windows(c, x0, y, z0, x1, y + h, z1, { stepH: 3, h: 1, emit: 0.4, col: "glass" });
  v.box(Math.floor((x0 + x1) / 2) - 1, y, z1 - 1, Math.floor((x0 + x1) / 2) + 1, y + 3, z1, s === 3 ? "blue" : "woodDark");
  if (s === 1) {
    hip(v, x0 - 1, y + h, z0 - 1, x1 + 1, z1 + 1, p.roof);
  } else if (s === 2) {
    flatRoof(c, x0, y + h, z0, x1, z1, "concreteDark", "steelDark", false);
  } else if (s === 3) {
    v.box(x0 - 1, y + h, z0 - 1, x1 + 1, y + h + 1, z1 + 1, "white");
    gable(v, x0, y + h + 1, z0, x1, z1, "x", "terracotta");
  } else {
    gable(v, x0 - 1, y + h, z0 - 1, x1 + 1, z1 + 1, "x", p.roof, "white");
  }
}

function buildDocks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = DOCK_PAL[s];
  waterPlane(v, -hx, -hz, hx, hz);
  const bollard = s === 2 ? "steelDark" : p.pile;
  if (lv === 1) {
    pier(v, -3, -hz, 3, hz - 2, p.deck, p.pile, 4);
    person(v, 1, 2, hz - 4, "yellow", "blueDark");
    for (let k = 0; k < 4; k++) v.put(2 + k, 4 + Math.floor(k / 2), hz - 4, "woodLight");
    v.put(6, 2, hz - 4, "white");
    v.box(-2, 2, -2, 0, 4, 0, "crate");
    v.box(-2, 2, 3, -1, 3, 4, s === 0 ? "red" : "silver");
    mooredBoat(c, -6, -5, 9, 4, p.boat[0], "row");
    lamp(v, -3, 2, hz - 3, 4, "iron");
    if (s === 1) tree(v, 5, 1, -6, "palm", 1.1);
    return;
  }
  // quay / land strip at the back
  const qd = lv >= 4 ? 10 : 7;
  const qz = -hz + qd;
  v.box(-hx, 0, -hz, hx, 2, qz, p.land);
  v.box(-hx, 2, qz - 1, hx, 3, qz, s === 2 ? "hazard" : p.trim === "white" ? "stone" : p.pile);
  if (lv === 2) {
    shack(c, -hx + 2, 2, -hz + 1, -hx + 9, qz - 1, 4, s);
    // T-jetty
    pier(v, -2, qz, 2, hz - 4, p.deck, p.pile, 4);
    pier(v, -7, hz - 6, 7, hz - 2, p.deck, p.pile, 4);
    mooredBoat(c, -5, qz + 3, 10, 4, p.boat[0], "fish");
    mooredBoat(c, 5, qz + 2, 10, 4, p.boat[1], "motor");
    v.box(5, 2, -hz + 3, 6, 5, -hz + 4, "red");
    ring(v, 6.5, -hz + 3.5, 3, 4, 1.5, 0.6, "white");
    person(v, 0, 2, hz - 4, "orange", "blueDark");
    if (s === 0) for (const x of [-6, -4]) v.box(x, 2, hz - 5, x + 2, 4, hz - 3, "#8a5a3a");
    if (s === 1) tree(v, hx - 3, 2, -hz + 3, "palm", 1.2);
    lamp(v, 2, 2, hz - 3, 4);
    return;
  }
  // Lv3+ marina layout: main walkway + finger piers with boats
  const walkX = lv >= 5 ? hx - 12 : 0;
  pier(v, walkX - 2, qz, walkX + 2, hz - 1, p.deck, p.pile, 4);
  const kinds: ("sail" | "motor" | "yacht" | "fish")[] = ["sail", "motor", "yacht", "fish"];
  let bi = 0;
  for (let z = qz + 4; z < hz - 6; z += 10) {
    for (const side of [-1, 1]) {
      const fx0 = side < 0 ? Math.max(-hx + 2, walkX - 14) : walkX + 2;
      const fx1 = side < 0 ? walkX - 2 : Math.min(hx - 2, walkX + 14);
      if (fx1 - fx0 < 6) continue;
      pier(v, fx0, z, fx1, z + 2, p.deck, p.pile, 4);
      // boats moored between fingers, bow pointing +z
      const bx = side < 0 ? fx0 + Math.floor((fx1 - fx0) / 2) : fx0 + Math.floor((fx1 - fx0) / 2);
      if (z + 3 + 7 < hz - 1) mooredBoat(c, bx, z + 3, 7, 4, p.boat[bi++ % 4], kinds[bi % 4]);
    }
  }
  // bollards on the quay edge
  for (let x = -hx + 3; x < hx - 2; x += 6) v.box(x, 2, qz - 2, x + 1, 4, qz - 1, bollard);
  // harbor master hut + flag
  shack(c, -hx + 2, 2, -hz + 1, -hx + 10, qz - 2, 5, s);
  flag(v, -hx + 11, 2, qz - 3, 9, s === 3 ? ["blue", "white", "blue"] : ["red", "white", "blue"]);
  if (lv >= 4) {
    // warehouse / fish market + crane + crates
    const wx0 = -hx + 12;
    const wx1 = Math.min(hx - 2, wx0 + 14);
    if (s === 2) {
      v.box(wx0, 2, -hz + 1, wx1, 9, qz - 3, p.wall);
      barrelRoof(v, wx0, 9, -hz + 1, wx1, qz - 3, "x", "steelDark", "steel");
      v.box(wx0 + 3, 2, qz - 4, wx0 + 8, 7, qz - 3, "hazard");
    } else {
      shack(c, wx0, 2, -hz + 1, wx1, qz - 3, 6, s);
    }
    v.box(wx0 + 2, 7, qz - 3, wx1 - 2, 8, qz - 2, s === 3 ? "blue" : "red");
    for (let i = 0; i < 4; i++) v.box(hx - 6 + (i % 2) * 2, 2 + Math.floor(i / 2) * 2, -hz + 3, hx - 4 + (i % 2) * 2, 4 + Math.floor(i / 2) * 2, -hz + 5, i % 2 ? "crate" : "#3a6fb0");
    crane(v, hx - 5, 2, qz - 4, 12, 9, s === 2 ? "hazard" : "red", "z");
  }
  if (lv >= 5) {
    // ferry terminal: glass hall with wave roof + gangway + ferry at berth + breakwater lighthouse
    const tx0 = -hx + 2;
    const tx1 = walkX - 6;
    const tz0 = qz;
    const tz1 = qz + 10;
    v.box(tx0, 0, tz0, tx1, 2, tz1, p.land);
    v.box(tx0 + 1, 2, tz0, tx1 - 1, 8, tz1 - 1, "glass", 0.3);
    v.clear(tx0 + 2, 2, tz0 + 1, tx1 - 2, 7, tz1 - 2);
    for (let x = tx0 + 1; x < tx1; x += 3) v.box(x, 2, tz1 - 2, x + 1, 8, tz1 - 1, "white");
    barrelRoof(v, tx0, 8, tz0 - 1, tx1, tz1 + 1, "x", s === 3 ? "terracotta" : s === 1 ? p.roof : "white", "steelLight");
    v.box(tx0 + 4, 4, tz1 - 1, tx0 + 6, 5, tz1 + 3, "steelLight");
    // berthed ferry (bow +z)
    const fo: HullOpts = { cx: Math.floor((tx0 + tx1) / 2), z0: tz1 + 3, z1: hz - 1, beam: 12, h: 4, col: s === 3 ? "blue" : "white", bottom: "redDark", stripe: p.boat[0], stripeY: 2, deck: "woodLight", bow: 8, rail: "white" };
    const fdy = hull(v, fo);
    const fx = fo.cx ?? 0;
    deckhouse(c, fx - 5, fdy, fo.z0 + 2, fx + 5, fdy + 4, fo.z1 - 6, "white", "glass", p.boat[0]);
    funnel(c, fx, fo.z0 + 5, fdy + 5, 4, 1.2, p.boat[0], "white");
    // lighthouse on the far pier head
    const lx = hx - 4;
    const lz = hz - 4;
    v.cylinderY(lx, lz, 1, 14, 1.8, "white");
    v.cylinderY(lx, lz, 4, 6, 1.85, "red");
    v.cylinderY(lx, lz, 9, 11, 1.85, "red");
    v.box(Math.floor(lx) - 1, 14, Math.floor(lz) - 1, Math.floor(lx) + 1, 16, Math.floor(lz) + 1, "warmGlow", 1.5);
    v.cone(lx, 16, 18, lz, 1.8, 0.3, "red");
    c.blink(Math.floor(lx), 15, Math.floor(lz), "yellow");
    for (let i = 0; i < 5; i++) person(v, c.ri(tx0 + 2, tx1 - 2), 2, c.ri(-hz + 2, qz - 2), c.pick(["red", "yellow", "sky", "pink", "white"]));
  }
  if (s === 1) {
    tree(v, hx - 3, 2, -hz + 2, "palm", 1.3);
    tree(v, -hx + 1, 2, qz - 2, "palm", 1.0);
  }
  for (let x = -hx + 4; x < hx - 4; x += 10) lamp(v, x, 2, qz - 1, 5);
  person(v, walkX, 2, hz - 4, "orange", "blueDark");
}

// =============================================================================================
// SHIP BUILDING AREA (coast/water) — slipways with hulls under construction on cradles + scaffolds
//  V0 Traditional Timber (oak ribs, plank hull)   V1 Viking Longship Yard (clinker longships, dragon prows, striped sails)
//  V2 Modern Steel Slipway (red-primer plates, welding sparks)  V3 Junk Boatyard (bamboo scaffolds, teak junks, battened sails)
// =============================================================================================
function buildShipBuilding(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  waterPlane(v, -hx, -hz, hx, hz);
  const land = ["path", "sandDark", "concrete2", "sand"][s];
  const landD = Math.round(hz * 1.1);
  const lz = -hz + landD;
  v.box(-hx, 0, -hz, hx, 2, lz, land);
  v.box(-hx, 1, lz - 1, hx, 2, lz, ["stone", "stone", "hazard", "stone"][s]);
  const nSlips = byLv(c, [1, 1, 2, 2, 3] as const);
  const slipW = Math.min(14, Math.floor((hx * 2 - 14) / nSlips));
  const frame = ["#f0d9a8", "#e8cf98", "#d9dde2", "#f0d9a8"][s];
  const plank = ["#9a5f32", "#b07a45", "#b0432c", "#c68a4a"][s];
  const scaff = ["woodLight", "wood", "steelLight", "#b8a26a"][s];
  for (let i = 0; i < nSlips; i++) {
    const cx = -hx + 2 + slipW * i + Math.floor(slipW / 2);
    // inclined slipway ramp from back (y=3) into the water (+z)
    const rz0 = -hz + 2;
    const rz1 = hz - 1;
    for (let z = rz0; z < rz1; z++) {
      const yy = Math.max(0, Math.round(3 - ((z - rz0) / (rz1 - rz0)) * 4));
      v.box(cx - 3, 0, z, cx + 3, yy + 1, z + 1, s === 2 ? "concreteDark" : "woodDark");
      if (z % 3 === 0) v.box(cx - 4, yy, z, cx + 4, yy + 1, z + 1, s === 2 ? "steelDark" : "wood");
    }
    // hull under construction: stern toward water (+z), bow toward land
    const len = Math.min(rz1 - rz0 - 4, byLv(c, [14, 20, 22, 30, 32] as const));
    const beam = Math.min(slipW - 3, byLv(c, [6, 7, 8, 10, 11] as const));
    const hz0 = rz0 + 1;
    const hz1 = hz0 + len;
    const progress = i === 0 && lv >= 3 ? 1 : lv >= 5 ? 0.9 : byLv(c, [0.25, 0.5, 0.35, 0.6, 0.9] as const);
    const ybase = 4;
    const hh = byLv(c, [4, 5, 5, 6, 7] as const);
    // build hull by hand with ribs: reversed hull (bow to -z)
    const o: HullOpts = { cx, y0: ybase, z0: -hz1 + 1 + 0, z1: -hz0 + 1, beam, h: hh, col: plank, bottom: s === 2 ? "#7a2a1a" : plank, deck: plank, bow: Math.round(beam * 1.1), rake: s === 1 ? 1 : 0.6, stern: s === 1 ? 4 : 1 };
    // mirror helper: hullRange works on o (bow at +z); we map z' = -z
    const plankedFrom = hz0 + Math.floor(len * (1 - progress));
    for (let z = hz0; z < hz1; z++) {
      const zz = -z;
      for (let y = ybase; y < ybase + hh; y++) {
        const r = hullRange(o, y, zz);
        if (!r) continue;
        const planked = z >= plankedFrom;
        const isRib = (z - hz0) % 3 === 0;
        for (let x = r[0]; x < r[1]; x++) {
          const edge = x === r[0] || x === r[1] - 1;
          const bottom = y === ybase;
          if (planked) {
            const rr = hullRange(o, y, zz + 1);
            const rr2 = hullRange(o, y, zz - 1);
            const sideZ = !rr || !rr2 || x < rr[0] || x >= rr[1] || x < rr2[0] || x >= rr2[1];
            if (edge || bottom || sideZ) {
              let col = plank;
              if (s === 1 && (y - ybase) % 2 === 1) col = "wood";
              if (s === 2 && (z + y) % 5 === 0) col = "#8a3020";
              v.put(x, y, z, col);
            }
          } else if (isRib && (edge || bottom)) {
            v.put(x, y, z, frame);
          }
        }
      }
      // keel
      v.put(cx, ybase - 1, z, frame);
      if (z % 4 === 0) v.box(cx - 1, Math.max(1, Math.round(3 - ((z - rz0) / (rz1 - rz0)) * 4)) + 1, z, cx + 1, ybase - 1, z + 1, "woodDark");
    }
    // stem post / dragon prow at the bow (-z end)
    if (s === 1) {
      for (let k = 0; k < 5; k++) v.put(cx, ybase + hh + k - 1, hz0 - 1 + (k > 2 ? 0 : 0), k === 4 ? "red" : "woodDark");
      v.put(cx, ybase + hh + 3, hz0 - 2, "gold");
      v.put(cx, ybase + hh + 2, hz1, "woodDark");
    } else {
      v.box(cx, ybase, hz0 - 1, cx + 1, ybase + hh + 1, hz0, frame);
    }
    // scaffolding both sides
    {
      const sx = cx - Math.floor(beam / 2) - 2;
      for (let z = hz0; z < hz1; z += 4) {
        const gy = Math.max(1, Math.round(3 - ((z - rz0) / (rz1 - rz0)) * 4) + 1);
        v.box(sx, gy, z, sx + 1, ybase + hh + 1, z + 1, scaff);
        // near-side props (shores) only, so the hull stays visible
        v.box(cx + Math.ceil(beam / 2), gy, z, cx + Math.ceil(beam / 2) + 1, ybase + 1, z + 1, scaff);
      }
      v.box(sx, ybase + hh, hz0, sx + 1, ybase + hh + 1, hz1 - 2, s === 2 ? "hazard" : scaff);
      v.box(sx, ybase + 2, hz0, sx + 1, ybase + 3, hz1 - 2, s === 2 ? "hazard" : scaff);
    }
    // finished-hull extras
    if (progress >= 0.9) {
      if (s === 1) {
        // round shields along the gunwale + striped sail rolled on rack
        for (let z = hz0 + 3; z < hz1 - 3; z += 2) {
          const r = hullRange(o, ybase + hh - 1, -z);
          if (r) {
            v.put(r[0] - 0, ybase + hh - 1, z, z % 4 ? "red" : "yellow");
            v.put(r[1] - 1, ybase + hh - 1, z, z % 4 ? "yellow" : "red");
          }
        }
      } else if (s === 3) {
        v.box(cx, ybase + hh, hz0 + 4, cx + 1, ybase + hh + 14, hz0 + 5, "woodDark");
        for (let y = ybase + hh + 3; y < ybase + hh + 13; y++) v.box(cx, y, hz0 + 5, cx + 1, y + 1, hz0 + 11, y % 2 ? "red" : "redDark");
      } else if (s === 2) {
        v.box(cx - 2, ybase + hh, hz0 + Math.floor(len * 0.6), cx + 2, ybase + hh + 5, hz0 + Math.floor(len * 0.6) + 4, "white");
      } else {
        v.box(cx, ybase + hh, hz0 + Math.floor(len * 0.4), cx + 1, ybase + hh + 14, hz0 + Math.floor(len * 0.4) + 1, "woodDark");
      }
      if (lv >= 5 && i === 0) {
        // launch-day bunting + crowd + champagne
        for (let z = hz0; z < hz1; z += 1) v.put(cx, ybase + hh + 6 - Math.abs(((z - hz0) % 8) - 4) * 0.5, z, ["red", "yellow", "blue", "white"][z % 4]);
        for (let k = 0; k < 6; k++) person(v, cx - 6 + k * 2, 2, -hz + 2, c.pick(["red", "yellow", "sky", "pink"]));
      }
    }
    // sparks for steel yard
    if (s === 2) c.smoke(cx, ybase + hh, hz0 + Math.floor(len * (1 - progress)), "spark");
    // workers
    person(v, cx - Math.floor(beam / 2) - 1, 2, hz0 + 4, s === 2 ? "orange" : "#5a6fa0", "blueDark");
    if (lv >= 2) person(v, cx + 1, ybase + hh, hz0 + Math.floor(len / 2), s === 2 ? "orange" : "white", "woodDark");
  }
  // workshop shed + timber/plate stacks on land at the back corner
  const shedX0 = hx - 12;
  if (lv >= 2 && nSlips * slipW + 2 < hx * 2 - 10) {
    // only if room
  }
  if (lv >= 2) {
    const sx1 = hx - 2;
    const sx0 = sx1 - 10;
    const roofCol = ["brickDark", "#c9a25a", "steelDark", "redDark"][s];
    v.box(sx0, 2, -hz + 1, sx1, 8, -hz + 6, ["woodDark", "wood", "#6c8fb3", "#c68a4a"][s]);
    if (s === 3) {
      hip(v, sx0 - 1, 8, -hz, sx1 + 1, -hz + 7, roofCol);
      v.put(sx0 - 1, 9, -hz, roofCol);
    } else gable(v, sx0, 8, -hz + 1, sx1, -hz + 6, "x", roofCol);
    const ch = 8 + 6;
    v.box(sx1 - 3, 8, -hz + 2, sx1 - 1, ch, -hz + 4, "brickDark");
    c.smoke(sx1 - 2, ch, -hz + 3, s === 2 ? "dark" : "smoke");
  }
  if (lv >= 3) {
    // crane / derrick
    const dz = lz - 4;
    if (s === 2) crane(v, hx - 4, 2, dz - 1, 18, 12, "blue", "x");
    else {
      v.box(hx - 3, 2, dz, hx - 2, 18, dz + 1, "woodDark");
      for (let k = 0; k < 10; k++) v.put(hx - 3 - k, 17 - Math.floor(k / 2), dz, "woodDark");
      v.box(hx - 12, 9, dz, hx - 11, 13, dz + 1, "steelDark");
    }
  }
  // lumber / plate stacks
  for (let i = 0; i < Math.min(3, lv); i++) {
    const tx = hx - 6 - i * 0;
    const tz = -hz + 8 + i * 3;
    if (tz + 2 >= lz - 1) break;
    v.box(tx - 4 + (i % 2), 2, tz, tx, 3 + (i % 2), tz + 2, s === 2 ? "steelLight" : s === 3 ? "#b8a26a" : "woodLight");
  }
  void shedX0;
}

// =============================================================================================
// SHIPYARD (coast/water) — industrial dry-dock basins, Goliath gantry cranes, giant hulls
//  V0 Yellow/Blue cranes + red cargo ship   V1 Red/White cranes + LNG tanker (spherical tanks)
//  V2 Blue cranes + white cruise-ship hull  V3 Orange/Green cranes + grey warship hull
// =============================================================================================
const YARD_PAL = [
  { crane: "busYellow", crane2: "blue", hull: "redDark", top: "#2f4f8a", sup: "white" },
  { crane: "red", crane2: "white", hull: "#2b3a55", top: "#c9472c", sup: "white" },
  { crane: "blue", crane2: "white", hull: "white", top: "blueDark", sup: "white" },
  { crane: "orange", crane2: "#3f8f4f", hull: "#7d8995", top: "#5d6670", sup: "#a7b1bb" },
];

function buildShipyard(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = YARD_PAL[s];
  waterPlane(v, -hx, -hz, hx, hz);
  // land apron at the back, dock walls run to the water at front
  const back = -hz + 8;
  v.box(-hx, 0, -hz, hx, 4, back, "concrete2");
  const nDocks = lv >= 4 ? 2 : 1;
  const dockW = Math.min(lv >= 3 ? 24 : 20, Math.floor((hx * 2 - 4) / nDocks) - 4);
  const pitch = Math.floor((hx * 2) / nDocks);
  for (let d = 0; d < nDocks; d++) {
    const cx = -hx + pitch * d + Math.floor(pitch / 2);
    const x0 = cx - Math.floor(dockW / 2);
    const x1 = x0 + dockW;
    // dock walls (stepped altars)
    v.box(x0 - 3, 0, back, x0, 4, hz - 3, "concrete");
    v.box(x1, 0, back, x1 + 3, 4, hz - 3, "concrete");
    v.box(x0, 0, back, x0 + 1, 2, hz - 3, "concreteDark");
    v.box(x1 - 1, 0, back, x1, 2, hz - 3, "concreteDark");
    // dry dock floor
    v.box(x0, 0, back, x1, 1, hz - 3, "concreteDark");
    // caisson gate at the sea end
    v.box(x0 - 3, 0, hz - 3, x1 + 3, 4, hz - 1, "steelDark");
    v.box(x0, 3, hz - 3, x1, 4, hz - 1, "hazard");
    // keel blocks
    for (let z = back + 3; z < hz - 6; z += 3) v.box(cx - 1, 1, z, cx + 1, 3, z + 1, "woodDark");
    // the ship in dock (bow toward sea)
    const beam = Math.min(dockW - 4, byLv(c, [10, 12, 14, 16, 18] as const));
    const hh = byLv(c, [6, 7, 8, 9, 10] as const);
    const o: HullOpts = { cx, y0: 3, z0: back + 2, z1: hz - 5, beam, h: hh, col: p.hull, bottom: "#a5402a", water: 3, stripe: "white", stripeY: hh - 2, deck: p.top, bow: Math.round(beam * 1.2), stern: 2, rake: 0.5 };
    // partially plated hull for lv1-2 (frames showing at the bow)
    const dy = hull(v, o);
    const L = o.z1 - o.z0;
    if (lv <= 2) {
      // open frames at bow section
      const zf = o.z0 + Math.floor(L * 0.65);
      v.clear(cx - Math.floor(beam / 2) - 1, 4, zf, cx + Math.ceil(beam / 2) + 1, dy, o.z1);
      for (let z = zf; z < o.z1; z += 2) {
        for (let y = 3; y < dy; y++) {
          const r = hullRange(o, y, z);
          if (!r) continue;
          v.put(r[0], y, z, "#a5402a");
          v.put(r[1] - 1, y, z, "#a5402a");
        }
      }
      c.smoke(cx, dy, zf, "spark");
    }
    // superstructure by ship type
    if (s === 0) {
      deckhouse(c, cx - Math.floor(beam / 2) + 1, dy, o.z0 + 1, cx + Math.ceil(beam / 2) - 1, dy + 8, o.z0 + 6, "white", "glass", "white");
      for (let z = o.z0 + 8; z < o.z1 - 6 && lv >= 3; z += 7) {
        for (let k = 0; k < 2; k++) container(v, cx - 6 + k * 6, dy, z, "x", ["blue", "orange", "teal", "red"][(z + k) % 4]);
      }
    } else if (s === 1) {
      deckhouse(c, cx - Math.floor(beam / 2) + 1, dy, o.z0 + 1, cx + Math.ceil(beam / 2) - 1, dy + 7, o.z0 + 6, "white", "glass", "white");
      const tanks = lv >= 3 ? 3 : 1;
      for (let k = 0; k < tanks; k++) {
        const tz = o.z0 + 10 + k * Math.floor(beam * 0.9);
        if (tz + beam / 2 > o.z1 - 3) break;
        v.sphere(cx, dy + beam * 0.25, tz, beam * 0.42, beam * 0.42, beam * 0.42, "#e9e1d0");
        v.box(cx - 1, dy, tz, cx + 1, dy + Math.round(beam * 0.7), tz + 1, "#c9472c");
      }
    } else if (s === 2) {
      // cruise ship superstructure blocks
      const tiers = lv >= 3 ? 3 : 2;
      for (let t = 0; t < tiers; t++) {
        const y = dy + t * 3;
        v.box(cx - Math.floor(beam / 2) + 1 + t, y, o.z0 + 2 + t * 2, cx + Math.ceil(beam / 2) - 1 - t, y + 3, o.z1 - 10 - t * 2, "white");
        v.box(cx - Math.floor(beam / 2) + 1 + t, y + 1, o.z0 + 2 + t * 2, cx + Math.ceil(beam / 2) - 1 - t, y + 2, o.z1 - 10 - t * 2, "glass", 0.35);
      }
      funnel(c, cx, o.z0 + 6, dy + tiers * 3, 5, 1.6, "blue", "white", "steam");
    } else {
      v.box(cx - 3, dy, o.z0 + 6, cx + 3, dy + 6, o.z0 + 14, p.sup);
      v.box(cx - 2, dy + 6, o.z0 + 8, cx + 2, dy + 9, o.z0 + 13, p.sup);
      mast(v, cx, dy + 9, o.z0 + 10, 6, "steelDark", 2);
      turret(v, cx, dy, o.z1 - 10, 4, 2, 4, 1, "#5d6670");
    }
    // scaffolding on the sides of the hull
    for (const sx of [cx - Math.floor(beam / 2) - 2, cx + Math.ceil(beam / 2) + 1]) {
      for (let z = o.z0 + 2; z < o.z1 - 2; z += 4) v.box(sx, 1, z, sx + 1, dy, z + 1, "steelLight");
      for (let y = 4; y < dy; y += 3) v.box(sx, y, o.z0 + 2, sx + 1, y + 1, o.z1 - 2, "hazard");
    }
    // Goliath gantry crane spanning the dock
    const gz = o.z0 + Math.floor(L * (0.35 + 0.15 * d));
    const gh = byLv(c, [16, 20, 24, 28, 34] as const);
    for (const lx of [x0 - 2, x1 + 1]) {
      v.box(lx, 4, gz - 1, lx + 1, gh, gz, p.crane);
      v.box(lx, 4, gz + 3, lx + 1, gh, gz + 4, p.crane);
      for (let y = 6; y < gh; y += 4) v.box(lx, y, gz, lx + 1, y + 1, gz + 3, p.crane2);
      v.box(lx - 1, 4, gz - 2, lx + 2, 5, gz + 5, "steelDark");
    }
    v.box(x0 - 3, gh, gz - 1, x1 + 3, gh + 3, gz + 4, p.crane);
    v.box(x0 - 2, gh + 1, gz + 4, x1 + 2, gh + 2, gz + 5, p.crane2);
    // trolley + hook
    v.box(cx - 2, gh - 1, gz, cx + 2, gh, gz + 3, "steelDark");
    v.box(cx, dy + 3, gz + 1, cx + 1, gh - 1, gz + 2, "black");
    v.box(cx - 1, dy + 2, gz, cx + 2, dy + 3, gz + 3, "hazard");
    c.blink(x0 - 3, gh + 3, gz, "red");
    c.blink(x1 + 2, gh + 3, gz, "red");
    if (lv >= 5 && d === 0) {
      // big lettering band on the girder (lit at night)
      for (let x = x0; x < x1; x += 2) v.put(x, gh + 1, gz + 4, "white", 0.6);
    }
  }
  // quay jib cranes, sheds and stockyard on the back apron
  if (lv >= 2) crane(v, hx - 4, 4, back - 4, 14 + lv * 2, 10, p.crane, "z");
  if (lv >= 3) {
    const sx0 = -hx + 1;
    const sx1 = Math.min(hx - 8, sx0 + 18);
    v.box(sx0, 4, -hz + 1, sx1, 11, back - 1, "#7d8b99");
    barrelRoof(v, sx0, 11, -hz + 1, sx1, back - 1, "x", p.crane2 === "white" ? "steelLight" : p.crane2, "white");
    v.box(sx0 + 3, 4, back - 2, sx0 + 9, 9, back - 1, "hazard");
  }
  for (let i = 0; i < lv; i++) {
    const x = -hx + 2 + i * 7;
    if (x + 6 > hx - 6) break;
    container(v, x, 4, back - 4 + (lv >= 3 ? 30 : 0) * 0, "x", ["orange", "blue", "teal", "red", "white"][i % 5]);
  }
  for (let i = 0; i < Math.min(6, lv + 1); i++) person(v, c.ri(-hx + 2, hx - 3), 4, c.ri(-hz + 2, back - 2), i % 2 ? "orange" : "hazard", "blueDark");
}

defineDesigns({
  docks: {
    footprints: [[1, 1], [1, 2], [2, 2], [2, 3], [3, 3]],
    levels: ["Fishing Pier", "Bait-Shack Jetty", "Harbor Marina", "Bustling Wharf", "Lighthouse Ferry Terminal"],
    growth: "A lone pier grows a quay and jetty, then finger piers full of boats, a warehouse wharf and finally a glass ferry terminal with lighthouse.",
    build: buildDocks,
  },
  boats: {
    footprints: [[1, 1], [1, 2], [1, 2], [1, 3], [2, 4]],
    levels: ["Rowboat", "Little Fishing Boat", "Deep-Sea Trawler", "Passenger Ferry", "Grand Cruise Liner"],
    growth: "Hull class grows: rowboat → fishing boat → trawler with gantry → two-deck ferry → cruise liner with pools, slide and funnels.",
    build: buildBoat,
  },
  sail_boats: {
    footprints: [[1, 1], [1, 2], [1, 2], [1, 3], [2, 3]],
    levels: ["Sailing Dinghy", "Weekend Sloop", "Gaff Schooner", "Square-Rigged Brigantine", "Three-Masted Tall Ship"],
    growth: "Rig grows: one little sail → sloop → two-masted schooner → square-rigged brigantine → full-rigged three-master.",
    build: buildSailBoat,
  },
  speed_boats: {
    footprints: [[1, 1], [1, 1], [1, 2], [1, 2], [2, 3]],
    levels: ["Jet Ski", "Runabout Speedboat", "Cigarette Racer", "Flybridge Cruiser", "Helipad Megayacht"],
    growth: "Jet ski → runabout → arrow-hull racer → flybridge cruiser → tiered megayacht with helicopter and jacuzzi.",
    build: buildSpeedBoat,
  },
  ship_building_areas: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [3, 3]],
    levels: ["Boatwright's Slip", "Timber Slipway", "Twin Slipways", "Shipwright Works", "Grand Launch Yard"],
    growth: "Inclined slipways multiply; hulls grow from bare ribs to planked ships, with sheds, derricks and a launch-day crowd.",
    build: buildShipBuilding,
  },
  shipyards: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Repair Dry Dock", "Graving Dock", "Gantry Dock Yard", "Twin-Goliath Shipyard", "Mega Shipyard"],
    growth: "Dry-dock basins with gantry cranes grow taller; hulls get bigger and the yard adds sheds, jib cranes and a second dock.",
    build: buildShipyard,
  },
  naval_vessels: {
    footprints: [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4]],
    levels: ["Patrol Boat", "Corvette", "Guided-Missile Frigate", "Destroyer", "Dreadnought Battleship"],
    growth: "Hull class grows: patrol boat → corvette → frigate with helideck → twin-gun destroyer → triple-turret battleship.",
    build: buildNavalVessel,
  },
  submarines: {
    footprints: [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4]],
    levels: ["Mini-Sub", "Diesel Attack Sub", "Nuclear Hunter-Killer", "Ballistic Missile Sub", "Twin-Hull Leviathan"],
    growth: "Low black hulls grow longer: bubble mini-sub → attack subs → missile sub with open hatches → twin-hull leviathan.",
    build: buildSubmarine,
  },
  aircraft_carriers: {
    footprints: [[1, 2], [1, 3], [2, 3], [2, 4], [3, 4]],
    levels: ["Seaplane Tender", "Escort Carrier", "Fleet Carrier", "Supercarrier", "Nuclear Supercarrier"],
    growth: "Flight decks grow from a seaplane tender to an angled-deck supercarrier packed with jets, radars and helicopters.",
    build: buildCarrier,
  },
});
