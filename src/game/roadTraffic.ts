import { ELEMENT_BY_ID } from "./catalog";
import { rushHourFactor } from "./cityDynamics";
import { roadSiteAccess } from "./parcelEdges";
import {corridorArt,corridorTransform} from "./roadCorridors";
import { separatedDeckAxis } from "./roadTopology";
import {
  buildOccupancyMap,
  getNetworkConnMask,
  networkDeckClass,
  PEDESTRIAN_IDS,
  type PlacedElement,
  type GameState,
} from "./simulation";
import { DIRECTIONS, roadPortOpen, surfaceTravelHeight, tileKey } from "./terrain";
import { travelSignature, type Point } from "./travelNetwork";

export interface RoadGate {
  siteId: string;
  gx: number;
  gz: number;
  dx: number;
  dz: number;
}
export interface RoadTrip {
  key: string;
  origin: RoadGate;
  destination: RoadGate;
  path: Point[];
}
export interface RoadTripNetwork {
  routes: RoadTrip[];
  tiles: Set<string>;
  siteIds: Set<string>;
}
interface RoadNode {
  gx: number;
  gz: number;
  gates: RoadGate[];
  exits: RoadNode[];
}
interface RoadTile {
  horizontal: RoadNode;
  vertical: RoadNode;
  axis?: "x" | "z";
}
const node = (gx: number, gz: number): RoadNode => ({ gx, gz, gates: [], exits: [] });
export function ambientTrafficFactor(hour: number) {
  return rushHourFactor(hour);
}

function pavementAtEdge(s: GameState, gx: number, gz: number, dx: number, dz: number) {
  const span = s.infrastructure?.spans[tileKey(gx, gz)];
  const axis = dx ? "x" : "z",
    sign = dx || dz;
  // Plan the connected, lowered road. Temporary lift openings queue approaching cars at runtime.
  if (span && !span.run.startsWith("junction-") && span.axis === axis)
    return span.direction === sign ? span.endHeight : span.startHeight;
  return surfaceTravelHeight(s, gx, gz, axis, sign > 0 ? 1 : 0);
}

function buildRoutes(s: GameState): RoadTripNetwork {
  const network: RoadTripNetwork = { routes: [], tiles: new Set(), siteIds: new Set() };
  const streets = new Map<string, RoadTile>(),
    starts = new Map<string, { gate: RoadGate; node: RoadNode }[]>();
  const occ = buildOccupancyMap(s.elements);
  for (const road of s.elements) {
    const d = ELEMENT_BY_ID[road.defId];
    if (
      !d?.isRoadNetwork ||
      d.isRailNetwork ||
      PEDESTRIAN_IDS.has(d.id) ||
      road.pedestrianDeck ||
      road.onFire ||
      road.disrepair
    )
      continue;
    const key = tileKey(road.gx, road.gz),
      span = s.infrastructure?.spans[key];
    if (
      span?.mode === "rail" ||
      span?.mode === "foot" ||
      (span?.shape === "lift" && span.lift === "open" && !span.end)
    )
      continue;
    const junction = span?.run.startsWith("junction-");
    const split =
      junction ||
      (networkDeckClass(d) !== "ground" &&
        separatedDeckAxis(getNetworkConnMask(s.elements, road, occ, s)) >= 0);
    const vertical = node(road.gx, road.gz),
      horizontal = split ? node(road.gx, road.gz) : vertical;
    const axis = span && !junction && !span.end && !split ? span.axis : undefined;
    streets.set(key, { horizontal, vertical, axis });
    for (const gate of roadSiteAccess(road, occ, s)) {
      const e = gate.site,
        def = ELEMENT_BY_ID[e.defId];
      if (!e.connected || e.disrepair || e.onFire || def.passiveNature || def.domain === "water") continue;
      const access: RoadGate = { siteId: e.id, gx: road.gx, gz: road.gz, dx: gate.dx, dz: gate.dz },
        n = gate.dx ? horizontal : vertical;
      n.gates.push(access);
      const entries = starts.get(e.id) ?? [];
      entries.push({ gate: access, node: n });
      starts.set(e.id, entries);
    }
  }
  for (const tile of streets.values()) {
    const { gx, gz } = tile.vertical;
    for (const [dx, dz] of DIRECTIONS) {
      const other = streets.get(tileKey(gx + dx, gz + dz));
      if (!other || !roadPortOpen(s, gx, gz, dx, dz)) continue;
      const axis = dx ? "x" : "z";
      if ((tile.axis && tile.axis !== axis) || (other.axis && other.axis !== axis)) continue;
      if (Math.abs(pavementAtEdge(s, gx, gz, dx, dz) - pavementAtEdge(s, gx + dx, gz + dz, -dx, -dz)) > 1.25)
        continue;
      // A permanently held signal admits its selected approach only. Automatic signals pause cars during motion.
      const light = s.infrastructure?.streets[tileKey(gx + dx, gz + dz)]?.signal;
      if ((light === "east" && !dx) || (light === "north" && !dz)) continue;
      (dx ? tile.horizontal : tile.vertical).exits.push(dx ? other.horizontal : other.vertical);
    }
  }
  const surveyed = new Set<RoadNode>(),
    pairs = new Set<string>();
  for (const [id, entries] of starts) {
    const full = entries.some((e) => !surveyed.has(e.node));
    const previous = new Map<RoadNode, RoadNode | null>(),
      entrances = new Map<RoadNode, RoadGate>(),
      queue: RoadNode[] = [];
    for (const e of entries)
      if (!previous.has(e.node)) {
        queue.push(e.node);
        previous.set(e.node, null);
        entrances.set(e.node, e.gate);
      }
    const reached = new Map<string, { gate: RoadGate; node: RoadNode }>();
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor];
      if (full) surveyed.add(at);
      for (const gate of at.gates)
        if (gate.siteId !== id && !reached.has(gate.siteId)) reached.set(gate.siteId, { gate, node: at });
      if (!full && reached.size >= 5) break;
      for (const next of at.exits)
        if (!previous.has(next)) {
          previous.set(next, at);
          queue.push(next);
        }
    }
    // Every origin gets local destinations. One survey per district also puts genuine longer trips on its trunk roads.
    const options = [...reached.values()];
    const chosen = new Set([0, Math.floor(options.length / 2), options.length - 1]);
    for (const index of chosen) {
      const end = options[index];
      if (!end) continue;
      let at = end.node;
      const path: Point[] = [[at.gx, at.gz]];
      while (previous.get(at)) {
        at = previous.get(at)!;
        path.push([at.gx, at.gz]);
      }
      const origin = entrances.get(at)!;
      path.reverse();
      const pair = JSON.stringify([
        origin.siteId,
        end.gate.siteId,
        origin.gx,
        origin.gz,
        origin.dx,
        origin.dz,
        end.gate.gx,
        end.gate.gz,
        end.gate.dx,
        end.gate.dz,
      ]);
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      network.routes.push({
        key: pair + ":" + path.map((p) => p.join(",")).join(";"),
        origin,
        destination: end.gate,
        path,
      });
      network.siteIds.add(origin.siteId);
      network.siteIds.add(end.gate.siteId);
      for (const [x, z] of path) network.tiles.add(tileKey(x, z));
    }
  }
  return network;
}
let last: { key: string; value: RoadTripNetwork } | undefined;
export function getRoadTripNetwork(s: GameState): RoadTripNetwork {
  // travelSignature includes gate orientation, parcel overrides, geometry and infrastructure revision.
  const key =
    travelSignature(s) +
    "|" +
    s.elements.map((e) => (e.connected ? "1" : "0") + (e.disrepair ? "1" : "0")).join("");
  if (last?.key !== key) last = { key, value: buildRoutes(s) };
  return last.value;
}

