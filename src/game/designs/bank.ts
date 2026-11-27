/** The four Original banks secure their reserves behind a gatewheel, ingots, coins or masonry drums. */
import { byLv, cyl, door, lot, pave, person, ring, type Ctx, type PixelVox } from "./kit";

export const BANK = {
  levels: ["Deposit Office", "Weighing House", "Exchange Vault", "District Treasury", "Grand Reserve"] as [string, string, string, string, string],
  growth: "A guarded deposit office gains a weighing room, a second reserve and a transfer hall. Its largest vault turns its locks, bullion, coins or masonry chambers into the building itself.",
};

const iron = "#454d56",
  graphite = "#303840",
  brass = "#c59a50",
  patina = "#548777";
const sandstone = "#b4a68b",
  darkStone = "#716f68",
  paleStone = "#d8caaf";

function guardedDoor(c: Ctx, x: number, z: number) {
  const { v, hz } = c;
  pave(v, x - 3, z, x + 4, hz, "path2");
  v.box(x - 2, 1, z, x + 2, 5, z + 1, graphite);
  door(v, x - 1, 1, z, "woodDark", 2, 3);
  v.put(x, 2, z + 1, brass);
  v.box(x - 2, 4, z, x + 2, 5, z + 2, brass);
  person(v, x + 3, 1, Math.min(hz - 1, z + 2), patina, iron);
  v.put(x + 3, 4, Math.min(hz - 1, z + 2), iron);
}

function gatewheel(v: PixelVox, x: number, y: number, z: number, radius: number) {
  v.ringZ(x, y, z - 1, z + 1, radius, 0, graphite);
  v.ringZ(x, y, z, z + 1, radius - 1, 0, "steel");
  v.ringZ(x, y, z + 1, z + 2, radius - 1, radius - 2, brass);
  const reach = Math.max(1, radius - 3);
  for (let i = -reach; i <= reach; i++) {
    v.put(x + i, y + i * 0.5, z + 1, "chrome");
    v.put(x + i, y - i * 0.5, z + 1, "chrome");
  }
  v.box(x - 1, y - 1, z + 1, x + 1, y + 1, z + 3, iron);
}

