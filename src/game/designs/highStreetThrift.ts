import { type Ctx, byLv, person, bench } from "./kit";
import { beam } from "./sculpturalKit";
import { override } from "./commerceIcons";
import { bulbs, spinner } from "./commerceKit";
import { frontage, counter, shopWindow } from "./highStreetParts";

const patchColors = ["#a84754", "#d69f58", "#4e8d83", "#5a6486", "#d7bdaa", "#9c7394"];
// The roof is a sheet of stitched quilt blocks. Corners lift to show street stalls beneath.
function quilt(c: Ctx) {
  const { v, hx, hz, lv } = c,
    width = byLv(c, [8, 12, 19, 23, 29]),
    depth = byLv(c, [7, 9, 10, 17, 20]);
  const x0 = -Math.floor(width / 2),
    z0 = -Math.floor(depth / 2) - 1,
    peak = byLv(c, [6, 9, 12, 15, 19]);
  for (let xi = 0; xi < width; xi++)
    for (let zi = 0; zi < depth; zi++) {
      const u = xi / (width - 1),
        t = zi / (depth - 1);
      const fold = Math.abs(2 * u - 1);
      const y =
        peak -
        Math.round((1 - fold) * 3 + Math.sin(Math.PI * t) * 2) -
        (u > 0.5 && t > 0.5 ? Math.round((t - 0.5) * 6) : 0);
      const block = lv <= 2 ? 4 : 6;
      const check = (Math.floor(xi / block) + Math.floor(zi / block) * 3) % 6;
      const stitch = (xi % block === 0 && zi % 3 === 0) || (zi % block === 0 && xi % 3 === 0);
      v.put(x0 + xi, y, z0 + zi, stitch ? "#ead8bc" : patchColors[check]);
      if ((xi === 0 || xi === width - 1) && (zi === 0 || zi === depth - 1))
        v.box(x0 + xi, 1, z0 + zi, x0 + xi + 1, y, z0 + zi + 1, "oak");
      if (zi === 0 || (xi === 0 && lv >= 2))
        for (let dy = 1; dy < y; dy++) v.put(x0 + xi, dy, z0 + zi, patchColors[(check + (dy >> 2)) % 6]);
      if (zi === depth - 1 && xi % 2 === 0) v.put(x0 + xi, y - 1, z0 + zi, patchColors[check]);
    }
  counter(c, x0 + 1, z0 + depth - 2, Math.min(8, width - 2), "tealDark");
  if (lv >= 2) {
    v.box(x0 + 1, 1, z0 + 2, x0 + 4, 4, z0 + 6, "#9b6756");
    v.ringZ(x0 + 2, 5, z0 + 4, z0 + 5, 1.8, 0.8, "brass");
  }
  if (lv >= 3) {
    for (let x = hx - 7; x < hx - 2; x++) {
      v.put(x, 4, 2, "woodDark");
      v.box(x, 2, 2, x + 1, 4, 3, patchColors[(x + 12) % 6]);
    }
    beam(v, [hx - 7, 1, 2], [hx - 7, 5, 2], "oak");
  }
  if (lv >= 4) {
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * 5;
      v.box(x, 1, hz - 7, x + 4, 3, hz - 5, patchColors[i]);
      v.box(x, 3, hz - 7, x + 4, 4, hz - 5, "cream");
    }
  }
  if (lv === 5) {
    const x = -hx + 3;
    for (let z = -9; z <= 8; z++) {
      const y = 6 + Math.abs(((z + 9) % 6) - 3);
      v.box(x, y, z, x + 7, y + 1, z + 1, patchColors[Math.floor((z + 9) / 3) % 6]);
      if (z % 6 === 0) v.box(x, 1, z, x + 1, y, z + 1, "oak");
    }
    bulbs(v, x0, z0 + depth, x0 + width - 1, z0 + depth, peak - 4);
  }
}

