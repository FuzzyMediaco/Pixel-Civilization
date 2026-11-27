// Only the surface of this fictional underground parcel is visible. Its leaves expose a lit color well.
import { byLv, lot, person, type Ctx, type PixelVox } from "./kit";
import { disc } from "./commerceKit";
import { siloHatchLayout, siloHatchPlate, type VoxelPoint } from "./militaryDisplayKit";

const brass = "#c59c5c",
  dark = "#354451",
  stone = "#999b92",
  cream = "#e7d9b3";
const teal = "#4e8980",
  amber = "#ffd482",
  indigo = "#555677",
  coral = "#ce755c";
type Outline = (u: number, w: number) => boolean;
type Paint = (u: number, w: number, x: number, z: number) => [string, number, number];
const ellipse: Outline = (u, w) => u * u + w * w <= 1;

function booth(c: Ctx, x: number, z: number, body: string, w = 4) {
  const { v } = c;
  v.box(x - 1, 0, z - 1, x + w + 1, 1, z + 5, stone);
  v.hollowBox(x, 1, z, x + w, 5, z + 4, body);
  v.box(x + 1, 2, z + 3, x + w - 1, 5, z + 4, "#e3bd8e", 0.34);
  v.box(x + w - 1, 2, z + 1, x + w, 4, z + 3, "#c6b893", 0.25);
  v.box(x - 1, 5, z - 1, x + w + 1, 6, z + 5, cream);
  v.box(x, 6, z, x + w, 7, z + 3, body);
  person(v, x + w - 1, 1, z + 5, "#586e83");
}
function grate(v: PixelVox, x: number, z: number, r: number, body = stone) {
  v.box(x - r, 1, z - r, x + r + 1, 2, z + r + 1, body);
  v.box(x - r, 2, z - r, x + r + 1, 3, z + r + 1, dark);
  for (let dx = -r; dx <= r; dx += 2) v.box(x + dx, 2, z - r, x + dx + 1, 3, z + r + 1, "#b6b6a6");
  v.put(x + r, 3, z - r, amber, 0.45);
}
function marker(v: PixelVox, x: number, z: number, light = amber) {
  v.box(x - 1, 1, z - 1, x + 1, 2, z + 1, dark);
  v.put(x, 2, z, light, 0.6);
}
function path(v: PixelVox, x0: number, z0: number, x1: number, z1: number, w = 2) {
  v.box(x0 - w, 0, z0, x1 + w, 1, z0 + w, cream);
  v.box(x1 - w, 0, z0, x1 + w, 1, z1 + w, cream);
}

