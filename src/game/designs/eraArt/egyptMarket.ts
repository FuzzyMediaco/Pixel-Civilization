/**
 * Ancient Egypt commerce: the trade is the architecture. Grain silos, potters' kilns, beehive bread
 * ovens, scribes' courts, beer jars, looms and dye vats make each shop readable from above.
 * Every level adds a structure; every variant changes the plan.
 */
import type { Ctx, PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { crowd, disc } from "../commerceKit";

const MUD = "#c89a62", MUD2 = "#b0824f", LIME = "#eadcbc", LINEN = "#f4ecd6", LAPIS = "#2f5fa8", RED = "#a8452f";
const PALM = "#4f8a3a", PALM2 = "#6fae4f", TRUNK = "#8a6a3a", WATER = "#3f8fb8", CLAY = "#b5653a", GOLD = "#d4a437";
const FAIENCE = "#3fb5a8", SAND = "#d9c08a", SMOKE = "smoke";

const yard = (c: Ctx) => c.v.box(-c.hx, 0, -c.hz, c.hx, 1, c.hz, SAND);
const S = (c: Ctx, base: number, per: number) => Math.min(Math.min(c.hx, c.hz) - 1, base + c.lv * per);

function mudHouse(v: PixelVox, x0: number, x1: number, z0: number, z1: number, h: number): void {
  v.box(x0, 1, z0, x1, h, z1, MUD);
  v.box(x0, h - 1, z0, x1, h, z1, LIME);
  for (let x = x0 + 1; x < x1 - 1; x++) v.put(x, h, z0, MUD2); // parapet
  v.box(Math.floor((x0 + x1) / 2), 1, z1 - 1, Math.floor((x0 + x1) / 2) + 2, 4, z1, "#3a2a1e");
  for (let x = x0 + 2; x < x1 - 2; x += 4) v.put(x, h - 3, z1 - 1, LAPIS);
}
function linenShade(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y: number, stripe = LAPIS): void {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) v.put(x, y, z, (x - x0) % 4 === 0 ? stripe : LINEN);
  for (const [x, z] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) v.box(x, 1, z, x + 1, y, z + 1, TRUNK);
}
function palm(v: PixelVox, x: number, z: number, h = 7): void {
  for (let y = 1; y < h; y++) v.put(x + (y > h - 3 ? 1 : 0), y, z, TRUNK);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) v.put(x + 1 + dx, h - (Math.abs(dx) + Math.abs(dz) > 2 ? 1 : 0), z + dz, (dx + dz) % 2 ? PALM : PALM2);
  v.put(x + 1, h, z, PALM);
}
function silo(v: PixelVox, x: number, z: number, r: number, h: number): void {
  disc(v, x, z, 1, h, r, (_x, y) => (y % 3 === 0 ? MUD2 : MUD));
  for (let k = 0; k <= r; k++) disc(v, x, z, h + k, h + k + 1, Math.max(0.6, r - k), LIME);
}
function jar(v: PixelVox, x: number, z: number, h: number, col = CLAY): void {
  disc(v, x, z, 1, 2, 0.8, col);
  disc(v, x, z, 2, h, 1.4, col);
  v.put(x, h, z, MUD2);
}
function beehiveOven(c: Ctx, x: number, z: number, r: number): void {
  for (let y = 0; y <= r; y++) disc(c.v, x, z, 1 + y, 2 + y, Math.sqrt(Math.max(0, r * r - y * y)), (_x, yy) => (yy === 1 ? "#ff8a3d" : CLAY));
  c.v.put(Math.round(x), 2, Math.round(z + r), "#ff8a3d", 1.3);
  c.smoke(Math.round(x), r + 2, Math.round(z), SMOKE);
}
function produce(v: PixelVox, x0: number, x1: number, z: number): void {
  const cols = ["#7fb63a", "#e0b43a", "#c0392b", "#8e44ad", "#e67e22"];
  for (let x = x0; x < x1; x++) { v.put(x, 1, z, "#8a6a3a"); v.put(x, 2, z, cols[(x + 20) % 5]); }
}
function loom(v: PixelVox, x: number, z: number): void {
  v.box(x, 1, z, x + 1, 4, z + 1, TRUNK); v.box(x + 3, 1, z, x + 4, 4, z + 1, TRUNK);
  v.box(x, 4, z, x + 4, 5, z + 1, TRUNK);
  for (let k = 1; k < 3; k++) v.box(x + k, 2, z, x + k + 1, 4, z + 1, LINEN);
}
function vat(v: PixelVox, x: number, z: number, col: string): void {
  disc(v, x, z, 1, 3, 1.6, (_x, y, _z, d) => (d < 0.9 && y === 2 ? col : MUD2));
}
const people = (c: Ctx, n: number) => crowd(c, n, -c.hx + 2, -c.hz + 2, c.hx - 2, c.hz - 2);

