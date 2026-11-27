/**
 * Commercial overhaul, batch 2: Coffee Roastery, Neon Bowling Alley, Florist & Conservatory,
 * Lantern Night Market, Modern Art Gallery.
 */
import { type Ctx, lamp, person, tree, flowerBed } from "./kit";
import { bulbs, crowd, disc, glassFront, neon, neonWidth, palm, sculpt, smooth, spinner, umbrella, cafeTable, type Fill } from "./commerceKit";
import { override } from "./commerceIcons";

const P = (c: Ctx, x0: number, z0: number, x1: number, z1: number, col = "path") => c.v.box(x0, 0, z0, x1, 1, z1, col);

/** Lot extents for the common 1×1,1×1,2×1,2×2,2×2 ladder. */
const small = (lv: number): [number, number, number, number] =>
  lv <= 2 ? [-7, 7, -6, 4] : lv === 3 ? [-15, 15, -6, 4] : [-15, 15, -14, 8];
/** Lot extents for the 2×1,2×2,3×2,3×3,3×3 ladder. */
const large = (lv: number): [number, number, number, number] =>
  lv === 1 ? [-15, 15, -6, 4] : lv === 2 ? [-15, 15, -14, 8] : lv === 3 ? [-23, 23, -14, 8] : [-23, 23, -22, 12];

// =============================================================================================
// COFFEE ROASTERY — Giant Cup · Espresso Machine · Roaster Drum · Coffee Bean
// =============================================================================================

function cup(c: Ctx, cx: number, cz: number, y0: number, r: number, h: number, body: string, band2: string): number {
  const { v } = c;
  disc(v, cx, cz, y0, y0 + 1, r + 3, (_x, _y, _z, d) => (d > r + 2 ? "#f4f1ea" : "#e3ddd0")); // saucer
  for (let y = y0 + 1; y < y0 + h; y++) {
    const rr = r * (0.82 + 0.18 * ((y - y0) / h));
    disc(v, cx, cz, y, y + 1, rr, (_x, yy, _z, d) => (d < rr - 1.2 ? null : Math.abs(yy - (y0 + h * 0.55)) < 1 ? band2 : body));
  }
  // latte surface with a heart
  disc(v, cx, cz, y0 + h - 2, y0 + h - 1, r - 0.5, (x, _y, z) => {
    const dx = (x + 0.5 - cx) / (r * 0.5), dz = (z + 0.5 - cz) / (r * 0.5);
    const heart = (dx * dx + dz * dz - 1) ** 3 - dx * dx * (-dz) ** 3 < 0;
    return heart ? "#f6ead8" : "#8a5a32";
  });
  // handle on +x
  const hr = Math.max(2, Math.round(h / 3));
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const x = Math.round(cx + r + hr * 0.6 + Math.cos(ang) * hr * 0.6), y = Math.round(y0 + h * 0.55 + Math.sin(ang) * hr);
    if (Math.cos(ang) > -0.2) v.box(x, y, Math.round(cz) - 1, x + 1, y + 1, Math.round(cz) + 1, body);
  }
  // door
  v.box(Math.round(cx) - 1, y0 + 1, Math.round(cz + r * 0.85), Math.round(cx) + 2, y0 + Math.min(5, h - 2), Math.round(cz + r) + 1, "#ffd9a0", 0.9);
  for (let k = 0; k < 3; k++) c.smoke(Math.round(cx) - 2 + k * 2, y0 + h + 1, Math.round(cz), "steam");
  return y0 + h;
}

function espresso(c: Ctx, x0: number, x1: number, z0: number, z1: number, H: number): void {
  const { v } = c;
  // chrome body with a domed eagle-less top, group heads with portafilters as canopies
  sculpt(v, x0, 1, z0, x1, H, z1, (u, h, w) => {
    if (h > 0.88 && Math.hypot((u - 0.5) * 2, (w - 0.5) * 2) > 1 - (h - 0.88) * 5) return null;
    if (h > 0.88) return h > 0.97 ? "#e8b93a" : "#d7dbe2";
    if (h < 0.08) return "#2b2b30";
    if (w > 0.96 && h > 0.45 && h < 0.6) return "#b4232c";
    if (w > 0.96 && h > 0.68 && h < 0.8 && Math.abs(((u * 6) % 1) - 0.5) < 0.25) return ["#7df9ff", 0.6]; // gauges
    return Math.floor(h * 30) % 6 === 0 ? "#aeb4bd" : "#d7dbe2";
  });
  const n = Math.max(2, Math.floor((x1 - x0) / 7));
  for (let i = 0; i < n; i++) {
    const gx = Math.round(x0 + ((i + 0.5) * (x1 - x0)) / n);
    const gy = Math.round(H * 0.42);
    v.box(gx - 1, gy, z1, gx + 2, gy + 2, z1 + 2, "#aeb4bd");
    v.box(gx - 2, gy - 1, z1 + 2, gx + 3, gy, z1 + 5, "#2b2b30"); // portafilter canopy
    v.box(gx, gy - 1, z1 + 5, gx + 1, gy, z1 + 8, "#2b2b30"); // handle
    v.box(gx - 1, 1, z1 + 1, gx + 2, 3, z1 + 3, "white"); // cup under the spout
    v.put(gx, 3, z1 + 2, "#5b3a1e");
  }
  // steam wand
  v.box(x1, Math.round(H * 0.6), z1 - 2, x1 + 1, Math.round(H * 0.6) + 1, z1 + 3, "#aeb4bd");
  c.smoke(x1, Math.round(H * 0.6), z1 + 3, "steam");
}

