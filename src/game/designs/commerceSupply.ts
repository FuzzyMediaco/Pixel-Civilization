/** Original department stores and builders' merchants. Each shop has a street entrance and four separate plans. */
import { archway, awning, byLv, clockFace, door, lamp, person, truck, windows, type Ctx, type PixelVox } from "./kit";
import { bulbs, cafeTable, disc, glassFront, spinner } from "./commerceKit";

function shopWing(c: Ctx, x0: number, z0: number, x1: number, z1: number, top: number, wall: string, cornice: string) {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, top, z1, wall);
  windows(c, x0, 1, z0, x1, top, z1, { w: 2, h: 2, stepH: 4, stepV: 4, col: "#f1d1a4", emit: 0.45 });
  v.box(x0 - 1, top - 1, z0 - 1, x1 + 1, top, z1 + 1, cornice);
  glassFront(v, x0 + 1, x1 - 1, 2, 5, z1 - 1, "woodDark", 4);
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1);
}

function clockEmporium(c: Ctx) {
  const { lv, v, hx, hz } = c;
  const left = -hx + 4,
    back = -hz + 4,
    front = byLv(c, [3, 7, 6, 7, 10]);
  const r = byLv(c, [4, 5, 6, 7, 8]);
  const cx = left + r,
    cz = front - 1,
    h = 4 + lv * 3;
  shopWing(c, left + 2, back, cx + r, front, h, "#cda984", "#64776c");
  disc(v, cx, cz, 1, h + 1, r, (x, y, z, d) => (d < r - 1.5 ? null : y % 4 === 2 && x % 3 ? ["#b8d3bd", 0.3] : "#dbc4a3"));
  v.dome(cx, h + 1, cz, r, "#6e9d88");
  const dial = lv <= 2 ? 2 : 3;
  clockFace(v, cx, h, cz + r, dial, "#ffe6a2", "#3d3c3b");
  archway(v, cx, 1, cz + r - 2, cz + r + 1, 4, 4, "woodDark");
  v.box(cx - 2, 0, cz + r - 2, cx + 3, 1, hz, "path");
  if (lv >= 2) {
    shopWing(c, cx + r, back + 2, hx - 3, 0, h - 3, "#d3ac86", "#567a73");
    awning(v, cx + r, hx - 3, 5, 0, "#984f41", "cream");
  }
  if (lv >= 3) {
    for (let x = cx + r + 1; x < hx - 3; x += 6) v.box(x, 1, 4, x + 2, 6, 6, "limestone");
    v.box(cx + r, 6, 0, hx - 2, 7, 7, "#719487");
  }
  if (lv >= 4) {
    const tower = hx - 9;
    disc(v, tower, -4, h - 3, h + 5, 4, "#c39d78", 2.7);
    v.cone(tower, h + 5, h + 12, -4, 5, 1, "#517c69");
    lamp(v, tower, h + 12, -4, 2, "brass");
    cafeTable(c, 3, 11);
  }
  if (lv === 5) {
    // Twin barrel-vault rooflights span the new shopping arcade above a long street of show windows.
    for (let x = -4; x <= 14; x += 13) {
      for (let dx = -5; dx <= 5; dx++) {
        const y = h - 2 + Math.round(4 * Math.sqrt(Math.max(0, 1 - (dx * dx) / 25)));
        for (let z = back + 4; z < 0; z++) v.put(x + dx, y, z, z % 4 === 0 ? "#5c736b" : "#b7ddd3", 0.2);
      }
    }
    disc(v, cx, cz, h + r, h + r + 5, 2, "#c39867", 1);
    v.dome(cx, h + r + 5, cz, 3, "#5e8674");
  }
  person(v, cx + 1, 1, cz + r + 1, "purple");
}

function wrappedRoom(
  v: PixelVox,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  paper: string,
  ribbon: string,
) {
  v.hollowBox(x, y, z, x + w, y + h, z + d, paper);
  v.box(x - 1, y + h - 2, z - 1, x + w + 1, y + h, z + d + 1, paper);
  const mx = x + Math.floor(w / 2),
    mz = z + Math.floor(d / 2);
  v.box(mx - 1, y, z + d - 1, mx + 2, y + h, z + d, ribbon);
  v.box(mx - 1, y + h - 1, z - 1, mx + 2, y + h, z + d + 1, ribbon);
  v.box(x - 1, y + h - 1, mz - 1, x + w + 1, y + h, mz + 2, ribbon);
  v.box(x + w - 1, y, mz - 1, x + w, y + h, mz + 2, ribbon);
  glassFront(v, x + 1, mx - 1, y + 1, y + Math.min(4, h - 2), z + d - 1, "#795c5b", 4);
}

