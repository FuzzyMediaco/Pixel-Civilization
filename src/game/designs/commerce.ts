/**
 * COMMERCE — shops, food, money & big business.
 *
 * Every element has a signature, readable-from-afar identity (rooftop mascots, neon, canopies) and grows
 * in a way that matches what it is (shops → strips → arcades, gas pump → EV hub, teller → financial HQ…).
 */
import {
  type Ctx,
  PixelVox,
  awning,
  car,
  chimney,
  door,
  fence,
  flag,
  flatRoof,
  flowerBed,
  gable,
  lamp,
  lot,
  person,
  sign,
  speckle,
  tree,
  truck,
  windows,
} from "./kit";
import { buildRestaurants } from "./highStreetDining";
import { buildClothingStores } from "./highStreetFashion";
import { buildThriftStores } from "./highStreetThrift";
import { buildBars } from "./highStreetTaverns";
import { buildGasStations } from "./highStreetFuel";
import { atms, buildings, businesses, shops } from "./commerceStreetfronts";
import { buildMalls } from "./shoppingCenters";
import { defineDesigns } from "./registry";
import { BANK, buildBank } from "./bank";
import { buildGrocery } from "./groceryMarket";
import { buildBlacksmith } from "./blacksmith";
import { buildDataCenters } from "./dataCenters";

type V = PixelVox;

// =============================================================================================
// Shared local helpers
// =============================================================================================

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "lime", "white", "sky", "magenta"];
const PANTS = ["blueDark", "charcoal", "woodDark", "indigo", "slate", "black"];
const SKINS = ["#e8b38f", "#c68642", "#8d5524", "#f1c27d", "#ffdbac"];

function folk(c: Ctx, x: number, z: number, y = 1): void {
  person(c.v, x, y, z, c.pick(SHIRTS), c.pick(PANTS), c.pick(SKINS));
}

/** Scatter n people on open ground in [x0,x1)×[z0,z1) */
function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, y = 1): void {
  if (x1 <= x0 || z1 <= z0) return;
  for (let i = 0; i < n; i++) folk(c, c.ri(x0, x1 - 1), c.ri(z0, z1 - 1), y);
}

/** Hollow building shell (solid walls, empty inside, optional floor slab cap) */
function shell(v: V, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: string): void {
  v.box(x0, y0, z0, x1, y1, z1, col);
  if (x1 - x0 > 2 && z1 - z0 > 2 && y1 - y0 > 2) v.clear(x0 + 1, y0, z0 + 1, x1 - 1, y1 - 1, z1 - 1);
}

/** Ground-floor shopfront on the +z plane z across [x0,x1): frame, glowing display glass, centred door */
function shopfront(v: V, x0: number, x1: number, y: number, z: number, h: number, frame: string, glass = "glass", doorCol = "woodDark", emit = 0.45): void {
  v.box(x0, y, z, x1, y + h, z + 1, frame);
  if (x1 - x0 >= 3) v.box(x0 + 1, y + 1, z, x1 - 1, y + h - 1, z + 1, glass, emit);
  const dx = Math.floor((x0 + x1) / 2) - 1;
  v.box(dx, y, z, dx + 2, y + h - 1, z + 1, doorCol);
}

/** Free-standing pylon sign: pole + glowing panel facing +z (and -z) */
function pylon(v: V, x: number, z: number, h: number, w: number, ph: number, panel: string, pole = "steelDark", border?: string): number {
  v.box(x, 1, z, x + 1, h, z + 1, pole);
  const x0 = x - Math.floor(w / 2);
  v.box(x0, h, z, x0 + w, h + ph, z + 1, panel, 0.9);
  if (border) {
    v.box(x0, h, z, x0 + w, h + 1, z + 1, border, 0.6);
    v.box(x0, h + ph - 1, z, x0 + w, h + ph, z + 1, border, 0.6);
  }
  return h + ph;
}

/** Café table with umbrella (umbrella colour) */
function cafeTable(v: V, x: number, z: number, umb: string, y = 1, umb2 = "white"): void {
  v.put(x, y, z, "steelDark");
  v.put(x, y + 1, z, "white");
  v.put(x - 1, y, z, "woodDark");
  v.put(x + 1, y, z, "woodDark");
  v.box(x, y + 2, z, x + 1, y + 4, z + 1, "silver");
  v.box(x - 1, y + 4, z - 1, x + 2, y + 5, z + 2, umb);
  v.put(x, y + 5, z, umb2);
}

/** String lights along x at height y between x0..x1 (alternating warm glow) */
function stringLights(v: V, x0: number, x1: number, y: number, z: number, cols = ["warmGlow", "yellow", "pink"]): void {
  for (let x = x0; x < x1; x++) {
    const sag = Math.round(Math.sin(((x - x0) / Math.max(1, x1 - x0)) * Math.PI) * 1);
    v.put(x, y - sag, z, x % 2 === 0 ? cols[(x >>> 1) % cols.length] : "charcoal", x % 2 === 0 ? 1.1 : 0);
  }
}