function bean(c: Ctx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, roast = "#5b3a1e"): void {
  sculpt(c.v, x0, y0, z0, x1, y1, z1, (u, h, w) => {
    const X = (u - 0.5) * 2, Y = (h - 0.5) * 2, Z = (w - 0.5) * 2;
    if (X * X + Y * Y * 1.4 + Z * Z > 1) return null;
    if (Y > 0 && Math.abs(Z - 0.18 * Math.sin(X * 3)) < 0.1) return "#2b1a0d"; // crease
    return Y > 0.6 ? "#6f4a2a" : roast;
  });
}

function buildCoffee(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const [x0, x1, z0, z1] = small(lv);
  if (s === 0) {
    // Giant Cup
    const r = [4, 5, 6, 9, 11][lv - 1], h = [6, 8, 10, 14, 18][lv - 1];
    P(c, x0 - 1, z1 - 2, x1 + 1, Math.min(lv >= 4 ? 16 : 8, z1 + 6), "#efe6d2");
    const cx = lv === 3 ? -6 : lv >= 4 ? -2 : -1;
    cup(c, cx, (z0 + z1) / 2 - 1, 1, r, h, "white", "#2f6b45");
    if (lv >= 3) { const t = Math.min(7, lv * 2 - 2); for (let i = 0; i < t / 2; i++) { cafeTable(c, x1 - 4 - (i % 2) * 5, z1 - 2 + Math.floor(i / 2) * 4); umbrella(v, x1 - 4 - (i % 2) * 5, z1 - 2 + Math.floor(i / 2) * 4, "#2f6b45", "white"); } }
    crowd(c, lv + 1, x0, z1 + 1, x1, Math.min(lv >= 4 ? 15 : 7, z1 + 4));
  } else if (s === 1) {
    // Espresso Machine
    const H = [9, 12, 14, 18, 24][lv - 1];
    const ex0 = lv <= 2 ? -6 : x0 + 2, ex1 = lv <= 2 ? 6 : x1 - 2;
    const ez0 = lv <= 2 ? -6 : z0 + 1, ez1 = lv <= 2 ? -1 : z1 - 9;
    espresso(c, ex0, ex1, ez0, ez1, H);
    P(c, x0 - 1, ez1, x1 + 1, Math.min(lv >= 4 ? 16 : 8, ez1 + 10), "#2b2b30");
    neon(v, "ESPRESSO", Math.max(x0, -16), H + 1, Math.round((ez0 + ez1) / 2), "#ffd27a", { scale: 1 });
    crowd(c, lv + 1, x0 + 1, ez1 + 6, x1 - 1, Math.min(lv >= 4 ? 15 : 7, ez1 + 9));
  } else if (s === 2) {
    // Roaster Drum: a brick roastery with a turning drum, bean silos and a chimney
    const top = 1 + (lv >= 4 ? 2 : 1) * 6;
    v.box(x0, 1, z0, x1, top, z1, "#9c4a2e");
    v.clear(x0 + 1, 1, z0 + 1, x1 - 1, top - 1, z1 - 1);
    glassFront(v, x0 + 1, x1 - 1, 2, 6, z1 - 1, "#2b2b30", 3);
    v.box(x0, top - 1, z0, x1, top, z1 + 1, "#2b2b30");
    const r = [3, 4, 5, 6, 8][lv - 1];
    const dx = lv <= 2 ? 0 : x0 + r + 3;
    v.box(dx - r, top, z0 + 2, dx - r + 1, top + r + 2, z0 + 3, "#2b2b30");
    v.box(dx + r, top, z0 + 2, dx + r + 1, top + r + 2, z0 + 3, "#2b2b30");
    const drum = spinner(c, dx + 0.5, top + r + 2, z0 + 2.5, "x", 0.8);
    for (let ix = -r + 1; ix < r; ix++) for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      drum.put(ix, Math.round(Math.sin(ang) * (r - 1)), Math.round(Math.cos(ang) * (r - 1)), ix % 3 === 0 ? "#e8b93a" : "#3a3d46");
    }
    v.box(dx + r - 1, top + r * 2, z0 + 1, dx + r + 1, top + r * 2 + 6, z0 + 3, "#2b2b30");
    c.smoke(dx + r, top + r * 2 + 6, z0 + 2, "smoke");
    if (lv >= 3) for (let i = 0; i < lv - 1; i++) {
      const sx = x1 - 4 - i * 5;
      disc(v, sx, z0 + 3, top, top + 6 + i, 2, "#c9ced6");
      disc(v, sx, z0 + 3, top + 6 + i, top + 7 + i, 2, "#5b3a1e");
    }
    neon(v, "ROAST", -9, top - 6 + 1, z1, "#ffd27a");
    P(c, x0 - 1, z1, x1 + 1, Math.min(lv >= 4 ? 16 : 8, z1 + 6));
    crowd(c, lv + 1, x0, z1 + 1, x1, Math.min(lv >= 4 ? 15 : 7, z1 + 4));
  } else {
    // Coffee Bean: a bean kiosk grows into a pile of beans you can walk into
    P(c, x0 - 1, z1 - 2, x1 + 1, Math.min(lv >= 4 ? 16 : 8, z1 + 6), "#efe6d2");
    if (lv <= 2) {
      bean(c, -6, 1, -5, 6, lv === 1 ? 8 : 10, 4);
      v.box(-2, 1, 3, 2, 5, 4, "#ffd9a0", 0.9);
      if (lv === 2) cafeTable(c, 5, 6);
    } else {
      const beans: [number, number, number, number, number, number][] = lv === 3
        ? [[-15, 1, -6, -1, 11, 4], [1, 1, -5, 14, 9, 4]]
        : [[-15, 1, -14, 2, 14, 2], [2, 1, -13, 15, 12, -1], [-6, 10, -12, 9, 20, 0], ...(lv === 5 ? [[-14, 1, 2, -2, 9, 8] as [number, number, number, number, number, number], [-4, 18, -10, 6, 26, -2] as [number, number, number, number, number, number]] : [])];
      beans.forEach(([a, b, cc, d, e, f], i) => bean(c, a, b, cc, d, e, f, i % 2 ? "#4a2e16" : "#5b3a1e"));
      v.box(-11, 1, lv === 3 ? 3 : 1, -6, 6, lv === 3 ? 5 : 3, "#ffd9a0", 0.9);
      for (let i = 0; i < lv - 1; i++) cafeTable(c, -12 + i * 6, lv === 3 ? 6 : 12);
    }
    crowd(c, lv + 1, x0, z1 + 2, x1, Math.min(lv >= 4 ? 15 : 7, z1 + 4));
  }
}

