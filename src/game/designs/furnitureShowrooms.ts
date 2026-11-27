import { type Ctx, type PixelVox, bench, door, lamp, person } from "./kit";
import { disc, glassFront, sculpt } from "./commerceKit";

const walnut = "#825438", ash = "#d8ad75", brass = "#d99b50";
const velvet = "#39766c", piping = "#9bc5a2", coral = "#d97d69", ivory = "#fff0cc";

// Upholstered volumes have softened corners and welted edges, built as hollow voxel skins.
function cushion(v: PixelVox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, fabric: string, seam: string) {
  sculpt(v, x0, y0, z0, x1, y1, z1, (u, h, w) => {
    const a = Math.abs(u * 2 - 1), b = Math.abs(h * 2 - 1), d = Math.abs(w * 2 - 1);
    if (a ** 5 + b ** 5 + d ** 5 > 1.15) return null;
    return b > .55 && b < .85 && (a > .8 || d > .8) ? seam : fabric;
  });
}

function wingback(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = Math.min(hx - 3, 5 + lv * 2), d = Math.min(hz - 2, 3 + 2 * lv);
  const seat = 4 + lv, back = 10 + 3 * lv, cz = -Math.floor(hz * .13);
  for (const x of [-w + 1, w - 2]) for (const z of [cz - d + 1, cz + d - 2]) {
    v.box(x, 1, z, x + 2, seat, z + 2, walnut);
    v.box(x, 1, z, x + 2, 2, z + 2, brass);
  }
  cushion(v, -w, seat - 1, cz - d, w, seat + 3, cz + d, velvet, piping);
  // A high button-tufted back and swept wing cushions wrap the reading gallery.
  cushion(v, -w + 1, seat + 1, cz - d - 1, w - 1, back, cz - d + 3, velvet, piping);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -w : w - 3;
    for (let dz = 0; dz < d * 2; dz++) {
      const h = seat + 4 + Math.max(0, Math.floor((back - seat - 5) * (1 - dz / d)));
      v.box(x0, seat, cz - d + dz, x0 + 3, h, cz - d + dz + 1, velvet);
      v.put(x0 + 1, h, cz - d + dz, piping);
    }
    v.box(x0, seat + 2, cz + d - 1, x0 + 3, seat + 4, cz + d, piping);
  }
  for (let y = seat + 5; y < back - 1; y += 3) for (let x = -w + 4 + y % 2; x < w - 3; x += 4) {
    v.put(x, y, cz - d + 2, "#c6bf8a");
  }
  v.hollowBox(-w + 3, 1, cz - d + 1, w - 3, seat - 1, cz + d - 2, walnut);
  glassFront(v, -w + 3, w - 3, 1, seat - 1, cz + d - 2, walnut, 4, "#ffd69d");
  door(v, -1, 1, cz + d - 2, walnut, 2, 3, false);
  if (lv >= 2) {
    const sx = w + 2, sz = cz + 2;
    v.box(sx - 1, 1, sz - 1, sx + 2, 5, sz + 2, walnut);
    disc(v, sx, sz, 5, 6, 3, ash);
    v.box(sx, 6, sz + 1, sx + 2, 7, sz + 2, coral);
    lamp(v, sx, 6, sz, 3, brass, ivory);
  }
  if (lv >= 3) {
    // A little stair to the furniture-sized public reading terrace.
    for (let s = 0; s < seat; s++) {
      const x = -w + s;
      v.box(x, 1, cz + d, x + 1, s + 2, cz + d + 3, ash);
    }
    bench(v, -3, seat + 3, cz, "x", walnut);
    person(v, 1, seat + 3, cz, coral);
  }
  if (lv >= 4) {
    v.box(-w + 3, seat + 4, cz - d, -w + 7, seat + 5, cz + 1, ash);
    v.box(w - 7, seat + 4, cz - d, w - 3, seat + 5, cz + 1, ash);
    for (const x of [-w + 5, w - 6]) person(v, x, seat + 5, cz - 2, "#c7b47d");
  }
  if (lv === 5) {
    // A pair of curved wingback galleries curl forward above the seat, separated by a reading stair.
    for (const s of [-1, 1]) for (let i = 0; i < d; i++) {
      const x = s * (w - 2 - Math.floor(3 * Math.sin(i / d * Math.PI)));
      const y = back - 2 - Math.floor(i * .6);
      v.box(x - 2, y - 1, cz - d + i, x + 2, y + 2, cz - d + i + 1, velvet);
      v.put(x, y + 2, cz - d + i, piping);
    }
    for (let i = 0; i < 3; i++) {
      v.box(-5, seat + 2 + i, cz - i * 3, 5, seat + 3 + i, cz - i * 3 + 2, ash);
    }
  }
}

