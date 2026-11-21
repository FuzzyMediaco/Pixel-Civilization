/**
 * Animated livestock: tiny voxel animal models (built at half-voxel resolution) split into moving parts, the
 * per-kind behaviour tuning, and a static "posed herd" preview for galleries / ghosts / the field guide.
 * The live wandering simulation lives in farmActivity.ts (CritterHerds); designs register pens via c.critters().
 */
import * as THREE from "three";
import type { CritterKind, CritterSpec } from "./designs/kit";
import { buildVoxelGeometry, getPixelVoxelMaterial, PixelVox, VOXEL_SIZE } from "./voxelCore";

/** Model resolution: one micro-voxel = half a design voxel. */
export const CRITTER_UNIT = VOXEL_SIZE / 2;

export type CritterRole = "body" | "head" | "legA" | "legB" | "wings";
export interface CritterPart {
  role: CritterRole;
  geo: THREE.BufferGeometry;
  /** pivot (metres, model space: feet at y=0, facing +z) */
  pivot: [number, number, number];
}
export interface CritterModel {
  parts: CritterPart[];
  /** all parts at rest, for static previews */
  whole: THREE.BufferGeometry;
}

/** A pen in element-local metres (same frame as smokePoints). */
export interface BuiltCritterPen {
  kind: CritterKind;
  coat: number;
  count: number;
  /** x0, z0, x1, z1 (metres) */
  area: [number, number, number, number];
  y: number;
  /** model scale (old saves squeeze a model into a smaller plot) */
  scale: number;
}

export interface CritterTuning {
  speed: number;
  turn: number;
  /** idle seconds range */
  idle: [number, number];
  spacing: number;
  stride: number;
  bounce: number;
  graze: number;
  hop?: boolean;
  fly?: boolean;
  waddle?: boolean;
}
export const CRITTER_TUNING: Record<CritterKind, CritterTuning> = {
  cow: { speed: 0.32, turn: 1.6, idle: [2.5, 7], spacing: 1.25, stride: 5, bounce: 0.02, graze: 0.75 },
  sheep: { speed: 0.36, turn: 2.2, idle: [1.5, 5], spacing: 0.85, stride: 7, bounce: 0.035, graze: 0.8 },
  pig: { speed: 0.38, turn: 2.4, idle: [1.5, 5], spacing: 0.9, stride: 9, bounce: 0.03, graze: 0.55 },
  chicken: { speed: 0.55, turn: 5, idle: [0.6, 2.4], spacing: 0.4, stride: 16, bounce: 0.04, graze: 1.1, hop: true },
  horse: { speed: 0.6, turn: 1.8, idle: [2, 6], spacing: 1.5, stride: 6, bounce: 0.04, graze: 0.95 },
  goat: { speed: 0.45, turn: 3, idle: [1, 4], spacing: 0.75, stride: 9, bounce: 0.05, graze: 0.7, hop: true },
  duck: { speed: 0.35, turn: 3.5, idle: [1, 3.5], spacing: 0.45, stride: 10, bounce: 0.015, graze: 0.9, waddle: true },
  bee: { speed: 1.4, turn: 9, idle: [0.2, 0.9], spacing: 0.2, stride: 40, bounce: 0, graze: 0, fly: true },
};