override(
  "coffee_roastery",
  buildCoffee,
  ["Espresso Cart", "Corner Cafe", "Signature Cafe", "Cafe Landmark", "Flagship Roastery"],
  "An espresso cart grows into a cafe shaped like coffee itself: a giant latte cup on a saucer, a chrome espresso machine, a roastery with a turning drum, or a pile of beans you can walk into.",
);

// =============================================================================================
// BOWLING — Giant Pins · Bowling Ball · Googie Lanes · Strike Lane
// =============================================================================================

function pinShape(u: number, h: number, w: number): Fill {
  const X = (u - 0.5) * 2, Z = (w - 0.5) * 2;
  const r = h < 0.55 ? 0.62 + 0.38 * Math.sin(Math.min(1, h / 0.42) * Math.PI * 0.62) : h < 0.78 ? 0.42 - 0.12 * smooth(0.55, 0.72, h) + 0.1 * smooth(0.72, 0.78, h) : 0.62 * Math.sqrt(Math.max(0, 1 - ((h - 0.86) / 0.14) ** 2));
  if (Math.hypot(X, Z) > r) return null;
  if ((h > 0.66 && h < 0.69) || (h > 0.71 && h < 0.74)) return "#d0021b";
  return "#fbfbf7";
}

function ball(c: Ctx, cx: number, cz: number, y0: number, r: number, col: string): void {
  sculpt(c.v, Math.floor(cx - r), y0, Math.floor(cz - r), Math.ceil(cx + r), y0 + 2 * r, Math.ceil(cz + r), (u, h, w) => {
    const X = (u - 0.5) * 2, Y = (h - 0.5) * 2, Z = (w - 0.5) * 2;
    if (X * X + Y * Y + Z * Z > 1) return null;
    const holes = [[0.2, 0.55, 0.78], [-0.12, 0.6, 0.78], [0.04, 0.3, 0.95]];
    if (holes.some(([hx, hy, hz]) => Math.hypot(X - hx, Y - hy, Z - hz) < 0.15)) return ["#ffd27a", 1.0];
    return Math.sin(X * 6 + Y * 4) > 0.7 ? "#ffffff" : col;
  });
}

