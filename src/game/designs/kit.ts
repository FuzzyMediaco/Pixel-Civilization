/**
 * Voxel design kit — the shared building-block library for every element design.
 *
 * COORDINATE CONVENTIONS (all in voxel units, 16 voxels per grid tile, 1 voxel = 0.25 m):
 *  - x runs [-c.hx, c.hx)  and z runs [-c.hz, c.hz)   (c.hx = 8 * spanX, c.hz = 8 * spanZ)
 *  - y = 0 is the ground "lot" layer, structures normally start at y = 1
 *  - +z is the FRONT of a building (doors, signs, driveways face +z)
 *  - box(x0,y0,z0,x1,y1,z1) is half-open: fills x0..x1-1, y0..y1-1, z0..z1-1
 *  - Anything outside the footprint is clipped automatically after build.
 *
 * Colors are PALETTE names from voxelCore (e.g. "brick", "glass", "leaf") or any "#rrggbb".
 * `emit` (0..2) makes a voxel glow — stronger at night (windows, lamps, neon, beacons).
 */
import { PALETTE, PixelVox } from "../voxelCore";

export { PALETTE, PixelVox };

export type Axis = "x" | "y" | "z";
export type SmokeKind = "smoke" | "steam" | "dark" | "spark";

export interface RotorSpec {
  vox: PixelVox;
  /** pivot in base-voxel coordinates (rotor voxels are built relative to this point) */
  pivot: [number, number, number];
  axis: Axis;
  /** radians per second (negative spins the other way) */
  speed: number;
  /** if true the rotor speed scales with wind (windmills/turbines) */
  wind?: boolean;
}

