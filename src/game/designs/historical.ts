/**
 * Historical wonders (landmarks category): Colosseum, Stonehenge, Parthenon, Great Wall,
 * Chichén Itzá, Moai Statues, Angkor Wat and Machu Picchu.
 *
 * Shared level arc (relational to "a wonder being raised / restored"):
 *   Lv1 excavation / early construction (dirt, scaffolds, workers, tents, stone blocks)
 *   Lv2 the monument half-built (scaffolds, cranes, elephants or sledges)
 *   Lv3 the monument complete in its classic silhouette
 *   Lv4 the wider sacred / civic complex (secondary buildings, landscape)
 *   Lv5 the glorious restored wonder: plaza, crowds, floodlights and night glow
 */
import { type Ctx, PixelVox, bench, bush, flag, lamp, lot, pediment, person, ring, rocks, speckle, tree } from "./kit";
import { defineDesigns } from "./registry";
import { HISTORICAL_WONDERS } from "../historicalCatalog";

const fp = (id: string) => HISTORICAL_WONDERS.find((w) => w.id === id)!.footprints;

const SHIRTS = ["red", "blue", "yellow", "teal", "pink", "orange", "white", "purple", "lime", "sky", "crimson"];
const PANTS = ["blueDark", "charcoal", "sandDark", "white", "woodDark"];

// ---------------------------------------------------------------------------------------------
// Shared site dressing
// ---------------------------------------------------------------------------------------------

function worker(v: PixelVox, x: number, y: number, z: number, shirt = "orange"): void {
  person(v, x, y, z, shirt, "blueDark");
  v.put(x, y + 3, z, "yellow");
}

function crowd(c: Ctx, x0: number, z0: number, x1: number, z1: number, n: number, yAt?: (x: number, z: number) => number): void {
  if (x1 <= x0 || z1 <= z0) return;
  for (let i = 0; i < n; i++) {
    const x = c.ri(x0, x1 - 1), z = c.ri(z0, z1 - 1);
    person(c.v, x, yAt ? yAt(x, z) : 1, z, c.pick(SHIRTS), c.pick(PANTS));
  }
}

function scaffold(v: PixelVox, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, col = "woodLight"): void {
  const pole = (x: number, z: number) => v.box(x, y0, z, x + 1, y1, z + 1, col);
  for (let x = x0; x < x1; x += 3) { pole(x, z0); pole(x, z1 - 1); }
  for (let z = z0; z < z1; z += 3) { pole(x0, z); pole(x1 - 1, z); }
  pole(x1 - 1, z0); pole(x1 - 1, z1 - 1);
  for (let y = y0 + 3; y < y1; y += 3) {
    v.box(x0, y, z0, x1, y + 1, z0 + 1, "wood");
    v.box(x0, y, z1 - 1, x1, y + 1, z1, "wood");
    v.box(x0, y, z0, x0 + 1, y + 1, z1, "wood");
    v.box(x1 - 1, y, z0, x1, y + 1, z1, "wood");
  }
}

/** Little canvas tent (ridge along z). */
function tent(v: PixelVox, x: number, z: number, col = "cream", y = 1): void {
  for (let s = 0; s < 3; s++) v.box(x - 2 + s, y + s, z - 2, x + 3 - s, y + s + 1, z + 2, col);
  v.box(x, y, z + 1, x + 1, y + 2, z + 2, "charcoal");
}

function blockPile(c: Ctx, x: number, z: number, col: string, y = 1, n = 4): void {
  for (let i = 0; i < n; i++) {
    const dx = (i % 2) * 3, dy = Math.floor(i / 3), dz = Math.floor(i / 2) % 2 * 2;
    c.v.box(x + dx - dy, y + dy, z + dz, x + dx - dy + 2, y + dy + 1, z + dz + 1, col);
  }
}

function torch(v: PixelVox, x: number, y: number, z: number, h = 3): void {
  v.box(x, y, z, x + 1, y + h, z + 1, "woodDark");
  v.put(x, y + h, z, "fire", 1.5);
}

function floodlight(v: PixelVox, x: number, y: number, z: number): void {
  v.put(x, y, z, "charcoal");
  v.put(x, y + 1, z, "warmGlow", 1.8);
}

function woodCrane(v: PixelVox, x: number, y: number, z: number, h = 10, reach = 5): void {
  // Roman treadwheel crane: A-frame mast, boom and a hanging block.
  v.box(x, y, z - 1, x + 1, y + h, z, "woodDark");
  v.box(x, y, z + 1, x + 1, y + h, z + 2, "woodDark");
  v.box(x, y + h, z - 1, x + reach + 1, y + h + 1, z + 2, "wood");
  v.box(x + reach, y + h - 4, z, x + reach + 1, y + h, z + 1, "#c9a46a");
  v.box(x + reach - 1, y + h - 6, z - 1, x + reach + 2, y + h - 4, z + 2, "limestone");
  ring(v, x - 1.5, z + 0.5, y, y + 1, 2.5, 1.5, "wood");
  for (let k = 1; k < 5; k++) v.box(x - 2, y + k, z, x - 1, y + k + 1, z + 1, k % 2 ? "wood" : "woodDark");
}

function kiosk(v: PixelVox, x: number, z: number, col: string, roof = "red", y = 1): void {
  v.box(x - 2, y, z - 1, x + 2, y + 3, z + 2, col);
  v.box(x - 1, y + 1, z + 1, x + 1, y + 2, z + 2, "glass", 0.6);
  v.box(x - 3, y + 3, z - 2, x + 3, y + 4, z + 3, roof);
}

/** Tiny person with a hooded robe. */
function robed(v: PixelVox, x: number, y: number, z: number, robe: string, hood = true): void {
  v.put(x, y, z, robe);
  v.put(x, y + 1, z, robe);
  v.put(x, y + 2, z, "#e8b38f");
  if (hood) v.put(x, y + 3, z, robe);
}

/** Square ring [c-wOut, c+wOut) minus [c-wIn, c+wIn). */
function squareRing(v: PixelVox, cx: number, cz: number, y0: number, y1: number, wx: number, wz: number, t: number, col: string, emit = 0): void {
  v.box(cx - wx, y0, cz - wz, cx + wx, y1, cz - wz + t, col, emit);
  v.box(cx - wx, y0, cz + wz - t, cx + wx, y1, cz + wz, col, emit);
  v.box(cx - wx, y0, cz - wz, cx - wx + t, y1, cz + wz, col, emit);
  v.box(cx + wx - t, y0, cz - wz, cx + wx, y1, cz + wz, col, emit);
}

/** Box on one of four sides of a square centred at (cx,cz). a = along face, b = outward distance. */
function sideBox(v: PixelVox, cx: number, cz: number, k: number, a0: number, a1: number, y0: number, y1: number, b0: number, b1: number, col: string | null, emit = 0): void {
  if (k === 0) v.box(cx + a0, y0, cz + b0, cx + a1, y1, cz + b1, col, emit);
  else if (k === 1) v.box(cx + b0, y0, cz - a1, cx + b1, y1, cz - a0, col, emit);
  else if (k === 2) v.box(cx - a1, y0, cz - b1, cx - a0, y1, cz - b0, col, emit);
  else v.box(cx - b1, y0, cz + a0, cx - b0, y1, cz + a1, col, emit);
}

// ---------------------------------------------------------------------------------------------
// COLOSSEUM
// Styles: 0 Imperial Travertine (intact), 1 Weathered Ruin (broken outer ring, open hypogeum),
//         2 Velarium (striped awning sails on masts), 3 Naumachia (flooded arena with mock warships)
// ---------------------------------------------------------------------------------------------