function buildBowling(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const [x0, x1, z0, z1] = large(lv);
  const hall = (hx0: number, hx1: number, hz0: number, hz1: number, h: number, wall: string, trim: string) => {
    v.box(hx0, 1, hz0, hx1, h, hz1, wall);
    v.clear(hx0 + 1, 1, hz0 + 1, hx1 - 1, h - 1, hz1 - 1);
    glassFront(v, hx0 + 1, hx1 - 1, 2, h - 2, hz1 - 1, trim, 4, "#ffe1a6");
    v.box(hx0, h - 1, hz0, hx1, h, hz1 + 1, trim);
    // lanes visible on the roof as stripes
    for (let x = hx0 + 2; x < hx1 - 2; x += 4) v.box(x, h, hz0 + 1, x + 2, h + 1, hz1 - 1, "#d9a066");
  };
  if (s === 0) {
    // Giant Pins
    hall(x0 + 1, x1 - 1, z0, z1 - 4, 7, "#1d3557", "#e63946");
    const ph = [12, 16, 20, 24, 30][lv - 1];
    const n = [1, 1, 3, 3, 10][lv - 1];
    const tri = [[0, 0], [-1, -1], [1, -1], [-2, -2], [0, -2], [2, -2], [-3, -3], [-1, -3], [1, -3], [3, -3]];
    const sp = lv === 5 ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const [tx, tz] = tri[i];
      const pw = Math.round(ph * 0.42);
      const px = Math.round(tx * sp / 1.2) - Math.floor(pw / 2), pz = Math.round(z1 - 8 + tz * sp * 0.9) - Math.floor(pw / 2);
      sculpt(v, px, lv >= 4 ? 7 : 7, pz, px + pw, (lv >= 4 ? 7 : 7) + ph, pz + pw, pinShape);
    }
    neon(v, "BOWL", -7, 2, z1 - 3, "#ff3b4e");
  } else if (s === 1) {
    // Bowling Ball: the hall becomes a ball with finger-hole skylights
    const r = [6, 9, 12, 15, 19][lv - 1];
    const cx = lv === 1 ? -5 : 0, cz = lv <= 1 ? -1 : lv === 2 ? -3 : lv === 3 ? -3 : -5;
    ball(c, cx, cz, 1, r, ["#3a0ca3", "#7209b7", "#1d3557", "#b5179e", "#2b2d42"][lv - 1]);
    v.box(cx - 2, 1, Math.round(cz + r * 0.9), cx + 2, 6, Math.round(cz + r) + 1, "#ffe1a6", 0.9);
    if (lv === 1) sculpt(v, 6, 1, -3, 11, 13, 2, pinShape);
    if (lv >= 3) for (const sx of [-1, 1]) sculpt(v, cx + sx * (r + 3) - 2, 1, cz - 2, cx + sx * (r + 3) + 3, 15 + lv, cz + 3, pinShape);
  } else if (s === 2) {
    // Googie Lanes: zig-zag roof, starburst and a big neon pin sign
    const h = 8;
    hall(x0 + 1, x1 - 1, z0, z1 - 5, h, "#7fd1c7", "#ff7a3c");
    for (let x = x0 + 1; x < x1 - 1; x++) {
      const zig = Math.abs(((x - x0) % 12) - 6);
      v.box(x, h + zig, z0, x + 1, h + zig + 1, z1 - 3, "#ff7a3c");
    }
    const sy = 14 + lv * 3;
    v.box(x1 - 4, 1, z1 - 3, x1 - 3, sy, z1 - 2, "#e6e9ee");
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2, len = a % 2 ? 4 : 2.5;
      for (let k = 1; k <= len; k++) v.put(x1 - 4 + Math.round(Math.cos(ang) * k), sy + Math.round(Math.sin(ang) * k), z1 - 3, a % 2 ? "#ffd23f" : "#ff7a3c", 1.0);
    }
    neon(v, "LANES", x1 - 10, sy - 12, z1 - 2, "#ff3fb4", { vertical: false });
  } else {
    // Strike Lane: the roof is a lane, a giant ball mid-roll and pins about to fall
    const h = 6;
    hall(x0 + 1, x1 - 1, z0 + 2, z1 - 3, h, "#2b2d42", "#ffd23f");
    v.box(x0 + 2, h, -3, x1 - 2, h + 1, 3, "#e0b072");
    for (let x = x0 + 4; x < x1 - 8; x += 4) v.put(x, h + 1, 0, "#7a3e12");
    const r = [3, 4, 5, 6, 7][lv - 1];
    ball(c, x0 + 4 + r, 0, h + 1, r, "#e63946");
    const pinH = [7, 8, 10, 12, 14][lv - 1];
    const pw = Math.round(pinH * 0.42);
    const pins = lv >= 4 ? [[0, 0], [2, -1], [2, 1], [4, -2], [4, 0], [4, 2]] : [[0, 0], [2, -1], [2, 1]];
    pins.forEach(([dx, dz], i) => {
      const px = x1 - 4 - pw - (4 - dx) * Math.round(pw * 0.7), pz = Math.round(dz * pw * 0.8) - Math.floor(pw / 2);
      sculpt(v, px, h + 1, pz, px + pw, h + 1 + pinH - (i === 1 ? 2 : 0), pz + pw, pinShape);
    });
    neon(v, "STRIKE", -11, 2, z1 - 3, "#ffd23f");
  }
  P(c, x0, z1 - 4, x1, z1 + 4, "#2b2b30");
  crowd(c, 3 + lv * 2, x0 + 2, z1 - 2, x1 - 2, z1 + 3);
  if (lv >= 4) for (const x of [x0 + 1, x1 - 2]) lamp(v, x, 1, z1 + 2, 6, "chrome", "#ff7ad9");
}

override(
  "bowling_alley",
  buildBowling,
  ["Six-Lane Alley", "Starlight Bowl", "Pin Palace", "Championship Bowl", "Mega Strike Arena"],
  "A six-lane alley grows into a bowling landmark: a rack of giant pins on the roof, a hall shaped like a bowling ball with finger-hole skylights, Googie zig-zag lanes, or a roof-lane where a giant ball rolls toward the pins.",
);

// =============================================================================================
// FLORIST — Glass Conservatory · Flower Pot · Tulip Market · Giant Bloom
// =============================================================================================