function luggage(c: Ctx) {
  const { v, lv, hx, hz } = c,
    w = byLv(c, [8, 11, 16, 20, 24]),
    d = byLv(c, [5, 7, 8, 10, 12]),
    h = byLv(c, [3, 5, 7, 9, 11]);
  const bx = lv >= 3 ? -4 : 0,
    x = bx - Math.floor(w / 2),
    z = -Math.floor(d / 2) - 2;
  v.hollowBox(x, 1, z, x + w, h + 1, z + d, "#ad7958", "#714b3d");
  for (const offset of [2, w - 3]) {
    v.box(x + offset, 1, z - 1, x + offset + 1, h + 1, z + d + 1, "#4b463c");
    v.box(x + offset - 1, h - 1, z + d, x + offset + 2, h + 1, z + d + 1, "brass");
  }
  const hinge = z;
  for (let rise = 0; rise < d; rise++) {
    const zz = hinge - Math.floor(rise * (lv === 1 ? 0.28 : 0.2));
    v.box(x, h + rise, zz, x + w, h + rise + 1, zz + 2, "#6c493e");
    v.box(x + 1, h + rise, zz + 1, x + w - 1, h + rise + 1, zz + 2, rise % 4 === 0 ? "#ae9974" : "#d3b992");
  }
  v.box(x + 2, h, z + 2, x + w - 2, h + 1, z + d - 1, "#c96c66");
  v.ringZ(bx, h + d + 1, hinge - 2, hinge, Math.max(1.5, w * 0.17), Math.max(0.8, w * 0.17 - 1), "#493e36");
  if (lv >= 2) shopWindow(c, x + 1, 1, z + d, w - 2, "woodDark");
  if (lv >= 3) {
    const ex = hx - 6;
    v.hollowBox(ex - 3, 1, -2, ex + 3, 6, 4, "#487d75", "brass");
    v.box(ex - 2, 6, -3, ex + 2, 7, 5, "#435e54");
  }
  if (lv >= 4) {
    v.box(x, 1, hz - 8, bx + 3, 3, hz - 3, "#764d43");
    v.box(x - 1, 3, hz - 9, bx + 4, 4, hz - 3, "#cba86c");
    v.box(x, 4, hz - 8, bx, 7, hz - 6, "#47746b");
  }
  if (lv === 5) {
    const sx = hx - 9;
    for (let i = 0; i < 4; i++) {
      const shift = i % 2 === 0 ? 0 : -2,
        base = 1 + i * 4;
      v.hollowBox(sx - 5 + shift, base, -7, sx + 5 + shift, base + 4, 1, patchColors[i], "woodDark");
      v.box(sx - 1 + shift, base + 2, 1, sx + 2 + shift, base + 3, 2, "brass");
    }
    person(v, -hx + 4, 1, hz - 4, "red");
  }
}

function chair(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = lv >= 3 ? -3 : 0,
    z = lv >= 4 ? -3 : 0;
  const w = byLv(c, [3, 4, 5, 7, 9]),
    seat = byLv(c, [4, 6, 8, 10, 13]),
    back = byLv(c, [14, 17, 21, 26, 30]);
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      beam(
        v,
        [x + side * w, 1, z + end * w],
        [x + side * (w - 1), seat, z + end * (w - 1)],
        "woodDark",
        lv >= 4 ? 2 : 1,
      );
    }
  v.box(x - w, seat, z - w, x + w + 1, seat + 2, z + w + 1, "#b46758");
  // Tall fan-back spindles and curved wooden runners read as a chair even at the yard-sale tier.
  for (let i = -w; i <= w; i += 2) {
    const crest = back - Math.round((Math.abs(i) / w) * 3);
    const upperX = x + i + Math.round((i / w) * 2);
    beam(v, [x + i, seat + 1, z - w], [upperX, crest, z - w - 2], "#9d704b");
  }
  for (let i = -w - 2; i <= w + 2; i++) {
    const crest = back - Math.round((Math.abs(i) / (w + 2)) * 3);
    v.box(x + i, crest - 1, z - w - 2, x + i + 1, crest + 1, z - w, "#ae835b");
  }
  for (const side of [-1, 1])
    for (let i = -w - 1; i <= w + 1; i++) {
      v.put(x + side * w, 1 + Math.round((i / (w + 1)) ** 2 * 2), z + i, "woodDark");
    }
  counter(c, x - Math.min(w, 3), z + w - 1, Math.min(6, w * 2), "tealDark");
  if (lv >= 2) {
    for (const side of [-1, 1]) {
      v.box(x + side * w, seat + 2, z + 1, x + side * w + 1, seat + 5, z + 3, "woodDark");
      v.box(x + side * w, seat + 4, z - w, x + side * w + 1, seat + 5, z + 3, "oak");
    }
  }
  if (lv >= 3) {
    const px = hx - 6;
    v.cylinderY(px, 2, 1, 2, 3, "brass");
    v.box(px, 2, 2, px + 1, 9, 3, "brass");
    v.cone(px + 0.5, 8, 13, 2.5, 3.5, 1.5, "#dfb776");
  }
  if (lv >= 4) {
    v.hollowBox(x - w + 1, seat + 2, z - w + 2, x + w, seat + 6, z + 2, "#a6a791");
    shopWindow(c, x - w + 1, seat + 2, z + 2, w * 2 - 1, "#5c6860");
  }
  if (lv === 5) {
    const sx = hx - 11;
    v.hollowBox(sx - 4, 1, -hz + 3, sx + 5, 10, -hz + 11, "#4c857c");
    for (let y = 2; y <= 8; y += 3) {
      v.box(sx - 3, y, -hz + 11, sx + 4, y + 2, -hz + 9 + y / 3, "#b38357");
      v.put(sx, y + 1, -hz + 11, "brass");
    }
    v.ringZ(sx, 13, -hz + 6, -hz + 4, 4, 3, "brass");
  }
}

