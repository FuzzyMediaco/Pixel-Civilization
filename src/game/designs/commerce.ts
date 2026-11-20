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
  sawtooth,
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
  if (kind === "melon") {
    // upright watermelon SLICE facing +z: green rind, white band, red flesh, black seeds
    const R = r * 1.5;
    for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) for (let yy = 0; yy <= Math.ceil(R); yy++) {
      const d = Math.sqrt((x + 0.5) * (x + 0.5) + (yy - 0.5) * (yy - 0.5));
      if (d > R) continue;
      const col2 = d > R - 1 ? "leafDark" : d > R - 1.8 ? "#e8f5c8" : ((x * 7 + yy * 3) % 5 === 0 && d < R - 2.5) ? "black" : "#ff4d5e";
      v.box(cx + x, y + Math.ceil(R) - yy, cz - 1, cx + x + 1, y + Math.ceil(R) - yy + 1, cz + 1, col2, col2 === "#ff4d5e" ? 0.15 : 0);
    }
    return y + Math.ceil(R) + 1;
  }
  v.sphere(cx, y + r, cz, r, r * 0.92, r, col);
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
  const x1 = lv >= 4 ? hx - 11 : hx - 2;
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
  const fy = s === 2 ? h + Math.ceil((z1 - z0 + 2) / 2) - 1 : h + 1;
  if (s === 2) v.box(-1, h, fz, 1, fy, fz + 1, "woodDark");
  giantFruit(v, -0.0, fy, s === 2 ? fz + 1 : fz, fr, fruitCol, fruit);

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
  parking(c, -hx + 1, pz0, hx - 1, Math.min(hz - 1, pz0 + 7), { cars: 0.7, asphalt: "asphalt" });
  if (hz - 1 - (pz0 + 7) >= 6) parking(c, -hx + 1, pz0 + 7, hx - 1, hz - 1, { cars: 0.6, asphalt: "asphalt" });
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
    v.box(x1, 0, z0, hx - 1, 1, z1 + 2, "concrete");
    truck(v, x1 + 4, 1, z0 + 4, "x", "white", accent === "oak" ? "leaf" : accent);
    truck(v, x1 + 4, 1, z0 + 10, "x", accent2 === "white" ? "cream" : accent2, "steelDark");
    for (let k = 0; k < 3; k++) v.box(x1 + 1 + k * 3, 1, z1 - 3, x1 + 3 + k * 3, 3, z1 - 1, "crate");
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
    if (s === 2) {
      // rooftop lounge: booths under neon
      const ry = top - 1;
      for (let x = -hx + 6; x < hx - 6; x += 6) cafeTable(v, x, -hz + 7, neon, ry + 1);
      mascot(0, ry + 1, -hz + 4, 1.2);
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
    growth: "A smoking grill cart becomes a walk-up window, a corner joint with picnic tables, a neon rivalry across the plaza and a walk-in hoagie with glowing order windows between its toasted rolls.",
    build: buildCheesesteak,
  },
  bars: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [2, 2]],
    levels: ["Corner Tap", "Neighborhood Pub", "Tavern & Beer Garden", "Nightclub with Rooftop Lounge", "Sky-Bar Tower"],
    growth: "A tiny tap grows into a pub, opens a beer garden, becomes a nightclub with a queue and searchlights, then a tower with a rooftop sky-bar.",
    build: buildBars,
  },
});

// =============================================================================================
// CLOTHING STORES
// =============================================================================================

/** Giant clothes hanger holding a garment (on the +z plane, 2 deep). kind: 0 dress, 1 hoodie, 2 kaftan, 3 blazer */
function giantHanger(v: V, cx: number, y: number, cz: number, k: number, garment: string, kind: number, accent = "white"): number {
  const W = Math.round(6 * k);
  const H = Math.round(9 * k);
  const top = y + H + Math.round(3 * k);
  // hook
  v.box(cx, top - 1, cz, cx + 1, top + 2, cz + 1, "chrome");
  v.box(cx + 1, top + 1, cz, cx + 2, top + 2, cz + 1, "chrome");
  v.box(cx + 2, top, cz, cx + 3, top + 2, cz + 1, "chrome");
  // triangle bar
  for (let i = 0; i <= W; i++) {
    const yy = top - 1 - Math.round((i / W) * 2 * k);
    v.put(cx - i, yy, cz, "chrome");
    v.put(cx + i, yy, cz, "chrome");
  }
  const shoulder = top - 1 - Math.round(2 * k);
  v.box(cx - W, shoulder, cz, cx + W + 1, shoulder + 1, cz + 1, "chrome");
  // garment
  const gy1 = shoulder;
  if (kind === 0 || kind === 2) {
    // dress / kaftan: bodice then flared skirt
    for (let yy = y; yy < gy1; yy++) {
      const t = (gy1 - yy) / (gy1 - y);
      const half = t < 0.4 ? Math.round(W * 0.55) : Math.round(W * (0.4 + (t - 0.4) * 1.0));
      v.box(cx - half, yy, cz - 1, cx + half + 1, yy + 1, cz + 1, garment);
    }
    v.box(cx - Math.round(W * 0.45), gy1 - Math.round(4 * k), cz + 1, cx + Math.round(W * 0.45) + 1, gy1 - Math.round(3 * k), cz + 2, accent, 0.4);
    if (kind === 2) for (let yy = y + 1; yy < gy1 - 2; yy += 2) v.put(cx, yy, cz + 1, accent, 0.4);
  } else {
    // hoodie / blazer: torso + sleeves
    v.box(cx - Math.round(W * 0.6), y + Math.round(1 * k), cz - 1, cx + Math.round(W * 0.6) + 1, gy1, cz + 1, garment);
    v.box(cx - W, y + Math.round(3 * k), cz - 1, cx - Math.round(W * 0.6), gy1, cz + 1, garment);
    v.box(cx + Math.round(W * 0.6) + 1, y + Math.round(3 * k), cz - 1, cx + W + 1, gy1, cz + 1, garment);
    if (kind === 1) {
      v.box(cx - 2, gy1 - 1, cz - 1, cx + 3, gy1 + 1, cz + 1, garment); // hood
      v.box(cx - 2, y + Math.round(2 * k), cz + 1, cx + 3, y + Math.round(4 * k), cz + 2, accent, 0.6); // pocket/logo
    } else {
      for (let yy = y + 2; yy < gy1; yy++) v.put(cx, yy, cz + 1, accent);
      v.box(cx - 1, gy1 - 3, cz + 1, cx + 2, gy1, cz + 2, "white");
      v.put(cx, gy1 - 3, cz + 2, "crimson");
    }
  }
  return top + 2;
}

/**
 * CLOTHING STORES — pop-up boutique → two-floor boutique → fashion house → glass flagship with runway → fashion tower
 * with a giant spinning hanger. Signature: GIANT HANGER + MANNEQUIN WINDOWS.
 *  V0 Paris Couture (black & gold, little black dress)   V1 Streetwear (raw concrete, graffiti, hoodie)
 *  V2 Bohemian (pastel pink, plants, kaftan)              V3 Luxury Minimal (white & rose-gold glass, blazer)
 */
