import { GRID_HALF, GRID_MIN, GRID_SIZE, cellIndex } from "./mapBounds";
import type { GameState } from "./simulation";
import { getTerrainCell, SEA, type TerrainCell } from "./terrain";
import { sampleVoxelColumn, VOXELS_PER_TILE } from "./voxelTerrain";

export const sharesOceanSurface = (cell: TerrainCell) =>
  cell.water === "salt" && cell.depth > 0 && Math.abs(cell.waterLevel - SEA) < 0.05;

// Two linear passes approximate Euclidean shore distance in texel units.
function spread(field: Float32Array, n: number) {
  const diagonal = Math.SQRT2;
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      if (x) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (z)
        field[i] = Math.min(
          field[i],
          field[i - n] + 1,
          x ? field[i - n - 1] + diagonal : Infinity,
          x + 1 < n ? field[i - n + 1] + diagonal : Infinity,
        );
    }
  for (let z = n - 1; z >= 0; z--)
    for (let x = n - 1; x >= 0; x--) {
      const i = z * n + x;
      if (x + 1 < n) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (z + 1 < n)
        field[i] = Math.min(
          field[i],
          field[i + n] + 1,
          x ? field[i + n - 1] + diagonal : Infinity,
          x + 1 < n ? field[i + n + 1] + diagonal : Infinity,
        );
    }
}

/**
 * Updates the coastline distance texture around edited shores.
 * Supports both legacy 192x192 maps and high-resolution (e.g. 768x768) voxel shoreline maps.
 */
export function editedCoastline(state: GameState, natural: Uint8Array) {
  const n = Math.round(Math.sqrt(natural.length));
  const sub = Math.max(1, Math.round(n / GRID_SIZE));
  const voxelPatches = state.infrastructure?.voxels ?? {};
  const cells = state.infrastructure?.cells ?? {};

  const changedTiles = new Set<string>();
  for (const [key, c] of Object.entries(cells)) {
    const [x, z] = key.split(",").map(Number);
    if (
      voxelPatches[key] ||
      sharesOceanSurface(c) !== sharesOceanSurface(getTerrainCell({ terrainVersion: state.terrainVersion }, x, z))
    ) {
      changedTiles.add(key);
    }
  }
  for (const key of Object.keys(voxelPatches)) {
    changedTiles.add(key);
  }
  if (!changedTiles.size) return natural;

  const count = natural.length;
  const dry = new Float32Array(count);
  const wet = new Float32Array(count);
  const edits = new Float32Array(count).fill(300 * sub);
  const worldMetersPerTexel = 4 / sub;
  const voxPerTexel = Math.max(1, Math.round(VOXELS_PER_TILE / sub));

  for (let tz = 0; tz < n; tz++) {
    for (let tx = 0; tx < n; tx++) {
      const i = tz * n + tx;
      let sea: boolean;
      if (sub === 1) {
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
    if (sub === 1) {
      edits[cellIndex(gx, gz)] = 0;
    } else {
      const ox = (gx + GRID_HALF) * sub;
      const oz = (gz + GRID_HALF) * sub;
      for (let dz = 0; dz < sub; dz++) {
        for (let dx = 0; dx < sub; dx++) {
          const px = ox + dx;
          const pz = oz + dz;
          if (px >= 0 && px < n && pz >= 0 && pz < n) {
            edits[pz * n + px] = 0;
          }
        }
      }
    }
  }

  spread(dry, n);
  spread(wet, n);
  spread(edits, n);

  const result = natural.slice();
  const maxDist = 10 * sub;
  const fadeSpan = 6 * sub;
  for (let i = 0; i < count; i++) {
    if (edits[i] > maxDist) continue;
    const signed = wet[i]
      ? (wet[i] - 0.5) * worldMetersPerTexel - 2.2
      : -((dry[i] - 0.5) * worldMetersPerTexel) - 2.2;
    const encoded = Math.min(255, Math.max(0, ((signed + 36) * 255) / 48));
    const weight = Math.max(0, Math.min(1, (maxDist - edits[i]) / fadeSpan));
    result[i] = Math.round(natural[i] + (encoded - natural[i]) * weight);
  }
  return result;
}
