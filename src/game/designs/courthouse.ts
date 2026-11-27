/** Four axial approaches to a public hearing: a portico, a hemicycle, an inhabited arch and an oculus. */
import { type Ctx, type PixelVox, bench, column, door, hedge, lamp, person, stairs } from "./kit";

export const COURTHOUSE = {
  levels: ["Magistrate’s Bench", "County Sessions", "District Hearing Hall", "Court of Appeals", "High Court of the Island"] as [string, string, string, string, string],
  growth: "A raised magistrate’s bench gains public seating, jury and hearing rooms, an appeals gallery and a ceremonial high court.",
};

const stone = "#e1d3b3", pale = "#fff1d4", joint = "#897e73";
const patina = "#427b77", brass = "#e8ba67", walnut = "#764431", lit = "#ffd99a";

function flight(v: PixelVox, width: number, front: number, height: number, material = stone) {
  // Street is +z. The highest tread touches the hearing-room platform.
  stairs(v, -width, width, 1, front, height, material);
  for (let i = 0; i < height; i++) {
    const y = height - i;
    for (const x of [-width, width - 1]) v.put(x, y + 1, front + i, pale);
  }
}

function scaleRelief(v: PixelVox, y: number, z: number, arm: number) {
  v.box(-1, y, z, 1, y + 4, z + 1, brass);
  v.box(-arm - 1, y + 3, z, arm + 1, y + 4, z + 1, brass);
  for (const x of [-arm - 1, arm]) {
    v.put(x, y + 2, z, brass);
    v.box(x - 1, y + 1, z, x + 2, y + 2, z + 1, "goldDark");
  }
}

// Thin stone roof planes step toward a ridge. The front face is an open, framed tympanum.
function templeRoof(v: PixelVox, w: number, y: number, rear: number, front: number, roof: string) {
  const rise = Math.max(2, Math.floor(w * .52));
  for (let x = -w; x < w; x++) {
    const edge = Math.min(x + w, w - x - 1);
    const h = Math.floor(edge * rise / Math.max(1, w - 1));
    v.box(x, y + h, rear, x + 1, y + h + 1, front, roof);
    if (w >= 10 && edge > 2 && edge < w - 3) {
      for (let z = rear + 3; z < front - 5; z += 7) {
        v.box(x, y + h, z, x + 1, y + h + 1, z + 2, "#a7c5bd", .3);
      }
    }
    for (const z of [rear, front - 1]) {
      v.box(x, y, z, x + 1, y + h, z + 1, joint);
      v.put(x, y + h, z, pale);
    }
  }
  v.box(-w, y - 1, front - 1, w, y, front, pale);
}

function recordWing(v: PixelVox, x: number, width: number, rear: number, front: number, height: number) {
  v.hollowBox(x, 1, rear, x + width, height, front, stone);
  for (let xx = x + 1; xx < x + width - 1; xx += 3) {
    v.box(xx, 3, front - 1, xx + 1, height - 1, front, lit, .45);
  }
  v.box(x - 1, height, rear - 1, x + width + 1, height + 1, front + 1, joint);
  v.box(x, height + 1, rear, x + width, height + 2, front, patina);
}

