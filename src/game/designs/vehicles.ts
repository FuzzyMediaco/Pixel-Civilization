/**
 * Shared vehicle / vessel voxel helpers (ship hulls, sails, planes, helicopters, radars, turrets, submarines, piers).
 * Used by maritime.ts and security.ts. Registers no designs.
 */
import { type Ctx, PixelVox, helipad } from "./kit";

type V = PixelVox;

// =============================================================================================
// Vessel & vehicle helpers
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
    // A floating hull narrows into the water. Hulls on cradles keep their own keel height.
    const bottom = y0 === 0 ? hullRange(o, y0, z) : null;
    if (bottom) {
      const width = bottom[1] - bottom[0];
      for (let depth = 1; depth <= Math.min(3, Math.ceil(width / 2)); depth++) {
        const inset = Math.min(depth - 1, Math.floor((width - 1) / 2));
        v.box(bottom[0] + inset, -depth, z, bottom[1] - inset, 1 - depth, z + 1, o.bottom ?? o.col);
      }
    }
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
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d > 1) continue;
        const dIn = ((x + 0.5 - cx) / Math.max(0.1, rx - 1.2)) ** 2 + ((y + 0.5 - cy) / Math.max(0.1, ry - 1.2)) ** 2;
        if (dIn < 1 && z > z0 && z < z1 - 1) continue;
        v.put(x, y, z, y <= 0 ? belly : col);
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

/** The luff and leech stay under tension while the center of the canvas bellies to leeward. */
export function triSail(v: V, x: number, y0: number, y1: number, zm: number, len: number, col: string | ((y: number, z: number) => string), dir: 1 | -1 = -1): void {
  const H = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const l = Math.max(1, Math.round(len * (1 - (y - y0) / H)));
    let previous = 0;
    for (let k = 1; k <= l; k++) {
      const z = zm + dir * k;
      const fullness = Math.min(2.8, l * 0.22) * Math.sin(Math.PI * (k - 1) / Math.max(1, l - 1));
      const offset = Math.round(fullness * Math.sin(Math.PI * (y - y0 + 1) / (H + 1)));
      const cloth = typeof col === "string" ? col : col(y, z);
      v.box(x + Math.min(previous, offset), y, z, x + Math.max(previous, offset) + 1, y + 1, z + 1, cloth);
      previous = offset;
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

/** Perimeter caisson under a working quay, down past the ocean surface. */
export function quayFoundation(v: V, x0: number, z0: number, x1: number, z1: number, col = "concreteDark"): void {
  v.box(x0, -4, z0, x1, 0, z0 + 1, col);
  v.box(x0, -4, z1 - 1, x1, 0, z1, col);
  v.box(x0, -4, z0 + 1, x0 + 1, 0, z1 - 1, col);
  v.box(x1 - 1, -4, z0 + 1, x1, 0, z1 - 1, col);
}

/** Piles + deck for a pier rectangle. Deck at y=1 (top surface y=2). */
export function pier(v: V, x0: number, z0: number, x1: number, z1: number, deck = "wood", pile = "woodDark", step = 4, y = 1): void {
  v.box(x0, y, z0, x1, y + 1, z1, deck);
  for (let x = x0; x < x1; x += step) {
    v.box(x, -4, z0, x + 1, y + 2, z0 + 1, pile);
    v.box(x, -4, z1 - 1, x + 1, y + 2, z1, pile);
  }
  for (let z = z0; z < z1; z += step) {
    v.box(x0, -4, z, x0 + 1, y + 2, z + 1, pile);
    v.box(x1 - 1, -4, z, x1, y + 2, z + 1, pile);
  }
  v.box(x0, -4, z1 - 1, x0 + 1, y + 2, z1, pile);
  v.box(x1 - 1, -4, z1 - 1, x1, y + 2, z1, pile);
}

