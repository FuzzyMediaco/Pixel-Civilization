import { type Ctx, type PixelVox, byLv, person, ring } from "./kit";
import { classicCar, glassFront, spinner } from "./commerceKit";
import { beam, entrance, finish as f, oval, plate, storey } from "./sculpturalKit";

function gauge(v: PixelVox, x: number, y: number, z: number, r: number) {
  v.ringZ(x, y, z, z + 1, r + 0.6, Math.max(0, r - 0.5), f.bronze);
  v.ringZ(x, y, z + 1, z + 2, r - 0.5, 0, f.porcelain);
  beam(v, [x, y, z + 2], [x + r * 0.55, y + r * 0.45, z + 2], f.copper);
  v.put(x, y, z + 2, f.amber, 0.75);
}
function bridgeY(x: number, span: number, level: number) {
  if (level < 4) return 5;
  // Only the near leaf rises. A real gap remains between its tip and the far abutment.
  const hinge = -Math.round(span * 0.76),
    tilt = level === 4 ? 0.47 : 0.75;
  return 5 + Math.max(0, x - hinge) * tilt;
}
function bridgeInspection(c: Ctx) {
  const { v, lv, hx, hz } = c,
    span = byLv(c, [8, 11, 15, 18, 23]),
    half = byLv(c, [2, 3, 3, 4, 5]),
    z = lv >= 3 ? -3 : -1;
  const north = z - half,
    south = z + half;
  v.box(-Math.round(span * 0.53), 0, -hz + 3, Math.round(span * 0.5), 1, hz - 3, "#6b9a9c");
  for (const left of [-span, span - 3]) {
    v.box(left - 1, 1, north - 1, left + 4, 5, south + 2, f.limestone);
    for (let dx = 0; dx < 4; dx += 2) v.put(left + dx, 3, south + 1, f.copper);
  }
  const end = lv >= 4 ? -Math.ceil(span * 0.15) : span,
    second = lv >= 4 ? Math.floor(span * 0.12) : span + 1;
  for (let x = -span; x <= span; x++) {
    if (x > end && x < second) continue;
    const y = x <= end ? Math.round(bridgeY(x, span, lv)) : 5;
    v.box(x, y, north, x + 1, y + 1, south + 1, "#69767b");
    if (x % 5 === 0) v.put(x, y, z, f.porcelain);
    for (const side of [north, south]) {
      v.put(x, y - 1, side, "#6d9289");
      if (x % 3 === 0) v.box(x, y + 1, side, x + 1, y + 3, side + 1, f.cedar);
      v.put(x, y + 3, side, f.bronze);
      if (lv >= 3) {
        const raise = 3 + Math.round(3 * Math.abs(((x + span) % 8) / 4 - 1));
        v.put(x, y + raise, side, "#538378");
        if (x % 8 === 0) v.box(x, y + 3, side, x + 1, y + 6, side + 1, "#538378");
      }
    }
  }
  for (const side of [-1, 1]) {
    const bankX = side * Math.round(span * 0.5);
    for (let bz = -hz + 3; bz < hz - 3; bz += 5) v.put(bankX, 0, bz, bz % 2 === 0 ? "#b4baa2" : "#919b87");
  }
  // Two amber lamps mark the inspection pit even before a gatehouse is built.
  for (const side of [-1, 1]) v.put(side * (span - 1), 8, south, f.amber, 0.8);
  entrance(c, span - 2, south + 2, 2);
  if (lv >= 2) {
    const x = hx - 7,
      bz = hz - 7;
    const plan = plate(x, bz, 4, 3, 0.2);
    storey(v, plan, plan, 1, 6, f.glass, f.limestone);
    person(v, x - 4, 1, bz + 2, "orange");
  }
  if (lv >= 3) {
    const x = -hx + 5,
      bz = hz - 8;
    for (let i = 0; i < 3; i++) v.box(x + i * 2, 1, bz - i, x + i * 2 + 2, i + 2, bz + 4 - i, f.limestone);
    v.box(x + 4, 4, bz - 2, x + 10, 5, bz + 1, f.bronze);
    gauge(v, x + 7, 7, bz - 2, 2);
  }
  if (lv >= 4) {
    const hinge = -Math.round(span * 0.76);
    for (const pz of [north - 1, south + 1]) {
      beam(v, [hinge - 2, 3, pz], [hinge - 5, 15, pz], f.ink, 2);
      beam(v, [hinge - 5, 15, pz], [end, bridgeY(end, span, lv) + 3, pz], f.gold);
      v.box(hinge - 8, 11, pz - 1, hinge - 4, 15, pz + 2, f.limestone);
    }
  }
  if (lv === 5) {
    const x = hx - 10,
      bz = -hz + 7;
    const tower = oval(x, bz, 4, 4, 8);
    storey(v, tower, tower, 1, 10, "#455f64", f.limestone);
    storey(v, tower, oval(x, bz, 6, 5, 8), 11, 5, f.glass, f.silver);
    v.box(span - 4, 5, -hz + 7, span - 2, 6, north, f.silver);
    classicCar(v, hx - 12, hz - 10, "x", "teal");
  }
}

