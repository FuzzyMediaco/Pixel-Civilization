import { byLv, type Ctx, door, gable, lamp, person, PixelVox, ring, sawtooth, truck, windows } from "./kit";

export const POST_OFFICE = {
  levels: ["Letter Counter", "Carrier Station", "Sorting Yard", "Dispatch Exchange", "Regional Mailworks"] as [string, string, string, string, string],
  growth: "A public letter counter gains carrier bays and an open sorting yard, then links whole dispatch halls across the parcel.",
};

function parcel(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 3, y + 2, z + 2, "crate");
  v.box(x + 1, y, z, x + 2, y + 2, z + 2, "cream");
  v.put(x + 2, y + 1, z + 1, "white");
}

function belt(v: PixelVox, x0: number, x1: number, z: number) {
  v.box(x0, 2, z, x1, 3, z + 3, "steelDark");
  for (let x = x0; x < x1; x += 3) {
    v.box(x, 2, z, x + 1, 3, z + 3, "steelLight");
    if ((x - x0) % 6 === 0) {
      v.box(x, 1, z, x + 1, 2, z + 3, "iron");
      if (x + 3 <= x1) parcel(v, x, 3, z);
    }
  }
}

function pillarBox(v: PixelVox, x: number, z: number, color: string) {
  v.box(x, 1, z, x + 2, 5, z + 2, color);
  v.put(x, 4, z + 1, "charcoal");
  v.box(x, 5, z, x + 2, 6, z + 1, color);
}

function customerPath(v: PixelVox, x: number, z: number, front: number) {
  v.box(x - 1, 0, z, x + 3, 1, front, "path");
  for (let step = z + 2; step < front; step += 3) v.box(x - 1, 0, step, x + 3, 1, step + 1, "path2");
}

// Stiff blue-and-red air-mail selvages frame a cream roof. The triangular sealing flap lifts off the
// body, leaving a dark, walk-in opening; the letter-closing crease and red wax seal are visible above.
function envelope(c: Ctx, x0: number, x1: number, z0: number, z1: number, wallTop: number, lift: number) {
  const { v } = c;
  const cx = Math.floor((x0 + x1) / 2), width = x1 - x0, depth = z1 - z0;
  v.hollowBox(x0 + 1, 1, z0 + 1, x1 - 1, wallTop, z1 - 1, "#d4be9e");
  windows(c, x0 + 1, 1, z0 + 1, x1 - 1, wallTop, z1 - 1, { faces: "we", w: 2, col: "warmGlow", lit: 1, emit: .6 });
  v.box(x0 + 2, 2, z1 - 2, x1 - 2, wallTop - 1, z1 - 1, "#393a46");
  v.box(x0 + 2, 2, z1 - 1, cx - 1, 3, z1, "woodLight");
  door(v, cx - 1, 1, z1 - 2, "#242b39", 2, 3);
  v.box(x0, wallTop, z0, x1, wallTop + 1, z1, "#dfd3b8");
  for (let x = x0; x < x1; x++) {
    const margin = Math.min(x - x0, x1 - 1 - x);
    const flapDepth = Math.min(depth - 1, Math.floor((margin + .65) * 2 * depth / width));
    const rise = Math.round(lift * flapDepth / depth);
    for (let row = 0; row <= flapDepth; row++) {
      const y = wallTop + 1 + Math.round(lift * row / depth);
      v.put(x, y, z0 + row, row === flapDepth ? "#a67960" : "#fff1cd");
    }
    if (margin === 0) {
      for (let z = z0; z < z1; z++) v.put(x, wallTop, z, ["#da5446", "cream", "#3d678b", "cream"][Math.floor((z - z0) / 2) % 4]);
    }
    if (Math.abs(x - cx) <= 1 && flapDepth > 2) v.put(x, wallTop + rise + 2, z0 + flapDepth - 1, "crimson");
  }
}

