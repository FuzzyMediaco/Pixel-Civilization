import * as THREE from "three";
import { type CivElementDef, ELEMENT_BY_ID } from "./catalog";
import {
  PixelVox,
  VOXELS_PER_TILE,
  VOXEL_SIZE,
  buildVoxelGeometry,
  getGhostPreviewMaterial,
  getPixelVoxelMaterial,
  packVoxKey,
} from "./voxelCore";

export interface BuiltVoxelAsset {
  baseGeo: THREE.BufferGeometry;
  rotorGeo?: THREE.BufferGeometry;
  rotorPivot?: [number, number, number];
  rotorAxis?: "x" | "y" | "z";
  rotorSpeed?: number;
  bobOnWater?: boolean;
  topY: number;
}

const assetCache = new Map<string, BuiltVoxelAsset>();

function hashInt(a: number, b: number, c: number): number {
  let h =
    Math.imul(a + 37, 73856093) ^
    Math.imul(b + 19, 19349663) ^
    Math.imul(c + 71, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 10000;
}

interface VariantStyle {
  wall: string;
  roof: string;
  trim: string;
  accent: string;
  plinth: string;
}

function getVariantStyle(elementId: string, variant: number): VariantStyle {
  const h = hashInt(
    elementId.length * 13 + elementId.charCodeAt(0),
    elementId.charCodeAt(elementId.length - 1),
    variant,
  );
  const v = ((variant % 4) + 4) % 4;
  const wallSets = [
    ["cream", "plaster", "brick", "limestone"],
    ["marble", "brick2", "woodLight", "concrete"],
    ["limestone", "white", "terracotta", "slateLight"],
    ["plaster", "wood", "sand", "marbleShade"],
  ];
  const roofSets = [
    ["terracotta", "slate", "blueDark", "tealDark"],
    ["brickDark", "copper", "crimson", "woodDark"],
    ["slate", "red", "oliveDrab", "purpleDark"],
    ["goldDark", "charcoal", "teal", "brick2"],
  ];
  const trimSets = ["white", "limestone", "woodDark", "brass"];
  const accentSets = ["gold", "teal", "orange", "sky", "pink", "lime"];

  return {
    wall: wallSets[v][h % 4],
    roof: roofSets[v][(h >> 2) % 4],
    trim: trimSets[(v + h) % 4],
    accent: accentSets[(v + (h >> 3)) % accentSets.length],
    plinth: v % 2 === 0 ? "concrete2" : "stone",
  };
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

function addTreeMini(v: PixelVox, cx: number, y0: number, cz: number, style = 0) {
  v.box(cx, y0, cz, cx + 1, y0 + 3, cz + 1, "woodDark");
  const leafCol = style % 3 === 0 ? "leaf" : style % 3 === 1 ? "pink" : "leafLight";
  v.sphere(cx + 0.5, y0 + 4.1, cz + 0.5, 1.8, 1.7, 1.8, leafCol);
}

function addCypressMini(v: PixelVox, cx: number, y0: number, cz: number, h = 7) {
  v.box(cx, y0, cz, cx + 1, y0 + 2, cz + 1, "woodDark");
  v.cone(cx + 0.5, y0 + 2, y0 + h, cz + 0.5, 1.3, 0.45, "leafDark");
}

function addPalmMini(v: PixelVox, cx: number, y0: number, cz: number, h = 6) {
  for (let y = 0; y < h; y++) {
    const lean = y >= 3 ? 1 : 0;
    v.put(cx + lean, y0 + y, cz, y % 2 === 0 ? "wood" : "oak");
  }
  const tx = cx + (h >= 4 ? 1 : 0);
  const ty = y0 + h;
  v.put(tx, ty, cz, "leaf");
  for (const [dx, dz] of [
    [-2, 0],
    [-1, 0],
    [1, 0],
    [2, 0],
    [0, -2],
    [0, -1],
    [0, 1],
    [0, 2],
  ]) {
    const drop = Math.abs(dx) + Math.abs(dz) >= 2 ? -1 : 0;
    v.put(tx + dx, ty + drop, cz + dz, "leafLight");
  }
}

function addWindowGrid(
  v: PixelVox,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  stepY = 3,
  emit = 0.36,
  glassCol = "glass",
) {
  for (let y = y0 + 1; y < y1 - 1; y += stepY) {
    for (let x = x0 + 2; x < x1 - 2; x += 3) {
      v.put(x, y, z0, glassCol, emit);
      v.put(x, y, z1 - 1, glassCol, emit);
    }
    for (let z = z0 + 2; z < z1 - 2; z += 3) {
      v.put(x0, y, z, glassCol, emit);
      v.put(x1 - 1, y, z, glassCol, emit);
    }
  }
}

function addHippedRoofSafe(
  v: PixelVox,
  x0: number,
  yBase: number,
  z0: number,
  x1: number,
  z1: number,
  maxSteps: number,
  roofCol: string,
  trimCol?: string,
) {
  for (let s = 0; s < maxSteps && x0 + s < x1 - s && z0 + s < z1 - s; s++) {
    v.box(
      x0 + s,
      yBase + s,
      z0 + s,
      x1 - s,
      yBase + s + 1,
      z1 - s,
      s === 0 && trimCol ? trimCol : roofCol,
    );
  }
}

function addGableSafe(
  v: PixelVox,
  x0: number,
  yBase: number,
  z0: number,
  x1: number,
  z1: number,
  rise: number,
  axis: "x" | "z",
  roofCol: string,
  trimCol?: string,
) {
  v.roofGable(x0, yBase, z0, x1, z1, rise, axis, roofCol, trimCol);
}

/**
 * Square masonry civic/station/school clock & bell tower with corner pilasters,
 * 4 illuminated clock dials, louvered belfry stage, and pitched pyramidal roof + weathervane.
 */
function addSquareClockTower(
  v: PixelVox,
  cx: number,
  cz: number,
  y0: number,
  height: number,
  halfW: number,
  wallCol: string,
  trimCol: string,
  roofCol: string,
  dialCol = "warmGlow",
) {
  const hw = Math.max(2, Math.round(halfW));
  const h = Math.max(7, Math.round(height));
  const x0 = Math.round(cx) - hw;
  const x1 = Math.round(cx) + hw;
  const z0 = Math.round(cz) - hw;
  const z1 = Math.round(cz) + hw;

  v.hollowBox(x0, y0, z0, x1, y0 + h, z1, wallCol, trimCol);
  for (let y = y0 + 2; y < y0 + h - 4; y += 3) {
    v.put(Math.round(cx) - 1, y, z0, "glass", 0.42);
    v.put(Math.round(cx) - 1, y, z1 - 1, "glass", 0.42);
  }
  // Cornice band + 4 clock faces near top of shaft
  const dialY = y0 + h - 3;
  v.box(x0, dialY - 1, z0, x1, dialY, z1, trimCol);
  v.box(Math.round(cx) - 1, dialY, z1 - 1, Math.round(cx) + 1, dialY + 2, z1, dialCol, 1.05);
  v.box(Math.round(cx) - 1, dialY, z0, Math.round(cx) + 1, dialY + 2, z0 + 1, dialCol, 1.05);
  v.box(x0, dialY, Math.round(cz) - 1, x0 + 1, dialY + 2, Math.round(cz) + 1, dialCol, 1.05);
  v.box(x1 - 1, dialY, Math.round(cz) - 1, x1, dialY + 2, Math.round(cz) + 1, dialCol, 1.05);

  // Open belfry lantern + steep pyramidal roof + brass finial
  v.box(x0, y0 + h, z0, x1, y0 + h + 1, z1, trimCol);
  addHippedRoofSafe(v, x0, y0 + h + 1, z0, x1, z1, hw + 2, roofCol, trimCol);
  v.put(Math.round(cx) - 1, y0 + h + hw + 2, Math.round(cz) - 1, "gold", 0.9);
}

/**
 * Stepped stone Gothic bell steeple with corner buttresses, lancet belfry openings,
 * faceted spire, and cross/gold finial.
 */
function addGothicSteeple(
  v: PixelVox,
  cx: number,
  cz: number,
  y0: number,
  shaftH: number,
  spireH: number,
  wallCol: string,
  trimCol: string,
  spireCol: string,
) {
  const ix = Math.round(cx);
  const iz = Math.round(cz);
  v.hollowBox(ix - 2, y0, iz - 2, ix + 2, y0 + shaftH, iz + 2, wallCol, trimCol);
  // lancet belfry slits
  if (shaftH >= 5) {
    v.box(ix - 1, y0 + shaftH - 3, iz + 1, ix + 1, y0 + shaftH - 1, iz + 2, "charcoal");
    v.box(ix - 1, y0 + shaftH - 3, iz - 2, ix + 1, y0 + shaftH - 1, iz - 1, "charcoal");
  }
  v.cone(ix, y0 + shaftH, y0 + shaftH + spireH, iz, 2.2, 0.35, spireCol);
  const topY = y0 + shaftH + spireH;
  v.box(ix, topY, iz, ix + 1, topY + 2, iz + 1, "gold", 1.0);
}

/**
 * Open steel lattice communications / radar / dispatch truss mast with cross-bars and beacon.
 */
function addLatticeMast(
  v: PixelVox,
  cx: number,
  cz: number,
  y0: number,
  height: number,
  steelCol = "steel",
  beaconCol = "red",
) {
  const ix = Math.round(cx);
  const iz = Math.round(cz);
  const split = Math.floor(height * 0.55);
  for (let y = 0; y < split; y++) {
    v.put(ix - 1, y0 + y, iz - 1, steelCol);
    v.put(ix + 1, y0 + y, iz - 1, steelCol);
    v.put(ix - 1, y0 + y, iz + 1, steelCol);
    v.put(ix + 1, y0 + y, iz + 1, steelCol);
    if (y % 3 === 2) {
      v.box(ix - 1, y0 + y, iz - 1, ix + 2, y0 + y + 1, iz + 2, "steelLight");
    }
  }
  v.box(ix, y0 + split, iz, ix + 1, y0 + height, iz + 1, "steelLight");
  if (height >= 7) {
    v.box(ix - 1, y0 + split + 1, iz + 1, ix + 2, y0 + split + 3, iz + 2, "white"); // microwave dish
  }
  v.put(ix, y0 + height, iz, beaconCol, 1.25);
}

/**
 * Tapered industrial masonry or steel smokestack with aviation safety bands and dark flue mouth.
 */
function addTaperedSmokestack(
  v: PixelVox,
  cx: number,
  cz: number,
  y0: number,
  height: number,
  rBottom: number,
  stackCol: string,
  bandCol = "red",
) {
  const topY = y0 + height;
  const rTop = Math.max(0.85, rBottom * 0.62);
  v.cone(cx, y0, topY, cz, rBottom, rTop, stackCol);
  if (height >= 8) {
    v.cylinderY(cx, cz, topY - 4, topY - 3, rTop + 0.15, "white");
    v.cylinderY(cx, cz, topY - 2, topY - 1, rTop + 0.1, bandCol);
  }
  v.put(Math.round(cx), topY - 1, Math.round(cz), "black");
}

/**
 * Sculpted 3D hydrodynamic watercraft hull along the Z axis (stern at zStern, pointed V-bow at zBow).
 * Includes submerged keel (y = -1), waterline boot-stripe (y = 0), flared bow sheer, recessed deck,
 * gunwale bulwarks, and crisp bow/stern seafoam wake!
 */
function addCurvedBoatHull(
  v: PixelVox,
  zStern: number,
  zBow: number,
  maxHalfBeam: number,
  freeboardH: number,
  hullCol: string,
  bootCol: string,
  deckCol: string,
  railCol?: string,
) {
  const len = Math.max(4, zBow - zStern);
  for (let z = zStern; z <= zBow; z++) {
    const t = (z - zStern) / len; // 0 = stern, 1 = bow tip
    // Smooth fullness midships, slight tuck at transom stern, crisp hydrodynamic taper to pointed bow
    let profile: number;
    if (t < 0.18) {
      profile = 0.72 + (t / 0.18) * 0.28;
    } else if (t < 0.58) {
      profile = 1.0;
    } else {
      const bt = (t - 0.58) / 0.42;
      profile = Math.max(0.12, Math.pow(1 - bt, 0.85));
    }
    const hwTop = Math.max(0, Math.round(maxHalfBeam * profile));
    const hwKeel = Math.max(0, hwTop - (t > 0.65 ? 1 : 0));
    const bowSheer = t > 0.76 ? 1 : 0;
    const topH = freeboardH + bowSheer;

    // Submerged lower hull & keel at y = -1
    v.box(-hwKeel, -1, z, hwKeel + 1, 0, z + 1, bootCol);
    // Waterline boot-stripe at y = 0
    v.box(-hwTop, 0, z, hwTop + 1, 1, z + 1, bootCol);
    // Freeboard hull walls
    if (topH > 1) {
      v.box(-hwTop, 1, z, hwTop + 1, topH, z + 1, hullCol);
    }
    // Recessed planked/steel deck inside gunwales
    if (hwTop >= 2 && z > zStern && z < zBow - 1) {
      v.box(-hwTop + 1, topH - 1, z, hwTop, topH, z + 1, deckCol);
      if (railCol) {
        v.put(-hwTop, topH, z, railCol);
        v.put(hwTop, topH, z, railCol);
      }
    } else if (railCol && z === zBow) {
      v.put(0, topH, z, railCol); // bow pulpit tip
    }
  }
  // Crisp white bow-wave & stern wake droplets at waterline (y = 0)
  v.put(-1, 0, zBow, "foam", 0.35);
  v.put(1, 0, zBow, "foam", 0.35);
  v.box(-Math.max(1, maxHalfBeam - 1), 0, zStern - 1, Math.max(2, maxHalfBeam), 1, zStern, "foam", 0.35);
}

/**
 * Sculpted 3D wind-billowed triangular / gaff sail along Z (mast at zMast, foot stretching toward zClew),
 * curving outward by +1 voxel in X mid-sail so it reads immediately as billowing canvas, NEVER a brick wall!
 */
function addBillowedSailZ(
  v: PixelVox,
  mastX: number,
  yFoot: number,
  yPeak: number,
  zMast: number,
  zClew: number,
  sailCol: string,
  stripeCol?: string,
) {
  const hSpan = Math.max(2, yPeak - yFoot);
  const dir = zClew >= zMast ? 1 : -1;
  const maxReach = Math.abs(zClew - zMast);
  for (let dy = 0; dy <= hSpan; dy++) {
    const ty = dy / hSpan; // 0 at boom/foot, 1 at masthead peak
    const reach = Math.max(0, Math.round((1 - ty) * maxReach));
    for (let s = 0; s <= reach; s++) {
      const z = zMast + s * dir;
      // Subtle aerodynamic belly curve in X mid-chord & mid-height!
      const chordFrac = reach > 0 ? s / reach : 0;
      const belly =
        reach >= 2 && ty > 0.12 && ty < 0.85 && chordFrac > 0.2 && chordFrac < 0.85 ? 1 : 0;
      const col =
        stripeCol && (dy === Math.floor(hSpan * 0.35) || dy === Math.floor(hSpan * 0.55))
          ? stripeCol
          : sailCol;
      v.put(mastX + belly, yFoot + dy, z, col);
    }
  }
}

function buildNetworkElement(
  def: CivElementDef,
  level: number,
  variant: number,
  connMask: number,
): BuiltVoxelAsset {
  const v = new PixelVox(100 + variant * 31 + level * 7 + connMask);
  // 16x16 per tile -> [-8..8) x [-8..8)
  const n = (connMask & 1) !== 0; // -Z
  const e = (connMask & 2) !== 0; // +X
  const s = (connMask & 4) !== 0; // +Z
  const w = (connMask & 8) !== 0; // -X
  const anyConn = n || e || s || w;

  if (def.isWaterFeature) {
    const isCanal = def.id === "canals";
    const isWide = def.id === "wide_rivers";
    const waterCol = isWide ? "waterDeep" : variant % 2 === 0 ? "water" : "cyan";
    if (isCanal) {
      v.box(-8, 0, -8, 8, 1, 8, waterCol, 0.08);
      if (!n) v.box(-8, 0, -8, 8, 2, -6, "stone");
      if (!s) v.box(-8, 0, 6, 8, 2, 8, "stone");
      if (!w) v.box(-8, 0, -8, -6, 2, 8, "stone");
      if (!e) v.box(6, 0, -8, 8, 2, 8, "stone");
      if (!n) v.put(0, 2, -7, "brass", 0.55);
      if (!s) v.put(0, 2, 6, "brass", 0.55);
      if (level >= 3 && !w && !e) {
        v.box(-6, 1, -1, 6, 2, 0, "woodDark"); // canal lock gate timber
      }
    } else if (def.id === "rivers" || isWide) {
      const bankW = isWide ? 1 : 2;
      v.box(-8, 0, -8, 8, 1, 8, isWide ? "sand" : "grass2");
      v.box(-8 + bankW, 0, -8 + bankW, 8 - bankW, 1, 8 - bankW, waterCol, 0.08);
      if (n || !anyConn) v.box(-8 + bankW, 0, -8, 8 - bankW, 1, 0, waterCol, 0.08);
      if (s || !anyConn) v.box(-8 + bankW, 0, 0, 8 - bankW, 1, 8, waterCol, 0.08);
      if (w) v.box(-8, 0, -8 + bankW, 0, 1, 8 - bankW, waterCol, 0.08);
      if (e) v.box(0, 0, -8 + bankW, 8, 1, 8 - bankW, waterCol, 0.08);
      if (isWide) {
        v.box(-2, 0, -3, 0, 1, -1, "foam", 0.14);
        v.box(1, 0, 2, 3, 1, 4, "foam", 0.14);
      } else {
        v.put(-6, 1, -6, "stone");
        v.put(5, 1, 4, "stone");
      }
    } else {
      // water_tile
      v.box(-8, 0, -8, 8, 1, 8, waterCol, 0.08);
      if (variant % 2 === 0) v.box(-3, 0, 1, -1, 1, 2, "foam", 0.12);
      if (level >= 2) v.box(2, 0, -4, 4, 1, -3, "foam", 0.12);
    }
    clampVoxToFootprint(v, 8, 8);
    return { baseGeo: buildVoxelGeometry(v), topY: 0.7 };
  }

  if (def.isRailNetwork) {
    v.box(-8, 0, -8, 8, 1, 8, "grass2");
    const bedCol = level >= 3 ? "concrete2" : "stone";
    const armN = n || (!anyConn && !e && !w);
    const armS = s || (!anyConn && !e && !w);
    const armE = e;
    const armW = w;
    const railArms = (armN ? 1 : 0) + (armE ? 1 : 0) + (armS ? 1 : 0) + (armW ? 1 : 0);

    // Ballast bed
    v.box(-4, 0, -4, 4, 1, 4, bedCol);
    if (armN) v.box(-4, 0, -8, 4, 1, 0, bedCol);
    if (armS) v.box(-4, 0, 0, 4, 1, 8, bedCol);
    if (armW) v.box(-8, 0, -4, 0, 1, 4, bedCol);
    if (armE) v.box(0, 0, -4, 8, 1, 4, bedCol);

    // Crossties per active arm
    if (armN) {
      for (let z = -8; z < 0; z += 2) v.box(-4, 1, z, 4, 2, z + 1, "woodDark");
      v.box(-3, 1, -8, -2, 2, 0, "steelLight");
      v.box(2, 1, -8, 3, 2, 0, "steelLight");
    }
    if (armS) {
      for (let z = 0; z < 8; z += 2) v.box(-4, 1, z, 4, 2, z + 1, "woodDark");
      v.box(-3, 1, 0, -2, 2, 8, "steelLight");
      v.box(2, 1, 0, 3, 2, 8, "steelLight");
    }
    if (armW) {
      for (let x = -8; x < 0; x += 2) v.box(x, 1, -4, x + 1, 2, 4, "woodDark");
      v.box(-8, 1, -3, 0, 2, -2, "steelLight");
      v.box(-8, 1, 2, 0, 2, 3, "steelLight");
    }
    if (armE) {
      for (let x = 0; x < 8; x += 2) v.box(x, 1, -4, x + 1, 2, 4, "woodDark");
      v.box(0, 1, -3, 8, 2, -2, "steelLight");
      v.box(0, 1, 2, 8, 2, 3, "steelLight");
    }

    // Center rail hub / curved switch frogs
    v.box(-3, 1, -3, -2, 2, 3, "steelLight");
    v.box(2, 1, -3, 3, 2, 3, "steelLight");
    v.box(-3, 1, -3, 3, 2, -2, "steelLight");
    v.box(-3, 1, 2, 3, 2, 3, "steelLight");

    if (level >= 2 || railArms >= 3) {
      const sigX = !armE && !armN ? 5 : !armW && !armN ? -6 : 5;
      const sigZ = !armE && !armN ? -6 : !armW && !armN ? -6 : 5;
      v.box(sigX, 1, sigZ, sigX + 1, 6 + Math.min(2, level), sigZ + 1, "iron");
      v.put(sigX, 6 + Math.min(2, level), sigZ, railArms >= 3 ? "amber" : "screenGreen", 1.15);
    }
    if (level >= 3) {
      // Overhead electric catenary gantry on open corners
      v.box(5, 0, -1, 6, 10 + level, 0, "steelDark");
      v.box(-4, 9 + level, -1, 6, 10 + level, 0, "steel");
    }
    clampVoxToFootprint(v, 8, 8);
    return { baseGeo: buildVoxelGeometry(v), topY: (10 + level) * VOXEL_SIZE };
  }

  // Bridges, Suspension Bridges, Overpasses, Underpasses
  if (
    def.archetype === "bridge_span" ||
    def.archetype === "bridge_suspension" ||
    def.archetype === "road_overpass"
  ) {
    const armN = n || (!anyConn && !e && !w);
    const armS = s || (!anyConn && !e && !w);
    const armE = e;
    const armW = w;
    const bridgeArms = (armN ? 1 : 0) + (armE ? 1 : 0) + (armS ? 1 : 0) + (armW ? 1 : 0);
    const deckY = def.archetype === "road_overpass" ? 5 : 2;
    const isStoneBridge = def.id === "stone_bridges";
    const isSusp = def.archetype === "bridge_suspension";
    const railCol = isSusp ? "crimson" : isStoneBridge ? "limestone" : "steel";

    // Four foundation piers in water/ground
    for (const [px, pz] of [
      [-7, -7],
      [5, -7],
      [-7, 5],
      [5, 5],
    ]) {
      v.box(px, 0, pz, px + 2, deckY, pz + 2, isStoneBridge ? "stone" : "concreteDark");
    }

    // Bridge roadbed spans full [-8..8)
    v.box(-8, deckY, -8, 8, deckY + 1, 8, isStoneBridge ? "concrete" : "asphaltDark");

    // Road center markings per active arm (supports L-turns, T-junctions & 4-way interchanges!)
    if (armN) v.box(-1, deckY, -8, 1, deckY + 1, 0, "white");
    if (armS) v.box(-1, deckY, 0, 1, deckY + 1, 8, "white");
    if (armW) v.box(-8, deckY, -1, 0, deckY + 1, 1, "white");
    if (armE) v.box(0, deckY, -1, 8, deckY + 1, 1, "white");

    // Guardrails strictly along UNCONNECTED sides so branches open smoothly!
    if (!armN) v.box(-8, deckY + 1, -8, 8, deckY + 3, -7, railCol);
    if (!armS) v.box(-8, deckY + 1, 7, 8, deckY + 3, 8, railCol);
    if (!armW) v.box(-8, deckY + 1, -8, -7, deckY + 3, 8, railCol);
    if (!armE) v.box(7, deckY + 1, -8, 8, deckY + 3, 8, railCol);

    // Corner bollards / stone posts on junctions
    for (const [cx, cz] of [
      [-8, -8],
      [7, -8],
      [-8, 7],
      [7, 7],
    ]) {
      v.box(cx, deckY + 1, cz, cx + 1, deckY + 3 + (isStoneBridge ? 1 : 0), cz + 1, railCol);
      if (isStoneBridge && bridgeArms >= 3) {
        v.put(cx, deckY + 4, cz, "warmGlow", 1.0);
      }
    }

    if (isStoneBridge) {
      if (!armN) {
        for (const lx of [-5, 0, 5]) {
          v.box(lx, deckY + 3, -8, lx + 1, deckY + 5, -7, "brass");
          v.put(lx, deckY + 5, -8, "warmGlow", 1.0);
        }
      }
      if (!armS) {
        for (const lx of [-5, 0, 5]) {
          v.box(lx, deckY + 3, 7, lx + 1, deckY + 5, 8, "brass");
          v.put(lx, deckY + 5, 7, "warmGlow", 1.0);
        }
      }
      if (!armW) {
        for (const lz of [-5, 0, 5]) {
          v.box(-8, deckY + 3, lz, -7, deckY + 5, lz + 1, "brass");
          v.put(-8, deckY + 5, lz, "warmGlow", 1.0);
        }
      }
      if (!armE) {
        for (const lz of [-5, 0, 5]) {
          v.box(7, deckY + 3, lz, 8, deckY + 5, lz + 1, "brass");
          v.put(7, deckY + 5, lz, "warmGlow", 1.0);
        }
      }
    } else if (def.id === "bridges") {
      // Steel truss ribs along unconnected sides + overhead ribs only on straight spans
      if (!armN && !armS) {
        for (const tx of [-6, 0, 5]) {
          v.box(tx, deckY + 1, -8, tx + 1, deckY + 8, -7, "steel");
          v.box(tx, deckY + 1, 7, tx + 1, deckY + 8, 8, "steel");
          v.box(tx, deckY + 7, -8, tx + 1, deckY + 8, 8, "steelLight");
        }
        v.box(-8, deckY + 7, -8, 8, deckY + 8, -7, "steel");
        v.box(-8, deckY + 7, 7, 8, deckY + 8, 8, "steel");
      } else if (!armE && !armW) {
        for (const tz of [-6, 0, 5]) {
          v.box(-8, deckY + 1, tz, -7, deckY + 8, tz + 1, "steel");
          v.box(7, deckY + 1, tz, 8, deckY + 8, tz + 1, "steel");
          v.box(-8, deckY + 7, tz, 8, deckY + 8, tz + 1, "steelLight");
        }
        v.box(-8, deckY + 7, -8, -7, deckY + 8, 8, "steel");
        v.box(7, deckY + 7, -8, 8, deckY + 8, 8, "steel");
      } else {
        // Junction corner steel portal arches!
        for (const [cx, cz] of [
          [-8, -8],
          [7, -8],
          [-8, 7],
          [7, 7],
        ]) {
          v.box(cx, deckY + 1, cz, cx + 1, deckY + 8, cz + 1, "steel");
        }
        v.box(-8, deckY + 7, -8, 8, deckY + 8, -7, "steelLight");
        v.box(-8, deckY + 7, 7, 8, deckY + 8, 8, "steelLight");
        v.box(-8, deckY + 7, -8, -7, deckY + 8, 8, "steelLight");
        v.box(7, deckY + 7, -8, 8, deckY + 8, 8, "steelLight");
      }
    } else if (isSusp) {
      const towerH = deckY + 13 + level * 3;
      if (!armN && !armS) {
        v.box(-1, deckY + 1, -8, 1, towerH, -7, "crimson");
        v.box(-1, deckY + 1, 7, 1, towerH, 8, "crimson");
        v.box(-1, towerH - 2, -8, 1, towerH - 1, 8, "crimson");
        v.box(-1, Math.floor((deckY + towerH) * 0.55), -8, 1, Math.floor((deckY + towerH) * 0.55) + 1, 8, "crimson");
        for (let x = -7; x <= 7; x++) {
          const cy = Math.min(towerH - 1, deckY + 3 + Math.round(((Math.abs(x) - 7) ** 2) * 0.2));
          v.put(x, cy, -8, "gold");
          v.put(x, cy, 7, "gold");
          if (x % 3 === 0) {
            v.box(x, deckY + 2, -8, x + 1, cy, -7, "steelLight");
            v.box(x, deckY + 2, 7, x + 1, cy, 8, "steelLight");
          }
        }
      } else if (!armE && !armW) {
        v.box(-8, deckY + 1, -1, -7, towerH, 1, "crimson");
        v.box(7, deckY + 1, -1, 8, towerH, 1, "crimson");
        v.box(-8, towerH - 2, -1, 8, towerH - 1, 1, "crimson");
        v.box(-8, Math.floor((deckY + towerH) * 0.55), -1, 8, Math.floor((deckY + towerH) * 0.55) + 1, 1, "crimson");
        for (let z = -7; z <= 7; z++) {
          const cy = Math.min(towerH - 1, deckY + 3 + Math.round(((Math.abs(z) - 7) ** 2) * 0.2));
          v.put(-8, cy, z, "gold");
          v.put(7, cy, z, "gold");
          if (z % 3 === 0) {
            v.box(-8, deckY + 2, z, -7, cy, z + 1, "steelLight");
            v.box(7, deckY + 2, z, 8, cy, z + 1, "steelLight");
          }
        }
      } else {
        // Branching suspension interchange: corner pylons so all connected branches stay clear!
        for (const [cx, cz] of [
          [-8, -8],
          [7, -8],
          [-8, 7],
          [7, 7],
        ]) {
          v.box(cx, deckY + 1, cz, cx + 1, towerH - 2, cz + 1, "crimson");
          v.put(cx, towerH - 2, cz, "gold", 0.9);
        }
      }
    }

    clampVoxToFootprint(v, 8, 8);
    return { baseGeo: buildVoxelGeometry(v), topY: (deckY + 14) * VOXEL_SIZE };
  }

  // Ground road / path / trail / boardwalk / highway / freeway / underpass tiles
  const bN = (connMask & 16) !== 0;
  const bE = (connMask & 32) !== 0;
  const bS = (connMask & 64) !== 0;
  const bW = (connMask & 128) !== 0;

  const isBoardwalk = def.id === "boardwalks";
  const isDirtRoad = def.id === "dirt_roads";
  const isPath = def.id === "paths";
  const isTrail = def.id === "trails";
  const isWalking = def.id === "walking_paths";
  const isSidewalk = def.id === "side_walks";
  const isPretty = def.id === "pretty_roads";
  const isTownBoulevard = def.id === "two_lane_roads";
  const isTwoLane = isTownBoulevard || def.id === "roads";
  const isHighway = def.id === "highways";
  const isFreeway = def.id === "freeways";
  const isUnderpass = def.id === "underpasses";

  const baseMeadow = isBoardwalk ? "water" : "grass2";
  v.box(-8, 0, -8, 8, 1, 8, baseMeadow);

  if (isPath) {
    // Winding stepping-stone flagstones directly on grass with branching arms
    const armN = n || (!anyConn && !bE && !bW);
    const armS = s || (!anyConn && !bE && !bW);
    v.box(-1, 0, -1, 1, 1, 1, "path");
    if (armN || bN) {
      v.box(-1, 0, -7, 1, 1, -5, "path");
      v.box(0, 0, -4, 2, 1, -2, "path");
    }
    if (armS || bS) {
      v.box(-1, 0, 2, 1, 1, 4, "path");
      v.box(0, 0, 5, 2, 1, 7, "path");
    }
    if (w || bW) {
      v.box(-7, 0, -1, -5, 1, 1, "path");
      v.box(-4, 0, 0, -2, 1, 2, "path");
    }
    if (e || bE) {
      v.box(2, 0, -1, 4, 1, 1, "path");
      v.box(5, 0, 0, 7, 1, 2, "path");
    }
    v.put(-5, 1, -5, "leafLight");
    v.put(5, 1, 5, "yellow");
    clampVoxToFootprint(v, 8, 8);
    return { baseGeo: buildVoxelGeometry(v), topY: 1.0 };
  }

  if (isTrail) {
    const tw = 2;
    v.box(-tw, 0, -tw, tw, 1, tw, "oak");
    if (n || (!anyConn && !bE && !bW)) v.box(-tw, 0, -8, tw, 1, 0, "oak");
    if (s || (!anyConn && !bE && !bW)) v.box(-tw, 0, 0, tw, 1, 8, "oak");
    if (w) v.box(-8, 0, -tw, 0, 1, tw, "oak");
    if (e) v.box(0, 0, -tw, 8, 1, tw, "oak");
    v.box(-1, 0, -1, 1, 1, 1, "woodDark");
    if (!n && !w) v.box(-5, 1, -5, -4, 2, -4, "stone");
    if (!s && !e) v.box(4, 1, 4, 6, 2, 5, "moss");
    if (level >= 2 && !n && !e) {
      v.box(4, 1, -5, 5, 4, -4, "woodDark");
      v.box(3, 3, -5, 6, 4, -4, "wood");
    }
    clampVoxToFootprint(v, 8, 8);
    return { baseGeo: buildVoxelGeometry(v), topY: 1.5 };
  }

  const mainCol = isBoardwalk
    ? "wood"
    : isDirtRoad
      ? "path"
      : isWalking
        ? "path2"
        : isSidewalk
          ? "concrete"
          : isPretty
            ? "brick"
            : isTwoLane || isFreeway
              ? "charcoal"
              : "asphalt";

  const curbCol = isBoardwalk
    ? "woodDark"
    : isDirtRoad
      ? "soil"
      : isWalking
        ? "limestone"
        : isSidewalk
          ? "concreteDark"
          : isPretty
            ? "marble"
            : "concrete";

  const halfW = isFreeway ? 7 : isHighway ? 6 : isTownBoulevard ? Math.min(7, 5 + Math.floor((level - 1) / 5)) : isTwoLane ? Math.min(6, 4 + Math.floor((level - 1) / 4)) : isBoardwalk ? 4 : isDirtRoad ? Math.min(4, 2 + Math.floor((level - 1) / 5)) : 3;
  const apronW = Math.max(1, halfW - 1);

  const armN = n || (!anyConn && !bE && !bW);
  const armS = s || (!anyConn && !bE && !bW);
  const armE = e;
  const armW = w;
  const roadArms = (armN ? 1 : 0) + (armE ? 1 : 0) + (armS ? 1 : 0) + (armW ? 1 : 0);

  // Curbs & sidewalk shoulders (with rounded/wider cul-de-sac pad when roadArms === 1)
  const capPad = roadArms === 1 && !isDirtRoad && !isBoardwalk ? 2 : 1;
  v.box(-halfW - capPad, 0, -halfW - capPad, halfW + capPad, 1, halfW + capPad, curbCol);
  if (armN) v.box(-halfW - 1, 0, -8, halfW + 1, 1, 0, curbCol);
  if (armS) v.box(-halfW - 1, 0, 0, halfW + 1, 1, 8, curbCol);
  if (armW) v.box(-8, 0, -halfW - 1, 0, 1, halfW + 1, curbCol);
  if (armE) v.box(0, 0, -halfW - 1, 8, 1, halfW + 1, curbCol);

  // Driveways linking adjacent buildings cleanly to road
  const apronCol = isDirtRoad ? "path" : isPretty ? "marble" : "concrete";
  if (bN) {
    v.box(-apronW - 1, 0, -8, apronW + 1, 1, 0, curbCol);
    v.box(-apronW, 0, -8, apronW, 1, 0, apronCol);
  }
  if (bS) {
    v.box(-apronW - 1, 0, 0, apronW + 1, 1, 8, curbCol);
    v.box(-apronW, 0, 0, apronW, 1, 8, apronCol);
  }
  if (bW) {
    v.box(-8, 0, -apronW - 1, 0, 1, apronW + 1, curbCol);
    v.box(-8, 0, -apronW, 0, 1, apronW, apronCol);
  }
  if (bE) {
    v.box(0, 0, -apronW - 1, 8, 1, apronW + 1, curbCol);
    v.box(0, 0, -apronW, 8, 1, apronW, apronCol);
  }

  // Main surface (plus turnaround cap on dead ends!)
  const surfPad = roadArms === 1 && !isDirtRoad && !isBoardwalk ? 1 : 0;
  v.box(-halfW - surfPad, 0, -halfW - surfPad, halfW + surfPad, 1, halfW + surfPad, mainCol);
  if (armN) v.box(-halfW, 0, -8, halfW, 1, 0, mainCol);
  if (armS) v.box(-halfW, 0, 0, halfW, 1, 8, mainCol);
  if (armW) v.box(-8, 0, -halfW, 0, 1, halfW, mainCol);
  if (armE) v.box(0, 0, -halfW, 8, 1, halfW, mainCol);

  // Distinct road markings & furniture per road type with full branching support
  if (isDirtRoad) {
    // Tire ruts ONLY on connected arms
    v.box(-1, 0, -1, 2, 1, 2, "soilDark");
    if (armN) {
      v.box(-1, 0, -8, 0, 1, 0, "soilDark");
      v.box(1, 0, -8, 2, 1, 0, "soilDark");
    }
    if (armS) {
      v.box(-1, 0, 0, 0, 1, 8, "soilDark");
      v.box(1, 0, 0, 2, 1, 8, "soilDark");
    }
    if (armW) {
      v.box(-8, 0, -1, 0, 1, 0, "soilDark");
      v.box(-8, 0, 1, 0, 1, 2, "soilDark");
    }
    if (armE) {
      v.box(0, 0, -1, 8, 1, 0, "soilDark");
      v.box(0, 0, 1, 8, 1, 2, "soilDark");
    }
  } else if (isBoardwalk) {
    for (let z = -7; z < 8; z += 2) {
      if (armN && z < 0) v.box(-halfW, 0, z, halfW, 1, z + 1, "woodLight");
      if (armS && z >= 0) v.box(-halfW, 0, z, halfW, 1, z + 1, "woodLight");
    }
    for (let x = -7; x < 8; x += 2) {
      if (armW && x < 0) v.box(x, 0, -halfW, x + 1, 1, halfW, "woodLight");
      if (armE && x >= 0) v.box(x, 0, -halfW, x + 1, 1, halfW, "woodLight");
    }
    for (const [px, pz] of [
      [-halfW - 1, -6],
      [halfW, -6],
      [-halfW - 1, 5],
      [halfW, 5],
    ]) {
      const blockedByArm =
        (px < 0 && armW) || (px >= 0 && armE) || (pz < 0 && armN) || (pz >= 0 && armS);
      if (!blockedByArm) {
        v.box(px, 0, pz, px + 1, 3, pz + 1, "woodDark");
      }
    }
  } else if (isWalking || isSidewalk) {
    if (!armW && !bW) {
      v.box(-halfW - 1, 1, -2, -halfW, 2, 2, isSidewalk ? "leafDark" : "oak");
      if (isWalking) {
        v.box(-halfW - 1, 1, -6, -halfW, 3, -5, "brass");
        v.put(-halfW - 1, 3, -6, "warmGlow", 1.0);
      }
    }
    if (isSidewalk && !armE && !bE) {
      v.box(halfW, 1, 1, halfW + 1, 2, 4, "oak");
    }
  } else if (isPretty) {
    for (let x = -halfW; x < halfW; x += 2) {
      for (let z = -halfW; z < halfW; z += 2) {
        v.put(x, 0, z, "terracotta");
      }
    }
    if (!armN && !armW && !bN && !bW) {
      v.box(-7, 1, -7, -5, 2, -5, "leaf");
      v.put(-6, 2, -6, variant % 2 === 0 ? "pink" : "yellow");
      v.box(-7, 1, -4, -6, 6, -3, "brass");
      v.put(-7, 6, -4, "warmGlow", 1.1);
    }
    if (!armS && !armE && !bS && !bE) {
      v.box(5, 1, 5, 7, 2, 7, "leaf");
      v.put(6, 2, 6, variant % 2 === 0 ? "yellow" : "pink");
    }
  } else if (isHighway || isFreeway) {
    const barrierCol = isFreeway ? "busYellow" : "concrete";
    const isStraightNS = armN && armS && !armE && !armW;
    const isStraightEW = armE && armW && !armN && !armS;

    // White edge lines on unconnected edges of the junction box + along active arms
    if (!armN) v.box(-halfW, 0, -halfW, halfW, 1, -halfW + 1, "white");
    if (!armS) v.box(-halfW, 0, halfW - 1, halfW, 1, halfW, "white");
    if (!armW) v.box(-halfW, 0, -halfW, -halfW + 1, 1, halfW, "white");
    if (!armE) v.box(halfW - 1, 0, -halfW, halfW, 1, halfW, "white");

    if (armN) {
      v.box(-halfW, 0, -8, -halfW + 1, 1, -halfW, "white");
      v.box(halfW - 1, 0, -8, halfW, 1, -halfW, "white");
      v.box(-1, 1, -8, 1, 2, isStraightNS ? 0 : -halfW, barrierCol);
    }
    if (armS) {
      v.box(-halfW, 0, halfW, -halfW + 1, 1, 8, "white");
      v.box(halfW - 1, 0, halfW, halfW, 1, 8, "white");
      v.box(-1, 1, isStraightNS ? 0 : halfW, 1, 2, 8, barrierCol);
    }
    if (armW) {
      v.box(-8, 0, -halfW, -halfW, 1, -halfW + 1, "white");
      v.box(-8, 0, halfW - 1, -halfW, 1, halfW, "white");
      v.box(-8, 1, -1, isStraightEW ? 0 : -halfW, 2, 1, barrierCol);
    }
    if (armE) {
      v.box(halfW, 0, -halfW, 8, 1, -halfW + 1, "white");
      v.box(halfW, 0, halfW - 1, 8, 1, halfW, "white");
      v.box(isStraightEW ? 0 : halfW, 1, -1, 8, 2, 1, barrierCol);
    }

    // Center hub dots / interchange chevrons on highway branches
    if (roadArms >= 3) {
      v.put(-2, 0, -2, "white");
      v.put(1, 0, -2, "white");
      v.put(-2, 0, 1, "white");
      v.put(1, 0, 1, "white");
    } else if (!isStraightNS && !isStraightEW) {
      v.box(-1, 0, -1, 1, 1, 1, "busYellow");
    }

    // Highway directional gantry on straight N-S segments or corner mast on junctions
    if (isStraightNS && (level >= 2 || isFreeway) && !bE && !bW) {
      v.box(-6, 1, 0, -5, 9, 1, "steel");
      v.box(5, 1, 0, 6, 9, 1, "steel");
      v.box(-6, 8, 0, 6, 9, 1, "steelLight");
      v.box(-3, 7, 0, 3, 9, 1, isFreeway ? "blueDark" : "tealDark");
    } else if (roadArms >= 3) {
      v.box(-7, 1, -7, -6, 8, -6, "steel");
      v.put(-7, 8, -7, "warmGlow", 1.15);
    }
  } else if (isUnderpass) {
    v.box(-6, 1, -8, -5, 6, 8, "concreteDark");
    v.box(5, 1, -8, 6, 6, 8, "concreteDark");
    v.box(-6, 5, -3, 6, 6, 3, "concrete");
    v.box(-5, 6, -2, 5, 7, 2, "grass");
  } else {
    // "roads" (white center dashes) vs "two_lane_roads" (double yellow center stripe + lamps)
    const isIntersection = roadArms >= 3;
    const isCorner = roadArms === 2 && (armN || armS) && (armE || armW);
    const stripeCol = isTwoLane ? "busYellow" : level >= 3 ? "busYellow" : "white";

    if (isTwoLane) {
      // Four-lane boulevard gets outer lane dividers; starter road begins as two lanes.
      if (isTownBoulevard) {
        for (let c = -7; c < 8; c += 3) {
          if (armN && c < 0) {
            v.box(-3, 0, c, -2, 1, Math.min(0, c + 1), "white");
            v.box(2, 0, c, 3, 1, Math.min(0, c + 1), "white");
          }
          if (armS && c >= 0) {
            v.box(-3, 0, c, -2, 1, Math.min(8, c + 1), "white");
            v.box(2, 0, c, 3, 1, Math.min(8, c + 1), "white");
          }
        }
      }
      const stopGap = isIntersection ? halfW : 0;
      if (armN) v.box(-1, 0, -8, 1, 1, -stopGap, "busYellow");
      if (armS) v.box(-1, 0, stopGap, 1, 1, 8, "busYellow");
      if (armW) v.box(-8, 0, -1, -stopGap, 1, 1, "busYellow");
      if (armE) v.box(stopGap, 0, -1, 8, 1, 1, "busYellow");
      if (isCorner) {
        v.box(-1, 0, -1, 1, 1, 1, "busYellow");
      }
      if (!armN && !armW && !bN && !bW) {
        v.box(-6, 1, -6, -5, 6, -5, "iron");
        v.put(-6, 6, -6, "warmGlow", 1.1);
      }
    } else {
      if (armN) {
        v.box(0, 0, -7, 1, 1, -5, stripeCol);
        if (!isIntersection) v.box(0, 0, -3, 1, 1, -1, stripeCol);
      }
      if (armS) {
        if (!isIntersection) v.box(0, 0, 1, 1, 1, 3, stripeCol);
        v.box(0, 0, 5, 1, 1, 7, stripeCol);
      }
      if (armW) {
        v.box(-7, 0, 0, -5, 1, 1, stripeCol);
        if (!isIntersection) v.box(-3, 0, 0, -1, 1, 1, stripeCol);
      }
      if (armE) {
        if (!isIntersection) v.box(1, 0, 0, 3, 1, 1, stripeCol);
        v.box(5, 0, 0, 7, 1, 1, stripeCol);
      }
      if (isCorner) {
        v.put(0, 0, 0, stripeCol);
        if (armN && armE) v.put(1, 0, -1, stripeCol);
        if (armN && armW) v.put(-1, 0, -1, stripeCol);
        if (armS && armE) v.put(1, 0, 1, stripeCol);
        if (armS && armW) v.put(-1, 0, 1, stripeCol);
      }
    }

    // Zebra Crosswalks + Traffic Signal Poles on T-junctions & 4-Way Intersections!
    if (isIntersection) {
      for (let k = -halfW + 1; k < halfW; k += 2) {
        if (armN) v.put(k, 0, -halfW, "white");
        if (armS) v.put(k, 0, halfW - 1, "white");
        if (armW) v.put(-halfW, 0, k, "white");
        if (armE) v.put(halfW - 1, 0, k, "white");
      }
      // Corner traffic lights on available corners
      const sigCorners: [boolean, number, number][] = [
        [!armN && !armW, -halfW - 1, -halfW - 1],
        [!armS && !armE, halfW, halfW],
        [!armN && !armE, halfW, -halfW - 1],
        [!armS && !armW, -halfW - 1, halfW],
      ];
      let placedSignals = 0;
      for (const [free, sx, sz] of sigCorners) {
        if (!free && placedSignals > 0) continue;
        if (placedSignals >= 2) break;
        const px = Math.max(-7, Math.min(6, sx));
        const pz = Math.max(-7, Math.min(6, sz));
        v.box(px, 1, pz, px + 1, 6, pz + 1, "iron");
        v.put(px, 5, pz, placedSignals === 0 ? "screenGreen" : "red", 1.15);
        v.put(px, 6, pz, "amber", 0.9);
        placedSignals += 1;
      }
    } else if (roadArms === 1) {
      // Neat cul-de-sac island dot!
      v.put(0, 0, 0, "busYellow");
    }
  }

  clampVoxToFootprint(v, 8, 8);
  return { baseGeo: buildVoxelGeometry(v), topY: 2.5 };
}

export function getOrBuildElementAsset(
  elementId: string,
  level: number,
  variant: number,
  spanX: number,
  spanZ: number,
  connMask = 0,
): BuiltVoxelAsset {
  const def = ELEMENT_BY_ID[elementId];
  const clampedLv = Math.max(1, Math.min(def?.isRoadNetwork ? 11 : 5, level | 0));
  const clampedVar = ((variant | 0) % 4 + 4) % 4;
  const key = `${elementId}|L${clampedLv}|V${clampedVar}|${spanX}x${spanZ}|C${connMask}`;
  const existing = assetCache.get(key);
  if (existing) return existing;

  if (!def) {
    const fallback = new PixelVox(1);
    fallback.box(-5, 0, -5, 5, 8, 5, "brick");
    const asset = { baseGeo: buildVoxelGeometry(fallback), topY: 2.2 };
    assetCache.set(key, asset);
    return asset;
  }

  if (def.isNetwork) {
    const netAsset = buildNetworkElement(def, clampedLv, clampedVar, connMask);
    assetCache.set(key, netAsset);
    return netAsset;
  }

  const v = new PixelVox(
    hashInt(elementId.charCodeAt(0) * 31 + elementId.length, clampedLv, clampedVar) + 11,
  );
  let rotorVox: PixelVox | null = null;
  let rotorPivot: [number, number, number] | undefined;
  let rotorAxis: "x" | "y" | "z" = "z";
  let rotorSpeed = 1.6;
  let bobOnWater = false;

  const halfX = Math.floor((spanX * VOXELS_PER_TILE) / 2); // 8 for 1x1, 16 for 2x2, 24 for 3x3
  const halfZ = Math.floor((spanZ * VOXELS_PER_TILE) / 2);
  const padX = halfX - 1;
  const padZ = halfZ - 1;
  const st = getVariantStyle(elementId, clampedVar);

  // Height multiplier scales dramatically from Lv.1 to Lv.5 while footprint caps <= 3x3
  const hLv =
    clampedLv === 1
      ? 1.0
      : clampedLv === 2
        ? 1.42
        : clampedLv === 3
          ? 1.92
          : clampedLv === 4
            ? 2.52
            : 3.22;

  if (def.domain === "water") {
    bobOnWater = true;
  }

  // ===================== BESPOKE ARCHITECTURAL DESIGNS FOR ALL ~148 ELEMENTS =====================
  // Every element sits directly on the natural island grass / coastal sand / ocean water (ZERO rectangular plinth slabs!)
  // and transforms its architectural form, wings, materials, and details across Levels 1..5.
  switch (def.id) {
    // --------------------- HOUSING (14) ---------------------
    case "tiny_homes": {
      // Compact 1x1 Nordic Tiny Home evolving across 5 distinct architectural stages:
      // Lv.1: Minimalist cedar A-frame micro-cabin
      // Lv.2: Timber deck + loft skylight & flower planter
      // Lv.3: Split-shed modern tiny home with glass sunroom nook
      // Lv.4: Two-tier cantilevered tiny loft with solar roof & pergola
      // Lv.5: Sculptural cedar-and-copper treehouse/atelier tiny retreat with rooftop stargazing deck!
      const deckCol = "woodDark";
      const bodyCol = clampedVar % 2 === 0 ? "woodLight" : "oak";
      if (clampedLv === 1) {
        v.box(-4, 0, -4, 4, 1, 5, deckCol);
        v.box(-4, 1, -4, 4, 4, 3, bodyCol);
        addGableSafe(v, -5, 3, -4, 5, 3, 5, "x", "slate", "wood");
        v.box(-1, 1, 2, 1, 3, 3, "woodDark");
        v.put(2, 2, 2, "warmGlow", 0.9);
      } else if (clampedLv === 2) {
        v.box(-5, 0, -4, 5, 1, 6, deckCol);
        v.box(-5, 1, -4, 4, 5, 3, bodyCol);
        addGableSafe(v, -6, 4, -4, 5, 3, 5, "x", "slate", "wood");
        v.box(-2, 6, -2, 1, 7, 1, "solarBlue");
        v.box(-1, 1, 2, 1, 4, 3, "woodDark");
        v.put(-3, 2, 2, "warmGlow", 0.95);
        v.box(2, 1, 4, 5, 2, 6, "leaf");
        v.put(3, 2, 5, "pink");
      } else if (clampedLv === 3) {
        v.box(-6, 0, -5, 6, 1, 6, deckCol);
        v.box(-6, 1, -5, 1, 6, 4, bodyCol);
        addGableSafe(v, -6, 6, -5, 2, 4, 4, "x", "tealDark", "cream");
        // Glass sunroom wing on +X
        v.box(1, 1, -3, 6, 5, 5, "glass", 0.58);
        v.box(1, 5, -3, 6, 6, 5, "woodDark");
        v.put(-3, 3, 3, "warmGlow", 0.95);
      } else if (clampedLv === 4) {
        v.box(-6, 0, -5, 6, 1, 6, deckCol);
        v.box(-6, 1, -5, 2, 5, 4, "charcoal");
        // Cantilevered upper cedar sleeping loft!
        v.box(-4, 5, -4, 6, 9, 5, bodyCol);
        v.box(-4, 9, -4, 6, 10, 5, "slate");
        v.box(-2, 10, -2, 4, 11, 3, "solarBlue");
        addWindowGrid(v, -4, 5, -4, 6, 9, 5, 2, 0.55, "warmGlow");
        v.box(3, 1, 2, 4, 5, 3, "woodDark"); // support post under cantilever
      } else {
        // Lv.5 Masterwork Nordic Atelier Tiny Villa with copper roof & rooftop deck
        v.box(-6, 0, -6, 6, 1, 6, "stone");
        v.box(-6, 1, -5, 2, 7, 4, bodyCol);
        addGableSafe(v, -7, 7, -5, 3, 4, 5, "x", "copper", "cream");
        v.box(2, 1, -4, 6, 6, 5, "glass", 0.65);
        v.box(2, 6, -4, 6, 7, 5, "woodLight"); // rooftop stargazing deck
        v.put(4, 7, 0, "warmGlow", 1.1);
        v.box(-5, 7, -4, -3, 13, -2, "stone"); // hearth chimney
      }
      break;
    }

    case "trailer_home": {
      // Retro Rounded Airstream & Park-Model Community (ZERO flat slabs!)
      const bodyCol = clampedVar === 0 ? "silver" : clampedVar === 1 ? "cream" : clampedVar === 2 ? "white" : "sky";
      const bandCol = clampedVar === 0 ? "teal" : clampedVar === 1 ? "orange" : clampedVar === 2 ? "crimson" : "gold";
      const bx = Math.max(5, padX - 1);
      // Primary rounded streamliner trailer sitting on wheels & hitch
      const z0 = clampedLv >= 3 ? -5 : -3;
      const z1 = z0 + 5;
      v.box(-bx, 1, z0 + 2, -bx + 2, 2, z0 + 3, "steelDark"); // tow hitch
      for (const wx of [-Math.floor(bx * 0.45), Math.floor(bx * 0.35)]) {
        v.box(wx - 1, 0, z1 - 1, wx + 1, 2, z1, "rubber");
        v.box(wx - 1, 0, z0, wx + 1, 2, z0 + 1, "rubber");
      }
      v.box(-bx + 1, 1, z0, bx - 1, 5, z1, bodyCol);
      v.box(-bx + 2, 5, z0 + 1, bx - 2, 6, z1 - 1, "chrome"); // curved roof crown
      v.box(-bx + 1, 2, z0, bx - 1, 3, z1, bandCol);
      for (let x = -bx + 2; x < bx - 2; x += 3) {
        v.put(x, 3, z1 - 1, "warmGlow", 0.65);
      }
      if (clampedLv >= 2) {
        // Timber front porch + striped sun awning
        v.box(-bx + 2, 0, z1, bx - 2, 1, Math.min(padZ, z1 + 3), "woodLight");
        for (let x = -bx + 2; x < bx - 2; x++) {
          v.put(x, 4, z1, x % 2 === 0 ? bandCol : "white");
        }
      }
      if (clampedLv >= 3) {
        // Offset pastel guest teardrop camper + palm/shade tree on 2x1 lot
        v.box(-bx + 1, 1, 1, -1, 4, Math.min(padZ, 5), "cream");
        v.box(-bx + 2, 4, 2, -2, 5, Math.min(padZ - 1, 4), bandCol);
        addPalmMini(v, bx - 3, 0, 2, 6);
      }
      if (clampedLv >= 4) {
        // Upper Pop-Top Double-Decker Lounge + String-Lit Patio Pergola
        v.box(-2, 5, z0 + 1, bx - 2, 8, z1 - 1, "white");
        v.box(-2, 8, z0 + 1, bx - 2, 9, z1 - 1, bandCol);
        v.put(1, 6, z1 - 2, "warmGlow", 0.9);
      }
      if (clampedLv >= 5) {
        // Iconic Retro Resort Court with Gazebo Tiki Bar & Neon Flamingo Sign
        v.box(1, 0, 1, bx - 1, 1, Math.min(padZ, 6), "wood");
        v.cone(Math.floor(bx * 0.5), 4, 7, 3.5, 2.8, 0.4, bandCol);
        v.box(bx - 2, 0, 4, bx - 1, 7, 5, "chrome");
        v.put(bx - 2, 7, 4, "magenta", 1.25);
      }
      break;
    }

    case "cottages": {
      // Storybook 1x1 Country Cottage transforming from humble thatch hut -> half-timber Tudor -> fairy-tale turret cottage!
      if (clampedLv === 1) {
        v.hollowBox(-5, 0, -4, 5, 4, 4, "cream", "stone");
        addGableSafe(v, -6, 4, -5, 6, 5, 4, "x", "wood", "oak");
        v.box(-1, 0, 3, 1, 3, 4, "oak");
        v.put(2, 2, 3, "warmGlow", 0.85);
        v.box(-4, 4, -3, -2, 8, -1, "stone");
      } else if (clampedLv === 2) {
        v.box(-5, 0, -4, 5, 2, 4, "stone");
        v.hollowBox(-5, 2, -4, 5, 5, 4, "cream", "woodDark");
        addGableSafe(v, -6, 5, -5, 6, 5, 5, "x", "terracotta", "oak");
        // Dormer window + flower boxes
        v.box(-2, 5, 1, 2, 8, 4, "cream");
        addGableSafe(v, -2, 8, 1, 2, 4, 2, "z", "terracotta");
        v.put(0, 6, 3, "warmGlow", 0.95);
        v.box(-4, 1, 4, -2, 2, 5, "pink");
        v.box(-1, 0, 3, 1, 3, 4, "oak");
        v.box(-4, 5, -3, -2, 10, -1, "stone");
      } else if (clampedLv === 3) {
        // Cross-gabled Tudor half-timber cottage with stone garden wall
        v.hollowBox(-6, 0, -5, 3, 6, 4, "cream", "woodDark");
        addGableSafe(v, -7, 6, -5, 4, 4, 4, "x", "wood", "woodDark");
        v.hollowBox(0, 0, -2, 6, 7, 6, "plaster", "woodDark");
        addGableSafe(v, 0, 7, -2, 7, 6, 4, "z", "wood", "woodDark");
        addWindowGrid(v, -6, 1, -5, 6, 6, 6, 2, 0.55, "warmGlow");
        v.box(-5, 6, -4, -3, 12, -2, "stone");
      } else if (clampedLv === 4) {
        // Storybook stone cottage + round corner witch-hat turret!
        v.hollowBox(-6, 0, -5, 3, 7, 4, "cream", "stone");
        addGableSafe(v, -7, 7, -5, 3, 4, 5, "x", "slate", "woodDark");
        v.cylinderY(3.5, 2.5, 0, 10, 2.5, "stone");
        v.put(3, 7, 5, "warmGlow", 1.0);
        v.cone(3.5, 10, 16, 2.5, 3.0, 0.35, "terracotta");
        v.box(-5, 0, 4, -1, 1, 6, "path");
        v.put(-4, 1, 5, "pink");
      } else {
        // Lv.5 Enchanted Cotswold Manor Cottage with twin gables, conservatory bay, stone turret & blossom tree
        v.hollowBox(-6, 0, -6, 3, 8, 4, "limestone", "woodDark");
        addGableSafe(v, -7, 8, -6, 4, 4, 5, "x", "copper", "cream");
        v.cylinderY(3.8, 2.2, 0, 12, 2.6, "stone");
        v.cone(3.8, 12, 19, 2.2, 3.1, 0.35, "copper");
        v.put(4, 9, 5, "warmGlow", 1.05);
        v.box(-6, 0, 4, 0, 4, 6, "glass", 0.6); // sunlit conservatory bay
        v.box(-5, 8, -5, -3, 15, -3, "brickDark");
        addTreeMini(v, -5, 0, 5, 1);
      }
      break;
    }

    case "house": {
      // Stage 1 Starter House: evolves from 1-story starter bungalow -> 2-story porch house -> Victorian gable house -> 2x1 cross-wing family home -> grand Colonial revival!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      if (clampedLv === 1) {
        v.hollowBox(-5, 0, -4, 5, 5, 4, st.wall, st.trim);
        addGableSafe(v, -6, 5, -5, 6, 5, 4, "x", st.roof, st.trim);
        v.box(-1, 0, 3, 1, 3, 5, "woodDark");
        v.box(-2, 0, 4, 2, 1, 6, "stone"); // front stoop steps
        v.put(-3, 2, 3, "glass", 0.45);
        v.put(3, 2, 3, "warmGlow", 0.75);
      } else if (clampedLv === 2) {
        // Two-story Craftsman home with covered front porch
        v.hollowBox(-5, 0, -5, 5, 7, 3, st.wall, st.trim);
        addWindowGrid(v, -5, 1, -5, 5, 7, 3, 3, 0.48);
        addGableSafe(v, -6, 7, -6, 6, 4, 4, "x", st.roof, st.trim);
        v.box(-5, 0, 3, 5, 1, 6, "woodLight");
        v.box(-5, 1, 5, -4, 4, 6, st.trim);
        v.box(4, 1, 5, 5, 4, 6, st.trim);
        v.box(-5, 4, 3, 5, 5, 6, st.roof);
        v.box(-4, 7, -4, -2, 11, -2, "brickDark");
      } else if (clampedLv === 3) {
        // Queen Anne 2.5-story house with projecting front gable & bay window
        v.hollowBox(-6, 0, -5, 6, 9, 3, st.wall, st.trim);
        v.hollowBox(0, 0, 1, 6, 10, 6, st.wall, st.trim);
        addWindowGrid(v, -6, 1, -5, 6, 9, 6, 3, 0.5);
        addGableSafe(v, -7, 9, -6, 7, 4, 4, "x", st.roof, st.trim);
        addGableSafe(v, -1, 10, 0, 7, 7, 4, "z", st.roof, st.trim);
        v.box(-6, 0, 3, 0, 1, 6, "wood");
        addTreeMini(v, -4, 0, 4, clampedVar);
      } else if (clampedLv === 4) {
        // 2x1 Cross-Gable Family Residence with attached garage & sundeck!
        const splitX = 2;
        v.hollowBox(-bx, 0, -bz, splitX, 9, bz - 1, st.wall, st.trim);
        addWindowGrid(v, -bx, 1, -bz, splitX, 9, bz - 1, 3, 0.48);
        addGableSafe(v, -bx - 1, 9, -bz - 1, splitX + 1, bz, 5, "x", st.roof, st.trim);
        // Attached garage + upper deck on +X
        v.box(splitX, 0, -bz + 1, bx, 5, bz, st.wall);
        v.box(splitX + 2, 0, bz - 1, bx - 2, 4, bz, "white");
        v.box(splitX, 5, -bz + 1, bx, 6, bz, "woodLight");
        addTreeMini(v, -bx + 1, 0, bz - 1, clampedVar);
      } else {
        // Lv.5 Grand Colonial Revival Residence with pillared portico, dormer cupola & garden wing!
        const mainX1 = Math.max(3, bx - 4);
        v.hollowBox(-bx, 0, -bz, mainX1, 11, bz - 1, st.wall, "white");
        addWindowGrid(v, -bx, 1, -bz, mainX1, 11, bz - 1, 3, 0.55);
        addGableSafe(v, -bx - 1, 11, -bz - 1, mainX1 + 1, bz, 5, "x", st.roof, "white");
        // Pillared portico
        for (const px of [-4, -1]) {
          v.box(px, 0, bz - 1, px + 1, 8, bz + 1, "white");
        }
        addGableSafe(v, -5, 8, bz - 2, 1, bz + 1, 3, "z", st.roof, "white");
        // Sunroom & carriage wing on +X + octagonal roof cupola
        v.box(mainX1, 0, -bz + 1, bx, 6, bz - 1, "cream");
        v.box(mainX1 + 1, 6, -bz + 2, bx - 1, 9, bz - 2, "glass", 0.6);
        v.hollowBox(-3, 14, -2, 0, 17, 1, "white");
        v.cone(-1.5, 17, 20, -0.5, 2.0, 0.35, "copper");
      }
      break;
    }

    case "medium_sized_homes": {
      // 2x1 Suburban Split-Level Residence (distinct from Stage 1 House right from Lv.1!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const garX0 = Math.max(2, bx - 6);
      const mainH = 5 + clampedLv * 2;
      // Main two-story living wing on -X
      v.hollowBox(-bx, 0, -bz, garX0, mainH, bz - 1, st.wall, st.trim);
      addWindowGrid(v, -bx, 1, -bz, garX0, mainH, bz - 1, 3, 0.45);
      addGableSafe(v, -bx - 1, mainH, -bz - 1, garX0 + 1, bz, 4, "x", st.roof, "white");
      // Attached garage with white sectional door & short asphalt apron (only under driveway!)
      v.box(garX0, 0, -bz + 1, bx, 5, bz, st.wall);
      v.box(garX0 + 1, 0, bz - 1, bx - 1, 4, bz, "white");
      v.box(garX0 + 1, 0, bz, bx - 1, 1, padZ, "asphalt");
      if (clampedLv === 1) {
        addGableSafe(v, garX0, 5, -bz + 1, bx + 1, bz, 3, "x", st.roof);
      } else if (clampedLv === 2) {
        v.box(garX0, 5, -bz + 1, bx, 6, bz, "woodLight"); // sundeck over garage
        addTreeMini(v, -bx + 1, 0, bz - 1, clampedVar);
      } else if (clampedLv === 3) {
        // Bonus room gable above garage + front bay window
        v.hollowBox(garX0, 5, -bz + 1, bx, 9, bz - 1, st.wall, st.trim);
        addGableSafe(v, garX0, 9, -bz + 1, bx + 1, bz - 1, 3, "z", st.roof, "white");
        v.box(-bx + 2, 1, bz - 1, -bx + 6, 5, bz + 1, "glass", 0.55);
      } else if (clampedLv === 4) {
        // Contemporary split-level with cantilevered cedar wing & corner glass stairwell
        v.box(garX0, 5, -bz, bx, 10, bz, "woodLight");
        v.box(garX0, 10, -bz, bx, 11, bz, st.roof);
        v.box(-2, 0, bz - 2, 2, mainH + 2, bz + 1, "glass", 0.65);
      } else {
        // Lv.5 Executive Suburban Estate with corner octagonal turret, double garage & solar array
        v.hollowBox(garX0, 5, -bz + 1, bx, 10, bz - 1, st.wall, st.trim);
        addGableSafe(v, garX0, 10, -bz, bx + 1, bz, 4, "z", st.roof, "white");
        v.cylinderY(-bx + 2.5, bz - 1.5, 0, mainH + 4, 2.4, st.wall);
        v.cone(-bx + 2.5, mainH + 4, mainH + 9, bz - 1.5, 2.8, 0.35, st.roof);
        v.box(-bx + 4, mainH + 2, 0, garX0 - 2, mainH + 3, 3, "solarBlue");
      }
      break;
    }

    case "townhomes": {
      // Elongated 2x1 -> 3x1 Urban Rowhouse Terrace (Brick/Brownstone/Limestone stepped units with front stoops!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const units = spanX >= 3 ? 5 : 3;
      const rowCols = ["brick", "terracotta", "limestone", "tealDark", "brick2"];
      const stepW = Math.floor((bx * 2) / units);
      const baseH = 6 + clampedLv * 2;
      for (let u = 0; u < units; u++) {
        const ux0 = -bx + u * stepW;
        const ux1 = u === units - 1 ? bx : ux0 + stepW;
        const uh = baseH + ((u + clampedLv) % 3) * 2;
        const uCol = rowCols[(u + clampedVar) % rowCols.length];
        v.hollowBox(ux0, 0, -bz, ux1, uh, bz - 1, uCol, "white");
        addWindowGrid(v, ux0, 2, -bz, ux1, uh, bz - 1, 3, 0.48);
        // Classic brownstone front stoop steps & recessed door
        const doorX = Math.floor((ux0 + ux1) / 2);
        v.box(doorX - 1, 0, bz - 1, doorX + 1, 2, bz + 1, "stone");
        v.box(doorX - 1, 2, bz - 2, doorX + 1, 5, bz - 1, "woodDark");
        if (clampedLv <= 2) {
          // Flat brownstone cornice parapet
          v.box(ux0, uh, -bz, ux1, uh + 1, bz, "limestone");
        } else if (clampedLv <= 4) {
          // Amsterdam stepped bell/crow-step gables!
          addGableSafe(v, ux0, uh, -bz, ux1, bz - 1, 3 + (u % 2), "z", u % 2 === 0 ? "slate" : "copper", "white");
        } else {
          // Parisian Second-Empire mansard roofs with dormers & wrought-iron balconies!
          addHippedRoofSafe(v, ux0, uh, -bz, ux1, bz - 1, 3, "slate", "gold");
          v.put(doorX, uh + 1, bz - 2, "warmGlow", 0.95);
          v.box(ux0 + 1, 5, bz - 1, ux1 - 1, 6, bz, "iron");
        }
      }
      break;
    }

    case "large_homes": {
      // Tudor / Victorian Country Manor evolving from L-wing manor -> courtyard turreted estate -> grand conservatory manor
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const lowH = 6 + clampedLv;
      const mainH = 7 + clampedLv * 2;
      // Rear & West wing
      v.hollowBox(-bx, 0, -bz, bx - 2, lowH, 0, st.wall, "white");
      addWindowGrid(v, -bx, 1, -bz, bx - 2, lowH, 0, 3, 0.45);
      addGableSafe(v, -bx - 1, lowH, -bz - 1, bx - 1, 1, 4, "x", st.roof, "white");
      // Projecting East gable wing
      v.hollowBox(1, 0, -bz + 1, bx, mainH, bz, st.wall, "white");
      addWindowGrid(v, 1, 1, -bz + 1, bx, mainH, bz, 3, 0.48);
      addGableSafe(v, 0, mainH, -bz + 1, bx + 1, bz + 1, 5, "z", st.roof, "white");
      // Chimneys
      v.box(-bx + 2, lowH, -bz + 1, -bx + 4, lowH + 6, -bz + 3, "brickDark");
      if (clampedLv >= 2) {
        // Octagonal corner turret at the inner L-elbow!
        const turH = mainH + 4 + clampedLv * 2;
        v.cylinderY(0, 0.5, 0, turH, 2.4, st.wall);
        v.put(0, turH - 2, 3, "warmGlow", 1.0);
        v.cone(0, turH, turH + 6, 0.5, 2.9, 0.35, "copper");
      }
      if (clampedLv >= 3 && bz >= 8) {
        // Glass conservatory pavilion + garden trees in SW courtyard!
        v.dome(-Math.floor(bx * 0.52), 0, Math.floor(bz * 0.42), 3.0, "glass", 0.58);
        addTreeMini(v, -bx + 2, 0, bz - 2, clampedVar);
      }
      if (clampedLv >= 5) {
        // Porte-cochère carriage arch & gated stone piers
        v.box(-4, 0, bz - 2, -3, 4, bz, "stone");
        v.box(0, 0, bz - 2, 1, 4, bz, "stone");
        v.put(-4, 4, bz - 1, "warmGlow", 1.1);
        v.put(0, 4, bz - 1, "warmGlow", 1.1);
      }
      break;
    }

    case "beach_houses": {
      // Coastal Stilt Pavilion directly on timber pilings (NO square concrete slab, NO spiral tower!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const deckY = 3;
      const h = 5 + clampedLv;
      // Timber pilings gripping natural coastal sand
      for (let px = -bx + 1; px <= bx - 2; px += Math.max(3, Math.floor(bx * 0.6))) {
        for (const pz of [-bz + 1, 0, bz - 2]) {
          v.box(px, 0, pz, px + 1, deckY, pz + 1, "woodDark");
        }
      }
      // Elevated sun-bleached cedar deck & exterior beach stairs
      v.box(-bx, deckY, -bz, bx, deckY + 1, bz - 1, "woodLight");
      for (let s = 0; s < deckY; s++) {
        v.box(-2, s, bz - 1 + (deckY - 1 - s), 1, s + 1, bz + (deckY - s), "wood");
      }
      const bodyC = clampedVar === 0 ? "cyan" : clampedVar === 1 ? "pink" : clampedVar === 2 ? "sky" : "cream";
      const mainX1 = Math.max(1, bx - 4);
      v.hollowBox(-bx + 1, deckY + 1, -bz + 1, mainX1, deckY + 1 + h, bz - 2, bodyC, "white");
      addWindowGrid(v, -bx + 1, deckY + 2, -bz + 1, mainX1, deckY + 1 + h, bz - 2, 2, 0.55);
      addGableSafe(v, -bx, deckY + 1 + h, -bz, mainX1 + 1, bz - 1, 4, "x", "white", "teal");
      // Sun-deck umbrella & lounger on +X
      v.box(bx - 3, deckY + 1, 0, bx - 2, deckY + 4, 1, "white");
      v.cone(bx - 2.5, deckY + 4, deckY + 6, 0.5, 2.3, 0.4, "orange");
      if (clampedLv >= 2) {
        addPalmMini(v, -bx + 1, 0, bz - 1, 6 + clampedLv);
      }
      if (clampedLv >= 3) {
        // Breezy square widow's-walk belvedere cupola on roof!
        const cupY = deckY + 3 + h;
        v.hollowBox(-3, cupY, -2, 1, cupY + 4, 2, "white", "teal");
        addHippedRoofSafe(v, -4, cupY + 4, -3, 2, 3, 3, "teal", "white");
        v.put(-1, cupY + 2, 1, "warmGlow", 1.0);
      }
      if (clampedLv >= 4 && bz >= 8) {
        // Infinity plunge pool cantilevered into the front deck + second guest cabana wing!
        v.box(mainX1 + 1, deckY, -bz + 2, bx - 1, deckY + 2, 2, "water", 0.42);
        v.hollowBox(mainX1 + 1, deckY + 1, 2, bx - 1, deckY + 6, bz - 2, "white", bodyC);
        addHippedRoofSafe(v, mainX1, deckY + 6, 1, bx, bz - 1, 3, "teal", "white");
      }
      break;
    }

    case "villas": {
      // Mediterranean Terracotta Hillside L-Villa wrapping an open turquoise pool & cypress garden (NO concrete slab!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const lowH = 5 + clampedLv;
      // North main loggia wing + West wing
      v.hollowBox(-bx, 0, -bz, bx, lowH, -1, "plaster", "cream");
      v.hollowBox(-bx, 0, -1, -2, lowH - 1, bz, "cream", "plaster");
      addWindowGrid(v, -bx, 1, -bz, bx, lowH, -1, 3, 0.48, "warmGlow");
      addHippedRoofSafe(v, -bx - 1, lowH, -bz - 1, bx + 1, 0, 3, "terracotta", "cream");
      addHippedRoofSafe(v, -bx - 1, lowH - 1, -1, -1, bz + 1, 3, "terracotta", "cream");
      // Arched terracotta colonnade along courtyard
      for (let x = -1; x < bx - 1; x += 3) {
        v.box(x, 0, -1, x + 1, 4, 0, "cream");
      }
      // Sunken travertine patio + turquoise swimming pool only in SE courtyard
      v.box(-1, 0, 0, bx - 1, 1, bz - 1, "limestone");
      v.box(1, 0, 2, bx - 2, 1, bz - 2, "water", 0.35);
      addCypressMini(v, bx - 1, 0, bz - 1, 7 + clampedLv);
      addCypressMini(v, -bx + 1, 0, bz - 1, 6 + clampedLv);
      if (clampedLv >= 2) {
        // Square Tuscan Mirador Campanile Tower with open arched bell loggia & hipped tile roof!
        const towH = lowH + 5 + clampedLv * 2;
        v.hollowBox(-bx + 1, lowH, -bz + 1, -bx + 7, towH, -bz + 7, "plaster", "cream");
        v.put(-bx + 4, towH - 2, -bz + 6, "warmGlow", 1.0);
        addHippedRoofSafe(v, -bx, towH, -bz, -bx + 8, -bz + 8, 4, "terracotta", "gold");
      }
      if (clampedLv >= 4) {
        // Upper pergolas & East wine-cellar portico
        v.box(2, lowH + 2, -bz + 2, bx - 2, lowH + 6, -3, "cream");
        addHippedRoofSafe(v, 1, lowH + 6, -bz + 1, bx - 1, -2, 3, "terracotta", "gold");
      }
      break;
    }

    case "apartments": {
      // Urban Walk-up -> Courtyard Brick Apartment Block with recessed balconies, fire-escape stairs & cedar rooftop water tank
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const col = clampedVar % 2 === 0 ? "brick" : "brick2";
      const westH = 8 + clampedLv * 3;
      const eastH = 6 + clampedLv * 2;
      if (bz <= 7) {
        // 2x1 Walk-up Dual-Height Brick Apartments with projecting bay windows & wrought-iron balconies
        v.hollowBox(-bx, 0, -bz, 1, westH, bz, col, "limestone");
        v.hollowBox(1, 0, -bz + 1, bx, eastH, bz, "limestone", col);
        addWindowGrid(v, -bx, 2, -bz, 1, westH, bz, 3, 0.48);
        addWindowGrid(v, 1, 2, -bz + 1, bx, eastH, bz, 3, 0.45);
        for (let y = 3; y < westH - 1; y += 3) {
          v.box(-4, y, bz, -1, y + 1, bz + 1, "iron"); // exterior balcony rails
        }
        v.box(-bx, westH, -bz, 1, westH + 1, bz, "limestone");
        v.box(2, eastH, -bz + 2, bx - 1, eastH + 1, bz - 1, "leafLight");
      } else {
        // 2x2 U-Shaped Courtyard Complex with landscaped central garden & rooftop water tank!
        v.hollowBox(-bx, 0, -bz, bx, eastH, -2, col, "limestone");
        v.hollowBox(-bx, 0, -bz, -3, westH, bz, col, "limestone");
        v.hollowBox(3, 0, -bz, bx, eastH, bz - 1, "limestone", col);
        addWindowGrid(v, -bx, 2, -bz, -3, westH, bz, 3, 0.5);
        addWindowGrid(v, 3, 2, -bz, bx, eastH, bz - 1, 3, 0.48);
        // Street arch & garden court
        v.box(-3, 4, bz - 1, 3, 6, bz, "limestone");
        addTreeMini(v, 0, 0, 2, clampedVar);
        v.box(4, eastH, -bz + 2, bx - 1, eastH + 1, bz - 2, "leafLight");
        v.cylinderY(-bx + 3.5, -bz + 3.5, westH, westH + 4, 2.0, "wood");
        v.cone(-bx + 3.5, westH + 4, westH + 7, -bz + 3.5, 2.3, 0.4, "slate");
      }
      break;
    }

    case "apartment_buildings": {
      // High-Density Terraced Residential Towers (NO sugar-cube block, NO spiral shaft!):
      // Articulated warm limestone/terracotta/charcoal pilasters, recessed glass balconies, ground retail colonnade & skybridge!
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const tallH = 14 + clampedLv * 4;
      const midH = Math.round(tallH * 0.68);
      const frameCol = clampedVar % 2 === 0 ? "limestone" : "concrete";
      const coreCol = clampedVar % 2 === 0 ? "brick2" : "slate";

      // Ground-floor retail & lobby colonnade on West & East wings
      v.hollowBox(-bx, 0, -bz, -1, tallH, bz - 1, coreCol, frameCol);
      addWindowGrid(v, -bx, 3, -bz, -1, tallH, bz - 1, 3, 0.52);
      // Projecting horizontal balcony slabs every 3 floors on West tower!
      for (let y = 4; y < tallH - 1; y += 4) {
        v.box(-bx - 1, y, -bz + 2, 0, y + 1, bz - 2, frameCol);
        v.box(-bx + 2, y + 1, bz - 1, -3, y + 2, bz, "glass", 0.55);
      }
      // Stepped architectural penthouse crown with pergola (ZERO spiral!)
      v.hollowBox(-bx + 2, tallH, -bz + 2, -3, tallH + 4, bz - 3, frameCol, "white");
      v.box(-bx + 2, tallH + 4, -bz + 2, -3, tallH + 5, bz - 3, "slate");

      // East terraced mid-rise tower + rooftop sky-garden
      v.hollowBox(2, 0, -bz + 2, bx, midH, bz, frameCol, "white");
      addWindowGrid(v, 2, 3, -bz + 2, bx, midH, bz, 3, 0.5);
      v.box(3, midH, -bz + 3, bx - 1, midH + 1, bz - 1, "leaf");
      addTreeMini(v, Math.floor((3 + bx) * 0.5), midH + 1, 0, 0);

      if (clampedLv >= 2) {
        // Glazed double-height skybridge linking West & East residential towers!
        const brY = Math.max(6, midH - 4);
        v.box(-1, brY, -2, 2, brY + 3, 2, "glass", 0.72);
        v.box(-1, brY + 3, -2, 2, brY + 4, 2, "steelLight");
      }
      if (clampedLv >= 4) {
        // Third setback North crown tower & rooftop lap pool!
        v.hollowBox(-4, midH, -bz, 5, tallH + 6, -1, "white", "steelLight");
        addWindowGrid(v, -4, midH + 1, -bz, 5, tallH + 6, -1, 3, 0.6, "screenCyan");
        v.box(4, midH + 1, 1, bx - 2, midH + 2, bz - 2, "water", 0.4);
      }
      break;
    }

    case "condos": {
      // Sculptural Marina-Style Luxury Condominiums: shifting cantilevered glass-balcony floorplates + rooftop infinity pool & angled architectural sail fin (ZERO spiral!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const tiers = 3 + clampedLv;
      const tierH = 4;
      let curY = 0;
      for (let t = 0; t < tiers; t++) {
        const shrink = Math.floor(t * 0.65);
        const shiftX = Math.round(Math.sin(t * 0.85) * Math.min(2, shrink + 1));
        const shiftZ = Math.round(Math.cos(t * 0.85) * Math.min(2, shrink + 1));
        const x0 = Math.max(-bx, -bx + shrink + shiftX);
        const x1 = Math.min(bx, bx - shrink + shiftX);
        const z0 = Math.max(-bz, -bz + shrink + shiftZ);
        const z1 = Math.min(bz, bz - shrink + shiftZ);
        v.hollowBox(x0, curY, z0, x1, curY + tierH - 1, z1, "white", "silver");
        addWindowGrid(v, x0, curY + 1, z0, x1, curY + tierH - 1, z1, 2, 0.62, "screenCyan");
        v.box(
          Math.max(-padX, x0 - 1),
          curY + tierH - 1,
          Math.max(-padZ, z0 - 1),
          Math.min(padX, x1 + 1),
          curY + tierH,
          Math.min(padZ, z1 + 1),
          t % 2 === 0 ? "cyan" : "white",
          t % 2 === 0 ? 0.35 : 0,
        );
        curY += tierH;
      }
      // Rooftop infinity sky-pool + sleek diagonal architectural crown fin
      v.box(-4, curY, -2, 3, curY + 1, 3, "water", 0.48);
      for (let s = 0; s < 4 + clampedLv; s++) {
        v.box(1 + Math.floor(s * 0.4), curY + s, -3, 4, curY + s + 1, 2 - Math.floor(s * 0.3), "white");
      }
      addPalmMini(v, -bx + 2, 0, bz - 2, 6);
      break;
    }

    case "mansions": {
      // Grand Palatial Estate: corps-de-logis + symmetrical wings + forecourt fountain & wrought-iron gates (no concrete slab!)
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const wingH = 6 + clampedLv;
      const centerH = 9 + clampedLv * 2;
      v.hollowBox(-5, 0, -bz, 5, centerH, 1, "marble", "limestone");
      addWindowGrid(v, -5, 2, -bz, 5, centerH, 1, 3, 0.5);
      // Flanking pavilion wings
      v.hollowBox(-bx, 0, -bz + 1, -5, wingH, bz - 2, "marbleShade", "marble");
      v.hollowBox(5, 0, -bz + 1, bx, wingH, bz - 2, "marbleShade", "marble");
      addWindowGrid(v, -bx, 2, -bz + 1, -5, wingH, bz - 2, 3, 0.45);
      addWindowGrid(v, 5, 2, -bz + 1, bx, wingH, bz - 2, 3, 0.45);
      addHippedRoofSafe(v, -bx, wingH, -bz + 1, -4, bz - 2, 3, "slate", "gold");
      addHippedRoofSafe(v, 4, wingH, -bz + 1, bx, bz - 2, 3, "slate", "gold");
      addHippedRoofSafe(v, -6, centerH, -bz, 6, 2, 3, "slate", "gold");
      // Grand pillared portico
      for (let x = -4; x <= 4; x += 2) {
        v.box(x, 0, 1, x + 1, wingH + 1, 2, "white");
      }
      addGableSafe(v, -5, wingH + 1, 0, 5, 3, 3, "x", "marble", "gold");
      // Circular gravel carriage loop & marble fountain in court of honor
      v.cylinderY(0, Math.min(bz - 3, 5), 0, 2, 2.5, "marble");
      v.sphere(0, 3, Math.min(bz - 3, 5), 1.3, 1.4, 1.3, "cyan", 0.65);
      addCypressMini(v, -bx + 1, 0, bz - 1, 8);
      addCypressMini(v, bx - 2, 0, bz - 1, 8);
      if (clampedLv >= 3) {
        // Baroque golden rotunda dome crowning the central corps-de-logis!
        v.cylinderY(0, -Math.floor(bz * 0.4), centerH + 1, centerH + 5, 3.6, "marble");
        v.dome(0, centerH + 5, -Math.floor(bz * 0.4), 3.8, "gold");
      }
      break;
    }

    case "skyscrapers": {
      // Substantial 2x2 Downtown Supertall Tower filling its plot cleanly with street-level glass atrium lobby,
      // setback curtain-wall massing, crisp chrome mullions, sky-gardens & spire!
      const bx = Math.max(11, padX - 1);
      const bz = Math.max(11, padZ - 1);
      const glassC = clampedVar % 2 === 0 ? "glassDark" : "blueDark";
      const mullionC = clampedVar % 2 === 0 ? "chrome" : "steelLight";
      const totalH = 22 + clampedLv * 7;

      // Full street-edge 2-story glazed podium atrium + corner plaza trees (fills the 2x2 plot naturally!)
      v.hollowBox(-bx, 0, -bz, bx, 6, bz, mullionC, "white");
      v.box(-bx + 1, 1, -bz, bx - 1, 5, bz, "glass", 0.58);
      addTreeMini(v, -bx + 2, 6, bz - 3, 0);
      addTreeMini(v, bx - 3, 6, bz - 3, 2);

      // Lower main tower tier
      const t1H = Math.floor(totalH * 0.48);
      const w1 = bx - 2;
      v.hollowBox(-w1, 6, -w1, w1, t1H, w1, glassC, mullionC);
      addWindowGrid(v, -w1, 7, -w1, w1, t1H, w1, 2, 0.58, "glass");

      // Mid setback tier + open green sky-terrace band
      const t2H = Math.floor(totalH * 0.78);
      const w2 = Math.max(5, w1 - 2);
      v.box(-w1, t1H, -w1, w1, t1H + 1, w1, "leafLight");
      v.hollowBox(-w2, t1H + 1, -w2, w2, t2H, w2, glassC, mullionC);
      addWindowGrid(v, -w2, t1H + 2, -w2, w2, t2H, w2, 2, 0.62, "screenCyan");

      // Upper tapered architectural crown + illuminated broadcast spire!
      const w3 = Math.max(3, w2 - 2);
      v.hollowBox(-w3, t2H, -w3, w3, totalH, w3, "glass", mullionC);
      addHippedRoofSafe(v, -w3, totalH, -w3, w3, w3, 4, mullionC, "screenCyan");
      v.box(-1, totalH + 3, -1, 1, totalH + 10 + clampedLv, 1, "chrome");
      v.put(0, totalH + 10 + clampedLv, 0, "red", 1.35);
      break;
    }

    // --------------------- EXPANDABLE FARMS & AGRICULTURAL PARCELS ---------------------
    case "vegetable_farm":
    case "grain_farm":
    case "dairy_farm":
    case "poultry_farm":
    case "cattle_ranch":
    case "horse_ranch":
    case "apiary":
    case "vineyard":
    case "rice_farm":
    case "greenhouse_farm":
    case "vertical_farm": {
      const bx = padX, bz = padZ;
      const id = def.id;
      const livestock = ["dairy_farm", "poultry_farm", "cattle_ranch", "horse_ranch"].includes(id);
      const glass = id === "greenhouse_farm" || id === "vertical_farm";
      const crop = id === "grain_farm" ? "gold" : id === "vineyard" ? "purple"
        : id === "rice_farm" ? "lime" : id === "apiary" ? "yellow" : "leafLight";
      if (id === "vertical_farm") {
        const towerH = 9 + clampedLv * 6;
        v.hollowBox(-bx + 2, 0, -bz + 2, bx - 2, towerH, bz - 2, "glass", "silver");
        for (let y = 3; y < towerH - 1; y += 4) {
          v.box(-bx + 3, y, -bz + 3, bx - 3, y + 1, bz - 3, "leaf");
          v.box(-bx + 2, y + 1, -bz + 2, bx - 2, y + 2, -bz + 3, "screenCyan", 0.4);
        }
        v.box(-bx + 2, towerH, -bz + 2, bx - 2, towerH + 1, bz - 2, "solarBlue");
        if (clampedLv >= 4) v.cylinderY(bx - 3, bz - 3, 0, 8, 2, "silver");
        break;
      }
      if (glass) {
        for (let i = 0; i < Math.min(4, 1 + clampedLv); i++) {
          const x = -bx + 2 + i * 5;
          if (x + 4 > bx - 1) break;
          v.box(x, 0, -bz + 2, x + 4, 4 + Math.min(3, clampedLv), bz - 2, "glass", 0.14);
          v.box(x + 1, 0, -bz + 3, x + 3, 1, bz - 3, "leaf");
          v.box(x, 4 + Math.min(3, clampedLv), -bz + 2, x + 4, 5 + Math.min(3, clampedLv), bz - 2, "silver");
        }
        if (clampedLv >= 3) v.box(bx - 5, 0, bz - 3, bx - 2, 6, bz - 1, "water");
        break;
      }
      if (id === "rice_farm") {
        for (let z = -bz + 1; z < bz - 1; z += 4) {
          v.box(-bx + 1, 0, z, bx - 1, 1, z + 3, "water", 0.22);
          for (let x = -bx + 2; x < bx - 1; x += 3) {
            v.box(x, 1, z + 1, x + 1, 3, z + 2, "lime");
          }
        }
        if (clampedLv >= 2) v.box(-1, 1, -bz + 1, 1, 2, bz - 1, "wood");
        if (clampedLv >= 4) v.box(bx - 5, 0, bz - 3, bx - 1, 3, bz - 1, "woodDark");
        break;
      }
      // Organic ground-level crop beds, trellises, apiary hives or grazing paddocks.
      const rowCount = Math.max(2, Math.min(8, 2 + clampedLv));
      for (let i = 0; i < rowCount; i++) {
        const z = -bz + 2 + i * 3;
        if (z >= bz - 1) break;
        v.box(-bx + 1, 0, z, bx - 1, 1, z + 1, livestock ? "leafLight" : "soilDark");
        if (!livestock) for (let x = -bx + 2; x < bx - 1; x += 3) {
          v.put(x, 1, z, crop);
          if (id === "vineyard") v.box(x, 1, z, x + 1, 3 + (clampedLv >= 3 ? 1 : 0), z + 1, "purple");
          if (id === "grain_farm" && clampedLv >= 2) v.put(x, 2, z, "gold");
        }
      }
      if (id === "apiary") {
        for (let i = 0; i < Math.min(8, clampedLv + 2); i++) {
          const x = -bx + 2 + (i % 4) * 4, z = -bz + 3 + Math.floor(i / 4) * 5;
          if (x < bx && z < bz) {
            v.box(x, 0, z, x + 2, 2, z + 2, "gold");
            v.put(x, 2, z, "woodDark");
            v.put(x + 1, 2, z + 1, "yellow");
          }
        }
      } else if (livestock) {
        const animalCount = Math.min(9, clampedLv + 2);
        for (let i = 0; i < animalCount; i++) {
          const x = -bx + 3 + (i % 3) * 4, z = -bz + 3 + Math.floor(i / 3) * 4;
          if (x >= bx - 2 || z >= bz - 2) continue;
          const chicken = id === "poultry_farm";
          const col = id === "horse_ranch" ? "wood" : chicken ? "white" : i % 2 === 0 ? "white" : "brown";
          v.box(x, 1, z, x + (chicken ? 1 : 3), chicken ? 3 : 4, z + (chicken ? 1 : 2), col);
          if (!chicken) v.box(x + 2, 3, z, x + 3, 5, z + 1, col);
          else v.put(x, 3, z, "red");
        }
        // Open pasture fence and a barn grow more substantial at each level.
        v.box(-bx + 1, 0, -bz + 1, -bx + 2, 3, bz - 1, "woodDark");
        v.box(bx - 2, 0, -bz + 1, bx - 1, 3, bz - 1, "woodDark");
      }
      const barnW = Math.min(8, 3 + clampedLv);
      const barnH = 3 + clampedLv;
      const barnCol = id === "vineyard" ? "limestone" : id === "apiary" ? "wood" : "crimson";
      v.hollowBox(bx - barnW - 1, 0, -bz + 1, bx - 1, barnH, -bz + 6, barnCol, "cream");
      addGableSafe(v, bx - barnW - 2, barnH, -bz, bx, -bz + 7, 3, "x", id === "vineyard" ? "terracotta" : "slate", "white");
      if (clampedLv >= 2) {
        v.cylinderY(-bx + 3, -bz + 3, 0, 5 + clampedLv, 1.5, "silver");
        v.dome(-bx + 3, 5 + clampedLv, -bz + 3, 1.7, "red");
      }
      if (clampedLv >= 3) {
        v.box(-bx + 2, 0, bz - 4, -bx + 6, 2, bz - 1, "leaf");
        v.box(-bx + 1, 0, bz - 3, -bx + 2, 2, bz - 1, "charcoal");
      }
      if (clampedLv >= 5) {
        v.hollowBox(bx - 7, 0, bz - 6, bx - 2, 6, bz - 2, barnCol, "cream");
        addGableSafe(v, bx - 8, 6, bz - 7, bx - 1, bz - 1, 2, "x", "slate");
      }
      break;
    }

    case "vegetable_fields":
    case "grain_fields":
    case "orchard_block":
    case "grazing_pasture":
    case "livestock_pen":
    case "chicken_coop":
    case "feed_silo":
    case "irrigation_pond":
    case "greenhouse_bay": {
      const bx = padX, bz = padZ, id = def.id;
      if (id === "irrigation_pond") {
        v.box(-bx + 2, 0, -bz + 2, bx - 2, 1, bz - 2, "water", 0.20);
        v.box(-2, 1, -bz + 1, 2, 2, bz - 1, "wood");
        if (clampedLv >= 3) v.box(bx - 3, 0, bz - 4, bx - 1, 5, bz - 2, "steel");
      } else if (id === "feed_silo") {
        v.cylinderY(0, 0, 0, 8 + clampedLv * 3, 2 + Math.floor(clampedLv / 2), "silver");
        v.dome(0, 8 + clampedLv * 3, 0, 3, "crimson");
        if (clampedLv >= 3) v.cylinderY(bx - 3, 0, 0, 8 + clampedLv * 2, 1.6, "cream");
        if (clampedLv >= 5) v.box(-bx + 2, 0, bz - 4, bx - 2, 4, bz - 2, "gold");
      } else if (id === "greenhouse_bay") {
        for (let x = -bx + 2; x < bx - 2; x += 5) {
          v.box(x, 0, -bz + 2, x + 4, 4 + clampedLv, bz - 2, "glass", 0.12);
          v.box(x + 1, 0, -bz + 3, x + 3, 1, bz - 3, "lime");
          v.box(x, 4 + clampedLv, -bz + 2, x + 4, 5 + clampedLv, bz - 2, "silver");
        }
      } else if (id === "orchard_block") {
        for (let x = -bx + 3; x < bx - 2; x += 5) for (let z = -bz + 3; z < bz - 2; z += 5) {
          addTreeMini(v, x, 0, z, clampedVar + clampedLv);
          v.put(x + 1, 4, z, clampedLv >= 4 ? "orange" : "red");
        }
      } else if (id === "livestock_pen" || id === "chicken_coop" || id === "grazing_pasture") {
        for (let i = 0; i < Math.min(10, clampedLv + 2); i++) {
          const x = -bx + 2 + (i % 3) * 4, z = -bz + 2 + Math.floor(i / 3) * 4;
          if (x >= bx || z >= bz) continue;
          const hen = id === "chicken_coop";
          v.box(x, 1, z, x + (hen ? 1 : 3), hen ? 3 : 4, z + (hen ? 1 : 2), hen ? "white" : i % 2 === 0 ? "white" : "brown");
          if (hen) v.put(x, 3, z, "orange");
        }
        if (id === "chicken_coop" && clampedLv >= 2) {
          v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, 3 + clampedLv, -bz + 5, "crimson", "white");
          addGableSafe(v, bx - 6, 3 + clampedLv, -bz + 1, bx - 1, -bz + 5, 2, "x", "woodDark");
        }
      } else {
        const rowCol = id === "grain_fields" ? "gold" : clampedVar % 2 === 0 ? "leaf" : "orange";
        for (let z = -bz + 2; z < bz - 1; z += 3) {
          v.box(-bx + 1, 0, z, bx - 1, 1, z + 1, "soilDark");
          for (let x = -bx + 2; x < bx - 1; x += 2) {
            v.box(x, 1, z, x + 1, clampedLv >= 3 ? 3 : 2, z + 1, rowCol);
          }
        }
        if (clampedLv >= 3) v.box(-bx + 2, 0, bz - 3, -bx + 4, 2, bz - 1, "gold");
        if (clampedLv >= 5) v.box(bx - 5, 0, -bz + 2, bx - 2, 3, -bz + 4, "leaf");
      }
      break;
    }

    // --------------------- AGRICULTURE (6) ---------------------
    case "farms": {
      // Ground-hugging irrigated furrows (NO thick raised soil slab!), red barn, silo & tractor!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Low furrowed crop ridges directly on terrain (y = 0..1) on the -X half
      for (let x = -bx; x < 0; x += 2) {
        v.box(x, 0, -bz, x + 1, 1, bz, "soilDark");
        for (let z = -bz + 1; z < bz; z += 2) {
          v.put(x, 1, z, (x + z) % 4 === 0 ? "yellow" : "lime");
        }
      }
      // Classic red timber barn + silver-domed grain silo on +X half
      const barnH = 4 + clampedLv;
      v.hollowBox(2, 0, -bz + 1, bx, barnH, bz - 1, "crimson", "white");
      addGableSafe(v, 1, barnH, -bz, bx + 1, bz, 4, "x", "woodDark", "white");
      v.box(3, 0, bz - 2, 6, 3, bz - 1, "white"); // barn cross doors
      const siloH = 7 + clampedLv * 2;
      v.cylinderY(bx - 2, -bz + 2.5, 0, siloH, 2.1, "silver");
      v.dome(bx - 2, siloH, -bz + 2.5, 2.2, "red");
      if (clampedLv >= 3) {
        // Second taller silo + green harvest tractor in yard!
        v.cylinderY(Math.max(3, bx - 7), -bz + 2.5, 0, siloH + 3, 1.9, "cream");
        v.dome(Math.max(3, bx - 7), siloH + 3, -bz + 2.5, 2.0, "silver");
        v.box(-3, 0, bz - 3, 0, 2, bz - 1, "leaf");
        v.put(-2, 2, bz - 2, "busYellow");
      }
      if (clampedLv >= 5) {
        // Glass greenhouse tunnel along back edge
        v.box(-bx, 0, -bz, -1, 4, -bz + 5, "glass", 0.5);
      }
      break;
    }

    case "farm_houses": {
      // Gambrel Red Barn + Cozy White Farmhouse with wrap-around porch + Tall Silo (ground-flush!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const barnH = 5 + clampedLv;
      v.hollowBox(-bx, 0, -bz, 0, barnH, bz - 1, "crimson", "white");
      v.box(-bx + 2, 0, bz - 2, -2, 4, bz - 1, "white");
      addGableSafe(v, -bx - 1, barnH, -bz - 1, 1, bz, 5, "x", "slate", "white");
      // Cozy white farmhouse with front porch on +X
      const fh = 4 + Math.min(4, clampedLv);
      v.hollowBox(2, 0, -bz + 2, bx, fh, bz - 1, "white", "cream");
      addWindowGrid(v, 2, 1, -bz + 2, bx, fh, bz - 1, 2, 0.5, "warmGlow");
      addGableSafe(v, 1, fh, -bz + 1, bx + 1, bz, 4, "z", "tealDark", "white");
      v.box(2, 0, bz - 1, bx, 1, bz + 1, "woodLight"); // porch
      // Tall silo behind farmhouse
      const sh = 7 + clampedLv * 2;
      v.cylinderY(1, -bz + 2, 0, sh, 1.9, "cream");
      v.dome(1, sh, -bz + 2, 2.0, "silver");
      if (clampedLv >= 3) {
        // Split-rail paddock & golden haystacks
        v.box(-3, 0, bz - 1, -1, 2, bz + 1, "gold");
      }
      break;
    }

    case "fields": {
      // Ground-level plowed crop rows (y = 0..1 ONLY, never a giant striped block!) + rustic fences, hay bales & harvest gear!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const cropPalette = ["gold", "yellow", "lime", "purple"];
      // Furrowed soil ridges with open grass/earth breathing gaps between strips
      for (let z = -bz + 1; z <= bz - 2; z += 3) {
        const cropCol = cropPalette[(Math.abs(z) + clampedVar) % cropPalette.length];
        v.box(-bx + 1, 0, z, bx - 1, 1, z + 2, "soilDark");
        for (let x = -bx + 2; x < bx - 1; x += 2) {
          v.put(x, 1, z, cropCol);
          v.put(x + 1, 1, z + 1, cropCol);
        }
      }
      // Rustic split-rail corner fence posts
      for (const [fx, fz] of [
        [-bx, -bz],
        [bx - 1, -bz],
        [-bx, bz - 1],
        [bx - 1, bz - 1],
      ]) {
        v.box(fx, 0, fz, fx + 1, 2, fz + 1, "woodDark");
      }
      // Golden round hay bales
      v.box(-bx + 2, 0, bz - 2, -bx + 4, 2, bz, "gold");
      if (clampedLv === 1) {
        // Classic straw-hat scarecrow
        v.box(0, 0, 0, 1, 4, 1, "woodDark");
        v.box(-1, 2, 0, 2, 3, 1, "oak");
        v.put(0, 4, 0, "orange");
      } else if (clampedLv === 2) {
        // Irrigation channel + timber footbridge + scarecrow
        v.box(-1, 0, -bz + 1, 1, 1, bz - 1, "water", 0.25);
        v.box(-2, 1, -1, 2, 2, 1, "wood");
      } else if (clampedLv === 3) {
        // Red harvest tractor & loaded wooden hay wagon
        v.box(-2, 0, -1, 2, 3, 2, "red");
        v.box(-1, 3, -1, 1, 4, 1, "glass", 0.5);
        v.box(3, 0, -1, 7, 2, 2, "wood");
        v.box(3, 2, -1, 7, 3, 2, "gold");
      } else if (clampedLv === 4) {
        // Open-lattice rural windpump + timber grain crib!
        addLatticeMast(v, -bx + 3, -bz + 3, 0, 9, "woodDark", "silver");
        v.ringZ(-bx + 3, 9, -bz + 4, -bz + 5, 2.2, 0.6, "silver");
        v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, 4, -bz + 5, "wood", "woodDark");
        addGableSafe(v, bx - 6, 4, -bz + 1, bx - 1, -bz + 5, 2, "x", "crimson");
      } else {
        // Lv.5 Heritage Farmstead Fields: Dutch timber barn, grain silo & harvester tractor!
        v.hollowBox(bx - 8, 0, -bz + 1, bx - 1, 6, 1, "crimson", "white");
        addGableSafe(v, bx - 9, 6, -bz, bx, 2, 4, "x", "slate", "white");
        v.cylinderY(bx - 10, -bz + 2.5, 0, 10, 1.8, "silver");
        v.dome(bx - 10, 10, -bz + 2.5, 1.9, "red");
        v.box(-5, 0, 1, -1, 3, 4, "leaf");
      }
      break;
    }

    case "orchards": {
      // Organic spaced fruit trees directly on natural grass (NO dense stick-grid, NO green pedestal slab!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const fruitCol = clampedVar === 0 ? "red" : clampedVar === 1 ? "orange" : clampedVar === 2 ? "yellow" : "pink";
      const treeCoords: [number, number][] =
        bz <= 7
          ? [
              [-bx + 3, -2],
              [0, 2],
              [bx - 4, -2],
            ]
          : [
              [-bx + 3, -bz + 3],
              [bx - 4, -bz + 3],
              [-bx + 4, bz - 4],
              [1, 0],
            ];
      if (clampedLv >= 3 && bz > 7) {
        treeCoords.push([-2, -bz + 4]);
      }
      for (let i = 0; i < treeCoords.length; i++) {
        const [tx, tz] = treeCoords[i];
        const th = 3 + (i % 2) + Math.min(2, Math.floor(clampedLv * 0.5));
        // Crooked organic trunk
        v.box(tx, 0, tz, tx + 1, th, tz + 1, "woodDark");
        // Multi-lobed rounded fruit canopy
        const cr = 2.4 + Math.min(1.0, clampedLv * 0.2);
        v.sphere(tx + 0.5, th + 1.6, tz + 0.5, cr, 2.0, cr, i % 2 === 0 ? "leaf" : "leafLight");
        // Visible ripe fruit clusters!
        v.put(tx - 1, th + 1, tz + 2, fruitCol);
        v.put(tx + 2, th + 2, tz, fruitCol);
        v.put(tx, th + 3, tz - 1, fruitCol);
      }
      // Woven harvest baskets & crates on grass
      v.box(-1, 0, bz - 2, 1, 2, bz, "crate");
      v.put(0, 2, bz - 1, fruitCol);
      if (clampedLv >= 3) {
        // White painted apiary beehives
        v.box(-bx + 2, 0, 1, -bx + 4, 2, 3, "white");
      }
      if (clampedLv >= 4) {
        // Charming stone-and-timber Cider Press Pavilion in SE corner!
        v.hollowBox(bx - 6, 0, bz - 6, bx - 1, 5, bz - 1, "wood", "stone");
        addGableSafe(v, bx - 7, 5, bz - 6, bx, bz - 1, 3, "x", "crimson", "cream");
      }
      break;
    }

    case "groves_of_olives": {
      // Mediterranean Dry-Stone Terraces & Gnarled Silver-Green Olive Trees (no full-tile slab!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Low dry-stone retaining terrace on rear half
      v.box(-bx + 1, 0, -bz + 1, bx - 1, 2, -1, "limestone");
      v.box(-bx + 2, 2, -bz + 2, bx - 2, 3, -2, "path2");
      const spots: [number, number, number][] = [
        [-bx + 3, -bz + 3, 3],
        [0, -bz + 3, 3],
        [-bx + 4, 2, 0],
        [3, 2, 0],
      ];
      for (const [ox, oz, baseY] of spots) {
        v.box(ox, baseY, oz, ox + 1, baseY + 3, oz + 1, "oak");
        v.put(ox + 1, baseY + 2, oz, "oak"); // gnarled branch
        v.sphere(ox + 0.8, baseY + 4.2, oz + 0.5, 2.5, 1.7, 2.4, "olive");
        v.put(ox - 1, baseY + 4, oz + 1, "purpleDark");
      }
      if (clampedLv >= 3) {
        // Terracotta olive-oil stone mill press house on +X
        v.cylinderY(bx - 3.5, -bz + 3.5, 2, 7 + clampedLv, 2.3, "plaster");
        v.cone(bx - 3.5, 7 + clampedLv, 10 + clampedLv, -bz + 3.5, 2.7, 0.4, "terracotta");
      }
      break;
    }

    case "plantations": {
      // Stage 7 Grand Colonnaded Plantation Manor + Curing Storehouse + Neat Crop Rows (ground-flush!)
      const bx = Math.max(13, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const h = 6 + clampedLv * 2;
      // Grand white colonnaded manor house on North side
      v.hollowBox(-8, 0, -bz + 1, 4, h, -1, "white", "cream");
      addWindowGrid(v, -8, 2, -bz + 1, 4, h, -1, 3, 0.48);
      for (let x = -7; x <= 3; x += 2) {
        v.box(x, 0, -1, x + 1, h, 0, "cream");
      }
      addHippedRoofSafe(v, -9, h, -bz, 5, 1, 4, "slate", "white");
      // Timber curing barn on +X
      v.hollowBox(6, 0, -bz + 2, bx - 1, 5 + clampedLv, 0, "oak", "woodDark");
      addGableSafe(v, 6, 5 + clampedLv, -bz + 2, bx, 0, 3, "x", "terracotta");
      // Ground-flush lush crop rows across South forecourt with central carriage lane
      for (let x = -bx + 1; x < bx - 1; x += 2) {
        if (Math.abs(x + 2) <= 2) continue; // open avenue to manor portico!
        v.box(x, 0, 2, x + 1, 1, bz - 1, "soilDark");
        v.box(x, 1, 2, x + 1, 2, bz - 1, "lime");
      }
      if (clampedLv >= 3) {
        // Rooftop belvedere cupola & avenue trees
        v.hollowBox(-4, h + 3, -bz + 3, 0, h + 6, -3, "white");
        v.dome(-2, h + 6, -Math.floor(bz * 0.5), 2.2, "copper");
        addTreeMini(v, -5, 0, bz - 2, 0);
        addTreeMini(v, 1, 0, bz - 2, 0);
      }
      break;
    }

    // --------------------- COMMERCE & DINING (16 — 100% VISUALLY DISTINCT!) ---------------------
    case "businesses": {
      // STARTER #2: Sleek Modern Blue-Glass & Chrome Office Building (ZERO spiral tower, ZERO grocery resemblance!)
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const tallH = 7 + clampedLv * 3;
      const lowH = 4 + clampedLv;
      const splitX = bx >= 9 ? 2 : bx;
      // Sleek dark-blue curtain-wall office tower with vertical chrome mullions
      v.hollowBox(-bx, 0, -bz, splitX, tallH, bz - 1, "blueDark", "chrome");
      addWindowGrid(v, -bx, 2, -bz, splitX, tallH, bz - 1, 2, 0.62, "glass");
      v.box(-bx, tallH, -bz, splitX, tallH + 1, bz - 1, "steelLight");
      // Diagonal architectural glass wedge crown!
      for (let s = 0; s < Math.min(4, clampedLv + 1); s++) {
        v.box(-bx + s, tallH + 1 + s, -bz + 1, splitX - 1, tallH + 2 + s, bz - 2, "glass", 0.68);
      }
      // Illuminated street lobby portal
      v.box(-2, 0, bz - 2, 1, 3, bz - 1, "screenCyan", 0.85);
      if (bx >= 9) {
        // Executive conference wing + corporate plaza fountain on +X (Lv.3-5)
        v.hollowBox(splitX, 0, -bz + 1, bx, lowH, 1, "white", "steelLight");
        addWindowGrid(v, splitX, 1, -bz + 1, bx, lowH, 1, 2, 0.5);
        v.box(splitX, lowH, -bz + 1, bx, lowH + 1, 1, "blue");
        v.box(splitX + 2, 0, 2, bx - 1, 1, bz - 1, "water", 0.35);
      }
      if (clampedLv >= 4) {
        addLatticeMast(v, -bx + 2, -bz + 2, tallH + 2, 6, "chrome", "screenCyan");
      }
      break;
    }

    case "grocery_store": {
      // STARTER #5: Curved Green Barrel-Vaulted Farmers Market Hall + Colorful Produce Stalls + Giant 3D Red Apple Sign!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const wallH = 4 + Math.min(4, clampedLv);
      const hallZ1 = bz - 2;
      v.hollowBox(-bx, 0, -bz, bx, wallH, hallZ1, "cream", "wood");
      addWindowGrid(v, -bx, 1, -bz, bx, wallH, hallZ1, 2, 0.5);
      // Curved green-ribbed barrel-vault roof!
      const archRise = Math.max(3, Math.min(5, Math.floor(bx * 0.45)));
      for (let x = -bx; x < bx; x++) {
        const norm = (x + 0.5) / bx;
        const ay = Math.max(1, Math.round((1 - norm * norm) * archRise));
        v.box(x, wallH, -bz, x + 1, wallH + ay, hallZ1, x % 3 === 0 ? "leafDark" : "leaf");
      }
      // Green-and-white striped market awning + colorful fruit & veggie crates out front
      for (let x = -bx; x < bx; x++) {
        v.put(x, 3, hallZ1, x % 2 === 0 ? "leaf" : "white");
        v.put(x, 3, hallZ1 + 1, x % 2 === 0 ? "leaf" : "white");
      }
      v.box(-bx + 1, 0, hallZ1, -1, 1, bz, "crate");
      v.put(-bx + 1, 1, hallZ1, "red");
      v.put(-bx + 2, 1, hallZ1, "orange");
      v.put(-2, 1, hallZ1, "yellow");
      v.box(1, 0, hallZ1, bx - 1, 1, bz, "crate");
      v.put(1, 1, hallZ1, "lime");
      v.put(2, 1, hallZ1, "red");
      // Iconic 3D Red Apple & Leaf rooftop emblem!
      const topArchY = wallH + archRise;
      v.sphere(0, topArchY + 1.4, -1, 1.8, 1.7, 1.8, "red");
      v.put(0, topArchY + 3, -1, "woodDark");
      v.box(1, topArchY + 3, -1, 3, topArchY + 4, 0, "lime");
      if (clampedLv >= 4 && bz >= 9) {
        // Rooftop glass organic greenhouse pavilion!
        v.dome(-Math.floor(bx * 0.45), topArchY - 1, -Math.floor(bz * 0.35), 3.0, "glass", 0.62);
      }
      break;
    }

    case "shops": {
      // STARTER #10: Cozy Corner Boutique with Coral/White Striped Canopy, Display Vitrine, Pitched Gable & Corner Bay Turret!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const tallH = 5 + clampedLv * 2;
      if (bx <= 7) {
        // 1x1 Corner Boutique (Lv.1-3)
        v.hollowBox(-bx, 0, -bz, bx, tallH, bz - 1, "terracotta", "cream");
        v.box(-bx + 1, 1, bz - 2, bx - 1, 3, bz - 1, "glass", 0.65); // big shopfront vitrine
        for (let x = -bx; x < bx; x++) {
          v.put(x, 3, bz - 1, x % 2 === 0 ? "orange" : "white");
        }
        addWindowGrid(v, -bx, 4, -bz, bx, tallH, bz - 1, 3, 0.5, "warmGlow");
        addGableSafe(v, -bx - 1, tallH, -bz, bx + 1, bz - 1, 4, "z", "goldDark", "cream");
        if (clampedLv >= 2) {
          // Corner round bay-window turret with teal witch-cap spire!
          v.cylinderY(bx - 1.8, bz - 2, 0, tallH + 2, 2.0, "cream");
          v.cone(bx - 1.8, tallH + 2, tallH + 6, bz - 2, 2.4, 0.35, "tealDark");
        }
      } else {
        // 2x1 Twin-Gable Shopping Arcade + Corner Turret (Lv.4-5)
        v.hollowBox(-bx, 0, -bz, 0, tallH, bz - 1, "terracotta", "cream");
        addGableSafe(v, -bx - 1, tallH, -bz, 1, bz - 1, 4, "z", "goldDark", "cream");
        v.hollowBox(0, 0, -bz + 1, bx - 2, tallH - 2, bz - 1, "yellow", "white");
        addGableSafe(v, 0, tallH - 2, -bz + 1, bx - 1, bz - 1, 3, "x", "crimson", "white");
        v.cylinderY(bx - 2, bz - 2, 0, tallH + 3, 2.3, "cream");
        v.cone(bx - 2, tallH + 3, tallH + 8, bz - 2, 2.7, 0.35, "tealDark");
        for (let x = -bx; x < bx - 2; x++) {
          v.put(x, 3, bz - 1, x % 2 === 0 ? "orange" : "white");
        }
      }
      break;
    }

    case "blacksmiths": {
      // Compact 1x1 Stone & Timber Forge Workshop + Roaring Hearth + Anvil + Tapered Basalt Blast Chimney!
      const h = 4 + clampedLv;
      v.hollowBox(-6, 0, -5, 2, h, 4, "stone", "woodDark");
      addGableSafe(v, -7, h, -6, 3, 5, 4, "x", "charcoal", "woodDark");
      // Tapered basalt blast-furnace chimney on +X
      const fh = 7 + h + clampedLv * 2;
      v.cone(4, 0, fh, -2.5, 2.6, 1.2, "basalt");
      v.put(4, fh, -2, "fire", 1.35);
      v.box(2, 1, -1, 5, 3, 2, "fire", 1.35); // open glowing forge hearth
      v.box(-2, 0, 4, 0, 2, 6, "iron"); // anvil out front
      v.cylinderY(3, 4.5, 0, 2, 1.3, "water", 0.3); // quench barrel
      if (clampedLv >= 3) {
        // Waterwheel on the left side driving mechanical trip-hammers!
        v.ringZ(-6, 3, -2, -1, 2.5, 1.2, "wood");
      }
      break;
    }

    case "restaurants": {
      // Warm Brick Bistro with Red-and-White Striped Canopy, Al-Fresco Umbrella Tables & Rooftop Terrace!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const h = 5 + clampedLv;
      const bldgX1 = bx >= 9 ? 2 : bx;
      v.hollowBox(-bx, 0, -bz, bldgX1, h, 1, "brick", "cream");
      addWindowGrid(v, -bx, 1, -bz, bldgX1, h, 1, 2, 0.58, "warmGlow");
      addHippedRoofSafe(v, -bx - 1, h, -bz - 1, bldgX1 + 1, 2, 3, "crimson", "cream");
      for (let x = -bx; x < bldgX1; x++) {
        v.put(x, 3, 1, x % 2 === 0 ? "red" : "white");
      }
      // Brick wood-fired oven chimney
      v.box(-bx + 1, h, -bz + 1, -bx + 3, h + 5, -bz + 3, "brickDark");
      // Al-fresco patio umbrellas on natural stone pavers
      const uSpots = bx >= 9 ? [-4, 1, 6] : [-2, 3];
      for (const ux of uSpots) {
        if (ux + 2 > bx) continue;
        v.box(ux, 0, 3, ux + 1, 3, 4, "white");
        v.cone(ux + 0.5, 3, 5, 3.5, 2.0, 0.4, ux < 0 ? "red" : "gold");
      }
      if (clampedLv >= 4 && bx >= 9) {
        // String-lit rooftop pergola dining deck on +X wing!
        v.hollowBox(bldgX1, 0, -bz + 1, bx, h - 1, 1, "cream", "wood");
        v.box(bldgX1, h - 1, -bz + 1, bx, h, 1, "woodLight");
        v.put(bldgX1 + 2, h, -1, "warmGlow", 1.1);
      }
      break;
    }

    case "clothing_stores": {
      // Chic Parisian/SoHo Haute-Couture Boutique -> Multi-Story Flagship Fashion Atelier (ZERO spiral tower!)
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const h = 5 + clampedLv * 2;
      if (bx <= 7) {
        // 1x1 Boutique (Lv.1-2): Cream limestone facade, big lit vitrine with mannequins, striped awning & slate mansard!
        v.hollowBox(-bx, 0, -bz, bx, h, bz - 1, "cream", "white");
        v.box(-bx + 1, 1, bz - 2, bx - 1, 4, bz - 1, "glass", 0.72);
        v.box(-2, 1, bz - 2, -1, 3, bz - 1, "magenta", 0.9); // dressed mannequin 1
        v.box(1, 1, bz - 2, 2, 3, bz - 1, "pink", 0.9); // dressed mannequin 2
        for (let x = -bx; x < bx; x++) {
          v.put(x, 4, bz - 1, x % 2 === 0 ? "charcoal" : "pink");
        }
        addWindowGrid(v, -bx, 4, -bz, bx, h, bz - 1, 3, 0.55, "warmGlow");
        addHippedRoofSafe(v, -bx, h, -bz, bx, bz - 1, 3, "slate", "gold");
        if (clampedLv >= 2) {
          // Parisian dormer window & rooftop gold couturier sign
          v.box(-2, h, bz - 2, 2, h + 2, bz - 1, "white");
          v.put(0, h + 1, bz - 1, "warmGlow", 1.0);
        }
      } else {
        // 2x1 Flagship Fashion House (Lv.3-5): Glazed showroom wing + stepped corner glass lookbook tower + rooftop terrace!
        v.hollowBox(-bx, 0, -bz, 2, h - 1, bz - 1, "white", "cream");
        v.box(-bx + 1, 1, bz - 2, 1, 4, bz - 1, "glass", 0.75);
        for (let x = -bx + 2; x <= 0; x += 3) {
          v.box(x, 1, bz - 2, x + 1, 3, bz - 1, x % 2 === 0 ? "magenta" : "gold", 0.95);
        }
        for (let x = -bx; x < 2; x++) {
          v.put(x, 4, bz - 1, x % 2 === 0 ? "charcoal" : "pink");
        }
        addHippedRoofSafe(v, -bx, h - 1, -bz, 2, bz - 1, 2, "slate", "gold");
        // Tall corner glass atelier showcase tower on +X
        const towH = h + 3 + clampedLv;
        v.hollowBox(2, 0, -bz, bx, towH, bz - 1, "charcoal", "gold");
        v.box(3, 1, -bz + 1, bx - 1, towH - 1, bz - 1, "glass", 0.7);
        v.box(3, towH - 4, bz - 2, bx - 1, towH - 1, bz - 1, "magenta", 1.1); // illuminated fashion billboard
        addHippedRoofSafe(v, 2, towH, -bz, bx, bz - 1, 2, "gold", "white");
      }
      break;
    }

    case "thrift_stores": {
      // Eclectic Vintage Brick & Timber Curiosity Shop + Patchwork Awning + Outdoor Garment Racks & Attic Gable!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const h = 5 + clampedLv;
      const mainX1 = bx >= 9 ? 1 : bx;
      v.hollowBox(-bx, 0, -bz, mainX1, h, bz - 2, "brick2", "woodDark");
      v.box(-bx + 1, 1, bz - 3, mainX1 - 1, 3, bz - 2, "warmGlow", 0.75);
      addWindowGrid(v, -bx, 3, -bz, mainX1, h, bz - 2, 2, 0.5, "warmGlow");
      for (let x = -bx; x < mainX1; x++) {
        v.put(x, 3, bz - 2, x % 2 === 0 ? "teal" : "amber");
        v.put(x, 3, bz - 1, x % 2 === 0 ? "teal" : "amber");
      }
      addGableSafe(v, -bx - 1, h, -bz, mainX1 + 1, bz - 2, 4, "z", "tealDark", "amber");
      // Outdoor vintage clothes rack & vinyl record crates
      v.box(-bx + 1, 0, bz - 1, -1, 2, bz, "pink");
      v.box(1, 0, bz - 1, Math.min(mainX1, 3), 1, bz, "crate");
      if (bx >= 9) {
        // Lv.3-5: Half-timbered barn-attic curiosity wing + outdoor rummage pergola on +X!
        const attH = h + 2 + clampedLv;
        v.hollowBox(1, 0, -bz, bx, attH, 0, "woodLight", "oak");
        addGableSafe(v, 0, attH, -bz - 1, bx + 1, 1, 4, "x", "purple", "gold");
        v.put(Math.floor((1 + bx) * 0.5), attH - 2, -1, "warmGlow", 1.0);
        // Covered vintage bazaar pergola on (+X, +Z)
        for (const [px, pz] of [[2, 1], [bx - 1, 1], [2, bz - 1], [bx - 1, bz - 1]]) {
          v.box(px, 0, pz, px + 1, 4, pz + 1, "woodDark");
        }
        v.box(1, 4, 1, bx, 5, bz, "amber");
        v.box(3, 0, 2, bx - 2, 2, bz - 1, "teal");
      }
      break;
    }

    case "shoe_stores": {
      // Streetwear Sneaker Gallery + Glowing Display Wall + Sculpted 3D High-Top Red/White Sneaker Rooftop Icon!
      const lowH = 4 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx, lowH, bz - 1, "charcoal", "woodLight");
      v.box(-bx + 1, 1, bz - 2, bx - 1, 4, bz - 1, "glass", 0.72);
      v.box(-bx, lowH, -bz + 1, bx, lowH + 1, bz - 1, "red");
      // Sculpted 3D High-Top Voxel Sneaker sitting proudly on the roof!
      const sy = lowH + 1;
      const shoeLen = Math.min(bx - 1, 4 + clampedLv);
      v.box(-shoeLen, sy, -2, shoeLen, sy + 1, 2, clampedLv >= 3 ? "screenCyan" : "white", clampedLv >= 3 ? 0.9 : 0); // rubber/glow outsole
      v.box(-shoeLen, sy + 1, -2, shoeLen, sy + 2, 2, "white"); // crisp white midsole
      v.box(-shoeLen, sy + 2, -2, Math.max(-1, shoeLen - 3), sy + 5 + Math.min(2, clampedLv - 1), 2, "red"); // high-top ankle collar
      v.box(-1, sy + 2, -2, shoeLen - 1, sy + 4, 2, "crimson"); // vamp
      v.box(shoeLen - 2, sy + 2, -2, shoeLen, sy + 3, 2, "white"); // classic white shell-toe cap!
      v.box(-shoeLen + 2, sy + 3, 2, 1, sy + 5, 3, "white"); // side swoosh & laces
      break;
    }

    case "cheesesteak_restaurants": {
      // Authentic Retro Stainless-Steel Streamliner Diner + Neon Fascia + Tall Googie Cheesesteak Pylon Sign!
      const h = 4 + Math.min(3, clampedLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Rounded stainless-steel diner car body sitting at y = 0
      v.hollowBox(-bx, 0, -bz + 1, bx - 3, h, 2, "silver", "chrome");
      v.box(-bx + 1, h, -bz + 2, bx - 4, h + 1, 1, "chrome"); // curved streamliner barrel roof
      v.box(-bx, 2, -bz + 1, bx - 3, 3, 2, "crimson"); // classic red porcelain stripe
      v.box(-bx + 1, 1, 1, bx - 4, 2, 2, "warmGlow", 0.85); // glowing diner booth windows
      // Checkered black-and-white entry vestibule + outdoor picnic umbrella
      v.box(-3, 0, 2, 0, 3, 3, "chrome");
      v.box(-bx + 2, 0, 3, -bx + 4, 1, 5, "red");
      if (clampedLv >= 3) {
        // Upper neon roof sign & rooftop chrome exhaust hood
        v.box(-bx + 3, h + 1, -1, 1, h + 3, 0, "amber", 1.15);
      }
      // Tall retro Googie neon pylon sign on +X/+Z!
      const signH = 8 + clampedLv * 2;
      v.box(bx - 2, 0, 0, bx - 1, signH, 1, "steel");
      v.box(bx - 4, signH - 3, -1, bx, signH, 2, "amber", 1.25);
      v.put(bx - 2, signH, 0, "red", 1.3);
      break;
    }

    case "bars": {
      // Dark-Brick Craft Tavern & Neon Cocktail Lounge + String-Lit Rooftop Beer Garden!
      const lowH = 5 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const pubX1 = bx >= 9 ? 2 : bx;
      v.hollowBox(-bx, 0, -bz + 1, pubX1, lowH, bz - 1, "brickDark", "woodDark");
      addWindowGrid(v, -bx, 1, -bz + 1, pubX1, lowH, bz - 1, 2, 0.72, "warmGlow");
      // Timber rooftop beer-garden deck with parapet & glowing string lights
      v.box(-bx, lowH, -bz + 1, pubX1, lowH + 1, bz - 1, "wood");
      v.put(-bx + 2, lowH + 1, bz - 2, "warmGlow", 1.1);
      v.put(pubX1 - 2, lowH + 1, bz - 2, "warmGlow", 1.1);
      // Glowing neon magenta/cyan cocktail sign on facade
      v.box(-2, 2, bz - 2, 1, 4, bz - 1, "magenta", 1.25);
      v.put(-1, 4, bz - 1, "screenCyan", 1.2);
      if (bx >= 9) {
        // Lv.3-5: Art-Deco curved neon jazz lounge tower on +X!
        const towH = lowH + 4 + clampedLv;
        v.cylinderY(bx - 2.5, 0, 0, towH, 2.6, "charcoal");
        for (let y = 2; y < towH; y += 3) {
          v.cylinderY(bx - 2.5, 0, y, y + 1, 2.8, y % 2 === 0 ? "magenta" : "purple", 1.15);
        }
        v.dome(bx - 2.5, towH, 0, 2.6, "purple", 0.9);
      }
      break;
    }

    case "gas_stations": {
      // Googie Winged Service Canopy + Glazed Convenience Mart + Price Totem + Car Wash Bay at Lv.4-5!
      const ch = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Compact asphalt forecourt apron under pumps only (not full plot)
      v.box(-bx + 2, 0, 0, bx - 2, 1, bz - 1, "asphalt");
      // Glazed convenience mart in rear (-Z)
      const martX1 = bz >= 9 ? 2 : bx - 2;
      v.hollowBox(-bx + 2, 0, -bz + 1, martX1, 4 + Math.min(2, clampedLv), -1, "white", "crimson");
      v.box(-bx + 3, 1, -2, martX1 - 1, 3, -1, "glass", 0.7);
      // Fuel pump islands + twin chrome columns + upswept crimson/amber Googie V-canopy!
      v.box(-4, 1, 2, -2, 3, 3, "crimson");
      v.box(2, 1, 2, 4, 3, 3, "crimson");
      v.box(-5, 1, 2, -4, ch, 3, "chrome");
      v.box(4, 1, 2, 5, ch, 3, "chrome");
      v.box(-bx + 1, ch, 0, bx - 1, ch + 1, bz - 1, "crimson");
      v.box(-bx, ch + 1, 0, -bx + 3, ch + 2, bz - 1, "amber", 1.1);
      v.box(bx - 3, ch + 1, 0, bx, ch + 2, bz - 1, "amber", 1.1);
      // Tall green LED fuel price totem at roadside corner
      v.box(-bx + 1, 0, bz - 2, -bx + 2, ch + 4 + clampedLv, bz - 1, "steel");
      v.box(-bx + 1, ch + 2 + clampedLv, bz - 2, -bx + 3, ch + 4 + clampedLv, bz - 1, "screenGreen", 1.25);
      if (bz >= 9) {
        // Lv.4-5: Drive-through blue Car Wash tunnel on (+X, -Z)!
        v.hollowBox(3, 0, -bz + 1, bx - 1, 5, -1, "sky", "white");
        v.box(4, 1, -2, bx - 2, 4, -1, "cyan", 0.6);
      }
      break;
    }

    case "atms": {
      // Sleek Architectural Smart-Banking Kiosk with Glowing Emerald Clerestory Halo (ZERO spiral tower!)
      const kh = 4 + clampedLv;
      if (clampedLv <= 2) {
        v.hollowBox(-3, 0, -3, 3, kh, 3, "blueDark", "steelLight");
        v.box(-2, 1, 2, 2, 4, 3, "screenGreen", 1.25);
        v.box(-4, kh, -3, 4, kh + 1, 4, "screenGreen", 0.9);
      } else {
        v.cylinderY(0, 0, 0, kh + 1, 3.4, "blueDark");
        v.cylinderY(0, 0, 1, 4, 3.6, "glass", 0.65);
        v.box(-2, 1, 3, 2, 4, 4, "screenGreen", 1.3);
        v.cylinderY(0, 0, kh + 1, kh + 2, 3.9, "screenGreen", 1.0);
        v.dome(0, kh + 2, 0, 2.8, "gold");
      }
      break;
    }

    case "buildings": {
      // Stage 8 Stepped Art-Deco Commercial Ziggurat (Empire/Chrysler inspired, ground-flush!)
      const baseH = 6 + clampedLv * 2;
      const towerH = 11 + clampedLv * 4;
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Rusticated limestone podium with brass street portal
      v.hollowBox(-bx, 0, -bz + 1, bx, baseH, bz - 1, st.wall, "brass");
      addWindowGrid(v, -bx, 2, -bz + 1, bx, baseH, bz - 1, 2, 0.48);
      v.box(-2, 0, bz - 2, 2, 3, bz - 1, "warmGlow", 0.9);
      v.box(-bx, baseH, -bz + 1, bx, baseH + 1, bz - 1, "brass");
      // Setback Art-Deco tower shaft
      const tw = Math.max(4, Math.floor(bx * 0.62));
      const td = Math.max(3, Math.floor(bz * 0.66));
      v.hollowBox(-tw, 0, -td, tw, towerH, td, "limestone", "white");
      addWindowGrid(v, -tw, 2, -td, tw, towerH, td, 2, 0.58);
      // Tiered silver/gold Art-Deco crown + needle spire
      addHippedRoofSafe(v, -tw, towerH, -td, tw, td, 4, "slate", "gold");
      v.box(-1, towerH + 3, -1, 1, towerH + 7 + clampedLv, 1, "gold", 0.95);
      break;
    }

    case "banks": {
      // Classical Pantheon Marble Temple Bank + Fluted Corinthian Portico + Gleaming Gold Treasury Dome!
      const portH = 6 + clampedLv;
      const rotH = 8 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Marble steps & flanking treasury wings
      v.box(-5, 0, bz - 3, 5, 1, bz, "marble");
      v.hollowBox(-bx + 1, 0, -bz + 2, bx - 1, portH, 2, "marble", "marbleShade");
      addWindowGrid(v, -bx + 1, 2, -bz + 2, bx - 1, portH, 2, 3, 0.45);
      // Grand columned front portico
      v.box(-7, 0, 2, 7, 1, bz - 1, "marble");
      for (let x = -6; x <= 5; x += 2) {
        v.box(x, 1, bz - 2, x + 1, portH, bz - 1, "white");
      }
      addGableSafe(v, -7, portH, 1, 7, bz, 4, "x", "marbleShade", "gold");
      // Central bronze vault portal
      v.box(-2, 1, 1, 2, 4, 2, "brass");
      // Cylindrical marble treasury drum + coffered gold vault dome!
      const rRad = Math.min(6.2, bx - 3);
      v.cylinderY(0, -2, portH, rotH + 2, rRad, "white");
      v.dome(0, rotH + 2, -2, rRad + 0.3, "gold");
      v.put(0, Math.round(rotH + 2 + rRad), -2, "warmGlow", 1.2);
      break;
    }

    case "malls": {
      // Cruciform Luxury Crystal Galleria + Barrel-Vault Glass Skylights + Open Corner Fountain Plazas (ZERO spiral!)
      const wingH = 6 + clampedLv * 2;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Cruciform retail wings at y = 0 leaving corner outdoor courtyard plazas!
      v.hollowBox(-bx, 0, -5, bx, wingH, 5, "cream", "white");
      v.hollowBox(-5, 0, -bz, 5, wingH, bz, "white", "gold");
      addWindowGrid(v, -bx, 2, -5, bx, wingH, 5, 3, 0.58);
      addWindowGrid(v, -5, 2, -bz, 5, wingH, bz, 3, 0.58);
      // Glazed barrel skylight spines along both axes
      v.box(-bx + 2, wingH, -2, bx - 2, wingH + 2, 2, "glass", 0.7);
      v.box(-2, wingH, -bz + 2, 2, wingH + 2, bz - 2, "glass", 0.7);
      // Soaring central faceted crystal atrium dome!
      const domeR = Math.min(6.5, Math.min(bx, bz) * 0.56);
      v.dome(0, wingH, 0, domeR, "glass", 0.78);
      v.put(0, Math.round(wingH + domeR), 0, "gold", 1.1);
      // Grand magenta/cyan illuminated entrance arch & corner fountains + palms
      v.box(-3, 0, bz - 1, 3, 4, bz, "magenta", 0.95);
      v.cylinderY(-bx + 4, bz - 4, 0, 2, 2.2, "marble");
      v.cylinderY(-bx + 4, bz - 4, 1, 2, 1.5, "cyan", 0.55);
      addPalmMini(v, bx - 4, 0, bz - 4, 5 + Math.min(3, clampedLv));
      if (clampedLv >= 4) {
        // Upper terrace department-store anchor rotunda on NE corner
        v.cylinderY(bx - 4, -bz + 4, 0, wingH + 4, 3.4, "limestone");
        v.dome(bx - 4, wingH + 4, -bz + 4, 3.4, "gold");
      }
      break;
    }

    case "data_centers": {
      // High-Tech Cloud Server Campus: Twin Dark Anodized Blade Halls + Rooftop Chiller Banks + Glass NOC Skybridge + Lattice Mast!
      const podH = 6 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Twin dark-charcoal server blade halls at y = 0
      v.hollowBox(-bx, 0, -bz + 1, -2, podH, bz - 1, "charcoal", "steel");
      v.hollowBox(2, 0, -bz + 1, bx, podH, bz - 1, "charcoal", "steel");
      // Glowing vertical cyan server-rack telemetry louvers
      for (let z = -bz + 3; z < bz - 2; z += 4) {
        v.box(-bx, 2, z, -bx + 1, podH - 1, z + 1, "screenCyan", 1.2);
        v.box(bx - 1, 2, z, bx, podH - 1, z + 1, "screenCyan", 1.2);
      }
      v.box(-bx + 2, 2, bz - 2, -4, podH - 1, bz - 1, "screenCyan", 1.15);
      v.box(4, 2, bz - 2, bx - 2, podH - 1, bz - 1, "screenCyan", 1.15);
      // Rooftop white adiabatic HVAC chiller arrays
      for (let z = -bz + 3; z < bz - 3; z += 4) {
        v.box(-bx + 2, podH, z, -4, podH + 2, z + 2, "white");
        v.box(4, podH, z, bx - 2, podH + 2, z + 2, "white");
      }
      // Elevated glazed Network Operations Center (NOC) bridge spanning between the two server halls!
      v.box(-3, Math.max(3, podH - 3), -3, 3, podH + 2, 4, "glass", 0.78);
      v.box(-3, podH + 2, -3, 3, podH + 3, 4, "steelLight");
      if (clampedLv >= 3) {
        // Backup yellow diesel generators & crisp steel microwave/fiber lattice mast
        v.box(-1, 0, -bz + 2, 1, 3, -bz + 5, "busYellow");
        addLatticeMast(v, 0, 0, podH + 3, 6 + clampedLv, "chrome", "screenCyan");
      }
      break;
    }

    // --------------------- POWER & WASTE (15 — Ground-Flush, Zero Spiral Towers!) ---------------------
    case "solar_panels": {
      // Ground-Mounted Photovoltaic Tracker Rows Directly on Grass + Battery Inverter Cabinet!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const rowStep = clampedLv >= 3 ? 3 : 4;
      for (let z = -bz + 1; z <= bz - 2; z += rowStep) {
        v.box(-bx + 2, 0, z + 1, -bx + 3, 2, z + 2, "steel");
        v.box(bx - 3, 0, z + 1, bx - 2, 2, z + 2, "steel");
        v.box(-bx + 1, 1, z, bx - 1, 2, z + 1, "solarBlue");
        v.box(-bx + 1, 2, z + 1, bx - 1, 3, z + 2, "blue");
      }
      if (clampedLv >= 2) {
        // White grid-tie battery storage cabinet with green charge LED
        v.box(bx - 3, 0, bz - 2, bx, 3 + Math.min(2, clampedLv - 2), bz, "white");
        v.put(bx - 2, 2, bz - 1, "screenGreen", 1.2);
      }
      if (clampedLv >= 4) {
        // Elevated bifacial sun-tracking canopy & weather sensor mast
        addLatticeMast(v, -bx + 2, bz - 2, 0, 6 + clampedLv, "silver", "gold");
      }
      break;
    }

    case "solar_farms": {
      // Utility-Scale PV Tracker Field on Grass + Substation + Clean Heliostat Molten-Salt Receiver Tower (NO spiral!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      for (let z = -bz + 1; z < bz - 4; z += 4) {
        v.box(-bx + 2, 0, z + 1, bx - 2, 2, z + 2, "steelDark");
        v.box(-bx + 1, 1, z, bx - 1, 2, z + 1, "solarBlue");
        v.box(-bx + 1, 2, z + 1, bx - 1, 3, z + 2, "blue");
      }
      // Grid substation & step-up transformer coils in South yard
      v.hollowBox(-bx + 1, 0, bz - 4, -2, 4 + Math.min(2, clampedLv), bz - 1, "white", "sky");
      v.cylinderY(1, bz - 2.5, 0, 4, 1.5, "steelLight");
      v.cylinderY(5, bz - 2.5, 0, 4, 1.5, "steelLight");
      if (clampedLv >= 3) {
        // Tapered white concrete Solar Thermal Power Tower with blazing golden receiver cube!
        const recH = 10 + clampedLv * 3;
        v.cone(bx - 3, 0, recH - 3, bz - 2.5, 2.4, 1.2, "white");
        v.box(bx - 4, recH - 3, bz - 4, bx - 2, recH, bz - 1, "gold", 1.35);
      }
      break;
    }

    case "windmills": {
      // Classic Tapered Octagonal Dutch Smock Mill Directly on Grass + Gallery Stage + Miller's Cottage at Lv.4-5!
      const towerH = Math.round(9 * (0.88 + clampedLv * 0.28));
      const millX = padX >= 12 ? 3 : 0;
      v.cone(millX, 0, towerH, 0, 4.2, 2.3, st.wall);
      v.box(millX - 1, 0, 3, millX + 1, 3, 4, "woodDark"); // arched mill door
      v.dome(millX, towerH, 0, 2.6, "woodDark");
      if (clampedLv >= 2) {
        const galY = Math.floor(towerH * 0.45);
        v.cylinderY(millX, 0, galY, galY + 1, 4.5, "wood");
      }
      if (padX >= 12) {
        // Attached gabled Miller's Granary Cottage & flour sacks on -X (Lv.4-5)!
        v.hollowBox(-padX + 2, 0, -4, millX - 2, 5, 4, "cream", "woodDark");
        addGableSafe(v, -padX + 1, 5, -4, millX - 1, 4, 3, "x", st.roof, "wood");
        v.box(-padX + 3, 0, 4, -padX + 6, 2, 6, "sand"); // flour sacks
      }
      rotorVox = new PixelVox(901 + clampedVar);
      const bl = 5 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "brass");
      rotorVox.box(0, 1, 1, 1, bl, 2, "woodDark");
      rotorVox.box(1, 2, 1, 2, bl, 2, "cream"); // canvas sail lattice
      rotorVox.box(0, -bl, 1, 1, -1, 2, "woodDark");
      rotorVox.box(-1, -bl, 1, 0, -2, 2, "cream");
      rotorVox.box(1, 0, 1, bl, 1, 2, "woodDark");
      rotorVox.box(2, -1, 1, bl, 0, 2, "cream");
      rotorVox.box(-bl, 0, 1, -1, 1, 2, "woodDark");
      rotorVox.box(-bl, 1, 1, -2, 2, 2, "cream");
      rotorPivot = [millX, towerH, 3];
      rotorAxis = "z";
      rotorSpeed = 1.4;
      break;
    }

    case "wind_turbines": {
      // Sleek Tapered White Wind Turbine on Compact Octagonal Foundation Pad + 3-Blade Aerodynamic Rotor!
      const towerH = Math.round(13 * (0.85 + clampedLv * 0.32));
      v.cylinderY(0, 0, 0, 1, 2.4, "concrete");
      v.cone(0, 1, towerH, 0, 1.9, 0.85, "white");
      v.box(-1, towerH - 1, -2, 1, towerH + 1, 2, "white");
      v.box(2, 0, -1, 4, 2, 1, "leafDark"); // padmount transformer box
      if (clampedLv >= 3) {
        v.put(0, towerH + 1, -1, "red", 1.2);
      }
      rotorVox = new PixelVox(902 + clampedVar);
      const bl = 6 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "white");
      rotorVox.box(0, 1, 1, 1, bl, 2, "white"); // vertical top blade
      for (let s = 1; s < bl - 1; s++) {
        const dx = Math.round(s * 0.86);
        const dy = Math.round(s * 0.5);
        rotorVox.put(-dx, -dy, 1, "white");
        rotorVox.put(dx, -dy, 1, "white");
      }
      rotorPivot = [0, towerH, 2];
      rotorAxis = "z";
      rotorSpeed = 2.5;
      break;
    }

    case "wind_farms": {
      // Multi-Turbine Wind Park Directly on Rolling Green Grass + Grid Substation!
      const bx = Math.max(9, padX - 2);
      const bz = Math.max(9, padZ - 2);
      const spots: [number, number, number][] = [
        [-bx + 3, -bz + 3, 14 + clampedLv * 2],
        [bx - 3, -bz + 3, 16 + clampedLv * 2],
        [-bx + 3, bz - 3, 13 + clampedLv * 2],
        [0, 0, 18 + clampedLv * 2],
      ];
      if (clampedLv >= 4) {
        spots.push([bx - 3, 0, 15 + clampedLv * 2]);
      }
      for (const [tx, tz, th] of spots) {
        v.cylinderY(tx, tz, 0, 1, 2.0, "concrete");
        v.cone(tx, 1, th, tz, 1.5, 0.75, "white");
        v.box(tx - 1, th - 1, tz - 1, tx + 1, th + 1, tz + 2, "white");
        if (clampedLv >= 3) {
          v.put(tx, th + 1, tz, "red", 1.15);
        }
        if (tx !== 0 || tz !== 0) {
          // 3-blade static aerodynamic Y-rotor on companion turbines
          v.box(tx, th + 1, tz + 2, tx + 1, th + 6, tz + 3, "white");
          for (let s = 1; s <= 4; s++) {
            v.put(tx - s, th - Math.ceil(s * 0.6), tz + 2, "white");
            v.put(tx + s, th - Math.ceil(s * 0.6), tz + 2, "white");
          }
        }
      }
      v.hollowBox(bx - 5, 0, bz - 4, bx - 1, 4, bz - 1, "steelLight", "sky");
      const centerH = 18 + clampedLv * 2;
      rotorVox = new PixelVox(903 + clampedVar);
      const bl = 7 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "white");
      rotorVox.box(0, 1, 1, 1, bl, 2, "white");
      for (let s = 1; s < bl - 1; s++) {
        const dx = Math.round(s * 0.86);
        const dy = Math.round(s * 0.5);
        rotorVox.put(-dx, -dy, 1, "white");
        rotorVox.put(dx, -dy, 1, "white");
      }
      rotorPivot = [0, centerH, 2];
      rotorAxis = "z";
      rotorSpeed = 2.6;
      break;
    }

    case "coal_powerplants": {
      // Windowed Brick Boiler House + Clerestory Monitor + Turbine Hall + Coal Pile & Conveyor + Tapered Banded Smokestacks!
      const h = Math.round(7 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Tall brick boiler house with glowing industrial arched windows & clerestory monitor
      v.hollowBox(-bx, 0, -bz, 1, 2 + h, 1, "brickDark", "basalt");
      addWindowGrid(v, -bx, 2, -bz, 1, 2 + h, 1, 3, 0.52, "warmGlow");
      v.box(-bx + 2, 2 + h, -bz + 2, -1, 4 + h, -1, "iron");
      // Stepped steel turbine generator hall on +X
      const turbH = Math.max(5, Math.floor(h * 0.68));
      v.hollowBox(1, 0, -bz + 1, bx - 1, turbH, 0, "steel", "steelLight");
      addWindowGrid(v, 1, 2, -bz + 1, bx - 1, turbH, 0, 2, 0.45);
      // Outdoor black coal pile + yellow wheel loader + inclined truss conveyor bridge
      v.cone(bx - 4, 0, 5 + Math.min(3, clampedLv), bz - 4, 3.8, 0.9, "black");
      v.box(bx - 8, 0, bz - 3, bx - 6, 2, bz - 1, "busYellow");
      for (let s = 0; s < 6; s++) {
        v.box(bx - 4 - s, 2 + s, bz - 4 - Math.floor(s * 0.7), bx - 2 - s, 3 + s, bz - 2 - Math.floor(s * 0.7), "steelLight");
      }
      // 1 -> 2 -> 3 tall tapered red/white banded smokestacks!
      const sh = 9 + h + clampedLv * 2;
      const stackXs = clampedLv === 1 ? [-bx + 3] : clampedLv <= 3 ? [-bx + 3, -1] : [-bx + 3, -2, 3];
      for (const sx of stackXs) {
        addTaperedSmokestack(v, sx, bz - 3, 0, sh, 1.9, "brick", "red");
      }
      break;
    }

    case "natural_gas_power_plants": {
      // Combined-Cycle Turbine Hall + White Horton LNG Spheres + HRSG Boilers & Tapered Steel Stacks!
      const h = Math.round(7 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz, 1, h, 1, "steelLight", "sky");
      addWindowGrid(v, -bx, 2, -bz, 1, h, 1, 3, 0.48);
      addHippedRoofSafe(v, -bx, h, -bz, 1, 1, 2, "sky", "white");
      // Spherical white Horton LNG pressure tanks
      v.sphere(bx - 3.5, 3.5, -bz + 3.5, 3.2, 3.2, 3.2, "white");
      if (clampedLv >= 2) {
        v.sphere(bx - 3.5, 3.5, bz - 3.5, 3.2, 3.2, 3.2, "white");
      }
      if (clampedLv >= 4) {
        v.sphere(1, 3.2, bz - 3.5, 2.8, 2.8, 2.8, "silver");
      }
      // Yellow elevated gas pipeline rack + tapered steel HRSG exhaust stacks
      v.box(-bx + 2, 3, 2, bx - 3, 4, 3, "busYellow");
      const sh = 7 + h + clampedLv * 2;
      addTaperedSmokestack(v, -bx + 3, -2, h, sh - h, 1.6, "steel", "sky");
      if (clampedLv >= 3) {
        addTaperedSmokestack(v, -2, -2, h, sh + 2 - h, 1.6, "steel", "sky");
      }
      break;
    }

    case "geothermal_power_plants": {
      // Copper-Domed Geothermal Turbine Hall + Glowing Cyan Hot-Spring Pool + Insulated Steam Pipes & Cooling Cones!
      const h = Math.round(6 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.42), -Math.floor(bz * 0.35), 0, h, 3.8, "slate");
      v.dome(-Math.floor(bx * 0.42), h, -Math.floor(bz * 0.35), 3.9, "copper");
      // Natural basalt-rimmed glowing cyan geothermal hot spring at y = 0
      v.cylinderY(bx - 4, bz - 4, 0, 2, 3.4, "basalt");
      v.cylinderY(bx - 4, bz - 4, 1, 2, 2.5, "cyan", 0.85);
      // Insulated silver steam pipelines with U-expansion loop
      v.box(-2, 2, -bz + 3, bx - 2, 3, -bz + 4, "silver");
      v.cylinderY(bx - 3, -bz + 3.5, 0, 4 + Math.min(3, clampedLv), 1.9, "cyan", 0.7);
      // Hyperbolic concrete cooling towers
      v.cone(-4, 0, 7 + h, bz - 3.5, 3.2, 2.0, "concrete");
      if (clampedLv >= 3) {
        v.cone(2, 0, 9 + h, -1, 2.9, 1.8, "concrete2");
      }
      break;
    }

    case "hydro_electric_power_plants": {
      // Deep Buttressed Concrete Gravity-Arch Dam (y = -2..H) + Angled Steel Penstocks + Toe Powerhouse + Foaming Spillways (ZERO spiral!)
      const h = 7 + clampedLv * 2;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Upstream deep reservoir water held behind dam (-Z)
      v.box(-bx + 1, -2, -bz + 1, bx - 1, Math.max(3, h - 3), -1, "waterDeep", 0.2);
      // Massive curved concrete arch dam anchored down to y = -2!
      for (let x = -bx; x < bx; x++) {
        const zArc = Math.round(Math.cos((x / bx) * 1.15) * 2) - 1;
        v.box(x, -2, zArc - 2, x + 1, h, zArc + 2, "concrete");
        v.box(x, h, zArc - 2, x + 1, h + 1, zArc + 2, "concrete2"); // crest roadway
        if (Math.abs(x) <= 4 && Math.abs(x) % 2 === 0) {
          // Cascading whitewater spillway chutes down dam face!
          for (let s = 0; s < 4; s++) {
            v.box(x, Math.max(-1, h - 3 - s * 2), zArc + 2 + s, x + 1, h - 1 - s * 2, zArc + 3 + s, "foam", 0.5);
          }
        }
      }
      // Angled steel penstock pipes feeding windowed turbine powerhouse at dam toe (+Z)
      for (const px of [-bx + 4, -bx + 7]) {
        v.box(px, 2, 1, px + 1, h - 2, 4, "steelDark");
      }
      v.hollowBox(-bx + 2, -2, 3, -2, 5 + Math.min(3, clampedLv), bz - 1, "concrete2", "sky");
      addWindowGrid(v, -bx + 2, 1, 3, -2, 5 + Math.min(3, clampedLv), bz - 1, 2, 0.6, "screenCyan");
      // HV transmission gantry mast on dam crest
      addLatticeMast(v, bx - 3, -1, h + 1, 6 + clampedLv, "steelLight", "screenCyan");
      break;
    }

    case "micro_reactor_nuclear": {
      // Clean-Tech Modular SMR Containment Vessel + Glowing Cherenkov Ring + Glass Control Wing + Passive Radiator Fins!
      const h = Math.round(7 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const rad = 4.2;
      v.cylinderY(-2, -1, 0, h, rad, "white");
      v.cylinderY(-2, -1, 2, 4, rad + 0.3, "screenCyan", 1.2);
      v.dome(-2, h, -1, rad, "silver");
      // Sleek glazed control & visitor pavilion on +X
      v.hollowBox(3, 0, -bz + 2, bx, 4 + Math.min(3, clampedLv), bz - 2, "steelLight", "woodLight");
      v.box(3, 1, bz - 3, bx - 1, 3, bz - 2, "glass", 0.7);
      if (clampedLv >= 2) {
        // Dark-steel passive cooling radiator fins on -X
        for (let z = -bz + 2; z <= bz - 3; z += 3) {
          v.box(-bx, 0, z, -6, Math.max(4, h - 1), z + 1, "steelDark");
        }
      }
      if (clampedLv >= 4) {
        // Twin SMR core module at high levels!
        v.cylinderY(5, -3, 0, h - 1, 3.0, "white");
        v.dome(5, h - 1, -3, 3.0, "silver");
      }
      break;
    }

    case "nuclear_power_plants": {
      // Iconic Hyperbolic Concrete Cooling Towers + Domed White Reactor Containment(s) + Turbine Hall!
      const th = Math.round(12 * (0.85 + clampedLv * 0.28));
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const towerSpots: [number, number][] =
        clampedLv === 1
          ? [[-Math.floor(bx * 0.45), -Math.floor(bz * 0.3)]]
          : [
              [-Math.floor(bx * 0.52), -Math.floor(bz * 0.32)],
              [-1, -Math.floor(bz * 0.38)],
            ];
      for (const [cx, cz] of towerSpots) {
        v.cone(cx, 0, Math.floor(th * 0.72), cz, 4.1, 2.3, "concrete");
        v.cone(cx, Math.floor(th * 0.72), th, cz, 2.3, 2.9, "concrete2");
        v.cylinderY(cx, cz, th, th + 1, 2.7, "foam", 0.35);
      }
      // Cylindrical white reinforced reactor containment dome(s)
      const domR = 4.2;
      const rx = Math.floor(bx * 0.52);
      v.cylinderY(rx, Math.floor(bz * 0.28), 0, 6 + clampedLv, domR, "white");
      v.dome(rx, 6 + clampedLv, Math.floor(bz * 0.28), domR, "silver");
      v.put(rx, Math.round(6 + clampedLv + domR), Math.floor(bz * 0.28), "screenGreen", 1.25);
      if (clampedLv >= 4) {
        v.cylinderY(rx, -Math.floor(bz * 0.32), 0, 5 + clampedLv, 3.5, "white");
        v.dome(rx, 5 + clampedLv, -Math.floor(bz * 0.32), 3.5, "silver");
      }
      // Turbine generator hall along South-West quadrant
      v.hollowBox(-bx + 1, 0, 2, 2, 5 + Math.min(4, clampedLv), bz - 1, "steelLight", "sky");
      addWindowGrid(v, -bx + 1, 2, 2, 2, 5 + Math.min(4, clampedLv), bz - 1, 2, 0.45);
      break;
    }

    case "factories": {
      // Windowed Red-Brick Sawtooth Foundry + Steel Shipping Dock + Elevated Water Tank + Tapered Brick Smokestacks!
      const h = Math.round(6 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Main red-brick manufacturing hall with north-light glazed sawtooth roof bays
      v.hollowBox(-bx, 0, -bz, 2, h, bz - 1, "brick", "brickDark");
      addWindowGrid(v, -bx, 2, -bz, 2, h, bz - 1, 3, 0.45, "warmGlow");
      for (let x = -bx; x <= 0; x += 4) {
        v.box(x, h, -bz, x + 2, h + 2, bz - 1, "brickDark");
        v.box(x + 2, h, -bz, x + 3, h + 2, bz - 1, "glass", 0.65);
      }
      // Corrugated steel shipping bay + roll-up doors + crates on +X
      const lowH = Math.max(4, Math.floor(h * 0.68));
      v.hollowBox(2, 0, -1, bx, lowH, bz - 1, "steel", "steelLight");
      v.box(4, 0, bz - 2, 7, 3, bz - 1, "iron");
      v.box(8, 0, bz - 1, 10, 2, bz, "crate");
      // Rooftop wooden water tank on steel legs
      v.cylinderY(bx - 3.5, bz - 3.5, lowH, lowH + 4 + Math.min(2, clampedLv), 1.9, "woodDark");
      // Tapered industrial smokestacks
      const sh = 8 + h + clampedLv * 2;
      addTaperedSmokestack(v, bx - 3, -bz + 3, 0, sh, 1.8, "brickDark", "cream");
      if (clampedLv >= 3) {
        addTaperedSmokestack(v, bx - 7, -bz + 3, 0, sh - 3, 1.5, "iron", "amber");
      }
      break;
    }

    case "landfill": {
      // Sculpted Earthen & Recycling Mounds Directly on Terrain + Tracked Bulldozer + Weigh Shack & Methane Flare!
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.cone(-2, 0, 3 + clampedLv * 2, -1, Math.min(5.2, bx), 1.5, "soil");
      v.cone(2, 0, 2 + clampedLv, -2, Math.min(3.8, bx - 1), 1.2, "sandDark");
      v.put(-2, 3 + clampedLv, 0, "steel");
      v.put(0, 2 + clampedLv, -2, "brick");
      // Detailed yellow bulldozer with black tracks & silver blade
      v.box(1, 0, 1, 4, 1, 4, "charcoal");
      v.box(1, 1, 1, 4, 3, 3, "busYellow");
      v.box(1, 0, 4, 4, 2, 5, "silver");
      if (clampedLv >= 2 && bx >= 8) {
        // Weighbridge office shack
        v.hollowBox(-bx + 1, 0, bz - 4, -bx + 5, 4, bz - 1, "steelLight", "sky");
      }
      if (clampedLv >= 4) {
        // Methane-to-energy gas flare pipe & green bio-cap terrace
        v.cylinderY(-bx + 2, -bz + 2, 0, 6 + clampedLv, 0.95, "steelDark");
        v.put(-bx + 2, 6 + clampedLv, -bz + 2, "fire", 1.3);
      }
      break;
    }

    case "trash_compacting_plants": {
      // Modern Materials Recovery & Baling Plant: Tipping Hall + Yellow Hydraulic Press + Colorful Recycling Bales + Bio-Silos!
      const h = Math.round(5.5 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Green cylindrical bio-digester silo(s) on -X
      v.cylinderY(-bx + 3, -bz + 3, 0, 2 + h, 2.5, "leaf");
      v.dome(-bx + 3, 2 + h, -bz + 3, 2.5, "steelLight");
      if (clampedLv >= 3) {
        v.cylinderY(-bx + 3, bz - 3, 0, 1 + h, 2.2, "leafDark");
        v.dome(-bx + 3, 1 + h, bz - 3, 2.2, "steelLight");
      }
      // Concrete sorting & hydraulic press hall on +X
      const lowH = Math.max(4, Math.floor(h * 0.72));
      v.hollowBox(-1, 0, -bz + 1, bx, lowH, 2, "concrete", "leaf");
      v.box(1, lowH, -2, bx - 2, lowH + 3, 1, "busYellow"); // hydraulic press gantry
      // Neatly stacked colorful compressed recycling bales in front yard!
      v.box(1, 0, 3, 3, 2, 5, "sky");
      v.box(3, 0, 3, 5, 2, 5, "amber");
      v.box(5, 0, 3, 7, 2, 5, "leafLight");
      break;
    }

    case "trash_burning_plants": {
      // CopenHill-Inspired Architectural Ski-Slope Green-Roof Waste-to-Energy Plant + Glowing Grate + Twin Tapered Scrubber Stacks!
      const h = Math.round(7 * hLv);
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const x0 = -bx + Math.floor((i * (bx * 2 - 4)) / steps);
        const x1 = -bx + Math.floor(((i + 1) * (bx * 2 - 4)) / steps) + 1;
        const stepH = Math.max(4, Math.round((3 + h) * ((i + 1) / steps)));
        v.hollowBox(x0, 0, -bz + 1, x1, stepH, bz - 1, "silver", "steelLight");
        v.box(x0, stepH, -bz + 1, x1, stepH + 1, bz - 1, i % 2 === 0 ? "leaf" : "grass3"); // green park ski-slope roof!
      }
      // Glowing incinerator furnace window at ground level
      v.box(-3, 1, bz - 2, 2, 4, bz - 1, "fire", 1.3);
      // Clean twin tapered white/orange flue-gas scrubber stacks (NO spiral!)
      const sh = 8 + h + clampedLv * 2;
      addTaperedSmokestack(v, bx - 2.5, -bz + 3, 0, sh, 2.0, "white", "orange");
      if (clampedLv >= 3) {
        addTaperedSmokestack(v, bx - 2.5, 2, 0, sh - 3, 1.7, "silver", "orange");
      }
      break;
    }

    // --------------------- WATER UTILITIES (8 — Ground-Flush, Zero Spiral Towers!) ---------------------
    case "wells": {
      // Cobblestone Village Well on Grass + Timber Winch & Shingle Gable -> Ornate Arched Stone Wellhouse at Lv.4-5!
      const wh = 4 + clampedLv;
      v.cylinderY(0, 0, 0, 1, 3.6, "stone");
      v.cylinderY(0, 0, 1, 3, 2.7, "stone");
      v.cylinderY(0, 0, 1, 3, 1.8, "water", 0.35);
      v.box(-2, 3, 0, -1, 3 + wh, 1, clampedLv >= 4 ? "limestone" : "woodDark");
      v.box(1, 3, 0, 2, 3 + wh, 1, clampedLv >= 4 ? "limestone" : "woodDark");
      v.box(-2, 5, 0, 2, 6, 1, "oak"); // winch axle
      v.put(0, 4, 0, "crate"); // wooden bucket
      addGableSafe(v, -3, 3 + wh, -2, 3, 3, 3, "x", clampedLv >= 4 ? "copper" : st.roof, "wood");
      if (clampedLv >= 4) {
        v.put(0, 6 + wh, 0, "gold", 0.9);
      }
      break;
    }

    case "water_towers": {
      // 5 Distinct Authentic Water Tower Designs Across Lv.1-5 (ZERO spiral tower!):
      const legH = 6 + clampedLv * 3;
      if (clampedLv === 1) {
        // Lv.1: Classic rural cross-braced timber trestle + bound cedar barrel tank!
        for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
          v.box(lx, 0, lz, lx + 1, legH, lz + 1, "woodDark");
        }
        v.box(-2, Math.floor(legH * 0.5), -2, 3, Math.floor(legH * 0.5) + 1, 3, "wood");
        v.cylinderY(0, 0, legH, legH + 5, 3.4, "oak");
        v.cone(0, legH + 5, legH + 8, 0, 3.8, 0.5, "woodDark");
      } else if (clampedLv === 2) {
        // Lv.2: 4-leg cross-braced steel municipal tank + central riser pipe + catwalk!
        for (const [lx, lz] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) {
          v.box(lx, 0, lz, lx + 1, legH, lz + 1, "steelDark");
        }
        v.cylinderY(0, 0, 0, legH, 1.0, "steel");
        v.box(-3, Math.floor(legH * 0.5), -3, 3, Math.floor(legH * 0.5) + 1, 3, "steelLight");
        v.cylinderY(0, 0, legH - 1, legH, 4.2, "steelLight");
        v.cylinderY(0, 0, legH, legH + 6, 3.8, "sky");
        v.cone(0, legH + 6, legH + 9, 0, 4.1, 0.5, "slate");
      } else if (clampedLv === 3) {
        // Lv.3: Mid-century sleek flared white/sky Waterspheroid pedestal!
        v.cone(0, 0, legH, 0, 2.8, 1.3, "white");
        v.sphere(0, legH + 3, 0, 4.4, 3.8, 4.4, "sky");
        v.put(0, legH + 7, 0, "red", 1.15);
      } else {
        // Lv.4-5: Monumental fluted hydro-pillar municipal reservoir tower with catwalk halo & cyan telemetry!
        v.cone(0, 0, legH, 0, 3.2, 2.2, "concrete2");
        v.cylinderY(0, 0, legH - 1, legH, 4.9, "white");
        v.cylinderY(0, 0, legH, legH + 6 + (clampedLv - 3), 4.6, "sky");
        v.cylinderY(0, 0, legH + 2, legH + 4, 4.8, "white");
        v.dome(0, legH + 6 + (clampedLv - 3), 0, 4.6, "blue");
        v.put(0, legH + 11 + (clampedLv - 3), 0, "screenCyan", 1.25);
      }
      break;
    }

    case "water_treatment_plant": {
      // Circular Turquoise Clarifier Basins with Scraper Bridges + Lab Building + Ozone Contact Silos (ZERO spiral!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const rBasin = Math.min(3.5, bz - 1);
      // Primary circular clarifier basin
      const b1x = -Math.floor(bx * 0.45);
      const b1z = bz >= 9 ? -Math.floor(bz * 0.35) : 0;
      v.cylinderY(b1x, b1z, 0, 3, rBasin, "concrete");
      v.cylinderY(b1x, b1z, 2, 3, rBasin - 0.8, "water", 0.4);
      v.box(Math.round(b1x - rBasin), 3, Math.round(b1z), Math.round(b1x + rBasin), 4, Math.round(b1z) + 1, "steelLight"); // scraper bridge
      if (bz >= 9) {
        // Secondary cyan polishing basin at Lv.3-5
        const b2z = Math.floor(bz * 0.35);
        v.cylinderY(b1x, b2z, 0, 3, rBasin - 0.3, "concrete");
        v.cylinderY(b1x, b2z, 2, 3, rBasin - 1.1, "cyan", 0.55);
      }
      // Glazed water-quality laboratory + blue ozone filtration silos on +X
      const ph = 4 + clampedLv;
      v.hollowBox(1, 0, -bz + 1, bx, ph, 1, "white", "sky");
      addWindowGrid(v, 1, 1, -bz + 1, bx, ph, 1, 2, 0.55, "screenCyan");
      v.dome(Math.floor((1 + bx) * 0.5), ph, -Math.floor((bz - 1) * 0.4), 2.6, "sky");
      if (clampedLv >= 2 && bz >= 9) {
        v.cylinderY(bx - 3, bz - 3, 0, ph + 3, 1.8, "blue");
        v.cylinderY(bx - 6, bz - 3, 0, ph + 2, 1.6, "sky");
      }
      break;
    }

    case "water_places": {
      // Sculpted Baroque Marble Plaza Fountain Surrounded by Floral Planters (ground-flush!)
      const rad = Math.min(5.2, padX - 1);
      v.cylinderY(0, 0, 0, 2, rad, "marble");
      v.cylinderY(0, 0, 1, 2, rad - 0.9, "water", 0.4);
      const fh = 4 + clampedLv * 2;
      v.cylinderY(0, 0, 1, fh, 1.4, "marbleShade");
      v.cylinderY(0, 0, Math.floor(fh * 0.55), Math.floor(fh * 0.55) + 1, Math.max(2.2, rad * 0.55), "marble");
      v.sphere(0, fh + 1, 0, 1.7 + clampedLv * 0.15, 1.8 + clampedLv * 0.2, 1.7 + clampedLv * 0.15, "cyan", 0.8);
      if (padX >= 10) {
        for (const [fx, fz] of [[-padX + 2, -padZ + 2], [padX - 4, -padZ + 2], [-padX + 2, padZ - 4], [padX - 4, padZ - 4]]) {
          v.box(fx, 0, fz, fx + 2, 1, fz + 2, "leafDark");
          v.put(fx + 1, 1, fz + 1, "pink");
        }
      }
      break;
    }

    case "water_pumping_station": {
      // Victorian Red-Brick & Limestone Pumphouse + Plunging Cast-Iron Intake Pipes (y = -2) + Valve Wheels & Square Standpipe!
      const h = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Stone foundation pier down to y = -2 for seamless shoreline/water anchoring
      v.box(-bx, -2, -bz + 1, 2, 0, bz - 1, "stone");
      v.hollowBox(-bx, 0, -bz + 1, 2, h, bz - 1, "brick", "limestone");
      addWindowGrid(v, -bx, 1, -bz + 1, 2, h, bz - 1, 2, 0.55, "warmGlow");
      addGableSafe(v, -bx - 1, h, -bz + 1, 3, bz - 1, 4, "x", "slate", "limestone");
      // Heavy cast-iron intake manifolds plunging into the water on +X with red shutoff wheels
      for (const pz of [-2, 1]) {
        v.box(2, 1, pz, bx - 1, 3, pz + 2, "iron");
        v.box(bx - 2, -2, pz, bx, 3, pz + 2, "iron");
        v.put(4, 3, pz, "red");
      }
      // Square Victorian surge standpipe tower
      const stH = h + 4 + clampedLv * 2;
      v.hollowBox(-bx + 1, 0, -bz + 1, -bx + 5, stH, -bz + 5, "brickDark", "limestone");
      addHippedRoofSafe(v, -bx + 1, stH, -bz + 1, -bx + 5, -bz + 5, 3, "copper", "white");
      break;
    }

    case "municipal_reservoir": {
      // Sloped Stone Embankment Basin + Deep Sapphire Water + Square Victorian Masonry Gatehouse Tower (ZERO spiral!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.box(-bx, 0, -bz, bx, 2, bz, "stone");
      v.box(-bx + 1, 2, -bz + 1, bx - 1, 4, bz - 1, "limestone");
      v.box(-bx + 2, 1, -bz + 2, bx - 2, 4, bz - 2, "waterDeep", 0.3);
      // Classic square Victorian limestone intake gatehouse + footbridge!
      const gh = 7 + clampedLv * 2;
      v.hollowBox(-3, 2, -3, 3, gh, 3, "limestone", "stone");
      addWindowGrid(v, -3, 4, -3, 3, gh, 3, 3, 0.55, "warmGlow");
      addHippedRoofSafe(v, -4, gh, -4, 4, 4, 4, "copper", "white");
      v.box(-1, 4, 3, 1, 5, bz - 1, "wood"); // service walkway bridge to dam crest
      break;
    }

    case "aqueduct": {
      // Monumental Roman Pont-du-Gard Multi-Tier Limestone Arch Viaduct + Glowing Turquoise Water Channel!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(3, Math.min(5, padZ - 1));
      const tier1H = 5 + clampedLv;
      const tier2H = clampedLv >= 2 ? 4 + clampedLv : 0;
      const topH = tier1H + tier2H;
      for (let x = -bx; x <= bx - 2; x += 4) {
        v.box(x, 0, -bz, x + 2, tier1H, bz, "limestone");
      }
      v.box(-bx, tier1H - 1, -bz, bx, tier1H + 1, bz, "marbleShade");
      if (tier2H > 0) {
        for (let x = -bx + 1; x <= bx - 1; x += 3) {
          v.box(x, tier1H + 1, -bz + 1, x + 1, topH, bz - 1, "limestone");
        }
        v.box(-bx, topH - 1, -bz, bx, topH + 1, bz, "marble");
      }
      v.box(-bx, topH + 1, -bz, bx, topH + 2, -bz + 1, "limestone");
      v.box(-bx, topH + 1, bz - 1, bx, topH + 2, bz, "limestone");
      v.box(-bx, topH + 1, -bz + 1, bx, topH + 2, bz - 1, "cyan", 0.6);
      if (clampedLv >= 4) {
        v.cylinderY(-bx + 2, 0, 0, topH + 3, 2.2, "marble");
        v.dome(-bx + 2, topH + 3, 0, 2.2, "gold");
      }
      break;
    }

    case "desalination_plant": {
      // Coastal Reverse-Osmosis Hall + Seawater Intake Caissons (y = -2) + Twin Pressure Domes + Fresh-Water Tanks (ZERO spiral!)
      const h = 5 + clampedLv;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Concrete coastal seawall & submerged seawater intake pipes on +Z
      v.box(-bx + 1, -2, -bz + 1, bx - 1, 0, bz - 3, "concreteDark");
      for (const px of [-4, 2]) {
        v.box(px, -2, bz - 4, px + 2, 2, bz, "blue");
      }
      // Glazed white RO membrane hall on -X
      v.hollowBox(-bx + 1, 0, -bz + 1, 1, h, 2, "white", "sky");
      addWindowGrid(v, -bx + 1, 1, -bz + 1, 1, h, 2, 2, 0.55, "screenCyan");
      v.dome(-Math.floor(bx * 0.45), h, -2, 3.6, "sky");
      // Horizontal cyan RO pressure-vessel racks & stainless product-water silos on +X
      for (let z = -bz + 2; z <= 1; z += 3) {
        v.box(2, 1, z, bx - 2, 3 + Math.min(2, clampedLv - 1), z + 2, "cyan");
      }
      v.cylinderY(bx - 4, 4, 0, h + 3, 2.6, "silver");
      v.dome(bx - 4, h + 3, 4, 2.6, "white");
      if (clampedLv >= 3) {
        v.cylinderY(-4, 5, 0, h + 2, 2.4, "white");
        v.dome(-4, h + 2, 5, 2.4, "cyan");
      }
      break;
    }

    // --------------------- TRANSIT STOPS & DEPOTS (5 — Ground-Flush, Zero Spiral Towers!) ---------------------
    case "train_stops": {
      // Raised Stone Passenger Platform + Ballast & Steel Rails + Crimson Canopy + Square Victorian Station Clock Turret!
      const h = 4 + clampedLv;
      const bx = Math.max(8, padX - 1);
      // Rail track bed along front (+Z = 3..6)
      v.box(-bx, 0, 3, bx, 1, 6, "gravel");
      v.box(-bx, 1, 3, bx, 2, 4, "steelLight");
      v.box(-bx, 1, 5, bx, 2, 6, "steelLight");
      // Raised stone commuter platform & waiting house
      v.box(-bx, 0, -4, bx, 2, 3, "stone");
      v.box(-bx, 1, 2, bx, 2, 3, "busYellow"); // yellow platform safety tactile line!
      v.hollowBox(-4, 2, -4, 4, 2 + h, 0, "brick", "cream");
      addWindowGrid(v, -4, 2, -4, 4, 2 + h, 0, 2, 0.6, "warmGlow");
      for (const px of [-bx + 2, bx - 3]) {
        v.box(px, 2, 0, px + 1, 2 + h, 1, "iron");
      }
      addGableSafe(v, -bx, 2 + h, -4, bx, 2, 2, "x", "crimson", "cream");
      if (clampedLv >= 2) {
        addSquareClockTower(v, 0, -2, 2 + h, 6 + clampedLv, 2, "cream", "brick", "slate");
      }
      break;
    }

    case "train_depots": {
      // Arched Glazed Victorian Train Shed + Visible Steel Tracks & Red/Black Locomotive + Square Brick Clock Tower (ZERO spiral!)
      const h = 6 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Steel rails extending into open train-shed bays
      for (const tx of [-5, 1]) {
        v.box(tx, 0, -bz + 2, tx + 3, 1, bz - 1, "gravel");
        v.box(tx, 1, -bz + 2, tx + 1, 2, bz - 1, "steelLight");
        v.box(tx + 2, 1, -bz + 2, tx + 3, 2, bz - 1, "steelLight");
      }
      // Brick concourse walls + arched glazed iron barrel train-shed roof!
      v.hollowBox(-bx, 0, -bz, bx - 4, h, 2, "brick", "cream");
      v.clear(-6, 1, 0, -1, h - 1, 3); // open locomotive portal 1
      v.clear(0, 1, 0, 5, h - 1, 3); // open locomotive portal 2
      for (let x = -bx; x < bx - 4; x++) {
        const norm = (x - (-2)) / Math.max(4, bx - 2);
        const ay = Math.max(1, Math.round((1 - Math.min(1, norm * norm)) * 4));
        v.box(x, h, -bz, x + 1, h + ay, 2, x % 3 === 0 ? "iron" : "glass", x % 3 === 0 ? 0 : 0.6);
      }
      // Detailed red & black locomotive peeking out of Portal 1 with glowing brass headlamp!
      v.box(-5, 1, -1, -2, 4, 5, "crimson");
      v.box(-5, 4, -1, -2, 5, 2, "charcoal");
      v.put(-4, 3, 5, "warmGlow", 1.3);
      // Soaring square Victorian brick & limestone clock tower on +X/-Z!
      addSquareClockTower(v, bx - 3, -bz + 3, 0, h + 6 + clampedLv * 2, 2, "brickDark", "cream", "slate");
      break;
    }

    case "bus_stops": {
      // Tempered-Glass Urban Transit Shelter + Wooden Bench + Cantilevered Yellow Canopy & Digital Arrival Totem!
      const h = 4 + Math.min(2, clampedLv);
      v.box(-5, 0, 0, 5, 1, 3, "concrete2"); // narrow sidewalk curb strip
      v.box(-4, 1, -2, -3, 1 + h, -1, "steelDark");
      v.box(3, 1, -2, 4, 1 + h, -1, "steelDark");
      v.box(-4, 1, -2, 4, 1 + h, -1, "glass", 0.55);
      v.box(-2, 1, -1, 2, 2, 0, "oak"); // passenger bench
      v.box(-5, 1 + h, -3, 5, 2 + h, 2, "busYellow");
      if (clampedLv >= 3) {
        v.box(-4, 2 + h, -2, 4, 3 + h, 1, "solarBlue");
      }
      v.box(5, 0, 0, 6, 3 + h, 1, "charcoal");
      v.put(5, 2 + h, 1, "screenCyan", 1.25);
      break;
    }

    case "bus_depots": {
      // Municipal Transit Maintenance Hall + Parked Yellow/Sky City Buses + Rooftop Dispatch Control & Lattice Mast (ZERO spiral!)
      const h = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz, 2, h, 0, "concrete", "busYellow");
      addGableSafe(v, -bx, h, -bz, 2, 0, 2, "x", "steelLight", "busYellow");
      // Parked articulated yellow city bus(es) with windshields & rooftop AC pods!
      v.box(-6, 0, 2, 0, 3, 5, "busYellow");
      v.box(-6, 2, 2, 0, 3, 4, "glass", 0.6);
      v.box(-4, 3, 3, -2, 4, 4, "white");
      if (bz >= 9) {
        v.box(2, 0, 2, 8, 3, 5, "sky");
        v.box(2, 2, 2, 8, 3, 4, "glass", 0.6);
      }
      // Glazed dispatch control booth + steel radio lattice mast on +X
      v.hollowBox(2, 0, -bz + 1, bx - 1, h + 2, -1, "charcoal", "busYellow");
      v.box(3, h - 1, -2, bx - 2, h + 1, -1, "glass", 0.75);
      addLatticeMast(v, bx - 3, -bz + 3, h + 2, 5 + clampedLv, "steel", "amber");
      break;
    }

    case "taxi_depots": {
      // Retro Checkered Yellow-and-Black Dispatch Office + Carport Canopy + Detailed Yellow Cabs with Glowing Roof Medallions!
      const h = 4 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, -1, h, 1, "charcoal", "busYellow");
      for (let x = -bx; x < -1; x++) {
        v.put(x, h, 1, x % 2 === 0 ? "busYellow" : "black");
      }
      v.box(-bx + 2, h + 1, -2, -3, h + 3, 0, "busYellow", 1.1); // glowing TAXI rooftop sign
      // Detailed yellow taxi cabs in forecourt
      v.box(1, 0, 1, 5, 2, 4, "busYellow");
      v.box(2, 2, 1, 4, 3, 4, "glass", 0.6);
      v.put(3, 3, 2, "warmGlow", 1.2);
      if (clampedLv >= 3) {
        v.box(1, 0, -bz + 1, 5, 2, -1, "busYellow");
        v.put(3, 2, -2, "warmGlow", 1.2);
      }
      break;
    }

    // --------------------- CIVIC & PARKS (13 — Ground-Flush, Zero Spiral Towers!) ---------------------
    case "sports_field": {
      // Dedicated school athletic field, visually connected to a neighboring high school.
      const bx = padX, bz = padZ;
      v.box(-bx + 1, 0, -bz + 1, bx - 1, 1, bz - 1, "leafDark");
      // Perimeter track and bright turf with thin sideline markers.
      v.box(-bx + 1, 0, -bz + 1, bx - 1, 1, -bz + 3, "terracotta");
      v.box(-bx + 1, 0, bz - 3, bx - 1, 1, bz - 1, "terracotta");
      v.box(-bx + 1, 0, -bz + 1, -bx + 3, 1, bz - 1, "terracotta");
      v.box(bx - 3, 0, -bz + 1, bx - 1, 1, bz - 1, "terracotta");
      for (let x = -bx + 5; x < bx - 4; x += 5) v.box(x, 1, -bz + 4, x + 1, 2, bz - 4, "white");
      for (let z of [-bz + 4, bz - 5]) v.box(-bx + 4, 1, z, bx - 4, 2, z + 1, "white");
      if (clampedLv >= 2) v.box(-bx + 2, 0, -bz + 3, -bx + 4, 3, bz - 3, "silver"); // bleachers
      if (clampedLv >= 3) v.box(bx - 4, 0, -bz + 3, bx - 2, 3, bz - 3, "silver");
      if (clampedLv >= 4) {
        for (const [x, z] of [[-bx + 2, -bz + 2], [bx - 3, -bz + 2], [-bx + 2, bz - 3], [bx - 3, bz - 3]]) {
          v.box(x, 1, z, x + 1, 10, z + 1, "steel");
          v.put(x, 10, z, "warmGlow", 1.1);
        }
      }
      if (clampedLv >= 5) v.box(-bx + 5, 0, bz - 5, -bx + 9, 5, bz - 3, "brick"); // little clubhouse
      break;
    }

    case "research_institute": {
      const bx = padX, bz = padZ, h = 7 + clampedLv * 3;
      v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h, bz - 2, "glass", "silver");
      addWindowGrid(v, -bx + 1, 1, -bz + 1, bx - 1, h, bz - 2, 2, 0.56, "screenCyan");
      v.box(-bx + 1, h, -bz + 1, bx - 1, h + 1, bz - 2, "steelLight");
      v.cylinderY(0, -1, h + 1, h + 4, 2.8, "white");
      v.dome(0, h + 4, -1, 3, "glass", 0.3);
      if (clampedLv >= 2) v.box(-bx + 3, h + 1, -bz + 2, -bx + 7, h + 2, bz - 3, "solarBlue");
      if (clampedLv >= 3) v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, h - 2, bz - 2, "limestone", "silver");
      if (clampedLv >= 4) v.box(-bx + 2, 0, bz - 2, bx - 2, 1, bz - 1, "teal");
      if (clampedLv >= 5) v.box(bx - 4, h + 1, bz - 4, bx - 3, h + 11, bz - 3, "steel");
      break;
    }

    case "preschool":
    case "country_schoolhouse":
    case "elementary_school":
    case "middle_school":
    case "high_school":
    case "trade_school":
    case "community_college":
    case "university":
    case "research_university": {
      // Every school keeps its own recognizable architectural identity over five levels.
      const bx = padX, bz = padZ;
      const h = 3 + clampedLv * (def.id === "research_university" ? 3 : 2);
      const roof = def.id === "preschool" ? "orange" : def.id === "country_schoolhouse" ? "crimson"
        : def.id === "trade_school" ? "steelDark" : def.id === "university" ? "copper" : "slate";
      const walls = def.id === "preschool" ? "yellow" : def.id === "country_schoolhouse" ? "white"
        : def.id === "community_college" || def.id === "research_university" ? "glass" : "brick";
      const trim = def.id === "research_university" ? "screenCyan" : def.id === "preschool" ? "pink" : "cream";

      if (def.id === "preschool") {
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 2, h, 1, walls, trim);
        addGableSafe(v, -bx, h, -bz, bx - 1, 2, 3, "x", roof, "white");
        v.box(-3, 0, 2, 3, 1, bz - 1, "leafLight");
        v.box(-2, 1, 3, 0, 3, 4, "pink"); // miniature slide
        v.box(0, 0, 4, 3, 1, 6, "sand"); // sandbox
        v.box(-bx, 0, bz - 1, bx, 2, bz, "white"); // front picket fence
        if (clampedLv >= 3) v.box(-bx + 1, 0, -bz + 1, -bx + 4, h + 2, 1, "teal");
        if (clampedLv >= 5) v.dome(1, h, -1, 2.2, "orange");
      } else if (def.id === "country_schoolhouse") {
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h, bz - 2, "white", "woodLight");
        addGableSafe(v, -bx, h, -bz, bx, bz - 1, 4, "x", "crimson", "cream");
        v.box(-2, 0, bz - 2, 2, 1, bz - 1, "wood");
        v.box(-1, 1, bz - 2, 1, 4, bz - 1, "woodDark");
        v.box(-1, h + 2, -1, 2, h + 5 + clampedLv, 2, "cream"); // bell tower
        v.dome(0, h + 5 + clampedLv, 0, 2.0, "crimson");
        if (clampedLv >= 2) addTreeMini(v, bx - 2, 0, bz - 2, 0);
        if (clampedLv >= 3) v.box(-bx + 1, 0, -bz, bx - 2, 2, -bz + 1, "wood");
        if (clampedLv >= 4) v.box(bx - 4, 0, -bz + 1, bx - 1, h - 1, 1, "cream");
        if (clampedLv >= 5) v.box(-bx + 2, 0, bz - 1, bx - 2, 1, bz, "path");
      } else if (def.id === "research_university") {
        v.hollowBox(-bx + 2, 0, -bz + 2, bx - 2, h + 4, bz - 3, "steelLight", "screenCyan");
        addWindowGrid(v, -bx + 2, 1, -bz + 2, bx - 2, h + 4, bz - 3, 2, 0.72, "glass");
        v.box(-bx + 2, h + 4, -bz + 2, bx - 2, h + 5, bz - 3, "silver");
        v.cylinderY(0, -1, h + 5, h + 8, 2.6, "white");
        v.dome(0, h + 8, -1, 3.0, "glass", 0.6);
        if (clampedLv >= 2) v.box(-bx + 3, 0, bz - 2, bx - 3, 1, bz - 1, "solarBlue");
        if (clampedLv >= 3) v.hollowBox(-bx + 1, 0, -bz + 2, -bx + 5, h + 1, bz - 3, "glass", "silver");
        if (clampedLv >= 4) v.hollowBox(bx - 5, 0, -bz + 2, bx - 1, h + 2, bz - 3, "glass", "silver");
        if (clampedLv >= 5) v.box(-bx + 3, h + 5, -bz + 4, bx - 3, h + 6, -bz + 1, "teal");
      } else if (def.id === "high_school") {
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h + 2, 0, "brick", "cream");
        addWindowGrid(v, -bx + 1, 1, -bz + 1, bx - 1, h + 2, 0, 2, 0.5);
        addHippedRoofSafe(v, -bx, h + 2, -bz, bx, 1, 3, "slate", "white");
        // Localized athletic field with white grid stripes and track outline.
        v.box(-bx + 1, 0, 2, bx - 1, 1, bz - 1, "leafDark");
        for (let x = -bx + 3; x < bx - 2; x += 3) v.box(x, 1, 2, x + 1, 2, bz - 2, "white");
        v.box(-bx + 1, 0, 1, bx - 1, 1, 2, "terracotta");
        if (clampedLv >= 2) v.hollowBox(-bx + 1, 0, -bz + 1, -bx + 6, h + 2, 1, "brick", "white");
        if (clampedLv >= 3) v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, h + 3, 1, "limestone", "cream");
        if (clampedLv >= 4) v.box(bx - 3, 1, bz - 2, bx - 1, 4, bz - 1, "steel");
        if (clampedLv >= 5) addSquareClockTower(v, 0, -bz + 3, h + 1, 8, 2, "brickDark", "cream", "slate");
      } else if (def.id === "trade_school") {
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h, 1, "stone", "steelDark");
        v.box(-bx + 1, h, -bz + 1, bx - 1, h + 1, 1, "steelDark");
        for (let x = -bx + 3; x < bx - 3; x += 5) v.box(x, 0, 0, x + 3, 4, 2, "charcoal"); // workshop bays
        v.box(-bx + 2, 0, bz - 3, -bx + 5, 2, bz - 1, "busYellow"); // machinery
        if (clampedLv >= 2) v.box(bx - 6, 0, bz - 3, bx - 2, 3, bz - 1, "orange");
        if (clampedLv >= 3) v.hollowBox(-bx + 2, 0, -bz + 2, -bx + 6, h + 3, 0, "brick", "cream");
        if (clampedLv >= 4) v.box(-bx + 2, h + 1, -bz + 2, bx - 3, h + 2, 0, "solarBlue");
        if (clampedLv >= 5) v.box(bx - 2, 0, -bz + 1, bx - 1, h + 6, 0, "silver");
      } else if (def.id === "university") {
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h + 2, 0, "limestone", "cream");
        addGableSafe(v, -bx, h + 2, -bz, bx, 1, 3, "x", "copper", "white");
        v.box(-bx + 2, 0, 2, bx - 2, 1, bz - 1, "leaf");
        v.box(-1, 0, 1, 1, 1, bz - 1, "path");
        addTreeMini(v, -bx + 3, 0, bz - 3, 0);
        addTreeMini(v, bx - 4, 0, bz - 3, 2);
        if (clampedLv >= 2) addSquareClockTower(v, 0, -bz + 3, h + 1, 8 + clampedLv, 2, "limestone", "cream", "copper");
        if (clampedLv >= 3) v.hollowBox(-bx + 1, 0, -bz + 1, -bx + 6, h + 2, bz - 3, "brick", "cream");
        if (clampedLv >= 4) v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, h + 3, bz - 3, "brick", "cream");
        if (clampedLv >= 5) v.dome(0, h + 3, -bz + 2, 4, "copper");
      } else {
        // Elementary, middle and community college share a readable school silhouette,
        // differentiated by their roof materials, courtyards, wings and recreation spaces.
        const isCollege = def.id === "community_college";
        const isMiddle = def.id === "middle_school";
        v.hollowBox(-bx + 1, 0, -bz + 1, bx - 1, h, 0, isCollege ? "glass" : "brick", isCollege ? "teal" : "cream");
        addWindowGrid(v, -bx + 1, 1, -bz + 1, bx - 1, h, 0, 2, 0.5);
        if (!isCollege) addGableSafe(v, -bx, h, -bz, bx, 1, 3, "x", roof, "cream");
        else v.box(-bx, h, -bz, bx, h + 1, 1, "steelLight");
        v.box(-bx + 2, 0, 2, bx - 2, 1, bz - 1, isMiddle ? "terracotta" : "leafLight");
        // Basketball hoop, play equipment or collegiate courtyard.
        v.box(bx - 3, 1, bz - 3, bx - 2, 4, bz - 2, "white");
        v.put(bx - 3, 4, bz - 3, isMiddle ? "orange" : "yellow");
        if (clampedLv >= 2) v.hollowBox(-bx + 1, 0, -bz + 1, -bx + 6, h - 1, 1, walls, trim);
        if (clampedLv >= 3) v.hollowBox(bx - 6, 0, -bz + 1, bx - 1, h + 1, 1, walls, trim);
        if (clampedLv >= 4) v.box(-bx + 2, 0, bz - 2, -bx + 6, 3, bz - 1, "busYellow"); // bus loop
        if (clampedLv >= 5) v.dome(0, h + 1, -1, 3.0, isCollege ? "glass" : "copper", 0.4);
      }
      break;
    }

    case "school": {
      // Multi-Wing Red-Brick & Limestone Academy: Gabled Classroom Hall + Playground Court + Domed Library + Square Collegiate Clock Tower!
      const lowH = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Red-brick classroom wing on -X sitting flush at y = 0
      v.hollowBox(-bx, 0, -bz + 1, 1, lowH, bz - 1, "brick", "cream");
      addWindowGrid(v, -bx, 1, -bz + 1, 1, lowH, bz - 1, 2, 0.52, "warmGlow");
      addGableSafe(v, -bx - 1, lowH, -bz + 1, 2, bz - 1, 3, "z", "slate", "cream");
      // Recessed courtyard basketball playground on (+X, +Z) — localized court only!
      v.box(2, 0, 1, bx - 1, 1, bz - 1, "terracotta");
      v.box(bx - 2, 1, Math.min(bz - 2, 3), bx - 1, 4, Math.min(bz - 1, 4), "white"); // hoop stanchion
      v.put(bx - 2, 3, Math.min(bz - 2, 3), "orange");
      // Square Collegiate Brick & Limestone Bell/Clock Tower on (+X, -Z) — ZERO spiral!
      const tx = Math.max(4, bx - 3);
      const tz = -Math.max(2, bz - 3);
      addSquareClockTower(v, tx, tz, 0, lowH + 5 + clampedLv * 2, 2, "brickDark", "limestone", "slate");
      if (clampedLv >= 2) {
        // Copper-domed circular library rotunda rising above the classroom wing
        v.cylinderY(-Math.max(3, Math.floor(bx * 0.5)), 0, lowH + 1, lowH + 4, 2.4, "limestone");
        v.dome(-Math.max(3, Math.floor(bx * 0.5)), lowH + 4, 0, 2.5, "copper");
      }
      if (clampedLv >= 3 && bz >= 9) {
        // Vaulted gymnasium hall & glazed skybridge at Lv.3-5!
        v.hollowBox(1, 0, -bz + 1, tx - 2, lowH - 1, 0, "limestone", "brick");
        v.box(0, lowH - 2, -2, tx - 1, lowH, 0, "glass", 0.68);
      }
      break;
    }

    case "little_parks": {
      // Cozy 1x1 Pocket Green Directly on Island Grass: Stepping Stones, Cherry Blossom Tree, Bench, Lamp & Rose Arch!
      for (let i = -padX + 2; i < padX - 2; i += 2) {
        v.box(i, 0, i, i + 2, 1, i + 2, "stone");
      }
      addTreeMini(v, -padX + 2, 0, -padZ + 2, 1);
      v.box(1, 0, 1, 4, 1, 2, "oak"); // oak park bench
      v.box(-3, 0, 2, -2, 4, 3, "iron"); // vintage iron streetlamp
      v.put(-3, 4, 2, "warmGlow", 1.15);
      // Timber floral arbor arch at entrance
      v.box(-2, 0, padZ - 2, -1, 4 + Math.min(2, clampedLv), padZ - 1, "wood");
      v.box(2, 0, padZ - 2, 3, 4 + Math.min(2, clampedLv), padZ - 1, "wood");
      v.box(-2, 4 + Math.min(2, clampedLv), padZ - 2, 3, 5 + Math.min(2, clampedLv), padZ - 1, "pink");
      break;
    }

    case "park": {
      // Town Park Directly on Natural Grass (NO full-tile slab!): Gravel Paths, Duck Pond, Footbridge, Trees & Gazebo!
      v.box(-1, 0, -padZ + 1, 1, 1, padZ - 1, "path");
      v.box(-padX + 1, 0, -1, padX - 1, 1, 1, "path");
      // Organic stone-edged duck pond in SW quadrant
      v.cylinderY(-Math.max(3, Math.floor(padX * 0.45)), Math.max(3, Math.floor(padZ * 0.45)), 0, 1, 3.0, "water", 0.35);
      v.box(-3, 1, 0, -1, 2, 2, "wood"); // arched wooden bridge
      addTreeMini(v, -padX + 2, 0, -padZ + 2, 0);
      addTreeMini(v, padX - 3, 0, -padZ + 2, 2);
      // Octagonal marble & teal bandstand gazebo in SE quadrant
      const gx = Math.min(4, padX - 3);
      const gz = Math.min(4, padZ - 3);
      v.cylinderY(gx, gz, 0, 1, 2.5, "marble");
      for (const [px, pz] of [[gx - 1, gz - 1], [gx + 1, gz - 1], [gx - 1, gz + 1], [gx + 1, gz + 1]]) {
        v.box(px, 1, pz, px + 1, 4 + Math.min(2, clampedLv), pz + 1, "white");
      }
      v.cone(gx, 4 + Math.min(2, clampedLv), 7 + Math.min(3, clampedLv), gz, 2.9, 0.5, "teal");
      v.put(gx, 7 + Math.min(3, clampedLv), gz, "gold", 0.9);
      break;
    }

    case "gardens": {
      // Victorian Botanical Conservatory Dome + Trimmed Flower Parterres Directly on Grass!
      for (const [fx, fz] of [
        [-5, -5],
        [2, -5],
        [-5, 2],
        [2, 2],
      ]) {
        v.box(fx, 0, fz, fx + 3, 1, fz + 3, "leafDark");
        v.put(fx + 1, 1, fz + 1, clampedVar % 2 === 0 ? "pink" : "yellow");
        v.put(fx + 2, 1, fz + 2, "magenta");
      }
      v.cylinderY(0, 0, 0, 1 + Math.min(2, clampedLv - 1), 3.3, "white");
      v.dome(0, 1 + Math.min(2, clampedLv - 1), 0, 3.4, "glass", 0.72);
      v.put(0, 4 + Math.min(2, clampedLv - 1), 0, "copper");
      break;
    }

    case "italian_gardens": {
      // Formal Renaissance Boxwood Parterres + Gravel Cross-Walks + Tall Tuscan Cypresses + Tiered Marble Fountain!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 0, -1, bx, 1, 1, "path");
      v.box(-1, 0, -bz, 1, 1, bz, "path");
      v.box(-bx + 1, 0, -bz + 1, -2, 2, -2, "leafDark");
      v.box(2, 0, -bz + 1, bx - 1, 2, -2, "leafDark");
      v.box(-bx + 1, 0, 2, -2, 2, bz - 1, "leafDark");
      v.box(2, 0, 2, bx - 1, 2, bz - 1, "leafDark");
      addCypressMini(v, -bx + 1, 0, -bz + 1, 8 + clampedLv);
      addCypressMini(v, bx - 2, 0, -bz + 1, 8 + clampedLv);
      addCypressMini(v, -bx + 1, 0, bz - 2, 7 + clampedLv);
      addCypressMini(v, bx - 2, 0, bz - 2, 7 + clampedLv);
      v.cylinderY(0, 0, 0, 2 + Math.min(2, clampedLv - 1), 2.5, "marble");
      v.sphere(0, 3 + Math.min(2, clampedLv - 1), 0, 1.5, 1.6, 1.5, "cyan", 0.75);
      break;
    }

    case "large_parks": {
      // Grand City Park Directly on Grass: Scenic Winding Lake + Wooden Bridge + Groves + Classical Belvedere Pavilion (ZERO spiral!)
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.box(-bx + 2, 0, -1, bx - 2, 1, 1, "path");
      // Organic dual-lobe lake on -X
      v.cylinderY(-Math.floor(bx * 0.45), -2, 0, 1, 3.8, "water", 0.3);
      v.cylinderY(-Math.floor(bx * 0.35), 2, 0, 1, 3.4, "water", 0.3);
      v.box(-Math.floor(bx * 0.5), 1, -1, -Math.floor(bx * 0.25), 2, 1, "wood"); // scenic bridge
      addTreeMini(v, bx - 3, 0, -bz + 2, 0);
      addTreeMini(v, bx - 3, 0, bz - 3, 1);
      addTreeMini(v, -bx + 2, 0, bz - 3, 2);
      // Classical marble & copper-roofed Park Belvedere Rotunda on +X
      const gx = Math.min(4, bx - 4);
      v.cylinderY(gx, 0, 0, 2, 3.5, "marble");
      for (const [px, pz] of [[gx - 2, -2], [gx + 2, -2], [gx - 2, 2], [gx + 2, 2]]) {
        v.box(px, 2, pz, px + 1, 5 + Math.min(2, clampedLv), pz + 1, "white");
      }
      v.dome(gx, 5 + Math.min(2, clampedLv), 0, 3.6, "copper");
      if (clampedLv >= 3) {
        // Timber & stone Park Ranger Lookout Gazebo in NW corner (square hipped pavilion, NO spiral!)
        v.hollowBox(-bx + 2, 0, -bz + 2, -bx + 6, 5 + clampedLv, -bz + 6, "stone", "woodDark");
        addHippedRoofSafe(v, -bx + 1, 5 + clampedLv, -bz + 1, -bx + 7, -bz + 7, 4, "woodDark", "woodLight");
      }
      break;
    }

    case "city_offices": {
      // L-Shaped Municipal Brick & Limestone Town Hall + Columned Portico + Square Clock & Belfry Tower (ZERO spiral!)
      const lowH = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, 2, lowH, bz - 1, "brick", "limestone");
      addWindowGrid(v, -bx, 1, -bz + 1, 2, lowH, bz - 1, 2, 0.48, "warmGlow");
      addHippedRoofSafe(v, -bx, lowH, -bz + 1, 2, bz - 1, 3, "blueDark", "limestone");
      // Limestone council wing on +X
      v.hollowBox(2, 0, -bz + 1, bx, Math.max(4, lowH - 1), 1, "limestone", "white");
      addSquareClockTower(v, bx - 3, Math.max(1, bz - 3), 0, lowH + 5 + clampedLv * 2, 2, "limestone", "white", "blueDark");
      break;
    }

    case "post_offices": {
      // Beaux-Arts Cream & Navy Post Office + Columned Customer Rotunda + Blue Mailboxes & Mail Van!
      const lowH = 4 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx, lowH, 1, "cream", "white");
      addWindowGrid(v, -bx, 1, -bz + 1, bx, lowH, 1, 2, 0.48);
      const rotR = Math.min(3.5, bx - 1);
      v.cylinderY(0, 1, 0, 3 + lowH + clampedLv, rotR, "white");
      v.dome(0, 3 + lowH + clampedLv, 1, rotR, "blueDark");
      v.put(0, Math.round(3 + lowH + clampedLv + rotR), 1, "gold", 1.0);
      // Iconic blue mail dropboxes out front
      v.box(-3, 0, bz - 2, -2, 2, bz - 1, "blue");
      v.box(2, 0, bz - 2, 3, 2, bz - 1, "blue");
      if (bx >= 9) {
        // White & blue postal delivery van parked in sorting bay!
        v.box(bx - 4, 0, 2, bx - 1, 3, 5, "white");
        v.box(bx - 4, 1, 2, bx - 1, 2, 5, "blue");
      }
      break;
    }

    case "tax_collecting_office": {
      // Stepped Neoclassical Limestone & Brass Treasury Hall + Fluted Columns + Golden Rotunda Dome (fills 2x1 cleanly!)
      const lowH = 5 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx, lowH, bz - 1, "limestone", "marble");
      addWindowGrid(v, -bx, 1, -bz + 1, bx, lowH, bz - 1, 2, 0.5, "warmGlow");
      for (let x = -bx + 2; x <= bx - 3; x += 3) {
        v.box(x, 0, bz - 1, x + 1, lowH, bz, "brass");
      }
      addHippedRoofSafe(v, -bx, lowH, -bz + 1, bx, bz - 1, 2, "slate", "brass");
      const rotR = Math.min(4.0, bz - 1);
      v.cylinderY(0, 0, lowH, lowH + 3 + clampedLv, rotR, "marble");
      v.dome(0, lowH + 3 + clampedLv, 0, rotR + 0.2, "gold");
      v.put(0, Math.round(lowH + 3 + clampedLv + rotR), 0, "amber", 1.2);
      break;
    }

    case "fire_department": {
      // Multi-Bay Crimson Brick Firehouse + Red Fire Engine Cab + Square Brick Hose-Drying & Siren Tower (ZERO spiral!)
      const lowH = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx - 3, lowH, bz - 1, "crimson", "white");
      addWindowGrid(v, -bx, 3, -bz + 1, bx - 3, lowH, bz - 1, 2, 0.5, "warmGlow");
      // Glazed white apparatus bay doors + red fire engine nose with flashing lightbar!
      v.box(-bx + 2, 0, bz - 2, -2, 3, bz - 1, "white");
      v.box(0, 0, bz - 2, bx - 4, 3, bz - 1, "white");
      v.box(-bx + 3, 0, bz - 1, -3, 3, bz + 1, "red");
      v.put(-bx + 4, 3, bz, "white", 1.3);
      v.put(-4, 3, bz, "red", 1.3);
      addHippedRoofSafe(v, -bx, lowH, -bz + 1, bx - 3, bz - 1, 2, "slate", "white");
      // Authentic square dark-brick Hose-Drying & Bell Tower on +X/-Z!
      const th = lowH + 5 + clampedLv * 2;
      v.hollowBox(bx - 4, 0, -bz + 1, bx, th, -bz + 5, "brickDark", "limestone");
      v.box(bx - 3, th - 2, -bz + 1, bx - 1, th, -bz + 5, "charcoal"); // belfry siren louvers
      addHippedRoofSafe(v, bx - 4, th, -bz + 1, bx, -bz + 5, 3, "crimson", "brass");
      v.put(bx - 2, th + 3, -bz + 3, "red", 1.25);
      break;
    }

    case "community_centers": {
      // Warm Cedar & Teal Glazed Civic Recreation Pavilion + Outdoor Basketball Court + Skylight Lantern (ZERO spiral!)
      const lowH = 5 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, 1, lowH, bz - 1, "teal", "woodLight");
      v.box(-bx + 1, 1, bz - 2, 0, lowH - 1, bz - 1, "glass", 0.68);
      addGableSafe(v, -bx - 1, lowH, -bz + 1, 2, bz - 1, 3, "z", "woodLight", "white");
      // Rooftop glazed skylight monitor
      v.box(-Math.floor(bx * 0.6), lowH + 2, -3, -2, lowH + 4, 3, "glass", 0.75);
      // Outdoor terracotta sport court & hoop on +X
      v.box(2, 0, -bz + 2, bx - 1, 1, bz - 2, "terracotta");
      v.box(bx - 2, 1, -1, bx - 1, 5, 1, "white");
      v.put(bx - 2, 4, 0, "orange");
      break;
    }

    case "courthouses": {
      // Classical U-Shaped White Marble Hall of Justice + Greek Pediment Portico + Golden Rotunda Dome!
      const wingH = 6 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx, wingH, 0, "marble", "marbleShade");
      v.hollowBox(-bx, 0, 0, -bx + 4, Math.max(4, wingH - 1), bz - 1, "marble", "marbleShade");
      v.hollowBox(bx - 4, 0, 0, bx, Math.max(4, wingH - 1), bz - 1, "marble", "marbleShade");
      addWindowGrid(v, -bx, 1, -bz + 1, bx, wingH, 0, 2, 0.48);
      for (let x = -bx + 4; x <= bx - 5; x += 2) {
        v.box(x, 0, 0, x + 1, wingH, 1, "white");
      }
      addGableSafe(v, -5, wingH, -1, 5, 2, 3, "x", "marbleShade", "gold");
      const drumH = wingH + 4 + clampedLv * 2;
      v.cylinderY(0, -3, wingH, drumH, 3.6, "white");
      v.dome(0, drumH, -3, 3.7, "gold");
      break;
    }

    case "government_buildings": {
      // Monumental Capitol Complex: Legislative Wings + Marble Steps + Tiered Capitol Rotunda Dome + 4 Square Corner Cupolas (ZERO spiral!)
      const wingH = 6 + clampedLv;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 2, bx, wingH, bz - 2, "limestone", "marble");
      addWindowGrid(v, -bx, 1, -bz + 2, bx, wingH, bz - 2, 2, 0.5);
      addGableSafe(v, -bx, wingH, -bz + 2, -4, bz - 2, 3, "z", "slate", "marble");
      addGableSafe(v, 4, wingH, -bz + 2, bx, bz - 2, 3, "z", "slate", "marble");
      // Grand front marble staircase & portico
      v.box(-4, 0, bz - 2, 4, 2, bz, "marble");
      addGableSafe(v, -5, wingH, bz - 3, 5, bz - 1, 3, "x", "marble", "gold");
      // Soaring central multi-tier Capitol Rotunda & White Dome!
      const drumTop = wingH + 5 + clampedLv * 2;
      v.cylinderY(0, 0, wingH, drumTop, 4.5, "marble");
      v.dome(0, drumTop, 0, 4.6, "white");
      v.box(0, drumTop + 4, 0, 1, drumTop + 7, 1, "gold", 1.15);
      if (clampedLv >= 3) {
        // Classical square domed corner cupolas!
        for (const cx of [-bx + 3, bx - 3]) {
          v.hollowBox(cx - 2, wingH, -2, cx + 2, wingH + 4, 2, "marble", "gold");
          v.dome(cx, wingH + 4, 0, 2.2, "gold");
        }
      }
      break;
    }

    // --------------------- POLICE & MILITARY (9 — Ground/Water-Anchored, Zero Spiral Towers!) ---------------------
    case "police_precinct": {
      // Slate & Navy Police Precinct + Illuminated Blue Canopy + Cruiser Garage + Lattice Radio Mast (ZERO spiral!)
      const lowH = 5 + clampedLv;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, 2, lowH, bz - 1, "slateLight", "blueDark");
      addWindowGrid(v, -bx, 1, -bz + 1, 2, lowH, bz - 1, 2, 0.52, "sky");
      v.box(-bx, lowH, -bz + 1, 2, lowH + 1, bz - 1, "blueDark");
      v.box(-3, 2, bz - 1, 1, 3, bz, "sky", 1.1); // glowing blue precinct sign
      // Dispatch garage wing + parked black-and-white police cruiser with red/blue lightbar!
      v.hollowBox(2, 0, -bz + 1, bx, Math.max(4, lowH - 2), 0, "blueDark", "white");
      v.box(3, 0, 1, bx - 1, 2, 4, "blueDark");
      v.box(4, 1, 1, bx - 2, 2, 4, "white");
      v.put(5, 2, 2, "red", 1.3);
      v.put(6, 2, 2, "sky", 1.3);
      addLatticeMast(v, -bx + 3, -bz + 3, lowH + 1, 5 + clampedLv, "steelLight", "sky");
      break;
    }

    case "police_departments": {
      // Twin-Wing Glass & Navy Metro Police HQ + Central Command Rotunda + Helipad + Lattice Comms Spire!
      const lowH = 6 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, -1, lowH, bz - 2, "blueDark", "steelLight");
      v.hollowBox(1, 0, -bz + 1, bx, Math.max(5, lowH - 1), bz - 2, "slate", "sky");
      addWindowGrid(v, -bx, 1, -bz + 1, -1, lowH, bz - 2, 2, 0.55, "sky");
      addWindowGrid(v, 1, 1, -bz + 1, bx, Math.max(5, lowH - 1), bz - 2, 2, 0.5, "sky");
      const rotH = lowH + 3 + clampedLv;
      v.cylinderY(0, -1, 0, rotH, 3.2, "steelLight");
      v.dome(0, rotH, -1, 3.3, "sky");
      if (clampedLv >= 3) {
        // Rooftop police chopper helipad on +X wing
        v.box(3, Math.max(5, lowH - 1), -4, bx - 1, Math.max(5, lowH - 1) + 1, 2, "asphaltDark");
        v.box(5, Math.max(5, lowH - 1) + 1, -2, 7, Math.max(5, lowH - 1) + 2, 0, "busYellow");
      }
      addLatticeMast(v, -bx + 3, -bz + 3, lowH, 6 + clampedLv, "steel", "red");
      break;
    }

    case "jails": {
      // Rusticated Granite Detention House + Sally-Port Gate + Square Guard Watchtower with Searchlight (ZERO spiral!)
      const h = 5 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, Math.max(2, bx - 3), h, bz - 1, "granite", "concreteDark");
      addWindowGrid(v, -bx, 2, -bz + 1, Math.max(2, bx - 3), h, bz - 1, 3, 0.35, "warmGlow");
      v.box(-bx, h, -bz + 1, Math.max(2, bx - 3), h + 1, bz - 1, "iron");
      // Square concrete corner guard watchtower with overhanging cab & amber searchlight!
      const twX0 = bx - 3;
      const twH = h + 4 + clampedLv;
      v.hollowBox(twX0, 0, -bz + 1, bx, twH, -bz + 5, "concreteDark", "iron");
      v.box(twX0 - 1, twH, -bz, bx + 1, twH + 2, -bz + 6, "slate");
      v.put(bx - 1, twH + 2, -bz + 3, "amber", 1.3);
      break;
    }

    case "prisons": {
      // Fortified Granite Penitentiary: Perimeter Walls + 4 Square Guard Towers + Cruciform Cellblocks + Square Central Watchtower (ZERO spiral!)
      const h = 5 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Low perimeter security wall
      v.hollowBox(-bx, 0, -bz, bx, 3, bz, "concreteDark");
      v.clear(-bx + 1, 0, -bz + 1, bx - 1, 3, bz - 1);
      // 4 square corner guard watchtowers with searchlights
      for (const [wx, wz] of [
        [-bx, -bz],
        [bx - 3, -bz],
        [-bx, bz - 3],
        [bx - 3, bz - 3],
      ]) {
        v.hollowBox(wx, 0, wz, wx + 3, h + 4, wz + 3, "concreteDark", "iron");
        addHippedRoofSafe(v, wx, h + 4, wz, wx + 3, wz + 3, 2, "slate");
        v.put(wx + 1, h + 6, wz + 1, "amber", 1.25);
      }
      // Cruciform granite cellblock wings with pitched slate roofs
      v.hollowBox(-bx + 2, 0, -3, bx - 2, h, 3, "granite", "iron");
      v.hollowBox(-3, 0, -bz + 2, 3, h, bz - 2, "granite", "iron");
      addGableSafe(v, -bx + 2, h, -3, bx - 2, 3, 2, "x", "slate");
      addGableSafe(v, -3, h, -bz + 2, 3, bz - 2, 2, "z", "slate");
      // Square central Panopticon Lantern Tower!
      v.hollowBox(-2, h + 1, -2, 2, h + 5 + clampedLv, 2, "iron", "granite");
      addHippedRoofSafe(v, -3, h + 5 + clampedLv, -3, 3, 3, 3, "slate", "amber");
      break;
    }

    case "swat_team_hq": {
      // Stealth-Charcoal Tactical HQ + Armored APC Bay + Black Bearcat Van + Elevated Helipad + Lattice Radar Mast (ZERO spiral!)
      const lowH = 5 + clampedLv;
      const tallH = lowH + 4 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx - 1, lowH, 0, "charcoal", "steelDark");
      addWindowGrid(v, -bx, 1, -bz + 1, bx - 1, lowH, 0, 2, 0.6, "screenCyan");
      // Detailed black armored SWAT Bearcat APC in forecourt
      v.box(2, 0, 2, 7, 3, 6, "black");
      v.box(5, 2, 2, 7, 3, 6, "glass", 0.6);
      v.put(4, 3, 3, "red", 1.3);
      v.put(4, 3, 5, "sky", 1.3);
      // Elevated octagonal concrete Helipad Tower on (-X, +Z)
      v.cylinderY(-4, 3, 0, tallH, 4.2, "slate");
      v.box(-7, tallH, 0, -1, tallH + 1, 6, "asphaltDark");
      v.box(-6, tallH + 1, 1, -5, tallH + 2, 5, "busYellow");
      v.box(-3, tallH + 1, 1, -2, tallH + 2, 5, "busYellow");
      v.box(-5, tallH + 1, 3, -3, tallH + 2, 4, "busYellow");
      addLatticeMast(v, bx - 3, -bz + 3, lowH, 6 + clampedLv, "steelDark", "red");
      break;
    }

    case "military_base": {
      // Fortified Army Command Compound (ground-flush!): Sandbag Perimeter, Quonset Barracks, HQ Bunker, Tanks & Spinning Radar!
      const h = 5 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Perimeter sandbag/olive-drab bastions + checkpoint gate posts at front
      v.box(-bx, 0, bz - 1, -3, 2, bz, "camoTan");
      v.box(3, 0, bz - 1, bx, 2, bz, "camoTan");
      v.box(-3, 0, bz - 1, -2, 4, bz, "oliveDrab");
      v.box(2, 0, bz - 1, 3, 4, bz, "oliveDrab");
      // Octagonal Armored Command Bunker in NW quadrant
      v.cylinderY(-Math.floor(bx * 0.45), -Math.floor(bz * 0.4), 0, h + 1, 4.0, "oliveDrab");
      v.dome(-Math.floor(bx * 0.45), h + 1, -Math.floor(bz * 0.4), 4.0, "camoTan");
      // Twin arched Quonset Hut barracks in SW quadrant
      v.hollowBox(-bx + 1, 0, 1, -1, 4, Math.max(5, bz - 2), "oliveDrab", "camoTan");
      addGableSafe(v, -bx + 1, 4, 1, -1, Math.max(5, bz - 2), 2, "x", "camoTan", "oliveDrab");
      // Detailed Main Battle Tank(s) in SE motor pool (tracks, hull, turret & long gun barrel!)
      v.box(2, 0, 1, 7, 1, 5, "charcoal");
      v.box(2, 1, 1, 7, 2, 5, "oliveDrab");
      v.box(3, 2, 2, 6, 3, 4, "camoTan");
      v.box(4, 2, 4, 5, 3, 8, "steelDark");
      if (clampedLv >= 3 && bx >= 12) {
        v.box(8, 0, 1, 12, 2, 5, "oliveDrab");
        v.box(9, 2, 2, 11, 3, 4, "camoTan");
        v.box(10, 2, 4, 11, 3, 8, "steelDark");
      }
      // Spinning lattice radar tower in NE quadrant
      const radTop = h + 6 + clampedLv;
      addLatticeMast(v, bx - 3, -bz + 3, 0, radTop, "steel", "red");
      rotorVox = new PixelVox(950 + clampedVar);
      rotorVox.box(-3, 0, 0, 3, 2, 1, "silver");
      rotorPivot = [bx - 3, radTop + 1, -bz + 3];
      rotorAxis = "y";
      rotorSpeed = 1.9;
      break;
    }

    case "airforce_base": {
      // Asphalt Runway Strip + Twin Arched Steel Hangars + Flared 360-Glass ATC Control Tower + Swept-Wing Fighter Jets (ZERO spiral!)
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Active runway strip along +Z half (y = 0..1)
      v.box(-bx, 0, 1, bx, 1, bz, "asphaltDark");
      for (let x = -bx + 2; x < bx - 2; x += 4) {
        v.box(x, 0, Math.floor((1 + bz) * 0.5), x + 2, 1, Math.floor((1 + bz) * 0.5) + 1, "white");
      }
      // Twin arched steel aircraft hangars on -Z
      v.hollowBox(-bx + 1, 0, -bz + 1, 2, 5 + clampedLv, -1, "steelLight", "slate");
      addGableSafe(v, -bx + 1, 5 + clampedLv, -bz + 1, 2, -1, 3, "x", "slate", "silver");
      // Authentic Flared Concrete & 360-Degree Glass Air Traffic Control (ATC) Tower on (+X, -Z)!
      const atcH = 10 + clampedLv * 2;
      v.cone(6, 0, atcH - 3, -bz + 4, 2.4, 1.5, "concrete");
      v.box(3, atcH - 3, -bz + 1, 9, atcH, -bz + 7, "glass", 0.8);
      v.box(3, atcH, -bz + 1, 9, atcH + 1, -bz + 7, "white");
      v.put(6, atcH + 2, -bz + 4, "screenCyan", 1.25);
      // Detailed swept-wing silver jet fighter(s) on runway!
      const jetXs = clampedLv >= 3 ? [-8, 1] : [-5];
      for (const jx of jetXs) {
        v.box(jx, 1, 3, jx + 6, 2, 5, "silver"); // fuselage
        v.box(jx + 1, 1, 1, jx + 4, 2, 7, "steel"); // delta wings
        v.box(jx + 4, 2, 3, jx + 6, 3, 5, "screenCyan", 0.7); // canopy
        v.put(jx, 2, 3, "slate"); // twin tailfins
        v.put(jx, 2, 5, "slate");
      }
      break;
    }

    case "naval_base": {
      // Deep Concrete Naval Pier (y = -3..2, NO fake water slab!) + Admiralty HQ + Lattice Radar + Moored Warship Hull!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Heavy concrete naval mole anchored down to y = -3 on landward -Z side
      v.box(-bx, -3, -bz, bx, 2, -1, "concreteDark");
      v.box(-2, -3, -1, 2, 2, bz - 1, "concrete"); // finger jetty extending into ocean
      // Admiralty Fleet Command HQ + open steel radar mast on mole
      const hqH = 6 + clampedLv;
      v.hollowBox(-bx + 1, 2, -bz + 1, 1, 2 + hqH, -2, "steel", "blueDark");
      addWindowGrid(v, -bx + 1, 3, -bz + 1, 1, 2 + hqH, -2, 2, 0.55, "screenCyan");
      addLatticeMast(v, bx - 3, -bz + 3, 2, 8 + clampedLv * 2, "steelLight", "screenCyan");
      // Sculpted grey naval patrol/destroyer bow moored beside the finger jetty in the ocean (+X, +Z)!
      for (let z = 0; z <= bz - 1; z++) {
        const t = z / Math.max(1, bz - 1);
        const hw = Math.max(0, Math.round(2.5 * (1 - t * 0.75)));
        v.box(5 - hw, -1, z, 6 + hw, 1, z + 1, "crimson");
        v.box(5 - hw, 1, z, 6 + hw, 3, z + 1, "steel");
      }
      v.box(4, 3, 2, 7, 6, 5, "steelLight"); // warship bridge
      v.box(5, 3, bz - 3, 6, 4, bz - 1, "charcoal"); // foredeck gun
      break;
    }

    case "submarine_base": {
      // Blast-Hardened Concrete U-Boat Wet-Dock Bunker (y = -3..9, NO fake water slab!) + Dark Vaulted Sub Caverns + Docked Black Submarines!
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const penH = 7 + clampedLv;
      // Massive reinforced-concrete submarine bunker anchored down to y = -3 on -Z half
      v.box(-bx, -3, -bz, bx, penH, 2, "concreteDark");
      v.box(-bx, penH, -bz, bx, penH + 2, 2, "granite"); // thick bomb-proof roof slab
      // Carve 2 deep dark wet-dock caverns opening onto the sea (+Z)
      v.clear(-9, -2, -bz + 3, -3, penH - 2, 3);
      v.clear(3, -2, -bz + 3, 9, penH - 2, 3);
      // Sculpted rounded black submarines emerging from the wet-dock pens!
      for (const sx of [-6, 6]) {
        for (let z = -3; z <= bz - 2; z++) {
          const t = (z + 3) / Math.max(1, bz + 1);
          const hw = t > 0.75 ? 1 : 2;
          v.box(sx - hw, -1, z, sx + hw, 2, z + 1, "charcoal");
        }
        v.box(sx - 1, 2, 1, sx + 1, 5, 4, "black"); // conning sail
        v.put(sx, 5, 2, "brass"); // periscope
      }
      // Rooftop sonar radome & lattice comms mast
      v.dome(-bx + 4, penH + 2, -bz + 4, 2.6, "screenCyan");
      addLatticeMast(v, bx - 4, -bz + 4, penH + 2, 6 + clampedLv, "iron", "red");
      break;
    }

    // --------------------- FAITH & HERITAGE (8 — Ground-Flush, Sculptural, Zero Spiral Towers!) ---------------------
    case "churches": {
      // Classic Parish Church (1x2 -> 2x2): Elongated Nave, Stained-Glass Lancets, Steep Gable Roof & Tall Gothic Bell Steeple!
      const h = 5 + clampedLv;
      const bx = Math.max(5, Math.min(8, padX - 1));
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, bx, h, bz - 2, st.wall, st.trim);
      addWindowGrid(v, -bx, 2, -bz + 1, bx, h, bz - 2, 3, 0.65, "warmGlow");
      addGableSafe(v, -bx - 1, h, -bz + 1, bx + 1, bz - 2, 4, "z", st.roof, st.trim);
      v.box(-1, 0, bz - 3, 1, 3, bz - 1, "woodDark"); // arched oak portal
      addGothicSteeple(v, 0, bz - 3, h, 4 + clampedLv, 5 + clampedLv, "white", st.trim, st.roof);
      break;
    }

    case "christian_churches": {
      // Soaring Cruciform Twin-Spire Gothic Cathedral: Nave, Transepts, Flying Buttresses, Rose Window & Twin Gothic Bell Towers!
      const h = 7 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      const naveW = Math.max(4, bx - 3);
      // Cruciform limestone nave + wide transept arms at y = 0
      v.hollowBox(-naveW, 0, -bz + 1, naveW, h, bz - 1, "limestone", "marble");
      v.hollowBox(-bx, 0, -3, bx, Math.max(5, h - 2), 3, "limestone", "marble");
      addWindowGrid(v, -naveW, 2, -bz + 1, naveW, h, bz - 1, 3, 0.7, "magenta");
      // Exterior stone buttress piers along nave walls
      for (let z = -bz + 3; z < bz - 4; z += 4) {
        v.box(-naveW - 1, 0, z, -naveW, h - 2, z + 1, "marbleShade");
        v.box(naveW, 0, z, naveW + 1, h - 2, z + 1, "marbleShade");
      }
      addGableSafe(v, -naveW, h, -bz + 1, naveW, bz - 1, 4, "z", "slate", "marble");
      addGableSafe(v, -bx, Math.max(5, h - 2), -3, bx, 3, 3, "x", "slate", "marble");
      // Glowing West Rose Window + arched portals
      v.box(-2, Math.floor(h * 0.55), bz - 2, 2, Math.floor(h * 0.55) + 3, bz - 1, "magenta", 1.25);
      v.box(-1, 0, bz - 2, 1, 4, bz - 1, "woodDark");
      // Twin soaring West Facade Gothic Steeples!
      for (const sx of [-naveW + 1, naveW - 1]) {
        addGothicSteeple(v, sx, bz - 3, 0, h + 4 + clampedLv, 6 + clampedLv, "marble", "limestone", "slate");
      }
      if (clampedLv >= 3) {
        // Central copper crossing flèche spire!
        v.cone(0, h + 3, h + 10 + clampedLv, 0, 1.5, 0.3, "copper");
      }
      break;
    }

    case "monasteries": {
      // Cloistered Terracotta-Roofed Abbey Quadrangle + Lush Herb Courtyard & Well + Square Romanesque Bell Campanile (ZERO spiral!)
      const h = 5 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // 4 enclosed plaster cloister wings with pitched terracotta gable roofs (NO open-top bathtub!)
      v.hollowBox(-bx, 0, -bz, bx, h, -bz + 4, "plaster", "limestone");
      addGableSafe(v, -bx, h, -bz, bx, -bz + 4, 2, "x", "terracotta", "cream");
      v.hollowBox(-bx, 0, bz - 4, bx, h - 1, bz, "plaster", "limestone");
      addGableSafe(v, -bx, h - 1, bz - 4, bx, bz, 2, "x", "terracotta", "cream");
      v.hollowBox(-bx, 0, -bz + 4, -bx + 4, h, bz - 4, "plaster", "limestone");
      addGableSafe(v, -bx, h, -bz + 4, -bx + 4, bz - 4, 2, "z", "terracotta", "cream");
      v.hollowBox(bx - 4, 0, -bz + 4, bx, h, bz - 4, "plaster", "limestone");
      addGableSafe(v, bx - 4, h, -bz + 4, bx, bz - 4, 2, "z", "terracotta", "cream");
      // Lush cloister herb garden + stone well in open central garth
      v.box(-4, 0, -4, 4, 1, 4, "leafLight");
      v.cylinderY(0, 0, 1, 3, 1.4, "marble");
      addCypressMini(v, -3, 1, -3, 6);
      // Square Romanesque brick-and-stone Bell Campanile on NE corner!
      addSquareClockTower(v, bx - 2, -bz + 2, h, 7 + clampedLv * 2, 2, "terracotta", "cream", "brickDark");
      break;
    }

    case "mosques": {
      // Grand Ottoman Imperial Mosque: Arched Sandstone Sanctuary + Cascading Teal Central & Semi-Domes + 4 Balconied Stone Minarets!
      const h = 6 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Carved cream & sandstone prayer hall with glowing arched windows & teal-tiled entrance Pishtaq iwan!
      v.hollowBox(-bx + 2, 0, -bz + 2, bx - 2, h, bz - 2, "cream", "sandDark");
      addWindowGrid(v, -bx + 2, 2, -bz + 2, bx - 2, h, bz - 2, 3, 0.6, "warmGlow");
      v.box(-3, 0, bz - 3, 3, h + 1, bz - 1, "teal");
      v.box(-1, 0, bz - 2, 1, 4, bz - 1, "gold", 0.85);
      // Raised octagonal drum + cascading central turquoise dome & 4 flanking semi-domes!
      v.cylinderY(0, 0, h, h + 2, 4.8, "marble");
      v.dome(0, h + 2, 0, 4.9, "teal");
      v.dome(-4, h, 0, 2.5, "sky");
      v.dome(4, h, 0, 2.5, "sky");
      v.dome(0, h, -4, 2.5, "sky");
      v.box(0, h + 7, 0, 1, h + 9, 1, "gold", 1.2); // golden crescent finial
      // 4 substantial tapered marble minarets with carved muezzin sherefe balconies!
      const mh = h + 8 + clampedLv * 2;
      for (const [mx, mz] of [
        [-bx + 1.5, -bz + 1.5],
        [bx - 1.5, -bz + 1.5],
        [-bx + 1.5, bz - 1.5],
        [bx - 1.5, bz - 1.5],
      ]) {
        v.cone(mx, 0, mh, mz, 1.6, 1.05, "marble");
        v.cylinderY(mx, mz, Math.floor(mh * 0.68), Math.floor(mh * 0.68) + 1, 1.7, "gold");
        v.cone(mx, mh, mh + 4, mz, 1.3, 0.3, "teal");
        v.put(Math.round(mx), mh + 4, Math.round(mz), "gold", 1.1);
      }
      break;
    }

    case "synagogues": {
      // Sculptural Jerusalem-Stone Octagonal Sanctuary + Azure Central Dome + Twin Copper Lantern Turrets (ZERO spiral!)
      const h = 6 + clampedLv;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      v.hollowBox(-bx + 2, 0, -bz + 1, bx - 2, h, bz - 1, "limestone", "cream");
      v.hollowBox(-bx + 1, 0, -bz + 3, bx - 1, Math.max(4, h - 1), bz - 3, "cream", "gold");
      addWindowGrid(v, -bx + 2, 2, -bz + 1, bx - 2, h, bz - 1, 2, 0.65, "sky");
      v.dome(0, h, 0, 4.4, "blue");
      v.put(0, h + 5, 0, "gold", 1.15);
      // Twin octagonal Jerusalem-stone front lantern towers with copper domes!
      for (const tx of [-bx + 3, bx - 3]) {
        v.cylinderY(tx, bz - 3, 0, h + 3 + clampedLv, 2.0, "limestone");
        v.dome(tx, h + 3 + clampedLv, bz - 3, 2.1, "copper");
      }
      break;
    }

    case "temples": {
      // Multi-Tiered East Asian Curved-Eave Crimson, Dark-Timber & Cream Pagoda on Carved Stone Terrace!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // Carved stone podium base + front stairs (centered, not full-tile slab!)
      v.box(-bx + 1, 0, -bz + 1, bx - 1, 2, bz - 1, "stone");
      v.box(-2, 0, bz - 1, 2, 2, bz + 1, "limestone");
      const tiers = Math.min(5, 2 + clampedLv);
      let curY = 2;
      for (let t = 0; t < tiers; t++) {
        const w = Math.max(2, bx - 2 - t * 2);
        const d = Math.max(2, bz - 2 - t * 2);
        v.hollowBox(-w, curY, -d, w, curY + 3, d, "cream", "woodDark");
        v.box(-w - 1, curY + 3, -d - 1, w + 1, curY + 4, d + 1, "crimson");
        // Upturned East Asian corner eave tips!
        for (const [ex, ez] of [[-w - 1, -d - 1], [w, -d - 1], [-w - 1, d], [w, d]]) {
          v.put(ex, curY + 4, ez, "gold");
        }
        curY += 4;
      }
      v.box(0, curY, 0, 1, curY + 5, 1, "gold", 1.2);
      break;
    }

    case "lds_temples": {
      // Majestic Salt-Lake Style White Granite Temple: Buttressed Walls, Pitched Slate Roof, 6 Square Stepped Towers & Golden Angel Finial!
      const h = 7 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Main white-granite sanctuary with recessed stained-glass lancets & pitched roof
      v.hollowBox(-bx + 2, 0, -bz + 2, bx - 2, h, bz - 2, "white", "marble");
      addWindowGrid(v, -bx + 2, 2, -bz + 2, bx - 2, h, bz - 2, 3, 0.65, "warmGlow");
      addGableSafe(v, -bx + 2, h, -bz + 3, bx - 2, bz - 3, 3, "z", "slate", "marble");
      // 3 East & 3 West square granite tower shafts + faceted spires!
      const centerShaftH = h + 4 + clampedLv;
      const sideShaftH = h + 2 + clampedLv;
      for (const sz of [-bz + 3, bz - 3]) {
        addGothicSteeple(v, 0, sz, 0, centerShaftH, 6 + clampedLv, "white", "marble", "marble");
        addGothicSteeple(v, -bx + 3, sz, 0, sideShaftH, 4 + clampedLv, "marble", "white", "marble");
        addGothicSteeple(v, bx - 3, sz, 0, sideShaftH, 4 + clampedLv, "marble", "white", "marble");
      }
      // Blazing golden Angel Moroni statue atop the tallest East central spire!
      const topAngelY = centerShaftH + 6 + clampedLv;
      v.box(0, topAngelY, bz - 3, 1, topAngelY + 3, bz - 2, "gold", 1.35);
      break;
    }

    case "graveyards": {
      // Wrought-Iron Fence Posts, Weathered Headstones, Cypresses & Gothic Granite Chapel Directly on Earth (NO slab!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      for (let x = -bx; x <= bx; x += 4) {
        v.box(x, 0, bz - 1, x + 1, 2, bz, "iron");
      }
      for (let x = -bx + 2; x < 1; x += 3) {
        for (let z = -bz + 2; z < bz - 1; z += 3) {
          v.box(x, 0, z, x + 1, 2, z + 1, x % 2 === 0 ? "stone" : "marble");
        }
      }
      addCypressMini(v, -bx + 1, 0, -bz + 1, 7 + clampedLv);
      addCypressMini(v, bx - 2, 0, bz - 2, 6 + clampedLv);
      // Small Gothic stone mortuary chapel on +X
      v.hollowBox(2, 0, -bz + 2, bx - 1, 4 + clampedLv, 2, "granite", "stone");
      addGableSafe(v, 2, 4 + clampedLv, -bz + 2, bx - 1, 2, 3, "z", "slate", "stone");
      break;
    }

    // --------------------- MARITIME, SHIPYARDS & BOATS (9 — Curved 3D Hulls, Zero Fake Water Slabs!) ---------------------
    case "docks": {
      // Heavy Timber Harbor Pier on Submerged Pilings (y = -3..2, NO fake water slab!) + Crates + Tapered Red/White Harbor Lighthouse!
      const pierW = padX >= 12 ? 5 : 4;
      v.box(-pierW, 2, -padZ + 1, pierW, 3, padZ - 1, "wood");
      for (let z = -padZ + 2; z < padZ - 1; z += 4) {
        v.box(-pierW, -3, z, -pierW + 1, 4, z + 1, "woodDark");
        v.box(pierW - 1, -3, z, pierW, 4, z + 1, "woodDark");
      }
      if (padX >= 12) {
        // Finger mooring jetty at Lv.4-5
        v.box(pierW, 2, -2, padX - 1, 3, 2, "wood");
        v.box(padX - 2, -3, -2, padX - 1, 4, -1, "woodDark");
      }
      v.box(-pierW + 1, 3, -3, -1, 5, 0, "crate");
      if (clampedLv >= 2) {
        // Classic tapered octagonal Red & White Horizontally-Banded Harbor Lighthouse at seaward pier tip (ZERO spiral!)
        const lhZ = padZ - 4;
        const lhH = 7 + clampedLv * 2;
        for (let y = 0; y < lhH; y++) {
          const r = 2.1 - (y / lhH) * 0.7;
          const bandCol = Math.floor(y / 2) % 2 === 0 ? "white" : "red";
          v.cylinderY(2, lhZ, 3 + y, 4 + y, r, bandCol);
        }
        v.cylinderY(2, lhZ, 3 + lhH, 5 + lhH, 1.5, "warmGlow", 1.35);
        v.cone(2, 5 + lhH, 8 + lhH, lhZ, 1.9, 0.35, "crimson");
      }
      break;
    }

    case "ship_building_areas": {
      // Timber Boatwright Hall + Submerged Slipway Rails (y = -3..2, NO floating cyan slab!) + Curved Wooden Ship Keel & Hull Ribs!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Timber deck on landward -Z side anchored on pilings down to y = -3
      v.box(-bx, -3, -bz, bx, 2, -1, "woodDark");
      v.box(-bx, 1, -bz, bx, 2, 0, "wood");
      // Windowed cedar & brick Boatwright Workshop Hall on (-X, -Z)
      const hallH = 6 + clampedLv;
      v.hollowBox(-bx + 1, 2, -bz + 1, 1, 2 + hallH, -1, "oak", "woodLight");
      addWindowGrid(v, -bx + 1, 3, -bz + 1, 1, 2 + hallH, -1, 2, 0.55, "warmGlow");
      addGableSafe(v, -bx, 2 + hallH, -bz + 1, 2, -1, 3, "x", "crimson", "woodLight");
      // Sloped wooden launch slipway timbers plunging into real ocean water (+Z)
      v.box(-4, -2, 0, -3, 1, bz - 1, "woodDark");
      v.box(3, -2, 0, 4, 1, bz - 1, "woodDark");
      // Curved wooden ship under construction on the slipway (evolves from exposed U-ribs at Lv.1-2 to planked schooner hull at Lv.3-5!)
      const shipZ1 = bz - 2;
      v.box(-1, 0, 0, 1, 2, shipZ1, "woodDark"); // keel spine
      for (let z = 1; z < shipZ1; z += 2) {
        const t = (z - 1) / Math.max(1, shipZ1 - 1);
        const ribW = Math.max(1, Math.round(3.5 * Math.sin(Math.max(0.2, (1 - t * 0.65) * Math.PI * 0.5))));
        if (clampedLv <= 2) {
          v.put(-ribW, 1, z, "woodLight");
          v.put(-ribW, 2, z, "woodLight");
          v.put(ribW, 1, z, "woodLight");
          v.put(ribW, 2, z, "woodLight");
        } else {
          v.box(-ribW, 1, z, ribW + 1, 3 + Math.min(2, clampedLv - 3), z + 2, "oak");
          v.box(-ribW + 1, 3, z, ribW, 4, z + 2, "woodLight");
        }
      }
      // Timber A-frame boat hoist over slipway head
      v.box(3, 2, -4, 4, 9 + clampedLv, -3, "woodDark");
      v.box(7, 2, -4, 8, 9 + clampedLv, -3, "woodDark");
      v.box(2, 9 + clampedLv, -4, 8, 10 + clampedLv, 2, "amber");
      break;
    }

    case "shipyards": {
      // Deep Concrete Graving Drydock Walls (y = -3..3, NO fake water slab!) + Heavy Lattice Yellow Goliath Gantry Cranes + Curved Steel Ship Hull!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(12, padZ - 1);
      // Heavy concrete drydock quay walls flanking the central slipway channel (open to real ocean!)
      v.box(-bx, -3, -bz, -bx + 3, 3, bz - 1, "concreteDark");
      v.box(bx - 3, -3, -bz, bx, 3, bz - 1, "concreteDark");
      v.box(-bx, -3, -bz, bx, 3, -bz + 4, "concrete"); // drydock headwall
      // Steel plate fabrication workshop at drydock head
      v.hollowBox(-bx + 2, 3, -bz + 1, bx - 2, 8 + Math.min(3, clampedLv), -bz + 4, "steel", "sky");
      // 1 (Lv.1-2) -> 2 (Lv.3-5) Heavy Industrial Yellow Goliath Portal Gantry Cranes with 2x2 legs & double box-girder!
      const ch = 12 + clampedLv * 2;
      const craneZs = clampedLv <= 2 ? [0] : [-Math.floor(bz * 0.32), Math.floor(bz * 0.35)];
      for (const cz of craneZs) {
        v.box(-bx + 1, 3, cz - 1, -bx + 3, ch, cz + 1, "busYellow");
        v.box(bx - 3, 3, cz - 1, bx - 1, ch, cz + 1, "busYellow");
        v.box(-bx + 1, ch - 2, cz - 1, bx - 1, ch, cz + 1, "busYellow"); // thick top box-girder!
        v.box(-1, ch - 4, cz - 1, 2, ch - 2, cz + 1, "iron"); // hoist trolley & hook
      }
      // Sculpted hydrodynamic crimson & dark-steel cargo/container ship hull in drydock!
      const hullMaxW = Math.min(5, bx - 4);
      for (let z = -bz + 5; z <= bz - 2; z++) {
        const t = (z - (-bz + 5)) / Math.max(1, bz * 2 - 7);
        const hw = t > 0.68 ? Math.max(1, Math.round(hullMaxW * (1 - (t - 0.68) / 0.34))) : hullMaxW;
        v.box(-hw, -1, z, hw + 1, 2, z + 1, "charcoal");
        v.box(-hw, 2, z, hw + 1, 4 + Math.min(2, clampedLv - 1), z + 1, "crimson");
      }
      // Multi-deck white ship bridge superstructure + funnel!
      const deckY = 4 + Math.min(2, clampedLv - 1);
      v.hollowBox(-hullMaxW + 1, deckY, -bz + 6, hullMaxW, deckY + 4 + Math.min(2, clampedLv - 2), -bz + 10, "white", "sky");
      v.box(-1, deckY + 4, -bz + 6, 2, deckY + 7, -bz + 8, "red");
      v.put(0, deckY, 2, "warmGlow", 1.3); // bright welding arc spark
      break;
    }

    case "boats": {
      // Sculpted 3D Watercraft Evolution: Lv.1 Skiff -> Lv.2 Launch -> Lv.3 Fishing Trawler -> Lv.4 Harbor Tugboat -> Lv.5 Coastal Steamer!
      bobOnWater = true;
      const bl = Math.max(5, padZ - 1);
      if (clampedLv === 1) {
        addCurvedBoatHull(v, -bl + 1, bl - 1, 2, 2, "wood", "woodDark", "woodLight");
        v.box(-1, 2, -1, 2, 3, 0, "oak"); // rowing thwart
      } else if (clampedLv === 2) {
        addCurvedBoatHull(v, -bl, bl, 3, 2, "white", "blue", "woodLight", "chrome");
        v.box(-1, 2, -1, 2, 4, 2, "glass", 0.65);
      } else if (clampedLv === 3) {
        // Classic blue & white wooden fishing trawler with wheelhouse & net derrick boom!
        addCurvedBoatHull(v, -bl, bl, 3, 3, "blue", "crimson", "wood", "white");
        v.hollowBox(-2, 3, -1, 3, 6, 4, "white", "sky");
        v.box(-1, 4, 3, 2, 5, 4, "glass", 0.7);
        v.box(0, 3, -6, 1, 9, -5, "woodDark");
        v.box(0, 6, -9, 1, 8, -5, "amber");
      } else if (clampedLv === 4) {
        // Stout red-and-black harbor tugboat with pilothouse & brass funnel!
        addCurvedBoatHull(v, -bl, bl, 4, 3, "charcoal", "crimson", "wood", "busYellow");
        v.hollowBox(-2, 3, -2, 3, 7, 4, "white", "crimson");
        v.box(-2, 5, 3, 3, 6, 4, "glass", 0.75);
        v.cylinderY(0.5, -4, 3, 9, 1.2, "brass");
        v.put(0, 9, -4, "black");
      } else {
        // Lv.5: Twin-deck white & navy coastal passenger excursion steamer with twin funnels!
        addCurvedBoatHull(v, -bl, bl, 4, 3, "blueDark", "crimson", "woodLight", "white");
        v.hollowBox(-3, 3, -bl + 3, 4, 6, bl - 4, "white", "sky");
        v.hollowBox(-2, 6, -bl + 5, 3, 8, bl - 6, "white", "brass");
        v.cylinderY(0.5, -2, 8, 12, 1.2, "red");
        v.cylinderY(0.5, 2, 8, 12, 1.2, "red");
      }
      break;
    }

    case "speed_boats": {
      // Sleek V-Hull Powerboats: Lv.1 Jet Runabout -> Lv.2 Cigarette Racer -> Lv.3 Catamaran -> Lv.4 Motor Yacht -> Lv.5 Superyacht!
      bobOnWater = true;
      const bl = Math.max(5, padZ - 1);
      if (clampedLv === 1) {
        addCurvedBoatHull(v, -bl + 1, bl, 2, 2, "red", "white", "cream");
        v.box(-1, 2, 0, 2, 3, 2, "screenCyan", 0.7);
      } else if (clampedLv <= 3) {
        // Sleek crimson & white offshore cigarette racer with long raked foredeck & twin black outboards!
        addCurvedBoatHull(v, -bl, bl, 3, 2, "crimson", "white", "white");
        v.box(-2, 2, 1, 3, 3, bl - 2, "red"); // aerodynamic racing foredeck
        v.box(-2, 2, -2, 3, 4, 2, "screenCyan", 0.75); // wraparound tinted canopy
        v.box(-2, 0, -bl - 1, 0, 2, -bl, "charcoal");
        v.box(1, 0, -bl - 1, 3, 2, -bl, "charcoal");
      } else {
        // Lv.4-5: Sculpted Multi-Deck Mediterranean Superyacht with Tinted Salon Windows & Radar Arch!
        addCurvedBoatHull(v, -bl, bl, 4, 3, "white", "blueDark", "woodLight", "chrome");
        v.hollowBox(-3, 3, -bl + 3, 4, 6, 4, "white", "glass");
        v.box(-3, 4, -bl + 4, 4, 5, 4, "glass", 0.78);
        if (clampedLv >= 5) {
          v.hollowBox(-2, 6, -bl + 5, 3, 8, 2, "white", "chrome");
          v.dome(0.5, 8, -1, 1.3, "white"); // satcom dome
        }
      }
      break;
    }

    case "sail_boats": {
      // Sculpted Curved Yacht Hull + Wooden Mast(s), Bowsprit & Wind-Billowed Canvas Sails (Lv.1 Sloop -> Lv.5 3-Masted Royal Clipper)!
      bobOnWater = true;
      const bl = Math.max(9, padZ - 1);
      const hullCol = clampedLv >= 4 ? "woodDark" : "white";
      const bootCol = clampedLv >= 4 ? "brass" : "blueDark";
      addCurvedBoatHull(v, -bl + 1, bl - 2, 3, 2, hullCol, bootCol, "woodLight", "white");
      // Low cabin coachroof + bowsprit spar projecting forward to bl
      v.box(-1, 2, -3, 2, 3, 2, clampedLv >= 4 ? "oak" : "white");
      v.box(0, 2, bl - 3, 1, 3, bl, "woodDark");

      if (clampedLv <= 2) {
        // Single-mast Bermuda Sloop / Cutter with billowing mainsail (aft) & foresail jib (forward)!
        const mh = 12 + clampedLv * 2;
        v.box(0, 2, 1, 1, mh, 2, "woodDark"); // mast
        v.box(0, 3, -bl + 3, 1, 4, 1, "wood"); // boom
        addBillowedSailZ(v, 0, 4, mh - 1, 0, -bl + 3, "white", clampedLv === 2 ? st.accent : undefined);
        addBillowedSailZ(v, 0, 4, mh - 3, 2, bl - 2, "cream");
      } else if (clampedLv === 3) {
        // Twin-mast Ketch (tall mainmast forward + mizzen mast aft)
        const mh = 16;
        v.box(0, 2, 3, 1, mh, 4, "woodDark");
        addBillowedSailZ(v, 0, 4, mh - 1, 2, -3, "white", st.accent);
        addBillowedSailZ(v, 0, 4, mh - 3, 4, bl - 1, "cream");
        v.box(0, 2, -5, 1, 12, -4, "woodDark");
        addBillowedSailZ(v, 0, 4, 11, -5, -bl + 2, "white");
      } else {
        // Lv.4 Schooner / Lv.5 3-Masted Royal Clipper Tall Ship with raised quarterdeck & golden stern lantern!
        v.box(-2, 2, -bl + 1, 3, 4, -bl + 6, "oak");
        v.put(0, 4, -bl + 1, "warmGlow", 1.2);
        const mastZs = clampedLv === 4 ? [-4, 5] : [-9, 0, 9];
        for (let i = 0; i < mastZs.length; i++) {
          const mz = mastZs[i];
          const mh = (i === 1 ? 20 : 17) + (clampedLv - 4) * 2;
          v.box(0, 2, mz, 1, mh, mz + 1, "woodDark");
          addBillowedSailZ(v, 0, 4, mh - 1, mz, mz - 6, "cream", "gold");
        }
        addBillowedSailZ(v, 0, 4, 14, mastZs[mastZs.length - 1] + 1, bl - 1, "white");
      }
      break;
    }

    case "naval_vessels": {
      // Sculpted Flared Grey Warship Hull + Naval Gun Turret + VLS Deck + Sloped Stealth Bridge + Funnels & Rotating Radar!
      bobOnWater = true;
      const nl = Math.max(10, padZ - 1);
      addCurvedBoatHull(v, -nl + 1, nl - 1, 4, 3, "steel", "crimson", "steelDark", "steelLight");
      // Foredeck gun turret + long gun barrel
      v.box(-1, 3, nl - 7, 2, 5, nl - 4, "steelLight");
      v.box(0, 4, nl - 4, 1, 5, nl - 1, "charcoal");
      // Sloped stealth superstructure bridge + dark bridge windows + raked exhaust stack
      const brH = 7 + clampedLv * 2;
      v.hollowBox(-2, 3, -3, 3, brH, 4, "steelLight", "steel");
      v.box(-2, brH - 2, 3, 3, brH - 1, 4, "charcoal");
      v.box(-1, 3, -8, 2, 7 + clampedLv, -4, "slate"); // aft funnel & hangar
      if (clampedLv >= 3) {
        // Stern helicopter flight pad markings
        v.box(-2, 3, -nl + 2, 3, 4, -8, "asphaltDark");
        v.put(0, 3, -nl + 4, "busYellow");
      }
      rotorVox = new PixelVox(960 + clampedVar);
      rotorVox.box(-2, 0, 0, 3, 1, 1, "white");
      rotorPivot = [0.5, brH + 1, 1];
      rotorAxis = "y";
      rotorSpeed = 2.2;
      break;
    }

    case "submarines": {
      // Rounded Hydrodynamic Teardrop Attack / Ballistic Submarine Hull + Dive Planes + Conning Sail + Brass Prop & Periscopes!
      bobOnWater = true;
      const sl = Math.max(10, padZ - 1);
      for (let z = -sl + 1; z <= sl - 1; z++) {
        const u = z / sl; // -1..1
        const r = Math.max(0.8, Math.sqrt(Math.max(0.08, 1 - u * u)) * (clampedLv >= 3 ? 3.2 : 2.6));
        const hw = Math.max(1, Math.round(r));
        const topY = r >= 2.0 ? 3 : 2;
        v.box(-hw, -1, z, hw + 1, topY, z + 1, "charcoal");
        if (hw >= 2 && topY >= 3) {
          v.box(-hw + 1, 2, z, hw, 3, z + 1, "black"); // rounded pressure-hull casing!
        }
      }
      // Cruciform stern rudder, stabilizers, bronze propeller & whitewater foam!
      v.box(0, 0, -sl, 1, 4, -sl + 2, "black");
      v.box(-3, 1, -sl + 1, 4, 2, -sl + 3, "charcoal");
      v.put(0, 0, -sl - 1, "brass");
      v.box(-2, 0, -sl - 1, 3, 1, -sl, "foam", 0.45);
      // Streamlined conning-tower sail + horizontal sail dive planes + raised brass periscopes!
      const sailH = 6 + clampedLv;
      v.box(-1, 3, 0, 2, sailH, 5, "black");
      v.box(-3, 4, 2, 4, 5, 4, "charcoal"); // diving planes!
      v.box(0, sailH, 2, 1, sailH + 3, 3, "brass");
      v.put(1, sailH + 1, 4, "silver");
      if (clampedLv >= 4) {
        // Raised SSBN ballistic missile deck hatches behind the sail!
        for (let mz = -7; mz <= -2; mz += 2) {
          v.box(-1, 3, mz, 2, 4, mz + 1, "slate");
        }
      }
      break;
    }

    case "aircraft_carriers": {
      // Flared Steel Lower Hull + Overhanging Angled Flight Deck + Runway Lines + Starboard Radar Island + Parked Fighter Squadron!
      bobOnWater = true;
      const cl = Math.max(18, padZ - 1);
      const cw = Math.max(11, padX - 1);
      // Tapered hydrodynamic lower warship hull (y = -1..4)
      addCurvedBoatHull(v, -cl + 2, cl - 2, cw - 3, 4, "steelDark", "crimson", "steel");
      // Wide overhanging flight deck + angled port waist sponson!
      v.box(-cw + 2, 4, -cl + 1, cw - 1, 5, cl - 1, "asphaltDark");
      v.box(-cw, 4, -cl + 6, -cw + 2, 5, 6, "asphaltDark"); // port angled-deck overhang!
      // Crisp white angled landing strip & yellow bow catapult lines
      for (let z = -cl + 3; z < cl - 3; z += 2) {
        const rx = Math.round(((z + cl) / (cl * 2)) * -4);
        v.put(rx, 5, z, "white");
      }
      v.box(2, 4, 4, 3, 5, cl - 2, "busYellow"); // starboard bow catapult track
      // Starboard Multi-Tier Supercarrier Command Island + Bridge Glass + Rotating Radar!
      const islH = 10 + clampedLv * 2;
      v.hollowBox(cw - 5, 5, -5, cw - 1, islH, 3, "steel", "steelLight");
      v.box(cw - 5, islH - 2, -4, cw - 4, islH - 1, 2, "screenCyan", 0.75);
      // 1 -> 4 Detailed Swept-Wing Silver Jet Fighters on Flight Deck!
      const jetCount = Math.min(4, clampedLv);
      const jetSpots: [number, number][] = [
        [-cw + 3, -12],
        [-cw + 3, -4],
        [-cw + 4, 5],
        [1, 11],
      ];
      for (let j = 0; j < jetCount; j++) {
        const [jx, jz] = jetSpots[j];
        v.box(jx, 5, jz, jx + 2, 6, jz + 5, "silver");
        v.box(jx - 1, 5, jz + 1, jx + 4, 6, jz + 3, "steelLight");
        v.put(jx + 1, 6, jz + 3, "screenCyan", 0.7);
      }
      rotorVox = new PixelVox(965 + clampedVar);
      rotorVox.box(-2, 0, 0, 3, 1, 1, "white");
      rotorPivot = [cw - 3, islH + 1, -1];
      rotorAxis = "y";
      rotorSpeed = 1.8;
      break;
    }

    // --------------------- NATURE & TERRAIN (18 — ZERO Square Base Slabs, Zero Spirals!) ---------------------
    case "trees": {
      // Natural Broadleaf Tree Directly on Grass: Flared Roots, Textured Trunk & Multi-Lobe Foliage Crown!
      const th = Math.round(7 * (0.82 + clampedLv * 0.36));
      const trunkR = clampedLv >= 4 ? 2 : 1;
      v.box(-trunkR - 1, 0, -1, trunkR + 1, 1, 1, "woodDark"); // root flare
      v.box(-trunkR, 0, -trunkR, trunkR, Math.floor(th * 0.52), trunkR, "woodDark");
      const lc = clampedVar === 1 ? "pink" : clampedVar === 2 ? "orange" : clampedVar === 3 ? "leafLight" : "leaf";
      const rad = Math.min(padX - 1, 3.0 + clampedLv * 0.75);
      v.sphere(0, th * 0.72, 0, rad, th * 0.38, rad, lc);
      v.sphere(-1.8, th * 0.6, 1.2, rad * 0.68, th * 0.28, rad * 0.68, lc);
      if (clampedLv >= 3) {
        v.sphere(1.8, th * 0.64, -1.2, rad * 0.65, th * 0.28, rad * 0.65, lc);
      }
      break;
    }

    case "pine_trees": {
      // Alpine Spruce/Pine Conifer Cluster Directly on Grass (NO lollipop stick, NO square slab!): Low Boughs & Overlapping Tiers!
      const mainH = 10 + clampedLv * 3;
      const drawLayeredPine = (cx: number, cz: number, totalH: number, maxR: number) => {
        v.box(Math.round(cx), 0, Math.round(cz), Math.round(cx) + 1, 3, Math.round(cz) + 1, "woodDark");
        const tiers = 4;
        for (let t = 0; t < tiers; t++) {
          const y0 = 2 + Math.floor((t * (totalH - 3)) / tiers);
          const y1 = 2 + Math.floor(((t + 1.35) * (totalH - 2)) / tiers);
          const r0 = maxR * (1 - t * 0.2);
          v.cone(cx + 0.5, y0, y1, cz + 0.5, r0, 0.45, t % 2 === 0 ? "leafDark" : "leaf");
        }
      };
      drawLayeredPine(clampedLv >= 2 ? -1.5 : 0, -1, mainH, Math.min(4.2, 2.8 + clampedLv * 0.3));
      if (clampedLv >= 2) {
        drawLayeredPine(2.5, 2, Math.max(7, mainH - 4), 2.4);
      }
      if (clampedLv >= 4) {
        drawLayeredPine(-2.5, 3, Math.max(6, mainH - 6), 2.1);
      }
      break;
    }

    case "redwood_trees": {
      // Ancient California Giant Sequoia Directly on Grass: Flared Cinnamon Buttress Trunk + Multi-Tier Spreading Bough Clouds!
      const th = 16 + clampedLv * 4;
      const baseR = 1.8 + clampedLv * 0.25;
      v.cone(0, 0, Math.floor(th * 0.78), 0, baseR + 0.8, 0.9, "brickDark");
      for (let t = 0; t < 4; t++) {
        const cy = Math.floor(th * (0.42 + t * 0.16));
        const cr = Math.min(padX - 1, (4.4 - t * 0.65) + clampedLv * 0.2);
        const ox = t % 2 === 0 ? -0.8 : 0.8;
        v.sphere(ox, cy, 0, cr, 2.2, cr, t % 2 === 0 ? "leafDark" : "leaf");
      }
      v.cone(0, Math.floor(th * 0.82), th + 3, 0, 2.6, 0.4, "leafDark");
      break;
    }

    case "plants": {
      // Ornate Terracotta Planter Urn Overflowing with Tropical Fronds & Blossoms (NO grass slab!)
      const pw = Math.min(4, 2 + Math.floor(clampedLv * 0.5));
      v.cylinderY(0, 0, 0, 2, pw, "terracotta");
      v.cone(0, 2, 5 + clampedLv, 0, pw + 0.6, 0.6, "leafLight");
      v.put(-1, 4 + Math.floor(clampedLv * 0.5), 0, "pink");
      v.put(1, 3 + Math.floor(clampedLv * 0.5), 1, "yellow");
      v.put(0, 5 + clampedLv, 0, "magenta");
      break;
    }

    case "shrubs": {
      // Sculpted Multi-Mound Boxwood & Flowering Hydrangea Shrubs Directly on Grass (ZERO spiral, ZERO slab!)
      const r = 2.2 + clampedLv * 0.35;
      v.sphere(-1.5, 1.5, -1, r, 1.8 + clampedLv * 0.25, r, "leaf");
      v.sphere(1.8, 1.3, 1.2, r * 0.85, 1.5 + clampedLv * 0.2, r * 0.85, "leafDark");
      v.sphere(0, 1.6, 1.8, r * 0.75, 1.4, r * 0.75, "leafLight");
      v.put(-1, 3, -1, "pink");
      v.put(2, 2, 1, "sky");
      break;
    }

    case "bushes": {
      // Wild Woodland Berry Bramble Thickets Directly on Grass (NO slab!)
      const rw = 2.2 + clampedLv * 0.4;
      v.sphere(-1.2, 1.6, -1, rw, 1.6 + clampedLv * 0.35, rw, "leafDark");
      v.sphere(1.6, 1.5, 1.2, rw * 0.85, 1.5 + clampedLv * 0.3, rw * 0.85, "leaf");
      v.put(1, 2, 2, "red");
      v.put(-2, 2, 0, "red");
      v.put(0, 3, -1, "magenta");
      break;
    }

    case "tubbleweeds": {
      // Desert Tumbleweeds + Red Sandstone Outcrop Directly on Terrain (NO square sand rug!)
      const rw = 2.0 + clampedLv * 0.35;
      v.sphere(-0.5, rw - 0.3, 0, rw, rw * 0.9, rw, "wood");
      if (clampedLv >= 2) {
        v.sphere(2.5, 1.4, 2, 1.6, 1.5, 1.6, "oak");
      }
      v.cone(-3, 0, 2, -2, 1.8, 0.8, "terracotta");
      break;
    }

    case "ponds": {
      // Organic Rounded Boulder-Rimmed Koi & Waterlily Pond Directly on Grass (NO square slab!)
      const pr = Math.min(5.2, 3.6 + clampedLv * 0.3);
      v.cylinderY(0, 0, 0, 1, pr + 0.9, "stone");
      v.cylinderY(0, 0, 0, 1, pr, "water", 0.3);
      v.box(-2, 0, -Math.round(pr), 0, 3, -Math.round(pr) + 1, "leafDark"); // cattail reeds
      v.put(-1, 1, 1, "leafLight");
      v.put(1, 1, -1, "pink");
      v.put(0, 1, 2, "orange");
      break;
    }

    case "lakes": {
      // Organic Multi-Lobe Sapphire Alpine Lake + Rocky Pine Islet + Wooden Fishing Jetty (NO square grass slab!)
      const rx = Math.max(6, padX - 2);
      const rz = Math.max(4, padZ - 2);
      v.sphere(-1, 0.5, 0, rx, 1.1, rz, "stone");
      v.sphere(-1, 0.6, 0, rx - 1.0, 1.0, rz - 1.0, "waterDeep", 0.25);
      v.cylinderY(0, 0, 0, 2, 2.2, "grass");
      addCypressMini(v, 0, 2, 0, 5 + clampedLv);
      v.box(-1, 1, -rz + 1, 1, 2, -2, "wood");
      break;
    }

    case "hills": {
      // Multi-Knoll Rolling Green Hills + Limestone Ledge & Crest Oak Directly on Grass (NO slab!)
      const mh = Math.round(5.5 * (0.82 + clampedLv * 0.36));
      v.sphere(-1, 0.5, 0, Math.min(padX - 0.5, 4.8 + clampedLv), mh * 0.78, Math.min(padZ - 0.5, 4.6 + clampedLv * 0.6), "grass2");
      v.sphere(2.5, 0.5, 1.5, Math.min(padX - 1.5, 3.4 + clampedLv * 0.7), mh * 0.56, Math.min(padZ - 1.5, 3.2 + clampedLv * 0.5), "grass3");
      addTreeMini(v, -1, Math.max(2, Math.round(mh * 0.68)), 0, clampedVar);
      break;
    }

    case "mountains": {
      // Jagged Multi-Peak Craggy Alpine Granite Massif + Foothill Pines + Snow-Capped Ridges!
      const mh = 13 + clampedLv * 3;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Primary summit peak
      v.cone(-1, 0, mh, -1, Math.min(bx, bz) * 0.78, 1.0, "stone");
      v.cone(-1, Math.floor(mh * 0.62), mh + 1, -1, Math.min(bx, bz) * 0.36, 0.4, "snow");
      // Secondary jagged granite peak on (+X, +Z)
      const subH1 = Math.floor(mh * 0.76);
      v.cone(Math.floor(bx * 0.42), 0, subH1, Math.floor(bz * 0.32), bx * 0.52, 0.8, "granite");
      v.cone(Math.floor(bx * 0.42), Math.floor(subH1 * 0.66), subH1 + 1, Math.floor(bz * 0.32), bx * 0.24, 0.4, "snow");
      // Third craggy shoulder ridge on (-X, +Z) + alpine pines
      const subH2 = Math.floor(mh * 0.58);
      v.cone(-Math.floor(bx * 0.45), 0, subH2, Math.floor(bz * 0.38), bx * 0.44, 0.9, "basalt");
      addCypressMini(v, 2, 0, -bz + 3, 6);
      break;
    }

    case "canyons": {
      // Striated Red-Rock Mesa Canyon Walls + Winding Turquoise River + Natural Sandstone Arch Bridge at Lv.3-5!
      const ch = 6 + clampedLv * 2;
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      for (let y = 0; y < ch; y++) {
        const col = y % 3 === 0 ? "terracotta" : y % 3 === 1 ? "brick2" : "sandDark";
        const inset = Math.floor(y * 0.25);
        v.box(-bx + inset, y, -bz + 1, -2 - Math.floor(inset * 0.5), y + 1, bz - 1, col);
        v.box(2 + Math.floor(inset * 0.5), y, -bz + 1, bx - inset, y + 1, bz - 1, col);
      }
      v.box(-2, 0, -bz + 1, 2, 1, bz - 1, "water", 0.3);
      if (clampedLv >= 3) {
        v.box(-3, ch - 2, -2, 3, ch, 2, "terracotta");
      }
      break;
    }

    case "sand": {
      // Organic Wind-Rippled Coastal Sand Dune Drift + Sea-Grass Tufts (rounded contour, NOT a square rug!)
      v.sphere(0, 0.4, 0, 5.4, 1.8 + clampedLv * 0.3, 4.8, "sand");
      v.sphere(-1.5, 0.8, 1, 3.4, 1.5 + clampedLv * 0.25, 3.0, "sandDark");
      v.put(2, 1, 2, "leafLight");
      v.put(-2, 1, -2, "wood");
      break;
    }

    case "beaches": {
      // Golden Sand Shoreline + Foaming Surf + Striped Towels + Stilted Wooden Lifeguard Tower!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.sphere(0, 0.4, -1, bx, 1.2, bz - 1, "sand");
      v.box(-bx + 1, 0, bz - 2, bx - 1, 1, bz - 1, "foam", 0.4);
      // Lifeguard watchtower on timber stilts!
      v.box(3, 0, -3, 4, 3, -2, "woodDark");
      v.box(6, 0, -3, 7, 3, -2, "woodDark");
      v.hollowBox(3, 3, -4, 7, 6 + Math.min(2, clampedLv), 0, "white", "sky");
      addGableSafe(v, 2, 6 + Math.min(2, clampedLv), -4, 8, 0, 2, "x", "red", "white");
      v.box(-5, 1, 0, -2, 2, 2, "cyan"); // beach towel
      v.box(-1, 1, -2, 0, 4, -1, "busYellow"); // upright surfboard!
      break;
    }

    case "beach_umbrellas": {
      // Resort Parasols + Sun Loungers on Natural Rounded Sand Patch (NO square sand slab!)
      v.cylinderY(0, 0, 0, 1, 5.2, "sand");
      v.box(0, 1, 0, 1, 5 + Math.min(2, clampedLv), 1, "white");
      v.cone(0.5, 5 + Math.min(2, clampedLv), 7 + Math.min(2, clampedLv), 0.5, 3.5, 0.5, st.accent);
      v.box(-3, 1, 1, 1, 2, 3, "sky");
      if (clampedLv >= 2) {
        v.box(2, 1, -3, 3, 4 + Math.min(2, clampedLv), -2, "white");
        v.cone(2.5, 4 + Math.min(2, clampedLv), 6 + Math.min(2, clampedLv), -2.5, 2.5, 0.5, "busYellow");
      }
      break;
    }

    case "deserts": {
      // Monument-Valley Red-Rock Sandstone Buttes + Sculpted Dunes + Saguaro Cacti (NO flat square sand rug!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Organic wind-swept sand dunes & red-rock sandstone mesa!
      v.sphere(1, 0.4, 0, bx - 1, 1.5, bz - 0.5, "sand");
      v.cone(-bx + 4, 0, 5 + clampedLv * 2, -bz + 3, 3.8, 2.0, "terracotta");
      v.cylinderY(-bx + 4, -bz + 3, 5 + clampedLv * 2, 6 + clampedLv * 2, 2.0, "brick2");
      // Multi-armed Saguaro cacti
      const ch = 5 + clampedLv;
      v.box(2, 1, 0, 3, 1 + ch, 1, "leafDark");
      v.box(0, 3, 0, 2, 4, 1, "leafDark");
      v.box(0, 4, 0, 1, 6, 1, "leafDark");
      v.box(3, 4, 0, 5, 5, 1, "leafDark");
      v.box(4, 5, 0, 5, 7, 1, "leafDark");
      if (clampedLv >= 2) {
        v.sphere(-1, 1.5, 2, 1.3, 1.4, 1.3, "leaf");
        v.put(-1, 3, 2, "yellow"); // blooming barrel cactus!
      }
      break;
    }

    case "swamps": {
      // Organic Bayou Marsh Pools + Buttressed Cypress Trees & Cattails (NO square teal slab!)
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.sphere(-2, 0.3, 0, bx * 0.65, 0.9, bz * 0.78, "tealDark");
      v.sphere(3, 0.3, 1, bx * 0.52, 0.9, bz * 0.68, "moss");
      addTreeMini(v, -3, 0, -1, 0);
      if (clampedLv >= 2) {
        addTreeMini(v, 3, 0, -2, 2);
      }
      v.box(0, 0, 2, 1, 3, 3, "leafDark"); // marsh reeds
      break;
    }

    case "alligators": {
      // Sculpted Bayou Alligator on Natural Mossy Mudbank & Reeds (NO full-tile cyan square!)
      v.cylinderY(0, 0, 0, 1, 4.8, "tealDark");
      v.box(-4, 0, -3, -2, 3, -1, "moss"); // reed tussock
      // Detailed voxel alligator: tail, armored body scutes, legs, snout & white teeth!
      v.box(-1, 1, -5, 1, 2, -2, "leafDark"); // serrated tail
      v.box(-2, 1, -2, 2, 2, 3, "leafDark"); // body & splayed legs
      v.box(-1, 2, -2, 1, 3, 2, "moss"); // osteoderm ridge
      v.box(-1, 1, 3, 1, 2, 6, "leafDark"); // long snout
      v.put(-1, 2, 3, "yellow"); // eyes
      v.put(1, 2, 3, "yellow");
      v.put(-1, 1, 6, "white"); // teeth
      v.put(1, 1, 6, "white");
      break;
    }

    // --------------------- WORLD LANDMARKS (7 — Ground/Water-Anchored Showstoppers, Zero Slabs, Zero Spirals!) ---------------------
    case "large_landmarks": {
      // Monumental Arc de Triomphe (ground-flush!): Carved Marble Piers, Coffered Barrel Arch, Eternal Flame & Golden Quadriga Chariot!
      const h = Math.round(12 * (0.9 + clampedLv * 0.22));
      const bx = Math.max(8, padX - 1);
      // Left & Right monumental limestone/marble piers at y = 0 with projecting relief columns
      v.hollowBox(-bx, 0, -4, -3, h, 4, "marble", "limestone");
      v.hollowBox(3, 0, -4, bx, h, 4, "marble", "limestone");
      for (const cx of [-bx + 1, -4, 3, bx - 2]) {
        v.box(cx, 0, 4, cx + 1, h - 3, 5, "white");
        v.box(cx, 0, -5, cx + 1, h - 3, -4, "white");
      }
      // Curved barrel-vault arch & sculpted entablature attic crown
      v.box(-3, h - 4, -4, 3, h, 4, "marbleShade");
      v.box(-bx - 1, h - 2, -5, bx + 1, h - 1, 5, "limestone");
      v.hollowBox(-bx + 1, h, -4, bx - 1, h + 3, 4, "marble", "gold");
      // Glowing Eternal Flame brazier beneath the arch!
      v.cylinderY(0, 0, 0, 1, 1.5, "brass");
      v.put(0, 1, 0, "fire", 1.35);
      // Sculpted Golden Quadriga Chariot & Horses crowning the summit!
      v.box(-3, h + 3, -1, 3, h + 5, 2, "gold", 1.0);
      v.box(-1, h + 5, -2, 1, h + 7, 1, "gold", 1.15);
      break;
    }

    case "washington_monument": {
      // Crisp Square-Plan Tapered White Marble Obelisk on Circular Plaza Ring + Circle of Flagpoles (NO square grey slab!)
      const oh = Math.round(22 * (0.85 + clampedLv * 0.3));
      v.cylinderY(0, 0, 0, 1, 7.5, "marbleShade");
      for (let y = 1; y < oh; y++) {
        const hw = y < oh * 0.45 ? 3 : 2;
        v.box(-hw, y, -hw, hw, y + 1, hw, y % 7 === 0 ? "marbleShade" : "marble");
      }
      addHippedRoofSafe(v, -2, oh, -2, 2, 2, 3, "white", "gold");
      v.put(0, oh + 2, 0, "red", 1.3);
      // Ring of 8 American flagpoles encircling the base!
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const fx = Math.round(Math.cos(ang) * 6.5);
        const fz = Math.round(Math.sin(ang) * 6.5);
        v.box(fx, 0, fz, fx + 1, 4, fz + 1, "white");
        v.put(fx, 4, fz, k % 2 === 0 ? "red" : "blue");
      }
      break;
    }

    case "white_house": {
      // Executive Residence + Rounded South Truman Portico + Symmetrical East & West Colonnades + South Lawn Fountain & Shade Trees!
      const h = 8 + clampedLv;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Central Executive Mansion sitting flush on manicured green grass (y = 0)
      v.hollowBox(-6, 0, -bz + 2, 6, h, 2, "white", "marble");
      addWindowGrid(v, -6, 1, -bz + 2, 6, h, 2, 2, 0.55, "warmGlow");
      addHippedRoofSafe(v, -6, h, -bz + 2, 6, 2, 2, "slate", "white");
      // Rounded columned South Truman Portico + North Pediment
      v.cylinderY(0, 2.5, 0, h, 3.0, "marble");
      addGableSafe(v, -4, h, -bz + 1, 4, -bz + 3, 2, "x", "white", "marble");
      // Symmetrical East Wing & West Wing Colonnades
      const wingH = Math.max(4, Math.floor(h * 0.56));
      v.hollowBox(-bx + 1, 0, -4, -6, wingH, 1, "white", "marble");
      v.hollowBox(6, 0, -4, bx - 1, wingH, 1, "white", "marble");
      // South Lawn circular fountain & shade trees
      v.cylinderY(0, bz - 3, 0, 1, 2.4, "marble");
      v.cylinderY(0, bz - 3, 1, 2, 1.7, "cyan", 0.6);
      addTreeMini(v, -bx + 3, 0, bz - 3, 0);
      addTreeMini(v, bx - 4, 0, bz - 3, 0);
      break;
    }

    case "smithsonian": {
      // Full 3D Cruciform Red-Sandstone Norman Castle: Gabled Wings, Rose Window, Square Crenellated Flag Keep & Octagonal Slate Turrets (ZERO spiral!)
      const h = 7 + clampedLv;
      const bx = Math.max(12, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Cruciform red-sandstone exhibit halls at y = 0
      v.hollowBox(-bx + 2, 0, -3, bx - 2, h, 3, "brick2", "brickDark");
      v.hollowBox(-4, 0, -bz + 2, 4, h + 1, bz - 2, "brick2", "brickDark");
      addWindowGrid(v, -bx + 2, 1, -3, bx - 2, h, 3, 2, 0.55, "warmGlow");
      addGableSafe(v, -bx + 2, h, -3, bx - 2, 3, 3, "x", "slate", "brickDark");
      addGableSafe(v, -4, h + 1, -bz + 2, 4, bz - 2, 3, "z", "slate", "brickDark");
      // Glowing Rose Window on front transept
      v.box(-1, Math.floor(h * 0.55), bz - 3, 2, Math.floor(h * 0.55) + 2, bz - 2, "magenta", 1.15);
      // Tall Square Norman Flag Keep + Asymmetric Octagonal Lombard Turrets with Steep Slate Spires!
      const keepH = h + 6 + clampedLv * 2;
      v.hollowBox(-3, 0, -4, 3, keepH, 1, "brickDark", "limestone");
      addHippedRoofSafe(v, -3, keepH, -4, 3, 1, 3, "slate", "gold");
      for (const [tx, tz, extraH] of [
        [-bx + 3, 3, 4 + clampedLv],
        [bx - 3, 3, 3 + clampedLv],
        [4, bz - 3, 5 + clampedLv],
      ]) {
        v.cylinderY(tx, tz, 0, h + extraH, 2.0, "brick2");
        v.cone(tx, h + extraH, h + extraH + 5, tz, 2.3, 0.35, "slate");
      }
      break;
    }

    case "eiffel_tower": {
      // Sweeping 4-Leg Wrought-Iron Lattice Eiffel Tower on Champ-de-Mars Parterres + Base Arches + 2 Observation Decks + Golden Beacon!
      const th = Math.round(22 * (0.85 + clampedLv * 0.3));
      const bw = Math.max(7, padX - 2);
      // Crossed gravel promenade paths on natural grass + 4 stone masonry pier shoes (NO solid yellow/grey slab!)
      v.box(-bw, 0, -1, bw, 1, 1, "path");
      v.box(-1, 0, -bw, 1, 1, bw, "path");
      for (const [sx, sz] of [[-bw, -bw], [bw - 2, -bw], [-bw, bw - 2], [bw - 2, bw - 2]]) {
        v.box(sx, 0, sz, sx + 2, 2, sz + 2, "limestone");
      }
      const deck1Y = Math.floor(th * 0.32);
      const deck2Y = Math.floor(th * 0.64);
      for (let y = 2; y < th; y++) {
        const t = y / th;
        const s = Math.max(1, Math.round((1 - t) ** 1.48 * bw));
        const col = y % 2 === 0 ? "copper" : "woodDark";
        v.box(-s, y, -s, -s + 2, y + 1, -s + 2, col);
        v.box(s - 1, y, -s, s + 1, y + 1, -s + 2, col);
        v.box(-s, y, s - 1, -s + 2, y + 1, s + 1, col);
        v.box(s - 1, y, s - 1, s + 1, y + 1, s + 1, col);
        if (y === deck1Y || y === deck2Y) {
          v.box(-s - 1, y, -s - 1, s + 2, y + 2, s + 2, "brass", 0.65);
        }
      }
      // Iconic semicircular wrought-iron base arches spanning between the 4 legs below Deck 1!
      const archS = Math.max(2, Math.round((1 - (deck1Y - 2) / th) ** 1.48 * bw));
      v.box(-archS, deck1Y - 2, -bw + 1, archS + 1, deck1Y - 1, -bw + 2, "copper");
      v.box(-archS, deck1Y - 2, bw - 1, archS + 1, deck1Y - 1, bw, "copper");
      v.box(-bw + 1, deck1Y - 2, -archS, -bw + 2, deck1Y - 1, archS + 1, "copper");
      v.box(bw - 1, deck1Y - 2, -archS, bw, deck1Y - 1, archS + 1, "copper");
      v.box(0, th, 0, 1, th + 6, 1, "gold", 1.35);
      break;
    }

    case "the_london_eye": {
      // Riverside Boarding Pier on Pilings (y = -3..1, NO overhanging grey slab!) + Diagonal White A-Frame Legs + Spoked Wheel & 12-16 Glass Capsules!
      const R = Math.min(11, 7 + clampedLv);
      const cy = R + 3;
      // Compact timber & limestone riverside boarding pier on submerged pilings + glazed ticket kiosk!
      v.box(-9, -3, -6, 9, 1, 4, "stone");
      v.box(-8, 1, -5, 8, 2, 4, "wood");
      v.hollowBox(-8, 2, -5, -3, 5, -1, "white", "screenCyan");
      // Twin diagonal white steel A-frame support legs rising from rear hinges (z = -5) up to central spindle [0, cy, 0]!
      for (let y = 2; y <= cy; y++) {
        const frac = (y - 2) / Math.max(1, cy - 2);
        const lx = Math.round((1 - frac) * 5);
        const lz = Math.round(-5 + frac * 5);
        v.box(-lx - 1, y, lz - 1, -lx + 1, y + 1, lz + 1, "white");
        v.box(lx, y, lz - 1, lx + 2, y + 1, lz + 1, "white");
      }
      v.box(-1, cy - 1, -1, 2, cy + 2, 3, "silver"); // central spindle hub

      rotorVox = new PixelVox(980 + clampedVar);
      // Outer structural rim + inner concentric ring + central hub
      rotorVox.ringZ(0, 0, 0, 1, R, R - 1.25, "white");
      rotorVox.ringZ(0, 0, 0, 1, Math.max(2.5, R * 0.45), Math.max(1.5, R * 0.45 - 0.9), "steelLight");
      rotorVox.ringZ(0, 0, -1, 2, 1.6, 0, "white");
      // 12 radial steel spokes connecting central hub all the way out to the outer rim + glowing cyan glass capsules!
      const podCount = clampedLv >= 4 ? 16 : 12;
      for (let s = 0; s < 12; s++) {
        const ang = (s / 12) * Math.PI * 2;
        for (let r = 1; r < R; r++) {
          rotorVox.put(Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r), 0, "steelLight");
        }
      }
      for (let k = 0; k < podCount; k++) {
        const ang = (k / podCount) * Math.PI * 2;
        const px = Math.round(Math.cos(ang) * R);
        const py = Math.round(Math.sin(ang) * R);
        rotorVox.box(px - 1, py - 1, 1, px + 2, py + 1, 3, "screenCyan", 0.95);
      }
      rotorPivot = [0, cy, 1];
      rotorAxis = "z";
      rotorSpeed = 0.45;
      break;
    }

    case "the_great_pyramids": {
      // Giza Necropolis Evolution on Sculpted Desert Dunes (NO square sand slab!):
      // Lv.1 Mastaba -> Lv.2 Stepped Djoser -> Lv.3 Great Khufu + Gold Cap -> Lv.4 Twin Pyramids + Sphinx -> Lv.5 Full Giza Trio + Great Sphinx + Palms!
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(9, padZ - 1);
      // Natural rounded desert sand dune drifts (leaves corners natural, zero yellow corner nubs!)
      v.sphere(-1, 0.4, -1, bx - 0.5, 1.3, bz - 0.5, "sand");

      if (clampedLv === 1) {
        // Lv.1: Stepped ancient limestone Mastaba tomb + oasis palm
        addHippedRoofSafe(v, -7, 1, -6, 6, 5, 4, "sandDark", "limestone");
        addPalmMini(v, 6, 0, 5, 5);
      } else if (clampedLv === 2) {
        // Lv.2: 6-tier Stepped Pyramid of Djoser + mortuary temple entrance
        for (let t = 0; t < 6; t++) {
          const w = 8 - t;
          v.box(-w, 1 + t * 2, -w, w, 3 + t * 2, w, t % 2 === 0 ? "sandDark" : "limestone");
        }
        v.box(-2, 1, 8, 2, 4, 10, "limestone");
      } else {
        // Lv.3-5 (3x3 = bx ~ 22): Monumental Smooth-Stepped Great Pyramid of Khufu with Blazing Gold Pyramidion!
        const khufuR = 9;
        const khufuCx = clampedLv >= 4 ? -4 : 0;
        const khufuCz = clampedLv >= 4 ? -4 : 0;
        addHippedRoofSafe(
          v,
          khufuCx - khufuR,
          1,
          khufuCz - khufuR,
          khufuCx + khufuR,
          khufuCz + khufuR,
          khufuR,
          "sandDark",
          "limestone",
        );
        v.box(khufuCx - 2, khufuR - 1, khufuCz - 2, khufuCx + 2, khufuR + 2, khufuCz + 2, "gold", 1.3);

        if (clampedLv >= 4) {
          // Second Companion Pyramid of Khafre on (+X, -Z) + Carved Limestone Great Sphinx in foreground!
          const khafR = 6;
          addHippedRoofSafe(v, 5, 1, -11, 5 + khafR * 2, -11 + khafR * 2, khafR, "limestone", "sandDark");
          v.box(5 + khafR - 1, khafR, -11 + khafR - 1, 5 + khafR + 1, khafR + 2, -11 + khafR + 1, "gold", 1.1);
          // Sculpted Great Sphinx of Giza facing +Z (outstretched paws, lion body & nemes headdress!)
          v.box(4, 1, 3, 9, 4, 10, "sandDark"); // lion body
          v.box(4, 1, 10, 5, 2, 14, "limestone"); // left paw
          v.box(8, 1, 10, 9, 2, 14, "limestone"); // right paw
          v.box(5, 4, 8, 8, 7, 11, "goldDark"); // Pharaoh head & nemes headdress
        }
        if (clampedLv >= 5) {
          // Third Pyramid of Menkaure in SW quadrant + Oasis Date Palms + Stone Mortuary Causeway!
          const menkR = 4;
          addHippedRoofSafe(v, -12, 1, 5, -12 + menkR * 2, 5 + menkR * 2, menkR + 1, "limestone", "gold");
          v.box(-2, 1, 5, 1, 2, 14, "limestone"); // mortuary causeway
          addPalmMini(v, 12, 0, 10, 6);
          addPalmMini(v, -14, 0, -12, 5);
        }
      }
      break;
    }

    default: {
      const h = 5 + clampedLv * 2;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.hollowBox(-bx, 0, -bz + 1, 2, h, bz - 1, st.wall, st.trim);
      addWindowGrid(v, -bx, 1, -bz + 1, 2, h, bz - 1, 2, 0.45);
      addHippedRoofSafe(v, -bx, h, -bz + 1, 2, bz - 1, 3, st.roof, st.trim);
      addSquareClockTower(v, Math.max(2, bx - 2), 0, 0, h + 4 + clampedLv, 2, st.trim, "white", st.roof);
      break;
    }
  }

  // A touching farm complex reads as one continuous countryside:
  // narrow irrigation tracks and gateways reach the actual shared parcel edge.
  // School-campus partners receive matching footpaths but remain distinct assets.
  if (connMask && !def.isNetwork) {
    const groundCol = def.category === "agriculture" ? "path" : "limestone";
    const edge = Math.min(halfX, halfZ);
    const pathHalfW = Math.min(2, Math.max(1, Math.floor(edge / 5)));
    if (connMask & 1) v.box(-pathHalfW, 0, -halfZ, pathHalfW, 1, -halfZ + 3, groundCol);
    if (connMask & 2) v.box(halfX - 3, 0, -pathHalfW, halfX, 1, pathHalfW, groundCol);
    if (connMask & 4) v.box(-pathHalfW, 0, halfZ - 3, pathHalfW, 1, halfZ, groundCol);
    if (connMask & 8) v.box(-halfX, 0, -pathHalfW, -halfX + 3, 1, pathHalfW, groundCol);
    if (def.category === "agriculture") {
      // Crops and fences align visually across field boundaries instead of isolated islands.
      if (!(connMask & 1)) v.box(-halfX + 1, 0, -halfZ, halfX - 1, 1, -halfZ + 1, "wood");
      if (!(connMask & 4)) v.box(-halfX + 1, 0, halfZ - 1, halfX - 1, 1, halfZ, "wood");
      if (!(connMask & 2)) v.box(halfX - 1, 0, -halfZ + 1, halfX, 1, halfZ - 1, "wood");
      if (!(connMask & 8)) v.box(-halfX, 0, -halfZ + 1, -halfX + 1, 1, halfZ - 1, "wood");
    }
  }

  // Strictly guarantee zero mesh overhang past exact tile hitbox bounds
  clampVoxToFootprint(v, halfX, halfZ);

  const baseGeo = buildVoxelGeometry(v, VOXEL_SIZE);
  const topY =
    (baseGeo.boundingBox?.max.y ?? 2.0) + (rotorPivot ? rotorPivot[1] * VOXEL_SIZE * 0.5 : 0);
  const asset: BuiltVoxelAsset = {
    baseGeo,
    topY,
    bobOnWater,
    ...(rotorVox
      ? {
          rotorGeo: buildVoxelGeometry(rotorVox, VOXEL_SIZE),
          rotorPivot,
          rotorAxis,
          rotorSpeed,
        }
      : {}),
  };

  assetCache.set(key, asset);
  return asset;
}

