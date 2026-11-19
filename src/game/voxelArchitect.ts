import * as THREE from "three";
import { type CivElementDef, ELEMENT_BY_ID } from "./catalog";
import { getDesign } from "./designs/registry";
import { type SmokeKind, makeCtx } from "./designs/kit";
import {
  PixelVox,
  VOXELS_PER_TILE,
  VOXEL_SIZE,
  buildVoxelGeometry,
  getGhostPreviewMaterial,
  getPixelVoxelMaterial,
  packVoxKey,
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
  rotorGeo?: THREE.BufferGeometry;
  rotorPivot?: [number, number, number];
  rotorAxis?: "x" | "y" | "z";
  rotorSpeed?: number;
  /** Additional animated parts (new design system) */
  rotors?: BuiltRotor[];
  /** Smoke/steam emitter points in world-local units (meters) */
  smokePoints?: [number, number, number, SmokeKind][];
  /** Blinking beacon lights in world-local units (meters) */
  blinkers?: [number, number, number, string][];
  bobOnWater?: boolean;
  topY: number;
  voxelCount?: number;
}

function buildFromDesign(
  def: CivElementDef,
  lv: number,
  variant: number,
  spanX: number,
  spanZ: number,
  connMask: number,
): BuiltVoxelAsset | null {
  const design = getDesign(def.id);
  if (!design) return null;
  const c = makeCtx(def.id, lv, variant, spanX, spanZ, connMask);
  try {
    design.build(c);
  } catch (err) {
    console.error(`Design build failed for ${def.id} L${lv} V${variant}`, err);
    c.v.box(-c.hx + 2, 0, -c.hz + 2, c.hx - 2, 6, c.hz - 2, "magenta");
  }
  clampVoxToFootprint(c.v, c.hx, c.hz);
  const baseGeo = buildVoxelGeometry(c.v, VOXEL_SIZE);
  baseGeo.computeBoundingBox();
  let topY = baseGeo.boundingBox?.max.y ?? 1;
  const rotors: BuiltRotor[] = c.rotors.map((r) => {
    const geo = buildVoxelGeometry(r.vox, VOXEL_SIZE);
    geo.computeBoundingBox();
    topY = Math.max(topY, (r.pivot[1] * VOXEL_SIZE) + (geo.boundingBox?.max.y ?? 0));
    return { geo, pivot: r.pivot, axis: r.axis, speed: r.speed, wind: Boolean(r.wind) };
  });
  return {
    baseGeo,
    voxelCount: c.v.size + c.rotors.reduce((n, r) => n + r.vox.size, 0),
    topY: Math.max(0.3, topY),
    bobOnWater: c.floating || def.domain === "water",
    rotors,
    smokePoints: c.smokePoints.map(([x, y, z, k]) => [x * VOXEL_SIZE, y * VOXEL_SIZE, z * VOXEL_SIZE, k]),
    blinkers: c.blinkers.map(([x, y, z, col]) => [(x + 0.5) * VOXEL_SIZE, (y + 0.5) * VOXEL_SIZE, (z + 0.5) * VOXEL_SIZE, col]),
  };
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
  const leafCol = style % 3 === 0 ? "leaf" : style % 3 === 1 ? "leafLight" : "pink";
  v.sphere(cx + 0.5, y0 + 4.2, cz + 0.5, 1.8, 1.7, 1.8, leafCol);
}

