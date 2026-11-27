import { buildExecutiveResidence, WHITE_HOUSE_LEVELS } from "./executiveResidence";
import { type Ctx, PixelVox, archway, bench, colonnade, cyl, flag, flowerBed, fountain,
  gable, hip, lamp, lot, pediment, person, ring, stairs, tree, windows } from "./kit";
import { defineDesigns } from "./registry";

type Point = [number, number, number];

// Walk a voxel beam along its longest axis so lattice joints and curved braces meet.
function beam(v: PixelVox, a: Point, b: Point, col: string, thickness = 1, glow = 0): void {
  const n = Math.max(1, ...a.map((p, i) => Math.abs(b[i] - p)).map(Math.ceil));
  for (let i = 0; i <= n; i++) {
    const [x, y, z] = a.map((p, k) => Math.round(p + (b[k] - p) * i / n));
    v.box(x, y, z, x + thickness, y + thickness, z + thickness, col, glow);
  }
}

function paradeGround(c: Ctx): void {
  const { v, hx, hz, variant, lv } = c;
  const paving = c.vpick(["limestone", "path", "concrete", "marbleShade"]);
  lot(c, "grass2");
  v.box(-hx + 2, 0, -hz + 2, hx - 2, 1, hz - 2, paving);
  for (let i = -hx + 4; i < hx - 3; i += 5) {
    v.box(i, 0, -hz + 2, i + 1, 1, hz - 2, "path2");
  }
  v.box(-2, 0, -hz, 2, 1, hz, paving);
  for (const side of [-1, 1]) {
    const x = side * (hx - 3);
    for (let z = -hz + 4; z < hz - 2; z += 8) {
      if (variant === 1) flowerBed(c, x - 1, z - 2, x + 1, z + 2, 1, ["pink", "red", "cream"]);
      else if (variant === 2) bench(v, x, 1, z, "z", "woodLight");
      else if (variant === 3 || lv >= 4) tree(v, x, 1, z, variant === 3 ? "cypress" : "round", 0.8);
    }
    if (lv >= 2) lamp(v, x, 1, hz - 3, 4, "iron");
  }
}

