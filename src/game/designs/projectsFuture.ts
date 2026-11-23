/**
 * Wonder-tier wealth projects (round 2 redesign).
 *
 * These entries override the matching ids registered by projects.ts (this module is imported
 * after it in designs/index.ts). Footprints, level names and growth text are taken from
 * WEALTH_PROJECTS so the catalog, handbook and level spans stay in sync.
 *
 * Shared variant language (matches designStyles.json):
 *   V0 Terracotta        — sun-baked Mediterranean / retro-Soviet warmth, round forms, terracotta & cream
 *   V1 White & teal      — clean future: white shells, glass, teal & cyan light
 *   V2 Brick & evergreen — Victorian/collegiate brick with green copper, trees everywhere
 *   V3 Slate & brass     — steampunk: dark slate, brass rings, rivets, amber light
 */
import {
  type Ctx,
  PixelVox,
  bench,
  bush,
  car,
  clockFace,
  door,
  flag,
  flowerBed,
  gable,
  hip,
  lamp,
  lot,
  person,
  ring,
  rocks,
  speckle,
  spire,
  tree,
  windows,
  type TreeKind,
} from "./kit";
import { defineDesigns } from "./registry";
import { PROJECT_BY_ID } from "../wealthProjects";

const F = Math.floor,
  R = Math.round,
  TAU = Math.PI * 2;

interface Pal {
  wall: string;
  wall2: string;
  roof: string;
  trim: string;
  accent: string;
  metal: string;
  glow: string;
  ground: string;
  pave: string;
  plant: string;
}
const PALS: Pal[] = [
  { wall: "#efc29b", wall2: "terracotta", roof: "#b95a3a", trim: "cream", accent: "teal", metal: "#c55a3a", glow: "cyan", ground: "#d8c198", pave: "#ead2ab", plant: "olive" },
  { wall: "white", wall2: "#e1f2ef", roof: "teal", trim: "tealDark", accent: "sky", metal: "chrome", glow: "screenCyan", ground: "#cfe3d8", pave: "concrete", plant: "leafLight" },
  { wall: "brick", wall2: "brickDark", roof: "#2f6b4f", trim: "#efe2c4", accent: "#3f8f6a", metal: "#2f5f48", glow: "lime", ground: "grass2", pave: "path2", plant: "leafDark" },
  { wall: "slate", wall2: "slateLight", roof: "iron", trim: "brass", accent: "gold", metal: "brass", glow: "amber", ground: "#8f9688", pave: "granite", plant: "moss" },
];
const pal = (c: Ctx) => PALS[c.variant % 4];
const lv5 = <T>(c: Ctx, a: readonly [T, T, T, T, T]) => a[Math.max(0, Math.min(4, c.lv - 1))];

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** 3D voxel line of thickness t. */
function line(v: PixelVox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: string, emit = 0, t = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) {
    const x = R(x0 + ((x1 - x0) * i) / n),
      y = R(y0 + ((y1 - y0) * i) / n),
      z = R(z0 + ((z1 - z0) * i) / n);
    v.box(x, y, z, x + t, y + t, z + t, col, emit);
  }
}

/** Vertical disc layer(s) with a per-voxel colour function (dx,dz relative to centre). */
function disc(v: PixelVox, cx: number, cz: number, y0: number, y1: number, r: number, col: (dx: number, dz: number, y: number) => string | null, emit = 0) {
  const ri = Math.ceil(r) + 1,
    r2 = r * r + 0.15;
  for (let x = F(cx - ri); x <= Math.ceil(cx + ri); x++)
    for (let z = F(cz - ri); z <= Math.ceil(cz + ri); z++) {
      const dx = x + 0.5 - cx,
        dz = z + 0.5 - cz;
      if (dx * dx + dz * dz > r2) continue;
      for (let y = y0; y < y1; y++) {
        const cc = col(dx, dz, y);
        if (cc) v.put(x, y, z, cc, emit);
      }
    }
}

/** Ring of voxels in a plane around the origin (for rotors). plane: xy faces +z, xz is flat, zy faces +x. */
function hoop(p: PixelVox, r: number, thick: number, plane: "xy" | "xz" | "zy", col: string, emit = 0, mark?: string, marks = 9, depth = 1) {
  const n = Math.ceil(TAU * r * 2.2);
  const every = Math.max(3, F(n / marks));
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    const isMark = mark && i % every < 2;
    for (let t = 0; t < thick; t += 0.5) {
      const rr = r - t,
        a1 = F(Math.cos(a) * rr),
        b1 = F(Math.sin(a) * rr);
      for (let d = 0; d < depth; d++) {
        const cc = isMark ? mark! : col,
          e = isMark ? Math.max(emit, 0.8) : emit;
        if (plane === "xy") p.put(a1, b1, d, cc, e);
        else if (plane === "xz") p.put(a1, d, b1, cc, e);
        else p.put(d, b1, a1, cc, e);
      }
    }
  }
}

/** Filled disc in the xy plane at depth z (portal membranes, rose windows). */
function discZ(v: PixelVox, cx: number, cy: number, z: number, r: number, col: (d: number, a: number) => string, emit = 0, depth = 1) {
  const ri = Math.ceil(r) + 1;
  for (let x = F(cx - ri); x <= Math.ceil(cx + ri); x++)
    for (let y = F(cy - ri); y <= Math.ceil(cy + ri); y++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy,
        d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) v.box(x, y, z, x + 1, y + 1, z + depth, col(d, Math.atan2(dy, dx)), emit);
    }
}

/** Open lattice tower (corner posts + X bracing) w×w footprint from (x,z). */
function lattice(v: PixelVox, x: number, z: number, w: number, y0: number, y1: number, col: string, brace = col) {
  for (const [px, pz] of [[x, z], [x + w - 1, z], [x, z + w - 1], [x + w - 1, z + w - 1]]) v.box(px, y0, pz, px + 1, y1, pz + 1, col);
  for (let y = y0; y < y1; y += w) {
    for (let i = 0; i < w; i++) {
      const yy = Math.min(y1 - 1, y + F((i * w) / w));
      v.put(x + i, yy, z, brace);
      v.put(x + w - 1 - i, yy, z + w - 1, brace);
      v.put(x, yy, z + i, brace);
      v.put(x + w - 1, yy, z + w - 1 - i, brace);
    }
    v.box(x, y, z, x + w, y + 1, z + 1, col);
    v.box(x, y, z + w - 1, x + w, y + 1, z + w, col);
    v.box(x, y, z, x + 1, y + 1, z + w, col);
    v.box(x + w - 1, y, z, x + w, y + 1, z + w, col);
  }
}

function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, y = 1) {
  const shirts = ["red", "blue", "yellow", "teal", "pink", "orange", "white", "purple"];
  for (let i = 0; i < n; i++) person(c.v, c.ri(x0, Math.max(x0, x1 - 1)), y, c.ri(z0, Math.max(z0, z1 - 1)), c.pick(shirts));
}

/** Transmission pylon with insulator arms. */
function pylon(c: Ctx, x: number, z: number, h: number, col = "steelDark", beacon = false) {
  const v = c.v;
  lattice(v, x - 1, z - 1, 3, 1, h, col);
  v.box(x - 4, h - 3, z, x + 5, h - 2, z + 1, col);
  v.box(x - 3, h, z, x + 4, h + 1, z + 1, col);
  for (const dx of [-4, 4, -3, 3]) v.put(x + dx, (Math.abs(dx) === 4 ? h - 4 : h - 1), z, "glass", 0.3);
  if (beacon) c.blink(x, h + 1, z, "red");
}

/** A futuristic hover car (6 long) with four ducted fans; spinning fans if `spin`. */
function hoverCar(c: Ctx, x: number, y: number, z: number, col: string, axis: "x" | "z" = "x", spin = false) {
  const v = c.v,
    L = axis === "x";
  const bx0 = L ? x - 3 : x - 1,
    bx1 = L ? x + 3 : x + 2,
    bz0 = L ? z - 1 : z - 3,
    bz1 = L ? z + 2 : z + 3;
  v.box(bx0, y, bz0, bx1, y + 1, bz1, col);
  v.box(L ? x - 1 : x - 1, y + 1, L ? z - 1 : z - 1, L ? x + 2 : x + 2, y + 2, L ? z + 2 : z + 2, "glass", 0.35);
  v.put(L ? bx1 - 1 : x, y, L ? z : bz1 - 1, "warmGlow", 1);
  v.put(x, y - 1, z, "screenCyan", 1.4);
  const fans: [number, number][] = [
    [bx0 - 1, bz0 - 1],
    [bx1, bz0 - 1],
    [bx0 - 1, bz1],
    [bx1, bz1],
  ];
  for (const [fx, fz] of fans) {
    v.put(fx, y, fz, "steelDark");
    if (spin) {
      const p = new PixelVox();
      p.box(-1, 0, 0, 2, 1, 1, "silver");
      p.box(0, 0, -1, 1, 1, 2, "silver");
      c.addRotor({ vox: p, pivot: [fx + 0.5, y + 1, fz + 0.5], axis: "y", speed: 16 });
    } else v.put(fx, y + 1, fz, "silver");
  }
}

/** Glowing level meter strip on a face (+z) — lit bars = level. */
function meter(c: Ctx, x: number, y: number, z: number, glow: string) {
  for (let i = 0; i < 5; i++) c.v.box(x, y + i * 2, z, x + 3, y + i * 2 + 1, z + 1, i < c.lv ? glow : "charcoal", i < c.lv ? 1 : 0);
}

// =============================================================================================
// SPACEPORT — a rocket on a gantry that grows into an orbital gateway.
//   V0 Terracotta: retro-Soviet cluster rocket with strap-on boosters, rust-red gantry
//   V1 White & teal: stainless reusable starship with black heat shield, catch-tower "chopsticks"
//   V2 Brick & evergreen: 1950s finned ogive rocket with portholes, green gantry in a pine clearing
//   V3 Slate & brass: Jules-Verne brass bullet with riveted bands and a flared nozzle bell
// =============================================================================================
function rocket(c: Ctx, x: number, z: number, y0: number, H: number, r: number): number {
  const v = c.v,
    k = c.variant,
    top = y0 + H;
  if (k === 0) {
    const bodyTop = top - R(r * 3);
    disc(v, x, z, y0, bodyTop, r, (_dx, _dz, y) => ((y - y0) % 7 === 5 ? "terracotta" : "white"));
    // wider payload fairing
    disc(v, x, z, bodyTop - 5, bodyTop, r + 0.7, () => "white");
    v.cone(x, bodyTop, top, z, r + 0.7, 0.4, "#c55a3a");
    const bh = R(H * 0.42);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = x + dx * (r + 0.6),
        bz = z + dz * (r + 0.6);
      v.cone(bx, y0, y0 + bh, bz, r * 0.8, r * 0.35, "white");
      disc(v, bx, bz, y0 + bh - 2, y0 + bh, r * 0.5, () => "terracotta");
      disc(v, bx, bz, y0, y0 + 1, r * 0.8, () => "charcoal");
    }
    v.box(F(x), top, F(z), F(x) + 1, top + 2, F(z) + 1, "red");
  } else if (k === 1) {
    const bodyTop = top - R(r * 2.5);
    disc(v, x, z, y0, bodyTop, r, (dx) => (dx < -0.4 ? "charcoal" : "chrome"));
    for (let y = bodyTop; y < top; y++) {
      const t = (y - bodyTop) / (top - bodyTop);
      disc(v, x, z, y, y + 1, Math.max(0.5, r * Math.sqrt(1 - t * t)), (dx) => (dx < -0.4 ? "charcoal" : "chrome"));
    }
    // flaps
    for (const s of [-1, 1]) {
      v.box(s > 0 ? R(x + r) : R(x - r) - 2, y0 + 1, F(z) - 1, s > 0 ? R(x + r) + 2 : R(x - r), y0 + 5, F(z) + 1, "charcoal");
      v.box(s > 0 ? R(x + r) : R(x - r) - 2, bodyTop - 4, F(z), s > 0 ? R(x + r) + 2 : R(x - r), bodyTop, F(z) + 1, "charcoal");
    }
    disc(v, x, z, y0 + R(H * 0.55), y0 + R(H * 0.55) + 1, r, (dx) => (dx < -0.4 ? "charcoal" : "steelLight"));
    v.put(F(x) - 1, bodyTop - 2, R(z + r) - 1, "screenCyan", 1);
  } else if (k === 2) {
    const bodyTop = top - R(r * 3.4);
    for (let y = y0; y < top; y++) {
      const t = (y - y0) / H;
      const rr = y < bodyTop ? r * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, t * 1.3))) : r * Math.cos(((y - bodyTop) / (top - bodyTop)) * Math.PI * 0.5);
      disc(v, x, z, y, y + 1, Math.max(0.5, rr), (dx, dz) => (y >= bodyTop ? "red" : (Math.floor((Math.atan2(dz, dx) + Math.PI) / (Math.PI / 2)) + F((y - y0) / 6)) % 2 ? "cream" : "red"));
    }
    // portholes
    for (let y = y0 + 6; y < bodyTop - 2; y += 5) v.put(F(x), y, R(z + r * 0.9), "warmGlow", 1);
    // fins
    const fh = R(H * 0.3);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 0; i < fh; i++) {
        const out = R(r + 3 - (i * 3) / fh);
        line(v, R(x + dx * r), y0 - 2 + i, R(z + dz * r), R(x + dx * out), y0 - 2 + i, R(z + dz * out), "#2f6b4f");
      }
    }
  } else {
    const bodyTop = top - R(r * 2.6);
    v.cone(x, y0 - 2, y0 + 2, z, r + 1.2, r * 0.6, "iron");
    disc(v, x, z, y0 + 2, bodyTop, r, (dx, dz, y) => ((y - y0) % 6 === 0 ? "copper" : (y - y0) % 6 === 1 && (R(dx * 3 + dz * 5) % 3 === 0) ? "goldDark" : "brass"));
    for (let y = bodyTop; y < top; y++) {
      const t = (y - bodyTop) / (top - bodyTop);
      disc(v, x, z, y, y + 1, Math.max(0.5, r * (1 - t * t)), () => (t > 0.75 ? "gold" : "copper"));
    }
    for (let y = y0 + 8; y < bodyTop - 2; y += 6) {
      v.put(F(x), y, R(z + r * 0.9), "amber", 1.1);
      v.put(R(x + r * 0.9), y, F(z), "amber", 1.1);
    }
    // stabiliser vanes
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) line(v, R(x + dx * r * 0.7), y0 + 6, R(z + dz * r * 0.7), R(x + dx * (r + 2)), y0 + 1, R(z + dz * (r + 2)), "iron");
  }
  c.blink(F(x), top + 1, F(z), "red");
  return top;
}

