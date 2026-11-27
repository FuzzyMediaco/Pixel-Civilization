import { type Ctx, type PixelVox, awning, person, sawtooth } from "./kit";
import { bulbs, cafeTable, disc, spinner } from "./commerceKit";
import { beam, facade, oval, slab } from "./sculpturalKit";
import { mooredBoat, pier } from "./vehicles";

const teak = "#b78050",
  endGrain = "#805339",
  piling = "#55473f",
  rail = "#e6dcc5";
const enamel = "#fbf0cd",
  darkBlue = "#203e51",
  teal = "#327c79",
  lamp = "#ffd78e";

/** The shore rotation points +z out to sea. The deck always connects to land on −z. */
function wharf(c: Ctx, x0: number, z0: number, x1: number, z1: number) {
  pier(c.v, x0, z0, x1, z1, teak, piling, 6, 1);
  for (let z = z0 + 2; z < z1; z += 4) {
    c.v.box(x0 + 1, 1, z, x1 - 1, 2, z + 1, "#c19160");
  }
  c.v.box(x0, 0, z1 - 1, x1, 1, z1, endGrain);
}

function iceCounter(c: Ctx, x: number, z: number, w: number, col: string) {
  c.v.box(x, 2, z, x + w, 4, z + 3, col);
  c.v.box(x - 1, 4, z, x + w + 1, 5, z + 3, enamel);
  for (let dx = 1; dx < w - 1; dx += 3) {
    c.v.box(x + dx, 5, z, x + dx + 2, 6, z + 1, "#689caa");
    c.v.put(x + dx, 5, z + 1, "#c4e4df");
  }
}

function trap(c: Ctx, x: number, y: number, z: number) {
  c.v.box(x, y, z, x + 4, y + 1, z + 3, endGrain);
  for (const off of [0, 3]) c.v.box(x + off, y + 1, z, x + off + 1, y + 3, z + 3, teak);
  c.v.box(x, y + 2, z + 1, x + 4, y + 3, z + 2, teal);
}

function landing(c: Ctx, x: number, z: number) {
  c.v.box(x, -2, z, x + 1, 5, z + 1, piling);
  c.v.put(x, 5, z, enamel);
  c.v.ringZ(x + 2, 3, z, z + 1, 2, 1, "#d56542");
}

function chowderKitchen(c: Ctx, x0: number, z0: number, x1: number, z1: number, roof: number) {
  const v = c.v;
  for (const x of [x0, x1 - 1]) for (const z of [z0, z1 - 1]) v.box(x, 2, z, x + 1, roof, z + 1, rail);
  v.box(x0, 2, z0, x1, roof - 1, z0 + 1, "#5a938b");
  const doorX = Math.floor((x0 + x1) / 2);
  v.clear(doorX - 1, 2, z0, doorX + 1, 6, z0 + 1);
  v.box(x0, 2, z1 - 2, x1 - 2, 4, z1, "#a03635");
  v.box(x0 - 1, 4, z1 - 2, x1 - 1, 5, z1, enamel);
  v.box(x0 - 1, roof, z0 - 1, x1 + 1, roof + 1, z1 + 1, "#e8c49a");
  awning(v, x0, x1, roof - 1, z1, "#bc4540", enamel);
  person(v, x0 + 3, 2, z1 - 4, "white", darkBlue);
}

