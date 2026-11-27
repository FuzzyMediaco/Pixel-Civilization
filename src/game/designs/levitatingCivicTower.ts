import { bench, door, lamp, person, type Ctx } from "./kit";
import { disc, sculpt } from "./commerceKit";
import { beam, entrance, facade, finish, loop, oval, plate, planter, slab, TAU, type Point } from "./sculpturalKit";

const steel = "#304555", enamel = "#e4e8d8", brass = "#cfa46b";
const coreLight = "#8ef9e2", coil = "#35bccc", smokedGlass = "#316879";
const lowerHeights = [9, 13, 17, 31, 43];
const airGaps = [17, 19, 22, 26, 32];
const floors = [2, 3, 5, 8, 12];

/** Magnet coils sit on the two facing surfaces, with open air between them. */
function inductionField(c: Ctx, x: number, z: number, radius: number, roof: number, underside: number) {
  const { v, lv } = c;
  for (const [y, direction] of [[roof + 1, 1], [underside - 1, -1]]) {
    disc(v, x, z, y, y + 1, radius + 1, steel, radius - 1.8);
    disc(v, x, z, y + direction, y + direction + 1, radius,
      (_x, _y, _z, _d, a) => [Math.cos(a * 8) > .55 ? enamel : coreLight, .95], radius - 1.2);
    disc(v, x, z, y + direction * 2, y + direction * 2 + 1, radius * .64,
      (_x, _y, _z, _d, a) => Math.sin(4 * a) > -.72 ? [coil, .8] : null, radius * .64 - 1);
    if (lv >= 3) disc(v, x, z, y + direction * 3, y + direction * 3 + 1, radius * .37,
      (_x, _y, _z, _d, a) => Math.sin(3 * a) > -.4 ? [coreLight, 1.2] : null, radius * .37 - 1);
  }
}

function publicEntry(c: Ctx, x: number, front: number, accent: string) {
  const { v, lv } = c;
  x = Math.round(x); front = Math.round(front);
  const w = 3 + Math.floor(lv / 2);
  entrance(c, x, front, w, finish.limestone);
  v.box(x - w - 2, 0, front, x + w + 3, 1, front + 4, finish.porcelain);
  door(v, x - 1, 1, front, finish.nightGlass, 3, 4);
  v.box(x - w, 5, front - 1, x + w + 1, 6, front + 3, accent);
  for (const side of [-1, 1]) {
    lamp(v, x + side * (w + 1), 1, front + 3, 3, steel, "#ffdaa0");
    if (lv >= 2) planter(v, x + side * (w + 4), 1, front + 2, 1);
  }
  if (lv >= 3) {
    bench(v, x - w - 3, 1, front + 5, "z", brass);
    person(v, x + 2, 1, front + 4, "#c27451");
  }
}

