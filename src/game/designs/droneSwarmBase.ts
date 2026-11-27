import { type Ctx, type PixelVox, byLv, person, ring } from "./kit";
import { glassFront, spinner } from "./commerceKit";
import { beam, entrance, finish as f, oval, slab, storey } from "./sculpturalKit";
import { swarmDockLayout, parkDisplayDrone, type VoxelPoint } from "./militaryDisplayKit";

const fleet = ["#59a99c", "#cc8759", "#8b84ae", "#79adc0"];

function benchBay(c: Ctx, x: number, z: number, w: number) {
  const { v } = c;
  v.box(x, 1, z, x + w, 3, z + 3, "#617a73");
  v.box(x - 1, 3, z, x + w + 1, 4, z + 3, "#d8bb8d");
  for (let i = 1; i < w - 1; i += 3) {
    v.box(x + i, 4, z, x + i + 2, 5, z + 1, "#a6b8ad");
    v.put(x + i + 1, 4, z + 1, f.amber, 0.65);
  }
  person(v, x + 1, 1, z + 3, "teal");
  entrance(c, x + 2, z + 4, 2);
}

function roofLadder(v: PixelVox, x: number, z: number, height: number) {
  for (const dx of [0, 2]) v.box(x + dx, 1, z, x + dx + 1, height + 2, z + 1, f.bronze);
  for (let y = 2; y <= height + 1; y += 2) v.box(x, y, z, x + 3, y + 1, z + 1, f.silver);
}

function berth(c: Ctx, dock: VoxelPoint, i: number) {
  const { v, variant, lv } = c,
    [x, y, z] = dock;
  const edge = fleet[variant],
    w = lv >= 4 ? 4 : 3,
    d = 3;
  if (y > 3) {
    for (const side of [-1, 1]) {
      v.box(x + side * (w - 1), 1, z - 2, x + side * (w - 1) + 1, y - 1, z + 2, "#526868");
      beam(v, [x + side * (w - 1), 2, z + 2], [x, y - 2, z + 2], edge);
    }
  }
  for (let dx = -w; dx <= w; dx++)
    for (let dz = -d; dz <= d; dz++) {
      if (Math.abs(dx) === w && Math.abs(dz) === d) continue;
      const outer = Math.abs(dx) === w || Math.abs(dz) === d;
      v.put(x + dx, y - 1, z + dz, outer ? edge : "#677876");
      if (outer && ((dx === 0 && dz === d) || (Math.abs(dx) === w && dz === 0)))
        v.put(x + dx, y - 1, z + dz, "#e8d8ac", 0.66);
    }
  // The painted split circle stays visible when the inspection lantern leaves its berth.
  ring(v, x + 0.5, z + 0.5, y - 1, y, 2.45, 1.5, "#c7c9ac");
  v.put(x + 2, y - 1, z, "#e5d19e", 0.6);
  parkDisplayDrone(c, dock, i);
}

