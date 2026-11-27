import { type Ctx, type TreeKind, PixelVox, archway, barrelRoof, bench, bush, clockFace, colonnade, cyl, door,
  flag, flatRoof, flowerBed, fountain, gable, hip, lamp, lot, mansard, pediment, person, ring, sawtooth, speckle,
  tree, truck, windows } from "./kit";
import { defineDesigns, type DesignEntry } from "./registry";
import { POST_OFFICE, buildPostOffice } from "./postOffice";
import { COURTHOUSE, buildCourthouse } from "./courthouse";
import { CITY_OFFICES, buildCityOffices } from "./cityOffices";

const regionalWalls = ["brick", "#e8b981", "cream", "#d8dde1"];
const regionalRoofs = ["slate", "terracotta", "tealDark", "#486e88"];
const parkTrees: TreeKind[] = ["oak", "palm", "autumn", "blossom"];
const accents = ["#d65e4c", "#deab41", "#428e83", "#7a6da4"];

function lawn(c: Ctx): void {
  lot(c, c.vpick(["grass2", "grass", "#a7b665", "#99bb81"]));
  speckle(c, "grass3", 0.06);
}

// Distinct vernaculars share a wall module: brick gables, tiled hips, mansards and sawtooth clerestories.
function hall(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number,
  wall = c.vpick(regionalWalls), roof = c.vpick(regionalRoofs)): number {
  const { v, variant } = c;
  v.hollowBox(x0, 1, z0, x1, h, z1, wall, variant === 1 ? wall : "limestone");
  windows(c, x0, 1, z0, x1, h, z1, { h: 2, w: variant === 3 ? 2 : 1, sill: "marbleShade", col: "glassDark", stepV: 4, stepH: variant === 3 ? 4 : 3 });
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1);
  if (variant === 0) return gable(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, "x", roof, "cream");
  if (variant === 1) return hip(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, roof, "sandDark", 4);
  if (variant === 2) return mansard(v, x0 - 1, h, z0 - 1, x1 + 1, z1 + 1, roof, "slate", "glass");
  sawtooth(v, x0, h, z0, x1, z1, roof);
  return h + 3;
}

function gazebo(c: Ctx, x: number, z: number, r: number, y = 1): void {
  const { v, variant } = c;
  cyl(v, x, z, y, y + 1, r + 1, "woodLight");
  for (const s of [-1, 1]) for (const t of [-1, 1]) v.box(x + s * (r - 1), y + 1, z + t * (r - 1), x + s * (r - 1) + 1, y + 5, z + t * (r - 1) + 1, "cream");
  if (variant === 0 || variant === 2) v.cone(x, y + 5, y + 5 + r, z, r + 2, 0.5, c.vpick(accents));
  else hip(v, x - r - 1, y + 5, z - r - 1, x + r + 2, z + r + 2, c.vpick(regionalRoofs), "woodLight");
  v.put(x, y + 5 + r, z, "brass", 0.2);
}

function swings(c: Ctx, x: number, z: number): void {
  const { v } = c, col = c.vpick(accents);
  for (const xx of [x - 3, x + 3]) for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    v.put(xx, 1 + i, z + s * Math.round((4 - i) / 2), col);
  }
  v.box(x - 3, 6, z, x + 4, 7, z + 1, col);
  for (const side of [-1, 1]) v.box(x + side, 3, z, x + side + 1, 6, z + 1, "steel");
  v.box(x - 1, 2, z - 1, x + 2, 3, z + 1, "rubber");
}

function carousel(c: Ctx, x: number, z: number, r: number): void {
  const { v } = c;
  cyl(v, x, z, 1, 2, r + 1, "woodLight");
  cyl(v, x, z, 2, 9, 1, "brass");
  const horses = new PixelVox();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const xx = Math.round(Math.cos(a) * (r - 1)), zz = Math.round(Math.sin(a) * (r - 1));
    horses.box(xx, 0, zz, xx + 1, 6, zz + 1, "brass");
    horses.box(xx - 1, 2 + i % 2, zz, xx + 2, 3 + i % 2, zz + 1, i % 2 ? "cream" : "wood");
    horses.put(xx + 1, 3 + i % 2, zz, "cream");
  }
  c.addRotor({ vox: horses, pivot: [x, 2, z], axis: "y", speed: 0.3 });
  for (let xx = -r; xx <= r; xx++) for (let zz = -r; zz <= r; zz++) {
    const d = Math.hypot(xx, zz);
    if (d > r + 0.25) continue;
    const color = Math.floor((Math.atan2(zz, xx) + Math.PI) * 4 / Math.PI) % 2 ? c.vpick(accents) : "cream";
    v.put(x + xx, 8 + Math.floor((r - d) * 0.65), z + zz, color);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    v.put(x + Math.round(Math.cos(a) * r), 8, z + Math.round(Math.sin(a) * r), "warmGlow", 0.8);
  }
}

