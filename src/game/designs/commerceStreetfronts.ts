/** Original cash kiosks, office towers, workplaces and neighborhood retail. */
import { bench, bush, lot, person, type Ctx, type PixelVox } from "./kit";
import { bulbs, disc, glassFront, sculpt, spinner } from "./commerceKit";
import { beam, plate, storey, type Point3 } from "./sculpturalKit";

const cream = "#fff0cb";
const steel = "#324b57";
const brass = "#edab44";

function terrace(c: Ctx, color: string): void {
  lot(c, color);
  for (let x = -c.hx + 1; x < c.hx - 1; x += 4) {
    c.v.put(x, 0, c.hz - 1, cream);
  }
}

function cashPanel(v: PixelVox, x: number, y: number, z: number): void {
  v.box(x - 2, y, z - 1, x + 2, y + 5, z + 1, steel);
  v.box(x - 1, y + 3, z + 1, x + 2, y + 5, z + 2, "#9de7c2", .45);
  v.box(x - 2, y + 1, z + 1, x + 2, y + 2, z + 2, "#172e30");
  v.put(x, y + 1, z + 2, "#86bf7c");
  v.put(x - 1, y + 2, z + 1, "#d0dbe0");
}

function coin(v: PixelVox, x: number, y: number, z: number, r: number): void {
  v.ringZ(x, y, z - 1, z + 1, r, 0, "#cb7c27");
  v.ringZ(x, y, z + 1, z + 2, r, r - 1, "#ffe290");
  v.box(x - 1, y - r + 2, z + 1, x + 1, y + r - 2, z + 2, cream);
  v.put(x - 2, y + 1, z + 1, cream);
}

function coinExchange(c: Ctx): void {
  const { v, lv } = c;
  const base = [1, 2, 3, 6, 9][lv - 1];
  disc(v, 0, -1, 1, base + 1, 5.5, (_x, y) => y % 2 ? "#cd8535" : "#fff0a3");
  coin(v, 0, base + 5, -2, lv < 3 ? 4 : 6);
  if (lv >= 2) {
    for (const x of [-5, 5]) {
      disc(v, x, 2, 1, lv, 2.3, "#e6a643");
      disc(v, x, 2, lv, lv + 1, 2.4, "#ffe08b");
    }
  }
  if (lv >= 3) {
    beam(v, [-6, 1, 4], [-6, 5, 3], steel);
    beam(v, [5, 1, 4], [5, 5, 3], steel);
    v.box(-7, 6, 2, 7, 7, 5, "#46877b");
  }
  if (lv === 5) {
    const rotor = spinner(c, 0, base + 14, -2, "y", .45);
    coin(rotor, 0, 0, 0, 3);
  }
  cashPanel(v, 0, 1, 3);
}

function piggyExchange(c: Ctx): void {
  const { v, lv } = c;
  const cy = [5, 5, 7, 9, 12][lv - 1];
  const r = lv === 1 ? 4 : 5;
  const belly = "#e58b83";
  for (const x of [-3, 2]) for (const z of [-4, 1]) {
    v.box(x, 1, z, x + 2, cy, z + 2, "#be706b");
    v.box(x, 1, z, x + 2, 2, z + 2, steel);
  }
  v.sphere(0, cy, -1, r + 1, r - 1, 5.5, belly);
  v.sphere(0, cy + 1, 2, r, r - 1, 3, "#f5ada3");
  for (const x of [-3, 2]) {
    v.box(x, cy + 3, 0, x + 2, cy + 6, 2, belly);
    v.put(x, cy + 5, 2, "#b56372");
    v.put(x, cy + 2, 4, "#352f42");
  }
  v.box(-2, cy - 1, 4, 2, cy + 1, 6, "#e48085");
  for (const x of [-2, 1]) v.put(x, cy, 6, "#924953");
  v.box(-2, cy + r - 2, -4, 2, cy + r - 1, -2, steel);
  if (lv >= 2) coin(v, lv === 2 ? -4 : 0, cy + r + 1, -4, lv >= 4 ? 3 : 2);
  if (lv >= 3) {
    v.box(-5, 1, -5, 5, cy - 2, 2, "#a7cdb1");
    for (let y = 2; y < cy - 2; y += 3) v.box(-5, y, -5, 5, y + 1, 2, "#d1e9c9");
  }
  if (lv >= 4) {
    for (const x of [-6, 4]) {
      v.box(x, cy + 5, -3, x + 2, cy + 6, 3, brass);
      v.put(x, cy + 6, 1, cream);
    }
  }
  if (lv === 5) {
    v.ringZ(0, cy + 6, -6, -5, 6, 5, brass);
    v.put(0, cy + 12, -6, cream, .7);
  }
  cashPanel(v, 0, 1, 3);
}