function colosseum(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const stone = c.vpick(["#dcc49a", "#cdb48e", "#e6d3ae", "#e9dcc4"]);
  const shade = c.vpick(["#b89c70", "#a08a68", "#c9b48c", "#c8b79a"]);
  const ruin = variant === 1;
  lot(c, lv >= 3 ? "path" : "grass2");
  if (lv <= 2) speckle(c, "soil", 0.18);
  else {
    for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++)
      if ((x + z) % 4 === 0 || (x - z) % 4 === 0) v.put(x, 0, z, lv >= 5 ? "limestone" : "path2");
  }
  const cz = lv >= 4 ? -2 : -1;
  const a = hx - (lv >= 4 ? 5 : 2), b = hz - (lv >= 4 ? 6 : 3);
  const tierH = 5;
  const arcadeTiers = [1, 2, 3, 3, 3][lv - 1];
  const attic = lv >= 4 ? 4 : 0;
  const wallH = arcadeTiers * tierH + attic;
  const t = 2.6 / Math.min(a, b);
  const N = Math.max(12, Math.round((Math.PI * (a + b)) / 4));
  const dArena = 0.46;
  const caveaTop = Math.min(wallH, 3 * tierH) - 3;
  const theta = (x: number, z: number) => Math.atan2((z + 0.5 - cz) / b, (x + 0.5) / a);
  const glow = lv >= 5 ? 0.35 : 0;
  // Lv1: arcade fragments only in a few arcs; Lv2: second tier only around the back.
  const builtArc = (th: number, tier: number): boolean => {
    if (lv === 1) return tier === 0 && (Math.sin(th * 3 + 0.6) > 0.35);
    if (lv === 2 && tier === 1) return th < -0.3 && th > -2.9;
    return true;
  };
  for (let x = -a - 1; x <= a; x++) {
    for (let z = cz - b - 1; z <= cz + b; z++) {
      const d = Math.sqrt(((x + 0.5) / a) ** 2 + ((z + 0.5 - cz) / b) ** 2);
      if (d > 1) continue;
      const th = theta(x, z);
      if (d > 1 - t) {
        // Outer wall
        const outer = d > 1 - t * 0.5;
        let cap = wallH;
        if (ruin && th > -0.3 && th < 2.2) {
          // The outer ring has collapsed in a jagged staircase; the inner ring survives two tiers high.
          const edge = Math.min(th + 0.3, 2.2 - th);
          const stair = Math.max(1, Math.round(wallH - edge * 26));
          cap = outer ? Math.min(stair, edge > 0.25 ? 2 : wallH) : Math.min(wallH, Math.max(tierH * 2, stair));
        }
        const frac = (((th + Math.PI) / (2 * Math.PI)) * N) % 1;
        for (let y = 1; y <= cap; y++) {
          const tier = Math.floor((y - 1) / tierH), yRel = (y - 1) % tierH;
          if (tier < arcadeTiers) {
            if (!builtArc(th, tier)) break;
            const open = (frac > 0.25 && frac < 0.75 && yRel < 3) || (frac > 0.36 && frac < 0.64 && yRel === 3);
            if (open && !(lv === 1 && yRel === 0 && !outer)) continue;
            const col = yRel === 4 ? shade : stone;
            v.put(x, y, z, col, yRel === 4 ? 0 : glow);
          } else {
            const yA = y - arcadeTiers * tierH;
            const win = frac > 0.44 && frac < 0.56 && yA === 2 && outer;
            v.put(x, y, z, win ? "charcoal" : yA === attic ? shade : stone, win ? 0 : glow * 0.6);
          }
        }
        if (lv === 1) v.box(x, 1, z, x + 1, 2, z + 1, shade);
      } else if (d > dArena) {
        if (lv === 1) { v.put(x, 0, z, "soil"); continue; }
        // Stepped cavea seating rising toward the outer wall
        const tt = (d - dArena) / (1 - t - dArena);
        let hs = Math.round(2 + tt * (caveaTop - 2));
        if (lv === 2) hs = Math.min(hs, tierH + 1);
        if (ruin && th > -0.3 && th < 2.2 && tt > 0.55) hs = Math.min(hs, tierH + 3);
        const podium = d < dArena + 0.05;
        if (podium) { v.box(x, 1, z, x + 1, 4, z + 1, lv >= 4 ? "marble" : shade); continue; }
        v.box(x, Math.max(1, hs - 2), z, x + 1, hs + 1, z + 1, hs % 2 ? stone : shade);
        if (lv >= 4 && c.rand() < (lv >= 5 ? 0.34 : 0.15)) v.put(x, hs + 1, z, c.pick(SHIRTS));
      } else {
        // Arena floor
        if (lv === 1) v.put(x, 0, z, "soilDark");
        else if (variant === 3 && lv >= 3) v.put(x, 1, z, "water", 0.12);
        else if (ruin && lv >= 3) {
          v.put(x, 0, z, "soilDark");
          if ((x % 4 === 0 || (z - cz) % 3 === 0) && c.rand() < 0.9) v.box(x, 1, z, x + 1, 3, z + 1, shade);
        } else v.put(x, 1, z, "sand");
      }
    }
  }
  // Arena life
  if (lv >= 3 && !ruin && variant !== 3) {
    const n = lv >= 5 ? 4 : lv >= 4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const gx = -5 + i * 3 + (i % 2), gz = cz + (i % 2 ? 1 : -1);
      person(v, gx, 2, gz, i % 2 ? "red" : "blue", "goldDark");
      v.put(gx, 5, gz, "silver");
      v.put(gx, 6, gz, i % 2 ? "red" : "white");
      v.put(gx + 1, 3, gz, "silver");
      v.put(gx - 1, 3, gz, i % 2 ? "gold" : "red");
    }
    if (lv >= 5) {
      // a lion and a chariot
      v.box(5, 2, cz - 1, 8, 4, cz + 1, "amber");
      v.box(8, 3, cz - 1, 10, 5, cz + 1, "#b5651d");
      v.put(9, 4, cz + 1, "charcoal");
      v.box(-12, 2, cz + 2, -9, 4, cz + 4, "goldDark");
      v.box(-9, 2, cz + 2, -5, 4, cz + 3, "white");
    }
  }
  if (variant === 3 && lv >= 3) {
    for (const [sx, col] of [[-6, "red"], [3, "blue"]] as [number, string][]) {
      v.box(sx, 2, cz - 1, sx + 6, 3, cz + 1, "woodDark");
      v.box(sx + 1, 3, cz - 1, sx + 5, 4, cz + 1, "wood");
      v.box(sx + 3, 3, cz, sx + 4, 9, cz + 1, "woodDark");
      v.box(sx + 1, 5, cz, sx + 6, 8, cz + 1, col);
      for (let k = 0; k < 6; k += 2) v.put(sx + k, 2, cz + 1, "wood");
    }
  }
  // Velarium sails
  if (variant === 2 && lv >= 3) {
    for (let x = -a; x < a; x++) for (let z = cz - b; z < cz + b; z++) {
      const d = Math.sqrt(((x + 0.5) / a) ** 2 + ((z + 0.5 - cz) / b) ** 2);
      if (d > 1 - t * 0.5 || d < 0.62) continue;
      const th = theta(x, z);
      const seg = Math.floor((((th + Math.PI) / (2 * Math.PI)) * N) / 2);
      const drop = Math.round((1 - t * 0.5 - d) * 12);
      v.put(x, wallH + 3 - drop, z, seg % 2 ? "red" : "cream");
    }
    for (let i = 0; i < N; i += 2) {
      const th = (i / N) * Math.PI * 2 - Math.PI;
      const x = Math.round(Math.cos(th) * (a - 1) - 0.5), z = Math.round(cz + Math.sin(th) * (b - 1) - 0.5);
      v.box(x, wallH + 1, z, x + 1, wallH + 5, z + 1, "woodDark");
    }
  }
  // Construction phase
  if (lv <= 2) {
    const sy = lv === 1 ? 1 : tierH + 1;
    scaffold(v, a - 8, cz + 2, a - 1, cz + 8, sy, sy + (lv === 1 ? 6 : 7));
    scaffold(v, -a + 1, cz - 6, -a + 7, cz, sy, sy + 6);
    woodCrane(v, -3, 1, cz + 2, lv === 1 ? 9 : 14, 5);
    blockPile(c, 3, cz - 3, stone);
    blockPile(c, -hx + 2, hz - 4, stone);
    tent(v, hx - 4, hz - 4, "cream");
    for (let i = 0; i < 5; i++) worker(v, -6 + i * 3, 1, cz + (i % 2 ? 4 : -4) + (lv === 2 ? 0 : 1), i % 2 ? "orange" : "red");
  }
  // Plaza
  if (lv >= 3) {
    const front = cz + b + 1;
    for (const x of [-hx + 2, hx - 3]) lamp(v, x, 1, hz - 2, 5, "iron");
    crowd(c, -hx + 1, front, hx - 1, hz - 1, lv * 3);
  }
  if (lv >= 4) {
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * Math.PI * 2;
      const x = Math.round(Math.cos(th) * (a + 3)), z = Math.round(cz + Math.sin(th) * (b + 3));
      if (Math.abs(x) < hx - 1 && Math.abs(z) < hz - 1) lamp(v, x, 1, z, 5, "iron");
    }
    for (const s of [-1, 1]) tree(v, s * (hx - 3), 1, -hz + 3, "cypress", 1.3);
  }
  if (lv >= 5) {
    kiosk(v, -hx + 5, hz - 4, "cream", "terracotta");
    for (let i = 0; i < 14; i++) {
      const th = (i / 14) * Math.PI * 2 + 0.2;
      const x = Math.round(Math.cos(th) * (a + 1.5)), z = Math.round(cz + Math.sin(th) * (b + 1.5));
      floodlight(v, x, 1, z);
    }
    flag(v, hx - 3, 1, -hz + 2, 10, ["purple", "gold"]);
    flag(v, -hx + 2, 1, -hz + 2, 10, ["purple", "gold"]);
    crowd(c, -hx + 1, -hz + 1, hx - 1, -hz + 4, 8);
  }
}

// ---------------------------------------------------------------------------------------------
// STONEHENGE
// Styles: 0 Salisbury Sarsen (grey), 1 Bluestone (blue-grey stones, bluestone rings),
//         2 Moss & Wildflower (mossy stones, meadow), 3 Avebury Earthwork (big chalk bank & ditch)
// ---------------------------------------------------------------------------------------------

function stonehenge(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const sarsen = c.vpick(["#9d9b92", "#8593a1", "#8f9580", "#c4bfae"]);
  const sarsen2 = c.vpick(["#7f7d76", "#68778a", "#737a62", "#a39e8c"]);
  const blue = c.vpick(["#6f7f8c", "#4d6d96", "#5e7a66", "#8b909a"]);
  lot(c, "grass2");
  speckle(c, variant === 2 ? "moss" : "grass3", 0.16);
  if (variant === 2) { speckle(c, "yellow", 0.03); speckle(c, "white", 0.02); speckle(c, "purple", 0.015); }
  const half = Math.min(hx, hz);
  const R = lv === 1 ? 5 : half - (lv >= 4 ? 7 : 4);
  const H = lv >= 4 ? 7 : 6;
  const stoneCol = (i: number) => (i % 4 === 1 ? sarsen2 : sarsen);
  // Earthwork bank & ditch
  if (lv >= 4 || (variant === 3 && lv >= 2)) {
    const Rb = half - 1.5;
    ring(v, 0, 0, 0, 1, Rb, Rb - 2, variant === 3 ? "white" : "soilDark");
    ring(v, 0, 0, 1, variant === 3 ? 3 : 2, Rb - 2, Rb - 4, variant === 3 ? "grass" : "grass3");
    if (variant === 3) ring(v, 0, 0, 3, 4, Rb - 2.5, Rb - 3.5, "grass2");
    v.box(-2, 0, Math.round(Rb - 5), 2, 4, hz, null);
    v.box(-2, 0, Math.round(Rb - 5), 2, 1, hz, "path");
  }
  // Heel stone and avenue
  const heelZ = Math.min(hz - 2, R + (lv === 1 ? 2 : 5));
  v.box(2, 1, heelZ - 1, 4, lv === 1 ? 6 : 7, heelZ + 1, sarsen2);
  v.put(2, lv === 1 ? 6 : 7, heelZ - 1, sarsen2);
  if (lv >= 4) for (const s of [-1, 1]) v.box(s * 4, 1, R + 2, s * 4 + 1, 2, hz, "grass3");
  const upright = (x: number, z: number, h: number, col: string, w = 2) => {
    const bx = Math.round(x) - 1, bz = Math.round(z) - 1;
    v.box(bx, 1, bz, bx + w, h + 1, bz + w, col);
    if (variant === 2 && h > 2) {
      v.put(bx, h, bz, "#6f8a3a");
      v.put(bx + w - 1, 1 + ((bx + bz) & 3), bz, "#6f8a3a");
      v.put(bx, 1, bz + w - 1, "#5f7a32");
    }
  };
  if (lv >= 5) {
    ring(v, 0, 0, 0, 1, half - 0.5, half - 1.5, "path2");
    for (const s of [-1, 1]) bench(v, s * (half - 4), 1, half - 3, "x", "woodLight");
  }
  if (lv === 1) {
    // Timber woodhenge with the first sarsen being hauled in on log rollers.
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2;
      const x = Math.round(Math.cos(th) * R), z = Math.round(Math.sin(th) * R);
      v.box(x, 1, z, x + 1, 4 + (i % 2), z + 1, i % 3 ? "woodDark" : "wood");
    }
    upright(-1, -1, 5, sarsen);
    v.box(-6, 1, 3, -1, 3, 5, sarsen);
    for (const lx of [-6, -4, -2]) v.box(lx, 0, 2, lx + 1, 1, 6, "woodDark");
    for (let k = 0; k < 4; k++) v.put(k, 2, 4, "#c9a46a");
    for (let i = 0; i < 3; i++) worker(v, 3 + i * 2, 1, 4 + (i % 2), "woodLight");
    robed(v, -3, 1, -5, "white");
    v.box(-2, 1, -5, -1, 5, -4, "woodDark");
    return;
  }
  const N = Math.max(14, Math.round((2 * Math.PI * R) / 4.3));
  const placed = lv === 2 ? Math.round(N * 0.45) : N;
  const tops: number[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 - Math.PI * 0.95;
    if (i >= placed) {
      if (lv === 2 && i === placed + 2) {
        // a stone on its sledge awaiting raising
        const x = Math.round(Math.cos(th) * (R + 2)), z = Math.round(Math.sin(th) * (R + 2));
        v.box(x - 3, 1, z - 1, x + 3, 3, z + 1, sarsen);
        v.box(x - 3, 0, z - 2, x + 3, 1, z - 1, "woodDark");
        v.box(x - 3, 0, z + 1, x + 3, 1, z + 2, "woodDark");
      }
      continue;
    }
    const weathered = variant === 2 && i % 5 === 2 && lv < 5;
    const h = weathered ? H - 2 : H;
    upright(Math.cos(th) * R, Math.sin(th) * R, h, stoneCol(i));
    tops.push(th);
  }
  // Lintel ring (partial at Lv3, complete from Lv4)
  if (lv >= 3) {
    const arc = lv === 3 ? Math.PI * 1.1 : Math.PI * 2 + 0.1;
    const start = -Math.PI * 0.95;
    for (let x = -R - 2; x <= R + 2; x++) for (let z = -R - 2; z <= R + 2; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d < R - 1.6 || d > R + 0.6) continue;
      let th = Math.atan2(z + 0.5, x + 0.5) - start;
      while (th < 0) th += Math.PI * 2;
      if (th <= arc) v.put(x, H + 1, z, variant === 2 && (x * 3 + z) % 4 === 0 ? "#6f8a3a" : sarsen2);
    }
  }
  if (lv === 2) {
    // timber A-frame used to lever stones upright, plus hauling crew
    v.box(-3, 1, 0, -2, 9, 1, "woodDark");
    v.box(2, 1, 0, 3, 9, 1, "woodDark");
    v.box(-3, 9, 0, 3, 10, 1, "wood");
    v.box(-1, 2, -1, 1, 7, 1, sarsen);
    for (let i = 0; i < 4; i++) worker(v, -5 + i * 3, 1, 4, "woodLight");
    robed(v, 4, 1, -3, "white");
  }
  // Trilithon horseshoe opening toward the heel stone (+z)
  if (lv >= 3) {
    const Rt = R * 0.55;
    const angles = [-90, -140, -40, 170, 10];
    const count = lv === 3 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const th = (angles[i] * Math.PI) / 180;
      const px = Math.cos(th) * Rt, pz = Math.sin(th) * Rt;
      const tx = -Math.sin(th), tz = Math.cos(th);
      const ht = i === 0 ? H + 4 : H + 2;
      for (const s of [-1.6, 1.6]) upright(px + tx * s, pz + tz * s, ht, stoneCol(i + 1));
      for (let k = -2.6; k <= 2.6; k += 0.5) upright(px + tx * k, pz + tz * k, 0, sarsen2);
      for (let k = -2.6; k <= 2.6; k += 0.5) {
        const x = Math.round(px + tx * k) - 1, z = Math.round(pz + tz * k) - 1;
        v.box(x, ht + 1, z, x + 2, ht + 2, z + 2, sarsen2);
      }
    }
    if (lv === 3) {
      // earth ramp used to slide lintels up
      for (let s = 0; s < 6; s++) v.box(R - 2 - s, 1, -2, R - 1 - s, 2 + Math.floor(s * 1.2), 2, "soil");
      for (let i = 0; i < 3; i++) worker(v, 2 + i * 2, 1, R - 3, "woodLight");
    }
  }
  // Bluestones
  if (lv >= 4) {
    const nb = Math.round(2 * Math.PI * R * 0.78 / 2.2);
    for (let i = 0; i < nb; i++) {
      const th = (i / nb) * Math.PI * 2;
      const x = Math.round(Math.cos(th) * R * 0.78), z = Math.round(Math.sin(th) * R * 0.78);
      v.box(x, 1, z, x + 1, 3 + (i % 2), z + 1, blue);
    }
    for (let i = 0; i < 9; i++) {
      const th = ((-200 + i * 27.5) * Math.PI) / 180;
      const x = Math.round(Math.cos(th) * R * 0.32), z = Math.round(Math.sin(th) * R * 0.32);
      v.box(x, 1, z, x + 1, 4, z + 1, blue);
    }
    v.box(-2, 1, -1, 2, 2, 1, "#6b5a4b");
  }
  if (lv >= 4) {
    for (let i = 0; i < (lv >= 5 ? 6 : 3); i++) robed(v, -6 + i * 2, 1, R + 3, "white");
    crowd(c, -hx + 2, hz - 4, -4, hz - 1, lv * 2);
  }
  if (lv >= 5) {
    // Solstice axis glows at night from the heel stone to the altar.
    for (let z = 0; z <= heelZ - 2; z++) v.put(0, 1, z, "amber", 1.3);
    v.put(2, 8, heelZ - 1, "warmGlow", 2);
    v.put(3, 8, heelZ - 1, "warmGlow", 2);
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + 0.26;
      torch(v, Math.round(Math.cos(th) * (R + 2.5)), 1, Math.round(Math.sin(th) * (R + 2.5)), 3);
    }
    // druid circle around the altar
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2;
      robed(v, Math.round(Math.cos(th) * 3.5), 1, Math.round(Math.sin(th) * 3.5), i === 0 ? "gold" : "white");
    }
    for (const s of [-1, 1]) lamp(v, s * 6, 1, hz - 2, 4, "iron");
    kiosk(v, hx - 5, hz - 4, "woodLight", "slate");
    crowd(c, 4, hz - 6, hx - 1, hz - 1, 8);
  }
}

