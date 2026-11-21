/**
 * Education campuses — eleven schools that must never be confused with each other.
 *
 * Shared vocabulary lives at the top (halls, roofs, play kit, sports kit, towers, instruments, rotors);
 * each school then has its own builder with four architectural styles and five relational growth stages:
 * small schools add yards and wings, big schools become compounds with quads, athletics and landmarks.
 * Footprints, level names and style names come from CAMPUS_FARM_ART / designStyles.json (gameplay data).
 */
import { CAMPUS_FARM_ART } from "../campusFarmArt";
import { packVoxKey } from "../voxelCore";
import { defineDesigns } from "./registry";
import {
  PixelVox,
  lot,
  windows,
  ribbonWindows,
  curtainWall,
  gable,
  hip,
  flatRoof,
  barrelRoof,
  sawtooth,
  cyl,
  ring,
  spire,
  column,
  tree,
  flowerBed,
  hedge,
  car,
  truck,
  person,
  lamp,
  bench,
  flag,
  acUnit,
  fence,
  securityFence,
  fountain,
  solarRow,
  tank,
  smokestack,
  container,
  parking,
  type Ctx,
  type TreeKind,
} from "./kit";

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

type Roof =
  | "gable"
  | "gableZ"
  | "hip"
  | "flat"
  | "green"
  | "barrel"
  | "barrelZ"
  | "saw"
  | "mono"
  | "tile"
  | "slab"
  | "none";
type Win = "punch" | "tall" | "ribbon" | "curtain" | "logs" | "none" | "lit";
interface Arch {
  wall: string;
  wall2: string;
  roof: string;
  trim: string;
  glass: string;
  accent: string;
}
const SHIRTS = ["red", "blue", "yellow", "lime", "orange", "pink", "teal", "purple", "white", "sky"];
const SKIN = ["#f0c29b", "#c98b5e", "#8d5a3b", "#e8b38f"];

function bnd(c: Ctx) {
  const X0 = -c.hx + 1,
    X1 = c.hx - 1,
    Z0 = -c.hz + 1,
    Z1 = c.hz - 1;
  return { X0, X1, Z0, Z1, W: X1 - X0, D: Z1 - Z0 };
}
const free = (v: PixelVox, x: number, y: number, z: number) => !v.v.has(packVoxKey(x, y, z));
function kid(v: PixelVox, x: number, z: number, shirt: string, y = 1, skin = SKIN[0]) {
  v.put(x, y, z, shirt);
  v.put(x, y + 1, z, skin);
}
/** Sprinkle people onto free ground (children are 2 tall, adults 3). */
function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, kids = true, cols = SHIRTS, y = 1) {
  const v = c.v;
  for (let i = 0, t = 0; i < n && t < n * 8 && x1 > x0 && z1 > z0; t++) {
    const x = c.ri(x0, x1 - 1),
      z = c.ri(z0, z1 - 1);
    if (!free(v, x, y, z) || !free(v, x, y + 1, z) || !free(v, x, y + 2, z) || free(v, x, y - 1, z)) continue;
    if (kids) kid(v, x, z, c.pick(cols), y, c.pick(SKIN));
    else person(v, x, y, z, c.pick(cols), c.pick(["blueDark", "charcoal", "wood", "slate"]), c.pick(SKIN));
    i++;
  }
}

/**
 * Generic building shell: hollow walls, window treatment, cornice and roof. Returns the roof top y.
 * Box is [x0,x1)×[y0,h)×[z0,z1); roof starts at y = h.
 */
function hall(
  c: Ctx,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
  a: Arch,
  roof: Roof,
  win: Win = "punch",
  y0 = 1,
): number {
  const v = c.v;
  if (x1 - x0 < 3 || z1 - z0 < 3) return h;
  if (win === "curtain") {
    curtainWall(c, x0, y0, z0, x1, h, z1, a.glass, a.trim, 3, 4);
    v.box(x0, h - 1, z0, x1, h, z1, a.trim);
  } else {
    v.hollowBox(x0, y0, z0, x1, h, z1, a.wall);
    if (win === "logs")
      for (let y = y0 + 1; y < h - 1; y += 2) {
        v.box(x0, y, z0, x1, y + 1, z0 + 1, a.wall2);
        v.box(x0, y, z1 - 1, x1, y + 1, z1, a.wall2);
        v.box(x0, y, z0, x0 + 1, y + 1, z1, a.wall2);
        v.box(x1 - 1, y, z0, x1, y + 1, z1, a.wall2);
      }
    for (const [px, pz] of [
      [x0, z0],
      [x1 - 1, z0],
      [x0, z1 - 1],
      [x1 - 1, z1 - 1],
    ])
      v.box(px, y0, pz, px + 1, h, pz + 1, a.trim);
    if (win === "punch" || win === "logs")
      windows(c, x0, y0, z0, x1, h, z1, { col: a.glass, emit: 0.45, stepV: 4, sill: a.trim });
    if (win === "tall") windows(c, x0, y0, z0, x1, h, z1, { col: a.glass, emit: 0.45, stepV: 4, stepH: 2, h: 2 });
    if (win === "ribbon") ribbonWindows(c, x0, y0, z0, x1, h, z1, 4, a.glass, 0.4);
    if (win === "lit") ribbonWindows(c, x0, y0, z0, x1, h, z1, 3, "warmGlow", 0.9);
    v.box(x0, h - 1, z0, x1, h, z1, a.trim);
  }
  return roofOn(c, x0, z0, x1, z1, h, a, roof);
}
function roofOn(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, a: Arch, roof: Roof): number {
  const v = c.v;
  switch (roof) {
    case "gable":
      return gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", a.roof, a.trim, a.wall);
    case "gableZ":
      return gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "z", a.roof, a.trim, a.wall);
    case "hip":
      return hip(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, a.roof, a.trim);
    case "tile":
      return hip(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, a.roof, a.trim, 3);
    case "flat":
      return flatRoof(c, x0, h, z0, x1, z1, a.roof, a.trim, true) + 1;
    case "slab":
      v.box(x0 - 2, h, z0 - 1, x1 + 2, h + 1, z1 + 2, a.trim);
      return h + 1;
    case "green":
      v.box(x0, h, z0, x1, h + 1, z1, "moss");
      v.box(x0, h + 1, z0, x1, h + 2, z0 + 1, a.trim);
      v.box(x0, h + 1, z1 - 1, x1, h + 2, z1, a.trim);
      for (let x = x0 + 1; x < x1 - 1; x += 2)
        for (let z = z0 + 1; z < z1 - 1; z += 2) if (c.rand() < 0.4) v.put(x, h + 1, z, c.pick(["leaf", "leafLight", "yellow"]));
      return h + 2;
    case "barrel":
      return barrelRoof(v, x0, h, z0, x1, z1, "x", a.roof, a.trim);
    case "barrelZ":
      return barrelRoof(v, x0, h, z0, x1, z1, "z", a.roof, a.trim);
    case "saw":
      sawtooth(v, x0, h, z0, x1, z1, a.roof, "glass", 4);
      return h + 3;
    case "mono": {
      const d = z1 - z0;
      for (let k = 0; k <= d; k++) {
        const y = h + Math.floor((d - k) / 3);
        v.box(x0 - 1, y, z0 - 1 + k, x1 + 1, y + 1, z0 + k, a.roof);
        if (y > h) {
          v.box(x0, h, z0 - 1 + k, x0 + 1, y, z0 + k, a.wall);
          v.box(x1 - 1, h, z0 - 1 + k, x1, y, z0 + k, a.wall);
        }
      }
      v.box(x0, h, z0, x1, h + Math.floor(d / 3), z0 + 1, a.wall);
      return h + Math.floor(d / 3) + 1;
    }
    default:
      return h;
  }
}
function entry(v: PixelVox, cx: number, z1: number, door: string, canopy?: string, w = 2, h = 3) {
  const x = cx - (w >> 1);
  v.box(x, 1, z1 - 1, x + w, 1 + h, z1, door, door.startsWith("glass") ? 0.4 : 0);
  v.put(x + w, h, z1, "warmGlow", 0.9);
  if (canopy) v.box(x - 1, 1 + h, z1, x + w + 1, 2 + h, z1 + 2, canopy);
}
/** Clock face on the +z plane (axis z) or +x plane (axis x). */
function clock(v: PixelVox, cx: number, cy: number, p: number, axis: "z" | "x", r = 2) {
  for (let a = -r; a <= r; a++)
    for (let b = -r; b <= r; b++)
      if (a * a + b * b <= r * r + 0.5) {
        const edge = a * a + b * b > (r - 1) * (r - 1) + 0.6;
        const col = edge ? "gold" : "white";
        if (axis === "z") v.put(cx + a, cy + b, p, col, 0.3);
        else v.put(p, cy + b, cx + a, col, 0.3);
      }
  if (axis === "z") {
    v.put(cx, cy, p, "black");
    v.put(cx, cy + 1, p, "black");
    v.put(cx + 1, cy, p, "black");
  } else {
    v.put(p, cy, cx, "black");
    v.put(p, cy + 1, cx, "black");
    v.put(p, cy, cx - 1, "black");
  }
}
function path(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col = "path") {
  v.box(x0, 0, z0, x1, 1, z1, col);
}
function trees(c: Ctx, pts: [number, number][], kind: TreeKind, size = 1) {
  for (const [x, z] of pts) tree(c.v, x, 1, z, kind, size, c.ri(0, 5));
}
function bikes(v: PixelVox, x: number, z: number, n: number) {
  v.box(x, 1, z + 1, x + n * 2, 2, z + 2, "iron");
  for (let i = 0; i < n; i++) {
    const bx = x + i * 2;
    v.put(bx, 1, z, "rubber");
    v.put(bx, 1, z + 2, "rubber");
    v.put(bx, 2, z + 1, SHIRTS[(i * 3 + x) & 7]);
  }
}
/** Yellow school bus, 9 long × 3 wide. (x,z) = min corner. */
function bus(v: PixelVox, x: number, z: number, axis: "x" | "z" = "x", col = "busYellow") {
  const L = 9,
    sx = axis === "x" ? L : 3,
    sz = axis === "x" ? 3 : L;
  v.box(x, 1, z, x + sx, 4, z + sz, col);
  v.box(x, 4, z, x + sx, 5, z + sz, "white");
  if (axis === "x") {
    v.box(x + 2, 3, z, x + sx - 1, 4, z + 1, "glassDark");
    v.box(x + 2, 3, z + 2, x + sx - 1, 4, z + 3, "glassDark");
    v.box(x, 2, z, x + sx, 3, z + 1, "black");
    v.box(x, 2, z + 2, x + sx, 3, z + 3, "black");
    v.clear(x, 3, z, x + 2, 5, z + 3);
    v.box(x + 2, 3, z, x + 3, 4, z + 3, "glassDark");
    for (const ox of [1, 7]) for (const oz of [0, 2]) v.put(x + ox, 1, z + oz, "rubber");
    v.put(x, 2, z + 1, "warmGlow", 0.8);
  } else {
    v.box(x, 3, z + 1, x + 1, 4, z + sz - 2, "glassDark");
    v.box(x + 2, 3, z + 1, x + 3, 4, z + sz - 2, "glassDark");
    v.box(x, 2, z, x + 1, 3, z + sz, "black");
    v.box(x + 2, 2, z, x + 3, 3, z + sz, "black");
    v.clear(x, 3, z + sz - 2, x + 3, 5, z + sz);
    v.box(x, 3, z + sz - 3, x + 3, 4, z + sz - 2, "glassDark");
    for (const oz of [1, 7]) for (const ox of [0, 2]) v.put(x + ox, 1, z + oz, "rubber");
    v.put(x + 1, 2, z + sz - 1, "warmGlow", 0.8);
  }
}
function parkedCars(c: Ctx, x0: number, x1: number, z: number) {
  for (let x = x0 + 2; x < x1 - 2; x += 4) if (c.rand() < 0.75) car(c.v, x, 1, z, "z", c.pick(["red", "blue", "white", "silver", "teal", "charcoal"]));
}

// ---- play kit ----
function slide(v: PixelVox, x: number, z: number, deck: string, chute: string, roof: string) {
  for (const xd of [0, 3]) for (const zd of [0, 2]) v.box(x + xd, 1, z + zd, x + xd + 1, 6, z + zd + 1, deck);
  v.box(x, 5, z, x + 4, 6, z + 3, deck);
  hip(v, x - 1, 8, z - 1, x + 5, z + 4, roof);
  for (const xd of [0, 3]) v.box(x + xd, 6, z, x + xd + 1, 8, z + 1, deck);
  for (let i = 0; i < 5; i++) v.box(x + 1, 5 - i, z + 3 + i, x + 3, 6 - i, z + 4 + i, chute);
  for (let i = 0; i < 4; i++) v.put(x + 4, 1 + i, z + 1 - (i & 1), "iron");
}
function swings(v: PixelVox, x: number, z: number, frame: string, seats: string[], n = 2) {
  const w = n * 3 + 1;
  for (const ox of [0, w - 1]) {
    v.box(x + ox, 1, z, x + ox + 1, 6, z + 1, frame);
    v.box(x + ox, 1, z + 2, x + ox + 1, 6, z + 3, frame);
  }
  v.box(x, 6, z + 1, x + w, 7, z + 2, frame);
  for (let i = 0; i < n; i++) {
    const sx = x + 2 + i * 3;
    v.box(sx, 3, z + 1, sx + 1, 6, z + 2, "iron");
    v.put(sx, 2, z + 1, seats[i % seats.length]);
  }
}
function sandbox(v: PixelVox, x0: number, z0: number, x1: number, z1: number, rim = "wood") {
  v.box(x0, 1, z0, x1, 2, z1, rim);
  v.box(x0 + 1, 1, z0 + 1, x1 - 1, 2, z1 - 1, "sand");
  v.put(x0 + 2, 2, z0 + 2, "sandDark");
  v.put(x1 - 3, 2, z1 - 3, "red");
  v.put(x1 - 2, 2, z0 + 2, "blue");
}
function seesaw(v: PixelVox, x: number, z: number, col: string) {
  v.put(x + 3, 1, z, "iron");
  v.box(x, 2, z, x + 7, 3, z + 1, col);
  v.put(x, 3, z, "red");
  v.put(x + 6, 3, z, "blue");
}
function climbDome(v: PixelVox, cx: number, cz: number, r: number, cols: string[]) {
  for (let x = -r; x < r; x++)
    for (let y = 0; y < r; y++)
      for (let z = -r; z < r; z++) {
        const d = Math.hypot(x + 0.5, y + 0.5, z + 0.5);
        if (d <= r && d > r - 1 && (x + y + z) % 2 === 0) v.put(cx + x, 1 + y, cz + z, cols[(y + 4) % cols.length]);
      }
}
function merryGoRound(c: Ctx, cx: number, cz: number, r = 3) {
  const m = new PixelVox();
  const cols = ["red", "yellow", "blue", "lime", "orange", "purple"];
  for (let x = -r; x < r; x++)
    for (let z = -r; z < r; z++) {
      if ((x + 0.5) ** 2 + (z + 0.5) ** 2 > r * r + 0.2) continue;
      const a = Math.atan2(z + 0.5, x + 0.5);
      m.put(x, 0, z, cols[Math.floor(((a + Math.PI) / (2 * Math.PI)) * 6) % 6]);
    }
  for (const [x, z] of [
    [r - 1, -1],
    [-r, 0],
    [0, r - 1],
    [-1, -r],
  ])
    m.box(x, 1, z, x + 1, 3, z + 1, "silver");
  m.box(-1, 1, -1, 1, 4, 1, "yellow");
  m.box(-1, 4, -1, 1, 5, 1, "red");
  c.addRotor({ vox: m, pivot: [cx, 1, cz], axis: "y", speed: 0.9 });
}
function tunnel(v: PixelVox, x0: number, x1: number, z: number, cols: string[]) {
  for (let x = x0; x < x1; x++)
    for (let a = -2; a <= 2; a++) {
      const y = 1 + Math.round(Math.sqrt(Math.max(0, 6.5 - a * a)));
      v.put(x, y, z + a, cols[(x - x0) % cols.length]);
      if (Math.abs(a) === 2) v.box(x, 1, z + a, x + 1, y, z + a + 1, cols[(x - x0) % cols.length]);
    }
}
function toyBlock(v: PixelVox, x: number, y: number, z: number, s: number, col: string, mark = "white") {
  v.box(x, y, z, x + s, y + s, z + s, col);
  const m = Math.floor(s / 2);
  v.box(x + 1, y + 1, z + s - 1, x + s - 1, y + 2, z + s, mark);
  v.box(x + m, y + 1, z + s - 1, x + m + 1, y + s - 1, z + s, mark);
  v.box(x + s - 1, y + m, z + 1, x + s, y + m + 1, z + s - 1, mark);
}
function sunflower(v: PixelVox, x: number, z: number, h: number) {
  v.box(x, 1, z, x + 1, h, z + 1, "leafDark");
  v.put(x - 1, Math.floor(h / 2), z, "leaf");
  for (const [a, b] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ])
    v.put(x + a, h + 1 + b, z, "yellow");
  v.put(x, h + 1, z, "wood");
  v.put(x, h + 1, z + 1, "woodDark");
}
function rainbow(v: PixelVox, cx: number, z: number, r: number) {
  const cols = ["red", "orange", "yellow", "lime", "sky", "purple"];
  for (let k = 0; k < cols.length && r - k > 1; k++) {
    const R = r - k;
    for (let x = -R; x < R; x++)
      for (let y = 0; y < R; y++) {
        const d = Math.hypot(x + 0.5, y + 0.5);
        if (d <= R && d > R - 1) v.box(cx + x, 1 + y, z, cx + x + 1, 2 + y, z + 2, cols[k]);
      }
  }
}
function crayonFence(c: Ctx, gate: [number, number]) {
  const v = c.v,
    cols = ["red", "orange", "yellow", "lime", "blue", "purple", "pink", "teal"];
  const post = (x: number, z: number, i: number) => {
    v.box(x, 1, z, x + 1, 3, z + 1, cols[i % cols.length]);
    v.put(x, 3, z, i % 2 ? "cream" : cols[(i + 3) % cols.length]);
  };
  let i = 0;
  for (let x = -c.hx; x < c.hx; x++) {
    post(x, -c.hz, i++);
    if (x < gate[0] || x >= gate[1]) post(x, c.hz - 1, i++);
  }
  for (let z = -c.hz + 1; z < c.hz - 1; z++) {
    post(-c.hx, z, i++);
    post(c.hx - 1, z, i++);
  }
}

