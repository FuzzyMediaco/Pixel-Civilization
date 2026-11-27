/**
 * World War II (civilian home front) civic five. Brick terraces, corrugated Nissen huts, sandbags,
 * blackout glazing and platform lamps. Massing follows CIVIC-FIVE-SPEC.md.
 */
import type { Ctx, PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { crowd, disc, neon, classicCar } from "../commerceKit";

const BRICK = "#8f4a37", BRICK2 = "#6b3a2c", STONE = "#d9ceb3", SLATE = "#4b5560", NISSEN = "#7d867a";
const OLIVE = "#5b6142", SAND = "#c9b48a", BLACKOUT = "#1c2530", WARM = "#ffcf7a", RAIL = "#3a3a3a";
const CREAM = "#efe6cf", RED = "#9c2a2a", GRASS = "#6f9a4f";

const pave = (c: Ctx, z0: number, z1: number, col = "#9a948a") => c.v.box(-c.hx, 0, z0, c.hx, 1, z1, col);

/** Brick block with blackout windows (a few warm) and a slate roof ridge along x. */
function brickBlock(v: PixelVox, x0: number, x1: number, z0: number, z1: number, h: number, roof = true): number {
  v.box(x0, 1, z0, x1, h, z1, BRICK);
  for (let y = 3; y < h - 1; y += 3) for (let x = x0 + 1; x < x1 - 1; x += 3) v.box(x, y, z1 - 1, x + 2, y + 2, z1, (x * 7 + y) % 5 === 0 ? WARM : BLACKOUT, (x * 7 + y) % 5 === 0 ? 0.7 : 0);
  v.box(x0, h - 1, z0, x1, h, z1, STONE);
  if (!roof) return h;
  const d = z1 - z0;
  for (let k = 0; k < Math.ceil(d / 2); k++) v.box(x0, h + k, z0 + k, x1, h + k + 1, z1 - k, SLATE);
  return h + Math.ceil(d / 2);
}
/** Corrugated half-cylinder Nissen hut along x. */
function nissen(v: PixelVox, x0: number, x1: number, cz: number, r: number, col = NISSEN): void {
  for (let x = x0; x < x1; x++) for (let dz = -r; dz <= r; dz++) for (let y = 0; y <= r; y++) {
    const d = Math.hypot(dz, y);
    if (d > r + 0.3 || (d < r - 0.8 && x !== x0 && x !== x1 - 1)) continue;
    v.put(x, 1 + y, cz + dz, x === x0 || x === x1 - 1 ? (d < 1.6 && y < 3 ? WARM : CREAM) : x % 2 ? col : "#6c756a", x === x0 && d < 1.6 && y < 3 ? 0.6 : 0);
  }
}
function sandbags(v: PixelVox, x0: number, x1: number, z: number, h = 2): void {
  for (let y = 1; y <= h; y++) for (let x = x0; x < x1; x++) v.put(x, y, z, (x + y) % 2 ? SAND : "#b9a37a");
}
/** Railway carriage along x on a short track. */
function carriage(v: PixelVox, x0: number, x1: number, cz: number, body = "#2f5d3a"): void {
  for (let x = x0 - 1; x < x1 + 1; x++) for (const dz of [-1, 1]) v.put(x, 0, cz + dz, RAIL);
  v.box(x0, 1, cz - 2, x1, 2, cz + 3, "#222");
  v.box(x0, 2, cz - 2, x1, 6, cz + 3, body);
  for (let x = x0 + 1; x < x1 - 1; x += 2) v.box(x, 3, cz + 2, x + 1, 5, cz + 3, WARM, 0.6);
  for (let k = 0; k < 2; k++) v.box(x0, 6 + k, cz - 1 + k, x1, 7 + k, cz + 2 - k, k ? "#3a3a3a" : CREAM);
}
function lampPost(v: PixelVox, x: number, z: number, h = 5): void {
  v.box(x, 1, z, x + 1, h, z + 1, RAIL);
  v.put(x, h, z, WARM, 1.1);
}
function door(v: PixelVox, cx: number, z: number, h = 3): void {
  v.box(cx - 1, 1, z, cx + 1, h, z + 1, "#3b2a1e");
  v.put(cx - 1, h, z, WARM, 0.8);
}

// ----------------------------------------------------------------------------------- library
const library: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  pave(c, hz - 2, hz);
  if (s === 0) {
    // Lending Carriages: retired reading cars flank a platform; a glazed footbridge joins them at Lv4+
    const L = Math.min(hx - 1, 5 + lv * 4);
    const cars = lv >= 3 ? 2 : 1;
    const zs = cars === 2 ? [-Math.min(hz - 4, 5), Math.min(hz - 5, 3)] : [0];
    zs.forEach((z, i) => carriage(v, -L, L, z, i ? "#7a2a2a" : "#2f5d3a"));
    if (cars === 2) {
      const pz0 = zs[0] + 3, pz1 = zs[1] - 2;
      v.box(-L, 1, pz0, L, 2, pz1, STONE);
      for (let x = -L + 2; x < L; x += 5) lampPost(v, x, Math.round((pz0 + pz1) / 2));
      crowd(c, lv + 2, -L + 1, pz0, L - 1, pz1, 2);
      if (lv >= 4) for (let z = zs[0]; z <= zs[1]; z++) v.box(-2, 8, z, 2, 9, z + 1, "#bfe3ef", 0.3);
    } else crowd(c, 2, -L, 3, L, Math.min(hz - 1, 5));
  } else if (s === 1) {
    // Nissen Hut Library: corrugated huts in a row with a reading garden of allotment beds
    const n = Math.min(4, Math.max(1, lv - 1)), r = Math.min(4, 2 + Math.floor(lv / 2));
    const span = Math.min(hx - 1, 4 + lv * 3);
    for (let i = 0; i < n; i++) {
      const z = -hz + r + 2 + i * (2 * r + 2);
      if (z + r > hz - 4) break;
      nissen(v, -span, span, z, r, i % 2 ? NISSEN : "#7a8a70");
    }
    for (let x = -span; x < span; x += 3) v.box(x, 1, hz - 4, x + 2, 2, hz - 3, x % 2 ? GRASS : "#8bb35f");
  } else if (s === 2) {
    // Shelter Reading Room: a half-buried turf-roofed shelter with a sandbagged porch, growing into reading lawns
    const w = Math.min(hx - 1, 3 + lv * 3), d = Math.min(hz - 3, 3 + lv * 2);
    for (let x = -w; x < w; x++) for (let z = -d; z < d; z++) {
      const k = Math.min(x + w, w - 1 - x, z + d, d - 1 - z);
      v.box(x, 1, z, x + 1, 1 + Math.min(4 + Math.floor(lv / 2), k + 1), z + 1, k < 1 ? "#8a8578" : GRASS);
    }
    door(v, 0, d, 3);
    sandbags(v, -4, 5, d + 1, 2);
    crowd(c, lv, -w + 2, -d + 2, w - 2, d - 2, 5 + Math.floor(lv / 2));
  } else {
    // Terrace Lending Library: a row of brick terraces knocked through, with bay windows and a communal garden
    const n = Math.min(6, 1 + lv), uw = 5;
    const x0 = -Math.floor((n * uw) / 2);
    for (let i = 0; i < n; i++) {
      const bx = x0 + i * uw;
      const fz = Math.min(hz - 6, -hz + 7 + lv * 2);
      brickBlock(v, bx, bx + uw, -hz + 2, fz, 7 + (i % 2));
      v.box(bx + 1, 1, fz, bx + 4, 5, fz + 1, WARM, 0.6); // bay
    }
    const fz = Math.min(hz - 6, -hz + 7 + lv * 2);
    door(v, 0, fz);
    for (let x = x0; x < x0 + n * uw; x += 2) v.box(x, 1, fz + 2, x + 1, 2, hz - 2, GRASS);
    crowd(c, lv, x0, fz + 2, x0 + n * uw, hz - 2);
  }
};