export interface Ctx {
  parcelEdges?: readonly import("../parcelEdges").ParcelEdge[];
  v: PixelVox;
  id: string;
  /** level 1..5 */
  lv: number;
  /** visual variant 0..3 */
  variant: number;
  /** footprint in tiles (local, unrotated) */
  spanX: number;
  spanZ: number;
  /** half extents in voxels: valid x in [-hx, hx-1], z in [-hz, hz-1] */
  hx: number;
  hz: number;
  /**
   * Network connection mask (roads/rails/bridges/water networks only, 0 otherwise):
   *  bits 1,2,4,8      = same-network neighbour to N(-z), E(+x), S(+z), W(-x)
   *  bits 16,32,64,128 = a building touches N, E, S, W (draw driveway aprons)
   *  bits 256,512,1024,2048 = the N/E/S/W neighbour is a network piece at a DIFFERENT deck height
   *                           (e.g. bridge meeting a ground road → draw a ramp down that side)
   *  bits 13–16/17–20 = width and surface of freight/boarding entrances on N/E/S/W
   *  bit 4096 = this tile sits over water (ocean, coast, or a placed water feature)
   */
  conn: number;
  /** deterministic random in [0,1) (seeded by id/level/variant/span) */
  rand: () => number;
  /** random int in [a, b] inclusive */
  ri: (a: number, b: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  /** variant-indexed choice: arr[variant % arr.length] */
  vpick: <T>(arr: readonly T[]) => T;
  /** Add an independently animated spinning part (wind blades, ferris wheel, radar dish, propeller) */
  addRotor: (r: RotorSpec) => void;
  /** Register a chimney/stack point that emits drifting smoke/steam particles in-game */
  smoke: (x: number, y: number, z: number, kind?: SmokeKind) => void;
  /** Register a blinking beacon light (aircraft warning lights, radio masts, lighthouses) */
  blink: (x: number, y: number, z: number, color?: string) => void;
  /** Mark the element as floating (gentle bobbing on water) */
  bob: () => void;
  rotors: RotorSpec[];
  smokePoints: [number, number, number, SmokeKind][];
  blinkers: [number, number, number, string][];
  floating: boolean;
}

// ---------------------------------------------------------------------------------------------
// Deterministic RNG
// ---------------------------------------------------------------------------------------------

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCtx(
  id: string,
  lv: number,
  variant: number,
  spanX: number,
  spanZ: number,
  conn = 0,
): Ctx {
  const seed = hashStr(`${id}|${lv}|${variant}|${spanX}x${spanZ}|${conn}`);
  const rand = makeRng(seed);
  const ctx: Ctx = {
    v: new PixelVox(seed & 0xffff),
    id,
    lv,
    variant,
    spanX,
    spanZ,
    hx: spanX * 8,
    hz: spanZ * 8,
    conn,
    rand,
    ri: (a, b) => a + Math.floor(rand() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(rand() * arr.length) % arr.length],
    vpick: (arr) => arr[((variant % arr.length) + arr.length) % arr.length],
    rotors: [],
    smokePoints: [],
    blinkers: [],
    floating: false,
    addRotor: (r) => {
      ctx.rotors.push(r);
    },
    smoke: (x, y, z, kind = "smoke") => {
      ctx.smokePoints.push([x, y, z, kind]);
    },
    blink: (x, y, z, color = "red") => {
      ctx.blinkers.push([x, y, z, color]);
    },
    bob: () => {
      ctx.floating = true;
    },
  };
  return ctx;
}

// ---------------------------------------------------------------------------------------------
// Ground & lots
// ---------------------------------------------------------------------------------------------

/** Fill the ground layer (y=0) of the whole footprint, inset by `inset` voxels. */
export function lot(c: Ctx, col: string, inset = 0): void {
  c.v.box(-c.hx + inset, 0, -c.hz + inset, c.hx - inset, 1, c.hz - inset, col);
}

/** Speckle the ground layer with a secondary color (grass tufts, gravel, flowers). */
export function speckle(c: Ctx, col: string, density = 0.12, inset = 0, y = 0): void {
  for (let x = -c.hx + inset; x < c.hx - inset; x++) {
    for (let z = -c.hz + inset; z < c.hz - inset; z++) {
      if (c.rand() < density) c.v.put(x, y, z, col);
    }
  }
}

/** Paved ground rectangle (y=0) */
export function pave(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col = "concrete2"): void {
  v.box(x0, 0, z0, x1, 1, z1, col);
}

/** Painted parking bays on the ground with optional parked cars */
export function parking(
  c: Ctx,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  opts: { cars?: number; axis?: Axis; asphalt?: string } = {},
): void {
  const v = c.v;
  v.box(x0, 0, z0, x1, 1, z1, opts.asphalt ?? "asphalt");
  const axis = opts.axis ?? "x";
  const carDensity = opts.cars ?? 0.6;
  if (axis === "x") {
    for (let x = x0 + 1; x < x1 - 1; x += 4) {
      v.box(x, 0, z0, x + 1, 1, Math.min(z1, z0 + 5), "white");
      if (x + 4 <= x1 && c.rand() < carDensity) car(v, x + 2, 1, z0 + 2, "z", c.pick(CAR_COLORS));
    }
  } else {
    for (let z = z0 + 1; z < z1 - 1; z += 4) {
      v.box(x0, 0, z, Math.min(x1, x0 + 5), 1, z + 1, "white");
      if (z + 4 <= z1 && c.rand() < carDensity) car(v, x0 + 2, 1, z + 2, "x", c.pick(CAR_COLORS));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Walls, windows, doors
// ---------------------------------------------------------------------------------------------

export interface WindowOpts {
  /** window color (default "glass") */
  col?: string;
  /** glow amount (default 0.35) */
  emit?: number;
  /** horizontal spacing (default 3) */
  stepH?: number;
  /** vertical spacing (default 3) */
  stepV?: number;
  /** window width in voxels (default 1) */
  w?: number;
  /** window height in voxels (default 1) */
  h?: number;
  /** which faces: any of "n","s","e","w" (default all). s = +z front */
  faces?: string;
  /** chance of a lit window at night vs dark pane (0..1, default 0.7) */
  lit?: number;
  /** color for unlit panes (default "glassDark") */
  darkCol?: string;
  /** margin from corners (default 1) */
  margin?: number;
  /** first row offset from y0 (default 1) */
  startY?: number;
  /** inset sill voxel below each window */
  sill?: string;
}

/**
 * Punch windows into the outer faces of an axis-aligned block [x0,x1)×[y0,y1)×[z0,z1).
 * Windows replace the wall voxels on the face (no protrusion).
 */
export function windows(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: WindowOpts = {}): void {
  const v = c.v;
  const col = o.col ?? "glass";
  const emit = o.emit ?? 0.35;
  const sh = o.stepH ?? 3;
  const sv = o.stepV ?? 3;
  const w = o.w ?? 1;
  const h = o.h ?? 1;
  const faces = o.faces ?? "nsew";
  const lit = o.lit ?? 0.7;
  const dark = o.darkCol ?? "glassDark";
  const m = o.margin ?? 1;
  const sy = o.startY ?? 1;
  for (let y = y0 + sy; y + h <= y1 - 1 + (sy === 0 ? 1 : 0); y += sv) {
    const paint = (px: number, pz: number, alongX: boolean, sx: number, sz: number) => {
      const isLit = c.rand() < lit;
      for (let dy = 0; dy < h; dy++) {
        for (let d = 0; d < w; d++) {
          const xx = alongX ? px + d : px;
          const zz = alongX ? pz : pz + d;
          v.put(xx, y + dy, zz, isLit ? col : dark, isLit ? emit : 0.05);
        }
      }
      if (o.sill) {
        for (let d = 0; d < w; d++) {
          v.put(alongX ? px + d : px + sx, y - 1, alongX ? pz + sz : pz + d, o.sill);
        }
      }
    };
    if (faces.includes("s") || faces.includes("n")) {
      for (let x = x0 + m + 1; x + w <= x1 - m - 1 + 1; x += sh) {
        if (faces.includes("s")) paint(x, z1 - 1, true, 0, 1);
        if (faces.includes("n")) paint(x, z0, true, 0, -1);
      }
    }
    if (faces.includes("e") || faces.includes("w")) {
      for (let z = z0 + m + 1; z + w <= z1 - m - 1 + 1; z += sh) {
        if (faces.includes("e")) paint(x1 - 1, z, false, 1, 0);
        if (faces.includes("w")) paint(x0, z, false, -1, 0);
      }
    }
  }
}

/** Continuous horizontal glass ribbon bands (modernist office look) on a block's faces. */
export function ribbonWindows(
  c: Ctx,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  every = 3,
  col = "glass",
  emit = 0.32,
  faces = "nsew",
): void {
  const v = c.v;
  for (let y = y0 + 1; y < y1 - 1; y += every) {
    const lit = c.rand() < 0.75;
    const cc = lit ? col : "glassDark";
    const e = lit ? emit : 0.05;
    if (faces.includes("s")) v.box(x0 + 1, y, z1 - 1, x1 - 1, y + 1, z1, cc, e);
    if (faces.includes("n")) v.box(x0 + 1, y, z0, x1 - 1, y + 1, z0 + 1, cc, e);
    if (faces.includes("e")) v.box(x1 - 1, y, z0 + 1, x1, y + 1, z1 - 1, cc, e);
    if (faces.includes("w")) v.box(x0, y, z0 + 1, x0 + 1, y + 1, z1 - 1, cc, e);
  }
}

/** Full glass curtain wall with vertical mullions every `mull` voxels. */
export function curtainWall(
  c: Ctx,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  glass = "glass",
  mullion = "steelLight",
  mull = 3,
  floorEvery = 3,
): void {
  const v = c.v;
  v.box(x0, y0, z0, x1, y1, z1, glass, 0.18);
  if (x1 - x0 > 2 && z1 - z0 > 2 && y1 - y0 > 2) v.clear(x0 + 1, y0, z0 + 1, x1 - 1, y1, z1 - 1);
  for (let x = x0; x < x1; x += mull) {
    v.box(x, y0, z0, x + 1, y1, z0 + 1, mullion);
    v.box(x, y0, z1 - 1, x + 1, y1, z1, mullion);
  }
  for (let z = z0; z < z1; z += mull) {
    v.box(x0, y0, z, x0 + 1, y1, z + 1, mullion);
    v.box(x1 - 1, y0, z, x1, y1, z + 1, mullion);
  }
  for (let y = y0 + floorEvery; y < y1; y += floorEvery) {
    v.box(x0, y, z0, x1, y + 1, z0 + 1, mullion);
    v.box(x0, y, z1 - 1, x1, y + 1, z1, mullion);
    v.box(x0, y, z0, x0 + 1, y + 1, z1, mullion);
    v.box(x1 - 1, y, z0, x1, y + 1, z1, mullion);
  }
  // corner posts + random lit interior panels
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
    v.box(px, y0, pz, px + 1, y1, pz + 1, mullion);
  }
  // occasional warm lit panes
  for (let y = y0 + 1; y < y1; y += floorEvery) {
    for (let x = x0 + 1; x < x1 - 1; x += mull) {
      if (c.rand() < 0.35) v.put(x + 1, y + 1 < y1 ? y + 1 : y, z1 - 1, "warmGlow", 0.6);
    }
  }
}

/** Door (2 wide x 3 tall default) on the +z face at x, spanning z (sits at z1-1 plane). */
export function door(v: PixelVox, x: number, y: number, z: number, col = "woodDark", w = 2, h = 3, lamp = true): void {
  v.box(x, y, z, x + w, y + h, z + 1, col);
  if (lamp) v.put(x + w, y + h - 1, z + 1, "warmGlow", 0.9);
}

/** Simple wall block with an outline trim at corners and a cornice row on top */
export function block(
  v: PixelVox,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  wall: string,
  trim?: string,
  cornice?: string,
): void {
  v.box(x0, y0, z0, x1, y1, z1, wall);
  if (trim) {
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, y0, pz, px + 1, y1, pz + 1, trim);
    }
  }
  if (cornice) v.box(x0, y1 - 1, z0, x1, y1, z1, cornice);
}

/** Horizontal band (string course) wrapping a block at height y */
export function band(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string, out = 0): void {
  v.box(x0 - out, y, z0 - out, x1 + out, y + 1, z1 + out, col);
}

/** Balcony slabs with railings on the +z face of a tower every `every` floors */
export function balconies(
  c: Ctx,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  every = 3,
  slab = "concrete",
  rail = "glass",
  faces = "s",
): void {
  const v = c.v;
  for (let y = y0; y < y1; y += every) {
    if (faces.includes("s")) {
      v.box(x0, y, z, x1, y + 1, z + 2, slab);
      v.box(x0, y + 1, z + 1, x1, y + 2, z + 2, rail, rail === "glass" ? 0.1 : 0);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------------------------

/** Gable roof over [x0,x1)×[z0,z1). axis = direction of the ridge line. Returns ridge height. */
export function gable(
  v: PixelVox,
  x0: number,
  y: number,
  z0: number,
  x1: number,
  z1: number,
  axis: "x" | "z",
  col: string,
  edge?: string,
  gableWall?: string,
): number {
  const across = axis === "x" ? z1 - z0 : x1 - x0;
  const rise = Math.ceil(across / 2);
  for (let s = 0; s < rise; s++) {
    if (axis === "x") {
      v.box(x0, y + s, z0 + s, x1, y + s + 1, z1 - s, col);
      if (gableWall) {
        v.box(x0 + 1, y + s, z0 + s + 1, x1 - 1, y + s + 1, z1 - s - 1, gableWall);
      }
    } else {
      v.box(x0 + s, y + s, z0, x1 - s, y + s + 1, z1, col);
      if (gableWall) {
        v.box(x0 + s + 1, y + s, z0 + 1, x1 - s - 1, y + s + 1, z1 - 1, gableWall);
      }
    }
  }
  if (edge) {
    // eave trim along the long edges
    if (axis === "x") {
      v.box(x0, y, z0, x1, y + 1, z0 + 1, edge);
      v.box(x0, y, z1 - 1, x1, y + 1, z1, edge);
    } else {
      v.box(x0, y, z0, x0 + 1, y + 1, z1, edge);
      v.box(x1 - 1, y, z0, x1, y + 1, z1, edge);
    }
  }
  return y + rise;
}

/** Hipped / pyramid roof stepping inward on all sides. Returns top y. */
export function hip(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string, edge?: string, maxSteps = 99): number {
  let s = 0;
  for (; s < maxSteps && x0 + s < x1 - s && z0 + s < z1 - s; s++) {
    v.box(x0 + s, y + s, z0 + s, x1 - s, y + s + 1, z1 - s, s === 0 && edge ? edge : col);
  }
  return y + s;
}

/** Mansard roof: steep lower slope (2 steps) then flat top with a cap color. */
export function mansard(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string, top: string, dormers?: string): number {
  v.box(x0, y, z0, x1, y + 2, z1, col);
  v.box(x0 + 1, y + 2, z0 + 1, x1 - 1, y + 3, z1 - 1, col);
  v.box(x0 + 2, y + 3, z0 + 2, x1 - 2, y + 4, z1 - 2, top);
  if (dormers) {
    for (let x = x0 + 2; x < x1 - 2; x += 3) {
      v.put(x, y + 1, z1 - 1, dormers, 0.4);
      v.put(x, y + 1, z0, dormers, 0.4);
    }
  }
  return y + 4;
}

/** Flat roof with parapet ring, returns top y. Adds rooftop clutter if `clutter`. */
export function flatRoof(c: Ctx, x0: number, y: number, z0: number, x1: number, z1: number, col = "concreteDark", parapet = "concrete", clutter = true): number {
  const v = c.v;
  v.box(x0, y, z0, x1, y + 1, z1, col);
  v.box(x0, y + 1, z0, x1, y + 2, z0 + 1, parapet);
  v.box(x0, y + 1, z1 - 1, x1, y + 2, z1, parapet);
  v.box(x0, y + 1, z0, x0 + 1, y + 2, z1, parapet);
  v.box(x1 - 1, y + 1, z0, x1, y + 2, z1, parapet);
  if (clutter && x1 - x0 >= 6 && z1 - z0 >= 6) {
    const n = 1 + Math.floor(((x1 - x0) * (z1 - z0)) / 60);
    for (let i = 0; i < n; i++) {
      const ax = c.ri(x0 + 2, x1 - 4);
      const az = c.ri(z0 + 2, z1 - 4);
      acUnit(v, ax, y + 1, az);
    }
  }
  return y + 1;
}

/** Barrel/vaulted roof along axis (quonset, train shed, market hall) */
export function barrelRoof(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, axis: "x" | "z", col: string, rib?: string): number {
  const across = axis === "x" ? z1 - z0 : x1 - x0;
  const r = across / 2;
  const c0 = (axis === "x" ? z0 : x0) + r;
  let top = y;
  for (let i = 0; i < across; i++) {
    const d = i + 0.5 - r;
    const hgt = Math.max(1, Math.round(Math.sqrt(Math.max(0, r * r - d * d)) * 0.8));
    const p = Math.round(c0 - r + i);
    if (axis === "x") v.box(x0, y, p, x1, y + hgt, p + 1, col);
    else v.box(p, y, z0, p + 1, y + hgt, z1, col);
    top = Math.max(top, y + hgt);
  }
  if (rib) {
    const len = axis === "x" ? x1 - x0 : z1 - z0;
    for (let k = 0; k < len; k += 4) {
      for (let i = 0; i < across; i++) {
        const d = i + 0.5 - r;
        const hgt = Math.max(1, Math.round(Math.sqrt(Math.max(0, r * r - d * d)) * 0.8));
        const p = Math.round(c0 - r + i);
        if (axis === "x") v.put(x0 + k, y + hgt - 1, p, rib);
        else v.put(p, y + hgt - 1, z0 + k, rib);
      }
    }
  }
  return top;
}

/** Sawtooth factory roof */
export function sawtooth(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string, glass = "glass", tooth = 4): void {
  for (let x = x0; x < x1; x += tooth) {
    for (let s = 0; s < tooth - 1; s++) {
      v.box(x + s, y, z0, Math.min(x1, x + s + 1), y + s + 1, z1, col);
    }
    v.box(Math.min(x1 - 1, x + tooth - 1), y, z0, Math.min(x1, x + tooth), y + tooth - 1, z1, glass, 0.3);
  }
}

// ---------------------------------------------------------------------------------------------
// Round & ornamental shapes
// ---------------------------------------------------------------------------------------------

/** Vertical cylinder (center may be fractional, e.g. -0.0 centers on the 0/−1 seam) */
export function cyl(v: PixelVox, cx: number, cz: number, y0: number, y1: number, r: number, col: string, emit = 0): void {
  v.cylinderY(cx, cz, y0, y1, r, col, emit);
}

/** Hollow vertical ring (tank wall, cooling tower shell, rotunda) */
export function ring(v: PixelVox, cx: number, cz: number, y0: number, y1: number, rOut: number, rIn: number, col: string, emit = 0): void {
  const ri = Math.ceil(rOut) + 1;
  const o2 = rOut * rOut + 0.15;
  const i2 = rIn * rIn;
  for (let x = Math.floor(cx - ri); x <= Math.ceil(cx + ri); x++) {
    for (let z = Math.floor(cz - ri); z <= Math.ceil(cz + ri); z++) {
      const d2 = (x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2;
      if (d2 <= o2 && d2 >= i2) v.box(x, y0, z, x + 1, y1, z + 1, col, emit);
    }
  }
}

/** Hyperboloid cooling tower */
export function coolingTower(v: PixelVox, cx: number, cz: number, y0: number, h: number, rBase: number, col = "concrete", band2 = "red"): void {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    // radius quantised to half voxels so neighbouring layers share a silhouette (clean tiers, no creases);
    // wall ≥ 2.4 thick so the shell never shows see-through gaps between layers
    const r = Math.round(rBase * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.68) / 0.68, 1.6)) * 2) / 2;
    ring(v, cx, cz, y0 + y, y0 + y + 1, r, Math.max(0, r - 2.4), y >= h - 2 && band2 ? band2 : col);
  }
}

/** Onion dome (mosques, Russian-style towers) */
export function onionDome(v: PixelVox, cx: number, cz: number, y0: number, r: number, col: string, tip = "gold"): number {
  const h = Math.round(r * 2.6);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const rr = r * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.15)) * (1 - t * 0.35);
    v.cylinderY(cx, cz, y0 + y, y0 + y + 1, Math.max(0.45, rr), col);
  }
  v.box(Math.floor(cx), y0 + h, Math.floor(cz), Math.floor(cx) + 1, y0 + h + 2, Math.floor(cz) + 1, tip, 0.4);
  return y0 + h + 2;
}

