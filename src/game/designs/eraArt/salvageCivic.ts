/**
 * Post-apocalyptic civic five: salvaged, patched and proudly repaired. Later levels add trees,
 * working machinery and places people are proud of. Massing follows CIVIC-FIVE-SPEC.md.
 */
import type { Ctx, PixelVox } from "../kit";
import type { SignatureBuilder } from "../periodArtCatalog";
import { crowd, disc, spinner } from "../commerceKit";

const RUST = "#9c5a2e", RUST2 = "#7a4426", SHEET = "#8a8f88", CONCRETE = "#9a958a", PLY = "#c4a46a";
const TEAL = "#3f8f8a", MUSTARD = "#c99a2e", FADED = "#a2463a", TARP = "#3f6f9a", GREEN = "#5c8f3e", LEAF = "#77ad55";
const LAMP = "#ffcf7a", DARK = "#2b2b2b";
const PATCH = [RUST, SHEET, TEAL, MUSTARD, FADED, PLY, TARP];
const patch = (x: number, y: number, z: number) => PATCH[Math.abs((Math.floor(x / 3) * 7 + Math.floor(y / 2) * 3 + Math.floor(z / 3) * 5)) % PATCH.length];

const ground = (c: Ctx, z0: number, z1: number) => c.v.box(-c.hx, 0, z0, c.hx, 1, z1, "#8a7d62");

/** Patchwork box: every wall is mismatched salvaged sheet. */
function patchBox(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) {
    const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1 || y === y1 - 1;
    if (!edge) continue;
    v.put(x, y, z, y === y1 - 1 ? SHEET : patch(x, y, z));
  }
}
function windows(v: PixelVox, x0: number, x1: number, y0: number, y1: number, z: number): void {
  for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) v.put(x, y, z, (x + y) % 2 ? LAMP : "#bfe3ef", (x + y) % 2 ? 0.7 : 0.2);
}
function planters(v: PixelVox, x0: number, x1: number, z: number, y = 1): void {
  for (let x = x0; x < x1; x += 2) { v.put(x, y, z, RUST2); v.put(x, y + 1, z, (x / 2) % 2 ? GREEN : LEAF); }
}
function tree(v: PixelVox, x: number, z: number, h = 5): void {
  v.box(x, 1, z, x + 1, h, z + 1, "#6b4a2a");
  disc(v, x, z, h, h + 3, 2.2, (_x, y) => (y === h + 2 ? LEAF : GREEN));
}
function sail(v: PixelVox, x0: number, x1: number, z0: number, z1: number, y: number, col: string): void {
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) v.put(x, y + ((x + z) % 3 === 0 ? 1 : 0), z, col);
  for (const [x, z] of [[x0, z0], [x1 - 1, z1 - 1]]) v.box(x, 1, z, x + 1, y, z + 1, RUST2);
}
function door(v: PixelVox, cx: number, z: number, h = 3): void {
  v.box(cx - 1, 1, z, cx + 1, h, z + 1, DARK);
  v.put(cx, h, z, LAMP, 1);
}

