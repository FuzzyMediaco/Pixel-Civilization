import {
  type Ctx,
  PixelVox,
  bench,
  bush,
  car,
  chimney,
  clockFace,
  column,
  door,
  fence,
  flag,
  flatRoof,
  flowerBed,
  gable,
  hedge,
  hip,
  lamp,
  lot,
  person,
  ring,
  rocks,
  sawtooth,
  securityFence,
  solarRow,
  speckle,
  tank,
  tree,
  truck,
  windows,
  barrelRoof,
  archway,
  smokestack,
} from "./kit";
import { defineDesigns } from "./registry";

// =============================================================================================
// Local helpers (water & utilities)
// =============================================================================================

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "purple", "white", "lime", "crimson"];
const PANTS = ["blueDark", "charcoal", "woodDark", "sand", "slate"];

function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, y = 1): void {
  for (let i = 0; i < n; i++) {
    person(c.v, c.ri(x0, x1 - 1), y, c.ri(z0, z1 - 1), c.pick(SHIRTS), c.pick(PANTS));
  }
}

/** Horizontal 2x2 pipe along x or z with flanges */
function pipe(v: PixelVox, axis: "x" | "z", a0: number, a1: number, y: number, fixed: number, col = "steel", flange = "steelDark"): void {
  for (let a = a0; a < a1; a++) {
    const fc = (a - a0) % 6 === 0 ? flange : col;
    if (axis === "x") v.box(a, y, fixed, a + 1, y + 2, fixed + 2, fc);
    else v.box(fixed, y, a, fixed + 2, y + 2, a + 1, fc);
  }
}

/** Water surface box (raised pools) */
function water(v: PixelVox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col = "water"): void {
  v.box(x0, y0, z0, x1, y1, z1, col, 0.1);
}

/** Round clarifier: concrete ring, water, centre drive and rotating sweep bridge */
function clarifier(c: Ctx, cx: number, cz: number, r: number, rim = "concrete", wcol = "water", bridge = "hazard"): void {
  const v = c.v;
  ring(v, cx, cz, 1, 4, r, r - 1, rim);
  v.cylinderY(cx, cz, 1, 3, r - 1, wcol, 0.12);
  ring(v, cx, cz, 3, 3, r - 2.2, r - 3, "foam");
  v.cylinderY(cx, cz, 1, 5, 1, "concreteDark");
  const rot = new PixelVox();
  const L = Math.max(2, Math.floor(r - 1));
  rot.box(-L, 0, -1, L, 1, 1, bridge);
  rot.box(-L, 1, 0, L, 2, 1, "steelDark");
  rot.box(-1, 0, -1, 1, 2, 1, "steelLight");
  rot.box(L - 1, -1, -1, L, 0, 1, "steelDark");
  rot.box(-L, -1, -1, -L + 1, 0, 1, "steelDark");
  c.addRotor({ vox: rot, pivot: [cx, 4, cz], axis: "y", speed: 0.25 });
}

/** Thin glowing water jet */
function jet(v: PixelVox, x: number, y: number, z: number, h: number): void {
  for (let k = 0; k < h; k++) v.put(x, y + k, z, k % 2 ? "#d8f6ff" : "foam", 0.55);
  v.put(x, y + h, z, "cyan", 0.6);
  v.put(x, y, z + 1, "#d8f6ff", 0.3);
}

/** Tiny 3x5 pixel font (only the glyphs we need) */
const FONT: Record<string, string[]> = {
  H: ["101", "101", "111", "101", "101"],
  "2": ["111", "001", "111", "100", "111"],
  O: ["111", "101", "101", "101", "111"],
  W: ["101", "101", "101", "111", "101"],
  A: ["111", "101", "111", "101", "101"],
  T: ["111", "010", "010", "010", "010"],
  E: ["111", "100", "110", "100", "111"],
  R: ["110", "101", "110", "101", "101"],
};

/** Paint text onto the curved front (+z) face of a vertical cylinder */
function cylText(v: PixelVox, txt: string, cx: number, cz: number, r: number, yTop: number, col: string, emit = 0): void {
  const w = txt.length * 4 - 1;
  let x = Math.round(cx - w / 2);
  for (const ch of txt) {
    const g = FONT[ch];
    if (g) {
      for (let row = 0; row < 5; row++) {
        for (let k = 0; k < 3; k++) {
          if (g[row][k] !== "1") continue;
          const px = x + k;
          const d = px + 0.5 - cx;
          const zf = Math.floor(cz + Math.sqrt(Math.max(0, r * r + 0.15 - d * d)) - 0.5);
          v.put(px, yTop - row, zf, col, emit);
        }
      }
    }
    x += 4;
  }
}

/** Rectangular paved plaza with border */
function plaza(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col: string, border: string): void {
  v.box(x0, 0, z0, x1, 1, z1, border);
  v.box(x0 + 1, 0, z0 + 1, x1 - 1, 1, z1 - 1, col);
}

/** Sea strip along the back (-z) edge for coast_or_water elements; returns z of the shoreline */
function seaBack(c: Ctx, depth: number, quay = "concreteDark"): number {
  const v = c.v;
  const zs = -c.hz + depth;
  v.box(-c.hx, 0, -c.hz, c.hx, 1, zs, "waterDeep", 0.06);
  for (let x = -c.hx; x < c.hx; x++) if ((x * 7) % 5 === 0) v.put(x, 0, -c.hz + ((x * 3) & 3), "water", 0.12);
  v.box(-c.hx, 0, zs, c.hx, 2, zs + 1, quay);
  return zs;
}

// =============================================================================================
// WATER TREATMENT PLANT
//  V0 Victorian Waterworks (brick filter house w/ clock gable, concrete clarifiers)
//  V1 Eco Wetland Works (timber + green roofs, reed beds, solar, green-rimmed ponds)
//  V2 Hi-Tech Purifier (white/blue modules, glowing cyan UV reactor towers, dome lab)
//  V3 Heavy Industrial (steel sheds, silver egg digesters, orange pipework)
// =============================================================================================
function filterBed(v: PixelVox, x0: number, z0: number, x1: number, z1: number, rim: string): void {
  v.box(x0, 1, z0, x1, 3, z1, rim);
  v.box(x0 + 1, 1, z0 + 1, x1 - 1, 3, z1 - 1, "sandDark");
  for (let x = x0 + 1; x < x1 - 1; x++) {
    for (let z = z0 + 1; z < z1 - 1; z++) {
      if ((x - x0) % 3 === 0 || (z - z0) % 4 === 0) v.put(x, 2, z, rim);
      else v.put(x, 2, z, "water", 0.12);
    }
  }
  v.box(x0, 3, z0, x1, 4, z0 + 1, "steelDark");
}

