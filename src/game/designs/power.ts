/**
 * POWER & WASTE — energy plants, wind, solar, waste handling and industry.
 *
 * Shared conventions in this file:
 *  - +z is the front (gates, signs, driveways). Water for hydro sits at the back (-z, upstream).
 *  - Rotors (sails / blades / fans / seagulls / water wheels) are built in their own PixelVox around the
 *    pivot. Even-width hubs (2×2) keep the spin centred on the pivot corner.
 */
import { PixelVox } from "../voxelCore";
import {
  type Ctx,
  acUnit,
  bush,
  car,
  chimney,
  clamp,
  container,
  crane,
  cyl,
  door,
  fence,
  flag,
  flatRoof,
  gable,
  hip,
  lamp,
  lot,
  person,
  ring,
  rocks,
  sawtooth,
  securityFence,
  sign,
  smokestack,
  speckle,
  tank,
  tree,
  truck,
  waterPlane,
  windows,
  ribbonWindows,
  curtainWall,
  barrelRoof,
  helipad,
  flowerBed,
} from "./kit";
import { defineDesigns } from "./registry";

const F = Math.floor;
const TAU = Math.PI * 2;

// =============================================================================================
// Shared helpers
// =============================================================================================

/** Propeller-style blades in the xy plane (spin about z). Pivot = hub centre. */
function bladeRotor(
  n: number,
  R: number,
  col: string,
  tip: string,
  o: { hub?: string; phase?: number; root?: number; nose?: string; tipLen?: number } = {},
): PixelVox {
  const r = new PixelVox(11);
  const hub = o.hub ?? col;
  r.box(-1, -1, -1, 1, 1, 2, hub);
  r.box(-1, -1, 2, 1, 1, 3, o.nose ?? hub);
  const root = o.root ?? 1;
  const tipLen = o.tipLen ?? 2;
  for (let b = 0; b < n; b++) {
    const a = (o.phase ?? Math.PI / 2) + (b * TAU) / n;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let t = 1; t <= R; t += 0.4) {
      const w = t < R * 0.4 ? root : t < R * 0.75 ? root * 0.5 : 0;
      for (let s = 0; s <= w; s += 0.5) {
        const px = ca * t - sa * s;
        const py = sa * t + ca * s;
        r.put(F(px), F(py), 0, t > R - tipLen ? tip : col);
      }
    }
  }
  return r;
}

/** Classic lattice windmill sails (4 arms). style: lattice (frame+cloth), cloth (triangular jib sails, 8 arms). */
function sailRotor(R: number, frame: string, cloth: string | null, kind: "lattice" | "jib" = "lattice"): PixelVox {
  const r = new PixelVox(12);
  r.box(-1, -1, -1, 1, 1, 2, "woodDark");
  if (kind === "lattice") {
    for (let b = 0; b < 4; b++) {
      const a = (b * TAU) / 4;
      const ca = Math.round(Math.cos(a));
      const sa = Math.round(Math.sin(a));
      for (let t = 0; t <= R; t++) {
        // stock
        r.put(F(ca * t + (ca === 0 ? -0.5 : 0) + 0.0), F(sa * t + (sa === 0 ? -0.5 : 0)), 0, frame);
        if (t < 3) continue;
        for (let s = 1; s <= 3; s++) {
          const px = ca * t - sa * s;
          const py = sa * t + ca * s;
          const edge = s === 3 || t === 3 || t === R || t % 3 === 0;
          const c = edge ? frame : cloth;
          if (c) r.put(F(px + (ca === 0 ? -0.5 : 0)), F(py + (sa === 0 ? -0.5 : 0)), 0, c);
        }
      }
    }
  } else {
    // Greek jib sails: 8 spokes with triangular cloth
    for (let b = 0; b < 8; b++) {
      const a = (b * TAU) / 8;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let t = 1; t <= R; t += 0.5) {
        r.put(F(ca * t), F(sa * t), 0, frame);
        const w = t > 2 ? (t - 2) * 0.45 : 0;
        for (let s = 0.5; s <= w; s += 0.5) {
          r.put(F(ca * t - sa * s), F(sa * t + ca * s), 0, cloth ?? "white");
        }
      }
    }
  }
  return r;
}

/** Horizontal fan (spins about y). */
function fanRotor(R: number, col: string, n = 5): PixelVox {
  const r = new PixelVox(13);
  r.box(-1, 0, -1, 1, 1, 1, "steelDark");
  for (let b = 0; b < n; b++) {
    const a = (b * TAU) / n;
    for (let t = 1; t <= R; t += 0.5) r.put(F(Math.cos(a) * t), 0, F(Math.sin(a) * t), col);
  }
  return r;
}

/** Fill a heightfield over a rectangle; columns filled from the lowest neighbour (no solid core). */
function heightfield(
  v: PixelVox,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: (x: number, z: number) => number,
  col: (x: number, y: number, z: number, top: boolean) => string | null,
  y0 = 1,
): void {
  const H = (x: number, z: number) => Math.max(0, Math.round(h(x, z)));
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const hh = H(x, z);
      if (hh <= 0) continue;
      const lo = Math.min(H(x - 1, z), H(x + 1, z), H(x, z - 1), H(x, z + 1), hh - 1);
      for (let y = Math.max(0, lo - 1); y < hh; y++) {
        const cc = col(x, y0 + y, z, y === hh - 1);
        if (cc) v.put(x, y0 + y, z, cc);
      }
    }
  }
}

/** Lattice transmission pylon centred on (x,z). Returns top y. */
function pylon(v: PixelVox, x: number, z: number, h: number, col = "steelLight", arms = 4): number {
  for (let y = 1; y < h; y++) {
    const o = y < h * 0.45 ? 2 : 1;
    for (const [dx, dz] of [[-o, -o], [o - 1, -o], [-o, o - 1], [o - 1, o - 1]]) v.put(x + dx, y, z + dz, col);
    if (y % 3 === 0) {
      v.box(x - o, y, z - o, x + o, y + 1, z - o + 1, col);
      v.box(x - o, y, z + o - 1, x + o, y + 1, z + o, col);
    }
  }
  for (const ay of [h - 5, h - 1]) {
    v.box(x - arms, ay, z, x + arms, ay + 1, z + 1, col);
    v.put(x - arms, ay - 1, z, "white");
    v.put(x + arms - 1, ay - 1, z, "white");
  }
  v.box(x - 1, h, z - 1, x + 1, h + 1, z + 1, col);
  return h + 1;
}

/** Transformer / switchyard patch */
function substation(c: Ctx, x0: number, z0: number, x1: number, z1: number, gantry = 7): void {
  const v = c.v;
  v.box(x0, 0, z0, x1, 1, z1, "path2");
  speckle(c, "stone", 0, 0);
  for (let x = x0 + 1; x < x1 - 2; x += 4) {
    for (let z = z0 + 2; z < z1 - 2; z += 5) {
      v.box(x, 1, z, x + 2, 4, z + 3, "steelDark");
      v.box(x, 4, z, x + 2, 5, z + 3, "steel");
      v.put(x, 5, z, "white");
      v.put(x + 1, 5, z + 2, "white");
      for (let k = 0; k < 3; k += 2) v.put(x - 1 + (k ? 3 : 0), 2, z + 1, "steel");
    }
  }
  for (const gx of [x0, x1 - 1]) {
    v.box(gx, 1, z0, gx + 1, gantry, z0 + 1, "steelLight");
    v.box(gx, 1, z1 - 1, gx + 1, gantry, z1, "steelLight");
    v.box(gx, gantry, z0, gx + 1, gantry + 1, z1, "steelLight");
  }
  securityFence(v, x0, z0, x1, z1, 1, 3);
}

/** Inclined conveyor belt (straight line between two points, 2 wide along the other axis). */
function conveyor(v: PixelVox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col = "steelDark", belt = "charcoal", alongX = true): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const z = Math.round(z0 + (z1 - z0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    if (alongX) {
      v.box(x, y, z, x + 1, y + 1, z + 2, col);
      v.box(x, y + 1, z, x + 1, y + 2, z + 2, belt);
      if (i % 5 === 0 && y > 1) v.box(x, 1, z, x + 1, y, z + 1, "steelDark");
    } else {
      v.box(x, y, z, x + 2, y + 1, z + 1, col);
      v.box(x, y + 1, z, x + 2, y + 2, z + 1, belt);
      if (i % 5 === 0 && y > 1) v.box(x, 1, z, x + 1, y, z + 1, "steelDark");
    }
  }
}

/** Pipe run along an axis at height y. */
function pipe(v: PixelVox, x0: number, y: number, z0: number, x1: number, z1: number, col = "silver", supports = true, w = 1): void {
  v.box(x0, y, z0, x1, y + w, z1, col);
  if (supports && y > 1) {
    if (x1 - x0 > z1 - z0) for (let x = x0; x < x1; x += 4) v.box(x, 1, z0, x + 1, y, z0 + 1, "steelDark");
    else for (let z = z0; z < z1; z += 4) v.box(x0, 1, z, x0 + 1, y, z + 1, "steelDark");
  }
}

/** Bulldozer facing +x */
function dozer(v: PixelVox, x: number, y: number, z: number, col = "hazard"): void {
  v.box(x - 2, y, z - 1, x + 2, y + 1, z + 2, "charcoal");
  v.box(x - 2, y + 1, z - 1, x + 1, y + 2, z + 2, col);
  v.box(x - 1, y + 2, z, x + 1, y + 4, z + 2, col);
  v.put(x, y + 3, z, "glassDark");
  v.box(x + 2, y, z - 2, x + 3, y + 2, z + 3, "steelDark");
}

/** Dump/garbage truck facing +x */
function garbageTruck(v: PixelVox, x: number, y: number, z: number, body = "leaf", cab = "white"): void {
  v.box(x - 4, y, z - 1, x + 1, y + 3, z + 1, body);
  v.box(x - 4, y + 3, z - 1, x, y + 4, z + 1, body);
  v.box(x + 1, y, z - 1, x + 3, y + 2, z + 1, cab);
  v.put(x + 2, y + 1, z - 1, "glassDark");
  v.put(x + 2, y + 1, z, "glassDark");
  v.put(x - 4, y + 1, z - 1, "hazard");
}

/** Railway track along x with hopper cars */
function railSpur(v: PixelVox, x0: number, x1: number, z: number, cars: number, carCol = "steelDark", load = "charcoal"): void {
  v.box(x0, 0, z - 1, x1, 1, z + 3, "path2");
  for (let x = x0; x < x1; x += 2) v.box(x, 1, z - 1, x + 1, 1, z + 3, "woodDark");
  v.box(x0, 1, z, x1, 1, z + 1, "steel");
  v.box(x0, 1, z + 1, x1, 1, z + 2, "steel");
  for (let x = x0; x < x1; x += 2) v.put(x, 0, z - 1, "woodDark");
  for (let i = 0; i < cars; i++) {
    const cx = x0 + 2 + i * 8;
    if (cx + 7 > x1) break;
    v.box(cx, 1, z - 1, cx + 7, 2, z + 3, "iron");
    v.box(cx, 2, z - 1, cx + 7, 5, z + 3, carCol);
    v.box(cx + 1, 5, z, cx + 6, 6, z + 2, load);
    v.box(cx + 1, 3, z - 1, cx + 6, 4, z - 1 + 1, i % 2 ? "rubber" : carCol);
  }
}

/** Tilted PV panel strip (rises toward the back). Returns nothing. */
function pvPanel(v: PixelVox, x0: number, x1: number, zFront: number, y: number, depth: number, rise: number, cell = "solarBlue", cell2 = "#2a4ba3"): void {
  for (let d = 0; d < depth; d++) {
    const z = zFront - d;
    const yy = y + F((d * rise) / Math.max(1, depth));
    for (let x = x0; x < x1; x++) {
      const isFrame = x === x0 || x === x1 - 1 || d === 0 || d === depth - 1;
      v.put(x, yy, z, isFrame ? "steelLight" : (x + d) % 2 ? cell : cell2, isFrame ? 0 : 0.12);
    }
  }
}

/** Smoke stack with smoke + beacon. Returns top. */
function stack(c: Ctx, x: number, z: number, y: number, h: number, r: number, col: string, stripe: string, kind: "smoke" | "dark" | "steam" = "smoke", beacon = true): number {
  const top = smokestack(c.v, x, z, y, h, r, col, stripe);
  c.smoke(x, top + 1, z, kind);
  if (beacon && h > 18) c.blink(F(x), top, F(z), "red");
  return top;
}

/** Simple industrial shed with ridge roof and windows */
function shed(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, wall: string, roof: string, trim = "white"): number {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, 1 + h, z1, wall, trim);
  windows(c, x0, 1, z0, x1, 1 + h, z1, { stepH: 3, h: 1, startY: h - 2, emit: 0.4 });
  return gable(v, x0 - 1, 1 + h, z0 - 1, x1 + 1, z1 + 1, x1 - x0 >= z1 - z0 ? "x" : "z", roof, trim);
}

/** Visitor / control building with flat roof and big glass front */
function officeBox(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, wall: string, glass = "glass"): number {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, 1 + h, z1, wall);
  ribbonWindows(c, x0, 1, z0, x1, 1 + h, z1, 2, glass, 0.45, "se");
  flatRoof(c, x0, 1 + h, z0, x1, z1, "concreteDark", wall, false);
  door(v, F((x0 + x1) / 2) - 1, 1, z1 - 1, "glassDark");
  return 2 + h;
}

/** Smooth hyperboloid cooling tower (thicker shell than the kit version so no see-through gaps). */
function cTower(v: PixelVox, cx: number, cz: number, y0: number, h: number, rBase: number, col = "concrete", band2 = "red"): void {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = rBase * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.7) / 0.7, 1.7));
    const isBand = band2 && (y >= h - 3 || (y >= h - 7 && y < h - 6));
    ring(v, cx, cz, y0 + y, y0 + y + 1, r, Math.max(0, r - 2.4), isBand ? band2 : y < 2 ? "concreteDark" : col);
  }
  ring(v, cx, cz, y0 + h - 1, y0 + h, rBase * 0.7, rBase * 0.7 - 2.4, "#e9edf1");
}

/** Sheep blob */
function sheep(v: PixelVox, x: number, z: number): void {
  v.box(x, 1, z, x + 2, 3, z + 1, "white");
  v.put(x + 2, 2, z, "charcoal");
}

/** Hazard/warning trefoil-ish sign on a pole facing +z */
function hazardSign(v: PixelVox, x: number, z: number, h = 3, col = "hazard"): void {
  v.box(x, 1, z, x + 1, 1 + h, z + 1, "steelDark");
  v.box(x - 1, 1 + h, z, x + 2, 3 + h, z + 1, col, 0.3);
  v.put(x, 2 + h, z, "charcoal");
}

// =============================================================================================
// SOLAR PANELS — small-scale PV that sprawls from a backyard kit into a solar park.
//  V0 Fixed-tilt ground rows on lawn       V1 Solar carport canopies over parking & EV chargers
//  V2 "Sunflower" pole trackers on gravel  V3 Agrivoltaic stilts over crops & sheep
// =============================================================================================
function pvUnit(c: Ctx, x0: number, x1: number, zFront: number, kind: number): void {
  const v = c.v;
  if (kind === 0) {
    for (let x = x0; x < x1; x += 4) {
      v.box(x, 1, zFront, x + 1, 2, zFront + 1, "steelDark");
      v.box(x, 1, zFront - 3, x + 1, 4, zFront - 2, "steelDark");
    }
    pvPanel(v, x0, x1, zFront, 2, 4, 3);
  } else if (kind === 1) {
    for (let x = x0 + 1; x < x1; x += 6) {
      v.box(x, 1, zFront - 3, x + 1, 7, zFront - 2, "steelLight");
    }
    pvPanel(v, x0, x1, zFront + 1, 6, 6, 2);
    // parked cars & chargers below
    for (let x = x0 + 3; x + 3 <= x1; x += 6) {
      car(v, x, 1, zFront - 1, "z", c.pick(["red", "white", "sky", "teal", "charcoal"]));
      v.box(x + 2, 1, zFront - 4, x + 3, 3, zFront - 3, "white");
      v.put(x + 2, 3, zFront - 4, "screenGreen", 0.9);
    }
    for (let x = x0; x < x1; x += 2) v.put(x, 0, zFront + 1, "white");
  } else if (kind === 2) {
    for (let x = x0 + 2; x + 2 <= x1; x += 6) {
      v.box(x, 1, zFront - 2, x + 1, 5, zFront - 1, "steel");
      v.box(x - 1, 1, zFront - 3, x + 2, 2, zFront, "concrete");
      pvPanel(v, x - 2, x + 3, zFront, 5, 5, 3);
    }
  } else {
    for (let x = x0; x < x1; x += 5) v.box(x, 1, zFront - 1, x + 1, 8, zFront, "woodDark");
    pvPanel(v, x0, x1, zFront, 8, 3, 1);
    // crop row underneath
    for (let x = x0; x < x1; x++) {
      v.put(x, 1, zFront - 3, (x % 3 ? "lime" : "leaf"));
      v.put(x, 1, zFront + 1, (x % 2 ? "leafLight" : "leaf"));
    }
  }
}

