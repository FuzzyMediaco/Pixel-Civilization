import { type Ctx, byLv, person, bench } from "./kit";
import { spinner } from "./commerceKit";
import { beam } from "./sculpturalKit";
import { counter, frontage, shopWindow } from "./highStreetParts";

function hanger(c: Ctx) {
  const { v, hx, hz, lv } = c,
    half = byLv(c, [3, 4, 7, 8, 10]),
    h = byLv(c, [6, 10, 13, 18, 23]);
  const x = lv >= 3 ? -3 : 0,
    z = lv >= 4 ? -3 : -1,
    depth = byLv(c, [2, 3, 3, 5, 6]);
  for (let y = 1; y <= h; y++) {
    const shoulder = y > h * 0.63,
      w = shoulder ? half + Math.ceil(half * 0.38) : half;
    const neck = y > h * 0.76 ? Math.max(1, Math.round((y - h * 0.76) * 0.63)) : 0;
    for (let dx = -w; dx <= w; dx++) {
      if (Math.abs(dx) < neck || (shoulder && Math.abs(dx) > half && y > h - (Math.abs(dx) - half))) continue;
      const col =
        y === 1 || y === h || (neck && Math.abs(dx) === neck) ? "#e9bb8f" : Math.abs(dx) > half ? "#9c4454" : "#cd626f";
      if (Math.abs(dx) === w || y === h || y === 1) v.box(x + dx, y, z - depth, x + dx + 1, y + 1, z + depth + 1, col);
      else for (const side of [-1, 1]) v.put(x + dx, y, z + side * depth, col);
    }
  }
  beam(v, [x - half, h - 1, z], [x, h + 3, z], "brass");
  beam(v, [x, h + 3, z], [x + half, h - 1, z], "brass");
  v.ringZ(x + 0.5, h + 5, z, z + 1, 2.5, 1.4, "brass");
  v.clear(x - 3, h + 2, z, x - 1, h + 5, z + 1);
  shopWindow(c, x - half + 1, 1, z + depth, Math.max(5, half * 2 - 2), "#633f59");
  if (lv >= 2) {
    v.box(x - half - 1, 4, z + depth, x + half + 2, 5, z + depth + 3, "cream");
  }
  if (lv >= 3) {
    const ax = hx - 6;
    beam(v, [ax - 2, 5, -3], [ax + 3, 5, -3], "brass");
    for (let i = 0; i < 3; i++) v.box(ax - 2 + i * 2, 2, -3, ax - 1 + i * 2, 5, -2, ["red", "indigo", "teal"][i]);
  }
  if (lv >= 4) {
    v.box(x - half - 1, 8, z + depth, x + half + 2, 9, z + depth + 4, "mortar");
    person(v, x, 9, z + depth + 2, "blue");
  }
  if (lv === 5) {
    for (const side of [-1, 1]) {
      const dx = side * (half - 1);
      beam(v, [x + dx, 1, hz - 5], [x + dx, 8, hz - 5], "brass");
      beam(v, [x + dx, 8, hz - 5], [x + dx, 11, z + depth], "cream");
    }
    v.box(x - half, 1, hz - 7, x + half + 1, 2, hz - 3, "#be7171");
  }
}