function reservoir(c: Ctx) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [6, 8, 10, 13, 16]),
    h = byLv(c, [6, 9, 12, 16, 20]);
  const x = lv >= 3 ? -5 : -1,
    z = lv >= 4 ? -3 : -1;
  // Leave the broad south-east wedge open so the water, inner step and inspection lights are visible.
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++) {
      const dist = Math.hypot(dx, dz),
        opening = dz > 0 && dx > -Math.floor(r * 0.4) && dz > dx * 0.5;
      if (dist > r + 0.2) continue;
      if (dist > r - 1.4) {
        const top = opening ? 3 : h;
        v.box(x + dx, 1, z + dz, x + dx + 1, top + 1, z + dz + 1, opening ? f.silver : "#b5b5a3");
        v.put(x + dx, top, z + dz, opening ? f.silver : "#658e82");
        if (!opening && Math.abs((dx + dz) % 5) === 2) v.put(x + dx, top - 1, z + dz, f.bronze);
      } else v.put(x + dx, 2, z + dz, Math.abs((dx + dz) % 6) === 0 ? "#80b6b9" : "#55989b");
    }
  const gaugeX = x + r - 2,
    gaugeZ = z + Math.round(r * 0.54);
  v.box(gaugeX, 1, gaugeZ, gaugeX + 2, h + 3, gaugeZ + 2, "#527b76");
  gauge(v, gaugeX, h + 2, gaugeZ + 2, Math.max(2, Math.round(r * 0.27)));
  entrance(c, gaugeX + 2, gaugeZ + 3, 2);
  if (lv >= 2) {
    const px = x - r + 2,
      pz = z + Math.round(r * 0.6);
    for (let i = 0; i < 5; i++) v.box(px + i, 1, pz + i, px + i + 2, 2 + i, pz + i + 3, "#ac9679");
    person(v, px + 4, 6, pz + 5, "orange");
  }
  if (lv >= 3) {
    const ex = hx - 8,
      ez = -hz + 6;
    const plan = plate(ex, ez, 5, 4, 0.3);
    storey(v, plan, plan, 1, 6, f.glass, f.porcelain);
    for (const pz of [ez - 1, ez + 2]) {
      v.box(x + r - 1, 4, pz, ex - 4, 6, pz + 2, "#658a82");
      v.box(ex - 6, 2, pz, ex - 4, 7, pz + 2, f.bronze);
    }
  }
  if (lv >= 4) {
    const ex = x - r + 3,
      ez = z - r + 3,
      top = h + 7;
    for (const side of [-1, 1]) beam(v, [ex + side * 3, 1, ez], [ex + side, top, ez], f.ink, 2);
    v.box(ex - 4, top, ez - 2, ex + 5, top + 1, ez + 3, f.limestone);
    for (const sign of [-1, 1]) v.box(ex + sign * 3, top + 1, ez, ex + sign * 3 + 1, top + 4, ez + 1, f.bronze);
    v.box(ex - 4, top + 4, ez - 2, ex + 5, top + 5, ez + 3, "#668e82");
    v.put(ex, top + 3, ez, f.amber, 0.75);
  }
  if (lv === 5) {
    const ex = hx - 11,
      ez = hz - 6;
    ring(v, ex, ez, 1, 5, 5, 3.8, "#adb3a4");
    v.cylinderY(ex, ez, 2, 3, 4, "#529398");
    v.box(x + r - 1, 5, z + 4, ex, 6, z + 7, f.silver);
    v.box(ex - 1, 5, z + 5, ex + 1, 6, ez - 4, f.silver);
    for (let j = 0; j < 3; j++) v.box(ex + 3, 5 + j * 3, -hz + 5, ex + 5, 6 + j * 3, -hz + 4, f.amber, 0.6);
  }
}

