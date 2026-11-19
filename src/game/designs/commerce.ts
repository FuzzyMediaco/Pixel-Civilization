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
  bush,
  byLv,
  clamp,
  car,
  CAR_COLORS,
  chimney,
  colonnade,
  column,
  curtainWall,
  cyl,
  door,
  fence,
  flag,
  flatRoof,
  flowerBed,
  fountain,
  gable,
  hedge,
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
  rocks,
  securityFence,
  sign,
  solarRow,
  speckle,
  stairs,
  tank,
  tree,
  truck,
  windows,
} from "./kit";
import { defineDesigns } from "./registry";

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

/** Shopping cart (tiny) */
function cart(v: V, x: number, z: number, y = 1): void {
  v.put(x, y, z, "silver");
  v.put(x + 1, y, z, "silver");
  v.put(x + 1, y + 1, z, "steelLight");
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

/** Giant apple / fruit sphere with stem & leaf */
function giantFruit(v: V, cx: number, y: number, cz: number, r: number, col: string, kind: "apple" | "orange" | "melon" | "carrot" | "grape"): number {
  if (kind === "carrot") {
    // lying-down carrot pointing +x
    for (let i = 0; i < r * 4; i++) {
      const rr = Math.max(0.5, r * (1 - i / (r * 4)));
      v.sphere(cx + i - r * 2, y + r, cz, 0.6, rr, rr, "orange");
    }
    v.box(Math.round(cx - r * 2) - 2, y + r - 1, cz - 1, Math.round(cx - r * 2), y + r + 2, cz + 1, "leaf");
    return y + r * 2;
  }
  if (kind === "grape") {
    for (let row = 0; row < 4; row++) {
      const n = 4 - row;
      for (let i = 0; i < n; i++) v.sphere(cx + (i - (n - 1) / 2) * 1.6 * r * 0.5, y + (3 - row) * 1.4 * r * 0.5 + r * 0.5, cz, r * 0.45, r * 0.45, r * 0.45, "purple");
    }
    v.box(Math.floor(cx), y + Math.round(r * 2.6), Math.floor(cz), Math.floor(cx) + 1, y + Math.round(r * 2.6) + 2, Math.floor(cz) + 1, "woodDark");
    return y + r * 3;
  }
  v.sphere(cx, y + r, cz, r, r * 0.92, r, col);
  if (kind === "melon") {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      for (let h = -r; h <= r; h++) {
        const rr = Math.sqrt(Math.max(0, r * r - h * h));
        v.put(cx + Math.cos(ang) * rr - 0.5, y + r + h, cz + Math.sin(ang) * rr - 0.5, "leafDark");
      }
    }
  }
  const top = y + Math.round(r * 1.9);
  v.box(Math.floor(cx), top, Math.floor(cz), Math.floor(cx) + 1, top + 2, Math.floor(cz) + 1, "woodDark");
  if (kind === "apple") v.box(Math.floor(cx) + 1, top + 1, Math.floor(cz), Math.floor(cx) + 3, top + 2, Math.floor(cz) + 1, "leaf");
  if (kind === "orange") v.put(Math.floor(cx) + 1, top + 1, Math.floor(cz), "leaf");
  return top + 2;
}

/** Produce crates in a row along x (front display): crate + coloured fruit top */
function produceCrates(c: Ctx, x0: number, x1: number, z: number, y = 1): void {
  const cols = ["red", "orange", "yellow", "lime", "leaf", "purple", "crimson"];
  for (let x = x0; x < x1; x += 2) {
    c.v.box(x, y, z, x + 2, y + 1, z + 1, "crate");
    c.v.box(x, y + 1, z, x + 2, y + 2, z + 1, c.pick(cols));
  }
}

