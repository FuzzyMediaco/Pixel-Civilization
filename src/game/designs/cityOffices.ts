import {
  type Ctx, type PixelVox, archway, bench, byLv, clockFace, door, flag, fountain,
  gable, hip, lamp, lot, person, ring, spire, stairs, tree, windows,
} from "./kit";

export const CITY_OFFICES = {
  levels: ["Ward Clerk", "Public Service Hall", "Council Square", "Assembly Galleries", "Metropolitan Forum"] as [string, string, string, string, string],
  growth: "A clerk’s office and a civic beacon grow into a public square with assembly galleries and a skyline landmark.",
};

function hall(c: Ctx, x0: number, z0: number, x1: number, z1: number, h: number, wall: string, roof: string) {
  const v = c.v;
  v.hollowBox(x0, 1, z0, x1, h, z1, wall);
  windows(c, x0, 1, z0, x1, h, z1, { w: 2, h: 2, stepH: 4, stepV: 4, col: "warmGlow", darkCol: "glassDark", emit: 0.55 });
  door(v, Math.floor((x0 + x1) / 2) - 1, 1, z1 - 1);
  v.box(x0 - 1, h, z0 - 1, x1 + 1, h + 1, z1 + 1, roof);
}

function notice(v: PixelVox, x: number, z: number) {
  v.box(x, 1, z, x + 1, 5, z + 1, "woodDark");
  v.box(x + 3, 1, z, x + 4, 5, z + 1, "woodDark");
  v.box(x, 3, z, x + 4, 6, z + 1, "oak");
  v.put(x + 1, 4, z, "cream");
  v.put(x + 2, 3, z, "warmGlow");
}

