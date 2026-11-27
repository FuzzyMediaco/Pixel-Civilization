// Original data centers make the service aisles, hot/cold aisle, chiller plenum and fiber routes visible.
import { byLv, lot, person, type Ctx, type PixelVox } from "./kit";
import { disc, spinner } from "./commerceKit";

const NAVY = "#263648",
  IRON = "#4d5a69",
  SILVER = "#a6bac6",
  MINT = "#63e8c5",
  BLUE = "#52bce8",
  COPPER = "#d99b62";

function rack(v: PixelVox, x: number, z: number, w: number, d: number, bottom: number, h: number) {
  // Shallow rack trays leave both the end cheeks and front handles exposed.
  v.box(x, bottom, z, x + w, bottom + 1, z + d, IRON);
  v.box(x + 1, bottom + 1, z, x + w - 1, bottom + h - 1, z + 1, NAVY);
  for (const a of [x, x + w - 2]) {
    v.box(a, bottom, z, a + 2, bottom + h, z + 2, IRON);
    v.box(a, bottom, z + d - 2, a + 2, bottom + h, z + d, SILVER);
    v.box(a, bottom + h - 1, z, a + 2, bottom + h, z + d, IRON);
  }
  for (let y = bottom + 2; y < bottom + h - 1; y += 3) {
    v.box(x + 1, y, z + 1, x + w - 1, y + 1, z + d - 1, "#354757");
    v.box(x + 1, y, z + d - 1, x + w - 1, y + 1, z + d, "#647c89");
    v.box(x + w - 4, y, z + d - 1, x + w - 2, y + 1, z + d, MINT, 0.7);
    v.put(x + 2, y, z + d - 1, "#f5a856", 0.7);
  }
  v.box(x - 1, bottom + h, z - 1, x + w + 1, bottom + h + 1, z + d + 1, NAVY);
  for (let a = x + 1; a < x + w - 1; a += 3) v.box(a, bottom + h, z, a + 1, bottom + h + 1, z + d - 1, IRON);
}

// Staff entrance and illuminated pass reader fit under the giant service equipment.
function accessCabin(v: PixelVox, x: number, z: number, w: number, trim: string) {
  v.hollowBox(x, 1, z, x + w, 6, z + 5, IRON);
  v.box(x + 1, 2, z + 4, x + w - 3, 5, z + 5, "#6c9daa", 0.18);
  v.box(x + w - 3, 1, z + 4, x + w - 1, 5, z + 5, NAVY);
  v.put(x + w - 2, 3, z + 4, trim, 0.65);
  v.box(x - 1, 6, z - 1, x + w + 1, 7, z + 6, NAVY);
  v.box(x - 1, 6, z + 5, x + w + 1, 7, z + 6, trim);
}

