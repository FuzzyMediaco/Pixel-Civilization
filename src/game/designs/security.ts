import {
  type Ctx,
  PixelVox,
  barrelRoof,
  bench,
  car,
  container,
  crane,
  curtainWall,
  cyl,
  door,
  flag,
  flatRoof,
  gable,
  helipad,
  hip,
  lamp,
  lot,
  person,
  ring,
  securityFence,
  solarRow,
  speckle,
  tank,
  tree,
  truck,
  windows,
} from "./kit";
import {
  type HullOpts,
  deckhouse,
  funnel,
  helicopter,
  hull,
  jet,
  mast,
  pier,
  propPlane,
  quayFoundation,
  radar,
  radarDish,
  screwProp,
  stealthWing,
  subHull,
  turret,
} from "./vehicles";
import { defineDesigns } from "./registry";

type V = PixelVox;
const POLICE_BLUE = "#2f6bff";
const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];

function lv5<T>(lv: number, arr: readonly [T, T, T, T, T]): T {
  return arr[Math.max(1, Math.min(5, lv)) - 1];
}

function guy(c: Ctx, x: number, y: number, z: number, shirt: string, pants = "blueDark"): void {
  person(c.v, x, y, z, shirt, pants, c.pick(SKIN));
}

/** Police cruiser with two-tone paint + red/blue lightbar */
function cruiser(c: Ctx, x: number, z: number, axis: "x" | "z", body: string, dark: string, blink = false): void {
  const v = c.v;
  car(v, x, 1, z, axis, body);
  if (axis === "z") {
    v.box(x - 1, 1, z - 2, x + 1, 2, z - 1, dark);
    v.box(x - 1, 1, z + 2, x + 1, 2, z + 3, dark);
    v.put(x - 1, 3, z, "red", 1.3);
    v.put(x, 3, z, POLICE_BLUE, 1.3);
  } else {
    v.box(x - 2, 1, z - 1, x - 1, 2, z + 1, dark);
    v.box(x + 2, 1, z - 1, x + 3, 2, z + 1, dark);
    v.put(x, 3, z - 1, "red", 1.3);
    v.put(x, 3, z, POLICE_BLUE, 1.3);
  }
  if (blink) c.blink(x, 3, z, "red");
}

/** Boxy armoured tactical van (8 long) */
function armoredVan(c: Ctx, x: number, z: number, axis: "x" | "z", col: string, trim: string): void {
  const v = c.v;
  if (axis === "z") {
    v.box(x - 2, 1, z - 4, x + 2, 5, z + 3, col);
    v.box(x - 2, 1, z + 3, x + 2, 4, z + 5, col);
    v.box(x - 2, 3, z + 4, x + 2, 4, z + 5, "glassDark", 0.3);
    v.box(x - 3, 1, z + 5, x + 3, 2, z + 6, "steelDark");
    v.box(x - 2, 3, z - 3, x - 1, 4, z + 2, trim);
    v.box(x + 1, 3, z - 3, x + 2, 4, z + 2, trim);
    v.put(x - 1, 5, z + 1, "red", 1.2);
    v.put(x, 5, z + 1, POLICE_BLUE, 1.2);
    v.box(x - 2, 0, z - 3, x + 2, 1, z - 1, "rubber");
    v.box(x - 2, 0, z + 2, x + 2, 1, z + 4, "rubber");
  } else {
    v.box(x - 4, 1, z - 2, x + 3, 5, z + 2, col);
    v.box(x + 3, 1, z - 2, x + 5, 4, z + 2, col);
    v.box(x + 4, 3, z - 2, x + 5, 4, z + 2, "glassDark", 0.3);
    v.box(x + 5, 1, z - 3, x + 6, 2, z + 3, "steelDark");
    v.box(x - 3, 3, z - 2, x + 2, 4, z - 1, trim);
    v.box(x - 3, 3, z + 1, x + 2, 4, z + 2, trim);
    v.put(x + 1, 5, z - 1, "red", 1.2);
    v.put(x + 1, 5, z, POLICE_BLUE, 1.2);
  }
}

/** Military tank (9 long incl. barrel) */
function tankVehicle(v: V, x: number, z: number, col: string, axis: "x" | "z" = "x", dir: 1 | -1 = 1): void {
  if (axis === "x") {
    v.box(x - 3, 1, z - 2, x + 4, 2, z + 2, "rubber");
    v.box(x - 3, 2, z - 2, x + 4, 3, z + 2, col);
    v.box(x - 1, 3, z - 1, x + 2, 4, z + 1, col);
    v.put(x, 4, z - 1, "steelDark");
    if (dir === 1) v.box(x + 2, 3, z, x + 7, 4, z + 1, "steelDark");
    else v.box(x - 6, 3, z, x - 1, 4, z + 1, "steelDark");
  } else {
    v.box(x - 2, 1, z - 3, x + 2, 2, z + 4, "rubber");
    v.box(x - 2, 2, z - 3, x + 2, 3, z + 4, col);
    v.box(x - 1, 3, z - 1, x + 1, 4, z + 2, col);
    v.put(x - 1, 4, z, "steelDark");
    if (dir === 1) v.box(x, 3, z + 2, x + 1, 4, z + 7, "steelDark");
    else v.box(x, 3, z - 6, x + 1, 4, z - 1, "steelDark");
  }
}

function jeep(v: V, x: number, z: number, col: string, axis: "x" | "z" = "x"): void {
  car(v, x, 1, z, axis, col);
  if (axis === "x") {
    v.box(x - 1, 2, z - 1, x + 2, 3, z + 1, null);
    v.box(x + 1, 2, z - 1, x + 2, 3, z + 1, "glass", 0.2);
    v.put(x - 2, 2, z, "rubber");
  } else {
    v.box(x - 1, 2, z - 1, x + 1, 3, z + 2, null);
    v.box(x - 1, 2, z + 1, x + 1, 3, z + 2, "glass", 0.2);
    v.put(x, 2, z - 2, "rubber");
  }
}

/** Searchlight rotor (sweeping beam) */
function searchlight(c: Ctx, x: number, y: number, z: number, speed = 0.9): void {
  const r = new PixelVox(31);
  r.put(0, 0, 0, "steelDark");
  r.put(1, 0, 0, "#fff6c0", 1.6);
  for (let k = 2; k < 7; k++) r.put(k, -Math.floor((k - 1) / 2), 0, "#fff3a0", 1.1);
  c.addRotor({ vox: r, pivot: [x + 0.5, y, z + 0.5], axis: "y", speed });
}

/** Guard tower on legs (4×4 cab). Returns cab top y. */
function guardTower(c: Ctx, x: number, z: number, h: number, leg: string, cab: string, roof: string, light = true, roofKind: "hip" | "flat" | "cone" = "hip"): number {
  const v = c.v;
  if (leg === cab) {
    v.box(x, 1, z, x + 4, h, z + 4, leg);
  } else {
    for (const [dx, dz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) v.box(x + dx, 1, z + dz, x + dx + 1, h, z + dz + 1, leg);
    for (let y = 4; y < h; y += 4) {
      v.box(x, y, z, x + 4, y + 1, z + 1, leg);
      v.box(x, y, z + 3, x + 4, y + 1, z + 4, leg);
    }
  }
  v.box(x - 1, h, z - 1, x + 5, h + 1, z + 5, cab);
  v.box(x - 1, h + 1, z - 1, x + 5, h + 4, z + 5, cab);
  v.box(x - 1, h + 2, z - 1, x + 5, h + 3, z + 5, "glassDark", 0.4);
  v.box(x, h + 1, z, x + 4, h + 4, z + 4, cab);
  if (roofKind === "hip") hip(v, x - 2, h + 4, z - 2, x + 6, z + 6, roof);
  else if (roofKind === "cone") v.cone(x + 2, h + 4, h + 9, z + 2, 3.8, 0.3, roof);
  else v.box(x - 2, h + 4, z - 2, x + 6, h + 5, z + 6, roof);
  if (light) searchlight(c, x + 2, h + (roofKind === "hip" ? 7 : roofKind === "cone" ? 9 : 5), z + 2, 0.7 + c.rand() * 0.6);
  return h + 4;
}

/** Barred window: [bar, glow, bar] × 2 tall on a face. face: s = +z, e = +x */
function barredWindow(v: V, x: number, y: number, z: number, face: "s" | "n" | "e" | "w", glow = 0.5): void {
  for (let k = 0; k < 3; k++) {
    for (let dy = 0; dy < 2; dy++) {
      const col = k === 1 ? "warmGlow" : "iron";
      const e = k === 1 ? glow : 0;
      if (face === "s" || face === "n") v.put(x + k, y + dy, z, col, e);
      else v.put(x, y + dy, z + k, col, e);
    }
  }
}

function barredWindows(v: V, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, faces = "nsew", stepH = 5, stepV = 4): void {
  for (let y = y0 + 1; y + 2 <= y1 - 1; y += stepV) {
    for (let x = x0 + 2; x + 3 <= x1 - 1; x += stepH) {
      if (faces.includes("s")) barredWindow(v, x, y, z1 - 1, "s");
      if (faces.includes("n")) barredWindow(v, x, y, z0, "n");
    }
    for (let z = z0 + 2; z + 3 <= z1 - 1; z += stepH) {
      if (faces.includes("e")) barredWindow(v, x1 - 1, y, z, "e");
      if (faces.includes("w")) barredWindow(v, x0, y, z, "w");
    }
  }
}

function sandbags(v: V, x0: number, z0: number, x1: number, z1: number, h = 2): void {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) for (let y = 1; y <= h; y++) v.put(x, y, z, (x + z + y) % 2 ? "camoTan" : "sandDark");
}

// =============================================================================================
// POLICE PRECINCT — corner station with twin blue lamps & POLICE sign; grows into a precinct house
//  V0 Brownstone (brick + limestone, NYC-style)   V1 Frontier Sheriff (timber false-front, gold star)
//  V2 Modern Community Station (white + glass + blue band)   V3 Tudor Bobby Station (half-timber, police box)
// =============================================================================================
const PCT = [
  { wall: "brick", trim: "limestone", roof: "concreteDark", carBody: "white", carDark: "black" },
  { wall: "woodLight", trim: "woodDark", roof: "wood", carBody: "#e9e2cf", carDark: "#6b4a2a" },
  { wall: "white", trim: POLICE_BLUE, roof: "concreteDark", carBody: "white", carDark: "blueDark" },
  { wall: "cream", trim: "woodDark", roof: "slate", carBody: "white", carDark: "#1f4fbf" },
];