// ---------------------------------------------------------------------------------------------
// PARTHENON
// Styles: 0 Pentelic Marble, 1 Painted Polychrome (red/blue frieze, terracotta roof),
//         2 Gilded Athena (gold acroteria & statue), 3 Honey Stone (Hephaisteion look, cypress)
// ---------------------------------------------------------------------------------------------

function parthenon(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const marble = c.vpick(["#efe9dd", "#f1ece2", "#f7f4ec", "#e6cf9f"]);
  const shade = c.vpick(["#d9cfbd", "#d8d0c2", "#e2dccd", "#c9ad78"]);
  const frieze = c.vpick(["#d4c8b2", "blue", "#e8e0cf", "#b99a63"]);
  const roofCol = c.vpick(["#e4dccb", "terracotta", "#e4dccb", "slate"]);
  const tympanum = c.vpick(["#ded4c0", "blue", "goldDark", "#b99a63"]);
  const roofCol2 = c.vpick(["#cfc6b3", "#b5562f", "#d6cdb9", "#3f4650"]);
  const rock = "#b6a58a";
  lot(c, variant === 3 ? "grass" : "grass2");
  speckle(c, "olive", 0.06);
  // Acropolis: a craggy rock hill, wider at the base, with a paved plateau on top
  const hillH = [2, 4, 6, 8, 10][lv - 1];
  const tTop = Math.ceil(hillH * 0.7) + 1;
  const jag = (x: number, z: number) => ((x * 7 + z * 13) & 3) === 0 ? 1 : 0;
  const hAt = (x: number, z: number) => {
    if (x < -hx || x >= hx || z < -hz || z >= hz) return 0;
    const e = Math.min(x + hx, hx - 1 - x, z + hz, hz - 1 - z);
    return Math.max(0, Math.min(hillH, Math.floor((e - 1 + jag(x, z)) / 0.7)));
  };
  for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) {
    const h = hAt(x, z);
    if (h <= 0) continue;
    const lo = Math.min(hAt(x + 1, z), hAt(x - 1, z), hAt(x, z + 1), hAt(x, z - 1));
    for (let y = Math.max(1, lo); y <= h; y++) v.put(x, y, z, y % 3 === 0 ? "#a39377" : (x + z * 3 + y) % 5 === 0 ? "stone" : rock);
    v.put(x, h, z, h >= hillH ? (lv >= 3 ? "path2" : "path") : (x + z) % 4 === 0 ? "olive" : rock);
  }
  const top = hillH + 1;
  // Stair cut up the front of the hill
  const stairCol = lv >= 4 ? "limestone" : "path";
  for (let s = 0; s < hillH; s++) {
    const zz = hz - 1 - s;
    v.box(-3, 1, zz, 3, 2 + s, zz + 1, stairCol);
    v.clear(-3, 2 + s, zz, 3, hillH + 2, zz + 1);
  }
  // Temple dimensions (long axis along x, colonnade faces the front)
  const tx = 2 * Math.round(hx * 0.5), tz = Math.max(6, 2 * Math.round(hz * 0.36));
  const ox = lv >= 4 ? 3 : 0, oz = lv >= 5 ? -2 : lv >= 4 ? -2 : 0;
  const x0 = ox - tx / 2, x1 = ox + tx / 2, z0 = oz - tz / 2, z1 = oz + tz / 2;
  for (let s = 0; s < 3; s++) v.box(x0 - 3 + s, top + s, z0 - 3 + s, x1 + 3 - s, top + s + 1, z1 + 3 - s, s === 2 ? marble : shade);
  const base = top + 3;
  const colH = lv >= 5 ? 9 : 8;
  const cols: [number, number][] = [];
  for (let x = x0; x < x1; x += 2) { cols.push([x, z0]); cols.push([x, z1 - 1]); }
  for (let z = z0 + 2; z < z1 - 1; z += 2) { cols.push([x0, z]); cols.push([x1 - 2, z]); }
  const column = (x: number, z: number, h: number) => {
    v.box(x, base, z, x + 1, base + h, z + 1, marble);
    if (h >= colH) {
      v.put(x, base + h - 1, z, shade);
      v.box(x - (x === x0 ? 0 : 0), base + h - 1, z, x + 1, base + h, z + 1, shade);
    }
  };
  if (lv === 1) {
    // Foundations: a few column drums of rising height, blocks and a treadwheel crane
    cols.forEach(([x, z], i) => { if (i % 3 === 0) column(x, z, 1 + (i * 7) % 6); });
    woodCrane(v, x0 + 4, base, z0 + 3, 9, 4);
    blockPile(c, x1 - 6, z0 + 2, marble, base);
    for (let i = 0; i < 4; i++) worker(v, x0 + 3 + i * 4, base, z1 - 3, i % 2 ? "orange" : "white");
    tent(v, hx - 3, hz - 2, "cream", hAt(hx - 3, hz - 2) + 1);
    return;
  }
  for (const [x, z] of cols) column(x, z, colH);
  // Cella
  v.hollowBox(x0 + 3, base, z0 + 3, x1 - 4, base + colH, z1 - 3, shade);
  v.box(x1 - 4, base, oz - 1, x1 - 3, base + 5, oz + 1, "woodDark");
  const ent = base + colH;
  if (lv === 2) {
    // Architrave going up along half, scaffolds and crane
    v.box(x0, ent, z0, ox, ent + 1, z1, marble);
    scaffold(v, ox, z0 - 1, x1 + 1, z1 + 1, base, ent + 3);
    woodCrane(v, x1 + 2, top, z1 + 2, 14, -6);
    for (let i = 0; i < 4; i++) worker(v, x0 + 2 + i * 5, top + 3, z1 + 2, i % 2 ? "orange" : "white");
    blockPile(c, -hx + 3, hz - 3, marble, hAt(-hx + 3, hz - 3) + 1);
    return;
  }
  // Entablature: architrave, triglyph frieze, cornice
  v.box(x0, ent, z0, x1 - 1, ent + 1, z1, marble);
  for (let x = x0; x < x1 - 1; x++) {
    const col = (x - x0) % 3 === 0 ? (variant === 1 ? "blueDark" : shade) : frieze;
    v.box(x, ent + 1, z0, x + 1, ent + 2, z1, col);
  }
  for (let z = z0; z < z1; z++) {
    const col = (z - z0) % 3 === 0 ? (variant === 1 ? "blueDark" : shade) : frieze;
    v.put(x0, ent + 1, z, col);
    v.put(x1 - 2, ent + 1, z, col);
  }
  if (variant === 1) v.box(x0 + 1, ent + 1, z0 + 1, x1 - 2, ent + 2, z1 - 1, "red");
  v.box(x0 - 1, ent + 2, z0 - 1, x1, ent + 3, z1 + 1, variant === 2 ? "gold" : marble);
  // Gable roof (ridge along x) with pediments at both ends
  const yR = ent + 3;
  const rise = Math.ceil((tz + 2) / 4);
  for (let s = 0; s < rise; s++) {
    const za = z0 - 1 + s * 2, zb = z1 + 1 - s * 2;
    if (za >= zb) break;
    v.box(x0 - 1, yR + s, za, x1, yR + s + 1, zb, s % 2 ? roofCol2 : roofCol);
    v.box(x0 - 1, yR + s, za, x0, yR + s + 1, zb, s === 0 ? marble : tympanum);
    v.box(x1 - 1, yR + s, za, x1, yR + s + 1, zb, s === 0 ? marble : tympanum);
  }
  const ridge = yR + rise;
  const acro = variant === 2 || variant === 1 ? "gold" : marble;
  for (const x of [x0 - 1, x1 - 1]) {
    v.put(x, ridge, oz - 1 + (tz % 2 ? 0 : 0), acro);
    v.put(x, ridge, oz, acro);
    v.put(x, yR, z0 - 1, acro);
    v.put(x, yR, z1, acro);
  }
  // Life on the acropolis
  const yAt = (x: number, z: number) => hAt(x, z) + 1;
  const plateauX = hx - tTop - 1, plateauZ = hz - tTop - 1;
  crowd(c, -plateauX, z1 + 4, plateauX, plateauZ, lv * 2, yAt);
  if (variant === 3) for (const s of [-1, 1]) tree(v, s * plateauX, top, -plateauZ, "cypress", 1.2);
  else for (const s of [-1, 1]) tree(v, s * plateauX, top, plateauZ - 1, "oak", 0.7);
  for (let i = 0; i < 4 + lv; i++) {
    const x = c.ri(-hx + 1, hx - 2), z = c.ri(-hz + 1, hz - 2);
    const h = hAt(x, z);
    if (h > 0 && h < hillH) bush(v, x, h + 1, z, 0.8, "olive");
  }
  // Lv4: Erechtheion with caryatids, Athena statue
  const athena = (x: number, z: number, h: number) => {
    const col = variant === 2 || lv >= 5 ? "gold" : "brass";
    v.box(x - 1, top, z - 1, x + 2, top + 2, z + 2, marble);
    v.box(x, top + 2, z, x + 1, top + 2 + h, z + 1, col);
    v.box(x - 1, top + 2 + Math.floor(h * 0.3), z, x + 2, top + 2 + Math.floor(h * 0.7), z + 1, col);
    v.put(x, top + 3 + h, z, col);
    v.box(x + 2, top + 2, z, x + 3, top + 5 + h, z + 1, "goldDark");
    v.put(x - 1, top + 2 + Math.floor(h * 0.5), z + 1, col);
  };
  if (lv >= 3 && variant === 2) athena(x0 - 4 > -plateauX ? x0 - 4 : -plateauX + 1, z1 + 2, 5);
  if (lv >= 4) {
    const ex = -plateauX + 4, ez = plateauZ - 4;
    v.box(ex - 3, top, ez - 3, ex + 4, top + 1, ez + 4, shade);
    v.hollowBox(ex - 2, top + 1, ez - 2, ex + 3, top + 6, ez + 2, marble);
    for (let k = 0; k < 3; k++) {
      const cx = ex - 2 + k * 2;
      v.put(cx, top + 1, ez + 3, marble);
      v.put(cx, top + 2, ez + 3, "#e8d9c0");
      v.put(cx, top + 3, ez + 3, "#e8d9c0");
      v.put(cx, top + 4, ez + 3, "#d7c4a4");
    }
    v.box(ex - 2, top + 5, ez + 2, ex + 3, top + 6, ez + 4, marble);
    v.box(ex - 2, top + 6, ez - 2, ex + 3, top + 7, ez + 4, roofCol);
    if (variant !== 2) athena(-plateauX + 1, oz - 2, 6);
    for (const s of [-1, 1]) lamp(v, s * 4, top, plateauZ, 4, "iron");
  }
  if (lv >= 5) {
    // Propylaea gate at the head of the stair, floodlights and banners
    const pz = plateauZ - 1;
    v.box(-6, top, pz - 2, 7, top + 1, pz + 1, shade);
    for (let x = -6; x < 7; x += 2) v.box(x, top + 1, pz, x + 1, top + 6, pz + 1, marble);
    v.box(-6, top + 6, pz - 2, 7, top + 7, pz + 1, marble);
    v.clear(-2, top + 1, pz - 2, 3, top + 6, pz + 1);
    pediment(v, -6, 7, top + 7, pz - 2, pz + 1, marble, tympanum);
    for (let x = x0; x < x1; x += 4) floodlight(v, x, top + 1, z1 + 2);
    for (let z = z0; z < z1; z += 4) floodlight(v, x1 + 2, top + 1, z);
    flag(v, plateauX, top, -plateauZ, 9, ["blue", "white", "blue"]);
    crowd(c, -6, hz - hillH, 7, hz, 6, yAt);
    crowd(c, -hx + 1, hz - 2, hx - 1, hz, 6, yAt);
  }
}

