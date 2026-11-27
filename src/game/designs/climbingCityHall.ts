import { bench, byLv, door, flag, person, tree, type Ctx, type PixelVox } from "./kit";
import { disc, glassFront } from "./commerceKit";

const HOLDS = ["#ec8759", "#69c3be", "#efc653", "#c587b0"];

function climber(v: PixelVox, x: number, y: number, z: number, outfit: string, reach = 1) {
  v.put(x - reach, y, z, "#344655");
  v.put(x - reach, y + 1, z, "#5c7883");
  v.put(x + reach, y + 1, z, "#344655");
  v.put(x, y + 2, z, "#5c7883");
  v.box(x, y + 3, z, x + 1, y + 5, z + 1, outfit);
  v.put(x - reach, y + 4, z, "#bd8b68");
  v.put(x + reach, y + 5, z, "#bd8b68");
  v.put(x, y + 5, z, "#bd8b68");
  v.put(x, y + 6, z, "#fff0cb");
}

function route(v: PixelVox, x: number, bottom: number, top: number, face: (y: number) => number, color: string) {
  const offsets = [0, 2, 1, -1, -2, 0];
  for (let y = bottom, i = 0; y < top; y += 3, i++) {
    const dx = offsets[i % offsets.length];
    v.box(x + dx, y, face(y), x + dx + (i % 3 === 0 ? 2 : 1), y + 1, face(y) + 1, color, i % 3 === 0 ? 0.32 : 0.08);
  }
}

function office(v: PixelVox, x: number, y: number, z: number, w: number, h: number, d: number, base: string) {
  v.hollowBox(x, y, z, x + w, y + h, z + d, base);
  for (let floor = y + 1; floor < y + h - 2; floor += 5) {
    glassFront(v, x + 1, x + w - 1, floor, floor + 3, z + d - 1, "#52635d", 4, "#b0d9cc");
    for (let zz = z + 2; zz < z + d - 1; zz++) {
      if ((zz - z) % 4 !== 1) v.box(x + w - 1, floor, zz, x + w, floor + 2, zz + 1, "#a5cabe", 0.32);
    }
  }
  v.box(x - 1, y + h - 1, z - 1, x + w + 1, y + h, z + d + 1, "#ddcba9");
  door(v, x + 2, y, z + d - 1, "#385056", 3, Math.min(4, h - 1));
}

function serviceDesk(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 5, y + 2, z + 2, "#967454");
  v.box(x - 1, y + 2, z, x + 6, y + 3, z + 2, "#dbc9a6");
  person(v, x + 1, y, z - 1, "#357b79", "#394952", "#af805e");
  v.put(x + 3, y + 3, z, "screenCyan", 0.35);
}

function sidewalk(v: PixelVox, x: number, z: number, end: number) {
  v.box(x - 2, 0, z, x + 3, 1, end, "path");
}