type Box = (role: CritterRole, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: string) => void;
interface Coat {
  a: string;
  b: string;
  c: string;
  d: string;
}
const COATS: Record<CritterKind, Coat[]> = {
  // a = body, b = patches / mane, c = legs / hooves, d = face / muzzle accent
  cow: [
    { a: "white", b: "black", c: "charcoal", d: "pink" }, // Holstein
    { a: "#c98a4a", b: "#a86a34", c: "#3a2a20", d: "#2a1e18" }, // Jersey
    { a: "#8a7a6a", b: "#6a5a4c", c: "#3a3028", d: "#e8dcc8" }, // Brown Swiss
    { a: "white", b: "#a8402a", c: "#5a3020", d: "pink" }, // Ayrshire
    { a: "#9a3a22", b: "white", c: "#4a2418", d: "white" }, // Hereford
    { a: "#26262a", b: "#3a3a40", c: "#18181a", d: "#4a4a50" }, // Angus
    { a: "#d0904a", b: "white", c: "#5a3a20", d: "#f0e0c0" }, // Longhorn
    { a: "#b06a4a", b: "#e8d8c8", c: "#4a2a1a", d: "pink" }, // Shorthorn roan
  ],
  sheep: [
    { a: "white", b: "#f4f1e6", c: "charcoal", d: "#2e2a28" },
    { a: "#efe2c2", b: "#e2d2ac", c: "#3a2e26", d: "#3a2e26" },
    { a: "#4a4440", b: "#5a5450", c: "charcoal", d: "#1e1c1a" },
    { a: "#a88a6a", b: "#b89a7a", c: "#3a2e26", d: "#e8dccc" },
  ],
  pig: [
    { a: "#f4a3bb", b: "#e88aa6", c: "#d97c9a", d: "#c96a88" },
    { a: "#f4b8c8", b: "#3a3236", c: "#d98ca4", d: "#c96a88" }, // spotted
    { a: "#2e2a2c", b: "#f0e8e8", c: "#f0e8e8", d: "#f4a3bb" }, // Berkshire
    { a: "#d8823a", b: "#c06a28", c: "#a85a20", d: "#e8a07a" }, // Tamworth
  ],
  chicken: [
    { a: "white", b: "#f2efe6", c: "orange", d: "red" },
    { a: "#e3a64a", b: "#c8862e", c: "orange", d: "red" }, // buff
    { a: "#9a4a22", b: "#6a2e16", c: "orange", d: "red" }, // red
    { a: "#2a2a30", b: "#3a4a5a", c: "#e0a030", d: "red" }, // black
  ],
  horse: [
    { a: "#a0522d", b: "#6a3018", c: "#5a2a14", d: "white" }, // chestnut
    { a: "#e3b860", b: "#f7ecc8", c: "#c89a48", d: "white" }, // palomino
    { a: "#b8bcc2", b: "#4a4c52", c: "#6a6c72", d: "#d8dce2" }, // dapple grey
    { a: "#6a3a1e", b: "#1a1414", c: "#1a1414", d: "#6a3a1e" }, // bay
  ],
  goat: [
    { a: "#ece6d8", b: "#c8b8a0", c: "#6a5a4a", d: "#d8c8b0" },
    { a: "#7a5a3a", b: "#2a2420", c: "#2a2420", d: "white" },
    { a: "#2a2622", b: "#e8e0d0", c: "#1a1816", d: "#e8e0d0" },
    { a: "#c88a4a", b: "#ffffff", c: "#4a3020", d: "white" },
  ],
  duck: [
    { a: "white", b: "#f2efe6", c: "orange", d: "orange" },
    { a: "#8a6a4a", b: "#2a7a4a", c: "orange", d: "#e0c040" }, // mallard
    { a: "#c8a878", b: "#a88858", c: "orange", d: "orange" },
    { a: "#2a2a30", b: "#3a6a5a", c: "#5a5a5a", d: "#e0c040" },
  ],
  bee: [
    { a: "#ffcc22", b: "#2a2420", c: "#f4fbff", d: "#2a2420" },
    { a: "#ffb020", b: "#2a2420", c: "#f4fbff", d: "#2a2420" },
    { a: "#ffd84a", b: "#3a3028", c: "#f4fbff", d: "#2a2420" },
    { a: "#f0a020", b: "#2a2420", c: "#f4fbff", d: "#2a2420" },
  ],
};