function precinctBuilding(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number, tower: boolean): void {
  const v = c.v;
  const s = c.variant % 4;
  const p = PCT[s];
  const fh = 4;
  const top = 1 + floors * fh;
  const cx = Math.floor((x0 + x1) / 2);
  v.box(x0, 1, z0, x1, top, z1, p.wall);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
  if (s === 0) {
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, stepH: 3, sill: "limestone", emit: 0.45 });
    for (let f = 1; f < floors; f++) v.box(x0, 1 + f * fh, z0, x1, 2 + f * fh, z1, "limestone");
    v.box(x0 - 1, top - 1, z0 - 1, x1 + 1, top, z1 + 1, "limestone");
    flatRoof(c, x0, top, z0, x1, z1, p.roof, "limestone", true);
    v.box(cx - 3, 1, z1, cx + 3, 2, z1 + 2, "limestone");
  } else if (s === 1) {
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, stepH: 3, sill: "woodDark", emit: 0.45 });
    for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, top, z1, "wood");
    gable(v, x0, top, z0, x1, z1 - 1, "z", p.roof, "woodDark");
    // false front
    v.box(x0, top, z1 - 1, x1, top + 4, z1, p.wall);
    v.box(x0 + 2, top + 4, z1 - 1, x1 - 2, top + 6, z1, p.wall);
    v.box(x0, top + 3, z1 - 1, x1, top + 4, z1, "woodDark");
    // gold star badge
    const sy = top + 2;
    v.box(cx - 1, sy, z1, cx + 1, sy + 2, z1 + 1, "gold", 0.3);
    v.put(cx - 2, sy + 1, z1, "gold", 0.3);
    v.put(cx + 1, sy + 1, z1, "gold", 0.3);
    v.put(cx - 1, sy + 2, z1, "gold", 0.3);
    // porch roof on posts
    const pz = Math.min(c.hz - 1, z1 + 3);
    v.box(x0, fh, z1, x1, fh + 1, pz, "wood");
    for (let x = x0; x < x1; x += 4) v.box(x, 1, pz - 1, x + 1, fh, pz, "woodDark");
    v.box(x0, 1, z1, x1, 1, pz, "woodLight");
  } else if (s === 2) {
    for (let f = 0; f < floors; f++) {
      v.box(x0, 2 + f * fh, z0, x1, 4 + f * fh, z1, "glass", 0.35);
      v.box(x0 + 1, 2 + f * fh, z0 + 1, x1 - 1, 4 + f * fh, z1 - 1, null);
      v.box(x0, 1 + f * fh, z0, x1, 2 + f * fh, z1, POLICE_BLUE);
    }
    for (let x = x0; x < x1; x += 4) v.box(x, 1, z1 - 1, x + 1, top, z1, "white");
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "white", false);
    for (let x = x0 + 2; x < x1 - 3; x += 4) v.box(x, top + 1, z0 + 2, x + 3, top + 2, z0 + 5, "solarBlue", 0.1);
    v.box(x0 - 1, 4, z1, x1 + 1, 5, z1 + 3, "white");
  } else {
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, stepH: 4, emit: 0.45 });
    for (let x = x0; x < x1; x += 3) {
      v.box(x, 1 + fh, z1 - 1, x + 1, top, z1, "woodDark");
      v.box(x, 1 + fh, z0, x + 1, top, z0 + 1, "woodDark");
    }
    for (let f = 1; f <= floors; f++) v.box(x0, f * fh, z0, x1, f * fh + 1, z1, "woodDark");
    v.box(x0, 1, z0, x1, 1 + fh, z1, floors > 1 ? "brick" : p.wall);
    windows(c, x0, 1, z0, x1, 1 + fh, z1, { h: 2, stepH: 4, emit: 0.45 });
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", "slate", "woodDark");
  }
  // entrance: door, twin blue lamps, POLICE sign band
  door(v, cx - 1, s === 1 ? 2 : 1, z1 - 1, s === 2 ? "glassDark" : "blueDark", 2, 3, false);
  for (const lx of [cx - 3, cx + 2]) {
    v.put(lx, 3, z1, "iron");
    v.put(lx, 4, z1, POLICE_BLUE, 1.5);
  }
  const sy = s === 1 ? fh + 1 : 4;
  if (s !== 1) {
    v.box(cx - 5, sy, z1, cx + 5, sy + 1, z1 + 1, "#1f4fbf", 0.5);
    for (let x = cx - 4; x < cx + 4; x += 1) if (x % 2 === 0) v.put(x, sy, z1 + 1, "white", 0.8);
  }
  if (tower) {
    // corner clock / lantern tower with blue beacon
    const tx = x1 - 4;
    const tz = z1 - 4;
    v.box(tx, top, tz, tx + 4, top + 7, tz + 4, s === 2 ? "white" : s === 1 ? p.wall : s === 3 ? "cream" : "limestone");
    if (s !== 2) {
      v.box(tx + 1, top + 4, tz + 4, tx + 3, top + 6, tz + 5, "white", 0.4);
      v.put(tx + 1, top + 5, tz + 5, "black");
    } else v.box(tx, top + 2, tz, tx + 4, top + 6, tz + 4, "glass", 0.4);
    if (s === 3 || s === 0) hip(v, tx - 1, top + 7, tz - 1, tx + 5, tz + 5, s === 3 ? "slate" : "copper");
    else v.box(tx - 1, top + 7, tz - 1, tx + 5, top + 8, tz + 5, s === 1 ? "woodDark" : POLICE_BLUE);
    v.box(tx + 1, top + 9, tz + 1, tx + 3, top + 11, tz + 3, POLICE_BLUE, 1.6);
    c.blink(tx + 2, top + 11, tz + 2, "blue");
  }
}

function buildPolicePrecinct(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = PCT[s];
  lot(c, s === 1 ? "sand" : "concrete2");
  if (s === 1) speckle(c, "sandDark", 0.1);
  if (s === 3) speckle(c, "grass2", 0.05);
  if (lv === 1 && s === 3) {
    // the classic blue police box + bobby on a bicycle
    v.box(-hx, 0, -hz, hx, 1, hz, "grass2");
    v.box(-hx, 0, 2, hx, 1, hz, "path");
    v.box(-3, 1, -3, 2, 2, 2, "stone");
    v.box(-2, 2, -2, 1, 11, 1, "#1f3f8f");
    for (const [x, z] of [[-2, 1], [0, 1], [1, -1], [1, 0]]) {
      v.box(x, 7, z, x + 1, 9, z + 1, "white", 0.6);
    }
    v.box(-2, 9, 0, 1, 10, 1, "black");
    v.box(-2, 11, -2, 1, 12, 1, "#1f3f8f");
    v.put(-1, 12, -1, POLICE_BLUE, 1.6);
    c.blink(-1, 12, -1, "blue");
    guy(c, 4, 1, 3, "blueDark", "black");
    v.put(4, 4, 3, "blueDark");
    v.box(-6, 1, 5, -2, 2, 6, "black");
    v.put(-6, 2, 5, "silver");
    lamp(v, 5, 1, -5, 5);
    bench(v, -6, 1, -5, "x", "woodDark");
    return;
  }
  if (lv === 1) {
    // A single officer can work the street-facing counter. The enclosed station comes at L2.
    v.box(-4, 0, -4, 4, 1, 4, "path");
    v.box(-3, 1, -3, 3, 4, 2, p.wall);
    v.box(-3, 4, -3, 3, 7, -2, p.wall);
    for (const x of [-3, 2]) v.box(x, 4, 1, x + 1, 7, 2, p.trim);
    guy(c, 0, 2, -1, "blueDark", "black");
    v.box(-3, 4, 1, 3, 5, 3, p.trim);
    if (s === 1) {
      gable(v, -4, 7, -4, 4, 3, "z", "woodDark");
      v.box(3, 1, 4, 4, 4, 5, "woodDark");
      v.box(6, 1, 4, 7, 4, 5, "woodDark");
      v.box(3, 3, 4, 7, 4, 5, "wood");
      v.put(0, 8, 3, "gold", 0.4);
    } else if (s === 2) {
      v.box(-3, 7, -3, 4, 8, 4, "white");
      solarRow(v, -2, 3, 8, -2);
      v.put(-3, 7, 3, "screenCyan", 1);
    } else {
      hip(v, -4, 7, -4, 4, 3, "copper", "iron", 3);
      v.put(0, 10, 0, POLICE_BLUE, 1);
    }
    lamp(v, -6, 1, 5, 4);
    bench(v, 1, 1, 5, "x", p.trim);
    return;
  }
  const floors = lv5(lv, [1, 1, 2, 2, 3] as const);
  let x0 = -hx + 2;
  let x1 = hx - 2;
  let z0 = -hz + 2;
  let z1 = hz - 5;
  if (lv === 3) {
    x1 = Math.min(hx - 12, 4);
  } else if (lv >= 4) {
    z1 = Math.min(hz - 13, z0 + 14);
    x1 = lv === 5 ? hx - 2 : hx - 6;
  }
  v.box(Math.floor((x0 + x1) / 2) - 2, 0, z1, Math.floor((x0 + x1) / 2) + 2, 1, hz, "path");
  precinctBuilding(c, x0, z0, x1, z1, floors, lv === 5);
  // roof antenna
  if (lv >= 3) {
    const ty = 1 + floors * 4 + 1;
    v.box(x0 + 2, ty, z0 + 2, x0 + 3, ty + 7, z0 + 3, "steelDark");
    v.put(x0 + 2, ty + 7, z0 + 2, "red", 1.2);
    c.blink(x0 + 2, ty + 7, z0 + 2, "red");
  }
  if (lv === 2) {
    cruiser(c, -hx + 4, hz - 3, "x", p.carBody, p.carDark, true);
    flag(v, hx - 3, 1, hz - 3, 9);
    guy(c, 3, 1, hz - 3, "blueDark", "black");
    v.box(4, 1, hz - 2, 6, 2, hz - 1, "black");
    return;
  }
  if (lv === 3) {
    // side motor pool lot
    const lx0 = x1 + 1;
    v.box(lx0, 0, -hz + 1, hx - 1, 1, hz - 1, "asphalt");
    for (let z = -hz + 2; z < hz - 3; z += 6) {
      v.box(lx0 + 1, 0, z, hx - 2, 1, z + 1, "white");
      cruiser(c, Math.floor((lx0 + hx) / 2), z + 3, "x", p.carBody, p.carDark, z === -hz + 2);
    }
    flag(v, x0, 1, hz - 2, 10);
    guy(c, 0, 1, hz - 2, "blueDark", "black");
    return;
  }
  // Lv4/5: front parking with a fleet of cruisers, K9 kennel, paddy wagon
  v.box(-hx + 1, 0, z1 + 2, hx - 1, 1, hz - 1, "asphalt");
  let k = 0;
  for (let x = -hx + 3; x < hx - 3; x += 5) {
    if (Math.abs(x - Math.floor((x0 + x1) / 2)) < 4) continue;
    v.box(x - 2, 0, z1 + 2, x - 1, 1, z1 + 8, "white");
    cruiser(c, x + 1, z1 + 5, "z", p.carBody, p.carDark, k++ === 0);
  }
  if (lv === 4) {
    // K9 kennel at the side
    v.box(hx - 5, 1, z0, hx - 1, 4, z0 + 4, "woodDark");
    gable(v, hx - 5, 4, z0, hx - 1, z0 + 4, "z", "red");
    v.box(hx - 4, 1, z0 + 5, hx - 2, 2, z0 + 6, "#8a5a3a");
    v.put(hx - 4, 2, z0 + 5, "#6b4a2a");
  } else {
    truck(v, -hx + 6, 1, hz - 3, "x", "white", p.carDark);
    v.put(-hx + 6, 4, hz - 3, POLICE_BLUE, 1.3);
    flag(v, -hx + 2, 1, z1 + 1, 13);
  }
  for (const lx of [-hx + 1, hx - 2]) lamp(v, lx, 1, z1 + 1, 5);
  guy(c, 1, 1, z1 + 1, "blueDark", "black");
  guy(c, -3, 1, z1 + 2, "blueDark", "black");
}

// =============================================================================================
// POLICE DEPARTMENT — the city HQ tower: badge emblem, radio mast, parking garage, rooftop helipad
//  V0 Art-Deco Limestone (setbacks & gold fins)   V1 Blue-Glass Modern   V2 Brutalist Fortress   V3 Neo-Classical (columns & pediment)
// =============================================================================================
function badge(v: V, cx: number, cy: number, z: number, s: number): void {
  const field = s === 3 ? "gold" : POLICE_BLUE;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      if (dx * dx + dy * dy <= 10) v.put(cx + dx, cy + dy, z, field, 0.6);
    }
  }
  const star = s === 3 ? POLICE_BLUE : "gold";
  for (const [dx, dy] of [[0, 2], [0, 1], [-1, 0], [0, 0], [1, 0], [-2, 1], [2, 1], [0, -1], [-1, -2], [1, -2]]) v.put(cx + dx, cy + dy, z + 1, star, 0.8);
}