// The y-slice profile of the climb also locates the handholds and the climber on its sloping face.
function sandstoneTerraces(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x0 = -hx + 4,
    cz = -hz + 5,
    height = 7 + 3 * lv;
  const w = byLv(c, [13, 16, 21, 23, 25]);
  const foot = cz + 11 + lv;
  const face = (y: number) => foot - Math.floor(y / 5) * 2;
  for (let y = 1; y <= height; y++) {
    const z = face(y),
      left = x0 + Math.floor(y / 6);
    const material = y % 5 === 0 ? "#d2a078" : y % 7 === 2 ? "#b77c5a" : "#c38a60";
    v.box(left, y, z - 2, x0 + w, y + 1, z, material);
    v.box(left, y, cz, left + 1, y + 1, z, material);
    v.box(x0 + w - 1, y, cz, x0 + w, y + 1, z, material);
    if (y === height || face(y + 1) !== z) v.box(left, y, cz, x0 + w, y + 1, z, "#d2b087");
  }
  route(v, x0 + 6, 2, height, face, HOLDS[1]);
  climber(v, x0 + 6, 2 + Math.floor(lv / 2), face(4 + Math.floor(lv / 2)) + 1, "#b84b45");
  // A second route zigzags over the broken face. Windows in the cutaway lead into the records rooms.
  if (lv >= 2) {
    route(v, x0 + w - 5, 3, height, face, HOLDS[0]);
    const ledge = face(8);
    v.box(x0 + w - 8, 6, ledge - 1, x0 + w - 2, 9, ledge, "#486e72");
    v.box(x0 + w - 8, 9, ledge - 1, x0 + w - 2, 10, ledge + 1, "#c8a982");
  }
  if (lv >= 3) {
    const px = x0 + w - 8,
      py = height - 7;
    climber(v, px, py, face(py + 2) + 1, "#506f97", -1);
    for (let y = 1; y < height - 2; y++) {
      const zz = face(y);
      if (y % 7 < 3) v.box(x0 + 8, y, zz - 1, x0 + 12, y + 1, zz + 1, "#bb875f");
    }
  }
  const ox = x0 + w;
  office(v, ox, 1, cz, 7 + lv, 5 + lv, 9, "#9f6b51");
  serviceDesk(v, ox + 2, 1, cz + 11);
  sidewalk(v, ox + 3, cz + 10, hz);
  if (lv >= 2) {
    for (let i = 0; i < 10; i++) v.box(x0 + w - 1 - i, 1, foot + 2, x0 + w - i, 2 + Math.floor(i / 2), foot + 5, "#ccac88");
    v.box(x0 + 1, 6, foot - 1, x0 + 8, 7, foot + 5, "#b99e76");
  }
  if (lv >= 3) {
    office(v, hx - 13, 1, 1, 10, 9, 9, "#a58966");
    const corner = hx - 10;
    v.box(ox + 2, 6, cz + 7, corner + 3, 7, cz + 10, "wood");
    v.box(corner, 6, cz + 7, corner + 3, 7, 5, "wood");
    for (let z = cz + 7; z < 2; z += 6) v.box(corner + 1, 1, z, corner + 2, 6, z + 1, "#816447");
    const sx = hx - 16;
    for (let y = 1; y < 10; y++) v.box(sx, y, 5 - Math.floor(y / 3), sx + 4, y + 1, 8 - Math.floor(y / 3), "#bd875f");
    route(v, sx + 1, 2, 10, (y) => 8 - Math.floor(y / 3), HOLDS[0]);
  }
  if (lv >= 4) {
    office(v, x0 + 3, height + 1, cz - 1, w - 6, 6, Math.max(6, face(height) - cz - 1), "#ae8f68");
    v.box(x0 + 1, height + 1, cz + 1, x0 + 3, height + 3, cz + 6, "leafDark");
    bench(v, hx - 11, 10, 5);
  }
  if (lv === 5) {
    office(v, -hx + 4, 1, 8, 18, 8, 11, "#ad8767");
    v.box(-hx + 9, 8, foot, -hx + 13, 9, 9, "woodLight");
    tree(v, 7, 1, 11, "blossom", 1.2);
    flag(v, x0 + 7, height + 7, cz + 1, 6, ["#307e75", "cream"]);
  }
}