function amphitheater(c: Ctx, x: number, z: number, r: number): void {
  for (let row = 0; row < 3; row++) {
    const radius = r - row * 2;
    for (let step = 0; step <= 4 * radius; step++) {
      const a = step * Math.PI / (4 * radius);
      c.v.put(x + Math.cos(a) * radius, 3 - row, z + Math.sin(a) * radius, row % 2 ? "woodLight" : "limestone");
    }
  }
  c.v.box(x - 3, 1, z - 2, x + 4, 2, z + 2, "wood");
}

function park(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  lawn(c);
  const trail = c.vpick(["path", "woodLight", "path2", "marbleShade"]);
  const pathZ = (x: number) => Math.round(Math.sin(x / hx * Math.PI) * (hz / 3));
  for (let x = -hx; x < hx; x++) {
    const z = pathZ(x);
    v.box(x, 0, z - 1, x + 1, 1, z + 2, trail);
  }
  const kind = parkTrees[variant], anchor = Math.floor(hx / 2);
  for (let x = -hx + 3; x <= hx - 3; x += 7) {
    tree(v, x, 1, -hz + 3, kind, 0.9 + (x % 3 === 0 ? 0.35 : 0), x);
  }
  if (lv === 1) {
    if (variant === 0) bench(v, -1, 1, 3);
    if (variant === 1) gazebo(c, 2, 3, 2);
    if (variant === 2) swings(c, 1, 3);
    if (variant === 3) fountain(v, 2, 1, 3, 2);
  }
  if (lv >= 2) {
    swings(c, -anchor, Math.floor(hz * 0.38));
    const sx = -anchor + 5, sz = Math.floor(hz * 0.5);
    for (let n = 0; n < 4; n++) v.box(sx, 5 - n, sz + n, sx + 2, 6 - n, sz + n + 1, c.vpick(accents));
    v.box(sx, 1, sz, sx + 1, 5, sz + 1, "steelDark");
  }
  if (lv >= 3) {
    const x = anchor, z = -Math.floor(hz / 3);
    cyl(v, x, z, 0, 1, 5, "water", 0.12);
    gazebo(c, x + 4, z - 2, 2);
    for (let i = 0; i < 3; i++) v.put(x - 2 + i, 1, z + i % 2, "leaf");
  }
  if (lv >= 4) carousel(c, -anchor + 3, -Math.floor(hz / 3), 5);
  if (lv === 5) amphitheater(c, anchor, Math.floor(hz / 3), 7);
  for (let i = 1; i < lv; i++) {
    const x = Math.round(-hx + (i * 2 * hx) / lv);
    bench(v, x, 1, pathZ(x) + 3);
    lamp(v, x - 1, 1, pathZ(x) - 2, 3);
  }
}

function pocket(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  lawn(c);
  const x = lv >= 4 ? -6 : -2;
  const surface = c.vpick(["#bca499", "#e9c68c", "#c7b083", "#d8d5bf"]);
  v.box(-hx + 1, 0, -hz + 1, hx - 1, 1, hz - 1, surface);
  // Plaza, play yard, agility run and raked garden each gain a different centerpiece.
  if (variant === 0) {
    v.box(x - 2, 1, -4, x + 3, 2, 1, "marble");
    for (let i = 0; i < 2 + lv; i++) {
      const xx = x + Math.round(Math.sin(i * 0.9) * 1.5), zz = -2 + Math.round(Math.cos(i * 0.9) * 1.5);
      v.box(xx, 2 + i, zz, xx + 2, 4 + i, zz + 2, i % 2 ? "copper" : "tealDark");
    }
    if (lv >= 3) fountain(v, x + 4, 1, 4, 2);
  } else if (variant === 1) {
    swings(c, x, -2);
    if (lv >= 2) {
      v.box(x + 4, 1, -1, x + 6, 5, 1, "red");
      for (let i = 0; i < 4; i++) v.box(x + 4, 4 - i, i, x + 6, 5 - i, i + 1, "yellow");
    }
    if (lv >= 3) v.cone(x + 5, 5, 8, -1, 2, 0.5, "teal");
  } else if (variant === 2) {
    v.ringZ(x + 1, 3, -2, -1, 2.5, 1.5, "orange");
    for (const side of [-1, 1]) v.box(x + side * 2, 1, -2, x + side * 2 + 1, 4, -1, "tealDark");
    for (let i = 0; i < lv + 1; i++) v.box(x - 3 + i * 2, 1, 3, x - 2 + i * 2, 3, 4, i % 2 ? "white" : "red");
    v.box(x - 2, 1, 0, x + 1, 3, 1, "leather"); v.put(x + 1, 3, 0, "leather");
    if (lv >= 2) {
      for (let zz = -5; zz < -1; zz++) v.ringZ(x + 4.5, 1.5, zz, zz + 1, 2.1, 1.1, zz % 2 ? "tealDark" : "lime");
    }
    if (lv >= 3) {
      for (let k = 0; k < 6; k++) v.box(x - 4, 1 + Math.min(k, 5 - k), k - 2, x - 2, 2 + Math.min(k, 5 - k), k - 1, "wood");
    }
  } else {
    for (let z = -6; z <= 6; z += 2) v.box(-hx + 2, 0, z, hx - 2, 1, z + 1, "path2");
    for (let i = 0; i < lv + 1; i++) {
      const a = i * 2.4;
      v.sphere(x + Math.cos(a) * 3, 1, Math.sin(a) * 3, 1 + (i % 2), 1.5 + i % 2, 1.2, "stone");
    }
    if (lv >= 3) gazebo(c, x, -3, 2);
  }
  tree(v, hx - 4, 1, -hz + 3, parkTrees[variant], 1 + lv * 0.07);
  bench(v, -hx + 2, 1, hz - 3);
  if (lv >= 2) flowerBed(c, -hx + 1, -hz + 1, -hx + 3, -hz + 5, 1, [c.vpick(accents), "cream"]);
  if (lv >= 4) {
    gazebo(c, 5, 1, 3);
    bench(v, 4, 1, 5);
  }
  if (lv === 5) {
    for (let k = -hx + 1; k < hx - 1; k++) v.put(k, 6 + Math.floor(Math.abs(k) / 6), -5, k % 3 ? "steelDark" : "warmGlow", k % 3 ? 0 : 0.9);
    for (const xx of [-hx + 1, hx - 2]) v.box(xx, 1, -5, xx + 1, 9, -4, "woodDark");
  }
}

