import { type Ctx, type PixelVox, byLv, bench, person } from "./kit";
import { glassFront, spinner } from "./commerceKit";
import { beam, entrance, finish as f, loop, oval, plate, planter, slab, storey } from "./sculpturalKit";

// A scale model with street crossings, distinct blocks and a strip of blue river.
function islandModel(v: PixelVox, x: number, y: number, z: number, w: number, d: number) {
  v.box(x, y, z, x + w, y + 1, z + d, "#a9b69a");
  for (let dx = 0; dx < w; dx++) {
    const river = Math.min(d - 1, Math.max(0, Math.round(d * 0.52 + Math.sin((dx / w) * 5) * d * 0.22)));
    v.put(x + dx, y, z + river, "#669baa");
    if (dx % 5 === 2) v.box(x + dx, y, z, x + dx + 1, y + 1, z + d, "#d9c49d");
  }
  for (let dx = 1; dx < w - 1; dx += 4)
    for (let dz = 1; dz < d - 1; dz += 4) {
      let storeys = 1 + ((dx * 5 + dz * 3) % 4);
      if (dx === 1 && dz === 1) storeys = 1;
      v.box(x + dx, y + 1, z + dz, x + dx + 2, y + 1 + storeys, z + dz + 1, dx % 3 === 0 ? "#b87a5f" : "#e3d7b9");
    }
}
function tripod(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const tip = byLv(c, [10, 15, 20, 24, 30]),
    reach = byLv(c, [6, 9, 12, 15, 18]);
  const pivotX = lv >= 3 ? -5 : -2,
    pivotZ = lv >= 3 ? -4 : -2;
  const feet = [
    [pivotX - reach, pivotZ + Math.round(reach * 0.58)],
    [pivotX + reach, pivotZ + Math.round(reach * 0.7)],
    [pivotX + 1, pivotZ - Math.round(reach * 0.73)],
  ];
  for (const [fx, fz] of feet) {
    v.box(fx - 1, 1, fz - 1, fx + 2, 3, fz + 2, f.ink);
    beam(v, [fx, 3, fz], [pivotX, tip, pivotZ], f.cedar, 2);
    beam(v, [fx + 1, 3, fz + 1], [pivotX + 1, tip, pivotZ + 1], f.gold);
  }
  v.cylinderY(pivotX + 0.5, pivotZ + 0.5, tip, tip + 2, lv >= 3 ? 4 : 3, f.bronze);
  const optics = spinner(c, pivotX, tip + 2, pivotZ, "y", 0.11);
  // A real open yoke holds the telescope with its bright glass objective.
  for (const side of [-1, 1]) optics.box(side * 2, 0, 0, side * 2 + 1, 5, 2, f.gold);
  optics.ringZ(0, 4, -2, 3, 2.5, 1.3, f.ink);
  optics.ringZ(0, 4, 2, 4, 2.5, 1.4, f.silver);
  optics.put(0, 4, 2, f.pool, 0.65);
  const courtW = Math.min(19, hx + 1);
  v.box(-hx + 3, 0, hz - 12, -hx + courtW + 5, 1, hz - 2, "#cabba0");
  islandModel(v, -hx + 4, 1, hz - 10, courtW, 7);
  person(v, -hx + 7, 1, hz - 3, "teal");
  entrance(c, -hx + 9, hz - 3, 3);
  if (lv >= 2) {
    const x = hx - 9,
      z = -hz + 3;
    const base = plate(x, z + 4, 5, 4, 0.35);
    storey(v, base, base, 1, 6, f.glass, f.limestone);
    beam(v, [x - 5, 6, z + 3], [x + 3, 10, z + 3], f.gold, 2);
    person(v, x + 2, 1, z + 9, "red");
  }
  if (lv >= 3) {
    const y = tip - 7;
    const deck = oval(pivotX, pivotZ, 7, 6, 8);
    slab(v, deck, y, 1, f.bronze);
    storey(v, oval(pivotX, pivotZ, 6, 5, 8), deck, y + 1, 4, f.glass, f.porcelain);
    v.box(pivotX + 4, 1, pivotZ + 1, pivotX + 6, y + 1, pivotZ + 3, f.silver);
  }
  if (lv >= 4) {
    const roomX = pivotX - 4,
      roomZ = pivotZ - 4;
    const room = plate(roomX, roomZ, lv === 5 ? 10 : 8, 6, 0.3);
    const gallery = plate(roomX, roomZ, lv === 5 ? 11 : 9, 7, 0.3);
    storey(v, room, gallery, 1, 7, f.glass, f.limestone);
    v.box(roomX - 4, 7, roomZ + 4, roomX + 5, 8, roomZ + 8, f.cedar);
    for (const side of [-1, 1]) v.box(roomX + side * 4, 1, roomZ + 7, roomX + side * 4 + 1, 7, roomZ + 8, f.bronze);
    glassFront(v, roomX - 3, roomX + 3, 2, 5, roomZ + 5, f.cedar, 3, f.amber);
    entrance(c, roomX, roomZ + 6, 2);
    const x = hx - 11,
      z = hz - 8;
    v.box(x - 6, 1, z - 4, x + 5, 4, z + 3, f.limestone);
    islandModel(v, x - 5, 4, z - 3, 9, 5);
    for (let j = 0; j < 4; j++) v.box(x - 7 - j, 1, z - 2, x - 6 - j, 5 - j, z + 2, f.limestone);
    for (const bx of [x - 5, x + 1]) bench(v, bx, 1, z + 5, "x", "oak");
  }
  if (lv === 5) {
    const x = hx - 9,
      z = -hz + 7;
    for (const side of [-1, 1]) beam(v, [x + side * 4, 7, z], [x, 22, z], f.cedar, 2);
    v.box(x - 3, 21, z - 1, x + 5, 23, z + 2, f.ink);
    v.put(x + 4, 22, z + 1, f.amber, 0.65);
    v.box(pivotX + 4, tip - 7, pivotZ - 1, x - 2, tip - 6, pivotZ + 2, f.limestone);
    v.box(x - 5, tip - 7, z, x - 2, tip - 6, pivotZ + 2, f.limestone);
    for (const rz of [z + 2, pivotZ]) v.box(x - 4, 1, rz, x - 3, tip - 7, rz + 1, f.bronze);
    for (let bx = pivotX + 5; bx < x - 4; bx += 5)
      v.box(bx, tip - 6, pivotZ + 1, bx + 1, tip - 4, pivotZ + 2, f.bronze);
  }
  // One street-facing survey pin also marks the bureau in its smallest form.
  v.box(-hx + 4, 1, hz - 3, -hx + 5, 5, hz - 2, f.bronze);
  v.put(-hx + 4, 5, hz - 3, f.amber, 0.75);
}