function spaceport(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  // No full-parcel platform slab: each spaceport zone sits directly on terrain with its own functional apron/footing.
  const H = lv5(c, [14, 22, 30, 40, 54]),
    r = lv5(c, [1.6, 2, 2.5, 3, 4]);
  const rx = R(-hx * 0.25),
    rz = R(-hz * 0.25);
  const padR = lv5(c, [7, 8, 9, 11, 13]);
  // Functional circular launch pad + flame trench toward +z
  disc(v, rx, rz, 0, 1, padR, (dx, dz) => (Math.abs(Math.sqrt(dx * dx + dz * dz) - padR + 1) < 0.7 ? "hazard" : "concrete"));
  disc(v, rx, rz, 1, 2, padR - 3, () => "concreteDark");
  v.box(rx - 2, 0, rz, rx + 2, 2, Math.min(hz - 1, rz + padR + 4), "charcoal");
  v.box(rx - 2, 1, rz + padR - 2, rx + 2, 2, Math.min(hz, rz + padR + 4), null);
  const y0 = k === 2 ? 4 : 2 + (k === 3 ? 2 : 1);
  // launch mount
  v.box(rx - 3, 2, rz - 3, rx - 1, y0, rz + 3, "steelDark");
  v.box(rx + 1, 2, rz - 3, rx + 3, y0, rz + 3, "steelDark");
  const top = rocket(c, rx, rz, y0, H, r);
  c.smoke(rx, 2, rz + padR, "steam");
  c.smoke(rx - 2, 2, rz + 2, "steam");
  if (lv >= 3) c.smoke(rx + 2, 2, rz + 3, "steam");
  // gantry / launch tower grounded directly on concrete footing
  const gw = lv >= 4 ? 5 : 4,
    gx = rx - F(gw / 2),
    gz = R(rz - r) - gw - 2,
    gH = top + 2;
  const gcol = [p.metal, "white", p.metal, "iron"][k];
  v.box(gx - 1, 0, gz - 1, gx + gw + 1, 1, gz + gw + 1, "concreteDark");
  lattice(v, gx, gz, gw, 1, gH, gcol, k === 3 ? "brass" : gcol);
  v.box(gx - 1, gH, gz - 1, gx + gw + 1, gH + 1, gz + gw + 1, gcol);
  v.box(gx + F(gw / 2), gH + 1, gz + F(gw / 2), gx + F(gw / 2) + 1, gH + 6, gz + F(gw / 2) + 1, "steelDark");
  c.blink(gx + F(gw / 2), gH + 6, gz + F(gw / 2), "red");
  // swing arms reach forward to the rocket
  const arms = lv5(c, [1, 2, 3, 3, 4]);
  for (let i = 0; i < arms; i++) {
    const ay = y0 + R(H * (0.3 + (0.55 * (i + 1)) / arms));
    v.box(rx - 1, ay, gz + gw, rx + 1, ay + 1, R(rz - r) + 1, k === 1 ? "steelLight" : gcol);
    v.box(rx - 1, ay + 1, gz + gw, rx + 1, ay + 3, gz + gw + 2, "glass", 0.4);
  }
  // elevator car
  v.box(gx - 1, R(gH * 0.6), gz + 1, gx, R(gH * 0.6) + 2, gz + 3, "warmGlow", 0.9);
  if (k === 1 && lv >= 4) {
    // catch-tower chopsticks
    for (const dx of [-4, 3]) v.box(rx + dx, top - 6, gz + gw, rx + dx + 1, top - 5, R(rz + r) + 2, "steelDark");
  }
  // fuel spheres on compact concrete footings
  const tanks = lv5(c, [1, 2, 2, 3, 4]);
  for (let i = 0; i < tanks; i++) {
    const tx = R(hx * 0.2) + i * 7 - (lv >= 4 ? 6 : 0),
      tz = R(-hz * 0.62) + (i % 2) * 2;
    v.box(tx - 2, 0, tz - 2, tx + 2, 1, tz + 2, "concrete");
    for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(tx + dx, 1, tz + dz, tx + dx + 1, 4, tz + dz + 1, "steelDark");
    v.sphere(tx, 6, tz, 3, 3, 3, i % 2 ? (k === 3 ? "copper" : "white") : k === 3 ? "brass" : k === 0 ? "cream" : "silver");
    line(v, tx, 2, tz, rx + 3, 2, rz, "steelDark");
  }
  // blockhouse → mission control with tight local apron + access walk
  const mw = lv5(c, [8, 10, 12, 14, 18]),
    md = lv5(c, [6, 7, 9, 10, 12]),
    mh = lv5(c, [4, 5, 7, 8, 10]);
  const mx = hx - mw - 2,
    mz = hz - md - 3;
  v.box(mx - 1, 0, mz - 1, mx + mw + 1, 1, mz + md + 2, p.pave);
  v.box(mx + 1, 0, mz + md + 2, mx + 4, 1, hz, "path2");
  if (k === 1) {
    v.box(mx, 1, mz, mx + mw, mh + 1, mz + md, "white");
    v.box(mx + 1, 2, mz + md - 1, mx + mw - 1, mh, mz + md, "glass", 0.4);
    v.box(mx - 1, mh + 1, mz - 1, mx + mw + 1, mh + 2, mz + md + 1, "teal");
  } else if (k === 3) {
    v.hollowBox(mx, 1, mz, mx + mw, mh + 1, mz + md, "slate", "brass");
    windows(c, mx, 1, mz, mx + mw, mh + 1, mz + md, { col: "amber", emit: 0.8, faces: "se" });
    hip(v, mx - 1, mh + 1, mz - 1, mx + mw + 1, mz + md + 1, "iron", "brass", 3);
  } else {
    v.hollowBox(mx, 1, mz, mx + mw, mh + 1, mz + md, k === 0 ? p.wall : "brick", p.trim);
    windows(c, mx, 1, mz, mx + mw, mh + 1, mz + md, { col: "glass", emit: 0.5, faces: "sew", w: 2 });
    v.box(mx - 1, mh + 1, mz - 1, mx + mw + 1, mh + 2, mz + md + 1, k === 0 ? "terracotta" : "#2f6b4f");
  }
  door(v, mx + 2, 1, mz + md - 1, "steelDark");
  // tracking dish
  if (lv >= 2) {
    const dr = lv5(c, [2, 2, 3, 4, 6]),
      dx = mx + mw - dr - 1,
      dz = mz + F(md / 2),
      dy = mh + 2;
    v.box(dx, dy, dz, dx + 1, dy + 2, dz + 1, "steelDark");
    const dish = new PixelVox();
    for (let a = -dr; a <= dr; a++)
      for (let b = -dr; b <= dr; b++) {
        const d = Math.sqrt(a * a + b * b);
        if (d <= dr) dish.put(a, R(d * d * 0.18) + 1, b, d > dr - 1 ? (k === 3 ? "brass" : "steelLight") : "white");
      }
    dish.box(0, 1, 0, 1, R(dr * dr * 0.18) + 3, 1, "steelDark");
    dish.put(0, R(dr * dr * 0.18) + 3, 0, "red", 1);
    c.addRotor({ vox: dish, pivot: [dx + 0.5, dy + 2, dz + 0.5], axis: "y", speed: 0.4 });
  }
  if (lv >= 3) {
    // vehicle assembly building with tight slab + crawler track directly on ground
    const ah = lv5(c, [0, 0, 14, 20, 26]),
      aw = lv5(c, [0, 0, 9, 11, 13]),
      ax = mx - aw - 3 + (lv === 3 ? 2 : 0),
      az = R(-hz * 0.7);
    v.box(ax - 1, 0, az - 1, ax + aw + 1, 1, az + 11, "concrete");
    v.hollowBox(ax, 1, az, ax + aw, ah, az + 10, k === 1 ? "white" : k === 3 ? "slateLight" : "concrete", k === 3 ? "brass" : "steelLight");
    v.box(ax + 2, 1, az + 9, ax + aw - 2, ah - 3, az + 10, "steelDark");
    v.box(ax + aw - 3, ah - 8, az + 10, ax + aw - 1, ah - 2, az + 11, k === 0 ? "red" : k === 1 ? "teal" : k === 2 ? "#2f6b4f" : "brass");
    v.box(ax, ah, az, ax + aw, ah + 1, az + 10, "concreteDark");
    // crawler track to pad
    v.box(ax + 2, 0, az + 10, ax + aw - 2, 1, Math.min(hz - 1, rz + 2), "#9f9584");
  }
  if (lv >= 4) {
    // lightning towers grounded directly
    for (const [lx, lz] of [[rx - padR + 1, rz + padR - 2], [rx + padR - 1, rz - padR + 2]]) {
      v.box(lx, 0, lz, lx + 1, top + 6, lz + 1, "steelDark");
      c.blink(lx, top + 6, lz, "red");
    }
    // passenger terminal with tight local curb
    const tx0 = -hx + 2,
      tz0 = hz - 9;
    v.box(tx0 - 1, 0, tz0 - 1, tx0 + 15, 1, hz, p.pave);
    v.box(tx0, 1, tz0, tx0 + 14, 6, hz - 2, k === 3 ? "slateLight" : p.wall);
    v.box(tx0 + 1, 2, hz - 3, tx0 + 13, 5, hz - 2, "glass", 0.5);
    v.box(tx0 - 1, 6, tz0 - 1, tx0 + 15, 7, hz - 1, p.trim);
    crowd(c, tx0 + 2, hz - 2, tx0 + 13, hz, 4);
  }
  if (lv >= 5) {
    // returned booster on landing pad
    const lx = R(hx * 0.45),
      lz = R(-hz * 0.05);
    disc(v, lx, lz, 0, 1, 6, (dx, dz) => (Math.abs(dx) < 1 || Math.abs(dz) < 1 ? "white" : "charcoal"));
    ring(v, lx, lz, 0, 1, 6, 5.2, "hazard");
    disc(v, lx, lz, 3, 16, 2, (dx) => (k === 1 ? (dx > 0 ? "charcoal" : "chrome") : k === 3 ? "brass" : "white"));
    v.cone(lx, 16, 18, lz, 2, 1, "charcoal");
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) line(v, lx + dx, 5, lz + dz, lx + dx * 4, 1, lz + dz * 4, "steelDark");
    c.smoke(lx, 2, lz, "steam");
    // the orbital gateway arch with grounded stone piers & walkway (no raised platform slab)
    const gy = 12;
    v.ringZ(0, gy, hz - 4, hz - 2, 10, 8, k === 3 ? "brass" : k === 1 ? "white" : p.wall2);
    v.ringZ(0, gy, hz - 3, hz - 2, 8, 7.4, p.glow, 1.2);
    v.box(-10, 0, hz - 5, -7, 1, hz - 1, "concreteDark");
    v.box(7, 0, hz - 5, 10, 1, hz - 1, "concreteDark");
    v.box(-3, 0, hz - 6, 3, 1, hz, p.pave);
    c.blink(0, gy + 10, hz - 3, "red");
  }
  if (k === 2) for (let i = 0; i < lv + 2; i++) tree(v, -hx + 2 + ((i * 5) % (hx - 4)), 1, hz - 2 - (i % 2) * 3, "pine", 1.1 + (i % 3) * 0.2);
  lamp(v, hx - 2, 1, -hz + 2, 5);
}

// =============================================================================================
// PUMPED-STORAGE STATION — an upper reservoir climbs up the back of the lot; penstocks drop to a
// powerhouse over the lower basin at the front.
//   V0 Terracotta: earthen stepped embankment with terracotta coping & an adobe pump house
//   V1 White & teal: elevated white cylindrical tanks on a podium, teal penstocks, sleek turbine pod
//   V2 Brick & evergreen: forested hill with a stone dam lip and a brick Victorian powerhouse
//   V3 Slate & brass: vertical slate dam wall with brass penstocks and a riveted steam-era turbine hall
// =============================================================================================
function pumpedStorage(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 2 ? "grass" : p.ground);
  const UH = lv5(c, [6, 10, 13, 18, 26]);
  // lower basin (front)
  const lz0 = R(hz * 0.2),
    lz1 = hz - 2;
  v.box(-hx + 1, 0, lz0, hx - 1, 2, lz1, k === 3 ? "granite" : k === 1 ? "white" : "concrete");
  v.box(-hx + 2, 1, lz0 + 1, hx - 2, 2, lz1 - 1, null);
  v.box(-hx + 2, 0, lz0 + 1, hx - 2, 1, lz1 - 1, "water", 0.12);
  // upper reservoir (back)
  const uz0 = -hz + 1,
    ud = R(hz * 0.95),
    uz1 = uz0 + ud,
    ux0 = -hx + 1,
    ux1 = hx - 1;
  let rimY = UH;
  if (k === 0) {
    for (let s = 0; s < UH; s++) {
      const ins = F(s * 0.7);
      v.box(ux0 + ins, s, uz0 + F(ins / 2), ux1 - ins, s + 1, uz1 - ins, s % 3 === 2 ? "#c9a26b" : "#b8935e");
      if (s > 0) v.clear(ux0 + ins + 2, s, uz0 + F(ins / 2) + 2, ux1 - ins - 2, s + 1, uz1 - ins - 2);
    }
    const ins = F(UH * 0.7);
    v.box(ux0 + ins, UH, uz0 + F(ins / 2), ux1 - ins, UH + 1, uz1 - ins, "terracotta");
    v.box(ux0 + ins + 1, UH, uz0 + F(ins / 2) + 1, ux1 - ins - 1, UH + 1, uz1 - ins - 1, "water", 0.12);
    for (let s = 2; s < UH; s += 3) v.box(ux0 + F(s * 0.7), s, uz1 - F(s * 0.7) - 1, ux1 - F(s * 0.7), s + 1, uz1 - F(s * 0.7), "olive");
  } else if (k === 1) {
    const n = lv >= 3 ? 2 : 1,
      tr = Math.min(R(hz * 0.42), R((hx * 0.9) / n)) - 1;
    v.box(ux0 + 1, 1, uz0 + 1, ux1 - 1, 4, uz1 - 2, "white");
    v.box(ux0 + 1, 3, uz1 - 3, ux1 - 1, 4, uz1 - 2, "teal");
    for (let i = 0; i < n; i++) {
      const tx = n === 1 ? 0 : (i === 0 ? -1 : 1) * R(hx * 0.48),
        tz = uz0 + tr + 1;
      for (let y = 4; y < UH; y++) v.cylinderY(tx, tz, y, y + 1, y < UH - 3 ? tr * 0.5 : tr * (0.5 + (0.5 * (y - UH + 3)) / 3), "white");
      ring(v, tx, tz, UH, UH + 3, tr, tr - 1, "white");
      ring(v, tx, tz, UH + 2, UH + 3, tr, tr - 1, "teal", 0.4);
      v.cylinderY(tx, tz, UH, UH + 2, tr - 1, "water", 0.15);
    }
    rimY = UH + 2;
  } else if (k === 2) {
    for (let s = 0; s < UH; s++) {
      const t = s / UH,
        sx = F((hx - 2) * (1 - t * t * 0.55)),
        sz = F((ud / 2) * (1 - t * t * 0.55));
      v.box(-sx, s, uz0 + ud / 2 - sz, sx, s + 1, uz0 + ud / 2 + sz, s % 2 ? "grass2" : "grass");
      if (s > 0) v.clear(-sx + 2, s, uz0 + ud / 2 - sz + 2, sx - 2, s + 1, uz0 + ud / 2 + sz - 2);
    }
    const t = 1,
      sx = F((hx - 2) * (1 - t * 0.55)),
      sz = F((ud / 2) * (1 - t * 0.55));
    v.box(-sx, UH, uz0 + F(ud / 2) - sz, sx, UH + 1, uz0 + F(ud / 2) + sz, "stone");
    v.box(-sx + 1, UH, uz0 + F(ud / 2) - sz + 1, sx - 1, UH + 1, uz0 + F(ud / 2) + sz - 1, "water", 0.12);
    for (let i = 0; i < 4 + lv * 2; i++) {
      const st = F(UH * (0.25 + 0.25 * (i % 3))),
        t = st / UH,
        sxx = F((hx - 2) * (1 - t * t * 0.55)),
        szz = F((ud / 2) * (1 - t * t * 0.55)),
        side = i % 4;
      const along = -1 + (2 * ((i * 37) % 11)) / 10;
      const tx = side < 2 ? R(along * (sxx - 3)) : side === 2 ? -sxx + 1 : sxx - 2,
        tz = side < 2 ? R(uz0 + ud / 2 + (side === 0 ? szz - 2 : -szz + 1)) : R(uz0 + ud / 2 + along * (szz - 3));
      tree(v, tx, st + 1, tz, "pine", 0.9 + (i % 3) * 0.2);
    }
  } else {
    // rocky granite crag held back by a buttressed slate dam face
    for (let st = 0; st < UH; st++) {
      const ins = F(st * 0.35);
      v.box(ux0 + ins, st, uz0 + ins, ux1 - ins, st + 1, uz1 - 3, st % 4 === 3 ? "stone" : "granite");
      if (st > 0) v.clear(ux0 + ins + 2, st, uz0 + ins + 2, ux1 - ins - 2, st + 1, uz1 - 5);
    }
    const ins = F(UH * 0.35);
    v.box(ux0 + ins, UH, uz0 + ins, ux1 - ins, UH + 1, uz1 - 3, "water", 0.12);
    v.box(ux0 + 1, 1, uz1 - 3, ux1 - 1, UH + 1, uz1 - 1, "slate");
    for (let x = ux0 + 2; x < ux1 - 2; x += 5) {
      v.box(x, 1, uz1 - 1, x + 2, UH + 1, uz1, "slateLight");
      v.box(x, 1, uz1, x + 2, F(UH / 2), uz1 + 1, "slateLight");
    }
    v.box(ux0 + 1, UH + 1, uz1 - 3, ux1 - 1, UH + 2, uz1 - 1, "brass");
    // brass valve tower in the reservoir
    const vx = R(-hx * 0.4),
      vz = uz0 + ins + 4;
    v.cylinderY(vx, vz, UH, UH + 6, 1.6, "brass");
    v.cylinderY(vx, vz, UH + 6, UH + 7, 2.2, "iron");
    v.put(vx, UH + 4, vz + 1, "amber", 1);
    c.blink(vx, UH + 7, vz, "amber");
    rimY = UH + 1;
  }
  // penstocks
  const pens = lv5(c, [1, 1, 2, 2, 3]),
    pcol = [p.metal, "teal", "steel", "brass"][k],
    phY = lv5(c, [4, 5, 6, 8, 10]);
  const phz0 = lz0 - 6,
    phz1 = lz0 + 2;
  for (let i = 0; i < pens; i++) {
    const px = pens === 1 ? -1 : R(-hx * 0.45 + (i * hx * 0.9) / (pens - 1)) - 1;
    line(v, px, rimY - 1, uz1 - 4, px, phY, phz0, pcol, 0, 2);
    for (let t = 0; t < 1; t += 0.25) {
      const yy = R(rimY - 1 + (phY - rimY + 1) * t),
        zz = R(uz1 - 4 + (phz0 - uz1 + 4) * t);
      v.box(px - 1, Math.min(yy, phY) - 1 > 0 ? 1 : 1, zz, px + 3, yy, zz + 1, "concreteDark");
      v.box(px - 1, yy, zz, px + 3, yy + 1, zz + 1, p.trim);
    }
  }
  // powerhouse straddling the basin edge
  const pw = Math.min(hx * 2 - 4, lv5(c, [10, 12, 18, 22, 30])),
    px0 = -F(pw / 2);
  if (k === 1) {
    v.box(px0, 1, phz0, px0 + pw, phY, phz1, "white");
    v.box(px0 + 1, 2, phz1 - 1, px0 + pw - 1, phY - 1, phz1, "glass", 0.45);
    v.box(px0, phY, phz0, px0 + pw, phY + 1, phz1, "teal");
  } else {
    v.hollowBox(px0, 1, phz0, px0 + pw, phY, phz1, k === 0 ? p.wall : k === 2 ? "brick" : "slate", p.trim);
    windows(c, px0, 1, phz0, px0 + pw, phY, phz1, { col: k === 3 ? "amber" : "glass", emit: 0.6, faces: "s", w: 2, h: 2, stepH: 4 });
    if (k === 0) v.box(px0 - 1, phY, phz0 - 1, px0 + pw + 1, phY + 1, phz1 + 1, "terracotta");
    if (k === 2) gable(v, px0 - 1, phY, phz0 - 1, px0 + pw + 1, phz1 + 1, "x", "#2f6b4f", "#efe2c4");
    if (k === 3) {
      v.box(px0 - 1, phY, phz0 - 1, px0 + pw + 1, phY + 1, phz1 + 1, "brass");
      v.box(px0 + 2, phY + 1, phz0 + 1, px0 + pw - 2, phY + 3, phz1 - 1, "iron");
    }
  }
  meter(c, px0 + pw - 5, 2, phz1, p.glow);
  // outflow turbines (visible, spinning) at the basin face
  const turbines = lv >= 4 ? (lv === 5 ? 3 : 2) : lv >= 2 ? 1 : 0;
  for (let i = 0; i < turbines; i++) {
    const tx = R(px0 + ((i + 1) * pw) / (turbines + 1)),
      tr = lv >= 4 ? 3 : 2;
    const wheel = new PixelVox();
    hoop(wheel, tr, 1, "xy", k === 3 ? "brass" : k === 1 ? "teal" : "steelDark", 0, "white", 6, 1);
    for (let b = 0; b < 6; b++) line(wheel, 0, 0, 0, R(Math.cos((b * TAU) / 6) * tr), R(Math.sin((b * TAU) / 6) * tr), 0, k === 2 ? "woodDark" : "steelLight");
    c.addRotor({ vox: wheel, pivot: [tx, tr + 1, phz1 + 1], axis: "z", speed: k === 2 ? 1.2 : 2.5 });
    c.smoke(tx, 1, phz1 + 2, "steam");
  }
  if (lv >= 3) pylon(c, hx - 4, phz0 - 2, phY + 8 + lv, k === 3 ? "iron" : "steelDark", lv >= 5);
  if (lv >= 4) pylon(c, -hx + 4, phz0 - 2, phY + 6 + lv, k === 3 ? "iron" : "steelDark", lv >= 5);
  if (lv >= 5) {
    // spillway waterfall down the dam face into the lower basin
    const wx = R(hx * 0.55);
    for (let y = 1; y < rimY; y++) v.box(wx, y, uz1 - 2 + (k === 3 ? 0 : -F(y * 0.2)), wx + 3, y + 1, uz1 - 1 + (k === 3 ? 1 : -F(y * 0.2)), y % 3 ? "water" : "foam", 0.35);
    c.smoke(wx + 1, 2, lz0 + 1, "steam");
    flag(v, hx - 3, 1, lz0 - 1, 12, [p.glow, "white", p.accent]);
  }
  crowd(c, -hx + 3, lz1 - 1, -hx + 8, lz1, lv >= 3 ? 2 : 1, 2);
}