function buildClothing(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["black", "concrete", "#f6c6d0", "white"][s];
  const trim = ["gold", "#ff5a1f", "#b5e48c", "#d4a373"][s];
  const garment = ["crimson", "#ff5a1f", "#f4a259", "#3a3f58"][s];
  const gAccent = ["gold", "white", "#2ec4b6", "#d4a373"][s];
  const dress = [["crimson", "white", "gold", "black"], ["lime", "orange", "sky", "magenta"], ["pink", "yellow", "teal", "lime"], ["white", "#d4a373", "silver", "charcoal"]][s];
  lot(c, ["path2", "asphalt", "grass2", "marble"][s]);
  speckle(c, ["path", "asphaltDark", "grass3", "white"][s], 0.08);

  const graffiti = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    if (s !== 1) return;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (c.rand() < 0.35) v.put(x, y, z, c.pick(["magenta", "lime", "cyan", "yellow", "orange"]), 0.2);
  };
  /** shop block with mannequin windows; returns top y */
  const store = (x0: number, z0: number, x1: number, z1: number, floors: number): number => {
    const fh = 5;
    const top = 1 + floors * fh;
    shell(v, x0, 1, z0, x1, top, z1, wall);
    for (let f = 0; f < floors; f++) {
      const y = 1 + f * fh;
      v.box(x0 + 1, y + 1, z1 - 1, x1 - 1, y + fh - 1, z1, "glass", 0.6);
      for (let x = x0 + 2; x < x1 - 2; x += 3) mannequin(v, x, y + 1, z1 - 1, c.pick(dress));
      v.box(x0, y + fh - 1, z1 - 1, x1, y + fh, z1 + 1, trim, s === 3 ? 0.3 : 0);
      if (s !== 1) v.box(x1 - 1, y + 1, z0 + 1, x1, y + fh - 1, z1 - 1, "glass", 0.4);
    }
    graffiti(x0, x1 - 1, 1, top - 1, z1 - 1);
    graffiti(x1 - 1, x1, 1, top - 1, z1 - 1);
    door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, s === 0 ? "gold" : "glassDark");
    if (s === 0) awning(v, x0, x1, 5, z1, "black", "white");
    if (s === 2) { for (let x = x0; x < x1; x += 3) pot(v, x, z1 + 1, 1, "leaf", c.pick(["pink", "yellow"])); v.box(x0, 5, z1, x1, 6, z1 + 1, "woodLight"); for (let x = x0; x < x1; x += 2) v.put(x, 4, z1, "leafLight"); }
    if (s === 0) mansard(v, x0, top, z0, x1, z1, "black", "charcoal", "gold");
    else if (s === 2) gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "x", "#f4a259", "white");
    else flatRoof(c, x0, top, z0, x1, z1, s === 3 ? "white" : "concreteDark", s === 3 ? trim : wall, false);
    return s === 0 ? top + 4 : s === 2 ? top + 2 : top + 1;
  };
  const hangerK = byLv(c, [0.8, 1.0, 1.25, 1.4, 1.6]);
  const kind = s === 0 ? 0 : s === 1 ? 1 : s === 2 ? 2 : 3;

  if (lv <= 3) {
    const bx1 = lv === 3 ? hx - 9 : hx - 2;
    const z1 = hz - 4;
    const top = store(-hx + 2, -hz + 3, bx1, z1, lv);
    const hy = s === 0 || s === 2 ? top - 3 : top;
    giantHanger(v, Math.floor((-hx + 2 + bx1) / 2), hy, -2, hangerK, garment, kind, gAccent);
    v.box(-hx, 0, z1, hx, 1, hz, s === 3 ? "white" : "path");
    crowd(c, -hx + 2, z1 + 1, hx - 2, hz - 1, lv + 1);
    if (lv === 3) {
      // sidewalk clothing racks + shopping-bag carrying shoppers on a side plaza
      for (let z = -hz + 3; z < z1 - 1; z += 4) {
        v.box(bx1 + 3, 1, z, bx1 + 4, 4, z + 1, "chrome");
        v.box(hx - 3, 1, z, hx - 2, 4, z + 1, "chrome");
        v.box(bx1 + 3, 4, z, hx - 2, 5, z + 1, "chrome");
        for (let x = bx1 + 4; x < hx - 3; x++) v.box(x, 2, z, x + 1, 4, z + 1, c.pick(dress));
      }
      flowerBed(c, bx1 + 2, z1 - 1, hx - 2, z1, 1);
    }
    return;
  }
  if (lv === 4) {
    // FLAGSHIP: building at back + glass cube atrium at front + runway catwalk with photographers
    const top = store(-hx + 2, -hz + 2, hx - 2, -2, 3);
    giantHanger(v, 0, s === 0 || s === 2 ? top - 3 : top, -hz + 7, hangerK, garment, kind, gAccent);
    // glass atrium cube
    curtainWall(c, -hx + 3, 1, -2, -hx + 15, 11, 9, "glass", s === 3 ? "#d4a373" : s === 0 ? "gold" : "steelLight", 3, 5);
    v.box(-hx + 3, 11, -2, -hx + 15, 12, 9, s === 3 ? "#d4a373" : "white");
    for (let x = -hx + 5; x < -hx + 14; x += 3) mannequin(v, x, 1, 8, c.pick(dress));
    // runway
    v.box(-hx + 17, 0, -1, -hx + 21, 2, hz - 1, s === 0 ? "black" : "white");
    v.box(-hx + 17, 2, -1, -hx + 21, 2, hz - 1, "white");
    for (let z = 0; z < hz - 2; z += 4) mannequin(v, -hx + 19, 2, z, c.pick(dress));
    for (let z = 0; z < hz - 2; z += 3) { folk(c, -hx + 16, z); folk(c, -hx + 22, z); }
    for (let z = 2; z < hz - 2; z += 5) c.blink(-hx + 23, 3, z, "white");
    v.box(-hx + 17, 2, -1, -hx + 21, 8, 0, trim, 0.5);
    crowd(c, hx - 8, 2, hx - 2, hz - 1, 4);
    return;
  }
  // L5 FASHION TOWER: 6 storeys of display glass, billboard of a model, spinning giant hanger crown
  const x0 = -hx + 4;
  const x1 = hx - 4;
  const z0 = -hz + 4;
  const z1 = hz - 6;
  const top = store(x0, z0, x1, z1, 7);
  // big fashion billboard down the +x face
  v.box(x1, 8, z0 + 2, x1 + 1, top - 2, z1 - 2, trim, 0.4);
  v.box(x1, 10, z0 + 4, x1 + 1, top - 4, z1 - 4, s === 0 ? "white" : s === 1 ? "#222" : s === 2 ? "#fde2e4" : "#eee", 0.6);
  const mz = Math.floor((z0 + z1) / 2);
  v.box(x1 + 1, 12, mz - 1, x1 + 2, 20, mz + 2, c.pick(dress), 0.6);
  v.box(x1 + 1, 20, mz, x1 + 2, 22, mz + 1, "#f1d2b6", 0.6);
  v.box(x1 + 1, 10, mz - 1, x1 + 2, 12, mz, "black");
  v.box(x1 + 1, 10, mz + 1, x1 + 2, 12, mz + 2, "black");
  // rotating hanger + garment on a plinth
  const rot = new PixelVox(9);
  giantHanger(rot, 0, 0, 0, 1.6, garment, kind, gAccent);
  const ry = s === 0 ? top - 2 : top + 1;
  v.box(-2, ry - 1, mz - 2, 3, ry, mz + 3, trim);
  c.addRotor({ vox: rot, pivot: [0, ry, mz], axis: "y", speed: 0.5 });
  c.blink(x0, ry, z0, "white");
  // red carpet + paparazzi + limo
  v.box(-hx, 0, z1, hx, 1, hz, s === 3 ? "white" : "path2");
  v.box(-2, 1, z1, 2, 1, hz - 1, "crimson");
  v.box(-2, 0, z1, 2, 1, hz, "crimson");
  for (let z = z1 + 1; z < hz - 1; z += 2) { folk(c, -4, z); folk(c, 3, z); }
  c.blink(-5, 3, z1 + 2, "white");
  c.blink(4, 3, z1 + 3, "white");
  v.box(hx - 12, 1, hz - 3, hx - 2, 2, hz - 1, "black");
  v.box(hx - 10, 2, hz - 3, hx - 4, 3, hz - 1, "glassDark");
}

// =============================================================================================
// THRIFT STORES
// =============================================================================================

/**
 * THRIFT STORES — garage sale → thrift shop → vintage emporium → flea-market warehouse → mega flea bazaar.
 * Signature: overflowing sidewalk clutter + a GIANT VINTAGE OBJECT on the roof.
 *  V0 Retro '70s (orange/brown/mustard, giant vinyl record)   V1 Converted Red Barn (giant teapot)
 *  V2 Victorian Antiques (bottle green & gold, gramophone)    V3 Shipping-Container Upcycle (stacked boxes, recycle sign)
 */