/** The supporting office and the hanging annular chamber share the same vertical lightwell. */
function orbitCouncil(c: Ctx, roof: number, upper: number, storeys: number) {
  const { v, hx, lv } = c;
  const base = Math.round(hx * (lv === 5 ? .42 : .42 + lv * .016));
  const r = Math.round(hx * (lv === 5 ? .54 : .56 + lv * .018)), pitch = lv >= 4 ? 5 : 4;
  const drum = oval(0, 0, base, base);
  facade(v, drum, 1, roof - 1, "#588781", brass, 4);
  slab(v, drum, 0, 1, enamel);
  for (let h = 5; h < roof; h += 6) {
    loop(v, drum, h, "#ad8961");
    if (h > 5) for (const offset of [-3, 0, 3]) {
      v.put(offset + (Math.floor(h / 6) % 2), h - 2, base - 1, "#e6c193", .48);
    }
  }
  disc(v, 0, 0, roof - 1, roof + 1, base + 1, brass);
  publicEntry(c, 0, base - 1, brass);
  inductionField(c, 0, 0, base * .83, roof, upper);
  const hole = Math.max(4, Math.round(r * .55));
  for (let f = 0; f < storeys; f++) {
    const y = upper + f * pitch;
    const radius = r + (f % 3 === 1 ? 1 : 0);
    if (f === 0) disc(v, 0, 0, y, y + 1, r + 1, steel, hole - 1);
    for (const wall of [radius, hole]) {
      disc(v, 0, 0, y + 1, y + pitch, wall, (_x, wy, _z, _d, a) => {
        const bay = ((a + Math.PI) / TAU) * (10 + 2 * lv);
        if (bay % 1 < .15) return steel;
        const lit = (Math.floor(bay) + 2 * f) % 5 === 1 && wy === y + 2;
        return lit ? ["#f0c381", .54] : ["#448887", .12];
      }, wall - 1.14);
    }
    disc(v, 0, 0, y + pitch, y + pitch + 1, radius + 1, enamel, radius - .7);
    disc(v, 0, 0, y + pitch, y + pitch + 1, hole + .6, brass, hole - .8);
  }
  const top = upper + pitch * storeys + 1;
  disc(v, 0, 0, top, top + 1, r + 1, "#b0a787", hole - 1.2);
  for (const side of [-1, 1]) {
    const a = Math.PI * side / 4, path = (r + hole) / 2;
    bench(v, Math.round(path * Math.sin(a)), top + 1, -Math.round(path * Math.cos(a)), "x", brass);
  }
  if (lv >= 2) {
    disc(v, 0, 0, top + 1, top + 2, r - 1, "#6e9a78", hole + 1);
    for (let n = 0; n < lv + 1; n++) {
      const a = n * TAU / (lv + 1), path = (hole + r) / 2;
      bench(v, Math.round(path * Math.cos(a)), top + 2, Math.round(path * Math.sin(a)), "x", brass);
    }
  }
  if (lv >= 3) {
    // Committee galleries occupy an arc of the roof; the rest remains an open public terrace.
    const rooms = lv - 1;
    for (let j = 0; j < rooms; j++) {
      const a = Math.PI + (j + .5) * Math.PI / rooms, distance = (r + hole) / 2;
      const x = Math.round(Math.cos(a) * distance), z = Math.round(Math.sin(a) * distance);
      const q = Math.max(2, (r - hole) * .43), h = lv === 5 && j === 1 ? 7 : 4;
      const room = oval(x, z, q, q, 12);
      facade(v, room, top + 1, h, smokedGlass, brass, 3);
      slab(v, room, top + 1 + h, 1, enamel);
    }
  }
  if (lv >= 4) {
    const y = upper + pitch * Math.floor(storeys / 2), z = r - 1;
    const balcony = plate(0, z, r * .59, 4, .55);
    slab(v, balcony, y, 1, brass);
    loop(v, balcony, y + 1, enamel);
    for (const side of [-1, 1]) planter(v, Math.round(side * r * .38), y + 1, z + 1);
  }
}

