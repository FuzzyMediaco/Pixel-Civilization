import {
  type Ctx,
  PixelVox,
  bench,
  bush,
  car,
  chimney,
  column,
  helipad,
  ring,
  door,
  flag,
  fence,
  flatRoof,
  flowerBed,
  gable,
  hedge,
  hip,
  lot,
  person,
  pool,
  speckle,
  tree,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";
import { packVoxKey } from "../voxelCore";

// =============================================================================================
// Shared little helpers for the housing category
// =============================================================================================

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "white", "lime", "sky"];
const PANTS = ["blueDark", "charcoal", "woodDark", "slate", "indigo"];
const SKINS = ["#e8b38f", "#c68863", "#8d5a3b", "#f1c9a5", "#b07850"];

/** A random little resident standing at (x,y,z) */
function folk(c: Ctx, x: number, z: number, y = 1): void {
  person(c.v, x, y, z, c.pick(SHIRTS), c.pick(PANTS), c.pick(SKINS));
}

/** Half ellipsoid (only y >= y0), for mounds, hedging blobs, bushes on roofs */
function cap(v: PixelVox, cx: number, y0: number, cz: number, rx: number, ry: number, rz: number, col: string): void {
  for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
    for (let z = Math.floor(cz - rz) - 1; z <= Math.ceil(cz + rz); z++) {
      for (let y = y0; y <= y0 + Math.ceil(ry); y++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y - y0 + 0.5) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
        if (d <= 1) v.put(x, y, z, col);
      }
    }
  }
}

/** Pink lawn flamingo */
function flamingo(v: PixelVox, x: number, z: number, y = 1): void {
  v.put(x, y, z, "black");
  v.put(x, y + 1, z, "pink");
  v.put(x + 1, y + 1, z, "pink");
  v.put(x + 1, y + 2, z, "magenta");
  v.put(x + 2, y + 2, z, "black");
}

/** Folding lawn chair facing +z */
function lawnChair(v: PixelVox, x: number, z: number, col = "sky", y = 1): void {
  v.put(x, y, z, col);
  v.put(x, y, z - 1, col);
  v.put(x, y + 1, z - 1, col);
}

/** Kettle BBQ grill with smoke */
function grill(c: Ctx, x: number, z: number, y = 1): void {
  c.v.put(x, y, z, "iron");
  c.v.put(x, y + 1, z, "charcoal");
  c.smoke(x, y + 2, z, "smoke");
}

/** Picnic table along x */
function picnicTable(v: PixelVox, x: number, z: number, col = "wood", y = 1): void {
  v.box(x, y, z - 1, x + 3, y + 1, z, col);
  v.box(x, y, z + 1, x + 3, y + 1, z + 2, col);
  v.box(x, y + 1, z, x + 3, y + 2, z + 1, col);
  v.put(x + 1, y, z, "woodDark");
}

/** String of party lights (glowing dots) between two posts along x */
function stringLights(c: Ctx, x0: number, x1: number, z: number, y: number, post = "woodDark"): void {
  const v = c.v;
  v.box(x0, 1, z, x0 + 1, y + 1, z + 1, post);
  v.box(x1, 1, z, x1 + 1, y + 1, z + 1, post);
  const cols = ["warmGlow", "pink", "cyan", "yellow", "lime"];
  for (let x = x0 + 1; x < x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const sag = Math.round(Math.sin(t * Math.PI) * 1.5);
    v.put(x, y - sag, z, x % 2 ? "iron" : cols[(x + 99) % cols.length], x % 2 ? 0 : 1.1);
  }
}

/** Ring of stones with a fire (sparks) */
function firePit(c: Ctx, x: number, z: number): void {
  const v = c.v;
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) v.put(x + dx, 1, z + dz, "stone");
  v.put(x, 1, z, "fire", 1.4);
  c.smoke(x, 2, z, "spark");
}

/** Laundry line with clothes along x */
function laundry(c: Ctx, x0: number, x1: number, z: number): void {
  const v = c.v;
  v.box(x0, 1, z, x0 + 1, 5, z + 1, "woodDark");
  v.box(x1, 1, z, x1 + 1, 5, z + 1, "woodDark");
  for (let x = x0 + 1; x < x1; x++) {
    v.put(x, 4, z, "white");
    if ((x - x0) % 2 === 1) v.put(x, 3, z, c.pick(SHIRTS));
  }
}

/** Basic tilted solar panel on a roof/ground at y, along x */
function solar(v: PixelVox, x0: number, x1: number, y: number, z: number): void {
  v.box(x0, y, z, x1, y + 1, z + 2, "solarBlue", 0.12);
  v.box(x0, y + 1, z, x1, y + 2, z + 1, "solarBlue", 0.12);
}

/** Simple small rotor (wind turbine) with N blades on axis z, built relative to pivot */
function bladeRotor(len: number, blades = 3, col = "white"): PixelVox {
  const r = new PixelVox(7);
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2;
    for (let d = 1; d <= len; d++) {
      r.put(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), 0, col);
    }
  }
  r.put(0, 0, 0, "steelDark");
  return r;
}

/**
 * Build something with `fn` in a scratch volume (front = +z), then stamp it into c.v rotated so the
 * scratch +z faces `face` ("e" = +x, "w" = -x, "n" = -z, "s" = +z), translated by (ox, oz).
 */
function stampRotated(c: Ctx, face: "e" | "w" | "n" | "s", ox: number, oz: number, fn: (cc: Ctx) => void): void {
  const tmp = new PixelVox(11);
  fn({ ...c, v: tmp });
  for (const [k, style] of tmp.v) {
    const x = ((k >>> 20) & 1023) - 512;
    const y = ((k >>> 10) & 1023) - 512;
    const z = (k & 1023) - 512;
    let X = x;
    let Z = z;
    if (face === "e") { X = z; Z = -x - 1; }
    else if (face === "w") { X = -z - 1; Z = x; }
    else if (face === "n") { X = -x - 1; Z = -z - 1; }
    c.v.v.set(packVoxKey(X + ox, y, Z + oz), style);
  }
}

/** Hash an integer pair to a stable [0,1) */
function hash01(a: number, b: number): number {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h >>> 0) % 10000) / 10000;
}

// =============================================================================================
// HOUSE (reference design, kept)
// =============================================================================================

/**
 * HOUSE — four architectural styles (variant) that each grow from a starter home into an estate.
 *  V0 Craftsman (wood & cream, deep porch)   V1 Victorian (pastel, turret)
 *  V2 Modernist (white cubes, flat roofs)    V3 Mediterranean (stucco, terracotta)
 */
function buildHouse(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);

  const wall = ["cream", "pink", "white", "sand"][s];
  const wall2 = ["woodLight", "sky", "charcoal", "terracotta"][s];
  const roof = ["slate", "purpleDark", "concreteDark", "terracotta"][s];
  const trim = ["woodDark", "white", "steelLight", "woodDark"][s];

  // Main body footprint inside the lot, leaving a front yard on +z
  const yard = lv >= 3 ? 5 : 3;
  const x0 = -hx + 2;
  const x1 = lv >= 3 ? Math.min(hx - 2, 6) : hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - yard;
  const floors = lv === 1 ? 1 : lv <= 3 ? 2 : 3;
  const fh = 4;
  const top = 1 + floors * fh;

  // front walkway
  v.box(-1, 0, z1, 1, 1, hz, "path");

  if (s === 2) {
    // Modernist stacked boxes, cantilever upper floor, flat roofs, big glass
    v.box(x0, 1, z0, x1, 1 + fh, z1, wall);
    windows(c, x0, 1, z0, x1, 1 + fh, z1, { col: "glass", w: 3, h: 2, stepH: 5, emit: 0.4 });
    if (floors >= 2) {
      const cx0 = x0 + 2;
      v.box(cx0, 1 + fh, z0, x1 + (lv >= 3 ? 2 : 0), 1 + fh * 2, z1 + 2, wall2);
      v.box(cx0 + 1, 2 + fh, z1 + 1, x1 + (lv >= 3 ? 1 : -1), fh * 2, z1 + 2, "glass", 0.45);
      flatRoof(c, cx0, 1 + fh * 2, z0, x1 + (lv >= 3 ? 2 : 0), z1 + 2, "concreteDark", "white", false);
    }
    if (floors >= 3) {
      v.box(x0, 1 + fh * 2, z0, x0 + 6, 1 + fh * 3, z0 + 6, wall);
      v.box(x0 + 1, 2 + fh * 2, z0 + 5, x0 + 5, fh * 3, z0 + 6, "glass", 0.5);
      flatRoof(c, x0, 1 + fh * 3, z0, x0 + 6, z0 + 6, "concreteDark", "white", false);
    }
    flatRoof(c, x0, 1 + fh, z0, x1, z1, "concreteDark", "white", false);
    door(v, -1, 1, z1 - 1, "charcoal");
  } else {
    // Pitched-roof styles
    v.box(x0, 1, z0, x1, top, z1, wall);
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, 1, pz, px + 1, top, pz + 1, trim);
    }
    if (s === 0) {
      if (floors >= 2) v.box(x0, 1 + fh, z0, x1, top, z1, wall2);
    }
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, stepH: 3, h: 2, emit: 0.42, sill: trim });
    const ridgeAxis = x1 - x0 >= z1 - z0 ? "x" : "z";
    if (s === 3) hip(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, roof, "terracotta");
    else gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, ridgeAxis, roof, trim);

    const porchZ1 = Math.min(hz - 1, z1 + 3);
    v.box(x0 + 1, 1, z1, x1 - 1, 2, porchZ1, "woodLight");
    for (const px of [x0 + 1, x1 - 2]) v.box(px, 2, porchZ1 - 1, px + 1, 1 + fh, porchZ1, trim);
    v.box(x0, 1 + fh, z1, x1, 2 + fh, porchZ1, roof);
    door(v, -1, 2, z1 - 1, s === 1 ? "crimson" : "woodDark");

    const ch = chimney(v, x0 + 1, top - 1, z0 + 1, 6 + floors, s === 3 ? "plaster" : "brickDark");
    c.smoke(x0 + 2, ch, z0 + 2, "smoke");

    if (s === 1 && lv >= 2) {
      const tx = x1 - 2;
      const tz = z1 - 2;
      v.cylinderY(tx, tz, 1, top + 3, 2.6, wall2);
      windows(c, tx - 2, 1, tz - 2, tx + 2, top + 3, tz + 2, { stepV: fh, h: 2, emit: 0.5 });
      v.cone(tx, top + 3, top + 10 + lv, tz, 3.2, 0.3, roof);
      v.put(Math.floor(tx), top + 11 + lv, Math.floor(tz), "gold", 0.5);
    }
  }

  // ---- level-driven yard upgrades ----
  if (lv >= 2) {
    bush(v, x0 + 1, 1, hz - 2, 1.2, "leaf", "pink");
    v.box(2, 1, hz - 2, 3, 3, hz - 1, "charcoal");
    v.put(2, 3, hz - 2, "red");
  }
  if (lv >= 3) {
    const gx0 = Math.max(x1 + 1, hx - 9);
    v.box(gx0, 0, -hz + 3, hx - 1, 1, hz, "concrete2");
    if (s === 2) {
      v.box(gx0, 1, -hz + 3, hx - 1, 6, -hz + 9, wall2);
      flatRoof(c, gx0, 6, -hz + 3, hx - 1, -hz + 9, "concreteDark", "white", false);
    } else {
      v.box(gx0, 1, -hz + 3, hx - 1, 6, -hz + 9, wall);
      v.box(gx0 + 1, 1, -hz + 8, hx - 2, 5, -hz + 9, "white");
      gable(v, gx0 - 1, 6, -hz + 2, hx, -hz + 10, "x", roof, trim);
    }
    car(v, gx0 + 4, 1, 4, "z", c.vpick(["red", "sky", "silver", "teal"]));
    if (s !== 2) fence(v, -hx + 1, hz - 2, gx0 - 1, hz - 1, 1, 2, "white", [-2, 2]);
    tree(v, -hx + 3, 1, hz - 4, s === 3 ? "palm" : "round", 1.1, c.variant);
  }
  if (lv >= 4) {
    const px0 = -hx + 3;
    const pz0 = -hz + 2;
    if (hz >= 16) {
      pool(v, px0, pz0, px0 + 10, pz0 + 6, s === 3 ? "terracotta" : "white");
      v.box(px0 + 11, 1, pz0, px0 + 12, 2, pz0 + 2, "white");
    }
    flowerBed(c, x0, hz - 4, x0 + 5, hz - 3, 1);
    tree(v, hx - 3, 1, -hz + 12, s === 3 ? "cypress" : s === 1 ? "blossom" : "birch", 1.2, 3);
  }
  if (lv >= 5) {
    if (s === 2) {
      for (let x = x0 + 3; x < x1; x += 3) v.box(x, 2 + fh * 2 + 1, z0 + 1, x + 2, 3 + fh * 2 + 1, z0 + 4, "solarBlue", 0.15);
    } else {
      v.box(-2, top + 6, -2, 2, top + 7, 2, trim);
    }
    for (const lx of [-hx + 1, hx - 2]) {
      v.box(lx, 1, hz - 1, lx + 1, 4, hz, "iron");
      v.put(lx, 4, hz - 1, "warmGlow", 1.2);
    }
    v.box(-hx + 1, 1, -hz + 1, hx - 1, 3, -hz + 2, "leafDark");
  }
}

// =============================================================================================
// TINY HOMES
// =============================================================================================

/**
 * One tiny home unit centred on (cx,cz), roughly 11 x 9 voxels, front (+z) at cz+4.
 * kind: 0 A-frame cabin · 1 shipping-container home · 2 tiny house on wheels · 3 hobbit earth-house
 */
function tinyUnit(c: Ctx, cx: number, cz: number, kind: number, tint: number, deluxe: boolean): void {
  const v = c.v;
  if (kind === 0) {
    // ---- A-frame: steep roof straight to the ground, glass gable, deck
    const roof = ["redDark", "slate", "tealDark", "woodDark"][tint % 4];
    const x0 = cx - 5;
    const x1 = cx + 5;
    const z0 = cz - 4;
    const z1 = cz + 4;
    for (let s = 0; s < 5; s++) {
      v.box(x0 + s, 1 + s * 2, z0, x1 - s, 3 + s * 2, z1, roof);
      // shingle edge line
      v.put(x0 + s, 2 + s * 2, z1 - 1, "woodDark");
      v.put(x1 - s - 1, 2 + s * 2, z1 - 1, "woodDark");
    }
    v.box(cx - 1, 11, z0, cx + 1, 12, z1, "woodDark");
    // recessed glass gable (front) and back
    for (let s = 0; s < 5; s++) {
      const ax0 = x0 + s + 1;
      const ax1 = x1 - s - 1;
      if (ax0 >= ax1) continue;
      v.box(ax0, 1 + s * 2, z1 - 1, ax1, 3 + s * 2, z1, s === 0 ? "woodLight" : "glass", s === 0 ? 0 : 0.5);
      if (s > 0) v.put(cx - 1 + (s % 2), 1 + s * 2, z1 - 1, "woodLight");
      v.box(ax0, 1 + s * 2, z0, ax1, 3 + s * 2, z0 + 1, s === 0 ? "woodLight" : "glassDark", 0.2);
    }
    v.box(cx - 1, 1, z1 - 1, cx + 1, 4, z1, "woodDark");
    v.box(cx - 4, 4, z1 - 1, cx + 4, 5, z1, "woodLight");
    // stove pipe
    v.box(x1 - 3, 6, cz - 1, x1 - 2, 11, cz, "iron");
    c.smoke(x1 - 3, 11, cz - 1, "smoke");
    // deck
    v.box(x0 + 1, 1, z1, x1 - 1, 2, z1 + 2, "woodLight");
  } else if (kind === 1) {
    // ---- Shipping container home: corrugated box, big glass end, roof deck
    const col = ["orange", "teal", "red", "busYellow"][tint % 4];
    const dark = ["#c4692a", "tealDark", "redDark", "#c99520"][tint % 4];
    const x0 = cx - 6;
    const x1 = cx + 6;
    const z0 = cz - 3;
    const z1 = cz + 3;
    v.box(x0, 1, z0, x1, 6, z1, col);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, 5, z1 - 1);
    for (let x = x0; x < x1; x += 2) {
      v.box(x, 1, z0, x + 1, 6, z0 + 1, dark);
      v.box(x, 1, z1 - 1, x + 1, 6, z1, dark);
    }
    for (let z = z0; z < z1; z += 2) {
      v.box(x0, 1, z, x0 + 1, 6, z + 1, dark);
    }
    v.box(x0, 5, z0, x1, 6, z1, dark);
    // corner castings
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, 1, pz, px + 1, 6, pz + 1, "steelDark");
    }
    // glass end (+x) and front window wall
    v.box(x1 - 1, 2, z0 + 1, x1, 5, z1 - 1, "glass", 0.5);
    v.box(cx - 3, 2, z1 - 1, cx + 3, 5, z1, "glass", 0.45);
    v.box(cx - 5, 1, z1 - 1, cx - 3, 4, z1, "charcoal");
    // roof deck
    v.box(x0, 6, z0, x1, 7, z0 + 1, "steelDark");
    v.box(x0, 6, z1 - 1, x1, 7, z1, "steelDark");
    v.box(x1 - 1, 6, z0, x1, 7, z1, "steelDark");
    v.box(x0 + 1, 6, z0 + 1, x0 + 3, 7, z0 + 3, "woodDark");
    bush(v, x0 + 1, 7, z0 + 1, 1.0, "leaf");
    if (deluxe) {
      // second container stacked crosswise, cantilevered out over the deck
      const col2 = ["teal", "busYellow", "white", "red"][tint % 4];
      const dk2 = ["tealDark", "#c99520", "silver", "redDark"][tint % 4];
      v.box(cx - 1, 6, z0 - 1, cx + 4, 11, z1 + 3, col2);
      for (let z = z0 - 1; z < z1 + 3; z += 2) {
        v.box(cx - 1, 6, z, cx, 11, z + 1, dk2);
        v.box(cx + 3, 6, z, cx + 4, 11, z + 1, dk2);
      }
      v.box(cx, 7, z1 + 2, cx + 3, 10, z1 + 3, "glass", 0.55);
      v.box(cx - 1, 10, z0 - 1, cx + 4, 11, z1 + 3, dk2);
    }
    // side stair
    for (let s = 0; s < 5; s++) v.put(x0 - 1, 1 + s, z1 - 1 - s, "steelDark");
  } else if (kind === 2) {
    // ---- Tiny house on wheels: trailer chassis, cedar box, metal gable roof, loft window
    const wall = ["woodLight", "sky", "white", "#8fbf9a"][tint % 4];
    const x0 = cx - 5;
    const x1 = cx + 5;
    const z0 = cz - 3;
    const z1 = cz + 3;
    v.box(x0 - 1, 2, z0, x1 + 1, 3, z1, "iron");
    for (const wx of [cx - 1, cx + 1]) {
      v.put(wx, 1, z0, "rubber");
      v.put(wx, 1, z1 - 1, "rubber");
    }
    v.put(x1 + 1, 2, cz, "iron");
    v.put(x1 + 2, 2, cz, "iron");
    v.put(x1 + 2, 1, cz, "iron");
    v.box(x0, 3, z0, x1, 9, z1, wall);
    if (wall === "woodLight") {
      for (let x = x0; x < x1; x += 2) v.box(x, 3, z1 - 1, x + 1, 9, z1, "wood");
    }
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, 3, pz, px + 1, 9, pz + 1, "woodDark");
    }
    gable(v, x0 - 1, 9, z0 - 1, x1 + 1, z1 + 1, "x", "steelLight", "steelDark");
    v.box(x0, 9, z0, x0 + 1, 12, z1, wall);
    v.box(x1 - 1, 9, z0, x1, 12, z1, wall);
    v.put(x1 - 1, 10, cz, "glass", 0.6);
    v.put(x1 - 1, 10, cz - 1, "glass", 0.6);
    v.box(cx - 3, 3, z1 - 1, cx - 1, 7, z1, "woodDark");
    v.box(cx, 5, z1 - 1, cx + 4, 7, z1, "glass", 0.5);
    v.box(x1 - 1, 4, cz - 1, x1, 7, cz + 1, "glass", 0.4);
    // little steps & flower box
    v.box(cx - 3, 1, z1, cx - 1, 2, z1 + 1, "woodDark");
    v.box(cx - 3, 2, z1, cx - 1, 3, z1 + 1, "wood");
    v.box(cx, 4, z1, cx + 4, 5, z1 + 1, "woodDark");
    for (let x = cx; x < cx + 4; x++) v.put(x, 5, z1, x % 2 ? "red" : "pink");
    v.box(cx + 2, 12, cz - 2, cx + 3, 13, cz - 1, "iron");
    c.smoke(cx + 2, 13, cz - 2, "smoke");
  } else {
    // ---- Hobbit-style earth house: grassy mound, round door, round windows
    cap(v, cx, 1, cz - 2, 6.2, 6.5, 6, "leaf");
    cap(v, cx, 1, cz - 2, 5.6, 6.8, 5.4, "grass2");
    v.clear(cx - 8, 1, cz + 3, cx + 8, 10, cz + 8);
    v.ringZ(cx, 1, cz + 2, cz + 3, 5.3, 0, "stone");
    v.ringZ(cx, 1, cz + 2, cz + 3, 5.3, 4.4, "granite");
    v.ringZ(cx, 3, cz + 3, cz + 4, 2.4, 1.5, "woodLight");
    v.ringZ(cx, 3, cz + 3, cz + 4, 1.6, 0, ["#3f8f3a", "#3a63b8", "#c0392b", "#e0b028"][tint % 4]);
    v.box(cx - 3, 0, cz + 3, cx + 3, 1, cz + 4, "path");
    v.put(cx, 3, cz + 4, "gold", 0.5);
    for (const wx of [cx - 4, cx + 3]) {
      v.box(wx, 3, cz + 3, wx + 1, 5, cz + 4, "warmGlow", 0.8);
    }
    // stone chimney poking through the turf + flowers along the base
    v.box(cx + 2, 4, cz - 3, cx + 4, 10, cz - 1, "stone");
    v.box(cx + 2, 10, cz - 3, cx + 4, 11, cz - 1, "granite");
    c.smoke(cx + 3, 11, cz - 2, "smoke");
    for (let x = cx - 6; x <= cx + 6; x += 2) v.put(x, 1, cz + 3, ["yellow", "pink", "white", "red", "purple"][(x + 99) % 5]);
    v.put(cx - 2, 7, cz - 2, "yellow");
    v.put(cx + 1, 7, cz - 4, "pink");
    v.put(cx - 4, 5, cz, "white");
    v.box(cx - 1, 0, cz + 3, cx + 2, 1, cz + 6, "path");
  }
}

