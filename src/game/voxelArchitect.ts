import {dividedCarriageway} from "./designs/carriageways";
import { currentRomeArt, currentProductionArt } from "./eraArtLoader";
import { eraElementSpec, normalizeEra, ROME_PILOT_IDS, type RomeFamily } from "./eraStyles";
const romanPilot = new Set(ROME_PILOT_IDS);
import {CARRIAGEWAY_TAPER_START,corridorTransform} from "./roadCorridors";
import {VEHICLE_ROADS} from "./roadStandards";
import {paintRoadStage} from "./designs/roadStages";
import * as THREE from "three";
import { type CivElementDef, ELEMENT_BY_ID, getMaxElementLevel } from "./catalog";
import { applyParcelAppearance, type ParcelAppearance } from "./parcelGeometry";
import { getDesign } from "./designs/registry";
import { type SmokeKind, makeCtx } from "./designs/kit";
import { type BuiltCritterPen, buildCritterPens, buildCritterPreview } from "./critterModels";
import {
  PixelVox,
  PALETTE,
  packVoxKey,
  VOXEL_SIZE,
  buildVoxelGeometry,
  getGhostPreviewMaterial,
  getPixelVoxelMaterial,
} from "./voxelCore";

export interface BuiltRotor {
  geo: THREE.BufferGeometry;
  pivot: [number, number, number];
  axis: "x" | "y" | "z";
  speed: number;
  wind: boolean;
}

export interface BuiltVoxelAsset {
  baseGeo: THREE.BufferGeometry;
  /** Additional animated parts (new design system) */
  rotors?: BuiltRotor[];
  /** Smoke/steam emitter points in world-local units (meters) */
  smokePoints?: [number, number, number, SmokeKind][];
  /** Blinking beacon lights in world-local units (meters) */
  blinkers?: [number, number, number, string][];
  /** Animated livestock pens in world-local units (meters) */
  critters?: BuiltCritterPen[];
  bobOnWater?: boolean;
  topY: number;
  voxelCount?: number;
  siteSpecific?: boolean;
}

/** Build once through this path for the island, field guide, and handbook artwork. */
export function buildDesignVoxels(
  def: CivElementDef,
  lv: number,
  variant: number,
  spanX: number,
  spanZ: number,
  connMask: number,
  appearance: ParcelAppearance = {},
) {
  const design = getDesign(def.id);
  if (!design) throw new Error(`Missing civilization design: ${def.id}`);
  const [designX, designZ] = design.footprints[Math.max(0,Math.min(lv - 1,design.footprints.length-1))];
  const c = makeCtx(def.id, lv, variant, designX, designZ, connMask);
  c.parcelEdges = appearance.edges;
  c.worldSculpted = appearance.worldSculpted;
  try {
    const era = normalizeEra(appearance.era);
    const roman = era === "rome-forum" || era === "rome-aqueduct";
    const spec = roman && romanPilot.has(def.id) ? eraElementSpec(def.id,era) : undefined;
    const production = currentProductionArt(era);
    const rome = currentRomeArt();
    const buildOriginal = () => {
      design.build(c);
      if (VEHICLE_ROADS.has(def.id)) paintRoadStage(c);
    };
    if (rome && spec && (era === "rome-forum" || era === "rome-aqueduct")) {
      rome.buildRome(c,era,spec.family as RomeFamily,appearance.eraActivity ?? "idle",buildOriginal);
    } else if (production) {
      production.engine.buildProduction(c,production.ink,def,appearance.eraActivity === "active",buildOriginal);
    } else buildOriginal();
  } catch (err) {
    console.error(`Design build failed for ${def.id} L${lv} V${variant}`, err);
    c.v.box(-c.hx + 2, 0, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "magenta");
  }
  trimLandscapeEdge(def, c.v, c.hx, c.hz);
  applyParcelAppearance(c, appearance, spanX, spanZ);
  clampVoxToFootprint(c.v, c.hx, c.hz);
  return c;
}

/** High-resolution road surface shared by the island, orbit model and illustrated fallback. */
export function buildCorridorVoxels(id:string, level:number, variant:number, mask:number, appearance:ParcelAppearance) {
  if (!appearance.corridor) return undefined;
  const deck=dividedCarriageway(id,level,variant,mask,appearance.corridor);
  const era=normalizeEra(appearance.era);
  if((era === "rome-forum" || era === "rome-aqueduct") && romanPilot.has(id)) currentRomeArt()?.paveCorridor(deck,era,variant);
  else {
    const pack=currentProductionArt(era);
    if(pack)pack.engine.pavePeriod(deck,pack.ink,variant,level);
  }
  return deck;
}