function triumph(c: Ctx): void {
  const { v, hx, lv, variant } = c;
  paradeGround(c);
  const wall = c.vpick(["limestone", "brick", "granite", "#c8d5ce"]);
  const trim = c.vpick(["marble", "sand", "brass", "tealDark"]);
  const w = Math.min(hx - 4, 4 + lv * 2);
  const height = 6 + lv * 3;
  const depth = 2 + Math.floor(lv / 2) + (variant === 2 ? 1 : 0);
  const z = -2;
  v.box(-w - 1, 1, z - depth - 1, w + 1, 2, z + depth + 1, trim);
  v.box(-w, 2, z - depth, w, height, z + depth, wall);
  const opening = Math.max(4, Math.round(w * (lv < 3 ? 1 : 0.75)));
  archway(v, 0, 2, z - depth, z + depth, opening, height - 5, trim);
  if (lv >= 3) for (const s of [-1, 1]) archway(v, s * (w - 2.5), 2, z - depth, z + depth, 3, height * 0.43, trim);
  v.box(-w - 1, height - 2, z - depth - 1, w + 1, height - 1, z + depth + 1, trim);
  v.box(-w, height, z - depth, w, height + 2, z + depth, wall);
  for (let x = -w + 2; x < w; x += 3) v.put(x, height, z + depth, trim, 0.15);
  if (variant === 0) pediment(v, -w + 1, w - 1, height + 2, z - depth, z + depth, wall, trim);
  if (variant === 1) for (const x of [-w + 1, 0, w - 2]) {
    cyl(v, x, z, height + 2, height + 4, 1.5, trim);
    v.dome(x, height + 4, z, 1.7, "tealDark");
  }
  if (variant === 2) for (const x of [-w, w - 3]) {
    v.box(x, height, z - depth, x + 3, height + 5, z + depth, wall);
    v.box(x + 1, height + 5, z - depth, x + 2, height + 7, z + depth, "gold");
  }
  if (variant === 3) hip(v, -w - 1, height + 2, z - depth - 1, w + 1, z + depth + 1, "tealDark", "brass", 3);
  if (lv >= 4) for (const x of [-w, w - 1]) for (const zz of [z - depth - 1, z + depth]) {
    v.box(x, 2, zz, x + 1, height - 3, zz + 1, trim);
  }
  if (lv >= 3) {
    // Recessed votive flame and inset relief figures in the two inner piers.
    const forecourt = z + depth + 3;
    cyl(v, 0, forecourt, 1, 2, 2, "granite");
    cyl(v, 0, forecourt, 2, 3, 1.25, "brass");
    v.put(0, 3, forecourt, "fire", 1.2);
    if (lv >= 4) {
      v.put(-1, 3, forecourt, "orange", 1.0);
      v.put(0, 4, forecourt, "warmGlow", 1.3);
      for (const s of [-1, 1]) {
        const x = s * (Math.ceil(opening / 2) + 1), zz = z + depth;
        v.box(x - 1, height - 8, zz, x + 2, height - 3, zz + 1, wall);
        v.box(x, height - 7, zz, x + 1, height - 4, zz + 2, trim);
        v.put(x + s, height - 6, zz + 1, trim);
      }
    }
  }
  if (lv === 5) {
    const base = height + (variant === 0 ? Math.ceil((w * 2 - 2) / 4) + 2 : variant === 3 ? 5 : 2);
    v.box(-5, base, z - 3, 6, base + 1, z + 4, trim);
    for (const x of [-4, -2, 1, 3]) {
      for (const zz of [z - 1, z + 1]) v.put(x, base + 1, zz, "brass");
      v.box(x, base + 2, z - 1, x + 1, base + 3, z + 2, "brass");
      v.box(x, base + 3, z + 1, x + 1, base + 5, z + 2, "gold");
    }
    v.box(-1, base + 2, z - 3, 2, base + 4, z - 1, "copper");
    for (const x of [-2, 2]) v.put(x, base + 1, z - 2, "brass");
    v.put(0, base + 4, z - 2, "gold");
    for (const x of [-w - 4, w + 2]) flag(v, x, 1, 6, 8, [trim, wall]);
  }
}

function obelisk(c: Ctx): void {
  const { v, lv, hx, hz, variant } = c;
  paradeGround(c);
  const z = -Math.floor(hz / 3);
  const w = 2 + Math.floor(lv / 2);
  const h = [11, 20, 30, 42, 57][lv - 1];
  const stone = c.vpick(["marble", "limestone", "#d9d4cf", "#f3e7d0"]);
  for (let s = 0; s < lv; s++) v.box(-w - lv + s, 1 + s, z - w - lv + s, w + lv - s, 2 + s, z + w + lv - s, s % 2 ? stone : "marbleShade");
  const y0 = 1 + lv;
  for (let y = 0; y < h; y++) {
    const radius = Math.max(1, Math.round(w * (1 - y / (h * 2.6))));
    v.box(-radius, y0 + y, z - radius, radius, y0 + y + 1, z + radius, y === Math.floor(h * 0.28) ? "marbleShade" : stone);
  }
  const tip = Math.max(1, Math.round(w * 0.61));
  hip(v, -tip, y0 + h, z - tip, tip, z + tip, "white");
  const end = z + w + lv + 2;
  if (lv >= 2) {
    const r = Math.min(3 + (variant % 2) * 2, hx - 4);
    v.box(-r - 1, 0, end, r + 1, 1, hz - 2, "marble");
    v.box(-r, 0, end + 1, r, 1, hz - 3, "water", 0.15);
    if (variant === 1) v.box(-1, 0, end + 1, 1, 1, hz - 3, "marbleShade");
    if (variant === 3) fountain(v, 0, 1, hz - 6, r - 1);
  } else if (variant === 1) fountain(v, 0, 1, 4, 3);
  else if (variant === 2) stairs(v, -5, 5, 1, 5, 2);
  if (lv >= 3 || variant === 0) {
    const count = [2, 4, 6, 8, 12][lv - 1];
    for (let i = 0; i < count; i++) {
      const a = (i + 0.5) * 2 * Math.PI / count;
      flag(v, Math.floor(Math.cos(a) * (w + lv + 2)), 1, z + Math.floor(Math.sin(a) * (w + lv + 2)), 4, ["blueDark", "white", "red"]);
    }
  }
  if (lv >= 4) for (const s of [-1, 1]) for (let zz = end; zz < hz - 2; zz += 5) {
    lamp(v, s * (hx - 6), 1, zz, variant === 2 ? 4 : 2, "granite", "warmGlow");
  }
  if (lv === 5) {
    // The pale pyramidion and pairs of observation apertures read against the sky.
    for (const s of [-1, 1]) {
      v.put(s, y0 + h - 2, z + tip - 1, "slateLight");
      v.put(tip - 1, y0 + h - 2, z + s, "slateLight");
    }
    v.cone(0, y0 + h, y0 + h + 4, z, tip + 0.3, 0.5, "white");
  }
}