function buildTreatment(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, s === 1 ? "grass2" : "concrete2");
  speckle(c, s === 1 ? "grass3" : "concrete", 0.08);
  const rim = ["concrete", "moss", "white", "steel"][s];
  const wcol = ["water", "teal", "cyan", "water"][s];
  const bridge = ["hazard", "woodLight", "blue", "orange"][s];

  // ---- main filter/control house (back-left) ----
  const bw = [6, 9, 9, 13, 13][lv - 1];
  const bd = [8, 8, 10, 12, 14][lv - 1];
  const bx0 = -hx + 1;
  const bz0 = -hz + 1;
  const bx1 = bx0 + bw;
  const bz1 = Math.min(hz - 1, bz0 + bd);
  const fh = [6, 7, 8, 10, 12][lv - 1];
  const midX = Math.floor((bx0 + bx1) / 2);
  if (s === 0) {
    v.box(bx0, 1, bz0, bx1, 1 + fh, bz1, "brick");
    v.box(bx0, 1, bz0, bx1, 2, bz1, "brickDark");
    for (let y = 5; y < fh; y += 4) v.box(bx0, y, bz0, bx1, y + 1, bz1, "limestone");
    windows(c, bx0, 1, bz0, bx1, 1 + fh, bz1, { h: 2, stepH: 3, stepV: 4, emit: 0.4 });
    const ry = gable(v, bx0 - 1, 1 + fh, bz0 - 1, bx1 + 1, bz1 + 1, "z", "slate", "limestone");
    if (lv >= 2) clockFace(v, midX, fh - 1, bz1, 1);
    if (lv >= 3) {
      const ch = chimney(v, bx0 + 1, ry - 3, bz0 + 1, 7, "brickDark");
      c.smoke(bx0 + 2, ch, bz0 + 2, "steam");
    }
  } else if (s === 1) {
    v.box(bx0, 1, bz0, bx1, 1 + fh, bz1, "woodLight");
    for (let x = bx0; x < bx1; x += 2) v.box(x, 1, bz1 - 1, x + 1, 1 + fh, bz1, "wood");
    windows(c, bx0, 1, bz0, bx1, 1 + fh, bz1, { w: 2, h: 2, stepH: 4, stepV: 4, emit: 0.4 });
    v.box(bx0 - 1, 1 + fh, bz0 - 1, bx1 + 1, 2 + fh, bz1 + 1, "woodDark");
    v.box(bx0, 2 + fh, bz0, bx1, 3 + fh, bz1, "leaf");
    for (let x = bx0 + 1; x < bx1 - 1; x += 3) bush(v, x, 3 + fh, bz0 + 2 + (x & 3), 0.9, "leafLight", "pink");
    if (lv >= 2) {
      // little wind turbine on the green roof
      const tx = bx1 - 2;
      const tz = bz0 + 2;
      v.box(tx, 3 + fh, tz, tx + 1, 12 + fh, tz + 1, "white");
      const rot = new PixelVox();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 1; d <= 4; d++) rot.put(dx * d, dy * d, 0, "white");
      rot.put(0, 0, 0, "silver");
      c.addRotor({ vox: rot, pivot: [tx, 12 + fh, tz + 1], axis: "z", speed: 2.5, wind: true });
    }
  } else if (s === 2) {
    v.box(bx0, 1, bz0, bx1, 1 + fh, bz1, "white");
    v.box(bx0, 3, bz1 - 1, bx1, 5, bz1, "glass", 0.4);
    v.box(bx1 - 1, 3, bz0, bx1, 5, bz1, "glass", 0.4);
    v.box(bx0, 1 + fh - 1, bz0, bx1, 1 + fh, bz1, "blue");
    v.dome(midX, 1 + fh, Math.floor((bz0 + bz1) / 2), Math.min(bw, bd) / 2 - 0.5, "glass", 0.25);
    v.box(midX, fh + Math.floor(Math.min(bw, bd) / 2), Math.floor((bz0 + bz1) / 2), midX + 1, fh + Math.floor(Math.min(bw, bd) / 2) + 4, Math.floor((bz0 + bz1) / 2) + 1, "silver");
    c.blink(midX, fh + Math.floor(Math.min(bw, bd) / 2) + 4, Math.floor((bz0 + bz1) / 2), "cyan");
  } else {
    v.box(bx0, 1, bz0, bx1, 1 + fh, bz1, "steelLight");
    for (let x = bx0; x < bx1; x += 2) v.box(x, 1, bz1 - 1, x + 1, 1 + fh, bz1, "steel");
    for (let z = bz0; z < bz1; z += 2) v.box(bx1 - 1, 1, z, bx1, 1 + fh, z + 1, "steel");
    sawtooth(v, bx0, 1 + fh, bz0, bx1, bz1, "steelDark", "glass", 4);
    const t = smokestack(v, bx0 + 2, bz0 + 2, 1, fh + 6 + lv * 2, 1.2, "steelDark", "orange");
    c.smoke(bx0 + 2, t, bz0 + 2, "steam");
  }
  door(v, bx1 - 4, 1, bz1 - 1, s === 2 ? "blueDark" : "woodDark");

  // ---- clarifier/filter grid (right zone) ----
  const r = [3.5, 4, 4.5, 5, 5.5][lv - 1];
  const pitch = Math.round(r * 2 + 1);
  const zx0 = bx1 + 1;
  const zx1 = hx - 1;
  const zz0 = -hz + 1;
  const zz1 = lv >= 4 ? hz - 6 : hz - 1;
  const cols = Math.max(1, Math.floor((zx1 - zx0) / pitch));
  const rows = Math.max(1, Math.floor((zz1 - zz0) / pitch));
  const offX = zx0 + Math.floor((zx1 - zx0 - cols * pitch) / 2);
  const offZ = zz0 + Math.floor((zz1 - zz0 - rows * pitch) / 2);
  const want = [1, 2, 3, 5, 8][lv - 1];
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = offX + col * pitch + pitch / 2;
      const cz = offZ + row * pitch + pitch / 2;
      const isClar = n < want && (row + col) % (lv >= 3 && lv < 5 ? 3 : 7) !== 2;
      if (isClar) {
        clarifier(c, Math.round(cx), Math.round(cz), r, rim, wcol, bridge);
        n++;
      } else {
        filterBed(v, Math.round(cx - r), Math.round(cz - r), Math.round(cx + r), Math.round(cz + r), rim);
      }
      // feed pipe back to the house
      if (row === 0) pipe(v, "x", bx1, Math.round(cx - r) + 1, 1, Math.round(cz) - 1, s === 3 ? "orange" : "steel");
    }
  }

  // ---- signature zone (front-left, below the house) ----
  const sz0 = bz1 + 1;
  const sz1 = lv >= 4 ? hz - 6 : hz - 1;
  const sx1 = bx1;
  if (sz1 - sz0 >= 5) {
    const scx = Math.floor((bx0 + sx1) / 2);
    const scz = Math.floor((sz0 + sz1) / 2);
    if (s === 0) {
      // brick standpipe tower
      const th = 10 + lv * 3;
      v.box(scx - 2, 1, scz - 2, scx + 2, th, scz + 2, "brick");
      for (let y = 4; y < th; y += 5) v.box(scx - 2, y, scz - 2, scx + 2, y + 1, scz + 2, "limestone");
      windows(c, scx - 2, 1, scz - 2, scx + 2, th, scz + 2, { stepV: 5, emit: 0.4 });
      v.box(scx - 3, th, scz - 3, scx + 3, th + 1, scz + 3, "limestone");
      v.box(scx - 3, th + 1, scz - 3, scx + 3, th + 4, scz + 3, "brick");
      hip(v, scx - 3, th + 4, scz - 3, scx + 3, scz + 3, "slate");
      v.put(scx, th + 7, scz, "gold", 0.4);
    } else if (s === 1) {
      // reed-bed wetland with boardwalk
      v.box(bx0, 0, sz0, sx1, 1, sz1, "teal", 0.1);
      for (let x = bx0; x < sx1; x++) for (let z = sz0; z < sz1; z++) if (c.rand() < 0.4) v.box(x, 1, z, x + 1, 2 + c.ri(0, 2), z + 1, c.rand() < 0.2 ? "woodDark" : c.rand() < 0.5 ? "olive" : "leafLight");
      v.box(bx0, 1, scz, sx1, 2, scz + 2, "woodLight");
      person(v, scx, 2, scz, "lime", "woodDark");
    } else if (s === 2) {
      // glowing UV reactor towers
      const k = Math.max(1, Math.min(4, Math.floor((sx1 - bx0) / 4)));
      for (let i = 0; i < k; i++) {
        const tx = bx0 + 2 + i * 4;
        const th = 8 + lv * 2 + (i % 2) * 2;
        v.cylinderY(tx, scz, 1, th, 1.5, "white");
        v.box(tx - 1, 3, scz + 1, tx + 1, th - 1, scz + 2, "screenCyan", 0.9);
        v.box(tx - 2, 3, scz - 1, tx - 1, th - 1, scz + 1, "screenCyan", 0.9);
        v.cylinderY(tx, scz, th, th + 1, 1.9, "blue");
        c.blink(tx, th + 1, scz, "cyan");
      }
    } else {
      // egg-shaped digesters
      const k = Math.max(1, Math.min(3, Math.floor((sx1 - bx0) / 6)));
      for (let i = 0; i < k; i++) {
        const ex = bx0 + 3 + i * 6;
        const eh = 6 + lv;
        v.box(ex - 2, 1, scz - 2, ex + 2, 3, scz + 2, "concreteDark");
        v.sphere(ex, 3 + eh, scz, 2.8, eh, 2.8, "chrome");
        v.box(ex - 1, 2 + eh * 2, scz - 1, ex + 1, 4 + eh * 2, scz + 1, "steelDark");
        v.box(ex + 3, 3, scz, ex + 4, 3 + eh * 2, scz + 1, "hazard");
        v.box(ex - 1, 3 + eh * 2, scz, ex + 4, 4 + eh * 2, scz + 1, "hazard");
      }
    }
  }

  if (lv >= 4) {
    // parking & delivery trucks along the front, chemical tanks
    const pz = hz - 5;
    v.box(-hx + 1, 0, pz, hx - 1, 1, hz - 1, "asphalt");
    for (let x = -hx + 4; x < hx - 2; x += 6) v.box(x, 0, pz, x + 1, 1, pz + 2, "white");
    truck(v, -hx + 6, 1, pz + 2, "x", "white", "blue");
    car(v, -hx + 14, 1, pz + 2, "x", c.pick(["red", "silver", "teal"]));
    car(v, -hx + 20, 1, pz + 2, "x", c.pick(["yellow", "white", "blue"]));
    for (let i = 0; i < 3; i++) tank(v, hx - 3 - i * 4, hz - 3, 1, 4, 1.4, ["yellow", "white", "sky"][i], "steelLight");
  }
  if (lv >= 5) {
    securityFence(v, -hx, -hz, hx, hz, 1, 3, [-hx + 2, -hx + 10]);
    if (s === 0) flag(v, bx1 - 1, 1, bz1, 14, ["blue", "white", "sky"]);
    if (s === 1) for (let x = -hx + 22; x < hx - 14; x += 5) solarRow(v, x, x + 4, 1, hz - 5, 3);
    for (const [lx, lz] of [[-hx + 1, hz - 2], [hx - 2, -hz + 1]]) lamp(v, lx, 1, lz, 6);
  }
  if (lv <= 2) person(v, bx1 - 2, 1, Math.min(hz - 1, bz1 + 1), "sky", "blueDark");
}

// =============================================================================================
// WELL (1x1 at every level — grows in detail/prestige)
//  V0 Cobblestone Village (grey stone, timber gable)   V1 Japanese Ido (wood curb, tiled hip roof)
//  V2 Desert Oasis (sandstone, turquoise dome, palms)  V3 Fairy-Tale (mossy stone, toadstool roof)
// =============================================================================================
interface WellStyle { stone: string; stone2: string; post: string; roof: string; roof2: string; ground: string; ground2: string }
const WELL_STYLES: WellStyle[] = [
  { stone: "stone", stone2: "granite", post: "woodDark", roof: "terracotta", roof2: "brickDark", ground: "grass2", ground2: "path" },
  { stone: "woodDark", stone2: "wood", post: "woodLight", roof: "slate", roof2: "slateLight", ground: "path2", ground2: "concrete" },
  { stone: "sandDark", stone2: "sand", post: "woodDark", roof: "teal", roof2: "tealDark", ground: "sand", ground2: "sandDark" },
  { stone: "stone", stone2: "moss", post: "oak", roof: "red", roof2: "white", ground: "grass", ground2: "grass3" },
];

function wellRoof(c: Ctx, cx: number, cz: number, r: number, y: number, st: WellStyle): number {
  const v = c.v;
  const s = c.variant % 4;
  if (s === 0) return gable(v, cx - r - 2, y, cz - r - 1, cx + r + 2, cz + r + 1, "x", st.roof, st.roof2);
  if (s === 1) {
    const top = hip(v, cx - r - 2, y, cz - r - 2, cx + r + 2, cz + r + 2, st.roof, st.roof2, 3);
    for (const [px, pz] of [[cx - r - 3, cz - r - 3], [cx + r + 2, cz - r - 3], [cx - r - 3, cz + r + 2], [cx + r + 2, cz + r + 2]]) v.put(px, y + 1, pz, st.roof2);
    v.box(cx - 1, top, cz - 1, cx + 1, top + 1, cz + 1, "gold");
    return top + 1;
  }
  if (s === 2) {
    v.box(cx - r - 1, y, cz - r - 1, cx + r + 1, y + 1, cz + r + 1, "white");
    v.dome(cx, y + 1, cz, r + 0.5, st.roof);
    v.box(cx, y + r + 2, cz, cx + 1, y + r + 4, cz + 1, "gold");
    return y + r + 4;
  }
  v.cone(cx, y, y + r + 4, cz, r + 2.6, 0.5, st.roof);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1;
    const rr = r + 1.5 - (i % 3);
    v.put(Math.floor(cx + Math.cos(a) * rr), y + 1 + (i % 3), Math.floor(cz + Math.sin(a) * rr), "white");
  }
  return y + r + 4;
}

function wellCore(c: Ctx, cx: number, cz: number, r: number, roofed: boolean, st: WellStyle): void {
  const v = c.v;
  ring(v, cx, cz, 1, 4, r, r - 1.1, st.stone);
  ring(v, cx, cz, 2, 3, r, r - 1.1, st.stone2);
  ring(v, cx, cz, 4, 5, r + 0.3, r - 1.1, st.stone2);
  v.cylinderY(cx, cz, 1, 2, r - 1.1, "waterDeep", 0.15);
  const ph = roofed ? 10 : 8;
  v.box(cx - r - 1, 1, cz, cx - r, ph, cz + 1, st.post);
  v.box(cx + r, 1, cz, cx + r + 1, ph, cz + 1, st.post);
  v.box(cx - r - 1, ph - 2, cz, cx + r + 1, ph - 1, cz + 1, "woodDark");
  v.box(cx + r + 1, ph - 3, cz, cx + r + 2, ph - 1, cz + 1, "iron"); // crank
  v.box(cx, 3, cz, cx + 1, ph - 2, cz + 1, "#c2b280"); // rope
  v.box(cx - 1, 3, cz - 1, cx + 1, 5, cz + 1, "woodLight");
  v.put(cx - 1, 4, cz - 1, "water", 0.2);
  if (roofed) wellRoof(c, cx, cz, r, ph, st);
}