function overhangRegistry(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -hx + 5,
    w = 9 + 2 * lv,
    h = 12 + 4 * lv,
    back = -hz + 7;
  const face = (y: number) => back + 3 + Math.floor(y < h * 0.48 ? y / 6 : (h * 0.48) / 6 + (y - h * 0.48) * 0.34);
  for (let y = 1; y <= h; y++) {
    const z = face(y),
      taper = Math.floor((h - y) / 10);
    v.box(x + taper, y, z - 2, x + w, y + 1, z, "#345e70");
    for (let i = taper; i < w; i++) {
      const diagonal = (i + y) % 15;
      v.put(x + i, y, z, diagonal < 3 ? "#a0bfc0" : (i + y * 2) % 23 < 9 ? "#557b9d" : "#709eb1");
    }
  }
  for (const i of [1, w - 2]) {
    for (let y = 1; y < h - 1; y++) {
      const z = back - 2 + Math.floor(((face(h) - back + 1) * y) / h);
      v.box(x + i, y, z, x + i + 1, y + 1, z + 2, "#ba8256");
    }
  }
  const holds = (y: number) => face(y) + 1;
  route(v, x + 4, 2, h, holds, HOLDS[2]);
  climber(v, x + 4, Math.floor(h / 3), holds(Math.floor(h / 3) + 3) + 1, "#c45745");
  const ox = x + w + 1;
  office(v, ox, 1, back, 7 + lv, 5 + lv, 8, "#748783");
  sidewalk(v, ox + 3, back + 8, hz);
  serviceDesk(v, ox + 1, 1, back + 10);
  if (lv >= 2) {
    office(v, ox - 4, 6, back - 2, 10, 6, 8, "#829c98");
    v.box(ox - 3, 6, back + 5, ox + 6, 7, back + 11, "woodLight");
  }
  if (lv >= 3) {
    const end = hx - 6;
    for (let y = 1; y < h - 2; y++) {
      const spread = Math.ceil(6 * (1 - y / h));
      for (const z of [back + 5 - spread, back + 5 + spread]) v.box(end, y, z, end + 2, y + 1, z + 2, "#ac784e");
    }
    // The council walkway follows the ridge to a stair pavilion seated inside its A-frame.
    const atZ = face(h - 4);
    v.box(ox - 3, h - 4, back + 4, ox + 1, h - 3, atZ + 1, "woodLight");
    skybridge(v, ox - 2, end + 2, h - 4, back + 4, false);
    office(v, end - 4, 1, back + 2, 7, 6 + lv, 8, "#87988e");
    for (let y = 2; y < h - 4; y += 5) v.box(end - 3, y, back + 6, end + 1, y + 1, back + 9, "#cdab7e");
    route(v, x + w - 4, 4, h - 2, holds, HOLDS[0]);
  }
  if (lv >= 4) {
    const px = hx - 15,
      pz = 7;
    for (let y = 1; y < 15; y++) {
      const z = pz + Math.floor(y / 4);
      v.box(px - Math.floor(y / 5), y, z - 2, px + 5, y + 1, z, "#6c7990");
    }
    route(v, px + 1, 2, 14, (y) => pz + Math.floor(y / 4), HOLDS[2]);
    climber(v, px + 1, 3, pz + 2, "#487e70", -1);
  }
  if (lv === 5) {
    office(v, x + 4, h - 1, face(h) - 9, w - 5, 7, 8, "#88a19d");
    v.box(x + w - 1, h, face(h) - 7, x + w + 8, h + 1, face(h) - 3, "wood");
    flag(v, x + w + 6, h + 1, face(h) - 6, 5, ["#d78851", "cream"]);
    bench(v, hx - 12, 1, 14);
  }
}

function basaltPinnacle(v: PixelVox, cx: number, cz: number, radius: number, h: number, color: string) {
  const edge = (y: number) => Math.max(2, radius - Math.floor(y / 9) + (y % 9 > 6 ? 1 : 0));
  for (let y = 1; y <= h; y++) {
    const r = edge(y),
      offset = Math.floor(y / 13);
    for (let dx = -r; dx <= r; dx++) {
      const cut = Math.floor(Math.max(0, Math.abs(dx) - r / 2));
      const z0 = cz - r + cut,
        z1 = cz + r - cut;
      v.put(cx + dx + offset, y, z0, "#596c70");
      v.put(cx + dx + offset, y, z1, y % 7 === 0 ? "#9ba69c" : dx % 4 === 0 ? "#606b69" : "#7e8278");
      if (y % 6 === 3 && dx > 0 && dx < r + 1) v.put(cx + dx + offset, y, z1, "#9dcccb", 0.45);
      if (Math.abs(dx) === r || y === h || edge(y + 1) < r)
        v.box(cx + dx + offset, y, z0, cx + dx + offset + 1, y + 1, z1 + 1, "#717d77");
    }
  }
  // Basalt columns rise unevenly around the roof. Their fracture lines keep each summit from becoming a flat drum.
  for (const [dx, dz, lift] of [
    [-2, -1, 3],
    [0, -1, 6],
    [2, 0, 2],
  ] as const) {
    const ax = cx + Math.floor(h / 13) + dx;
    v.box(ax, h, cz + dz, ax + 2, h + lift, cz + dz + 2, dx === 0 ? "#74837e" : "#98998a");
  }
  const face = (y: number) => cz + edge(y) + 1;
  route(v, cx, 2, h, face, color);
  climber(v, cx, Math.floor(h * 0.37), face(Math.floor(h * 0.37) + 2), "#ae574e");
}