function vaultExchange(c: Ctx): void {
  const { v, lv } = c;
  const floor = [1, 1, 3, 5, 8][lv - 1];
  const cy = floor + 5;
  if (floor > 1) {
    v.hollowBox(-6, 1, -6, 6, floor + 1, 3, "#687d7e");
    glassFront(v, -5, 6, 2, floor, 2, steel, 3, "#abcdbc");
  }
  v.ringZ(0, cy, -5, 2, lv > 1 ? 6 : 5, 0, "#67888a");
  v.ringZ(0, cy, 2, 3, lv > 1 ? 6 : 5, 4, "#ccdfcf");
  v.ringZ(0, cy, 2, 3, 4, 0, "#354d56");
  // The round door has swung out perpendicular to the round opening.
  for (let y = -4; y <= 4; y++) for (let z = -3; z <= 3; z++) {
    if (y * y + z * z <= 16) v.box(-5, cy + y, z + 3, -3, cy + y + 1, z + 4, "#a5bcb6");
  }
  v.box(-6, cy, 1, -5, cy + 1, 7, steel);
  v.box(-6, cy - 2, 4, -5, cy + 3, 5, steel);
  if (lv >= 2) for (const x of [-5, 4]) {
    v.box(x, cy + 4, -5, x + 2, cy + 7, -3, "#c29860");
  }
  if (lv >= 4) {
    v.ringZ(0, cy + 7, -5, -2, 3, 1, brass);
    if (lv === 5) v.ringZ(0, cy + 7, -1, 0, 4, 3, cream);
  }
  if (lv >= 2) {
    v.box(4, 1, -1, 7, 6, 4, steel);
    v.box(4, 4, 4, 7, 6, 5, "#9ed6bc", .45);
    v.box(4, 6, -1, 7, 7, 5, brass);
  }
  cashPanel(v, lv < 3 ? 1 : 2, 1, 4);
}

function cardExchange(c: Ctx): void {
  const { v, lv } = c;
  const tiltCard = (cx: number, cy: number, cz: number, tilt: number, face: string) => {
    for (let y = 0; y < 8; y++) {
      const shift = Math.round(tilt * y / 7);
      const edge = y === 0 || y === 7 ? 1 : 0;
      v.box(cx - 4 + edge + shift, cy + y, cz, cx + 5 - edge + shift, cy + y + 1, cz + 2, y === 5 ? steel : face);
      if (y < 4 && y > 0) v.box(cx - 2 + shift, cy + y, cz + 2, cx + shift, cy + y + 1, cz + 3, brass);
    }
  };
  const lift = [0, 2, 3, 5, 7][lv - 1];
  if (lv >= 3) tiltCard(0, 5 + lift, -5, -3, "#ef8369");
  if (lv === 5) tiltCard(0, 7 + lift, -7, 1, "#eec674");
  tiltCard(0, 4 + lift, -3, 2, "#61a9af");
  v.hollowBox(-6, 1, -4, 6, 4 + lift, 2, steel);
  if (lv >= 4) glassFront(v, -5, 5, 3, lift + 2, 1, "#294954", 4, "#e0c48c");
  for (let z = 1; z <= 5; z++) {
    const y = Math.max(2, 5 - Math.floor(z / 2));
    v.box(-5, 1, z, 5, y + 1, z + 1, "#405d69");
    for (let x = -3; x <= 2; x += 2) v.put(x, y + 1, z, z === 1 ? "#a7edde" : cream, z === 1 ? .75 : .37);
  }
  if (lv >= 2) {
    // A side reader lets the next customer tap while the main terminal is busy.
    v.box(-7, 1, 0, -5, 7, 3, "#395c69");
    v.ringZ(-5, 8, -1, 1, 3, 1.5, "#e2ab68");
  }
  if (lv >= 4) {
    for (const x of [-7, 5]) beam(v, [x, 1, 5], [x, 9, 2], steel);
    for (let z = 0; z < 7; z++) {
      const y = 11 - Math.floor(z / 3);
      v.box(-7, y, z, 7, y + 1, z + 1, z % 3 ? "#76a5a4" : cream);
    }
  }
  v.box(-3, 2, 6, 3, 3, 7, "#203338");
  v.put(1, 2, 7, "#acd698", .7);
}

export function atms(c: Ctx): void {
  terrace(c, "#cac6ab");
  [coinExchange, piggyExchange, vaultExchange, cardExchange][c.variant](c);
  person(c.v, 5, 1, 6, "#408280", "charcoal", "#af795c");
}



function spiralOffices(c: Ctx): void {
  const { v, lv, hx } = c;
  const tiers = [2, 3, 4, 6, 8][lv - 1];
  const radius = hx * .46;
  const orbit = hx * .26;
  v.cylinderY(0, -1, 1, tiers * 5 + 1, radius * .65, "#476754");
  for (let i = 0; i < tiers; i++) {
    const angle = i * 1.45 + .85;
    const x = Math.round(Math.cos(angle) * orbit), z = Math.round(Math.sin(angle) * orbit) - 1;
    const y = 1 + 5 * i;
    disc(v, x, z, y, y + 4, radius, (xx, yy, zz, d) => {
      if (d < radius - 1 && yy !== y) return null;
      if ((xx + zz) % 4 === 0) return "#547f71";
      const pane = ["#80b6a4", "#49857e", "#a2c4a6"][(xx + zz + yy + 120) % 3];
      return [pane, yy > y && Math.abs(xx + i) % 6 < 2 ? .31 : 0];
    });
    disc(v, x, z, y + 4, y + 5, radius + 1.3, cream);
    disc(v, x, z, y + 5, y + 6, radius + .7, "#82a362");
    bush(v, x + Math.cos(angle) * radius * .62, y + 6, z + Math.sin(angle) * radius * .62, lv > 3 ? 1.6 : 1, "#476e47");
  }
  if (lv >= 3) {
    const y = tiers * 5 + 2;
    const x = Math.round(Math.cos((tiers - 1) * 1.45 + .85) * orbit);
    v.box(x, y, -2, x + 1, y + 3, -1, "#725544");
    v.sphere(x, y + 4, -2, lv > 3 ? 3.5 : 2, 2, 2.5, "#69955b");
  }
}

