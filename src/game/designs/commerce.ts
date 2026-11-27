/**
 * COMMERCE — shops, food, money & big business.
 *
 * Every element has a signature, readable-from-afar identity (rooftop mascots, neon, canopies) and grows
 * in a way that matches what it is (shops → strips → arcades, gas pump → EV hub, teller → financial HQ…).
 */
import {
  type Ctx,
  PixelVox,
  acUnit,
  antenna,
  awning,
  barrelRoof,
  bench,
  byLv,
  car,
  CAR_COLORS,
  chimney,
  curtainWall,
  cyl,
  door,
  fence,
  flag,
  flatRoof,
  flowerBed,
  fountain,
  gable,
  helipad,
  hip,
  lamp,
  lot,
  mansard,
  parking,
  pediment,
  person,
  ribbonWindows,
  ring,
  sawtooth,
  securityFence,
  sign,
  solarRow,
  speckle,
  stairs,
  tree,
  truck,
  windows,
} from "./kit";
import { buildRestaurants } from "./highStreetDining";
import { buildClothingStores } from "./highStreetFashion";
import { buildThriftStores } from "./highStreetThrift";
import { buildBars } from "./highStreetTaverns";
import { buildGasStations } from "./highStreetFuel";
import { defineDesigns } from "./registry";
import { BANK, buildBank } from "./bank";
import { buildGrocery } from "./groceryMarket";

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

/** Display items painted onto a window plane (mannequins, goods): random coloured dots */
function displayDots(c: Ctx, x0: number, x1: number, y0: number, y1: number, z: number, cols: string[], density = 0.35): void {
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (c.rand() < density) c.v.put(x, y, z, c.pick(cols), 0.5);
}