function buildSolarPanels(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  const ground = ["grass2", "asphalt", "path2", "soil"][k];
  lot(c, ground);
  if (k === 0) speckle(c, "grass3", 0.1);
  if (k === 2) speckle(c, "stone", 0.12);
  if (k === 3) {
    speckle(c, "grass2", 0.25);
  }

  // Lv2+: a little shed whose roof is covered in panels
  let rowX0 = -hx + 1;
  if (lv >= 2) {
    const sx0 = -hx + 1;
    const sx1 = sx0 + (lv >= 4 ? 9 : 7);
    const sz0 = -hz + 1;
    const sz1 = sz0 + 6;
    const wall = ["cream", "white", "woodLight", "wood"][k];
    v.hollowBox(sx0, 1, sz0, sx1, 6, sz1, wall);
    door(v, sx0 + 2, 1, sz1 - 1, "woodDark");
    v.put(sx0 + 5, 3, sz1 - 1, "glass", 0.4);
    // mono-pitch roof full of panels
    for (let d = 0; d < sz1 - sz0 + 2; d++) {
      const z = sz1 - d;
      const yy = 6 + F(d / 2);
      for (let x = sx0 - 1; x < sx1 + 1; x++) {
        const edge = x === sx0 - 1 || x === sx1;
        v.put(x, yy, z, edge ? "steelLight" : (x + d) % 2 ? "solarBlue" : "#2a4ba3", edge ? 0 : 0.12);
      }
      v.box(sx0, 6, z, sx0 + 1, yy, z + 1, wall);
      v.box(sx1 - 1, 6, z, sx1, yy, z + 1, wall);
    }
    // inverter + battery on the side
    v.box(sx1, 1, sz1 - 2, sx1 + 2, 4, sz1, "silver");
    v.put(sx1 + 1, 3, sz1 - 1, "screenGreen", 1);
    v.put(sx1 + 1, 2, sz1 - 1, "hazard");
    if (hz <= 8) rowX0 = sx1 + 3;
  }

  // Panel rows fill the rest (front part)
  const startZ = lv >= 2 && hz > 8 ? -hz + 9 : -hz + 2;
  const rowStep = k === 1 ? 9 : k === 3 ? 7 : 7;
  let rows = 0;
  for (let zf = startZ + (k === 1 ? 5 : 4); zf < hz - 1; zf += rowStep) {
    const xa = zf - 4 < -hz + 8 && lv >= 2 ? rowX0 : -hx + 1;
    if (hx - 1 - xa >= 5) pvUnit(c, xa, hx - 1, zf, k);
    rows++;
  }
  if (lv === 1) {
    // backyard kit: battery wall box, a garden gnome-ish person, little flowers
    v.box(-hx + 1, 1, hz - 3, -hx + 3, 4, hz - 1, "white");
    v.put(-hx + 2, 3, hz - 1, "screenGreen", 1);
    person(v, hx - 3, 1, hz - 2, "orange");
    bush(v, hx - 2, 1, -hz + 1, 1, "leaf", "yellow");
  }

  // Lv3+: perimeter fence + tech + signage
  if (lv >= 3) {
    if (k !== 1) fence(v, -hx, -hz, hx, hz, 1, 2, k === 3 ? "woodDark" : "steelLight", [-2, 2]);
    person(v, 0, 1, hz - 2, "hazard", "blueDark");
    v.put(0, 4, hz - 2, "white");
  }
  if (lv >= 3 && k === 3) {
    sheep(v, -hx + 4, hz - 4);
    sheep(v, hx - 6, 0);
  }
  if (lv >= 4) {
    // inverter skid with glowing status
    const ix = hx - 6;
    const iz = -hz + 2;
    v.box(ix, 1, iz, ix + 4, 4, iz + 3, "white");
    v.box(ix, 4, iz, ix + 4, 5, iz + 3, "steelDark");
    v.put(ix + 1, 3, iz + 2, "screenGreen", 1);
    v.put(ix + 2, 3, iz + 2, "screenGreen", 1);
    acUnit(v, ix + 1, 5, iz);
  }
  if (lv >= 5) {
    // Megabattery: row of white containers with green LED stripes + logo sign
    const bx0 = -hx + 12;
    const bz = -hz + 1;
    for (let i = 0; i < 3; i++) {
      const x = bx0 + i * 7;
      if (x + 6 > hx - 7) break;
      v.box(x, 1, bz, x + 6, 5, bz + 4, "white");
      v.box(x, 3, bz + 4, x + 6, 4, bz + 4 + 0, "white");
      for (let xx = x + 1; xx < x + 5; xx += 2) v.put(xx, 3, bz + 3, "screenGreen", 1.1);
      acUnit(v, x + 2, 5, bz + 1);
    }
    // sun logo totem at the gate
    v.box(hx - 4, 1, hz - 2, hx - 3, 7, hz - 1, "steelDark");
    v.cylinderY(hx - 3.5, hz - 1.5, 7, 8, 2, "amber", 0.8);
    v.put(hx - 4, 9, hz - 2, "yellow", 1);
    c.blink(hx - 4, 9, hz - 2, "amber");
  }
  void rows;
}

// =============================================================================================
// SOLAR FARMS — utility-scale fields that sprawl; Lv5 adds a concentrated-solar power tower.
//  V0 Green-meadow PV with grazing sheep  V1 Desert PV on sand with cleaning robots
//  V2 Floating PV rafts on a reservoir    V3 Parabolic-trough solar-thermal (silver mirrors)
// =============================================================================================
function buildSolarFarms(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  const ground = ["grass", "sand", "grass2", "sandDark"][k];
  lot(c, ground);
  speckle(c, ["grass3", "sandDark", "grass3", "sand"][k], 0.12);

  // reservation for the tower field at Lv5 (back-left quadrant)
  const towerR = lv >= 5 ? Math.min(hx, hz) - 2 : 0;
  const tcx = lv >= 5 ? -hx + towerR + 1 : 0;
  const tcz = lv >= 5 ? -hz + towerR + 1 : 0;

  // service road along the front
  v.box(-hx, 0, hz - 4, hx, 1, hz - 1, k === 1 || k === 3 ? "path2" : "path");

  if (k === 2) {
    // reservoir
    const wx0 = -hx + 2;
    const wz0 = -hz + 2;
    const wx1 = hx - 2;
    const wz1 = hz - 6;
    v.box(wx0 - 1, 0, wz0 - 1, wx1 + 1, 1, wz1 + 1, "sand");
    waterPlane(v, wx0, wz0, wx1, wz1, 0, "water");
  }

  const inField = (x: number, z: number) =>
    lv >= 5 && (x - tcx) ** 2 + (z - tcz) ** 2 < (towerR + 2) ** 2;

  // rows
  const step = k === 3 ? 8 : 7;
  let rowN = 0;
  for (let zf = -hz + 6; zf < hz - 6; zf += step) {
    if (lv === 1 && rowN++ >= 2) break;
    // split each row into segments of 12 skipping the tower field
    for (let xs = -hx + 2; xs < hx - 2; xs += 13) {
      const xe = Math.min(hx - 2, xs + 12);
      if (xe - xs < 5) continue;
      if (lv === 1 && xs > 0) continue;
      if (inField(xs, zf) || inField(xe, zf) || inField(xs, zf - 4) || inField(xe, zf - 4)) continue;
      if (k === 0 || k === 1) {
        for (let x = xs; x < xe; x += 4) {
          v.box(x, 1, zf, x + 1, 2, zf + 1, "steelDark");
          v.box(x, 1, zf - 3, x + 1, 3, zf - 2, "steelDark");
        }
        pvPanel(v, xs, xe, zf, 2, 5, 3, k === 1 ? "#18307a" : "solarBlue", k === 1 ? "#223f8f" : "#2a4ba3");
      } else if (k === 2) {
        // floats
        v.box(xs, 0, zf - 4, xe, 1, zf + 1, "white");
        pvPanel(v, xs, xe, zf, 1, 4, 1);
      } else {
        // parabolic trough: curved silver mirror with glowing receiver tube
        for (let x = xs; x < xe; x++) {
          v.put(x, 1, zf - 2, "steelDark");
          v.put(x, 2, zf - 2, "chrome");
          v.put(x, 2, zf - 1, "chrome");
          v.put(x, 2, zf - 3, "chrome");
          v.put(x, 3, zf, "silver");
          v.put(x, 3, zf - 4, "silver");
          v.put(x, 4, zf - 2, "orange", 0.8);
        }
        for (let x = xs; x < xe; x += 5) {
          v.box(x, 3, zf - 2, x + 1, 4, zf - 1, "steelDark");
        }
      }
      if (k === 0 && c.rand() < 0.5) sheep(v, xs + c.ri(1, 8), zf + 2);
    }
  }
  if (lv === 1) {
    // pallets of panels still waiting to be installed + crew
    for (let i = 0; i < 3; i++) {
      v.box(4 + i * 4, 1, -2, 7 + i * 4, 2, 2, "woodLight");
      v.box(4 + i * 4, 2, -2, 7 + i * 4, 3 + (i % 2), 2, "solarBlue", 0.1);
    }
    person(v, 6, 1, 4, "hazard", "blueDark");
    person(v, 10, 1, 5, "orange", "blueDark");
    v.box(3, 1, 7, 6, 4, 9, "white");
  }
  if (k === 1) {
    // cleaning robot + tumbleweeds
    v.box(-hx + 4, 3, -hz + 4, -hx + 6, 4, -hz + 6, "hazard");
    rocks(c, hx - 4, 1, hz - 6, 2, "sandDark");
  }
  if (k === 3) {
    // steam turbine block for the thermal plant
    const bx = hx - 10;
    const bz = hz - 12;
    v.hollowBox(bx, 1, bz, bx + 8, 8, bz + 6, "white");
    windows(c, bx, 1, bz, bx + 8, 8, bz + 6, { stepH: 3, startY: 4 });
    tank(v, bx + 2, bz - 2, 1, 6, 2, "orange", "steelLight");
    c.smoke(bx + 6, 9, bz + 3, "steam");
  }

  // inverter skids
  if (lv >= 2) {
    for (let i = 0; i < Math.min(lv, 4); i++) {
      const x = -hx + 3 + i * 12;
      if (x + 4 > hx - 2) break;
      v.box(x, 1, hz - 7, x + 4, 4, hz - 5, "white");
      v.put(x + 1, 3, hz - 5, "screenGreen", 1);
    }
  }
  // substation + O&M
  if (lv >= 3) {
    substation(c, hx - 12, hz - 4 - 10, hx - 1, hz - 4, 6);
    if (k === 3) {
      // move thermal block marker: keep both (they overlap slightly - fine on big lots)
    }
    officeBox(c, -hx + 1, hz - 11, -hx + 9, hz - 5, 4, "white");
    flag(v, -hx + 10, 1, hz - 6, 8, ["sky", "amber", "sky"]);
  }
  if (lv >= 4) {
    // battery storage yard
    for (let i = 0; i < 3; i++) {
      const x = -hx + 12 + i * 7;
      if (x + 6 > hx - 14) break;
      v.box(x, 1, hz - 12, x + 6, 5, hz - 8, "white");
      for (let xx = x + 1; xx < x + 5; xx += 2) v.put(xx, 3, hz - 8, "screenGreen", 1.1);
    }
    const ph = 22;
    pylon(v, hx - 4, -hz + 3, ph);
    c.blink(hx - 4, ph + 1, -hz + 3, "red");
  }
  if (lv >= 5) {
    // Concentrated-solar power tower with a heliostat ring
    for (let ring2 = 4; ring2 <= towerR; ring2 += 3) {
      const n = Math.floor((TAU * ring2) / 3.2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring2 * 0.3;
        const x = F(tcx + Math.cos(a) * ring2);
        const z = F(tcz + Math.sin(a) * ring2);
        if (x < -hx + 1 || x >= hx - 1 || z < -hz + 1 || z >= hz - 1) continue;
        v.put(x, 1, z, "steelDark");
        v.put(x, 2, z, "chrome", 0.25);
        v.put(x + (Math.cos(a) > 0 ? -1 : 1), 2, z, "chrome", 0.25);
      }
    }
    const th = 54;
    v.cylinderY(tcx, tcz, 1, 4, 3.2, "concrete");
    v.cone(tcx, 4, th, tcz, 2.4, 1.6, "white");
    for (let y = 8; y < th; y += 8) v.cylinderY(tcx, tcz, y, y + 1, 2.4, "concreteDark");
    // receiver
    v.cylinderY(tcx, tcz, th, th + 6, 2.6, "warmGlow", 1.6);
    v.cylinderY(tcx, tcz, th + 1, th + 2, 3.0, "amber", 1.2);
    v.cylinderY(tcx, tcz, th + 6, th + 8, 1.6, "steelDark");
    c.blink(F(tcx), th + 8, F(tcz), "red");
    // tower glow halo voxels
    v.cylinderY(tcx, tcz, th + 3, th + 4, 3.0, "white", 2);
  }
}

// =============================================================================================
// WINDMILLS — traditional mills that grow from a post mill into a whole mill village.
//  V0 Dutch (brick & thatch, red lattice sails, tulips)   V1 Greek Mykonos (white drum, jib sails)
//  V2 American windpump (steel lattice, multi-blade wheel, water tank)  V3 La Mancha (whitewash, black cap)
// =============================================================================================
interface MillSpec {
  h: number; // body height
  r: number; // base radius
  R: number; // sail radius
}

function millTower(c: Ctx, cx: number, cz: number, s: MillSpec, k: number, lvl: number): void {
  const v = c.v;
  const y0 = 1;
  const top = y0 + s.h;
  if (k === 0) {
    if (lvl <= 1) {
      // post mill: trestle + wooden box body
      v.box(cx - 3, 1, cz - 3, cx + 3, 2, cz + 3, "stone");
      for (const [dx, dz] of [[-3, 0], [2, 0], [0, -3], [0, 2]]) v.box(cx + dx, 2, cz + dz, cx + dx + 1, 4, cz + dz + 1, "woodDark");
      v.box(cx - 1, 2, cz - 1, cx + 1, 6, cz + 1, "woodDark");
      v.box(cx - 3, 6, cz - 3, cx + 3, top - 2, cz + 3, "woodLight");
      v.box(cx - 3, 6, cz - 3, cx - 2, top - 2, cz + 3, "wood");
      gable(v, cx - 4, top - 2, cz - 3, cx + 4, cz + 3, "z", "woodDark");
      v.put(cx, top - 4, cz + 3, "glass", 0.5);
      // tail pole + ladder to the back
      for (let i = 0; i < 6; i++) v.put(cx, 6 - F(i * 0.8), cz - 4 - i, "wood");
    } else {
      // tapered octagonal brick/wood tower mill
      for (let y = y0; y < top; y++) {
        const t = (y - y0) / s.h;
        const r = s.r * (1 - 0.38 * t);
        v.cylinderY(cx, cz, y, y + 1, r, y < y0 + 4 && lvl >= 3 ? "brick" : y % 4 === 0 ? "#4a3c30" : "#5c4a3a");
      }
      // thatch hood cap
      v.dome(cx, top, cz, s.r * 0.72, "sandDark");
      v.cylinderY(cx, cz, top, top + 1, s.r * 0.66, "woodDark");
      for (let wy = y0 + 4; wy < top - 2; wy += 6) { const zz = F(cz + s.r * (1 - 0.38 * ((wy - y0) / s.h))); v.box(cx - 1, wy, zz - 1, cx + 1, wy + 2, zz + 1, "white"); v.put(cx - 1, wy, zz, "warmGlow", 0.6); v.put(cx, wy + 1, zz, "warmGlow", 0.6); }
      door(v, cx - 1, 1, F(cz + s.r * 0.95) - 0, "white");
      if (lvl >= 3) {
        // stage gallery
        const gy = y0 + 6;
        ring(v, cx, cz, gy, gy + 1, s.r + 2, 0, "woodDark");
        ring(v, cx, cz, gy + 1, gy + 2, s.r + 2, s.r + 1.2, "wood");
      }
    }
  } else if (k === 1) {
    // Mykonos: thick white drum, blue door, conical thatch roof
    v.cylinderY(cx, cz, y0, top, s.r, "white");
    v.cylinderY(cx, cz, y0, y0 + 1, s.r + 0.6, "concrete");
    v.cone(cx, top, top + 5, cz, s.r + 0.6, 0.6, "sandDark");
    door(v, cx - 1, 1, F(cz + s.r), "blue");
    windows(c, cx - s.r, y0, cz - s.r, cx + s.r, top, cz + s.r, { faces: "se", stepV: 4, startY: 4, col: "blue", emit: 0.1 });
  } else if (k === 2) {
    // American windpump: lattice tower
    for (let y = y0; y < top; y++) {
      const t = (y - y0) / s.h;
      const o = Math.max(1, Math.round(s.r * (1 - t * 0.75)));
      for (const [dx, dz] of [[-o, -o], [o - 1, -o], [-o, o - 1], [o - 1, o - 1]]) v.put(cx + dx, y, cz + dz, "steelLight");
      if (y % 4 === 0) {
        v.box(cx - o, y, cz - o, cx + o, y + 1, cz - o + 1, "steelLight");
        v.box(cx - o, y, cz + o - 1, cx + o, y + 1, cz + o, "steelLight");
        v.box(cx - o, y, cz - o, cx - o + 1, y + 1, cz + o, "steelLight");
        v.box(cx + o - 1, y, cz - o, cx + o, y + 1, cz + o, "steelLight");
      }
    }
    v.box(cx, y0, cz, cx + 1, top, cz + 1, "steelDark"); // pump rod
    v.box(cx - 1, top, cz - 1, cx + 1, top + 2, cz + 2, "steelDark");
    // tail vane
    v.box(cx, top + 1, cz - 8, cx + 1, top + 2, cz - 1, "steelDark");
    v.box(cx, top, cz - 9, cx + 1, top + 4, cz - 5, "red");
    v.box(cx, top + 1, cz - 8, cx + 1, top + 3, cz - 6, "white");
  } else {
    // La Mancha: whitewashed stone drum + black conical cap
    v.cylinderY(cx, cz, y0, top, s.r, "white");
    v.cylinderY(cx, cz, y0, y0 + 2, s.r + 0.4, "stone");
    v.cylinderY(cx, cz, top - 1, top, s.r + 0.5, "charcoal");
    v.cone(cx, top, top + 4, cz, s.r + 0.3, 1.2, "slate");
    door(v, cx - 1, 1, F(cz + s.r), "woodDark");
    windows(c, cx - s.r, y0, cz - s.r, cx + s.r, top, cz + s.r, { faces: "sew", stepV: 5, startY: 4, col: "charcoal", emit: 0.05 });
  }

  // sails
  const hubY = k === 2 ? top + 1 : lvl <= 1 && k === 0 ? top - 3 : top + 1;
  const front = k === 2 ? cz + 2 : lvl <= 1 && k === 0 ? cz + 4 : F(cz + s.r * 0.7) + 2;
  // shaft
  v.box(cx - 1, hubY - 1, front - 3, cx + 1, hubY + 1, front, "woodDark");
  let rot: PixelVox;
  if (k === 0) rot = sailRotor(s.R, "redDark", "white");
  else if (k === 1) rot = sailRotor(s.R, "woodDark", "white", "jib");
  else if (k === 2) {
    rot = new PixelVox(9);
    rot.box(-1, -1, -1, 1, 1, 2, "steelDark");
    for (let b = 0; b < 18; b++) {
      const a = (b * TAU) / 18;
      for (let t = s.R * 0.35; t <= s.R; t += 0.5) {
        rot.put(F(Math.cos(a) * t), F(Math.sin(a) * t), 0, t > s.R - 1 ? "red" : "silver");
      }
      rot.put(F(Math.cos(a) * 1.5), F(Math.sin(a) * 1.5), 0, "steelDark");
    }
  } else rot = sailRotor(s.R, "woodDark", "woodLight");
  c.addRotor({ vox: rot, pivot: [cx, hubY, front], axis: "z", speed: k === 2 ? 2.4 : 1.0, wind: true });
}