function buildWell(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const st = WELL_STYLES[s];
  lot(c, st.ground);
  speckle(c, st.ground2, 0.12);
  if (s === 3) speckle(c, c.pick(["pink", "yellow", "white"]), 0.04, 0, 0);

  if (lv <= 3) {
    const r = lv === 1 ? 3 : 3.5;
    const cx = lv === 3 ? -2 : 0;
    const cz = lv === 3 ? -1 : 0;
    if (lv >= 2) {
      v.cylinderY(cx, cz, 0, 1, r + 3, st.ground2);
      v.box(cx - 1, 0, cz, cx + 1, 1, hz, st.ground2);
    }
    wellCore(c, cx, cz, r, lv >= 2, st);
    if (lv === 1) {
      // bucket on the ground, a little rope pile, a rock
      v.box(hx - 4, 1, hz - 4, hx - 2, 3, hz - 2, "woodLight");
      v.put(hx - 4, 2, hz - 4, "water", 0.2);
      rocks(c, -hx + 3, 1, hz - 3, 2, st.stone);
      if (s === 2) tree(v, -hx + 2, 1, -hz + 2, "palm", 1, 1);
      if (s === 3) {
        v.box(hx - 3, 1, -hz + 3, hx - 2, 3, -hz + 4, "white");
        v.cylinderY(hx - 2.5, -hz + 3.5, 3, 4, 1.6, "red");
      }
    }
    if (lv >= 2) {
      bush(v, hx - 3, 1, -hz + 2, 1.3, s === 2 ? "olive" : "leaf", s === 3 ? "pink" : undefined);
      if (s === 2) tree(v, -hx + 2, 1, -hz + 2, "palm", 1.1, 2);
      else if (s === 1) tree(v, -hx + 2, 1, -hz + 2, "blossom", 0.9, 1);
      else tree(v, -hx + 2, 1, -hz + 2, s === 3 ? "oak" : "round", 0.9, 1);
    }
    if (lv === 3) {
      // cast-iron hand pump + stone trough + villager
      v.box(4, 1, 1, 7, 3, 7, st.stone);
      water(v, 5, 2, 2, 6, 3, 6);
      v.box(5, 3, 0, 6, 8, 1, "iron");
      v.box(5, 7, 1, 6, 8, 3, "iron");
      v.box(6, 8, -1, 7, 9, 1, "iron");
      v.put(5, 7, 3, "foam", 0.4);
      person(v, 2, 1, 5, c.pick(SHIRTS), "blueDark");
      v.box(1, 1, 6, 2, 2, 7, "woodLight");
      flowerBed(c, -hx + 1, hz - 2, -hx + 5, hz - 1);
    }
    return;
  }

  if (lv === 4) {
    // Pump house + wind pump
    const bx0 = -hx + 1;
    const bz0 = -hz + 1;
    const wall = ["brick", "woodLight", "sand", "stone"][s];
    v.box(bx0, 1, bz0, bx0 + 8, 7, bz0 + 7, wall);
    windows(c, bx0, 1, bz0, bx0 + 8, 7, bz0 + 7, { h: 2, stepH: 3, emit: 0.45 });
    door(v, bx0 + 3, 1, bz0 + 6, "woodDark");
    if (s === 2) {
      v.box(bx0 - 1, 7, bz0 - 1, bx0 + 9, 8, bz0 + 8, "white");
      v.dome(bx0 + 4, 8, bz0 + 3.5, 3.2, st.roof);
    } else if (s === 3) {
      v.cone(bx0 + 4, 7, 14, bz0 + 3.5, 6, 0.5, st.roof);
      v.put(bx0 + 2, 9, bz0 + 7, "white");
      v.put(bx0 + 6, 10, bz0 + 6, "white");
    } else gable(v, bx0 - 1, 7, bz0 - 1, bx0 + 9, bz0 + 8, "x", st.roof, st.roof2);
    // wind pump tower (lattice) on the right
    const tx = 4;
    const tz = -4;
    for (let y = 1; y < 22; y++) {
      const w = Math.max(1, Math.round(3 - y * 0.1));
      for (const [dx, dz] of [[-w, -w], [w, -w], [-w, w], [w, w]]) v.put(tx + dx, y, tz + dz, "steelDark");
      if (y % 4 === 0) {
        v.box(tx - w, y, tz - w, tx + w + 1, y + 1, tz - w + 1, "steel");
        v.box(tx - w, y, tz + w, tx + w + 1, y + 1, tz + w + 1, "steel");
      }
    }
    v.box(tx - 1, 21, tz - 1, tx + 2, 23, tz + 2, "steelDark");
    v.box(tx, 22, tz - 6, tx + 1, 23, tz - 1, "steelDark");
    v.box(tx, 21, tz - 7, tx + 1, 25, tz - 6, st.roof);
    const rot = new PixelVox();
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      for (let d = 2; d <= 6; d++) {
        rot.put(Math.round(Math.cos(ang) * d) - 0.5, Math.round(Math.sin(ang) * d) - 0.5, 0, d >= 5 && a % 2 === 0 ? "red" : "silver");
      }
    }
    rot.box(-1, -1, 0, 1, 1, 1, "steelDark");
    c.addRotor({ vox: rot, pivot: [tx + 0.5, 22.5, tz + 2], axis: "z", speed: 2.2, wind: true });
    // pipe down to a cistern trough
    v.box(tx, 1, tz + 3, tx + 1, 4, tz + 4, "iron");
    v.box(tx - 2, 1, tz + 4, tx + 4, 3, tz + 8, st.stone);
    water(v, tx - 1, 2, tz + 5, tx + 3, 3, tz + 7);
    v.put(tx, 3, tz + 5, "foam", 0.4);
    // old well still in front
    wellCore(c, -4, 4, 2.5, false, st);
    v.box(-4, 0, 6, -2, 1, hz, st.ground2);
    flowerBed(c, 2, hz - 3, hx - 1, hz - 1);
    return;
  }

  // Lv5 — Sacred Spring Shrine: rocky grotto with a waterfall feeding a holy pool + pavilion
  const rock = s === 2 ? "sandDark" : s === 1 ? "granite" : "stone";
  v.box(-hx, 1, -hz, hx, 10, -hz + 4, rock);
  for (let i = 0; i < 7; i++) v.sphere(-hx + 1 + i * 2.5, 9 + (i % 3), -hz + 2, 2.6, 3 + (i % 2) * 2, 2.4, i % 2 ? rock : "granite");
  for (let i = 0; i < 4; i++) v.sphere(-hx + 1 + i * 4.5, 4, -hz + 4, 2, 3, 1.5, "granite");
  if (s !== 2) for (let x = -hx; x < hx; x++) if (c.rand() < 0.7) v.put(x, 11 + c.ri(0, 2), -hz + 1 + c.ri(0, 2), s === 1 ? "leafDark" : "moss");
  // waterfall pouring out of the cliff
  v.clear(-5, 2, -hz + 3, -1, 12, -hz + 6);
  v.box(-5, 2, -hz + 4, -1, 12, -hz + 5, "water", 0.3);
  v.box(-5, 11, -hz + 2, -1, 12, -hz + 5, "foam", 0.35);
  for (let y = 3; y < 11; y += 2) v.put(-4 + (y % 3), y, -hz + 5, "foam", 0.35);
  // holy pool
  v.cylinderY(-2, 0, 0, 1, 6.2, st.stone2);
  v.cylinderY(-2, 0, 0, 2, 5.2, "water", 0.15);
  ring(v, -2, 0, 1, 2, 6.2, 5.2, st.stone);
  ring(v, -3, -3, 1, 2, 2.2, 0.6, "foam", 0.4);
  for (let i = 0; i < 6; i++) v.put(c.ri(-5, 1), 1, c.ri(-2, 3), "gold", 0.8); // wishing coins
  // small shrine on the right
  for (const [px, pz] of [[3, 1], [6, 1], [3, 5], [6, 5]]) v.box(px, 1, pz, px + 1, 8, pz + 1, s === 1 ? "red" : st.post);
  v.box(3, 1, 1, 7, 2, 6, st.stone);
  v.box(4, 2, 2, 6, 4, 4, st.stone2);
  v.put(4, 4, 2, "gold", 0.8);
  v.put(5, 4, 3, "warmGlow", 1);
  wellRoof(c, 5, 3.5, 1.5, 8, st);
  // lanterns / torii
  if (s === 1) {
    v.box(-7, 1, hz - 2, -6, 9, hz - 1, "red");
    v.box(6, 1, hz - 2, 7, 9, hz - 1, "red");
    v.box(-8, 9, hz - 2, 8, 10, hz - 1, "charcoal");
    v.box(-7, 7, hz - 2, 7, 8, hz - 1, "red");
  } else {
    for (const lx of [-7, 6]) {
      v.box(lx, 1, hz - 2, lx + 1, 4, hz - 1, st.stone);
      v.put(lx, 4, hz - 2, "warmGlow", 1.1);
    }
  }
  person(v, -2, 1, hz - 2, c.pick(SHIRTS), "blueDark");
  person(v, 2, 1, hz - 1, c.pick(SHIRTS), "charcoal");
  if (s === 2) {
    tree(v, -hx + 1, 1, hz - 4, "palm", 1.2, 1);
    tree(v, hx - 2, 1, hz - 5, "palm", 1.1, 2);
  } else if (s === 3) {
    for (const [mx, mz] of [[-7, 3], [6, 2]]) {
      v.box(mx, 1, mz, mx + 1, 3, mz + 1, "white");
      v.cylinderY(mx + 0.5, mz + 0.5, 3, 4, 1.4, "red");
    }
  } else bush(v, hx - 2, 1, 3, 1.2, "leaf", s === 1 ? "pink" : "yellow");
}

