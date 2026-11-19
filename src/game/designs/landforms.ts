import { type Ctx, PixelVox, flag, tree } from "./kit";
import { critter, h2, terrain, vnoise, waterBlob } from "./agriculture";
import { ground, stem } from "./woodland";

// Chalk downs with a white scarp, heather moor, terraced hill and boulder-studded drumlins.
export function hills(c: Ctx): void {
  const { v, lv, variant: s } = c;
  ground(c, "grass2", "grass");
  const ridge = (x: number, z: number) => {
    const u = x / c.hx,
      w = z / c.hz;
    const hummock = (px: number, pz: number, dx: number, dz: number) =>
      Math.max(0, 1 - ((u - px) / dx) ** 2 - ((w - pz) / dz) ** 2);
    let h = hummock(-0.22, -0.15, 0.82, 0.82);
    if (lv >= 2) h = Math.max(h, hummock(0.44, 0.32, 0.49, 0.52) * 0.57);
    if (lv >= 4) h = Math.max(h, hummock(-0.58, 0.48, 0.47, 0.42) * 0.74);
    if (s === 0 && w > 0.28 - u * 0.24) h *= 0.46;
    if (s === 3) h = Math.max(h * 0.82, hummock(0.25, -0.43, 0.64, 0.4));
    const amplitude = 2 + lv * 1.8;
    return s === 2 ? Math.floor((h * amplitude) / 2) * 2 : h * amplitude;
  };
  const g = terrain(c, ridge, (x, y, z, h, top) => {
    if (!top) return ["limestone", "#8f735e", "#b3a26c", "stone"][s];
    if (s === 1 && vnoise(x, z, 3, 5) > 0.48) return "#ab799e";
    if (s === 2 && y > 1 && h2(x, z, 9) > 0.55) return "lime";
    return s === 3 ? "#8fa96e" : "grass";
  });
  for (let z = -c.hz; z < c.hz; z++) {
    const x = Math.round(Math.sin(z / (3 + lv)) * c.hx * 0.36);
    v.put(x, g(x, z), z, "path");
    if (lv >= 3) v.put(x + 1, g(x + 1, z), z, "path2");
  }
  const x = Math.round(-c.hx * 0.25),
    z = Math.round(-c.hz * 0.14),
    y = g(x, z) + 1;
  if (s === 3 || lv >= 3) {
    v.sphere(x, y, z, 1 + lv * 0.35, 1 + lv * 0.27, 1 + lv * 0.32, s === 0 ? "limestone" : "stone");
    if (lv >= 4) v.sphere(x + 4, g(x + 4, z) + 1, z, 1.3, 1.5, 1.3, "granite");
  }
  if (lv >= 2 && s !== 1) critter(v, "sheep", Math.round(c.hx * 0.4), g(Math.round(c.hx * 0.4), 2) + 1, 2);
  if (lv >= 4) tree(v, -c.hx + 4, g(-c.hx + 4, 0) + 1, 0, s === 1 ? "birch" : "round", 1.2);
  if (lv === 5) {
    v.box(x - 1, y, z - 1, x + 2, y + 6, z + 2, "stone");
    v.box(x - 2, y + 6, z - 2, x + 3, y + 7, z + 3, "limestone");
    flag(v, x, y + 7, z, 6, ["amber", "white", "teal"]);
  }
}