// A brick clock close. A public arcade, a lantern crossing and an oriel chamber join the asymmetric tower.
function clockClose(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const x = -hx + (lv < 3 ? 4 : 7), z = -hz + (lv < 3 ? 5 : 9);
  const radius = byLv(c, [2, 3, 4, 4, 5]), top = byLv(c, [13, 19, 25, 32, 40]);
  const hallTop = 5 + lv;
  const back = -hz + 2, front = lv < 3 ? z + 3 : z + 5;
  hall(c, x, back, hx - 2, front, hallTop, "brick", "limestone");
  gable(v, x, hallTop + 1, back - 1, hx - 1, front + 1, "x", "#50877c", "tealDark");
  v.hollowBox(x - radius, 1, z - radius, x + radius + 1, top, z + radius + 1, "brickDark", "limestone");
  windows(c, x - radius, 1, z - radius, x + radius + 1, top, z + radius + 1, { faces: "se", h: 2, stepV: 4, col: "warmGlow", emit: 0.6 });
  for (const y of [top - 6, top - 1]) v.box(x - radius - 1, y, z - radius - 1, x + radius + 2, y + 1, z + radius + 2, "mortar");
  clockFace(v, x, top - 4, z + radius, Math.min(radius, 3), "warmGlow", "iron");
  for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
    if (dy * dy + dz * dz <= 5) v.put(x + radius, top - 4 + dy, z + dz, "warmGlow", 0.5);
  }
  v.put(x + radius, top - 3, z, "iron").put(x + radius, top - 4, z, "iron").put(x + radius, top - 4, z + 1, "iron");
  const cap = hip(v, x - radius - 1, top, z - radius - 1, x + radius + 2, z + radius + 2, "#467a72", "brass");
  spire(v, x, z, cap, 3 + Math.floor(lv / 2), 1.2, "tealDark", "gold");
  const squareZ = Math.floor((front + hz) / 2);
  v.box(-hx + 2, 0, front, hx - 1, 1, hz - 1, "path");
  v.box(0, 0, front, 3, 1, hz, "limestone");
  if (lv >= 2) {
    const end = lv === 2 ? front + 5 : Math.floor(hz / 3);
    v.box(hx - 5, 1, front, hx - 2, 6, end, "brick");
    for (let bay = front + 1; bay < end - 2; bay += 4) v.clear(hx - 5, 1, bay, hx - 2, 4, bay + 2);
    gable(v, hx - 6, 6, front, hx - 1, end + 1, "z", "#50877c", "tealDark");
    notice(v, -hx + 2, hz - 3);
  }
  if (lv >= 3) {
    fountain(v, lv >= 4 ? 5 : 0, 1, lv >= 4 ? squareZ + 5 : squareZ, lv === 5 ? 4 : 3, "mortar");
    bench(v, lv >= 4 ? 10 : 5, 1, squareZ, "z");
  }
  if (lv >= 4) {
    // A high council passage crosses a gate into the side court. The open arch remains visible from the street.
    const gateFrom = -hx + 3, gateTo = 3, gateZ = squareZ - 1;
    v.hollowBox(gateFrom, 1, gateZ - 2, gateTo, 11, gateZ + 2, "brick", "limestone");
    archway(v, (gateFrom + gateTo) / 2, 1, gateZ - 2, gateZ + 2, 8, 9, "mortar");
    for (let gx = gateFrom + 1; gx < gateTo - 1; gx += 3) {
      v.put(gx, 10, gateZ + 1, "warmGlow", 0.65);
    }
    gable(v, gateFrom - 1, 11, gateZ - 3, gateTo + 1, gateZ + 3, "x", "#50877c", "tealDark");
    const stairX = gateFrom + 1;
    for (let step = 0; step < 7; step++) {
      v.box(stairX, 1, gateZ + 3 + step, stairX + 2, 8 - step, gateZ + 4 + step, "mortar");
    }
    // An occupied glazed oriel hangs over the arcade, carried on three corbels.
    v.box(1, hallTop, front - 1, hx - 3, hallTop + 5, front + 3, "glassDark", 0.24);
    for (let bay = 1; bay < hx - 3; bay += 3) {
      v.box(bay, hallTop - 2, front, bay + 1, hallTop + 5, front + 2, "limestone");
      v.put(bay, hallTop - 1, front + 2, "limestone");
    }
    hip(v, 0, hallTop + 5, front - 2, hx - 2, front + 4, "#477d70", "brass");
  }
  if (lv === 5) {
    const gateZ = hz - 5;
    for (const gx of [-9, 9]) {
      v.hollowBox(gx - 2, 1, gateZ - 1, gx + 3, 6, gateZ + 3, "brick", "limestone");
      hip(v, gx - 3, 6, gateZ - 2, gx + 4, gateZ + 4, "#50877c", "mortar");
    }
    v.box(-8, 6, gateZ - 1, 9, 9, gateZ + 1, "limestone");
    for (let gx = -6; gx <= 6; gx += 3) v.clear(gx, 7, gateZ - 1, gx + 2, 9, gateZ + 1);
    lamp(v, -5, 1, gateZ + 1);
    flag(v, hx - 4, 1, squareZ + 2, 7, ["teal", "cream"]);
  }
  person(v, 3, 1, hz - 4, "teal");
}

function bell(v: PixelVox, x: number, top: number, z: number, radius: number) {
  const r = radius;
  v.put(x, top, z, "iron");
  v.cone(x + 0.5, top - r * 2, top, z + 0.5, r * 0.85, 0.7, "brass");
  ring(v, x + 0.5, z + 0.5, top - r * 2 - 1, top - r * 2, r + 0.4, Math.max(0, r - 0.8), "gold");
  v.put(x, top - r * 2 - 2, z, "iron");
}

