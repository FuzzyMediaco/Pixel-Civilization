import { type Ctx, type PixelVox, bench, column, lamp, person, stairs } from "./kit";
import { bulbs, disc, glassFront, palm } from "./commerceKit";

const iron = "#37676b", glass = "#b8ded8", brass = "#cba261", ivory = "#fff1cb";
const fabrics = ["#db694f", "#e7ad5b", "#489388", "#aa729d", "#6c8cbd"];
const shops = ["#7d5a45", "#3b7878", "#a7604e", "#616c88"];

/** A barrel of glazed panels and steel ribs. Shop walls stop below the roof spring. */
function vault(v: PixelVox, cx: number, cz: number, halfWidth: number, halfLength: number, base: number, cross = false) {
  for (let i = -halfWidth; i < halfWidth; i++) {
    const n = Math.abs((i + .5) / halfWidth);
    const roof = base + Math.round(halfWidth * .82 * Math.sqrt(1 - n * n));
    const edgeN = Math.min(1, n + 1 / halfWidth);
    const low = base + Math.round(halfWidth * .82 * Math.sqrt(1 - edgeN * edgeN));
    for (let j = -halfLength; j < halfLength; j++) {
      const rib = j === halfLength - 1 || (j + halfLength) % 5 === 0;
      const x = cx + (cross ? j : i), z = cz + (cross ? i : j);
      if (rib || (j + halfLength) % 5 !== 3 || n > .75) {
        v.box(x, low, z, x + 1, roof + 1, z + 1, rib ? iron : glass, rib ? 0 : .2);
      }
      if (rib && n > 1 - 1.1 / halfWidth) v.box(x, 1, z, x + 1, base + 1, z + 1, iron);
    }
  }
}

function stall(v: PixelVox, x: number, y: number, z: number, width: number, deep: number, color: string, fascia: string) {
  v.hollowBox(x, y, z, x + width, y + 5, z + deep, color);
  glassFront(v, x + 1, x + width - 1, y + 1, y + 4, z + deep - 1, color, 3, "#ffda97");
  v.clear(x + 1, y, z + deep - 1, x + 3, y + 3, z + deep);
  v.box(x - 1, y + 4, z - 1, x + width + 1, y + 5, z + deep + 1, fascia);
}

