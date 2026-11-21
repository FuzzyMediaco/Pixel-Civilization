import {
  type Ctx,
  PixelVox,
  barrelRoof,
  bench,
  bush,
  car,
  clockFace,
  door,
  flag,
  flatRoof,
  flowerBed,
  fountain,
  gable,
  hip,
  lamp,
  lot,
  person,
  ring,
  sawtooth,
  solarRow,
  speckle,
  tank,
  tree,
  windows,
  acUnit,
} from "./kit";
import { defineDesigns } from "./registry";

// =============================================================================================
// Local helpers: vehicles, track, lettering
// =============================================================================================

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "white", "lime", "crimson"];
const PANTS = ["blueDark", "charcoal", "woodDark", "sand", "slate"];

function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, y = 1): void {
  for (let i = 0; i < n; i++) person(c.v, c.ri(x0, x1 - 1), y, c.ri(z0, z1 - 1), c.pick(SHIRTS), c.pick(PANTS));
}

const GLYPHS: Record<string, string[]> = {
  T: ["111", "010", "010", "010", "010"],
  A: ["010", "101", "111", "101", "101"],
  X: ["101", "101", "010", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  B: ["110", "101", "110", "101", "110"],
  U: ["101", "101", "101", "101", "111"],
  S: ["111", "100", "111", "001", "111"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  R: ["110", "101", "110", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  C: ["111", "100", "100", "100", "111"],
  E: ["111", "100", "110", "100", "111"],
  H: ["101", "101", "111", "101", "101"],
};

/** Flat text on a z-plane, centred on cx; returns width */
function textZ(v: PixelVox, txt: string, cx: number, yTop: number, z: number, col: string, emit = 0.9): number {
  const w = txt.length * 4 - 1;
  let x = Math.round(cx - w / 2);
  for (const ch of txt) {
    const g = GLYPHS[ch];
    if (g) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") v.put(x + k, yTop - r, z, col, emit);
    x += 4;
  }
  return w;
}

/** Bus centred at (x,z). Length 12 along axis, width 4, height 4 (8 if double-decker). */
function bus(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z", body: string, stripe: string, double = false, roofCol = "white"): void {
  const L = 6;
  const W = 2;
  const H = double ? 8 : 4;
  const B = (a0: number, y0: number, b0: number, a1: number, y1: number, b1: number, col: string, e = 0) => {
    if (axis === "x") v.box(x + a0, y + y0, z + b0, x + a1, y + y1, z + b1, col, e);
    else v.box(x + b0, y + y0, z + a0, x + b1, y + y1, z + a1, col, e);
  };
  B(-L, 1, -W, L, H, W, body);
  B(-L, 0, -W + 1, L, 1, W - 1, "charcoal");
  for (const a of [-L + 2, L - 3]) {
    B(a, 0, -W, a + 1, 1, -W + 1, "rubber");
    B(a, 0, W - 1, a + 1, 1, W, "rubber");
  }
  B(-L, 1, -W, L, 2, W, stripe);
  B(-L + 1, 2, -W, L - 1, 3, W, "glass", 0.35);
  if (double) {
    B(-L + 1, 5, -W, L - 1, 6, W, "glass", 0.35);
    B(-L, 4, -W, L, 5, W, stripe);
  }
  B(L - 1, 2, -W + 0, L, H - 1, W, "glassDark", 0.2); // windscreen
  B(L - 1, 1, -W, L, 2, -W + 1, "warmGlow", 0.9);
  B(L - 1, 1, W - 1, L, 2, W, "warmGlow", 0.9);
  B(-L + 1, H, -W + 1, L - 2, H + 1, W - 1, roofCol);
  B(L - 1, H - 1, -1, L, H, 1, "screenGreen", 0.8); // destination board
}

/** Taxi cab (5 long x 2 wide) centred at (x,z): yellow body, checker belt, glowing roof sign */
function taxi(v: PixelVox, x: number, y: number, z: number, axis: "x" | "z" = "x", col = "yellow", lamp2 = "warmGlow"): void {
  const B = (a0: number, y0: number, b0: number, a1: number, y1: number, b1: number, cc: string, e = 0) => {
    if (axis === "x") v.box(x + a0, y + y0, z + b0, x + a1, y + y1, z + b1, cc, e);
    else v.box(x + b0, y + y0, z + a0, x + b1, y + y1, z + a1, cc, e);
  };
  B(-2, 0, -1, 3, 1, 1, col);
  for (let k = -2; k < 3; k++) if (k & 1) B(k, 0, -1, k + 1, 1, 1, "charcoal");
  B(-2, 1, -1, 3, 2, 1, col);
  B(-1, 1, -1, 2, 2, 1, "glassDark", 0.15);
  B(-1, 2, -1, 2, 3, 1, col);
  B(0, 3, -1, 1, 4, 1, lamp2, 1.1);
  B(2, 0, -1, 3, 1, 1, "warmGlow", 0.6);
}

/** Track along x centred at z (ballast, sleepers, two rails). Rail top at y=1. */
function trackX(v: PixelVox, x0: number, x1: number, z: number, ballast = "stone"): void {
  v.box(x0, 0, z - 3, x1, 1, z + 3, ballast);
  for (let x = x0; x < x1; x += 2) v.box(x, 0, z - 3, x + 1, 1, z + 3, "woodDark");
  v.box(x0, 1, z - 2, x1, 2, z - 1, "steelLight");
  v.box(x0, 1, z + 1, x1, 2, z + 2, "steelLight");
}

type TrainKind = "steam" | "diesel" | "electric" | "heritage";

/** Train along x from x0 to x1 (locomotive at the x1 end), sitting on a track centred at z */
function train(v: PixelVox, x0: number, x1: number, z: number, kind: TrainKind, body: string, stripe: string, c?: Ctx): void {
  const y = 2;
  const W = 2;
  const carLen = kind === "heritage" ? 7 : 10;
  const locoLen = kind === "electric" ? 10 : 8;
  const lx0 = x1 - locoLen;
  // loco
  if (kind === "steam") {
    v.box(lx0, y, z - W, x1, y + 1, z + W, "charcoal");
    v.box(lx0, y + 1, z - W, lx0 + 3, y + 6, z + W, "black"); // cab
    v.box(lx0, y + 4, z - W, lx0 + 3, y + 5, z + W, "glassDark");
    v.box(lx0, y + 6, z - W - 1 + 1, lx0 + 3, y + 7, z + W, "redDark");
    for (let x = lx0 + 3; x < x1; x++) for (let dy = 1; dy <= 3; dy++) for (let dz = -W + (dy === 3 ? 1 : 0); dz < W - (dy === 3 ? 1 : 0); dz++) v.put(x, y + dy, z + dz, "black");
    v.box(lx0 + 3, y + 2, z - W, x1, y + 3, z + W, "red");
    v.box(x1 - 2, y + 4, z - 1, x1 - 1, y + 7, z, "black"); // chimney
    v.box(lx0 + 5, y + 4, z - 1, lx0 + 6, y + 5, z, "gold");
    v.box(x1, y, z - W, x1 + 1, y + 1, z + W, "red"); // buffer
    v.put(x1 - 1, y + 3, z - 1, "warmGlow", 1);
    if (c) c.smoke(x1 - 2, y + 7, z - 1, "steam");
    for (let x = lx0 + 1; x < x1; x += 2) {
      v.put(x, y, z - W - 0, "red");
      v.put(x, y, z + W - 1, "red");
    }
  } else if (kind === "electric") {
    // bullet nose
    v.box(lx0, y, z - W, x1 - 4, y + 5, z + W, body);
    for (let k = 0; k < 4; k++) v.box(x1 - 4 + k, y, z - W + (k >= 2 ? 1 : 0), x1 - 3 + k, y + 4 - k, z + W - (k >= 2 ? 1 : 0), body);
    v.box(x1 - 4, y + 3, z - W, x1 - 2, y + 4, z + W, "glassDark", 0.3);
    v.box(lx0, y + 1, z - W, x1 - 3, y + 2, z + W, stripe);
    v.box(lx0 + 1, y + 2, z - W, x1 - 5, y + 3, z + W, "glass", 0.4);
    v.box(lx0 + 3, y + 5, z - 1, lx0 + 5, y + 7, z, "steelDark"); // pantograph
    v.put(x1 - 1, y + 1, z - 1, "warmGlow", 1);
    v.put(x1 - 1, y + 1, z, "warmGlow", 1);
  } else {
    // diesel / heritage boxy loco
    v.box(lx0, y, z - W, x1, y + 5, z + W, body);
    v.box(lx0, y, z - W, x1, y + 1, z + W, "charcoal");
    v.box(lx0, y + 1, z - W, x1, y + 2, z + W, stripe);
    v.box(x1 - 3, y + 3, z - W, x1 - 1, y + 4, z + W, "glassDark", 0.3);
    v.box(x1 - 1, y + 3, z - W + 1, x1, y + 4, z + W - 1, "glassDark", 0.3);
    v.box(lx0 + 1, y + 5, z - 1, x1 - 4, y + 6, z + 1, "steelDark");
    if (kind === "heritage") {
      v.box(lx0 + 1, y + 5, z - 1, lx0 + 2, y + 8, z, "black");
      if (c) c.smoke(lx0 + 1, y + 8, z - 1, "smoke");
      v.box(lx0, y + 5, z - W, x1, y + 6, z + W, "black");
    }
    v.put(x1 - 1, y + 1, z - 1, "warmGlow", 1);
  }
  // carriages
  for (let cx1 = lx0 - 1; cx1 - carLen >= x0; cx1 -= carLen + 1) {
    const cx0 = cx1 - carLen;
    const h = kind === "heritage" ? 4 : 5;
    v.box(cx0, y, z - W, cx1, y + h, z + W, kind === "steam" ? "crimson" : body);
    v.box(cx0, y, z - W, cx1, y + 1, z + W, "charcoal");
    v.box(cx0, y + 1, z - W, cx1, y + 2, z + W, stripe);
    for (let x = cx0 + 1; x < cx1 - 1; x += 2) {
      v.put(x, y + 3, z - W, "glass", 0.45);
      v.put(x, y + 3, z + W - 1, "glass", 0.45);
    }
    v.box(cx0, y + h, z - W + 1, cx1, y + h + 1, z + W - 1, kind === "electric" ? "white" : kind === "steam" ? "charcoal" : "steelDark");
    v.box(cx1, y + 1, z - 1, cx1 + 1, y + 3, z + 1, "charcoal");
  }
}

// =============================================================================================
// BUS STOP (1x1 at all levels — pole → shelter → hub pavilion)
//  V0 City Red (red steel & glass, red double-decker)   V1 Victorian Wood (cream & green, ornate gable)
//  V2 Eco Modern (white swoosh canopy, green roof, e-bus) V3 Tropical (bamboo & thatch, palms, colourful bus)
// =============================================================================================
function buildBusStop(c: Ctx): void {
  const { v, hz, variant: style } = c;
  const level = Math.min(3, c.lv);
  const front = hz - 1, back = hz - 5;
  const frame = ["red", "woodDark", "white", "woodLight"][style];
  const accent = ["red", "tealDark", "solarBlue", "terracotta"][style];
  v.box(-7, 0, back, 7, 1, hz, style === 3 ? "woodLight" : "concrete");
  bench(v, -3, 1, back + 1, "x", style === 2 ? "teal" : "wood");
  v.box(5, 1, back + 1, 6, 9, back + 2, frame);
  if (style === 0) {
    v.ringZ(5.5, 8.5, back + 1, back + 2, 2.4, 1.15, "red");
    v.box(3, 8, back + 1, 8, 9, back + 2, "blueDark");
  } else if (style === 1) {
    v.box(3, 7, back + 1, 7, 9, back + 2, "cream");
    v.put(5, 9, back + 1, "gold");
  } else if (style === 2) {
    v.box(4, 5, back + 1, 7, 9, back + 2, "charcoal");
    v.box(4, 6, back + 2, 6, 8, back + 3, "screenGreen", 0.8);
  } else {
    v.box(3, 8, back + 1, 7, 9, back + 2, "orange");
    v.put(7, 8, back + 1, "orange");
    v.box(3, 6, back + 1, 6, 7, back + 2, "teal");
  }
  if (level >= 2) {
    for (const x of [-6, 2]) v.box(x, 1, back, x + 1, 7, back + 1, frame);
    v.box(-5, 2, back, 2, 6, back + 1, style === 1 || style === 3 ? "woodLight" : "glass");
    if (style === 1 || style === 3) gable(v, -7, 7, back, 4, front + 1, "x", accent, frame);
    else {
      v.box(-7, 7, back, 4, 8, front + 1, accent);
      if (style === 2) v.box(-7, 8, back, 4, 9, back + 2, "solarBlue");
    }
  }
  if (level >= 3) {
    for (let x = -7; x < 7; x++) v.put(x, 0, front, x % 3 ? "hazard" : "goldDark");
    v.box(-5, 5, back + 1, 0, 7, back + 2, "black");
    for (let x = -5; x < 0; x += 2) v.put(x, 6, back + 2, "amber", 1.3);
    v.put(5, 3, back + 2, "screenCyan", 0.9);
    v.put(1, 6, back + 1, "warmGlow", 1.1);
  }
}

// =============================================================================================
// TRAIN STOP (halt → canopy platform → station → grand terminal w/ glass train shed)
//  V0 Victorian Brick (red brick, green iron canopy, steam-era green/cream train)
//  V1 Alpine Chalet (dark timber, white render, steep roofs, red mountain train)
//  V2 Art Deco Streamline (cream, teal & gold bands, rounded tower, silver streamliner)
//  V3 Modern Glass & Steel (white frames, glass, solar canopy, white bullet train)
// =============================================================================================
function buildTrainStop(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.1);
  const wall = ["brick", "white", "cream", "white"][s];
  const wall2 = ["brickDark", "woodDark", "teal", "silver"][s];
  const roofC = ["leafDark", "woodDark", "tealDark", "steelLight"][s];
  // Trains remain on the real neighboring track. The raised platform meets its ballast.
  const tz = -hz;
  const pz0 = -hz;
  const pz1 = pz0 + (lv >= 3 ? 5 : 4);
  const px0 = lv === 1 ? -6 : -hx + 1;
  const px1 = lv === 1 ? 6 : hx - 1;
  v.box(px0, 0, pz0, px1, 2, pz1, "concrete");
  v.box(px0, 2, pz0, px1, 3, pz0 + 1, "hazard");
  if (lv === 1) {
    v.box(-3, 2, pz1 - 1, -2, 8, pz1, "steelDark");
    v.box(-5, 8, pz1 - 1, 0, 10, pz1, ["leaf", "red", "teal", "blue"][s]);
    v.box(-4, 9, pz1, -1, 10, pz1 + 1, "white", 0.5);
    bench(v, 1, 2, pz1 - 2, "x", "wood");
    lamp(v, 5, 2, pz1 - 1, 5);
    person(v, 0, 2, pz0 + 2, c.pick(SHIRTS), "blueDark");
    v.box(-1, 0, pz1, 1, 1, hz, "path");
    tree(v, -hx + 2, 1, hz - 3, s === 1 ? "pine" : "round", 1, 1);
    if (s === 0) {
      // The stationmaster's semaphore clears trains at a request stop.
      v.box(hx - 3, 1, tz + 3, hx - 2, 10, tz + 4, "iron");
      v.box(hx - 6, 8, tz + 3, hx - 2, 9, tz + 4, "red");
      v.put(hx - 5, 8, tz + 3, "white");
    } else if (s === 1) {
      gable(v, -6, 10, pz1 - 3, 1, pz1 + 2, "x", "woodDark", "snow");
    } else if (s === 2) {
      for (let x = -6; x < 0; x++) v.box(x, 9, pz1 - 1, x + 1, 13 - Math.floor(Math.abs(x + 3) / 2), pz1, "cream");
      v.box(-4, 10, pz1, -2, 13, pz1 + 1, "teal");
    } else {
      v.box(5, 1, tz + 3, 6, 12, tz + 4, "silver");
      v.box(5, 11, tz, 6, 12, tz + 4, "steelDark");
      v.box(-hx, 10, tz, hx, 11, tz + 1, "steel");
    }
    return;
  }

  // canopy over the platform
  const ch = 8;
  const cz0 = pz0 + 1;
  const cz1 = pz1;
  const cx0 = lv >= 3 ? -hx + 2 : -hx + 4;
  const cx1 = lv >= 3 ? 2 : hx - 4;
  for (let x = cx0 + 1; x < cx1; x += 5) v.box(x, 2, cz1 - 2, x + 1, ch, cz1 - 1, s === 0 ? "leafDark" : s === 1 ? "woodDark" : s === 2 ? "cream" : "silver");
  if (s === 0) {
    v.box(cx0, ch, cz0, cx1, ch + 1, cz1, roofC);
    for (let x = cx0; x < cx1; x++) v.put(x, ch - 1, cz0, x % 2 ? "cream" : roofC); // valance
  } else if (s === 1) gable(v, cx0, ch, cz0 - 1, cx1, cz1 + 1, "x", roofC, "white");
  else if (s === 2) barrelRoof(v, cx0, ch, cz0, cx1, cz1, "x", "teal", "gold");
  else for (let z = cz0; z < cz1; z += 3) solarRow(v, cx0, cx1, ch, z, 3);
  for (let x = cx0 + 3; x < cx1 - 2; x += 6) bench(v, x, 2, cz1 - 3, "x", "wood");
  crowd(c, cx0, pz0 + 2, cx1, pz1, 2 + lv, 2);

  if (lv >= 3) {
    // the station building at the end of the platform (+x side), facing front
    const bx0 = 3;
    const bx1 = hx - 1;
    const bz0 = pz0;
    const bz1 = Math.min(hz - 2, lv >= 4 ? pz1 + 9 : pz1 + 3);
    const bh = lv >= 4 ? 10 : 7;
    v.box(bx0, 1, bz0, bx1, bh, bz1, wall);
    windows(c, bx0, 1, bz0, bx1, bh, bz1, { w: s === 3 ? 2 : 1, h: 2, stepH: 3, stepV: 4, emit: 0.45, sill: wall2 });
    if (s === 0) {
      v.box(bx0, bh - 1, bz0, bx1, bh, bz1, "limestone");
      gable(v, bx0 - 1, bh, bz0 - 1, bx1 + 1, bz1 + 1, "z", "slate", "limestone");
    } else if (s === 1) {
      v.box(bx0, 1, bz0, bx1, 3, bz1, "stone");
      gable(v, bx0 - 2, bh, bz0 - 1, bx1 + 2, bz1 + 1, "x", roofC, "woodDark");
      for (let x = bx0; x < bx1; x += 2) v.put(x, bh - 2, bz1, "red");
    } else if (s === 2) {
      v.box(bx0, bh - 2, bz0, bx1, bh - 1, bz1, "teal");
      v.box(bx0 - 1, bh, bz0 - 1, bx1 + 1, bh + 1, bz1 + 1, "gold");
    } else {
      v.box(bx0, 2, bz1 - 1, bx1, bh - 1, bz1, "glass", 0.45);
      flatRoof(c, bx0, bh, bz0, bx1, bz1, "silver", "white", false);
    }
    door(v, Math.floor((bx0 + bx1) / 2) - 1, 1, bz1 - 1, "woodDark", 3, 4);
    v.box(bx0, 0, bz1, bx1, 1, hz, "path");
    v.box(Math.floor((bx0 + bx1) / 2) - 3, bh - 3, bz1, Math.floor((bx0 + bx1) / 2) + 4, bh - 1, bz1 + 1, ["leafDark", "red", "tealDark", "blue"][s], 0.6);

    if (lv >= 4) {
      // clock tower on the station
      const tx = bx1 - 4;
      const tzz = bz1 - 4;
      const th = bh + (lv >= 5 ? 14 : 9);
      v.box(tx - 2, bh, tzz - 2, tx + 2, th, tzz + 2, s === 3 ? "silver" : wall);
      if (s === 3) v.box(tx - 1, bh, tzz + 1, tx + 1, th, tzz + 2, "glass", 0.5);
      clockFace(v, tx, th - 3, tzz + 2, 1);
      if (s === 2) {
        v.box(tx - 1, th, tzz - 1, tx + 1, th + 3, tzz + 1, "cream");
        v.box(tx - 1, th + 3, tzz - 1, tx, th + 7, tzz, "gold", 0.5);
      } else if (s === 3) {
        v.box(tx, th, tzz, tx + 1, th + 6, tzz + 1, "silver");
        c.blink(tx, th + 6, tzz, "red");
      } else hip(v, tx - 3, th, tzz - 3, tx + 2, tzz + 2, s === 0 ? "slate" : roofC);
      // forecourt: cars / taxis
      for (let i = 0; i < 2; i++) car(v, -hx + 5 + i * 7, 1, hz - 3, "x", c.pick(["yellow", "red", "silver"]));
      v.box(-hx + 1, 0, hz - 6, bx0, 1, hz - 1, "asphalt");
    }
  } else {
    tree(v, hx - 3, 1, hz - 3, s === 1 ? "pine" : "round", 1, 1);
    v.box(-1, 0, pz1, 1, 1, hz, "path");
  }

  if (lv >= 5) {
    // glass train shed vaulting over the tracks
    const z0 = -hz;
    const z1 = pz1;
    const shedH = 11;
    for (let x = -hx; x < 2; x += 6) {
      v.box(x, 1, z0, x + 1, shedH, z0 + 1, "steelDark");
      v.box(x, 1, z1 - 1, x + 1, shedH, z1, "steelDark");
    }
    barrelRoof(v, -hx, shedH, z0, 2, z1, "x", "glass", "steelDark");
    // forecourt fountain & flags
    fountain(v, -hx + 8, 1, hz - 9, 3, "marble");
    for (let i = 0; i < 3; i++) flag(v, -hx + 14 + i * 4, 1, hz - 8, 10, [["red", "white", "blue"], ["teal", "white", "teal"], ["gold", "red", "gold"]][i]);
    crowd(c, -hx + 2, hz - 7, 2, hz - 1, 5);
  }
}

// =============================================================================================
// TRAIN DEPOT (engine shed → roundhouse with turntable → grand rail works)
//  V0 Steam Era (brick sheds, black-and-red steam locos, coal stage, smoke)
//  V1 Diesel Yard (blue corrugated sheds, yellow/blue diesels, fuel tanks)
//  V2 High-Speed Electric (white halls, bullet trains, catenary masts)
//  V3 Heritage Narrow-Gauge (timber sheds, little green locos, water tower)
// =============================================================================================
function buildTrainDepot(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "path2");
  speckle(c, "stone", 0.15);
  const kind: TrainKind = (["steam", "diesel", "electric", "heritage"] as const)[s];
  const body = ["black", "hazard", "white", "leafDark"][s];
  const stripe = ["red", "blue", "red", "gold"][s];
  const shedWall = ["brick", "blue", "white", "woodLight"][s];
  const shedRoof = ["slate", "steel", "silver", "woodDark"][s];

  // tracks along x
  const nTracks = [1, 2, 3, 3, 4][lv - 1];
  const pitch = 8;
  const tracks: number[] = [];
  for (let i = 0; i < nTracks; i++) {
    const z = -hz + 4 + i * pitch;
    if (z + 3 > hz) break;
    tracks.push(z);
  }
  for (const z of tracks) trackX(v, -hx, hx, z, "stone");

  // engine shed over the tracks at the back-left (open end facing +x)
  const shedX0 = -hx + 1;
  const shedX1 = shedX0 + [18, 20, 22, 26, 30][lv - 1];
  const shedZ0 = -hz;
  const shedZ1 = Math.min(hz, tracks[Math.min(tracks.length - 1, lv >= 3 ? 1 : 0)] + 4);
  const sh = [9, 10, 10, 11, 12][lv - 1];
  v.box(shedX0, 1, shedZ0, shedX1, sh, shedZ0 + 1, shedWall);
  v.box(shedX0, 1, shedZ1 - 1, shedX1, sh, shedZ1, shedWall);
  v.box(shedX0, 1, shedZ0, shedX0 + 1, sh, shedZ1, shedWall);
  windows(c, shedX0, 1, shedZ0, shedX1, sh, shedZ1, { faces: "sn", h: 2, w: s === 2 ? 3 : 1, stepH: 4, emit: 0.4 });
  // open door frames on +x end
  for (const z of tracks) if (z + 3 <= shedZ1) {
    v.box(shedX1 - 1, 1, z - 4, shedX1, sh, z - 3, shedWall);
    v.box(shedX1 - 1, sh - 2, z - 3, shedX1, sh, z + 4, shedWall);
  }
  if (s === 0 || s === 3) {
    const axis = "x";
    gable(v, shedX0 - 1, sh, shedZ0, shedX1 + 1, shedZ1, axis, shedRoof, s === 0 ? "limestone" : "wood");
    if (s === 0) for (let x = shedX0 + 3; x < shedX1 - 2; x += 6) {
      v.box(x, sh + 4, Math.floor((shedZ0 + shedZ1) / 2) - 1, x + 2, sh + 7, Math.floor((shedZ0 + shedZ1) / 2) + 1, "brickDark");
      c.smoke(x + 1, sh + 7, Math.floor((shedZ0 + shedZ1) / 2), "smoke");
    }
  } else if (s === 1) {
    sawtooth(v, shedX0, sh, shedZ0, shedX1, shedZ1, shedRoof, "glass", 4);
    v.box(shedX0, sh - 2, shedZ1 - 1, shedX1, sh - 1, shedZ1, "hazard");
  } else {
    barrelRoof(v, shedX0, sh, shedZ0, shedX1, shedZ1, "x", "silver", "steel");
    v.box(shedX0, sh - 2, shedZ1 - 1, shedX1, sh - 1, shedZ1, "red");
  }
  // The shed roads stay empty: the city's real trains park here (railMovement.parkedBodies).
  // Buffer stops at the closed end and an inspection pit lamp on each road.
  for (const z of tracks) {
    v.box(shedX0 + 1, 1, z - 2, shedX0 + 2, 3, z + 3, "red");
    v.put(shedX0 + 1, 3, z, "warmGlow", 0.8);
  }

  // water tower / fuel tank / signal by level
  if (lv >= 2) {
    const wx = lv >= 3 ? -hx + 14 : hx - 5;
    const wz = hz - 5;
    if (s === 0 || s === 3) {
      for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(wx + dx, 1, wz + dz, wx + dx + 1, 9, wz + dz + 1, "woodDark");
      v.cylinderY(wx, wz, 9, 14, 3, s === 0 ? "woodLight" : "wood");
      ring(v, wx, wz, 10, 11, 3.2, 2.5, "iron");
      v.cone(wx, 14, 17, wz, 3.4, 0.5, "woodDark");
      v.box(wx - 6, 11, wz, wx - 2, 12, wz + 1, "iron");
    } else if (s === 1) {
      tank(v, wx, wz, 1, 6, 3, "white", "steelLight", "blue");
      v.box(wx - 4, 1, wz - 1, wx - 3, 6, wz, "hazard");
    } else {
      // substation
      v.box(wx - 3, 1, wz - 3, wx + 3, 2, wz + 3, "concreteDark");
      for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) v.box(wx + dx, 2, wz + dz, wx + dx + 1, 6, wz + dz + 1, "steelDark");
      v.put(wx, 6, wz, "screenCyan", 1);
    }
  }
  if (s === 2) {
    // catenary masts along tracks
    for (let x = -hx + 4; x < hx; x += 10) for (const z of tracks) {
      v.box(x, 1, z + 3, x + 1, 11, z + 4, "steelDark");
      v.box(x, 10, z - 1, x + 1, 11, z + 4, "steelDark");
    }
    for (const z of tracks) v.box(-hx, 10, z, hx, 11, z + 1, "steel");
  }

  if (lv >= 3) {
    // turntable with rotating bridge & loco (front right)
    const r = 7;
    const ttx = hx - r - 2;
    const ttz = hz - r - 2;
    v.cylinderY(ttx, ttz, 0, 1, r + 0.5, "concreteDark");
    ring(v, ttx, ttz, 0, 2, r + 1, r, "concrete");
    v.cylinderY(ttx, ttz, 0, 1, r - 0.5, "stone");
    const rot = new PixelVox();
    rot.box(-r, 0, -3, r, 1, 3, "steelDark");
    rot.box(-r, 1, -2, r, 2, -1, "steelLight");
    rot.box(-r, 1, 1, r, 2, 2, "steelLight");
    // mini loco on the bridge
    rot.box(-4, 2, -2, 4, 7, 2, body === "white" ? "white" : body);
    rot.box(-4, 3, -2, 4, 4, 2, stripe);
    rot.box(2, 5, -2, 4, 6, 2, "glassDark");
    c.addRotor({ vox: rot, pivot: [ttx, 0, ttz], axis: "y", speed: 0.35 });
    // radiating stub tracks
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0]]) {
      for (let k = r + 1; k < r + 4; k++) {
        v.put(ttx + dx * k + (dz ? -2 : 0), 1, ttz + dz * k + (dx ? -2 : 0), "steelLight");
        v.put(ttx + dx * k + (dz ? 1 : 0), 1, ttz + dz * k + (dx ? 1 : 0), "steelLight");
      }
    }
  }
  if (lv >= 4) {
    // signal box (sidings stay clear for real rolling stock)
    const z = tracks[tracks.length - 1];
    const sbx = -hx + 2;
    const sbz = hz - 6;
    if (z + 4 < sbz) {
      v.box(sbx, 1, sbz, sbx + 6, 5, sbz + 5, ["brick", "steelLight", "white", "wood"][s]);
      v.box(sbx, 5, sbz, sbx + 6, 8, sbz + 5, "glass", 0.4);
      hip(v, sbx - 1, 8, sbz - 1, sbx + 7, sbz + 6, ["slate", "blue", "silver", "woodDark"][s]);
    }
    // signals
    for (const tz of tracks) {
      v.box(hx - 2, 1, tz + 3, hx - 1, 8, tz + 4, "iron");
      v.put(hx - 2, 8, tz + 3, c.rand() < 0.5 ? "red" : "screenGreen", 1.2);
    }
  }
  if (lv >= 5) {
    // gantry crane spanning the yard + clock + flags
    const gx = -hx + 18;
    v.box(gx, 1, -hz + 1, gx + 1, 18, -hz + 2, "hazard");
    v.box(gx, 1, hz - 2, gx + 1, 18, hz - 1, "hazard");
    v.box(gx - 1, 18, -hz + 1, gx + 2, 20, hz - 1, "hazard");
    v.box(gx - 1, 15, -1, gx + 2, 18, 2, "steelDark");
    clockFace(v, Math.floor((shedX0 + shedX1) / 2), sh - 3, shedZ1, 2);
    flag(v, shedX0 + 2, sh + 1, shedZ1 - 2, 6, ["red", "white", "red"]);
    crowd(c, -hx + 2, hz - 3, 0, hz - 1, 4);
  }
}