/** Parked delivery van (5 long along x) */
function van(v: V, x: number, z: number, body: string, stripe: string, y = 1): void {
  v.box(x - 3, y, z - 1, x + 3, y + 3, z + 1, body);
  v.box(x + 2, y + 1, z - 1, x + 3, y + 3, z + 1, "glassDark");
  v.box(x - 3, y + 1, z - 1, x + 2, y + 2, z + 1, stripe);
  v.put(x - 2, y - 0, z + 1, "rubber");
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
  v.box(cx - 3, y, cz - 2, cx + 3, y + h, cz + 2, col);
  v.box(cx - 3, y + h - 1, cz - 2, cx + 3, y + h, cz + 2, "white");
  for (const dx of [-2, 1]) {
    v.box(cx + dx, y + h, cz, cx + dx + 1, y + h + 2, cz + 1, "charcoal");
    v.box(cx + dx + 1, y + h + 2, cz, cx + dx + 2, y + h + 3, cz + 1, "charcoal");
  }
  v.box(cx - 1, y + h + 2, cz, cx + 2, y + h + 3, cz + 1, "charcoal");
  v.box(cx - 1, y + 2, cz + 2, cx + 1, y + 4, cz + 3, "white", 0.8);
  return y + h + 3;
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
    shopUnit(c, -hx + 2, hx - 2, -hz + 2, hz - 4, floorsBase, 0);
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
  flatRoof(c, x0, top, z0, x1, z1, st.roof, wallCol, true);
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
    shoppingBag(v, x0 + 6, top + 1, (z0 + z1) / 2, "orange");
  } else if (s === 3) {
    shoppingBag(v, -0.0 | 0, top + 1, Math.floor((z0 + z1) / 2), "magenta", 8);
    c.blink(x0 + 1, top + 2, z0 + 1, "red");
  } else {
    // Main-street dept store: giant red star + bag sign
    shoppingBag(v, -1, top + 1, Math.floor((z0 + z1) / 2), "red", 8);
    for (const fx of [x0 + 1, x1 - 2]) flag(v, fx, top + 1, z1 - 2, 6, ["red", "white", "blue"]);
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
// GROCERY STORE
// =============================================================================================

/**
 * GROCERY — produce stand → corner grocer → supermarket → hypermarket w/ loading docks → megamarket w/ rooftop farm.
 * A GIANT FRUIT mascot always sits on top.
 *  V0 Farmers' Market (green & timber, giant red apple)     V1 Retro 60s Supermarket (red/white googie, giant orange)
 *  V2 Organic Co-op (timber & glass, giant watermelon)      V3 Asian Night Market (red lanterns, giant grapes)
 */
function buildGrocery(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["cream", "white", "woodLight", "#f3e2c0"][s];
  const accent = ["#2f9e44", "red", "oak", "crimson"][s];
  const accent2 = ["white", "white", "leafLight", "yellow"][s];
  const roofCol = ["leafDark", "redDark", "#5b7a3a", "crimson"][s];
  const fruit = (["apple", "orange", "melon", "grape"] as const)[s];
  const fruitCol = ["red", "orange", "leaf", "purple"][s];
  lot(c, lv <= 2 ? "path" : "asphalt");
  if (lv <= 2) speckle(c, "path2", 0.15);

  const lanterns = (x0: number, x1: number, y: number, z: number) => {
    if (s !== 3) return;
    for (let x = x0; x < x1; x += 3) {
      v.put(x, y, z, "red", 1);
      v.put(x, y - 1, z, "red", 1);
      v.put(x, y + 1, z, "charcoal");
    }
  };

  if (lv === 1) {
    // produce stand: wooden stall, striped awning roof, tiered crates, giant fruit on a pole
    v.box(-hx + 2, 0, -hz + 2, hx - 2, 1, hz - 2, "woodLight");
    const x0 = -hx + 3;
    const x1 = hx - 3;
    for (const px of [x0, x1 - 1]) for (const pz of [-3, 2]) v.box(px, 1, pz, px + 1, 7, pz + 1, "woodDark");
    for (let x = x0 - 1; x < x1 + 1; x++) v.box(x, 7, -4, x + 1, 8, 4, (x & 1) ? accent2 : accent);
    v.box(x0 - 1, 8, -2, x1 + 1, 9, 2, (x0 & 1) ? accent : accent2);
    for (let t = 0; t < 3; t++) produceCrates(c, x0 + 1, x1 - 1, 2 - t, 1 + t);
    lanterns(x0, x1, 6, 3);
    v.box(-1, 9, -1, 0, 11, 0, "woodDark");
    giantFruit(v, -0.5, 11, -0.5, 2.6, fruitCol, fruit);
    folk(c, 0, -2);
    folk(c, -2, hz - 3);
    cart(v, 3, hz - 3);
    return;
  }

  // Building block sizes per level
  const bigBox = lv >= 3;
  const x0 = -hx + 2;
  const x1 = hx - 2;
  const z0 = -hz + 2;
  const z1 = lv === 2 ? hz - 5 : lv === 3 ? 1 : lv === 4 ? -2 : -4;
  const h = lv === 2 ? 7 : lv === 3 ? 9 : 10;
  if (s === 2) {
    // timber + glass co-op
    shell(v, x0, 1, z0, x1, h, z1, wall);
    for (let x = x0; x < x1; x += 4) v.box(x, 1, z1 - 1, x + 1, h, z1, "woodDark");
    v.box(x0 + 1, 2, z1 - 1, x1 - 1, h - 2, z1, "glass", 0.5);
    for (let x = x0; x < x1; x += 4) v.box(x, 1, z1 - 1, x + 1, h, z1, "woodDark");
    gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", roofCol, "woodDark");
  } else {
    shell(v, x0, 1, z0, x1, h, z1, wall);
    shopfront(v, x0 + 1, x1 - 1, 1, z1 - 1, 5, s === 3 ? "crimson" : "steelLight", "glass", "glassDark");
    displayDots(c, x0 + 2, x1 - 2, 2, 4, z1 - 1, ["red", "orange", "yellow", "lime"], 0.25);
    // fascia band
    v.box(x0, h - 3, z1 - 1, x1, h, z1 + 1, accent, 0.25);
    v.box(x0 + 2, h - 2, z1 + 1, x1 - 2, h - 1, z1 + 2, accent2, 0.8);
    if (s === 1) {
      // googie zig-zag roof fins
      for (let x = x0; x < x1; x += 6) {
        for (let k = 0; k < 4; k++) v.box(x + k, h + k, z1 - 2, x + k + 1, h + k + 1, z1 + 2, "white");
      }
    }
    if (s === 3) {
      // pagoda-ish eave
      v.box(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 2, roofCol);
      v.box(x0 - 2, h - 1, z1 + 1, x0, h, z1 + 3, roofCol);
      v.box(x1, h - 1, z1 + 1, x1 + 2, h, z1 + 3, roofCol);
    }
    flatRoof(c, x0, h, z0, x1, z1, "concreteDark", wall, false);
  }
  // awning & crates along front
  awning(v, x0 + 1, x1 - 1, 5, z1, accent, accent2);
  produceCrates(c, x0 + 1, Math.min(x1 - 1, x0 + 9), z1 + 2);
  produceCrates(c, Math.max(x0 + 11, x1 - 9), x1 - 1, z1 + 2);
  lanterns(x0 + 1, x1 - 1, 4, z1 + 2);
  // giant fruit on the roof
  const fr = byLv(c, [2.5, 3, 4, 4.5, 5]);
  const fz = Math.floor((z0 + z1) / 2);
  v.box(-2, h + 1, fz - 1, 2, h + 2, fz + 1, "steelDark");
  giantFruit(v, -0.0, h + 1, fz, fr, fruitCol, fruit);

  if (lv === 2) {
    v.box(-hx, 0, z1, hx, 1, hz, "path2");
    folk(c, -hx + 3, hz - 2);
    folk(c, hx - 5, hz - 1);
    cart(v, 1, hz - 2);
    // bicycle
    v.box(hx - 4, 1, hz - 2, hx - 1, 2, hz - 1, "teal");
    return;
  }
  // L3+: parking lot in front with carts & cars
  const pz0 = z1 + 4;
  parking(c, -hx + 1, pz0, hx - 1, hz - 1, { cars: 0.55, asphalt: "asphalt" });
  v.box(-hx, 0, z1, hx, 1, pz0, "concrete2");
  for (let i = 0; i < 4; i++) cart(v, c.ri(-hx + 2, hx - 4), c.ri(pz0 + 1, hz - 2));
  // cart corral
  v.box(hx - 6, 1, pz0, hx - 2, 2, pz0 + 1, "silver");
  for (let k = 0; k < 3; k++) cart(v, hx - 6 + k, pz0 + 1);
  crowd(c, x0 + 2, z1 + 1, x1 - 2, z1 + 3, 3 + lv);
  // pylon sign
  pylon(v, -hx + 2, hz - 2, 9, 5, 4, accent, "steelDark", accent2);
  if (lv >= 4) {
    // side loading dock with delivery trucks
    v.box(x1 - 1, 1, z0 + 2, x1, 5, z0 + 6, "steelDark");
    v.box(x1 - 1, 1, z0 + 8, x1, 5, z0 + 12, "steelDark");
    truck(v, x1 + 0, 1, z0 + 4, "x", "white", accent === "oak" ? "leaf" : accent);
    // rooftop: produce billboard row
    for (let x = x0 + 3; x < x1 - 3; x += 6) acUnit(v, x, h + 1, z0 + 2);
  }
  if (lv >= 5) {
    // ROOFTOP FARM: glass greenhouses + raised beds + solar
    for (let x = x0 + 2; x < -6; x += 8) {
      v.box(x, h + 1, z0 + 2, x + 7, h + 4, z0 + 9, "#bfe7ff", 0.15);
      v.roofGable(x, h + 4, z0 + 2, x + 7, z0 + 9, 3, "z", "#cdeeff", "white");
      for (let z = z0 + 3; z < z0 + 9; z += 2) v.box(x + 1, h + 1, z, x + 6, h + 2, z + 1, "leaf");
    }
    for (let z = z0 + 2; z < z1 - 2; z += 2) {
      v.box(8, h + 1, z, x1 - 2, h + 2, z + 1, "soil");
      for (let x = 8; x < x1 - 2; x += 2) v.put(x, h + 2, z, c.pick(["leaf", "lime", "red", "orange"]));
    }
    tree(v, x0 + 2, h + 1, z1 - 3, "fruit", 0.9, 1);
    tree(v, x1 - 3, h + 1, z1 - 3, "fruit", 0.9, 2);
    flag(v, x0 + 1, h + 1, z0 + 1, 7, [accent, accent2, accent]);
  }
}

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
    levels: ["Produce Stand", "Corner Grocer", "Neighborhood Supermarket", "Hypermarket & Loading Docks", "Rooftop-Farm Megamarket"],
    growth: "A fruit stand becomes a grocer, then a supermarket with parking, a hypermarket with trucks and a megamarket farming on its roof — always crowned by a giant fruit.",
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
// RESTAURANTS
// =============================================================================================

/** Revolving restaurant disk (rotor, axis y). Pivot at (px, y, pz); returns the rotor's top y. */
function revolvingTop(c: Ctx, px: number, y: number, pz: number, r: number, h: number, body: string, glass: string, roof: string, speed = 0.25): number {
  const rot = new PixelVox(7);
  rot.cylinderY(0, 0, 0, 1, r, body);
  rot.cylinderY(0, 0, 1, h - 1, r - 0.5, glass, 0.6);
  // mullions
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    rot.box(Math.floor(Math.cos(ang) * (r - 0.6)), 1, Math.floor(Math.sin(ang) * (r - 0.6)), Math.floor(Math.cos(ang) * (r - 0.6)) + 1, h - 1, Math.floor(Math.sin(ang) * (r - 0.6)) + 1, body);
  }
  rot.cylinderY(0, 0, h - 1, h, r + 0.6, roof);
  rot.cylinderY(0, 0, h, h + 1, r - 1.5, roof);
  rot.cylinderY(0, 0, h + 1, h + 2, r - 3, roof);
  c.addRotor({ vox: rot, pivot: [px, y, pz], axis: "y", speed });
  return y + h + 2;
}