function buildPoliceDepartment(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "concrete2");
  const floors = lv5(lv, [3, 5, 7, 9, 12] as const);
  const fh = 4;
  const x0 = -hx + 2;
  const x1 = x0 + Math.min(20, Math.round(hx * 1.15));
  const z0 = -hz + 2;
  const z1 = z0 + Math.min(18, hz * 2 - 12);
  const top = 1 + floors * fh;
  const cx = Math.floor((x0 + x1) / 2);
  const wall = ["limestone", "white", "concrete", "marble"][s];
  // tower body
  if (s === 1) {
    curtainWall(c, x0, 1, z0, x1, top, z1, "#5fa8e8", "white", 3, fh);
    v.box(x0 - 1, top - fh, z0 - 1, x1 + 1, top, z1 + 1, "white");
    curtainWall(c, x0 - 1, top - fh + 1, z0 - 1, x1 + 1, top - 1, z1 + 1, "#5fa8e8", "white", 3, fh);
  } else if (s === 2) {
    v.box(x0 + 1, 1, z0 + 1, x1 - 1, top, z1 - 1, wall);
    v.clear(x0 + 2, 1, z0 + 2, x1 - 2, top - 1, z1 - 2);
    windows(c, x0 + 1, 1, z0 + 1, x1 - 1, top, z1 - 1, { stepV: fh, w: 1, h: 2, stepH: 2, emit: 0.4, col: "warmGlow" });
    // jutting heavy upper floors (inverted ziggurat)
    for (let f = Math.max(1, floors - 3); f < floors; f++) {
      const y = 1 + f * fh;
      v.box(x0 - 1, y, z0 - 1, x1 + 1, y + 1, z1 + 1, "concreteDark");
    }
    v.box(x0, 1, z1 - 2, x0 + 3, top, z1 + 1, "concreteDark");
    v.box(x1 - 3, 1, z1 - 2, x1, top, z1 + 1, "concreteDark");
  } else {
    v.box(x0, 1, z0, x1, top, z1, wall);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, stepH: 2, emit: 0.42 });
    if (s === 0) {
      for (let x = x0 + 1; x < x1; x += 4) v.box(x, 5, z1 - 1, x + 1, top, z1 + 1, x % 8 === 1 ? "gold" : "limestone");
      // setbacks
      const sb = Math.min(3, Math.floor(floors / 3));
      let y = top;
      for (let k = 1; k <= sb; k++) {
        v.box(x0 + k * 2, y, z0 + k * 2, x1 - k * 2, y + 3, z1 - k * 2, "limestone");
        v.box(x0 + k * 2, y + 1, z1 - k * 2 - 1, x1 - k * 2, y + 2, z1 - k * 2, "warmGlow", 0.5);
        y += 3;
      }
    } else {
      // neoclassical colonnade + pediment
      for (let x = x0 + 1; x < x1; x += 3) v.box(x, 1, z1, x + 1, 9, z1 + 1, "white");
      v.box(x0, 9, z1 - 1, x1, 10, z1 + 2, "marbleShade");
      for (let k = 0; k < 4; k++) v.box(x0 + 2 + k * 2, 10 + k, z1, x1 - 2 - k * 2, 11 + k, z1 + 1, "marble");
      v.box(x0, top - 1, z0, x1, top, z1, "marbleShade");
    }
  }
  const roofY = top;
  if (s !== 1) v.box(x0, roofY, z0, x1, roofY + 1, z1, "concreteDark");
  else v.box(x0 - 1, roofY, z0 - 1, x1 + 1, roofY + 1, z1 + 1, "concreteDark");
  // badge over the entrance
  badge(v, cx, Math.min(top - 4, s === 3 ? 13 : 8 + floors), z1 + (s === 2 ? 1 : 0), s);
  // entrance canopy + steps
  v.box(cx - 3, 1, z1, cx + 3, 4, z1 + 1, "glassDark", 0.3);
  v.box(cx - 4, 4, z1, cx + 4, 5, z1 + 3, s === 3 ? "marble" : s === 1 ? "white" : "steelDark");
  // radio mast with blinking tip
  const mx = x0 + 2;
  const mz = z0 + 2;
  const mh = 8 + lv * 3;
  for (let y = roofY + 1; y < roofY + mh; y++) v.put(mx + (y % 2), y, mz, "steelDark");
  v.box(mx, roofY + mh, mz, mx + 2, roofY + mh + 1, mz + 1, "red", 1.2);
  c.blink(mx, roofY + mh + 1, mz, "red");
  // rooftop helipad (+ helicopter from Lv4)
  if (lv >= 2) {
    const pcx = Math.floor((x0 + x1) / 2) + 2;
    const pcz = Math.floor((z0 + z1) / 2);
    const py = s === 0 ? roofY + 1 : roofY + 1;
    helipad(v, pcx, py, pcz, 5);
    for (let k = 0; k < 4; k++) c.blink(pcx + (k % 2 ? 5 : -6), py, pcz + (k < 2 ? -6 : 5), "lime");
    if (lv >= 4) helicopter(c, pcx, py + 1, pcz, s === 2 ? "charcoal" : s === 3 ? "blueDark" : POLICE_BLUE, "z", lv === 5 ? 12 : 0.001);
  }
  // parking garage (multi-deck) on the side
  const gx0 = x1 + 2;
  if (gx0 < hx - 8) {
    const decks = lv5(lv, [1, 2, 3, 3, 4] as const);
    const gz1 = Math.min(hz - 3, z1 + 2);
    for (let d = 0; d <= decks; d++) {
      const y = d * 4;
      v.box(gx0, y, z0, hx - 1, y + 1, gz1, d === 0 ? "asphalt" : "concrete");
      if (d > 0) {
        for (let x = gx0; x < hx; x += 5) {
          v.box(x, y - 3, z0, x + 1, y, z0 + 1, "concrete");
          v.box(x, y - 3, gz1 - 1, x + 1, y, gz1, "concrete");
        }
        v.box(gx0, y + 1, gz1 - 1, hx - 1, y + 2, gz1, "concreteDark");
      }
      for (let z = z0 + 3; z < gz1 - 3; z += 5) {
        if (c.rand() < 0.75) car(v, gx0 + 4, y + 1, z, "x", c.rand() < 0.4 ? "white" : c.pick(["red", "blue", "silver", "charcoal"]));
        if (hx - 1 - gx0 > 14 && c.rand() < 0.6) car(v, hx - 5, y + 1, z, "x", c.pick(["white", "silver", "sky"]));
      }
    }
    v.box(gx0 + 1, decks * 4 + 1, gz1 - 1, gx0 + 9, decks * 4 + 3, gz1, POLICE_BLUE, 0.6);
  }
  // front plaza with cruisers & flags
  const pz0 = z1 + 3;
  if (pz0 < hz - 2) {
    v.box(-hx + 1, 0, pz0 + 1, hx - 1, 1, hz - 1, "asphalt");
    let k = 0;
    for (let x = -hx + 4; x < hx - 3; x += 6) {
      if (Math.abs(x - cx) < 5) continue;
      cruiser(c, x, Math.min(hz - 4, pz0 + 4), "z", "white", s === 1 ? "blueDark" : "black", k++ < 1);
    }
    for (const fx of [cx - 6, cx + 6]) flag(v, fx, 1, pz0, 10 + lv, s === 3 ? ["blue", "gold", "blue"] : ["red", "white", "blue"]);
  }
  for (let i = 0; i < 2 + lv; i++) guy(c, c.ri(-hx + 2, hx - 3), 1, c.ri(z1 + 1, hz - 2), i % 2 ? "blueDark" : "white", "black");
}

// =============================================================================================
// JAIL — a small lockup with barred windows; grows a fenced yard, guard tower, then a lockdown perimeter
//  V0 Wild-West Sandstone Jail   V1 Victorian Brick Gaol (crenellated)   V2 Brutalist Concrete Detention   V3 Log Stockade Lockup
// =============================================================================================
const JAIL = [
  { wall: "#c9a877", trim: "#9a7a52", roof: "woodDark", ground: "sand" },
  { wall: "brick", trim: "limestone", roof: "slate", ground: "grass2" },
  { wall: "concrete", trim: "concreteDark", roof: "concreteDark", ground: "concrete2" },
  { wall: "wood", trim: "woodDark", roof: "woodDark", ground: "grass2" },
];

function jailBlock(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number): number {
  const v = c.v;
  const s = c.variant % 4;
  const p = JAIL[s];
  const top = 1 + floors * 4;
  v.box(x0, 1, z0, x1, top, z1, p.wall);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
  if (s === 3) for (let y = 2; y < top; y += 2) v.box(x0, y, z0, x1, y + 1, z1, "woodDark");
  if (s === 0) for (let y = 3; y < top; y += 3) v.box(x0, y, z0, x1, y + 1, z1, p.trim);
  if (s === 2) {
    for (let x = x0 + 2; x < x1 - 1; x += 3) for (let y = 2; y < top - 1; y += 4) v.box(x, y, z1 - 1, x + 1, y + 3, z1, "glassDark", 0.3);
    for (let z = z0 + 2; z < z1 - 1; z += 3) for (let y = 2; y < top - 1; y += 4) v.box(x1 - 1, y, z, x1, y + 3, z + 1, "glassDark", 0.3);
  } else barredWindows(v, x0, 1, z0, x1, top, z1, "nsew", 5, 4);
  // roofs
  if (s === 1) {
    v.box(x0, top, z0, x1, top + 1, z1, "slate");
    for (let x = x0; x < x1; x += 2) {
      v.put(x, top + 1, z0, p.wall);
      v.put(x, top + 1, z1 - 1, p.wall);
    }
    for (let z = z0; z < z1; z += 2) {
      v.put(x0, top + 1, z, p.wall);
      v.put(x1 - 1, top + 1, z, p.wall);
    }
    return top + 2;
  }
  if (s === 3) {
    gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", "woodDark", "wood");
    return top + 3;
  }
  if (s === 0) {
    v.box(x0, top, z0, x1, top + 1, z1, p.roof);
    v.box(x0, top, z1 - 1, x1, top + 3, z1, p.wall);
    return top + 3;
  }
  flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "concrete", true);
  for (let x = x0; x < x1; x++) if (x % 2 === 0) v.put(x, top + 2, z1 - 1, "silver");
  return top + 2;
}

function jailSign(v: V, cx: number, y: number, z: number, s: number): void {
  const bg = ["woodDark", "black", POLICE_BLUE, "woodDark"][s];
  v.box(cx - 3, y, z, cx + 3, y + 2, z + 1, bg);
  for (let x = cx - 2; x < cx + 2; x++) v.put(x, y + (x % 2 ? 0 : 1), z + 1, s === 0 || s === 3 ? "cream" : "white", 0.6);
}

function buildJails(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = JAIL[s];
  lot(c, p.ground);
  if (s !== 2) speckle(c, s === 0 ? "sandDark" : "grass3", 0.08);
  const inmate = (x: number, z: number): void => guy(c, x, 1, z, "orange", "orange");
  const guard = (x: number, z: number): void => guy(c, x, 1, z, s === 0 || s === 3 ? "#8a6a3a" : "blueDark", "black");
  if (lv <= 2) {
    const w = lv === 1 ? 5 : 6;
    const d = lv === 1 ? 4 : 5;
    const x0 = -w;
    const x1 = w;
    const z0 = -hz + 2;
    const z1 = z0 + d * 2;
    const top = jailBlock(c, x0, z0, x1, z1, lv);
    door(v, -1, 1, z1 - 1, "iron", 2, 3, true);
    jailSign(v, 0, s === 0 ? top - 3 : 5, z1, s);
    if (s === 0 || s === 3) {
      v.box(x0, 4, z1, x1, 5, z1 + 3, "woodDark");
      v.box(x0, 4, z1 + 2, x0 + 1, 1, z1 + 3, "woodDark");
      v.box(x0, 1, z1 + 2, x0 + 1, 4, z1 + 3, "woodDark");
      v.box(x1 - 1, 1, z1 + 2, x1, 4, z1 + 3, "woodDark");
      bench(v, x0 + 1, 1, z1 + 1, "x", "woodDark");
    }
    guard(3, hz - 3);
    if (lv === 2) {
      // little fenced exercise pen on the side
      securityFence(v, x1 + 1, z0, hx - 1, z1, 1, 4);
      inmate(hx - 3, z0 + 3);
      v.box(-hx + 1, 0, z1 + 1, -hx + 6, 1, hz - 1, "asphalt");
      car(v, -hx + 3, 1, hz - 4, "z", s === 2 ? "white" : "#e9e2cf");
      v.put(-hx + 3, 3, hz - 4, "red", 1.2);
    } else {
      lamp(v, x1 + 1, 1, z1 + 1, 4);
    }
    return;
  }
  if (lv === 3) {
    // county jail: 2-storey block at the front, fenced yard behind, prison bus
    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z1 = hz - 5;
    const z0 = z1 - 12;
    const top = jailBlock(c, x0, z0, x1, z1, 2);
    door(v, -1, 1, z1 - 1, "iron", 2, 3, true);
    jailSign(v, 0, 5, z1, s);
    const yz0 = -hz + 1;
    v.box(-hx + 1, 0, yz0, hx - 1, 1, z0 - 1, s === 2 ? "concrete" : "path");
    securityFence(v, -hx + 1, yz0, hx - 1, z0, 1, 5);
    for (let i = 0; i < 3; i++) inmate(c.ri(-hx + 3, hx - 4), c.ri(yz0 + 2, z0 - 3));
    // basketball hoop
    v.box(hx - 3, 1, yz0 + 3, hx - 2, 6, yz0 + 4, "steelDark");
    v.box(hx - 4, 5, yz0 + 3, hx - 3, 7, yz0 + 5, "white");
    v.put(hx - 5, 5, yz0 + 4, "orange");
    guard(4, hz - 2);
    void top;
    return;
  }
  // Lv4/5: L-shaped detention center + yard + guard tower(s) (+ perimeter at Lv5)
  const per = lv === 5 ? 3 : 1;
  if (lv === 5) {
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 6, [-4, 4]);
    for (let x = -hx + 1; x < hx - 1; x++) {
      v.put(x, 7, -hz + 1, "silver");
      if (Math.abs(x) >= 4) v.put(x, 7, hz - 2, "silver");
    }
    for (let z = -hz + 1; z < hz - 1; z++) {
      v.put(-hx + 1, 7, z, "silver");
      v.put(hx - 2, 7, z, "silver");
    }
    // sally port gate
    v.box(-5, 1, hz - 3, -4, 9, hz - 1, "concreteDark");
    v.box(4, 1, hz - 3, 5, 9, hz - 1, "concreteDark");
    v.box(-5, 8, hz - 3, 5, 9, hz - 1, "concreteDark");
    v.box(-4, 7, hz - 2, 4, 8, hz - 1, "hazard");
  }
  const floors = lv === 5 ? 3 : 2;
  const ax0 = -hx + per + 2;
  const ax1 = hx - per - 9;
  const az1 = hz - per - 7;
  const az0 = az1 - 10;
  jailBlock(c, ax0, az0, ax1, az1, floors);
  jailBlock(c, ax0, -hz + per + 2, ax0 + 10, az0, floors);
  door(v, Math.floor((ax0 + ax1) / 2) - 1, 1, az1 - 1, "iron", 2, 3, true);
  jailSign(v, Math.floor((ax0 + ax1) / 2), 5, az1, s);
  // yard
  const yx0 = ax0 + 11;
  const yz0 = -hz + per + 2;
  const yz1 = az0 - 1;
  v.box(yx0, 0, yz0, hx - per - 1, 1, yz1, "asphalt");
  securityFence(v, yx0, yz0, hx - per - 1, yz1, 1, 5);
  for (let x = yx0 + 2; x < hx - per - 2; x += 4) v.box(x, 0, yz0 + 2, x + 1, 1, yz1 - 2, "white");
  for (let i = 0; i < 2 + lv; i++) inmate(c.ri(yx0 + 2, hx - per - 3), c.ri(yz0 + 2, yz1 - 2));
  // guard tower(s)
  const tcol = s === 2 ? "concrete" : s === 1 ? "brick" : "woodDark";
  guardTower(c, hx - per - 7, az0 + 1, 10, tcol, s === 2 ? "concrete" : s === 1 ? "brick" : "wood", JAIL[s].roof, true, s === 1 ? "cone" : s === 2 ? "flat" : "hip");
  if (lv === 5) guardTower(c, -hx + per + 1, hz - per - 6, 10, tcol, s === 2 ? "concrete" : s === 1 ? "brick" : "wood", JAIL[s].roof, true, s === 1 ? "cone" : s === 2 ? "flat" : "hip");
  // prison bus
  const bz = hz - per - 3;
  v.box(hx - per - 12, 1, bz - 1, hx - per - 2, 4, bz + 2, s === 2 ? "white" : "#e9e2cf");
  for (let x = hx - per - 11; x < hx - per - 3; x += 2) v.put(x, 3, bz + 1, "iron");
  v.box(hx - per - 12, 1, bz - 1, hx - per - 2, 2, bz + 2, POLICE_BLUE);
  guard(0, hz - per - 2);
  guard(-6, hz - per - 3);
}