function gardens(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const blooms = [["pink", "purple", "white"], ["olive", "lime", "amber"], ["red", "orange", "magenta"], ["crimson", "pink", "cream"]][variant];
  lawn(c);
  v.box(-2, 0, -hz, 2, 1, hz, "path");
  const crop = (x: number, z: number) => {
    v.box(x - 2, 1, z - 2, x + 3, 2, z + 3, "wood");
    flowerBed(c, x - 1, z - 1, x + 2, z + 2, 2, blooms);
    if (variant === 1) {
      v.box(x, 2, z, x + 1, 6, z + 1, "moss"); v.put(x + 1, 4, z, "moss");
    } else if (variant === 2) tree(v, x, 2, z, "palm", 0.7);
    else if (variant === 3) {
      for (const s of [-1, 1]) v.box(x + s, 2, z, x + s + 1, 6, z + 1, "woodLight");
      v.box(x - 1, 5, z, x + 2, 6, z + 1, "leafDark"); v.put(x, 6, z, "pink");
    }
  };
  for (let x = -hx + 4; x <= hx - 4; x += 7) for (let z = -hz + 4; z <= hz - 4; z += 7) {
    if (Math.abs(x) < 3 || (lv >= 3 && z < 2 && Math.abs(x) < hx * 0.6)) continue;
    crop(x, z);
  }
  if (lv >= 2) hall(c, -hx + 1, -hz + 1, -hx + 7, -hz + 6, 5, "woodLight", "tealDark");
  if (lv >= 3) {
    const r = lv + 1, z = -Math.floor(hz / 3);
    const span = Math.min(hx - 4, lv * 2 + 1);
    v.hollowBox(-span, 1, z - r, span, 5, z + r, "glass");
    const roofY = barrelRoof(v, -span - 1, 5, z - r - 1, span + 1, z + r + 1, "x", "glass", "white");
    for (let x = -span; x < span; x += 3) for (const s of [-1, 1]) v.box(x, 1, z + s * r, x + 1, 6, z + s * r + 1, "tealDark");
    door(v, -1, 1, z + r - 1, "tealDark");
    if (lv >= 4) {
      v.dome(0, roofY - 1, z, lv + 1, "#acdfe0");
      for (let xx = -lv; xx <= lv; xx++) v.put(xx, roofY - 1 + Math.floor(Math.sqrt((lv + 1) ** 2 - xx * xx)), z, "white");
    }
    if (lv === 5) {
      cyl(v, 0, z, roofY + 3, roofY + 7, 2, "cream");
      v.cone(0, roofY + 7, roofY + 10, z, 3, 0.5, "tealDark");
      for (const s of [-1, 1]) gazebo(c, s * (hx - 6), Math.floor(hz / 3), 3);
    }
  }
}