/** Tapered spire (church steeple, minaret cap). Returns tip y. */
export function spire(v: PixelVox, cx: number, cz: number, y0: number, h: number, r: number, col: string, tip = "gold"): number {
  v.cone(cx, y0, y0 + h, cz, r, 0.4, col);
  v.box(Math.floor(cx), y0 + h, Math.floor(cz), Math.floor(cx) + 1, y0 + h + 2, Math.floor(cz) + 1, tip, 0.5);
  return y0 + h + 2;
}

/** Square column with base & capital */
export function column(v: PixelVox, x: number, z: number, y0: number, y1: number, col = "marble", cap = "marbleShade"): void {
  v.box(x, y0, z, x + 1, y1, z + 1, col);
  v.put(x, y0, z, cap);
  v.put(x, y1 - 1, z, cap);
}

/** Row of columns along x (at fixed z) or along z (at fixed x) */
export function colonnade(v: PixelVox, from: number, to: number, fixed: number, y0: number, y1: number, axis: "x" | "z", step = 2, col = "marble", cap = "marbleShade"): void {
  for (let p = from; p < to; p += step) {
    if (axis === "x") column(v, p, fixed, y0, y1, col, cap);
    else column(v, fixed, p, y0, y1, col, cap);
  }
}

/** Triangular pediment on the +z face across [x0,x1) at height y */
export function pediment(v: PixelVox, x0: number, x1: number, y: number, z0: number, z1: number, col = "marble", tympanum?: string): number {
  const w = x1 - x0;
  const rise = Math.ceil(w / 4);
  for (let s = 0; s < rise; s++) {
    const inset = s * 2;
    if (x0 + inset >= x1 - inset) break;
    v.box(x0 + inset, y + s, z0, x1 - inset, y + s + 1, z1, col);
    if (tympanum && s > 0 && x0 + inset + 1 < x1 - inset - 1) {
      v.box(x0 + inset + 1, y + s, z1 - 1, x1 - inset - 1, y + s + 1, z1, tympanum);
    }
  }
  return y + rise;
}