/**
 * TINY HOMES — a little off-grid community that SPRAWLS.
 *  V0 A-frame cabins   V1 shipping-container homes   V2 tiny houses on wheels   V3 hobbit earth-houses
 */
function buildTinyHomes(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, s === 3 ? "grass" : "grass2");
  speckle(c, "grass3", 0.1);
  if (s === 1) speckle(c, "path2", 0.12);

  const slots: [number, number][] = [];
  if (hx <= 8 && hz <= 8) {
    slots.push([0, lv >= 2 ? -2 : -1]);
  } else if (hz <= 8) {
    slots.push([-hx + 8, -2], [hx - 8, -2]);
  } else {
    slots.push([-hx + 8, -hz + 6], [hx - 8, -hz + 6], [-hx + 8, hz - 8]);
    if (lv >= 5) slots.push([hx - 8, hz - 8]);
  }
  slots.forEach(([x, z], i) => tinyUnit(c, x, z, s, i + s, lv >= 4));

  const solo = slots.length === 1;
  // gravel paths linking units
  if (!solo) {
    v.box(-1, 0, -hz, 1, 1, hz, "path");
    v.box(-hx, 0, hz - 2, hx, 1, hz - 1, "path2");
  }

  if (lv === 1) {
    lawnChair(v, -hx + 3, hz - 2, "orange");
    tree(v, hx - 3, 1, hz - 3, s === 0 ? "pine" : "round", 0.8, 1);
    v.put(-hx + 2, 1, hz - 4, "woodDark");
    v.put(-hx + 2, 2, hz - 4, "crate");
  }
  if (lv >= 2 && solo) {
    firePit(c, -hx + 4, hz - 3);
    lawnChair(v, -hx + 2, hz - 3, "red");
    lawnChair(v, -hx + 6, hz - 2, "sky");
    solar(v, hx - 5, hx - 1, 1, hz - 4);
    // bicycle
    v.box(2, 1, hz - 2, 5, 2, hz - 1, "teal");
    v.put(2, 1, hz - 2, "rubber");
    v.put(4, 1, hz - 2, "rubber");
    tree(v, -hx + 1, 1, -hz + 1, "pine", 0.9, 2);
  }
  if (lv >= 3) {
    // shared fire pit & party lights between units
    firePit(c, 0, hz - 5);
    for (const fx of [-3, 3]) lawnChair(v, fx, hz - 4, c.pick(["red", "sky", "yellow"]));
    stringLights(c, -hx + 2, hx - 3, hz - 3, 6);
    folk(c, -2, hz - 6);
    tree(v, -hx + 1, 1, hz - 6, s === 0 ? "pine" : "birch", 0.9, 1);
  }
  if (lv >= 4 && !solo && lv < 5) {
    // community garden + mini greenhouse in the 4th corner
    const gx = hx - 8;
    const gz = hz - 8;
    for (let r = 0; r < 3; r++) {
      v.box(gx - 6, 1, gz - 4 + r * 3, gx + 1, 2, gz - 2 + r * 3, "soil");
      for (let x = gx - 6; x < gx + 1; x += 2) v.put(x, 2, gz - 3 + r * 3, ["lime", "red", "orange"][r]);
    }
    v.box(gx + 2, 1, gz - 4, gx + 6, 5, gz + 2, "glass", 0.25);
    for (const fx of [gx + 2, gx + 5]) for (const fz of [gz - 4, gz + 1]) v.box(fx, 1, fz, fx + 1, 5, fz + 1, "white");
    gable(v, gx + 1, 5, gz - 5, gx + 7, gz + 3, "z", "glass", "white");
    v.box(gx + 3, 1, gz + 1, gx + 5, 3, gz + 2, "leaf");
  }
  if (lv >= 5) {
    // small community wind turbine in the middle, solar strip, lanterns
    v.box(0, 1, -1, 1, 22, 0, "white");
    c.addRotor({ vox: bladeRotor(7, 3, "white"), pivot: [0.5, 22.5, 0.6], axis: "z", speed: 2.2, wind: true });
    v.box(-1, 21, -1, 2, 23, 0, "white");
    solar(v, -hx + 2, -hx + 7, 1, -1);
    solar(v, hx - 7, hx - 2, 1, -1);
    for (const lx of [-hx + 1, hx - 2]) {
      v.box(lx, 1, hz - 1, lx + 1, 4, hz, "iron");
      v.put(lx, 4, hz - 1, "warmGlow", 1.2);
    }
    folk(c, 2, 2);
  }
}

// =============================================================================================
// TRAILER HOMES
// =============================================================================================

/**
 * One trailer along x, occupying [x0, x0+len) x [z0, z0+5), door on +z.
 * kind 0 airstream · 1 70s single-wide · 2 50s canned-ham · 3 motorhome RV
 */
function trailerUnit(c: Ctx, x0: number, z0: number, kind: number, tint: number, extras: boolean): void {
  const v = c.v;
  const z1 = z0 + 5;
  if (kind === 0) {
    const len = 13;
    const x1 = x0 + len;
    for (let i = 0; i < len; i++) {
      const end = Math.min(i, len - 1 - i);
      const h = end === 0 ? 3 : end === 1 ? 4 : 5;
      const x = x0 + i;
      v.box(x, 2, z0, x + 1, 2 + h - 1, z1, i % 4 === 0 ? "silver" : "chrome");
      v.box(x, 2 + h - 1, z0 + 1, x + 1, 2 + h, z1 - 1, i % 4 === 0 ? "silver" : "chrome");
    }
    // window band & door
    for (let x = x0 + 2; x < x1 - 2; x += 3) v.put(x, 5, z1 - 1, "glassDark", 0.5);
    v.box(x0 + 1, 4, z1 - 1, x0 + 2, 5, z1, "glassDark", 0.3);
    v.box(x0 + 5, 2, z1 - 1, x0 + 7, 6, z1, "steelLight");
    v.put(x0 + 6, 4, z1, "warmGlow", 0.9);
    // wheels + hitch
    for (const wx of [x0 + 5, x0 + 7]) {
      v.put(wx, 1, z0, "rubber");
      v.put(wx, 1, z1 - 1, "rubber");
    }
    v.box(x1, 2, z0 + 2, x1 + 2, 3, z0 + 3, "iron");
    v.put(x1 + 1, 1, z0 + 2, "iron");
    if (extras) {
      for (let x = x0 + 3; x < x0 + 10; x++) v.put(x, 6, z1, (x & 1) ? "white" : ["teal", "red", "orange", "sky"][tint % 4]);
    }
  } else if (kind === 1) {
    const len = 14;
    const x1 = x0 + len;
    const body = ["cream", "sand", "#e0ecd0", "white"][tint % 4];
    const stripe = ["woodDark", "orange", "#5b8f3a", "brick"][tint % 4];
    v.box(x0, 1, z0, x1, 2, z1, "woodLight");
    for (let x = x0; x < x1; x += 2) v.put(x, 1, z1 - 1, "wood");
    v.box(x0, 2, z0, x1, 7, z1, body);
    v.box(x0, 4, z0, x1, 5, z1, stripe);
    v.box(x0, 5, z0, x1, 6, z1, stripe === "woodDark" ? "orange" : "white");
    v.box(x0, 7, z0, x1, 8, z1, "silver");
    v.box(x0 + 1, 8, z0 + 1, x1 - 1, 9, z1 - 1, "steelLight");
    for (let x = x0 + 2; x < x1 - 1; x += 4) v.box(x, 3, z1 - 1, x + 2, 4, z1, "glass", 0.45);
    v.box(x0 + 8, 2, z1 - 1, x0 + 10, 6, z1, "woodDark");
    v.box(x0 + 7, 1, z1, x0 + 11, 2, z1 + 2, "wood");
    // window AC + TV antenna
    v.box(x1 - 3, 3, z1, x1 - 1, 4, z1 + 1, "silver");
    v.box(x0 + 2, 9, z0 + 2, x0 + 3, 12, z0 + 3, "steelDark");
    v.box(x0 + 1, 11, z0 + 2, x0 + 4, 12, z0 + 3, "steelDark");
    if (extras) {
      // carport awning with posts
      v.box(x0, 7, z1, x0 + 7, 8, z1 + 4, "#9fb2a0");
      v.box(x0, 1, z1 + 3, x0 + 1, 7, z1 + 4, "silver");
      v.box(x0 + 6, 1, z1 + 3, x0 + 7, 7, z1 + 4, "silver");
    }
  } else if (kind === 2) {
    const len = 10;
    const x1 = x0 + len;
    const lower = ["#8fd6b8", "pink", "sky", "yellow"][tint % 4];
    for (let i = 0; i < len; i++) {
      const x = x0 + i;
      const h = i === len - 1 ? 3 : i === len - 2 ? 4 : i === 0 ? 4 : 5;
      v.box(x, 2, z0, x + 1, 2 + h, z1, "white");
      v.box(x, 2, z0, x + 1, Math.min(2 + h, 4), z1, lower);
      v.box(x, 2 + h, z0 + 1, x + 1, 3 + h, z1 - 1, i === 0 || i === len - 1 ? "white" : "silver");
    }
    v.box(x0, 4, z0, x1, 5, z1, "chrome");
    v.box(x0 + 2, 5, z1 - 1, x0 + 4, 6, z1, "glass", 0.55);
    v.box(x0 + 6, 5, z1 - 1, x0 + 8, 6, z1, "glass", 0.55);
    v.box(x1 - 1, 5, z0 + 1, x1, 6, z1 - 1, "glass", 0.4);
    v.box(x0 + 4, 2, z1 - 1, x0 + 6, 6, z1, lower);
    v.put(x0 + 4, 4, z1, "chrome");
    v.put(x0 + 4, 1, z0, "rubber");
    v.put(x0 + 4, 1, z1 - 1, "rubber");
    v.box(x1, 2, z0 + 2, x1 + 2, 3, z0 + 3, "iron");
    if (extras) for (let x = x0 + 1; x < x0 + 9; x++) v.put(x, 7, z1, (x & 1) ? "white" : lower);
  } else {
    const len = 14;
    const x1 = x0 + len;
    const sw1 = ["blue", "red", "teal", "orange"][tint % 4];
    const sw2 = ["sky", "orange", "lime", "brick"][tint % 4];
    v.box(x0, 2, z0, x1, 9, z1, "white");
    v.box(x0 + 1, 9, z0 + 1, x1 - 2, 10, z1 - 1, "silver");
    // cab
    v.box(x1 - 1, 2, z0, x1 + 1, 5, z1, "white");
    v.box(x1 - 1, 5, z0, x1, 8, z1, "glassDark", 0.3);
    v.box(x1, 4, z0, x1 + 1, 5, z1, "glassDark", 0.3);
    // swooshes
    for (let x = x0; x < x1; x++) {
      const y = 3 + Math.floor(((x - x0) / len) * 4);
      v.put(x, y, z1 - 1, sw1);
      v.put(x, y + 1, z1 - 1, sw2);
      v.put(x, y, z0, sw1);
    }
    for (let x = x0 + 2; x < x1 - 3; x += 4) v.box(x, 6, z1 - 1, x + 2, 7, z1, "glassDark", 0.4);
    v.box(x0 + 3, 2, z1 - 1, x0 + 5, 7, z1, "silver");
    for (const wx of [x0 + 3, x1 - 2]) {
      v.box(wx - 1, 1, z0, wx + 1, 3, z0 + 1, "rubber");
      v.box(wx - 1, 1, z1 - 1, wx + 1, 3, z1, "rubber");
    }
    // ladder at back
    for (let y = 2; y < 10; y += 2) v.put(x0 - 1, y, z0 + 2, "steelDark");
    if (extras) {
      v.box(x0 + 6, 8, z1, x1 - 3, 9, z1 + 3, sw1);
      for (let x = x0 + 6; x < x1 - 3; x += 2) v.put(x, 8, z1 + 2, "white");
      v.box(x1 - 4, 1, z1 + 2, x1 - 3, 8, z1 + 3, "silver");
    }
  }
}

/**
 * TRAILER HOME — SPRAWLS from one lonely trailer into a neon-signed RV resort.
 *  V0 Airstream (polished aluminium)   V1 70s single-wide (striped, carports)
 *  V2 50s canned-ham pastel campers    V3 motorhome / RV camp with awnings
 */
function buildTrailerHome(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, s === 1 ? "grass" : "grass2");
  speckle(c, s === 3 ? "sandDark" : "grass3", 0.1);

  const cols = Math.max(1, Math.floor((hx * 2) / 16));
  const rows = Math.max(1, Math.floor((hz * 2 - 2) / 12));
  const frontBand = hz * 2 - rows * 12;
  // access road along the front
  if (rows >= 2 || cols >= 2) {
    v.box(-hx, 0, hz - Math.max(3, frontBand - 1), hx, 1, hz, "asphalt");
    for (let x = -hx + 1; x < hx; x += 4) v.put(x, 0, hz - Math.max(2, Math.floor(frontBand / 2)), "yellow");
  }
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const sx = -hx + k * 16;
      const sz = -hz + 1 + r * 12;
      n++;
      const isPool = lv >= 5 && r === rows - 1 && k === Math.floor(cols / 2);
      const isOffice = lv >= 4 && r === rows - 1 && k === cols - 1 && rows * cols > 3;
      // gravel pad
      v.box(sx + 1, 0, sz, sx + 15, 1, sz + 6, "path2");
      if (isPool) {
        pool(v, sx + 2, sz, sx + 14, sz + 8, "white");
        v.box(sx + 4, 1, sz + 1, sx + 5, 2, sz + 2, "white");
        for (const ux of [sx + 2, sx + 13]) tree(v, ux, 1, sz + 9, "palm", 1.1, 2);
        lawnChair(v, sx + 7, sz + 10, "pink");
        lawnChair(v, sx + 9, sz + 10, "cyan");
        // umbrella
        v.box(sx + 11, 1, sz + 9, sx + 12, 5, sz + 10, "white");
        v.cylinderY(sx + 11.5, sz + 9.5, 5, 6, 2.2, "red");
        continue;
      }
      if (isOffice) {
        // park office + laundry trailer with sign
        v.box(sx + 2, 1, sz, sx + 14, 7, sz + 6, "white");
        v.box(sx + 2, 7, sz, sx + 14, 8, sz + 6, "teal");
        v.box(sx + 4, 2, sz + 5, sx + 6, 5, sz + 6, "glass", 0.6);
        v.box(sx + 9, 1, sz + 5, sx + 11, 5, sz + 6, "teal");
        v.box(sx + 3, 8, sz + 4, sx + 13, 11, sz + 5, "magenta", 0.9);
        v.box(sx + 4, 9, sz + 5, sx + 12, 10, sz + 6, "white", 0.8);
        v.box(sx + 12, 2, sz + 6, sx + 14, 4, sz + 8, "silver");
        continue;
      }
      const kind = s;
      const tint = (n * 3 + s) % 4;
      trailerUnit(c, sx + 1, sz, kind, tint, lv >= 2);
      // yard props (deterministic per slot)
      const h = hash01(n + lv * 7, s + 3);
      const yz = sz + 7;
      if (h < 0.33) {
        flamingo(v, sx + 2, yz + 1);
        flamingo(v, sx + 5, yz + 2);
        lawnChair(v, sx + 9, yz + 2, "orange");
        grill(c, sx + 12, yz + 1);
      } else if (h < 0.66) {
        picnicTable(v, sx + 3, yz + 1, "woodLight");
        laundry(c, sx + 9, sx + 14, yz + 1);
      } else {
        lawnChair(v, sx + 3, yz + 2, "sky");
        lawnChair(v, sx + 5, yz + 2, "yellow");
        v.box(sx + 9, 1, yz, sx + 13, 2, yz + 3, "#5bb0e8");
        bush(v, sx + 14, 1, yz + 2, 1, "leaf", "pink");
      }
      if (lv >= 3 && (n % 3 === 0)) car(v, sx + 12, 1, yz + 2, "x", c.pick(["red", "teal", "yellow", "sky"]));
    }
  }
  if (lv === 1) {
    tree(v, hx - 3, 1, hz - 3, s === 3 ? "palm" : "round", 0.9, 1);
    v.box(-hx + 1, 1, hz - 3, -hx + 2, 3, hz - 2, "woodDark");
    v.box(-hx + 1, 3, hz - 3, -hx + 3, 4, hz - 2, "#5bb0e8");
  }
  if (lv >= 3) {
    // welcome sign at the entrance
    const sx = -hx + 1;
    const sz = hz - 2;
    v.box(sx, 1, sz, sx + 1, 6, sz + 1, "woodDark");
    v.box(sx + 7, 1, sz, sx + 8, 6, sz + 1, "woodDark");
    v.box(sx, 6, sz, sx + 8, 9, sz + 1, lv >= 5 ? "magenta" : "woodLight", lv >= 5 ? 1.0 : 0);
    v.box(sx + 1, 7, sz, sx + 7, 8, sz + 1, lv >= 5 ? "cyan" : "white", lv >= 5 ? 1.2 : 0);
    if (lv >= 5) {
      // big neon star on top and palm-lined entrance
      v.box(sx + 3, 9, sz, sx + 5, 12, sz + 1, "yellow", 1.2);
      v.box(sx + 2, 10, sz, sx + 6, 11, sz + 1, "yellow", 1.2);
      for (let x = -hx + 12; x < hx - 2; x += 10) tree(v, x, 1, hz - 1, "palm", 1.3, x);
    }
  }
}

// =============================================================================================
// COTTAGES
// =============================================================================================

/**
 * One cottage on [x0,x1) x [z0,z1) (front +z).
 * style 0 thatched stone · 1 gingerbread half-timber · 2 alpine chalet · 3 nordic turf-roof
 */