function laurelPortico(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = Math.min(hx - 3, 4 + lv * 2), rear = 2 - hz, porch = Math.floor(hz * .16);
  const base = 2 + lv, cornice = base + 4 + lv;
  v.hollowBox(-w, 1, rear, w, base + 1, porch + 1, joint);
  v.box(-w, base, rear, w, base + 1, porch + 1, pale);
  flight(v, w - 1, porch + 1, base);
  const hallFront = porch - (lv < 3 ? 3 : 5);
  v.hollowBox(-w + 1, base + 1, rear, w - 1, cornice, hallFront, stone);
  door(v, -1, base + 1, hallFront - 1, walnut, 2, 4);
  for (const x of [-w + 1, w - 2]) {
    for (let z = rear + 2; z < hallFront - 1; z += 4) {
      v.box(x, base + 2, z, x + 1, cornice - 1, z + 2, lit, .5);
    }
  }
  for (const x of [-w + 1, -Math.floor(w / 2), Math.floor(w / 2) - 1, w - 2]) {
    column(v, x, porch - 1, base + 1, cornice, pale, stone);
    v.box(x - 1, cornice - 1, porch - 2, x + 2, cornice, porch, pale);
  }
  templeRoof(v, w + 1, cornice + 1, rear - 1, porch + 1, patina);
  if (lv >= 2) {
    const wing = Math.max(2, hx - w - 3);
    for (const x of [-hx + 2, hx - 2 - wing]) recordWing(v, x, wing, rear + 1, hallFront + 1, base + 2);
  }
  if (lv >= 3) {
    scaleRelief(v, cornice + 1, porch + 1, 2);
    person(v, -w + 3, base + 1, porch, "#784559");
    person(v, w - 4, base + 1, porch, "blueDark");
    for (const x of [-w - 1, w]) lamp(v, x, 1, porch + 3, 4, "iron", lit);
  }
  if (lv >= 4) {
    // A real open-air deliberation walk beside the long stairs.
    for (const x of [-w + 1, w - 2]) {
      v.box(x - 2, 0, porch + base + 1, x + 2, 1, hz - 2, stone);
      for (let z = porch + base + 2; z < hz - 2; z += 4) {
        column(v, x, z, 1, 6, pale, joint);
      }
      v.box(x - 1, 6, porch + base + 2, x + 2, 7, hz - 2, patina);
    }
  }
  if (lv === 5) {
    // A crossing lantern admits light to the judging chamber through the long roof.
    const cz = Math.floor((rear + hallFront) / 2), bottom = cornice + Math.floor(w / 2);
    v.hollowBox(-4, bottom - 1, cz - 4, 4, bottom + 5, cz + 4, lit, brass);
    for (const x of [-3, 0, 2]) v.box(x, bottom, cz + 3, x + 1, bottom + 5, cz + 4, patina);
    templeRoof(v, 5, bottom + 6, cz - 5, cz + 5, patina);
  }
}

function juryHemicycle(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const w = hx - 2, depth = hz - 2;
  const center = Math.floor(hz * .18), rear = 2 - hz;
  const base = lv + 1, rows = lv + 1;
  // Open radial galleries: pale risers, oak seats, two radial aisles, and a broad central entry.
  for (let x = -w; x < w; x++) for (let z = rear; z < hz - 2; z++) {
    const nx = (x + .5) / w, nz = (z + .5 - center) / depth;
    const r = Math.hypot(nx, nz);
    if (r > 1 || (nz > .2 && Math.abs(nx) < .35 + nz * .65)) continue;
    if (r < .38) {
      v.put(x, base, z, "oak");
      continue;
    }
    const row = Math.min(rows - 1, Math.floor((r - .38) / .62 * rows));
    const h = base + 1 + row * 2;
    v.box(x, 1, z, x + 1, h + 1, z + 1, "#aa6046");
    const aisle = Math.abs(Math.abs(nx) + nz * 1.35) < .08;
    v.put(x, h, z, aisle || r > .94 ? pale : row % 2 ? stone : "#b98654");
    if (lv >= 2 && r > .76) {
      // A curved arcade breaks the high outer wall and brings light under the galleries.
      const jamb = Math.abs(Math.sin(Math.atan2(nx, nz) * (lv + 2)));
      if (jamb < .83) {
        const archTop = Math.max(3, h - 2 - Math.floor(jamb * 3));
        v.clear(x, 2, z, x + 1, archTop, z + 1);
        if (r < .81) v.box(x, 2, z, x + 1, archTop, z + 1, "#59423b");
        if (r > .91) v.put(x, archTop, z, stone);
      }
    }
  }
  flight(v, Math.max(2, Math.floor(w * .24)), center + 1, base);
  const judge = Math.floor(w * .31), benchZ = center - Math.floor(depth * .26);
  v.box(-judge, base, benchZ - 2, judge, base + 2, benchZ + 1, walnut);
  v.box(-judge - 1, base + 2, benchZ, judge + 1, base + 3, benchZ + 1, brass);
  person(v, -1, base + 2, benchZ - 1, "charcoal");
  // The canopy only covers the raised bench behind the public seats.
  const width = Math.max(3, Math.floor(w * .47));
  const roof = base + 5 + lv;
  for (const x of [-width + 1, width - 2]) column(v, x, rear + 2, base, roof, "#9f5550", brass);
  for (let x = -width; x < width; x++) {
    const offset = Math.min(x + width, width - 1 - x);
    const y = roof + Math.floor(offset / 3);
    v.box(x, y, rear, x + 1, y + 1, rear + 4 + lv, "terracotta");
    v.put(x, y, rear + 3 + lv, pale);
  }
  if (lv >= 2) for (const sign of [-1, 1]) {
    const x = sign * Math.floor(w * .77);
    person(v, x, base + rows * 2 - 2, center, "tealDark");
  }
  if (lv >= 3) {
    for (const side of [-1, 1]) {
      const x = side * Math.floor(w * .78);
      for (let z = rear + Math.floor(hz * .55); z < center; z += 4) {
        column(v, x, z, base + rows, roof + 2, stone, brass);
      }
    }
  }
  if (lv >= 4) {
    // Jury shelters follow the back arc while the central chamber stays visible from above.
    for (let x = -w; x < w; x++) for (let z = rear; z < center; z++) {
      const nx = (x + .5) / w, nz = (z + .5 - center) / depth;
      const r = Math.hypot(nx, nz);
      if (r < .79 || r > .99 || Math.abs(nx) < .44) continue;
      const y = roof + 2 + Math.round((1 - r) * 7);
      v.put(x, y, z, r > .94 ? brass : "terracotta");
    }
  }
  if (lv === 5) {
    const crown = roof + 4;
    for (const x of [-width + 2, width - 3]) column(v, x, rear + 1, roof, crown + 3, stone, brass);
    templeRoof(v, width - 1, crown + 3, rear - 1, rear + 5, "#9b4939");
    scaleRelief(v, roof + 1, rear + 6, 3);
  }
}

