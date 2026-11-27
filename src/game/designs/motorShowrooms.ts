import { type Ctx, type PixelVox, car, door, lamp, person } from "./kit";
import { bulbs, disc, glassFront, palm, sculpt, spinner } from "./commerceKit";
import { override } from "./commerceIcons";

const enamel = "#28767f", cherry = "#ed5a49", cream = "#fff0cb", chrome = "#c3d7ce";
const paint = [cherry, "#f1ac4d", "#66beab", "#87a9d6", "#b482b2"];

// Original finned coupe, long hood at +x. Actual rubber wheels, separated from the sill by chrome.
function coupe(v: PixelVox, cx: number, y: number, cz: number, length: number, body: string) {
  const w = Math.max(3, Math.round(length * .4)), h = Math.max(3, Math.round(length * .28));
  const left = cx - Math.floor(length / 2), back = cz - Math.floor(w / 2);
  sculpt(v, left, y + 1, back, left + length, y + h + 2, back + w, (u, t, s) => {
    const edge = Math.abs(s - .5) * 2;
    if (edge > .8 + .2 * Math.sin(u * Math.PI)) return null;
    const cabin = u > .23 && u < .66 && edge < .85;
    if (t < .20) return chrome;
    if (t < .47) return body;
    if (cabin && t < .76 + .22 * Math.sin((u - .23) / .43 * Math.PI)) {
      return t > .85 || u > .41 && u < .48 ? body : "#9dc9d0";
    }
    if (u < .19 && edge > .57 && t < .67) return body;
    return null;
  });
  const wheel = Math.max(1, Math.floor(length / 11));
  for (const x of [left + Math.round(length * .2), left + Math.round(length * .8)]) {
    for (const z of [back, back + w - 1]) for (let xx = -wheel; xx <= wheel; xx++) {
      for (let yy = -wheel; yy <= wheel; yy++) {
        if (xx * xx + yy * yy <= wheel * wheel + .4) v.put(x + xx, y + wheel + yy, z, xx || yy ? "rubber" : chrome);
      }
    }
  }
  for (const z of [back + 1, back + w - 2]) v.put(left + length - 1, y + 2, z, cream, .85);
}

function kiosk(c: Ctx, x: number, z: number, w: number, d: number, color: string) {
  const { v } = c;
  v.hollowBox(x, 1, z, x + w, 6, z + d, cream);
  glassFront(v, x, x + w, 2, 5, z + d - 1, enamel, 4, "#b9e3df");
  door(v, x + 2, 1, z + d - 1, "#43595b", 2, 3, false);
  v.box(x - 1, 6, z - 1, x + w + 1, 7, z + d + 2, color);
  v.box(x, 5, z + d + 1, x + w, 6, z + d + 2, chrome);
}

function vendingTower(c: Ctx, cx: number, cz: number, radius: number, floors: number) {
  const { v } = c;
  const step = 6;
  for (let f = 0; f <= floors; f++) {
    const y = 1 + f * step;
    disc(v, cx, cz, y, y + 1, radius, (x, _y, z, d) => d > radius - 1.3 ? chrome : (x + z) % 5 ? "#24454c" : enamel);
    if (f === floors) break;
    const axis = f % 2 === 0 ? "x" : "z";
    // Larger display cars occupy their entire bays, visible through the open front glazing.
    if (axis === "x") coupe(v, cx, y + 1, cz, Math.max(6, Math.floor(radius * 1.45)), paint[f % paint.length]);
    else {
      car(v, cx, y + 1, cz, axis, paint[f % paint.length]);
      if (radius >= 7) car(v, cx + 3, y + 1, cz + 1, axis, paint[(f + 2) % paint.length]);
    }
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const x = cx + Math.floor(Math.cos(a) * (radius - 1)), z = cz + Math.floor(Math.sin(a) * (radius - 1));
      // Glazing at the rear and narrow corner mullions leave the cars visible.
      v.box(x, y + 1, z, x + 1, y + step, z + 1, i % 2 ? "#84c9d0" : enamel);
      if (i >= 4 && i < 7) v.box(x - 1, y + 2, z, x + 2, y + 4, z + 1, "#9dd5dc", .15);
    }
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16 + f) * Math.PI * .75;
      v.put(cx + Math.floor(Math.cos(a) * radius), y + Math.round(step * i / 16), cz + Math.floor(Math.sin(a) * radius), "#efac52", .5);
    }
  }
}