function buildThrift(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["#e07a2f", "#b23a2a", "#2f5d46", "teal"][s];
  const wall2 = ["#8a5a2b", "white", "gold", "orange"][s];
  lot(c, ["path", "grass2", "path2", "concrete2"][s]);
  speckle(c, ["path2", "grass3", "path", "concrete"][s], 0.15);
  const junkCols = ["orange", "teal", "yellow", "crimson", "purple", "woodLight", "sky", "pink", "olive", "brass"];

  /** a pile of random junk on top of a surface */
  const junk = (x0: number, z0: number, x1: number, z1: number, y = 1, hmax = 2) => {
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      if (c.rand() < 0.55) {
        const h = c.ri(1, hmax);
        v.box(x, y, z, x + 1, y + h, z + 1, c.pick(junkCols));
      }
    }
  };
  const table = (x: number, z: number, w = 4) => {
    v.box(x, 2, z, x + w, 3, z + 2, "woodLight");
    v.put(x, 1, z, "woodDark"); v.put(x + w - 1, 1, z + 1, "woodDark");
    junk(x, z, x + w, z + 2, 3, 1);
  };
  const rack = (x: number, z: number, w = 5) => {
    v.box(x, 1, z, x + 1, 5, z + 1, "chrome");
    v.box(x + w - 1, 1, z, x + w, 5, z + 1, "chrome");
    v.box(x, 5, z, x + w, 6, z + 1, "chrome");
    for (let i = 1; i < w - 1; i++) v.box(x + i, 2, z, x + i + 1, 5, z + 1, c.pick(junkCols));
  };
  /** Giant vintage object sign */
  const icon = (cx: number, y: number, cz: number, k = 1): number => {
    if (s === 0) {
      // vinyl record standing upright facing +z, with red label
      const R = 5 * k;
      v.ringZ(cx, y + R, cz, cz + 1, R, 0, "black");
      for (let r = 1.5; r < R; r += 1.5) v.ringZ(cx, y + R, cz + 1, cz + 2, r + 0.3, r, "charcoal");
      v.ringZ(cx, y + R, cz + 1, cz + 2, 1.6 * k, 0, "red", 0.6);
      v.put(cx, y + R, cz + 2, "white");
      v.box(cx - 1, y, cz - 1, cx + 1, y + 2, cz + 1, "steelDark");
      return y + Math.round(2 * R);
    }
    if (s === 1) {
      // teapot
      v.sphere(cx + 0.5, y + 3 * k, cz + 0.5, 3.4 * k, 3 * k, 3.4 * k, "#ffffff");
      v.box(cx - 3 * k, y + 2.5 * k, cz, cx - 2 * k + 1, y + 3.5 * k, cz + 1, "#2b6cb0");
      for (let i = 0; i < 4 * k; i++) v.put(cx + 3 * k + i, y + 2 * k + i * 0.8, cz, "white");
      v.box(cx - 4 * k, y + 2 * k, cz, cx - 3 * k, y + 5 * k, cz + 1, "white");
      v.box(cx, y + 6 * k, cz, cx + 1, y + 7 * k, cz + 1, "#2b6cb0");
      v.ringZ(cx, y + 3 * k, cz + Math.round(3 * k), cz + Math.round(3 * k) + 1, 1.5, 0.6, "#2b6cb0");
      return y + 7 * k;
    }
    if (s === 2) {
      // gramophone: box + crank + flaring horn pointing +z/up
      v.box(cx - 2, y, cz - 2, cx + 3, y + 3, cz + 3, "woodDark");
      v.box(cx - 2, y + 3, cz - 2, cx + 3, y + 4, cz + 3, "black");
      v.box(cx, y + 4, cz, cx + 1, y + 7, cz + 1, "brass");
      for (let i = 0; i < 6 * k; i++) {
        const r = 0.6 + i * 0.55;
        v.ringZ(cx + 0.5, y + 7 + i * 0.7, cz + i, cz + i + 1, r, r - 0.9, "gold", 0.2);
      }
      return y + 7 + Math.round(6 * k * 0.7) + 4;
    }
    // recycle sign: three green chevrons in a triangle on a pole
    v.box(cx, y, cz, cx + 1, y + 3, cz + 1, "steelDark");
    const R = 4 * k;
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2 + Math.PI / 2;
      for (let t = -0.8; t <= 0.8; t += 0.12) {
        v.put(cx + Math.cos(ang + t) * R, y + 3 + R + Math.sin(ang + t) * R, cz, "lime", 0.9);
      }
      v.put(cx + Math.cos(ang + 0.9) * R, y + 3 + R + Math.sin(ang + 0.9) * R, cz, "lime", 0.9);
    }
    return y + 3 + Math.round(2 * R);
  };
  /** shop body by style; returns roof top */
  const shopHouse = (x0: number, z0: number, x1: number, z1: number, floors: number): number => {
    const fh = 5;
    const top = 1 + floors * fh;
    if (s === 3) {
      // stacked shipping containers
      const cols = ["teal", "orange", "red", "yellow", "blue"];
      let k = 0;
      for (let f = 0; f < floors; f++) {
        const y = 1 + f * 4;
        for (let x = x0; x + 6 <= x1; x += 7) {
          const off = f % 2 ? 2 : 0;
          const ax = Math.min(x + off, x1 - 6);
          v.box(ax, y, z0, ax + 6, y + 4, z1, cols[k++ % cols.length]);
          for (let zz = z0; zz < z1; zz += 2) v.box(ax, y, zz, ax + 6, y + 4, zz + 1, "steelDark");
          v.box(ax + 1, y + 1, z1 - 1, ax + 5, y + 3, z1, "glass", 0.55);
        }
      }
      return 1 + floors * 4;
    }
    if (s === 1) {
      // red barn with white trim and gambrel roof
      shell(v, x0, 1, z0, x1, top, z1, "#b23a2a");
      v.box(Math.floor((x0 + x1) / 2) - 3, 1, z1 - 1, Math.floor((x0 + x1) / 2) + 3, 6, z1, "white");
      v.box(Math.floor((x0 + x1) / 2) - 2, 2, z1 - 1, Math.floor((x0 + x1) / 2) + 2, 5, z1, "warmGlow", 0.5);
      for (const [px] of [[x0], [x1 - 1]]) v.box(px, 1, z1 - 1, px + 1, top, z1, "white");
      // gambrel
      const w = z1 - z0;
      v.box(x0 - 1, top, z0 - 1, x1 + 1, top + 2, z1 + 1, "#7a2a20");
      v.box(x0 - 1, top + 2, z0 + 1, x1 + 1, top + 3, z1 - 1, "#7a2a20");
      v.box(x0 - 1, top + 3, z0 + 3, x1 + 1, top + 4, z1 - 3, "#7a2a20");
      if (w > 10) v.box(x0 - 1, top + 4, z0 + 5, x1 + 1, top + 5, z1 - 5, "#7a2a20");
      v.box(x0, top, z1 - 1, x1, top + 2, z1, "#b23a2a");
      return top + 3;
    }
    if (s === 2) {
      shell(v, x0, 1, z0, x1, top, z1, "#2f5d46");
      shopfront(v, x0 + 1, x1 - 1, 1, z1 - 1, 5, "gold", "glass", "woodDark", 0.55);
      displayDots(c, x0 + 2, x1 - 2, 2, 5, z1 - 1, ["brass", "gold", "crimson", "woodDark"], 0.3);
      if (floors > 1) windows(c, x0, fh, z0, x1, top, z1, { stepV: fh, h: 3, w: 1, stepH: 3, emit: 0.5, sill: "gold" });
      v.box(x0, 6, z1 - 1, x1, 7, z1 + 1, "gold");
      return gable(v, x0 - 1, top, z0 - 1, x1 + 1, z1 + 1, "z", "charcoal", "gold");
    }
    // retro 70s: brown wood siding + orange/mustard stripes + rounded sign
    shell(v, x0, 1, z0, x1, top, z1, "#8a5a2b");
    for (let y = top - 3; y < top; y++) v.box(x0, y, z0, x1, y + 1, z1, ["#e07a2f", "#f2c14e", "#c0392b"][y % 3]);
    shopfront(v, x0 + 1, x1 - 1, 1, z1 - 1, 5, "#f2c14e", "glass", "woodDark", 0.55);
    displayDots(c, x0 + 2, x1 - 2, 2, 5, z1 - 1, junkCols, 0.3);
    if (floors > 1) windows(c, x0, fh, z0, x1, top - 3, z1, { stepV: fh, h: 2, w: 3, stepH: 5, emit: 0.5 });
    flatRoof(c, x0, top, z0, x1, z1, "concreteDark", "#8a5a2b", false);
    return top + 1;
  };

  if (lv === 1) {
    // GARAGE SALE: house garage open, tables of junk on the driveway, hand-painted sign
    const z1 = -1;
    shell(v, -hx + 2, 1, -hz + 2, hx - 2, 7, z1, s === 3 ? "teal" : s === 1 ? "#b23a2a" : s === 2 ? "#2f5d46" : "#e8c9a0");
    v.box(-hx + 4, 1, z1 - 1, hx - 4, 5, z1, "charcoal");
    junk(-hx + 4, z1 - 4, hx - 4, z1 - 1, 1, 3);
    gable(v, -hx + 1, 7, -hz + 1, hx - 1, z1 + 1, "x", s === 1 ? "#7a2a20" : "slate", "white");
    v.box(-hx + 2, 0, z1, hx - 2, 1, hz, "concrete");
    table(-hx + 2, 1, 5);
    table(1, 3, 5);
    rack(-hx + 3, hz - 4, 5);
    v.box(hx - 3, 1, hz - 2, hx - 2, 4, hz - 1, "woodDark");
    v.box(hx - 6, 4, hz - 2, hx - 1, 6, hz - 1, "yellow", 0.4);
    v.box(hx - 5, 5, hz - 1, hx - 2, 5, hz - 1, "red");
    folk(c, 0, hz - 3); folk(c, -3, 4);
    return;
  }
  if (lv === 2) {
    const top = shopHouse(-hx + 2, -hz + 2, hx - 2, hz - 6, s === 3 ? 2 : 1);
    icon(0, top, -2, 0.7);
    v.box(-hx, 0, hz - 6, hx, 1, hz, "path2");
    rack(-hx + 2, hz - 3, 5);
    table(2, hz - 4, 4);
    v.box(hx - 4, 1, hz - 2, hx - 2, 2, hz - 1, "crate");
    folk(c, -1, hz - 2);
    return;
  }
  if (lv === 3) {
    // VINTAGE EMPORIUM + old camper van + sofa on the sidewalk
    const z1 = hz - 6;
    const top = shopHouse(-hx + 2, -hz + 2, hx - 6, z1, 2);
    icon(Math.floor((-hx + 2 + hx - 6) / 2), top, -2, 0.9);
    v.box(-hx, 0, z1, hx, 1, hz, "path2");
    // VW-style camper van
    const vx = hx - 6;
    const vz = hz - 3;
    v.box(vx - 4, 1, vz - 1, vx + 4, 4, vz + 2, s === 0 ? "#f2c14e" : "#7fc8a9");
    v.box(vx - 4, 4, vz - 1, vx + 4, 5, vz + 2, "white");
    v.box(vx + 3, 2, vz - 1, vx + 4, 4, vz + 2, "glassDark");
    v.box(vx - 3, 3, vz + 1, vx + 2, 4, vz + 2, "glass", 0.3);
    v.box(vx - 4, 2, vz - 1, vx + 4, 3, vz + 2, "white");
    v.put(vx - 3, 0, vz + 1, "rubber"); v.put(vx + 2, 0, vz + 1, "rubber");
    junk(vx - 4, vz - 1, vx + 2, vz + 2, 5, 2);
    // sofa
    v.box(-hx + 2, 1, z1 + 1, -hx + 7, 2, z1 + 3, "olive");
    v.box(-hx + 2, 2, z1 + 1, -hx + 7, 3, z1 + 2, "olive");
    rack(-hx + 9, z1 + 2, 6);
    crowd(c, -hx + 2, z1 + 3, hx - 10, hz - 1, 4);
    return;
  }
  if (lv === 4) {
    // FLEA-MARKET WAREHOUSE: quonset hall + outdoor tents
    const z1 = 2;
    const x1 = hx - 2;
    shell(v, -hx + 2, 1, -hz + 2, x1, 6, z1, wall);
    barrelRoof(v, -hx + 2, 6, -hz + 2, x1, z1, "x", s === 3 ? "steelLight" : s === 1 ? "#7a2a20" : "steelLight", "steelDark");
    v.box(-4, 1, z1 - 1, 4, 6, z1, "charcoal");
    junk(-4, z1 - 3, 4, z1 - 1, 1, 3);
    v.box(-6, 6, z1, 6, 9, z1 + 1, wall2, 0.6);
    icon(hx - 9, 6 + Math.floor((z1 + hz - 2) / 6), -hz + 9, 1);
    // tents
    const tentCols = ["red", "blue", "yellow", "teal", "pink", "orange"];
    for (let x = -hx + 2; x < hx - 6; x += 8) {
      const col = c.pick(tentCols);
      v.box(x, 1, 6, x + 1, 5, 7, "steelLight");
      v.box(x + 5, 1, 6, x + 6, 5, 7, "steelLight");
      for (let k = 0; k < 3; k++) v.box(x - 1 + k, 5 + k, 4, x + 7 - k, 6 + k, 11, col);
      table(x + 1, 7, 4);
    }
    v.box(-hx, 0, z1, hx, 1, hz, "path");
    crowd(c, -hx + 2, z1 + 1, hx - 2, hz - 1, 9);
    truck(v, hx - 5, 1, hz - 3, "x", wall2 === "white" ? "cream" : wall2, "teal");
    return;
  }
  // L5 MEGA FLEA BAZAAR: big shop building + rows of tents + junk tower sculpture + double-decker bus shop
  const z1 = -2;
  const top = shopHouse(-hx + 2, -hz + 2, hx - 14, z1, 3);
  icon(Math.floor((-hx + hx - 12) / 2), top, -hz + 8, 1.3);
  v.box(-hx, 0, z1, hx, 1, hz, "path");
  const tentCols = ["red", "blue", "yellow", "teal", "pink", "orange", "lime"];
  for (let x = -hx + 2; x < hx - 2; x += 7) for (let z = z1 + 3; z < hz - 4; z += 8) {
    const col = c.pick(tentCols);
    for (let k = 0; k < 3; k++) v.box(x - 1 + k, 5 + k, z - 1, x + 6 - k, 6 + k, z + 5, k === 2 ? "white" : col);
    v.box(x, 1, z, x + 1, 5, z + 1, "steelLight");
    v.box(x + 4, 1, z + 3, x + 5, 5, z + 4, "steelLight");
    junk(x, z + 1, x + 5, z + 3, 1, 2);
  }
  // junk tower sculpture (stacked chairs, tv, bikes) at the back right
  const jx = hx - 8;
  const jz = -hz + 6;
  let y = 1;
  for (let i = 0; i < 8; i++) {
    const w = 4 - (i % 3);
    v.box(jx - w + (i % 2), y, jz - w, jx + w - (i % 2), y + 3, jz + w - 1, c.pick(junkCols));
    y += 3;
  }
  v.box(jx - 1, y, jz - 1, jx + 1, y + 2, jz + 1, "brass", 0.6);
  c.blink(jx, y + 2, jz, "yellow");
  // double-decker bus boutique
  const bx = hx - 6;
  v.box(bx - 2, 1, -hz + 13, bx + 2, 8, -hz + 26 > z1 ? z1 + 0 : -hz + 26, "red");
  windows(c, bx - 2, 1, -hz + 13, bx + 2, 8, z1, { faces: "e", stepV: 3, stepH: 2, emit: 0.5 });
  crowd(c, -hx + 2, z1 + 1, hx - 2, hz - 1, 12);
}

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
    levels: ["Pop-Up Boutique", "Two-Floor Boutique", "Fashion House", "Flagship & Runway", "Fashion Tower"],
    growth: "Mannequin windows stack up floor by floor, a glass flagship adds a catwalk with flashing cameras, and the tower is crowned by a giant spinning hanger.",
    build: buildClothing,
  },
  thrift_stores: {
    footprints: [[1, 1], [1, 1], [2, 1], [2, 2], [3, 2]],
    levels: ["Garage Sale", "Thrift Shop", "Vintage Emporium", "Flea-Market Warehouse", "Mega Flea Bazaar"],
    growth: "Junk spills out ever wider: garage sale → shop with racks → emporium with a camper van → warehouse with tents → a sprawling bazaar with a junk-tower sculpture.",
    build: buildThrift,
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
// GAS STATIONS
// =============================================================================================

/**
 * GAS STATIONS — roadside pump → canopy station → service station & garage → truck stop & car wash → solar EV superhub.
 *  V0 Route-66 Retro (red & white, globe pumps, googie sign)   V1 Modern Corporate (green & yellow, LED fascia)
 *  V2 Art-Deco Streamline (cream & teal, rounded canopy)        V3 Space-Age (white & magenta flying-saucer canopy)
 */
function buildGas(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const main = ["red", "#1e8a3c", "#2ec4b6", "magenta"][s];
  const second = ["white", "yellow", "cream", "white"][s];
  lot(c, "asphalt");
  speckle(c, "asphaltDark", 0.08);

  const pump = (x: number, z: number, elec = false) => {
    v.box(x, 1, z, x + 3, 2, z + 2, "concrete"); // island
    v.box(x + 1, 2, z, x + 2, 5, z + 2, elec ? "white" : main);
    v.box(x + 1, 4, z + 1, x + 2, 5, z + 2, elec ? "screenCyan" : "screenGreen", 0.9);
    if (s === 0 && !elec) v.put(x + 1, 5, z, "white", 0.9), v.put(x + 1, 6, z, "white", 0.9); // globe
    v.put(x + 2, 3, z + 1, "black");
    if (elec) v.box(x + 1, 2, z + 2, x + 2, 3, z + 3, "cyan", 1.0);
  };
  const canopy = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    if (s === 3) {
      // saucer canopy on one central stem
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const r = Math.min(x1 - x0, z1 - z0) / 2 + 1;
      v.cylinderY(cx, cz, 1, y, 1.2, "white");
      v.cylinderY(cx, cz, y, y + 1, r, "white");
      v.cylinderY(cx, cz, y + 1, y + 2, r - 1, main, 0.6);
      v.cylinderY(cx, cz, y + 2, y + 3, r - 3, "white");
      v.cylinderY(cx, cz, y - 1, y, r - 1, "warmGlow", 0.8);
      return;
    }
    for (const px of [x0 + 1, x1 - 2]) for (const pz of [z0 + 1, z1 - 2]) v.box(px, 1, pz, px + 1, y, pz + 1, s === 2 ? "cream" : "silver");
    v.box(x0, y, z0, x1, y + 2, z1, second);
    v.box(x0, y + 1, z0, x1, y + 2, z1, main, s === 1 ? 0.7 : 0.3);
    if (s === 2) {
      // rounded streamline ends + speed stripes
      v.clear(x0, y, z0, x0 + 1, y + 2, z0 + 1); v.clear(x1 - 1, y, z0, x1, y + 2, z0 + 1);
      v.clear(x0, y, z1 - 1, x0 + 1, y + 2, z1); v.clear(x1 - 1, y, z1 - 1, x1, y + 2, z1);
      for (let k = 0; k < 3; k++) v.box(x0 + 2 + k * 3, y, z1, x0 + 4 + k * 3, y + 1, z1 + 1, "teal");
    }
    for (let x = x0 + 2; x < x1 - 2; x += 3) for (let z = z0 + 2; z < z1 - 2; z += 3) v.put(x, y - 1, z, "white", 1.0);
  };
  const priceSign = (x: number, z: number, h: number) => {
    v.box(x, 1, z, x + 1, h, z + 1, "steelDark");
    v.box(x - 2, h, z, x + 3, h + 3, z + 1, main, 0.6);
    v.box(x - 2, h + 3, z, x + 3, h + 6, z + 1, "black");
    for (let r = 0; r < 3; r++) v.box(x - 1, h + 3 + r, z, x + 2, h + 4 + r, z + 1, r === 2 ? "lime" : "orange", 1.2);
    if (s === 0) {
      // googie starburst on top
      v.box(x, h + 6, z, x + 1, h + 10, z + 1, "steelDark");
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, 2], [-1, 1], [1, 1], [-1, -1], [1, -1]]) v.put(x + dx, h + 10 + dy, z, "yellow", 1.2);
    }
  };
  const mart = (x0: number, z0: number, x1: number, z1: number, h = 6) => {
    shell(v, x0, 1, z0, x1, h, z1, s === 1 ? "white" : s === 2 ? "cream" : s === 3 ? "white" : "white");
    v.box(x0 + 1, 1, z1 - 1, x1 - 1, 4, z1, "glass", 0.6);
    v.box(Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, Math.floor((x0 + x1) / 2) + 1, 4, z1, "glassDark");
    v.box(x0, h - 2, z1 - 1, x1, h, z1 + 1, main, 0.5);
    flatRoof(c, x0, h, z0, x1, z1, "concreteDark", second, false);
    v.box(x0 + 1, 1, z1, x0 + 3, 3, z1 + 1, "#00a3e0"); // ice chest
    acUnit(v, x0 + 1, h + 1, z0 + 1);
  };
  const carWash = (x0: number, z0: number, x1: number, z1: number) => {
    // tunnel along z with spinning brush rotors
    shell(v, x0, 1, z0, x1, 8, z1, s === 0 ? "red" : "white");
    v.clear(x0 + 1, 1, z0, x1 - 1, 7, z1);
    v.box(x0, 8, z0, x1, 9, z1, main, 0.4);
    for (let z = z0 + 1; z < z1; z += 3) v.put(x0 + 1, 6, z, "cyan", 0.6);
    for (const bz of [z0 + 3, z1 - 4]) {
      const rot = new PixelVox(11);
      for (let yy = -2; yy <= 2; yy++) for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        rot.put(Math.round(Math.cos(ang) * 1.5), yy, Math.round(Math.sin(ang) * 1.5), a % 2 ? "blue" : "cyan");
      }
      c.addRotor({ vox: rot, pivot: [x0 + 2, 4, bz], axis: "y", speed: 4 });
    }
    car(v, Math.floor((x0 + x1) / 2), 1, Math.floor((z0 + z1) / 2), "z", c.pick([...CAR_COLORS]));
    c.smoke(Math.floor((x0 + x1) / 2), 9, z1 - 2, "steam");
  };

  if (lv === 1) {
    v.box(-hx + 1, 0, -hz + 1, hx - 1, 1, hz - 1, "concrete2");
    pump(-2, -1);
    // tiny attendant booth
    v.box(-hx + 2, 1, -hz + 2, -hx + 7, 6, -hz + 7, second);
    v.box(-hx + 3, 2, -hz + 6, -hx + 6, 4, -hz + 7, "glass", 0.6);
    v.box(-hx + 1, 6, -hz + 1, -hx + 8, 7, -hz + 8, main);
    priceSign(hx - 3, -hz + 3, 6);
    car(v, 2, 1, 3, "x", c.pick(["sky", "yellow", "teal"]));
    folk(c, -1, 3);
    // oil drums
    v.box(hx - 4, 1, hz - 3, hx - 2, 3, hz - 1, s === 1 ? "yellow" : "red");
    return;
  }
  if (lv === 2) {
    canopy(-hx + 2, -2, 6, hz - 1, 8);
    pump(-hx + 5, 3);
    pump(-1, 3);
    mart(-hx + 2, -hz + 1, hx - 10, -3);
    priceSign(hx - 4, hz - 3, 9);
    car(v, -hx + 6, 1, 7, "x", c.pick([...CAR_COLORS]));
    folk(c, 0, 6);
    v.box(hx - 6, 1, -hz + 2, hx - 2, 2, -hz + 4, "steelLight"); // air pump base
    return;
  }
  if (lv === 3) {
    // service station: canopy w/ 4 pumps + mart + 2-bay garage on the right
    canopy(-hx + 2, -1, 4, hz - 1, 8);
    for (const px of [-hx + 4, -4]) for (const pz of [2, 8]) pump(px, pz);
    mart(-hx + 2, -hz + 1, -2, -3);
    // garage bays
    shell(v, 4, 1, -hz + 1, hx - 1, 8, 2, s === 0 ? "white" : second === "yellow" ? "white" : second);
    for (const bx of [6, 11]) {
      v.box(bx, 1, 1, bx + 4, 6, 2, "steelLight");
      for (let y = 2; y < 6; y += 2) v.box(bx, y, 1, bx + 4, y + 1, 2, "steelDark");
    }
    v.box(4, 6, 2, hx - 1, 8, 3, main, 0.5);
    flatRoof(c, 4, 8, -hz + 1, hx - 1, 2, "concreteDark", main, false);
    for (let i = 0; i < 4; i++) v.box(hx - 3, 1 + i, 4 + i % 2, hx - 2, 2 + i, 5 + i % 2, "rubber"); // tire stack
    car(v, 8, 1, 6, "z", "orange");
    priceSign(hx - 3, hz - 2, 10);
    crowd(c, -hx + 2, 0, 4, hz - 1, 3);
    return;
  }
  if (lv === 4) {
    // TRUCK STOP: big car canopy + tall diesel canopy w/ semi + diner + car wash tunnel
    canopy(-hx + 2, -2, 6, hz - 1, 8);
    for (const px of [-hx + 4, -hx + 11, -1]) for (const pz of [1, 8]) pump(px, pz);
    // diesel lane
    const dx0 = 10;
    for (const pz of [-2, hz - 2]) for (const px of [dx0, hx - 2]) v.box(px, 1, pz, px + 1, 12, pz + 1, "silver");
    v.box(dx0, 12, -2, hx - 1, 14, hz - 1, main, 0.4);
    v.box(dx0, 13, -2, hx - 1, 14, hz - 1, second);
    pump(dx0 + 2, 4);
    // semi truck: cab + long trailer
    v.box(hx - 8, 1, -1, hx - 4, 6, 3, main);
    v.box(hx - 8, 3, 2, hx - 4, 5, 3, "glassDark");
    v.box(hx - 8, 1, 3, hx - 4, 7, hz - 2, "white");
    v.box(hx - 8, 5, 4, hx - 4, 6, hz - 3, main);
    // diner & mart
    mart(-hx + 2, -hz + 1, 0, -4, 7);
    v.box(-hx + 2, 7, -hz + 1, -hx + 8, 10, -4, s === 0 ? "silver" : second);
    sign(v, -hx + 3, -hx + 9, 10, 12, -5, "yellow", 1, main);
    carWash(2, -hz + 1, 10, -3);
    priceSign(dx0 - 2, hz - 2, 14);
    crowd(c, -hx + 2, -3, 0, -1, 4);
    return;
  }
  // Three generations of solar architecture surround the charging court; the space-age lot keeps its saucer.
  const panel = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    const center = (x1 + x0 - 1) / 2;
    const radius = (x1 - x0) / 2;
    const roofAt = (x: number) => {
      const across = Math.abs(x - center) / radius;
      if (s === 0) return y + Math.round(across * 6); // upswept Googie wings
      if (s === 1) return y + (Math.floor((x - x0) / 2) % 3); // photovoltaic sawteeth
      return y + Math.round(3 * Math.sqrt(Math.max(0, 1 - across * across)));
    };
    for (const px of [x0 + 2, x1 - 3]) for (const pz of [z0 + 1, z1 - 2]) v.box(px, 1, pz, px + 1, roofAt(px), pz + 1, s === 0 ? "red" : "white");
    for (let x = x0; x < x1; x++) {
      const wy = roofAt(x);
      v.box(x, wy, z0, x + 1, wy + 1, z1, "solarBlue", 0.15);
      v.box(x, wy - 1, z0, x + 1, wy, z0 + 1, main, 0.5);
      v.box(x, wy - 1, z1 - 1, x + 1, wy, z1, main, 0.5);
      for (let z = z0 + 2; z < z1; z += s === 2 ? 4 : 6) v.put(x, wy, z, s === 2 ? "brass" : "steelLight");
      if (s === 1 && (x - x0) % 6 === 5) v.box(x, wy - 2, z0 + 1, x + 1, wy, z1 - 1, "glass", 0.4);
    }
  };
  if (s === 3) {
    canopy(-hx + 2, -hz + 2, hx - 18, hz - 2, 10);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      v.box(Math.round((-hx + hx - 16) / 2 + Math.cos(ang) * 8), 1, Math.round(Math.sin(ang) * 8), Math.round((-hx + hx - 16) / 2 + Math.cos(ang) * 8) + 1, 4, Math.round(Math.sin(ang) * 8) + 1, "cyan", 1.0);
    }
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2 + 0.4;
      car(v, Math.round((-hx + hx - 16) / 2 + Math.cos(ang) * 6), 1, Math.round(Math.sin(ang) * 6), "z", c.pick(["white", "silver", "magenta", "cyan"]));
    }
  } else {
    panel(-hx + 2, -hz + 2, hx - 16, -1, 9);
    panel(-hx + 2, 2, hx - 16, hz - 1, 9);
    for (let x = -hx + 4; x < hx - 18; x += 5) {
      pump(x, -hz + 3, true);
      pump(x, hz - 4, true);
      car(v, x + 2, 1, -4, "z", c.pick(["white", "silver", "sky", "red", "charcoal"]));
      car(v, x + 2, 1, 6, "z", c.pick(["white", "silver", "sky", "teal", "charcoal"]));
    }
  }
  // lounge pod with green roof + café
  const lx0 = hx - 14;
  shell(v, lx0, 1, -hz + 2, hx - 2, 7, 4, "white");
  v.box(lx0, 1, 3, hx - 2, 6, 4, "glass", 0.6);
  v.box(lx0, 1, -hz + 2, lx0 + 1, 6, 4, "glass", 0.5);
  v.box(lx0 - 1, 7, -hz + 1, hx - 1, 8, 5, "grass2");
  for (let x = lx0; x < hx - 2; x += 3) bush(v, x, 8, -hz + 4, 1, "leaf", "pink");
  cafeTable(v, lx0 + 3, 8, main);
  cafeTable(v, lx0 + 9, 8, main);
  // small wind turbine
  const tx = hx - 3;
  const tz = hz - 3;
  v.box(tx, 1, tz, tx + 1, 22, tz + 1, "white");
  const rot = new PixelVox(12);
  for (let i = 1; i <= 7; i++) {
    rot.put(0, i, 0, "white");
    rot.put(Math.round(Math.cos(Math.PI / 6) * i), -Math.round(Math.sin(Math.PI / 6) * i), 0, "white");
    rot.put(-Math.round(Math.cos(Math.PI / 6) * i), -Math.round(Math.sin(Math.PI / 6) * i), 0, "white");
  }
  rot.put(0, 0, 0, main);
  c.addRotor({ vox: rot, pivot: [tx, 22, tz + 1], axis: "z", speed: 1.4, wind: true });
  // drone delivery pad
  v.box(lx0 + 2, 8, -hz + 6, lx0 + 7, 9, -hz + 11, "charcoal");
  v.box(lx0 + 4, 9, -hz + 8, lx0 + 5, 9, -hz + 9, "white");
  c.blink(lx0 + 4, 9, -hz + 8, "cyan");
  priceSign(hx - 8, hz - 2, 12);
  crowd(c, lx0, 5, hx - 4, hz - 4, 4);
}

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
// BANKS
// =============================================================================================