/** Giant food mascots */
function giantBurger(v: V, cx: number, y: number, cz: number, r = 3): number {
  v.cylinderY(cx, cz, y, y + 1, r - 0.5, "#d9a55b");
  v.cylinderY(cx, cz, y + 1, y + 2, r, "#6b3b1f");
  v.cylinderY(cx, cz, y + 2, y + 3, r + 0.4, "yellow");
  v.cylinderY(cx, cz, y + 3, y + 4, r, "leaf");
  v.dome(cx, y + 4, cz, r, "#e0a050");
  for (let i = 0; i < 6; i++) v.put(cx + Math.cos(i) * (r - 1.2) - 0.5, y + 4 + Math.round(r * 0.6), cz + Math.sin(i) * (r - 1.2) - 0.5, "cream");
  return y + 4 + Math.ceil(r);
}
function giantTaco(v: V, cx: number, y: number, cz: number, r = 4): number {
  // half-moon shell standing upright facing +z
  for (let x = -r; x <= r; x++) for (let yy = 0; yy <= r; yy++) {
    const d = x * x + (yy - r) * (yy - r);
    if (yy <= r && d <= r * r && d >= (r - 1.3) * (r - 1.3) && yy <= r) v.box(cx + x, y + r - yy, cz - 1, cx + x + 1, y + r - yy + 1, cz + 2, "#f2c14e");
  }
  for (let x = -r + 2; x <= r - 2; x++) {
    v.put(cx + x, y + r - 0, cz, x % 2 ? "leaf" : "red");
    v.put(cx + x, y + r - 1, cz, "#7a4a2a");
  }
  return y + r + 1;
}

/**
 * RESTAURANTS — food cart → diner → bistro with patio → multi-floor restaurant → revolving skyline restaurant.
 *  V0 Retro '50s Diner (chrome, red stripe, neon, giant burger)   V1 Parisian Bistro (cream, red awning, mansard)
 *  V2 Japanese Izakaya (dark timber, tiled roofs, red lanterns)  V3 Taco Truck Plaza (pink/turquoise, papel picado, giant taco)
 */