// ---- sports kit ----
function hoop(v: PixelVox, x: number, z: number, dir: 1 | -1) {
  v.box(x, 1, z, x + 1, 6, z + 1, "iron");
  v.box(x - 1, 5, z + dir, x + 2, 8, z + dir + 1, "white");
  v.put(x, 6, z + dir, "red");
  v.put(x, 5, z + 2 * dir, "orange");
}
function court(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col: string, key = "red") {
  v.box(x0, 0, z0, x1, 1, z1, "white");
  v.box(x0 + 1, 0, z0 + 1, x1 - 1, 1, z1 - 1, col);
  const mx = Math.floor((x0 + x1) / 2);
  v.box(x0 + 1, 0, Math.floor((z0 + z1) / 2), x1 - 1, 1, Math.floor((z0 + z1) / 2) + 1, "white");
  v.box(mx - 2, 0, z0 + 1, mx + 2, 1, z0 + 4, key);
  v.box(mx - 2, 0, z1 - 4, mx + 2, 1, z1 - 1, key);
  hoop(v, mx, z0, 1);
  hoop(v, mx, z1 - 1, -1);
}
/** Stepped bleachers along x; dir=-1 rises toward -z (spectators face +z). */
function stand(c: Ctx, x0: number, x1: number, z: number, steps: number, dir: 1 | -1, seat: string, roof?: string, fill = 0.35) {
  const v = c.v;
  for (let i = 0; i < steps; i++) {
    const zz = z + i * dir;
    v.box(x0, 1, zz, x1, i + 2, zz + 1, i % 2 ? "steelLight" : seat);
    for (let x = x0; x < x1; x++)
      if (c.rand() < fill) {
        v.put(x, i + 2, zz, c.pick(SHIRTS));
        v.put(x, i + 3, zz, c.pick(SKIN));
      }
  }
  if (roof) {
    const back = z + (steps - 1) * dir;
    for (let x = x0; x < x1; x += 5) v.box(x, steps + 1, back, x + 1, steps + 6, back + 1, "steelDark");
    v.box(x1 - 1, steps + 1, back, x1, steps + 6, back + 1, "steelDark");
    const za = Math.min(back, z),
      zb = Math.max(back, z) + 1;
    v.box(x0 - 1, steps + 6, za, x1 + 1, steps + 7, zb, roof);
  }
}
function flood(c: Ctx, x: number, z: number, h: number) {
  const v = c.v;
  v.box(x, 1, z, x + 1, h, z + 1, "steelLight");
  v.box(x - 1, h, z, x + 2, h + 2, z + 1, "steelDark");
  v.box(x - 1, h, z + 1, x + 2, h + 2, z + 2, "white", 1.6);
  c.blink(x, h + 2, z, "white");
}
function scoreboard(v: PixelVox, x: number, z: number, w: number, h: number, frame: string) {
  v.box(x, 1, z, x + 1, h, z + 1, "steelDark");
  v.box(x + w - 1, 1, z, x + w, h, z + 1, "steelDark");
  v.box(x, h, z, x + w, h + 4, z + 1, frame);
  v.box(x + 1, h + 1, z + 1, x + w - 1, h + 3, z + 2, "black");
  for (let i = x + 2; i < x + w - 2; i += 2) v.put(i, h + 2, z + 1, i % 4 ? "amber" : "red", 1.2);
}
function goal(v: PixelVox, x: number, z0: number, dir: 1 | -1, col = "white") {
  v.box(x, 1, z0, x + 1, 4, z0 + 1, col);
  v.box(x, 1, z0 + 4, x + 1, 4, z0 + 5, col);
  v.box(x, 4, z0, x + 1, 5, z0 + 5, col);
  v.box(x - dir, 1, z0, x - dir + 1, 3, z0 + 5, "silver");
}
/** Running-track oval along x. Returns the infield rectangle. */
function track(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col: string, lanes = 3) {
  const r = (z1 - z0) / 2,
    cz = z0 + r,
    ca = x0 + r,
    cb = Math.max(ca, x1 - r);
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const px = x + 0.5,
        pz = z + 0.5,
        dx = px < ca ? ca - px : px > cb ? px - cb : 0,
        d = Math.hypot(dx, pz - cz);
      if (d > r) continue;
      const k = Math.floor(r - d);
      v.put(x, 0, z, k < lanes ? (k === 1 && lanes > 2 ? col : col) : k === lanes ? "white" : (x >> 2) % 2 ? "leaf" : "moss");
      if (k < lanes && k > 0 && Math.abs(r - d - k) < 0.12) v.put(x, 0, z, "white");
    }
  const inset = lanes + 1;
  return {
    fx0: Math.round(ca - (r - inset) * 0.6),
    fx1: Math.round(cb + (r - inset) * 0.6),
    fz0: Math.round(z0 + inset),
    fz1: Math.round(z1 - inset),
  };
}
type Sport = "soccer" | "gridiron" | "baseball" | "athletics";
function field(v: PixelVox, x0: number, z0: number, x1: number, z1: number, sport: Sport, accent = "red") {
  const mx = Math.floor((x0 + x1) / 2),
    mz = Math.floor((z0 + z1) / 2);
  if (x1 - x0 < 6 || z1 - z0 < 5) return;
  if (sport === "baseball") {
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) v.put(x, 0, z, (x + z) % 4 < 2 ? "leaf" : "moss");
    const R = Math.min(x1 - x0, z1 - z0) * 0.55,
      hxp = x0 + 1,
      hzp = z1 - 2; // home plate front-left
    for (let x = x0; x < x1; x++)
      for (let z = z0; z < z1; z++) {
        const a = x - hxp,
          b = hzp - z;
        if (a < 0 || b < 0) continue;
        const d = Math.hypot(a, b);
        if (d < R && (a > R * 0.62 || b > R * 0.62 || d > R * 0.82 || a + b < 3)) v.put(x, 0, z, "terracotta");
        if (d >= R && d < R + 1.2) v.put(x, 0, z, "sandDark");
        if (a === 0 || b === 0) v.put(x, 0, z, "white");
      }
    const s = Math.round(R * 0.7);
    for (const [a, b] of [
      [0, 0],
      [s, 0],
      [s, s],
      [0, s],
    ])
      v.put(hxp + a, 1, hzp - b, "white");
    v.put(hxp + Math.round(s / 2), 1, hzp - Math.round(s / 2), "sandDark");
    // backstop
    for (let i = -3; i <= 3; i++) v.box(hxp - 2 + Math.max(0, i), 1, hzp + 1 + Math.min(0, i) + 1, hxp - 1 + Math.max(0, i), 6, hzp + 2 + Math.min(0, i) + 1, "#9aa3ad");
    return;
  }
  for (let x = x0; x < x1; x++)
    for (let z = z0; z < z1; z++) {
      const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
      let col = (x >> 1) % 2 ? "leaf" : "moss";
      if (sport === "gridiron") {
        const ez = x - x0 < 4 || x1 - 1 - x < 4;
        col = ez ? accent : (x - x0) % 4 === 0 ? "white" : (x >> 2) % 2 ? "leaf" : "moss";
      }
      if (sport === "athletics") col = (z >> 1) % 2 ? "leafLight" : "leaf";
      v.put(x, 0, z, edge ? "white" : col);
    }
  if (sport === "soccer") {
    v.box(mx, 0, z0, mx + 1, 1, z1, "white");
    ring(v, mx + 0.5, mz + 0.5, 0, 1, 3, 2.2, "white");
    const gz = mz - 2;
    v.box(x0 + 1, 0, gz - 2, x0 + 4, 1, gz + 7, "white");
    v.box(x0 + 1, 0, gz - 1, x0 + 3, 1, gz + 6, "leaf");
    v.box(x1 - 4, 0, gz - 2, x1 - 1, 1, gz + 7, "white");
    v.box(x1 - 3, 0, gz - 1, x1 - 1, 1, gz + 6, "leaf");
    goal(v, x0, gz, 1);
    goal(v, x1 - 1, gz, -1);
  } else if (sport === "gridiron") {
    for (const gx of [x0, x1 - 1]) {
      v.box(gx, 1, mz, gx + 1, 4, mz + 1, "yellow");
      v.box(gx, 4, mz - 2, gx + 1, 5, mz + 3, "yellow");
      v.box(gx, 5, mz - 2, gx + 1, 9, mz - 1, "yellow");
      v.box(gx, 5, mz + 2, gx + 1, 9, mz + 3, "yellow");
    }
  } else {
    // athletics: long-jump pit, high-jump mat, rugby posts
    v.box(x0 + 2, 0, z0 + 1, x0 + 9, 1, z0 + 2, "terracotta");
    v.box(x0 + 9, 0, z0 + 1, x0 + 12, 1, z0 + 3, "sand");
    v.box(x1 - 6, 1, z1 - 4, x1 - 2, 2, z1 - 2, "blue");
    v.box(x1 - 7, 1, z1 - 4, x1 - 6, 4, z1 - 3, "white");
    v.box(x1 - 2, 1, z1 - 4, x1 - 1, 4, z1 - 3, "white");
    ring(v, mx + 0.5, mz + 0.5, 0, 1, 2.5, 1.6, "white");
  }
}

// ---- towers & instruments ----
type Top = "spire" | "pinnacles" | "cupola" | "dome" | "tile" | "flat";
function clockTower(c: Ctx, x: number, z: number, w: number, h: number, a: Arch, top: Top, roofCol = a.roof) {
  const v = c.v,
    cx = x + Math.floor(w / 2);
  v.hollowBox(x, 1, z, x + w, h, z + w, a.wall);
  for (const [px, pz] of [
    [x, z],
    [x + w - 1, z],
    [x, z + w - 1],
    [x + w - 1, z + w - 1],
  ])
    v.box(px, 1, pz, px + 1, h + 1, pz + 1, a.trim);
  for (let y = 5; y < h - 7; y += 5) {
    v.box(cx - 1, y, z + w - 1, cx + 1, y + 2, z + w, a.glass, 0.4);
    v.box(x + w - 1, y, cx - 1, x + w, y + 2, cx + 1, a.glass, 0.4);
  }
  v.box(x - 1, h - 7, z - 1, x + w + 1, h - 6, z + w + 1, a.trim);
  clock(v, cx, h - 4, z + w, "z", Math.min(2, Math.floor(w / 2) - 1));
  clock(v, cx, h - 4, x + w, "x", Math.min(2, Math.floor(w / 2) - 1));
  // belfry openings
  v.box(x + 1, h - 1, z + w - 1, x + w - 1, h, z + w, "charcoal");
  v.box(x - 1, h, z - 1, x + w + 1, h + 1, z + w + 1, a.trim);
  const tcx = x + w / 2,
    tcz = z + w / 2;
  if (top === "spire") spire(v, tcx, tcz, h + 1, w + 6, w / 2 + 0.3, roofCol);
  else if (top === "pinnacles") {
    for (const [px, pz] of [
      [x - 1, z - 1],
      [x + w, z - 1],
      [x - 1, z + w],
      [x + w, z + w],
    ]) {
      v.box(px, h + 1, pz, px + 1, h + 4, pz + 1, a.trim);
      v.put(px, h + 4, pz, "gold");
    }
    for (let i = x; i < x + w; i += 2) {
      v.put(i, h + 1, z - 1, a.trim);
      v.put(i, h + 1, z + w, a.trim);
    }
    spire(v, tcx, tcz, h + 1, w + 2, w / 2 - 0.5, roofCol);
  } else if (top === "cupola") {
    v.box(x + 1, h + 1, z + 1, x + w - 1, h + 5, z + w - 1, "white");
    v.box(x + 2, h + 2, z + w - 2, x + w - 2, h + 4, z + w - 1, "charcoal");
    v.dome(tcx, h + 5, tcz, w / 2 - 0.5, roofCol);
    v.box(Math.floor(tcx), h + 5 + Math.ceil(w / 2), Math.floor(tcz), Math.floor(tcx) + 1, h + 8 + Math.ceil(w / 2), Math.floor(tcz) + 1, "gold");
  } else if (top === "dome") v.dome(tcx, h + 1, tcz, w / 2 + 0.5, roofCol);
  else if (top === "tile") hip(v, x - 1, h + 1, z - 1, x + w + 1, z + w + 1, roofCol, a.trim);
  else v.box(x, h + 1, z, x + w, h + 2, z + w, roofCol);
}
/** Small bell cupola sitting on a ridge at height y. */
function bellCupola(v: PixelVox, x: number, z: number, y: number, wall: string, roofCol: string, steeple = false) {
  v.box(x - 1, y, z - 1, x + 2, y + 2, z + 2, wall);
  for (const [px, pz] of [
    [x - 1, z - 1],
    [x + 1, z - 1],
    [x - 1, z + 1],
    [x + 1, z + 1],
  ])
    v.box(px, y + 2, pz, px + 1, y + 5, pz + 1, wall);
  v.put(x, y + 3, z, "gold");
  v.put(x, y + 4, z, "goldDark");
  if (steeple) spire(v, x + 0.5, z + 0.5, y + 5, 7, 2.1, roofCol);
  else hip(v, x - 2, y + 5, z - 2, x + 3, z + 3, roofCol);
}
/** Observatory: drum + rotating slit dome with a telescope poking out. */
function observatory(c: Ctx, cx: number, cz: number, r: number, h: number, wall: string, domeCol: string, speed = 0.15) {
  const v = c.v;
  cyl(v, cx, cz, 1, h, r, wall);
  ring(v, cx, cz, h - 1, h, r + 0.6, r - 1, "steelDark");
  v.box(Math.round(cx) - 1, 1, Math.round(cz + r) - 1, Math.round(cx) + 1, 4, Math.round(cz + r), "woodDark");
  const m = new PixelVox();
  for (let x = -r; x < r; x++)
    for (let y = 0; y < r; y++)
      for (let z = -r; z < r; z++) {
        const d = Math.hypot(x + 0.5, y + 0.5, z + 0.5);
        if (d > r) continue;
        const slit = Math.abs(x + 0.5) < 1.1 && z >= 0 && y >= 1;
        if (slit && d > r - 2) continue;
        m.put(x, y, z, slit ? "charcoal" : d > r - 1.2 ? domeCol : "steelDark");
      }
  for (let t = 0; t <= r + 1; t++) {
    m.box(-1, 1 + Math.round(t * 0.8), Math.round(t * 0.75), 1, 2 + Math.round(t * 0.8), Math.round(t * 0.75) + 1, t > r - 1 ? "steelDark" : "white");
  }
  m.box(-1, r, -1, 1, r + 1, 1, "steelLight");
  c.addRotor({ vox: m, pivot: [cx, h, cz], axis: "y", speed });
}
/** Parabolic radio dish on a pedestal, rotating slowly around y. Returns top y. */
function dish(c: Ctx, cx: number, cz: number, r: number, mount: number, col = "white", speed = 0.2) {
  const v = c.v;
  v.cone(cx, 1, mount, cz, Math.max(1.2, r * 0.35), Math.max(0.8, r * 0.18), "concrete");
  const m = new PixelVox(),
    s = Math.SQRT1_2,
    f = r * 0.75,
    R = Math.ceil(r) + 2;
  // solid paraboloid shell tilted 45° toward +z: sample every voxel and keep those near the surface
  for (let x = -R; x < R; x++)
    for (let y = -R; y < R; y++)
      for (let z = -R; z < R; z++) {
        const px = x + 0.5,
          py = y + 0.5,
          pz = z + 0.5;
        const along = (py + pz) * s,
          w = (py - pz) * s,
          q = px * px + w * w;
        if (q > r * r) continue;
        const surf = q / (4 * f);
        if (along < surf - 0.45 || along > surf + 0.75) continue;
        m.put(x, y, z, q > (r - 1) * (r - 1) ? "silver" : col);
      }
  for (let t = 1; t < f; t++) m.put(0, Math.round(t * s), Math.round(t * s), "steelDark");
  m.put(0, Math.round(f * s), Math.round(f * s), "red", 1);
  m.box(-1, -Math.ceil(r * 0.75), -1, 1, 0, 1, "steelLight");
  const py = mount + Math.ceil(r * 0.75) + 1;
  c.addRotor({ vox: m, pivot: [cx, py, cz], axis: "y", speed });
  return py + r;
}
function mast(c: Ctx, x: number, z: number, h: number, col = "steelDark", arms = true) {
  const v = c.v;
  v.box(x, 1, z, x + 1, h, z + 1, col);
  if (arms) for (let y = 5; y < h; y += 4) v.box(x - 1, y, z, x + 2, y + 1, z + 1, col);
  v.put(x, h, z, "red", 1.2);
  c.blink(x, h, z, "red");
}
function towerCrane(c: Ctx, x: number, z: number, h: number, jib: number, col = "hazard") {
  const v = c.v;
  v.box(x, 1, z, x + 2, h, z + 2, col);
  for (let y = 3; y < h; y += 3) v.box(x, y, z, x + 2, y + 1, z + 2, "steelDark");
  const m = new PixelVox();
  m.box(-4, 0, -1, jib, 1, 1, col);
  m.box(-4, -2, -1, -1, 0, 1, "concreteDark");
  m.box(0, 1, -1, 2, 3, 1, "white");
  m.put(1, 2, 0, "glass", 0.4);
  m.box(-1, 1, -1, 0, 4, 0, col);
  m.box(jib - 2, -9, -1, jib - 1, 0, 0, "steelDark");
  m.box(jib - 5, -10, -1, jib + 1, -9, 1, "orange");
  c.addRotor({ vox: m, pivot: [x + 1, h, z + 1], axis: "y", speed: 0.22 });
  c.blink(x + 1, h + 4, z + 1, "red");
}