function buildWindmills(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, ["grass", "sand", "grass2", "sandDark"][k]);
  speckle(c, ["grass3", "white", "grass3", "sand"][k], 0.1);

  const spec: MillSpec = byLvl(lv, [
    { h: 12, r: 3, R: 9 },
    { h: 15, r: 4, R: 10 },
    { h: 20, r: 4.6, R: 12 },
    { h: 22, r: 4.8, R: 13 },
    { h: 26, r: 5.2, R: 15 },
  ]);
  if (k === 2) {
    spec.h += 4;
    spec.r = Math.min(3, spec.r - 1);
    spec.R = Math.round(spec.R * 0.6);
  }
  // the big mill sits on the left (when wide) and back (when deep)
  const mcx = hx > 8 ? -hx + 8 : 0;
  const mcz = hz > 8 ? -hz + 8 : -1;

  // ground dressing by style
  if (k === 0) {
    // tulip field strips
    if (lv >= 2) {
      const cols = ["red", "yellow", "pink", "orange", "purple"];
      for (let i = 0; i < 4; i++) {
        const z = hz - 2 - i * 2;
        for (let x = -hx + 1; x < (hx > 8 ? hx - 1 : -2); x++) v.put(x, 1, z, cols[(i + lv) % 5]);
      }
    }
  } else if (k === 1) {
    tree(v, hx - 3, 1, hz - 3, "round", 0.8, 2);
    v.box(-hx, 1, -hz, hx, 2, -hz + 1, "white");
  } else if (k === 2) {
    // water tank + trough
    v.cylinderY(mcx + 4.5, mcz + 4.5, 1, 4, 2.2, "woodDark");
    v.cylinderY(mcx + 4.5, mcz + 4.5, 3, 4, 1.4, "water", 0.1);
    v.box(mcx - 5, 1, mcz + 4, mcx - 2, 2, mcz + 6, "steel");
    v.box(mcx - 4, 1, mcz + 5, mcx - 3, 2, mcz + 5, "water");
  } else {
    rocks(c, hx - 3, 1, -hz + 3, 2, "stone");
    v.box(-hx + 1, 1, hz - 2, -hx + 3, 2, hz - 1, "yellow");
  }

  millTower(c, mcx, mcz, spec, k, lv);

  if (lv >= 2) {
    // sacks of flour & a little cart / or for windpump hay bales
    for (let i = 0; i < 3; i++) v.box(mcx + 4 + i, 1, mcz + 5, mcx + 5 + i, 3, mcz + 6, k === 2 ? "hazard" : "cream");
    person(v, mcx - 4, 1, mcz + 6, k === 1 ? "blue" : "red", "blueDark");
  }
  if (lv >= 4) {
    // miller's house (right side)
    const x0 = Math.max(mcx + 8, hx - 13);
    const x1 = hx - 2;
    const z0 = -hz + 3;
    const z1 = Math.min(z0 + 9, hz - 3);
    const wall = ["brick", "white", "woodLight", "white"][k];
    const roof = ["slate", "blue", "redDark", "terracotta"][k];
    v.hollowBox(x0, 1, z0, x1, 6, z1, wall, k === 0 ? "white" : undefined);
    windows(c, x0, 1, z0, x1, 6, z1, { stepH: 3, h: 2, emit: 0.45, col: k === 1 ? "blue" : "glass" });
    door(v, x0 + 2, 1, z1 - 1, k === 1 ? "blue" : "woodDark");
    if (k === 1) {
      flatRoof(c, x0, 6, z0, x1, z1, "white", "white", false);
      v.dome((x0 + x1) / 2, 7, (z0 + z1) / 2, 2.4, "blue");
    } else if (k === 0) {
      // Dutch stepped gable
      gable(v, x0 - 1, 6, z0, x1 + 1, z1, "z", roof, "white");
    } else {
      gable(v, x0 - 1, 6, z0 - 1, x1 + 1, z1 + 1, "x", roof, "white");
    }
    const ch = chimney(v, x1 - 3, 6, z0 + 1, 5, k === 1 ? "white" : "brickDark");
    c.smoke(x1 - 2, ch, z0 + 2);
    if (k === 2) {
      // red barn instead feel: hay bales
      for (let i = 0; i < 3; i++) v.box(x0 + i * 3, 1, z1 + 1, x0 + i * 3 + 2, 3, z1 + 3, "sandDark");
    }
  }
  if (lv >= 5) {
    // second smaller mill at the front right + canal or path
    const s2: MillSpec = { h: k === 2 ? 14 : 12, r: k === 2 ? 2 : 3, R: k === 2 ? 5 : 8 };
    millTower(c, hx - 7, hz - 6, s2, k, 2);
    if (k === 0) {
      // canal with a little boat
      waterPlane(v, -hx, 2, hx - 13, 5);
      v.box(-hx + 4, 1, 3, -hx + 9, 2, 5, "woodDark");
      v.box(-hx + 6, 2, 3, -hx + 7, 5, 4, "white");
    } else {
      lamp(v, 0, 1, hz - 2, 5);
      flowerBed(c, -hx + 2, 2, -hx + 10, 4, 1, k === 1 ? ["blue", "white", "pink"] : ["yellow", "orange", "red"]);
    }
    flag(v, mcx - 5, 1, mcz - 4, 10, k === 0 ? ["red", "white", "blue"] : k === 1 ? ["blue", "white", "blue"] : k === 2 ? ["red", "white", "blue"] : ["red", "yellow", "red"]);
  }
}

function byLvl<T>(lv: number, arr: readonly [T, T, T, T, T]): T {
  const x = arr[clamp(lv, 1, 5) - 1];
  return typeof x === "object" ? ({ ...(x as object) } as T) : x;
}

// =============================================================================================
// WIND TURBINES — one 1×1 tower that GROWS TALL with ever larger blades.
//  V0 Classic white 3-blade on tapered tube   V1 Vintage steel-lattice tower, orange-tipped blades
//  V2 Vertical-axis helical (Darrieus) rotor  V3 Candy-striped coastal 2-blader with sky gallery
// =============================================================================================
function turbineAt(c: Ctx, x: number, z: number, H: number, R: number, k: number, opts: { big?: boolean; base?: boolean } = {}): void {
  const v = c.v;
  const tower = ["white", "steelLight", "white", "white"][k];
  if (k === 1) {
    for (let y = 1; y < H; y++) {
      const o = Math.max(1, Math.round(3 - (y / H) * 2));
      for (const [dx, dz] of [[-o, -o], [o - 1, -o], [-o, o - 1], [o - 1, o - 1]]) v.put(x + dx, y, z + dz, "steel");
      if (y % 3 === 0) {
        v.box(x - o, y, z - o, x + o, y + 1, z - o + 1, "steelLight");
        v.box(x - o, y, z + o - 1, x + o, y + 1, z + o, "steelLight");
        v.box(x - o, y, z - o, x - o + 1, y + 1, z + o, "steelLight");
        v.box(x + o - 1, y, z - o, x + o, y + 1, z + o, "steelLight");
      }
    }
  } else if (k === 2) {
    // VAWT: slender mast, rotor spins about y
    v.cylinderY(x, z, 1, 4, 2.2, "concrete");
    v.cylinderY(x, z, 4, H + 2, 0.9, "steelLight");
  } else {
    const rb = opts.big ? 2.2 : 1.6;
    for (let y = 1; y < H; y++) {
      const t = y / H;
      const r = rb - (rb - 0.9) * t;
      const col = k === 3 ? (F(y / 6) % 2 === 0 ? "white" : "red") : tower;
      v.cylinderY(x, z, y, y + 1, r, col);
    }
    if (k === 0 && H > 20) v.cylinderY(x, z, 1, 3, rb + 0.2, "leaf");
  }
  if (opts.base) {
    v.box(x - 3, 0, z - 3, x + 3, 1, z + 3, "concrete");
    door(v, x - 1, 1, z + (k === 1 ? 2 : 1), "steelDark", 1, 2, true);
  }
  if (k === 2) {
    // helical blades
    const rot = new PixelVox(5);
    const span = H - 6;
    const Rv = Math.max(3, R * 0.45);
    for (let b = 0; b < 3; b++) {
      for (let yy = 0; yy <= span; yy += 0.5) {
        const t = yy / span;
        const a = b * (TAU / 3) + t * 2.2;
        const rr = Rv * Math.sin(Math.PI * t) + 0.6;
        rot.put(F(Math.cos(a) * rr), F(yy), F(Math.sin(a) * rr), b === 0 ? "teal" : "white");
      }
    }
    rot.box(-1, 0, -1, 1, span + 1, 1, "steelLight");
    rot.box(-1, span, -1, 1, span + 2, 1, "teal");
    c.addRotor({ vox: rot, pivot: [x, 6, z], axis: "y", speed: 1.4, wind: true });
    c.blink(x, H + 3, z, "red");
    v.put(x, H + 2, z, "red", 1);
    return;
  }
  // nacelle
  const nl = Math.max(4, Math.round(R * 0.3));
  const nh = Math.max(2, Math.round(R * 0.13));
  const nacCol = k === 3 ? "red" : k === 1 ? "steelLight" : "white";
  v.box(x - 1, H, z - nl + 2, x + 1, H + nh, z + 2, nacCol);
  if (nh >= 3) {
    v.box(x - 2, H, z - nl + 3, x + 2, H + nh, z + 1, nacCol);
    v.box(x - 1, H + nh, z - nl + 3, x + 1, H + nh + 1, z, "steelLight");
  }
  c.blink(x, H + nh, z - nl + 3, "red");
  const pivotY = H + F(nh / 2);
  const blades = k === 3 ? 2 : 3;
  const phase = k === 3 ? 0.45 : Math.PI / 2;
  const tip = k === 1 ? "orange" : k === 3 ? "white" : "red";
  const bcol = k === 3 ? "red" : "white";
  const rot = bladeRotor(blades, R, bcol, tip, { hub: k === 3 ? "white" : "steelLight", phase, root: R > 14 ? 2 : 1.5, nose: k === 0 ? "white" : "steelLight" });
  c.addRotor({ vox: rot, pivot: [x, pivotY, z + 3], axis: "z", speed: 1.6 - Math.min(0.9, R * 0.03), wind: true });
}

function buildWindTurbine(c: Ctx): void {
  const { v, lv } = c;
  const k = c.variant % 4;
  lot(c, ["grass", "grass2", "sand", "grass"][k]);
  speckle(c, ["grass3", "grass3", "sandDark", "grass3"][k], 0.12);
  const H = byLvl(lv, [22, 32, 46, 62, 80]);
  const R = byLvl(lv, [9, 13, 18, 23, 28]);
  const x = 0;
  const z = -1;
  turbineAt(c, x, z, H, R, k, { big: lv >= 4, base: true });
  // ground life by level
  if (lv >= 2) {
    v.box(3, 1, 3, 6, 3, 6, "silver");
    v.put(4, 2, 6, "hazard");
  }
  if (lv >= 3) {
    car(v, -4, 1, 5, "x", "white");
    v.put(-5, 2, 5, "hazard");
  }
  if (lv >= 4) {
    person(v, 2, 1, 6, "hazard", "blueDark");
    // mid-tower service platform
    ring(v, x, z, F(H * 0.55), F(H * 0.55) + 1, 2.6, 0, k === 1 ? "steelDark" : "steelLight");
  }
  if (lv >= 5) {
    if (k === 3) {
      // sky gallery: glowing observation ring
      ring(v, x, z, H - 10, H - 7, 3.2, 1.4, "glass", 0.6);
      ring(v, x, z, H - 7, H - 6, 3.4, 0, "white");
    } else if (k !== 2) {
      // helipad hoist pad atop nacelle
      v.box(x - 2, H + 3, z - 6, x + 2, H + 4, z - 2, "hazard");
      v.put(x, H + 4, z - 4, "white");
    }
    v.cylinderY(x, z, 1, 2, 3, "concrete");
  }
}

// =============================================================================================
// WIND FARMS — sprawling arrays of turbines with access tracks and a substation.
//  V0 Rolling green hills with sheep   V1 Red desert mesas
//  V2 Snowy tundra with pines (red-tipped)  V3 Patchwork farmland with crop strips
// =============================================================================================
function buildWindFarms(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  const g = ["grass", "sand", "snow", "grass2"][k];
  lot(c, g);
  if (k === 3) {
    const cols = ["lime", "hazard", "leaf", "sandDark", "olive"];
    for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) v.put(x, 0, z, cols[(F((x + hx) / 6) + F((z + hz) / 8) * 2) % 5]);
  } else speckle(c, ["grass3", "sandDark", "white", "grass3"][k], 0.1);
  // gentle hills
  if (k !== 3) {
    const hcol = ["grass2", "terracotta", "snow", "grass2"][k];
    const hills = 2 + lv;
    for (let i = 0; i < hills; i++) {
      const cx = c.ri(-hx + 4, hx - 4);
      const cz = c.ri(-hz + 4, hz - 6);
      const rr = c.ri(4, 7);
      const hh = k === 1 ? c.ri(3, 5) : c.ri(1, 3);
      heightfield(v, cx - rr, cz - rr, cx + rr, cz + rr, (x, z) => {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / rr;
        if (d > 1) return 0;
        return k === 1 ? (d < 0.7 ? hh : hh * (1 - d) * 3) : hh * (1 - d * d);
      }, (_x, y, _z, top) => (top ? hcol : k === 1 ? (y % 2 ? "terracotta" : "brick") : hcol));
    }
  }
  // access tracks
  const track = k === 2 ? "concrete2" : "path2";
  v.box(-hx, 0, hz - 4, hx, 1, hz - 2, track);
  const n = byLvl(lv, [3, 4, 6, 8, 11]);
  const H = byLvl(lv, [24, 26, 28, 30, 32]);
  const R = byLvl(lv, [10, 10, 11, 11, 12]);
  const cols = Math.max(1, Math.round(Math.sqrt((n * hx) / hz)));
  const rows = Math.ceil(n / cols);
  const style = k === 2 ? 0 : 0;
  let placed = 0;
  for (let r = 0; r < rows && placed < n; r++) {
    for (let q = 0; q < cols && placed < n; q++) {
      const x = F(-hx + ((q + 0.5 + (r % 2 ? 0.3 : -0.1)) * (2 * hx)) / cols);
      const z = F(-hz + 3 + ((r + 0.5) * (2 * hz - 9)) / rows);
      // track spur
      v.box(x - 1, 0, z, x + 1, 1, hz - 3, track);
      turbineFarm(c, clamp(x, -hx + 3, hx - 4), z, H + (placed % 3) * 2, R, k);
      placed++;
      void style;
    }
  }
  // decorations
  if (k === 0) for (let i = 0; i < lv + 1; i++) sheep(v, c.ri(-hx + 2, hx - 4), c.ri(-hz + 2, hz - 6));
  if (k === 2) for (let i = 0; i < lv + 2; i++) tree(v, c.ri(-hx + 1, hx - 2), 1, c.ri(-hz + 1, hz - 2), "pine", 0.9);
  if (k === 1) rocks(c, c.ri(-hx + 3, hx - 3), 1, hz - 6, 3, "terracotta");
  if (lv >= 3) substation(c, hx - 11, hz - 12, hx - 1, hz - 4, 6);
  if (lv >= 4) {
    // O&M building and met mast
    officeBox(c, -hx + 1, hz - 11, -hx + 9, hz - 5, 4, k === 2 ? "red" : "white");
    v.box(-hx + 11, 1, hz - 7, -hx + 12, 30, hz - 6, "steelLight");
    for (let y = 8; y < 30; y += 7) v.box(-hx + 11, y, hz - 7, -hx + 14, y + 1, hz - 6, "steelDark");
    c.blink(-hx + 11, 30, hz - 7, "red");
  }
  if (lv >= 5) {
    pylon(v, hx - 4, -hz + 4, 24);
    c.blink(hx - 4, 25, -hz + 4, "red");
    car(v, 0, 1, hz - 3, "x", "white");
    flag(v, -hx + 2, 1, hz - 3, 7, ["sky", "white", "leaf"]);
  }
}

function turbineFarm(c: Ctx, x: number, z: number, H: number, R: number, k: number): void {
  const v = c.v;
  v.cylinderY(x, z, 0, 1, 2.5, "concrete");
  for (let y = 1; y < H; y++) v.cylinderY(x, z, y, y + 1, y < H * 0.3 ? 1.1 : 0.8, k === 1 ? "concrete" : "white");
  v.box(x - 1, H, z - 3, x + 1, H + 2, z + 2, k === 2 ? "red" : "white");
  c.blink(x, H + 2, z - 2, "red");
  const tip = k === 2 ? "red" : k === 1 ? "orange" : "white";
  c.addRotor({ vox: bladeRotor(3, R, "white", tip, { hub: "steelLight", root: 1.5 }), pivot: [x, H + 1, z + 3], axis: "z", speed: 1.2 + (x % 3) * 0.08, wind: true });
}

// =============================================================================================
defineDesigns({
  solar_panels: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["Backyard Panel Kit", "Rooftop Array Shed", "Community Solar Rows", "Inverter-Station Field", "Solar Park & Megabattery"],
    growth: "Starts as a couple of panels, gains a panel-roofed shed, then sprawls into fenced rows with inverters and a battery bank.",
    build: buildSolarPanels,
  },
  solar_farms: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [4, 4]],
    levels: ["Solar Meadow", "Solar Plantation", "Utility Solar Farm", "Gigawatt Array", "Solar Power-Tower Park"],
    growth: "Rows multiply across a widening field, adding inverters, a substation and battery yard — then a glowing power tower with a mirror field.",
    build: buildSolarFarms,
  },
  windmills: {
    footprints: [[1, 1], [1, 1], [1, 1], [2, 1], [2, 2]],
    levels: ["Post Mill", "Smock Mill", "Gallery Tower Mill", "Mill & Miller's House", "Windmill Village"],
    growth: "From a little post mill to a tall gallery mill, then a miller's house and finally a second mill and village fields.",
    build: buildWindmills,
  },
  wind_turbines: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Farm Turbine", "Community Turbine", "Utility Turbine", "Multi-Megawatt Giant", "Titan Sky Turbine"],
    growth: "The same tower shoots higher each level while its blades grow longer, gaining beacons, platforms and a nacelle helipad.",
    build: buildWindTurbine,
  },
  wind_farms: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [4, 4]],
    levels: ["Wind Trio", "Ridge Line", "Wind Park", "Wind Plains", "Gigawatt Wind Range"],
    growth: "More turbines spread across a widening landscape, joined by tracks, a substation, met mast and transmission pylons.",
    build: buildWindFarms,
  },
});

