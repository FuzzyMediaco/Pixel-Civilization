import { bench, byLv, person, type Ctx, type PixelVox } from "../kit";
import {
  arc,
  glow,
  gold,
  glass,
  night,
  pearl,
  planter,
  pod,
  port,
  publicWalk,
  slab,
  span,
  steel,
  teal,
} from "./futureCivicKit";

function brokenOrbit(c: Ctx) {
  const { v, lv, hx, hz } = c,
    rx = hx - 4,
    rz = hz - 4,
    y = 2 + lv;
  arc(v, 0, 0, y, rx, rz, 1, 0.8, 5.75, pearl);
  for (let i = 0; i < 3; i++) {
    const a = 1.6 + i * 1.8,
      x = Math.round(rx * Math.sin(a)),
      z = Math.round(rz * Math.cos(a));
    span(v, Math.round(x * 0.7), 1, Math.round(z * 0.7), x, y, z, 0, steel);
  }
  pod(v, 0, y + 1, -rz, lv < 3 ? 2 : 4);
  // Charged leaves hover over a bed of fern fronds; the largely open middle is the public garden.
  arc(v, 0, 0, 0, Math.max(2, rx - 3), Math.max(2, rz - 3), 1, -1.5, 1.5, "path2");
  for (const side of [-1, 1]) {
    const px = side * Math.max(2, Math.floor(rx * 0.45)),
      pz = Math.max(1, Math.floor(rz * 0.25));
    planter(v, px, 1, pz);
    if (lv >= 3) leaf(v, px - 3, 4, pz - 2, 7, 6, side < 0);
  }
  planter(v, -2, 1, 1);
  publicWalk(v, 1, 1, hz);
  person(v, 2, 1, 4, "#bf8262");
  if (lv >= 2) pod(v, -rx + (lv >= 3 ? 1 : 0), y + 1, 0, lv >= 3 ? 4 : 2, "#8798ac");
  if (lv >= 3) {
    pod(v, rx - 1, y + 1, 0, 4);
    span(v, 0, 1, rz + 1, Math.round(rx * 0.8), y, Math.round(rz * 0.65), 1, teal);
  }
  if (lv >= 4) {
    arc(v, 0, 0, y + 5, rx - 2, rz - 1, 1, 2.3, 4.5, teal);
    span(v, -rx + 2, y, 0, -rx + 4, y + 5, -4, 1, gold);
    pod(v, 0, y + 6, -rz + 1, 3);
  }
  if (lv === 5) {
    arc(v, -2, 4, y + 2, rx - 5, rz - 5, 1, -0.8, 1.3, "#a5b89c");
    pod(v, 1, y + 3, rz - 1, 3);
    planter(v, 4, 1, 2);
  }
}

function leaf(v: PixelVox, x: number, y: number, z: number, w: number, d: number, flip: boolean) {
  for (let i = 0; i < w; i++)
    for (let j = 0; j < d; j++) {
      const taper = Math.floor(3 * Math.abs((2 * i) / (w - 1) - 1));
      if (j < taper || j >= d - taper) continue;
      const yy = y + Math.floor((flip ? w - 1 - i : i) / 4);
      v.put(
        x + i,
        yy,
        z + j,
        j === Math.floor(d / 2) ? glow : j % 4 === 0 ? teal : pearl,
        j === Math.floor(d / 2) ? 0.3 : 0,
      );
    }
}
function leafTerrace(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = -hx + 2,
    z = -hz + 2,
    w = Math.min(14, hx + 1),
    d = Math.min(13, hz + 3);
  leaf(v, x, 4, z, w, d, false);
  bench(v, x + 2, 1, z + d - 2);
  person(v, x + 3, 1, z + d - 1, "#ac785b");
  for (const dx of [1, w - 3]) v.put(x + dx, 2, z + 4, glow, 0.65);
  publicWalk(v, x + 3, z + d - 1, hz);
  if (lv >= 2) {
    leaf(v, x + w - 2, 6, z + 2, w - 2, d - 2, true);
    pod(v, x + w - 2, 1, z + 4, 2);
  }
  if (lv >= 3) {
    leaf(v, x + 3, 9, z + 6, w + 2, d - 1, true);
    pod(v, x + 9, 10, z + 9, 2);
    planter(v, x + w, 1, z + 12);
  }
  if (lv >= 4) {
    leaf(v, hx - 16, 4, 1, 12, 12, true);
    span(v, x + w - 2, 5, 0, hx - 10, 6, 6, 1, steel);
  }
  if (lv === 5) {
    leaf(v, x + 2, 7, hz - 12, 18, 10, false);
    pod(v, x + 8, 10, hz - 6, 3);
    arc(v, 0, 0, 1, 5, 6, 1, -1.3, 1.3, teal);
  }
}