// ---------------------------------------------------------------------------------------------
// PRESCHOOL — Toybox (stacked primary toy blocks) / Forest playhouse (log cabins, turf roofs,
// treehouse) / Sunflower (sunny stucco, sunflower murals, giant flowers) / Seaside (striped beach
// huts on stilts, sail shades, sand). Grows: playroom → yard → open-book story wing →
// adventure castle & merry-go-round → a ring of playhouses around a rainbow plaza.
// ---------------------------------------------------------------------------------------------
const PRE: Arch[] = [
  { wall: "white", wall2: "red", roof: "blue", trim: "yellow", glass: "sky", accent: "red" },
  { wall: "woodLight", wall2: "wood", roof: "moss", trim: "woodDark", glass: "glass", accent: "orange" },
  { wall: "cream", wall2: "yellow", roof: "orange", trim: "white", glass: "glass", accent: "yellow" },
  { wall: "white", wall2: "sky", roof: "red", trim: "blue", glass: "glass", accent: "sky" },
];
function playroom(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, seed = 0) {
  const v = c.v,
    a = PRE[c.variant],
    vr = c.variant;
  if (vr === 0) {
    const cols = ["red", "yellow", "blue", "lime", "orange", "purple"];
    let i = seed;
    for (let x = x0; x < x1; ) {
      const w = Math.min(x1 - x, x1 - x < 8 ? x1 - x : 5),
        hh = h + ((i % 3) - 1);
      const col = cols[i % 6];
      v.hollowBox(x, 1, z0, x + w, hh, z1, col);
      v.box(x, hh - 1, z0, x + w, hh, z1, "white");
      if (w >= 3) {
        v.box(x + 1, 2, z1 - 1, x + w - 1, hh - 2, z1, "sky", 0.45);
        v.box(x + Math.floor(w / 2), 2, z1 - 1, x + Math.floor(w / 2) + 1, hh - 2, z1, "white");
      }
      if (i % 3 === 1 && w >= 4) gable(v, x, hh, z0, x + w, z1, "z", cols[(i + 2) % 6]);
      x += w;
      i++;
    }
    toyBlock(v, x0 + 1, h + 1, z0 + 1, 3, "red");
    if (x1 - x0 > 9) toyBlock(v, x1 - 4, h + 2, z0 + 1, 3, "blue", "yellow");
    entry(v, Math.floor((x0 + x1) / 2), z1, "red", "yellow");
  } else if (vr === 1) {
    hall(c, x0, z0, x1, z1, h, a, "gableZ", "logs");
    v.box(Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, Math.floor((x0 + x1) / 2) + 1, 4, z1, "woodDark");
    v.put(Math.floor((x0 + x1) / 2), 4, z1 - 1, "woodDark");
    v.box(x1 - 3, h, z0 + 1, x1 - 1, h + 5, z0 + 3, "stone");
    c.smoke(x1 - 2, h + 5, z0 + 2, "smoke");
  } else if (vr === 2) {
    hall(c, x0, z0, x1, z1, h + 1, a, "tile", "punch");
    // sunflower mural on the front
    const mx = Math.floor((x0 + x1) / 2) + 2,
      my = Math.max(3, Math.floor(h / 2) + 1);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) v.put(mx + i, my + j, z1, i * i + j * j <= 1 ? "wood" : "yellow");
    v.box(mx, 1, z1, mx + 1, my - 2, z1 + 1, "leaf");
    entry(v, x0 + 3, z1, "orange", "white");
  } else {
    for (const px of [x0, x1 - 1]) for (const pz of [z0, z1 - 1]) v.box(px, 1, pz, px + 1, 3, pz + 1, "woodDark");
    v.box(x0 - 1, 2, z0, x1 + 1, 3, z1 + 2, "woodLight");
    v.hollowBox(x0, 3, z0, x1, h + 2, z1, "white");
    for (let x = x0; x < x1; x += 2) {
      v.box(x, 3, z0, x + 1, h + 2, z0 + 1, "sky");
      v.box(x, 3, z1 - 1, x + 1, h + 2, z1, "sky");
    }
    v.box(Math.floor((x0 + x1) / 2) - 1, 3, z1 - 1, Math.floor((x0 + x1) / 2) + 1, 6, z1, "red");
    gable(v, x0 - 1, h + 2, z0 - 1, x1 + 1, z1 + 1, "x", a.roof, "white", "white");
    for (let z = z1; z < z1 + 2; z++) v.box(Math.floor((x0 + x1) / 2) - 1, 1, z + 1, Math.floor((x0 + x1) / 2) + 1, 2, z + 2, "woodLight");
  }
}
function storyWing(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const v = c.v,
    a = PRE[c.variant];
  const cover = ["red", "leafDark", "blue", "purple"][c.variant];
  v.hollowBox(x0, 1, z0, x1, 6, z1, c.variant === 1 ? "woodLight" : a.wall2 === "red" ? "yellow" : a.wall2);
  windows(c, x0, 1, z0, x1, 6, z1, { col: "warmGlow", emit: 0.6, stepH: 3 });
  // open-book roof: white pages under an overhanging coloured cover with a gold spine
  gable(v, x0, 6, z0, x1, z1, "z", "white");
  gable(v, x0 - 1, 7, z0 - 1, x1 + 1, z1 + 1, "z", cover);
  const top = 7 + Math.ceil((x1 - x0 + 2) / 2) - 1;
  v.box(Math.floor((x0 + x1) / 2) - 1, top, z0 - 1, Math.floor((x0 + x1) / 2) + 1, top + 1, z1 + 1, "gold");
  entry(v, Math.floor((x0 + x1) / 2), z1, cover);
}
function playCastle(c: Ctx, x: number, z: number) {
  const v = c.v,
    col = ["red", "woodLight", "yellow", "white"][c.variant],
    roofCol = ["blue", "moss", "orange", "red"][c.variant];
  v.hollowBox(x, 1, z, x + 5, 9, z + 5, col);
  v.box(x + 1, 1, z + 4, x + 4, 4, z + 5, null);
  for (let i = 0; i < 5; i += 2) {
    v.put(x + i, 9, z, col);
    v.put(x + i, 9, z + 4, col);
    v.put(x, 9, z + i, col);
    v.put(x + 4, 9, z + i, col);
  }
  spire(v, x + 2.5, z + 2.5, 9, 5, 2.2, roofCol, "red");
  // rope net & bridge to the slide deck
  for (let y = 2; y < 8; y++) for (let zz = z; zz < z + 5; zz++) if ((y + zz) % 2 === 0) v.put(x + 5, y, zz, "wood");
  v.box(x + 5, 6, z + 1, x + 11, 7, z + 3, "woodLight");
  flag(v, x + 2, 12, z + 2, 4, [roofCol, "white"]);
}
function playhouse(v: PixelVox, x: number, z: number, wall: string, roof: string) {
  v.hollowBox(x, 1, z, x + 5, 5, z + 5, wall);
  v.box(x + 2, 1, z + 4, x + 3, 3, z + 5, "woodDark");
  v.put(x + 4, 3, z + 4, "sky", 0.4);
  v.put(x, 3, z + 2, "sky", 0.4);
  gable(v, x - 1, 5, z - 1, x + 6, z + 6, "z", roof);
}
function preschool(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    a = PRE[vr];
  lot(c, ["grass2", "grass3", "grass2", "sand"][vr]);
  const gx = X0 + Math.floor(W * 0.5);
  // soft rubber yard surface
  const yard = ["#f39a6b", "#c9a26b", "#f6c75c", "sand"][vr];
  v.box(X0 + 1, 0, Z0 + Math.floor(D * 0.5), X1 - 1, 1, Z1 - 1, yard);
  path(v, gx - 1, Z0 + 4, gx + 2, Z1 + 1, vr === 3 ? "woodLight" : "path2");
  const prW = Math.min(lv >= 5 ? 16 : 13, Math.max(9, Math.floor(W * 0.62))),
    prD = Math.min(9, Math.max(6, Math.floor(D * 0.45)));
  const px0 = lv === 1 ? X0 + 1 : X0 + 2,
    pz0 = Z0 + 1;
  playroom(c, px0, pz0, px0 + prW, pz0 + prD, 5);
  const sw = ["red", "lime", "yellow", "sky"],
    deck = ["blue", "woodDark", "orange", "white"][vr],
    chute = ["yellow", "orange", "red", "red"][vr];
  if (lv === 1) {
    slide(v, X1 - 5, Z0 + prD - 3, deck, chute, a.accent);
    sandbox(v, X0 + 1, Z1 - 6, X0 + 7, Z1 - 1, vr === 3 ? "blue" : "wood");
  }
  const frame = ["red", "woodDark", "orange", "blue"][vr],
    sandRim = vr === 3 ? "blue" : "wood",
    midZ = Z0 + prD + 3;
  if (lv >= 2) slide(v, Math.min(X1 - 6, px0 + prW + 1), pz0 + 1, deck, chute, a.accent);
  if (lv === 2) {
    swings(v, X0 + prW + 4, Z1 - 6, frame, sw, 2);
    sandbox(v, X0 + 2, Z1 - 7, X0 + 9, Z1 - 1, sandRim);
    seesaw(v, X1 - 9, Z1 - 3, ["lime", "wood", "orange", "sky"][vr]);
  }
  if (lv === 3) {
    swings(v, X0 + Math.floor(W * 0.38), Z1 - 6, frame, sw, 2);
    sandbox(v, X0 + 2, Z1 - 7, X0 + 9, Z1 - 1, sandRim);
    climbDome(v, X1 - 6, Z1 - 6, 3, ["red", "yellow", "blue", "lime", "orange"]);
  }
  if (lv >= 3) storyWing(c, X1 - 12, Z0 + 2, X1 - 3, Z0 + 2 + Math.min(10, Math.floor(D * 0.38)));
  if (lv === 4) {
    // adventure playground: castle with rope bridge, tunnel, dome, merry-go-round
    playCastle(c, X0 + 2, Z1 - 7);
    sandbox(v, X0 + 2, midZ, X0 + 9, midZ + 5, sandRim);
    swings(v, X0 + 12, midZ, frame, sw, 3);
    tunnel(v, X0 + Math.floor(W * 0.45), X0 + Math.floor(W * 0.45) + 7, Z1 - 4, ["red", "yellow", "blue", "lime"]);
    climbDome(v, X1 - 16, midZ + 3, 3, ["red", "yellow", "blue", "lime", "orange"]);
    merryGoRound(c, X1 - 7, Z1 - 7, 3);
  }
  if (lv >= 5) {
    // children's village: playhouses ring a rainbow plaza with a splash pad
    const walls = ["yellow", "sky", "pink", "lime", "orange"],
      roofs = ["red", "blue", "purple", "leafDark", "teal"];
    const hz0 = Z0 + 15,
      step = Math.max(7, Math.floor((D - 30) / 2));
    for (let i = 0; i < 2; i++) {
      playhouse(v, X0 + 2, hz0 + i * step, walls[(i + vr) % 5], roofs[(i + vr) % 5]);
      playhouse(v, X1 - 7, hz0 + i * step, walls[(i + 2 + vr) % 5], roofs[(i + 3 + vr) % 5]);
    }
    rainbow(v, gx, hz0 + 2, 7);
    v.box(gx - 6, 0, hz0 + 5, gx + 7, 1, hz0 + 13, "cyan", 0.2);
    for (const [ox, oz] of [
      [-3, 7],
      [0, 9],
      [3, 7],
      [6, 10],
    ])
      v.box(gx + ox, 1, hz0 + oz, gx + ox + 1, 3, hz0 + oz + 1, "white", 0.5);
    playCastle(c, X0 + 2, Z1 - 7);
    swings(v, X0 + 15, Z1 - 5, frame, sw, 2);
    sandbox(v, X0 + 9, hz0, X0 + 15, hz0 + 5, sandRim);
    climbDome(v, X1 - 13, hz0 + 3, 3, ["red", "yellow", "blue", "lime", "orange"]);
    merryGoRound(c, X1 - 7, Z1 - 7, 3);
    // parents with buggies at the gate
    person(v, gx + 3, 1, Z1 - 1, "teal");
    v.box(gx + 4, 1, Z1 - 1, gx + 6, 3, Z1, "pink");
  }
  crowd(c, X0 + 1, Z0 + prD + 2, X1 - 1, Z1 - 1, lv === 1 ? 3 : 4 + lv * 2);
  // variant garnish
  if (vr === 0 && lv >= 2) {
    toyBlock(v, X1 - 4, 1, Z1 - 4, 3, "lime", "white");
    toyBlock(v, X1 - 4, 4, Z1 - 4, 2, "orange", "white");
  }
  if (vr === 1) {
    tree(v, X1 - 3, 1, Z1 - 3, "oak", lv >= 3 ? 1.6 : 1.1, 2);
    if (lv >= 2) {
      // treehouse
      const tx = X0 + Math.floor(W * 0.62),
        tz = lv === 4 ? Z1 - 11 : Z1 - 10;
      tree(v, tx, 1, tz, "oak", 1.8, 1);
      v.hollowBox(tx - 2, 6, tz - 2, tx + 3, 10, tz + 3, "wood");
      gable(v, tx - 3, 10, tz - 3, tx + 4, tz + 4, "x", "moss");
      for (let y = 1; y < 6; y++) v.put(tx + 3, y, tz + 2, y % 2 ? "woodDark" : "wood");
    }
    for (let i = 0; i < lv; i++) v.box(X0 + (lv >= 4 ? 9 : 2) + i * 2, 1, Z1 - 2, X0 + (lv >= 4 ? 10 : 3) + i * 2, 2 + (i % 2), Z1 - 1, "wood");
  }
  if (vr === 2)
    for (let i = 0; i < 2 + lv; i++) sunflower(v, X0 + 2 + i * 3, lv >= 4 ? midZ - 1 : Z1 - 2, 5 + (i % 3));
  if (vr === 3) {
    for (const [x, z] of [
      [X1 - 2, Z1 - 2],
      [X0 + 1, Z0 + prD + 2],
    ]) {
      v.box(x, 1, z, x + 1, 8, z + 1, "white");
    }
    v.box(X0 + 2, 7, Z0 + prD + 2, X1 - 2, 8, Z0 + prD + 3, "white");
    if (lv >= 2) {
      // boat climbing frame
      const bx = lv >= 4 ? X1 - 18 : X1 - 12,
        bz = Z1 - 4;
      v.box(bx, 1, bz - 1, bx + 7, 3, bz + 2, "red");
      v.box(bx + 1, 3, bz - 1, bx + 6, 3, bz + 2, null);
      v.box(bx + 3, 3, bz, bx + 4, 9, bz + 1, "woodDark");
      for (let y = 4; y < 9; y++) v.box(bx + 4, y, bz, bx + 4 + Math.floor((9 - y) / 1.5), y + 1, bz + 1, "white");
    }
    v.put(X0 + 2, 2, Z1 - 2, "red");
    v.put(X0 + 2, 3, Z1 - 2, "white");
  }
  crayonFence(c, [gx - 2, gx + 3]);
}