interface ShopStyle {
  walls: string[];
  awn: string[][];
  trim: string;
  roof: string;
  frame: string;
}
const SHOP_STYLES: ShopStyle[] = [
  { walls: ["brick", "cream", "#7fb7d8", "#9ccfa2", "brick2"], awn: [["red", "white"], ["teal", "white"], ["yellow", "orange"], ["#2f9e44", "white"], ["blue", "white"]], trim: "white", roof: "concreteDark", frame: "woodDark" },
  { walls: ["limestone", "cream", "limestone", "plaster"], awn: [["red", "red"], ["#2f6b3a", "#2f6b3a"], ["blueDark", "blueDark"], ["crimson", "crimson"]], trim: "marble", roof: "slate", frame: "charcoal" },
  { walls: ["brickDark", "brick", "#4a5d7a", "brick2", "#6b3b2a"], awn: [["orange", "white"], ["blue", "white"], ["red", "white"], ["#2f9e44", "white"]], trim: "white", roof: "slate", frame: "white" },
  { walls: ["white", "#f2d4dc", "concrete", "#d9e8f2", "cream"], awn: [["magenta", "magenta"], ["cyan", "cyan"], ["yellow", "yellow"], ["red", "red"]], trim: "charcoal", roof: "concreteDark", frame: "steelDark" },
];

/** Sidewalk strip with lamps */
function sidewalk(c: Ctx, z0: number, z1: number, lampCol = "iron", col = "concrete2"): void {
  const { v, hx } = c;
  v.box(-hx, 0, z0, hx, 1, z1, col);
  for (let x = -hx + 3; x < hx - 1; x += 10) lamp(v, x, 1, z1 - 1, 5, lampCol);
}

defineDesigns({
  shops: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Corner Boutique", "Neighboring Stalls", "Shopping Lane", "Merchants' Court", "Grand Market Quarter"],
    growth: "A single boutique gains neighboring sellers, a walkable shopping lane and a market quarter around its original counter.",
    build: shops,
  },
});

/** Company logo — little glowing emblem on a plinth/roof */
function logo(c: Ctx, x: number, y: number, z: number, size = 2): void {
  const { v } = c;
  const s = c.variant % 4;
  if (s === 2) {
    v.sphere(x + 0.5, y + size, z + 0.5, size, size, size, "screenCyan", 0.8);
    v.put(x, y + size * 2 + 1, z, "white", 1);
  } else if (s === 0) {
    v.box(x - size, y, z, x + size + 1, y + size * 2, z + 1, "orange", 0.8);
    v.box(x - size + 1, y + 1, z, x + size, y + size * 2 - 1, z + 1, "white", 0.8);
  } else if (s === 1) {
    for (let k = 0; k < size * 2; k++) v.put(x - size + k, y + k, z, "leafLight", 0.8), v.put(x + size - k, y + k, z, "leafLight", 0.8);
  } else {
    v.box(x - size, y, z, x + size + 1, y + 1, z + 1, "turquoise" in {} ? "teal" : "teal", 0.7);
    v.box(x, y, z, x + 1, y + size * 2, z + 1, "teal", 0.7);
    v.box(x - size, y + size, z, x + size + 1, y + size + 1, z + 1, "teal", 0.7);
  }
}

defineDesigns({
  grocery_store: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Produce Stand", "Corner Greengrocer", "Neighborhood Market", "Market Exchange", "Harvest Market Hall"],
    growth: "A produce stand grows into a walk-through orchard, a giant grocery cart, an arcade of harvest crates or a farmers’ market barn with covered stalls.",
    build: buildGrocery,
  },
  businesses: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["One-Desk Workshop", "Shared Studio", "Co-working Yard", "Linked Office Court", "Independent Makers Campus"],
    growth: "One desk becomes a shared studio. Connected workspaces, meeting decks and open-air courts fill the campus.",
    build: businesses,
  },
  buildings: {
    footprints: [[1, 1], [1, 1], [1, 1], [2, 2], [2, 2]],
    levels: ["Corner Studio", "Offices Above the Street", "Downtown Midrise", "Skyline Offices", "Landmark Commercial Tower"],
    growth: "A street-level studio adds a public lobby, occupied upper floors and a distinctive skyline crown.",
    build: buildings,
  },
});

// =============================================================================================
// CHEESESTEAK
// =============================================================================================

/** Giant cheesesteak hoagie along x: split roll, sizzling steak, drippy cheese, peppers */
function cheesesteak(v: V, cx: number, y: number, cz: number, L: number, w = 2): number {
  const crust = "#c47a35";
  const crumb = "#f3d9a0";
  // bottom roll: crusty outside, rounded ends
  v.box(cx - L, y, cz - w, cx + L, y + 2, cz + w + 1, crust);
  v.clear(cx - L, y, cz - w, cx - L + 1, y + 1, cz + w + 1);
  v.clear(cx + L - 1, y, cz - w, cx + L, y + 1, cz + w + 1);
  v.box(cx - L + 1, y + 1, cz + w, cx + L - 1, y + 2, cz + w + 1, crumb);
  // heaped chopped steak (dark brown), lumpy
  v.box(cx - L + 1, y + 2, cz - w + 1, cx + L - 1, y + 4, cz + w + 1, "#5a3418");
  for (let x = cx - L + 1; x < cx + L - 1; x++) if ((x & 1) === 0) v.put(x, y + 4, cz, "#6e4222");
  // green peppers & onions
  for (let x = cx - L + 2; x < cx + L - 2; x += 3) { v.put(x, y + 4, cz + w, "leaf"); v.put(x + 1, y + 3, cz + w, "#f3ead0"); }
  // bright melted cheese ribbon draped over the front with drips
  for (let x = cx - L + 1; x < cx + L - 1; x++) {
    v.put(x, y + 4, cz + w - 1 + ((x >> 1) & 1), "#ffcc00", 0.35);
    if (x % 3 === 0) v.box(x, y + 1, cz + w + 1, x + 1, y + 4, cz + w + 2, "#ffcc00", 0.35);
  }
  // back half of the roll hinged up behind the filling
  v.box(cx - L, y + 2, cz - w - 1, cx + L, y + 6, cz - w + 1, crust);
  v.box(cx - L + 1, y + 3, cz - w, cx + L - 1, y + 5, cz - w + 1, crumb);
  v.clear(cx - L, y + 5, cz - w - 1, cx - L + 1, y + 6, cz - w + 1);
  v.clear(cx + L - 1, y + 5, cz - w - 1, cx + L, y + 6, cz - w + 1);
  return y + 6;
}