// ----------------------------------------------------------------------------------- grocer
const grocer: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Silo Market: a ring of domed grain silos around stalls
    const n = Math.min(6, 1 + lv);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; silo(v, Math.round(Math.cos(a) * R * 0.75), Math.round(Math.sin(a) * R * 0.75) - 1, 2 + Math.floor(lv / 3), 5 + lv); }
    produce(v, -3, 4, 1);
  } else if (s === 1) {
    // Date Palm Court: produce under palms in a walled court
    mudHouse(v, -R, R, -R, -R + 4, 6);
    for (let i = 0; i < lv + 1; i++) palm(v, -R + 2 + ((i * 5) % (2 * R - 3)), -R + 6 + ((i * 3) % Math.max(2, R)), 6 + (i % 3));
    for (let z = -R + 6; z < R - 1; z += 3) produce(v, -R + 1, R - 1, z);
  } else if (s === 2) {
    // Nile Quay Market: a quay where melon boats unload into a mud-brick hall
    v.box(-c.hx, 0, c.hz - 4, c.hx, 1, c.hz, WATER);
    mudHouse(v, -R, R, -R, c.hz - 7, 5 + Math.floor(lv / 2));
    for (let x = -R; x < R - 6; x += 9) { v.box(x, 1, c.hz - 3, x + 7, 2, c.hz - 1, TRUNK); for (let k = 1; k < 6; k++) v.put(x + k, 2, c.hz - 2, "#7fb63a"); }
  } else {
    // Shaded Stall Rows: linen sails over long rows of stalls
    for (let z = -R; z < R - 3; z += 6) { linenShade(v, -R, R, z, z + 4, 5, z % 12 === 0 ? LAPIS : RED); produce(v, -R + 1, R - 1, z + 2); }
  }
  people(c, 2 + lv * 2);
};

// ----------------------------------------------------------------------------------- shops
const shops: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Linen Shade Bazaar: a lane of open stalls under striped sails
    for (let x = -R; x < R - 3; x += 5) linenShade(v, x, x + 4, -2, 3, 5, x % 10 === 0 ? LAPIS : RED);
    mudHouse(v, -R, R, -R, -3, 6);
  } else if (s === 1) {
    // Potter's Row: wheel sheds, a smoking kiln and rows of jars for sale
    mudHouse(v, -R, R, -R, -R + 5, 5);
    beehiveOven(c, R - 3, -R + 8, 2 + Math.floor(lv / 2));
    for (let x = -R + 1; x < R - 6; x += 3) jar(v, x, 2, 4 + (x % 2));
  } else if (s === 2) {
    // Faience Workshop: blue-glazed beads and amulets glowing on racks before a kiln
    mudHouse(v, -R, R, -R, 0, 6 + Math.floor(lv / 2));
    for (let x = -R + 1; x < R - 1; x += 2) v.box(x, 1, 1, x + 1, 4, 2, x % 4 ? FAIENCE : GOLD, 0.3);
    beehiveOven(c, -R + 3, 4, 2);
  } else {
    // Papyrus Sellers: bundles of reeds stacked high beside a scribe's stall
    mudHouse(v, -R, 0, -R, R - 4, 5);
    for (let x = 2; x < R; x += 3) for (let z = -R + 1; z < R - 4; z += 3) { v.box(x, 1, z, x + 2, 3 + lv, z + 2, PALM2); v.box(x, 3 + lv, z, x + 2, 4 + lv, z + 2, "#c9d27a"); }
  }
  people(c, 2 + lv);
};

