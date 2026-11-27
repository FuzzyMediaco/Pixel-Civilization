// Four places where callers reach a person. Signals, consoles and the public doorway are visible from the street.
import { byLv, lot, person, type Ctx, type PixelVox } from "./kit";
import { disc, spinner } from "./commerceKit";
import { beam } from "./sculpturalKit";

const dark = "#354859",
  aqua = "#548c91",
  ivory = "#e2d8bc",
  copper = "#bb8556",
  lamp = "#ffcd88";
const colors = ["#70c8ba", "#d88a61", "#9caace", "#d2ae68"];
function consoleDesk(v: PixelVox, x: number, y: number, z: number, tint = aqua) {
  v.box(x - 2, y, z - 1, x + 3, y + 2, z + 1, dark);
  v.box(x - 3, y + 2, z - 2, x + 3, y + 3, z + 1, ivory);
  v.box(x - 2, y + 3, z - 2, x + 1, y + 5, z - 1, tint, 0.45);
  v.put(x + 1, y + 3, z, copper);
  person(v, x, y, z + 2, "#627489");
}
function frontDesk(v: PixelVox, x: number, z: number) {
  v.hollowBox(x - 3, 1, z - 3, x + 4, 5, z + 1, aqua);
  v.box(x - 2, 2, z, x, 5, z + 1, "#a6c6bc", 0.4);
  v.box(x + 1, 1, z, x + 3, 4, z + 1, dark);
  v.put(x + 2, 3, z, lamp, 0.5);
  v.box(x - 4, 5, z - 4, x + 5, 6, z + 2, ivory);
}
function van(v: PixelVox, x: number, z: number) {
  for (const dx of [-2, 1]) for (const dz of [0, 3]) v.put(x + dx, 1, z + dz, dark);
  v.box(x - 2, 2, z - 1, x + 2, 4, z + 5, ivory);
  v.box(x - 2, 4, z - 1, x + 2, 5, z + 3, aqua);
  v.box(x - 1, 4, z + 2, x + 1, 5, z + 4, "#678496");
  v.put(x, 5, z, lamp, 0.65);
}
function switchboard(v: PixelVox, x: number, z: number, w: number, h: number) {
  v.box(x, 1, z - 2, x + w, 3, z + 1, dark);
  v.box(x, 2, z - 2, x + w, h, z, ivory);
  v.box(x + 1, 3, z - 1, x + w - 1, h - 1, z + 1, dark);
  for (let xx = x + 2; xx < x + w - 1; xx += 3) {
    for (let y = 4; y < h - 2; y += 4) {
      const col = colors[(Math.floor((xx - x) / 3) + Math.floor(y / 4)) % 4];
      v.put(xx, y, z + 1, col, 0.6);
      if ((xx + y) % 3 === 0) {
        v.put(xx, y - 1, z + 1, col);
        v.put(xx + 1, y - 1, z + 2, col);
        v.put(xx + 2, y, z + 2, col);
      }
    }
  }
  v.box(x - 1, h, z - 3, x + w + 1, h + 1, z + 1, aqua);
}
function patchExchange(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = -hx + 3,
    z = -hz + 4;
  const w = byLv(c, [7, 11, 14, 16, 18]),
    h = byLv(c, [8, 13, 16, 20, 23]);
  switchboard(v, x, z, w, h);
  consoleDesk(v, lv < 3 ? 0 : -6, 1, lv < 3 ? 2 : -2);
  if (lv >= 2) {
    // A second panel folds around the operators at right angles.
    const right = x + w;
    v.box(right, 1, z - 2, right + 2, h - 3, z + 6, ivory);
    for (let y = 4; y < h - 4; y += 3)
      for (let dz = 0; dz < 5; dz += 2) v.put(right + 1, y, z + dz, colors[dz % colors.length], 0.4);
  }
  if (lv >= 3) {
    frontDesk(v, hx - 6, hz - 5);
    consoleDesk(v, 3, 1, -2);
  }
  if (lv >= 4) {
    switchboard(v, hx - 10, -hz + 6, 7, h - 6);
    v.box(x + 3, 9, z, x + w - 1, 10, z + 4, ivory);
    consoleDesk(v, x + 7, 10, z + 2);
    v.box(x + 3, 12, z + 3, x + w - 1, 13, z + 4, copper);
    for (let a = x + 4; a < x + w - 1; a += 4) v.box(a, 10, z + 3, a + 1, 13, z + 4, copper);
  }
  if (lv === 5) {
    v.box(x + 2, h + 1, z - 2, x + 4, h + 8, z, aqua);
    beam(v, [x + 3, h + 6, z], [x + w - 1, h + 1, z], copper);
    v.put(x + 3, h + 8, z, lamp, 0.8);
    van(v, -hx + 5, hz - 8);
  }
}
function mapTable(v: PixelVox, x: number, z: number, r: number, h: number) {
  for (const dx of [-r + 2, r - 2])
    for (const dz of [-r + 2, r - 2]) v.box(x + dx, 1, z + dz, x + dx + 2, h, z + dz + 1, copper);
  const offset = Math.floor(r / 3);
  for (let j = -r; j <= r; j++) {
    const width = r - Math.max(0, Math.abs(j) - r + 2);
    const yy = h + Math.floor((r - j) * 0.35);
    v.box(x - width, yy, z + j, x + width + 1, yy + 1, z + j + 1, dark);
    if (width < 2) continue;
    for (let i = -width + 1; i < width; i++) {
      const road = (i - offset) % 5 === 0 || j % 4 === 0;
      const river = Math.abs(i - Math.round(Math.sin(j * 0.36) * r * 0.4)) < 1;
      v.put(x + i, yy, z + j, river ? "#70aebe" : road ? "#d3bd8e" : "#638a72", river ? 0.25 : 0);
      if (!road && !river && (i * 5 + j * 7) % 12 === 0) v.put(x + i, yy + 1, z + j, "#b67d5c");
    }
  }
  // An orange call marker and miniature city blocks stand above the relief map.
  for (const [u, w] of [
    [-0.5, -0.4],
    [0.4, 0.2],
    [-0.2, 0.55],
  ]) {
    const px = x + Math.round(r * u),
      dz = Math.round(r * w),
      py = h + Math.floor((r - dz) * 0.35) + 1;
    v.box(px, py, z + dz, px + 2, py + 2, z + dz + 2, ivory);
    v.put(px, py + 2, z + dz, copper);
  }
  const flagX = x - Math.floor(r * 0.4),
    flagY = h + Math.floor(r * 0.35);
  v.box(flagX, flagY, z, flagX + 1, flagY + 5, z + 1, copper);
  v.box(flagX - 1, flagY + 3, z, flagX + 2, flagY + 5, z + 1, "#df8956", 0.4);
  v.put(x + 1, h + Math.floor(r * 0.35) + 1, z, lamp, 0.65);
}
function mapRoom(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [4, 6, 7, 9, 10]),
    x = lv >= 3 ? -4 : 0,
    z = lv >= 4 ? -3 : -1;
  mapTable(v, x, z, r, byLv(c, [3, 5, 7, 10, 13]));
  consoleDesk(v, lv >= 3 ? hx - 6 : -1, 1, lv >= 3 ? -1 : 4, "#8faf9a");
  if (lv >= 2) {
    v.box(x - r, 1, z - r, x + r, 4, z - r + 1, ivory);
    v.box(x - r, 3, z - r, x - r + 1, 8, z - r + 1, copper);
    v.put(x - r, 8, z - r, lamp, 0.6);
  }
  if (lv >= 3) frontDesk(v, hx - 6, hz - 4);
  if (lv >= 4) {
    const px = hx - 6;
    switchboard(v, px - 3, -hz + 3, 7, 12);
    v.box(x + 1, 6, z + 3, px + 1, 7, z + 5, ivory);
  }
  if (lv === 5) {
    mapTable(v, hx - 7, -hz + 7, 4, 11);
    for (let i = 0; i < 5; i++) v.box(-hx + 3, 1 + i, hz - 6 - i, -hx + 7, 2 + i, hz - 5 - i, copper);
    van(v, -hx + 6, hz - 7);
  }
}
function headset(v: PixelVox, x: number, z: number, r: number, lift: number) {
  const cy = r + lift;
  // The connector sits above two padded, windowed operator pods.
  for (let dx = -r; dx <= r; dx++) {
    const dy = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)));
    const next = Math.round(Math.sqrt(Math.max(0, r * r - Math.min(r, Math.abs(dx) + 1) ** 2)));
    v.box(x + dx, cy + next, z - 2, x + dx + 1, cy + dy + 2, z + 1, aqua);
    v.put(x + dx, cy + dy + 1, z, ivory, dx % 3 === 0 ? 0.3 : 0);
  }
  for (const side of [-1, 1]) {
    const px = x + side * r;
    v.box(px - 2, 1, z - 2, px + 2, cy + 2, z + 2, dark);
    v.box(px - 2, lift, z - 3, px + 2, cy + 1, z + 3, copper);
    v.box(px - 1, lift + 1, z + 2, px + 1, cy, z + 3, "#8db9bb", 0.35);
    v.box(px + side, cy - 1, z - 1, px + side + 1, cy + 1, z + 2, ivory);
  }
  beam(v, [x + r, cy - 2, z + 2], [x + 1, lift + 1, z + 4], dark);
  v.box(x, lift, z + 3, x + 3, lift + 2, z + 5, aqua);
}
function headsetHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [3, 5, 6, 8, 9]),
    x = lv >= 3 ? -4 : 0,
    z = lv >= 3 ? -3 : -1;
  headset(v, x, z, r, lv + 1);
  consoleDesk(v, x, 1, z + 1);
  if (lv >= 2) {
    v.box(x - r + 2, 1, z - 2, x + r - 1, 3, z, ivory);
    v.put(x - r + 2, 3, z - 1, lamp, 0.6);
  }
  if (lv >= 3) {
    frontDesk(v, hx - 6, hz - 4);
    van(v, hx - 6, -hz + 2);
  }
  if (lv >= 4) {
    headset(v, hx - 6, -hz + 5, 3, 4);
    v.box(x + 2, 7, z - 2, hx - 5, 8, z + 1, ivory);
    consoleDesk(v, x + 2, 8, z - 1);
  }
  if (lv === 5) {
    for (const xx of [-hx + 3, -hx + 8]) v.box(xx, 1, hz - 7, xx + 1, 8, hz - 5, copper);
    v.box(-hx + 2, 7, hz - 8, -hx + 9, 8, hz - 3, ivory);
    switchboard(v, -hx + 3, hz - 8, 5, 12);
    c.blink(x, 2 * r + lv + 2, z, ivory);
  }
}
function dish(v: PixelVox, x: number, z: number, h: number, r: number) {
  // A stepped, backed bowl flies low over the roof desk; its rim faces upward and towards +z.
  v.box(x - 1, 1, z - 1, x + 2, h, z + 2, dark);
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++) {
      const radius = Math.hypot(dx, dz);
      if (radius > r) continue;
      const y = h + Math.round((radius / r) ** 2 * 3 - dz * 0.48);
      v.put(
        x + dx,
        y,
        z + dz,
        radius >= r - 1 ? aqua : ivory,
        radius >= r - 1 && (dx === 0 || dz === 0) ? 0.38 : 0,
      );
      if (Math.abs(dx) < 0.7 || Math.abs(dz) < 0.7) v.put(x + dx, y - 1, z + dz, copper);
    }
  beam(v, [x, h, z], [x, h + 5, z + 2], copper);
  v.put(x, h + 5, z + 2, lamp, 0.6);
}
function dishTerrace(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv >= 3 ? -6 : -1,
    z = lv >= 3 ? -3 : -2;
  const r = byLv(c, [3, 5, 6, 7, 8]),
    h = byLv(c, [4, 7, 9, 13, 16]);
  dish(v, x, z, h, r);
  consoleDesk(v, x + 1, 1, z + 4);
  if (lv >= 2) {
    v.box(x - 3, 1, z - 3, x + 4, 3, z + 2, aqua);
    for (const dx of [-3, 3]) beam(v, [x + dx, 2, z], [x, h - 1, z], dark);
  }
  if (lv >= 3) {
    dish(v, hx - 6, -hz + 4, 5, 3);
    frontDesk(v, hx - 6, hz - 5);
  }
  if (lv >= 4) {
    disc(v, x, z, 7, 8, r - 1, ivory);
    v.box(x + 1, 7, z - 1, hx - 6, 8, z + 1, copper);
    person(v, x + 4, 8, z, "#72779a");
    van(v, -hx + 4, hz - 7);
  }
  if (lv === 5) {
    dish(v, hx - 7, hz - 9, 11, 5);
    const px = hx - 8,
      pz = -hz + 6;
    v.box(px, 6, pz, px + 1, 19, pz + 1, dark);
    const head = spinner(c, px, 19, pz, "y", 0.35);
    head.box(-3, 0, -1, 4, 1, 1, copper);
    head.put(3, 0, 0, lamp, 0.55);
  }
}
export function emergencyDispatch(c: Ctx): void {
  lot(c, "#acb7ab");
  c.v.box(-c.hx + 1, 0, c.hz - 4, c.hx - 1, 1, c.hz, "#d1c6a9");
  [patchExchange, mapRoom, headsetHall, dishTerrace][c.variant % 4](c);
}