/** The cylindrical lock spans the depth of the building. Later vaults open into a stepped, armored gatehouse. */
function buildGatewheel(c: Ctx) {
  const { v, lv, hz } = c;
  const radius = byLv(c, [4, 5, 7, 8, 8]);
  const x = byLv(c, [0, -4, -4, 1, -4]),
    y = radius + 1;
  const front = hz - 6,
    back = -hz + 2;
  v.ringZ(x, y, back, front, radius + 1, radius - 0.5, iron);
  v.ringZ(x, y, back, back + 1, radius, 0, iron);
  v.ringZ(x, y, front - 1, front, radius, 0, graphite);
  for (const z of [back + 1, front - 2]) v.ringZ(x, y, z, z + 2, radius + 1.6, radius, "steelLight");
  if (lv >= 3) {
    for (const offset of [-2, 2])
      v.box(x + offset, y + radius, back + 4, x + offset + 1, y + radius + 1, front - 3, brass);
  }
  v.box(x - radius, 1, back, x + radius, 3, front, graphite);
  if (lv >= 2) {
    const width = lv === 2 ? 10 : 4;
    const wingX = x + radius - 1;
    v.hollowBox(wingX, 1, back + 1, wingX + width, 7, front - 1, patina);
    v.box(wingX - 1, 6, back, wingX + width + 1, 8, front, iron);
    v.box(wingX, 4, front - 1, wingX + width - 1, 5, front, "warmGlow", 0.6);
  }
  if (lv >= 3) {
    v.ringZ(x - radius, y - 2, back + 4, front - 3, 4.4, 0, "steelDark");
    v.ringZ(x - radius, y - 2, front - 4, front - 2, 4.5, 3.3, brass);
  }
  if (lv >= 4) {
    // The tally gallery straddles the main vault; its open middle shows the armored roof ribs.
    for (const side of [-1, 1]) {
      const px = x + side * (radius - 2);
      v.box(px - 1, y + radius - 2, back + 3, px + 1, y + radius + 3, back + 6, graphite);
    }
    v.box(x - radius + 1, y + radius + 2, back + 2, x + radius, y + radius + 4, back + 7, "steelLight");
    v.box(x - radius + 2, y + radius + 4, back + 3, x + radius - 1, y + radius + 5, back + 6, patina);
  }
  if (lv === 5) {
    // Four locking dogs anchor the circular barrel to the foundation at street level.
    for (const z of [back + 4, front - 5]) {
      for (const side of [-1, 1]) {
        const px = x + side * (radius + 1);
        v.box(px - 2, 1, z, px + 3, 5, z + 3, "steelDark");
        v.box(px - 1, 5, z, px + 2, 9, z + 3, "steel");
        v.put(px, 7, z + 3, brass);
      }
    }
  }
  if (lv === 5) {
    // The great door has rolled off its seat. Deposits are visible through the circular opening.
    v.ringZ(x, y, front - 2, front, radius, 0, graphite);
    v.ringZ(x, y, front - 1, front + 1, radius, radius - 1, "steelLight");
    for (let row = 0; row < 3; row++) {
      const shelfWidth = 5 - row;
      v.box(
        x - shelfWidth,
        y - 3 + row * 3,
        front - 1,
        x + shelfWidth,
        y - 2 + row * 3,
        front + 1,
        "steelDark",
      );
      for (let bx = x - shelfWidth + 1; bx < x + shelfWidth - 1; bx += 3)
        v.box(bx, y - 2 + row * 3, front - 1, bx + 2, y + row * 3, front + 1, "gold");
    }
    v.box(x + 2, 1, front + 1, x + 17, 3, front + 4, iron);
    gatewheel(v, x + 10, y, front + 2, radius - 1);
    guardedDoor(c, x, front + 1);
  } else {
    gatewheel(v, x, y + 1, front, radius);
    guardedDoor(c, x, front + 2);
  }
}

// Each tier slopes in from all four cast edges. Raised assayer's marks sit in a recessed top cartouche.
function ingot(v: PixelVox, x: number, z: number, y: number, width: number, depth: number, height: number) {
  const left = Math.floor(x - width / 2),
    rear = Math.floor(z - depth / 2);
  for (let dy = 0; dy < height; dy++) {
    const bevel = Math.min(2, Math.floor((dy * 3) / height));
    const color = dy === 0 ? "#795231" : dy === height - 1 ? "#e6bd6f" : "#bb8543";
    const x0 = left + bevel,
      z0 = rear + bevel,
      x1 = left + width - bevel,
      z1 = rear + depth - bevel;
    if (x1 <= x0 || z1 <= z0) continue;
    v.box(x0, y + dy, z0, x1, y + dy + 1, z1, color);
    if (dy && dy !== height - 1) v.clear(x0 + 1, y + dy, z0 + 1, x1 - 1, y + dy + 1, z1 - 1);
  }
  v.box(x - 2, y + height - 1, z - 1, x + 2, y + height, z + 1, "goldDark");
  v.put(x, y + height - 1, z - 1, "cream");
  // Three punched squares are the city's assay mark.
  if (width >= 17) {
    for (const dx of [-2, 0, 2]) v.put(x + dx, y + height - 1, z + 2, "#96743c");
  }
}