// ---------------------------------------------------------------------------------------------
// GREAT WALL
// Styles: 0 Ming Brick (grey), 1 Rammed Earth (ochre desert), 2 Snowy Pass (snow caps, pines),
//         3 Red Lantern Autumn (maple hills, red pavilions & lanterns)
// ---------------------------------------------------------------------------------------------

function greatWall(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const brick = c.vpick(["#9a958c", "#c8a46e", "#a7a49e", "#9d8f80"]);
  const brick2 = c.vpick(["#7d786f", "#a98552", "#8a8782", "#83766a"]);
  const top = c.vpick(["#b7b1a6", "#d8b984", "#f4f6f8", "#b7aa98"]);
  const hillTop = c.vpick(["grass2", "sand", "snow", "#b9842f"]);
  const hillSide = c.vpick(["grass3", "sandDark", "#d9e2e6", "olive"]);
  const amp = [1, 3, 5, 7, 9][lv - 1];
  const phase = c.variant * 0.9;
  const ground = (x: number, z: number) => Math.max(1, Math.round(
    1 + amp * (0.5 + 0.5 * Math.sin(x * 0.11 + phase)) * (0.7 + 0.3 * Math.cos(z * 0.18 + phase)),
  ));
  lot(c, hillSide);
  const hmap = new Map<number, number>();
  const H = (x: number, z: number) => {
    const k = (x + 64) * 256 + (z + 64);
    let h = hmap.get(k);
    if (h === undefined) { h = ground(x, z); hmap.set(k, h); }
    return h;
  };
  for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) {
    const h = H(x, z);
    const lo = Math.min(h, H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1));
    const edge = x === -hx || x === hx - 1 || z === -hz || z === hz - 1;
    const y0 = edge ? 1 : Math.max(1, lo);
    if (h > 1) v.box(x, y0, z, x + 1, h, z + 1, hillSide);
    v.put(x, h, z, (x * 3 + z * 5) % 7 === 0 ? hillSide : hillTop);
  }
  const zAmp = Math.max(0, hz - 6);
  const zc = (x: number) => Math.round(zAmp * Math.sin(x * 0.095 + phase * 0.5 + 0.4));
  const wallH = lv === 1 ? 3 : 5;
  const length = lv === 1 ? Math.round(hx * 1.2) : hx;
  const wallTop = (x: number) => {
    const zz = zc(x);
    return Math.max(H(x, zz - 2), H(x, zz + 1), H(x, zz)) + wallH;
  };
  for (let x = -hx; x < Math.min(hx, -hx + 2 * length); x++) {
    const zz = zc(x), yt = wallTop(x);
    const zPrev = zc(x - 1);
    const zLo = Math.min(zz, zPrev) - 2, zHi = Math.max(zz, zPrev) + 2;
    for (let z = zLo; z < zHi; z++) {
      const g = Math.max(1, H(x, z) - 1);
      const outer = z === zLo || z === zHi - 1;
      const col = lv === 1 ? (variant === 1 ? brick : "#b99a6b") : (x + Math.floor((yt) / 2)) % 3 === 0 ? brick2 : brick;
      v.box(x, g, z, x + 1, yt, z + 1, col);
      v.put(x, yt, z, outer ? brick2 : top);
      if (outer && lv >= 2 && x % 2 === 0) v.put(x, yt + 1, z, brick);
    }
  }
  if (lv === 1) {
    // Rammed-earth formwork and basket carriers
    const fx = Math.min(hx - 6, -hx + 2 * length);
    const zz = zc(fx);
    v.box(fx, H(fx, zz), zz - 3, fx + 5, H(fx, zz) + 4, zz - 2, "woodLight");
    v.box(fx, H(fx, zz), zz + 2, fx + 5, H(fx, zz) + 4, zz + 3, "woodLight");
    for (let i = 0; i < 4; i++) {
      const wx = -hx + 4 + i * 5, wz = zc(wx) + 4;
      worker(v, wx, H(wx, wz) + 1, wz, i % 2 ? "blue" : "woodLight");
      v.put(wx + 1, H(wx, wz) + 2, wz, "#c9a46a");
    }
    tent(v, hx - 4, hz - 4 > zc(hx - 4) + 3 ? hz - 4 : -hz + 4, "#c9a46a", H(hx - 4, hz - 4) + 1);
    return;
  }
  // Watchtowers
  const towerXs: number[] = [];
  const nT = [1, 2, 2, 3, 3][lv - 1];
  for (let i = 0; i < nT; i++) towerXs.push(Math.round(-hx + (2 * hx * (i + 0.5)) / nT));
  towerXs.forEach((tx, i) => {
    const zz = zc(tx), base = wallTop(tx);
    const ty = base + 6;
    const unfinished = lv === 2 && i === 1;
    const g = Math.max(1, Math.min(H(tx - 3, zz), H(tx + 3, zz)) - 1);
    v.box(tx - 3, g, zz - 4, tx + 4, unfinished ? base + 2 : ty, zz + 4, brick);
    if (unfinished) { scaffold(v, tx - 4, zz - 5, tx + 5, zz + 5, base, ty + 2); return; }
    v.box(tx - 3, base + 1, zz - 4, tx + 4, base + 2, zz + 4, brick2);
    for (const s of [-1, 1]) {
      v.box(tx - 1, base + 2, zz + s * 4 - (s > 0 ? 1 : 0), tx + 2, base + 4, zz + s * 4 + (s > 0 ? 0 : 1), "charcoal");
      v.put(tx, base + 4, zz + s * 4 - (s > 0 ? 1 : 0), "charcoal");
    }
    v.box(tx - 3, base + 3, zz - 2, tx - 2, base + 4, zz, "charcoal");
    v.box(tx + 3, base + 3, zz - 2, tx + 4, base + 4, zz, "charcoal");
    v.box(tx - 3, base + 1, zz - 2, tx + 4, base + 4, zz + 2, null);
    v.box(tx - 3, ty, zz - 4, tx + 4, ty + 1, zz + 4, top);
    for (let x = tx - 3; x < tx + 4; x += 2) { v.put(x, ty + 1, zz - 4, brick); v.put(x, ty + 1, zz + 3, brick); }
    for (let z = zz - 4; z < zz + 4; z += 2) { v.put(tx - 3, ty + 1, z, brick); v.put(tx + 3, ty + 1, z, brick); }
    const pavilion = variant === 3 || (lv >= 4 && i === Math.floor(nT / 2));
    if (pavilion) {
      // tiered pavilion roof with upturned eaves
      const rc = variant === 3 ? "red" : variant === 2 ? "tealDark" : "#5b5e66";
      for (const [x, z] of [[tx - 2, zz - 3], [tx + 2, zz - 3], [tx - 2, zz + 2], [tx + 2, zz + 2]]) v.box(x, ty + 1, z, x + 1, ty + 4, z + 1, "redDark");
      v.box(tx - 4, ty + 4, zz - 5, tx + 5, ty + 5, zz + 5, rc);
      v.box(tx - 3, ty + 5, zz - 4, tx + 4, ty + 6, zz + 4, rc);
      v.box(tx - 2, ty + 6, zz - 2, tx + 3, ty + 7, zz + 2, rc);
      for (const [x, z] of [[tx - 4, zz - 5], [tx + 4, zz - 5], [tx - 4, zz + 4], [tx + 4, zz + 4]]) v.put(x, ty + 5, z, rc);
      v.put(tx, ty + 7, zz, "gold");
      if (lv >= 4) for (const x of [tx - 3, tx + 3]) v.put(x, ty + 3, zz + 4, "red", 1.4);
    } else if (lv >= 3) {
      // beacon brazier
      v.box(tx, ty + 1, zz, tx + 1, ty + 2, zz + 1, brick2);
      v.put(tx, ty + 2, zz, "fire", 1.6);
      c.smoke(tx, ty + 3, zz, lv >= 4 ? "dark" : "smoke");
    }
    if (variant === 2) v.box(tx - 3, ty + 1, zz - 4, tx + 4, ty + 1, zz + 4, "snow");
  });
  // Soldiers and hikers on the walkway
  for (let i = 0; i < lv * 3; i++) {
    const x = c.ri(-hx + 1, hx - 2);
    if (towerXs.some((t) => Math.abs(t - x) < 5)) continue;
    const zz = zc(x) - 1 + c.ri(0, 1);
    if (lv >= 4 && i % 3 === 0) {
      person(v, x, wallTop(x) + 1, zz, "red", "charcoal");
      v.put(x, wallTop(x) + 4, zz, "goldDark");
      v.box(x + 1, wallTop(x) + 1, zz, x + 2, wallTop(x) + 5, zz + 1, "woodDark");
    } else person(v, x, wallTop(x) + 1, zz, c.pick(SHIRTS), c.pick(PANTS));
  }
  // Scenery
  const treeKind = variant === 2 ? "pine" : variant === 3 ? "autumn" : variant === 1 ? "olive" : "pine";
  for (let i = 0; i < 4 + lv * 2; i++) {
    const x = c.ri(-hx + 2, hx - 3), z = c.ri(-hz + 2, hz - 3);
    if (Math.abs(z - zc(x)) < 6) continue;
    if (variant === 1) rocks(c, x, H(x, z), z, 2, "sandDark");
    else tree(v, x, H(x, z) + 1, z, treeKind === "olive" ? "round" : treeKind as "pine" | "autumn", 0.8 + c.rand() * 0.5, i);
  }
  if (lv === 2) for (let i = 0; i < 3; i++) worker(v, towerXs[1] - 4 + i * 2, wallTop(towerXs[1] - 4 + i * 2) + 1, zc(towerXs[1]) + 3);
  if (lv >= 4) {
    // lantern string along the wall (red glow at night)
    for (let x = -hx + 1; x < hx - 1; x += 4) if (!towerXs.some((t) => Math.abs(t - x) < 5)) v.put(x, wallTop(x) + 2, zc(x) + 1, "red", 1.3);
  }
  if (lv >= 5) {
    // fortified pass gate with a grand gatehouse, plaza and visitors
    const gx = towerXs[1] ?? 0, zz = zc(gx);
    const base = wallTop(gx) + 6;
    v.box(gx - 2, 1, zz - 4, gx + 3, base - 2, zz + 4, null);
    for (let y = 1; y < base - 3; y++) for (const s of [-1, 1]) v.box(gx + (s < 0 ? -3 : 3), y, zz - 4, gx + (s < 0 ? -2 : 4), y + 1, zz + 4, brick2);
    for (let x = gx - 2; x < gx + 3; x++) v.put(x, base - 3, zz + 4, brick2);
    for (let x = -hx + 1; x < hx - 1; x++) for (let z = zz + 6; z < hz - 1; z++) if (Math.abs(x - gx) < 7) v.put(x, H(x, z), z, "limestone");
    crowd(c, gx - 6, zz + 6, gx + 7, hz - 1, 10, (x, z) => H(x, z) + 1);
    for (const s of [-1, 1]) lamp(v, gx + s * 6, H(gx + s * 6, hz - 3) + 1, hz - 3, 4, "redDark", "red");
    flag(v, gx - 3, base + 7, zz - 4, 6, ["red", "gold"]);
    for (const tx of towerXs) for (const s of [-1, 1]) floodlight(v, tx + s * 5, H(tx + s * 5, zc(tx) + 6), zc(tx) + 6);
  }
}