function archOfAppeals(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const width = Math.min(hx - 2, 5 + lv * 3), rear = -Math.floor(hz * .66);
  const front = rear + 3 + lv, rise = 7 + lv * 3, base = lv + 1;
  flight(v, Math.max(2, Math.floor(width * .43)), front + 2, base);
  v.box(-width, 1, rear - 1, width, base + 1, front + 2, joint);
  // A through-arch under the raised tribunal. Each inner voussoir points to the high, narrow crown.
  const opening = Math.max(2, Math.round(width * .57));
  for (let x = -width; x < width; x++) {
    const distance = Math.abs(x + .5);
    const arch = distance >= opening ? 0 : Math.round((1 - (distance / opening) ** 1.55) * (rise - 2));
    const bevel = Math.max(0, Math.floor((distance - opening) / 2));
    const y0 = base + arch, y1 = base + rise + 1 - bevel;
    v.box(x, y0, rear, x + 1, y1, front, "#a7b7ad");
    if (lv >= 2 && distance > opening) {
      const inset = Math.floor(distance - opening);
      for (const face of [rear, front - 1]) {
        if (inset % 4 < 2) v.box(x, base + 3, face, x + 1, y1 - 3, face + 1, "#648180", .24);
        else v.box(x, base + 1, face, x + 1, y1 - 1, face + 1, stone);
      }
      if (distance > width - 1) {
        for (let z = rear + 1; z < front - 1; z += 3) {
          v.box(x, base + 3, z, x + 1, y1 - 3, z + 2, lit, .4);
        }
      }
    }
    v.box(x, y0, front - 1, x + 1, y0 + 2, front, distance < opening ? pale : "#707e78");
    v.box(x, y1 - 1, rear - 1, x + 1, y1, front + 1, patina);
  }
  // The glazed upper chamber is a separate hearing room with the judges above the arch.
  const cw = Math.max(2, Math.floor(width * .44)), ceil = base + rise + 3;
  v.hollowBox(-cw, base + rise, rear, cw, ceil + 1, front, lit, patina);
  for (let x = -cw + 1; x < cw; x += 3) v.box(x, base + rise, front - 1, x + 1, ceil, front, patina);
  templeRoof(v, cw + 1, ceil + 1, rear - 1, front + 1, "#4f675d");
  if (lv >= 2) for (const s of [-1, 1]) {
    const x = s * (width - 2);
    v.hollowBox(x - 1, 1, front, x + 2, base + 5, front + 3, "#9ba99d");
    v.box(x - 1, base + 5, front, x + 2, base + 6, front + 3, pale);
    v.put(x, base + 3, front + 2, lit, .65);
  }
  if (lv >= 3) {
    const x = Math.floor(width * .75);
    for (const ox of [-x, x - 3]) {
      v.hollowBox(ox, base, rear - 2, ox + 3, base + rise - 4, rear + 1, joint);
      v.box(ox + 1, base, rear - 2, ox + 2, base + rise - 5, rear - 1, lit, .6);
    }
    for (const x of [-width + 2, width - 3]) person(v, x, base + 1, front + 1, "blueDark");
  }
  if (lv >= 4) {
    // Lower appeals courts flank the approach, connected by side arcades.
    const end = Math.floor(hz * .35);
    for (const x of [-width + 1, width - 3]) {
      for (let z = front + 3; z <= end; z += 4) column(v, x, z, 1, base + 2, stone, joint);
      v.box(x - 1, base + 2, front + 2, x + 2, base + 3, end + 1, patina);
      bench(v, x, 1, end + 3, "z", walnut);
      hedge(v, x - 1, front + 4, x, end, 1, 2);
    }
  }
  if (lv === 5) {
    // Narrow archivists' stairways descend from the raised chamber in profile.
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) {
      const x = s * (cw + 2);
      const z = rear + i, y = base + rise - i * 2;
      v.box(x - 1, y - 2, z, x + 2, y, z + 2, pale);
    }
    scaleRelief(v, base + rise - 5, front, 3);
  }
}