// =============================================================================================
// PRISON — sprawling walled complex: corner guard towers with searchlights, cell blocks, yard with track
//  V0 Gothic Penitentiary (stone castle walls)   V1 Modern Supermax (double razor-wire fences, white blocks)
//  V2 Alcatraz Rock (granite island, cream cell house, water tower, lighthouse)   V3 Panopticon (round brick cell houses)
// =============================================================================================
const PRISON = [
  { ground: "grass2", wall: "stone", block: "stone", roof: "slate", tower: "stone", troof: "slate", yard: "path" },
  { ground: "grass2", wall: "concrete", block: "white", roof: "concreteDark", tower: "concrete", troof: "concreteDark", yard: "asphalt" },
  { ground: "granite", wall: "cream", block: "cream", roof: "concreteDark", tower: "cream", troof: "red", yard: "concrete2" },
  { ground: "grass2", wall: "brick", block: "brick", roof: "slate", tower: "brick", troof: "slate", yard: "path" },
];

function buildPrison(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = PRISON[s];
  lot(c, p.ground);
  speckle(c, s === 2 ? "stone" : "grass3", 0.08);
  if (s === 2) {
    // rocky island shore around the edges
    for (let x = -hx; x < hx; x++) {
      for (const z of [-hz, hz - 1]) if (c.rand() < 0.7) v.put(x, 0, z, "water", 0.08);
    }
    for (let z = -hz; z < hz; z++) for (const x of [-hx, hx - 1]) if (c.rand() < 0.7) v.put(x, 0, z, "water", 0.08);
  }
  const wallH = s === 1 ? 6 : 8;
  const i0 = 2;
  // perimeter
  if (s === 1) {
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, wallH, [-4, 4]);
    securityFence(v, -hx + 3, -hz + 3, hx - 3, hz - 3, 1, wallH, [-4, 4]);
    for (let x = -hx + 1; x < hx - 1; x += 1) {
      v.put(x, wallH + 1, -hz + 1, "silver");
      if (Math.abs(x) > 4) v.put(x, wallH + 1, hz - 2, "silver");
    }
  } else {
    const gate: [number, number] = [-4, 4];
    for (let x = -hx + 1; x < hx - 1; x++) {
      const inGate = x >= gate[0] && x < gate[1];
      v.box(x, 1, -hz + 1, x + 1, wallH + (x % 2 === 0 && s === 0 ? 1 : 0), -hz + 3, p.wall);
      if (!inGate) v.box(x, 1, hz - 3, x + 1, wallH + (x % 2 === 0 && s === 0 ? 1 : 0), hz - 1, p.wall);
    }
    for (let z = -hz + 1; z < hz - 1; z++) {
      v.box(-hx + 1, 1, z, -hx + 3, wallH + (z % 2 === 0 && s === 0 ? 1 : 0), z + 1, p.wall);
      v.box(hx - 3, 1, z, hx - 1, wallH + (z % 2 === 0 && s === 0 ? 1 : 0), z + 1, p.wall);
    }
    if (s !== 0) {
      v.box(-hx + 1, wallH, -hz + 1, hx - 1, wallH + 1, -hz + 2, "silver");
      v.box(-hx + 1, wallH, -hz + 1, -hx + 2, wallH + 1, hz - 1, "silver");
      v.box(hx - 2, wallH, -hz + 1, hx - 1, wallH + 1, hz - 1, "silver");
    }
    // gatehouse
    v.box(-7, 1, hz - 5, -4, wallH + 4, hz - 1, p.tower);
    v.box(4, 1, hz - 5, 7, wallH + 4, hz - 1, p.tower);
    v.box(-7, wallH, hz - 5, 7, wallH + 4, hz - 1, p.tower);
    v.box(-3, 1, hz - 2, 3, wallH - 1, hz - 1, "iron");
    for (let x = -3; x < 3; x += 2) v.box(x, 1, hz - 2, x + 1, wallH - 1, hz - 1, "steelDark");
    if (s === 0) for (let x = -7; x < 7; x += 2) v.put(x, wallH + 4, hz - 1, p.tower);
    v.box(-2, wallH + 1, hz - 1, 2, wallH + 3, hz, "white", 0.5);
  }
  // corner towers
  const th = wallH + 6;
  const towers: [number, number][] = [[-hx + 1, -hz + 1], [hx - 5, -hz + 1], [-hx + 1, hz - 5], [hx - 5, hz - 5]];
  if (lv >= 4) {
    towers.push([-2, -hz + 1]);
    if (hx >= 24) towers.push([-hx + 1, -2], [hx - 5, -2]);
  }
  const nT = lv <= 1 ? 2 : towers.length;
  const tlist = lv <= 1 ? [towers[2], towers[3]] : towers.slice(0, nT);
  for (const [tx, tz] of tlist) {
    if (s === 0) {
      v.cylinderY(tx + 2, tz + 2, 1, th, 2.6, "stone");
      v.box(tx, th, tz, tx + 4, th + 3, tz + 4, "stone");
      v.box(tx, th + 1, tz, tx + 4, th + 2, tz + 4, "glassDark", 0.4);
      v.cone(tx + 2, th + 3, th + 9, tz + 2, 3.4, 0.3, "slate");
      searchlight(c, tx + 2, th + 3, tz + 2 + (tz < 0 ? 3 : -3) * 0, 0.8);
    } else {
      guardTower(c, tx, tz, th - 4, p.tower, p.tower, p.troof, true, s === 2 ? "hip" : "flat");
    }
  }
  // interior
  const ix0 = -hx + 5;
  const ix1 = hx - 5;
  const iz0 = -hz + 5;
  const iz1 = hz - 7;
  const yardZ = iz1 - Math.max(8, Math.floor((iz1 - iz0) * 0.38));
  // yard with oval track + court
  v.box(ix0, 0, yardZ, ix1, 1, iz1, p.yard);
  const ycx = (ix0 + Math.min(ix1, ix0 + 28)) / 2;
  const ycz = (yardZ + iz1) / 2;
  const rx = Math.min(13, (Math.min(ix1, ix0 + 28) - ix0) / 2 - 1);
  const rz = (iz1 - yardZ) / 2 - 1;
  for (let x = Math.floor(ycx - rx); x <= Math.ceil(ycx + rx); x++) {
    for (let z = Math.floor(ycz - rz); z <= Math.ceil(ycz + rz); z++) {
      const d = ((x + 0.5 - ycx) / rx) ** 2 + ((z + 0.5 - ycz) / rz) ** 2;
      if (d <= 1 && d >= 0.55) v.put(x, 0, z, "#c25a3c");
      else if (d < 0.55) v.put(x, 0, z, "grass2");
    }
  }
  if (ix1 - ix0 > 34) {
    const bx0 = ix1 - 12;
    v.box(bx0, 0, yardZ + 1, ix1 - 1, 1, iz1 - 1, "asphalt");
    v.box(bx0 + 5, 0, yardZ + 1, bx0 + 6, 1, iz1 - 1, "white");
    v.box(bx0, 1, Math.floor(ycz), bx0 + 1, 5, Math.floor(ycz) + 1, "steelDark");
    v.box(bx0 + 1, 4, Math.floor(ycz) - 1, bx0 + 2, 6, Math.floor(ycz) + 2, "white");
  }
  for (let i = 0; i < 3 + lv * 2; i++) guy(c, c.ri(ix0 + 1, ix1 - 2), 1, c.ri(yardZ + 1, iz1 - 2), "orange", "orange");
  // cell blocks
  const nBlocks = lv5(lv, [1, 2, 3, 4, 6] as const);
  const floors = lv5(lv, [2, 2, 3, 3, 4] as const);
  const bh = 1 + floors * 4;
  const cellBlock = (x0: number, z0: number, x1: number, z1: number): void => {
    v.box(x0, 1, z0, x1, bh, z1, p.block);
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, bh - 1, z1 - 1);
    // narrow vertical slit windows w/ bars
    for (let y = 2; y < bh - 1; y += 4) {
      for (let x = x0 + 2; x < x1 - 1; x += 2) {
        v.put(x, y, z1 - 1, "iron");
        v.put(x, y + 1, z1 - 1, "warmGlow", 0.4);
        v.put(x, y, z0, "iron");
        v.put(x, y + 1, z0, "warmGlow", 0.4);
      }
    }
    if (s === 0) {
      gable(v, x0 - 1, bh, z0 - 1, x1 + 1, z1 + 1, "x", p.roof, "stone");
      v.box(x0, bh, z0 + Math.floor((z1 - z0) / 2), x0 + 2, bh + 6, z0 + Math.floor((z1 - z0) / 2) + 2, "brickDark");
    } else if (s === 2) {
      v.box(x0 - 1, bh, z0 - 1, x1 + 1, bh + 1, z1 + 1, "red");
      barrelRoof(v, x0, bh + 1, z0, x1, z1, "x", "concreteDark");
    } else {
      flatRoof(c, x0, bh, z0, x1, z1, p.roof, s === 1 ? POLICE_BLUE : p.block, true);
    }
  };
  if (s === 3) {
    // round cell houses (panopticons) each with a central watch tower
    const R = lv <= 2 ? 5.5 : 6.5;
    const sp = Math.ceil(R) * 2 + 2;
    const slots: [number, number][] = [];
    for (let z = iz0 + Math.ceil(R); z + Math.ceil(R) <= yardZ; z += sp) for (let x = ix0 + Math.ceil(R); x + Math.ceil(R) <= ix1; x += sp) slots.push([x, z]);
    for (const [px, pz] of slots.slice(0, nBlocks)) {
      ring(v, px, pz, 1, bh, R, R - 1.3, "brick");
      for (let y = 2; y < bh - 1; y += 4) ring(v, px, pz, y, y + 1, R, R - 1.3, "warmGlow", 0.3);
      for (let y = 2; y < bh - 1; y += 4) for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        v.put(Math.floor(px + Math.cos(ang) * (R - 0.5)), y, Math.floor(pz + Math.sin(ang) * (R - 0.5)), "iron");
      }
      v.cone(px, bh, bh + 4, pz, R + 0.6, R - 2, "slate");
      v.cylinderY(px, pz, 1, bh + 6, 1.4, "brickDark");
      v.box(Math.floor(px) - 1, bh + 6, Math.floor(pz) - 1, Math.floor(px) + 1, bh + 8, Math.floor(pz) + 1, "glassDark", 0.6);
    }
  } else {
    const bw = Math.min(26, ix1 - ix0);
    let placed = 0;
    for (let z = iz0; z + 9 <= yardZ && placed < nBlocks; z += 12) {
      for (let x = ix0; x + 12 <= ix1 && placed < nBlocks; x += bw + 3) {
        const w = Math.min(bw, ix1 - x);
        if (w < 12) break;
        cellBlock(x, z, x + w, z + 9);
        placed++;
      }
    }
  }
  // Lv4+: workshop with smokestack; Lv5: legendary centerpiece
  if (lv >= 4) {
    const wx = ix1 - 8;
    const wz = yardZ - 1;
    void wx;
    void wz;
  }
  if (lv === 5) {
    const cx = Math.floor((ix0 + ix1) / 2);
    const cz = Math.floor((iz0 + yardZ) / 2);
    if (s === 0) {
      v.cylinderY(cx, cz, 1, bh + 4, 5, "stone");
      v.dome(cx, bh + 4, cz, 5, "copper");
      v.box(cx, bh + 9, cz, cx + 1, bh + 12, cz + 1, "gold", 0.4);
    } else if (s === 1) {
      v.box(cx - 3, 1, cz - 3, cx + 3, bh + 8, cz + 3, "concrete");
      v.box(cx - 4, bh + 4, cz - 4, cx + 4, bh + 8, cz + 4, "glassDark", 0.5);
      helipad(v, cx, bh + 8, cz, 4);
      helicopter(c, cx, bh + 9, cz, "white", "z", 0.001);
    } else if (s === 2) {
      v.cylinderY(cx, cz, 1, bh + 12, 2, "white");
      v.box(cx - 1, bh + 12, cz - 1, cx + 1, bh + 14, cz + 1, "warmGlow", 1.6);
      v.cone(cx, bh + 14, bh + 17, cz, 2, 0.3, "red");
      c.blink(cx, bh + 13, cz, "yellow");
      // water tower
      tank(v, ix1 - 4, iz0 + 3, bh + 2, 4, 3, "white", "red");
      for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(ix1 - 4 + dx, 1, iz0 + 3 + dz, ix1 - 3 + dx, bh + 2, iz0 + 4 + dz, "steelDark");
    } else {
      v.cylinderY(cx, cz, 1, bh + 14, 2.5, "brickDark");
      v.cylinderY(cx, cz, bh + 10, bh + 14, 3.5, "glassDark", 0.6);
      v.cone(cx, bh + 14, bh + 19, cz, 4, 0.3, "slate");
      searchlight(c, cx, bh + 19, cz, 1.2);
    }
  } else if (lv >= 4) {
    // prison industries workshop + smokestack
    const x0 = ix1 - 10;
    const z0 = iz0;
    v.box(x0, 1, z0, ix1, 7, z0 + 8, "brickDark");
    gable(v, x0, 7, z0, ix1, z0 + 8, "x", "slate");
    v.cylinderY(ix1 - 2, z0 + 2, 1, 16, 1.2, "brick");
    c.smoke(ix1 - 2, 17, z0 + 2, "smoke");
  }
  // visitors' parking out front
  if (lv >= 2 && s !== 2) {
    for (let x = -hx + 2; x < -8; x += 5) car(v, x + 2, 1, hz - 1, "x", c.pick(["red", "blue", "silver", "white"]));
  }
}

