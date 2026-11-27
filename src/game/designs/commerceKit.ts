/**
 * Sculpting helpers for the commercial overhaul: rasterize a shape function into a box
 * (shell only, so giant shoes and cakes stay light), a 3×5 neon pixel font, spinning parts,
 * crowds, string lights and a few shared street props.
 *
 * Coordinates follow kit.ts: voxels, +z is the street front, box ranges are half-open.
 */
import { PixelVox, type Ctx, person } from "./kit";

export type Fill = string | [string, number] | null | undefined;

/**
 * Rasterize f over [x0,x1)×[y0,y1)×[z0,z1). f gets normalized voxel-centre coordinates
 * u (x), h (y), w (z) in 0..1 plus the integer voxel. Only voxels with an empty
 * 6-neighbour are written, so solid sculptures cost their surface, not their volume.
 */
export function sculpt(
  v: PixelVox,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  f: (u: number, h: number, w: number, x: number, y: number, z: number) => Fill,
): void {
  const nx = x1 - x0, ny = y1 - y0, nz = z1 - z0;
  if (nx <= 0 || ny <= 0 || nz <= 0) return;
  const grid: Fill[] = new Array(nx * ny * nz);
  const at = (i: number, j: number, k: number) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? null : grid[(i * ny + j) * nz + k]);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    grid[(i * ny + j) * nz + k] = f((i + 0.5) / nx, (j + 0.5) / ny, (k + 0.5) / nz, x0 + i, y0 + j, z0 + k);
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const g = grid[(i * ny + j) * nz + k];
    if (!g) continue;
    if (at(i - 1, j, k) && at(i + 1, j, k) && at(i, j - 1, k) && at(i, j + 1, k) && at(i, j, k - 1) && at(i, j, k + 1)) continue;
    if (typeof g === "string") v.put(x0 + i, y0 + j, z0 + k, g);
    else v.put(x0 + i, y0 + j, z0 + k, g[0], g[1]);
  }
}

export const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** A disc / ring / cylinder about a vertical axis. */
export function disc(v: PixelVox, cx: number, cz: number, y0: number, y1: number, r: number, col: string | ((x: number, y: number, z: number, d: number, a: number) => Fill), rIn = -1): void {
  for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
    if (d > r || d < rIn) continue;
    for (let y = y0; y < y1; y++) {
      const c = typeof col === "string" ? col : col(x, y, z, d, Math.atan2(z + 0.5 - cz, x + 0.5 - cx));
      if (!c) continue;
      if (typeof c === "string") v.put(x, y, z, c);
      else v.put(x, y, z, c[0], c[1]);
    }
  }
}

/** Add an independently spinning part. Build it with coordinates relative to the pivot. */
export function spinner(c: Ctx, x: number, y: number, z: number, axis: "x" | "y" | "z", speed: number): PixelVox {
  const vox = new PixelVox(c.v.seed + 17);
  c.addRotor({ vox, pivot: [x, y, z], axis, speed });
  return vox;
}

// ---------------------------------------------------------------------------------------------
// 3×5 pixel font for neon signs
// ---------------------------------------------------------------------------------------------
const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111",
  V: "101101101101010", W: "101101111111101", Y: "101101010010010", Z: "111001010100111",
  "!": "010010010000010", "★": "010111010101000", "♥": "000101111111010", " ": "000000000000000",
};

/**
 * Write neon text. `along` is the axis the letters advance on; letters are drawn on the
 * plane at `at` (z for "x", x for "z"), reading correctly from the +z / +x side.
 * `vertical` stacks the letters top-to-bottom (blade signs).
 */
export function neon(v: PixelVox, text: string, a0: number, y0: number, at: number, col: string, o: { along?: "x" | "z"; emit?: number; scale?: number; vertical?: boolean; back?: string } = {}): { w: number; h: number } {
  const along = o.along ?? "x";
  const s = o.scale ?? 1;
  const emit = o.emit ?? 1.1;
  const chars = [...text.toUpperCase()];
  const put = (a: number, y: number, col2: string, e: number) => {
    if (along === "x") v.put(a, y, at, col2, e);
    else v.put(at, y, -a, col2, e); // reads left→right when seen from +x
  };
  chars.forEach((ch, i) => {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    const ox = o.vertical ? 0 : i * 4 * s;
    const oy = o.vertical ? (chars.length - 1 - i) * 6 * s : 0;
    for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) {
      const on = g[r * 3 + cc] === "1";
      for (let sx = 0; sx < s; sx++) for (let sy = 0; sy < s; sy++) {
        const ax = a0 + ox + cc * s + sx;
        const ay = y0 + oy + (4 - r) * s + sy;
        if (on) put(ax, ay, col, emit);
        else if (o.back) put(ax, ay, o.back, 0);
      }
    }
  });
  const w = o.vertical ? 3 * s : chars.length * 4 * s - s;
  const h = o.vertical ? chars.length * 6 * s - s : 5 * s;
  return { w, h };
}

/** Width in voxels of a horizontal neon string. */
export const neonWidth = (text: string, s = 1) => [...text].length * 4 * s - s;

// ---------------------------------------------------------------------------------------------
// People and street props
// ---------------------------------------------------------------------------------------------
const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "white", "lime"];
const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];