// ---------------------------------------------------------------------------------------------
// COUNTRY SCHOOLHOUSE — Red clapboard (red board walls, white trim, bell cupola) / White chapel
// (white walls, steep roof, steeple) / Prairie timber (log walls, sod roof) / Fieldstone (rubble
// stone, slate, chimney). Grows: one room → bell & pump → teacher's cottage → reading garden →
// harvest fair with striped tents, hay bales and a tiny Ferris wheel.
// ---------------------------------------------------------------------------------------------
const CSH: Arch[] = [
  { wall: "red", wall2: "redDark", roof: "slate", trim: "white", glass: "glass", accent: "white" },
  { wall: "white", wall2: "cream", roof: "charcoal", trim: "white", glass: "sky", accent: "goldDark" },
  { wall: "wood", wall2: "woodDark", roof: "moss", trim: "woodDark", glass: "glass", accent: "olive" },
  { wall: "stone", wall2: "granite", roof: "slate", trim: "concrete", glass: "glass", accent: "brickDark" },
];
function schoolhouse(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, bell: boolean) {
  const v = c.v,
    vr = c.variant,
    a = CSH[vr],
    cx = Math.floor((x0 + x1) / 2);
  v.hollowBox(x0, 1, z0, x1, h, z1, a.wall);
  if (vr === 0) for (let y = 2; y < h; y += 2) v.box(x0, y, z0, x1, y + 1, z1, a.wall2), v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, null);
  if (vr === 2)
    for (let y = 1; y < h; y += 2) {
      v.box(x0 - 1, y, z0, x0, y + 1, z0 + 1, "woodDark");
      v.box(x1, y, z0, x1 + 1, y + 1, z0 + 1, "woodDark");
      v.box(x0 - 1, y, z1 - 1, x0, y + 1, z1, "woodDark");
      v.box(x1, y, z1 - 1, x1 + 1, y + 1, z1, "woodDark");
      v.box(x0, y, z0, x1, y + 1, z1, a.wall2), v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, null);
    }
  if (vr === 3) for (let i = 0; i < (x1 - x0) * (h - 1); i += 3) v.put(x0 + (i % (x1 - x0)), 1 + Math.floor(i / (x1 - x0)), z1 - 1, c.pick(["granite", "concrete", "stone"]));
  for (const px of [x0, x1 - 1]) for (const pz of [z0, z1 - 1]) v.box(px, 1, pz, px + 1, h, pz + 1, a.trim);
  // tall sash windows on the long sides (x faces)
  for (let z = z0 + 2; z < z1 - 2; z += 3) {
    const tall = vr === 1 ? 3 : 2;
    v.box(x0, 2, z, x0 + 1, 2 + tall, z + 1, a.glass, 0.45);
    v.box(x1 - 1, 2, z, x1, 2 + tall, z + 1, a.glass, 0.45);
    v.put(x1, 1, z, "white");
  }
  // gable faces the front (ridge along z)
  const top = gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "z", a.roof, a.trim, a.wall);
  if (vr === 1) gable(v, x0, h + 1, z0 - 1, x1, z1 + 1, "z", a.roof);
  // porch + door
  v.box(cx - 1, 1, z1 - 1, cx + 1, 4, z1, "woodDark");
  v.box(cx - 2, 1, z1, cx + 2, 2, z1 + 3, "woodLight");
  for (const px of [cx - 2, cx + 1]) v.box(px, 2, z1 + 2, px + 1, 5, z1 + 3, "white");
  v.box(cx - 3, 5, z1, cx + 3, 6, z1 + 3, a.roof);
  v.put(cx, h + 1, z1, "white", 0.3);
  if (bell) bellCupola(v, cx, z1 - 2, top - 1, vr === 2 ? "woodDark" : "white", vr === 1 ? "charcoal" : vr === 2 ? "wood" : "red", vr === 1);
  if (vr === 3) {
    v.box(x0 + 1, 1, z0 + 1, x0 + 3, top + 2, z0 + 3, "granite");
    c.smoke(x0 + 2, top + 2, z0 + 2, "smoke");
  } else {
    v.box(x1 - 3, h, z0 + 1, x1 - 1, top + 1, z0 + 3, "brick");
    c.smoke(x1 - 2, top + 1, z0 + 2, "smoke");
  }
  return top;
}
function ferrisWheel(c: Ctx, x: number, z: number, r: number) {
  const v = c.v,
    hub = r + 2;
  for (const dz of [-3, 2])
    for (let y = 1; y <= hub; y++) {
      const off = Math.round(((hub - y) / hub) * (r * 0.6));
      v.put(x - 1 - off, y, z + dz, "white");
      v.put(x + off, y, z + dz, "white");
    }
  v.box(x - 1, hub, z - 3, x + 1, hub + 1, z + 3, "steelDark");
  v.box(x - r, 0, z - 4, x + r, 1, z + 4, "woodLight");
  const m = new PixelVox(),
    cols = ["red", "yellow", "blue", "lime", "orange", "pink", "purple", "teal"];
  for (let a = 0; a < 96; a++) {
    const t = (a / 96) * Math.PI * 2;
    m.put(Math.round(Math.cos(t) * r - 0.5), Math.round(Math.sin(t) * r - 0.5), -1, "red");
    m.put(Math.round(Math.cos(t) * r - 0.5), Math.round(Math.sin(t) * r - 0.5), 0, "red");
  }
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2;
    for (let s = 1; s < r; s++) m.put(Math.round(Math.cos(t) * s - 0.5), Math.round(Math.sin(t) * s - 0.5), 0, "white");
    const gx = Math.round(Math.cos(t) * r - 0.5),
      gy = Math.round(Math.sin(t) * r - 0.5);
    m.box(gx, gy - 1, -2, gx + 1, gy + 1, 2, cols[k]);
  }
  m.box(-1, -1, -1, 1, 1, 1, "gold");
  c.addRotor({ vox: m, pivot: [x, hub, z], axis: "z", speed: 0.35 });
}
function country_schoolhouse(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    a = CSH[vr];
  lot(c, vr === 2 ? "grass3" : "grass2");
  const sw = Math.min(11, W - 4),
    sd = Math.min(12, Math.max(8, D - 6));
  const sx0 = lv >= 3 ? X0 + 2 : X0 + Math.floor((W - sw) / 2) - 1,
    sz0 = Z0 + 1;
  const cx = sx0 + Math.floor(sw / 2);
  path(v, cx - 1, sz0 + sd + 3, cx + 1, Z1 + 1, "path");
  schoolhouse(c, sx0, sz0, sx0 + sw, sz0 + sd, 8 + (vr === 1 ? 1 : 0), lv >= 2);
  if (lv === 1) {
    kid(v, cx + 3, sz0 + sd + 3, "red");
    kid(v, cx - 3, sz0 + sd + 4, "blue");
    v.box(X1 - 3, 1, Z1 - 4, X1 - 1, 2, Z1 - 1, "woodDark");
  }
  if (lv >= 2) {
    // flag, water pump, outhouse
    flag(v, X0 + 1, 1, Z1 - 3, 9, vr === 1 ? ["blue", "white"] : ["red", "white", "blue"]);
    v.box(X1 - 3, 1, Z1 - 3, X1 - 2, 4, Z1 - 2, "iron");
    v.box(X1 - 3, 4, Z1 - 3, X1 - 1, 5, Z1 - 2, "iron");
    v.box(X1 - 4, 0, Z1 - 4, X1 - 1, 1, Z1 - 1, "stone");
    crowd(c, X0 + 2, sz0 + sd + 3, X1 - 3, Z1 - 1, 4);
  }
  if (lv >= 3) {
    // teacher's cottage with picket fence
    const tx = X1 - 10,
      tz = Z0 + 2;
    hall(c, tx, tz, tx + 8, tz + 7, 5, { ...a, wall: vr === 0 ? "cream" : a.wall }, "gable", "punch");
    v.box(tx + 3, 1, tz + 6, tx + 5, 4, tz + 7, "woodDark");
    v.box(tx + 6, 5, tz + 1, tx + 7, 10, tz + 2, "brick");
    c.smoke(tx + 6, 10, tz + 1, "smoke");
    fence(v, tx - 1, tz + 7, X1, tz + 12, 1, 2, "white", [tx + 3, tx + 6]);
    for (let i = 0; i < 4; i++) v.box(tx + i * 2, 1, tz + 8, tx + i * 2 + 1, 2, tz + 11, i % 2 ? "red" : "pink");
    v.box(X1 - 4, 1, Z1 - 7, X1 - 1, 3, Z1 - 5, "wood"); // woodpile
  }
  if (lv >= 4) {
    // reading garden: big shade tree with swing, benches and vegetable rows
    const gx = X0 + Math.min(18, Math.floor(W * 0.62)),
      gz = Z0 + Math.floor(D * 0.6);
    tree(v, gx, 1, gz, vr === 2 ? "oak" : "autumn", 1.8, 2);
    v.box(gx + 2, 3, gz, gx + 3, 7, gz + 1, "iron");
    v.put(gx + 2, 2, gz, "wood");
    bench(v, gx - 5, 1, gz + 3);
    bench(v, gx + 3, 1, gz + 4);
    for (let i = 0; i < 4; i++) {
      v.box(X0 + 2, 0, Z1 - 3 - i * 2, X0 + 10, 1, Z1 - 2 - i * 2, "soil");
      for (let x = X0 + 2; x < X0 + 10; x += 2) v.put(x, 1, Z1 - 3 - i * 2, i % 2 ? "leaf" : "orange");
    }
    crowd(c, gx - 6, gz - 3, gx + 6, gz + 5, 4);
  }
  if (lv >= 5) {
    // harvest fair: striped stalls, pumpkins, hay and a little Ferris wheel
    const fz = Z1 - 7,
      cols = [
        ["red", "white"],
        ["blue", "white"],
        ["orange", "yellow"],
      ];
    for (let i = 0; i < 3; i++) {
      const tx = X0 + 12 + i * 8;
      if (tx + 6 > X1 - 15) break;
      for (let x = tx; x < tx + 6; x++) for (let s = 0; s < 3; s++) v.box(x, 3 + s, fz + s, x + 1, 4 + s, fz + 6 - s, cols[i][x % 2]);
      for (const px of [tx, tx + 5]) for (const pz of [fz, fz + 5]) v.box(px, 1, pz, px + 1, 3, pz + 1, "woodDark");
      v.box(tx + 1, 1, fz + 4, tx + 5, 2, fz + 5, "woodLight");
      for (let k = 0; k < 3; k++) v.put(tx + 1 + k, 2, fz + 4, ["orange", "red", "yellow"][k]);
    }
    const hy = Z0 + 16;
    for (let i = 0; i < 3; i++) v.box(X1 - 14 + i * 3, 1, hy, X1 - 11 + i * 3, 3, hy + 2, "yellow");
    v.box(X1 - 12, 3, hy, X1 - 9, 5, hy + 2, "yellow");
    for (let i = 0; i < 4; i++) v.sphere(X1 - 14 + i * 2 + 0.5, 1.5, hy + 3.5, 1, 0.8, 1, "orange");
    ferrisWheel(c, X1 - 7, Z1 - 5, 6);
    for (let x = X0 + 12; x < X1 - 14; x++) v.put(x, 8 - ((x >> 1) % 2), fz - 1, SHIRTS[x % 6]);
    crowd(c, X0 + 12, fz - 4, X1 - 1, Z1 - 1, 12, false);
  }
  if (vr === 2) for (let i = 0; i < lv; i++) v.box(X0 + 1 + i * 3, 1, Z0 + 1, X0 + 3 + i * 3, 3, Z0 + 3, "yellow"); // hay
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 2, vr === 2 ? "woodDark" : vr === 3 ? "stone" : "white", [cx - 2, cx + 2]);
}

// ---------------------------------------------------------------------------------------------
// ELEMENTARY SCHOOL — Garden brick (red brick, parapets, planters) / Coastal tiles (mission
// stucco, terracotta, arcades, palms) / Maplewood (timber cladding, dark pitched roofs, maples) /
// Sunburst (white modern with colour fins, mono roofs, solar). Grows: porch classroom → painted
// blacktop & climbing frame → library wing → bus loop → two-storey U-shaped academy with gym.
// ---------------------------------------------------------------------------------------------
const ELE: { a: Arch; roof: Roof; win: Win; tree: TreeKind }[] = [
  { a: { wall: "brick", wall2: "brickDark", roof: "concreteDark", trim: "cream", glass: "glass", accent: "leafDark" }, roof: "flat", win: "punch", tree: "round" },
  { a: { wall: "plaster", wall2: "cream", roof: "terracotta", trim: "white", glass: "glass", accent: "teal" }, roof: "tile", win: "tall", tree: "palm" },
  { a: { wall: "woodLight", wall2: "wood", roof: "charcoal", trim: "woodDark", glass: "glass", accent: "orange" }, roof: "gable", win: "punch", tree: "autumn" },
  { a: { wall: "white", wall2: "yellow", roof: "orange", trim: "teal", glass: "glassDark", accent: "yellow" }, roof: "mono", win: "ribbon", tree: "birch" },
];
function eleBlock(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number, roof?: Roof) {
  const v = c.v,
    e = ELE[c.variant],
    h = 1 + floors * 4 + 1;
  const top = hall(c, x0, z0, x1, z1, h, e.a, roof ?? e.roof, e.win);
  if (c.variant === 3)
    for (let x = x0 + 2; x < x1 - 1; x += 4) v.box(x, 1, z1, x + 1, h, z1 + 1, ["yellow", "orange", "teal", "pink"][(x >> 2) & 3]);
  if (c.variant === 1)
    for (let x = x0 + 1; x < x1 - 1; x += 3) {
      v.box(x, 1, z1, x + 1, 5, z1 + 2, "white");
      v.box(x, 5, z1, x + 3, 6, z1 + 2, "terracotta");
    }
  if (c.variant === 0) for (let x = x0 + 1; x < x1 - 1; x += 4) v.box(x, 1, z1, x + 3, 2, z1 + 1, "leafDark");
  return top;
}
function schoolSign(v: PixelVox, cx: number, y: number, z: number, col: string) {
  v.box(cx - 3, y, z, cx + 4, y + 2, z + 1, col);
  for (let x = cx - 2; x < cx + 3; x += 2) v.put(x, y + 1, z + 1, "white", 0.5);
}
function hopscotch(v: PixelVox, x: number, z: number) {
  const cols = ["yellow", "white", "pink", "sky"];
  for (let i = 0; i < 6; i++) {
    if (i % 3 === 1) {
      v.put(x - 1, 0, z - i, cols[i & 3]);
      v.put(x + 1, 0, z - i, cols[(i + 1) & 3]);
    } else v.put(x, 0, z - i, cols[i & 3]);
  }
}
function climbFrame(v: PixelVox, x: number, z: number, cols: string[]) {
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) v.box(x + i * 2, 1, z + k * 2, x + i * 2 + 1, 5, z + k * 2 + 1, cols[(i + k) % cols.length]);
  v.box(x, 5, z, x + 7, 6, z + 5, "iron");
  v.box(x + 1, 3, z + 1, x + 6, 4, z + 4, "woodLight");
}
function elementary_school(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    e = ELE[vr];
  lot(c, "grass2");
  const floors = lv >= 3 ? 2 : 1;
  const bw = lv === 1 ? W - 2 : lv === 2 ? Math.floor(W * 0.55) : lv === 5 ? W - 2 : Math.min(W - 4, Math.max(20, Math.floor(W * 0.72)));
  const bd = Math.min(9, Math.max(6, Math.floor(D * 0.4)));
  const bx0 = X0 + 1,
    bz0 = Z0 + 1,
    cx = bx0 + Math.floor(bw / 2);
  // blacktop in front with painted games
  const tz0 = bz0 + bd + 3;
  v.box(X0 + 1, 0, tz0, X1 - 1, 1, Z1 - 1, "asphalt");
  path(v, cx - 1, bz0 + bd, cx + 2, Z1 + 1, "concrete");
  hopscotch(v, X0 + 3, Z1 - 2);
  if (W > 20) {
    v.box(X0 + 8, 0, Z1 - 7, X0 + 14, 1, Z1 - 1, "white");
    v.box(X0 + 9, 0, Z1 - 6, X0 + 11, 1, Z1 - 4, "red");
    v.box(X0 + 11, 0, Z1 - 6, X0 + 13, 1, Z1 - 4, "blue");
    v.box(X0 + 9, 0, Z1 - 4, X0 + 11, 1, Z1 - 2, "yellow");
    v.box(X0 + 11, 0, Z1 - 4, X0 + 13, 1, Z1 - 2, "lime");
  }
  const top = eleBlock(c, bx0, bz0, bx0 + bw, bz0 + bd, floors);
  // grand entrance: porch, clock & sign
  const eh = 1 + floors * 4;
  v.box(cx - 3, 1, bz0 + bd, cx + 3, 2, bz0 + bd + 3, "concrete");
  for (const px of [cx - 3, cx + 2]) v.box(px, 2, bz0 + bd + 2, px + 1, 6, bz0 + bd + 3, e.a.trim);
  v.box(cx - 4, 6, bz0 + bd - 1, cx + 4, 7, bz0 + bd + 3, e.roof === "flat" ? e.a.trim : e.a.roof);
  entry(v, cx, bz0 + bd, "glass");
  schoolSign(v, cx, eh - 1, bz0 + bd, ["leafDark", "teal", "orange", "blue"][vr]);
  clock(v, cx, Math.max(top - 2, eh + 2), bz0 + bd, "z", 1);
  flag(v, cx + 5, 1, bz0 + bd + 2, 9);
  if (lv === 1) {
    bikes(v, X1 - 6, Z1 - 4, 2);
    crowd(c, X0 + 1, tz0, X1 - 1, Z1 - 1, 4);
  }
  if (lv >= 2) {
    // playground on soft surface: climbing frame, slide, swings
    const px = lv === 2 ? bx0 + bw + 3 : lv === 5 ? X0 + 16 : X1 - 10,
      pz = lv === 2 ? Z0 + 2 : lv === 5 ? Z0 + bd + 4 : Z0 + bd + 4;
    v.box(px - 1, 0, pz - 1, Math.min(X1 - 1, px + 10), 1, pz + 14, "#f39a6b");
    climbFrame(v, px, pz, ["red", "blue", "yellow", "lime"]);
    slide(v, Math.min(X1 - 5, px + 3), pz + 6, "blue", "yellow", "red");
    if (lv >= 3) swings(v, px, pz + 10, "red", ["yellow", "blue"], 2);
    crowd(c, X0 + 1, tz0, X1 - 1, Z1 - 1, 6 + lv * 2);
  }
  if (lv >= 3) {
    // library wing: tall reading room with a big round window and book sign
    const lw = 10,
      lx = bx0 + 2,
      lz = bz0 + bd;
    const ld = Math.min(8, Math.max(5, Math.floor(D * 0.3)));
    hall(c, lx, lz, lx + lw, lz + ld, 8, { ...e.a, wall: e.a.wall2 }, vr === 2 ? "gableZ" : vr === 1 ? "tile" : "flat", "none");
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) v.put(lx + 5 + i, 4 + j, lz + ld - 1, i * i + j * j <= 1 ? "warmGlow" : "glass", 0.6);
    v.box(lx + 2, 1, lz + ld - 1, lx + 4, 2, lz + ld, "red");
    v.box(lx + 6, 1, lz + ld - 1, lx + 8, 2, lz + ld, "blue");
  }
  if (lv >= 4) {
    // bus loop with drop-off canopy
    const bzz = Z1 - 5;
    v.box(X0 + Math.floor(W * 0.4), 0, bzz - 1, X1 - 1, 1, Z1 - 1, "asphaltDark");
    for (let x = X0 + Math.floor(W * 0.4); x < X1 - 1; x += 3) v.put(x, 0, bzz + 1, "yellow");
    bus(v, X0 + Math.floor(W * 0.45), bzz, "x");
    bus(v, X0 + Math.floor(W * 0.45) + 11, bzz, "x");
    v.box(X0 + Math.floor(W * 0.42), 5, bzz - 3, X0 + Math.floor(W * 0.42) + 18, 6, bzz - 1, e.a.trim);
    for (let x = X0 + Math.floor(W * 0.42); x < X0 + Math.floor(W * 0.42) + 18; x += 6) v.box(x, 1, bzz - 2, x + 1, 5, bzz - 1, "steelDark");
  }
  if (lv >= 5) {
    // U-shaped academy: classroom east wing + vaulted gym, garden courtyard between
    const gz0 = bz0 + bd + 1,
      gz1 = Math.min(Z1 - 8, gz0 + 16);
    hall(c, X1 - 13, gz0, X1 - 1, gz1, 10, { ...e.a, roof: e.a.accent }, "barrelZ", "none");
    v.box(X1 - 14, 3, gz0 + 2, X1 - 13, 7, gz1 - 2, e.a.accent);
    for (let z = gz0 + 3; z < gz1 - 3; z += 3) v.put(X1 - 14, 5, z, "white", 0.5);
    const cxg = X0 + 8,
      gzz = Z0 + bd + Math.min(8, Math.max(5, Math.floor(D * 0.3))) + 2;
    v.box(cxg - 5, 0, gzz, cxg + 5, 1, gzz + 11, "grass");
    flowerBed(c, cxg - 4, gzz + 1, cxg - 1, gzz + 4);
    flowerBed(c, cxg + 1, gzz + 1, cxg + 4, gzz + 4);
    for (let i = 0; i < 3; i++) v.box(cxg - 4 + i * 3, 0, gzz + 7, cxg - 2 + i * 3, 1, gzz + 10, "soil"), v.put(cxg - 3 + i * 3, 1, gzz + 8, ["red", "orange", "leaf"][i]);
    tree(v, cxg, 1, gzz + 5, e.tree, 1.4, 3);
  }
  trees(c, [
    [X1 - 2, Z0 + 2],
    [X0 + 1, tz0 - 1],
  ], e.tree, lv >= 3 ? 1.3 : 1);
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 2, "#9aa3ad", [cx - 2, cx + 3]);
  void top;
}

