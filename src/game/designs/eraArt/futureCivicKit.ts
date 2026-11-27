import { bench, person, type PixelVox } from "../kit";

export const pearl = "#d7e4d6",
  steel = "#4e6671",
  teal = "#6da99e",
  glass = "#8ecbd1",
  glow = "#96e6d9",
  night = "#384758",
  gold = "#cd9c6b";

export function slab(v: PixelVox, x: number, y: number, z: number, w: number, d: number, color = pearl) {
  v.box(x, y, z, x + w, y + 1, z + d, color);
}

export function arc(
  v: PixelVox,
  cx: number,
  cz: number,
  y: number,
  rx: number,
  rz: number,
  width: number,
  start: number,
  end: number,
  color: string,
) {
  const steps = Math.max(12, Math.ceil(Math.max(rx, rz) * (end - start) * 2));
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps,
      x = Math.round(cx + rx * Math.sin(a)),
      z = Math.round(cz + rz * Math.cos(a));
    v.box(x - width, y, z - width, x + width + 1, y + 1, z + width + 1, color);
  }
}

export function span(
  v: PixelVox,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  width: number,
  color: string,
) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t),
      z = Math.round(z0 + (z1 - z0) * t);
    v.box(x - width, y, z - width, x + width + 1, y + 1, z + width + 1, color);
  }
}

export function port(
  v: PixelVox,
  x: number,
  y: number,
  z: number,
  wide: number,
  deep: number,
  tall: number,
  finish = steel,
) {
  v.hollowBox(x, y, z, x + wide, y + tall, z + deep, finish);
  v.clear(x + 1, y + 1, z + deep - 2, x + wide - 1, y + tall - 1, z + deep);
  for (let xx = x + 1; xx < x + wide - 1; xx += 4)
    v.box(xx, y + 1, z + deep - 1, xx + 1, y + tall - 1, z + deep, glass, 0.32);
  for (let zz = z + 1; zz < z + deep - 1; zz += 3)
    v.box(x + wide - 1, y + 1, zz, x + wide, y + tall - 1, zz + 1, glass, 0.34);
  slab(v, x - 1, y + tall - 1, z - 1, wide + 2, deep + 2, pearl);
  v.put(x + wide - 2, y + tall - 2, z + deep - 1, glow, 0.75);
}

export function pod(v: PixelVox, x: number, y: number, z: number, r: number, tone = teal) {
  for (let xx = -r; xx <= r; xx++)
    for (let zz = -r; zz <= r; zz++) {
      const d = Math.hypot(xx, zz);
      if (d > r + 0.25) continue;
      v.put(x + xx, y, z + zz, steel);
      if (d < r - 1 || (zz > 0 && Math.abs(xx) < 2)) continue;
      v.put(x + xx, y + 1, z + zz, glass, 0.34);
      v.put(x + xx, y + 2, z + zz, tone);
      if (zz < 0 || Math.abs(xx) >= r - 1) v.put(x + xx, y + 3, z + zz, pearl);
    }
  // Open bookshelves frame the seat. The brighter horizontal rows read as stored data leaves.
  const back = z - r + 1;
  v.box(x - 1, y + 1, back, x + 2, y + 3, back + 1, steel);
  v.put(x - 1, y + 2, back + 1, "#c5886d");
  v.put(x, y + 2, back + 1, glow, 0.38);
  v.put(x + 1, y + 2, back + 1, "#8991be");
  bench(v, x - 1, y + 1, z, "x", "woodLight");
  person(v, x, y + 1, z + 1, "#bb765f");
}

export function publicWalk(v: PixelVox, x: number, z: number, end: number, width = 3) {
  v.box(x - Math.floor(width / 2), 0, z, x + Math.ceil(width / 2), 1, end, "path");
}

export function planter(v: PixelVox, x: number, y: number, z: number) {
  v.box(x - 1, y, z - 1, x + 2, y + 1, z + 2, steel);
  v.box(x - 1, y + 1, z - 1, x + 2, y + 2, z + 2, "leafDark");
  v.put(x, y + 2, z, "leaf");
  v.put(x - 1, y + 2, z - 1, "#98b981");
  v.put(x + 1, y + 2, z, "#7da789");
}