function cottageBody(c: Ctx, x0: number, z0: number, x1: number, z1: number, st: number, lv: number): number {
  const v = c.v;
  const wallTop = 7;
  const cx = Math.floor((x0 + x1) / 2);
  let roofTop = wallTop;
  if (st === 0) {
    v.box(x0, 1, z0, x1, wallTop, z1, "limestone");
    for (let x = x0; x < x1; x++) {
      for (let y = 1; y < wallTop; y++) {
        const r = hash01(x * 31 + y, z0);
        if (r < 0.25) v.put(x, y, z1 - 1, r < 0.12 ? "stone" : "concrete2");
        const r2 = hash01(z0 * 7 + y, x);
        if (r2 < 0.2) v.put(x, y, z0, "stone");
      }
    }
    for (let z = z0; z < z1; z++) for (let y = 1; y < wallTop; y++) if (hash01(z, y * 13) < 0.25) v.put(x1 - 1, y, z, "stone");
    // thick rounded thatch
    roofTop = gable(v, x0 - 2, wallTop, z0 - 2, x1 + 2, z1 + 2, "x", "#c9a24f");
    gable(v, x0 - 1, wallTop + 1, z0 - 1, x1 + 1, z1 + 1, "x", "#b8913f");
    v.box(x0 - 2, roofTop - 1, Math.floor((z0 + z1) / 2) - 1, x1 + 2, roofTop, Math.floor((z0 + z1) / 2) + 1, "#8f6a2c");
    for (let x = x0 - 2; x < x1 + 2; x += 2) v.put(x, wallTop, z1 + 1, "#a88437");
    // eyebrow dormer
    v.box(cx + 2, wallTop + 1, z1, cx + 4, wallTop + 2, z1 + 1, "glass", 0.6);
    const ch = chimney(v, x0, wallTop, z0 + 1, roofTop - wallTop + 2, "stone", 2, "granite");
    c.smoke(x0 + 1, ch, z0 + 2, "smoke");
  } else if (st === 1) {
    v.box(x0, 1, z0, x1, wallTop, z1, "cream");
    // timber frame
    for (let x = x0; x < x1; x += 3) {
      v.box(x, 1, z1 - 1, x + 1, wallTop, z1, "woodDark");
      v.box(x, 1, z0, x + 1, wallTop, z0 + 1, "woodDark");
    }
    for (let z = z0; z < z1; z += 3) v.box(x1 - 1, 1, z, x1, wallTop, z + 1, "woodDark");
    v.box(x0, 1, z0, x1, 2, z1, "woodDark");
    v.box(x0, 4, z0, x1, 5, z1, "woodDark");
    for (let x = x0 + 1; x < x1 - 1; x += 3) {
      v.put(x, 5, z1 - 1, "woodDark");
      v.put(x + 1, 6, z1 - 1, "woodDark");
    }
    // steep candy roof with white icing edge
    const ridgeAxis = "x";
    roofTop = 0;
    const across = z1 - z0 + 2;
    const rise = Math.ceil(across / 2);
    for (let s = 0; s < rise; s++) {
      v.box(x0 - 1, wallTop + s * 2, z0 - 1 + s, x1 + 1, wallTop + s * 2 + 2, z1 + 1 - s, s % 2 ? "redDark" : "red");
    }
    roofTop = wallTop + rise * 2;
    for (let x = x0 - 1; x < x1 + 1; x++) v.put(x, wallTop - (x & 1), z1 + 1 - 0, "white");
    for (let x = x0 - 1; x < x1 + 1; x++) v.put(x, wallTop, z1, "white");
    void ridgeAxis;
    // crooked chimney
    v.box(x1 - 3, wallTop + 2, z0 + 1, x1 - 1, roofTop + 1, z0 + 3, "brick");
    v.box(x1 - 2, roofTop + 1, z0 + 1, x1, roofTop + 3, z0 + 3, "brick");
    c.smoke(x1 - 1, roofTop + 3, z0 + 2, "smoke");
    // front cross-gable dormer
    v.box(cx - 2, wallTop, z1 - 2, cx + 3, wallTop + 3, z1, "cream");
    v.put(cx, wallTop + 1, z1 - 1, "glass", 0.6);
    for (let s = 0; s < 3; s++) v.box(cx - 3 + s, wallTop + 3 + s, z1 - 3, cx + 4 - s, wallTop + 4 + s, z1 + 1, "red");
  } else if (st === 2) {
    v.box(x0, 1, z0, x1, 3, z1, "granite");
    v.box(x0, 3, z0, x1, wallTop + 1, z1, "oak");
    for (let y = 3; y < wallTop + 1; y += 2) {
      v.box(x0, y, z1 - 1, x1, y + 1, z1, "woodDark");
      v.box(x1 - 1, y, z0, x1, y + 1, z1, "woodDark");
    }
    // wide low gable facing front (ridge along z), big overhangs
    const rise = Math.ceil((x1 - x0 + 6) / 2);
    for (let s = 0; s < rise; s++) {
      const a = x0 - 3 + s;
      const b = x1 + 3 - s;
      if (a >= b) break;
      v.box(a, wallTop + 1 + Math.floor(s / 2), z0 - 2, b, wallTop + 2 + Math.floor(s / 2), z1 + 3, s === 0 ? "woodDark" : "#6b4a2e");
      if (s > 0) v.box(a + 1, wallTop + 1 + Math.floor(s / 2), z1 - 1, b - 1, wallTop + 2 + Math.floor(s / 2), z1, "oak");
    }
    roofTop = wallTop + 2 + Math.floor(rise / 2);
    // snow cap stones on the roof
    for (let x = x0; x < x1; x += 3) v.put(x, wallTop + 2 + Math.floor((x - x0 + 3) / 2), z1 + 1, "stone");
    // balcony with heart cutouts + red flower boxes
    v.box(x0, 4, z1, x1, 5, z1 + 2, "woodDark");
    for (let x = x0; x < x1; x++) {
      v.put(x, 5, z1 + 1, x % 2 ? "woodLight" : "woodDark");
      v.put(x, 6, z1 + 1, x % 3 === 0 ? "red" : "leaf");
    }
    v.box(cx - 1, 5, z1 - 1, cx + 1, 8, z1, "glass", 0.55);
    const ch = chimney(v, x1 - 2, wallTop, z0 + 1, roofTop - wallTop + 2, "stone");
    c.smoke(x1 - 1, ch, z0 + 2, "smoke");
  } else {
    const falu = "#a63a2a";
    v.box(x0, 1, z0, x1, wallTop - 1, z1, falu);
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) {
      v.box(px, 1, pz, px + 1, wallTop - 1, pz + 1, "white");
    }
    v.box(x0 - 1, 1, z0 - 1, x1 + 1, 2, z1 + 1, "stone");
    // turf roof: low gable covered in grass and wildflowers
    roofTop = gable(v, x0 - 1, wallTop - 1, z0 - 1, x1 + 1, z1 + 1, "x", "woodDark");
    gable(v, x0 - 1, wallTop, z0 - 1, x1 + 1, z1 + 1, "x", "leaf");
    roofTop += 1;
    for (let i = 0; i < 14; i++) {
      const fx = c.ri(x0, x1 - 1);
      const fz = c.ri(z0, z1 - 1);
      const across = Math.min(fz - (z0 - 1), z1 + 1 - 1 - fz);
      v.put(fx, wallTop + across + 1, fz, c.pick(["yellow", "white", "pink", "grass3", "purple"]));
    }
    if (lv >= 3) {
      // a goat grazing on the roof!
      const gz = z1 - 1;
      const gy = wallTop + 3;
      v.box(cx - 2, gy, gz, cx + 1, gy + 1, gz + 1, "white");
      v.put(cx - 2, gy - 1, gz, "white");
      v.put(cx, gy - 1, gz, "white");
      v.put(cx + 1, gy + 1, gz, "white");
      v.put(cx + 1, gy + 2, gz, "charcoal");
    }
    const ch = chimney(v, x0 + 1, wallTop, Math.floor((z0 + z1) / 2) - 1, roofTop - wallTop + 2, "stone", 2, "granite");
    c.smoke(x0 + 2, ch, Math.floor((z0 + z1) / 2), "smoke");
  }

  // door + windows (shared)
  const doorCol = ["#3f6fb0", "#5aa04a", "redDark", "#2f7d74"][st];
  if (st === 3) {
    v.box(cx - 1, 1, z1 - 1, cx + 1, 4, z1, doorCol);
    v.put(cx + 1, 3, z1, "warmGlow", 0.9);
  } else if (st !== 2) {
    door(v, cx - 1, 1, z1 - 1, doorCol);
  } else {
    door(v, cx - 1, 3, z1 - 1, doorCol);
    v.box(cx - 1, 1, z1, cx + 1, 2, z1 + 3, "stone");
    v.box(cx - 1, 2, z1, cx + 1, 3, z1 + 2, "stone");
  }
  const wy = st === 2 ? 4 : 3;
  for (const wx of [x0 + 2, x1 - 3]) {
    v.box(wx, wy, z1 - 1, wx + 1, wy + 2, z1, "glass", 0.55);
    if (st === 3) {
      v.put(wx - 1, wy, z1 - 1, "white");
      v.put(wx + 1, wy, z1 - 1, "white");
      v.put(wx, wy + 2, z1 - 1, "white");
    } else if (st === 0) {
      v.put(wx - 1, wy, z1, "#3f6fb0");
      v.put(wx - 1, wy + 1, z1, "#3f6fb0");
    }
    if (lv >= 2 && st !== 2) {
      // flower box
      v.box(wx - 1, wy - 1, z1, wx + 2, wy, z1 + 1, "woodDark");
      v.put(wx - 1, wy, z1, "red");
      v.put(wx + 1, wy, z1, "pink");
    }
  }
  windows(c, x0, 1, z0, x1, 7, z1, { faces: "e", stepH: 4, h: 2, emit: 0.5, startY: 2, margin: 1 });
  return roofTop;
}

/**
 * COTTAGES — storybook country cottages that gain gardens and charm.
 *  V0 English stone & thatch   V1 gingerbread half-timber (candy roof)
 *  V2 alpine chalet (balcony, big eaves)   V3 Nordic falu-red turf-roof (with roof goat)
 */
function buildCottages(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass");
  speckle(c, "grass3", 0.14);
  speckle(c, "leafLight", 0.03);

  // cottage sits on the left/back tile of the lot
  const tileX0 = -hx;
  const cw = 12;
  const cdepth = 8;
  const cx = hx > 8 ? tileX0 + 8 : 0;
  const czBack = hz > 8 ? -hz + 4 : -hz + 3;
  const x0 = cx - cw / 2;
  const x1 = cx + cw / 2;
  const z0 = czBack;
  const z1 = czBack + cdepth;
  cottageBody(c, x0, z0, x1, z1, s, lv);

  // winding stone path to the front
  for (let z = z1 + (s === 2 ? 3 : 0); z < hz; z++) {
    const off = Math.round(Math.sin(z * 0.6) * 1.2);
    v.box(cx - 1 + off, 0, z, cx + 1 + off, 1, z + 1, z % 2 ? "path" : "path2");
  }

  // L1: a bush and a woodpile
  bush(v, x1, 1, z1 + 1, 1.1, "leaf", lv >= 2 ? "pink" : undefined);
  v.box(x0 - 1, 1, z0 + 1, x0, 3, z0 + 5, "woodDark");
  for (let z = z0 + 1; z < z0 + 5; z++) v.put(x0 - 1, 3, z, "wood");

  const yardZ1 = Math.min(hz - 1, z1 + 7);
  if (lv >= 2) {
    // white picket fence around the front garden with a gate
    fence(v, cx - 7, z1 + 1, cx + 7, yardZ1 + 1, 1, 2, "white", [cx - 2, cx + 2]);
    for (let x = cx - 6; x < cx - 2; x++) v.put(x, 1, yardZ1 - 1, c.pick(["pink", "yellow", "red", "purple"]));
    for (let x = cx + 3; x < cx + 6; x++) v.put(x, 1, yardZ1 - 1, c.pick(["pink", "yellow", "red", "white"]));
    // lantern on a post
    v.box(cx + 3, 1, yardZ1, cx + 4, 4, yardZ1 + 1, "iron");
    v.put(cx + 3, 4, yardZ1, "warmGlow", 1.2);
  }
  if (lv >= 3) {
    // rose arbor over the gate
    const az = yardZ1;
    v.box(cx - 2, 1, az, cx - 1, 6, az + 1, "white");
    v.box(cx + 1, 1, az, cx + 2, 6, az + 1, "white");
    v.box(cx - 2, 6, az, cx + 2, 7, az + 1, "white");
    for (const [ax, ay] of [[cx - 2, 3], [cx - 2, 5], [cx + 1, 4], [cx - 1, 6], [cx, 6], [cx + 1, 6], [cx - 2, 6]]) {
      v.put(ax, ay + (ay === 6 ? 1 : 0), az, c.pick(["red", "pink", "crimson"]));
      v.put(ax, ay + (ay === 6 ? 1 : 0), az + 1, "leaf");
    }
    // stone well with little roof
    const wx = cx - 5;
    const wz = z1 + 4;
    v.box(wx - 1, 1, wz - 1, wx + 2, 3, wz + 2, "stone");
    v.put(wx, 2, wz, "water", 0.2);
    v.box(wx - 1, 3, wz, wx, 6, wz + 1, "woodDark");
    v.box(wx + 1, 3, wz, wx + 2, 6, wz + 1, "woodDark");
    v.box(wx - 2, 6, wz - 1, wx + 3, 7, wz + 2, s === 1 ? "red" : "woodDark");
    v.box(wx - 1, 7, wz - 1, wx + 2, 8, wz + 2, s === 1 ? "red" : "woodDark");
    // ivy creeping up the side wall
    for (let i = 0; i < 12; i++) v.put(x0, 1 + c.ri(0, 5), z0 + c.ri(0, cdepth - 1), "leafDark");
    tree(v, x0 - 1, 1, yardZ1 - 1, s === 2 ? "pine" : "oak", 1.0, 2);
  }
  if (lv >= 4 && hx > 8) {
    // kitchen garden + greenhouse on the right/back, chicken coop
    const zb = -hz + 3;
    for (let r = 0; r < 3; r++) {
      const rz = zb + r * 3;
      v.box(1, 0, rz, 8, 1, rz + 2, "soil");
      for (let x = 1; x < 8; x++) {
        if ((x + r) % 2 === 0) {
          v.put(x, 1, rz + (x % 4 ? 0 : 1), "leaf");
          v.put(x, 2, rz + (x % 4 ? 0 : 1), ["lime", "orange", "red"][r]);
        }
      }
    }
    // scarecrow
    v.box(4, 1, zb + 9, 5, 5, zb + 10, "woodDark");
    v.box(2, 4, zb + 9, 7, 5, zb + 10, "red");
    v.put(4, 5, zb + 9, "sand");
    v.put(4, 6, zb + 9, "#c9a24f");
    // greenhouse
    const gh0 = 9;
    const gh1 = Math.min(hx - 1, 15);
    v.box(gh0, 1, zb, gh1, 5, zb + 8, "glass", 0.2);
    v.clear(gh0 + 1, 1, zb + 1, gh1 - 1, 5, zb + 7);
    for (const fx of [gh0, gh1 - 1]) for (let fz = zb; fz < zb + 8; fz += 3) v.box(fx, 1, fz, fx + 1, 5, fz + 1, "white");
    gable(v, gh0 - 1, 5, zb - 1, gh1 + 1, zb + 9, "z", "glass", "white");
    for (let z = zb + 1; z < zb + 7; z += 2) v.put(gh0 + 2, 1, z, "leafLight");
    // chicken coop + chickens
    const kx = hz > 8 ? -5 : 2;
    const kz = hz - 6;
    v.box(kx, 1, kz, kx + 5, 4, kz + 4, "redDark");
    gable(v, kx - 1, 4, kz - 1, kx + 6, kz + 5, "x", "woodDark");
    v.box(kx + 2, 1, kz + 3, kx + 3, 3, kz + 4, "charcoal");
    for (let i = 0; i < 4; i++) {
      const hxp = kx + 6 + i * 2;
      const hzp = kz + (i % 2) * 2;
      v.put(hxp, 1, hzp, i % 2 ? "white" : "#b5652e");
      v.put(hxp, 2, hzp, i % 2 ? "white" : "#b5652e");
      v.put(hxp + 1, 2, hzp, "red");
    }
  }
  if (lv >= 5 && hz > 8) {
    // duck pond fed by a mill race with a turning water wheel, footbridge, big old tree
    const px = 9;
    const pz = 9;
    for (let x = px - 7; x <= px + 7; x++) {
      for (let z = pz - 5; z <= pz + 6; z++) {
        const d = ((x - px) / 6.5) ** 2 + ((z - pz) / 5) ** 2;
        if (d <= 1) v.put(x, 0, z, d > 0.72 ? "sandDark" : "water", d > 0.72 ? 0 : 0.1);
      }
    }
    v.put(px - 2, 1, pz + 1, "leafLight");
    v.put(px + 3, 1, pz + 3, "leafLight");
    for (const [dx, dz] of [[-1, -1], [2, 1], [-3, 2]]) {
      v.put(px + dx, 1, pz + dz, "white");
      v.put(px + dx + 1, 1, pz + dz, "white");
      v.put(px + dx + 1, 2, pz + dz, "leafDark");
      v.put(px + dx + 2, 2, pz + dz, "orange");
    }
    // stone mill with the wheel on its east face, mill race running to the pond
    const mx0 = 3;
    const mx1 = 9;
    const mz0 = -3;
    const mz1 = 3;
    v.box(mx0, 1, mz0, mx1, 9, mz1, "stone");
    for (let y = 2; y < 9; y += 2) v.box(mx0, y, mz1 - 1, mx1, y + 1, mz1, "granite");
    gable(v, mx0 - 1, 9, mz0 - 1, mx1 + 1, mz1 + 1, "x", s === 3 ? "leaf" : s === 1 ? "red" : s === 0 ? "#c9a24f" : "woodDark");
    v.box(mx0 + 2, 1, mz1 - 1, mx0 + 4, 4, mz1, "woodDark");
    v.put(mx1 - 2, 5, mz1 - 1, "glass", 0.6);
    v.box(mx1, 0, mz0 - 4, mx1 + 4, 1, pz - 3, "water", 0.1);
    v.box(mx1, 1, 0, mx1 + 1, 6, 1, "woodDark");
    const wheel = new PixelVox(3);
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      const y = Math.round(Math.sin(ang) * 4.5);
      const z = Math.round(Math.cos(ang) * 4.5);
      wheel.put(0, y, z, "woodDark");
      wheel.put(1, y, z, "woodDark");
    }
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      for (let d = 0; d <= 5; d++) {
        const y = Math.round(Math.sin(ang) * d);
        const z = Math.round(Math.cos(ang) * d);
        wheel.put(0, y, z, d === 5 ? "wood" : "oak");
        if (d === 5) wheel.put(1, y, z, "wood");
      }
    }
    c.addRotor({ vox: wheel, pivot: [mx1 + 1.5, 6, 0.5], axis: "x", speed: -0.9 });
    // footbridge over the race
    v.box(mx1 - 1, 1, pz - 5, mx1 + 5, 2, pz - 3, "woodLight");
    v.box(mx1 - 1, 2, pz - 5, mx1 + 5, 3, pz - 4, "woodDark");
    tree(v, -hx + 3, 1, hz - 3, s === 2 ? "pine" : s === 1 ? "blossom" : "willow", 1.5, 4);
    folk(c, cx + 2, z1 + 3);
    folk(c, px - 5, pz + 4);
  }
}

defineDesigns({
  house: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Starter Bungalow", "Two-Story Family Home", "Home with Garage", "Backyard-Pool Estate", "Grand Family Manor"],
    growth: "Adds floors, then a garage and driveway, then a backyard pool and gardens.",
    build: buildHouse,
  },
  tiny_homes: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Off-Grid Micro Cabin", "Cabin with Fire Pit", "Tiny Twin Plot", "Tiny-Home Hamlet", "Eco Tiny Village"],
    growth: "Sprawls into a tiny-home community: more units, shared fire pit & garden, then a wind turbine.",
    build: buildTinyHomes,
  },
  trailer_home: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Lone Trailer", "Twin-Trailer Lot", "Trailer Court", "Sunny Acres Park", "Neon Palms RV Resort"],
    growth: "Sprawls: more trailers and pads, an access road, a park office, then a pool and neon sign.",
    build: buildTrailerHome,
  },
  cottages: {
    footprints: [[1, 1], [1, 1], [1, 1], [2, 1], [2, 2]],
    levels: ["Woodcutter's Cottage", "Rose-Gate Cottage", "Ivy & Well Cottage", "Kitchen-Garden Cottage", "Millpond Storybook Cottage"],
    growth: "Gains charm: flower boxes & picket fence, a well and rose arbor, a kitchen garden, then a millpond with water wheel.",
    build: buildCottages,
  },
});

// =============================================================================================
// MEDIUM SIZED HOMES — suburban family homes
// =============================================================================================

/** Gambrel (Dutch-barn) roof along x over [x0,x1) x [z0,z1). Returns top y. */
function gambrel(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col: string, edge?: string): number {
  let yy = y;
  let k = 0;
  // steep lower slopes
  for (; k < 2 && z0 + k < z1 - k; k++) {
    v.box(x0, yy, z0 + k, x1, yy + 2, z1 - k, col);
    yy += 2;
  }
  // shallow upper slopes
  for (let i = k; z0 + i < z1 - i; i += 2) {
    v.box(x0, yy, z0 + i, x1, yy + 1, z1 - i, col);
    yy += 1;
  }
  if (edge) {
    v.box(x0, y, z0, x1, y + 1, z0 + 1, edge);
    v.box(x0, y, z1 - 1, x1, y + 1, z1, edge);
  }
  return yy;
}

/** Garage block (door faces +z). Returns roof top. */
function garage(c: Ctx, x0: number, z0: number, x1: number, z1: number, wall: string, roof: string, trim: string, kind: "gable" | "flat" | "hip", doors = 1): number {
  const v = c.v;
  v.box(x0, 1, z0, x1, 6, z1, wall);
  const w = x1 - x0;
  const dw = Math.floor((w - 1 - doors) / doors);
  for (let d = 0; d < doors; d++) {
    const dx = x0 + 1 + d * (dw + 1);
    v.box(dx, 1, z1 - 1, dx + dw, 5, z1, "white");
    for (let y = 2; y < 5; y++) v.box(dx, y, z1 - 1, dx + dw, y + 1, z1, y % 2 ? "silver" : "white");
    v.box(dx + 1, 4, z1 - 1, dx + dw - 1, 5, z1, "glassDark", 0.2);
  }
  v.box(x0, 5, z1 - 1, x1, 6, z1, trim);
  if (kind === "flat") return flatRoof(c, x0, 6, z0, x1, z1, "concreteDark", trim, false) + 1;
  if (kind === "hip") return hip(v, x0 - 1, 6, z0 - 1, x1 + 1, z1 + 1, roof, roof, 3);
  return gable(v, x0 - 1, 6, z0 - 1, x1 + 1, z1 + 1, "x", roof, trim);
}

/** Basketball hoop above a driveway, facing -z (backboard mounted at z) */
function hoop(v: PixelVox, x: number, z: number): void {
  v.box(x, 1, z, x + 1, 7, z + 1, "steelDark");
  v.box(x - 1, 7, z, x + 2, 9, z + 1, "white");
  v.put(x, 7, z - 1, "orange");
}