/** Round vault door on the +z plane */
function vaultDoor(v: V, cx: number, cy: number, z: number, r: number): void {
  v.ringZ(cx, cy, z, z + 1, r, 0, "steelLight");
  v.ringZ(cx, cy, z + 1, z + 2, r, r - 0.9, "steel");
  v.ringZ(cx, cy, z + 1, z + 2, 1.5, 0, "steelDark");
  for (let a = 0; a < 6; a++) v.put(cx + Math.round(Math.cos(a) * (r - 1.6)) - 0.5, cy + Math.round(Math.sin(a) * (r - 1.6)) - 0.5, z + 1, "gold");
}

/** Gold charging-bull statue (toy) facing +x */
function bull(v: V, x: number, y: number, z: number, col = "gold"): void {
  v.box(x - 2, y + 2, z - 1, x + 3, y + 4, z + 1, col, 0.3);
  v.box(x + 3, y + 2, z - 1, x + 5, y + 4, z + 1, col, 0.3);
  v.put(x + 5, y + 4, z - 1, col); v.put(x + 5, y + 4, z, col);
  v.put(x + 6, y + 5, z - 2, col); v.put(x + 6, y + 5, z + 1, col);
  for (const lx of [x - 2, x + 2]) for (const lz of [z - 1, z]) v.box(lx, y, lz, lx + 1, y + 2, lz + 1, col);
  v.put(x - 3, y + 4, z, col);
}