function foldedLetter(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const left = -hx + 1, far = -hz + 2;
  const right = byLv(c, [5, 6, 13, 10, 8]);
  const front = byLv(c, [1, 2, 1, 0, -3]);
  const entry = Math.floor((left + right) / 2);
  customerPath(v, entry, front - 1, hz);
  envelope(c, left, right, far, front, lv < 3 ? 4 : 6, lv + 2);
  pillarBox(v, left + 1, front + 2, "blueDark");
  person(v, entry + 2, 1, front + 2, "teal");
  if (lv >= 2) {
    const dispatchX = lv === 2 ? 7 : -1;
    belt(v, dispatchX, hx - 2, front + 2);
    if (lv === 2) person(v, hx - 3, 1, front + 5, "orange");
  }
  if (lv >= 3) {
    v.box(-hx + 1, 0, hz - 6, hx - 1, 1, hz - 2, "concrete2");
    truck(v, hx - 6, 1, hz - 4, "x", "cream", "blueDark");
    // A street-front return wing makes the sorting yard an L. The opening faces the belt.
    envelope(c, left, left + 9, front + 1, hz - 3, 4, 3);
  }
  if (lv >= 4) {
    envelope(c, right + 2, hx - 1, far + 4, front + 1, 4, 4);
    v.box(right - 1, 4, far + 5, right + 3, 5, far + 8, "glass");
    lamp(v, hx - 3, 1, front + 5, 5);
  }
  if (lv === 5) {
    // A letter rises out of its open envelope. The two tall sheets and a perforated stamp change the skyline.
    const x0 = left + 4, x1 = right - 3;
    for (let y = 7; y < 20; y++) {
      const z = far + 4 - Math.floor((y - 7) / 4);
      v.box(x0, y, z, x1, y + 1, z + 2, "cream");
      if (y === 13 || y === 15) v.box(x0 + 3, y, z + 1, x1 - 9 + (y % 3), y + 1, z + 2, "#9faeb2");
      if (y >= 15 && y < 19) v.box(x1 - 6, y, z + 1, x1 - 2, y + 1, z + 2, y % 3 === 0 ? "teal" : "leafDark");
    }
    // A dark circular postmark overlaps the perforated landscape stamp.
    for (let i = 0; i < 19; i++) {
      const a = i * Math.PI / 12, y = 15 + Math.round(2 * Math.sin(a));
      const z = far + 5 - Math.floor((y - 7) / 4);
      v.put(x1 - 7 + Math.round(2.5 * Math.cos(a)), y, z, "#625849");
    }
    belt(v, left + 12, 7, 6);
    parcel(v, hx - 6, 1, 4);
  }
}

function mailWagon(v: PixelVox, x: number, z: number) {
  for (const axle of [x - 3, x + 2]) v.box(axle, 1, z - 2, axle + 2, 3, z + 2, "iron");
  v.box(x - 4, 3, z - 2, x + 5, 6, z + 2, "#32695c");
  v.box(x - 3, 4, z + 1, x - 1, 6, z + 2, "warmGlow", .6);
  v.box(x, 3, z + 1, x + 3, 6, z + 2, "#2c3835");
  v.box(x - 5, 6, z - 2, x + 6, 7, z + 2, "cream");
  v.box(x - 4, 7, z - 1, x + 5, 8, z + 1, "#ae6453");
}

