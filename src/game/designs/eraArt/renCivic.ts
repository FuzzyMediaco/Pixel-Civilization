/**
 * Renaissance Italy civic five: loggias, measured piazzas, rusticated palazzi, campanili and domes.
 * Library = the brief's Printer's Piazza. Massing follows CIVIC-FIVE-SPEC.md.
 */
import type { Ctx, PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { crowd, disc } from "../commerceKit";

const OCHRE = "#d9a45c", TERRA = "#c8693a", STONE = "#ece0c4", SERENA = "#8d8f8a", TILE = "#a6492b";
const SHUTTER = "#3f6b4a", GOLD = "#d4a437", MARBLE = "#f1ece0", CYPRESS = "#2f5a35", TIMBER = "#7a5232";
const LAMP = "#ffcf7a", PAVE = "#cdbb98", PAPER = "#f7f1e1";

const piazza = (c: Ctx, z0: number, z1: number) => {
  for (let x = -c.hx; x < c.hx; x++) for (let z = z0; z < z1; z++) c.v.put(x, 0, z, (Math.floor(x / 4) + Math.floor(z / 4)) % 2 ? PAVE : "#bfa985");
};

/** Arcaded loggia along x on the plane z (arches open toward +z). */
function loggia(v: PixelVox, x0: number, x1: number, z0: number, z1: number, h: number, wall = OCHRE): void {
  v.box(x0, 1, z0, x1, h, z1, wall);
  v.box(x0 + 1, 1, z0 + 1, x1 - 1, h - 2, z1, null);
  for (let x = x0; x < x1; x++) {
    const pier = (x - x0) % 3 === 0;
    if (pier) v.box(x, 1, z1 - 1, x + 1, h - 1, z1, SERENA);
    else v.put(x, h - 2, z1 - 1, SERENA);
  }
  roof(v, x0, x1, z0, z1, h);
}
/** Low-pitched terracotta roof along x. */
function roof(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y: number): void {
  const d = z1 - z0;
  for (let k = 0; k < Math.ceil(d / 3); k++) v.box(x0 - 1, y + k, z0 + k * 1.5 - 1, x1 + 1, y + k + 1, z1 - k * 1.5 + 1, TILE);
}
/** Palazzo block: rusticated ground floor, shuttered windows, cornice. Returns top y. */
function palazzo(v: PixelVox, x0: number, x1: number, z0: number, z1: number, floors: number, wall = OCHRE): number {
  const h = 1 + floors * 4;
  v.box(x0, 1, z0, x1, h, z1, wall);
  v.box(x0, 1, z0, x1, 5, z1, STONE);
  for (let x = x0; x < x1; x++) for (let y = 1; y < 5; y += 2) v.put(x, y, z1 - 1, (x + y) % 4 === 0 ? SERENA : STONE);
  for (let f = 1; f < floors; f++) for (let x = x0 + 2; x < x1 - 1; x += 3) {
    v.box(x, 2 + f * 4, z1 - 1, x + 1, 4 + f * 4, z1, (x + f) % 3 === 0 ? LAMP : "#3a3d46", (x + f) % 3 === 0 ? 0.6 : 0);
    v.put(x - 1, 3 + f * 4, z1, SHUTTER); v.put(x + 1, 3 + f * 4, z1, SHUTTER);
  }
  v.box(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 1, STONE);
  roof(v, x0, x1, z0, z1, h + 1);
  return h + 1;
}
function campanile(v: PixelVox, x: number, z: number, w: number, h: number, clock = false): number {
  v.box(x, 1, z, x + w, h, z + w, TERRA);
  for (let y = 4; y < h; y += 5) v.box(x, y, z, x + w, y + 1, z + w, STONE);
  v.box(x - 1, h, z - 1, x + w + 1, h + 1, z + w + 1, STONE);
  v.box(x, h + 1, z, x + w, h + 4, z + w, TERRA);
  v.box(x + 1, h + 1, z + w - 1, x + w - 1, h + 3, z + w, "#2a2a2a");
  for (let k = 0; k < Math.ceil(w / 2) + 1; k++) v.box(x + k, h + 4 + k, z + k, x + w - k, h + 5 + k, z + w - k, TILE);
  if (clock) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) v.put(x + (w >> 1) + dx, h - 3 + dy, z + w, dx === 0 && dy >= 0 ? "#222" : MARBLE, 0.4);
  return h + 5 + Math.ceil(w / 2);
}
function dome(v: PixelVox, cx: number, cz: number, y0: number, r: number): void {
  disc(v, cx, cz, y0, y0 + 3, r, (_x, y) => (y === y0 + 2 ? STONE : OCHRE));
  for (let y = 0; y <= r; y++) {
    const rr = Math.sqrt(Math.max(0, r * r - y * y));
    disc(v, cx, cz, y0 + 3 + y, y0 + 4 + y, rr, (x, _y, z, d) => (d < rr - 1.2 ? null : Math.abs(Math.sin(Math.atan2(z - cz, x - cx) * 4)) < 0.2 ? MARBLE : TILE));
  }
  v.box(Math.round(cx), y0 + 4 + r, Math.round(cz), Math.round(cx) + 1, y0 + 7 + r, Math.round(cz) + 1, MARBLE);
  v.put(Math.round(cx), y0 + 7 + r, Math.round(cz), GOLD);
}
function cypress(v: PixelVox, x: number, z: number, h = 6): void {
  for (let y = 1; y < h; y++) v.box(x, y, z, x + 1 + (y < h - 2 ? 1 : 0), y + 1, z + 1 + (y < h - 2 ? 1 : 0), CYPRESS);
}
function door(v: PixelVox, cx: number, z: number, h = 4): void {
  v.box(cx - 1, 1, z, cx + 1, h, z + 1, "#4a2e1a");
  v.box(cx - 2, h, z, cx + 2, h + 1, z + 1, STONE);
}