export function buildDesignAsset(
  def: CivElementDef, lv: number, variant: number, spanX: number, spanZ: number, connMask: number,
  appearance: ParcelAppearance = {},
): BuiltVoxelAsset {
  const c=buildDesignVoxels(def,lv,variant,spanX,spanZ,connMask,appearance);
  // Old saves retain their occupied cells. Fit the complete model, including its moving parts.
  const fit=Math.min(1,spanX/c.spanX,spanZ/c.spanZ), unit=VOXEL_SIZE*fit;
  const groundShift=def.domain==="land" ? VOXEL_SIZE-unit : 0;
  const mesh = (v: PixelVox,scale=1) => {
    const corridor=appearance.corridor;
    const cut = Math.round(CARRIAGEWAY_TAPER_START / (unit * scale));
    const split = corridor && (corridor.minus !== corridor.width || corridor.plus !== corridor.width)
      ? { axis: corridor.axis === "x" ? 0 as const : 2 as const, cuts: [-cut, cut] } : undefined;
    const geometry = buildVoxelGeometry(v, unit*scale, split);
    if(corridor){
      const pos=geometry.getAttribute("position");
      for(let i=0;i<pos.count;i++){
        if(pos.getY(i)>.25&&pos.getY(i)<=.376)pos.setY(i,.267);
        if(corridor.axis==="x")pos.setZ(i,corridorTransform(corridor,pos.getX(i),pos.getZ(i)));
        else pos.setX(i,corridorTransform(corridor,pos.getZ(i),pos.getX(i)));
      }
      geometry.computeVertexNormals();
    }
    const boost = appearance.lighting === "dark" ? 0 : appearance.lighting === "lit" ? 2.1 : def.id === "bars" ? 1.8 : 1;
    if (boost !== 1) {
      const emission = geometry.getAttribute("aEmit");
      for (let i = 0; i < emission.count; i++) emission.setX(i, Math.min(3, emission.getX(i) * boost));
    }
    return geometry;
  };
  const corridor=appearance.corridor;
  let baseGeo: THREE.BufferGeometry;
  if(corridor) {
    baseGeo = mesh(buildCorridorVoxels(def.id,lv,variant,connMask,appearance)!, .5);
  } else baseGeo = mesh(c.v);
  if (groundShift) baseGeo.translate(0, groundShift, 0);
  baseGeo.computeBoundingBox();
  let topY = baseGeo.boundingBox?.max.y ?? 1;
  const rotors: BuiltRotor[] = (corridor?[]:c.rotors).map((r) => {
    const geo = mesh(r.vox);
    geo.computeBoundingBox();
    const pivot: [number, number, number] = [r.pivot[0] * fit, r.pivot[1] * fit + groundShift / VOXEL_SIZE, r.pivot[2] * fit];
    topY = Math.max(topY, pivot[1] * VOXEL_SIZE + (geo.boundingBox?.max.y ?? 0));
    return { geo, pivot, axis: r.axis, speed: r.speed, wind: Boolean(r.wind) };
  });
  return {
    baseGeo,
    voxelCount: c.v.size + c.rotors.reduce((n, r) => n + r.vox.size, 0),
    topY: Math.max(0.3, topY),
    bobOnWater: c.floating || def.domain === "water",
    rotors,
    smokePoints: (corridor?[]:c.smokePoints).map(([x, y, z, k]) => [x * unit, y * unit + groundShift, z * unit, k]),
    critters: corridor ? [] : buildCritterPens(c.critterPens, unit, groundShift, fit),
    blinkers: (corridor || appearance.lighting === "dark" ? [] : c.blinkers).map(([x, y, z, col]) => [(x + 0.5) * unit, (y + 0.5) * unit + groundShift, (z + 0.5) * unit, col]),
  };
}

const assetCache = new Map<string, BuiltVoxelAsset>();

export function invalidateVoxelAssetCache(elementId: string): void {
  const needle = `|${elementId}|`;
  for (const [k, asset] of assetCache.entries()) {
    if (k.includes(needle)) {
      asset.baseGeo.dispose();
      for (const r of asset.rotors ?? []) r.geo.dispose();
      assetCache.delete(k);
    }
  }
}

// Only loose turf blends into the island. Paths, decks, planted beds and occupied foundations keep their edges.
const turfStyles = new Set<number>();
const turfProbe = new PixelVox();
for (const key of ["grass", "grass2", "grass3"]) {
  turfProbe.put(0, 0, 0, PALETTE[key]);
  turfStyles.add(turfProbe.v.get(packVoxKey(0, 0, 0))!);
}

export function trimLandscapeEdge(def: CivElementDef, vox: PixelVox, hx: number, hz: number): void {
  if (def.isNetwork || def.domain !== "land") return;
  for (let x = -hx; x < hx; x++) {
    for (let z = -hz; z < hz; z++) {
      const edgeX = Math.min(x + hx, hx - x - 1), edgeZ = Math.min(z + hz, hz - z - 1);
      if (Math.min(edgeX, edgeZ) > 2) continue;
      const key = packVoxKey(x, 0, z);
      const style = vox.v.get(key);
      if (style === undefined || !turfStyles.has(style) || vox.v.has(key + 1024)) continue;
      const fringe = 1.2 + 0.9 * Math.sin(x * 0.48 + z * 0.23);
      if (edgeX + edgeZ < 4 || Math.min(edgeX, edgeZ) < fringe) vox.v.delete(key);
    }
  }
}