// =============================================================================================
// BUS DEPOT (bus lot → garage → wash → fleet depot → central transit depot)
//  V0 School-Bus Yard (yellow buses, red brick garage)       V1 Double-Decker Garage (red DD buses, London brick)
//  V2 Electric Fleet (white hall, teal e-buses, chargers, solar) V3 Retro Coach Line (silver coaches, art-deco cream & neon)
// =============================================================================================
function buildBusDepot(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "asphalt");
  speckle(c, "asphaltDark", 0.1);
  const body = ["busYellow", "red", "teal", "silver"][s];
  const stripe = ["black", "yellow", "white", "blue"][s];
  const dbl = s === 1;
  const wall = ["brick", "brickDark", "white", "cream"][s];
  const roofC = ["slate", "slate", "silver", "tealDark"][s];

  // bus bays with parked buses (front zone)
  const garageD = lv === 1 ? 0 : lv <= 3 ? 12 : 14;
  const gz0 = -hz + 1;
  const gz1 = gz0 + garageD;
  const gx0 = -hx + 1;
  const gx1 = lv >= 3 ? Math.min(hx - 1, gx0 + [0, 0, 18, 30, 34][lv - 1]) : hx - 1;
  const gh = [0, 9, 10, 12, 12][lv - 1];

  if (lv === 1) {
    // office hut + fuel pump
    v.box(-hx + 1, 1, -hz + 1, -hx + 7, 6, -hz + 6, wall);
    windows(c, -hx + 1, 1, -hz + 1, -hx + 7, 6, -hz + 6, { stepH: 3, emit: 0.4 });
    flatRoof(c, -hx + 1, 6, -hz + 1, -hx + 7, -hz + 6, "charcoal", roofC, false);
    door(v, -hx + 3, 1, -hz + 5, "woodDark");
  } else {
    v.box(gx0, 1, gz0, gx1, gh, gz1, wall);
    v.clear(gx0 + 1, 1, gz0 + 1, gx1 - 1, gh - 1, gz1 - 1);
    // roll-up doors on the front
    for (let x = gx0 + 2; x + 6 <= gx1 - 1; x += 7) {
      v.box(x, 1, gz1 - 1, x + 6, 7, gz1, c.rand() < 0.5 ? "steelLight" : null);
      v.box(x - 1, 1, gz1 - 1, x, gh, gz1, wall);
      v.box(x, 7, gz1 - 1, x + 6, 8, gz1, s === 3 ? "gold" : "hazard");
    }
    if (s === 0 || s === 1) gable(v, gx0 - 1, gh, gz0, gx1 + 1, gz1, "x", roofC, s === 0 ? "white" : "limestone");
    else if (s === 2) {
      flatRoof(c, gx0, gh, gz0, gx1, gz1, "silver", "white", false);
      for (let z = gz0 + 1; z < gz1 - 3; z += 4) solarRow(v, gx0 + 1, gx1 - 1, gh + 1, z, 3);
    } else {
      barrelRoof(v, gx0, gh, gz0, gx1, gz1, "x", "tealDark", "gold");
      v.box(gx0, gh - 2, gz1 - 1, gx1, gh - 1, gz1, "teal");
    }
    // big sign
    const signCol = ["hazard", "red", "teal", "magenta"][s];
    const mx = Math.floor((gx0 + gx1) / 2);
    v.box(mx - 7, gh, gz1 - 1, mx + 8, gh + 7, gz1, "charcoal");
    textZ(v, "BUS", mx, gh + 5, gz1, signCol, 1);
    // buses peeking out of the doors
    for (let x = gx0 + 5, i = 0; x + 3 <= gx1 - 1 && i < 4; x += 7, i++) if (i % 2 === 0) bus(v, x, 1, gz1 - 4, "z", body, stripe, dbl);
  }

  // parked fleet in the yard (along x, rows at the front)
  const yardZ0 = lv === 1 ? -hz + 8 : gz1 + 2;
  const rowsZ: number[] = [];
  for (let z = yardZ0 + 2; z + 3 <= hz - 1; z += 6) rowsZ.push(z);
  for (const z of rowsZ) {
    for (let x = -hx + 7; x + 6 <= (lv >= 3 ? gx1 - 1 : hx - 1); x += 14) {
      v.box(x - 7, 0, z - 3, x - 6, 1, z + 3, "white");
      if (c.rand() < 0.85) bus(v, x, 1, z, "x", body, stripe, dbl, s === 2 ? "leaf" : "white");
    }
  }
  // fuel / charging
  const fx = hx - 4;
  if (s === 2) {
    for (let i = 0; i < 3; i++) {
      const z = -hz + 3 + i * 5;
      v.box(fx, 1, z, fx + 2, 6, z + 1, "white");
      v.put(fx, 5, z + 1, "screenGreen", 1.2);
    }
  } else {
    v.box(fx - 3, 1, -hz + 3, fx + 3, 2, -hz + 9, "concrete");
    for (const z of [-hz + 4, -hz + 7]) {
      v.box(fx - 1, 2, z, fx + 1, 5, z + 1, "red");
      v.put(fx - 1, 4, z + 1, "white", 0.6);
    }
    for (const [px, pz] of [[fx - 3, -hz + 3], [fx + 2, -hz + 3], [fx - 3, -hz + 8], [fx + 2, -hz + 8]]) v.box(px, 2, pz, px + 1, 8, pz + 1, "steelLight");
    v.box(fx - 3, 8, -hz + 3, fx + 3, 9, -hz + 9, s === 3 ? "teal" : "red");
  }

  if (lv >= 3) {
    // bus wash with spinning brushes
    const wx0 = gx1 + 1;
    const wz0 = -hz + 12;
    if (wx0 + 8 <= hx) {
      for (const dx of [0, 7]) v.box(wx0 + dx, 1, wz0, wx0 + dx + 1, 8, wz0 + 10, "steelLight");
      v.box(wx0, 8, wz0, wx0 + 8, 9, wz0 + 10, "blue");
      for (const [bx, bz] of [[wx0 + 2, wz0 + 3], [wx0 + 6, wz0 + 3]]) {
        const brush = new PixelVox();
        for (let y = 0; y < 6; y++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) brush.put(dx - 0.5 + 0.5, y, dz, y % 2 ? "blue" : "sky");
        brush.box(0, 0, 0, 1, 6, 1, "white");
        c.addRotor({ vox: brush, pivot: [bx, 2, bz], axis: "y", speed: 4 });
      }
      v.box(wx0 + 1, 1, wz0, wx0 + 7, 2, wz0 + 10, "foam", 0.2);
    }
  }
  if (lv >= 4) {
    // control office tower
    const ox = -hx + 2;
    const oz = gz0 + 2;
    v.box(ox, gh, oz, ox + 6, gh + 6, oz + 6, s === 2 ? "glass" : wall, s === 2 ? 0.3 : 0);
    v.box(ox, gh + 2, oz, ox + 6, gh + 4, oz + 6, "glass", 0.45);
    flatRoof(c, ox, gh + 6, oz, ox + 6, oz + 6, "charcoal", roofC, false);
    v.box(ox + 3, gh + 7, oz + 3, ox + 4, gh + 13, oz + 4, "steelDark");
    c.blink(ox + 3, gh + 13, oz + 3, "red");
  }
  if (lv >= 5) {
    for (const [lx, lz] of [[-hx + 1, hz - 1], [hx - 2, hz - 1], [0, hz - 1]]) lamp(v, lx, 1, lz, 7);
    flag(v, hx - 3, 1, gz1 + 1, 12, [body, "white", body]);
    // clock tower on the garage corner
    const ctx0 = gx1 - 6;
    const ctz0 = gz1 - 6;
    v.box(ctx0, gh, ctz0, ctx0 + 5, gh + 14, ctz0 + 5, wall);
    v.box(ctx0, gh + 8, ctz0, ctx0 + 5, gh + 9, ctz0 + 5, body);
    clockFace(v, ctx0 + 2, gh + 11, ctz0 + 5, 2);
    hip(v, ctx0 - 1, gh + 14, ctz0 - 1, ctx0 + 6, ctz0 + 6, roofC === "silver" ? "teal" : roofC);
    c.blink(ctx0 + 2, gh + 18, ctz0 + 2, "red");
    crowd(c, gx0, gz1, gx1, gz1 + 2, 4);
  }
}

