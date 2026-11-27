// Original ironwork shops. The working tool sets the building's section, entrance and yard.
import { byLv, lot, person, speckle, type Ctx, type PixelVox } from "./kit";
import { disc, sculpt, spinner } from "./commerceKit";

const IRON = "#3b4857",
  FACE = "#9db2c2",
  EDGE = "#677f93",
  RUST = "#a95936";
const HOT = "#ff6630",
  CORE = "#ffcd69",
  OAK = "#815035",
  BRASS = "#dda853";

function coals(c: Ctx, x: number, z: number, y = 1) {
  const { v } = c;
  v.box(x - 2, y, z - 2, x + 2, y + 2, z + 2, "#713d33");
  for (let dx = -1; dx <= 0; dx++)
    for (let dz = -1; dz <= 0; dz++) {
      v.put(x + dx, y + 2, z + dz, dx === dz ? CORE : HOT, 0.9);
    }
  v.put(x, y + 3, z, HOT, 0.8);
  c.smoke(x, y + 4, z, "spark");
}

function trough(v: PixelVox, x: number, z: number, length: number) {
  v.hollowBox(x, 1, z, x + length, 4, z + 4, OAK);
  v.box(x + 1, 3, z + 1, x + length - 1, 4, z + 3, "#659ca5");
  for (const a of [x + 1, x + length - 2]) v.box(a, 1, z + 3, a + 1, 4, z + 4, IRON);
}

function hammer(v: PixelVox, x: number, z: number, y: number, width: number) {
  v.box(x, y, z, x + width, y + 2, z + 2, OAK);
  v.box(x + width - 3, y - 2, z - 1, x + width, y + 3, z + 3, IRON);
  v.box(x + width - 3, y - 3, z - 1, x + width, y - 2, z + 3, FACE);
}

function anvil(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const half = byLv(c, [5, 7, 11, 13, 18]),
    depth = byLv(c, [2, 3, 4, 6, 8]);
  const h = byLv(c, [5, 9, 12, 14, 18]),
    center = lv === 3 ? -3 : 0,
    z = lv >= 4 ? -3 : -1;
  // The narrow waist sweeps into four feet. The face ends in a conical forging horn.
  sculpt(v, center - half, 1, z - depth, center + half, h + 1, z + depth, (along, t, w) => {
    const u = 1 - along;
    const side = Math.abs(w - 0.5) * 2;
    if (t >= 0.72) {
      if (u < 0.39) {
        const taper = u / 0.39;
        if (side > taper || Math.abs(t - 0.87) > taper * 0.17) return null;
      } else if (u > 0.83 && t < 0.79) return null;
      if (u > 0.68 && u < 0.79 && side < 0.28) return null; // square hardy hole
      return t > 0.91 ? FACE : t > 0.81 ? EDGE : IRON;
    }
    const width = t < 0.17 ? 0.31 : 0.13 + 0.17 * Math.pow(Math.abs((t - 0.42) / 0.41), 1.6);
    if (Math.abs(u - 0.61) > width || side > 0.46 + 0.58 * Math.pow(Math.abs((t - 0.43) / 0.44), 1.5))
      return null;
    return t < 0.16 ? EDGE : IRON;
  });
  // An open lit workshop in the waist faces the street below the steel table.
  v.box(
    center,
    2,
    z + 1,
    center + Math.max(2, Math.floor(half * 0.37)),
    Math.max(4, Math.floor(h * 0.61)),
    z + 3,
    "#432929",
  );
  v.box(center, 2, z + 3, center + 2, Math.max(4, Math.floor(h * 0.47)), z + 4, HOT, 0.7);
  const billet = Math.max(2, Math.floor(half * 0.45));
  v.box(center - 1, h + 1, z, center + billet, h + 2, z + 1, HOT, 0.8);
  v.put(center + billet, h + 1, z, CORE, 0.8);
  if (lv >= 2) coals(c, -hx + 3, hz - 4);
  if (lv >= 3) {
    trough(v, hx - 7, 1, 6);
    person(v, hx - 4, 1, hz - 2, "#507775");
  }
  if (lv >= 4) {
    const top = h + 7;
    v.box(center + 5, 1, z - 4, center + 8, top + 2, z - 1, RUST);
    v.box(center - 3, top, z - 4, center + 8, top + 2, z - 1, EDGE);
    v.box(center - 3, h + 3, z - 4, center, top, z - 1, IRON);
    v.box(center - 4, h + 2, z - 5, center + 1, h + 4, z, FACE);
  }
  if (lv === 5) {
    const x0 = -hx + 2;
    v.box(x0, 1, -10, x0 + 4, 15, -6, "#954932");
    for (let y = 4; y < 16; y += 4) v.box(x0 - 1, y, -11, x0 + 5, y + 1, -5, IRON);
    coals(c, x0 + 3, -3);
    c.smoke(x0 + 2, 17, -8);
    for (let x = -12; x <= 12; x += 6) {
      v.box(x, 1, hz - 5, x + 1, 5, hz - 4, IRON);
      v.ringZ(x, 5, hz - 5, hz - 4, 2, 1, BRASS);
    }
  }
}

