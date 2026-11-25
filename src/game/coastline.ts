import { GRID_HALF, GRID_MIN, GRID_SIZE, withinMap } from "./mapBounds";
import type { GameState } from "./simulation";
import { getTerrainCell, SEA, type TerrainCell } from "./terrain";
import { sampleVoxelColumn, VOXELS_PER_TILE } from "./voxelTerrain";

export const sharesOceanSurface = (cell: TerrainCell) =>
  cell.water === "salt" && cell.depth > 0 && Math.abs(cell.waterLevel - SEA) < 0.05;

// Two linear passes approximate Euclidean shore distance in texel units.
function spread(field: Float32Array, width: number, height: number) {
  const diagonal = Math.SQRT2;
  for (let z = 0; z < height; z++)
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      if (x) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (z)
        field[i] = Math.min(
          field[i],
          field[i - width] + 1,
          x ? field[i - width - 1] + diagonal : Infinity,
          x + 1 < width ? field[i - width + 1] + diagonal : Infinity,
        );
    }
  for (let z = height - 1; z >= 0; z--)
    for (let x = width - 1; x >= 0; x--) {
      const i = z * width + x;
      if (x + 1 < width) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (z + 1 < height)
        field[i] = Math.min(
          field[i],
          field[i + width] + 1,
          x ? field[i + width - 1] + diagonal : Infinity,
          x + 1 < width ? field[i + width + 1] + diagonal : Infinity,
        );
    }
}

/**
 * Updates the coastline distance texture around edited shores.
 * Supports both legacy 192x192 maps and high-resolution (e.g. 768x768) voxel shoreline maps.
 */
export function editedCoastline(state: GameState, natural: Uint8Array, naturalTide?: Uint8Array) {
  const n = Math.round(Math.sqrt(natural.length));
  const sub = Math.max(1, Math.round(n / GRID_SIZE));
  const voxelPatches = state.infrastructure?.voxels ?? {};
  const cells = state.infrastructure?.cells ?? {};
  const overridden = naturalTide ? new Uint8Array(GRID_SIZE * GRID_SIZE) : undefined;

  const changedTiles = new Set<string>();
  for (const [key, c] of Object.entries(cells)) {
    const [x, z] = key.split(",").map(Number);
    if (overridden && withinMap(x, z)) overridden[(z - GRID_MIN) * GRID_SIZE + x - GRID_MIN] = 1;
    if (
      voxelPatches[key] ||
      sharesOceanSurface(c) !== sharesOceanSurface(getTerrainCell({ terrainVersion: state.terrainVersion }, x, z))
    ) {
      changedTiles.add(key);
    }
  }
  for (const key of Object.keys(voxelPatches)) {
    changedTiles.add(key);
    if (overridden) {
      const [x, z] = key.split(",").map(Number);
      if (withinMap(x, z)) overridden[(z - GRID_MIN) * GRID_SIZE + x - GRID_MIN] = 1;
    }
  }
  if (!changedTiles.size) return natural;

  const maxDist = 10 * sub;
  const worldMetersPerTexel = 4 / sub;
  // Outside this halo even the deepest representable coast distance has saturated.
  const padding = maxDist + Math.ceil(40 / worldMetersPerTexel);
  let x0 = n, z0 = n, x1 = 0, z1 = 0;
  for (const key of changedTiles) {
    const [gx, gz] = key.split(",").map(Number);
    if (!withinMap(gx, gz)) continue;
    const x = (gx - GRID_MIN) * sub, z = (gz - GRID_MIN) * sub;
    x0 = Math.min(x0, x); z0 = Math.min(z0, z);
    x1 = Math.max(x1, x + sub); z1 = Math.max(z1, z + sub);
  }
  if (x0 >= x1) return natural;
  x0 = Math.max(0, x0 - padding); z0 = Math.max(0, z0 - padding);
  x1 = Math.min(n, x1 + padding); z1 = Math.min(n, z1 + padding);
  const width = x1 - x0, height = z1 - z0, count = width * height;
  const dry = new Float32Array(count);
  const wet = new Float32Array(count);
  const edits = new Float32Array(count).fill(300 * sub);
  const voxPerTexel = Math.max(1, Math.round(VOXELS_PER_TILE / sub));

  for (let tz = z0; tz < z1; tz++) {
    for (let tx = x0; tx < x1; tx++) {
      const i = (tz - z0) * width + tx - x0;
      let sea: boolean;
      if (naturalTide && overridden && !overridden[Math.floor(tz / sub) * GRID_SIZE + Math.floor(tx / sub)]) {
        sea = Boolean(naturalTide[tz * n + tx]);
      } else if (sub === 1) {
        sea = sharesOceanSurface(getTerrainCell(state, tx + GRID_MIN, tz + GRID_MIN));
      } else {
        const vx = (tx - GRID_HALF * sub) * voxPerTexel + Math.floor(voxPerTexel * 0.5);
        const vz = (tz - GRID_HALF * sub) * voxPerTexel + Math.floor(voxPerTexel * 0.5);
        const s = sampleVoxelColumn(state, vx, vz);
        sea = s.water === "salt" && s.depth > 0.02 && Math.abs(s.waterLevel - SEA) < 0.05;
      }
      dry[i] = sea ? 300 * sub : 0;
      wet[i] = sea ? 0 : 300 * sub;
    }
  }

  for (const key of changedTiles) {
    const [gx, gz] = key.split(",").map(Number);
    if (!withinMap(gx, gz)) continue;
    const ox = (gx - GRID_MIN) * sub - x0;
    const oz = (gz - GRID_MIN) * sub - z0;
    for (let dz = 0; dz < sub; dz++) {
      const start = (oz + dz) * width + ox;
      edits.fill(0, start, start + sub);
    }
  }

  spread(dry, width, height);
  spread(wet, width, height);
  spread(edits, width, height);

  const result = natural.slice();
  const fadeSpan = 6 * sub;
  for (let i = 0; i < count; i++) {
    if (edits[i] > maxDist) continue;
    const signed = wet[i]
      ? (wet[i] - 0.5) * worldMetersPerTexel - 2.2
      : -((dry[i] - 0.5) * worldMetersPerTexel) - 2.2;
    const encoded = Math.min(255, Math.max(0, ((signed + 36) * 255) / 48));
    const weight = Math.max(0, Math.min(1, (maxDist - edits[i]) / fadeSpan));
    const target = (z0 + Math.floor(i / width)) * n + x0 + (i % width);
    result[target] = Math.round(natural[target] + (encoded - natural[target]) * weight);
  }
  return result;
}