function italian(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const paving = c.vpick(["terracotta", "path", "marbleShade", "limestone"]);
  lawn(c);
  const rear = -Math.floor(hz / 3), front = Math.floor(hz / 3);
  const terraces = Math.min(4, lv);
  for (let s = 0; s < terraces; s++) {
    const end = rear + (terraces - s) * 2;
    v.box(-hx + 2, 1 + s, -hz + 2, hx - 2, 2 + s, end, s === terraces - 1 ? paving : "sandDark");
  }
  v.box(-2, 0, rear, 2, 1, hz, paving);
  for (const side of [-1, 1]) {
    const x = side * Math.floor(hx * 0.58);
    for (let z = -hz + 4; z < hz - 1; z += 7) {
      const y = z < rear ? 1 + terraces : 1;
      if (variant === 3) {
        cyl(v, x, z, y, y + 2, 1, "wood");
        v.sphere(x, y + 3, z, 2, 2, 2, "leafDark"); v.sphere(x, y + 6, z, 1.3, 1.4, 1.3, "leaf");
      } else tree(v, x, y, z, variant === 1 ? "round" : "cypress", 1.1);
    }
    if (lv >= 3 || variant === 1) {
      const cx = side * Math.floor(hx * 0.31), r = Math.max(2, Math.floor(hx / 7));
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const edge = variant % 2 ? Math.abs(dx) + Math.abs(dz) : Math.max(Math.abs(dx), Math.abs(dz));
        if (edge <= r) v.put(cx + dx, 1, front + dz, edge === r ? "leafDark" : c.vpick(["amber", "purple", "white", "pink"]));
      }
    }
    if (lv >= 4) {
      const zz = front - 5;
      v.box(x - 1, 1, zz - 1, x + 2, 4, zz + 2, "marbleShade");
      v.box(x, 4, zz, x + 1, 7, zz + 1, "marble"); v.put(x + side, 6, zz, "marble");
    }
  }
  if (lv >= 2 || variant === 2) {
    fountain(v, 0, 1 + terraces, rear, 2 + Math.floor(lv / 2), "marble");
    if (variant === 2) for (let z = rear + 1; z < front; z++) {
      v.box(-1, Math.max(0, terraces - Math.floor((z - rear) / 2)), z, 1, Math.max(0, terraces - Math.floor((z - rear) / 2)) + 1, z + 1, "water", 0.2);
    }
  }
  if (lv === 5) {
    const zz = -hz + 4;
    v.hollowBox(-9, 1 + terraces, zz, 9, terraces + 9, zz + 6, "cream");
    windows(c, -9, 1 + terraces, zz, 9, terraces + 9, zz + 6, { col: "glassDark", h: 2 });
    hip(v, -10, terraces + 9, zz - 1, 10, zz + 7, "terracotta", "limestone");
    colonnade(v, -6, 7, zz + 8, terraces + 1, terraces + 7, "x", 3);
    pediment(v, -7, 8, terraces + 7, zz + 5, zz + 9, "cream");
  }
}

function largePark(c: Ctx): void {
  const { v, lv, hx, hz, variant } = c;
  lawn(c);
  const lakeX = -Math.floor(hx / 4), radius = lv + 2;
  const waterZ = (x: number) => Math.sin(x / hx * Math.PI) * (hz * 0.24);
  for (let x = -hx; x < hx; x++) {
    const z = waterZ(x);
    const width = Math.max(1, Math.round(radius * (1 - Math.abs(x - lakeX) / (hx + 1))));
    v.box(x, 0, z - width - 1, x + 1, 1, z + width + 2, "sandDark");
    v.box(x, 0, z - width, x + 1, 1, z + width + 1, "water", 0.12);
    if (width > 3) v.box(x, 0, z - width + 2, x + 1, 1, z + width - 1, "waterDeep");
    const walk = Math.round(z + width + 3 + Math.sin(x / 4) * 1.5);
    v.box(x, 0, walk, x + 1, 1, walk + 2, variant === 1 ? "woodLight" : "path");
    if (x % 9 === 0 && lv >= 2) {
      bench(v, x, 1, walk + 2);
      if (variant === 0 || lv >= 4) lamp(v, x - 1, 1, walk, 4, "iron");
    }
  }
  for (let x = -hx + 4; x < hx - 2; x += 7) for (const s of [-1, 1]) {
    const z = s * (hz - 3 - c.ri(0, 3));
    tree(v, x, 1, z, parkTrees[variant], 1.1 + c.rand() * 0.65);
  }
  if (lv >= 2) {
    const x = Math.floor(hx * 0.4), from = Math.floor(waterZ(x)) - radius - 1;
    for (let z = 0; z <= 2 * radius + 2; z++) {
      const h = 1 + Math.round(Math.sin(z * Math.PI / (2 * radius + 2)) * 2);
      v.box(x - 2, h, from + z, x + 2, h + 1, from + z + 1, "woodLight");
      for (const side of [-2, 1]) v.put(x + side, h + 2, from + z, variant === 3 ? "red" : "woodDark");
    }
  }
  if (lv >= 3) {
    const x = -Math.floor(hx * 0.5), z = Math.floor(waterZ(x)) - radius - 5;
    hall(c, x - 4, z - 3, x + 4, z + 3, 5, "woodLight", c.vpick(accents));
    v.box(x + 2, 1, z + 3, x + 4, 2, z + radius + 3, "oak");
    for (const s of [-1, 1]) {
      v.box(x + 2 + s * 3, 1, z + radius, x + 3 + s * 3, 2, z + radius + 4, c.vpick(accents));
    }
  }
  if (lv >= 4) {
    const x = -Math.floor(hx / 3), z = Math.floor(hz * 0.4);
    v.box(x - 5, 1, z - 4, x + 6, 2, z + 3, "woodLight");
    for (let dx = -5; dx <= 5; dx++) {
      const y = 3 + Math.round(Math.sqrt(26 - dx * dx));
      v.box(x + dx, 2, z - 4, x + dx + 1, y, z - 3, "cream");
      v.box(x + dx, y, z - 4, x + dx + 1, y + 1, z + 1, c.vpick(accents));
    }
    amphitheater(c, x, z + 1, 6);
  }
  if (lv === 5) {
    gazebo(c, Math.floor(hx * 0.44), -Math.floor(hz * 0.48), 4);
    for (let x = -hx + 3; x < hx - 2; x += 5) {
      v.box(x - 2, 0, hz - 6, x + 3, 1, hz - 4, "path");
      lamp(v, x, 1, hz - 4, 4, "iron");
    }
  }
}

