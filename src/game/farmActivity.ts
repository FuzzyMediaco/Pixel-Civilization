import * as THREE from "three";
import { buildVoxelGeometry, getPixelVoxelMaterial, PixelVox, TILE_SIZE } from "./voxelCore";
import { districtReport, type DistrictReport } from "./farmNetworks";
import { getTerrainCell } from "./terrain";
import { CRITTER_TUNING, CRITTER_UNIT, critterModel, type BuiltCritterPen, type CritterRole } from "./critterModels";
import type { CritterKind } from "./designs/kit";
import type { GameState, PlacedElement } from "./simulation";

type FarmJob = "tractor" | "grower" | "combine" | "herd" | "delivery" | "picker" | "grainCart";
type GridPos = [number, number];
interface FarmJobRun {
  key: string;
  job: FarmJob;
  path: GridPos[];
  period: number;
  offset: number;
}
const cropBeds = new Set([
  "fields",
  "grain_fields",
  "vegetable_fields",
  "orchard_block",
  "grazing_pasture",
  "livestock_pen",
  "chicken_coop",
]);
const stockyards = new Set(["grazing_pasture", "livestock_pen", "cattle_ranch", "horse_ranch", "dairy_farm"]);
/** A lane extends through contiguous crop tiles. The vehicle turns back before an unrelated parcel. */
function workLane(sites: PlacedElement[], sample: number): GridPos[] {
  const cells = new Set<string>();
  for (const s of sites)
    for (let x = s.gx; x < s.gx + s.spanX; x++)
      for (let z = s.gz; z < s.gz + s.spanZ; z++) cells.add(x + "," + z);
  const site = sites[sample % sites.length],
    x = site.gx + Math.floor(site.spanX / 2),
    z = site.gz + Math.floor(site.spanZ / 2);
  let left = x,
    right = x,
    top = z,
    bottom = z;
  while (cells.has(left - 1 + "," + z) && x - left < 4) left--;
  while (cells.has(right + 1 + "," + z) && right - x < 4) right++;
  while (cells.has(x + "," + (top - 1)) && z - top < 4) top--;
  while (cells.has(x + "," + (bottom + 1)) && bottom - z < 4) bottom++;
  const offset = sites.every((el) => !cropBeds.has(el.defId)) ? 0.91 : 0.52 + ((sample % 3) - 1) * 0.16;
  return right - left >= bottom - top
    ? [
        [left + 0.19, z + offset],
        [right + 0.81, z + offset],
      ]
    : [
        [x + offset, top + 0.19],
        [x + offset, bottom + 0.81],
      ];
}
const plans = new WeakMap<DistrictReport, FarmJobRun[]>();
export function farmActivityRuns(s: GameState): FarmJobRun[] {
  const report = districtReport(s),
    cached = plans.get(report);
  if (cached) return cached;
  const runs: FarmJobRun[] = [];
  for (const net of new Set(report.farms.values())) {
    if (!net.live || !net.tier) continue;
    const beds = net.modules.filter((m) => cropBeds.has(m.defId)).sort((a, b) => a.gx - b.gx || a.gz - b.gz);
    const fields = beds.length ? beds : net.modules;
    const hasGrain =
      net.modules.some((m) => m.defId === "fields" || m.defId === "grain_fields") ||
      net.anchors.some((a) => a.defId === "grain_farm");
    const yards = net.modules.filter((m) => stockyards.has(m.defId));
    const key = net.anchors.map((a) => a.id).sort()[0];
    function job(kind: FarmJob, group: PlacedElement[], sample: number, speed: number) {
      const path = workLane(group, sample),
        distance = Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]);
      runs.push({
        key: key + "/" + kind + "/" + sample,
        job: kind,
        path,
        period: Math.max(4, (2 * distance) / speed),
        offset: (sample * 0.171) % 1,
      });
    }
    job("tractor", fields, 1, 0.4);
    if (net.tier >= 2) {
      job("grower", fields, 3, 0.18);
      if (yards.length) job("herd", yards, 4, 0.13);
    }
    if (net.tier >= 3) {
      job(hasGrain ? "combine" : "picker", fields, 6, 0.26);
      if (!yards.length) job("grower", fields, 8, 0.15);
    }
    if (net.tier >= 4) {
      job("delivery", fields, 12, 0.6);
      job(hasGrain ? "grainCart" : "picker", fields, 15, 0.27);
    }
  }
  plans.set(report, runs);
  return runs;
}
/** Closed patrol within an occupied farming corridor. A short turn at each end avoids visible teleporting. */
export function farmJobPose(run: FarmJobRun, time: number) {
  const [a, b] = run.path,
    phase = (((time / run.period + run.offset) % 1) + 1) % 1,
    forward = phase < 0.5;
  const t = forward ? phase * 2 : 2 - phase * 2,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const blend = Math.sin(t * Math.PI) * 0.055 * (forward ? 1 : -1),
    angle = Math.atan2(dx, dz) + (forward ? 0 : Math.PI);
  return { x: a[0] + dx * t - (dz * blend) / length, z: a[1] + dz * t + (dx * blend) / length, angle };
}
function geometry(kind: FarmJob) {
  const v = new PixelVox();
  if (kind === "grower" || kind === "picker") {
    v.box(-1, 0, -1, 0, 3, 1, "blueDark");
    v.box(1, 0, 0, 2, 3, 2, "blueDark");
    v.box(-1, 3, -1, 2, 6, 2, kind === "grower" ? "sky" : "crimson");
    v.box(0, 6, 0, 2, 8, 2, "#bc825e");
    v.box(-1, 8, -1, 3, 9, 3, "sandDark");
    v.box(0, 9, 0, 2, 10, 2, "sand");
    v.box(2, 3, 1, 3, 5, 4, "crate");
  } else if (kind === "herd") {
    // A stockman riding a bay horse (the horse itself is the shared critter model, added as a child mesh).
    for (const x of [-3, 2]) v.box(x, 6, 0, x + 1, 9, 2, "blueDark");
    v.box(-2, 8, -1, 2, 9, 2, "blueDark");
    v.box(-2, 9, -1, 2, 13, 2, "crimson");
    for (const x of [-3, 2]) v.box(x, 10, 0, x + 1, 12, 2, "crimson");
    v.box(-1, 13, -1, 1, 15, 1, "#bc825e");
    v.box(-3, 15, -3, 3, 16, 3, "woodDark");
    v.box(-1, 16, -1, 1, 18, 1, "wood");
    return buildVoxelGeometry(v, CRITTER_UNIT);
  } else {
    const paint =
      kind === "combine" ? "gold" : kind === "delivery" ? "blue" : kind === "grainCart" ? "copper" : "leafDark";
    for (const x of [-3, 2]) for (const z of [-3, 2]) v.box(x, 0, z, x + 2, 3, z + 2, "rubber");
    v.box(-2, 2, -4, 3, 5, 5, paint);
    v.box(-2, 5, 0, 3, 8, 4, "glassDark");
    v.box(-3, 8, 0, 4, 9, 4, paint);
    v.box(1, 4, 4, 2, 7, 5, "steelDark");
    if (kind === "combine") {
      v.box(-5, 1, 4, 6, 3, 6, "redDark");
      for (let i = -5; i < 6; i += 2) v.put(i, 1, 6, "steel");
      v.box(-2, 5, -4, 3, 7, 0, "goldDark");
      v.box(2, 6, -2, 7, 7, -1, "gold");
    }
    if (kind === "delivery") {
      v.box(-3, 3, -6, 4, 8, 0, "cream");
      v.box(-3, 5, -6, 4, 6, 0, "blue");
    }
    if (kind === "grainCart") {
      v.box(-3, 3, -6, 4, 7, 0, "wood");
      v.box(-2, 7, -5, 3, 8, -1, "gold");
    }
  }
  return buildVoxelGeometry(v, 0.105);
}
// =============================================================================================
// Animated livestock. Each placed element's design registers pens (c.critters); the herds below wander
// inside them in the element's local frame (so rotation, bobbing and squash/stretch carry over).
// One InstancedMesh per kind × coat × body part for the whole island; state lives in typed arrays.
// =============================================================================================
const MAX_ANIMALS = 1400;
/** per-animal state: x, z, heading, targetX, targetZ, timer, mode (0 walk, 1 idle), phase, speedMul */
const S = 9;
interface Herd {
  sig: string;
  group: THREE.Group;
  pen: BuiltCritterPen;
  state: Float32Array;
  /** first instance slot in each part mesh of this kind/coat */
  slot: number;
  frame: number;
}
interface PartMeshes {
  kind: CritterKind;
  meshes: { role: CritterRole; pivot: THREE.Vector3; mesh: THREE.InstancedMesh }[];
  used: number;
}
const roles: Record<CritterRole, number> = { body: 0, head: 1, legA: 2, legB: 3, wings: 4 };
export class CritterHerds {
  private root = new THREE.Group();
  private herds: Herd[] = [];
  private bins = new Map<string, PartMeshes>();
  private frame = 0;
  private seed = 12345;
  private m = new THREE.Matrix4();
  private animal = new THREE.Matrix4();
  private part = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private w = new THREE.Vector3();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(
    scene: THREE.Scene,
    private camera?: () => THREE.Camera | undefined,
  ) {
    scene.add(this.root);
  }
  private rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  get count() {
    return this.herds.reduce((n, h) => n + h.pen.count, 0);
  }
  /** Call after placed groups change. Cheap when nothing changed: herds keep their positions. */
  sync(elements: readonly PlacedElement[], entries: ReadonlyMap<string, { group: THREE.Group }>) {
    const old = new Map(this.herds.map((h) => [h.sig, h])),
      next: Herd[] = [];
    let total = 0;
    for (const el of elements) {
      const group = entries.get(el.id)?.group,
        pens = group?.userData.critters as BuiltCritterPen[] | undefined;
      if (!group || !pens?.length) continue;
      const preview = group.userData.critterPreview as THREE.Group | undefined;
      let adopted = false;
      pens.forEach((pen, i) => {
        if (!pen.count || total + pen.count > MAX_ANIMALS) return;
        total += pen.count;
        adopted = true;
        const sig = el.id + "#" + i + group.uuid;
        const prev = old.get(sig);
        next.push(prev ?? this.spawn(sig, group, pen, i));
      });
      if (preview) preview.visible = !adopted;
    }
    this.herds = next;
    this.layout();
  }
  private spawn(sig: string, group: THREE.Group, pen: BuiltCritterPen, index: number): Herd {
    const state = new Float32Array(pen.count * S),
      [x0, z0, x1, z1] = pen.area;
    for (let i = 0; i < pen.count; i++) {
      const o = i * S;
      state[o] = x0 + (x1 - x0) * (0.15 + 0.7 * this.rand());
      state[o + 1] = z0 + (z1 - z0) * (0.15 + 0.7 * this.rand());
      state[o + 2] = this.rand() * Math.PI * 2;
      state[o + 3] = state[o];
      state[o + 4] = state[o + 1];
      state[o + 5] = this.rand() * 3;
      state[o + 6] = 1;
      state[o + 7] = this.rand() * 10;
      state[o + 8] = 0.75 + this.rand() * 0.5;
    }
    group.updateMatrixWorld(true);
    return { sig, group, pen, state, slot: 0, frame: index % 3 };
  }
  /** Assign instance slots; grow (re-create) meshes only when a bin overflows. */
  private layout() {
    for (const bin of this.bins.values()) bin.used = 0;
    const need = new Map<string, number>();
    for (const h of this.herds) {
      const key = h.pen.kind + "|" + h.pen.coat;
      need.set(key, (need.get(key) ?? 0) + h.pen.count);
    }
    for (const [key, n] of need) {
      let bin = this.bins.get(key);
      const capacity = bin?.meshes[0]?.mesh.instanceMatrix.count ?? 0;
      if (!bin || capacity < n) {
        if (bin) for (const m of bin.meshes) (m.mesh.removeFromParent(), m.mesh.dispose());
        const [kind, coat] = key.split("|"),
          model = critterModel(kind as CritterKind, Number(coat)),
          size = Math.ceil(n / 16) * 16 + 16;
        bin = {
          kind: kind as CritterKind,
          used: 0,
          meshes: model.parts
            .slice()
            .sort((a, b) => roles[a.role] - roles[b.role])
            .map((part) => {
              const mesh = new THREE.InstancedMesh(part.geo, getPixelVoxelMaterial(), size);
              mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
              mesh.frustumCulled = false;
              mesh.castShadow = true;
              for (let i = 0; i < size; i++) mesh.setMatrixAt(i, this.hidden);
              this.root.add(mesh);
              return { role: part.role, pivot: new THREE.Vector3(...part.pivot), mesh };
            }),
        };
        this.bins.set(key, bin);
      }
    }
    for (const h of this.herds) {
      const bin = this.bins.get(h.pen.kind + "|" + h.pen.coat)!;
      h.slot = bin.used;
      bin.used += h.pen.count;
      h.frame = -1;
    }
    for (const [key, bin] of this.bins) {
      const used = need.get(key) ?? 0;
      for (const m of bin.meshes) {
        m.mesh.count = used;
        m.mesh.visible = used > 0;
      }
    }
  }
  update(dt: number) {
    if (!this.herds.length) return;
    this.frame++;
    const cam = this.camera?.()?.position,
      step = Math.min(0.1, dt);
    for (const h of this.herds) {
      // Far herds idle (frozen); mid-range herds update at a third of the rate.
      let interval = 1;
      if (cam) {
        this.w.setFromMatrixPosition(h.group.matrixWorld);
        const d = this.w.distanceTo(cam);
        interval = d > 140 ? 0 : d > 60 ? 3 : 1;
      }
      if (h.frame >= 0 && (interval === 0 || (this.frame + h.slot) % interval)) continue;
      this.simulate(h, h.frame < 0 ? 0 : step * interval);
      h.frame = this.frame;
    }
    for (const bin of this.bins.values()) for (const m of bin.meshes) m.mesh.instanceMatrix.needsUpdate = true;
  }
  private simulate(h: Herd, dt: number) {
    const { pen, state } = h,
      t = CRITTER_TUNING[pen.kind],
      [x0, z0, x1, z1] = pen.area,
      sc = pen.scale,
      pad = Math.min(0.35 * sc, (x1 - x0) / 2, (z1 - z0) / 2),
      bin = this.bins.get(pen.kind + "|" + pen.coat)!,
      shown = h.group.visible && h.group.children[0]?.visible !== false;
    for (let i = 0; i < pen.count; i++) {
      const o = i * S;
      let x = state[o],
        z = state[o + 1],
        hd = state[o + 2];
      const walking = state[o + 6] === 0;
      state[o + 5] -= dt;
      if (walking) {
        const dx = state[o + 3] - x,
          dz = state[o + 4] - z,
          dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz),
          diff = Math.atan2(Math.sin(want - hd), Math.cos(want - hd));
        hd += Math.max(-t.turn * dt, Math.min(t.turn * dt, diff));
        if (Math.abs(diff) < 1.1) {
          const v = t.speed * sc * state[o + 8] * dt * Math.min(1, dist / (0.3 * sc) + 0.25);
          x += Math.sin(hd) * v;
          z += Math.cos(hd) * v;
        }
        state[o + 7] += dt * t.stride * state[o + 8];
        if (dist < 0.08 * sc || state[o + 5] < -12) {
          state[o + 6] = 1;
          state[o + 5] = t.idle[0] + this.rand() * (t.idle[1] - t.idle[0]);
        }
      } else {
        state[o + 7] += dt * (t.fly ? t.stride : 2.5);
        if (state[o + 5] <= 0) {
          state[o + 6] = 0;
          state[o + 5] = 0;
          // Most wanders are short ambles nearby; sometimes cross the pen.
          const far = this.rand() < 0.3,
            r = (far ? 3 : 1.1) * sc;
          state[o + 3] = Math.max(x0 + pad, Math.min(x1 - pad, (far ? x0 + (x1 - x0) * this.rand() : x + (this.rand() * 2 - 1) * r)));
          state[o + 4] = Math.max(z0 + pad, Math.min(z1 - pad, (far ? z0 + (z1 - z0) * this.rand() : z + (this.rand() * 2 - 1) * r)));
        }
      }
      // Keep a little personal space.
      const gap = t.spacing * sc;
      for (let j = 0; j < pen.count; j++) {
        if (j === i) continue;
        const ox = x - state[j * S],
          oz = z - state[j * S + 1],
          d2 = ox * ox + oz * oz;
        if (d2 < gap * gap && d2 > 1e-6) {
          const d = Math.sqrt(d2),
            push = ((gap - d) / d) * Math.min(1, dt * 3);
          x += ox * push * 0.5;
          z += oz * push * 0.5;
        }
      }
      x = Math.max(x0 + pad, Math.min(x1 - pad, x));
      z = Math.max(z0 + pad, Math.min(z1 - pad, z));
      state[o] = x;
      state[o + 1] = z;
      state[o + 2] = hd;
      // ---- pose ----
      const ph = state[o + 7],
        moving = state[o + 6] === 0;
      let y = pen.y,
        roll = 0,
        head = 0,
        legs = 0,
        flap = 1;
      if (t.fly) {
        y += (0.7 + 0.25 * Math.sin(ph * 0.21 + i)) * sc;
        flap = 0.35 + 0.65 * Math.abs(Math.sin(ph * 3));
      } else if (moving) {
        const sw = Math.sin(ph);
        legs = sw * 0.6;
        y += Math.abs(sw) * t.bounce * sc;
        if (t.hop) y += Math.max(0, Math.sin(ph * 0.25)) ** 8 * 0.12 * sc;
        if (t.waddle) roll = sw * 0.18;
        head = Math.sin(ph * 2) * 0.06;
      } else {
        // graze / peck: the head dips to the grass, rising now and then to look around
        const cycle = Math.sin(ph * (t.hop || t.waddle ? 3.2 : 0.7) + i);
        head = t.graze * (t.hop || t.waddle ? Math.max(0, cycle) ** 3 : 0.55 + 0.45 * cycle);
      }
      this.e.set(0, hd, roll, "YXZ");
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      this.s.setScalar(sc);
      this.animal.compose(this.p, this.q, this.s).premultiply(h.group.matrixWorld);
      for (const m of bin.meshes) {
        if (!shown) {
          m.mesh.setMatrixAt(h.slot + i, this.hidden);
          continue;
        }
        this.part.makeTranslation(m.pivot.x, m.pivot.y, m.pivot.z);
        if (m.role === "head" && head) this.part.multiply(this.m.makeRotationX(head));
        else if (m.role === "legA" && legs) this.part.multiply(this.m.makeRotationX(legs));
        else if (m.role === "legB" && legs) this.part.multiply(this.m.makeRotationX(-legs));
        else if (m.role === "wings") this.part.multiply(this.m.makeScale(1, flap, 1));
        m.mesh.setMatrixAt(h.slot + i, this.part.premultiply(this.animal));
      }
    }
  }
  dispose() {
    for (const bin of this.bins.values()) for (const m of bin.meshes) m.mesh.dispose();
    this.root.removeFromParent();
  }
}

