import * as THREE from "three";
import { buildVoxelGeometry, getPixelVoxelMaterial, PixelVox, TILE_SIZE } from "./voxelCore";
import { districtReport, type DistrictReport } from "./farmNetworks";
import { getTerrainCell } from "./terrain";
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
    for (const x of [-2, 2]) for (const z of [-3, 2]) v.box(x, 0, z, x + 1, 3, z + 1, "slate");
    v.box(-2, 3, -3, 3, 6, 3, "cream");
    v.box(-2, 3, -1, 0, 6, 1, "charcoal");
    v.box(0, 5, 2, 3, 8, 5, "cream");
    v.box(0, 5, 4, 3, 6, 6, "pink");
    v.put(0, 7, 4, "black");
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
export class FarmActivityVisuals {
  private root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private geometry = new Map<FarmJob, THREE.BufferGeometry>();
  private clock = 0;
  constructor(scene: THREE.Scene) {
    scene.add(this.root);
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
  }
}
