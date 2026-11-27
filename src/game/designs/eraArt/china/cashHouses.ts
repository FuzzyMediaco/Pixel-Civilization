import { type Ctx, type PixelVox } from "../../kit";
import { beam, loop, oval, slab } from "../../sculpturalKit";
import { streetLamp, clerk, courtPath, ink, lantern, stairs, tileRoof, timberBay } from "./civicParts";

function cashCoin(v: PixelVox, x: number, y: number, z: number, radius: number, depth = 2) {
  const hole = Math.max(1, Math.floor(radius * 0.4));
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const d = Math.hypot(dx, dy);
      if (d > radius + 0.18 || (Math.abs(dx) < hole + 1 && Math.abs(dy) < hole + 1)) continue;
      const lip = d > radius - 0.85 || Math.max(Math.abs(dx), Math.abs(dy)) === hole + 1;
      v.box(x + dx, y + dy, z, x + dx + 1, y + dy + 1, z + depth, lip ? "#c6a25e" : ink.bronze);
    }
}

function strongbox(v: PixelVox, x: number, z: number, w: number, d: number, y = 1) {
  v.box(x - w, y, z - d, x + w + 1, y + 3, z + d + 1, ink.sill);
  v.box(x - w - 1, y + 3, z - d - 1, x + w + 2, y + 4, z + d + 2, ink.post);
  for (const side of [-1, 1])
    v.box(
      x + side * Math.max(1, w - 1),
      y,
      z - d - 1,
      x + side * Math.max(1, w - 1) + 1,
      y + 4,
      z + d + 2,
      ink.bronze,
    );
  v.put(x, y + 2, z + d + 1, ink.lamp);
}

function coinMint(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = -Math.floor(hz * 0.24),
    radius = 3 + lv;
  // The whole entry is a cast cash coin. Its square perforation frames the counting room.
  const r = Math.min(radius, hx - 2);
  cashCoin(v, 0, r + 1, z + 3, r, 2 + Number(lv >= 3));
  strongbox(v, 0, z - 3, Math.min(5, hx - 3), 2);
  for (const s of [-1, 1]) v.box(s * (r - 1), 1, z - 3, s * (r - 1) + 2, r + 1, z + 4, ink.brick);
  courtPath(c, 0, z + 3);
  if (lv >= 2) {
    cashCoin(v, 0, r, z - 2, r - 1);
    lantern(v, r - 1, 4, z + 4);
  }
  if (lv >= 3) {
    strongbox(v, -hx + 5, hz - 5, 2, 2);
    clerk(v, r - 2, 1, z + 5);
  }
  if (lv >= 4) {
    timberBay(v, hx - 6, -hz + 5, 4, 3, 1, 4);
    strongbox(v, hx - 6, -hz + 5, 2, 1, 2);
  }
  if (lv === 5) {
    cashCoin(v, -hx + 6, hz > 12 ? 5 : 4, -hz + 6, 4);
    timberBay(v, -hx + 6, -hz + 6, 4, 3, 1, 4);
  }
}

function ingotVault(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = -Math.floor(hz * 0.27),
    r = Math.min(hx - 3, 4 + lv * 2),
    rows = 2 + lv;
  // Upturned ends and a belly taper the long boat-shaped sycee around a recessed upper court.
  for (let i = 0; i < rows; i++) {
    const rx = r * (0.57 + (0.43 * i) / (rows - 1)),
      rz = 2 + (lv + i) * 0.34;
    const plan = oval(0, z, rx, rz, 12);
    slab(v, plan, 1 + i, 1, i % 3 === 0 ? "#b69460" : ink.brick);
    if (i === rows - 1) {
      loop(v, plan, 2 + i, ink.bronze);
      slab(v, oval(0, z, rx * 0.58, rz * 0.54, 12), 2 + i, 1, ink.sill);
    }
  }
  for (const s of [-1, 1]) {
    beam(v, [s * (r - 2), rows, z], [s * r, rows + 3, z], ink.bronze, 2);
    if (lv >= 3) strongbox(v, s * Math.min(r - 2, 6), hz - 5, 2, 1);
  }
  cashCoin(v, 0, 3, z + Math.floor(rows * 0.4) + 2, 3);
  courtPath(c, 0, z + 3);
  if (lv >= 2) stairs(v, 0, z + 6, 2, 2, 3);
  if (lv >= 4) {
    timberBay(v, -hx + 6, -hz + 5, 4, 3, 1, 4);
    clerk(v, 2, 1, hz - 4);
  }
  if (lv === 5) {
    timberBay(v, hx - 6, -hz + 5, 4, 3, 1, 4);
    strongbox(v, 0, z, 2, 1, rows + 3);
  }
}

