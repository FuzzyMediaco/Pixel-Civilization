import { type Ctx, type PixelVox, bench, bush, lot, tree } from "./kit";
import { critter, h2 } from "./agriculture";

// A rounded branch, root or twig traced continuously between two voxel coordinates.
export function stem(v: PixelVox, from: number[], to: number[], col: string, radius = 0): void {
  const steps = Math.max(1, ...from.map((a, i) => Math.ceil(Math.abs(to[i] - a))));
  for (let n = 0; n <= steps; n++) {
    const p = from.map((a, i) => Math.round(a + ((to[i] - a) * n) / steps));
    v.box(p[0] - radius, p[1], p[2] - radius, p[0] + radius + 1, p[1] + 1, p[2] + radius + 1, col);
  }
}

export function ground(c: Ctx, base: string, patch: string, naturalEdge = false): void {
  lot(c, base);
  for (let z = -c.hz + 1; z < c.hz; z += 2)
    for (let x = -c.hx + 1; x < c.hx; x += 3) {
      if (h2(x, z, c.variant + 10) > 0.71) c.v.box(x, 0, z, Math.min(x + 2, c.hx), 1, z + 1, patch);
    }
  if (naturalEdge) {
    // Let the island show through the corners. The scalloped verge follows the planting
    // instead of drawing a rectangular platform around every woodland or marsh.
    for (let z = -c.hz; z < c.hz; z++) {
      for (let x = -c.hx; x < c.hx; x++) {
        const u = (x + 0.5) / c.hx, w = (z + 0.5) / c.hz;
        const angle = Math.atan2(w, u);
        const edge = 0.95 + 0.055 * Math.sin(3 * angle + c.variant) + 0.035 * Math.cos(5 * angle);
        if (u * u + w * w > edge * edge) c.v.put(x, 0, z, null);
      }
    }
  }
}

function forestFloor(c: Ctx): void {
  ground(c, "grass2", "grass3", true);
  for (let i = 0; i < c.lv * 2; i++) {
    const x = c.ri(-c.hx + 2, c.hx - 2),
      z = c.ri(-c.hz + 2, c.hz - 2);
    c.v.put(x, 0, z, "grass2");
    c.v.put(x, 1, z, c.variant === 2 ? "cream" : "woodLight");
    c.v.put(x, 2, z, c.variant === 2 ? "#91684f" : "terracotta");
  }
}

// Oak's heavy lateral boughs, autumn maple, hanging willow, pink cherry spray.
export function broadleaf(c: Ctx): void {
  const { v, lv, variant: s } = c;
  forestFloor(c);
  const trunk = ["woodDark", "#765643", "#75663c", "#554648"][s];
  const dark = ["#36754a", "#d45d36", "#659451", "#df709a"][s];
  const light = ["#81b95b", "#efae40", "#9cb359", "#ffc7d9"][s];
  const reach = Math.min(c.hx - 2, 1 + lv * 1.6);
  const height = 3 + lv * 2;
  const arms = 2 + lv;
  stem(v, [0, 1, 0], [0, height, 0], trunk, lv >= 4 ? 1 : 0);
  for (let b = 0; b < arms; b++) {
    const a = b * 2.4 + s * 0.38;
    const x = Math.round(Math.cos(a) * reach * 0.66),
      z = Math.round(Math.sin(a) * reach * 0.64);
    const y = height + (b % 3) * (s === 1 ? 2 : 1);
    stem(v, [0, Math.round(height * 0.55), 0], [x, y, z], trunk);
    const r = 1.1 + lv * (s === 3 ? 0.52 : 0.68);
    v.sphere(x, y + 1, z, r, s === 1 ? r * 1.18 : r * 0.72, r, dark);
    v.sphere(x + 0.3, y + 2.2, z, r * 0.82, r * 0.66, r * 0.8, light);
    if (s === 2) {
      for (let i = 0; i < 7; i++) {
        const dx = Math.cos(i * 0.91) * r,
          dz = Math.sin(i * 0.91) * r;
        stem(
          v,
          [x + dx, y + 1, z + dz],
          [x + dx, y - 1 - (i % 3) - Math.floor(lv / 2), z + dz],
          i % 2 ? dark : light,
        );
      }
    }
    if (lv >= 3) stem(v, [0, 3, 0], [x * 0.9, 1, z * 0.9], trunk);
  }
  if (lv >= 4) {
    bench(v, -4, 1, c.hz - 4);
    for (let x = -c.hx; x < c.hx; x++) v.put(x, 0, c.hz - 3 + Math.round(Math.cos(x / 5)), "path");
  }
  if (lv === 5) {
    const b = Math.round(height * 0.55);
    stem(v, [0, b, 0], [4, b, 0], trunk, 1);
    for (const x of [2, 4]) stem(v, [x, b, 1], [x, 3, 1], "woodLight");
    v.box(2, 2, 1, 5, 3, 2, "wood");
    critter(v, "bunny", 4, 1, 5);
  }
}

