import { type Ctx, bench, flag, gable, person, tree } from "./kit";
import { critter, gator, waterBlob } from "./agriculture";
import { ground, stem } from "./woodland";

function reeds(c: Ctx, x: number, z: number, h = 3): void {
  for (let i = 0; i < 4; i++) {
    const dx = (i % 2) * 2 - 1,
      dz = Math.floor(i / 2) * 2 - 1;
    const top = 2 + (i % 3) + h;
    stem(c.v, [x, 1, z], [x + dx, top - 1, z + dz], i % 2 ? "#818f52" : "#a1a657");
    c.v.put(x + dx, top, z + dz, "#886244");
  }
}
function dock(c: Ctx, x: number, z: number, length: number, y = 2): void {
  const v = c.v;
  for (let d = 0; d < length; d++) {
    v.box(x - 1, y, z - d, x + 2, y + 1, z - d + 1, d % 3 ? "wood" : "woodLight");
    if (d % 4 === 0)
      for (const offset of [-1, 1]) v.box(x + offset, 0, z - d, x + offset + 1, y + 2, z - d + 1, "woodDark");
  }
}
function boat(c: Ctx, x: number, z: number, sail: boolean): void {
  const v = c.v;
  v.box(x - 2, 1, z - 1, x + 3, 2, z + 2, "woodDark");
  v.box(x - 3, 2, z, x + 4, 3, z + 1, "wood");
  for (const side of [-1, 1]) v.box(x - 2, 2, z + side, x + 3, 3, z + side + 1, "woodLight");
  if (sail) {
    v.box(x, 2, z, x + 1, 9, z + 1, "woodDark");
    for (let i = 0; i < 5; i++)
      v.box(x + 1, 3 + i, z, x + 1 + Math.ceil((5 - i) / 2), 4 + i, z + 1, i % 3 === 0 ? "sky" : "cream");
  } else stem(v, [x - 2, 2, z + 2], [x + 2, 3, z - 2], "cream");
}

// Lily pool, koi garden with stepping-stones, beaver pond and reed-lined duck pond.
export function ponds(c: Ctx): void {
  const { lv, variant: s, hx, hz, v } = c;
  ground(c, s === 1 ? "#93ae75" : "grass2", "grass3", true);
  const water = ["#76b7a0", "#68aebc", "#729a90", "#70a7ae"][s];
  waterBlob(
    c,
    -1,
    -1,
    hx * (0.52 + lv * 0.046),
    hz * (0.54 + lv * 0.04),
    s + 18,
    s === 1 ? "stone" : "sandDark",
    0.44,
    "#518b93",
    water,
  );
  for (let i = 0; i < lv + (s === 0 ? 3 : 0); i++) {
    const t = i * 2.41,
      x = Math.round(Math.cos(t) * hx * 0.35),
      z = Math.round(Math.sin(t) * hz * 0.36);
    if (s === 0) {
      v.cylinderY(x, z, 1, 2, 1.5, "#58864d");
      v.put(x + 1, 1, z + 1, water);
      if (i % 2 === 0) v.put(x, 2, z, i % 4 === 0 ? "pink" : "cream");
    } else if (s === 1) {
      v.put(x, 1, z, "orange");
      v.put(x + 1, 1, z, "cream");
      v.put(x + 2, 1, z + 1, "orange");
      if (i % 2 === 0) v.cylinderY(x, z + 3, 1, 2, 1.5, "granite");
    } else if (s === 2) {
      stem(v, [x - 1, 1, z], [x + 2, 2, z + 1], "woodDark");
      if (i === 0 || lv >= 3) stem(v, [x, 1, z + 1], [x + 2, 2, z - 1], "woodLight");
    } else {
      if (i < Math.ceil(lv / 2)) critter(v, "duck", x, 1, z, "x", i % 2 ? 1 : -1, i);
      reeds(c, x + 3, z + 2, lv > 2 ? 2 : 1);
    }
  }
  if (lv >= 2) reeds(c, -Math.floor(hx * 0.48), 2, lv - 1);
  if (lv >= 3)
    tree(
      v,
      Math.round(hx * 0.56),
      1,
      -Math.round(hz * 0.54),
      s === 1 ? "blossom" : s === 2 ? "birch" : "willow",
      0.6 + lv * 0.19,
    );
  if (lv >= 4) {
    dock(c, 0, hz - 2, Math.ceil(hz * 0.58));
    bench(v, -5, 1, hz - 3);
  }
  if (lv === 5) {
    const x = -Math.round(hx * 0.36),
      z = -Math.round(hz * 0.22);
    for (let i = 0; i < 3; i++) v.sphere(x + i * 2, 2 + (i % 2), z, 2.4, 2.1 + (i % 2), 2, "stone");
    v.box(x, 1, z + 1, x + 2, 5, z + 2, "#a5d9d8");
    v.put(x + 1, 1, z + 2, "foam");
  }
}

