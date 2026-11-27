import { bench, person, type PixelVox } from "../kit";

export const iron = "#3f4948",
  steel = "#748a83",
  rust = "#a2684e",
  copper = "#be8566",
  tin = "#b5c1ab",
  cream = "#dfc89c",
  wood = "#977152",
  linen = "#d5b37f",
  sage = "#91ae80",
  canvas = "#62908b",
  lamp = "#f5c482";
export function board(v: PixelVox, x: number, y: number, z: number, w: number, d: number, color = wood) {
  v.box(x, y, z, x + w, y + 1, z + d, color);
}
export function timber(
  v: PixelVox,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  col = iron,
  width = 0,
) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t),
      z = Math.round(z0 + (z1 - z0) * t);
    v.box(x - width, y, z - width, x + width + 1, y + 1, z + width + 1, col);
  }
}
export function walk(v: PixelVox, x: number, z: number, end: number, w = 3) {
  v.box(x - Math.floor(w / 2), 0, z, x + Math.ceil(w / 2), 1, end, "path");
  for (let zz = z; zz < end; zz += 4) v.put(x, 0, zz, cream);
}
export function shell(
  v: PixelVox,
  x: number,
  z: number,
  base: number,
  rx: number,
  rz: number,
  height: number,
  lo: number,
  hi: number,
  color = steel,
) {
  const n = Math.ceil((hi - lo) * Math.max(rx, rz) * 2);
  for (let i = 0; i <= n; i++) {
    const t = lo + ((hi - lo) * i) / n,
      xx = x + Math.round(rx * Math.sin(t)),
      zz = z + Math.round(rz * Math.cos(t));
    for (let j = 0; j < height; j++) {
      const seam = j === 0 || j === height - 1;
      const patch = Math.floor(i / Math.max(5, Math.round(n / 7))) % 5 === 1 && j > 1;
      v.put(xx, base + j, zz, seam ? iron : patch ? copper : color);
    }
    if (i % Math.max(5, Math.floor(n / 8)) === 0) {
      v.put(xx, base + 1, zz, tin);
      v.put(xx, base + height - 2, zz, tin);
    }
  }
}
export function rack(v: PixelVox, x: number, y: number, z: number, w: number, tiers = 2) {
  const spines = [canvas, "#bf7157", "#d8b66b", "#79899d", "#8c6274", sage];
  for (let it = 0; it < tiers; it++) {
    const yy = y + it * 2;
    board(v, x, yy, z, w, 2, wood);
    for (let i = 0; i < w; i++) v.put(x + i, yy + 1, z + 1, spines[(i + it * 2) % spines.length]);
  }
  v.box(x, y, z, x + 1, y + 2 * tiers, z + 1, iron);
}
export function garden(v: PixelVox, x: number, y: number, z: number, w: number, d: number) {
  board(v, x, y, z, w, d, wood);
  for (let xx = 1; xx < w - 1; xx++)
    for (let zz = 1; zz < d - 1; zz++) {
      v.put(x + xx, y + 1, z + zz, (zz + xx) % 3 === 0 ? "leafDark" : sage);
      if ((xx + zz * 2) % 4 === 0) v.put(x + xx, y + 2, z + zz, zz % 2 ? "#e9b77d" : "leaf");
    }
}
export function cabin(v: PixelVox, x: number, y: number, z: number, w: number, d: number, h: number, roof = canvas) {
  v.hollowBox(x, y, z, x + w, y + h, z + d, wood);
  v.clear(x + 1, y + 1, z + d - 2, x + w - 1, y + h, z + d);
  for (let i = 0; i < w; i++) {
    const yy = y + h - Math.floor(i / Math.max(4, Math.ceil(w / 2)));
    v.box(x + i, yy, z - 1, x + i + 1, yy + 1, z + d + 1, i % 5 === 1 ? tin : roof);
  }
  v.box(x, y, z + d - 1, x + 1, y + h + 1, z + d, iron);
  v.box(x + w - 1, y, z + d - 1, x + w, y + h - 1, z + d, iron);
  v.box(x + 1, y + 1, z + d - 1, x + w - 2, y + 2, z + d, cream);
  v.put(x + w - 2, y + h - 2, z + d - 1, lamp, 0.6);
}
export function frame(v: PixelVox, cx: number, y: number, z: number, r: number, rise: number, col = steel) {
  timber(v, cx - r, y, z, cx, y + rise, z, col);
  timber(v, cx, y + rise, z, cx + r, y, z, col);
  timber(v, cx - r, y, z, cx + r, y, z, wood);
  timber(v, cx, y, z, cx, y + rise, z, iron);
}
export function resident(v: PixelVox, x: number, y: number, z: number, coat = canvas) {
  person(v, x, y, z, coat, iron, "#bb8462");
}
export function readingSeat(v: PixelVox, x: number, y: number, z: number) {
  bench(v, x - 1, y, z, "x", cream);
  resident(v, x, y + 1, z, canvas);
  v.put(x + 1, y + 2, z + 1, linen);
}