function radiogramOffices(c: Ctx): void {
  const { v, lv, hx } = c;
  const h = [9, 15, 24, 42, 62][lv - 1], r = hx - 2;
  const z0 = -Math.ceil(r * .46), z1 = Math.ceil(r * .44);
  const finDepth = (band: number) => Math.max(1, Math.round((3 - band) * lv / 3));
  // Stepped broadcasting fins fan from a central glazed studio into the skyline.
  for (let x = -r; x < r; x++) {
    const distance = Math.abs((x + .5) / r);
    const band = Math.min(3, Math.floor(distance * 4));
    const top = Math.round(h * [1, .82, .62, .42][band]);
    const depth = finDepth(band);
    const nextBand = Math.min(3, Math.floor(Math.abs((x + 1.5) / r) * 4));
    for (let y = 1; y <= top; y++) {
      const end = Math.abs(x) % (lv < 4 ? 3 : 4) === 0;
      const glass = !end && y > 2 && y % 5 > 1 && y < top - 2;
      const color = y >= top - 1 ? brass : glass ? "#427782" : end ? "#be784d" : "#e4ac73";
      v.put(x, y, z1 + depth - 1, color, glass && y % 10 > 5 ? .43 : glass ? .16 : 0);
      v.put(x, y, z0 - depth, color);
      if (x === -r || x === r - 1 || y === top || depth !== finDepth(nextBand)) {
        v.box(x, y, z0 - depth, x + 1, y + 1, z1 + depth, color);
      }
    }
  }
  if (lv >= 2) {
    for (let i = -2; i <= 2; i++) {
      const y = h + Math.max(2, lv * 2 - Math.abs(i) * 2);
      beam(v, [0, h - 3, -1], [i * (lv > 3 ? 2 : 1), y, -1], brass);
    }
  }
  if (lv >= 4) {
    v.ringZ(0, h + 3, -2, 1, lv + 1, lv - 1, cream);
    c.blink(0, h + lv * 2, -1, "#f6ae47");
  }
}

function twinOffices(c: Ctx): void {
  const { v, lv, hx } = c;
  const h = [10, 16, 24, 39, 56][lv - 1];
  const r = Math.max(2.5, hx * .32), offset = Math.floor(hx * .51);
  for (const side of [-1, 1]) {
    const cy = side < 0 ? h : Math.floor(h * .76);
    const cx = side * offset, cz = side < 0 ? -2 : 1;
    for (let y = 1; y <= cy; y++) {
      const cap = y >= cy - 3;
      disc(v, cx, cz, y, y + 1, cap ? Math.max(1, r * (cy - y + 1) / 4) : r,
        (x, _y, z, d) => d < r - 1.3 && !cap && y % 5 !== 0 ? null :
          cap ? "#cf7a53" : y % 5 === 0 ? "#bcd3c7" : x === cx || z === cz ? steel : ["#478f9f", y % 10 < 4 && (x + z) % 3 === 0 ? .44 : 0]);
    }
  }
  const bridges = lv === 1 ? [3] : lv < 4 ? [.38, .67].map(n => Math.round(h * n)) :
    [.2, .44, .66].map(n => Math.round(h * n));
  for (const y of bridges) {
    v.hollowBox(-offset, y, -1, offset + 1, y + (lv < 4 ? 2 : 4), 2, "#aaccc4", "#d28a52");
    for (let x = -offset + 1; x < offset; x += 3) v.put(x, y + 1, 2, steel);
  }
  if (lv === 5) {
    for (const [x, y] of [[-offset, h], [offset, Math.floor(h * .76)]]) {
      v.box(x, y, -1, x + 1, y + 6, 0, cream);
      v.put(x, y + 6, -1, brass, .65);
    }
  }
}

function lanternOffices(c: Ctx): void {
  const { v, lv, hx } = c;
  const h = [10, 17, 26, 44, 60][lv - 1];
  const lobes = [1, 1, 2, 2, 3][lv - 1];
  const offset = (t: number) => lv >= 4 ? Math.round(hx * .31 * Math.sin(t * Math.PI * 1.6)) : 0;
  const maxR = hx * (lv >= 4 ? .69 : .85);
  sculpt(v, -hx, 1, -hx, hx, h + 1, hx, (_u, t, _w, x, y, z) => {
    const xx = x + .5 - offset(t), zz = z + 1;
    const waist = .28 + .72 * Math.pow(Math.abs(Math.sin(t * lobes * Math.PI)), .72);
    const r = maxR * waist;
    const d = Math.hypot(xx, zz * 1.2);
    if (d > r) return null;
    if (y === 1 || y === h || Math.abs(Math.sin(t * lobes * Math.PI)) < .2) return "#e2bc85";
    const a = Math.atan2(zz * 1.2, xx) * 2 / Math.PI;
    const diagonal = Math.min(Math.abs(Math.sin((a + t * lobes * 3) * Math.PI)),
      Math.abs(Math.sin((a - t * lobes * 3) * Math.PI)));
    if (diagonal < (hx < 10 ? .4 : .24)) return "#e8cda1";
    return y % 5 === 0 ? "#315d71" : ["#41939b", y % 9 < 4 && Math.cos(a * Math.PI) > .1 ? .34 : 0];
  });
  if (lv >= 2) {
    const crown = offset(1);
    disc(v, crown, -1, h + 1, h + 2, maxR * .5, "#b69367");
    for (const side of [-1, 1]) {
      beam(v, [crown + Math.round(maxR * .35) * side, h + 2, -1], [crown, h + 2 + lv, -1], "#e4c998");
    }
  }
}