// Alpine tarn, braided oxbow, island caldera, northern lake with rocky skerries.
export function lakes(c: Ctx): void {
  const { lv, variant: s, hx, hz, v } = c;
  ground(c, ["#83a473", "#99b574", "#738e6b", "#8b9f81"][s], "grass3", true);
  const col = ["#589eae", "#699d8c", "#528dae", "#618eac"][s];
  const shallow = ["#84c3c6", "#82b4a1", "#71b5c4", "#80abbd"][s];
  for (let x = -hx; x < hx; x++)
    for (let z = -hz; z < hz; z++) {
      const u = x / hx,
        w = z / hz;
      const centre = s === 1 ? Math.sin(u * 3.5) * 0.32 : 0;
      const wobble = Math.sin(u * 5 + s) * 0.07 + Math.cos(w * 8 + s) * 0.05;
      const d = (u / 0.91) ** 2 + ((w - centre) / (s === 1 ? 0.56 : 0.88)) ** 2 + wobble;
      if (d < 1) v.put(x, 0, z, d > 0.72 ? shallow : col, 0.13);
      else if (d < 1.14) v.put(x, 0, z, s === 3 ? "stone" : "sand");
    }
  for (let i = 0; i < lv + 2; i++) {
    const x = Math.round(Math.cos(i * 2.4) * hx * 0.72),
      z = Math.round(Math.sin(i * 2.4) * hz * 0.76);
    if (s === 0) tree(v, x, 1, z, "pine", 0.8 + (i % 3) * 0.2);
    else if (s === 1) reeds(c, x, z, 2);
    else if (s === 2) v.sphere(x, 1, z, 3, 2.5 + (i % 3), 2.6, "basalt");
    else {
      v.sphere(x, 1, z, 2 + (i % 2), 2, 2.5, "granite");
      if (i % 2 === 0) tree(v, x, 3, z, "pine", 0.7);
    }
  }
  if (lv >= 2) dock(c, Math.round(hx * 0.18), hz - 2, Math.round(hz * 0.6));
  if (lv >= 3) {
    v.cylinderY(-3, -3, 1, 2, 3 + lv * 0.5, "sandDark");
    v.cylinderY(-3, -3, 2, 3, 2 + lv * 0.5, "grass2");
    tree(v, -3, 3, -3, s === 1 ? "willow" : s === 2 ? "palm" : "pine", 1.35);
  }
  if (lv >= 4) {
    const x = Math.round(hx * 0.18) + 3,
      z = hz - 8;
    dock(c, x, z + 4, 8, 2);
    c.v.hollowBox(x - 2, 3, z - 2, x + 4, 7, z + 3, s === 3 ? "redDark" : "wood");
    c.v.box(x - 1, 3, z + 2, x + 2, 6, z + 3, "glass", 0.4);
    gable(v, x - 3, 7, z - 3, x + 5, z + 4, "x", s === 0 ? "slate" : "terracotta");
    boat(c, x - 8, z - 6, lv === 5);
  }
  if (lv === 5) {
    const x = -Math.round(hx * 0.43),
      z = Math.round(hz * 0.46);
    v.cylinderY(x, z, 1, 3, 3, "stone");
    v.cone(x, 3, 11, z, 2.1, 1.25, "cream");
    v.cylinderY(x, z, 8, 10, 1.5, "redDark");
    v.cylinderY(x, z, 11, 13, 1.65, "warmGlow", 0.85);
    v.cone(x, 13, 15, z, 2.2, 0.55, "slate");
    c.blink(x, 13, z, "warmGlow");
  }
}