function bow(v: PixelVox, cx: number, y: number, z: number, size: number, ribbon: string) {
  for (const sign of [-1, 1]) {
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x = Math.round(cx + (sign * size * (1 - Math.cos(a))) / 2),
        yy = Math.round(y + size * (0.21 * Math.sin(a) + 0.29 * (1 - Math.cos(a))));
      v.box(x, yy, z, x + 1, yy + 2, z + 3, ribbon);
    }
  }
  v.box(cx - 1, y, z - 1, cx + 2, y + 3, z + 3, "gold");
}

function giftArcade(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -hx + 3,
    z = -hz + 3,
    w = byLv(c, [16, 20, 24, 26, 29]),
    d = 9 + 2 * lv,
    h = 5 + lv;
  wrappedRoom(v, x, 1, z, w, d, h, "#799eaa", "#f6bc68");
  bow(v, x + Math.floor(w / 2), h + 1, z + d / 2, 3 + lv, "#e9a852");
  door(v, x + Math.floor(w / 2), 1, z + d - 1, "#4f5c68");
  v.box(x + Math.floor(w / 2) - 1, 0, z + d, x + Math.floor(w / 2) + 3, 1, hz, "path");
  if (lv >= 2) {
    const x2 = Math.min(hx - 12, x + w - 1);
    wrappedRoom(v, x2, 1, 0, 10, 9, 6, "#ce8d99", "#816a90");
    bow(v, x2 + 5, 7, 4, 4, "#8c688e");
  }
  if (lv >= 3) {
    wrappedRoom(v, x + 1, h + 1, z + 1, 13, 11, 7, "#b99fc3", "#f9d7a4");
    bow(v, x + 7, h + 8, z + 5, 5, "#e8ba86");
    awning(v, x + 1, x + 9, 5, z + d, "cream", "#d89b85");
  }
  if (lv >= 4) {
    wrappedRoom(v, hx - 15, 1, hz - 16, 11, 11, 12, "#dfa987", "#699c96");
    bow(v, hx - 10, 13, hz - 11, 5, "#67968e");
    for (let i = 0; i < 18; i++) {
      const t = i / 17,
        xx = Math.round((x + w - 2) * (1 - t) + (hx - 12) * t),
        zz = Math.round((z + d - 2) * (1 - t) + (hz - 13) * t);
      const yy = Math.round(h + 2 + 4 * Math.sin(t * Math.PI));
      v.box(xx - 1, yy, zz - 1, xx + 2, yy + 1, zz + 2, "#dfb16d");
    }
  }
  if (lv === 5) {
    wrappedRoom(v, x + 3, h + 8, z + 3, 9, 7, 6, "#e0af78", "#788daf");
    bow(v, x + 8, h + 14, z + 5, 7, "#738caf");
    // A downturned gift tag doubles as the entrance canopy.
    for (let i = 0; i < 8; i++)
      v.box(
        x + 2,
        8 - Math.floor(i / 3),
        z + d + i,
        x + 8,
        9 - Math.floor(i / 3),
        z + d + i + 1,
        i === 2 ? "#cb9d5e" : "cream",
      );
  }
}

function stairFlight(v: PixelVox, x0: number, x1: number, y: number, z: number, rise: number, reverse: boolean) {
  const run = x1 - x0;
  for (let i = 0; i < run; i++) {
    const floor = y + Math.round(((reverse ? run - 1 - i : i) * rise) / (run - 1));
    v.box(x0 + i, floor, z, x0 + i + 1, floor + 1, z + 4, "steelLight");
    for (const rail of [z - 1, z + 4]) {
      v.put(x0 + i, floor + 1, rail, "#72b8b5", 0.2);
      v.put(x0 + i, floor + 2, rail, "#384852");
    }
  }
}