// An open timber carillon shows each bell in daylight. Side frames grow around the council's performance yard.
function carillon(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const x = hx - (lv < 3 ? 5 : 7), z = -Math.floor(hz / 2);
  const top = byLv(c, [17, 23, 30, 37, 46]), r = lv < 3 ? 2 : 4;
  const backZ = -hz + 2;
  hall(c, -hx + 2, backZ, x - 1, z + 3, 4 + lv, "#b87558", "woodDark");
  gable(v, -hx + 1, 5 + lv, backZ - 1, x, z + 3, "x", "#78494b");
  for (const dx of [-r, r]) for (const dz of [-r, r]) {
    v.box(x + dx, 1, z + dz, x + dx + (lv >= 3 ? 2 : 1), top, z + dz + 1, "woodDark");
    v.put(x + dx, top - 2, z + dz, "brass");
  }
  for (let floor = 3; floor < top; floor += 6) {
    v.box(x - r, floor, z - r, x + r + 1, floor + 1, z - r + 1, "oak");
    v.box(x - r, floor, z + r, x + r + 1, floor + 1, z + r + 1, "oak");
    v.box(x - r, floor, z - r, x - r + 1, floor + 1, z + r, "oak");
    v.box(x + r, floor, z - r, x + r + 1, floor + 1, z + r, "oak");
    for (let i = 0; i < 5 && floor + i < top - 1; i++) {
      v.put(x - r + Math.round(2 * r * i / 5), floor + i, z - r, "woodLight");
      v.put(x + r, floor + i, z - r + Math.round(2 * r * i / 5), "woodLight");
    }
  }
  v.box(x - r - 1, top, z - 1, x + r + 2, top + 2, z + 2, "woodDark");
  bell(v, x, top - 1, z, lv >= 3 ? 3 : 2);
  gable(v, x - r - 2, top + 2, z - r - 1, x + r + 3, z + r + 2, "z", "#7d4642", "brass");
  if (lv >= 2) {
    const smallerZ = z + r + 3;
    v.box(x - r, 1, smallerZ + 4, x - r + 1, top - 6, smallerZ + 5, "woodDark");
    v.box(x + r, 1, smallerZ + 4, x + r + 1, top - 6, smallerZ + 5, "woodDark");
    v.box(x - r, top - 7, smallerZ - 3, x + r + 1, top - 6, smallerZ + 5, "oak");
    bell(v, x, top - 7, smallerZ + 3, 2);
    bench(v, -hx + 2, 1, hz - 4);
  }
  if (lv >= 3) {
    v.box(-hx + 2, 0, 0, hx - 2, 1, hz - 1, "path2");
    v.box(-hx + 2, 1, 0, -3, 3, 4, "oak");
    for (let dz = 6; dz < hz - 3; dz += 3) bench(v, -hx + 3, 1, dz);
    for (let high = 0; high < 2; high++) bell(v, x, top - 10 - high * 8, z, 2);
    person(v, -hx + 5, 3, 1, "blue");
  }
  if (lv >= 4) {
    const west = -hx + 3;
    v.box(west, 1, z, west + 2, 20, z + 2, "brickDark");
    v.box(west - 1, 18, z - 1, x - r + 1, 20, z + 3, "woodDark");
    for (let bx = west + 3; bx < x - r; bx += 5) bell(v, bx, 18, z, 1);
    gable(v, west - 2, 20, z - 2, west + 4, z + 4, "z", "#7d4642");
  }
  if (lv === 5) {
    for (let n = 0; n < 4; n++) {
      const az = 7 + n * 3;
      v.box(-hx + 3, 1, az, -1 + n, n + 3, az + 2, "brick");
      v.box(-hx + 3, n + 3, az, -1 + n, n + 4, az + 2, "woodLight");
    }
    for (const bx of [-7, -1, 4]) person(v, bx, 1, hz - 3, "teal");
    flag(v, hx - 5, 1, hz - 4, 8, ["brass", "crimson"]);
  }
  person(v, 1, 1, hz - 5, "red");
}

