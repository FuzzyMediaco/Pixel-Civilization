import * as THREE from "three";
import type { SmokeKind } from "./designs/kit";

export interface ChimneyOutlet {
  id: string;
  group: THREE.Object3D;
  local: THREE.Vector3;
  kind: SmokeKind;
}

const capacity = 700;
const stride = 11;
const kindIndex = { smoke: 0, steam: 1, dark: 2, spark: 3 };
const rateMultiplier = [1, 1.3, 1, 2.5];
const longestLife = [4.8, 3.4, 4.8, 1];

const vertexInputs = `
  attribute vec4 puffOriginTime;
  attribute vec4 puffVelocityLife;
  attribute vec3 puffStyle;
  uniform float plumeTime;
  uniform vec3 plumeColors[5];
  varying vec4 plumeTint;
`;
const spinVertex = `
  #include <beginnormal_vertex>
  float age = clamp(plumeTime - puffOriginTime.w, 0.0, puffVelocityLife.w);
  float progress = age / puffVelocityLife.w;
  float angle = age * 0.6 + puffStyle.y;
  float c = cos(angle), s = sin(angle);
  mat2 spin = mat2(c, -s, s, c);
  objectNormal.xz = spin * objectNormal.xz;
`;
const positionVertex = `
  #include <begin_vertex>
  int kind = int(puffStyle.x);
  bool spark = kind == 3;
  float fade = 1.0 - smoothstep(0.68, 1.0, progress);
  float size = spark ? 0.09 * (1.0 - progress) :
    (kind == 1 ? 0.42 : 0.34) * (0.55 + 2.3 * progress) * (0.45 + 0.55 * fade);
  transformed.xz = spin * transformed.xz;
  transformed *= size;
  vec3 drift = puffVelocityLife.xyz * age;
  if (spark) {
    drift.y -= 1.75 * age * age;
  } else {
    drift.y = puffVelocityLife.y * (1.0 - exp(-0.22 * age)) / 0.22;
    drift.xz += vec2(0.175, 0.09) * puffStyle.z * age * age;
    drift.z += 0.16 * progress * sin(puffStyle.y + age * 2.1);
  }
  transformed += puffOriginTime.xyz + drift;
  plumeTint = vec4(mix(plumeColors[kind], plumeColors[4], kind == 0 ? progress : 0.0), fade);
`;

/** Each puff leaves the stack in world space. Only births and vacated slots change the instance buffer. */
export class ChimneyPlumes {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.MeshLambertMaterial>;
  private readonly time = { value: 0 };
  private readonly data = new THREE.InstancedInterleavedBuffer(new Float32Array(capacity * stride), stride, 1)
    .setUsage(THREE.DynamicDrawUsage);
  private readonly origin = new THREE.InterleavedBufferAttribute(this.data, 4, 0);
  private readonly velocity = new THREE.InterleavedBufferAttribute(this.data, 4, 4);
  private readonly style = new THREE.InterleavedBufferAttribute(this.data, 3, 8);
  private readonly expires = new Float64Array(capacity);
  private readonly position = new THREE.Vector3();
  private outlets: (ChimneyOutlet & { phase: number })[] = [];
  private particleLoad = 0;
  private previousTime?: number;
  private nextExpiry = Infinity;
  private cursor = 0;

