import { CAMPUS_FARM_ART } from "../campusFarmArt";
import { defineDesigns } from "./registry";
import {
  lot,
  windows,
  gable,
  hip,
  barrelRoof,
  sawtooth,
  cyl,
  ring,
  clockFace,
  tree,
  lamp,
  flag,
  fence,
  bench,
  person,
  spire,
  type Ctx,
} from "./kit";

type Roof = "gable" | "flat" | "hip" | "saw" | "barrel";
type HallStyle = { wall: string; roof: string; trim: string; shape: Roof };
const schoolIds = [
  "preschool",
  "country_schoolhouse",
  "elementary_school",
  "middle_school",
  "high_school",
  "trade_school",
  "community_college",
  "university",
  "research_university",
  "sports_field",
  "research_institute",
];
function hall(
  c: Ctx,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  s: HallStyle,
  shape: Roof = s.shape,
) {
  const v = c.v,
    a = x + w,
    b = z + d;
  v.box(x, 1, z, a, h, b, s.wall);
  windows(c, x, 2, z, a, h, b, { col: c.variant === 2 ? "glassDark" : "glass", emit: 0.42 });
  v.box(x, h - 1, z, a, h, b, s.trim);
  v.box(x + Math.floor(w / 2) - 1, 1, b - 1, x + Math.floor(w / 2) + 1, 4, b, "woodDark");
  if (shape === "gable") gable(v, x, h, z, a, b, "x", s.roof, s.trim, s.wall);
  if (shape === "hip") hip(v, x, h, z, a, b, s.roof, s.trim, 4);
  if (shape === "barrel") barrelRoof(v, x, h, z, a, b, "x", s.roof, s.trim);
  if (shape === "saw") sawtooth(v, x, h, z, a, b, s.roof, "glassDark", 4);
  if (shape === "flat") {
    v.box(x, h, z, a, h + 1, b, s.roof);
    v.box(x + 1, h + 1, z + 1, a - 1, h + 2, b - 1, s.trim);
  }
}
function pavilion(c: Ctx, x: number, z: number, s: HallStyle, scale = 1) {
  const v = c.v,
    h = 6 + scale;
  for (const i of [-2, 2]) for (const j of [-2, 2]) v.box(x + i, 1, z + j, x + i + 1, h, z + j + 1, s.trim);
  v.box(x - 3, h, z - 3, x + 4, h + 1, z + 4, s.roof);
  hip(v, x - 3, h + 1, z - 3, x + 4, z + 4, s.roof, s.trim, 3);
}
function slide(c: Ctx, x: number, z: number) {
  const v = c.v;
  for (const xd of [-1, 2]) v.box(x + xd, 1, z, x + xd + 1, 6, z + 1, "tealDark");
  v.box(x - 1, 5, z - 1, x + 3, 6, z + 2, "yellow");
  hip(v, x - 2, 7, z - 2, x + 4, z + 3, c.vpick(["red", "teal", "orange", "sky"]));
  for (let i = 0; i < 4; i++) v.box(x, 4 - i, z + 1 + i, x + 2, 5 - i, z + 2 + i, "red");
}
function swing(c: Ctx, x: number, z: number) {
  const v = c.v;
  for (const ox of [0, 5]) v.box(x + ox, 1, z, x + ox + 1, 7, z + 1, "orange");
  v.box(x, 6, z, x + 6, 7, z + 1, "yellow");
  for (const i of [2, 4]) v.box(x + i, 3, z, x + i + 1, 6, z + 1, "slate");
  v.box(x + 2, 2, z, x + 5, 3, z + 2, "teal");
}
function schoolbus(c: Ctx, x: number, z: number) {
  const v = c.v;
  v.box(x, 2, z, x + 3, 5, z + 7, "busYellow");
  v.box(x, 4, z + 1, x + 3, 5, z + 6, "glassDark");
  for (const oz of [1, 5]) for (const ox of [0, 2]) v.put(x + ox, 1, z + oz, "rubber");
  v.box(x, 5, z, x + 3, 6, z + 7, "busYellow");
  v.put(x, 3, z + 6, "warmGlow", 0.4);
}
function bleachers(c: Ctx, x: number, z: number, width: number, steps: number) {
  for (let i = 0; i < steps; i++)
    c.v.box(
      x,
      1,
      z + i,
      x + width,
      i + 2,
      z + i + 1,
      i % 2 ? "steelLight" : c.vpick(["crimson", "blueDark", "tealDark", "goldDark"]),
    );
}
function pitch(c: Ctx, x: number, z: number, w: number, d: number, track: boolean) {
  const v = c.v,
    mid = x + Math.floor(w / 2),
    cz = z + Math.floor(d / 2);
  for (let i = 0; i < w; i++)
    for (let j = 0; j < d; j++) {
      const corner = Math.hypot(
        Math.max(0, Math.abs(i - (w - 1) / 2) - w * 0.33),
        Math.max(0, Math.abs(j - (d - 1) / 2) - d * 0.27),
      );
      if (corner > Math.min(w, d) * 0.25) continue;
      const rim = i < 2 || j < 2 || i > w - 3 || j > d - 3;
      const mark = i === 2 || j === 2 || i === w - 3 || j === d - 3 || j === Math.floor(d / 2);
      v.put(
        x + i,
        1,
        z + j,
        track && rim
          ? c.vpick(["terracotta", "brickDark", "sandDark", "blueDark"])
          : mark
            ? "white"
            : (j >> 2) % 2
              ? "moss"
              : "leaf",
      );
    }
  for (const oz of [z + 2, z + d - 3]) {
    v.box(mid - 2, 2, oz, mid - 1, 5, oz + 1, "white");
    v.box(mid + 1, 2, oz, mid + 2, 5, oz + 1, "white");
    v.box(mid - 2, 4, oz, mid + 2, 5, oz + 1, "white");
  }
  if (c.variant === 1 || c.variant === 3)
    for (let oz = z + 5; oz < z + d - 4; oz += 4) v.box(mid - 1, 1, oz, mid + 2, 2, oz + 1, "cream");
}
function court(c: Ctx, x: number, z: number, w: number, d: number) {
  const v = c.v;
  v.box(x, 1, z, x + w, 2, z + d, "terracotta");
  let mx = x + Math.floor(w / 2);
  for (const zz of [z + 1, z + d - 2]) {
    v.box(mx, 2, zz, mx + 1, 6, zz + 1, "iron");
    v.box(mx - 1, 5, zz, mx + 2, 7, zz + 1, "white");
    v.put(mx, 4, zz + (zz === z + 1 ? 1 : -1), "orange");
  }
  v.box(x + 1, 1, z + Math.floor(d / 2), x + w - 1, 2, z + Math.floor(d / 2) + 1, "cream");
}
function tower(c: Ctx, x: number, z: number, h: number, s: HallStyle, bell = false) {
  const v = c.v;
  v.box(x - 2, 1, z - 2, x + 3, h, z + 3, s.wall);
  v.box(x - 3, h - 5, z - 3, x + 4, h - 4, z + 4, s.trim);
  if (bell) {
    v.box(x - 1, h - 4, z + 2, x + 2, h - 1, z + 3, "woodDark");
    v.put(x, h - 2, z + 2, "gold");
  } else {
    clockFace(v, x, h - 3, z + 2, 2);
    v.put(x + 2, h - 2, z, "white", 0.2);
  }
  hip(v, x - 3, h, z - 3, x + 4, z + 4, s.roof, s.trim);
  v.put(x, h + 4, z, "gold", 0.25);
}
function observatory(c: Ctx, x: number, z: number, r: number, h: number, s: HallStyle) {
  const v = c.v;
  cyl(v, x, z, 1, h, r, s.wall);
  ring(v, x, z, h, h + 1, r + 0.5, r - 1, s.trim);
  for (let y = 0; y <= r; y++)
    cyl(v, x, z, h + 1 + y, h + 2 + y, Math.max(0.6, Math.sqrt(r * r - y * y)), s.roof);
  for (let y = 0; y < r; y++) v.put(x, h + 1 + y, z + Math.round(Math.sqrt(r * r - y * y)), "iron");
  v.box(x, h + r + 1, z, x + 2, h + r + 3, z + 2, "steelDark");
}
function campus(c: Ctx) {
  const { v, lv, id, hx, hz, variant } = c,
    X = -hx + 2,
    Z = -hz + 2,
    W = 2 * hx - 4,
    D = 2 * hz - 4;
  const style: HallStyle = {
    wall: c.vpick(["brick", "limestone", "woodLight", "plaster"]),
    roof: c.vpick(["slate", "tealDark", "copper", "redDark"]),
    trim: c.vpick(["cream", "marble", "woodDark", "blueDark"]),
    shape: c.vpick(["gable", "hip", "flat", "barrel"]),
  };
  lot(c, c.vpick(["grass2", "grass3", "grass", "moss"]));
  const lane = Math.floor(hx * 0.24);
  v.box(lane - 1, 0, Z, lane + 2, 1, hz, "path");
  if (id === "sports_field") {
    pitch(c, X + 1, Z + 1, W - 2, D - 4, lv >= 3);
    bleachers(c, X + 2, Z + D - 2, W - 6, Math.min(4, lv));
    if (lv >= 2) flag(v, X + 2, 1, Z + 2, 5, [style.roof, "white"]);
    if (lv >= 4) for (const x of [X + 1, X + W - 2]) for (const z of [Z + 2, Z + D - 4]) lamp(v, x, 1, z, 8);
    if (lv === 5) hall(c, X + W - 10, Z + D - 6, 8, 5, 6, style, "flat");
    return;
  }
  const mainWidth = Math.min(W - 1, Math.max(8, Math.floor(W * (lv > 2 ? 0.59 : 0.7))));
  const mainDepth = Math.max(6, Math.floor(D * (id === "country_schoolhouse" ? 0.59 : 0.4)));
  const mx = X + (variant === 3 ? 2 : 0),
    mz = Z + 1;
  if (id === "preschool") {
    style.wall = c.vpick(["yellow", "woodLight", "lime", "sky"]);
    style.roof = c.vpick(["red", "leafDark", "orange", "blue"]);
    hall(c, mx, mz, mainWidth, mainDepth, 5, style);
    slide(c, X + W - 4, Z + Math.floor(D * 0.55));
    if (lv >= 2) {
      swing(c, X + 2, hz - 5);
      v.box(lane + 3, 1, hz - 6, lane + 7, 2, hz - 2, "sand");
    }
    if (lv >= 3) hall(c, X + W - 8, Z + 2, 7, 7, 6, style, "hip");
    if (lv >= 4) {
      pavilion(c, X + 5, Z + Math.floor(D * 0.54), style);
      tree(v, X + W - 5, 1, hz - 6, "blossom", 1.2);
    }
    if (lv === 5) {
      hall(c, X + 2, Z + Math.floor(D * 0.58), 12, 6, 5, style, "barrel");
      for (let j = 0; j < 4; j++)
        v.box(-4 + j * 2, 1, hz - 6, -2 + j * 2, 2 + (j % 2), hz - 4, ["orange", "red", "yellow", "blue"][j]);
    }
  } else if (id === "country_schoolhouse") {
    hall(c, mx, mz, Math.min(16, mainWidth), mainDepth, 5 + Math.floor(lv / 2), style, "gable");
    if (lv >= 2) tower(c, mx + 3, mz + 2, 10 + lv, style, true);
    if (lv >= 3) hall(c, X + W - 9, mz + 2, 8, 7, 5, style, "hip");
    if (lv >= 4) {
      pavilion(c, X + 4, hz - 6, style);
      tree(v, X + W - 6, 1, hz - 6, "autumn", 1);
    }
    if (lv === 5) {
      for (let x = 0; x < 3; x++) {
        v.box(x * 4 - 4, 2, hz - 7, x * 4 - 1, 3, hz - 4, "wood");
        v.box(x * 4 - 4, 4, hz - 7, x * 4 - 1, 5, hz - 4, x % 2 ? "cream" : "red");
      }
      flag(v, X + W - 6, 1, 1, 8);
    }
  } else if (id === "elementary_school" || id === "middle_school" || id === "high_school") {
    const senior = id === "high_school",
      junior = id === "middle_school";
    hall(c, mx, mz, mainWidth, mainDepth, (senior ? 9 : junior ? 7 : 5) + (lv >= 3 ? 3 : 0), style);
    if (senior) {
      pitch(c, X + 2, Z + Math.floor(D * 0.5), W - 5, Math.floor(D * 0.5) - 2, lv >= 3);
      if (lv >= 2) hall(c, X + W - 12, Z + 2, 10, 9, 7, style, "barrel");
    } else if (junior) {
      court(
        c,
        X + 2,
        hz - Math.max(8, Math.floor(D * 0.44)),
        Math.max(8, Math.floor(W * 0.47)),
        Math.max(7, Math.floor(D * 0.42)),
      );
      if (lv >= 2) hall(c, X + W - 8, Z + 3, 6, 7, 9, style, "flat");
    } else {
      slide(c, X + W - 5, hz - 7);
      if (lv >= 2) swing(c, X + 3, hz - 6);
    }
    if (lv >= 3 && !senior)
      hall(c, X + W - 10, mz + mainDepth + 1, 8, 6, junior ? 8 : 6, style, junior ? "barrel" : "gable");
    if (lv >= 4) {
      if (senior) bleachers(c, X + 3, hz - 6, W - 7, 3);
      else schoolbus(c, X + W - 6, hz - 10);
    }
    if (lv === 5) {
      tower(c, mx + mainWidth - 3, mz + 3, senior ? 22 : 16, style);
      if (senior) for (const x of [X + 2, X + W - 3]) lamp(v, x, 1, hz - 7, 12);
    }
  } else if (id === "trade_school") {
    style.wall = c.vpick(["brickDark", "steelLight", "concrete", "woodDark"]);
    hall(c, mx, mz, mainWidth, mainDepth, 6 + lv, style, "saw");
    for (let x = mx + 2; x < mx + mainWidth - 2; x += 4)
      v.box(x, 1, mz + mainDepth - 1, x + 3, 5, mz + mainDepth, "steelDark");
    if (lv >= 2) cyl(v, X + W - 4, Z + 3, 1, 9 + lv, 2, "steel");
    if (lv >= 3) hall(c, X + 2, hz - 11, Math.min(15, W - 3), 7, 6, style, "barrel");
    if (lv >= 4) {
      const x = X + W - 7,
        z = hz - 8;
      v.box(x, 1, z, x + 2, 15, z + 2, "hazard");
      v.box(x - 8, 14, z, x + 3, 16, z + 2, "hazard");
      v.box(x - 7, 7, z, x - 6, 14, z + 1, "iron");
    }
    if (lv === 5) {
      hall(c, X + W - 16, Z + 8, 13, 12, 9, style, "saw");
      c.smoke(mx + 2, 9 + lv, mz + 3, "steam");
    }
  } else if (id === "community_college" || id === "university") {
    const collegiate = id === "university";
    hall(
      c,
      mx,
      mz,
      mainWidth,
      mainDepth,
      collegiate ? 9 + lv : 7 + lv,
      style,
      collegiate ? "gable" : style.shape,
    );
    // Covered colonnades face the shared lawn.
    for (let x = mx + 1; x < mx + mainWidth; x += 3)
      v.box(x, 1, mz + mainDepth, x + 1, 5, mz + mainDepth + 2, style.trim);
    v.box(mx, 5, mz + mainDepth, mx + mainWidth, 6, mz + mainDepth + 2, style.roof);
    if (lv >= 2) hall(c, X + W - 8, mz, 7, Math.floor(D * 0.65), 7 + lv, style, collegiate ? "gable" : "flat");
    if (lv >= 3) {
      if (collegiate) tower(c, mx + Math.floor(mainWidth * 0.55), mz + 4, 14 + lv * 2, style);
      else hall(c, X + 2, hz - 12, 11, 9, 8, style, "saw");
    }
    if (lv >= 4) {
      hall(c, X + 1, Z + Math.floor(D * 0.55), 9, Math.floor(D * 0.38), 8 + lv, style);
      tree(v, lane + 5, 1, hz - 8, "round", 1.4);
    }
    if (lv === 5) {
      hall(c, X + W - 19, hz - 12, 15, 8, 10, style, "hip");
      pavilion(c, lane + 3, 4, style, 2);
      flag(v, X + 3, 1, hz - 5, 10, [style.roof, "white"]);
    }
  } else {
    const institute = id === "research_institute";
    style.wall = c.vpick(["steelLight", "cream", "glassDark", "limestone"]);
    style.roof = c.vpick(["silver", "tealDark", "blueDark", "copper"]);
    hall(c, mx, mz, mainWidth, mainDepth, 7 + lv, style, "flat");
    if (institute || lv >= 3) observatory(c, X + W - 5, mz + 5, Math.min(5, 2 + lv), 6 + lv, style);
    if (lv >= 2) hall(c, X + 1, hz - 9, Math.min(W - 2, 10 + lv * 2), 7, 7, style, "saw");
    if (lv >= 3 && institute) {
      for (const x of [X + 4, X + 10]) {
        cyl(v, x, hz - 5, 1, 5, 1, "steel");
        ring(v, x, hz - 5, 5, 6, 3, 1, "cream");
      }
    }
    if (lv >= 4) {
      const x = X + W - 8,
        z = hz - 10;
      hall(c, x - 3, z - 3, 7, 7, 11 + lv * 2, style, "flat");
      spire(v, x, z, 12 + lv * 2, 6, 2, "steel");
      c.blink(x, 20 + lv * 2, z, "red");
    }
    if (lv === 5) hall(c, X + 4, Z + Math.floor(D * 0.48), Math.floor(W * 0.5), 8, 11, style, "barrel");
    if (institute) {
      const x = X + Math.floor(W * 0.5),
        z = Z + Math.floor(D * 0.57);
      cyl(v, x, z, 1, 4 + lv, 1, "steel");
      for (let i = -3; i <= 3; i++)
        for (let j = -3; j <= 3; j++) {
          if (i * i + j * j > 11) continue;
          v.put(x + i, 5 + lv + Math.floor((i + 3) / 2) + Math.floor((i * i + j * j) / 8), z + j, "cream");
        }
      v.box(x, 5 + lv, z, x + 1, 10 + lv, z + 1, "iron");
      v.put(x, 10 + lv, z, "amber");
    } else if (lv >= 3) {
      const x = X + W - 12,
        z = Z + Math.floor(D * 0.39);
      hall(c, x, z, 9, 8, 8 + lv, style, "flat");
      for (let i = 0; i < 5; i += 2) v.box(x + i, 2, z + 7, x + i + 1, 7 + lv, z + 8, "glassDark", 0.4);
    }
  }
  const gate = lane;
  fence(v, -hx + 1, -hz + 1, hx - 1, hz - 1, 1, 2, style.trim, [gate - 2, gate + 3]);
  if (lv >= 2) person(v, gate, 1, hz - 3, style.roof);
  if (lv >= 3) lamp(v, gate - 3, 1, hz - 4, 5);
  if (lv >= 4) for (let x = X + 3; x < hx - 4; x += 12) bench(v, x, 1, hz - 4);
  if (variant === 1) tree(v, X + W - 3, 1, Z + 2, "cypress", 0.8, 4);
  if (variant === 2) flag(v, X + 1, 1, hz - 3, 5, [style.roof, "cream"]);
}
defineDesigns(
  Object.fromEntries(
    schoolIds.map((id) => [
      id,
      { ...CAMPUS_FARM_ART[id], growth: CAMPUS_FARM_ART[id].levels.join(" → "), build: campus },
    ]),
  ),
);
