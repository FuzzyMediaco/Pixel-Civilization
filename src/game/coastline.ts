import { GRID_MIN, GRID_SIZE, cellIndex } from "./mapBounds";
import type { GameState } from "./simulation";
import { getTerrainCell, SEA, type TerrainCell } from "./terrain";

export const sharesOceanSurface = (cell: TerrainCell) =>
  cell.water === "salt" && cell.depth > 0 && Math.abs(cell.waterLevel - SEA) < 0.05;

// Two linear passes approximate Euclidean shore distance in tile units.
function spread(field: Float32Array) {
  const n = GRID_SIZE,
    diagonal = Math.SQRT2;
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

/** Only edited coasts change the ocean shading. The original authored shore survives outside that neighborhood. */
export function editedCoastline(state: GameState, natural: Uint8Array) {
  const changes = Object.entries(state.infrastructure?.cells ?? {}).filter(([key, c]) => {
    const [x, z] = key.split(",").map(Number);
    return sharesOceanSurface(c) !== sharesOceanSurface(getTerrainCell({ terrainVersion: state.terrainVersion }, x, z));
  });
  if (!changes.length) return natural;
  const count = natural.length,
    dry = new Float32Array(count),
    wet = new Float32Array(count),
    edits = new Float32Array(count).fill(300);
  for (let z = 0; z < GRID_SIZE; z++)
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = z * GRID_SIZE + x,
        sea = sharesOceanSurface(getTerrainCell(state, x + GRID_MIN, z + GRID_MIN));
      dry[i] = sea ? 300 : 0;
      wet[i] = sea ? 0 : 300;
    }
  for (const [key] of changes) {
    const [x, z] = key.split(",").map(Number);
    edits[cellIndex(x, z)] = 0;
  }
  spread(dry);
  spread(wet);
  spread(edits);
  const result = natural.slice();
  for (let i = 0; i < count; i++) {
    if (edits[i] > 10) continue;
    const signed = wet[i] ? (wet[i] - 0.5) * 4 - 2.2 : -((dry[i] - 0.5) * 4) - 2.2;
    const encoded = Math.min(255, Math.max(0, ((signed + 36) * 255) / 48));
    const weight = Math.max(0, Math.min(1, (10 - edits[i]) / 6));
    result[i] = Math.round(natural[i] + (encoded - natural[i]) * weight);
  }
  return result;
}
