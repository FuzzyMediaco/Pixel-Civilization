import * as THREE from "three";
import { type CivElementDef, ELEMENT_BY_ID, getMaxElementLevel } from "./catalog";
import { applyParcelAppearance, type ParcelAppearance } from "./parcelGeometry";
import { getDesign } from "./designs/registry";
import { type SmokeKind, makeCtx } from "./designs/kit";
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
  bobOnWater?: boolean;
  topY: number;
  voxelCount?: number;
  siteSpecific?: boolean;
}

export function buildDesignAsset(
  def: CivElementDef,
  lv: number,
  variant: number,
  spanX: number,
  spanZ: number,
  connMask: number,
  appearance: ParcelAppearance = {},
): BuiltVoxelAsset {
  const design = getDesign(def.id);
  if (!design) throw new Error(`Missing civilization design: ${def.id}`);
  // Old saves retain their occupied cells. Fit the complete current model inside that site rather
  // than cutting off a tower wing, ship bow, or moving part at a legacy footprint boundary.
  const [designX, designZ] = design.footprints[lv - 1];
  const fit = Math.min(1, spanX / designX, spanZ / designZ);
  const unit = VOXEL_SIZE * fit;
  const groundShift = def.domain === "land" ? VOXEL_SIZE - unit : 0;
  const c = makeCtx(def.id, lv, variant, designX, designZ, connMask);
  c.parcelEdges = appearance.edges;
  try {
    design.build(c);
  } catch (err) {
    console.error(`Design build failed for ${def.id} L${lv} V${variant}`, err);
    c.v.box(-c.hx + 2, 0, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "magenta");
  }
  trimLandscapeEdge(def, c.v, c.hx, c.hz);
  applyParcelAppearance(c, appearance);
  clampVoxToFootprint(c.v, c.hx, c.hz);
  const mesh = (v: PixelVox) => {
    const geometry = buildVoxelGeometry(v, unit);
    const boost = appearance.lighting === "dark" ? 0 : appearance.lighting === "lit" ? 2.1 : def.id === "bars" ? 1.8 : 1;
    if (boost !== 1) {
      const emission = geometry.getAttribute("aEmit");
      for (let i = 0; i < emission.count; i++) emission.setX(i, Math.min(3, emission.getX(i) * boost));
    }
    return geometry;
  };
  const baseGeo = mesh(c.v);
  if (groundShift) baseGeo.translate(0, groundShift, 0);
  baseGeo.computeBoundingBox();
  let topY = baseGeo.boundingBox?.max.y ?? 1;
  const rotors: BuiltRotor[] = c.rotors.map((r) => {
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
    smokePoints: c.smokePoints.map(([x, y, z, k]) => [x * unit, y * unit + groundShift, z * unit, k]),
    blinkers: (appearance.lighting === "dark" ? [] : c.blinkers).map(([x, y, z, col]) => [(x + 0.5) * unit, (y + 0.5) * unit + groundShift, (z + 0.5) * unit, col]),
  };
}

const assetCache = new Map<string, BuiltVoxelAsset>();

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
  const key = `${elementId}|L${clampedLv}|V${clampedVar}|${spanX}x${spanZ}|C${def?.isNetwork ? connMask : 0}`;
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

  const asset = buildDesignAsset(def, clampedLv, clampedVar, spanX, spanZ, def.isNetwork ? connMask : 0);
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