// ----------------------------------------------------------------------------------- restaurant
const kitchen: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Bread Oven Court: beehive ovens smoking around a court of low tables
    for (let i = 0; i < Math.min(4, lv); i++) beehiveOven(c, -R + 2 + i * 5, -R + 3, 2);
    for (let x = -R + 2; x < R - 2; x += 4) v.box(x, 1, 2, x + 2, 2, 3, MUD2);
  } else if (s === 1) {
    // Riverside Fish Grill: grills on a mud quay with fish drying on lines
    v.box(-c.hx, 0, c.hz - 3, c.hx, 1, c.hz, WATER);
    mudHouse(v, -R, R, -R, -R + 4, 5);
    for (let x = -R + 1; x < R - 1; x++) v.put(x, 4, 1, x % 2 ? "#c0c0c0" : TRUNK);
    for (let x = -R + 2; x < R - 2; x += 4) { v.box(x, 1, 3, x + 2, 2, 4, "#333"); v.put(x, 2, 3, "#ff8a3d", 1.2); c.smoke(x, 3, 3, SMOKE); }
  } else if (s === 2) {
    // Roof Terrace Feast: a mud house with a stair to a shaded rooftop dining terrace
    mudHouse(v, -R, R, -R, R - 2, 5 + Math.floor(lv / 2));
    linenShade(v, -R + 1, R - 1, -R + 1, R - 3, 9 + Math.floor(lv / 2), RED);
    for (let k = 0; k < 5; k++) v.box(R - 2 - k, 1, R - 2, R - 1 - k, 2 + k, R, LIME);
    crowd(c, lv + 1, -R + 2, -R + 2, R - 2, R - 4, 6 + Math.floor(lv / 2));
  } else {
    // Clay Oven Row: a row of ovens under one long reed roof
    linenShade(v, -R, R, -2, 3, 5, PALM2);
    for (let x = -R + 1; x < R - 1; x += 4) beehiveOven(c, x, 0, 1.6);
  }
  people(c, 2 + lv);
};

// ----------------------------------------------------------------------------------- businesses
const scribes: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Scribe Court: desks under painted columns
    v.box(-R, 1, -R, R, 7, -R + 3, MUD);
    for (let x = -R + 1; x < R; x += 3) { v.box(x, 1, -R + 4, x + 1, 6, -R + 5, LIME); v.put(x, 6, -R + 4, LAPIS); }
    v.box(-R, 6, -R, R, 7, -R + 5, LIME);
    for (let x = -R + 2; x < R - 2; x += 3) v.box(x, 1, -R + 7, x + 2, 2, -R + 8, TRUNK);
  } else if (s === 1) {
    // Granary Office: a stepped granary with clerks tallying sacks
    for (let k = 0; k < 2 + Math.floor(lv / 2); k++) v.box(-R + k * 2, 1 + k * 3, -R + k, R - k * 2, 4 + k * 3, R - 3 - k, k % 2 ? MUD2 : MUD);
    for (let x = -R; x < R; x += 2) v.box(x, 1, R - 2, x + 1, 2, R - 1, "#c9b48a");
  } else if (s === 2) {
    // Trade Barge Office: a counting house with a moored barge of crates
    v.box(-c.hx, 0, c.hz - 4, c.hx, 1, c.hz, WATER);
    mudHouse(v, -R, R, -R, c.hz - 6, 6 + Math.floor(lv / 2));
    v.box(-R + 1, 1, c.hz - 3, R - 1, 2, c.hz - 1, TRUNK);
    for (let x = -R + 2; x < R - 2; x += 3) v.box(x, 2, c.hz - 3, x + 2, 4, c.hz - 1, "#8a6a3a");
  } else {
    // Obelisk House: a merchant house announced by a small gilded obelisk
    mudHouse(v, -R, R, -R, R - 4, 7 + lv);
    for (let y = 1; y < 8 + lv * 2; y++) v.box(R - 2, y, R - 2, R - 1, y + 1, R - 1, y > 6 + lv * 2 ? GOLD : LIME);
  }
  people(c, 1 + lv);
};

