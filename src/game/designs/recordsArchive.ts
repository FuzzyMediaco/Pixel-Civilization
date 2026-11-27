// Public access starts at a staffed retrieval counter in each of these four archives.
import { byLv, person, type Ctx, type PixelVox } from "./kit";
import { disc } from "./commerceKit";
import { beam, entrance, finish as f, planter } from "./sculpturalKit";

const bronze = "#a47543",
  brass = "#deb575",
  walnut = "#714a3a",
  cedar = "#ac7052";
const paper = "#efe0bc",
  ink = "#334748",
  green = "#547c70";
const tabs = ["#ac6557", "#688c80", "#c39b5e", "#778199"];

function desk(v: PixelVox, x: number, z: number, y = 1) {
  v.box(x - 2, y, z - 1, x + 2, y + 2, z + 1, walnut);
  v.box(x - 3, y + 2, z - 2, x + 3, y + 3, z + 1, paper);
  v.box(x - 2, y + 3, z - 1, x, y + 4, z + 1, green);
  v.put(x + 1, y + 3, z - 1, f.amber, 0.55);
  person(v, x, y, z - 3, "#5b8680");
}
function pull(v: PixelVox, x: number, y: number, z: number, half: number) {
  for (const a of [-half, half]) v.box(x + a, y, z, x + a + 1, y + 2, z + 2, brass);
  v.box(x - half, y - 1, z + 1, x + half + 1, y, z + 2, brass);
  v.box(x - 1, y + 2, z - 1, x + 2, y + 3, z, paper, 0.35);
}

function cabinet(v: PixelVox, x: number, z: number, w: number, d: number, rows: number, openRow: number) {
  const left = x - Math.floor(w / 2),
    right = left + w;
  for (let i = 0; i < rows; i++) {
    const y = 1 + i * 5,
      front = z + (i === openRow ? 4 : 0);
    v.box(left, y, z - d, right, y + 1, front, bronze);
    v.box(left, y + 1, z - d, left + 1, y + 5, front, cedar);
    v.box(right - 1, y + 1, z - d, right, y + 5, front, walnut);
    v.box(left + 1, y + 1, z - d, right - 1, y + 5, z - d + 1, walnut);
    v.box(left, y + 1, front - 1, right, y + 4, front, i % 2 ? walnut : cedar);
    if (i === openRow) {
      for (let a = z - d + 2, j = 0; a < front - 2; a += 2, j++) {
        v.box(left + 1, y + 1, a, right - 1, y + 4, a + 1, paper);
        v.box(left + 2 + (j % 2) * 2, y + 4, a, left + 5 + (j % 2) * 2, y + 5, a + 1, tabs[j % 4]);
      }
    } else {
      v.box(left, y + 4, z - d, right, y + 5, front, cedar);
    }
    pull(v, x, y + 2, front, Math.min(3, Math.floor(w / 4)));
  }
}
function hangingIndex(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? 0 : -Math.floor(hx * 0.4),
    z = lv < 3 ? -1 : -4;
  const w = byLv(c, [8, 12, 14, 17, 20]),
    d = byLv(c, [5, 6, 8, 10, 13]),
    rows = byLv(c, [1, 2, 3, 4, 5]);
  cabinet(v, x, z, w, d, rows, rows - 1);
  const counterX = lv < 3 ? (lv === 1 ? -2 : hx - 7) : x + 4;
  const counterZ = lv < 3 ? hz - 3 : z + 8;
  desk(v, counterX, counterZ);
  if (lv >= 3) v.box(x - 2, 0, z + 3, counterX + 4, 1, counterZ + 3, f.limestone);
  entrance(c, x, z + 4, 2);
  if (lv >= 2) {
    const sx = lv === 2 ? hx - 6 : hx - 7;
    cabinet(v, sx, -1, 6, 4, 1, 0);
  }
  if (lv >= 3) cabinet(v, hx - 8, -hz + 7, 9, 6, lv === 5 ? 4 : 2, 0);
  if (lv >= 4) {
    // The public reading loggia shelters the register where the two cabinet aisles meet.
    for (const a of [counterX - 4, counterX + 4]) v.box(a, 1, counterZ - 2, a + 1, 8, counterZ - 1, bronze);
    v.box(counterX - 5, 8, counterZ - 3, counterX + 6, 9, counterZ + 1, paper);
    v.box(x + 3, 13, z - 3, hx - 6, 14, z, green);
    for (let a = x + 3; a < hx - 6; a += 4) v.box(a, 14, z - 1, a + 1, 17, z, bronze);
    v.box(x + 3, 16, z - 1, hx - 6, 17, z, brass);
  }
  if (lv === 5) {
    const roof = rows * 5 + 2;
    for (const a of [x - 6, x + 6]) v.box(a, roof - 2, z - d + 2, a + 1, roof + 3, z - d + 3, bronze);
    v.box(x - 7, roof + 3, z - d + 1, x + 8, roof + 4, z - d + 5, green);
    person(v, x + 2, 14, z - 1, "#b66352");
    planter(v, hx - 3, 0, hz - 4, 1);
  }
}

