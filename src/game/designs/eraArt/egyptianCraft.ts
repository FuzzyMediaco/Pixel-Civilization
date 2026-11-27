// Small shared furnishings of the Egyptian civic quarter. Buildings choose their own plan and skyline.
import { lot, person, type Ctx, type PixelVox } from "../kit";

export const sand = "#e2c48c",
  limestone = "#eac997",
  ivory = "#f8e2b0",
  reed = "#ceaa64";
export const mud = "#aa7350",
  brick = "#bc8258",
  red = "#a95539",
  cedar = "#755139";
export const faience = "#347e7a",
  lapis = "#364e70",
  gold = "#ddb051",
  water = "#54a5a0";
const skin = "#ae714c";

export function approach(c: Ctx, width: number) {
  lot(c, sand, 1);
  c.v.box(-width, 0, 0, width + 1, 1, c.hz, limestone);
  for (let z = 3; z < c.hz; z += 5) c.v.box(-width, 0, z, width + 1, 1, z + 1, "#d0b078");
}
export function attendant(v: PixelVox, x: number, y: number, z: number, active: boolean, sash = faience) {
  person(v, x, y, z, active ? sash : ivory, ivory, skin);
  v.put(x, y + 3, z, cedar);
}
export function oil(v: PixelVox, x: number, y: number, z: number, active: boolean) {
  v.put(x, y, z, red);
  v.put(x, y + 1, z, "#ffe3a0", active ? 0.8 : 0.52);
}
export function desk(v: PixelVox, x: number, y: number, z: number, active: boolean) {
  v.box(x - 2, y, z - 1, x - 1, y + 2, z + 1, cedar);
  v.box(x + 1, y, z - 1, x + 2, y + 2, z + 1, cedar);
  v.box(x - 2, y + 2, z - 1, x + 2, y + 3, z + 1, ivory);
  v.put(x, y + 3, z - 1, lapis);
  if (active) v.put(x + 1, y + 3, z, red);
}
export function bundle(v: PixelVox, x: number, y: number, z: number, top: number) {
  v.box(x - 1, y, z - 1, x + 1, y + 1, z + 1, limestone);
  v.box(x, y + 1, z, x + 1, top, z + 1, reed);
  v.box(x - 1, top - 2, z, x + 2, top - 1, z + 1, faience);
  v.box(x - 1, top - 1, z - 1, x + 2, top, z + 2, gold);
}
// Linen droops between supports and folds uphill at the selvages.
export function linen(v: PixelVox, x: number, z: number, X: number, Z: number, y: number, dye = faience, base = 1) {
  for (const px of [x + 1, X - 2]) for (const pz of [z + 1, Z - 2]) v.box(px, base, pz, px + 1, y + 1, pz + 1, cedar);
  for (let px = x; px < X; px++) {
    const sag = Math.floor(2 * Math.sin((Math.PI * (px - x)) / Math.max(1, X - x - 1)));
    v.box(px, y - sag, z, px + 1, y - sag + 1, Z, (px - x) % 7 < 2 ? dye : ivory);
  }
}
export function banner(v: PixelVox, x: number, y: number, z: number, h: number, dye = red) {
  v.box(x, y, z, x + 1, y + h, z + 1, cedar);
  v.box(x + 1, y + h - 3, z, x + 3, y + h, z + 1, dye);
  v.put(x + 3, y + h - 2, z, gold);
}
export function papyrus(v: PixelVox, x: number, z: number, h: number) {
  v.box(x, 1, z, x + 1, h, z + 1, "#798959");
  for (let i = -2; i <= 2; i++) {
    v.put(x + i, h - Math.abs(i), z, "#83995d");
    v.put(x, h - Math.abs(i), z + i, "#6e8b5a");
  }
}
export function strut(v: PixelVox, a: [number, number, number], b: [number, number, number], col: string, width = 1) {
  const n = Math.max(1, ...a.map((v, i) => Math.abs(v - b[i])));
  for (let i = 0; i <= n; i++) {
    const [x, y, z] = a.map((v, k) => Math.round(v + ((b[k] - v) * i) / n));
    v.box(x, y, z, x + width, y + 1, z + 1, col);
  }
}