// =============================================================================================
// WATER TOWER (1x1 → 2x2, grows TALL)
//  V0 Classic Stilt Tank (steel legs, X-bracing, cone roof, H2O lettering)
//  V1 Mushroom Concrete (fluted stem, flared bowl, teal stripe; Lv5 adds sky-restaurant ring)
//  V2 Wooden Barrel (cedar staves, iron hoops, timber trestle, railroad spout)
//  V3 Futuristic Sphere (white column, glass globe with glowing ring; Lv5 twin-sphere)
// =============================================================================================
function buildWaterTower(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const big = Math.min(hx, hz) >= 16;
  lot(c, s === 3 ? "concrete2" : "grass2");
  speckle(c, s === 3 ? "concrete" : "grass3", 0.1);
  const legH = [8, 14, 20, 30, 42][lv - 1];
  const tH = [6, 7, 8, 10, 12][lv - 1];
  const r = big ? (lv >= 5 ? 9 : 8) : Math.min(hx, hz) - [3.5, 3, 2.5, 2.5, 2.5][lv - 1];
  const cx = 0;
  const cz = big ? -1 : 0;
  let topY = legH + tH;

  if (s === 0) {
    const leg = Math.floor(r * 0.75);
    for (const [dx, dz] of [[-leg, -leg], [leg - 1, -leg], [-leg, leg - 1], [leg - 1, leg - 1]]) {
      v.box(cx + dx, 1, cz + dz, cx + dx + 1, legH, cz + dz + 1, "steelDark");
      v.box(cx + dx - 1, 1, cz + dz - 1, cx + dx + 2, 2, cz + dz + 2, "concreteDark");
    }
    // X bracing on the 4 faces
    for (let y0 = 3; y0 + 4 < legH; y0 += 6) {
      for (let k = 0; k <= 2 * leg - 1; k++) {
        const yy = y0 + Math.round((k / (2 * leg - 1)) * 5);
        const yy2 = y0 + 5 - Math.round((k / (2 * leg - 1)) * 5);
        for (const zz of [cz - leg, cz + leg - 1]) {
          v.put(cx - leg + k, yy, zz, "steel");
          v.put(cx - leg + k, yy2, zz, "steel");
        }
        for (const xx of [cx - leg, cx + leg - 1]) {
          v.put(xx, yy, cz - leg + k, "steel");
          v.put(xx, yy2, cz - leg + k, "steel");
        }
      }
    }
    v.box(cx - 1, 1, cz - 1, cx + 1, legH, cz + 1, "steel"); // riser
    // catwalk
    ring(v, cx, cz, legH, legH + 1, r + 1, r - 1, "steelDark");
    ring(v, cx, cz, legH + 1, legH + 2, r + 1, r + 0.2, "steelLight");
    // tank
    v.cylinderY(cx, cz, legH, legH + 2, r - 1.5, "sky");
    v.cylinderY(cx, cz, legH + 1, legH + tH, r, "sky");
    v.cylinderY(cx, cz, legH + tH - 2, legH + tH - 1, r, "white");
    if (r >= 6) cylText(v, "H2O", cx, cz, r, legH + tH - 3, "blueDark");
    else {
      cylText(v, "H", cx, cz, r, legH + tH - 3, "blueDark");
    }
    v.cone(cx, legH + tH, legH + tH + Math.ceil(r * 0.6), cz, r + 0.6, 0.6, "steelLight");
    topY = legH + tH + Math.ceil(r * 0.6);
    v.box(cx, topY, cz, cx + 1, topY + 2, cz + 1, "steelDark");
    topY += 2;
    // ladder
    v.box(cx + leg, 1, cz + leg, cx + leg + 1, legH, cz + leg + 1, "iron");
  } else if (s === 1) {
    const stemR = 1.6 + lv * 0.25;
    for (let y = 1; y < legH; y++) {
      const t = y / legH;
      const rr = stemR * (1.2 - 0.25 * t);
      v.cylinderY(cx, cz, y, y + 1, rr, y % 6 === 0 ? "concreteDark" : "concrete");
    }
    // fluting
    for (let y = 2; y < legH - 1; y++) if (y % 2) v.put(cx, y, cz + Math.ceil(stemR), "concreteDark");
    // flared bowl
    const flare = Math.round(r * 0.8);
    for (let k = 0; k < flare; k++) {
      const rr = stemR + ((r - stemR) * (k + 1)) / flare;
      v.cylinderY(cx, cz, legH + k, legH + k + 1, rr, "white");
    }
    v.cylinderY(cx, cz, legH + flare, legH + flare + tH - 2, r, "white");
    v.cylinderY(cx, cz, legH + flare + 1, legH + flare + 3, r + 0.2, "teal");
    if (r >= 6) cylText(v, "H2O", cx, cz, r + 0.2, legH + flare + tH - 3, "tealDark");
    v.dome(cx, legH + flare + tH - 2, cz, r * 0.75, "white");
    topY = legH + flare + tH - 2 + Math.ceil(r * 0.75);
    if (lv >= 3) {
      // door + windows on stem
      door(v, cx - 1, 1, cz + Math.ceil(stemR * 1.2) - 1, "tealDark");
      for (let y = 6; y < legH - 2; y += 4) v.put(cx, y, cz + Math.ceil(stemR * 1.2) - 1, "glass", 0.5);
    }
  } else if (s === 2) {
    // timber trestle
    const leg = Math.floor(r * 0.8);
    for (const [dx, dz] of [[-leg, -leg], [leg - 1, -leg], [-leg, leg - 1], [leg - 1, leg - 1]]) {
      v.box(cx + dx, 1, cz + dz, cx + dx + 1, legH, cz + dz + 1, "woodDark");
    }
    for (let y = 4; y < legH; y += 5) {
      v.box(cx - leg, y, cz - leg, cx + leg, y + 1, cz - leg + 1, "wood");
      v.box(cx - leg, y, cz + leg - 1, cx + leg, y + 1, cz + leg, "wood");
      v.box(cx - leg, y, cz - leg, cx - leg + 1, y + 1, cz + leg, "wood");
      v.box(cx + leg - 1, y, cz - leg, cx + leg, y + 1, cz + leg, "wood");
    }
    v.box(cx - leg - 1, legH - 1, cz - leg - 1, cx + leg + 1, legH, cz + leg + 1, "woodDark");
    // barrel
    for (let y = legH; y < legH + tH; y++) {
      const bulge = 0.5 * Math.sin(((y - legH + 0.5) / tH) * Math.PI);
      ring(v, cx, cz, y, y + 1, r + bulge, 0, "woodLight");
    }
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      if (a % 2) v.box(Math.floor(cx + Math.cos(ang) * (r + 0.1)), legH, Math.floor(cz + Math.sin(ang) * (r + 0.1)), Math.floor(cx + Math.cos(ang) * (r + 0.1)) + 1, legH + tH, Math.floor(cz + Math.sin(ang) * (r + 0.1)) + 1, "wood");
    }
    for (const hy of [legH + 1, legH + Math.floor(tH / 2), legH + tH - 2]) ring(v, cx, cz, hy, hy + 1, r + 0.6, r - 0.4, "iron");
    v.cone(cx, legH + tH, legH + tH + Math.ceil(r * 0.9), cz, r + 1.2, 0.5, "woodDark");
    topY = legH + tH + Math.ceil(r * 0.9);
    // railroad spout arm
    v.box(cx + Math.floor(r) - 1, legH + 1, cz, cx + Math.floor(r) + 4, legH + 3, cz + 2, "steelDark");
    v.box(cx + Math.floor(r) + 3, legH - 3, cz, cx + Math.floor(r) + 4, legH + 1, cz + 2, "iron");
    v.box(cx - 1, 1, cz - 1, cx + 1, legH, cz + 1, "iron");
    if (lv >= 3) {
      // ladder up the side
      v.box(cx - leg - 1, 1, cz, cx - leg, legH + tH, cz + 1, "woodDark");
    }
  } else {
    const colR = 1.2 + lv * 0.2;
    v.cylinderY(cx, cz, 1, legH, colR, "white");
    v.cylinderY(cx, cz, 1, 3, colR + 1.5, "silver");
    for (let y = 4; y < legH; y += 5) v.put(cx, y, cz + Math.ceil(colR), "screenCyan", 0.8);
    const sr = r * 1.05;
    const scy = legH + sr - 1;
    v.sphere(cx, scy, cz, sr, sr, sr, "white");
    // glass band + glowing ring
    for (let y = Math.round(scy - 1); y < Math.round(scy + 2); y++) ring(v, cx, cz, y, y + 1, sr + 0.1, sr - 1.2, "glass", 0.5);
    ring(v, cx, cz, Math.round(scy - 2), Math.round(scy - 1), sr + 0.8, sr - 0.5, "screenCyan", 0.9);
    topY = Math.round(scy + sr);
    v.box(cx, topY, cz, cx + 1, topY + 4 + lv, cz + 1, "silver");
    topY += 4 + lv;
    c.blink(cx, topY, cz, "cyan");
    if (lv >= 5) {
      // twin smaller sphere tower
      const tx = -hx + 4;
      const tz = hz - 4;
      v.cylinderY(tx, tz, 1, 26, 1, "white");
      v.sphere(tx, 28, tz, 3.4, 3.4, 3.4, "white");
      ring(v, tx, tz, 28, 29, 3.6, 2.2, "screenCyan", 0.9);
      v.box(tx, 31, tz, tx + 1, 36, tz + 1, "silver");
      c.blink(tx, 36, tz, "cyan");
    }
  }

  // Level extras
  if (lv >= 3) c.blink(cx, topY, cz, "red");
  if (lv >= 2 && !big) {
    bush(v, -hx + 1, 1, hz - 2, 1.1, "leaf");
    fence(v, -hx, -hz, hx, hz, 1, 2, s === 2 ? "woodDark" : "steelLight", [-2, 2]);
  }
  if (big) {
    // pump house + fence + service van
    const px0 = hx - 9;
    const pz0 = hz - 8;
    const wall = ["brick", "concrete", "wood", "white"][s];
    v.box(px0, 1, pz0, hx - 2, 6, hz - 2, wall);
    windows(c, px0, 1, pz0, hx - 2, 6, hz - 2, { stepH: 3, emit: 0.45 });
    if (s === 3) flatRoof(c, px0, 6, pz0, hx - 2, hz - 2, "silver", "screenCyan", false);
    else gable(v, px0 - 1, 6, pz0 - 1, hx - 1, hz - 1, "x", ["slate", "teal", "woodDark", "silver"][s]);
    v.box(px0 + 2, 1, hz - 3, px0 + 4, 4, hz - 2, "woodDark");
    car(v, -hx + 5, 1, hz - 3, "x", ["white", "teal", "red", "silver"][s]);
    v.box(-hx + 1, 0, hz - 6, px0, 1, hz - 1, "asphalt");
    securityFence(v, -hx, -hz, hx, hz, 1, 3, [-hx + 2, -hx + 9]);
    if (lv >= 5) {
      for (const [lx, lz] of [[-hx + 2, -hz + 2], [hx - 3, -hz + 2]]) {
        v.box(lx, 1, lz, lx + 1, 10, lz + 1, "iron");
        v.box(lx - 1, 10, lz, lx + 2, 11, lz + 1, "warmGlow", 1.2);
      }
      if (s !== 3) flag(v, -hx + 2, 1, hz - 9, 12, ["red", "white", "blue"]);
      if (s === 1) {
        // sky-restaurant ring of windows
        const y = legH + Math.round(r * 0.8) + 3;
        ring(v, cx, cz, y, y + 2, r + 0.4, r - 1, "glass", 0.6);
      }
    }
  }
}