export function crowd(c: Ctx, n: number, x0: number, z0: number, x1: number, z1: number, y = 1): void {
  for (let i = 0; i < n; i++) {
    const x = c.ri(x0, x1 - 1), z = c.ri(z0, z1 - 1);
    person(c.v, x, y, z, c.pick(SHIRTS), c.pick(["blueDark", "charcoal", "woodDark", "black"]), c.pick(SKIN));
  }
}

/** Festoon of alternating bulbs between two points at height y (sags in the middle). */
export function bulbs(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y: number, cols = ["#ffd27a", "#ff7a7a", "#8ad8ff", "#b6ff8a"]): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const sag = Math.round(Math.sin(t * Math.PI) * Math.min(2, n / 8));
    v.put(Math.round(x0 + (x1 - x0) * t), y - sag, Math.round(z0 + (z1 - z0) * t), i % 2 ? "charcoal" : cols[(i >> 1) % cols.length], i % 2 ? 0 : 1.1);
  }
}

/** Marquee bulbs around a rectangle on the plane z (chasing lights). */
export function bulbFrame(v: PixelVox, x0: number, x1: number, y0: number, y1: number, z: number, col = "#ffe08a"): void {
  for (let x = x0; x < x1; x++) for (const y of [y0, y1 - 1]) v.put(x, y, z, (x + y) % 2 ? col : "#fff6d0", 1.2);
  for (let y = y0; y < y1; y++) for (const x of [x0, x1 - 1]) v.put(x, y, z, (x + y) % 2 ? col : "#fff6d0", 1.2);
}

/** Lit glass shopfront on the plane z with mullions every `step`. */
export function glassFront(v: PixelVox, x0: number, x1: number, y0: number, y1: number, z: number, frame = "charcoal", step = 4, glow = "#ffe1a6"): void {
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    const mull = (x - x0) % step === 0 || x === x1 - 1 || y === y1 - 1;
    v.put(x, y, z, mull ? frame : glow, mull ? 0 : 0.6);
  }
}

/** A small round café table with two people. */
export function cafeTable(c: Ctx, x: number, z: number, top = "white", y = 1): void {
  c.v.put(x, y, z, "iron");
  c.v.put(x, y + 1, z, top);
  person(c.v, x - 1, y, z, c.pick(SHIRTS), "blueDark", c.pick(SKIN));
  person(c.v, x + 1, y, z, c.pick(SHIRTS), "charcoal", c.pick(SKIN));
}

/** Umbrella (striped canopy) over a table. */
export function umbrella(v: PixelVox, x: number, z: number, a = "red", b = "white", y = 1, h = 4): void {
  v.box(x, y, z, x + 1, y + h, z + 1, "white");
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.abs(dx) + Math.abs(dz) > 3) continue;
    v.put(x + dx, y + h, z + dz, (dx + dz) & 1 ? a : b);
  }
  v.put(x, y + h + 1, z, a);
}

/** A tiny band: drummer, bassist and horn player standing on y. */
export function band(v: PixelVox, x: number, z: number, y: number, horn = "gold"): void {
  // drum kit
  v.box(x, y, z, x + 2, y + 1, z + 2, "white");
  v.put(x, y + 1, z, "#c0c0c0");
  person(v, x + 1, y, z - 1, "black", "charcoal", "#8d5a3b");
  // upright bass
  person(v, x + 3, y, z, "#7c2d12", "black", "#e8b38f");
  v.box(x + 4, y, z, x + 5, y + 3, z + 1, "#8a4b22");
  v.put(x + 4, y + 3, z, "woodDark");
  // horn
  person(v, x - 2, y, z + 1, "#1f3a68", "black", "#c68a62");
  v.put(x - 2, y + 2, z + 2, horn, 0.3);
  v.put(x - 3, y + 1, z + 2, horn, 0.3);
  // musical spark
  v.put(x + 1, y + 4, z + 1, "#ffd27a", 1.0);
}

/** Classic car with chrome bumpers. */
export function classicCar(v: PixelVox, x: number, z: number, axis: "x" | "z", body: string, y = 1): void {
  const L = 6, W = 3;
  const bx = axis === "x" ? L : W, bz = axis === "x" ? W : L;
  v.box(x, y, z, x + bx, y + 1, z + bz, body);
  if (axis === "x") v.box(x + 2, y + 1, z, x + 5, y + 2, z + bz, "#cfe6ff", 0.15);
  else v.box(x, y + 1, z + 2, x + bx, y + 2, z + 5, "#cfe6ff", 0.15);
  v.put(x, y, z, "chrome");
  v.put(x + bx - 1, y, z + bz - 1, "chrome");
}

/** Palm tree (simple). */
export function palm(v: PixelVox, x: number, z: number, y = 1, h = 9): void {
  for (let i = 0; i < h; i++) v.put(x + (i > h / 2 ? 1 : 0), y + i, z, "#9b7653");
  const tx = x + 1, ty = y + h;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    for (let k = 1; k <= 3; k++) v.put(tx + dx * k, ty - (k > 2 ? 1 : 0), z + dz * k, k === 3 ? "leafDark" : "leaf");
  }
  v.put(tx, ty, z, "leafDark");
}