function market(c: Ctx) {
  const { v, hx, hz, lv } = c,
    n = byLv(c, [1, 2, 3, 5, 7]),
    radius = byLv(c, [0, 3, 7, 8, 12]),
    colors = ["#e2b268", "#539c99", "#bd6572", "#7c80a8"];
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : Math.PI * (0.12 + (i * 1.7) / (n - 1)),
      x = lv === 1 ? -3 : Math.round(radius * Math.cos(a)),
      z = Math.round(radius * 0.65 * Math.sin(a)) - Math.floor(hz * 0.22);
    const half = lv >= 4 ? 3 : i % 2 === 0 ? 4 : 2,
      depth = lv === 1 ? 3 : 2;
    for (let dx = -half; dx <= half; dx++)
      for (let dz = -depth; dz <= depth; dz++) {
        const yy = 5 + Math.max(0, depth - Math.abs(dz));
        const cloth = Math.floor((dx + half) / 2) % 2 === 0 ? colors[i % 4] : "cream";
        v.put(x + dx, yy, z + dz, cloth);
        if (dz === depth && dx % 2 === 0) v.put(x + dx, yy - 1, z + dz, cloth);
      }
    for (const side of [-half + 1, half - 1]) v.box(x + side, 1, z - 1, x + side + 1, 7, z, "wood");
    counter(c, x - half + 1, z + 1, 2 * half - 1, colors[i % 4]);
    v.put(x + 1, 4, z + 1, i % 2 === 0 ? "brass" : "teal");
  }
  if (lv === 1) {
    v.hollowBox(2, 1, 1, 6, 3, 4, "woodLight");
    v.put(3, 3, 2, "teal");
    v.put(4, 3, 2, "brass");
  }
  if (lv >= 2) bench(v, -hx + 2, 1, hz - 3);
  if (lv >= 3) {
    const mastZ = -hz + 3;
    v.box(0, 1, mastZ, 2, 13, mastZ + 2, "wood");
    beam(v, [0, 12, mastZ], [hx - 5, 6, 0], "brass");
  }
  if (lv >= 4) {
    const r = lv === 5 ? 6 : 4;
    v.cylinderY(0, 1, 1, 3, r, "woodLight");
    for (const x of [-r + 1, r - 1]) v.box(x, 3, 0, x + 1, 12, 1, "brass");
    v.cone(0, 11, 16, 1, r + 1, 0.5, "#c07671");
  }
  if (lv === 5) {
    const signs = spinner(c, 0, 18, 1, "y", 0.45);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      beam(signs, [0, 0, 0], [5 * Math.cos(a), 0, 5 * Math.sin(a)], "brass");
      signs.put(5 * Math.cos(a), 1, 5 * Math.sin(a), colors[i]);
    }
    v.box(0, 15, 1, 1, 18, 2, "brass");
    for (let i = 0; i < 3; i++) person(v, -3 + i * 4, 1, hz - 5, "teal");
  }
}
override(
  "thrift_stores",
  (c) => {
    frontage(c, "path2");
    [quilt, luggage, chair, market][c.variant](c);
  },
  ["Yard Sale", "Secondhand Shop", "Curiosity Exchange", "Vintage Courtyard", "Great Flea Bazaar"],
  "A few finds on a table become a shop, an outdoor exchange and a bazaar for the whole district.",
);