/** Mannequin on a window plane: head + body in a dress colour */
function mannequin(v: V, x: number, y: number, z: number, dress: string): void {
  v.put(x, y, z, dress, 0.4);
  v.put(x, y + 1, z, dress, 0.4);
  v.put(x, y + 2, z, "#f1d2b6", 0.4);
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

/** Potted plant */
function pot(v: V, x: number, z: number, y = 1, leaf = "leaf", flower?: string): void {
  v.put(x, y, z, "terracotta");
  v.put(x, y + 1, z, leaf);
  if (flower) v.put(x, y + 2, z, flower);
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

/** Vertical projecting blade sign (Tokyo/Broadway style) on the +z face */
function bladeSign(v: V, x: number, y0: number, y1: number, z: number, col: string, dots = "white"): void {
  v.box(x, y0, z, x + 1, y1, z + 3, col, 0.9);
  for (let y = y0 + 1; y < y1 - 1; y += 2) v.put(x, y, z + 1, dots, 1.1);
}

/** Produce crates in a row along x (front display): crate + coloured fruit top */
function produceCrates(c: Ctx, x0: number, x1: number, z: number, y = 1): void {
  const cols = ["red", "orange", "yellow", "lime", "leaf", "purple", "crimson"];
  for (let x = x0; x < x1; x += 2) {
    c.v.box(x, y, z, x + 2, y + 1, z + 1, "crate");
    c.v.box(x, y + 1, z, x + 2, y + 2, z + 1, c.pick(cols));
  }
}

// =============================================================================================
// SHOPS — Main Street americana / Parisian / Dutch canal / Tokyo neon
// =============================================================================================

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

/** One shop unit on [x0,x1)×[z0,z1) facing +z, `floors` storeys. Returns top y. */
function shopUnit(c: Ctx, x0: number, x1: number, z0: number, z1: number, floors: number, idx: number): number {
  const { v } = c;
  const s = c.variant % 4;
  const st = SHOP_STYLES[s];
  const wall = st.walls[idx % st.walls.length];
  const [a1, a2] = st.awn[idx % st.awn.length];
  const fh = 4;
  const top = 1 + floors * fh + 1;
  shell(v, x0, 1, z0, x1, top, z1, wall);
  shopfront(v, x0, x1, 1, z1 - 1, 4, st.frame, "glass", s === 3 ? "steelDark" : "woodDark");
  displayDots(c, x0 + 1, x1 - 1, 2, 4, z1 - 1, ["red", "yellow", "pink", "teal", "white"], 0.18);
  if (floors > 1) windows(c, x0, 1 + fh, z0, x1, top - 1, z1, { faces: "se", stepV: fh, h: 2, w: s === 2 ? 1 : 2, stepH: 3, emit: 0.4, sill: st.trim });
  if (s === 1) {
    // Parisian: awnings full width, iron balconies, mansard roof w/ dormers
    awning(v, x0, x1, 5, z1, a1, a2);
    for (let y = 1 + fh * 2; y < top - 1; y += fh) v.box(x0, y, z1, x1, y + 1, z1 + 1, "charcoal");
    v.box(x0, top - 1, z0, x1, top, z1 + 1, st.trim);
    mansard(v, x0, top, z0, x1, z1, st.roof, "slateLight", "glass");
    return top + 4;
  }
  if (s === 2) {
    // Dutch canal house: front stepped gable, hoist beam, white trim
    awning(v, x0 + 1, x1 - 1, 5, z1, a1, a2);
    v.box(x0, top - 1, z1 - 1, x1, top, z1, st.trim);
    const w = x1 - x0;
    let gy = top;
    for (let k = 0; k * 2 < w / 2; k++) {
      v.box(x0 + k * 2, gy, z0, x1 - k * 2, gy + 2, z1, wall);
      v.box(x0 + k * 2, gy + 1, z1 - 1, x0 + k * 2 + 1, gy + 2, z1, st.trim);
      v.box(x1 - k * 2 - 1, gy + 1, z1 - 1, x1 - k * 2, gy + 2, z1, st.trim);
      gy += 2;
    }
    const mx = Math.floor((x0 + x1) / 2);
    v.box(mx, gy - 2, z1, mx + 1, gy - 1, z1 + 2, "woodDark"); // hoist beam
    v.put(mx, top + 1, z1 - 1, "glass", 0.5);
    return gy;
  }
  if (s === 3) {
    // Tokyo: flat roof, vertical blade sign, lanterns, billboard
    awning(v, x0, x1, 5, z1, a1, a2);
    v.box(x0, top - 1, z0, x1, top, z1, st.trim);
    flatRoof(c, x0, top - 1, z0, x1, z1, "concreteDark", "steelDark", false);
    bladeSign(v, x1 - 1, 6, Math.max(top - 1, 10), z1, a1);
    v.put(x0 + 1, 5, z1, "red", 1);
    v.put(x0 + 1, 4, z1, "red", 1);
    if (floors >= 2) v.box(x0 + 1, top + 1, z1 - 2, x1 - 2, top + 4, z1 - 1, c.pick(["screenCyan", "magenta", "yellow"]), 0.9);
    return top + 4;
  }
  // Main Street: cornice, sign band, striped awning, flat roof with parapet
  awning(v, x0, x1, 5, z1, a1, a2);
  sign(v, x0 + 1, x1 - 1, 6, 8, z1, a1 === "white" ? "teal" : a1, 0.6, st.trim);
  v.box(x0, top - 1, z0, x1, top, z1 + 1, st.trim);
  flatRoof(c, x0, top - 1, z0, x1, z1, st.roof, wall, false);
  return top + 1;
}

/** Row of shop units across [x0,x1) */
function shopRow(c: Ctx, x0: number, x1: number, z0: number, z1: number, unitW: number, floorsFn: (i: number) => number, idx0 = 0): void {
  const n = Math.max(1, Math.floor((x1 - x0) / unitW));
  const w = Math.floor((x1 - x0) / n);
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w;
    const b = i === n - 1 ? x1 : a + w;
    shopUnit(c, a, b, z0, z1, floorsFn(i), idx0 + i);
  }
}

/** Sidewalk strip with lamps */
function sidewalk(c: Ctx, z0: number, z1: number, lampCol = "iron", col = "concrete2"): void {
  const { v, hx } = c;
  v.box(-hx, 0, z0, hx, 1, z1, col);
  for (let x = -hx + 3; x < hx - 1; x += 10) lamp(v, x, 1, z1 - 1, 5, lampCol);
}

/** Giant shopping-bag rooftop sign */
function shoppingBag(v: V, cx: number, y: number, cz: number, col: string, h = 7): number {
  const w = Math.max(3, Math.round(h * 0.6));
  const d = Math.max(2, Math.round(h * 0.3));
  v.box(cx - w, y, cz - d, cx + w, y + h, cz + d, col);
  v.box(cx - w, y + h - 1, cz - d, cx + w, y + h, cz + d, "white");
  // rope handles
  for (const dx of [-w + 1, w - 2]) v.box(cx + dx, y + h, cz, cx + dx + 1, y + h + Math.round(h * 0.35), cz + 1, "charcoal");
  v.box(cx - w + 1, y + h + Math.round(h * 0.35), cz, cx + w - 1, y + h + Math.round(h * 0.35) + 1, cz + 1, "charcoal");
  // glowing logo heart/star on the front
  v.box(cx - 1, y + Math.round(h * 0.3), cz + d, cx + 1, y + Math.round(h * 0.3) + 3, cz + d + 1, "white", 0.9);
  v.box(cx - 2, y + Math.round(h * 0.3) + 1, cz + d, cx + 2, y + Math.round(h * 0.3) + 2, cz + d + 1, "white", 0.9);
  return y + h + Math.round(h * 0.35) + 1;
}

/**
 * SHOPS — one boutique → strip of shops → market street → glass-roofed arcade → department store.
 *  V0 Main Street Americana (brick & pastel, striped awnings)   V1 Parisian (limestone, mansards, iron balconies)
 *  V2 Dutch canal (tall stepped gables, hoist beams)             V3 Tokyo neon (blade signs, billboards, lanterns)
 */
function buildShops(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "concrete2");
  speckle(c, "concrete", 0.08);
  const st = SHOP_STYLES[s];
  const floorsBase = s === 2 ? 2 : s === 3 ? 2 : 1;

  if (lv === 1) {
    sidewalk(c, hz - 4, hz);
    const t1 = shopUnit(c, -hx + 2, hx - 2, -hz + 2, hz - 4, floorsBase, 0);
    if (s === 0 || s === 3) shoppingBag(v, 0, t1 - (s === 3 ? 3 : 0), -2, s === 3 ? "magenta" : "orange", 6);
    bench(v, -hx + 2, 1, hz - 2, "x", "woodDark");
    pot(v, hx - 3, hz - 3, 1, "leaf", "pink");
    folk(c, 2, hz - 2);
    return;
  }
  if (lv === 2) {
    sidewalk(c, hz - 5, hz);
    shopRow(c, -hx + 1, hx - 1, -hz + 2, hz - 5, 10, (i) => floorsBase + (i % 2), 0);
    crowd(c, -hx + 2, hz - 3, hx - 2, hz - 1, 4);
    bench(v, -2, 1, hz - 2, "x", "woodDark");
    return;
  }
  if (lv === 3) {
    // market street: back row of 2-3 storey shops + street with market stalls + low front kiosks
    sidewalk(c, -2, hz, "iron", "path");
    shopRow(c, -hx + 1, hx - 1, -hz + 1, -2, 8, (i) => floorsBase + 1 + (i % 2), 1);
    for (let x = -hx + 3; x < hx - 4; x += 7) {
      const [a1] = st.awn[(x + 40) % st.awn.length];
      v.box(x, 1, 4, x + 5, 2, 7, "woodLight");
      v.box(x, 1, 4, x + 1, 5, 5, "woodDark");
      v.box(x + 4, 1, 4, x + 5, 5, 5, "woodDark");
      for (let k = 0; k < 5; k++) v.box(x + k, 5, 3, x + k + 1, 6, 8, k % 2 ? "white" : a1);
      produceCrates(c, x, x + 4, 6, 2);
    }
    crowd(c, -hx + 2, 0, hx - 2, 3, 7);
    crowd(c, -hx + 2, hz - 4, hx - 2, hz - 1, 4);
    for (let x = -hx + 6; x < hx - 2; x += 14) tree(v, x, 1, hz - 2, s === 3 ? "blossom" : "round", 0.9, x);
    return;
  }
  // L4/L5 share a ring of shops; L4 = arcade, L5 = department store
  if (lv === 4) {
    // Glass-roofed arcade: two shop rows facing a central gallery, barrel glass roof, grand entry arch
    const gw = 7; // gallery half-width
    const z0 = -hz + 2;
    const z1 = hz - 3;
    const h = s === 3 ? 13 : 11;
    for (const side of [-1, 1]) {
      const xa = side < 0 ? -hx + 1 : gw;
      const xb = side < 0 ? -gw : hx - 1;
      shell(v, xa, 1, z0, xb, h, z1, st.walls[side < 0 ? 0 : 1]);
      windows(c, xa, 4, z0, xb, h, z1, { faces: side < 0 ? "w" : "e", stepV: 4, h: 2, w: 2, emit: 0.4 });
      // inner shopfronts facing the gallery (on the x plane)
      const fx = side < 0 ? xb - 1 : xa;
      for (let z = z0 + 1; z < z1 - 3; z += 6) {
        v.box(fx, 1, z, fx + 1, 5, z + 5, st.frame);
        v.box(fx, 2, z + 1, fx + 1, 4, z + 4, "glass", 0.6);
        const [a1, a2] = st.awn[(z + 50) % st.awn.length];
        for (let k = 0; k < 5; k++) v.put(fx - side, 5, z + k, k % 2 ? a2 : a1);
      }
      // outer facade front shopfronts
      shopfront(v, xa + 1, xb - 1, 1, z1 - 1, 4, st.frame);
      awning(v, xa + 1, xb - 1, 5, z1, ...(st.awn[side < 0 ? 0 : 2] as [string, string]));
      v.box(xa, h - 1, z0, xb, h, z1, st.trim);
      if (s === 1) mansard(v, xa, h, z0, xb, z1, st.roof, "slateLight", "glass");
      else if (s === 2) gable(v, xa, h, z0, xb, z1, "z", st.roof, st.trim);
      else flatRoof(c, xa, h - 1, z0, xb, z1, st.roof, st.walls[0], true);
    }
    // glass barrel vault over the gallery
    barrelRoof(v, -gw, h - 2, z0, gw, z1, "z", "glass", "steelLight");
    v.clear(-gw + 1, h - 2, z0 + 1, gw - 1, h + 2, z1 - 1);
    barrelRoof(v, -gw, h - 2, z0, gw, z1, "z", "#bfe7ff", s === 0 ? "steelLight" : "iron");
    // entrance arch portal
    v.box(-gw, 1, z1 - 1, gw, h + 3, z1, st.trim);
    v.clear(-gw + 2, 1, z1 - 1, gw - 2, h - 1, z1);
    for (let x = -gw + 2; x < gw - 2; x++) {
      const d = Math.abs(x + 0.5);
      v.put(x, h - 1 - Math.round(d * d * 0.15), z1 - 1, st.trim);
    }
    sign(v, -gw + 1, gw - 1, h, h + 2, z1, s === 3 ? "magenta" : "gold", 0.8);
    // gallery floor mosaic + shoppers
    v.box(-gw, 0, z0, gw, 1, hz, s === 1 ? "marble" : "path2");
    for (let z = z0; z < z1; z += 3) v.put(-1, 0, z, st.walls[2] ?? "brick"), v.put(0, 0, z, st.walls[2] ?? "brick");
    fountain(v, -0.0, 1, 0, 2.5, "marble");
    crowd(c, -gw + 1, z0 + 2, gw - 1, hz - 1, 10);
    return;
  }
  // L5 — DEPARTMENT STORE: big block, corner rotunda/dome, giant bag sign, display windows all round
  const x0 = -hx + 2;
  const x1 = hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - 6;
  const floors = s === 3 ? 7 : 5;
  const top = 1 + floors * 5;
  const wallCol = [st.walls[0], "limestone", "brickDark", "white"][s];
  shell(v, x0, 1, z0, x1, top, z1, wallCol);
  // display windows ground floor all round with mannequins
  for (let x = x0 + 2; x < x1 - 4; x += 5) {
    v.box(x, 1, z1 - 1, x + 4, 5, z1, "glass", 0.55);
    mannequin(v, x + 1, 1, z1 - 1, c.pick(SHIRTS));
    mannequin(v, x + 3, 1, z1 - 1, c.pick(SHIRTS));
  }
  door(v, -2, 1, z1 - 1, "gold", 4, 4);
  if (s === 3) {
    // Ginza tower: glass + LED screens
    curtainWall(c, x0, 6, z0, x1, top, z1, "glass", "steelDark", 3, 5);
    v.box(x0 + 2, 9, z1, x1 - 2, top - 3, z1 + 1, "screenCyan", 0.8);
    for (let y = 10; y < top - 4; y += 3) v.box(x0 + 3, y, z1, x1 - 3, y + 1, z1 + 1, c.pick(["magenta", "yellow", "white"]), 1);
    bladeSign(v, x0 - 1 + 1, 8, top, z1, "red");
    bladeSign(v, x1 - 1, 8, top, z1, "yellow");
  } else {
    windows(c, x0, 5, z0, x1, top, z1, { stepV: 5, h: 3, w: 2, stepH: 4, emit: 0.4, sill: st.trim });
    for (let y = 6; y < top; y += 5) v.box(x0, y - 1, z1 - 1, x1, y, z1 + 1, st.trim);
  }
  awning(v, x0, x1, 6, z1, st.awn[0][0], st.awn[0][1]);
  v.box(x0 - 0, top - 1, z0, x1, top, z1 + 1, st.trim);
  flatRoof(c, x0, top, z0, x1, z1, st.roof, wallCol, false);
  for (let x = x0 + 3; x < x1 - 4; x += 9) acUnit(v, x, top + 1, z0 + 2);
  // corner rotunda / dome / signature
  const cx = x1 - 4;
  const cz = z1 - 3;
  if (s === 1) {
    // Galeries-style glass dome
    cyl(v, -0.0, (z0 + z1) / 2, top, top + 3, 8, "limestone");
    v.dome(-0.0, top + 3, (z0 + z1) / 2, 7.5, "#bfe7ff", 0.3);
    v.box(-1, top + 10, Math.floor((z0 + z1) / 2) - 1, 1, top + 13, Math.floor((z0 + z1) / 2) + 1, "gold", 0.6);
    flag(v, x0 + 1, top + 1, z1 - 2, 6, ["blue", "white", "red"]);
  } else if (s === 2) {
    // brick clock tower on the corner with stepped gable
    v.box(cx - 2, top, cz - 2, cx + 3, top + 10, cz + 3, "brick");
    v.box(cx - 3, top + 10, cz - 3, cx + 4, top + 11, cz + 4, "white");
    v.cone(cx + 0.5, top + 11, top + 18, cz + 0.5, 3.5, 0.4, "tealDark");
    v.put(cx, top + 6, cz + 3, "white", 0.6);
    v.put(cx, top + 7, cz + 3, "charcoal");
    shoppingBag(v, x0 + 8, top + 1, Math.floor((z0 + z1) / 2), "orange", 10);
  } else if (s === 3) {
    shoppingBag(v, 0, top + 1, Math.floor((z0 + z1) / 2), "magenta", 12);
    c.blink(x0 + 1, top + 2, z0 + 1, "red");
  } else {
    // Main-street dept store: giant red star + bag sign
    shoppingBag(v, -1, top + 1, Math.floor((z0 + z1) / 2), "red", 12);
    for (const fx of [x0 + 1, x1 - 2]) flag(v, fx, top + 1, z1 - 2, 6, ["red", "white", "blue"]);
  }
  // Open the building to the actual shopping street. The separate wings retain their
  // original display windows, upper-floor detailing and individual corner landmarks.
  const portalW = [5,8,4,6][s], portalH = [12,18,13,top+2][s];
  for (let x=-portalW;x<portalW;x++) {
    const arch = s===3 ? portalH : portalH-Math.floor((x+0.5)**2/portalW);
    v.clear(x,1,z0-1,x+1,arch,z1+4);
    v.box(x,arch,z0,x+1,arch+1,z1+1,st.trim);
    v.box(x,0,z0,x+1,1,hz,s===1 ? "marble" : "path2");
  }
  for (const x of [-portalW-1,portalW]) {
    v.box(x,1,z0,x+1,portalH,z1,wallCol);
    for (let z=z0+2;z<z1-2;z+=5) v.box(x,2,z,x+1,6,z+3,"glass",.45);
  }
  if(s===3) {
    // Two lantern-lined bridges leave daylight between the two fashion halls.
    for(const y of [12,25]) {
      v.box(-portalW,y,-5,portalW,y+1,1,"steelDark");
      for(const z of [-5,0]) v.box(-portalW,y+1,z,portalW,y+4,z+1,"glass",.33);
      v.box(-portalW,y+4,-5,portalW,y+5,1,"magenta",.6);
    }
    // The sign rests on the wider western wing.
    v.clear(-8,top+2,-11,8,top+25,5);
    shoppingBag(v,-13,top+1,-6,"magenta",8);
  } else if(s===2) {
    for(let z=z0+3;z<z1;z+=6) v.box(-portalW,portalH-4,z,portalW,portalH-3,z+1,"woodDark");
  }
  // street front: taxis, shoppers with bags, lamps
  sidewalk(c, z1, hz, "iron", "path2");
  car(v, -hx + 5, 1, hz - 2, "x", "busYellow");
  car(v, hx - 6, 1, hz - 2, "x", c.pick([...CAR_COLORS]));
  crowd(c, x0, z1 + 1, x1, hz - 3, 9);
}

defineDesigns({
  shops: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Corner Boutique", "Strip of Shops", "Market Street", "Glass-Roofed Arcade", "Grand Department Store"],
    growth: "One shop becomes a strip, then a market street with stalls, a glass-vaulted arcade and finally a department store.",
    build: buildShops,
  },
});

// =============================================================================================
// BUSINESSES — small-business offices growing into a LOW-RISE corporate campus
// =============================================================================================