// =============================================================================================
// FLYING-CAR DEPOT — a sky taxi mast that grows taller and sprouts stacked landing pads; at the top
// levels a carousel of air taxis orbits the crown.
//   V0 Terracotta: round adobe tower with circular pads and striped awnings
//   V1 White & teal: tapered white needle with thin disc pads like leaves, teal edge lights
//   V2 Brick & evergreen: square brick tower, square planted pads with little trees
//   V3 Slate & brass: open lattice truss mast with brass hex pads and searchlights
// =============================================================================================
function flyingCarDepot(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, p.pave);
  const H = lv5(c, [7, 15, 24, 36, 48]);
  const cr = lv5(c, [2, 2.5, 3.5, 4, 4.5]);
  const carCols = ["red", "yellow", "sky", "magenta", "orange", "lime", "white"];
  // core
  if (k === 0) {
    disc(v, 0, 0, 1, H, cr, (_dx, _dz, y) => (y % 6 === 0 ? "terracotta" : y % 6 === 3 ? "cream" : p.wall));
  } else if (k === 1) {
    v.cone(0, 1, H, 0, cr + 1, cr * 0.5, "white");
    disc(v, 0, 0, 1, H, 0.9, () => "glass", 0.4);
  } else if (k === 2) {
    const s = F(cr);
    v.hollowBox(-s, 1, -s, s, H, s, "brick", "#efe2c4");
    for (let y = 4; y < H - 1; y += 4) v.box(-s, y, -s, s, y + 1, s, "brickDark");
    windows(c, -s, 1, -s, s, H, s, { col: "warmGlow", emit: 0.7, stepV: 4, stepH: 3 });
  } else {
    const s = F(cr);
    lattice(v, -s, -s, s * 2, 1, H, "iron", "brass");
    v.box(-1, 1, -1, 1, H, 1, "glass", 0.5);
  }
  // pads
  const pads = lv5(c, [1, 2, 3, 4, 5]);
  const dirs: [number, number][] = [
    [1, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [0, 0],
  ];
  const padR = lv5(c, [5, 5, 6, 6, 7]);
  for (let i = 0; i < pads; i++) {
    const top = i === pads - 1;
    const py = top ? H : R(H * (0.35 + (0.55 * i) / Math.max(1, pads - 1)));
    const [dx, dz] = top ? [0, 0] : dirs[i % 4];
    const pcx = R(dx * (hx - padR - 1)),
      pcz = R(dz * (hz - padR - 1));
    const pr = top ? Math.min(Math.min(hx, hz) - 2, lv5(c, [6, 6, 7, 8, 9])) : padR;
    if (!top) line(v, 0, py - 3, 0, pcx, py - 1, pcz, k === 3 ? "brass" : p.trim, 0, 2);
    if (k === 0 || k === 1) {
      disc(v, pcx, pcz, py, py + 1, pr, (ddx, ddz) => {
        const d = Math.sqrt(ddx * ddx + ddz * ddz);
        return d > pr - 1 ? (k === 0 ? "terracotta" : "teal") : Math.abs(d - pr * 0.55) < 0.6 ? "white" : k === 0 ? "cream" : "steelLight";
      });
      ring(v, pcx, pcz, py, py + 1, pr, pr - 0.7, k === 0 ? "terracotta" : p.glow, k === 1 ? 0.9 : 0);
    } else if (k === 2) {
      v.box(pcx - pr, py, pcz - pr, pcx + pr, py + 1, pcz + pr, "#7e8b6d");
      v.box(pcx - pr, py + 1, pcz - pr, pcx + pr, py + 2, pcz - pr + 1, "leafDark");
      v.box(pcx - pr, py + 1, pcz + pr - 1, pcx + pr, py + 2, pcz + pr, "leafDark");
      bush(v, pcx - pr + 1, py + 2, pcz - pr, 1, "leaf", "pink");
      if (pr >= 6) tree(v, pcx + pr - 2, py + 1, pcz - pr + 1, "round", 0.7);
    } else {
      for (let a = 0; a < 6; a++) {
        const a0 = (a * TAU) / 6,
          a1 = ((a + 1) * TAU) / 6;
        line(v, R(pcx + Math.cos(a0) * pr), py, R(pcz + Math.sin(a0) * pr), R(pcx + Math.cos(a1) * pr), py, R(pcz + Math.sin(a1) * pr), "brass");
      }
      disc(v, pcx, pcz, py, py + 1, pr - 0.8, () => "slate");
    }
    // H marker
    v.box(pcx - 1, py + 1, pcz - 2, pcx, py + 1 + 0, pcz + 2, "white");
    v.put(pcx - 2, py, pcz - 1, "white");
    v.put(pcx - 2, py, pcz, "white");
    v.put(pcx + 1, py, pcz - 1, "white");
    v.put(pcx + 1, py, pcz, "white");
    v.put(pcx - 1, py, pcz, "white");
    v.put(pcx, py, pcz, "white");
    c.blink(pcx + pr - 1, py + 1, pcz, top ? "red" : p.glow === "lime" ? "lime" : "amber");
    hoverCar(c, pcx + (top ? 0 : 0), py + 2, pcz + (top ? 2 : 0), carCols[(i + k) % carCols.length], i % 2 ? "z" : "x", false);
  }
  // glazed control cab ring just under the top pad + mast at the pad rim
  if (lv >= 2) {
    disc(v, 0, 0, H - 4, H - 1, cr + 1.5, (dx, dz) => (dx * dx + dz * dz > (cr + 0.6) * (cr + 0.6) ? "glass" : null), 0.6);
    disc(v, 0, 0, H - 5, H - 4, cr + 2, () => (k === 3 ? "brass" : k === 1 ? "white" : k === 0 ? "terracotta" : "#2f6b4f"));
    const mx = Math.min(hx, hz) - 3;
    v.box(-mx, H + 1, 0, -mx + 1, H + 7 + lv, 1, "steelDark");
    v.box(-mx + 1, H + 5 + lv, 0, -mx + 4, H + 6 + lv, 1, "orange");
    c.blink(-mx, H + 7 + lv, 0, "red");
  }
  // hovering taxis with spinning fans
  const flying = lv5(c, [1, 1, 2, 2, 3]);
  for (let i = 0; i < flying; i++) {
    const fy = R(H * (0.55 + 0.25 * i)) + 4;
    hoverCar(c, i % 2 ? -hx + 5 : hx - 5, Math.min(fy, H + 10), i % 2 ? hz - 5 : -hz + 5, carCols[(i * 3 + k + 2) % carCols.length], i % 2 ? "z" : "x", true);
  }
  // orbiting air-taxi carousel
  if (lv >= 4) {
    const orbit = new PixelVox(),
      rr = Math.min(hx, hz) - 4;
    const cols = carCols;
    const place = (x: number, z: number, axis: "x" | "z", col: string) => {
      const L = axis === "x";
      orbit.box(L ? x - 3 : x - 1, 0, L ? z - 1 : z - 3, L ? x + 3 : x + 2, 1, L ? z + 2 : z + 3, col);
      orbit.box(x - 1, 1, z - 1, x + 2, 2, z + 2, "glass", 0.4);
      orbit.put(x, -1, z, "screenCyan", 1.4);
    };
    place(0, rr, "x", cols[k]);
    place(0, -rr, "x", cols[k + 1]);
    place(rr, 0, "z", cols[k + 2]);
    place(-rr, 0, "z", cols[k + 3]);
    if (lv >= 5) {
      // glowing traffic halo lane
      hoop(orbit, rr + 1, 1, "xz", p.glow, 0.9, "white", 16);
    }
    c.addRotor({ vox: orbit, pivot: [0, H - 6, 0], axis: "y", speed: 0.45 });
  }
  // ground: boarding plaza
  v.box(-hx + 1, 1, hz - 3, -hx + 5, 4, hz - 1, p.wall2);
  v.box(-hx + 1, 4, hz - 4, -hx + 6, 5, hz - 1, p.trim);
  crowd(c, -hx + 1, hz - 6, hx - 1, hz - 4, lv + 1);
  if (lv >= 3) lamp(v, hx - 2, 1, hz - 2, 5, "iron", p.glow === "amber" ? "amber" : "warmGlow");
  if (lv >= 5) {
    // aerial-interchange pylon spines with beacons
    for (const s of [-1, 1]) {
      v.box(s * (hx - 2), 1, -s * (hz - 2), s * (hx - 2) + 1, H - 8, -s * (hz - 2) + 1, k === 3 ? "brass" : p.trim);
      c.blink(s * (hx - 2), H - 8, -s * (hz - 2), "red");
    }
  }
}

// =============================================================================================
// TELEPORTATION DEPOT — glowing gate arches with spinning rings and emissive portals.
//   V0 Terracotta: ancient star-gate — thick terracotta ring with gold chevrons, cyan event horizon
//   V1 White & teal: sleek white torus with teal light strips, white-cyan portal
//   V2 Brick & evergreen: Victorian brick gatehouse arches with ivy, green flux portal
//   V3 Slate & brass: brass armillary gyroscope, violet portal, amber capacitor coils
// =============================================================================================
function portal(c: Ctx, cx: number, cy: number, z: number, r: number, spinRings: number) {
  const v = c.v,
    k = c.variant;
  const frame = ["terracotta", "white", "brick", "slate"][k],
    mark = ["gold", "teal", "#3f8f6a", "brass"][k];
  const m1 = ["cyan", "screenCyan", "lime", "purple"][k],
    m2 = ["blue", "white", "leaf", "magenta"][k];
  // static outer frame
  if (k === 2) {
    // pointed brick arch
    const w = R(r) + 2;
    v.box(cx - w, 1, z - 1, cx - w + 2, cy + 1, z + 2, "brick");
    v.box(cx + w - 2, 1, z - 1, cx + w, cy + 1, z + 2, "brick");
    for (let i = 0; i <= w; i++) {
      const yy = cy + R(Math.sqrt(Math.max(0, w * w - (w - i) * (w - i))) * 1.05);
      v.box(cx - w + i, yy, z - 1, cx - w + i + 2, yy + 2, z + 2, "brick");
      v.box(cx + w - i - 2, yy, z - 1, cx + w - i, yy + 2, z + 2, "brick");
      if (i % 3 === 0) v.put(cx - w + i, yy + 2, z + 2, "leafDark");
    }
    v.box(cx - 1, cy + w, z - 1, cx + 1, cy + w + 3, z + 2, "#efe2c4");
  } else {
    v.ringZ(cx, cy, z - 1, z + 2, r + 2, r, frame);
    if (k === 0) for (let i = 0; i < 9; i++) {
      const a = (i * TAU) / 9 + Math.PI / 2;
      v.box(R(cx + Math.cos(a) * (r + 1)) - 1, R(cy + Math.sin(a) * (r + 1)) - 1, z + 2, R(cx + Math.cos(a) * (r + 1)) + 1, R(cy + Math.sin(a) * (r + 1)) + 1, z + 3, "gold", 0.6);
    }
    if (k === 1) v.ringZ(cx, cy, z + 2, z + 3, r + 1.2, r + 0.6, "teal", 1);
  }
  // event horizon
  discZ(v, cx, cy, z, r - 0.3, (d, a) => ((F(d * 1.1 + a * 1.6) % 2 + 2) % 2 ? m1 : m2), 1.3);
  // feet / plinth
  v.box(cx - r - 3, 1, z - 3, cx + r + 3, 2, z + 4, k === 3 ? "granite" : k === 1 ? "white" : "concrete");
  for (let s = 0; s < 2; s++) v.box(cx - 3, 1, z + 4 + s, cx + 3, 2 - s, z + 5 + s, k === 0 ? "#e2c79a" : "concreteDark");
  // raised pedestal under tall gates, with a stair up to the event horizon
  const ped = R(cy - r - 2);
  if (ped > 2) {
    v.box(cx - 4, 1, z - 2, cx + 4, ped + 1, z + 3, k === 3 ? "slate" : k === 1 ? "white" : k === 2 ? "brick" : "terracotta");
    v.box(cx - 5, ped, z - 3, cx + 5, ped + 1, z + 4, k === 3 ? "brass" : k === 1 ? "teal" : k === 2 ? "#efe2c4" : "gold");
    for (let s = 0; s < ped; s++) v.box(cx - 2, 1, z + 3 + s, cx + 2, ped + 1 - s, z + 4 + s, k === 0 ? "#e2c79a" : "concreteDark");
  }
  // spinning rings
  for (let i = 0; i < spinRings; i++) {
    const rot = new PixelVox(),
      rr = r + 3 + i * 2;
    if (i === 0) {
      hoop(rot, rr, 1.5, "xy", k === 2 ? "brass" : mark, 0.3, m1, 9, 1);
      c.addRotor({ vox: rot, pivot: [cx + 0.5, cy + 0.5, z + 0.5], axis: "z", speed: 1.2 });
    } else {
      hoop(rot, rr, 1, "xy", i % 2 ? (k === 3 ? "brass" : "steelLight") : mark, 0.4, m2, 6, 1);
      c.addRotor({ vox: rot, pivot: [cx + 0.5, cy + 0.5, z + 0.5], axis: i % 2 ? "y" : "x", speed: i % 2 ? 0.8 : -0.6 });
    }
  }
}

function capacitor(c: Ctx, x: number, z: number, h: number) {
  const v = c.v,
    k = c.variant,
    glow = ["cyan", "screenCyan", "lime", "amber"][k];
  v.box(x - 1, 1, z - 1, x + 2, 3, z + 2, k === 3 ? "iron" : "steelDark");
  for (let y = 3; y < h; y++) v.box(x, y, z, x + 1, y + 1, z + 1, y % 2 ? (k === 3 ? "copper" : "steelLight") : "white");
  for (let y = 4; y < h - 1; y += 2) {
    v.put(x - 1, y, z, k === 3 ? "brass" : "silver");
    v.put(x + 1, y, z, k === 3 ? "brass" : "silver");
    v.put(x, y, z - 1, k === 3 ? "brass" : "silver");
    v.put(x, y, z + 1, k === 3 ? "brass" : "silver");
  }
  v.sphere(x + 0.5, h + 1, z + 0.5, 1.6, 1.6, 1.6, glow, 1.4);
  c.smoke(x, h + 2, z, "spark");
}