/** Arch opening on the +z face: clears a round-topped hole then frames it */
export function archway(v: PixelVox, cx: number, y0: number, z0: number, z1: number, w: number, h: number, frame?: string): void {
  const r = w / 2;
  for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const d = x + 0.5 - cx;
    const top = y0 + h - r + Math.sqrt(Math.max(0, r * r - d * d));
    v.box(x, y0, z0, x + 1, Math.round(top), z1, null);
    if (frame) v.put(x, Math.round(top), z1 - 1, frame);
  }
}

/** Clock face on the +z plane */
export function clockFace(v: PixelVox, cx: number, cy: number, z: number, r = 2, face = "white", hands = "black"): void {
  for (let x = -r; x <= r; x++) {
    for (let y = -r; y <= r; y++) {
      if (x * x + y * y <= r * r + 0.5) v.put(cx + x, cy + y, z, face, 0.25);
    }
  }
  v.put(cx, cy, z, hands);
  v.put(cx, cy + 1, z, hands);
  v.put(cx + 1, cy, z, hands);
}

// ---------------------------------------------------------------------------------------------
// Props: nature
// ---------------------------------------------------------------------------------------------

export type TreeKind = "round" | "pine" | "palm" | "cypress" | "blossom" | "birch" | "oak" | "autumn" | "willow" | "fruit";