// Glacier ridge, basalt tooth, terracotta buttes and stepped jade karst.
export function mountains(c: Ctx): void {
  const { v, lv, variant: s } = c;
  const rock = ["#78869a", "#514d59", "#b95e48", "#638875"][s];
  const ledge = ["#9aa7b5", "#725d68", "#e5a365", "#87a486"][s];
  ground(c, s === 2 ? "sandDark" : "grass2", s === 2 ? "sand" : "grass");
  const peaks = [
    [-0.22, -0.22, 1],
    [0.39, 0.05, 0.69],
    [-0.53, 0.34, 0.53],
    [0.05, 0.47, 0.55],
    [0.55, -0.47, 0.72],
  ];
  const n = [1, 2, 3, 4, 5][lv - 1],
    height = 7 + lv * 5;
  const g = terrain(
    c,
    (x, z) => {
      const u = x / c.hx,
        w = z / c.hz;
      const rough = (vnoise(x, z, 4, 31 + s) - 0.5) * 0.13;
      let h = 0;
      for (let i = 0; i < n; i++) {
        const [a, b, k] = peaks[i];
        const dx = (u - a) / (0.88 * k),
          dz = (w - b) / (0.85 * k);
        const d =
          s === 1
            ? Math.max(Math.abs(dx) * 0.9, Math.abs(dz), Math.abs(dx * 0.65 + dz * 0.6))
            : Math.hypot(dx, dz);
        const shape =
          s === 2
            ? Math.min(1, Math.max(0, (1 - d + rough) * 1.38))
            : s === 3
              ? Math.max(0, 1 - (d - rough) ** 2) ** 2
              : Math.max(0, 1 - d + rough);
        h = Math.max(h, shape * k);
      }
      return height * h;
    },
    (x, y, z, h, top) => {
      if (s === 0 && y > height * (0.54 + vnoise(x, z, 5, 8) * 0.17)) return top ? "snow" : "#cee3ef";
      if (s === 3 && top) return y > height * 0.18 ? "#4f8062" : "leafDark";
      if (s === 2 && (y + Math.floor(z / 7)) % 5 < 2) return ledge;
      return (Math.floor(y / 3) + Math.floor(x / 4) + Math.floor(z / 3)) % 4 === 0 ? ledge : rock;
    },
  );
  if (lv >= 2 && s === 0) {
    for (let z = -Math.round(c.hz * 0.15); z < c.hz; z++) {
      const x = Math.round(Math.sin(z * 0.19) * 2 - 1);
      v.put(x, g(x, z), z, "#79c9e1");
      v.put(x + 1, g(x + 1, z), z, "foam");
    }
  }
  if (lv >= 3) {
    for (let i = 0; i < lv + 1; i++) {
      const x = -c.hx + 4 + i * 5,
        z = c.hz - 5 - (i % 3) * 2;
      if (s === 2) v.sphere(x, g(x, z) + 1, z, 2, 1, 1.6, ledge);
      else tree(v, x, g(x, z) + 1, z, s === 3 ? "cypress" : "pine", 0.75 + (i % 2) * 0.2);
    }
  }
  if (lv >= 4) {
    const x = Math.round(c.hx * 0.39),
      z = Math.round(c.hz * 0.05),
      y = g(x, z) + 1;
    v.box(x - 1, y, z - 1, x + 2, y + 2, z + 2, "woodDark");
    v.cone(x, y + 2, y + 5, z, 2.8, 0.4, "crimson");
  }
  if (lv === 5) {
    const x = Math.round(-c.hx * 0.22),
      z = Math.round(-c.hz * 0.22);
    flag(v, x, g(x, z) + 1, z, 5, ["amber", "crimson", "white"]);
  }
}