function teleportDepot(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 0 ? "#e2c79a" : p.pave);
  // glowing floor grid
  for (let x = -hx + 2; x < hx - 1; x += 4) v.box(x, 0, -hz + 1, x + 1, 1, hz - 1, p.glow, 0.25);
  if (lv === 1) {
    portal(c, 0, 7, 0, 4.5, 1);
    capacitor(c, -hx + 2, -hz + 3, 8);
    capacitor(c, hx - 3, -hz + 3, 8);
    person(v, 0, 2, 5, "white");
    v.box(-hx + 1, 1, hz - 3, -hx + 4, 3, hz - 1, "steelDark");
    v.put(-hx + 2, 3, hz - 2, p.glow, 1);
    return;
  }
  if (lv === 2) {
    portal(c, 0, 8, -2, 5.5, 1);
    // arrivals hall behind
    const hy = 6;
    v.box(-hx + 1, 1, -hz + 1, hx - 1, hy, -9, k === 2 ? "brick" : k === 3 ? "slate" : p.wall);
    v.box(-hx + 2, 2, -10, hx - 2, hy - 1, -9, "glass", 0.4);
    v.box(-hx, hy, -hz, hx, hy + 1, -8, p.trim);
    v.box(-4, hy + 1, -10, 4, hy + 3, -9, p.glow, 1);
    capacitor(c, -hx + 2, 6, 9);
    capacitor(c, hx - 3, 6, 9);
    // queue rails
    for (let z = 6; z < hz - 1; z += 2) {
      v.put(-3, 2, z, "chrome");
      v.put(2, 2, z, "chrome");
    }
    crowd(c, -2, 6, 2, hz - 1, 3);
    return;
  }
  if (lv === 3) {
    portal(c, -8, 8, 0, 5, 1);
    portal(c, 8, 8, 0, 5, 1);
    capacitor(c, 0, -4, 16);
    // energy arcs from pylon to gates
    line(v, 0, 16, -4, -6, 14, 0, p.glow, 1);
    line(v, 0, 16, -4, 6, 14, 0, p.glow, 1);
    // gatehouse
    v.box(-hx + 1, 1, -hz + 1, hx - 1, 9, -hz + 8, k === 2 ? "brick" : k === 3 ? "slate" : p.wall);
    windows(c, -hx + 1, 1, -hz + 1, hx - 1, 9, -hz + 8, { col: p.glow, emit: 0.8, faces: "s", w: 2, h: 3 });
    if (k === 2) gable(v, -hx, 9, -hz, hx, -hz + 9, "x", "#2f6b4f", "#efe2c4");
    else v.box(-hx, 9, -hz, hx, 10, -hz + 9, p.trim);
    crowd(c, -hx + 2, 7, hx - 2, hz - 1, 6, 1);
    return;
  }
  // L4 & L5: a monumental gate with gyroscope rings
  const big = lv === 4 ? 8 : 10;
  const cy = big + 8;
  portal(c, 0, cy, -2, big, lv === 4 ? 2 : 3);
  for (const [px, pz] of [[-hx + 3, -hz + 3], [hx - 4, -hz + 3], [-hx + 3, hz - 4], [hx - 4, hz - 4]]) {
    const ph = lv === 4 ? 14 : 20;
    capacitor(c, px, pz, ph);
    if (pz < 0) line(v, px, ph + 1, pz, px < 0 ? -big - 2 : big + 2, cy, -2, p.glow, 1.1);
    if (lv === 5) c.blink(px, ph + 3, pz, "red");
  }
  // glowing plaza ring
  ring(v, 0, -2, 0, 1, Math.min(hx, hz) - 2, Math.min(hx, hz) - 3, ["cyan", "screenCyan", "lime", "purple"][k], 0.9);
  if (lv === 5) {
    // sky beam from the crown
    v.box(-1, cy + big + 5, -3, 1, cy + big + 26, -1, ["cyan", "screenCyan", "lime", "purple"][k], 1.2);
    v.cone(0, cy + big + 2, cy + big + 6, -2, 3, 1, k === 3 ? "brass" : p.wall2);
    c.blink(0, cy + big + 27, -2, "white");
  }
  crowd(c, -8, 6, 8, hz - 2, lv === 5 ? 12 : 7);
  for (const s of [-1, 1]) lamp(v, s * 6, 1, hz - 2, 4, "iron", p.glow === "amber" ? "amber" : "warmGlow");
}

// =============================================================================================
// HANGING GARDEN ARCOLOGY — a terraced green tower with cascading planting and open lifts.
//   V0 Terracotta: Babylon ziggurat — stepped terracotta tiers dripping with vines
//   V1 White & teal: twisting stack of rotated white floor plates edged with planters
//   V2 Brick & evergreen: brick tower with alternating deep balconies, a tree on every one
//   V3 Slate & brass: slate core ringed by brass-framed glass greenhouse pods spiralling up
// =============================================================================================
function arcology(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 2 ? "grass" : p.pave);
  const floors = lv5(c, [3, 6, 10, 15, 21]),
    fh = 4;
  const W = Math.min(hx, hz),
    ex = hx - W; // extra length on x for 1x2 etc (z-long when hz>hx)
  void ex;
  const hxIn = hx - 1,
    hzIn = hz - 1;
  // base garden court with pool
  v.box(-hxIn, 0, hzIn - 3, hxIn, 1, hzIn, k === 1 ? "white" : p.pave);
  if (lv >= 2) v.box(-hxIn + 2, 0, hzIn - 2, -hxIn + 6, 1, hzIn, "water", 0.15);
  const top = 1 + floors * fh;
  const vines = (x: number, y: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) v.put(x, y - i, z, i % 2 ? "leaf" : "leafDark");
  };
  for (let f = 0; f < floors; f++) {
    const y = 1 + f * fh,
      t = f / Math.max(1, floors - 1);
    if (k === 0) {
      // Babylonian tiers: several floors per tier, a planted terrace at each step
      const tiers = lv5(c, [1, 2, 3, 4, 5]),
        fpt = Math.ceil(floors / tiers),
        tier = F(f / fpt),
        stepW = Math.max(2, F((Math.min(hxIn, hzIn) - 4) / tiers));
      const ins = tier * stepW;
      const edge = f % fpt === fpt - 1 || f === floors - 1;
      const x0 = -hxIn + ins,
        x1 = hxIn - ins,
        z0 = -hzIn + ins,
        z1 = hzIn - ins;
      v.hollowBox(x0 + 1, y, z0 + 1, x1 - 1, y + fh, z1 - 1, f % 2 ? p.wall : "#e9b48c", "terracotta");
      windows(c, x0 + 1, y, z0 + 1, x1 - 1, y + fh, z1 - 1, { col: "warmGlow", emit: 0.6, stepH: 3, h: 2, stepV: 4 });
      v.box(x0 + 1, y + fh - 1, z0 + 1, x1 - 1, y + fh, z1 - 1, "terracotta");
      if (edge) {
        v.box(x0, y + fh, z0, x1, y + fh + 1, z1, "leafDark");
        v.box(x0 + 2, y + fh, z0 + 2, x1 - 2, y + fh + 1, z1 - 2, null);
        for (let x = x0 + 1; x < x1; x += 3) {
          vines(x, y + fh - 1, z1 - 1 + 1, 1 + ((x * 7 + f) % 4));
          vines(x, y + fh - 1, z0 - 1 + 1 - 1, 1 + ((x * 3 + f) % 3));
        }
        for (let z = z0 + 1; z < z1; z += 3) {
          vines(x0 - 1 + 1 - 1, y + fh - 1, z, 1 + ((z + f) % 3));
          vines(x1, y + fh - 1, z, 1 + ((z * 5 + f) % 4));
        }
        for (let x = x0 + 2; x < x1 - 2; x += 6) tree(v, x, y + fh + 1, z1 - 1, (x / 6) % 2 ? "palm" : "cypress", 0.7);
        tree(v, x1 - 1, y + fh + 1, z0, "palm", 0.7);
      }
    } else if (k === 1) {
      const a = f * 0.13,
        hs = Math.min(hxIn, hzIn) * 0.72;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      // rotated floor plate
      for (let x = -hxIn; x < hxIn; x++)
        for (let z = -hzIn; z < hzIn; z++) {
          const u = (x + 0.5) * ca + (z + 0.5) * sa,
            w = -(x + 0.5) * sa + (z + 0.5) * ca;
          const ext = Math.max(Math.abs(u), Math.abs(w) * (hx === hz ? 1 : 0.9));
          if (ext <= hs) {
            const edge = ext > hs - 1;
            v.put(x, y + fh - 1, z, edge ? "leafLight" : "white");
            if (edge) v.put(x, y + fh, z, (x + z + f) % 4 ? "leaf" : "pink");
            else if (ext < hs * 0.62 && ext > hs * 0.62 - 1) for (let yy = y; yy < y + fh - 1; yy++) v.put(x, yy, z, (x + z) % 3 ? "glass" : "warmGlow", 0.35);
          }
        }
      if (f % 3 === 1) tree(v, R(Math.cos(a + 0.8) * hs * 0.85), y + fh, R(Math.sin(a + 0.8) * hs * 0.85), "birch", 0.6);
    } else if (k === 2) {
      const s = Math.min(hxIn, hzIn) - 4;
      v.hollowBox(-s, y, -s, s, y + fh, s, f % 2 ? "brick" : "brick2", "#efe2c4");
      windows(c, -s, y, -s, s, y + fh, s, { col: "warmGlow", emit: 0.6, stepH: 3, h: 2, stepV: 4 });
      // balconies alternate sides
      const sides = f % 2 ? ["s", "w"] : ["e", "n"];
      for (const sd of sides) {
        const [bx0, bz0, bx1, bz1] =
          sd === "s" ? [-s, s, s, s + 3] : sd === "n" ? [-s, -s - 3, s, -s] : sd === "e" ? [s, -s, s + 3, s] : [-s - 3, -s, -s, s];
        v.box(bx0, y + fh - 1, bz0, bx1, y + fh, bz1, "concrete");
        for (let i = 0; i < 3; i++) {
          const tx = sd === "s" || sd === "n" ? -s + 2 + i * F((2 * s - 3) / 2) : sd === "e" ? s + 1 : -s - 2;
          const tz = sd === "e" || sd === "w" ? -s + 2 + i * F((2 * s - 3) / 2) : sd === "s" ? s + 1 : -s - 2;
          if ((i + f) % 2 === 0) tree(v, tx, y + fh, tz, f % 3 ? "round" : "blossom", 0.6, f);
          else bush(v, tx, y + fh, tz, 1, "leafDark");
        }
      }
    } else {
      const s = Math.min(3, Math.min(hxIn, hzIn) - 4);
      v.hollowBox(-s, y, -s, s, y + fh, s, "slate", "brass");
      v.box(-s, y + 1, s - 1, s, y + 2, s, "amber", 0.7);
      // pods spiralling
      const n = W >= 16 ? 3 : 1;
      for (let j = 0; j < n; j++) {
        const a = f * 0.9 + (j * TAU) / n,
          pr = Math.max(5, Math.min(hxIn, hzIn) - 4),
          px = R(Math.cos(a) * pr),
          pz = R(Math.sin(a) * pr);
        line(v, 0, y + 1, 0, px, y + 1, pz, "brass");
        v.cylinderY(px, pz, y, y + 1, 2.6, "brass");
        v.dome(px, y + 1, pz, 2.6, "glass", 0.25);
        v.put(px, y + 1, pz, "leaf");
        v.put(px, y + 2, pz, "leafLight");
        v.put(px - 1, y + 1, pz, "pink");
      }
    }
  }
  // open lift shaft
  if (lv >= 2) {
    const lx = k === 1 ? -1 : hxIn - (k === 0 ? 2 : 2),
      lz = k === 1 ? -1 : -hzIn + 1;
    v.box(lx, 1, lz, lx + 2, top - 2, lz + 1, "glass", 0.3);
    v.box(lx, R(top * 0.45), lz, lx + 2, R(top * 0.45) + 2, lz + 1, "warmGlow", 1.1);
    if (lv >= 4) v.box(lx, R(top * 0.75), lz, lx + 2, R(top * 0.75) + 2, lz + 1, "warmGlow", 1.1);
  }
  // waterfall down the front
  if (lv >= 4) {
    for (let y = 2; y < top - 4; y++) v.put(k === 2 ? 0 : -1, y, Math.min(hzIn - 3, R(hzIn * 0.62) + (k === 0 ? -F(((y - 1) / fh) * (Math.min(hxIn, hzIn) - 3) * 0.75 / floors) : 0)), y % 3 ? "water" : "foam", 0.4);
    v.box(-3, 0, hzIn - 3, 2, 1, hzIn - 1, "water", 0.2);
  }
  // crown
  if (lv >= 5) {
    const cr = k === 3 ? 4 : 5;
    v.dome(0, top, 0, cr, "glass", 0.3);
    tree(v, 0, top, 0, k === 0 ? "palm" : "round", 1.1);
    const rot = new PixelVox();
    for (let b = 0; b < 3; b++) for (let d = 1; d <= 5; d++) rot.put(R(Math.cos((b * TAU) / 3) * d), 0, R(Math.sin((b * TAU) / 3) * d), "white");
    rot.put(0, 0, 0, "steelDark");
    v.box(0, top + cr, 0, 1, top + cr + 5, 1, "steelDark");
    c.addRotor({ vox: rot, pivot: [0.5, top + cr + 5, 0.5], axis: "y", speed: 1.4, wind: true });
    c.blink(0, top + cr + 6, 0, "red");
  } else if (lv >= 3) {
    tree(v, 0, top, 0, k === 0 ? "palm" : "round", 0.9);
  }
  crowd(c, -hxIn + 1, hzIn - 3, hxIn - 1, hzIn, lv + 1);
  if (lv === 1) {
    tree(v, -hxIn + 1, 1, hzIn - 2, "fruit", 0.6);
    flowerBed(c, hxIn - 4, hzIn - 3, hxIn - 1, hzIn - 1);
  }
}