function archiveRibs(c: Ctx) {
  const { v, lv, hz } = c,
    z = -hz + 4,
    spread = byLv(c, [3, 8, 8, 12, 13]),
    h = 5 + lv;
  for (const side of [-1, 1]) {
    const x = side * spread;
    for (let y = 1; y < h + 3; y++) {
      const bend = Math.round((y / h) ** 2 * (lv === 1 ? 1 : 3));
      v.box(x - side * bend - 1, y, z, x - side * bend + 1, y + 1, z + 4, side < 0 ? steel : teal);
    }
    for (let y = 2; y < h - 1; y += 2) v.box(x - 1, y, z + 4, x + 2, y + 1, z + 5, glow, 0.5);
  }
  if (lv >= 2) leaf(v, -Math.floor(spread * 0.5), 5, z + 1, spread, 7, true);
  pod(v, 0, 1, z + 3, 2);
  publicWalk(v, 0, z + 5, hz);
  if (lv >= 2) {
    span(v, -spread + 2, h + 2, z + 1, spread - 2, h + 2, z + 1, 0, glass);
    bench(v, -spread + 1, 1, z + 6);
  }
  if (lv >= 3) {
    pod(v, -spread, 4, 5, 3);
    span(v, -spread, 3, z + 2, -spread, 4, 4, 1, pearl);
  }
  if (lv >= 4) {
    pod(v, spread, 7, 4, 3);
    span(v, spread, h + 1, z + 2, spread, 7, 4, 1, pearl);
    planter(v, 1, 1, 4);
  }
  if (lv === 5) {
    arc(v, 0, 5, 6, spread, 8, 1, -1.7, 1.7, teal);
    pod(v, 0, 7, 13, 3);
    leaf(v, -7, 9, -9, 15, 7, false);
  }
}

function storyCanopy(c: Ctx) {
  const { v, lv, hx, hz } = c,
    x = lv >= 3 ? -3 : 0,
    z = -2,
    top = 5 + lv;
  v.box(x - 1, 1, z - 1, x + 1, top + 1, z + 1, steel);
  const sites = [
    [-4, 1, 0],
    [6, -2, 1],
    [1, 6, 2],
    [-12, -3, 3],
    [10, 5, 4],
  ];
  for (let i = 0; i < lv; i++) {
    const [dx, dz, dy] = sites[i],
      xx = x + dx,
      zz = z + dz;
    span(v, x, top - 2, z, xx, top + dy, zz, 0, gold);
    pod(v, xx, top + dy, zz, lv > 2 ? 3 : 2, i % 2 ? "#899ab0" : teal);
    if (lv >= 3) {
      const bx = x + Math.round(dx * 0.72),
        bz = z + Math.round(dz * 0.72);
      arc(v, bx, bz, 0, 3, 3, 0, 0.6, 5.1, "path2");
      planter(v, bx, 1, bz);
      span(v, bx, 2, bz, xx, top + dy - 1, zz, 0, teal);
    }
  }
  planter(v, x + 2, 1, z + 1);
  publicWalk(v, x, z + 3, hz);
  if (lv >= 2) bench(v, x + 2, 1, 3);
  if (lv >= 3) {
    span(v, x - 2, 1, 7, x, top + 1, z, 1, pearl);
    planter(v, x - 6, 1, 6);
  }
  if (lv >= 4) {
    port(v, hx - 11, 1, -hz + 3, 8, 7, 5);
    span(v, x + 5, top + 1, -3, hx - 7, 5, -hz + 8, 0, glass);
  }
  if (lv === 5) {
    arc(v, x, z, top + 3, 10, 7, 1, 1.6, 4.4, pearl);
    pod(v, x, top + 4, z - 7, 3);
  }
}