function railway(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const left = -hx + 2, right = hx - 2;
  const rear = -hz + 2, front = byLv(c, [-1, -1, -3, -2, 0]);
  const railZ = hz - 4;
  for (let x = left; x < right; x += 3) v.box(x, 1, railZ - 2, x + 1, 2, railZ + 3, "woodDark");
  for (const z of [railZ - 1, railZ + 1]) v.box(left, 2, z, right, 3, z + 1, "steel");
  v.box(left, 1, front, right, 3, front + 3, "brickDark");
  v.box(left, 3, front, right, 4, front + 3, "path");
  const hallEnd = lv === 1 ? right - 3 : lv === 2 ? -1 : Math.floor(hx * .35);
  v.hollowBox(left, 1, rear, hallEnd, 6, front + 1, "#be7657");
  windows(c, left, 1, rear, hallEnd, 6, front + 1, { faces: "sw", col: "warmGlow", lit: 1 });
  door(v, left + 2, 3, front, "tealDark", 2, 3);
  if (lv === 1) {
    gable(v, left - 1, 6, rear - 1, hallEnd + 1, front + 2, "x", "#486c62", "cream");
    parcel(v, hallEnd - 1, 4, front + 1);
    pillarBox(v, left, railZ + 1, "redDark");
    return;
  }
  sawtooth(v, left - 1, 6, rear - 1, hallEnd + 1, front + 2, "#376a62", "#9ed9d2", lv === 5 ? 7 : 5);
  for (let x = hallEnd + 1; x < right - 1; x += 5) {
    v.box(x, 3, rear + 2, x + 1, 8, rear + 3, "#493d39");
    v.box(x, 3, front, x + 1, 8, front + 1, "#493d39");
  }
  v.box(hallEnd, 8, rear + 1, right, 9, front + 2, "#729c8b");
  for (let x = hallEnd + 2; x < right; x += 5) {
    v.box(x, 8, rear + 1, x + 1, 9, front + 2, "#91b2a0");
    v.put(x, 7, front + 1, "warmGlow", .7);
  }
  mailWagon(v, right - 6, railZ);
  person(v, hallEnd + 1, 4, front + 1, "amber");
  if (lv >= 3) {
    belt(v, left + 3, right - 2, front + 5);
    v.box(left - 1, 2, front + 3, left + 3, 3, front + 6, "concrete2");
    pillarBox(v, left + 1, hz - 4, "redDark");
  }
  if (lv >= 4) {
    // An overhead postal-bag crane straddles the loading line. The sacks hang above the open wagon.
    const gantry = right - 9;
    v.box(gantry - 1, 1, railZ - 5, gantry + 1, 15, railZ - 3, "steelDark");
    v.box(gantry - 1, 1, railZ + 2, gantry + 1, 15, railZ + 4, "steelDark");
    v.box(gantry - 2, 15, railZ - 6, gantry + 2, 17, railZ + 4, "orange");
    v.box(gantry, 11, railZ - 1, gantry + 1, 16, railZ, "iron");
    v.sphere(gantry, 10, railZ, 2, 2, 1.5, "crate");
    mailWagon(v, left + 10, railZ);
  }
  if (lv === 5) {
    const tower = left + 5;
    // The signal loft looks into both covered lines through a wraparound glazed dispatch balcony.
    v.hollowBox(tower - 2, 8, rear + 2, tower + 9, 14, rear + 9, "brickDark");
    windows(c, tower - 2, 11, rear + 2, tower + 9, 15, rear + 9, { lit: 1, col: "warmGlow", w: 2, margin: 0, stepH: 3 });
    v.box(tower - 3, 10, rear + 8, tower + 10, 11, rear + 11, "cream");
    gable(v, tower - 4, 15, rear, tower + 11, rear + 11, "x", "#32554f", "copper");
    for (let x = hallEnd + 1; x < right - 3; x += 4) parcel(v, x, 4, front);
  }
}

function dovecote(v: PixelVox, x: number, z: number, floor: number, radius: number, height: number) {
  const top = floor + height;
  v.cylinderY(x, z, floor, top, radius, "#f3dbc0");
  v.cylinderY(x, z, floor, floor + 1, radius + .5, "woodDark");
  for (let row = floor + 1; row < top - 1; row += 3) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const xx = Math.floor(x + Math.sin(a) * (radius - .4));
      const zz = Math.floor(z + Math.cos(a) * (radius - .4));
      v.put(xx, row + 1, zz, "#3c4143");
      v.put(xx + Math.round(Math.sin(a)), row, zz + Math.round(Math.cos(a)), "wood");
    }
  }
  v.cone(x, top, top + radius + 2, z, radius + 1.5, .5, "#b66447");
  v.put(x, top + radius + 2, z, "brass");
}

function pigeon(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 3, y + 1, z + 1, "#99acb5");
  v.put(x + 2, y + 1, z, "#4d6872");
  v.put(x + 3, y + 1, z, "brass");
  v.put(x + 1, y, z + 1, "#d5dfe0");
}