// =============================================================================================
// MILITARY BASE — sprawls: tents & sandbags → quonset barracks → tanks, radar, motor pool → obstacle course → helipad command
//  V0 Woodland (olive drab, green)   V1 Desert (tan adobe, sand)   V2 Arctic (white & grey on snow)   V3 Jungle (stilted wooden huts, palms)
// =============================================================================================
const MIL = [
  { ground: "grass2", spec: "soil", bld: "oliveDrab", roof: "#4b5a2a", veh: "#55652f", accent: "camoTan", tree: "pine" as const },
  { ground: "sand", spec: "sandDark", bld: "camoTan", roof: "sandDark", veh: "#b89a6a", accent: "oliveDrab", tree: "palm" as const },
  { ground: "snow", spec: "white", bld: "white", roof: "steelLight", veh: "#e6eaee", accent: "steelDark", tree: "pine" as const },
  { ground: "moss", spec: "leafDark", bld: "wood", roof: "#c9a25a", veh: "#3d4f2a", accent: "woodDark", tree: "palm" as const },
];

function buildMilitaryBase(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = MIL[s];
  lot(c, p.ground);
  speckle(c, p.spec, 0.1);
  // perimeter fence & gate
  securityFence(v, -hx, -hz, hx, hz, 1, 4, [-4, 4]);
  v.box(-hx + 1, 0, hz - 6, hx - 1, 1, hz - 1, "path");
  v.box(-3, 0, -hz + 1, 3, 1, hz, "path");
  // guard booth + barrier
  v.box(5, 1, hz - 4, 8, 5, hz - 1, p.bld);
  v.box(5, 3, hz - 4, 8, 4, hz - 1, "glass", 0.4);
  v.box(4, 5, hz - 5, 9, 6, hz, p.roof);
  for (let x = -4; x < 4; x++) v.put(x, 2, hz - 2, x % 2 ? "red" : "white");
  guy(c, 6, 1, hz - 5, p.veh, "black");
  // parade ground + flag
  v.box(-8, 0, hz - 16, 8, 1, hz - 7, "concrete2");
  flag(v, 0, 1, hz - 12, 10 + lv, s === 1 ? ["red", "white", "green"] : ["red", "white", "blue"]);
  for (let i = 0; i < 2 + lv; i++) guy(c, -6 + i * 2, 1, hz - 9, p.veh, "black");

  // barracks row at the back
  const nB = lv5(lv, [0, 2, 3, 4, 6] as const);
  const bw = 10;
  let bx = -hx + 2;
  for (let i = 0; i < nB && bx + bw <= hx - 2; i++, bx += bw + 2) {
    const z0 = -hz + 2;
    const z1 = z0 + 12;
    if (s === 0 || s === 2) {
      v.box(bx, 1, z0, bx + bw, 2, z1, "concrete");
      barrelRoof(v, bx, 1, z0, bx + bw, z1, "z", p.bld, p.roof);
      v.box(bx + 3, 1, z1 - 1, bx + 7, 5, z1, s === 2 ? "steelDark" : "woodDark");
      v.put(bx + 4, 4, z1, "warmGlow", 0.8);
      if (s === 0) {
        for (const x of [bx + 1, bx + 7]) v.box(x, 2, z1 - 1, x + 2, 4, z1, "glass", 0.5);
        v.box(bx + 2, 5, z1 - 1, bx + 8, 6, z1 + 1, "woodLight");
      }
      if (s === 2) v.box(bx, 7, z0, bx + bw, 8, z1, "snow");
    } else if (s === 1) {
      v.box(bx, 1, z0, bx + bw, 6, z1, p.bld);
      windows(c, bx, 1, z0, bx + bw, 6, z1, { stepH: 3, emit: 0.4 });
      flatRoof(c, bx, 6, z0, bx + bw, z1, p.roof, p.bld, false);
      v.box(bx + 4, 1, z1 - 1, bx + 6, 4, z1, "woodDark");
      v.put(bx + 7, 7, z0 + 4, "white");
    } else {
      // stilted jungle hut with thatch
      for (const [dx, dz] of [[0, 0], [bw - 1, 0], [0, 11], [bw - 1, 11]]) v.box(bx + dx, 1, z0 + dz, bx + dx + 1, 3, z0 + dz + 1, "woodDark");
      v.box(bx, 3, z0, bx + bw, 7, z1, "wood");
      windows(c, bx, 3, z0, bx + bw, 7, z1, { stepH: 3, emit: 0.4 });
      hip(v, bx - 1, 7, z0 - 1, bx + bw + 1, z1 + 1, "#c9a25a");
      for (let k = 0; k < 3; k++) v.box(bx + 4, 1 + k, z1 + 2 - k, bx + 6, 2 + k, z1 + 3 - k, "woodDark");
    }
  }
  // Lv1: tents & sandbag bunker
  if (lv <= 2) {
    for (let i = 0; i < (lv === 1 ? 3 : 2); i++) {
      const tx = -hx + 3 + i * 9;
      const tz = lv === 1 ? -hz + 3 : -hz + 17;
      if (tz + 7 > hz - 16) break;
      v.box(tx, 1, tz, tx + 7, 2, tz + 7, s === 2 ? "white" : p.bld);
      gable(v, tx, 1, tz, tx + 7, tz + 7, "z", s === 2 ? "white" : p.bld);
      v.box(tx + 3, 1, tz + 6, tx + 4, 3, tz + 7, "black");
    }
    sandbags(v, hx - 12, -hz + 4, hx - 3, -hz + 6);
    sandbags(v, hx - 12, -hz + 4, hx - 10, -hz + 12);
    jeep(v, hx - 6, -hz + 9, p.veh, "x");
    v.box(hx - 7, 1, -hz + 2, hx - 6, 7, -hz + 3, "woodDark");
    v.box(hx - 7, 6, -hz + 2, hx - 4, 7, -hz + 3, p.accent);
  }
  // watchtower
  if (lv >= 2) guardTower(c, hx - 6, hz - 22, 9, s === 1 || s === 2 ? "steelDark" : "woodDark", p.bld, p.roof, true, s === 1 ? "flat" : "hip");
  // motor pool: tanks + trucks on a gravel pad
  if (lv >= 2) {
    const mz0 = -hz + 16;
    const mz1 = Math.min(hz - 18, mz0 + 18);
    const mx0 = -hx + 2;
    const mx1 = Math.min(-2, mx0 + 26);
    v.box(mx0, 0, mz0, mx1, 1, mz1, "path2");
    let k = 0;
    for (let z = mz0 + 3; z + 2 < mz1; z += 6) {
      for (let x = mx0 + 4; x + 6 < mx1; x += 11) {
        if (k % 3 === 2) truck(v, x + 1, 1, z, "x", p.veh, p.veh);
        else tankVehicle(v, x, z, p.veh, "x", 1);
        k++;
      }
    }
    if (lv >= 3) {
      // vehicle shed
      v.box(mx0, 1, mz0 - 1, mx1, 2, mz0, p.accent);
    }
  }
  // radar dish on lattice
  if (lv >= 3) {
    const rx = hx - 8;
    const rz = -hz + 16;
    for (let y = 1; y < 9; y++) {
      v.put(rx, y, rz, "steelDark");
      v.put(rx + 1, y, rz + 1, "steelDark");
      if (y % 3 === 0) v.box(rx, y, rz, rx + 2, y + 1, rz + 2, "steelDark");
    }
    radarDish(c, rx, 9, rz, 3, s === 2 ? "steelLight" : "white", 1.1);
    v.box(rx - 4, 1, rz + 4, rx + 2, 5, rz + 8, p.bld);
    v.box(rx - 4, 3, rz + 7, rx + 2, 4, rz + 8, "screenGreen", 0.7);
  }
  // obstacle course
  if (lv >= 4) {
    const oz = hz - 15;
    const ox0 = 10;
    const ox1 = hx - 10;
    if (ox1 - ox0 >= 10) {
      v.box(ox0, 0, oz, ox1, 1, oz + 7, "soil");
      for (let x = ox0 + 1; x < ox1 - 1; x += 5) {
        const kind = Math.floor((x - ox0) / 5) % 3;
        if (kind === 0) v.box(x, 1, oz + 1, x + 1, 5, oz + 6, "woodDark");
        else if (kind === 1) for (let z = oz + 1; z < oz + 6; z += 2) { v.put(x, 1, z, "rubber"); v.put(x + 1, 1, z, "rubber"); }
        else {
          v.box(x, 1, oz + 1, x + 1, 7, oz + 2, "woodDark");
          v.box(x, 1, oz + 5, x + 1, 7, oz + 6, "woodDark");
          v.box(x, 7, oz + 1, x + 1, 8, oz + 6, "woodDark");
          v.box(x, 3, oz + 3, x + 1, 7, oz + 4, "#c9a25a");
        }
      }
      for (let i = 0; i < 3; i++) guy(c, ox0 + 2 + i * 4, 1, oz + 3, p.veh, "black");
    }
  }
  // helipad + chopper + command bunker
  if (lv >= 5) {
    const hpx = hx - 12;
    const hpz = Math.floor(hz * 0.15);
    helipad(v, hpx, 0, hpz, 6);
    helicopter(c, hpx, 1, hpz, p.veh, "z", 12);
    const cbx = -hx + 2;
    const cbz = hz - 18;
    v.box(cbx, 1, cbz - 6, cbx + 12, 6, cbz + 2, s === 3 ? "stone" : "concrete");
    v.box(cbx + 1, 6, cbz - 5, cbx + 11, 7, cbz + 1, p.ground === "snow" ? "snow" : "leafDark");
    v.box(cbx + 4, 1, cbz + 1, cbx + 8, 4, cbz + 2, "steelDark");
    const ty = 7;
    v.box(cbx + 10, ty, cbz - 4, cbx + 11, ty + 12, cbz - 3, "steelDark");
    c.blink(cbx + 10, ty + 12, cbz - 4, "red");
  }
  // trees around the edges
  for (let i = 0; i < 2 + lv; i++) {
    const tx = c.rand() < 0.5 ? -hx + 1 : hx - 2;
    tree(v, tx, 1, c.ri(-hz + 3, hz - 8), p.tree, 0.9 + c.rand() * 0.4, i);
  }
}