function gantry(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv >= 3 ? -7 : -4,
    z = lv >= 3 ? -4 : 0,
    h = byLv(c, [10, 14, 18, 23, 29]),
    reach = byLv(c, [8, 10, 13, 16, 20]);
  const base = byLv(c, [3, 4, 5, 6, 7]),
    anchor = x - 2,
    end = x + reach;
  for (const dx of [-base, base])
    for (const dz of [-2, 2]) {
      const target: [number, number, number] = [x + Math.sign(dx), h, z + Math.sign(dz)];
      v.box(x + dx - 1, 1, z + dz - 1, x + dx + 2, 3, z + dz + 2, f.limestone);
      beam(v, [x + dx, 3, z + dz], target, "#a37144", 2);
    }
  const tip = h + Math.round(reach * 0.48);
  for (const lane of [-1, 1]) {
    const zz = z + lane;
    beam(v, [anchor - 4, h - 1, zz], [end, tip, zz], f.cedar, 2);
    beam(v, [anchor - 4, h + 3, zz], [end, tip + 2, zz], f.gold);
    for (let dx = -4; dx < reach + 1; dx += 4) {
      const t = (dx + 4) / (reach + 4),
        y = Math.round(h - 1 + (tip - h + 1) * t);
      beam(v, [anchor + dx, y + 1, zz], [Math.min(end, anchor + dx + 3), y + 4, zz], f.ink);
    }
  }
  v.box(anchor - 6, h - 1, z - 2, anchor - 2, h + 3, z + 3, f.limestone);
  beam(v, [end, tip, z], [end, 5, z], f.ink);
  v.ringZ(end, 4, z - 1, z + 2, 2.5, 1.25, "#a5aaa0");
  v.put(end, tip + 1, z, f.amber, 0.78);
  entrance(c, x + 2, z + 3, 2);
  if (lv >= 2) {
    const py = h - 4;
    v.box(x - 3, py, z + 1, x + 2, py + 3, z + 5, f.ink);
    glassFront(v, x - 3, x + 2, py + 1, py + 3, z + 4, f.cedar, 3, f.amber);
    v.box(x - 4, py + 3, z + 1, x + 3, py + 4, z + 6, f.gold);
    for (const px of [x - base, x + base]) v.box(px - 1, 0, -hz + 3, px + 1, 1, hz - 4, f.silver);
  }
  if (lv >= 3) {
    const px = hx - 8,
      pz = hz - 7;
    const plan = plate(px, pz, 5, 4, 0.1);
    storey(v, plan, plan, 1, 7, f.glass, f.porcelain);
    for (const off of [-3, 2]) v.ringZ(px + off, 3, -hz + 3, -hz + 8, 3, 1.6, "#a1a79d");
  }
  if (lv >= 4) {
    const px = x + 2,
      pz = hz - 10;
    v.box(px - 8, 1, pz - 2, px + 8, 3, pz + 4, f.limestone);
    for (const dx of [-7, 7]) {
      v.box(px + dx, 3, pz - 2, px + dx + 2, 12, pz + 2, "#647b75");
    }
    v.box(px - 7, 12, pz - 2, px + 9, 14, pz + 2, "#698e81");
    person(v, px - 3, 3, pz + 1, "orange");
  }
  if (lv === 5) {
    const drum = spinner(c, x - 2, h - 1, z + 2, "z", 0.45);
    drum.ringZ(0, 0, 0, 3, 3, 1.7, f.silver);
    beam(drum, [-2, 0, 2], [2, 0, 2], f.cedar);
    const px = hx - 10,
      pz = -hz + 6;
    for (let i = 0; i < 3; i++) v.ringZ(px + i * 4 - 4, 4, pz, pz + 6, 3.4, 1.8, "#a8aaa4");
    v.ringZ(px, 8, pz, pz + 6, 3.4, 1.8, "#a8aaa4");
    classicCar(v, -hx + 7, hz - 7, "z", "orange");
  }
}

