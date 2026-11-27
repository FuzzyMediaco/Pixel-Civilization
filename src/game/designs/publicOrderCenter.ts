import { bench, byLv, lamp, person, tree, type Ctx, type PixelVox } from "./kit";
import { disc } from "./commerceKit";

function desk(v: PixelVox, x: number, y: number, z: number, interpreter = false) {
  v.box(x, y, z, x + 6, y + 2, z + 2, "#a47753");
  v.box(x - 1, y + 2, z, x + 7, y + 3, z + 2, "#e1ceb2");
  v.box(x + 3, y + 3, z, x + 5, y + 4, z + 1, "screenCyan", 0.48);
  person(v, x + 1, y, z - 1, interpreter ? "#bf7458" : "#4a8482", "blueDark", interpreter ? "#b87d58" : "#c08b68");
  person(v, x + 4, y, z + 3, interpreter ? "#557995" : "#bd9754", "#454d59", "#d09e7a");
}

function walk(v: PixelVox, x: number, start: number, end: number) {
  v.box(x - 2, 0, start, x + 3, 1, end, "path");
}

// An open front exposes the help desk. Three luminous rooflights turn each roof into a speech bubble from above.
function bubble(
  v: PixelVox,
  x: number,
  z: number,
  base: number,
  w: number,
  d: number,
  h: number,
  color: string,
  flip = false,
) {
  for (let xx = -w; xx <= w; xx++)
    for (let zz = -d; zz <= d; zz++) {
      const radius = (xx / w) ** 2 + (zz / d) ** 2;
      if (radius > 1) continue;
      v.put(x + xx, base + h, z + zz, color);
      v.put(x + xx, base + h - 1, z + zz, radius > 0.67 ? "#e3cda6" : "#536e71");
      if (radius > 0.7 && zz < -d * 0.28) {
        for (let y = base; y < base + h - 1; y++)
          v.put(x + xx, y, z + zz, y % 4 === 2 ? "#bde2d1" : "#6a847e", y % 4 === 2 ? 0.35 : 0);
      }
    }
  for (let i = 0; i < d; i++) {
    const x0 = x + (flip ? -1 : 1) * (Math.floor(w / 3) + Math.floor(i / 2));
    const z0 = z + d - 2 + i;
    v.box(x0 - Math.max(0, 2 - i / 2), base + h - 1, z0, x0 + 1, base + h + 1, z0 + 1, color);
  }
  for (const side of [-1, 1]) v.box(x + side * (w - 2), base, z + 1, x + side * (w - 2) + 1, base + h, z + 2, "woodDark");
  for (const dx of [-4, 0, 4]) v.box(x + dx - 1, base + h + 1, z - 1, x + dx + 1, base + h + 2, z + 1, "#e4e8bd", 0.47);
  desk(v, x - 2, base, z, flip);
}

function conversationCanopies(c: Ctx) {
  const { lv, v, hx, hz } = c;
  const x = lv < 3 ? -4 : -hx + 13,
    z = lv < 3 ? -4 : -hz + 10;
  const w = 7 + lv,
    d = 4 + Math.floor(lv / 2),
    h = 5 + lv;
  bubble(v, x, z, 1, w, d, h, "#69a49c");
  walk(v, x + 1, z + d, hz);
  if (lv >= 2) bubble(v, lv < 3 ? 6 : 5, 4, 1, 6, 4, 5, "#cd8c72", true);
  if (lv >= 3) {
    const cx = hx - 10,
      cz = -4;
    for (let j = 1; j <= 3; j++) {
      const r = 3 + j * 2;
      disc(v, cx, cz, 1, j + 2, r, (_x, _y, zz) => (zz < cz + 2 ? "#ba9d76" : null), r - 2);
    }
    person(v, cx, 1, cz, "#985f99");
    lamp(v, cx + 2, 1, cz + 6, 4);
    v.box(x, 0, 7, cx + 2, 1, 9, "#c0b198");
  }
  if (lv >= 4) {
    bubble(v, x - 1, z - 1, h + 2, w - 4, d - 1, 5, "#738caf");
    tree(v, -4, 1, 9, "blossom", 1);
  }
  if (lv === 5) {
    const nx = hx - 12,
      nz = -hz + 7;
    bubble(v, nx, nz, 1, 9, 5, 9, "#929db1", true);
    v.box(x + w - 1, 9, z - 2, nx - 7, 10, z + 1, "woodLight");
    for (let xx = x + w; xx < nx - 6; xx += 5) v.box(xx, 1, z, xx + 1, 9, z + 1, "woodDark");
    bench(v, x + 4, 1, 13);
  }
}