// =============================================================================================
// SOLAR CANOPY ORCHARD — fruit rows under raised "panel petal" canopies, sprawling outward.
//   V0 Terracotta: citrus grove under terracotta-post pergolas with flat panel trellis
//   V1 White & teal: white "solar trees" — flower-shaped panel discs on stalks over apple rows
//   V2 Brick & evergreen: vineyard rows under brick-pillared gabled panel canopies
//   V3 Slate & brass: brass sun-tracking heliostat dishes (rotating) over olive groves
// =============================================================================================
function solarOrchard(c: Ctx) {
  const { v, lv, hx, hz } = c,
    k = c.variant;
  lot(c, k === 0 ? "#cfae7c" : k === 3 ? "#9c9a78" : "grass2");
  speckle(c, k === 0 ? "sandDark" : "grass3", 0.08);
  const treeKind: TreeKind[] = ["fruit", "fruit", "round", "round"];
  const rowStep = 7;
  // working area width (leave a front strip for the picker court on L3+)
  const zFront = lv >= 3 ? hz - 7 : hz - 1;
  const rows: number[] = [];
  for (let z = -hz + 4; z < zFront - 2; z += rowStep) rows.push(z);
  for (const z of rows) {
    // soil strip with crops
    v.box(-hx + 1, 0, z - 1, hx - 1, 1, z + 2, "soil");
    for (let x = -hx + 2; x < hx - 1; x += k === 2 ? 2 : 4) {
      if (k === 2) {
        v.box(x, 1, z, x + 1, 3, z + 1, "woodDark");
        v.put(x, 3, z, "leaf");
        v.put(x, 2, z + 1, (x / 2) % 2 ? "purple" : "leafDark");
      } else tree(v, x, 1, z, k === 3 ? "round" : treeKind[k], 0.62, x + z);
      if (k === 3 && (x / 4) % 2 === 0) v.put(x, 3, z + 1, "olive");
    }
    // canopy
    const ri = rows.indexOf(z);
    if (k === 0) {
      // pergola with alternating panel "petals" so the citrus peeks through
      for (let x = -hx + 2; x < hx - 2; x += 6) {
        v.box(x, 1, z - 2, x + 1, 8, z - 1, "terracotta");
        v.box(x, 1, z + 2, x + 1, 8, z + 3, "terracotta");
        v.box(x, 8, z - 2, x + 1, 9, z + 3, "woodDark");
      }
      v.box(-hx + 2, 8, z, hx - 2, 9, z + 1, "woodDark");
      for (let x = -hx + 2; x < hx - 3; x += 4) {
        const up = (F(x / 4) + ri) % 2 === 0;
        v.box(x, up ? 9 : 8, up ? z - 2 : z + 1, x + 3, up ? 10 : 9, up ? z + 1 : z + 3, "solarBlue", 0.15);
      }
    } else if (k === 1) {
      for (let x = -hx + 5 + (ri % 2) * 4; x < hx - 3; x += 9) {
        v.box(x, 1, z + 3, x + 1, 9, z + 4, "white");
        // petal disc
        for (let pt = 0; pt < 6; pt++) {
          const a = (pt * TAU) / 6;
          const px = R(x + Math.cos(a) * 2.5),
            pz = R(z + 3 + Math.sin(a) * 2.5);
          v.box(px - 1, 9 + (pt % 2), pz - 1, px + 1, 10 + (pt % 2), pz + 1, "solarBlue", 0.15);
          v.put(px, 10 + (pt % 2), pz, "white");
        }
        v.put(x, 10, z + 3, "teal", 0.6);
      }
    } else if (k === 2) {
      // brick piers carrying a single tilted panel shelf over each vine row
      for (let x = -hx + 2; x < hx - 2; x += 8) {
        v.box(x, 1, z - 3, x + 2, 6, z - 2, "brick");
        v.box(x, 1, z + 2, x + 2, 8, z + 3, "brick");
        v.put(x, 8, z + 2, "#2f6b4f");
        v.put(x + 1, 8, z + 2, "#2f6b4f");
      }
      for (let d = 0; d < 5; d++) v.box(-hx + 2, 6 + F(d / 2), z - 3 + d, hx - 2, 7 + F(d / 2), z - 2 + d, d === 4 ? "#2f6b4f" : "solarBlue", d === 4 ? 0 : 0.15);
    } else {
      for (let x = -hx + 4 + (ri % 2) * 5; x < hx - 3; x += 10) {
        v.box(x, 1, z + 3, x + 1, 7, z + 4, "iron");
        v.put(x, 7, z + 3, "brass");
        const dish = new PixelVox();
        for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10) dish.put(a, R(a * 0.5 + (a * a + b * b) * 0.08), b, a * a + b * b > 6 ? "brass" : "solarBlue", 0.1);
        dish.put(0, 1, 0, "amber", 0.8);
        const spin = c.rotors.length < 6;
        if (spin) c.addRotor({ vox: dish, pivot: [x + 0.5, 8, z + 3.5], axis: "y", speed: 0.15 + (x & 3) * 0.02 });
        if (!spin) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10) v.put(x + a, 8 + R(a * 0.5 + (a * a + b * b) * 0.08), z + 3 + b, a * a + b * b > 6 ? "brass" : "solarBlue", 0.1);
      }
    }
  }
  // wiring trunk to an inverter
  const ix = hx - 5,
    iz = -hz + 1;
  v.box(ix, 1, iz, ix + 3, 4, iz + 2, k === 3 ? "brass" : "steelLight");
  v.put(ix + 1, 3, iz + 2, "screenGreen", 1);
  if (lv >= 3) {
    // picker court: packing shed, crates, pickers, farm truck
    const sx = -hx + 2,
      sz = hz - 6;
    v.box(sx, 1, sz, sx + 10, 5, hz - 1, k === 1 ? "white" : k === 2 ? "brick" : k === 3 ? "slate" : "#efc29b");
    v.box(sx + 2, 1, hz - 2, sx + 6, 4, hz - 1, "woodDark");
    v.box(sx - 1, 5, sz - 1, sx + 11, 6, hz, k === 0 ? "terracotta" : "solarBlue", 0.1);
    for (let i = 0; i < 3 + lv; i++) {
      const cx = sx + 12 + (i % 4) * 3,
        cz = hz - 3 - F(i / 4) * 2;
      if (cx < hx - 2) {
        v.box(cx, 1, cz, cx + 2, 3, cz + 2, "crate");
        v.put(cx, 3, cz, i % 2 ? "orange" : k === 2 ? "purple" : "red");
      }
    }
    crowd(c, -hx + 2, rows[0] ?? 0, hx - 2, zFront - 2, lv + 2);
  }
  if (lv >= 4) {
    // battery bank + farm stand
    for (let i = 0; i < lv - 2; i++) v.box(hx - 4 - i * 4, 1, -hz + 4, hx - 1 - i * 4, 4, -hz + 6, "white");
    for (let i = 0; i < lv - 2; i++) v.put(hx - 3 - i * 4, 3, -hz + 6, "screenGreen", 1);
  }
  if (lv >= 5) {
    // the giant sun-tree at the heart of the grove
    const cx = R(hx * 0.35),
      cz = hz - 10,
      th = 22;
    v.box(cx, 1, cz, cx + 2, th, cz + 2, k === 3 ? "brass" : k === 1 ? "white" : k === 2 ? "brick" : "terracotta");
    for (let pt = 0; pt < 8; pt++) {
      const a = (pt * TAU) / 8;
      line(v, cx, th, cz, R(cx + Math.cos(a) * 9), th + 3, R(cz + Math.sin(a) * 9), "solarBlue", 0.2, 2);
      line(v, cx, th - 1, cz, R(cx + Math.cos(a) * 9), th + 2, R(cz + Math.sin(a) * 9), k === 3 ? "brass" : k === 1 ? "white" : "steelDark");
      line(v, cx, th - 8, cz, R(cx + Math.cos(a) * 4), th - 1, R(cz + Math.sin(a) * 4), k === 3 ? "brass" : k === 1 ? "white" : k === 2 ? "brick" : "terracotta");
    }
    v.sphere(cx + 1, th + 2, cz + 1, 2.2, 2.2, 2.2, k === 3 ? "amber" : "yellow", 1.4);
    c.blink(cx, th + 4, cz, "amber");
  }
}

// =============================================================================================
// FLOODPLAIN PARK — a meandering channel that widens into wetlands and a river commons.
//   V0 Terracotta: stepped terracotta terraces descending to the water, cypress & pergola
//   V1 White & teal: white zig-zag boardwalk over teal water, mushroom canopy pavilion, birches
//   V2 Brick & evergreen: naturalistic meanders, willows, a brick weir cascade & timber bridge
//   V3 Slate & brass: slate gabion levees, brass flood-gauge clock tower, Victorian bandstand
// =============================================================================================
function floodPark(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, "grass");
  speckle(c, "grass3", 0.12);
  const w = lv5(c, [2, 3, 4, 6, 8]),
    amp = lv5(c, [2, 3, 4, 5, 6]),
    fq = 0.22 - lv * 0.02;
  const zc = (x: number) => R(Math.sin(x * fq + c.variant) * amp) - (lv === 1 ? 2 : 0);
  const water = k === 1 ? "teal" : "water";
  const bank = k === 0 ? "terracotta" : k === 3 ? "slate" : k === 1 ? "white" : "sand";
  const treeK: TreeKind = k === 1 ? "birch" : k === 2 ? "willow" : k === 0 ? "cypress" : "oak";
  if (lv === 1) {
    // rain garden: a kidney pond fed by a rain-chain pavilion, stepping stones, planted swales
    for (let x = -hx + 3; x < hx - 3; x++)
      for (let z = -hz + 3; z < hz - 6; z++) {
        const u = (x + 2) / (hx * 0.62),
          q = (z + 1 + Math.sin(x * 0.4) * 1.5) / (hz * 0.36);
        const d = u * u + q * q;
        if (d < 1) v.put(x, 0, z, water, 0.12);
        else if (d < 1.35) v.put(x, 0, z, bank);
        else if (d < 1.9 && (x + z) % 2 === 0) v.put(x, 1, z, c.pick(["olive", "leafDark", "purple", "yellow"]));
      }
    for (let i = 0; i < 4; i++) v.box(-6 + i * 3, 1, -1 + (i % 2), -4 + i * 3, 2, 1 + (i % 2), "stone");
    const px = hx - 7,
      pz = -hz + 3;
    for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) v.box(px + dx, 1, pz + dz, px + dx + 1, 6, pz + dz + 1, k === 3 ? "iron" : k === 1 ? "white" : "woodDark");
    if (k === 0) v.box(px - 1, 6, pz - 1, px + 6, 7, pz + 6, "terracotta");
    else if (k === 1) v.cylinderY(px + 2.5, pz + 2.5, 6, 7, 4, "white");
    else hip(v, px - 1, 6, pz - 1, px + 6, pz + 6, k === 2 ? "#2f6b4f" : "slate", k === 3 ? "brass" : "woodDark");
    for (let y = 1; y < 6; y++) v.put(px - 1, y, pz + 5, y % 2 ? "glass" : "sky", 0.5);
    flowerBed(c, -hx + 2, hz - 5, -hx + 8, hz - 2, 1, k === 1 ? ["white", "sky", "teal"] : ["pink", "yellow", "purple", "red"]);
    bench(v, hx - 8, 1, hz - 3);
    tree(v, -hx + 3, 1, -hz + 3, treeK, 0.9);
    tree(v, hx - 3, 1, hz - 3, treeK, 0.8, 1);
    lamp(v, 2, 1, hz - 3, 4);
    crowd(c, -2, hz - 5, 4, hz - 3, 2);
    return;
  }
  for (let x = -hx; x < hx; x++) {
    const z0 = zc(x) - w,
      z1 = zc(x) + w;
    v.box(x, 0, z0, x + 1, 1, z1, water, 0.12);
    v.put(x, 0, z0 - 1, bank);
    v.put(x, 0, z1, bank);
    if (k === 0) {
      v.box(x, 1, z0 - 4, x + 1, 2, z0 - 1, "#e2c79a");
      v.box(x, 2, z0 - 4, x + 1, 3, z0 - 3, "terracotta");
      v.box(x, 1, z1 + 1, x + 1, 2, z1 + 4, "#e2c79a");
      v.box(x, 2, z1 + 3, x + 1, 3, z1 + 4, "terracotta");
    }
    if (k === 3) {
      v.box(x, 1, z0 - 2, x + 1, 2, z0 - 1, x % 2 ? "slate" : "granite");
      v.box(x, 1, z1, x + 1, 2, z1 + 1, x % 2 ? "granite" : "slate");
    }
    // reeds
    if ((x * 7 + c.variant) % 3 === 0) {
      v.box(x, 1, z0, x + 1, 3, z0 + 1, "olive");
      v.put(x, 3, z0, "woodDark");
    }
    if ((x * 5 + 1) % 4 === 0) v.box(x, 1, z1 - 1, x + 1, 2 + (x % 2), z1, "leafDark");
  }
  if (lv >= 4) {
    // the flood lake: an oxbow pond off the channel with a wooded island
    const lx = R(hx * 0.45),
      lz = R(hz * 0.5),
      ax = hx * 0.3,
      az = hz * 0.26;
    for (let x = F(lx - ax) - 1; x <= lx + ax + 1; x++)
      for (let z = F(lz - az) - 1; z <= lz + az + 1; z++) {
        const d = ((x - lx) / ax) ** 2 + ((z - lz) / az) ** 2;
        if (d < 1) {
          v.box(x, 0, z, x + 1, 3, z + 1, null);
          v.put(x, 0, z, water, 0.12);
        }
        else if (d < 1.25) v.put(x, 0, z, bank);
      }
    v.cylinderY(lx, lz, 0, 1, 3, "sand");
    v.cylinderY(lx, lz, 1, 2, 2.2, "grass");
    tree(v, lx, 2, lz, treeK, 1, 2);
    for (let i = 0; i < 3; i++) {
      v.put(lx + 4 + i, 1, lz - 1 + i, "white");
      v.put(lx + 4 + i, 2, lz - 1 + i, i === 0 ? "pink" : "white");
    }
  }
  // scattered park trees & meadow patches, kept clear of the water
  for (let i = 0; i < lv * 3 + 2; i++) {
    const x = c.ri(-hx + 2, hx - 3),
      z = c.ri(-hz + 2, hz - 3);
    if (Math.abs(z - zc(x)) > w + 4 && Math.abs(x + R(hx * 0.2)) > 3) tree(v, x, 1, z, i % 3 ? treeK : "round", 0.75 + c.rand() * 0.4, i);
  }
  flowerBed(c, -hx + 2, hz - 5, -hx + 8, hz - 2, 1, k === 1 ? ["white", "sky", "teal"] : ["pink", "yellow", "purple", "red"]);
  // raised walk crossing the channel
  const bw = k === 1 ? "white" : k === 3 ? "woodDark" : "woodLight";
  if (k === 1) {
    // zig-zag
    let x = -hx + 2,
      z = -hz + 3;
    const n = Math.min(lv + 1, 4);
    for (let i = 0; i < n; i++) {
      const nx = R(-hx + 2 + ((i + 1) * (2 * hx - 4)) / n),
        nz = i % 2 ? -hz + 3 : hz - 4;
      line(v, x, 3, z, nx, 3, nz, "white", 0, 2);
      line(v, x, 4, z, nx, 4, nz, "teal", 0.4);
      v.box(nx, 1, nz, nx + 1, 3, nz + 1, "white");
      x = nx;
      z = nz;
    }
  } else {
    const bx = R(-hx * 0.2);
    v.box(bx, 3, -hz + 2, bx + 3, 4, hz - 2, bw);
    for (let z = -hz + 2; z < hz - 2; z += 4) {
      v.box(bx, 1, z, bx + 1, 3, z + 1, "woodDark");
      v.box(bx + 2, 1, z, bx + 3, 3, z + 1, "woodDark");
      v.put(bx, 4, z, bw);
      v.put(bx + 2, 4, z, bw);
    }
  }
  if (lv >= 3) {
    // flood meadows: wildflowers and a pavilion
    for (let i = 0; i < 18 + lv * 8; i++) {
      const x = c.ri(-hx + 1, hx - 2),
        z = c.ri(-hz + 1, hz - 2);
      if (Math.abs(z - zc(x)) > w + 2) v.put(x, 1, z, c.pick(["yellow", "white", "pink", "purple", "leafLight"]));
    }
    const px = R(hx * 0.5),
      pz = -hz + 6;
    if (k === 1) {
      v.box(px, 1, pz, px + 1, 7, pz + 1, "white");
      v.cylinderY(px + 0.5, pz + 0.5, 7, 8, 5, "white");
      ring(v, px + 0.5, pz + 0.5, 7, 8, 5, 4.4, "teal", 0.5);
    } else if (k === 3) {
      v.cylinderY(px, pz, 1, 2, 4, "granite");
      for (let a = 0; a < 8; a++) v.box(R(px + Math.cos((a * TAU) / 8) * 3), 2, R(pz + Math.sin((a * TAU) / 8) * 3), R(px + Math.cos((a * TAU) / 8) * 3) + 1, 6, R(pz + Math.sin((a * TAU) / 8) * 3) + 1, "iron");
      v.cone(px, 6, 9, pz, 4.5, 0.5, "#2f5f48");
      v.put(F(px), 9, F(pz), "brass");
    } else {
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 2], [3, 2]]) v.box(px + dx, 1, pz + dz, px + dx + 1, 6, pz + dz + 1, k === 0 ? "cream" : "woodDark");
      if (k === 0) {
        for (let x = px - 3; x <= px + 3; x += 2) v.box(x, 6, pz - 3, x + 1, 7, pz + 3, "woodDark");
        v.box(px - 4, 7, pz - 1, px + 5, 8, pz + 1, "terracotta");
      } else hip(v, px - 4, 6, pz - 4, px + 5, pz + 4, "#2f6b4f", "woodDark");
    }
    crowd(c, px - 3, pz + 4, px + 4, pz + 7, 3);
  }
  if (lv >= 4) {
    // seasonal wetlands: islands with birds, stilt hide, flood gauge
    for (let i = 0; i < lv - 2; i++) {
      const ix = R(-hx * 0.6 + (i * hx * 1.2) / Math.max(1, lv - 3)),
        iz = zc(ix);
      v.cylinderY(ix, iz, 0, 1, 2.2, "sand");
      v.cylinderY(ix, iz, 1, 2, 1.5, "grass");
      tree(v, ix, 2, iz, k === 2 ? "willow" : k === 1 ? "birch" : k === 0 ? "cypress" : "round", 0.6);
      v.put(ix + 2, 1, iz + 1, "white");
      v.put(ix + 2, 2, iz + 1, "white");
      v.put(ix + 3, 2, iz + 1, "orange");
    }
    const gx = hx - 5,
      gz = zc(hx - 5) + w - 2;
    const gh = k === 3 ? 18 : 10;
    for (let y = 1; y < gh; y++) v.box(gx, y, gz, gx + 2, y + 1, gz + 1, y < 4 ? "blue" : y < 7 ? "yellow" : "red");
    if (k === 3) {
      v.box(gx - 1, gh, gz - 1, gx + 3, gh + 4, gz + 2, "slate");
      clockFace(v, gx + 1, gh + 2, gz + 2, 1, "cream", "black");
      v.cone(gx + 1, gh + 4, gh + 7, gz + 0.5, 2.5, 0.4, "brass");
    }
    c.blink(gx, gh + (k === 3 ? 7 : 0), gz, "amber");
  }
  if (lv >= 5) {
    // river commons: arched footbridge, amphitheatre steps, kayaks, willows
    const bx = R(hx * 0.15),
      bzc = zc(bx);
    for (let dz = -w - 3; dz <= w + 3; dz++) {
      const t = dz / (w + 3),
        y = 1 + R((1 - t * t) * 4);
      v.box(bx, y, bzc + dz, bx + 4, y + 1, bzc + dz + 1, k === 1 ? "white" : k === 3 ? "iron" : k === 0 ? "terracotta" : "woodDark");
      v.put(bx, y + 1, bzc + dz, k === 3 ? "brass" : "woodLight");
      v.put(bx + 3, y + 1, bzc + dz, k === 3 ? "brass" : "woodLight");
    }
    for (let s = 0; s < 4; s++) v.box(-hx + 4 + s, 0, -hz + 2 + s * 2, -hx + 22 - s, 1 + s, -hz + 4 + s * 2, k === 3 ? "granite" : k === 0 ? "terracotta" : "concrete");
    crowd(c, -hx + 6, -hz + 2, -hx + 20, -hz + 9, 8, 2);
    for (let i = 0; i < 3; i++) {
      const kx = -hx + 8 + i * 12,
        kz = zc(kx);
      v.box(kx, 1, kz, kx + 4, 2, kz + 1, ["red", "yellow", "orange"][i]);
      person(v, kx + 2, 1, kz, "blue");
    }
    for (let i = 0; i < 5; i++) tree(v, -hx + 3 + i * 13, 1, hz - 3, k === 2 ? "willow" : k === 1 ? "birch" : k === 0 ? "cypress" : "oak", 1.1, i);
  } else {
    for (let i = 0; i < lv; i++) tree(v, -hx + 3 + i * 9, 1, -hz + 2, k === 2 ? "willow" : k === 1 ? "birch" : k === 0 ? "cypress" : "oak", 0.9, i);
  }
  for (let x = -hx + 6; x < hx - 2; x += 12) lamp(v, x, 1, hz - 2, 4, "iron", p.glow === "amber" ? "amber" : "warmGlow");
}