function folderFan(v: PixelVox, x: number, z: number, reach: number, h: number, d: number, n: number) {
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    const height = Math.round(h * (1 - Math.abs(t) * 0.25)),
      lean = Math.round(t * reach);
    const rootX = x + Math.round(t * reach * 0.24);
    for (let y = 0; y < height; y++) {
      const xx = rootX + Math.round((lean * y) / height);
      v.box(xx, 2 + y, z - d, xx + 2, 3 + y, z, y === height - 1 ? tabs[i % 4] : paper);
      v.put(xx, 2 + y, z - 1, y % 5 === 0 ? brass : tabs[i % 4], y % 5 === 0 ? 0.4 : 0);
    }
    const tip = rootX + Math.round((lean * (height - 1)) / height);
    const tabZ = z - d + 1 + Math.round(((d - 4) * i) / (n - 1));
    v.box(tip, 2 + height, tabZ, tip + 2, 4 + height, tabZ + 3, tabs[i % 4]);
  }
  v.box(x - Math.ceil(reach * 0.4), 1, z - d - 1, x + Math.ceil(reach * 0.4) + 2, 3, z + 1, walnut);
}
function folioFan(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv < 3 ? -1 : -4,
    z = lv >= 3 ? -1 : 0;
  const h = byLv(c, [8, 13, 17, 20, 23]),
    d = byLv(c, [5, 6, 9, 11, 13]),
    r = byLv(c, [4, 7, 7, 10, 12]);
  folderFan(v, x, z, r, h, d, lv + 2);
  desk(v, x, hz - 3);
  entrance(c, x, z + 1, 2);
  if (lv >= 2) {
    v.hollowBox(hx - 8, 1, -5, hx - 2, 7, 2, green);
    v.box(hx - 7, 2, 1, hx - 3, 5, 2, "#c19466", 0.3);
    v.box(hx - 9, 6, -5, hx - 1, 7, 3, paper);
  }
  if (lv >= 3) {
    const px = hx - 6;
    for (let y = 1; y <= 7; y += 3) {
      v.box(px - 3, y, 6, px + 3, y + 1, 10, bronze);
      v.box(px - 2, y + 1, 7, px + 2, y + 2, 10, paper);
    }
  }
  if (lv >= 4) {
    folderFan(v, hx - 9, -5, 4, 12, 5, 3);
    v.box(x, 6, z - 3, hx - 8, 7, z, walnut);
    person(v, 4, 7, z - 2, "#52705f");
  }
  if (lv === 5) {
    folderFan(v, -hx + 10, hz - 7, 5, 11, 7, 4);
    v.box(-hx + 4, 0, hz - 6, x + 3, 1, hz - 2, f.limestone);
    planter(v, hx - 5, 0, hz - 6, 2);
  }
}

function carousel(v: PixelVox, x: number, z: number, r: number, tiers: number) {
  const high = 2 + tiers * 4;
  v.cylinderY(x, z, 1, high + 3, Math.max(1.5, r * 0.22), bronze);
  for (let i = 0; i < tiers; i++) {
    const y = 2 + i * 4,
      bins = r < 5 ? 5 : 8;
    disc(v, x, z, y, y + 1, r, (a, _y, b, _d, angle) =>
      angle > 0.7 && angle < 1.65 ? null : (a + b) % 3 === 0 ? brass : bronze,
    );
    for (let j = 0; j < bins; j++) {
      const a = (j * Math.PI * 2) / bins + (i % 2) * 0.16;
      if (a > 0.55 && a < 1.65) continue;
      const px = x + Math.round((r - 1) * Math.cos(a)),
        pz = z + Math.round((r - 1) * Math.sin(a));
      beam(v, [x, y + 1, z], [px, y + 1, pz], green);
      v.box(px - 1, y + 1, pz - 1, px + 2, y + 3, pz + 2, tabs[(i + j) % 4]);
      v.put(px, y + 2, pz + 2, paper, 0.35);
    }
  }
  disc(v, x, z, high, high + 1, r * 0.52, green);
  v.cylinderY(x, z, high + 1, high + 3, 1.6, brass);
}
function indexCarousel(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv === 1 ? -2 : lv === 2 ? 0 : -Math.floor(hx * 0.36),
    z = lv >= 3 ? -3 : -1;
  const r = byLv(c, [5, 6, 7, 9, 10]),
    n = lv + 1;
  carousel(v, x, z, r, n);
  desk(v, lv === 1 ? 2 : hx - 6, hz - 4);
  entrance(c, x, z + r - 1, 2);
  if (lv >= 2) {
    const lift = x + r - 1,
      top = 2 + n * 4;
    v.box(lift, 1, z + 2, lift + 2, top + 4, z + 4, green);
    for (let y = 4; y <= top; y += 3) v.put(lift + 1, y, z + 4, brass);
    v.box(lift - 1, top + 2, z - 1, lift + 2, top + 4, z + 4, green);
    v.box(lift - 3, top, z, lift - 1, top + 2, z + 2, ink);
  }
  if (lv >= 3) carousel(v, hx - 7, -hz + 8, 5, lv - 1);
  if (lv >= 4) {
    v.box(x + 2, 9, z - 4, hx - 6, 10, z - 1, walnut);
    v.box(x + 2, 12, z - 1, hx - 6, 13, z, brass);
    for (let a = x + 2; a < hx - 6; a += 4) v.box(a, 10, z - 1, a + 1, 13, z, bronze);
  }
  if (lv === 5) {
    carousel(v, -hx + 8, hz - 8, 4, 2);
    v.box(-hx + 4, 0, hz - 5, hx - 4, 1, hz - 2, f.limestone);
    person(v, 4, 10, z - 2, "#b76551");
  }
}