export interface TripPoint {
  x: number;
  z: number;
  tile: Point;
}
export function roadTripPoints(trip: RoadTrip,occupancy?:ReadonlyMap<string,PlacedElement>): TripPoint[] {
  const { origin, destination, path } = trip;
  const gatePoint = (g: RoadGate): TripPoint => ({
    x: g.gx + 0.5 + g.dx * 0.495,
    z: g.gz + 0.5 + g.dz * 0.495,
    tile: [g.gx, g.gz],
  });
  const points = [gatePoint(origin)];
  const lane = 0.11;
  for (let i = 0; i < path.length; i++) {
    const [gx, gz] = path[i],
      before = path[i - 1],
      after = path[i + 1];
    const inX = before ? gx - before[0] : -origin.dx,
      inZ = before ? gz - before[1] : -origin.dz;
    const outX = after ? after[0] - gx : destination.dx,
      outZ = after ? after[1] - gz : destination.dz;
    let ox=-((inZ+outZ)*lane)/2,oz=((inX+outX)*lane)/2;
    const road=occupancy?.get(tileKey(gx,gz)),corridor=road&&occupancy&&corridorArt(road,occupancy);
    if(corridor){if(corridor.axis==="x")oz=corridorTransform(corridor,ox*4,oz*4)/4;else ox=corridorTransform(corridor,oz*4,ox*4)/4;}
    points.push({
      x:gx+.5+ox,
      z:gz+.5+oz,
      tile: [gx, gz],
    });
  }
  points.push(gatePoint(destination));
  return points;
}

export function trafficFleetTarget(
  network: RoadTripNetwork,
  population: number,
  trafficDemand: number,
  limit: number,
  hour: number,
) {
  if (!network.routes.length) return 0;
  // Demand already includes the daily cycle. The small-town floor also allows a service call before residents arrive.
  const floor = ambientTrafficFactor(hour) >= 0.6 ? 1 : 0;
  const estimated = population > 0 ? Math.ceil(Math.sqrt(Math.max(0, trafficDemand)) * 0.77) : floor;
  return Math.min(
    limit,
    Math.max(floor, Math.round(estimated)),
    Math.max(1, Math.ceil(network.tiles.size * 0.65)),
  );
}
/** Distance budget along one lane segment. The same stop line serves signal and bridge waits. */
export function advanceCarSegment(
  progress: number,
  velocity: number,
  length: number,
  cruise: number,
  room: number,
  dt: number,
  grip: number,
) {
  const target = Math.min(cruise, Math.sqrt(2 * 5 * Math.max(0, room)));
  const change = (target < velocity ? 5.8 : 2.6) * dt * grip;
  const speed = velocity + Math.max(-change, Math.min(change, target - velocity));
  const distance = Math.min(Math.max(0, room), dt * speed);
  return {
    progress: Math.min(1, progress + distance / length),
    velocity: distance + 0.00001 < dt * speed ? 0 : speed,
  };
}

/** Small villages send an occasional service call. Larger districts can release cars from independent gates. */
export function departureInterval(target: number, hourlyDemand: number, hour: number) {
  const daily = ambientTrafficFactor(hour);
  const baseDemand = Math.max(1, hourlyDemand / daily);
  const baseInterval = Math.max(target <= 1 ? 2.4 : 0.3, Math.min(8, 8 / Math.sqrt(baseDemand)));
  return baseInterval / daily;
}