/**
 * MEDIUM SIZED HOME — the suburban dream, growing by add-ons.
 *  V0 60s split-level (staggered wings, stone veneer)   V1 Cape Cod (shingles, dormers, shutters)
 *  V2 Dutch Colonial (gambrel roof, shed dormer)         V3 Prairie (low hip, deep eaves, ribbon windows)
 */
function buildMediumHome(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass2");
  speckle(c, "grass3", 0.08);
  const wall = ["#efe2b4", "#a7b1ba", "#9c3b2e", "#e8d7b5"][s];
  const roof = ["woodDark", "slateLight", "#556b8a", "#5b6b4a"][s];
  const trim = ["white", "white", "cream", "woodDark"][s];
  const fh = 4;
  const twoStory = lv >= 3;

  // house occupies the left 16 voxels (1 tile), garage on the right
  const x0 = -hx + 2;
  const x1 = hx > 8 ? Math.min(-hx + 16, 2) : hx - 2;
  const z1 = hz - (hz > 8 ? 8 : 5);
  const z0 = Math.max(-hz + 2, z1 - 10);
  const cx = Math.floor((x0 + x1) / 2);

  // walk & lawn
  v.box(cx - 1, 0, z1, cx + 1, 1, hz, "path");

  let top = 0;
  if (s === 0) {
    // split-level: low living wing (left) + raised two-level bedroom wing (right)
    const mid = cx - 1;
    v.box(x0, 1, z0, mid, 1 + fh, z1, wall);
    v.box(x0, 1, z1 - 1, x0 + 4, 3, z1, "stone");
    v.box(x0 + 1, 2, z1 - 1, mid - 1, 4, z1, "glass", 0.45);
    for (let x = x0 + 2; x < mid - 1; x += 3) v.box(x, 2, z1 - 1, x + 1, 4, z1, trim);
    hip(v, x0 - 1, 1 + fh, z0 - 1, mid + 1, z1 + 1, roof, "woodDark", 2);
    const up = twoStory ? 3 * fh - 1 : 2 * fh;
    v.box(mid, 1, z0, x1, 1 + up, z1 - 1, wall);
    v.box(mid, 1, z1 - 2, x1, 3, z1 - 1, "stone");
    windows(c, mid, 2, z0, x1, 1 + up, z1 - 1, { faces: "se", stepV: fh, w: 2, h: 2, stepH: 4, emit: 0.45, startY: 2 });
    top = hip(v, mid - 1, 1 + up, z0 - 1, x1 + 1, z1, roof, "woodDark", 3);
    door(v, mid - 1, 1, z1 - 2, "orange");
  } else if (s === 1) {
    // Cape Cod: steep gable along x, dormers, shutters
    const floors = twoStory ? 2 : 1;
    const wt = 1 + floors * fh;
    v.box(x0, 1, z0, x1, wt, z1, wall);
    for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, wt, z1, "#9aa4ad");
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, 1, pz, px + 1, wt, pz + 1, trim);
    for (let f = 0; f < floors; f++) {
      for (const wx of [x0 + 2, x1 - 4]) {
        v.box(wx, 2 + f * fh, z1 - 1, wx + 2, 4 + f * fh, z1, "glass", 0.45);
        v.box(wx - 1, 2 + f * fh, z1, wx, 4 + f * fh, z1 + 1, "blueDark");
        v.box(wx + 2, 2 + f * fh, z1, wx + 3, 4 + f * fh, z1 + 1, "blueDark");
      }
    }
    windows(c, x0, 1, z0, x1, wt, z1, { faces: "e", stepV: fh, h: 2, emit: 0.45 });
    top = gable(v, x0 - 1, wt, z0 - 1, x1 + 1, z1 + 1, "x", roof, trim);
    // dormers
    for (const dx of [x0 + 2, cx - 1, x1 - 4]) {
      if (dx + 3 > x1) continue;
      v.box(dx, wt, z1 - 3, dx + 3, wt + 3, z1, "white");
      v.put(dx + 1, wt + 1, z1 - 1, "glass", 0.55);
      gable(v, dx - 1, wt + 3, z1 - 4, dx + 4, z1 + 1, "z", roof);
    }
    const ch = chimney(v, cx, top - 3, z0 + 3, 5, "brick");
    c.smoke(cx + 1, ch, z0 + 4, "smoke");
    door(v, cx - 1, 1, z1 - 1, "red");
  } else if (s === 2) {
    // Dutch colonial: brick-red walls, gambrel roof, long shed dormer
    const wt = 1 + fh;
    v.box(x0, 1, z0, x1, wt, z1, wall);
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, 1, pz, px + 1, wt, pz + 1, trim);
    windows(c, x0, 1, z0, x1, wt, z1, { stepV: fh, h: 2, w: 2, stepH: 4, emit: 0.45, sill: trim });
    top = gambrel(v, x0 - 1, wt, z0 - 1, x1 + 1, z1 + 1, roof, trim);
    // gambrel end walls
    v.box(x0, wt, z0 + 1, x0 + 1, top - 2, z1 - 1, wall);
    v.box(x1 - 1, wt, z0 + 1, x1, top - 2, z1 - 1, wall);
    v.put(x1 - 1, wt + 3, Math.floor((z0 + z1) / 2), "glass", 0.5);
    if (twoStory) {
      // shed dormer across the front = second storey
      v.box(x0 + 2, wt + 1, z1 - 2, x1 - 2, wt + 5, z1, "cream");
      for (let x = x0 + 3; x < x1 - 3; x += 3) v.box(x, wt + 2, z1 - 1, x + 2, wt + 4, z1, "glass", 0.5);
      v.box(x0 + 1, wt + 5, z1 - 3, x1 - 1, wt + 6, z1 + 1, roof);
    }
    // entry hood
    v.box(cx - 2, 4, z1, cx + 2, 5, z1 + 2, "cream");
    door(v, cx - 1, 1, z1 - 1, "#2f5d3a");
    const ch = chimney(v, x0 + 1, wt, z0 + 3, top - wt + 3, "brickDark");
    c.smoke(x0 + 2, ch, z0 + 4, "smoke");
  } else {
    // Prairie: long low hip roof with deep eaves, banded walls, ribbon windows
    const floors = twoStory ? 2 : 1;
    const wt = 1 + floors * fh;
    v.box(x0, 1, z0, x1, wt, z1, wall);
    v.box(x0, 1, z0, x1, 2, z1, "brick");
    for (let f = 0; f < floors; f++) {
      v.box(x0, 1 + f * fh + fh - 1, z0, x1, 2 + f * fh + fh - 1, z1, "woodDark");
      v.box(x0 + 1, 2 + f * fh, z1 - 1, x1 - 1, 4 + f * fh, z1, "glass", 0.45);
      for (let x = x0 + 2; x < x1 - 1; x += 3) v.box(x, 2 + f * fh, z1 - 1, x + 1, 4 + f * fh, z1, "woodDark");
    }
    windows(c, x0, 1, z0, x1, wt, z1, { faces: "e", stepV: fh, h: 2, emit: 0.45 });
    if (floors === 2) {
      hip(v, x0 - 3, 1 + fh, z0 - 3, x1 + 3, z1 + 3, roof, roof, 1);
    }
    top = hip(v, x0 - 3, wt, z0 - 3, x1 + 3, z1 + 3, roof, "#47563a", 3);
    const ch = chimney(v, cx - 1, wt, z0 + 2, top - wt + 2, "brick", 3);
    c.smoke(cx, ch, z0 + 3, "smoke");
    // urns
    for (const ux of [cx - 4, cx + 3]) {
      v.box(ux, 1, z1 + 1, ux + 1, 2, z1 + 2, "brick");
      v.put(ux, 2, z1 + 1, "leaf");
      v.put(ux, 3, z1 + 1, "red");
    }
    door(v, cx - 1, 1, z1 - 1, "woodDark");
  }
  if (lv >= 3) {
    // front porch / stoop with bench
    v.box(cx - 3, 1, z1, cx + 3, 2, z1 + 2, "concrete");
    tree(v, x0 + 1, 1, hz - 3, s === 1 ? "birch" : s === 3 ? "oak" : "round", 1.2, s);
  }
  bush(v, x0 + 1, 1, z1 + 1, 1.1, "leaf", lv >= 2 ? "pink" : undefined);
  bush(v, x1 - 2, 1, z1 + 1, 1.1, "leafDark");
  // mailbox
  v.box(cx + 3, 1, hz - 2, cx + 4, 3, hz - 1, "steelDark");
  v.box(cx + 3, 3, hz - 2, cx + 5, 4, hz - 1, s === 0 ? "orange" : "blue");

  if (lv >= 2 && hx > 8) {
    // attached garage + driveway + car + basketball hoop
    const gx0 = x1;
    const gx1 = Math.min(hx - 2, x1 + 12);
    const gz1 = z1;
    const gz0 = gz1 - 8;
    garage(c, gx0, gz0, gx1, gz1, s === 1 ? "white" : wall, roof, trim, s === 3 ? "hip" : s === 0 ? "hip" : "gable", lv >= 4 ? 2 : 1);
    v.box(gx0 + 1, 0, gz1, gx1 - 1, 1, hz, "concrete2");
    car(v, gx0 + 4, 1, gz1 + 4, "z", c.vpick(["teal", "red", "silver", "orange"]));
    if (lv >= 4) car(v, gx1 - 4, 1, gz1 + 3, "z", c.vpick(["white", "sky", "charcoal", "yellow"]));
    hoop(v, gx1 - 1, gz1);
    if (lv >= 3) {
      // kid's bike & chalk
      v.put(gx0 + 6, 0, gz1 + 6, "pink");
      v.put(gx0 + 7, 0, gz1 + 6, "yellow");
    }
  }
  if (lv >= 4 && hz > 8) {
    // backyard: deck, trampoline, shed, BBQ
    const bz0 = -hz + 1;
    v.box(x0, 1, z0 - 4, x1, 2, z0, "wood");
    for (let x = x0; x < x1; x += 2) v.put(x, 2, z0 - 4, "woodDark");
    grill(c, x0 + 2, z0 - 2);
    picnicTable(v, x0 + 5, z0 - 2, "woodLight");
    // trampoline
    const tx = 8;
    const tz = bz0 + 6;
    v.cylinderY(tx, tz, 3, 4, 3.6, "black");
    v.cylinderY(tx, tz, 3, 4, 2.6, "#2b2f3a");
    for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) v.box(tx + dx, 1, tz + dz, tx + dx + 1, 3, tz + dz + 1, "steelDark");
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      v.box(Math.round(tx + Math.cos(ang) * 3.6), 4, Math.round(tz + Math.sin(ang) * 3.6), Math.round(tx + Math.cos(ang) * 3.6) + 1, 6, Math.round(tz + Math.sin(ang) * 3.6) + 1, a % 3 ? "#5bb0e8" : "blue");
    }
    // shed
    v.box(hx - 7, 1, bz0 + 1, hx - 2, 5, bz0 + 5, "#8fbf9a");
    gable(v, hx - 8, 5, bz0, hx - 1, bz0 + 6, "x", roof, "white");
    v.box(hx - 5, 1, bz0 + 4, hx - 3, 4, bz0 + 5, "white");
    fence(v, -hx + 1, -hz + 1, hx - 1, z0 + 1, 1, 3, "woodLight");
  }
  if (lv >= 5 && hz > 8) {
    // sunroom, hot tub & treehouse
    v.box(x1 - 6, 1, z0 - 4, x1 - 1, 5, z0, "glass", 0.35);
    v.box(x1 - 6, 5, z0 - 4, x1 - 1, 6, z0, "white");
    const htx = x0 + 2;
    const htz = -hz + 3;
    v.box(htx, 1, htz, htx + 5, 3, htz + 5, "woodDark");
    v.box(htx + 1, 2, htz + 1, htx + 4, 3, htz + 4, "cyan", 0.4);
    c.smoke(htx + 2, 3, htz + 2, "steam");
    // treehouse in a big oak
    const ox = -2;
    const oz = -hz + 4;
    v.box(ox, 1, oz, ox + 2, 10, oz + 2, "woodDark");
    v.box(ox - 3, 9, oz - 2, ox + 4, 10, oz + 4, "woodLight");
    v.box(ox - 2, 10, oz - 1, ox + 3, 14, oz + 3, "wood");
    v.box(ox - 1, 11, oz + 2, ox + 1, 13, oz + 3, "glass", 0.5);
    gable(v, ox - 3, 14, oz - 2, ox + 4, oz + 4, "x", "red");
    v.sphere(ox + 1, 16, oz + 1, 5, 3, 4.5, "leaf");
    for (let y = 1; y < 9; y += 2) v.put(ox + 2, y, oz + 2, "woodLight");
    // RV/boat parked by the garage
    if (hx > 8) {
      v.box(hx - 3, 1, -2, hx - 1, 3, 6, "white");
      v.box(hx - 3, 3, 0, hx - 1, 4, 4, "blue");
    }
  }
}

// =============================================================================================
// TOWNHOMES — rowhouses
// =============================================================================================

/**
 * One townhouse unit [x0,x1) wide, body from z0 to zf (front face at zf-1), `floors` storeys.
 * st 0 brownstone · 1 painted lady · 2 Amsterdam canal house · 3 modern row
 */
function townUnit(c: Ctx, x0: number, x1: number, z0: number, zf: number, floors: number, st: number, idx: number, lv: number): void {
  const v = c.v;
  const fh = 4;
  const w = x1 - x0;
  const cx = x0 + Math.floor(w / 2);
  const base = st === 0 ? 3 : st === 1 ? 2 : 1; // raised parlour floors
  const top = base + floors * fh;
  if (st === 0) {
    const wall = ["#7a4a36", "#8a5640", "brick2", "#6b3f2e"][idx % 4];
    v.box(x0, 1, z0, x1, top, zf, wall);
    v.box(x0, 1, zf - 1, x1, base, zf, "#5a3527");
    v.box(x0, top - 1, z0, x1, top, zf, wall);
    // heavy cornice
    v.box(x0, top, z0, x1, top + 1, zf + 1, "#3b2a20");
    v.box(x0, top + 1, z0, x1, top + 2, zf, "#3b2a20");
    for (let x = x0; x < x1; x += 2) v.put(x, top - 1, zf, "#3b2a20");
    // tall windows with limestone lintels
    for (let f = 0; f < floors; f++) {
      for (const wx of [x0 + 1, x1 - 3]) {
        if (f === 0 && wx === x0 + 1) continue;
        v.box(wx, base + f * fh + 1, zf - 1, wx + 2, base + f * fh + 3 + (f === 0 ? 1 : 0), zf, "glass", 0.45);
        v.box(wx, base + f * fh + 3 + (f === 0 ? 1 : 0), zf - 1, wx + 2, base + f * fh + 4 + (f === 0 ? 1 : 0), zf, "limestone");
      }
    }
    // stoop
    const dx = x0 + 1;
    v.box(dx, base, zf - 1, dx + 2, base + 3, zf, "woodDark");
    v.put(dx, base + 3, zf - 1, "limestone");
    v.put(dx + 1, base + 3, zf - 1, "limestone");
    for (let sidx = 0; sidx < base; sidx++) v.box(dx - 1, 1, zf + sidx, dx + 3, base - sidx, zf + sidx + 1, "#8a6a58");
    for (let sidx = 0; sidx < base; sidx++) {
      v.put(dx - 1, base - sidx, zf + sidx, "iron");
      v.put(dx + 2, base - sidx, zf + sidx, "iron");
    }
    v.put(dx + 2, base + 2, zf, "warmGlow", 1);
  } else if (st === 1) {
    const wall = ["pink", "#9fd8c4", "#c2a8e0", "yellow", "sky"][idx % 5];
    const trimC = "white";
    v.box(x0, 1, z0, x1, top, zf, wall);
    v.box(x0, 1, zf - 1, x1, 2, zf, "slateLight");
    v.box(x0, 1, z0, x0 + 1, top, zf, trimC);
    // two-storey bay window
    const bx0 = x0 + 1;
    const bx1 = bx0 + 3;
    for (let f = 0; f < Math.min(2, floors); f++) {
      v.box(bx0, base + f * fh, zf, bx1, base + f * fh + fh, zf + 1, wall);
      v.box(bx0, base + f * fh + 1, zf, bx1, base + f * fh + 3, zf + 1, "glass", 0.5);
      v.box(bx0, base + f * fh + fh - 1, zf, bx1, base + f * fh + fh, zf + 1, trimC);
    }
    for (let f = 2; f < floors; f++) v.box(bx0, base + f * fh + 1, zf - 1, bx1, base + f * fh + 3, zf, "glass", 0.5);
    v.box(x1 - 3, 2, zf - 1, x1 - 1, 5, zf, ["crimson", "teal", "purpleDark", "orange"][idx % 4]);
    v.box(x1 - 3, 5, zf - 1, x1 - 1, 6, zf, trimC);
    v.box(x1 - 4, 1, zf, x1, 2, zf + 2, "white");
    for (let f = 1; f < floors; f++) v.box(x1 - 3, base + f * fh + 1, zf - 1, x1 - 1, base + f * fh + 3, zf, "glass", 0.45);
    // street-facing gable (ridge along z) with trim
    const rise = Math.ceil(w / 2);
    for (let sidx = 0; sidx < rise; sidx++) {
      v.box(x0 + sidx, top + sidx, z0, x1 - sidx, top + sidx + 1, zf + 1, sidx === rise - 1 ? trimC : ["slate", "purpleDark", "tealDark", "redDark"][idx % 4]);
      v.box(x0 + sidx + 1, top + sidx, zf, x1 - sidx - 1, top + sidx + 1, zf + 1, wall);
      v.put(x0 + sidx, top + sidx, zf + 1, trimC);
      v.put(x1 - sidx - 1, top + sidx, zf + 1, trimC);
    }
    v.put(cx, top + 1, zf + 1, "glass", 0.6);
    v.box(x0, top - 1, zf - 1, x1, top, zf + 1, trimC);
  } else if (st === 2) {
    const wall = ["#5a3a2c", "#2c2a30", "#7a3a2c", "#3e5a48", "cream"][idx % 5];
    const ftop = top + (idx % 2) * 2;
    v.box(x0, 1, z0, x1, ftop, zf, wall);
    // big windows with white frames
    for (let f = 0; f < floors + (idx % 2 ? 0 : 0); f++) {
      for (const wx of [x0 + 1, x1 - 3]) {
        v.box(wx, base + f * fh + 1, zf - 1, wx + 2, base + f * fh + 3, zf, "glass", 0.45);
        v.box(wx, base + f * fh + 3, zf - 1, wx + 2, base + f * fh + 4, zf, "white");
      }
    }
    v.box(cx - 1, 1, zf - 1, cx + 1, 4, zf, "#2f5d3a");
    // gable top: stepped / bell / spout by index
    const kind = idx % 3;
    v.box(x0, ftop - 1, zf - 1, x1, ftop, zf, "white");
    if (kind === 0) {
      for (let sidx = 0; sidx < Math.ceil(w / 2); sidx++) {
        if ((sidx & 1) === 0) v.box(x0 + sidx, ftop + sidx, z0 + 2, x1 - sidx, ftop + sidx + 2, zf, wall);
        v.put(x0 + sidx, ftop + sidx + 1, zf - 1, "white");
        v.put(x1 - sidx - 1, ftop + sidx + 1, zf - 1, "white");
      }
    } else if (kind === 1) {
      v.box(x0 + 1, ftop, z0 + 2, x1 - 1, ftop + 2, zf, wall);
      v.box(x0 + 2, ftop + 2, z0 + 2, x1 - 2, ftop + 5, zf, wall);
      v.box(x0 + 2, ftop + 5, z0 + 2, x1 - 2, ftop + 6, zf, "white");
      v.put(x0 + 1, ftop + 2, zf - 1, "white");
      v.put(x1 - 2, ftop + 2, zf - 1, "white");
    } else {
      for (let sidx = 0; sidx < Math.ceil(w / 2); sidx++) v.box(x0 + sidx, ftop + sidx, z0 + 2, x1 - sidx, ftop + sidx + 1, zf, wall);
      v.box(cx - 1, ftop + Math.ceil(w / 2), z0 + 2, cx + 1, ftop + Math.ceil(w / 2) + 1, zf, "white");
    }
    // pitched roof behind the gable
    gable(v, x0, ftop, z0, x1, zf - 2, "z", "#3b3f48");
    // hoist beam
    v.box(cx, ftop + 2, zf - 1, cx + 1, ftop + 3, zf + 2, "woodDark");
    v.put(cx, ftop + 1, zf + 1, "iron");
    v.put(cx, ftop + 2, zf - 1, "glass", 0.6);
  } else {
    const wall = ["white", "#3a3d45", "woodLight", "#e6e2da"][idx % 4];
    v.box(x0, 1, z0, x1, top, zf, wall);
    v.box(x0, 1, z0, x0 + 1, top + 1, zf, "#2a2c33");
    // floor-to-ceiling glass, offset per floor
    for (let f = 0; f < floors; f++) {
      const off = (f + idx) % 2;
      v.box(x0 + 1 + off * 2, base + f * fh, zf - 1, x0 + 1 + off * 2 + 4, base + f * fh + 3, zf, "glass", 0.5);
      v.box(x0 + 1, base + f * fh + fh - 1, zf - 1, x1, base + f * fh + fh, zf + (f === 0 ? 2 : 1), "#2a2c33");
    }
    // roof terrace with planters & glass rail
    flatRoof(c, x0, top, z0, x1, zf, "woodLight", "glass", false);
    v.box(x0 + 1, top, z0 + 1, x0 + 4, top + 3, z0 + 4, wall);
    if (lv >= 3) {
      bush(v, x1 - 2, top + 1, zf - 2, 1, "leaf", idx % 2 ? "pink" : undefined);
      v.box(x0 + 1, top + 1, zf - 4, x0 + 4, top + 2, zf - 3, "red");
    }
    if (lv >= 4) solar(v, x0 + 1, x1 - 1, top + 1, z0 + 5);
  }
}

