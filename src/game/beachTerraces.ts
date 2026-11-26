import type { GameState } from "./simulation";
import { elevationFromMargin, islandMargin, tileKey, type Infrastructure } from "./terrain";
import { TILE_SIZE, VOXEL_SIZE } from "./voxelCore";
import { VOXELS_PER_TILE, snapVoxelY, voxelToTileLocal } from "./voxelTerrain";

type BeachWorld = Pick<GameState, "infrastructure" | "terrainVersion"> & Partial<Pick<GameState, "elements">>;
type Berth = { x0: number; x1: number; z0: number; z1: number };
type BeachTile = { tangentX: number; tangentZ: number; berths: Berth[] };
type ShoreLayout = {
  key: string;
  berths: Berth[];
  tiles: Map<string, BeachTile>;
  elements?: GameState["elements"];
  count: number;
  version: number;
};

const layouts = new WeakMap<Infrastructure, ShoreLayout>();
const berthTypes = new Set(["docks", "ferry_landings", "seafood_pier"]);
const taperWidth = 5.75;

export function shorelineLayout(state: BeachWorld, refresh = false): ShoreLayout {
  const infra = state.infrastructure;
  const known = infra && layouts.get(infra);
  const elements = state.elements;
  const version = state.terrainVersion ?? 1;
  if (known && known.version === version && !refresh && (!elements || (known.elements === elements && known.count === elements.length))) return known;
  const berths = (elements ?? []).filter(e => berthTypes.has(e.defId)).map(e => ({
    x0: e.gx * TILE_SIZE, x1: (e.gx + e.spanX) * TILE_SIZE,
    z0: e.gz * TILE_SIZE, z1: (e.gz + e.spanZ) * TILE_SIZE,
  }));
  const key = [version, ...berths.map(b => [b.x0, b.z0, b.x1, b.z1].join(",")).sort()].join("/");
  const layout: ShoreLayout = known?.key === key ? known : { key, version, berths, tiles: new Map(), count: 0 };
  layout.elements = elements;
  layout.count = elements?.length ?? 0;
  if (infra) layouts.set(infra, layout);
  return layout;
}

/** How much of the sand or swash survives as it approaches a working berth. */
export function berthFade(x: number, z: number, berths: readonly Berth[], width = taperWidth) {
  let squared = width * width;
  for (const b of berths) {
    const dx = Math.max(0, b.x0 - x, x - b.x1);
    const dz = Math.max(0, b.z0 - z, z - b.z1);
    squared = Math.min(squared, dx * dx + dz * dz);
  }
  const t = Math.sqrt(squared) / width;
  return t * t * (3 - 2 * t);
}

function tileProfile(state: BeachWorld, gx: number, gz: number) {
  const layout = shorelineLayout(state);
  const key = tileKey(gx, gz);
  let tile = layout.tiles.get(key);
  if (tile) return tile;
  const cx = (gx + 0.5) * TILE_SIZE, cz = (gz + 0.5) * TILE_SIZE;
  const dx = islandMargin(cx + 0.5, cz, state.terrainVersion) - islandMargin(cx - 0.5, cz, state.terrainVersion);
  const dz = islandMargin(cx, cz + 0.5, state.terrainVersion) - islandMargin(cx, cz - 0.5, state.terrainVersion);
  const length = Math.hypot(dx, dz) || 1;
  const reach = taperWidth + TILE_SIZE / 2;
  const berths = layout.berths.filter(b => cx >= b.x0 - reach && cx <= b.x1 + reach && cz >= b.z0 - reach && cz <= b.z1 + reach);
  tile = { tangentX: dz / length, tangentZ: -dx / length, berths };
  layout.tiles.set(key, tile);
  return tile;
}

function depositedHeight(state: BeachWorld, x: number, z: number) {
  const voxel = voxelToTileLocal(Math.floor(x / VOXEL_SIZE), Math.floor(z / VOXEL_SIZE));
  const patch = state.infrastructure?.voxels?.[tileKey(voxel.gx, voxel.gz)];
  const edited = patch?.cols[voxel.idx];
  if (edited) return edited.beach ? edited.y : undefined;
  const cm = patch?.beach?.[voxel.idx];
  return cm == null ? undefined : cm / 100;
}

/** Keep the full deposit in the save so an inlet can follow a moved or removed dock.
 * Rendering, picking, tide, and placement all sample the same finished surface. */
export function beachTerraceHeight(state: BeachWorld, gx: number, gz: number, idx: number, cm: number) {
  const tile = tileProfile(state, gx, gz);
  const x = (gx * VOXELS_PER_TILE + idx % VOXELS_PER_TILE + 0.5) * VOXEL_SIZE;
  const z = (gz * VOXELS_PER_TILE + Math.floor(idx / VOXELS_PER_TILE) + 0.5) * VOXEL_SIZE;
  let grade = cm / 100;
  if (grade < -0.08 && grade > -1.80) {
    // Follow the bank across parcel seams; sampling the raw deposit keeps repeated reads idempotent.
    let sum = 4 * grade, weights = 4;
    for (const step of [-2, -1, 1, 2]) {
      const along = step * 0.85;
      const y = depositedHeight(state, x + tile.tangentX * along, z + tile.tangentZ * along);
      if (y === undefined) continue;
      const weight = 3 - Math.abs(step);
      sum += y * weight;
      weights += weight;
    }
    grade = sum / weights;
  }
  if (tile.berths.length) {
    const nativeBed = elevationFromMargin(islandMargin(x, z, state.terrainVersion));
    const bed = Math.min(nativeBed, grade);
    grade = bed + (grade - bed) * berthFade(x, z, tile.berths);
  }
  return snapVoxelY(grade);
}

/** Match the colors used by the native sand terraces at the waterline. */
export function terraceSandColor(y: number, checker: number) {
  if (y <= -0.75) return checker ? 0xba9f72 : 0xb49668;
  if (y <= -0.50) return checker ? 0xc8ad78 : 0xcdb37f;
  if (y <= -0.25) return checker ? 0xd2b882 : 0xd7bd88;
  return y >= 0.25 ? (checker ? 0xe6cf99 : 0xe9d4a0) : (checker ? 0xddc793 : 0xe1cb91);
}