function escalatorArcade(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -hx + 3,
    X = hx - 3,
    z = -hz + 3,
    Z = hz - 5;
  const floors = [1, 2, 2, 3, 4][lv - 1];
  for (let f = 0; f < floors; f++) {
    const y = 1 + f * 7,
      set = 2 * f;
    // A U-shaped floorplate leaves its escalators, shopping balconies and main entrance in view.
    for (const xx of [x + set, X - 7 - set]) {
      v.hollowBox(xx, y, z + set, xx + 7, y + 5, Z - set, "#ab8372");
      glassFront(v, xx, xx + 7, y + 1, y + 5, Z - set - 1, "#705857", 3);
      v.box(xx - 1, y + 5, z + set, xx + 8, y + 6, Z - set + 1, "cream");
    }
    v.box(x + set, y + 5, z + set, X - set, y + 6, z + 6 + set, "#dcc8ae");
    stairFlight(v, x + 6 + set, X - 5 - set, y, lv < 3 ? z + 6 + 4 * f : 3 - 3 * f, 6, f % 2 === 1);
    person(v, x + 8 + set, y + 6, z + 3 + set, "crimson");
  }
  v.box(x + 8, 0, z + 6, x + 13, 1, hz, "path");
  if (lv >= 2) bulbs(v, x + 2, Z - 2, X - 3, Z - 2, 8);
  if (lv >= 3) {
    // Separated glass barrel ribs keep a view into the atrium even at full height.
    const top = 7 * floors + 1;
    for (let zz = z + 2; zz <= Z - 2; zz += 7)
      for (let xx = x; xx <= X; xx++) {
        const arch = Math.sqrt(Math.max(0, 1 - (xx / X) ** 2));
        v.put(xx, top + 5 * arch, zz, "#82a5a6");
        v.put(xx, top + 5 * arch, zz + 1, "#bfe1d9", 0.2);
      }
  }
  if (lv >= 4) cafeTable(c, x + 3, Z - 5, "#dbb687", 7 * floors);
  if (lv === 5) {
    stairFlight(v, x + 9, X - 8, 14, Z - 9, 7, false);
    stairFlight(v, x + 9, X - 8, 7, Z - 15, 7, true);
  }
}

function rotunda(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const radius = byLv(c, [6, 9, 11, 13, 16]),
    cz = -2,
    top = 5 + lv * 2;
  disc(v, 0, cz, 1, top, radius, (x, y, z, d) => {
    if (d < radius - 1.4 || (z > cz && Math.abs(x) < radius * 0.4)) return null;
    if (y === 1 || y === top - 1 || x % 4 === 0) return "#647d77";
    return y % 4 === 0 ? "cream" : ["#aecabd", 0.25];
  });
  disc(v, 0, cz, top, top + 1, radius + 1, "#d9aa6c", radius - 3);
  const wings = spinner(c, 0, 1, cz, "y", 0.24);
  wings.cylinderY(0, 0, 0, top - 1, 1, "brass");
  for (let i = 0; i < 3; i++)
    for (let r = 1; r < radius - 2; r++) {
      const a = (i * Math.PI * 2) / 3,
        x = Math.round(r * Math.sin(a)),
        z = Math.round(r * Math.cos(a));
      wings.box(x, 1, z, x + 1, top - 3, z + 1, r % 4 === 0 ? "brass" : "#b0cdbf");
      wings.put(x, top - 3, z, "woodDark");
    }
  v.box(-3, 0, cz + radius - 1, 3, 1, hz, "path");
  if (lv >= 2) {
    shopWing(c, -hx + 2, -hz + 2, -3, -hz + 9, 6, "#b28167", "cream");
  }
  if (lv >= 3) {
    shopWing(c, hx - 12, -hz + 3, hx - 3, 4, 9, "#bd987b", "#779488");
    v.box(radius - 3, 8, -2, hx - 4, 9, 1, "wood");
  }
  if (lv >= 4) {
    // A crown of stepped petals shades the gallery; leave its radial center open above the turning door.
    for (let i = 0; i < (lv === 5 ? 8 : 4); i++) {
      const a = (i * Math.PI * 2) / (lv === 5 ? 8 : 4);
      for (let j = 0; j < 6; j++) {
        const r = radius - j,
          xx = Math.round(r * Math.sin(a)),
          zz = cz + Math.round(r * Math.cos(a));
        v.box(xx - 2, top + j, zz - 2, xx + 3, top + j + 1, zz + 3, i % 2 ? "#d7ba86" : "#6c998a");
      }
    }
  }
  if (lv === 5) {
    disc(v, 0, cz, top + 6, top + 7, radius - 5, "cream", radius - 7);
    cafeTable(c, -hx + 8, 6);
  }
}

export function buildDepartmentStore(c: Ctx) {
  c.vpick([clockEmporium, giftArcade, escalatorArcade, rotunda])(c);
}