function conservatory(c: Ctx, cx: number, cz: number, rx: number, rz: number, h: number): void {
  sculpt(c.v, Math.floor(cx - rx), 1, Math.floor(cz - rz), Math.ceil(cx + rx), 1 + h, Math.ceil(cz + rz), (u, hh, w) => {
    const X = (u - 0.5) * 2, Z = (w - 0.5) * 2;
    const r = Math.hypot(X, Z * 0.9);
    const top = hh < 0.4 ? 1 : Math.sqrt(Math.max(0, 1 - ((hh - 0.4) / 0.6) ** 2));
    if (r > top) return null;
    if (hh > 0.97) return "#e8b93a";
    const rib = Math.abs(Math.sin(Math.atan2(Z, X) * 6)) < 0.18 || Math.floor(hh * 12) % 4 === 0;
    if (rib) return "#f4f4f4";
    return ["#bfe9df", 0.2];
  });
  for (let i = 0; i < 6; i++) c.v.put(Math.round(cx - rx / 2 + (i % 3) * rx / 2), 1 + (i % 2), Math.round(cz - rz / 3 + Math.floor(i / 3) * rz / 2), ["#ff7aa8", "#ffd23f", "#4f8a3a"][i % 3]);
}

function flowerHead(c: Ctx, cx: number, cz: number, y: number, r: number, petal: string, center: string): void {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const d = Math.hypot(dx, dz);
    if (d > r) continue;
    const a = Math.atan2(dz, dx);
    const petalR = r * (0.7 + 0.3 * Math.abs(Math.cos(a * 4)));
    if (d > petalR) continue;
    c.v.put(cx + dx, y + (d > r * 0.6 ? 1 : 0), cz + dz, d < r * 0.35 ? center : petal);
  }
}

function buildFlorist(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const [x0, x1, z0, z1] = small(lv);
  if (s === 0) {
    // Glass Conservatory
    const rx = [5, 6, 13, 13, 14][lv - 1], rz = [4, 5, 5, 10, 11][lv - 1], h = [7, 9, 11, 15, 20][lv - 1];
    conservatory(c, 0, (z0 + z1) / 2 - 1, rx, rz, h);
    if (lv >= 4) { conservatory(c, -11, z1 - 1, 3, 3, 7); conservatory(c, 11, z1 - 1, 3, 3, 7); }
    if (lv === 5) { c.v.box(-1, h + 1, -4, 1, h + 5, -2, "#e8b93a"); }
  } else if (s === 1) {
    // Giant Flower Pot
    const r = [4, 6, 6, 9, 11][lv - 1], h = [5, 7, 8, 11, 13][lv - 1];
    const pots = lv === 3 ? [[-8, 0], [8, -1]] : [[lv >= 4 ? -2 : 0, (z0 + z1) / 2 - 1]];
    pots.forEach(([px, pz], i) => {
      for (let y = 1; y <= h; y++) {
        const rr = r * (0.75 + 0.25 * (y / h)) + (y >= h - 1 ? 1 : 0);
        disc(v, px, pz, y, y + 1, rr, (_x, _y, _z, d) => (d < rr - 1.3 && y < h ? null : y === h ? "#5b3a1e" : y >= h - 1 ? "#b4562b" : "#c8693a"));
      }
      // blooms bursting from the soil
      const n = 3 + lv;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + i;
        const fx = Math.round(px + Math.cos(a) * r * 0.5), fz = Math.round(pz + Math.sin(a) * r * 0.5);
        const fh = h + 2 + ((k * 3) % 5) + lv;
        v.box(fx, h + 1, fz, fx + 1, fh, fz + 1, "#4f8a3a");
        flowerHead(c, fx, fz, fh, 2 + (lv >= 4 ? 1 : 0), ["#ff7aa8", "#ffd23f", "#e63946", "#b38cff", "#ff9f40"][k % 5], "#5b3a1e");
      }
      v.box(Math.round(px) - 1, 1, Math.round(pz + r * 0.8), Math.round(px) + 2, 5, Math.round(pz + r) + 1, "#ffd9a0", 0.9);
    });
  } else if (s === 2) {
    // Tulip Market: stalls under giant tulip canopies
    const n = [1, 1, 3, 4, 5][lv - 1];
    for (let i = 0; i < n; i++) {
      const tx = n === 1 ? 0 : Math.round(x0 + 4 + (i * (x1 - x0 - 8)) / (n - 1));
      const tz = lv >= 4 ? (i % 2 ? z0 + 5 : z1 - 5) : (z0 + z1) / 2;
      const stem = [8, 10, 12, 14, 16][lv - 1];
      v.box(tx, 1, Math.round(tz), tx + 1, stem, Math.round(tz) + 1, "#4f8a3a");
      const col = ["#e63946", "#ff7aa8", "#ffd23f", "#b38cff", "#ff9f40"][i % 5];
      for (let y = 0; y < 5; y++) {
        const rr = 2 + Math.round(Math.sin((y / 5) * Math.PI) * 2) + (lv >= 4 ? 1 : 0);
        disc(v, tx + 0.5, tz + 0.5, stem + y, stem + y + 1, rr, (_x, _y, _z, d) => (y < 4 && d < rr - 1.2 ? null : col));
      }
      // stall underneath
      v.box(tx - 3, 1, Math.round(tz) - 2, tx + 4, 3, Math.round(tz) + 2, "woodLight");
      for (let k = -3; k < 4; k++) v.put(tx + k, 3, Math.round(tz) + 1, ["#ff7aa8", "#ffd23f", "#e63946", "white"][(k + 4) % 4]);
    }
  } else {
    // Giant Bloom: the shop sits inside an opening flower
    const r = [6, 7, 11, 13, 15][lv - 1];
    const cz = (z0 + z1) / 2 - 1;
    const petals = 8;
    const ph = [8, 10, 12, 16, 20][lv - 1];
    disc(v, 0, cz, 1, 5, r * 0.45, "#ffd9a0"); // the shop drum
    glassFront(v, -2, 3, 1, 4, Math.round(cz + r * 0.45), "#e8b93a", 2, "#ffd9a0");
    for (let p = 0; p < petals; p++) {
      const a = (p / petals) * Math.PI * 2;
      for (let k = 0; k < ph; k++) {
        const t = k / ph;
        const rr = r * (0.35 + 0.65 * Math.sin(t * Math.PI * 0.6));
        const wdt = 1 + Math.round(Math.sin(t * Math.PI) * 2.5);
        for (let q = -wdt; q <= wdt; q++) {
          const aa = a + q * 0.06;
          v.put(Math.round(Math.cos(aa) * rr), 1 + k, Math.round(cz + Math.sin(aa) * rr), k > ph - 3 ? "#ffd0e0" : p % 2 ? "#ff7aa8" : "#ff5c93");
        }
      }
    }
    disc(v, 0, cz, ph - 2, ph, 2.5, "#ffd23f");
  }
  P(c, x0 - 1, z1 - 1, x1 + 1, Math.min(lv >= 4 ? 16 : 8, z1 + 6), "#efe6d2");
  for (let i = 0; i < Math.min(4, lv); i++) flowerBed(c, x0 + 1 + i * 7, Math.min(lv >= 4 ? 14 : 6, z1 + 2), x0 + 5 + i * 7, Math.min(lv >= 4 ? 15 : 7, z1 + 3));
  crowd(c, lv + 1, x0, z1, x1, Math.min(lv >= 4 ? 15 : 7, z1 + 3));
}