function smithsonian(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  paradeGround(c);
  const wall = c.vpick(["#a9543c", "#b96444", "#9b503b", "#b05d45"]);
  const roof = c.vpick(["slate", "tealDark", "brickDark", "steelDark"]);
  const w = Math.min(hx - 4, 4 + lv * 3);
  const z = -Math.floor(hz / 4);
  const h = 6 + lv;
  v.hollowBox(-w, 1, z - 4, w, h, z + 5, wall);
  windows(c, -w, 1, z - 4, w, h, z + 5, { h: 3, col: "glassDark", sill: "brick" });
  gable(v, -w - 1, h, z - 5, w + 1, z + 6, "x", roof, "brickDark");
  const turret = (x: number, zz: number, r: number, top: number, round: boolean) => {
    if (round) {
      cyl(v, x, zz, 1, top, r + 0.5, wall);
      ring(v, x, zz, top - 3, top - 2, r + 1, r, "sandDark");
      v.cone(x, top, top + r + 4, zz, r + 1, 0.5, roof);
    } else {
      v.hollowBox(x - r, 1, zz - r, x + r + 1, top, zz + r + 1, wall, "brick");
      hip(v, x - r - 1, top, zz - r - 1, x + r + 2, zz + r + 2, roof);
      for (let xx = x - r; xx <= x + r; xx += 2) v.put(xx, top - 2, zz + r + 1, "sandDark");
    }
    for (let y = 5; y < top - 1; y += 4) v.box(x, y, zz + r, x + 1, y + 2, zz + r + 1, "glassDark", 0.35);
  };
  turret(variant % 2 ? -2 : 2, z + 4, lv < 3 ? 2 : 3, h + 3 + lv * 2, variant === 1);
  if (lv >= 2) turret(-w + 2, z - 3, 2, h + 4, variant !== 2);
  if (lv >= 3) turret(w - 2, z - 3, 2, h + 6, variant === 0);
  if (lv >= 4) for (const s of [-1, 1]) {
    turret(s * (w - 2), z + 5, 2, h + (s > 0 ? 3 : 5), true);
    flowerBed(c, s * (w - 2) - 2, hz - 6, s * (w - 2) + 2, hz - 3, 1, ["red", "amber"]);
  }
  archway(v, 0, 1, z + 3, z + 6, 3, 5, "sandDark");
  if (variant === 3 || lv === 5) {
    const a = Math.min(w - 2, 6);
    v.box(-a, 5, z + 6, a + 1, 6, z + 10, roof);
    colonnade(v, -a, a + 1, z + 9, 1, 5, "x", 3, wall, "sandDark");
  }
  if (lv === 5) {
    turret(-5, z - 3, 3, h + 12, false);
    flag(v, -5, h + 16, z - 3, 5, ["red", "white"]);
  }
}