/** A bullion counter, a double batch, a cross-bond, an elevated weigh-house and finally a crowned ingot stack. */
function buildIngots(c: Ctx) {
  const { v, lv, hz } = c;
  const front = hz - 4;
  if (lv === 1) ingot(v, 0, 0, 1, 13, 10, 6);
  if (lv === 2) {
    ingot(v, -7, 0, 1, 12, 9, 6);
    ingot(v, 6, -1, 1, 13, 9, 7);
    v.box(-2, 1, 0, 2, 5, 4, iron);
  }
  if (lv >= 3) {
    for (const x of [-7, 7]) ingot(v, x, -1, 1, 12, 24, 7);
    ingot(v, 0, -6, 8, 23, 9, 6);
    if (lv >= 4) ingot(v, 0, 4, 8, 25, 9, 6);
    if (lv === 5) {
      ingot(v, 0, -1, 14, 10, 21, 6);
      for (const x of [-11, 11]) {
        v.box(x - 2, 1, 9, x + 2, 5, 13, graphite);
        v.box(x - 1, 3, 12, x + 1, 4, 14, "warmGlow", 0.5);
      }
    }
    v.box(-3, 1, front - 6, 3, 6, front + 1, graphite);
    for (const wx of [-8, 7]) {
      v.box(wx - 2, 3, 10, wx + 2, 5, 11, iron);
      v.box(wx - 1, 3, 11, wx + 1, 4, 12, "warmGlow", 0.6);
    }
  }
  guardedDoor(c, lv === 2 ? -7 : 0, lv < 3 ? 4 : front);
}

// The reeded edge and raised die shape repeat on every coin, including the little teller's counter.
function coin(v: PixelVox, x: number, z: number, y: number, radius: number, edge: string, face: string) {
  cyl(v, x, z, y, y + 1, radius - 0.5, iron);
  cyl(v, x, z, y + 1, y + 3, radius, edge);
  cyl(v, x, z, y + 3, y + 4, radius - 0.6, face);
  ring(v, x, z, y + 4, y + 5, radius - 1, Math.max(1, radius - 2), edge);
  const reach = radius > 5 ? 3 : 2;
  // A raised laurel leaf on the face stays recognizable from the overhead camera.
  for (let n = -reach; n <= reach; n++) {
    const width = Math.min(2, reach - Math.abs(n));
    for (let j = -width; j <= width; j++) v.put(x + j + Math.round(n / 2), y + 4, z + n, edge);
  }
  v.put(x, y + 4, z, face);
}

function coinStack(
  v: PixelVox,
  x: number,
  z: number,
  radius: number,
  count: number,
  edge: string,
  face: string,
) {
  for (let n = 0; n < count; n++) coin(v, x + (n % 2), z - (n % 2), 1 + 4 * n, radius, edge, face);
}

/** A stamped coin counter becomes a mint with offset piles and a standing presentation coin over its entrance. */
function buildCoinMint(c: Ctx) {
  const { v, lv } = c;
  const rearX = lv === 1 ? 0 : -6,
    rearZ = lv < 3 ? -1 : -5;
  coinStack(v, rearX, rearZ, lv < 3 ? 5 : 7, byLv(c, [1, 2, 3, 4, 4]), brass, "#e2c890");
  if (lv >= 2) coinStack(v, 6, lv < 3 ? 0 : -4, lv === 2 ? 5 : 6, lv < 4 ? 1 : 2, "#719b98", "#bed1c7");
  if (lv >= 3) {
    coinStack(v, 1, 6, 6, lv === 3 ? 1 : 2, "#ae684c", "#e7ac80");
    v.box(-6, 3, -2, 2, 5, 5, brass);
  }
  if (lv >= 4) {
    coinStack(v, -9, 6, 4, 1, "#719b98", "#bed1c7");
    v.box(-6, 7, -2, 1, 9, 6, iron);
  }
  if (lv === 5) {
    // The die has a pierced diamond, an original mint mark that reads against the sky.
    v.ringZ(6, 17, 1, 4, 8, 0, brass);
    v.ringZ(6, 17, 4, 5, 7.5, 6.5, "#ffe4a1");
    for (let j = -3; j <= 3; j++) {
      const span = 4 - Math.abs(j);
      v.clear(6 - span, 17 + j, 1, 6 + span, 18 + j, 5);
    }
    v.box(1, 5, 1, 4, 12, 4, graphite);
    v.box(8, 5, 1, 11, 12, 4, graphite);
  }
  const x = lv === 1 ? 0 : lv === 2 ? -6 : 1;
  const z = lv < 3 ? 4 : 12;
  v.box(x - 2, 1, z - 2, x + 2, 5, z + 1, iron);
  guardedDoor(c, x, z);
}

