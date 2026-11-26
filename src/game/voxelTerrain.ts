import { TILE_SIZE, VOXEL_SIZE } from "./voxelCore";
import { withinMap } from "./mapBounds";
import {
  DIRECTIONS,
  SEA,
  elevationFromMargin,
  getTerrainCell,
  islandMargin,
  tileKey,
  type GridPoint,
  type InfrastructureTool,
  type Material,
  type TerrainCell,
} from "./terrain";
import type { GameState } from "./simulation";

export const VOXELS_PER_TILE = Math.round(TILE_SIZE / VOXEL_SIZE); // 16
export const VOXEL_PITCH = VOXEL_SIZE; // 0.25

export interface VoxelColumn {
  /** Top solid ground elevation in world meters, natively quantized to 0.25m voxel steps. */
  y: number;
  /** Surface material override. */
  m?: Material;
  /** Water state for this voxel column. */
  w?: "dry" | "fresh" | "salt";
  /** Water surface elevation when w !== "dry". */
  wl?: number;
  /** Wet/damp shore margin flag (wet sand, surf wash, creek bank). */
  wet?: boolean;
  /** Sand deposited by a placed beach, eligible to merge with adjoining deposits. */
  beach?: true;
  /** Optional landform tag propagated to tile aggregate. */
  form?: TerrainCell["form"];
}

export interface VoxelTilePatch {
  /** Schema version for forward-compatible serialization. */
  v: 1;
  /** Sparse map of local column index (lz * 16 + lx, 0..255) -> VoxelColumn. */
  cols: Record<number, VoxelColumn>;
  /** Height in centimetres at each local sand column. Null entries use the underlying terrain. */
  beach?: (number | null)[];
}

export interface VoxelTerrainSample {
  elevation: number;
  material: Material;
  water: "dry" | "fresh" | "salt";
  waterLevel: number;
  depth: number;
  wet: boolean;
  form?: TerrainCell["form"];
  beach?: true;
  source: "voxel" | "cell" | "natural";
}