// ----------------------------------------------------------------------------------- post office
const post: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const L = Math.min(hx - 1, 5 + lv * 4), D = Math.min(hz - 3, 3 + lv);
  pave(c, -hz, hz);
  if (s === 0) {
    // Rail Mail Shed: sawtooth roof over a siding with a mail van
    v.box(-L, 1, -D, L, 6, 0, BRICK);
    for (let x = -L; x < L; x++) v.box(x, 6, -D, x + 1, 6 + ((x + L) % 4), 1, (x + L) % 4 === 3 ? "#bfe3ef" : SLATE);
    carriage(v, -L + 1, Math.min(L - 1, -L + 12), 3, RED);
  } else if (s === 1) {
    // Pigeon Loft Post: a brick counter with a timber loft tower and birds over the yard
    brickBlock(v, -L, L - 6, -D, 0, 6);
    v.box(L - 5, 1, -D, L - 1, 8 + lv * 2, -D + 4, "#7a5a3a");
    for (let y = 4; y < 8 + lv * 2; y += 2) v.box(L - 5, y, -D + 4, L - 1, y + 1, -D + 5, CREAM);
    for (let i = 0; i < 3 + lv; i++) v.put(L - 8 + (i * 3) % 7, 10 + lv * 2 + (i % 3), -D + (i % 4), "#d9d9d9");
  } else if (s === 2) {
    // Field Post Depot: Nissen sorting huts with crates and lorries in the yard
    nissen(v, -L, L, -D + 3, 3);
    for (let x = -L + 2; x < L - 2; x += 4) v.box(x, 1, 1, x + 2, 3, 3, "#8a6a3a");
  } else {
    // Despatch Riders' Yard: brick office with a long canopy and a line of motorcycles
    brickBlock(v, -L, L, -D, -1, 6, false);
    v.box(-L, 5, -1, L, 6, 3, OLIVE);
    for (let x = -L + 2; x < L - 1; x += 3) { v.box(x, 1, 2, x + 2, 2, 3, "#222"); v.put(x, 2, 2, OLIVE); }
  }
  door(v, -2, 0);
  neon(v, "POST", -L + 1, 2, 1, RED, { emit: 0.4 });
  for (let i = 0; i < Math.min(3, lv); i++) classicCar(v, -L + 2 + i * 8, Math.min(hz - 4, D + 3), "x", i % 2 ? RED : OLIVE);
  crowd(c, lv, -L, 2, L, Math.min(hz - 1, 5));
};