// Broken orbit, folded terraces, paired ribs and a branching canopy each organize real reading spaces around daylight.
export function memoryOrbit(c: Ctx, active: boolean) {
  c.vpick([brokenOrbit, leafTerrace, archiveRibs, storyCanopy])(c);
  const { v, hx, hz, lv } = c;
  const [x, z] = c.vpick([
    [1, 1],
    [-hx + 5, -hz + 7],
    [0, -hz + 7],
    [lv >= 3 ? -3 : 0, -2],
  ]);
  // A projected reading leaf hangs above its charger. The two separated light sources keep the shelf below visible.
  v.box(x - 1, 1, z, x + 2, 2, z + 2, teal);
  v.put(x, 2, z, glow, 0.45);
  v.box(x - 1, 4, z, x + 1, 5, z + 2, glass, active ? 0.9 : 0.18);
  v.put(x + 1, 5, z, pearl);
  if (active) {
    person(v, x + 2, 1, z + 2, "#9368a5");
    v.put(x + 2, 3, z + 1, glow, 0.55);
  }
}

const capsule = "#e49b58",
  postal = "#53758a";
function parcel(v: PixelVox, x: number, y: number, z: number) {
  v.box(x, y, z, x + 3, y + 2, z + 2, capsule);
  v.put(x + 1, y + 1, z + 1, "#fff0bd");
}
function carrier(v: PixelVox, x: number, y: number, z: number) {
  slab(v, x - 2, y, z - 1, 5, 3, night);
  v.box(x - 2, y + 1, z - 1, x + 2, y + 3, z + 2, "#b8a8cc");
  v.box(x + 1, y + 1, z - 1, x + 3, y + 2, z + 2, glass, 0.22);
  v.put(x - 2, y + 2, z, capsule);
}
function mailWindow(v: PixelVox, x: number, z: number) {
  v.box(x, 1, z, x + 4, 2, z + 2, postal);
  v.box(x, 2, z, x + 4, 3, z + 1, pearl);
  person(v, x + 1, 1, z - 1, postal);
  parcel(v, x + 2, 2, z);
}
// Open lower shell along the transfer lane. Full compression bands leave the parcel visible between stations.
function tube(v: PixelVox, x0: number, x1: number, y: number, z: number) {
  for (let x = x0; x <= x1; x++) {
    const band = (x - x0) % 6 === 0 || x === x1;
    for (let a = 0; a < 18; a++) {
      const t = (a * Math.PI) / 9;
      if (!band && Math.cos(t) > 0.05) continue;
      const yy = y + Math.round(2 * Math.cos(t)),
        zz = z + Math.round(2 * Math.sin(t));
      v.put(x, yy, zz, band ? pearl : Math.sin(t) < -0.5 ? glass : postal, band ? 0 : 0.14);
    }
    if (band) {
      v.box(x, 1, z - 1, x + 1, y - 1, z + 2, steel);
      v.put(x, y + 2, z, glow, 0.7);
    }
  }
}
function parallelPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    left = -hx + 3,
    right = hx - 4,
    back = -hz + 4;
  tube(v, left, right, 4, back);
  parcel(v, active ? left + 3 : right - 4, 3, back);
  mailWindow(v, left, back + 5);
  publicWalk(v, left + 2, back + 6, hz);
  if (lv >= 2) {
    tube(v, left + 5, right, 4, 2);
    carrier(v, right - 2, 1, 5);
  }
  if (lv >= 3) {
    port(v, left, 1, back + 6, 8, 6, 6, postal);
    span(v, left + 4, 5, back, left + 4, 3, 4, 0, teal);
    parcel(v, 0, 3, 2);
  }
  if (lv >= 4) {
    tube(v, left + 11, right, 8, back + 5);
    span(v, 0, 4, 2, 5, 8, back + 5, 1, teal);
    carrier(v, right - 2, 1, 10);
  }
  if (lv === 5) {
    port(v, left + 5, 1, 6, 12, 6, 7);
    tube(v, left + 7, right - 1, 10, 7);
    parcel(v, right - 7, 9, 7);
  }
}
function carouselPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    x = lv > 1 ? -3 : 0,
    z = lv > 2 ? -2 : -1,
    r = lv < 3 ? 4 : 7;
  v.cylinderY(x, z, 1, 3, r, steel);
  arc(v, x, z, 3, r, r, 0, 0, Math.PI * 2, pearl);
  for (let i = 0; i < 4; i++) {
    const a = (i * 0.5 + (active ? 0.15 : 0)) * Math.PI;
    parcel(v, x + Math.round((r - 1) * Math.sin(a)) - 1, 3, z + Math.round((r - 1) * Math.cos(a)) - 1);
  }
  v.cylinderY(x, z, 3, lv + 4, 1.8, postal);
  v.put(x, lv + 4, z, glow, 0.7);
  mailWindow(v, -hx + 2, hz - 3);
  publicWalk(v, -hx + 3, hz - 2, hz);
  if (lv >= 2) {
    tube(v, x + r, hx - 4, 4, z);
    carrier(v, hx - 5, 1, 4);
  }
  if (lv >= 3) {
    arc(v, x, z, 5, r + 2, r + 2, 1, 2.3, 4.5, teal);
    port(v, -hx + 2, 1, -hz + 2, 7, 5, 5, postal);
  }
  if (lv >= 4) {
    const q = hx - 9;
    v.cylinderY(q, 3, 1, 5, 5, postal);
    arc(v, q, 3, 5, 5, 5, 0, 0, 6.3, pearl);
    parcel(v, q, 5, 5);
    tube(v, x + 4, q, 6, 0);
  }
  if (lv === 5) {
    arc(v, x, z, 9, r + 2, r + 2, 1, -1.6, 1.6, glass);
    for (const side of [-1, 1]) span(v, x + side * (r + 2), 4, z, x + side * (r + 2), 9, z, 0, steel);
    carrier(v, hx - 7, 2, hz - 5);
  }
}
function combPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    left = -hx + 3,
    back = -hz + 3,
    bays = lv + 1;
  const spacing = Math.min(7, Math.floor((2 * hx - 7) / (bays - 1))),
    end = left + (bays - 1) * spacing;
  port(v, left, 1, back, end - left + 1, 4, 4, postal);
  for (let i = 0; i < bays; i++) {
    const x = left + i * spacing,
      dock = back + 7 + (i % 2) * 2 + (lv >= 3 ? 3 : 0);
    span(v, x, 2, back + 3, x, 2, dock, 1, teal);
    span(v, x, 3, back + 4, x, 3, dock, 0, glow);
    v.box(x - 1, 3, back + 2, x + 1, 7 + (i % 2), back + 3, steel);
    span(v, x, 6 + (i % 2), back + 2, x, 5 + (i % 2), dock - 2, 1, pearl);
    if (i % 2 === 0) carrier(v, x, 2, dock);
    else parcel(v, x - 1, 3, active ? dock - 2 : back + 5);
  }
  publicWalk(v, left, back + 8, hz);
  person(v, left + 2, 1, back + 7, postal);
  if (lv >= 3) {
    mailWindow(v, left + 3, hz - 5);
    planter(v, end, 1, hz - 4);
  }
  if (lv >= 4) {
    port(v, end - 3, 5, back - 1, 6, 5, 7, glass);
    parcel(v, end - 2, 5, back + 5);
  }
  if (lv === 5) {
    tube(v, left + 1, end - 2, 10, back + 4);
    span(v, end - 3, 5, back + 5, end - 5, 9, back + 4, 1, teal);
  }
}
function switchPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c,
    hubX = 0,
    hubZ = lv > 2 ? 2 : 0,
    front = hz - 4,
    back = -hz + 3;
  const terminals = [
    [-hx + 3, back],
    [hx - 4, back],
  ];
  if (lv >= 2) terminals.push([hx - 4, 2]);
  if (lv >= 3) terminals.push([-hx + 3, 4]);
  if (lv >= 4) terminals.push([hx - 5, front - 1]);
  for (const [index, [x, z]] of terminals.entries()) {
    const lift = lv >= 3 && index % 2 === 0 ? 4 : 2;
    span(v, hubX, 2, hubZ, x, lift, z, 1, postal);
    span(v, hubX, 3, hubZ, x, lift + 1, z, 0, teal);
    v.box(x - 1, 1, z - 1, x + 2, lift + 2, z + 2, steel);
    slab(v, x - 2, lift + 2, z - 2, 5, 4, pearl);
    if (index < 2) {
      const t = active ? 0.62 : 0.28;
      parcel(v, Math.round(x * t) - 1, 3 + Math.round((lift - 2) * t), Math.round(hubZ + (z - hubZ) * t));
    }
  }
  v.cylinderY(hubX, hubZ, 2, 5, 2, pearl);
  v.put(hubX, 5, hubZ, capsule, 0.35);
  span(v, hubX, 2, hubZ, hubX, 2, front, 1, postal);
  mailWindow(v, -2, front + 1);
  publicWalk(v, 0, front + 2, hz);
  if (lv >= 2) carrier(v, hx - 5, 1, 4);
  if (lv >= 3) {
    port(v, -hx + 3, 1, -hz + 7, 7, 6, 6);
    bench(v, 5, 1, front);
  }
  if (lv >= 4) {
    span(v, -7, 2, 8, -3, 8, 3, 1, pearl);
    slab(v, -4, 8, 0, 7, 5, glass);
    person(v, 0, 9, 1, postal);
  }
  if (lv === 5) {
    tube(v, -hx + 5, hx - 6, 7, back + 2);
    carrier(v, -hx + 6, 1, front);
  }
}