function timber(v: PixelVox, x: number, z: number, w: number, rows: number) {
  for (let y = 0; y < rows; y++)
    for (let i = 0; i < 3; i++)
      v.box(x + (y % 2), y + 1, z + i * 2, x + w, y + 2, z + i * 2 + 1, (i + y) % 2 ? "wood" : "woodLight");
}

function toolbox(c: Ctx) {
  const { v, lv, hx, hz } = c;
  if (lv === 1) {
    // A hinged chest leaves its divided tray exposed to the street. The mallet leans out of its right side.
    v.hollowBox(-7, 1, -1, 5, 5, 5, "#ae4d40");
    v.clear(-6, 3, 0, 4, 6, 4);
    v.box(-6, 2, 0, 4, 3, 4, "woodDark");
    v.box(-2, 3, 0, -1, 4, 4, "woodLight");
    v.box(-5, 3, 1, -3, 4, 2, "silver");
    v.box(0, 3, 0, 1, 4, 3, "brass");
    v.box(-3, 1, 4, 0, 4, 5, "glassDark");
    v.box(-3, 0, 5, 0, 1, hz, "path");

    for (let y = 0; y < 8; y++) {
      const z = -2 - Math.floor(y / 3);
      v.box(-7, 4 + y, z, 3, 5 + y, z + 2, "#b45444");
      v.box(-6, 4 + y, z + 1, 2, 5 + y, z + 2, y === 0 || y === 7 ? "copper" : "#774d45");
    }
    v.box(-5, 11, -4, -4, 14, -2, "steelDark");
    v.box(0, 11, -4, 1, 14, -2, "steelDark");
    v.box(-5, 13, -4, 1, 14, -2, "woodLight");

    for (let y = 0; y < 12; y++) {
      const x = 1 + Math.floor(y / 4);
      v.box(x, 3 + y, 1, x + 2, 4 + y, 3, "woodLight");
    }
    v.box(1, 15, 0, 7, 18, 4, "steelDark");
    v.box(6, 15, 0, 8, 18, 4, "silver");
    return;
  }
  const w = Math.min(hx - 2, 7 + lv * 2),
    d = Math.min(hz - 2, 4 + lv),
    h = 4 + lv;
  v.hollowBox(-w, 1, -d, w, h + 1, d, "#ad4a40");
  v.box(-w + 1, h, -d + 1, w - 1, h + 1, d - 1, "#523e39");
  for (let x = -w + 2; x < w; x += 5) {
    v.box(x, h - 2, d - 1, x + 2, h + 1, d, "chrome");
    v.put(x, h - 1, d, "steelDark");
  }
  v.box(-2, 1, d - 1, 2, 4, d, "#443c34");
  v.box(-2, 0, d, 2, 1, hz, "path");
  // Punched-out handle sides frame the working tray and stay readable on the smallest parcel.
  for (const x of [-w + 1, w - 3]) {
    for (let y = 0; y < h; y++) v.box(x, h + y, -Math.max(1, d - y), x + 2, h + y + 1, Math.max(1, d - y) + 1, "#cc6245");
  }
  v.box(-w + 1, h * 2 - 1, -1, w - 1, h * 2 + 1, 2, "woodLight");
  if (lv >= 2) {
    v.box(-w + 3, h + 1, 1, w - 3, h + 2, 4, "#ac7857");
    timber(v, -hx + 2, hz - 5, 7, 2);
  }
  if (lv >= 3) {
    // An angled joiner's hammer rises from a real tray with divided bins for fasteners.
    for (let i = 0; i < 8 + lv; i++) v.box(2 + Math.floor(i / 3), h + i, -3, 4 + Math.floor(i / 3), h + i + 1, 0, "wood");
    const x = 3 + Math.floor((7 + lv) / 3);
    v.box(x - 5, h + 7 + lv, -4, x + 5, h + 11 + lv, 1, "steelDark");
    v.box(x - 6, h + 7 + lv, -4, x - 4, h + 11 + lv, 1, "silver");
  }
  if (lv >= 4) {
    v.box(-w + 2, 3, d, w - 2, 4, d + 5, "steel");
    for (let x = -w + 3; x < w - 4; x += 4) v.box(x, 4, d, x + 2, 5, d + 4, "copper");
  }
  if (lv === 5) {
    shopWing(c, -hx + 2, -hz + 2, -3, -hz + 11, 7, "#ab6d4c", "slate");
    truck(v, hx - 8, 1, hz - 6, "x", "cream", "redDark");
  }
}