// =============================================================================================
// CIRCULAR MATERIALS FOUNDRY — a spinning sorting carousel grows into a reclamation compound.
//   V0 Terracotta: terracotta beehive kilns with arched furnace mouths
//   V1 White & teal: clean-tech white hangars, teal recycling arrows, electric-arc furnace
//   V2 Brick & evergreen: Victorian brick foundry with green sawtooth roofs and tall brick stacks
//   V3 Slate & brass: steampunk slate works with brass pipes, gauges and a riveted dome furnace
// =============================================================================================
function foundry(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 2 ? "#a9a08e" : k === 3 ? "#7d817d" : "concrete2");
  const wall = k === 0 ? p.wall : k === 1 ? "white" : k === 2 ? "brick" : "slate";
  const steel = k === 3 ? "brass" : k === 1 ? "teal" : "hazard";
  const embCol = k === 1 ? "teal" : k === 3 ? "brass" : "leaf";
  // ---- elevated sorting loop (front-left): a carousel of scrap over coloured chutes ----
  const sr = lv5(c, [5, 5.5, 6, 7, 8]),
    sx = R(-hx + sr + 3),
    sz = R(hz - sr - 4),
    ly = 5;
  for (let a = 0; a < 6; a++) {
    const px = R(sx + Math.cos((a * TAU) / 6) * (sr - 1)),
      pz = R(sz + Math.sin((a * TAU) / 6) * (sr - 1));
    v.box(px, 1, pz, px + 1, ly, pz + 1, "steelDark");
  }
  ring(v, sx, sz, ly, ly + 1, sr + 1, sr - 2, "steelDark");
  ring(v, sx, sz, ly + 1, ly + 2, sr + 1, sr + 0.3, steel);
  // central hopper (inverted cone) fed from above
  v.box(F(sx), 1, F(sz), F(sx) + 1, ly + 2, F(sz) + 1, "steelDark");
  v.cone(sx, ly + 2, ly + 7, sz, 1, 3, k === 1 ? "white" : k === 3 ? "copper" : "steel");
  v.cylinderY(sx, sz, ly + 6, ly + 7, 2.2, "steelDark");
  const carousel = new PixelVox();
  const scrap = ["red", "blue", "leaf", "yellow", "silver", "copper", "white"];
  for (let i = 0; i < 14; i++) {
    const a = (i * TAU) / 14,
      x = R(Math.cos(a) * (sr - 0.5)),
      z = R(Math.sin(a) * (sr - 0.5));
    carousel.box(x - 1, 0, z - 1, x + 1, 1, z + 1, scrap[i % scrap.length]);
    if (i % 3 === 0) carousel.put(x, 1, z, scrap[(i + 2) % scrap.length]);
  }
  c.addRotor({ vox: carousel, pivot: [sx, ly + 1, sz], axis: "y", speed: 0.6 });
  // chutes to colour bins below
  const bins = ["leaf", "blue", "yellow", "red"];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.15 + (i * Math.PI) / 3.5,
      bx = R(sx + Math.cos(a) * (sr + 2)),
      bz = R(sz + Math.sin(a) * (sr + 2));
    line(v, R(sx + Math.cos(a) * sr), ly, R(sz + Math.sin(a) * sr), bx, 3, bz, "steelLight");
    v.box(bx - 1, 1, bz - 1, bx + 2, 3, bz + 2, bins[i]);
  }
  // collection truck dumping into the loop
  if (lv < 5) {
    v.box(sx + R(sr) + 2, 1, hz - 4, sx + R(sr) + 8, 4, hz - 1, embCol);
    v.box(sx + R(sr) + 8, 1, hz - 4, sx + R(sr) + 10, 3, hz - 1, "white");
    v.put(sx + R(sr) + 9, 2, hz - 1, "warmGlow", 1);
  }
  crowd(c, sx - 3, sz + R(sr) + 1, sx + 4, sz + R(sr) + 3, lv + 1);
  if (lv === 1) {
    // sorting cabin with recycling emblem
    const cx = hx - 10,
      cz = -hz + 3;
    v.box(cx, 1, cz, cx + 8, 6, cz + 7, wall);
    v.box(cx + 1, 2, cz + 6, cx + 7, 4, cz + 7, "glass", 0.5);
    v.box(cx - 1, 6, cz - 1, cx + 9, 7, cz + 8, k === 0 ? "terracotta" : k === 2 ? "#2f6b4f" : k === 3 ? "brass" : "teal");
    emblem(v, cx + 4, 10, cz + 4, 2, embCol);
    v.box(cx + 4, 7, cz + 4, cx + 5, 8, cz + 5, "steelDark");
    return;
  }
  // ---- furnace tower (back-left) ----
  const fx = R(-hx * 0.45),
    fz = R(-hz * 0.45),
    fh = lv5(c, [0, 11, 15, 19, 25]),
    fr = lv5(c, [0, 3.5, 4, 4.5, 5.5]);
  if (k === 0) {
    // beehive kiln stack
    v.cylinderY(fx, fz, 1, R(fh * 0.4), fr + 1, "terracotta");
    v.dome(fx, R(fh * 0.4), fz, fr + 1, "#b95a3a");
    v.cylinderY(fx, fz, R(fh * 0.4), fh, 1.5, "brickDark");
    for (let y = 3; y < R(fh * 0.4); y += 3) ring(v, fx, fz, y, y + 1, fr + 1.3, fr + 0.4, "cream");
  } else if (k === 1) {
    v.cylinderY(fx, fz, 1, fh - 4, fr, "white");
    ring(v, fx, fz, R(fh * 0.5), R(fh * 0.5) + 1, fr + 0.3, fr - 0.6, "teal", 0.9);
    v.cylinderY(fx, fz, fh - 4, fh - 3, fr + 0.5, "steelLight");
    for (let i = 0; i < 3; i++) {
      const ex = R(fx + Math.cos((i * TAU) / 3) * 1.5),
        ez = R(fz + Math.sin((i * TAU) / 3) * 1.5);
      v.box(ex, fh - 3, ez, ex + 1, fh + 3, ez + 1, "charcoal");
      v.put(ex, fh - 3, ez, "screenCyan", 1.4);
    }
  } else if (k === 2) {
    for (let y = 1; y < fh; y++) {
      const t = y / fh;
      v.cylinderY(fx, fz, y, y + 1, fr * (1 - 0.35 * Math.abs(t - 0.3)), y % 5 === 0 ? "#efe2c4" : "brick");
    }
    v.box(F(fx) - 1, fh, F(fz) - 1, F(fx) + 2, fh + 8, F(fz) + 2, "brickDark");
  } else {
    v.cylinderY(fx, fz, 1, R(fh * 0.55), fr + 1, "slate");
    for (let y = 2; y < R(fh * 0.55); y += 3) ring(v, fx, fz, y, y + 1, fr + 1.3, fr + 0.4, "brass");
    v.dome(fx, R(fh * 0.55), fz, fr + 1, "brass");
    v.cylinderY(fx, fz, R(fh * 0.55), fh, 1.6, "iron");
    v.cylinderY(fx, fz, fh - 1, fh, 2.2, "brass");
  }
  c.smoke(F(fx), fh + (k === 2 ? 8 : 1), F(fz), k === 1 ? "steam" : "dark");
  if (lv >= 4) c.blink(F(fx), fh + (k === 2 ? 8 : 3), F(fz), "red");
  // glowing tap hole & molten channel into the casting shed
  const tz = R(fz + fr) + 1;
  v.box(F(fx) - 1, 1, tz - 1, F(fx) + 2, 4, tz, "charcoal");
  v.box(F(fx), 1, tz - 1, F(fx) + 1, 3, tz, "fire", 1.6);
  v.box(F(fx), 0, tz, F(fx) + 1, 1, tz + 6, "lava", 1.3);
  c.smoke(F(fx), 3, tz, "spark");
  // inclined belt conveyor from the sorting loop up to the furnace top
  const topY = k === 1 ? fh - 3 : k === 2 ? fh - 2 : R(fh * 0.5);
  line(v, sx, ly + 6, sz - R(sr) + 1, fx + 1, topY, R(fz + fr), "steelDark", 0, 2);
  for (let t = 0.15; t < 0.9; t += 0.18) {
    const x = R(sx + (fx + 1 - sx) * t),
      y = R(ly + 6 + (topY - ly - 6) * t),
      z = R(sz - sr + 1 + (fz + fr - sz + sr - 1) * t);
    v.put(x, y + 2, z, c.pick(scrap));
    v.box(x, 1, z, x + 1, y, z + 1, "steelDark");
  }
  // ---- casting shed (back-right) ----
  const hx0 = R(fx + fr) + 3,
    hx1 = hx - 2,
    hz0 = -hz + 2,
    hz1 = R(-hz * 0.05) + lv5(c, [0, 0, 1, 2, 4]),
    hh = lv5(c, [0, 7, 8, 10, 12]);
  v.hollowBox(hx0, 1, hz0, hx1, hh, hz1, wall, p.trim);
  windows(c, hx0, 1, hz0, hx1, hh, hz1, { col: k === 3 ? "amber" : "warmGlow", emit: 0.9, faces: "sw", w: 2, h: 2, stepH: 4 });
  if (k === 0) v.box(hx0 - 1, hh, hz0 - 1, hx1 + 1, hh + 1, hz1 + 1, "terracotta");
  else if (k === 1) {
    v.box(hx0 - 1, hh, hz0 - 1, hx1 + 1, hh + 1, hz1 + 1, "teal");
    for (let x = hx0 + 1; x < hx1 - 1; x += 3) v.box(x, hh + 1, hz0 + 1, x + 2, hh + 2, hz1 - 1, "solarBlue", 0.15);
  } else if (k === 2) {
    for (let x = hx0; x < hx1; x += 4) for (let s = 0; s < 3; s++) v.box(x + s, hh + s, hz0, Math.min(hx1, x + s + 1), hh + s + 1, hz1, "#2f6b4f");
    for (let x = hx0 + 3; x < hx1; x += 4) v.box(x, hh, hz0, x + 1, hh + 3, hz1, "glass", 0.3);
  } else {
    v.box(hx0 - 1, hh, hz0 - 1, hx1 + 1, hh + 1, hz1 + 1, "brass");
    barrelish(v, hx0, hh + 1, hz0, hx1, hz1, "iron");
  }
  // glowing doorway and a mould line of cooling ingots
  v.box(hx0 + 2, 1, hz1 - 1, hx0 + 7, 6, hz1, "fire", 1.2);
  for (let i = 0; i < lv + 1; i++) {
    const ix = hx0 + 2 + i * 3;
    if (ix + 2 > hx1) break;
    v.box(ix, 1, hz1 + 2, ix + 2, 2, hz1 + 4, i < 2 ? "lava" : k === 3 ? "brass" : "silver", i < 2 ? 1 : 0);
  }
  emblem(v, R((hx0 + hx1) / 2) + 3, R(hh / 2) + 1, hz1, 2, embCol);
  // stacks on the shed
  const stacks = lv5(c, [0, 1, 1, 2, 3]);
  for (let i = 0; i < stacks; i++) {
    const tx = hx1 - 3 - i * 5,
      tz = hz0 + 2,
      th = hh + 8 + lv * 3;
    if (k === 2) {
      v.box(tx - 1, 1, tz - 1, tx + 2, th, tz + 2, "brickDark");
      v.box(tx - 1, th - 2, tz - 1, tx + 2, th - 1, tz + 2, "#efe2c4");
    } else v.cylinderY(tx, tz, 1, th, 1.5, k === 1 ? "white" : k === 3 ? "brass" : "terracotta");
    if (k === 1) v.cylinderY(tx, tz, th - 3, th - 2, 1.6, "teal");
    if (k !== 2) v.cylinderY(tx, tz, th - 6, th - 5, 1.6, k === 3 ? "iron" : "cream");
    c.smoke(tx, th + 1, tz, k === 1 ? "steam" : "smoke");
    if (lv >= 4) c.blink(tx, th, tz, "red");
  }
  if (lv >= 3) {
    // magnet gantry crane straddling a scrap mountain (centre)
    const gx0 = R(-hx * 0.1) - 5,
      gx1 = gx0 + 12,
      gz = R(hz * 0.45),
      gh = lv5(c, [0, 0, 12, 14, 16]);
    for (const x of [gx0, gx1 - 1]) {
      v.box(x, 1, gz - 3, x + 1, gh, gz - 2, steel);
      v.box(x, 1, gz + 3, x + 1, gh, gz + 4, steel);
    }
    v.box(gx0, gh, gz - 3, gx1, gh + 1, gz + 4, steel);
    const mx = R((gx0 + gx1) / 2);
    v.box(mx - 1, gh - 1, gz - 1, mx + 2, gh, gz + 2, "steelDark");
    v.box(mx, gh - 5, gz, mx + 1, gh - 1, gz + 1, "iron");
    v.cylinderY(mx + 0.5, gz + 0.5, gh - 6, gh - 5, 1.6, "charcoal");
    v.put(mx, gh - 7, gz, "silver");
    for (let i = 0; i < 30 + lv * 6; i++) {
      const a = c.rand() * TAU,
        d = c.rand() * 5,
        x = R(mx + Math.cos(a) * d),
        z = R(gz + Math.sin(a) * d);
      v.box(x, 1, z, x + 1, 1 + Math.max(1, R((5 - d) * 0.9)), z + 1, c.pick(["steel", "copper", "steelDark", "silver", "red", "blue"]));
    }
  }
  if (lv >= 4) {
    // circular yard: a domed rotunda store at the front-right
    const rx = R(hx * 0.55),
      rz = R(hz * 0.55),
      rr = lv === 4 ? 6 : 7.5;
    ring(v, rx, rz, 1, 8, rr, rr - 1, wall);
    for (let a = 0; a < 8; a++) v.box(R(rx + Math.cos((a * TAU) / 8) * rr) - 1, 1, R(rz + Math.sin((a * TAU) / 8) * rr) - 1, R(rx + Math.cos((a * TAU) / 8) * rr), 8, R(rz + Math.sin((a * TAU) / 8) * rr), p.trim);
    v.box(R(rx) - 2, 1, R(rz + rr) - 1, R(rx) + 2, 5, R(rz + rr), "woodDark");
    v.dome(rx, 8, rz, rr, k === 1 ? "glass" : k === 3 ? "brass" : k === 2 ? "#2f6b4f" : "terracotta", k === 1 ? 0.3 : 0);
    emblem(v, R(rx), 8 + R(rr) + 3, R(rz), 2, embCol);
  }
  if (lv >= 5) {
    // rail spur with gondolas of export goods along the front
    v.box(-hx, 0, hz - 2, hx, 1, hz - 1, "#6e5a46");
    for (let x = -hx; x < hx; x += 2) v.put(x, 0, hz - 2, "steelDark");
    for (let i = 0; i < 3; i++) {
      const wx = -2 + i * 9;
      v.box(wx, 1, hz - 3, wx + 7, 3, hz, i === 0 ? "red" : "steelDark");
      v.box(wx + 1, 3, hz - 2, wx + 6, 4, hz - 1, c.pick(["copper", "silver", "steel"]));
    }
    // ladle crane pouring a molten stream
    const lx = hx0 + 2,
      lz = hz1 + 6;
    v.box(lx - 1, 1, lz, lx, 16, lz + 1, steel);
    v.box(lx - 1, 16, lz, lx + 8, 17, lz + 1, steel);
    v.cylinderY(lx + 6, lz + 0.5, 11, 14, 1.8, "charcoal");
    v.box(lx + 5, 2, lz, lx + 6, 11, lz + 1, "lava", 1.6);
    v.box(lx + 4, 1, lz - 1, lx + 8, 2, lz + 2, "fire", 1.2);
    c.smoke(lx + 5, 3, lz, "spark");
  }
}

function emblem(v: PixelVox, x: number, y: number, z: number, r: number, col: string) {
  for (let a = 0; a < 3; a++) {
    const a0 = (a * TAU) / 3 + 0.4;
    line(v, R(x + Math.cos(a0) * r), R(y + Math.sin(a0) * r), z, R(x + Math.cos(a0 + 1.6) * r), R(y + Math.sin(a0 + 1.6) * r), z, col, 0.9);
    v.put(R(x + Math.cos(a0 + 1.6) * r), R(y + Math.sin(a0 + 1.6) * r) + 1, z, col, 0.9);
  }
}