function glassGalleria(c: Ctx) {
  const { v, hx, hz, lv } = c;
  if (lv === 1) {
    // The first shop walk is an open street between two freestanding cast-iron arches.
    v.box(-7, 0, -10, 7, 1, 11, "#c79877");
    const archY = (distance: number) => 4 + Math.round(6 * Math.sqrt(Math.max(0, 1 - (distance / 11) ** 2)));
    for (const z of [-8, 6]) {
      for (const side of [-1, 1]) {
        const x = side < 0 ? -12 : 6;
        stall(v, x, 1, z - 3, 6, 6, "#d6b48b", side < 0 ? shops[1] : shops[2]);
        v.box(x, 5, z - 3, x + 6, 6, z + 2, glass, .2);
      }
      for (let x = -11; x <= 11; x++) {
        const top = archY(Math.abs(x)), lower = archY(Math.abs(x) + 1);
        v.box(x, lower, z, x + 1, top + 1, z + 2, iron);
        v.put(x, top + 1, z, Math.abs(x) < 2 ? brass : glass, Math.abs(x) < 2 ? 0 : .18);
      }
    }
    for (const x of [-10, 10]) v.box(x, 7, -8, x + 1, 8, 8, iron);
    return;
  }
  const w = 3 + lv, long = Math.min(hz - 5, 6 + 3 * lv), cz = -Math.floor(hz * .12);
  const sill = 5 + lv, side = Math.min(hx - w - 2, 4 + 2 * lv);
  v.box(-w - side, 0, cz - long, w + side, 1, cz + long + 2, "#c79877");
  for (const s of [-1, 1]) {
    const x = s < 0 ? -w - side : w;
    for (let z = cz - long + 1, i = 0; z < cz + long - 1; z += 7, i++) {
      const d = Math.min(6, cz + long - z);
      stall(v, x, 1, z, side, d, "#d6b48b", shops[i % 4]);
      for (let j = 0; j < d - 1; j++) v.put(s < 0 ? -w - 1 : w, 4, z + j, "#fbe4b7", .4);
    }
  }
  vault(v, 0, cz, w, long + 1, sill);
  if (lv >= 2) {
    // An anchor pavilion enters from the side street through its own shorter transverse vault.
    const mid = cz - Math.floor(long * .4);
    vault(v, -w - Math.floor(side / 2), mid, 3, side + 1, 6, true);
    v.box(-w - side - 3, 0, mid - 2, -w, 1, mid + 2, ivory);
  }
  if (lv >= 3) {
    vault(v, w + Math.floor(side / 2), cz + 2, 4, side + 1, 7, true);
    disc(v, 0, cz + long + 5, 1, 2, 3, brass);
    disc(v, 0, cz + long + 5, 2, 3, 2, "#75bfbf");
    person(v, 4, 1, cz + long + 5, fabrics[0]);
  }
  if (lv >= 4) {
    for (const x of [-hx + 6, hx - 6]) {
      stall(v, x - 4, 1, cz - long + 3, 8, 8, iron, brass);
      vault(v, x, cz - long + 7, 5, 6, 5);
    }
  }
  if (lv === 5) {
    // The lantern at the intersection is hollow; the last storey is a raised band of windows.
    const r = w + 3, y = sill + w - 1;
    for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) {
      const d = Math.hypot(x + .5, z + .5);
      if (d > r) continue;
      const cap = Math.round(Math.sqrt(r * r - d * d) * .65);
      if (d > r - 1.1) v.box(x, y, cz + z, x + 1, y + 4, cz + z + 1, Math.abs(x + z) % 4 ? glass : brass);
      const rib = Math.abs(Math.sin(Math.atan2(z + .5, x + .5) * 5)) < .19;
      const outer = Math.min(r, d + 1);
      const underside = Math.round(Math.sqrt(r * r - outer * outer) * .65);
      v.box(x, y + 4 + underside, cz + z, x + 1, y + 5 + cap, cz + z + 1, rib || d > r - 1 ? iron : "#a6d9d4", rib ? 0 : .22);
    }
    v.put(0, y + 5 + Math.round(r * .65), cz, brass);
  }
}