// Cypress knees, mangrove arches, floating bog and a flooded willow grove.
export function swamps(c: Ctx): void {
  const { v, hx, hz, lv, variant: s } = c;
  ground(c, ["#69825a", "#739477", "#a19c61", "#708752"][s], "olive", true);
  waterBlob(c, 0, 0, hx * 0.9, hz * 0.87, 20 + s, "#83946d", 0.6, "#466f6c", "#688f7b");
  for (let i = 0; i < 1 + lv; i++) {
    const a = 2.4 * i + s,
      t = i === 0 ? 0.35 : 0.64;
    const x = Math.round(Math.cos(a) * hx * t),
      z = Math.round(Math.sin(a) * hz * t);
    const h = (4 + lv) * (i === 0 ? 1.6 : 1),
      r = lv * 0.35 + 1.4;
    if (s === 2) {
      v.cylinderY(x, z, 1, 2, r + 1.4, "#a6ad6d");
      reeds(c, x, z, 2 + lv * 0.5);
      for (let k = 0; k < 3; k++) v.put(x + k, 2, z + 2, "pink");
    } else if (s === 3) {
      tree(v, x, 1, z, "willow", Math.min(1.7, 0.55 + lv * 0.22 + (i % 2) * 0.15));
    } else {
      for (let j = 0; j < 5; j++) {
        const a = j * 1.25;
        stem(v, [x + Math.cos(a) * r * 1.5, 1, z + Math.sin(a) * r * 1.5], [x, h * 0.54, z], "#795d46");
        if (s === 0)
          v.cone(x + Math.sin(a) * r * 1.8, 1, 4, z + Math.cos(a) * r * 1.8, 0.95, 0.32, "#88664a");
      }
      stem(v, [x, Math.floor(h * 0.4), z], [x, h, z], "woodDark", lv > 3 && i === 0 ? 1 : 0);
      if (s === 0) v.cone(x, h * 0.68, h + 4, z, r + 1, 0.5, "#4b7963");
      else v.sphere(x, h, z, r * 1.5, r * 0.65, r * 1.45, "#4e8057");
    }
  }
  if (lv >= 2) critter(v, "heron", 2, 1, 2);
  if (lv >= 3) dock(c, -Math.round(hx * 0.28), hz - 1, Math.ceil(hz * 0.65), 3);
  if (lv >= 4) {
    c.smoke(-2, 1, 4, "steam");
    critter(v, "frog", 3, 1, 4);
  }
  if (lv === 5) {
    const x = -Math.round(hx * 0.28),
      z = hz - Math.ceil(hz * 0.65);
    for (const dx of [-2, 2])
      for (const dz of [-2, 2]) v.box(x + dx, 3, z + dz, x + dx + 1, 9, z + dz + 1, "wood");
    gable(v, x - 3, 9, z - 3, x + 4, z + 4, "x", "olive");
    gator(v, x + 5, 1, z - 7, 11, "x", 1);
  }
}

// Freshwater oxbow, sun-baked sandbank, pale limestone spring, mangrove nursery.
export function alligators(c: Ctx): void {
  const { v, lv, hx, hz, variant: s } = c;
  const bank = ["#91a877", "#d0b580", "#c0bc9e", "#79956b"][s];
  ground(c, bank, "sandDark", true);
  waterBlob(c, -1, 1, hx * 0.9, hz * 0.74, 12 + s, bank, 0.42, "#4c827e", "#76a89a");
  const len = Math.min(2 * hx - 5, 5 + lv * 3);
  const x = -Math.floor(len / 2),
    z = s === 1 ? -2 : 1;
  const skin = ["#52713d", "#8d7049", "#e5dac2", "#466a53"][s];
  if (s === 1 || s === 2) v.cylinderY(1, z, 1, 2, len * 0.39, s === 1 ? "sand" : "limestone");
  const y = s === 1 || s === 2 ? 2 : 1;
  gator(v, x, y, z, len, "x", 1, skin, "#bdc485", lv >= 3);
  if (s === 0) reeds(c, -Math.round(hx * 0.56), -Math.round(hz * 0.52), 2);
  if (s === 1) v.sphere(-Math.round(hx * 0.57), 1, 3, 2.5, 1.2, 2, "sandDark");
  if (s === 2) v.sphere(-Math.round(hx * 0.52), 1, -3, 2.4, 2, 2.2, "limestone");
  if (s === 3) {
    const tx = -Math.round(hx * 0.58),
      tz = -Math.round(hz * 0.55);
    tree(v, tx, 1, tz, "round", 0.65 + lv * 0.2);
    for (const sx of [-1, 1]) stem(v, [tx + sx * (2 + lv * 0.3), 1, tz + 2], [tx, 4, tz], "woodDark");
  }
  if (lv >= 2) stem(v, [x, 1, z + 4], [x + 6, 2, z + 5], "woodDark");
  if (lv >= 3) {
    const nx = Math.round(hx * 0.48),
      nz = -Math.round(hz * 0.5);
    v.cylinderY(nx, nz, 1, 3, 3.2, "#a38e57");
    for (let i = 0; i < 4; i++) v.put(nx - 1 + (i % 2) * 2, 3, nz + Math.floor(i / 2), "cream");
  }
  if (lv >= 4) {
    gator(v, Math.round(hx * 0.3), 1, Math.round(hz * 0.56), 7, "x", -1, skin);
    if (lv === 5) {
      gator(v, -Math.round(hx * 0.26), 1, -Math.round(hz * 0.55), 10, "x", 1, skin);
      critter(v, "heron", hx - 5, 1, hz - 5);
    }
  }
}

