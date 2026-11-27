/**
 * Art Deco metropolis civic five: Fanlight Library, streamline mail terminal, setback Hall of Justice,
 * setback city tower over a plaza, and a heavy gilded vault. Massing follows CIVIC-FIVE-SPEC.md:
 * library low and open, post long shed + yard, court tall and symmetric, offices tower + square,
 * bank squat and closed. Every variant changes the plan; every level adds a structural idea.
 */
import type { Ctx, PixelVox } from "../kit";
import type { Ink, SignatureBuilder } from "../periodArtCatalog";
import { crowd, disc, neon, neonWidth, spinner, classicCar, bulbs } from "../commerceKit";

const STONE = "#e9dfc7", STONE2 = "#d8cbad", BLACK = "#1b1b22", GOLD = "#d4a437", TEAL = "#1a7f7a";
const AMBER = "#ffc46b", CHROME = "#cfd6de", BURG = "#7a1f2b", TERRAZZO = "#e6ddc8";

const lotPave = (c: Ctx, z0: number, z1: number) => c.v.box(-c.hx, 0, z0, c.hx, 1, z1, TERRAZZO);

/** Setback block: tiers shrink inward; gold band at each setback. Returns the top y. */
function setback(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y0: number, tiers: number, tierH: number, inset: number, wall = STONE, band = GOLD): number {
  let y = y0;
  for (let t = 0; t < tiers; t++) {
    const k = t * inset;
    if (x1 - x0 - 2 * k < 2 || z1 - z0 - 2 * k < 2) break;
    v.box(x0 + k, y, z0 + k, x1 - k, y + tierH, z1 - k, wall);
    // vertical window strips on the street face
    for (let x = x0 + k + 1; x < x1 - k - 1; x += 2) v.box(x, y + 1, z1 - k - 1, x + 1, y + tierH - 1, z1 - k, (x + t) % 4 === 1 ? AMBER : "#2a3340", (x + t) % 4 === 1 ? 0.55 : 0);
    v.box(x0 + k, y + tierH - 1, z0 + k, x1 - k, y + tierH, z1 - k, band);
    y += tierH;
  }
  return y;
}
function fluted(v: PixelVox, x: number, z: number, y0: number, y1: number, col = STONE2): void {
  v.box(x, y0, z, x + 1, y1, z + 1, col);
  v.put(x, y1, z, GOLD);
}
function sunburst(v: PixelVox, cx: number, y: number, z: number, r: number): void {
  for (let a = 0; a <= 8; a++) {
    const ang = (a / 8) * Math.PI;
    for (let k = 1; k <= r; k++) v.put(Math.round(cx + Math.cos(ang) * k), Math.round(y + Math.sin(ang) * k), z, a % 2 ? GOLD : "#f2d27a", a % 2 ? 0.3 : 0.6);
  }
  v.put(cx, y, z, AMBER, 1);
}
function doorway(v: PixelVox, cx: number, z: number, w: number, h: number): void {
  v.box(cx - w - 1, 1, z, cx + w + 2, h + 2, z + 1, BLACK);
  v.box(cx - w, 1, z, cx + w + 1, h, z + 1, AMBER, 0.85);
  for (let k = 0; k <= w + 1; k++) { v.put(cx - k, h + 1 + Math.floor(k / 2), z, GOLD); v.put(cx + k, h + 1 + Math.floor(k / 2), z, GOLD); }
}
function fountain(v: PixelVox, cx: number, cz: number, r: number): void {
  disc(v, cx, cz, 1, 2, r, (_x, _y, _z, d) => (d > r - 1 ? STONE2 : "#5fb7c9"));
  v.box(cx, 2, cz, cx + 1, 4, cz + 1, GOLD);
  v.put(cx, 4, cz, "#bfe9ff", 0.6);
}
const S = (c: Ctx) => [0.5, 0.65, 0.8, 0.9, 1][c.lv - 1];