// ---------------------------------------------------------------------------------------------
// MIDDLE SCHOOL — Fieldstone (rubble stone, slate hips) / Copper roof (cream walls, verdigris roofs
// & domes) / Lakeside (white & glass modern, timber deck) / Red brick (brick, white cupola).
// Signature: rooftop science domes + basketball. Grows: two-storey block & bikes → science loft
// with domes & greenhouse → full courts → vaulted gymnasium → arts wing, mural & amphitheatre.
// ---------------------------------------------------------------------------------------------
const MID: { a: Arch; roof: Roof; win: Win; dome: string; court: string }[] = [
  { a: { wall: "stone", wall2: "granite", roof: "slate", trim: "concrete", glass: "glass", accent: "blueDark" }, roof: "hip", win: "punch", dome: "silver", court: "blueDark" },
  { a: { wall: "cream", wall2: "limestone", roof: "tealDark", trim: "white", glass: "glass", accent: "tealDark" }, roof: "hip", win: "tall", dome: "tealDark", court: "tealDark" },
  { a: { wall: "white", wall2: "woodLight", roof: "concreteDark", trim: "steelLight", glass: "glass", accent: "sky" }, roof: "flat", win: "curtain", dome: "white", court: "sky" },
  { a: { wall: "brick", wall2: "brickDark", roof: "charcoal", trim: "white", glass: "glass", accent: "crimson" }, roof: "gable", win: "punch", dome: "white", court: "#2f8f4e" },
];
function middle_school(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    m = MID[vr];
  lot(c, "grass3");
  const bw = Math.min(W - 2, Math.max(16, Math.floor(W * (lv >= 4 ? 0.5 : 0.62)))),
    bd = Math.min(10, Math.max(7, Math.floor(D * 0.42)));
  const bx0 = X0 + 1,
    bz0 = Z0 + 1,
    cx = bx0 + Math.floor(bw / 2),
    h = lv >= 4 ? 14 : 10;
  path(v, cx - 1, bz0 + bd, cx + 2, Z1 + 1, "concrete");
  const roofKind: Roof = lv >= 2 ? (vr === 2 ? "flat" : "flat") : m.roof;
  hall(c, bx0, bz0, bx0 + bw, bz0 + bd, h, m.a, lv >= 2 ? roofKind : m.roof, m.win);
  if (vr !== 2) v.box(bx0, 5, bz0 + bd - 1, bx0 + bw, 6, bz0 + bd, m.a.wall2);
  entry(v, cx, bz0 + bd, "glass", m.a.accent, 4);
  schoolSign(v, cx, h - 2, bz0 + bd, m.a.accent);
  bikes(v, cx + 4, bz0 + bd + 2, Math.min(5, lv + 2));
  if (lv === 1) {
    v.box(X1 - 10, 0, Z1 - 9, X1 - 1, 1, Z1 - 1, m.court);
    hoop(v, X1 - 6, Z0 + Math.max(bd + 2, D - 9), 1);
    crowd(c, X0 + 1, bz0 + bd + 4, X1 - 1, Z1 - 1, 5);
  }
  if (lv >= 2) {
    // science loft: lab domes, greenhouse and a spinning anemometer on the roof
    const ry = h + 1;
    if (vr !== 2) {
      // re-roof as a parapet terrace so domes read clearly
    }
    observatory(c, bx0 + 5, bz0 + 4, 3, ry + 3, m.a.wall2, m.dome, 0.12);
    v.dome(bx0 + bw - 5, ry, bz0 + 4, 2.6, m.dome);
    v.box(bx0 + 9, ry, bz0 + 2, bx0 + Math.min(bw - 8, 17), ry + 3, bz0 + bd - 2, "glass", 0.25);
    v.box(bx0 + 9, ry + 3, bz0 + 2, bx0 + Math.min(bw - 8, 17), ry + 4, bz0 + bd - 2, "steelLight");
    for (let x = bx0 + 10; x < bx0 + Math.min(bw - 8, 17) - 1; x += 2) v.put(x, ry, bz0 + 3, "leaf");
    const an = new PixelVox();
    an.box(-2, 0, -1, 2, 1, 0, "silver");
    an.box(-1, 0, -2, 0, 1, 2, "silver");
    for (const [x, z] of [
      [-2, -1],
      [1, -1],
      [-1, -2],
      [-1, 1],
    ])
      an.put(x, 1, z, "red");
    v.box(bx0 + bw - 2, ry, bz0 + bd - 2, bx0 + bw - 1, ry + 5, bz0 + bd - 1, "steelDark");
    c.addRotor({ vox: an, pivot: [bx0 + bw - 2, ry + 5, bz0 + bd - 2], axis: "y", speed: 2.4, wind: true });
  }
  if (lv === 2) {
    v.box(X1 - 10, 0, Z1 - 9, X1 - 1, 1, Z1 - 1, m.court);
    hoop(v, X1 - 6, Z1 - 9, 1);
    crowd(c, X0 + 1, bz0 + bd + 4, X1 - 1, Z1 - 1, 7);
  }
  if (lv >= 3) {
    const cw = Math.min(14, Math.floor((W - 6) / 2)),
      cd = Math.min(17, D - bd - 4);
    const cx0 = X0 + 2,
      cz0 = Z1 - cd - 1;
    court(v, cx0, cz0, cx0 + cw, cz0 + cd, m.court);
    court(v, cx0 + cw + 2, cz0, cx0 + 2 * cw + 2, cz0 + cd, m.court, "orange");
    crowd(c, cx0, cz0, cx0 + 2 * cw + 2, cz0 + cd, 10);
  }
  if (lv >= 4) {
    // gymnasium: vaulted hall with a giant painted mascot stripe
    const gx0 = bx0 + bw + 2,
      gx1 = X1 - 1,
      gd = Math.min(14, Math.floor(D * 0.48));
    hall(c, gx0, bz0, gx1, bz0 + gd, 9, { ...m.a, roof: m.dome === "white" ? m.a.roof : m.dome }, "barrelZ", "none");
    v.box(gx0, 3, bz0 + gd - 1, gx1, 6, bz0 + gd, m.a.accent);
    for (let x = gx0 + 2; x < gx1 - 2; x += 3) v.put(x, 4, bz0 + gd, "white", 0.4);
    entry(v, Math.floor((gx0 + gx1) / 2), bz0 + gd, "glass", m.a.trim, 4);
  }
  if (lv >= 5) {
    // arts wing with mural + amphitheatre steps + quad tree
    const ax = X1 - 14,
      az = Z0 + Math.floor(D * 0.48);
    hall(c, ax, az, X1 - 1, az + 9, 7, m.a, "saw", "none");
    const mural = ["red", "orange", "yellow", "lime", "sky", "purple"];
    for (let x = ax; x < X1 - 1; x++) for (let y = 1; y < 6; y++) v.put(x, y, az + 8, mural[(x + y * 2) % 6]);
    for (let s = 0; s < 3; s++) v.box(ax - 1 - (3 - s) * 2, 1, az + 10 + s, X1 - 1, 1 + (3 - s), az + 11 + s, s % 2 ? "concrete" : "stone");
    tree(v, X0 + Math.floor(W * 0.6), 1, bz0 + bd + 4, "round", 1.6, 1);
    crowd(c, ax - 6, az + 10, X1 - 1, Z1 - 1, 8);
  }
  if (vr === 3) {
    v.box(cx - 1, h, bz0 + 3, cx + 2, h + 4, bz0 + 6, "white");
    v.dome(cx + 0.5, h + 4, bz0 + 4.5, 2, "charcoal");
  }
  if (vr === 2) {
    v.box(X0 + 1, 1, bz0 + bd, bx0 + bw, 2, bz0 + bd + 2, "woodLight");
    tree(v, X1 - 2, 1, Z0 + 2, "birch", 1.2);
  }
  if (vr === 0) tree(v, X1 - 3, 1, Z0 + 3, "pine", 1.3);
  if (vr === 1) tree(v, X1 - 3, 1, Z0 + 3, "round", 1.2);
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 2, vr === 0 ? "stone" : "#9aa3ad", [cx - 2, cx + 3]);
}

// ---------------------------------------------------------------------------------------------
// HIGH SCHOOL — Cardinals (red-brick collegiate, white portico) / Owls (purple-glass modern, gold
// fins) / Mariners (white concrete & navy, nautical mast) / Hornets (yellow & black brutalist).
// Grows: three-storey senior hall → mascot gymnasium → football field with running track →
// grandstand, press box & scoreboard → floodlit championship stadium with buses and crowds.
// ---------------------------------------------------------------------------------------------
const HIGH: { a: Arch; roof: Roof; win: Win; team: [string, string]; track: string }[] = [
  { a: { wall: "brick", wall2: "brickDark", roof: "slate", trim: "white", glass: "glass", accent: "crimson" }, roof: "hip", win: "punch", team: ["crimson", "white"], track: "terracotta" },
  { a: { wall: "#5b3f8c", wall2: "purpleDark", roof: "concreteDark", trim: "gold", glass: "glass", accent: "gold" }, roof: "flat", win: "curtain", team: ["purple", "gold"], track: "#5b3f8c" },
  { a: { wall: "white", wall2: "steelLight", roof: "blueDark", trim: "blueDark", glass: "glass", accent: "blueDark" }, roof: "gable", win: "ribbon", team: ["blueDark", "white"], track: "blue" },
  { a: { wall: "concrete", wall2: "concreteDark", roof: "charcoal", trim: "black", glass: "glassDark", accent: "yellow" }, roof: "flat", win: "tall", team: ["yellow", "black"], track: "charcoal" },
];
function seniorHall(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const v = c.v,
    hs = HIGH[c.variant],
    h = 14,
    cx = Math.floor((x0 + x1) / 2);
  hall(c, x0, z0, x1, z1, h, hs.a, hs.roof, hs.win);
  if (c.variant === 0) {
    for (let x = cx - 4; x <= cx + 4; x += 2) column(v, x, z1, 1, 11, "white", "cream");
    v.box(cx - 5, 11, z1 - 1, cx + 6, 12, z1 + 2, "white");
    for (let s = 0; s < 3; s++) v.box(cx - 5 + s * 2, 12 + s, z1, cx + 6 - s * 2, 13 + s, z1 + 2, "white");
    v.box(cx - 1, 15, z0 + 3, cx + 2, 19, z0 + 6, "white");
    v.dome(cx + 0.5, 19, z0 + 4.5, 2, "slate");
  } else if (c.variant === 1) {
    for (let x = x0 + 2; x < x1 - 1; x += 3) v.box(x, 1, z1, x + 1, h, z1 + 1, "gold");
    v.box(cx - 4, h, z0 - 1, cx + 4, h + 3, z1 + 3, "purpleDark");
  } else if (c.variant === 2) {
    v.box(cx - 3, 1, z1, cx + 3, h + 4, z1 + 2, "blueDark");
    v.box(cx - 2, 2, z1 + 1, cx + 2, h + 2, z1 + 2, "glass", 0.4);
    v.box(x1 - 3, h, z0 + 2, x1 - 2, h + 12, z0 + 3, "white");
    v.box(x1 - 6, h + 9, z0 + 2, x1 + 1, h + 10, z0 + 3, "white");
    flag(v, x1 - 3, h + 12, z0 + 2, 2, ["blueDark", "white"]);
  } else {
    for (let x = x0; x < x1; x += 4) v.box(x, h - 4, z1, x + 3, h, z1 + 2, "concreteDark");
    v.box(cx - 3, 1, z1, cx + 3, 5, z1 + 3, "yellow");
    v.box(cx - 2, 1, z1 + 2, cx + 2, 4, z1 + 3, null);
  }
  entry(v, cx, z1, "glass", undefined, 4);
  // mascot banner
  v.box(cx - 2, 7, z1 + (c.variant === 0 ? 1 : 2) - (c.variant === 2 ? 0 : 0), cx + 3, 10, z1 + (c.variant === 0 ? 2 : 3), hs.team[0]);
  v.box(cx - 1, 8, z1 + (c.variant === 0 ? 2 : 3), cx + 2, 9, z1 + (c.variant === 0 ? 3 : 4), hs.team[1], 0.4);
}
function hsGym(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const v = c.v,
    hs = HIGH[c.variant];
  hall(c, x0, z0, x1, z1, 10, { ...hs.a, roof: hs.team[0], trim: hs.team[1] }, "barrel", "none");
  v.box(x0, 3, z1 - 1, x1, 8, z1, hs.team[0]);
  v.box(x0 + 1, 4, z1, x1 - 1, 7, z1 + 1, hs.team[1], 0.3);
  v.box(x0 + 3, 5, z1, x1 - 3, 6, z1 + 1, hs.team[0]);
  entry(v, Math.floor((x0 + x1) / 2), z1, "glass", undefined, 4);
}
function high_school(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W } = bnd(c),
    hs = HIGH[vr];
  lot(c, "grass2");
  const md = 11,
    mz0 = Z0 + 1,
    mx0 = X0 + 1;
  const mw = lv === 1 ? Math.min(26, W - 2) : lv === 2 ? Math.min(18, W - 13) : Math.min(24, W - 18);
  const cx = mx0 + Math.floor(mw / 2),
    fz = mz0 + md + 2;
  path(v, cx - 2, mz0 + md, cx + 2, Z1 + 1, "concrete");
  seniorHall(c, mx0, mz0, mx0 + mw, mz0 + md);
  flag(v, cx + 5, 1, fz + 1, 12, [hs.team[0], hs.team[1]]);
  if (lv >= 2) hsGym(c, mx0 + mw + 2, mz0, lv >= 5 ? mx0 + mw + 18 : X1 - 1, mz0 + md);
  if (lv <= 2) {
    parking(c, mx0, fz + 3, X1 - 1, Z1 - 1);
    bus(v, X1 - 11, fz, "x");
    crowd(c, X0 + 1, fz, X1 - 1, fz + 3, 6, false, [hs.team[0], hs.team[1], "blueDark"]);
  }
  if (lv === 3) {
    const f = track(v, X0 + 1, fz, X1 - 1, Z1 - 1, hs.track, 3);
    field(v, f.fx0, f.fz0, f.fx1, f.fz1, "gridiron", hs.team[0]);
    crowd(c, f.fx0 + 2, f.fz0 + 1, f.fx1 - 2, f.fz1 - 1, 8, false, [hs.team[0], hs.team[1]]);
    for (const x of [X0 + Math.floor(W * 0.3), X0 + Math.floor(W * 0.6)]) bench(v, x, 1, fz + 4);
  }
  if (lv >= 4) {
    // grandstand + press box facing the field, scoreboard and floodlights
    const tx1 = lv >= 5 ? X1 - 13 : X1 - 1,
      tz0 = fz + 6;
    const f = track(v, X0 + 1, tz0, tx1, Z1 - 1, hs.track, 3);
    field(v, f.fx0, f.fz0, f.fx1, f.fz1, "gridiron", hs.team[0]);
    crowd(c, f.fx0 + 2, f.fz0 + 1, f.fx1 - 2, f.fz1 - 1, 10, false, [hs.team[0], hs.team[1]]);
    const sx0 = X0 + 5,
      sx1 = tx1 - 4;
    stand(c, sx0, sx1, tz0 - 1, 5, -1, hs.team[0], lv >= 5 ? hs.team[1] : undefined, 0.5);
    const pbx = Math.floor((sx0 + sx1) / 2) - 4;
    if (lv === 4) {
      v.box(pbx, 7, fz, pbx + 9, 11, fz + 3, hs.a.wall2);
      v.box(pbx + 1, 8, fz + 3, pbx + 8, 10, fz + 4, "glass", 0.6);
      v.box(pbx - 1, 11, fz - 1, pbx + 10, 12, fz + 4, hs.team[0]);
    }
    scoreboard(v, X0 + 2, Z1 - 2, 10, 6, hs.team[0]);
    const fl = lv >= 5 ? 20 : 16;
    for (const [x, z] of [
      [X0 + 1, tz0],
      [tx1 - 1, tz0],
      [X0 + 1, Z1 - 3],
      [tx1 - 1, Z1 - 3],
    ])
      flood(c, x, z, fl);
  }
  if (lv >= 5) {
    // science wing, bus loop and championship banners
    hall(c, mx0 + mw + 20, mz0, X1 - 1, mz0 + md - 2, 12, hs.a, hs.roof, hs.win);
    const bx = X1 - 11;
    v.box(bx - 1, 0, fz, X1 - 1, 1, Z1 - 1, "asphaltDark");
    bus(v, bx, fz + 2, "z");
    bus(v, bx + 5, fz + 2, "z");
    bus(v, bx, fz + 14, "z");
    parkedCars(c, bx - 1, X1 - 1, Z1 - 4);
    for (let x = X0 + 6; x < X1 - 16; x += 8) flag(v, x, 12, fz - 1 + 1, 3, [hs.team[0], hs.team[1]]);
  }
  trees(c, [
    [X0 + 1, fz - 1],
    [X1 - 2, fz - 1],
  ], vr === 2 ? "palm" : vr === 0 ? "oak" : "round", 1.1);
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 3, "#9aa3ad", [cx - 3, cx + 3]);
}