function contours(c: Ctx) {
  const { v, lv, hx, hz } = c,
    layers = byLv(c, [2, 3, 4, 5, 6]),
    rx = byLv(c, [9, 11, 15, 17, 22]),
    rz = byLv(c, [6, 8, 10, 13, 16]);
  const x = lv >= 3 ? -4 : -1,
    z = lv >= 4 ? -4 : -2;
  for (let i = 0; i < layers; i++) {
    const k = 1 - (0.72 * i) / layers,
      px = x - i * 0.65,
      pz = z - i * 0.55,
      y = 1 + i * 3;
    const plan = oval(px, pz, rx * k, rz * k, 14, 0.15).map(([xx, zz]): [number, number] => [
      xx + Math.sin(((zz - z) / rz) * 3.6) * k * 2,
      zz,
    ]);
    storey(v, plan, plan, y, 3, i % 2 ? f.glass : "#71866f", i % 2 ? "#659475" : "#8bad78");
    loop(v, plan, y + 2, i % 2 ? "#c8b794" : "#a1b082");
  }
  const front = z + rz;
  entrance(c, x, front, 3);
  const entryZ = front - 1;
  v.box(x - 4, 1, entryZ - 2, x + 5, 4, entryZ + 2, "#52776b");
  v.box(x - 5, 4, entryZ - 2, x + 6, 5, entryZ + 3, "#b3bd98");
  v.box(x - 1, 1, entryZ + 1, x + 2, 4, entryZ + 2, f.nightGlass);
  v.put(x + 2, 2, entryZ + 1, f.amber, 0.75);
  glassFront(v, x - 3, x + 3, 1, 3, front - 1, f.cedar, 3, f.amber);
  for (let i = 0; i < layers; i++) {
    const bx = x + rx - 2 - i * 2,
      bz = z + 1 + (i % 2);
    v.box(bx, 1 + i * 3, bz, bx + 3, 3 + i * 3, bz + 3, f.limestone);
  }
  if (lv >= 2) {
    const top = 1 + layers * 3;
    v.box(x - 5, top - 1, z - 4, x - 2, top + 2, z - 2, f.ink);
    beam(v, [x - 3, top + 2, z - 3], [x - 1, top + 4, z - 3], f.gold);
    planter(v, hx - 5, 1, hz - 5);
  }
  if (lv >= 3) {
    const ex = hx - 8,
      ez = -hz + 6;
    const annex = plate(ex, ez, 5, 4, 0.38);
    storey(v, annex, annex, 1, 6, f.glass, f.porcelain);
    islandModel(v, ex - 4, 7, ez - 3, 7, 5);
  }
  if (lv >= 4) {
    for (let t = 0; t <= 33; t++) {
      const a = 0.15 + (2.6 * t) / 33;
      const xx = x + Math.round((rx + 2) * Math.cos(a)),
        zz = z + Math.round((rz + 2) * Math.sin(a));
      v.box(xx, 2 + Math.floor(t / 10), zz, xx + 2, 3 + Math.floor(t / 10), zz + 2, f.cedar);
      if (t % 4 === 0) v.box(xx, 1, zz, xx + 1, 4 + Math.floor(t / 10), zz + 1, f.bronze);
    }
  }
  if (lv === 5) {
    const top = layers * 3,
      px = x - 4,
      pz = z - 4;
    v.cylinderY(px, pz, top, top + 2, 5, f.silver);
    for (const sign of [-1, 1]) v.box(px + sign * 3, top + 2, pz, px + sign * 3 + 1, top + 7, pz + 1, f.bronze);
    v.cone(px + 0.5, top + 7, top + 10, pz + 0.5, 5, 1, f.garden);
    person(v, px, top + 2, pz, "blue");
    for (const xx of [-hx + 5, hx - 5]) planter(v, xx, 1, hz - 6, 2);
  }
}
function drawingBoard(c: Ctx) {
  const { v, lv, hx, hz } = c,
    w = byLv(c, [13, 17, 22, 25, 31]),
    d = byLv(c, [9, 12, 15, 19, 22]);
  const x = -Math.floor(w / 2) - (lv >= 3 ? 3 : 0),
    z = -Math.floor(d / 2) - 2,
    base = byLv(c, [3, 5, 7, 9, 11]);
  const surface = (dx: number) => base + Math.round(dx * (lv >= 3 ? 0.57 : 0.44));
  for (let dx = 0; dx < w; dx++)
    for (let dz = 0; dz < d; dz++) {
      const edge = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
      const street = dx % 7 === 3 || dz === Math.round(d * 0.35 + Math.sin((dx / w) * 4) * d * 0.14);
      v.put(x + dx, surface(dx), z + dz, edge ? f.cedar : street ? "#d8e3d5" : "#48818a");
      if (edge) v.put(x + dx, surface(dx) - 1, z + dz, f.bronze);
    }
  for (const end of [z + 1, z + d - 2]) {
    beam(v, [x + 1, 1, end], [x + w - 3, surface(w - 3) - 1, end], f.ink, 2);
    beam(v, [x + w - 3, 1, end], [x + w - 3, surface(w - 3) - 1, end], f.bronze, 2);
  }
  const lowX = x + 2;
  v.box(lowX, 1, z + d - 2, lowX + 4, 4, z + d - 1, f.cedar);
  v.box(lowX + 1, 2, z + d - 1, lowX + 3, 3, z + d, f.amber, 0.7);
  entrance(c, lowX + 2, z + d, 3);
  if (lv >= 2) {
    const ex = x + Math.floor(w * 0.65);
    const bay = plate(ex, z + d * 0.5, 3, d * 0.33, 0.2);
    storey(v, bay, bay, 1, 6, f.glass, f.limestone);
    beam(v, [x + 2, surface(2) + 1, z + 3], [x + w - 3, surface(w - 3) + 1, z + 3], f.gold);
  }
  if (lv >= 3) {
    const ex = hx - 10,
      ez = -hz + 5;
    v.box(ex - 4, 1, ez - 1, ex + 5, 4, ez + 6, f.bronze);
    islandModel(v, ex - 4, 4, ez, 9, 5);
    for (const dx of [x + 4, x + 8]) v.box(dx, 1, z + d + 1, dx + 3, 4, z + d + 5, f.glass);
  }
  if (lv >= 4) {
    const px = x + w - 3,
      pz = z + d - 3,
      upper = surface(w - 3);
    v.box(px, upper + 1, pz, px + 2, upper + 8, pz + 2, f.copper);
    v.cone(px + 1, upper + 8, upper + 12, pz + 1, 2, 0.5, f.limestone);
    v.put(px + 1, upper + 12, pz + 1, f.ink);
    beam(v, [px, upper + 3, pz], [px, upper + 3, z - 1], f.silver);
  }
  if (lv === 5) {
    const sx = hx - 12,
      sz = hz - 14;
    for (let i = 0; i < 9; i++)
      v.box(sx + i, 4 + Math.floor(i / 2), sz, sx + i + 1, 5 + Math.floor(i / 2), sz + 10, i % 4 ? "#bed1c0" : f.glass);
    for (const dz of [sz + 1, sz + 8]) beam(v, [sx + 1, 1, dz], [sx + 7, 8, dz], f.ink, 2);
    v.box(x + w - 4, 7, z + d - 1, sx + 3, 8, sz + 3, f.limestone);
    person(v, sx + 1, 8, sz + 2, "red");
  }
}
function scrollWing(v: PixelVox, cx: number, cz: number, r: number, depth: number, unroll: number) {
  const cy = r + 2;
  // A paper spiral has a hollow center and a walkable wing at its outer edge.
  for (let i = 0; i <= 120; i++) {
    const t = i / 120,
      a = -Math.PI / 2 + t * Math.PI * 2.68,
      rr = r * (1 - t * 0.58);
    const xx = Math.round(cx + Math.cos(a) * rr),
      yy = Math.round(cy + Math.sin(a) * rr);
    for (let dz = 0; dz < depth; dz++) {
      const tone = dz === 0 || dz === depth - 1 ? f.limestone : dz % 6 === 2 ? "#7dabb0" : "#d1e3d6";
      v.put(xx, yy, cz + dz, tone);
    }
  }
  v.box(cx, 2, cz, cx + unroll, 3, cz + depth, "#b9d8ca");
  for (let dx = 1; dx < unroll - 1; dx++)
    for (let dz = 1; dz < depth - 1; dz++)
      if (dx % 6 === 0 || dz === Math.round(depth * 0.53 + Math.sin(dx * 0.6))) v.put(cx + dx, 2, cz + dz, "#649798");
}
function rolledMap(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [4, 6, 8, 10, 13]),
    depth = byLv(c, [8, 10, 14, 18, 22]);
  const x = lv >= 3 ? -8 : -4,
    z = -Math.floor(depth / 2) - 1;
  scrollWing(v, x, z, r, depth, byLv(c, [11, 14, 21, 25, 32]));
  const front = z + depth;
  entrance(c, x, front, 2);
  v.box(x - 1, 2, front - 3, x + 2, 3, front, f.cedar);
  v.put(x, 3, front - 2, f.amber, 0.75);
  if (lv >= 2) {
    v.box(x - r + 1, r + 2, z + 1, x + 1, r + 3, front, f.cedar);
    glassFront(v, x - r + 2, x, r + 3, r + 6, front - 3, f.bronze, 3, f.amber);
    person(v, x - 2, r + 3, front - 2, "teal");
  }
  if (lv >= 3) {
    islandModel(v, x + 7, 3, z + 2, Math.min(10, hx - 5), depth - 4);
    bench(v, x + 5, 1, front + 3, "x", "oak");
  }
  if (lv >= 4) {
    const ex = hx - 9,
      ez = -hz + 3;
    scrollWing(v, ex, ez, 5, 9, 7);
    v.box(ex - 2, 4, ez + 2, ex + 1, 5, ez + 9, f.cedar);
    entrance(c, ex + 4, ez + 9, 2);
  }
  if (lv === 5) {
    for (let j = 0; j < 9; j++) v.box(4 + j, 1, front - 2 - j, 6 + j, 2 + j, front + 1 - j, f.limestone);
    v.box(x + 2, 9, z + 2, 14, 10, z + 5, f.cedar);
    for (let i = 0; i < 5; i++) v.box(x + 3 + i * 4, 10, z + 4, x + 4 + i * 4, 13, z + 5, f.bronze);
    planter(v, hx - 6, 1, hz - 8, 2);
  }
}
export function planningBureau(c: Ctx) {
  [tripod, contours, drawingBoard, rolledMap][c.variant](c);
}
