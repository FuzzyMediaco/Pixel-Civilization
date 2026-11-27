/**
 * Commercial overhaul (Original style): giant-object landmarks with a real upgrade story.
 * Each element keeps its footprints, IDs and gameplay; only the voxel builder, level names,
 * growth line and variant names change. Shapes come from commerceKit's `sculpt`.
 */
import { type Ctx, awning, bench, door, lamp, person, tree, flowerBed, fence } from "./kit";
import { DESIGNS } from "./registry";
import { bulbs, crowd, disc, glassFront, neon, neonWidth, sculpt, smooth, spinner, type Fill } from "./commerceKit";

type Build = (c: Ctx) => void;

export function override(id: string, build: Build, levels?: [string, string, string, string, string], growth?: string): void {
  const base = DESIGNS[id];
  if (!base) throw new Error(`commerceIcons: no base design for ${id}`);
  DESIGNS[id] = { ...base, build, levels: levels ?? base.levels, growth: growth ?? base.growth };
}

const SKIN = ["#e8b38f", "#c68a62", "#8d5a3b", "#f1c9a5"];
const pal = (c: Ctx) => c.pick(SKIN);

/** Hollow little shop with a lit display window and door on +z; returns roof y. */
function shop(c: Ctx, x0: number, z0: number, x1: number, z1: number, floors: number, wall: string, trim: string, glow = "#ffe1a6"): number {
  const { v } = c;
  const top = 1 + floors * 5;
  v.box(x0, 1, z0, x1, top, z1, wall);
  v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
  glassFront(v, x0 + 1, x1 - 1, 2, 5, z1 - 1, trim, 3, glow);
  const dx = Math.floor((x0 + x1) / 2) - 1;
  v.box(dx, 1, z1 - 1, dx + 2, 4, z1, "glassDark");
  for (let f = 1; f < floors; f++) for (let x = x0 + 2; x < x1 - 2; x += 3) v.box(x, 2 + f * 5, z1 - 1, x + 2, 4 + f * 5, z1, glow, 0.55);
  v.box(x0, top - 1, z0, x1, top, z1, trim);
  v.box(x0, top, z0, x1, top + 1, z1, trim);
  return top + 1;
}

// =============================================================================================
// SHOE STORE — Giant Sneaker · Shoebox Stack · Stiletto Salon · Cowboy Boot Outfitters
// =============================================================================================

interface ShoeCols { upper: string; accent: string; toe: string; lace: string; sole: string; tread: string }

/** High-top sneaker, heel at u=0, toe at u=1 (+x). */
function sneaker(k: ShoeCols) {
  return (u: number, h: number, w: number): Fill => {
    const cw = Math.abs(w - 0.5) * 2;
    const plan = 0.74 + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.05));
    const toeR = u > 0.84 ? Math.sqrt(Math.max(0, 1 - ((u - 0.84) / 0.16) ** 2)) : 1;
    const heelR = u < 0.07 ? Math.sqrt(Math.max(0, 1 - ((0.07 - u) / 0.07) ** 2)) : 1;
    const half = plan * Math.max(0.35, toeR) * Math.max(0.45, heelR);
    if (cw > half) return null;
    if (h < 0.06) return k.tread;
    if (h < 0.15) return Math.floor(u * 26) % 3 === 0 ? k.tread : k.sole;
    let top = u < 0.36 ? 0.9 : 0.9 - 0.6 * smooth(0.36, 0.98, u);
    if (u > 0.34 && u < 0.46) top = Math.max(top, 1.0); // tongue
    if (u > 0.72) top = 0.16 + (top - 0.16) * Math.sqrt(Math.max(0, 1 - (cw / half) ** 2 * 0.7));
    if (h > top) return null;
    if (u > 0.09 && u < 0.33 && h > 0.74 && cw < half - 0.3) return null; // ankle opening
    if (u > 0.34 && u < 0.46 && h > 0.86) return k.accent; // tongue tab
    if (u > 0.8 && h < 0.42) return k.toe;
    if (u > 0.4 && u < 0.82 && cw < 0.34 && h > top - 0.1) return Math.floor(u * 34) % 2 ? k.lace : k.upper;
    if (Math.abs(h - (0.36 + 0.08 * Math.sin(u * 26))) < 0.045) return k.accent;
    if (u < 0.06 && h > 0.3) return k.accent;
    if (u > 0.38 && u < 0.8 && cw > half - 0.12 && h > top - 0.16 && Math.floor(u * 17) % 2 === 0) return "#d9d9d9"; // eyelets
    return k.upper;
  };
}