function chamber(v: PixelVox, x: number, z: number, radius: number, height: number) {
  ring(v, x, z, 1, height, radius, radius - 1.6, sandstone);
  cyl(v, x, z, 1, 3, radius + 0.5, darkStone);
  for (let a = 0; a < 8; a++) {
    const angle = (a * Math.PI) / 4;
    const bx = Math.round(x + (radius - 0.7) * Math.cos(angle)),
      bz = Math.round(z + (radius - 0.7) * Math.sin(angle));
    v.box(bx - 1, 1, bz - 1, bx + 1, height, bz + 1, paleStone);
    v.box(bx - 1, 1, bz - 1, bx + 2, 3, bz + 2, darkStone);
  }
  cyl(v, x, z, height - 1, height + 1, radius + 0.4, paleStone);
  cyl(v, x, z, height + 1, height + 2, radius - 0.5, patina);
  ring(v, x, z, height + 2, height + 3, radius - 1, Math.max(0, radius - 2), darkStone);
}

/** Radial stone cash chambers grow from a single bonded drum into a cloverleaf reserve around a lantern. */
function buildRoundhouse(c: Ctx) {
  const { v, lv } = c;
  const cx = lv === 2 ? -5 : 0,
    cz = lv < 3 ? -1 : -3;
  const radius = byLv(c, [5, 5, 10, 8, 7]);
  chamber(v, cx, cz, radius, byLv(c, [5, 6, 8, 10, 13]));
  if (lv >= 3) {
    // The sunken gold-counting floor is crossed by two iron skylight ribs.
    const roomTop = byLv(c, [0, 0, 8, 10, 13]);
    const opening = radius - 3;
    cyl(v, cx, cz, roomTop + 1, roomTop + 2, opening, graphite);
    for (const dx of [-2, 2]) {
      v.box(cx + dx - 1, roomTop + 2, cz - 2, cx + dx + 1, roomTop + 3, cz + 2, "goldDark");
      v.box(cx + dx - 1, roomTop + 3, cz - 1, cx + dx + 1, roomTop + 4, cz + 1, "gold");
    }
    for (const dx of [-opening + 1, opening - 1])
      v.box(cx + dx, roomTop + 2, cz - opening + 1, cx + dx + 1, roomTop + 4, cz + opening, iron);
  }
  if (lv === 2) {
    chamber(v, 5, -1, 4, 4);
    v.box(-3, 2, -4, 6, 5, 2, darkStone);
  }
  if (lv >= 3) {
    chamber(v, 0, 7, 4, 4);
    if (lv >= 4) {
      chamber(v, -8, 2, 5, 6);
      chamber(v, 8, 2, 5, 6);
    }
    if (lv === 5) {
      chamber(v, -7, -8, 5, 8);
      chamber(v, 7, -8, 5, 8);
      // A low daylight lantern, glazed between structural ribs, lights the counting room.
      ring(v, 0, -3, 16, 18, 4, 2, "warmGlow", 0.65);
      for (const [x, z] of [
        [0, -7],
        [4, -3],
        [0, 1],
        [-4, -3],
      ])
        v.box(x, 15, z, x + 1, 19, z + 1, iron);
      v.cone(0, 18, 21, -3, 5, 2, patina);
    }
  }
  const z = lv < 3 ? 4 : 11;
  v.box(cx - 3, 1, z - 2, cx + 3, 6, z + 1, darkStone);
  guardedDoor(c, cx, z);
}

const reserves = [buildGatewheel, buildIngots, buildCoinMint, buildRoundhouse] as const;

export function buildBank(c: Ctx): void {
  lot(c, "grass2");
  reserves[c.variant % 4](c);
}