// =============================================================================================
// LANDFILL — a dump pit that SPRAWLS and piles up into a terraced trash mountain.
//  V0 Municipal tip (colourful bags, soil cover layers)   V1 Eco-capped (grassed terraces, gas wells)
//  V2 Scrapyard junk mountain (rusty metal, crushed cars, magnet crane)  V3 Desert tip (bags, tyres, vultures)
// =============================================================================================
const TRASH: string[][] = [
  ["charcoal", "leafDark", "blue", "white", "red", "yellow", "slateLight", "black", "orange", "silver"],
  ["charcoal", "leafDark", "blue", "white", "red", "slateLight", "black"],
  ["#8a4b2a", "#a0522d", "steelDark", "#6b3b22", "steel", "iron", "copper", "red", "blueDark", "silver"],
  ["black", "charcoal", "rubber", "white", "blue", "sandDark", "black"],
];

function birdRotor(n: number, R: number, col: string, wing: string): PixelVox {
  const r = new PixelVox(17);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = R + (i % 2) * 3;
    const x = F(Math.cos(a) * rr);
    const z = F(Math.sin(a) * rr);
    const y = (i % 3) * 2;
    r.put(x, y, z, col);
    r.put(x - 1, y + 1, z, wing);
    r.put(x + 1, y + 1, z, wing);
  }
  return r;
}

function buildLandfill(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, ["soil", "grass2", "asphaltDark", "sand"][k]);
  speckle(c, ["soilDark", "grass3", "asphalt", "sandDark"][k], 0.15);
  const pal = TRASH[k];
  const front = Math.min(6, hz - 4);
  const mx0 = -hx + 2;
  const mx1 = hx - 2;
  const mz0 = -hz + 2;
  const mz1 = hz - front;
  const cx = (mx0 + mx1) / 2 - (lv >= 4 ? 3 : 0);
  const cz = (mz0 + mz1) / 2;
  const rx = (mx1 - mx0) / 2;
  const rz = (mz1 - mz0) / 2;
  const peak = byLvl(lv, [3, 5, 9, 14, 21]);
  const terr = lv >= 3 ? 3 : 0;
  const hf = (x: number, z: number): number => {
    const dx = Math.abs(x + 0.5 - cx) / rx;
    const dz = Math.abs(z + 0.5 - cz) / rz;
    const d = Math.pow(dx ** 3 + dz ** 3, 1 / 3);
    if (d > 1) return 0;
    let raw = peak * Math.min(1, (1 - d) * (lv >= 3 ? 1.6 : 2.6));
    if (terr) raw = Math.ceil(raw / terr) * terr;
    return Math.max(1, raw);
  };
  if (lv === 1) {
    // dug pit with a soil rim
    v.box(mx0 - 1, 0, mz0 - 1, mx1 + 1, 2, mz1 + 1, k === 3 ? "sandDark" : "soilDark");
    v.box(mx0, 1, mz0, mx1, 2, mz1, k === 2 ? "asphaltDark" : "soil");
  }
  heightfield(v, mx0, mz0, mx1, mz1, hf, (x, y, z, top) => {
    if (k === 1) {
      // capped: grass on the left/back, active face front-right
      const active = x + 0.5 - cx > -z * 0.3 + rx * 0.2;
      if (!active) return top ? (y % 2 ? "grass" : "grass2") : "soil";
    }
    if (!top && k !== 2 && y % 3 === 0) return k === 3 ? "sandDark" : "soil"; // daily cover layers
    const hsh = ((F(x / 2) * 73856093) ^ (y * 19349663) ^ (F(z / 2) * 83492791)) >>> 0;
    if (top && k !== 2 && hsh % 5 === 0) return k === 3 ? "sandDark" : "soilDark";
    return pal[hsh % pal.length];
  }, lv === 1 ? 2 : 1);
  const topY = (x: number, z: number) => 1 + Math.round(hf(x, z)) + (lv === 1 ? 1 : 0);
  const pcx = F(cx);
  const pcz = F(cz);

  // access road + gate + weighbridge
  v.box(-hx, 0, hz - front + 1, hx, 1, hz, k === 2 ? "asphalt" : "path2");
  if (lv >= 2) {
    v.box(hx - 8, 0, hz - front + 2, hx - 3, 1, hz - 1, "steel");
    securityFence(v, -hx, -hz, hx, hz, 1, 3, [hx - 9, hx - 1]);
    // site office cabin
    const ox = -hx + 1;
    v.box(ox, 1, hz - front + 1, ox + 6, 4, hz - 1, k === 1 ? "leaf" : "white");
    v.box(ox, 4, hz - front + 1, ox + 6, 5, hz - 1, "steelDark");
    v.put(ox + 2, 2, hz - 2, "glass", 0.4);
    v.put(ox + 4, 2, hz - 2, "glass", 0.4);
  } else {
    fence(v, -hx, -hz, hx, hz, 1, 2, "woodDark", [-3, 3]);
  }
  // garbage truck arriving
  if (k === 2) truck(v, hx - 6, 1, hz - 3, "x", "steelDark", "red");
  else garbageTruck(v, lv >= 2 ? 1 : 2, 1, hz - 3, k === 1 ? "leaf" : k === 3 ? "orange" : "leafDark", "white");

  // dozer on the summit
  if (lv >= 2) dozer(v, pcx, topY(pcx, pcz), pcz, k === 2 ? "orange" : "hazard");
  if (lv >= 5) dozer(v, pcx - 7, topY(pcx - 7, pcz + 4), pcz + 4, "orange");
  // birds circling
  if (lv >= 2 || k === 3) {
    const birdCol = k === 3 ? "charcoal" : "white";
    const wing = k === 3 ? "black" : "silver";
    c.addRotor({ vox: birdRotor(3 + lv, 4 + lv, birdCol, wing), pivot: [pcx, peak + 8, pcz], axis: "y", speed: 0.7 });
  }
  if (lv >= 3) {
    if (k === 2) {
      // magnet crane over the scrap mountain
      crane(v, hx - 6, 1, -hz + 2, 18 + lv * 2, 10, "hazard", "x");
      v.box(hx - 6 + 7, 10 + lv * 2, -hz + 2, hx - 6 + 10, 11 + lv * 2, -hz + 4, "charcoal");
    } else if (k === 3) {
      // tyre stacks
      for (let i = 0; i < lv; i++) {
        const tx = hx - 4 - i * 4;
        for (let y = 1; y < 2 + i % 3 + 1; y++) ring(v, tx, -hz + 4, y, y + 1, 1.6, 0.6, "rubber");
      }
    }
  }
  if (lv >= 4) {
    // leachate pond
    const px0 = hx - 12;
    const pz0 = hz - front - 7;
    v.box(px0 - 1, 0, pz0 - 1, hx - 1, 1, pz0 + 6, "concreteDark");
    v.box(px0, 0, pz0, hx - 2, 1, pz0 + 5, "#6f7d3a", 0.05);
    // methane flare
    const fx = hx - 4;
    const fz = -hz + 4;
    v.box(fx, 1, fz, fx + 1, 14, fz + 1, "steelLight");
    v.box(fx - 1, 1, fz - 1, fx + 2, 3, fz + 2, "steelDark");
    v.put(fx, 14, fz, "fire", 1.6);
    v.put(fx, 15, fz, "amber", 1.6);
    c.smoke(fx, 16, fz, "dark");
    c.blink(fx, 13, fz, "red");
    // gas wells on the mound (white pipes)
    for (let i = 0; i < lv; i++) {
      const wx = F(cx - rx * 0.5 + i * 3);
      const wz = F(cz - rz * 0.3 + (i % 2) * 4);
      const ty = topY(wx, wz);
      v.box(wx, ty, wz, wx + 1, ty + 3, wz + 1, k === 2 ? "hazard" : "white");
      v.put(wx, ty + 3, wz, "red");
    }
  }
  if (lv >= 5) {
    // compactor with spiked drums + crushed-car stacks / sorting
    const kx = -hx + 6;
    const kz = hz - front - 2;
    v.box(kx - 2, 1, kz - 1, kx + 2, 3, kz + 2, "hazard");
    v.box(kx - 1, 3, kz, kx + 1, 5, kz + 2, "hazard");
    for (const dx of [-3, 3]) v.box(kx + dx, 1, kz - 1, kx + dx + 1, 3, kz + 2, "steelDark");
    if (k === 2) {
      for (let i = 0; i < 6; i++) v.box(-hx + 12 + (i % 3) * 3, 1 + F(i / 3) * 2, hz - front - 3, -hx + 15 + (i % 3) * 3, 3 + F(i / 3) * 2, hz - front, c.pick(["red", "blue", "silver", "teal"]));
    }
    lamp(v, -2, 1, hz - 1, 6);
  }
}

// =============================================================================================
// TRASH COMPACTING PLANT — recycling centre that becomes a sorting/compaction COMPOUND.
//  V0 Municipal green with recycle arrows   V1 Blue corrugated industrial w/ orange machinery
//  V2 Old brick warehouse, sawtooth roof    V3 Futuristic white & glass with cyan glow
// =============================================================================================
function bales(v: PixelVox, x0: number, z0: number, nx: number, nz: number, layers: number, cols: string[]): void {
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      for (let l = 0; l < layers - ((i + j) % 2); l++) {
        const col = cols[(i + j * 3 + l) % cols.length];
        const x = x0 + i * 3;
        const z = z0 + j * 3;
        v.box(x, 1 + l * 2, z, x + 2, 3 + l * 2, z + 2, col);
        v.put(x, 2 + l * 2, z + 1, "white");
      }
    }
  }
}

function recycleLogo(v: PixelVox, cx: number, cy: number, z: number, r: number, col: string): void {
  for (let a = 0; a < TAU; a += 0.08) {
    const seg = F((a / TAU) * 3);
    const local = a - (seg * TAU) / 3;
    if (local > 1.75) continue;
    const x = F(cx + Math.cos(a) * r);
    const y = F(cy + Math.sin(a) * r);
    v.put(x, y, z, col, 0.8);
    if (local > 1.5) {
      v.put(x + (Math.sin(a) > 0 ? 1 : -1), y, z, col, 0.8);
      v.put(x, y + (Math.cos(a) > 0 ? -1 : 1), z, col, 0.8);
    }
  }
}

function buildTrashCompacting(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, k === 2 ? "concrete2" : "concrete");
  speckle(c, "concreteDark", 0.06);
  const wall = ["leaf", "blue", "brick", "white"][k];
  const roof = ["white", "steelLight", "slate", "glass"][k];
  const mach = ["hazard", "orange", "hazard", "cyan"][k];
  const BALE = [
    ["blue", "leaf", "silver", "yellow", "red"],
    ["blue", "silver", "orange", "white"],
    ["woodLight", "blue", "leaf", "silver"],
    ["cyan", "white", "silver", "blue"],
  ][k];

  if (lv === 1) {
    // drop-off: coloured skips + tiny baler kiosk
    const cols = ["blue", "leaf", "yellow", "slateLight"];
    for (let i = 0; i < 4; i++) {
      const x = -hx + 1 + i * 3;
      v.box(x, 1, -hz + 2, x + 3, 4, -hz + 6, cols[i]);
      v.box(x, 4, -hz + 2, x + 3, 5, -hz + 4, "charcoal");
    }
    v.box(-4, 1, 1, 2, 6, 6, wall);
    v.box(-3, 6, 1, 1, 7, 6, roof);
    v.box(-3, 1, 6, -1, 4, 7, mach);
    recycleLogo(v, -1, 4, 6, 1.6, k === 3 ? "cyan" : "white");
    bales(v, 3, 1, 1, 2, 2, BALE);
    person(v, 5, 1, hz - 2, "leaf");
    v.box(-hx, 0, hz - 3, hx, 1, hz, "asphalt");
    return;
  }
  // hall
  const hx0 = -hx + 1;
  const hx1 = lv === 2 ? hx - 9 : hx - 2 - (lv >= 4 ? 10 : 0);
  const hz0 = -hz + 1;
  const hz1 = lv === 2 ? hz - 6 : Math.min(hz - 9, hz0 + (lv >= 4 ? 22 : 14));
  const hh = byLvl(lv, [6, 7, 9, 10, 11]);
  if (lv === 2) {
    // open-sided baling shed
    for (let x = hx0; x < hx1; x += 4) {
      v.box(x, 1, hz0, x + 1, hh, hz0 + 1, "steelDark");
      v.box(x, 1, hz1 - 1, x + 1, hh, hz1, "steelDark");
    }
    v.box(hx0, 1, hz0, hx1, hh, hz0 + 1, wall);
    v.box(hx0, 1, hz0, hx0 + 1, hh, hz1, wall);
    for (let d = 0; d < hz1 - hz0 + 2; d++) v.box(hx0 - 1, hh + F(d / 3), hz1 - d, hx1 + 1, hh + 1 + F(d / 3), hz1 - d + 1, d === 0 ? wall : roof);
    v.box(hx0, hh - 1, hz1 - 1, hx1, hh, hz1, wall);
    recycleLogo(v, hx1 - 3, hh - 3, hz1, 1.6, "white");
    bales(v, hx1 + 2, hz0 + 1, 2, 3, 3, BALE);
    // baler machine
    v.box(hx0 + 2, 1, hz0 + 3, hx0 + 6, 5, hz0 + 8, mach);
    v.box(hx0 + 3, 5, hz0 + 4, hx0 + 5, 8, hz0 + 6, "steelDark");
    bales(v, hx0 + 8, hz0 + 3, 2, 2, 2, BALE);
  } else {
    v.hollowBox(hx0, 1, hz0, hx1, 1 + hh, hz1, wall, k === 3 ? "steelLight" : "white");
    if (k === 2) {
      sawtooth(v, hx0, 1 + hh, hz0, hx1, hz1, "slate", "glass", 4);
      windows(c, hx0, 1, hz0, hx1, 1 + hh, hz1, { stepH: 3, h: 2, startY: 3, faces: "se", emit: 0.4 });
    } else if (k === 3) {
      v.box(hx0, 3, hz1 - 1, hx1, hh, hz1, "glass", 0.35);
      v.box(hx0, 1 + hh, hz0, hx1, 2 + hh, hz1, "white");
      v.box(hx0, 1 + hh, hz1 - 1, hx1, 2 + hh, hz1, "cyan", 0.9);
    } else {
      // corrugated stripes + barrel/flat roof
      for (let x = hx0; x < hx1; x += 2) v.box(x, 2, hz1 - 1, x + 1, hh, hz1, k === 1 ? "blueDark" : "leafDark");
      if (k === 1) barrelRoof(v, hx0, 1 + hh, hz0, hx1, hz1, "x", "steelLight", "steel");
      else flatRoof(c, hx0, 1 + hh, hz0, hx1, hz1, "white", "white", true);
    }
    // big roller doors + tipping apron
    for (let x = hx0 + 2; x + 4 < hx1; x += 8) {
      v.box(x, 1, hz1 - 1, x + 4, 6, hz1, "steelLight");
      for (let y = 2; y < 6; y += 2) v.box(x, y, hz1 - 1, x + 4, y + 1, hz1, "steel");
    }
    if (k !== 3) recycleLogo(v, F((hx0 + hx1) / 2), hh - 2, hz1, 2.4, k === 0 ? "white" : "leaf");
    else recycleLogo(v, F((hx0 + hx1) / 2), hh + 4, hz1 - 1, 3, "cyan");
    // conveyor from sorting yard up into the hall
    conveyor(v, hx1 + 1, 2, hz1 - 6, hx1 + 8, 2, hz1 - 6, "steelDark", "charcoal", true);
    conveyor(v, hx1 - 3, hh - 1, hz1 - 6, hx1 + 1, 2, hz1 - 6, "steelDark", "charcoal", true);
    // tipping heap at the conveyor foot
    heightfield(v, hx1 + 6, hz1 - 10, Math.min(hx - 1, hx1 + 14), hz1 - 3, (x, z) => 3.5 - Math.hypot(x + 0.5 - (hx1 + 10), z + 0.5 - (hz1 - 6.5)) * 0.9, () => c.pick(["blue", "leaf", "white", "red", "yellow", "charcoal", "silver"]));
    // bale yard in front
    bales(v, hx0 + 1, hz1 + 2, Math.min(5, F((hx1 - hx0) / 3)), 2, lv >= 4 ? 3 : 2, BALE);
  }
  // trucks + roads
  v.box(-hx, 0, hz - 3, hx, 1, hz, "asphalt");
  garbageTruck(v, hx - 6, 1, hz - 2, k === 1 ? "blue" : "leaf", "white");
  if (lv >= 4) {
    // compactor press tower with piston
    const px = hx - 8;
    const pz = -hz + 3;
    v.box(px, 1, pz, px + 6, 14, pz + 6, mach);
    v.clear(px + 1, 4, pz + 5, px + 5, 10, pz + 6);
    v.box(px + 2, 6, pz + 2, px + 4, 14, pz + 4, "steelDark");
    v.box(px - 1, 14, pz - 1, px + 7, 15, pz + 7, "steelDark");
    v.box(px + 1, 1, pz + 6, px + 5, 2, pz + 9, "steel");
    c.smoke(px + 3, 16, pz + 3, "steam");
    // roll-off containers
    for (let i = 0; i < 2; i++) container(v, px - 1 + i * 0, 1, pz + 10 + i * 4, "x", i ? "blue" : "leaf");
    truck(v, -hx + 6, 1, hz - 2, "x", "silver", "orange");
  }
  if (lv >= 5) {
    // eco hub extras: rooftop solar, big lit recycle sign, little wind turbine
    for (let x = hx0 + 1; x < hx1 - 3; x += 4) pvPanel(v, x, x + 3, hz0 + 5, 2 + hh + (k === 2 ? 3 : 0), 3, 1);
    const sx = hx - 4;
    const sz = hz - 6;
    v.box(sx, 1, sz, sx + 1, 12, sz + 1, "steelDark");
    recycleLogo(v, sx, 14, sz + 1, 3.2, k === 3 ? "cyan" : "lime");
    c.addRotor({ vox: bladeRotor(3, 5, "white", "leaf"), pivot: [-hx + 3, 18, hz - 5], axis: "z", speed: 1.5, wind: true });
    v.box(-hx + 3, 1, hz - 7, -hx + 4, 18, hz - 6, "white");
    flag(v, -hx + 6, 1, hz - 4, 8, ["leaf", "white", "leaf"]);
  }
}