function skybridge(v: PixelVox, x0: number, x1: number, y: number, z: number, enclosed: boolean) {
  v.box(x0, y, z, x1, y + 1, z + 4, "woodLight");
  for (const zz of [z, z + 3]) {
    for (let x = x0; x < x1; x++) {
      if (enclosed) v.box(x, y + 1, zz, x + 1, y + 4, zz + 1, (x - x0) % 4 === 0 ? "steelDark" : "#8dc5bb", 0.2);
      else if (x % 3 === 0) v.put(x, y + 1, zz, "woodDark");
    }
    v.box(x0, y + (enclosed ? 4 : 2), zz, x1, y + (enclosed ? 5 : 3), zz + 1, "#63736d");
  }
  if (enclosed) v.box(x0, y + 4, z, x1, y + 5, z + 4, "#ddceb0");
}

function canyonOffices(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x1 = -hx + 9,
    x2 = hx - 9,
    z1 = -3,
    z2 = lv < 3 ? -5 : 0;
  const r = 4 + Math.floor(lv / 2),
    leftH = 10 + lv * 4;
  basaltPinnacle(v, x1, z1, r, leftH, HOLDS[2]);
  const rightH = lv === 1 ? 4 : 4 + 4 * lv;
  if (lv === 1) v.dome(x2, 1, z2, 4, "#839087");
  else basaltPinnacle(v, x2, z2, r, rightH, HOLDS[1]);
  office(v, -5, 1, -hz + 3, 10, 6, 7, "#a48b69");
  serviceDesk(v, -2, 1, -hz + 12);
  sidewalk(v, 0, -hz + 10, hz);
  if (lv === 2) skybridge(v, x1 + r - 2, x2 - r + 2, 5, -4, false);
  if (lv >= 3) {
    skybridge(v, x1 + r - 2, x2 - r + 2, rightH - 4, -3, true);
    office(v, x1 - 2, leftH - 6, z1 - 1, 7, 5, 6, "#b39a75");
    v.box(x1 + r - 1, 6, z1, x1 + r + 5, 7, z1 + 5, "woodLight");
    bench(v, 3, 1, 4);
  }
  if (lv >= 4) {
    const spurX = x1 + 1,
      spurZ = 12;
    basaltPinnacle(v, spurX, spurZ, 4, 11, HOLDS[3]);
    for (let z = z1 + 3; z < spurZ; z++) {
      const xx = spurX + Math.round(2 * Math.sin((z - z1) / 3));
      v.box(xx - 1, 10, z, xx + 3, 11, z + 1, "wood");
      if (z % 2 === 0) v.put(xx + 2, 11, z, "woodDark");
    }
    tree(v, hx - 9, 1, 11, "birch", 1.15);
  }
  if (lv === 5) {
    office(v, x2 - 3, rightH - 5, z2 - 2, 7, 6, 7, "#c79876");
    skybridge(v, x1 + 3, x2 - 3, rightH - 13, 1, false);
    flag(v, x1 + 1, leftH + 3, z1 - 2, 5, ["#6c9485", "cream"]);
    office(v, hx - 20, 1, -hz + 3, 16, 7, 8, "#9c8172");
  }
}