// ----------------------------------------------------------------------------------- library
/** Fanlight Library: low reading rooms that spread from a lobby; never taller than the civic tower. */
const library: SignatureBuilder = (c, _p, active) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  lotPave(c, hz - 3, hz);
  const H = 4 + lv;
  if (s === 0) {
    // Fan Reading Room: a half-disc of radiating reading rooms with an amber clerestory ring
    const r = Math.min(hx - 1, hz * 2 - 3, 5 + lv * 3);
    const cz = hz - 3;
    for (let x = -r; x <= r; x++) for (let z = cz - r; z <= cz; z++) {
      const d = Math.hypot(x, z - cz);
      if (d > r) continue;
      const a = Math.atan2(cz - z, x);
      const rib = Math.abs(Math.sin(a * (4 + lv))) < 0.16;
      const hh = Math.round(H * (0.6 + 0.4 * (1 - d / r)));
      if (d > r - 1.2 || rib) v.box(x, 1, z, x + 1, hh, z + 1, rib ? GOLD : STONE);
      v.put(x, hh, z, d < r * 0.35 ? AMBER : d > r - 1.2 ? GOLD : TEAL, d < r * 0.35 ? 0.7 : 0);
    }
    doorway(v, 0, cz + 1, 1, 4);
    if (lv >= 3) for (const sx of [-1, 1]) fluted(v, sx * Math.round(r * 0.45), cz, 1, H + 3, BLACK);
  } else if (s === 1) {
    // Twin Bookends: two fluted bookend towers framing an amber clerestory reading hall
    const w = Math.min(hx - 1, 4 + lv * 3), d = Math.min(hz * 2 - 5, 6 + lv * 2);
    const z0 = hz - 3 - d;
    v.box(-w, 1, z0, w, H, hz - 3, STONE);
    v.box(-w + 2, H, z0 + 1, w - 2, H + 2, hz - 4, AMBER, 0.6);
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? -w - 1 : w - 2;
      v.box(x, 1, z0 - 1, x + 3, H + 4 + lv, hz - 2, BLACK);
      for (let y = 2; y < H + 3 + lv; y += 2) v.put(x + 1, y, hz - 2, GOLD);
      v.box(x, H + 4 + lv, z0 - 1, x + 3, H + 5 + lv, hz - 2, GOLD);
    }
    doorway(v, 0, hz - 3, 1, 4);
    if (lv >= 2) sunburst(v, 0, H - 1, hz - 3, 2 + Math.floor(lv / 2));
  } else if (s === 2) {
    // Streamline Reading Deck: a long rounded wing with ribbon windows and a rooftop reading terrace
    const L = Math.min(hx - 1, 5 + lv * 4), D = Math.min(hz - 2, 3 + lv);
    for (let x = -L; x < L; x++) for (let z = -D; z < D; z++) {
      const endD = Math.max(0, Math.abs(x + 0.5) - (L - D));
      if (Math.hypot(endD, z + 0.5) > D) continue;
      for (let y = 1; y < H; y++) v.put(x, y, z, y % 2 === 0 && Math.hypot(endD, z + 0.5) > D - 1 ? AMBER : STONE, y % 2 === 0 ? 0.5 : 0);
      v.put(x, H, z, (x + z) % 2 ? "#5fa356" : TERRAZZO);
    }
    for (let k = 0; k < 3; k++) v.box(-L, 2 + k * 2, D - 1, -L + 4 + k * 2, 3 + k * 2, D, TEAL); // speed lines
    doorway(v, 0, D, 1, 3);
    if (lv >= 3) crowd(c, 2 + lv, -L + 2, -D + 1, L - 2, D - 1, H + 1);
  } else {
    // Sunburst Court: a low U of reading rooms around a terrazzo sunburst court
    const w = Math.min(hx - 1, 5 + lv * 3), d = Math.min(hz * 2 - 4, 6 + lv * 2);
    const z0 = hz - 2 - d;
    v.box(-w, 1, z0, w, H, z0 + 3, STONE);
    v.box(-w, 1, z0, -w + 3, H, hz - 2, STONE);
    v.box(w - 3, 1, z0, w, H, hz - 2, STONE);
    for (const x of [-w, w - 3]) v.box(x, H, z0, x + 3, H + 1, hz - 2, GOLD);
    for (let x = -w + 3; x < w - 3; x++) for (let z = z0 + 3; z < hz - 2; z++) {
      const a = Math.atan2(z - (hz - 2), x);
      v.put(x, 0, z, Math.floor((a / Math.PI) * 12) % 2 ? "#f2d27a" : TERRAZZO);
    }
    doorway(v, 0, z0 + 3, 1, 3);
    if (lv >= 2) crowd(c, lv + 1, -w + 4, z0 + 4, w - 4, hz - 3);
  }
  if (active) v.put(0, H + 1, hz - 4, AMBER, 1.2);
};