// =============================================================================================
// FACTORIES — workshop that grows into an industrial COMPOUND.
//  V0 Victorian brick mill (sawtooth slate, round brick chimney)  V1 Modern blue steel prefab
//  V2 Automotive plant (white halls, car lot, welding sparks)      V3 Foundry / steelworks (glowing furnace)
// =============================================================================================
function buildFactories(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, k === 3 ? "asphaltDark" : "concrete2");
  speckle(c, k === 3 ? "charcoal" : "concreteDark", 0.07);
  const wall = ["brick", "blue", "white", "#5b4a42"][k];
  const roofC = ["slate", "steelLight", "silver", "#7a4a36"][k];
  const trim = ["cream", "white", "red", "orange"][k];
  const smokeKind = k === 3 ? "dark" : k === 1 ? "steam" : "smoke";

  // main hall: back-left
  const x0 = -hx + 1;
  const x1 = lv === 1 ? hx - 3 : Math.min(hx - 2, x0 + byLvl(lv, [12, 24, 26, 30, 32]));
  const z0 = -hz + 1;
  const z1 = lv === 1 ? hz - 4 : Math.min(hz - 5, z0 + byLvl(lv, [10, 12, 18, 20, 24]));
  const h = byLvl(lv, [5, 6, 8, 9, 10]);
  v.hollowBox(x0, 1, z0, x1, 1 + h, z1, wall, trim);
  if (k === 0 || k === 2) {
    windows(c, x0, 1, z0, x1, 1 + h, z1, { stepH: 3, h: 2, startY: 2, faces: "se", emit: 0.45, col: k === 0 ? "warmGlow" : "glass" });
  } else if (k === 1) {
    for (let x = x0 + 1; x < x1 - 1; x += 2) v.box(x, 2, z1 - 1, x + 1, h, z1, "blueDark");
    ribbonWindows(c, x0, h - 2, z0, x1, h + 1, z1, 3, "glass", 0.5, "se");
  } else {
    v.box(x0 + 1, 2, z1 - 1, x1 - 1, 3, z1, "orange", 0.5);
  }
  if (lv === 1) {
    gable(v, x0 - 1, 1 + h, z0 - 1, x1 + 1, z1 + 1, "x", roofC, trim);
  } else if (k === 0 || k === 2) {
    sawtooth(v, x0, 1 + h, z0, x1, z1, roofC, "glass", 4);
  } else if (k === 1) {
    flatRoof(c, x0, 1 + h, z0, x1, z1, "steelLight", "white", true);
  } else {
    const rt = gable(v, x0 - 1, 1 + h, z0 - 1, x1 + 1, z1 + 1, "x", roofC, "rubber");
    // glowing clerestory monitor along the ridge
    const mz = F((z0 + z1) / 2);
    v.box(x0 + 1, rt - 1, mz - 1, x1 - 1, rt + 1, mz + 1, "orange", 0.8);
    v.box(x0 + 1, rt + 1, mz - 2, x1 - 1, rt + 2, mz + 2, "iron");
  }
  // loading door with glow for foundry
  const dx = F((x0 + x1) / 2) - 2;
  v.box(dx, 1, z1 - 1, dx + 4, 5, z1, k === 3 ? "fire" : "steelLight", k === 3 ? 1.3 : 0);
  if (k === 3) c.smoke(dx + 2, 6, z1, "spark");
  // chimney
  const chx = x0 + 2;
  const chz = z0 + 2;
  const chH = byLvl(lv, [9, 14, 18, 24, 30]);
  if (k === 0) {
    const t = smokestack(v, chx + 0.5, chz + 0.5, 1, chH, 1.4, "brickDark", "cream");
    c.smoke(chx, t + 1, chz, "smoke");
  } else if (k === 3) {
    const t = smokestack(v, chx + 0.5, chz + 0.5, 1, chH, 1.6, "iron", "orange");
    c.smoke(chx, t + 1, chz, "dark");
  } else {
    const t = smokestack(v, chx + 0.5, chz + 0.5, 1, chH, 1.0, "silver", k === 2 ? "red" : "blue");
    c.smoke(chx, t + 1, chz, smokeKind);
  }
  if (chH > 18) c.blink(chx, chH + 1, chz, "red");
  if (lv === 1) {
    if (k === 2) car(v, x1 + 1, 1, hz - 2, "x", "red");
    if (k === 3) { v.box(x1 + 1, 1, 0, x1 + 3, 2, 2, "iron"); v.put(x1 + 1, 2, 1, "fire", 1.2); c.smoke(x1 + 1, 3, 1, "spark"); }
    // crates, workbench & tinkerer
    for (let i = 0; i < 3; i++) v.box(x1 + 1, 1 + (i === 2 ? 2 : 0), -2 + (i % 2) * 2, x1 + 3, 3 + (i === 2 ? 2 : 0), (i % 2) * 2, "crate");
    person(v, 0, 1, hz - 2, "blue", "blueDark");
    v.box(-hx, 0, hz - 3, hx, 1, hz, "asphalt");
    door(v, -1, 1, z1 - 1, "woodDark");
    return;
  }
  // front road
  v.box(-hx, 0, hz - 4, hx, 1, hz, "asphalt");
  for (let x = -hx + 1; x < hx; x += 4) v.put(x, 0, hz - 2, "white");
  // signage on the front
  const sgCol = ["cream", "white", "red", "orange"][k];
  sign(v, x0 + 2, x0 + 9, h - 1, h + 1, z1, sgCol, 0.6, k === 0 ? "brickDark" : "charcoal");

  if (lv >= 3) {
    // office block on the right + loading docks with trucks
    const ox0 = x1 + 1;
    const ox1 = hx - 1;
    if (ox1 - ox0 >= 5) {
      v.hollowBox(ox0, 1, z0 + 2, ox1, 10, z0 + 10, k === 3 ? "concreteDark" : "cream");
      windows(c, ox0, 1, z0 + 2, ox1, 10, z0 + 10, { stepV: 3, stepH: 2, emit: 0.5 });
      flatRoof(c, ox0, 10, z0 + 2, ox1, z0 + 10, "concreteDark", "white", false);
    }
    for (let i = 0; i < 2; i++) {
      const tx = x0 + 4 + i * 8;
      v.box(tx - 3, 1, z1, tx + 3, 2, z1 + 2, "concreteDark");
      truck(v, tx, 1, z1 + 5, "z", c.pick(["white", "silver", "red"]), c.pick(["red", "blue", "orange"]));
    }
  }
  if (lv >= 4) {
    // water tower + conveyor bridge + second hall/feature
    const wx = x1 - 5;
    const wz = z0 + 4;
    const wy = 2 + h + 3;
    for (const [ddx, ddz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(wx + ddx, 1 + h, wz + ddz, wx + ddx + 1, wy + 5, wz + ddz + 1, "steelDark");
    tank(v, wx, wz, wy + 5, 5, 3, k === 0 ? "woodDark" : k === 2 ? "red" : "silver", "steelDark", trim);
    // silos at the front right
    if (k === 0 || k === 1) for (let i = 0; i < 3; i++) tank(v, hx - 4 - i * 5, hz - 10, 1, 10, 2.2, k === 0 ? "cream" : "silver", "steelLight", k === 0 ? "brick" : "blue");
    if (k === 2) {
      // car lot of new cars
      for (let i = 0; i < 6; i++) car(v, -hx + 3 + i * 4, 1, hz - 7, "z", ["red", "sky", "white", "yellow", "teal", "charcoal"][i]);
      c.smoke(x0 + 6, 3, z1 + 1, "spark");
    } else if (k === 3) {
      // blast furnace
      const bx = hx - 8;
      const bz = z0 + 4;
      v.cone(bx, 1, 22, bz, 4, 2.5, "iron");
      v.cylinderY(bx, bz, 10, 12, 4, "orange", 0.6);
      v.box(bx - 1, 22, bz - 1, bx + 1, 28, bz + 1, "steelDark");
      c.smoke(bx, 29, bz, "dark");
      c.smoke(bx, 3, bz + 4, "spark");
      conveyor(v, bx - 2, 22, bz, x1 - 6, 2 + h, bz, "steelDark", "charcoal", true);
    } else {
      conveyor(v, x1 - 8, h - 1, z1 - 3, x1 - 8, 3, hz - 7, "steelDark", k === 1 ? "orange" : "charcoal", false);
    }
  }
  if (lv >= 5) {
    // second chimney, rail spur, crane, parking
    const t2 = stack(c, x0 + 6.5, z0 + 2.5, 1, chH + 4, 1.4, k === 0 ? "brickDark" : k === 3 ? "iron" : "silver", "white", smokeKind, true);
    void t2;
    railSpur(v, -hx, hx, hz - 9, 2, k === 3 ? "#6b3b22" : "steelDark", k === 3 ? "orange" : "crate");
    crane(v, -hx + 2, 1, hz - 13, 20, 12, "hazard", "x");
    for (let x = x1 - 10; x < x1 - 2; x += 3) v.put(x, 2 + h + 3, z0 + 3, "red", 1);
  }
}

// =============================================================================================
// COAL POWER PLANTS — a boiler house that becomes a smoky gigawatt COMPOUND.
//  V0 Victorian brick station (arched windows, ringed brick stacks)  V1 Soviet grey slabs, red/white stacks
//  V2 Modern blue boiler tower with FGD scrubber                      V3 Art-deco "Battersea" with 4 white corner chimneys
// =============================================================================================
function buildCoal(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, "asphaltDark");
  speckle(c, "charcoal", 0.12);
  const wall = ["brick", "concrete", "blue", "brick2"][k];
  const trim = ["cream", "concreteDark", "white", "cream"][k];
  // coal yard at the front-left / left
  const yardW = clamp(F(hx * 0.7), 5, 14);
  const yx0 = -hx + 1;
  const yz0 = lv >= 4 ? -hz + 2 : 0;
  const yz1 = hz - (lv >= 4 ? 8 : 2);
  const peak = byLvl(lv, [3, 4, 6, 8, 10]);
  heightfield(v, yx0, yz0, yx0 + yardW, yz1, (x, z) => {
    const d = Math.max(Math.abs(x + 0.5 - (yx0 + yardW / 2)) / (yardW / 2), Math.abs(z + 0.5 - (yz0 + yz1) / 2) / ((yz1 - yz0) / 2));
    return d > 1 ? 0 : peak * Math.min(1, (1 - d) * 2.2);
  }, () => c.pick(["charcoal", "black", "iron", "black"]));
  // boiler house
  const bx0 = yx0 + yardW + 2;
  const bx1 = hx - (lv >= 4 ? 13 : 1);
  const bz0 = -hz + 1;
  const bz1 = Math.min(hz - (lv >= 4 ? 9 : 2), bz0 + byLvl(lv, [10, 12, 18, 18, 24]));
  const bh = byLvl(lv, [7, 9, 14, 16, 20]);
  const bmx = F((bx0 + bx1) / 2);
  const bmz = F((bz0 + bz1) / 2);
  if (k === 2) {
    // modern: tall blue boiler tower + lower turbine hall
    v.hollowBox(bx0, 1, bz0, bx1, 1 + F(bh * 0.55), bz1, "white");
    ribbonWindows(c, bx0, 1, bz0, bx1, 1 + F(bh * 0.55), bz1, 3, "glass", 0.4, "se");
    const tx0 = bx0 + 1;
    const tx1 = Math.min(bx1 - 1, tx0 + 8);
    v.hollowBox(tx0, 1, bz0, tx1, 1 + bh + 4, bz0 + 8, "blue");
    for (let y = 4; y < bh + 4; y += 4) v.box(tx0, y, bz0, tx1, y + 1, bz0 + 8, "blueDark");
    v.box(tx0, 1 + bh + 4, bz0, tx1, 2 + bh + 4, bz0 + 8, "steelDark");
  } else {
    v.hollowBox(bx0, 1, bz0, bx1, 1 + bh, bz1, wall, trim);
    if (k === 1) {
      for (let y = 4; y < bh; y += 4) v.box(bx0, y, bz0, bx1, y + 1, bz1, "concreteDark");
      windows(c, bx0, 1, bz0, bx1, 1 + bh, bz1, { stepH: 4, w: 2, h: 1, stepV: 4, startY: 2, emit: 0.4 });
      flatRoof(c, bx0, 1 + bh, bz0, bx1, bz1, "concreteDark", "concrete", false);
    } else {
      // tall arched windows (vertical strips)
      for (let x = bx0 + 2; x < bx1 - 2; x += 3) {
        v.box(x, 3, bz1 - 1, x + 1, bh - 1, bz1, "glassDark", 0.15);
        v.put(x, bh - 1, bz1 - 1, "warmGlow", 0.5);
      }
      for (let z = bz0 + 2; z < bz1 - 2; z += 3) v.box(bx1 - 1, 3, z, bx1, bh - 1, z + 1, "glassDark", 0.15);
      if (k === 3) {
        v.box(bx0, bh - 1, bz0, bx1, bh + 1, bz1, "cream");
        for (let x = bx0; x < bx1; x += 2) v.put(x, bh + 1, bz1 - 1, "cream");
        flatRoof(c, bx0, bh + 1, bz0, bx1, bz1, "concreteDark", "cream", false);
      } else {
        gable(v, bx0 - 1, 1 + bh, bz0 - 1, bx1 + 1, bz1 + 1, "x", "slate", trim);
      }
    }
  }
  // stacks
  const sh = byLvl(lv, [14, 22, 32, 40, 52]);
  const top = (k === 2 ? bh + 6 : bh + 1);
  if (k === 3) {
    // Battersea corner chimneys: fluted white columns on plinths
    const corners: [number, number][] = [[bx0 + 1, bz0 + 1], [bx1 - 2, bz0 + 1], [bx0 + 1, bz1 - 2], [bx1 - 2, bz1 - 2]];
    const n = lv === 1 ? 1 : lv === 2 ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const [cx, cz] = corners[i];
      v.box(cx - 1, top, cz - 1, cx + 2, top + 3, cz + 2, "cream");
      const h2 = F(sh * 0.6);
      v.cone(cx + 0.5, top + 3, top + 3 + h2, cz + 0.5, 1.6, 1.2, "white");
      v.cylinderY(cx + 0.5, cz + 0.5, top + 3 + h2, top + 4 + h2, 1.4, "charcoal");
      c.smoke(cx, top + 5 + h2, cz, "smoke");
      if (lv >= 4) c.blink(cx, top + 4 + h2, cz, "red");
    }
  } else {
    const n = lv <= 1 ? 1 : lv <= 3 ? (lv === 3 ? 1 : 2) : 2;
    for (let i = 0; i < n; i++) {
      const sx = bx1 - 3 - i * 6 - (lv >= 4 ? -6 : 0) - (lv === 3 ? 2 : 0);
      const sz = bz0 + 3 + i * 2;
      const scol = ["brickDark", "white", "concrete", "white"][k];
      const stripe = ["cream", "red", "steelDark", "red"][k];
      const r = lv >= 3 ? 2.2 : 1.4;
      if (k === 1) {
        // red-white banded
        v.cone(sx, 1, sh, sz, r + 0.6, r - 0.2, "white");
        for (let y = sh - 12; y < sh; y += 8) v.cylinderY(sx, sz, y, y + 4, r, "red");
        c.smoke(sx, sh + 1, sz, "dark");
        if (sh > 18) c.blink(F(sx), sh, F(sz), "red");
      } else {
        stack(c, sx, sz, 1, sh, r, scol, stripe, k === 2 ? "smoke" : "dark");
      }
    }
  }
  // conveyor from coal yard to boiler
  if (lv >= 2) {
    conveyor(v, yx0 + F(yardW / 2), peak + 1, bmz, bx0, bh - 2, bmz, "steelDark", "charcoal", true);
  }
  if (lv >= 3) dozer(v, yx0 + 3, 1 + F(peak * 0.3), yz1 - 2, "hazard");
  if (k === 2 && lv >= 3) {
    // FGD scrubber tank
    tank(v, bx1 - 4, bz1 - 4, 1, bh - 2, 3, "silver", "steelLight", "blue");
  }
  if (lv >= 4) {
    // cooling towers on the right
    const nT = lv >= 5 ? 2 : 1;
    for (let i = 0; i < nT; i++) {
      const tr = lv >= 5 ? 6.5 : 5.5;
      const tcx = hx - 7;
      const tcz = -hz + 7 + i * 14;
      cTower(v, tcx, tcz, 1, lv >= 5 ? 26 : 20, tr, k === 1 ? "concreteDark" : "concrete", k === 1 ? "red" : k === 0 ? "brick" : "");
      c.smoke(tcx, (lv >= 5 ? 28 : 22), tcz, "steam");
    }
    // rail spur with hopper cars along the front
    railSpur(v, -hx, hx, hz - 6, lv >= 5 ? 5 : 3, "brickDark", "black");
  }
  if (lv >= 5) {
    substation(c, bx0, bz1 + 1, Math.min(bx1, bx0 + 14), hz - 8, 7);
    pylon(v, hx - 15, hz - 9, 22);
  }
  if (lv === 1) {
    person(v, yx0 + yardW + 1, 1, hz - 2, "charcoal", "blueDark");
    v.box(bx0 + 2, 1, bz1, bx0 + 4, 4, bz1 + 1, "woodDark");
  }
}

// =============================================================================================
// NATURAL GAS POWER PLANTS — peaker hall that becomes a combined-cycle COMPOUND.
//  V0 Corporate white & blue HRSG blocks  V1 Yellow-pipe petrochem with spherical Horton tanks
//  V2 Heritage gasometer (guide-frame gas holder)  V3 Desert plant with air-cooled condenser fan decks
// =============================================================================================
function hrsgTrain(c: Ctx, x: number, z0: number, h: number, k: number, stackH: number): void {
  const v = c.v;
  const body = ["white", "steelLight", "brick", "sand"][k];
  const band = ["blue", "hazard", "cream", "orange"][k];
  // gas turbine enclosure (low)
  v.box(x - 3, 1, z0 + 10, x + 3, 6, z0 + 18, body);
  v.box(x - 3, 5, z0 + 10, x + 3, 6, z0 + 18, band);
  // duct transition + HRSG box (tall)
  v.box(x - 2, 3, z0 + 8, x + 2, 8, z0 + 10, "steel");
  v.box(x - 3, 1, z0, x + 3, h, z0 + 8, body);
  for (let y = 4; y < h; y += 5) v.box(x - 3, y, z0, x + 3, y + 1, z0 + 8, band);
  v.box(x - 4, h, z0 - 1, x + 4, h + 1, z0 + 9, "steelDark");
  // stack
  v.cylinderY(x, z0 + 3, h, stackH, 1.6, k === 2 ? "brickDark" : "silver");
  v.cylinderY(x, z0 + 3, stackH - 3, stackH - 2, 1.6, band);
  c.smoke(x, stackH + 1, z0 + 3, "steam");
  if (stackH > 22) c.blink(x, stackH, z0 + 3, "red");
}

