import {
  type Ctx,
  PixelVox,
  bush,
  car,
  chimney,
  door,
  fence,
  flatRoof,
  flowerBed,
  gable,
  hip,
  lot,
  person,
  pool,
  speckle,
  tree,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";

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
  const roof = ["woodDark", "slate", "charcoal", "#5b6b4a"][s];
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
  const twoRows = hz > 8;
  // front row
  const zf = twoRows ? 2 : hz - 5;
  const z0 = twoRows ? -5 : -hz + 1;
  // street & sidewalk / canal along the front
  if (s === 2 && lv >= 3) {
    v.box(-hx, 0, hz - 4, hx, 1, hz, "waterDeep", 0.08);
    v.box(-hx, 0, hz - 5, hx, 1, hz - 4, "granite");
  } else {
    v.box(-hx, 0, zf, hx, 1, hz - 2, "concrete");
    v.box(-hx, 0, hz - 2, hx, 1, hz, "asphalt");
  }
  const n = Math.floor((hx * 2) / unitW);
  const startX = -Math.floor((n * unitW) / 2);
  for (let i = 0; i < n; i++) {
    const ux0 = startX + i * unitW;
    const fl = floors + (s === 1 && i % 3 === 1 ? 0 : 0);
    townUnit(c, ux0, ux0 + unitW, z0, zf, fl, s, i + s * 2 + lv, lv);
  }
  if (twoRows) {
    // back row facing a shared mews garden
    const bz1 = -hz + 9;
    for (let i = 0; i < n; i++) {
      const ux0 = startX + i * unitW;
      townUnit(c, ux0, ux0 + unitW, -hz + 1, bz1, floors - 1, s, i + 3, lv);
    }
    v.box(-hx + 1, 0, bz1 + 1, hx - 1, 1, -6, "grass");
    for (let x = -hx + 4; x < hx - 2; x += 10) tree(v, x, 1, bz1 + 2, s === 1 ? "blossom" : "round", 0.8, x);
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
