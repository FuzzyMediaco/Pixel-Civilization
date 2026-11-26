import { ELEMENT_BY_ID, type CivElementDef } from "./catalog";
import { isBeachParcel, legacyBeachColumns, legacyPaintedBeachBeds, planBeachGround } from "./beachTerrain";
import { withinMap } from "./mapBounds";
import type { GameState, PlacedElement } from "./simulation";
import {
  DIRECTIONS,
  SEA,
  ensureInfrastructure,
  getTerrainCell,
  markInfrastructureChanged,
  tileKey,
  type Material,
  type TerrainCell,
} from "./terrain";
import {
  VOXELS_PER_TILE,
  sampleFootprintTerrain,
  sampleVoxelColumn,
  syncTileCellFromVoxels,
  voxelToTileLocal,
  writeVoxelEditsToState,
  type VoxelColumn,
  type VoxelColumnEdit,
} from "./voxelTerrain";

export type TerrainInteractionKind =
  | "beach"
  | "desert"
  | "hill"
  | "mountain"
  | "canyon"
  | "river"
  | "lake"
  | "pond"
  | "canal"
  | "swamp"
  | "coastal_structure"
  | "level_pad";

export interface TerrainInteractionProfile {
  kind: TerrainInteractionKind;
  /** Whether this element is considered a terrain-sculpting landform (allowing coexistence/grounding rules). */
  sculptsTerrain: boolean;
  /** Whether the element should auto-orient its +z front toward nearby water when placed. */
  orientToWater?: boolean;
  /** Extra blend ring in 0.25m voxels outside the footprint (0..8). */
  blendVoxels: number;
  /** Short UI description for placement preview. */
  previewNote: string;
}

export const TERRAIN_INTERACTION_PROFILES: Record<string, TerrainInteractionProfile> = {
  beaches: {
    kind: "beach",
    sculptsTerrain: true,
    orientToWater: true,
    blendVoxels: 4,
    previewNote: "Shapes sandy coast, wet shore & surf into terrain",
  },
  deserts: {
    kind: "desert",
    sculptsTerrain: true,
    blendVoxels: 4,
    previewNote: "Sculpts wind-carved sand dunes blended into perimeter",
  },
  hills: {
    kind: "hill",
    sculptsTerrain: true,
    blendVoxels: 5,
    previewNote: "Raises grassy voxel hills with smooth slopes",
  },
  mountains: {
    kind: "mountain",
    sculptsTerrain: true,
    blendVoxels: 6,
    previewNote: "Raises stepped alpine ridges & snow-capped crests",
  },
  canyons: {
    kind: "canyon",
    sculptsTerrain: true,
    blendVoxels: 4,
    previewNote: "Carves sunken red-rock gorge with terraced walls",
  },
  rivers: {
    kind: "river",
    sculptsTerrain: true,
    blendVoxels: 3,
    previewNote: "Carves flowing freshwater river channel & wet banks",
  },
  wide_rivers: {
    kind: "river",
    sculptsTerrain: true,
    blendVoxels: 4,
    previewNote: "Carves broad navigable river channel & banks",
  },
  lakes: {
    kind: "lake",
    sculptsTerrain: true,
    blendVoxels: 4,
    previewNote: "Excavates freshwater lake basin & sandy shore",
  },
  ponds: {
    kind: "pond",
    sculptsTerrain: true,
    blendVoxels: 3,
    previewNote: "Excavates compact freshwater pond & soft banks",
  },
  canals: {
    kind: "canal",
    sculptsTerrain: true,
    blendVoxels: 2,
    previewNote: "Cuts stone-edged freshwater canal channel",
  },
  water_tile: {
    kind: "pond",
    sculptsTerrain: true,
    blendVoxels: 2,
    previewNote: "Excavates open water basin",
  },
  swamps: {
    kind: "swamp",
    sculptsTerrain: true,
    blendVoxels: 4,
    previewNote: "Shapes shallow marsh & wetland pools",
  },
  // Coastal & beachfront buildings that auto-orient to water & blend into sculpted sand without overwriting occupancy
  beach_houses: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 4,
    previewNote: "Seats coastal stilt house smoothly onto a sculpted sandy shore facing water",
  },
  beach_umbrellas: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 3,
    previewNote: "Blends umbrella seating directly onto sandy shoreline",
  },
  boardwalks: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 3,
    previewNote: "Aligns timber boardwalk along the sandy shoreline",
  },
  // New coastal & watershed elements added in catalog expansion
  tidal_sluice: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Orients stone tidal sluice gate across coastal channel",
  },
  tidal_pool_walk: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Shapes rocky tidal pools along the water edge",
  },
  boatyard_slipway: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Slopes stone launch slipway into the water",
  },
  shoreline_overlook: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Faces scenic coastal overlook toward water",
  },
  colossus_lighthouse: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Grounds coastal lighthouse & rotating beacon toward open water",
  },
  maritime_museum: {
    kind: "coastal_structure",
    sculptsTerrain: false,
    orientToWater: true,
    blendVoxels: 2,
    previewNote: "Orients waterfront exhibition basin toward the harbor",
  },
};

