import { defineDesigns } from "./registry";
import { ELEMENT_LEVEL_SPANS } from "../levelSpans";
import { type Ctx, PixelVox, bench, clockFace, flag, gable, hip, lamp, person, solidVoxels } from "./kit";

// ---------------------------------------------------------------------------------------------
// FERRY LANDING — a passenger landing that grows from canal steps into a full pier. The berth (water,
// boarding side) is always the BACK (-z); passengers walk in from the front (+z).
//   Lv1 Canal Steps     stone quay with steps into the water, bollards and a style marker
//   Lv2 Ticket Canopy   gangway to a floating pontoon with a canopy and ticket booth
//   Lv3 Waterbus Landing longer gangway, railed pontoon, glowing timetable, waiting passengers
//   Lv4 Twin Berth      T-pontoon with two berths (red/green berth lights), central shelter
//   Lv5 Passenger Pier  shore ticket hall, long lamp-lit pier, end pavilion and a harbour beacon
// Styles (designStyles.json): 0 Harbor master (navy & red, gables, signal yardarm), 1 Island shade
// (bamboo & thatch palapas, palms), 2 Streamline (white art-moderne curves, blue speed stripes,
// portholes), 3 River market (dark timber, green pagoda roofs, red lanterns, produce crates).
// ---------------------------------------------------------------------------------------------
const L_MAIN = ["#2f4f7a", "#2aa198", "white", "#3d5a3a"];
const L_ACC = ["red", "#f2c14e", "#2f6fd0", "crimson"];
const L_POST = ["woodDark", "#c8a95a", "chrome", "#4a2f1f"];
const L_DECK = ["wood", "#d8c08a", "#e8e8e8", "#7a5232"];