/**
 * BUSINESSES — garage startup → main-street office → co-working loft → office park → HQ campus (sprawls, stays low).
 *  V0 Brick warehouse conversion (red brick, black steel)   V1 Scandinavian timber (larch slats, green roofs)
 *  V2 Silicon tech (white & glass, logo orb)                 V3 Southwest adobe (stucco, terracotta, cacti)
 */
function bizBlock(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number, opts: { front?: boolean } = {}): number {
  const { v } = c;
  const s = c.variant % 4;
  const fh = 4;
  const top = 1 + floors * fh;
  const wall = ["brick", "#c9955c", "white", "#e8c9a0"][s];
  const trim = ["charcoal", "woodDark", "steelLight", "terracotta"][s];
  shell(v, x0, 1, z0, x1, top, z1, wall);
  if (s === 0) {
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, w: 2, stepH: 3, col: "glass", emit: 0.45, sill: "charcoal" });
    v.box(x0, top - 1, z0, x1, top, z1, "brickDark");
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "brickDark", false);
  } else if (s === 1) {
    for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, top, z1, "woodDark");
    for (let z = z0; z < z1; z += 2) v.box(x1 - 1, 1, z, x1, top, z + 1, "woodDark");
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, w: 3, stepH: 5, emit: 0.45 });
    gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, x1 - x0 >= z1 - z0 ? "x" : "z", "leafDark", "charcoal");
  } else if (s === 2) {
    ribbonWindows(c, x0, 1, z0, x1, top, z1, 2, "glass", 0.45);
    for (let y = 1 + fh; y < top; y += fh) v.box(x0 - 1, y, z0 - 1, x1 + 1, y + 1, z1 + 1, "white");
    flatRoof(c, x0, top, z0, x1, z1, "concrete", "white", false);
  } else {
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, w: 1, stepH: 3, emit: 0.45, sill: "terracotta" });
    v.box(x0, top, z0, x1, top + 1, z1, wall);
    for (let x = x0 + 1; x < x1; x += 3) v.put(x, top - 1, z1, "woodDark");
    for (let z = z0 + 1; z < z1; z += 3) v.put(x1, top - 1, z, "woodDark");
    v.box(x0, top + 1, z0, x1, top + 2, z0 + 1, trim);
    v.box(x0, top + 1, z1 - 1, x1, top + 2, z1, trim);
  }
  if (opts.front !== false) {
    const dx = Math.floor((x0 + x1) / 2) - 1;
    v.box(dx - 1, 1, z1 - 1, dx + 3, 4, z1, "glass", 0.6);
    v.box(dx, 1, z1 - 1, dx + 2, 4, z1, trim);
    v.box(dx - 2, 4, z1, dx + 4, 5, z1 + 2, trim);
  }
  return top;
}

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

function buildBusinesses(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const ground = ["concrete2", "grass2", "grass2", "sand"][s];
  lot(c, ground);
  if (s === 3) speckle(c, "sandDark", 0.1);
  if (s === 1 || s === 2) speckle(c, "grass3", 0.08);
  const cactusOrTree = (x: number, z: number, k = 1) => {
    if (s === 3) {
      v.box(x, 1, z, x + 1, 5, z + 1, "leafDark");
      v.box(x + 1, 3, z, x + 2, 4, z + 1, "leafDark");
      v.box(x + 2, 3, z, x + 3, 5, z + 1, "leafDark");
    } else tree(v, x, 1, z, s === 1 ? "birch" : s === 0 ? "round" : "cypress", k, x);
  };

  if (lv === 1) {
    // GARAGE STARTUP: tiny house with roll-up door open showing glowing monitors
    const x0 = -hx + 2;
    const x1 = hx - 2;
    const z0 = -hz + 2;
    const z1 = hz - 5;
    const wall = ["brick", "#c9955c", "white", "#e8c9a0"][s];
    shell(v, x0, 1, z0, x1, 7, z1, wall);
    // open garage
    v.box(x0 + 1, 1, z1 - 1, x0 + 8, 5, z1, "charcoal");
    v.box(x0 + 2, 2, z1 - 1, x0 + 7, 3, z1, "screenCyan", 1);
    v.box(x0 + 1, 5, z1 - 1, x0 + 8, 6, z1, "silver");
    door(v, x1 - 4, 1, z1 - 1, "woodDark");
    if (s === 2) flatRoof(c, x0, 7, z0, x1, z1, "concrete", "white", false);
    else if (s === 3) v.box(x0, 7, z0, x1, 8, z1, wall);
    else gable(v, x0 - 1, 7, z0 - 1, x1 + 1, z1 + 1, "x", s === 1 ? "leafDark" : "slate", "white");
    v.box(-hx + 3, 0, z1, -hx + 9, 1, hz, "concrete");
    car(v, hx - 4, 1, hz - 3, "x", c.pick(["teal", "yellow", "orange"]));
    folk(c, x0 + 4, z1 + 1);
    // hand-painted sign on a post
    v.box(x1 - 1, 1, hz - 2, x1, 4, hz - 1, "woodDark");
    v.box(x1 - 4, 4, hz - 2, x1 + 1, 6, hz - 1, "orange", 0.7);
    return;
  }
  if (lv === 2) {
    const top = bizBlock(c, -hx + 2, -hz + 2, hx - 2, hz - 5, 2);
    logo(c, 0, top + 2, -2, 2);
    v.box(-hx, 0, hz - 5, hx, 1, hz, "path");
    for (let x = -hx + 2; x < -hx + 6; x += 2) v.box(x, 1, hz - 2, x + 1, 2, hz - 1, "steelDark"); // bike rack
    v.box(-hx + 2, 2, hz - 2, -hx + 5, 3, hz - 1, "teal");
    cactusOrTree(hx - 3, hz - 3, 0.8);
    crowd(c, -3, hz - 3, 4, hz - 1, 2);
    return;
  }
  if (lv === 3) {
    // CO-WORKING LOFT: 3 storeys, roof terrace with umbrellas & string lights, side courtyard
    const x1 = hx - 8;
    const top = bizBlock(c, -hx + 2, -hz + 2, x1, hz - 4, 3);
    if (s !== 1) {
      for (let x = -hx + 4; x < x1 - 3; x += 5) cafeTable(v, x, 0, c.pick(["orange", "teal", "yellow"]), top + 1);
      stringLights(v, -hx + 3, x1 - 1, top + 5, -hz + 3);
    }
    logo(c, Math.floor((-hx + x1) / 2), top + (s === 1 ? 6 : 1), hz - 5, 2);
    // courtyard with picnic tables & bikes
    v.box(x1, 0, -hz + 1, hx - 1, 1, hz - 1, s === 3 ? "sandDark" : "path2");
    cafeTable(v, x1 + 3, 2, "orange");
    cafeTable(v, x1 + 3, -4, "teal");
    cactusOrTree(hx - 3, -hz + 3, 1);
    crowd(c, x1 + 1, 4, hx - 1, hz - 1, 3);
    return;
  }
  // L4 OFFICE PARK / L5 HQ CAMPUS: low buildings around a courtyard + parking
  const big = lv === 5;
  const bz1 = hz - (big ? 10 : 9);
  // back long block
  const t1 = bizBlock(c, -hx + 2, -hz + 2, hx - 2, -hz + 12, big ? 3 : 2, { front: false });
  // left wing
  bizBlock(c, -hx + 2, -hz + 12, -hx + 12, bz1, 2);
  // right wing (L5) or pavilion
  if (big) bizBlock(c, hx - 12, -hz + 12, hx - 2, bz1, 2);
  else bizBlock(c, hx - 10, -hz + 14, hx - 2, bz1, 1);
  // courtyard
  const cx0 = -hx + 12;
  const cx1 = big ? hx - 12 : hx - 10;
  v.box(cx0, 0, -hz + 12, cx1, 1, bz1, s === 3 ? "sandDark" : "grass3");
  v.box(Math.floor((cx0 + cx1) / 2) - 1, 0, -hz + 12, Math.floor((cx0 + cx1) / 2) + 1, 1, hz, "path");
  const ccx = Math.floor((cx0 + cx1) / 2);
  const ccz = Math.floor((-hz + 12 + bz1) / 2);
  if (big) {
    // reflecting pond + giant logo sculpture + glass skybridges + solar roofs
    v.box(ccx - 5, 0, ccz - 3, ccx + 6, 1, ccz + 4, "water", 0.15);
    v.box(ccx - 1, 1, ccz, ccx + 2, 2, ccz + 1, "marble");
    logo(c, ccx, 2, ccz, 3);
    for (const bx of [-hx + 12, hx - 12]) {
      // skybridge at floor 2 linking wing to back block — already touching; add glass canopy on wing
      v.box(Math.min(bx, bx + (bx < 0 ? 0 : -1)), 5, -hz + 12, Math.min(bx, bx) + 1, 6, bz1, "glass", 0.3);
    }
    for (let x = -hx + 4; x < hx - 6; x += 7) solarRow(v, x, x + 5, t1 + 1, -hz + 4, 4);
    flag(v, -hx + 3, 1, hz - 3, 10, ["blue", "white", "blue"]);
    flag(v, hx - 5, 1, hz - 3, 10, ["blue", "white", "blue"]);
  } else {
    fountain(v, ccx, 1, ccz, 2.5, s === 3 ? "terracotta" : "marble");
    logo(c, 0, t1 + 1, -hz + 6, 2);
  }
  for (let x = cx0 + 1; x < cx1 - 1; x += 5) cactusOrTree(x, bz1 - 2, 0.9);
  // parking along the front
  parking(c, -hx + 1, bz1 + 1, hx - 1, hz - 1, { cars: 0.7 });
  crowd(c, cx0 + 1, -hz + 13, cx1 - 1, bz1 - 3, big ? 8 : 5);
}

// =============================================================================================
// BUILDINGS — commercial high-rise that GROWS TALL
// =============================================================================================

/**
 * BUILDINGS (commercial high-rise) — walk-up block → mid-rise → glass high-rise → skyscraper → supertall with crown.
 *  V0 Art Deco (setbacks, gold crown, spire)        V1 Modern glass (blue curtain wall, sloped top, helipad)
 *  V2 Brutalist (raw concrete fins, cantilevers)     V3 Postmodern (pink granite, broken-pediment "Chippendale" top)
 */