// ----------------------------------------------------------------------------------- courthouse
const court: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 5 + lv * 3), D = Math.min(hz - 4, 4 + lv * 2);
  const z1 = Math.min(hz - 5, D - 1), z0 = -D;
  const st = Math.min(4, hz - z1 - 1);
  for (let k = 0; k < st; k++) v.box(-6, 1, z1 + k, 7, 1 + st - k, z1 + k + 1, STONE);
  pave(c, z1 + st, hz);
  const H = 8 + lv * 2;
  let top: number;
  if (s === 0) {
    // Town Hall Assizes: symmetric brick hall with a central clock tower and stone portico
    top = brickBlock(v, -W, W, z0, z1, H, true);
    v.box(-2, 1, z0 + 2, 3, top + 4 + lv, z0 + 7, BRICK2);
    v.box(-2, top + 4 + lv, z0 + 2, 3, top + 5 + lv, z0 + 7, STONE);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) v.put(dx + 1, top + 1 + lv + dy, z0 + 7, dx === 0 && dy === 0 ? "#222" : CREAM, 0.5);
    for (let x = -5; x <= 5; x += 2) v.box(x, 1 + st, z1, x + 1, H - 1, z1 + 1, STONE);
  } else if (s === 1) {
    // Sandbagged Grand Court: neoclassical stone with sandbagged steps and taped windows
    v.box(-W, 1, z0, W, H, z1, STONE);
    for (let x = -W + 1; x < W; x += 2) v.box(x, 2, z1, x + 1, H - 2, z1 + 1, CREAM);
    for (let k = 0; k < 4; k++) v.box(-W + k * 2, H + k, z0 + k, W - k * 2, H + k + 1, z1 - k, STONE);
    top = H + 4;
    sandbags(v, -W, -3, z1 + st, 2); sandbags(v, 4, W, z1 + st, 2);
  } else if (s === 2) {
    // Tribunal Keep: a tall stripped tower with flags at the corners
    v.box(-W + 2, 1, z0, W - 2, H + 6, z1, BRICK2);
    for (let y = 3; y < H + 5; y += 3) v.box(-W + 3, y, z1 - 1, W - 3, y + 1, z1, BLACKOUT);
    for (let x = -W + 2; x < W - 2; x += 3) v.box(x, 1, z1, x + 1, H + 6, z1 + 1, STONE);
    for (let k = 0; k < 3; k++) v.box(-W + 3 + k * 2, H + 6 + k * 2, z0 + 1 + k, W - 3 - k * 2, H + 8 + k * 2, z1 - 1 - k, k % 2 ? STONE : BRICK2);
    top = H + 12;
    for (const x of [-W + 2, W - 3]) { v.box(x, top, z1 - 1, x + 1, top + 5, z1, RAIL); v.box(x, top + 3, z1 - 1, x + 3 * Math.sign(-x), top + 5, z1, RED); }
  } else {
    // Commission Hall: stripped classicism, giant pilasters and a deep recessed entrance
    v.box(-W, 1, z0, W, H + 3, z1, CREAM);
    for (let x = -W; x < W; x += 3) v.box(x, 1, z1, x + 1, H + 3, z1 + 1, STONE);
    v.box(-3, 1, z1 - 2, 4, H, z1 + 1, "#2a2a2a");
    top = H + 3;
    v.box(-W, top, z0, W, top + 1, z1 + 1, STONE);
  }
  door(v, 0, z1, 5);
  crowd(c, lv + 1, -W, z1 + st, W, hz);
  void top;
};