export class FarmActivityVisuals {
  private root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private geometry = new Map<FarmJob, THREE.BufferGeometry>();
  private clock = 0;
  readonly herds: CritterHerds;
  constructor(scene: THREE.Scene, camera?: () => THREE.Camera | undefined) {
    scene.add(this.root);
    this.herds = new CritterHerds(scene, camera);
  }
  /** Re-read livestock pens from placed element groups (after the renderer syncs its scene). */
  syncHerds(elements: readonly PlacedElement[], entries: ReadonlyMap<string, { group: THREE.Group }>) {
    this.herds.sync(elements, entries);
  }
  /** Livestock animate on the real clock (they keep grazing while the city is paused). */
  animateHerds(dt: number) {
    this.herds.update(dt);
  }
  update(state: GameState, dt: number) {
    this.clock += dt;
    const runs = farmActivityRuns(state),
      keys = new Set<string>();
    for (const run of runs) {
      keys.add(run.key);
      let mesh = this.meshes.get(run.key);
      if (!mesh) {
        if (!this.geometry.has(run.job)) this.geometry.set(run.job, geometry(run.job));
        mesh = new THREE.Mesh(this.geometry.get(run.job), getPixelVoxelMaterial());
        if (run.job === "herd") mesh.add(new THREE.Mesh(critterModel("horse", 3).whole, getPixelVoxelMaterial()));
        this.meshes.set(run.key, mesh);
        this.root.add(mesh);
      }
      const p = farmJobPose(run, this.clock),
        height = getTerrainCell(state, Math.floor(p.x), Math.floor(p.z)).elevation + 0.08;
      mesh.position.set(
        p.x * TILE_SIZE,
        height +
          (run.job === "grower" || run.job === "herd" ? Math.abs(Math.sin(this.clock * 5 + p.x)) * 0.04 : 0),
        p.z * TILE_SIZE,
      );
      mesh.rotation.y = p.angle;
    }
    for (const [key, mesh] of this.meshes)
      if (!keys.has(key)) {
        mesh.removeFromParent();
        this.meshes.delete(key);
      }
  }
  dispose() {
    for (const g of this.geometry.values()) g.dispose();
    this.root.removeFromParent();
    this.herds.dispose();
  }
}