function sofa(v: PixelVox, cx: number, y: number, cz: number, w: number, depth: number, fabric: string, seam: string, sideways = false) {
  const h = Math.max(4, Math.round(depth * .72));
  // Work in the sofa's axes; the right-angle pieces are real sectionals.
  function piece(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string) {
    if (sideways) cushion(v, cx - z1, y + y0, cz + x0, cx - z0, y + y1, cz + x1, color, seam);
    else cushion(v, cx + x0, y + y0, cz + z0, cx + x1, y + y1, cz + z1, color, seam);
  }
  piece(-w, 0, -depth, w, 2, depth, walnut);
  piece(-w, 2, -depth, w, h + 4, -depth + 3, fabric);
  for (const x of [-w, w - 3]) piece(x, 2, -depth + 1, x + 3, h + 2, depth, fabric);
  for (let k = 0; k < 3; k++) {
    const left = Math.round(-w + 3 + k * (2 * w - 6) / 3);
    const right = Math.round(-w + 3 + (k + 1) * (2 * w - 6) / 3);
    piece(left, 2, -depth + 3, right, h, depth - 1, fabric);
    if (right - left > 2) piece(left, h, -depth + 2, right, h + 3, -depth + 4, k === 1 ? ivory : seam);
  }
}

function sectionalStories(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = Math.min(hx - 2, 5 + lv * 3), d = Math.min(hz - 3, 3 + lv);
  const cz = -Math.floor(hz * .18);
  const foot = 3 + Math.floor(lv / 2);
  for (const x of [-w + 1, w - 3]) for (const z of [cz - d + 1, cz + d - 2]) v.box(x, 1, z, x + 2, foot, z + 2, walnut);
  sofa(v, 0, foot, cz, w, d, coral, "#f0b28a");
  if (lv >= 2) sofa(v, w - 3, 1, cz + d, d, 3, "#8fa9ba", ivory, true);
  if (lv >= 3) {
    const raised = foot + Math.max(4, Math.round(d * .72)) + 3;
    sofa(v, -Math.floor(w * .33), raised, cz - 2, d, 4, "#809999", ivory, true);
    for (let i = 0; i < raised - 1; i++) {
      const xx = -w + i;
      v.box(xx, 1, cz + d + 1, xx + 1, 2 + i, cz + d + 4, walnut);
      v.put(xx, i + 1, cz + d + 3, ash);
    }
  }
  if (lv >= 4) {
    const left = -w + 1;
    v.hollowBox(left, 1, cz - d + 2, left + 12, foot + 1, cz + d, walnut);
    glassFront(v, left + 1, left + 11, 1, foot, cz + d - 1, walnut, 3, ivory);
    sofa(v, w - 5, foot + 8, cz - d + 1, 7, 3, "#bb9e5d", ivory);
  }
  if (lv === 5) {
    const raised = foot + 14;
    sofa(v, -5, raised, cz - 3, 9, 4, "#db9c70", ivory);
    const x = Math.floor(w * .52);
    sofa(v, x, 1, cz + d + 9, 8, 4, "#48857d", piping, true);
    person(v, 0, foot + 6, cz, "#735293");
  }
}

