import { type Ctx, type PixelVox, byLv, bench, person, ring } from "./kit";
import { band, bulbs, glassFront } from "./commerceKit";
import { beam, entrance, finish as f, oval, planter, slab } from "./sculpturalKit";

function welcome(c: Ctx, x: number, z: number) {
  const { v } = c;
  v.box(x - 1, 1, z, x + 3, 3, z + 2, "#487d75");
  v.box(x - 1, 3, z, x + 3, 4, z + 2, "#d8c09c");
  v.put(x + 2, 3, z + 1, "#f1bd76", 0.8);
  person(v, x, 1, z - 1, "teal");
  entrance(c, x + 1, z + 2, 1);
}

function bandshell(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [5, 8, 10, 13, 15]),
    height = byLv(c, [8, 10, 14, 18, 22]);
  const x = lv >= 3 ? -3 : lv === 2 ? -4 : 0,
    z = lv >= 3 ? -4 : -2,
    depth = byLv(c, [4, 5, 7, 8, 10]);
  // The stage and its listeners share a paved fan. Grass remains outside the curve.
  const seats = byLv(c, [4, 5, 8, 10, 16]);
  for (let dz = -depth; dz <= seats; dz++) {
    const width = Math.round(r * (dz < 0 ? 0.8 : 1 - 0.34 * (dz / seats) ** 2));
    v.box(x - width, 0, z + dz, x + width + 1, 1, z + dz + 1, dz % 5 === 0 ? "#c6aa90" : "#dbc5aa");
  }
  // Acoustic panels fan from the back wall to the audience. The wide opening faces the street.
  for (let dz = 0; dz < depth; dz++) {
    const t = dz / (depth - 1),
      w = Math.round(r * (0.52 + t * 0.48)),
      rz = z - depth + dz;
    const crown = height * (0.58 + t * 0.42);
    for (let dx = -w; dx <= w; dx++) {
      const arch = Math.sqrt(Math.max(0, 1 - (dx / w) ** 2)),
        y = 3 + Math.round(crown * arch);
      v.put(x + dx, y, rz, dz === depth - 1 ? "#dcbd91" : dz % 3 ? "#407f76" : "#719d87");
      if (dz === 0) v.box(x + dx, 2, rz, x + dx + 1, y, rz + 1, "#a87756");
      if (Math.abs(dx) === w) v.box(x + dx, 1, rz, x + dx + 1, y + 1, rz + 1, "#98684e");
      if (dz === depth - 1 && dx % 4 === 0) v.put(x + dx, y - 1, rz, "#edc586", 0.68);
    }
  }
  slab(v, oval(x, z, r + 1, Math.min(5, depth), 18), 1, 2, "#b58c64");
  for (let dx = -r + 1; dx < r; dx += 3) v.put(x + dx, 2, z + 1, "#cca178");
  person(v, x - 1, 3, z, "#a85554");
  v.box(x + 1, 3, z, x + 2, 7, z + 1, "iron");
  v.put(x + 1, 6, z + 1, "chrome");
  welcome(c, Math.min(hx - 4, x + r), Math.min(hz - 3, z + 5));
  if (lv >= 2) {
    const px = hx - 7;
    v.box(px - 2, 1, -4, px + 3, 4, 0, "#828f7e");
    v.box(px - 2, 4, -4, px + 3, 5, 0, f.limestone);
    for (let i = 0; i < 3; i++) v.put(px - 1 + i, 5, -2, i % 2 ? f.ink : f.amber, i % 2 ? 0 : 0.4);
    person(v, px - 1, 1, 1, "blue");
  }
  if (lv >= 3) {
    for (let row = 0; row < 2; row++) {
      const bz = z + 5 + row * 3;
      for (const sign of [-1, 1]) bench(v, x + sign * 5 - 1, 1, bz, "x", "oak");
    }
    band(v, x - 2, z - 2, 3, "brass");
  }
  if (lv >= 4) {
    const px = hx - 9,
      back = -hz + 3;
    v.box(px - 4, 1, back, px + 4, 7, back + 7, "#908775");
    glassFront(v, px - 3, px + 3, 2, 5, back + 6, f.bronze, 3, f.amber);
    for (let i = 0; i < 8; i++)
      v.box(px - 5 + i, 7 + Math.floor(i / 3), back - 1, px - 4 + i, 8 + Math.floor(i / 3), back + 8, "#748c7d");
    for (const bx of [x - r + 1, x + r - 1]) beam(v, [bx, 1, z + 2], [bx, height * 0.7, z - 1], f.bronze);
    person(v, x + 4, 3, z + 2, "blue");
  }
  if (lv === 5) {
    const centerZ = z + 2;
    for (let row = 0; row < 3; row++) {
      const rr = 9 + row * 3;
      for (let i = 0; i <= 32; i++) {
        const a = ((12 + i * 4.8) * Math.PI) / 180;
        const px = Math.round(x + rr * Math.cos(a)),
          pz = Math.round(centerZ + rr * 0.83 * Math.sin(a));
        if (Math.abs(px - x) < 2) continue;
        v.box(px, 1, pz, px + 2, row + 3, pz + 2, "#a08d75");
        v.put(px, row + 3, pz, "woodLight");
      }
    }
    for (const side of [-1, 1]) {
      v.box(x + side * 12, 1, z + 8, x + side * 12 + 1, 13, z + 9, f.cedar);
    }
    bulbs(v, x - 12, z + 8, x + 12, z + 8, 12, [f.amber, "#d18e7f"]);
  }
}
function hearth(v: PixelVox, x: number, z: number, r: number, tall: number) {
  // Brick oven open to the court. Its deep firebox, arch and chimney are visible from the street.
  for (let dx = -r; dx <= r; dx++)
    for (let dy = 0; dy < tall; dy++) {
      const t = (dy + 0.5) / tall;
      const profile = (dx / r) ** 2 + t * t;
      if (profile > 1.16) continue;
      const inside = Math.abs(dx) < r * 0.57 && dy < 3 + Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)) * tall * 0.23;
      const start = z - r + Math.round((Math.abs(dx) / r) * 2),
        end = z + r - Math.round((Math.abs(dx) / r) * 2);
      if (inside) {
        v.put(x + dx, 1 + dy, start, "#544441");
        if (dy === 1 && dx % 3 === 0) v.put(x + dx, 2, z, "#f1aa62", 0.85);
      } else {
        const tone = (dx + dy * 2) % 5 === 0 ? "#d29475" : "#ad6652";
        v.box(x + dx, 1 + dy, start, x + dx + 1, 2 + dy, end, tone);
      }
    }
  v.box(x - r + 1, 1, z + r - 1, x + r, 2, z + r + 1, "#c9b494");
}
function communalTable(v: PixelVox, x: number, z: number, w: number) {
  for (const bx of [x, x + w - 2]) v.box(bx, 1, z, bx + 1, 3, z + 2, f.cedar);
  v.box(x - 1, 3, z - 1, x + w, 4, z + 3, "#cc9d76");
  for (let off = 0; off < w - 1; off += 3) {
    v.put(x + off, 4, z, "cream");
    v.put(x + off, 4, z + 1, "#809575");
  }
  for (const side of [-2, 3]) v.box(x, 2, z + side, x + w - 1, 3, z + side + 1, f.cedar);
}
function cookhouse(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 4, 6, 7, 8]),
    h = byLv(c, [6, 8, 10, 13, 15]),
    x = lv === 1 ? -2 : lv === 2 ? -6 : -6,
    z = lv >= 3 ? -4 : -1;
  const patio = oval(x + Math.round(r * 0.55), z + 3, r + Math.min(lv + 3, 7), r + lv + 1, 12);
  slab(v, patio, 0, 1, "#d0b395");
  if (lv >= 3) v.box(-9, 0, hz - 13, hx - 3, 1, hz - 4, "#ddc8a7");
  hearth(v, x, z, r, h);
  // The front serving sill and low copper canopy make the oven a staffed kitchen.
  const passZ = z + r - 1;
  v.box(x - r + 1, 3, passZ, x + r, 4, passZ + 2, "#c09671");
  for (const side of [-1, 1]) v.box(x + side * (r - 1), 3, passZ, x + side * (r - 1) + 1, 6, passZ + 1, f.bronze);
  v.box(x - r + 1, 6, passZ - 1, x + r, 7, passZ + 2, "#b97954");
  v.put(x, 5, passZ, f.amber, 0.65);
  const chimneyX = x - Math.floor(r * 0.55),
    chimneyZ = z - Math.floor(r * 0.45),
    top = byLv(c, [9, 13, 15, 20, 24]);
  v.box(chimneyX, 4, chimneyZ, chimneyX + 3, top, chimneyZ + 3, "#a05f50");
  v.box(chimneyX - 1, top - 1, chimneyZ - 1, chimneyX + 4, top, chimneyZ + 4, f.limestone);
  c.smoke(chimneyX + 1, top, chimneyZ + 1, "steam");
  person(v, x + r, 1, z + r, "cream");
  welcome(c, lv === 1 ? 3 : hx - 5, lv >= 3 ? 6 : 3);
  if (lv >= 2) {
    const px = lv === 2 ? 3 : hx - 10,
      pz = lv === 2 ? -4 : -hz + 3;
    v.box(px - 3, 1, pz, px + 4, 4, pz + 3, "#719085");
    v.box(px - 3, 4, pz, px + 4, 5, pz + 3, "#d8c2a0");
    for (let n = 0; n < 2; n++) {
      v.cylinderY(px - 1 + n * 3, pz + 1, 5, 7, 1.3, f.silver);
      v.put(px - 1 + n * 3, 7, pz + 1, f.ink);
    }
    for (const end of [-3, 3]) v.box(px + end, 1, pz, px + end + 1, 9, pz + 1, f.bronze);
    v.box(px - 3, 8, pz, px + 4, 9, pz + 1, f.bronze);
  }
  if (lv >= 3) {
    communalTable(v, -8, hz - 7, 10);
    person(v, -6, 1, hz - 3, "#b15d50");
    for (let i = 0; i < 3; i++) v.box(x - r, 1, z - r - 2 + i, x + r, 2 + i, z - r - 1 + i, f.limestone);
  }
  if (lv >= 4) {
    const px = hx - 10,
      pz = -hz + 4;
    v.box(px - 5, 1, pz, px + 5, 8, pz + 1, "#9f9b7c");
    v.box(px + 4, 1, pz, px + 5, 8, pz + 7, "#9f9b7c");
    for (let dx = -5; dx <= 5; dx++)
      v.box(
        px + dx,
        9 + Math.round(Math.abs(dx) * 0.44),
        pz - 1,
        px + dx + 1,
        10 + Math.round(Math.abs(dx) * 0.44),
        pz + 6,
        dx % 3 === 0 ? f.cedar : "#7c9980",
      );
    v.box(px - 5, 1, pz + 5, px - 4, 11, pz + 6, f.cedar);
    person(v, px + 4, 1, pz + 5, "cream");
  }
  if (lv === 5) {
    const ex = hx - 10,
      ez = 3;
    hearth(v, ex, ez, 4, 8);
    v.box(ex + 2, 5, ez - 2, ex + 4, 15, ez, "#bb8066");
    c.smoke(ex + 3, 15, ez - 1, "steam");
    communalTable(v, 1, hz - 7, 11);
    communalTable(v, -8, hz - 12, 10);
    for (const xx of [-13, 14]) v.box(xx, 1, hz - 12, xx + 1, 9, hz - 11, f.cedar);
    bulbs(v, -13, hz - 12, 14, hz - 12, 8, [f.amber, "#da927f"]);
  }
}
function swimClub(c: Ctx) {
  const { v, lv, hx, hz } = c,
    w = byLv(c, [5, 8, 10, 13, 16]),
    d = byLv(c, [3, 4, 6, 7, 10]),
    x = lv >= 3 ? -2 : 0,
    z = lv >= 3 ? -1 : 0;
  const deckPlan = oval(x, z, w + 3.8, d + 4, 18);
  slab(v, deckPlan, 0, 1, "#c9b396");
  for (let dx = -w; dx <= w; dx += 4) v.box(x + dx, 0, z + d + 1, x + dx + 1, 1, z + d + 3, "#b49b80");
  // The waist in one edge reserves a dry toddler deck and makes the pool legible from the air.
  for (let dx = -w - 1; dx <= w + 1; dx++)
    for (let dz = -d - 1; dz <= d + 1; dz++) {
      const notch = dx > w * 0.08 && dz > d * 0.2 ? 0.26 : 0,
        dist = (dx / (w + 0.5)) ** 2 + (dz / (d + 0.5)) ** 2 + notch;
      if (dist > 1.35) continue;
      const pool = dist <= 0.88;
      v.put(x + dx, pool ? 1 : 2, z + dz, pool ? ((dx + dz) % 7 === 0 ? "#99cfca" : "#4ea7ac") : "#ded0af");
      if (!pool && dx % 5 === 0 && dz > 0) v.put(x + dx, 2, z + dz, "#f0d3a3", 0.55);
    }
  person(v, x - w + 1, 1, z - 2, "red");
  welcome(c, hx - 5, hz - 4);
  if (lv >= 2) {
    for (let px = x - w + 2; px < x + w - 2; px++) v.put(px, 2, z - 1, px % 4 < 2 ? "#d9b469" : "cream");
    const ex = lv === 2 ? -hx + 4 : x - w + 1;
    v.box(ex - 1, 1, z - 3, ex + 1, 8, z - 1, f.cedar);
    v.box(ex - 2, 8, z - 3, ex + 3, 9, z, f.porcelain);
    person(v, ex, 9, z - 2, "#bb5f54");
  }
  if (lv >= 3) {
    const ex = hx - 8,
      ez = -hz + 4;
    for (let i = 0; i < 3; i++) {
      v.box(ex - 4 + i * 3, 1, ez, ex - 2 + i * 3, 6, ez + 4, i % 2 ? "#bd8171" : "#698e91");
      v.put(ex - 3 + i * 3, 4, ez + 3, f.amber, 0.58);
    }
    v.box(ex - 5, 6, ez - 1, ex + 5, 7, ez + 5, "#d4c6a7");
    for (let dx = -4; dx <= 3; dx += 3) v.put(x + dx, 2, z + 2, "#f3d3a3");
  }
  if (lv >= 4) {
    const px = x - w + 1,
      pz = z - d + 2;
    for (const side of [-1, 1]) beam(v, [px + side * 4, 1, pz], [px + side, 14, pz], f.silver, 2);
    v.box(px - 3, 14, pz - 2, px + 7, 15, pz + 2, "#86a99b");
    v.put(px + 6, 14, pz + 1, f.amber, 0.65);
    for (let i = 0; i < 3; i++)
      v.box(x - 6, 1, hz - 5 - i * 2, x + 6, 2 + i, hz - 3 - i * 2, i % 2 ? f.limestone : "#c89775");
  }
  if (lv === 5) {
    const cz = z - d + 1;
    for (let dx = -w + 1; dx < w; dx++) {
      const rise = 6 + Math.round(10 * Math.sqrt(Math.max(0, 1 - (dx / w) ** 2)));
      for (let dz = 0; dz < 6; dz++) if (dx % 5 === 0 || dz === 0 || dz === 5) v.put(x + dx, rise, cz + dz, "#bfc5a2");
    }
    for (const sign of [-1, 1]) v.box(x + sign * (w - 1), 1, cz, x + sign * (w - 1) + 1, 11, cz + 1, f.cedar);
    for (let i = 0; i < 3; i++) {
      bench(v, -7 + i * 6, 2, hz - 5);
      person(v, -6 + i * 6, 3, hz - 5, "teal");
    }
    const spaX = x + w - 1,
      spaZ = z + d - 1;
    ring(v, spaX, spaZ, 1, 4, 3.8, 2.6, "#cdb398");
    v.cylinderY(spaX, spaZ, 2, 3, 2.6, "#97c7bc");
    c.smoke(spaX, 3, spaZ, "steam");
  }
}