// =============================================================================================
// SWAT TEAM HQ — dark tactical HQ with armored vans, a training tower with rappelling troopers, shooting range & choppers
//  V0 Midnight Black & Yellow   V1 Navy & White (brick drill tower)   V2 Urban Grey + Orange (container kill-house)   V3 Olive Tactical (steel scaffold)
// =============================================================================================
const SWAT = [
  { wall: "charcoal", trim: "yellow", van: "black", tower: "concrete", ground: "asphalt" },
  { wall: "blueDark", trim: "white", van: "#1d2c4f", tower: "brick", ground: "concrete2" },
  { wall: "#7d8790", trim: "orange", van: "#3a3f45", tower: "concreteDark", ground: "concrete2" },
  { wall: "oliveDrab", trim: "camoTan", van: "#3d4f2a", tower: "steelDark", ground: "path" },
];

function buildSwatHQ(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = SWAT[s];
  lot(c, p.ground);
  // main HQ block (front-left)
  const x0 = -hx + 2;
  const x1 = x0 + Math.min(18, hx);
  const z1 = hz - 6;
  const z0 = z1 - 12;
  const floors = lv5(lv, [1, 2, 2, 3, 3] as const);
  const top = 1 + floors * 4;
  v.box(x0, 1, z0, x1, top, z1, p.wall);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
  ribbonWindowsDark(c, x0, z0, x1, z1, top);
  v.box(x0, top - 1, z0, x1, top, z1, p.trim);
  flatRoof(c, x0, top, z0, x1, z1, "concreteDark", p.wall, true);
  // garage bays with roll-up doors on the front
  for (let k = 0; k < 2; k++) {
    const gx = x0 + 2 + k * 6;
    v.box(gx, 1, z1 - 1, gx + 5, 5, z1, "steelLight");
    for (let y = 1; y < 5; y++) v.box(gx, y, z1, gx + 5, y + 1, z1 + 1, y % 2 ? "steelLight" : "silver");
  }
  // SWAT sign
  v.box(x1 - 7, top - 3, z1, x1 - 1, top - 1, z1 + 1, "black");
  for (let x = x1 - 6; x < x1 - 2; x++) v.put(x, top - 2 - (x % 2 ? 0 : 1) * 0, z1 + 1, p.trim, 0.9);
  // armored vans out front
  const nVans = lv5(lv, [1, 2, 2, 3, 4] as const);
  for (let i = 0; i < nVans; i++) {
    const vx = x0 + 4 + i * 7;
    if (vx + 3 > hx - 2) break;
    armoredVan(c, vx, hz - 2, "x", p.van, p.trim);
  }
  // training tower with rappelling ropes + troopers
  const tx0 = x1 + 3;
  const tz0 = -hz + 2;
  const tw = 7;
  const th = lv5(lv, [12, 16, 20, 24, 28] as const);
  if (tx0 + tw <= hx - 1) {
    if (s === 3) {
      for (const [dx, dz] of [[0, 0], [tw - 1, 0], [0, tw - 1], [tw - 1, tw - 1]]) v.box(tx0 + dx, 1, tz0 + dz, tx0 + dx + 1, th, tz0 + dz + 1, "steelDark");
      for (let y = 4; y < th; y += 4) v.box(tx0, y, tz0, tx0 + tw, y + 1, tz0 + tw, "steelLight");
    } else {
      v.box(tx0, 1, tz0, tx0 + tw, th, tz0 + tw, p.tower);
      v.clear(tx0 + 1, 1, tz0 + 1, tx0 + tw - 1, th, tz0 + tw - 1);
      // window openings on every floor
      for (let y = 2; y < th - 1; y += 4) {
        v.box(tx0 + 2, y, tz0 + tw - 1, tx0 + 5, y + 2, tz0 + tw, null);
        v.box(tx0 + tw - 1, y, tz0 + 2, tx0 + tw, y + 2, tz0 + 5, null);
      }
      v.box(tx0, th, tz0, tx0 + tw, th + 1, tz0 + tw, "concreteDark");
    }
    // rappel ropes and troopers on the +x face
    for (const rz of [tz0 + 1, tz0 + 5]) {
      v.box(tx0 + tw, Math.floor(th * 0.3), rz, tx0 + tw + 1, th, rz + 1, "black");
      v.box(tx0 + tw - 1, th, rz, tx0 + tw + 1, th + 1, rz + 1, "steelDark");
      const ty = Math.floor(th * 0.3) + c.ri(1, Math.floor(th * 0.5));
      v.put(tx0 + tw + 1, ty, rz, "black");
      v.put(tx0 + tw + 1, ty + 1, rz, p.van === "black" ? "charcoal" : p.van);
      v.put(tx0 + tw + 1, ty + 2, rz, "black");
    }
    // trooper on the +z face mid climb
    v.box(tx0 + 3, 4, tz0 + tw, tx0 + 4, th, tz0 + tw + 1, "black");
    person(v, tx0 + 3, Math.floor(th / 2), tz0 + tw + 1, "black", "black", "black");
    c.blink(tx0 + 3, th + 1, tz0 + 3, "red");
  }
  // rappelling wall / climbing wall
  if (lv >= 2) {
    const wx = tx0 + tw + 3;
    if (wx + 2 <= hx - 1) {
      v.box(wx, 1, tz0, wx + 1, 10, tz0 + 8, s === 1 ? "brick" : "woodDark");
      for (let k = 0; k < 6; k++) v.put(wx + 1, 2 + k, tz0 + 1 + k, ["red", "yellow", "lime", "blue"][k % 4]);
      v.box(wx + 1, 4, tz0 + 6, wx + 2, 10, tz0 + 7, "black");
      v.put(wx + 1, 5, tz0 + 6, "black");
    }
  }
  // shooting range with targets (along the back)
  if (lv >= 3) {
    const rz0 = -hz + 2;
    const rx0 = x0;
    const rx1 = x1;
    if (z0 - rz0 >= 8) {
      v.box(rx0, 0, rz0, rx1, 1, rz0 + 7, "sandDark");
      v.box(rx0, 1, rz0, rx1, 6, rz0 + 1, "concreteDark");
      for (let x = rx0 + 2; x < rx1 - 1; x += 4) {
        v.box(x, 2, rz0 + 1, x + 2, 5, rz0 + 2, "white");
        v.put(x, 3, rz0 + 2, "red", 0.3);
        v.put(x, 4, rz0 + 2, "red", 0.3);
        guy(c, x, 1, rz0 + 6, "black", "black");
      }
      v.box(rx0, 1, rz0 + 7, rx1, 2, rz0 + 8, p.trim);
    }
  }
  // kill house (container maze)
  if (lv >= 4) {
    const kx = x1 + 2;
    const kz = hz - 14;
    if (kx + 13 <= hx - 1) {
      const cc = s === 2 ? ["orange", "#7d8790", "blue"] : [p.wall, "steelDark", p.trim];
      container(v, kx, 1, kz, "x", cc[0]);
      container(v, kx + 7, 1, kz, "x", cc[1]);
      container(v, kx, 1, kz + 4, "z", cc[2]);
      container(v, kx + 10, 1, kz + 4, "z", cc[0]);
    }
  }
  // helipad + tactical helicopter(s)
  if (lv >= 4) {
    const hpX = x1 + 9;
    const hpZ = Math.floor(-hz * 0.05) + 3;
    helipad(v, Math.min(hpX, hx - 7), 0, hpZ - 2, 5);
    helicopter(c, Math.min(hpX, hx - 7), 1, hpZ - 2, p.van === "black" ? "charcoal" : p.van, "z", 12);
  }
  if (lv >= 5) {
    helipad(v, 0, top + 1, Math.floor((z0 + z1) / 2), 4);
    helicopter(c, 0, top + 2, Math.floor((z0 + z1) / 2), p.van === "black" ? "charcoal" : p.van, "x", 0.001);
    v.box(x0 + 1, top + 1, z0 + 1, x0 + 2, top + 14, z0 + 2, "steelDark");
    c.blink(x0 + 1, top + 14, z0 + 1, "red");
  }
  for (let i = 0; i < 2 + lv; i++) guy(c, c.ri(-hx + 2, hx - 3), 1, c.ri(z1 + 1, hz - 4), "black", "black");
}

function ribbonWindowsDark(c: Ctx, x0: number, z0: number, x1: number, z1: number, top: number): void {
  const v = c.v;
  for (let y = 2; y < top - 1; y += 4) {
    v.box(x0 + 1, y + 1, z0, x1 - 1, y + 2, z0 + 1, "glassDark", 0.25);
    v.box(x0, y + 1, z0 + 1, x0 + 1, y + 2, z1 - 1, "glassDark", 0.25);
    v.box(x1 - 1, y + 1, z0 + 1, x1, y + 2, z1 - 1, "glassDark", 0.25);
    if (y > 4) v.box(x0 + 1, y + 1, z1 - 1, x1 - 1, y + 2, z1, "glassDark", 0.25);
  }
}

// =============================================================================================
// AIRFORCE BASE — runway across the front, hangars, control tower with beacon, rotating radar, parked jets
//  V0 Modern Grey (jets)   V1 Desert Tan (camo hangars)   V2 WWII Airfield (grass strip, quonsets, prop fighters)   V3 Stealth Black (bombers, cyan lights)
// =============================================================================================
const AIR = [
  { ground: "grass2", apron: "concrete", hangar: "steelLight", roof: "#8b97a3", plane: "#b9c3cc", tower: "white" },
  { ground: "sand", apron: "concrete2", hangar: "camoTan", roof: "sandDark", plane: "#c9b48a", tower: "camoTan" },
  { ground: "grass2", apron: "path", hangar: "oliveDrab", roof: "#4b5a2a", plane: "oliveDrab", tower: "woodLight" },
  { ground: "grass3", apron: "asphaltDark", hangar: "#2b2f34", roof: "#1f2226", plane: "#2f3338", tower: "#33373d" },
];