/** Pointed pump with a stiletto heel, heel at u=0, toe at u=1. */
function stiletto(body: string, sole: string, heel: string, lining: string) {
  return (u: number, h: number, w: number): Fill => {
    const cw = Math.abs(w - 0.5) * 2;
    const S = 0.6 * (1 - smooth(0.1, 0.64, u)); // footbed height
    let half = u > 0.68 ? 0.92 * (1 - ((u - 0.68) / 0.32) ** 1.6 * 0.88) : u < 0.2 ? 0.62 : 0.62 + 0.3 * smooth(0.2, 0.55, u);
    half = Math.max(0.06, half);
    if (u < 0.13 && cw < 0.34 && h < S) return h < 0.04 ? "black" : heel;
    if (cw > half) return null;
    if (h < S - 0.07) return null;
    if (h < S) return sole;
    const T = u < 0.26 ? 0.36 - 0.1 * smooth(0.14, 0.26, u) : u < 0.6 ? 0.11 : 0.11 + 0.2 * smooth(0.6, 0.76, u) * (1 - smooth(0.9, 1, u));
    if (h > S + T) return null;
    if (u > 0.62) return Math.abs(h - (S + T * 0.55)) < 0.03 ? heel : body; // closed toe box with a gold band
    if (cw > half - 0.16) return body;
    return h < S + 0.05 ? lining : null;
  };
}

/** Western boot, heel at u=0, pointed toe at u=1, open shaft at the back. */
function cowboyBoot(leather: string, shaft: string, stitch: string) {
  return (u: number, h: number, w: number): Fill => {
    const cw = Math.abs(w - 0.5) * 2;
    const half = u > 0.62 ? 0.86 * (1 - ((u - 0.62) / 0.38) ** 1.3 * 0.9) : 0.86;
    if (cw > Math.max(0.08, half)) return null;
    const inShaft = u > 0.02 && u < 0.46;
    const footTop = u < 0.5 ? 0.32 : 0.32 - 0.2 * smooth(0.5, 1, u) + 0.05 * smooth(0.9, 1, u);
    const scallop = 0.98 - 0.12 * Math.abs(Math.sin(cw * Math.PI * 0.5)) * (u > 0.2 ? 1 : 0.2);
    if (!(h <= footTop || (inShaft && h <= scallop))) return null;
    if (h < 0.05) return "#3b2414";
    if (u < 0.2 && h < 0.13) return "woodDark";
    if (inShaft && h > 0.5 && cw < half - 0.22) return null; // open shaft
    if (inShaft && h > 0.86 && Math.abs(u - 0.24) < 0.05 && cw > half - 0.1) return stitch; // pull straps
    if (inShaft && h > 0.36 && Math.abs(Math.sin(u * 34 + h * 9)) < 0.18) return stitch;
    if (!inShaft && u > 0.55 && Math.abs(Math.sin(u * 22)) < 0.12 && h > footTop - 0.08) return stitch;
    return inShaft && h > 0.34 ? shaft : leather;
  };
}

