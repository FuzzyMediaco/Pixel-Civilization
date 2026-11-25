// Shared orthographic raster for the illustrated Handbook and review plates.
import { createCanvas } from "@napi-rs/canvas";
import {guideCarriagewayVoxels} from "../src/game/designs/carriageways.ts";
import {roadWidth} from "../src/game/roadStandards.ts";
import { buildDesignVoxels, buildCorridorVoxels } from "../src/game/voxelArchitect.ts";
import { buildCritterPens, critterModel, CRITTER_UNIT, restingCritters } from "../src/game/critterModels.ts";
import { getVoxelStyleColor, packVoxKey, VOXEL_SIZE } from "../src/game/voxelCore.ts";
import {ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel} from "../src/game/catalog.ts";

export function voxels(id, level, variant, mask, edges = [], appearance = {}) {
  const def = ELEMENT_BY_ID[id],
    lv = Math.min(level, getMaxElementLevel(id));
  if(mask===undefined && roadWidth(id)>1)
    return guideCarriagewayVoxels(id,lv,variant,art=>buildCorridorVoxels(id,lv,variant,10,{...appearance,corridor:art}));
  const [width, depth] = getStandardFootprintForLevel(def, lv);
  const c = buildDesignVoxels(def, lv, variant, width, depth, mask ?? (def.isNetwork ? 5 : 0), { ...appearance, edges });
  const map = c.v.v;
  for (const r of c.rotors)
    for (const [k, s] of r.vox.v)
      map.set(
        packVoxKey(
          ((k >>> 20) & 1023) - 512 + Math.round(r.pivot[0]),
          ((k >>> 10) & 1023) - 512 + Math.round(r.pivot[1]),
          (k & 1023) - 512 + Math.round(r.pivot[2]),
        ),
        s,
      );
  // Plate cells use design voxels. Project the game's half-voxel resting poses into that grid.
  for (const [index, pen] of buildCritterPens(c.critterPens, VOXEL_SIZE, 0, 1).entries()) {
    const animal = critterModel(pen.kind, pen.coat).restVoxels;
    for (const pose of restingCritters(pen, index)) {
      const cos = Math.cos(pose.heading), sin = Math.sin(pose.heading);
      for (const [key, style] of animal.v) {
        const x = (((key >>> 20) & 1023) - 511.5) * CRITTER_UNIT;
        const y = (((key >>> 10) & 1023) - 511.5) * CRITTER_UNIT;
        const z = ((key & 1023) - 511.5) * CRITTER_UNIT;
        map.set(packVoxKey(
          Math.floor((pose.x + cos * x + sin * z) / VOXEL_SIZE),
          Math.floor((pose.y + y) / VOXEL_SIZE),
          Math.floor((pose.z - sin * x + cos * z) / VOXEL_SIZE),
        ), style);
      }
    }
  }
  return map;
}
export function faces(map) {
  let xs = [],
    minU = 1e6,
    minV = 1e6,
    maxU = -1e6,
    maxV = -1e6;
  for (const [k, style] of map) {
    const mask = (map.has(k + 1) ? 0 : 1) | (map.has(k + 1048576) ? 0 : 2) | (map.has(k + 1024) ? 0 : 4);
    if (!mask) continue;
    const x = ((k >>> 20) & 1023) - 512,
      y = ((k >>> 10) & 1023) - 512,
      z = (k & 1023) - 512;
    const u = 0.84 * (x - z),
      t = 0.42 * (x + z) - y;
    xs.push([u, t, x + y + z, mask, style]);
    minU = Math.min(minU, u - 0.84);
    maxU = Math.max(maxU, u + 0.84);
    minV = Math.min(minV, t - 1);
    maxV = Math.max(maxV, t + 0.84);
  }
  xs.sort((a, b) => a[2] - b[2]);
  return { xs, minU, minV, maxU, maxV, count: map.size };
}
export function raster(m, common, CELL = 192, centered = false, HEIGHT = CELL, transparentBg = false) {
  const canvas = createCanvas(CELL, HEIGHT);
  const ctx = canvas.getContext("2d");
  const im = ctx.createImageData(CELL, HEIGHT);
  const buf = new Uint32Array(im.data.buffer);
  // Packed native RGBA on little-endian platforms.
  const bg = transparentBg ? 0x00000000 : 0xffe3edeb;
  buf.fill(bg);
  const scale = Math.min((CELL - 10) / (m.maxU - m.minU), (HEIGHT - 12) / (m.maxV - m.minV), common);
  const ox = CELL / 2 - ((m.maxU + m.minU) * scale) / 2,
    oy = centered ? HEIGHT * 0.5 - (m.maxV + m.minV) * scale * 0.5 : HEIGHT - 8 - m.maxV * scale,
    dx = 0.84 * scale,
    dy = 0.42 * scale;
  const shades = new Map();
  for (const [u, t, depth, mask, s] of m.xs) {
    let rgb = shades.get(s);
    if (!rgb) {
      const [r, g, b] = getVoxelStyleColor(s).map(
        (value) => 255 * (value < 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055),
      );
      rgb = [0.88, 0.7, 1.04].map(
        (f) =>
          (255 << 24) |
          (Math.min(255, Math.round(b * f)) << 16) |
          (Math.min(255, Math.round(g * f)) << 8) |
          Math.min(255, Math.round(r * f)),
      );
      shades.set(s, rgb);
    }
    // Project the three exposed cube faces into vertical pixel spans.
    const cx = ox + u * scale,
      cy = oy + t * scale;
    const xlo = Math.max(0, Math.ceil(cx - dx - 0.5)),
      xhi = Math.min(CELL, Math.ceil(cx + dx - 0.5));
    for (let px = xlo; px < xhi; px++) {
      const rel = (px + 0.5 - cx) / dx,
        corner = 1 - Math.abs(rel);
      const top = cy - scale + dy * (1 - corner),
        mid = cy - scale + dy * (1 + corner),
        bottom = mid + scale;
      const ylo = Math.max(0, Math.ceil(top - 0.5)),
        ymid = Math.max(0, Math.ceil(mid - 0.5)),
        yhi = Math.min(HEIGHT, Math.ceil(bottom - 0.5));
      if (mask & 4) for (let py = ylo; py < ymid; py++) buf[py * CELL + px] = rgb[2];
      const axis = rel < 0 ? 0 : 1;
      if (mask & (axis + 1)) for (let py = ymid; py < yhi; py++) buf[py * CELL + px] = rgb[axis];
    }
  }
  ctx.putImageData(im, 0, 0);
  return canvas;
}
