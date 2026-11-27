import { PixelVox, VOXEL_SIZE } from "./voxelCore";
import type { BridgeBay, BridgeRunProfile } from "./bridgeWorks";
import { drawBridgeLandmark } from "./bridgeLandmarks";

/** The deck itself retains the engineering grade. Only this trim and the lift's
 * moving assembly are carried by the animated deck group. */
export function buildBridgeBay(run: BridgeRunProfile, index: number, width: number, bedBelowDeck: number): BridgeBay {
  const bay: BridgeBay = { ...run, index, halfWidth: Math.ceil(width / (2 * VOXEL_SIZE)),
    bed: Math.min(-1, Math.floor(bedBelowDeck / VOXEL_SIZE)), fixed: new PixelVox(), moving: new PixelVox(), weights: new PixelVox() };
  const { fixed, moving, halfWidth, bed, tier, family } = bay;
  const trim = family === "lift" ? moving : fixed;
  for (const sign of [-1, 1]) {
    const z = sign < 0 ? -halfWidth : halfWidth - 1;
    const stone = family === "gothic" || family === "rail-arch";
    const rail = stone ? "#CEB995" : family === "lift" ? "#467A80" : "#8D9A99";
    trim.box(-8, 1, z, 8, 2, z + 1, rail);
    for (const x of [-7, 1]) trim.put(x, 0, z, rail);
    if (tier >= 2) trim.box(-8, -2, z, 8, -1, z + 1, stone ? "#AC9474" : "#637578");
    if (tier >= 3) trim.put(-6, 2, z, "#EBD5A2", 0.25);
    if (tier >= 4) for (const x of [-7, 1]) trim.put(x, -2, z, stone ? "#E0D0AC" : "#B3B6A3");
    if (tier >= 5 && index % 2 === 0) {
      trim.box(4, 2, z, 5, tier >= 9 ? 5 : 4, z + 1, "#596B69");
      trim.put(4, tier >= 9 ? 5 : 4, z, "#FFE0A0", 0.55);
    }
    if (tier >= 7) trim.box(-8, -3, z, 8, -2, z + 1, stone ? "#8B765E" : "#50666B");
    if (tier >= 10) for (const x of [-4, 4]) trim.put(x, -3, z, "#D5B67A");
    if (family === "trestle") {
      fixed.box(-8, -3, z, 8, -1, z + 1, "#9A6C43");
      for (const x of [-7, 6]) fixed.box(x, bed, z, x + 1, -2, z + 1, "#72503A");
      for (let x = -6; x <= 5; x++) {
        const h = Math.max(1, -3 - bed);
        const low = Math.floor((x + 6) * h / 12), high = Math.ceil((x + 7) * h / 12);
        fixed.box(x, bed + low, z, x + 1, bed + high + 1, z + 1, "#A47C4E");
        if (tier >= 3) fixed.box(x, -3 - high, z, x + 1, -2 - low, z + 1, "#805A3B");
      }
    } else if (family === "rail-arch") {
      // Successive piers share a boundary. The central opening clears the water.
      for (let x = -8; x < 8; x++) {
        const t = Math.abs((x + 0.5) / 8);
        const underside = Math.round(-2 + (bed + 2) * (1 - Math.sqrt(1 - t * t)));
        fixed.box(x, underside, z, x + 1, -1, z + 1, "#AD977A");
        fixed.put(x, underside - 1, z, (x + index) % 3 ? "#D2BE98" : "#BFAB8B");
      }
      fixed.box(-8, bed, z, -7, -1, z + 1, "#A79176");
    } else if (family === "rail-truss") {
      const h = 4 + tier;
      fixed.box(-8, h, z, 8, h + 1, z + 1, "#52727D");
      for (let x = -8; x < 8; x++) {
        const u = (x + 8) % 8;
        const y = 1 + Math.floor(Math.min(u, 8 - u) * (h - 1) / 4);
        const next = 1 + Math.floor(Math.min(u + 1, 7 - u) * (h - 1) / 4);
        fixed.box(x, Math.min(y, next), z, x + 1, Math.max(y, next) + 1, z + 1, "#73939B");
      }
      fixed.box(-8, 0, z, -7, h, z + 1, "#455F68");
      if (tier >= 3) fixed.put(-8, h, z, "#B7905F");
    }
  }
  if (family === "girder" || family === "rail-truss") {
    fixed.box(-8, -3, -halfWidth, 8, -2, halfWidth, family === "girder" ? "#B4BCB5" : "#536972");
    if (index % 2 === 0) {
      if (bed < -4) fixed.box(-1, bed, -1, 1, -4, 1, "#979C95");
      for (let z = -halfWidth; z < halfWidth; z++) {
        const bottom = -6 + Math.floor(3 * Math.abs(z + 0.5) / halfWidth);
        fixed.box(-2, bottom, z, 2, -3, z + 1, "#A8AAA0");
      }
    }
  }
  drawBridgeLandmark(bay);
  return bay;
}
