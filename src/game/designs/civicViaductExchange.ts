import { bench, lamp, person, type Ctx, type PixelVox } from "./kit";
import { beam, entrance, planter } from "./sculpturalKit";
import { glassFront } from "./commerceKit";

const bronze = "#75503b";
const honey = "#d0a467";
const limestone = "#dfd0b0";
const slate = "#3a4c54";
const glass = "#94c6c0";
const ember = "#f3c17e";
const garnet = "#974f44";

/** Each public counter has a clerk behind glass, a side door and an illuminated number board. */
function serviceBay(v: PixelVox, x: number, y: number, z: number, width: number, depth: number, trim: string) {
  v.hollowBox(x, y, z, x + width, y + 5, z + depth, limestone);
  glassFront(v, x + 1, x + width - 1, y + 1, y + 4, z + depth - 1, trim, 4, "#ddc391");
  v.box(x + 1, y, z + depth - 2, x + 3, y + 3, z + depth, "#42565a");
  v.box(x + width - 4, y + 1, z + depth, x + width - 1, y + 2, z + depth + 1, honey);
  person(v, x + width - 3, y, z + depth - 2, "#527568", "charcoal", "#af7c5d");
  v.box(x, y + 4, z, x + width, y + 5, z + depth + 1, trim);
  v.put(x + 2, y + 3, z + depth, ember, 0.7);
}

function steps(v: PixelVox, x: number, z: number, high: number, width: number) {
  for (let step = 0; step < high; step++) {
    v.box(x, 1, z - step, x + width, 2 + step, z - step + 1, step % 2 === 0 ? limestone : "#c0ab89");
  }
}

/** Two bent laminated ribs give the timber exchange an open, vaulted reading room above its hall. */
function bowGallery(c: Ctx, left: number, right: number, back: number, depth: number, deck: number, rise: number) {
  const { v } = c;
  v.box(left, deck, back, right + 1, deck + 2, back + depth + 1, honey);
  for (const z of [back, back + depth]) {
    for (let x = left; x <= right; x++) {
      const pos = (x - left) / (right - left);
      const y = deck + 2 + Math.round(Math.sin(Math.PI * pos) * rise);
      v.box(x, y, z, x + 1, y + 2, z + 1, bronze);
      if ((x - left) % 4 === 0) v.box(x, deck + 2, z, x + 1, y + 1, z + 1, honey);
      if ((x - left) % 5 === 0) v.put(x, deck + 1, z, ember, 0.64);
    }
    v.box(left - 1, 1, z - 1, left + 2, deck + 2, z + 2, bronze);
    v.box(right - 1, 1, z - 1, right + 2, deck + 2, z + 2, bronze);
  }
  // The skylight covers alternate bays. The arcade stays visibly open from above.
  for (let x = left + 2; x < right - 1; x += 5) {
    const y = deck + 3 + Math.round(Math.sin((Math.PI * (x - left)) / (right - left)) * rise);
    v.box(x, y, back, x + 1, y + 1, back + depth + 1, glass, 0.15);
  }
}

function timberHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    left = -hx + 4,
    right = hx - 5,
    back = -hz + 5;
  const deck = 4 + lv,
    rise = 3 + lv * 2,
    depth = 4 + lv;
  bowGallery(c, left, right, back, depth, deck, rise);
  serviceBay(v, left, 1, back + depth + 2, 8, 4, bronze);
  if (lv >= 2) {
    serviceBay(v, right - 7, 1, back + depth + 3, 8, 5, bronze);
    steps(v, right - 3, back + depth + deck, deck, 3);
  }
  if (lv >= 3) {
    const z = 3;
    bowGallery(c, left, Math.floor(right * 0.45), z, 4, deck - 2, rise - 2);
    v.box(left + 1, deck - 2, back + depth, left + 5, deck, z + 1, honey);
    person(v, left + 2, deck + 2, back + 2, "#515e8a", "charcoal", "#c78d67");
  }
  if (lv >= 4) {
    const z = 4,
      x1 = right - 4;
    serviceBay(v, x1 - 8, deck, z, 8, 6, bronze);
    for (const x of [x1 - 8, x1 - 2]) v.box(x, 1, z, x + 2, deck, z + 2, bronze);
    v.box(x1 - 4, deck, back + depth, x1, deck + 1, z + 1, honey);
    steps(v, left, Math.min(hz - 4, z + deck), deck - 1, 5);
  }
  if (lv === 5) {
    // A public gallery crosses the near branch; glazing is set back between the timber ribs.
    bowGallery(c, -2, right, 9, 5, deck + 1, rise - 3);
    serviceBay(v, 3, deck + 3, 10, 11, 4, bronze);
    for (let x = left + 2; x < right - 2; x += 8) planter(v, x, 1, hz - 5, 1);
  }
  entrance(c, Math.floor(left * 0.6), back + depth + 3, 3, "#d0ba91");
}

