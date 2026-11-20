import { ELEMENT_BY_ID } from "./catalog";
import type { GameState, PlacedElement } from "./simulation";
import {
  applyInfrastructureStroke,
  registerRoadDemand,
  requestVesselPassage,
  roadTravelOpen,
  type GridPoint,
  type InfrastructureTool,
} from "./terrain";
import {
  getTravelNetwork,
  harborIds,
  marine,
  perimeter,
  tileKey,
  travelSignature,
  TravelNetwork,
  vesselHull,
  vesselIds,
  waterHull,
  type Hull,
  type Point,
  type TravelMode,
} from "./travelNetwork";

export type { Point, TravelMode };
export const modeNames: Record<TravelMode, string> = {
  bus: "Bus",
  rail: "Train",
  taxi: "Taxi",
  gondola: "Water taxi",
  ferry: "Passenger ferry",
  freight: "Freight barge",
};
type Passenger = {
  destination: string;
  count: number;
  boarded: number;
  waited?: number;
  readyAt?: number;
  transfer?: boolean;
};
interface Delivery {
  time: number;
  count: number;
  stop: string;
  wait: number;
  freight: boolean;
}
export interface Run {
  id: string;
  mode: TravelMode;
  depot: string;
  stops: string[];
  enabled: boolean;
  interval: number;
  schedule: "all" | "day" | "night";
  next: number;
  at?: string;
  path: Point[];
  progress: number;
  dwell: number;
  position?: Point;
  heading: number;
  riders: Passenger[];
  delivered: number;
  departures: number;
  callsSinceDepot?: number;
  lastBoarding?: Record<string, number>;
  waiting?: Record<string, { people: number; since: number }>;
  status: string;
  blocker?: Point;
  blocked: boolean;
  plannedAt?: number;
  demandScale: number;
  version?: number;
}
export interface Voyage {
  origin: string;
  position: Point;
  heading: number;
  path: Point[];
  progress: number;
  dwell: number;
  target?: Point;
  returnHome: boolean;
  holdAtHome?: boolean;
  moored: boolean;
  version?: number;
  status: string;
  sequence: number;
}
export interface MobilityState {
  lines: Run[];
  voyages: Record<string, Voyage>;
  deliveries: Delivery[];
  transfers: Record<string, Passenger[]>;
  demand: number;
  nextId: number;
  lastFleetCheck?: number;
}
export function mobilityOf(s: GameState): MobilityState {
  return (s.mobility ??= { lines: [], voyages: {}, deliveries: [], transfers: {}, demand: 1, nextId: 1 });
}
export function eligibleDepots(s: GameState, mode: TravelMode): PlacedElement[] {
  const allowed =
    mode === "rail"
      ? ["train_depots"]
      : mode === "bus"
        ? ["bus_depots"]
        : mode === "taxi"
          ? ["taxi_depots"]
          : mode === "freight"
            ? ["shipyards", "docks", "ship_building_areas", "freight_rail_terminal"]
            : Array.from(harborIds);
  return s.elements.filter((e) => allowed.includes(e.defId));
}
export function eligibleStops(s: GameState, mode: TravelMode): PlacedElement[] {
  if (mode === "taxi")
    return s.elements.filter(
      (e) =>
        e.defId === "taxi_ranks" ||
        e.defId === "bus_stops" ||
        !!ELEMENT_BY_ID[e.defId]?.jobs ||
        !!ELEMENT_BY_ID[e.defId]?.popBase,
    );
  const allowed =
    mode === "bus"
      ? ["bus_stops"]
      : mode === "rail"
        ? ["train_stops"]
        : mode === "freight"
          ? ["shipyards", "docks", "ship_building_areas", "ferry_exchange"]
          : ["docks", "ferry_landings", "ferry_exchange", "ocean_habitat_ring"];
  return s.elements.filter((e) => allowed.includes(e.defId));
}
const hullFor = (mode: TravelMode) => (marine(mode) ? waterHull[mode as keyof typeof waterHull] : undefined);
const allStops = (line: Run) => [line.depot, ...line.stops.filter((id) => id !== line.depot)];
const legOptions = (net: TravelNetwork, stop: PlacedElement, mode: TravelMode) =>
  net.connectors(stop, mode, hullFor(mode));