function planTube(v: PixelVox, x: number, z: number, cy: number, r: number, d: number) {
  v.ringZ(x, cy, z - d, z, r, r - 1.3, "#659088");
  v.ringZ(x, cy, z - d, z - d + 1, r + 0.3, r - 1.2, bronze);
  v.ringZ(x, cy, z - 2, z - 1, r + 0.5, r - 0.9, bronze);
  v.ringZ(x, cy, z, z + 1, r + 0.3, Math.max(0, r - 1.8), paper);
  for (const dx of [-r + 1, r - 2]) {
    v.box(x + dx, cy - 1, z, x + dx + 1, cy + 1, z + 1, brass, 0.45);
  }
  for (let a = 0; a < Math.PI * 3.6; a += 0.18) {
    const radius = (r - 1.2) * (1 - a / (Math.PI * 3.9));
    v.put(x + Math.cos(a) * radius, cy + Math.sin(a) * radius, z, paper);
  }
}
function mapVault(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 4, 5, 6, 7]);
  const x = lv === 1 ? -1 : lv === 2 ? -5 : -Math.floor(hx * 0.37),
    z = lv >= 3 ? -2 : 0,
    d = byLv(c, [5, 6, 9, 12, 14]);
  const cy = r + 2;
  v.box(x - r, 1, z - d, x + r + 1, 3, z + 1, walnut);
  planTube(v, x, z, cy, r, d);
  if (lv >= 2) planTube(v, x + r * 2, z, cy, r, d);
  if (lv >= 3) planTube(v, x + r, z, cy + Math.round(r * 1.75), r, d);
  if (lv >= 3) {
    const reach = lv >= 4 ? 9 : 7;
    for (let zz = 1; zz <= reach; zz++) {
      const y = zz < 3 ? 3 : 2;
      v.box(x - r + 1, y, z + zz, x + r, y + 1, z + zz + 1, zz % 3 === 0 ? "#a9ccbf" : "#599498");
      v.put(x - r + 2 + ((zz >> 1) % (r + 1)), y, z + zz, paper);
    }
  }
  const tx = lv === 1 ? 3 : lv === 2 ? 6 : -6,
    tz = hz - 4;
  v.box(tx - 3, 1, tz - 2, tx + 3, 3, tz + 1, bronze);
  v.box(tx - 3, 3, tz - 3, tx + 3, 4, tz + 2, "#6c9a9e");
  for (let a = tx - 2; a < tx + 3; a += 2) v.put(a, 3, tz, paper);
  v.put(tx + 2, 4, tz - 2, f.amber, 0.6);
  person(v, tx - 2, 1, tz + 2, "#a86e57");
  entrance(c, tx, tz, 2);
  if (lv >= 4) {
    const side = hx - 7;
    planTube(v, side, -hz + 9, 6, 4, 7);
    v.box(side - 4, 1, -1, side + 3, 7, 3, green);
    v.box(side - 3, 2, 3, side + 2, 5, 4, "#e7c28f", 0.45);
    for (let j = 0; j < 7; j++) {
      const y = 6 + j;
      v.box(side - 5, y, 2 - j, side + 5, y + 1, 3 - j, j % 3 === 0 ? paper : "#689496");
      v.put(side - 3 + Math.floor(j / 2), y, 2 - j, "#c18459");
    }
  }
  if (lv === 5) {
    planTube(v, x + r * 3, z, cy + Math.round(r * 1.75), r, d);
    planTube(v, x + r * 2, z, cy + Math.round(r * 3.5), r, d);
    v.box(-hx + 4, 0, hz - 9, hx - 3, 1, hz - 5, f.limestone);
    desk(v, hx - 6, hz - 5);
    for (const px of [x - r + 1, x + r * 2]) v.box(px, 1, z + 3, px + 2, 6, z + 5, bronze);
    v.box(x - r, 6, z + 2, x + r * 2 + 3, 7, z + 5, green);
  }
}

export function recordsArchive(c: Ctx): void {
  [hangingIndex, folioFan, indexCarousel, mapVault][c.variant % 4](c);
}