function buildRestaurants(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["silver", "cream", "#4a3020", "#ff7eb6"][s];
  const wall2 = ["red", "#2f6b3a", "woodDark", "#2ec4b6"][s];
  const roofCol = ["red", "slate", "#3a4250", "orange"][s];
  const umb = ["red", "crimson", "red", "#2ec4b6"][s];
  lot(c, ["concrete2", "path", "path2", "sandDark"][s]);
  speckle(c, ["concrete", "path2", "stone", "sand"][s], 0.1);

  const lanternRow = (x0: number, x1: number, y: number, z: number) => {
    for (let x = x0; x < x1; x += 2) {
      if (s === 2) { v.put(x, y, z, "red", 1); v.put(x, y - 1, z, "red", 1); }
      else if (s === 3) v.put(x, y - ((x >> 1) & 1), z, c.pick(["magenta", "yellow", "cyan", "lime", "orange"]), 0.6);
      else v.put(x, y, z, "warmGlow", 1);
    }
  };
  const mascot = (cx: number, y: number, cz: number, k = 1) => {
    if (s === 0) return giantBurger(v, cx, y, cz, 2.5 * k);
    if (s === 3) return giantTaco(v, cx, y, cz, Math.round(3.5 * k));
    if (s === 2) {
      // giant red paper lantern (chōchin)
      v.sphere(cx + 0.5, y + 3 * k, cz + 0.5, 2.4 * k, 3 * k, 2.4 * k, "red", 0.7);
      v.box(cx - 1, y, cz - 1, cx + 2, y + 1, cz + 2, "black");
      v.box(cx - 1, y + Math.round(6 * k), cz - 1, cx + 2, y + Math.round(6 * k) + 1, cz + 2, "black");
      return y + Math.round(6 * k) + 1;
    }
    // giant croissant / wine glass for bistro: wine glass
    v.box(cx, y, cz, cx + 1, y + 3, cz + 1, "white", 0.3);
    v.box(cx - 1, y, cz - 1, cx + 2, y + 1, cz + 2, "white", 0.3);
    v.cone(cx + 0.5, y + 3, y + 7, cz + 0.5, 0.8, 2.2, "white", 0.3);
    v.cylinderY(cx + 0.5, cz + 0.5, y + 3, y + 5, 1.4, "crimson", 0.5);
    return y + 7;
  };

  /** the restaurant building for L2-L4; returns roof y */
  const house = (x0: number, z0: number, x1: number, z1: number, floors: number): number => {
    const fh = 5;
    const top = 1 + floors * fh;
    if (s === 0) {
      // streamline diner car: rounded barrel roof, chrome walls, red stripe, glass band
      shell(v, x0, 1, z0, x1, top, z1, "silver");
      for (let y = 1; y < top; y += fh) {
        v.box(x0, y + 1, z0, x1, y + 2, z1, "red");
        v.box(x0 + 1, y + 2, z1 - 1, x1 - 1, y + 4, z1, "glass", 0.6);
        v.box(x1 - 1, y + 2, z0 + 1, x1, y + 4, z1 - 1, "glass", 0.6);
      }
      barrelRoof(v, x0, top, z0, x1, z1, "x", "chrome", "red");
      sign(v, x0 + 2, x1 - 2, top + 3, top + 6, z1 - 2, "red", 1, "yellow");
      door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "glassDark");
      return top + 6;
    }
    if (s === 1) {
      shell(v, x0, 1, z0, x1, top, z1, "cream");
      shopfront(v, x0 + 1, x1 - 1, 1, z1 - 1, 4, "#2f6b3a", "glass", "#2f6b3a", 0.6);
      if (floors > 1) windows(c, x0, fh, z0, x1, top, z1, { stepV: fh, h: 3, w: 2, stepH: 4, emit: 0.5, sill: "charcoal" });
      for (let y = 1 + fh * 2; y <= top - fh; y += fh) v.box(x0, y, z1, x1, y + 1, z1 + 1, "charcoal");
      awning(v, x0, x1, 5, z1, "crimson", "crimson");
      sign(v, x0 + 2, x1 - 2, 6, 7, z1, "gold", 0.8);
      v.box(x0, top - 1, z0, x1, top, z1 + 1, "white");
      return mansard(v, x0, top, z0, x1, z1, "slate", "slateLight", "glass");
    }
    if (s === 2) {
      shell(v, x0, 1, z0, x1, top, z1, "#4a3020");
      for (let y = 1; y < top; y += fh) {
        v.box(x0 + 1, y + 1, z1 - 1, x1 - 1, y + 4, z1, "#f5e6c8", 0.55); // shoji screens
        for (let x = x0 + 1; x < x1; x += 2) v.box(x, y + 1, z1 - 1, x + 1, y + 4, z1, "woodDark");
        v.box(x1 - 1, y + 1, z0 + 1, x1, y + 4, z1 - 1, "#f5e6c8", 0.55);
        if (y > 1) v.box(x0 - 1, y - 1, z0 - 1, x1 + 1, y, z1 + 1, "#3a4250");
      }
      // noren curtain & entrance
      const dx = Math.floor((x0 + x1) / 2) - 2;
      v.box(dx, 2, z1, dx + 4, 4, z1 + 1, "indigo");
      v.box(dx + 1, 1, z1 - 1, dx + 3, 4, z1, "black");
      lanternRow(x0 + 1, x1 - 1, 4, z1 + 1);
      return hip(v, x0 - 2, top, z0 - 2, x1 + 2, z1 + 2, "#3a4250", "#2a3240", 4);
    }
    // taqueria: bright stucco, turquoise trim, painted tile band, flat roof w/ parapet scallop
    shell(v, x0, 1, z0, x1, top, z1, "#ff7eb6");
    v.box(x0, 1, z1 - 1, x1, 2, z1, "#2ec4b6");
    windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, w: 3, stepH: 5, emit: 0.55, sill: "#2ec4b6", faces: "se" });
    v.box(x0 + 2, 1, z1 - 1, x0 + 7, 4, z1, "glass", 0.7); // order window
    v.box(x0 + 1, 4, z1, x0 + 8, 5, z1 + 2, "yellow");
    v.box(x0, top - 1, z0, x1, top, z1, "#2ec4b6");
    for (let x = x0; x < x1; x += 4) v.box(x, top, z1 - 1, x + 2, top + 1, z1, "#ff7eb6");
    return top + 1;
  };

  if (lv === 1) {
    // FOOD CART
    v.box(-hx + 2, 0, -hz + 2, hx - 2, 1, hz - 2, ["concrete", "path2", "stone", "sand"][s]);
    if (s === 3) {
      // taco truck
      v.box(-6, 1, -3, 5, 6, 2, "#2ec4b6");
      v.box(5, 1, -3, 8, 4, 2, "#2ec4b6");
      v.box(6, 3, -3, 8, 4, 2, "glassDark");
      v.box(-4, 3, 1, 3, 5, 2, "glass", 0.7);
      v.box(-5, 5, 2, 4, 6, 3, "yellow");
      v.box(-6, 6, -3, 5, 7, 2, "#ff7eb6");
      for (const wx of [-4, 5]) { v.put(wx, 0, -3, "rubber"); v.put(wx, 0, 1, "rubber"); }
      giantTaco(v, -1, 7, -1, 3);
      for (let x = -hx + 2; x < hx - 2; x += 2) v.put(x, 1, hz - 3, c.pick(["magenta", "yellow", "cyan"]));
      folk(c, -2, 4); folk(c, 0, 5); folk(c, 2, 4);
      return;
    }
    // push cart with big umbrella
    const cartCol = ["silver", "#2f6b3a", "woodDark", "white"][s];
    v.box(-4, 2, -2, 4, 5, 2, cartCol);
    v.box(-4, 5, -2, 4, 6, 2, s === 2 ? "woodLight" : "steelLight");
    v.box(-4, 3, 1, 4, 4, 2, wall2, 0.4);
    v.put(-4, 1, -2, "rubber"); v.put(-4, 1, 1, "rubber");
    v.box(3, 1, -2, 4, 2, 2, "steelDark");
    v.box(4, 4, -1, 6, 5, 0, "steelDark");
    if (s === 2) {
      // yatai: wooden roof frame + noren + lanterns
      for (const px of [-4, 3]) v.box(px, 6, -2, px + 1, 10, -1, "woodDark");
      v.box(-5, 10, -3, 5, 11, 2, "woodLight");
      v.box(-4, 8, 1, 4, 10, 2, "indigo");
      v.put(-5, 8, 1, "red", 1); v.put(-5, 7, 1, "red", 1);
      v.put(4, 8, 1, "red", 1); v.put(4, 7, 1, "red", 1);
      c.smoke(0, 11, -1, "steam");
      for (const sx of [-3, 0, 3]) v.box(sx, 1, 3, sx + 1, 3, 4, "woodDark");
    } else {
      v.box(0, 6, 0, 1, 10, 1, "silver");
      for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
        const d = Math.abs(x) + Math.abs(z);
        if (d <= 6) v.put(x, 10 + (d <= 2 ? 1 : 0), z, (Math.atan2(z, x) * 4 / Math.PI + 8) % 2 < 1 ? umb : "white");
      }
      if (s === 0) giantBurger(v, 0, 12, 0, 2);
      else mascot(0, 12, 0, 0.7);
      for (const sx of [-3, 3]) { v.box(sx, 1, 4, sx + 1, 3, 5, "silver"); v.put(sx, 3, 4, umb); }
    }
    c.smoke(-2, 6, -1, "steam");
    folk(c, -1, 4); folk(c, 2, 5);
    return;
  }

  if (lv === 2) {
    const top = house(-hx + 2, -hz + 3, hx - 2, hz - 5, 1);
    mascot(-0, top, -1, s === 2 ? 0.8 : 1);
    lanternRow(-hx + 1, hx - 1, 4, hz - 1);
    cafeTable(v, -hx + 3, hz - 2, umb);
    folk(c, 3, hz - 2);
    folk(c, 5, hz - 3);
    return;
  }

  if (lv === 3) {
    // building on the left, patio with umbrellas & string lights on the right
    const bx1 = Math.max(-hx + 14, 0);
    const top = house(-hx + 2, -hz + 2, bx1, hz - 4, s === 1 ? 2 : 1);
    mascot(Math.floor((-hx + 2 + bx1) / 2), top, -2, 1);
    // patio deck with low fence
    const px0 = bx1 + 1;
    v.box(px0, 0, -hz + 2, hx - 1, 1, hz - 1, s === 2 ? "woodLight" : s === 3 ? "terracotta" : "path2");
    if (s === 2) {
      // zen patio: low tables, bamboo, raked gravel
      for (let x = px0 + 2; x < hx - 3; x += 5) for (let z = -hz + 4; z < hz - 3; z += 5) {
        v.box(x, 1, z, x + 3, 2, z + 2, "woodDark");
        v.put(x - 1, 1, z, "indigo");
        v.put(x + 3, 1, z + 1, "indigo");
      }
      for (let z = -hz + 2; z < hz - 1; z += 2) v.box(hx - 2, 1, z, hx - 1, 8, z + 1, "lime");
    } else {
      for (let x = px0 + 2; x < hx - 2; x += 5) for (let z = -hz + 4; z < hz - 2; z += 6) cafeTable(v, x, z, c.pick([umb, "white", wall2]));
    }
    fence(v, px0, -hz + 1, hx, hz, 1, 2, s === 0 ? "red" : s === 3 ? "#2ec4b6" : "woodDark", [px0 + 2, px0 + 6]);
    for (const [px, pz] of [[px0, -hz + 1], [hx - 1, -hz + 1], [px0, hz - 1], [hx - 1, hz - 1]]) v.box(px, 1, pz, px + 1, 9, pz + 1, "woodDark");
    stringLights(v, px0, hx, 9, -hz + 1);
    stringLights(v, px0, hx, 9, hz - 1);
    for (let z = -hz + 1; z < hz; z++) v.put(px0, 9 - Math.round(Math.sin(((z + hz) / (2 * hz)) * Math.PI)), z, z % 2 ? "warmGlow" : "charcoal", z % 2 ? 1 : 0);
    crowd(c, px0 + 1, -hz + 3, hx - 2, hz - 2, 6);
    return;
  }

  if (lv === 4) {
    // multi-floor restaurant with rooftop terrace and valet
    const z1 = hz - 6;
    const top = house(-hx + 3, -hz + 3, hx - 3, z1, 3);
    const rt = s === 1 ? top : top;
    if (s !== 1 && s !== 2) {
      for (let x = -hx + 6; x < hx - 6; x += 6) cafeTable(v, x, -hz + 8, c.pick([umb, "white"]), rt);
      stringLights(v, -hx + 3, hx - 3, rt + 6, -hz + 4);
    }
    mascot(hx - 9, rt, -hz + 6, 1.3);
    // valet stand & cars
    v.box(-hx, 0, z1, hx, 1, hz, "path2");
    v.box(-3, 1, z1 + 1, 3, 2, z1 + 3, "crimson"); // red carpet
    car(v, -hx + 5, 1, hz - 2, "x", "black");
    car(v, hx - 6, 1, hz - 2, "x", "white");
    lamp(v, -5, 1, z1 + 1, 5);
    lamp(v, 4, 1, z1 + 1, 5);
    crowd(c, -hx + 3, z1 + 1, hx - 3, hz - 3, 6);
    return;
  }

  // L5: REVOLVING SKYLINE RESTAURANT — base restaurant + slim tower + spinning dining disk
  const z1 = hz - 6;
  house(-hx + 2, -hz + 2, hx - 2, z1, 1);
  const cz = -2;
  const towerTop = 52;
  const tcol = ["white", "iron", "#b8202a", "#2ec4b6"][s];
  if (s === 1) {
    // iron lattice tower (Eiffel nod): 4 tapered legs
    for (let y = 1; y < towerTop; y++) {
      const spread = Math.max(1, Math.round(9 * Math.pow(1 - y / towerTop, 1.6)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) v.put(sx * spread - (sx < 0 ? 1 : 0), y, cz + sz * spread - (sz < 0 ? 1 : 0), "iron");
      if (y % 6 === 0) {
        v.box(-spread, y, cz - spread, spread, y + 1, cz - spread + 1, "iron");
        v.box(-spread, y, cz + spread - 1, spread, y + 1, cz + spread, "iron");
        v.box(-spread, y, cz - spread, -spread + 1, y + 1, cz + spread, "iron");
        v.box(spread - 1, y, cz - spread, spread, y + 1, cz + spread, "iron");
      }
    }
    v.box(-1, 14, cz - 1, 1, towerTop, cz + 1, "iron");
  } else if (s === 2) {
    // pagoda-tiered core
    cyl(v, -0.0, cz, 1, towerTop, 2.2, tcol);
    for (let y = 10; y < towerTop - 4; y += 8) {
      hip(v, -5, y, cz - 5, 5, cz + 5, "#3a4250", "#2a3240", 2);
      v.put(-5, y - 1, cz + 4, "red", 1);
      v.put(4, y - 1, cz + 4, "red", 1);
    }
  } else {
    // Googie / sombrero: slender tri-column core
    cyl(v, -0.0, cz, 1, towerTop, 1.6, tcol);
    for (const [ox, oz] of [[-4, -3], [4, -3], [0, 4]]) {
      for (let y = 1; y < towerTop - 6; y++) {
        const t = y / (towerTop - 6);
        v.put(Math.round(ox * (1 - t)), y, cz + Math.round(oz * (1 - t)), tcol);
      }
    }
    for (let y = 8; y < towerTop - 2; y += 8) v.cylinderY(-0.0, cz, y, y + 1, 2.4, wall2);
  }
  // elevator glow
  v.box(0, 2, cz + 1, 1, towerTop, cz + 2, "warmGlow", 0.7);
  // fixed platform under the disk
  v.cylinderY(-0.0, cz, towerTop, towerTop + 1, 4, "steelDark");
  const r = Math.min(9, hx - 3);
  const topY = revolvingTop(c, 0, towerTop + 1, cz, r, 5, s === 3 ? "#ff7eb6" : s === 1 ? "iron" : s === 2 ? "woodDark" : "white", s === 2 ? "#f5e6c8" : "glass", roofCol, 0.3);
  if (s === 3) {
    // sombrero crown: tall cone on top of the disk
    v.cone(0, topY - 1, topY + 7, cz, 3, 0.5, "yellow");
  } else {
    v.box(0, topY - 1, cz, 1, topY + 6, cz + 1, "silver");
  }
  c.blink(0, topY + 7, cz, "red");
  crowd(c, -hx + 2, z1 + 1, hx - 2, hz - 1, 8);
  lamp(v, -hx + 1, 1, hz - 2, 5);
  lamp(v, hx - 2, 1, hz - 2, 5);
}