function cantileverSecretariat(c: Ctx, roof: number, upper: number, storeys: number) {
  const { v, hx, lv } = c;
  const rust = "#b75e49", cream = "#f1d3a0", w = Math.round(hx * .53), d = Math.round(hx * .37);
  const baseX = -Math.round(hx * .15), base = plate(baseX, 0, w, d, .34);
  facade(v, base, 1, roof - 1, "#596b70", rust, 4);
  slab(v, base, 0, 1, cream);
  for (let h = 4; h < roof; h += 5) loop(v, base, h, cream);
  slab(v, base, roof - 1, 2, rust);
  if (lv >= 2) {
    const annex = plate(w * .8, d * .8, w * .53, d * .58, .15);
    facade(v, annex, 1, 4, smokedGlass, brass, 3);
    slab(v, annex, 5, 1, cream);
  }
  publicEntry(c, baseX, d - 1, rust);
  inductionField(c, baseX, 0, d * .83, roof, upper);
  const length = Math.round(hx * .64), depth = Math.round(hx * .29);
  const interval = lv < 3 ? 1 : 2;
  for (let f = 0; f < storeys; f++) {
    const group = Math.floor(f / interval), side = group % 2 ? -1 : 1;
    const x = Math.round(side * hx * .22);
    const z = Math.round((group % 3 - 1) * depth * .46);
    const y = upper + f * 5;
    // The terrace end comes to a chisel point. The opposite side has a recessed corner balcony.
    const shape: Point[] = [
      [x - side * length, z - depth * .58], [x - side * length * .67, z - depth],
      [x + side * length * .68, z - depth], [x + side * length, z - depth * .12],
      [x + side * length * .61, z + depth], [x - side * length, z + depth],
    ];
    facade(v, shape, y + 1, 4, f % 2 ? "#6a9d9a" : "#417d85", steel, 3);
    const windowX = Math.round(x - side * length * .27);
    for (let j = -2; j <= 2; j++) {
      if (j !== 0) v.put(windowX + j, y + 2, z + depth - 1, "#ebd8ae", .52);
    }
    if (f % interval === 0) slab(v, shape, y, 1, rust);
    else loop(v, shape, y, cream);
    if ((f + 1) % interval === 0 || f === storeys - 1) slab(v, shape, y + 5, 1, cream);
    else loop(v, shape, y + 5, cream);
    // Exposed ends hold the projecting terraces; the dark cap outlines each cantilever.
    const tip = x + side * (length - 4);
    if ((f + 1) % interval === 0 || f === storeys - 1) {
      const ledge = Math.max(1, Math.round(depth * .4));
      v.box(tip - 1, y + 6, z - ledge, tip + 2, y + 7, z + ledge + 1, "#669674");
      if (lv >= 3) planter(v, tip, y + 7, z, 1);
      else bench(v, tip - 1, y + 7, z, "z", brass);
    }
  }
  const tier = Math.floor((storeys - 1) / interval), sign = tier % 2 ? -1 : 1;
  const y = upper + storeys * 5 + 1, x = sign * Math.round(hx * .22), z = Math.round((tier % 3 - 1) * depth * .46);
  if (lv >= 2) {
    const room = plate(x - sign * length * .27, z, length * .45, depth * .65, .30);
    facade(v, room, y, 3 + lv, smokedGlass, brass, 4);
    slab(v, room, y + 3 + lv, 1, rust);
  }
}

function skySail(c: Ctx, roof: number, upper: number, storeys: number) {
  const { v, hx, lv } = c;
  const sailGlass = "#508d9e", white = "#f2efdc", blue = "#315d79", radius = Math.round(hx * .67);
  const hull = plate(0, -1, radius * .83, radius * .5, .65);
  facade(v, hull, 1, roof - 1, sailGlass, blue, 4);
  for (let y = 5; y < roof - 1; y += 5) loop(v, hull, y, white);
  slab(v, hull, roof - 1, 2, white);
  publicEntry(c, 0, Math.round(radius * .5) - 2, blue);
  inductionField(c, 0, -1, radius * .48, roof, upper);
  const landing = plate(0, -1, radius * .64, radius * .52, .65);
  slab(v, landing, upper, 1, white);
  for (const side of [-1, 1]) {
    const n = side < 0 ? storeys + 1 : Math.max(2, storeys - Math.floor(lv / 2));
    const x = side * radius * .49, z = side * radius * .28;
    for (let f = 0; f < n; f++) {
      const t = f / n, y = upper + 1 + f * 5;
      const length = radius * (1.15 - .94 * t), breadth = radius * (.44 - .27 * t);
      const keel = x + side * radius * t * .26;
      const sail: Point[] = [[keel - breadth, z - side * length * .52], [keel, z + side * length * .62], [keel + breadth, z - side * length * .52]];
      facade(v, sail, y, 5, sailGlass, blue, 4);
      slab(v, sail, y + 4, 1, f % 3 === 1 ? "#82b3b5" : white);
      const [bx, bz] = sail[1];
      for (const [ax, az] of [sail[0], sail[2]]) {
        const u = f % 2 ? .50 : .21;
        beam(v, [ax + (bx - ax) * u, y + 2, az + (bz - az) * u],
          [ax + (bx - ax) * (u + .22), y + 2, az + (bz - az) * (u + .22)], "#ebd8ae", 1, .55);
      }
      for (const [xx, zz] of sail) beam(v, [xx, y, zz], [xx, y + 4, zz], white);
      if (f === n - 1) {
        beam(v, [keel, y + 4, z], [keel + side * 2, y + 7 + lv, z - side], white);
        v.put(keel + side * 2, y + 8 + lv, z - side, coreLight, .9);
      }
    }
  }
  if (lv >= 3) {
    // A glazed gallery spans the seam between the two occupied sails within the upper half.
    const deck = upper + 7;
    const bridge = plate(0, 0, radius * .53, 2, .05);
    facade(v, bridge, deck, 3, "#b5d4bd", blue, 3);
    slab(v, bridge, deck + 3, 1, white);
  }
}

