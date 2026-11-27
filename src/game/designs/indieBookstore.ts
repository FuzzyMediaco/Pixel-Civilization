// Four ways to sell books: crooked bay shops, a spiral of book bins, treehouse decks and a walk-in bookcase.
import { type Ctx, type PixelVox, awning, byLv, door, gable, lot, pave, person } from "./kit";
import { bulbs, disc, glassFront, neon } from "./commerceKit";

const covers = ["#7e2949", "#3d827f", "#cc9942", "#55709a", "#ad5f42", "#738049"];
const timber = "#684434",
  shelf = "#bd8051",
  paper = "#f3dbb5",
  green = "#376454";
function bookRow(v: PixelVox, x: number, y: number, z: number, n: number, seed = 0) {
  for (let i = 0; i < n; i++) {
    const h = 2 + ((i + seed) % 3);
    const color = covers[(i + seed) % covers.length];
    v.box(x + i, y, z, x + i + 1, y + h, z + 2, color);
    if ((i + seed) % 3 === 0) v.put(x + i, y + 1, z + 2, paper);
  }
}
function bookCart(v: PixelVox, x: number, z: number) {
  v.put(x - 2, 1, z + 1, "iron");
  v.put(x + 2, 1, z + 1, "iron");
  v.box(x - 3, 2, z - 1, x + 3, 3, z + 2, shelf);
  bookRow(v, x - 2, 3, z - 1, 5);
  v.box(x + 2, 3, z + 1, x + 3, 6, z + 2, timber);
  v.put(x + 2, 5, z + 2, paper);
}
function counter(v: PixelVox, x: number, y: number, z: number) {
  v.box(x - 2, y, z, x + 2, y + 2, z + 2, green);
  v.box(x - 2, y + 2, z, x + 3, y + 3, z + 2, paper);
  v.box(x, y + 3, z, x + 2, y + 4, z + 1, "charcoal");
  v.put(x + 1, y + 4, z, "screenCyan", 0.4);
}
function crookedBay(
  c: Ctx,
  x: number,
  z: number,
  y: number,
  w: number,
  d: number,
  height: number,
  tint: string,
) {
  const v = c.v,
    back = z - d,
    left = x - Math.floor(w / 2),
    right = left + w;
  v.hollowBox(left, y, back, right, y + height, z, tint, timber);
  const bayX = left + 1,
    bayW = Math.min(7, w - 3);
  v.hollowBox(bayX, y + 1, z - 1, bayX + bayW, y + 5, z + 2, green);
  glassFront(v, bayX + 1, bayX + bayW - 1, y + 2, y + 4, z + 1, timber, 3, "#f0c28a");
  v.box(bayX - 1, y + 4, z - 1, bayX + bayW + 1, y + 5, z + 2, green);
  if (height > 7) {
    for (let cx = left + 2; cx < right - 1; cx += 4) {
      v.box(cx, y + height - 5, z - 1, cx + 2, y + height - 2, z, "warmGlow", 0.5);
      v.put(cx, y + height - 3, z, timber);
    }
  }
  // Projecting side window displays sale books to customers coming around the corner.
  for (let zz = back + 2; zz < z - 2; zz += 3) {
    v.box(right - 1, y + 2, zz, right + 1, y + 5, zz + 2, "#d9ac73");
    v.put(right + 1, y + 2, zz, covers[(zz - back) % covers.length]);
    v.put(right + 1, y + 4, zz + 1, timber);
    v.box(right - 1, y + 5, zz, right + 1, y + 6, zz + 2, green);
  }
  return gable(v, left - 1, y + height, back - 1, right + 1, z + 1, "z", "#4a5a56", timber);
}
function crookedShop(c: Ctx) {
  const { v, lv } = c;
  if (lv === 1) {
    bookCart(v, -1, 2);
    for (const x of [-5, 4]) v.box(x, 1, -3, x + 1, 8, -2, timber);
    gable(v, -6, 7, -5, 6, 3, "x", "#597965");
    counter(v, 3, 1, -1);
    return;
  }
  const x = lv === 2 ? 0 : -6,
    z = lv < 4 ? 1 : 3;
  crookedBay(c, x, z, 1, lv === 2 ? 10 : 14, lv < 4 ? 7 : 13, lv < 4 ? 7 : 11, "#c58b67");
  door(v, x + 2, 1, z - 1, green, 2, 4);
  if (lv >= 3) {
    crookedBay(c, 7, z - 2, 1, 9, lv < 4 ? 6 : 11, lv === 5 ? 16 : 9, "#e6c89b");
    bookCart(v, 7, z + 3);
  } else bookCart(v, -3, 5);
  if (lv >= 4) {
    crookedBay(c, -4, -2, 11, 9, 9, 6, "#e5bf90");
    v.box(-10, 10, 3, 0, 11, 7, green);
    v.box(-10, 12, 6, 0, 13, 7, timber);
    for (const p of [-10, -6, -1]) v.box(p, 11, 6, p + 1, 13, 7, timber);
    person(v, -4, 11, 5, "purple");
    bookRow(v, -9, 11, 5, 3);
  }
  if (lv === 5) {
    crookedBay(c, -8, 11, 1, 8, 7, 8, "#cfa371");
    v.box(-12, 7, 10, -2, 8, 14, green);
    bulbs(v, -7, 10, 7, 4, 12);
    counter(v, 2, 1, 9);
    neon(v, "USED", -13, 14, 3, paper, { emit: 0.55, back: green });
  }
}
function spiralMarket(c: Ctx) {
  const { v, lv } = c;
  const x = lv < 3 ? 0 : -3,
    z = lv < 4 ? -1 : -3,
    extent = byLv(c, [3, 5, 5, 8, 9]),
    steps = byLv(c, [4, 7, 10, 12, 17]);
  const lift = lv === 1 ? 1 : 2;
  disc(v, x, z, 1, 3, extent + 2, timber);
  disc(v, x, z, 1, 4 + steps * lift, lv < 3 ? 1.4 : 2.5, green);
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI) / 3;
    const bx = x + Math.round(Math.sin(a) * extent),
      bz = z + Math.round(Math.cos(a) * extent),
      y = 2 + i * lift;
    const w = lv < 3 ? 3 : 4;
    // Each stall rides the end of a giant hardback. Six different bindings wind around the stockroom.
    for (let radial = 0; radial < extent; radial++) {
      for (let lane = -2; lane <= 2; lane++) {
        const rx = Math.round(x + radial * Math.sin(a) + lane * Math.cos(a));
        const rz = Math.round(z + radial * Math.cos(a) - lane * Math.sin(a));
        v.box(rx, y - 1, rz, rx + 2, y, rz + 2, covers[i % covers.length]);
        v.box(rx, y, rz, rx + 2, y + 1, rz + 2, lane === -2 ? covers[i % covers.length] : paper);
      }
    }
    v.box(bx - w, y, bz - 2, bx + w, y + 1, bz + 2, shelf);
    v.box(bx - w, y + 1, bz - 2, bx + w, y + 2, bz - 1, timber);
    bookRow(v, bx - w + 1, y + 1, bz - 1, 2 * w - 2, i);
  }
  if (lv >= 3) {
    counter(v, 9, 1, 2);
    awning(v, 5, 14, 6, 0, "#b85b48", paper);
    v.box(5, 1, -1, 6, 7, 0, timber);
    v.box(13, 1, -1, 14, 7, 0, timber);
  }
  if (lv >= 4) {
    bookCart(v, -8, 10);
    bulbs(v, -11, 2, 4, 10, 8);
    person(v, -7, 1, 7, "red");
  }
  if (lv === 5) {
    const roof = 3 + steps * lift;
    disc(v, x, z, roof, roof + 1, 4.5, shelf);
    v.box(x - 1, roof + 1, z - 1, x + 1, roof + 8, z + 1, timber);
    v.box(x + 1, roof + 6, z - 1, x + 7, roof + 8, z + 1, "#b74f4e");
    person(v, x - 2, roof + 1, z + 1, green);
    v.box(6, 1, 7, 13, 6, 12, green);
    bookRow(v, 7, 3, 12, 5, 2);
  }
}
function branch(v: PixelVox, x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  for (let i = 0; i <= dy; i++) {
    const bx = x + Math.round((dx * i) / dy),
      bz = z + Math.round((dz * i) / dy);
    v.box(bx - 1, y + i, bz - 1, bx + 2, y + i + 1, bz + 2, timber);
  }
}
function treePlatform(c: Ctx, x: number, z: number, y: number, r: number, withRoom: boolean) {
  const { v } = c;
  disc(v, x, z, y, y + 1, r, shelf);
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    const px = x + Math.round((r - 1) * Math.sin(a)),
      pz = z + Math.round((r - 1) * Math.cos(a));
    v.put(px, y + 1, pz, timber);
  }
  bookRow(v, x - r + 1, y + 1, z - 1, Math.max(2, r), 1);
  if (withRoom) {
    v.hollowBox(x - r + 1, y + 1, z - r + 1, x + r - 1, y + 6, z + 1, "#cfa579", timber);
    glassFront(v, x - r + 2, x + r - 2, y + 2, y + 5, z, green, 3);
    gable(v, x - r, y + 6, z - r, x + r, z + 2, "z", "#9b5142");
  }
}
function treeShop(c: Ctx) {
  const { v, lv } = c;
  const x = lv < 3 ? 0 : -4,
    z = lv < 4 ? -1 : -3,
    h = byLv(c, [6, 13, 15, 18, 21]),
    r = lv < 3 ? 3 : 5;
  v.box(x - 1, 1, z - 1, x + 2, h + 1, z + 2, timber);
  branch(v, x, h - 4, z, -3, 5, -1);
  branch(v, x, h - 5, z, 4, 5, 0);
  for (const [dx, dy, dz, tint] of [
    [-3, 1, -1, "#477859"],
    [1, 3, -2, "#578e60"],
    [4, 0, 1, "#729858"],
  ] as const)
    v.sphere(x + dx, h + dy, z + dz, r, r * 0.65, r, tint);
  treePlatform(c, x, z, lv === 1 ? 1 : 6, r + 1, lv >= 4);
  if (lv >= 2) {
    for (let j = 0; j < 6; j++) v.box(x + 2, 1 + j, z + 6 - j, x + 5, 2 + j, z + 7 - j, shelf);
    counter(v, x - 3, 1, z + 3);
  }
  if (lv >= 3) {
    branch(v, x, 3, z, 9, 8, 0);
    treePlatform(c, x + 9, z, 11, 4, false);
    person(v, x + 10, 12, z + 1, "indigo");
  }
  if (lv >= 4) {
    bookCart(v, -7, 10);
    person(v, 1, 1, 9, "copper");
  }
  if (lv === 5) {
    const tx = 9,
      tz = -9;
    v.box(tx - 1, 1, tz - 1, tx + 2, 18, tz + 2, timber);
    branch(v, tx, 14, tz, 4, 5, 1);
    v.sphere(tx, 21, tz, 6, 3.2, 5, "#719a64");
    treePlatform(c, tx, tz, 14, 5, true);
    treePlatform(c, x, z, 14, 3, false);
    for (let i = 0; i <= 9; i++) {
      const xx = x + i + 2,
        zz = z - Math.round(i * 0.55),
        yy = 14 - Math.round(Math.sin((i / 9) * Math.PI) * 2);
      v.box(xx, yy, zz - 1, xx + 2, yy + 1, zz + 2, shelf);
      v.put(xx, yy + 2, zz + 2, "brass");
    }
  }
}
function bookcase(
  v: PixelVox,
  x: number,
  z: number,
  y: number,
  width: number,
  rows: number,
  step: number,
  alongZ = false,
) {
  const panel = (a: number, b: number, c: number, d: number, e: number, f: number, tint: string) =>
    alongZ
      ? v.box(x + c, y + b, z + a, x + f, y + e, z + d, tint)
      : v.box(x + a, y + b, z + c, x + d, y + e, z + f, tint);
  panel(0, 0, -2, width, rows * step + 1, 0, timber);
  for (const side of [0, width - 1]) panel(side, 0, -2, side + 1, rows * step + 1, 2, shelf);
  for (let j = 0; j < rows; j++) {
    const yy = j * step;
    panel(0, yy, -2, width, yy + 1, 2, shelf);
    for (let s = 1; s < width - 2; s += 2) {
      const h = step - 1 - ((s + j) % 2);
      panel(s, yy + 1, 0, s + 2, yy + 1 + h, 1, covers[(s + j) % covers.length]);
      if ((s + j) % 3 === 0) panel(s, yy + 2, 1, s + 1, yy + 3, 2, paper);
    }
  }
  panel(-1, rows * step, -2, width + 1, rows * step + 1, 3, shelf);
}
function shelfShop(c: Ctx) {
  const { v, lv } = c;
  const left = lv < 3 ? -5 : -12,
    rear = lv < 4 ? -3 : -9,
    w = lv < 3 ? 9 : 22,
    rows = byLv(c, [1, 2, 3, 3, 4]);
  bookcase(v, left, rear, 1, w, rows, lv === 1 ? 4 : 5);
  if (lv <= 2) {
    counter(v, 1, 1, 3);
    if (lv === 1) bookCart(v, -3, 0);
    else awning(v, -5, 5, 10, rear + 2, "#48796c", paper);
  }
  if (lv >= 3) {
    v.box(left + 1, 1, rear + 2, left + 6, 6, rear + 4, green);
    door(v, left + 2, 1, rear + 3, "glassDark", 2, 4);
    bookCart(v, 8, 3);
    for (let i = 0; i < rows * 3; i++) {
      const lx = left + Math.round(i / 3) + 7,
        ly = i + 2;
      v.box(lx, ly, rear + 2, lx + 1, ly + 1, rear + 3, paper);
      v.box(lx + 3, ly, rear + 2, lx + 4, ly + 1, rear + 3, paper);
      if (i % 2 === 0) v.box(lx, ly, rear + 2, lx + 4, ly + 1, rear + 3, timber);
    }
  }
  if (lv >= 4) {
    bookcase(v, left, rear + 1, 1, 16, 2, 5, true);
    counter(v, -3, 1, 3);
    person(v, 0, 1, 4, "blue");
  }
  if (lv === 5) {
    bookcase(v, 5, 7, 1, 8, 2, 5);
    // A red-and-linen awning marks the sale aisle below the secondhand shelves.
    awning(v, 5, 13, 6, 9, "#a85343", paper);
    person(v, 7, 1, 11, "sky");
    v.box(6, 11, 5, 12, 12, 8, green);
    v.box(-3, rows * 5 + 2, rear, -2, rows * 5 + 7, rear + 1, timber);
    v.box(-2, rows * 5 + 5, rear, 5, rows * 5 + 7, rear + 1, timber);
    v.box(3, rows * 5 - 1, rear + 1, 9, rows * 5 + 5, rear + 2, paper);
    v.put(4, rows * 5 + 3, rear + 2, "charcoal");
    v.box(5, rows * 5 + 1, rear + 2, 8, rows * 5 + 2, rear + 3, "crimson");
  }
}

const markets = [crookedShop, spiralMarket, treeShop, shelfShop];
export function buildIndieBookstore(c: Ctx) {
  lot(c, "grass2");
  pave(c.v, -c.hx + 1, c.hz - 5, c.hx - 1, c.hz, "path");
  markets[c.variant % 4](c);
}