const WORLD_SLAB_STRIP_IDS = new Set([
  "beach_houses",
  "beach_umbrellas",
  "boardwalks",
  "beaches",
  "deserts",
  "sand",
  "rivers",
  "wide_rivers",
  "lakes",
  "ponds",
  "canals",
  "water_tile",
  "swamps",
]);

export function getTerrainInteractionProfile(defId: string): TerrainInteractionProfile | undefined {
  return TERRAIN_INTERACTION_PROFILES[defId];
}

export function isLandformElement(defId: string): boolean {
  return Boolean(TERRAIN_INTERACTION_PROFILES[defId]?.sculptsTerrain);
}

/** True when placing this element in-world should omit its flat y=0 diorama ground slab so real terrain shows through. */
export function stripsFlatGroundSlabInWorld(defId: string): boolean {
  return WORLD_SLAB_STRIP_IDS.has(defId) || isLandformElement(defId);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Inspects water presence around all 4 sides of a footprint and returns the rotation (0..3)
 * whose local +z (front/seaward) edge best faces the open ocean or water body.
 * Rotation convention in Three.js (`group.rotation.y = rot * PI/2`):
 *  - rot 0: local +z -> world +z (South)
 *  - rot 1: local +z -> world +x (East)
 *  - rot 2: local +z -> world -z (North)
 *  - rot 3: local +z -> world -x (West)
 */
export function detectCoastRotation(
  state: Pick<GameState, "infrastructure" | "terrainVersion">,
  gx: number,
  gz: number,
  spanX: number,
  spanZ: number,
  fallbackRotation = 0,
): { rotation: number; foundWater: boolean } {
  // Score each cardinal side for water depth within 1..3 tiles outside the footprint
  const scores = [0, 0, 0, 0]; // [South(+z), East(+x), North(-z), West(-x)]
  const sampleSide = (x: number, z: number, weight: number) => {
    if (!withinMap(x, z)) return 0;
    const c = getTerrainCell(state, x, z);
    if (c.depth > 0.05) return (c.water === "salt" ? 1.4 : 1.0) * weight * Math.min(2, 0.6 + c.depth);
    if (c.kind === "coast") return 0.45 * weight;
    return 0;
  };

  for (let d = 1; d <= 3; d++) {
    const w = 1 / d;
    for (let x = gx; x < gx + spanX; x++) {
      scores[0] += sampleSide(x, gz + spanZ - 1 + d, w); // South (+z)
      scores[2] += sampleSide(x, gz - d, w); // North (-z)
    }
    for (let z = gz; z < gz + spanZ; z++) {
      scores[1] += sampleSide(gx + spanX - 1 + d, z, w); // East (+x)
      scores[3] += sampleSide(gx - d, z, w); // West (-x)
    }
  }

  let bestRot = fallbackRotation % 4;
  let bestScore = 0;
  for (let r = 0; r < 4; r++) {
    if (scores[r] > bestScore + 0.01) {
      bestScore = scores[r];
      bestRot = r;
    }
  }
  return { rotation: bestRot, foundWater: bestScore > 0.1 };
}

export interface TerrainInteractionPlan {
  profile: TerrainInteractionProfile;
  autoRotation: number;
  beachGrade?: boolean;
  edits: Map<string, VoxelColumnEdit>;
  touchedTiles: Set<string>;
  extraCellMeta?: Partial<Pick<TerrainCell, "form" | "source" | "flowDir" | "excavated">>;
  summary: string;
}

/**
 * Shared deterministic planner used by BOTH placement preview and atomic commit.
 * Ensures landforms sculpt true 16x16 voxel terrain and blends seamlessly into adjacent tiles.
 */
export function planElementTerrainInteraction(
  state: Pick<GameState, "infrastructure" | "terrainVersion" | "elements">,
  def: CivElementDef,
  gx: number,
  gz: number,
  spanX: number,
  spanZ: number,
  level: number,
  variant: number,
  rotation: number,
  options?: { preserveRotation?: boolean; baselineElevation?: number; restoreBeach?: boolean; paintedBeds?: ReadonlyMap<string, number> },
): TerrainInteractionPlan | null {
  const profile = TERRAIN_INTERACTION_PROFILES[def.id];
  if (isBeachParcel(def.id)) {
    const ground = planBeachGround(state, { defId: def.id, gx, gz, spanX, spanZ }, rotation, options?.restoreBeach, options?.paintedBeds);
    if (ground) {
      const beachProfile = def.id === "sand" ? TERRAIN_INTERACTION_PROFILES.beach_umbrellas : profile;
      return { ...ground, profile: beachProfile, summary: beachProfile.previewNote, beachGrade: true };
    }
    if (options?.restoreBeach) return null;
  }
  if (!profile) {
    // Gentle local pad leveling ONLY when a standard land building sits on strongly sloped voxel terrain
    if (def.domain !== "land" || def.isNetwork || def.passiveNature) return null;
    const fp = sampleFootprintTerrain(state, gx, gz, spanX, spanZ);
    if (!fp.hasVoxels || fp.maxY - fp.minY < 0.35 || fp.waterFraction > 0.35) return null;
    const padProfile: TerrainInteractionProfile = {
      kind: "level_pad",
      sculptsTerrain: false,
      blendVoxels: 2,
      previewNote: "Gently levels building foundation into sloped terrain",
    };
    const edits = new Map<string, VoxelColumnEdit>();
    const touchedTiles = new Set<string>();
    let targetY = Math.round(fp.avgY / 0.25) * 0.25;
    // Keep the leveled pad within drivable curb grade (<= 1.0m) of any bordering street tile
    let bestRoadY: number | undefined;
    let bestRoadGap = Infinity;
    for (const el of state.elements) {
      const eDef = ELEMENT_BY_ID[el.defId];
      if (!eDef?.isRoadNetwork) continue;
      const touchingX = el.gx >= gx - 1 && el.gx <= gx + spanX && el.gz >= gz && el.gz < gz + spanZ;
      const touchingZ = el.gz >= gz - 1 && el.gz <= gz + spanZ && el.gx >= gx && el.gx < gx + spanX;
      if (!touchingX && !touchingZ) continue;
      const ry = getTerrainCell(state, el.gx, el.gz).elevation;
      const gap = Math.abs(ry - targetY);
      if (gap < bestRoadGap) {
        bestRoadGap = gap;
        bestRoadY = ry;
      }
    }
    if (bestRoadY !== undefined && bestRoadY >= fp.minY - 1.5 && bestRoadY <= fp.maxY + 1.5) {
      const clamped = Math.max(bestRoadY - 1.0, Math.min(bestRoadY + 1.0, targetY));
      targetY = Math.round(clamped / 0.25) * 0.25;
    }
    const minVx = gx * VOXELS_PER_TILE;
    const maxVx = (gx + spanX) * VOXELS_PER_TILE - 1;
    const minVz = gz * VOXELS_PER_TILE;
    const maxVz = (gz + spanZ) * VOXELS_PER_TILE - 1;
    const pad = padProfile.blendVoxels;
    for (let vz = minVz - pad; vz <= maxVz + pad; vz++) {
      for (let vx = minVx - pad; vx <= maxVx + pad; vx++) {
        const loc = voxelToTileLocal(vx, vz);
        if (!withinMap(loc.gx, loc.gz)) continue;
        const dx = vx < minVx ? minVx - vx : vx > maxVx ? vx - maxVx : 0;
        const dz = vz < minVz ? minVz - vz : vz > maxVz ? vz - maxVz : 0;
        const dist = Math.hypot(dx, dz);
        if (dist > pad) continue;
        const cur = sampleVoxelColumn(state, vx, vz);
        if (cur.depth > 0.05) continue;
        const blend = dist === 0 ? 0.92 : Math.max(0, 1 - dist / (pad + 0.5)) * 0.65;
        const y = Math.round((cur.elevation + (targetY - cur.elevation) * blend) / 0.25) * 0.25;
        const tk = tileKey(loc.gx, loc.gz);
        edits.set(`${vx},${vz}`, {
          vx,
          vz,
          gx: loc.gx,
          gz: loc.gz,
          idx: loc.idx,
          tileKey: tk,
          col: {
            y,
            m: cur.material,
            w: cur.water,
            wl: cur.water === "dry" ? undefined : cur.waterLevel,
            wet: cur.wet,
            form: cur.form,
          },
        });
        touchedTiles.add(tk);
      }
    }
    return {
      profile: padProfile,
      autoRotation: rotation,
      edits,
      touchedTiles,
      summary: padProfile.previewNote,
    };
  }

  const coast = profile.orientToWater && !options?.preserveRotation
    ? detectCoastRotation(state, gx, gz, spanX, spanZ, rotation)
    : { rotation: rotation % 4, foundWater: false };
  const activeRot = coast.rotation;

  const edits = new Map<string, VoxelColumnEdit>();
  const touchedTiles = new Set<string>();

  const minVx = gx * VOXELS_PER_TILE;
  const maxVx = (gx + spanX) * VOXELS_PER_TILE - 1;
  const minVz = gz * VOXELS_PER_TILE;
  const maxVz = (gz + spanZ) * VOXELS_PER_TILE - 1;
  const widthV = spanX * VOXELS_PER_TILE;
  const depthV = spanZ * VOXELS_PER_TILE;
  const blendV = profile.blendVoxels;

  // Baseline elevation sampled gently from perimeter so repeated upgrades remain idempotent
  const baselineY =
    options?.baselineElevation !== undefined
      ? options.baselineElevation
      : Math.max(SEA + 0.25, Math.min(2.5, sampleFootprintTerrain(state, gx, gz, spanX, spanZ).minY));

  let extraCellMeta: TerrainInteractionPlan["extraCellMeta"];

  for (let vz = minVz - blendV; vz <= maxVz + blendV; vz++) {
    for (let vx = minVx - blendV; vx <= maxVx + blendV; vx++) {
      const loc = voxelToTileLocal(vx, vz);
      if (!withinMap(loc.gx, loc.gz)) continue;

      const outX = vx < minVx ? minVx - vx : vx > maxVx ? vx - maxVx : 0;
      const outZ = vz < minVz ? minVz - vz : vz > maxVz ? vz - maxVz : 0;
      const outDist = Math.hypot(outX, outZ);
      if (outDist > blendV) continue;

      const edgeBlend = outDist === 0 ? 1 : 0.5 * (1 + Math.cos((Math.PI * outDist) / (blendV + 0.5)));
      const cur = sampleVoxelColumn(state, vx, vz);

      // Normalized coordinates inside footprint [0..1]
      const uRaw = clamp((vx - minVx + 0.5) / widthV, 0, 1);
      const vRaw = clamp((vz - minVz + 0.5) / depthV, 0, 1);
      // Local rotated coordinates where localV = 0 is landward back and localV = 1 is seaward front (+z)
      const [uLoc, vLoc] =
        activeRot === 0
          ? [uRaw, vRaw]
          : activeRot === 1
            ? [1 - vRaw, uRaw]
            : activeRot === 2
              ? [1 - uRaw, 1 - vRaw]
              : [vRaw, 1 - uRaw];

      const uCenter = (uLoc - 0.5) * 2; // [-1..1]
      const vCenter = (vLoc - 0.5) * 2; // [-1..1]
      const radial = Math.hypot(uCenter, vCenter);
      const waveNoise =
        Math.sin(vx * 0.28 + vz * 0.17 + variant * 1.3) * 0.5 +
        Math.cos(vx * 0.14 - vz * 0.31 + variant * 0.7) * 0.5;

      let col: VoxelColumn = {
        y: cur.elevation,
        m: cur.material,
        w: cur.water,
        wl: cur.water === "dry" ? undefined : cur.waterLevel,
        wet: cur.wet,
        form: cur.form,
      };

      switch (profile.kind) {
        case "desert": {
          const interior = clamp(1 - Math.max(0, radial - 0.55) / 0.65, 0, 1) * edgeBlend;
          const ripple = 0.5 + 0.5 * Math.sin(vx * 0.26 + vz * 0.14 + Math.cos(vz * 0.2) * 1.8 + variant);
          const duneH = (0.25 + level * 0.16) * ripple * interior;
          const targetY = round2(Math.max(SEA + 0.2, baselineY + duneH));
          col = {
            y: round2(cur.elevation + (targetY - cur.elevation) * edgeBlend),
            m: outDist > blendV * 0.7 && cur.material === "grass" ? "grass" : variant === 2 && duneH > 0.55 ? "clay" : "sand",
            w: "dry",
            wl: undefined,
            wet: false,
            form: "bank",
          };
          break;
        }

        case "hill": {
          const mound = Math.max(0, 1 - radial * radial * 0.85) * edgeBlend;
          const amplitude = 0.75 + level * 0.42;
          const rawY = baselineY + mound * amplitude * (0.88 + 0.14 * waveNoise);
          const targetY = round2(Math.round(rawY / 0.25) * 0.25);
          col = {
            y: round2(Math.max(cur.elevation, cur.elevation + (targetY - cur.elevation) * edgeBlend)),
            m: variant === 3 && mound > 0.65 ? "rock" : "grass",
            w: "dry",
            wl: undefined,
            wet: false,
            form: "bank",
          };
          break;
        }

        case "mountain": {
          const ridge = Math.pow(Math.max(0, 1 - radial * 0.88), 1.25) * edgeBlend;
          const peakH = 1.75 + level * 1.05;
          const rawY = baselineY + ridge * peakH * (0.85 + 0.22 * waveNoise);
          const targetY = round2(Math.round(rawY / 0.25) * 0.25);
          const finalY = round2(Math.max(cur.elevation, cur.elevation + (targetY - cur.elevation) * edgeBlend));
          col = {
            y: finalY,
            m: finalY > 5.8 ? "snow" : finalY > baselineY + 0.75 ? "rock" : "grass",
            w: "dry",
            wl: undefined,
            wet: false,
            form: "bank",
          };
          break;
        }

        case "canyon": {
          // Serpentine sunken rocky gorge
          const meander = Math.sin(vCenter * 2.4 + variant) * 0.24;
          const gorgeDist = Math.abs(uCenter - meander);
          const carveFactor =
            gorgeDist < 0.34
              ? 1
              : gorgeDist < 0.82
                ? clamp(1 - (gorgeDist - 0.34) / 0.48, 0, 1)
                : 0;
          const cutDepth = (1.5 + level * 0.55) * carveFactor * edgeBlend;
          const rawY = baselineY - cutDepth;
          const targetY = round2(Math.round(rawY / 0.25) * 0.25);
          col = {
            y: round2(Math.min(cur.elevation, targetY)),
            m: carveFactor > 0.22 ? "rock" : "clay",
            w: "dry",
            wl: undefined,
            wet: false,
            form: "canyon",
          };
          extraCellMeta = { form: "canyon", excavated: true };
          break;
        }

        case "river":
        case "canal":
        case "lake":
        case "pond":
        case "swamp": {
          const isCanal = profile.kind === "canal";
          const isSwamp = profile.kind === "swamp";
          const isRiver = profile.kind === "river";
          const waterLevel = round2(Math.max(SEA, baselineY - 0.22));
          let basinFactor = 0;
          if (isRiver || isCanal) {
            const halfW = def.id === "wide_rivers" ? 0.85 : isCanal ? 0.72 : 0.65;
            const d = Math.abs(uCenter) / halfW;
            basinFactor = d < 1 ? (isCanal ? (d < 0.82 ? 1 : 0.4) : 0.5 * (1 + Math.cos(Math.PI * d))) : 0;
          } else {
            const d = radial / (isSwamp ? 0.98 : 0.92);
            basinFactor = d < 1 ? 0.5 * (1 + Math.cos(Math.PI * d)) : 0;
          }
          basinFactor *= edgeBlend;
          const maxDepth =
            def.id === "wide_rivers"
              ? 2.4
              : profile.kind === "lake"
                ? 1.9
                : isSwamp
                  ? 0.45
                  : 1.15;
          const carve = maxDepth * basinFactor;
          if (carve > 0.08) {
            const floorY = round2(waterLevel - carve);
            col = {
              y: Math.min(cur.elevation, floorY),
              m: isSwamp ? "wetland" : isCanal ? "clay" : "sand",
              w: "fresh",
              wl: waterLevel,
              wet: true,
              form: isCanal ? "canal" : isRiver ? "river" : "lake",
            };
          } else {
            col = {
              y: cur.elevation,
              m: isSwamp ? "wetland" : isCanal ? cur.material : "sand",
              w: cur.water,
              wl: cur.water === "dry" ? undefined : cur.waterLevel,
              wet: true,
              form: cur.form,
            };
          }
          extraCellMeta = {
            form: isCanal ? "canal" : isRiver ? "river" : "lake",
            source: isRiver ? 4 : 0,
          };
          break;
        }

        case "coastal_structure": {
          // Gentle natural coastal slope from dry backshore sand down toward the seaward +z water edge
          const isBeachHouse = def.id === "beach_houses" || def.id === "beach_umbrellas" || def.id === "boardwalks";
          if (isBeachHouse && cur.beach) continue;
          const targetY = isBeachHouse
            ? round2(0.18 - Math.pow(vLoc, 1.35) * 0.72 + 0.03 * waveNoise)
            : round2(0.15 - vLoc * 0.75);
          const blendStrength = isBeachHouse ? edgeBlend * 0.85 : edgeBlend * 0.75;
          const blendedY = round2(cur.elevation + (targetY - cur.elevation) * blendStrength);
          const isWater = blendedY < SEA - 0.02;
          const keepGrassRim = outDist > blendV * 0.62 && cur.material === "grass" && !isWater && blendedY > SEA + 0.35;
          col = {
            y: blendedY,
            m: keepGrassRim ? "grass" : def.id === "tidal_pool_walk" ? "rock" : "sand",
            w: isWater ? "salt" : "dry",
            wl: isWater ? SEA : undefined,
            wet: isWater || blendedY <= SEA + 0.34,
            form: isWater ? "bay" : "bank",
          };
          break;
        }

        default:
          break;
      }

      const tk = tileKey(loc.gx, loc.gz);
      edits.set(`${vx},${vz}`, {
        vx,
        vz,
        gx: loc.gx,
        gz: loc.gz,
        idx: loc.idx,
        tileKey: tk,
        col,
      });
      touchedTiles.add(tk);
    }
  }

  return {
    profile,
    autoRotation: activeRot,
    edits,
    touchedTiles,
    extraCellMeta,
    summary: profile.previewNote,
  };
}

/**
 * Applies the unified Terrain Interaction Plan when placing, moving, rotating, or upgrading an element.
 * Idempotent: stores/reuses baseline elevation so upgrading never double-raises terrain.
 */
export function applyElementTerrainInteraction(
  state: GameState,
  el: PlacedElement,
  options?: { preserveRotation?: boolean; restoreBeach?: boolean; paintedBeds?: ReadonlyMap<string, number> },
): TerrainInteractionPlan | null {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return null;

  const plan = planElementTerrainInteraction(
    state,
    def,
    el.gx,
    el.gz,
    el.spanX,
    el.spanZ,
    el.level,
    el.variant,
    el.rotation,
    options,
  );
  if (plan?.beachGrade) el.beachGrade = 2;
  if (!plan || (!plan.beachGrade && !plan.edits.size)) return plan;

  if (plan.profile.sculptsTerrain) {
    el.sculptsTerrain = true;
  }
  if (plan.profile.orientToWater && !options?.preserveRotation) {
    el.rotation = plan.autoRotation;
  }

  if (!plan.edits.size) return plan;
  const infra = ensureInfrastructure(state);
  writeVoxelEditsToState(state, plan.edits.values(), plan.extraCellMeta);

  markInfrastructureChanged(infra, Boolean(plan.beachGrade));
  return plan;
}

/** Old plot-only beaches acquire real terrain once. Keep the player's camera and saved plot rotations. */
export function restoreBeachGround(state: GameState): void {
  const sites = state.elements.filter(el => isBeachParcel(el.defId) && el.beachGrade !== 2);
  if (!sites.length) return;
  const paintedBeds = legacyPaintedBeachBeds(state, sites);
  const unstamped = sites.filter(e => !e.beachGrade);
  const infra = state.infrastructure;
  if (infra?.voxels && unstamped.some(e => e.defId === "beaches" && e.sculptsTerrain)) {
    const touched = new Set<string>();
    const protectedTiles = new Set<string>();
    for (const e of state.elements) {
      if (isBeachParcel(e.defId) || e.defId === "boardwalks" || e.defId === "beach_houses") continue;
      for (let z = e.gz; z < e.gz + e.spanZ; z++)
        for (let x = e.gx; x < e.gx + e.spanX; x++) protectedTiles.add(tileKey(x, z));
    }
    for (const key of legacyBeachColumns(state, unstamped)) {
      const [vx, vz] = key.split(",").map(Number);
      const {gx, gz, idx} = voxelToTileLocal(vx, vz), tk = tileKey(gx, gz);
      if (protectedTiles.has(tk) || infra.spans?.[tk] || infra.conduits?.[tk]) continue;
      delete infra.voxels[tk].cols[idx];
      touched.add(tk);
    }
    for (const tk of touched) {
      const patch = infra.voxels[tk];
      if (patch.beach?.length || Object.keys(patch.cols).length) {
        const [gx, gz] = tk.split(",").map(Number);
        syncTileCellFromVoxels(state, gx, gz);
      } else {
        // Nothing else modified this tile. Revealing the original seabed also retires
        // the old rectangular outline beyond the new deposit's rounded ends.
        delete infra.voxels[tk];
        delete infra.cells[tk];
      }
    }
    if (touched.size) markInfrastructureChanged(infra, true);
  }
  for (const el of sites) applyElementTerrainInteraction(state, el, { preserveRotation: true, restoreBeach: true, paintedBeds });
}