function eiffel(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  paradeGround(c);
  const r = Math.min(hx - 4, hz - 4, 5 + 2 * lv);
  const h = [14, 24, 38, 55, 76][lv - 1];
  const metal = c.vpick(["#935b42", "#805844", "#675750", "#917660"]);
  const rim = c.vpick(["copper", "brass", "steelLight", "warmGlow"]);
  const profile = (t: number) => Math.max(0.8, r * ((1 - t) ** 2.4));
  const stages = 4 + lv * 2;
  for (let i = 0; i < stages; i++) {
    const t = i / stages, next = (i + 1) / stages;
    const a = profile(t), b = profile(next), y = 2 + h * t, y1 = 2 + h * next;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      beam(v, [sx * a, y, sz * a], [sx * b, y1, sz * b], metal, t < 0.23 && lv >= 3 ? 2 : 1);
      if (i === 0) v.box(sx * a - 2, 1, sz * a - 2, sx * a + 3, 3, sz * a + 3, "granite");
      if (t >= 0.2 || lv <= 2) {
        beam(v, [sx * a, y, sz * a], [-sx * b, y1, sz * b], metal);
        beam(v, [sx * a, y, sz * a], [sx * b, y1, -sz * b], metal);
      } else {
        // Splayed ribs leave a navigable arch between all four feet.
        beam(v, [sx * a, y, sz * a], [sx * a * 0.6, y1, sz * b], metal);
      }
      if (variant === 1 || (variant === 3 && i % 2 === 0)) v.put(sx * a, y, sz * a, "warmGlow", 1.1);
    }
  }
  if (lv >= 3) {
    const foot = Math.round(profile(0.09)), shoulder = Math.round(profile(0.21));
    for (let dx = -foot; dx <= foot; dx++) {
      const t = Math.abs(dx) / foot;
      const y = Math.round(2 + h * (0.1 + 0.14 * Math.sqrt(1 - t * t)));
      const depth = Math.round(shoulder + t * (foot - shoulder));
      for (const side of [-1, 1]) {
        v.put(dx, y, side * depth, metal);
        v.put(side * depth, y, dx, metal);
        if (dx % 3 === 0) {
          v.put(dx, y + 1, side * depth, rim);
          v.put(side * depth, y + 1, dx, rim);
        }
      }
    }
  }
  for (const t of [0.25, 0.51, 0.88]) {
    const w = Math.ceil(profile(t)) + 1;
    const y = Math.round(2 + h * t);
    v.box(-w, y, -w, w + 1, y + 1, w + 1, rim);
    if (lv >= 3) {
      const light = c.vpick(["amber", "warmGlow", "sky", "cream"]);
      for (let xx = -w; xx <= w; xx += lv === 5 ? 2 : 3) for (const side of [-1, 1]) {
        v.put(xx, y, side * w, light, 0.8);
        v.put(side * w, y, xx, light, 0.8);
      }
    }
    if (lv >= 3 && t < 0.8) for (let x = -w; x <= w; x += 2) for (const s of [-1, 1]) v.put(x, y + 1, s * w, metal);
  }
  if (variant === 2 || lv >= 4) v.box(-1, h - 3, -1, 2, h + 2, 2, "glass", 0.55);
  if (variant === 0) {
    // A lift cabin travels up the east leg on the exhibition tower.
    const y = 2 + h * 0.15, p = profile(0.15);
    v.box(p - 1, y, p - 1, p + 2, y + 2, p + 2, "brickDark");
    v.put(p + 1, y + 1, p, "glass", 0.45);
  } else if (variant === 1) {
    const y = Math.round(2 + h * 0.25), w = Math.ceil(profile(0.25));
    for (let xx = -w; xx <= w; xx++) for (const side of [-1, 1]) {
      v.put(xx, y + 2, side * w, xx % 2 ? "warmGlow" : "brass", 0.6);
      if (xx % 2 === 0) v.put(xx, y + 1, side * w, metal);
    }
  } else if (variant === 3) {
    for (const side of [-1, 1]) {
      const xx = side * (r - 1);
      v.box(xx - 1, 1, -2, xx + 2, 4, 2, "cream");
      hip(v, xx - 2, 4, -3, xx + 3, 3, "tealDark");
    }
  }
  v.box(0, h + 2, 0, 1, h + 3 + lv, 1, metal);
  c.blink(0, h + 3 + lv, 0, "warmGlow");
  if (lv >= 4) for (let i = 1; i < stages; i++) {
    const t = i / stages, p = Math.round(profile(t)), y = Math.round(2 + h * t);
    for (const s of [-1, 1]) v.put(s * p, y, (i % 2 ? -1 : 1) * p, "warmGlow", lv === 5 ? 0.85 : 0.45);
  }
  if (lv >= 3) for (const s of [-1, 1]) {
    if (variant === 3) fountain(v, s * r, 1, 0, 3);
    else bench(v, s * r - 1, 1, 0);
  }
}