function school(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  lawn(c);
  const x = lv < 3 ? 0 : -Math.round(hx / 3), z = -Math.floor(hz / 3);
  const w = Math.min(hx - 3, 3 + lv), depth = Math.min(5, hz - 3);
  const h = lv >= 4 ? 11 : 7;
  v.box(x - 2, 0, z, x + 2, 1, hz, "path");
  const roof = hall(c, x - w, z - depth, x + w, z + depth, h);
  // The old school bell remains visible inside the university's clock tower.
  const towerY = roof + (lv >= 3 ? lv : 0);
  v.hollowBox(x - 2, roof - 2, z - 2, x + 2, towerY + 1, z + 2, c.vpick(regionalWalls));
  for (const xx of [x - 2, x + 1]) for (const zz of [z - 2, z + 1]) v.box(xx, towerY, zz, xx + 1, towerY + 4, zz + 1, "cream");
  v.box(x - 1, towerY + 1, z - 1, x + 1, towerY + 3, z + 1, "brass");
  hip(v, x - 3, towerY + 4, z - 3, x + 3, z + 3, c.vpick(regionalRoofs));
  if (lv >= 3) clockFace(v, x, towerY - 1, z + 2, 1);
  if (lv >= 2) {
    const bx = hx - 5;
    truck(v, bx, 1, hz - 3, "x", "busYellow", "busYellow");
    for (let xx = bx - 3; xx <= bx + 1; xx += 2) v.put(xx, 3, hz - 3, "glassDark");
    swings(c, -hx + 5, hz - 4);
  }
  if (lv >= 3) {
    const xx = Math.floor(hx * 0.53), zz = Math.floor(hz / 4);
    const r = Math.min(6, Math.floor(hx / 3));
    v.box(xx - r, 0, zz - 5, xx + r, 1, zz + 5, "leafDark");
    v.box(xx - r + 1, 0, zz - 4, xx + r - 1, 1, zz + 4, "cream");
    v.box(xx - r + 2, 0, zz - 3, xx + r - 2, 1, zz + 3, "moss");
    v.box(xx, 0, zz - 3, xx + 1, 1, zz + 3, "cream");
    if (lv >= 4) for (const sign of [-1, 1]) {
      const p = xx + r * sign;
      lamp(v, p, 1, zz - 5, 7, "steelDark"); v.box(p - 1, 8, zz - 5, p + 2, 9, zz - 4, "warmGlow", 1);
    }
  }
  if (lv >= 4) hall(c, 3, -hz + 2, hx - 2, -hz + 9, 8, c.vpick(regionalWalls));
  if (lv === 5) {
    const libraryTop = hall(c, -hx + 3, 6, -hx + 11, hz - 3, 9);
    const libraryX = -hx + 7, libraryZ = Math.round((hz + 3) / 2);
    cyl(v, libraryX, libraryZ, libraryTop - 1, libraryTop + 2, 3, "limestone");
    for (const s of [-1, 1]) v.put(libraryX + s * 2, libraryTop, libraryZ + 2, "glass", 0.5);
    v.dome(libraryX, libraryTop + 2, libraryZ, 3.2, variant === 3 ? "glassDark" : "copper");
    v.put(libraryX, libraryTop + 5, libraryZ, "brass");
    for (let xx = -2; xx < hx - 4; xx += 5) tree(v, xx, 1, hz - 5, variant === 1 ? "palm" : "round", 0.9);
    flag(v, -1, 1, 5, 9, [c.vpick(accents), "white"]);
    for (const xx of [x, 1]) v.box(xx - 1, 0, -hz + 10, xx + 2, 1, hz - 6, "path");
    v.box(x - 1, 0, hz - 9, 3, 1, hz - 7, "path");
    v.box(x, 0, -hz + 11, hx - 6, 1, -hz + 13, "path");
    for (let i = 0; i < 4; i++) person(v, x + (i % 2), 1, 4 + i * 3, accents[(i + variant) % 4]);
  }
}