// ----------------------------------------------------------------------------------- post office
/** Long shed plus working yard: the mail path runs counter → sorting → vans. */
const post: SignatureBuilder = (c, _p) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const L = Math.min(hx - 1, 5 + lv * 4), D = Math.min(hz - 1, 4 + lv);
  const H = 5 + Math.min(lv, 3);
  lotPave(c, -hz, hz);
  const yardZ = Math.min(hz - 1, D + 1);
  if (s === 0) {
    // Streamline Mail Terminal: rounded shed, speed lines, sawtooth docks
    for (let x = -L; x < L; x++) for (let z = -D; z < 1; z++) {
      const endD = Math.max(0, Math.abs(x + 0.5) - (L - 3));
      if (Math.hypot(endD, Math.max(0, -z - (D - 3))) > 3) continue;
      v.box(x, 1, z, x + 1, H, z + 1, STONE);
    }
    for (let k = 0; k < 3; k++) v.box(-L + 1, 2 + k, 0, -L + 6 + k * 3, 3 + k, 1, k % 2 ? TEAL : BURG);
    for (let x = -L + 2; x < L - 2; x += 4) v.box(x, 1, 1, x + 3, 3, 2, "#3a3d46");
  } else if (s === 1) {
    // Pneumatic Tube Hall: glass tubes arch from the counter hall over the yard to the sorting drum
    v.box(-L, 1, -D, -1, H, 0, STONE);
    disc(v, L - 4, -D / 2, 1, H + 2, Math.min(4, D / 2 + 1), (_x, y, _z, d) => (d > 2.8 ? (y % 3 ? STONE : GOLD) : null));
    for (let t = 0; t < 3; t++) for (let i = 0; i <= 2 * L - 6; i++) {
      const x = -1 + i * ((L - 3) / (2 * L - 6)), y = H + Math.round(Math.sin((i / (2 * L - 6)) * Math.PI) * (3 + lv));
      v.put(Math.round(x), y + t, -D / 2 + t - 1, i % 5 === 2 ? AMBER : "#bfe3ef", i % 5 === 2 ? 0.9 : 0.25);
    }
  } else if (s === 2) {
    // Airmail Hangar: barrel hangar with a mail plane on the apron and a beacon mast
    for (let x = -L; x < L; x++) for (let z = -D; z < 0; z++) {
      const top = Math.round(H * Math.sqrt(Math.max(0, 1 - ((z + D / 2) / (D / 2)) ** 2)));
      for (let y = 1; y <= top + 1; y++) if (y === top + 1 || x === -L || x === L - 1) v.put(x, y, z, y === top + 1 ? (x % 3 ? CHROME : GOLD) : STONE);
    }
    const px = -2, pz = Math.min(yardZ, hz - 3);
    v.box(px - 4, 2, pz, px + 5, 3, pz + 1, BURG);
    v.box(px, 1, pz - 2, px + 1, 3, pz + 3, BURG);
    v.box(px + 4, 3, pz, px + 5, 5, pz + 1, BURG);
    v.box(L - 2, 1, -D, L - 1, H + 6 + lv, -D + 1, BLACK);
    v.put(L - 2, H + 7 + lv, -D, "#ff4d4d", 1.3);
  } else {
    // Zigzag Sorting Arcade: zigzag roof, visible conveyor and parcel stacks under the eaves
    v.box(-L, 1, -D, L, H - 1, 0, STONE);
    for (let x = -L; x < L; x++) v.box(x, H - 1 + Math.abs(((x + L) % 6) - 3), -D, x + 1, H + Math.abs(((x + L) % 6) - 3), 1, BLACK);
    for (let x = -L + 1; x < L - 1; x++) v.put(x, 2, 1, x % 3 ? "#3a3d46" : GOLD);
    for (let x = -L + 2; x < L - 2; x += 5) v.box(x, 3, 1, x + 2, 4, 2, "#c98b45");
  }
  doorway(v, -Math.min(L - 3, 3), 1, 1, 3);
  neon(v, "MAIL", -Math.min(L - 1, 8), H + 1, 0, "#ff5f5f", { emit: 1.2 });
  const vans = Math.min(4, lv);
  for (let i = 0; i < vans; i++) classicCar(v, -L + 2 + i * 7, Math.min(hz - 4, yardZ + 1), "z", i % 2 ? BURG : TEAL);
  if (lv >= 2) crowd(c, lv, -L, 2, L, Math.min(hz - 1, 4));
};