function cot(v: PixelVox, x: number, z: number, fabric: string) {
  for (const xx of [x, x + 5]) v.box(xx, 1, z, xx + 1, 2, z + 3, "woodDark");
  v.box(x, 2, z, x + 6, 3, z + 3, fabric);
  v.box(x, 3, z, x + 2, 4, z + 2, "#ebe0bb");
}

// The roof hangs from two unequal masts. Its wide open side faces the visitor.
function flysheet(v: PixelVox, x: number, z: number, w: number, d: number, h: number, color: string) {
  for (let xx = -w; xx <= w; xx++) {
    const ridge = (xx + w) / (2 * w);
    const rise = h - 5 - 3 * ridge - 2 * Math.sin(Math.PI * ridge);
    for (let zz = -d; zz <= d; zz++) {
      const slope = 1 - Math.abs(zz) / d;
      const y = 5 + Math.round(rise * slope);
      // Join the higher canvas strip to its lower neighbor, including steep seams at the main mast.
      const lower = 5 + Math.round(rise * Math.max(0, slope - 1 / d));
      const seam = zz === 0 || xx === -w || xx === w;
      v.box(x + xx, lower, z + zz, x + xx + 1, y + 1, z + zz + 1, seam ? "#e8c697" : color);
      if (zz === -d && xx % 6 === 0) v.box(x + xx, 1, z + zz, x + xx + 1, y, z + zz + 1, "wood");
    }
  }
  for (const [xx, height] of [
    [x - w, h],
    [x + w, h - 3],
  ]) {
    v.box(xx, 1, z, xx + 1, height + 2, z + 1, "woodDark");
    v.put(xx, height + 2, z, "warmGlow", 0.75);
  }
  cot(v, x - w + 2, z + d - 1, "#c98268");
}

function reliefTents(c: Ctx) {
  const { lv, v, hx, hz } = c;
  const x = lv < 3 ? -3 : -hx + 12,
    z = -hz + 9;
  flysheet(v, x, z, 7, 4 + Math.floor(lv / 2), 9 + 2 * lv, "#bd714e");
  desk(v, x - 1, 1, z + 3);
  walk(v, x + 3, z + 6, hz);
  if (lv >= 2) flysheet(v, lv < 3 ? 6 : 4, 5, 5, 4, 10, "#cfad6e");
  if (lv >= 3) {
    const nx = hx - 10;
    flysheet(v, nx, z - 1, 7, 4, 14, "#6f9f93");
    cot(v, nx + 1, z + 1, "#7899ad");
    for (let xx = x + 8; xx < nx - 6; xx++) v.put(xx, 8, z, xx % 3 === 0 ? "warmGlow" : "woodDark", xx % 3 === 0 ? 0.65 : 0);
  }
  if (lv >= 4) {
    const px = -hx + 11,
      pz = 10;
    flysheet(v, px, pz, 8, 5, 13, "#c59658");
    for (let zz = z + 3; zz < pz - 3; zz++) v.box(px - 2, 6, zz, px + 3, 7, zz + 1, "#ada583");
    cot(v, px + 1, pz + 3, "#4c9991");
  }
  if (lv === 5) {
    flysheet(v, hx - 13, 11, 9, 5, 20, "#b87764");
    desk(v, hx - 15, 1, 14, true);
    v.box(x + 1, 0, 15, hx - 8, 1, 17, "#cbb796");
    for (let zz = z; zz < 8; zz += 6) lamp(v, hx - 4, 1, zz, 5, "woodDark", "warmGlow");
  }
}