/** Decorative tree. size ~ 1 (small) .. 3 (huge). Returns top y. */
export function tree(v: PixelVox, x: number, y: number, z: number, kind: TreeKind = "round", size = 1, seed = 0): number {
  const s = Math.max(0.6, size);
  const h = Math.round(3 * s);
  switch (kind) {
    case "pine": {
      v.box(x, y, z, x + 1, y + h, z + 1, "woodDark");
      const tiers = 2 + Math.round(s);
      let ty = y + Math.max(1, Math.round(h * 0.4));
      for (let t = 0; t < tiers; t++) {
        const r = (tiers - t) * 0.9 * s * 0.75 + 0.6;
        v.cone(x + 0.5, ty, ty + Math.round(2.4 * s), z + 0.5, r, 0.5, t % 2 === 0 ? "leafDark" : "moss");
        ty += Math.max(1, Math.round(1.6 * s));
      }
      v.put(x, ty + 1, z, "leafDark");
      return ty + 2;
    }
    case "cypress": {
      v.box(x, y, z, x + 1, y + 1, z + 1, "woodDark");
      const ch = Math.round(6 * s);
      for (let k = 0; k < ch; k++) {
        const t = k / ch;
        const r = 1.1 * s * Math.sin(Math.PI * Math.min(0.98, 0.2 + t * 0.85));
        v.cylinderY(x + 0.5, z + 0.5, y + 1 + k, y + 2 + k, Math.max(0.45, r), "leafDark");
      }
      return y + ch + 1;
    }
    case "palm": {
      const ph = Math.round(5 * s);
      for (let k = 0; k < ph; k++) {
        v.put(x + (k > ph * 0.6 ? 1 : 0), y + k, z, k % 2 ? "wood" : "oak");
      }
      const tx = x + (ph > 3 ? 1 : 0);
      const ty = y + ph;
      v.put(tx, ty, z, "leaf");
      const L = Math.max(2, Math.round(2.5 * s));
      for (let d = 1; d <= L; d++) {
        const dy = d === L ? -1 : 0;
        v.put(tx + d, ty + dy, z, "leafLight");
        v.put(tx - d, ty + dy, z, "leafLight");
        v.put(tx, ty + dy, z + d, "leaf");
        v.put(tx, ty + dy, z - d, "leaf");
      }
      v.put(tx, ty - 1, z + 1, "woodDark");
      return ty + 1;
    }
    case "birch": {
      v.box(x, y, z, x + 1, y + h + 1, z + 1, "white");
      v.put(x, y + 1, z, "charcoal");
      v.sphere(x + 0.5, y + h + 1.5, z + 0.5, 1.5 * s, 1.9 * s, 1.5 * s, "lime");
      return y + h + Math.round(3.4 * s);
    }
    case "willow": {
      v.box(x, y, z, x + 1, y + h, z + 1, "woodDark");
      v.sphere(x + 0.5, y + h + 0.5, z + 0.5, 2.6 * s, 1.6 * s, 2.6 * s, "olive");
      const r = Math.round(2.4 * s);
      for (let a = 0; a < 8; a++) {
        const dx = Math.round(Math.cos(a * 0.785) * r);
        const dz = Math.round(Math.sin(a * 0.785) * r);
        v.box(x + dx, y + 1, z + dz, x + dx + 1, y + h, z + dz + 1, "leafLight");
      }
      return y + h + Math.round(2 * s);
    }
    default: {
      const leaf =
        kind === "blossom" ? (seed % 2 ? "pink" : "magenta")
          : kind === "autumn" ? (seed % 3 === 0 ? "orange" : seed % 3 === 1 ? "amber" : "red")
            : kind === "oak" ? "leafDark"
              : kind === "fruit" ? "leaf"
                : seed % 2 ? "leaf" : "leafLight";
      v.box(x, y, z, x + 1, y + h, z + 1, "woodDark");
      if (kind === "oak") {
        v.put(x + 1, y + h - 1, z, "woodDark");
        v.put(x - 1, y + h - 1, z, "woodDark");
      }
      const r = (kind === "oak" ? 2.4 : 1.8) * s;
      v.sphere(x + 0.5, y + h + r * 0.55, z + 0.5, r, r * 0.85, r, leaf);
      v.sphere(x + 0.5 + r * 0.4, y + h + r * 0.9, z + 0.5 - r * 0.2, r * 0.6, r * 0.55, r * 0.6, kind === "blossom" ? "pink" : "leafLight");
      if (kind === "fruit") {
        for (let i = 0; i < 4; i++) {
          v.put(x + Math.round(Math.cos(i * 1.7 + seed) * r * 0.9), y + h + Math.round(r * 0.4), z + Math.round(Math.sin(i * 1.7 + seed) * r * 0.9), seed % 2 ? "red" : "orange");
        }
      }
      return y + h + Math.round(r * 1.7);
    }
  }
}