// ---------------------------------------------------------------------------------------------
// TRADE SCHOOL — Boilermakers (soot brick sawtooth, boilers & stack) / Shipwrights (timber boat
// shed, hull on a cradle) / Machinists (blue steel cladding, gantry) / Auto works (white & red
// garage, cars on lifts, tyre stacks). Grows: workshop with sparks → machine shop & extraction
// stack → apprentice yard → rotating tower crane → technical works with training tower.
// ---------------------------------------------------------------------------------------------
const TRD: { a: Arch; roof: Roof }[] = [
  { a: { wall: "brickDark", wall2: "brick", roof: "charcoal", trim: "concrete", glass: "glass", accent: "red" }, roof: "saw" },
  { a: { wall: "woodDark", wall2: "wood", roof: "slate", trim: "woodLight", glass: "glass", accent: "blueDark" }, roof: "gable" },
  { a: { wall: "blueDark", wall2: "steelLight", roof: "steelLight", trim: "steel", glass: "glass", accent: "hazard" }, roof: "saw" },
  { a: { wall: "white", wall2: "red", roof: "concreteDark", trim: "red", glass: "glass", accent: "red" }, roof: "flat" },
];
function workshop(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, bays: number) {
  const v = c.v,
    t = TRD[c.variant];
  hall(c, x0, z0, x1, z1, h, t.a, t.roof, "none");
  if (c.variant === 2) for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, h, z1, "steelLight");
  const bw = Math.max(4, Math.floor((x1 - x0 - 2) / bays));
  for (let i = 0; i < bays; i++) {
    const bx = x0 + 1 + i * bw;
    if (bx + bw > x1) break;
    v.box(bx, 1, z1 - 1, bx + bw - 1, Math.min(h - 1, 7), z1, "hazard");
    for (let y = 1; y < Math.min(h - 1, 7); y += 2) v.box(bx, y, z1 - 1, bx + 1, y + 1, z1, "black"), v.box(bx + bw - 2, y, z1 - 1, bx + bw - 1, y + 1, z1, "black");
    if (i % 2 === 0) {
      // open bay with glowing interior and welding sparks
      v.box(bx + 1, 1, z1 - 1, bx + bw - 2, Math.min(h - 2, 6), z1, null);
      v.box(bx + 1, 1, z1 - 3, bx + bw - 2, Math.min(h - 2, 6), z1 - 2, "warmGlow", 0.7);
      person(v, bx + 1, 1, z1 - 2, "orange", "blueDark");
      v.put(bx + 2, 2, z1 - 2, "steelDark");
      c.smoke(bx + 2, 3, z1 - 1, "spark");
    } else {
      for (let y = 2; y < Math.min(h - 1, 7) - 1; y++) v.box(bx + 1, y, z1 - 1, bx + bw - 2, y + 1, z1, y % 2 ? "steelLight" : "steel");
    }
  }
  sign(v, x0 + 2, x0 + Math.min(12, x1 - x0 - 2), h - 2, h, z1, t.a.accent);
}
function sign(v: PixelVox, x0: number, x1: number, y0: number, y1: number, z: number, col: string) {
  v.box(x0, y0, z, x1, y1, z + 1, col, 0.5);
  for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, y0 + ((x >> 1) % 2), z + 1, "white", 0.8);
}
function steelPile(v: PixelVox, x: number, z: number, n: number, col = "steelDark") {
  for (let i = 0; i < n; i++) v.box(x, 1 + i, z + (i % 2), x + 8, 2 + i, z + 1 + (i % 2), i % 2 ? col : "iron");
}
function lumber(v: PixelVox, x: number, z: number) {
  for (let i = 0; i < 3; i++) v.box(x, 1 + i, z, x + 7, 2 + i, z + 3, i % 2 ? "woodLight" : "wood");
}
function carLift(v: PixelVox, x: number, z: number, col: string) {
  v.box(x, 1, z, x + 1, 5, z + 1, "steelDark");
  v.box(x + 6, 1, z, x + 7, 5, z + 1, "steelDark");
  v.box(x, 4, z, x + 7, 5, z + 1, "hazard");
  car(v, x + 3, 5, z, "x", col);
}
function trade_school(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    t = TRD[vr];
  lot(c, "concrete2");
  v.box(X0 + 1, 0, Z0 + 1, X1 - 1, 1, Z1 - 1, "asphalt");
  const ww = Math.min(W - 4, Math.max(16, Math.floor(W * (lv >= 4 ? 0.55 : 0.75)))),
    wd = Math.min(12, Math.max(8, Math.floor(D * 0.5)));
  const wx0 = X0 + 1,
    wz0 = Z0 + 1,
    h = 9 + (lv >= 3 ? 2 : 0);
  if (vr === 1) {
    // shipwright shed: long timber gable with a hull poking out
    hall(c, wx0, wz0, wx0 + ww, wz0 + wd, h, t.a, "gable", "none");
    for (let x = wx0; x < wx0 + ww; x += 2) v.box(x, 1, wz0 + wd - 1, x + 1, h, wz0 + wd, "wood");
    const hx = wx0 + 3;
    v.box(hx, 1, wz0 + wd - 1, hx + 8, h - 1, wz0 + wd, null);
    v.box(hx + 1, 1, wz0 + wd - 2, hx + 7, h - 2, wz0 + wd - 1, "warmGlow", 0.5);
    for (let z = wz0 + 2; z < wz0 + wd + 4; z++) {
      const k = Math.min(3, Math.floor((wz0 + wd + 4 - z) / 2));
      v.box(hx + 4 - k, 2, z, hx + 4 + k, 4 + Math.min(k, 2), z + 1, z % 3 ? "red" : "white");
      v.box(hx + 4 - Math.max(0, k - 1), 1, z, hx + 4 + Math.max(0, k - 1), 2, z + 1, "woodDark");
    }
    c.smoke(hx + 2, 4, wz0 + wd + 1, "spark");
    for (let i = 3; i < Math.floor(ww / 4); i++) {
      const bx = wx0 + i * 4;
      v.box(bx, 1, wz0 + wd - 1, bx + 3, 6, wz0 + wd, "woodLight");
    }
    sign(v, wx0 + 12, wx0 + Math.min(ww - 1, 22), h - 2, h, wz0 + wd, "blueDark");
  } else workshop(c, wx0, wz0, wx0 + ww, wz0 + wd, h, Math.max(2, Math.floor(ww / 6)));
  // yard props
  if (vr === 0) {
    steelPile(v, X0 + 2, Z1 - 4, 3);
    tank(v, X1 - 4, wz0 + 3, 1, 6, 2.2, "steel", "steelLight", "red");
  }
  if (vr === 2) steelPile(v, X0 + 2, Z1 - 4, 4, "blueDark");
  if (vr === 3) {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3 + (i % 2); k++) cyl(v, X0 + 3 + i * 3, Z1 - 3, 1 + k, 2 + k, 1.2, "rubber");
    for (let x = wx0; x < wx0 + Math.min(10, ww); x++) v.put(x, h, wz0 + wd, (x % 2) ? "black" : "white");
  }
  if (vr === 1) lumber(v, X0 + 2, Z1 - 5);
  crowd(c, X0 + 1, wz0 + wd + 2, X1 - 1, Z1 - 1, 3 + lv, false, ["orange", "hazard", "blueDark"]);
  if (lv >= 2) {
    // machine shop extension + extraction stack + roof duct
    const sx = wx0 + ww - 3;
    const top = vr === 0 ? smokestack(v, sx, wz0 + 2, 1, h + 10, 1.4, "brick", "white") : smokestack(v, sx, wz0 + 2, 1, h + 8, 1.1, vr === 1 ? "iron" : "steel", t.a.accent);
    c.smoke(sx, top, wz0 + 2, vr === 0 ? "dark" : "smoke");
    v.box(wx0 + 2, h + 3, wz0 + 2, sx - 1, h + 5, wz0 + 4, "silver");
    for (let x = wx0 + 3; x < sx - 2; x += 5) v.box(x, h, wz0 + 2, x + 2, h + 3, wz0 + 4, "steelDark");
    if (vr === 3 && lv === 2) carLift(v, X1 - 9, Z1 - 4, "crimson");
    else if (vr !== 3) steelPile(v, X0 + 2, Z1 - 8, 2, "iron");
  }
  if (lv >= 3) {
    // apprentice bays: open-sided canopy with workbenches and a car on a lift (front-right yard)
    const ax0 = X0 + Math.floor(W * 0.42),
      ax1 = X1 - 1,
      az = Z1 - 9;
    for (let x = ax0; x < ax1; x += 6) v.box(x, 1, az + 6, x + 1, 7, az + 7, "steelDark");
    v.box(ax1 - 1, 1, az + 6, ax1, 7, az + 7, "steelDark");
    v.box(ax0 - 1, 7, az, ax1, 8, az + 8, vr === 1 ? "wood" : t.a.roof === "charcoal" ? "steelLight" : t.a.roof);
    v.box(ax0 - 1, 7, az, ax1, 8, az + 1, t.a.accent);
    for (let x = ax0 + 1; x < ax1 - 12; x += 5) {
      v.box(x, 1, az + 1, x + 3, 3, az + 2, "woodDark");
      person(v, x + 1, 1, az + 3, "orange", "blueDark");
      c.smoke(x + 2, 3, az + 1, "spark");
    }
    carLift(v, ax1 - 9, az + 3, vr === 3 ? "teal" : "yellow");
  }
  if (lv >= 4) {
    // stock yard: shipping containers, pallets and a forklift
    const yz = wz0 + wd + 3,
      yx = X0 + Math.floor(W * 0.42);
    container(v, yx, 1, yz, "x", vr === 3 ? "red" : "blue");
    container(v, yx + 7, 1, yz, "x", "orange");
    container(v, yx + 3, 4, yz, "x", vr === 1 ? "leafDark" : "teal");
    for (let i = 0; i < 3; i++) v.box(yx + 15 + i * 3, 1, yz, yx + 17 + i * 3, 2 + (i % 2), yz + 2, i % 2 ? "crate" : "wood");
    v.box(yx - 5, 1, yz, yx - 2, 3, yz + 2, "yellow");
    v.box(yx - 2, 1, yz, yx - 1, 5, yz + 2, "steelDark");
    v.put(yx - 4, 3, yz + 1, "black");
    towerCrane(c, X1 - 6, Z0 + 3, 22 + lv, 11, vr === 2 ? "orange" : "hazard");
    // gantry over stock yard
    const gx = X1 - 14;
    v.box(gx, 1, Z1 - 12, gx + 1, 10, Z1 - 11, "hazard");
    v.box(gx + 11, 1, Z1 - 12, gx + 12, 10, Z1 - 11, "hazard");
    v.box(gx, 10, Z1 - 12, gx + 12, 11, Z1 - 11, "hazard");
    v.box(gx + 5, 6, Z1 - 12, gx + 6, 10, Z1 - 11, "steelDark");
    v.box(gx + 3, 5, Z1 - 12, gx + 9, 6, Z1 - 11, "iron");
  }
  if (lv >= 5) {
    // technical works: second hall + scaffold training tower + power-line practice poles
    const hx0 = wx0 + ww + 2;
    if (vr === 1) hall(c, hx0, Z0 + 1, X1 - 8, Z0 + 12, 12, t.a, "gable", "none");
    else workshop(c, hx0, Z0 + 1, X1 - 8, Z0 + 12, 12, 3);
    const tx = X0 + 13,
      tz = Z1 - 10;
    for (let y = 1; y < 22; y += 4) {
      v.box(tx, y + 3, tz, tx + 6, y + 4, tz + 6, "woodLight");
      v.box(tx + 1, y + 3, tz + 1, tx + 5, y + 4, tz + 5, null);
    }
    for (const [px, pz] of [
      [tx, tz],
      [tx + 5, tz],
      [tx, tz + 5],
      [tx + 5, tz + 5],
    ])
      v.box(px, 1, pz, px + 1, 24, pz + 1, "hazard");
    person(v, tx + 2, 24, tz + 2, "orange");
    const pz = wz0 + wd + 3;
    for (let i = 0; i < 4; i++) {
      const px = X0 + 3 + i * 6;
      v.box(px, 1, pz, px + 1, 12, pz + 1, "wood");
      v.box(px - 2, 11, pz, px + 3, 12, pz + 1, "wood");
      if (i % 2 === 0) person(v, px + 1, 8, pz, "orange");
    }
    for (let x = X0 + 1; x < X0 + 23; x++) v.put(x, 11, pz + 1, "charcoal");
    parkedCars(c, hx0, X1 - 9, Z0 + 15);
  }
  securityFence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 3, [Math.floor(W * 0.2) - 3, Math.floor(W * 0.2) + 3]);
}

// ---------------------------------------------------------------------------------------------
// COMMUNITY COLLEGE — Adobe (stepped pueblo walls, vigas, terracotta) / Green glazed (green glass,
// living roofs) / Harbor modern (white concrete, blue glass, sail canopies) / City brick (brick
// bars with a glass library). Signature: modern glass library box with cantilevered roof.
// Grows: learning centre & lot → lit evening wing → library → garden commons → community quad.
// ---------------------------------------------------------------------------------------------
const CC: { a: Arch; roof: Roof; lib: string }[] = [
  { a: { wall: "sand", wall2: "sandDark", roof: "sandDark", trim: "terracotta", glass: "glass", accent: "teal" }, roof: "flat", lib: "glass" },
  { a: { wall: "#6fbf9a", wall2: "leafDark", roof: "moss", trim: "white", glass: "#7fd6b0", accent: "lime" }, roof: "green", lib: "#7fd6b0" },
  { a: { wall: "white", wall2: "steelLight", roof: "concreteDark", trim: "white", glass: "sky", accent: "blue" }, roof: "slab", lib: "sky" },
  { a: { wall: "brick", wall2: "brickDark", roof: "concreteDark", trim: "charcoal", glass: "glass", accent: "orange" }, roof: "flat", lib: "glass" },
];
function ccBar(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, lit = false) {
  const v = c.v,
    k = CC[c.variant];
  if (c.variant === 0) {
    hall(c, x0, z0, x1, z1, h, k.a, "none", lit ? "lit" : "ribbon");
    v.box(x0, h, z0, x1, h + 1, z1, k.a.wall);
    v.box(x0 + 2, h + 1, z0 + 1, x1 - 4, h + 4, z1 - 3, k.a.wall);
    windows(c, x0 + 2, h + 1, z0 + 1, x1 - 4, h + 4, z1 - 3, { col: k.a.glass, emit: 0.5, stepH: 3, startY: 0 });
    for (let x = x0 + 1; x < x1; x += 3) v.put(x, h - 2, z1, "woodDark"), v.put(x, h + 2, z1 - 3, "woodDark");
  } else if (c.variant === 1) {
    hall(c, x0, z0, x1, z1, h, k.a, "green", "curtain");
    if (lit) for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, 2 + ((x * 7) % 3) * 4, z1 - 1, "warmGlow", 0.9);
  } else if (c.variant === 2) {
    hall(c, x0, z0, x1, z1, h, k.a, "slab", lit ? "lit" : "ribbon");
    for (let x = x0 + 1; x < x1; x += 4) v.box(x, 1, z1 + 1, x + 1, h, z1 + 2, "white");
  } else {
    hall(c, x0, z0, x1, z1, h, k.a, "flat", lit ? "lit" : "punch");
  }
}
function library(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number) {
  const v = c.v,
    k = CC[c.variant];
  curtainWall(c, x0, 1, z0, x1, h, z1, k.lib, c.variant === 3 ? "charcoal" : "white", 3, 4);
  // book stacks visible through the glass
  const cols = ["red", "blue", "yellow", "lime", "orange", "purple"];
  for (let y = 2; y < h - 1; y += 4) for (let x = x0 + 2; x < x1 - 2; x++) v.put(x, y, z1 - 2, cols[(x + y) % 6]);
  for (let y = 4; y < h; y += 4) v.box(x0 + 1, y, z0 + 1, x1 - 1, y + 1, z1 - 1, "concrete");
  // cantilevered roof slab
  v.box(x0 - 2, h, z0 - 1, x1 + 3, h + 1, z1 + 3, c.variant === 0 ? "terracotta" : c.variant === 3 ? "charcoal" : "white");
  for (const px of [x1 + 1]) v.box(px, 1, z1 + 1, px + 1, h, z1 + 2, "steelLight");
  if (c.variant === 1) v.box(x0, h + 1, z0, x1, h + 2, z1, "moss");
  v.box(x0 + 1, h - 3, z1, x1 - 1, h - 2, z1 + 1, k.a.accent, 0.6);
}
function community_college(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    k = CC[vr];
  lot(c, vr === 0 ? "sandDark" : "grass2");
  const cw = Math.min(W - 2, Math.max(18, Math.floor(W * 0.6))),
    cd = Math.min(9, Math.floor(D * 0.45));
  const x0 = X0 + 1,
    z0 = Z0 + 1;
  ccBar(c, x0, z0, x0 + cw, z0 + cd, 6);
  // glass entry pavilion + big CC sign + canopy
  const ex = x0 + Math.floor(cw / 2);
  v.box(ex - 3, 1, z0 + cd, ex + 3, 6, z0 + cd + 2, k.a.glass, 0.4);
  v.box(ex - 5, 6, z0 + cd - 1, ex + 5, 7, z0 + cd + 4, k.a.trim);
  v.box(ex - 2, 1, z0 + cd + 1, ex + 2, 4, z0 + cd + 2, "glassDark");
  v.box(X1 - 4, 1, z0 + cd + 3, X1 - 3, 5, z0 + cd + 4, "steelDark");
  v.box(X1 - 6, 5, z0 + cd + 3, X1 - 1, 8, z0 + cd + 4, k.a.accent, 0.8);
  // parking lot in front with cars + bus stop
  const pz = lv >= 3 ? Z1 - 6 : z0 + cd + 5;
  v.box(X0 + 1, 0, pz, X1 - 1, 1, Z1 - 1, "asphalt");
  for (let x = X0 + 2; x < X1 - 1; x += 4) v.box(x, 0, pz, x + 1, 1, pz + 2, "white");
  parkedCars(c, X0 + 1, X1 - 1, pz + 2);
  if (lv === 1) crowd(c, X0 + 1, z0 + cd + 2, X1 - 1, pz, 4, false);
  if (lv >= 2) {
    // evening classrooms — two storeys glowing warm
    const ex0 = x0 + cw + 1 <= X1 - 8 ? x0 + cw + 1 : X1 - 10;
    ccBar(c, ex0, z0, X1 - 1, z0 + Math.min(D - 8, cd + 6), 10, true);
    crowd(c, X0 + 1, z0 + cd + 2, X1 - 1, pz, 6, false);
  }
  if (lv >= 3) {
    const lw = 12,
      ld = 10,
      lx = X0 + Math.floor(W * 0.35),
      lz = Z0 + Math.floor(D * 0.42);
    library(c, lx, lz, lx + lw, lz + ld, lv >= 4 ? 18 : 14);
    v.box(lx - 4, 0, lz + ld + 2, lx + lw + 4, 1, lz + ld + 5, "concrete");
    bench(v, lx - 3, 1, lz + ld + 3);
  }
  if (lv >= 4) {
    // garden commons
    const gz0 = Z0 + Math.floor(D * 0.42);
    hedge(v, X0 + 2, gz0, X0 + 3, gz0 + 12, 1, 2);
    for (let i = 0; i < 3; i++) tree(v, X0 + 5 + i * 5, 1, gz0 + 3 + (i % 2) * 5, vr === 0 ? "palm" : "round", 1.3, i);
    flowerBed(c, X0 + 4, gz0 + 10, X0 + 14, gz0 + 12);
    truck(v, X1 - 6, 1, gz0 + 4, "z", "pink", "white");
    v.box(X1 - 8, 2, gz0 + 2, X1 - 7, 4, gz0 + 6, "warmGlow", 0.7);
    crowd(c, X0 + 3, gz0, X1 - 1, gz0 + 13, 10, false);
  }
  if (lv >= 5) {
    // community quad: amphitheatre, solar canopy over the lot, clock pylon
    const ax = X1 - 16,
      az = Z0 + Math.floor(D * 0.42) + 6;
    for (let s = 0; s < 4; s++) v.box(ax + s, 1, az + s, X1 - 2, 1 + (4 - s) * 0 + 1, az + s + 1, s % 2 ? "concrete" : k.a.wall2);
    for (let x = X0 + 2; x < X1 - 2; x += 8) v.box(x, 1, pz + 1, x + 1, 6, pz + 2, "steelDark");
    solarRow(v, X0 + 1, X1 - 1, 6, pz, 4);
    const px = X0 + Math.floor(W * 0.3);
    v.box(px, 1, Z0 + Math.floor(D * 0.42) - 3, px + 2, 18, Z0 + Math.floor(D * 0.42) - 1, k.a.trim);
    clock(v, px + 1, 15, Z0 + Math.floor(D * 0.42) - 1, "z", 1);
    v.box(px, 18, Z0 + Math.floor(D * 0.42) - 3, px + 2, 19, Z0 + Math.floor(D * 0.42) - 1, k.a.accent, 0.8);
  }
  if (vr === 2) {
    // sail canopies
    for (let i = 0; i < Math.min(3, lv); i++) {
      const sx = X0 + 3 + i * 8;
      for (let s = 0; s < 5; s++) v.box(sx + s, 6 - s + 2, z0 + cd + 3, sx + s + 1, 7 - s + 2, z0 + cd + 3 + 5 - s, "white");
      v.box(sx, 1, z0 + cd + 3, sx + 1, 8, z0 + cd + 4, "steelLight");
    }
  }
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 1, vr === 0 ? "terracotta" : "concrete", [ex - 3, ex + 3]);
}