/**
 * CHEESESTEAK SPOT — sidewalk grill cart → walk-up window → corner steak joint → rival neon corner → Cheesesteak Palace.
 * Signature: GIANT cheesesteak hoagie on the roof (spinning at Lv5) and a blaze of orange/red neon.
 *  V0 South-Philly Neon (orange & red neon overload)   V1 Brick Rowhouse (red brick, takeout window, stoops)
 *  V2 Stadium Tailgate (midnight green & silver)        V3 Food-Truck Yard (trucks, picnic tables, string lights)
 */
function buildCheesesteak(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const neonA = ["orange", "red", "#00a3a3", "yellow"][s];
  const neonB = ["red", "yellow", "silver", "magenta"][s];
  const wall = ["#2a2a33", "brick", "#0f4c4c", "#ffd23f"][s];
  lot(c, s === 3 ? "asphalt" : "concrete2");
  speckle(c, s === 3 ? "asphaltDark" : "concrete", 0.1);
  const neonTube = (x0: number, x1: number, y: number, z: number) => {
    for (let x = x0; x < x1; x++) v.put(x, y, z, (x & 1) ? neonA : neonB, 1.3);
  };
  const queue = (x: number, z0: number, n: number) => {
    for (let i = 0; i < n; i++) folk(c, x + (i % 2), z0 + i);
  };
  const shopBox = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    shell(v, x0, 1, z0, x1, h, z1, wall);
    // takeout windows + counter
    v.box(x0 + 1, 2, z1 - 1, x1 - 1, 5, z1, "glass", 0.8);
    v.box(x0 + 1, 2, z1, x1 - 1, 3, z1 + 1, "steelLight");
    // neon wrapped facade
    neonTube(x0, x1, h - 1, z1);
    neonTube(x0, x1, 6, z1);
    for (let y = 6; y < h; y++) { v.put(x0, y, z1, neonA, 1.3); v.put(x1 - 1, y, z1, neonA, 1.3); }
    v.box(x0 + 1, 7, z1, x1 - 1, h - 1, z1 + 1, s === 1 ? "cream" : "white", 0.5);
    for (let x = x0 + 2; x < x1 - 2; x += 2) v.put(x, 8, z1 + 1, neonB, 1.2);
    if (s === 1) {
      windows(c, x0, h, z0, x1, h + 5, z1, { stepV: 4, h: 2, w: 2, stepH: 4, emit: 0.4, sill: "white" });
      v.box(x0, h, z0, x1, h + 5, z1, wall);
      windows(c, x0, h, z0, x1, h + 5, z1, { stepV: 4, h: 2, w: 2, stepH: 4, emit: 0.4, sill: "white", faces: "se" });
      v.box(x0, h + 5, z0, x1, h + 6, z1 + 1, "white");
      return h + 6;
    }
    flatRoof(c, x0, h, z0, x1, z1, "concreteDark", wall, false);
    if (s === 2 && x1 - x0 >= 12) {
      // stadium scoreboard on the roof + pennants
      const mx = Math.floor((x0 + x1) / 2);
      v.box(mx - 1, h + 1, z0 + 1, mx + 1, h + 4, z0 + 2, "steelDark");
      v.box(mx - 6, h + 4, z0 + 1, mx + 6, h + 9, z0 + 2, "black");
      for (let x = mx - 5; x < mx + 5; x++) for (let yy = h + 5; yy < h + 8; yy++) if ((x + yy) % 3) v.put(x, yy, z0 + 2, yy === h + 7 ? "yellow" : "#00a3a3", 1.0);
      for (let x = x0; x < x1; x += 3) { v.put(x, h + 2, z1 - 1, "silver"); v.put(x, h + 3, z1 - 1, "#00a3a3"); v.put(x + 1, h + 3, z1 - 1, "#00a3a3"); }
    }
    return h + 1;
  };
  /** Food truck along x, serving hatch on +z; returns roof y */
  const foodTruck = (x0: number, z: number, col: string) => {
    v.box(x0, 1, z - 2, x0 + 10, 7, z + 2, col);
    v.box(x0 + 10, 1, z - 2, x0 + 13, 5, z + 2, col);
    v.box(x0 + 11, 3, z - 2, x0 + 13, 5, z + 2, "glassDark");
    v.box(x0 + 2, 3, z + 1, x0 + 8, 6, z + 2, "warmGlow", 0.8);
    v.box(x0 + 1, 6, z + 2, x0 + 9, 7, z + 4, "white");
    v.box(x0 + 2, 3, z + 2, x0 + 8, 4, z + 3, "steelLight");
    for (const wx of [x0 + 2, x0 + 10]) { v.put(wx, 0, z - 2, "rubber"); v.put(wx, 0, z + 1, "rubber"); }
    for (let x = x0; x < x0 + 10; x += 2) v.put(x, 7, z + 1, neonB, 1.2);
    c.smoke(x0 + 3, 8, z - 1, "smoke");
    return 7;
  };
  const picnic = (x: number, z: number) => {
    v.box(x, 1, z, x + 5, 2, z + 2, "woodLight");
    v.box(x, 1, z - 1, x + 5, 1, z, "woodDark");
    v.put(x + 1, 2, z, "red"); v.put(x + 3, 2, z + 1, "yellow");
  };
  if (s === 3 && lv >= 2 && lv <= 4) {
    // FOOD-TRUCK YARD: trucks around a string-lit yard of picnic tables
    const cols = ["#ffd23f", "#2ec4b6", "#ff7eb6"];
    const n = lv - 1;
    const tw = 14;
    for (let i = 0; i < n; i++) {
      const tx = -hx + 2 + i * (tw + 2);
      if (tx + 13 > hx) break;
      const tz = -hz + 5;
      const t = foodTruck(tx, tz, cols[i % 3]);
      cheesesteak(v, tx + 5, t, tz - 1, 4 + (lv >= 4 ? 1 : 0), 1);
    }
    for (let x = -hx + 3; x < hx - 6; x += 8) for (let z = 3; z < hz - 3; z += 5) picnic(x, z);
    for (const px of [-hx + 1, hx - 2]) v.box(px, 1, hz - 2, px + 1, 9, hz - 1, "woodDark");
    stringLights(v, -hx + 1, hx - 1, 9, hz - 2, ["yellow", "magenta", "cyan"]);
    if (lv >= 3) for (const px of [-hx + 1, hx - 2]) v.box(px, 1, 0, px + 1, 9, 1, "woodDark"), stringLights(v, -hx + 1, hx - 1, 9, 0, ["yellow", "magenta", "cyan"]);
    for (let i = 0; i < n; i++) queue(-hx + 6 + i * (tw + 2), -hz + 9, 3);
    crowd(c, -hx + 2, 2, hx - 2, hz - 2, 3 + lv);
    return;
  }

  if (lv === 1) {
    // GRILL CART with flat-top smoking + umbrella + mini hoagie sign
    v.box(-4, 2, -2, 4, 5, 2, "silver");
    v.box(-4, 5, -2, 4, 6, 2, "charcoal");
    v.box(-3, 6, -1, 3, 7, 1, "#7a4a2a");
    v.box(-4, 3, 2, 4, 4, 3, neonA, 0.8);
    v.put(-4, 1, -2, "rubber"); v.put(-4, 1, 1, "rubber"); v.put(3, 1, -2, "rubber"); v.put(3, 1, 1, "rubber");
    c.smoke(0, 8, 0, "smoke");
    v.box(-5, 1, -1, -4, 9, 0, "silver");
    for (let x = -9; x <= 0; x++) for (let z = -5; z <= 4; z++) if ((x + 4) ** 2 + (z + 0.5) ** 2 < 22) v.put(x, 9, z, ((x + z) & 2) ? neonA : "white");
    cheesesteak(v, 0, 10, 0, 4, 1);
    queue(-1, 4, 3);
    return;
  }
  if (lv === 2) {
    const top = shopBox(-hx + 2, -hz + 2, hx - 2, hz - 5, 10);
    cheesesteak(v, 0, top, -1, 5, 2);
    queue(-hx + 3, hz - 4, 4);
    v.box(hx - 4, 1, hz - 2, hx - 2, 3, hz - 1, "steelDark"); // trash can
    return;
  }
  if (lv === 3) {
    // corner joint with picnic tables, condiment station, queue around the block
    const bx1 = hx - 10;
    const top = shopBox(-hx + 2, -hz + 2, bx1, hz - 5, 11);
    cheesesteak(v, Math.floor((-hx + 2 + bx1) / 2), top, -1, 7, 2);
    for (let z = -hz + 3; z < hz - 3; z += 5) {
      v.box(bx1 + 2, 1, z, hx - 2, 2, z + 2, "woodLight");
      v.box(bx1 + 2, 1, z - 1, hx - 2, 1, z, "woodDark");
      v.put(bx1 + 3, 2, z, "red"); v.put(bx1 + 5, 2, z + 1, "yellow");
    }
    queue(-hx + 3, hz - 4, 4);
    crowd(c, bx1 + 1, -hz + 2, hx - 1, hz - 1, 4);
    pylon(v, hx - 3, hz - 2, 7, 4, 3, neonA, "steelDark", neonB);
    return;
  }
  if (lv === 4) {
    // RIVAL NEON CORNER: two competing joints across a little plaza, each with a hoagie
    const zA1 = -1;
    const t1 = shopBox(-hx + 2, -hz + 2, hx - 12, zA1 + 0, 12);
    cheesesteak(v, Math.floor((-hx + 2 + hx - 12) / 2), t1, -hz + 6, 6, 2);
    // rival on the right, facing +z too, different colours (swap neon)
    const wall0 = wall;
    void wall0;
    shell(v, hx - 10, 1, -hz + 4, hx - 2, 14, 4, neonB === "yellow" ? "#3a2a1a" : "#3a1a1a");
    v.box(hx - 9, 2, 3, hx - 3, 5, 4, "glass", 0.8);
    for (let y = 6; y < 14; y++) v.box(hx - 10, y, 3, hx - 2, y + 1, 4, (y & 1) ? neonB : "white", 1.0);
    flatRoof(c, hx - 10, 14, -hz + 4, hx - 2, 4, "concreteDark", neonB, false);
    cheesesteak(v, hx - 6, 15, -hz + 9, 3, 1);
    // plaza w/ picnic tables, queue lines for both
    v.box(-hx + 1, 0, 1, hx - 1, 1, hz - 1, "path2");
    for (let x = -hx + 4; x < hx - 6; x += 7) { v.box(x, 1, 7, x + 4, 2, 9, "woodLight"); v.put(x + 1, 2, 7, "yellow"); }
    queue(-hx + 6, 1, 5);
    queue(hx - 7, 5, 5);
    car(v, hx - 5, 1, hz - 3, "x", "white");
    lamp(v, -2, 1, hz - 3, 6, "iron", neonA);
    return;
  }
  // The restaurant itself is a sliced hoagie: tapered heel, charred filling, melting cheese
  // and a split golden roll. The ordering hatches occupy the exposed steak layer.
  const bread = ["#d89649", "#d0863f", "#bc8548", "#de9a49"][s];
  const toast = ["#a55f32", "#af6630", "#925431", "#be7538"][s];
  const width = hx - 1, deep = Math.min(hz - 5, 7), centerZ = -1;
  for (let x = -width; x < width; x++) {
    const t = (x + 0.5) / width;
    const half = Math.max(1, Math.round(deep * Math.sqrt(Math.max(0, 1 - t ** 4))));
    const end = Math.min(1, (1 - Math.abs(t)) * 5);
    for (let z = -half; z < half; z++) {
      const wz = centerZ + z, across = Math.abs((z + 0.5) / half);
      const crown = Math.sqrt(Math.max(0, 1 - across * across)) * end;
      const split = across < 0.16 ? 2 : 0;
      const roof = Math.max(11, 11 + Math.round(crown * (s === 1 ? 5 : 4)) - split);
      v.box(x, 1, wz, x + 1, 4, wz + 1, across > 0.78 ? toast : bread);
      v.put(x, 4, wz, "#f4cb85");
      v.box(x, 5, wz, x + 1, 9, wz + 1, (x * 7 + z * 3) % 5 ? "#794328" : "#aa6134");
      if (z===half-1 || z===-half) {
        const fold=5+Math.abs((x*3+z)%3);
        v.put(x,fold,wz+Math.sign(z),"#ae6b43");
        if(x%5===0) v.put(x,fold+1,wz+Math.sign(z), "#dcaa71");
      }
      v.put(x, 9, wz, "#ffb722");
      v.put(x, 10, wz, "#fae0a2");
      v.box(x, 11, wz, x + 1, roof + 1, wz + 1, bread);
      if (across < 0.18 || ((x + z + 48) % 8 < 2 && z > 1 && z < half - 2))
        v.put(x, roof, wz, across < 0.18 ? "#b87c46" : "#ffdc94");
      if ((z === half - 1 || z === -half) && Math.abs(x) < width - 2) {
        const out = wz + (z < 0 ? -1 : 1);
        if ((x + width) % 7 < 3) v.box(x, 7 + Math.abs(x % 3), out, x + 1, 10, out + 1, "yellow");
        else v.put(x, 8, out, (x & 1) ? "leaf" : "terracotta");
      }
    }
    if (Math.abs(t) < 0.7 && x % 7 !== 0) {
      const facade = centerZ + half;
      v.box(x, 5, facade, x + 1, 8, facade + 1, s === 2 ? "glassDark" : "warmGlow", 0.55);
      v.put(x, 4, facade + 1, s === 3 ? "white" : "steelLight");
    }
  }
  const doorZ = centerZ + deep;
  v.box(-1, 1, doorZ, 2, 7, doorZ + 1, "steelDark");
  v.box(0, 2, doorZ, 2, 6, doorZ + 1, "glassDark", 0.28);
  v.box(-3, 7, doorZ, 4, 8, doorZ + 3, neonA, 0.75);
  const patio = hz - 3;
  for (const x of [-hx + 4, hx - 5]) {
    cafeTable(v, x, patio, neonA, 1);
    if (s === 3) v.box(x - 3, 6, patio - 1, x + 3, 7, patio + 2, x < 0 ? "teal" : "magenta");
  }
  if (s === 0) stringLights(v, -hx + 2, hx - 2, 6, patio, ["red", "amber", "warmGlow"]);
  if (s === 1) v.box(-hx + 1, 1, patio - 1, -hx + 3, 6, patio, "brickDark");
  if (s === 2) flag(v, hx - 3, 1, patio, 10, ["tealDark", "white", "silver"]);
  c.smoke(-6, 16, centerZ - 3, "steam");

}