function addCypressMini(v: PixelVox, cx: number, y0: number, cz: number, h = 7) {
  v.box(cx, y0, cz, cx + 1, y0 + 2, cz + 1, "woodDark");
  v.cone(cx + 0.5, y0 + 2, y0 + h, cz + 0.5, 1.3, 0.45, "leafDark");
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
 * Builds a cylindrical/octagonal tower wrapped in a rising 3D exterior helical spiral ramp/staircase,
 * topped with an optional dome/cone lantern and spire.
 */
function addSpiralTower(
  v: PixelVox,
  cx: number,
  cz: number,
  y0: number,
  height: number,
  radius: number,
  coreCol: string,
  spiralCol: string,
  capCol: string,
  glowCol = "warmGlow",
) {
  const h = Math.max(5, Math.round(height));
  const r = Math.max(1.6, radius);
  v.cylinderY(cx, cz, y0, y0 + h, r, coreCol);
  // Slit windows up the shaft
  for (let y = y0 + 2; y < y0 + h - 1; y += 3) {
    v.put(Math.round(cx), y, Math.round(cz + r), "glass", 0.55);
    v.put(Math.round(cx), y, Math.round(cz - r), "glass", 0.55);
  }
  // Rising 3D helical spiral ribbon wrapping around the shaft
  const spiralR = r + 0.95;
  const subSteps = h * 3;
  for (let i = 0; i <= subSteps; i++) {
    const t = i / subSteps;
    const yy = y0 + Math.floor(t * (h - 1));
    const ang = t * Math.PI * 2 * Math.max(1.5, h / 6.5);
    const sx = Math.round(cx + Math.cos(ang) * spiralR);
    const sz = Math.round(cz + Math.sin(ang) * spiralR);
    v.put(sx, yy, sz, spiralCol);
    if (i % 4 === 0) {
      v.put(sx, yy + 1, sz, glowCol, 0.7);
    }
  }
  // Crown dome + finial spire
  v.dome(cx, y0 + h, cz, r + 0.4, capCol);
  const topSpire = y0 + h + Math.ceil(r) + 2;
  v.box(Math.round(cx), y0 + h + Math.floor(r * 0.6), Math.round(cz), Math.round(cx) + 1, topSpire, Math.round(cz) + 1, "gold", 0.85);
  v.put(Math.round(cx), topSpire, Math.round(cz), glowCol, 1.2);
}

/**
 * Adds asymmetrical skyline crowns (offset corner turret + lower rooftop garden terrace + helical/stepped spire)
 * so leveled-up buildings become more sculptural rather than stacking rectangular boxes.
 */
function addUpperTierAndCrown(
  v: PixelVox,
  bx: number,
  bz: number,
  topY: number,
  clampedLv: number,
  wallCol: string,
  trimCol: string,
  glowCol = "warmGlow",
) {
  if (clampedLv <= 1) return;
  // Cornice parapet with corner finials
  v.box(-bx, topY, -bz, bx, topY + 1, bz, trimCol);
  if (bx >= 4 && bz >= 4) {
    // Rooftop greenery terrace on one side
    v.box(-bx + 1, topY + 1, -bz + 1, 0, topY + 2, bz - 1, "leafLight");
  }
  if (clampedLv >= 3 && bx >= 4 && bz >= 4) {
    // Offset octagonal/cylindrical corner tower instead of a centered rectangular slab
    const rad = Math.min(3.4, Math.max(2.0, Math.min(bx, bz) * 0.45));
    const tx = Math.max(0, bx - Math.ceil(rad) - 1);
    const tz = -Math.max(0, bz - Math.ceil(rad) - 1);
    const tierH = 4 + (clampedLv - 2) * 2;
    addSpiralTower(v, tx, tz, topY + 1, tierH, rad, wallCol, trimCol, trimCol, glowCol);
    if (clampedLv >= 5 && bx >= 6) {
      // Secondary lower dome pavilion + connecting skywalk
      v.dome(-Math.floor(bx * 0.45), topY + 1, Math.floor(bz * 0.35), 2.5, "glass", 0.65);
      v.box(-Math.floor(bx * 0.45), topY + 2, -1, Math.round(tx), topY + 3, 1, trimCol);
    }
  } else if (clampedLv >= 4) {
    addSpiralTower(v, 0, 0, topY + 1, 5, 1.8, wallCol, trimCol, trimCol, glowCol);
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
  const isTwoLane = def.id === "two_lane_roads";
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

  const halfW = isFreeway ? 6 : isHighway ? 5 : isTwoLane ? 4 : isBoardwalk ? 4 : isDirtRoad ? 2 : 3;
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
  const clampedLv = Math.max(1, Math.min(5, level | 0));
  const clampedVar = ((variant | 0) % 4 + 4) % 4;
  const key = `${elementId}|L${clampedLv}|V${clampedVar}|${spanX}x${spanZ}|C${def?.isNetwork ? connMask : 0}`;
  const existing = assetCache.get(key);
  if (existing) return existing;

  if (!def) {
    const fallback = new PixelVox(1);
    fallback.box(-5, 0, -5, 5, 8, 5, "brick");
    const asset = { baseGeo: buildVoxelGeometry(fallback), topY: 2.2 };
    assetCache.set(key, asset);
    return asset;
  }

  const designed = buildFromDesign(def, clampedLv, clampedVar, spanX, spanZ, def.isNetwork ? connMask : 0);
  if (designed) {
    assetCache.set(key, designed);
    return designed;
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

  // Base turf/plinth (+ dressed stone/brass prestige border for Lv.3-5 buildings)
  if (def.domain === "water") {
    bobOnWater = true;
  } else if (!def.passiveNature) {
    const groundCol =
      def.category === "agriculture"
        ? "soil"
        : def.category === "civic_parks" &&
            (def.archetype === "park_green" || def.archetype === "garden_formal")
          ? "grass3"
          : def.id === "beach_houses"
            ? "sand"
            : st.plinth;
    v.box(-padX, 0, -padZ, padX, 1, padZ, groundCol);
    if (clampedLv >= 3) {
      const borderCol = clampedLv >= 5 ? "gold" : "marbleShade";
      v.box(-padX, 1, -padZ, -padX + 1, 2, -padZ + 1, borderCol);
      v.box(padX - 1, 1, -padZ, padX, 2, -padZ + 1, borderCol);
      v.box(-padX, 1, padZ - 1, -padX + 1, 2, padZ, borderCol);
      v.box(padX - 1, 1, padZ - 1, padX, 2, padZ, borderCol);
    }
  }

  // ===================== BESPOKE ARCHITECTURAL DESIGNS FOR ALL ~148 ELEMENTS =====================
  switch (def.id) {
    // --------------------- HOUSING (14) ---------------------
    case "tiny_homes": {
      // Sculptural Nordic A-frame tiny cabin with timber deck & loft skylight (adds side greenhouse/spiral stair at Lv.3-5)
      const baseH = 3 + clampedLv;
      const bx = Math.min(6, Math.max(3, padX - 1));
      const bz = Math.min(5, Math.max(3, padZ - 1));
      v.box(-bx, 1, -bz, bx, 2, bz + 1, "woodDark"); // raised cedar deck
      const cabinX1 = clampedLv >= 3 ? 2 : bx;
      v.box(-bx, 2, -bz, cabinX1, 2 + baseH, bz, clampedVar % 2 === 0 ? "woodLight" : "oak");
      // Steep Nordic A-frame roof reaching low & rising into a sharp ridge
      addGableSafe(v, -bx - 1, 2 + Math.max(2, baseH - 2), -bz, cabinX1 + 1, bz, 4 + clampedLv, "x", "slate", "wood");
      v.box(-2, 3 + baseH, -bz + 1, 1, 4 + baseH, bz - 1, "solarBlue");
      v.put(-1, 3, bz - 1, "warmGlow", 0.9);
      v.box(-2, 2, bz - 1, 0, 4, bz, "woodDark");
      if (clampedLv >= 2) {
        // Glass sunroom pod on +X side (tall A-frame + low glass sunroom!)
        v.box(cabinX1, 2, -bz + 1, bx, 5, bz, "glass", 0.55);
        v.box(cabinX1, 5, -bz + 1, bx, 6, bz, "woodDark");
      }
      if (clampedLv >= 4) {
        // Mini lookout crow's-nest turret
        v.cylinderY(-bx + 2, -bz + 2, 2 + baseH, 7 + baseH + clampedLv, 1.6, "wood");
        v.cone(-bx + 2, 7 + baseH + clampedLv, 10 + baseH + clampedLv, -bz + 2, 2.0, 0.4, "copper");
      }
      break;
    }

    case "trailer_home": {
      // Rounded retro Airstream / mobile trailer court — NEVER a cube!
      // Lv.1: single sleek rounded trailer on wheels with striped awning.
      // Lv.2-5: L-shaped / twin staggered trailer park community around a timber pergola deck & palm/blossom tree!
      const bx = Math.max(5, padX - 1);
      const bodyCol = clampedVar === 0 ? "silver" : clampedVar === 1 ? "cream" : clampedVar === 2 ? "white" : "sky";
      const bandCol = clampedVar === 0 ? "teal" : clampedVar === 1 ? "orange" : clampedVar === 2 ? "crimson" : "gold";

      const zBack0 = clampedLv >= 2 ? -Math.min(padZ - 1, 6) : -3;
      const zBack1 = zBack0 + 5;
      // Hitch + chassis + wheels on primary trailer
      v.box(-bx, 1, zBack0 + 2, -bx + 2, 2, zBack0 + 3, "steelDark");
      v.box(-bx + 1, 1, zBack0 + 1, bx - 1, 2, zBack1 - 1, "charcoal");
      for (const wx of [-Math.floor(bx * 0.4), Math.floor(bx * 0.4)]) {
        v.box(wx - 1, 1, zBack1 - 1, wx + 1, 3, zBack1, "rubber");
        v.box(wx - 1, 1, zBack0, wx + 1, 3, zBack0 + 1, "rubber");
      }
      // Rounded Airstream shell (chamfered top roof instead of boxy slab)
      v.box(-bx + 1, 2, zBack0, bx - 1, 6, zBack1, bodyCol);
      v.box(-bx + 2, 6, zBack0 + 1, bx - 2, 7, zBack1 - 1, "chrome");
      v.box(-bx + 1, 3, zBack0, bx - 1, 4, zBack1, bandCol);
      for (let x = -bx + 2; x < bx - 2; x += 3) {
        v.put(x, 4, zBack1 - 1, "glass", 0.5);
      }
      // Striped patio awning + timber deck in front
      const deckZ1 = Math.min(padZ, zBack1 + (clampedLv >= 2 ? 5 : 2));
      v.box(-bx + 2, 1, zBack1, bx - 2, 2, deckZ1, "woodLight");
      for (let x = -bx + 2; x < bx - 2; x++) {
        v.put(x, 5, zBack1, x % 2 === 0 ? bandCol : "white");
      }
      if (clampedLv >= 3) {
        // Second angled/offset vintage camper + elevated wooden observation gazebo!
        const c2x0 = -bx + 1;
        const c2x1 = Math.min(0, c2x0 + 7);
        v.box(c2x0, 2, 1, c2x1, 5, Math.min(padZ, 5), "cream");
        v.box(c2x0 + 1, 5, 2, c2x1 - 1, 6, Math.min(padZ - 1, 4), bandCol);
        addTreeMini(v, bx - 3, 2, Math.min(padZ - 2, 2), clampedVar);
      }
      if (clampedLv >= 4) {
        // String-lit timber lookout pergola tower over the deck
        const gx0 = Math.max(1, bx - 6);
        for (const px of [gx0, bx - 2]) {
          for (const pz of [zBack0 + 1, Math.min(padZ - 2, 3)]) {
            v.box(px, 2, pz, px + 1, 8 + clampedLv, pz + 1, "woodDark");
          }
        }
        addHippedRoofSafe(v, gx0 - 1, 8 + clampedLv, zBack0, bx - 1, Math.min(padZ - 1, 4), 3, bandCol, "woodLight");
        v.put(gx0 + 1, 7 + clampedLv, 1, "warmGlow", 1.1);
      }
      break;
    }

    case "cottages": {
      // Storybook cross-gable stone & thatch cottage with round fairy-tale turret at higher levels!
      const h = 4 + clampedLv;
      const bx = Math.max(4, padX - 2);
      const bz = Math.max(4, padZ - 2);
      const mainX1 = clampedLv >= 2 ? Math.max(2, bx - 3) : bx;
      v.box(-bx, 1, -bz, mainX1, 3, bz - 1, "stone");
      v.box(-bx, 3, -bz, mainX1, 2 + h, bz - 1, "cream");
      addGableSafe(v, -bx - 1, 2 + h, -bz - 1, mainX1 + 1, bz, 4 + Math.min(2, clampedLv), "x", "wood", "oak");
      // Tall crooked stone hearth chimney
      v.box(-bx + 1, 2 + h, -bz + 1, -bx + 3, 7 + h + clampedLv, -bz + 3, "stone");
      // Flower boxes & arched oak door
      v.box(-2, 1, bz - 2, 0, 4, bz, "oak");
      v.box(-bx + 1, 2, bz - 1, -bx + 3, 3, bz, "pink");
      addWindowGrid(v, -bx, 3, -bz, mainX1, 2 + h, bz - 1, 3, 0.42, "warmGlow");
      if (clampedLv >= 2) {
        // Round storybook stone turret with tall witch-hat conical roof!
        const tr = Math.min(2.8, Math.max(1.8, (bx - mainX1) * 0.8 + 1.4));
        const tx = Math.min(padX - 3, mainX1 + 1);
        const tz = Math.min(padZ - 3, bz - 2);
        const th = h + 4 + clampedLv * 2;
        v.cylinderY(tx, tz, 1, th, tr, "stone");
        v.put(Math.round(tx), th - 2, Math.round(tz + tr), "warmGlow", 0.9);
        v.cone(tx, th, th + 5 + clampedLv, tz, tr + 0.8, 0.35, "terracotta");
      }
      if (clampedLv >= 3) addTreeMini(v, -padX + 2, 1, padZ - 3, clampedVar);
      break;
    }

    case "house": {
      // Classic family home: L-shaped cross-gable with low front porch + taller corner dormer/turret wing as it levels up (NEVER a big box!)
      const lowH = 4 + Math.min(3, clampedLv);
      const tallH = 5 + clampedLv * 2;
      const bx = Math.max(5, padX - 2);
      const bz = Math.max(5, padZ - 2);
      const splitX = clampedLv >= 2 ? 0 : bx;
      // Low wide living wing + covered front porch
      v.hollowBox(-bx, 1, -bz, bx, 1 + lowH, clampedLv >= 2 ? 1 : bz - 1, st.wall, st.trim);
      addWindowGrid(v, -bx, 2, -bz, bx, 1 + lowH, clampedLv >= 2 ? 1 : bz - 1, 3, 0.4);
      addGableSafe(v, -bx - 1, 1 + lowH, -bz - 1, bx + 1, clampedLv >= 2 ? 2 : bz, 4, "x", st.roof, st.trim);

      if (clampedLv >= 2) {
        // Projecting taller front gable wing on +X + sunlit front veranda on -X
        v.hollowBox(splitX - 1, 1, -2, bx, 1 + tallH, bz, st.wall, st.trim);
        addWindowGrid(v, splitX - 1, 2, -2, bx, 1 + tallH, bz, 3, 0.45);
        addGableSafe(v, splitX - 2, 1 + tallH, -3, bx + 1, bz + 1, 4 + Math.min(2, clampedLv - 1), "z", st.roof, st.trim);
        // Front porch deck & pillars on -X front quadrant
        v.box(-bx, 1, 1, splitX - 1, 2, bz, "woodLight");
        v.box(-bx, 2, bz - 1, -bx + 1, 5, bz, st.trim);
        v.box(-bx, 5, 1, splitX - 1, 6, bz, st.roof);
      }
      // Front door, warm porch lantern & brick chimney
      v.box(-1, 1, (clampedLv >= 2 ? 0 : bz - 2), 1, 4, (clampedLv >= 2 ? 2 : bz), "woodDark");
      v.put(2, 3, bz - 1, "warmGlow", 0.95);
      v.box(-bx + 1, 1 + lowH, -bz + 1, -bx + 3, 6 + tallH, -bz + 3, "brickDark");
      if (clampedLv >= 3) addTreeMini(v, -padX + 2, 1, padZ - 3, clampedVar);
      if (clampedLv >= 4) {
        // Octagonal attic cupola / belvedere lantern on the tall wing
        v.cylinderY(Math.floor((splitX + bx) * 0.5), 1, 2 + tallH, 6 + tallH, 1.9, st.trim);
        v.cone(Math.floor((splitX + bx) * 0.5), 6 + tallH, 10 + tallH, 1, 2.3, 0.4, st.roof);
      }
      break;
    }

    case "medium_sized_homes": {
      // Split-level suburban home: low 1-story garage + mid-height living wing + tall 3-story corner study tower at Lv.3-5
      const h = 5 + clampedLv * 2;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(4, padZ - 2);
      const houseX1 = Math.max(0, bx - 4);
      v.hollowBox(-bx, 1, -bz, houseX1, 1 + h, bz - 1, st.wall, st.trim);
      addWindowGrid(v, -bx, 2, -bz, houseX1, 1 + h, bz - 1, 3, 0.4);
      addGableSafe(v, -bx - 1, 1 + h, -bz - 1, houseX1 + 1, bz, 4, "x", st.roof, "white");
      // Low attached garage + rooftop sundeck
      v.box(houseX1, 1, -bz + 1, bx, 5, bz, st.wall);
      v.box(houseX1 + 1, 1, bz - 1, bx - 1, 4, bz, "white");
      v.box(houseX1, 5, -bz + 1, bx, 6, bz, "woodLight"); // rooftop terrace over garage!
      v.box(houseX1, 0, bz, bx, 1, padZ, "concrete2");
      if (clampedLv >= 3) {
        // Tall octagonal bay-window corner tower on -X/+Z
        const th = h + 4 + clampedLv;
        v.cylinderY(-bx + 2.5, bz - 1.5, 1, th, 2.4, st.wall);
        addWindowGrid(v, -bx + 1, 2, bz - 3, -bx + 4, th, bz, 3, 0.5);
        v.cone(-bx + 2.5, th, th + 5, bz - 1.5, 2.8, 0.4, st.roof);
      }
      break;
    }

    case "townhomes": {
      // Stepped Amsterdam/Brownstone rowhouses with varied gable/mansard heights & rooftop conservatory
      const baseH = 7 + clampedLv * 2;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(4, padZ - 2);
      const rowCols = ["brick", "terracotta", "limestone", "tealDark"];
      const units = spanX >= 2 ? 3 : 2;
      const stepW = Math.floor((bx * 2) / units);
      for (let u = 0; u < units; u++) {
        const ux0 = -bx + u * stepW;
        const ux1 = u === units - 1 ? bx : ux0 + stepW;
        // Dramatic stair-stepped heights (low -> mid -> tall spire gable!)
        const uh = baseH + u * (2 + Math.floor(clampedLv * 0.6));
        const uCol = rowCols[(u + clampedVar) % rowCols.length];
        v.box(ux0, 1, -bz, ux1, 1 + uh, bz, uCol);
        addWindowGrid(v, ux0, 2, -bz, ux1, 1 + uh, bz, 3, 0.45);
        // Stepped Dutch bell-gable roof on each rowhouse!
        addGableSafe(v, ux0, 1 + uh, -bz, ux1, bz, 3 + (u % 2), "z", u % 2 === 0 ? "slate" : "copper", "white");
        const doorX = Math.floor((ux0 + ux1) / 2);
        v.box(doorX - 1, 1, bz - 1, doorX + 1, 4, bz + 2, "woodDark");
      }
      break;
    }

    case "large_homes": {
      // Asymmetrical Tudor/Victorian manor with L-wings, wrap veranda, conservatory dome & tall octagonal turret!
      const lowH = 6 + clampedLv;
      const mainH = 7 + clampedLv * 2;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 2);
      // Low rear & west wing
      v.box(-bx, 1, -bz, bx - 2, 1 + lowH, 0, st.wall);
      addGableSafe(v, -bx - 1, 1 + lowH, -bz - 1, bx - 1, 1, 4, "x", st.roof, "white");
      // Tall east gable wing
      v.box(1, 1, -bz + 1, bx, 1 + mainH, bz, st.wall);
      addWindowGrid(v, 1, 2, -bz + 1, bx, 1 + mainH, bz, 3, 0.45);
      addGableSafe(v, 0, 1 + mainH, -bz + 1, bx + 1, bz + 1, 5, "z", st.roof, "white");
      // Signature Victorian octagonal turret at the inner L-elbow!
      const turH = mainH + 5 + clampedLv * 2;
      v.cylinderY(0, 0.5, 1, turH, 2.5, st.wall);
      v.put(0, turH - 2, 3, "warmGlow", 1.0);
      v.cone(0, turH, turH + 6, 0.5, 3.0, 0.35, "copper");
      // Sunlit glass conservatory + lawn tree in SW courtyard
      v.dome(-Math.floor(bx * 0.55), 1, Math.floor(bz * 0.45), 2.6, "glass", 0.55);
      addTreeMini(v, -padX + 2, 1, padZ - 2, clampedVar);
      break;
    }

    case "beach_houses": {
      // Multi-deck coastal stilt pavilion with elevated catwalk, octagonal crow's-nest lookout & spiral beach stair!
      const h = 5 + clampedLv;
      const bx = Math.max(5, padX - 2);
      const bz = Math.max(4, padZ - 2);
      const deckY = 4;
      for (const px of [-bx + 1, 0, bx - 2]) {
        for (const pz of [-bz + 1, bz - 1]) {
          v.box(px, 1, pz, px + 1, deckY, pz + 1, "woodDark");
        }
      }
      v.box(-bx - 1, deckY, -bz - 1, bx + 1, deckY + 1, bz + 2, "woodLight");
      const bodyC = clampedVar === 0 ? "cyan" : clampedVar === 1 ? "pink" : clampedVar === 2 ? "sky" : "yellow";
      // Main breezy beach bungalow on -X + open sun-lounge deck on +X
      const mainX1 = Math.max(1, bx - 3);
      v.box(-bx + 1, deckY + 1, -bz, mainX1, deckY + 1 + h, bz, bodyC);
      addWindowGrid(v, -bx + 1, deckY + 2, -bz, mainX1, deckY + 1 + h, bz, 3, 0.5);
      addGableSafe(v, -bx, deckY + 1 + h, -bz - 1, mainX1 + 1, bz + 1, 4, "x", "white", "teal");
      if (clampedLv >= 2) {
        // Tall coastal lighthouse-style ocean lookout cupola with spiral stair!
        addSpiralTower(
          v,
          mainX1 - 1,
          -bz + 2,
          deckY + 1 + h,
          4 + clampedLv * 2,
          1.9,
          "white",
          "woodLight",
          "teal",
          "warmGlow",
        );
      }
      // Umbrella & pool/jacuzzi on sun deck
      v.box(mainX1 + 1, deckY + 1, -2, bx, deckY + 2, 1, "water", 0.35);
      v.box(bx - 1, deckY + 1, bz, bx, deckY + 4, bz + 1, "white");
      v.cone(bx - 0.5, deckY + 4, deckY + 6, bz + 0.5, 2.2, 0.5, "red");
      break;
    }

    case "villas": {
      // Mediterranean terracotta hillside-style tiered villa: low arched loggia + swimming pool court + tall campanile mirador tower!
      const lowH = 5 + clampedLv;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, bx, 1 + lowH, -1, "plaster");
      v.box(-bx, 1, -1, -2, 1 + lowH - 1, bz, "cream");
      // Turquoise courtyard pool + cypress trees
      v.box(0, 1, 1, bx - 1, 2, bz - 1, "water", 0.3);
      addWindowGrid(v, -bx, 2, -bz, bx, 1 + lowH, -1, 3, 0.42);
      addHippedRoofSafe(v, -bx - 1, 1 + lowH, -bz - 1, bx + 1, 0, 3, "terracotta", "cream");
      addHippedRoofSafe(v, -bx - 1, lowH, -1, -1, bz + 1, 3, "terracotta", "cream");
      // Signature tall Tuscan campanile tower rising above the villa!
      const towH = lowH + 6 + clampedLv * 3;
      v.box(-bx + 1, 1 + lowH, -bz + 1, -bx + 6, towH, -bz + 6, "plaster");
      v.put(-bx + 3, towH - 2, -bz + 6, "warmGlow", 1.0);
      addHippedRoofSafe(v, -bx, towH, -bz, -bx + 7, -bz + 7, 4, "terracotta", "gold");
      addCypressMini(v, padX - 2, 1, padZ - 2, 8 + clampedLv);
      break;
    }

    case "apartments": {
      // U-shaped courtyard brick residential complex (NOT a solid block!): twin unequal wings + courtyard arch + rooftop conservatory & water tower!
      const westH = 8 + clampedLv * 3;
      const eastH = 6 + clampedLv * 2;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const col = clampedVar % 2 === 0 ? "brick" : "brick2";
      // Rear bar + taller West wing + lower East terraced wing leaving a sunny front courtyard!
      v.box(-bx, 1, -bz, bx, 1 + eastH, -1, col);
      v.box(-bx, 1, -bz, -2, 1 + westH, bz, col);
      v.box(2, 1, -bz, bx, 1 + eastH, bz - 1, "limestone");
      addWindowGrid(v, -bx, 2, -bz, -2, 1 + westH, bz, 3, 0.45);
      addWindowGrid(v, 2, 2, -bz, bx, 1 + eastH, bz - 1, 3, 0.42);
      // Courtyard greenery + street archway
      v.box(-2, 1, 1, 2, 2, bz - 1, "grass3");
      v.box(-2, 4, bz - 1, 2, 6, bz, "limestone");
      // Rooftop green garden on lower East wing + cedar water tank on taller West wing
      v.box(3, 1 + eastH, -bz + 1, bx - 1, 2 + eastH, bz - 2, "leafLight");
      v.cylinderY(-bx + 3, -bz + 3, 1 + westH, 5 + westH, 1.9, "wood");
      v.cone(-bx + 3, 5 + westH, 8 + westH, -bz + 3, 2.2, 0.4, "slate");
      break;
    }

    case "apartment_buildings": {
      // Twin-tower skybridge residential complex: soaring main tower + mid-rise wing + elevated glass skybridge + spiral crown!
      const tallH = Math.round(13 * (0.85 + clampedLv * 0.34));
      const lowH = Math.round(tallH * 0.62);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      const mainCol = clampedVar % 2 === 0 ? "concrete" : "slateLight";
      // Tall Northwest tower
      v.box(-bx, 1, -bz, -1, 1 + tallH, bz - 1, mainCol);
      addWindowGrid(v, -bx, 2, -bz, -1, 1 + tallH, bz - 1, 2, 0.48);
      // Lower Southeast terraced wing
      v.box(2, 1, -bz + 2, bx, 1 + lowH, bz, "white");
      addWindowGrid(v, 2, 2, -bz + 2, bx, 1 + lowH, bz, 2, 0.48);
      v.box(3, 1 + lowH, -bz + 3, bx - 1, 2 + lowH, bz - 1, "leaf"); // sky-park terrace
      // Elevated glass skybridge linking the two towers!
      const bridgeY = Math.max(5, lowH - 3);
      v.box(-1, bridgeY, -2, 2, bridgeY + 3, 2, "glass", 0.7);
      if (clampedLv >= 3) {
        addSpiralTower(v, -Math.floor(bx * 0.55), -1, 1 + tallH, 4 + clampedLv * 2, 2.4, "white", "sky", "steelLight", "screenCyan");
      }
      break;
    }

    case "condos": {
      // Sculptural twisting/stepped Marina-style luxury condo: stacked shifting floorplates, turquoise wrap terraces, infinity sky-pool & spire!
      const tiers = 2 + clampedLv;
      const tierH = 4;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(6, padZ - 1);
      let curY = 1;
      for (let t = 0; t < tiers; t++) {
        const shrink = Math.floor(t * 0.7);
        const shiftX = Math.round(Math.sin(t * 0.9) * Math.min(2, shrink + 1));
        const shiftZ = Math.round(Math.cos(t * 0.9) * Math.min(2, shrink + 1));
        const x0 = Math.max(-bx, -bx + shrink + shiftX);
        const x1 = Math.min(bx, bx - shrink + shiftX);
        const z0 = Math.max(-bz, -bz + shrink + shiftZ);
        const z1 = Math.min(bz, bz - shrink + shiftZ);
        v.box(x0, curY, z0, x1, curY + tierH - 1, z1, "white");
        addWindowGrid(v, x0, curY, z0, x1, curY + tierH - 1, z1, 2, 0.6, "screenCyan");
        // Cantilevered glowing cyan glass wrap-balcony slab!
        v.box(Math.max(-padX, x0 - 1), curY + tierH - 1, Math.max(-padZ, z0 - 1), Math.min(padX, x1 + 1), curY + tierH, Math.min(padZ, z1 + 1), "cyan", 0.35);
        curY += tierH;
      }
      // Rooftop infinity pool + sculptural sail fin!
      v.box(-3, curY, -2, 3, curY + 1, 2, "water", 0.45);
      addSpiralTower(v, 0, -1, curY, 4 + clampedLv * 2, 2.0, "white", "cyan", "glass", "screenCyan");
      break;
    }

    case "mansions": {
      // Grand Baroque/Neoclassical Palace: central golden-domed rotunda + curved/stepped colonnade wings + forecourt fountain!
      const wingH = 6 + clampedLv;
      const centerH = 9 + clampedLv * 2;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(6, padZ - 1);
      // Central grand corps-de-logis + rotunda drum
      v.box(-5, 1, -bz, 5, 1 + centerH, 1, "marble");
      addWindowGrid(v, -5, 2, -bz, 5, 1 + centerH, 1, 3, 0.48);
      v.cylinderY(0, -Math.floor(bz * 0.4), 1 + centerH, 5 + centerH, 3.8, "marble");
      v.dome(0, 5 + centerH, -Math.floor(bz * 0.4), 4.0, "gold");
      // Lower flanking east & west pavilion wings framing the court of honor
      v.box(-bx, 1, -bz + 1, -5, 1 + wingH, bz - 1, "marbleShade");
      v.box(5, 1, -bz + 1, bx, 1 + wingH, bz - 1, "marbleShade");
      addHippedRoofSafe(v, -bx, 1 + wingH, -bz + 1, -4, bz - 1, 3, "slate", "gold");
      addHippedRoofSafe(v, 4, 1 + wingH, -bz + 1, bx, bz - 1, 3, "slate", "gold");
      // Pillared portico + turquoise marble fountain in front courtyard
      for (let x = -4; x <= 4; x += 2) {
        v.box(x, 1, 1, x + 1, 1 + wingH, 2, "white");
      }
      v.cylinderY(0, Math.min(bz - 2, 4), 1, 3, 2.4, "marble");
      v.sphere(0, 4, Math.min(bz - 2, 4), 1.3, 1.4, 1.3, "cyan", 0.65);
      break;
    }

    case "skyscrapers": {
      // Iconic supertall twisting/tapered spire + low glass atrium wing + helical exterior diagrid ribbon!
      const totalH = Math.round(24 * (0.85 + clampedLv * 0.36));
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(7, padZ - 1);
      const baseCol = clampedVar % 2 === 0 ? "steelLight" : "glassDark";
      // Low 5-voxel skylit atrium lobby wing on +Z/+X
      v.box(-bx, 1, 1, bx, 6, bz, "glass", 0.55);
      v.dome(Math.floor(bx * 0.45), 6, Math.floor(bz * 0.45), 3.0, "screenCyan", 0.6);
      // Tapered stepped octagonal/helical tower shaft
      const shaftCx = -1;
      const shaftCz = -1;
      const maxR = Math.min(6.2, Math.min(bx, bz) * 0.68);
      v.cone(shaftCx, 1, totalH, shaftCz, maxR, Math.max(2.2, maxR * 0.38), baseCol);
      // Glowing spiral diagrid + sky-gardens wrapping all the way up the supertall!
      for (let y = 2; y < totalH; y++) {
        const t = y / totalH;
        const r = (1 - t) * maxR + t * Math.max(2.2, maxR * 0.38) + 0.35;
        const ang1 = y * 0.32;
        const ang2 = ang1 + Math.PI;
        v.put(Math.round(shaftCx + Math.cos(ang1) * r), y, Math.round(shaftCz + Math.sin(ang1) * r), "chrome");
        v.put(Math.round(shaftCx + Math.cos(ang2) * r), y, Math.round(shaftCz + Math.sin(ang2) * r), "screenCyan", 0.95);
      }
      // Crown spire needle
      v.box(shaftCx, totalH, shaftCz, shaftCx + 1, totalH + 9 + clampedLv, shaftCz + 1, "chrome");
      v.put(shaftCx, totalH + 9 + clampedLv, shaftCz, "red", 1.35);
      break;
    }

    // --------------------- AGRICULTURE (6) ---------------------
    case "farms": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "soilDark");
      for (let x = -padX + 1; x < 0; x += 2) {
        v.box(x, 1, -padZ + 1, x + 1, 3 + Math.min(3, clampedLv), padZ - 1, "lime");
      }
      const shedH = 4 + clampedLv;
      v.box(1, 1, 0, padX - 1, shedH, padZ - 1, "brick");
      addGableSafe(v, 1, shedH, 0, padX - 1, padZ - 1, 3, "x", "woodDark");
      const sh = 7 + clampedLv * 3;
      v.cylinderY(padX - 3, -padZ + 3, 1, sh, 2.2, "silver");
      v.dome(padX - 3, sh, -padZ + 3, 2.3, "red");
      if (clampedLv >= 3) {
        v.cylinderY(Math.max(2, padX - 8), -padZ + 3, 1, sh - 3, 1.8, "silver");
        v.dome(Math.max(2, padX - 8), sh - 3, -padZ + 3, 1.9, "red");
      }
      break;
    }

    case "farm_houses": {
      const h = 5 + clampedLv * 2;
      const bx = Math.max(5, padX - 2);
      const bz = Math.max(5, padZ - 2);
      // Gambrel red barn + lower white farmhouse porch wing + tall cream silo!
      v.box(-bx, 1, -bz, 1, 1 + h, bz - 1, "crimson");
      v.box(-bx + 1, 1, bz - 2, -1, 4, bz - 1, "white");
      addGableSafe(v, -bx - 1, 1 + h, -bz - 1, 2, bz, 5, "x", "slate", "white");
      // Lower white farmhouse wing on +X/+Z
      v.box(1, 1, -1, bx, 5 + Math.min(3, clampedLv), bz, "white");
      addGableSafe(v, 1, 5 + Math.min(3, clampedLv), -1, bx + 1, bz + 1, 3, "z", "woodDark");
      v.cylinderY(bx - 2, -bz + 2, 1, 5 + h + clampedLv * 2, 2.0, "cream");
      v.dome(bx - 2, 5 + h + clampedLv * 2, -bz + 2, 2.1, "silver");
      break;
    }

    case "fields": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "soil");
      const bands = ["yellow", "gold", "lime", "purple"];
      for (let z = -padZ + 1; z < padZ - 1; z += 3) {
        const c = bands[(Math.abs(z) + clampedVar) % bands.length];
        v.box(-padX + 1, 1, z, padX - 1, 2 + Math.min(3, clampedLv), z + 2, c);
      }
      v.box(0, 1, 0, 1, 4 + clampedLv, 1, "woodDark");
      v.box(-1, 3, 0, 2, 4, 1, "oak");
      v.put(0, 4 + clampedLv, 0, "orange");
      if (clampedLv >= 3) {
        // Rustic timber wind-pump tower over the golden fields
        v.cone(-padX + 3, 1, 8 + clampedLv * 2, -padZ + 3, 2.0, 0.7, "woodDark");
        v.ringZ(-padX + 3, 8 + clampedLv * 2, -padZ + 4, -padZ + 5, 2.2, 0.6, "silver");
      }
      break;
    }

    case "orchards": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      const step = 5;
      for (let x = -padX + 2; x <= padX - 2; x += step) {
        for (let z = -padZ + 2; z <= padZ - 2; z += step) {
          const th = 3 + clampedLv * 2;
          v.box(x, 1, z, x + 1, th, z + 1, "woodDark");
          v.sphere(x + 0.5, th + 1.5, z + 0.5, 2.1, 1.8 + clampedLv * 0.25, 2.1, "leaf");
          v.put(x + 1, th + 1, z + 1, clampedVar % 2 === 0 ? "red" : "orange");
        }
      }
      if (clampedLv >= 3) {
        // Cider press gazebo in corner
        v.cylinderY(padX - 3, padZ - 3, 1, 5 + clampedLv, 2.2, "wood");
        v.cone(padX - 3, 5 + clampedLv, 8 + clampedLv, padZ - 3, 2.6, 0.4, "crimson");
      } else {
        v.box(-padX + 1, 1, padZ - 2, -padX + 3, 3, padZ - 1, "crate");
      }
      break;
    }

    case "groves_of_olives": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "path2");
      // Terraced Mediterranean stone steps!
      v.box(-padX + 1, 1, -padZ + 1, padX - 1, 2 + Math.min(2, clampedLv - 1), 0, "limestone");
      const step = 5;
      for (let x = -padX + 2; x <= padX - 2; x += step) {
        for (let z = -padZ + 2; z <= padZ - 2; z += step) {
          const baseT = z < 0 ? 2 + Math.min(2, clampedLv - 1) : 1;
          const th = baseT + 3 + clampedLv;
          v.box(x, baseT, z, x + 1, th, z + 1, "oak");
          v.sphere(x + 0.5, th + 1.4, z + 0.5, 2.1, 1.5 + clampedLv * 0.2, 2.1, "olive");
          v.put(x, th, z + 1, "purpleDark");
        }
      }
      if (clampedLv >= 3) {
        // Terracotta olive-oil stone mill tower
        v.cylinderY(padX - 3, -padZ + 3, 2, 7 + clampedLv * 2, 2.2, "plaster");
        v.cone(padX - 3, 7 + clampedLv * 2, 10 + clampedLv * 2, -padZ + 3, 2.6, 0.4, "terracotta");
      }
      break;
    }

    case "plantations": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass3");
      const h = 6 + clampedLv * 2;
      const bx = Math.max(5, Math.floor(padX * 0.55));
      v.box(-bx, 1, -padZ + 1, bx, 1 + h, -1, "white");
      for (let x = -bx + 1; x <= bx - 1; x += 2) {
        v.box(x, 1, -1, x + 1, 1 + h, 0, "cream");
      }
      addHippedRoofSafe(v, -bx - 1, 1 + h, -padZ, bx + 1, 0, 4, "slate", "white");
      // Octagonal belvedere cupola on manor roof
      v.cylinderY(0, -Math.floor(padZ * 0.5), 4 + h, 7 + h + clampedLv, 2.0, "white");
      v.dome(0, 7 + h + clampedLv, -Math.floor(padZ * 0.5), 2.2, "copper");
      for (let x = -padX + 1; x < padX - 1; x += 2) {
        v.box(x, 1, 2, x + 1, 3 + Math.min(2, clampedLv - 1), padZ - 1, "lime");
      }
      break;
    }

    // --------------------- COMMERCE & DINING (16 — 100% VISUALLY DISTINCT!) ---------------------
    case "businesses": {
      // STARTER #2: Sleek Modern Blue-Glass & Steel L-Shaped Office Tower + Plaza Fountain!
      // Unmistakable corporate silhouette: tall blue-glass corner tower on -X/-Z + low cantilevered briefing wing on +X + open forecourt plaza!
      const tallH = 7 + clampedLv * 3;
      const lowH = 4 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const splitX = Math.max(1, Math.floor(bx * 0.25));
      // Tall sleek curtain-wall office tower on -X
      v.box(-bx, 1, -bz, splitX, 1 + tallH, bz - 2, "blueDark");
      addWindowGrid(v, -bx, 2, -bz, splitX, 1 + tallH, bz - 2, 2, 0.62, "glass");
      // Vertical steel mullions & angled diagonal crown fin!
      v.box(-bx, 1, bz - 3, -bx + 1, 3 + tallH, bz - 2, "chrome");
      v.box(splitX - 1, 1, bz - 3, splitX, 4 + tallH, bz - 2, "chrome");
      v.box(-bx, 1 + tallH, -bz, splitX, 2 + tallH, bz - 2, "steelLight");
      for (let s = 0; s < Math.min(4, splitX + bx - 1); s++) {
        v.box(-bx + s, 2 + tallH + s, -bz + 1, splitX, 3 + tallH + s, bz - 3, "glass", 0.65);
      }
      // Low cantilevered executive wing on +X
      v.box(splitX, 1, -bz + 1, bx, 1 + lowH, 1, "white");
      addWindowGrid(v, splitX, 2, -bz + 1, bx, 1 + lowH, 1, 2, 0.5);
      v.box(splitX, 1 + lowH, -bz + 1, bx, 2 + lowH, 1, "blue");
      // Open corner plaza with glowing corporate pylon sign & water feature on +X/+Z
      v.box(bx - 2, 1, bz - 2, bx, 5 + clampedLv, bz - 1, "blueDark");
      v.put(bx - 2, 4 + clampedLv, bz - 1, "screenCyan", 1.2);
      if (bx >= 6) {
        v.box(splitX + 1, 1, 2, bx - 2, 2, bz - 2, "water", 0.35);
      }
      if (clampedLv >= 3) {
        addSpiralTower(v, -Math.floor(bx * 0.45), -Math.floor(bz * 0.35), 3 + tallH, 4 + clampedLv * 2, 2.0, "glassDark", "chrome", "blue", "screenCyan");
      }
      break;
    }

    case "grocery_store": {
      // STARTER #5: Curved Barrel-Vaulted Fresh Farmers Market Hall + Outdoor Fruit/Veggie Stalls + Rooftop Red Apple / Greenhouse!
      // ZERO resemblance to Businesses or Shops!
      const wallH = 4 + Math.min(4, clampedLv);
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const hallZ1 = bz - 2; // Leave front apron [bz-2 .. bz] for colorful produce crates!
      v.box(-bx, 1, -bz, bx, 1 + wallH, hallZ1, "cream");
      addWindowGrid(v, -bx, 2, -bz, bx, 1 + wallH, hallZ1, 3, 0.48);
      // Curved green-and-timber barrel-vaulted market roof (arched along X)!
      const archRise = Math.max(3, Math.min(6, Math.floor(bx * 0.55)));
      for (let x = -bx; x < bx; x++) {
        const norm = (x + 0.5) / bx;
        const ay = Math.max(1, Math.round((1 - norm * norm) * archRise));
        v.box(x, 1 + wallH, -bz, x + 1, 1 + wallH + ay, hallZ1, x % 3 === 0 ? "leafDark" : "leaf");
      }
      // Green-and-white striped market awning + outdoor fresh fruit & veggie bins!
      for (let x = -bx; x < bx; x++) {
        v.put(x, 3, hallZ1, x % 2 === 0 ? "leaf" : "white");
        v.put(x, 3, hallZ1 + 1, x % 2 === 0 ? "leaf" : "white");
      }
      // Unmistakable colorful produce stalls out front (red apples, orange citrus, yellow bananas, lime greens)
      v.box(-bx + 1, 1, hallZ1, -1, 2, bz, "crate");
      v.put(-bx + 1, 2, hallZ1, "red");
      v.put(-bx + 2, 2, hallZ1, "orange");
      v.put(-2, 2, hallZ1, "yellow");
      v.box(1, 1, hallZ1, bx - 1, 2, bz, "crate");
      v.put(1, 2, hallZ1, "lime");
      v.put(2, 2, hallZ1, "red");
      // Giant 3D Voxel Red Apple & Green Leaf emblem perched on top of the barrel vault!
      const topArchY = 1 + wallH + archRise;
      v.sphere(0, topArchY + 1.5, 0, 1.9, 1.8, 1.9, "red");
      v.put(0, topArchY + 3, 0, "woodDark");
      v.box(1, topArchY + 3, 0, 3, topArchY + 4, 1, "lime");
      if (clampedLv >= 3 && bx >= 6) {
        // Glass rooftop hydroponic greenhouse dome on rear wing!
        v.dome(-Math.floor(bx * 0.45), topArchY - 1, -Math.floor(bz * 0.35), 3.0, "glass", 0.6);
        v.put(-Math.floor(bx * 0.45), topArchY, -Math.floor(bz * 0.35), "lime");
      }
      break;
    }

    case "shops": {
      // STARTER #10: Picturesque Corner Boutique Arcade with Twin Pitched Gables + Round Corner Turret & Striped Coral Awning!
      const lowH = 4 + clampedLv;
      const tallH = 5 + clampedLv * 2;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Left boutique (terracotta/coral with steep gable)
      v.box(-bx, 1, -bz, 0, 1 + tallH, bz - 1, "terracotta");
      addGableSafe(v, -bx - 1, 1 + tallH, -bz, 1, bz - 1, 4, "z", "goldDark", "cream");
      // Right boutique (warm cream/mustard lower wing)
      v.box(0, 1, -bz + 1, bx - 1, 1 + lowH, bz - 1, "yellow");
      addGableSafe(v, 0, 1 + lowH, -bz + 1, bx, bz - 1, 3, "x", "crimson", "white");
      // Charming round corner bay-window turret with tall pointed witch-cap spire on (+X, +Z)!
      const turR = Math.min(2.6, Math.max(1.8, bx * 0.32));
      const turH = tallH + 3 + clampedLv * 2;
      v.cylinderY(bx - 2, bz - 2, 1, turH, turR, "cream");
      v.put(bx - 2, 3, Math.min(padZ - 1, Math.round(bz - 2 + turR)), "warmGlow", 1.0);
      v.cone(bx - 2, turH, turH + 5 + clampedLv, bz - 2, turR + 0.6, 0.3, "tealDark");
      // Coral & white boutique awning + display windows
      for (let x = -bx; x < bx - 2; x++) {
        v.put(x, 3, bz - 1, x % 2 === 0 ? "orange" : "white");
      }
      addWindowGrid(v, -bx, 2, -bz, 0, 1 + tallH, bz - 1, 3, 0.48);
      break;
    }

    case "blacksmiths": {
      const h = 4 + clampedLv;
      const bx = Math.max(5, padX - 2);
      const bz = Math.max(5, padZ - 2);
      // Open-front timber & stone smithy + massive tapered basalt forge furnace chimney!
      v.box(-bx, 1, -bz, 2, 1 + h, bz - 1, "stone");
      addGableSafe(v, -bx - 1, 1 + h, -bz - 1, 3, bz, 4, "x", "charcoal", "woodDark");
      // Tapered stone blast-furnace tower on +X
      const fh = 8 + h + clampedLv * 3;
      v.cone(bx - 2, 1, fh, -bz + 2.5, 3.0, 1.3, "basalt");
      v.put(bx - 2, fh, -bz + 2, "fire", 1.35);
      v.box(bx - 3, 2, 0, bx - 1, 4, 2, "fire", 1.35); // roaring open hearth
      v.box(-2, 1, bz - 1, 0, 3, bz + 1, "iron"); // anvil
      v.cylinderY(2, bz - 1, 1, 3, 1.4, "water", 0.3); // quench barrel
      break;
    }

    case "restaurants": {
      // Sunlit Bistro Pavilion with Rooftop Terrace Pergola, Corner Wine-Bottle/Bell Tower & Striped Patio Umbrellas!
      const h = 5 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(4, padZ - 1);
      v.box(-bx, 1, -bz, bx - 2, 1 + h, 0, "brick");
      addWindowGrid(v, -bx, 2, -bz, bx - 2, 1 + h, 0, 3, 0.52, "warmGlow");
      addHippedRoofSafe(v, -bx - 1, 1 + h, -bz - 1, bx - 1, 1, 3, "crimson", "cream");
      for (let x = -bx; x < bx - 2; x++) {
        v.put(x, 3, 0, x % 2 === 0 ? "red" : "white");
      }
      // Outdoor dining patio with umbrellas on +Z
      for (const ux of [-3, 2]) {
        v.box(ux, 1, 2, ux + 1, 4, 3, "white");
        v.cone(ux + 0.5, 4, 6, 2.5, 2.1, 0.4, ux < 0 ? "red" : "gold");
      }
      // Tall cylindrical brick pizza-oven / bistro lantern tower on +X/-Z!
      const towH = h + 5 + clampedLv * 2;
      v.cylinderY(bx - 2, -bz + 2, 1, towH, 2.1, "plaster");
      v.cone(bx - 2, towH, towH + 4, -bz + 2, 2.5, 0.4, "terracotta");
      v.put(bx - 2, towH - 1, -bz + 4, "warmGlow", 1.1);
      break;
    }

    case "clothing_stores": {
      // Haute-Couture Cylindrical Glass Rotunda + Helical Pink/Magenta Ribbon Facade & Stepped Runway Wing!
      const h = 6 + clampedLv * 2;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Low sleek white showroom wing on -X
      v.box(-bx, 1, -bz + 1, 1, 5 + clampedLv, bz - 1, "white");
      v.box(-bx + 1, 1, bz - 2, 0, 4, bz - 1, "glass", 0.7);
      v.put(-2, 2, bz - 2, "pink");
      // Tall glamorous circular glass rotunda wrapped in a magenta spiral ribbon on +X!
      const rotCx = Math.max(1, bx - 3);
      const rotR = Math.min(3.5, Math.max(2.2, bx * 0.42));
      addSpiralTower(v, rotCx, 0, 1, h + 3 + clampedLv, rotR, "white", "magenta", "pink", "warmGlow");
      break;
    }

    case "thrift_stores": {
      // Eclectic Asymmetrical Vintage Barn-Attic + Crooked Clock Tower + Colorful Outdoor Flea-Market Canopy!
      const h = 5 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, 1, 1 + h, bz - 1, "woodLight");
      addGableSafe(v, -bx - 1, 1 + h, -bz, 2, bz - 1, 5, "z", "tealDark", "amber");
      // Quirky patchwork attic tower on +X/-Z
      const attH = h + 4 + clampedLv * 2;
      v.box(1, 1, -bz, bx, attH, 0, "oak");
      addGableSafe(v, 0, attH, -bz - 1, bx + 1, 1, 4, "x", "purple", "gold");
      v.put(Math.floor((1 + bx) * 0.5), attH - 1, 0, "warmGlow", 1.0);
      // Colorful outdoor vintage rummage tent on +X/+Z
      v.box(1, 1, 1, bx, 4, bz, "amber");
      v.clear(2, 1, 2, bx - 1, 3, bz);
      v.box(1, 4, 1, bx, 5, bz, "teal");
      break;
    }

    case "shoe_stores": {
      // Sculptural Curved Glass Showroom + Giant Iconic 3D High-Top Red/White Sneaker Monument on Angled Pedestal!
      const lowH = 4 + clampedLv;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Semi-circular / stepped low glass showroom podium
      v.box(-bx, 1, -bz + 1, bx, 1 + lowH, bz - 1, "cream");
      v.box(-bx + 1, 2, bz - 2, bx - 1, 4, bz - 1, "glass", 0.6);
      v.box(-bx, 1 + lowH, -bz + 1, bx, 2 + lowH, bz - 1, "amber");
      // Giant 3D High-Top Voxel Sneaker Sculpture rising above the roof!
      const sy = 2 + lowH;
      const shoeLen = Math.min(bx - 1, 4 + clampedLv);
      v.box(-shoeLen, sy, -2, shoeLen, sy + 2, 2, "white"); // thick white rubber sole
      v.box(-shoeLen, sy + 2, -2, Math.max(0, shoeLen - 2), sy + 5 + Math.min(3, clampedLv), 2, "red"); // red high-top ankle collar
      v.box(0, sy + 2, -2, shoeLen, sy + 4, 2, "crimson"); // toe box
      v.box(-shoeLen + 2, sy + 3, 2, 1, sy + 5, 3, "white"); // white laces & side swoosh!
      break;
    }

    case "cheesesteak_restaurants": {
      // Retro Rounded Stainless-Steel Streamliner Diner + Tall Diagonal Neon Pylon Sign!
      const h = 4 + Math.min(3, clampedLv);
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Rounded streamliner diner car along X
      v.box(-bx, 1, -bz + 1, bx - 2, 1 + h, 2, "silver");
      v.box(-bx + 1, 1 + h, -bz + 2, bx - 3, 2 + h, 1, "chrome"); // curved roof barrel
      v.box(-bx, 3, -bz + 1, bx - 2, 4, 2, "crimson"); // red racing stripe
      v.box(-bx + 1, 2, 1, bx - 3, 3, 2, "glass", 0.7);
      // Soaring retro neon pylon sign tower on +X/+Z!
      const signH = 8 + clampedLv * 3;
      v.box(bx - 2, 1, 1, bx - 1, signH, 2, "steel");
      v.box(bx - 4, signH - 3, 0, bx, signH, 3, "amber", 1.25);
      v.put(bx - 2, signH, 1, "red", 1.3);
      break;
    }

    case "bars": {
      // Art-Deco Nightlife Lounge: Low Speakeasy + Neon-Ringed Cylindrical Cocktail Tower + Open Rooftop Tiki Deck!
      const lowH = 4 + clampedLv;
      const towH = 8 + clampedLv * 3;
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Low dark-brick speakeasy with timber rooftop patio lounge
      v.box(-bx, 1, -bz + 1, bx, 1 + lowH, bz - 1, "brickDark");
      addWindowGrid(v, -bx, 2, -bz + 1, bx, 1 + lowH, bz - 1, 3, 0.6, "warmGlow");
      v.box(-bx + 1, 1 + lowH, -bz + 2, bx - 1, 2 + lowH, bz - 2, "wood");
      // Cylindrical purple/magenta neon cocktail lounge tower on -X/-Z!
      const tr = Math.min(3.2, Math.max(2.0, bx * 0.38));
      v.cylinderY(-bx + tr + 1, -bz + tr + 1, 1, towH, tr, "charcoal");
      for (let y = 3; y < towH; y += 3) {
        v.cylinderY(-bx + tr + 1, -bz + tr + 1, y, y + 1, tr + 0.3, y % 2 === 0 ? "magenta" : "purple", 1.15);
      }
      v.dome(-bx + tr + 1, towH, -bz + tr + 1, tr, "purple", 0.9);
      break;
    }

    case "gas_stations": {
      // Googie Retro-Futuristic Winged Canopy + Round Glass Mart Kiosk + Tall Price Totem!
      const ch = 6 + clampedLv * 2;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Round-cornered glass convenience kiosk in back
      v.cylinderY(0, -bz + 3, 1, ch - 1, Math.min(4.2, bx * 0.55), "white");
      v.cylinderY(0, -bz + 3, 2, 4, Math.min(4.4, bx * 0.55 + 0.2), "glass", 0.6);
      // Fuel pump island + soaring upswept crimson/amber V-wing canopy!
      v.box(-3, 1, 2, -2, 3, 4, "crimson");
      v.box(2, 1, 2, 3, 3, 4, "crimson");
      for (const px of [-bx + 2, bx - 3]) {
        v.box(px, 1, 2, px + 1, ch, 3, "chrome");
      }
      v.box(-bx, ch, 0, bx, ch + 1, bz, "crimson");
      v.box(-bx - 1, ch + 1, -1, -bx + 3, ch + 2, bz, "amber", 1.1);
      v.box(bx - 3, ch + 1, -1, bx + 1, ch + 2, bz, "amber", 1.1);
      // Tall illuminated price totem
      v.box(-bx, 1, bz - 1, -bx + 1, ch + 5 + clampedLv, bz, "steel");
      v.box(-bx, ch + 3 + clampedLv, bz - 1, -bx + 2, ch + 5 + clampedLv, bz, "screenGreen", 1.25);
      break;
    }

    case "atms": {
      // Sculptural Hex/Cylindrical Cash Pod with Glowing Emerald Halo Canopy & Spire
      const kh = 5 + clampedLv * 2;
      v.cylinderY(0, 0, 1, 1 + kh, 2.8, "slateLight");
      v.cylinderY(0, 0, 1 + kh, 2 + kh, 3.6, "screenGreen", 0.85);
      v.box(-2, 2, 2, 2, 5, 3, "screenGreen", 1.25);
      if (clampedLv >= 3) {
        addSpiralTower(v, 0, 0, 2 + kh, 3 + clampedLv * 2, 1.6, "blueDark", "gold", "screenGreen", "gold");
      }
      break;
    }

    case "buildings": {
      // Stage 8 Commercial Building: Chrysler/Empire-style Stepped Art-Deco Ziggurat with Twin Asymmetric Wings & Golden Sunburst Spire!
      const baseH = 7 + clampedLv * 2;
      const towerH = 12 + clampedLv * 4;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Lower wide colonnade podium wings on left & right
      v.box(-bx, 1, -bz + 1, bx, 1 + baseH, bz - 1, st.wall);
      addWindowGrid(v, -bx, 2, -bz + 1, bx, 1 + baseH, bz - 1, 2, 0.45);
      v.box(-bx, 1 + baseH, -bz + 1, bx, 2 + baseH, bz - 1, "brass");
      // Soaring central chamfered Art-Deco tower shaft rising out of podium
      const tw = Math.max(3, Math.floor(bx * 0.58));
      const td = Math.max(3, Math.floor(bz * 0.62));
      v.box(-tw, 1, -td, tw, 1 + towerH, td, "limestone");
      addWindowGrid(v, -tw, 2, -td, tw, 1 + towerH, td, 2, 0.55);
      // Tiered Art-Deco ziggurat crown + spire!
      addHippedRoofSafe(v, -tw, 1 + towerH, -td, tw, td, 4, "slate", "gold");
      v.box(-1, 4 + towerH, -1, 1, 10 + towerH + clampedLv, 1, "gold", 0.95);
      break;
    }

    case "banks": {
      // Classical Pantheon Marble Rotunda Vault + Grand Columned Greek Pediment Portico!
      const portH = 6 + clampedLv;
      const rotH = 8 + clampedLv * 2;
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Grand columned front portico
      v.box(-bx + 1, 1, 0, bx - 1, 2, bz, "marble");
      for (let x = -bx + 2; x <= bx - 3; x += 3) {
        v.box(x, 2, bz - 1, x + 1, 1 + portH, bz, "white");
      }
      addGableSafe(v, -bx, 1 + portH, 0, bx, bz + 1, 4, "x", "marbleShade", "gold");
      // Cylindrical marble treasury rotunda + gleaming gold dome behind portico!
      const rRad = Math.min(bx - 1, Math.max(4.0, bz * 0.72));
      v.cylinderY(0, -1, 1, 1 + rotH, rRad, "marble");
      v.dome(0, 1 + rotH, -1, rRad + 0.3, "gold");
      v.put(0, 2 + rotH + Math.floor(rRad), -1, "warmGlow", 1.2);
      break;
    }

    case "malls": {
      // Multi-Wing Crystal Galleria: Cross/Diagonal Wings + Soaring Central Glass Dome + Spiral Atrium Escalator Tower!
      const wingH = 6 + clampedLv * 2;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // Cruciform / L-shaped galleria wings leaving corner fountain plazas!
      v.box(-bx, 1, -4, bx, 1 + wingH, 4, "cream");
      v.box(-4, 1, -bz, 4, 1 + wingH, bz, "white");
      addWindowGrid(v, -bx, 2, -4, bx, 1 + wingH, 4, 3, 0.55);
      addWindowGrid(v, -4, 2, -bz, 4, 1 + wingH, bz, 3, 0.55);
      // Giant central crystal atrium dome
      const domeR = Math.min(6.5, Math.min(bx, bz) * 0.58);
      v.dome(0, 1 + wingH, 0, domeR, "glass", 0.72);
      // Corner plaza fountains & magenta neon arch entrance
      v.box(-3, 1, bz - 1, 3, 4, bz, "magenta", 0.95);
      v.cylinderY(-bx + 3, bz - 3, 1, 2, 2.0, "water", 0.35);
      if (clampedLv >= 3) {
        addSpiralTower(v, bx - 4, -bz + 4, 1, wingH + 6 + clampedLv * 2, 2.4, "white", "magenta", "glass", "screenCyan");
      }
      break;
    }

    case "data_centers": {
      // Sci-Fi Quantum Server Campus: Low Cooling Pods + Central Glowing Cyan Helical Cylinder Core!
      const podH = 5 + clampedLv;
      const coreH = 9 + clampedLv * 3;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // Flanking low server pods with cyan LED blade strips
      v.box(-bx, 1, -bz + 2, -2, 1 + podH, bz - 2, "charcoal");
      v.box(2, 1, -bz + 2, bx, 1 + podH, bz - 2, "charcoal");
      for (const sx of [-bx + 2, bx - 3]) {
        v.box(sx, 2, bz - 3, sx + 1, podH, bz - 2, "screenCyan", 1.2);
      }
      // Tall central cylindrical quantum server core wrapped in a glowing cyan data helix!
      addSpiralTower(v, 0, 0, 1, coreH, 3.6, "slate", "screenCyan", "steelLight", "screenCyan");
      break;
    }

    // --------------------- POWER & WASTE (15) ---------------------
    case "solar_panels": {
      // Tilted photovoltaic tracker rows + central inverter tower & sun-sensor mast
      const bx = Math.max(4, padX - 1);
      const bz = Math.max(4, padZ - 1);
      for (let z = -bz + 1; z <= bz - 3; z += 4) {
        v.box(-bx + 1, 1, z + 1, bx - 1, 2, z + 2, "steel");
        v.box(-bx, 2, z, bx, 3, z + 2, "solarBlue");
        v.box(-bx, 3, z + 1, bx, 4, z + 3, "blue");
      }
      if (clampedLv >= 2) {
        const th = 4 + clampedLv * 2;
        v.cylinderY(bx - 2, -bz + 2, 1, th, 1.5, "white");
        v.dome(bx - 2, th, -bz + 2, 1.7, "screenCyan");
      }
      if (clampedLv >= 4) {
        addSpiralTower(v, -bx + 3, -bz + 3, 1, 6 + clampedLv, 1.9, "silver", "solarBlue", "white", "gold");
      }
      break;
    }

    case "solar_farms": {
      // Utility-scale solar park + circular substation + heliostat solar-concentrator tower!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      for (let z = -bz + 1; z < bz - 4; z += 4) {
        v.box(-bx + 1, 1, z + 1, bx - 1, 2, z + 2, "steelDark");
        v.box(-bx, 2, z, bx, 3, z + 2, "solarBlue");
        v.box(-bx, 3, z + 1, bx, 4, z + 3, "blue");
        if (clampedLv >= 3) {
          v.box(-bx + 2, 4, z + 2, bx - 2, 5, z + 3, "sky");
        }
      }
      // Curved control pavilion + transformer coils
      v.cylinderY(-bx + 4, bz - 3, 1, 5 + clampedLv, 2.6, "white");
      v.dome(-bx + 4, 5 + clampedLv, bz - 3, 2.6, "sky");
      v.cylinderY(2, bz - 3, 1, 4 + Math.min(3, clampedLv), 1.6, "steelLight");
      v.cylinderY(6, bz - 3, 1, 4 + Math.min(3, clampedLv), 1.6, "steelLight");
      // Tall glowing solar thermal receiver spire at Lv.2+
      if (clampedLv >= 2) {
        const recH = 9 + clampedLv * 3;
        addSpiralTower(v, bx - 3, bz - 3, 1, recH, 2.2, "white", "silver", "solarBlue", "gold");
      }
      break;
    }

    case "windmills": {
      // Classic Dutch octagonal stone/timber smock mill + wrap-around gallery deck + 4 lattice sails
      const towerH = Math.round(9 * (0.85 + clampedLv * 0.3));
      v.cone(0, 1, towerH, 0, 4.2, 2.3, st.wall);
      v.dome(0, towerH, 0, 2.6, "woodDark");
      if (clampedLv >= 2) {
        const galY = Math.floor(towerH * 0.45);
        v.cylinderY(0, 0, galY, galY + 1, 4.4, "wood");
      }
      if (clampedLv >= 4) {
        // Attached miller's granary cottage wing
        v.box(-padX + 1, 1, -3, -3, 5, 3, "cream");
        addGableSafe(v, -padX + 1, 5, -3, -2, 3, 3, "x", st.roof, "wood");
      }
      rotorVox = new PixelVox(901 + clampedVar);
      const bl = 5 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "brass");
      rotorVox.box(0, 1, 1, 1, bl, 2, "woodLight");
      rotorVox.box(0, -bl, 1, 1, -1, 2, "woodLight");
      rotorVox.box(1, 0, 1, bl, 1, 2, "woodLight");
      rotorVox.box(-bl, 0, 1, -1, 1, 2, "woodLight");
      rotorPivot = [0, towerH, 3];
      rotorAxis = "z";
      rotorSpeed = 1.4;
      break;
    }

    case "wind_turbines": {
      // Sleek tapered aero nacelle turbine + spiral maintenance stair collar at high levels
      const towerH = Math.round(13 * (0.85 + clampedLv * 0.32));
      v.cone(0, 1, towerH, 0, 1.9, 0.8, "white");
      v.box(-1, towerH - 1, -2, 1, towerH + 1, 2, "silver");
      if (clampedLv >= 3) {
        v.cylinderY(0, 0, 1, 4, 2.6, "sky");
        v.put(0, towerH + 2, -1, "red", 1.15);
      }
      rotorVox = new PixelVox(902 + clampedVar);
      const bl = 6 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "white");
      rotorVox.box(0, 1, 1, 1, bl, 2, "white");
      rotorVox.box(-bl, -Math.floor(bl * 0.5), 1, -1, -1, 2, "white");
      rotorVox.box(1, -Math.floor(bl * 0.5), 1, bl, -1, 2, "white");
      rotorPivot = [0, towerH, 2];
      rotorAxis = "z";
      rotorSpeed = 2.5;
      break;
    }

    case "wind_farms": {
      // Multi-turbine park (3+ staggered white turbines from Lv.1, growing to 5 + domed control hub)
      const bx = Math.max(8, padX - 2);
      const bz = Math.max(8, padZ - 2);
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
        v.cone(tx, 1, th, tz, 1.5, 0.7, "white");
        v.box(tx - 1, th - 1, tz - 1, tx + 1, th + 1, tz + 2, "silver");
        if (clampedLv >= 3) {
          v.put(tx, th + 2, tz, "red", 1.1);
        }
        if (tx !== 0 || tz !== 0) {
          v.box(tx, th - 4, tz + 2, tx + 1, th + 5, tz + 3, "white");
          v.box(tx - 4, th, tz + 2, tx + 5, th + 1, tz + 3, "white");
        }
      }
      v.cylinderY(bx - 3, bz - 3, 1, 4 + Math.min(3, clampedLv), 2.3, "steelLight");
      v.dome(bx - 3, 4 + Math.min(3, clampedLv), bz - 3, 2.3, "screenCyan");
      const centerH = 18 + clampedLv * 2;
      rotorVox = new PixelVox(903 + clampedVar);
      const bl = 7 + clampedLv;
      rotorVox.box(-1, -1, 0, 1, 1, 2, "white");
      rotorVox.box(0, 1, 1, 1, bl, 2, "white");
      rotorVox.box(0, -bl, 1, 1, -1, 2, "white");
      rotorVox.box(1, 0, 1, bl, 1, 2, "white");
      rotorVox.box(-bl, 0, 1, -1, 1, 2, "white");
      rotorPivot = [0, centerH, 2];
      rotorAxis = "z";
      rotorSpeed = 2.6;
      break;
    }

    case "coal_powerplants": {
      // Stepped basalt boiler hall + lower turbine nave + diagonal conveyor + twin/triple red-striped stacks
      const h = Math.round(7 * hLv);
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, 0, 2 + h, 0, "basalt");
      v.box(0, 1, -bz + 1, bx - 2, 1 + Math.max(4, Math.floor(h * 0.62)), 1, "brickDark");
      addGableSafe(v, -bx, 2 + h, -bz, 0, 0, 3, "x", "iron", "basalt");
      v.cone(bx - 3, 1, 5 + Math.min(3, clampedLv), bz - 3, 3.2, 0.8, "black"); // coal heap
      // Inclined coal conveyor bridge
      for (let s = 0; s < 5; s++) {
        v.box(bx - 3 - s, 2 + s, bz - 3 - Math.floor(s * 0.6), bx - 2 - s, 3 + s, bz - 2 - Math.floor(s * 0.6), "steel");
      }
      const sh = 8 + h + clampedLv * 2;
      const stackXs = clampedLv >= 4 ? [-bx + 2, -2, 2] : [-bx + 3, 0];
      for (const sx of stackXs) {
        v.cylinderY(sx, bz - 2, 1, sh, 1.4, "brickDark");
        v.cylinderY(sx, bz - 2, sh - 3, sh - 1, 1.5, "red");
      }
      break;
    }

    case "natural_gas_power_plants": {
      // Combined-cycle turbine hall + Spherical Horton spheres + tall HRSG heat-recovery stacks
      const h = Math.round(7 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      v.box(-bx, 1, -bz, 0, 1 + h, 0, "steelLight");
      addHippedRoofSafe(v, -bx, 1 + h, -bz, 0, 0, 3, "sky", "white");
      v.sphere(bx - 3, 4, -bz + 3, 3.0, 3.0, 3.0, "white");
      v.sphere(bx - 3, 4, bz - 3, 3.0, 3.0, 3.0, "white");
      if (clampedLv >= 3) {
        v.sphere(0, 4, bz - 3, 2.6, 2.6, 2.6, "silver");
      }
      v.cylinderY(-bx + 3, -2, 1 + h, 8 + h + clampedLv * 2, 1.5, "steel");
      if (clampedLv >= 4) {
        v.cylinderY(-2, -2, 1 + h, 10 + h + clampedLv * 2, 1.5, "steel");
      }
      v.box(-bx + 2, 4, 1, bx - 3, 5, 2, "busYellow");
      break;
    }

    case "geothermal_power_plants": {
      // Curved slate turbine dome + glowing cyan steam wellheads + hyperbolic cooling cones
      const h = Math.round(6 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.4), -Math.floor(bz * 0.3), 1, 1 + h, 3.8, "slate");
      v.dome(-Math.floor(bx * 0.4), 1 + h, -Math.floor(bz * 0.3), 3.8, "copper");
      v.cylinderY(bx - 3, -bz + 3, 1, 4 + Math.min(3, clampedLv), 2.2, "cyan", 0.75);
      v.cylinderY(bx - 3, bz - 3, 1, 4 + Math.min(3, clampedLv), 2.2, "cyan", 0.75);
      v.box(-2, 3, -bz + 3, bx - 2, 4, -bz + 4, "silver");
      v.cone(-3, 1, 7 + h, bz - 3, 3.2, 2.0, "concrete");
      if (clampedLv >= 3) {
        v.cone(2, 1, 9 + h, 0, 2.8, 1.7, "concrete2");
      }
      break;
    }

    case "hydro_electric_power_plants": {
      // Curved concave concrete arch dam + cascading foam spillways + powerhouse control tower
      const h = Math.round(7 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      v.box(-bx, 0, -bz, bx, 2, -1, "waterDeep", 0.15);
      v.box(-bx, 0, 0, bx, 1, bz, "water", 0.2);
      for (let x = -bx; x <= bx; x++) {
        const zArc = Math.round(Math.cos((x / bx) * 1.2) * 2) - 1;
        v.box(x, 1, zArc - 1, x + 1, 2 + h, zArc + 2, "concrete");
        if (Math.abs(x) % 3 === 1 && Math.abs(x) < bx - 1) {
          v.box(x, 1, zArc + 2, x + 1, h, zArc + 4, "foam", 0.4);
        }
      }
      addSpiralTower(v, -bx + 3, -2, 2 + h, 5 + clampedLv, 2.1, "blueDark", "white", "sky", "screenCyan");
      break;
    }

    case "micro_reactor_nuclear": {
      // Futuristic modular containment cylinder + glowing Cherenkov ring + offset radiator fins
      const h = Math.round(7 * hLv);
      const bx = Math.max(6, padX - 2);
      const rad = Math.min(4.6, bx - 0.5);
      v.cylinderY(0, 0, 1, 1 + h, rad, "white");
      v.cylinderY(0, 0, 3, 5, rad + 0.3, "screenCyan", 1.15);
      v.dome(0, 1 + h, 0, rad, "silver");
      if (clampedLv >= 2) {
        v.box(-bx, 1, -2, -Math.ceil(rad), Math.max(4, h - 1), 2, "steelDark");
        v.box(Math.ceil(rad), 1, -2, bx, Math.max(4, h - 1), 2, "steelDark");
      }
      if (clampedLv >= 4) {
        v.put(0, Math.round(1 + h + rad), 0, "screenCyan", 1.3);
      }
      break;
    }

    case "nuclear_power_plants": {
      // Twin hyperbolic cooling towers + spherical white containment dome + auxiliary turbine wing
      const th = Math.round(11 * (0.85 + clampedLv * 0.28));
      const bx = Math.max(9, padX - 1);
      const bz = Math.max(8, padZ - 1);
      for (const [cx, cz] of [
        [-Math.floor(bx * 0.48), -Math.floor(bz * 0.35)],
        [0, -Math.floor(bz * 0.42)],
      ]) {
        v.cone(cx, 1, Math.floor(th * 0.72), cz, 3.9, 2.2, "concrete");
        v.cone(cx, Math.floor(th * 0.72), th, cz, 2.2, 2.7, "concrete2");
      }
      const domR = Math.min(4.4, bx * 0.42);
      v.cylinderY(Math.floor(bx * 0.45), Math.floor(bz * 0.3), 1, 5 + clampedLv, domR, "white");
      v.dome(Math.floor(bx * 0.45), 5 + clampedLv, Math.floor(bz * 0.3), domR, "silver");
      v.put(Math.floor(bx * 0.45), Math.round(5 + clampedLv + domR), Math.floor(bz * 0.3), "screenGreen", 1.25);
      v.box(-bx + 1, 1, 1, 1, 5 + Math.min(4, clampedLv), bz - 1, "steelLight");
      break;
    }

    case "factories": {
      // Asymmetrical L-wing brick foundry + sawtooth north-light roofs + elevated water tank + twin stacks
      const h = Math.round(6 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(5, padZ - 1);
      // Main sawtooth assembly hall
      v.box(-bx, 1, -bz, 2, 1 + h, bz - 1, "brick");
      addWindowGrid(v, -bx, 2, -bz, 2, 1 + h, bz - 1, 3, 0.38);
      for (let x = -bx; x <= 0; x += 4) {
        v.box(x, 1 + h, -bz, x + 2, 3 + h, bz - 1, "brickDark");
        v.box(x + 2, 1 + h, -bz, x + 3, 3 + h, bz - 1, "glass", 0.6);
      }
      // Lower shipping & crane bay wing on +X
      const lowH = Math.max(4, Math.floor(h * 0.62));
      v.box(2, 1, -1, bx, 1 + lowH, bz, "steel");
      v.cylinderY(bx - 3, bz - 3, 1 + lowH, 5 + lowH + clampedLv, 1.8, "woodDark"); // rooftop water tank
      // Tall brick smokestacks on back-right courtyard
      const sh = 8 + h + clampedLv * 2;
      v.cylinderY(bx - 2, -bz + 2, 1, sh, 1.4, "brickDark");
      if (clampedLv >= 3) {
        v.cylinderY(bx - 5, -bz + 2, 1, sh - 3, 1.2, "iron");
      }
      break;
    }

    case "landfill": {
      // Terraced earth & recycling mounds + yellow bulldozer + methane flare pipe at high levels
      const bx = Math.max(4, padX - 1);
      v.cone(-2, 1, 3 + clampedLv * 2, -1, Math.min(4.8, bx), 1.5, "soil");
      v.cone(2, 1, 2 + clampedLv, -2, Math.min(3.2, bx - 1), 1.2, "sandDark");
      v.put(-2, 3 + clampedLv, 0, "steel");
      v.put(0, 2 + clampedLv, -2, "brick");
      v.box(1, 1, 1, 4, 4, 4, "busYellow");
      if (clampedLv >= 3) {
        const fz = Math.max(2, padZ - 2);
        v.cylinderY(-bx + 2, fz, 1, 6 + clampedLv, 0.9, "steelDark");
        v.put(-bx + 2, 6 + clampedLv, fz, "fire", 1.2);
      }
      break;
    }

    case "trash_compacting_plants": {
      // Twin cylindrical green compactor silos + low yellow crane bay + overhead conveyor bridge
      const h = Math.round(6 * hLv);
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.cylinderY(-bx + 3, -bz + 3, 1, 3 + h, 2.5, "leaf");
      v.dome(-bx + 3, 3 + h, -bz + 3, 2.5, "steelLight");
      if (clampedLv >= 2) {
        v.cylinderY(-bx + 3, bz - 3, 1, 2 + h, 2.3, "leafDark");
        v.dome(-bx + 3, 2 + h, bz - 3, 2.3, "steelLight");
      }
      // Low sorting bay + yellow claw crane
      const lowH = Math.max(4, Math.floor(h * 0.65));
      v.box(0, 1, -bz + 1, bx, 1 + lowH, bz - 1, "concrete");
      v.box(1, 1 + lowH, -1, bx - 1, 4 + lowH, 1, "busYellow");
      break;
    }

    case "trash_burning_plants": {
      // Architectural stepped ski-slope Waste-to-Energy plant + glowing furnace + spiral flue stack!
      const h = Math.round(7 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const x0 = -bx + Math.floor((i * (bx * 2 - 3)) / steps);
        const x1 = -bx + Math.floor(((i + 1) * (bx * 2 - 3)) / steps) + 1;
        const stepH = Math.max(4, Math.round((3 + h) * ((i + 1) / steps)));
        v.box(x0, 1, -bz + 1, x1, stepH, bz - 1, "silver");
        v.box(x0, stepH, -bz + 1, x1, stepH + 1, bz - 1, i % 2 === 0 ? "leafLight" : "orange");
      }
      v.box(-3, 2, bz - 2, 2, 4, bz, "fire", 1.25);
      addSpiralTower(v, bx - 2, -bz + 3, 1, 8 + h + clampedLv * 2, 2.1, "steelDark", "orange", "amber", "fire");
      break;
    }

    // --------------------- WATER UTILITIES (8 incl. Aqueduct) ---------------------
    case "wells": {
      const wh = 4 + clampedLv * 2;
      v.cylinderY(0, 0, 1, 3 + Math.min(2, clampedLv - 1), 2.8 + (clampedLv >= 3 ? 0.6 : 0), "stone");
      v.cylinderY(0, 0, 2, 3 + Math.min(2, clampedLv - 1), 1.8, "water", 0.25);
      v.box(-2, 3, 0, -1, 3 + wh, 1, "woodDark");
      v.box(1, 3, 0, 2, 3 + wh, 1, "woodDark");
      addGableSafe(v, -3, 3 + wh, -2, 3, 3, 3, "x", st.roof, "wood");
      if (clampedLv >= 3) {
        addSpiralTower(v, -3, -3, 1, 4 + wh, 1.5, "stone", "wood", "brass", "cyan");
      }
      break;
    }

    case "water_towers": {
      const legH = 6 + clampedLv * 3;
      for (const [lx, lz] of [
        [-3, -3],
        [2, -3],
        [-3, 2],
        [2, 2],
      ]) {
        v.box(lx, 1, lz, lx + 1, legH, lz + 1, "steelDark");
      }
      // Spiral service ladder wrapping central riser pipe!
      addSpiralTower(v, 0, 0, 1, legH, 1.6, "steel", "steelLight", "brass");
      v.cylinderY(0, 0, legH, legH + 6 + clampedLv, 3.9, clampedVar % 2 === 0 ? "sky" : "wood");
      v.cone(0, legH + 6 + clampedLv, legH + 10 + clampedLv, 0, 4.2, 0.6, st.roof);
      if (clampedLv >= 4) {
        v.put(0, legH + 10 + clampedLv, 0, "screenCyan", 1.2);
      }
      break;
    }

    case "water_treatment_plant": {
      // Twin/triple circular turquoise clarifier basins + curved lab pavilion + spiral observation tower
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      const rBasin = Math.min(3.4, bz - 1);
      v.cylinderY(-Math.floor(bx * 0.45), -Math.floor(bz * 0.28), 1, 3 + clampedLv, rBasin, "concrete");
      v.cylinderY(-Math.floor(bx * 0.45), -Math.floor(bz * 0.28), 2 + clampedLv, 3 + clampedLv, rBasin - 0.8, "water", 0.35);
      if (clampedLv >= 2) {
        v.cylinderY(-Math.floor(bx * 0.45), Math.floor(bz * 0.35), 1, 3 + clampedLv, Math.max(2.2, rBasin - 0.5), "concrete");
        v.cylinderY(-Math.floor(bx * 0.45), Math.floor(bz * 0.35), 2 + clampedLv, 3 + clampedLv, Math.max(1.5, rBasin - 1.2), "cyan", 0.5);
      }
      const ph = Math.round(5 * hLv);
      v.box(1, 1, -bz + 2, bx, 1 + ph, 1, "white");
      v.dome(Math.floor((1 + bx) * 0.5), 1 + ph, -Math.floor((bz - 1) * 0.4), 2.8, "sky");
      if (clampedLv >= 3) {
        addSpiralTower(v, bx - 2, bz - 2, 1, 6 + ph + clampedLv, 2.0, "white", "sky", "steelLight", "screenCyan");
      }
      break;
    }

    case "water_places": {
      // Tiered Baroque marble plaza fountain with multiple sculpted water bowls
      const rad = Math.min(5.2, padX - 1);
      v.cylinderY(0, 0, 1, 3, rad, "marble");
      v.cylinderY(0, 0, 2, 3, rad - 0.9, "water", 0.35);
      const fh = 5 + clampedLv * 2;
      v.cylinderY(0, 0, 2, fh, 1.4, "marbleShade");
      v.cylinderY(0, 0, Math.floor(fh * 0.55), Math.floor(fh * 0.55) + 1, Math.max(2.2, rad * 0.55), "marble");
      v.sphere(0, fh + 1, 0, 1.8 + clampedLv * 0.15, 1.8 + clampedLv * 0.2, 1.8 + clampedLv * 0.15, "cyan", 0.75);
      break;
    }

    case "water_pumping_station": {
      // Arched Victorian blue-and-limestone pumphouse + twin vertical surge standpipes + intake manifolds
      const h = Math.round(6 * hLv);
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz + 2, 1, 1 + h, bz - 2, "blue");
      addGableSafe(v, -bx, 1 + h, -bz + 2, 1, bz - 2, 4, "x", "slate", "white");
      v.box(1, 2, -3, bx, 4, -1, "steelLight");
      v.box(1, 2, 1, bx, 4, 3, "steelLight");
      // Vertical cylindrical surge standpipes
      v.cylinderY(-bx + 2, -bz + 2, 1, 6 + h + clampedLv * 2, 1.6, "sky");
      if (clampedLv >= 3) {
        v.cylinderY(-2, -bz + 2, 1, 8 + h + clampedLv * 2, 1.6, "blueDark");
        v.put(-2, 8 + h + clampedLv * 2, -bz + 2, "screenCyan", 1.15);
      }
      break;
    }

    case "municipal_reservoir": {
      // Terraced stone embankment basin + sparkling deep water + Gothic intake gatehouse spire
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx, 1, -bz, bx, 4, bz, "stone");
      v.box(-bx + 2, 2, -bz + 2, bx - 2, 4, bz - 2, "waterDeep", 0.25);
      addSpiralTower(v, 0, 0, 2, 7 + clampedLv * 2, 2.3, "limestone", "stone", "brass", "screenCyan");
      break;
    }

    case "aqueduct": {
      // Monumental multi-tier Roman limestone arch viaduct carrying a glowing elevated water channel!
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(3, Math.min(5, padZ - 1));
      const tier1H = 5 + clampedLv;
      const tier2H = clampedLv >= 2 ? 4 + clampedLv : 0;
      const topH = tier1H + tier2H;
      // Lower massive stone piers & arches
      for (let x = -bx; x <= bx - 2; x += 4) {
        v.box(x, 1, -bz, x + 2, tier1H, bz, "limestone");
      }
      v.box(-bx, tier1H - 1, -bz, bx, tier1H + 1, bz, "marbleShade");
      // Upper arcade tier at Lv.2+
      if (tier2H > 0) {
        for (let x = -bx + 1; x <= bx - 1; x += 3) {
          v.box(x, tier1H + 1, -bz + 1, x + 1, topH, bz - 1, "limestone");
        }
        v.box(-bx, topH - 1, -bz, bx, topH + 1, bz, "marble");
      }
      // Open turquoise water channel along the crest!
      v.box(-bx, topH + 1, -bz, bx, topH + 2, -bz + 1, "limestone");
      v.box(-bx, topH + 1, bz - 1, bx, topH + 2, bz, "limestone");
      v.box(-bx, topH + 1, -bz + 1, bx, topH + 2, bz - 1, "cyan", 0.55);
      if (clampedLv >= 4) {
        v.cylinderY(-bx + 2, 0, 1, topH + 4, 2.2, "marble");
        v.dome(-bx + 2, topH + 4, 0, 2.2, "gold");
      }
      break;
    }

    case "desalination_plant": {
      // Twin domed white seawater intake rotundas + horizontal cyan RO membrane racks + solar brine spire
      const h = Math.round(6 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.45), -Math.floor(bz * 0.35), 1, 1 + h, 3.6, "white");
      v.dome(-Math.floor(bx * 0.45), 1 + h, -Math.floor(bz * 0.35), 3.6, "sky");
      v.cylinderY(-Math.floor(bx * 0.45), Math.floor(bz * 0.35), 1, 1 + Math.max(4, h - 2), 3.2, "white");
      v.dome(-Math.floor(bx * 0.45), 1 + Math.max(4, h - 2), Math.floor(bz * 0.35), 3.2, "cyan");
      for (let z = -bz + 2; z <= bz - 3; z += 4) {
        v.box(0, 2, z, bx - 1, 4 + Math.min(2, clampedLv - 1), z + 2, "cyan");
      }
      if (clampedLv >= 3) {
        addSpiralTower(v, bx - 3, 0, 1, 7 + h + clampedLv, 2.2, "white", "cyan", "silver", "screenCyan");
      }
      break;
    }

    // --------------------- TRANSIT STOPS & DEPOTS (5) ---------------------
    case "train_stops": {
      const h = Math.round(5 * hLv);
      const bx = Math.max(5, padX - 1);
      v.box(-bx, 1, -3, -bx + 1, 1 + h, -2, "steelDark");
      v.box(bx - 1, 1, -3, bx, 1 + h, -2, "steelDark");
      v.box(-bx, 1 + h, -4, bx, 2 + h, 3, "crimson");
      // Ornate Victorian station clock turret
      v.cylinderY(0, 1, 1 + h, 6 + h + clampedLv, 1.8, "cream");
      v.cone(0, 6 + h + clampedLv, 9 + h + clampedLv, 1, 2.1, 0.4, "slate");
      v.put(0, 4 + h, 3, "warmGlow", 1.0);
      break;
    }

    case "train_depots": {
      // Curved brick locomotive roundhouse + turntable pit + soaring Victorian clock tower!
      const h = Math.round(7 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, bx - 2, 1 + h, 1, "brick");
      addGableSafe(v, -bx, 1 + h, -bz, bx - 2, 1, 4, "x", "slate", "cream");
      v.box(-5, 1, 0, -2, 5, 2, "charcoal");
      v.box(0, 1, 0, 3, 5, 2, "charcoal");
      // Outdoor locomotive turntable in forecourt
      v.cylinderY(-1, Math.min(bz - 2, 3), 1, 2, 2.8, "steelDark");
      // Tall corner brick clock & bell spire
      addSpiralTower(v, bx - 2, -bz + 2, 1, 8 + h + clampedLv * 2, 2.2, "brickDark", "cream", "brass", "warmGlow");
      break;
    }

    case "bus_stops": {
      const h = 5 + clampedLv;
      v.box(-4, 1, -2, -3, h, -1, "steelDark");
      v.box(3, 1, -2, 4, h, -1, "steelDark");
      v.box(-4, 1, -2, 4, h, -1, "glass", 0.45);
      // Curved cantilevered yellow canopy + glowing route totem
      v.box(-5, h, -3, 5, h + 1, 2, "busYellow");
      v.box(5, 1, 1, 6, h + 3, 2, "busYellow");
      v.put(5, h + 3, 1, "screenCyan", 1.0);
      break;
    }

    case "bus_depots": {
      // Curved vaulted transit concourse + open maintenance bays + parked yellow buses + dispatch tower
      const h = Math.round(6 * hLv);
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, 2, 1 + h, 0, "concrete");
      addGableSafe(v, -bx, 1 + h, -bz, 2, 0, 3, "x", "busYellow", "steelLight");
      v.box(-5, 1, 2, 0, 4, 5, "busYellow");
      v.box(-5, 3, 2, 0, 4, 4, "glass", 0.45);
      addSpiralTower(v, bx - 2, -bz + 2, 1, 5 + h + clampedLv * 2, 2.0, "charcoal", "busYellow", "white", "warmGlow");
      break;
    }

    case "taxi_depots": {
      // Checkered retro yellow-and-black dispatch rotunda + canopy carport + parked yellow cabs
      const h = Math.round(5 * hLv);
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.4), -Math.floor(bz * 0.25), 1, 2 + h, 3.4, "charcoal");
      v.cylinderY(-Math.floor(bx * 0.4), -Math.floor(bz * 0.25), 1 + h, 2 + h, 3.6, "busYellow");
      v.dome(-Math.floor(bx * 0.4), 2 + h, -Math.floor(bz * 0.25), 3.2, "yellow");
      v.box(1, 1, 0, 5, 3, 4, "busYellow");
      v.put(3, 3, 2, "warmGlow", 1.0);
      if (clampedLv >= 3) {
        v.box(1, 1, -bz + 1, 5, 3, -1, "busYellow");
      }
      break;
    }

    // --------------------- CIVIC & PARKS (13) ---------------------
    case "school": {
      // Architecturally distinct multi-height Academy:
      // 1) Low red-brick classroom wing on left (-X)
      // 2) Sunny recessed playground courtyard on front-right (+X, +Z)
      // 3) Soaring cylindrical Clock & Astronomy Observatory Tower wrapped in a 3D helical spiral ramp!
      // 4) Vaulted Gymnasium / Auditorium wing + glass skybridge at Lv.3-5
      const lowH = Math.max(4, Math.round(4.5 * hLv));
      const tallH = Math.round(10 + clampedLv * 3.2);
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);

      // Low classroom wing (-bx..0, -bz..bz-1)
      v.box(-bx, 1, -bz + 1, 0, 1 + lowH, bz - 1, "brick");
      addWindowGrid(v, -bx, 2, -bz + 1, 0, 1 + lowH, bz - 1, 3, 0.48);
      addGableSafe(v, -bx, 1 + lowH, -bz + 1, 0, bz - 1, 3, "z", "slate", "cream");

      // Sunny courtyard playground on (+X, +Z) with hopscotch & hoop
      v.box(0, 1, 0, bx, 2, bz, "sand");
      v.put(Math.min(bx - 1, 3), 2, Math.min(bz - 1, 3), "busYellow");
      v.box(bx - 1, 2, 1, bx, 5, 2, "white");
      v.put(bx - 1, 4, 1, "orange");

      // Tall Spiral Clock & Observatory Tower at back-right (+X, -Z)!
      const tx = Math.max(2, bx - 3);
      const tz = -Math.max(2, bz - 3);
      addSpiralTower(v, tx, tz, 1, tallH, 2.5, "limestone", "crimson", "cream", "gold");

      // Lv.2+: Stepped upper library rotunda on classroom wing
      if (clampedLv >= 2) {
        v.cylinderY(-Math.max(2, Math.floor(bx * 0.5)), 0, 2 + lowH, 6 + lowH, 2.2, "cream");
        v.dome(-Math.max(2, Math.floor(bx * 0.5)), 6 + lowH, 0, 2.3, "copper");
      }

      // Lv.3+: Vaulted Gymnasium hall & elevated glass skywalk linking low wing to spiral tower!
      if (clampedLv >= 3) {
        v.box(-bx + 1, 1 + lowH, -bz, tx, 3 + lowH, tz + 1, "glass", 0.65); // skybridge
      }
      if (clampedLv >= 4) {
        // Second smaller spiral science turret on front-left corner!
        addSpiralTower(v, -bx + 2, bz - 2, 1, lowH + 7, 1.9, "brickDark", "white", "gold", "screenCyan");
      }
      break;
    }

    case "little_parks": {
      // Cozy 1x1 pocket corner green with diagonal stepping stones, pink blossom tree & floral arch
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass3");
      for (let i = -padX + 1; i < padX - 1; i += 2) {
        v.box(i, 0, i, i + 2, 1, i + 2, "stone");
      }
      addTreeMini(v, -padX + 2, 1, -padZ + 2, 1); // pink cherry blossom tree
      v.box(1, 1, 2, 4, 2, 3, "oak"); // cozy bench
      // Floral entrance arch
      v.box(-2, 1, padZ - 2, -1, 4 + clampedLv, padZ - 1, "wood");
      v.box(2, 1, padZ - 2, 3, 4 + clampedLv, padZ - 1, "wood");
      v.box(-2, 4 + clampedLv, padZ - 2, 3, 5 + clampedLv, padZ - 1, "pink");
      v.put(0, 4 + clampedLv, padZ - 1, "warmGlow", 0.9);
      break;
    }

    case "park": {
      // Classic town park with winding paths, duck pond, timber bridge & octagonal pagoda gazebo
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass");
      v.box(-1, 0, -padZ, 1, 1, padZ, "path");
      v.box(-padX, 0, -1, padX, 1, 1, "path");
      v.box(-padX + 1, 0, 1, -1, 1, padZ - 1, "water", 0.25); // duck pond
      v.box(-3, 1, 0, -1, 2, 2, "wood"); // footbridge
      addTreeMini(v, -padX + 2, 1, -padZ + 2, 0);
      addTreeMini(v, padX - 3, 1, -padZ + 2, 2);
      // Octagonal gazebo pavilion on +X, +Z
      const gx = Math.min(3, padX - 3);
      const gz = Math.min(3, padZ - 3);
      v.cylinderY(gx, gz, 1, 2, 2.4, "marble");
      v.cylinderY(gx, gz, 2, 5 + clampedLv, 0.8, "white");
      v.cone(gx, 5 + clampedLv, 8 + clampedLv, gz, 2.8, 0.5, "teal");
      v.put(gx, 8 + clampedLv, gz, "gold", 0.9);
      break;
    }

    case "gardens": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass3");
      for (const [fx, fz] of [
        [-4, -4],
        [2, -4],
        [-4, 2],
        [2, 2],
      ]) {
        v.box(fx, 1, fz, fx + 3, 2, fz + 3, "leafDark");
        v.put(fx + 1, 2, fz + 1, clampedVar % 2 === 0 ? "pink" : "yellow");
        v.put(fx + 2, 2, fz + 2, "magenta");
      }
      // Glass conservatory dome + rose trellis
      v.dome(0, 1, 0, Math.min(3.4, padX - 2), "glass");
      v.put(0, 3, 0, "pink", 0.8);
      break;
    }

    case "italian_gardens": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "path");
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, -2, 2, -2, "leafDark");
      v.box(2, 1, -bz, bx, 2, -2, "leafDark");
      v.box(-bx, 1, 2, -2, 2, bz, "leafDark");
      v.box(2, 1, 2, bx, 2, bz, "leafDark");
      addCypressMini(v, -bx + 1, 1, -bz + 1, 8 + clampedLv);
      addCypressMini(v, bx - 2, 1, -bz + 1, 8 + clampedLv);
      addCypressMini(v, -bx + 1, 1, bz - 2, 7 + clampedLv);
      addCypressMini(v, bx - 2, 1, bz - 2, 7 + clampedLv);
      v.cylinderY(0, 0, 1, 3 + Math.min(2, clampedLv - 1), 2.5, "marble");
      v.sphere(0, 4 + Math.min(2, clampedLv - 1), 0, 1.4, 1.6, 1.4, "cyan", 0.65);
      break;
    }

    case "large_parks": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass");
      v.box(-padX + 2, 0, -5, 0, 1, 5, "water", 0.22);
      v.box(-4, 1, -1, 0, 2, 1, "wood");
      addTreeMini(v, padX - 4, 1, -padZ + 3, 0);
      addTreeMini(v, padX - 4, 1, padZ - 4, 1);
      addTreeMini(v, -padX + 3, 1, padZ - 3, 2);
      // Grand multi-tier amphitheater & spiral observation lookout tower
      const gx = Math.min(4, padX - 4);
      v.cylinderY(gx, 0, 1, 3, 3.4, "marble");
      v.cone(gx, 5, 9 + clampedLv, 0, 3.6, 0.6, "teal");
      for (const [px, pz] of [
        [gx - 2, -2],
        [gx + 2, -2],
        [gx - 2, 2],
        [gx + 2, 2],
      ]) {
        v.box(px, 2, pz, px + 1, 5, pz + 1, "white");
      }
      if (clampedLv >= 3) {
        addSpiralTower(v, -padX + 4, -padZ + 4, 1, 9 + clampedLv * 2, 2.0, "woodDark", "woodLight", "brass", "warmGlow");
      }
      break;
    }

    case "city_offices": {
      // Asymmetrical L-shaped municipal brick & limestone hall + civic plaza + tall spiral clock tower
      const lowH = Math.max(5, Math.round(5.5 * hLv));
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, 1, 1 + lowH, bz, "brick");
      v.box(1, 1, -bz, bx, 1 + Math.max(4, lowH - 2), 0, "limestone");
      addWindowGrid(v, -bx, 2, -bz, 1, 1 + lowH, bz, 3, 0.42);
      addHippedRoofSafe(v, -bx, 1 + lowH, -bz, 1, bz, 3, "blueDark", "limestone");
      addSpiralTower(v, Math.max(2, bx - 2), Math.max(2, bz - 2), 1, 8 + lowH + clampedLv * 2, 2.2, "limestone", "blueDark", "white", "gold");
      break;
    }

    case "post_offices": {
      // Art-Deco stepped cream & navy Postal Rotunda + lower sorting wing + blue mail dropboxes
      const lowH = Math.max(4, Math.round(5 * hLv));
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz + 1, bx, 1 + lowH, 1, "cream");
      addWindowGrid(v, -bx, 2, -bz + 1, bx, 1 + lowH, 1, 3, 0.42);
      // Central cylindrical customer rotunda protruding forward
      const rotR = Math.min(3.5, bx - 1);
      v.cylinderY(0, 1, 1, 4 + lowH + clampedLv, rotR, "white");
      v.dome(0, 4 + lowH + clampedLv, 1, rotR, "blueDark");
      v.put(0, Math.round(4 + lowH + clampedLv + rotR), 1, "gold", 1.0);
      v.box(-3, 1, bz - 1, -2, 3, bz, "blue");
      v.box(2, 1, bz - 1, 3, 3, bz, "blue");
      break;
    }

    case "tax_collecting_office": {
      // Octagonal Limestone & Brass Treasury Rotunda + flanking lower audit wings + golden dome
      const lowH = Math.max(4, Math.round(5 * hLv));
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -2, bx, 1 + lowH, 2, "limestone");
      const rotR = Math.min(3.8, Math.min(bx, bz) - 1);
      v.cylinderY(0, 0, 1, 4 + lowH + clampedLv * 2, rotR, "marble");
      for (let x = -bx + 1; x <= bx - 2; x += 3) {
        v.box(x, 1, 2, x + 1, 1 + lowH, 3, "brass");
      }
      v.dome(0, 4 + lowH + clampedLv * 2, 0, rotR, "gold");
      v.put(0, Math.round(4 + lowH + clampedLv * 2 + rotR), 0, "amber", 1.15);
      break;
    }

    case "fire_department": {
      // Low crimson multi-bay fire engine garage + red fire truck nose + tall spiral-stair hose & siren tower!
      const lowH = Math.max(4, Math.round(4.8 * hLv));
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz + 1, bx - 2, 1 + lowH, bz - 1, "crimson");
      v.box(-bx + 1, 1, bz - 1, -1, 4, bz, "white"); // apparatus door 1
      v.box(0, 1, bz - 1, Math.max(2, bx - 3), 4, bz, "white"); // apparatus door 2
      v.box(-bx + 2, 1, bz - 1, -2, 3, bz, "red"); // fire truck cab!
      addHippedRoofSafe(v, -bx, 1 + lowH, -bz + 1, bx - 2, bz - 1, 2, "slate", "white");
      // Iconic tall corner Hose-Drying & Siren Spiral Tower!
      addSpiralTower(v, bx - 2, -bz + 2, 1, 8 + lowH + clampedLv * 2, 2.2, "brickDark", "crimson", "brass", "red");
      break;
    }

    case "community_centers": {
      // Sweeping curved teal & warm-timber pavilion + sunken terracotta court + spiral roof garden ramp
      const lowH = Math.max(4, Math.round(5 * hLv));
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.35), 0, 1, 2 + lowH, Math.min(4.0, bz - 0.5), "teal");
      v.dome(-Math.floor(bx * 0.35), 2 + lowH, 0, Math.min(3.8, bz - 0.7), "woodLight");
      v.box(1, 1, -bz + 1, bx, 2, bz - 1, "terracotta"); // outdoor court
      v.box(bx - 1, 2, -1, bx, 5, 1, "white");
      if (clampedLv >= 3) {
        addSpiralTower(v, 1, -bz + 2, 1, 5 + lowH + clampedLv, 1.9, "wood", "leafLight", "white", "warmGlow");
      }
      break;
    }

    case "courthouses": {
      // Classical U-shaped marble colonnade wings framing a civic forecourt + tall central golden dome drum
      const wingH = Math.max(5, Math.round(6 * hLv));
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(6, padZ - 1);
      // Back main hall + left & right wings framing open front plaza
      v.box(-bx, 1, -bz, bx, 1 + wingH, 0, "marble");
      v.box(-bx, 1, 0, -bx + 3, 1 + Math.max(4, wingH - 1), bz - 1, "marble");
      v.box(bx - 3, 1, 0, bx, 1 + Math.max(4, wingH - 1), bz - 1, "marble");
      for (let x = -bx + 3; x <= bx - 4; x += 2) {
        v.box(x, 1, 0, x + 1, 1 + wingH, 1, "white");
      }
      // Tall cylindrical colonnaded drum + gleaming gold dome
      const drumH = wingH + 4 + clampedLv * 2;
      v.cylinderY(0, -2, 1 + wingH, drumH, 3.4, "white");
      v.dome(0, drumH, -2, 3.5, "gold");
      break;
    }

    case "government_buildings": {
      // Grand Capitol Complex: low East & West legislative wings + stepped rotunda drum + soaring white dome + corner cupolas
      const wingH = Math.max(5, Math.round(6.2 * hLv));
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(7, padZ - 1);
      // Lower East & West legislative wings
      v.box(-bx, 1, -bz + 2, bx, 1 + wingH, bz - 2, "limestone");
      addWindowGrid(v, -bx, 2, -bz + 2, bx, 1 + wingH, bz - 2, 3, 0.45);
      addGableSafe(v, -bx, 1 + wingH, -bz + 2, -3, bz - 2, 3, "z", "slate", "marble");
      addGableSafe(v, 3, 1 + wingH, -bz + 2, bx, bz - 2, 3, "z", "slate", "marble");
      // Soaring central multi-tier Capitol Rotunda & Dome!
      const drumTop = wingH + 5 + clampedLv * 2;
      v.cylinderY(0, 0, 1 + wingH, drumTop, 4.2, "marble");
      v.dome(0, drumTop, 0, 4.3, "white");
      v.box(0, drumTop + 4, 0, 1, drumTop + 8, 1, "gold", 1.1);
      if (clampedLv >= 3) {
        addSpiralTower(v, -bx + 2, -bz + 2, 1 + wingH, 5 + clampedLv, 1.8, "marble", "gold", "white", "gold");
        addSpiralTower(v, bx - 2, -bz + 2, 1 + wingH, 5 + clampedLv, 1.8, "marble", "gold", "white", "gold");
      }
      break;
    }

    // --------------------- POLICE & MILITARY (9) ---------------------
    case "police_precinct": {
      // L-shaped slate & navy precinct + cruiser dispatch bay + corner blue-strobe watch turret
      const lowH = Math.max(4, Math.round(5 * hLv));
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, 1, 1 + lowH, bz, "slateLight");
      v.box(1, 1, -bz, bx, 1 + Math.max(3, lowH - 2), 0, "blueDark");
      addWindowGrid(v, -bx, 2, -bz, 1, 1 + lowH, bz, 3, 0.45, "sky");
      v.box(-bx, 1 + lowH, -bz, 1, 2 + lowH, bz, "blueDark");
      // Parked black-and-white cruiser in front-right yard
      v.box(2, 1, 2, bx - 1, 3, 4, "blueDark");
      v.put(3, 3, 3, "sky", 1.2);
      addSpiralTower(v, -bx + 2, -bz + 2, 2 + lowH, 4 + clampedLv * 2, 1.9, "blueDark", "white", "sky", "sky");
      break;
    }

    case "police_departments": {
      // Twin-wing glass & navy Metro Police HQ + central cylindrical command rotunda + tall comms spire + helipad
      const lowH = Math.max(5, Math.round(6 * hLv));
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.box(-bx, 1, -bz, -1, 1 + lowH, bz - 1, "blueDark");
      v.box(1, 1, -bz, bx, 1 + Math.max(4, lowH - 2), bz - 2, "slate");
      addWindowGrid(v, -bx, 2, -bz, -1, 1 + lowH, bz - 1, 3, 0.5, "sky");
      const rotH = lowH + 4 + clampedLv * 2;
      v.cylinderY(0, 0, 1, rotH, 2.8, "steelLight");
      v.dome(0, rotH, 0, 2.8, "sky");
      v.box(bx - 3, 1 + Math.max(4, lowH - 2), -bz + 2, bx - 2, rotH + 5, -bz + 3, "steel");
      v.put(bx - 3, rotH + 5, -bz + 2, "red", 1.2);
      break;
    }

    case "jails": {
      // Octagonal granite panopticon hub + lower intake sally-port wing + corner searchlight turret
      const h = Math.round(6 * hLv);
      const bx = Math.max(5, padX - 1);
      const bz = Math.max(5, padZ - 1);
      v.cylinderY(-1, -1, 1, 2 + h, Math.min(3.8, bx - 1), "granite");
      v.dome(-1, 2 + h, -1, Math.min(3.6, bx - 1.2), "iron");
      v.box(1, 1, 0, bx, 1 + Math.max(3, h - 2), bz, "concreteDark");
      addSpiralTower(v, bx - 2, -bz + 2, 1, 5 + h + clampedLv, 1.8, "concreteDark", "iron", "steelLight", "amber");
      break;
    }

    case "prisons": {
      // Walled fortress compound + 4 corner watchtowers + radial X/cross cellblocks + central panopticon spiral spire!
      const h = Math.round(6 * (0.9 + clampedLv * 0.22));
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(6, padZ - 1);
      for (const [wx, wz] of [
        [-bx, -bz],
        [bx - 2, -bz],
        [-bx, bz - 2],
        [bx - 2, bz - 2],
      ]) {
        v.cylinderY(wx + 1, wz + 1, 1, 5 + h, 1.6, "concreteDark");
        v.put(wx + 1, 5 + h, wz + 1, "amber", 1.15);
      }
      // Cross-shaped radial cellblocks (never a plain rectangle!)
      v.box(-bx + 2, 1, -2, bx - 2, 1 + h, 2, "granite");
      v.box(-2, 1, -bz + 2, 2, 1 + h, bz - 2, "granite");
      addSpiralTower(v, 0, 0, 1 + h, 5 + clampedLv * 2, 2.2, "iron", "granite", "steelLight", "amber");
      break;
    }

    case "swat_team_hq": {
      // Angular stealth-charcoal Tactical Command Complex + lower armored APC bay + elevated cantilevered Helipad Tower!
      const lowH = Math.max(5, Math.round(5.5 * (0.9 + clampedLv * 0.22)));
      const tallH = lowH + 5 + clampedLv * 2;
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // Lower L-wing armored garage + parked black SWAT bearcat van
      v.box(-bx, 1, -bz, bx - 1, 1 + lowH, 0, "charcoal");
      addWindowGrid(v, -bx, 2, -bz, bx - 1, 1 + lowH, 0, 3, 0.55, "screenCyan");
      v.box(2, 1, 2, 7, 4, 6, "black"); // armored SWAT APC
      v.put(4, 4, 4, "sky", 1.2);
      // Elevated octagonal Helipad Tower on (-X, +Z)
      v.cylinderY(-3, 2, 1, tallH, 4.2, "slate");
      v.box(-6, tallH, -1, 0, tallH + 1, 5, "asphaltDark");
      v.box(-5, tallH + 1, 0, -4, tallH + 2, 4, "busYellow");
      v.box(-2, tallH + 1, 0, -1, tallH + 2, 4, "busYellow");
      v.box(-4, tallH + 1, 2, -2, tallH + 2, 3, "busYellow");
      // Tactical radar spiral mast on (+X, -Z)
      addSpiralTower(v, bx - 3, -bz + 3, 1 + lowH, 6 + clampedLv, 1.8, "steelDark", "screenCyan", "silver", "red");
      break;
    }

    case "military_base": {
      // Multi-structure Army Command Fort: Quonset barracks + octagonal HQ bunker + tank motor pool + spinning radar tower
      const h = Math.round(6.5 * (0.9 + clampedLv * 0.22));
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.cylinderY(-Math.floor(bx * 0.42), -Math.floor(bz * 0.35), 1, 2 + h, 3.8, "oliveDrab");
      v.dome(-Math.floor(bx * 0.42), 2 + h, -Math.floor(bz * 0.35), 3.8, "camoTan");
      // Curved Quonset hut barracks on (-X, +Z)
      v.box(-bx + 1, 1, 1, -1, 5, bz - 1, "oliveDrab");
      addGableSafe(v, -bx + 1, 5, 1, -1, bz - 1, 2, "x", "camoTan", "oliveDrab");
      // Parked pixel tank on motor pool pad!
      v.box(2, 1, 2, 7, 3, 6, "oliveDrab");
      v.box(3, 3, 3, 6, 4, 5, "camoTan");
      v.box(4, 3, 5, 5, 4, 8, "steelDark");
      // Spinning radar tower
      const radTop = 7 + h + clampedLv;
      v.cylinderY(bx - 3, -bz + 3, 1, radTop, 1.5, "steel");
      rotorVox = new PixelVox(950 + clampedVar);
      rotorVox.box(-3, 0, 0, 3, 2, 1, "silver");
      rotorPivot = [bx - 3, radTop, -bz + 3];
      rotorAxis = "y";
      rotorSpeed = 1.9;
      break;
    }

    case "airforce_base": {
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx, 1, 1, bx, 2, bz, "asphaltDark");
      for (let x = -bx + 2; x < bx - 2; x += 4) {
        v.box(x, 1, Math.floor((1 + bz) * 0.5), x + 2, 2, Math.floor((1 + bz) * 0.5) + 1, "white");
      }
      // Arched steel aircraft hangars + Soaring spiral ATC Control Tower
      v.box(-bx + 1, 1, -bz, 1, 6 + clampedLv, -1, "steelLight");
      addGableSafe(v, -bx + 1, 6 + clampedLv, -bz, 1, -1, 3, "x", "slate", "silver");
      const atcH = 12 + clampedLv * 2;
      addSpiralTower(v, 5, -bz + 3, 1, atcH, 2.2, "concrete", "sky", "white", "screenCyan");
      v.box(3, atcH - 2, -bz + 1, 7, atcH, -bz + 5, "glass", 0.75);
      // Swept-wing voxel fighter jet on tarmac!
      v.box(-5, 2, 3, 2, 3, 5, "silver");
      v.box(-2, 2, 1, 0, 3, 7, "steel");
      break;
    }

    case "naval_base": {
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx, 0, -bz, bx, 1, bz, "water");
      v.box(-bx, 1, -bz, bx, 3, 0, "concreteDark");
      // Harbor Admiralty Tower with spiral mast + moored grey warship
      v.box(-bx + 1, 3, -bz + 1, 0, 7 + clampedLv, -1, "steel");
      addSpiralTower(v, bx - 3, -bz + 3, 3, 8 + clampedLv * 2, 2.1, "steelLight", "blueDark", "white", "screenCyan");
      v.box(-5, 1, 3, 6, 4, 7, "steelDark");
      v.box(-1, 4, 4, 3, 7, 6, "steelLight");
      break;
    }

    case "submarine_base": {
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx, 0, -bz, bx, 1, bz, "waterDeep");
      // Slopedblast-hardened concrete U-pens + sonar dome tower + surfaced black sub
      v.box(-bx, 1, -bz, bx, 7 + clampedLv, 0, "concreteDark");
      addHippedRoofSafe(v, -bx, 7 + clampedLv, -bz, bx, 0, 3, "slate", "iron");
      v.box(-6, 1, -3, -2, 5, 0, "charcoal");
      v.box(2, 1, -3, 6, 5, 0, "charcoal");
      v.dome(bx - 3, 8 + clampedLv, -bz + 3, 2.5, "screenCyan");
      v.box(-5, 1, 2, -2, 3, 7, "black");
      v.box(-4, 3, 3, -3, 5, 5, "charcoal");
      break;
    }

    // --------------------- FAITH & HERITAGE (8) ---------------------
    case "churches": {
      const h = Math.round(6 * hLv);
      const bx = Math.max(4, padX - 2);
      const bz = Math.max(5, padZ - 2);
      v.box(-bx, 1, -bz, bx, 1 + h, bz - 1, st.wall);
      addGableSafe(v, -bx, 1 + h, -bz, bx, bz - 1, 4, "z", st.roof, st.trim);
      const stH = h + 7 + clampedLv * 2;
      v.box(-2, 1, bz - 3, 2, stH, bz, "white");
      v.cone(0, stH, stH + 5, bz - 1.5, 2.2, 0.4, st.roof);
      v.put(0, stH + 5, Math.round(bz - 1.5), "gold", 1.0);
      break;
    }

    case "christian_churches": {
      // Cruciform Twin-Spire Gothic Cathedral with transept wings, rose window & central crossing flèche!
      const h = Math.round(7.5 * hLv);
      const bx = Math.max(6, padX - 1);
      const bz = Math.max(6, padZ - 1);
      // Cruciform nave + wider transept arms (never a plain rectangle!)
      v.box(-Math.max(3, bx - 2), 1, -bz, Math.max(3, bx - 2), 1 + h, bz, "limestone");
      v.box(-bx, 1, -2, bx, 1 + Math.max(5, h - 1), 2, "limestone");
      addGableSafe(v, -Math.max(3, bx - 2), 1 + h, -bz, Math.max(3, bx - 2), bz, 4, "z", "slate", "marble");
      v.put(0, Math.floor(h * 0.72), bz, "magenta", 1.15); // glowing rose stained-glass window
      const spH = h + 9 + clampedLv * 2;
      for (const sx of [-bx + 1, bx - 3]) {
        v.box(sx, 1, bz - 3, sx + 2, spH, bz, "marble");
        v.cone(sx + 1, spH, spH + 6, bz - 1.5, 1.6, 0.35, "slate");
      }
      if (clampedLv >= 3) {
        v.cone(0, 4 + h, 10 + h + clampedLv, 0, 1.4, 0.3, "copper"); // crossing flèche spire
      }
      break;
    }

    case "monasteries": {
      // Cloistered quadrangle around central cypress herb courtyard + tall Romanesque spiral campanile!
      const h = Math.round(5.5 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx, 1, -bz, bx, 1 + h, -bz + 3, "plaster");
      v.box(-bx, 1, bz - 3, bx, 1 + Math.max(4, h - 1), bz, "plaster");
      v.box(-bx, 1, -bz, -bx + 3, 1 + h, bz, "plaster");
      v.box(bx - 3, 1, -bz, bx, 1 + h, bz, "plaster");
      v.box(-3, 1, -3, 3, 2, 3, "leafLight");
      v.cylinderY(0, 0, 2, 4, 1.3, "marble"); // cloister well
      addSpiralTower(v, bx - 2, -bz + 2, 1 + h, 8 + clampedLv * 2, 2.2, "terracotta", "cream", "gold", "warmGlow");
      break;
    }

    case "mosques": {
      // Grand Ottoman/Moorish Courtyard Mosque: cascading central & semi-domes + 4 slender spiral minarets!
      const h = Math.round(6.5 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      v.box(-bx + 2, 1, -bz + 2, bx - 2, 1 + h, bz - 2, "cream");
      v.dome(0, 1 + h, 0, Math.min(5.0, bx * 0.5), "teal");
      v.dome(-3, 1 + h, 0, 2.4, "sky");
      v.dome(3, 1 + h, 0, 2.4, "sky");
      v.put(0, Math.round(6 + h), 0, "gold", 1.1);
      const mh = h + 9 + clampedLv * 2;
      for (const [mx, mz] of [
        [-bx + 1, -bz + 1],
        [bx - 2, -bz + 1],
        [-bx + 1, bz - 2],
        [bx - 2, bz - 2],
      ]) {
        v.cylinderY(mx, mz, 1, mh, 1.1, "marble");
        v.cone(mx, mh, mh + 3, mz, 1.3, 0.3, "teal");
        v.put(mx, mh + 3, mz, "gold", 1.0);
      }
      break;
    }

    case "synagogues": {
      // Sculptural Jerusalem-Stone Octagonal Sanctuary + twin azure domes + arched stained-glass + spiral lantern turret!
      const h = Math.round(6.5 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // Stepped octagonal sanctuary base (non-boxy!)
      v.box(-bx + 2, 1, -bz + 1, bx - 2, 1 + h, bz - 1, "limestone");
      v.box(-bx + 1, 1, -bz + 3, bx - 1, 1 + Math.max(4, h - 1), bz - 3, "cream");
      addWindowGrid(v, -bx + 2, 2, -bz + 1, bx - 2, 1 + h, bz - 1, 3, 0.55, "sky");
      v.dome(0, 1 + h, 0, Math.min(4.2, bx * 0.42), "blue");
      v.dome(-4, 1 + Math.max(4, h - 1), 0, 2.3, "copper");
      v.dome(4, 1 + Math.max(4, h - 1), 0, 2.3, "copper");
      if (clampedLv >= 3) {
        addSpiralTower(v, 0, bz - 2, 1, 6 + h + clampedLv * 2, 1.9, "marble", "blue", "gold", "gold");
      }
      break;
    }

    case "temples": {
      // Multi-tiered East Asian curved-eave crimson & cream Pagoda!
      const bx = Math.max(7, padX - 1);
      const bz = Math.max(7, padZ - 1);
      const tiers = Math.min(5, 2 + clampedLv);
      let curY = 1;
      for (let t = 0; t < tiers; t++) {
        const w = Math.max(2, bx - t * 2);
        const d = Math.max(2, bz - t * 2);
        v.box(-w, curY, -d, w, curY + 3, d, "cream");
        v.box(-w - 1, curY + 3, -d - 1, w + 1, curY + 4, d + 1, "crimson");
        curY += 4;
      }
      v.box(0, curY, 0, 1, curY + 5, 1, "gold", 1.1);
      break;
    }

    case "lds_temples": {
      // Stepped wedding-cake white granite temple with 6 slender spires + soaring golden angel finial!
      const h = Math.round(7 * hLv);
      const bx = Math.max(8, padX - 1);
      const bz = Math.max(8, padZ - 1);
      // 3 narrowing wedding-cake setbacks
      v.box(-bx + 1, 1, -bz + 2, bx - 1, 1 + Math.floor(h * 0.55), bz - 2, "white");
      v.box(-bx + 3, 1 + Math.floor(h * 0.55), -bz + 3, bx - 3, 1 + h, bz - 3, "marble");
      addWindowGrid(v, -bx + 1, 2, -bz + 2, bx - 1, 1 + Math.floor(h * 0.55), bz - 2, 3, 0.55, "warmGlow");
      // 3 East spires & 3 West spires rising to asymmetric heights!
      const centerSpire = h + 11 + clampedLv * 2;
      const sideSpire = h + 7 + clampedLv;
      for (const sz of [-bz + 2, bz - 3]) {
        v.cone(0, 1 + h, centerSpire, sz, 1.8, 0.4, "white");
        v.cone(-3, 1 + Math.floor(h * 0.55), sideSpire, sz, 1.3, 0.4, "marble");
        v.cone(3, 1 + Math.floor(h * 0.55), sideSpire, sz, 1.3, 0.4, "marble");
      }
      v.box(0, centerSpire, bz - 3, 1, centerSpire + 3, bz - 2, "gold", 1.3); // golden Moroni statue finial
      break;
    }

    case "graveyards": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "moss");
      for (let x = -padX + 2; x < padX - 1; x += 3) {
        for (let z = -padZ + 2; z < padZ - 1; z += 3) {
          v.box(x, 1, z, x + 1, 3, z + 1, "stone");
        }
      }
      addCypressMini(v, -padX + 1, 1, -padZ + 1, 7 + clampedLv);
      addCypressMini(v, padX - 2, 1, padZ - 2, 6 + clampedLv);
      if (clampedLv >= 2) {
        // Gothic stone mausoleum with spire
        v.cylinderY(0, 0, 1, 4 + clampedLv * 2, 2.2, "granite");
        v.cone(0, 4 + clampedLv * 2, 8 + clampedLv * 2, 0, 2.5, 0.4, "slate");
      }
      break;
    }

    // --------------------- MARITIME & NAVAL (9 — 100% Distinct!) ---------------------
    case "docks": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "water");
      v.box(-4, 1, -padZ, 4, 2, padZ, "wood");
      for (let z = -padZ + 2; z < padZ; z += 5) {
        v.box(-4, 0, z, -3, 3, z + 1, "woodDark");
        v.box(3, 0, z, 4, 3, z + 1, "woodDark");
      }
      v.box(-2, 2, -2, 1, 4 + Math.min(2, clampedLv - 1), 1, "crate");
      if (clampedLv >= 2) {
        // Mini striped harbor lighthouse at pier tip!
        addSpiralTower(v, 2, -padZ + 3, 2, 6 + clampedLv * 2, 1.6, "white", "red", "brass", "warmGlow");
      }
      break;
    }

    case "ship_building_areas": {
      // Traditional Timber Boatwright Slipway: pitched cedar boathouse + wooden keel ribs on sloped ramp
      v.box(-padX, 0, -padZ, padX, 1, padZ, "water");
      v.box(-padX, 1, -padZ, padX, 2, 0, "wood");
      v.box(-padX + 1, 2, -padZ + 1, 0, 6 + clampedLv, -1, "oak");
      addGableSafe(v, -padX + 1, 6 + clampedLv, -padZ + 1, 0, -1, 3, "x", "crimson", "woodLight");
      // Exposed curved wooden ship ribs on slipway
      for (let z = 1; z < padZ - 1; z += 2) {
        v.box(-2, 1, z, 2, 3 + Math.min(2, clampedLv - 1), z + 1, "woodDark");
      }
      break;
    }

    case "shipyards": {
      // Heavy Industrial Steel Drydock Basin + twin giant yellow Goliath Gantry Cranes + steel ship hull!
      v.box(-padX, 0, -padZ, padX, 1, padZ, "waterDeep");
      v.box(-padX, 1, -padZ, -padX + 3, 3, padZ, "concreteDark");
      v.box(padX - 3, 1, -padZ, padX, 3, padZ, "concreteDark");
      const ch = 10 + clampedLv * 3;
      for (const cz of [-Math.max(2, Math.floor(padZ * 0.4)), Math.max(2, Math.floor(padZ * 0.4))]) {
        v.box(-padX + 1, 3, cz, -padX + 2, ch, cz + 1, "busYellow");
        v.box(padX - 2, 3, cz, padX - 1, ch, cz + 1, "busYellow");
        v.box(-padX + 1, ch - 1, cz, padX - 1, ch, cz + 1, "busYellow");
      }
      // Large red-and-black steel cargo ship hull in drydock
      v.box(-3, 1, -padZ + 2, 3, 4 + clampedLv, padZ - 2, "crimson");
      v.box(-2, 4 + clampedLv, -padZ + 3, 2, 7 + clampedLv, -padZ + 6, "white");
      v.put(0, 4 + clampedLv, 0, "warmGlow", 1.2); // welding arc!
      break;
    }

    case "boats": {
      // Classic wooden-decked harbor fishing trawler with tall wheelhouse & net boom
      bobOnWater = true;
      const bl = Math.max(4, padZ - 1);
      v.box(-2, 0, -bl, 2, 2, bl, "wood");
      v.box(-2, 1, -bl, 2, 2, bl, "white");
      v.box(-1, 2, -2, 1, 5 + Math.min(2, clampedLv - 1), 1, "sky"); // tall wheelhouse
      v.box(0, 2, 1, 1, 7 + clampedLv, 2, "woodDark"); // trawler derrick mast
      break;
    }

    case "speed_boats": {
      // Sleek raked V-hull crimson & white racing cigarette boat + twin outboards + whitewater wake!
      bobOnWater = true;
      const bl = Math.max(4, padZ - 1);
      v.box(-2, 0, -bl, 2, 1, bl - 1, "red");
      v.box(-1, 1, -bl + 1, 1, 2, bl, "white"); // tapered pointy bow
      v.box(-1, 2, -1, 1, 3, 2, "glass", 0.65); // low wraparound racing windscreen
      v.box(-1, 0, -bl, 1, 2, -bl + 1, "charcoal"); // twin outboard motors
      v.box(-2, 0, -bl, 2, 1, -bl + 1, "foam", 0.6);
      break;
    }

    case "sail_boats": {
      bobOnWater = true;
      const bl = Math.max(4, padZ - 1);
      v.box(-2, 0, -bl, 2, 2, bl, "white");
      const mh = 9 + clampedLv * 3;
      v.box(0, 2, 0, 1, mh, 1, "woodDark");
      v.box(0, 3, -bl + 1, 1, mh - 1, 0, "white");
      v.box(0, 4, 1, 1, mh - 2, bl - 1, st.accent);
      if (clampedLv >= 3) {
        v.put(0, mh, 0, "gold", 0.9);
      }
      break;
    }

    case "naval_vessels": {
      bobOnWater = true;
      const nl = Math.max(6, padZ - 1);
      v.box(-3, 0, -nl, 3, 3, nl, "steel");
      v.box(-2, 3, -3, 2, 7 + clampedLv * 2, 3, "steelLight");
      v.box(-1, 3, nl - 4, 1, 4, nl - 1, "charcoal");
      rotorVox = new PixelVox(960);
      rotorVox.box(-2, 0, 0, 2, 1, 1, "white");
      rotorPivot = [0, 7 + clampedLv * 2, 0];
      rotorAxis = "y";
      rotorSpeed = 2.2;
      break;
    }

    case "submarines": {
      bobOnWater = true;
      const sl = Math.max(6, padZ - 1);
      v.box(-2, 0, -sl, 2, 3, sl, "charcoal");
      v.box(-1, 3, -3, 1, 6 + clampedLv, 2, "charcoal");
      v.box(0, 6 + clampedLv, 0, 1, 8 + clampedLv, 1, "brass");
      break;
    }

    case "aircraft_carriers": {
      bobOnWater = true;
      const cl = Math.max(12, padZ - 1);
      const cw = Math.max(7, padX - 1);
      v.box(-cw + 2, 0, -cl, cw - 2, 4, cl, "steelDark");
      v.box(-cw, 4, -cl, cw, 5, cl, "asphaltDark");
      v.box(-1, 4, -cl + 1, 0, 5, cl - 1, "white");
      v.box(cw - 3, 5, -3, cw, 11 + clampedLv * 2, 4, "steel");
      v.box(-cw + 2, 5, -6, -cw + 4, 6, -3, "silver");
      v.box(-cw + 2, 5, 3, -cw + 4, 6, 6, "silver");
      if (clampedLv >= 3) {
        v.box(-cw + 2, 5, cl - 4, 2, 6, cl - 1, "steelLight");
        v.put(cw - 2, 11 + clampedLv * 2, 0, "red", 1.15);
      }
      break;
    }

    // --------------------- NATURE & TERRAIN (16 — Every One Visually Distinct!) ---------------------
    case "trees": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass");
      const th = Math.round(7 * (0.8 + clampedLv * 0.44));
      const trunkW = clampedLv >= 4 ? 2 : 1;
      v.box(-trunkW, 1, -trunkW, trunkW, 1 + Math.floor(th * 0.52), trunkW, "woodDark");
      const lc = clampedVar === 1 ? "pink" : clampedVar === 2 ? "orange" : "leaf";
      const radX = Math.min(padX - 1, 2.8 + clampedLv * 1.15);
      const radZ = Math.min(padZ - 1, 2.8 + clampedLv * 1.15);
      v.sphere(0, 1 + th * 0.74, 0, radX, th * 0.45, radZ, lc);
      if (clampedLv >= 3) {
        v.sphere(-2, 1 + th * 0.62, 1.5, Math.min(3.5, radX * 0.65), th * 0.32, Math.min(3.5, radZ * 0.65), lc);
      }
      break;
    }

    case "pine_trees": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      const th = Math.round(8 * (0.8 + clampedLv * 0.45));
      v.box(-1, 1, -1, 1, 3 + clampedLv, 1, "woodDark");
      const rad = Math.min(padX - 1, 3.0 + clampedLv * 1.1);
      v.cone(0, 3, 3 + th, 0, rad, 0.7, "leafDark");
      if (clampedLv >= 3) {
        v.cone(0, Math.floor(th * 0.45), 4 + th, 0, Math.max(2, rad * 0.72), 0.5, "leaf");
      }
      break;
    }

    case "redwood_trees": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      const th = Math.round(14 * (0.8 + clampedLv * 0.45));
      v.cylinderY(0, 0, 1, Math.floor(th * 0.68), 1.4 + clampedLv * 0.35, "brickDark");
      v.cone(0, Math.floor(th * 0.36), th + 4, 0, Math.min(padX - 1, 3.2 + clampedLv * 1.1), 0.7, "leafDark");
      break;
    }

    case "plants": {
      // Terracotta botanical planter box bursting with tall tropical fronds & vibrant blossoms
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass3");
      const pw = Math.min(padX - 1, 2 + clampedLv);
      v.box(-pw, 1, -pw, pw, 2, pw, "terracotta");
      v.cone(0, 2, 5 + clampedLv * 2, 0, Math.max(2, pw), 0.6, "leafLight");
      v.put(-1, 4 + clampedLv, 0, "pink");
      v.put(1, 3 + clampedLv, 1, "yellow");
      v.put(0, 5 + clampedLv * 2, 0, "magenta");
      break;
    }

    case "shrubs": {
      // Sculpted spiral ornamental topiary cones on trimmed courtyard turf!
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass");
      const topH = 5 + clampedLv * 2;
      addSpiralTower(v, 0, 0, 1, topH, Math.min(2.4, padX - 1), "woodDark", "moss", "leafLight");
      break;
    }

    case "bushes": {
      // Wild multi-clump berry bramble thickets dotted with bright red & magenta berries
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      const rw = Math.min(padX - 1, 2.0 + clampedLv * 0.7);
      v.sphere(-1, 2, -1, rw, 1.6 + clampedLv * 0.5, rw, "leafDark");
      v.sphere(1.5, 2, 1, rw * 0.85, 1.5 + clampedLv * 0.4, rw * 0.85, "leaf");
      v.put(1, 3, 2, "red");
      v.put(-2, 3, 0, "red");
      v.put(0, 3, -2, "magenta");
      break;
    }

    case "tubbleweeds": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      const rw = Math.min(padX - 1, 2.2 + clampedLv * 0.6);
      v.sphere(0, 2.5 + clampedLv * 0.4, 0, rw, rw, rw, "wood");
      v.put(2, 3, 1, "oak");
      break;
    }

    case "ponds": {
      // Intimate circular boulder-rimmed koi & lotus pond
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      const pr = Math.min(padX - 1, 3.2 + clampedLv);
      v.cylinderY(0, 0, 0, 1, pr + 0.8, "stone");
      v.cylinderY(0, 0, 0, 1, pr, "water", 0.2);
      v.put(-1, 1, 1, "leafLight");
      v.put(1, 1, -1, "pink");
      v.put(0, 1, 2, "orange"); // koi flash
      break;
    }

    case "lakes": {
      // Deep sapphire alpine lake with central pine islet & timber fishing pier!
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass2");
      v.box(-padX + 1, 0, -padZ + 1, padX - 1, 1, padZ - 1, "waterDeep", 0.18);
      v.cylinderY(0, 0, 1, 2, 2.0, "grass"); // central mini islet
      addCypressMini(v, 0, 2, 0, 5 + clampedLv);
      v.box(-1, 1, -padZ + 1, 1, 2, -2, "wood"); // fishing pier
      break;
    }

    case "hills": {
      // Rolling multi-knoll terraced green hills with crest oak tree
      v.box(-padX, 0, -padZ, padX, 1, padZ, "grass");
      const mh = Math.round(5.5 * (0.78 + clampedLv * 0.38));
      v.sphere(-1, 1, 0, Math.min(padX - 1, 4.2 + clampedLv), mh * 0.75, Math.min(padZ - 1, 4.2 + clampedLv), "grass2");
      v.sphere(2, 1, 2, Math.min(padX - 2, 3.0 + clampedLv * 0.7), mh * 0.55, Math.min(padZ - 2, 3.0 + clampedLv * 0.7), "grass3");
      addTreeMini(v, -1, Math.max(2, Math.round(mh * 0.65)), 0, clampedVar);
      break;
    }

    case "mountains": {
      // Jagged multi-peak rocky alpine massif with snow-capped summit & craggy secondary spires!
      const mh = Math.round(14 * (0.78 + clampedLv * 0.42));
      const baseR = Math.min(padX, padZ);
      v.cone(0, 0, mh, 0, baseR, 1.1, "stone");
      v.cone(0, Math.floor(mh * 0.6), mh + 1, 0, Math.min(4.6, baseR * 0.48), 0.5, "snow");
      if (baseR >= 6) {
        const subH = Math.floor(mh * 0.72);
        v.cone(-Math.floor(baseR * 0.42), 0, subH, Math.floor(baseR * 0.3), baseR * 0.55, 0.9, "granite");
        v.cone(-Math.floor(baseR * 0.42), Math.floor(subH * 0.68), subH + 1, Math.floor(baseR * 0.3), baseR * 0.25, 0.4, "snow");
      }
      break;
    }

    case "canyons": {
      const ch = 5 + clampedLv * 3;
      v.box(-padX, 0, -padZ, -2, ch, padZ, "terracotta");
      v.box(2, 0, -padZ, padX, ch - 1, padZ, "brick2");
      v.box(-2, 0, -padZ, 2, 1, padZ, "water", 0.18);
      if (clampedLv >= 3) {
        // Natural red-rock canyon arch bridge!
        v.box(-2, ch - 2, -1, 2, ch, 1, "terracotta");
      }
      break;
    }

    case "sand": {
      // Sculpted wind-rippled golden coastal sand dunes + sea-grass tufts
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      v.sphere(-1, 1, 0, Math.min(padX - 1, 3.5 + clampedLv), 1.5 + clampedLv * 0.4, Math.min(padZ - 1, 2.8 + clampedLv), "sandDark");
      v.put(2, 1, 2, "leafLight");
      v.put(-2, 1, -2, "wood");
      break;
    }

    case "beaches": {
      // Rolling ocean surf foam + wooden lifeguard watchtower + colorful towels
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      v.box(-padX, 0, padZ - 3, padX, 1, padZ - 1, "foam", 0.35);
      v.box(-padX, 0, padZ - 1, padX, 1, padZ, "water", 0.25);
      // Lifeguard hut on stilts
      v.box(2, 1, -3, 5, 4 + clampedLv, 0, "white");
      addGableSafe(v, 2, 4 + clampedLv, -3, 5, 0, 2, "x", "red", "white");
      v.box(-4, 1, 0, -1, 2, 3, "cyan");
      break;
    }

    case "beach_umbrellas": {
      // Resort parasol cluster with twin striped cones & sun loungers
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      v.box(0, 1, 0, 1, 5 + clampedLv, 1, "white");
      v.cone(0.5, 5 + clampedLv, 7 + clampedLv, 0.5, 3.6, 0.5, st.accent);
      v.box(-3, 1, 1, 1, 2, 3, "sky");
      if (clampedLv >= 2) {
        v.box(-3, 1, -3, -2, 4 + clampedLv, -2, "white");
        v.cone(-2.5, 4 + clampedLv, 6 + clampedLv, -2.5, 2.6, 0.5, "busYellow");
      }
      break;
    }

    case "deserts": {
      // Arid red-rock mesa + multi-armed Saguaro cacti!
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      const ch = 5 + clampedLv * 2;
      v.box(0, 1, 0, 1, 1 + ch, 1, "leafDark");
      v.box(-2, 3, 0, 0, 4, 1, "leafDark");
      v.box(-2, 4, 0, -1, 7, 1, "leafDark");
      v.box(1, 4, 0, 3, 5, 1, "leafDark");
      v.box(2, 5, 0, 3, 8, 1, "leafDark");
      if (clampedLv >= 3) {
        v.cone(-3, 1, 4 + clampedLv, -3, 2.6, 1.5, "terracotta");
      }
      break;
    }

    case "swamps": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "tealDark");
      addTreeMini(v, -2, 1, 0, 0);
      v.put(3, 1, 2, "moss");
      break;
    }

    case "alligators": {
      v.box(-padX, 0, -padZ, padX, 1, padZ, "tealDark");
      v.box(-1, 1, -5, 2, 2, 5, "leafDark");
      v.box(-1, 2, 2, 2, 3, 5, "moss");
      v.put(-1, 2, 5, "white");
      v.put(1, 2, 5, "white");
      break;
    }

    // --------------------- WORLD LANDMARKS (7) ---------------------
    case "large_landmarks": {
      // Monumental Triumphal Arch + rooftop quadriga chariot sculpture & spiral corner reliefs
      const h = Math.round(12 * (0.88 + clampedLv * 0.25));
      const bx = Math.max(7, padX - 1);
      v.box(-bx, 1, -4, -3, 1 + h, 4, "marble");
      v.box(3, 1, -4, bx, 1 + h, 4, "marble");
      v.box(-bx, h - 2, -4, bx, 2 + h, 4, "marbleShade");
      v.box(-bx + 1, 2 + h, -3, bx - 1, 4 + h, 3, "limestone");
      v.sphere(0, 5 + h, 0, 2.8, 2.0, 1.8, "gold"); // golden rooftop quadriga crown!
      break;
    }

    case "washington_monument": {
      const oh = Math.round(20 * (0.82 + clampedLv * 0.34));
      v.cone(0, 1, oh, 0, 2.8, 1.1, "marble");
      addHippedRoofSafe(v, -2, oh, -2, 2, 2, 3, "gold");
      for (const [fx, fz] of [
        [-5, -5],
        [5, -5],
        [-5, 5],
        [5, 5],
      ]) {
        v.box(fx, 1, fz, fx + 1, 4, fz + 1, "white");
        v.put(fx, 4, fz, "red");
      }
      break;
    }

    case "white_house": {
      // Executive Residence + rounded South Truman Portico + lower East & West Colonnade Wings + fountain!
      const h = Math.round(7.5 * (0.9 + clampedLv * 0.22));
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(7, padZ - 1);
      // Central Executive Mansion
      v.box(-5, 1, -bz + 2, 5, 1 + h, bz - 2, "white");
      addWindowGrid(v, -5, 2, -bz + 2, 5, 1 + h, bz - 2, 3, 0.5);
      addHippedRoofSafe(v, -5, 1 + h, -bz + 2, 5, bz - 2, 2, "slate", "marble");
      // Rounded South Portico rotunda
      v.cylinderY(0, bz - 2, 1, 1 + h, 2.6, "marble");
      // Lower East Wing & West Wing pavilions!
      const wingH = Math.max(4, Math.floor(h * 0.58));
      v.box(-bx, 1, -3, -5, 1 + wingH, 3, "white");
      v.box(5, 1, -3, bx, 1 + wingH, 3, "white");
      v.cylinderY(0, bz, 1, 2, 1.8, "cyan", 0.45);
      break;
    }

    case "smithsonian": {
      // Multi-Turret Red-Sandstone Norman Castle (tall central flag keep + asymmetrical round & octagonal slate spires!)
      const h = Math.round(7.5 * (0.9 + clampedLv * 0.22));
      const bx = Math.max(10, padX - 1);
      const bz = Math.max(7, padZ - 1);
      v.box(-bx + 2, 1, -2, bx - 2, 1 + h, 3, "brick2");
      addGableSafe(v, -bx + 2, 1 + h, -2, bx - 2, 3, 3, "x", "slate", "brickDark");
      // Tall central Norman Keep + Flagpole
      v.box(-3, 1, -4, 3, 6 + h + clampedLv, 2, "brickDark");
      v.cone(0, 6 + h + clampedLv, 11 + h + clampedLv, -1, 3.2, 0.5, "slate");
      // Asymmetrical corner & flank castle turrets!
      addSpiralTower(v, -bx + 3, 3, 1, 5 + h + clampedLv * 2, 2.1, "brick2", "brickDark", "limestone", "warmGlow");
      v.cylinderY(bx - 3, 3, 1, 4 + h + clampedLv, 2.0, "brick2");
      v.cone(bx - 3, 4 + h + clampedLv, 9 + h + clampedLv, 3, 2.3, 0.4, "slate");
      break;
    }

    case "eiffel_tower": {
      const th = Math.round(20 * (0.82 + clampedLv * 0.34));
      const bw = Math.max(5, padX - 2);
      for (let y = 1; y < th; y++) {
        const t = y / th;
        const s = Math.max(1, Math.round((1 - t) ** 1.45 * bw));
        v.put(-s, y, -s, "copper");
        v.put(s, y, -s, "copper");
        v.put(-s, y, s, "copper");
        v.put(s, y, s, "copper");
        if (y === Math.floor(th * 0.35) || y === Math.floor(th * 0.68)) {
          v.box(-s - 1, y, -s - 1, s + 2, y + 1, s + 2, "brass", 0.55);
        }
      }
      v.box(0, th, 0, 1, th + 6, 1, "gold", 1.25);
      break;
    }

    case "the_london_eye": {
      const R = Math.min(10, Math.max(5, padX - 2) + clampedLv);
      const cy = R + 4;
      for (let y = 1; y <= cy; y++) {
        const zOff = Math.round(((cy - y) / cy) * 3);
        v.put(-1, y, -zOff - 1, "white");
        v.put(1, y, -zOff - 1, "white");
      }
      rotorVox = new PixelVox(980 + clampedVar);
      rotorVox.ringZ(0, 0, 0, 1, R, R - 1.2, "white");
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const px = Math.round(Math.cos(ang) * R);
        const py = Math.round(Math.sin(ang) * R);
        rotorVox.box(px - 1, py - 1, 1, px + 1, py + 1, 2, "screenCyan", 0.9);
      }
      rotorPivot = [0, cy, 1];
      rotorAxis = "z";
      rotorSpeed = 0.45;
      break;
    }

    case "the_great_pyramids": {
      // Giza Necropolis Trio: Great Pyramid with golden capstone + 2 offset companion pyramids!
      const bw = Math.max(6, Math.min(padX, padZ) - 3);
      v.box(-padX, 0, -padZ, padX, 1, padZ, "sand");
      addHippedRoofSafe(v, -bw - 1, 1, -bw - 1, bw - 1, bw - 1, bw, "sandDark", "limestone");
      v.box(-2, bw, -2, 0, bw + 2, 0, "gold", 1.2);
      if (padX >= 9) {
        const sub = Math.max(3, Math.floor(bw * 0.55));
        addHippedRoofSafe(v, padX - sub * 2 - 1, 1, padZ - sub * 2 - 1, padX - 1, padZ - 1, sub + 1, "limestone", "gold");
      }
      break;
    }

    default: {
      const h = Math.round(6 * hLv);
      const bx = Math.max(4, padX - 2);
      const bz = Math.max(4, padZ - 2);
      v.box(-bx, 1, -bz, 1, 1 + h, bz, st.wall);
      addWindowGrid(v, -bx, 2, -bz, 1, 1 + h, bz, 3, 0.4);
      addSpiralTower(v, Math.max(1, bx - 2), 0, 1, 4 + h + clampedLv, 2.0, st.trim, st.roof, "white", "warmGlow");
      break;
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
  void packVoxKey;
  return group;
}