// ---------------------------------------------------------------------------------------------
// CHICHÉN ITZÁ (El Castillo)
// Styles: 0 Limestone, 1 Painted Stucco (red faces, blue temple), 2 Jungle Reclaimed (vines, trees),
//         3 Equinox Serpent (gold serpent bodies along the balustrades)
// ---------------------------------------------------------------------------------------------

function chichenItza(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const stone = c.vpick(["#bdb299", "#b8432f", "#9c9a80", "#c9b78e"]);
  const stone2 = c.vpick(["#8f8670", "#8f2f22", "#6f7a56", "#a08b62"]);
  const stair = c.vpick(["#f1ebdc", "#efe2c4", "#d8d4bf", "#f5ead0"]);
  const temple = c.vpick(["#e4dcc6", "#3e7fb0", "#a9a58a", "#e8d9b4"]);
  lot(c, lv >= 4 ? "grass2" : "grass3");
  speckle(c, "leafDark", lv >= 4 ? 0.04 : 0.12);
  const cx = 0, cz = lv >= 5 ? -6 : lv >= 3 ? -2 : -1;
  const half = Math.min(hx, hz);
  const r = half - (lv >= 5 ? 13 : lv >= 3 ? 8 : 3);
  const rTop = Math.max(3, Math.round(r * 0.33));
  const terr = 9, tH = 2;
  const topY = 1 + terr * tH;
  const wAt = (k: number) => Math.round(r - (k * (r - rTop)) / terr);
  if (lv === 1) {
    // Jungle mound with archaeologists clearing one corner
    for (let y = 0; y < 10; y++) {
      const rr = (r - 1) * (1 - y / 11);
      v.cylinderY(cx, cz, 1 + y, 2 + y, rr, y % 3 === 0 ? "leafDark" : "moss");
    }
    for (let k = 0; k < 3; k++) {
      const w = wAt(k);
      v.box(cx, 1 + k * tH, cz + w - 3, cx + w, 1 + (k + 1) * tH, cz + w, k % 2 ? stone2 : stone);
    }
    for (let i = 0; i < 5; i++) tree(v, cx - r + 2 + c.ri(0, 4), 4 + c.ri(0, 3), cz - r + 4 + c.ri(0, r), "round", 1.1, i);
    tent(v, hx - 4, hz - 4, "#c9a46a");
    for (let i = 0; i < 3; i++) worker(v, cx + 2 + i * 2, 1, cz + r + 1, "#c9a46a");
    blockPile(c, -hx + 2, hz - 4, stone);
    return;
  }
  const restored = lv === 2 ? 4 : terr;
  for (let k = 0; k < terr; k++) {
    const w = wAt(k), w2 = wAt(k + 1);
    const y0 = 1 + k * tH;
    if (k >= restored) {
      // rubble core not yet faced
      v.box(cx - w + 1, y0, cz - w + 1, cx + w - 1, y0 + tH, cz + w - 1, (k + c.ri(0, 1)) % 2 ? "stone" : "#9b9384");
      continue;
    }
    const t = Math.max(2, w - w2 + 1);
    squareRing(v, cx, cz, y0, y0 + 1, w, w, t, stone);
    squareRing(v, cx, cz, y0 + 1, y0 + 2, w, w, t, stone);
    if (lv >= 3 || k < restored) {
      // recessed panels on the upper course
      for (let a = -w + 1; a < w - 1; a += 3) for (let s = 0; s < 4; s++) sideBox(v, cx, cz, s, a, a + 1, y0 + 1, y0 + 2, w - 1, w, stone2);
    }
    if (variant === 2 && lv >= 3) for (let i = 0; i < w; i++) { const s = c.ri(0, 3), a = c.ri(-w, w - 1); sideBox(v, cx, cz, s, a, a + 1, y0, y0 + 2, w - 1, w, c.pick(["leaf", "leafDark", "moss"])); }
  }
  if (lv === 2) {
    scaffold(v, cx - wAt(4) - 1, cz - wAt(4) - 1, cx + wAt(4) + 1, cz + wAt(4) + 1, 1 + 4 * tH, 1 + 9 * tH);
    for (let i = 0; i < 4; i++) worker(v, cx - 4 + i * 3, 1 + 4 * tH, cz + wAt(4) - 1, "#c9a46a");
    tent(v, hx - 4, hz - 3, "#c9a46a");
    blockPile(c, -hx + 2, hz - 4, stone);
  }
  // Four staircases with balustrades
  const sides = lv === 2 ? [0] : [0, 1, 2, 3];
  const stairTop = lv === 2 ? 1 + 4 * tH : topY;
  for (const s of sides) {
    for (let y = 1; y < stairTop; y++) {
      const b = Math.round(r - ((y - 1) * (r - rTop)) / (topY - 1)) + 1;
      sideBox(v, cx, cz, s, -2, 2, y, y + 1, 0, b, stair);
      for (const a of [-3, 2]) sideBox(v, cx, cz, s, a, a + 1, y, y + 2, b - 2, b, variant === 3 && lv >= 3 ? "gold" : stone2, variant === 3 && lv >= 4 ? 0.5 : 0);
    }
  }
  if (lv >= 3) {
    // Temple of Kukulcán on top
    const tw = rTop;
    v.box(cx - tw, topY, cz - tw, cx + tw, topY + 1, cz + tw, stone2);
    v.hollowBox(cx - tw + 1, topY + 1, cz - tw + 1, cx + tw - 1, topY + 6, cz + tw - 1, temple);
    v.box(cx - tw + 1, topY + 4, cz - tw + 1, cx + tw - 1, topY + 5, cz + tw - 1, stone2);
    v.box(cx - tw, topY + 6, cz - tw, cx + tw, topY + 7, cz + tw, temple);
    for (let a = -tw; a < tw; a += 2) for (let s = 0; s < 4; s++) sideBox(v, cx, cz, s, a, a + 1, topY + 7, topY + 8, tw - 1, tw, temple);
    for (let s = 0; s < 4; s++) sideBox(v, cx, cz, s, -1, 1, topY + 1, topY + 4, tw - 2, tw - 1, "charcoal");
    sideBox(v, cx, cz, 0, -1, 1, topY + 1, topY + 4, tw - 2, tw - 1, null);
    for (const a of [-2, 1]) sideBox(v, cx, cz, 0, a, a + 1, topY + 1, topY + 4, tw - 1, tw, stone2);
  }
  if (lv >= 4) {
    // Feathered-serpent heads at the foot of the front stair: big jaws, fangs and eyes
    for (const a of [-5, 2]) {
      sideBox(v, cx, cz, 0, a, a + 3, 1, 4, r, r + 4, stone2);
      sideBox(v, cx, cz, 0, a, a + 3, 1, 2, r + 4, r + 6, stone2);
      sideBox(v, cx, cz, 0, a, a + 3, 2, 3, r + 4, r + 6, "red");
      sideBox(v, cx, cz, 0, a, a + 3, 3, 5, r + 3, r + 6, stone2);
      sideBox(v, cx, cz, 0, a, a + 1, 2, 3, r + 5, r + 6, "white");
      sideBox(v, cx, cz, 0, a + 2, a + 3, 2, 3, r + 5, r + 6, "white");
      sideBox(v, cx, cz, 0, a, a + 1, 4, 5, r + 4, r + 5, variant === 3 ? "gold" : "black");
      sideBox(v, cx, cz, 0, a + 2, a + 3, 4, 5, r + 4, r + 5, variant === 3 ? "gold" : "black");
      sideBox(v, cx, cz, 0, a, a + 3, 5, 6, r + 2, r + 4, variant === 1 ? "teal" : "leaf");
    }
    // Temple of the Warriors colonnade field to the side
    const wx = cx + r + 3;
    for (let x = wx; x < hx - 1; x += 2) for (let z = cz - r + 2; z <= cz + r - 2; z += 3) {
      v.box(x, 1, z, x + 1, 5, z + 1, stone);
      v.put(x, 5, z, stone2);
    }
    for (const s of [-1, 1]) lamp(v, cx + s * 5, 1, Math.min(hz - 2, cz + r + 6), 4, "iron");
    crowd(c, -hx + 2, cz + r + 5, hx - 2, hz - 1, lv * 2);
  }
  if (variant === 2 || lv <= 3) for (let i = 0; i < 6; i++) {
    const x = c.ri(-hx + 2, hx - 3), z = c.ri(-hz + 2, hz - 3);
    if (Math.abs(x - cx) < r + 2 && Math.abs(z - cz) < r + 2) continue;
    tree(v, x, 1, z, i % 3 === 0 ? "palm" : "round", 1.1, i);
  }
  if (lv >= 5) {
    // Ball court with stone rings, plaza, vendors, equinox glow
    const bz = hz - 6;
    v.box(-hx + 3, 0, bz - 3, hx - 3, 1, bz + 4, "sand");
    for (const zz of [bz - 4, bz + 4]) v.box(-hx + 3, 1, zz, hx - 3, 4, zz + 1, stone);
    for (const zz of [bz - 3, bz + 3]) { v.put(0, 3, zz, "stone"); v.put(0, 4, zz, "stone"); }
    for (let i = 0; i < 2; i++) person(v, -6 + i * 10, 1, bz, i ? "red" : "white", "woodDark");
    v.put(-2, 2, bz, "rubber");
    for (const x of [-hx + 4, hx - 6]) kiosk(v, x, cz + r + 3, "cream", c.pick(["red", "teal", "orange"]));
    for (let y = 1; y < topY; y += 2) {
      const b = Math.round(r - ((y - 1) * (r - rTop)) / (topY - 1)) + 1;
      sideBox(v, cx, cz, 0, -3, -2, y + 1, y + 2, b - 3, b - 1, "amber", 1.2);
    }
    for (const s of [-1, 1]) for (const z of [cz - r - 1, cz + r + 2]) floodlight(v, cx + s * (r + 2), 1, z);
    crowd(c, -hx + 2, -hz + 1, hx - 2, cz - r - 1, 10);
  }
}

