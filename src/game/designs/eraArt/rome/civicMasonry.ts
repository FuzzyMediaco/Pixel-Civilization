import { bench, person, type Ctx } from "../../kit";
import type { Ink } from "../../periodArtCatalog";

export const brick = "#a95942",
  tile = "#cc7051",
  marble = "#efddbb",
  parchment = "#efca80",
  bronze = "#956b3c",
  water = "#5aaea5",
  shade = "#68463d";

/** Slabs end at the curb; the surrounding town's ground shows through at the corners. */
export function court(
  c: Ctx,
  p: Ink,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y = 0,
) {
  c.v.box(x0, y, z0, x1, y + 1, z1, p.floor);
  for (let z = z0; z < z1; z += 4)
    for (let x = x0 + ((z - z0) % 3); x < x1; x += 6)
      c.v.put(x, y, z, "#cdbda7");
}
export function rounds(
  c: Ctx,
  x: number,
  y: number,
  z: number,
  r: number,
  top: number,
  color: string,
  wall = 0,
) {
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) {
      const d = i * i + j * j;
      if (d <= r * r && (!wall || d > (r - wall) * (r - wall)))
        c.v.box(x + i, y, z + j, x + i + 1, top, z + j + 1, color);
    }
}
/** A true shell opening at each end. Brick ribs alternate with broad unbroken tile surfaces. */
export function barrel(
  c: Ctx,
  p: Ink,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  spring: number,
  axis: "x" | "z" = "z",
  lift = 1,
) {
  const [a, b, n, m] = axis === "z" ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const center = (a + b - 1) / 2,
    r = (b - a) / 2;
  for (let i = a; i < b; i++) {
    const rise = Math.sqrt(Math.max(0, 1 - ((i - center) / r) ** 2));
    const h = Math.floor(spring + r * rise * lift);
    for (let j = n; j < m; j++) {
      const x = axis === "z" ? i : j,
        z = axis === "z" ? j : i;
      if (i === a || i === b - 1) {
        if (j === n || j === m - 1 || (j - n) % 5 === 0)
          c.v.box(x, y, z, x + 1, h + 1, z + 1, p.wall);
      }
      const rib = j === n || j === m - 1 || (j - n) % 6 === 0;
      c.v.box(x, h - 1, z, x + 1, h + 1, z + 1, rib ? p.rim : p.roof);
      if (rib && (i === a || i === b - 1)) c.v.put(x, h, z, tile);
    }
  }
}
export function pier(
  c: Ctx,
  p: Ink,
  x: number,
  y: number,
  z: number,
  top: number,
  width = 1,
) {
  c.v.box(x, y, z, x + width, top, z + width, p.wall);
  c.v.box(x - 1, top - 1, z - 1, x + width + 1, top, z + width + 1, p.rim);
  c.v.box(x, y, z, x + width, y + 1, z + width, marble);
}
export function pergola(
  c: Ctx,
  p: Ink,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  top: number,
  roof = true,
) {
  for (const z of [z0, z1 - 1])
    for (let x = x0; x < x1; x += Math.max(3, Math.floor((x1 - x0 - 1) / 3)))
      pier(c, p, x, y, z, top);
  c.v.box(x0 - 1, top, z0 - 1, x1 + 1, top + 1, z0 + 1, p.rim);
  c.v.box(x0 - 1, top, z1 - 2, x1 + 1, top + 1, z1, p.rim);
  if (roof)
    c.v.roofGable(
      x0 - 1,
      top + 1,
      z0 - 1,
      x1 + 1,
      z1 + 1,
      Math.ceil((z1 - z0 + 2) / 2),
      "x",
      p.roof,
      tile,
    );
}
export function steps(
  c: Ctx,
  p: Ink,
  x0: number,
  x1: number,
  z: number,
  y: number,
  n: number,
  depth = 1,
) {
  for (let i = 0; i < n; i++)
    c.v.box(
      x0,
      y,
      z + i * depth,
      x1,
      y + n - i,
      z + (i + 1) * depth,
      i === n - 1 ? marble : p.rim,
    );
}
export function reader(
  c: Ctx,
  x: number,
  y: number,
  z: number,
  shirt = marble,
) {
  person(c.v, x, y, z, shirt, "#9e765a", "#b67f60");
}
export function scrollRack(
  c: Ctx,
  p: Ink,
  x: number,
  y: number,
  z: number,
  width: number,
) {
  c.v.box(x, y, z, x + width, y + 4, z + 1, shade);
  for (let h = 0; h < 4; h += 2)
    for (let u = 0; u < width; u += 2)
      c.v.put(x + u, y + h + 1, z + 1, parchment, 0.24);
  c.v.box(x, y, z + 1, x + width, y + 1, z + 2, p.frame);
}
export function seat(c: Ctx, x: number, y: number, z: number) {
  bench(c.v, x, y, z, "x", "#b99069");
}
export function torch(c: Ctx, x: number, y: number, z: number) {
  c.v.box(x, y, z, x + 1, y + 3, z + 1, bronze);
  c.v.put(x, y + 3, z, "warmGlow", 0.85);
}
export function horse(c: Ctx, x: number, y: number, z: number, coat: string) {
  const v = c.v;
  for (const dx of [-1, 1])
    for (const dz of [-2, 1])
      v.box(x + dx, y, z + dz, x + dx + 1, y + 2, z + dz + 1, shade);
  v.box(x - 1, y + 2, z - 2, x + 2, y + 4, z + 2, coat);
  v.box(x - 1, y + 3, z + 1, x + 1, y + 6, z + 3, coat);
  v.box(x - 1, y + 4, z + 2, x + 1, y + 5, z + 4, coat);
  v.put(x, y + 3, z - 2, "#584038");
  v.box(x - 1, y + 4, z - 1, x + 2, y + 5, z + 1, "#917544");
}
export function parcel(c: Ctx, x: number, y: number, z: number) {
  c.v.box(x, y, z, x + 2, y + 2, z + 2, parchment);
  c.v.box(x, y + 1, z, x + 1, y + 2, z + 2, bronze);
}
export function banner(
  c: Ctx,
  p: Ink,
  x: number,
  y: number,
  z: number,
  h: number,
) {
  c.v.box(x, y, z, x + 1, y + h, z + 1, bronze);
  c.v.box(x + 1, y + h - 4, z, x + 4, y + h - 1, z + 1, p.cloth);
  c.v.put(x + 2, y + h - 3, z, parchment);
}