function cartonStudio(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const w = Math.min(hx - 6, 3 + 2 * lv), d = Math.min(hz - 4, 3 + lv);
  const z = -Math.floor(hz * (lv >= 2 ? .38 : .13)), h = 4 + lv, flap = lv + 2;
  // Four creased flaps fold independently. The street-facing flap lies down as a walk-in ramp.
  v.hollowBox(-w, 1, z - d, w, h + 1, z + d, "#c89052", "#a17147");
  v.clear(-w + 1, h, z - d + 1, w - 1, h + 2, z + d - 1);
  v.clear(-2, 1, z + d - 1, 2, h, z + d);
  // One upright carton lid doubles as a furniture assembly diagram. Its bold crease points
  // into the open box and the gilt fastener heads make the printed chair readable at the counter.
  const panelWidth = Math.min(w * 2 - 2, 6 + lv * 2);
  const panelX = -w + 1, lidZ = z - d + 1;
  for (let row = 0; row < h + 6; row++) {
    const zz = lidZ - Math.floor(row / 5);
    v.box(panelX, h + row, zz, panelX + panelWidth, h + row + 1, zz + 1,
      row === h + 5 ? "#976535" : row % 5 === 0 ? "#d2a66e" : "#e5bc85");
    for (let x = 2; x < panelWidth - 1; x++) {
      const isBack = x === 2 && row > 4 && row < h + 3, isSeat = row === 4,
        isLeg = (x === 3 || x === panelWidth - 2) && row >= 1 && row < 4;
      if (isBack || isSeat || isLeg) v.put(panelX + x, h + row, zz + 1, "#695438");
    }
  }
  for (let i = 0; i < flap; i++) {
    const color = i % 3 === 0 ? "#dfbd80" : "#cca366";
    v.box(-w - i - 1, h + Math.floor(i * .6), z - d, -w - i, h + Math.floor(i * .6) + 1, z + d, color);
    v.box(w + i, h + Math.floor(i * .9), z - d, w + i + 1, h + Math.floor(i * .9) + 1, z + d, color);
    v.box(-w + 1, h + i, z - d - Math.floor(i * .4), w - 1, h + i + 1, z - d - Math.floor(i * .4) + 1, color);
    v.box(-w + 2, h - i, z + d + i - 1, w - 2, h - i + 1, z + d + i, color);
  }
  // Draw the folds and shipping label on the actual box, not on a sign.
  for (const x of [-w + 2, w - 3]) v.box(x, 1, z + d - 1, x + 1, h + 1, z + d, "#764e35");
  v.box(w - 4, 3, z + d - 1, w - 1, 5, z + d, ivory);
  person(v, -1, 1, z + d, "#759f8c");
  sofa(v, 0, 2, z - 1, Math.max(4, Math.floor(w * .65)), Math.max(3, d - 3), "#7aa97a", ivory);
  if (lv >= 2) {
    for (const x of [-w + 1, w - 2]) {
      v.box(x, h + 1, z - 2, x + 1, h + 8, z - 1, walnut);
      v.put(x, h + 8, z - 2, brass);
    }
    v.box(-w, h + 8, z - 3, w, h + 9, z, ash);
    // Flat-packed stock waits on a timber handcart at the front of the shop.
    const mx = hx - 7, mz = hz - 6;
    for (const xx of [mx - 2, mx + 1]) v.box(xx, 1, mz, xx + 1, 3, mz + 1, "rubber");
    v.box(mx - 3, 2, mz - 2, mx + 3, 3, mz + 2, walnut);
    for (let i = 0; i < Math.min(3, lv - 1); i++) {
      v.box(mx - 3 + i % 2, 3 + i, mz - 2, mx + 3, 4 + i, mz + 2, i % 2 ? "#d7ab72" : "#bb8857");
      v.put(mx, 3 + i, mz + 1, ivory);
    }
  }
  if (lv >= 3) {
    const top = h + 12;
    // The two asymmetrical face-frame parts are suspended at different stages of assembly.
    v.box(w - 2, h + 1, z - 4, w, top + 1, z - 3, ash);
    v.box(w - 4, h + 2, z - 4, w, h + 3, z - 1, ash);
    for (const x of [-w + 2, w - 3]) v.box(x, h + 8, z - 3, x + 1, top, z - 2, "#56837a");
    v.box(-w + 1, top, z - 5, w - 1, top + 1, z + 1, "#4b8d7d");
    for (let xx = -w + 3; xx < w - 2; xx += 4) v.put(xx, top + 1, z - 3, brass);
  }
  if (lv >= 4) {
    // A loose slotted panel becomes the second display room behind the parcel.
    const rz = Math.max(6 - hz, z - d - 5);
    v.hollowBox(-w + 1, 1, rz - 4, w - 1, 7, rz, "#75a496", ash);
    for (let xx = -w + 3; xx < w - 2; xx += 4) v.clear(xx, 3, rz - 4, xx + 2, 6, rz);
    v.box(-w, 7, rz - 5, w, 8, rz + 2, ash);
    bench(v, -2, 1, z + d + flap + 1, "x", walnut);
  }
  if (lv === 5) {
    // Exploded shelf held by two visibly separate clamp jaws and a rising timber spine.
    const rz = Math.max(7 - hz, z - d - 4);
    for (const x of [-w + 2, w - 4]) {
      v.box(x, 8, rz, x + 2, h + 18, rz + 2, "#4b8d7d");
      v.box(x, h + 17, rz, x + 2, h + 19, z - 3, ash);
    }
    v.box(-w + 1, h + 18, z - 6, w - 1, h + 19, z - 1, "#e3ad72");
  }
}