function finance(c: Ctx): void {
  const { v, lv, hx, hz, variant } = c;
  const metal = c.vpick(["brass", "copper", "chrome", "gold"]);
  lot(c, "marbleShade");
  const w = Math.min(hx - 3, 3 + lv), z = lv >= 3 ? -4 : -2, h = 5 + lv;
  v.hollowBox(-w, 1, z - 3, w, h, z + 4, c.vpick(["limestone", "brickDark", "granite", "tealDark"]));
  windows(c, -w, 1, z - 3, w, h, z + 4, { h: 1, faces: "new", col: "warmGlow", stepH: 3 });
  flatRoof(c, -w - 1, h, z - 4, w + 1, z + 5, "steelDark", metal, false);
  // Circular vault door, its spoke handle and a roof-mounted minted coin.
  const r = lv < 3 ? 2 : 3;
  v.ringZ(0, r + 1, z + 3, z + 5, r + 1, 0, "steelDark");
  v.ringZ(0, r + 1, z + 5, z + 6, r, r - 1, metal);
  v.box(-1, r + 1, z + 5, 2, r + 2, z + 6, "chrome");
  if (lv >= 2) {
    const coin = new PixelVox(), cr = Math.min(6, 1 + lv);
    coin.ringZ(0.5, 0.5, -1, 1, cr, 0, metal);
    coin.ringZ(0.5, 0.5, 1, 2, cr, cr - 1, "goldDark");
    for (let dy = -cr + 1; dy < cr; dy++) coin.put(Math.round(Math.sin(dy) * (cr / 3)), dy, 1, "cream", 0.25);
    c.addRotor({ vox: coin, pivot: [0, h + 2 + cr, z], axis: "y", speed: 0.28 });
  } else v.ringZ(0.5, h + 2.5, z, z + 1, 2, 0, metal);
  if (variant === 1) for (const s of [-1, 1]) v.box(s * (w - 1), h + 1, z - 3, s * (w - 1) + 1, h + 4, z + 3, "brickDark");
  if (variant === 2) for (const s of [-1, 1]) cyl(v, s * w, z + 4, 1, h, 1.3, "chrome");
  if (variant === 3) pediment(v, -w, w, h + 1, z + 2, z + 5, metal);
  if (lv >= 3) {
    for (const s of [-1, 1]) for (let zz = z + 7; zz < hz - 2; zz += 4) {
      const x = s * (w - 1); v.box(x, 1, zz, x + 1, 3, zz + 1, "steelDark"); v.put(x, 3, zz, metal);
    }
    truck(v, 0, 1, hz - 5, "z", "steelDark", "granite");
  }
  if (lv >= 4) for (const s of [-1, 1]) {
    const x = s * (hx - 4);
    cyl(v, x, z, 1, h, 2.5, "granite");
    cyl(v, x, z, h, h + 2, 3, metal);
  }
  if (lv === 5) for (const s of [-1, 1]) {
    v.hollowBox(s * (hx - 5) - 2, 1, -hz + 2, s * (hx - 5) + 3, 7, z - 1, "granite", "steel");
    v.box(s * (hx - 5) - 3, 7, -hz + 1, s * (hx - 5) + 4, 8, z, metal);
  }
}

function fire(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  const red = c.vpick(["crimson", "#b85035", "#ba382a", "#d94f44"]);
  lot(c, "concrete2");
  const bays = Math.min(lv, Math.max(1, Math.floor((hx * 2 - 5) / 6)));
  const width = Math.ceil((bays * 6 + 1) / 2), z = -Math.floor(hz / 4);
  const h = lv >= 3 ? 9 : 7;
  const roofY = hall(c, -width, z - 5, width, z + 4, h, variant < 2 ? "brick" : "concrete", c.vpick(regionalRoofs));
  for (let i = 0; i < bays; i++) {
    const x = -width + 1 + i * 6;
    v.box(x, 1, z + 3, x + 5, 6, z + 4, red);
    v.box(x, 4, z + 3, x + 5, 5, z + 4, "glassDark");
    v.box(x + 2, 4, z + 3, x + 3, 5, z + 4, red);
    v.box(x, 0, z + 4, x + 1, 1, hz, "yellow");
    v.put(x + 4, 6, z + 4, "red", 0.9);
  }
  if (lv >= 2) {
    const x = width - 2, zz = Math.min(hz - 5, z + 8);
    truck(v, x, 1, zz, "z", red, red);
    v.box(x - 1, 4, zz - 4, x, 5, zz + 3, "silver");
    v.box(x + 1, 4, zz - 4, x + 2, 5, zz + 3, "silver");
    for (let k = -4; k < 3; k += 2) v.put(x, 4, zz + k, "silver");
    v.put(x, 4, zz + 2, "red", 1);
  }
  if (lv >= 3) {
    const x = -width + 2, zz = z - 3, top = roofY + lv * 2;
    v.hollowBox(x - 2, h, zz - 2, x + 3, top, zz + 3, variant === 2 ? "cream" : "brick2", "limestone");
    for (let y = h + 1; y < top; y += 3) v.box(x, y, zz + 2, x + 1, y + 2, zz + 3, "glassDark");
    hip(v, x - 3, top, zz - 3, x + 4, zz + 4, red);
    for (const s of [-1, 1]) {
      v.put(x + s * 2, top - 1, zz - 2, "red", 0.8);
      v.put(x + s * 2, top - 1, zz + 2, "red", 0.8);
    }
    c.blink(x, top + 4, zz, "red");
  }
  if (lv >= 4) {
    const xx = hx - 6;
    v.hollowBox(xx - 3, 1, -hz + 2, xx + 3, 10, z - 3, "concreteDark");
    windows(c, xx - 3, 1, -hz + 2, xx + 3, 10, z - 3, { col: "charcoal", h: 2 });
    v.box(xx - 3, 10, -hz + 2, xx + 3, 11, z - 3, "steelDark");
    for (let y = 1; y < 10; y += 2) v.box(xx + 3, y, z - 6, xx + 4, y + 1, z - 3, "hazard");
  }
  if (lv === 5) {
    flag(v, -hx + 3, 1, hz - 5, 9, [red, "white"]);
    const zz = hz - 6;
    for (let k = 0; k < 9; k++) {
      v.box(-7 + k, 3 + k, zz, -6 + k, 4 + k, zz + 1, "steelLight");
      v.box(-7 + k, 3 + k, zz + 2, -6 + k, 4 + k, zz + 3, "steelLight");
      if (!(k % 2)) v.put(-7 + k, 3 + k, zz + 1, "steel");
    }
    truck(v, -7, 1, zz + 1, "x", red, red);
  }
}