function spiralCouncil(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const radius = 5 + lv,
    h = 7 + 4 * lv,
    cx = lv >= 3 ? -5 : -2,
    cz = -3;
  // Window bands follow the drum around its timber piers; the street entrance opens under the outer balcony.
  disc(v, cx, cz, 1, h + 1, radius, (x, y, z, d, a) => {
    if (d < radius - 1.4 || (z > cz && Math.abs(x - cx) < 2 && y < 6)) return null;
    if (y === 1 || y === h || y % 5 === 0 || Math.round(a * 7) % 3 === 0) return "#88654c";
    return y % 5 === 1 ? "#bb9a74" : ["#88b9ad", 0.37];
  });
  disc(v, cx, cz, h, h + 1, radius + 1, "#ccb792", radius - 2);
  const fz = cz + radius;
  for (let y = 1; y <= h; y++) {
    const dx = Math.floor(y / 6),
      z = fz + (y % 8 > 4 ? 1 : 0);
    v.box(cx - 5 + dx, y, z - 1, cx - 2 + dx, y + 1, z + 1, "#ab7254");
  }
  route(v, cx - 3, 2, h, (y) => fz + (y % 8 > 4 ? 2 : 1), HOLDS[1]);
  climber(v, cx - 3, 2 + lv, fz + 2, "#a94c4d");
  serviceDesk(v, cx - 1, 1, cz + 1);
  sidewalk(v, cx + 1, cz + 2, hz);

  if (lv >= 2) {
    const turns = lv === 2 ? 0.65 : lv === 3 ? 1 : 1.4;
    const radiusOut = radius + 2;
    for (let i = 0; i <= 84; i++) {
      const progress = i / 84;
      const a = 0.55 + progress * turns * Math.PI * 2;
      const y = 2 + Math.round(progress * (h - 2));
      const dx = Math.round(radiusOut * Math.sin(a)),
        dz = Math.round(radiusOut * Math.cos(a));
      v.box(cx + dx - 1, y, cz + dz - 1, cx + dx + 2, y + 1, cz + dz + 2, "#c19b6c");
      if (i % 7 === 0) v.put(cx + dx, y + 1, cz + dz, "#536c60");
    }
  }
  if (lv >= 3) {
    const px = hx - 9,
      pz = -3;
    disc(v, px, pz, 1, 8 + lv, 5, (_x, y, _z, d) => (d < 3.8 ? null : y % 4 === 2 ? ["#99c4b7", 0.38] : "#b59069"));
    disc(v, px, pz, 8 + lv, 9 + lv, 6, "#839e84", 2);
    skybridge(v, cx + radius, px - 3, 6, pz, false);
  }
  if (lv >= 4) {
    const wingX = cx - radius;
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI * (1 + i / 30);
      const x = wingX + Math.round(6 * Math.cos(a)),
        z = 5 + Math.round(6 * Math.sin(a));
      v.box(x, 2, z, x + 1, 9, z + 1, i % 4 === 0 ? "woodDark" : "#7caa9c");
      v.box(x - 1, 9, z - 1, x + 2, 10, z + 2, "#d8bb92");
    }
    bench(v, cx - 7, 1, 8);
  }
  if (lv === 5) {
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      const x = cx + Math.round(radius * Math.sin(a)),
        z = cz + Math.round(radius * Math.cos(a));
      v.box(x, h, z, x + 1, h + 5, z + 1, "#5d765f");
    }
    disc(v, cx, cz, h + 5, h + 6, radius + 2, "#80a08b", radius - 1);
    office(v, hx - 15, 1, 7, 12, 7, 9, "#a58b67");
    tree(v, -hx + 7, 1, 9, "blossom", 1.2);
    flag(v, cx + radius - 1, h + 5, cz, 6, ["#528f82", "cream"]);
  }
}

export function buildClimbingCityHall(c: Ctx): void {
  c.vpick([sandstoneTerraces, overhangRegistry, canyonOffices, spiralCouncil])(c);
}