// ----------------------------------------------------------------------------------- courthouse
/** Tall, symmetric and stepped: one axis, a long ceremonial stair, a dominant crown. */
const court: SignatureBuilder = (c, _p, active) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 5 + lv * 3), D = Math.min(hz - 3, 4 + lv * 2);
  const z0 = -D - 1, z1 = Math.min(hz - 5, D - 1);
  // ceremonial stair across the front
  const stair = Math.min(4, hz - z1 - 1);
  for (let k = 0; k < stair; k++) v.box(-Math.min(W, 4 + lv), 1, z1 + k, Math.min(W, 4 + lv), 1 + stair - k, z1 + k + 1, STONE2);
  lotPave(c, z1 + stair, hz);
  const tiers = 2 + Math.min(3, lv);
  const tierH = 4 + Math.floor(lv / 2);
  let top: number;
  if (s === 0) {
    // Ziggurat Hall of Justice
    top = setback(v, -W, W, z0, z1, 1 + stair, tiers, tierH, 2);
    v.box(-1, top, (z0 + z1) / 2 - 1, 2, top + 3 + lv, (z0 + z1) / 2 + 2, GOLD);
  } else if (s === 1) {
    // Scales Pylons: two black pylons flank a gold scales emblem over the hall
    top = setback(v, -W + 4, W - 4, z0, z1, 1 + stair, tiers - 1, tierH, 1);
    for (const sx of [-1, 1]) setback(v, sx < 0 ? -W : W - 4, sx < 0 ? -W + 4 : W, z0, z1, 1 + stair, tiers + 1, tierH, 0, BLACK, GOLD);
    const sy = top + 2, sz = z1 - 1;
    v.box(0, top, sz, 1, sy + 4, sz + 1, GOLD);
    v.box(-5, sy + 4, sz, 6, sy + 5, sz + 1, GOLD);
    for (const x of [-5, 5]) { v.box(x - 1, sy + 1, sz, x + 2, sy + 2, sz + 1, GOLD); v.box(x, sy + 2, sz, x + 1, sy + 4, sz + 1, GOLD); }
  } else if (s === 2) {
    // Column Screen: a deep screen of fluted pillars before a high judgment hall
    top = 1 + stair + tierH * tiers;
    v.box(-W, 1 + stair, z0, W, top, z1 - 3, STONE);
    for (let x = -W + 1; x < W; x += 2) fluted(v, x, z1 - 1, 1 + stair, top - 1);
    v.box(-W, top - 1, z0, W, top + 1, z1, BLACK);
    v.box(-W + 2, top + 1, z0 + 2, W - 2, top + 2, z1 - 2, GOLD);
  } else {
    // Spire Tribunal: a symmetric block crowned by a stainless needle spire
    top = setback(v, -W, W, z0, z1, 1 + stair, tiers, tierH, 1, STONE, BLACK);
    const cz = Math.round((z0 + z1) / 2);
    for (let k = 0; k < 6 + lv * 2; k++) { const r = Math.max(0, 2 - Math.floor(k / 4)); v.box(-r, top + k, cz - r, r + 1, top + k + 1, cz + r + 1, k % 3 === 0 ? GOLD : CHROME); }
  }
  doorway(v, 0, z1 - 1, 2, 5);
  if (lv >= 3) sunburst(v, 0, 1 + stair + tierH, z1, 3);
  if (active) v.put(0, top + 1, z1 - 2, AMBER, 1);
  crowd(c, lv + 1, -W, z1 + stair, W, hz);
};