// ----------------------------------------------------------------------------------- library
const library: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const L = Math.min(hx - 1, 5 + lv * 4);
  if (s === 0) {
    // Printer's Piazza: a giant timber screw press spans two loggias over a print court
    const lz = Math.min(hz - 1, 2 + lv * 2);
    piazza(c, -lz, lz);
    const depth = 4;
    loggia(v, -L, L, -lz - depth + 1, -lz + 1, 7);
    if (lv >= 2) loggia(v, -L, L, lz - 1, lz - 1 + depth, 7, TERRA);
    const H = 12 + lv;
    for (const x of [-Math.min(L - 2, 6), Math.min(L - 2, 6)]) v.box(x, 1, -1, x + 2, H, 1, TIMBER);
    v.box(-Math.min(L - 2, 6), H, -1, Math.min(L - 2, 6) + 2, H + 2, 1, TIMBER);
    for (let y = 6; y < H; y++) v.put(1, y, 0, y % 2 ? GOLD : TIMBER); // the screw
    v.box(-3, 5, -2, 5, 6, 2, TIMBER); // platen
    for (let x = -L + 2; x < L - 2; x += 2) for (let y = 3; y < 6; y++) v.put(x, 9 - (y % 2), lz - 2, PAPER); // drying sheets
    crowd(c, lv + 1, -L + 1, -lz + 2, L - 1, lz - 2);
  } else if (s === 1) {
    // Cloister Library: reading rooms round a square arcade and a garden well
    const r = Math.min(hx - 1, hz - 1, 4 + lv * 2);
    piazza(c, hz - 2, hz);
    for (const [x0, x1, z0, z1] of [[-r, r, -r, -r + 4], [-r, -r + 4, -r, r], [r - 4, r, -r, r], [-r, r, r - 4, r]] as const) v.box(x0, 1, z0, x1, 6, z1, OCHRE);
    v.box(-r + 4, 1, -r + 4, r - 4, 2, r - 4, "#6f9a4f");
    for (let x = -r + 4; x < r - 4; x += 3) for (const z of [-r + 3, r - 4]) v.box(x, 1, z, x + 1, 5, z + 1, SERENA);
    roof(v, -r, r, -r, -r + 4, 6); roof(v, -r, r, r - 4, r, 6);
    disc(v, 0, 0, 1, 3, 1.5, STONE);
    door(v, 0, r);
  } else if (s === 2) {
    // Palazzo Biblioteca: a palazzo whose top floor is an open reading loggia
    const D = Math.min(hz - 3, 3 + lv);
    piazza(c, -hz, hz);
    const top = palazzo(v, -L, L, -D, D, lv >= 4 ? 2 : 1);
    for (let x = -L + 1; x < L - 1; x += 3) v.box(x, top - 1, D - 1, x + 1, top + 3, D, SERENA);
    v.box(-L, top + 3, -D, L, top + 4, D, TILE);
    door(v, 0, D);
    crowd(c, lv, -L, D + 1, L, hz);
  } else {
    // Bookbinders' Gallery: a long arcaded gallery of binding bays with a cypress walk
    const D = Math.min(hz - 4, 3 + lv);
    piazza(c, D, hz);
    loggia(v, -L, L, -D, D, 6 + Math.floor(lv / 2), STONE);
    for (let x = -L + 1; x < L - 1; x += 3) v.box(x, 2, D - 2, x + 2, 4, D - 1, ["#b4232c", "#2c5ea8", "#3f6b4a"][Math.abs(x) % 3]);
    for (let x = -L; x < L; x += 4) cypress(v, x, Math.min(hz - 2, D + 2), 5 + (x % 3));
  }
};