// Paint both the inset and its two moving covers from the same closed outline.
function cover(
  c: Ctx,
  center: VoxelPoint,
  rx: number,
  rz: number,
  axis: "x" | "z",
  travel: number,
  shape: Outline,
  split: (u: number, w: number) => number,
  paint: Paint,
  rim: string,
  glow: string,
) {
  const [cx, cy, cz] = center,
    { v } = c;
  const leaves = [-1, 1].map((side) =>
    siloHatchPlate(c, center, axis === "x" ? [side * travel, 0, 0] : [0, 0, side * travel]),
  );
  for (let x = -rx - 2; x <= rx + 1; x++)
    for (let z = -rz - 2; z <= rz + 1; z++) {
      const u = (x + 0.5) / rx,
        w = (z + 0.5) / rz;
      if (!shape((x + 0.5) / (rx + 1.5), (z + 0.5) / (rz + 1.5))) continue;
      if (!shape(u, w)) {
        v.box(cx + x, 1, cz + z, cx + x + 1, cy + 1, cz + z + 1, rim);
        continue;
      }
      const bright = Math.abs(axis === "x" ? u : w) < 0.15 || (x + z) % 7 === 0;
      v.put(cx + x, cy - 1, cz + z, bright ? glow : dark, bright ? 0.5 : 0);
      const [color, height, light] = paint(u, w, x, z),
        leaf = leaves[split(u, w) < 0 ? 0 : 1];
      leaf.box(x, 0, z, x + 1, height + 1, z + 1, color, light);
    }
}
function orbit(c: Ctx) {
  const { v, lv, hx, hz } = c,
    { center, rx, rz, axis, travel } = siloHatchLayout(c);
  const [cx, cy, cz] = center;
  if (lv >= 3) {
    for (let x = -rx - 3; x < rx + 3; x++)
      for (let z = -rz - 3; z < rz + 3; z++)
        if (((x + 0.5) / (rx + 3)) ** 2 + ((z + 0.5) / (rz + 3)) ** 2 < 1)
          v.put(cx + x, 1, cz + z, "#806d57");
  }
  cover(
    c,
    center,
    rx,
    rz,
    axis,
    travel,
    ellipse,
    (u) => u,
    (u, w) => {
      const d = Math.hypot(u, w),
        a = Math.atan2(w, u);
      if (d < 0.19) return [brass, 2, 0.08];
      if (d > 0.84) return [brass, 1, 0];
      if (d > 0.48 && d < 0.73 && Math.abs(Math.cos(a * 3)) > 0.28)
        return [a > 1 ? "#d98475" : a < -0.6 ? "#64b9ad" : amber, 1, 0.27];
      return [Math.abs(u) < 0.08 ? dark : teal, 0, 0];
    },
    brass,
    "#74ddcb",
  );
  grate(v, -hx + 2, hz - 3, 1);
  if (lv >= 2) {
    booth(c, hx - 6, -hz + 1, teal);
    path(v, hx - 4, -hz + 6, hx - 4, hz - 2, 1);
  }
  if (lv >= 3) for (const side of [-1, 1]) marker(v, cx + side * (rx + 1), cz);
  if (lv >= 4) {
    const px = -hx + 5,
      pz = -hz + 5;
    disc(v, px, pz, 1, 3, 3.4, bronzeRim);
    disc(v, px, pz, 3, 4, 2.2, teal);
    marker(v, px, pz);
    path(v, px, pz, cx - rx, cz, 1);
  }
  if (lv === 5) {
    const rim = rz + 3;
    for (let j = 0; j < 7; j++) {
      const a = Math.PI + (j * Math.PI) / 6;
      const x = cx + Math.round((rx + 3) * Math.cos(a)),
        z = cz + Math.round(rim * Math.sin(a));
      v.box(x - 1, 1, z - 1, x + 2, cy + 2, z + 2, bronzeRim);
      v.put(x, cy + 2, z, amber, 0.42);
    }
    grate(v, hx - 5, hz - 5, 2, teal);
  }
}
const bronzeRim = "#9b7352";