/** Low round bush */
export function bush(v: PixelVox, x: number, y: number, z: number, r = 1.2, col = "leaf", flower?: string): void {
  v.sphere(x + 0.5, y + r * 0.5, z + 0.5, r, r * 0.8, r, col);
  if (flower) {
    v.put(x, y + Math.round(r), z, flower);
    v.put(x + 1, y + Math.round(r * 0.6), z, flower);
  }
}

/** Flower bed rectangle with random blooms */
export function flowerBed(c: Ctx, x0: number, z0: number, x1: number, z1: number, y = 1, cols: string[] = ["pink", "yellow", "red", "purple", "white"]): void {
  c.v.box(x0, y - 1, z0, x1, y, z1, "soil");
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      c.v.put(x, y, z, c.rand() < 0.55 ? c.pick(cols) : "leaf");
    }
  }
}

/** Hedge wall */
export function hedge(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y = 1, h = 2, col = "leafDark"): void {
  v.box(x0, y, z0, x1, y + h, z1, col);
}

/** Rock cluster */
export function rocks(c: Ctx, x: number, y: number, z: number, n = 3, col = "stone"): void {
  for (let i = 0; i < n; i++) {
    const r = 0.8 + c.rand() * 1.2;
    c.v.sphere(x + c.ri(-2, 2) + 0.5, y + r * 0.3, z + c.ri(-2, 2) + 0.5, r, r * 0.7, r, i % 2 ? col : "granite");
  }
}

// ---------------------------------------------------------------------------------------------
// Props: street furniture, vehicles, people
// ---------------------------------------------------------------------------------------------

export const CAR_COLORS = ["red", "blue", "white", "silver", "charcoal", "teal", "yellow", "orange", "sky", "crimson"] as const;

/** Small car (5 long). axis = direction of travel. */
export function car(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", col = "red"): void {
  if (axis === "x") {
    v.box(x - 2, y, z - 1, x + 3, y + 1, z + 1, col);
    v.box(x - 1, y + 1, z - 1, x + 2, y + 2, z + 1, "glassDark");
    v.put(x - 1, y + 1, z - 1, col);
    v.put(x - 1, y + 1, z, col);
  } else {
    v.box(x - 1, y, z - 2, x + 1, y + 1, z + 3, col);
    v.box(x - 1, y + 1, z - 1, x + 1, y + 2, z + 2, "glassDark");
    v.put(x - 1, y + 1, z - 1, col);
    v.put(x, y + 1, z - 1, col);
  }
}

/** Truck (8 long) with cab + cargo box */
export function truck(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", cargo = "white", cab = "red"): void {
  if (axis === "x") {
    v.box(x - 4, y, z - 1, x + 2, y + 3, z + 1, cargo);
    v.box(x + 2, y, z - 1, x + 4, y + 2, z + 1, cab);
    v.put(x + 3, y + 1, z - 1, "glassDark");
    v.put(x + 3, y + 1, z, "glassDark");
  } else {
    v.box(x - 1, y, z - 4, x + 1, y + 3, z + 2, cargo);
    v.box(x - 1, y, z + 2, x + 1, y + 2, z + 4, cab);
    v.put(x - 1, y + 1, z + 3, "glassDark");
    v.put(x, y + 1, z + 3, "glassDark");
  }
}

/** Tiny person (1x3) */
export function person(v: PixelVox, x: number, y: number, z: number, shirt = "red", pants = "blueDark", skin = "#e8b38f"): void {
  v.put(x, y, z, pants);
  v.put(x, y + 1, z, shirt);
  v.put(x, y + 2, z, skin);
}

/** Street lamp (glowing head). */
export function lamp(v: PixelVox, x: number, y: number, z: number, h = 5, pole = "iron", light = "warmGlow"): void {
  v.box(x, y, z, x + 1, y + h, z + 1, pole);
  v.put(x, y + h, z, light, 1.2);
}