/**
 * TOWNHOMES — rows that get longer and taller (sprawl along the street, then up).
 *  V0 Brooklyn brownstones (stoops, cornices)   V1 San Francisco "painted ladies" (bays, gables)
 *  V2 Amsterdam canal houses (stepped/bell gables, hoist beams, canal)   V3 modern rows (roof terraces)
 */
function buildTownhomes(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, s === 2 ? "concrete2" : "grass2");
  const floors = byLv5(lv, [2, 3, 3, 4, 4]);
  const unitW = s === 2 ? 7 : 8;
  const corner = hz > 8;
  // front row
  const zf = hz - 5;
  const z0 = corner ? zf - 11 : -hz + 1;
  const sideW = corner ? 16 : 0; // depth reserved for the side row on +x
  // street & sidewalk / canal along the front
  if (s === 2 && lv >= 3) {
    v.box(-hx, 0, hz - 4, hx, 1, hz, "waterDeep", 0.08);
    v.box(-hx, 0, hz - 5, hx, 1, hz - 4, "granite");
  } else {
    v.box(-hx, 0, zf, hx, 1, hz - 2, "concrete");
    v.box(-hx, 0, hz - 2, hx, 1, hz, "asphalt");
  }
  const n = Math.floor((hx * 2 - sideW) / unitW);
  const startX = corner ? -hx : -Math.floor((n * unitW) / 2);
  for (let i = 0; i < n; i++) {
    const ux0 = startX + i * unitW;
    townUnit(c, ux0, ux0 + unitW, z0, zf, floors, s, i + s * 2 + lv, lv);
  }
  if (corner) {
    // corner terrace: a second row facing +x down the side street, around a garden square
    const m = Math.floor((zf + hz - 2) / unitW);
    for (let i = 0; i < m; i++) {
      // scratch coords: unit along x (front +z) -> world: along -z, facing +x
      stampRotated(c, "e", hx - 5, -hz + 1 + i * unitW + unitW, (cc) => {
        townUnit(cc, 0, unitW, -11, 0, floors, s, i + 5 + s, lv);
      });
    }
    v.box(hx - 5, 0, -hz, hx, 1, zf, "concrete");
    // garden square behind the front row
    const gx1 = hx - 17;
    v.box(-hx + 1, 0, -hz + 1, gx1, 1, z0 - 1, "grass");
    for (let x = -hx + 3; x < gx1 - 1; x += 7) tree(v, x, 1, -hz + 3, s === 1 ? "blossom" : "round", 0.9, x);
    const fx = Math.floor((-hx + gx1) / 2);
    v.cylinderY(fx, z0 - 5, 1, 2, 2.5, "marble");
    v.cylinderY(fx, z0 - 5, 1, 2, 1.6, "water", 0.2);
    v.put(fx, 2, z0 - 5, "foam", 0.4);
    v.put(fx, 3, z0 - 5, "foam", 0.4);
  }
  // street life
  for (let i = 0; i < n; i++) {
    const ux0 = startX + i * unitW;
    if (lv >= 3 && i % 2 === 0 && !(s === 2 && lv >= 3)) tree(v, ux0 + unitW - 1, 1, hz - 3, s === 1 ? "blossom" : "round", 0.9, i);
    if (s === 2) {
      // bikes everywhere
      v.box(ux0 + 1, 1, zf + 1, ux0 + 4, 2, zf + 2, c.pick(["black", "red", "blueDark", "white"]));
    }
  }
  if (lv >= 2) {
    for (let x = -hx + 2; x < hx; x += 12) {
      v.box(x, 1, hz - 3, x + 1, 6, hz - 2, "iron");
      v.put(x, 6, hz - 3, "warmGlow", 1.2);
    }
  }
  if (s === 2 && lv >= 3) {
    // canal boat
    const bx = -hx + 6;
    v.box(bx, 1, hz - 3, bx + 12, 2, hz - 1, "#2f5d3a");
    v.box(bx + 2, 2, hz - 3, bx + 10, 4, hz - 1, "cream");
    v.box(bx + 3, 3, hz - 1, bx + 9, 4, hz, "glass", 0.4);
    c.bob();
  } else if (lv >= 2) {
    car(v, -hx + 6, 1, hz - 1, "x", c.pick(["red", "teal", "yellow", "white"]));
  }
  if (lv >= 4) {
    folk(c, 0, hz - 4);
    folk(c, -5, hz - 3);
  }
}

/** byLv without needing a Ctx */
function byLv5<T>(lv: number, arr: readonly [T, T, T, T, T]): T {
  return arr[Math.max(1, Math.min(5, lv)) - 1];
}

defineDesigns({
  medium_sized_homes: {
    footprints: [[1, 1], [2, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Split-Level Starter", "Garage & Hoop Home", "Second-Story Add-On", "Backyard BBQ Home", "Cul-de-Sac Dream Home"],
    growth: "Adds a garage & driveway, a second storey, then a backyard with deck, trampoline, hot tub and treehouse.",
    build: buildMediumHome,
  },
  townhomes: {
    footprints: [[1, 1], [2, 1], [2, 1], [3, 1], [3, 2]],
    levels: ["Twin Rowhouses", "Four-House Row", "Stoop-Lined Terrace", "Block-Long Terrace", "Garden-Square Terraces"],
    growth: "The row gets longer and taller, gains stoops, street trees and lamps, then a second row around a mews garden.",
    build: buildTownhomes,
  },
});

// =============================================================================================
// LARGE HOMES — big suburban houses on bigger lots
// =============================================================================================

/** Two-storey portico with columns + pediment on the +z face */
function portico(v: PixelVox, x0: number, x1: number, zf: number, h: number, col = "white"): void {
  v.box(x0, 1, zf, x1, 2, zf + 3, "marbleShade");
  for (let x = x0; x < x1; x += 2) v.box(x, 2, zf + 2, x + 1, h, zf + 3, col);
  v.box(x0, h, zf, x1, h + 1, zf + 3, col);
  const w = x1 - x0;
  for (let s = 0; s < Math.ceil(w / 4); s++) v.box(x0 + s * 2, h + 1 + s, zf, x1 - s * 2, h + 2 + s, zf + 3, col);
}

/** Kidney-ish free-form pool */
function blobPool(v: PixelVox, cx: number, cz: number, rx: number, rz: number, rim = "white"): void {
  for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
      const wob = 1 + 0.25 * Math.sin((x - cx) * 0.7);
      const d = ((x - cx) / rx) ** 2 + ((z - cz) / (rz * wob)) ** 2;
      if (d <= 1.25) v.put(x, 0, z, rim);
      if (d <= 0.85) v.put(x, 0, z, "cyan", 0.15);
    }
  }
}

/**
 * LARGE HOME — a big family house whose lot keeps growing into an estate.
 *  V0 Colonial Revival (brick, white portico)   V1 Tudor (half-timber, cross gables)
 *  V2 Modern farmhouse (white board & batten, black metal roof)   V3 Mid-century modern (butterfly roof, breeze blocks)
 */
function buildLargeHome(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass2");
  speckle(c, "grass3", 0.07);
  const fh = 4;
  const wt = 1 + 2 * fh;

  // main house placement: left part of lot, front yard toward +z
  const bw = hx > 16 || lv < 2 ? 22 : 17;
  const x0 = -hx + 3;
  const x1 = x0 + bw;
  const zf = Math.min(hz - 6, 4);
  const z0 = zf - 10;
  const cx = x0 + bw / 2;
  v.box(cx - 1, 0, zf, cx + 1, 1, hz, "path");

  if (s === 0) {
    v.box(x0, 1, z0, x1, wt, zf, "brick");
    v.box(x0, fh, z0, x1, fh + 1, zf, "white");
    v.box(x0, 1, z0, x1, 2, zf, "brickDark");
    for (let f = 0; f < 2; f++) {
      for (let x = x0 + 2; x < x1 - 2; x += 3) {
        if (Math.abs(x + 0.5 - cx) < 3) continue;
        v.box(x, 2 + f * fh, zf - 1, x + 1, 4 + f * fh, zf, "glass", 0.45);
        v.box(x - 1, 2 + f * fh, zf, x, 4 + f * fh, zf + 1, "black");
        v.box(x + 1, 2 + f * fh, zf, x + 2, 4 + f * fh, zf + 1, "black");
      }
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 2, emit: 0.45, sill: "white" });
    const top = gable(v, x0 - 1, wt, z0 - 1, x1 + 1, zf + 1, "x", "slate", "white");
    for (const dx of [x0 + 4, x1 - 6]) {
      v.box(dx, wt, zf - 3, dx + 3, wt + 3, zf, "white");
      v.put(dx + 1, wt + 1, zf - 1, "glass", 0.55);
      gable(v, dx - 1, wt + 3, zf - 4, dx + 4, zf + 1, "z", "slate");
    }
    for (const chx of [x0, x1 - 2]) chimney(v, chx, wt, z0 + 4, top - wt + 3, "brickDark", 2, "white");
    portico(v, Math.floor(cx) - 3, Math.floor(cx) + 4, zf, wt);
    door(v, Math.floor(cx) - 1, 1, zf - 1, "black");
  } else if (s === 1) {
    v.box(x0, 1, z0, x1, 1 + fh, zf, "brick");
    v.box(x0, 1 + fh, z0, x1, wt, zf, "cream");
    for (let x = x0; x < x1; x += 2) v.box(x, 1 + fh, zf - 1, x + 1, wt, zf, "woodDark");
    v.box(x0, 1 + fh, zf - 1, x1, 2 + fh, zf, "woodDark");
    for (let x = x0 + 1; x < x1 - 1; x += 4) {
      v.put(x, 6, zf - 1, "woodDark");
      v.put(x + 1, 7, zf - 1, "woodDark");
    }
    for (let x = x0 + 2; x < x1 - 2; x += 4) {
      v.box(x, 2, zf - 1, x + 2, 4, zf, "glass", 0.45);
      v.box(x + 1, 6, zf - 1, x + 2, 8, zf, "glass", 0.45);
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 2, emit: 0.45 });
    gable(v, x0 - 1, wt, z0 - 1, x1 + 1, zf + 1, "x", "#4a3f3a", "woodDark");
    // steep cross gables facing the street
    const cgs: [number, number, number][] = [[x0 + 1, x0 + 9, 0], [x1 - 7, x1 - 1, 3]];
    for (const [gx0, gx1, extra] of cgs) {
      v.box(gx0, 1, zf - 2, gx1, wt + extra, zf + 2, "cream");
      v.box(gx0, 1, zf + 1, gx1, 1 + fh, zf + 2, "brick");
      const w = gx1 - gx0;
      for (let st = 0; st < Math.ceil(w / 2); st++) {
        v.box(gx0 - 1 + st, wt + extra + st * 2, zf - 4, gx1 + 1 - st, wt + extra + st * 2 + 2, zf + 3, "#4a3f3a");
        v.box(gx0 + st, wt + extra + st * 2, zf + 2, gx1 - st, wt + extra + st * 2 + 2, zf + 3, "cream");
        v.put(gx0 + st, wt + extra + st * 2, zf + 2, "woodDark");
        v.put(gx1 - st - 1, wt + extra + st * 2, zf + 2, "woodDark");
      }
      for (let y = 1 + fh; y < wt + extra + 3; y += 1) v.put(Math.floor((gx0 + gx1) / 2), y, zf + 2, "woodDark");
      v.box(gx0 + 1, 6, zf + 2, gx1 - 1, 8, zf + 3, "glass", 0.5);
      for (let x = gx0 + 1; x < gx1 - 1; x += 2) v.box(x, 6, zf + 2, x + 1, 8, zf + 3, "woodDark");
      v.box(gx0 + 1, 2, zf + 2, gx1 - 1, 4, zf + 3, "glass", 0.45);
    }
    // arched door + tall clustered chimney
    v.box(Math.floor(cx) - 1, 1, zf - 1, Math.floor(cx) + 1, 4, zf, "woodDark");
    v.put(Math.floor(cx) - 1, 4, zf - 1, "brick");
    const ch = chimney(v, Math.floor(cx) + 2, 2, z0 + 1, wt + 9, "brickDark", 3, "brick");
    v.box(Math.floor(cx) + 2, ch, z0 + 1, Math.floor(cx) + 3, ch + 2, z0 + 2, "brick");
    v.box(Math.floor(cx) + 4, ch, z0 + 3, Math.floor(cx) + 5, ch + 2, z0 + 4, "brick");
    c.smoke(Math.floor(cx) + 2, ch + 2, z0 + 1, "smoke");
  } else if (s === 2) {
    v.box(x0, 1, z0, x1, wt, zf, "white");
    for (let x = x0; x < x1; x += 2) {
      v.box(x, 1, zf - 1, x + 1, wt, zf, "cream");
      v.box(x, 1, z0, x + 1, wt, z0 + 1, "cream");
    }
    for (let f = 0; f < 2; f++) {
      for (let x = x0 + 2; x < x1 - 2; x += 5) {
        v.box(x, 2 + f * fh, zf - 1, x + 3, 4 + f * fh + (f === 0 ? 1 : 0), zf, "charcoal");
        v.box(x + 1, 2 + f * fh, zf - 1, x + 2, 4 + f * fh + (f === 0 ? 1 : 0), zf, "glass", 0.5);
        v.put(x, 3 + f * fh, zf - 1, "glass", 0.5);
        v.put(x + 2, 3 + f * fh, zf - 1, "glass", 0.5);
      }
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, w: 2, h: 2, emit: 0.45, col: "glass" });
    // black standing-seam metal roofs: long side gable + tall front gable
    gable(v, x0 - 1, wt, z0 - 1, x1 + 1, zf + 1, "x", "charcoal", "black");
    const gx0 = Math.floor(cx) - 4;
    const gx1 = Math.floor(cx) + 4;
    for (let st = 0; st < 5; st++) {
      v.box(gx0 - 1 + st, wt + st * 2, z0 + 2, gx1 + 1 - st, wt + st * 2 + 2, zf + 2, "charcoal");
      v.box(gx0 + st, wt + st * 2, zf + 1, gx1 - st, wt + st * 2 + 2, zf + 2, "white");
    }
    for (let x = x0; x < x1; x += 3) v.put(x, wt + 1, zf, "steelDark");
    v.box(Math.floor(cx) - 1, wt + 2, zf + 1, Math.floor(cx) + 1, wt + 5, zf + 2, "glass", 0.55);
    // wraparound porch with wood posts
    v.box(x0, 1, zf, x1, 2, zf + 4, "woodLight");
    for (let x = x0; x < x1; x += 4) v.box(x, 2, zf + 3, x + 1, 1 + fh, zf + 4, "wood");
    v.box(x0 - 1, 1 + fh, zf, x1 + 1, 2 + fh, zf + 5, "charcoal");
    door(v, Math.floor(cx) - 1, 2, zf - 1, "black");
    for (const lx of [Math.floor(cx) - 3, Math.floor(cx) + 2]) v.put(lx, 4, zf, "warmGlow", 1);
    chimney(v, x1 - 4, wt, z0 + 2, 9, "white", 2, "black");
  } else {
    // mid-century modern: low single storey + raised clerestory, butterfly roof
    const h = 7;
    v.box(x0, 1, z0, x1, h, zf, "woodLight");
    for (let x = x0; x < x1; x += 2) v.box(x, 1, zf - 1, x + 1, h, zf, "wood");
    v.box(x0 + 2, 1, zf - 1, x0 + 10, h - 1, zf, "glass", 0.5);
    for (let x = x0 + 2; x < x0 + 10; x += 3) v.box(x, 1, zf - 1, x + 1, h - 1, zf, "charcoal");
    v.box(x1 - 7, 1, zf - 1, x1, h, zf, "stone");
    for (let y = 1; y < h; y++) for (let x = x1 - 7; x < x1; x++) if (hash01(x, y) < 0.3) v.put(x, y, zf - 1, "granite");
    v.box(Math.floor(cx), 1, zf - 1, Math.floor(cx) + 2, 5, zf, "orange");
    windows(c, x0, 1, z0, x1, h, zf, { faces: "e", stepH: 2, h: 3, emit: 0.45, startY: 1 });
    // butterfly roof: two slabs sloping DOWN to the middle, wide overhangs
    const mid = Math.floor(cx);
    for (let x = x0 - 2; x < x1 + 2; x++) {
      const d = Math.abs(x + 0.5 - mid);
      const y = h + Math.floor(d / 4);
      v.box(x, y, z0 - 2, x + 1, y + 1, zf + 3, "white");
      if (y > h) v.box(x, h, zf - 1, x + 1, y, zf, "glass", 0.55);
      if (y > h) v.box(x, h, z0, x + 1, y, z0 + 1, "glass", 0.4);
    }
    // breeze-block privacy screen
    for (let x = x0 + 11; x < x0 + 18; x++) {
      for (let y = 1; y < 6; y++) {
        v.put(x, y, zf + 3, (x + y) % 2 === 0 ? "white" : (y % 2 ? "orange" : "white"));
      }
    }
    v.clear(x0 + 12, 2, zf + 3, x0 + 13, 3, zf + 4);
    v.clear(x0 + 14, 4, zf + 3, x0 + 15, 5, zf + 4);
    v.clear(x0 + 16, 2, zf + 3, x0 + 17, 3, zf + 4);
    tree(v, x0 + 1, 1, zf + 3, "palm", 1.2, 1);
  }
  // shrubs + lawn lamps
  for (let x = x0 + 1; x < x1 - 1; x += 4) bush(v, x, 1, zf + (s === 2 ? 5 : 1), 1.0, s === 1 ? "leafDark" : "leaf", lv >= 3 ? "white" : undefined);

  // ---- garage wing (L2+) ----
  const gx0 = x1 + 1;
  const gx1 = Math.min(hx - 1, gx0 + 15);
  if (lv >= 2 && gx1 - gx0 >= 10) {
    const gz1 = zf - 1;
    const gz0 = gz1 - 9;
    const gw = ["brick", "cream", "white", "woodLight"][s];
    const gr = ["slate", "#4a3f3a", "charcoal", "white"][s];
    garage(c, gx0, gz0, gx1, gz1, gw, gr, s === 2 ? "black" : "white", s === 3 ? "flat" : "gable", 3);
    v.box(gx0, 0, gz1, gx1, 1, hz, "concrete2");
    car(v, gx0 + 3, 1, gz1 + 4, "z", ["crimson", "blueDark", "black", "teal"][s]);
    car(v, gx0 + 8, 1, gz1 + 5, "z", "silver");
  }
  // ---- pool & patio in the back (L3+) ----
  if (lv >= 3 && hz > 8) {
    const pz = -hz + 4;
    if (s === 3) blobPool(v, x0 + 10, pz + 2, 7, 3);
    else pool(v, x0 + 2, pz - 2, x0 + 18, pz + 5, s === 0 ? "marble" : "white");
    v.box(x0 + 20, 0, pz - 2, x1, 1, z0, "concrete");
    for (const lx of [x0 + 4, x0 + 8, x0 + 12]) lawnChair(v, lx, pz + 7, "white");
    v.box(x0 + 21, 1, pz, x0 + 22, 5, pz + 1, "white");
    v.cylinderY(x0 + 21.5, pz + 0.5, 5, 6, 2.5, s === 0 ? "blue" : s === 1 ? "redDark" : s === 2 ? "white" : "orange");
    hedge(v, -hx + 1, -hz + 1, hx - 1, -hz + 2);
  }
  // ---- circular drive + fountain + pool house (L4+) ----
  if (lv >= 4 && hx > 16) {
    const fx = hx - 10;
    const fz = hz - 7;
    for (let x = fx - 7; x <= fx + 7; x++) {
      for (let z = fz - 6; z <= fz + 6; z++) {
        const d = Math.hypot(x - fx, (z - fz) * 1.15);
        if (d <= 7 && d >= 3.5) v.put(x, 0, z, "path2");
      }
    }
    v.cylinderY(fx, fz, 1, 2, 3, "marble");
    v.cylinderY(fx, fz, 1, 2, 2.2, "water", 0.15);
    v.box(fx, 1, fz, fx + 1, 5, fz + 1, "marble");
    v.put(fx, 5, fz, "foam", 0.5);
    car(v, fx, 1, fz + 5, "x", "black");
    // pool house / guest cottage in back-right
    const phx = hx - 16;
    const phz = -hz + 2;
    v.box(phx, 1, phz, phx + 12, 6, phz + 8, s === 0 ? "brick" : s === 1 ? "cream" : s === 2 ? "white" : "woodLight");
    v.box(phx + 2, 1, phz + 7, phx + 10, 5, phz + 8, "glass", 0.45);
    if (s === 3) flatRoof(c, phx - 1, 6, phz - 1, phx + 13, phz + 9, "white", "white", false);
    else gable(v, phx - 1, 6, phz - 1, phx + 13, phz + 9, "x", ["slate", "#4a3f3a", "charcoal", "white"][s]);
  }
  // ---- tennis court + gazebo + gate (L5) ----
  if (lv >= 5 && hz > 16) {
    const tx0 = 2;
    const tz0 = -hz + 12;
    const tx1 = hx - 2;
    const tz1 = tz0 + 14;
    v.box(tx0, 0, tz0, tx1, 1, tz1, "#3f8f5a");
    v.box(tx0 + 2, 0, tz0 + 2, tx1 - 2, 1, tz1 - 2, "#4a8fd0");
    v.box(tx0 + 2, 0, tz0 + 2, tx1 - 2, 1, tz0 + 3, "white");
    v.box(tx0 + 2, 0, tz1 - 3, tx1 - 2, 1, tz1 - 2, "white");
    v.box(tx0 + 2, 0, tz0 + 2, tx0 + 3, 1, tz1 - 2, "white");
    v.box(tx1 - 3, 0, tz0 + 2, tx1 - 2, 1, tz1 - 2, "white");
    const mx = Math.floor((tx0 + tx1) / 2);
    v.box(mx, 1, tz0 + 1, mx + 1, 3, tz1 - 1, "white");
    v.box(mx, 0, tz0 + 2, mx + 1, 1, tz1 - 2, "white");
    for (let x = tx0; x < tx1; x += 3) {
      v.box(x, 1, tz0, x + 1, 5, tz0 + 1, "steelDark");
      v.box(x, 1, tz1 - 1, x + 1, 5, tz1, "steelDark");
    }
    folk(c, mx - 5, tz0 + 6);
    folk(c, mx + 5, tz0 + 8);
    // gazebo
    const gzx = -hx + 8;
    const gzz = hz - 10;
    v.box(gzx - 3, 1, gzz - 3, gzx + 4, 2, gzz + 4, "white");
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) v.box(gzx + dx, 2, gzz + dz, gzx + dx + 1, 6, gzz + dz + 1, "white");
    hip(v, gzx - 4, 6, gzz - 4, gzx + 5, gzz + 5, "tealDark", "white");
    // gate pillars with lanterns
    for (const px of [cx - 4, cx + 3]) {
      v.box(px, 1, hz - 2, px + 2, 6, hz, "stone");
      v.put(px, 6, hz - 2, "warmGlow", 1.2);
    }
    hedge(v, -hx + 1, hz - 2, cx - 4, hz - 1, 1, 2);
    hedge(v, cx + 5, hz - 2, hx - 1, hz - 1, 1, 2);
  }
}