export interface VoxelCoord {
  vx: number;
  vz: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Snap any elevation in meters onto the native 0.25m voxel vertical lattice. */
export function snapVoxelY(y: number): number {
  return round2(Math.round(y / VOXEL_PITCH) * VOXEL_PITCH);
}

export function worldToVoxel(wx: number, wz: number): [number, number] {
  return [Math.floor(wx / VOXEL_PITCH), Math.floor(wz / VOXEL_PITCH)];
}

export function voxelCenterWorld(vx: number, vz: number): [number, number] {
  return [(vx + 0.5) * VOXEL_PITCH, (vz + 0.5) * VOXEL_PITCH];
}

export function voxelToTileLocal(vx: number, vz: number): {
  gx: number;
  gz: number;
  lx: number;
  lz: number;
  idx: number;
} {
  const gx = Math.floor(vx / VOXELS_PER_TILE);
  const gz = Math.floor(vz / VOXELS_PER_TILE);
  const lx = ((vx % VOXELS_PER_TILE) + VOXELS_PER_TILE) % VOXELS_PER_TILE;
  const lz = ((vz % VOXELS_PER_TILE) + VOXELS_PER_TILE) % VOXELS_PER_TILE;
  return { gx, gz, lx, lz, idx: lz * VOXELS_PER_TILE + lx };
}

export function tileLocalToVoxel(gx: number, gz: number, lx: number, lz: number): [number, number] {
  return [gx * VOXELS_PER_TILE + lx, gz * VOXELS_PER_TILE + lz];
}

export function gridPointToVoxelCenter(p: GridPoint): VoxelCoord {
  if (typeof p.vx === "number" && typeof p.vz === "number") {
    return { vx: Math.round(p.vx), vz: Math.round(p.vz) };
  }
  return {
    vx: p.gx * VOXELS_PER_TILE + Math.floor(VOXELS_PER_TILE / 2),
    vz: p.gz * VOXELS_PER_TILE + Math.floor(VOXELS_PER_TILE / 2),
  };
}

/**
 * Shared deterministic 0.25m voxel-column terrain sampler.
 * Checks sparse voxel column -> legacy tile-level TerrainCell -> procedural 0.25m natural island.
 */
export function sampleVoxelColumn(
  state: Pick<GameState, "infrastructure" | "terrainVersion"> | undefined,
  vx: number,
  vz: number,
): VoxelTerrainSample {
  const { gx, gz, idx } = voxelToTileLocal(vx, vz);
  const key = tileKey(gx, gz);
  const patch = state?.infrastructure?.voxels?.[key];
  const col = patch?.cols[idx];
  if (col) {
    const water = col.w ?? "dry";
    const wl = water === "dry" ? SEA : (col.wl ?? SEA);
    const depth = water === "dry" ? 0 : round2(Math.max(0, wl - col.y));
    const effectiveWater = depth > 0.01 ? water : "dry";
    return {
      elevation: col.y,
      material: col.m ?? (col.y > 7 ? "snow" : col.y < 0.05 ? "sand" : "grass"),
      water: effectiveWater,
      waterLevel: effectiveWater === "dry" ? SEA : wl,
      depth: effectiveWater === "dry" ? 0 : depth,
      wet: Boolean(col.wet || depth > 0 || (effectiveWater === "dry" && col.y <= SEA + 0.35)),
      form: col.form,
      beach: col.beach,
      source: "voxel",
    };
  }

  const sand = patch?.beach?.[idx];
  if (sand != null) {
    const elevation = sand / 100, depth = round2(Math.max(0, SEA - elevation));
    const tidal = depth > 0.01;
    return { elevation, material: "sand", water: tidal ? "salt" : "dry", waterLevel: SEA,
      depth: tidal ? depth : 0, wet: elevation <= SEA + 0.30, form: tidal ? "bay" : "bank", beach: true, source: "voxel" };
  }

  // Only fall back to legacy coarse cell if the tile has no voxel patch at all (older saves).
  const cell = !patch ? state?.infrastructure?.cells?.[key] : undefined;
  if (cell) {
    return {
      elevation: cell.elevation,
      material: cell.material,
      water: cell.water,
      waterLevel: cell.waterLevel,
      depth: cell.depth,
      wet: cell.depth > 0 || cell.kind === "coast" || cell.material === "wetland",
      form: cell.form,
      source: "cell",
    };
  }

  const [wx, wz] = voxelCenterWorld(vx, vz);
  const version = state?.terrainVersion ?? 1;
  const margin = islandMargin(wx, wz, version);
  const elevation = elevationFromMargin(margin);
  const depth = round2(Math.max(0, SEA - elevation));
  return {
    elevation,
    material: margin >= 2.2 ? "grass" : "sand",
    water: depth > 0 ? "salt" : "dry",
    waterLevel: SEA,
    depth,
    wet: depth > 0 || margin < 1.2,
    source: "natural",
  };
}

/**
 * Shared deterministic world-position terrain sampler (used by renderer, grounding,
 * placement validation, shoreline masking, and works preview).
 */
export function sampleTerrainAt(
  state: Pick<GameState, "infrastructure" | "terrainVersion"> | undefined,
  wx: number,
  wz: number,
): VoxelTerrainSample {
  const [vx, vz] = worldToVoxel(wx, wz);
  return sampleVoxelColumn(state, vx, vz);
}

/**
 * Summarize terrain under a tile footprint (handles both voxel patches and natural 0.25m terrain).
 */
export function sampleFootprintTerrain(
  state: Pick<GameState, "infrastructure" | "terrainVersion"> | undefined,
  gx: number,
  gz: number,
  spanX: number,
  spanZ: number,
): {
  minY: number;
  maxY: number;
  avgY: number;
  centerY: number;
  waterFraction: number;
  maxWaterLevel: number;
  dominantMaterial: Material;
  hasVoxels: boolean;
} {
  let minY = Infinity;
  let maxY = -Infinity;
  let sumY = 0;
  let count = 0;
  let wetCount = 0;
  let maxWaterLevel = SEA;
  let hasVoxels = false;
  const matCounts: Partial<Record<Material, number>> = {};

  for (let x = gx; x < gx + spanX; x++) {
    for (let z = gz; z < gz + spanZ; z++) {
      const key = tileKey(x, z);
      const patch = state?.infrastructure?.voxels?.[key];
      if (patch && (patch.beach?.length || Object.keys(patch.cols).length > 0)) {
        hasVoxels = true;
      }
      // Sample 4x4 grid inside every parcel for accurate 0.25m terrain statistics
      for (let lz = 1; lz < VOXELS_PER_TILE; lz += 4) {
        for (let lx = 1; lx < VOXELS_PER_TILE; lx += 4) {
          const s = sampleVoxelColumn(state, x * VOXELS_PER_TILE + lx, z * VOXELS_PER_TILE + lz);
          minY = Math.min(minY, s.elevation);
          maxY = Math.max(maxY, s.elevation);
          sumY += s.elevation;
          count++;
          if (s.depth > 0.02) {
            wetCount++;
            maxWaterLevel = Math.max(maxWaterLevel, s.waterLevel);
          }
          matCounts[s.material] = (matCounts[s.material] ?? 0) + 1;
        }
      }
    }
  }

  let dominantMaterial: Material = "grass";
  let bestMatCount = -1;
  for (const [m, n] of Object.entries(matCounts) as [Material, number][]) {
    if (n > bestMatCount) {
      bestMatCount = n;
      dominantMaterial = m;
    }
  }
  const cx = (gx + spanX * 0.5) * TILE_SIZE;
  const cz = (gz + spanZ * 0.5) * TILE_SIZE;
  const centerSample = sampleTerrainAt(state, cx, cz);

  return {
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0,
    avgY: count ? round2(sumY / count) : 0,
    centerY: centerSample.elevation,
    waterFraction: count ? wetCount / count : 0,
    maxWaterLevel,
    dominantMaterial,
    hasVoxels,
  };
}

/**
 * Propagate tile-level hydraulic updates (from spill conservation, dam retention,
 * or coastal saltwater connection) directly back into the tile's 0.25m voxel columns
 * so rendered voxel water always matches live hydraulic physics.
 */
export function syncVoxelPatchWaterFromCell(state: GameState, gx: number, gz: number, cell: TerrainCell): void {
  const key = tileKey(gx, gz);
  const patch = state.infrastructure?.voxels?.[key];
  if (!patch) return;
  const baseVx = gx * VOXELS_PER_TILE;
  const baseVz = gz * VOXELS_PER_TILE;

  for (let lz = 0; lz < VOXELS_PER_TILE; lz++) {
    for (let lx = 0; lx < VOXELS_PER_TILE; lx++) {
      const idx = lz * VOXELS_PER_TILE + lx;
      const existing = patch.cols[idx];
      const sand = patch.beach?.[idx];
      if (sand != null && (!existing || existing.beach)) {
        // A mixed dry/wet tile still has a tide in every column below sea level.
        // An elevated or enclosed waterwork can temporarily cover the same sand.
        if (cell.depth > 0.01 && Math.abs(cell.waterLevel - SEA) > 0.04 && sand / 100 < cell.waterLevel) {
          patch.cols[idx] = {y: sand / 100, m: "sand", beach: true, w: cell.water, wl: cell.waterLevel, wet: true, form: "bank"};
        } else if (existing) delete patch.cols[idx];
        continue;
      }
      if (!existing) continue;
      if (cell.depth <= 0.01 || cell.water === "dry") {
        if (existing.w && existing.w !== "dry") {
          existing.w = "dry";
          existing.wl = undefined;
          existing.wet = existing.y <= SEA + 0.3;
        }
      } else {
        if (existing.y < cell.waterLevel - 0.01) {
          existing.w = cell.water;
          existing.wl = cell.waterLevel;
          existing.wet = true;
        } else if (existing.w && existing.w !== "dry") {
          existing.w = "dry";
          existing.wl = undefined;
          existing.wet = true;
        }
      }
    }
  }
  // Ensure untouched natural columns inside an excavated spill basin also receive water if below cell.waterLevel
  if (cell.depth > 0.01 && cell.water !== "dry") {
    for (let lz = 0; lz < VOXELS_PER_TILE; lz++) {
      for (let lx = 0; lx < VOXELS_PER_TILE; lx++) {
        const idx = lz * VOXELS_PER_TILE + lx;
        if (patch.cols[idx] || patch.beach?.[idx] != null) continue;
        const s = sampleVoxelColumn(state, baseVx + lx, baseVz + lz);
        if (s.elevation < cell.waterLevel - 0.01) {
          patch.cols[idx] = {
            y: s.elevation,
            m: s.material,
            w: cell.water,
            wl: cell.waterLevel,
            wet: true,
            form: cell.form,
          };
        }
      }
    }
  }
}

/**
 * Compute tile-level TerrainCell aggregate from a 16x16 VoxelTilePatch while preserving
 * existing gate/source/flowDir metadata so hydraulics, navigation, roads & saves stay synced.
 */
export function syncTileCellFromVoxels(
  state: GameState,
  gx: number,
  gz: number,
  extra?: Partial<Pick<TerrainCell, "form" | "source" | "flowDir" | "excavated" | "freeLevel">>,
): TerrainCell | undefined {
  const infra = state.infrastructure;
  if (!infra) return undefined;
  const key = tileKey(gx, gz);
  const patch = infra.voxels?.[key];
  if (!patch || (!patch.beach?.length && Object.keys(patch.cols).length === 0)) return infra.cells[key];

  const prev = getTerrainCell(state, gx, gz);
  let sumY = 0;
  let waterCols = 0;
  let freshCols = 0;
  let saltCols = 0;
  let sumWL = 0;
  let maxDepth = 0;
  let sumDepth = 0;
  const matCount: Partial<Record<Material, number>> = {};
  let dominantForm: TerrainCell["form"] = extra?.form;

  // Aggregate across all 256 0.25m voxel columns in this spatial chunk
  for (let lz = 0; lz < VOXELS_PER_TILE; lz++) {
    for (let lx = 0; lx < VOXELS_PER_TILE; lx++) {
      const s = sampleVoxelColumn(state, gx * VOXELS_PER_TILE + lx, gz * VOXELS_PER_TILE + lz);
      sumY += s.elevation;
      matCount[s.material] = (matCount[s.material] ?? 0) + 1;
      if (s.depth > 0.02) {
        waterCols++;
        sumWL += s.waterLevel;
        sumDepth += s.depth;
        if (s.depth > maxDepth) maxDepth = s.depth;
        if (s.water === "fresh") freshCols++;
        else if (s.water === "salt") saltCols++;
      }
      if (!dominantForm && s.form) dominantForm = s.form;
    }
  }
  if (!dominantForm) dominantForm = prev.form;

  let material: Material = prev.material;
  let best = -1;
  for (const [m, n] of Object.entries(matCount) as [Material, number][]) {
    if (n > best) {
      best = n;
      material = m;
    }
  }

  const totalCols = VOXELS_PER_TILE * VOXELS_PER_TILE;
  const avgY = round2(sumY / totalCols);
  const hasSignificantWater = waterCols >= 48 || (waterCols >= 16 && maxDepth >= 0.45);
  const waterLevel = waterCols > 0 ? round2(sumWL / waterCols) : SEA;
  const avgDepth = hasSignificantWater ? round2(Math.max(0.15, sumDepth / Math.max(1, waterCols))) : 0;
  const water: TerrainCell["water"] = !hasSignificantWater
    ? "dry"
    : freshCols >= saltCols
      ? "fresh"
      : "salt";
  const kind: TerrainCell["kind"] =
    waterCols >= 140 && avgDepth > 0.55
      ? "water"
      : waterCols >= 12
        ? "coast"
        : "land";

  const cell: TerrainCell = {
    ...prev,
    elevation: avgY,
    material,
    waterLevel,
    depth: avgDepth,
    water,
    kind,
    form: dominantForm,
    source: extra?.source ?? (water === "dry" ? 0 : prev.source),
    flowDir: extra?.flowDir ?? prev.flowDir,
    excavated: extra?.excavated ?? prev.excavated,
  };
  if (extra && "freeLevel" in extra) {
    cell.freeLevel = extra.freeLevel;
  } else {
    delete cell.freeLevel;
  }
  infra.cells[key] = cell;
  return cell;
}

export function interpolateVoxelStroke(points: VoxelCoord[]): VoxelCoord[] {
  if (!points.length) return [];
  const out: VoxelCoord[] = [{ vx: points[0].vx, vz: points[0].vz }];
  for (let i = 1; i < points.length; i++) {
    let x0 = points[i - 1].vx;
    let z0 = points[i - 1].vz;
    const x1 = points[i].vx;
    const z1 = points[i].vz;
    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    while (x0 !== x1 || z0 !== z1) {
      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        z0 += sz;
      }
      out.push({ vx: x0, vz: z0 });
    }
  }
  return out;
}