function tailor(c: Ctx) {
  const { v, hx, hz, lv } = c,
    x = lv >= 3 ? -5 : -1,
    z = lv >= 4 ? -4 : -1,
    r = byLv(c, [2, 3, 4, 5, 6]);
  const h = byLv(c, [5, 8, 11, 15, 19]);
  for (let y = 1; y <= h; y++)
    v.cylinderY(
      x,
      z,
      y,
      y + 1,
      y < 3 || y > h - 2 ? r + 1 : r,
      y < 3 || y > h - 2 ? "woodLight" : y % 3 === 0 ? "#74599b" : "#a286bf",
    );
  const armX = x + r + 2,
    needleZ = z + 1;
  beam(v, [x, h - 1, z], [armX + 2, h - 1, needleZ], "#295a58", 2);
  v.box(armX + 1, 3, needleZ, armX + 3, h, needleZ + 2, "#325f5c");
  v.box(armX, 3, needleZ - 1, armX + 4, 4, needleZ + 3, "gold");
  // A work light along the needle plate lets the sewing station read after dark.
  v.box(armX, 3, needleZ + 2, armX + 2, 4, needleZ + 3, "gold", 0.75);
  if (lv >= 2) {
    const wheel = spinner(c, x, h + 1, z, "z", 0.5);
    wheel.ringZ(0, 0, 0, 2, r - 0.4, Math.max(0, r - 1.7), "brass");
    beam(wheel, [-r + 1, 0, 0], [r - 1, 0, 0], "brass");
    beam(v, [armX, 5, z], [armX, 2, z], "chrome");
    counter(c, armX - 3, z + 3, 4, "tealDark");
  }
  if (lv >= 3) {
    const ex = hx - 6;
    v.box(ex - 4, 1, z + 1, ex + 4, 3, z + 6, "woodDark");
    v.box(ex - 4, 3, z + 1, ex + 4, 4, z + 6, "cream");
    for (let i = 0; i < 7; i++) v.put(ex - 4 + i, 4, z + 4 + (i % 2), "#c66169");
  }
  if (lv >= 4) {
    const pz = hz - 7;
    v.cylinderY(3, pz, 1, 6, r - 1, "#b45a67");
    v.cylinderY(3, pz, 6, 7, r, "woodLight");
    beam(v, [x, h - 2, z + r], [3, 6, pz], "#c178a3");
  }
  if (lv === 5) {
    v.box(5, 1, -hz + 4, 8, 15, -hz + 1, "#325f5c");
    beam(v, [6, 15, -hz + 2], [armX, 15, 0], "#325f5c", 3);
    beam(v, [armX, 15, 0], [armX, 3, 0], "silver");
    v.box(-5, 0, 6, 2, 1, hz, "#9b6788");
    person(v, -2, 1, hz - 4, "cream");
  }
}

function runway(c: Ctx) {
  const { v, hx, hz, lv } = c,
    len = byLv(c, [7, 10, 17, 20, 24]),
    width = byLv(c, [3, 4, 4, 6, 7]),
    back = -hz + 2;
  const alongX = lv === 3,
    span = alongX ? Math.min(len, hx * 2 - 4) : Math.min(len, hz * 2 - 4);
  const x0 = alongX ? -Math.floor(span / 2) : -Math.floor(width / 2),
    x1 = alongX ? x0 + span : x0 + width;
  const z0 = alongX ? -2 : back,
    z1 = alongX ? z0 + width : z0 + span;
  v.box(x0, 1, z0, x1, 3, z1, "#554452");
  v.box(x0, 3, z0, x1, 4, z1, "#e287a1");
  for (const x of [x0, x1 - 1]) for (let z = z0; z < z1; z += 3) v.put(x, 3, z, "warmGlow", 0.8);
  v.box(x0 - 2, 1, z0, x0, 5, z0 + 3, "#9c6380");
  person(v, Math.floor((x0 + x1) / 2), 4, Math.floor((z0 + z1) / 2), "red");
  if (lv >= 2) {
    for (const x of [x0 - 2, x0 + width + 1]) v.box(x, 1, z0, x + 1, 9, z0 + 1, "brass");
    v.box(x0 - 2, 8, z0, x0 + width + 2, 9, z0 + 2, "brass");
    for (let x = x0 - 1; x < x0 + width + 1; x++)
      v.box(x, 5 + Math.floor(Math.abs(x) * 0.4), z0, x + 1, 8, z0 + 1, "#8e4f70");
  }
  if (lv >= 3) {
    for (let i = 0; i < 4; i++) {
      const x = x0 + 2 + i * 4;
      bench(v, x, 1, 4, "x", "plaster");
      person(v, x, 2, 4, "blue");
    }
  }
  if (lv >= 4) {
    const mastX = -hx + 4;
    v.box(mastX, 1, back, mastX + 2, 18, back + 2, "#675768");
    const cx = 0,
      cz = back + 5;
    for (let x = mastX; x < hx - 2; x++)
      for (let z = back; z < back + 9; z++) {
        const y = 11 + Math.round(Math.abs(x - cx) * 0.45) - Math.round(Math.abs(z - cz) * 0.35);
        v.put(x, y, z, (x - mastX) % 6 < 3 ? "#a9768c" : "#edcaaf");
      }
    for (const x of [-8, 8]) v.box(x, 1, 0, x + 3, 3, 8, "plaster");
  }
  if (lv === 5) {
    const zz = hz - 4;
    for (const x of [-8, 8]) {
      beam(v, [x, 1, zz], [x, 13, zz], "brass");
      v.sphere(x, 13, zz, 2, 2, 2, "warmGlow", 0.7);
    }
    v.box(-7, 3, z1 - 4, 8, 4, z1, "#e287a1");
    for (let x = -6; x <= 6; x += 3) person(v, x, 4, z1 - 2, "cream");
  }
}

