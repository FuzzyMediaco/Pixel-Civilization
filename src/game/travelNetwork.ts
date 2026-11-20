import { parcelAccessSteps, PARCEL_SIDES, type AccessStep } from "./parcelEdges";
import { ELEMENT_BY_ID } from "./catalog";
import { roadPortOpen, buildWaterNavigation } from "./terrain";
import {
  buildOccupancyMap,
  getNetworkConnMask,
  networkDeckClass,
  PEDESTRIAN_IDS,
  type GameState,
  type PlacedElement,
} from "./simulation";
import { separatedDeckAxis } from "./roadTopology";

export type TravelMode = "bus" | "rail" | "taxi" | "ferry" | "gondola" | "freight";
export type Point = [number, number];
export interface Hull {
  beam: number;
  draft: number;
  height: number;
  turningWidth?: number;
}
export const marine = (mode: TravelMode) => mode === "ferry" || mode === "gondola" || mode === "freight";
export const waterHull: Record<"ferry" | "gondola" | "freight", Hull> = {
  gondola: { beam: 1.35, draft: 0.25, height: 0.8 },
  ferry: { beam: 4.25, draft: 0.8, height: 2.1 },
  freight: { beam: 5.5, draft: 1.25, height: 2.7, turningWidth: 9 },
};
export const vesselIds = new Set([
  "boats",
  "speed_boats",
  "sail_boats",
  "naval_vessels",
  "aircraft_carriers",
  "submarines",
]);
export const harborIds = new Set([
  "docks",
  "ferry_landings",
  "ferry_exchange",
  "shipyards",
  "ship_building_areas",
  "naval_base",
  "submarine_base",
]);
export function vesselHull(e: PlacedElement): Hull {
  const size = (e.level - 1) / 4;
  switch (e.defId) {
    case "aircraft_carriers":
      return { beam: 12 + size * 2, draft: 2.2 + size * 1.1, height: 3.8 + size * 2, turningWidth: 17 + size * 3 };
    case "submarines":
      return { beam: 5.5 + size * 3, draft: 1.35 + size, height: 1.25, turningWidth: 8 + size * 3 };
    case "naval_vessels":
      return { beam: 6.5 + size * 3, draft: 1.1 + size, height: 2.8 + size * 1.4, turningWidth: 10 + size * 3 };
    case "sail_boats":
      return { beam: 1.5 + size * 3.5, draft: 0.38 + size * 0.65, height: 2.25 + size * 3 };
    default:
      return { beam: 1.3 + size * 1.25, draft: 0.24 + size * 0.46, height: 0.7 + size * 0.8 };
  }
}
const sides: Point[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export function perimeter(e: PlacedElement): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < e.spanX; i++) result.push([e.gx + i, e.gz - 1], [e.gx + i, e.gz + e.spanZ]);
  for (let i = 0; i < e.spanZ; i++) result.push([e.gx - 1, e.gz + i], [e.gx + e.spanX, e.gz + i]);
  return result;
}
export const tileKey = (x: number, z: number) => (z + 32) * 64 + x + 32;
const point = (id: number): Point => [(id % 64) - 32, Math.floor(id / 64) - 32];
const inside = (x: number, z: number) => x >= -32 && x < 32 && z >= -32 && z < 32;
type PathMode = TravelMode | "walk";
export class TravelNetwork {
  readonly occupancy;
  readonly byId;
  readonly water;
  private crossings = new Map<number, number>();
  private walking = new Map<string, Set<string>>();
  private walkEdges = new Map<string, AccessStep[]>();
  private transfers = new Map<string, number>();
  constructor(private readonly state: GameState) {
    this.occupancy = buildOccupancyMap(state.elements);
    this.byId = new Map(state.elements.map((e) => [e.id, e]));
    this.water = buildWaterNavigation(state);
    for (const e of state.elements) {
      const d = ELEMENT_BY_ID[e.defId];
      if (d?.isRoadNetwork && networkDeckClass(d) !== "ground") {
        const axis = separatedDeckAxis(getNetworkConnMask(state.elements, e, this.occupancy, state));
        if (axis >= 0) this.crossings.set(tileKey(e.gx, e.gz), axis);
      }
    }
    for (const [key, span] of Object.entries(state.infrastructure?.spans ?? {}))
      if (span.run.startsWith("junction-")) {
        const [x, z] = key.split(",").map(Number);
        this.crossings.set(tileKey(x, z), span.axis === "x" ? 1 : 0);
      }
  }
  canUse(x: number, z: number, mode: PathMode, hull?: Hull): boolean {
    if (!inside(x, z)) return false;
    if (hull) return this.water.canPass(x, z, hull);
    const e = this.occupancy.get(x + "," + z),
      d = e && ELEMENT_BY_ID[e.defId];
    if (!e || !d) return false;
    if (mode === "rail") return !!d.isRailNetwork;
    if (mode === "walk") return !!d.isRoadNetwork && !["highways", "freeways", "over_passes"].includes(d.id);
    return !!d.isRoadNetwork && !PEDESTRIAN_IDS.has(d.id) && !e.pedestrianDeck && !d.isRailNetwork;
  }
  private access(e: PlacedElement) {
    let edges = this.walkEdges.get(e.id);
    if (!edges) {
      edges = parcelAccessSteps(e, this.occupancy, this.state);
      this.walkEdges.set(e.id, edges);
    }
    return edges;
  }
  connectors(e: PlacedElement, mode: PathMode, hull?: Hull): Point[] {
    if (mode === "walk")
      return this.access(e)
        .filter((p) => this.canUse(p.gx, p.gz, "walk"))
        .map((p) => [p.gx, p.gz]);
    if (
      (mode === "taxi" && !["taxi_ranks", "bus_stops"].includes(e.defId)) ||
      (mode === "bus" && e.defId === "bus_depots")
    ) {
      return this.access(e)
        .filter((p) => this.canUse(p.gx, p.gz, mode))
        .map((p) => [p.gx, p.gz]);
    }
    const candidates = perimeter(e);
    if (hull) {
      for (let x = e.gx; x < e.gx + e.spanX; x++)
        for (let z = e.gz; z < e.gz + e.spanZ; z++) candidates.push([x, z]);
    }
    return candidates.filter(([x, z]) => {
      if (!this.canUse(x, z, mode, hull)) return false;
      if (hull) return true;
      const dir = z < e.gz ? 0 : x >= e.gx + e.spanX ? 1 : z >= e.gz + e.spanZ ? 2 : 3;
      const side = PARCEL_SIDES[(dir + e.rotation) % 4],
        override = e.edgeOverrides?.[side];
      if (override === "closed") return false;
      if (override === "open") return true;
      if (mode === "rail" && ["train_depots", "train_stops"].includes(e.defId)) return side === "back";
      if (
        (mode === "bus" && e.defId === "bus_stops") ||
        (mode === "taxi" && ["taxi_ranks", "bus_stops"].includes(e.defId))
      )
        return side === "front";
      return true;
    });
  }
  path(starts: Point[], ends: Point[], mode: PathMode, hull?: Hull): Point[] | null {
    if (!starts.length || !ends.length) return null;
    const goals = new Set(ends.filter(([x, z]) => this.canUse(x, z, mode, hull)).map(([x, z]) => tileKey(x, z)));
    if (!goals.size) return null;
    // Keep arrival axis at a grade-separated crossing so distinct decks cannot exchange vehicles.
    const parents = new Int32Array(8192).fill(-2);
    const queue: number[] = [];
    for (const [x, z] of starts)
      if (this.canUse(x, z, mode, hull)) {
        const id = tileKey(x, z) * 2;
        if (parents[id] === -2) {
          parents[id] = -1;
          queue.push(id);
        }
      }
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head],
        cell = id >> 1,
        [x, z] = point(cell);
      if (goals.has(cell)) {
        const route: Point[] = [];
        for (let n = id; n >= 0; n = parents[n]) route.push(point(n >> 1));
        return route.reverse();
      }
      for (const [dx, dz] of sides) {
        const nx = x + dx,
          nz = z + dz;
        if (!this.canUse(nx, nz, mode, hull)) continue;
        if (!hull && mode !== "rail" && !roadPortOpen(this.state, x, z, dx, dz)) continue;
        if (hull && !this.water.canStep(x, z, nx, nz, hull)) continue;
        const axis = dx === 0 ? 0 : 1;
        if (!hull && parents[id] !== -1 && this.crossings.has(cell) && (id & 1) !== axis) continue;
        if (hull?.turningWidth && parents[id] !== -1 && (id & 1) !== axis && !this.canTurn(x, z, hull)) continue;
        const next = tileKey(nx, nz);
        const node = next * 2 + (hull?.turningWidth || (!hull && this.crossings.has(next)) ? axis : 0);
        if (parents[node] !== -2) continue;
        parents[node] = id;
        queue.push(node);
      }
    }
    return null;
  }
  private canTurn(x: number, z: number, hull: Hull): boolean {
    if (!hull.turningWidth) return true;
    if (this.water.cell(x, z).width < hull.turningWidth) return false;
    // A long hull sweeps the corners of its turning basin as well as its centreline.
    const radius = Math.max(1, Math.floor(hull.turningWidth / 8));
    return (
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].filter(([dx, dz]) => this.water.cell(x + dx * radius, z + dz * radius).depth >= hull.draft).length >= 3
    );
  }
  catchment(stop: PlacedElement): Set<string> {
    const cached = this.walking.get(stop.id);
    if (cached) return cached;
    const reached = new Set<string>([stop.id]),
      visited = new Set<number>();
    const queue: { site?: PlacedElement; x: number; z: number; steps: number }[] = [
      { site: stop, x: stop.gx, z: stop.gz, steps: 0 },
    ];
    function addSite(site: PlacedElement, steps: number) {
      if (reached.has(site.id)) return;
      reached.add(site.id);
      queue.push({ site, x: site.gx, z: site.gz, steps });
    }
    const addStreet = (x: number, z: number, steps: number) => {
      const key = tileKey(x, z);
      if (visited.has(key) || !this.canUse(x, z, "walk")) return;
      visited.add(key);
      queue.push({ x, z, steps });
    };
    for (let i = 0; i < queue.length; i++) {
      const { site, x, z, steps } = queue[i];
      if (steps >= 8) continue;
      if (site) {
        for (const step of this.access(site)) {
          if (ELEMENT_BY_ID[step.neighbor.defId]?.isRoadNetwork) addStreet(step.gx, step.gz, steps + 1);
          else if (!ELEMENT_BY_ID[step.neighbor.defId]?.isNetwork) addSite(step.neighbor, steps + 1);
        }
      } else {
        for (const [dx, dz] of sides) {
          const nx = x + dx,
            nz = z + dz,
            el = this.occupancy.get(nx + "," + nz);
          if (!el) continue;
          if (ELEMENT_BY_ID[el.defId]?.isRoadNetwork) addStreet(nx, nz, steps + 1);
          else if (!reached.has(el.id) && this.access(el).some((e) => e.gx === x && e.gz === z))
            addSite(el, steps + 1);
        }
      }
    }
    this.walking.set(stop.id, reached);
    return reached;
  }
  transferDistance(a: PlacedElement, b: PlacedElement): number {
    if (a.id === b.id) return 0;
    const key = [a.id, b.id].sort().join("|"),
      cached = this.transfers.get(key);
    if (cached !== undefined) return cached;
    const nearby = Math.abs(a.gx - b.gx) + Math.abs(a.gz - b.gz) <= 7;
    const trail = nearby ? this.path(this.connectors(a, "walk"), this.connectors(b, "walk"), "walk") : null;
    const distance = trail && trail.length <= 7 ? trail.length : Infinity;
    this.transfers.set(key, distance);
    return distance;
  }
  diagnose(start: Point[], finish: Point[], mode: TravelMode, hull?: Hull): { reason: string; blocker?: Point } {
    if (hull) {
      const narrow = { beam: 0.15, draft: 0.05, height: 0.05 },
        route = this.path(start, finish, mode, narrow);
      if (route)
        for (const [x, z] of route) {
          if (this.water.canPass(x, z, hull)) continue;
          const c = this.water.cell(x, z);
          const reason =
            c.depth < hull.draft
              ? "Deepen the channel"
              : c.width < hull.beam
                ? "Widen the channel"
                : "Raise the crossing or fit a lift span";
          return { reason: reason + " at " + x + ", " + z + ".", blocker: [x, z] };
        }
      if (hull.turningWidth) {
        const straight = this.path(start, finish, mode, { ...hull, turningWidth: undefined });
        if (straight)
          for (let i = 1; i < straight.length - 1; i++) {
            const [x, z] = straight[i],
              a = straight[i - 1],
              b = straight[i + 1];
            if (a[0] !== b[0] && a[1] !== b[1] && !this.canTurn(x, z, hull))
              return { reason: "Widen the turning basin at " + x + ", " + z + ".", blocker: [x, z] };
          }
      }
      return { reason: "Join the two bodies of water and leave a reachable berth at both ends." };
    }
    return {
      reason:
        mode === "rail"
          ? "Join the platforms and depot with continuous track."
          : "Connect the depot and the stops on a drivable street.",
    };
  }
}
let cached: { signature: string; network: TravelNetwork } | undefined;
const terrainCopies = new WeakMap<object, number>();
let nextTerrainCopy = 1;
export function travelSignature(s: GameState): string {
  const cells = s.infrastructure?.cells;
  if (cells && !terrainCopies.has(cells)) terrainCopies.set(cells, nextTerrainCopy++);
  const lifted =
    s.elements.some((e) => e.defId === "canal_boat_lift") &&
    (s.mode === "god" || (s.metrics.powerSupply > 0 && s.metrics.powerSupply >= s.metrics.powerDemand));
  return (
    [cells ? terrainCopies.get(cells) : 0, s.infrastructure?.revision ?? 0, Number(lifted)].join(".") +
    "|" +
    s.elements
      .map((e) =>
        [
          e.id,
          e.defId,
          e.gx,
          e.gz,
          e.spanX,
          e.spanZ,
          e.rotation,
          e.crossingAxis,
          Number(!!e.overWater),
          e.waterUnderlay?.defId,
          e.waterUnderlay?.level,
          e.level,
          Number(!!e.onFire),
          e.defId === "canal_boat_lift" ? Number(e.disrepair) : 0,
          Number(!!e.pedestrianDeck),
          JSON.stringify(e.edgeOverrides ?? {}),
        ].join(":"),
      )
      .join("/")
  );
}
export function getTravelNetwork(state: GameState, signature = travelSignature(state)): TravelNetwork {
  if (cached?.signature !== signature) cached = { signature, network: new TravelNetwork(state) };
  return cached.network;
}
