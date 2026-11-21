import { packVoxKey, PixelVox } from "../voxelCore";
import { roadWidth, standardRoadLanes } from "../roadStandards";
import { corridorTransform, type CorridorArt } from "../roadCorridors";

/** A 32-pixel survey cross-section keeps the lane paint narrow on divided carriageways.
 * Datum is meters; after tessellation, the tapered stretch uses the identical profile as the moving fleet. */
export function dividedCarriageway(id: string, level: number, variant: number, mask: number, art: CorridorArt) {
  const vox = new PixelVox(1),
    along = art.axis === "x",
    crossMask = along ? 5 : 10;
  const color = ["#485158", "#665550", "#4b5663", "#495350"][variant % 4];
  const frame = ["#51666b", "#825c49", "#536780", "#52665c"][variant % 4];
  const box = (u: number, y: number, v: number, w: number, h: number, d: number, c: string, e = 0) =>
    along ? vox.box(u, y, v, u + w, y + h, v + d, c, e) : vox.box(v, y, u, v + d, y + h, u + w, c, e);
  box(-16, 0, -16, 32, 2, 32, color);
  const isCross = (mask & crossMask) !== 0,
    lanes = standardRoadLanes(id, level),
    edge = 14;
  for (const sign of [-1, 1]) {
    const outer = sign > 0 ? 15 : -16;
    const perpendicular = along ? (sign > 0 ? 4 : 1) : sign > 0 ? 2 : 8;
    const sideOpen = Boolean(mask & perpendicular);
    if (!sideOpen) {
      box(-16, 2, outer, 32, 1, 1, "#a5a394");
      if (level >= 3 && art.station % 2 === 0) {
        box(-10, 3, outer, 1, 2, 1, "#81918f");
        box(5, 3, outer, 1, 2, 1, "#81918f");
      }
      if (level >= 6) box(-16, 4, outer, 32, 1, 1, "#aab7b6");
      if (level >= 8 && (variant % 2 === 1 || art.station >= 3)) {
        box(-16, 5, outer, 32, level >= 10 ? 4 : 2, 1, frame);
        for (const u of [-14, -4, 6]) box(u, 5, outer, 1, level >= 10 ? 4 : 2, 1, "#9baaa7");
      }
    }
    for (let u = -16; u < 16; u++) {
      if (sideOpen && Math.abs(u) < 8) continue;
      box(u, 2, sign > 0 ? 14 : -15, 1, 1, 1, level >= 3 ? "#e5e1cd" : "#bcbcb2");
      if (isCross && Math.abs(u) < 7) continue;
      for (let lane = 1; lane < lanes / 2; lane++) {
        const v = sign * Math.round((lane * (edge - 1)) / (lanes / 2));
        if ((u + 16) % 16 < 8) box(u, 2, v, 1, 1, 1, "#d4d1be");
      }
      if (level >= 2 && Math.abs(u) % 10 < 5) box(u, 2, sign > 0 ? 1 : -2, 1, 1, 1, "#d3ab59");
    }
  }
  if (!isCross && art.station % 3 === 0) {
    const v = 15,
      trunk = "#72674a";
    if (variant === 0) {
      box(-6, 2, v - 1, 2, 10, 1, trunk);
      box(-9, 9, v - 2, 7, 3, 2, "#45684f");
      box(-8, 12, v - 2, 5, 3, 2, "#547858");
      box(-7, 15, v - 1, 3, 2, 1, "#66865c");
    } else if (variant === 1) {
      box(-6, 2, v - 1, 2, 8, 1, trunk);
      box(-5, 10, v - 1, 2, 5, 1, trunk);
      box(-7, 15, v - 2, 6, 2, 2, "#637c48");
      box(-10, 14, v - 1, 4, 2, 1, "#788d4c");
      box(-2, 13, v - 2, 4, 2, 1, "#607d48");
      box(-5, 14, v - 4, 2, 2, 3, "#748e50");
    } else if (variant === 2) {
      for (const [u, h] of [
        [-10, 3],
        [-6, 5],
        [-3, 3],
      ])
        box(u, 2, v - 1, 3, h, 2, "#95866a");
      box(5, 2, v, 1, 6, 1, trunk);
      box(4, 8, v - 1, 4, 3, 1, "#a57448");
    } else {
      for (const u of [-14, -4, 6]) {
        box(u, 3, v, 2, 6, 1, frame);
        box(u + 1, 6, v - 1, 7, 3, 1, "#8eaeac");
      }
    }
  }
  if (!isCross && level >= 4) {
    box(-16, 2, -1, 32, 1, 2, "#acaa96");
    if (level >= 5) box(-16, 3, -1, 32, level >= 8 ? 2 : 1, 2, "#9c9d91");
  }
  if (!isCross && art.station === 2 && level >= 5) {
    box(-5, 3, -16, 2, level >= 9 ? 16 : 12, 1, frame);
    const y = level >= 9 ? 18 : 14;
    box(-5, y, -16, 2, 2, level >= 9 ? 32 : 14, frame);
    if (level >= 9) box(-5, 3, 15, 2, 16, 1, frame);
    const size = level >= 8 ? 9 : 6;
    box(-5, y - 4, -13, 2, 4, size, ["#306451", "#3b6084", "#86603b", "#48696d"][variant % 4]);
    box(-6, y - 3, -12, 1, 1, Math.max(2, size - 3), "#d5e3cc");
    box(-6, y - 2, -11, 1, 1, 2, "#d5e3cc");
    if (level >= 9) for (const v of [-6, 1, 7]) box(-5, y - 2, v, 1, 2, 2, level === 11 ? "#80eeb0" : "#d3b96d", 0.45);
  }
  if (level >= 7 && !isCross && art.station === 4) {
    box(6, 3, 14, 1, 13, 1, frame);
    box(6, 15, 10, 1, 1, 5, frame);
    box(5, 14, 9, 3, 1, 3, "#efdba3", 0.6);
  }
  if (level >= 10 && !isCross) {
    for (const u of [-11, 5]) {
      box(u, 3, -2, 2, 1, 1, "#e0b265", 0.3);
      box(u, 3, 1, 2, 1, 1, "#e0b265", 0.3);
    }
  }
  if (level >= 11 && art.station === 0) {
    box(-8, 3, 15, 3, 3, 1, "#466b73");
    box(-8, 6, 15, 3, 1, 1, "#a1deda", 0.5);
  }
  return vox;
}

/** Three successive construction cells expose the cross section, perimeter planting and overhead equipment together. */
export function guideCarriageway(id: string, station: number): CorridorArt {
  const width = roadWidth(id);
  return { axis: "x", width, minus: width, plus: width, station };
}
export function guideCarriagewayVoxels(id: string, level: number, variant: number) {
  const vox = new Map<number, number>();
  for (let station = 0; station < 3; station++) {
    const art = guideCarriageway(id, station),
      piece = dividedCarriageway(id, level, variant, 10, art);
    for (const [k, style] of piece.v) {
      const x = ((k >>> 20) & 1023) - 512,
        y = ((k >>> 10) & 1023) - 512,
        z = (k & 1023) - 512;
      const start = Math.round(corridorTransform(art, x / 8, z / 8) * 8),
        end = Math.round(corridorTransform(art, x / 8, (z + 1) / 8) * 8);
      for (let j = start; j < end; j++) vox.set(packVoxKey(x + (station - 1) * 32, y, j), style);
    }
  }
  return vox;
}