/** A jointed lobster lies lengthwise on the kitchen roof; eyes, tail fan and split claws read from above. */
function lobster(v: PixelVox, x: number, y: number, z: number, s: number) {
  const red = "#c94733",
    shell = "#f37442",
    tip = "#f6a751";
  const part = (u: number, h: number, w: number, rx: number, ry: number, rz: number, color: string) =>
    v.sphere(x + u * s, y + h * s, z + w * s, rx * s, ry * s, rz * s, color);
  part(0, 2, 0, 3.4, 2.1, 2.2, red);
  for (let i = 0; i < 4; i++)
    part(-2.3 - i * 1.15, 1.4, 0, 1.1, 1.5 - i * 0.15, 2 - i * 0.15, i % 2 ? red : shell);
  for (const side of [-1, 1]) {
    part(-6.5, 1, side * 1.1, 1.6, 0.55, 1.3, shell);
    part(1.9, 3, side * 1.1, 0.75, 0.8, 0.7, "#372e35");
    for (let leg = 0; leg < 3; leg++) {
      const u = -1.8 + leg * 1.3;
      beam(
        v,
        [x + u * s, y + 1.7 * s, z + side * 1.5 * s],
        [x + (u - 1) * s, y + 0.2 * s, z + side * (3.3 + leg * 0.25) * s],
        shell,
      );
    }
    beam(
      v,
      [x + 1.5 * s, y + 1.7 * s, z + side * 1.6 * s],
      [x + 3.4 * s, y + 2.1 * s, z + side * 3.2 * s],
      red,
      Math.max(1, Math.round(s)),
    );
    part(4.1, 2.1, side * 3.6, 2, 1.35, 1.4, shell);
    part(5.9, 2.2, side * 4.25, 1.6, 0.8, 0.65, tip);
    part(5.85, 1.75, side * 3, 1.2, 0.6, 0.55, red);
    beam(v, [x + 2.3 * s, y + 3 * s, z + side * 0.8 * s], [x + 6.4 * s, y + 4.2 * s, z + side * 1.65 * s], tip);
  }
}

function lobsterShack(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const width = [10, 12, 17, 20, 20][lv - 1],
    z = -Math.floor(hz * 0.24);
  const roof = [6, 8, 10, 11, 16][lv - 1];
  const depth = [4, 6, 8, 10, 9][lv - 1];
  wharf(c, -width - 2, -hz, width + 2, z + depth + 3);
  wharf(c, -width - 2, z + depth, -width + 3, hz - 1);
  if (lv === 5) {
    // The lobster spans split kitchens over a through-passage linking the street and the float.
    for (const side of [-1, 1]) {
      const cx = side * 12;
      chowderKitchen(c, cx - 6, z - depth, cx + 6, z + depth, 8);
      chowderKitchen(c, cx - 5, z - depth + 2, cx + 5, z + 1, roof - 1);
    }
    v.box(-13, roof, z - 3, 14, roof + 1, z + 3, teal);
  } else chowderKitchen(c, -width + 2, z - depth + 1, width - 2, z + depth - 1, roof);
  lobster(v, 0, roof + 1, z, [0.85, 1.3, 1.8, 2.15, 2.65][lv - 1]);
  if (lv >= 2) {
    trap(c, -width, 2, z + depth);
    landing(c, -width, hz - 2);
  }
  if (lv >= 3) {
    wharf(c, width - 5, z + depth, width + 2, hz - 2);
    cafeTable(c, width - 2, z + depth + 3, enamel, 2);
    mooredBoat(c, 1, z + depth + 4, Math.min(9, hz - z - depth - 4), 4, teal, "row");
  }
  if (lv >= 4) {
    const cx = -hx + 4,
      end = hz - 4;
    v.box(cx, 2, end - 6, cx + 2, 13, end - 4, teal);
    beam(v, [cx, 12, end - 5], [cx + 6, 14, end - 3], teal, 2);
    beam(v, [cx + 6, 14, end - 3], [cx + 6, 5, end - 3], piling);
    trap(c, cx + 5, 3, end - 4);
  }
  if (lv === 5) bulbs(v, -width + 1, z + depth + 1, width - 2, z + depth + 1, 9, [lamp, "#edab5b"]);
}