override(
  "flower_shop",
  buildFlorist,
  ["Flower Cart", "Corner Florist", "Bloom House", "Botanical Shop", "Grand Flower Market"],
  "A flower cart grows into a florist you can spot from above: Victorian glass domes, a giant terracotta pot spilling blooms, a market under giant tulips, or a shop tucked inside an opening flower.",
);

// =============================================================================================
// NIGHT MARKET — Lantern Canopy · Paper Dragon · Container Stack · Umbrella Sky
// =============================================================================================

function stalls(c: Ctx, x0: number, x1: number, z: number, cols: string[]): void {
  for (let x = x0, i = 0; x + 5 <= x1; x += 6, i++) {
    c.v.box(x, 1, z, x + 5, 3, z + 3, "woodLight");
    c.v.box(x, 5, z - 1, x + 5, 6, z + 4, cols[i % cols.length]);
    for (const xx of [x, x + 4]) c.v.box(xx, 1, z, xx + 1, 5, z + 1, "woodDark");
    c.v.put(x + 2, 3, z + 1, "#ffd27a", 1.0);
    c.smoke(x + 2, 4, z + 1, "steam");
  }
}

function lantern(v: Ctx["v"], x: number, y: number, z: number, col = "#e63946"): void {
  v.put(x, y, z, col, 1.1);
  v.put(x, y + 1, z, col, 1.1);
  v.put(x, y + 2, z, "#e8b93a");
}