// =============================================================================================
// WATER PLAZA (fountain plaza → grand cascade)
//  V0 Baroque Marble (tiered bowls, statue, Trevi-style cascade wall)
//  V1 Moorish Tile Court (octagonal star pools, blue/white tiles, rills, orange trees)
//  V2 Modern Splash Park (grid of pop jets, colourful pads, playful sculptures)
//  V3 Italian Garden Terraces (hedges, mossy stone, stepped water staircase, cypresses)
// =============================================================================================
function buildWaterPlaza(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  const pave = ["limestone", "white", "concrete", "path"][s];
  const border = ["marbleShade", "blue", "teal", "stone"][s];
  const rim = ["marble", "#2f6fb8", "white", "stone"][s];
  lot(c, s === 3 ? "grass2" : pave);
  plaza(v, -hx, -hz, hx, hz, pave, border);
  if (s === 1) for (let x = -hx + 1; x < hx - 1; x++) for (let z = -hz + 1; z < hz - 1; z++) if ((x + z) % 4 === 0 && (x - z) % 4 === 0) v.put(x, 0, z, "sky");
  if (s === 2) for (let i = 0; i < 18 + lv * 6; i++) v.cylinderY(c.ri(-hx + 2, hx - 2), c.ri(-hz + 2, hz - 2), 0, 1, 1.4, c.pick(["yellow", "pink", "sky", "lime", "orange"]));
  if (s === 3) {
    v.box(-hx + 2, 0, -hz + 2, hx - 2, 1, hz - 2, "path");
    hedge(v, -hx, -hz, hx, -hz + 1, 1, 2);
    hedge(v, -hx, -hz, -hx + 1, hz, 1, 2);
    hedge(v, hx - 1, -hz, hx, hz, 1, 2);
  }

  const cx = 0;
  const cz = lv >= 5 ? Math.min(2, hz - 9) : lv >= 3 ? 0 : 0;
  const R = [3.5, 5, 6, 6.5, 7.5][lv - 1];

  // ---- main fountain ----
  const mainFountain = (fx: number, fz: number, rr: number, tiers: number): void => {
    if (s === 1) {
      // octagonal star pool (two rotated squares)
      const k = Math.round(rr);
      v.box(fx - k, 1, fz - k, fx + k, 2, fz + k, rim);
      for (let d = 0; d <= k + 1; d++) v.box(fx - (k + 1 - d), 1, fz - d, fx + (k + 1 - d), 2, fz + d, rim), v.box(fx - (k + 1 - d), 1, fz + d - 1, fx + (k + 1 - d), 2, fz - d + 1, rim);
      v.box(fx - k + 1, 1, fz - k + 1, fx + k - 1, 2, fz + k - 1, "water", 0.15);
      for (let d = 0; d < k; d++) v.box(fx - (k - d), 1, fz - d, fx + (k - d), 2, fz + d, "water", 0.15);
      v.cylinderY(fx, fz, 1, 4, 1.4, "white");
      v.cylinderY(fx, fz, 4, 5, 2.2, rim);
      v.cylinderY(fx, fz, 4, 5, 1.4, "water", 0.2);
      if (tiers >= 2) jet(v, fx, 5, fz, 2 + tiers);
      return;
    }
    if (s === 2) {
      // flush splash pad with ring of pop jets
      v.cylinderY(fx, fz, 0, 1, rr, "sky");
      ring(v, fx, fz, 0, 1, rr, rr - 1, "white");
      const n = 4 + tiers * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        jet(v, Math.floor(fx + Math.cos(a) * (rr - 2)), 1, Math.floor(fz + Math.sin(a) * (rr - 2)), 2 + ((i + tiers) % 3));
      }
      jet(v, fx, 1, fz, 4 + tiers * 2);
      return;
    }
    // tiered bowls (baroque / garden)
    ring(v, fx, fz, 1, 3, rr, rr - 1, rim);
    v.cylinderY(fx, fz, 1, 2, rr - 1, "water", 0.15);
    let y = 2;
    let br = rr * 0.55;
    for (let t = 0; t < tiers; t++) {
      v.cylinderY(fx, fz, y, y + 3, 0.8, rim);
      y += 3;
      v.cylinderY(fx, fz, y, y + 1, br, rim);
      v.cylinderY(fx, fz, y + 1, y + 2, br, rim);
      v.cylinderY(fx, fz, y + 1, y + 2, br - 1, "water", 0.2);
      // dribbles
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ex = Math.floor(fx + dx * (br + 0.2));
        const ez = Math.floor(fz + dz * (br + 0.2));
        v.box(ex, Math.max(2, y - 2), ez, ex + 1, y + 1, ez + 1, "foam", 0.3);
      }
      y += 2;
      br *= 0.6;
      if (br < 1.2) break;
    }
    if (s === 0 && tiers >= 2) {
      // statue on top
      v.box(fx - 1, y, fz, fx + 1, y + 1, fz + 1, rim);
      v.box(fx, y + 1, fz, fx + 1, y + 4, fz + 1, "marbleShade");
      v.put(fx - 1, y + 3, fz, "marbleShade");
      v.put(fx + 1, y + 4, fz, "gold", 0.5);
    } else jet(v, fx, y, fz, 2);
  };

  mainFountain(cx, cz, R, Math.min(3, lv));

  // ---- surroundings by level ----
  const benches = (z: number) => {
    bench(v, -hx + 2, 1, z, "x", s === 2 ? "orange" : "wood");
    bench(v, hx - 5, 1, z, "x", s === 2 ? "sky" : "wood");
  };
  if (lv === 1) {
    benches(hz - 2);
    lamp(v, -hx + 1, 1, -hz + 1, 5);
    tree(v, hx - 3, 1, -hz + 3, s === 1 ? "fruit" : s === 3 ? "cypress" : "round", 0.9, 1);
    crowd(c, -6, 4, 6, hz - 1, 2);
  }
  if (lv >= 2) {
    benches(hz - 2);
    for (const tx of [-hx + 3, hx - 4]) {
      tree(v, tx, 1, -hz + 3, s === 1 ? "fruit" : s === 3 ? "cypress" : s === 2 ? "birch" : "round", 1, tx > 0 ? 1 : 2);
    }
    lamp(v, -hx + 1, 1, hz - 1, 5);
    lamp(v, hx - 2, 1, hz - 1, 5);
    crowd(c, -hx + 2, -hz + 2, hx - 2, hz - 2, 3 + lv);
  }
  if (lv >= 3) {
    // four corner satellite pools / jets
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const sx = Math.round(dx * (hx - 5));
      const sz = Math.round(dz * (hz - 5));
      if (s === 2) jet(v, sx, 1, sz, 3);
      else {
        ring(v, sx, sz, 1, 2, 2.2, 1.2, rim);
        v.cylinderY(sx, sz, 1, 2, 1.2, "water", 0.2);
        v.box(sx, 2, sz, sx + 1, 4, sz + 1, "foam", 0.3);
      }
    }
    if (s === 1) {
      // rills crossing the court
      v.box(-hx + 1, 0, cz, hx - 1, 1, cz + 1, "water", 0.2);
      v.box(cx, 0, -hz + 1, cx + 1, 1, hz - 1, "water", 0.2);
    }
    if (s !== 2) {
      flowerBed(c, -hx + 2, hz - 5, -hx + 6, hz - 3);
      flowerBed(c, hx - 6, hz - 5, hx - 2, hz - 3);
    }
  }
  if (lv >= 4) {
    // musical jet line along the front with coloured lights
    const cols = ["magenta", "cyan", "yellow", "lime", "sky", "pink"];
    for (let x = -hx + 4, i = 0; x < hx - 4; x += 3, i++) {
      v.put(x, 0, hz - 6, cols[i % cols.length], 1.2);
      jet(v, x, 1, hz - 6, 2 + Math.round(2 + 2 * Math.sin(i * 0.9)));
    }
  }
  if (lv >= 5) {
    // Grand cascade at the back
    const z0 = -hz + 1;
    const steps = 5;
    const wx = Math.min(hx - 3, 14);
    const wall = ["marble", "white", "concrete", "stone"][s];
    for (let k = 0; k < steps; k++) {
      const y = 2 + (steps - k) * 2;
      v.box(-wx + k, 1, z0 + k * 2, wx - k, y, z0 + k * 2 + 2, wall);
      v.box(-wx + k + 1, y - 1, z0 + k * 2, wx - k - 1, y, z0 + k * 2 + 2, "water", 0.25);
      v.box(-wx + k + 1, y - 2, z0 + k * 2 + 2, wx - k - 1, y - 1, z0 + k * 2 + 3, "foam", 0.35);
    }
    const yTop = 2 + steps * 2;
    if (s === 0) {
      // Trevi-style palazzo facade with statue niche
      v.box(-wx, yTop, z0, wx, yTop + 10, z0 + 2, "marble");
      for (let x = -wx + 1; x < wx; x += 4) column(v, x, z0 + 2, yTop, yTop + 9, "marble", "marbleShade");
      v.box(-wx, yTop + 9, z0, wx, yTop + 10, z0 + 3, "marbleShade");
      archway(v, 0, yTop + 1, z0 + 1, z0 + 2, 5, 7, "gold");
      v.box(-1, yTop, z0, 1, yTop + 6, z0 + 1, "marbleShade");
      v.box(-1, yTop + 6, z0, 1, yTop + 7, z0 + 1, "gold", 0.4);
    } else if (s === 1) {
      for (let x = -wx; x < wx; x += 4) {
        v.box(x, yTop, z0, x + 3, yTop + 6, z0 + 2, "white");
        archway(v, x + 1.5, yTop, z0, z0 + 2, 2, 4);
        v.box(x, yTop + 6, z0, x + 3, yTop + 7, z0 + 2, "#2f6fb8");
      }
    } else if (s === 2) {
      // big arc of rainbow jets + curved sculpture
      for (let i = 0; i < 9; i++) jet(v, -wx + 2 + i * 3, yTop, z0 + 1, 3 + (i % 3) * 2);
      v.ringZ(0, yTop + 4, z0 + 3, z0 + 4, 6, 5, "orange");
    } else {
      for (const x of [-wx, wx - 1]) tree(v, x, yTop, z0, "cypress", 1.3, 1);
      v.box(-3, yTop, z0, 3, yTop + 5, z0 + 2, "stone");
      v.box(-2, yTop + 4, z0 + 2, 2, yTop + 5, z0 + 3, "moss");
      v.box(-1, yTop + 1, z0 + 2, 1, yTop + 4, z0 + 3, "foam", 0.3);
    }
    for (let x = -hx + 2; x < hx - 2; x += 6) {
      v.box(x, 1, hz - 2, x + 1, 6, hz - 1, "iron");
      v.put(x, 6, hz - 2, "warmGlow", 1.2);
    }
    crowd(c, -hx + 2, hz - 8, hx - 2, hz - 2, 8);
  }
}

// =============================================================================================
// WATER PUMPING STATION (coast: intake pier into the sea along -z)
//  V0 Victorian Steam Pump House (brick, arched windows, tall chimney w/ smoke)
//  V1 Art Deco Pump Palace (cream w/ teal bands, stepped tower)
//  V2 Modern Industrial (blue steel sheds, giant blue pipes, surge tanks)
//  V3 Dutch Polder Mill (thatched windmill pumps w/ spinning sails)
// =============================================================================================
function buildPumping(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, s === 3 ? "grass2" : "concrete2");
  speckle(c, s === 3 ? "grass3" : "concrete", 0.08);
  const zs = seaBack(c, hz >= 16 ? 6 : 4, s === 3 ? "stone" : "concreteDark");
  // intake pier & screen house
  const px = -hx + 4;
  v.box(px - 2, 1, -hz, px + 2, 2, zs, s === 3 ? "wood" : "concrete");
  for (let z = -hz; z < zs; z += 3) v.box(px - 2, 0, z, px - 1, 1, z + 1, "woodDark");
  v.box(px - 2, 2, -hz, px + 2, 5, -hz + 3, s === 2 ? "blue" : s === 3 ? "woodDark" : "steelDark");
  v.box(px - 2, 5, -hz, px + 2, 6, -hz + 3, "charcoal");
  pipe(v, "z", -hz + 3, zs + 3, 2, px - 1, s === 2 ? "blue" : s === 0 ? "iron" : "steel");

  const wall = ["brick", "cream", "steelLight", "woodLight"][s];
  const roofC = ["slate", "tealDark", "blue", "#c9a85a"][s];
  const bz0 = zs + 2;
  const bz1 = Math.min(hz - 2, bz0 + (lv >= 3 ? 12 : 8));
  const bx0 = -hx + 8;
  const bw = [9, 12, 12, 14, 18][lv - 1];
  const bx1 = Math.min(hx - 1, bx0 + bw);
  const fh = [6, 8, 8, 9, 11][lv - 1];

  if (s === 3) {
    // Dutch windmill(s): octagonal tapering tower + thatch cap + sails rotor
    const mills: [number, number, number][] = [[bx0 + 6, Math.floor((bz0 + bz1) / 2), 14 + lv * 3]];
    if (lv >= 5) mills.push([hx - 8, hz - 8, 18]);
    for (const [mx, mz, mh] of mills) {
      for (let y = 1; y < mh; y++) {
        const rr = 4.5 - (y / mh) * 1.8;
        v.cylinderY(mx, mz, y, y + 1, rr, y < 5 ? "brick" : "woodLight");
      }
      v.box(mx - 5, 6, mz - 5, mx + 5, 7, mz + 5, "woodDark"); // stage
      v.cone(mx, mh, mh + 5, mz, 3.4, 1, "#c9a85a");
      door(v, mx - 1, 1, mz + 3, "red");
      for (let y = 8; y < mh - 2; y += 4) v.put(mx, y, mz + 3, "glass", 0.5);
      const rot = new PixelVox();
      const L = Math.min(12, mh - 4);
      for (let d = 1; d <= L; d++) {
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          rot.put(ax * d, ay * d, 0, "woodDark");
          if (d > 2) {
            const ox = ay !== 0 ? 1 : 0;
            const oy = ax !== 0 ? -1 : 0;
            rot.put(ax * d + ox, ay * d + oy, 0, d % 2 ? "white" : "red");
            rot.put(ax * d + ox * 2, ay * d + oy * 2, 0, d % 2 ? "white" : "red");
          }
        }
      }
      rot.box(-1, -1, 0, 2, 2, 1, "woodDark");
      c.addRotor({ vox: rot, pivot: [mx + 0.5, mh + 1.5, mz + 4], axis: "z", speed: 0.9, wind: true });
    }
    // pump channel feeding into a canal
    v.box(-hx, 0, bz1 + 1, hx, 1, bz1 + 3, "water", 0.12);
    if (lv >= 2) {
      // water wheel / archimedes screw house
      const wx = hx - 5;
      const wz = bz0 + 2;
      v.box(wx - 3, 1, wz - 2, wx + 3, 6, wz + 2, "brick");
      gable(v, wx - 4, 6, wz - 3, wx + 4, wz + 3, "x", "#c9a85a");
      const wheel = new PixelVox();
      wheel.ringZ(0, 0, 0, 1, 4, 3, "woodDark");
      for (let a = 0; a < 8; a++) wheel.put(Math.round(Math.cos(a * 0.785) * 2.5), Math.round(Math.sin(a * 0.785) * 2.5), 0, "wood");
      c.addRotor({ vox: wheel, pivot: [wx, 4, wz + 3], axis: "z", speed: -1 });
    }
    if (lv >= 3) {
      tree(v, -hx + 2, 1, hz - 2, "willow", 1, 1);
      for (let i = 0; i < 5; i++) v.box(-hx + 4 + i * 2, 1, hz - 2, -hx + 5 + i * 2, 3, hz - 1, c.pick(["red", "yellow", "pink", "orange"]));
    }
    if (lv >= 4) crowd(c, -hx + 2, bz0, -hx + 8, bz1, 2);
    return;
  }

  // Main pump hall
  v.box(bx0, 1, bz0, bx1, 1 + fh, bz1, wall);
  if (s === 0) {
    v.box(bx0, 1, bz0, bx1, 2, bz1, "brickDark");
    for (let x = bx0 + 2; x < bx1 - 2; x += 3) {
      v.box(x, 3, bz1 - 1, x + 2, fh - 1, bz1, "glass", 0.5);
      v.put(x, fh - 1, bz1 - 1, "limestone");
      v.put(x + 1, fh - 1, bz1 - 1, "limestone");
    }
    gable(v, bx0 - 1, 1 + fh, bz0 - 1, bx1 + 1, bz1 + 1, "x", roofC, "limestone");
    const ch = smokestack(v, bx1 - 3, bz0 + 2, 1, fh + 10 + lv * 3, 1.4, "brickDark", "limestone");
    c.smoke(bx1 - 3, ch, bz0 + 2, "smoke");
  } else if (s === 1) {
    for (let y = 3; y < fh; y += 3) v.box(bx0, y, bz0, bx1, y + 1, bz1, "teal");
    for (let x = bx0 + 2; x < bx1 - 2; x += 3) v.box(x, 2, bz1 - 1, x + 1, fh, bz1, "glass", 0.45);
    v.box(bx0 - 1, 1 + fh, bz0 - 1, bx1 + 1, 2 + fh, bz1 + 1, "tealDark");
    // stepped deco tower
    const tx = bx0 + 1;
    const th = fh + 6 + lv * 2;
    v.box(tx, 1, bz1 - 5, tx + 5, th, bz1, "cream");
    v.box(tx + 1, th, bz1 - 4, tx + 4, th + 3, bz1 - 1, "cream");
    v.box(tx + 2, th + 3, bz1 - 3, tx + 3, th + 7, bz1 - 2, "gold", 0.4);
    v.box(tx + 2, 3, bz1 - 1, tx + 3, th - 1, bz1, "screenCyan", 0.7);
    if (lv >= 3) clockFace(v, tx + 2, th - 3, bz1, 1, "white", "tealDark");
  } else {
    for (let x = bx0; x < bx1; x += 2) v.box(x, 1, bz1 - 1, x + 1, 1 + fh, bz1, "steel");
    ribbonGlass(c, bx0, fh - 2, bz1, bx1);
    barrelRoof(v, bx0, 1 + fh, bz0, bx1, bz1, "x", "blue", "blueDark");
  }
  door(v, bx0 + 3, 1, bz1 - 1, s === 0 ? "woodDark" : "charcoal", 3, 4);

  // big pipes from hall out of the plant (the city side, +x)
  const pc = ["iron", "teal", "blue", "steel"][s];
  pipe(v, "x", bx1, hx, 2, bz0 + 2, pc);
  if (lv >= 2) pipe(v, "x", bx1, hx, 2, bz0 + 5, pc);
  if (lv >= 3) {
    // surge tower / standpipe
    const sx = hx - 4;
    const sz = bz0 + 3;
    const tcol = ["brick", "cream", "white", "brick"][s];
    v.cylinderY(sx, sz, 1, 18 + lv * 2, 2.6, tcol);
    v.cylinderY(sx, sz, 18 + lv * 2, 20 + lv * 2, 3.2, s === 2 ? "blue" : "limestone");
    if (s === 0) v.cone(sx, 20 + lv * 2, 26 + lv * 2, sz, 3, 0.3, "slate");
    c.blink(sx, 26 + lv * 2, sz, "red");
  }
  if (lv >= 4) {
    // transformer yard + second hall
    const tx0 = -hx + 1;
    const tz0 = Math.min(hz - 8, bz1 + 1);
    v.box(tx0, 0, tz0, tx0 + 7, 1, hz - 1, "path2");
    for (let i = 0; i < 2; i++) {
      v.box(tx0 + 1 + i * 3, 1, tz0 + 2, tx0 + 3 + i * 3, 4, tz0 + 4, "steelDark");
      v.put(tx0 + 1 + i * 3, 4, tz0 + 2, "silver");
    }
    if (hz >= 16) {
      v.box(bx0, 0, bz1 + 1, hx - 7, 1, hz, "asphalt");
      truck(v, bx0 + 6, 1, hz - 3, "x", "white", s === 2 ? "blue" : "red");
    }
  }
  if (lv >= 5) {
    for (let i = 0; i < 3; i++) v.box(bx0 + 2 + i * 4, 2 + fh + 4, bz0 + 3, bx0 + 4 + i * 4, 4 + fh + 4, bz0 + 5, "steelDark");
    flag(v, bx0, 2 + fh + 6, bz1 - 1, 6, ["blue", "white", "blue"]);
    for (const lx of [bx0 - 1, bx1]) lamp(v, lx, 1, hz - 1, 6);
  }
}