function atriumTerraces(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const r = Math.min(hx - 3, hz - 3, 7 + 3 * lv), inner = Math.round(r * .49);
  const cz = -2, turns = [.72, .98, 1.35, 1.68, 2.05][lv - 1], pitch = 8;
  // Orient the lower opening to the front, so the first stretch of the walk is at street level.
  for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) {
    const d = Math.hypot(x + .5, z + .5);
    if (d < inner || d > r) continue;
    const a = (Math.atan2(x + .5, z + .5) + Math.PI * 2) % (Math.PI * 2);
    for (let t = a / (Math.PI * 2); t < turns; t++) {
      const y = 1 + Math.floor(t * pitch), slice = Math.floor(t * 16);
      v.box(x, y, cz + z, x + 1, y + 2, cz + z + 1, d < inner + 1.3 ? brass : "#dcae84");
      if (d > r - 1.2) {
        const pillar = Math.abs(Math.sin(a * 8)) < .22;
        const shopLight = slice % 3 === 1 ? .48 : .15;
        v.box(x, y + 2, cz + z, x + 1, y + 6, cz + z + 1, pillar ? iron : "#9bbdaf", pillar ? 0 : shopLight);
        v.put(x, y + 6, cz + z, shops[slice % 4]);
        if (pillar && t < 1) v.box(x, 1, cz + z, x + 1, y, cz + z + 1, iron);
      }
      // Traders hang individual canopies over their shop windows. Gaps reveal the rising walk.
      const bay = (t * 16) % 1;
      if (d > r - 3.4 && d <= r - 1 && bay > .12 && bay < .85) {
        v.put(x, y + 4 + Math.round((d - r + 3.4) / 2), cz + z, bay > .58 ? ivory : fabrics[slice % fabrics.length]);
      }
      if (d < inner + 1 && Math.cos(a * 9) > .35) v.put(x, y + 2, cz + z, ivory);
    }
  }
  disc(v, 0, cz, 0, 1, inner, "#9fa67c");
  if (lv >= 2) {
    disc(v, 0, cz, 1, 2, Math.max(2, inner - 3), "#699e9b");
    palm(v, -2, cz, 1, 6 + lv);
  }
  if (lv >= 3) {
    v.box(-inner - 1, 10, cz - 2, inner + 1, 11, cz + 1, iron);
    for (const z of [cz - 2, cz]) v.box(-inner, 11, z, inner, 12, z + 1, brass);
    person(v, 2, 11, cz - 1, fabrics[0]);
    // The glass elevator has an exposed cabin opposite the shopping bridge.
    const shaft = -inner + 1, liftTop = lv === 5 ? 19 : 12;
    for (const xx of [shaft - 1, shaft + 1]) for (const zz of [cz - 3, cz - 1]) {
      v.box(xx, 1, zz, xx + 1, liftTop + 1, zz + 1, brass);
    }
    v.box(shaft - 2, liftTop, cz - 4, shaft + 3, liftTop + 1, cz + 1, iron);
    v.hollowBox(shaft - 1, liftTop - 6, cz - 2, shaft + 2, liftTop - 3, cz, "#a5d7d0");
  }
  if (lv >= 4) {
    const ex = hx - 7, rear = cz - r + 3;
    stall(v, ex - 4, 1, rear, 8, 7, "#855a50", brass);
    v.box(ex - 5, 6, rear - 1, ex + 5, 9, rear + 5, fabrics[3]);
    for (let i = -4; i < 5; i += 2) v.put(ex + i, 7, rear + 5, ivory, .7);
  }
  if (lv === 5) {
    // Suspended café overhang terminates the uppermost level, its open pergola framing the tree.
    const x = Math.round(r * .55), z = cz + Math.round(r * .7), y = 18;
    disc(v, x, z, y, y + 1, 6, iron);
    for (const dx of [-4, 3]) for (const dz of [-3, 3]) column(v, x + dx, z + dz, y + 1, y + 6, brass);
    for (let dx = -5; dx <= 4; dx += 2) v.box(x + dx, y + 6, z - 4, x + dx + 1, y + 7, z + 5, ivory);
    bench(v, x, y + 1, z, "x", "#815c49");
  }
}