function streetSection(c: Ctx) {
  const { v, lv, hx, hz } = c,
    w = byLv(c, [6, 8, 11, 14, 17]),
    d = byLv(c, [8, 13, 15, 20, 24]);
  const x = lv >= 3 ? -5 : -4,
    z = -Math.round(d / 2) - 2,
    r = byLv(c, [3, 4, 5, 6, 7]),
    cy = 2 + r,
    top = byLv(c, [8, 10, 13, 16, 20]);
  const tunnelX = x - Math.floor(w * 0.28);
  // The street is progressively peeled back from the utility trench: the front
  // slope exposes the full round culvert and the cut ends of the two buried mains.
  const front = z + d;
  const cutEnd = (dx: number, y: number) =>
    front - Math.floor((y / top) * (d * 0.27 + ((dx + w) / (2 * w)) * d * 0.57));
  for (let dx = -w; dx <= w; dx++)
    for (let y = 1; y <= top; y++) {
      const radial = Math.hypot(x + dx - tunnelX, y - cy);
      if (radial < r - 0.55) continue;
      const culvert = radial < r + 0.65;
      const color = y >= top - 1 ? "#777b73" : y >= top - 3 ? "#bab49a" : y % 5 === 0 ? "#b29672" : "#967454";
      const edge = cutEnd(dx, y);
      if (culvert) {
        v.box(x + dx, y, z, x + dx + 1, y + 1, front + 3, "#a4b6b2");
        if (y > 2) v.put(x + dx, y, front + 2, "#7c9391");
      } else {
        if (Math.abs(dx) === w || y === top || y === 1) v.box(x + dx, y, z, x + dx + 1, y + 1, edge, color);
        else {
          v.put(x + dx, y, z, color);
          v.box(x + dx, y, edge - 2, x + dx + 1, y + 1, edge, color);
        }
      }
    }
  for (let dx = -w; dx <= w; dx++) {
    const edge = cutEnd(dx, top);
    v.box(x + dx, top + 1, z, x + dx + 1, top + 2, edge, "#4e585c");
    if (Math.abs(dx) === w) v.box(x + dx, top + 2, z, x + dx + 1, top + 3, edge, f.limestone);
  }
  for (let zz = z; zz < cutEnd(0, top); zz += 4)
    v.box(x, top + 2, zz, x + 1, top + 3, Math.min(cutEnd(0, top), zz + 2), f.porcelain);
  const ductX = x + Math.ceil(w * 0.63),
    ductY = cy + 1;
  v.ringZ(ductX, ductY, z + 1, front + 1, 2.2, 1.1, "#a87546");
  v.ringZ(ductX, ductY, front - 1, front + 2, 2.5, 1.1, f.bronze);
  v.put(ductX, ductY, front, f.pool, 0.7);
  v.put(tunnelX, cy + r, front + 2, f.amber, 0.75);
  // A streetworks barrier keeps the open cut visible along the pedestrian path.
  v.box(x + w + 2, 1, front - 3, x + w + 3, 5, front - 2, f.ink);
  v.box(x + w + 6, 1, front - 3, x + w + 7, 5, front - 2, f.ink);
  for (let k = 0; k < 6; k++) v.put(x + w + 2 + k, 4, front - 3, k % 3 === 0 ? f.porcelain : f.copper);
  entrance(c, tunnelX, front, 2);
  if (lv >= 2) {
    const ex = x + w + 2;
    for (let j = 0; j < 5; j++) v.box(ex, 1, front - 1 - j * 2, ex + 2, 2 + j * 2, front + 1 - j * 2, f.limestone);
    v.box(ex - 2, top, z + 2, ex + 3, top + 1, z + 6, f.cedar);
    const poleX = hx - 5,
      poleZ = front + 3;
    v.box(poleX, 1, poleZ, poleX + 2, top + 6, poleZ + 2, "#75867e");
    for (let y = 3; y < top + 5; y += 3) v.put(poleX + 1, y, poleZ + 1, f.limestone);
    beam(v, [poleX, top + 4, poleZ], [poleX - 4, top + 7, poleZ - 1], f.bronze);
    v.put(poleX - 4, top + 6, poleZ - 1, f.amber, 0.8);
    person(v, tunnelX, 1, front + 1, "orange");
  }
  if (lv >= 3) {
    const px = hx - 8,
      pz = -hz + 5,
      plan = plate(px, pz, 4, 3, 0.25);
    storey(v, plan, plan, 1, 6, f.glass, f.porcelain);
    const above = x - Math.round(w / 2);
    v.box(above, top + 3, z + 1, above + 1, top + 8, z + 2, f.ink);
    v.put(above, top + 8, z + 1, f.amber, 0.7);
    v.ringZ(x + w - 4, 5, front - 1, front + 2, 3, 1.8, "#708979");
  }
  if (lv >= 4) {
    classicCar(v, x - 4, z + 3, "x", "teal", top + 3);
    const ex = x + w - 2;
    for (let dz = 0; dz < 8; dz++)
      v.box(ex, top + 3, z + dz, ex + 2, top + 4, z + dz + 1, dz % 3 ? "#ba7e44" : f.porcelain);
    v.box(x - w - 4, 1, front + 2, x + w + 3, 2, front + 5, f.limestone);
    for (let k = x - w - 2; k < x + w; k += 4) v.box(k, 2, front + 4, k + 1, 4, front + 5, f.bronze);
  }
  if (lv === 5) {
    const px = hx - 12,
      pz = hz - 8;
    v.box(px - 3, 1, pz - 4, px + 4, 5, pz + 3, "#71887d");
    v.ringZ(px, 5, pz + 2, pz + 4, 3, 1.8, f.bronze);
    v.box(x + w - 1, 4, front - 2, px + 1, 6, front, f.silver);
    v.box(px - 1, 4, front - 2, px + 1, 6, pz, f.silver);
    v.box(x - w + 2, top + 2, z + 2, x - w + 4, top + 9, z + 6, f.glass);
    gauge(v, x - w + 3, top + 9, z + 6, 2);
  }
}
export function publicWorks(c: Ctx) {
  [bridgeInspection, reservoir, gantry, streetSection][c.variant](c);
}