function beaconDiner(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -3 : -Math.floor(hx * 0.4),
    z = lv === 1 ? 0 : -3;
  const radius = [4.5, 5.4, 6, 7, 7.6][lv - 1],
    h = [8, 14, 20, 26, 31][lv - 1];
  wharf(c, x - 3, -hz, x + 4, z + 2);
  slab(v, oval(x, z, radius + 3, lv === 1 ? 5.5 : radius + 3), 1, 1, teak);
  for (let y = 2; y < h; y++) {
    const r = radius * (1 - (0.31 * (y - 2)) / (h - 2));
    disc(v, x, z, y, y + 1, r, Math.floor((y - 2) / (lv === 1 ? 3 : 4)) % 2 ? "#b34536" : enamel, r - 1.3);
    if (y % 6 === 0) v.box(x - 1, y, z + Math.floor(r) - 1, x + 1, y + 2, z + Math.floor(r), darkBlue);
  }
  v.box(x - 1, 2, z - Math.floor(radius) - 1, x + 2, 6, z - Math.floor(radius) + 1, darkBlue);
  v.box(x - 1, 2, z + Math.floor(radius) - 1, x + 2, 6, z + Math.floor(radius) + 1, darkBlue);
  disc(v, x, z, h, h + 1, radius * 0.83, teal);
  const lantern = radius * 0.55;
  for (let y = h + 1; y <= h + 3; y++)
    disc(v, x, z, y, y + 1, lantern, (_a, _b, _c, _d, angle) =>
      Math.abs(Math.sin(angle * 4)) < 0.22 ? darkBlue : [lamp, 0.7],
    );
  v.cone(x, z, h + 4, h + 7, lantern + 1, 1, "#a44736");
  v.put(x, h + 7, z, "brass");
  if (lv >= 2) {
    wharf(c, x + 2, lv === 2 ? 0 : -8, hx - 2, lv === 2 ? 6 : 9);
    const px = lv === 2 ? 4 : x + 7;
    const plan = oval((px + hx - 3) / 2, 1, (hx - 3 - px) / 2, lv === 2 ? 3 : 5, 16);
    slab(v, plan, 2, 1, teal);
    facade(v, plan, 3, 3, "#669a9d", enamel, 3);
    slab(v, plan, 6, 1, "#c14d3b");
    cafeTable(c, hx - 7, 6, enamel, 2);
  }
  if (lv >= 3) {
    wharf(c, hx - 7, 6, hx - 2, hz - 1);
    landing(c, hx - 5, hz - 2);
  }
  if (lv >= 4) {
    const plan = oval(6, -11, 10, 6, 16);
    slab(v, plan, 2, 1, teak);
    facade(v, plan, 3, 4, "#94bfc1", enamel, 4);
    slab(v, plan, 7, 1, teal);
    v.box(x + 2, 7, -8, 4, 8, -6, enamel);
    cafeTable(c, 7, -12, "#e0ab5e", 8);
  }
  if (lv === 5) {
    // The supper club gains a broad, glazed lookout wrapped above the long diner.
    const ring = oval(x, z, 10, 8, 20);
    slab(v, ring, 13, 1, teal);
    facade(v, ring, 14, 4, "#7eafb1", enamel, 4);
    slab(v, ring, 18, 1, "#b74d42");
    mooredBoat(c, 3, 10, 11, 5, "#476b80", "motor");
  }
}

/** Fish silhouette in elevation, complete with a forked tail and dorsal fin. */
function fishVane(c: Ctx, x: number, y: number, z: number, radius: number) {
  const v = spinner(c, x, y, z, "y", 0.5);
  for (let u = -radius; u < radius; u++) {
    const t = (u + 0.5) / radius;
    const body = t >= -0.53 ? Math.sqrt(Math.max(0, 1 - ((t - 0.2) / 0.76) ** 2)) * 0.34 : 0;
    const tail = t < -0.3 ? Math.min(0.46, (-t - 0.29) * 0.78) : 0;
    const extent = Math.max(body, tail) * radius;
    for (let h = -Math.ceil(extent); h < Math.ceil(extent); h++) {
      if (t < -0.8 && Math.abs(h + 0.5) < (-t - 0.8) * radius * 0.7) continue;
      const color = t > 0.61 && h === 1 ? "#172c42" : h < 0 ? "#e7d5a0" : "#549491";
      v.box(u, h, -1, u + 1, h + 1, 1, color);
    }
    if (t >= -0.28 && t < 0.05)
      v.box(u, 0, -1, u + 1, Math.ceil((0.5 - (t + 0.28) * 0.6) * radius), 1, "#b27b44");
  }
}

function auctionHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    w = [10, 12, 18, 20, 20][lv - 1],
    d = [3, 5, 7, 7, 6][lv - 1];
  const z = lv >= 4 ? -8 : -2,
    h = [5, 6, 8, 9, 10][lv - 1];
  wharf(c, -w - 1, -hz, w + 1, z + d + 3);
  const shed = (x0: number, z0: number, x1: number, z1: number, height: number) => {
    for (let x = x0 + 1; x < x1; x += 6)
      for (const edge of [z0, z1 - 1]) v.box(x, 2, edge, x + 1, height, edge + 1, teal);
    sawtooth(v, x0, height, z0, x1, z1, "#76aeb0", "#c6dfce", lv === 1 ? 4 : 6);
    iceCounter(c, x0 + 2, z1 - 3, Math.min(x1 - x0 - 4, 10), "#437e86");
  };
  if (lv >= 2) shed(-w, z - d, w, z + d, h);
  else {
    for (const x of [-8, 5]) v.box(x, 2, -3, x + 1, 6, -2, teal);
    iceCounter(c, -8, -2, 13, teal);
    awning(v, -8, 6, 6, -3, teal, enamel);
  }
  const pole = lv === 1 ? -2 : -Math.floor(w * 0.62),
    top = h + (lv === 1 ? 3 : 8);
  v.box(pole, 2, z, pole + 1, top + 1, z + 1, piling);
  fishVane(c, pole, top + 1, z, [5, 6, 7, 8, 9][lv - 1]);
  if (lv >= 3) {
    wharf(c, w - 5, z + d, w + 1, hz - 1);
    landing(c, w - 4, hz - 2);
    const dockX = -w + 1;
    wharf(c, dockX, z + d, dockX + 5, hz - 2);
    trap(c, dockX, 2, hz - 6);
    mooredBoat(c, 0, z + d + 6, Math.min(11, hz - z - d - 5), 5, teal, "fish");
  }
  if (lv >= 4) {
    wharf(c, 2, z + d, w, 12);
    shed(3, 3, w, 11, h - 2);
    bulbs(v, -w + 2, z + d - 1, w - 3, 7, h + 2, [lamp]);
  }
  if (lv === 5) {
    wharf(c, -w, 1, -4, hz - 2);
    shed(-w, 4, -5, hz - 3, h + 2);
    // The two fish auction aisles meet at a glazed clerestory above the auctioneer.
    for (const x of [-5, 2]) v.box(x, 2, 0, x + 1, h + 5, 1, rail);
    v.box(-5, h + 2, -2, 4, h + 6, 1, "#b5d4c4");
    sawtooth(v, -7, h + 6, -4, 5, 3, teal, enamel, 4);
    person(v, -2, 2, 3, "#d29847", darkBlue);
  }
}

/** A crab claw viewed from the pier, with tapered tips split by a deep V of sky. */
function claw(v: PixelVox, x: number, z: number, base: number, h: number, side: number) {
  const slice = (y: number, u: number, rx: number, rz: number, color: string) => {
    const cx = x + side * u * h;
    for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
      for (let dz = -Math.floor(rz); dz <= Math.floor(rz); dz++) {
        if (((px - cx) / rx) ** 2 + (dz / rz) ** 2 <= 1) v.put(px, y, z + dz, color);
      }
    }
  };
  for (let dy = 0; dy < h; dy++) {
    const t = (dy + 0.5) / h,
      y = base + dy;
    if (t < 0.47) {
      const palm = Math.sin((t / 0.47) * Math.PI * 0.56);
      slice(
        y,
        0.05 + 0.19 * palm,
        h * (0.11 + 0.17 * palm),
        h * (0.1 + 0.085 * palm),
        t < 0.15 ? "#b24940" : "#d85d47",
      );
    } else {
      const jaw = (t - 0.47) / 0.53;
      const tip = jaw > 0.8 ? "#ffc485" : "#e76d4b";
      // A long curved finger meets a shorter, broader thumb across an open bite.
      slice(
        y,
        0.06 - 0.19 * Math.sin(jaw * Math.PI * 0.82),
        Math.max(0.65, h * (0.17 - 0.12 * jaw)),
        h * (0.15 - 0.085 * jaw),
        tip,
      );
      if (jaw < 0.76) {
        const thumb = jaw / 0.76;
        slice(
          y,
          0.42 + 0.15 * Math.sin(thumb * Math.PI * 0.88),
          Math.max(0.65, h * (0.18 - 0.13 * thumb)),
          h * (0.16 - 0.09 * thumb),
          thumb > 0.78 ? "#ffc485" : "#f0865b",
        );
      }
    }
  }
}