function ribbonGlass(c: Ctx, x0: number, y: number, z1: number, x1: number): void {
  c.v.box(x0 + 1, y, z1 - 1, x1 - 1, y + 2, z1, "glass", 0.4);
}

// =============================================================================================
// MUNICIPAL RESERVOIR
//  V0 Victorian Stone Basin (granite embankment, gothic valve tower w/ turrets)
//  V1 Concrete Arch Dam (curved grey dam face, spillway gates, modern intake)
//  V2 Earthen Nature Reservoir (grassy dikes, reeds, sailboats, fishermen)
//  V3 Classical Water Temple (balustraded basin, domed rotunda valve house)
// =============================================================================================
function buildReservoir(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.1);
  const emb = ["granite", "concrete", "grass", "marble"][s];
  const emb2 = ["stone", "concreteDark", "leaf", "marbleShade"][s];
  const eh = [3, 4, 6, 7, 8][lv - 1];
  const front = lv >= 3 ? 8 : 4; // space at +z for the dam face/spillway
  const x0 = -hx + 2;
  const x1 = hx - 2;
  const z0 = -hz + 2;
  const z1 = hz - front;

  const inset = s === 2 ? Math.ceil(eh / 2) + 1 : 2;
  if (s === 2) {
    // Broad toes below a narrow maintenance path, with an earthen slope visible on all four sides.
    for (let k = 0; k < eh; k++) {
      const step = Math.floor(k / 2);
      const crest = k === eh - 1;
      const turf = crest ? "path2" : k % 2 ? "grass2" : "grass";
      v.box(x0 + step, 1 + k, z0 + step, x1 - step, 2 + k, z0 + inset, turf);
      v.box(x0 + step, 1 + k, z1 - inset, x1 - step, 2 + k, z1 - step, turf);
      v.box(x0 + step, 1 + k, z0 + inset, x0 + inset, 2 + k, z1 - inset, turf);
      v.box(x1 - inset, 1 + k, z0 + inset, x1 - step, 2 + k, z1 - inset, turf);
    }
    water(v, x0 + inset, eh - 1, z0 + inset, x1 - inset, eh, z1 - inset);
  } else {
    v.box(x0, 1, z0, x1, eh + 1, z1, emb);
    v.clear(x0 + 2, 2, z0 + 2, x1 - 2, eh + 1, z1 - 2);
    water(v, x0 + 2, 1, z0 + 2, x1 - 2, eh, z1 - 2, s === 3 ? "cyan" : "water");
    v.box(x0, eh, z0, x1, eh + 1, z0 + 1, emb2);
    v.box(x0, eh, z1 - 1, x1, eh + 1, z1, emb2);
    v.box(x0, eh, z0, x0 + 1, eh + 1, z1, emb2);
    v.box(x1 - 1, eh, z0, x1, eh + 1, z1, emb2);
    if (s === 3) {
      // balustrade
      for (let x = x0; x < x1; x += 2) {
        v.put(x, eh + 1, z1 - 1, "marble");
        v.put(x, eh + 1, z0, "marble");
      }
      v.box(x0, eh + 2, z1 - 1, x1, eh + 3, z1, "marble");
    }
  }
  // ripples
  for (let i = 0; i < 6 + lv * 3; i++) v.put(c.ri(x0 + inset, x1 - inset - 1), eh - 1, c.ri(z0 + inset, z1 - inset - 1), "foam", 0.2);

  // Dam face + spillway at the front (+z) for Lv3+
  if (lv >= 3) {
    const dz0 = z1;
    const dz1 = hz - 1;
    const sw = lv >= 5 ? 5 : 4;
    if (s === 1) {
      // curved concrete arch dam bulging forward
      for (let x = x0; x < x1; x++) {
        const t = (x + 0.5) / (x1 - x0);
        const bulge = Math.round(3 * (1 - (t * 2) ** 2));
        v.box(x, 1, dz0 - 1, x + 1, eh + 1, dz0 + 1 + Math.max(0, bulge), "concrete");
      }
      v.box(x0, eh + 1, dz0 - 1, x1, eh + 2, dz0, "concreteDark");
    } else {
      v.box(x0, 1, dz0 - 1, x1, eh + 1, dz0 + 1, emb);
    }
    // spillway steps with white water
    for (let k = 0; k < eh; k++) {
      v.box(-sw, 1, dz0 + k, sw, eh - k + 1, dz0 + k + 1, emb2);
      v.box(-sw + 1, eh - k, dz0 + k, sw - 1, eh - k + 1, dz0 + k + 1, "foam", 0.35);
    }
    water(v, -sw - 2, 0, dz1 - 2, sw + 2, 1, dz1 + 1);
    // outflow river to the front edge
    v.box(-sw, 0, dz0, sw, 1, hz, "water", 0.12);
    // gates over spillway
    for (let x = -sw + 1; x < sw - 1; x += 2) v.box(x, eh + 1, dz0 - 1, x + 1, eh + 4, dz0, s === 1 ? "hazard" : "iron");
    v.box(-sw, eh + 4, dz0 - 1, sw, eh + 5, dz0, s === 1 ? "concreteDark" : emb2);
  }

  // Intake / valve tower in the water with a footbridge to the bank
  if (lv >= 2) {
    const tx = Math.floor(x1 - (x1 - x0) * 0.3);
    const tz = Math.floor(z0 + (z1 - z0) * 0.4);
    const th = eh + [0, 8, 10, 12, 16][lv - 1];
    if (s === 0) {
      v.box(tx - 3, 1, tz - 3, tx + 3, th, tz + 3, "granite");
      windows(c, tx - 3, eh, tz - 3, tx + 3, th, tz + 3, { stepV: 4, h: 2, emit: 0.45 });
      for (const [dx, dz] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) {
        v.box(tx + dx, th, tz + dz, tx + dx + 1, th + 3, tz + dz + 1, "stone");
        v.box(tx + dx, th + 3, tz + dz, tx + dx + 1, th + 5, tz + dz + 1, "slate");
      }
      hip(v, tx - 3, th, tz - 3, tx + 3, tz + 3, "slate");
    } else if (s === 1) {
      v.cylinderY(tx, tz, 1, th, 2.5, "concrete");
      v.cylinderY(tx, tz, th, th + 2, 3.2, "concreteDark");
      v.box(tx - 1, th + 2, tz - 1, tx + 1, th + 6, tz + 1, "steelDark");
      c.blink(tx, th + 6, tz, "red");
    } else if (s === 2) {
      v.box(tx - 2, 1, tz - 2, tx + 2, th - 3, tz + 2, "stone");
      v.box(tx - 3, th - 3, tz - 3, tx + 3, th - 2, tz + 3, "woodDark");
      gable(v, tx - 3, th - 2, tz - 3, tx + 3, tz + 3, "x", "red", "white");
    } else {
      ring(v, tx, tz, eh, th, 3.5, 2.5, "marble");
      for (let a = 0; a < 8; a++) v.box(Math.floor(tx + Math.cos(a * 0.785) * 3.2), eh, Math.floor(tz + Math.sin(a * 0.785) * 3.2), Math.floor(tx + Math.cos(a * 0.785) * 3.2) + 1, th, Math.floor(tz + Math.sin(a * 0.785) * 3.2) + 1, "marbleShade");
      v.cylinderY(tx, tz, th, th + 1, 4, "marble");
      v.dome(tx, th + 1, tz, 3.3, "copper");
      v.box(tx, th + 4, tz, tx + 1, th + 6, tz + 1, "gold", 0.5);
    }
    // footbridge to the right bank
    const bank = s === 2 ? x1 - Math.floor((eh - 1) / 2) : x1;
    v.box(tx, eh, tz, bank, eh + 1, tz + 2, s === 2 ? "wood" : emb2);
    for (let x = tx; x < bank; x += 2) v.put(x, eh + 1, tz + 1, "iron");
  } else {
    // valve hut on the bank
    v.box(x1 - 4, eh + 1, z0 - 1, x1, eh + 5, z0 + 3, ["stone", "concrete", "woodLight", "marble"][s]);
    gable(v, x1 - 5, eh + 5, z0 - 2, x1 + 1, z0 + 4, "x", ["slate", "concreteDark", "red", "copper"][s]);
    person(v, x0 + 2, eh + 1, z1 - 1, "orange", "blueDark");
  }

  if (lv >= 4) {
    // keeper's cottage, trees, boats
    const kx = -hx + 1;
    const kz = hz - 7;
    v.box(kx, 1, kz, kx + 6, 5, kz + 5, s === 2 ? "woodLight" : "cream");
    gable(v, kx - 1, 5, kz - 1, kx + 7, kz + 6, "x", s === 0 ? "slate" : "terracotta", "white");
    door(v, kx + 2, 1, kz + 4, "woodDark");
    for (let i = 0; i < 4; i++) tree(v, hx - 3 - i * 4, 1, hz - 2, s === 2 ? "pine" : s === 3 ? "cypress" : "round", 1, i);
    // rowing boat / sailboat
    const bx = Math.floor(x0 + (x1 - x0) * 0.3);
    const bz = Math.floor(z0 + (z1 - z0) * 0.5);
    v.box(bx - 2, eh, bz, bx + 3, eh + 1, bz + 2, "woodLight");
    if (s === 2) {
      v.box(bx, eh + 1, bz, bx + 1, eh + 7, bz + 1, "white");
      v.box(bx + 1, eh + 2, bz, bx + 3, eh + 6, bz + 1, "red");
    } else person(v, bx, eh + 1, bz, "red", "blueDark");
  }
  if (lv >= 5) {
    // island with a tree + second tower/gazebo + lamps along the rim
    const ix = Math.floor(x0 + (x1 - x0) * 0.25);
    const iz = Math.floor(z0 + (z1 - z0) * 0.25);
    v.cylinderY(ix, iz, 1, eh + 1, 3, s === 2 ? "grass" : "sandDark");
    tree(v, ix, eh + 1, iz, s === 2 ? "pine" : s === 3 ? "cypress" : "willow", 1.2, 1);
    for (let x = x0 + 1; x < x1; x += 6) {
      v.box(x, eh + 1, z1 - 1, x + 1, eh + 5, z1, "iron");
      v.put(x, eh + 5, z1 - 1, "warmGlow", 1.2);
    }
    crowd(c, x0, z0 - 1, x1, z0, 4, eh + 1);
    flag(v, x0, eh + 1, z0, 10, ["blueDark", "white", "blueDark"]);
  }
}