defineDesigns({
  restaurants: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Street Food Stand", "Takeaway Counter", "Sidewalk Kitchen", "Dining Court", "Walk-In Supper Club"],
    growth: "A counter grows into a full-service destination where the meal becomes the architecture.",
    build: buildRestaurants,
  },
  cheesesteak_restaurants: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Sidewalk Grill Cart", "Walk-Up Steak Window", "Corner Steak Joint", "Rival Neon Corner", "Cheesesteak Palace"],
    growth: "A smoking grill cart becomes a walk-up window, a corner joint with picnic tables, a neon rivalry across the plaza and a walk-in hoagie with glowing order windows between its toasted rolls.",
    build: buildCheesesteak,
  },
  bars: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Corner Tap", "Neighborhood Lounge", "Courtyard Bar", "Evening Social Club", "Skyline Supper Bar"],
    growth: "The first drinks counter gains communal seating, an outdoor lounge and a landmark gathering place after dark.",
    build: buildBars,
  },
});

// =============================================================================================
// SHOE STORES
// =============================================================================================

/** Giant shoe, toe pointing +x. kind 0 sneaker, 1 cowboy boot, 2 stiletto, 3 clog. Scale k (~1 = 12 long). */
function giantShoe(v: V, x: number, y: number, z: number, k: number, kind: number, emit = 0): number {
  const B = (a: number, b: number, c0: number, d: number, e: number, f: number, col: string, em = emit) =>
    v.box(x + Math.round(a * k), y + Math.round(b * k), z + Math.round(c0 * k), x + Math.max(Math.round(d * k), Math.round(a * k) + 1), y + Math.max(Math.round(e * k), Math.round(b * k) + 1), z + Math.max(Math.round(f * k), Math.round(c0 * k) + 1), col, em);
  if (kind === 0) {
    // high-top sneaker
    B(0, 0, -2.5, 12, 1, 2.5, "white");
    B(0, 1, -2.5, 9, 4, 2.5, "red");
    B(9, 1, -2, 12, 3, 2, "red");
    B(10, 1, -2.5, 12.5, 2, 2.5, "white");
    B(0, 4, -2.5, 5, 8, 2.5, "red");
    B(0, 8, -2.5, 5, 9, 2.5, "white");
    B(1, 2, 2.5, 8, 3, 3, "white"); // side swoosh stripe
    B(1, 2, -3, 8, 3, -2.5, "white");
    for (let i = 0; i < 4; i++) B(5 + i, 4 - Math.min(i, 2) * 0.5, -1, 6 + i, 4.5, 1, "white");
    B(0, 4, -1, 0.6, 8, 1, "white");
    return y + Math.round(9 * k);
  }
  if (kind === 1) {
    // cowboy boot: heel, pointed toe, tall shaft, stitched stars
    B(0, 0, -2, 3, 2, 2, "woodDark");
    B(3, 1, -2, 11, 2, 2, "woodDark");
    B(0, 2, -2.5, 9, 4, 2.5, "#8b4a1f");
    B(9, 2, -1.5, 12, 3, 1.5, "#8b4a1f");
    B(12, 2, -0.5, 13, 3, 0.5, "#8b4a1f");
    B(0, 4, -2.5, 5, 12, 2.5, "#8b4a1f");
    B(-0.5, 11, -2.5, 5.5, 12, 2.5, "#5a2e10");
    B(1, 6, 2.5, 4, 9, 3, "#d9a55b");
    B(2, 7, 3, 3, 8, 3.3, "gold", 0.5);
    return y + Math.round(12 * k);
  }
  if (kind === 2) {
    // stiletto: toe platform, arched sole rising to heel, thin heel spike, ankle strap
    B(7, 0, -2, 12, 1, 2, "magenta");
    B(7, 1, -2.5, 12, 3, 2.5, "magenta");
    for (let i = 0; i < 7; i++) B(i, 6 - i * 0.7, -2, i + 1, 7 - i * 0.7, 2, "magenta");
    B(0, 0, -0.5, 1, 6, 0.5, "black");
    B(0, 6, -2.5, 3, 8, 2.5, "magenta");
    B(3, 6.5, 2, 4, 7.5, 2.5, "gold", 0.6);
    B(10, 2.5, -1, 11, 3.5, 1, "pink", 0.8);
    return y + Math.round(8 * k);
  }
  // Dutch clog: carved yellow wood, upturned toe, open top
  B(0, 0, -2.5, 10, 5, 2.5, "#f2c14e");
  B(10, 1, -2, 12, 4, 2, "#f2c14e");
  B(12, 3, -1, 13, 5, 1, "#f2c14e");
  B(1, 4, -1.5, 6, 5, 1.5, "woodDark");
  B(3, 2, 2.5, 9, 3, 2.8, "red");
  B(5, 3, 2.5, 7, 4, 2.8, "leaf");
  return y + Math.round(5 * k);
}