/** Park bench along x */
export function bench(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", col = "wood"): void {
  if (axis === "x") {
    v.box(x, y, z, x + 3, y + 1, z + 1, col);
    v.box(x, y + 1, z - 1, x + 3, y + 2, z, col);
  } else {
    v.box(x, y, z, x + 1, y + 1, z + 3, col);
    v.box(x - 1, y + 1, z, x, y + 2, z + 3, col);
  }
}

/** Flagpole with a flag on top. */
export function flag(v: PixelVox, x: number, y: number, z: number, h = 8, cols: string[] = ["red", "white", "blue"]): number {
  v.box(x, y, z, x + 1, y + h, z + 1, "silver");
  for (let i = 0; i < cols.length; i++) {
    v.box(x + 1, y + h - 1 - i, z, x + 4, y + h - i, z + 1, cols[i]);
  }
  v.put(x, y + h, z, "gold");
  return y + h + 1;
}

/** Rooftop AC unit */
export function acUnit(v: PixelVox, x: number, y: number, z: number): void {
  v.box(x, y, z, x + 2, y + 1, z + 2, "silver");
  v.put(x, y + 1, z, "steelDark");
}

/** Radio/antenna mast with blinking tip (register blink via ctx yourself if desired). Returns top y. */
export function antenna(v: PixelVox, x: number, y: number, z: number, h = 6, col = "steelDark"): number {
  v.box(x, y, z, x + 1, y + h, z + 1, col);
  v.put(x, y + h, z, "red", 1.2);
  return y + h;
}

/** Chimney stack. Returns top y (register smoke at it). */
export function chimney(v: PixelVox, x: number, y: number, z: number, h = 4, col = "brickDark", w = 2, cap = "charcoal"): number {
  v.box(x, y, z, x + w, y + h, z + w, col);
  v.box(x, y + h - 1, z, x + w, y + h, z + w, cap);
  return y + h;
}

/** Striped awning on the +z face (extends 2 voxels out from z). */
export function awning(v: PixelVox, x0: number, x1: number, y: number, z: number, a = "red", b = "white"): void {
  for (let x = x0; x < x1; x++) {
    const col = (x - x0) % 2 === 0 ? a : b;
    v.put(x, y, z, col);
    v.put(x, y - 1, z + 1, col);
  }
}

/** Glowing sign panel on +z face (flat plate) */
export function sign(v: PixelVox, x0: number, x1: number, y0: number, y1: number, z: number, col: string, emit = 0.9, border?: string): void {
  v.box(x0, y0, z, x1, y1, z + 1, col, emit);
  if (border) {
    v.box(x0, y0, z, x1, y0 + 1, z + 1, border);
    v.box(x0, y1 - 1, z, x1, y1, z + 1, border);
  }
}

/** Fence ring around a rectangle (posts every 2 voxels), optional gap on +z for a gate */
export function fence(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y = 1, h = 2, col = "woodLight", gate?: [number, number]): void {
  for (let x = x0; x < x1; x++) {
    const inGate = gate && x >= gate[0] && x < gate[1];
    const hh = x % 2 === 0 ? h : h - 1;
    v.box(x, y, z0, x + 1, y + hh, z0 + 1, col);
    if (!inGate) v.box(x, y, z1 - 1, x + 1, y + hh, z1, col);
  }
  for (let z = z0; z < z1; z++) {
    const hh = z % 2 === 0 ? h : h - 1;
    v.box(x0, y, z, x0 + 1, y + hh, z + 1, col);
    v.box(x1 - 1, y, z, x1, y + hh, z + 1, col);
  }
}

/** Chain-link / security fence with taller posts and optional razor top */
export function securityFence(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y = 1, h = 4, gate?: [number, number]): void {
  const mesh = "#9aa3ad";
  for (let x = x0; x < x1; x++) {
    const inGate = gate && x >= gate[0] && x < gate[1];
    v.box(x, y + (x % 4 === 0 ? 0 : 1), z0, x + 1, y + h, z0 + 1, x % 4 === 0 ? "steelDark" : mesh);
    if (!inGate) v.box(x, y + (x % 4 === 0 ? 0 : 1), z1 - 1, x + 1, y + h, z1, x % 4 === 0 ? "steelDark" : mesh);
  }
  for (let z = z0; z < z1; z++) {
    v.box(x0, y + (z % 4 === 0 ? 0 : 1), z, x0 + 1, y + h, z + 1, z % 4 === 0 ? "steelDark" : mesh);
    v.box(x1 - 1, y + (z % 4 === 0 ? 0 : 1), z, x1, y + h, z + 1, z % 4 === 0 ? "steelDark" : mesh);
  }
}

/** Swimming pool (sunk into ground layer) with coping */
export function pool(v: PixelVox, x0: number, z0: number, x1: number, z1: number, coping = "white"): void {
  v.box(x0, 0, z0, x1, 1, z1, coping);
  v.box(x0 + 1, 0, z0 + 1, x1 - 1, 1, z1 - 1, "cyan", 0.15);
}

/** Small round fountain */
export function fountain(v: PixelVox, cx: number, y: number, cz: number, r = 3, rim = "marble"): void {
  ring(v, cx, cz, y, y + 1, r, r - 1, rim);
  v.cylinderY(cx, cz, y, y + 1, r - 1, "water", 0.15);
  v.cylinderY(cx, cz, y, y + 3, 0.6, rim);
  v.put(Math.floor(cx), y + 3, Math.floor(cz), "foam", 0.4);
}

/** Solar panel row (tilted look via 2-step) along x */
export function solarRow(v: PixelVox, x0: number, x1: number, y: number, z: number, depth = 3): void {
  v.box(x0, y, z, x1, y + 1, z + 1, "steelDark");
  v.box(x0, y + 1, z, x1, y + 2, z + depth - 1, "solarBlue", 0.12);
  v.box(x0, y + 2, z + depth - 1, x1, y + 3, z + depth, "solarBlue", 0.12);
  for (let x = x0; x < x1; x += 3) v.put(x, y + 1, z, "silver");
}