// ----------------------------------------------------------------------------------- city offices
/** Tower plus square: the tallest of the five, fronting a public plaza. */
const offices: SignatureBuilder = (c, _p, active) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const tw = Math.min(hx - 2, 3 + lv), td = Math.min(Math.floor(hz * 0.6), 3 + lv);
  const tz0 = -hz + 1, tz1 = tz0 + td * 2;
  const plazaZ = tz1 + 1;
  v.box(-hx, 0, plazaZ, hx, 1, hz, TERRAZZO);
  if (plazaZ < hz - 3) fountain(v, 0, Math.round((plazaZ + hz) / 2), Math.min(3, Math.floor((hz - plazaZ) / 2) - 1));
  const tiers = 2 + lv, tierH = 4 + Math.floor(lv / 2);
  let top = setback(v, -tw, tw, tz0, tz1, 1, tiers, tierH, s === 0 ? 1 : 0, s === 2 ? STONE2 : STONE, s === 1 ? TEAL : GOLD);
  const cz = Math.round((tz0 + tz1) / 2);
  if (s === 0) {
    // Setback Tower: classic needle with a gold crown
    for (let k = 0; k < 4 + lv; k++) v.box(-1, top + k, cz - 1, 1, top + k + 1, cz + 1, k % 2 ? GOLD : CHROME);
  } else if (s === 1) {
    // Radio Mast Hall: lattice mast and a blinking beacon
    for (let k = 0; k < 8 + lv * 2; k++) { v.put(-1, top + k, cz, BLACK); v.put(1, top + k, cz, BLACK); if (k % 2) v.put(0, top + k, cz, CHROME); }
    v.put(0, top + 9 + lv * 2, cz, "#ff4d4d", 1.4);
  } else if (s === 2) {
    // Clock Ziggurat: a stepped crown carrying a lit clock face
    for (let k = 0; k < 3; k++) v.box(-tw + k + 1, top + k, tz0 + k + 1, tw - k - 1, top + k + 1, tz1 - k - 1, k % 2 ? GOLD : STONE);
    top += 3;
    const r = Math.min(3, tw - 1);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.hypot(dx, dy) <= r + 0.3) v.put(dx, top - 6 + dy, tz1, Math.hypot(dx, dy) > r - 1 ? GOLD : dx === 0 && dy >= 0 ? BLACK : "#fff6d0", 0.6);
  } else {
    // Twin-Spire Civic Center: two slimmer towers joined by a sky bridge
    for (const sx of [-1, 1]) setback(v, sx * (tw + 1) - (sx < 0 ? 3 : 0), sx * (tw + 1) + (sx > 0 ? 3 : 0), tz0, tz0 + 6, 1, tiers - 1, tierH, 0, BLACK, GOLD);
    v.box(-tw - 4, Math.round(top * 0.6), tz0 + 2, tw + 4, Math.round(top * 0.6) + 2, tz0 + 4, AMBER, 0.5);
  }
  doorway(v, 0, tz1, 1, 4);
  // flag over the square
  v.box(hx - 3, 1, plazaZ + 1, hx - 2, 12, plazaZ + 2, CHROME);
  v.box(hx - 6, 9, plazaZ + 1, hx - 3, 11, plazaZ + 2, BURG);
  if (active) bulbs(v, -hx + 1, plazaZ, hx - 1, plazaZ, 5, [AMBER, "#fff6d0"]);
  crowd(c, 2 + lv * 2, -hx + 1, plazaZ + 1, hx - 1, hz);
};