const wedge: Outline = (u, w) => Math.abs(u) < 1 && Math.abs(w) < 0.94 - 0.31 * Math.abs(u + w * 0.3);
const crease = (u: number) => 0.42 * (1 - Math.abs(u * 2)) + (u < 0 ? -0.13 : 0.13);
function zigzag(c: Ctx) {
  const { v, lv, hx, hz } = c,
    { center, rx, rz, axis, travel } = siloHatchLayout(c);
  center[0] = lv === 1 ? -2 : lv >= 3 ? -3 : 0;
  if (lv === 1) center[2] = -2;
  const [cx, , cz] = center;
  cover(
    c,
    center,
    rx,
    rz,
    axis,
    travel,
    wedge,
    (u, w) => w - crease(u),
    (u, w) => {
      const line = Math.abs(w - crease(u));
      const pip = lv >= 3 && Math.abs(Math.abs(u) - 0.55) < 0.09 && Math.abs(w + 0.51) < 0.18;
      const color = line < 0.17 || pip ? cream : w < crease(u) ? indigo : "#74708e";
      return [color, Math.abs(u) > 0.81 ? 0 : lv >= 3 && Math.abs(w) > 0.32 ? 2 : 1, line < 0.17 ? 0.22 : 0];
    },
    "#817b8c",
    "#f7bb84",
  );
  grate(v, hx - 3, lv >= 3 ? -hz + 4 : hz - 3, 1, indigo);
  if (lv >= 2) {
    const boothZ = lv >= 3 ? hz - 9 : -hz + 1;
    booth(c, -hx + 2, boothZ, indigo);
    v.box(-hx + 2, 0, boothZ + 5, cx, 1, boothZ + 7, cream);
  }
  if (lv >= 3) {
    for (let j = 0; j < 4; j++)
      v.box(cx - rx + j * 2, 1, cz + rz, cx - rx + j * 2 + 2, 2, cz + rz + 2, indigo);
    marker(v, cx - rx + 1, cz + rz + 2);
  }
  if (lv >= 4) {
    const px = hx - 6,
      pz = hz - 6;
    cover(
      c,
      [px, 2, pz],
      4,
      3,
      "z",
      1,
      wedge,
      (u, w) => w - crease(u),
      (u, w) => [Math.abs(w - crease(u)) < 0.25 ? cream : indigo, 0, 0.08],
      stone,
      "#ffc38a",
    );
    path(v, cx + rx + 1, cz, px, pz, 1);
  }
  if (lv === 5) {
    // A long sawtooth ribbon of surface grilles finishes the north terrace.
    const back = -hz + 5;
    for (let i = 0; i < 4; i++) {
      const px = -hx + 4 + i * 5,
        pz = back + (i % 2) * 2;
      v.box(px - 1, 1, pz - 2, px + 5, 3, pz + 3, indigo);
      v.box(px, 3, pz - 2, px + 4, 4, pz + 2, dark);
      for (let slot = 0; slot < 4; slot += 2) v.box(px + slot, 3, pz - 2, px + slot + 1, 4, pz + 2, cream);
      if (i % 2 === 0) v.put(px + 4, 3, pz + 2, amber, 0.5);
    }
    path(v, -hx + 4, back + 3, -hx + 4, hz - 7, 1);
  }
}

