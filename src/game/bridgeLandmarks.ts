import type { BridgeBay } from "./bridgeWorks";

// A cable or rib follows the same integer profile on both sides of a bay seam.
// Filling the rise since the previous column keeps every stair face-connected.
function rib(b: BridgeBay, x: number, z: number, previous: number, height: number, color: string, thickness = 1) {
  const a = Math.round(previous), h = Math.round(height);
  b.fixed.box(x, Math.min(a, h), z, x + 1, Math.max(a, h) + thickness, z + 1, color);
}

const steel = { red: "#BA4A32", bright: "#DE6240", dark: "#813E35", cream: "#EBD5AD", brass: "#E2B16F" };
const greyStone = ["#BBA98F", "#BC8E6E", "#909F9D", "#9DA082"];
const chalk = ["#E8DABE", "#E8BD90", "#CBD3C9", "#D9D0A8"];
const iron = "#42666D", rivet = "#769497", darkIron = "#324E58", pin = "#C38E54";
const sky = "#3F839E", slate = "#405E72", pale = "#D9C9A8", ochre = "#B49E80";
const sides = [-1, 1] as const;
const bank = (b: BridgeBay, side: number) => side < 0 ? -b.halfWidth - 1 : b.halfWidth;
const start = (b: BridgeBay) => b.index * 16;
const towerU = (index: number) => index * 16 + 8;

function footing(b: BridgeBay, x: number, z: number, radius: number, stone: string) {
  b.fixed.box(x - radius, b.bed, z - radius, x + radius + 1, 0, z + radius + 1, stone);
  b.fixed.box(x - radius - 1, -3, z - radius - 1, x + radius + 2, -1, z + radius + 2, "#ADB2A9");
}

function suspenderHeight(b: BridgeBay, u: number, anchors: number[]): number {
  const last = b.length * 16 - 1, h = b.towerHeight;
  const next = anchors.find(a => u <= a);
  if (next === undefined) return 2 + (h - 2) * ((last - u) / (last - anchors[anchors.length - 1])) ** 1.5;
  const i = anchors.indexOf(next);
  if (i === 0) return 2 + (h - 2) * (u / next) ** 1.5;
  const t = (u - anchors[i - 1]) / (next - anchors[i - 1]);
  const low = Math.max(3, Math.round(h * .29));
  return low + (h - low) * (2 * t - 1) ** 2;
}

// Each stay lies in a single side plane. Clip the longitudinal range first,
// then fill its rising stair within the bay that owns that portion of the run.
function stay(b: BridgeBay, u0: number, h0: number, u1: number, h1: number, z: number, color: string) {
  if (u0 === u1) return;
  const lo = Math.min(u0, u1), hi = Math.max(u0, u1);
  const height = (u: number) => h0 + (h1 - h0) * (u - u0) / (u1 - u0);
  for (let u = Math.max(start(b), lo); u <= Math.min(start(b) + 15, hi); u++)
    rib(b, u - start(b) - 8, z, height(Math.max(u - 1, lo)), height(u), color);
}