function tallyLanes(c: Ctx) {
  const { v, hx, hz, lv } = c,
    space = 3 + Number(lv >= 3),
    rear = -hz + 3,
    count = Math.min(4, lv + 1);
  // Staggered chests flank a secure tally aisle. Later high bridges interlock the two sides.
  for (const s of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const start = rear + 2 + (s === 1 ? 2 : 0);
      const z = start + Math.round(((hz - 3 - start) * i) / (count - 1));
      strongbox(v, s * (space + 1), z, 2, 1, 1);
      if (lv >= 3 && i % 2 === 0) strongbox(v, s * (space + 1), z, 1, 1, 5);
    }
  }
  cashCoin(v, 0, 4, Math.min(hz - 3, 2), 3, 1);
  courtPath(c, 0, rear);
  if (lv >= 2) lantern(v, -space, 4, hz - 5);
  if (lv >= 3) {
    v.box(-space - 1, 6, rear, space + 2, 7, rear + 3, ink.post);
    clerk(v, 0, 1, -2);
  }
  if (lv >= 4) {
    tileRoof(v, 0, rear + 1, space + 3, 3, 7, 3);
    timberBay(v, hx - 6, hz - 5, 4, 3, 1, 4);
  }
  if (lv === 5) {
    timberBay(v, -hx + 6, hz - 5, 4, 3, 1, 5);
    strongbox(v, 0, -hz + 5, 2, 1, 7);
  }
}

function sealCourtyard(c: Ctx) {
  const { v, hx, hz, lv } = c,
    z = -Math.floor(hz * 0.21),
    r = Math.min(hx - 2, hz - 2, 4 + lv * 2);
  const sides = 8,
    depth = Math.max(4, r * 0.78);
  // Three-quarter octagonal stepped walls protect an open cash court and a low guarded gateway.
  for (let k = 0; k < 3 + Number(lv >= 4); k++) {
    const plan = oval(0, z, r - k * 0.55, depth - k * 0.45, sides, Math.PI / 8);
    for (let j = 0; j < plan.length; j++) {
      const [x1, z1] = plan[j],
        [x2, z2] = plan[(j + 1) % sides];
      if ((z1 + z2) / 2 > z + depth * 0.75) continue;
      beam(v, [x1, 1 + k, z1], [x2, 1 + k, z2], k === 2 ? ink.stone : ink.brick, 2);
    }
  }
  strongbox(v, 0, z, 2 + Number(lv >= 3), 1);
  cashCoin(v, 0, 3, z + Math.floor(depth), 3, 1);
  courtPath(c, 0, z + Math.floor(depth));
  if (lv >= 2) {
    strongbox(v, -Math.floor(r * 0.47), z - 1, 1, 1);
    lantern(v, 3, 4, z + Math.floor(depth));
  }
  if (lv >= 3) {
    timberBay(v, 0, z - Math.floor(depth * 0.65), 4, 3, 1, 5);
    clerk(v, 1, 1, z + 3);
  }
  if (lv >= 4) {
    strongbox(v, Math.floor(r * 0.48), z - 1, 2, 1);
    tileRoof(v, 0, z - Math.floor(depth * 0.65), 5, 4, 8, 3);
  }
  if (lv === 5) {
    timberBay(v, -hx + 6, hz - 5, 4, 3, 1, 4);
    timberBay(v, hx - 6, hz - 5, 4, 3, 1, 4);
  }
}

export function buildCashHouse(c: Ctx) {
  [coinMint, ingotVault, tallyLanes, sealCourtyard][c.variant](c);
  const [x, z] = [
    [c.hx - 2, c.hz - 3],
    [-c.hx + 4, c.hz - 3],
    [1, c.hz - 2],
    [c.hx - 3, c.hz - 3],
  ][c.variant];
  streetLamp(c.v, x, z, 4 + Number(c.lv >= 3));
}