function kettle(c: Ctx, x: number, z: number, bottom: number, r: number, h: number) {
  const { v } = c;
  for (let i = 0; i < h; i++) {
    const rad = r * Math.sqrt(0.27 + (0.73 * (i + 0.5)) / h);
    disc(
      v,
      x,
      z,
      bottom + i,
      bottom + i + 1,
      rad,
      i === h - 1 ? BRASS : i === h - 3 || i === 2 ? IRON : RUST,
      Math.max(0, rad - 1.6),
    );
  }
  disc(v, x, z, bottom + h - 2, bottom + h - 1, r - 0.9, (a, _y, b) => [
    Math.abs(a - x + (b - z) * 0.28 + Math.sin((b - z) * 0.8) * 1.7) < 1.15 ? CORE : HOT,
    0.8,
  ]);
  const lip = bottom + h - 1;
  v.box(x - 2, lip - 1, z + r - 1, x + 2, lip, z + r + 2, HOT, 0.8);
  for (const dx of [-2, 1]) v.box(x + dx, lip, z + r - 1, x + dx + 1, lip + 1, z + r + 2, BRASS);
  v.box(x - 1, bottom, z + r + 1, x + 1, lip, z + r + 2, HOT, 0.7);
  c.smoke(x, lip + 1, z, "spark");
}

function crucible(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = byLv(c, [3, 4, 5, 7, 8]),
    z = lv >= 4 ? -4 : -2,
    x = lv >= 3 ? -5 : 0;
  const base = byLv(c, [2, 4, 7, 8, 11]),
    h = byLv(c, [4, 6, 8, 10, 12]);
  kettle(c, x, z, base, r, h);
  const axle = base + Math.floor(h * 0.6);
  for (const dx of [-r - 1, r]) {
    v.box(x + dx, 1, z - 2, x + dx + 1, axle + 2, z + 2, IRON);
    v.box(x + dx - 1, 1, z - 2, x + dx + 2, 3, z + 2, EDGE);
    v.put(x + dx, axle, z + 2, BRASS);
  }
  if (lv >= 2) {
    const end = hz - 2,
      lip = z + r + 1;
    v.box(x - 2, 1, lip, x + 2, 3, end, "#736260");
    v.box(x - 1, 2, lip, x + 1, 3, end, HOT, 0.7);
  }
  if (lv >= 3) {
    v.box(x, 1, hz - 4, hx - 3, 3, hz - 2, "#633c30");
    for (let a = 0; a < hx - 3; a += 4) {
      v.box(a, 2, hz - 5, a + 3, 3, hz - 1, IRON);
      v.box(a + 1, 2, hz - 4, a + 2, 3, hz - 2, CORE, 0.65);
    }
    person(v, hx - 4, 1, -2, "#697f86");
  }
  if (lv >= 4) {
    const x2 = hx - 7;
    disc(v, x2, -7, 1, 3, 5, IRON);
    kettle(c, x2, -7, 3, 4, 6);
    v.box(x2 - 2, 1, -hz + 1, x2 + 2, 15, -hz + 4, "#a4492c");
    v.box(x2 - 3, 14, -hz + 1, x2 + 3, 16, -hz + 4, IRON);
    c.smoke(x2, 16, -hz + 3);
  }
  if (lv === 5) {
    const tower = hx - 4,
      height = 27;
    v.box(tower - 2, 1, 2, tower + 1, height, 5, EDGE);
    for (let y = 3; y < height; y += 4) v.box(tower - 3, y, 1, tower + 2, y + 1, 6, IRON);
    v.box(tower - 13, height - 2, 2, tower + 1, height, 5, BRASS);
    v.box(tower - 12, 14, 3, tower - 11, height - 2, 4, IRON);
    kettle(c, tower - 12, 4, 8, 4, 6);
  }
}