function shoebox(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, body: string, lid: string, open = false): void {
  const { v } = c;
  v.box(x0, y0, z0, x1, y1, z1, body);
  v.clear(x0 + 1, y0 + 1, z0 + 1, x1 - 1, y1 - 1, z1 - 1);
  v.box(x0, y0 + Math.floor((y1 - y0) / 2), z1 - 1, x1, y0 + Math.floor((y1 - y0) / 2) + 1, z1, "white"); // brand stripe
  v.box(x1 - 1, y0 + 1, z0 + 1, x1, y1 - 1, z0 + 3, "white"); // size label
  if (!open) {
    v.box(x0 - 1, y1 - 2, z0 - 1, x1 + 1, y1 + 1, z1 + 1, lid);
    v.clear(x0, y1 - 2, z0, x1, y1, z1);
    v.box(x0, y1, z0, x1, y1 + 1, z1, lid);
  } else {
    v.box(x0, y1 - 1, z0, x1, y1, z1, body);
    for (let x = x0 + 1; x < x1 - 1; x++) for (let z = z0 + 1; z < z1 - 1; z++) if (c.rand() < 0.55) v.put(x, y1 - 1 + (c.rand() < 0.4 ? 1 : 0), z, c.rand() < 0.5 ? "white" : "#f4f1ea");
  }
}