// =============================================================================================
// CHEESESTEAK
// =============================================================================================

/** Giant cheesesteak hoagie along x: split roll, sizzling steak, drippy cheese, peppers */
function cheesesteak(v: V, cx: number, y: number, cz: number, L: number, w = 2): number {
  const bun = "#d9a55b";
  const bunTop = "#c88a3e";
  // bottom roll
  v.box(cx - L, y, cz - w, cx + L, y + 2, cz + w, bun);
  v.clear(cx - L, y, cz - w, cx - L + 1, y + 1, cz + w);
  v.clear(cx + L - 1, y, cz - w, cx + L, y + 1, cz + w);
  // steak & onions
  v.box(cx - L + 1, y + 2, cz - w + 1, cx + L - 1, y + 3, cz + w, "#7a4a2a");
  for (let x = cx - L + 1; x < cx + L - 1; x += 2) v.put(x, y + 3, cz, x % 4 === 0 ? "leaf" : "#e8d7a8");
  // cheese whiz layer with drips over the front
  v.box(cx - L + 1, y + 3, cz - w + 1, cx + L - 1, y + 4, cz + w, "#ffc61a", 0.25);
  for (let x = cx - L + 2; x < cx + L - 2; x += 3) v.box(x, y + 1, cz + w, x + 1, y + 4, cz + w + 1, "#ffc61a", 0.25);
  // back half of roll hinged up
  v.box(cx - L, y + 2, cz - w - 1, cx + L, y + 5, cz - w + 1, bunTop);
  v.clear(cx - L, y + 4, cz - w - 1, cx - L + 1, y + 5, cz - w + 1);
  v.clear(cx + L - 1, y + 4, cz - w - 1, cx + L, y + 5, cz - w + 1);
  return y + 5;
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
    return h + 1;
  };

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
  // L5 CHEESESTEAK PALACE — 3-storey neon block, giant spinning hoagie on a tower, queue snaking round
  const x0 = -hx + 2;
  const x1 = hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - 7;
  const top = shopBox(x0, z0, x1, z1, 16);
  // neon chevrons up the facade
  for (let y = 10; y < 15; y += 2) neonTube(x0 + 2, x1 - 2, y, z1);
  // tower + rotating hoagie
  const tx = 0;
  const tz = Math.floor((z0 + z1) / 2);
  v.box(tx - 1, top, tz - 1, tx + 1, top + 12, tz + 1, "steelDark");
  for (let y = top + 1; y < top + 12; y += 2) v.put(tx, y, tz + 1, neonA, 1.3);
  const rot = new PixelVox(3);
  cheesesteak(rot, 0, 0, 0, 8, 2);
  c.addRotor({ vox: rot, pivot: [tx, top + 12, tz], axis: "y", speed: 0.6 });
  // rooftop seating & searchlight blink
  for (const [bx, bz] of [[x0 + 3, z0 + 3], [x1 - 6, z0 + 3]]) cafeTable(v, bx, bz, neonA, top);
  c.blink(x0 + 1, top + 1, z1 - 2, neonA);
  c.blink(x1 - 2, top + 1, z1 - 2, neonB);
  // queue snakes along the sidewalk
  v.box(-hx, 0, z1, hx, 1, hz, "path2");
  for (let x = -hx + 2; x < hx - 2; x += 1) if (x % 2 === 0) folk(c, x, z1 + 3);
  for (let x = -hx + 2; x < 0; x += 2) folk(c, x, z1 + 5);
  if (s === 3) truck(v, hx - 6, 1, hz - 2, "x", "yellow", "red");
  else car(v, hx - 5, 1, hz - 2, "x", "busYellow");
}