function paintCan(v: PixelVox, cx: number, cz: number, y0: number, h: number, r: number, ink: string) {
  disc(v, cx, cz, y0, y0 + h, r, (x, y, z, d, a) => {
    if (d < r - 1.3) return y === y0 + h - 1 ? ink : null;
    if (y === y0 || y === y0 + h - 1) return "silver";
    const drip = Math.max(0, Math.cos(a * 7 + 1)) ** 10;
    return y - y0 >= h - 3 - drip * h * 0.6 ? ink : "#d3d1bd";
  });
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI;
    v.put(cx + (r + 0.5) * Math.cos(a), y0 + h - 2 + (r + 1) * Math.sin(a), cz, "steelDark");
  }
}

function paintDepot(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = 3 + lv,
    x = lv <= 2 ? -1 : -4,
    z = -2;
  paintCan(v, x, z, 1, 5 + lv, r, "#4c9b99");
  door(v, x - 1, 1, z + r - 1, "#44506b");
  v.box(x - 1, 0, z + r, x + 2, 1, hz, "path");
  if (lv >= 2) paintCan(v, hx - 5, 1, 1, 5, 3, "#c57c47");
  if (lv >= 3) {
    paintCan(v, x - 2, z + 1, 6 + lv, 7, r - 2, "#cc745e");
    timber(v, -hx + 2, hz - 5, 7, 2);
  }
  if (lv >= 4) {
    const bx = hx - 7;
    for (let i = 0; i <= 8; i++) v.box(bx + i / 3, 4 + i, 1, bx + i / 3 + 2, 6 + i, 3, "wood");
    v.box(bx, 13, 0, bx + 6, 15, 4, "chrome");
    v.box(bx, 15, 0, bx + 6, 20, 4, "#e9bc91");
  }
  if (lv === 5) {
    paintCan(v, x + 1, z + 1, 13 + lv, 6, 4, "#dda34d");
    shopWing(c, hx - 15, -hz + 2, hx - 3, -7, 7, "#66867f", "#bac0a4");
  }
}

function hexNut(v: PixelVox, x: number, z: number, y: number, r: number, h: number, finish: string, turn: number) {
  disc(v, x, z, y, y + h, r + 0.5, (xx, yy, zz, d, a) => {
    const sector = ((a + turn + Math.PI * 3) % (Math.PI / 3)) - Math.PI / 6;
    const edge = ((r - (yy === y || yy === y + h - 1 ? 0.6 : 0)) * 0.866) / Math.cos(sector);
    if (d > edge || d < r * 0.42) return null;
    if (yy > y && yy < y + h - 1 && d < edge - 1.3 && d > r * 0.42 + 1) return null;
    return yy === y + h - 1 ? "steelLight" : finish;
  });
}

function boltWorks(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = Math.min(4 + lv * 2, hx - 2, hz - 1),
    cx = lv >= 3 ? -4 : 0,
    cz = lv >= 3 ? -3 : 0;
  hexNut(v, cx, cz, 1, r, 3 + lv, "#5e7880", 0.15);
  archway(v, cx, 1, cz + Math.floor(r / 2), cz + r + 1, 3 + lv, Math.min(5, 2 + lv));
  v.box(cx - 2, 0, cz + Math.floor(r / 2), cx + 2, 1, hz, "path");
  if (lv >= 2) {
    hexNut(v, hx - 6, 1, 1, 4, 4, "#bd9162", 0.5);
    person(v, hx - 5, 1, 5, "orange");
  }
  if (lv >= 3) {
    const h = lv * 4,
      shaft = r * 0.34;
    v.cylinderY(cx, cz, 2, h + 3, shaft, "#718286");
    for (let i = 0; i < h * 7; i++) {
      const a = i / 4;
      v.put(cx + (shaft + 1) * Math.cos(a), 2 + i / 7, cz + (shaft + 1) * Math.sin(a), "chrome");
    }
    hexNut(v, cx, cz, h, r * 0.67, 4, "#6b878a", 0.55);
  }
  if (lv >= 4) {
    timber(v, 1, hz - 8, hx - 4, 3);
    shopWing(c, hx - 13, -hz + 3, hx - 3, -3, 7, "#a7714c", "steelDark");
  }
  if (lv === 5) {
    hexNut(v, -hx + 7, hz - 8, 1, 6, 6, "#b38a5a", 0.2);
    v.box(-hx + 6, 6, cz, -hx + 9, 7, hz - 8, "steelDark");
  }
}