// Alpine fir, snow spruce, umbrella pine, leaning coastal pine.
export function conifers(c: Ctx): void {
  const { lv, v, variant: s } = c;
  forestFloor(c);
  const grow = (x: number, z: number, h: number, r: number) => {
    const lean = s === 3 ? 0.24 : 0;
    const bark = s === 2 ? "terracotta" : "woodDark";
    stem(v, [x, 1, z], [x + h * lean, h, z], bark);
    if (h > 20) stem(v, [x, 1, z], [x + h * lean * 0.45, h * 0.45, z], bark, 1);
    if (s === 2) {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        const bx = x + Math.cos(a) * r * 0.57,
          bz = z + Math.sin(a) * r * 0.57;
        stem(v, [x, h * 0.48, z], [bx, h - 1 + (i % 2), bz], bark);
        v.sphere(bx, h + (i % 2), bz, r * 0.67, r * 0.36, r * 0.68, i % 2 ? "#40795b" : "#558c69");
      }
    } else {
      const tiers = 2 + Math.round(h / 5);
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers,
          y = 2 + h * t * 0.88,
          tx = x + y * lean;
        const wid = (1 - t) * r;
        v.cone(
          tx + 0.5,
          y,
          y + (h / tiers) * 1.75,
          z + 0.5,
          wid,
          0.55,
          s === 3 ? "#417561" : i % 2 ? "#397952" : "#326746",
        );
        if (s === 1)
          v.cone(tx + 0.5, y + 1, y + (h / tiers) * 1.72, z + 0.5, Math.max(0.7, wid * 0.78), 0.55, "snow");
      }
      v.put(x + Math.round(h * lean), h, z, s === 1 ? "snow" : "#417561");
    }
  };
  grow(lv >= 4 ? -3 : 0, -1, 4 + 4 * lv, Math.min(c.hx - 2, 1.3 + lv));
  if (lv >= 3) grow(lv >= 4 ? 7 : -4, 3, 3 + lv * 1.2, 1.5 + lv * 0.38);
  if (lv >= 4) grow(4, -7, 4 + lv * 2, lv * 0.7);
  if (lv === 5) {
    grow(-8, 6, 9, 3);
    critter(v, "bunny", 1, 1, 6);
  }
}