/** pivots in micro-voxels */
const PIVOTS: Record<CritterKind, Partial<Record<CritterRole, [number, number, number]>>> = {
  cow: { body: [0, 0, 0], head: [0, 6, 4], legA: [0, 3, 0], legB: [0, 3, 0] },
  sheep: { body: [0, 0, 0], head: [0, 4, 3], legA: [0, 2, 0], legB: [0, 2, 0] },
  pig: { body: [0, 0, 0], head: [0, 3, 3], legA: [0, 2, 0], legB: [0, 2, 0] },
  chicken: { body: [0, 0, 0], head: [0, 3, 1], legA: [0, 1, 0], legB: [0, 1, 0] },
  horse: { body: [0, 0, 0], head: [0, 8, 4], legA: [0, 5, 0], legB: [0, 5, 0] },
  goat: { body: [0, 0, 0], head: [0, 5, 3], legA: [0, 3, 0], legB: [0, 3, 0] },
  duck: { body: [0, 0, 0], head: [0, 2, 1], legA: [0, 1, 0], legB: [0, 1, 0] },
  bee: { body: [0, 0, 0], wings: [0, 1, 0] },
};

function paint(kind: CritterKind, k: Coat, box: Box) {
  switch (kind) {
    case "cow": {
      for (const [x, z, role] of [[-2, -4, "legA"], [1, 3, "legA"], [1, -4, "legB"], [-2, 3, "legB"]] as const)
        box(role, x, 0, z, x + 1, 3, z + 1, k.c);
      box("body", -2, 3, -4, 2, 7, 4, k.a);
      box("body", -2, 5, -3, -1, 7, 0, k.b);
      box("body", 1, 3, 0, 2, 6, 3, k.b);
      box("body", -1, 6, 1, 1, 7, 3, k.b);
      box("body", -1, 3, -1, 1, 4, 1, "pink");
      box("body", 0, 4, -5, 1, 7, -4, k.a); // tail
      box("body", 0, 3, -5, 1, 4, -4, k.b);
      box("head", -1, -2, 0, 1, 1, 3, k.a);
      box("head", -1, -2, 3, 1, 0, 4, k.d);
      box("head", -1, 0, 1, 0, 1, 2, k.b);
      box("head", -2, 0, 1, -1, 1, 2, k.a); // ears
      box("head", 1, 0, 1, 2, 1, 2, k.a);
      box("head", -1, 1, 1, 0, 2, 2, "cream"); // horns
      box("head", 0, 1, 1, 1, 2, 2, "cream");
      box("head", -1, -1, 2, 0, 0, 3, "black");
      box("head", 0, -1, 2, 1, 0, 3, "black");
      break;
    }
    case "sheep": {
      for (const [x, z, role] of [[-2, -3, "legA"], [1, 2, "legA"], [1, -3, "legB"], [-2, 2, "legB"]] as const)
        box(role, x, 0, z, x + 1, 2, z + 1, k.c);
      box("body", -2, 2, -3, 2, 5, 3, k.a);
      box("body", -1, 5, -2, 1, 6, 2, k.b);
      box("body", -3, 3, -2, 3, 4, 2, k.b);
      box("body", -1, 2, -4, 1, 4, 3, k.a);
      box("head", -1, -1, 0, 1, 1, 2, k.d);
      box("head", -1, 1, 0, 1, 2, 1, k.a);
      box("head", -2, 0, 0, -1, 1, 1, k.d);
      box("head", 1, 0, 0, 2, 1, 1, k.d);
      box("head", -1, 0, 1, 0, 1, 2, "white");
      break;
    }
    case "pig": {
      for (const [x, z, role] of [[-2, -3, "legA"], [1, 2, "legA"], [1, -3, "legB"], [-2, 2, "legB"]] as const)
        box(role, x, 0, z, x + 1, 2, z + 1, k.c);
      box("body", -2, 2, -3, 2, 5, 3, k.a);
      box("body", -2, 4, -2, -1, 5, 0, k.b);
      box("body", 1, 2, 0, 2, 4, 2, k.b);
      box("body", 0, 4, -4, 1, 5, -3, k.d); // curly tail
      box("body", 0, 5, -4, 1, 6, -3, k.d);
      box("head", -2, -1, 0, 2, 2, 2, k.a);
      box("head", -1, -1, 2, 1, 1, 3, k.d);
      box("head", -2, 2, 0, -1, 3, 1, k.d);
      box("head", 1, 2, 0, 2, 3, 1, k.d);
      box("head", -1, 1, 1, 0, 2, 2, "black");
      box("head", 1, 1, 1, 2, 2, 2, "black");
      break;
    }
    case "chicken": {
      box("legA", -1, 0, 0, 0, 1, 1, k.c);
      box("legB", 0, 0, 0, 1, 1, 1, k.c);
      box("body", -1, 1, -1, 1, 3, 1, k.a);
      box("body", -1, 2, -2, 1, 4, -1, k.b); // tail
      box("body", -1, 3, -1, 1, 4, 0, k.a);
      box("head", -1, 0, 0, 1, 2, 1, k.a);
      box("head", 0, 2, 0, 1, 3, 1, k.d); // comb
      box("head", 0, 0, 1, 1, 1, 2, "gold"); // beak
      box("head", -1, -1, 0, 0, 0, 1, k.d); // wattle
      break;
    }
    case "horse": {
      for (const [x, z, role] of [[-2, -4, "legA"], [1, 3, "legA"], [1, -4, "legB"], [-2, 3, "legB"]] as const) {
        box(role, x, 1, z, x + 1, 5, z + 1, k.a);
        box(role, x, 0, z, x + 1, 1, z + 1, k.c);
      }
      box("body", -2, 5, -4, 2, 8, 4, k.a);
      box("body", 0, 5, -6, 1, 8, -4, k.b); // tail
      box("body", 0, 4, -6, 1, 5, -5, k.b);
      box("body", -1, 8, -1, 1, 9, 2, "#7a2a20"); // saddle blanket
      box("head", -1, 0, -1, 1, 4, 2, k.a); // neck
      box("head", -1, 2, 2, 1, 4, 5, k.a); // head
      box("head", -1, 2, 5, 1, 3, 6, k.d);
      box("head", 0, 0, -2, 1, 5, -1, k.b); // mane
      box("head", 0, 4, -1, 1, 5, 2, k.b);
      box("head", -1, 4, 2, 0, 5, 3, k.a); // ears
      box("head", 0, 4, 2, 1, 5, 3, k.a);
      box("head", -2, 3, 3, -1, 4, 4, "black");
      box("head", 1, 3, 3, 2, 4, 4, "black");
      break;
    }
    case "goat": {
      for (const [x, z, role] of [[-1, -3, "legA"], [0, 2, "legA"], [0, -3, "legB"], [-1, 2, "legB"]] as const)
        box(role, x, 0, z, x + 1, 3, z + 1, k.c);
      box("body", -1, 3, -3, 1, 5, 3, k.a);
      box("body", -1, 4, -2, 1, 5, 0, k.b);
      box("body", 0, 5, -4, 1, 6, -3, k.a); // tail up
      box("head", -1, -1, 0, 1, 2, 2, k.a);
      box("head", -1, -1, 2, 1, 1, 3, k.d);
      box("head", 0, -2, 1, 1, -1, 2, k.b); // beard
      box("head", -1, 2, -1, 0, 4, 0, "#8a7a6a"); // horns
      box("head", 0, 2, -1, 1, 4, 0, "#8a7a6a");
      box("head", -1, 1, 1, 0, 2, 2, "black");
      break;
    }
    case "duck": {
      box("legA", -1, 0, 0, 0, 1, 1, k.c);
      box("legB", 0, 0, 0, 1, 1, 1, k.c);
      box("body", -1, 1, -2, 1, 3, 1, k.a);
      box("body", -1, 2, -3, 1, 3, -2, k.a);
      box("head", -1, 0, 0, 1, 2, 1, k.b);
      box("head", -1, 0, 1, 1, 1, 2, k.d);
      break;
    }
    case "bee": {
      box("body", 0, 0, -1, 1, 1, 0, k.b);
      box("body", 0, 0, 0, 1, 1, 1, k.a);
      box("body", 0, 0, 1, 1, 1, 2, k.d);
      box("wings", -1, 0, 0, 0, 1, 1, k.c);
      box("wings", 1, 0, 0, 2, 1, 1, k.c);
      break;
    }
  }
}