function eye(c: Ctx): void {
  const { v, lv, hx, hz, variant } = c;
  // A boardwalk on piles leaves water visible under and behind the wheel.
  const r = Math.min(hx - 3, 5 + 3 * lv);
  const cy = r + 5;
  const rim = c.vpick(["white", "marble", "chrome", "#c3ddd9"]);
  const accent = c.vpick(["crimson", "teal", "indigo", "copper"]);
  v.box(-hx + 1, 2, -4, hx - 1, 3, hz - 2, "wood");
  for (let x = -hx + 2; x < hx - 1; x += 5) {
    for (const z of [-4, hz - 4]) v.box(x, 0, z, x + 2, 2, z + 2, "woodDark");
    v.box(x, 2, -4, x + 1, 3, hz - 2, "oak");
  }
  for (const s of [-1, 1]) {
    beam(v, [s * Math.round(r * 0.7), 3, -3], [0, cy, -2], "white", lv >= 4 ? 2 : 1);
    beam(v, [s * Math.round(r * 0.45), 3, Math.min(hz - 4, r)], [0, cy, 2], rim, 2);
  }
  v.box(-1, cy, -3, 2, cy + 2, 4, accent);
  const wheel = new PixelVox();
  wheel.ringZ(0.5, 0.5, 0, 1, r, r - 1.3, rim);
  const cabins = 4 + lv * 2;
  for (let i = 0; i < cabins; i++) {
    const a = 2 * Math.PI * i / cabins;
    const x = Math.round(r * Math.sin(a)), y = Math.round(r * Math.cos(a));
    beam(wheel, [0, 0, 0], [x, y, 0], "steelLight");
    if (variant >= 2 && lv >= 2) beam(wheel, [0, 0, 1], [x, y, -1], rim);
    const big = r >= 9;
    wheel.sphere(x + 0.5, y + 0.5, 0.5, big ? 1.8 : 1.25, big ? 1.6 : 1.15, big ? 1.8 : 1.15, "#80b9c4", 0.35);
    wheel.put(x, y + 1, 0, i % 3 === 0 ? accent : rim);
    if (big) wheel.put(x, y, 1, accent, 0.16);
  }
  if (variant === 0) {
    const zz = Math.min(hz - 3, 4);
    v.box(-2, 3, zz, 2, 4, zz + 2, "crimson");
  } else if (variant === 2) {
    wheel.ringZ(0.5, 0.5, -1, 0, Math.max(2, r - 2), Math.max(1, r - 2.8), "indigo", 0.45);
  } else if (variant === 3) {
    for (const side of [-1, 1]) {
      const out = Math.round(r * 0.6) * side;
      beam(v, [out, 3, 3], [0, cy + 2, 1], "copper");
    }
    wheel.ringZ(0.5, 0.5, 0, 2, 2.2, 1, "copper");
  }
  c.addRotor({ vox: wheel, pivot: [0, cy, 0], axis: "z", speed: 0.065 });
  if (lv >= 2) for (let x = -hx + 3; x < hx - 4; x += 4) lamp(v, x, 3, hz - 3, 3, "iron");
  if (lv >= 3) {
    v.hollowBox(-hx + 2, 3, 4, -hx + 9, 8, 9, "cream");
    gable(v, -hx + 1, 8, 3, -hx + 10, 10, "x", accent);
    for (let i = 0; i < lv; i++) person(v, -hx + 5 + i * 2, 3, 10 + i % 2, accent);
  }
  if (lv >= 4) for (let x = 3; x < hx - 3; x += 3) bench(v, x, 3, hz - 6, "z");
  if (lv === 5 || variant === 1) {
    const right = hx - 2;
    for (let x = right - 6; x < right; x += 3) {
      v.box(x, 3, 4, x + 1, 7, 5, rim);
      v.box(x, 3, 8, x + 1, 7, 9, rim);
    }
    v.box(right - 7, 7, 3, right, 8, 10, accent);
  }
}