function suspensionTower(b: BridgeBay, gothic: boolean) {
  const h = b.towerHeight, wide = gothic && b.tier >= 6 ? 3 : b.tier >= 6 ? 2 : 1;
  const stone = greyStone[b.variant], light = chalk[b.variant];
  for (const s of sides) {
    const z = bank(b, s);
    footing(b, 0, z, wide, gothic ? stone : "#7B8379");
    b.fixed.box(-wide, -1, z - 1, wide + 1, h + 1, z + 2, gothic ? stone : steel.red);
    b.fixed.box(-wide - 1, 0, z - 1, wide + 2, Math.floor(h * .3), z + 2, gothic ? stone : steel.dark);
    b.fixed.box(-wide, 1, z + s * 2, wide + 1, h - 2, z + s * 2 + 1, gothic ? stone : steel.bright);
    if (gothic) {
      for (let y = 3; y < h - 1; y += 5) b.fixed.box(-wide - 1, y, z - 1, wide + 2, y + 1, z + 2, light);
      if (b.tier >= 6) {
        // The twin stone legs flare into pointed cutwaters. Tall recessed
        // windows and raised sides remain legible from along the riverbank.
        const edgeZ = z + s * 2;
        b.fixed.box(-wide - 2, b.bed, z - 1, wide + 3, Math.round(h * .28), z + 2, stone);
        b.fixed.box(-wide - 2, Math.round(h * .28), z - 1, wide + 3, Math.round(h * .28) + 1, z + 2, light);
        for (const dx of [-wide, wide]) {
          b.fixed.box(dx, 2, edgeZ, dx + 1, h + 4, edgeZ + 1, light);
          b.fixed.put(dx, h + 4, edgeZ, stone);
        }
        for (const dx of [-1, 1]) {
          b.fixed.box(dx, h - 7, edgeZ, dx + 1, h - 3, edgeZ + 1, darkIron);
          b.fixed.put(dx, h - 8, edgeZ, light);
        }
      }
      b.fixed.box(-wide - 1, h - 1, z - 2, wide + 2, h + 1, z + 3, light);
      for (const dx of [-wide, wide]) b.fixed.box(dx, h + 1, z - 1, dx + 1, h + 3, z + 2, stone);
      if (b.variant === 1) {
        for (let r = 0; r <= wide; r++)
          b.fixed.box(-wide + r, h + 2 + r, z - 1, wide - r + 1, h + 3 + r, z + 2, light);
        b.fixed.box(0, h + 3 + wide, z, 1, h + 6 + wide, z + 1, stone);
      } else if (b.variant === 2) {
        b.fixed.box(-wide - 1, h + 1, z - 2, wide + 2, h + 4, z + 3, stone);
        b.fixed.box(-wide - 2, h + 4, z - 2, wide + 3, h + 5, z + 3, light);
      } else if (b.variant === 3) {
        for (let vx = -wide; vx <= wide; vx++)
          b.fixed.box(vx, h + 2, z - 1, vx + 1, h + 3 + Math.round(3 * (1 - (vx / wide) ** 2)), z + 2, stone);
        for (let y = Math.floor(h * .32); y < h; y++) {
          const vx = Math.round(wide * Math.sin(y * .37));
          b.fixed.put(vx, y, z + 2 * s, y % 3 ? "#798459" : "#92965C");
        }
      }
    } else {
      for (const f of [.36, .64, .88]) {
        const y = Math.round(h * f);
        b.fixed.box(-wide - 1, y, z - 1, wide + 2, y + 1, z + 2, steel.bright);
      }
      if (b.variant === 2) {
        const rise = Math.max(4, Math.min(8, Math.round(h * .24)));
        for (let y = 0; y <= rise; y++) for (const sign of sides) {
          const dx = sign * Math.round(5 * y / rise);
          b.fixed.box(dx - 1, h - 2 + y, z, dx + 1, h - 1 + y, z + 1, steel.bright);
        }
      } else if (b.variant === 3) {
        const cap = h + Math.max(4, Math.round(h * .22));
        b.fixed.box(-1, h, z - 1, 2, cap - 1, z + 2, steel.red);
        b.fixed.box(-2, cap - 1, z - 1, 3, cap, z + 2, steel.dark);
        b.fixed.box(-1, cap, z, 2, cap + 2, z + 1, steel.cream, .35);
        b.fixed.box(-1, cap + 2, z - 1, 2, cap + 3, z + 2, steel.bright);
        b.fixed.put(0, cap + 3, z, steel.brass);
      } else {
        b.fixed.box(-1, h + 1, z, 2, h + 2, z + 1, steel.bright);
        if (b.tier >= 7) b.fixed.put(0, h + 2, z, "#FFC69B", .45);
      }
    }
  }
  for (let z = -b.halfWidth; z < b.halfWidth; z++) {
    const pos = (z + .5) / b.halfWidth;
    if (gothic) {
      // Two lancets with a high central corbel. Even a broad highway stays
      // open below the corbel; the central pendant never lands in a lane.
      const pane = 1 - Math.abs(2 * Math.abs(pos) - 1);
      const bottom = Math.max(8, Math.round(h * (.38 + .47 * pane ** .72)));
      b.fixed.box(-wide, bottom, z, wide + 1, h + 1, z + 1, stone);
      b.fixed.put(wide + 1, bottom, z, light);
      b.fixed.put(-wide - 1, bottom, z, light);
      b.fixed.put(0, h + 1, z, light);
      if ((z + b.halfWidth) % 4 < 2) b.fixed.put(0, h + 2, z, stone);
    } else {
      const lintel = Math.max(8, Math.floor(h * .55));
      const rise = b.variant === 1 ? 1 - Math.abs(pos) : Math.abs(pos);
      const low = lintel + Math.round(rise * Math.min(4, Math.floor(h / 8)));
      b.fixed.box(-1, low, z, 2, low + 1, z + 1, steel.red);
      const crest = b.variant === 1 ? Math.round((1 - Math.abs(pos)) * Math.min(10, h * .35, b.halfWidth * 1.6)) : 0;
      b.fixed.box(-1, h - 2 + crest, z, 2, h + crest, z + 1, steel.red);
      if (b.tier >= 5) {
        const brace = h - 3 - Math.round((1 - Math.abs(pos)) * Math.min(4, h / 6));
        b.fixed.put(0, brace, z, steel.bright);
      }
    }
  }
}