export function buildings(c: Ctx): void {
  terrace(c, "#cec5b1");
  [spiralOffices, radiogramOffices, twinOffices, lanternOffices][c.variant](c);
  const { v, hz, lv } = c;
  v.box(-2, 1, 0, 2, 4, hz - 4, "#87a6a0");
  v.box(-3, 1, hz - 6, 3, 5, hz - 2, steel);
  glassFront(v, -2, 2, 1, 5, hz - 3, "#735b48", 3, "#f0c185");
  v.box(-4, 5, hz - 6, 4, 6, hz - 1, cream);
  v.box(-3, 5, hz - 2, 3, 6, hz - 1, cream, .7);
  person(v, 3, 1, hz - 2, "#c57656");
  if (lv >= 4) {
    for (let z = 3; z < hz; z += 3) {
      v.box(-3, 0, z, 4, 1, z + 1, "#b2a38b");
    }
    bench(v, -7, 1, hz - 3);
    bush(v, 7, 1, hz - 4, 2, "#71915c");
  }
}



function gardenWorks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const petals = lv + 1, h = 5 + lv;
  const rx = hx - 1, rz = hz - 2;
  sculpt(v, -hx, 1, -hz, hx, h + 3, hz - 1, (_u, _t, _w, x, y, z) => {
    const dx = (x + .5) / rx, dz = (z + 1) / rz;
    const radius = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const cycle = ((angle / (2 * Math.PI) * petals - radius * .39) % 1 + 1) % 1;
    if (radius < (lv === 1 ? .13 : .24) || radius > 1 || cycle > .74) return null;
    const roof = h - Math.floor(3 * radius) + Math.round(cycle * 3);
    if (y > roof) return null;
    if (y === roof) return cycle < .12 ? "#d4cd94" : "#6f9e7f";
    if (y === roof - 1) return cream;
    if (y === 1 || (x + z) % 5 === 0) return "#956a4a";
    return ["#a5c6ae", y <= 4 && (x + z) % 3 !== 0 ? .42 : 0];
  });
  v.box(0, 1, -1, 1, 5, 0, "#886840");
  v.sphere(0, 6, -1, lv < 3 ? 2 : 3, 2, 2, "#c28772");
  if (lv >= 3) {
    disc(v, 0, -1, 1, 2, 3, "#a7b8a1", 2);
    bench(v, 0, 1, 2);
  }
  if (lv >= 4) {
    const ring = lv === 4 ? 3 : 5;
    for (let i = 0; i < petals; i++) {
      const a = i * 2 * Math.PI / petals;
      const x = Math.round(Math.cos(a) * ring), z = Math.round(Math.sin(a) * ring) - 1;
      beam(v, [x, 5, z], [Math.round(x * 1.8), 6, Math.round(z * 1.8)], "#b98e63");
    }
  }
}

function draftingWorks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const x0 = -hx + 2, x1 = hx - (lv > 2 ? 6 : 2), back = -hz + 2, front = hz - 4;
  const tilt = [4, 7, 8, 11, 14][lv - 1];
  // An inhabited drafting board rests on two trestles. Blueprint lines and the
  // brass sliding T-square follow the same inclined surface.
  for (let z = back; z <= front; z++) {
    const y = 5 + Math.round((front - z) / (front - back) * tilt);
    const rule = z === back + 2 || z === front - 2;
    for (let x = x0; x < x1; x++) {
      const rim = x === x0 || x === x1 - 1 || z === back || z === front;
      const ruled = x === x0 + 2 || x === x1 - 3 || rule;
      const u = (x - x0) / (x1 - x0), w = (z - back) / (front - back);
      // An architectural plan printed on the board: a round stair and L-shaped walls.
      const roundStair = Math.abs(Math.hypot((u - .67) * 1.3, w - .42) - .18) < .045;
      const partition = (Math.abs(u - .43) < .035 && w > .35 && w < .7) ||
        (Math.abs(w - .7) < .04 && u > .40 && u < .83);
      const plan = roundStair || partition;
      v.put(x, y, z, rim ? "#a87549" : ruled ? "#89bcc7" : plan ? "#b6e0dd" : "#477a95");
      v.put(x, y - 1, z, "#75543b");
    }
    if (lv >= 2) v.box(x0 + 4, y + 1, z, x0 + 5, y + 2, z + 1, brass);
    if (z === back + 3 && lv >= 2) v.box(x0 + 1, y + 1, z, x0 + 8, y + 2, z + 1, cream);
  }
  if (lv >= 2) {
    const pencilZ = back + Math.min(4, front - back - 1);
    const pencilY = 6 + Math.round((front - pencilZ) / (front - back) * tilt);
    const left = x0 + 4, tip = Math.round(x1 * .7);
    v.box(left, pencilY, pencilZ, tip, pencilY + 2, pencilZ + 2, "#f4b545");
    v.box(left, pencilY, pencilZ, left + 2, pencilY + 2, pencilZ + 2, "#cb7278");
    v.put(tip, pencilY, pencilZ, cream);
    v.put(tip + 1, pencilY, pencilZ, steel);
  }
  for (const x of [x0 + 1, x1 - 2]) {
    beam(v, [x, 1, front - 1], [x, 5 + tilt - 1, back + 1], "#bc895a");
    beam(v, [x, 1, back], [x, 5, front - 1], "#deb280");
  }
  glassFront(v, x0 + 2, x1 - 2, 1, 5, front - 1, steel, 4, "#abbfb0");
  if (lv >= 3) {
    const x = x1 + 1, r = lv === 3 ? 2 : 3;
    for (let z = back + 2; z < front; z += r * 2 + 1) {
      const y = 5 + (z === back + 2 ? lv : 0);
      v.cylinderY(x, z, 1, y, r, "#dcc698");
      disc(v, x, z, y, y + 1, r, "#ece1b6");
      disc(v, x, z, y + 1, y + 2, r - 1, "#a88e60", r - 2);
    }
  }
  if (lv >= 4) {
    v.box(x0 + 3, 2, front + 1, x1 - 2, 3, front + 3, "#b48157");
    person(v, x0 + 5, 1, front + 3, "#3e697d");
    if (lv === 5) {
      bulbs(v, x0 + 3, front + 1, x1 - 2, front + 1, 5);
      const z = Math.round((back + front) / 2);
      const y = 6 + Math.round((front - z) / (front - back) * tilt);
      beam(v, [-3, y, z], [1, y + 7, z], "#efbf78", 2);
      beam(v, [1, y + 7, z], [7, y, z], "#efbf78", 2);
      v.box(-3, y, z, 9, y + 2, z + 2, "#efbf78");
    }
  }
}