// ---------------------------------------------------------------------------------------------
// MOAI STATUES
// Styles: 0 Tuff Ahu (grey stone platform), 1 Pukao (red topknots on every moai),
//         2 Coral Eyes (white coral & obsidian eyes, pale tuff), 3 Rano Raraku (heads buried on a slope)
// ---------------------------------------------------------------------------------------------

/** One moai, 5 wide, facing +z. x is the left edge, z the face-plane anchor. */
function moai(v: PixelVox, x: number, y0: number, z: number, h: number, stone: string, dark: string, o: { pukao?: boolean; eyes?: boolean } = {}): void {
  const top = y0 + h;
  const tH = Math.max(3, Math.round(h * 0.36));
  // torso (3 deep) and taller head (2 deep), face features on the z+1 plane
  v.box(x, y0, z - 1, x + 5, y0 + tH, z + 2, stone);
  v.box(x, y0 + tH, z - 1, x + 5, top, z + 1, stone);
  v.box(x, y0 + 1, z + 1, x + 1, y0 + tH, z + 2, dark);
  v.box(x + 4, y0 + 1, z + 1, x + 5, y0 + tH, z + 2, dark);
  v.box(x + 1, y0 + 1, z + 2, x + 4, y0 + 2, z + 3, dark);
  // heavy brow ridge
  v.box(x, top - 3, z + 1, x + 5, top - 2, z + 2, stone);
  v.box(x, top - 2, z, x + 5, top - 1, z + 1, stone);
  // cheeks with recessed eye sockets
  v.box(x, top - 7, z + 1, x + 5, top - 3, z + 2, stone);
  for (const ex of [x + 1, x + 3]) {
    v.put(ex, top - 4, z + 1, null);
    v.put(ex, top - 4, z, o.eyes ? "white" : dark, o.eyes ? 0.35 : 0);
    if (o.eyes) v.put(ex, top - 4, z + 1, "black");
  }
  // long nose with flared nostrils, pursed lips, jutting chin
  v.box(x + 2, top - 7, z + 2, x + 3, top - 3, z + 3, stone);
  v.box(x + 1, top - 7, z + 2, x + 4, top - 6, z + 3, stone);
  v.box(x + 1, top - 8, z + 1, x + 4, top - 7, z + 2, dark);
  v.box(x + 1, top - 9, z + 1, x + 4, top - 8, z + 3, stone);
  // long ears
  v.box(x - 1, top - 8, z - 1, x, top - 2, z + 1, stone);
  v.box(x + 5, top - 8, z - 1, x + 6, top - 2, z + 1, stone);
  v.put(x - 1, top - 5, z, dark);
  v.put(x + 5, top - 5, z, dark);
  if (o.pukao) {
    v.cylinderY(x + 2.5, z + 0.5, top, top + 2, 2.2, "#a8452f");
    v.cylinderY(x + 2.5, z + 0.5, top + 2, top + 3, 1.3, "#8e3a28");
  }
}

function moaiStatues(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const stone = c.vpick(["#9a8d7c", "#8f8273", "#b5ab9a", "#a08c72"]);
  const dark = c.vpick(["#4e443a", "#463c33", "#5d554b", "#56473a"]);
  const ahuCol = c.vpick(["#a39e94", "#94908a", "#b0aa9c", "#a39e94"]);
  lot(c, "grass2");
  speckle(c, "grass3", 0.14);
  const slope = variant === 3;
  // Sea along the back edge from Lv2
  const shoreZ = lv >= 2 ? -hz + (hz >= 16 ? 6 : 4) : -hz - 1;
  if (lv >= 2) {
    v.box(-hx, 0, -hz, hx, 1, shoreZ, "water", 0.08);
    for (let x = -hx; x < hx; x++) if ((x * 5) % 3 !== 0) v.put(x, 0, shoreZ - 1, "foam", 0.2);
    for (let x = -hx; x < hx; x++) v.put(x, 0, shoreZ, (x % 3) ? "sand" : "basalt");
    for (let i = 0; i < hx / 3; i++) rocks(c, c.ri(-hx + 1, hx - 2), 0, shoreZ, 1, "basalt");
  }
  const pk = (i: number) => variant === 1 || (lv >= 5 && variant !== 3 && i % 3 === 1);
  const eyes = variant === 2;
  if (lv === 1) {
    // Quarry: a moai lying in the rock face, a half-buried head, carvers
    v.box(-hx, 1, -hz, hx, 5, -hz + 6, "#8c7d6a");
    v.box(-hx, 5, -hz, hx, 6, -hz + 5, "grass2");
    v.box(-6, 4, -hz + 1, 5, 6, -hz + 5, stone);
    v.box(-7, 5, -hz + 2, -6, 6, -hz + 4, stone);
    v.box(-4, 6, -hz + 2, -2, 7, -hz + 4, dark);
    moai(v, -6, 1, 2, 9, stone, dark, { pukao: variant === 1, eyes });
    v.box(-hx, 1, -1, hx, slope ? 4 : 3, 4, "soil");
    for (let i = 0; i < 3; i++) worker(v, 1 + i * 2, 1, 4 + (i % 2), "woodLight");
    v.put(4, 2, 6, "basalt");
    return;
  }
  const n = [2, 4, 6, 9][lv - 2];
  const spacing = Math.min(7, Math.floor((2 * hx - 4) / n));
  const z0 = shoreZ + (hz >= 16 ? 6 : 4);
  const startX = -Math.floor((n * spacing) / 2) + Math.floor((spacing - 5) / 2);
  let base = 1;
  if (slope) {
    // grassy quarry slope rising toward the sea cliffs; heads buried to the shoulders
    for (let z = shoreZ; z < z0 + 3; z++) {
      const h = Math.max(1, Math.round((z0 + 3 - z) * 0.9));
      v.box(-hx, 1, z, hx, 1 + h, z + 1, z % 2 ? "grass2" : "grass3");
    }
    for (let i = 0; i < n; i++) {
      const x = startX + i * spacing, zz = z0 - (i % 2) * 2;
      const buried = Math.round((z0 + 3 - zz) * 0.9) - 2;
      moai(v, x, 1 + Math.max(0, buried - 3), zz, 10 + (i % 3), stone, dark, { eyes });
    }
  } else {
    // Ahu platform with fitted stones and a paved ramp of beach cobbles
    const ax0 = startX - 2, ax1 = startX + n * spacing + 1;
    v.box(ax0, 1, z0 - 3, ax1, 3, z0 + 3, ahuCol);
    for (let x = ax0; x < ax1; x += 3) v.box(x, 1, z0 + 2, x + 1, 3, z0 + 3, dark);
    for (let x = ax0; x < ax1; x++) for (let z = z0 + 3; z < Math.min(hz, z0 + 7); z++) v.put(x, 0, z, (x + z) % 3 ? "stone" : "granite");
    base = 3;
    for (let i = 0; i < n; i++) {
      const x = startX + i * spacing;
      const unfinished = lv === 2 && i === n - 1;
      if (unfinished) continue;
      moai(v, x, base, z0, (lv >= 4 ? 11 : 10) + ((i * 7) % 3), stone, dark, { pukao: pk(i), eyes });
    }
  }
  if (lv === 2) {
    // a moai being "walked" to the ahu with ropes
    const wx = hx - 6, wz = Math.min(hz - 3, z0 + 4);
    moai(v, wx, 1, wz, 9, stone, dark, { eyes });
    for (const s of [-1, 1]) {
      for (let k = 1; k <= 3; k++) v.put(wx + 2, 7, wz + s * k, "#c9a46a");
    }
    worker(v, wx - 2, 1, wz + 3, "woodLight");
    worker(v, wx + 5, 1, wz - 3 > shoreZ ? wz - 2 : wz + 3, "woodLight");
  }
  if (lv >= 3) {
    // outrigger canoe on the sea and palms
    const cz = shoreZ - Math.min(3, Math.floor((shoreZ + hz) / 2) + 1);
    v.box(-hx + 3, 1, cz, -hx + 10, 2, cz + 1, "woodDark");
    v.box(-hx + 5, 1, cz - 2, -hx + 8, 2, cz - 1, "wood");
    person(v, -hx + 6, 1, cz, "red", "woodDark");
    for (const s of [-1, 1]) tree(v, s * (hx - 2) - (s > 0 ? 1 : 0), 1, hz - 3, "palm", 1);
  }
  if (lv >= 4) {
    // petroglyph boulder and a boat-shaped hare paenga house
    v.box(-hx + 1, 1, hz - 6, -hx + 9, 3, hz - 3, "#d1b276");
    v.box(-hx + 2, 3, hz - 6, -hx + 8, 4, hz - 3, "#c09c5c");
    v.box(-hx + 3, 4, hz - 5, -hx + 7, 5, hz - 4, "#ad8a4c");
    v.box(-hx + 4, 1, hz - 3, -hx + 6, 3, hz - 2, "charcoal");
    rocks(c, hx - 6, 1, hz - 4, 2, "basalt");
    crowd(c, -hx + 10, hz - 5, hx - 2, hz - 1, lv * 2);
  }
  if (lv >= 5) {
    for (let i = 0; i < n; i += 2) floodlight(v, startX + i * spacing + 2, 0, Math.min(hz - 1, z0 + 5));
    for (const x of [-hx + 1, hx - 2]) torch(v, x, 1, z0 + 2, 4);
    for (let x = -hx + 11; x < hx - 2; x += 4) v.box(x, 1, hz - 6, x + 1, 2, hz - 5, "woodDark");
    v.box(-hx + 11, 2, hz - 6, hx - 2, 3, hz - 5, "#c9a46a");
    kiosk(v, hx - 5, hz - 3, "woodLight", "#c9a46a");
  }
}