function parasol(c: Ctx, x: number, z: number, r: number, style: number): void {
  const v = c.v,
    h = 3 + r;
  const col = ["#ef705b", "#6394c7", "#c0a36c", "#50a79b"][style];
  v.box(x, 1, z, x + 1, h + 1, z + 1, "woodDark");
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++) {
      const d = style === 1 ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
      if (d > r + 0.15) continue;
      const y = h + Math.round((r - d) * (style === 2 ? 0.95 : 0.55));
      const sector = Math.floor((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 0.25));
      v.put(
        x + dx,
        y,
        z + dz,
        (style === 2 ? Math.round(d) % 2 : style === 1 ? (dx + r) % 3 : sector % 2)
          ? col
          : style === 2
            ? "#ddc68a"
            : "cream",
      );
      if (style === 3 && d >= r - 0.55 && (dx + dz) % 2 === 0) v.put(x + dx, y - 1, z + dz, col);
    }
  for (const offset of [-2, 1]) {
    v.box(x + offset, 1, z + 2, x + offset + 1, 2, z + 5, style % 2 ? "white" : "wood");
    v.put(x + offset, 2, z + 2, col);
  }
}

// Lifeguard canvas, square Riviera awnings, thatched palapas and tasselled resort parasols.
export function umbrellas(c: Ctx): void {
  const { lv, hx, hz, variant: s, v } = c;
  ground(c, "sand", "sandDark");
  const sites =
    lv === 1
      ? [[0, -1]]
      : Array.from({ length: lv }, (_, i) => {
          const count = lv >= 4 ? 3 : lv,
            row = Math.floor(i / count),
            pos = i % count;
          return [
            Math.round((pos - (count - 1) / 2) * Math.min(9, (2 * hx - 8) / Math.max(1, count - 1))),
            lv >= 4 ? (row ? 4 : -6) : -1,
          ];
        });
  for (const [x, z] of sites)
    parasol(c, x, z, lv === 1 ? 3 : Math.min(3, Math.floor(hx / sites.length) + 1), s);
  if (lv >= 3) v.box(-hx, 0, hz - 3, hx, 1, hz - 1, "woodLight");
  if (lv >= 4) {
    bench(v, -hx + 4, 1, hz - 4);
    person(v, hx - 4, 1, hz - 4, "teal");
  }
  if (lv === 5) {
    const x = hx - 7,
      z = 5;
    for (const dx of [-2, 2])
      for (const dz of [-2, 2]) v.box(x + dx, 1, z + dz, x + dx + 1, 5, z + dz + 1, "woodDark");
    v.box(x - 3, 5, z - 3, x + 4, 6, z + 4, "woodLight");
    v.hollowBox(x - 2, 6, z - 2, x + 3, 10, z + 3, "cream", "sky");
    v.box(x - 1, 7, z + 2, x + 2, 9, z + 3, "glass", 0.4);
    gable(v, x - 3, 10, z - 3, x + 4, z + 4, "x", "red");
  }
}