// =============================================================================================
// BARS
// =============================================================================================

/** Neon martini glass sign on the +z plane (centre x, base y) */
function neonMartini(v: V, x: number, y: number, z: number, col: string, olive = "lime", k = 1): number {
  const h = Math.round(4 * k);
  for (let i = 0; i <= h; i++) {
    v.put(x - i, y + Math.round(2 * k) + i, z, col, 1.4);
    v.put(x + i, y + Math.round(2 * k) + i, z, col, 1.4);
  }
  v.box(x - h, y + Math.round(2 * k) + h, z, x + h + 1, y + Math.round(2 * k) + h + 1, z + 1, col, 1.4);
  v.box(x, y, z, x + 1, y + Math.round(2 * k) + 1, z + 1, col, 1.4);
  v.box(x - 2, y, z, x + 3, y + 1, z + 1, col, 1.4);
  v.put(x + 1, y + Math.round(2 * k) + h - 1, z, olive, 1.2);
  return y + Math.round(2 * k) + h + 1;
}

/** Giant frothy beer mug (3D) */
function beerMug(v: V, cx: number, y: number, cz: number, r = 2.5, h = 6): number {
  v.cylinderY(cx, cz, y, y + h, r, "amber", 0.4);
  v.cylinderY(cx, cz, y + h, y + h + 2, r + 0.5, "white");
  v.sphere(cx + 0.5, y + h + 2, cz + 0.5, r * 0.6, 1, r * 0.6, "white");
  v.box(Math.round(cx + r), y + 1, Math.round(cz) - 1, Math.round(cx + r) + 2, y + 2, Math.round(cz), "glass");
  v.box(Math.round(cx + r) + 1, y + 1, Math.round(cz) - 1, Math.round(cx + r) + 2, y + h - 1, Math.round(cz), "glass");
  v.box(Math.round(cx + r), y + h - 2, Math.round(cz) - 1, Math.round(cx + r) + 2, y + h - 1, Math.round(cz), "glass");
  return y + h + 3;
}

/** Searchlight rotor: a beam of glowing voxels sweeping round (axis y) */
function searchlight(c: Ctx, x: number, y: number, z: number, col = "warmGlow", speed = 0.8): void {
  c.v.box(x - 1, y, z - 1, x + 1, y + 2, z + 1, "steelDark");
  const rot = new PixelVox(5);
  for (let i = 0; i < 14; i++) rot.put(Math.round(i * 0.45), i, 0, col, 1.5);
  c.addRotor({ vox: rot, pivot: [x, y + 2, z], axis: "y", speed });
}

/**
 * BARS — corner tap → pub → tavern with beer garden → nightclub with rooftop lounge → skyline sky-bar with searchlights.
 *  V0 Irish Pub (green & gold, shamrock)       V1 Tiki Bar (bamboo, thatch, torches, giant tiki head)
 *  V2 Neon Cocktail Lounge (purple, martini)   V3 Bavarian Beer Hall (half-timber, giant beer mug)
 */