/** Returns true if this tool operates on native 0.25m voxel terrain columns. */
export function isVoxelSculptTool(tool: InfrastructureTool): boolean {
  return [
    "paint",
    "raise",
    "lower",
    "smooth",
    "flatten",
    "sharpen",
    "mountain",
    "valley",
    "canyon",
    "peninsula",
    "pond",
    "lake",
    "river",
    "canal",
    "bay",
    "spring",
  ].includes(tool.kind);
}

/**
 * Determine effective voxel brush radius in 0.25m voxel columns.
 * Every sculpt, shape, and water tool operates natively in 0.25m voxels:
 * 0 = exact single 0.25m × 0.25m voxel column, up to 48 (24.25m diameter).
 */
export function effectiveVoxelRadius(tool: InfrastructureTool): number {
  if (typeof tool.voxelRadius === "number") {
    return clamp(Math.round(tool.voxelRadius), 0, 48);
  }
  if (tool.precision === "voxel") {
    return 0;
  }
  const r = clamp(tool.radius ?? 0, 0, 3);
  if (tool.kind === "lake" && r === 0) return 14;
  if (tool.kind === "valley" && r === 0) return 12;
  return r === 0 ? 7 : r === 1 ? 18 : r === 2 ? 30 : 44;
}

export interface VoxelColumnEdit {
  vx: number;
  vz: number;
  gx: number;
  gz: number;
  idx: number;
  tileKey: string;
  col: VoxelColumn;
}