function buildAirforceBase(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = AIR[s];
  lot(c, p.ground);
  speckle(c, s === 1 ? "sandDark" : "grass3", 0.06);
  const lightCol = s === 3 ? "cyan" : "yellow";
  // runway across the front
  const rz1 = hz - 2;
  const rz0 = rz1 - (lv === 1 ? 7 : 10);
  const grass = s === 2 && lv <= 2;
  v.box(-hx + 1, 0, rz0, hx - 1, 1, rz1, grass ? "grass3" : "asphalt");
  if (!grass) {
    const mid = Math.floor((rz0 + rz1) / 2);
    for (let x = -hx + 6; x < hx - 6; x += 4) v.box(x, 0, mid, x + 2, 1, mid + 1, "white", s === 3 ? 0.3 : 0);
    for (const ex of [-hx + 2, hx - 4]) for (let z = rz0 + 1; z < rz1 - 1; z += 2) v.box(ex, 0, z, ex + 2, 1, z + 1, "white");
  }
  for (let x = -hx + 1; x < hx - 1; x += 6) {
    v.put(x, 1, rz0 - 1, lightCol, 0.9);
    v.put(x, 1, rz1, lightCol, 0.9);
  }
  c.blink(-hx + 1, 1, rz0, "red");
  c.blink(hx - 2, 1, rz1 - 1, "lime");
  // apron + taxiway
  const az1 = rz0 - 1;
  const az0 = az1 - (lv === 1 ? 6 : 12);
  v.box(-hx + 1, 0, az0, hx - 1, 1, az1, p.apron);
  // hangars at the back
  const nH = lv5(lv, [1, 1, 2, 3, 4] as const);
  const hw = lv5(lv, [10, 12, 14, 14, 16] as const);
  const hd = Math.min(az0 - (-hz + 2) - 1, lv5(lv, [8, 10, 12, 12, 14] as const));
  const hz0 = az0 - hd - 1;
  for (let i = 0; i < nH; i++) {
    const hx0 = -hx + 2 + i * (hw + 2);
    if (hx0 + hw > hx - 10) break;
    v.box(hx0, 1, hz0, hx0 + hw, 2, hz0 + hd, p.apron);
    barrelRoof(v, hx0, 1, hz0, hx0 + hw, hz0 + hd, "z", p.hangar, p.roof);
    // open door with a plane peeking out
    v.box(hx0 + 2, 1, hz0 + hd - 1, hx0 + hw - 2, Math.floor(hw * 0.35) + 1, hz0 + hd, null);
    v.box(hx0 + 2, 1, hz0 + hd - 2, hx0 + hw - 2, Math.floor(hw * 0.35), hz0 + hd - 1, "black");
    if (s === 1) for (let x = hx0; x < hx0 + hw; x += 3) v.put(x, Math.floor(hw * 0.35), hz0 + Math.floor(hd / 2), "oliveDrab");
    if (s === 3) v.box(hx0 + 2, Math.floor(hw * 0.35) + 1, hz0 + hd - 1, hx0 + hw - 2, Math.floor(hw * 0.35) + 2, hz0 + hd, "cyan", 1.2);
    const px = hx0 + Math.floor(hw / 2);
    if (s === 2) propPlane(v, px, 1, hz0 + hd + 2, "z", p.plane, "white");
    else jet(v, px, 1, hz0 + hd + 2, "z", p.plane, s === 3 ? "cyan" : "steelDark");
  }
  // control tower
  const tx = hx - 8;
  const tz = hz0 + 1;
  const th = lv5(lv, [7, 10, 13, 15, 18] as const);
  if (lv === 1) {
    // windsock + shack
    v.box(tx, 1, tz, tx + 5, 5, tz + 4, p.tower);
    v.box(tx, 3, tz + 3, tx + 5, 4, tz + 4, "glass", 0.4);
    v.box(tx - 1, 5, tz - 1, tx + 6, 6, tz + 5, p.roof);
    v.box(tx + 6, 1, tz + 6, tx + 7, 8, tz + 7, "steelDark");
    v.box(tx + 7, 7, tz + 6, tx + 10, 8, tz + 7, "orange");
    v.put(tx + 8, 7, tz + 6, "white");
  } else {
    v.box(tx, 1, tz, tx + 4, th, tz + 4, p.tower);
    v.box(tx - 1, th, tz - 1, tx + 5, th + 1, tz + 5, p.tower);
    v.box(tx - 1, th + 1, tz - 1, tx + 5, th + 4, tz + 5, s === 3 ? "cyan" : "glass", s === 3 ? 0.8 : 0.5);
    v.box(tx, th + 1, tz, tx + 4, th + 4, tz + 4, "glassDark", 0.3);
    v.box(tx - 2, th + 4, tz - 2, tx + 6, th + 5, tz + 6, s === 3 ? "#1f2226" : "concreteDark");
    v.box(tx + 1, th + 5, tz + 1, tx + 2, th + 9, tz + 2, "steelDark");
    v.put(tx + 1, th + 9, tz + 1, "red", 1.4);
    c.blink(tx + 1, th + 9, tz + 1, s === 3 ? "cyan" : "red");
    radar(c, tx + 3, th + 5, tz + 3, 4, "white", 2.2);
  }
  // big radar on a pylon
  if (lv >= 3) {
    const rx = hx - 4;
    const rz = -hz + 4;
    v.box(rx, 1, rz, rx + 2, 8, rz + 2, "steelDark");
    radarDish(c, rx, 8, rz, 3, s === 3 ? "#4a5057" : "white", 1.0);
  }
  // parked aircraft on the apron
  const nP = lv5(lv, [1, 2, 4, 6, 8] as const);
  let k = 0;
  for (let x = -hx + 6; x < hx - 6 && k < nP; x += 10) {
    const pz = az0 + Math.floor((az1 - az0) / 2);
    if (s === 2) propPlane(v, x, 1, pz, "z", p.plane, "white");
    else if (s === 3 && lv >= 4 && k % 2 === 0) stealthWing(v, x, 1, pz, "z", "#1f2226");
    else jet(v, x, 1, pz, "z", p.plane, s === 3 ? "cyan" : "steelDark");
    k++;
  }
  // a jet taking off on the runway
  if (lv >= 3) {
    if (s === 2) propPlane(v, -hx + 14, 3, Math.floor((rz0 + rz1) / 2), "x", p.plane, "white");
    else jet(v, -hx + 14, 3, Math.floor((rz0 + rz1) / 2), "x", p.plane, s === 3 ? "cyan" : "steelDark");
  }
  // fuel farm + helicopter (Lv4+)
  if (lv >= 4) {
    for (let i = 0; i < 3; i++) tank(v, -hx + 4 + i * 6, -hz + 4, 1, 4, 2.4, s === 3 ? "#33373d" : "white", "steelLight", s === 3 ? "cyan" : "red");
  }
  if (lv >= 5) {
    helipad(v, hx - 12, 0, az0 - 6, 4);
    helicopter(c, hx - 12, 1, az0 - 6, p.plane, "z", 12);
  }
  for (let i = 0; i < lv + 1; i++) guy(c, c.ri(-hx + 3, hx - 4), 1, c.ri(az0 + 1, az1 - 1), s === 3 ? "black" : "orange", "#3a4a5a");
}

// =============================================================================================
// NAVAL BASE (coast/water) — quay with HQ + piers into the harbour, docked grey warships, cranes, dry dock
//  V0 Modern Grey Fleet   V1 WWII Harbor (brick, dazzle ships, quonsets)   V2 Tropical White (white blocks, red roofs, palms)   V3 Nordic Fjord (red timber, rocks, snow)
// =============================================================================================
const NB = [
  { land: "concrete2", bld: "#c8ced4", roof: POLICE_BLUE, ship: "#8b97a3", deck: "#5d6670", sup: "#a7b1bb" },
  { land: "concrete2", bld: "brick", roof: "slate", ship: "#9aa6b0", deck: "woodLight", sup: "#b5bfc8" },
  { land: "limestone", bld: "white", roof: "terracotta", ship: "white", deck: "#6a737c", sup: "white" },
  { land: "granite", bld: "#b0352a", roof: "snow", ship: "#5f6b77", deck: "#454d55", sup: "#7f8b96" },
];

function warship(c: Ctx, cx: number, z0: number, z1: number, beam: number, s: number, kind: "patrol" | "frigate" | "destroyer"): void {
  const v = c.v;
  const p = NB[s];
  const dazzle = s === 1 ? (x: number, y: number, z: number): string | undefined => (y === 0 ? undefined : ["#2c3e5a", "white", "#6f8aa8", p.ship][Math.floor((z + y * 2 + (x > cx ? 3 : 0)) / 4) % 4]) : undefined;
  const o: HullOpts = { cx, z0, z1, beam, h: kind === "patrol" ? 3 : 4, col: p.ship, bottom: "redDark", deck: p.deck, bow: Math.round(beam * 1.5), rake: 0.7, paint: dazzle };
  const dy = hull(v, o);
  const hw = Math.floor(beam / 2);
  const mid = Math.floor((z0 + z1) / 2) - 1;
  if (kind === "patrol") {
    v.box(cx - 2, dy, mid - 2, cx + 2, dy + 3, mid + 2, p.sup);
    v.box(cx - 1, dy + 2, mid + 1, cx + 1, dy + 3, mid + 2, "glassDark", 0.3);
    mast(v, cx, dy + 3, mid, 3, "steelDark", 1);
    return;
  }
  v.box(cx - hw + 1, dy, mid - 4, cx + hw - 1, dy + 5, mid + 3, p.sup);
  v.box(cx - hw + 2, dy + 3, mid + 2, cx + hw - 2, dy + 4, mid + 3, "glassDark", 0.35);
  v.box(cx - 2, dy + 5, mid - 2, cx + 2, dy + 7, mid + 2, p.sup);
  mast(v, cx, dy + 7, mid, kind === "destroyer" ? 7 : 5, "steelDark", 2);
  radar(c, cx, dy + (kind === "destroyer" ? 14 : 12), mid, 4, "white", 1.6 + c.rand());
  turret(v, cx, dy, z1 - Math.round(beam * 1.6) - 2, 3, 1, 3, 1, "#6f7a85");
  if (kind === "destroyer") {
    turret(v, cx, dy, z0 + 4, 3, 1, 3, -1, "#6f7a85");
    funnel(c, cx, mid - 7, dy, 4, 1.3, p.sup, "black", "dark");
  }
}

function buildNavalBase(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const p = NB[s];
  const qd = lv5(lv, [10, 11, 12, 14, 16] as const);
  const qz = -hz + qd;
  quayFoundation(v, -hx, -hz, hx, qz);
  v.box(-hx, 0, -hz, hx, 3, qz, p.land);
  v.box(-hx, 2, qz - 1, hx, 3, qz, s === 0 ? "hazard" : "stone");
  if (s === 3) {
    for (let x = -hx; x < hx; x++) for (let z = -hz; z < qz - 1; z++) {
      if (c.rand() < 0.15) v.put(x, 2, z, "snow");
    }
  }
  // HQ building on the quay
  const hqW = lv5(lv, [8, 12, 14, 16, 20] as const);
  const hqx0 = -hx + 2;
  const hqz0 = -hz + 1;
  const hqz1 = qz - 3;
  const hqH = lv5(lv, [5, 8, 8, 12, 12] as const);
  v.box(hqx0, 3, hqz0, hqx0 + hqW, 3 + hqH, hqz1, p.bld);
  windows(c, hqx0, 3, hqz0, hqx0 + hqW, 3 + hqH, hqz1, { stepH: 3, stepV: 4, h: 2, emit: 0.45 });
  if (s === 1 && lv >= 3) {
    barrelRoof(v, hqx0, 3 + hqH, hqz0, hqx0 + hqW, hqz1, "x", "oliveDrab", "#4b5a2a");
  } else if (s === 2 || s === 3) {
    gable(v, hqx0 - 1, 3 + hqH, hqz0 - 1, hqx0 + hqW + 1, hqz1 + 1, "x", p.roof, s === 3 ? "white" : "white");
  } else {
    flatRoof(c, hqx0, 3 + hqH, hqz0, hqx0 + hqW, hqz1, "concreteDark", p.bld, true);
    v.box(hqx0, 3 + hqH - 1, hqz1 - 1, hqx0 + hqW, 3 + hqH, hqz1, p.roof);
  }
  flag(v, hqx0 + hqW + 1, 3, hqz1, 10 + lv, ["blue", "white", "blue"]);
  // piers into the harbour
  const nPiers = Math.max(1, Math.floor((hx * 2) / 16));
  const pitch = Math.floor((hx * 2) / nPiers);
  for (let i = 0; i < nPiers; i++) {
    const px = -hx + pitch * i + pitch - 4;
    pier(v, px, qz, px + 3, hz - 1, "concrete", "concreteDark", 5, 2);
    for (let z = qz + 2; z < hz - 1; z += 5) v.box(px - 1, 3, z, px, 4, z + 1, "steelDark");
    lamp(v, px + 1, 3, hz - 2, 4);
    // ship berthed alongside (west of the pier)
    const slotW = pitch - 6;
    const cx = px - Math.floor(slotW / 2) - 1;
    const len = hz - 2 - qz - 2;
    if (lv === 4 && i === 0 && nPiers > 1) {
      // dry dock with a hull on blocks
      v.box(px - slotW - 2, -4, qz, px - slotW, 3, hz - 1, "concrete");
      v.box(px - slotW, 0, qz, px, 1, hz - 2, "concreteDark");
      v.box(px - slotW - 2, -4, hz - 2, px, 3, hz - 1, "steelDark");
      const o: HullOpts = { cx, y0: 1, z0: qz + 2, z1: hz - 3, beam: Math.min(10, slotW - 2), h: 5, col: "#7d8995", bottom: "#a5402a", water: 2, deck: "#5d6670", bow: 9 };
      hull(v, o);
      c.smoke(cx, 6, qz + 8, "spark");
      continue;
    }
    const kind = lv <= 1 ? "patrol" : lv >= 4 && i % 2 === 1 ? "destroyer" : "frigate";
    const beam = kind === "patrol" ? 6 : Math.min(10, slotW - 1);
    const shipLen = kind === "patrol" ? Math.min(len, 16) : len;
    if (lv === 5 && i === nPiers - 1) {
      // a submarine at the last berth
      subHull(v, cx, qz + 3, qz + 3 + len, 3.5, "#2a2d33", "black", 0.2);
      v.box(cx - 1, 3, qz + len - 10, cx + 1, 8, qz + len - 6, "#2a2d33");
      continue;
    }
    warship(c, cx, qz + 2 + (len - shipLen), qz + 2 + len, beam, s, kind);
  }
  // quay cranes, warehouses & radar
  if (lv >= 3) crane(v, hx - 6, 3, qz - 5, 14 + lv * 2, 12, s === 2 ? "red" : "hazard", "z");
  if (lv >= 2) {
    const wx0 = hqx0 + hqW + 4;
    const wx1 = Math.min(hx - 9, wx0 + 14);
    if (wx1 - wx0 >= 8) {
      v.box(wx0, 3, hqz0, wx1, 9, hqz1, s === 3 ? "#b0352a" : s === 2 ? "white" : "#7d8b99");
      if (s === 1) barrelRoof(v, wx0, 9, hqz0, wx1, hqz1, "x", "oliveDrab", "#4b5a2a");
      else gable(v, wx0, 9, hqz0, wx1, hqz1, "x", s === 3 ? "snow" : s === 2 ? "terracotta" : "steelDark");
      v.box(wx0 + 2, 3, hqz1 - 1, wx0 + 7, 7, hqz1, "steelLight");
    }
  }
  if (lv >= 4) {
    const rx = hx - 3;
    const rz = -hz + 2;
    v.box(rx - 1, 3, rz, rx + 1, 14, rz + 2, "steelDark");
    radarDish(c, rx - 1, 14, rz, 3, "white", 1.1);
  }
  if (lv >= 5) {
    // harbour control tower with beacon
    const tx = hqx0 + 2;
    const tz = hqz0 + 1;
    v.box(tx, 3 + hqH, tz, tx + 4, 3 + hqH + 10, tz + 4, p.bld);
    v.box(tx - 1, 3 + hqH + 10, tz - 1, tx + 5, 3 + hqH + 13, tz + 5, "glass", 0.5);
    v.box(tx - 1, 3 + hqH + 13, tz - 1, tx + 5, 3 + hqH + 14, tz + 5, p.roof === "snow" ? "slate" : p.roof);
    c.blink(tx + 2, 3 + hqH + 15, tz + 2, "red");
  }
  if (s === 2) for (let i = 0; i < 3; i++) tree(v, -hx + 2 + i * 9 + hqW, 3, qz - 2, "palm", 1.1, i);
  if (s === 3) for (let i = 0; i < 3; i++) tree(v, hx - 3 - i * 5, 3, -hz + 2, "pine", 1, i);
  for (let i = 0; i < 2 + lv; i++) guy(c, c.ri(-hx + 2, hx - 3), 3, c.ri(hqz1 + 1, qz - 2), "white", "white");
}