function buildNightMarket(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const [x0, x1, z0, z1] = large(lv);
  P(c, x0, z0, x1, z1 + 3, "#3a3a44");
  const rows = lv <= 1 ? 1 : lv <= 3 ? 2 : 3;
  const stallCols = s === 2 ? ["#14b8a6", "#ff7a3c", "#7209b7"] : ["#b4232c", "#e8b93a", "#2f6b45"];
  for (let r = 0; r < rows; r++) stalls(c, x0 + 1, x1 - 1, z0 + 1 + r * Math.floor((z1 - z0) / rows), stallCols);
  if (s === 0) {
    // Lantern Canopy: strings of red lanterns criss-crossing on poles, a gate at Lv3+
    for (let x = x0 + 1; x < x1; x += 8) { v.box(x, 1, z1, x + 1, 11, z1 + 1, "#7a1f2b"); v.box(x, 1, z0, x + 1, 11, z0 + 1, "#7a1f2b"); }
    for (let x = x0 + 1; x < x1 - 1; x += 3) for (let z = z0 + 2; z < z1; z += 4) lantern(v, x, 8 - ((x + z) % 2), z, (x + z) % 5 ? "#e63946" : "#ffd23f");
    if (lv >= 3) {
      v.box(-8, 1, z1 + 1, -6, 14, z1 + 3, "#b4232c");
      v.box(6, 1, z1 + 1, 8, 14, z1 + 3, "#b4232c");
      for (let k = 0; k < 3; k++) v.box(-10 + k, 14 + k, z1, 10 - k, 15 + k, z1 + 4, k === 2 ? "#2f6b45" : "#b4232c");
      neon(v, "MARKET", -11, 10, z1 + 3, "#ffd27a");
    }
  } else if (s === 1) {
    // Paper Dragon: a long dragon sculpture snakes over the stalls
    const len = (x1 - x0) * (lv >= 4 ? 1.7 : 1.1);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = x0 + 3 + t * (x1 - x0 - 6);
      const z = (z0 + z1) / 2 + Math.sin(t * Math.PI * (lv >= 4 ? 3 : 2)) * (z1 - z0) * 0.32;
      const y = 10 + lv + Math.sin(t * Math.PI * 4) * 2;
      pts.push([Math.round(x), Math.round(y), Math.round(z)]);
    }
    const R = lv >= 4 ? 3 : 2;
    pts.forEach(([x, y, z], i) => {
      for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) if (dy * dy + dz * dz <= R * R) v.put(x, y + dy, z + dz, dy === R ? (i % 2 ? "#e8b93a" : "#2f6b45") : dy < -R + 1 ? "#ffd23f" : "#d62b35", dy < 0 ? 0.3 : 0);
      if (i % 5 === 0) v.box(x, 1, z, x + 1, y - R, z + 1, "#5b3a1e");
    });
    const [hx, hy, hz] = pts[pts.length - 1];
    v.box(hx, hy - R, hz - R - 1, hx + R * 2, hy + R + 2, hz + R + 2, "#d62b35");
    v.put(hx + R * 2 - 1, hy + 1, hz - R, "#ffd23f", 1.2);
    v.put(hx + R * 2 - 1, hy + 1, hz + R + 1, "#ffd23f", 1.2);
    for (let k = 0; k < 4; k++) v.put(hx + R * 2 + k, hy + R + k, hz, "#e8b93a"); // whiskers
  } else if (s === 2) {
    // Container Stack: stacked shipping containers with neon and a rooftop deck
    const cols = ["#14b8a6", "#ff7a3c", "#7209b7", "#ffd23f", "#e63946"];
    const layers = [1, 1, 2, 3, 3][lv - 1];
    let n = 0;
    for (let L = 0; L < layers; L++) for (let x = x0 + 1 + L * 3; x + 12 <= x1 - L * 3; x += 13) {
      const zc = z0 + 2 + L * 2;
      const y = 1 + L * 5;
      v.box(x, y, zc, x + 12, y + 5, zc + 5, cols[n % cols.length]);
      for (let k = x; k < x + 12; k += 2) v.box(k, y, zc + 5, k + 1, y + 5, zc + 6, "#2b2b30");
      v.box(x + 2, y + 1, zc + 5, x + 10, y + 4, zc + 6, "#ffd9a0", 0.7);
      n++;
    }
    neon(v, "EATS", x0 + 2, 2 + layers * 5, z0 + 2, "#7df9ff");
    for (let x = x0 + 2; x < x1 - 2; x += 4) bulbs(v, x, z1 - 2, x + 3, z1 - 2, 7);
  } else {
    // Umbrella Sky: a ceiling of floating colourful umbrellas
    const cols = ["#e63946", "#ffd23f", "#14b8a6", "#ff7aa8", "#4d9bff", "#7bd389"];
    for (let x = x0 + 2; x < x1 - 1; x += 5) for (let z = z0 + 2; z < z1; z += 5) {
      const y = 9 + ((x * 3 + z * 7) % 3);
      const col = cols[(x + z * 3) % cols.length];
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 3) v.put(x + dx, y + (Math.abs(dx) + Math.abs(dz) <= 1 ? 1 : 0), z + dz, col);
      v.box(x, y - 3, z, x + 1, y, z + 1, "#2b2b30");
    }
    for (let x = x0; x < x1; x += 12) { v.box(x, 1, z0, x + 1, 13, z0 + 1, "iron"); v.box(x, 1, z1 - 1, x + 1, 13, z1, "iron"); }
  }
  crowd(c, 6 + lv * 3, x0 + 1, z0 + 4, x1 - 1, z1 + 2);
}

override(
  "night_market",
  buildNightMarket,
  ["Food Carts", "Lantern Alley", "Street Market", "Bazaar Square", "Grand Night Bazaar"],
  "Food carts grow into a night market you can find from the sky: criss-crossed red lanterns and a gate, a paper dragon snaking over the stalls, stacked neon shipping containers, or a ceiling of floating umbrellas.",
);

// =============================================================================================
// ART GALLERY — Picture Frame · Paint Tubes · Spiral Museum · Floating Cubes
// =============================================================================================