/**
 * BANKS — teller office → columned savings bank → domed vault bank → bank tower → financial HQ skyscraper
 * (gold crown, glowing stock ticker band, charging-bull plaza).
 *  V0 Greek Neoclassical (marble columns, pediment)   V1 Victorian Brick (red brick, clock tower, slate)
 *  V2 Modern Glass (blue glass, steel, logo cube)      V3 Art Deco (black granite & gold, sunburst)
 */
function buildBanks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const wall = ["marble", "brick", "#4f7fb0", "#202028"][s];
  const trim = ["marbleShade", "cream", "steelLight", "gold"][s];
  const roofCol = ["marbleShade", "slate", "steelDark", "black"][s];
  lot(c, s === 3 ? "#2a2a33" : "concrete2");
  speckle(c, s === 3 ? "black" : "concrete", 0.08);

  /** classical/variant facade block; returns roof top */
  const bankHall = (x0: number, z0: number, x1: number, z1: number, h: number, grand: boolean): number => {
    if (s === 2) {
      curtainWall(c, x0, 1, z0, x1, h, z1, "#5fa8e0", "steelLight", 3, 4);
      v.box(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 1, "white");
      // logo cube on a corner
      v.box(x1 - 4, h + 1, z1 - 4, x1 - 1, h + 4, z1 - 1, "gold", 0.4);
      door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "glassDark", 3, 4);
      return h + 1;
    }
    shell(v, x0, 1, z0, x1, h, z1, wall);
    // steps
    stairs(v, x0 + 1, x1 - 1, 0, z1, grand ? 3 : 2, trim);
    if (s === 0 || (s === 3)) {
      // column portico on the front
      const pz = z1 - 1;
      const step = s === 3 ? 3 : 2;
      colonnade(v, x0 + 1, x1 - 1, pz + (grand ? 1 : 0), grand ? 2 : 1, h, "x", step, s === 3 ? "black" : "marble", s === 3 ? "gold" : "marbleShade");
      v.box(x0, h - 1, z0, x1, h, z1 + (grand ? 2 : 1), trim);
      if (s === 0) {
        const top = pediment(v, x0, x1, h, z1 - 1, z1 + (grand ? 2 : 1), "marble", "marbleShade");
        v.box(x0, h, z0, x1, h + 1, z1 - 1, "marbleShade");
        return top;
      }
      // deco: stepped sunburst parapet
      for (let k = 0; k < 3; k++) v.box(x0 + 2 + k * 2, h + k, z1 - 1, x1 - 2 - k * 2, h + k + 1, z1, "gold", 0.4);
      flatRoof(c, x0, h, z0, x1, z1, "black", "gold", false);
      for (let x = x0 + 2; x < x1 - 2; x += 2) v.box(x, 3, z1 - 1, x + 1, h - 1, z1, "gold", 0.3);
      return h + 3;
    }
    // Victorian brick: arched windows, stone bands, mansard-ish slate roof
    windows(c, x0, 1, z0, x1, h, z1, { stepV: 5, h: 3, w: 2, stepH: 4, emit: 0.5, sill: "cream" });
    for (let y = 5; y < h; y += 5) v.box(x0, y, z0, x1, y + 1, z1, "cream");
    door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1, "woodDark", 3, 4);
    v.box(Math.floor((x0 + x1) / 2) - 2, 5, z1, Math.floor((x0 + x1) / 2) + 3, 6, z1 + 1, "cream");
    return mansard(v, x0, h, z0, x1, z1, "slate", "slateLight", "glass");
  };
  const sign$ = (x: number, y: number, z: number) => {
    const g = ["111", "100", "111", "001", "111"];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === "1") v.put(x + k, y + 4 - r, z, s === 2 ? "white" : "gold", 1.1);
    v.put(x + 1, y + 5, z, s === 2 ? "white" : "gold", 1.1);
    v.put(x + 1, y - 1, z, s === 2 ? "white" : "gold", 1.1);
  };

  if (lv === 1) {
    // TELLER OFFICE: small building, barred windows, safe through the window, $ sign
    const z1 = hz - 5;
    shell(v, -hx + 3, 1, -hz + 3, hx - 3, 9, z1, wall);
    v.box(-hx + 4, 3, z1 - 1, -hx + 8, 7, z1, "glass", 0.5);
    for (let x = -hx + 4; x < -hx + 8; x += 1) if (x % 2 === 0) v.box(x, 3, z1, x + 1, 7, z1 + 1, "iron");
    v.box(hx - 7, 2, z1 - 1, hx - 4, 5, z1, "steelDark");
    v.put(hx - 6, 3, z1, "gold");
    door(v, -1, 1, z1 - 1, "woodDark", 2, 4);
    v.box(-hx + 2, 9, -hz + 2, hx - 2, 10, z1 + 1, trim);
    if (s === 1) gable(v, -hx + 2, 10, -hz + 2, hx - 2, z1 + 1, "x", "slate", "cream");
    sign$(-1, 10, z1);
    v.box(-hx, 0, z1, hx, 1, hz, "path2");
    folk(c, 2, hz - 3);
    return;
  }
  if (lv === 2) {
    const z1 = hz - 5;
    const top = bankHall(-hx + 4, -hz + 2, hx - 4, z1, 11, false);
    sign$(-1, top - (s === 0 ? 3 : 0), z1 + (s === 0 ? 1 : 0));
    flag(v, -hx + 2, 1, hz - 3, 12, s === 1 ? ["blue", "white", "red"] : ["blue", "white", "blue"]);
    folk(c, 3, hz - 2);
    lamp(v, hx - 3, 1, hz - 2, 5);
    return;
  }
  // L3+: vault bank with dome (L3), tower (L4), HQ skyscraper (L5)
  const x0 = -hx + 3;
  const x1 = hx - 3;
  const z0 = -hz + 3;
  const z1 = hz - 7;
  const hallH = 13;
  const top = bankHall(x0, z0, x1, z1, hallH, true);
  const cz = Math.floor((z0 + z1) / 2) - 1;
  if (lv === 3) {
    // dome + vault door showing on the +x side + armored truck
    if (s === 2) {
      v.dome(-0.0, hallH + 1, cz, 6, "#bfe7ff", 0.3);
    } else {
      cyl(v, -0.0, cz, hallH, hallH + 3, 6, trim);
      v.dome(-0.0, hallH + 3, cz, 6, s === 1 ? "copper" : s === 3 ? "gold" : "#9fc9c0", 0.1);
      v.box(-1, hallH + 9, cz - 1, 1, hallH + 12, cz + 1, "gold", 0.5);
    }
    vaultDoor(v, x1 - 7, 6, z1, 4);
    // armored truck
    v.box(hx - 9, 1, hz - 4, hx - 2, 5, hz - 1, "#5a6b4a");
    v.box(hx - 3, 3, hz - 4, hx - 2, 4, hz - 1, "glassDark");
    v.put(hx - 6, 3, hz - 1, "gold");
    for (const sx of [-hx + 2, hx - 3]) lamp(v, sx, 1, hz - 2, 6);
    crowd(c, -hx + 3, z1 + 3, 2, hz - 1, 4);
    return;
  }
  // tower rising out of the hall
  const H = lv === 4 ? 44 : 70;
  const tx0 = x0 + 3;
  const tx1 = x1 - 3;
  const tz0 = z0;
  const tz1 = z1 - 6;
  let crownY = H;
  if (s === 0) {
    shell(v, tx0, top, tz0, tx1, H, tz1, "marble");
    windows(c, tx0, top, tz0, tx1, H, tz1, { stepV: 3, h: 2, w: 1, stepH: 2, emit: 0.5 });
    for (let x = tx0; x < tx1; x += 3) v.box(x, top, tz1 - 1, x + 1, H, tz1, "marbleShade");
    colonnade(v, tx0, tx1, tz1, H - 6, H, "x", 2, "marble", "gold");
    v.box(tx0 - 1, H, tz0 - 1, tx1 + 1, H + 1, tz1 + 1, "marbleShade");
    // temple-crown + gold dome
    v.dome(-0.0, H + 1, Math.floor((tz0 + tz1) / 2), 5, "gold", 0.3);
    crownY = H + 7;
  } else if (s === 1) {
    shell(v, tx0, top - 2, tz0, tx1, H, tz1, "brick");
    windows(c, tx0, top, tz0, tx1, H, tz1, { stepV: 4, h: 2, w: 1, stepH: 2, emit: 0.5, sill: "cream" });
    for (let y = top + 3; y < H; y += 8) v.box(tx0, y, tz0, tx1, y + 1, tz1, "cream");
    // clock tower top
    v.box(tx0 + 1, H, tz0 + 1, tx1 - 1, H + 8, tz1 - 1, "brick");
    const cx = Math.floor((tx0 + tx1) / 2);
    v.ringZ(cx, H + 4, tz1 - 1, tz1, 3, 0, "white", 0.4);
    v.box(cx, H + 4, tz1, cx + 1, H + 7, tz1 + 1, "black");
    v.box(cx, H + 4, tz1, cx + 3, H + 5, tz1 + 1, "black");
    crownY = gable(v, tx0, H + 8, tz0, tx1, tz1, "z", "slate", "cream") + 1;
    v.cone(cx, crownY - 1, crownY + 8, Math.floor((tz0 + tz1) / 2), 2, 0.3, "copper");
    crownY += 8;
  } else if (s === 2) {
    curtainWall(c, tx0, top, tz0, tx1, H, tz1, "#5fa8e0", "steelLight", 3, 3);
    // twisting fins: offset slabs
    for (let y = top + 4; y < H; y += 4) {
      const off = Math.round(Math.sin(y * 0.15) * 2);
      v.box(tx0 - 1 + off, y, tz0 - 1, tx1 + 1 + off, y + 1, tz1 + 1, "white");
    }
    v.box(tx0, H, tz0, tx1, H + 2, tz1, "white");
    helipad(v, Math.floor((tx0 + tx1) / 2), H + 2, Math.floor((tz0 + tz1) / 2), 4);
    crownY = H + 3;
  } else {
    // Art Deco black & gold: setbacks + sunburst crown
    let a = tx0, b = tx1, za = tz0, zb = tz1, y = top;
    const tiers = 3;
    const tierH = Math.floor((H - top) / tiers);
    for (let t = 0; t < tiers; t++) {
      const y1 = t === tiers - 1 ? H : y + tierH;
      shell(v, a, y, za, b, y1, zb, "#202028");
      for (let x = a + 1; x < b - 1; x += 2) v.box(x, y, zb - 1, x + 1, y1, zb, c.rand() < 0.5 ? "warmGlow" : "gold", 0.4);
      for (let z = za + 1; z < zb - 1; z += 2) v.box(b - 1, y, z, b, y1, z + 1, c.rand() < 0.5 ? "warmGlow" : "gold", 0.4);
      v.box(a, y1 - 1, za, b, y1, zb, "gold", 0.3);
      y = y1;
      a += 2; b -= 2; za += 2; zb -= 2;
    }
    for (let k = 0; k < 5 && a + k < b - k; k++) v.box(a + k, H + k * 2, za + k, b - k, H + k * 2 + 2, zb - k, k % 2 ? "gold" : "#202028", k % 2 ? 0.5 : 0);
    crownY = H + 10;
    v.box(Math.floor((a + b) / 2), crownY, Math.floor((za + zb) / 2), Math.floor((a + b) / 2) + 1, crownY + 8, Math.floor((za + zb) / 2) + 1, "gold", 0.5);
    crownY += 8;
  }
  if (lv === 5) {
    // stock ticker band around the hall + bull statue plaza + flags
    for (let x = x0; x < x1; x++) v.put(x, hallH - 3, z1 + (s === 0 || s === 3 ? 2 : 0), x % 3 === 0 ? "red" : "lime", 1.3);
    for (let z = z0; z < z1; z++) v.put(x1, hallH - 3, z, z % 3 === 0 ? "red" : "lime", 1.3);
    bull(v, -hx + 7, 1, hz - 3, s === 2 ? "silver" : "gold");
    v.box(-hx + 4, 0, hz - 5, -hx + 13, 1, hz - 1, s === 3 ? "black" : "marble");
    for (const fx of [hx - 9, hx - 5]) flag(v, fx, 1, hz - 3, 12, ["blue", "white", "red"]);
    c.blink(Math.floor((tx0 + tx1) / 2), crownY + 1, Math.floor((tz0 + tz1) / 2), "red");
  } else {
    vaultDoor(v, x1 - 6, 6, z1 + (s === 0 || s === 3 ? 2 : 0), 3);
    v.box(hx - 9, 1, hz - 4, hx - 2, 5, hz - 1, "#5a6b4a");
  }
  crowd(c, -hx + 3, z1 + 3, hx - 3, hz - 1, 5);
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
    levels: ["Roadside Pump", "Canopy Station", "Service Station & Garage", "Truck Stop & Car Wash", "Solar EV Superhub"],
    growth: "A lone pump gains a canopy, then a repair garage, a truck stop with a spinning car wash and finally a solar-roofed EV charging hub with a wind turbine.",
    build: buildGas,
  },
  atms: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Wall-Slot ATM", "ATM Kiosk", "Drive-Thru ATM", "24h Glass ATM Lobby", "Golden Cash Tower"],
    growth: "Stays a street-corner prop but levels up in style and height — from a slot in a wall to an obelisk with a giant spinning coin.",
    build: buildAtm,
  },
  banks: {
    footprints: [[1, 1], [2, 1], [2, 2], [2, 2], [2, 2]],
    levels: ["Teller Office", "Columned Savings Bank", "Domed Vault Bank", "Bank Tower", "Financial HQ Skyscraper"],
    growth: "Gains prestige: columns and steps, then a dome and vault, then a tower rising from the banking hall and a crowned HQ with a stock ticker and golden bull.",
    build: buildBanks,
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