// Pocket cove, rocky tidal shore, palm cay and surf break.
export function beaches(c: Ctx): void {
  const { v, lv, hx, hz, variant: s } = c;
  ground(c, s === 1 ? "#c4b9a1" : "sand", "sandDark");
  const shore = (x: number) =>
    Math.round(hz * 0.13 + Math.sin((x / hx) * (s === 0 ? 2.6 : 4) + s) * hz * 0.18);
  for (let x = -hx; x < hx; x++)
    for (let z = shore(x); z < hz; z++) {
      const d = z - shore(x);
      const isBreaker = s === 3 && d > 2 && (d + Math.floor(x / 6)) % 6 === 0;
      v.put(x, 0, z, d === 0 || isBreaker ? "foam" : d < 3 ? "#a2d9cf" : d < 6 ? "#64babf" : "#438fae", 0.09);
      if (isBreaker) v.put(x, 1, z, "foam");
    }
  if (s === 0 || s === 1) {
    for (let i = 0; i < lv + 1; i++) {
      const x = -hx + 2 + i * 2,
        z = shore(x) - (i % 3);
      v.sphere(x, 1, z, 2.2, s === 1 ? 1.5 + (i % 3) : 1, 2, s === 1 ? "granite" : "sandDark");
    }
  }
  if (s === 2)
    for (let i = 0; i <= Math.floor(lv / 2); i++)
      tree(v, -hx + 4 + i * 5, 1, -hz + 4 + (i % 2) * 3, "palm", 1 + lv * 0.15 - i * 0.15);
  if (s === 3) {
    for (let i = 0; i < lv; i++) {
      const x = -hx + 3 + i * 4,
        z = shore(x) + 3;
      v.box(x - 1, 1, z, x + 3, 2, z + 1, i % 2 ? "red" : "amber");
      v.put(x + 3, 1, z + 1, "cream");
    }
  }
  if (lv >= 2) {
    v.box(-3, 1, -hz + 3, -1, 2, -hz + 7, "teal");
    v.box(1, 1, -hz + 3, 3, 2, -hz + 7, "crimson");
  }
  if (lv >= 3) parasol(c, hx - 6, -hz + 5, 3, s);
  if (lv >= 4) {
    dock(c, Math.round(-hx * 0.22), hz - 2, Math.round(hz * 0.96), 2);
    person(v, Math.round(-hx * 0.22), 3, hz - 5, "amber");
  }
  if (lv === 5) {
    const x = -hx + 7,
      z = -hz + 5;
    v.hollowBox(x - 3, 1, z - 2, x + 4, 6, z + 3, s === 0 ? "teal" : "cream", "woodDark");
    v.box(x - 2, 3, z + 2, x + 3, 5, z + 3, "glass", 0.3);
    gable(v, x - 4, 6, z - 3, x + 5, z + 4, "x", s === 3 ? "sky" : "terracotta");
    flag(v, x + 4, 1, z + 2, 8, ["red", "yellow", "red"]);
  }
}

// Sand drips, castellated bucket fort, conical fairy towers and a stepped sand pyramid.
export function sandArt(c: Ctx): void {
  const { v, lv, hx, hz, variant: s } = c;
  ground(c, "sand", "sandDark");
  const col = ["#cfad77", "#d4b07b", "#dab985", "#d2ac73"][s];
  const sandTower = (x: number, z: number, r: number, h: number) => {
    if (s === 3) {
      for (let i = 0; i < h; i += 2) {
        const w = Math.max(1, Math.round(r * (1 - i / h)));
        v.box(x - w, 1 + i, z - w, x + w + 1, 3 + i, z + w + 1, col);
      }
    } else {
      v.cone(x, 1, h + 1, z, r, r * 0.73, col);
      if (s === 0) {
        for (let i = 0; i < 5; i++)
          v.cone(
            x + Math.cos(i * 2.4) * r * 0.57,
            h - 1,
            h + 2 + (i % 3),
            z + Math.sin(i * 2.4) * r * 0.57,
            1.25,
            0.4,
            col,
          );
      }
      if (s === 1)
        for (let i = 0; i < 6; i++)
          v.put(
            x + Math.cos((i * Math.PI) / 3) * r * 0.7,
            h + 1,
            z + Math.sin((i * Math.PI) / 3) * r * 0.7,
            "sand",
          );
      if (s === 2) v.cone(x, h, h + Math.ceil(h * 0.6), z, r * 1.12, 0.35, "sandDark");
    }
  };
  if (lv >= 4) {
    const rx = hx * 0.7,
      rz = hz * 0.67;
    for (let x = -hx; x < hx; x++)
      for (let z = -hz; z < hz; z++) {
        const d = (x / rx) ** 2 + (z / rz) ** 2;
        if (d > 0.7 && d < 1.17) v.put(x, 0, z, "#87c9ce");
      }
    v.box(-1, 1, Math.round(rz * 0.66), 2, 2, Math.round(rz * 1.1), "woodLight");
  }
  sandTower(0, -1, 1.5 + lv * 0.66, 2 + 2 * lv);
  if (lv >= 2) sandTower(-Math.min(5, hx - 3), 2, 1.8, lv + 1);
  if (lv >= 3) sandTower(Math.min(5, hx - 3), 2, 2, lv + 2);
  if (lv >= 4) {
    const d = Math.min(7, hx - 3);
    for (const x of [-d, d]) for (const z of [-6, 5]) sandTower(x, z, 2.5, 4 + lv);
    v.box(-d, 1, -6, d + 1, 5, -4, col);
    for (const x of [-d, d]) v.box(x, 1, -6, x + 1, 5, 6, col);
    v.box(-d, 1, 5, -2, 4, 6, col);
    v.box(2, 1, 5, d + 1, 4, 6, col);
  }
  if (lv === 5) flag(v, 0, 2 + 2 * lv + (s === 2 ? 7 : 1), -1, 6, ["crimson", "white", "amber"]);
  v.cylinderY(hx - 3, hz - 3, 1, 3, 1.5, "red");
  v.put(hx - 3, 3, hz - 3, "sand");
}