function buildBuildings(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "concrete2");
  v.box(-hx, 0, hz - 3, hx, 1, hz, "path2");
  const H = byLv(c, [14, 24, 36, 54, 78]);
  const inset = lv >= 4 ? 4 : 2;
  let x0 = -hx + inset;
  let x1 = hx - inset;
  let z0 = -hz + inset;
  let z1 = hz - inset - (lv >= 4 ? 2 : 1);
  const lobby = 5;
  const wall = ["#e2c99a", "glass", "concrete", "#d99a9a"][s];
  const trim = ["gold", "steelLight", "concreteDark", "#b86a6a"][s];
  // lobby / podium
  shell(v, x0 - (lv >= 4 ? 2 : 0), 1, z0, x1 + (lv >= 4 ? 2 : 0), lobby + 1, z1 + (lv >= 4 ? 1 : 0), s === 1 ? "steelDark" : trim === "gold" ? "#3a3a46" : trim);
  v.box(-3, 1, z1 - 1 + (lv >= 4 ? 1 : 0), 3, lobby, z1 + (lv >= 4 ? 1 : 0), "glass", 0.7);
  v.box(-4, lobby, z1 + (lv >= 4 ? 1 : 0), 4, lobby + 1, z1 + 2 + (lv >= 4 ? 1 : 0), trim);
  let y = lobby + 1;
  let top = H;
  if (s === 0) {
    // ART DECO: setback tiers, vertical piers, gold crown + spire
    const tiers = lv <= 2 ? 1 : lv === 3 ? 2 : 3;
    const tierH = Math.floor((H - y) / tiers);
    for (let t = 0; t < tiers; t++) {
      const y1 = t === tiers - 1 ? H : y + tierH;
      shell(v, x0, y, z0, x1, y1, z1, wall);
      windows(c, x0, y, z0, x1, y1, z1, { stepV: 3, h: 2, w: 1, stepH: 2, col: "glass", emit: 0.45 });
      for (let x = x0; x < x1; x += 4) v.box(x, y, z1 - 1, x + 1, y1, z1, "#c8ab78");
      v.box(x0, y1 - 1, z0, x1, y1, z1, trim);
      y = y1;
      if (x1 - x0 > 8) { x0 += 2; x1 -= 2; z0 += 2; z1 -= 2; }
    }
    top = H;
    if (lv >= 3) {
      // sunburst crown
      for (let k = 0; k < 4 && x0 + k * 1 < x1 - k; k++) {
        v.box(x0 + k, top + k * 2, z0 + k, x1 - k, top + k * 2 + 2, z1 - k, k % 2 ? "gold" : "#e2c99a");
        for (let x = x0 + k + 1; x < x1 - k - 1; x += 2) v.put(x, top + k * 2 + 1, z1 - k - 1, "warmGlow", 1);
      }
      top += 8;
    }
    if (lv >= 4) {
      const cx = Math.floor((x0 + x1) / 2);
      const cz = Math.floor((z0 + z1) / 2);
      v.box(cx - 1, top, cz - 1, cx + 1, top + 10, cz + 1, "silver");
      v.box(cx, top + 10, cz, cx + 1, top + (lv === 5 ? 18 : 14), cz + 1, "silver");
      top += lv === 5 ? 18 : 14;
      c.blink(cx, top, cz, "red");
    }
  } else if (s === 1) {
    // MODERN GLASS: curtain wall, sloped crown, helipad / mast
    curtainWall(c, x0, y, z0, x1, H, z1, "#5fa8e0", "steelLight", 3, 3);
    if (lv >= 3) {
      // slanted top
      for (let k = 0; k < (z1 - z0) - 1; k++) v.box(x0, H, z0 + k, x1, H + Math.floor(k * 0.6) + 1, z0 + k + 1, k % 3 ? "#5fa8e0" : "steelLight", 0.2);
      top = H + Math.floor((z1 - z0) * 0.6);
    } else flatRoof(c, x0, H, z0, x1, z1, "concreteDark", "steelLight", true);
    if (lv >= 4) {
      v.box(x0, H, z1 - 1, x1, H + 1, z1, "steelLight");
      antenna(v, x1 - 2, top, z1 - 3, lv === 5 ? 14 : 8, "silver");
      c.blink(x1 - 2, top + (lv === 5 ? 14 : 8), z1 - 3);
      if (lv === 5) {
        // sky lobby band glowing
        for (const yy of [Math.floor(H * 0.5), Math.floor(H * 0.75)]) v.box(x0 - 1, yy, z0 - 1, x1 + 1, yy + 2, z1 + 1, "screenCyan", 0.7);
      }
    }
  } else if (s === 2) {
    // BRUTALIST: heavy concrete with deep fins, cantilevered upper block
    shell(v, x0, y, z0, x1, H, z1, wall);
    for (let yy = y + 1; yy < H - 1; yy += 3) {
      v.box(x0 + 1, yy, z1 - 1, x1 - 1, yy + 2, z1, "glassDark");
      v.box(x1 - 1, yy, z0 + 1, x1, yy + 2, z1 - 1, "glassDark");
      for (let x = x0 + 1; x < x1 - 1; x += 3) if (c.rand() < 0.4) v.put(x, yy, z1 - 1, "warmGlow", 0.7);
    }
    for (let x = x0; x < x1; x += 3) v.box(x, y, z1 - 1, x + 1, H, z1 + 1, "concreteDark");
    for (let z = z0; z < z1; z += 3) v.box(x1 - 1, y, z, x1 + 1, H, z + 1, "concreteDark");
    if (lv >= 3) {
      // cantilevered crown block
      const cy = H - 8;
      v.box(x0 - 1, cy, z0 - 1, x1 + 1, H + 2, z1 + 2, "concreteDark");
      v.clear(x0, cy, z0, x1, H + 1, z1);
      for (let x = x0; x < x1; x += 2) v.put(x, cy + 3, z1 + 1, "glass", 0.4);
      top = H + 2;
    }
    flatRoof(c, x0 - 1, top, z0 - 1, x1 + 1, z1 + 2, "concreteDark", "concrete", true);
    if (lv >= 4) {
      const cx = Math.floor((x0 + x1) / 2);
      v.box(cx - 3, top + 1, z0 + 1, cx + 3, top + 8, z0 + 7, "concrete");
      if (lv === 5) {
        // stacked cantilever box
        v.box(cx - 6, top + 8, z0 - 1, cx + 6, top + 14, z0 + 9, "concrete");
        for (let x = cx - 5; x < cx + 6; x += 2) v.put(x, top + 11, z0 + 8, "glass", 0.5);
        top += 14;
      } else top += 8;
      c.blink(cx, top + 1, z0 + 3);
      v.put(cx, top, z0 + 3, "red");
    }
  } else {
    // POSTMODERN: pink granite, vertical bands, broken-pediment / arched top
    shell(v, x0, y, z0, x1, H, z1, wall);
    windows(c, x0, y, z0, x1, H, z1, { stepV: 3, h: 2, w: 2, stepH: 3, col: "glass", emit: 0.45 });
    for (let yy = y + 3; yy < H; yy += 9) v.box(x0, yy, z0, x1, yy + 1, z1, trim);
    if (lv >= 3) {
      // broken pediment
      const w = x1 - x0;
      for (let k = 0; k < Math.ceil(w / 2); k++) {
        const a = x0 + k;
        const b = x1 - k;
        v.box(a, H + k, z0, a + 1, H + k + 1, z1, wall);
        v.box(b - 1, H + k, z0, b, H + k + 1, z1, wall);
      }
      const mx = Math.floor((x0 + x1) / 2);
      v.clear(mx - 2, H + 2, z0, mx + 2, H + Math.ceil(w / 2) + 1, z1);
      v.ringZ(mx, H + 2, z1 - 1, z1, 2, 1, "gold", 0.8);
      top = H + Math.ceil(w / 2);
    }
    v.box(x0, H - 1, z0, x1, H, z1, trim);
    if (lv >= 4) {
      // arched entry & obelisk pinnacles
      for (const px of [x0, x1 - 1]) {
        v.box(px, H, z1 - 1, px + 1, H + 6, z1, trim);
        v.put(px, H + 6, z1 - 1, "gold", 0.8);
      }
      if (lv === 5) {
        const mx = Math.floor((x0 + x1) / 2);
        v.box(mx - 1, top, Math.floor((z0 + z1) / 2) - 1, mx + 1, top + 8, Math.floor((z0 + z1) / 2) + 1, trim);
        v.box(mx - 1, top + 8, Math.floor((z0 + z1) / 2) - 1, mx + 1, top + 10, Math.floor((z0 + z1) / 2) + 1, "gold", 0.9);
        top += 10;
        c.blink(mx, top, Math.floor((z0 + z1) / 2));
      }
    }
  }
  // street life
  if (lv >= 2) {
    lamp(v, -hx + 1, 1, hz - 2, 5);
    lamp(v, hx - 2, 1, hz - 2, 5);
  }
  crowd(c, -hx + 2, hz - 3, hx - 2, hz - 1, lv + 1);
  if (lv >= 4) {
    car(v, -hx + 6, 1, hz - 2, "x", "busYellow");
    tree(v, -hx + 2, 1, hz - 5, "round", 0.8, 1);
    tree(v, hx - 3, 1, hz - 5, "round", 0.8, 2);
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
    levels: ["Garage Startup", "Main-Street Office", "Co-Working Loft", "Office Park", "HQ Campus"],
    growth: "A garage startup grows into offices, a rooftop-terrace loft, then a low-rise office park and a sprawling HQ campus with a logo sculpture.",
    build: buildBusinesses,
  },
  buildings: {
    footprints: [[1, 1], [1, 1], [1, 1], [2, 2], [2, 2]],
    levels: ["Walk-Up Commercial Block", "Mid-Rise Office", "Glass High-Rise", "Downtown Skyscraper", "Supertall Crown Tower"],
    growth: "Grows straight up: each level adds many floors and a more dramatic crown, ending as a beacon-topped supertall.",
    build: buildBuildings,
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

// =============================================================================================
// BLACKSMITH — the work moves from a field hearth to a smithy, powered hammer, casting yard
// and finally a guild ironworks. Timber village, turf-roof Nordic, brick industrial and tatara clay.
// =============================================================================================

const forgeStyles = [
  { wall: "plaster", beam: "woodDark", roof: "slate", stone: "brickDark", accent: "copper" },
  { wall: "granite", beam: "oak", roof: "moss", stone: "stone", accent: "goldDark" },
  { wall: "brick", beam: "iron", roof: "steelDark", stone: "brickDark", accent: "hazard" },
  { wall: "#c68e62", beam: "#493b34", roof: "#4a5666", stone: "#966846", accent: "crimson" },
];

function buildBlacksmith(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const style = c.variant % 4;
  const p = forgeStyles[style];
  lot(c, style === 1 ? "grass2" : style === 3 ? "sandDark" : "path2");
  speckle(c, style === 1 ? "stone" : "soil", 0.07);
  const left = -hx + 1;
  const rear = -hz + 2;
  const front = rear + (lv >= 4 ? 14 : 8);
  const width = Math.min(hx * 2 - 2, lv >= 4 ? 19 : 14);
  const right = left + width;
  const eaves = lv >= 4 ? 10 : 7;
  const hearthX = left + 5;
  const hearthZ = lv === 1 ? -2 : front - 2;
  const anvilX = lv === 1 ? 3 : left + width - 5;
  const anvilZ = lv === 1 ? 4 : front + 2;

  if (lv >= 2) {
    // Leave the firebox and the entire front of the shop visible.
    v.box(left, 0, rear, right, 1, front + 2, "concreteDark");
    v.box(left, 1, rear, right, eaves, rear + 1, p.wall);
    v.box(left, 1, rear, left + 1, eaves, front - 1, p.wall);
    for (const x of [left, right - 1]) v.box(x, 1, front, x + 1, eaves + 1, front + 1, p.beam);
    v.box(left, eaves - 1, front, right, eaves + 1, front + 1, p.beam);
    if (style === 0) {
      gable(v, left - 1, eaves, rear - 1, right + 1, front + 2, "x", p.roof, "woodDark");
      for (let z = rear + 1; z < front - 1; z++) v.put(left, 2 + (z - rear) % 5, z, "woodDark");
    } else if (style === 1) {
      gable(v, left - 1, eaves, rear - 1, right + 1, front + 2, "x", "woodDark");
      gable(v, left, eaves + 1, rear, right, front + 1, "x", "grass2", "moss");
      for (let x = left + 2; x < right - 1; x += 3) v.put(x, eaves + 1, front, "grass3");
    } else if (style === 2) {
      sawtooth(v, left, eaves, rear, right, front + 1, p.roof, "glass", 4);
      v.box(left + 1, 3, rear, right - 1, 5, rear + 1, "glassDark", 0.25);
    } else {
      hip(v, left - 1, eaves, rear - 1, right + 1, front + 2, p.roof, "charcoal", 4);
      for (const x of [left - 1, right]) for (const z of [rear - 1, front + 1]) v.put(x, eaves + 1, z, p.roof);
      v.box(left + 1, eaves - 3, front, left + 4, eaves - 1, front + 1, "crimson");
    }
  }

  const hood = lv === 1 ? 5 : 7;
  v.box(hearthX - 3, 1, hearthZ - 3, hearthX + 3, hood, hearthZ + 2, p.stone);
  v.box(hearthX - 2, 2, hearthZ, hearthX + 2, hood - 1, hearthZ + 2, "charcoal");
  v.box(hearthX - 2, 2, hearthZ + 1, hearthX + 2, 3, hearthZ + 2, "fire", 1.1);
  v.put(hearthX, 3, hearthZ + 1, "amber", 1.05);
  if (style === 2) {
    v.cone(hearthX, hood, hood + 4, hearthZ - 1, 3.1, 1.4, "iron");
  } else if (style === 3) {
    v.box(hearthX - 2, hood, hearthZ - 2, hearthX + 2, hood + 3, hearthZ + 1, p.wall);
    v.box(hearthX - 3, 1, hearthZ - 2, hearthX - 2, 4, hearthZ + 1, "wood");
  } else {
    v.box(hearthX - 2, hood, hearthZ - 2, hearthX + 2, hood + 2, hearthZ + 1, p.stone);
  }
  const chimneyHeight = lv === 1 ? hood + 3 + (style === 2 ? 2 : 0) : eaves + lv + 6;
  v.box(hearthX - 1, hood + 1, hearthZ - 2, hearthX + 1, chimneyHeight, hearthZ, p.stone);
  v.box(hearthX - 2, chimneyHeight, hearthZ - 3, hearthX + 2, chimneyHeight + 1, hearthZ + 1, p.beam);
  v.box(hearthX - 1, chimneyHeight, hearthZ - 2, hearthX + 1, chimneyHeight + 1, hearthZ, "charcoal");
  c.smoke(hearthX, chimneyHeight + 1, hearthZ - 1, "smoke");

  // Anvil, tapered horn, hot billet and the smith in a leather apron.
  v.box(anvilX - 1, 1, anvilZ - 1, anvilX + 2, 3, anvilZ + 1, "woodDark");
  v.box(anvilX, 3, anvilZ - 1, anvilX + 1, 4, anvilZ + 1, "iron");
  v.box(anvilX - 2, 4, anvilZ - 1, anvilX + 2, 5, anvilZ + 1, "steel");
  v.put(anvilX - 3, 4, anvilZ, "silver");
  v.put(anvilX + 1, 5, anvilZ, "fire", 0.8);
  person(v, anvilX + 2, 1, anvilZ - 1, "woodDark", "blueDark");
  c.smoke(anvilX + 1, 5, anvilZ, "spark");
  if (lv === 1) {
    // Each tool cart has a different form even before a permanent roof is built.
    if (style === 0) {
      v.box(-6, 1, 3, -5, 7, 4, "woodDark");
      v.box(-6, 6, 3, -2, 7, 4, "wood");
      v.ringZ(-3.5, 4.5, 3, 4, 1.6, 0.8, "iron");
    } else if (style === 1) {
      for (const x of [2, 4]) v.box(x, 1, -5, x + 1, 2, -1, "woodDark");
      v.box(1, 2, -5, 6, 3, -1, "wood");
      v.box(2, 3, -5, 5, 5, -3, "charcoal");
    } else if (style === 2) {
      v.ringZ(3, 4, -3, -2, 3, 2, "iron");
      v.box(2, 1, -4, 4, 4, -2, "steelDark");
      v.box(0, 4, -2, 6, 5, -1, "copper");
    } else {
      v.box(1, 1, -5, 6, 4, -1, "woodDark");
      v.box(2, 4, -5, 3, 6, -4, "wood");
      v.box(2, 5, -5, 6, 6, -4, "woodLight");
    }
    return;
  }
  if (lv >= 3) {
    // A visible flywheel and eccentrically mounted pin power the trip hammer.
    const wx = right + 6;
    const wz = rear + 6;
    v.box(wx - 5, 1, wz - 3, wx + 4, 2, wz + 3, "granite");
    v.box(wx - 1, 2, wz - 2, wx + 1, 8, wz, p.beam);
    v.box(wx - 5, 7, wz - 1, wx + 2, 9, wz + 1, "woodDark");
    v.box(wx - 5, 5, wz - 1, wx - 3, 8, wz + 1, "iron");
    v.box(wx - 5, 2, wz - 1, wx - 3, 4, wz + 1, "steel");
    const wheel = new PixelVox();
    wheel.ringZ(0, 0, 0, 1, 4.4, 3.2, style === 2 ? "crimson" : "woodDark");
    wheel.box(-4, 0, 0, 5, 1, 1, p.accent);
    wheel.box(0, -4, 0, 1, 5, 1, p.accent);
    wheel.put(2, 0, 1, "silver");
    c.addRotor({ vox: wheel, pivot: [wx, 6, wz + 1], axis: "z", speed: -1.1 });
  }
  if (lv >= 4) {
    // Cupola and casting sand form a separate, open-air production line.
    const fx = hx - 6;
    const fz = hz - 8;
    v.cylinderY(fx, fz, 1, 5, 3.8, "brickDark");
    v.cone(fx, 5, 14, fz, 3.6, 2.4, style === 2 ? "iron" : p.stone);
    ring(v, fx, fz, 8, 9, 3.4, 2.2, "iron");
    v.cylinderY(fx, fz, 14, 16, 2.4, "charcoal");
    c.smoke(fx, 16, fz, "spark");
    v.box(fx - 2, 3, fz + 2, fx + 1, 5, fz + 4, "fire", 1.1);
    v.box(fx - 7, 1, fz + 3, fx, 2, fz + 6, "sandDark");
    v.box(fx - 6, 2, fz + 3, fx, 3, fz + 4, "amber", 0.8);
    for (let x = fx - 6; x < fx; x += 2) v.put(x, 2, fz + 4, "fire", 0.8);
  }
  if (lv === 5) {
    // A pattern loft and travelling hoist occupy the new third bay of the works.
    const lx = hx - 15;
    const lz = rear + 2;
    const loft = 7;
    for (const x of [lx, hx - 3]) for (const z of [lz, lz + 7]) v.box(x, 1, z, x + 1, loft, z + 1, p.beam);
    for (let z = lz; z < lz + 7; z += 2) {
      v.box(lx + 2, 1, z, hx - 4, 3, z + 1, "iron");
      v.put(lx + 2, 2, z, "silver");
    }
    if (style === 2) sawtooth(v, lx - 1, loft, lz - 1, hx - 1, lz + 9, p.roof, "glass");
    else if (style === 3) hip(v, lx - 1, loft, lz - 1, hx - 1, lz + 9, p.roof, p.beam, 3);
    else gable(v, lx - 1, loft, lz - 1, hx - 1, lz + 9, "x", p.roof, p.beam);
    const craneZ = hz - 12;
    for (const x of [lx + 1, hx - 4]) v.box(x, 1, craneZ, x + 1, 17, craneZ + 1, p.beam);
    v.box(lx, 16, craneZ, hx - 2, 18, craneZ + 1, p.accent);
    v.box(lx + 4, 10, craneZ, lx + 5, 16, craneZ + 1, "iron");
    v.box(lx + 3, 9, craneZ - 1, lx + 6, 11, craneZ + 2, "steelDark");
    // Cast-iron arcade: the finished ironwork frames its maker's courtyard.
    const z = hz - 5;
    const crest = 11;
    for (const x of [-6, 5]) {
      v.box(x - 1, 1, z - 1, x + 2, 3, z + 2, "granite");
      v.box(x, 3, z, x + 1, crest, z + 1, p.beam);
      for (let k = 0; k < 4; k++) v.put(x < 0 ? x + k : x - k, crest - 3 + k, z, p.beam);
    }
    v.box(-6, crest, z, 6, crest + 1, z + 1, "iron");
    v.ringZ(0, crest + 4, z, z + 2, 4.3, 2.6, p.accent);
    v.clear(-2, crest + 6, z, 2, crest + 10, z + 2);
    for (const x of [-5, 4]) lamp(v, x, 1, z + 2, 5, "iron");
    v.box(-hx + 2, 1, hz - 7, -hx + 13, 3, hz - 4, "wood");
    for (let x = -hx + 3; x < -hx + 12; x += 3) {
      v.box(x, 3, hz - 6, x + 1, 4, hz - 3, "woodLight");
      v.box(x - 1, 3, hz - 6, x + 2, 4, hz - 5, "steel");
    }
    crowd(c, -hx + 3, hz - 4, -hx + 12, hz - 1, 3);
  }
}

defineDesigns({
  blacksmiths: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["Wayside Hearth", "Village Smithy", "Trip-Hammer Workshop", "Casting Yard", "Ironworkers' Guildhall"],
    growth: "A roadside anvil gains a sheltered hearth, a flywheel-driven hammer, a casting furnace and a guild courtyard of finished ironwork.",
    build: buildBlacksmith,
  },
});