function buildGallery(c: Ctx): void {
  const { v, lv } = c;
  const s = c.variant % 4;
  const [x0, x1, z0, z1] = large(lv);
  P(c, x0, z0, x1, z1 + 3, "#e9e4da");
  if (s === 0) {
    // Picture Frame: walk through a monumental empty gold frame into a sculpture court
    const fw = [12, 18, 24, 30, 38][lv - 1], fh = [10, 14, 18, 22, 28][lv - 1];
    const fz = z1 - 2;
    for (let x = -fw / 2; x < fw / 2; x++) for (let y = 1; y < fh; y++) {
      const edge = x < -fw / 2 + 2 || x >= fw / 2 - 2 || y < 3 || y >= fh - 2;
      if (!edge) continue;
      const orn = (x + y) % 3 === 0;
      v.box(x, y, fz, x + 1, y + 1, fz + 2, orn ? "#f2cf5b" : "#c99a24");
    }
    // white gallery behind with a sculpture court
    v.box(x0 + 1, 1, z0, x1 - 1, Math.round(fh * 0.6), z0 + Math.round((z1 - z0) * 0.4), "#f7f5f0");
    for (let i = 0; i < lv + 1; i++) {
      const sx = -fw / 2 + 3 + i * Math.max(3, Math.floor((fw - 6) / (lv + 1)));
      v.box(sx, 1, fz - 6, sx + 2, 2, fz - 4, "#c9ced6");
      sculpt(v, sx, 2, fz - 6, sx + 2, 6 + (i % 3) * 2, fz - 4, (u, h) => ["#e63946", "#4d9bff", "#ffd23f", "#2b2d42"][(i + Math.floor(h * 3)) % 4]);
    }
  } else if (s === 1) {
    // Paint Tubes: giant paint tubes squeezing rivers of colour into the plaza
    const cols = ["#e63946", "#ffd23f", "#4d9bff", "#7bd389", "#b38cff"];
    const n = [1, 2, 3, 4, 5][lv - 1];
    for (let i = 0; i < n; i++) {
      const tx = n === 1 ? -3 : Math.round(x0 + 2 + (i * (x1 - x0 - 13)) / (n - 1));
      const L = [12, 18, 20, 22, 26][lv - 1];
      const D = [6, 8, 9, 9, 9][lv - 1];
      const tz0 = z0 + 1 + (i % 2) * 2;
      sculpt(v, tx, 1, tz0, tx + D, 1 + D, tz0 + L, (u, h, w) => {
        const crimp = w < 0.08;
        const R = crimp ? 0.4 : w > 0.9 ? 0.55 : 1;
        if (Math.hypot((u - 0.5) * 2, (h - 0.5) * 2) > R) return null;
        if (w > 0.9) return "white";
        if (Math.abs(w - 0.5) < 0.12) return cols[i % 5];
        return "#f4f4f4";
      });
      // squeezed paint ribbon
      for (let k = 0; k < 6 + lv * 2; k++) v.box(tx + 2 + Math.round(Math.sin(k * 0.7) * 2), 1, tz0 + L + k, tx + 5 + Math.round(Math.sin(k * 0.7) * 2), 3, tz0 + L + k + 1, cols[i % 5]);
    }
  } else if (s === 2) {
    // Spiral Museum: an inverted white spiral that widens as it rises
    const turns = [2, 3, 4, 5, 6][lv - 1];
    const R0 = [5, 7, 9, 11, 13][lv - 1];
    const cz = (z0 + z1) / 2 - 1;
    for (let t = 0; t < turns; t++) {
      const r = R0 + t * 1.2;
      const y = 1 + t * 4;
      disc(v, 0, cz, y, y + 4, r, (x, yy, z, d) => (d < r - 1.6 ? (yy === y ? "#e9e4da" : null) : yy === y + 2 ? ["#ffe9c4", 0.5] : "#fbfbf7"));
    }
    disc(v, 0, cz, 1 + turns * 4, 2 + turns * 4, R0 + turns * 1.2, (x, y, z, d) => (d < 2.5 ? ["#bfe9df", 0.4] : "#fbfbf7"));
    v.box(-2, 1, Math.round(cz + R0) - 1, 2, 4, Math.round(cz + R0) + 1, "#ffd9a0", 0.9);
  } else {
    // Floating Cubes: stacked, cantilevered white boxes with one glass face each
    const n = [2, 3, 4, 5, 7][lv - 1];
    let y = 1;
    for (let i = 0; i < n; i++) {
      const k = [0.7, 0.9, 1.2, 1.4, 1.5][lv - 1];
      const w = Math.round((12 + ((i * 7) % 6)) * k), d = Math.round((10 + ((i * 5) % 5)) * k);
      const ox = Math.round(Math.sin(i * 1.7) * (x1 - x0) * 0.18) - Math.floor(w / 2);
      const oz = Math.round(Math.cos(i * 1.3) * (z1 - z0) * 0.15) - Math.floor(d / 2);
      const fh = lv >= 3 ? 7 : 5;
      v.box(ox, y, oz, ox + w, y + fh, oz + d, i % 3 === 2 ? "#2b2d42" : "#fbfbf7");
      glassFront(v, ox + 1, ox + w - 1, y + 1, y + fh - 1, oz + d - 1, "#c9ced6", 4, "#ffe9c4");
      y += fh;
    }
    v.box(-1, 1, -1, 1, y, 1, "#c9ced6");
  }
  crowd(c, 3 + lv * 2, x0 + 2, z1 - 2, x1 - 2, z1 + 2);
  if (lv >= 3) for (let i = 0; i < 2; i++) tree(v, i ? x1 - 3 : x0 + 2, 1, z1, "birch", 1.1, i);
}

override(
  "art_gallery",
  buildGallery,
  ["Artist Studio", "White-Cube Gallery", "Sculpture Court", "Contemporary Wing", "Island Art Museum"],
  "An artist studio grows into a museum you can read from the air: a monumental empty gold frame you walk through, giant paint tubes squeezing color into the plaza, a widening white spiral, or a stack of floating cubes.",
);