function community(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  lawn(c);
  const z = -Math.floor(hz / 3), w = Math.min(hx - 3, 4 + lv);
  const roof = c.vpick(["#367f87", "#d57b4f", "#5e85a7", "#8a69a4"]);
  v.box(-2, 0, z + 3, 2, 1, hz, "path");
  hall(c, -w, z - 4, w, z + 4, 6, c.vpick(["woodLight", "cream", "brick", "marbleShade"]), roof);
  for (let x = -w; x < w; x++) {
    const h = 3 + Math.round(Math.sin((x + w) * Math.PI / w) * 1.5);
    v.put(x, h, z + 4, accents[Math.abs(x + variant) % 4]);
  }
  if (lv >= 2) gazebo(c, -hx + 5, Math.floor(hz * 0.4), 3);
  if (lv >= 3) {
    const xx = Math.floor(hx * 0.55), zz = Math.floor(hz / 3);
    v.box(xx - 4, 0, zz - 5, xx + 5, 1, zz + 6, "terracotta");
    v.box(xx - 4, 0, zz, xx + 5, 1, zz + 1, "cream");
    for (const s of [-1, 1]) {
      const end = zz + 5 * s;
      v.box(xx, 1, end, xx + 1, 5, end + 1, "steelDark");
      v.box(xx - 1, 5, end, xx + 2, 7, end + 1, "white"); v.put(xx, 5, end - s, "orange");
    }
  }
  if (lv >= 4) {
    const x = -hx + 3;
    v.hollowBox(x, 1, -hz + 2, x + 8, 6, 2, "#c9b393");
    barrelRoof(v, x - 1, 6, -hz + 1, x + 9, 3, "z", roof, "cream");
    windows(c, x, 1, -hz + 2, x + 8, 6, 2, { w: 2, h: 2 });
  }
  if (lv === 5) {
    v.box(-5, 1, hz - 10, 4, 2, hz - 5, "wood");
    for (const xx of [-5, 3]) v.box(xx, 2, hz - 10, xx + 1, 10, hz - 9, "iron");
    for (let xx = -5; xx <= 3; xx++) v.put(xx, 8 + Math.floor(Math.abs(xx + 1) / 2), hz - 10, xx % 2 ? "warmGlow" : roof, 0.7);
    for (let xx = -5; xx < 8; xx += 4) bench(v, xx, 1, hz - 2);
  }
}

function capitol(c: Ctx): void {
  const { v, hx, hz, lv, variant } = c;
  lawn(c);
  const x = 0, z = -Math.floor(hz / 4), r = 2 + lv;
  const wall = c.vpick(["marble", "limestone", "#d7a88a", "#e3e6db"]);
  const roof = c.vpick(["tealDark", "goldDark", "slate", "#7ba99f"]);
  const w = Math.min(hx - 4, 5 + lv * 2);
  v.box(-3, 0, z + 3, 3, 1, hz, "path");
  const h = 6 + lv;
  v.hollowBox(-w, 1, z - 5, w, h, z + 6, wall, "marbleShade");
  windows(c, -w, 1, z - 5, w, h, z + 6, { col: "glassDark", h: 2 });
  flatRoof(c, -w - 1, h, z - 6, w + 1, z + 7, "granite", wall, false);
  colonnade(v, -r, r + 1, z + 8, 1, h, "x", 2, "marble");
  pediment(v, -r - 1, r + 2, h, z + 4, z + 9, wall, "marbleShade");
  const drum = h + 1 + lv;
  cyl(v, x, z, h + 1, drum, r, wall);
  for (let i = 0; i < Math.max(6, r * 2); i++) {
    const a = 2 * Math.PI * i / Math.max(6, r * 2);
    v.put(Math.floor(Math.sin(a) * (r - 0.2)), drum - 1, z + Math.floor(Math.cos(a) * (r - 0.2)), "glassDark", 0.45);
  }
  if (variant === 0) v.dome(x, drum, z, r + 0.5, roof);
  if (variant === 1) {
    v.cone(x, drum, drum + r + 1, z, r + 1, 1.5, roof);
    ring(v, x, z, drum + 1, drum + 2, r + 0.4, r - 0.8, "brass");
  }
  if (variant === 2) hip(v, -r, drum, z - r, r + 1, z + r + 1, roof, "marble");
  if (variant === 3) for (let y = 0; y <= r; y++) cyl(v, x, z, drum + y, drum + y + 1, Math.max(1, Math.ceil(Math.sqrt(Math.max(0, r * r - y * y)) / 2) * 2), y % 3 === 0 ? "marble" : roof);
  cyl(v, x, z, drum + r, drum + r + 2 + Math.floor(lv / 2), 1, "cream");
  v.put(0, drum + r + 2 + Math.floor(lv / 2), z, "gold", 0.7);
  if (lv >= 2) for (const s of [-1, 1]) {
    const xx = s * (w - 2);
    hall(c, xx - 3, z - 3, xx + 3, z + 7, h - 2, wall, roof);
  }
  if (lv >= 3) for (const s of [-1, 1]) {
    const xx = s * Math.min(hx - 6, w + 4);
    v.hollowBox(xx - 4, 1, z - 6, xx + 4, h - 1, z + 5, wall);
    windows(c, xx - 4, 1, z - 6, xx + 4, h - 1, z + 5, { h: 2 });
    hip(v, xx - 5, h - 1, z - 7, xx + 5, z + 6, roof, "marbleShade", 3);
    flag(v, xx + 1, 1, z + 10, 8, [c.vpick(accents), "white"]);
  }
  if (lv >= 4) {
    fountain(v, 0, 1, Math.floor(hz * 0.6), lv, "marble");
    for (const s of [-1, 1]) for (let zz = z + 10; zz < hz - 1; zz += 6) tree(v, s * (hx - 5), 1, zz, "round", 1.3);
  }
  if (lv === 5) for (const s of [-1, 1]) {
    const xx = s * (hx - 8);
    for (let zz = -hz + 5; zz <= hz - 6; zz += 5) {
      bush(v, xx, 1, zz, 1.5, "leafDark", "cream");
      lamp(v, xx - s * 3, 1, zz, 4);
    }
  }
}