// =============================================================================================
// ATMS
// =============================================================================================

/**
 * ATM — wall-slot ATM → freestanding kiosk → drive-thru ATM → 24h glass ATM lobby → Golden Cash Tower with a
 * giant spinning coin. Stays a 1×1 street prop that levels up in detail & height.
 *  V0 Green Savings (green & white)   V1 Crimson Express (red & silver)   V2 Crypto Neon (black & cyan, glowing)
 *  V3 Gold Reserve (black marble & gold)
 */
function atmUnit(v: V, x: number, y: number, z: number, body: string, screen: string): void {
  v.box(x, y, z, x + 3, y + 5, z + 2, body);
  v.box(x, y + 3, z + 2, x + 3, y + 5, z + 3, body);
  v.put(x + 1, y + 3, z + 2, screen, 1.2);
  v.put(x + 2, y + 3, z + 2, screen, 1.2);
  v.put(x + 1, y + 2, z + 2, "black");
  v.put(x + 2, y + 2, z + 2, "silver");
  v.box(x, y + 5, z, x + 3, y + 6, z + 3, body);
}
function buildAtm(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const body = ["#1e8a3c", "crimson", "black", "black"][s];
  const trim = ["white", "silver", "cyan", "gold"][s];
  const screen = ["screenCyan", "screenCyan", "screenGreen", "warmGlow"][s];
  lot(c, s === 3 ? "marble" : "concrete2");
  speckle(c, s === 3 ? "white" : "concrete", 0.1);
  if(lv<=2 && c.parcelEdges?.some(e=>e.kind==="arcade" && e.side==="front")) {
    // Inside a shopping frontage the cashpoint becomes a wall niche and shares the
    // common paved forecourt, with the bright screen facing arriving pedestrians.
    v.box(-6,1,-1,6,8,1,s===3 ? "marbleShade":s===1 ? "brick":"concrete");
    atmUnit(v,-2,1,1,body,screen);
    v.box(-4,7,-1,4,8,4,trim);
    v.box(-3,6,2,3,7,3,screen,.65);
    v.box(-2,0,4,2,1,hz,"limestone");
    if(lv===2) {
      for(const x of [-5,4]) v.box(x,1,3,x+1,8,4,"steelDark");
      v.box(-6,8,-1,6,9,5,body);
      folk(c,2,5);
    }
    return;
  }
  const dollar = (x: number, y: number, z: number, col: string) => {
    // $ glyph 3 wide x 5 tall on +z plane
    const g = ["111", "100", "111", "001", "111"];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") v.put(x + k, y + 4 - r, z, col, 1.3);
    v.put(x + 1, y + 5, z, col, 1.3);
    v.put(x + 1, y - 1, z, col, 1.3);
  };
  const coinFace = (vox: V, R: number, col: string) => {
    vox.ringZ(0, 0, 0, 1, R, 0, col, 0.4);
    vox.ringZ(0, 0, -1, 0, R, R - 0.8, col, 0.4);
    vox.ringZ(0, 0, 1, 2, R, R - 0.8, col, 0.4);
    vox.ringZ(0, 0, 1, 2, R - 2, R - 2.8, col, 0.4);
  };

  if (lv === 1) {
    // brick wall chunk with a glowing ATM slot + small canopy
    v.box(-6, 1, -4, 6, 10, 0, s === 2 ? "charcoal" : s === 3 ? "marble" : "brick");
    v.box(-2, 3, 0, 2, 8, 1, body);
    v.box(-1, 6, 1, 1, 7, 1, screen, 1.2);
    v.box(-1, 6, 0, 1, 7, 1, screen, 1.2);
    v.box(-1, 4, 0, 1, 5, 1, "black");
    v.box(-3, 8, 0, 3, 9, 2, trim);
    folk(c, 0, 3);
    return;
  }
  if (lv === 2) {
    // freestanding kiosk booth
    v.box(-4, 0, -3, 4, 1, 4, "concrete");
    atmUnit(v, -2, 1, -1, body, screen);
    v.box(-4, 7, -3, 4, 8, 4, trim);
    v.box(-4, 8, -3, 4, 10, 4, body);
    dollar(-1, 8, 4, trim);
    v.box(-4, 1, -3, -3, 7, -2, "steelDark");
    v.box(3, 1, -3, 4, 7, -2, "steelDark");
    folk(c, 0, 4);
    folk(c, 0, 6);
    return;
  }
  if (lv === 3) {
    // drive-thru ATM: lane with arrows, island + canopy, car at the window
    v.box(-hx, 0, -hz, hx, 1, hz, "asphalt");
    for (let z = -hz + 1; z < hz - 1; z += 4) v.box(-1, 0, z, 0, 1, z + 2, "white");
    v.box(2, 1, -4, 6, 2, 6, "concrete");
    atmUnit(v, 2, 2, -1, body, screen);
    v.box(1, 1, -5, 2, 11, -4, trim);
    v.box(6, 1, 5, 7, 11, 6, trim);
    v.box(-4, 11, -6, 8, 12, 7, body);
    v.box(-4, 12, -6, 8, 13, 7, trim, 0.6);
    dollar(4, 13, 0, trim);
    car(v, -2, 1, 2, "z", c.pick(["sky", "white", "yellow"]));
    v.box(-6, 1, 6, -5, 3, 7, "yellow"); v.box(-6, 1, -7, -5, 3, -6, "yellow"); // bollards
    return;
  }
  if (lv === 4) {
    // 24H glass lobby pavilion with 3 ATMs, neon $, camera, bollards
    v.box(-7, 0, -7, 7, 1, 7, s === 3 ? "black" : "concrete");
    curtainWall(c, -6, 1, -6, 6, 11, 4, "glass", trim, 3, 10);
    v.clear(-2, 1, 3, 2, 5, 4);
    for (const x of [-5, -1, 3]) atmUnit(v, x, 1, -5, body, screen);
    v.box(-7, 11, -7, 7, 12, 5, body);
    v.box(-7, 12, -7, 7, 13, 5, trim, 0.5);
    dollar(-1, 13, 0, screen === "warmGlow" ? "gold" : "lime");
    v.box(-7, 13, -1, 7, 18, 0, body);
    dollar(-1, 13, 0, screen === "warmGlow" ? "gold" : "lime");
    v.box(-6, 14, 0, 6, 15, 1, trim, 0.9);
    // camera
    v.box(5, 10, 4, 6, 11, 6, "charcoal"); v.put(5, 10, 6, "red", 1.2);
    for (const bx of [-6, -3, 2, 5]) v.box(bx, 1, 6, bx + 1, 3, 7, "yellow");
    folk(c, -1, 5);
    c.blink(5, 10, 6, "red");
    return;
  }
  // L5 GOLDEN CASH TOWER: tall obelisk kiosk with ATMs on 2 faces, spinning giant coin on top
  v.box(-7, 0, -7, 7, 1, 7, s === 3 ? "black" : "concrete");
  stairs(v, -5, 5, 1, 4, 2, s === 3 ? "gold" : "marbleShade");
  v.box(-5, 1, -5, 5, 3, 4, s === 3 ? "black" : "marble");
  v.box(-4, 3, -4, 4, 24, 4, body);
  for (let y = 5; y < 24; y += 3) v.box(-4, y, 3, 4, y + 1, 5, trim, 0.7);
  atmUnit(v, -2, 3, 4, body, screen);
  v.box(4, 6, -1, 5, 9, 2, screen, 1.2); // side ATM screen
  v.box(-5, 24, -5, 5, 25, 5, trim, 0.6);
  // pyramid cap like an obelisk
  for (let k = 0; k < 4; k++) v.box(-4 + k, 25 + k, -4 + k, 4 - k, 26 + k, 4 - k, k === 3 ? trim : body);
  const rot = new PixelVox(13);
  coinFace(rot, 5, s === 2 ? "cyan" : s === 1 ? "silver" : "gold");
  // $ on the coin
  const g = ["111", "100", "111", "001", "111"];
  for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") { rot.put(k - 1, 2 - r, 2, s === 2 ? "white" : "goldDark", 0.6); rot.put(k - 1, 2 - r, -1, s === 2 ? "white" : "goldDark", 0.6); }
  c.addRotor({ vox: rot, pivot: [0, 35, 0], axis: "y", speed: 1.2 });
  v.box(0, 29, 0, 1, 31, 1, trim);
  c.blink(0, 42, 0, s === 2 ? "cyan" : "yellow");
  folk(c, -1, 6);
  folk(c, 2, 6);
}