// Serpentine red-rock gorge, horseshoe bend, slot canyon and spired badlands.
export function canyons(c: Ctx): void {
  const { v, lv, variant: s, hx, hz } = c;
  const band = [
    ["#8c4537", "#c36d45", "#e3a36a", "#a55241"],
    ["#965b58", "#d49576", "#f0bf8c", "#b97760"],
    ["#9b473b", "#ca6747", "#ef9562", "#a54e3c"],
    ["#8b5857", "#b77d61", "#e4ad7d", "#a66f62"],
  ][s];
  ground(c, band[2], "sand");
  const center = (z: number) =>
    s === 1
      ? hx * (0.45 - 0.82 * Math.exp(-((z / hz) ** 2) * 5))
      : Math.sin((z / hz) * (s === 0 ? 2.8 : 2) + s) * hx * (s === 2 ? 0.13 : 0.26);
  const width = (s === 2 ? 1.7 : 2) + lv * 0.65;
  const g = terrain(
    c,
    (x, z) => {
      const d = Math.abs(x - center(z)) - width;
      if (d < 0) return 0;
      const edge = Math.max(0.12, 1 - (Math.abs(x / hx) ** 3 + Math.abs(z / hz) ** 4) * 0.74);
      const noise = vnoise(x, z, 5, s + 19);
      const wall = s === 2 ? Math.min(1, d * 0.48) : Math.min(1, d * 0.16);
      const h = (3 + lv * 3) * wall * edge * (0.58 + noise * 0.52);
      return Math.round(h / 2) * 2 + (s === 3 && d > 4 && noise > 0.7 ? (noise - 0.7) * 34 : 0);
    },
    (x, y, z, h, top) => (top ? band[2] : band[(Math.floor((y + Math.sin(z / 5) * 1.3) / 2) + 4) % 4]),
  );
  for (let z = -hz; z < hz; z++)
    for (let x = Math.ceil(center(z) - width + 0.5); x < center(z) + width; x++) {
      v.put(x, 0, z, Math.abs(x - center(z)) < width * 0.55 ? "#398a98" : "#72b2ac", 0.13);
    }
  if (lv >= 3) {
    const z = -Math.round(hz * 0.25),
      x = Math.round(center(z));
    const span = Math.ceil(width) + 3,
      y = Math.max(g(x - span, z), g(x + span, z), 4 + lv);
    for (let i = -span; i <= span; i++) {
      const bottom = y - Math.round(3 * (i / span) ** 2);
      v.box(x + i, Math.abs(i) >= span - 1 ? 1 : bottom, z - 1, x + i + 1, y + 2, z + 2, band[1]);
      v.put(x + i, y + 2, z, band[2]);
    }
  }
  if (lv >= 4) {
    for (let i = 0; i < lv - 2; i++) {
      const x = hx - 5 - i * 4,
        z = hz - 6 - (i % 2) * 3,
        h = g(x, z);
      v.cone(x, h + 1, h + 6 + i * 2, z, 2 + i * 0.3, 0.8, band[1]);
      v.cylinderY(x, z, h + 5 + i * 2, h + 7 + i * 2, 2.2, band[2]);
    }
  }
}

function cactus(c: Ctx, x: number, y: number, z: number, h: number): void {
  const { v } = c;
  v.box(x, y, z, x + 2, y + h, z + 2, "#538f6e");
  for (const sign of [-1, 1]) {
    const by = y + Math.floor(h * (sign === 1 ? 0.42 : 0.6));
    stem(v, [x, by, z], [x + sign * 2, by, z], "#4b8264");
    stem(v, [x + sign * 2, by, z], [x + sign * 2, by + Math.max(2, h * 0.28), z], "#538f6e");
  }
  v.put(x, y + h, z, "pink");
}

// Saguaro washes, crescent dune sea, painted mesas, salt pan and mineral chimneys.
export function deserts(c: Ctx): void {
  const { v, lv, variant: s, hx, hz } = c;
  const sand = ["#d9b479", "#e4bd80", "#d69a72", "#e0cfaf"][s];
  ground(c, sand, "sand");
  const oX = Math.round(hx * 0.24),
    oZ = Math.round(hz * 0.37);
  const g = terrain(
    c,
    (x, z) => {
      if (lv >= 4 && Math.hypot((x - oX) / (hx * 0.31), (z - oZ) / (hz * 0.26)) < 1.35) return 0;
      const u = x / hx,
        w = z / hz;
      const ripple = (Math.sin(x * 0.23 + z * 0.12 + Math.cos(z * 0.19) * 2) + 1) / 2;
      if (s === 2)
        return (
          Math.round(
            Math.min(1, Math.max(0, 1 - Math.hypot((u + 0.3) * 1.6, (w + 0.16) * 2)) * 2.4) * (2 + lv) * 0.7,
          ) +
          ripple * 2
        );
      if (s === 3) return Math.max(0, Math.abs(u) + Math.abs(w) - 0.9) * (4 + lv) + ripple;
      return ripple ** (s === 1 ? 2 : 1) * (s === 1 ? 2 + lv * 1.8 : 1 + lv * 0.85);
    },
    (x, y, z, h, top) => (top ? sand : s === 2 && y % 3 === 0 ? "terracotta" : "sandDark"),
  );
  for (let i = 0; i < lv + 1; i++) {
    const x = Math.round(Math.cos(i * 2.4 + s) * hx * 0.62),
      z = Math.round(Math.sin(i * 2.4 + s) * hz * 0.63),
      y = g(x, z) + 1;
    if (s === 0) cactus(c, x, y, z, 3 + lv + (i % 3));
    if (s === 1) {
      if (i === 0 || lv >= 3) critter(v, "camel", x, y, z, "x", x > 0 ? -1 : 1, i);
    }
    if (s === 2) v.cone(x, y, y + 2 + lv + (i % 3), z, 2.2, 1.3, "terracotta");
    if (s === 3) {
      v.cone(x, y, y + lv + (i % 3) + 2, z, 2.1, 0.4, "#d7e6e0");
      v.cone(x + 2, y, y + lv, z + 1, 1.5, 0.4, "#9edbd2");
    }
  }
  if (lv >= 4) {
    waterBlob(c, oX, oZ, hx * 0.28, hz * 0.21, s + 8, "sand", 0.18, "#398e99", "#63b6ae");
    tree(v, oX + Math.floor(hx * 0.2), 1, oZ, "palm", lv * 0.35);
    if (lv === 5) {
      tree(v, oX - 5, 1, oZ + 3, "palm", 1.45);
      critter(v, "camel", oX - 7, 1, oZ + 6);
    }
  }
}