const modelCache = new Map<string, CritterModel>();
/** Shared geometry per kind + coat (never disposed: a handful of tiny meshes). */
export function critterModel(kind: CritterKind, coat: number): CritterModel {
  const coats = COATS[kind],
    ci = ((coat % coats.length) + coats.length) % coats.length,
    key = kind + ci;
  const cached = modelCache.get(key);
  if (cached) return cached;
  const pivots = PIVOTS[kind],
    parts = new Map<CritterRole, PixelVox>(),
    whole = new PixelVox(7);
  paint(kind, coats[ci], (role, x0, y0, z0, x1, y1, z1, col) => {
    const p = pivots[role] ?? [0, 0, 0];
    let vox = parts.get(role);
    if (!vox) parts.set(role, (vox = new PixelVox(7)));
    vox.box(x0, y0, z0, x1, y1, z1, col);
    whole.box(x0 + p[0], y0 + p[1], z0 + p[2], x1 + p[0], y1 + p[1], z1 + p[2], col);
  });
  const model: CritterModel = {
    parts: [...parts].map(([role, vox]) => {
      const p = pivots[role] ?? [0, 0, 0];
      return {
        role,
        geo: buildVoxelGeometry(vox, CRITTER_UNIT),
        pivot: [p[0] * CRITTER_UNIT, p[1] * CRITTER_UNIT, p[2] * CRITTER_UNIT],
      };
    }),
    whole: buildVoxelGeometry(whole, CRITTER_UNIT),
  };
  modelCache.set(key, model);
  return model;
}