// ----------------------------------------------------------------------------------- post office
const post: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const L = Math.min(hx - 1, 5 + lv * 4), D = Math.min(hz - 3, 3 + lv);
  piazza(c, 0, hz);
  if (s === 0) {
    // Messenger Stables: a long arcaded stable with horses in the yard
    loggia(v, -L, L, -D, 0, 6);
    c.critters({ kind: "horse", count: Math.min(4, lv), area: [-L + 2, 2, L - 2, Math.min(hz - 2, 6)] });
  } else if (s === 1) {
    // Fondaco: a courtyard warehouse with bales and carts
    palazzo(v, -L, L, -D, 0, 2, TERRA);
    for (let x = -L + 2; x < L - 2; x += 4) v.box(x, 1, 2, x + 2, 3, 4, "#c9b48a");
  } else if (s === 2) {
    // Canal Post Loggia: a loggia along a canal with mail barges
    loggia(v, -L, L, -D, 0, 6, STONE);
    v.box(-hx, 0, 2, hx, 1, Math.min(hz, 6), "water");
    for (let x = -L + 2; x < L - 4; x += 8) { v.box(x, 1, 3, x + 5, 2, 5, TIMBER); v.box(x + 1, 2, 3, x + 3, 3, 5, "#c9b48a"); }
  } else {
    // Dovecote Post: a tall colombaia beside the counting hall, pigeons circling
    palazzo(v, -L, L - 6, -D, 0, 1);
    const t = campanile(v, L - 5, -D, 4, 8 + lv * 2);
    for (let i = 0; i < 3 + lv; i++) v.put(L - 6 + (i % 6), t + 1 + (i % 2), -D + (i % 4), "#e8e8e8");
  }
  door(v, -2, 0);
  crowd(c, lv, -L, 1, L, Math.min(hz - 1, 5));
};

// ----------------------------------------------------------------------------------- courthouse
const court: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 5 + lv * 3), D = Math.min(hz - 4, 4 + lv * 2);
  const z1 = Math.min(hz - 5, D - 1), z0 = -D;
  const st = Math.min(4, hz - z1 - 1);
  for (let k = 0; k < st; k++) v.box(-6, 1, z1 + k, 7, 1 + st - k, z1 + k + 1, MARBLE);
  piazza(c, z1 + st, hz);
  if (s === 0) {
    // Palazzo della Giustizia: a symmetric crenellated palazzo under a central tower
    const top = palazzo(v, -W, W, z0, z1, 2 + Math.min(lv, 2), STONE);
    for (let x = -W; x < W; x += 2) v.put(x, top, z1, SERENA);
    campanile(v, -2, z0 + 2, 5, top + 4 + lv * 2);
  } else if (s === 1) {
    // Basilica Court: a temple front with giant pilasters and a pediment
    const H = 10 + lv * 2;
    v.box(-W, 1 + st, z0, W, H, z1, MARBLE);
    for (let x = -W + 1; x < W; x += 3) v.box(x, 1 + st, z1, x + 1, H, z1 + 1, STONE);
    for (let k = 0; k < W; k++) v.box(-W + k, H + Math.floor(k / 2), z1 - 1, W - k, H + Math.floor(k / 2) + 1, z1 + 1, k % 3 === 0 ? GOLD : MARBLE);
  } else if (s === 2) {
    // Loggia dei Giudici: a triple-arched judges' loggia before a tall hall
    palazzo(v, -W, W, z0, z1 - 5, 3 + Math.floor(lv / 2), OCHRE);
    loggia(v, -W + 2, W - 2, z1 - 6, z1, 10 + lv, STONE);
  } else {
    // Domed Tribunal: a square hall crowned by a ribbed dome on a drum
    const top = palazzo(v, -W, W, z0, z1, 2, STONE);
    dome(v, 0.5, (z0 + z1) / 2, top + Math.ceil((z1 - z0) / 3) - 1, Math.min(W, D) - 2);
  }
  door(v, 0, z1, 6);
  crowd(c, lv + 1, -W, z1 + st, W, hz);
};