function design(build: (c: Ctx) => void, footprints: DesignEntry["footprints"], levels: DesignEntry["levels"], growth: string): DesignEntry {
  return { build, footprints, levels, growth };
}

defineDesigns({
  school: design(school, [[1,1],[2,1],[2,2],[3,2],[3,3]], ["One-Room Schoolhouse","Village School","School Campus","High School","University Quad"], "The bell tower becomes a campus clock above classrooms, a playing field and a university quad."),
  park: design(park, [[1,1],[2,1],[2,2],[3,2],[3,3]], ["Village Green","Playground Park","Gazebo Pond","Carousel Park","Amphitheater Park"], "A winding path links swings, a gazebo pond, turning carousel and performance lawn."),
  little_parks: design(pocket, [[1,1],[1,1],[1,1],[2,1],[2,1]], ["Bench Corner","Pocket Garden","Neighborhood Nook","Pocket Plaza","Lantern Garden"], "A tiny gathering place earns a pavilion and a canopy of evening lights."),
  gardens: design(gardens, [[1,1],[2,1],[2,2],[3,2],[3,3]], ["Raised Beds","Community Allotments","Greenhouse Garden","Conservatory Garden","Botanical Palm House"], "Allotments spread around a gardener’s shed and a ribbed glass palm house."),
  city_offices: design(buildCityOffices, [[1,1],[1,2],[2,2],[2,2],[2,3]], CITY_OFFICES.levels, CITY_OFFICES.growth),
  post_offices: design(buildPostOffice, [[1,1],[2,1],[2,2],[3,2],[3,2]], POST_OFFICE.levels, POST_OFFICE.growth),
  tax_collecting_office: design(finance, [[1,1],[1,1],[1,2],[2,2],[2,2]], ["Tax Booth","Collections Office","Audit Bureau","Vault Headquarters","Treasury Fortress"], "A rolling coin rises above a round vault door, an armored van and fortified repositories."),
  fire_department: design(fire, [[1,1],[2,1],[2,2],[3,2],[3,2]], ["Volunteer Fire Shed","Firehouse","Fire Station","Fire Hall","Fire Command HQ"], "Engine bays multiply, a hose tower rises and a ladder truck joins the training yard."),
  community_centers: design(community, [[1,1],[2,1],[2,2],[3,2],[3,3]], ["Meeting Hall","Community Hall","Recreation Center","Community Campus","Civic Commons"], "A painted neighborhood hall adds a pavilion, basketball court, gym and an outdoor stage."),
  italian_gardens: design(italian, [[2,2],[2,2],[3,2],[3,3],[4,3]], ["Cypress Walk","Fountain Terrace","Parterre Garden","Statue Garden","Villa Garden Estate"], "Terraces step up through parterres, fountains and sculpture to a garden villa."),
  courthouses: design(buildCourthouse, [[1,1],[2,1],[2,2],[2,3],[3,3]], COURTHOUSE.levels, COURTHOUSE.growth),
  government_buildings: design(capitol, [[2,2],[2,2],[3,2],[3,3],[4,3]], ["Government Office","Ministry Building","State House","Capitol","Grand Capitol Dome"], "The assembly dome gains a lantern and matching legislative wings on a ceremonial mall."),
  large_parks: design(largePark, [[2,2],[3,2],[3,3],[4,3],[4,4]], ["River Meadow","Lake Park","Boathouse Park","Bandshell Park","Central Park"], "A winding lake gains an arched footbridge, boat landing, concert shell and lantern promenade."),
});