// Tangled rolling saltwort, flat basketgrass, tumble mustard stems, silvery globe thistle.
export function tumbleweeds(c: Ctx): void {
  const { lv, hx, hz, v, variant: s } = c;
  ground(c, ["#d8b88c", "#b9ae83", "#ddc688", "#d6bb97"][s], "sandDark");
  for (let i = 0; i < lv + Math.floor(lv / 2); i++) {
    const x = Math.round(Math.cos(i * 2.4) * hx * 0.6 * (i ? 1 : 0)),
      z = Math.round(Math.sin(i * 2.4) * hz * 0.64);
    const r = i === 0 ? 1.4 + lv * 0.47 : 1.35 + (i % 3) * 0.5;
    const tumble = new PixelVox();
    for (let branch = 0; branch < 5 + s; branch++) {
      const a = branch * 2.4;
      let prev: number[] | undefined;
      for (let k = 0; k <= 14; k++) {
        const t = (k * Math.PI) / 7;
        const p = [
          r * Math.cos(t),
          r * Math.sin(t) * Math.cos(a) * (s === 1 ? 0.65 : 1),
          r * Math.sin(t) * Math.sin(a),
        ];
        if (prev) stem(tumble, prev, p, ["#836046", "#97744d", "#ac8445", "#9d9282"][s]);
        if ((branch + k) % 5 === 0) tumble.put(p[0], p[1] + 1, p[2], s === 3 ? "#cfc4af" : "#c7aa72");
        prev = p;
      }
    }
    c.addRotor({
      vox: tumble,
      pivot: [x, Math.ceil(r) + 1, z],
      axis: "z",
      speed: 0.5 + i * 0.09,
      wind: true,
    });
  }
  if (lv >= 3) {
    for (let x = -hx + 3; x < hx - 1; x += 5) v.box(x, 1, -hz + 4, x + 1, 5, -hz + 5, "woodDark");
    v.box(-hx + 3, 3, -hz + 4, hx - 2, 4, -hz + 5, "woodLight");
  }
  if (lv === 5) {
    const x = hx - 6,
      z = -hz + 6;
    for (const d of [-2, 2]) stem(v, [x + d, 1, z], [x, 13, z], "woodDark");
    const wheel = new PixelVox();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      stem(wheel, [0, 0, 0], [Math.cos(a) * 4, Math.sin(a) * 4, 0], "steelLight");
      wheel.put(Math.cos(a) * 3 - 1, Math.sin(a) * 3, 0, "steel");
    }
    c.addRotor({ vox: wheel, pivot: [x, 13, z + 1], axis: "z", speed: 1.4, wind: true });
  }
}