function pincerPortico(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const width = [9, 12, 17, 19, 20][lv - 1],
    centerZ = lv === 1 ? 0 : -3;
  const podium = oval(0, centerZ, width + 2, Math.min(hz - 1, width * 0.76), 20);
  slab(v, podium, 1, 1, teak);
  wharf(c, -3, -hz, 4, centerZ + 1);
  const height = [8, 11, 14, 17, 22][lv - 1];
  const roots = lv === 1 ? [0] : [-1, 1];
  for (const side of roots) {
    const x = side === 0 ? -2 : side * (width - 4);
    claw(v, x, centerZ, 2, height, side === 0 ? 1 : -side);
  }
  if (lv >= 2) {
    const canopy = oval(0, centerZ - 1, width - 4, 4, 18);
    slab(v, canopy, Math.floor(height * 0.52), 1, "#f5cfaa");
    v.box(-3, 2, centerZ - 4, -2, Math.floor(height * 0.52), centerZ - 3, piling);
    v.box(2, 2, centerZ - 4, 3, Math.floor(height * 0.52), centerZ - 3, piling);
  }
  iceCounter(c, -Math.floor(width * 0.5), centerZ + 1, width, "#3d797a");
  if (lv >= 3) {
    wharf(c, -width + 3, 2, -width + 8, hz - 1);
    landing(c, -width + 4, hz - 3);
    cafeTable(c, width - 5, centerZ + 6, enamel, 2);
    mooredBoat(c, -width + 12, 8, Math.min(hz - 8, 10), 4, teal, "row");
  }
  if (lv >= 4) {
    // The fan roof opens toward the water. Counted radial ribs stay visible at city zoom.
    const span = width * 0.61;
    for (let x = -Math.floor(span); x <= span; x++) {
      for (let rz = 0; rz <= 10; rz++) {
        const taper = 0.25 + (0.75 * rz) / 10;
        if (Math.abs(x) > span * taper) continue;
        const y = 6 + Math.round(rz * 0.42 + 2.2 * (1 - (x / (span * taper)) ** 2));
        const rib = Math.round(x / taper) % 4 === 0;
        v.box(x, y, centerZ - 13 + rz, x + 1, y + 1, centerZ - 12 + rz, rib ? enamel : "#d98c6e");
      }
    }
    for (const x of [-8, 8]) v.box(x, 2, centerZ - 4, x + 1, 10, centerZ - 3, piling);
    cafeTable(c, 3, centerZ - 7, enamel, 2);
    wharf(c, width - 7, 2, width - 2, hz - 2);
    for (const x of [-width + 6, width - 5]) v.box(x, 2, hz - 4, x + 1, 9, hz - 3, piling);
    bulbs(v, -width + 6, hz - 4, width - 5, hz - 4, 8, [lamp]);
  }
  if (lv === 5) {
    const back = -hz + 6;
    wharf(c, -width + 2, -hz + 2, width - 2, centerZ - 7);
    claw(v, -8, back, 2, 12, 1);
    claw(v, 8, back, 2, 12, -1);
    beam(v, [-9, 12, back], [9, 12, back], teal, 2);
    for (const x of [-width + 5, width - 5]) person(v, x, 2, hz - 7, "coral", darkBlue);
  }
}

const waterfronts = [lobsterShack, beaconDiner, auctionHall, pincerPortico];
export function buildSeafoodPier(c: Ctx) {
  waterfronts[c.variant % waterfronts.length](c);
}