// The sorting route can be parallel, circular, comb-shaped or a branching switch. Active parcels advance along the same line.
export function pneumaticPost(c: Ctx, active: boolean) {
  const { v, lv, hx, hz } = c;
  // The paved loading lane follows the work rather than filling every parcel with one slab.
  const rail = c.vpick([-hz + 4, lv > 2 ? -2 : -1, -hz + 5, lv > 2 ? 2 : 0]);
  const left = -hx + 3,
    right = hx - 4;
  if (c.variant === 1) {
    const r = lv < 3 ? 5 : 8;
    arc(v, lv > 1 ? -3 : 0, rail, 0, r, lv < 3 ? 4 : r, 1, 0, Math.PI * 2, "#9aaca6");
    span(v, lv > 1 ? -3 : 0, 0, rail + 2, left + 2, 0, hz - 3, 1, "path2");
  } else if (c.variant === 3) {
    for (const side of [-1, 1]) span(v, 0, 0, rail, side * (hx - 4), 0, -hz + 4, 1, "#a6b3ae");
    publicWalk(v, 0, rail + 1, hz, 5);
  } else {
    slab(v, left - 1, 0, rail - 1, right - left + 3, 4, "#a3b1ad");
    span(v, left + 2, 0, rail, left + 2, 0, hz - 2, 1, "path2");
    if (lv >= 2) span(v, left + 2, 0, rail + 3, right, 0, rail + 4, 1, "path2");
  }
  c.vpick([parallelPost, carouselPost, combPost, switchPost])(c, active);
}