// Coast redwood, fire-scarred sequoia, split lightning giant and cathedral grove.
export function redwoods(c: Ctx): void {
  const { lv, variant: s, v } = c;
  forestFloor(c);
  const grow = (x: number, z: number, h: number, r: number, split: boolean) => {
    const bark = ["#984c30", "#914129", "#ad6946", "#85482f"][s];
    v.cone(x, 1, h, z, r, 0.55, bark);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      stem(
        v,
        [x + Math.cos(a) * r * 1.55, 1, z + Math.sin(a) * r * 1.55],
        [x + Math.cos(a) * r * 0.6, h * 0.35, z + Math.sin(a) * r * 0.6],
        i % 2 ? "#783e2e" : bark,
      );
    }
    if (s === 1) stem(v, [x + 1, 1, z + r - 1], [x, h * 0.46, z + r / 2], "#523e37");
    const limbs = 4 + lv * 2;
    for (let i = 0; i < limbs; i++) {
      const t = i / limbs,
        a = i * 2.399;
      const y = h * (0.42 + t * 0.54);
      const reach = (1 - t * (s === 1 ? 0.44 : 0.75)) * (1 + r * (s === 1 ? 1.95 : 1.5));
      const dx = Math.cos(a) * reach,
        dz = Math.sin(a) * reach;
      stem(v, [x, y - 2, z], [x + dx, y, z + dz], bark);
      v.sphere(
        x + dx,
        y + 1,
        z + dz,
        reach * 0.7 + 1,
        1 + r * 0.45,
        reach * 0.65 + 1,
        i % 3 ? "#326f53" : "#579261",
      );
    }
    v.cone(x, h - 2, h + 4, z, Math.max(1.5, r * 0.82), 0.3, "#40845b");
    if (split) {
      const fork = x + Math.ceil(r * 1.7) + 1;
      stem(v, [x, h * 0.36, z], [fork, h * 0.6, z - 2], bark, 1);
      stem(v, [fork, h * 0.6, z - 2], [fork, h * 1.02, z - 2], bark);
      v.cone(fork + 0.5, h * 0.68, h * 1.04, z - 1.5, r * 0.9 + 1, 0.5, "#438559");
    }
    if (s === 1 && lv >= 3 && h > 15) {
      // A fire scar forms a walk-through hollow in the broad sequoia base.
      for (let y = 1; y < 2 + lv; y++) {
        const half = y < lv ? 2 : 1;
        v.clear(x - half, y, z - r - 2, x + half, y + 1, z + r + 2);
      }
    }
  };
  const x = lv >= 3 && s === 3 ? -4 : 0;
  grow(x, -1, 7 + lv * (s === 1 ? 5 : 7), 0.8 + lv * (s === 1 ? 0.75 : 0.54), s === 2);
  if (s === 3 || lv >= 4) grow(x + (lv >= 3 ? 8 : 4), 3, 3 + lv * 3.7, 0.7 + lv * 0.25, false);
  if (s === 3 && lv >= 3) grow(-7, 5, 6 + lv * 4.1, 1.4, false);
  if (lv === 5) {
    const y = 12;
    ringWalk(c, x, y, -1, 4);
    for (let i = 0; i < 5; i++) stem(v, [x + 4, y - 1 - i * 2, 0], [x + 4, y - 1 - i * 2, 2], "woodLight");
    for (const z of [0, 2]) stem(v, [x + 4, 1, z], [x + 4, y, z], "woodDark");
  }
}

function ringWalk(c: Ctx, x: number, y: number, z: number, r: number): void {
  for (let dx = -r - 1; dx <= r + 1; dx++)
    for (let dz = -r - 1; dz <= r + 1; dz++) {
      const d = Math.hypot(dx, dz);
      if (d <= r + 1 && d >= r - 1) c.v.put(x + dx, y, z + dz, "wood");
      if (d > r && d <= r + 1) c.v.put(x + dx, y + 1, z + dz, "woodLight");
    }
}

function bedSites(c: Ctx, n: number, dx = 0.74, dz = 0.72): number[][] {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.sqrt(i / n),
      a = i * 2.4 + c.variant * 0.7;
    return [Math.round(Math.cos(a) * t * dx * c.hx), Math.round(Math.sin(a) * t * dz * c.hz)];
  });
}

// Tall sunflowers, lavender spikes, broad water-coloured poppies, branching foxgloves.
export function flowers(c: Ctx): void {
  const { lv, v, variant: s } = c;
  ground(c, "#8cbf64", "grass3");
  const sites = bedSites(c, [1, 4, 9, 18, 32][lv - 1]);
  sites.forEach(([x, z], i) => {
    const height = Math.max(3, (s === 2 ? 2 : 3) + lv + (i % 3) - 1);
    const flower = ["amber", "#986fc4", "crimson", "pink"][s];
    stem(v, [x, 1, z], [x, height, z], "#53834a");
    for (let y = 2; y < height; y += 2) v.put(x + (y % 4 ? 1 : -1), y, z, "leaf");
    if (s === 0 || s === 2) {
      const radius = i === 0 && lv >= 4 ? 2 : 1;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        v.put(
          x + Math.cos(a) * radius,
          height + (s === 0 ? Math.sin(a) * radius : 0),
          z + (s === 0 ? 0 : Math.sin(a) * radius),
          flower,
        );
      }
      v.put(x, height, z, s === 0 ? "#68493a" : "#513442");
    } else {
      for (let k = 0; k < 2 + Math.round(lv / 2); k++) {
        const dx = s === 3 ? (k % 2 ? 1 : -1) : 0;
        v.put(x + dx, height + k, z, k % 2 ? flower : s === 1 ? "#c4a1dc" : "#f5bad2");
      }
    }
  });
  if (lv === 5) {
    const x = c.hx - 5,
      z = c.hz - 5;
    v.box(x - 1, 1, z - 1, x + 2, 5, z + 2, "woodLight");
    for (let y = 2; y <= 4; y += 2) v.put(x, y, z + 1, "woodDark");
    v.cone(x, 5, 8, z, 3, 0.4, "terracotta");
  }
}