function buildShoeStore(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const P = (x0: number, z0: number, x1: number, z1: number, col = "path") => v.box(x0, 0, z0, x1, 1, z1, col);

  if (s === 0) {
    // Giant Sneaker: a sneaker sign becomes a walk-in high-top, then a pair, then a colossus
    const red: ShoeCols = { upper: "#d62b35", accent: "#1f3a68", toe: "white", lace: "white", sole: "white", tread: "#c9a06a" };
    const blue: ShoeCols = { upper: "#2c5ea8", accent: "#f2b81c", toe: "white", lace: "white", sole: "white", tread: "#3a3a3a" };
    if (lv === 1) {
      P(-8, 4, 8, 8);
      const top = shop(c, -6, -5, 4, 4, 1, "white", "#d62b35");
      awning(v, -6, 4, 5, 4, "red", "white");
      sculpt(v, -6, top, -3, 5, top + 6, 3, sneaker(red));
      bench(v, 5, 1, 2, "z", "wood");
      person(v, 6, 1, 6, "teal", "blueDark", pal(c));
    } else if (lv === 2) {
      P(-8, 4, 8, 8);
      const top = shop(c, -7, -6, 7, 4, 2, "white", "#1f3a68");
      awning(v, -7, 7, 5, 4, "red", "white");
      sculpt(v, -7, top, -4, 8, top + 9, 3, sneaker(red));
      neon(v, "SHOES", -6, top - 4, 4, "#ff4d5e", { scale: 1 });
      crowd(c, 3, -6, 5, 6, 8);
    } else if (lv === 3) {
      P(-16, 6, 16, 8);
      sculpt(v, -15, 1, -7, 15, 17, 6, sneaker(red));
      v.box(-3, 2, 4, 1, 7, 6, null);
      v.box(-3, 1, 3, 1, 7, 4, "#ffe1a6", 0.7);
      glassFront(v, 4, 11, 3, 6, 5, "#d62b35", 3);
      crowd(c, 5, -14, 6, 14, 8);
      lamp(v, -14, 1, 7, 5);
    } else if (lv === 4) {
      P(-16, 10, 16, 16);
      sculpt(v, -15, 1, -15, 13, 18, -3, sneaker(red));
      sculpt(v, -12, 1, -2, 16, 18, 10, sneaker(blue));
      // dangling lace linking the pair
      for (let i = 0; i <= 14; i++) v.put(-2 + i, 17 - Math.round(Math.sin((i / 14) * Math.PI) * 4), -3 + Math.round(i / 5), "white");
      v.box(-1, 1, 9, 3, 7, 10, null);
      v.box(-1, 1, 8, 3, 7, 9, "#ffe1a6", 0.7);
      crowd(c, 8, -15, 11, 15, 16);
      lamp(v, -15, 1, 13, 6);
      lamp(v, 14, 1, 13, 6);
    } else {
      P(-16, 12, 16, 16);
      sculpt(v, -16, 1, -13, 16, 32, 12, sneaker(red));
      // grand toe entrance and display windows
      v.box(9, 2, 9, 14, 9, 12, null);
      v.box(9, 1, 8, 14, 9, 9, "#ffe1a6", 0.8);
      glassFront(v, -9, 6, 4, 8, 11, "#1f3a68", 3);
      neon(v, "SNEAKS", -12, 22, 12, "#ffd23f", { scale: 1 });
      crowd(c, 10, -15, 13, 15, 16);
      crowd(c, 4, -8, -6, -2, 0, 30); // rooftop collar terrace
      lamp(v, -15, 1, 14, 6);
    }
  } else if (s === 1) {
    // Shoebox Stack: boxes pile up, open, and finally burst with a giant sneaker
    const boxes = ["#f28c28", "#2a9d8f", "#e63946", "#8338ec", "#ffbe0b", "#3a86ff", "#fb5607"];
    const lids = ["#1d1d1d", "#f1faee", "#1d1d1d", "#ffbe0b", "#1d1d1d", "#f1faee", "#1d1d1d"];
    const mid: ShoeCols = { upper: "#ffbe0b", accent: "#8338ec", toe: "white", lace: "white", sole: "white", tread: "#1d1d1d" };
    if (lv === 1) {
      P(-8, 4, 8, 8);
      shoebox(c, -6, 1, -5, 6, 8, 4, boxes[0], lids[0], true);
      // propped lid as the awning over a counter cut-out
      for (let z = 4; z < 8; z++) v.box(-7, 8 + Math.floor((z - 4) / 2), z, 7, 9 + Math.floor((z - 4) / 2), z + 1, lids[0]);
      v.box(-4, 3, 3, 4, 6, 4, "#ffe1a6", 0.7);
      v.box(-4, 3, 3, 4, 4, 5, "white");
      person(v, 0, 1, 6, "pink", "blueDark", pal(c));
    } else if (lv === 2) {
      P(-8, 5, 8, 8);
      shoebox(c, -7, 1, -6, 6, 8, 5, boxes[0], lids[0]);
      shoebox(c, -4, 9, -5, 7, 15, 3, boxes[1], lids[1], true);
      glassFront(v, -6, 5, 2, 6, 4, "#1d1d1d", 3);
      v.box(-1, 1, 4, 1, 5, 5, "glassDark");
      crowd(c, 2, -6, 6, 6, 8);
    } else if (lv === 3) {
      P(-16, 5, 16, 8);
      shoebox(c, -15, 1, -6, -1, 9, 5, boxes[0], lids[0]);
      shoebox(c, 1, 1, -7, 15, 8, 4, boxes[2], lids[2]);
      shoebox(c, -9, 10, -5, 9, 17, 3, boxes[1], lids[1], true);
      sculpt(v, -6, 17, -3, 4, 22, 1, sneaker(mid));
      glassFront(v, -13, -3, 2, 6, 4, "#1d1d1d", 3);
      glassFront(v, 3, 13, 2, 6, 3, "#1d1d1d", 3);
      crowd(c, 4, -14, 6, 14, 8);
    } else {
      const big = lv === 5;
      P(-16, 10, 16, 16);
      const stack: [number, number, number, number, number][] = big
        ? [[-15, -14, 1, 1, 10], [1, -14, 15, 1, 10], [-14, 2, 0, 12, 9], [-11, -11, 10, 0, 9], [-6, -9, 12, -1, 9], [-10, -8, 6, -2, 8], [-5, -7, 5, -3, 8]]
        : [[-15, -14, 0, 0, 9], [2, -14, 15, 0, 8], [-14, 2, -2, 12, 8], [-11, -10, 11, -2, 8], [-6, -8, 7, -4, 7]];
      let y = 1;
      stack.forEach(([x0, z0, x1, z1, hgt], i) => {
        const yy = i < 3 ? 1 : y;
        shoebox(c, x0, yy, z0, x1, yy + hgt, z1, boxes[i % boxes.length], lids[i % lids.length], i === stack.length - 1);
        if (i >= 2) y = yy + hgt + 1;
        else y = Math.max(y, yy + hgt + 1);
      });
      const top = y - 1;
      sculpt(v, -7, top - 2, -9, big ? 9 : 6, top + (big ? 12 : 8), -1, sneaker(mid));
      glassFront(v, -13, -3, 2, 6, 11, "#1d1d1d", 3);
      v.box(5, 1, 0, 9, 5, 1, "#ffe1a6", 0.7);
      crowd(c, big ? 9 : 6, -15, 12, 15, 16);
      neon(v, "SHOES", 2, 3, 13, "#ffbe0b");
    }
  } else if (s === 2) {
    // Stiletto Salon: a heel on the sign becomes a walk-in pump with a footbed terrace
    const body = "#e0457b", sole = "#2b1d2e", heel = "#e8b93a", lining = "#ffd1e0";
    if (lv === 1) {
      P(-8, 4, 8, 8, "marble");
      disc(v, -1, -1, 1, 7, 5, "#ffd1e0");
      disc(v, -1, -1, 7, 8, 6, "#e0457b");
      v.box(-4, 2, 3, 2, 5, 5, "#ffe1a6", 0.7);
      sculpt(v, -5, 8, -2, 4, 13, 1, stiletto(body, sole, heel, lining));
      person(v, 4, 1, 5, "magenta", "black", pal(c));
    } else if (lv === 2) {
      P(-8, 5, 8, 8, "marble");
      const top = shop(c, -7, -6, 7, 4, 2, "#fbeef2", "#e0457b");
      awning(v, -7, 7, 5, 4, "pink", "white");
      v.box(-7, top, -6, 7, top + 2, 4, "#5a4b6b");
      sculpt(v, -6, top + 2, -3, 7, top + 10, 2, stiletto(body, sole, heel, lining));
      crowd(c, 2, -6, 6, 6, 8);
    } else if (lv === 3) {
      P(-16, 5, 16, 8, "marble");
      sculpt(v, -15, 1, -6, 15, 16, 6, stiletto(body, sole, heel, lining));
      v.box(6, 1, 4, 10, 5, 6, null);
      v.box(6, 1, 3, 10, 5, 4, "#ffe1a6", 0.7);
      crowd(c, 3, -6, -2, 2, 2, 7); // shoppers on the footbed
      crowd(c, 3, -10, 6, 14, 8);
    } else {
      const big = lv === 5;
      P(-16, big ? 12 : 8, 16, 16, "marble");
      sculpt(v, -16, 1, big ? -13 : -15, 16, big ? 30 : 20, big ? 9 : -1, stiletto(body, sole, heel, lining));
      if (big) {
        // heel becomes a glass lift and the toe a lit salon
        for (let y = 2; y < 16; y++) v.put(-14, y, -2, "#bfe9ff", 0.4);
        v.box(8, 1, 7, 13, 7, 9, null);
        v.box(8, 1, 6, 13, 7, 7, "#ffe1a6", 0.8);
        crowd(c, 5, -8, -6, 2, 2, 12);
        neon(v, "SALON", -6, 3, 14, "#ff7aa8");
      } else {
        // matching handbag annex
        sculpt(v, 2, 1, 1, 15, 11, 11, (u, h, w) => {
          const inset = 0.18 * h;
          if (u < inset || u > 1 - inset) return null;
          if (h > 0.92) return null;
          return Math.abs(h - 0.6) < 0.06 ? "#e8b93a" : "#7a2048";
        });
        for (let i = 0; i <= 8; i++) v.put(4 + i, 11 + Math.round(Math.sin((i / 8) * Math.PI) * 4), 6, "#e8b93a");
        v.box(6, 1, 10, 10, 5, 11, "#ffe1a6", 0.7);
        crowd(c, 4, -14, 12, 14, 16);
      }
      lamp(v, -15, 1, 14, 6, "iron", "#ffb3cf");
    }
  } else {
    // Cowboy Boot Outfitters: a repair wagon grows into a boot you can walk into, with a spur that spins
    const leather = "#9c5a2e", shaft = "#c98a4b", stitch = "#f4e3c1";
    if (lv === 1) {
      P(-8, 3, 8, 8, "sand");
      v.box(-6, 2, -3, 5, 4, 3, "woodLight");
      for (const x of [-5, 3]) disc(v, x, 3, 1, 2, 1.5, "woodDark");
      for (let x = -6; x < 5; x++) for (let z = -3; z < 3; z++) {
        const d = Math.abs(z + 0.5);
        v.put(x, 8 - Math.floor(d), z, "#f3ead3");
      }
      sculpt(v, -3, 4, -1, 3, 9, 1, cowboyBoot(leather, shaft, stitch));
      person(v, 6, 1, 4, "red", "blueDark", pal(c));
    } else if (lv === 2) {
      P(-8, 5, 8, 8, "sand");
      const top = shop(c, -7, -6, 7, 4, 1, "#b07a46", "woodDark");
      v.box(-7, top, 3, 7, top + 6, 4, "#b07a46");
      v.box(-7, top + 5, 3, 7, top + 6, 4, "woodDark");
      neon(v, "BOOTS", -6, top, 4, "#ffd27a", { emit: 0.8 });
      sculpt(v, -5, top, -5, 3, top + 9, -1, cowboyBoot(leather, shaft, stitch));
      v.box(-7, 1, 5, 7, 2, 7, "wood");
      person(v, 3, 2, 6, "teal", "blueDark", pal(c));
    } else if (lv === 3) {
      P(-16, 5, 16, 8, "sand");
      sculpt(v, -15, 1, -6, 15, 20, 6, cowboyBoot(leather, shaft, stitch));
      v.box(2, 1, 4, 6, 5, 6, null);
      v.box(2, 1, 3, 6, 5, 4, "#ffe1a6", 0.7);
      fence(v, 8, 5, 15, 8, 1, 2, "woodLight");
      crowd(c, 3, -14, 6, 6, 8);
    } else {
      const big = lv === 5;
      P(-16, 10, 16, 16, "sand");
      const z0 = big ? -12 : -14, z1 = big ? 10 : 2;
      const y1 = big ? 32 : 22;
      sculpt(v, -15, 1, z0, 15, y1, z1, cowboyBoot(leather, shaft, stitch));
      v.box(5, 1, z1 - 2, 10, 6, z1, null);
      v.box(5, 1, z1 - 3, 10, 6, z1 - 2, "#ffe1a6", 0.7);
      // spinning spur on the heel
      const cy = Math.round(y1 * 0.12) + 3, cz = Math.round((z0 + z1) / 2);
      v.box(-16, cy, cz - 1, -15, cy + 1, cz + 1, "silver");
      const spur = spinner(c, -16.5, cy + 0.5, cz, "x", 1.4);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        for (let r = 1; r <= (big ? 4 : 3); r++) spur.put(0, Math.round(Math.sin(ang) * r), Math.round(Math.cos(ang) * r), "#d9d9d9");
      }
      spur.put(0, 0, 0, "#e8b93a");
      if (!big) {
        fence(v, -15, 4, 15, 11, 1, 2, "woodLight", [0, 4]);
        c.critters({ kind: "horse", count: 2, area: [-13, 5, 13, 10] });
      } else {
        crowd(c, 8, -14, 12, 14, 16);
        crowd(c, 3, -12, -4, -6, 2, y1 - 3);
      }
      for (const [x, z] of [[-14, 14], [13, 14]]) { v.box(x, 1, z, x + 1, 6, z + 1, "#4f8a3a"); v.box(x - 1, 3, z, x, 5, z + 1, "#4f8a3a"); }
    }
  }
}

override(
  "shoe_stores",
  buildShoeStore,
  ["Cobbler's Kiosk", "Shoe Shop", "Walk-In Shoe", "Shoe Flagship", "The Giant Shoe House"],
  "A shoe sign on a kiosk grows into a shoe you can walk into, then a matched pair or a towering colossus: sneaker, shoebox stack, stiletto or cowboy boot.",
);