function ladder(v: PixelVox, x: number, z: number, h: number) {
  for (const a of [x, x + 3]) v.box(a, 1, z, a + 1, h, z + 1, COPPER);
  for (let y = 3; y < h; y += 3) v.box(x, y, z, x + 4, y + 1, z + 1, COPPER);
}
function rackStreet(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -hx + 4,
    z = -hz + 5;
  const w = byLv(c, [11, 12, 13, 14, 16]),
    h = byLv(c, [11, 17, 20, 23, 30]),
    d = byLv(c, [7, 8, 8, 10, 11]);
  rack(v, x, z, w, d, 1, h);
  c.blink(x + w - 3, 3, z + d - 1, MINT);
  // Service cables return overhead to the aisle, with individual hanging drops.
  const end = lv === 1 ? x + w + 4 : hx - 5;
  v.box(x, 2, z - 2, end, 3, z - 1, COPPER);
  if (lv >= 2) {
    rack(v, hx - w - 3, z + 5, w - 2, d, 1, h - 4);
    v.box(x + w - 2, h - 4, z + 4, end - 2, h - 3, z + 6, "#57799a");
    for (let a = x + w; a < end; a += 4) v.box(a, h - 4, z + 5, a + 1, h - 1, z + 6, COPPER);
  }
  if (lv >= 3) {
    rack(v, -3, 2, 10, 7, 1, 11);
    ladder(v, x + 1, z + d + 1, h);
    v.box(x + 1, 6, z + d + 1, x + w - 1, 7, z + d + 3, "#9e704e");
  }
  if (lv >= 4) {
    const on = lv === 5 ? 18 : 14;
    for (const a of [x + 2, 2]) v.box(a, 1, hz - 12, a + 2, on, hz - 10, IRON);
    rack(v, x + 1, hz - 15, 13, 6, on, 9);
    v.box(x + 3, on, hz - 11, 4, on + 1, hz - 8, "#9d7958");
    for (let a = x + 3; a < 4; a += 4) v.box(a, on + 1, hz - 9, a + 1, on + 4, hz - 8, SILVER);
  }
  if (lv === 5) {
    rack(v, hx - 16, hz - 18, 11, 9, 1, 38);
    rack(v, 1, -hz + 2, 11, 8, 1, 22);
    v.box(3, 21, -hz + 7, hx - 11, 22, -hz + 4, IRON);
    v.box(hx - 13, 20, -hz + 6, hx - 10, 22, hz - 11, COPPER);
    for (let a = -hz + 8; a < hz - 11; a += 4) v.box(hx - 11, 22, a, hx - 10, 24, a + 1, SILVER);
    ladder(v, hx - 14, hz - 8, 36);
  }
  const lobbyX = -hx + 4,
    lobbyZ = hz - 8;
  accessCabin(v, lobbyX, lobbyZ, Math.min(w, 10), COPPER);
  v.box(lobbyX + 1, 0, z + d + 1, lobbyX + 5, 1, lobbyZ, "#697d86");
  v.box(lobbyX + 1, 0, hz - 3, hx - 1, 1, hz - 1, "#73838b");
  for (let a = lobbyX + 1; a < hx - 2; a += 4) v.put(a, 0, hz - 3, "#d5c08f");
  person(v, lobbyX + w + 2, 1, hz - 4, "#dc9852");
}

function trace(v: PixelVox, x0: number, z0: number, x1: number, z1: number, col: string) {
  v.box(Math.min(x0, x1), 0, z0, Math.max(x0, x1) + 1, 1, z0 + 1, col);
  v.box(x1, 0, Math.min(z0, z1), x1 + 1, 1, Math.max(z0, z1) + 1, col);
  v.cylinderY(x1 + 0.5, z1 + 0.5, 0, 1, 1.5, COPPER);
  v.put(x1, 0, z1, MINT, 0.45);
}
function bladeBank(v: PixelVox, inner: number, z: number, length: number, height: number, side: number) {
  const outer = inner + side * 4;
  const left = Math.min(inner, outer),
    right = Math.max(inner, outer) + 1;
  v.box(left, 1, z, right, 2, z + length, IRON);
  v.box(left, 2, z, right, height, z + 1, NAVY);
  for (let a = z; a < z + length; a += 3) {
    const end = Math.min(a + 3, z + length);
    v.box(left, 2, a, right, height, end - 1, "#40515c");
    for (let y = 3; y < height - 1; y += 2) {
      v.box(outer, y, a, outer + 1, y + 1, end, "#89979b");
      v.box(inner, y, a, inner + 1, y + 1, end, "#7895a1");
      v.put(inner, y, end - 1, side < 0 ? MINT : "#f1ac72", 0.65);
    }
  }
  v.box(left - 1, height, z - 1, right + 1, height + 1, z + length + 1, "#cfdbd7");
  for (let a = z + 1; a < z + length - 1; a += 3) v.box(left, height, a, right, height + 1, a + 1, IRON);
}

// A rectangular return-air duct has a real mouth with louvers. Collars follow the duct back to the plant.
function returnDuct(v: PixelVox, x: number, z0: number, z1: number, y: number, width: number) {
  const left = x - Math.floor(width / 2),
    right = left + width;
  v.hollowBox(left, y, z0, right, y + 5, z1, "#a4b5b6");
  v.clear(left + 1, y + 1, z1 - 2, right - 1, y + 4, z1);
  v.box(left + 1, y + 1, z1 - 3, right - 1, y + 4, z1 - 2, NAVY);
  for (let xx = left + 2; xx < right - 1; xx += 2) v.box(xx, y + 1, z1 - 1, xx + 1, y + 4, z1, IRON);
  for (let a = z0 + 1; a < z1; a += 6) {
    v.box(left - 1, y, a, left, y + 5, a + 1, IRON);
    v.box(right, y, a, right + 1, y + 5, a + 1, IRON);
    v.box(left - 1, y + 5, a, right + 1, y + 6, a + 1, IRON);
  }
}