function suspend(b: BridgeBay, gothic: boolean) {
  const anchors = b.towers.map(towerU), last = b.length * 16 - 1;
  if (!anchors.length) {
    for (const s of sides) {
      const z = bank(b, s);
      for (let x = -8; x < 8; x++) {
        const u = start(b) + x + 8, t = (2 * u - last) / last;
        if (gothic) {
          const underside = -2 - Math.round(4 * t ** 4);
          b.fixed.box(x, underside, z, x + 1, 1, z + 1, greyStone[b.variant]);
          b.fixed.put(x, underside - 1, z, chalk[b.variant]);
        } else {
          const rail = [3 * t * t, 4 * (1 - Math.abs(t)), 3 * Math.abs(t), 2 * t * t][b.variant];
          const h = 2 + Math.round(rail);
          b.fixed.put(x, h, z, steel.red);
          if (b.variant === 2 && (u % 8 === 0 || u === last)) b.fixed.put(x, h + 1, z + s, steel.bright);
          if (b.variant === 3 && (u === 0 || u === last)) b.fixed.put(x, h + 1, z, steel.cream, .3);
          if (u % 4 === 0 || u === last) b.fixed.box(x, 0, z, x + 1, h, z + 1, steel.dark);
        }
      }
    }
    return;
  }
  for (const s of sides) {
    const z = bank(b, s), body = gothic ? "#617774" : steel.bright;
    for (let x = -8; x < 8; x++) {
      const u = start(b) + 8 + x, y = suspenderHeight(b, u, anchors);
      rib(b, x, z, suspenderHeight(b, Math.max(u - 1, 0), anchors), y, body, !gothic && b.tier >= 8 ? 2 : 1);
      if (gothic && b.tier >= 5) {
        const distance = Math.min(u, last - u);
        const approach = anchors[0];
        if (distance < approach) {
          // Short masonry approach arcades and the stone cable anchorage
          // terminate the Brooklyn span on both banks.
          const phase = (distance + 2) % 14;
          const t = Math.abs(phase - 7) / 7;
          const under = -2 - Math.round(6 * t ** 3);
          b.fixed.box(x, under, z, x + 1, 0, z + 1, greyStone[b.variant]);
          b.fixed.put(x, under - 1, z, chalk[b.variant]);
          if (phase === 0 || phase === 13) b.fixed.box(x, b.bed, z, x + 1, under - 1, z + 1, greyStone[b.variant]);
        }
        if (distance < 7) {
          const top = 2 + Math.floor((7 - distance) / 2);
          b.fixed.box(x, -2, z - 1, x + 1, top, z + 2, greyStone[b.variant]);
          b.fixed.box(x, top, z - 1, x + 1, top + 1, z + 2, chalk[b.variant]);
        }
      }
      if (u % (gothic ? 7 : 5) === 0) b.fixed.box(x, 1, z, x + 1, Math.round(y) + 1, z + 1, gothic ? rivet : steel.red);
      if (u === 0 || u === last) b.fixed.box(x, -2, z - 1, x + 1, 4, z + 2, gothic ? greyStone[b.variant] : steel.dark);
    }
    if (gothic) for (let i = 0; i < anchors.length; i++) for (const dir of sides) {
      const a = anchors[i], neighbor = anchors[i + dir];
      const limit = neighbor === undefined ? (dir < 0 ? 0 : last) : Math.round((a + neighbor) / 2);
      for (const fraction of [.36, .62, .9]) stay(b, a, b.towerHeight - 2, Math.round(a + (limit - a) * fraction), 2, z + s, "#7D8982");
    }
  }
  if (b.towers.includes(b.index)) suspensionTower(b, gothic);
}