// Clipped cones, trained spiral, box cubes, lollipop standards.
export function topiaries(c: Ctx): void {
  const { lv, v, variant: s } = c;
  ground(c, "path2", "path");
  const n = [1, 2, 4, 6, 9][lv - 1];
  const sites =
    n === 1
      ? [[0, 0]]
      : Array.from({ length: n }, (_, i) => {
          const a = (i * Math.PI * 2) / n;
          return [Math.round(Math.cos(a) * (c.hx - 4)), Math.round(Math.sin(a) * (c.hz - 4))];
        });
  sites.forEach(([x, z], i) => {
    const h = 3 + lv + (i % 2);
    v.cylinderY(x, z, 1, 3, 2, "terracotta");
    v.box(x, 3, z, x + 1, h + 1, z + 1, "woodDark");
    if (s === 0) v.cone(x, 3, h + 4, z, 2 + lv * 0.23, 0.45, "leafDark");
    if (s === 1)
      for (let y = 3; y < h + 5; y++) {
        const a = y * 1.05;
        v.sphere(x + Math.cos(a), y, z + Math.sin(a), 1.5, 1.2, 1.5, "moss");
      }
    if (s === 2) {
      v.box(x - 2, 3, z - 2, x + 3, 6, z + 3, "leafDark");
      v.box(x - 1, 6, z - 1, x + 2, h + 3, z + 2, "leaf");
    }
    if (s === 3) v.sphere(x, h + 1, z, 2.5 + lv * 0.12, 2.5 + lv * 0.12, 2.5 + lv * 0.12, "leaf");
  });
  if (lv >= 3) {
    v.cylinderY(0, 0, 1, 2, 3.5, "limestone");
    v.cylinderY(0, 0, 1, 2, 2.6, "water");
    v.cylinderY(0, 0, 2, lv, 1.1, "marble");
    v.put(0, lv, 0, "foam", 0.35);
  }
}

// Blueberries in mounds, bramble fruiting canes, crimson currant sprays, flowering dogrose.
export function brambles(c: Ctx): void {
  const { v, lv, variant: s } = c;
  ground(c, "grass2", "leafLight");
  bedSites(c, lv === 1 ? 1 : 2 * lv - 1).forEach(([x, z], i) => {
    const h = 2 + (s === 1 || s === 2 ? lv : Math.round(lv / 2));
    const fruit = ["#655ca1", "#643751", "crimson", "pink"][s];
    for (let k = 0; k < 5; k++) {
      const a = k * 2.4 + i;
      const dx = Math.round(Math.cos(a) * (1.2 + lv * 0.4)),
        dz = Math.round(Math.sin(a) * (1.2 + lv * 0.4));
      stem(v, [x, 1, z], [x + dx, h, z + dz], s === 1 ? "#8c6653" : "olive");
      const radius = s === 0 || s === 3 ? 1.7 : 1;
      v.sphere(x + dx, h - (k % 2), z + dz, radius, 1.3, radius, k % 2 ? "leafDark" : "leaf");
      v.put(x + dx, h + 1 - (k % 2), z + dz, fruit);
      if (s === 2) v.put(x + dx + 1, h - 1, z + dz + 1, fruit);
    }
  });
  if (lv >= 4) {
    const x = -c.hx + 3,
      z = c.hz - 4;
    v.box(x, 1, z, x + 4, 3, z + 3, "crate");
    v.box(x + 1, 3, z + 1, x + 3, 4, z + 2, ["#655ca1", "#643751", "crimson", "pink"][s]);
    if (lv === 5) critter(v, "bunny", x + 6, 1, z);
  }
}