function oculusCourt(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const radius = Math.min(hx - 2, hz - 2, 4 + 2 * lv);
  const cz = Math.max(-hz + 2 + radius, -Math.floor(hz * .28));
  const base = lv + 1, eaves = base + 3 + lv;
  const height = 4 + lv + Math.floor(radius * .36), eye = Math.max(1.2, radius * .29);
  const front = cz + radius;
  flight(v, Math.max(2, Math.floor(radius * .46)), Math.min(front - 1, hz - base), base);
  const aisle = Math.max(1, Math.floor(radius * .23));
  for (let x = -radius; x < radius; x++) for (let z = cz - radius; z < front; z++) {
    const dx = x + .5, dz = z + .5 - cz, distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    v.put(x, base, z, walnut);
    const phase = Math.atan2(dx, dz);
    const rib = Math.abs(Math.sin(phase * 4)) < .16;
    if (distance > radius - 1.2 && !(dz > 0 && Math.abs(dx) < aisle)) {
      v.box(x, 1, z, x + 1, eaves, z + 1, rib ? "#965f43" : "#b06e4e");
      if (!rib) v.box(x, base + 1, z, x + 1, eaves - 1, z + 1, lit, .38);
    }
    if (distance < eye) continue;
    const y = eaves + Math.round(height * Math.sqrt(1 - (distance / radius) ** 2));
    const outer = Math.min(1, (distance + 1) / radius);
    const underside = eaves + Math.round(height * Math.sqrt(1 - outer * outer));
    const metal = rib || distance > radius - 1 ? "#c99150" : "#438f89";
    v.box(x, underside, z, x + 1, y + 1, z + 1, metal);
    if (distance < eye + 1) v.put(x, y + 1, z, brass);
  }
  person(v, -1, base + 1, cz - 1, "charcoal");
  v.box(-2, base + 1, cz, 2, base + 2, cz + 1, walnut);
  if (lv >= 2) {
    const rw = Math.max(2, Math.floor(radius * .46));
    for (const x of [-hx + 2, hx - 2 - rw]) {
      recordWing(v, x, rw, cz - 3, cz + 3, base + 2);
      const joins = x < 0 ? [x + rw, -radius + 1] : [radius - 1, x];
      v.box(joins[0], 1, cz - 1, joins[1], base + 1, cz + 2, stone);
    }
  }
  if (lv >= 3) {
    for (const s of [-1, 1]) {
      const x = s * (aisle + 1);
      column(v, x, front - 1, base, eaves + 1, stone, brass);
    }
    v.box(-aisle - 2, eaves, front - 2, aisle + 2, eaves + 1, front + 1, pale);
  }
  if (lv >= 4) {
    for (const x of [-radius, radius - 2]) {
      for (let z = front; z < hz - 4; z += 4) column(v, x, z, 1, base, stone, brass);
      v.box(x - 1, base, front - 1, x + 2, base + 1, hz - 4, patina);
    }
  }
  if (lv === 5) {
    // The crown is a see-through lantern, still open to the public bench below.
    const top = eaves + height;
    for (let x = -radius; x < radius; x++) for (let z = cz - radius; z < cz + radius; z++) {
      const r = Math.hypot(x + .5, z + .5 - cz);
      if (r < eye - .4 || r > eye + .55) continue;
      if (x === 0 || x === -1 || z === cz || z === cz - 1) v.box(x, top - 1, z, x + 1, top + 3, z + 1, brass);
      v.put(x, top + 3, z, "#8c5237");
    }
  }
}

export function buildCourthouse(c: Ctx): void {
  const { v, hx, hz } = c;
  v.box(-hx + 1, 0, -hz + 1, hx - 1, 1, hz - 1, "#7fa070");
  v.box(-2, 0, 0, 2, 1, hz, pale);
  [laurelPortico, juryHemicycle, archOfAppeals, oculusCourt][c.variant % 4](c);
}