/** Shipping container (6x3x3) */
export function container(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", col = "red"): void {
  if (axis === "x") {
    v.box(x, y, z, x + 6, y + 3, z + 3, col);
    v.box(x, y, z, x + 1, y + 3, z + 3, "steelDark");
    v.box(x + 5, y, z, x + 6, y + 3, z + 3, "steelDark");
  } else {
    v.box(x, y, z, x + 3, y + 3, z + 6, col);
    v.box(x, y, z, x + 3, y + 3, z + 1, "steelDark");
    v.box(x, y, z + 5, x + 3, y + 3, z + 6, "steelDark");
  }
}

/** Construction / port crane: mast + jib. Returns top y. */
export function crane(v: PixelVox, x: number, y: number, z: number, h = 16, jib = 10, col = "hazard", axis: "x" | "z" = "x"): number {
  v.box(x, y, z, x + 2, y + h, z + 2, col);
  for (let k = y + 2; k < y + h; k += 3) v.put(x, k, z, "steelDark");
  if (axis === "x") {
    v.box(x - 3, y + h, z, x + jib, y + h + 1, z + 2, col);
    v.box(x - 3, y + h - 2, z, x - 1, y + h, z + 2, "concreteDark");
    v.box(x + jib - 1, y + h - 5, z, x + jib, y + h, z + 1, "steelDark");
  } else {
    v.box(x, y + h, z - 3, x + 2, y + h + 1, z + jib, col);
    v.box(x, y + h - 2, z - 3, x + 2, y + h, z - 1, "concreteDark");
    v.box(x, y + h - 5, z + jib - 1, x + 1, y + h, z + jib, "steelDark");
  }
  v.box(x, y + h + 1, z, x + 2, y + h + 3, z + 2, "steelDark");
  return y + h + 3;
}

/** Storage tank with dome top. Returns top y. */
export function tank(v: PixelVox, cx: number, cz: number, y: number, h: number, r: number, col = "silver", top = "steelLight", band2?: string): number {
  v.cylinderY(cx, cz, y, y + h, r, col);
  if (band2) v.cylinderY(cx, cz, y + Math.floor(h / 2), y + Math.floor(h / 2) + 1, r, band2);
  v.dome(cx, y + h, cz, r * 0.85, top);
  return y + h + Math.ceil(r * 0.85);
}

/** Smokestack with stripes, returns top y */
export function smokestack(v: PixelVox, cx: number, cz: number, y: number, h: number, r = 1.2, col = "brick", stripe = "white"): number {
  v.cylinderY(cx, cz, y, y + h, r, col);
  if (stripe) {
    v.cylinderY(cx, cz, y + h - 3, y + h - 2, r, stripe);
    v.cylinderY(cx, cz, y + h - 6, y + h - 5, r, stripe);
  }
  v.cylinderY(cx, cz, y + h, y + h + 1, r + 0.3, "charcoal");
  return y + h + 1;
}

/** Stairs climbing in +z direction from (x0..x1, y, z) */
export function stairs(v: PixelVox, x0: number, x1: number, y: number, z: number, steps: number, col = "marbleShade", dir: 1 | -1 = 1): void {
  for (let s = 0; s < steps; s++) {
    const zz = z + s * dir;
    v.box(x0, y, zz, x1, y + steps - s, zz + 1, col);
  }
}

/** Helipad marking on a flat top */
export function helipad(v: PixelVox, cx: number, y: number, cz: number, r = 4): void {
  v.cylinderY(cx, cz, y, y + 1, r, "charcoal");
  ring(v, cx, cz, y, y + 1, r, r - 0.8, "white");
  const x = Math.floor(cx);
  const z = Math.floor(cz);
  v.box(x - 1, y, z - 1, x, y + 1, z + 2, "white");
  v.box(x + 1, y, z - 1, x + 2, y + 1, z + 2, "white");
  v.put(x, y, z, "white");
}

/** Water surface rectangle (sits in the ground layer) */
export function waterPlane(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y = 0, col = "water"): void {
  v.box(x0, y, z0, x1, y + 1, z1, col, 0.08);
}

/** Pick a wall/roof/trim style set by variant (4 coherent palettes) */
export interface Style {
  wall: string;
  wall2: string;
  roof: string;
  trim: string;
  accent: string;
  glass: string;
}

export const STYLE_SETS: Style[] = [
  { wall: "cream", wall2: "brick", roof: "terracotta", trim: "white", accent: "teal", glass: "glass" },
  { wall: "brick", wall2: "limestone", roof: "slate", trim: "cream", accent: "gold", glass: "glass" },
  { wall: "plaster", wall2: "woodLight", roof: "tealDark", trim: "woodDark", accent: "orange", glass: "glassDark" },
  { wall: "limestone", wall2: "slateLight", roof: "copper", trim: "charcoal", accent: "pink", glass: "glass" },
];

export function style(c: Ctx): Style {
  return STYLE_SETS[c.variant % 4];
}

/** Clamp a value into [lo, hi] */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Linear interpolation by level: lvl(c, [l1, l2, l3, l4, l5]) */
export function byLv<T>(c: Ctx, arr: readonly [T, T, T, T, T]): T {
  return arr[clamp(c.lv, 1, 5) - 1];
}

/** Paint both end voxels of a beam, plank or other thin component. */
export function solidVoxels(v: PixelVox) {
  return (x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,color:string,emit=0) =>
    v.box(Math.min(x0,x1),Math.min(y0,y1),Math.min(z0,z1),Math.max(x0,x1)+1,Math.max(y0,y1)+1,Math.max(z0,z1)+1,color,emit);
}