// =============================================================================================
// AQUEDUCT (runs along x; tiers grow 1 → 3)
//  V0 Roman Travertine (warm limestone, round arches, Pont-du-Gard tiers)
//  V1 Segovia Granite (grey granite, tall narrow arches, slim piers)
//  V2 Moorish Horseshoe (red/white striped voussoirs, horseshoe arches)
//  V3 Overgrown Ruin (mossy stone, ivy, leaking waterfalls)
// =============================================================================================
function buildAqueduct(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, "grass2");
  speckle(c, "grass3", 0.12);
  const st = ["limestone", "granite", "sand", "stone"][s];
  const st2 = ["sandDark", "stone", "brickDark", "moss"][s];
  const tiers = lv <= 2 ? 1 : lv <= 4 ? 2 : 3;
  const tierH = lv === 1 ? 8 : 10;
  const th = Math.min(3, Math.floor(hz / 3)); // half thickness
  const z0 = -th;
  const z1 = th;
  // river/path running under
  v.box(-hx, 0, -hz, hx, 1, hz, "grass2");
  v.box(-hx, 0, 4, hx, 1, 7, s === 3 ? "water" : "path", s === 3 ? 0.1 : 0);
  let y = 1;
  for (let t = 0; t < tiers; t++) {
    const tz = t === 0 ? 0 : 0;
    const zt0 = z0 + (t === 0 ? 0 : 1) - tz;
    const zt1 = z1 - (t === 0 ? 0 : 1) + tz;
    const h = t === tiers - 1 && tiers === 3 ? 7 : tierH;
    const span = t === tiers - 1 && tiers >= 2 ? 4 : s === 1 ? 6 : 8; // arch pitch
    v.box(-hx, y, zt0, hx, y + h, zt1, st);
    // arches through z
    const aw = span - (s === 1 ? 2 : 2);
    for (let x = -hx + span / 2; x < hx + span; x += span) {
      const ah = h - 2;
      if (s === 2) {
        // horseshoe: clear a slightly wider round top
        archway(v, x, y, zt0, zt1, aw, ah);
        v.box(Math.floor(x - aw / 2) , y, zt0, Math.floor(x - aw / 2) + 1, y + 1, zt1, st);
        // striped voussoirs
        for (let k = -aw / 2 - 1; k <= aw / 2; k++) {
          const xx = Math.floor(x + k);
          const d = xx + 0.5 - x;
          const r = aw / 2;
          const top = Math.round(y + ah - r + Math.sqrt(Math.max(0, r * r - d * d)));
          v.put(xx, top, zt1 - 1, (xx & 1) ? "red" : "white");
          v.put(xx, top, zt0, (xx & 1) ? "red" : "white");
        }
      } else archway(v, x, y, zt0, zt1, aw, ah);
    }
    // cornice
    v.box(-hx, y + h - 1, zt0 - 1, hx, y + h, zt1 + 1, st2);
    y += h;
  }
  // water channel on top
  v.box(-hx, y, z0, hx, y + 2, z1, st);
  v.box(-hx, y + 1, z0 + 1, hx, y + 2, z1 - 1, "water", 0.25);
  for (let x = -hx; x < hx; x += 3) v.put(x + ((x * 7) & 1), y + 1, 0, "foam", 0.4);
  if (s === 0 && lv >= 4) for (let x = -hx; x < hx; x += 4) v.box(x, y + 2, z0, x + 2, y + 3, z0 + 1, st2);
  if (s === 1 && lv >= 4) v.box(-hx, y + 2, z0, hx, y + 3, z0 + 1, "granite");

  if (s === 3) {
    // ivy + leaking waterfalls
    for (let i = 0; i < 20 * lv; i++) {
      const xx = c.ri(-hx, hx - 1);
      const zz = c.rand() < 0.5 ? z1 : z0 - 1;
      const yy = c.ri(1, y);
      v.box(xx, yy, zz, xx + 1, yy + c.ri(1, 4), zz + 1, c.pick(["leaf", "leafDark", "moss"]));
    }
    for (let i = 0; i < lv; i++) {
      const xx = c.ri(-hx + 2, hx - 3);
      v.box(xx, 1, z1, xx + 1, y + 1, z1 + 1, "water", 0.3);
      v.put(xx, 1, z1 + 1, "foam", 0.4);
    }
    for (let i = 0; i < lv; i++) v.clear(c.ri(-hx, hx - 2), y + 1, z0, c.ri(-hx, hx), y + 2, z0 + 1);
  }
  // Level extras
  if (lv >= 2) {
    tree(v, -hx + 3, 1, hz - 3, s === 2 ? "palm" : s === 1 ? "pine" : "cypress", 1, 1);
    tree(v, hx - 4, 1, -hz + 2, s === 2 ? "palm" : "cypress", 1.1, 2);
  }
  if (lv >= 4) {
    // water wheel fed by a spout from the channel
    const wx = Math.floor(hx * 0.4);
    const wz = th + 2;
    v.box(wx, y, z1, wx + 1, y + 1, wz + 1, st);
    v.box(wx, 6, wz, wx + 1, y, wz + 1, "water", 0.35);
    const wheel = new PixelVox();
    wheel.ringZ(0, 0, -1, 1, 5, 4, "woodDark");
    for (let a = 0; a < 8; a++) {
      const ca = Math.cos(a * 0.785);
      const sa = Math.sin(a * 0.785);
      for (let d = 1; d < 5; d++) wheel.put(Math.round(ca * d) - 0.5, Math.round(sa * d) - 0.5, 0, "wood");
      wheel.put(Math.round(ca * 5.5) - 0.5, Math.round(sa * 5.5) - 0.5, -1, "woodLight");
      wheel.put(Math.round(ca * 5.5) - 0.5, Math.round(sa * 5.5) - 0.5, 0, "woodLight");
    }
    c.addRotor({ vox: wheel, pivot: [wx + 0.5, 6.5, wz + 1], axis: "z", speed: -1.1 });
    v.box(wx - 6, 0, wz - 1, wx + 7, 1, hz, "water", 0.15);
  }
  if (lv >= 5) {
    // nymphaeum fountain + visitors + torches
    const fx = -Math.floor(hx * 0.45);
    v.box(fx - 4, 1, th + 2, fx + 4, 3, th + 6, st);
    v.box(fx - 3, 2, th + 3, fx + 3, 3, th + 5, "water", 0.2);
    v.box(fx - 1, 3, th + 2, fx + 1, 7, th + 3, st2);
    v.put(fx, 6, th + 3, "foam", 0.4);
    crowd(c, -hx + 2, hz - 3, hx - 2, hz - 1, 5);
    for (const lx of [-hx + 1, hx - 2]) {
      v.box(lx, 1, th + 1, lx + 1, 5, th + 2, "iron");
      v.put(lx, 5, th + 1, "fire", 1.3);
    }
  }
}

// =============================================================================================
// DESALINATION PLANT (coast: intake pier + brine outfall into the sea along -z)
//  V0 Mediterranean White & Teal (whitewashed halls, arches, small domes)
//  V1 Solar-Powered RO (photovoltaic fields, heliostat tower)
//  V2 Thermal MSF Distillation (long evaporator vessels, steaming stacks)
//  V3 Futuristic Membrane Domes (glass domes glowing cyan, white pods)
// =============================================================================================
function membraneRack(v: PixelVox, x0: number, x1: number, y: number, z: number, rows: number): void {
  for (let r = 0; r < rows; r++) {
    v.box(x0, y + r * 2, z, x1, y + r * 2 + 1, z + 1, "white");
    v.box(x0, y + r * 2, z + 2, x1, y + r * 2 + 1, z + 3, "white");
    v.put(x0, y + r * 2, z, "blue");
    v.put(x0, y + r * 2, z + 2, "blue");
  }
  v.box(x0 - 1, 1, z, x0, y + rows * 2, z + 3, "steelDark");
  v.box(x1, 1, z, x1 + 1, y + rows * 2, z + 3, "steelDark");
}