function pigeonPost(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const rear = -hz + 3, left = -hx + 2;
  const mainX = left + (lv === 1 ? 4 : 6), mainZ = rear + 3;
  const front = byLv(c, [2, 2, 3, 0, 0]);
  const right = byLv(c, [4, 10, 3, 11, 12]);
  const floor = lv === 1 ? 3 : 5;
  customerPath(v, left + 3, front, hz);
  v.box(left, 1, mainZ, right, 4, front + 1, "#ae8055");
  v.box(left, floor - 1, mainZ - 1, right + 1, floor, front + 2, "woodDark");
  for (let x = left + 1; x < right; x += 3) v.put(x, 2, front, "warmGlow", .6);
  door(v, left + 3, 1, front, "#3b5146");
  const radius = lv >= 4 ? 5 : 3;
  dovecote(v, mainX, mainZ, floor, radius, lv >= 4 ? 8 : 5);
  pigeon(v, mainX - 1, floor + 1, mainZ + radius + 1);
  if (lv === 1) {
    pillarBox(v, 4, 3, "tealDark");
    return;
  }
  const endX = right - 2;
  dovecote(v, endX, mainZ + 1, floor, 2, 4);
  v.box(mainX + 1, floor, mainZ + 2, endX - 1, floor + 1, mainZ + 5, "woodLight");
  for (let x = mainX + 3; x < endX - 1; x += 4) v.box(x, floor + 1, mainZ + 5, x + 1, floor + 3, mainZ + 6, "tealDark");
  parcel(v, right - 1, 1, front + 2);
  if (lv >= 3) {
    // The timber gallery shelters a bank of pigeonholes. Bird-sized landings flank the public counter.
    for (let x = left + 2; x < right - 1; x += 4) {
      v.box(x, floor, front - 1, x + 2, floor + 2, front + 1, "woodLight");
      v.put(x + 1, floor + 1, front, "charcoal");
      v.box(x, floor, front + 1, x + 3, floor + 1, front + 2, "wood");
    }
    pigeon(v, left + 3, floor + 2, front + 1);
    // A long avenue of open nest boxes faces a public dispatch counter below the flight loft.
    const loftX = hx - 7;
    v.hollowBox(loftX - 3, 2, rear + 2, loftX + 4, 7, hz - 4, "plaster", "wood");
    for (let z = rear + 5; z < hz - 6; z += 4) {
      v.put(loftX + 3, 5, z, "charcoal");
      v.box(loftX + 4, 4, z - 1, loftX + 5, 5, z + 2, "woodLight");
    }
    gable(v, loftX - 4, 7, rear + 1, loftX + 5, hz - 3, "z", "#647c72", "woodDark");
    belt(v, left + 3, 2, hz - 4);
    person(v, 2, 1, hz - 2, "blueDark");
  }
  if (lv >= 4) {
    dovecote(v, left + 5, hz - 7, 1, 3, 5);
    v.box(left + 4, 5, mainZ + 2, left + 7, 6, hz - 7, "woodLight");
    for (let z = mainZ + 4; z < hz - 6; z += 5) v.box(left + 4, 1, z, left + 5, 6, z + 1, "woodDark");
  }
  if (lv === 5) {
    // An open trussed flyway connects the high roost to the long loft without roofing the yard.
    const a = mainX, b = hx - 7, z = rear + 4;
    v.box(a, 10, z - 1, b + 1, 11, z + 2, "wood");
    for (let x = a; x <= b; x++) {
      v.put(x, 12 + Math.abs((x - a) % 8 - 4), z + 1, "#6f5848");
      v.put(x, 16, z + 1, "wood");
    }
    dovecote(v, b, z, 10, 3, 5);
    pigeon(v, a + 6, 17, z + 1);
    pigeon(v, a + 13, 17, z + 1);
    truck(v, 5, 1, hz - 5, "x", "cream", "tealDark");
  }
}