function barrelish(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string) {
  const d = z1 - z0,
    r = d / 2;
  for (let i = 0; i < d; i++) {
    const t = i + 0.5 - r,
      h = Math.max(1, R(Math.sqrt(Math.max(0, r * r - t * t)) * 0.6));
    v.box(x0, y, z0 + i, x1, y + h, z0 + i + 1, col);
  }
  for (let x = x0; x < x1; x += 4) v.box(x, y, z0, x + 1, y + R(r * 0.6) + 1, z1, "brass");
}

// =============================================================================================
// RAINWATER CATHEDRAL — a cathedral of funnels: inverted-umbrella collectors feed glowing cisterns.
//   V0 Terracotta: Romanesque round arches, terracotta roofs, round towers with conical caps
//   V1 White & teal: Calatrava-style ribbed white parabolic shells with teal water
//   V2 Brick & evergreen: brick gothic with steep green copper roofs, buttresses and spires
//   V3 Slate & brass: slate gothic waterworks with brass funnels, pipes and gauges
// =============================================================================================
function funnel(c: Ctx, x: number, z: number, y0: number, h: number, r: number) {
  const v = c.v,
    k = c.variant;
  const col = ["terracotta", "white", "#2f6b4f", "brass"][k];
  v.box(F(x), y0, F(z), F(x) + 1, y0 + h - 2, F(z) + 1, k === 3 ? "iron" : k === 1 ? "white" : "steelDark");
  v.cone(x + 0.5, y0 + h - 3, y0 + h + 1, z + 0.5, 0.8, r, col);
  v.cylinderY(x + 0.5, z + 0.5, y0 + h, y0 + h + 1, r - 1, "water", 0.35);
  // rain chain
  for (let y = y0; y < y0 + h - 3; y += 2) v.put(F(x) + 1, y, F(z), "glass", 0.5);
}

function rainCathedral(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 2 ? "grass" : p.pave);
  const wall = ["#efc29b", "white", "brick", "slate"][k],
    roof = ["terracotta", "white", "#2f6b4f", "iron"][k],
    trim = ["cream", "teal", "#efe2c4", "brass"][k];
  // reflecting pool in front
  const poolW = lv5(c, [6, 8, 10, 14, 18]);
  v.box(-poolW, 0, hz - 5, poolW, 1, hz - 1, trim);
  v.box(-poolW + 1, 0, hz - 4, poolW - 1, 1, hz - 2, "water", 0.25);
  if (lv === 1) {
    // filter court
    funnel(c, -1, -2, 1, 10, 5);
    v.cylinderY(-0.5, -1.5, 1, 4, 3, "glass", 0.2);
    v.cylinderY(-0.5, -1.5, 1, 3, 2.4, "water", 0.5);
    ring(v, -0.5, -1.5, 1, 4, 3.2, 2.6, trim);
    for (const s of [-1, 1]) {
      v.box(s * 10 - 2, 1, -hz + 1, s * 10 + 2, 5, -hz + 5, wall);
      v.box(s * 10 - 3, 5, -hz, s * 10 + 3, 6, -hz + 6, roof);
      bench(v, s * 8 - 1, 1, hz - 7);
    }
    return;
  }
  // nave: along z, facade at front
  const nw = lv5(c, [0, 10, 12, 14, 16]),
    nh = lv5(c, [0, 7, 11, 14, 17]);
  const nz0 = -hz + 2,
    nz1 = hz - 7;
  const nx0 = -F(nw / 2),
    nx1 = nx0 + nw;
  v.hollowBox(nx0, 1, nz0, nx1, nh, nz1, wall, trim);
  // tall arched windows (glowing water-blue)
  for (let z = nz0 + 3; z < nz1 - 2; z += 4) {
    for (const x of [nx0, nx1 - 1]) {
      v.box(x, 3, z, x + 1, nh - 2, z + 1, k === 3 ? "amber" : "glass", 0.6);
      v.put(x, nh - 2, z, k === 3 ? "amber" : "sky", 0.6);
    }
  }
  // roof
  if (k === 0) {
    gable(v, nx0 - 1, nh, nz0 - 1, nx1 + 1, nz1 + 1, "z", "terracotta", "cream");
  } else if (k === 1) {
    for (let z = nz0; z < nz1; z++) {
      const rib = (z - nz0) % 4 === 0;
      for (let x = nx0; x < nx1; x++) {
        const t = (x + 0.5 - (nx0 + nx1) / 2) / (nw / 2);
        const yy = nh + R((1 - t * t) * nw * 0.45);
        v.put(x, yy, z, rib ? "teal" : "white");
      }
    }
  } else if (k === 2) {
    gable(v, nx0 - 1, nh, nz0 - 1, nx1 + 1, nz1 + 1, "z", "#2f6b4f", "#efe2c4");
    // flying buttresses
    for (let z = nz0 + 2; z < nz1; z += 4)
      for (const s of [-1, 1]) {
        const bx = s < 0 ? nx0 - 3 - (lv >= 3 ? 4 : 0) : nx1 + 2 + (lv >= 3 ? 4 : 0);
        v.box(bx, 1, z, bx + 1, nh - 3, z + 1, "brickDark");
        line(v, bx, nh - 3, z, s < 0 ? nx0 : nx1 - 1, nh, z, "brickDark");
        v.put(bx, nh - 3, z, "#2f6b4f");
      }
  } else {
    gable(v, nx0 - 1, nh, nz0 - 1, nx1 + 1, nz1 + 1, "z", "iron", "brass");
    // brass downpipes
    for (let z = nz0 + 1; z < nz1; z += 5) for (const x of [nx0 - 1, nx1]) v.box(x, 1, z, x + 1, nh, z + 1, "brass");
  }
  // side aisles with lean-to roofs from L3
  if (lv >= 3) {
    const ah = R(nh * 0.55);
    for (const sd of [-1, 1]) {
      const ax0 = sd < 0 ? nx0 - 4 : nx1,
        ax1 = sd < 0 ? nx0 : nx1 + 4;
      v.hollowBox(ax0, 1, nz0 + 2, ax1, ah, nz1 - 1, wall, trim);
      for (let z = nz0 + 4; z < nz1 - 2; z += 4) v.box(sd < 0 ? ax0 : ax1 - 1, 2, z, sd < 0 ? ax0 + 1 : ax1, ah - 1, z + 1, k === 3 ? "amber" : "sky", 0.6);
      for (let i = 0; i < 4; i++) {
        const xc = sd < 0 ? ax0 + i : ax1 - 1 - i;
        v.box(xc, ah, nz0 + 1, xc + 1, ah + 1 + F(i / 2), nz1, roof);
      }
    }
  }
  // facade + rose window (water-blue)
  const fy = nh + (k === 1 ? R(nw * 0.45) : R(nw / 2)) - 1;
  v.box(nx0, 1, nz1 - 1, nx1, nh, nz1, wall);
  discZ(v, 0, nh - 3, nz1, Math.min(4, nw / 3), (d, a) => (d < 1.2 ? "white" : ((F(a * 1.9) % 2) + 2) % 2 ? "sky" : "blue"), 1.1);
  if (k === 0) {
    v.box(-2, 1, nz1, 2, 5, nz1 + 1, "woodDark");
    v.box(-3, 5, nz1, 3, 6, nz1 + 1, "cream");
  } else if (k === 2 || k === 3) {
    for (let y = 1; y < 6; y++) v.box(-2 + F(y / 5), y, nz1, 2 - F(y / 5), y + 1, nz1 + 1, "woodDark");
  } else v.box(-2, 1, nz1, 2, 6, nz1 + 1, "glass", 0.5);
  void fy;
  // funnels on the roof ridge
  const nf = lv5(c, [0, 2, 3, 4, 5]);
  for (let i = 0; i < nf; i++) {
    const z = R(nz0 + 2 + ((i + 0.5) * (nz1 - nz0 - 4)) / nf);
    funnel(c, -1, z, nh + 2, 8 + (i % 2) * 3 + lv, lv5(c, [0, 4, 4.5, 5, 5.5]));
  }
  // gargoyle spouts pouring into side channels
  for (const s of [-1, 1]) {
    const x = s < 0 ? nx0 - 2 : nx1 + 1;
    v.box(x, nh - 1, nz1 - 3, x + 1, nh, nz1 - 2, k === 3 ? "brass" : "stone");
    for (let y = 1; y < nh - 1; y++) v.put(x, y, nz1 - 3, "water", 0.45);
    c.smoke(x, 1, nz1 - 3, "steam");
  }
  if (lv >= 4) {
    // glass cistern towers flanking the facade, filled with glowing water
    const ch = lv === 4 ? 14 : 20,
      cr = lv === 4 ? 3 : 3.5;
    for (const s of [-1, 1]) {
      const cx = s * (F(nw / 2) + (lv >= 5 ? 9 : 5));
      if (k === 0) {
        v.cylinderY(cx, nz1 - 4, 1, ch, cr, "#efc29b");
        v.cone(cx, ch, ch + 6, nz1 - 4, cr + 0.6, 0.5, "terracotta");
        v.box(F(cx), 4, nz1 - 1, F(cx) + 1, ch - 2, nz1, "water", 0.8);
      } else if (k === 2) {
        v.box(cx - 3, 1, nz1 - 7, cx + 3, ch, nz1 - 1, "brick");
        v.box(cx - 1, 4, nz1 - 1, cx + 1, ch - 3, nz1, "sky", 0.7);
        spire(v, cx, nz1 - 4, ch, 8, 3.4, "#2f6b4f", "gold");
      } else {
        v.cylinderY(cx, nz1 - 4, 1, ch, cr, "glass", 0.2);
        v.cylinderY(cx, nz1 - 4, 1, ch - 3, cr - 0.8, "water", 0.55);
        ring(v, cx, nz1 - 4, ch - 1, ch, cr + 0.5, cr - 0.5, trim);
        for (let y = 4; y < ch; y += 5) ring(v, cx, nz1 - 4, y, y + 1, cr + 0.3, cr - 0.2, trim);
        if (k === 3) v.cone(cx, ch, ch + 5, nz1 - 4, cr + 0.6, 0.5, "brass");
        else v.dome(cx, ch, nz1 - 4, cr, "white");
      }
      line(v, cx, ch - 4, nz1 - 4, s < 0 ? nx0 : nx1 - 1, nh - 2, nz1 - 4, k === 3 ? "brass" : "steelLight");
    }
  }
  if (lv >= 5) {
    // twin facade bell towers crowned with funnel spires
    const th = nh + 20;
    for (const sd of [-1, 1]) {
      const tx0 = sd < 0 ? nx0 - 4 : nx1 - 2,
        tz0 = nz1 - 6;
      if (k === 1) {
        v.cylinderY(tx0 + 3, tz0 + 3, 1, th, 3.2, "white");
        for (let y = 4; y < th; y += 4) ring(v, tx0 + 3, tz0 + 3, y, y + 1, 3.3, 2.5, "teal", 0.5);
      } else {
        v.hollowBox(tx0, 1, tz0, tx0 + 6, th, tz0 + 6, wall, trim);
        for (let y = 6; y < th - 2; y += 5) v.box(tx0 + 2, y, tz0 + 5, tx0 + 4, y + 3, tz0 + 6, k === 3 ? "amber" : "sky", 0.7);
      }
      if (k === 0) v.cone(tx0 + 3, th, th + 7, tz0 + 3, 4, 0.5, "terracotta");
      else if (k === 2) spire(v, tx0 + 3, tz0 + 3, th, 12, 3.8, "#2f6b4f", "gold");
      else if (k === 3) spire(v, tx0 + 3, tz0 + 3, th, 10, 3.6, "iron", "brass");
      funnel(c, tx0 + 2, tz0 + 2, k === 2 ? th + 12 : k === 3 ? th + 10 : th + (k === 0 ? 6 : 0), 5, 3.5);
      c.blink(tx0 + 2, th + (k === 2 ? 18 : k === 3 ? 16 : 12), tz0 + 2, "white");
    }
    // crossing lantern crowned by the great funnel + transepts
    const tz = R((nz0 + nz1) / 2) - 2;
    v.hollowBox(-hx + 3, 1, tz - 4, hx - 3, nh - 3, tz + 4, wall, trim);
    if (k === 1) for (let x = -hx + 3; x < hx - 3; x++) v.box(x, nh - 3, tz - 4, x + 1, nh - 2, tz + 4, (x & 3) === 0 ? "teal" : "white");
    else gable(v, -hx + 2, nh - 3, tz - 5, hx - 2, tz + 5, "x", roof, trim);
    for (const s of [-1, 1]) discZ(v, s * (hx - 6), nh - 7, tz + 4, 2.5, (d) => (d < 1 ? "white" : "sky"), 1);
    v.cylinderY(-0.5, tz + 0.5, nh, nh + 12, 3, wall);
    windows(c, -4, nh, tz - 3, 3, nh + 12, tz + 4, { col: "sky", emit: 0.7, stepV: 3 });
    funnel(c, -1, tz, nh + 12, 8, 7);
    c.blink(-1, nh + 22, tz, "white");
    // cascade steps from facade into the pool
    for (let s = 0; s < 3; s++) v.box(-4 + s, s === 0 ? 0 : 0, nz1 + 1 + s, 4 - s, 3 - s, nz1 + 2 + s, s % 2 ? "water" : trim, s % 2 ? 0.4 : 0);
    fountainRow(c, hz - 3, poolW);
  }
  crowd(c, -poolW, hz - 7, poolW, hz - 5, lv + 2);
  for (const s of [-1, 1]) tree(v, s * (hx - 3), 1, hz - 3, k === 0 ? "cypress" : k === 1 ? "birch" : k === 2 ? "oak" : "pine", 0.9);
}

function fountainRow(c: Ctx, z: number, w: number) {
  for (let x = -w + 3; x < w - 2; x += 5) {
    c.v.box(x, 1, z, x + 1, 3, z + 1, "foam", 0.5);
    c.v.put(x, 3, z, "white", 0.5);
  }
}