/** Deterministic hash in [0,1). */
export function critterHash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Convert a design pen (voxels) into element-local metres. */
export function buildCritterPens(pens: readonly CritterSpec[], unit: number, groundShift: number, fit: number): BuiltCritterPen[] {
  return pens.map((p) => ({
    kind: p.kind,
    coat: p.coat ?? 0,
    count: Math.max(0, Math.min(40, Math.round(p.count))),
    area: [p.area[0] * unit, p.area[1] * unit, p.area[2] * unit, p.area[3] * unit],
    y: (p.y ?? 1) * unit + groundShift,
    scale: fit,
  }));
}

/** Rest poses for previews (gallery, ghost, field guide): animals spread over their pen, facing various ways. */
export function buildCritterPreview(pens: readonly BuiltCritterPen[]): THREE.Group | undefined {
  if (!pens.length) return undefined;
  const group = new THREE.Group(),
    m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3(),
    p = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  pens.forEach((pen, pi) => {
    if (!pen.count) return;
    const mesh = new THREE.InstancedMesh(critterModel(pen.kind, pen.coat).whole, getPixelVoxelMaterial(), pen.count);
    const [x0, z0, x1, z1] = pen.area,
      margin = 0.3 * pen.scale,
      fly = CRITTER_TUNING[pen.kind].fly;
    for (let i = 0; i < pen.count; i++) {
      const hx = critterHash(pi * 13 + i, 1.7),
        hz = critterHash(pi * 7 + i, 4.3);
      // stratified spread: walk a golden-ratio sequence so herds don't clump
      const u = (i * 0.618034 + hx * 0.35) % 1,
        w = ((i + 0.5) / pen.count + hz * 0.25) % 1;
      p.set(
        x0 + margin + u * Math.max(0, x1 - x0 - 2 * margin),
        pen.y + (fly ? (0.5 + hz) * pen.scale : 0),
        z0 + margin + w * Math.max(0, z1 - z0 - 2 * margin),
      );
      q.setFromAxisAngle(up, critterHash(i, pi + 9) * Math.PI * 2);
      s.setScalar(pen.scale);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.castShadow = true;
    mesh.userData.isCritterPreview = true;
    group.add(mesh);
  });
  return group;
}