// A depot can face two disconnected streets or basins. Keep the same arrival berth
// for the next departure so a route cannot cross a building between legs.
function circuitStart(net: TravelNetwork, mode: TravelMode, route: string[]) {
  const stops = route.map((id) => net.byId.get(id)).map((e) => (e ? legOptions(net, e, mode) : []));
  let failedLeg = 1;
  for (const departure of stops[0]) {
    let start = departure,
      complete = true;
    for (let i = 1; i < stops.length; i++) {
      const path = net.path([start], i === stops.length - 1 ? [departure] : stops[i], mode, hullFor(mode));
      if (!path) {
        failedLeg = Math.max(failedLeg, i);
        complete = false;
        break;
      }
      start = path[path.length - 1];
    }
    if (complete) return { departure, failedLeg };
  }
  return { departure: undefined, failedLeg };
}
function servingNow(s: GameState, l: Run) {
  if (!l.enabled || l.blocked) return false;
  const night = s.timeOfDay < 6 || s.timeOfDay >= 21;
  return l.at !== l.depot || l.schedule === "all" || (night ? l.schedule === "night" : l.schedule === "day");
}
export function addLine(s: GameState, mode: TravelMode, depot: string, stops: string[]): string {
  if (!eligibleDepots(s, mode).some((e) => e.id === depot))
    throw new Error("Choose a depot or staffed landing for this service.");
  const ordered = [...new Set(stops)],
    allowed = new Set(eligibleStops(s, mode).map((e) => e.id));
  if (ordered.some((id) => !allowed.has(id)) || ordered.length < 2)
    throw new Error("Choose two different passenger stops or freight berths.");
  const m = mobilityOf(s),
    net = getTravelNetwork(s);
  const route = [depot, ...ordered.filter((id) => id !== depot), depot];
  const { departure, failedLeg } = circuitStart(net, mode, route);
  if (!departure) {
    const previous = net.byId.get(route[failedLeg - 1])!,
      next = net.byId.get(route[failedLeg])!;
    throw new Error(net.diagnose(perimeter(previous), perimeter(next), mode, hullFor(mode)).reason);
  }
  const id = "line-" + m.nextId++;
  m.lines.push({
    id,
    mode,
    depot,
    stops: ordered,
    enabled: true,
    interval: 8,
    schedule: "all",
    next: 1,
    at: depot,
    path: [],
    progress: 0,
    dwell: 0.5,
    position: departure,
    heading: 0,
    riders: [],
    delivered: 0,
    departures: 0,
    status: "Boarding at the depot",
    blocked: false,
    demandScale: 1,
  });
  return id;
}
export function autoStops(s: GameState, mode: TravelMode, depot: string): string[] {
  const net = getTravelNetwork(s),
    origin = net.byId.get(depot);
  if (!origin) return [];
  const a = legOptions(net, origin, mode);
  const candidates = eligibleStops(s, mode)
    .map((e) => ({ id: e.id, path: net.path(a, legOptions(net, e, mode), mode, hullFor(mode)) }))
    .filter((item) => item.path)
    .sort((x, y) => x.path!.length - y.path!.length);
  const result: string[] = [];
  for (const { id } of candidates) {
    const route = [depot, ...result.filter((s) => s !== depot), ...(id === depot ? [] : [id]), depot];
    if (circuitStart(net, mode, route).departure) result.push(id);
    if (result.length === 6) break;
  }
  return result;
}
const capacities: Record<TravelMode, number> = { bus: 26, rail: 72, taxi: 4, ferry: 45, gondola: 8, freight: 24 };
const speeds: Record<TravelMode, number> = {
  bus: 1.15,
  rail: 1.9,
  taxi: 1.65,
  ferry: 1,
  gondola: 0.82,
  freight: 0.66,
};
function localDemand(net: TravelNetwork, stop: PlacedElement): number {
  let result = 0;
  for (const id of net.catchment(stop)) {
    const e = net.byId.get(id);
    if (!e) continue;
    const d = ELEMENT_BY_ID[e.defId];
    result +=
      ((d.popBase ?? 0) * 0.6 + (d.jobs ?? 0) * 0.14 + (d.education ?? 0) * 0.03 + (d.food ?? 0) * 0.035) *
      Math.sqrt(e.level);
  }
  return result;
}
function transferAt(s: GameState, m: MobilityState, l: Run, here: PlacedElement, net: TravelNetwork) {
  if (l.mode === "freight") return undefined;
  for (const other of m.lines) {
    if (other === l || !servingNow(s, other) || other.mode === "freight") continue;
    for (const id of other.stops) {
      const pickup = net.byId.get(id);
      if (!pickup) continue;
      const distance = net.transferDistance(here, pickup);
      if (!Number.isFinite(distance)) continue;
      const destination = other.stops.find(
        (target) => target !== id && !l.stops.includes(target) && target !== here.id,
      );
      if (destination) return { pickup: id, destination, distance };
    }
  }
}
function completeStop(s: GameState, m: MobilityState, l: Run, stop: PlacedElement, net: TravelNetwork) {
  const arrived = l.riders.filter((r) => r.destination === stop.id);
  l.riders = l.riders.filter((r) => r.destination !== stop.id);
  for (const r of arrived) {
    // A transfer is one ongoing passenger journey; record arrival once at the final stop.
    if (r.transfer) {
      const transfer = transferAt(s, m, l, stop, net);
      if (transfer) {
        const readyAt = s.activePlaySec + transfer.distance / 1.4;
        (m.transfers[transfer.pickup] ??= []).push({
          ...r,
          destination: transfer.destination,
          boarded: readyAt,
          readyAt,
          transfer: false,
        });
        continue;
      }
    }
    l.delivered += r.count;
    m.deliveries.push({
      time: s.activePlaySec,
      count: r.count,
      stop: stop.id,
      wait: Math.max(0, r.waited ?? 0),
      freight: l.mode === "freight",
    });
  }
  if (!l.stops.includes(stop.id)) return;
  if (l.mode === "taxi" && (l.callsSinceDepot ?? 0) >= l.stops.length && !l.riders.length) return;
  const waiting = l.mode === "freight" ? [] : (m.transfers[stop.id] ?? []);
  let room = capacities[l.mode] - l.riders.reduce((n, r) => n + r.count, 0);
  for (const r of waiting) {
    if (!room || !l.stops.includes(r.destination) || (r.readyAt ?? 0) > s.activePlaySec) continue;
    const n = Math.min(room, r.count);
    l.riders.push({ ...r, count: n, waited: (r.waited ?? 0) + Math.max(0, s.activePlaySec - r.boarded) });
    r.count -= n;
    room -= n;
  }
  if (l.mode !== "freight") m.transfers[stop.id] = waiting.filter((r) => r.count > 0);
  function demand(at: PlacedElement) {
    if (l.mode !== "freight") return localDemand(net, at);
    let goods = 0;
    for (const id of net.catchment(at)) {
      const e = net.byId.get(id),
        a = s.economy?.sites[id];
      if (!e?.connected || e.onFire || !a) continue;
      goods += Math.max(0, a.exportRate) + Math.max(0, a.yieldRate) + Math.max(0, a.retail);
    }
    return goods;
  }
  const targets = l.stops.filter((id) => id !== stop.id && net.byId.has(id) && demand(net.byId.get(id)!) > 0);
  if (!targets.length || room <= 0) return;
  const busy = l.mode !== "freight" && (s.timeOfDay < 5 || s.timeOfDay >= 22) ? 0.38 : 1;
  // Residents arrive between departures. Retain anyone left behind and the time their queue began.
  l.lastBoarding ??= {};
  l.waiting ??= {};
  const previous = l.lastBoarding[stop.id] ?? Math.max(0, s.activePlaySec - 8);
  const elapsed = Math.max(0, s.activePlaySec - previous);
  l.lastBoarding[stop.id] = s.activePlaySec;
  const competition = Math.max(
    1,
    m.lines.filter((line) => servingNow(s, line) && line.stops.includes(stop.id) && line.mode === l.mode).length,
  );
  const rate =
    (demand(stop) *
      busy *
      l.demandScale *
      (l.mode === "freight" ? 1 : m.demand * Math.min(2, Math.sqrt(Math.max(s.population, 0)) / 7))) /
    10 /
    competition;
  const queue = (l.waiting[stop.id] ??= { people: 0, since: previous + elapsed * 0.5 });
  if (queue.people < 1) queue.since = previous + elapsed * 0.5;
  queue.people = Math.min(capacities[l.mode] * 5, queue.people + rate * elapsed);
  const count = Math.min(room, Math.floor(queue.people));
  if (count <= 0) return;
  const waited = Math.max(0, s.activePlaySec - queue.since);
  queue.people -= count;
  const destination = targets[l.departures % targets.length];
  const dest = net.byId.get(destination)!;
  const transferCount = transferAt(s, m, l, dest, net) ? Math.floor(count / 4) : 0;
  if (transferCount)
    l.riders.push({ destination, boarded: s.activePlaySec, waited, count: transferCount, transfer: true });
  l.riders.push({ destination, boarded: s.activePlaySec, waited, count: count - transferCount });
}
function interpolate(path: Point[], progress: number): Point {
  const i = Math.min(path.length - 1, Math.floor(progress)),
    a = path[i],
    b = path[Math.min(i + 1, path.length - 1)],
    p = progress - i;
  return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
}
type MovingUnit = { path: Point[]; progress: number; position?: Point; heading: number };
// A boat following another hull in the channel leaves room between their bows.
function hasWaterTrafficAhead(
  s: GameState,
  unit: MovingUnit,
  x: number,
  z: number,
  dx: number,
  dz: number,
): boolean {
  const m = s.mobility;
  if (!m) return false;
  return [
    ...m.lines.filter((l) => l.enabled && marine(l.mode)),
    ...Object.values(m.voyages).filter((v) => !v.moored),
  ].some((other) => {
    if (other === unit || !other.position || other.path.length < 2) return false;
    const p = Math.floor(other.progress),
      a = other.path[p],
      b = other.path[p + 1];
    if (!b || b[0] - a[0] !== dx || b[1] - a[1] !== dz) return false;
    const rx = other.position[0] - x,
      rz = other.position[1] - z,
      along = rx * dx + rz * dz;
    return along > 0.01 && along < 1.15 && Math.abs(rx * dz - rz * dx) < 0.35;
  });
}
function advance(
  s: GameState,
  unit: MovingUnit,
  ds: number,
  mode: TravelMode,
  hull?: Hull,
): "moving" | "arrived" | "waiting" | "following" {
  if (unit.path.length < 2) return "arrived";
  const end = unit.path.length - 1,
    wanted = Math.min(end, unit.progress + ds),
    first = Math.floor(unit.progress);
  for (let i = first; i < Math.ceil(wanted); i++) {
    const a = unit.path[i],
      b = unit.path[i + 1];
    if (!b) break;
    if (hull) {
      const [x, z] = interpolate(unit.path, Math.max(i, unit.progress));
      if (hasWaterTrafficAhead(s, unit, x, z, b[0] - a[0], b[1] - a[1])) {
        unit.progress = Math.max(unit.progress, i);
        unit.position = interpolate(unit.path, unit.progress);
        return "following";
      }
    }
    if (mode === "bus" || mode === "taxi")
      registerRoadDemand(s, b[0], b[1], b[0] - a[0], b[1] - a[1], ds / speeds[mode]);
    const ok = hull
      ? requestVesselPassage(s, b[0], b[1], hull.height)
      : roadTravelOpen(s, b[0], b[1], b[0] - a[0], b[1] - a[1]);
    if (!ok) {
      unit.progress = Math.max(unit.progress, i);
      unit.position = interpolate(unit.path, unit.progress);
      return "waiting";
    }
    unit.heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  unit.progress = wanted;
  unit.position = interpolate(unit.path, wanted);
  return wanted >= end ? "arrived" : "moving";
}
function stepLine(s: GameState, m: MobilityState, l: Run, seconds: number, net: TravelNetwork, version: number) {
  if (!l.enabled) {
    l.status = "Service paused";
    return;
  }
  const route = allStops(l),
    dest = net.byId.get(route[l.next % route.length]);
  if (!dest || !net.byId.has(l.depot) || l.stops.some((id) => !net.byId.has(id))) {
    l.blocked = true;
    l.status = "A stop was removed. Edit the line to replace it.";
    return;
  }
  const depot = net.byId.get(l.depot)!;
  if (depot.onFire || dest.onFire) {
    l.blocked = true;
    l.path = [];
    l.status = "Service suspended for a fire at " + ELEMENT_BY_ID[(depot.onFire ? depot : dest).defId].name;
    return;
  }
  if (l.dwell > 0) {
    l.dwell -= seconds;
    return;
  }
  const night = s.timeOfDay < 6 || s.timeOfDay >= 21;
  if (l.at === l.depot && ((night && l.schedule === "day") || (!night && l.schedule === "night"))) {
    l.status = "Waiting for service hours";
    return;
  }
  if (
    (l.version !== version || !l.path.length) &&
    (!l.blocked || l.version !== version || s.activePlaySec - (l.plannedAt ?? 0) > 8)
  ) {
    l.plannedAt = s.activePlaySec;
    l.version = version;
    const hull = hullFor(l.mode),
      start: Point = l.position
        ? [Math.round(l.position[0]), Math.round(l.position[1])]
        : legOptions(net, net.byId.get(l.depot)!, l.mode)[0];
    const ends = legOptions(net, dest, l.mode);
    const starts = start ? [start] : [];
    const path = net.path(starts, ends, l.mode, hull);
    if (!path) {
      const issue = net.diagnose(starts, perimeter(dest), l.mode, hull);
      l.status = issue.reason;
      l.blocker = issue.blocker;
      l.blocked = true;
      l.path = [];
      return;
    }
    l.path = path;
    l.progress = 0;
    l.blocked = false;
    l.blocker = undefined;
    l.at = undefined;
  }
  if (l.blocked || !l.path.length) return;
  const reached = advance(
    s,
    l,
    seconds * speeds[l.mode] * (s.weather === "storm" ? 0.78 : 1),
    l.mode,
    hullFor(l.mode),
  );
  if (reached === "following") {
    l.status = "Following a vessel through the channel";
    return;
  }
  if (reached === "waiting") {
    l.status = marine(l.mode) ? "Waiting for the crossing to open" : "Waiting at a signal or crossing";
    return;
  }
  if (reached === "moving") {
    l.status = "En route to " + ELEMENT_BY_ID[dest.defId].name;
    return;
  }
  completeStop(s, m, l, dest, net);
  l.departures++;
  l.at = dest.id;
  l.next = (l.next + 1) % route.length;
  if (l.mode === "taxi") {
    // A hired cab drops passengers at their destination before taking another call.
    l.callsSinceDepot = dest.id === l.depot ? 0 : (l.callsSinceDepot ?? 0) + 1;
    const passengerDrop = l.riders.find((r) => r.destination !== dest.id);
    if (passengerDrop) l.next = route.indexOf(passengerDrop.destination);
    else if (l.callsSinceDepot >= l.stops.length + 1) l.next = 0;
    else {
      const recent = l.lastBoarding ?? {};
      const pickup = l.stops
        .filter((id) => id !== dest.id)
        .sort(
          (a, b) =>
            (s.activePlaySec - (recent[b] ?? 0)) * localDemand(net, net.byId.get(b)!) -
            (s.activePlaySec - (recent[a] ?? 0)) * localDemand(net, net.byId.get(a)!),
        )[0];
      if (pickup) l.next = route.indexOf(pickup);
    }
  }
  l.dwell = dest.id === l.depot ? l.interval * (night ? 1.8 : 1) : 1.75;
  l.path = [];
  l.progress = 0;
  l.status = dest.id === l.depot ? "At the depot" : "Boarding at " + ELEMENT_BY_ID[dest.defId].name;
}

const portCache = new WeakMap<TravelNetwork, Map<string, boolean>>();
export function hasNavigableHarbor(s: GameState, e: PlacedElement): boolean {
  const ports = s.elements.filter((p) => harborIds.has(p.defId));
  if (!ports.length) return false;
  const net = getTravelNetwork(s),
    cache = portCache.get(net) ?? new Map<string, boolean>();
  portCache.set(net, cache);
  if (cache.has(e.id)) return cache.get(e.id)!;
  const hull = vesselHull(e),
    a = net.connectors(e, "ferry", hull);
  const ok = ports.some((p) => !!net.path(a, net.connectors(p, "ferry", hull), "ferry", hull));
  cache.set(e.id, ok);
  return ok;
}
export function dispatchVessel(s: GameState, id: string, action: "sail" | "recall" | "moor", to?: Point): void {
  const m = mobilityOf(s),
    e = s.elements.find((e) => e.id === id);
  if (!e || !vesselIds.has(e.defId)) return;
  const v = (m.voyages[id] ??= newVoyage(e));
  v.moored = action === "moor";
  v.returnHome = action === "recall";
  v.holdAtHome = action === "recall";
  v.target = to;
  v.dwell = 0;
  v.path = [];
  v.status = v.moored ? "Holding position" : "Preparing to sail";
}
function newVoyage(e: PlacedElement): Voyage {
  return {
    origin: e.id,
    position: [e.gx + (e.spanX - 1) / 2, e.gz + (e.spanZ - 1) / 2],
    heading: (e.rotation * Math.PI) / 2,
    path: [],
    progress: 0,
    dwell: 1,
    moored: false,
    returnHome: false,
    sequence: 0,
    status: "At berth",
  };
}
function stepVoyage(s: GameState, e: PlacedElement, v: Voyage, dt: number, net: TravelNetwork, version: number) {
  if (v.moored) return;
  if (v.dwell > 0 && v.version === version) {
    v.dwell -= dt;
    return;
  }
  if (s.mode !== "god" && !hasNavigableHarbor(s, e)) {
    v.status = "Needs a reachable home port";
    v.dwell = 8;
    v.version = version;
    return;
  }
  const hull = vesselHull(e),
    home = net.connectors(e, "ferry", hull),
    a: Point = [Math.round(v.position[0]), Math.round(v.position[1])];
  if (!v.path.length || v.version !== version) {
    const start = net.canUse(a[0], a[1], "ferry", hull) ? [a] : v.sequence === 0 ? home : [];
    const goals: Point[][] = [];
    if (v.returnHome) goals.push(home);
    else if (v.target) goals.push([v.target]);
    else {
      const inland = s.elements.filter((p) =>
        [
          "docks",
          "ferry_landings",
          "canals",
          "rivers",
          "wide_rivers",
          "lakes",
          "naval_base",
          "shipyards",
          "submarine_base",
        ].includes(p.defId),
      );
      const coast: Point[] = [
        [-30, -25],
        [-30, 12],
        [-20, 30],
        [16, 30],
        [30, 12],
        [30, -18],
        [8, -30],
        [-12, -30],
        [36,0],[44,35],[16,38],[-75,28],[-82,-39],[-23,-65],[21,-82],[79,-29],[83,72],
      ];
      // Cycle inland harbors, drawn channels and the open-ocean ring, interspersed with home calls.
      const destinations: Point[][] = inland.map((p) => net.connectors(p, "ferry", hull));
      const edits = Object.keys(s.infrastructure?.cells ?? {});
      for (const key of edits) {
        const [x, z] = key.split(",").map(Number);
        if (Number.isFinite(z) && net.canUse(x, z, "ferry", hull)) destinations.push([[x, z]]);
      }
      destinations.push(...coast.map((p) => [p]));
      if (destinations.length) {
        for (let i = 0; i < Math.min(8, destinations.length); i++)
          goals.push(destinations[(v.sequence + i) % destinations.length]);
      }
      if (!goals.length) goals.push(home);
    }
    let path: Point[] | null = null;
    for (const goal of goals) {
      const valid = goal.filter(
        ([x, z]) =>
          net.canUse(x, z, "ferry", hull) &&
          (v.returnHome || !!v.target || Math.abs(x - a[0]) + Math.abs(z - a[1]) > 2),
      );
      if (valid.length && (path = net.path(start, valid, "ferry", hull))) break;
    }
    v.version = version;
    v.path = path ?? [];
    v.progress = 0;
    v.sequence++;
    if (!path) {
      v.status = "Waiting for navigable water with enough width, depth and bridge clearance";
      v.dwell = 8;
      return;
    }
  }
  const result = advance(
    s,
    v,
    dt * (e.defId === "speed_boats" ? 1.8 : e.defId === "aircraft_carriers" ? 0.46 : 0.8),
    "ferry",
    hull,
  );
  if (result === "following") {
    v.status = "Following traffic in the channel";
    return;
  }
  if (result === "waiting") {
    v.status = "Waiting for a bridge or lock";
    return;
  }
  v.status =
    e.defId === "submarines" &&
    net.water.cell(Math.round(v.position[0]), Math.round(v.position[1])).depth > hull.draft + 1.5
      ? "Submerged"
      : "Under way";
  if (result === "arrived") {
    v.path = [];
    v.dwell = 4;
    v.target = undefined;
    if (v.returnHome) {
      v.moored = Boolean(v.holdAtHome);
      v.returnHome = false;
      v.status = v.moored ? "Moored at home" : "Home port call";
    } else {
      v.status = "At waypoint";
      if (v.sequence % 4 === 0) v.returnHome = true;
    }
  }
}
// A compact revision on each line keeps human-readable paths in saves without duplicating the whole map signature.
let previousSignature = "",
  revision = 0;
export function stepMobility(s: GameState, dt: number): boolean {
  const vessels = s.elements.filter((e) => vesselIds.has(e.defId));
  if (!s.mobility && !vessels.length) return false;
  const m = mobilityOf(s);
  const signature = travelSignature(s);
  if (previousSignature !== signature) {
    previousSignature = signature;
    revision++;
  }
  const net = getTravelNetwork(s, signature);
  for (const l of m.lines) stepLine(s, m, l, dt, net, revision);
  for (const e of vessels) {
    const v = (m.voyages[e.id] ??= newVoyage(e));
    stepVoyage(s, e, v, dt, net, revision);
  }
  const current = new Set(vessels.map((e) => e.id));
  for (const id of Object.keys(m.voyages)) if (!current.has(id)) delete m.voyages[id];
  m.deliveries = m.deliveries.filter((r) => s.activePlaySec - r.time <= 120);
  return Math.floor(s.activePlaySec) !== Math.floor(s.activePlaySec - dt);
}
export interface TransitReport {
  score: number;
  served: number;
  freight: number;
  coverage: number;
  wait: number;
  reliability: number;
  pressure: number;
  reachable: Set<string>;
  districts: Map<string, string>;
}
export function transitReadout(s: GameState): TransitReport {
  const m = s.mobility,
    lines = m?.lines.filter((l) => servingNow(s, l)) ?? [];
  const reachable = new Set<string>(),
    samples = m?.deliveries.filter((r) => s.activePlaySec - r.time <= 120) ?? [];
  let served = 0,
    freight = 0,
    sumWait = 0;
  for (const sample of samples) {
    if (sample.freight) freight += sample.count;
    else {
      served += sample.count;
      sumWait += sample.wait * sample.count;
    }
  }
  const pressure = Math.max(0, Math.ceil(Math.sqrt(s.population) * 0.7 * (m?.demand ?? 1)));
  const districts = new Map<string, string>();
  let potential = 0,
    covered = 0;
  if (lines.length) {
    const net = getTravelNetwork(s);
    const passenger = lines.filter((l) => l.mode !== "freight");
    const groups = passenger.map((l) => l.id);
    for (let i = 0; i < passenger.length; i++)
      for (let j = 0; j < i; j++) {
        if (groups[i] === groups[j]) continue;
        const connected = passenger[i].stops.some((id) =>
          passenger[j].stops.some((other) => {
            const a = net.byId.get(id),
              b = net.byId.get(other);
            return a && b && Number.isFinite(net.transferDistance(a, b));
          }),
        );
        if (connected) {
          const absorbed = groups[i];
          for (let k = 0; k < groups.length; k++) if (groups[k] === absorbed) groups[k] = groups[j];
        }
      }
    for (let i = 0; i < passenger.length; i++)
      for (const id of passenger[i].stops) {
        const stop = net.byId.get(id);
        if (stop)
          for (const e of net.catchment(stop)) {
            reachable.add(e);
            districts.set(e, groups[i]);
          }
      }
    for (const e of s.elements) {
      const d = ELEMENT_BY_ID[e.defId];
      const weight = ((d?.popBase ?? 0) + (d?.jobs ?? 0)) * e.level;
      potential += weight;
      if (reachable.has(e.id)) covered += weight;
    }
  }
  const coverage = potential ? Math.round((100 * covered) / potential) : 0;
  const scheduled =
    m?.lines.filter((l) => l.mode !== "freight" && l.enabled && servingNow(s, { ...l, blocked: false })).length ??
    0;
  const reliability = scheduled
    ? Math.round((100 * lines.filter((l) => l.mode !== "freight").length) / scheduled)
    : 0;
  const wait = served ? sumWait / served : 0;
  const score = served
    ? Math.round(
        40 * Math.min(1, served / Math.max(1, pressure)) +
          0.25 * coverage +
          0.2 * reliability +
          15 * Math.max(0, 1 - wait / 45),
      )
    : 0;
  return { score, served, freight, coverage, wait, reliability, pressure, reachable, districts };
}
export function reliefAtStops(s: GameState): Map<string, number> {
  const relief = new Map<string, number>();
  for (const r of s.mobility?.deliveries ?? [])
    if (s.activePlaySec - r.time <= 120)
      relief.set(r.stop, (relief.get(r.stop) ?? 0) + r.count * (r.freight ? 0.25 : 1));
  return relief;
}
export function transitLayer(s: GameState): { gx: number; gz: number; intensity: number }[] {
  const cells = new Map<number, { gx: number; gz: number; intensity: number }>();
  for (const l of s.mobility?.lines ?? []) {
    for (const [gx, gz] of l.path) cells.set(tileKey(gx, gz), { gx, gz, intensity: l.blocked ? -0.8 : 0.85 });
    if (l.blocker) {
      const [gx, gz] = l.blocker;
      cells.set(tileKey(gx, gz), { gx, gz, intensity: -1 });
    }
  }
  return [...cells.values()];
}

/** Examine the same hulls and routes used by live traffic before the player approves an edit. */
export function previewWaterPassage(s: GameState, tool: InfrastructureTool, points: GridPoint[]): string[] {
  if (
    !["canal", "river", "bridge", "aqueduct", "lock", "dam", "pond", "bay", "erase", "peninsula"].includes(
      tool.kind,
    )
  )
    return [];
  const proposed = structuredClone(s);
  const plan = applyInfrastructureStroke(proposed, tool, points);
  if (!plan.valid) return [];
  const net = new TravelNetwork(proposed);
  const focus = points[Math.floor(points.length / 2)];
  let wet = plan.points.map((p) => ({ p, c: net.water.cell(p.gx, p.gz) })).filter((t) => t.c.depth > 0.05);
  if (tool.kind === "bridge") wet = wet.filter((t) => !proposed.infrastructure?.spans[t.p.gx + "," + t.p.gz]?.end);
  wet.sort(
    (a, b) => Math.hypot(a.p.gx - focus.gx, a.p.gz - focus.gz) - Math.hypot(b.p.gx - focus.gx, b.p.gz - focus.gz),
  );
  const messages: string[] = [];
  if (wet.length) {
    const { c } = wet[0];
    const hulls: [string, Hull][] = [
      ["Water taxi", waterHull.gondola],
      ["Ferry", waterHull.ferry],
      ["Barge", waterHull.freight],
    ];
    const fits = hulls
      .filter(([, h]) => c.depth >= h.draft && c.width >= h.beam && c.clearance >= h.height)
      .map(([label]) => label);
    messages.push(
      "Channel at " +
        wet[0].p.gx +
        ", " +
        wet[0].p.gz +
        " · " +
        c.depth.toFixed(1) +
        " m deep · " +
        (c.opening
          ? "opening span"
          : Number.isFinite(c.clearance)
            ? c.clearance.toFixed(1) + " m headroom"
            : "open sky") +
        ". " +
        (fits.length ? fits.join(", ") + " can pass." : "No service vessel fits."),
    );
  }
  for (const line of s.mobility?.lines ?? []) {
    if (!marine(line.mode) || !line.enabled) continue;
    const joins = circuitStart(net, line.mode, [...allStops(line), line.depot]).departure;
    if (!joins || line.blocked)
      messages.push(
        modeNames[line.mode] +
          " " +
          line.id.replace("line-", "#") +
          (joins ? " can resume service." : " will need a new passage."),
      );
  }
  return messages;
}