function councilDisc(v: PixelVox, x: number, y: number, z: number, r: number, tall: number) {
  v.cone(x, y, y + 3, z, Math.max(1, r - 3), r, "limestone");
  ring(v, x, z, y + 3, y + tall - 1, r - 0.5, r - 1.9, "#568398", 0.35);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const px = Math.floor(x + (r - 1) * Math.cos(a)), pz = Math.floor(z + (r - 1) * Math.sin(a));
    v.box(px, y + 3, pz, px + 1, y + tall, pz + 1, "cream");
  }
  v.cylinderY(x, z, y + tall - 1, y + tall, r, "steelLight");
  v.dome(x, y + tall, z, Math.max(1, r * 0.55), "glass", 0.25);
}

// A council lookout on a forked pier. The residents' chambers cantilever toward a reflecting pool.
function horizon(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const x = -Math.floor(hx / 3), z = -Math.floor(hz / 3), top = byLv(c, [15, 18, 24, 31, 40]);
  const r = byLv(c, [3, 4, 5, 6, 7]);
  const deckX = x + 1, deckZ = z + 1;
  v.cylinderY(x, z, 1, 5, r + 1, "limestone");
  v.cylinderY(x, z, 3, 4, r + 1.3, "glassDark", 0.35);
  door(v, x - 1, 1, z + r, "woodDark", 2, 3);
  for (let y = 4; y < top + 1; y++) {
    const fork = y < top / 2 ? 1 : Math.min(r - 1, Math.round((y - top / 2) / 3) + 1);
    for (const side of [-1, 1]) v.box(x + fork * side, y, z - 1, x + fork * side + 2, y + 1, z + 2, "limestone");
  }
  councilDisc(v, deckX, top, deckZ, r, lv < 3 ? 5 : 7);
  if (lv >= 2) {
    councilDisc(v, 2, 1, Math.floor(hz / 3), lv === 2 ? 4 : 6, 6);
    v.box(-1, 1, z + 1, 2, 3, Math.floor(hz / 3), "limestone");
    notice(v, -hx + 1, hz - 4);
  }
  if (lv >= 3) {
    const sideX = hx - 6;
    v.cylinderY(sideX, z - 1, 1, 11, 1.8, "limestone");
    councilDisc(v, sideX, 9, z - 1, 4, 5);
    v.box(x, 10, z, sideX, 12, z + 2, "#528298", 0.3);
    ring(v, 0, hz - 4, 0, 1, 3.5, 2.6, "limestone");
    v.cylinderY(0, hz - 4, 0, 1, 2.6, "water", 0.2);
  }
  if (lv >= 4) {
    const annexX = Math.min(hx - 5, x + 9);
    v.box(x, top - 9, z - 1, annexX + 1, top - 7, z + 2, "limestone");
    councilDisc(v, annexX, top - 10, z + 1, 4, 5);
  }
  if (lv === 5) {
    const poolZ = hz - 8;
    v.cylinderY(0, poolZ, 0, 1, 7, "water", 0.22);
    ring(v, 0, poolZ, 1, 2, 7.4, 6.3, "limestone");
    v.box(-3, 1, poolZ - 7, 0, 2, poolZ + 8, "woodLight");
    person(v, -2, 2, poolZ - 1, "indigo");
    tree(v, -hx + 4, 1, poolZ, "birch", 1.2);
    lamp(v, hx - 4, 1, poolZ + 3);
  }
  person(v, hx - 3, 1, hz - 3, "blue");
}