// ---------------------------------------------------------------------------------------------
// UNIVERSITY — Limestone Gothic (pinnacles, slate, lancet windows) / Federal brick (Georgian brick,
// white portico & cupola) / Copper cloister (pale stone, verdigris roofs & spire) / Pacific stone
// (sandstone arcades, red tile, palms). Grows: founders hall → cloister arcade → clock tower →
// residential courts → enclosed collegiate quadrangle with chapel and library.
// ---------------------------------------------------------------------------------------------
const UNI: { a: Arch; roof: Roof; top: Top; tree: TreeKind }[] = [
  { a: { wall: "limestone", wall2: "marbleShade", roof: "slate", trim: "marble", glass: "glass", accent: "crimson" }, roof: "gable", top: "pinnacles", tree: "oak" },
  { a: { wall: "brick", wall2: "brickDark", roof: "slate", trim: "white", glass: "glass", accent: "blueDark" }, roof: "hip", top: "cupola", tree: "round" },
  { a: { wall: "cream", wall2: "limestone", roof: "tealDark", trim: "marble", glass: "glass", accent: "tealDark" }, roof: "gable", top: "spire", tree: "cypress" },
  { a: { wall: "sandDark", wall2: "sand", roof: "terracotta", trim: "cream", glass: "glass", accent: "terracotta" }, roof: "tile", top: "tile", tree: "palm" },
];
function gothicHall(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, axis: "x" | "z" = "x") {
  const v = c.v,
    u = UNI[c.variant];
  hall(c, x0, z0, x1, z1, h, u.a, u.roof === "gable" ? (axis === "x" ? "gable" : "gableZ") : u.roof, "tall");
  // buttresses / pilasters on the long faces
  if (axis === "x") for (let x = x0 + 2; x < x1 - 1; x += 4) v.box(x, 1, z1, x + 1, h - 1, z1 + 1, u.a.trim), v.box(x, 1, z0 - 1, x + 1, h - 1, z0, u.a.trim);
  else for (let z = z0 + 2; z < z1 - 1; z += 4) v.box(x1, 1, z, x1 + 1, h - 1, z + 1, u.a.trim), v.box(x0 - 1, 1, z, x0, h - 1, z + 1, u.a.trim);
  if (c.variant === 0)
    for (const [px, pz] of [
      [x0, z0],
      [x1 - 1, z0],
      [x0, z1 - 1],
      [x1 - 1, z1 - 1],
    ]) {
      v.box(px, h, pz, px + 1, h + 4, pz + 1, "marble");
      v.put(px, h + 4, pz, "gold");
    }
  if (c.variant === 3) for (let x = x0 + 1; x < x1 - 1; x += 3) v.box(x, 1, z1, x + 2, 5, z1 + 2, "cream"), v.box(x, 1, z1 + 1, x + 1, 4, z1 + 2, null);
  if (c.variant === 1 && axis === "x") {
    const cx = Math.floor((x0 + x1) / 2);
    for (let x = cx - 3; x <= cx + 3; x += 2) column(v, x, z1 + 1, 1, h, "white", "cream");
    v.box(cx - 4, h - 1, z1, cx + 5, h, z1 + 2, "white");
    for (let s = 0; s < 3; s++) v.box(cx - 4 + s * 2, h + s, z1 + 1, cx + 5 - s * 2, h + s + 1, z1 + 2, "white");
  }
}
function cloister(c: Ctx, x0: number, z0: number, x1: number, z1: number, sides: string) {
  const v = c.v,
    u = UNI[c.variant];
  const run = (fx: (p: number) => [number, number], from: number, to: number) => {
    for (let p = from; p < to; p++) {
      const [x, z] = fx(p);
      if ((p - from) % 3 === 0) v.box(x, 1, z, x + 1, 5, z + 1, u.a.trim);
      v.put(x, 5, z, u.a.wall);
      v.put(x, 4, z, (p - from) % 3 === 0 ? u.a.trim : u.a.wall2);
    }
  };
  if (sides.includes("w")) {
    run((p) => [x0, p], z0, z1);
    v.box(x0 - 2, 6, z0, x0 + 1, 7, z1, u.a.roof);
    v.box(x0 - 2, 1, z0, x0 - 1, 6, z1, u.a.wall);
  }
  if (sides.includes("e")) {
    run((p) => [x1 - 1, p], z0, z1);
    v.box(x1 - 1, 6, z0, x1 + 2, 7, z1, u.a.roof);
    v.box(x1 + 1, 1, z0, x1 + 2, 6, z1, u.a.wall);
  }
  if (sides.includes("s")) {
    run((p) => [p, z1 - 1], x0, x1);
    v.box(x0, 6, z1 - 1, x1, 7, z1 + 1, u.a.roof);
  }
}
function quadLawn(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  const v = c.v;
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) v.put(x, 0, z, (x + z) % 2 ? "grass" : "grass2");
  const w = x1 - x0,
    d = z1 - z0;
  for (let t = 0; t < 1; t += 0.5 / Math.max(w, d)) {
    v.put(Math.round(x0 + t * w), 0, Math.round(z0 + t * d), "path2");
    v.put(Math.round(x1 - 1 - t * w), 0, Math.round(z0 + t * d), "path2");
  }
  v.box(Math.floor((x0 + x1) / 2), 0, z0, Math.floor((x0 + x1) / 2) + 2, 1, z1, "path2");
}
function university(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    u = UNI[vr];
  lot(c, "grass3");
  const h = 11;
  if (lv <= 4) {
    const fw = Math.min(W - 4, lv >= 3 ? 24 : 26),
      fd = 9,
      fx0 = X0 + 2,
      fz0 = Z0 + 2,
      cx = fx0 + Math.floor(fw / 2);
    quadLawn(c, X0 + 1, fz0 + fd + 2, X1 - 1, Z1 - 1);
    gothicHall(c, fx0, fz0, fx0 + fw, fz0 + fd, h);
    // gatehouse turret at the centre of founders hall
    if (lv < 3) {
      v.box(cx - 2, 1, fz0 + fd - 2, cx + 3, h + 6, fz0 + fd + 1, u.a.wall);
      v.box(cx - 1, 1, fz0 + fd, cx + 2, 5, fz0 + fd + 1, "woodDark");
      clock(v, cx, h + 3, fz0 + fd + 1, "z", 1);
      if (vr === 0) for (let x = cx - 2; x < cx + 3; x += 2) v.put(x, h + 6, fz0 + fd - 2, "marble"), v.put(x, h + 6, fz0 + fd, "marble");
      else hip(v, cx - 3, h + 6, fz0 + fd - 3, cx + 4, fz0 + fd + 2, u.a.roof, u.a.trim);
    }
    if (lv >= 2) cloister(c, X0 + 3, fz0 + fd + 2, X1 - 3, Z1 - 3, lv >= 4 ? "" : "we");
    if (lv >= 3) clockTower(c, fx0 + fw + 1 <= X1 - 7 ? fx0 + fw + 1 : X1 - 7, fz0 - 1, 6, 30, u.a, u.top);
    if (lv >= 4) {
      // residential courts: dorm ranges down both sides with chimneys
      const dz0 = fz0 + fd + 3,
        dz1 = Z1 - 3;
      gothicHall(c, X0 + 2, dz0, X0 + 9, dz1, 9, "z");
      gothicHall(c, X1 - 9, dz0, X1 - 2, dz1, 9, "z");
      for (let z = dz0 + 2; z < dz1 - 1; z += 5) {
        v.box(X0 + 4, 12, z, X0 + 6, 17, z + 2, "brickDark");
        v.box(X1 - 6, 12, z, X1 - 4, 17, z + 2, "brickDark");
      }
      fountain(v, Math.floor((X0 + X1) / 2) + 1, 1, Math.floor((dz0 + dz1) / 2), 3, u.a.trim);
    }
    crowd(c, X0 + 3, fz0 + fd + 3, X1 - 3, Z1 - 2, 6 + lv * 2, false, ["crimson", "blueDark", "white", "charcoal", u.a.accent]);
    trees(c, [
      [X0 + 1, Z1 - 2],
      [X1 - 2, Z1 - 2],
    ], u.tree, 1.3);
  } else {
    // collegiate quadrangle: four ranges around a lawn, gate arch at the front
    const r = 8;
    quadLawn(c, X0 + r + 1, Z0 + r + 1, X1 - r - 1, Z1 - r - 1);
    gothicHall(c, X0 + 1, Z0 + 1, X1 - 1, Z0 + r, 13);
    gothicHall(c, X0 + 1, Z0 + r, X0 + r, Z1 - r, 11, "z");
    gothicHall(c, X1 - r, Z0 + r, X1 - 1, Z1 - r, 11, "z");
    const gx = Math.floor((X0 + X1) / 2);
    gothicHall(c, X0 + 1, Z1 - r, gx - 4, Z1 - 1, 10);
    gothicHall(c, gx + 4, Z1 - r, X1 - 1, Z1 - 1, 10);
    // gatehouse
    v.box(gx - 4, 1, Z1 - r - 1, gx + 4, 17, Z1 - 1, u.a.wall);
    v.box(gx - 2, 1, Z1 - r - 1, gx + 2, 8, Z1 - 1, null);
    for (let x = gx - 2; x < gx + 2; x++) v.put(x, 8, Z1 - 2, u.a.trim);
    for (let x = gx - 4; x < gx + 4; x += 2) v.put(x, 17, Z1 - 2, u.a.trim), v.put(x, 17, Z1 - r - 1, u.a.trim);
    clock(v, gx, 13, Z1 - 1, "z", 2);
    for (const px of [gx - 5, gx + 4]) {
      v.box(px, 1, Z1 - r - 1, px + 1, 19, Z1 - 1, u.a.trim);
      v.put(px, 19, Z1 - 4, "gold");
    }
    clockTower(c, X1 - r - 7, Z0 + r - 2, 7, 36, u.a, u.top);
    // chapel spire / library dome on the back range
    const lx = X0 + Math.floor(W * 0.3);
    if (vr === 1 || vr === 3) {
      cyl(v, lx, Z0 + 5, 13, 17, 4, u.a.trim);
      v.dome(lx, 17, Z0 + 5, 4, vr === 1 ? "white" : "terracotta");
      v.box(lx, 21, Z0 + 5, lx + 1, 24, Z0 + 6, "gold");
    } else spire(v, lx, Z0 + 5, 13, 22, 2.6, u.a.roof);
    fountain(v, gx + 1, 1, Math.floor((Z0 + Z1) / 2), 3, u.a.trim);
    crowd(c, X0 + r + 1, Z0 + r + 1, X1 - r - 1, Z1 - r - 1, 16, false, ["crimson", "blueDark", "white", "charcoal", u.a.accent]);
    trees(c, [
      [X0 + r + 3, Z0 + r + 3],
      [X1 - r - 4, Z0 + r + 3],
      [X0 + r + 3, Z1 - r - 4],
      [X1 - r - 4, Z1 - r - 4],
    ], u.tree, 1.4);
  }
  for (const [x, z] of [
    [X0 + 1, Z1 - 1],
    [X1 - 2, Z1 - 1],
  ])
    lamp(v, x, 1, z, 5);
  if (lv < 5) fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 2, "iron", [-3, 3]);
}

// ---------------------------------------------------------------------------------------------
// RESEARCH UNIVERSITY — Ocean institute (white & teal, wave roof, aquarium) / Alpine sciences
// (stone & timber, steep snowy roofs, pines) / Photon lab (dark glass, cyan light bands,
// synchrotron) / Desert observatory (adobe, white domes, cacti). Grows: glass lab → cleanroom →
// rotating research telescope dome → instrument tower & skybridge → discovery campus with a
// synchrotron ring and twin domes.
// ---------------------------------------------------------------------------------------------
const RU: { a: Arch; dome: string; tree: TreeKind }[] = [
  { a: { wall: "white", wall2: "teal", roof: "white", trim: "teal", glass: "sky", accent: "teal" }, dome: "white", tree: "palm" },
  { a: { wall: "stone", wall2: "woodDark", roof: "charcoal", trim: "woodDark", glass: "glass", accent: "red" }, dome: "silver", tree: "pine" },
  { a: { wall: "charcoal", wall2: "black", roof: "black", trim: "screenCyan", glass: "glassDark", accent: "screenCyan" }, dome: "steelLight", tree: "birch" },
  { a: { wall: "sand", wall2: "sandDark", roof: "sandDark", trim: "terracotta", glass: "glass", accent: "orange" }, dome: "white", tree: "palm" },
];
function labBlock(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number) {
  const v = c.v,
    r = RU[c.variant],
    vr = c.variant;
  if (vr === 0) {
    curtainWall(c, x0, 1, z0, x1, h, z1, "sky", "white", 3, 4);
    // wave roof
    for (let x = x0 - 1; x <= x1; x++) {
      const y = h + Math.round(Math.sin((x - x0) / 3) * 1.5 + 1.5);
      v.box(x, h, z0 - 1, x + 1, y + 1, z1 + 1, "white");
      v.box(x, y, z0 - 1, x + 1, y + 1, z1 + 1, x % 4 ? "white" : "teal");
    }
  } else if (vr === 1) {
    hall(c, x0, z0, x1, z1, h, r.a, "gable", "punch");
    const rise = Math.ceil((z1 - z0 + 2) / 2);
    for (let k = Math.floor(rise / 2); k < rise; k++) {
      v.box(x0 - 1, h + k, z0 - 1 + k, x1 + 1, h + k + 1, z0 + k, "snow");
      v.box(x0 - 1, h + k, z1 - k, x1 + 1, h + k + 1, z1 + 1 - k, "snow");
    }
    v.box(x0, 1, z1 - 1, x1, 4, z1, "stone");
  } else if (vr === 2) {
    curtainWall(c, x0, 1, z0, x1, h, z1, "glassDark", "charcoal", 3, 4);
    for (let y = 4; y < h; y += 4) v.box(x0, y, z1 - 1, x1, y + 1, z1, "screenCyan", 1.1), v.box(x1 - 1, y, z0, x1, y + 1, z1, "screenCyan", 1.1);
    v.box(x0, h, z0, x1, h + 1, z1, "black");
  } else {
    hall(c, x0, z0, x1, z1, h, r.a, "none", "punch");
    for (let s = 0; s < 2; s++) v.box(x0 + 2 + s * 2, h + s * 3, z0 + 1 + s, x1 - 2 - s * 4, h + 3 + s * 3, z1 - 2 - s, r.a.wall);
    for (let x = x0 + 1; x < x1; x += 3) v.put(x, h - 2, z1, "woodDark");
  }
  // fume stacks
  for (let x = x0 + 2; x < x1 - 2; x += 5) {
    v.box(x, h, z0 + 1, x + 1, h + 5, z0 + 2, "steelLight");
    v.put(x, h + 5, z0 + 1, "steelDark");
  }
}
function research_university(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    r = RU[vr];
  lot(c, vr === 3 ? "sandDark" : vr === 1 ? "grass3" : "grass2");
  const lw = Math.min(16, Math.floor(W * 0.55)),
    ld = Math.min(11, Math.floor(D * 0.42));
  const lx0 = X0 + 1,
    lz0 = Z0 + 1;
  labBlock(c, lx0, lz0, lx0 + lw, lz0 + ld, 13);
  if (vr >= 2) v.dome(lx0 + lw - 4, vr === 3 ? 16 : 14, lz0 + Math.floor(ld / 2), 2.6, r.dome);
  entry(v, lx0 + Math.floor(lw / 2), lz0 + ld, "glass", r.a.trim, 4);
  // lawn & paths with students on bikes
  const qz = lz0 + ld + 2;
  v.box(X0 + 1, 0, qz, X1 - 1, 1, Z1 - 1, vr === 3 ? "sand" : "grass");
  path(v, lx0 + Math.floor(lw / 2) - 1, lz0 + ld, lx0 + Math.floor(lw / 2) + 2, Z1 + 1, vr === 3 ? "terracotta" : "concrete");
  bikes(v, lx0 + Math.floor(lw / 2) + 3, qz + 1, 4);
  crowd(c, X0 + 1, qz, X1 - 1, Z1 - 1, 4 + lv * 2, false, ["white", "teal", "sky", "orange", "charcoal"]);
  if (lv >= 2) {
    // cleanroom: windowless white box, HVAC skid and steam
    const cx0 = lx0 + lw + 2,
      cx1 = Math.min(X1 - 1, cx0 + 11),
      cz1 = lz0 + Math.min(ld, 9);
    v.hollowBox(cx0, 1, lz0, cx1, 9, cz1, vr === 2 ? "steelLight" : "white");
    v.box(cx0, 8, lz0, cx1, 9, cz1, r.a.trim);
    v.box(cx0 + 1, 1, cz1 - 1, cx0 + 3, 4, cz1, "glassDark");
    for (let x = cx0 + 1; x < cx1 - 2; x += 3) acUnit(v, x, 9, lz0 + 1 + ((x >> 1) % 3));
    v.box(cx0 - 2, 6, lz0 + 3, cx0, 7, lz0 + 5, "silver");
    c.smoke(cx1 - 2, 10, lz0 + 2, "steam");
    v.box(cx0 + 4, 3, cz1 - 1, cx1 - 1, 4, cz1, r.a.accent, 0.8);
  }
  if (lv >= 3) {
    const ox = X1 - 9,
      oz = qz + 6;
    observatory(c, ox, oz, 6, 9, vr === 2 ? "charcoal" : vr === 1 ? "stone" : r.a.wall, r.dome, 0.12);
    path(v, ox - 1, oz + 6, ox + 1, Z1 - 1, vr === 3 ? "terracotta" : "concrete");
  }
  if (lv >= 4) {
    // instrument tower with skybridge and antenna crown
    const tx = X0 + 2,
      tz = qz + 2,
      th = 30;
    if (vr === 1) {
      v.hollowBox(tx, 1, tz, tx + 7, th, tz + 7, "stone");
      windows(c, tx, 1, tz, tx + 7, th, tz + 7, { col: "glass", emit: 0.5, stepV: 4 });
      hip(v, tx - 1, th, tz - 1, tx + 8, tz + 8, "charcoal");
    } else {
      curtainWall(c, tx, 1, tz, tx + 7, th, tz + 7, vr === 2 ? "glassDark" : r.a.glass, vr === 2 ? "screenCyan" : r.a.trim, 3, 4);
      v.box(tx - 1, th, tz - 1, tx + 8, th + 1, tz + 8, r.a.trim);
    }
    mast(c, tx + 3, tz + 3, th + 10);
    v.box(tx + 7, 14, tz + 2, lx0 + lw + 6, 17, tz + 5, vr === 2 ? "glassDark" : "glass", 0.3);
    v.box(tx + 7, 13, tz + 2, lx0 + lw + 6, 14, tz + 5, r.a.trim);
    // glass lecture rotunda with a living roof
    const rx = lv >= 5 ? X0 + 14 : X0 + Math.floor(W * 0.45),
      rz = Z1 - 10;
    cyl(v, rx, rz, 1, 8, 5, vr === 2 ? "glassDark" : "glass", 0.3);
    ring(v, rx, rz, 1, 8, 5, 4.2, vr === 2 ? "glassDark" : r.a.glass, 0.35);
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      v.box(Math.round(rx + Math.cos(t) * 4.6 - 0.5), 1, Math.round(rz + Math.sin(t) * 4.6 - 0.5), Math.round(rx + Math.cos(t) * 4.6 - 0.5) + 1, 8, Math.round(rz + Math.sin(t) * 4.6 - 0.5) + 1, r.a.trim);
    }
    cyl(v, rx, rz, 8, 9, 6, r.a.trim);
    cyl(v, rx, rz, 9, 10, 5, vr === 3 ? "sandDark" : "moss");
    crowd(c, rx - 7, rz - 7, rx + 7, rz + 7, 6, false, ["white", "teal", "orange"]);
    for (let z = qz + 2; z < Z1 - 2; z += 6) tree(v, lx0 + Math.floor(lw / 2) + 3, 1, z, r.tree, 1, z);
  }
  if (lv >= 5) {
    // synchrotron ring + twin domes + lab range
    const sx = Math.floor((X0 + X1) / 2) + 4,
      sz = Z1 - 12,
      R = 10;
    ring(v, sx, sz, 1, 4, R, R - 2.5, vr === 2 ? "steelLight" : "concrete");
    ring(v, sx, sz, 4, 5, R, R - 2.5, vr === 2 ? "screenCyan" : r.a.trim, vr === 2 ? 1 : 0.3);
    cyl(v, sx, sz, 0, 1, R - 3, "grass");
    v.box(sx - 2, 1, sz - 2, sx + 3, 6, sz + 3, r.a.wall);
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      const bx = Math.round(sx + Math.cos(t) * (R + 2)),
        bz = Math.round(sz + Math.sin(t) * (R + 2));
      v.box(bx - 1, 1, bz - 1, bx + 1, 3, bz + 1, "steelLight");
    }
    observatory(c, X1 - 6, Z0 + 6, 4, 10, r.a.wall, r.dome, -0.1);
    labBlock(c, Math.max(lx0 + lw + 15, Math.floor((X0 + X1) / 2) + 2), Z0 + 1, X1 - 12, Z0 + 10, 11);
  }
  trees(c, [
    [X1 - 2, Z1 - 2],
    [X0 + 1, Z1 - 2],
  ], r.tree, 1.2);
  if (vr === 3) for (let i = 0; i < lv; i++) v.box(X0 + 4 + i * 5, 1, Z1 - 3, X0 + 5 + i * 5, 5, Z1 - 2, "leafDark"), v.put(X0 + 5 + i * 5, 3, Z1 - 3, "leafDark");
  if (vr === 0) {
    v.box(X1 - 8, 1, Z1 - 5, X1 - 2, 4, Z1 - 2, "cyan", 0.3);
    v.box(X1 - 7, 1, Z1 - 4, X1 - 3, 3, Z1 - 3, "blueDark");
  }
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 1, r.a.trim === "screenCyan" ? "charcoal" : r.a.trim, [-3, 3]);
}