function landingDeck(v: PixelVox, k: number, x0: number, z0: number, x1: number, z1: number, y = 0) {
  const box = solidVoxels(v);
  for (let z = z0; z <= z1; z++) box(x0, y, z, x1, y, z, z % 3 === 0 ? (k === 2 ? "#c9d4dc" : "woodDark") : L_DECK[k]);
  for (const x of [x0, x1])
    for (let z = z0; z <= z1; z += 5) box(x, y - 3, z, x, y, z, k === 2 ? "concrete" : "woodDark");
}
function pontoon(v: PixelVox, k: number, x0: number, z0: number, x1: number, z1: number) {
  const box = solidVoxels(v);
  box(x0, -1, z0, x1, -1, z1, "charcoal");
  landingDeck(v, k, x0, z0, x1, z1, 0);
  for (let x = x0; x <= x1; x += 3) box(x, 0, z0, x, 1, z0, "rubber");
}
function rail(v: PixelVox, k: number, x0: number, z0: number, x1: number, z1: number) {
  const box = solidVoxels(v);
  const col = k === 2 ? "chrome" : k === 1 ? "#c8a95a" : k === 3 ? "#4a2f1f" : "white";
  if (x0 === x1) {
    for (let z = z0; z <= z1; z += 2) box(x0, 1, z, x0, 2, z, col);
    box(x0, 3, z0, x0, 3, z1, col);
  } else {
    for (let x = x0; x <= x1; x += 2) box(x, 1, z0, x, 2, z0, col);
    box(x0, 3, z0, x1, 3, z0, col);
  }
}
/** Style shelter roof on four posts over [x0..x1]×[z0..z1] (inclusive), posts from y=1 to y. */
function shelter(v: PixelVox, k: number, x0: number, z0: number, x1: number, z1: number, y: number) {
  const box = solidVoxels(v);
  for (const x of [x0, x1]) for (const z of [z0, z1]) box(x, 1, z, x, y - 1, z, L_POST[k]);
  if (k === 0) gable(v, x0 - 1, y, z0 - 1, x1 + 2, z1 + 2, "x", L_MAIN[0], "red", "cream");
  else if (k === 1) {
    hip(v, x0 - 2, y, z0 - 2, x1 + 3, z1 + 3, "#d8b86a", "#b8954a");
    v.put(Math.floor((x0 + x1) / 2), y + Math.ceil(Math.min(x1 - x0, z1 - z0) / 2) + 3, Math.floor((z0 + z1) / 2), "#b8954a");
  } else if (k === 2) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const dy = x === x0 - 1 || x === x1 + 1 ? 0 : 1;
      box(x, y + dy, z0 - 1, x, y + dy, z1 + 1, "white");
    }
    box(x0 - 1, y, z1 + 1, x1 + 1, y, z1 + 1, "#2f6fd0");
  } else {
    hip(v, x0 - 1, y, z0 - 1, x1 + 2, z1 + 2, "#3d7a4a", "#2a5a34", 3);
    for (const x of [x0 - 1, x1 + 1]) for (const z of [z0 - 1, z1 + 1]) box(x, y + 1, z, x, y + 1, z, "#3d7a4a");
    for (const x of [x0, x1]) {
      box(x, y - 2, z1 + 1, x, y - 2, z1 + 1, "woodDark");
      v.put(x, y - 3, z1 + 1, "red", 1.2);
    }
  }
}
/** Variant signature marker post at (x,z), height h. */
function landingMarker(c: Ctx, x: number, z: number, h: number, beacon = false) {
  const { v } = c,
    k = c.variant & 3,
    box = solidVoxels(v);
  if (k === 0) {
    box(x, 1, z, x, h, z, "white");
    box(x - 2, h - 2, z, x + 2, h - 2, z, "white");
    v.put(x - 2, h - 3, z, "red");
    v.put(x + 2, h - 3, z, "yellow");
    v.put(x - 1, h - 3, z, "blue");
    flag(v, x, h, z, 2, ["red", "white"]);
  } else if (k === 1) {
    box(x, 1, z, x, h - 2, z, "#c8a95a");
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) v.put(x + dx, h - 1 - (Math.abs(dx + dz) > 1 ? 1 : 0), z + dz, "leaf");
    v.put(x, h - 1, z, "orange", 1.2);
  } else if (k === 2) {
    box(x, 1, z, x, h, z, "chrome");
    box(x - 1, h - 3, z, x + 1, h - 1, z, "#2f6fd0");
    v.put(x, h - 2, z, "white", 0.9);
    v.put(x, h + 1, z, "white", 1.2);
  } else {
    box(x, 1, z, x, h, z, "#4a2f1f");
    box(x - 1, h, z, x + 1, h, z, "#4a2f1f");
    for (const dx of [-1, 1]) box(x + dx, h - 2, z, x + dx, h - 1, z, "red", 1.1);
  }
  if (beacon) c.blink(x, h + 2, z, k === 2 ? "white" : "red");
}
function lifeRing(v: PixelVox, x: number, y: number, z: number) {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) v.put(x + dx, y + dy, z, dy ? "orange" : "white");
}
function landing(c: Ctx) {
  const { v, lv, hx, hz } = c,
    k = c.variant & 3,
    box = solidVoxels(v);
  if (lv === 1) {
    // stone quay block at the front, steps falling toward the water at the back
    const stone = ["stone", "sand", "concrete", "#6b5a44"][k];
    box(-7, -3, 0, 6, 0, hz - 1, stone);
    for (let i = 0; i < 4; i++) box(-3, -3, -1 - i * 2, 2, -1 - i, -i * 2, i % 2 ? stone : "stone");
    for (const x of [-6, 5]) {
      box(x, 1, 1, x, 2, 1, "charcoal");
      v.put(x, 3, 1, "charcoal");
    }
    box(-7, 1, hz - 1, 6, 1, hz - 1, L_ACC[k]);
    landingMarker(c, 4, 4, 9);
    lifeRing(v, -5, 3, 5);
    box(-5, 1, 5, -5, 1, 5, "woodDark");
    if (k === 3) for (let i = 0; i < 3; i++) box(-2 + i * 2, 1, 4, -1 + i * 2, 2, 5, ["orange", "leaf", "red"][i]);
    if (k === 1) {
      box(-1, 1, 5, -1, 6, 5, "#a07a3a");
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 1], [-2, -1]]) v.put(-1 + dx, 7, 5 + dz, "leaf");
    }
    return;
  }
  if (lv === 2) {
    landingDeck(v, k, -2, 2, 1, hz - 1, 1);
    pontoon(v, k, -7, -hz, 6, 1);
    shelter(v, k, -6, -6, 1, -1, 7);
    box(3, 1, -2, 5, 5, 0, L_MAIN[k]);
    box(3, 3, 1, 5, 3, 1, "glass", 0.6);
    bench(v, -4, 1, -3, "x", "woodDark");
    landingMarker(c, 5, -7, 8);
    person(v, 0, 1, 4, L_ACC[k]);
    return;
  }
  if (lv === 3) {
    landingDeck(v, k, -2, 0, 1, hz - 1, 1);
    rail(v, k, -2, 0, -2, hz - 1);
    rail(v, k, 1, 0, 1, hz - 1);
    pontoon(v, k, -7, -hz, 6, -1);
    rail(v, k, -7, -hz, 6, -hz);
    shelter(v, k, -6, -12, 3, -4, 8);
    // glowing timetable board
    box(5, 1, -6, 5, 6, -6, "steelDark");
    box(4, 4, -6, 6, 6, -6, "charcoal");
    v.put(5, 5, -5, "amber", 1.1);
    v.put(4, 5, -5, "screenGreen", 1.1);
    bench(v, -4, 1, -8, "x", "woodDark");
    person(v, -2, 1, -6, L_ACC[k]);
    person(v, 1, 1, -10, "white");
    landingMarker(c, 5, -14, 9);
    lifeRing(v, -2, 4, 6);
    return;
  }
  if (lv === 4) {
    landingDeck(v, k, -2, -4, 1, hz - 1, 1);
    pontoon(v, k, -hx + 1, -hz, hx - 2, -4);
    for (const sx of [-1, 1]) {
      const bx = sx < 0 ? -hx + 2 : hx - 3;
      for (let z = -hz + 1; z < -5; z += 2) box(bx, 1, z, bx, 1, z, "rubber");
      lamp(v, bx, 1, -6, 4, "iron", sx < 0 ? "red" : "lime");
      c.blink(bx, 6, -6, sx < 0 ? "red" : "lime");
    }
    shelter(v, k, -5, -13, 4, -6, 9);
    clockFace(v, 0, 7, -5, 1);
    box(-5, 1, -12, 4, 1, -12, "woodDark");
    landingMarker(c, -hx + 3, -hz + 2, 10);
    landingMarker(c, hx - 4, -hz + 2, 10);
    for (let i = 0; i < 4; i++) person(v, -4 + i * 2, 1, -8 - (i % 2), ["red", "blue", "yellow", "teal"][i]);
    if (k === 3) for (let i = 0; i < 4; i++) box(-hx + 5 + i * 2, 1, -6, -hx + 6 + i * 2, 2, -5, ["orange", "leaf", "red", "yellow"][i]);
    return;
  }
  // Lv5: shore ticket hall + long pier + end pavilion + beacon
  landingDeck(v, k, -hx, 6, hx - 1, hz - 1, 0);
  landingDeck(v, k, -3, -hz + 10, 2, 6, 1);
  rail(v, k, -3, -hz + 10, -3, 6);
  rail(v, k, 2, -hz + 10, 2, 6);
  for (let z = -hz + 12; z < 6; z += 5) lamp(v, -3, 4, z, 3, "iron", k === 3 ? "red" : "warmGlow");
  pontoon(v, k, -hx + 1, -hz, hx - 2, -hz + 9);
  shelter(v, k, -8, -hz + 2, 7, -hz + 8, 10);
  // ticket hall
  const hall = ["cream", "#e8d9a8", "white", "#7a5232"][k];
  v.hollowBox(-hx + 2, 1, 9, 6, 10, hz - 2, hall, L_MAIN[k]);
  for (let x = -hx + 4; x < 5; x += 3) box(x, 4, hz - 2, x + 1, 6, hz - 2, "glass", 0.6);
  box(-4, 1, hz - 2, -3, 3, hz - 2, "woodDark");
  if (k === 0) gable(v, -hx + 1, 10, 8, 7, hz - 1, "x", L_MAIN[0], "red", "cream");
  else if (k === 1) hip(v, -hx + 1, 10, 8, 7, hz - 1, "#d8b86a", "#b8954a");
  else if (k === 2) {
    box(-hx + 1, 10, 8, 6, 10, hz - 1, "white");
    for (let i = 0; i < 3; i++) box(-hx + 2, 7 + i, hz - 2, 5, 7 + i, hz - 2, i === 1 ? "#2f6fd0" : "white");
    for (let y = 1; y < 12; y++) box(6, y, 12, 7, y, 14, y % 3 ? "white" : "#2f6fd0");
  } else hip(v, -hx + 1, 10, 8, 7, hz - 1, "#3d7a4a", "#2a5a34", 4);
  // harbour beacon on the end pavilion
  const bx = hx - 4,
    bz = -hz + 3;
  for (let y = 1; y < 15; y++) box(bx - 1, y, bz - 1, bx + 1, y, bz + 1, Math.floor(y / 3) % 2 ? L_MAIN[k] : "white");
  box(bx - 2, 15, bz - 2, bx + 2, 15, bz + 2, L_POST[k]);
  box(bx - 1, 16, bz - 1, bx + 1, 17, bz + 1, "warmGlow", 1.2);
  hip(v, bx - 2, 18, bz - 2, bx + 3, bz + 3, L_MAIN[k], L_POST[k], 2);
  c.blink(bx, 21, bz, "red");
  landingMarker(c, 10, 12, 12, true);
  for (let i = 0; i < 6; i++) person(v, -6 + i * 2, 1, -hz + 4 + (i % 3), ["red", "blue", "yellow", "teal", "white", "pink"][i]);
  person(v, 9, 1, 18, "blue", "steelDark", "#84583e");
}

