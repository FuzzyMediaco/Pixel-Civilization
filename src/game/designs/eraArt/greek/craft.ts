import type { Ctx } from "../../kit";

export const marble = "#f1dfb9",
  limestone = "#cfb995",
  stone = "#9c8974";
export const sea = "#27677a",
  sky = "#669da5",
  vermilion = "#a94734",
  clay = "#cd7650";
export const bronze = "#9e7443",
  gilt = "#e8b45c",
  ink = "#393530",
  papyrus = "#f4ce8a";
export const wood = "#745139",
  olive = "#74915c",
  silver = "#a4b27e";

export function beam(c: Ctx, x: number, y: number, z: number, u: number, h: number, w: number, col: string) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(u - x), Math.abs(h - y), Math.abs(w - z))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    c.v.put(x + (u - x) * t, y + (h - y) * t, z + (w - z) * t, col);
  }
}

export function column(c: Ctx, x: number, y: number, z: number, h: number, wide = false) {
  const v = c.v,
    r = wide ? 1.45 : 0.72;
  v.cylinderY(x + 0.5, z + 0.5, y, y + 1, r + 0.7, limestone);
  v.cylinderY(x + 0.5, z + 0.5, y + 1, y + h - 1, r, marble);
  v.cylinderY(x + 0.5, z + 0.5, y + h - 1, y + h, r + 0.7, limestone);
  v.put(x, y + h - 1, z + 1, sea);
}

export function oilLamp(c: Ctx, x: number, y: number, z: number) {
  c.v.put(x, y, z, bronze);
  c.v.put(x, y + 1, z, "#ffd67c", 1.1);
}

export function resident(c: Ctx, x: number, y: number, z: number, robe = sea) {
  c.v
    .put(x, y, z, marble)
    .put(x, y + 1, z, robe)
    .put(x, y + 2, z, "#c58e68");
}

export function oliveTree(c: Ctx, x: number, y: number, z: number, spread: number) {
  const v = c.v,
    h = Math.round(spread * 1.3);
  beam(c, x, y, z, x - 1, y + h, z, wood);
  for (const [dx, dz, dh, leaves] of [
    [0.7, -0.4, 0.4, olive],
    [-0.55, 0.25, 0.65, silver],
    [0.25, 0.6, 0.95, olive],
  ] as const) {
    const bx = x + Math.round(dx * spread),
      bz = z + Math.round(dz * spread),
      by = y + h + Math.round(spread * dh);
    beam(c, x - 1, y + h - 1, z, bx, by, bz, wood);
    v.sphere(bx + 0.5, by + 1, bz + 0.5, spread * 0.66, Math.max(1, spread * 0.39), spread * 0.66, leaves);
    v.put(bx, by + 1, bz, silver);
  }
}

export function scrollRack(c: Ctx, x: number, y: number, z: number, width: number) {
  const v = c.v;
  v.box(x, y, z, x + width, y + 3, z + 1, wood);
  for (let i = 0; i < width; i += 2) {
    v.put(x + i, y + 1, z + 1, papyrus);
    v.put(x + i, y + 2, z + 1, (i / 2) % 3 ? marble : clay);
  }
  v.box(x, y, z + 1, x + width, y + 1, z + 2, bronze);
}

/** A two-colour painted stoa carried by real open bays; its ridge follows the gallery. */
export function stoa(
  c: Ctx,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  base: number,
  h: number,
  alongZ = false,
  tile = clay,
) {
  const v = c.v,
    a = alongZ ? z0 : x0,
    b = alongZ ? z1 : x1,
    near = alongZ ? x0 : z0,
    far = alongZ ? x1 : z1;
  v.box(x0, base - 1, z0, x1, base, z1, limestone);
  for (const t of [
    ...new Set([
      a + 1,
      b - 2,
      ...Array.from({ length: Math.max(0, Math.floor((b - a - 4) / 5)) }, (_, i) => a + 6 + 5 * i),
    ]),
  ]) {
    for (const u of [near + 1, far - 2]) column(c, alongZ ? u : t, base, alongZ ? t : u, h);
  }
  v.box(x0, base + h, z0, x1, base + h + 1, z1, sea);
  for (let u = near; u < far; u++) {
    const y = base + h + 1 + Math.floor(Math.min(u - near, far - 1 - u) / 2);
    if (alongZ) v.box(u, y, z0, u + 1, y + 1, z1, tile);
    else v.box(x0, y, u, x1, y + 1, u + 1, tile);
    for (let t = a + 1; t < b; t += 4) v.put(alongZ ? u : t, y, alongZ ? t : u, vermilion);
  }
  oilLamp(c, x1 - 2, base + 1, z1 - 2);
}

/** Concentric stepped tiers. Omitting the front sector opens an approach to the middle. */
export function tiers(c: Ctx, x: number, z: number, radius: number, rows: number, base = 1, opening = 0.48, depth = 1) {
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++) {
      const r = Math.hypot(dx, dz / depth),
        ring = Math.floor((radius - r) / 2);
      if (r > radius || ring < 0 || ring >= rows || (dz > 0 && Math.abs(dx) < dz * opening)) continue;
      const y = base + rows - 1 - ring;
      c.v.box(x + dx, base, z + dz, x + dx + 1, y + 1, z + dz + 1, limestone);
      c.v.put(x + dx, y, z + dz, Math.floor(radius - r) % 2 ? marble : stone);
    }
}

export function signsOfArrival(c: Ctx, x: number, z: number) {
  oilLamp(c, x - 1, 1, z);
  resident(c, x + 1, 1, z - 1);
  c.v.box(x, 0, z, x + 2, 1, c.hz - 1, limestone);
}