function hearingTerrace(v: PixelVox, cx: number, cz: number, radius: number, tiers: number) {
  for (let i = 0; i < tiers; i++) {
    const r = radius - (tiers - 1 - i) * 3,
      h = 2 + i * 2;
    disc(
      v,
      cx,
      cz,
      1,
      h + 1,
      r,
      (x, y, z, d) => {
        if (z > cz && Math.abs(x - cx) < r * 0.69) return null;
        if (d < r - 1.3 && y < h) return null;
        // Low aisle lights pick out each seating tier when an evening public meeting is in session.
        if (y === h && d > r - 1.3 && (x + 2 * z + i) % 9 === 0) return ["#f1c78a", 0.62];
        return y === h ? "#c29a6d" : "#a47b60";
      },
      Math.max(0, r - 2.75),
    );
    for (let a = -2; a <= 2; a++) {
      if ((a + i) % 2) continue;
      const x = cx + Math.round((r - 1) * Math.sin(a * 0.64)),
        z = cz - Math.round((r - 1) * Math.cos(a * 0.64));
      person(v, x, h + 1, z, ["#567d91", "#ac7154", "#75966e"][(a + 2 + i) % 3], "#4f5863", "#be8d6e");
    }
  }
  v.box(cx - 2, 1, cz, cx + 2, 3, cz + 2, "wood");
  v.box(cx - 2, 3, cz, cx + 2, 4, cz + 2, "cream");
  person(v, cx - 1, 1, cz - 1, "#698b85");
}

function booth(v: PixelVox, x: number, z: number, h: number, wall: string) {
  v.hollowBox(x, 1, z, x + 6, h, z + 6, wall);
  v.clear(x + 1, 2, z + 4, x + 5, 5, z + 7);
  v.box(x - 1, h - 1, z - 1, x + 7, h, z + 7, "#d9bf94");
  v.box(x + 1, 3, z + 5, x + 5, 4, z + 6, "warmGlow", 0.6);
  person(v, x + 2, 1, z + 4, "#627c96");
}

function liaisonAmphitheater(c: Ctx) {
  const { lv, v, hx, hz } = c;
  const cx = lv < 3 ? 0 : -4,
    cz = -1,
    rad = byLv(c, [8, 10, 13, 15, 17]),
    tiers = lv + 1;
  hearingTerrace(v, cx, cz, rad, tiers);
  walk(v, cx, cz + 2, hz);
  lamp(v, cx + 4, 1, cz + 5, 3, "woodDark", "warmGlow");
  if (lv >= 2) {
    booth(v, hx - 9, -hz + 3, 6, "#6c9391");
    desk(v, hx - 10, 1, -hz + 10, true);
  }
  if (lv >= 3) {
    booth(v, -hx + 3, -hz + 3, 8, "#b3886b");
    v.box(-hx + 5, 5, -hz + 9, cx - rad + 4, 6, -5, "#937357");
    lamp(v, cx - 5, 1, cz + 7, 4);
  }
  if (lv >= 4) {
    // An open crescent shade covers back-row seats without concealing the floor or the people.
    disc(v, cx, cz, 15, 16, rad + 1, (_x, _y, z) => (z < cz - 4 ? "#749591" : null), rad - 3);
    for (const dx of [-rad + 3, 0, rad - 3]) {
      const zz = cz - Math.round(Math.sqrt(rad * rad - dx * dx));
      v.box(cx + dx, 9, zz, cx + dx + 1, 16, zz + 1, "woodDark");
    }
  }
  if (lv === 5) {
    booth(v, hx - 12, 7, 9, "#bb926c");
    booth(v, -hx + 5, 10, 7, "#8a9e89");
    tree(v, hx - 13, 1, -9, "birch", 1.3);
    desk(v, hx - 13, 1, 14);
    v.box(cx - 4, 0, 15, hx - 8, 1, 17, "#c7b996");
  }
}