// A tall rigged signal sail. Translucent floor bays follow the curve of a raking mast above a paved assembly slip.
function signalSail(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const sx = hx - (lv < 3 ? 3 : 5), sz = -Math.floor(hz / 3);
  const height = byLv(c, [20, 26, 33, 41, 52]), breadth = byLv(c, [6, 8, 14, 18, 21]);
  v.box(sx, 1, sz, sx + 2, height + 1, sz + 2, "#c96844");
  v.put(sx, height + 1, sz, "warmGlow", 0.7);
  for (let y = 4; y < height - 1; y++) {
    const t = (y - 4) / (height - 5);
    const width = Math.max(1, Math.round(breadth * (1 - Math.pow(t, 1.7))));
    const belly = Math.round(Math.sin(Math.PI * t) * (lv < 3 ? 2 : 4));
    const edgeX = sx - width, edgeZ = sz + belly;
    for (let x = edgeX; x < sx; x++) {
      const across = (sx - x) / width;
      const z = sz + Math.round(belly * across);
      const band = (y - 4) % 5;
      v.box(x, y, z, x + 1, y + 1, z + (lv >= 3 ? 4 : 2), band === 0 ? "cream" : band === 1 ? "#8fcad0" : "#43828c", band > 0 ? 0.22 : 0);
    }
    v.box(edgeX, y, edgeZ, edgeX + 1, y + 1, edgeZ + (lv >= 3 ? 4 : 2), "limestone");
  }
  const hallX = -hx + 2, hallZ = sz + 3;
  hall(c, hallX, -hz + 2, sx + 2, hallZ, 5, "#e7ca9d", "cream");
  if (lv >= 2) {
    v.box(sx - 2, 4, hallZ, sx + 2, 5, hz - 4, "#ab634d");
    for (let z = hallZ + 2; z < hz - 4; z += 4) v.box(sx, 1, z, sx + 1, 4, z + 1, "steelDark");
    notice(v, -hx + 2, hz - 4);
  }
  if (lv >= 3) {
    for (let n = 0; n < 3; n++) {
      const offset = n * 2;
      stairs(v, -hx + 3 + offset, -hx + 5 + offset, 1, 5, 3 - n, "limestone");
    }
    const bx = -hx + 4, bz = 2;
    v.cylinderY(bx, bz, 1, 7, 3.5, "#965244");
    v.cylinderY(bx, bz, 6, 8, 4.2, "cream");
    person(v, bx, 8, bz, "teal");
    flag(v, bx - 4, 1, bz + 5, 8, ["teal", "white", "copper"]);
  }
  if (lv >= 4) {
    const mastX = -hx + 4, mastZ = 2, secondTop = Math.round(height * 0.57);
    v.box(mastX, 1, mastZ, mastX + 1, secondTop + 2, mastZ + 1, "#c96844");
    for (let y = 7; y <= secondTop; y++) {
      const length = Math.max(1, Math.ceil((secondTop - y) / 2));
      v.box(mastX, y, mastZ, mastX + length, y + 1, mastZ + 2, y % 5 === 0 ? "cream" : "teal", 0.15);
    }
    v.box(mastX, 10, sz + 1, mastX + 3, 12, mastZ, "cream");
  }
  if (lv === 5) {
    const gatewayZ = hz - 10;
    for (let x = -9; x <= 9; x++) {
      const y = 6 + Math.round(Math.abs(x) * 0.5);
      v.box(x, y, gatewayZ, x + 1, y + 1, gatewayZ + 4, "#e19a67");
      if (Math.abs(x) > 7) v.box(x, 1, gatewayZ, x + 1, y, gatewayZ + 1, "steelDark");
    }
    v.box(-6, 0, gatewayZ + 1, 7, 1, hz - 2, "limestone");
    for (let x = -6; x < 7; x += 4) person(v, x, 1, gatewayZ + 4, "indigo");
  }
  person(v, 1, 1, hz - 3, "crimson");
}

export function buildCityOffices(c: Ctx): void {
  lot(c, "grass2", 1);
  c.v.box(-c.hx + 2, 0, -c.hz + 2, c.hx - 2, 1, c.hz - 2, c.vpick(["path2", "#d6bb99", "#c8c7bb", "#e3d5bc"]));
  c.v.box(-1, 0, Math.floor(c.hz / 3), 2, 1, c.hz, "path");
  [clockClose, carillon, horizon, signalSail][c.variant](c);
}