/**
 * SHOE STORES — cobbler kiosk → shoe shop → sneaker store with shoe wall → flagship → THE GIANT SHOE HOUSE
 * (at Lv5 the building itself is a colossal shoe). Signature: a giant rooftop shoe.
 *  V0 Sneaker Culture (red/white high-top, urban)   V1 Western Boot Barn (cowboy boot, timber, rodeo)
 *  V2 Glam Heels (magenta stiletto, pink marble)     V3 Dutch Clog Maker (yellow clog, windmill, tulips)
 */
function buildShoes(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["white", "woodLight", "#f8d0e0", "brick"][s];
  const trim = ["red", "woodDark", "gold", "white"][s];
  const glassCol = ["glass", "warmGlow", "pink", "glass"][s];
  lot(c, ["asphalt", "sand", "marble", "grass2"][s]);
  speckle(c, ["asphaltDark", "sandDark", "white", "grass3"][s], 0.1);
  const shoeRow = (x0: number, x1: number, y: number, z: number) => {
    const cols = s === 0 ? ["red", "white", "lime", "blue", "black"] : s === 1 ? ["#8b4a1f", "woodDark", "black", "#d9a55b"] : s === 2 ? ["magenta", "pink", "gold", "black", "crimson"] : ["#f2c14e", "red", "woodLight", "white"];
    for (let x = x0; x < x1; x += 2) v.put(x, y, z, c.pick(cols), 0.5);
  };
  const tulips = (x0: number, x1: number, z: number) => {
    if (s !== 3) return;
    for (let x = x0; x < x1; x++) { v.put(x, 0, z, "soil"); v.put(x, 1, z, "leaf"); v.put(x, 2, z, ["red", "yellow", "pink", "orange"][x & 3]); }
  };
  const store = (x0: number, z0: number, x1: number, z1: number, floors: number): number => {
    const fh = 5;
    const top = 1 + floors * fh;
    shell(v, x0, 1, z0, x1, top, z1, wall);
    if (s === 0) for (let y = 2; y < top; y += 3) v.box(x0, y, z0, x0 + 1, y + 1, z1, c.pick(["magenta", "lime", "cyan"]), 0.3);
    if (s === 1) for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, top, z1, "wood");
    v.box(x0 + 1, 2, z1 - 1, x1 - 1, 5, z1, glassCol, 0.55);
    for (let y = 2; y < 5; y++) shoeRow(x0 + 2, x1 - 2, y, z1 - 1);
    for (let f = 1; f < floors; f++) {
      v.box(x0 + 1, 2 + f * fh, z1 - 1, x1 - 1, 5 + f * fh, z1, glassCol, 0.55);
      shoeRow(x0 + 2, x1 - 2, 3 + f * fh, z1 - 1);
    }
    door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, s === 2 ? "gold" : "glassDark");
    v.box(x0, top - 1, z0, x1, top, z1 + 1, trim);
    if (s === 1) { v.box(x0, top, z1 - 1, x1, top + 4, z1, "woodLight"); v.box(x0, top + 3, z1 - 1, x1, top + 4, z1, "woodDark"); flatRoof(c, x0, top, z0, x1, z1 - 1, "woodDark", "woodLight", false); return top + 1; }
    if (s === 3) return gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "z", "#d9622b", "white") - 3;
    if (s === 2) { awning(v, x0, x1, 5, z1, "pink", "white"); }
    if (s === 0) awning(v, x0, x1, 5, z1, "red", "white");
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", trim, false);
    return top + 1;
  };

  if (lv === 1) {
    // COBBLER KIOSK: tiny booth with hammer sign, shoe-shine chair, small shoe on a pole
    v.box(-5, 1, -4, 4, 7, 2, wall);
    v.box(-4, 2, 1, 3, 5, 2, glassCol, 0.5);
    shoeRow(-3, 3, 3, 1);
    v.box(-6, 7, -5, 5, 8, 3, trim);
    v.box(-5, 8, -4, 4, 9, 2, trim);
    // shoe-shine chair
    v.box(2, 1, 4, 5, 3, 6, "woodDark");
    v.box(2, 3, 5, 5, 5, 6, "crimson");
    folk(c, 3, 4, 3);
    folk(c, 1, 4);
    v.box(-hx + 3, 1, hz - 3, -hx + 4, 9, hz - 2, "steelDark");
    giantShoe(v, -hx + 1, 9, hz - 3, 0.45, s);
    tulips(-hx + 1, hx - 1, hz - 1);
    if (s === 3) { tulips(-hx + 1, hx - 1, -hz + 1); }
    return;
  }
  if (lv === 2) {
    const top = store(-hx + 2, -hz + 2, hx - 2, hz - 5, 1);
    giantShoe(v, -6, top, -2, 0.85, s, 0.05);
    v.box(-hx, 0, hz - 5, hx, 1, hz, s === 1 ? "woodLight" : "path2");
    tulips(-hx + 1, hx - 1, hz - 1);
    crowd(c, -hx + 2, hz - 4, hx - 2, hz - 2, 2);
    return;
  }
  if (lv === 3) {
    const top = store(-hx + 2, -hz + 2, hx - 2, hz - 5, 2);
    giantShoe(v, -8, top, -2, 1.3, s, 0.05);
    v.box(-hx, 0, hz - 5, hx, 1, hz, s === 1 ? "woodLight" : "path2");
    if (s === 1) { fence(v, -hx + 1, hz - 3, hx - 1, hz - 1, 1, 2, "woodDark", [-2, 2]); v.box(hx - 6, 1, hz - 4, hx - 4, 4, hz - 3, "#8b4a1f"); }
    if (s === 3) tulips(-hx + 1, hx - 1, hz - 1);
    if (s === 0) { for (let x = -hx + 2; x < -hx + 12; x += 2) folk(c, x, hz - 3); } // sneaker drop queue
    crowd(c, -hx + 2, hz - 4, hx - 2, hz - 1, 3);
    return;
  }
  if (lv === 4) {
    // FLAGSHIP: two-storey store + glass shoe-wall tower + giant shoe crown; plaza
    const z1 = hz - 8;
    const top = store(-hx + 2, -hz + 2, hx - 2, z1, 3);
    giantShoe(v, -9, top, -4, 1.6, s, 0.1);
    v.box(-hx, 0, z1, hx, 1, hz, s === 1 ? "woodLight" : s === 2 ? "white" : "path2");
    // display plinth with a shoe on the plaza
    v.box(hx - 9, 1, z1 + 2, hx - 2, 3, hz - 2, trim);
    giantShoe(v, hx - 9, 3, z1 + 4, 0.55, s);
    if (s === 3) {
      // little windmill
      const wx = -hx + 4;
      const wz = z1 + 4;
      v.cone(wx, 1, 12, wz, 2.6, 1.6, "woodLight");
      v.box(wx - 1, 12, wz - 1, wx + 2, 14, wz + 2, "#d9622b");
      const rot = new PixelVox(4);
      for (let i = -6; i <= 6; i++) { rot.put(i, 0, 0, "white"); rot.put(0, i, 0, "white"); }
      c.addRotor({ vox: rot, pivot: [wx, 12, wz + 3], axis: "z", speed: 1, wind: true });
    }
    crowd(c, -hx + 2, z1 + 1, hx - 10, hz - 1, 6);
    return;
  }
  // L5 THE GIANT SHOE HOUSE — the building is a colossal shoe with windows, door in the heel, garden & fence
  const k = Math.min(3, (2 * hx - 4) / 12.5);
  const sx = -hx + 3;
  const sz = -3;
  const top = giantShoe(v, sx, 1, sz, k, s);
  // punch windows & door into the shoe's +z side
  const zSide = sz + Math.round(2.5 * k) - 1;
  for (let x = sx + 3; x < sx + Math.round(9 * k); x += 4) for (let y = 4; y < top - 4; y += 5) {
    v.box(x, y, zSide, x + 2, y + 2, zSide + 1, "warmGlow", 0.7);
  }
  v.box(sx + Math.round(1 * k), 1, zSide, sx + Math.round(1 * k) + 2, 5, zSide + 1, "woodDark");
  v.box(sx + Math.round(1 * k), 0, zSide + 1, sx + Math.round(1 * k) + 2, 1, hz, "path");
  // chimney with smoke from the collar/shaft
  chimney(v, sx + 2, top - 1, sz - 2, 4, "brickDark");
  c.smoke(sx + 3, top + 3, sz - 1, "smoke");
  // garden & picket fence & tour line
  fence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 2, s === 1 ? "woodDark" : "white", [-hx + 4, -hx + 10]);
  flowerBed(c, hx - 10, hz - 4, hx - 2, hz - 2, 1);
  tulips(-hx + 2, hx - 2, -hz + 2);
  tree(v, hx - 4, 1, -hz + 4, s === 3 ? "round" : s === 1 ? "oak" : "blossom", 1, 2);
  crowd(c, -hx + 3, sz + Math.round(3 * k), hx - 3, hz - 2, 6);
  c.blink(sx + Math.round(6 * k), top + 1, sz, "white");
}