function stoneArcade(v: PixelVox, left: number, right: number, z: number, base: number, height: number, bays: number) {
  const bayWidth = (right - left) / bays;
  for (let x = left; x < right; x++) {
    const phase = ((x - left + 0.5) / bayWidth) % 1;
    const half = (phase - 0.5) * 2;
    const opening =
      Math.abs(half) < 0.76 ? base + 2 + Math.sqrt(Math.max(0, 1 - (half / 0.76) ** 2)) * (height - 4) : base;
    const spring = Math.ceil(opening);
    for (let y = spring; y < base + height; y++)
      v.box(x, y, z, x + 1, y + 1, z + 3, y === spring ? honey : (x + y * 2) % 8 === 0 ? "#c7ab86" : limestone);
  }
  v.box(left, base + height, z - 1, right, base + height + 1, z + 4, "#778d82");
}

/** The water is a civic garden feature; the city offices occupy the dry terraces along it. */
function cascadeHall(c: Ctx) {
  const { v, lv, hx, hz } = c,
    left = -hx + 3,
    right = hx - 3,
    back = -hz + 4;
  const tiers = lv === 1 ? 2 : lv + 1,
    run = Math.floor((2 * hz - 10) / tiers);
  for (let i = 0; i < tiers; i++) {
    const y = (tiers - i) * 2,
      z = back + i * run;
    const w = 4 + Math.floor((i + lv) / 2);
    v.box(-w, 1, z, w + 1, y, z + run, limestone);
    v.box(-w + 1, y, z, w, y + 1, z + run, "#5eaca4", 0.12);
    v.box(-w + 2, Math.max(1, y - 2), z + run - 1, w - 1, y, z + run, "#96d2bf", 0.12);
    for (const x of [-w, w]) v.box(x, y, z, x + 1, y + 1, z + run, honey);
    if (i === 0 || i === tiers - 1) {
      serviceBay(v, left, 1, z, 7, Math.min(5, run), slate);
      planter(v, right - 2, 1, z + 1, 1);
    }
  }
  // Flanking walks carry residents up each side of the narrow stepped pool.
  for (const side of [-1, 1]) {
    for (let i = 0; i < tiers; i++) {
      const y = (tiers - i) * 2, z = back + i * run, x = side < 0 ? -10 : 8;
      v.box(x, 1, z, x + 3, y + 1, z + run, "#b8ae91");
      v.box(x, y, z, x + 3, y + 1, z + run - 1, limestone);
      if (i === 0 || i === tiers - 1) v.put(x + 1, y + 1, z + 1, ember, 0.6);
    }
  }
  stoneArcade(v, left, right, back + 1, 1, 6 + lv, lv + 1);
  if (lv >= 2) serviceBay(v, left + 1, 8 + lv, back, Math.min(13, right - left - 4), 5, slate);
  if (lv >= 3) {
    const cz = back + 2 * run;
    stoneArcade(v, left, -4, cz, 1, 7, 2);
    bench(v, left + 2, 8, cz + 1, "x", bronze);
    person(v, left + 5, 8, cz + 1, "#6f87a4");
  }
  if (lv >= 4) {
    const z = back + 3 * run;
    stoneArcade(v, 4, right, z, 1, 9, 2);
    serviceBay(v, right - 9, 11, z, 8, 4, slate);
  }
  if (lv === 5) {
    stoneArcade(v, left + 2, right - 2, back + 2, 9 + lv, 6, 4);
    steps(v, 6, hz - 5, 8, 5);
    for (let x = left + 3; x < right - 1; x += 9) v.put(x, 20, back + 4, ember, 0.65);
  }
  entrance(c, left + 4, back + run, 3);
}

function lattice(v: PixelVox, x0: number, x1: number, z: number, y: number, h: number) {
  const n = Math.max(2, Math.floor((x1 - x0) / 7));
  v.box(x0, y, z, x1 + 1, y + 1, z + 2, garnet);
  v.box(x0, y + h, z, x1 + 1, y + h + 2, z + 2, garnet);
  for (let i = 0; i < n; i++) {
    const a = Math.round(x0 + (i * (x1 - x0)) / n),
      b = Math.round(x0 + ((i + 1) * (x1 - x0)) / n);
    beam(v, [a, y + (i % 2 ? h : 0), z], [b, y + (i % 2 ? 0 : h), z], honey);
    v.box(a, y, z, a + 1, y + h, z + 1, garnet);
  }
}