function gambrel(v: PixelVox, x0: number, x1: number, z0: number, z1: number, base: number, h: number) {
  const cz = (z0 + z1 - 1) / 2,
    radius = (z1 - z0) / 2;
  for (let z = z0; z < z1; z++) {
    const t = Math.abs(z - cz) / radius,
      y = base + Math.round(h * (1 - (t < 0.62 ? t * 0.44 : 0.27 + (t - 0.62) * 1.9)));
    for (let x = x0; x < x1; x++) v.put(x, y, z, (x - x0) % 5 === 0 ? "#788d8c" : "#485d65");
    for (const x of [x0 + 1, x1 - 2]) v.box(x, base, z, x + 1, y, z + 1, "#a45549");
  }
}

function lumberBarn(c: Ctx) {
  const { lv, v, hx, hz } = c;
  if (lv === 1) {
    // The red timber frame only encloses the rear. Its shed roof reaches out over an open cutting bay.
    for (const x of [-6, 0]) v.box(x, 1, -6, x + 2, 10, -4, "#995548");
    for (let y = 2; y < 8; y += 2) v.box(-6, y, -6, 2, y + 1, -5, "#ad6650");
    for (let z = -7; z < 2; z++) {
      const roof = 10 - Math.floor((z + 7) / 4);
      v.box(-7, roof, z, 4, roof + 1, z + 1, z % 3 === 0 ? "#84938b" : "#475e65");
    }
    for (let i = 0; i < 4; i++) v.put(-5, 5 + i, -5 + i, "woodDark");

    // Two X-frames carry a single long plank; neighboring uncut stock stands in the bins.
    for (const x of [-6, 0]) {
      for (let y = 0; y < 4; y++) {
        v.put(x, y + 1, 2 + y, "woodDark");
        v.put(x, y + 1, 5 - y, "wood");
      }
    }
    v.box(-7, 4, 3, 3, 5, 5, "woodLight");
    v.box(3, 1, -4, 8, 3, 1, "#ad614a");
    for (let i = 0; i < 3; i++) {
      v.box(3 + i * 2, 3, -1, 4 + i * 2, 5 + 2 * i, 0, i % 2 ? "wood" : "woodLight");
    }
    person(v, 4, 1, 3, "tealDark");
    return;
  }
  const x = -hx + 2,
    z = -hz + 2,
    X = byLv(c, [5, 6, 8, 9, 15]),
    Z = lv <= 2 ? 3 : 0,
    top = 4 + lv;
  shopWing(c, x + 1, z + 1, X - 1, Z, top, "#b75b4b", "#d9b99a");
  gambrel(v, x, X, z, Z + 1, top, 4 + lv);
  const mid = Math.round((x + X) / 2);
  v.box(mid - 3, 1, Z - 1, mid + 3, 5, Z, "#523e31");
  v.box(mid - 3, 0, Z, mid + 3, 1, hz, "path");
  for (let i = 0; i < 4; i++) {
    v.put(mid - 3 + i, i + 1, Z, "cream");
    v.put(mid + 2 - i, i + 1, Z, "cream");
  }
  if (lv >= 2) {
    timber(v, X, -3, hx - X - 2, lv);
    awning(v, mid - 4, mid + 4, 5, Z, "cream", "#8f4a41");
  }
  if (lv >= 3) {
    for (let xx = x + 2; xx < X - 2; xx += 7) v.box(xx, 1, Z + 7, xx + 1, 6, Z + 8, "woodDark");
    v.box(x + 1, 6, Z, X - 1, 7, Z + 9, "#77928a");
    timber(v, x + 2, Z + 2, 11, 2);
  }
  if (lv >= 4) {
    const sx = hx - 7,
      sz = -hz + 6;
    v.cylinderY(sx, sz, 1, 13, 3.7, "#a49882");
    v.dome(sx, 13, sz, 4, "#657f7d");
    v.box(X - 3, 7, sz - 1, sx, 8, sz + 2, "wood");
  }
  if (lv === 5) {
    truck(v, hx - 10, 1, hz - 6, "x", "woodLight", "#527e77");
    timber(v, -hx + 4, hz - 8, 16, 5);
  }
}

export function buildHardwareStore(c: Ctx) {
  c.vpick([toolbox, paintDepot, boltWorks, lumberBarn])(c);
}