function soukSteps(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const rows = Math.min(4, lv + 1), rowD = Math.min(10, Math.floor((2 * hz - 7) / rows));
  const w = Math.min(hx - 4, 8 + 3 * lv), front = Math.floor(rows * rowD / 2);
  const bays = lv >= 3 ? 2 : 1, lane = 4;
  // Small shops sit on both sides of an uninterrupted public stair up the hillside.
  for (let row = 0; row < rows; row++) {
    const z = front - (row + 1) * rowD, floor = 1 + row * 4, width = Math.floor((w - lane) / bays);
    stairs(v, -lane, lane, 1, z, floor - 1, "#c39365");
    v.box(-lane, floor - 1, z, lane, floor, z + 2, ivory);
    for (const s of [-1, 1]) for (let j = 0; j < bays; j++) {
      const x = s < 0 ? -w + width * j : lane + width * j;
      const end = x + width, shade = fabrics[(row * 2 + j + (s > 0 ? 1 : 0)) % fabrics.length];
      v.hollowBox(x, 0, z, end, floor + 1, z + rowD, "#b58059");
      v.hollowBox(x + 1, floor, z, end - 1, floor + 6, z + 4, "#d6a76f");
      v.clear(x + 2, floor + 1, z + 3, end - 2, floor + 5, z + 4);
      for (let xx = x + 1; xx < end; xx++) {
        const local = (xx - x) / width;
        for (let zz = 0; zz < rowD - 2; zz++) {
          const h = floor + 6 - Math.round(1.8 * Math.sin(local * Math.PI)) - Math.floor(zz / 4);
          v.put(xx, h, z + 2 + zz, (xx - x) % 4 === 1 ? ivory : shade);
        }
      }
      for (const xx of [x + 1, end - 1]) column(v, xx, z + rowD - 2, floor + 1, floor + 6, "#765338");
      const hook = x + 2;
      v.put(hook, floor + 5, z + rowD - 2, brass);
      v.put(hook, floor + 4, z + rowD - 2, "#ffd28a", .95);
      for (let xx = x + 2; xx < end - 1; xx += 3) {
        v.box(xx, floor + 1, z + rowD - 3, xx + 2, floor + 2, z + rowD - 1, "#966332");
        v.put(xx, floor + 2, z + rowD - 2, fabrics[(row + j + 1) % 5]);
      }
    }
  }
  if (lv >= 2) {
    for (const x of [-w + 2, w - 3]) lamp(v, x, 1, front + 1, 6, "#7b553f", ivory);
    person(v, 1, 2, front - rowD - 2, iron);
  }
  if (lv >= 3) {
    const y = 2 + (rows - 1) * 4, z = front - (rows - 1) * rowD;
    v.box(-lane - 2, y + 3, z - 2, lane + 2, y + 4, z + 1, "#825d42");
    for (const edge of [z - 2, z]) v.box(-lane - 2, y + 4, edge, lane + 2, y + 5, edge + 1, ivory);
  }
  if (lv >= 4) {
    const back = front - rows * rowD, y = (rows - 1) * 4 + 8;
    for (const x of [-w + 3, w - 4]) {
      disc(v, x, back + 4, y, y + 4, 3, "#b38859");
      v.dome(x, y + 4, back + 4, 3, "#6a9b89");
    }
  }
  if (lv === 5) {
    // A lantern crane marks the night market from the low end of the avenue.
    const x = w - 5, z = front - rows * rowD + 4, y = 18;
    for (const dx of [-2, 2]) for (const dz of [-2, 2]) column(v, x + dx, z + dz, y, y + 13, iron, brass);
    v.box(x - 3, y + 11, z - 3, x + 4, y + 12, z + 4, brass);
    disc(v, x, z, y + 12, y + 17, 2, () => [ivory, .75]);
    v.roofPyramid(x - 4, y + 17, z - 4, x + 4, z + 4, "#5e8c7e");
    bulbs(v, x, z, -w + 3, front, y + 5, [ivory, fabrics[0], fabrics[1]]);
  }
}