function arm(v: PixelVox, x0: number, y0: number, z: number, x1: number, y1: number) {
  const steps = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / steps), y = Math.round(y0 + (y1 - y0) * i / steps);
    for (const zz of [z - 1, z + 1]) v.box(x - 1, y, zz, x + 1, y + 2, zz + 1, "#728d79");
  }
  for (const [x, y] of [[x0, y0], [x1, y1]]) {
    v.box(x - 1, y - 1, z - 2, x + 2, y + 2, z + 3, walnut);
    v.put(x, y, z + 2, brass, .25);
  }
}

function shade(v: PixelVox, x: number, z: number, y: number, r: number, height: number) {
  for (let i = 0; i < height; i++) {
    const radius = r * (1 - .55 * i / height);
    disc(v, x, z, y + i, y + i + 1, radius, (_x, _y, _z, _d, a) => {
      if (i === 0 || i === height - 1) return walnut;
      return Math.sin(a * 16) > .5 ? "#edb967" : [ivory, .45];
    }, Math.max(0, radius - 1.4));
  }
  disc(v, x, z, y - 1, y, Math.max(1, r * .32), () => [lit, .7]);
}

const lit = "#ffe9ac";

function lampLoft(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = Math.min(hz - 3, 3 + lv), x = -Math.floor(hx * .35), z = -Math.floor(hz * .15);
  const base = 3 + lv, elbow = base + 4 + lv, top = base + 8 + lv * 3;
  disc(v, x, z, 1, 2, r + 2, walnut);
  disc(v, x, z, 2, base, r + 1, (_x, y, _z, d, a) => {
    return d > r - .5 && y < base - 1 && Math.cos(a * 7) > .05 ? [lit, .6] : "#648978";
  });
  v.box(x - 1, 1, z + r, x + 2, base, z + r + 1, walnut);
  const hinge = Math.max(-hx + 3, x - 2 - lv), head = Math.min(hx - r - 2, x + 7 + lv * 3);
  arm(v, x, base, z, hinge, elbow);
  arm(v, hinge, elbow, z, head, top);
  shade(v, head, z, top - 2 - lv, r, 3 + lv);
  if (lv >= 2) {
    disc(v, head, z, 1, 2, r, "#cf7662");
    sofa(v, head, 2, z, Math.max(4, r), 3, "#4a8b80", ivory);
  }
  if (lv >= 3) {
    disc(v, x, z, base, base + 1, r + 3, ash, r);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI / 3.5;
      v.box(x + Math.floor(r * Math.cos(a)), base + 1, z + Math.floor(r * Math.sin(a)),
        x + Math.floor(r * Math.cos(a)) + 1, base + 3, z + Math.floor(r * Math.sin(a)) + 1, brass);
    }
  }
  if (lv >= 4) {
    const xx = hx - 5, zz = hz - 5;
    v.hollowBox(xx - 6, 1, zz - 6, xx + 2, 6, zz, walnut);
    glassFront(v, xx - 5, xx + 2, 2, 5, zz - 1, walnut, 3, lit);
    v.box(xx - 7, 6, zz - 7, xx + 3, 7, zz + 1, ash);
    person(v, xx - 2, 1, zz + 1, coral);
  }
  if (lv === 5) {
    const far = hx - 7, az = z - 2;
    arm(v, hinge, elbow, az, far, elbow + 6);
    shade(v, far, az, elbow + 2, 5, 5);
    disc(v, far, az, 1, 2, 5, "#cb986b");
    bench(v, far, 2, az, "x", walnut);
  }
}

export function buildFurnitureShowroom(c: Ctx) {
  c.v.box(2 - c.hx, 0, 2 - c.hz, c.hx - 2, 1, c.hz - 2, "#bdba99");
  [wingback, sectionalStories, cartonStudio, lampLoft][c.variant % 4](c);
}