function lanternHall(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const left = -hx + 4,
    right = hx - 5,
    back = -Math.floor(hz * 0.56);
  const roof = 12 + lv * 3,
    depth = 6 + lv;
  for (const x of [left, right - 2])
    for (const z of [back, back + depth]) {
      v.box(x - 1, 1, z - 1, x + 3, 3, z + 3, limestone);
      v.box(x, 3, z, x + 2, roof + 5, z + 2, garnet);
    }
  for (const z of [back, back + depth]) lattice(v, left, right, z, roof - 1, 4);
  for (const x of [left, Math.floor((left + right) / 2), right - 1])
    v.box(x, roof + 3, back, x + 2, roof + 4, back + depth + 2, garnet);
  const lanterns = Math.min(4, lv + 1),
    pitch = (right - left - 4) / lanterns;
  for (let i = 0; i < lanterns; i++) {
    const x = Math.floor(left + 2 + i * pitch),
      width = Math.max(6, Math.floor(pitch) - 2);
    const floor = roof - 7 - (i % 2) * 3;
    for (const dx of [0, width - 1])
      for (const z of [back + 1, back + depth - 1]) v.box(x + dx, floor + 4, z, x + dx + 1, roof + 1, z + 1, bronze);
    serviceBay(v, x, floor, back + 1, width, depth - 1, garnet);
    v.box(x - 1, floor - 1, back, x + width + 1, floor, back + depth + 1, slate);
  }
  serviceBay(v, left, 1, back + depth + 2, 8, 5, garnet);
  if (lv >= 2) steps(v, left + 8, back + depth + 6, 5, 4);
  if (lv >= 3) {
    const fx = right - 3;
    v.hollowBox(fx - 3, 1, 1, fx + 3, roof - 4, 7, "#758d90");
    for (let y = 2; y < roof - 4; y += 4) glassFront(v, fx - 3, fx + 3, y, y + 2, 6, slate, 4, ember);
    v.box(fx - 1, roof - 6, back + depth, fx + 2, roof - 5, 4, garnet);
  }
  if (lv >= 4) {
    const z = hz - 10;
    lattice(v, left + 4, right - 2, z, 6, 4);
    for (const x of [left + 4, right - 3]) v.box(x, 1, z, x + 2, 7, z + 2, garnet);
    v.box(left + 4, 5, z - 3, right - 1, 6, z + 2, honey);
    bench(v, -2, 6, z - 1);
  }
  if (lv === 5) {
    for (const x of [left + 5, -1, right - 8]) {
      v.hollowBox(x, roof + 3, back + 2, x + 5, roof + 8, back + 7, glass, slate);
      v.box(x - 1, roof + 8, back + 1, x + 6, roof + 9, back + 8, garnet);
    }
  }
  entrance(c, left + 4, back + depth + 4, 3);
}

function marketHall(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const rx = hx - 7,
    rz = hz - 8,
    bays = lv + 3;
  // A horseshoe of shop loggias leaves a public avenue through its mouth on the street.
  for (let i = 0; i <= bays; i++) {
    const a = (i / bays) * Math.PI * 1.22 - Math.PI * 0.11;
    const x = Math.round(Math.cos(a) * rx),
      z = Math.round(-Math.sin(a) * rz);
    const h = 5 + lv + Math.round(Math.sin(a) * lv);
    v.hollowBox(x - 2, 1, z - 2, x + 3, h + 1, z + 3, limestone);
    v.box(x - 3, h, z - 3, x + 4, h + 2, z + 4, slate);
    glassFront(v, x - 2, x + 3, 2, 5, z + 2, bronze, 3, ember);
    if (i === bays) break;
    const b = ((i + 1) / bays) * Math.PI * 1.22 - Math.PI * 0.11;
    const nx = Math.round(Math.cos(b) * rx),
      nz = Math.round(-Math.sin(b) * rz);
    const max = Math.max(Math.abs(nx - x), Math.abs(nz - z));
    for (let k = 0; k <= max; k++) {
      const t = k / max,
        px = Math.round(x + t * (nx - x)),
        pz = Math.round(z + t * (nz - z));
      const py = h + 1 + Math.round(Math.sin(t * Math.PI) * (3 + lv));
      v.box(px - 1, py, pz - 1, px + 2, py + 2, pz + 2, t > 0.43 && t < 0.57 ? honey : limestone);
      if (lv >= 3) v.box(px - 1, h + 1, pz - 1, px + 2, h + 2, pz + 2, bronze);
    }
  }
  if (lv >= 2) {
    serviceBay(v, -3, 1, -rz + 2, 8, 5, bronze);
    bench(v, 0, 1, 1);
  }
  if (lv >= 3) {
    steps(v, rx - 3, Math.floor(hz * 0.5), 6, 4);
    planter(v, -5, 1, 1, 2);
  }
  if (lv >= 4) {
    const left = -rx + 2,
      right = rx - 1;
    stoneArcade(v, left, right, Math.floor(hz * 0.43), 1, 6, 3);
    v.box(left, 7, Math.floor(hz * 0.43), right, 8, Math.floor(hz * 0.43) + 5, slate);
  }
  if (lv === 5) {
    serviceBay(v, -7, 8, Math.floor(hz * 0.43), 12, 6, bronze);
    for (let z = -4; z < hz - 2; z += 6) for (const x of [-8, 8]) planter(v, x, 1, z, 1);
  }
  entrance(c, 0, -rz, 3);
}

export function buildCivicViaductExchange(c: Ctx) {
  [timberHall, cascadeHall, lanternHall, marketHall][c.variant % 4](c);
  lamp(c.v, -c.hx + 3, 1, c.hz - 4, 5, bronze, ember);
  person(c.v, 2, 1, c.hz - 4, "#537e79", "charcoal", "#c89671");
}