function carriageWorks(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  function car(x0: number, x1: number, z: number, y: number, color: string): void {
    for (const x of [x0 + 2, x1 - 3]) for (const wz of [z - 2, z + 2]) {
      v.ringZ(x, y + 1, wz, wz + 1, 1.6, 0, steel);
      v.put(x, y + 1, wz + 1, "#9c9383");
    }
    for (let dz = -3; dz <= 3; dz++) {
      const top = y + 8 - Math.floor(Math.abs(dz) / 1.6);
      const inset = Math.abs(dz) === 3 ? 1 : 0;
      for (let x = x0 + inset; x < x1 - inset; x++) {
        v.put(x, top, z + dz, x % 5 === 0 ? "#b4b9ae" : "#738080");
        if (Math.abs(dz) < 3 && x > x0 + 1 && x < x1 - 2) continue;
        for (let yy = y + 2; yy < top; yy++) {
          const window = yy > y + 3 && yy < y + 6 && (x - x0) % 4 !== 0;
          v.put(x, yy, z + dz, window ? "#b8d9cc" : yy === y + 3 ? cream : color, window && (x - x0) % 8 < 4 ? .53 : 0);
        }
      }
    }
  }
  const back = lv >= 4 ? -hz + 6 : -2;
  const front = lv >= 4 ? hz - 7 : back + 5;
  for (const z of [back - 2, back + 2]) v.box(-hx + 1, 1, z, hx - 1, 2, z + 1, steel);
  car(-hx + 2, lv >= 3 ? 3 : hx - 2, back, 2, "#ac5847");
  if (lv >= 2) {
    const platform = back + 4;
    v.box(-hx + 1, 1, platform, hx - 1, 3, platform + 2, "#be9d72");
    v.box(-3, 3, platform - 1, 1, 7, platform, steel);
    const roof = 11;
    v.box(-hx + 3, roof, back - 1, Math.min(1, hx - 3), roof + 1, back + 3, "#c8aa75");
    bush(v, -hx + 4, roof + 1, back, 1.5, "#819564");
    person(v, -hx + 6, roof + 1, back + 1, "#b97768");
  }
  if (lv >= 3) car(4, hx - 1, back, 2, "#4d8990");
  if (lv >= 4) {
    car(-hx + 3, hx - 4, front, 2, "#63968b");
    const z0 = back + 2, z1 = front - 1;
    v.box(-1, 8, z0, 3, 9, z1, "#c1a57b");
    for (const x of [-1, 2]) {
      v.box(x, 10, z0, x + 1, 11, z1, cream);
      for (let z = z0; z < z1; z += 3) v.put(x, 9, z, steel);
    }
  }
  if (lv === 5) {
    car(-hx + 4, -2, back, 9, "#dfac63");
    person(v, 0, 9, back + 4, "#415761");
  }
}

function paperclipWorks(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  const rx = hx - 2, z = -hz + Math.max(3, Math.floor(hz * .6));
  const h = [11, 15, 16, 22, 28][lv - 1];
  // Trace a bent continuous strip twice, with an open throat and a nested return.
  const outline: [number, number][] = [[-.82,.15],[-.82,.70],[-.62,.94],[-.33,1],
    [.55,1],[.86,.84],[.94,.62],[.94,.26],[.72,.07],[.44,.04],[-.38,.04],[-.56,.22],
    [-.56,.55],[-.40,.72],[.39,.72],[.55,.57],[.55,.35],[.4,.27],[-.22,.27]];
  const loop = (cz: number, color: string) => {
    const points: Point3[] = outline.map(([x, y]) => [Math.round(x * rx), 1 + Math.round(y * h), cz]);
    for (let i = 1; i < points.length; i++) beam(v, points[i - 1], points[i], color, lv >= 3 ? 2 : 1);
  };
  loop(z, "#a1c0bf");
  const front = lv >= 3 ? z + Math.round(hz * .64) : z + 3;
  loop(front, "#e0dcae");
  const floors = lv === 1 ? 1 : lv < 4 ? 2 : lv - 1;
  for (let i = 0; i < floors; i++) {
    const y = 1 + i * 4, x0 = -Math.round(rx * .6) + i, x1 = Math.round(rx * .76) - i;
    v.box(x0, y, z, x1, y + 1, front + 1, "#ae7558");
    v.box(x1 - 2, y + 1, z, x1, y + 4, front, "#668d84", i === 0 ? .54 : .18);
    v.box(x0 + 1, y + 2, z + 1, x0 + 4, y + 3, z + 3, cream, .5);
    v.put(x0 + 2, y + 3, z + 1, steel);
  }
  if (lv >= 4) {
    const rear = -hz + 2;
    v.box(-rx + 2, 1, rear, rx - 2, 3, z - 1, "#b47f64");
    for (let x = -rx + 4; x < rx - 3; x += 6) {
      v.ringZ(x, 5, rear, rear + 2, 3, 2, "#91b1b4");
    }
  }
}