function coldAisle(c: Ctx) {
  const { v, lv, hx, hz } = c,
    gap = byLv(c, [3, 4, 5, 6, 7]);
  const count = byLv(c, [1, 2, 2, 3, 4]),
    length = byLv(c, [8, 6, 8, 8, 9]);
  const rear = -Math.floor((count * (length + 2)) / 2);
  const front = rear + count * (length + 2);
  // Staff enter between cold-blue floor grilles. Hot air leaves on the outside of the opposing rows.
  v.box(-gap, 0, rear - 2, gap + 1, 1, hz - 1, "#758683");
  for (let z = rear - 1; z < hz - 1; z += 3) {
    v.box(-gap + 1, 0, z, gap, 1, z + 1, "#b1c1be");
    v.put(-gap + 1, 0, z, BLUE, 0.45);
    v.put(gap - 1, 0, z, BLUE, 0.45);
  }
  const high = byLv(c, [6, 8, 11, 13, 15]);
  for (let i = 0; i < count; i++) {
    const z = rear + i * (length + 2);
    bladeBank(v, -gap - 1, z, length, high + (i % 2) * 2, -1);
    bladeBank(v, gap + 1, z + (i % 2), length - 1, high - 2 + (i % 2) * 2, 1);
  }
  const inletX = -gap - 3,
    mastX = gap + 4,
    hoodY = high + 3;
  v.box(inletX - 1, 1, rear - 3, inletX + 2, hoodY + 2, rear, "#be775b");
  if (lv === 1) {
    // A short inlet feeds one paired rack without covering its walk-through aisle.
    returnDuct(v, inletX, rear - 3, rear + 3, high + 1, 4);
  } else {
    v.box(inletX, hoodY, rear - 3, mastX + 2, hoodY + 3, rear, "#91a7ac");
    v.box(mastX, 1, rear - 3, mastX + 2, hoodY + 1, rear, IRON);
    returnDuct(v, inletX, rear - 4, front - 2, hoodY, 5);
  }
  if (lv >= 3) {
    // Outside the aisle, the alternating hot-return pipes descend to a working fan door.
    const end = lv === 3 ? hx - 4 : hx - 6;
    v.box(mastX, hoodY, rear - 3, end, hoodY + 3, rear, "#b6775d");
    v.box(end - 2, 3, rear - 3, end + 1, hoodY + 3, rear, "#b6775d");
    v.box(end - 3, 1, rear - 3, end + 2, 6, rear + 2, IRON);
    v.ringZ(end - 1, 4, rear + 1, rear + 2, 2, 1, SILVER);
  }
  if (lv >= 4) {
    const z = front - length,
      deck = high + 1;
    for (const x of [-gap - 5, gap + 4]) v.box(x, 1, z - 1, x + 2, deck, z + 2, IRON);
    v.box(-gap - 5, deck, z - 1, gap + 6, deck + 1, z + 2, "#aeb9b5");
    for (let x = -gap - 5; x <= gap + 5; x += 4) v.box(x, deck + 1, z + 1, x + 1, deck + 4, z + 2, COPPER);
    v.box(-gap - 5, deck + 3, z + 1, gap + 6, deck + 4, z + 2, COPPER);
    ladder(v, gap + 5, z + 3, deck + 1);
    person(v, 0, deck + 1, z, "#f2a762");
  }
  if (lv === 5) {
    // The second return terminates high over the rear bays, leaving the central street open to the sky.
    const top = hoodY + 8;
    v.box(mastX - 1, hoodY, rear - 3, mastX + 2, top + 3, rear, IRON);
    returnDuct(v, mastX, rear - 4, 1, top, 7);
    v.box(mastX - 2, high, 0, mastX + 2, top + 1, 2, "#b07a64");
    for (let y = high + 1; y < top; y += 4) v.box(mastX - 3, y, -1, mastX + 3, y + 1, 3, IRON);
    accessCabin(v, -hx + 4, front - 2, 10, COPPER);
  }
  person(v, 1, 1, Math.min(front + 2, hz - 3), "#578b8a");
  c.blink(-gap - 1, 3, rear + 2, MINT);
}