export interface VoxelStrokeResult {
  edits: Map<string, VoxelColumnEdit>;
  touchedTiles: Set<string>;
  voxelCount: number;
}

const vKey = (vx: number, vz: number) => `${vx},${vz}`;

function organicNoise(vx: number, vz: number): number {
  return (
    Math.sin(vx * 0.37 + vz * 0.23) * 0.45 +
    Math.cos(vx * 0.19 - vz * 0.41) * 0.35 +
    Math.sin((vx + vz) * 0.71) * 0.2
  );
}

/**
 * Computes deterministic 0.25m voxel-column edits for any Sculpt, Shape, or Water tool stroke.
 * Works across every coordinate seamlessly and supports exact 1-voxel (0.25m) precision up to
 * broad alpine/coastal landforms.
 */
export function computeVoxelStrokeEdits(
  state: GameState,
  tool: InfrastructureTool,
  input: GridPoint[],
): VoxelStrokeResult {
  const edits = new Map<string, VoxelColumnEdit>();
  const touchedTiles = new Set<string>();
  if (!input.length) return { edits, touchedTiles, voxelCount: 0 };

  const rawVoxels = input.map(gridPointToVoxelCenter);
  const path = interpolateVoxelStroke(rawVoxels);
  const vRadius = effectiveVoxelRadius(tool);
  const strength = clamp(tool.strength ?? 1, 0.15, 2.5);
  const amount = clamp(tool.height ?? 0.75, 0.25, 9) * strength;
  const depth = clamp(tool.depth ?? 1.25, 0.25, 8);

  // Sample anchor elevation for Flatten tool
  const anchorSample = sampleVoxelColumn(state, path[0].vx, path[0].vz);
  const targetElevation =
    tool.targetElevation !== undefined ? snapVoxelY(tool.targetElevation) : anchorSample.elevation;

  // Gather unique candidate 0.25m columns within brush radius of interpolated path
  const distMap = new Map<string, { vx: number; vz: number; dist: number; pathIdx: number }>();
  const rSq = (vRadius + 0.55) * (vRadius + 0.55);

  for (let pi = 0; pi < path.length; pi++) {
    const center = path[pi];
    for (let dz = -vRadius; dz <= vRadius; dz++) {
      for (let dx = -vRadius; dx <= vRadius; dx++) {
        const d2 = dx * dx + dz * dz;
        if (vRadius > 0 && d2 > rSq) continue;
        const vx = center.vx + dx;
        const vz = center.vz + dz;
        const { gx, gz } = voxelToTileLocal(vx, vz);
        if (!withinMap(gx, gz)) continue;
        const k = vKey(vx, vz);
        const dist = Math.sqrt(d2);
        const prev = distMap.get(k);
        if (!prev || dist < prev.dist) {
          distMap.set(k, { vx, vz, dist, pathIdx: pi });
        }
      }
    }
  }

  // Precompute salt-water adjacency check helper
  const touchesSalt = (vx: number, vz: number) => {
    for (const [dx, dz] of DIRECTIONS) {
      const s = sampleVoxelColumn(state, vx + dx * 2, vz + dz * 2);
      if (s.water === "salt" && s.depth > 0.02) return true;
    }
    return false;
  };

  for (const [k, item] of distMap) {
    const { vx, vz, dist, pathIdx } = item;
    const base = sampleVoxelColumn(state, vx, vz);
    const { gx, gz, idx } = voxelToTileLocal(vx, vz);
    const tk = tileKey(gx, gz);

    // Normalized radial factor: 1 at center, 0 at brush rim (always 1 for 1-voxel radius=0)
    const norm = vRadius === 0 ? 0 : clamp(dist / (vRadius + 0.5), 0, 1);
    const smoothFalloff = vRadius === 0 ? 1 : 0.5 * (1 + Math.cos(Math.PI * norm));
    const ridgeFalloff = vRadius === 0 ? 1 : Math.pow(1 - norm, 1.35);

    let y = base.elevation;
    let m: Material = base.material;
    let w: "dry" | "fresh" | "salt" = base.water;
    let wl: number | undefined = w === "dry" ? undefined : base.waterLevel;
    let wet = base.wet;
    let form: TerrainCell["form"] = base.form;

    switch (tool.kind) {
      case "paint": {
        m = tool.material ?? "sand";
        break;
      }

      case "raise": {
        const dy = Math.max(0.25 * (vRadius === 0 ? 1 : 0.5), amount * smoothFalloff);
        y = snapVoxelY(clamp(y + dy, -12, 24));
        if (y > SEA + 0.05 && w === "salt") {
          w = "dry";
          wl = undefined;
        }
        if (y > 7.5) m = "snow";
        else if (y > 4.2 && m === "grass") m = "rock";
        else if (y > SEA + 0.25 && m === "sand" && dy > 0.5) m = "grass";
        wet = y <= SEA + 0.28;
        break;
      }

      case "lower": {
        const dy = Math.max(0.25 * (vRadius === 0 ? 1 : 0.5), amount * smoothFalloff);
        y = snapVoxelY(clamp(y - dy, -12, 24));
        if (y < SEA && (w === "salt" || touchesSalt(vx, vz))) {
          w = "salt";
          wl = SEA;
          m = "sand";
          wet = true;
        } else if (y < 0.15 && m === "grass") {
          m = "sand";
          wet = y <= SEA + 0.35;
        }
        break;
      }

      case "smooth": {
        let sum = 0;
        let cnt = 0;
        const step = vRadius === 0 ? 1 : 2;
        for (let oz = -step; oz <= step; oz++) {
          for (let ox = -step; ox <= step; ox++) {
            sum += sampleVoxelColumn(state, vx + ox, vz + oz).elevation;
            cnt++;
          }
        }
        const avg = sum / cnt;
        const blend = clamp(0.65 * smoothFalloff * strength, 0.15, 0.92);
        y = snapVoxelY(y + (avg - y) * blend);
        break;
      }

      case "flatten": {
        const blend = vRadius === 0 ? 1 : clamp(0.85 * smoothFalloff + 0.15, 0.2, 1);
        y = snapVoxelY(y + (targetElevation - y) * blend);
        if (y >= SEA + 0.05 && w === "salt") {
          w = "dry";
          wl = undefined;
          wet = y <= SEA + 0.3;
        }
        break;
      }

      case "sharpen": {
        let sum = 0;
        let cnt = 0;
        for (const [dx, dz] of DIRECTIONS) {
          sum += sampleVoxelColumn(state, vx + dx, vz + dz).elevation;
          cnt++;
        }
        const avg = sum / cnt;
        const detail = y - avg;
        const gain = clamp(0.85 * strength * smoothFalloff, 0.2, 1.8);
        const sharpened =
          y +
          detail * gain +
          (Math.abs(detail) < 0.04 ? 0.25 * smoothFalloff * (organicNoise(vx, vz) > 0 ? 1 : -1) : 0);
        y = snapVoxelY(clamp(sharpened, -12, 24));
        if (Math.abs(detail) > 0.35 && y > 1.5) m = y > 7 ? "snow" : "rock";
        break;
      }

      case "mountain": {
        const noise = 0.86 + 0.28 * (0.5 + 0.5 * organicNoise(vx * 0.6, vz * 0.6));
        const lift = amount * 1.95 * ridgeFalloff * noise;
        y = snapVoxelY(clamp(y + lift, -12, 24));
        form = "bank";
        w = "dry";
        wl = undefined;
        wet = false;
        if (y > 6.8) m = "snow";
        else if (y > 1.6 || ridgeFalloff > 0.35) m = "rock";
        else m = "grass";
        break;
      }

      case "valley": {
        const carve = amount * 1.35 * smoothFalloff;
        y = snapVoxelY(clamp(y - carve, -10, 24));
        if (y < SEA && touchesSalt(vx, vz)) {
          w = "salt";
          wl = SEA;
          m = "sand";
          wet = true;
        } else {
          m = smoothFalloff > 0.55 ? "grass" : base.material;
          wet = smoothFalloff > 0.72 && y < 0.25;
        }
        break;
      }

      case "canyon": {
        // Steep flat-bottomed rocky gorge on 0.25m voxel lattice
        const rimProfile = norm < 0.55 ? 1 : Math.max(0, 1 - (norm - 0.55) / 0.45);
        const wallNoise = 0.9 + 0.18 * organicNoise(vx * 0.8, vz * 0.8);
        const cut = amount * 1.9 * rimProfile * wallNoise;
        y = snapVoxelY(clamp(y - cut, -12, 24));
        form = "canyon";
        w = "dry";
        wl = undefined;
        wet = false;
        m = rimProfile > 0.2 ? "rock" : "clay";
        break;
      }

      case "peninsula": {
        // Dry buildable crown with stepped 0.25m sandy beach apron dipping into the sea
        const crown = Math.max(0.25, (tool.height ?? 1) * 0.65);
        const shoreNoise = 0.08 * organicNoise(vx * 0.5, vz * 0.5);
        const target =
          norm < 0.65
            ? crown
            : crown - ((norm - 0.65) / 0.35) * (crown - (SEA - 0.25)) + shoreNoise;
        y = snapVoxelY(Math.max(y, target));
        form = "bank";
        if (y > SEA + 0.06) {
          w = "dry";
          wl = undefined;
          m = norm < 0.55 ? (tool.material ?? "grass") : "sand";
          wet = y <= SEA + 0.32;
        } else {
          w = "salt";
          wl = SEA;
          m = "sand";
          wet = true;
        }
        break;
      }

      case "pond":
      case "lake":
      case "river":
      case "canal":
      case "bay":
      case "spring": {
        const isCanal = tool.kind === "canal";
        const isBay = tool.kind === "bay";
        const isRiver = tool.kind === "river";
        const baseWL =
          tool.waterLevel !== undefined
            ? tool.waterLevel
            : isBay
              ? SEA
              : base.depth > 0
                ? base.waterLevel
                : Math.max(SEA, anchorSample.elevation - 0.25);
        // Gentle downstream slope along rivers
        const slopeDrop = isRiver ? Math.min(0.8, pathIdx * 0.004) : 0;
        const targetWL = round2(baseWL - slopeDrop);
        const bankCut = isCanal
          ? norm < 0.78
            ? 1
            : Math.max(0, 1 - (norm - 0.78) / 0.22)
          : smoothFalloff;
        const carveDepth = depth * bankCut;
        if (carveDepth > 0.08) {
          const floorY = snapVoxelY(targetWL - carveDepth);
          y = Math.min(y, floorY);
          w = isBay ? "salt" : "fresh";
          wl = targetWL;
          wet = true;
          m = isCanal ? "clay" : "sand";
          form = isBay
            ? "bay"
            : tool.kind === "pond" || tool.kind === "lake"
              ? "lake"
              : tool.kind === "spring"
                ? "spring"
                : isCanal
                  ? "canal"
                  : "river";
        } else {
          // Wet bank shoulder around water edge
          wet = true;
          if (!isCanal && m === "grass") m = "sand";
        }
        break;
      }

      default:
        break;
    }

    edits.set(k, {
      vx,
      vz,
      gx,
      gz,
      idx,
      tileKey: tk,
      col: { y, m, w, wl, wet, form },
    });
    touchedTiles.add(tk);
  }

  return { edits, touchedTiles, voxelCount: edits.size };
}

