import { solidVoxels } from "./designs/kit";
import * as THREE from "three";
import { PixelVox, buildVoxelGeometry, getPixelVoxelMaterial, TILE_SIZE } from "./voxelCore";
import type { GameState } from "./simulation";
import { getTerrainCell, surfaceTravelHeight } from "./terrain";
import { marine, type Point, type TravelNetwork } from "./travelNetwork";
import { getProjectActors } from "./projectOperations";

type ModelKind =
  | "ferry"
  | "freight"
  | "gondola"
  | "plane"
  | "airTaxi"
  | "teleport"
  | "rocket"
  | "engine"
  | "fireboat"
  | "volunteer"
  | "passenger";
type RoadMesh = (kind: "bus" | "train" | "taxi", seed: number) => THREE.BufferGeometry;
function model(kind: ModelKind) {
  const v = new PixelVox(51);
  const box = solidVoxels(v);
  if (["ferry", "freight", "gondola", "fireboat"].includes(kind)) {
    const wide = kind !== "gondola",
      length = wide ? 10 : 7,
      w = wide ? 3 : 1;
    for (let z = -length; z <= length; z++) {
      const beam = Math.max(0, Math.min(w, length - Math.abs(z)));
      box(-beam, 0, z, beam, 1, z, kind === "gondola" ? "#493325" : "#204354");
      box(-beam, 2, z, beam, 2, z, "#ba9460");
    }
    if (kind === "freight") {
      for (const z of [-5, 1]) box(-2, 3, z, 2, 5, z + 3, z < 0 ? "#b36240" : "#377878");
    }
    if (kind === "ferry" || kind === "fireboat") {
      box(-2, 3, -5, 2, 5, 4, kind === "ferry" ? "#e6d6a6" : "#ca4a3c");
      box(-2, 4, -4, 2, 5, 3, "#517a87", 0.28);
      box(-3, 6, -5, 3, 6, 4, "#faf1d9");
      box(0, 7, -3, 1, 8, -2, "#c65f40");
      v.put(0, 5, 5, "warmGlow", 0.8);
      if (kind === "fireboat") box(0, 5, 6, 0, 6, 9, "#afc5ba");
    }
    if (kind === "gondola") {
      box(0, 3, 6, 0, 4, 7, "#dac990");
      v.put(0, 4, -4, "#f4b987");
      box(1, 2, -5, 2, 2, -2, "#9d753c");
    }
  } else if (kind === "plane" || kind === "airTaxi") {
    const length = kind === "plane" ? 10 : 4;
    for (let z = -length; z <= length; z++) {
      const w = Math.min(2, length - Math.abs(z));
      box(-w, 1, z, w, 3, z, "#f6e9cf");
    }
    box(-1, 3, length - 4, 1, 4, length - 2, "#315a66");
    for (let x = -length; x <= length; x++) {
      const z = -Math.round(Math.abs(x) * 0.36);
      box(x, 2, z - 1, x, 2, z + 1, "#55999a");
    }
    box(0, 4, -length + 1, 0, 6, -length + 3, "#bd6440");
    box(-3, 3, -length + 1, 3, 3, -length + 2, "#276f78");
    if (kind === "airTaxi")
      for (const x of [-4, 4]) for (const z of [-3, 3]) box(x - 1, 4, z, x + 1, 4, z, "#b7eff1", 0.6);
  } else if (kind === "rocket") {
    for (let y = 0; y <= 16; y++) {
      const w = y > 12 ? Math.floor((17 - y) / 2) : 2;
      box(-w, y, -w, w, y, w, y < 3 || y > 13 ? "#a94f39" : "#f1e6d1");
    }
    for (const x of [-1, 1]) box(2 * x, 0, -1, 3 * x, 4, 1, "#be6b43");
    box(-1, -3, -1, 1, -1, 1, "#ffd77c", 1);
  } else if (kind === "engine") {
    box(-2, 1, -5, 2, 4, 5, "#b43d31");
    box(-2, 3, 2, 2, 4, 4, "#609299");
    box(-1, 5, -5, 1, 5, 0, "#beb6a0");
    for (const x of [-2, 2]) for (const z of [-3, 3]) box(x, 0, z - 1, x, 1, z, "#363832");
    v.put(0, 5, 3, "#79bce7", 1);
  } else {
    box(-1, 0, 0, 1, 1, 0, "#424d59");
    box(-1, 2, 0, 1, 4, 0, kind === "teleport" ? "#31c8c7" : kind === "volunteer" ? "#c65b3e" : "#517e77");
    box(0, 5, 0, 1, 6, 0, "#cd996e");
    if (kind === "teleport") for (const x of [-2, 2]) box(x, 3, -1, x, 4, 1, "#78efff", 1.4);
  }
  return buildVoxelGeometry(
    v,
    kind === "passenger" || kind === "volunteer" ? 0.095 : kind === "gondola" ? 0.16 : 0.2,
  );
}
export class MobilityVisuals {
  readonly root = new THREE.Group();
  private objects = new Map<string, THREE.Mesh>();
  private geometries = new Map<string, THREE.BufferGeometry>();
  private target = new THREE.Vector3();
  private used = new Set<string>();
  constructor(
    scene: THREE.Scene,
    private road: RoadMesh,
  ) {
    scene.add(this.root);
  }
  private draw(
    id: string,
    kind: string,
    source: string | undefined,
    x: number,
    y: number,
    z: number,
    angle: number,
    dt: number,
  ) {
    this.used.add(id);
    let mesh = this.objects.get(id);
    if (!mesh || mesh.userData.kind !== kind) {
      if (mesh) this.root.remove(mesh);
      let geo = this.geometries.get(kind);
      if (!geo) {
        geo = ["bus", "rail", "taxi"].includes(kind)
          ? this.road(kind === "rail" ? "train" : (kind as "bus" | "taxi"), 1)
          : model(kind as ModelKind);
        this.geometries.set(kind, geo);
      }
      mesh = new THREE.Mesh(geo, getPixelVoxelMaterial());
      mesh.userData.kind = kind;
      mesh.castShadow = true;
      this.root.add(mesh);
      this.objects.set(id, mesh);
      mesh.position.set(x, y, z);
      mesh.rotation.y = angle;
    }
    mesh.userData.elementId = source;
    this.target.set(x, y, z);
    if (mesh.position.distanceToSquared(this.target) > 120) mesh.position.copy(this.target);
    else mesh.position.lerp(this.target, 1 - Math.exp(-dt * 14));
    const delta = angle - mesh.rotation.y;
    mesh.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 16));
    return mesh;
  }
  update(s: GameState, dt: number, nav?: TravelNetwork) {
    this.used.clear();
    for (const l of s.mobility?.lines ?? []) {
      if (!l.position || !l.enabled) continue;
      const [fx, fz] = l.position,
        x = Math.round(fx),
        z = Math.round(fz),
        water = marine(l.mode);
      const axis = Math.abs(Math.sin(l.heading)) > 0.5 ? "x" : "z";
      const y = water
        ? (nav?.water.cell(x, z).waterLevel ?? getTerrainCell(s, x, z).waterLevel)
        : surfaceTravelHeight(s, x, z, axis, 0.5 + (axis === "x" ? fx - x : fz - z));
      const curb = water || l.mode === "rail" ? 0 : 0.38;
      const xx = (fx + 0.5) * TILE_SIZE - curb * Math.cos(l.heading),
        zz = (fz + 0.5) * TILE_SIZE + curb * Math.sin(l.heading);
      this.draw(l.id, l.mode, l.depot, xx, y + 0.12, zz, l.heading, dt).userData.serviceId = l.id;
      if (l.at && l.dwell > 0 && l.mode !== "freight") {
        const stop = s.elements.find((e) => e.id === l.at);
        if (!stop) continue;
        const cx = (stop.gx + stop.spanX * 0.5) * TILE_SIZE,
          cz = (stop.gz + stop.spanZ * 0.5) * TILE_SIZE;
        const n = Math.min(4, l.riders.reduce((m, r) => m + r.count, 0) + Number(l.delivered > 0));
        for (let i = 0; i < n; i++) {
          const t = (s.activePlaySec * 0.75 + i * 0.23) % 1;
          this.draw(
            l.id + "-rider" + i,
            "passenger",
            stop.id,
            cx + (xx - cx) * t + i * 0.18,
            y + 0.15 + Math.sin(t * 10) * 0.045,
            cz + (zz - cz) * t,
            l.heading,
            dt,
          );
        }
      }
    }
    for (const a of getProjectActors(s)) {
      const cell = getTerrainCell(s, Math.floor(a.gx), Math.floor(a.gz));
      const y =
        a.kind === "fireboat"
          ? (nav?.water.cell(Math.floor(a.gx), Math.floor(a.gz)).waterLevel ?? cell.waterLevel)
          : a.kind === "engine"
            ? surfaceTravelHeight(
                s,
                Math.floor(a.gx),
                Math.floor(a.gz),
                Math.abs(Math.sin(a.heading)) > 0.5 ? "x" : "z",
                0.5,
              )
            : Math.max(cell.elevation, cell.waterLevel);
      const mesh = this.draw(
        a.id,
        a.kind,
        a.siteId,
        a.gx * TILE_SIZE,
        y + a.height + 0.07,
        a.gz * TILE_SIZE,
        a.heading,
        dt,
      );
      if (a.kind === "teleport") mesh.scale.setScalar(0.7 + 0.35 * Math.sin(a.progress * Math.PI));
    }
    for (const [id, o] of this.objects)
      if (!this.used.has(id)) {
        this.root.remove(o);
        this.objects.delete(id);
      }
  }
  position(id: string): THREE.Vector3 | undefined {
    return this.objects.get(id)?.position;
  }
  dispose() {
    this.root.removeFromParent();
    for (const [kind, g] of this.geometries) if (!["bus", "rail", "taxi"].includes(kind)) g.dispose();
    this.geometries.clear();
    this.objects.clear();
  }
}
export function voyagePlacement(s: GameState, position: Point, submerged: boolean, nav?: TravelNetwork) {
  const x = Math.round(position[0]),
    z = Math.round(position[1]);
  const cell = nav?.water.cell(x, z) ?? getTerrainCell(s, x, z);
  return {
    x: (position[0] + 0.5) * TILE_SIZE,
    y: cell.waterLevel - (submerged ? Math.min(cell.depth * 0.42, 1.65) : 0),
    z: (position[1] + 0.5) * TILE_SIZE,
  };
}