function throughArch(b: BridgeBay) {
  const last = b.length * 16 - 1, h = b.towerHeight;
  // On a long crossing the arch springs from the two harbour pylons. The
  // little side approaches have their own lower, independent bowstrings.
  const boundaries = b.towers.length > 1 && b.variant !== 3 ? [0, ...b.towers.map(towerU), last] : [0, last];
  for (const s of sides) {
    const z = bank(b, s);
    for (let i = 1; i < boundaries.length; i++) {
      const lo = boundaries[i - 1], hi = boundaries[i];
      const approach = boundaries.length > 2 && (i === 1 || i === boundaries.length - 1);
      const rise = b.length < 3 ? 3 : approach ? Math.max(4, Math.round(h * .29)) : h;
      const depth = b.length < 3 ? 1 : Math.max(2, Math.round(rise * (b.variant === 1 ? .40 : b.variant === 3 ? .08 : .18)));
      const crown = (u: number) => {
        const t = Math.abs((2 * u - lo - hi) / (hi - lo));
        // Warren follows a parabolic steel rib; the crossed truss is pitched,
        // the Pratt has long horizontal panels, and the bowstring sweeps the
        // entire river in a single elliptical outline.
        const profile = b.variant === 1 ? 1 - t : b.variant === 2 ? Math.min(1, (1 - t) * 2.1) :
          b.variant === 3 ? Math.sqrt(1 - t * t) : 1 - t * t;
        return 2 + rise * profile;
      };
      const pitch = b.length < 3 ? 5 : 8;
      for (let u = Math.max(start(b), lo); u <= Math.min(start(b) + 15, hi); u++) {
        const x = u - start(b) - 8, y = crown(u), prev = crown(Math.max(lo, u - 1));
        rib(b, x, z, prev, y, iron, b.tier >= 6 && !approach ? 2 : 1);
        rib(b, x, z, prev + depth, y + depth, rivet);
        const panel = (u - lo) / pitch;
        const zig = (v: number) => Math.abs((v % 2) - 1);
        const diagonal = (v: number) => b.variant === 2 ? v % 1 : zig(v);
        rib(b, x, z, prev + depth * diagonal(Math.max(0, panel - 1 / pitch)), y + depth * diagonal(panel), darkIron);
        if (b.variant === 1) rib(b, x, z, prev + depth * (1 - zig(Math.max(0, panel - 1 / pitch))), y + depth * (1 - zig(panel)), iron);
        if (b.variant === 3) {
          b.fixed.put(x, Math.round(y + depth), z + s, rivet);
          b.fixed.put(x, 1, z, iron);
        }
        if ((u - lo) % pitch === 0) {
          b.fixed.box(x, 0, z, x + 1, Math.round(y) + 1, z + 1, darkIron);
          b.fixed.put(x, Math.round(y + depth), z + s, pin);
          if (s === 1 && y >= 8 && !approach && (u - lo) % (2 * pitch) === 0)
            b.fixed.box(x, Math.round(y + depth), -b.halfWidth, x + 1, Math.round(y + depth) + 1, b.halfWidth, iron);
        }
      }
    }
    if (b.towers.includes(b.index) && b.towers.length > 1) {
      const p = Math.min(11, Math.round(h * .35));
      footing(b, 0, z, 2, "#928A76");
      b.fixed.box(-3, 0, z - 1, 4, p - 2, z + 2, "#B8AC91");
      b.fixed.box(-2, p - 2, z - 1, 3, p + 1, z + 2, "#D6CCAF");
      b.fixed.box(-3, p, z - 1, 4, p + 1, z + 2, "#E2D6B9");
    }
  }
}