export function businesses(c: Ctx): void {
  terrace(c, "#c9c0a3");
  [gardenWorks, draftingWorks, carriageWorks, paperclipWorks][c.variant](c);
  person(c.v, -3, 1, c.hz - 2, "#bd7054", "charcoal", "#a67457");
  if (c.lv >= 3) {
    person(c.v, 3, 1, c.hz - 3, "#5a879b");
    bench(c.v, c.hx - 6, 1, c.hz - 2);
  }
}



/** A counter with a lit till and alternating stacks of goods. */
function counter(v: PixelVox, x: number, y: number, z: number, length: number, cloth: string): void {
  v.box(x, y, z, x + length, y + 2, z + 2, cloth);
  for (let i = 1; i < length - 2; i += 2) {
    v.put(x + i, y + 2, z, i % 4 === 1 ? brass : "#d77e75");
    v.put(x + i, y + 2, z + 1, cream);
  }
  v.put(x + length - 2, y + 2, z, steel);
  v.put(x + length - 2, y + 3, z, "#b4d8ca", .3);
}

/** The front counter sits inside the lens hood. Developing and print services grow behind it. */
function cameraLane(c: Ctx): void {
  const { v, lv, hx, hz } = c;
  const leather = "#9f503e", alloy = "#a5b6ad", black = "#35414a";
  const x = lv === 1 ? 0 : -Math.round(hx * .43);
  const back = -hz + 2, front = lv < 3 ? 3 : -2;
  const r = [4, 5, 6, 7, 8][lv - 1], cy = r + 2;
  // An open folding-camera back, with a raised finder and a shutter release.
  const body = plate(x, back + 2, r + 2, 3, .42);
  storey(v, body, body, 1, cy + 4, leather, alloy);
  v.box(x - 3, cy + 4, back, x + 2, cy + 6, back + 3, black);
  v.box(x - 2, cy + 5, back + 2, x + 1, cy + 6, back + 3, "#a8d2cd", .45);
  v.cylinderY(x + r - 1, back + 2, cy + 4, cy + 6, 1.5, brass);
  // The alternating, tapered square folds expose the focusing rail from above.
  for (let z = back + 4; z < front; z++) {
    const t = (z - back - 4) / Math.max(1, front - back - 4);
    const half = r + 1 - Math.floor(2 * t) - (z % 2 === 0 ? 1 : 0);
    const color = z % 2 === 0 ? "#5a383b" : "#985f52";
    v.hollowBox(x - half, cy - half + 1, z, x + half + 1, cy + half, z + 1, color);
  }
  for (const side of [-1, 1]) {
    beam(v, [x + side * (r - 1), 1, back + 1], [x + side * (r - 1), 2, front + 2], alloy);
  }
  // A recessed night-lit aperture leaves room for the clerk and the photo counter.
  v.ringZ(x, cy, front - 1, front + 1, r, 0, "#466a75");
  v.ringZ(x, cy, front, front + 2, r, r - 1, alloy);
  v.ringZ(x, cy, front + 1, front + 3, r - 1, r - 2, black);
  v.ringZ(x, cy, front, front + 1, r - 2, Math.max(1, r - 3), "#7dbaba", .65);
  v.put(x - 1, cy + 1, front + 1, cream, .65);
  v.put(x, cy + 2, front + 1, "#c1d8dd", .35);
  const desk = Math.min(8, 3 + lv);
  counter(v, x - 2, 1, front + 2, desk, "#93704c");
  person(v, x + 2, 1, front + 1, "#8d6072");
  if (lv >= 2) {
    // The camera's leather carrying case opens into a glass print showroom.
    const left = x + r + 1, right = hx - 2;
    const showroom = plate((left + right)/2, back + 4, (right - left)/2, 4, .3);
    storey(v, showroom, showroom, 1, 6, "#8aadad", black);
    const stand = Math.round((left + right)/2);
    for (const side of [-1, 1]) {
      beam(v, [stand + side * 3, 6, back + 2], [stand + side, 11, back + 2], "#ad8860");
    }
    v.box(stand - 3, 10, back + 1, stand + 3, 13, back + 4, leather);
    v.ringZ(stand, 11, back + 4, back + 6, 2, 1, alloy);
    glassFront(v, left + 1, right - 1, 2, 5, back + 7, "#685650", 4, "#d9ba8f");
  }
  if (lv >= 3) {
    // Perforated color film undulates above a row of print and restoration counters.
    const left = x + Math.floor(r * .6), right = hx - 3;
    const colors = ["#dda961", "#79b0ad", "#bc879c"];
    for (let xx = left; xx < right; xx++) {
      const i = xx - left, phase = i / (right - left - 1);
      const z = Math.round(hz * .4 + Math.sin(phase * Math.PI * 2) * 2);
      const y = 7 + Math.round(Math.sin(phase * Math.PI) * (lv + 1));
      const spoke = i % 7;
      for (let j = 0; j < 6; j++) {
        if ((j === 0 || j === 5) && spoke % 3 === 1) continue;
        const edge = j === 0 || j === 5 || spoke === 0;
        const stock = colors[Math.floor(i / 7) % 3];
        const mountain = j === 1 || (j === 2 && spoke >= 3 && spoke <= 5) || (j === 3 && spoke === 4);
        const print = spoke === 1 && j === 4 ? cream : mountain ? "#587979" : stock;
        v.box(xx, y + j, z, xx + 1, y + j + 1, z + 2, edge ? black : print, edge ? 0 : .3);
      }
      if (spoke === 0) {
        v.box(xx, 1, z, xx + 1, y + 1, z + 1, alloy);
        counter(v, xx - 1, 1, z + 1, 5, leather);
      }
    }
  }
  if (lv >= 4) {
    const count = lv === 4 ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const cx = Math.round(hx * .34) + (i % 2 ? 7 : 0), cz = back + 4 + i * 5;
      const radius = i === 0 ? 5.2 : 4, top = 9 + 3 * i;
      disc(v, cx, cz, 1, top, radius, (_xx, yy, _zz, d) => {
        if (d < radius - 1.2 && yy > 1) return null;
        return yy % 6 < 2 ? "#e2b675" : "#9c664b";
      });
      disc(v, cx, cz, top, top + 2, radius + 1, alloy);
      for (let k = 0; k < 5; k++) {
        const angle = k * 2 * Math.PI / 5;
        const xx = Math.round(cx + Math.cos(angle) * radius * .55);
        const zz = Math.round(cz + Math.sin(angle) * radius * .55);
        v.box(xx - 1, top + 1, zz, xx + 1, top + 2, zz + 2, black);
      }
      v.put(cx, top + 2, cz, brass);
    }
  }
  if (lv === 5) {
    // Walk under a chamfered viewfinder frame and through to the film promenade.
    const z = hz - 6, h = 18, w = 11;
    const frame: [number, number][] = [[-w,1],[-w,h-3],[-w+3,h],[w-3,h],[w,h-3],[w,1]];
    for (let i = 1; i < frame.length; i++) {
      const [ax, ay] = frame[i-1], [bx, by] = frame[i];
      beam(v, [ax, ay, z], [bx, by, z], black, 3);
      beam(v, [ax, ay + 1, z + 3], [bx, by + 1, z + 3], alloy);
    }
    for (const side of [-1, 1]) {
      v.box(side * (w - 2), h - 5, z, side * (w - 2) + 1, h - 2, z + 1, "#b4d9d5", .5);
      beam(v, [side * (w - 2), h - 2, z], [side * (w - 4), h - 2, z], "#b4d9d5", 1, .5);
    }
    v.box(-w + 2, 0, z - 3, w, 1, hz, "#b9b7a5");
  }
}