function fan(c: Ctx, x: number, z: number, r: number, h: number) {
  const { v } = c;
  for (let y = 1; y < h; y++) {
    const t = (y - 1) / (h - 1),
      rad = r * (0.76 + 0.24 * Math.pow((t - 0.4) / 0.6, 2));
    disc(
      v,
      x,
      z,
      y,
      y + 1,
      rad,
      (a, _y, b, _d, ang) => {
        const ribs = Math.floor(((ang + Math.PI) * 12) / Math.PI) % 3 === 0;
        if (y < h - 2 && y > 2 && (a + b + y) % 19 === 0) return "#688692";
        return y === h - 1 ? NAVY : ribs ? "#91aab2" : "#b3c8c9";
      },
      rad - 1.4,
    );
  }
  disc(v, x, z, h - 1, h, r + 0.7, NAVY, r - 1.3);
  disc(
    v,
    x,
    z,
    h,
    h + 1,
    r,
    (_a, _y, _b, _d, angle) => (Math.cos(4 * angle) > 0.88 ? ["#9bf0df", 0.45] : "#68c8ce"),
    r - 1.2,
  );
  // Recess the moving fan within its static duct.
  const rotor = spinner(c, x, h - 2, z, "y", 1.3);
  for (let arm = 0; arm < 5; arm++) {
    const a = (arm * Math.PI * 2) / 5;
    for (let i = 1; i < r - 1; i++) {
      const sweep = a + i * 0.05,
        dx = Math.round(Math.cos(sweep) * i),
        dz = Math.round(Math.sin(sweep) * i);
      rotor.box(dx - 1, 0, dz, dx + 1, 1, dz + 2, "#637d8b");
    }
  }
  v.cylinderY(x, z, h - 2, h, 1.8, "#dd9a68");
}
function coolant(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = byLv(c, [6, 8, 10, 10, 12]),
    h = byLv(c, [8, 13, 17, 22, 30]),
    x = lv === 1 ? 0 : -Math.floor(hx * 0.42),
    z = lv >= 4 ? -6 : -2;
  fan(c, x, z, r, h);
  const pipeX = x + r - 1;
  v.box(pipeX, 2, z + 1, pipeX + 3, 4, hz - 5, "#389c9d");
  v.box(pipeX, 2, hz - 7, hx - 4, 4, hz - 5, "#389c9d");
  if (lv >= 2) {
    const px = hx - 7,
      pz = lv === 2 ? -6 : z + 1;
    v.box(px - 4, 1, pz - 3, px + 5, 3, pz + 4, IRON);
    for (let a = -3; a <= 3; a += 2) v.box(px + a, 3, pz - 3, px + a + 1, 10 + lv, pz + 4, SILVER);
    v.box(px - 4, 5, pz + 4, px + 5, 7, pz + 5, "#4aabad");
    v.box(px + 3, 2, pz + 4, px + 5, 6, hz - 6, "#389c9d");
  }
  if (lv >= 3) fan(c, hx - 8, 6, 6, 9);
  if (lv >= 4) {
    fan(c, -hx + 8, hz - 8, 6, 12);
    disc(v, 1, hz - 8, 1, 2, 6, IRON);
    disc(v, 1, hz - 8, 2, 3, 5.3, "#549ca1");
    for (let a = -3; a <= 4; a += 3) v.box(a, 3, hz - 9, a + 1, 4, hz - 6, "#ade0d4");
  }
  if (lv === 5) {
    // A dry cooler bank stands on a steel bridge with a second service deck.
    const back = -hz + 4;
    for (const a of [1, 15]) v.box(a, 1, back, a + 2, 17, back + 4, IRON);
    v.box(-1, 15, back - 1, 20, 17, back + 7, IRON);
    for (let a = 0; a < 19; a += 3) v.box(a, 17, back, a + 1, 23, back + 6, "#a1bbc4");
    v.box(0, 19, back + 6, 20, 21, back + 7, "#52b5bb");
    fan(c, hx - 11, hz - 10, 8, 16);
  }
  const pumpX = lv < 3 ? -hx + 3 : -4,
    pumpZ = lv < 3 ? hz - 8 : hz - 6;
  accessCabin(v, pumpX, pumpZ, 8, "#e39e64");
  c.blink(pumpX + 6, 3, pumpZ + 4, "#e39e64");
  for (let a = pumpX + 3; a < pipeX; a += 3) v.box(a, 2, pumpZ + 1, a + 2, 3, pumpZ + 2, COPPER);
  v.box(x + r - 2, 0, -hz + 1, x + r + 1, 1, hz - 2, "#8d9e9e");
  for (let a = -hz + 2; a < hz - 4; a += 5) v.put(x + r - 1, 0, a, "#c7cebf");
  person(v, pumpX + 9, 1, hz - 4, "#da8c53");
}