// ---------------------------------------------------------------------------------------------
// SPORTS FIELD — Soccer green (striped pitch, nets) / Gridiron (yard lines, end zones, goalposts)
// / Red clay (baseball diamond, clay infield, backstop) / Blue track (blue athletics oval, jumps).
// Grows: practice pitch → bleachers & scoreboard → running oval → covered grandstand with
// floodlights → enclosed championship bowl with video screen and roofed stands.
// ---------------------------------------------------------------------------------------------
const SPORT: { s: Sport; track: string; seat: string; roof: string }[] = [
  { s: "soccer", track: "terracotta", seat: "leafDark", roof: "white" },
  { s: "gridiron", track: "brickDark", seat: "crimson", roof: "silver" },
  { s: "baseball", track: "terracotta", seat: "blueDark", roof: "white" },
  { s: "athletics", track: "blue", seat: "sky", roof: "white" },
];
function sports_field(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    s = SPORT[vr];
  lot(c, "grass2");
  const back = lv >= 2 ? (lv >= 4 ? 8 : 4) : 1;
  const front = lv >= 5 ? 6 : 1;
  const side = lv >= 5 ? 7 : 1;
  const fx0 = X0 + side,
    fx1 = X1 - side,
    fz0 = Z0 + back,
    fz1 = Z1 - front;
  if (lv >= 3) {
    const f = track(c.v, fx0, fz0, fx1, fz1, s.track, vr === 3 ? 4 : 3);
    field(c.v, f.fx0, f.fz0, f.fx1, f.fz1, s.s, vr === 1 ? "crimson" : "red");
  } else field(c.v, fx0 + 1, fz0 + 1, fx1 - 1, fz1 - 1, s.s, vr === 1 ? "crimson" : "red");
  if (lv === 1) {
    // practice gear: cones, ball bag, bench and shed
    for (let i = 0; i < 4; i++) v.put(fx0 + 6 + i * 3, 1, fz0 + 3, "orange");
    bench(v, X1 - 6, 1, Z1 - 1);
    v.box(X0 + 1, 1, Z0 + 1, X0 + 5, 4, Z0 + 4, "wood");
    gable(v, X0, 4, Z0, X0 + 6, Z0 + 5, "x", "redDark");
    crowd(c, fx0 + 2, fz0 + 2, fx1 - 2, fz1 - 2, 5, true, ["red", "blue"]);
  }
  if (lv >= 2) {
    stand(c, X0 + Math.floor(W * 0.25), X1 - Math.floor(W * 0.25), fz0 - 1, Math.min(back, lv >= 4 ? 6 : 3), -1, s.seat, lv >= 4 ? s.roof : undefined, 0.3 + lv * 0.08);
    if (lv < 5) scoreboard(v, X0 + 2, Z0 + 1, 8, 4 + lv, s.seat);
    flag(v, X1 - 3, 1, Z0 + 1, 9 + lv, [s.seat, "white"]);
    crowd(c, fx0 + 3, fz0 + 2, fx1 - 3, fz1 - 2, 8, false, [s.seat, "white"]);
    bench(v, Math.floor((X0 + X1) / 2) - 6, 1, Z1 - 1);
    bench(v, Math.floor((X0 + X1) / 2) + 3, 1, Z1 - 1);
  }
  if (lv >= 4) {
    const fl = lv >= 5 ? 24 : 18;
    for (const [x, z] of [
      [X0 + 1, Z0 + 1],
      [X1 - 2, Z0 + 1],
      [X0 + 1, Z1 - 2],
      [X1 - 2, Z1 - 2],
    ])
      flood(c, x, z, fl);
    // team rooms behind the grandstand
    v.box(X0 + Math.floor(W * 0.25), 1, Z0 + 1, X1 - Math.floor(W * 0.25), 3, Z0 + 2, "concrete");
  }
  if (lv >= 5) {
    // championship bowl: stands on the sides and front ends + video screen
    for (const [x0, x1] of [
      [X0 + 1, X0 + side],
      [X1 - side + 1, X1 - 1],
    ]) {
      for (let i = 0; i < side - 1; i++) {
        const xx = x0 < 0 ? fx0 - 1 - i : fx1 + i;
        v.box(xx, 1, Z0 + 2, xx + 1, i + 2, Z1 - 2, i % 2 ? "steelLight" : s.seat);
        for (let z = Z0 + 2; z < Z1 - 2; z++) if (c.rand() < 0.5) v.put(xx, i + 2, z, c.pick(SHIRTS)), v.put(xx, i + 3, z, c.pick(SKIN));
      }
      void x1;
    }
    stand(c, fx0, fx1, fz1, 3, 1, s.seat, undefined, 0.6);
    const sx = Math.floor((X0 + X1) / 2) - 7;
    v.box(sx, 14, Z0 + 1, sx + 14, 22, Z0 + 2, "charcoal");
    v.box(sx + 1, 15, Z0 + 2, sx + 13, 21, Z0 + 3, "screenCyan", 0.9);
    v.box(sx + 4, 17, Z0 + 3, sx + 10, 19, Z0 + 3 + 1, s.seat, 0.6);
    for (const px of [sx + 1, sx + 12]) v.box(px, 1, Z0 + 1, px + 1, 14, Z0 + 2, "steelDark");
    for (let x = X0 + 2; x < X1 - 2; x += 6) flag(v, x, 13, Z1 - 2, 3, [x % 12 ? s.seat : "white", "white"]);
  }
  if (lv < 5) fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 2, "#9aa3ad", [-3, 3]);
}

// ---------------------------------------------------------------------------------------------
// RESEARCH INSTITUTE — Geosciences (ochre labs, drill rig, core racks, seismograph) / Astronomy
// (white labs, big radio dish) / Photonics (black glass cube, laser beams) / Atmospheric (radar
// dome, met mast, weather balloon). Gated science compound: no students, scientists in white.
// Grows: instrument lab → glass atrium → observatory instrument → survey array of rotating
// dishes & masts → national laboratory with a giant radio telescope.
// ---------------------------------------------------------------------------------------------
const RI: Arch[] = [
  { wall: "#c98b4a", wall2: "terracotta", roof: "concreteDark", trim: "cream", glass: "glass", accent: "orange" },
  { wall: "white", wall2: "steelLight", roof: "concreteDark", trim: "blueDark", glass: "glass", accent: "blueDark" },
  { wall: "charcoal", wall2: "black", roof: "black", trim: "magenta", glass: "glassDark", accent: "magenta" },
  { wall: "steelLight", wall2: "sky", roof: "concreteDark", trim: "white", glass: "sky", accent: "sky" },
];
function signature(c: Ctx, x: number, z: number, big: boolean) {
  const v = c.v,
    vr = c.variant;
  if (vr === 0) {
    // drilling rig derrick + core sample racks
    const h = big ? 26 : 18;
    for (let y = 1; y < h; y++) {
      const k = Math.floor(((h - y) / h) * 3);
      for (const [dx, dz] of [
        [-k, -k],
        [k, -k],
        [-k, k],
        [k, k],
      ])
        v.put(x + dx, y, z + dz, "hazard");
      if (y % 4 === 0) {
        v.box(x - k, y, z - k, x + k + 1, y + 1, z - k + 1, "steelDark");
        v.box(x - k, y, z + k, x + k + 1, y + 1, z + k + 1, "steelDark");
      }
    }
    v.box(x - 3, 1, z - 3, x + 4, 2, z + 4, "concrete");
    c.blink(x, h, z, "red");
    for (let i = 0; i < 3; i++) v.box(x + 5, 1 + i, z - 2, x + 12, 2 + i, z - 1, ["sandDark", "terracotta", "stone"][i]);
  } else if (vr === 1) {
    dish(c, x, z, big ? 9 : 6, big ? 8 : 5, "white", 0.12);
  } else if (vr === 2) {
    // laser tower firing a beam into the sky
    v.box(x - 2, 1, z - 2, x + 3, big ? 16 : 11, z + 3, "charcoal");
    v.box(x - 1, big ? 16 : 11, z - 1, x + 2, big ? 18 : 13, z + 2, "magenta", 1.2);
    v.box(x, big ? 18 : 13, z, x + 1, big ? 40 : 28, z + 1, "lime", 1.6);
    c.blink(x, big ? 40 : 28, z, "lime");
    for (let k = -2; k <= 2; k += 4) v.box(x - 2, 4, z + 3, x + 3, 5, z + 4 + 0 * k, "magenta", 1.1);
  } else {
    // radar dome on a tower + weather balloon on a tether
    const h = big ? 14 : 9;
    v.box(x - 2, 1, z - 2, x + 3, h, z + 3, "white");
    for (let y = 3; y < h; y += 3) v.box(x - 2, y, z - 2, x + 3, y + 1, z + 3, "steelLight");
    v.sphere(x + 0.5, h + 3, z + 0.5, 4, 4, 4, "white");
    c.blink(x, h + 7, z, "red");
    const bx = x + 7,
      bz = z + 3;
    for (let y = 1; y < (big ? 22 : 16); y++) v.put(bx, y, bz, "silver");
    v.sphere(bx + 0.5, (big ? 24 : 18) + 0.5, bz + 0.5, 2, 2.5, 2, "white");
  }
}
function research_institute(c: Ctx) {
  const { v, lv, variant: vr } = c,
    { X0, X1, Z0, Z1, W, D } = bnd(c),
    a = RI[vr];
  lot(c, vr === 0 ? "sandDark" : "grass3");
  v.box(X0 + 1, 0, Z1 - 4, X1 - 1, 1, Z1 - 1, "asphalt");
  const lw = Math.min(lv >= 3 ? 16 : 18, Math.floor(W * 0.58)),
    ld = Math.min(9, Math.floor(D * 0.5));
  const x0 = X0 + 1,
    z0 = Z0 + 1;
  if (vr === 2) {
    curtainWall(c, x0, 1, z0, x0 + lw, 9, z0 + ld, "glassDark", "charcoal", 2, 4);
    v.box(x0, 4, z0 + ld - 1, x0 + lw, 5, z0 + ld, "magenta", 1.2);
    v.box(x0, 9, z0, x0 + lw, 10, z0 + ld, "black");
  } else hall(c, x0, z0, x0 + lw, z0 + ld, 8, a, "flat", "ribbon");
  entry(v, x0 + 4, z0 + ld, "glass", a.trim);
  // rooftop instruments
  const my = vr === 2 ? 10 : 9;
  v.box(x0 + lw - 3, my, z0 + 2, x0 + lw - 2, my + 6, z0 + 3, "steelDark");
  const an = new PixelVox();
  an.box(-2, 0, -1, 2, 1, 0, "silver");
  an.box(-1, 0, -2, 0, 1, 2, "silver");
  an.put(1, 1, -1, "red");
  an.put(-2, 1, -1, "red");
  c.addRotor({ vox: an, pivot: [x0 + lw - 3, my + 6, z0 + 2], axis: "y", speed: 2, wind: true });
  if (lv <= 2) {
    v.box(x0 + 3, my, z0 + 2, x0 + 4, my + 2, z0 + 3, "steelDark");
    dish(c, x0 + 7, z0 + 4, 2, my + 1, "white", 0.4);
  }
  person(v, x0 + 6, 1, z0 + ld + 1, "white", "charcoal");
  person(v, x0 + 8, 1, z0 + ld + 2, "white", "blueDark");
  car(v, X1 - 5, 1, Z1 - 2, "x", "white");
  if (lv >= 2) {
    // glass atrium entrance with flagpoles
    const ax = x0 + lw,
      ax1 = Math.min(X1 - 2, ax + 8);
    curtainWall(c, ax, 1, z0 + 1, ax1, 11, z0 + ld + 2, a.glass, a.trim, 2, 5);
    v.box(ax - 1, 11, z0, ax1 + 1, 12, z0 + ld + 3, a.trim);
    tree(v, ax + 3, 1, z0 + 4, "round", 0.9);
    for (let i = 0; i < 3; i++) flag(v, ax + 1 + i * 3 < X1 - 2 ? ax + 1 + i * 3 : X1 - 3, 1, z0 + ld + 4, 8, [a.accent, "white"]);
  }
  if (lv >= 3) signature(c, lv >= 5 ? X0 + 9 : X1 - 8, lv >= 5 ? Z1 - 15 : Z1 - 10, lv >= 5);
  if (lv >= 4) {
    // survey array: rows of small rotating dishes / antenna masts
    const sx0 = X0 + Math.floor(W * (lv >= 5 ? 0.5 : 0.04)),
      sz = Z0 + ld + 4;
    for (let i = 0; i < 4; i++) {
      const x = sx0 + i * 6;
      if (x > X1 - 4) break;
      if (i % 2 === 0) dish(c, x, sz + 2, 2.5, 4, vr === 2 ? "steelLight" : "white", 0.25 + i * 0.05);
      else mast(c, x, sz + 2, 14);
    }
    for (let x = sx0; x < Math.min(X1 - 2, sx0 + 22); x += 2) v.put(x, 1, sz + 6, "steelDark");
  }
  if (lv >= 5) {
    // national lab: second lab range, helipad, giant dish for every style
    hall(c, X1 - 16, Z0 + 1, X1 - 1, Z0 + 10, 10, a, "flat", "ribbon");
    if (vr !== 1) dish(c, X1 - 8, Z1 - 12, 7, 6, vr === 2 ? "steelLight" : "white", 0.1);
    else dish(c, X1 - 8, Z1 - 12, 4, 4, "white", -0.2);
    parkedCars(c, X0 + 1, X0 + Math.floor(W * 0.5), Z1 - 3);
  }
  fence(v, -c.hx, -c.hz, c.hx, c.hz, 1, 3, "silver", [X1 - 10, X1 - 2]);
  v.box(X1 - 12, 1, Z1 - 1, X1 - 10, 4, Z1, "white");
  v.box(X1 - 11, 3, Z1 - 1, X1 - 3, 4, Z1, "red");
}

// ---------------------------------------------------------------------------------------------
const BUILDERS: Record<string, (c: Ctx) => void> = {
  preschool,
  country_schoolhouse,
  elementary_school,
  middle_school,
  high_school,
  trade_school,
  community_college,
  university,
  research_university,
  sports_field,
  research_institute,
};
defineDesigns(
  Object.fromEntries(
    Object.entries(BUILDERS).map(([id, build]) => [
      id,
      { ...CAMPUS_FARM_ART[id], growth: CAMPUS_FARM_ART[id].levels.join(" → "), build },
    ]),
  ),
);