// =============================================================================================
// MALLS
// =============================================================================================

/**
 * MALLS — strip mall → enclosed mall with skylights → regional mall with anchors & food-court dome →
 * megamall with cinema & parking garage → mega-resort mall with a rooftop Ferris wheel.
 *  V0 '80s Americana (pastel teal & pink, neon)   V1 Glass Galleria (cream stone, iron & glass dome)
 *  V2 Desert Luxury (white & gold, palms, fountain) V3 Asian Megamall (giant LED screens, neon blades)
 */
function buildMalls(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["#9ad9cf", "cream", "white", "concrete"][s];
  const wall2 = ["#f7a1c4", "limestone", "#e8d5a8", "charcoal"][s];
  const accent = ["magenta", "iron", "gold", "screenCyan"][s];
  const roof = ["#d9eeea", "slateLight", "#f4ecd8", "concreteDark"][s];
  lot(c, "asphalt");
  speckle(c, "asphaltDark", 0.05);

  const anchor = (x0: number, z0: number, x1: number, z1: number, h: number, col: string) => {
    shell(v, x0, 1, z0, x1, h, z1, col);
    v.box(x0 + 2, h - 4, z1 - 1, x1 - 2, h - 1, z1, accent, 0.8);
    v.box(Math.floor((x0 + x1) / 2) - 2, 1, z1 - 1, Math.floor((x0 + x1) / 2) + 2, 5, z1, "glass", 0.6);
    v.box(Math.floor((x0 + x1) / 2) - 3, 5, z1 - 1, Math.floor((x0 + x1) / 2) + 3, 6, z1 + 2, wall2);
    flatRoof(c, x0, h, z0, x1, z1, roof, col, false);
    for (let x = x0 + 3; x < x1 - 4; x += 8) acUnit(v, x, h + 1, z0 + 3);
  };
  const skylight = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    if (s === 1) {
      barrelRoof(v, x0, y, z0, x1, z1, x1 - x0 > z1 - z0 ? "x" : "z", "#bfe7ff", "iron");
    } else {
      v.roofGable(x0, y, z0, x1, z1, 3, x1 - x0 > z1 - z0 ? "x" : "z", "#bfe7ff", s === 2 ? "gold" : "steelLight");
    }
  };
  const ledScreen = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    v.box(x0, y0, z, x1, y1, z + 1, "black");
    for (let x = x0 + 1; x < x1 - 1; x++) for (let y = y0 + 1; y < y1 - 1; y++) v.put(x, y, z, ((x >> 1) + (y >> 1)) % 3 === 0 ? "magenta" : (x + y) % 5 === 0 ? "yellow" : "screenCyan", 1.0);
  };
  const palm = (x: number, z: number) => tree(v, x, 1, z, s === 2 || s === 0 ? "palm" : "round", 1.1, x);

  if (lv === 1) {
    // STRIP MALL: L-shaped row of 5 units + parking + pylon
    const z0 = -hz + 2;
    const z1 = -2;
    for (let i = 0; i < 5; i++) {
      const a = -hx + 2 + i * 6;
      if (a + 6 > hx - 2) break;
      shell(v, a, 1, z0, a + 6, 7, z1, i % 2 ? wall : wall2);
      shopfront(v, a, a + 6, 1, z1 - 1, 4, "steelLight");
      v.box(a, 5, z1 - 1, a + 6, 7, z1 + 1, c.pick(["red", "teal", "orange", "blue", "magenta", "lime"]), 0.6);
      if (s === 1) {
        gable(v, a, 8, z0, a + 6, z1 + 1, "z", "slate", "limestone");
      } else if (s === 2 && i % 2 === 0) {
        v.dome(a + 3, 8, z0 + 5, 3, "copper");
      } else if (s === 3) {
        ledScreen(a + 1, a + 5, 7, 10 + i % 3, z1);
      } else if (s === 0) {
        awning(v, a, a + 6, 5, z1, "#f7a1c4", "white");
      }
    }
    v.box(-hx + 2, 7, z0, -hx + 2 + Math.floor((2 * hx - 4) / 6) * 6, 8, z1 + 2, roof);
    v.box(-hx + 2, 1, z1, hx - 2, 1, z1 + 2, "concrete");
    v.box(-hx + 1, 0, z1, hx - 1, 1, z1 + 2, "concrete");
    parking(c, -hx + 1, z1 + 3, hx - 4, hz - 1, { cars: 0.7 });
    pylon(v, hx - 3, hz - 3, 9, 5, 7, wall2, "steelDark", accent);
    crowd(c, -hx + 2, z1 + 1, hx - 2, z1 + 3, 4);
    return;
  }
  // L2+: enclosed mall core block with skylight, anchors, parking front
  const parkD = lv === 2 ? 12 : 14;
  const mz1 = hz - parkD;
  const mz0 = -hz + 2;
  const coreX0 = lv >= 3 ? -hx + 14 : -hx + 2;
  const coreX1 = lv >= 3 ? hx - 14 : hx - 14;
  const H = lv >= 4 ? 13 : 10;
  shell(v, coreX0, 1, mz0 + 2, coreX1, H, mz1, wall);
  windows(c, coreX0, 1, mz0 + 2, coreX1, H, mz1, { faces: "s", stepV: 5, stepH: 4, w: 2, h: 2, emit: 0.5 });
  flatRoof(c, coreX0, H, mz0 + 2, coreX1, mz1, roof, wall2, false);
  skylight(coreX0 + 2, mz0 + 4, coreX1 - 2, mz1 - 2, H + 1);
  // grand entrance
  const ex = Math.floor((coreX0 + coreX1) / 2);
  v.box(ex - 5, 1, mz1 - 1, ex + 5, H + 3, mz1 + 1, wall2);
  v.box(ex - 3, 1, mz1, ex + 3, 6, mz1 + 1, "glass", 0.7);
  v.box(ex - 4, H, mz1 + 1, ex + 4, H + 2, mz1 + 2, accent, 0.9);
  if (s === 3) ledScreen(ex - 5, ex + 5, 7, H + 3, mz1 + 1);
  // anchors
  anchor(coreX1, mz0, hx - 2, mz1, H + 2, wall2);
  if (lv >= 3) anchor(-hx + 2, mz0, coreX0, mz1, H + 2, s === 0 ? "#f7d58a" : wall2);
  // parking
  parking(c, -hx + 1, mz1 + 3, hx - 1, mz1 + 3 + 6, { cars: 0.75 });
  if (parkD >= 14 || lv === 2) parking(c, -hx + 1, mz1 + 3 + 6, hx - 1, hz - 1, { cars: 0.6 });
  v.box(-hx + 1, 0, mz1, hx - 1, 1, mz1 + 3, "concrete");
  crowd(c, coreX0, mz1 + 1, coreX1, mz1 + 3, 6);
  for (let x = -hx + 4; x < hx - 4; x += 12) palm(x, mz1 + 2);
  pylon(v, -hx + 3, hz - 3, 12, 6, 8, wall2, "steelDark", accent);

  if (lv >= 3) {
    // food-court dome over the centre
    const dcz = Math.floor((mz0 + mz1) / 2);
    if (s === 1) {
      cyl(v, ex, dcz, H, H + 3, 7, "limestone");
      v.dome(ex, H + 3, dcz, 7, "#bfe7ff", 0.3);
      for (let a = 0; a < 8; a++) for (let t = 0; t < 7; t += 1) v.put(ex + Math.cos(a * 0.785) * t * Math.cos(Math.asin(t / 7.5)) - 0.5, H + 3 + Math.round(Math.sqrt(Math.max(0, 49 - t * t))), dcz + Math.sin(a * 0.785) * t - 0.5, "iron");
    } else if (s === 3) {
      v.box(ex - 6, H, dcz - 6, ex + 6, H + 10, dcz + 6, "black");
      ledScreen(ex - 6, ex + 6, H, H + 10, dcz + 6);
    } else {
      v.dome(ex, H + 1, dcz, 7, s === 2 ? "gold" : "#bfe7ff", 0.3);
    }
  }
  if (lv >= 4) {
    // The cinema occupies the right anchor's front; the rooftop parking deck sits across the entry.
    const cx0 = hx - 16;
    shell(v, cx0, H + 2, mz1 - 9, hx - 2, H + 8, mz1, s === 3 ? "black" : "purpleDark");
    v.box(cx0, H + 2, mz1, hx - 2, H + 5, mz1 + 2, "warmGlow", 0.8);
    for (let x = cx0; x < hx - 2; x += 2) v.put(x, H + 1, mz1 + 1, "yellow", 1.3);
    flatRoof(c, cx0, H + 8, mz1 - 9, hx - 2, mz1, "concreteDark", "purple", false);
    for (let y = H + 3; y <= H + 7; y += 4) {
      v.box(-hx + 2, y, mz1 - 10, -hx + 14, y + 1, mz1, "concrete");
      for (let x = -hx + 4; x < -hx + 13; x += 4) car(v, x, y + 1, mz1 - 4, "z", c.pick(CAR_COLORS));
    }
    for (const px of [-hx + 2, -hx + 13]) for (const pz of [mz1 - 10, mz1 - 1]) v.box(px, H + 3, pz, px + 1, H + 8, pz + 1, "concrete");
  }
  if (lv === 5) {
    // ROOFTOP FERRIS WHEEL (rotor) on the right anchor + fountain plaza + more palms
    const fx = hx - 15;
    const fz = mz0 + 8;
    const baseY = H + 3;
    const R = 13;
    for (const dz of [-2, 2]) {
      for (let i = 0; i <= R + 1; i++) {
        const spread = Math.round((R + 1 - i) * 0.45);
        v.put(fx - spread, baseY + i, fz + dz, "white");
        v.put(fx + spread, baseY + i, fz + dz, "white");
      }
    }
    v.box(fx, baseY + R + 1, fz - 2, fx + 1, baseY + R + 2, fz + 3, "iron");
    const wheel = new PixelVox(17);
    wheel.ringZ(0, 0, -1, 0, R, R - 1, accent === "iron" ? "red" : accent, 0.4);
    wheel.ringZ(0, 0, 0, 1, R, R - 1, accent === "iron" ? "red" : accent, 0.4);
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      for (let t = 1; t < R; t++) wheel.put(Math.round(Math.cos(ang) * t), Math.round(Math.sin(ang) * t), 0, "white");
      const gx = Math.round(Math.cos(ang) * R);
      const gy = Math.round(Math.sin(ang) * R);
      wheel.box(gx - 1, gy - 2, -2, gx + 1, gy, 2, ["red", "yellow", "teal", "pink", "lime", "orange"][a % 6], 0.2);
    }
    c.addRotor({ vox: wheel, pivot: [fx, baseY + R + 1, fz], axis: "z", speed: 0.35 });
    // fountain plaza in front of the entrance
    fountain(v, ex, 1, mz1 + 4, 3, s === 2 ? "gold" : "marble");
    c.smoke(ex, 5, mz1 + 4, "steam");
    for (let x = -hx + 6; x < hx - 6; x += 8) palm(x, hz - 2);
    c.blink(fx, baseY + 2 * R + 2, fz, "red");
  }
}