// ----------------------------------------------------------------------------------- library
const library: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  ground(c, hz - 2, hz);
  if (s === 0) {
    // Reservoir of Stories: a cistern sliced open to curved shelves, a greenhouse deck on its rim
    const r = Math.min(hx - 1, hz - 2, 4 + lv * 2), H = 4 + lv;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
      const d = Math.hypot(x, z);
      if (d > r) continue;
      const cut = z > r * 0.25; // the street side is sliced away
      if (d > r - 1.2 && !cut) for (let y = 1; y <= H; y++) v.put(x, y, z, y % 3 === 0 ? RUST2 : RUST);
      if (d > r - 2.4 && d <= r - 1.2 && !cut) for (let y = 1; y < H; y++) v.put(x, y, z, y % 2 ? ["#b4232c", TEAL, MUSTARD, "#f4ecd6"][(x + y) & 3] : PLY);
      v.put(x, 0, z, "#c4b48a");
      if (lv >= 2 && !cut && d > r - 2) v.put(x, H + 1, z, "#bfe9df", 0.25); // greenhouse deck on the rim
    }
    if (lv >= 3) for (let k = 0; k < 3; k++) tree(v, -r + 2 + k * r, 0, 4 + k);
    crowd(c, lv + 1, -r + 2, 0, r - 2, r);
  } else if (s === 1) {
    // Bookmobile Ring: old buses parked in a ring as reading rooms around a fire-pit court
    const n = Math.min(6, 1 + lv), R = Math.min(hx, hz) - 4;
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(n, 3)) * Math.PI * 2 + 0.3;
      const cx = Math.round(Math.cos(a) * (n === 1 ? 0 : R * 0.7)), cz = Math.round(Math.sin(a) * (n === 1 ? 0 : R * 0.7));
      const alongX = Math.abs(Math.sin(a)) > 0.7;
      const [x0, x1, z0, z1] = alongX ? [cx - 5, cx + 5, cz - 2, cz + 2] : [cx - 2, cx + 2, cz - 5, cz + 5];
      v.box(x0, 1, z0, x1, 5, z1, i % 2 ? MUSTARD : "#5b8a9a");
      v.box(x0, 3, z0, x1, 4, z1, "#bfe3ef", 0.3);
      v.box(x0, 5, z0, x1, 6, z1, SHEET);
    }
    if (n > 1) { v.box(-1, 1, -1, 2, 2, 2, CONCRETE); v.put(0, 2, 0, "#ff8a3d", 1.3); }
    crowd(c, lv + 1, -R / 2, -R / 2, R / 2, R / 2);
  } else if (s === 2) {
    // Container Stack Library: shipping containers with cut windows and roof gardens
    const n = Math.min(7, lv + 1);
    for (let i = 0; i < n; i++) {
      const layer = i < 3 ? 0 : i < 5 ? 1 : 2;
      const x = -hx + 2 + ((i * 11) % Math.max(12, 2 * hx - 14)), z = -hz + 2 + ((i * 5) % Math.max(4, hz));
      const y = 1 + layer * 5;
      v.box(x, y, z, x + 12, y + 5, z + 5, PATCH[i % PATCH.length]);
      windows(v, x + 1, x + 11, y + 2, y + 4, z + 4);
      planters(v, x, x + 12, z, y + 5);
    }
  } else {
    // Greenhouse Reading Dome: a patched geodesic dome full of plants and lamps
    const r = Math.min(hx - 1, hz - 2, 3 + lv * 2);
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (let y = 0; y <= r; y++) {
      const d = Math.hypot(x, z, y);
      if (d > r || d < r - 1) continue;
      const strut = (x + z + y) % 3 === 0;
      v.put(x, y + 1, z, strut ? RUST : (x * z + y) % 5 === 0 ? TARP : "#bfe9df", strut ? 0 : 0.2);
    }
    for (let k = 0; k < lv + 1; k++) tree(v, -r + 2 + ((k * 5) % (2 * r - 3)), -r + 2 + ((k * 3) % (2 * r - 3)), 3 + (k % 3));
    door(v, 0, r);
  }
};