function mapPanel(
  v: PixelVox,
  from: readonly [number, number],
  to: readonly [number, number],
  floor: number,
  height: number,
  index: number,
) {
  const [x0, z0] = from,
    [x1, z1] = to,
    run = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  for (let i = 0; i <= run; i++) {
    const t = i / run,
      x = Math.round(x0 + (x1 - x0) * t),
      z = Math.round(z0 + (z1 - z0) * t);
    for (let row = 0; row < height; row++) {
      const y = floor + row,
        zz = z - Math.floor(row / 8);
      const block = (Math.floor(i / 3) + Math.floor(row / 4) + index) % 4;
      const water = Math.abs(row - height * (0.36 + 0.2 * Math.sin(index + t * 2.2))) < 1;
      const road = (i + index) % 6 === 1 || row % 6 === 2;
      const edge = row === 0 || row === height - 1 || i === 0 || i === run;
      let ink = edge ? "#7d6a55" : water ? "#6fa6b7" : road ? "#ddc996" : ["#adbea1", "#91aa8f", "#c9b88c", "#a5c2a0"][block];
      if (!edge && i === Math.floor(run * 0.52) && row >= height * 0.55 && row < height * 0.78) ink = "#c46e50";
      v.box(x, y, zz - 1, x + 1, y + 1, zz + 1, ink, water ? 0.19 : 0);
    }
    if (i % 4 === 0) v.put(x, floor - 1, z, "warmGlow", 0.6);
  }
  for (const [x, z] of [from, to]) v.box(x, 1, z - 1, x + 1, floor, z, "woodDark");
}

function civicMapFold(c: Ctx) {
  const { lv, v, hx, hz } = c;
  const x = -hx + 4,
    z = -hz + 8,
    h = 8 + lv * 2,
    y = 4 + lv;
  const left = [x, z + 3] as const,
    fold = [x + 7, z - 2] as const,
    right = [x + 15, z + 3] as const;
  mapPanel(v, left, fold, y, h, 0);
  mapPanel(v, fold, right, y, h, 1);
  desk(v, x + 5, 1, z + 2);
  walk(v, x + 7, z + 5, hz);
  if (lv >= 2) {
    mapPanel(v, right, [x + 22, z - 2], y, h - 3, 2);
    v.box(x + 13, 4, z + 2, x + 21, 5, z + 7, "#ceac79");
    bench(v, x + 14, 1, z + 6);
  }
  if (lv >= 3) {
    booth(v, hx - 11, 2, 8, "#7a9490");
    const px = hx - 9;
    v.box(px, 8, 3, px + 1, 15, 4, "woodDark");
    v.box(px - 3, 13, 3, px + 4, 15, 4, "#b98b61");
    v.put(px + 4, 14, 3, "warmGlow", 0.6);
    desk(v, hx - 12, 1, 9, true);
  }
  if (lv >= 4) {
    // The new transverse fold creates an L around the interpreter court.
    mapPanel(v, [x + 22, z - 2], [x + 26, z + 7], y, h - 5, 3);
    mapPanel(v, [x + 26, z + 7], [x + 22, z + 15], y, h - 6, 4);
    tree(v, -4, 1, 9, "birch", 1.2);
  }
  if (lv === 5) {
    const xx = hx - 15,
      zz = -hz + 4;
    mapPanel(v, [xx, zz + 2], [xx + 5, zz - 1], 7, 12, 3);
    mapPanel(v, [xx + 5, zz - 1], [xx + 11, zz + 4], 7, 9, 4);
    v.box(x + 23, 7, z - 2, xx + 4, 8, z + 1, "woodLight");
    for (let p = x + 25; p < xx; p += 6) v.box(p, 1, z - 1, p + 1, 7, z, "woodDark");
    lamp(v, xx + 8, 1, zz + 7, 6);
    bench(v, xx, 1, zz + 6);
  }
}

export function buildPublicOrderCenter(c: Ctx): void {
  c.vpick([conversationCanopies, reliefTents, liaisonAmphitheater, civicMapFold])(c);
}