// =============================================================================================
// DATA CENTERS
// =============================================================================================

/**
 * DATA CENTERS — server hut → colocation hall → twin data halls → server campus → hyperscale AI campus.
 * Windowless halls with glowing rack LEDs, steaming chillers, blinking fiber towers, solar, substations.
 *  V0 Corporate (grey & blue)    V1 Arctic (white halls on snow, ice blue)
 *  V2 Desert Solar (sand halls, huge solar field)    V3 Bunker (earth-bermed, green roofs, blast doors)
 */
function buildDataCenters(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["#394c61", "white", "#e8d5a8", "concreteDark"][s];
  const band2 = ["blue", "cyan", "orange", "lime"][s];
  lot(c, ["concrete2", "snow", "sand", "grass2"][s]);
  speckle(c, ["concrete", "white", "sandDark", "grass3"][s], 0.1);

  const hall = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    if (s === 3) {
      // earth berm bunker: sloped grass sides, concrete face with blast door
      for (let k = 0; k < h; k++) {
        const shoulder = Math.min(2, Math.floor((h - 1 - k) / 2));
        const layer = k % 3 === 1 ? "moss" : "grass2";
        v.box(x0 - shoulder, k + 1, z0 - shoulder, x1 + shoulder, k + 2, z1 - 1, layer);
        if (k < h - 1) v.clear(x0 + 1, k + 1, z0 + 1, x1 - 1, k + 2, z1 - 2);
      }
      v.box(x0, 1, z1 - 1, x1, h + 1, z1, "concreteDark");
      const dx = Math.floor((x0 + x1) / 2);
      v.box(dx - 2, 1, z1, dx + 2, 5, z1 + 1, "steelDark");
      v.box(dx - 2, 3, z1, dx + 2, 4, z1 + 1, "hazard");
      for (let x = x0 + 1; x < x1 - 1; x += 2) v.put(x, h - 1, z1 - 1, band2, 1.0);
      let vents = 0;
      for (let x = x0 + 3; x < x1 - 2; x += 6) for (let z = z0 + 2; z < z1 - 2; z += 6) { v.box(x, h + 1, z, x + 2, h + 4, z + 2, "steelLight"); v.put(x, h + 4, z, "steelDark"); if (vents++ % 3 === 0) c.smoke(x, h + 5, z, "steam"); }
      return h + 1;
    }
    shell(v, x0, 1, z0, x1, h, z1, wall);
    v.box(x0, h - 2, z0, x1, h - 1, z1, band2, 0.4);
    // rack LED slits
    for (let x = x0 + 2; x < x1 - 2; x += 2) for (let y = 2; y < h - 3; y += 2) if (c.rand() < 0.35) v.put(x, y, z1 - 1, c.pick(["lime", "cyan", band2]), 1.2);
    for (let z = z0 + 2; z < z1 - 2; z += 2) for (let y = 2; y < h - 3; y += 2) if (c.rand() < 0.3) v.put(x1 - 1, y, z, c.pick(["lime", "cyan", band2]), 1.2);
    v.box(x0 + 2, 1, z1 - 1, x0 + 5, 5, z1, "steelDark");
    flatRoof(c, x0, h, z0, x1, z1, s === 1 ? "white" : "concreteDark", wall, false);
    // rooftop chillers with steam
    for (let x = x0 + 2; x + 3 < x1 - 1; x += 5) {
      v.box(x, h + 1, z0 + 2, x + 3, h + 3, z0 + 5, "silver");
      v.cylinderY(x + 1.5, z0 + 3.5, h + 3, h + 4, 1.2, "steelDark");
      if ((x - x0) % 10 === 2) c.smoke(x + 1, h + 4, z0 + 3, "steam");
    }
    const midX = Math.floor((x0 + x1) / 2);
    if (s === 0) {
      // Stacked glass service core; the external fibre trunk rises beside the racks.
      v.box(midX - 2, 1, z1 - 1, midX + 2, h + 4, z1 + 1, "glassDark", 0.25);
      for (let y = 2; y < h + 4; y += 3) v.box(midX - 2, y, z1, midX + 2, y + 1, z1 + 1, band2);
      v.box(midX - 2, h + 4, z1 - 1, midX + 2, h + 5, z1 + 1, "silver");
    } else if (s === 1) {
      // A long rooftop air intake with a snow hood gives polar halls a ridge.
      gable(v, x0 + 1, h + 1, z1 - 6, x1 - 1, z1 - 1, "x", "snow", "silver");
      for (let x = x0 + 2; x < x1 - 1; x += 3) v.box(x, h + 1, z1 - 1, x + 1, h + 3, z1, "steelDark");
    } else {
      // Tilted photovoltaic sunshades cover the hot aisle of every desert hall.
      for (let z = z0 + 7; z + 4 <= z1 - 1; z += 6) solarRow(v, x0 + 1, x1 - 1, h + 1, z, 4);
    }
    return h + 1;
  };
  // Corporate campus control rooms project over the service lanes between halls.
  const controlBridge = (left: number, right: number, z: number, y: number) => {
    if (s !== 0) return;
    v.box(left - 2, y, z - 3, right + 2, y + 1, z + 2, "steelDark");
    for (const side of [z - 3, z + 1]) {
      v.box(left - 2, y + 1, side, right + 2, y + 4, side + 1, "#67adba", 0.35);
      for (let x = left - 1; x < right + 2; x += 3) v.box(x, y + 1, side, x + 1, y + 4, side + 1, "steelLight");
    }
    v.box(left - 2, y + 4, z - 3, right + 2, y + 5, z + 2, "steel");
    v.box(left, y + 4, z + 1, right, y + 5, z + 2, "cyan", 0.7);
  };
  const fiberTower = (x: number, z: number, h: number) => {
    for (let y = 1; y < h; y++) {
      const w = Math.max(0, Math.round((1 - y / h) * 2));
      v.put(x - w, y, z - w, "steelLight"); v.put(x + w, y, z + w, "steelLight");
      v.put(x - w, y, z + w, "steelLight"); v.put(x + w, y, z - w, "steelLight");
    }
    v.box(x, 1, z, x + 1, h + 2, z + 1, "steelDark");
    v.box(x + 1, h - 3, z, x + 2, h - 1, z + 1, "white");
    v.box(x - 1, h - 5, z, x, h - 3, z + 1, "white");
    c.blink(x, h + 2, z, "red");
  };
  const generators = (x0: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      v.box(x0 + i * 5, 1, z, x0 + i * 5 + 4, 4, z + 2, s === 2 ? "orange" : "#5a6b4a");
      v.box(x0 + i * 5 + 3, 4, z, x0 + i * 5 + 4, 6, z + 1, "steelDark");
    }
  };
  const substation = (x0: number, z0: number) => {
    v.box(x0, 0, z0, x0 + 10, 1, z0 + 8, "stone");
    for (let i = 0; i < 3; i++) {
      v.box(x0 + 1 + i * 3, 1, z0 + 2, x0 + 3 + i * 3, 4, z0 + 4, "steel");
      v.box(x0 + 1 + i * 3, 4, z0 + 3, x0 + 2 + i * 3, 7, z0 + 4, "white");
    }
    v.box(x0, 7, z0 + 3, x0 + 10, 8, z0 + 4, "steelDark");
    securityFence(v, x0, z0, x0 + 10, z0 + 8, 1, 3);
  };
  const solarField = (x0: number, z0: number, x1: number, z1: number) => {
    for (let z = z0; z + 3 <= z1; z += 4) solarRow(v, x0, x1, 1, z, 3);
  };

  if (lv === 1) {
    const top = hall(-hx + 3, -hz + 3, hx - 7, hz - 6, 8);
    fiberTower(hx - 3, -hz + 4, 18);
    generators(-hx + 3, hz - 4, 2);
    void top;
    if (s === 2) solarField(hx - 6, 0, hx - 1, hz - 1);
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 3, [-2, 2]);
    return;
  }
  if (lv === 2) {
    hall(-hx + 3, -hz + 3, hx - 3, 3, 10);
    generators(-hx + 3, 6, 4);
    fiberTower(hx - 4, hz - 4, 22);
    v.box(-hx + 2, 0, hz - 4, hx - 6, 1, hz - 2, "asphalt");
    car(v, -hx + 6, 1, hz - 3, "x", "white");
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 3, [-hx + 3, -hx + 9]);
    return;
  }
  if (lv === 3) {
    // twin halls + cooling towers + substation
    hall(-hx + 3, -hz + 3, -2, hz - 8, 11);
    hall(2, -hz + 3, hx - 12, hz - 8, 11);
    controlBridge(-2, 2, hz - 8, 6);
    for (const [tx, tz] of [[hx - 6, -hz + 7], [hx - 6, -hz + 16]]) {
      ring(v, tx, tz, 1, 9, 3.4, 2.4, s === 1 ? "white" : "concrete");
      v.cylinderY(tx, tz, 8, 9, 2.4, "steelDark");
      c.smoke(tx, 10, tz, "steam");
    }
    substation(hx - 11, hz - 9);
    generators(-hx + 3, hz - 5, 4);
    fiberTower(-hx + 25 > hx - 14 ? 0 : -hx + 25, hz - 3, 24);
    securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 3, [-4, 2]);
    return;
  }
  // L4 / L5 campus
  const big = lv === 5;
  const halls = big ? 4 : 3;
  const hw = big ? 14 : 12;
  const rowZ1 = big ? 2 : 0;
  for (let i = 0; i < halls; i++) {
    const a = -hx + 3 + i * (hw + 3);
    if (a + hw > hx - 3) break;
    hall(a, -hz + 3, a + hw, rowZ1, big ? 14 : 12);
    if (i > 0) controlBridge(a - 3, a, rowZ1, big ? 10 : 8);
  }
  // front: cooling towers, solar field / substation, fiber towers, security fence
  const fz0 = rowZ1 + 4;
  const towers = big ? 4 : 2;
  for (let i = 0; i < towers; i++) {
    const tx = -hx + 8 + i * 10;
    const tz = fz0 + 6;
    if (s === 3) {
      v.box(tx - 3, 1, tz - 3, tx + 3, 4, tz + 3, "concreteDark");
      c.smoke(tx, 5, tz, "steam");
    } else {
      ring(v, tx, tz, 1, big ? 14 : 11, 4, 3, s === 1 ? "white" : "concrete");
      v.cylinderY(tx, tz, (big ? 14 : 11) - 1, big ? 14 : 11, 3, "steelDark");
      c.smoke(tx, (big ? 15 : 12), tz, "steam");
      c.smoke(tx + 1, (big ? 15 : 12), tz - 1, "steam");
    }
  }
  const sx0 = -hx + 8 + towers * 10;
  solarField(sx0, fz0, hx - 3, hz - (big ? 12 : 3));
  if (big) {
    for(let i=0;i<halls;i++) {
      const x=-hx+3+i*(hw+3), back=-hz+3;
      if(x+hw>hx-3) break;
      if(s===0) {
        for(const z of [back+6,back+16]) {
          v.cone(x+hw/2,15,22,z,4,2.2,"steelDark");
          ring(v,x+hw/2,z,22,24,2.8,1.3,"silver");
          c.smoke(x+hw/2,24,z,"steam");
        }
      } else if(s===1) {
        for(let z=back+2;z<rowZ1-2;z+=6)
          for(let step=0;step<5;step++) v.box(x,15+step,z+step,x+hw,16+step,z+step+1,step===4 ? "glass" : "white");
      } else if(s===2) {
        for(let k=0;k<6;k++) {
          const y=16+Math.floor(k*.7);
          for(const px of [x+k,x+hw-1-k]) v.box(px,y,back,px+1,y+1,rowZ1,"solarBlue");
        }
      } else {
        for(let t=0;t<3;t++) {
          v.box(x+t*2,15+t*2,back+t*2,x+hw-t*2,17+t*2,rowZ1-t*2,"woodDark");
          v.box(x+t*2,16+t*2,back+t*2,x+hw-t*2,17+t*2,rowZ1-t*2,t%2 ? "olive" : "leaf");
        }
      }
    }
    substation(sx0, hz - 11);
    // satellite dish rotor
    const dx = hx - 8;
    const dz = hz - 7;
    v.box(dx - 1, 1, dz - 1, dx + 1, 6, dz + 1, "steelLight");
    const dish = new PixelVox(19);
    for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) {
      const d = x * x + y * y;
      if (d <= 17) dish.put(x, y + 4, Math.round(d * 0.12), "white");
    }
    dish.box(0, 4, -3, 1, 5, 0, "steelDark");
    c.addRotor({ vox: dish, pivot: [dx, 6, dz], axis: "y", speed: 0.3 });
    // AI glow: big emissive crest on hall roofs
    for (let i = 0; i < halls; i++) {
      const a = -hx + 3 + i * (hw + 3);
      if (a + hw > hx - 3) break;
      v.box(a + 1, 15, rowZ1 - 2, a + hw - 1, 16, rowZ1 - 1, band2, 1.2);
    }
  }
  fiberTower(-hx + 3, hz - 3, big ? 34 : 26);
  fiberTower(hx - 3, hz - 3, big ? 30 : 22);
  generators(-hx + 3, fz0 + 13 > hz - 3 ? hz - 6 : fz0 + 13, 3);
  securityFence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 4, [-4, 4]);
  v.box(-4, 0, hz - 2, 4, 1, hz, "asphalt");
}