// A shopping arcade set into a paper bag. Folded gussets narrow the end walls, and
// fabric swatches spill from the open top below two contrasting loop handles.
function bagBoutique(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const x = lv >= 3 ? -4 : 0,
    z = lv >= 4 ? -3 : -1,
    w = byLv(c, [4, 5, 7, 9, 10]),
    d = byLv(c, [2, 3, 4, 5, 6]),
    h = byLv(c, [5, 8, 12, 15, 19]);
  for (let dx = -w; dx <= w; dx++) {
    const cut = Math.round(Math.abs(dx / w) ** 5 * 2);
    const depth = Math.max(1, d - cut),
      yy = h - Math.min(2, cut);
    for (const side of [-1, 1]) {
      const face = z + side * depth;
      v.box(x + dx, 1, face, x + dx + 1, yy + 1, face + 1, cut ? "#aa795d" : "#cb9c79");
      v.put(x + dx, yy, face, "#e4bd97");
    }
    if (Math.abs(dx) === w) v.box(x + dx, 1, z - depth, x + dx + 1, yy, z + depth + 1, "#ad735c");
  }
  const handleHalf = Math.max(2, Math.round(w * 0.62)),
    rise = byLv(c, [4, 6, 8, 11, 13]);
  for (const side of [-1, 1]) {
    for (let step = 0; step < 30; step++) {
      const t = (step / 29) * Math.PI;
      const dx = Math.round(Math.cos(t) * handleHalf);
      v.box(
        x + dx,
        h + Math.round(Math.sin(t) * rise) - 1,
        z + side * d,
        x + dx + (lv >= 4 ? 2 : 1),
        h + Math.round(Math.sin(t) * rise) + 1,
        z + side * d + 1,
        side === 1 ? "#704853" : "#805b5b",
      );
    }
  }
  shopWindow(c, x - w + 1, 1, z + d, 2 * w - 1, "#704853");
  if (lv >= 2) {
    for (let k = 0; k < 2 * w - 2; k++) {
      const y = h - 1 + Math.round(2 * Math.sin(k * 0.8));
      v.box(x - w + 1 + k, h - 2, z - 1, x - w + 2 + k, y + 2, z + 2, k % 4 < 2 ? "#72918c" : "#e7cbad");
    }
  }
  if (lv >= 3) {
    const bx = hx - 8;
    counter(c, bx, 1, 6, "#a57175");
    v.box(bx - 1, 5, 0, bx + 6, 6, 3, "#ded0af");
    for (const dx of [bx, bx + 4]) v.box(dx, 1, 0, dx + 1, 5, 1, "brass");
  }
  if (lv >= 4) {
    for (let dx = 0; dx < 2 * w; dx++) {
      const y = h - Math.round(Math.max(0, 1 - dx / (2 * w)) * 7);
      v.box(x - w + dx, y, z + d, x - w + dx + 1, y + 2, z + d + 2, dx % 5 === 1 ? "cream" : "#68877c");
    }
    for (const bx of [-hx + 3, 4]) {
      v.box(bx, 1, hz - 6, bx + 5, 3, hz - 3, "#a87768");
      v.box(bx + 1, 3, hz - 5, bx + 4, 4, hz - 3, "#72918c");
    }
  }
  if (lv === 5) {
    const wingX = hx - 7,
      wingZ = -hz + 7;
    for (let dx = -4; dx <= 4; dx++) {
      const roof = 7 + Math.round(3 * (1 - Math.abs(dx / 4)));
      v.box(wingX + dx, 1, wingZ - 2, wingX + dx + 1, roof, wingZ + 4, dx % 4 === 0 ? "#6c9c92" : "#87b0a0");
    }
    shopWindow(c, wingX - 4, 1, wingZ + 3, 9, "#386e68");
    v.ringZ(wingX, 11, wingZ, wingZ + 2, 3, 2, "brass");
    person(v, 5, 1, hz - 5, "teal");
  }
}
export function buildClothingStores(c: Ctx) {
  frontage(c, "path");
  [hanger, tailor, runway, bagBoutique][c.variant](c);
}