// ----------------------------------------------------------------------------------- city offices
const offices: SignatureBuilder = (c, _p, active) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const tw = Math.min(hx - 2, 3 + lv), tz0 = -hz + 1, tz1 = tz0 + Math.min(Math.floor(hz * 1.2), 6 + lv);
  const sq = tz1 + 1;
  pave(c, sq, hz, "#b8b0a0");
  const H = 10 + lv * 4;
  let top: number;
  if (s === 0) {
    // Civil Defence HQ: brick tower with an air-raid siren and a sandbagged square
    top = brickBlock(v, -tw, tw, tz0, tz1, H, false);
    v.box(-1, top, tz0 + 2, 2, top + 2, tz0 + 4, "#888");
    v.box(-2, top + 2, tz0 + 1, 3, top + 4, tz0 + 5, "#a0a0a0");
    sandbags(v, -hx + 1, -2, Math.min(hz - 2, sq + 2), 2); sandbags(v, 3, hx - 1, Math.min(hz - 2, sq + 2), 2);
  } else if (s === 1) {
    // Clock Tower Town Hall: a hall with the island's tallest clock
    brickBlock(v, -tw - 2, tw + 2, tz0, tz1, 8, true);
    v.box(-2, 1, tz1 - 4, 3, H + 4, tz1, BRICK2);
    top = H + 4;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.hypot(dx, dy) < 2.6) v.put(dx + 0, top - 4 + dy, tz1, Math.hypot(dx, dy) > 1.6 ? STONE : CREAM, active ? 0.8 : 0.4);
    for (let k = 0; k < 4; k++) v.box(-2 + Math.floor(k / 2), top + k, tz1 - 4 + Math.floor(k / 2), 3 - Math.floor(k / 2), top + k + 1, tz1 - Math.floor(k / 2), SLATE);
  } else if (s === 2) {
    // Ministry Radio Mast: a block crowned by a lattice wireless mast
    top = brickBlock(v, -tw, tw, tz0, tz1, H, false);
    for (let k = 0; k < 10 + lv * 2; k++) { v.put(0, top + k, tz0 + 3, RAIL); if (k % 3 === 0) v.box(-1, top + k, tz0 + 3, 2, top + k + 1, tz0 + 4, RAIL); }
    v.put(0, top + 10 + lv * 2, tz0 + 3, "#ff4d4d", 1.3);
  } else {
    // Ration Board Offices: a stone block over a square with notice boards and a long queue
    v.box(-tw, 1, tz0, tw, H - 2, tz1, STONE);
    for (let y = 3; y < H - 3; y += 3) v.box(-tw + 1, y, tz1 - 1, tw - 1, y + 2, tz1, BLACKOUT);
    top = H - 2;
    for (let x = -hx + 2; x < hx - 2; x += 6) v.box(x, 1, sq + 1, x + 3, 4, sq + 2, CREAM);
    for (let i = 0; i < 4 + lv * 2; i++) v.box(-hx + 2 + i * 2, 1, Math.min(hz - 2, sq + 4), -hx + 3 + i * 2, 3, Math.min(hz - 1, sq + 5), ["#5b6142", "#6b3a2c", "#3a4a6a"][i % 3]);
  }
  door(v, 0, tz1, 4);
  v.box(hx - 3, 1, sq + 1, hx - 2, 12, sq + 2, RAIL);
  v.box(hx - 6, 9, sq + 1, hx - 3, 11, sq + 2, RED);
  crowd(c, lv * 2, -hx + 1, sq + 1, hx - 1, hz);
  void top;
};