function buildGas(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, k === 3 ? "sand" : "concrete2");
  speckle(c, k === 3 ? "sandDark" : "concreteDark", 0.08);
  const body = ["white", "steelLight", "brick", "sand"][k];
  const band = ["blue", "hazard", "cream", "orange"][k];
  // gas pipeline entering from the left (yellow)
  pipe(v, -hx, 2, hz - 3, hx - 2, hz - 2, "hazard", true, 1);
  v.box(-hx + 2, 1, hz - 4, -hx + 4, 4, hz - 1, "hazard");
  v.put(-hx + 3, 4, hz - 3, "red");

  if (lv <= 2) {
    // peaker halls: long low enclosures with silver exhaust stacks
    const n = lv;
    for (let i = 0; i < n; i++) {
      const x0 = -hx + 2 + i * 16;
      const x1 = x0 + 11;
      v.hollowBox(x0, 1, -hz + 3, x1, 7, hz - 6, body);
      v.box(x0, 6, -hz + 3, x1, 7, hz - 6, band);
      v.box(x0 + 1, 7, -hz + 4, x1 - 1, 8, hz - 7, "steelDark");
      for (let x = x0 + 2; x < x1 - 1; x += 3) v.box(x, 2, hz - 7, x + 1, 5, hz - 6, "steel");
      v.cylinderY(x1 - 3, -hz + 6, 7, 18 + lv * 2, 1.8, k === 2 ? "brickDark" : "silver");
      v.cylinderY(x1 - 3, -hz + 6, 15 + lv * 2, 16 + lv * 2, 1.8, band);
      c.smoke(x1 - 3, 20 + lv * 2, -hz + 6, "steam");
      // intake filter house
      v.box(x0 + 1, 7, hz - 10, x0 + 6, 11, hz - 6, "steelLight");
      for (let z = hz - 10; z < hz - 6; z++) v.box(x0 + 1, 8, z, x0 + 6, 9, z + 1, "steel");
    }
    if (lv === 1 && hx >= 12) {
      // control room + gas metering skid + transformer
      officeBox(c, hx - 10, -hz + 2, hx - 2, -hz + 8, 3, body);
      v.box(hx - 12, 1, hz - 8, hx - 5, 2, hz - 5, "concrete");
      for (let x = hx - 12; x < hx - 5; x += 2) v.box(x, 2, hz - 7, x + 1, 4, hz - 6, "hazard");
      pipe(v, hx - 12, 4, hz - 7, hx - 5, hz - 6, "hazard", false);
      v.box(-hx + 15, 1, -2, -hx + 18, 5, 1, "steelDark");
      v.put(-hx + 15, 5, -2, "white");
    }
  } else {
    const trains = lv === 3 ? 1 : lv === 4 ? 2 : 3;
    const h = byLvl(lv, [0, 0, 16, 18, 20]);
    const stackH = byLvl(lv, [0, 0, 28, 32, 38]);
    for (let i = 0; i < trains; i++) hrsgTrain(c, -hx + 5 + i * 9, -hz + 2, h, k, stackH);
    // steam turbine hall
    const tx0 = -hx + 1;
    const tx1 = Math.min(hx - 2, tx0 + trains * 9 + 2);
    const tz0 = -hz + 21;
    const tz1 = Math.min(hz - 5, tz0 + 8);
    if (tz1 - tz0 >= 4) {
      v.hollowBox(tx0, 1, tz0, tx1, 9, tz1, body);
      ribbonWindows(c, tx0, 1, tz0, tx1, 9, tz1, 3, "glass", 0.45, "s");
      barrelRoof(v, tx0, 9, tz0, tx1, tz1, "x", "steelLight", band);
      sign(v, tx0 + 2, tx0 + 8, 6, 8, tz1, band, 0.7);
    }
    // right side accessories per style
    const ax0 = -hx + trains * 9 + 3;
    if (k === 1) {
      for (let i = 0; i < lv - 2; i++) {
        const sx = hx - 6 - (i % 2) * 9;
        const sz = -hz + 6 + F(i / 2) * 10;
        for (const [ddx, ddz] of [[-3, 0], [2, 0], [0, -3], [0, 2]]) v.box(sx + ddx, 1, sz + ddz, sx + ddx + 1, 5, sz + ddz + 1, "steelDark");
        v.sphere(sx, 8, sz, 4.2, 4.2, 4.2, "white");
        v.cylinderY(sx, sz, 8, 9, 4.3, "hazard");
      }
    } else if (k === 2) {
      // gasometer guide frame with a holder bell
      const gx = hx - 9;
      const gz = -hz + 9;
      const gr = 7;
      v.cylinderY(gx, gz, 1, 12 + lv * 2, gr - 1, "#7e8a6e");
      v.cylinderY(gx, gz, 12 + lv * 2, 13 + lv * 2, gr - 1.5, "#6a7560");
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const px = F(gx + Math.cos(a) * gr);
        const pz = F(gz + Math.sin(a) * gr);
        v.box(px, 1, pz, px + 1, 22 + lv * 2, pz + 1, "redDark");
      }
      for (const y of [8, 15, 22 + lv * 2 - 1]) ring(v, gx, gz, y, y + 1, gr + 0.5, gr - 0.5, "redDark");
    } else {
      // air-cooled condenser deck with spinning fans (or HRSG-side chillers)
      const dx0 = Math.max(ax0, hx - 18);
      const dx1 = hx - 1;
      const dz0 = -hz + 2;
      const dz1 = Math.min(dz0 + (lv >= 5 ? 18 : 12), hz - 6);
      const dh = 9;
      for (let x = dx0; x < dx1; x += 4) for (let z = dz0; z < dz1; z += 6) v.box(x, 1, z, x + 1, dh, z + 1, "steelDark");
      v.box(dx0, dh, dz0, dx1, dh + 1, dz1, k === 3 ? "sandDark" : "steelLight");
      v.box(dx0, dh - 1, dz0, dx1, dh, dz1, "steelDark");
      for (let x = dx0 + 3; x < dx1 - 2; x += 6) for (let z = dz0 + 3; z < dz1 - 2; z += 6) {
        ring(v, x, z, dh + 1, dh + 3, 2.9, 2.0, k === 3 ? "#b8a278" : "steel");
        v.cylinderY(x, z, dh + 1, dh + 2, 2.0, "charcoal");
        c.addRotor({ vox: fanRotor(2, "silver", 4), pivot: [x, dh + 2, z], axis: "y", speed: 3 });
      }
    }
    if (lv >= 4) {
      // spherical/cylindrical fuel tanks + flare
      const fx = hx - 3;
      const fz = hz - 9;
      v.box(fx, 1, fz, fx + 1, 20, fz + 1, "steelDark");
      v.put(fx, 20, fz, "fire", 1.6);
      c.smoke(fx, 21, fz, "smoke");
      c.blink(fx, 19, fz, "red");
      tank(v, fx - 6, fz, 1, 5, 3, "white", "steelLight", band);
    }
    if (lv >= 5) {
      substation(c, tx1 + 1, hz - 15, Math.min(hx - 6, tx1 + 14), hz - 4, 7);
      pylon(v, hx - 3, hz - 2, 22);
    }
  }
  v.box(-hx, 0, hz - 1, hx, 1, hz, "asphalt");
}

defineDesigns({
  landfill: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Town Dump Pit", "Fenced Tip", "Terraced Trash Hill", "Sanitary Landfill", "Trash Mountain"],
    growth: "A shallow dump pit spreads out and piles up into terraced layers, gaining bulldozers, seagulls, a leachate pond and methane flare.",
    build: buildLandfill,
  },
  trash_compacting_plants: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Recycling Drop-Off", "Baling Shed", "Material Recovery Facility", "Compaction Plant", "Zero-Waste Eco Hub"],
    growth: "Coloured skips become a baling shed, then a sorting hall with conveyors and bale yards, a compactor tower, and finally a solar-roofed eco hub.",
    build: buildTrashCompacting,
  },
  factories: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Tinkerer's Workshop", "Sawtooth Mill", "Assembly Plant", "Industrial Works", "Mega-Factory Complex"],
    growth: "A small workshop grows a sawtooth hall, offices and loading docks, then water tower, conveyors, rail spur and twin stacks.",
    build: buildFactories,
  },
  coal_powerplants: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Boiler House", "Steam Station", "Coal-Fired Station", "Coal Power Station", "Gigawatt Coal Complex"],
    growth: "A brick boiler house grows taller stacks, a coal yard with conveyors, then cooling towers, a coal train and a switchyard.",
    build: buildCoal,
  },
  natural_gas_power_plants: {
    footprints: [[2, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Peaker Turbine Hall", "Twin Peaker Station", "Combined-Cycle Plant", "Two-Train CCGT", "Gas Power Mega-Station"],
    growth: "Low turbine halls become combined-cycle trains with tall HRSG boilers and silver stacks, then tanks, flares and a switchyard.",
    build: buildGas,
  },
});

// =============================================================================================
// TRASH BURNING PLANTS — waste-to-energy COMPOUND with tipping hall, boiler hall & tall stack.
//  V0 "CopenHill" (stacked-aluminium facade, ski slope roof)  V1 Hundertwasser (patchwork facade, gold ball stack)
//  V2 Grim industrial (grey hall, glowing furnace window)       V3 Japanese sleek (white & glass, rainbow stack)
// =============================================================================================
function buildTrashBurning(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, k === 3 ? "concrete" : "concrete2");
  speckle(c, "concreteDark", 0.06);
  v.box(-hx, 0, hz - 3, hx, 1, hz, "asphalt");

  if (lv === 1) {
    // backyard incinerator shed: brick furnace + chimney + bags
    const wall = ["steelLight", "yellow", "concreteDark", "white"][k];
    v.hollowBox(-5, 1, -6, 4, 7, 2, wall);
    gable(v, -6, 7, -7, 5, 3, "x", k === 1 ? "blue" : "slate");
    v.box(-2, 1, 1, 1, 4, 2, "fire", 1.4);
    v.box(-3, 4, 1, 2, 5, 2, "iron");
    const t = chimney(v, 1, 7, -5, 7, k === 1 ? "red" : "brickDark");
    c.smoke(2, t, -4, k === 2 ? "dark" : "smoke");
    for (let i = 0; i < 5; i++) v.box(-6 + i * 2, 1, 4, -5 + i * 2, 3, 5, c.pick(["charcoal", "leafDark", "blue", "black"]));
    garbageTruck(v, 3, 1, hz - 2, "orange");
    return;
  }

  // dims
  const bx0 = -hx + 1;
  const bx1 = hx - (lv >= 4 ? 12 : 2);
  const bz0 = -hz + 2;
  const bz1 = hz - (lv >= 3 ? 9 : 5);
  const bh = byLvl(lv, [0, 9, 15, 18, 22]);
  const stH = byLvl(lv, [0, 22, 34, 42, 54]);
  const tip = F((bx1 - bx0) * 0.45) + bx0; // tipping hall / boiler split

  if (k === 0) {
    // CopenHill: sloped roof from high (back-left) down to low (front-right) with a ski slope
    for (let x = bx0; x < bx1; x++) {
      const top = Math.round(bh - ((x - bx0) * (bh - 4)) / Math.max(1, bx1 - bx0));
      for (let y = 1; y < top; y++) {
        const col = (y + F(x / 3)) % 3 === 0 ? "silver" : (y % 2 ? "steelLight" : "chrome");
        v.put(x, y, bz1 - 1, col);
        v.put(x, y, bz0, col);
      }
      for (let z = bz0; z < bz1; z++) {
        const stripe = z === F((bz0 + bz1) / 2) || z === F((bz0 + bz1) / 2) + 1;
        v.put(x, top, z, stripe ? "white" : (x + z) % 7 === 0 ? "leafDark" : "leafLight");
      }
      if (x % 5 === 0) for (let y = 3; y < top - 1; y += 3) v.put(x, y, bz1 - 1, "glass", 0.4);
    }
    for (let z = bz0; z < bz1; z++) {
      v.box(bx0, 1, z, bx0 + 1, bh, z + 1, "steelLight");
      v.box(bx1 - 1, 1, z, bx1, 4, z + 1, "steelLight");
    }
    // skiers & trees on the slope
    for (let i = 0; i < lv; i++) {
      const x = bx0 + 3 + i * F((bx1 - bx0 - 6) / lv);
      const top = Math.round(bh - ((x - bx0) * (bh - 4)) / Math.max(1, bx1 - bx0));
      person(v, x, top + 1, F((bz0 + bz1) / 2) + (i % 2 ? 2 : -2), ["red", "yellow", "blue", "pink", "orange"][i % 5], "charcoal");
      if (lv >= 3) tree(v, x + 2, top + 1, bz0 + 2, "pine", 0.6);
    }
  } else {
    const wall = ["", "white", "concreteDark", "white"][k];
    v.hollowBox(bx0, 1, bz0, tip, 1 + F(bh * 0.6), bz1, wall);
    v.hollowBox(tip, 1, bz0, bx1, 1 + bh, bz1, k === 2 ? "steelDark" : wall);
    if (k === 1) {
      // Hundertwasser patchwork
      const pal = ["red", "yellow", "blue", "white", "leaf", "orange", "black"];
      for (let x = bx0; x < bx1; x++) {
        const top = x < tip ? F(bh * 0.6) : bh;
        for (let y = 1; y <= top; y++) {
          const p = pal[((F(x / 3) * 7 + F(y / 2) * 3) >>> 0) % pal.length];
          v.put(x, y, bz1 - 1, p);
        }
      }
      for (let z = bz0; z < bz1; z++) for (let y = 1; y <= bh; y++) v.put(bx1 - 1, y, z, pal[((F(z / 3) * 5 + F(y / 2) * 3) >>> 0) % pal.length]);
      for (let x = bx0 + 2; x < bx1 - 2; x += 4) v.put(x, 4, bz1, "gold", 0.4);
      // green roof with trees
      v.box(bx0, 1 + F(bh * 0.6), bz0, tip, 2 + F(bh * 0.6), bz1, "grass");
      tree(v, bx0 + 3, 2 + F(bh * 0.6), bz0 + 3, "round", 0.9, 1);
      tree(v, tip - 3, 2 + F(bh * 0.6), bz1 - 3, "oak", 0.8, 2);
      v.box(tip, 1 + bh, bz0, bx1, 2 + bh, bz1, "grass");
      for (let x = tip + 1; x < bx1 - 1; x += 3) v.put(x, 1 + bh, bz1 - 1, "gold", 0.3);
    } else if (k === 2) {
      ribbonWindows(c, bx0, 1, bz0, tip, 1 + F(bh * 0.6), bz1, 3, "glassDark", 0.1, "s");
      v.box(tip + 2, 3, bz1 - 1, bx1 - 2, 6, bz1, "fire", 1.2);
      for (let x = tip + 2; x < bx1 - 2; x += 2) v.box(x, 3, bz1 - 1, x + 1, 6, bz1, "iron");
      flatRoof(c, bx0, 1 + F(bh * 0.6), bz0, tip, bz1, "concreteDark", "steelDark", true);
      flatRoof(c, tip, 1 + bh, bz0, bx1, bz1, "iron", "steelDark", false);
      c.smoke(tip + 4, 7, bz1, "spark");
    } else {
      curtainWall(c, tip, 1, bz1 - 3, bx1, 1 + bh, bz1, "glass", "white", 3, 4);
      v.box(bx0, 1 + F(bh * 0.6), bz0, tip, 2 + F(bh * 0.6), bz1, "white");
      v.box(tip, 1 + bh, bz0, bx1, 2 + bh, bz1, "white");
      v.box(bx0, 3, bz1 - 1, tip, 4, bz1, "cyan", 0.6);
      ribbonWindows(c, tip, 1, bz0, bx1, 1 + bh, bz1, 4, "glass", 0.45, "e");
      flowerBed(c, bx0 + 1, bz1 + 1, bx0 + 8, bz1 + 2, 1, ["pink", "white", "magenta"]);
    }
  }
  // tipping bays with ramp + trucks
  for (let i = 0; i < 1 + (lv >= 3 ? 1 : 0); i++) {
    const dx = bx0 + 2 + i * 7;
    v.box(dx, 1, bz1 - 1, dx + 5, 5, bz1, "steelDark");
    v.box(dx, 0, bz1, dx + 5, 1, hz - 3, "asphaltDark");
    garbageTruck(v, dx + 2, 1, bz1 + 2 + (i % 2), k === 1 ? "red" : "leaf", "white");
  }
  // stack
  const sx = bx1 - 4 + (k === 0 ? -2 : 0);
  const sz = bz0 + 4;
  if (k === 3) {
    const cols = ["red", "orange", "yellow", "lime", "sky", "purple"];
    for (let y = 1; y < stH; y++) v.cylinderY(sx, sz, y, y + 1, 1.6, cols[F((y / stH) * 6) % 6]);
    v.cylinderY(sx, sz, stH, stH + 1, 1.9, "white");
  } else {
    v.cylinderY(sx, sz, 1, stH, k === 0 ? 1.8 : 1.6, k === 2 ? "concreteDark" : k === 1 ? "white" : "silver");
    v.cylinderY(sx, sz, stH, stH + 1, 2, "charcoal");
    if (k === 1) for (let y = 3; y < stH - 2; y += 4) v.cylinderY(sx, sz, y, y + 1, 1.7, y % 8 ? "blue" : "red");
  }
  c.smoke(sx, stH + 2, sz, k === 2 ? "dark" : "smoke");
  if (stH > 20) c.blink(F(sx), stH + 1, F(sz), "red");
  if (k === 1 && lv >= 3) {
    // the golden ball
    const by = F(stH * 0.72);
    v.sphere(sx, by, sz, 4, 3.6, 4, "gold", 0.35);
    for (let a = 0; a < TAU; a += TAU / 10) v.put(F(sx + Math.cos(a) * 3.8), by, F(sz + Math.sin(a) * 3.8), "blue", 0.6);
  }
  if (k === 3 && lv >= 5) {
    v.sphere(sx, stH - 8, sz, 3.5, 3, 3.5, "glass", 0.6);
    v.cylinderY(sx, sz, stH - 9, stH - 8, 3.6, "white");
  }
  if (lv >= 4) {
    // flue-gas cleaning block with ductwork + ash/slag yard
    const fx0 = bx1 + 1;
    const fx1 = hx - 1;
    v.box(fx0, 1, bz0, fx1, 12, bz0 + 9, k === 1 ? "leaf" : k === 3 ? "white" : "steel");
    for (let y = 4; y < 12; y += 4) v.box(fx0, y, bz0, fx1, y + 1, bz0 + 9, "steelDark");
    pipe(v, bx1 - 2, 10, bz0 + 3, fx0 + 1, bz0 + 5, "steelLight", false, 2);
    tank(v, fx0 + 5, bz0 + 13, 1, 8, 3, "silver", "steelLight", k === 1 ? "red" : "steelDark");
    heightfield(v, fx0, hz - 9, fx1, hz - 3, (x, z) => 3 - Math.hypot(x + 0.5 - (fx0 + fx1) / 2, z + 0.5 - (hz - 6)) * 0.7, () => c.pick(["ash", "charcoal", "stone"]));
  }
  if (lv >= 5) {
    if (k === 0) {
      // ski lift line up the slope + climbing wall stripe
      for (let x = bx0 + 2; x < bx1 - 2; x += 6) {
        const top = Math.round(bh - ((x - bx0) * (bh - 4)) / Math.max(1, bx1 - bx0));
        v.box(x, top + 1, bz1 - 3, x + 1, top + 5, bz1 - 2, "steelDark");
      }
      v.box(bx0, 1, bz1 - 1, bx0 + 1, bh, bz1, "orange");
    }
    if (k === 2) stack(c, sx - 6, sz, 1, stH - 6, 1.6, "concreteDark", "red", "dark", true);
    lamp(v, -2, 1, hz - 1, 6);
    flag(v, hx - 3, 1, hz - 4, 9, k === 1 ? ["red", "yellow", "blue"] : ["leaf", "white", "leaf"]);
  }
}