/**
 * Populate a parcel's 16x16 (0.25m) voxel columns directly from a target TerrainCell
 * so programmatic / coordinate-based strokes also live natively in 0.25m voxel storage.
 */
export function fillTileVoxelsFromCell(
  state: GameState,
  gx: number,
  gz: number,
  cell: TerrainCell,
): void {
  const infra = state.infrastructure;
  if (!infra) return;
  infra.voxels ??= {};
  const key = tileKey(gx, gz);
  const patch: VoxelTilePatch = { v: 1, cols: {} };
  const wet = cell.depth > 0.01 || cell.kind === "coast" || cell.material === "wetland";
  const y = snapVoxelY(cell.elevation);
  const w: "dry" | "fresh" | "salt" = cell.depth > 0.01 ? cell.water : "dry";
  const wl = w === "dry" ? undefined : cell.waterLevel;
  for (let idx = 0; idx < VOXELS_PER_TILE * VOXELS_PER_TILE; idx++) {
    patch.cols[idx] = {
      y,
      m: cell.material,
      w,
      wl,
      wet,
      form: cell.form,
    };
  }
  infra.voxels[key] = patch;
}

/**
 * Applies computed VoxelColumnEdits into `state.infrastructure.voxels` and syncs affected tile cells.
 * Assumes caller has already captured before-state for undo if needed.
 */