function sorter(c: Ctx, cx: number, cz: number, radius: number) {
  const { v } = c;
  ring(v, cx, cz, 1, 3, radius + 1, radius - 1, "steelDark");
  ring(v, cx, cz, 3, 4, radius + 1, radius - 1, "#d8ac5c");
  const trays = new PixelVox(41);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2, x = Math.round((radius - .5) * Math.cos(angle)), z = Math.round((radius - .5) * Math.sin(angle));
    trays.box(x - 1, 0, z - 1, x + 1, 1, z + 1, "crate");
    trays.put(x, 1, z, "cream");
  }
  c.addRotor({ vox: trays, pivot: [cx, 4, cz], axis: "y", speed: .34 });
}

function carouselPost(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const radius = byLv(c, [4, 5, 8, 9, 11]);
  const cx = byLv(c, [0, -7, -3, -9, -7]);
  const cz = lv <= 2 ? 0 : -2;
  // A covered arc of sorting desks leaves a large cutaway facing the street and a visible band of trays.
  for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
    for (let z = cz - radius - 2; z <= cz + radius + 2; z++) {
      const dx = x + .5 - cx, dz = z + .5 - cz, r = Math.hypot(dx, dz);
      if (r < radius - 1 || r > radius + 1.8 || dz > Math.abs(dx) * .3) continue;
      const roof = lv >= 4 ? 9 : 6;
      v.put(x, roof, z, "#4c8a99");
      if (r > radius + .8) {
        v.box(x, 1, z, x + 1, roof, z + 1, (x + 2 * z) % 5 === 0 ? "warmGlow" : "#c5d3c9");
        v.put(x, roof, z, "cream");
      }
    }
  }
  sorter(c, cx, cz, radius - 1);
  customerPath(v, cx - 1, cz + radius - 1, hz);
  // A public receiving counter sits in the mouth of the curved sorting hall.
  v.box(cx - 2, 1, cz + 1, cx + 1, 3, cz + 2, "wood");
  v.put(cx, 3, cz + 1, "cream");
  person(v, cx - 1, 1, cz, "amber");
  if (lv === 1) { pillarBox(v, hx - 3, hz - 4, "blueDark"); return; }
  const right = hx - 2;
  belt(v, cx + radius, right, cz);
  parcel(v, right - 2, 1, 3);
  if (lv >= 3) {
    const back = -hz + 2;
    v.hollowBox(right - 7, 1, back, right, 5, 0, "brick", "limestone");
    sawtooth(v, right - 8, 5, back - 1, right + 1, 1, "#527b83", "glass", 4);
    door(v, right - 5, 1, 0, "iron");
    belt(v, cx - 2, right - 2, cz + radius + 2);
  }
  if (lv >= 4) {
    sorter(c, right - 7, 5, 4);
    v.box(right - 12, 1, 4, right - 10, 10, 6, "steelDark");
    v.box(right - 12, 9, 4, right - 3, 11, 6, "copper");
    v.box(right - 5, 6, 4, right - 4, 10, 5, "steelLight");
  }
  if (lv === 5) {
    // An inclined bag elevator empties into the two wheels from a raised, roofed dispatch room.
    const end = right - 6;
    v.hollowBox(end - 3, 8, -hz + 4, end + 4, 15, -hz + 10, "#e3cb9d", "steelDark");
    gable(v, end - 4, 15, -hz + 3, end + 5, -hz + 11, "x", "#47656f", "cream");
    for (let z = -hz + 9; z <= 3; z++) {
      const y = 11 - Math.floor((z + hz - 9) / 2);
      v.box(end - 2, y, z, end + 1, y + 1, z + 1, z % 3 === 0 ? "copper" : "steelDark");
      if (z % 5 === 0) v.put(end - 1, y + 1, z, "crate");
    }
    truck(v, right - 5, 1, hz - 4, "x", "cream", "tealDark");
  }
}

/** Four postal depots built around folded correspondence, mail wagons, carrier birds and parcel trays. */
export function buildPostOffice(c: Ctx): void {
  c.vpick([foldedLetter, railway, pigeonPost, carouselPost])(c);
}