function prismAssembly(c: Ctx, roof: number, upper: number, storeys: number) {
  const { v, hx, lv } = c;
  const violet = "#544b79", copper = "#cb875f";
  const width = Math.round(hx * (lv === 5 ? .72 : .48 + lv * .023));
  const base = Math.round(width * .67), off = Math.round(width * .55);
  for (const side of [-1, 1]) {
    const plan = plate(side * off, 0, base * .71, base, .49);
    facade(v, plan, 1, roof - 1, "#6d6787", violet, 3);
    for (let h = 4; h < roof; h += 5) loop(v, plan, h, copper);
    slab(v, plan, roof - 1, 2, copper);
  }
  const entryRoof = plate(0, 1, off, base * .67, .45);
  facade(v, entryRoof, 1, 5, smokedGlass, violet, 4);
  slab(v, entryRoof, 6, 1, enamel);
  publicEntry(c, 0, Math.round(1 + base * .67) - 1, violet);
  // Two independent emitter pairs meet a copper saddle bolted to the prism's pointed underside.
  for (const side of [-1, 1]) {
    inductionField(c, side * off, 0, base * .53, roof, upper);
    for (const z of [-1, 1]) {
      beam(v, [side * off, upper, z], [side * width * .22, upper + 3, z], copper, 2);
    }
  }
  const height = 11 + 4 * storeys, depth = Math.round(width * .80);
  sculpt(v, -width, upper, -depth, width, upper + height, depth,
    (u, h, w, x, y, z) => {
      const rx = Math.abs(2 * u - 1), rz = Math.abs(2 * w - 1);
      const edge = Math.max(rx, rz, (rx + rz) / 1.40);
      const waist = h < .49 ? .27 + 1.49 * h : 1 - .63 * (h - .49);
      if (edge > waist) return null;
      const band = (y - upper) % 5;
      const rib = Math.abs(rx - rz) < .045 || Math.abs(rx - rz * .4) < .024;
      if (rib || band === 0) return y - upper < height / 2 ? copper : "#bab5c8";
      if (band === 1) return violet;
      const bay = Math.floor((x - z) / 3) + Math.floor((y - upper) / 5);
      return bay % 7 === 0 ? ["#e3bc8a", .46] : [rx > rz ? "#7976a2" : "#486f89", .15];
    });
  const top = upper + height;
  if (lv >= 2) {
    const crown = plate(0, 0, width * .45, depth * .47, .65);
    facade(v, crown, top - 1, 3 + lv, "#ac98ae", violet, 3);
    slab(v, crown, top + 2 + lv, 1, copper);
  }
  if (lv >= 4) {
    const glass = plate(0, 0, width * .24, depth * .27, .7);
    facade(v, glass, top + 3 + lv, 4, smokedGlass, brass, 2);
    slab(v, glass, top + 7 + lv, 1, enamel);
  }
}

export function buildLevitatingCivicTower(c: Ctx) {
  const i = c.lv - 1, roof = lowerHeights[i];
  [orbitCouncil, cantileverSecretariat, skySail, prismAssembly][c.variant % 4](c, roof, roof + airGaps[i], floors[i]);
}