// ----------------------------------------------------------------------------------- post office
const post: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const L = Math.min(hx - 1, 5 + lv * 4), D = Math.min(hz - 3, 3 + lv);
  ground(c, -hz, hz);
  if (s === 0) {
    // Junk Courier Yard: a long patched shed and handcarts of parcels
    patchBox(v, -L, L, -D, 0, 1, 6);
    sail(v, -L, L, 0, 4, 6, TARP);
    for (let x = -L + 2; x < L - 2; x += 5) { v.box(x, 1, 2, x + 3, 2, 4, PLY); v.box(x, 2, 2, x + 2, 3, 3, MUSTARD); }
  } else if (s === 1) {
    // Zipline Post: two salvage towers with a cable and parcel baskets riding it
    patchBox(v, -L, -L + 6, -D, 0, 1, 6);
    const H = 8 + lv * 2;
    for (const x of [-L + 2, L - 3]) for (let y = 1; y < H; y++) { v.put(x, y, -2, RUST); if (y % 3 === 0) v.box(x - 1, y, -3, x + 2, y + 1, -1, RUST2); }
    for (let x = -L + 3; x < L - 3; x++) v.put(x, H - 1 - Math.round(Math.sin(((x + L) / (2 * L)) * Math.PI) * 2), -2, DARK);
    for (let k = 1; k < 4; k++) v.box(-L + k * Math.floor(L / 2), H - 4, -2, -L + k * Math.floor(L / 2) + 2, H - 2, -1, MUSTARD);
  } else if (s === 2) {
    // Bike Messenger Depot: a long canopy of patchwork sails over a rack of bikes
    patchBox(v, -L, L, -D, -D + 4, 1, 5);
    sail(v, -L, Math.floor(L / 2), -D + 4, 2, 6, FADED);
    sail(v, Math.floor(L / 2) - 2, L, -D + 4, 3, 7, TEAL);
    for (let x = -L + 1; x < L - 1; x += 2) { v.put(x, 1, 1, DARK); v.put(x, 2, 1, RUST); }
  } else {
    // Water-Tower Pigeon Post: a repurposed water tower becomes the loft over a counter shed
    patchBox(v, -L, L - 8, -D, 0, 1, 5);
    const tx = L - 4;
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) v.box(tx + dx, 1, -D / 2 + dz, tx + dx + 1, 8 + lv, -D / 2 + dz + 1, RUST2);
    disc(v, tx + 0.5, -D / 2 + 0.5, 8 + lv, 13 + lv, 3.5, (x, y) => (y % 2 ? RUST : SHEET));
    for (let i = 0; i < 3 + lv; i++) v.put(tx - 3 + (i % 6), 15 + lv + (i % 2), -D / 2 + (i % 3), "#e0e0e0");
  }
  door(v, -2, 0);
  crowd(c, lv + 1, -L, 1, L, Math.min(hz - 1, 5));
};

// ----------------------------------------------------------------------------------- courthouse
const court: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 5 + lv * 3), D = Math.min(hz - 4, 4 + lv * 2);
  const z1 = Math.min(hz - 5, D - 1), z0 = -D;
  const st = Math.min(4, hz - z1 - 1);
  for (let k = 0; k < st; k++) v.box(-5, 1, z1 + k, 6, 1 + st - k, z1 + k + 1, CONCRETE);
  ground(c, z1 + st, hz);
  const H = 9 + lv * 2;
  if (s === 0) {
    // Stadium Tribunal: a ruined stadium curve rebuilt into stepped, symmetric tiers
    for (let t = 0; t < 3 + Math.ceil(lv / 2); t++) {
      const k = t * 2;
      for (let x = -W + k; x < W - k; x++) for (let z = z0 + k; z < z1 - k; z++) {
        const edge = x === -W + k || x === W - k - 1 || z === z0 + k || z === z1 - k - 1;
        if (edge) for (let y = 1 + t * 4; y < 5 + t * 4; y++) v.put(x, y, z, y % 4 === 0 ? CONCRETE : patch(x, y, z));
        else if (t === 0) v.put(x, 1, z, "#c4b48a");
      }
    }
  } else if (s === 1) {
    // Patched Old Court: a surviving stone court braced by scaffolds and patched with sheet
    v.box(-W, 1, z0, W, H, z1, CONCRETE);
    for (let x = -W + 1; x < W; x += 3) v.box(x, 1, z1, x + 1, H, z1 + 1, "#b8b2a4");
    for (let x = -W; x < W; x += 4) for (let y = 3; y < H; y += 4) v.box(x, y, z1 + 1, x + 3, y + 2, z1 + 2, patch(x, y, z1));
    for (let k = 0; k < 4; k++) v.box(-W + k * 2, H + k, z0 + k, W - k * 2, H + k + 1, z1 - k, k % 2 ? RUST : CONCRETE);
  } else if (s === 2) {
    // Tower of Scales: a scaffold tower lifting a huge balance of scrap pans over the hall
    patchBox(v, -W + 2, W - 2, z0, z1, 1, 8);
    const top = H + 8;
    for (let y = 8; y < top; y++) { v.put(-1, y, (z0 + z1) >> 1, RUST2); v.put(1, y, (z0 + z1) >> 1, RUST2); }
    v.box(-8, top, (z0 + z1) >> 1, 9, top + 1, ((z0 + z1) >> 1) + 1, RUST);
    for (const x of [-8, 8]) disc(v, x, (z0 + z1) / 2, top - 3, top - 2, 2.5, SHEET);
  } else {
    // Overpass Hall: a court built onto a broken highway overpass, the deck its roof
    for (const x of [-W + 1, W - 3]) v.box(x, 1, z0, x + 2, H, z1, CONCRETE);
    v.box(-W, H, z0, W, H + 2, z1, CONCRETE);
    for (let x = -W; x < W; x += 2) v.put(x, H + 2, z1 - 1, MUSTARD);
    patchBox(v, -W + 4, W - 4, z0 + 1, z1, 1, H - 1);
    windows(v, -W + 5, W - 5, 3, H - 2, z1 - 1);
    tree(v, W - 5, (z0 + z1) >> 1, 3);
  }
  door(v, 0, z1, 5);
  crowd(c, lv + 1, -W, z1 + st, W, hz);
};