function liftCenters(b: BridgeBay): number[] {
  if (b.towers.length) return b.towers.map(towerU);
  // A starter lift still needs working guides for the moving deck even
  // before its first full-length central tower is built.
  return [3, b.length * 16 - 4];
}

function lift(b: BridgeBay) {
  const h = b.towerHeight, centers = liftCenters(b), tall = b.length >= 3 && b.tier >= 4;
  const cabinDepth = tall ? 3 : 1;
  const roofBase = h + (tall ? 6 : 2);
  for (const s of sides) {
    const z = bank(b, s) + s * 2;
    for (let x = -8; x < 8; x++) {
      const u = start(b) + x + 8;
      if (u >= centers[0] && u <= centers[centers.length - 1]) {
        b.fixed.put(x, h, z, slate);
        if (tall) {
          b.fixed.put(x, h + 1, z, pale);
          b.fixed.put(x, h + 3, z, sky);
          if (u % 3 === 0) b.fixed.put(x, h + 2, z, ochre);
        }
      }
      if (u % 5 === 0) b.moving.put(x, 0, bank(b, s), sky);
      if (b.tier >= 5) b.moving.put(x, -2, bank(b, s), sky);
    }
    for (const center of centers) {
      // The winch and descending counterweight sit outside the moving deck.
      const x = center - start(b) - 8;
      if (x < -5 || x > 4) continue;
      footing(b, x, z, cabinDepth, ochre);
      b.fixed.box(x - cabinDepth, 0, z - 1, x + cabinDepth + 1, h + 1, z + 2, pale);
      b.fixed.box(x - cabinDepth, 2, z, x + cabinDepth + 1, 4, z + 1, ochre);
      if (tall) {
        const wall = z + 2 * s;
        b.fixed.box(x - 3, 0, wall, x + 4, h + 1, wall + 1, pale);
        for (const dx of [-3, 3]) {
          b.fixed.box(x + dx, 0, wall + s, x + dx + 1, Math.round(h * .45), wall + s + 1, ochre);
          b.fixed.box(x + dx, Math.round(h * .45), wall, x + dx + 1, h, wall + 1, ochre);
        }
        for (let y = 6; y < h - 2; y += 6) {
          for (const dx of [-1, 1]) b.fixed.box(x + dx, y, wall, x + dx + 1, y + 2, wall + 1, slate);
          b.fixed.box(x - 3, y - 1, wall, x + 4, y, wall + 1, ochre);
        }
      }
      if (tall) for (let y = 6; y < h - 2; y += 5) {
        b.fixed.box(x - cabinDepth, y, z + s, x + cabinDepth + 1, y + 1, z + s + 1, ochre);
        b.fixed.put(x, y + 2, z + s, slate);
      }
      b.fixed.box(x - cabinDepth - 1, h - 1, z - 2, x + cabinDepth + 2, h + 1, z + 3, ochre);
      b.fixed.box(x - cabinDepth, h + 1, z - 1, x + cabinDepth + 1, roofBase, z + 2, pale);
      b.fixed.put(x, h + 1, z + s, slate);
      for (let i = 0; i <= cabinDepth; i++)
        b.fixed.box(x - cabinDepth + i, roofBase + i, z - cabinDepth + i,
          x + cabinDepth + 1 - i, roofBase + i + 1, z + cabinDepth + 1 - i, slate);
      if (tall) b.fixed.put(x, roofBase + cabinDepth + 1, z, "#E2B867");
      b.fixed.box(x, 0, z + 3 * s, x + 1, h + 1, z + 3 * s + 1, "#657478");
      b.weights.box(x - 1, h - 7, z + 3 * s, x + 2, h - 4, z + 3 * s + 1, "#87654A");
      b.weights.put(x, h - 6, z + 3 * s, pin);
      if (s === 1) {
        b.fixed.box(x - 1, h, -z, x + 2, h + 1, z, pale);
        if (tall) {
          // A roofed bascule-era tower house crosses over the road at the
          // high walkway. Its full lower portal clears an open, raised deck.
          const radius = Math.min(3, x + 7, 6 - x);
          b.fixed.box(x - radius, h + 1, -z, x + radius + 1, roofBase, z, pale);
          for (let dz = -z + 1; dz < z - 1; dz += 3) for (const dx of [-radius, radius])
            b.fixed.box(x + dx, h + 2, dz, x + dx + 1, roofBase - 1, dz + 1, slate);
          b.fixed.box(x - radius - 1, roofBase - 1, -z - 1, x + radius + 2, roofBase, z + 1, ochre);
          for (let row = 0; row <= radius; row++)
            b.fixed.box(x - radius + row, roofBase + row, -z + row, x + radius - row + 1, roofBase + row + 1, z - row, slate);
          for (const dx of [-radius, radius]) for (const dz of [-z - 1, z]) {
            b.fixed.box(x + dx - 1, h - 1, dz - 1, x + dx + 2, roofBase + 2, dz + 2, pale);
            b.fixed.box(x + dx - 1, roofBase + 2, dz - 1, x + dx + 2, roofBase + 3, dz + 2, slate);
            b.fixed.box(x + dx, roofBase + 3, dz, x + dx + 1, roofBase + 5, dz + 1, sky);
            b.fixed.put(x + dx, roofBase + 5, dz, pin);
          }
        }
      }
    }
  }
}