// ---------------------------------------------------------------------------------------------
// ANGKOR WAT
// Styles: 0 Grey Sandstone, 1 Gilded Spires (gold finials, warm stone),
//         2 Ta Prohm Jungle (strangler-fig roots and moss), 3 Lotus Moat (pink lotus, lily pads)
// ---------------------------------------------------------------------------------------------

function lotusTower(v: PixelVox, cx: number, cz: number, y0: number, h: number, r: number, col: string, band: string, tip: string, emit = 0): void {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const rr = r * (1 + 0.18 * Math.sin(Math.PI * t * 1.1)) * (1 - Math.pow(t, 1.7));
    const half = Math.max(0.5, rr);
    const notch = y % 3 === 2 ? 0.6 : 0;
    const hh = Math.max(1, Math.round(half - notch));
    v.box(cx - hh, y0 + y, cz - hh, cx + hh, y0 + y + 1, cz + hh, y % 3 === 2 ? band : col);
  }
  v.box(cx - 1, y0 + h, cz - 1, cx + 1, y0 + h + 2, cz + 1, tip, emit);
  v.put(cx, y0 + h + 2, cz, tip, emit);
}

function elephant(v: PixelVox, x: number, y: number, z: number): void {
  v.box(x, y + 2, z, x + 5, y + 5, z + 3, "#8b8d91");
  for (const [lx, lz] of [[x, z], [x + 4, z], [x, z + 2], [x + 4, z + 2]]) v.box(lx, y, lz, lx + 1, y + 2, lz + 1, "#7b7d81");
  v.box(x + 5, y + 3, z, x + 7, y + 6, z + 3, "#8b8d91");
  v.box(x + 7, y + 1, z + 1, x + 8, y + 4, z + 2, "#7b7d81");
  v.put(x + 6, y + 5, z + 3, "black");
  v.box(x + 5, y + 4, z - 1, x + 6, y + 6, z, "#9a9ca0");
  v.put(x + 2, y + 5, z + 1, "red");
}

function angkorWat(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const stone = c.vpick(["#aaa48c", "#c4a878", "#9d9d84", "#b3a991"]);
  const stone2 = c.vpick(["#857f68", "#9c8358", "#6f7458", "#8a8270"]);
  const tipCol = variant === 1 ? "gold" : stone2;
  lot(c, "grass2");
  speckle(c, "grass3", 0.14);
  const cz = lv >= 4 ? -3 : -1;
  // Moat & causeway
  const moat = lv >= 4;
  if (moat) {
    const mw = 4;
    squareRing(v, 0, 0, 0, 1, hx - 1, hz - 1, mw, "water", 0.1);
    squareRing(v, 0, 0, 0, 1, hx - 1 - mw, hz - 1 - mw, 1, "sandDark");
    v.box(-3, 0, hz - 1 - mw - 1, 3, 2, hz, "limestone");
    for (const s of [-3, 2]) v.box(s, 2, hz - 1 - mw - 1, s + 1, 3, hz, lv >= 5 ? stone2 : stone);
    if (variant === 3 || lv >= 5) {
      for (let i = 0; i < 30; i++) {
        const x = c.ri(-hx + 1, hx - 2), z = c.ri(-hz + 1, hz - 2);
        const inMoat = (Math.abs(x) >= hx - 1 - mw || Math.abs(z + 0.5) >= hz - 1 - mw) && Math.abs(x) < hx - 1 && Math.abs(z) < hz - 1 && Math.abs(x) > 4;
        if (!inMoat) continue;
        v.put(x, 1, z, "leaf");
        if (variant === 3 || i % 3 === 0) v.put(x, 2, z, "pink", 0.25);
      }
    }
  }
  const inner = moat ? 6 : 1;
  const W = hx - inner - 1;
  const D = hz - inner - 1 - Math.abs(cz) - 3;
  // Stepped terraces: broad low gallery terrace, then steeper inner tiers (the Bakan)
  const tiers = [1, 2, 3, 3, 3][lv - 1];
  const tierHs = [3, 4, 6];
  const shrink = [0, 0.3, 0.55];
  let y = 1;
  const dims: [number, number][] = [];
  for (let k = 0; k < tiers; k++) {
    const w = Math.max(5, Math.round(W * (1 - shrink[k]))), d = Math.max(5, Math.round(D * (1 - shrink[k])));
    const th = tierHs[k];
    dims.push([w, d]);
    v.box(-w, y, cz - d, w, y + th, cz + d, k === 1 ? stone2 : stone);
    v.clear(-w + 1, y, cz - d + 1, w - 1, y + th - 1, cz + d - 1);
    v.box(-w, y + th - 1, cz - d, w, y + th, cz + d, k === 1 ? stone : stone2);
    for (let x = -w + 1; x < w - 1; x += 3) v.put(x, y + 1, cz + d - 1, stone2);
    // front stair
    for (let s = 0; s < th; s++) v.box(-2, y + s, cz + d + th - 1 - s, 2, y + s + 1, cz + d + th - s, "limestone");
    if (k === 0 && lv >= 3) {
      // cross-shaped gallery around the first terrace: colonnade + tiled roof + corner pavilions
      const gy = y + th;
      for (let x = -w + 1; x < w - 1; x += 2) v.box(x, gy, cz + d - 1, x + 1, gy + 3, cz + d, stone);
      for (let z = cz - d + 1; z < cz + d - 1; z += 2) { v.box(-w, gy, z, -w + 1, gy + 3, z + 1, stone); v.box(w - 1, gy, z, w, gy + 3, z + 1, stone); }
      v.box(-w, gy, cz - d, w, gy + 3, cz - d + 1, stone);
      squareRing(v, 0, cz, gy + 3, gy + 4, w, d, 2, stone2);
      squareRing(v, 0, cz, gy + 4, gy + 5, w - 0.5, d - 0.5, 1, "#6d6553");
      v.box(-2, gy, cz + d - 2, 2, gy + 5, cz + d, null);
      v.box(-3, gy + 3, cz + d - 3, 3, gy + 6, cz + d, stone);
      v.box(-2, gy + 6, cz + d - 2, 2, gy + 8, cz + d - 1, stone2);
      for (const [px, pz] of [[-w + 2, cz - d + 2], [w - 2, cz - d + 2], [-w + 2, cz + d - 2], [w - 2, cz + d - 2]]) lotusTower(v, px, pz, gy + 3, 6, 1.6, stone, stone2, tipCol);
    }
    y += th;
  }
  const topY = y;
  const [tw, td] = dims[dims.length - 1];
  const H = [10, 22, 28, 30, 34][lv - 1];
  if (lv === 1) {
    lotusTower(v, 0, cz, topY, 6, 4, stone, stone2, stone2);
    v.clear(-5, topY + 4, cz - 5, 6, topY + 12, cz + 6);
    scaffold(v, -5, cz - 5, 6, cz + 6, topY, topY + 8, "#c2a35a");
    elephant(v, -hx + 2, 0, hz - 6);
    v.box(-hx + 9, 1, hz - 5, -hx + 12, 3, hz - 3, stone);
    for (let i = 0; i < 3; i++) worker(v, 3 + i * 2, 1, hz - 3, "orange");
    for (let i = 0; i < 4; i++) tree(v, c.ri(-hx + 1, hx - 2), 1, -hz + 2 + (i % 2), "palm", 1.1);
    return;
  }
  // Central tower + quincunx
  lotusTower(v, 0, cz, topY, H, 5.6, stone, stone2, tipCol, variant === 1 && lv >= 5 ? 1.2 : 0);
  const corners: [number, number][] = [[-tw + 3, cz - td + 3], [tw - 3, cz - td + 3], [-tw + 3, cz + td - 3], [tw - 3, cz + td - 3]];
  if (lv === 2) {
    lotusTower(v, corners[3][0], corners[3][1], topY, 6, 2.6, stone, stone2, stone2);
    scaffold(v, corners[3][0] - 4, corners[3][1] - 4, corners[3][0] + 5, corners[3][1] + 4, topY, topY + 12, "#c2a35a");
    elephant(v, -hx + 2, 0, hz - 6);
    for (let i = 0; i < 4; i++) worker(v, -4 + i * 3, topY, cz + td - 1, "orange");
  } else {
    for (const [x, z] of corners) lotusTower(v, x, z, topY, Math.round(H * 0.66), 3.6, stone, stone2, tipCol, variant === 1 && lv >= 5 ? 1.2 : 0);
  }
  // Ta Prohm roots
  if (variant === 2) {
    for (let i = 0; i < 5 + lv; i++) {
      const x = c.ri(-W, W), z = c.ri(cz - D, cz + D);
      v.box(x, 1, z, x + 1, 2 + c.ri(2, 6), z + 1, "#b8ab8f");
      tree(v, x, 6 + c.ri(0, 3), z, "round", 1.3, i);
    }
    speckle(c, "moss", 0.08, 0, 1);
  }
  if (lv >= 4) {
    // libraries flanking the causeway approach
    for (const s of [-1, 1]) {
      const lx = s * Math.round(W * 0.6);
      const lz = hz - inner - 4;
      v.box(lx - 3, 1, lz - 2, lx + 3, 4, lz + 2, stone);
      v.box(lx - 3, 4, lz - 2, lx + 3, 5, lz + 2, stone2);
      v.box(lx - 2, 5, lz - 1, lx + 2, 6, lz + 1, stone2);
    }
  }
  if (lv >= 3) {
    crowd(c, -6, hz - inner - 3, 7, hz - 1, lv * 2, (x, z) => (Math.abs(z) >= hz - 6 && moat ? 2 : 1));
    for (let i = 0; i < lv; i++) robed(v, -4 + i * 2, topY, cz + td + 1, "orange", false);
  }
  if (lv >= 5) {
    // seven-headed naga at the causeway head
    for (const s of [-1, 1]) {
      const nx = s > 0 ? 2 : -4;
      v.box(nx, 2, hz - 2, nx + 2, 6, hz - 1, stone2);
      for (let k = 0; k < 3; k++) v.put(nx + (k % 2), 6 + k, hz - 2, stone2);
    }
    for (let z = hz - 9; z < hz - 1; z += 3) for (const s of [-4, 3]) lamp(v, s, 2, z, 3, "woodDark", "warmGlow");
    for (const [x, z] of corners) floodlight(v, x + 3, topY, z + 3);
    floodlight(v, 0, topY, cz + 6);
    crowd(c, -hx + 1, hz - 2, hx - 1, hz - 1, 6);
    // reflecting pools inside the enclosure
    for (const s of [-1, 1]) v.box(s * 9 - 3, 0, hz - inner - 2, s * 9 + 3, 1, hz - inner, "water", 0.1);
  }
}