function parasolCourt(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  const sites: [number, number, number, string][] = lv === 1 ? [[0,-1,6,"#cb715e"]] :
    [[-.47,-.21,.48,"#c76d5f"], [.49,-.2,.42,"#528d8d"],
      ...(lv >= 3 ? [[-.28,.45,.35,"#c99c56"]] : []),
      ...(lv >= 4 ? [[.52,.44,.3,"#957aab"]] : []),
      ...(lv >= 5 ? [[.02,-.6,.34,"#668c61"]] : [])] as [number, number, number, string][];
  for (let i = 0; i < sites.length; i++) {
    const [u, w, size, fabric] = sites[i];
    const x = lv === 1 ? 0 : Math.round(u * hx), z = lv === 1 ? -1 : Math.round(w * hz);
    const radius = lv === 1 ? size : Math.max(4, Math.round(Math.min(hx, hz + 5) * size));
    const y = 5 + (lv >= 3 && i === 0 ? lv : 0);
    v.box(x, 1, z, x + 1, y + radius, z + 1, "#816043");
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      const a = Math.atan2(dz, dx), sectors = (a + 2 * Math.PI) * 4 / Math.PI;
      const d = Math.hypot(dx, dz);
      const edge = radius * (.90 + .1 * Math.cos(sectors * Math.PI * 2));
      if (d > edge) continue;
      const roof = y + Math.round((1 - d / radius) * radius * .61);
      v.put(x + dx, roof, z + dz, Math.floor(sectors) % 2 === 0 ? fabric : cream);
      if (d >= edge - 1) v.put(x + dx, roof - 1, z + dz, fabric, dz >= 0 && (dx + dz) % 2 === 0 ? .76 : 0);
    }
    v.put(x, y + Math.round(radius * .61) + 1, z, brass);
    counter(v, x - Math.floor(radius * .6), 1, z + 2, Math.max(4, radius), fabric);
  }
  if (lv >= 3) {
    for (let x = -hx + 2; x < hx - 1; x += 3) v.put(x, 0, 1, "#9e8367");
    if (lv >= 4) bench(v, -3, 1, hz - 5);
    if (lv === 5) {
      disc(v, 1, 3, 1, 2, 4.5, "#ab8061", 2.5);
      bush(v, 1, 2, 3, 2.4, "#72915b", "#d4978e");
    }
  }
}