defineDesigns({
  clothing_stores: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Clothes Stand", "Fitting Room", "Neighborhood Atelier", "Fashion Arcade", "House of Fashion"],
    growth: "A fitting counter gains a working atelier, displays for the street and a room for its own collection.",
    build: buildClothingStores,
  },
  thrift_stores: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["Yard Sale", "Secondhand Shop", "Curiosity Exchange", "Vintage Courtyard", "Great Flea Bazaar"],
    growth: "A few finds on a table become a shop, an outdoor exchange and a bazaar for the whole district.",
    build: buildThriftStores,
  },
  shoe_stores: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Cobbler's Kiosk", "Shoe Shop", "Sneaker Store", "Shoe Flagship", "The Giant Shoe House"],
    growth: "The rooftop shoe grows bigger every level until, at Lv5, the whole building IS a colossal shoe.",
    build: buildShoes,
  },
});

defineDesigns({
  blacksmiths: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["Wayside Iron", "Smith’s Workshop", "Ironworking Yard", "Foundry Arcade", "Master Ironworks"],
    growth: "Follow a hot billet through a walk-in anvil, a pouring crucible, a farrier’s horseshoe arcade or a waterwheel-driven hammer house.",
    build: buildBlacksmith,
  },
});

defineDesigns({
  gas_stations: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 2]],
    levels: ["Roadside Pump", "Service Island", "Motor Court", "Travel Plaza", "Highway Landmark"],
    growth: "A single roadside stop grows sheltered pumps, service bays and a skyline marker visible from the highway.",
    build: buildGasStations,
  },
  atms: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Corner Cash Slot", "Double-Service Kiosk", "Walk-Up Exchange", "Night Deposit Booth", "Neighborhood Cash Landmark"],
    growth: "A sidewalk cash machine gains a second service point, a walk-up counter and a glowing neighborhood landmark.",
    build: atms,
  },
  banks: {
    footprints: [[1, 1], [2, 1], [2, 2], [2, 2], [2, 2]],
    levels: BANK.levels,
    growth: BANK.growth,
    build: buildBank,
  },
  malls: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Shop Walk", "Market Arcade", "Food Court District", "Grand Promenade", "Landmark Emporium"],
    growth: "A walk between local shops gains an anchor store, a food court, upper promenades and a destination above the shop roofs.",
    build: buildMalls,
  },
  data_centers: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [4, 4]],
    levels: ["Local Node", "Paired Exchange", "Distribution Yard", "Interconnect Campus", "Regional Compute Works"],
    growth: "Follow the service aisles between walk-in server racks, paired hot and cold server aisles, open cooling fans or arching bundles of fiber.",
    build: buildDataCenters,
  },
});