  constructor() {
    const geometry = new THREE.InstancedBufferGeometry();
    const cube = new THREE.BoxGeometry(1, 1, 1);
    geometry.setIndex(cube.index);
    geometry.setAttribute("position", cube.getAttribute("position"));
    geometry.setAttribute("normal", cube.getAttribute("normal"));
    geometry.setAttribute("puffOriginTime", this.origin);
    geometry.setAttribute("puffVelocityLife", this.velocity);
    geometry.setAttribute("puffStyle", this.style);
    geometry.instanceCount = 0;

    const colors = [0xb7bcc4, 0xf4f8fb, 0x4b4f58, 0xffa040, 0xe8ecf0].map(hex => new THREE.Color(hex));
    const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.82, depthWrite: false });
    material.onBeforeCompile = shader => {
      shader.uniforms.plumeTime = this.time;
      shader.uniforms.plumeColors = { value: colors };
      shader.vertexShader = vertexInputs + shader.vertexShader
        .replace("#include <beginnormal_vertex>", spinVertex)
        .replace("#include <begin_vertex>", positionVertex);
      shader.fragmentShader = "varying vec4 plumeTint;\n" + shader.fragmentShader.replace(
        "#include <color_fragment>", "#include <color_fragment>\n diffuseColor *= plumeTint;",
      );
    };
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "Chimney plumes";
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  setOutlets(outlets: ChimneyOutlet[]) {
    const previous = new Map(this.outlets.map(outlet => [outlet.id, outlet.phase]));
    this.outlets = outlets.map(outlet => ({ ...outlet, phase: previous.get(outlet.id) ?? Math.random() }));
    this.particleLoad = 0;
    for (const outlet of outlets) {
      const kind = kindIndex[outlet.kind];
      this.particleLoad += rateMultiplier[kind] * longestLife[kind];
    }
  }

  update(now: number, wind: number, lowDetail: boolean) {
    // Age existing puffs by the entire elapsed time. After a suspended tab resumes,
    // only emit a short recent trail rather than replaying minutes of missed births.
    const delta = Math.min(1, Math.max(0, now - (this.previousTime ?? now)));
    this.previousTime = now;
    this.time.value = now;
    const geometry = this.mesh.geometry;
    let count = geometry.instanceCount;
    let wrote = false;
    if (now >= this.nextExpiry) {
      this.nextExpiry = Infinity;
      for (let slot = count - 1; slot >= 0; slot--) {
        if (this.expires[slot] > now) {
          this.nextExpiry = Math.min(this.nextExpiry, this.expires[slot]);
          continue;
        }
        count--;
        if (slot !== count) {
          this.data.array.copyWithin(slot * stride, count * stride, (count + 1) * stride);
          this.data.addUpdateRange(slot * stride, stride);
          this.expires[slot] = this.expires[count];
          wrote = true;
        }
      }
    }

    // Share the pool across the island. Stacks retain their own cadence when a
    // neighboring building changes and no emitter can accumulate an unbounded backlog.
    const baseRate = Math.min(lowDetail ? 1.2 : 2.6, capacity / Math.max(1, this.particleLoad));
    const length = this.outlets.length;
    for (let i = 0; i < length; i++) {
      const outlet = this.outlets[(i + this.cursor) % length];
      const kind = kindIndex[outlet.kind];
      const rate = baseRate * rateMultiplier[kind];
      outlet.phase += delta * rate;
      if (outlet.phase < 1) continue;
      const births = Math.floor(outlet.phase);
      outlet.phase -= births;
      if (count === capacity) continue;
      this.position.copy(outlet.local);
      outlet.group.localToWorld(this.position);
      for (let j = 0; j < births && count < capacity; j++) {
        const born = now - (births - 1 - j + outlet.phase) / rate;
        const spark = kind === 3;
        const life = spark ? 0.6 + Math.random() * 0.4 : kind === 1 ? 2.4 + Math.random() : 3.4 + Math.random() * 1.4;
        if (born + life <= now) continue;
        const x = this.position.x + (Math.random() - 0.5) * 0.2;
        const z = this.position.z + (Math.random() - 0.5) * 0.2;
        const spread = spark ? 1.6 : 0.3;
        const rise = spark ? 1.2 + Math.random() * 1.4 : (kind === 1 ? 2.0 : 1.5) + Math.random() * 0.6;
        this.origin.setXYZW(count, x, this.position.y, z, born);
        this.velocity.setXYZW(count, (Math.random() - 0.5) * spread, rise, (Math.random() - 0.5) * spread, life);
        this.style.setXYZ(count, kind, Math.random() * Math.PI * 2, wind);
        this.expires[count] = born + life;
        this.nextExpiry = Math.min(this.nextExpiry, born + life);
        this.data.addUpdateRange(count * stride, stride);
        count++;
        wrote = true;
      }
    }
    if (length) this.cursor = (this.cursor + 1) % length;
    if (wrote) this.data.needsUpdate = true;
    geometry.instanceCount = count;
    this.mesh.visible = count > 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
