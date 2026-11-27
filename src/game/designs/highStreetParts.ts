import { type Ctx, door, lot, person } from "./kit";

export function frontage(c: Ctx, floor: string) {
  lot(c, floor, 1);
  c.v.box(-c.hx + 1, 0, c.hz - 3, c.hx - 1, 1, c.hz, "concrete2");
}

export function counter(c: Ctx, x: number, z: number, width: number, color: string, y = 1) {
  const { v } = c;
  v.box(x, y, z, x + width, y + 2, z + 2, color);
  v.box(x, y + 2, z, x + width, y + 3, z + 2, "cream");
  v.put(x + width - 1, y + 3, z, "charcoal");
  person(v, x + 1, y, z - 1, "teal");
}

export function shopWindow(c: Ctx, x: number, y: number, z: number, width: number, trim: string) {
  c.v.box(x, y, z, x + width, y + 4, z + 1, trim);
  c.v.box(x + 1, y + 1, z, x + width - 1, y + 3, z + 1, "warmGlow", 0.55);
  for (let i = x + 3; i < x + width - 1; i += 4) c.v.box(i, y + 1, z, i + 1, y + 3, z + 1, trim);
  door(c.v, x + Math.floor(width / 2) - 1, y, z, "glassDark", 2, 3);
}