// ----------------------------------------------------------------------------------- bars
const beerHouse: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Beer Jar Court: giant amphorae lean round a shaded court
    for (let i = 0; i < 3 + lv; i++) jar(v, -R + 2 + ((i * 4) % (2 * R - 3)), -R + 2 + Math.floor((i * 4) / (2 * R - 3)) * 4, 4 + lv);
    linenShade(v, -3, 4, 1, R - 1, 5, RED);
  } else if (s === 1) {
    // Palm Shade Tavern: a low tavern under a grove with benches
    mudHouse(v, -R, R, -R, -R + 5, 5);
    for (let i = 0; i < lv + 2; i++) palm(v, -R + 2 + i * 4, 2 + (i % 2) * 3, 6 + (i % 2));
  } else if (s === 2) {
    // Rooftop Beer Terrace: a lamp-lit roof with a sail and musicians
    mudHouse(v, -R, R, -R, R - 2, 6);
    linenShade(v, -R + 1, R - 1, -R + 1, R - 3, 10, LAPIS);
    for (let x = -R + 2; x < R - 2; x += 4) v.put(x, 7, R - 3, "#ffcf7a", 1.1);
    crowd(c, lv + 2, -R + 2, -R + 2, R - 2, R - 4, 7);
  } else {
    // Harp Hall: a columned hall with harpists and dancers on the porch
    v.box(-R, 1, -R, R, 7, 0, MUD);
    for (let x = -R; x < R; x += 3) { v.box(x, 1, 0, x + 1, 7, 1, LIME); v.put(x, 7, 0, PALM); }
    v.box(-R, 7, -R, R, 8, 2, LIME);
    for (let x = -2; x < 3; x += 2) { v.box(x, 1, 3, x + 1, 4, 4, GOLD); }
  }
  people(c, 2 + lv * 2);
};

// ----------------------------------------------------------------------------------- clothing
const weavers: SignatureBuilder = (c) => {
  const { v, lv } = c;
  const s = c.variant % 4;
  yard(c);
  const R = S(c, 3, 2);
  if (s === 0) {
    // Loom Courtyard: looms set out in a walled court
    mudHouse(v, -R, R, -R, -R + 4, 5);
    for (let x = -R + 1; x < R - 4; x += 5) for (let z = -R + 6; z < R - 2; z += 4) loom(v, x, z);
  } else if (s === 1) {
    // Dye Vats: a grid of colored vats steaming beside the shop
    mudHouse(v, -R, 0, -R, R - 3, 5);
    const cols = [LAPIS, RED, GOLD, FAIENCE, "#6a3d8a"];
    for (let x = 2; x < R; x += 3) for (let z = -R + 1; z < R - 2; z += 3) vat(v, x, z, cols[(x + z + 40) % 5]);
  } else if (s === 2) {
    // Drying Lines: long lines of fresh linen sheets over the yard
    mudHouse(v, -R, R, -R, -R + 4, 5);
    for (let z = -R + 6; z < R; z += 3) for (let x = -R + 1; x < R - 1; x++) { v.put(x, 5, z, x % 6 === 0 ? TRUNK : LINEN); if (x % 2 === 0) v.put(x, 4, z, LINEN); }
  } else {
    // Gold & Faience Boutique: a jewel-box shop with gilded columns and bead curtains
    v.box(-R + 2, 1, -R + 2, R - 2, 6 + lv, R - 3, LIME);
    for (let x = -R + 2; x < R - 2; x += 2) v.box(x, 1, R - 3, x + 1, 6 + lv, R - 2, x % 4 ? FAIENCE : GOLD, 0.25);
  }
  people(c, 2 + lv);
};

export const egyptMarket: Record<string, SignatureBuilder> = {
  grocery_store: grocer,
  shops,
  restaurants: kitchen,
  businesses: scribes,
  bars: beerHouse,
  clothing_stores: weavers,
};