// ----------------------------------------------------------------------------------- bank
const bank: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 4 + lv * 2), D = Math.min(hz - 3, 4 + lv * 2), H = 5 + lv;
  pave(c, D, hz);
  if (s === 0) {
    // Sandbagged Vault: a stone strongroom walled in sandbags
    v.box(-W + 1, 1, -D + 1, W - 1, H + 1, D - 1, STONE);
    for (let x = -W; x < W; x++) for (const z of [-D, D - 1]) for (let y = 1; y < 4; y++) v.put(x, y, z, (x + y) % 2 ? SAND : "#b9a37a");
  } else if (s === 1) {
    // War Bonds Bank: brick and stone with poster boards and a flag
    brickBlock(v, -W, W, -D, D, H + 2, false);
    for (let x = -W + 1; x < W - 3; x += 4) v.box(x, 2, D, x + 3, 5, D + 1, x % 8 === 0 ? RED : "#2c4a7a");
    v.box(W - 2, H + 2, D - 2, W - 1, H + 8, D - 1, RAIL);
    v.box(W - 5, H + 6, D - 2, W - 2, H + 8, D - 1, RED);
  } else if (s === 2) {
    // Bunker Treasury: poured concrete, a single armored door, gun-slit windows
    v.box(-W, 1, -D, W, H, D, "#9a9a94");
    for (let k = 0; k < 2; k++) v.box(-W + 1 + k, H + k, -D + 1 + k, W - 1 - k, H + k + 1, D - 1 - k, "#8a8a84");
    for (let x = -W + 2; x < W - 2; x += 4) v.box(x, H - 2, D - 1, x + 2, H - 1, D, BLACKOUT);
  } else {
    // Brick Savings Bank: heavy brick with iron-grilled windows and a stone cornice
    brickBlock(v, -W, W, -D, D, H + 2, false);
    for (let x = -W + 1; x < W - 1; x += 3) for (let y = 2; y < H; y += 1) v.put(x + 1, y, D, RAIL);
  }
  door(v, 0, D, 4);
  v.box(-5, 5, D, 6, 7, D + 1, STONE);
  for (let x = -4; x < 5; x += 2) v.put(x, 6, D + 1, "#3b2a1e");
  void disc;
};

export const warCivic: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: post,
  courthouses: court,
  city_offices: offices,
  banks: bank,
};