function buildBars(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["#1f5c34", "#c99a5b", "#2a1f3d", "cream"][s];
  const trim = ["gold", "woodDark", "magenta", "woodDark"][s];
  const neon = ["lime", "orange", "magenta", "yellow"][s];
  lot(c, ["path", "sand", "asphalt", "path2"][s]);
  speckle(c, ["path2", "sandDark", "asphaltDark", "grass3"][s], 0.12);

  const torch = (x: number, z: number) => {
    v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
    v.put(x, 5, z, "fire", 1.5);
    c.smoke(x, 6, z, "smoke");
  };
  const tikiHead = (x: number, y: number, z: number, h = 7) => {
    v.box(x - 2, y, z - 1, x + 2, y + h, z + 2, "woodDark");
    v.box(x - 2, y + h - 2, z + 2, x + 2, y + h - 1, z + 3, "oak");
    v.put(x - 2, y + h - 3, z + 2, "white", 0.6); v.put(x + 1, y + h - 3, z + 2, "white", 0.6);
    v.box(x - 1, y + 2, z + 2, x + 1, y + 3, z + 3, "red");
    v.box(x - 1, y + 3, z + 2, x + 1, y + 4, z + 3, "oak");
    v.box(x - 2, y + h, z - 1, x + 2, y + h + 1, z + 2, "leaf");
    return y + h + 1;
  };
  const shamrock = (x: number, y: number, z: number) => {
    for (const [dx, dy] of [[-1, 1], [1, 1], [0, 2]]) v.box(x + dx * 1, y + dy * 1, z, x + dx + 1, y + dy + 1, z + 1, "lime", 1.2);
    v.put(x, y, z, "lime", 1.2);
  };

  /** Bar building; returns roof top */
  const barHouse = (x0: number, z0: number, x1: number, z1: number, floors: number): number => {
    const fh = 5;
    const top = 1 + floors * fh;
    if (s === 1) {
      // bamboo walls, thatch hip roof
      shell(v, x0, 1, z0, x1, top, z1, "#c99a5b");
      for (let x = x0; x < x1; x += 2) v.box(x, 1, z1 - 1, x + 1, top, z1, "#a07a3a");
      v.box(x0 + 1, 2, z1 - 1, x1 - 1, 4, z1, "warmGlow", 0.7);
      v.box(x0, 2, z1, x1, 3, z1 + 2, "woodDark"); // bar counter outside
      for (let x = x0 + 1; x < x1 - 1; x += 3) v.put(x, 1, z1 + 2, "woodDark");
      const t = hip(v, x0 - 2, top, z0 - 2, x1 + 2, z1 + 2, "#d9b25a", "#b08a3a");
      return t;
    }
    if (s === 3) {
      // half-timbered Bavarian
      shell(v, x0, 1, z0, x1, top, z1, "cream");
      for (let x = x0; x < x1; x += 3) v.box(x, 1, z1 - 1, x + 1, top, z1, "woodDark");
      for (let y = 1 + fh; y < top; y += fh) v.box(x0, y, z0, x1, y + 1, z1, "woodDark");
      for (let z = z0; z < z1; z += 3) v.box(x1 - 1, 1, z, x1, top, z + 1, "woodDark");
      windows(c, x0, 1, z0, x1, top, z1, { stepV: fh, h: 2, w: 1, stepH: 3, emit: 0.6, col: "warmGlow", faces: "se", margin: 0 });
      door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "woodDark", 2, 4);
      for (let x = x0 + 1; x < x1 - 1; x += 3) v.put(x, 1 + fh + 1, z1, "red"), v.put(x, 1 + fh + 1, z1 + 1, "pink");
      return gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "z", "terracotta", "woodDark");
    }
    if (s === 2) {
      shell(v, x0, 1, z0, x1, top, z1, "#2a1f3d");
      ribbonWindows(c, x0, 1, z0, x1, top, z1, 4, "purple", 0.8);
      v.box(x0, 1, z1 - 1, x1, 2, z1, "magenta", 1.1);
      v.box(x0, top - 1, z0, x1, top, z1, "magenta", 1.1);
      door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "black", 2, 3);
      v.box(Math.floor((x0 + x1) / 2) - 2, 1, z1, Math.floor((x0 + x1) / 2) + 2, 2, z1 + 3, "crimson"); // velvet carpet
      flatRoof(c, x0, top, z0, x1, z1, "black", "#2a1f3d", false);
      return top + 1;
    }
    // Irish pub: green painted front, gold lettering band, small-pane windows, hanging flower baskets
    shell(v, x0, 1, z0, x1, top, z1, s === 0 && floors > 1 ? "brick" : "#1f5c34");
    v.box(x0, 1, z1 - 1, x1, 1 + fh, z1, "#1f5c34");
    v.box(x0 + 1, 2, z1 - 1, x1 - 1, 5, z1, "warmGlow", 0.7);
    for (let x = x0 + 1; x < x1 - 1; x += 2) v.box(x, 2, z1 - 1, x + 1, 5, z1, "#1f5c34");
    door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "redDark", 2, 4);
    v.box(x0, 5, z1, x1, 7, z1 + 1, "black");
    for (let x = x0 + 2; x < x1 - 2; x += 1) if (x % 2) v.put(x, 6, z1 + 1, "gold", 0.8);
    if (floors > 1) windows(c, x0, fh, z0, x1, top, z1, { stepV: fh, h: 2, w: 2, stepH: 4, emit: 0.5, sill: "white" });
    v.put(x0, 6, z1 + 1, "pink"); v.put(x1 - 1, 6, z1 + 1, "pink");
    v.box(x0, top - 1, z0, x1, top, z1, "black");
    const rt = gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", "slate", "black");
    chimney(v, x1 - 3, top, z0 + 1, 6, "brickDark");
    c.smoke(x1 - 2, top + 6, z0 + 2, "smoke");
    return rt;
  };
  const mascot = (x: number, y: number, z: number, k = 1) => {
    if (s === 0) { v.box(x - 3, y, z, x + 4, y + 7, z + 1, "black"); shamrock(x, y + 2, z + 1); v.put(x, y + 1, z + 1, "lime", 1.2); return y + 7; }
    if (s === 1) return tikiHead(x, y, z, Math.round(7 * k));
    if (s === 2) return neonMartini(v, x, y, z, "magenta", "lime", k);
    return beerMug(v, x, y, z, 2.5 * k, Math.round(6 * k));
  };

  if (lv === 1) {
    if (s === 1) {
      // tiki shack: hut on stilts, thatch, torches
      v.box(-hx + 3, 0, -hz + 3, hx - 3, 1, hz - 3, "woodLight");
      for (const px of [-5, 4]) for (const pz of [-4, 2]) v.box(px, 1, pz, px + 1, 7, pz + 1, "woodDark");
      v.box(-5, 1, 2, 5, 4, 3, "#c99a5b");
      v.box(-5, 4, 2, 5, 5, 4, "woodDark");
      hip(v, -8, 7, -7, 8, 6, "#d9b25a", "#b08a3a");
      tikiHead(-7, 1, -6, 6);
      torch(-hx + 2, hz - 2); torch(hx - 3, hz - 2);
      for (const sx of [-3, 0, 3]) v.box(sx, 1, 5, sx + 1, 3, 6, "woodDark");
      folk(c, -1, 6); folk(c, 2, 6);
      return;
    }
    const top = barHouse(-hx + 2, -hz + 3, hx - 2, hz - 4, 1);
    if (s === 2) neonMartini(v, 0, top, hz - 5, "magenta", "lime", 1);
    else if (s === 3) beerMug(v, -0.0, top - 2, -1, 2, 4);
    else { shamrock(hx - 3, 7, hz - 3); }
    v.box(-hx + 2, 1, hz - 3, -hx + 4, 3, hz - 2, "woodDark"); // barrel
    v.put(-hx + 2, 3, hz - 3, "woodLight");
    folk(c, 2, hz - 2);
    return;
  }
  if (lv === 2) {
    const top = barHouse(-hx + 2, -hz + 2, hx - 2, hz - 4, 2);
    if (s === 0) { v.box(hx - 2, 7, hz - 4, hx - 1, 8, hz - 1, "iron"); v.box(hx - 3, 4, hz - 2, hx, 7, hz - 1, "#1f5c34"); shamrock(hx - 2, 4, hz - 1); }
    else mascot(0, top - (s === 3 ? 4 : s === 1 ? 2 : 0), s === 2 ? hz - 5 : -1, 1);
    v.box(-hx + 2, 1, hz - 3, -hx + 4, 3, hz - 2, "woodDark");
    crowd(c, -2, hz - 3, hx - 2, hz - 1, 3);
    return;
  }
  if (lv === 3) {
    // tavern + beer garden (long tables, string lights, trees / tiki torches)
    const bx1 = Math.max(-hx + 14, -2);
    const top = barHouse(-hx + 2, -hz + 2, bx1, hz - 4, 2);
    mascot(Math.floor((-hx + 2 + bx1) / 2), top - (s === 3 ? 4 : s === 1 ? 2 : 0), s === 2 ? hz - 5 : -1, 1);
    const gx0 = bx1 + 1;
    v.box(gx0, 0, -hz + 1, hx - 1, 1, hz - 1, s === 1 ? "sand" : s === 2 ? "#3a2f4d" : "grass3");
    for (let z = -hz + 3; z < hz - 3; z += 5) {
      v.box(gx0 + 2, 1, z, hx - 3, 2, z + 2, s === 2 ? "steelLight" : "woodLight");
      v.box(gx0 + 2, 1, z - 1, hx - 3, 1, z, "woodDark");
      for (let x = gx0 + 3; x < hx - 3; x += 3) v.put(x, 2, z, "amber", 0.4);
    }
    if (s === 1) { torch(gx0 + 1, -hz + 2); torch(hx - 2, -hz + 2); torch(gx0 + 1, hz - 2); torch(hx - 2, hz - 2); tree(v, hx - 3, 1, 0, "palm", 1.2, 1); }
    else {
      for (const [px, pz] of [[gx0, -hz + 1], [hx - 1, -hz + 1], [gx0, hz - 1], [hx - 1, hz - 1]]) v.box(px, 1, pz, px + 1, 9, pz + 1, "woodDark");
      stringLights(v, gx0, hx, 9, -hz + 1, s === 2 ? ["magenta", "cyan", "purple"] : undefined);
      stringLights(v, gx0, hx, 9, hz - 1, s === 2 ? ["magenta", "cyan", "purple"] : undefined);
      if (s !== 2) tree(v, hx - 3, 1, 0, s === 3 ? "oak" : "round", 1.1, 1);
    }
    crowd(c, gx0 + 1, -hz + 2, hx - 2, hz - 2, 7);
    return;
  }
  if (lv === 4) {
    // NIGHTCLUB with rooftop lounge, queue + bouncer
    const z1 = hz - 6;
    const top = barHouse(-hx + 3, -hz + 2, hx - 3, z1, 3);
    const deck = s === 2 ? top - 1 : top;
    if (s === 2 || s === 0) {
      // rooftop lounge: glass rail, booths, neon
      const rx0 = -hx + 4;
      const rx1 = hx - 4;
      const ry = s === 2 ? top - 1 : 1 + 3 * 5;
      if (s === 0) { /* pub roof is a gable - put lounge on a terrace box */ }
      for (let x = rx0 + 2; x < rx1 - 2; x += 6) cafeTable(v, x, -hz + 7, neon, ry + 1);
      mascot(0, ry + 1, -hz + 4, 1.2);
      void deck;
    } else {
      mascot(0, top - (s === 3 ? 6 : 3), -2, 1.5);
    }
    v.box(-hx, 0, z1, hx, 1, hz, "path2");
    // queue behind rope
    for (let x = -hx + 3; x < -1; x += 2) folk(c, x, z1 + 2);
    v.box(-hx + 2, 1, z1 + 3, -1, 2, z1 + 4, "crimson");
    person(v, 1, 1, z1 + 1, "black", "black");
    searchlight(c, hx - 3, 1, hz - 3, s === 2 ? "magenta" : "warmGlow", 0.9);
    return;
  }
  // L5 SKY-BAR TOWER: slim tower, glass rooftop bar with pool & searchlights; club at the base
  const z1 = hz - 5;
  const tx0 = -hx + 6;
  const tx1 = hx - 6;
  const tz0 = -hz + 4;
  const tz1 = z1 - 2;
  barHouse(-hx + 2, -hz + 2, hx - 2, z1, 1);
  const H = 40;
  const tcol = ["#1f5c34", "woodDark", "#2a1f3d", "cream"][s];
  shell(v, tx0, 7, tz0, tx1, H, tz1, tcol);
  ribbonWindows(c, tx0, 7, tz0, tx1, H, tz1, 3, s === 2 ? "purple" : "warmGlow", 0.6);
  for (let y = 9; y < H; y += 6) v.box(tx0 - 1, y, tz0 - 1, tx1 + 1, y + 1, tz1 + 1, trim, s === 2 ? 1.1 : 0);
  // rooftop deck
  v.box(tx0 - 3, H, tz0 - 3, tx1 + 3, H + 1, tz1 + 3, "woodDark");
  v.box(tx0 - 3, H + 1, tz0 - 3, tx1 + 3, H + 2, tz0 - 2, "glass", 0.2);
  v.box(tx0 - 3, H + 1, tz1 + 2, tx1 + 3, H + 2, tz1 + 3, "glass", 0.2);
  v.box(tx0 - 3, H + 1, tz0 - 3, tx0 - 2, H + 2, tz1 + 3, "glass", 0.2);
  v.box(tx1 + 2, H + 1, tz0 - 3, tx1 + 3, H + 2, tz1 + 3, "glass", 0.2);
  v.box(tx0, H, tz0, tx0 + 6, H + 1, tz0 + 4, "cyan", 0.4); // infinity pool
  cafeTable(v, tx1 - 2, tz1 - 1, neon, H + 1);
  // bar pavilion with mascot
  v.box(tx1 - 6, H + 1, tz0, tx1, H + 4, tz0 + 3, trim, 0.3);
  mascot(Math.floor((tx0 + tx1) / 2), H + 1, Math.floor((tz0 + tz1) / 2) + (s === 2 ? 4 : 0), 1.2);
  crowd(c, tx0, tz1 - 2, tx1 - 2, tz1 + 2, 5, H + 1);
  searchlight(c, tx0 - 1, H + 1, tz1 + 1, s === 2 ? "magenta" : "warmGlow", 0.8);
  searchlight(c, tx1, H + 1, tz0 - 2, s === 2 ? "cyan" : "warmGlow", -0.7);
  c.blink(tx0, H + 2, tz0 - 2, "red");
  crowd(c, -hx + 2, z1 + 1, hx - 2, hz - 1, 6);
}

defineDesigns({
  restaurants: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Street Food Cart", "Corner Diner", "Bistro with Patio", "Three-Floor Dining House", "Revolving Skyline Restaurant"],
    growth: "A street cart becomes a diner, gains a string-lit patio, stacks up floors and finally sprouts a tower with a revolving dining room.",
    build: buildRestaurants,
  },
  cheesesteak_restaurants: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Sidewalk Grill Cart", "Walk-Up Steak Window", "Corner Steak Joint", "Rival Neon Corner", "Cheesesteak Palace"],
    growth: "A smoking grill cart becomes a walk-up window, a corner joint with picnic tables, a neon rivalry across the plaza and a palace with a spinning giant hoagie.",
    build: buildCheesesteak,
  },
  bars: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Corner Tap", "Neighborhood Pub", "Tavern & Beer Garden", "Nightclub with Rooftop Lounge", "Sky-Bar Tower"],
    growth: "A tiny tap grows into a pub, opens a beer garden, becomes a nightclub with a queue and searchlights, then a tower with a rooftop sky-bar.",
    build: buildBars,
  },
});