// =============================================================================================
// APARTMENTS — walk-ups that grow taller and wider
// =============================================================================================

/** Rooftop wooden water tower (NYC style). Returns top y. */
function waterTower(v: PixelVox, cx: number, y: number, cz: number, r = 2.6): number {
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) v.box(Math.round(cx + dx), y, Math.round(cz + dz), Math.round(cx + dx) + 1, y + 4, Math.round(cz + dz) + 1, "iron");
  v.cylinderY(cx, cz, y + 4, y + 10, r, "wood");
  v.cylinderY(cx, cz, y + 5, y + 6, r + 0.2, "iron");
  v.cylinderY(cx, cz, y + 8, y + 9, r + 0.2, "iron");
  v.cone(cx, y + 10, y + 13, cz, r + 0.4, 0.4, "woodDark");
  return y + 13;
}

/**
 * APARTMENTS — classic urban walk-ups.
 *  V0 NYC brick tenement (zig-zag fire escapes, rooftop water tower, bodega)
 *  V1 Parisian Haussmann (limestone, iron balconies, zinc mansard, café)
 *  V2 Miami art-deco (pastel, eyebrow ledges, neon fin)   V3 Tokyo "mansion" (open corridors, stair tower, vending machines)
 */
function buildApartments(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "concrete2");
  const fh = 4;
  const floors = byLv5(lv, [2, 3, 4, 5, 6]) + (lv >= 5 ? 0 : 0);
  const x0 = -hx + 1;
  const x1 = hx - 1;
  const zf = hz - 4;
  const z0 = -hz + 1;
  const top = 1 + floors * fh;
  v.box(-hx, 0, zf, hx, 1, hz, "concrete");
  v.box(-hx, 0, hz - 1, hx, 1, hz, "asphalt");
  const shopFloor = lv >= 3;

  if (s === 0) {
    const wall = ["brick", "brick2", "#a6563a"][lv % 3];
    v.box(x0, 1, z0, x1, top, zf, wall);
    v.box(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, zf - 1, null);
    for (let f = 1; f < floors; f++) v.box(x0, 1 + f * fh, zf - 1, x1, 2 + f * fh, zf, "brickDark");
    windows(c, x0, 1, z0, x1, top, zf, { stepV: fh, stepH: 3, h: 2, emit: 0.45, sill: "limestone", faces: "se" });
    // cornice
    v.box(x0 - 0, top, z0, x1, top + 1, zf + 1, "limestone");
    v.box(x0 + 1, top, z0 + 1, x1 - 1, top + 1, zf - 1, "#4a4d55");
    v.box(x0, top + 1, zf - 1, x1, top + 2, zf, wall);
    v.box(x0, top + 1, z0, x1, top + 2, z0 + 1, wall);
    v.box(x0, top + 1, z0, x0 + 1, top + 2, zf, wall);
    v.box(x1 - 1, top + 1, z0, x1, top + 2, zf, wall);
    // zig-zag fire escapes
    const fx0 = Math.floor((x0 + x1) / 2) - 4;
    const fx1 = fx0 + 8;
    for (let f = 1; f < floors; f++) {
      const y = 1 + f * fh;
      v.box(fx0, y, zf, fx1, y + 1, zf + 2, "iron");
      for (let x = fx0; x < fx1; x += 1) v.put(x, y + 2, zf + 1, x % 2 ? "iron" : null);
      v.box(fx0, y + 2, zf + 1, fx1, y + 3, zf + 2, "iron");
      for (let k = 0; k < fh - 1; k++) {
        const sx = (f % 2) ? fx0 + 1 + k : fx1 - 2 - k;
        v.put(sx, y + 1 + k, zf + 1, "steelDark");
      }
    }
    waterTower(v, x0 + 5, top + 1, z0 + 5);
    v.box(x1 - 5, top + 1, z0 + 2, x1 - 2, top + 4, z0 + 5, "brickDark");
  } else if (s === 1) {
    v.box(x0, 1, z0, x1, top, zf, "limestone");
    v.box(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, zf - 1, null);
    v.box(x0, 1, zf - 1, x1, 1 + fh, zf, "marbleShade");
    for (let x = x0; x < x1; x += 2) v.box(x, 1, zf - 1, x + 1, 1 + fh, zf, "limestone");
    for (let f = 1; f < floors; f++) {
      for (let x = x0 + 2; x < x1 - 1; x += 3) {
        v.box(x, 2 + f * fh, zf - 1, x + 1, 4 + f * fh, zf, "glass", 0.45);
        v.put(x, 4 + f * fh, zf - 1, "marbleShade");
      }
      // continuous wrought-iron balcony on the 2nd and top floors, juliet balconies elsewhere
      if (f === 1 || f === floors - 1) {
        v.box(x0, 1 + f * fh, zf, x1, 2 + f * fh, zf + 1, "limestone");
        for (let x = x0; x < x1; x++) v.put(x, 2 + f * fh, zf, x % 2 ? "iron" : "black");
      } else {
        for (let x = x0 + 2; x < x1 - 1; x += 3) v.put(x, 2 + f * fh, zf, "iron");
      }
    }
    windows(c, x0, 1, z0, x1, top, zf, { faces: "e", stepV: fh, h: 2, emit: 0.45 });
    // zinc mansard with dormers and chimney pots
    const mt = mansard(c, x0, top, z0, x1, zf);
    for (let x = x0 + 3; x < x1 - 2; x += 4) {
      v.box(x, top, zf - 1, x + 2, top + 3, zf, "limestone");
      v.put(x, top + 1, zf - 1, "glass", 0.55);
      v.put(x + 1, top + 1, zf - 1, "glass", 0.55);
    }
    for (let x = x0 + 2; x < x1 - 2; x += 8) {
      v.box(x, mt, z0 + 3, x + 4, mt + 2, z0 + 4, "limestone");
      for (let k = 0; k < 4; k += 2) v.put(x + k, mt + 2, z0 + 3, "terracotta");
    }
  } else if (s === 2) {
    const wall = ["pink", "#9fe3cf", "#fff1c2", "#c9b8f0"][(lv + 1) % 4];
    const acc = ["teal", "pink", "orange", "teal"][(lv + 1) % 4];
    v.box(x0, 1, z0, x1, top, zf, wall);
    v.box(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, zf - 1, null);
    for (let f = 0; f < floors; f++) {
      for (let x = x0 + 2; x < x1 - 2; x += 4) {
        if (x > -3 && x < 3) continue;
        v.box(x, 2 + f * fh, zf - 1, x + 2, 4 + f * fh, zf, "glass", 0.45);
        v.box(x - 1, 4 + f * fh, zf - 1, x + 3, 5 + f * fh, zf + 1, "white");
      }
    }
    windows(c, x0, 1, z0, x1, top, zf, { faces: "e", stepV: fh, stepH: 4, w: 2, h: 2, emit: 0.45 });
    v.box(x0, top - 1, z0, x1, top, zf, acc);
    v.box(x0 + 1, top - 1, z0 + 1, x1 - 1, top, zf - 1, "concrete");
    // stepped deco parapet + central neon fin
    v.box(-4, top, zf - 2, 4, top + 2, zf, wall);
    v.box(-2, top + 2, zf - 2, 2, top + 4, zf, wall);
    v.box(-1, 1, zf, 1, top + 8, zf + 1, "white");
    for (let y = 3; y < top + 7; y += 2) v.put(-1, y, zf + 1, "magenta", 1.4);
    for (let y = 4; y < top + 7; y += 2) v.put(0, y, zf + 1, "cyan", 1.4);
    // porthole windows & glass-block column
    for (let y = 2; y < top - 1; y++) v.put(-2, y, zf - 1, "glass", 0.25);
    v.box(x0, 1, zf - 1, x1, 2, zf + 1, acc);
  } else {
    v.box(x0, 1, z0, x1, top, zf - 3, "#eeeae2");
    v.box(x0 + 1, 2, z0 + 1, x1 - 1, top - 1, zf - 4, null);
    // open galleries with doors, AC units and laundry
    for (let f = 0; f < floors; f++) {
      const y = 1 + f * fh;
      v.box(x0, y, zf - 3, x1, y + 1, zf, "concrete");
      v.box(x0, y + 1, zf - 1, x1, y + 2, zf, "white");
      for (let x = x0 + 2; x < x1 - 2; x += 5) {
        v.box(x, y + 1, zf - 4, x + 2, y + 4, zf - 3, ["#c94f4f", "#4f7fc9", "#d9a03a", "#5aa06a"][(x + f + 99) % 4]);
        v.box(x + 3, y + 2, zf - 4, x + 4, y + 3, zf - 3, "glass", 0.5);
        if (f > 0 && hash01(x, f) < 0.4) v.box(x + 2, y + 2, zf - 1, x + 4, y + 3, zf, c.pick(SHIRTS));
        v.put(x + 4, y + 1, zf - 2, "silver");
      }
    }
    v.box(x0, top, zf - 3, x1, top + 1, zf, "concrete");
    // external stair tower on the +x side
    v.box(x1 - 3, 1, z0 + 2, x1, top + 3, z0 + 7, "concreteDark");
    for (let y = 2; y < top + 2; y += 2) v.box(x1 - 1, y, z0 + 3, x1, y + 1, z0 + 6, "steelLight");
    flatRoof(c, x0, top, z0, x1, zf - 3, "concreteDark", "white", true);
    // vending machines
    v.box(x0 + 1, 1, zf, x0 + 3, 4, zf + 1, "red", 0.4);
    v.box(x0 + 3, 1, zf, x0 + 5, 4, zf + 1, "blue", 0.4);
    v.box(x0 + 1, 2, zf + 1, x0 + 5, 3, zf + 1, "white", 0.8);
  }
  // L5 courtyard block: carve an open-air garden court out of the middle
  if (hz > 8 && s !== 3) {
    const cw = ["brick", "limestone", "white"][s];
    v.box(-7, 1, -8, 7, top, 4, cw);
    v.clear(-6, 1, -7, 6, top + 8, 3);
    v.box(-6, 0, -7, 6, 1, 3, "grass");
    tree(v, -1, 1, -2, s === 2 ? "palm" : "round", 1.3, 2);
    bench(v, -5, 1, 1);
    for (let y = 3; y < top - 1; y += fh) for (let x = -5; x < 6; x += 3) v.put(x, y, -8, "glass", 0.45);
  }
  // ground floor shopfront at L3+
  if (shopFloor) {
    if (s === 0) {
      const sx0 = x0 + 2;
      const sx1 = Math.min(x1 - 2, sx0 + 12);
      v.box(sx0, 1, zf - 1, sx1, 4, zf, "glass", 0.55);
      for (let x = sx0; x < sx1; x++) v.put(x, 4, zf, x % 2 ? "leaf" : "#3f8f3a");
      v.box(sx0, 4, zf, sx1, 5, zf + 2, "#3f8f3a");
      v.box(sx0, 5, zf, sx1, 6, zf + 1, "yellow", 0.9);
      v.box(sx0 + 1, 1, zf, sx0 + 3, 2, zf + 2, "orange");
      v.box(sx0 + 4, 1, zf, sx0 + 6, 2, zf + 2, "red");
    } else if (s === 1) {
      const sx0 = x0 + 2;
      const sx1 = Math.min(x1 - 2, sx0 + 14);
      v.box(sx0, 1, zf - 1, sx1, 4, zf, "glass", 0.55);
      for (let x = sx0; x < sx1; x++) {
        v.put(x, 4, zf, x % 2 ? "red" : "white");
        v.put(x, 3, zf + 1, x % 2 ? "red" : "white");
      }
      for (let x = sx0 + 1; x < sx1 - 1; x += 4) {
        v.put(x, 1, zf + 2, "iron");
        v.put(x, 2, zf + 2, "white");
        v.put(x + 1, 1, zf + 2, "red");
        v.put(x - 1, 1, zf + 2, "red");
      }
    } else if (s === 2) {
      v.box(x0 + 2, 1, zf - 1, x0 + 10, 4, zf, "glass", 0.6);
      v.box(x0 + 2, 4, zf, x0 + 10, 5, zf + 1, "magenta", 1.2);
    }
  }
  // street details
  for (let x = -hx + 3; x < hx; x += 10) {
    if (s === 3) {
      v.box(x, 1, hz - 2, x + 1, 9, hz - 1, "woodDark");
      v.box(x - 2, 8, hz - 2, x + 3, 9, hz - 1, "woodDark");
    } else tree(v, x, 1, hz - 2, s === 2 ? "palm" : "round", 0.9, x);
  }
  if (s === 3) {
    for (let x = x1 - 9; x < x1 - 4; x += 2) {
      v.box(x, 1, zf + 1, x + 1, 2, zf + 3, c.pick(["silver", "red", "blue", "white"]));
    }
  }
  if (lv >= 4) folk(c, 2, hz - 3);
  if (lv >= 2) folk(c, -3, hz - 2);
}

/** Mansard roof helper using kit.mansard but with dormer-ready top (zinc look) */
function mansard(c: Ctx, x0: number, y: number, z0: number, x1: number, z1: number): number {
  const v = c.v;
  v.box(x0, y, z0, x1, y + 2, z1, "slateLight");
  v.box(x0 + 1, y + 2, z0 + 1, x1 - 1, y + 4, z1 - 1, "slateLight");
  v.box(x0 + 2, y + 4, z0 + 2, x1 - 2, y + 5, z1 - 2, "#7f8c99");
  return y + 5;
}

defineDesigns({
  large_homes: {
    footprints: [[2, 1], [2, 2], [2, 2], [3, 2], [3, 3]],
    levels: ["Big Suburban Home", "Three-Car-Garage Home", "Poolside Family Home", "Circle-Drive Estate", "Tennis-Court Estate"],
    growth: "The lot keeps growing: a 3-car garage, a backyard pool, a fountain circle drive & pool house, then a tennis court and gazebo.",
    build: buildLargeHome,
  },
  apartments: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 1], [2, 2]],
    levels: ["Two-Flat", "Three-Story Walk-Up", "Corner Walk-Up & Shop", "Five-Story Tenement", "Grand Courtyard Block"],
    growth: "Grows taller and wider floor by floor, adding a ground-floor shop and rooftop life.",
    build: buildApartments,
  },
});


// =============================================================================================
// BEACH HOUSES — on stilts, growing decks, boardwalks and docks
// =============================================================================================

/** Surfboard leaning upright */
function surfboard(v: PixelVox, x: number, z: number, col: string, y = 1): void {
  v.box(x, y, z, x + 1, y + 5, z + 1, col);
  v.put(x, y + 2, z, "white");
}

/** Beach umbrella with a towel */
function umbrella(v: PixelVox, x: number, z: number, col: string, y = 1): void {
  v.box(x, y, z, x + 1, y + 4, z + 1, "white");
  v.cylinderY(x + 0.5, z + 0.5, y + 4, y + 5, 2.4, col);
  v.cylinderY(x + 0.5, z + 0.5, y + 5, y + 6, 1.2, col);
  v.box(x + 1, y - 1, z + 1, x + 3, y, z + 4, "white");
}

/**
 * One stilt beach house on [x0,x1) x [z0,z1), floor deck at y = fy. Returns roof top.
 * st 0 Cape Cod shingle · 1 Caribbean pastel · 2 modern glass box · 3 Polynesian tiki hut
 */
function stiltHouse(c: Ctx, x0: number, z0: number, x1: number, z1: number, fy: number, floors: number, st: number, deck: boolean): number {
  const v = c.v;
  const fh = 5;
  const wallTop = fy + 1 + floors * fh;
  const cx = Math.floor((x0 + x1) / 2);
  // stilts
  for (let x = x0; x < x1; x += 4) {
    for (const z of [z0, z1 - 1]) v.box(x, 1, z, x + 1, fy, z + 1, st === 3 ? "woodDark" : "wood");
  }
  for (const z of [z0, z1 - 1]) v.box(x1 - 1, 1, z, x1, fy, z + 1, st === 3 ? "woodDark" : "wood");
  // platform & deck
  const dz1 = deck ? z1 + 4 : z1 + 1;
  const dx1 = deck ? x1 + 3 : x1;
  v.box(x0 - (deck ? 2 : 0), fy, z0, dx1, fy + 1, dz1, st === 2 ? "concrete" : "woodLight");
  if (deck) {
    for (let x = x0 - 2; x < dx1; x++) v.put(x, fy + 1, dz1 - 1, (x & 1) ? (st === 2 ? "glass" : "white") : (st === 2 ? "glass" : "woodLight"), st === 2 ? 0.1 : 0);
    for (let z = z0; z < dz1; z++) v.put(dx1 - 1, fy + 1, z, (z & 1) ? "white" : "woodLight");
    for (const [px, pz] of [[x0 - 2, dz1 - 1], [dx1 - 1, dz1 - 1]]) v.box(px, 1, pz, px + 1, fy, pz + 1, "wood");
  }
  // stairs down to the sand on the front-left
  for (let k = 0; k < fy - 1; k++) v.box(x0 - (deck ? 2 : 0) + 1 + 0, fy - 1 - k, dz1 + k, x0 - (deck ? 2 : 0) + 3, fy - k, dz1 + k + 1, "woodLight");
  let top = wallTop;
  if (st === 0) {
    v.box(x0, fy + 1, z0, x1, wallTop, z1, "#9aa4ad");
    for (let y = fy + 2; y < wallTop; y += 2) v.box(x0, y, z1 - 1, x1, y + 1, z1, "#8a949d");
    for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, fy + 1, pz, px + 1, wallTop, pz + 1, "white");
    windows(c, x0, fy + 1, z0, x1, wallTop, z1, { faces: "se", stepV: fh, stepH: 3, h: 2, emit: 0.45, sill: "white", startY: 2 });
    top = gable(v, x0 - 1, wallTop, z0 - 1, x1 + 1, z1 + 1, "x", "slate", "white");
    v.box(cx - 1, fy + 1, z1 - 1, cx + 1, fy + 4, z1, "#3f6fb0");
  } else if (st === 1) {
    v.box(x0, fy + 1, z0, x1, wallTop, z1, ["#5fd0c8", "pink", "#ffe08a"][floors % 3]);
    for (let f = 0; f < floors; f++) {
      for (let x = x0 + 1; x < x1 - 1; x += 4) {
        v.box(x, fy + 2 + f * fh, z1 - 1, x + 2, fy + 5 + f * fh, z1, "glass", 0.45);
        v.box(x - 1, fy + 2 + f * fh, z1, x, fy + 5 + f * fh, z1 + 1, "yellow");
        v.box(x + 2, fy + 2 + f * fh, z1, x + 3, fy + 5 + f * fh, z1 + 1, "yellow");
      }
    }
    windows(c, x0, fy + 1, z0, x1, wallTop, z1, { faces: "e", stepV: fh, h: 2, emit: 0.45, startY: 2 });
    top = hip(v, x0 - 2, wallTop, z0 - 2, x1 + 2, z1 + 2, "silver", "white");
    for (let x = x0 - 2; x < x1 + 2; x += 2) v.put(x, wallTop, z1 + 1, "steelLight");
  } else if (st === 2) {
    v.box(x0, fy + 1, z0, x1, wallTop, z1, "glass", 0.45);
    v.box(x0 + 1, fy + 1, z0 + 1, x1 - 1, wallTop, z1 - 1, null);
    for (let x = x0; x < x1; x += 4) v.box(x, fy + 1, z1 - 1, x + 1, wallTop, z1, "white");
    v.box(x0, fy + 1, z0, x0 + 3, wallTop, z1, "white");
    for (let f = 1; f <= floors; f++) v.box(x0 - 1, fy + f * fh, z0 - 1, x1 + 2, fy + f * fh + 1, z1 + 2, "white");
    top = wallTop + 1;
    v.box(x0 + 3, top, z0 + 1, x0 + 5, top + 1, z1 - 1, "white");
  } else {
    // bamboo walls + tall thatched roof
    v.box(x0, fy + 1, z0, x1, wallTop, z1, "sand");
    for (let x = x0; x < x1; x += 2) {
      v.box(x, fy + 1, z1 - 1, x + 1, wallTop, z1, "woodLight");
      v.box(x, fy + 1, z0, x + 1, wallTop, z0 + 1, "woodLight");
    }
    for (let z = z0; z < z1; z += 2) v.box(x1 - 1, fy + 1, z, x1, wallTop, z + 1, "woodLight");
    v.box(cx - 1, fy + 1, z1 - 1, cx + 1, fy + 4, z1, "woodDark");
    v.box(x0 + 2, fy + 2, z1 - 1, x0 + 4, fy + 4, z1, "warmGlow", 0.6);
    v.box(x1 - 4, fy + 2, z1 - 1, x1 - 2, fy + 4, z1, "warmGlow", 0.6);
    let k = 0;
    for (; x0 - 2 + k < x1 + 2 - k && z0 - 2 + k < z1 + 2 - k; k++) {
      v.box(x0 - 2 + k, wallTop + k * 2, z0 - 2 + k, x1 + 2 - k, wallTop + k * 2 + 2, z1 + 2 - k, k % 2 ? "#b8913f" : "#c9a24f");
    }
    top = wallTop + k * 2;
    v.put(cx, top, Math.floor((z0 + z1) / 2), "woodDark");
    v.put(cx, top + 1, Math.floor((z0 + z1) / 2), "woodDark");
  }
  return top;
}