// ----------------------------------------------------------------------------------- bank
/** Squat, heavy and closed: thick walls, a single guarded door, a visible strongroom. */
const bank: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 4 + lv * 2), D = Math.min(hz - 3, 4 + lv * 2);
  const H = 5 + lv;
  lotPave(c, D, hz);
  if (s === 0) {
    // Vault Drum: a round strongroom drum on a black plinth, stepped crown
    v.box(-W, 1, -D, W, 3, D, BLACK);
    for (let k = 0; k < 3; k++) disc(v, 0, 0, 3 + k * Math.ceil(H / 3), 3 + (k + 1) * Math.ceil(H / 3), Math.min(W, D) - 1 - k * 1.5, (_x, y, _z, d) => (y % 3 === 0 ? GOLD : STONE));
  } else if (s === 1) {
    // Gilded Strongbox: black granite box wrapped in gold bands, tiny high windows
    v.box(-W, 1, -D, W, H + 2, D, BLACK);
    for (let y = 3; y < H + 2; y += 3) v.box(-W, y, -D, W, y + 1, D, GOLD);
    for (let x = -W + 2; x < W - 2; x += 4) v.put(x, H, D - 1, AMBER, 0.6);
  } else if (s === 2) {
    // Coin Rotunda: square base topped by a stacked-coin dome
    v.box(-W, 1, -D, W, H, D, STONE);
    let r = Math.min(W, D) - 1;
    for (let k = 0; k < 4 + lv; k++) { disc(v, 0, 0, H + k, H + k + 1, r, (x, _y, z, d) => (d > r - 1 ? (Math.floor(Math.atan2(z, x) * 6) % 2 ? GOLD : "#f2d27a") : GOLD)); r = Math.max(1, r - 0.8); }
  } else {
    // Bronze Doors: a sheer stone front almost all door, under a sunburst
    v.box(-W + 2, 1, -D + 2, W - 2, H + 3, D, STONE2);
    for (let x = -W + 2; x < W - 2; x += 2) fluted(v, x, D, 1, H + 2, x % 4 === 0 ? STONE : STONE2);
    for (let k = 0; k < 3; k++) v.box(-W + 3 + k * 2, H + 3 + k, -D + 3 + k, W - 3 - k * 2, H + 4 + k, D - 1 - k, k % 2 ? GOLD : BLACK);
    v.box(-3, 1, D - 1, 4, H, D + 1, "#8a5a2b");
    v.box(0, 1, D, 1, H, D + 1, GOLD);
    sunburst(v, 0, H + 1, D, 3);
  }
  doorway(v, 0, D, 1, 4);
  // guards and armored car
  for (const x of [-3, 3]) v.box(x, 1, D + 1, x + 1, 3, D + 2, BLACK);
  if (lv >= 3 && D + 4 < hz) classicCar(v, -W + 1, Math.min(hz - 4, D + 2), "x", "#3a3d46");
  if (lv >= 2) neon(v, "BANK", -Math.floor(neonWidth("BANK") / 2), H + (s === 0 ? -2 : 4), D + (s === 3 ? 1 : 0), GOLD, { emit: 0.9 });
  void spinner;
};

export const decoCivic: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: post,
  courthouses: court,
  city_offices: offices,
  banks: bank,
};
export type { Ink };