function carousel(c: Ctx, docks: VoxelPoint[]) {
  const { v, lv, hx, hz } = c,
    r = byLv(c, [4, 5, 7, 9, 11]),
    h = byLv(c, [4, 6, 8, 11, 14]),
    z = -1;
  // An open drum houses the workshop. Radial promenades run from the lantern hub to the pads.
  for (const [px, , pz] of docks) beam(v, [0, 0, z], [px, 0, pz], "#c1b9a1", 2);
  v.cylinderY(0.5, z + 0.5, 0, 1, r + 3, "#d5c5a7");
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++) {
      const radius = Math.hypot(dx, dz);
      if (radius < r - 1.1 || radius > r + 0.3 || (dz > 0 && Math.abs(dx) < r * 0.68)) continue;
      v.box(dx, 1, z + dz, dx + 1, h, z + dz + 1, "#417470");
      v.put(dx, h - 1, z + dz, f.bronze);
      if (dx % 3 === 0 && dz >= 0) v.put(dx, 3, z + dz, f.amber, 0.7);
    }
  ring(v, 0.5, z + 0.5, h, h + 2, r + 1, Math.max(1, r - 1.25), "#95b8a5");
  benchBay(c, -Math.min(3, r - 1), z + Math.floor(r * 0.45), 5);
  roofLadder(v, -r + 1, z - 1, h + 1);
  if (lv >= 2) {
    v.cylinderY(0.5, z + 0.5, 1, h + 2, 1.6, f.cedar);
    for (const a of [0, 2.1, 4.2]) beam(v, [0, h + 1, z], [Math.cos(a) * r, h + 2, z + Math.sin(a) * r], f.bronze);
    const lampY = h + 3;
    v.sphere(0, lampY, z, 2, 2, 2, f.amber, 0.58);
    docks[1][1] = 4;
  }
  if (lv >= 3) {
    const rad = r * 0.72;
    for (let index = 0; index < 8; index++) {
      const angle = (index * Math.PI) / 4,
        px = Math.round(Math.cos(angle) * rad),
        pz = z + Math.round(Math.sin(angle) * rad);
      v.box(px, h + 1, pz, px + 1, h + 6, pz + 1, f.bronze);
      v.put(px, h + 4, pz, "#8fbeb5", 0.43);
    }
    ring(v, 0.5, z + 0.5, h + 6, h + 7, rad + 0.8, rad - 0.7, f.limestone);
    for (let i = 2; i < docks.length; i++) docks[i][1] = 4 + (i % 2) * 2;
  }
  if (lv >= 4) {
    const py = h + 4;
    for (let i = 0; i < 10; i++) {
      const a = ((0.15 + i * 0.5) * Math.PI) / 3,
        px = Math.round(Math.cos(a) * (r + 2)),
        pz = z + Math.round(Math.sin(a) * (r + 2));
      v.box(px, py, pz, px + 2, py + 1, pz + 2, "#a98862");
      if (i % 3 === 0) v.box(px, 1, pz, px + 1, py, pz + 1, f.cedar);
    }
    for (const side of [-1, 1]) {
      const xx = side * (r + 1);
      beam(v, [xx, 1, z + 4], [xx, h + 1, z], f.silver);
    }
    person(v, r + 1, py + 1, z + 2, "orange");
  }
  if (lv === 5) {
    docks[5][2] -= 2;
    const y = h + 7,
      rim = r * 0.66;
    for (let a = 0; a < 60; a++) {
      const angle = (a * Math.PI) / 30,
        xx = Math.round(Math.cos(angle) * rim),
        zz = z + Math.round(Math.sin(angle) * rim);
      const crest = Math.round(2 + 2 * Math.sin(angle * 3));
      v.box(xx, y, zz, xx + 1, y + crest + 1, zz + 1, a % 6 < 2 ? f.bronze : "#82a89a");
    }
    const crown = spinner(c, 0, y + 4, z, "y", 0.18);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      beam(crown, [0, 0, 0], [4 * Math.cos(a), 1, 4 * Math.sin(a)], f.gold);
      crown.put(Math.round(4 * Math.cos(a)), 2, Math.round(4 * Math.sin(a)), f.amber, 0.6);
    }
    const ex = hx - 8,
      ez = 0;
    v.box(ex - 3, 1, ez - 3, ex + 4, 6, ez + 4, "#758d7e");
    glassFront(v, ex - 2, ex + 3, 2, 5, ez + 3, f.cedar, 3, f.amber);
    v.box(ex - 4, 6, ez - 4, ex + 5, 7, ez + 5, "#bdad8a");
    entrance(c, ex, ez + 4, 2);
    person(v, -hx + 8, 1, 1, "teal");
  }
}
function kite(c: Ctx, docks: VoxelPoint[]) {
  const { v, lv, hx, hz } = c,
    fore = byLv(c, [4, 6, 7, 9, 11]),
    aft = byLv(c, [4, 5, 7, 8, 10]),
    w = byLv(c, [4, 6, 9, 11, 14]),
    h = byLv(c, [7, 10, 13, 16, 20]);
  // Four swept triangular sections bend upwards at the ridge above a diagonal repair lane.
  for (let dz = -aft; dz <= fore; dz++) {
    const t = (dz + aft) / (aft + fore),
      width = Math.max(1, Math.round(w * (1 - Math.abs(2 * t - 1))));
    const cx = Math.round((t - 0.5) * w),
      y = h - Math.round(t * 4);
    for (let dx = -width; dx <= width; dx++) {
      const rise = Math.round((Math.abs(dx) / w) * (4 + lv));
      v.put(cx + dx, y + rise, dz, dx === 0 || Math.abs(dx) === width ? "#845d49" : dx < 0 ? "#c78a64" : "#f1cfa0");
      if (dx % 5 === 0) v.put(cx + dx, y + rise - 1, dz, "#a18367");
    }
    v.box(cx - 2, 0, dz, cx + 3, 1, dz + 1, "#b8b3a1");
  }
  for (const side of [-1, 1]) beam(v, [side * 2, 1, 0], [side * w, h + 3, -1], f.cedar, 2);
  v.hollowBox(-4, 1, -aft + 1, 2, 5, -1, "#547c79");
  glassFront(v, -3, 1, 2, 5, -2, f.bronze, 3, f.amber);
  benchBay(c, -3, fore - 2, 6);
  roofLadder(v, -3, -aft + 1, h);
  for (const [px, , pz] of docks) beam(v, [px, 0, pz], [Math.sign(px) * 3, 0, Math.sign(pz) * 3], "#c4b39a", 2);
  if (lv >= 2) {
    for (let side = -1; side <= 1; side += 2) v.box(side * 2, 1, -aft + 2, side * 2 + 1, h - 2, -aft + 3, f.bronze);
    v.box(-3, 4, -aft + 2, 4, 5, -aft + 5, f.limestone);
    v.box(-2, 1, -aft + 2, 3, 4, -aft + 3, "#5d837c");
    for (let i = 1; i < docks.length; i += 2) docks[i][1] = 4;
  }
  if (lv >= 3) {
    const wingX = lv === 3 ? -10 : -12;
    // An outward-facing tool shed opens into its own covered work lane.
    for (let i = 0; i < 6; i++) v.box(wingX + i, 5 + i, 1, wingX + i + 1, 6 + i, 7, "#799790");
    v.box(wingX, 1, 1, wingX + 1, 5, 7, f.cedar);
    v.box(wingX + 5, 1, 1, wingX + 6, 10, 2, f.cedar);
    v.box(wingX + 1, 2, 2, wingX + 5, 4, 4, "#b29067");
    person(v, wingX + 3, 1, 5, "cream");
  }
  if (lv >= 4) {
    const x = w - 2,
      z = -aft + 1;
    v.box(x, 1, z, x + 2, h + 9, z + 2, f.bronze);
    beam(v, [x, h + 7, z], [0, h + 1, 0], f.gold);
    for (let i = 0; i < 6; i++)
      v.box(
        x + i,
        h + 6 - Math.floor(i / 3),
        z,
        x + i + 1,
        h + 8 - Math.floor(i / 3),
        z + 2,
        i % 2 ? f.porcelain : "#b16a54",
      );
    docks[0][1] = 6;
    docks[3][1] = 7;
  }
  if (lv === 5) {
    const x = hx - 17,
      z = 7;
    for (let dx = -5; dx <= 5; dx++)
      for (let dz = -5; dz <= 5; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 6) continue;
        v.put(x + dx, 9 + Math.abs(dx) + Math.floor(dz / 4), z + dz, "#8aab9c");
      }
    beam(v, [x - 2, 1, z], [x + 1, 10, z], f.cedar, 2);
    beam(v, [x + 5, 1, z], [x + 4, 12, z], f.bronze);
    v.box(1, 7, 2, x + 1, 8, 4, f.limestone);
    person(v, x - 3, 8, 3, "teal");
    entrance(c, x, z + 6, 2);
  }
}
function liftExchange(c: Ctx, docks: VoxelPoint[]) {
  const { v, lv } = c,
    w = byLv(c, [3, 4, 4, 5, 6]),
    h = byLv(c, [9, 12, 17, 22, 27]);
  // The display lifts carry separate platforms up open lattice rails. Nothing sits over the berths.
  for (const side of [-1, 1]) {
    const px = side * w;
    v.box(px, 1, -3, px + 1, h + 1, -1, f.bronze);
    v.box(px, 1, 2, px + 1, h + 1, 4, f.bronze);
    for (let y = 2; y < h - 2; y += 4) {
      beam(v, [px, y, -2], [px, y + 3, 3], "#7f8296");
      v.box(px, y, -2, px + 1, y + 1, 4, "#627783");
    }
  }
  v.box(-w, h, -3, w + 2, h + 2, 4, "#8297a4");
  const wheel = spinner(c, 0, h + 1, 1, "z", 0.16);
  wheel.ringZ(0, 0, 0, 2, lv >= 3 ? 4 : 3, lv >= 3 ? 2.5 : 1.6, f.gold);
  beam(wheel, [-2, -1, 0], [2, 1, 0], f.cedar);
  const cab = Math.max(3, Math.round(h * 0.45));
  v.hollowBox(-w + 1, cab, -2, w, cab + 4, 3, "#76899b");
  glassFront(v, -w + 1, w, cab + 1, cab + 4, 2, f.ink, 3, "#e4c891");
  benchBay(c, -2, 4, 4);
  docks.forEach(([x, , z], i) => {
    const y = 3 + Math.round((lv + 1) * (0.45 + (i % 3) * 0.65));
    docks[i][1] = y;
    const side = Math.sign(x);
    beam(v, [side * w, Math.max(2, cab - 1), 0], [x - side * 5, y - 3, z], "#737d89", 2);
    v.box(x - side * 5, y - 3, z, x, y - 2, z + 2, "#737d89");
    if (lv >= 3 && i % 2 === 0) v.box(x - 2, y - 2, z - 2, x + 2, y - 1, z + 3, f.silver);
  });
  if (lv >= 2) {
    const z = c.hz - 7;
    v.box(-3, 1, z - 2, 4, 5, z + 3, "#aca589");
    glassFront(v, -2, 3, 2, 4, z + 2, f.cedar, 3, f.amber);
    v.box(-4, 5, z - 3, 5, 6, z + 4, f.limestone);
  }
  if (lv >= 3) {
    for (let i = 0; i < 3; i++) v.box(w + i * 2, 2 + i * 2, -2, w + 3 + i * 2, 3 + i * 2, 4, "#a39178");
    v.box(w + 3, 1, 3, w + 4, 7, 4, f.silver);
    v.box(-w - 3, 1, -2, -w - 2, h - 2, 0, f.silver);
  }
  if (lv >= 4) {
    const yardZ = c.hz - 9;
    v.box(-4, 6, 3, -2, 7, yardZ, f.limestone);
    for (let z = 5; z < yardZ; z += 3) v.box(-4, 7, z, -3, 9, z + 1, f.bronze);
    person(v, -3, 7, yardZ - 1, "red");
  }
  if (lv === 5) {
    for (const dz of [-2, 2]) beam(v, [-w, h + 2, dz], [0, h + 8, dz], f.bronze, 2);
    for (const dz of [-2, 2]) beam(v, [w, h + 2, dz], [0, h + 8, dz], f.bronze, 2);
    v.put(0, h + 8, 1, f.amber, 0.7);
    const px = 7,
      pz = -c.hz + 7;
    const plan = oval(px, pz, 5, 4, 8);
    storey(v, plan, plan, 1, 7, "#627489", f.limestone);
    entrance(c, px, pz + 4, 2);
  }
}
function glasswing(c: Ctx, docks: VoxelPoint[]) {
  const { v, lv, hx, hz } = c,
    width = byLv(c, [5, 6, 8, 11, 13]),
    depth = byLv(c, [5, 7, 8, 10, 12]),
    h = byLv(c, [4, 6, 8, 11, 14]);
  // The broad crescent wraps a sheltered workshop court. Its open upper tracery
  // catches the light without covering the landing piers outside the curve.
  const outer = width + 2,
    thick = lv >= 3 ? 3 : 2;
  for (let i = 0; i <= 100; i++) {
    const a = ((35 + i * 2.9) * Math.PI) / 180,
      sa = Math.sin(a),
      ca = Math.cos(a);
    const t = i / 100,
      canopy = h + Math.round(2 * Math.sin(t * Math.PI) + Math.abs(2 * t - 1) * lv);
    for (let delta = -thick; delta <= 1; delta++) {
      const px = Math.round((outer + delta) * sa),
        pz = Math.round((depth + delta) * ca);
      const rib = delta === 1 || delta === -thick || i % 10 < 2;
      v.put(px, canopy + Math.max(0, delta), pz, rib ? "#648b87" : "#aac6b2");
      v.put(px, 0, pz, "#b5c2a7");
      if (delta === 1) {
        const col = i % 8 < 2 ? f.bronze : "#5b8586";
        v.box(px, 1, pz, px + 1, canopy, pz + 1, col);
        if (i % 8 === 3) v.put(px, 3, pz, f.amber, 0.55);
      } else if (delta === -thick && i % 12 === 0) v.box(px, 1, pz, px + 1, canopy, pz + 1, f.cedar);
    }
  }
  for (const [px, , pz] of docks) beam(v, [px, 0, pz], [0, 0, 2], "#b8bb9f", 2);
  roofLadder(v, -3, -depth + 1, h + 2);
  v.box(-2, 0, -depth, 3, 1, depth + 1, "#d4bc99");
  benchBay(c, -2, depth - 2, 5);
  if (lv >= 2) {
    const rear = -Math.floor(depth * 0.55);
    v.box(-4, 1, rear - 1, 5, 5, rear + 1, "#738b87");
    glassFront(v, -3, 4, 2, 4, rear, f.bronze, 3, f.amber);
    if (lv === 2) {
      docks[1][0] += 1;
      docks[1][2] += 1;
    }
    const ys = [3, 4, 3];
    for (let i = 0; i < docks.length; i++) docks[i][1] = ys[i % 3];
  }
  if (lv >= 3) {
    for (let i = 0; i < 14; i++) {
      const a = ((40 + i * 7.8) * Math.PI) / 180,
        x = Math.round((width + 3) * Math.cos(a)),
        z = Math.round(depth * Math.sin(a)) + 3;
      v.box(x, 1, z, x + 2, 2, z + 2, "#ae9775");
      if (i % 4 === 0) v.box(x, 2, z, x + 2, 4, z + 1, "#78977b");
    }
    person(v, 3, 1, depth + 2, "blue");
  }
  if (lv >= 4) {
    const rear = -depth - 2;
    const p = oval(0, rear, 6, 3, 10);
    storey(v, p, p, 1, 6, "#5d8585", f.limestone);
    for (const side of [-1, 1]) beam(v, [side * 4, 6, rear], [side * 2, h + 2, -2], f.gold);
    for (let i = 0; i < docks.length; i++) docks[i][1] = i % 2 === 0 ? 4 : 6;
  }
  if (lv === 5) {
    const sky = h + 2;
    for (const side of [-1, 1]) v.box(side * 3, 1, 4, side * 3 + 1, sky, 6, f.cedar);
    v.box(-4, sky, 2, 5, sky + 1, 6, f.limestone);
    person(v, 0, sky + 1, 4, "teal");
    for (let i = 0; i < 7; i++) {
      const px = 1 + i,
        pz = hz - 6 - Math.round(i * 0.4);
      v.box(px, 1, pz, px + 2, i + 2, pz + 3, f.limestone);
    }
    const ex = hx - 12,
      ez = 3;
    v.cylinderY(ex, ez, 1, 4, 3, "#8eaa91");
    v.dome(ex, 4, ez, 3, "#a0beb2");
    v.put(ex, 4, ez + 2, f.amber, 0.7);
  }
}
export function buildDroneSwarmBase(c: Ctx) {
  const docks = swarmDockLayout(c);
  [carousel, kite, liftExchange, glasswing][c.variant](c, docks);
  docks.forEach((dock, i) => berth(c, dock, i));
}