function buildDesal(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const s = c.variant % 4;
  lot(c, s === 0 ? "sand" : "concrete2");
  speckle(c, s === 0 ? "sandDark" : "concrete", 0.08);
  const zs = seaBack(c, 6, "concreteDark");
  // intake pier w/ intake head
  const px = -hx + 5;
  v.box(px - 1, 1, -hz, px + 2, 2, zs, "concrete");
  v.box(px - 2, 1, -hz, px + 3, 4, -hz + 2, s === 3 ? "white" : "steelDark");
  v.put(px, 4, -hz, "red", 0.8);
  c.blink(px, 5, -hz, "red");
  pipe(v, "z", -hz + 2, zs + 4, 2, px, "blue");
  // brine outfall
  const ox = hx - 5;
  pipe(v, "z", -hz + 1, zs + 1, 1, ox, "steelDark");
  v.box(ox - 1, 0, -hz, ox + 3, 1, -hz + 2, "foam", 0.3);

  const bz0 = zs + 2;
  const hallD = Math.min(12, hz - 4);
  const tr = lv >= 4 ? 5 : 4;
  const tankX = hx - tr - 1;
  const hx0 = -hx + 2;
  const hall1 = Math.min(tankX - tr - 2, hx0 + [12, 18, 24, 28, 40][lv - 1]);
  const fh = [6, 7, 9, 10, 12][lv - 1];

  // membrane hall
  if (s === 0) {
    v.box(hx0, 1, bz0, hall1, 1 + fh, bz0 + hallD, "white");
    for (let x = hx0 + 2; x < hall1 - 2; x += 4) archway(v, x + 1, 1, bz0 + hallD - 1, bz0 + hallD, 3, fh - 1);
    for (let x = hx0 + 2; x < hall1 - 2; x += 4) v.box(x, 1, bz0 + hallD - 2, x + 3, fh - 1, bz0 + hallD - 1, "teal", 0.2);
    v.box(hx0, 1 + fh, bz0, hall1, 2 + fh, bz0 + hallD, "teal");
    for (let x = hx0 + 4; x < hall1 - 3; x += 10) v.dome(x, 2 + fh, bz0 + hallD / 2, 3, "white");
  } else if (s === 3) {
    for (let x = hx0 + 5; x < hall1 - 4; x += 11) {
      v.dome(x, 1, bz0 + hallD / 2, Math.min(6.5, hallD / 2), "glass", 0.35);
      v.dome(x, 1, bz0 + hallD / 2, Math.min(5.3, hallD / 2 - 1.2), "screenCyan", 0.7);
      ring(v, x, bz0 + hallD / 2, 1, 2, Math.min(5.9, hallD / 2 + 0.4), Math.min(5, hallD / 2 - 0.5), "white");
    }
  } else {
    v.box(hx0, 1, bz0, hall1, 1 + fh, bz0 + hallD, s === 2 ? "steelLight" : "white");
    for (let x = hx0; x < hall1; x += 2) v.box(x, 1, bz0 + hallD - 1, x + 1, 1 + fh, bz0 + hallD, s === 2 ? "steel" : "silver");
    v.box(hx0 + 1, fh - 2, bz0 + hallD - 1, hall1 - 1, fh - 1, bz0 + hallD, "glass", 0.4);
    if (s === 1) sawtooth(v, hx0, 1 + fh, bz0, hall1, bz0 + hallD, "white", "solarBlue", 4);
    else barrelRoof(v, hx0, 1 + fh, bz0, hall1, bz0 + hallD, "x", "steel", "steelDark");
  }
  // big sign stripe on the hall
  if (s !== 3) v.box(hx0 + 2, fh - 0, bz0 + hallD, hx0 + 8, fh + 1, bz0 + hallD + 1, "screenCyan", 0.8);

  // product water tanks in a column on the right
  const tankN = [1, 2, 2, 3, 4][lv - 1];
  for (let i = 0; i < tankN; i++) {
    const tz = bz0 + tr + i * (tr * 2 + 2);
    if (tz + tr > hz) break;
    tank(v, tankX, tz, 1, 4 + lv, tr, s === 3 ? "white" : "silver", "steelLight", s === 0 ? "teal" : "blue");
    if (i > 0) pipe(v, "z", tz - tr - 3, tz - tr + 1, 1, tankX - 1, "blue");
  }
  pipe(v, "x", hall1, tankX - tr + 1, 2, bz0 + 3, "blue");

  // RO rack yard in front
  if (lv >= 2) {
    const rz = bz0 + hallD + 2;
    if (rz + 3 < hz - 1) membraneRack(v, hx0 + 1, Math.min(hall1 - 4, hx0 + 14), 2, rz, 3 + (lv >= 4 ? 1 : 0));
  }
  if (lv === 1) {
    // container RO unit + solar still trays
    v.box(hx0, 1, hz - 5, hx0 + 8, 4, hz - 2, "blue");
    v.box(hx0, 1, hz - 5, hx0 + 1, 4, hz - 2, "steelDark");
    person(v, hx0 + 10, 1, hz - 2, "orange", "blueDark");
  }
  // signature features
  if (lv >= 3) {
    if (s === 1) {
      for (let z = hz - 3; z > hz - 12; z -= 4) solarRow(v, -hx + 1, -2, 1, z - 2, 3);
      // heliostat tower
      const hx1 = hx - 3;
      const hz1 = -hz + 9;
      v.box(hx1 - 1, 1, hz1 - 1, hx1 + 1, 18 + lv * 3, hz1 + 1, "concrete");
      v.box(hx1 - 2, 18 + lv * 3, hz1 - 2, hx1 + 2, 21 + lv * 3, hz1 + 2, "amber", 1.2);
    } else if (s === 2) {
      for (let i = 0; i < Math.min(3, lv - 1); i++) {
        const sx = hall1 - 3 - i * 5;
        const top = smokestack(v, sx, bz0 + 3, 1 + fh, 10 + i * 2, 1.2, "white", "red");
        c.smoke(sx, top, bz0 + 3, "steam");
      }
      // horizontal evaporator vessel
      for (let x = hx0; x < Math.min(hall1, hx0 + 22); x++) {
        for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (dy * dy + dz * dz <= 5) v.put(x, 5 + dy, hz - 4 + dz, x % 5 === 0 ? "steelDark" : "silver");
      }
    } else if (s === 3) {
      v.cylinderY(hx - 6, -hz + 10, 1, 24 + lv * 2, 1, "white");
      v.sphere(hx - 6, 26 + lv * 2, -hz + 10, 3, 3, 3, "screenCyan", 0.9);
      c.blink(hx - 6, 30 + lv * 2, -hz + 10, "cyan");
    } else {
      // whitewashed bell/clock tower
      const bx = hall1 + 1 < hx - 5 ? hall1 + 1 : hx0 + 1;
      v.box(bx, 1, bz0, bx + 4, 18, bz0 + 4, "white");
      archway(v, bx + 2, 13, bz0 + 3, bz0 + 4, 2, 4);
      v.dome(bx + 2, 18, bz0 + 2, 2.3, "teal");
    }
  }
  if (lv >= 4) {
    // second process hall (pre-treatment / pump hall) closer to the front
    const z0 = bz0 + hallD + 12;
    const z1 = Math.min(hz - 6, z0 + 9);
    const x1 = Math.min(hall1, hx0 + 22);
    if (z1 - z0 >= 6) {
      if (s === 3) {
        for (let x = hx0 + 5; x < x1 - 3; x += 10) {
          v.dome(x, 1, (z0 + z1) / 2, (z1 - z0) / 2, "glass", 0.35);
          v.dome(x, 1, (z0 + z1) / 2, (z1 - z0) / 2 - 1.2, "screenCyan", 0.7);
        }
      } else {
        const wc = s === 2 ? "steelLight" : "white";
        v.box(hx0, 1, z0, x1, fh - 1, z1, wc);
        v.box(hx0, fh - 3, z1 - 1, x1, fh - 2, z1, s === 0 ? "teal" : "blue");
        windows(c, hx0, 1, z0, x1, fh - 1, z1, { w: 2, stepH: 4, emit: 0.5, faces: "se" });
        if (s === 0) for (let x = hx0 + 3; x < x1 - 2; x += 7) v.dome(x, fh - 1, (z0 + z1) / 2, 2.5, "teal");
        else if (s === 1) for (let z = z0; z < z1 - 2; z += 3) solarRow(v, hx0 + 1, x1 - 1, fh - 1, z, 3);
        else flatRoof(c, hx0, fh - 1, z0, x1, z1, "steelDark", "steel", true);
        door(v, hx0 + 3, 1, z1 - 1, "charcoal", 3, 4);
      }
    }
    // power substation & trucks
    v.box(-hx + 1, 0, hz - 4, -hx + 16, 1, hz - 1, "asphalt");
    truck(v, -hx + 6, 1, hz - 3, "x", "white", "teal");
    for (const lx of [-hx + 1, hx - 2]) lamp(v, lx, 1, hz - 1, 6);
  }
  if (lv >= 5) {
    securityFence(v, -hx, zs + 1, hx, hz, 1, 3, [-hx + 18, -hx + 24]);
    flag(v, hx0 + 1, 2 + fh, bz0 + 1, 8, ["teal", "white", "blue"]);
    crowd(c, -hx + 18, hz - 5, hx - 4, hz - 2, 4);
  }
}

// =============================================================================================
defineDesigns({
  water_treatment_plant: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Sand-Filter Shed", "Settling Works", "Clarifier Compound", "Purification Campus", "Crystal-Clear Megaworks"],
    growth: "Adds spinning clarifier rings, then a signature tower/digesters, then trucks, tanks and a fenced mega-campus.",
    build: buildTreatment,
  },
  wells: {
    footprints: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1]],
    levels: ["Hand-Dug Well", "Village Well", "Well & Hand Pump", "Wind-Pump House", "Sacred Spring Shrine"],
    growth: "Rope well gains a roof and winch, then a hand pump, a spinning wind pump, and finally a waterfall spring shrine.",
    build: buildWell,
  },
  water_towers: {
    footprints: [[1, 1], [1, 1], [1, 1], [2, 2], [2, 2]],
    levels: ["Farm Tank", "Neighborhood Tower", "Town Water Tower", "Landmark Water Tower", "Skyline Water Titan"],
    growth: "The tank climbs higher every level; at Lv4 it gets a pump house and big lettering, Lv5 becomes a beacon-topped titan.",
    build: buildWaterTower,
  },
  water_places: {
    footprints: [[2, 1], [2, 1], [2, 2], [2, 2], [3, 2]],
    levels: ["Corner Fountain", "Tiered Fountain Square", "Fountain Court", "Musical Fountain Promenade", "Grand Cascade Plaza"],
    growth: "A single basin grows tiers and satellite pools, then a light-up jet show, then a monumental stepped cascade.",
    build: buildWaterPlaza,
  },
  water_pumping_station: {
    footprints: [[2, 1], [2, 1], [2, 2], [2, 2], [3, 2]],
    levels: ["Intake Pump Shed", "Steam Pump House", "Surge-Tower Station", "Twin-Main Pumpworks", "Grand Pumping Palace"],
    growth: "From a shed on an intake pier to a pump hall with mains, a surge tower, transformer yard and rooftop tanks.",
    build: buildPumping,
  },
  municipal_reservoir: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [3, 3]],
    levels: ["Clearwater Pond", "Embanked Basin", "Dammed Reservoir", "Valley Reservoir", "Grand Lake Reservoir"],
    growth: "Embankments rise, an intake tower appears, then a dam with a foaming spillway, a keeper's cottage, boats and an island.",
    build: buildReservoir,
  },
  aqueduct: {
    footprints: [[2, 1], [2, 1], [3, 1], [3, 1], [3, 1]],
    levels: ["Arched Conduit", "Arcade Aqueduct", "Two-Tier Aqueduct", "Mill-Wheel Aqueduct", "Triple-Tier Colossus"],
    growth: "Stacks tiers of arches (1 → 3) with a flowing channel on top, adding a water wheel and a nymphaeum fountain.",
    build: buildAqueduct,
  },
  desalination_plant: {
    footprints: [[2, 2], [2, 2], [3, 2], [3, 3], [3, 3]],
    levels: ["Container RO Unit", "Membrane Hall", "Desal Works", "Coastal Desal Complex", "Ocean-to-Tap Megaplant"],
    growth: "An intake pier and container unit grow into membrane halls, RO rack yards, tank farms and a signature tower.",
    build: buildDesal,
  },
});