function carVault(c: Ctx) {
  const { v, hx, hz, lv } = c;
  const r = Math.min(hz - 2, 4 + lv), x = -Math.floor(hx * .28), z = -Math.floor(hz * .22);
  vendingTower(c, x, z, r, lv);
  kiosk(c, x + r + 1, z - 3, Math.min(9, hx - x - r - 3), 5, enamel);
  if (lv >= 2) {
    const end = Math.min(hz - 2, z + r + 5);
    for (const dx of [-2, 2]) v.box(x + dx, 1, z + r - 1, x + dx + 1, 2, end, chrome);
    coupe(v, x, 1, end - 1, 6, "#e8bc5b");
  }
  if (lv >= 3) for (let p = 0; p < 2; p++) {
    const sx = hx - 6 - p * 8;
    car(v, sx - 2, 1, z + 8, "z", paint[p]);
    v.box(sx + 2, 1, z + 8, sx + 3, 5, z + 9, enamel);
    v.put(sx + 2, 4, z + 9, "screenCyan", .7);
  }
  if (lv >= 4) {
    const fore = hz - 7;
    kiosk(c, -hx + 4, fore - 1, 12, 5, "#e39842");
    bulbs(v, -hx + 4, fore - 2, x + r, z + r, 8, ["amber", "warmGlow"]);
  }
  if (lv === 5) {
    const other = hx - 7, back = z - 5;
    vendingTower(c, other, back, 5, 3);
    v.box(x + r - 1, 13, back, other - 4, 15, back + 3, enamel);
    v.box(x + r - 1, 15, back, other - 4, 16, back + 1, chrome);
  }
}

function revolvingSalon(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const r = Math.min(hz - 2, 4 + 2 * lv), x = -Math.floor(hx * .2), z = 0, y = 2 + Math.floor(lv / 2);
  disc(v, x, z, 1, y, r, "#263d49");
  disc(v, x, z, y, y + 1, r, (_x, _y, _z, d, a) => d > r - 1 ? [Math.cos(a * 12) > .25 ? "#ffad60" : cherry, .6] : chrome);
  const vehicle = spinner(c, x, y + 1, z, "y", .24);
  coupe(vehicle, 0, 0, 0, Math.floor(r * 1.55), cherry);
  kiosk(c, hx - 8, -Math.min(hz - 2, 5 + lv), 6, 6, cherry);
  if (lv >= 2) {
    const roof = 6 + lv * 2;
    // Folded crimson shell behind the stage. The geometry opens toward the street.
    for (let dx = -r; dx <= r; dx++) {
      const wing = Math.abs(dx) / r, rear = z - r + Math.round(2 * wing);
      const top = roof - Math.round(wing * 4);
      v.box(x + dx, 1, rear, x + dx + 1, top, rear + 1, wing > .85 ? enamel : "#a84f48");
      v.box(x + dx, top, rear, x + dx + 1, top + 1, rear + 3 + Math.floor(wing * 2), cherry);
      v.put(x + dx, top, rear + 2 + Math.floor(wing * 2), cream);
    }
  }
  if (lv >= 3) {
    const ledge = Math.min(hz - 3, r + 2);
    v.box(x - r, 1, ledge, x + r, 2, ledge + 2, enamel);
    for (let i = -r + 2; i < r; i += 4) person(v, x + i, 2, ledge, paint[(i + r) % 5]);
  }
  if (lv >= 4) {
    for (const s of [-1, 1]) {
      const rear = -r, end = Math.floor(r / 2);
      for (let dz = rear; dz <= end; dz++) {
        const xx = x + s * (r - Math.round(Math.pow((dz + r) / (end + r), 2) * 2));
        const h = 9 + lv - Math.round((dz - rear) / 3);
        v.box(xx - 1, h, dz, xx + 2, h + 1, dz + 1, chrome);
        if ((dz - rear) % 5 === 0) v.box(xx, 1, dz, xx + 1, h, dz + 1, enamel);
      }
    }
  }
  if (lv === 5) {
    // A cantilevered VIP ring, open above the moving coupe.
    for (let xx = -r; xx <= r; xx++) for (let zz = -r; zz <= r; zz++) {
      const d = Math.hypot(xx, zz);
      if (d < r - 2 || d > r || zz > r * .57) continue;
      const h = 17 + Math.round(-zz / r * 4);
      v.put(x + xx, h, z + zz, d > r - 1 ? cherry : cream);
      if (d > r - 1 && zz % 3 === 0) v.put(x + xx, h + 1, z + zz, chrome);
    }
    for (const s of [-1, 1]) v.box(x + s * (r - 1), 11, z - 3, x + s * (r - 1) + 1, 19, z, enamel);
  }
}

function tire(v: PixelVox, cx: number, z: number, r: number, half: number) {
  sculpt(v, cx - r, 1, z - half, cx + r, 2 * r + 1, z + half, (u, h, w) => {
    const x = (u - .5) * 2, y = (h - .5) * 2;
    const d = Math.hypot(x, y), side = Math.abs(w - .5) * 2;
    const inset = Math.max(0, side - .55);
    if (d > 1 - inset * .24 || d < .47 + inset * .22) return null;
    if (side > .76 && d > .62 && d < .76) return cream;
    const tread = Math.cos(Math.atan2(y, x) * 18 + Math.abs(w - .5) * 12);
    return d > .89 && tread > .25 ? "#646570" : "#303740";
  });
}