function stairMarket(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  const steps = lv + 2, x0 = -hx + 1, x1 = hx - 2;
  const width = (x1 - x0) / steps;
  const colors = ["#668d8d", "#c57b60", "#daae65", "#ad7d88"];
  for (let i = 0; i < steps; i++) {
    const left = x0 + Math.round(width * i), right = x0 + Math.round(width * (i + 1));
    const y = 2 + i * (lv === 1 ? 1 : lv < 4 ? 2 : 3);
    const front = Math.round(hz * .38) - (lv >= 3 && i % 2 ? 3 : 0);
    const rear = Math.round(-hz * .8);
    v.hollowBox(left, 1, rear, right, y + 1, front, "#ba8462");
    if (y > 4) {
      // Display arcades along the exposed side of the highest steps.
      for (let z = rear + 2; z < front - 1; z++) {
        for (let yy = 2; yy < y - 1; yy++) {
          const mullion = (z - rear) % 5 === 0 || yy % 5 === 0;
          v.put(right - 1, yy, z, mullion ? "#977252" : "#849e90", mullion ? 0 : .15);
        }
        if (i === steps - 1 && (z - rear) % 5 < 3) v.put(right, y - 1, z, cream);
      }
    }
    v.box(left, y, rear, right, y + 1, front + 1, "#e0c59c");
    glassFront(v, left, right, 1, y, front, "#72635d", 4, "#b6c7ac");
    for (let x = left; x < right; x++) {
      const drop = Math.floor((right - x - 1) / Math.max(1, width / 3));
      v.box(x, 1, front + 1, x + 1, Math.max(2, y - drop), front + 3, "#c2926e");
    }
    const fabric = colors[i % colors.length];
    const col = Math.floor((left + right) / 2);
    v.box(col, y + 1, rear + 2, col + 1, y + 6, rear + 3, steel);
    for (let z = rear + 1; z < Math.min(front - 1, rear + (lv < 3 ? 6 : 10)); z++) {
      const slope = Math.max(0, 2 - Math.floor((z - rear) / 2));
      v.box(left, y + 4 + slope, z, right, y + 5 + slope, z + 1, (z - rear) % 4 === 0 ? cream : fabric);
    }
    counter(v, left, y + 1, Math.min(rear + 5, front - 2), Math.max(3, right - left - 1), fabric);
    if (lv >= 3) {
      const walk = front - 3, rise = lv >= 4 ? 3 : 2;
      for (let j = 0; j < rise; j++) {
        v.box(right - rise + j, y + 1, walk - 1, right - rise + j + 1, y + 2 + j, walk + 2, "#d6ac7e");
      }
      if (i % 2 === 0) bush(v, left + 1, y + 1, walk - 2, 1.5, "#738d64", "#d98c77");
      else person(v, left + 1, y + 1, walk - 2, fabric);
    }
  }
  if (lv >= 3) {
    const z = hz - 3;
    for (let x = -hx + 2; x < hx - 3; x += 8) {
      counter(v, x, 1, z, 5, "#b28560");
      person(v, x + 1, 1, z - 1, "#58827f");
    }
  }
  if (lv >= 4) {
    v.box(x1 - 2, 1, -hz + 1, x1 - 1, 7 + steps * 3, -hz + 2, steel);
    v.box(x1 - 1, 4 + steps * 3, -hz + 1, x1 + 1, 7 + steps * 3, -hz + 2, "#dc8a5e");
  }
}

function lanternBoutiques(c: Ctx): void {
  const { lv, v, hx, hz } = c;
  function lantern(cx: number, cz: number, r: number, y: number, glass: string): void {
    const tall = r * 2;
    v.cylinderY(cx, cz, 1, y + 1, r * .5, "#805748");
    for (let j = 0; j < tall; j++) {
      const t = (j + .5) / tall;
      const radius = r * (.42 + .58 * Math.sin(Math.PI * t) ** .6);
      disc(v, cx, cz, y + j, y + j + 1, radius, (_x, _yy, _z, d, a) => {
        if (d < radius - 1.3 && j > 0 && j < tall - 1) return null;
        if (j < 2 || j >= tall - 2 || j === Math.floor(tall * .5)) return "#ac7652";
        return Math.abs(Math.sin(a * 4)) < .33 ? "#794e4e" : [glass, .19];
      });
    }
    const crown = y + tall;
    disc(v, cx, cz, crown, crown + 1, r * .63, steel);
    v.ringZ(cx, crown + 2, cz - 1, cz, Math.max(2, r * .37), Math.max(1, r * .37 - 1), brass);
    counter(v, cx - 2, 1, cz + Math.floor(r * .7), 5, "#9c6356");
  }
  if (lv === 1) lantern(0, -1, 5, 2, "#eaa663");
  else {
    const largest = Math.round(Math.min(hx, hz + 4) * .39);
    lantern(-Math.round(hx * .45), -Math.round(hz * .32), largest + 1, 2 + lv, "#dfa263");
    lantern(Math.round(hx * .45), -Math.round(hz * .08), largest, 2, "#8baea0");
    if (lv >= 3) lantern(-1, Math.round(hz * .48), Math.max(4, largest - 2), 2, "#bf8b9d");
    if (lv >= 4) {
      for (const x of [-hx + 3, hx - 4]) {
        v.box(x, 1, -hz + 3, x + 2, largest * 2 + 6, -hz + 5, steel);
        beam(v, [x, largest * 2 + 2, -hz + 3], [Math.round(x * .7), largest * 2 + 8, -hz + 3], brass);
      }
      v.box(-hx + 3, largest * 2 + 8, -hz + 3, hx - 2, largest * 2 + 10, -hz + 5, steel);
      bulbs(v, -hx + 5, -hz + 4, hx - 5, -hz + 4, largest * 2 + 7);
    }
    if (lv === 5) {
      lantern(Math.round(hx * .58), Math.round(hz * .55), largest - 3, 4, "#c7b575");
      lantern(1, -hz + 5, largest - 4, 6, "#a29fbd");
    }
  }
}

export function shops(c: Ctx): void {
  terrace(c, "#d9c7a5");
  [cameraLane, parasolCourt, stairMarket, lanternBoutiques][c.variant](c);
  person(c.v, 2, 1, c.hz - 2, "#777eae", "#5b514d", "#be8b68");
  if (c.lv >= 3) {
    person(c.v, -3, 1, c.hz - 3, "#ba6e59");
    c.v.box(-5, 1, c.hz - 3, -4, 3, c.hz - 2, "#78a195");
  }
}