// ----------------------------------------------------------------------------------- city offices
const offices: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const tw = Math.min(hx - 2, 4 + lv), tz0 = -hz + 1, tz1 = tz0 + Math.min(Math.floor(hz * 1.2), 6 + lv);
  const sq = tz1 + 1;
  piazza(c, sq, hz);
  const H = 14 + lv * 5;
  if (s === 0) {
    // Torre Civica: a palazzo with the island's tallest clock campanile over the piazza
    palazzo(v, -tw, tw - 4, tz0, tz1, 2);
    campanile(v, tw - 4, tz0, 4, H, true);
  } else if (s === 1) {
    // Palazzo Pubblico: a slender tower and a fan-shaped piazza
    palazzo(v, -tw, tw, tz0, tz1, 2, TERRA);
    campanile(v, -2, tz0, 3, H + 4, true);
    for (let x = -hx; x < hx; x++) for (let z = sq; z < hz; z++) if (Math.floor(Math.atan2(z - sq, x) * 5) % 2) v.put(x, 0, z, TERRA);
  } else if (s === 2) {
    // Bell & Clock Palazzo: a clock face on the palazzo front and an open bell loggia on top
    const top = palazzo(v, -tw, tw, tz0, tz1, 3 + Math.floor(lv / 2));
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.hypot(dx, dy) < 2.6) v.put(dx, top - 6 + dy, tz1, Math.hypot(dx, dy) > 1.6 ? GOLD : MARBLE, 0.4);
    campanile(v, -2, Math.round((tz0 + tz1) / 2) - 2, 4, top + 6 + lv);
  } else {
    // Family Towers: a cluster of tall slim towers over the hall (San Gimignano)
    palazzo(v, -tw, tw, tz0, tz1, 2);
    const n = Math.min(4, 1 + Math.floor(lv / 2) + 1);
    for (let i = 0; i < n; i++) campanile(v, -tw + 1 + i * Math.floor((2 * tw - 4) / Math.max(1, n - 1)), tz0 + (i % 2) * 2, 3, H - i * 3);
  }
  door(v, 0, tz1, 5);
  if (sq + 3 < hz) disc(v, 0, Math.round((sq + hz) / 2), 1, 2, Math.min(3, (hz - sq) / 2 - 1), (_x, _y, _z, d) => (d > 1.5 ? MARBLE : "#5fb7c9"));
  crowd(c, lv * 2, -hx + 1, sq + 1, hx - 1, hz);
};

// ----------------------------------------------------------------------------------- bank
const bank: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 4 + lv * 2), D = Math.min(hz - 3, 4 + lv * 2);
  piazza(c, D, hz);
  if (s === 0) {
    // Medici Strongroom: fully rusticated, tiny windows, a coat of arms of gold balls
    const h = 6 + lv * 2;
    for (let x = -W; x < W; x++) for (let z = -D; z < D; z++) for (let y = 1; y < h; y++) if (x === -W || x === W - 1 || z === -D || z === D - 1 || y === h - 1) v.put(x, y, z, (x + y + z) % 3 === 0 ? SERENA : STONE);
    for (let k = 0; k < 6; k++) v.put(-2 + (k % 3) * 2, h - 3 + Math.floor(k / 3), D, GOLD);
    roof(v, -W, W, -D, D, h);
  } else if (s === 1) {
    // Counting House: a closed strongroom behind a narrow, guarded portico
    palazzo(v, -W, W, -D, D - 3, 1 + Math.ceil(lv / 2), TERRA);
    for (const x of [-3, 3]) v.box(x, 1, D - 3, x + 1, 6, D, MARBLE);
    v.box(-4, 6, D - 3, 5, 7, D, STONE);
  } else if (s === 2) {
    // Monte di Pietà: a heavy block with a hanging sign of three gold balls
    v.box(-W, 1, -D, W, 6 + lv, D, OCHRE);
    for (let y = 2; y < 6 + lv; y += 3) for (let x = -W + 2; x < W - 2; x += 4) v.put(x, y, D - 1, "#3a3d46");
    for (let k = 0; k < 3; k++) v.put(W - 2 + (k - 1), 8 + lv - (k === 1 ? 1 : 0), D, GOLD);
    roof(v, -W, W, -D, D, 6 + lv);
  } else {
    // Treasury Tower: a squat fortified tower with battlements over the vault
    v.box(-W, 1, -D, W, 8 + lv, D, SERENA);
    for (let x = -W; x < W; x += 2) for (const z of [-D, D - 1]) v.put(x, 8 + lv, z, SERENA);
    for (let z = -D; z < D; z += 2) for (const x of [-W, W - 1]) v.put(x, 8 + lv, z, SERENA);
  }
  door(v, 0, D, 4);
  for (const x of [-3, 3]) v.box(x, 1, D + 1, x + 1, 3, D + 2, "#2a2a2a");
};

export const renCivic: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: post,
  courthouses: court,
  city_offices: offices,
  banks: bank,
};