function linerEmporium(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = lv === 1 ? 5 : Math.min(hx - 5, 5 + lv * 2);
  const d = lv === 1 ? hz - 1 : Math.min(hz - 3, 8 + lv * 4);
  const base = 5 + lv, center = -1;
  // A real pointed bow at +z and rounded stern at -z. Wide doors open to the sidewalk under the promenade decks.
  const beamAt = (z: number) => {
    const t = (z + d) / (2 * d);
    return Math.max(1, Math.round(w * Math.min(1, .35 + t * 4.3, (1 - t) * 3.4)));
  };
  for (let z = -d; z < d; z++) {
    const half = beamAt(z);
    const sideDoor = Math.abs(z + Math.floor(d * .2)) <= 2;
    for (let y = 1; y <= base; y++) {
      const beam = Math.max(1, half - Math.floor((base - y) / 3));
      for (const x of [-beam, beam - 1]) {
        if (sideDoor && y < 5) continue;
        let color = y === 1 ? "#b45549" : y === base ? ivory : "#314b58";
        if (y === base - 2 && z % 4 === 0) color = "#efca87";
        v.put(x, y, center + z, color, color === "#efca87" ? .6 : 0);
      }
      if (y === base || z === -d || z === d - 1) v.box(-beam, y, center + z, beam, y + 1, center + z + 1, y === base ? "#c18d62" : "#314b58");
    }
  }
  if (lv === 1) {
    // An open promenade follows both gunwales all the way to the street-corner prow.
    for (let z = -d + 1; z < d; z++) {
      const beam = beamAt(z);
      for (const x of [-beam, beam - 1]) {
        if ((z + d) % 4 === 0) v.put(x, base + 1, center + z, brass);
        v.put(x, base + 2, center + z, ivory);
      }
    }
  }
  const sw = Math.max(3, w - 3), superstructure = lv >= 3 ? 2 : 1;
  for (let floor = 0; floor < superstructure; floor++) {
    const y = base + 1 + floor * 4, width = sw - floor * 2, back = center - d + 4 + floor * 2, front = Math.floor(d * .48) - floor * 3;
    v.hollowBox(-width, y, back, width, y + 4, front, ivory);
    for (let z = back + 1; z < front - 1; z += 3) for (const x of [-width, width - 1]) v.box(x, y + 1, z, x + 1, y + 3, z + 2, glass, .2);
    glassFront(v, -width, width, y + 1, y + 3, front - 1, iron, 4, glass);
    v.box(-width - 1, y + 3, back - 1, width + 1, y + 4, front + 1, ivory);
  }
  const top = base + 1 + superstructure * 4;
  const funnels = lv >= 3 ? 2 : 1;
  for (let i = 0; i < funnels; i++) {
    const z = center - i * 8, r = lv >= 4 ? 3.4 : 2.4;
    disc(v, 0, z, top - 1, top + 5, r, "#cf6e50");
    disc(v, 1, z, top + 5, top + 7, r, "#344950", 1);
  }
  if (lv >= 2) {
    const z = center - Math.floor(d * .2);
    for (let n = 0; n < 5; n++) {
      const x = w + n;
      v.box(x, 0, z - 2, x + 1, 5 - n, z + 2, ashDeck);
      v.put(x, 5 - n, z + 1, ivory);
    }
    person(v, w + 5, 1, z - 1, fabrics[3]);
  }
  if (lv >= 4) {
    const z = center - d + 4;
    v.box(-sw, top - 4, z, sw, top, z + 5, "#6a9796");
    vault(v, 0, z + 3, Math.min(sw, 6), 4, top - 1);
    // A shore-side passenger terminal links a shopping street to the promenade's upper deck.
    const shore = -hx + 5, linkZ = -4, dockWidth = Math.min(9, hx - w - 4);
    stall(v, shore, 1, linkZ - 4, dockWidth, 9, "#af7057", iron);
    v.hollowBox(shore + 1, 6, linkZ - 2, shore + dockWidth - 1, base + 3, linkZ + 3, glass, iron);
    v.box(shore, base + 3, linkZ - 3, shore + dockWidth, base + 4, linkZ + 4, ivory);
    for (const zz of [linkZ - 2, linkZ + 1]) {
      v.box(shore + dockWidth - 1, base, zz, -w + 2, base + 3, zz + 1, glass);
      for (let xx = shore + dockWidth; xx < -w; xx += 3) v.put(xx, base + 2, zz, iron);
    }
    v.box(shore + dockWidth - 1, base - 1, linkZ - 2, -w + 2, base, linkZ + 2, iron);
  }
  if (lv === 5) {
    const mz = center + Math.floor(d * .65);
    v.box(-1, base + 1, mz, 1, top + 11, mz + 2, "#b28757");
    v.box(-4, top + 5, mz, 4, top + 6, mz + 1, ivory);
    for (let i = 0; i < 17; i++) {
      const t = i / 16;
      const z = Math.round(mz + (center - d + 4 - mz) * t);
      const y = Math.round(top + 9 - 5 * t - 5 * Math.sin(Math.PI * t));
      v.put(0, y, z, i % 2 ? brass : ivory, i % 2 ? 0 : .6);
    }
  }
}
const ashDeck = "#b08358";

export function buildMalls(c: Ctx) {
  const { v, hx, hz } = c;
  v.box(-hx + 2, 0, -hz + 2, hx - 2, 1, hz - 2, "#b9bd9e");
  v.box(-3, 0, 0, 3, 1, hz, ivory);
  [glassGalleria, atriumTerraces, soukSteps, linerEmporium][c.variant % 4](c);
}