function bundle(v: PixelVox, x0: number, z0: number, x1: number, z1: number, top: number, colors: string[]) {
  const dx = x1 - x0,
    dz = z1 - z0,
    length = Math.hypot(dx, dz),
    steps = Math.ceil(Math.max(length, top) * 3);
  const ox = -dz / length,
    oz = dx / length;
  for (let strand = 0; strand < colors.length; strand++) {
    const off = (strand - (colors.length - 1) / 2) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        bend = Math.sin(Math.PI * t),
        x = Math.round(x0 + dx * t + ox * off),
        z = Math.round(z0 + dz * t + oz * off);
      const y = Math.round(4 + (top - 4) * bend);
      v.box(x - 1, y - 1, z - 1, x + 1, y + 1, z + 1, NAVY);
      v.put(x, y + 1, z, colors[strand], 0.45);
      v.put(x + 1, y, z, colors[strand], 0.4);
    }
  }
  for (const [x, z] of [
    [x0, z0],
    [x1, z1],
  ]) {
    v.box(x - 3, 1, z - 4, x + 3, 6, z + 4, IRON);
    for (let a = z - 3; a < z + 3; a += 2) v.box(x + 2, 2, a, x + 3, 5, a + 1, COPPER);
  }
}
function fiberLoom(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x0 = -hx + 5,
    x1 = hx - 5,
    back = lv >= 4 ? -7 : -4;
  const height = byLv(c, [10, 17, 21, 25, 29]);
  bundle(v, x0, back, x1, back + 3, height, [BLUE, MINT, "#c8a4f0"]);
  if (lv >= 2) {
    bundle(v, x0 + 2, back + 9, x1 - 1, back + 10, height - 5, ["#cf8de0", "#edaf68"]);
    v.box(x0, 1, back + 6, x0 + 4, 4, back + 11, NAVY);
  }
  if (lv >= 3) {
    rack(v, x0, -hz + 2, 9, 4, 1, 9);
    for (let a = 0; a < 3; a++) trace(v, x1 - 2 + a, -3, hx - 4 - a * 3, hz - 4, MINT);
  }
  if (lv >= 4) {
    bundle(v, 0, -hz + 5, 6, hz - 6, height + 4, ["#e6aa59", BLUE]);
    rack(v, hx - 16, hz - 11, 10, 5, 1, 9);
  }
  if (lv === 5) {
    bundle(v, -hx + 7, hz - 8, 5, hz - 11, 19, ["#b488df", MINT]);
    rack(v, 9, -hz + 3, 12, 5, 1, 16);
    for (let a = -2; a <= 2; a += 2) {
      v.box(x0 + a, 7, back + 8, x0 + a + 1, 10, back + 10, BLUE, 0.3);
      trace(v, x0 + a, back + 12, x0 + a + 6, hz - 5, COPPER);
    }
  }
  const hubX = lv < 3 ? x0 + 2 : -4;
  accessCabin(v, hubX, hz - 8, 8, "#95bfe9");
  c.blink(hubX + 6, 3, hz - 4, BLUE);
  v.box(hubX + 1, 0, hz - 3, hubX + 5, 1, hz, "#a9b5b7");
  for (let a = 0; a < 2; a++) trace(v, x0 + a, back + 4, hubX + a + 1, hz - 8, "#b99c68");
  person(v, hubX + 9, 1, hz - 4, "#e7be68");
}

export function buildDataCenters(c: Ctx): void {
  lot(c, ["#9badaf", "#b6aca0", "#a7bdbe", "#8798a7"][c.variant % 4]);
  [rackStreet, coldAisle, coolant, fiberLoom][c.variant % 4](c);
}