function shoeArch(v: PixelVox, x: number, z: number, r: number, thick: number, finish: string) {
  const cy = Math.ceil(r * 0.62) + 1,
    inner = r - Math.max(2, Math.round(r * 0.33));
  for (let dx = -r; dx < r; dx++)
    for (let y = 1; y <= cy + r; y++) {
      const dy = y + 0.5 - cy,
        side = Math.abs(dx + 0.5);
      // Below the spring line the two heels flare out, leaving the aisle open.
      const distance = dy >= 0 ? Math.hypot(dx + 0.5, dy) : side + dy * 0.13;
      if (distance > r || distance < inner) continue;
      const edge = distance > r - 1 || distance < inner + 0.8;
      v.box(x + dx, y, z, x + dx + 1, y + 1, z + thick, edge ? EDGE : finish);
      if (y % 4 === 1 && Math.abs(distance - (r + inner) / 2) < 0.8)
        v.put(x + dx, y, z + thick - 1, BRASS, 0.35);
    }
  for (const a of [-r, r - 2]) v.box(x + a, 1, z - 1, x + a + 2, 3, z + thick + 1, FACE);
}

function farrier(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 5, 7, 9, 12]);
  const x = lv === 3 ? -5 : 0,
    front = lv >= 4 ? hz - 8 : 1;
  shoeArch(v, x, front, r, lv < 3 ? 2 : 3, "#574857");
  if (lv >= 2) {
    shoeArch(v, x, front - 5, r, 2, "#6c5863");
    for (const dx of [-r + 1, r - 2]) v.box(x + dx, 6, front - 4, x + dx + 1, 7, front + 1, BRASS);
  }
  coals(c, lv === 1 ? -4 : hx - 4, lv === 1 ? -2 : -hz + 4);
  if (lv >= 3) {
    trough(v, hx - 8, 2, 6);
    for (const a of [hx - 7, hx - 4]) {
      v.box(a, 1, -hz + 6, a + 1, 7, -hz + 7, OAK);
      v.ringZ(a, 6, -hz + 6, -hz + 7, 2.2, 1.1, FACE);
    }
  }
  if (lv >= 4) {
    shoeArch(v, x, front - 13, r - 2, 3, "#7a5960");
    for (const dx of [-r, r - 2])
      for (let z = front - 11; z < front; z += 3) {
        v.box(x + dx, 6, z, x + dx + 2, 7, z + 3, "#9a633c");
        v.box(x + dx, 7, z, x + dx + 1, 9, z + 1, BRASS);
      }
    person(v, 2, 1, front + 4, "#54756e");
  }
  if (lv === 5) {
    // The side arcade's arches face the cross street.
    for (const a of [-hx + 3, -hx + 10, hx - 12, hx - 5]) {
      for (let dz = -4; dz < 4; dz++)
        for (let y = 1; y <= 10; y++) {
          const d = Math.hypot(dz + 0.5, Math.max(0, y - 5));
          if (d < 2.4 || d > 4.4) continue;
          v.box(a, y, dz - 5, a + 3, y + 1, dz - 4, y === 1 ? EDGE : IRON);
        }
    }
    for (const a of [-hx + 4, hx - 6]) trough(v, a, 7, 4);
  }
}