// =============================================================================================
// TAXI DEPOT — unmistakably yellow-cab themed (checker bands, glowing TAXI signs, rows of cabs)
//  V0 NYC Brick Garage (brick, black/yellow checker band)  V1 Googie Retro 50s (turquoise & pink, boomerang sign)
//  V2 Modern EV Taxi Hub (white & glass, chargers, solar)  V3 Tokyo Neon (dark walls, pink/cyan neon, lantern cabs)
// =============================================================================================
function checkerBand(v: PixelVox, x0: number, x1: number, y: number, z: number): void {
  for (let x = x0; x < x1; x++) {
    v.put(x, y, z, x & 1 ? "black" : "yellow");
    v.put(x, y + 1, z, x & 1 ? "yellow" : "black");
  }
}

function buildTaxiDepot(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "asphalt");
  speckle(c, "asphaltDark", 0.1);
  const wall = ["brick", "teal", "white", "slate"][s];
  const trim = ["charcoal", "pink", "silver", "magenta"][s];
  const neon = ["yellow", "pink", "yellow", "magenta"][s];
  const lampC = s === 3 ? "red" : "warmGlow";

  // painted yellow bays
  for (let x = -hx + 1; x < hx; x += 4) v.box(x, 0, hz - 6, x + 1, 1, hz - 1, "yellow");
  if (lv === 1) {
    // No garage at a street rank: a call box, queue and three idling cabs.
    v.box(-hx, 0, -hz, hx, 1, -hz + 8, "path2");
    const x = -hx + 5;
    const z = -hz + 3;
    v.box(x - 2, 1, z - 1, x + 2, 6, z + 2, wall);
    v.box(x - 1, 3, z + 1, x + 2, 5, z + 2, "glassDark", 0.4);
    if (s === 0) {
      checkerBand(v, x - 2, x + 2, 5, z + 2);
      hip(v, x - 3, 7, z - 2, x + 3, z + 3, "charcoal");
    } else if (s === 1) {
      for (let k = -3; k <= 3; k++) v.box(x + k, 6 + Math.abs(k), z - 2, x + k + 1, 7 + Math.abs(k), z + 3, "pink");
    } else if (s === 2) {
      solarRow(v, x - 3, x + 3, 6, z - 1);
    } else {
      v.box(x - 3, 6, z - 2, x + 3, 7, z + 3, "slate");
      v.box(x - 1, 7, z, x + 1, 12, z + 1, "magenta", 0.8);
    }
    for (let k = -1; k <= 1; k++) taxi(v, k * 9, 1, hz - 3, "x", "yellow", lampC);
    bench(v, 1, 1, z, "x", trim);
    for (const px of [3, 5, 8]) person(v, px, 1, z + 2, c.pick(SHIRTS), c.pick(PANTS));
    return;
  }

  // garage building at the back
  const gd = [7, 10, 12, 12, 12][lv - 1];
  const gx0 = -hx + 1;
  const gx1 = lv >= 4 ? 4 : hx - 1;
  const gz0 = -hz + 1;
  const gz1 = gz0 + gd;
  const gh = [6, 9, 10, 11, 12][lv - 1];
  v.box(gx0, 1, gz0, gx1, gh, gz1, wall);
  v.clear(gx0 + 1, 1, gz0 + 1, gx1 - 1, gh - 1, gz1 - 1);
  if (s === 2) v.box(gx0 + 1, 1, gz1 - 1, gx1 - 1, gh - 1, gz1, "glass", 0.35);
  for (let x = gx0 + 2; x + 5 <= gx1 - 1; x += 6) {
    v.clear(x, 1, gz1 - 1, x + 5, 5, gz1);
    v.box(x - 1, 1, gz1 - 1, x, gh, gz1, trim);
  }
  checkerBand(v, gx0, gx1, gh - 2, gz1);
  checkerBand(v, gx0, gx1, gh - 2, gz0 - 1 + 0);
  if (s === 1) {
    v.box(gx0 - 1, gh, gz0 - 1, gx1 + 1, gh + 1, gz1 + 2, "white");
    v.box(gx0 - 1, gh - 1, gz1, gx1 + 1, gh, gz1 + 2, "pink");
  } else if (s === 2) {
    flatRoof(c, gx0, gh, gz0, gx1, gz1, "silver", "white", false);
    for (let z = gz0 + 1; z < gz1 - 3; z += 4) solarRow(v, gx0 + 1, gx1 - 1, gh + 1, z, 3);
  } else flatRoof(c, gx0, gh, gz0, gx1, gz1, "charcoal", s === 3 ? "magenta" : "brickDark", s === 0);
  if (s === 3) {
    v.box(gx0, 2, gz1, gx1, 3, gz1 + 1, "screenCyan", 1);
    for (let y = 3; y < gh - 3; y += 3) v.box(gx1 - 1, y, gz1, gx1, y + 2, gz1 + 1, c.pick(["magenta", "screenCyan", "amber"]), 1.2);
  }
  // cabs inside the garage bays
  for (let x = gx0 + 4; x + 3 <= gx1 - 1; x += 6) taxi(v, x, 1, gz1 - 3, "z", "yellow", lampC);

  // the TAXI sign
  const mx = Math.floor((gx0 + gx1) / 2);
  const sy = gh + (lv >= 3 ? 3 : 1);
  if (lv >= 3) for (const dx of [-6, 6]) v.box(mx + dx, gh, gz1 - 2, mx + dx + 1, sy, gz1 - 1, "steelDark");
  v.box(mx - 9, sy, gz1 - 2, mx + 9, sy + 7, gz1 - 1, s === 1 ? "tealDark" : "black");
  for (let x = mx - 9; x < mx + 9; x++) v.put(x, sy, gz1 - 2, x & 1 ? "yellow" : "black");
  textZ(v, "TAXI", mx, sy + 6, gz1 - 1, neon, 1.3);
  if (s === 1) {
    // boomerang googie spike
    for (let k = 0; k < 8; k++) v.put(mx + 9 + Math.floor(k / 2), sy + 7 + k, gz1 - 2, "pink");
    v.sphere(mx + 13, sy + 16, gz1 - 2, 1.2, 1.2, 1.2, "yellow", 1);
  }

  // rank of cabs in the front bays
  const nCabs = [3, 5, 7, 7, 9][lv - 1];
  let i = 0;
  for (let x = -hx + 3; x + 1 < hx && i < nCabs; x += 4, i++) taxi(v, x, 1, hz - 3, "z", "yellow", lampC);
  // dispatcher booth
  const bx = hx - 5;
  const bz = gz1 + 2;
  if (bz + 4 < hz - 6) {
    v.box(bx, 1, bz, bx + 4, 5, bz + 4, "yellow");
    v.box(bx, 3, bz + 3, bx + 4, 4, bz + 4, "glass", 0.5);
    v.box(bx - 1, 5, bz - 1, bx + 5, 6, bz + 5, "black");
    person(v, bx - 1, 1, bz + 2, "yellow", "charcoal");
  }

  if (lv >= 3) {
    // dispatch radio mast
    const ax = gx0 + 2;
    const az = gz0 + 2;
    v.box(ax, gh, az, ax + 1, gh + 14, az + 1, "steelDark");
    for (let y = gh + 3; y < gh + 14; y += 4) v.box(ax - 1, y, az, ax + 2, y + 1, az + 1, "steel");
    c.blink(ax, gh + 14, az, "red");
  }
  if (lv >= 4) {
    // multi-level parking deck on the right with cabs on every floor
    const px0 = gx1 + 1;
    const px1 = hx - 1;
    const pz0 = -hz + 1;
    const pz1 = Math.min(hz - 7, pz0 + 20);
    const levels = lv >= 5 ? 4 : 3;
    for (let k = 0; k < levels; k++) {
      const y = 1 + k * 4;
      v.box(px0, y + 3, pz0, px1, y + 4, pz1, "concrete");
      for (const [cx, cz] of [[px0, pz0], [px1 - 1, pz0], [px0, pz1 - 1], [px1 - 1, pz1 - 1]]) v.box(cx, y, cz, cx + 1, y + 3, cz + 1, "concreteDark");
      checkerBand(v, px0, px1, y + 3, pz1 - 0);
      for (let z = pz0 + 3; z + 2 < pz1; z += 4) taxi(v, Math.floor((px0 + px1) / 2), y + 4, z, "x", "yellow", lampC);
    }
    for (let z = pz0 + 3; z + 2 < pz1; z += 4) taxi(v, Math.floor((px0 + px1) / 2), 1, z, "x", "yellow", lampC);
    // wash arch
    v.box(-hx + 1, 1, gz1 + 1, -hx + 2, 7, gz1 + 6, "steelLight");
    v.box(-hx + 1, 7, gz1 + 1, -hx + 9, 8, gz1 + 6, "yellow");
  }
  if (lv >= 5) {
    // GIANT taxi sculpture on the garage roof
    const tx = Math.floor((gx1 + hx) / 2);
    const ty = 18;
    const tz = -hz + 10;
    v.box(tx - 6, ty, tz - 3, tx + 7, ty + 4, tz + 3, "yellow");
    v.box(tx - 3, ty + 4, tz - 3, tx + 4, ty + 7, tz + 3, "yellow");
    v.box(tx - 2, ty + 5, tz - 3, tx + 3, ty + 6, tz + 3, "glassDark", 0.3);
    for (let x = tx - 6; x < tx + 7; x++) {
      v.put(x, ty + 2, tz + 2, x & 1 ? "black" : "white");
      v.put(x, ty + 2, tz - 3, x & 1 ? "black" : "white");
    }
    for (const wx of [tx - 4, tx + 4]) for (const wz of [tz - 3, tz + 2]) v.box(wx, ty - 1 + 1, wz, wx + 2, ty + 2, wz + 1, "rubber");
    v.box(tx - 1, ty + 7, tz - 1, tx + 2, ty + 9, tz + 1, "white", 1.2);
    v.put(tx + 7, ty + 2, tz - 2, "warmGlow", 1.3);
    v.put(tx + 7, ty + 2, tz + 1, "warmGlow", 1.3);
    for (const [lx, lz] of [[-hx + 1, hz - 7], [hx - 2, hz - 7]]) lamp(v, lx, 1, lz, 6, "iron", s === 3 ? "magenta" : "warmGlow");
    crowd(c, -hx + 2, hz - 7, hx - 2, hz - 6, 4);
  }
  if (lv <= 2) acUnit(v, gx1 - 4, gh + 1, gz0 + 2);
}