/**
 * BEACH HOUSE — stilt houses on the sand that grow decks, a boardwalk, a dock and a lookout.
 *  V0 New England shingle cottage   V1 Caribbean pastel w/ tin roof & shutters
 *  V2 modern glass beach box        V3 Polynesian tiki hut with thatch & torches
 */
function buildBeachHouse(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "sand");
  speckle(c, "sandDark", 0.1);
  const big = hz > 8;
  // ocean along the front at L3+
  const shore = big ? 2 : hz - 3;
  if (lv >= 3 || big) {
    v.box(-hx, 0, shore, hx, 1, hz, "water", 0.08);
    for (let x = -hx; x < hx; x++) v.put(x, 0, shore + ((x * 7) % 3 === 0 ? 1 : 0), "foam", 0.2);
    v.box(-hx, 0, shore - 1, hx, 1, shore, "sandDark");
  }
  const w = big || hx > 8 ? 16 : 11;
  const x0 = big ? -hx + 4 : hx > 8 ? -hx + 4 : -6;
  const x1 = x0 + w;
  const z0 = big ? -hz + 3 : -hz + 2;
  const z1 = z0 + (big ? 10 : 7);
  const fy = 5;
  const floors = lv >= 5 ? 2 : 1;
  const top = stiltHouse(c, x0, z0, x1, z1, fy, floors, s, lv >= 2);
  // signature life details
  surfboard(v, x1 + (lv >= 2 ? 3 : 1), z0 + 1, ["red", "yellow", "teal", "orange"][s]);
  surfboard(v, x1 + (lv >= 2 ? 3 : 1), z0 + 3, "sky");
  if (s === 3) {
    for (const tx of [x0 - 3, x1 + 1]) {
      v.box(tx, 1, z1 + 5, tx + 1, 6, z1 + 6, "woodDark");
      v.put(tx, 6, z1 + 5, "fire", 1.5);
      c.smoke(tx, 7, z1 + 5, "spark");
    }
  }
  if (lv === 1) tree(v, hx - 3, 1, hz - 3, "palm", 1.0, 1);
  if (lv >= 2) {
    // deck life: loungers, umbrella, outdoor shower
    lawnChair(v, x0, fy + 1, ["white", "sky", "white", "orange"][s]);
    v.box(x0 - 1, 1, z0, x0, 6, z0 + 1, "silver");
    v.put(x0 - 1, 6, z0 + 1, "silver");
    umbrella(v, big ? hx - 8 : hx - 4, big ? shore - 6 : hz - 4, ["red", "teal", "white", "yellow"][s]);
  }
  if (lv >= 3) {
    // boardwalk over the dunes to the water, hammock between palms
    const bx = x0 + 1;
    v.box(bx, 1, z1 + 4, bx + 3, 2, hz, "woodLight");
    for (let z = z1 + 4; z < hz; z += 3) v.box(bx, 1, z, bx + 3, 2, z + 1, "wood");
    for (let z = z1 + 5; z < shore - 1; z += 2) v.put(bx + 4, 1, z, "#c7c48a");
    const p1 = hx - 3;
    tree(v, p1, 1, z0 + 1, "palm", 1.3, 1);
    tree(v, p1, 1, z0 + 8, "palm", 1.2, 2);
    for (let z = z0 + 2; z < z0 + 8; z++) v.put(p1, 3 - (z === z0 + 4 || z === z0 + 5 ? 1 : 0), z, ["red", "white", "orange"][z % 3]);
  }
  if (lv >= 4 && big) {
    // dock into the sea with a sailboat and kayaks
    const dx = 4;
    v.box(dx, 1, shore - 2, dx + 4, 2, hz - 1, "wood");
    for (let z = shore; z < hz; z += 4) {
      v.box(dx - 1, 0, z, dx, 3, z + 1, "woodDark");
      v.box(dx + 4, 0, z, dx + 5, 3, z + 1, "woodDark");
    }
    // sailboat
    const sx = dx + 8;
    const sz = hz - 6;
    v.box(sx - 1, 1, sz - 1, sx + 6, 2, sz + 2, "white");
    v.box(sx, 1, sz - 2, sx + 5, 2, sz + 3, "white");
    v.box(sx + 2, 2, sz, sx + 3, 14, sz + 1, "silver");
    for (let y = 3; y < 13; y++) v.box(sx + 3, y, sz, sx + 3 + Math.floor((13 - y) / 2), y + 1, sz + 1, "white");
    v.put(sx - 1, 1, sz, "blue");
    // kayaks on the sand
    v.box(-hx + 2, 1, shore - 3, -hx + 8, 2, shore - 2, "orange");
    v.box(-hx + 3, 1, shore - 5, -hx + 9, 2, shore - 4, "yellow");
  }
  if (lv >= 5) {
    // rooftop lookout / widow's walk + hot tub + lifeguard tower + jet ski
    const lx = x1 - 6;
    if (s === 2) {
      v.box(x0 + 6, top, z0 + 1, x1 - 1, top + 1, z1 - 1, "woodLight");
      for (let x = x0 + 6; x < x1; x++) v.put(x, top + 1, z1 - 1, "glass", 0.1);
      v.box(x0 + 7, top + 1, z0 + 2, x0 + 11, top + 2, z0 + 5, "cyan", 0.4);
      c.smoke(x0 + 8, top + 2, z0 + 3, "steam");
    } else {
      v.box(lx, top - 2, z0 + 3, lx + 4, top + 3, z0 + 7, s === 1 ? "#5fd0c8" : s === 3 ? "sand" : "white");
      v.box(lx, top, z0 + 3, lx + 4, top + 2, z0 + 7, "glass", 0.5);
      hip(v, lx - 1, top + 3, z0 + 2, lx + 5, z0 + 8, s === 3 ? "#c9a24f" : s === 1 ? "silver" : "slate");
    }
    if (big) {
      const gx = hx - 8;
      const gz = shore - 4;
      for (const [ddx, ddz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) v.box(gx + ddx, 1, gz + ddz, gx + ddx + 1, 6, gz + ddz + 1, "white");
      v.box(gx - 1, 6, gz - 1, gx + 5, 7, gz + 5, "white");
      v.box(gx, 7, gz, gx + 4, 10, gz + 4, "red");
      v.box(gx - 1, 10, gz - 1, gx + 5, 11, gz + 5, "white");
      v.box(gx + 1, 8, gz + 4, gx + 3, 9, gz + 5, "glass", 0.4);
      flag(v, gx + 4, 11, gz, 4, ["red", "yellow"]);
      // jet ski
      v.box(-hx + 8, 1, hz - 4, -hx + 12, 2, hz - 2, "yellow");
      v.put(-hx + 9, 2, hz - 3, "black");
      c.bob();
    }
    folk(c, x0 + 3, z1 + 6, 1);
  }
}

// =============================================================================================
// VILLAS — Mediterranean & tropical
// =============================================================================================

/** Vine pergola: posts + beam grid with leaves and grapes */
function pergola(c: Ctx, x0: number, z0: number, x1: number, z1: number, y0 = 1, h = 5, post = "woodDark"): void {
  const v = c.v;
  for (const [px, pz] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(px, y0, pz, px + 1, y0 + h, pz + 1, post);
  for (let x = x0; x < x1; x += 2) v.box(x, y0 + h, z0, x + 1, y0 + h + 1, z1, post);
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const r = hash01(x * 13 + z, y0);
      if (r < 0.55) v.put(x, y0 + h + 1, z, r < 0.2 ? "leafDark" : "leaf");
      else if (r < 0.62) v.put(x, y0 + h - 1, z, "purple");
    }
  }
}

/**
 * VILLA — Mediterranean / tropical luxury that gains terraces, pool, tower, vineyard and gardens.
 *  V0 Tuscan (ochre, terracotta, cypress, tower)   V1 Santorini (white cubes, blue domes)
 *  V2 Moroccan riad (crenellated pink walls, arches, zellige)   V3 Balinese (thatched pavilions, lotus pond)
 */
function buildVilla(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, s === 1 ? "concrete" : s === 2 ? "sand" : "grass2");
  speckle(c, s === 1 ? "white" : s === 2 ? "sandDark" : "grass3", 0.08);
  const fh = 5;
  const x0 = -hx + 3;
  const x1 = Math.min(hx - 3, x0 + 24);
  const zf = Math.min(hz - 5, 4);
  const z0 = zf - 10;
  const cx = Math.floor((x0 + x1) / 2);
  const wt = 1 + 2 * fh;
  v.box(cx - 1, 0, zf, cx + 2, 1, hz, s === 1 ? "white" : "path2");

  if (s === 0) {
    const wall = "#e0b46a";
    v.box(x0, 1, z0, x1, wt, zf, wall);
    v.box(x0, 1, z0, x1, 2, zf, "stone");
    for (let f = 0; f < 2; f++) {
      for (let x = x0 + 2; x < x1 - 2; x += 4) {
        v.box(x, 2 + f * fh + 1, zf - 1, x + 2, 5 + f * fh, zf, "glass", 0.45);
        v.box(x - 1, 2 + f * fh + 1, zf, x, 5 + f * fh, zf + 1, "#4f7a3f");
        v.box(x + 2, 2 + f * fh + 1, zf, x + 3, 5 + f * fh, zf + 1, "#4f7a3f");
      }
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 2, emit: 0.45 });
    hip(v, x0 - 1, wt, z0 - 1, x1 + 1, zf + 1, "terracotta", "brick2", 4);
    // lower wing
    v.box(x1 - 9, 1, zf, x1, 1 + fh, zf + 5, wall);
    v.box(x1 - 8, 2, zf + 4, x1 - 1, 5, zf + 5, "glass", 0.45);
    hip(v, x1 - 10, 1 + fh, zf - 1, x1 + 1, zf + 6, "terracotta", "brick2", 3);
    door(v, cx - 1, 1, zf - 1, "woodDark");
    // tower (belvedere) at L4+, small dovecote before
    const th = lv >= 4 ? wt + 10 : wt + 3;
    const tx0 = x0 + 1;
    v.box(tx0, 1, z0 + 1, tx0 + 6, th, z0 + 7, wall);
    if (lv >= 4) {
      v.box(tx0, th - 4, z0 + 1, tx0 + 6, th - 1, z0 + 7, null);
      for (const [px, pz] of [[tx0, z0 + 1], [tx0 + 5, z0 + 1], [tx0, z0 + 6], [tx0 + 5, z0 + 6]]) v.box(px, th - 4, pz, px + 1, th, pz + 1, wall);
      v.put(tx0 + 2, th - 3, z0 + 3, "warmGlow", 1);
    }
    hip(v, tx0 - 1, th, z0, tx0 + 7, z0 + 8, "terracotta", "brick2");
    for (let x = x0; x < x1; x += 4) tree(v, x, 1, hz - 2, "cypress", 1.1, x);
  } else if (s === 1) {
    // stacked white cubes with blue domes and doors
    const blocks: [number, number, number, number, number][] = [
      [x0, z0, x1, zf, 1 + fh],
      [x0 + 2, z0, x0 + 12, zf - 3, 1 + fh * 2],
      [x1 - 9, z0, x1, zf - 5, 1 + fh * 2],
    ];
    for (const [bx0, bz0, bx1, bz1, h] of blocks) {
      v.box(bx0, 1, bz0, bx1, h, bz1, "white");
      v.box(bx0, h, bz0, bx1, h + 1, bz1, "marble");
      for (let x = bx0 + 2; x < bx1 - 2; x += 4) {
        v.box(x, h - 4, bz1 - 1, x + 2, h - 1, bz1, "blue");
        v.put(x, h - 1, bz1 - 1, "white");
      }
    }
    v.dome(x0 + 7, 1 + fh * 2 + 1, z0 + 4, 4, "blue");
    v.box(x0 + 7, 1 + fh * 2 + 5, z0 + 4, x0 + 8, 1 + fh * 2 + 7, z0 + 5, "white");
    v.put(x0 + 7, 1 + fh * 2 + 7, z0 + 4, "gold");
    // bell gable on the right block
    v.box(x1 - 6, 1 + fh * 2, z0 + 1, x1 - 1, 1 + fh * 2 + 6, z0 + 2, "white");
    v.clear(x1 - 5, 1 + fh * 2 + 2, z0 + 1, x1 - 4, 1 + fh * 2 + 4, z0 + 2);
    v.clear(x1 - 3, 1 + fh * 2 + 2, z0 + 1, x1 - 2, 1 + fh * 2 + 4, z0 + 2);
    v.put(x1 - 5, 1 + fh * 2 + 3, z0 + 1, "gold");
    // bougainvillea cascading
    for (let i = 0; i < 18; i++) v.put(x0 + c.ri(0, 4), c.ri(2, 9), zf - c.ri(0, 1) + (i % 2), i % 3 ? "magenta" : "pink");
    door(v, cx, 1, zf - 1, "blue");
    // terrace stairs down to the front
    for (let k = 0; k < 4; k++) v.box(x1 - 5, 1, zf + k, x1 - 1, 5 - k, zf + k + 1, "white");
  } else if (s === 2) {
    // riad: high crenellated walls around an open courtyard with fountain & orange trees
    const wall = "#d9896a";
    v.box(x0, 1, z0, x1, wt, zf, wall);
    v.box(x0 + 4, 1, z0 + 3, x1 - 4, wt + 1, zf - 3, null);
    v.box(x0 + 4, 0, z0 + 3, x1 - 4, 1, zf - 3, "teal");
    for (let x = x0 + 4; x < x1 - 4; x++) for (let z = z0 + 3; z < zf - 3; z++) if ((x + z) % 2 === 0) v.put(x, 0, z, "white");
    v.cylinderY(cx, (z0 + zf) / 2, 1, 2, 2, "teal");
    v.put(cx, 2, Math.floor((z0 + zf) / 2), "water", 0.4);
    tree(v, x0 + 5, 1, z0 + 4, "fruit", 0.8, 1);
    tree(v, x1 - 6, 1, zf - 5, "fruit", 0.8, 2);
    // inner arcade
    for (let x = x0 + 4; x < x1 - 4; x += 3) v.box(x, 1, zf - 4, x + 1, 5, zf - 3, "cream");
    // crenellations
    for (let x = x0; x < x1; x += 2) {
      v.put(x, wt, zf - 1, wall);
      v.put(x, wt, z0, wall);
    }
    for (let z = z0; z < zf; z += 2) {
      v.put(x0, wt, z, wall);
      v.put(x1 - 1, wt, z, wall);
    }
    // horseshoe arch door with zellige frame, lanterns
    v.box(cx - 3, 1, zf - 1, cx + 4, 8, zf, "teal");
    v.box(cx - 2, 1, zf - 1, cx + 3, 6, zf, "woodDark");
    v.box(cx - 1, 6, zf - 1, cx + 2, 7, zf, "woodDark");
    for (let x = x0 + 2; x < x1 - 2; x += 5) {
      if (Math.abs(x - cx) < 5) continue;
      v.box(x, 6, zf - 1, x + 2, 9, zf, "woodDark");
      v.put(x, 9, zf - 1, wall);
    }
    for (const lx of [cx - 5, cx + 5]) {
      v.put(lx, 6, zf, "iron");
      v.put(lx, 5, zf, "amber", 1.3);
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 2, emit: 0.45, col: "amber" });
    tree(v, x0 - 1, 1, zf + 3, "palm", 1.4, 1);
    tree(v, x1, 1, zf + 3, "palm", 1.4, 2);
  } else {
    // Balinese: open-sided pavilions with tall dark thatch on stone plinths
    const pav = (px0: number, pz0: number, pw: number, pd: number, h: number, open: boolean): void => {
      v.box(px0, 1, pz0, px0 + pw, 2, pz0 + pd, "stone");
      for (const [qx, qz] of [[px0, pz0], [px0 + pw - 1, pz0], [px0, pz0 + pd - 1], [px0 + pw - 1, pz0 + pd - 1]]) v.box(qx, 2, qz, qx + 1, h, qz + 1, "woodDark");
      if (!open) {
        v.box(px0 + 1, 2, pz0 + 1, px0 + pw - 1, h, pz0 + pd - 1, "woodLight");
        v.box(px0 + 2, 2, pz0 + pd - 2, px0 + pw - 2, h - 1, pz0 + pd - 1, "glass", 0.5);
      } else {
        v.box(px0 + 1, 2, pz0 + 1, px0 + pw - 1, 3, pz0 + pd - 1, "white");
      }
      let k = 0;
      for (; px0 - 2 + k < px0 + pw + 2 - k && pz0 - 2 + k < pz0 + pd + 2 - k; k++) {
        v.box(px0 - 2 + k, h + k * 2, pz0 - 2 + k, px0 + pw + 2 - k, h + k * 2 + 2, pz0 + pd + 2 - k, k % 2 ? "#4a3a28" : "#5a4632");
      }
      v.put(px0 + Math.floor(pw / 2), h + k * 2, pz0 + Math.floor(pd / 2), "gold");
    };
    pav(x0, z0, 12, 10, 8, false);
    pav(x0 + 15, z0 + 2, 8, 7, 6, true);
    // lotus pond
    v.box(x0 + 1, 0, zf + 1, x0 + 11, 1, zf + 5, "waterDeep", 0.1);
    for (const [lx, lz] of [[x0 + 3, zf + 2], [x0 + 7, zf + 3], [x0 + 9, zf + 2]]) {
      v.put(lx, 1, lz, "leafLight");
      v.put(lx, 2, lz, "pink");
    }
    // stone guardian statues + frangipani
    for (const gx of [cx - 3, cx + 3]) {
      v.box(gx, 1, hz - 3, gx + 1, 4, hz - 2, "granite");
      v.put(gx, 4, hz - 3, "stone");
    }
    tree(v, x1 - 1, 1, zf + 3, "blossom", 1.1, 3);
  }

  // ---- L2+: pergola terrace with vines ----
  if (lv >= 2 && hz > 8) pergola(c, x0, -hz + 2, x0 + 10, z0 - 1, 1, 5, s === 1 ? "white" : "woodDark");
  // ---- L3+: pool ----
  if (lv >= 3 && hz > 8) {
    const px0 = x0 + 12;
    const px1 = Math.min(hx - 2, px0 + 14);
    if (s === 3) {
      // infinity-edge pool on a stone deck
      v.box(px0, 1, -hz + 2, px1, 2, z0 - 1, "stone");
      v.box(px0 + 1, 1, -hz + 3, px1 - 1, 2, z0 - 2, "cyan", 0.2);
    } else pool(v, px0, -hz + 2, px1, z0 - 1, s === 1 ? "white" : s === 2 ? "teal" : "stone");
    for (let x = px0 + 1; x < px1 - 1; x += 4) lawnChair(v, x, z0 - 1 + 0, "white");
  }
  // ---- L4+: vineyard / olive grove / palm grove on the extra tile ----
  if (lv >= 4 && hx > 16) {
    const gx0 = x1 + 3;
    for (let x = gx0; x < hx - 1; x += 3) {
      for (let z = -hz + 2; z < hz - 2; z++) {
        if (s === 0) {
          if (z % 6 === 0) v.box(x, 1, z, x + 1, 4, z + 1, "woodDark");
          else v.box(x, 1, z, x + 1, 3, z + 1, (z & 1) ? "leaf" : "leafDark");
          if (hash01(x, z) < 0.15) v.put(x, 2, z, "purple");
        }
      }
    }
    if (s !== 0) {
      for (let x = gx0 + 2; x < hx - 2; x += 7) {
        for (let z = -hz + 4; z < hz - 3; z += 7) tree(v, x, 1, z, s === 1 ? "oak" : s === 2 ? "palm" : "fruit", 1.1, x + z);
      }
    }
  }
  // ---- L5: guest wing, fountain garden & gate ----
  if (lv >= 5 && hz > 16) {
    const gz0 = zf + 6;
    const fxc = Math.floor((x0 + x1) / 2);
    // formal garden with fountain
    v.box(x0, 0, gz0, x1, 1, hz - 3, s === 2 ? "#e9c7a0" : "path");
    for (let x = x0 + 1; x < x1 - 1; x += 4) {
      hedge(v, x, gz0 + 1, x + 2, gz0 + 2);
      hedge(v, x, hz - 5, x + 2, hz - 4);
    }
    v.cylinderY(fxc, gz0 + 7, 1, 2, 4, s === 2 ? "teal" : "marble");
    v.cylinderY(fxc, gz0 + 7, 1, 2, 3.2, "water", 0.15);
    v.box(fxc, 2, gz0 + 7, fxc + 1, 6, gz0 + 8, s === 2 ? "teal" : "marble");
    v.put(fxc, 6, gz0 + 7, "foam", 0.6);
    // gate
    for (const gx of [fxc - 4, fxc + 4]) {
      v.box(gx, 1, hz - 2, gx + 2, 8, hz, s === 1 ? "white" : s === 2 ? "#d9896a" : "stone");
      v.put(gx, 8, hz - 2, "warmGlow", 1.2);
    }
    v.box(fxc - 2, 7, hz - 2, fxc + 4, 8, hz - 1, "iron");
    folk(c, fxc - 3, gz0 + 4);
    folk(c, fxc + 4, gz0 + 9);
  }
}