// ---------------------------------------------------------------------------------------------
// TAXI RANK — always 1×1; it levels up in furniture and landmark height. The front curb strip
// (z 5..7) stays clear above the ground so cabs can pull in.
//   Lv1 Hailing Post → Lv2 Sheltered Rank → Lv3 Neighborhood Stand (waiting cab) → Lv4 Dispatch Kiosk
//   (radio mast, fare screen) → Lv5 Night Rank (giant glowing rooftop landmark)
// Styles: 0 Checker cab (yellow & black checks), 1 Googie (boomerang canopy, starburst, pink/teal
// finned cab), 2 Metro glass (glass box, cyan screens, white e-cab), 3 Lantern pavilion (green-tile
// pagoda roof, red lanterns, red cab).
// ---------------------------------------------------------------------------------------------
const CAB = ["busYellow", "pink", "white", "crimson"];
const CAB2 = ["black", "teal", "cyan", "#3d7a4a"];
function taxiCab(v: PixelVox, k: number, x: number, z: number) {
  const box = solidVoxels(v);
  box(x - 3, 1, z - 1, x + 3, 1, z + 1, CAB[k]);
  box(x - 2, 2, z - 1, x + 1, 2, z + 1, "glassDark");
  box(x - 3, 1, z - 1, x - 3, 1, z + 1, "silver");
  if (k === 0) for (let i = -3; i <= 3; i++) v.put(x + i, 1, z + 1, i % 2 ? "black" : "busYellow");
  if (k === 1) {
    box(x + 3, 2, z - 1, x + 3, 2, z - 1, "teal");
    box(x + 3, 2, z + 1, x + 3, 2, z + 1, "teal");
    box(x - 3, 1, z + 1, x + 3, 1, z + 1, "teal");
  }
  if (k === 2) box(x - 3, 1, z + 1, x + 3, 1, z + 1, "cyan", 0.4);
  if (k === 3) box(x - 2, 3, z - 1, x + 1, 3, z + 1, "#3d7a4a");
  v.put(x, 3, z, "warmGlow", 1.1);
  v.put(x + 3, 1, z, "warmGlow", 1);
  for (const dx of [-2, 2]) {
    v.put(x + dx, 0, z - 1, "rubber");
    v.put(x + dx, 0, z + 1, "rubber");
  }
}
function rankSign(c: Ctx, x: number, z: number, h: number) {
  const { v } = c,
    k = c.variant & 3,
    box = solidVoxels(v);
  if (k === 0) {
    box(x, 1, z, x, h, z, "black");
    for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 2; dy++) v.put(x + dx, h + 1 + dy, z, (dx + dy) % 2 ? "black" : "busYellow", 0.4);
  } else if (k === 1) {
    for (let y = 1; y <= h; y++) v.put(x + Math.floor(y / 4), y, z, "teal");
    const cx = x + Math.floor(h / 4);
    for (const [dx, dy] of [[0, 2], [0, -2], [2, 0], [-2, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) v.put(cx + dx, h + 2 + dy, z, dx * dy === 0 ? "yellow" : "pink", 0.9);
  } else if (k === 2) {
    box(x - 1, 1, z, x + 1, h, z, "glass", 0.3);
    box(x - 1, h - 2, z, x + 1, h, z, "screenCyan", 1);
  } else {
    box(x, 1, z, x, h, z, "#4a2f1f");
    box(x - 1, h + 1, z - 1, x + 1, h + 2, z + 1, "red", 1.1);
    v.put(x, h + 3, z, "gold");
    v.put(x, h, z, "gold");
  }
}
function rankShelter(c: Ctx, x0: number, x1: number) {
  const { v } = c,
    k = c.variant & 3,
    box = solidVoxels(v);
  const z0 = -7,
    z1 = -3;
  if (k === 0) {
    for (const x of [x0, x1]) box(x, 1, z0, x, 5, z0, "black");
    for (const x of [x0, x1]) box(x, 1, z1, x, 5, z1, "black");
    box(x0 - 1, 6, z0 - 1, x1 + 1, 6, z1 + 1, "black");
    for (let x = x0 - 1; x <= x1 + 1; x++) v.put(x, 6, z1 + 1, x % 2 ? "black" : "busYellow");
  } else if (k === 1) {
    box(Math.floor((x0 + x1) / 2), 1, z0 + 2, Math.floor((x0 + x1) / 2), 5, z0 + 2, "teal");
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      const y = 6 + Math.floor(Math.abs(x - (x0 + x1) / 2) / 2);
      box(x, y, z0, x, y, z1 + 1, x % 2 ? "teal" : "white");
    }
    v.put(x1 + 1, 6 + Math.floor((x1 - x0) / 4) + 1, z1 + 1, "pink", 1);
  } else if (k === 2) {
    box(x0, 1, z0, x1, 5, z0, "glass", 0.2);
    box(x0, 1, z0, x0, 5, z1, "glass", 0.2);
    box(x1, 1, z0, x1, 5, z1, "glass", 0.2);
    box(x0 - 1, 6, z0 - 1, x1 + 1, 6, z1 + 1, "steelLight");
    box(x0, 6, z1 + 1, x1, 6, z1 + 1, "screenCyan", 0.8);
  } else {
    for (const x of [x0, x1]) for (const z of [z0, z1]) box(x, 1, z, x, 5, z, "crimson");
    hip(v, x0 - 1, 6, z0 - 1, x1 + 2, z1 + 2, "#3d7a4a", "#2a5a34", 3);
    for (const x of [x0 - 1, x1 + 1]) v.put(x, 7, z1 + 1, "#3d7a4a");
    for (let x = x0 + 1; x < x1; x += 3) v.put(x, 5, z1 + 1, "red", 1.1);
  }
  bench(v, x0 + 1, 1, z0 + 1, "x", k === 2 ? "steelLight" : k === 3 ? "#4a2f1f" : "wood");
}
function rank(c: Ctx) {
  const { v, lv } = c,
    k = c.variant & 3,
    box = solidVoxels(v);
  box(-8, 0, -8, 7, 0, 7, ["concrete", "#e8dcc8", "#c9d4dc", "path"][k]);
  for (let x = -8; x <= 7; x++) v.put(x, 0, 7, (x + 8) % 4 < 2 ? (k === 1 ? "pink" : "busYellow") : "charcoal");
  for (let x = -6; x < 7; x += 3) box(x, 0, 5, x + 1, 0, 5, "white");
  // painted waiting bay
  box(-5, 0, 0, 4, 0, 0, "yellow");
  box(-5, 0, 4, 4, 0, 4, "yellow");
  rankSign(c, -7, 3, lvPickL(lv, [6, 7, 7, 8, 9]));
  person(v, -6, 1, 1, ["brick", "pink", "blue", "teal"][k]);
  if (lv >= 2) rankShelter(c, -6, lv >= 4 ? 1 : 5);
  if (lv >= 3) {
    taxiCab(v, k, lv >= 4 ? -2 : 0, 2);
    person(v, -1, 1, -1, "white");
  }
  if (lv >= 4) {
    // dispatch kiosk with radio mast and fare screen
    const kc = ["busYellow", "teal", "glass", "crimson"][k];
    box(3, 1, -7, 6, 5, -2, kc, k === 2 ? 0.3 : 0);
    box(4, 3, -2, 5, 4, -2, "screenGreen", 0.9);
    person(v, 4, 1, -4, "blue");
    box(3, 6, -7, 6, 6, -2, k === 3 ? "#3d7a4a" : "charcoal");
    box(6, 7, -7, 6, 12, -7, "steelDark");
    c.blink(6, 13, -7, "red");
    box(6, 1, 0, 6, 3, 0, "steelDark");
    v.put(6, 3, 1, "screenCyan", 1);
  }
  if (lv === 5) {
    if (k === 0) {
      box(-5, 7, -6, 0, 7, -4, "black");
      box(-4, 8, -6, -1, 9, -4, "busYellow", 0.9);
      for (let x = -4; x <= -1; x++) v.put(x, 9, -3, x % 2 ? "black" : "white", 0.6);
      box(-3, 10, -5, -2, 10, -5, "warmGlow", 1.2);
    } else if (k === 1) {
      box(-3, 8, -5, -3, 15, -5, "teal");
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        v.put(-3 + Math.round(Math.cos(a) * 2), 16 + Math.round(Math.sin(a) * 2), -5, i % 2 ? "pink" : "yellow", 1.1);
      }
      v.put(-3, 16, -5, "white", 1.2);
    } else if (k === 2) {
      box(-3, 7, -6, -1, 16, -4, "glass", 0.35);
      for (let y = 9; y <= 15; y += 3) box(-3, y, -6, -1, y, -4, "screenCyan", 1);
    } else {
      box(-3, 9, -5, -3, 14, -5, "#4a2f1f");
      for (let i = 0; i < 3; i++) box(-4 + i, 10 + i * 2, -6, -2 + i, 11 + i * 2, -4, "red", 1.1);
      v.put(-3, 16, -5, "gold");
    }
    lamp(v, 6, 1, 4, 5, "iron", k === 2 ? "screenCyan" : "warmGlow");
    person(v, 2, 1, 1, "orange");
  }
}
function lvPickL<T>(lv: number, a: readonly [T, T, T, T, T]): T {
  return a[Math.max(1, Math.min(5, lv)) - 1];
}

defineDesigns({
  ferry_landings: {
    footprints: ELEMENT_LEVEL_SPANS.ferry_landings,
    levels: ["Canal Steps", "Ticket Canopy", "Waterbus Landing", "Twin Berth", "Passenger Pier"],
    growth:
      "Stone steps into the water gain a gangway and canopied pontoon, a railed waterbus landing with a glowing timetable, a twin-berth T-pontoon, and finally a shore ticket hall, lamp-lit pier and harbour beacon.",
    build: landing,
  },
  taxi_ranks: {
    footprints: ELEMENT_LEVEL_SPANS.taxi_ranks,
    levels: ["Hailing Post", "Sheltered Rank", "Neighborhood Stand", "Dispatch Kiosk", "Night Rank"],
    growth:
      "A signed curb gains a styled shelter, a waiting cab, a dispatch kiosk with a radio mast, and finally a giant glowing rooftop landmark — the boarding strip by the street always stays open.",
    build: rank,
  },
});