defineDesigns({
  gas_stations: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 2]],
    levels: ["Roadside Pump", "Service Island", "Motor Court", "Travel Plaza", "Highway Landmark"],
    growth: "A single roadside stop grows sheltered pumps, service bays and a skyline marker visible from the highway.",
    build: buildGasStations,
  },
  atms: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Wall-Slot ATM", "ATM Kiosk", "Drive-Thru ATM", "24h Glass ATM Lobby", "Golden Cash Tower"],
    growth: "Stays a street-corner prop but levels up in style and height — from a slot in a wall to an obelisk with a giant spinning coin.",
    build: buildAtm,
  },
  banks: {
    footprints: [[1, 1], [2, 1], [2, 2], [2, 2], [2, 2]],
    levels: BANK.levels,
    growth: BANK.growth,
    build: buildBank,
  },
  malls: {
    footprints: [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
    levels: ["Strip Mall", "Skylit Enclosed Mall", "Regional Mall & Food-Court Dome", "Megamall with Cinema", "Mega-Resort Mall"],
    growth: "Sprawls into a compound: strip → skylit mall with an anchor → second anchor and food-court dome → cinema and parking garage → rooftop Ferris wheel and fountain plaza.",
    build: buildMalls,
  },
  data_centers: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [4, 4]],
    levels: ["Server Hut", "Colocation Hall", "Twin Data Halls", "Server Campus", "Hyperscale AI Campus"],
    growth: "Server halls multiply into campuses with glass control bridges, arctic intakes, desert solar fields or buried cooling ducts. Fiber towers and a tracking dish connect the largest sites.",
    build: buildDataCenters,
  },
});