// ---------------------------------------------------------------------------------------------
// MACHU PICCHU
// Styles: 0 Granite Ruins (roofless gables), 1 Cloud Forest (lush green, mist clouds),
//         2 Thatch Restored (golden thatched roofs), 3 Inti Sunset (warm stone, golden sun temple)
// ---------------------------------------------------------------------------------------------

function llama(v: PixelVox, x: number, y: number, z: number, col: string): void {
  v.box(x, y + 1, z, x + 3, y + 3, z + 1, col);
  v.put(x, y, z, col);
  v.put(x + 2, y, z, col);
  v.box(x + 3, y + 2, z, x + 4, y + 5, z + 1, col);
  v.put(x + 4, y + 4, z, col);
  v.put(x + 3, y + 5, z, "charcoal");
}

function machuPicchu(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const granite = c.vpick(["#a19a8e", "#8f9488", "#a8a091", "#c09e7a"]);
  const granite2 = c.vpick(["#7f796f", "#6f766a", "#868072", "#9c7c5c"]);
  const grassTop = c.vpick(["grass", "leaf", "grass2", "#9fb85a"]);
  const thatch = c.vpick(["#b08a4a", "#8f7a43", "#e0b85a", "#c79a4a"]);
  lot(c, "leafDark");
  // Terraced ridge: rises toward the back, falls away at the sides
  const N = [3, 5, 6, 7, 8][lv - 1];
  const H = (x: number, z: number): number => {
    if (x < -hx || x >= hx || z < -hz || z >= hz) return 0;
    const row = Math.floor(((hz - 1 - z) / (2 * hz)) * N);
    const side = Math.max(0, Math.abs(x + 0.5) - (hx - 5));
    const plazaBonus = 0;
    return Math.max(1, 1 + row * 2 - Math.round(side * 0.9) + plazaBonus);
  };
  for (let x = -hx; x < hx; x++) for (let z = -hz; z < hz; z++) {
    const h = H(x, z);
    const lo = Math.min(H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1));
    v.box(x, Math.max(1, lo), z, x + 1, h, z + 1, (x + h) % 4 === 0 ? granite2 : granite);
    v.put(x, h, z, grassTop);
  }
  const yAt = (x: number, z: number) => H(x, z) + 1;
  // Huayna Picchu peak behind
  if (lv >= 4) {
    const px = hx - 9, pz = -hz + 8, ph = lv >= 5 ? 26 : 20;
    for (let y = 0; y < ph; y++) {
      const t = y / ph;
      const rr = 8 * (1 - Math.pow(t, 0.8)) + 0.6;
      v.cylinderY(px, pz, H(px, pz) + y, H(px, pz) + y + 1, rr, y % 5 === 0 ? granite2 : t > 0.75 ? granite : "leafDark");
    }
    if (variant === 1) for (const [x, y, z] of [[px - 4, 18, pz + 3], [-hx + 6, 16, -hz + 4]]) v.sphere(x, H(px, pz) + y, z, 4, 1.5, 3, "white");
  }
  // Houses: stone walls with steep gable ends; roofed by level / style
  const house = (x: number, z: number, w: number, d: number, roof: boolean) => {
    const y = yAt(x, z);
    v.hollowBox(x, y, z, x + w, y + 4, z + d, granite);
    v.box(x + Math.floor(w / 2) - 1, y, z + d - 1, x + Math.floor(w / 2) + 1, y + 3, z + d, "charcoal");
    v.put(x + Math.floor(w / 2) - 1, y + 2, z + d - 1, granite);
    const rise = Math.ceil(w / 2);
    for (let s = 0; s < rise; s++) {
      v.box(x + s, y + 4 + s, z, x + w - s, y + 5 + s, z + 1, granite);
      v.box(x + s, y + 4 + s, z + d - 1, x + w - s, y + 5 + s, z + d, granite);
      if (roof) v.box(x + s - 1 + (s === 0 ? 0 : 0), y + 4 + s, z, x + w - s + 1, y + 5 + s, z + d, thatch);
    }
    if (roof) v.box(x + rise - 1, y + 4 + rise, z, x + w - rise + 1, y + 5 + rise, z + d, thatch);
  };
  const roofAll = variant === 2 || lv >= 5;
  const spots: [number, number, number, number][] = [
    [-hx + 3, -hz + 3, 6, 5], [-hx + 11, -hz + 3, 5, 5], [-6, -hz + 9, 6, 5], [2, -hz + 9, 5, 4],
    [-hx + 3, -hz + 11, 5, 4], [hx - 12, -2, 6, 4], [-hx + 4, 2, 5, 4], [6, 4, 5, 4],
  ];
  const nh = [1, 2, 4, 6, 8][lv - 1];
  for (let i = 0; i < Math.min(nh, spots.length); i++) {
    const [x, z, w, d] = spots[i];
    if (x + w > hx - 1 || z + d > hz - 1) continue;
    if (lv >= 4 && Math.hypot(x + w / 2 - (hx - 9), z + d / 2 - (-hz + 8)) < 10) continue;
    house(x, z, w, d, roofAll || i % 3 === 0);
  }
  // Central plaza
  if (lv >= 3) {
    for (let x = -4; x < 5; x++) for (let z = -2; z < 3; z++) v.put(x, H(x, z), z, "grass3");
  }
  // Temple of the Sun (curved tower) and Intihuatana stone
  if (lv >= 4) {
    const tx = -hx + 8, tz = Math.min(hz - 8, 6), ty = yAt(tx, tz);
    ring(v, tx, tz, ty, ty + 6, 4, 2.6, granite);
    v.box(tx - 1, ty + 1, tz + 3, tx + 1, ty + 3, tz + 4, "charcoal");
    if (variant === 3 || lv >= 5) v.cylinderY(tx, tz, ty, ty + 1, 2.5, "gold", 0.6);
    const ix = 0, iz = -hz + 4, iy = yAt(ix, iz);
    v.box(ix - 1, iy, iz - 1, ix + 2, iy + 1, iz + 2, granite2);
    v.box(ix, iy + 1, iz, ix + 1, iy + 4, iz + 1, variant === 3 ? "gold" : granite);
  }
  // Inca trail switchbacks on the front slope
  if (lv >= 3) for (let z = hz - 2; z > hz - 10; z -= 1) { const x = hx - 4 - ((hz - z) % 6 < 3 ? (hz - z) % 3 : 3 - ((hz - z) % 3)); v.put(x, H(x, z), z, "path"); }
  // Llamas
  const ll = [1, 2, 3, 4, 5][lv - 1];
  for (let i = 0; i < ll; i++) {
    const x = c.ri(-hx + 2, hx - 6), z = c.ri(-hz + 3, hz - 3);
    llama(v, x, yAt(x, z), z, i % 2 ? "white" : "#a07040");
  }
  // Construction / life
  if (lv <= 2) {
    for (let i = 0; i < 3; i++) { const x = -2 + i * 3, z = hz - 4; worker(v, x, yAt(x, z), z, "red"); v.put(x + 1, yAt(x, z) + 1, z, granite); }
    blockPile(c, hx - 6, hz - 4, granite, yAt(hx - 6, hz - 4));
    if (lv === 2) scaffold(v, spots[1][0] - 1, spots[1][1] - 1, spots[1][0] + 6, spots[1][1] + 6, yAt(spots[1][0], spots[1][1]), yAt(spots[1][0], spots[1][1]) + 7, "#c2a35a");
  }
  if (variant === 1) for (let i = 0; i < 6; i++) { const x = c.ri(-hx + 1, hx - 2), z = c.ri(-hz + 1, hz - 2); tree(v, x, yAt(x, z), z, "round", 0.9, i); }
  if (lv >= 4) crowd(c, -4, -2, 5, 3, lv * 2, yAt);
  if (lv >= 5) {
    crowd(c, -hx + 2, -hz + 2, hx - 2, hz - 2, 12, yAt);
    for (let i = 0; i < 8; i++) { const x = -hx + 3 + i * 7, z = hz - 3 - (i % 2) * 6; if (x < hx - 2) lamp(v, x, yAt(x, z), z, 3, "woodDark", "warmGlow"); }
    for (const [x, , z] of [[-hx + 6, 0, -hz + 6], [4, 0, -hz + 12], [-6, 0, 0]] as [number, number, number][]) floodlight(v, x, yAt(x, z), z);
    v.sphere(-hx + 6, 26, hz - 6, 5, 1.5, 3, "white");
  }
}

// ---------------------------------------------------------------------------------------------

defineDesigns({
  colosseum: {
    footprints: fp("colosseum"),
    levels: ["Arena Foundations", "Rising Arcades", "Flavian Amphitheatre", "Imperial Colosseum", "Colosseum of the Eternal City"],
    growth: "Arcade tiers climb around an elliptical arena; gladiators, an attic storey, then a floodlit plaza full of crowds.",
    build: colosseum,
  },
  stonehenge: {
    footprints: fp("stonehenge"),
    levels: ["Timber Woodhenge", "Sarsen Arc", "Lintel Circle", "Trilithon Sanctuary", "Midsummer Solstice Henge"],
    growth: "Timber posts give way to a sarsen ring, lintels and trilithons, then a torchlit solstice axis with druids.",
    build: stonehenge,
  },
  parthenon: {
    footprints: fp("parthenon"),
    levels: ["Marble Foundations", "Doric Colonnade", "Temple of Athena", "Sacred Acropolis", "Golden Age Acropolis"],
    growth: "Column drums rise on a rocky hill into a roofed Doric temple, then an acropolis with caryatids and a gate.",
    build: parthenon,
  },
  great_wall: {
    footprints: fp("great_wall"),
    levels: ["Rammed-Earth Rampart", "Brick Battlement", "Beacon Wall", "Mountain Ramparts", "Grand Pass Fortress"],
    growth: "A low earthen rampart becomes a brick wall snaking over ever higher hills between beacon towers and a gate.",
    build: greatWall,
  },
  chichen_itza: {
    footprints: fp("chichen_itza"),
    levels: ["Jungle Mound", "Terrace Restoration", "El Castillo", "Feathered Serpent Plaza", "Equinox Ceremonial City"],
    growth: "An overgrown mound is cleared into nine terraces with four stairs, serpent heads, a ball court and equinox light.",
    build: chichenItza,
  },
  moai_statues: {
    footprints: fp("moai_statues"),
    levels: ["Quarry Carving", "Walking Moai", "Seaside Ahu", "Ancestor Coast", "Tongariki Ahu"],
    growth: "A moai is carved from the quarry, walked to the shore and joined by ever longer rows of giants on the ahu.",
    build: moaiStatues,
  },
  angkor_wat: {
    footprints: fp("angkor_wat"),
    levels: ["Laterite Base", "Central Prasat", "Quincunx Temple", "Moated Sanctuary", "Angkor Sunrise"],
    growth: "Elephants haul stone for a lotus tower; five towers, galleries, a moat and a naga causeway follow.",
    build: angkorWat,
  },
  machu_picchu: {
    footprints: fp("machu_picchu"),
    levels: ["Cloud-Forest Outpost", "Terraced Hamlet", "Royal Citadel", "Huayna Picchu Sanctuary", "Lost City of the Incas"],
    growth: "Terraces climb the ridge; stone houses, a sun temple and the Huayna Picchu peak appear, grazed by llamas.",
    build: machuPicchu,
  },
});