export function buildPlacedGroupFromAsset(
  asset: BuiltVoxelAsset,
  ghost = false,
  validGhost = true,
): THREE.Group {
  const group = new THREE.Group();
  const mat = ghost ? getGhostPreviewMaterial(validGhost) : getPixelVoxelMaterial();
  const baseMesh = new THREE.Mesh(asset.baseGeo, mat);
  baseMesh.castShadow = !ghost;
  baseMesh.receiveShadow = !ghost;
  baseMesh.userData.isVoxelMesh = true;
  group.add(baseMesh);

  if (asset.rotorGeo && asset.rotorPivot) {
    const piv = new THREE.Group();
    piv.position.set(
      asset.rotorPivot[0] * VOXEL_SIZE,
      asset.rotorPivot[1] * VOXEL_SIZE,
      asset.rotorPivot[2] * VOXEL_SIZE,
    );
    const rMesh = new THREE.Mesh(asset.rotorGeo, mat);
    rMesh.castShadow = !ghost;
    rMesh.userData.isVoxelMesh = true;
    piv.add(rMesh);
    group.add(piv);
    group.userData.rotorPivot = piv;
    group.userData.rotorAxis = asset.rotorAxis || "z";
    group.userData.rotorSpeed = asset.rotorSpeed || 1.5;
  }

  group.userData.bobOnWater = Boolean(asset.bobOnWater);
  group.userData.topY = asset.topY;
  void packVoxKey;
  return group;
}