function whitewallLodge(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -Math.floor(hx * .22), z = -Math.floor(hz * .29);
  const r = 4 + lv * 2, depth = 1 + lv;
  tire(v, x, z, r, depth);
  v.hollowBox(x - r + 1, 1, z - depth, x + r - 1, 3 + lv, z + depth, cherry);
  glassFront(v, x - r + 2, x + r - 2, 1, 3 + lv, z + depth - 1, enamel, 4, "#a8d7d9");
  door(v, x, 1, z + depth - 1, cream, 2, 3, false);
  if (lv >= 2) {
    kiosk(c, x + r, z - depth, Math.min(9, hx - x - r - 2), depth * 2, cream);
    v.box(x - r + 2, r, z - depth + 1, x + r - 2, r + 1, z + depth - 1, cherry);
    coupe(v, x, r + 1, z, 3 + lv, "#e4bf6d");
  }
  if (lv >= 3) {
    for (let p = 0; p < lv - 1; p++) {
      const sx = -hx + 4 + p * 8;
      car(v, sx, 1, hz - 7, "z", paint[p]);
      v.box(sx - 2, 1, hz - 3, sx + 2, 2, hz - 2, cream);
    }
  }
  if (lv >= 4) {
    kiosk(c, x + r - 3, z + 2, Math.min(11, hx - x - r + 1), 7, enamel);
    coupe(v, x + r + 1, 7, z + 6, 7, cherry);
  }
  if (lv === 5) {
    tire(v, x + 12, z - depth - 6, 8, 3);
    for (let i = 0; i < 7; i++) {
      v.box(x - 3 + i, 1 + i, z + depth + 7 - i, x + 2 + i, 2 + i, z + depth + 8 - i, chrome);
    }
  }
}

function skyhookCourt(c: Ctx) {
  const { v, lv, hx, hz } = c;
  const x = -Math.floor(hx * .37), z = -Math.floor(hz * .2), top = 5 + lv * 3;
  const length = 4 + lv * 3;
  for (let h = 1; h <= top; h++) {
    v.box(x - 1, h, z - 1, x + 2, h + 1, z + 2, h % 5 < 2 ? cream : cherry);
  }
  v.box(x - 3, top, z - 1, x + 4, top + 1, z + 2, chrome);
  coupe(v, x, top + 1, z, length, "#71c5b0");
  kiosk(c, x + 4, z - 2, Math.max(7, hx - x - 8), 5 + lv, cherry);
  if (lv >= 2) {
    const ex = hx - 3;
    lamp(v, ex, 1, z + 8, 8, enamel, cream);
    bulbs(v, x, z + 2, ex, z + 8, 8, [cream, cherry]);
    for (let i = 0; i < lv - 1; i++) car(v, x + 3 + 6 * i, 1, z + 7, "z", paint[(i + 1) % 5]);
  }
  if (lv >= 3) {
    // Drive-through check-in with a long folded wing canopy.
    for (let xx = x - 2; xx < hx - 3; xx++) {
      const h = 6 + Math.floor(Math.abs(xx - x - 8) / 5);
      v.box(xx, h, z + 6, xx + 1, h + 1, z + 10, chrome);
      v.put(xx, h, z + 10, cherry);
      if (xx % 10 === 0) v.box(xx, 1, z + 7, xx + 1, h, z + 8, enamel);
    }
  }
  if (lv >= 4) {
    for (const ox of [x - 3, hx - 5]) palm(v, ox, hz - 5, 1, 7);
    kiosk(c, -hx + 3, -hz + 3, 9, 7, enamel);
  }
  if (lv === 5) {
    // The lower half of a paired skyhook frames the pick-up lane.
    const sx = hx - 7, sz = -hz + 5;
    v.box(sx - 1, 1, sz - 1, sx + 1, 13, sz + 1, enamel);
    coupe(v, sx, 13, sz, 11, cherry);
    bulbs(v, x, z, sx, sz, 14, ["warmGlow", "cyan"]);
  }
}

override("auto_dealership", c => {
  const {v, hx, hz, lv} = c;
  v.box(-hx + 1, 0, 1 - hz, hx - 1, 1, hz - 1, "#637176");
  // Showroom forecourts have a street crossing and short bay markings where customers enter.
  for (let x = -3; x < 4; x += 2) v.box(x, 0, hz - 4, x + 1, 1, hz - 1, cream);
  if (lv >= 2) for (let x = -hx + 3; x < hx - 2; x += 7) {
    if (Math.abs(x) > 4) v.box(x, 0, hz - 7, x + 1, 1, hz - 3, "#adbaad");
  }
  [carVault, revolvingSalon, whitewallLodge, skyhookCourt][c.variant % 4](c);
}, ["Kerbside Test Drive", "Keys and Service", "Motor Gallery", "Exhibition Drive", "Motorworks Landmark"],
"A test-drive stand gains a service desk, display gallery, viewing lanes and a landmark presentation for its cars.");