// =============================================================================================
// HYDRO-ELECTRIC — dam wall facing +z with the reservoir upstream (-z), spillway foam & powerhouse.
//  V0 Concrete gravity dam   V1 White curved arch dam
//  V2 Victorian masonry dam with castle valve towers   V3 Grassy earth/rock-fill embankment with glory-hole
// =============================================================================================
function buildHydro(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.1);
  const H = byLvl(lv, [6, 9, 14, 20, 27]);
  const wl = H - 2; // water level
  const tTop = k === 3 ? 3 : 2;
  const tBase = k === 3 ? Math.min(hz, F(H * 0.9) + 3) : k === 1 ? 3 : Math.max(3, F(H * 0.45));
  const zBack = -hz + F(hz * (lv <= 1 ? 0.6 : 0.7));
  const zd = (x: number) => (k === 1 ? zBack - Math.round(4 * (1 - (x / hx) ** 2)) : zBack);
  const thick = (y: number) => Math.max(tTop, Math.round(tBase - ((tBase - tTop) * (y - 1)) / Math.max(1, H - 1)));
  const sw = Math.max(2, Math.min(F(hx * 0.25), 6 + lv)); // spillway half-width
  const bank = lv >= 3 ? 4 : 3;

  // reservoir (single surface layer + back skirt)
  for (let x = -hx; x < hx; x++) {
    const z1 = zd(x);
    v.box(x, wl, -hz, x + 1, wl + 1, z1, "water", 0.08);
    v.box(x, 1, -hz, x + 1, wl, -hz + 1, "waterDeep");
  }
  // tailrace river in front
  const rz0 = zBack + tBase;
  waterPlane(v, -sw - 2, rz0, sw + 2, hz, 0, "water");
  for (let x = -sw - 2; x < sw + 2; x++) for (let z = rz0; z < Math.min(hz, rz0 + 4); z++) if (c.rand() < 0.6) v.put(x, 1, z, "foam", 0.3);
  for (let x = -sw - 2; x < sw + 2; x++) for (let z = rz0 + 4; z < hz; z++) if (c.rand() < 0.1) v.put(x, 0, z, "foam", 0.2);

  // dam wall
  const mat = (x: number, y: number, z: number) => {
    if (k === 0) return x % 6 === 0 ? "concreteDark" : "concrete";
    if (k === 1) return y % 4 === 0 ? "concrete" : "marble";
    if (k === 2) return (F(x / 2) + y) % 2 ? "stone" : "granite";
    return z < zd(x) + 2 ? "stone" : (x + y) % 5 === 0 ? "leaf" : "grass";
  };
  for (let x = -hx; x < hx; x++) {
    const inSpill = Math.abs(x + 0.5) < sw && k !== 3;
    const top = inSpill ? H - 2 : H;
    for (let y = 1; y <= top; y++) {
      const t = thick(y);
      const z0 = zd(x);
      for (let z = z0; z < z0 + t; z++) {
        const front = z === z0 + t - 1;
        if (inSpill && front) v.put(x, y, z, (y + x) % 3 === 0 ? "water" : "foam", 0.35);
        else v.put(x, y, z, mat(x, y, z));
      }
      // spillway steps: also cover the top step
      if (inSpill && y === top) for (let z = z0; z < z0 + t; z++) v.put(x, y, z, "water", 0.2);
    }
    // parapet road on top
    if (!inSpill) {
      const z0 = zd(x);
      v.box(x, H + 1, z0, x + 1, H + 2, z0 + 1, k === 2 ? "granite" : "concreteDark");
      v.box(x, H + 1, z0 + thick(H) - 1, x + 1, H + 2, z0 + thick(H), k === 2 ? "granite" : "concreteDark");
      if (k !== 3) for (let z = z0 + 1; z < z0 + thick(H) - 1; z++) v.put(x, H, z, "asphalt");
    }
  }
  // spillway bridge piers
  if (k !== 3) {
    for (let x = -sw; x <= sw; x += Math.max(3, F(sw / 2))) {
      const z0 = zd(x);
      v.box(x, H - 1, z0, x + 1, H + 2, z0 + thick(H), k === 2 ? "granite" : "concreteDark");
    }
    for (let x = -sw; x < sw; x++) v.put(x, H + 1, zd(x) + 1, "steelDark");
  }
  // banks
  for (const [bx0, bx1] of [[-hx, -hx + bank], [hx - bank, hx]] as [number, number][]) {
    heightfield(v, bx0, -hz, bx1, hz, (x, z) => {
      const zf = zBack + thick(1);
      const base = z < zf ? H + 1 : H + 1 - (z - zf) * 1.2;
      const edge = Math.min(x - (-hx), hx - 1 - x);
      return Math.max(1, base - Math.max(0, edge - bank + 2) * 2);
    }, (_x, y, _z, top) => (top ? (k === 2 ? "moss" : "grass") : y % 3 === 0 ? "granite" : "stone"));
  }

  // powerhouse at the foot, right of the river
  const px0 = sw + 3;
  const px1 = Math.min(hx - bank, px0 + byLvl(lv, [6, 8, 10, 12, 14]));
  const pz0 = rz0;
  const pz1 = Math.min(hz - 1, pz0 + 6);
  if (lv === 1) {
    // stone mill house + water wheel turning in the race
    const wall = ["stone", "cream", "granite", "woodLight"][k];
    v.hollowBox(px0, 1, pz0, px1, 6, pz1, wall);
    gable(v, px0 - 1, 6, pz0 - 1, px1 + 1, pz1 + 1, "x", k === 1 ? "terracotta" : "slate");
    door(v, px0 + 2, 1, pz1 - 1, "woodDark");
    const wh = new PixelVox(3);
    for (let a = 0; a < TAU; a += 0.15) {
      wh.put(0, F(Math.cos(a) * 4), F(Math.sin(a) * 4), "woodDark");
      wh.put(1, F(Math.cos(a) * 4), F(Math.sin(a) * 4), "woodDark");
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      for (let t = 0; t <= 5; t += 0.5) wh.put(0, F(Math.cos(a) * t), F(Math.sin(a) * t), t > 3.5 ? "wood" : "woodDark");
      wh.put(1, F(Math.cos(a) * 5), F(Math.sin(a) * 5), "wood");
    }
    c.addRotor({ vox: wh, pivot: [px0 - 2, 4, F((pz0 + pz1) / 2)], axis: "x", speed: 1.2 });
  } else {
    const wall = ["concrete", "white", "brick", "concrete2"][k];
    const ph = byLvl(lv, [5, 6, 7, 8, 9]);
    v.hollowBox(px0, 1, pz0, px1, ph, pz1, wall);
    windows(c, px0, 1, pz0, px1, ph, pz1, { stepH: 2, h: 2, startY: 1, emit: 0.5, faces: "sw" });
    if (k === 2) gable(v, px0 - 1, ph, pz0 - 1, px1 + 1, pz1 + 1, "x", "slate", "cream");
    else flatRoof(c, px0, ph, pz0, px1, pz1, "concreteDark", wall, true);
    // penstocks from dam face down to the powerhouse
    for (let i = 0; i < Math.min(lv, 3); i++) {
      const xx = px0 + 1 + i * 3;
      const z0 = zd(xx);
      for (let y = H - 3; y > 2; y--) {
        const z = z0 + thick(y) + F((H - 3 - y) * 0.15);
        if (z >= pz0) break;
        v.box(xx, y, z, xx + 2, y + 1, z + 1, "steelDark");
      }
    }
    // outflow foam from turbine draft tubes
    for (let x = px0; x < px1; x += 3) v.put(x, 1, pz1, "foam", 0.4);
  }
  // left-side: transformers or trees
  const lx0 = -hx + bank;
  if (lv >= 3) {
    substation(c, lx0, rz0 + 1, Math.min(-sw - 3, lx0 + 12), Math.min(hz - 1, rz0 + 10), 6);
  } else {
    tree(v, -hx + bank + 2, 1, hz - 3, "pine", 0.9);
    tree(v, -hx + bank + 5, 1, hz - 5, "round", 0.8, 1);
  }
  if (lv >= 2 && k !== 3) {
    // sluice-gate hoists on the crest
    for (let x = -sw + 1; x < sw - 1; x += 4) {
      const z0 = zd(x);
      v.box(x, H + 2, z0, x + 2, H + 4, z0 + 2, "hazard");
    }
  }
  if (k === 3 && lv >= 3) {
    // morning-glory spillway in the reservoir
    const gx = 0;
    const gz = zd(0) - 6;
    ring(v, gx, gz, wl - 1, wl + 1, 3.6, 2.2, "concrete");
    v.cylinderY(gx, gz, wl, wl + 1, 2.2, "black");
    ring(v, gx, gz, wl + 1, wl + 2, 2.3, 1.5, "foam", 0.5);
    // outlet foam in front
    v.box(-2, 1, rz0, 2, 3, rz0 + 2, "foam", 0.5);
  }
  if (k === 2 && lv >= 3) {
    // Victorian valve towers
    for (const tx of [-sw - 3, sw + 1]) {
      const z0 = zd(tx);
      v.box(tx, 1, z0 - 3, tx + 3, H + 6, z0, "granite");
      for (let x = tx; x < tx + 3; x += 2) v.put(x, H + 6, z0 - 3, "granite");
      v.cone(tx + 1.5, H + 6, H + 10, z0 - 1.5, 2.2, 0.5, "slate");
      v.put(tx + 1, H + 3, z0, "warmGlow", 0.6);
    }
  }
  if (lv >= 4) {
    // intake towers + cars on the crest + pylon
    if (k !== 2 && k !== 3) {
      for (const tx of [-sw - 4, sw + 3]) {
        const z0 = zd(tx);
        v.box(tx, wl - 1, z0 - 4, tx + 3, H + 5, z0 - 1, "concrete");
        v.box(tx, H + 5, z0 - 4, tx + 3, H + 6, z0 - 1, "steelDark");
      }
    }
    if (k !== 3) {
      car(v, -hx + bank + 3, H + 1, zd(-hx + bank + 3) + 1, "x", "red");
      car(v, hx - bank - 8, H + 1, zd(hx - bank - 8) + 1, "x", "sky");
    }
    pylon(v, hx - 3, hz - 4, 20 + lv * 2);
    c.blink(hx - 3, 21 + lv * 2, hz - 4, "red");
  }
  if (lv >= 5) {
    // visitor lookout & flags
    v.box(-hx + 1, H + 1, zBack - 6, -hx + 5, H + 6, zBack - 2, "white");
    v.box(-hx + 1, H + 3, zBack - 6, -hx + 5, H + 5, zBack - 2, "glass", 0.5);
    flag(v, -hx + 6, H + 2, zBack - 3, 8, ["blue", "white", "blue"]);
    c.blink(0, H + 3, zd(0), "amber");
  }
}

// =============================================================================================
// GEOTHERMAL — steam wells & pipelines that sprawl into a steaming valley complex.
//  V0 Icelandic lava field (black rock, moss, milky-blue lagoon)  V1 Yellowstone mineral terraces (orange/yellow)
//  V2 Volcanic (glowing lava cracks, sci-fi domes)                 V3 Snowy highlands (snow, teal hot pools)
// =============================================================================================
function wellhead(c: Ctx, x: number, z: number, vcol: string): void {
  const v = c.v;
  v.box(x - 1, 1, z - 1, x + 2, 2, z + 2, "concreteDark");
  v.box(x, 2, z, x + 1, 6, z + 1, "steelLight");
  v.box(x - 1, 3, z, x + 2, 4, z + 1, vcol);
  v.box(x, 5, z - 1, x + 1, 6, z + 2, vcol);
  v.put(x, 6, z, "steelDark");
}

function buildGeothermal(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  const g = ["basalt", "sand", "basalt", "snow"][k];
  lot(c, g);
  const spk = ["moss", "orange", "lava", "white"][k];
  for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) {
    const r = c.rand();
    if (r < (k === 2 ? 0.05 : 0.18)) v.put(x, 0, z, spk, k === 2 ? 0.9 : 0);
    else if (k === 0 && r < 0.3) v.put(x, 0, z, "ash");
    else if (k === 1 && r < 0.3) v.put(x, 0, z, "yellow");
  }
  if (k === 2) {
    // lava cracks
    for (let i = 0; i < 2 + lv; i++) {
      let x = c.ri(-hx + 2, hx - 3);
      let z = c.ri(-hz + 2, hz - 3);
      for (let s = 0; s < 8; s++) {
        v.put(x, 0, z, "lava", 1.3);
        x = clamp(x + c.ri(-1, 1), -hx, hx - 1);
        z = clamp(z + 1, -hz, hz - 1);
      }
    }
  }
  const vcol = ["red", "orange", "hazard", "red"][k];
  const pipeC = ["silver", "silver", "steelLight", "silver"][k];
  // fumarole mound with steam
  const fx = -hx + 4;
  const fz = -hz + 4;
  heightfield(v, fx - 4, fz - 4, fx + 4, fz + 4, (x, z) => 3 - Math.hypot(x + 0.5 - fx, z + 0.5 - fz) * 0.8, (_x, _y, _z, top) => (top ? (k === 1 ? "yellow" : k === 3 ? "white" : "ash") : "basalt"));
  v.put(fx, 3, fz, "white");
  c.smoke(fx, 4, fz, "steam");

  // wells
  const nWells = byLvl(lv, [1, 2, 3, 4, 6]);
  const wells: [number, number][] = [];
  for (let i = 0; i < nWells; i++) {
    const x = -hx + 9 + (i % 3) * 10;
    const z = -hz + 3 + F(i / 3) * 8;
    if (x > hx - 3) continue;
    wellhead(c, x, z, vcol);
    wells.push([x, z]);
  }
  if (lv <= 2) {
    // little hot pool by the vent
    v.cylinderY(fx + 3, fz + 7, 0, 1, 2.2, k === 1 ? "#5fc8c0" : "#9ad7e0", 0.3);
    ring(v, fx + 3, fz + 7, 0, 1, 3, 2.2, k === 1 ? "orange" : k === 3 ? "white" : "ash");
    c.smoke(fx + 3, 1, fz + 7, "steam");
  }
  // silencer (steam muffler) at Lv1
  const sx = hx - 4;
  const sz = hz - 5;
  v.cylinderY(sx, sz, 1, 6, 2.2, "woodDark");
  v.cylinderY(sx, sz, 6, 7, 2.4, "steelDark");
  c.smoke(sx, 8, sz, "steam");
  // pipelines with expansion loops (along x at a fixed z) toward the plant
  const pz = lv >= 2 ? -hz + 11 : 0;
  if (wells.length) {
    pipe(v, wells[0][0], 3, pz, hx - 2, pz + 1, pipeC, true, 1);
    for (const [wx, wz] of wells) pipe(v, wx, 3, Math.min(wz, pz), wx + 1, Math.max(wz, pz) + 1, pipeC, true, 1);
    // expansion loop
    const lx = F((wells[0][0] + hx) / 2);
    v.box(lx, 3, pz, lx + 1, 7, pz + 1, pipeC);
    v.box(lx + 4, 3, pz, lx + 5, 7, pz + 1, pipeC);
    v.box(lx, 7, pz, lx + 5, 8, pz + 1, pipeC);
    v.box(lx + 1, 3, pz, lx + 4, 4, pz + 1, null);
  }
  if (lv >= 2) {
    // turbine shed
    const wall = ["white", "cream", "steelLight", "red"][k];
    const tx0 = -hx + 1;
    const tz0 = hz - 9;
    const tx1 = Math.min(hx - 6, tx0 + byLvl(lv, [0, 9, 12, 14, 16]));
    v.hollowBox(tx0, 1, tz0, tx1, 7, hz - 2, wall);
    windows(c, tx0, 1, tz0, tx1, 7, hz - 2, { stepH: 3, startY: 3, emit: 0.45, faces: "se" });
    if (k === 2) barrelRoof(v, tx0, 7, tz0, tx1, hz - 2, "x", "steel", "cyan");
    else gable(v, tx0 - 1, 7, tz0 - 1, tx1 + 1, hz - 1, "x", k === 3 ? "slate" : "steelDark", "white");
    pipe(v, tx1 - 2, 3, pz, tx1 - 1, tz0, pipeC, true, 1);
  }
  if (lv >= 3) {
    // cooling towers (mechanical, with spinning fan) + separator tanks
    const nC = lv >= 4 ? 2 : 1;
    for (let i = 0; i < nC; i++) {
      const cx = hx - 6 - i * 9;
      const cz = -hz + 5;
      v.box(cx - 3, 1, cz - 3, cx + 4, 8, cz + 4, k === 2 ? "steelDark" : "concrete2");
      for (let y = 2; y < 8; y += 2) v.box(cx - 3, y, cz + 3, cx + 4, y + 1, cz + 4, "steel");
      ring(v, cx + 0.5, cz + 0.5, 8, 10, 3, 2, "concrete");
      c.addRotor({ vox: fanRotor(2, "charcoal", 5), pivot: [cx + 1, 9, cz + 1], axis: "y", speed: 2.5 });
      c.smoke(cx, 11, cz, "steam");
    }
    tank(v, hx - 4, 2, 1, 6, 2, "silver", "steelLight", vcol);
    // tall cyclone separator towers
    for (let i = 0; i < lv - 2; i++) {
      const tx = -hx + 14 + i * 5;
      tank(v, tx, -hz + 15, 1, 14, 1.8, "silver", "steelLight", vcol);
      c.smoke(tx, 18, -hz + 15, "steam");
    }
  }
  if (lv >= 4) {
    // hot lagoon
    const lx0 = -hx + 2;
    const lz0 = -hz + 12 + (lv >= 5 ? 0 : 0);
    const lcol = ["#9ad7e0", "#5fc8c0", "#58d0f0", "cyan"][k];
    const lr = lv >= 5 ? 6 : 4;
    const lcx = lx0 + lr + 1;
    const lcz = lz0 + lr;
    for (let x = lcx - lr - 1; x <= lcx + lr; x++) for (let z = lcz - lr - 1; z <= lcz + lr; z++) {
      const d = Math.hypot(x + 0.5 - lcx, z + 0.5 - lcz);
      if (d <= lr) v.put(x, 1, z, lcol, 0.35);
      else if (d <= lr + 1) v.put(x, 1, z, k === 1 ? "orange" : k === 3 ? "white" : "basalt");
    }
    c.smoke(lcx, 2, lcz, "steam");
    if (lv >= 5) {
      person(v, lcx - 1, 1, lcz, "pink");
      person(v, lcx + 2, 1, lcz - 2, "sky");
    }
  }
  if (lv >= 5) {
    // geodesic greenhouse domes + geyser
    const dcol = k === 2 ? "cyan" : "glass";
    for (let i = 0; i < 2; i++) {
      const dx = hx - 6 - i * 9;
      const dz = hz - 13;
      v.dome(dx, 1, dz, 4.6, dcol, 0.4);
      v.dome(dx, 1, dz, 3.6, "leaf");
      tree(v, dx, 1, dz, "palm", 0.7);
      for (let a = 0; a < TAU; a += TAU / 8) v.box(F(dx + Math.cos(a) * 4.2), 1, F(dz + Math.sin(a) * 4.2), F(dx + Math.cos(a) * 4.2) + 1, 4, F(dz + Math.sin(a) * 4.2) + 1, "white");
    }
    // geyser column
    const gx = -hx + 3;
    const gz = hz - 12;
    ring(v, gx, gz, 1, 2, 2.4, 1.2, k === 1 ? "orange" : "white");
    for (let y = 2; y < 24; y++) {
      const r = 0.6 + (y > 16 ? (y - 16) * 0.35 : 0);
      v.cylinderY(gx, gz, y, y + 1, r, y % 3 ? "foam" : "white", 0.5);
    }
    c.smoke(gx, 24, gz, "steam");
    c.smoke(gx, 12, gz, "steam");
    flag(v, 0, 1, hz - 1, 8, k === 0 ? ["blue", "white", "red"] : ["orange", "white", "orange"]);
  }
}