function petals(c: Ctx, center: VoxelPoint, rx: number, rz: number, travel: number) {
  const [cx, cy, cz] = center;
  const hues = [coral, "#d69b72", "#ba6b58"];
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 - 0.12,
      co = Math.cos(a),
      si = Math.sin(a);
    const leaf = siloHatchPlate(c, center, [Math.round(co * travel), 0, Math.round(si * travel)]);
    for (let x = -rx - 1; x <= rx; x++)
      for (let z = -rz - 1; z <= rz; z++) {
        const u = (x + 0.5) / rx,
          w = (z + 0.5) / rz;
        const along = u * co + w * si,
          across = -u * si + w * co;
        const width = Math.max(0, 0.63 * (1 - Math.abs((along - 0.56) / 0.52)));
        if (along < 0.06 || along > 1.08 || Math.abs(across - 0.09) > width + 0.14) continue;
        const edge = Math.abs(across - 0.09) > width;
        if (edge) {
          c.v.put(cx + x, cy - 1, cz + z, bronzeRim);
          continue;
        }
        c.v.put(cx + x, cy - 1, cz + z, along < 0.64 ? "#f3b779" : dark, along < 0.64 ? 0.48 : 0);
        const stripe = (along > 0.42 && along < 0.58) || (Math.abs(across) < 0.1 && along > 0.58);
        leaf.box(x, 0, z, x + 1, along > 0.72 ? 2 : 1, z + 1, stripe ? cream : hues[k], stripe ? 0.15 : 0);
      }
  }
  c.v.cylinderY(cx, cz, 1, cy + 2, 1.4, brass);
}
function prismQuilt(c: Ctx) {
  const { v, lv, hx, hz } = c,
    { center, rx, rz, travel } = siloHatchLayout(c);
  center[0] = lv >= 3 ? -3 : 0;
  petals(c, center, rx, rz, travel);
  grate(v, hx - 3, -hz + 3, 1, coral);
  if (lv >= 2) {
    booth(c, -hx + 1, -hz + 1, coral);
    path(v, -hx + 3, -hz + 6, -hx + 3, hz - 2, 1);
  }
  if (lv >= 3) {
    const x = hx - 6,
      z = hz - 6;
    for (let j = 0; j < 4; j++) v.box(x - j, 1, z + j, x + j + 1, 2, z + j + 1, j % 2 ? cream : coral);
    marker(v, x, z + 1);
  }
  if (lv >= 4) {
    petals(c, [hx - 7, 2, -hz + 6], 4, 4, 2);
    path(v, center[0] + rx - 2, -2, hx - 7, -hz + 6, 1);
  }
  if (lv === 5) {
    petals(c, [-hx + 7, 2, hz - 7], 4, 4, 2);
    for (let j = 0; j < 3; j++) marker(v, -2 + j * 3, hz - 7 - j, cream);
    grate(v, hx - 5, hz - 7, 2, coral);
  }
}
function moon(c: Ctx, center: VoxelPoint, rx: number, rz: number, travel: number) {
  // The offset moon and four-point star share a closed pair of blue tiles.
  cover(
    c,
    center,
    rx,
    rz,
    "z",
    travel,
    ellipse,
    (_u, w) => w,
    (u, w) => {
      const d = Math.hypot(u, w),
        crescent = Math.hypot(u + 0.1, w) < 0.73 && Math.hypot(u - 0.21, w + 0.17) > 0.62;
      const star =
        Math.abs(u - 0.35) * 2.5 + Math.abs(w + 0.16) < 0.32 ||
        Math.abs(u - 0.35) + Math.abs(w + 0.16) * 3.5 < 0.27;
      return [
        crescent || star ? cream : d > 0.85 ? "#8c9ba8" : "#63729a",
        crescent ? 2 : d > 0.85 ? 1 : 0,
        crescent || star ? 0.22 : 0,
      ];
    },
    "#85949d",
    "#a4d8dd",
  );
}
function twinMoons(c: Ctx) {
  const { v, lv, hx, hz } = c,
    { center, rx, rz, travel } = siloHatchLayout(c);
  const x = lv === 1 ? -1 : -Math.floor(hx * 0.3),
    z = lv >= 3 ? -3 : -1;
  moon(c, [x, center[1], z], Math.max(3, rx - 1), Math.max(3, rz - 1), travel);
  grate(v, -hx + 2, hz - 3, 1, "#8697a5");
  if (lv >= 2) {
    const x2 = hx - 5,
      z2 = lv >= 3 ? 3 : 1,
      side = lv >= 3 ? 5 : 3;
    moon(c, [x2, 2, z2], side, side, Math.max(1, Math.floor(side * 0.4)));
    path(v, x + rx - 2, z, x2 - side, z2, 1);
  }
  if (lv >= 3) {
    booth(c, -hx + 2, -hz + 1, "#687d9a");
    marker(v, x, z + rz + 1, "#b0def0");
  }
  if (lv >= 4) {
    const height = 3;
    for (let a = -5; a < 5; a++) v.box(x + a, 1, z + rz, x + a + 1, height, z + rz + 3, stone);
    for (let a = -4; a < 4; a += 3) v.put(x + a, height, z + rz + 2, cream, 0.3);
    marker(v, hx - 4, hz - 5, "#a8dcdf");
  }
  if (lv === 5) {
    moon(c, [hx - 7, 2, -hz + 7], 5, 4, 2);
    path(v, hx - 9, -hz + 7, hx - 9, 2, 2);
    grate(v, 1, hz - 6, 2, "#8697a5");
  }
}
export function buildUndergroundMissileSilo(c: Ctx): void {
  lot(c, ["#92a382", "#a1a994", "#a5aa86", "#99ad9f"][c.variant % 4]);
  [orbit, zigzag, prismQuilt, twinMoons][c.variant % 4](c);
  if (c.lv === 1 || (c.variant === 3 && c.lv === 2)) {
    person(c.v, c.hx - 3, 1, c.hz - 2, "#617c88");
    c.v.put(c.hx - 3, 4, c.hz - 2, cream);
  }
}
