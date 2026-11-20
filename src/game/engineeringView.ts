import { sharesOceanSurface } from "./coastline";
import { GRID_SIZE, GRID_HALF, cellIndex } from "./mapBounds";
import { TILE_SIZE } from "./voxelCore";
import * as THREE from "three";
import {
  DIRECTIONS,
  bridgeGrade,
  conduitHeight,
  editedCell,
  getTerrainCell,
  hydraulics,
  liftProgress,
  LIFT_TRAVEL,
  naturalElevation,
  roadTravelOpen,
  tileKey,
  type InfrastructureTool,
  type WorksPreview,
  type Material,
} from "./terrain";
import type { GameState } from "./simulation";

const earth: Record<Material, number> = {
  grass: 0x81b561,
  sand: 0xe1cb91,
  rock: 0x908781,
  clay: 0xa47b60,
  wetland: 0x6e8d68,
  snow: 0xe2ece8,
};
const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const faces = [
  [0, 3, 2, 1],
  [4, 5, 6, 7],
  [0, 4, 7, 3],
  [1, 2, 6, 5],
  [3, 7, 6, 2],
  [0, 1, 5, 4],
];
class Blocks {
  positions: number[] = [];
  colors: number[] = [];
  face(a: number[], b: number[], c: number[], d: number[], hex: number) {
    const col = new THREE.Color(hex);
    for (const v of [a, b, c, a, c, d]) {
      this.positions.push(...v);
      this.colors.push(col.r, col.g, col.b);
    }
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const v = corners.map(([cx, cy, cz]) => [x + w * cx, y + h * cy, z + d * cz]);
    for (const [a, b, c, e] of faces) this.face(v[a], v[b], v[c], v[e], color);
  }
  mesh(mat: THREE.Material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  }
}
function maskFragment(channel: "r" | "g") {
  return `vec2 worksUV=(vWorksXZ+vec2(${(GRID_HALF * TILE_SIZE).toFixed(1)}))/${(GRID_SIZE * TILE_SIZE).toFixed(1)};
 if(all(greaterThanEqual(worksUV,vec2(0.0)))&&all(lessThan(worksUV,vec2(1.0)))&&texture2D(uWorksMask,worksUV).${channel}>0.5) discard;`;
}
export const maskTerrainFragment = maskFragment("r");
export const maskOceanFragment = maskFragment("g");
export class EngineeringView {
  readonly group = new THREE.Group();
  readonly preview = new THREE.Group();
  readonly mask: THREE.DataTexture;
  private pixels = new Uint8Array(GRID_SIZE * GRID_SIZE * 4);
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.87, side: THREE.DoubleSide });
  private previewMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private stamp = "";
  private moving = new Map<string, THREE.Mesh>();
  private lights = new Map<string, THREE.Mesh>();
  private weights = new Map<string, THREE.Mesh>();
  private streamMarks: THREE.InstancedMesh | null = null;
  private currentPoints: { x: number; y: number; z: number; dx: number; dz: number; phase: number }[] = [];
  constructor(private readonly drawOceanWithWaves = false) {
    this.mask = new THREE.DataTexture(this.pixels, GRID_SIZE, GRID_SIZE);
    this.mask.magFilter = THREE.NearestFilter;
    this.mask.minFilter = THREE.NearestFilter;
    this.mask.needsUpdate = true;
  }
  patchLand(mat: THREE.MeshStandardMaterial) {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uWorksMask = { value: this.mask };
      s.vertexShader =
        "varying vec2 vWorksXZ;\n" +
        s.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWorksXZ=(modelMatrix*vec4(position,1.)).xz;",
        );
      s.fragmentShader =
        "varying vec2 vWorksXZ; uniform sampler2D uWorksMask;\n" +
        s.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\n" + maskTerrainFragment,
        );
    };
  }
  private clear(g: THREE.Group) {
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    g.clear();
  }
  sync(state: GameState) {
    const infra = state.infrastructure;
    const stamp =
      (state.terrainVersion ?? 1) +
      "|" +
      (infra?.stamp ?? infra?.revision ?? 0) +
      "|" +
      Object.keys(infra?.cells ?? {}).length +
      "|" +
      state.elements.map((e) => [e.id, e.gx, e.gz, e.level, e.disrepair, e.onFire].join("/")).join(";") +
      "|" +
      state.weather +
      "|" +
      Number(state.metrics.powerSupply > 0 && state.metrics.powerSupply >= state.metrics.powerDemand) +
      "|" +
      Object.entries(infra?.storage ?? {})
        .map(([id, v]) => id + Number(v > 0))
        .join(",");
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.clear(this.group);
    this.moving.clear();
    this.weights.clear();
    this.currentPoints = [];
    if (this.streamMarks) {
      (this.streamMarks.material as THREE.Material).dispose();
      this.streamMarks.dispose();
    }
    this.streamMarks = null;
    for (const m of this.lights.values()) (m.material as THREE.Material).dispose();
    this.lights.clear();
    this.pixels.fill(0);
    if (!infra) {
      this.mask.needsUpdate = true;
      return;
    }
    const solid = new Blocks();
    const hydro = hydraulics(state);
    for (const [k, cell] of Object.entries(infra.cells)) {
      const [gx, gz] = k.split(",").map(Number),
        x = gx * 4,
        z = gz * 4;
      const maskPixel = cellIndex(gx, gz) * 4;
      const tidal = this.drawOceanWithWaves && sharesOceanSurface(cell);
      this.pixels[maskPixel] = 255; // Edited ground gets its own geometry.
      this.pixels[maskPixel + 1] = tidal ? 0 : 255; // Fresh or dry edits hide the ocean underneath.
      // Each edited cell owns its ground. Untouched coast retains the original island mesh.
      const dry = !cell.depth,
        base = cell.elevation;
      const neighbors = DIRECTIONS.map(([dx, dz]) => getTerrainCell(state, gx + dx, gz + dz));
      const rugged = cell.form === "bank" && (cell.material === "rock" || cell.material === "snow");
      const inset = cell.form === "canal" ? 0.18 : rugged ? 1.48 : 0.65;
      const coords = [0, inset, 4 - inset, 4];
      const heights = Array.from({ length: 4 }, (_, iz) =>
        Array.from({ length: 4 }, (_, ix) => {
          const dx = ix === 0 ? -1 : ix === 3 ? 1 : 0,
            dz = iz === 0 ? -1 : iz === 3 ? 1 : 0;
          if (!dx && !dz) {
            return rugged ? base + 0.26 * Math.sin(gx * 4.31 + gz * 9.75 + ix * 2.33 + iz * 1.8) : base;
          }
          let total = base,
            count = 1;
          for (const [ox, oz] of [
            [dx, 0],
            [0, dz],
            [dx, dz],
          ])
            if (ox || oz) {
              const nb = infra.cells[tileKey(gx + ox, gz + oz)];
              if (!nb) return naturalElevation(x + coords[ix], z + coords[iz], state.terrainVersion);
              total += nb.elevation;
              count++;
            }
          return total / count;
        }),
      );
      for (let rz = 0; rz < 3; rz++)
        for (let rx = 0; rx < 3; rx++) {
          // Match the natural seabed cutoff so a dredged tile cannot tint the waves at its outer edge.
          if (
            tidal &&
            Math.max(heights[rz][rx], heights[rz + 1][rx], heights[rz][rx + 1], heights[rz + 1][rx + 1]) < -2
          )
            continue;
          const vert = (i: number, j: number) => [x + coords[i], heights[j][i], z + coords[j]];
          const rockFace = heights[rz][rx] + heights[rz + 1][rx + 1];
          const rockPalette = [0x918777, 0x978d7a, 0xa39983, 0x8e8c7e];
          const color = rugged
            ? rockFace > 13
              ? (rx + rz) % 3 === 0
                ? 0xcdd4ca
                : 0xe0e2d6
              : rockFace < 3.6
                ? 0x8a9b6e
                : rockPalette[Math.abs(gx * 7 + gz * 3 + rx + rz * 2) % 4]
            : dry || (rx === 1 && rz === 1)
              ? earth[cell.material]
              : 0xc1a378;
          solid.face(vert(rx, rz), vert(rx, rz + 1), vert(rx + 1, rz + 1), vert(rx + 1, rz), color);
        }
      const corners = [
        [x, z],
        [x + 4, z],
        [x + 4, z + 4],
        [x, z + 4],
      ];
      for (let side = 0; side < 4; side++) {
        if (!cell.depth || neighbors[side].depth > 0) continue;
        const [dx, dz] = DIRECTIONS[side],
          a = corners[side],
          b = corners[(side + 1) % 4];
        const local = (along: number, inset: number, y: number) => [
          a[0] + (b[0] - a[0]) * along - dx * inset,
          y,
          a[1] + (b[1] - a[1]) * along - dz * inset,
        ];
        if (cell.form === "canal") {
          for (let n = 0; n < 8; n++) {
            const width = 0.117,
              y = cell.waterLevel,
              shade = n % 3 === 0 ? 0x9c846c : 0xaf967b;
            solid.face(
              local(n / 8, 0.08, y - 0.4),
              local(n / 8 + width, 0.08, y - 0.4),
              local(n / 8 + width, 0.08, y + 0.18),
              local(n / 8, 0.08, y + 0.18),
              shade,
            );
            solid.face(
              local(n / 8, -0.07, y + 0.19),
              local(n / 8 + width, -0.07, y + 0.19),
              local(n / 8 + width, 0.11, y + 0.19),
              local(n / 8, 0.11, y + 0.19),
              0xd7c09d,
            );
          }
          if ((gx + gz + side) % 3 === 0) {
            const [ax, ay, az] = local(0.42, 0, cell.waterLevel + 0.2);
            solid.box(ax - 0.08, ay, az - 0.08, 0.16, 0.28, 0.16, 0x4d5550);
          }
        }
      }
      const naturalWater = cell.depth > 0 && cell.form !== "canal";
      const canyon = cell.form === "canyon";
      if (naturalWater || canyon) {
        // Clip exposed corners inside the owning tile. Shared wet edges stay open from bank to bank.
        const exposed = neighbors.map((n) =>
          canyon ? n.form !== "canyon" && n.elevation > base + 0.1 : n.depth === 0,
        );
        const level = naturalWater ? cell.waterLevel : base + 0.02;
        const center = [x + 2, level, z + 2];
        const waterColor = cell.water === "salt" ? 0x40aebc : 0x56b2c3;
        const boundary: { outer: number[]; edge: number[]; hasBank: boolean }[] = [];
        for (let j = 0; j < 4; j++) {
          const prev = (j + 3) % 4;
          const [vx, vz] = corners[j],
            [pnx, pnz] = DIRECTIONS[prev],
            [nx, nz] = DIRECTIONS[j];
          // The shared vertex supplies the same offset on either side of a tile seam.
          const wave = 0.5 + 0.5 * Math.sin(vx * 0.77 + vz * 0.51),
            lip = 0.14 + 0.16 * wave,
            cut = (canyon ? 0.95 : 0.72) + wave * 0.45;
          const cornerBank = Math.max(level + 0.025, heights[j >= 2 ? 3 : 0][j === 1 || j === 2 ? 3 : 0]);
          const add = (dx: number, dz: number, hasBank = exposed[j]) =>
            boundary.push({ outer: [vx, cornerBank + 0.01, vz], edge: [vx + dx, level, vz + dz], hasBank });
          if (exposed[prev] && exposed[j]) {
            add(-pnx * lip - nx * cut, -pnz * lip - nz * cut);
            add(-pnx * cut - nx * lip, -pnz * cut - nz * lip);
          } else
            add(
              -(exposed[prev] ? pnx * lip : 0) - (exposed[j] ? nx * lip : 0),
              -(exposed[prev] ? pnz * lip : 0) - (exposed[j] ? nz * lip : 0),
            );
          if (exposed[j]) {
            const end = corners[(j + 1) % 4],
              mx = (vx + end[0]) / 2,
              mz = (vz + end[1]) / 2;
            const shift =
              (canyon ? 0.29 : 0.16) + (0.5 + 0.5 * Math.sin(mx * 0.46 + mz * 0.84)) * (canyon ? 0.5 : 0.27);
            boundary.push({
              outer: [mx, Math.max(level + 0.03, neighbors[j].elevation) + 0.008, mz],
              edge: [mx - nx * shift, level, mz - nz * shift],
              hasBank: true,
            });
          }
        }
        const beach = canyon ? [0xab9277, 0xb49e83, 0xa98d72] : [0xc6b57e, 0xcab98f, 0xb6ab7b];
        for (let j = 0; j < boundary.length; j++) {
          const a = boundary[j],
            b = boundary[(j + 1) % boundary.length];
          if (naturalWater && !tidal) solid.face(center, b.edge, a.edge, center, waterColor);
          if (!a.hasBank) continue;
          const band = (v: { outer: number[]; edge: number[] }) =>
            v.outer.map((coord, n) => v.edge[n] + (coord - v.edge[n]) * 0.45);
          const am = band(a),
            bm = band(b);
          solid.face(a.outer, b.outer, bm, am, beach[Math.abs(gx + gz + j) % 3]);
          solid.face(am, bm, b.edge, a.edge, canyon ? 0x9a8271 : 0x9fbea7);
        }
      }
      if (cell.depth) {
        if (!naturalWater && !tidal)
          solid.face(
            [x, cell.waterLevel, z],
            [x, cell.waterLevel, z + 4],
            [x + 4, cell.waterLevel, z + 4],
            [x + 4, cell.waterLevel, z],
            0x369b98,
          );
        if (hydro.channels.has(k) && cell.flowDir !== undefined) {
          const [dx, dz] = DIRECTIONS[cell.flowDir];
          this.currentPoints.push({
            x: x + 2 - dx * 0.9 + dz * 0.34,
            y: cell.waterLevel + 0.035,
            z: z + 2 - dz * 0.9 + dx * 0.34,
            dx,
            dz,
            phase: (gx * 7 + gz * 5) * 0.14,
          });
        }
        const glimmer = cell.water === "salt" ? 0x6bc1c9 : 0x72c0c5;
        for (let n = 0; !tidal && n < 2; n++) {
          const off = ((((gx * 13 + gz * 7 + n * 11) % 13) + 13) % 13) * 0.2;
          solid.box(
            x + 0.35 + off * 0.35,
            cell.waterLevel + 0.015,
            z + 0.5 + n * 1.15 + off * 0.2,
            0.22 + off * 0.22,
            0.015,
            0.07,
            glimmer,
          );
        }
        if (cell.gateKind) {
          const axis = cell.flowDir === 1 || cell.flowDir === 3;
          for (const offset of [-1, 1]) {
            solid.box(
              x + (axis ? 0.85 : 2 + offset * 1.6),
              cell.waterLevel - 0.3,
              z + (axis ? 2 + offset * 1.6 : 0.85),
              axis ? 2.3 : 0.4,
              1.3,
              axis ? 0.4 : 2.3,
              0x807b69,
            );
          }
          if (cell.gateKind === "dam") {
            const [dx, dz] = DIRECTIONS[cell.flowDir ?? 2];
            const upstream = getTerrainCell(state, gx - dx, gz - dz);
            const h = Math.max(0.8, cell.gateHead ?? 1),
              crest = cell.waterLevel + h + 0.24;
            const along = (a: number, y: number, b: number, len: number, high: number, w: number, col: number) =>
              solid.box(x + 2 + (axis ? a : b), y, z + 2 + (axis ? b : a), axis ? len : w, high, axis ? w : len, col);
            // A concrete intake, a transverse service gantry and a gate on each bank.
            for (const side of [-1, 1]) {
              const b = side * 1.48;
              along(-0.58, cell.elevation, b - 0.34, 1.16, crest - cell.elevation + 0.06, 0.68, 0x918e7e);
              along(-0.68, crest, b - 0.43, 1.36, 0.24, 0.86, 0xaaa38f);
              along(-0.24, crest + 0.22, b - 0.17, 0.49, 0.45, 0.34, 0x637879);
            }
            along(-0.22, crest, -1.94, 0.44, 0.22, 3.88, 0x8b7960);
            for (const b of [-1.75, -1, -0.22, 0.55, 1.35, 1.8])
              along(-0.18, crest + 0.22, b, 0.065, 0.35, 0.065, 0x596461);
            along(-0.18, crest + 0.54, -1.8, 0.07, 0.07, 3.64, 0x697772);
            if (cell.gate === "closed") {
              along(-0.16, cell.elevation, -1.2, 0.32, Math.max(0.3, crest - cell.elevation - 0.28), 2.4, 0x657b7a);
              for (let y = cell.elevation + 0.32; y < crest - 0.4; y += 0.45)
                along(-0.22, y, -1.2, 0.44, 0.07, 2.4, 0xaab4a3);
              if (upstream.waterLevel > cell.waterLevel + 0.25) {
                const sign = dx || dz;
                for (const off of [-0.77, 0.59]) {
                  for (let j = 0; j < 5; j++)
                    along(
                      sign * (0.23 + j * 0.1),
                      cell.waterLevel + 0.03 + (4 - j) * 0.13,
                      off,
                      0.23,
                      0.2,
                      0.33,
                      j % 2 ? 0x8ed2cc : 0xb7e6da,
                    );
                }
              }
            }
          } else if (cell.gate === "closed") {
            solid.box(
              x + (axis ? 1.9 : 0.2),
              cell.waterLevel - 0.45,
              z + (axis ? 0.2 : 1.9),
              axis ? 0.25 : 3.6,
              0.95,
              axis ? 3.6 : 0.25,
              0x704e35,
            );
          } else
            for (const off of [0.35, 3.25])
              solid.box(
                x + (axis ? 1 : off),
                cell.waterLevel - 0.25,
                z + (axis ? off : 1),
                axis ? 1.9 : 0.22,
                0.7,
                axis ? 0.22 : 1.9,
                0x947444,
              );
        }
      }
    }
    this.mask.needsUpdate = true;
    for (const [k, duct] of Object.entries(infra.conduits)) {
      const [gx, gz] = k.split(",").map(Number),
        cx = gx * 4 + 2,
        cz = gz * 4 + 2,
        h = duct.height,
        r = hydro.runs.get(k)!,
        ground = getTerrainCell(state, gx, gz);
      const stone = [0xd9c292, 0x8a8a8d, 0xbb966e, 0x8e9278][duct.style % 4],
        trim = [0xb19a77, 0x626670, 0x9e5a4d, 0x647361][duct.style % 4];
      const pts = DIRECTIONS.map(([dx, dz]) => infra.conduits[tileKey(gx + dx, gz + dz)]);
      const lower = ground.elevation;
      // Each connected arm supplies half an arcade, so each shared pier supports two arches.
      for (let side = 0; side < 4; side++)
        if (pts[side]) {
          const [dx, dz] = DIRECTIONS[side],
            ex = cx + dx * 1.82,
            ez = cz + dz * 1.82;
          solid.box(ex - 0.27, lower, ez - 0.27, 0.54, Math.max(0.1, h - lower - 0.38), 0.54, stone);
          solid.box(ex - 0.36, lower, ez - 0.36, 0.72, 0.22, 0.72, trim);
          const archRise = Math.min(1.9, Math.max(0.4, h - lower - 0.65));
          for (let step = 0; step < 6; step++) {
            const dist = ((step + 0.5) * 2) / 6,
              arch = (1 - Math.sqrt(Math.max(0, 1 - (dist / 2) ** 2))) * archRise + 0.2;
            const ax = cx + dx * dist,
              az = cz + dz * dist;
            solid.box(
              ax - (dx ? 0.18 : 0.38),
              h - 0.21 - arch,
              az - (dz ? 0.18 : 0.38),
              dx ? 0.36 : 0.76,
              arch,
              dz ? 0.36 : 0.76,
              duct.style === 2 && step % 2 === 0 ? 0xe7c39d : stone,
            );
            for (const rim of [-0.41, 0.31])
              solid.box(
                ax + (dx ? -0.18 : rim),
                h - 0.28 - arch,
                az + (dz ? -0.18 : rim),
                dx ? 0.36 : 0.1,
                0.13,
                dz ? 0.36 : 0.1,
                duct.style === 2 && step % 2 === 1 ? 0xac5946 : trim,
              );
          }
        }
      if (pts.filter(Boolean).length < 2)
        solid.box(cx - 0.3, lower, cz - 0.3, 0.6, Math.max(0.12, h - lower - 0.24), 0.6, stone);
      solid.box(cx - 0.53, h - 0.3, cz - 0.53, 1.06, 0.3, 1.06, trim);
      solid.box(cx - 0.42, h, cz - 0.42, 0.84, 0.08, 0.84, r.flow ? 0x5abee0 : stone);
      for (let side = 0; side < 4; side++) {
        const adj = pts[side];
        if (!adj) continue;
        const [dx, dz] = DIRECTIONS[side],
          tall = (adj.height - h) / 2;
        for (let part = 0; part < 4; part++) {
          const y = h + (tall * (part + 0.5)) / 4,
            m = 0.25 + part * 0.5,
            x = cx + dx * m,
            z = cz + dz * m;
          solid.box(
            x - (dx ? 0.26 : 0.54),
            y - 0.28,
            z - (dz ? 0.26 : 0.54),
            dx ? 0.52 : 1.08,
            0.28,
            dz ? 0.52 : 1.08,
            stone,
          );
          for (const edge of [-0.52, 0.36])
            solid.box(
              x + (dx ? -0.26 : edge),
              y,
              z + (dz ? -0.26 : edge),
              dx ? 0.52 : 0.16,
              0.26,
              dz ? 0.52 : 0.16,
              trim,
            );
          if (r.flow)
            solid.box(
              x - (dx ? 0.26 : 0.36),
              y + 0.015,
              z - (dz ? 0.26 : 0.36),
              dx ? 0.52 : 0.72,
              0.06,
              dz ? 0.52 : 0.72,
              (part + gx + gz) % 4 ? 0x54b6c8 : 0x9ee1df,
            );
        }
      }
      for (let side = 0; side < 4; side++) {
        const [dx, dz] = DIRECTIONS[side],
          neighbor = hydro.runs.get(tileKey(gx + dx, gz + dz));
        if (r.flow && neighbor?.upstream === (side + 2) % 4) {
          this.currentPoints.push({ x: cx, y: h + 0.09, z: cz, dx, dz, phase: (gx * 3 + gz * 5) * 0.21 });
        }
        const feed = r.inlet === side,
          delivery = Boolean(((r.deliveries ?? 0) | (r.waterOutlets ?? 0)) & (1 << side));
        if (!feed && !delivery) continue;
        // Intake and drop pipe reach the receiving edge so water visibly enters the actual site.
        const sample = getTerrainCell(state, gx + dx, gz + dz),
          bottom = (sample.depth ? sample.waterLevel : sample.elevation) + 0.06;
        const reach = feed || (r.waterOutlets ?? 0) & (1 << side) ? 2.55 : 2.1,
          tx = cx + dx * reach,
          tz = cz + dz * reach;
        const metal = feed ? 0x587878 : 0x9d7958;
        solid.box(
          Math.min(cx, tx) - 0.15,
          h - 0.13,
          Math.min(cz, tz) - 0.15,
          Math.abs(tx - cx) + 0.3,
          0.25,
          Math.abs(tz - cz) + 0.3,
          metal,
        );
        solid.box(tx - 0.16, Math.min(bottom, h), tz - 0.16, 0.32, Math.max(0.25, Math.abs(h - bottom)), 0.32, metal);
        if (feed && sample.form === "bank" && sample.elevation > 2.8) {
          solid.box(tx - 0.48, bottom - 0.12, tz - 0.48, 0.96, 0.2, 0.96, 0x958675);
          solid.box(tx - 0.31, bottom + 0.08, tz - 0.31, 0.62, 0.09, 0.62, 0x74c7cd);
        }
        solid.box(tx - 0.23, bottom, tz - 0.23, 0.46, 0.25, 0.46, feed ? 0x637b74 : 0xaf9a72);
        for (let d = 0.7; d < reach; d += 0.66)
          solid.box(cx + dx * d - 0.19, h - 0.17, cz + dz * d - 0.19, 0.38, 0.32, 0.38, 0xd5af79);
        if (delivery) {
          solid.box(tx - 0.4, bottom - 0.055, tz - 0.4, 0.8, 0.08, 0.8, 0x83c6ca);
          solid.box(tx - 0.18, bottom + 0.015, tz - 0.18, 0.36, 0.13, 0.36, 0x9cd6d1);
        }
      }
      if (r.spill) {
        let edge = ["north", "east", "south", "west"].indexOf(duct.outlet);
        if (edge < 0) edge = pts.findIndex((p) => !p);
        if (edge < 0) edge = 0;
        const [dx, dz] = DIRECTIONS[edge],
          x = cx + dx * 0.77,
          z = cz + dz * 0.77,
          bottom = ground.depth ? ground.waterLevel : ground.elevation;
        solid.box(
          Math.min(cx, x) - 0.12,
          h - 0.1,
          Math.min(cz, z) - 0.12,
          Math.abs(cx - x) + 0.25,
          0.18,
          Math.abs(cz - z) + 0.25,
          0x75c9d7,
        );
        solid.box(x - 0.14, bottom, z - 0.14, 0.28, Math.max(0.1, h - bottom), 0.28, 0x86d5df);
        solid.box(x - 0.4, bottom + 0.02, z - 0.4, 0.8, 0.08, 0.8, 0xc3e9e4);
      }
    }
    const runs = new Map<string, [number, number]>();
    for (const [k, s] of Object.entries(infra.spans)) {
      if (s.end) continue;
      const [x, z] = k.split(",").map(Number),
        n = s.axis === "x" ? x : z,
        range = runs.get(s.run) ?? [n, n];
      runs.set(s.run, [Math.min(n, range[0]), Math.max(n, range[1])]);
    }
    for (const [k, s] of Object.entries(infra.spans)) {
      if (s.run.startsWith("junction-")) continue;
      const [gx, gz] = k.split(",").map(Number),
        cx = gx * 4 + 2,
        cz = gz * 4 + 2;
      const g = s.shape === "lift" && !s.end ? new Blocks() : solid;
      const counter = new Blocks();
      const along = (
        target: Blocks,
        a: number,
        y: number,
        b: number,
        len: number,
        height: number,
        width: number,
        color: number,
      ) =>
        target.box(
          cx + (s.axis === "x" ? a : b),
          y,
          cz + (s.axis === "x" ? b : a),
          s.axis === "x" ? len : width,
          height,
          s.axis === "x" ? width : len,
          color,
        );
      const width =
        s.mode === "foot"
          ? 1.95
          : s.mode === "rail"
            ? 2.45
            : s.mode === "freeway"
              ? 3.9
              : s.mode === "highway"
                ? 3.5
                : 2.8;
      const [lo, hi] = runs.get(s.run) ?? [0, 0],
        coordinate = s.axis === "x" ? gx : gz;
      const bridgeColor = s.shape === "arch" ? 0xae9679 : s.shape === "truss" ? 0x974f37 : 0x587d83;
      const center = (hi + lo + 1) * 2,
        length = Math.max(4, (hi - lo + 1) * 4);
      for (let n = 0; n < 8; n++) {
        const t = s.direction < 0 ? 1 - (n + 0.5) / 8 : (n + 0.5) / 8,
          y = s.startHeight + (s.endHeight - s.startHeight) * t;
        along(
          g,
          -2 + n * 0.5,
          y - 0.24,
          -width / 2,
          0.51,
          0.24,
          width,
          s.mode === "foot" ? (n % 3 === 0 ? 0xc4aa86 : 0xd0bb99) : 0x535c61,
        );
        if (s.shape === "lift" && !s.end) {
          for (const side of [-1, 1]) {
            const b = side * (width / 2 + 0.01);
            along(g, -2 + n * 0.5, y - 0.42, b - 0.09, 0.51, 0.28, 0.18, 0x37575c);
            along(g, -2 + n * 0.5, y + 0.72, b - 0.07, 0.51, 0.15, 0.14, 0x3c6668);
            const diag = y + 0.18 + Math.min(n % 4, 4 - (n % 4)) * 0.26;
            along(g, -2 + n * 0.5, diag, b - 0.06, 0.51, 0.14, 0.12, 0x669296);
            if (n % 4 === 0) {
              along(g, -2 + n * 0.5, y + 0.02, b - 0.09, 0.11, 0.81, 0.18, 0x3b6568);
              along(g, -2 + n * 0.5, y + 0.5, b - 0.105, 0.13, 0.095, 0.21, 0xb6b099);
            }
          }
          if (n === 0) along(g, -2, y + 0.012, -width / 2, 0.08, 0.025, width, 0x384b4f);
        }
        if (s.mode === "rail") {
          along(g, -2 + n * 0.5, y + 0.01, -0.62, 0.51, 0.08, 0.1, 0xaeb8bb);
          along(g, -2 + n * 0.5, y + 0.01, 0.52, 0.51, 0.08, 0.1, 0xaeb8bb);
        } else if (s.mode !== "foot" && n % 4 < 2) along(g, -2 + n * 0.5, y + 0.01, -0.045, 0.5, 0.025, 0.09, 0xe6cb74);
        if ((s.mode === "highway" || s.mode === "freeway") && n % 4 < 2) {
          for (const side of [-1, 1])
            for (let lane = 1; lane < (s.mode === "freeway" ? 3 : 2); lane++)
              along(
                g,
                -2 + n * 0.5,
                y + 0.015,
                (side * width * 0.5 * lane) / (s.mode === "freeway" ? 3 : 2),
                0.5,
                0.025,
                0.045,
                0xe9e3d1,
              );
        }
        for (const edge of [-1, 1]) {
          const z = edge * (width / 2 - 0.08);
          along(g, -2 + n * 0.5, y + 0.24, z, 0.51, 0.08, 0.1, s.shape === "arch" ? 0xd2c5a8 : 0x8caaa9);
          if (n % 3 === 0) along(g, -2 + n * 0.5, y, z, 0.1, 0.28, 0.1, 0x758686);
          if (s.shape === "arch" && !s.end) {
            const world = (coordinate + 0.5) * 4 - 2 + (n + 0.5) * 0.5,
              ratio = Math.min(1, Math.abs((world - center) / (length / 2)));
            const haunch =
              0.27 + (s.deck - getTerrainCell(state, gx, gz).waterLevel - 0.4) * (1 - Math.sqrt(1 - ratio * ratio));
            along(
              g,
              -2 + n * 0.5,
              y - haunch - 0.16,
              z - 0.1,
              0.51,
              Math.max(0.2, haunch),
              0.25,
              n % 4 === 0 ? 0xbca484 : bridgeColor,
            );
            along(g, -2 + n * 0.5, y - haunch - 0.2, z - 0.12, 0.51, 0.15, 0.3, n % 2 === 0 ? 0xe0ccaa : 0xc8ae87);
            along(g, -2 + n * 0.5, y, z - 0.13, 0.51, 0.2, 0.32, 0xb89e7b);
            along(g, -2 + n * 0.5, y + 0.2, z - 0.17, 0.51, 0.08, 0.4, 0xd9c6a5);
          }
          if (s.shape === "truss" && !s.end) {
            along(g, -2 + n * 0.5, y + 0.35 + Math.min(n % 8, 8 - (n % 8)) * 0.26, z, 0.51, 0.2, 0.18, bridgeColor);
            along(g, -2 + n * 0.5, y + 1.46, z, 0.51, 0.18, 0.2, bridgeColor);
            if (n === 0 || n === 4) along(g, -2 + n * 0.5, y + 0.24, z, 0.16, 1.3, 0.19, 0xb6734d);
          }
        }
      }
      const bed = getTerrainCell(state, gx, gz).elevation;
      if (!s.end) {
        for (const edge of [-1, 1]) {
          const b = edge * (width / 2 - 0.14);
          const towerTile = coordinate === lo || coordinate === hi;
          if ((s.shape === "arch" || s.shape === "truss") && towerTile) {
            const alongEdge = coordinate === lo ? -1.95 : 1.55;
            along(solid, alongEdge, bed - 0.1, b - 0.18, 0.46, Math.max(0.15, s.deck - bed - 0.12), 0.46, bridgeColor);
            along(solid, alongEdge - 0.1, bed - 0.04, b - 0.25, 0.7, 0.24, 0.63, 0x8d8270);
          }
          if (s.shape === "lift" || s.shape === "suspension") {
            const top = s.deck + (s.shape === "lift" ? 5.7 : 3.25);
            if (towerTile && s.shape === "suspension") {
              along(solid, 0, bed, b - 0.14, 0.34, Math.max(0.25, top - bed), 0.34, bridgeColor);
              along(solid, -0.18, top, b - 0.24, 0.64, 0.27, 0.54, 0xb0bba8);
            }
            const portals = lo === hi ? [-1.25, 1.25] : [coordinate === lo ? -1.25 : 1.25];
            if (towerTile && s.shape === "lift")
              for (const center of portals) {
                const outer = edge * (width / 2 + 0.35),
                  height = top - s.deck;
                // Two portal frames, with diagonal webbing and moving cast counterweights.
                for (const delta of [-0.48, 0.34]) {
                  along(solid, center + delta - 0.16, bed - 0.35, outer - 0.28, 0.55, 0.95, 0.56, 0x978e73);
                  along(solid, center + delta, bed + 0.45, outer - 0.13, 0.21, top - bed - 0.3, 0.26, 0x3c676b);
                  for (let h = 0.5; h < height; h += 1.1)
                    along(solid, center + delta - 0.035, s.deck + h, outer - 0.17, 0.28, 0.11, 0.34, 0x89a7a0);
                }
                for (let h = 0; h < height - 0.65; h += 1.35)
                  for (let n = 0; n < 5; n++) {
                    const f = n / 4,
                      offset = (Math.floor(h / 1.35) % 2 === 0 ? f : 1 - f) * 0.77;
                    along(solid, center - 0.35 + offset, s.deck + h + f * 1.08, outer - 0.1, 0.24, 0.32, 0.2, 0x629294);
                  }
                along(solid, center - 0.64, top - 0.23, outer - 0.34, 1.42, 0.38, 0.67, 0x34565b);
                for (const delta of [-0.22, 0.22]) {
                  along(solid, center + delta, s.deck + 0.15, outer - 0.04, 0.045, height - 0.15, 0.07, 0x474c47);
                  along(solid, center + delta, top - 0.03, outer - 0.4, 0.055, 0.55, 0.71, 0x888579);
                }
                along(counter, center - 0.27, top - 0.99, outer - 0.28, 0.7, 0.76, 0.56, 0xc59754);
                for (let n = 0; n < 3; n++)
                  along(counter, center - 0.28, top - 0.89 + n * 0.22, outer - 0.3, 0.72, 0.07, 0.6, 0x886d49);
                for (const offset of [-0.28, 0.33]) {
                  for (let k = 0; k < 8; k++) {
                    const a = (k * Math.PI) / 4;
                    along(
                      solid,
                      center + offset + 0.24 * Math.cos(a) - 0.07,
                      top + 0.15 + 0.24 * Math.sin(a),
                      outer - 0.11,
                      0.16,
                      0.15,
                      0.21,
                      0xd1a55e,
                    );
                  }
                }
                if (edge === 1) {
                  // Enclosed winding house across the top of each portal.
                  const z = -width / 2 - 0.6;
                  along(solid, center - 0.61, top + 0.26, z, 1.3, 0.25, width + 1.2, 0x344f51);
                  along(solid, center - 0.45, top + 0.51, z + 0.2, 1.0, 0.54, width + 0.8, 0x60817e);
                  for (let k = 0; k < 8; k++)
                    along(
                      solid,
                      center - 0.46,
                      top + 0.67,
                      z + 0.32 + (k * (width + 0.42)) / 8,
                      0.075,
                      0.24,
                      0.2,
                      k % 3 === 0 ? 0x749da4 : 0xb9d0bb,
                    );
                  for (let n = 0; n < 3; n++)
                    along(
                      solid,
                      center - 0.67 + 0.16 * n,
                      top + 1.02 + n * 0.13,
                      z - 0.04,
                      1.4 - 0.32 * n,
                      0.14,
                      width + 1.28,
                      n === 0 ? 0x795745 : 0xa36344,
                    );
                  along(solid, center - 0.04, top + 1.41, z - 0.04, 0.16, 0.12, width + 1.28, 0xbc7953);
                  if (coordinate === lo && center < 0) {
                    // Gate tender's projecting cabin and stair-side beacon.
                    along(solid, center - 0.48, s.deck + 0.1, outer + 0.24, 1.0, 0.3, 0.93, 0x516568);
                    along(solid, center - 0.39, s.deck + 0.4, outer + 0.33, 0.84, 1.04, 0.74, 0xcabb91);
                    along(solid, center - 0.4, s.deck + 0.78, outer + 0.32, 0.86, 0.4, 0.77, 0x81a6a7);
                    along(solid, center - 0.51, s.deck + 1.4, outer + 0.17, 1.13, 0.2, 1.02, 0x995f44);
                  }
                }
                along(
                  solid,
                  center + 0.39,
                  s.deck + 1.15,
                  outer - 0.19,
                  0.2,
                  0.26,
                  0.38,
                  edge < 0 ? 0x8bd08a : 0xd67a65,
                );
              }
            if (s.shape === "suspension")
              for (let q = 0; q < 8; q++) {
                const world = coordinate * 4 + q * 0.5 + 0.25,
                  dist = Math.min(1, Math.abs(world - center) / (length / 2));
                const cable = s.deck + 0.85 + 2.4 * dist * dist;
                along(solid, -2 + q * 0.5, cable, b, 0.51, 0.11, 0.11, 0x577475);
                if (q % 3 === 0) along(solid, -2 + q * 0.5, s.deck + 0.12, b, 0.06, cable - s.deck, 0.08, 0x839798);
              }
          }
        }
      }
      if (counter.positions.length) {
        const mesh = counter.mesh(this.material);
        this.weights.set(k, mesh);
        this.group.add(mesh);
      }
      if (g !== solid) {
        const mesh = g.mesh(this.material);
        this.group.add(mesh);
        this.moving.set(k, mesh);
      }
    }
    for (const [k, control] of Object.entries(infra.streets)) {
      const [gx, gz] = k.split(",").map(Number),
        x = gx * 4,
        z = gz * 4,
        y = getTerrainCell(state, gx, gz).elevation + 0.045;
      const hway = Boolean(infra.spans[k]);
      const yRoad = hway ? infra.spans[k].deck + 0.04 : y;
      const road = state.elements.find((e) => e.gx === gx && e.gz === gz);
      if (!road) continue;
      const alongX =
        control.axis !== undefined
          ? control.axis === "x"
          : state.elements.some((e) => e.gz === gz && Math.abs(e.gx - gx) === 1 && ELEMENT_ROAD(e.defId));
      if (control.lanes > 2)
        for (let n = 1; n < control.lanes; n++) {
          const normal = 0.25 + (3.5 * n) / control.lanes;
          for (const a of [0.4, 2.65]) {
            const side = a < 2 ? -1 : 1,
              other = infra.streets[tileKey(gx + (alongX ? side : 0), gz + (alongX ? 0 : side))];
            const neighbor = state.elements.find(
              (e) => e.gx === gx + (alongX ? side : 0) && e.gz === gz + (alongX ? 0 : side),
            );
            const lanes = other?.lanes ?? (neighbor?.defId === "freeways" ? 6 : neighbor?.defId === "highways" ? 4 : 2);
            const merge =
              lanes < control.lanes ? 0.25 + (3.5 * Math.round((n * lanes) / control.lanes)) / lanes : normal;
            const offset = (u: number) => normal + (merge - normal) * Math.abs(u - 2) * 0.5;
            const vertex = (u: number, edge: number) => [
              x + (alongX ? u : offset(u) + edge),
              yRoad + 0.04,
              z + (alongX ? offset(u) + edge : u),
            ];
            solid.face(
              vertex(a, -0.034),
              vertex(a, 0.034),
              vertex(a + 0.72, 0.034),
              vertex(a + 0.72, -0.034),
              0xf0e6c2,
            );
          }
        }
      if (control.signal === "yield") continue;
      for (const off of [0.35, 3.5]) {
        solid.box(x + off, yRoad, z + 0.3, 0.1, 1.3, 0.1, 0x374a50);
        solid.box(x + off - 0.1, yRoad + 1, z + 0.2, 0.3, 0.42, 0.24, 0x26343b);
      }
      const lamp = new Blocks();
      lamp.box(x + 0.27, yRoad + 1.15, z + 0.45, 0.19, 0.18, 0.05, 0xffffff);
      const mesh = lamp.mesh(new THREE.MeshBasicMaterial({ color: 0x47db76 }));
      this.lights.set(k, mesh);
      this.group.add(mesh);
    }
    if (this.currentPoints.length) {
      const geometry = new THREE.BoxGeometry(0.26, 0.032, 0.1);
      const color = new THREE.MeshBasicMaterial({ color: 0xafe2e4 });
      this.streamMarks = new THREE.InstancedMesh(geometry, color, this.currentPoints.length);
      this.streamMarks.frustumCulled = false;
      this.group.add(this.streamMarks);
    }
    if (solid.positions.length) this.group.add(solid.mesh(this.material));
  }
  animate(state: GameState) {
    for (const [k, m] of this.weights) {
      const s = state.infrastructure?.spans[k];
      if (s) m.position.y = -liftProgress(state, s) * 4.5;
    }
    if (this.streamMarks) {
      const m = new THREE.Matrix4();
      this.currentPoints.forEach((p, j) => {
        const slide = ((((state.activePlaySec * 0.6 + p.phase) % 1) + 1) % 1) * 1.8;
        m.makeTranslation(p.x + p.dx * slide, p.y, p.z + p.dz * slide);
        this.streamMarks!.setMatrixAt(j, m);
      });
      this.streamMarks.instanceMatrix.needsUpdate = true;
    }
    for (const [k, m] of this.moving) {
      const s = state.infrastructure?.spans[k];
      if (s) m.position.y = liftProgress(state, s) * LIFT_TRAVEL;
    }
    for (const [k, m] of this.lights) {
      const [x, z] = k.split(",").map(Number);
      (m.material as THREE.MeshBasicMaterial).color.setHex(roadTravelOpen(state, x, z, 0, 1) ? 0x57e784 : 0xff5242);
    }
  }
  showPreview(state: GameState, plan: WorksPreview | null, tool?: InfrastructureTool) {
    this.clear(this.preview);
    if (!plan) return;
    const blocks = new Blocks();
    const col = plan.valid ? 0xf6ce70 : 0xf07962;
    const ports = new Set(plan.points.map((p) => tileKey(p.gx, p.gz)));
    const first = plan.points[0],
      last = plan.points.at(-1);
    const grade =
      tool?.kind === "bridge" && first && last ? bridgeGrade(state, plan.points, tool.height ?? 2) : undefined;
    for (const [n, p] of plan.points.entries()) {
      const c = getTerrainCell(state, p.gx, p.gz),
        x = p.gx * 4,
        z = p.gz * 4;
      const y = (c.depth ? c.waterLevel : c.elevation) + 0.06;
      blocks.box(x + 0.08, y, z + 0.08, 3.84, 0.035, 3.84, col);
      if (tool?.kind === "aqueduct") {
        const h = conduitHeight(state, p, tool);
        blocks.box(x + 1.61, h, z + 1.61, 0.78, 0.09, 0.78, col);
        for (const [dx, dz] of DIRECTIONS) {
          const k = tileKey(p.gx + dx, p.gz + dz);
          if (!ports.has(k) && !state.infrastructure?.conduits[k]) continue;
          blocks.box(
            x + 2 + (dx < 0 ? -2 : dx > 0 ? 0 : -0.39),
            h,
            z + 2 + (dz < 0 ? -2 : dz > 0 ? 0 : -0.39),
            dx ? 2 : 0.78,
            0.09,
            dz ? 2 : 0.78,
            col,
          );
        }
      } else if (grade && first && last) {
        const horizontal = first.gz === last.gz,
          forward = horizontal ? last.gx >= first.gx : last.gz >= first.gz;
        const start = grade.heightAt(forward ? n : n + 1) + 0.1,
          end = grade.heightAt(forward ? n + 1 : n) + 0.1;
        const width =
          tool?.mode === "foot"
            ? 1.95
            : tool?.mode === "rail"
              ? 2.45
              : tool?.mode === "highway"
                ? 3.5
                : tool?.mode === "freeway"
                  ? 3.9
                  : 2.8;
        const a = 2 - width / 2,
          b = 2 + width / 2;
        if (horizontal)
          blocks.face([x, start, z + a], [x + 4, end, z + a], [x + 4, end, z + b], [x, start, z + b], col);
        else blocks.face([x + a, start, z], [x + b, start, z], [x + b, end, z + 4], [x + a, end, z + 4], col);
      } else if (tool && ["raise", "mountain", "peninsula", "lower", "canyon", "smooth"].includes(tool.kind)) {
        const next = editedCell(state, p, tool);
        const h = next.elevation + 0.12;
        if (Math.abs(h - y) > 0.14) {
          blocks.box(x + 0.2, h, z + 0.2, 3.6, 0.055, 3.6, col);
          for (const [dx, dz] of [
            [0.22, 0.22],
            [3.72, 3.72],
          ])
            blocks.box(x + dx, Math.min(y, h), z + dz, 0.075, Math.abs(h - y), 0.075, col);
        }
      }
    }
    this.preview.add(blocks.mesh(this.previewMat));
  }
  dispose() {
    if (this.streamMarks) {
      (this.streamMarks.material as THREE.Material).dispose();
      this.streamMarks.dispose();
    }
    for (const m of this.lights.values()) (m.material as THREE.Material).dispose();
    this.clear(this.group);
    this.clear(this.preview);
    this.material.dispose();
    this.previewMat.dispose();
    this.mask.dispose();
  }
}
const ELEMENT_ROAD = (id: string) => /road|highway|freeway|bridge|pass/.test(id);