// =============================================================================================
// MANSIONS — gated estates that gain grounds and prestige
// =============================================================================================

/** Topiary cone or ball */
function topiary(v: PixelVox, x: number, z: number, ball: boolean): void {
  v.box(x, 1, z, x + 1, 2, z + 1, "terracotta");
  if (ball) {
    v.put(x, 2, z, "woodDark");
    v.sphere(x + 0.5, 4, z + 0.5, 1.6, 1.6, 1.6, "leafDark");
  } else v.cone(x + 0.5, 2, 7, z + 0.5, 1.6, 0.4, "leafDark");
}

/** Marble statue on plinth */
function statue(v: PixelVox, x: number, z: number, col = "marble"): void {
  v.box(x - 1, 1, z - 1, x + 2, 3, z + 2, "marbleShade");
  v.box(x, 3, z, x + 1, 6, z + 1, col);
  v.put(x, 6, z, col);
  v.put(x + 1, 5, z, col);
}

/** Helicopter on a pad (static) with rotor */
function helicopter(c: Ctx, x: number, y: number, z: number, col = "black"): void {
  const v = c.v;
  v.box(x - 2, y + 1, z - 1, x + 2, y + 3, z + 1, col);
  v.box(x + 1, y + 2, z - 1, x + 2, y + 3, z + 1, "glassDark");
  v.box(x - 6, y + 2, z, x - 2, y + 3, z + 1, col);
  v.put(x - 6, y + 3, z, col);
  v.box(x - 2, y, z - 1, x + 2, y + 1, z - 0, "steelDark");
  v.box(x - 2, y, z, x + 2, y + 1, z + 1, "steelDark");
  const r = new PixelVox(5);
  for (let d = -5; d <= 5; d++) {
    r.put(d, 0, 0, "charcoal");
    r.put(0, 0, d, "charcoal");
  }
  c.addRotor({ vox: r, pivot: [x, y + 3, z], axis: "y", speed: 3 });
}

/**
 * MANSION — the gated estate: each level adds grounds (gates, fountains, pools, hedges, maze, helipad).
 *  V0 Palladian (white columns, pediment, dome)   V1 French château (blue slate, turrets)
 *  V2 Hollywood-Hills modern (white planes, glass, infinity pool)   V3 Scottish-baronial castle (stone, crenellated towers)
 */
function buildMansion(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant;
  lot(c, "grass");
  speckle(c, "grass3", 0.08);
  const fh = 5;
  const wt = 1 + 2 * fh;
  // the house sits in the back-centre of the lot; grounds fill the front
  const bw = 26;
  const cx = hx > 16 ? 0 : 0;
  const x0 = cx - bw / 2;
  const x1 = cx + bw / 2;
  const z0 = -hz + 3;
  const zf = z0 + 12;
  const gold = lv >= 5 ? "gold" : "iron";

  if (s === 0) {
    v.box(x0, 1, z0, x1, wt, zf, "marble");
    v.box(x0, 1, z0, x1, 3, zf, "marbleShade");
    for (let f = 0; f < 2; f++) {
      for (let x = x0 + 2; x < x1 - 1; x += 3) {
        if (Math.abs(x - cx) < 5) continue;
        v.box(x, 3 + f * fh, zf - 1, x + 1, 6 + f * fh, zf, "glass", 0.45);
        v.put(x, 6 + f * fh, zf - 1, "marbleShade");
      }
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 3, emit: 0.45 });
    v.box(x0 - 1, wt, z0 - 1, x1 + 1, wt + 1, zf + 1, "marbleShade");
    for (let x = x0; x < x1; x += 2) v.put(x, wt + 1, zf, "marble");
    hip(v, x0, wt + 1, z0, x1, zf, "slateLight", "marbleShade", 3);
    // grand portico + pediment + dome
    v.box(cx - 6, 1, zf, cx + 6, 3, zf + 4, "marbleShade");
    for (let x = cx - 6; x < cx + 6; x += 2) column(v, x, zf + 3, 3, wt, "marble", "marbleShade");
    v.box(cx - 6, wt, zf, cx + 6, wt + 1, zf + 4, "marble");
    for (let k = 0; k < 4; k++) v.box(cx - 6 + k * 2 - 1, wt + 1 + k, zf - 1, cx + 6 - k * 2 + 1, wt + 2 + k, zf + 4, k === 0 ? "marble" : "marbleShade");
    door(v, cx - 1, 3, zf - 1, "woodDark");
    v.cylinderY(cx, (z0 + zf) / 2, wt + 3, wt + 6, 4, "marble");
    v.dome(cx, wt + 6, (z0 + zf) / 2, 4.2, lv >= 5 ? "gold" : "#6fa38a");
    v.box(cx, wt + 10, Math.floor((z0 + zf) / 2), cx + 1, wt + 13, Math.floor((z0 + zf) / 2) + 1, "gold", 0.4);
    for (let k = 0; k < 3; k++) v.box(cx - 4 + k, 1, zf + 4 + k, cx + 4 - k, 3 - k, zf + 5 + k, "marbleShade");
  } else if (s === 1) {
    v.box(x0, 1, z0, x1, wt, zf, "limestone");
    for (let f = 0; f < 2; f++) {
      for (let x = x0 + 3; x < x1 - 3; x += 3) {
        v.box(x, 2 + f * fh, zf - 1, x + 1, 5 + f * fh, zf, "glass", 0.45);
      }
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 3, emit: 0.45 });
    // steep slate roof with dormers
    let k = 0;
    for (; z0 + k < zf - k; k++) v.box(x0, wt + k * 2, z0 + k, x1, wt + k * 2 + 2, zf - k, "#3e5470");
    const rtop = wt + k * 2;
    for (let x = x0 + 3; x < x1 - 3; x += 4) {
      v.box(x, wt, zf - 2, x + 2, wt + 4, zf, "limestone");
      v.box(x, wt + 1, zf - 1, x + 2, wt + 3, zf, "glass", 0.55);
      v.box(x, wt + 4, zf - 2, x + 2, wt + 5, zf, "#3e5470");
    }
    v.box(x0 + 4, rtop - 1, z0 + 5, x1 - 4, rtop, z0 + 7, gold);
    // corner turrets with witch-hat cones
    for (const tx of [x0, x1]) {
      for (const tz of [z0 + 1, zf - 1]) {
        v.cylinderY(tx, tz, 1, wt + 4, 3, "limestone");
        windows(c, tx - 3, 1, tz - 3, tx + 3, wt + 4, tz + 3, { faces: "se", stepV: fh, h: 2, emit: 0.5 });
        v.cone(tx, wt + 4, wt + 16, tz, 3.8, 0.3, "#3e5470");
        v.box(Math.floor(tx), wt + 16, Math.floor(tz), Math.floor(tx) + 1, wt + 19, Math.floor(tz) + 1, gold, 0.4);
      }
    }
    door(v, cx - 1, 1, zf - 1, "#2f4f7a");
    for (let k2 = 0; k2 < 2; k2++) v.box(cx - 3 + k2, 1, zf + k2, cx + 3 - k2, 3 - k2, zf + k2 + 1, "limestone");
  } else if (s === 2) {
    // Hollywood modern: stacked white slabs, cantilevers, glass
    v.box(x0, 1, z0, x1, 1 + fh, zf, "glass", 0.5);
    v.box(x0, 1, z0, x0 + 6, 1 + fh, zf, "stone");
    v.box(x0 - 2, 1 + fh, z0, x1 + 2, 2 + fh, zf + 3, "white");
    v.box(x0 + 6, 2 + fh, z0 + 1, x1 + 6, 1 + fh * 2 + 1, zf - 2, "glass", 0.5);
    v.box(x0 + 6, 2 + fh, z0 + 1, x0 + 9, 1 + fh * 2 + 1, zf - 2, "white");
    v.box(x0 + 4, 1 + fh * 2 + 1, z0, x1 + 7, 2 + fh * 2 + 1, zf, "white");
    v.box(x0 + 12, 2 + fh * 2 + 1, z0 + 2, x0 + 20, 3 + fh * 2 + 1 + fh, z0 + 9, "white");
    v.box(x0 + 13, 3 + fh * 2 + 1, z0 + 8, x0 + 19, 2 + fh * 2 + 1 + fh, z0 + 9, "glass", 0.55);
    for (let x = x0; x < x1; x += 4) v.box(x, 1, zf - 1, x + 1, 1 + fh, zf, "white");
    // infinity pool cantilevered in front
    v.box(x0 + 2, 1, zf + 3, x1 - 2, 3, zf + 9, "white");
    v.box(x0 + 3, 2, zf + 4, x1 - 3, 3, zf + 8, "cyan", 0.35);
    for (let x = x0 + 4; x < x1 - 4; x += 4) lawnChair(v, x, zf + 2, "white", 1);
    for (const px of [x0 - 1, x1 + 1, x1 + 4]) tree(v, px, 1, zf + 1, "palm", 1.8, px);
  } else {
    // baronial castle: stone keep, crenellated parapets, square & round towers
    v.box(x0, 1, z0, x1, wt + 2, zf, "stone");
    for (let x = x0; x < x1; x++) for (let y = 1; y < wt + 2; y++) if (hash01(x * 3 + y, 7) < 0.2) v.put(x, y, zf - 1, "granite");
    for (let x = x0; x < x1; x += 2) {
      v.put(x, wt + 2, zf - 1, "stone");
      v.put(x, wt + 2, z0, "stone");
    }
    v.box(x0 + 1, wt + 1, z0 + 1, x1 - 1, wt + 2, zf - 1, "slate");
    gable(v, x0 + 2, wt + 2, z0 + 2, x1 - 2, zf - 2, "x", "redDark");
    for (let x = x0 + 3; x < x1 - 2; x += 4) {
      v.box(x, 3, zf - 1, x + 1, 6, zf, "glass", 0.5);
      v.box(x, 8, zf - 1, x + 1, 11, zf, "glass", 0.5);
    }
    windows(c, x0, 1, z0, x1, wt, zf, { faces: "e", stepV: fh, h: 3, emit: 0.45 });
    // gatehouse arch
    v.box(cx - 3, 1, zf - 1, cx + 3, 8, zf + 1, "granite");
    v.box(cx - 2, 1, zf, cx + 2, 6, zf + 1, "woodDark");
    // towers
    const towers: [number, number, number, boolean][] = [[x0, z0 + 2, wt + 9, true], [x1, zf - 2, wt + 12, false], [x1, z0 + 2, wt + 6, true]];
    for (const [tx, tz, th, round] of towers) {
      if (round) v.cylinderY(tx, tz, 1, th, 3.3, "stone");
      else v.box(tx - 3, 1, tz - 3, tx + 3, th, tz + 3, "stone");
      for (let a = 0; a < 12; a += 2) {
        const ang = (a / 12) * Math.PI * 2;
        v.put(Math.round(tx + Math.cos(ang) * 3), th, Math.round(tz + Math.sin(ang) * 3), "stone");
      }
      if (!round) {
        for (let d = -3; d < 3; d += 2) {
          v.put(tx + d, th, tz - 3, "stone");
          v.put(tx + d, th, tz + 2, "stone");
          v.put(tx - 3, th, tz + d, "stone");
          v.put(tx + 2, th, tz + d, "stone");
        }
      } else v.cone(tx, th, th + 6, tz, 3.4, 0.4, "slate");
      v.put(Math.floor(tx), th - 4, Math.floor(tz) + 3, "glass", 0.6);
    }
    flag(v, x1, wt + 12, zf - 2, 7, ["blue", "white", "blue"]);
  }

  // ---- grounds ----
  // drive from gate to the front door + gate pillars & front wall
  const driveZ0 = s === 2 ? zf + 10 : zf + 4;
  v.box(cx - 2, 0, driveZ0, cx + 2, 1, hz, "path2");
  const wallCol = s === 3 ? "stone" : s === 2 ? "white" : "limestone";
  v.box(-hx + 1, 1, hz - 2, cx - 4, 3, hz - 1, wallCol);
  v.box(cx + 4, 1, hz - 2, hx - 1, 3, hz - 1, wallCol);
  for (let x = -hx + 1; x < hx - 1; x += 2) if (Math.abs(x - cx) > 4) v.put(x, 3, hz - 2, gold);
  for (const px of [cx - 5, cx + 3]) {
    v.box(px, 1, hz - 3, px + 2, 7, hz - 1, wallCol);
    v.put(px, 7, hz - 3, "warmGlow", 1.2);
    v.put(px + 1, 7, hz - 2, gold, lv >= 5 ? 0.4 : 0);
  }
  for (let x = cx - 3; x < cx + 3; x++) v.box(x, 1, hz - 2, x + 1, 6 - (Math.abs(x + 0.5 - cx) < 1.5 ? 0 : 1), hz - 1, (x & 1) ? gold : "iron", lv >= 5 ? 0.3 : 0);
  // hedges lining the front
  hedge(v, -hx + 1, hz - 4, cx - 5, hz - 3);
  hedge(v, cx + 5, hz - 4, hx - 1, hz - 3);
  if (lv >= 2) {
    // fountain court in front of the house
    const fz = Math.floor((driveZ0 + hz - 4) / 2);
    for (let x = cx - 8; x <= cx + 8; x++) for (let z = fz - 6; z <= fz + 6; z++) {
      const d = Math.hypot(x - cx, z - fz);
      if (d <= 6.5) v.put(x, 0, z, "path2");
    }
    v.cylinderY(cx, fz, 1, 2, 4.2, "marble");
    v.cylinderY(cx, fz, 1, 2, 3.4, "water", 0.2);
    v.cylinderY(cx, fz, 2, 4, 1.2, "marble");
    v.cylinderY(cx, fz, 4, 5, 2, "marble");
    v.put(cx, 5, fz, "foam", 0.6);
    v.put(cx, 6, fz, "foam", 0.6);
    if (lv >= 5) v.put(cx, 7, fz, "gold", 0.6);
    car(v, cx - 5, 1, fz + 4, "x", "black");
    for (const tx of [cx - 9, cx + 8]) topiary(v, tx, fz, s === 1);
  }
  if (lv >= 3 && hx > 16) {
    // pool + pool house on the right, garage with supercars on the left
    const px0 = x1 + 3;
    const px1 = hx - 2;
    if (px1 - px0 >= 6) {
      pool(v, px0, z0 + 2, px1, z0 + 12, s === 3 ? "stone" : "marble");
      v.box(px0, 1, z0 - 2 + 0, px1, 6, z0 + 1, s === 2 ? "white" : wallCol);
      v.box(px0 + 1, 1, z0 + 0, px1 - 1, 5, z0 + 1, "glass", 0.45);
      for (let x = px0 + 1; x < px1 - 1; x += 3) lawnChair(v, x, z0 + 14, "white");
    }
    const gx1 = x0 - 2;
    const gx0 = -hx + 2;
    if (gx1 - gx0 >= 6) {
      v.box(gx0, 1, z0 + 1, gx1, 6, z0 + 10, wallCol);
      for (let z = z0 + 2; z < z0 + 9; z += 3) v.box(gx1 - 1, 1, z, gx1, 5, z + 2, "charcoal");
      v.box(gx1, 0, z0 + 1, x0, 1, z0 + 10, "path2");
      car(v, gx1 + 3, 1, z0 + 12, "z", "red");
      car(v, gx0 + 3, 1, z0 + 13, "z", "yellow");
    }
  }
  if (lv >= 4 && hz > 16) {
    // hedge maze + statues on the flanks
    const mx0 = -hx + 2;
    const mx1 = cx - 10;
    const mz0 = zf + 6;
    const mz1 = hz - 6;
    if (mx1 - mx0 > 8) {
      for (let x = mx0; x < mx1; x++) {
        for (let z = mz0; z < mz1; z++) {
          const edge = x === mx0 || x === mx1 - 1 || z === mz0 || z === mz1 - 1;
          const inner = (x - mx0) % 3 === 0 && hash01(x, z) < 0.75 || (z - mz0) % 3 === 0 && hash01(z, x) < 0.55;
          if ((edge && !(z === mz1 - 1 && x === mx0 + 3)) || inner) v.box(x, 1, z, x + 1, 3, z + 1, "leafDark");
        }
      }
      v.put(Math.floor((mx0 + mx1) / 2), 1, Math.floor((mz0 + mz1) / 2), gold);
    }
    // rose garden on the right
    const rx0 = cx + 10;
    for (let x = rx0; x < (lv >= 5 ? rx0 - 1 : hx - 2); x += 3) for (let z = zf + 7; z < hz - 6; z += 3) bush(v, x, 1, z, 1, "leaf", c.pick(["red", "pink", "white"]));
    for (const sx of [cx - 9, cx + 9]) statue(v, sx, zf + 4);
  }
  if (lv >= 5) {
    // helipad with helicopter + lamp-lined drive
    const hpx = hx > 16 ? hx - 9 : x1 - 6;
    const hpz = hz > 16 ? Math.floor((zf + hz) / 2) - 2 : zf + 3;
    if (hz > 16) {
      v.box(hpx - 6, 0, hpz - 6, hpx + 6, 1, hpz + 6, "concreteDark");
      helipad(v, hpx, 1, hpz, 5);
      helicopter(c, hpx, 2, hpz, s === 2 ? "white" : "black");
      for (const [bx, bz] of [[-6, -6], [5, -6], [-6, 5], [5, 5]]) c.blink(hpx + bx, 1, hpz + bz, "amber");
    }
    for (let z = driveZ0 + 1; z < hz - 3; z += 4) {
      v.box(cx - 3, 1, z, cx - 2, 4, z + 1, "iron");
      v.put(cx - 3, 4, z, "warmGlow", 1.2);
      v.box(cx + 2, 1, z, cx + 3, 4, z + 1, "iron");
      v.put(cx + 2, 4, z, "warmGlow", 1.2);
    }
    folk(c, cx + 1, zf + 5);
  }
}

defineDesigns({
  beach_houses: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Stilt Beach Shack", "Surf-Deck Cottage", "Boardwalk Beach House", "Dockside Beach House", "Oceanfront Lookout Retreat"],
    growth: "Gains a wraparound deck, a boardwalk to the surf, a dock with sailboat, then a rooftop lookout and lifeguard tower.",
    build: buildBeachHouse,
  },
  villas: {
    footprints: [[2, 1], [2, 2], [2, 2], [3, 2], [3, 3]],
    levels: ["Hillside Villa", "Pergola Villa", "Poolside Villa", "Vineyard Villa", "Grand Riviera Villa"],
    growth: "Adds a vine pergola, a pool, a tower and vineyard/grove, then formal fountain gardens and a gate.",
    build: buildVilla,
  },
  mansions: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [3, 3]],
    levels: ["Gated Manor", "Fountain-Court Mansion", "Pool & Garage Mansion", "Hedge-Maze Estate", "Billionaire's Palace"],
    growth: "Gains prestige grounds: gates, a fountain court, pool & supercar garage, hedge maze & statues, then a gilded gate and helipad.",
    build: buildMansion,
  },
});