// =============================================================================================
// MICRO REACTOR — sleek modular reactor pods; a single pod grows into a micro-grid campus.
//  V0 White capsules with cyan glow rings   V1 Military containerised (olive trailers, radiator fins)
//  V2 Underground silos (grass berm, glowing glass hatches)  V3 Pebble-bed spheres with violet glow
// =============================================================================================
function microPod(c: Ctx, x: number, z: number, h: number, k: number): void {
  const v = c.v;
  if (k === 0) {
    v.cylinderY(x, z, 1, 2, 3.4, "steelLight");
    v.cylinderY(x, z, 2, 2 + h, 2.6, "white");
    v.dome(x, 2 + h, z, 2.6, "white");
    for (let y = 4; y < 2 + h; y += 4) v.cylinderY(x, z, y, y + 1, 2.7, "cyan", 1.2);
    v.put(F(x), 3 + h + 2, F(z), "cyan", 1.5);
    // fins
    for (const [dx, dz] of [[-4, 0], [3, 0], [0, -4], [0, 3]]) v.box(F(x) + dx, 2, F(z) + dz, F(x) + dx + 1, 2 + F(h * 0.7), F(z) + dz + 1, "silver");
  } else if (k === 1) {
    const x0 = F(x) - 6;
    const z0 = F(z) - 2;
    v.box(x0, 1, z0, x0 + 12, 2, z0 + 5, "charcoal");
    for (const wx of [x0 + 1, x0 + 9]) v.box(wx, 1, z0 - 1, wx + 2, 2, z0 + 6, "rubber");
    v.box(x0, 2, z0, x0 + 12, 6, z0 + 5, "oliveDrab");
    v.box(x0, 4, z0, x0 + 12, 5, z0 + 5, "camoTan");
    for (let xx = x0 + 1; xx < x0 + 11; xx += 2) v.box(xx, 6, z0, xx + 1, 8, z0 + 5, "steelDark");
    v.put(x0 + 11, 3, z0 + 4, "screenGreen", 1.2);
    v.put(x0 + 10, 3, z0 + 4, "hazard", 0.6);
  } else if (k === 2) {
    v.cylinderY(x, z, 0, 2, 3.6, "concrete");
    v.cylinderY(x, z, 1, 2, 2.6, "cyan", 1.6);
    v.dome(x, 2, z, 2.6, "glass", 0.6);
    ring(v, x, z, 2, 3, 3.6, 2.6, "steelLight");
    v.put(F(x) + 3, 3, F(z), "hazard", 0.5);
  } else {
    for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(F(x) + dx, 1, F(z) + dz, F(x) + dx + 1, 4, F(z) + dz + 1, "steelDark");
    v.sphere(x, 4 + h * 0.35, z, 3.4, 3.4, 3.4, "white");
    v.cylinderY(x, z, F(4 + h * 0.35), F(4 + h * 0.35) + 1, 3.5, "purple", 1.3);
    v.put(F(x), F(4 + h * 0.35 + 3.4), F(z), "magenta", 1.4);
  }
}

function buildMicroReactor(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, k === 2 ? "grass" : k === 1 ? "concrete2" : "concrete");
  if (k === 2) speckle(c, "grass3", 0.12);
  else speckle(c, "concreteDark", 0.05);
  const glow = ["cyan", "screenGreen", "cyan", "purple"][k];
  const n = byLvl(lv, [1, 1, 2, 4, 4]);
  const h = byLvl(lv, [7, 8, 9, 10, 10]);
  const spots: [number, number][] =
    n === 1 ? [[-1, -2]] : n === 2 ? [[-hx + 7, -1], [hx - 7, -1]] : [[-hx + 7, -hz + 7], [hx - 7, -hz + 7], [-hx + 7, hz - 8], [hx - 7, hz - 8]];
  // pad & glowing walkway grid
  for (const [x, z] of spots) {
    v.box(x - 5, 0, z - 5, x + 5, 1, z + 5, k === 2 ? "concreteDark" : "white");
    ring(v, x, z, 0, 1, 5, 4.2, glow, 0.8);
  }
  for (const [x, z] of spots) microPod(c, x, z, h, k);
  if (lv >= 2) {
    // control module
    const cx0 = lv === 2 ? hx - 6 : -3;
    const cz0 = lv === 2 ? hz - 5 : lv >= 4 ? -3 : hz - 6;
    v.box(cx0, 1, cz0, cx0 + 6, 4, cz0 + 4, k === 1 ? "oliveDrab" : "white");
    v.box(cx0, 3, cz0 + 3, cx0 + 6, 4, cz0 + 4, glow, 0.9);
    v.box(cx0 + 1, 2, cz0 + 3, cx0 + 5, 3, cz0 + 4, "glassDark", 0.3);
    if (k === 1) v.box(cx0 + 2, 4, cz0 + 1, cx0 + 3, 9, cz0 + 2, "steelDark");
    if (k === 1) c.blink(cx0 + 2, 9, cz0 + 1, "red");
  }
  if (lv >= 3) {
    securityFence(v, -hx, -hz, hx, hz, 1, 3, [-3, 3]);
    v.box(-hx + 1, 0, hz - 2, hx - 1, 1, hz - 1, glow, 0.5);
  }
  if (lv >= 4) {
    // cable trays connecting pods to the hub
    for (const [x, z] of spots) {
      const sxx = Math.sign(-x);
      for (let xx = x; xx !== 0; xx += sxx) v.put(xx, 1, z, glow, 0.7);
    }
  }
  if (lv >= 5) {
    // central glowing core spire with an orbiting ring
    v.cylinderY(0, 0, 4, 6, 2.6, "white");
    v.cone(0, 6, 32, 0, 2.2, 0.6, "white");
    v.cylinderY(0, 0, 10, 26, 1.4, glow, 1.6);
    v.box(-1, 32, -1, 1, 35, 1, glow, 1.8);
    c.blink(-1, 35, -1, glow === "screenGreen" ? "lime" : "cyan");
    const ringV = new PixelVox(4);
    for (let a = 0; a < TAU; a += 0.06) {
      ringV.put(F(Math.cos(a) * 6), 0, F(Math.sin(a) * 6), glow, 1.4);
      if (Math.sin(a * 3) > 0.6) ringV.put(F(Math.cos(a) * 6), 1, F(Math.sin(a) * 6), "white");
    }
    c.addRotor({ vox: ringV, pivot: [0, 22, 0], axis: "y", speed: 1.2 });
    const ring2 = new PixelVox(6);
    for (let a = 0; a < TAU; a += 0.08) ring2.put(F(Math.cos(a) * 3.5), F(Math.sin(a) * 3.5), 0, "white", 0.6);
    c.addRotor({ vox: ring2, pivot: [0, 18, 0], axis: "x", speed: 0.9 });
  }
  if (lv <= 2) hazardSign(v, -hx + 2, hz - 2, 2);
}

// =============================================================================================
// NUCLEAR POWER PLANTS — reactor domes + hyperboloid cooling towers that SPRAWL into a giant complex.
//  V0 Classic western (white domes, red-banded towers)   V1 French (bare concrete cylinders, huge towers)
//  V2 Soviet VVER (box reactor halls, striped vent stack)  V3 Futuristic (glass domes, cyan glow towers)
// =============================================================================================
function reactorBuilding(c: Ctx, x: number, z: number, r: number, h: number, k: number): void {
  const v = c.v;
  if (k === 2) {
    const s = F(r) + 1;
    v.hollowBox(x - s, 1, z - s, x + s, h + 2, z + s, "concrete");
    for (let y = 4; y < h + 2; y += 4) v.box(x - s, y, z - s, x + s, y + 1, z + s, "white");
    v.box(x - s, h + 1, z - s, x + s, h + 2, z + s, "red");
    flatRoof(c, x - s, h + 2, z - s, x + s, z + s, "concreteDark", "concrete", false);
    v.box(x - 1, h + 3, z - 1, x + 2, h + 5, z + 2, "steelLight");
  } else {
    const wall = ["white", "concrete", "", "white"][k];
    v.cylinderY(x, z, 1, h, r, wall);
    if (k === 1) {
      v.cylinderY(x, z, h, h + 1, r, "concreteDark");
      v.dome(x, h, z, r * 0.7, "concrete");
    } else if (k === 3) {
      v.dome(x, h, z, r, "glass", 0.5);
      v.dome(x, h, z, r - 2, "cyan", 1.2);
      v.cylinderY(x, z, h - 1, h, r + 0.2, "cyan", 1.2);
    } else {
      v.dome(x, h, z, r, "white");
      v.cylinderY(x, z, h - 2, h - 1, r + 0.1, "red");
    }
    v.box(F(x) - 1, 1, F(z + r) - 1, F(x) + 1, 4, F(z + r) + 1, "steelDark");
  }
}

function buildNuclear(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const k = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.1);
  // paved plant island
  v.box(-hx + 1, 0, -hz + 1, hx - 1, 1, hz - 1, "concrete2");
  const nT = byLvl(lv, [1, 2, 2, 3, 4]);
  const nR = byLvl(lv, [1, 1, 2, 2, 3]);
  const tR = byLvl(lv, [6, 6.5, 7, 7.5, 7.5]);
  const tH = byLvl(lv, [26, 30, 34, 38, 42]);
  const towerCol = ["concrete", "concrete2", "concrete", "white"][k];
  const band = ["red", "", "white", "cyan"][k];
  // towers along the back
  const tz = -hz + Math.ceil(tR) + 1;
  for (let i = 0; i < nT; i++) {
    const tx = -hx + ((i + 0.5) * (2 * hx)) / nT;
    cTower(v, tx, tz, 1, tH, tR, towerCol, band);
    if (k === 3) v.cylinderY(tx, tz, 1, 2, tR + 0.4, "cyan", 1);
    c.smoke(F(tx), tH + 2, tz, "steam");
    c.smoke(F(tx) + 2, tH + 3, tz - 1, "steam");
  }
  // reactors in the middle row
  const rr = byLvl(lv, [4, 4.5, 4.5, 5, 5]);
  const rh = byLvl(lv, [10, 12, 13, 14, 15]);
  const rz = tz + Math.ceil(tR) + Math.ceil(rr) + 2;
  const step = (2 * hx - 18) / nR;
  for (let i = 0; i < nR; i++) {
    const rx = -hx + 4 + Math.ceil(rr) + i * step;
    reactorBuilding(c, rx, rz, rr, rh, k);
  }
  // turbine hall in front of reactors
  const thz0 = rz + Math.ceil(rr) + 2;
  const thz1 = Math.min(hz - 4, thz0 + 7);
  if (thz1 - thz0 >= 4) {
    const tx0 = -hx + 2;
    const tx1 = Math.min(hx - 2, tx0 + nR * step + 6);
    const wall = ["white", "concrete", "concrete", "white"][k];
    v.hollowBox(tx0, 1, thz0, tx1, 9, thz1, wall);
    ribbonWindows(c, tx0, 1, thz0, tx1, 9, thz1, 3, k === 3 ? "cyan" : "glass", 0.5, "se");
    flatRoof(c, tx0, 9, thz0, tx1, thz1, "concreteDark", wall, true);
    v.box(tx0, 7, thz1 - 1, tx0 + 10, 8, thz1, k === 3 ? "cyan" : ["blue", "sky", "red", "cyan"][k], 0.6);
  }
  // Soviet vent stack / western control tower etc.
  if (k === 2) {
    const sx = hx - 5;
    const sz = rz;
    for (let y = 1; y < tH + 6; y++) v.cylinderY(sx, sz, y, y + 1, y < 4 ? 2 : 1.2, F(y / 5) % 2 ? "red" : "white");
    c.blink(sx, tH + 6, sz, "red");
  }
  // perimeter security
  securityFence(v, -hx, -hz, hx, hz, 1, 3, [-3, 3]);
  v.box(-3, 0, hz - 1, 3, 1, hz, "asphalt");
  hazardSign(v, 4, hz - 2, 3);
  // switchyard on the right front
  if (lv >= 2) {
    substation(c, hx - 14, hz - 13, hx - 2, hz - 3, 7);
  }
  if (lv >= 4) {
    pylon(v, hx - 4, rz, 26);
    c.blink(hx - 4, 27, rz, "red");
    // water intake/cooling canal on the left front
    waterPlane(v, -hx + 1, hz - 4, -6, hz - 1, 0, "water");
  }
  if (lv >= 5) {
    // helipad + visitor centre + beacons on towers
    helipad(v, -hx + 7, 1, hz - 9, 4);
    officeBox(c, 4, hz - 12, 14, hz - 5, 4, "white", k === 3 ? "cyan" : "glass");
    for (let i = 0; i < nT; i++) c.blink(F(-hx + ((i + 0.5) * (2 * hx)) / nT), tH + 1, F(tz - tR * 0.62), "red");
    flag(v, 1, 1, hz - 6, 10, ["blue", "white", "red"]);
  }
  if (lv === 1) {
    person(v, 0, 1, hz - 3, "white", "white");
  }
}

defineDesigns({
  trash_burning_plants: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Backyard Incinerator", "Tipping-Hall Incinerator", "Waste-to-Energy Plant", "WtE Plant with Scrubbers", "Landmark Energy Mountain"],
    growth: "A smoky furnace shed becomes a tipping-hall plant with an ever-taller stack, then gas cleaning and an iconic landmark roof or tower.",
    build: buildTrashBurning,
  },
  hydro_electric_power_plants: {
    footprints: [[2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    levels: ["Water-Wheel Weir", "Run-of-River Weir", "Gravity Dam", "Great Dam & Intakes", "Mega Dam Spillway"],
    growth: "A low weir with a water wheel rises into an ever higher, wider dam with a foaming spillway, penstocks, switchyard and lookout.",
    build: buildHydro,
  },
  geothermal_power_plants: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Steam Vent Wellhead", "Geothermal Pilot Plant", "Geothermal Station", "Hot-Lagoon Power Plant", "Geothermal Valley Complex"],
    growth: "One steaming wellhead becomes a field of wells and looping pipelines, cooling fans, a hot lagoon, domes and an erupting geyser.",
    build: buildGeothermal,
  },
  micro_reactor_nuclear: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Reactor Pod", "Pod & Control Module", "Twin-Pod Array", "Modular Reactor Campus", "Micro-Grid Core Hub"],
    growth: "One glowing pod gains a control module, then twins and a four-pod campus around a spinning-ring core spire.",
    build: buildMicroReactor,
  },
  nuclear_power_plants: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Research Reactor", "Twin-Tower Station", "Nuclear Generating Station", "Triple-Tower Power Station", "Gigawatt Nuclear Complex"],
    growth: "Adds cooling towers, reactor domes, a turbine hall and switchyard each level, ending in a 4-tower complex with helipad.",
    build: buildNuclear,
  },
});
