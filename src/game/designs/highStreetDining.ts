import { type Ctx, byLv, person, ring, awning } from "./kit";
import { cafeTable, umbrella, bulbs, disc, spinner } from "./commerceKit";
import { beam } from "./sculpturalKit";
import { frontage, counter, shopWindow } from "./highStreetParts";

// Pasta served from a bowl under a monumental fork. The ribbon of noodles wraps past the dining tiers.
function noodle(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = byLv(c, [4, 6, 7, 10, 11]),
    x = lv > 2 ? -4 : -1,
    z = lv > 3 ? -3 : -1;
  const lip = byLv(c, [4, 5, 7, 9, 12]);
  for (let y = 1; y <= lip; y++) {
    const rr = r * (0.4 + 0.6 * Math.sin(((y / lip) * Math.PI) / 2));
    ring(v, x + 0.5, z + 0.5, y, y + 1, rr, Math.max(0, rr - 1.7), y % 5 === 1 ? "#e59e78" : "#a34b42");
  }
  ring(v, x + 0.5, z + 0.5, lip - 1, lip + 1, r + 0.7, r - 1, "cream");
  for (const dx of [-1, 1]) v.put(x + dx, lip, z + r, "cream", 0.65);
  disc(v, x + 0.5, z + 0.5, lip - 1, lip, r - 0.5, "#c56b3d");
  // Loop the noodles around the bowl, then trail one strand to a fork held over the edge.
  for (let turn = 0; turn < 3; turn++) {
    const radius = r * (0.28 + turn * 0.22);
    for (let i = 0; i < 45; i++) {
      const a = ((i / 45) * 2 + turn * 0.16) * Math.PI;
      v.put(x + Math.cos(a) * radius, lip + Math.sin(a * 2 + turn) * 0.6, z + Math.sin(a) * radius * 0.78, "#f3c670");
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 2.2;
    v.put(x + Math.cos(a) * r * 0.55, lip + 1, z + Math.sin(a) * r * 0.5, i % 2 ? "olive" : "#b74838");
  }
  const forkX = x - Math.floor(r * 0.7),
    forkZ = z + Math.floor(r * 0.25);
  const rise = byLv(c, [6, 9, 13, 16, 20]),
    forkY = lip + rise;
  beam(v, [forkX, lip + 1, forkZ], [forkX - 1, forkY - 4, forkZ], "#7a8e94", lv >= 4 ? 2 : 1);
  v.box(forkX - 3, forkY - 4, forkZ, forkX + 3, forkY - 2, forkZ + 1, "chrome");
  for (let i = -3; i <= 2; i += 2) beam(v, [forkX + i, forkY - 2, forkZ], [forkX + i - 1, forkY + 2, forkZ], "#c2cdd1");
  for (let i = 0; i < 32; i++) {
    const t = i / 31,
      xx = forkX + 1 + (1 - t) * (x - forkX) * 0.48;
    v.put(xx + Math.sin(t * Math.PI * 3) * 1.1, lip + t * (rise - 2), forkZ + 1, "#e9b951");
  }
  if (lv >= 2) shopWindow(c, x - 3, 1, z + r - 2, 6, "brickDark");
  if (lv >= 3) {
    counter(c, hx - 8, 0, 6, "brick");
    cafeTable(c, hx - 6, hz - 4, "cream");
  }
  if (lv >= 4) {
    v.box(x - r, 5, z + r - 2, x + r + 1, 6, z + r + 1, "woodLight");
    awning(v, x - r + 2, x + 1, 7, z + r, "crimson", "cream");
  }
  if (lv === 5) {
    umbrella(v, hx - 6, 4, "crimson", "cream", 1, 7);
    cafeTable(c, hx - 6, 4);
    c.smoke(x, lip, z, "steam");
  }
}

function pie(c: Ctx) {
  const { v, hx, hz, lv } = c,
    back = -hz + 2,
    front = hz - 3,
    x = lv >= 3 ? -3 : 0,
    width = byLv(c, [4, 6, 10, 12, 13]);
  const height = byLv(c, [4, 7, 9, 12, 15]);
  for (let z = back; z <= front; z++) {
    const fraction = (front - z + 0.5) / (front - back + 1);
    const w = Math.max(1, Math.round(width * (0.07 + 0.93 * fraction)));
    const y = height + Math.round(fraction * 2);
    v.box(x - w, y, z, x + w + 1, y + 1, z + 1, z <= back + 1 ? "#ba7340" : "#ddb34e");
    if (z > back + 1) v.box(x - w, y + 1, z, x + w + 1, y + 2, z + 1, "#f5bc4c");
    if (z < back + 3) v.box(x - w, y + 1, z, x + w + 1, y + 3, z + 1, "#d38241");
    if (lv >= 2 && z % 4 === 0 && w > 2) v.cylinderY(x + w / 3, z + 0.5, y + 2, y + 3, 1.3, "#a83831");
    if (z % 3 === 0 && w > 3) v.put(x - w / 2, y + 2, z, "olive");
    if (z % 4 === 0) {
      v.box(x - w + 1, 1, z, x - w + 2, y, z + 1, "brickDark");
      v.box(x + w - 1, 1, z, x + w, y, z + 1, "brickDark");
    }
  }
  const kitchenW = Math.max(2, Math.floor(width * 0.64)),
    depth = lv < 3 ? 3 : 5;
  v.hollowBox(x - kitchenW, 1, back + 1, x + kitchenW + 1, height - 1, back + depth, "#ab6045");
  shopWindow(c, x - kitchenW, 1, back + depth, 2 * kitchenW + 1, "woodDark");
  counter(c, x - 3, Math.floor((front + back) / 2), 6, "redDark");
  if (lv >= 2) {
    v.dome(x, 3, back + 2, 3, "brick");
    v.box(x - 1, 3, back + 4, x + 2, 5, back + 6, "charcoal");
    c.smoke(x, 7, back + 2, "steam");
  }
  if (lv >= 3) {
    for (const z of [-3, 3]) cafeTable(c, hx - 5, z, "brick");
  }
  if (lv >= 4) {
    v.box(hx - 6, 1, -hz + 3, hx - 3, height + 3, -hz + 6, "brickDark");
    v.box(hx - 7, height + 3, -hz + 4, hx - 2, height + 4, -hz + 2, "brass");
  }
  if (lv === 5) {
    const liftX = hx - 7,
      towerZ = 3;
    v.box(liftX, 1, towerZ, liftX + 2, height + 9, towerZ + 2, "brick");
    v.box(x + 1, height + 5, towerZ, liftX + 2, height + 7, towerZ + 2, "iron");
    const blade = spinner(c, liftX, height + 7, towerZ, "z", 0.55);
    blade.ringZ(0, 0, 0, 2, 5, 1, "silver");
    beam(blade, [-3, 3, 0], [3, -3, 0], "brass");
  }
}

function sushiBoat(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = byLv(c, [5, 6, 12, 13, 14]),
    halfBeam = byLv(c, [2, 4, 4, 6, 7]),
    z = lv >= 4 ? -2 : 0;
  const deck = byLv(c, [3, 4, 5, 7, 9]);
  for (let dx = -r; dx <= r; dx++) {
    const t = Math.abs(dx / r),
      half = Math.max(1, Math.round(halfBeam * Math.sqrt(1 - t * t)));
    for (let y = 1; y <= deck; y++) {
      const side = Math.max(1, Math.round(half * (0.5 + (0.5 * y) / deck))),
        raised = Math.round(t ** 3 * 3);
      if (y === deck) v.box(dx, y + raised, z - side, dx + 1, y + raised + 1, z + side + 1, "woodLight");
      else
        for (const sign of [-1, 1])
          v.put(
            dx,
            y + raised,
            z + side * sign,
            y === deck - 1 ? "cream" : "#8d4333",
            y === deck - 1 && dx % 4 === 0 ? 0.7 : 0,
          );
    }
  }
  for (let dx = -r + 2; dx <= r - 2; dx += 4) {
    v.cylinderY(dx, z, deck + 1, deck + 3, 1.8, "cream");
    v.box(dx - 1, deck + 3, z - 1, dx + 2, deck + 4, z + 2, dx % 3 ? "#ef8a68" : "#d49759");
    v.box(dx, deck + 3, z - 1, dx + 1, deck + 4, z + 2, "#44463c");
  }
  if (lv >= 2) {
    const mastX = -Math.round(r / 2);
    v.box(mastX, deck, z, mastX + 1, deck + 8, z + 1, "woodDark");
    beam(v, [mastX, deck + 7, z], [mastX + 5, deck + 7, z], "oak");
    for (let i = 0; i < 4; i++) v.box(mastX + 1 + i, deck + 2 + i, z, mastX + 2 + i, deck + 7, z + 1, "cream");
  }
  if (lv >= 3) {
    counter(c, -r + 2, z + halfBeam, Math.min(r, 8), "tealDark");
    person(v, r - 2, deck + 1, z, "cream");
  }
  if (lv >= 4) {
    for (const x of [-9, 6]) {
      v.box(x, 1, hz - 5, x + 1, deck + 1, hz - 4, "oak");
      v.box(x - 1, deck - 1, hz - 5, x + 2, deck + 1, hz - 3, "crimson");
    }
    v.box(-10, 1, z + halfBeam + 1, 11, 2, hz - 3, "wood");
  }
  if (lv === 5) {
    const a = 5;
    v.box(a, deck, z, a + 1, deck + 14, z + 1, "woodDark");
    for (let i = 0; i < 9; i++)
      v.box(a - i, deck + 4 + Math.round(i * 0.45), z - 2, a - i + 1, deck + 14 - Math.floor(i * 0.5), z, "#a84842");
    bulbs(v, -10, hz - 5, 7, hz - 5, deck, ["warmGlow", "crimson"]);
  }
}

function burger(c: Ctx) {
  const { v, hx, hz, lv } = c,
    r = byLv(c, [3, 5, 6, 9, 11]),
    x = lv >= 3 ? -3 : 0,
    z = lv >= 4 ? -2 : 0;
  v.cylinderY(x + 0.5, z + 0.5, 1, 3, r - 1, "#d69653");
  const patties = byLv(c, [1, 1, 2, 2, 3]);
  let y = 3;
  for (let layer = 0; layer < patties; layer++) {
    disc(v, x + 0.5, z + 0.5, y, y + 2, r, (dx, _y, dz) => ((dx + dz) % 4 === 0 ? "#703c30" : "#503026"));
    v.box(x - r + 1, y + 2, z - r + 1, x + r, y + 3, z + r, "#eda22e");
    for (let a = 0; a < 24; a++) {
      const phi = (a * Math.PI) / 12;
      v.sphere(x + (r - 1) * Math.cos(phi), y + 3, z + (r - 1) * Math.sin(phi), 1.5, 1, 1.3, a % 3 ? "leaf" : "olive");
    }
    v.cylinderY(x + 0.5, z + 0.5, y + 3, y + 4, r - 1, "#d14b36");
    y += lv < 3 ? 4 : 6;
  }
  v.sphere(x + 0.5, y, z + 0.5, r, Math.max(2, r * 0.47), r, "#df9950");
  for (let a = 0; a < r + 2; a++) {
    const phi = a * 2.4,
      rr = Math.sqrt((a + 1) / (r + 4)) * r * 0.85;
    v.put(
      x + Math.cos(phi) * rr,
      y + r * 0.45 * Math.sqrt(1 - (rr / r) ** 2),
      z + Math.sin(phi) * rr,
      "cream",
      a % 3 === 0 ? 0.7 : 0,
    );
  }
  if (lv >= 2) shopWindow(c, x - 3, 1, z + r - 1, 6, "oak");
  if (lv >= 3) {
    counter(c, hx - 7, 1, 5, "red");
    awning(v, hx - 8, hx - 1, 6, 1, "red", "cream");
  }
  if (lv >= 4) {
    for (const dx of [-8, 1]) cafeTable(c, dx, hz - 5, "red");
  }
  if (lv === 5) {
    beam(v, [x, y + 2, z], [x + 2, y + 10, z], "woodLight");
    v.sphere(x + 2, y + 9, z, 3, 2, 2, "olive");
    umbrella(v, hx - 5, 0, "red", "cream", 1, 6);
  }
}

export function buildRestaurants(c: Ctx) {
  frontage(c, "path2");
  [noodle, pie, sushiBoat, burger][c.variant](c);
}