function pyramids(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  for (let z = -hz; z < hz; z++) {
    for (let x = -hx; x < hx; x++) {
      const u = (x + 0.5) / hx, w = (z + 0.5) / hz;
      if (u * u + w * w <= 0.92 + 0.06 * Math.sin(x * 0.4 + z * 0.3)) {
        v.put(x, 0, z, (x * 5 + z * 3) % 7 === 0 ? "sandDark" : "sand");
      }
    }
  }
  const stone = c.vpick(["limestone", "#dfb878", "#ecce9a", "#d6ad79"]);
  const seam = c.vpick(["sand", "#c49a62", "limestone", "#bd9267"]);
  const pyramid = (cx: number, cz: number, r: number, tall: number) => {
    // Only terrace edges and exposed treads need stones.
    for (let y = 0; y < tall; y++) {
      const w = Math.max(1, Math.ceil(r * (1 - y / tall)));
      const next = Math.ceil(r * (1 - (y + 1) / tall));
      const border = Math.max(1, w - next);
      const color = y >= tall - 2 ? (variant === 2 ? "marble" : "gold") : y % 4 === 0 ? seam : stone;
      v.box(cx - w, y + 1, cz - w, cx + w, y + 2, cz - w + border, color);
      v.box(cx - w, y + 1, cz + w - border, cx + w, y + 2, cz + w, color);
      for (const x of [cx - w, cx + w - border]) v.box(x, y + 1, cz - w, x + border, y + 2, cz + w, color);
      if (variant === 1 && w >= 3) v.box(cx - 1, y + 1, cz + w - 1, cx + 1, y + 2, cz + w, "limestone");
    }
    v.box(cx - 1, 1, cz + r - 1, cx + 1, 3, cz + r, "woodDark");
  };
  const cx = lv >= 3 ? -Math.floor(hx * 0.37) : 0, cz = -Math.floor(hz * 0.24);
  const r = Math.min(hx - Math.abs(cx) - 2, hz - Math.abs(cz) - 2, 4 + lv * 2);
  if (lv === 1) {
    // Low rectangular mastaba with a flat roof and recessed offering chapel.
    for (let y = 1; y <= 4; y++) {
      const step = Math.floor(y / 2);
      v.box(cx - r + step, y, cz - r + step, cx + r - step, y + 1, cz + r - step + 2, y === 4 ? stone : seam);
    }
    v.box(cx - 1, 1, cz + r, cx + 1, 4, cz + r + 2, "woodDark");
    v.box(cx - 2, 4, cz + r - 1, cx + 2, 5, cz + r + 2, stone);
  } else if (lv === 2) {
    // Six distinct stacked platforms precede the continuous casing of Khufu's pyramid.
    for (let course = 0; course < 6; course++) {
      const half = Math.max(1, Math.round(r * (1 - course / 6))), y = 1 + course * 2;
      v.box(cx - half, y, cz - half, cx + half, y + 2, cz + half, course % 2 === 0 ? stone : seam);
    }
    v.box(cx - 2, 1, cz + r, cx + 2, 4, cz + r + 2, stone);
    v.box(cx - 1, 1, cz + r + 1, cx + 1, 3, cz + r + 2, "woodDark");
  } else pyramid(cx, cz, r, 2 + r + (variant === 3 ? Math.floor(r / 3) : 0));
  if (lv >= 2) {
    const from = cz + r;
    v.box(cx - 2, 0, from, cx + 2, 1, hz, "limestone");
    for (let zz = from + 1; zz < hz - 1; zz += 3) for (const s of [-1, 1]) v.put(cx + s * 3, 1, zz, "sandDark");
  }
  if (lv >= 3) pyramid(Math.round(hx * 0.5), Math.round(-hz * 0.4), Math.min(7, Math.floor(hx / 3)), lv + 5);
  if (lv >= 4) pyramid(Math.round(hx * 0.55), Math.round(hz * 0.33), 3 + Math.floor(lv / 2), lv + 3);
  if (lv >= 4 || variant === 2) {
    const x = Math.min(hx - 4, cx + r - 1), z = Math.min(hz - 4, cz + r + 3);
    v.box(x - 1, 1, z - 3, x + 2, 3, z + 2, "sandDark");
    for (const side of [-1, 1]) v.box(x + side, 1, z + 2, x + side + 1, 2, z + 5, "limestone");
    v.box(x - 1, 3, z, x + 2, 6, z + 2, stone);
    v.put(x, 5, z + 2, "sandDark");
    if (lv >= 4) {
      v.box(x - 2, 2, z - 4, x + 3, 4, z, seam);
      for (const side of [-1, 1]) {
        const shoulder = x + side * 2;
        v.box(shoulder, 4, z - 1, shoulder + 1, 7, z + 2, stone);
        v.put(shoulder, 5, z + 1, seam);
        v.box(shoulder, 1, z + 1, shoulder + 1, 2, z + 6, stone);
      }
      v.box(x - 1, 6, z, x + 2, 8, z + 2, stone);
      v.put(x, 7, z + 2, "goldDark");
      v.put(x, 5, z + 2, "sandDark");
    }
  }
  if (variant === 0 || variant === 3) for (const s of [-1, 1]) tree(v, s * (hx - 4), 1, hz - 4, "palm", variant === 3 ? 1.1 : 0.75);
}