// =============================================================================================
defineDesigns({
  bus_stops: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Curbside Pole", "Weather Shelter", "Accessible Boarding Stop", "Legacy Sheltered Stop", "Legacy Boarding Stop"],
    growth: "A curbside pole and bench gain a weather shelter, then a tactile boarding strip, a fare reader and illuminated arrivals. All three stages leave the back of the lot open.",
    build: buildBusStop,
  },
  train_stops: {
    footprints: [[1, 1], [2, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Request Halt", "Canopy Platform", "Country Station", "Clock-Tower Station", "Grand Terminal"],
    growth: "A sign on a platform gains a canopy, then a station house, a clock tower and finally a vaulted boarding hall beside the live railway.",
    build: buildTrainStop,
  },
  train_depots: {
    footprints: [[2, 1], [2, 2], [3, 2], [3, 2], [3, 3]],
    levels: ["Engine Shed", "Twin-Road Shed", "Turntable Roundhouse", "Marshalling Yard", "Grand Rail Works"],
    growth: "More tracks and sheds, a spinning turntable, sidings full of wagons and a signal box, then a gantry-crane rail works.",
    build: buildTrainDepot,
  },
  bus_depots: {
    footprints: [[2, 1], [2, 1], [2, 2], [3, 2], [3, 2]],
    levels: ["Bus Lot", "Bus Garage", "Garage & Bus Wash", "Fleet Depot", "Central Transit Depot"],
    growth: "A lot with a fuel island becomes a garage, then adds a spinning-brush bus wash, a control tower and a full fleet.",
    build: buildBusDepot,
  },
  taxi_depots: {
    footprints: [[2, 1], [2, 1], [2, 2], [2, 2], [2, 2]],
    levels: ["Taxi Rank", "Checker Cab Garage", "Radio Dispatch Center", "Cab Parking Tower", "Yellow-Cab Empire"],
    growth: "A rank of yellow cabs grows a checker garage, a radio mast, a stacked parking deck and a giant rooftop taxi.",
    build: buildTaxiDepot,
  },
});
