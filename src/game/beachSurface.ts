import * as THREE from "three";
import { GRID_SIZE } from "./mapBounds";
import type { GameState } from "./simulation";
import { SEA, islandMargin } from "./terrain";
import { VOXEL_PITCH, VOXELS_PER_TILE, sampleVoxelColumn } from "./voxelTerrain";

const dry = new THREE.Color(0xecd5a3), damp = new THREE.Color(0xd3b682);
const wet = new THREE.Color(0xba9f76), submerged = new THREE.Color(0xb7a582);
const stride = GRID_SIZE * VOXELS_PER_TILE + 1;

/** One indexed sand surface spanning the placed parcels. The solid simulation still
 * samples the same quarter-metre columns. Adjacent faces share their actual vertices. */
export class BeachSurface {
  private corners = new Map<number, number>();
  private positions: number[] = [];
  private colors: number[] = [];
  private indices: number[] = [];
  private tint = new THREE.Color();

  constructor(private state: GameState) {}

  private corner(vx: number, vz: number) {
    const key = vz * stride + vx;
    const cached = this.corners.get(key);
    if (cached !== undefined) return cached;
    let sum = 0, count = 0, edge = 0, edges = 0;
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const s = sampleVoxelColumn(this.state, vx + dx, vz + dz);
      if (s.beach) { sum += s.elevation; count++; }
      else { edge += s.elevation; edges++; }
    }
    const surface = sum / count;
    // Meet the neighboring natural terrace exactly. Retain the cut at an engineered bank.
    const y = edges && Math.abs(edge / edges - surface) < 0.28 ? edge / edges : surface;
    const x = vx * VOXEL_PITCH, z = vz * VOXEL_PITCH;
    const index = this.positions.length / 3;
    this.positions.push(x, y, z);
    const tide = y - SEA + 0.027 * Math.sin(x * 0.53 + z * 0.27);
    this.tint.copy(submerged).lerp(wet, THREE.MathUtils.smoothstep(tide, -0.25, 0.04))
      .lerp(damp, THREE.MathUtils.smoothstep(tide, 0.05, 0.27))
      .lerp(dry, THREE.MathUtils.smoothstep(tide, 0.22, 0.50));
    const mottling = 0.985 + 0.014 * Math.sin(x * 1.07 + Math.sin(z * 0.71)) * Math.cos(z * 0.83);
    this.colors.push(this.tint.r * mottling, this.tint.g * mottling, this.tint.b * mottling);
    this.corners.set(key, index);
    return index;
  }

  private skirt(a: number, b: number, vx: number, vz: number) {
    const beside = sampleVoxelColumn(this.state, vx, vz);
    if (beside.beach) return;
    const y = beside.elevation;
    if (this.positions[a * 3 + 1] <= y + 0.005 && this.positions[b * 3 + 1] <= y + 0.005) return;
    const first = this.positions.length / 3;
    for (const [index, floor] of [[a, false], [a, true], [b, true], [b, false]] as const) {
      this.positions.push(this.positions[index * 3], floor ? y : this.positions[index * 3 + 1], this.positions[index * 3 + 2]);
      this.colors.push(this.colors[index * 3], this.colors[index * 3 + 1], this.colors[index * 3 + 2]);
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  private accent(vx: number, vz: number, y: number) {
    // Sparse fixed world-space accents. They neither repeat at plot edges nor move on reload.
    const hash = Math.imul(vx >> 3, 73856093) ^ Math.imul(vz >> 3, 19349663);
    if ((vx & 7) !== (hash & 7) || (vz & 7) !== ((hash >>> 5) & 7)) return;
    const x = (vx + 0.5) * VOXEL_PITCH, z = (vz + 0.5) * VOXEL_PITCH;
    const rotation = (hash >>> 8) * 0.0031;
    const vertex = (dx: number, dy: number, dz: number, color: number) => {
      const i = this.positions.length / 3;
      this.positions.push(x + dx, y + dy, z + dz);
      this.tint.setHex(color);
      this.colors.push(this.tint.r, this.tint.g, this.tint.b);
      return i;
    };
    if (y > SEA + 0.12 && y < SEA + 0.32 && (hash & 256)) {
      const cap = vertex(0, 0.026, 0, 0xf1dfb7), r = 0.06 + ((hash >>> 15) & 3) * 0.012;
      for (let n = 0; n < 5; n++) {
        const a = rotation - n * 2 * Math.PI / 5;
        vertex(r * Math.cos(a), 0.006, r * 0.7 * Math.sin(a), n % 2 ? 0xdac198 : 0xe6d6b2);
      }
      for (let n = 0; n < 5; n++) this.indices.push(cap, cap + 1 + n, cap + 1 + (n + 1) % 5);
    } else if (y > -0.1 && (hash & 1024) && islandMargin(x, z, this.state.terrainVersion) > 1.0) {
      const gx = Math.floor(vx / VOXELS_PER_TILE), gz = Math.floor(vz / VOXELS_PER_TILE);
      if (this.state.elements.some(e => gx >= e.gx && gx < e.gx + e.spanX && gz >= e.gz && gz < e.gz + e.spanZ)) return;
      for (let n = 0; n < 7; n++) {
        const a = rotation + n * 2.4, dx = Math.cos(a), dz = Math.sin(a);
        const x0 = dx * 0.11, z0 = dz * 0.11, height = 0.23 + (n % 3) * 0.09;
        const base = vertex(x0 - dz * 0.035, -0.02, z0 + dx * 0.035, 0x938c58);
        vertex(x0 + dz * 0.035, -0.02, z0 - dx * 0.035, 0xaca96d);
        vertex(x0 - dx * 0.034, -0.02, z0 - dz * 0.034, 0x989c65);
        vertex(x0 + dx * 0.10 + 0.05, height, z0 + dz * 0.10, n % 2 ? 0xa9ad70 : 0xc3b682);
        this.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3, base + 2, base, base + 3);
      }
    }
  }

  add(vx: number, vz: number) {
    const a = this.corner(vx, vz), b = this.corner(vx, vz + 1);
    const c = this.corner(vx + 1, vz + 1), d = this.corner(vx + 1, vz);
    this.indices.push(a, b, c, a, c, d);
    this.skirt(a, b, vx - 1, vz);
    this.skirt(b, c, vx, vz + 1);
    this.skirt(c, d, vx + 1, vz);
    this.skirt(d, a, vx, vz - 1);
    this.accent(vx, vz, (this.positions[a * 3 + 1] + this.positions[c * 3 + 1]) / 2);
  }

  build(material: THREE.Material) {
    if (!this.indices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "Beach terrain";
    mesh.receiveShadow = true;
    return mesh;
  }
}

export function beachSandMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 vSand;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvSand = position;");
    shader.fragmentShader = "varying vec3 vSand;\n" + shader.fragmentShader.replace("#include <color_fragment>", `
      #include <color_fragment>
      vec2 p = vSand.xz;
      vec2 grainCell = floor(p * 9.0);
      float grain = fract(52.9829189 * fract(dot(grainCell, vec2(0.06711056, 0.00583715))));
      float resolution = 1.0 - smoothstep(0.035, 0.19, max(fwidth(p.x), fwidth(p.y)));
      float ripples = sin(5.8 * (p.x * 0.36 + p.y * 0.7 + 0.18 * sin(p.x * 1.3)));
      float dry = smoothstep(-0.34, -0.06, vSand.y);
      diffuseColor.rgb *= 1.0 + resolution * (0.042 * (grain - 0.5) + 0.013 * dry * ripples);
    `);
  };
  return material;
}