// =============================================================================================
// SKYBRIDGE UNIVERSITY — lecture towers that rise and knit together with skybridges, suspended
// lecture halls and a funicular.
//   V0 Terracotta: Mediterranean towers with terracotta hip roofs and arched bridges
//   V1 White & teal: round white towers joined by glass tube bridges
//   V2 Brick & evergreen: collegiate-gothic brick towers with green copper spires & covered bridges
//   V3 Slate & brass: slate octagonal towers, brass truss bridges, an observatory dome
// =============================================================================================
function university(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  lot(c, k === 2 ? "grass" : p.ground);
  speckle(c, "grass3", k === 2 ? 0.08 : 0);
  // quad lawn
  v.box(-hx + 3, 0, hz - 6, hx - 3, 1, hz - 1, "grass");
  v.box(-1, 0, -hz + 1, 1, 1, hz, p.pave);
  const n = lv5(c, [2, 2, 3, 3, 4]);
  const tw = lv5(c, [7, 7, 7, 8, 8]);
  const base = lv5(c, [14, 20, 26, 32, 40]);
  type T = { x: number; z: number; h: number };
  const towers: T[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = R(-hx + 2 + t * (2 * hx - 4 - tw)),
      z = (lv >= 3 ? (i % 2 ? -hz + 2 : -hz + 2 + R(hz * 0.35)) : -F(tw / 2) - (lv >= 2 ? 2 : 0));
    towers.push({ x, z, h: base - (i % 2) * 4 + (i === n - 1 && lv >= 5 ? 6 : 0) });
  }
  const tc = (t: T) => [t.x + tw / 2, t.z + tw / 2] as const;
  for (const t of towers) {
    const [cx, cz] = tc(t);
    if (k === 1) {
      v.cylinderY(cx, cz, 1, t.h, tw / 2, "white");
      for (let y = 3; y < t.h - 1; y += 3) ring(v, cx, cz, y, y + 1, tw / 2, tw / 2 - 1, "glass", 0.35);
      v.cylinderY(cx, cz, t.h, t.h + 1, tw / 2 + 0.6, "teal");
    } else if (k === 3) {
      for (let y = 1; y < t.h; y++) disc(v, cx, cz, y, y + 1, tw / 2, (dx, dz) => (Math.abs(dx) + Math.abs(dz) > tw * 0.66 ? null : (y % 4 === 2 && Math.abs(dx) < tw / 2 - 1.5) ? "amber" : "slate"), 0);
      for (let y = 4; y < t.h; y += 8) disc(v, cx, cz, y, y + 1, tw / 2 + 0.5, (dx, dz) => (Math.abs(dx) + Math.abs(dz) > tw * 0.7 ? null : "brass"));
    } else {
      v.hollowBox(t.x, 1, t.z, t.x + tw, t.h, t.z + tw, k === 0 ? p.wall : "brick", p.trim);
      windows(c, t.x, 1, t.z, t.x + tw, t.h, t.z + tw, { col: k === 0 ? "glass" : "warmGlow", emit: 0.6, stepV: 4, h: 2, stepH: 2 });
    }
    // crowns
    if (k === 0) hip(v, t.x - 1, t.h, t.z - 1, t.x + tw + 1, t.z + tw + 1, "terracotta", "cream");
    if (k === 2) spire(v, cx, cz, t.h, 9, tw / 2, "#2f6b4f", "gold");
    if (k === 3) v.cone(cx, t.h, t.h + 4, cz, tw / 2, 1, "iron");
    door(v, t.x + F(tw / 2) - 1, 1, t.z + tw - 1, k === 1 ? "glassDark" : "woodDark");
  }
  // skybridges between neighbours
  const bridgeLevels = lv5(c, [0, 1, 1, 2, 3]);
  for (let i = 0; i + 1 < towers.length; i++) {
    const a = towers[i],
      b = towers[i + 1];
    for (let j = 0; j < bridgeLevels; j++) {
      const y = R(Math.min(a.h, b.h) * (0.45 + 0.22 * j)) + (i % 2) * 2;
      const x0 = a.x + tw,
        x1 = b.x;
      const [, az] = tc(a),
        [, bz] = tc(b);
      for (let x = x0; x < x1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0 - 1),
          z = R(az + (bz - az) * t) - 2;
        if (k === 1) {
          v.box(x, y, z, x + 1, y + 4, z + 4, "glass", 0.35);
          v.box(x, y, z, x + 1, y + 1, z + 4, "white");
          v.put(x, y + 4, z + 1, "white");
          v.put(x, y + 4, z + 2, "white");
        } else if (k === 3) {
          v.box(x, y, z, x + 1, y + 1, z + 4, "iron");
          v.box(x, y + 3, z, x + 1, y + 4, z + 4, "brass");
          if (x % 3 === 0) {
            v.box(x, y, z, x + 1, y + 4, z + 1, "brass");
            v.box(x, y, z + 3, x + 1, y + 4, z + 4, "brass");
          }
          v.box(x, y + 1, z + 1, x + 1, y + 3, z + 3, "glass", 0.3);
        } else {
          const arch = k === 0 ? R(Math.sin(Math.PI * t) * 2) : 0;
          v.box(x, y - arch, z, x + 1, y + 1, z + 4, k === 0 ? "cream" : "brickDark");
          v.box(x, y + 1, z, x + 1, y + 3, z + 4, k === 0 ? p.wall : "woodLight");
          v.box(x, y + 2, z, x + 1, y + 3, z + 4, "glass", 0.4);
          if (k === 2) gable(v, x, y + 3, z - 1, x + 1, z + 5, "x", "#2f6b4f");
          else v.box(x, y + 3, z, x + 1, y + 4, z + 4, "terracotta");
        }
      }
      // suspended lecture hall hangs under the first bridge
      if (lv >= 3 && j === 0 && x1 - x0 >= 6) {
        const mx = R((x0 + x1) / 2),
          mz = R((az + bz) / 2);
        const hy = y - 8;
        v.box(mx - 3, hy, mz - 3, mx + 3, hy + 5, mz + 3, k === 1 ? "white" : k === 3 ? "slateLight" : p.wall2);
        v.box(mx - 3, hy + 1, mz + 2, mx + 3, hy + 4, mz + 3, "glass", 0.55);
        for (const dx of [-3, 2]) v.box(mx + dx, hy + 5, mz, mx + dx + 1, y, mz + 1, "steelDark");
      }
    }
  }
  if (lv >= 4) {
    // funicular from the quad up to a tower
    const t = towers[towers.length - 1];
    const fx = t.x - 2,
      top = R(t.h * 0.55);
    line(v, fx - top + 1 > -hx ? fx - R(top * 0.9) : -hx + 1, 1, hz - 4, fx, top, t.z + tw - 1, "steelDark", 0, 1);
    line(v, fx - R(top * 0.9) + 1, 1, hz - 3, fx + 1, top, t.z + tw, "steelDark", 0, 1);
    const mx = R(fx - top * 0.45);
    v.box(mx - 1, R(top * 0.5) + 1, R((hz - 4 + t.z + tw) / 2) - 1, mx + 2, R(top * 0.5) + 4, R((hz - 4 + t.z + tw) / 2) + 2, k === 2 ? "red" : k === 3 ? "brass" : "orange");
    v.put(mx, R(top * 0.5) + 3, R((hz - 4 + t.z + tw) / 2) + 2, "warmGlow", 0.8);
  }
  if (lv >= 5) {
    // observatory / clock crown on the tallest tower, graduates on the lawn
    const t = towers[towers.length - 1],
      [cx, cz] = tc(t);
    const top = t.h + (k === 2 ? 11 : k === 0 ? 4 : 4);
    if (k === 3 || k === 1) {
      v.dome(cx, t.h + 1, cz, tw / 2 - 0.5, k === 3 ? "brass" : "white");
      v.box(F(cx), t.h + 3, F(cz) + 1, F(cx) + 1, t.h + 6, F(cz) + 3, "charcoal");
    }
    clockFace(v, F(cx), R(t.h - 4), t.z + tw, 2, "cream", "black");
    c.blink(F(cx), top + 1, F(cz), "red");
    for (let i = 0; i < 10; i++) {
      const gx = -hx + 4 + ((i * 7) % (2 * hx - 8)),
        gz = hz - 5 + (i % 3);
      person(v, gx, 1, gz, "black");
      v.put(gx, 4, gz, "black");
    }
    flag(v, hx - 3, 1, hz - 3, 10, [p.accent, "white", p.wall2]);
  } else crowd(c, -hx + 3, hz - 6, hx - 3, hz - 1, lv + 2);
  for (const s of [-1, 1]) tree(v, s * (hx - 3), 1, hz - 2, k === 0 ? "cypress" : k === 2 ? "oak" : "round", 0.8);
}

// =============================================================================================
// OCEAN HABITAT RING — a buoyant ring village that closes around a lagoon. Corners stay open for
// boat berths (the navigation code uses the parcel corners).
//   V0 Terracotta: Mediterranean floating village — white cubes with terracotta roofs, stacked
//   V1 White & teal: futurist white disc pods with glass domes and teal light strips
//   V2 Brick & evergreen: lush floating gardens, brick-red cabins with green roofs, greenhouses
//   V3 Slate & brass: steampunk riveted slate drums with brass portholes and periscopes
// =============================================================================================
function oceanRing(c: Ctx) {
  const { v, lv, hx, hz } = c,
    p = pal(c),
    k = c.variant;
  c.bob();
  const rx = hx - 5,
    rz = hz - 5;
  const span = lv5(c, [0.9, 1.5, 1.85, 2.0, 2.0]) * Math.PI; // arc extent
  const a0 = Math.PI / 2 - span / 2 + Math.PI; // centred on the back (-z)
  const deck = k === 1 ? "white" : k === 3 ? "iron" : k === 2 ? "#8a6f4f" : "woodLight";
  const width = lv5(c, [3, 3.5, 4, 5, 5.5]);
  // ring deck with float pontoons
  const steps = R(span * Math.max(rx, rz) * 2.2);
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (i / steps) * span,
      ca = Math.cos(a),
      sa = Math.sin(a);
    for (let w = -width; w <= width; w += 0.5) {
      const x = F(ca * (rx + w)),
        z = F(sa * (rz + w));
      v.put(x, 0, z, "steelDark");
      v.put(x, 1, z, Math.abs(w) > width - 0.6 ? (k === 1 ? "teal" : k === 3 ? "brass" : "white") : deck);
    }
  }
  // habitats along the ring
  const nh = lv5(c, [2, 4, 6, 8, 10]);
  for (let i = 0; i < nh; i++) {
    const a = a0 + ((i + 0.5) / nh) * span,
      x = R(Math.cos(a) * rx),
      z = R(Math.sin(a) * rz);
    const stack = lv >= 4 ? 1 + ((i + k) % 3) : lv >= 3 ? 1 + (i % 2) : 1;
    habitat(c, x, z, stack, i);
  }
  // lagoon features
  if (lv >= 2) {
    // aquaculture net pens
    const pens = lv5(c, [0, 1, 2, 3, 4]);
    for (let i = 0; i < pens; i++) {
      const a = a0 + span * ((i + 0.5) / pens),
        x = R(Math.cos(a) * rx * 0.45),
        z = R(Math.sin(a) * rz * 0.45);
      ring(v, x, z, 0, 1, 2.6, 1.8, k === 3 ? "brass" : "orange");
      v.cylinderY(x, z, 0, 1, 1.8, "waterDeep", 0.1);
      v.put(x, 1, z, "silver");
    }
  }
  if (lv >= 3) {
    // floating garden island / hub
    const hr = lv5(c, [0, 0, 3, 4, 6]);
    v.cylinderY(0, 0, 0, 1, hr + 0.8, "steelDark");
    v.cylinderY(0, 0, 1, 2, hr, k === 3 ? "slate" : "grass");
    if (lv === 3) tree(v, 0, 2, 0, k === 0 ? "palm" : k === 1 ? "birch" : k === 2 ? "fruit" : "round", 0.9);
  }
  if (lv >= 4) {
    // spoke bridges to the hub
    const sp = lv === 4 ? 2 : 4;
    for (let i = 0; i < sp; i++) {
      const a = Math.PI / 2 + Math.PI + ((i - (sp - 1) / 2) * Math.PI) / (sp === 2 ? 2.5 : 2);
      line(v, 0, 1, 0, R(Math.cos(a) * (rx - width)), 1, R(Math.sin(a) * (rz - width)), deck, 0, 2);
    }
    // wave/wind energy turbine on the ring
    const wx = R(Math.cos(a0 + 0.2) * rx),
      wz = R(Math.sin(a0 + 0.2) * rz);
    v.box(wx, 2, wz, wx + 1, 16, wz + 1, "white");
    const rot = new PixelVox();
    for (let b = 0; b < 3; b++) for (let d = 1; d <= 6; d++) rot.put(R(Math.cos((b * TAU) / 3) * d), R(Math.sin((b * TAU) / 3) * d), 0, d === 6 ? "red" : "white");
    c.addRotor({ vox: rot, pivot: [wx + 0.5, 16, wz + 1.5], axis: "z", speed: 1.2, wind: true });
  }
  if (lv >= 5) {
    // the central habitat spire rising from the lagoon hub
    const cr = 5;
    let top = 30;
    if (k === 1) {
      // glass needle with stacked disc decks
      v.cylinderY(0, 0, 2, 30, 2.2, "white");
      for (let y = 6; y < 30; y += 6) {
        v.cylinderY(0, 0, y, y + 1, cr - 1 - y / 15, "white");
        ring(v, 0, 0, y + 1, y + 3, cr - 1.5 - y / 15, cr - 2.3 - y / 15, "glass", 0.45);
        v.cylinderY(0, 0, y + 3, y + 4, cr - 1.2 - y / 15, "teal");
      }
      v.dome(0, 30, 0, 3, "glass", 0.35);
      top = 34;
    } else if (k === 3) {
      // riveted brass lighthouse-observatory
      for (let y = 2; y < 24; y++) v.cylinderY(0, 0, y, y + 1, cr - y * 0.09, y % 4 === 0 ? "brass" : "slate");
      for (let y = 6; y < 24; y += 4) v.put(0, y + 2, R(cr - y * 0.09) - 1, "amber", 1.1);
      v.cylinderY(0, 0, 24, 27, 2.8, "glass", 0.6);
      v.put(0, 25, 0, "amber", 1.6);
      v.dome(0, 27, 0, 3, "brass");
      top = 31;
    } else if (k === 2) {
      // twin biodomes with a planted lantern tower
      v.dome(0, 2, 0, cr + 1, "glass", 0.25);
      tree(v, -1, 2, 0, "fruit", 1.2);
      v.box(-1, 2, -1, 1, 22, 1, "brick");
      for (let y = 6; y < 22; y += 4) v.box(-2, y, -2, 2, y + 1, 2, "#2f6b4f");
      v.cone(0, 22, 28, 0, 2.5, 0.4, "#2f6b4f");
      top = 29;
    } else {
      // whitewashed campanile village tower
      v.box(-4, 2, -4, 4, 10, 4, "white");
      windows(c, -4, 2, -4, 4, 10, 4, { col: "glass", emit: 0.5 });
      hip(v, -5, 10, -5, 5, 5, "terracotta", undefined, 2);
      v.box(-2, 11, -2, 2, 25, 2, "white");
      for (let y = 14; y < 25; y += 5) {
        v.box(-2, y, 1, 2, y + 2, 2, "#4c82d4");
        v.box(-2, y, -2, 2, y + 2, -1, "#4c82d4");
      }
      v.box(-3, 25, -3, 3, 26, 3, "terracotta");
      v.cylinderY(0, 0, 26, 28, 1.6, "white");
      v.dome(0, 28, 0, 1.8, "#4c82d4");
      top = 31;
    }
    c.blink(0, top, 0, "red");
  }
  // berth buoys + boats at the ring tips
  for (const s of [-1, 1]) {
    const a = s < 0 ? a0 : a0 + span,
      x = R(Math.cos(a) * rx),
      z = R(Math.sin(a) * rz);
    v.box(x - 1, 0, z - 1, x + 1, 3, z + 1, "red");
    c.blink(x, 3, z, s < 0 ? "red" : "lime");
  }
  if (lv === 1) {
    // pier finger reaching out into open water with a moored launch
    v.box(-1, 0, -rz + 2, 2, 1, 4, "steelDark");
    v.box(-1, 1, -rz + 2, 2, 2, 4, deck);
    for (let z = -rz + 3; z < 4; z += 3) {
      v.put(-1, 2, z, "woodDark");
      v.put(1, 2, z, "woodDark");
    }
    v.box(3, 0, -1, 9, 1, 2, k === 3 ? "copper" : "white");
    v.box(5, 1, -1, 7, 3, 2, p.accent);
    lamp(v, 1, 2, 3, 3, "iron", "warmGlow");
  }
  if (lv >= 2) {
    // little boat moored in the lagoon
    const bx = R(rx * 0.1),
      bz = R(rz * 0.55);
    v.box(bx - 3, 0, bz - 1, bx + 3, 1, bz + 1, k === 3 ? "copper" : "white");
    v.box(bx - 1, 1, bz - 1, bx + 1, 2, bz + 1, p.accent);
  }
}

function habitat(c: Ctx, x: number, z: number, stack: number, i: number) {
  const v = c.v,
    k = c.variant;
  for (let s = 0; s < stack; s++) {
    const y = 2 + s * 4;
    if (k === 0) {
      const w = 3 - (s > 0 ? 1 : 0);
      v.box(x - w, y, z - w, x + w, y + 4, z + w, "white");
      v.put(x, y + 1, z + w - 1, "glass", 0.5);
      v.box(x - 1, y, z + w - 1, x, y + 2, z + w, "#4c82d4");
      if (s === stack - 1) hip(v, x - w - 1, y + 4, z - w - 1, x + w + 1, z + w + 1, "terracotta", undefined, 2);
      else v.box(x - w, y + 3, z - w, x + w, y + 4, z + w, "cream");
    } else if (k === 1) {
      v.cylinderY(x, z, y, y + 2, 3, "white");
      ring(v, x, z, y + 1, y + 2, 3.1, 2.4, "teal", 0.6);
      v.dome(x, y + 2, z, 2.6, "glass", 0.3);
      if (s === stack - 1) v.put(x, y + 4, z, "screenCyan", 1);
    } else if (k === 2) {
      v.box(x - 2, y, z - 2, x + 3, y + 3, z + 3, s % 2 ? "brickDark" : "brick");
      v.put(x, y + 1, z + 2, "warmGlow", 0.7);
      gable(v, x - 3, y + 3, z - 2, x + 4, z + 3, "z", "#2f6b4f");
      if (s === 0) {
        tree(v, x + 3, 2, z - 3, (i % 2 ? "fruit" : "round") as TreeKind, 0.6, i);
        bush(v, x - 3, 2, z + 2, 1, "leaf", "pink");
      }
    } else {
      v.cylinderY(x, z, y, y + 4, 2.8, "slate");
      ring(v, x, z, y, y + 1, 3, 2, "brass");
      ring(v, x, z, y + 3, y + 4, 3, 2, "brass");
      v.put(x, y + 2, z + 2, "amber", 1);
      v.put(x + 2, y + 2, z, "amber", 1);
      if (s === stack - 1) {
        v.dome(x, y + 4, z, 2.4, "brass");
        v.box(x, y + 6, z, x + 1, y + 9, z + 1, "iron");
        v.put(x, y + 9, z + 1, "iron");
      }
    }
  }
  if (c.lv >= 2) person(v, x + 3, 2, z, i % 2 ? "yellow" : "red");
}

// ---------------------------------------------------------------------------------------------
const builders: Record<string, (c: Ctx) => void> = {
  pumped_storage_station: pumpedStorage,
  flying_car_depot: flyingCarDepot,
  solar_canopy_orchard: solarOrchard,
  floodplain_park: floodPark,
  hanging_garden_arcology: arcology,
  teleportation_depot: teleportDepot,
  materials_foundry: foundry,
  rainwater_cathedral: rainCathedral,
  spaceport,
  skybridge_university: university,
  ocean_habitat_ring: oceanRing,
};

defineDesigns(
  Object.fromEntries(
    Object.entries(builders).map(([id, build]) => {
      const p = PROJECT_BY_ID[id];
      return [id, { footprints: p.footprints, levels: p.levels, growth: p.description, build }];
    }),
  ),
);