function fan(b: BridgeBay) {
  const anchors = b.towers.map(towerU), last = b.length * 16 - 1;
  const h = b.towerHeight;
  const column = ["#E9D9B3", "#E1BD88", "#CAD9DA", "#E2C2A1"][b.variant];
  const cap = ["#DE9E4F", "#BD7953", "#64959D", "#8F716C"][b.variant];
  for (const s of sides) {
    const z = bank(b, s);
    if (!anchors.length) {
      for (let x = -8; x < 8; x++) {
        const u = start(b) + x + 8;
        b.fixed.put(x, -2, z, cap);
        if (u === 1 || u === last - 1) b.fixed.box(x, b.bed, z, x + 1, 3, z + 1, column);
      }
    }
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      for (const dir of sides) {
        const neighbor = anchors[i + dir];
        const end = neighbor === undefined ? (dir < 0 ? 0 : last) : Math.round((a + neighbor) / 2);
        const strands = Math.min(9, Math.max(2, Math.floor(Math.abs(end - a) / 6)));
        for (let j = 1; j <= strands; j++) {
          const anchor = Math.round(a + (end - a) * j / strands);
          stay(b, a, h - Math.round((1 - j / strands) * h * .25), anchor, 1, z, j % 3 ? "#E4E3D2" : "#C5D3CF");
        }
      }
    }
    if (b.towers.includes(b.index)) {
      footing(b, 0, z, 1, "#A7AD9E");
      const tipZ = b.variant === 2 ? z : Math.round(z * .23);
      for (let y = 0; y <= h; y++) {
        const t = Math.max(0, (y - 7) / Math.max(1, h - 7));
        const p = Math.round(z + (tipZ - z) * t);
        b.fixed.box(-1, y, p - 1, 2, y + 1, p + 2, column);
        if (y >= Math.round(h * .65)) {
          b.fixed.put(0, y, z, cap);
          if (y % 3 === 0) b.fixed.box(0, y, Math.min(p, z), 1, y + 1, Math.max(p, z) + 1, column);
        }
      }
      if (s === 1) b.fixed.box(-1, h, -tipZ - 1, 2, h + 2, tipZ + 1, cap);
      b.fixed.put(0, h + 2, tipZ, "#F4D297", .3);
    }
  }
}

export function drawBridgeLandmark(bay: BridgeBay): void {
  switch (bay.family) {
    case "suspension": suspend(bay, false); break;
    case "gothic": suspend(bay, true); break;
    case "arch": throughArch(bay); break;
    case "lift": lift(bay); break;
    case "fan": fan(bay); break;
  }
}