function wheel(c: Ctx, x: number, z: number, r: number) {
  const cy = r + 2,
    { v } = c;
  v.ringZ(x, cy, z, z + 2, r, r - 1.3, "#815037");
  v.box(x - 1, 1, z - 2, x + 1, cy + 1, z, IRON);
  v.box(x - 1, cy - 1, z - 2, x + 1, cy + 1, z + 4, BRASS);
  const spin = spinner(c, x, cy, z + 1, "z", 0.47);
  for (let arm = 0; arm < 8; arm++) {
    const a = (arm * Math.PI) / 4;
    for (let j = 1; j <= r; j++) {
      const dx = Math.round(j * Math.cos(a)),
        dy = Math.round(j * Math.sin(a));
      spin.box(dx, dy, 0, dx + 1, dy + 1, j === r ? 3 : 1, j === r ? "#b57942" : "#ba935d");
    }
  }
}

function waterHammer(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = byLv(c, [3, 5, 6, 8, 10]),
    x = lv >= 3 ? -Math.floor(hx * 0.43) : -1,
    z = lv >= 4 ? 2 : 0;
  const race = x - r - 1,
    low = lv === 1 ? -3 : -hz + 1;
  v.box(race, 1, low, x + r + 2, 2, z + 5, "#775f4a");
  v.box(race + 1, 1, low, x + r + 1, 2, z + 4, "#35849a");
  for (let a = race + 2; a < x + r + 1; a += 4) v.put(a, 1, z + 3, "#a7dace");
  wheel(c, x, z, r);
  const start = lv >= 3 ? x + 2 : x - 1,
    width = lv >= 3 ? hx - start - 3 : 7,
    y = lv >= 3 ? r + 4 : lv + 3;
  v.box(start + 2, 1, z - 2, start + 4, y + 1, z + 1, OAK);
  hammer(v, start, z, y, width);
  v.put(start + 2, y - 1, z, "#ffd18a", 0.55);
  v.box(start + width - 3, 1, z - 1, start + width, 3, z + 3, EDGE);
  coals(c, hx - 4, -hz + 4);
  if (lv >= 3) {
    v.box(x - 1, r + 1, -hz + 3, x + 1, r + 3, z + 2, IRON);
    v.box(x - 2, 1, -hz + 2, x + 2, r + 2, -hz + 4, OAK);
    person(v, hx - 6, 1, hz - 3, "#476c88");
  }
  if (lv >= 4) {
    // A timber aqueduct drops water into the top quarter of the wheel.
    const top = r * 2;
    for (let a = -hz + 2; a < z - 1; a += 6) v.box(x - 2, 1, a, x + 2, top, a + 1, OAK);
    v.box(x - 3, top, -hz + 1, x + 3, top + 2, z - 1, "#714833");
    v.box(x - 2, top + 1, -hz + 1, x + 2, top + 2, z - 1, "#55b1b7");
    v.box(x - 2, r + 4, z - 1, x + 2, top + 2, z, "#8dd2d0");
    trough(v, hx - 10, hz - 6, 8);
  }
  if (lv === 5) {
    wheel(c, hx - 8, -4, 6);
    hammer(v, 2, -8, 10, 13);
    v.box(4, 1, -8, 6, 11, -6, OAK);
    for (let a = 3; a < hx - 2; a += 7) v.box(a, 1, -hz + 3, a + 2, 14, -hz + 1, OAK);
    for (let dz = 0; dz < 9; dz++)
      v.box(
        1,
        13 + Math.floor(dz / 3),
        -hz + 1 + dz,
        hx - 2,
        14 + Math.floor(dz / 3),
        -hz + 2 + dz,
        "#4a756f",
      );
  }
}

export function buildBlacksmith(c: Ctx): void {
  lot(c, ["#c5ad92", "#ae9b88", "#c0ab99", "#c0ba96"][c.variant % 4]);
  speckle(c, "#8e7866", 0.07);
  [anvil, crucible, farrier, waterHammer][c.variant % 4](c);
}