defineDesigns({
  large_landmarks: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Founders’ Gate", "Ceremonial Arch", "Triple Arch", "Victory Colonnade", "Triumphal Plaza"],
    growth: "A commemorative gateway gains side passages, reliefs and a rooftop quadriga.", build: triumph,
  },
  washington_monument: {
    footprints: [[1, 2], [2, 2], [2, 3], [3, 3], [3, 4]],
    levels: ["Cornerstone Memorial", "Marble Needle", "Flag Circle", "Reflecting Mall", "National Monument"],
    growth: "Marble courses climb over a widening flag circle and reflecting mall.", build: obelisk,
  },
  white_house: {
    footprints: [[2, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    levels: WHITE_HOUSE_LEVELS,
    growth: "The executive residence adds its great porticoes, working wings and covered walks before opening the formal gardens to the public.", build: buildExecutiveResidence,
  },
  smithsonian: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Castle Gallery", "Museum Wing", "Tower Galleries", "Castle Courtyard", "Smithsonian Campus"],
    growth: "Sandstone galleries fan outward into an asymmetric skyline of turrets.", build: smithsonian,
  },
  eiffel_tower: {
    footprints: [[1, 1], [2, 2], [2, 2], [3, 3], [3, 3]],
    levels: ["Iron Pavilion", "Exhibition Tower", "Observation Decks", "Champ de Mars Tower", "Illuminated Eiffel Tower"],
    growth: "Four splayed lattice legs rise into observation decks, a lantern and a beacon.", build: eiffel,
  },
  the_london_eye: {
    footprints: [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3]],
    levels: ["Pier Wheel", "Boardwalk Wheel", "Passenger Pier", "Observation Wheel", "Jubilee Embankment"],
    growth: "A hand-sized pier wheel expands its rotating ring, passenger capsules and riverside boardwalk.", build: eye,
  },
  the_great_pyramids: {
    footprints: [[1, 1], [2, 2], [3, 2], [3, 3], [4, 3]],
    levels: ["Royal Mastaba", "Djoser’s Step Pyramid", "Twin Pyramids", "Sphinx Plateau", "Giza Complex"],
    growth: "A mastaba grows into stepped and cased pyramids, with a carved sphinx guarding the royal causeway.", build: pyramids,
  },
});