/**
 * Guarantees zero mesh protrusion past selection/hitbox boundaries:
 * every voxel in base geometry fits strictly inside [-halfX..halfX) x [-halfZ..halfZ).
 */
function clampVoxToFootprint(v: PixelVox, halfX: number, halfZ: number): void {
  const KEY_BIAS = 512;
  const KEY_MASK = 1023;
  const toDelete: number[] = [];
  for (const k of v.v.keys()) {
    const x = ((k >> 20) & KEY_MASK) - KEY_BIAS;
    const z = (k & KEY_MASK) - KEY_BIAS;
    if (x < -halfX || x >= halfX || z < -halfZ || z >= halfZ) {
      toDelete.push(k);
    }
  }
  for (const k of toDelete) {
    v.v.delete(k);
  }
}

export function getOrBuildElementAsset(
  elementId: string,
  level: number,
  variant: number,
  spanX: number,
  spanZ: number,
  connMask = 0,
  appearance: ParcelAppearance = {},
): BuiltVoxelAsset {
  const def = ELEMENT_BY_ID[elementId];
  const clampedLv = Math.max(1, Math.min(getMaxElementLevel(elementId), level | 0));
  const clampedVar = ((variant | 0) % 4 + 4) % 4;
  const era = normalizeEra(appearance.era);
  const themed = Boolean(currentProductionArt(era)) || (era === "rome-forum" && currentRomeArt() && romanPilot.has(elementId));
  const styleKey = themed ? `${appearance.era}:${appearance.eraActivity ?? "idle"}` : "original";
  const key = `${styleKey}|${appearance.worldSculpted ? "sculpted" : "model"}|${appearance.corridor?JSON.stringify(appearance.corridor):""}|${elementId}|L${clampedLv}|V${clampedVar}|${spanX}x${spanZ}|C${def?.isNetwork ? connMask : 0}`;
  if (def && (appearance.edges?.length || appearance.soils?.length || (appearance.lighting && appearance.lighting !== "auto"))) {
    const asset = buildDesignAsset(def, clampedLv, clampedVar, spanX, spanZ, connMask, appearance);
    asset.siteSpecific = true;
    return asset;
  }
  const existing = assetCache.get(key);
  if (existing) return existing;

  if (!def) {
    const fallback = new PixelVox(1);
    fallback.box(-5, 0, -5, 5, 8, 5, "brick");
    const asset = { baseGeo: buildVoxelGeometry(fallback), topY: 2.2 };
    assetCache.set(key, asset);
    return asset;
  }

  const asset = buildDesignAsset(def, clampedLv, clampedVar, spanX, spanZ, def.isNetwork ? connMask : 0,appearance);
  assetCache.set(key, asset);
  return asset;
}

export function buildPlacedGroupFromAsset(
  asset: BuiltVoxelAsset,
  ghost = false,
  validGhost = true,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.siteSpecific = Boolean(asset.siteSpecific);
  const mat = ghost ? getGhostPreviewMaterial(validGhost) : getPixelVoxelMaterial();
  const baseMesh = new THREE.Mesh(asset.baseGeo, mat);
  baseMesh.castShadow = !ghost;
  baseMesh.receiveShadow = !ghost;
  baseMesh.userData.isVoxelMesh = true;
  group.add(baseMesh);

  if (asset.rotors && asset.rotors.length > 0) {
    const list: { pivot: THREE.Group; axis: "x" | "y" | "z"; speed: number; wind: boolean }[] = [];
    for (const r of asset.rotors) {
      const piv = new THREE.Group();
      piv.position.set(r.pivot[0] * VOXEL_SIZE, r.pivot[1] * VOXEL_SIZE, r.pivot[2] * VOXEL_SIZE);
      const rMesh = new THREE.Mesh(r.geo, mat);
      rMesh.castShadow = !ghost;
      rMesh.userData.isVoxelMesh = true;
      piv.add(rMesh);
      group.add(piv);
      list.push({ pivot: piv, axis: r.axis, speed: r.speed, wind: r.wind });
    }
    group.userData.rotorList = list;
  }
  group.userData.smokePoints = asset.smokePoints ?? [];
  // Livestock stand in rest poses here; the game's herd animator hides this and drives instanced animals.
  group.userData.critters = asset.critters ?? [];
  const herd = buildCritterPreview(asset.critters ?? [], mat);
  if (herd) {
    group.add(herd);
    group.userData.critterPreview = herd;
  }
  group.userData.blinkers = asset.blinkers ?? [];

  group.userData.bobOnWater = Boolean(asset.bobOnWater);
  group.userData.topY = asset.topY;
  return group;
}

/** Joined lots and previews belong to one placed group. Shared catalog meshes stay cached. */
export function releaseParcelGeometry(group: THREE.Group): void {
  if (!group.userData.siteSpecific) return;
  group.traverse(o => {
    if (o instanceof THREE.Mesh && o.userData.isVoxelMesh) o.geometry.dispose();
  });
}