function arbor(v: PixelVox, x: number, z: number, r: number, h: number, depth: number, blooms: boolean) {
  const crown = (dx: number) => h + Math.round(r * 0.9 * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)));
  for (const zz of [z, z + depth - 1]) {
    for (const side of [-1, 1]) v.box(x + side * r, 1, zz, x + side * r + 1, h + 1, zz + 1, f.cedar);
    for (let dx = -r; dx <= r; dx++) {
      const y = crown(dx);
      v.box(x + dx, y - 1, zz, x + dx + 1, y + 1, zz + 1, "#8a7157");
      if (dx % 3 !== 0) {
        v.put(x + dx, y + 1, zz, "#76a078");
        if (blooms && dx % 3 === 1) v.put(x + dx, y, zz + 1, "#c9838b");
      }
    }
  }
  for (let dx = -r; dx <= r; dx += 3) {
    const y = crown(dx);
    v.box(x + dx, y, z, x + dx + 1, y + 1, z + depth, "#6c8b61");
    for (let dz = 0; dz < depth; dz += 3) v.put(x + dx, y - 1, z + dz, "#8cad75");
  }
}
function bed(v: PixelVox, x: number, z: number, w: number, d: number, seed: number) {
  v.box(x, 1, z, x + w, 3, z + d, "#997b5f");
  v.box(x + 1, 2, z + 1, x + w - 1, 3, z + d - 1, "soilDark");
  for (let dx = 1; dx < w - 1; dx += 2)
    for (let dz = 1; dz < d - 1; dz += 2) {
      v.put(x + dx, 3, z + dz, (dx + dz + seed) % 3 === 0 ? "#ba7a87" : "#8dae77");
      if ((dx + dz + seed) % 5 === 0) v.put(x + dx, 4, z + dz, "#e5bd77");
    }
}
function gardenRoom(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 4, 6, 7, 8]),
    h = byLv(c, [4, 5, 7, 9, 11]),
    depth = byLv(c, [3, 5, 7, 10, 12]);
  const x = lv >= 2 ? -Math.round(hx * 0.43) : -2,
    z = lv >= 3 ? -hz + 4 : -4;
  // Gravel walks meet at the staffed seed exchange. Bed edges stay clear of the route.
  v.box(x - 1, 0, z, x + 2, 1, hz, "#cbbea0");
  const crossZ = lv >= 3 ? 4 : 1;
  v.box(x - 1, 0, crossZ, hx - 3, 1, crossZ + 2, "#cbbea0");
  arbor(v, x, z, r, h, depth, lv >= 2);
  if (lv === 1) {
    v.box(x - r, 1, z + depth, x - r + 2, 6, z + depth + 1, "#8a7057");
    for (let i = 0; i < 3; i++) v.put(x - r, 2 + i, z + depth, "#d7bea0");
    v.put(x - r + 1, 4, z + depth, "#e3c385", 0.65);
  }
  bed(v, x - r + 1, z + 1, Math.max(4, r), Math.max(3, depth - 2), 0);
  welcome(c, lv === 1 ? 3 : hx - 5, lv >= 3 ? 5 : 2);
  if (lv >= 2) {
    bed(v, 0, -4, 6, 5, 1);
    const px = lv === 2 ? 7 : 3;
    v.box(px - 1, 1, -5, px + 2, 7, -2, f.cedar);
    for (let yy = 2; yy <= 5; yy += 2) {
      v.box(px - 1, yy, -2, px + 2, yy + 1, -1, "#d9bc91");
      v.put(px, yy + 1, -2, "#5f7f78");
    }
    person(v, px - 1, 1, 0, "#ba7762");
  }
  if (lv >= 3) {
    const ex = hx - 7,
      ez = -hz + 5;
    arbor(v, ex, ez, 4, 5, 5, true);
    bed(v, ex - 3, ez + 6, 6, 4, 2);
    for (let i = 0; i < 2; i++) bench(v, -4 + 6 * i, 1, hz - 4, "x", "oak");
  }
  if (lv >= 4) {
    const cx = 3,
      cz = 3;
    for (let i = 0; i < 5; i++) {
      const a = ((40 + i * 61) * Math.PI) / 180,
        px = cx + Math.round(7 * Math.cos(a)),
        pz = cz + Math.round(5 * Math.sin(a));
      bed(v, px - 2, pz - 1, 4, 4, i);
    }
    v.cylinderY(cx, cz, 1, 2, 3.6, f.limestone);
    v.box(cx, 2, cz, cx + 1, 11, cz + 1, f.cedar);
    v.sphere(cx, 11, cz, 4, 3, 4, "#699467");
    v.put(cx - 2, 10, cz + 3, "#e4bf86", 0.6);
  }
  if (lv === 5) {
    const ex = 5,
      ez = hz - 10;
    arbor(v, ex, ez, 7, 6, 6, true);
    communalTable(v, ex - 4, ez + 2, 7);
    v.box(x + r - 2, h + 1, z + depth - 2, ex + 4, h + 2, z + depth, "#b29a76");
    for (let i = 0; i < 4; i++)
      v.box(x + r + i * 4, h + 2, z + depth - 1, x + r + i * 4 + 1, h + 4, z + depth, f.bronze);
    planter(v, hx - 5, 1, hz - 4, 2);
    person(v, ex + 4, 1, ez + 5, "blue");
  }
}
export function buildCommunityCenter(c: Ctx) {
  [bandshell, cookhouse, swimClub, gardenRoom][c.variant](c);
}