// ----------------------------------------------------------------------------------- city offices
const offices: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const tw = Math.min(hx - 2, 3 + lv), tz0 = -hz + 1, tz1 = tz0 + Math.min(Math.floor(hz * 1.2), 6 + lv);
  const sq = tz1 + 1;
  ground(c, sq, hz);
  const H = 12 + lv * 4;
  if (s === 0) {
    // Radio Tower Council: a lattice tower with patched platforms over a market square
    for (let y = 1; y < H + 6; y++) for (const [dx, dz] of [[-tw, tz0], [tw - 1, tz0], [-tw, tz1 - 1], [tw - 1, tz1 - 1]]) {
      const k = Math.floor((y / (H + 6)) * (tw - 1));
      v.put(dx + (dx < 0 ? k : -k), y, dz + (dz === tz0 ? k : -k), RUST);
    }
    for (let y = 5; y < H; y += 6) patchBox(v, -tw + 1 + Math.floor(y / 8), tw - 1 - Math.floor(y / 8), tz0 + 1, tz1 - 1, y, y + 3);
    v.put(0, H + 6, (tz0 + tz1) >> 1, "#ff4d4d", 1.3);
  } else if (s === 1) {
    // Windmill Hall: a patched tower whose turbine spins over the square
    patchBox(v, -tw, tw, tz0, tz1, 1, H);
    windows(v, -tw + 1, tw - 1, 3, H - 2, tz1 - 1);
    const rot = spinner(c, 0.5, H + 4, tz1 + 1, "z", 0.6);
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2;
      for (let k = 1; k < 6 + lv; k++) rot.put(Math.round(Math.cos(ang) * k), Math.round(Math.sin(ang) * k), 0, a === 0 ? FADED : SHEET);
    }
    v.box(0, H, tz1 - 1, 1, H + 4, tz1 + 1, RUST2);
  } else if (s === 2) {
    // Skyscraper Stump: a broken tower, gardens spilling from every floor, its jagged top kept
    v.box(-tw, 1, tz0, tw, H, tz1, CONCRETE);
    for (let x = -tw; x < tw; x++) v.box(x, H, tz0, x + 1, H + ((x * 7) % 5 + 5) % 5, tz1, CONCRETE);
    for (let y = 3; y < H; y += 3) { windows(v, -tw + 1, tw - 1, y, y + 1, tz1 - 1); planters(v, -tw, tw, tz1, y); }
  } else {
    // Crane Council: offices beside a tower crane that keeps rebuilding the island
    patchBox(v, -tw, tw, tz0, tz1, 1, Math.round(H * 0.6));
    const cx = tw + 1 < hx - 1 ? tw + 1 : tw - 1;
    for (let y = 1; y < H + 4; y++) v.put(cx, y, tz0 + 1, y % 2 ? MUSTARD : DARK);
    for (let x = -hx + 2; x < cx + 4 && x < hx; x++) v.put(x, H + 4, tz0 + 1, MUSTARD);
    for (let y = H + 4; y > H - 3; y--) v.put(-hx + 4, y, tz0 + 1, DARK);
    v.box(-hx + 3, H - 4, tz0, -hx + 6, H - 2, tz0 + 3, TEAL);
  }
  door(v, 0, tz1, 4);
  for (let x = -hx + 2; x < hx - 4; x += 6) sail(v, x, x + 4, sq + 2, Math.min(hz - 1, sq + 5), 4, PATCH[(x + 40) % PATCH.length]);
  if (lv >= 3) tree(v, hx - 3, hz - 3, 6);
  crowd(c, lv * 2, -hx + 1, sq + 1, hx - 1, hz);
};