// =============================================================================================
// SUBMARINE BASE (coast/water) — massive concrete sub pens with blast doors over the slips, subs in & out
//  V0 WWII U-Boat Bunker (grey concrete, ribbed roof)   V1 Cold-War Base (red-striped concrete, missile on transporter)
//  V2 Modern Steel Pens (navy steel halls, arched roofs)  V3 Mountain Lair (rock face with cave pens & glowing lights)
// =============================================================================================
function buildSubmarineBase(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const land = ["concrete2", "concrete2", "concrete2", "granite"][s];
  const qd = lv5(lv, [8, 10, 10, 12, 12] as const);
  const qz = -hz + qd;
  quayFoundation(v, -hx, -hz, hx, qz, s === 3 ? "granite" : "concreteDark");
  v.box(-hx, 0, -hz, hx, 3, qz, land);
  const subCol = s === 1 ? "#3a3f45" : "#2a2d33";
  const sub = (cx: number, z0: number, len: number, r: number): void => {
    const top = subHull(v, cx, z0, z0 + len, r, subCol, "black", 0.2);
    const sz = z0 + Math.floor(len * 0.62);
    v.box(cx - 1, top - 1, sz, cx + 1, top + 4, sz + 4, subCol);
    v.box(cx - 3, top + 2, sz + 1, cx + 3, top + 3, sz + 3, subCol);
    v.box(cx, top + 4, sz + 1, cx + 1, top + 6, sz + 2, "steelDark");
    v.box(cx, 1, z0 + 1, cx + 1, top + 2, z0 + 3, subCol);
  };
  if (lv === 1) {
    // floating pier + a surfaced sub + tender shed
    pier(v, -2, qz, 2, hz - 1, "concrete", "steelDark", 5);
    for (let z = qz + 2; z < hz - 1; z += 5) v.box(2, 2, z, 3, 3, z + 1, "steelDark");
    sub(-7, qz + 3, hz - qz - 5, 3);
    screwProp(c, -7, 1.5, qz + 2.5, 2, "brass", 6);
    v.box(-hx + 2, 3, -hz + 1, -hx + 12, 9, qz - 1, s === 3 ? "stone" : "concrete");
    barrelRoof(v, -hx + 2, 9, -hz + 1, -hx + 12, qz - 1, "x", s === 2 ? "blueDark" : "concreteDark");
    v.box(4, 3, -hz + 2, 6, 10, -hz + 4, "steelDark");
    c.blink(4, 10, -hz + 2, "red");
    guy(c, 0, 2, hz - 3, "#3a4a5a", "black");
    return;
  }
  // the pen bunker straddling quay & water
  const nPens = lv5(lv, [1, 2, 3, 3, 4] as const);
  const penW = Math.min(14, Math.floor((hx * 2 - 4) / nPens));
  const bx0 = -hx + 2;
  const bx1 = bx0 + penW * nPens;
  const bz0 = -hz + 2;
  const bz1 = Math.min(hz - 12, qz + lv5(lv, [16, 18, 20, 22, 24] as const));
  const bh = lv5(lv, [10, 12, 13, 14, 16] as const);
  const wallC = ["concrete", "concrete", "#2d3e5c", "stone"][s];
  if (s === 3) {
    // mountain mass with cave openings
    for (let x = bx0 - 1; x < Math.min(hx, bx1 + 6); x++) {
      for (let z = -hz; z < bz1; z++) {
        const d = Math.min(x - bx0 + 1, Math.min(hx, bx1 + 6) - x, z + hz, bz1 - z);
        const hgt = Math.min(bh + 10, 4 + d * 2 + Math.floor(Math.sin(x * 0.7 + z * 0.4) * 2));
        const ht = Math.max(3, hgt);
        const edge = x === bx0 - 1 || z === -hz || z === bz1 - 1 || x === Math.min(hx, bx1 + 6) - 1;
        v.box(x, edge ? -4 : Math.max(0, ht - 3), z, x + 1, ht, z + 1, hgt > bh + 6 ? "snow" : (x + z) % 5 === 0 ? "basalt" : "stone");
      }
    }
  } else {
    quayFoundation(v, bx0, bz0, bx1, bz1);
    v.box(bx0, 0, bz0, bx1, bh, bz1, wallC);
    v.clear(bx0 + 1, 3, bz0 + 1, bx1 - 1, bh - 1, bz1 - 1);
    for (let k = 1; k < nPens; k++) v.box(bx0 + k * penW - 1, -4, bz0, bx0 + k * penW + 2, bh, bz1, wallC);
    v.box(bx0 - 1, bh, bz0 - 1, bx1 + 1, bh + 3, bz1 + 1, s === 2 ? "#3d5a85" : "concreteDark");
    if (s === 0) for (let x = bx0; x < bx1; x += 3) v.box(x, bh + 3, bz0, x + 1, bh + 5, bz1, "concrete");
    if (s === 1) v.box(bx0, bh - 2, bz1 - 1, bx1, bh - 1, bz1, "red");
    if (s === 2) for (let k = 0; k < nPens; k++) barrelRoof(v, bx0 + k * penW, bh + 3, bz0, bx0 + (k + 1) * penW, bz1, "z", "#3d5a85", "steelLight");
  }
  // Open the slips to the same water surface as the rest of the harbor.
  for (let k = 0; k < nPens; k++) {
    const px0 = bx0 + k * penW + 2;
    const px1 = bx0 + (k + 1) * penW - 1;
    const cx = Math.floor((px0 + px1) / 2);
    v.clear(px0, -4, qz, px1, bh - 2, bz1 + 1);
    v.clear(px0, -4, -hz + 3, px1, 3, qz);
    // blast doors (partly raised, striped)
    const doorY = bh - 2 - (k % 2 === 0 ? 4 : 2);
    for (let y = doorY; y < bh - 2; y++) v.box(px0, y, bz1 - 1, px1, y + 1, bz1, y % 2 ? "hazard" : "black");
    if (s !== 3) for (let x = px0; x < px1; x += 3) v.put(x, bh - 1, bz1, "warmGlow", 1.1);
    if (s === 3) {
      v.box(px0 - 1, bh - 2, bz1 - 1, px1 + 1, bh - 1, bz1, "warmGlow", 0.9);
      for (let z = qz; z < bz1; z += 4) v.put(px0, bh - 3, z, "warmGlow", 1);
    }
    // sub inside (nose poking out on alternating pens)
    const len = Math.min(bz1 - qz + 6, lv5(lv, [20, 24, 28, 32, 34] as const));
    const z0 = k % 2 === 0 ? bz1 - len + 10 : qz;
    if (cx - 3 >= px0 - 1) sub(cx, z0, Math.min(len, hz - 2 - z0), Math.min(3.5, (px1 - px0) / 2 - 0.5));
  }
  // outer pier with a sub moored outside
  if (bx1 + 10 <= hx - 1) {
    const ox = bx1 + 4;
    pier(v, ox, qz, ox + 3, hz - 1, "concrete", "concreteDark", 5, 2);
    for (let z = qz + 2; z < hz - 1; z += 5) v.box(ox + 3, 3, z, ox + 4, 4, z + 1, "steelDark");
    sub(ox + 8, qz + 2, hz - qz - 4, 3.5);
    screwProp(c, ox + 8, 1.5, qz + 1.5, 2, "brass", 6);
  }
  // cranes, radar, sonar dome, missile transporter
  if (lv >= 3) {
    if (s !== 3) crane(v, bx0 + 3, bh + 3, bz0 + 3, 8, 10, "hazard", "z");
    else crane(v, hx - 6, 3, -hz + 2, 14, 10, "hazard", "z");
  }
  if (lv >= 4) {
    const rx = hx - 4;
    const rz = -hz + 3;
    v.box(rx - 1, 3, rz, rx + 1, 12, rz + 2, "steelDark");
    radarDish(c, rx - 1, 12, rz, 3, "white", 1.0);
    v.dome(hx - 10, 3, -hz + 4, 3, "white");
  }
  if (lv >= 5) {
    // missile on a transporter-erector on the quay
    const mx = hx - 14;
    const mz = qz - 4;
    if (mx > bx1 - 2 || s === 3) {
      v.box(mx - 6, 3, mz - 1, mx + 6, 5, mz + 2, s === 1 ? "#55652f" : "steelDark");
      v.box(mx - 6, 5, mz, mx + 5, 7, mz + 1, "white");
      v.box(mx + 5, 5, mz, mx + 7, 6, mz + 1, "red");
    }
    c.blink(bx0, bh + 3, bz1, "red");
    c.blink(bx1 - 1, bh + 3, bz1, "red");
  }
  for (let i = 0; i < 1 + lv; i++) guy(c, c.ri(-hx + 2, hx - 3), 3, c.ri(-hz + 1, qz - 2), "#3a4a5a", "black");
  void deckhouse;
  void cyl;
}

defineDesigns({
  police_precinct: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Beat Cop Booth", "Corner Police Station", "Neighborhood Precinct", "Precinct House & Motor Pool", "Blue-Lantern Grand Precinct"],
    growth: "A tiny booth becomes a two-lamp corner station, then a precinct with a cruiser lot, a fleet & K9 unit, and a lantern clock tower.",
    build: buildPolicePrecinct,
  },
  jails: {
    footprints: [[1, 1], [1, 1], [1, 2], [2, 2], [2, 2]],
    levels: ["Drunk Tank", "Town Lockup", "County Jail", "Detention Center", "Lockdown Max Block"],
    growth: "A one-cell lockup grows an exercise pen, a fenced yard, an L-shaped detention block with guard tower, then a razor-wire perimeter.",
    build: buildJails,
  },
  police_departments: {
    footprints: [[2, 2], [2, 2], [2, 3], [3, 3], [3, 3]],
    levels: ["City Police HQ", "Metro Police Department", "Police Plaza", "Central Command Tower", "Air-Unit Police Headquarters"],
    growth: "The badge-fronted HQ tower climbs floor by floor, adding a parking garage, rooftop helipad, radio mast and finally a patrol helicopter.",
    build: buildPoliceDepartment,
  },
  prisons: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Prison Work Camp", "State Penitentiary", "Walled Correctional Facility", "Maximum-Security Prison", "Legendary Fortress Prison"],
    growth: "Sprawls: more cell blocks, more searchlight towers, a bigger yard and track, a workshop, then a legendary centerpiece.",
    build: buildPrison,
  },
  military_base: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Outpost Camp", "Fire Base", "Army Garrison", "Fort with Training Grounds", "Command Fortress"],
    growth: "Tents and sandbags sprawl into barracks rows, a tank motor pool, radar dish, obstacle course and a helipad command bunker.",
    build: buildMilitaryBase,
  },
  naval_base: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Coastal Patrol Station", "Naval Pier", "Naval Station", "Fleet Harbor & Dry Dock", "Grand Fleet Naval Base"],
    growth: "Piers multiply along the quay with ever-bigger docked warships, cranes, warehouses, a dry dock, radar and a harbour control tower.",
    build: buildNavalBase,
  },
  swat_team_hq: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [3, 3]],
    levels: ["Tactical Unit Garage", "SWAT Station", "SWAT Training Center", "Tactical Ops Compound", "Elite Counter-Terror HQ"],
    growth: "Armored vans and a rappelling tower grow into a compound with climbing wall, shooting range, kill-house and helicopters.",
    build: buildSwatHQ,
  },
  airforce_base: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Airstrip", "Air Station", "Air Base", "Strategic Air Base", "Stealth Wing Command"],
    growth: "A strip with a windsock sprawls into hangar rows, a beacon control tower, rotating radar, fuel farm and squadrons of jets.",
    build: buildAirforceBase,
  },
  submarine_base: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Sub Tender Pier", "Submarine Pens", "Fortified Sub Base", "Nuclear Sub Base", "Deep-Strike Sub Fortress"],
    growth: "A floating pier becomes a blast-door bunker with more and longer pens, cranes, radar, sonar dome and a missile transporter.",
    build: buildSubmarineBase,
  },
});