export function writeVoxelEditsToState(
  state: GameState,
  edits: Iterable<VoxelColumnEdit>,
  extraCellMeta?:
    | Partial<Pick<TerrainCell, "form" | "source" | "flowDir" | "excavated">>
    | ((tileKey: string) => Partial<Pick<TerrainCell, "form" | "source" | "flowDir" | "excavated">> | undefined),
): Set<string> {
  const infra = state.infrastructure;
  if (!infra) return new Set();
  infra.voxels ??= {};
  const touched = new Set<string>();

  for (const edit of edits) {
    let patch = infra.voxels[edit.tileKey];
    if (!patch) {
      const coarse = infra.cells[edit.tileKey];
      if (coarse && edit.col.beach) {
        // Keep untouched columns of a tile from an older, tile-resolution save.
        patch = { v: 1, cols: {} };
        for (let idx = 0; idx < VOXELS_PER_TILE ** 2; idx++)
          patch.cols[idx] = { y: coarse.elevation, m: coarse.material, w: coarse.water, wl: coarse.waterLevel,
            wet: coarse.depth > 0 || coarse.kind === "coast" || coarse.material === "wetland", form: coarse.form };
      } else patch = { v: 1, cols: {} };
      infra.voxels[edit.tileKey] = patch;
    }
    if (edit.col.beach) {
      (patch.beach ??= [])[edit.idx] = Math.round(edit.col.y * 100);
      delete patch.cols[edit.idx];
    } else patch.cols[edit.idx] = { ...edit.col };
    touched.add(edit.tileKey);
  }

  for (const tk of touched) {
    const [gx, gz] = tk.split(",").map(Number);
    const meta = typeof extraCellMeta === "function" ? extraCellMeta(tk) : extraCellMeta;
    syncTileCellFromVoxels(state, gx, gz, meta);
  }

  return touched;
}

/**
 * Deep-clone a VoxelTilePatch safely for undo snapshots.
 */
export function cloneVoxelPatch(patch: VoxelTilePatch | undefined): VoxelTilePatch | undefined {
  if (!patch) return undefined;
  const cols: Record<number, VoxelColumn> = {};
  for (const [k, v] of Object.entries(patch.cols)) {
    cols[Number(k)] = { ...v };
  }
  return { v: 1, cols, ...(patch.beach ? { beach: patch.beach.slice() } : {}) };
}

/**
 * Inspect whether any voxel tile patch exists at (gx, gz) or its 4 cardinal neighbors.
 */
export function hasNearbyVoxelPatch(
  state: Pick<GameState, "infrastructure"> | undefined,
  gx: number,
  gz: number,
): boolean {
  const voxels = state?.infrastructure?.voxels;
  if (!voxels) return false;
  if (voxels[tileKey(gx, gz)]) return true;
  for (const [dx, dz] of DIRECTIONS) {
    if (voxels[tileKey(gx + dx, gz + dz)]) return true;
  }
  return false;
}