// ----------------------------------------------------------------------------------- bank
const bank: SignatureBuilder = (c) => {
  const { v, hx, hz, lv } = c;
  const s = c.variant % 4;
  const W = Math.min(hx - 1, 4 + lv * 2), D = Math.min(hz - 3, 4 + lv * 2), H = 5 + lv;
  ground(c, D, hz);
  if (s === 0) {
    // Vault Bunker: the old bank vault, exposed and walled with rubble, its round door the entrance
    v.box(-W, 1, -D, W, H, D, CONCRETE);
    for (let x = -W; x < W; x++) v.put(x, H, -D + ((x * 3) % (2 * D)), "#b8b2a4");
    disc(v, 0, 0, 0, 0, 0, DARK);
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) if (Math.hypot(dx, dy) < 3.4) v.put(dx, 4 + dy, D, Math.hypot(dx, dy) > 2.4 ? "#c0c0c0" : dx === 0 || dy === 0 ? "#888" : "#a0a0a0");
  } else if (s === 1) {
    // Water Bank: squat tanks of the island's real currency, clean water
    for (const [x, z] of [[-W + 3, -D + 3], [W - 3, -D + 3], [-W + 3, D - 3], [W - 3, D - 3]]) disc(v, x, z, 1, H + 2, 3, (_x, y) => (y % 3 === 0 ? RUST2 : "#3f6f9a"));
    patchBox(v, -W + 5, W - 5, -D + 5, D, 1, H);
  } else if (s === 2) {
    // Container Strongbox: welded containers, double-locked, one guarded hatch
    for (let y = 0; y < 2; y++) v.box(-W, 1 + y * 4, -D, W, 5 + y * 4, D, y ? RUST2 : RUST);
    for (let x = -W; x < W; x += 2) v.box(x, 1, D - 1, x + 1, 9, D, DARK);
  } else {
    // Fuel Depot Bank: drums and a squat tank farm behind a chain-link wall
    disc(v, 0, -D / 2, 1, H + 3, Math.min(W, D) - 1, (_x, y) => (y % 2 ? MUSTARD : RUST));
    for (let x = -W; x < W; x += 2) v.put(x, 1, D - 1, DARK);
    for (let x = -W; x < W; x++) v.box(x, 1, D, x + 1, 4, D + 1, (x % 2 ? "#777" : "#999"));
  }
  door(v, 0, D, 4);
  for (const x of [-3, 3]) v.box(x, 1, D + 1, x + 1, 3, D + 2, DARK);
};

export const salvageCivic: Record<string, SignatureBuilder> = {
  public_library: library,
  post_offices: post,
  courthouses: court,
  city_offices: offices,
  banks: bank,
};
