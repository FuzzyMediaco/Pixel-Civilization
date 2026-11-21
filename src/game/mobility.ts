import { stationName, LOCOMOTIVES, defaultFormation, railCapacity, formationPrice, yardCapacity, trainFor, validateFormation, railPurchase, freightCall, advanceRailFreightStock, type RailFormation, type RailRun } from "./railOperations";
import { claimRailLeg, clearRailBlock, heldByOthers, moveRail, onTrack, prepareRailLeg, railLeg, resolveRailConflicts, starvingBehind } from "./railMovement";
import { ELEMENT_BY_ID } from "./catalog";
import { levelMultiplier } from "./levelScaling";
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
  rail?: RailRun;
  id: string;
  /** Line this vehicle belongs to (several trains can share one line). Defaults to its own id. */
  group?: string;
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
  /** Riders waiting per line and stop ("line|stop"), oldest cohort first. */
  queues?: Record<string, { t: number; n: number }[]>;
  /** When riders were last generated at a queue. */
  generated?: Record<string, number>;
  /** Riders who gave up waiting in the last two minutes. */
  lost?: { time: number; count: number; stop: string; line: string }[];
  /** Last departure per line and stop, for headway keeping. */
  departed?: Record<string, { t: number; train: string }>;
}
export const lineKey = (l: Run) => l.group ?? l.id;
export function lineTrains(s: GameState, key: string): Run[] {
  return s.mobility?.lines.filter((l) => lineKey(l) === key) ?? [];
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
const allStops = (line: Run) => {
  const stops=line.stops.filter(id=>id!==line.depot);
  return line.rail?.pattern==="shuttle" ? [line.depot,...stops,...stops.slice(0,-1).reverse()] : [line.depot,...stops];
};
/** Trains run station to station; a shuttle reverses at both ends without calling twice at the termini. */
export const railRoute = (line: Run) => {
  const stops = line.stops.filter((id) => id !== line.depot);
  return line.rail?.pattern === "shuttle" && stops.length > 2 ? [...stops, ...stops.slice(1, -1).reverse()] : stops;
};
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
export function addLine(s: GameState, mode: TravelMode, depot: string, stops: string[], formation?: RailFormation): string {
  if (!eligibleDepots(s, mode).some((e) => e.id === depot))
    throw new Error("Choose a depot or staffed landing for this service.");
  const ordered = [...new Set(stops)],
    allowed = new Set((mode==="rail" && formation?.service==="freight" ? s.elements.filter(e=>e.defId==="freight_rail_terminal") : eligibleStops(s, mode)).map((e) => e.id));
  if (ordered.some((id) => !allowed.has(id)) || ordered.length < 2)
    throw new Error("Choose two different passenger stops or freight berths.");
  const m = mobilityOf(s),
    net = getTravelNetwork(s);
  const route = [depot, ...ordered.filter((id) => id !== depot), depot];
  const consist = mode==="rail" ? formation??defaultFormation() : undefined;
  if(consist) {
    validateFormation(s,net.byId.get(depot)!,ordered.map(id=>net.byId.get(id)!),consist);
    for(const id of [depot,...ordered]) if(!net.connectors(net.byId.get(id)!,"rail").length)
      throw Error(ELEMENT_BY_ID[net.byId.get(id)!.defId].name+" at "+net.byId.get(id)!.gx+", "+net.byId.get(id)!.gz+" needs track along its rear platform.");
  }
  const { departure, failedLeg } = circuitStart(net, mode, route);
  if (!departure) {
    const previous = net.byId.get(route[failedLeg - 1])!,
      next = net.byId.get(route[failedLeg])!;
    throw new Error(net.diagnose(perimeter(previous), perimeter(next), mode, hullFor(mode)).reason);
  }
  if(consist){
    if(m.lines.filter(l=>l.mode==="rail"&&l.depot===depot).length>=yardCapacity(s,net.byId.get(depot)!))throw Error("This yard is full. Add a siding or upgrade your depot.");
    railPurchase(s,formationPrice(consist),"Locomotive and cars");
  }
  const id = "line-" + m.nextId++;
  m.lines.push({
    id,
    mode,
    depot,
    stops: ordered,
    enabled: true,
    interval: consist?.frequency??8,
    schedule: consist?.schedule??"all",
    ...(consist?{rail:{...consist,cars:[...consist.cars],trainId:"T-"+id,trail:[],v:2}}:{}),
    next: consist ? 0 : 1,
    at: depot,
    path: [],
    progress: 0,
    dwell: 0.5,
    position: departure,
    heading: 0,
    riders: [],
    delivered: 0,
    departures: 0,
    status: consist ? "Ready in the depot" : "Boarding at the depot",
    blocked: false,
    demandScale: 1,
  });
  return id;
}
/** Buy another train for a line. Trains share the line's stations, formation and contract; headway shrinks. */
export function addTrainToLine(s: GameState, key: string): string {
  const m = mobilityOf(s),
    trains = lineTrains(s, key),
    lead = trains[0];
  if (!lead || lead.mode !== "rail") throw Error("Choose a railway line.");
  const net = getTravelNetwork(s),
    depot = net.byId.get(lead.depot);
  if (!depot) throw Error("Restore the depot first.");
  if (m.lines.filter((l) => l.mode === "rail" && l.depot === lead.depot).length >= yardCapacity(s, depot))
    throw Error("This depot is full. Add a siding or upgrade the depot.");
  const r = trainFor(lead);
  railPurchase(s, formationPrice(r), "Another train");
  const id = "line-" + m.nextId++;
  for (const t of trains) t.group = key;
  m.lines.push({
    ...structuredClone({ ...lead, rail: undefined }),
    id,
    group: key,
    rail: {
      ...r,
      cars: [...r.cars],
      trainId: "T-" + id,
      trail: [],
      v: 2,
      rearCab: false,
      contract: r.contract ? { ...r.contract, loaded: 0, delivered: 0 } : undefined,
      reservation: undefined,
      waitingSince: undefined,
      blockedBy: undefined,
      yielding: undefined,
      ghost: undefined,
      speed: 0,
      dist: 0,
      claimEnd: undefined,
      circuitStart: undefined,
    },
    at: lead.depot,
    next: 0,
    path: [],
    progress: 0,
    dwell: 1,
    riders: [],
    delivered: 0,
    departures: 0,
    blocked: false,
    status: "Ready in the depot",
    lastBoarding: {},
    waiting: {},
  });
  return id;
}
/** Retire one train from a line (the emptiest one; parked trains first). The last train stays. */
export function removeTrainFromLine(s: GameState, key: string): void {
  const m = mobilityOf(s),
    trains = lineTrains(s, key);
  if (trains.length < 2) throw Error("A line keeps at least one train. Delete the line instead.");
  const pick = [...trains].sort(
    (a, b) =>
      Number(b.at === b.depot) - Number(a.at === a.depot) ||
      a.riders.reduce((n, r) => n + r.count, 0) - b.riders.reduce((n, r) => n + r.count, 0),
  )[0];
  if (pick.rail?.contract?.loaded) throw Error("Wait until that train has unloaded.");
  m.lines = m.lines.filter((l) => l !== pick);
  if (pick.id === key) {
    // The line keeps its id on the surviving trains.
    for (const t of m.lines) if (lineKey(t) === key) t.group = key;
  }
}
/** Seconds for one circuit of a line: measured once trains have run it, estimated from the track before. */
export function circuitSeconds(s: GameState, key: string): number {
  const trains = lineTrains(s, key),
    lead = trains[0];
  if (!lead) return 0;
  const measured = trains.map((t) => t.rail?.circuit).filter((n): n is number => !!n);
  if (measured.length) return measured.reduce((a, b) => a + b, 0) / measured.length;
  return estimateCircuit(s, lead);
}
const circuitCache = new Map<string, number>();
export function estimateCircuit(s: GameState, l: Run): number {
  const net = getTravelNetwork(s),
    r = trainFor(l),
    route = railRoute(l);
  const k = travelSignature(s).length + "|" + route.join(",") + "|" + r.engine + "|" + r.cars.length + "|" + r.frequency;
  const hit = circuitCache.get(k);
  if (hit !== undefined) return hit;
  let tiles = 0;
  for (let i = 0; i < route.length; i++) {
    const a = net.byId.get(route[i]),
      b = net.byId.get(route[(i + 1) % route.length]);
    if (!a || !b) continue;
    tiles += net.path(net.connectors(a, "rail"), net.connectors(b, "rail"), "rail")?.length ?? 0;
  }
  const cruise = Math.min(LOCOMOTIVES[r.engine].speed, 1.8) * 0.72;
  const dwell = (r.service === "freight" ? 3.2 : 1.5) + r.cars.length * 0.3;
  const seconds = tiles / cruise + route.length * dwell + Math.min(r.frequency, 12);
  if (circuitCache.size > 200) circuitCache.clear();
  circuitCache.set(k, seconds);
  return seconds;
}
export function lineHeadway(s: GameState, key: string): number {
  const n = lineTrains(s, key).filter((l) => l.enabled).length;
  return n ? circuitSeconds(s, key) / n : 0;
}
export function replanRailStops(s:GameState,l:Run,stops:string[]){
  const r=trainFor(l),ordered=[...new Set(stops)],net=getTravelNetwork(s);
  if(ordered.length<2||ordered.some(id=>net.byId.get(id)?.defId!==(r.service==="freight"?"freight_rail_terminal":"train_stops")))throw Error("Choose at least two distinct compatible platforms.");
  const trains=lineTrains(s,lineKey(l));
  if(trains.some(t=>t.riders.some(p=>!ordered.includes(p.destination)))||r.contract&&(!ordered.includes(r.contract.pickup)||!ordered.includes(r.contract.drop)))throw Error("The revised route must serve every onboard rider and contracted platform.");
  const depot=net.byId.get(l.depot);if(!depot)throw Error("Restore the depot first.");
  validateFormation(s,depot,ordered.map(id=>net.byId.get(id)!),r);
  const {departure}=circuitStart(net,"rail",[l.depot,...ordered,l.depot]);if(!departure)throw Error("Join all platforms and the depot with continuous track.");
  for(const t of trains){
    t.stops=[...ordered];t.next=0;t.blocked=false;t.path=[];t.progress=0;t.dwell=Math.max(t.dwell,.5);
    const tr=trainFor(t);tr.dist=0;tr.speed=0;tr.circuitStart=undefined;tr.circuit=undefined;clearRailBlock(t);
    if(t.at===t.depot){tr.trail=[];tr.rearCab=false;t.position=departure;}
  }
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
      levelMultiplier("trips", e.level);
  }
  // A bigger stop or station (longer platforms, more shelters) draws riders from further along its catchment.
  return result * levelMultiplier("radius", stop.level);
}
function transferAt(s: GameState, m: MobilityState, l: Run, here: PlacedElement, net: TravelNetwork) {
  if (l.mode === "freight" || l.rail?.service==="freight") return undefined;
  for (const other of m.lines) {
    if (other === l || !servingNow(s, other) || other.mode === "freight" || other.rail?.service==="freight") continue;
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
  if(l.rail?.service==="freight"){freightCall(s,l,stop,net);return;}
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
  const capacity=l.mode==="rail"?railCapacity(trainFor(l)):capacities[l.mode];
  let room = capacity - l.riders.reduce((n, r) => n + r.count, 0);
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
  if (!targets.length) return;
  const busy = l.mode !== "freight" && (s.timeOfDay < 5 || s.timeOfDay >= 22) ? 0.38 : 1;
  // Riders arrive at the platform continuously, whichever train of the line calls next. The queue is
  // shared by all trains of a line, kept oldest-first, and riders who wait too long give up (lost trips).
  const key = lineKey(l) + "|" + stop.id;
  const queues = (m.queues ??= {}),
    generated = (m.generated ??= {});
  const queue = (queues[key] ??= []);
  const previous = generated[key] ?? Math.max(0, s.activePlaySec - 8);
  const elapsed = Math.max(0, s.activePlaySec - previous);
  generated[key] = s.activePlaySec;
  const competition = Math.max(
    1,
    new Set(m.lines.filter((line) => servingNow(s, line) && line.stops.includes(stop.id) && line.mode === l.mode).map(lineKey)).size,
  );
  const rate =
    (demand(stop) *
      busy *
      l.demandScale *
      (l.mode === "freight" ? 1 : m.demand * Math.min(2, Math.sqrt(Math.max(s.population, 0)) / 7))) /
    10 /
    competition;
  const arrivals = rate * elapsed;
  if (arrivals > 0) queue.push({ t: previous + elapsed / 2, n: arrivals });
  const patience = l.mode === "taxi" ? 60 : 150;
  let gaveUp = 0;
  while (queue.length && s.activePlaySec - queue[0].t > patience) gaveUp += queue.shift()!.n;
  let total = queue.reduce((n, c) => n + c.n, 0);
  const cap = capacity * 4;
  while (total > cap && queue.length) {
    const drop = Math.min(queue[0].n, total - cap);
    queue[0].n -= drop;
    total -= drop;
    gaveUp += drop;
    if (queue[0].n <= 0.0001) queue.shift();
  }
  if (gaveUp >= 1) (m.lost ??= []).push({ time: s.activePlaySec, count: Math.round(gaveUp), stop: stop.id, line: lineKey(l) });
  if (room <= 0) return;
  let count = Math.min(room, Math.floor(total));
  if (count <= 0) return;
  // Board oldest first and remember how long each cohort really waited.
  let waitSum = 0,
    left = count;
  while (left > 0 && queue.length) {
    const take = Math.min(left, queue[0].n);
    waitSum += take * Math.max(0, s.activePlaySec - queue[0].t);
    queue[0].n -= take;
    left -= take;
    if (queue[0].n <= 0.0001) queue.shift();
  }
  count -= Math.max(0, Math.round(left));
  const waited = count ? waitSum / count : 0;
  // Destinations follow a light gravity model: busy places nearby attract more riders than a quiet far end.
  const weights = targets.map((id) => {
    const e = net.byId.get(id)!;
    const d = Math.max(2, Math.abs(e.gx - stop.gx) + Math.abs(e.gz - stop.gz));
    return { id, w: demand(e) / Math.pow(d, 0.8) };
  });
  const sum = weights.reduce((n, x) => n + x.w, 0) || 1;
  let assigned = 0;
  const shares = weights
    .map((x) => ({ ...x, exact: (count * x.w) / sum }))
    .map((x) => ({ ...x, n: Math.floor(x.exact) }));
  assigned = shares.reduce((n, x) => n + x.n, 0);
  shares.sort((a, b) => b.exact - b.n - (a.exact - a.n));
  for (let i = 0; assigned < count; i = (i + 1) % shares.length, assigned++) shares[i].n++;
  for (const share of shares) {
    if (share.n <= 0) continue;
    const dest = net.byId.get(share.id)!;
    const transferCount = transferAt(s, m, l, dest, net) ? Math.floor(share.n / 4) : 0;
    if (transferCount)
      l.riders.push({ destination: share.id, boarded: s.activePlaySec, waited, count: transferCount, transfer: true });
    if (share.n - transferCount > 0)
      l.riders.push({ destination: share.id, boarded: s.activePlaySec, waited, count: share.n - transferCount });
  }
}
/** People waiting for any line at a stop right now (rounded), and who gave up there in the last two minutes. */
export function stopCrowd(s: GameState, stopId: string): { waiting: number; lost: number } {
  const m = s.mobility;
  let waiting = 0;
  for (const [k, q] of Object.entries(m?.queues ?? {}))
    if (k.endsWith("|" + stopId)) for (const c of q) if (s.activePlaySec - c.t <= 150) waiting += c.n;
  const lost = (m?.lost ?? []).filter((x) => x.stop === stopId && s.activePlaySec - x.time <= 120).reduce((n, x) => n + x.count, 0);
  return { waiting: Math.round(waiting), lost };
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
      : mode === "rail" || roadTravelOpen(s, b[0], b[1], b[0] - a[0], b[1] - a[1]);
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
function migrateRail(l: Run) {
  const r = trainFor(l);
  if (r.v === 2) return r;
  // Older saves: the route began at the depot and every circuit returned there.
  const len = Math.max(1, railRoute(l).length);
  l.next = l.at === l.depot || l.at === undefined && !r.trail.length ? 0 : (Math.max(0, l.next - 1)) % len;
  if (l.at === l.depot) r.trail = [];
  r.v = 2;
  delete r.blockPlan;
  delete r.reservation;
  delete r.waitingSince;
  r.dist = 0;
  r.speed = 0;
  l.path = [];
  return r;
}
const nightNow = (s: GameState) => s.timeOfDay < 6 || s.timeOfDay >= 21;
function inServiceHours(s: GameState, l: Run) {
  const night = nightNow(s);
  return l.schedule === "all" || (night ? l.schedule === "night" : l.schedule === "day");
}
function stepRailLine(s: GameState, m: MobilityState, l: Run, dt: number, net: TravelNetwork, version: number) {
  const r = migrateRail(l);
  if (!l.enabled) {
    clearRailBlock(l);
    l.status = "Service paused";
    return;
  }
  const route = railRoute(l);
  const depot = net.byId.get(l.depot);
  if (!depot || route.length < 1 || l.stops.some((id) => !net.byId.has(id))) {
    clearRailBlock(l);
    l.blocked = true;
    l.status = "A stop was removed. Edit the line to replace it.";
    return;
  }
  if ([depot, ...l.stops.map((id) => net.byId.get(id)!)].some((e) => !net.connectors(e, "rail").length || e.disrepair || e.onFire)) {
    l.path = [];
    l.blocked = true;
    if (r.reservation) r.reservation = undefined;
    l.status = "Restore service and track at each rear platform.";
    return;
  }
  if (l.dwell > 0) {
    l.dwell -= dt;
    return;
  }
  const parked = l.at === l.depot && !r.trail.length;
  if (parked && r.yielding !== "recall" && !inServiceHours(s, l)) {
    l.status = "Parked · waiting for service hours";
    return;
  }
  if (parked && r.yielding === "recall") {
    l.status = "Parked in the depot";
    return;
  }
  // Headway keeping: leave the depot or the line's first station no sooner than the line's headway allows.
  const key = lineKey(l),
    trains = lineTrains(s, key).filter((t) => t.enabled);
  const startStop = route[0];
  // Only depot releases are spaced; in service, holding a train at a station on shared track does more harm than good.
  const leavingStart = !l.path.length && parked && !r.yielding;
  if (leavingStart && trains.length > 1) {
    const last = (m.departed ??= {})[key + "|" + startStop];
    const headway = circuitSeconds(s, key) / trains.length;
    if (last && typeof last === "object" && last.train !== l.id && s.activePlaySec - last.t < headway * 0.85) {
      l.status = parked ? "Ready in the depot · keeping the headway" : "Holding to keep the headway";
      return;
    }
  }
  if (!l.path.length || l.version !== version) {
    if (l.version !== version && l.path.length) {
      r.reservation = undefined;
      delete r.claimEnd;
    }
    if (l.blocked && l.version === version && s.activePlaySec - (l.plannedAt ?? 0) < 4) return;
    l.plannedAt = s.activePlaySec;
    l.version = version;
    if (!parked && !r.yielding && (!inServiceHours(s, l) && !l.riders.length)) r.yielding = "hours";
    if (parked && r.yielding && r.yielding !== "recall") delete r.yielding;
    const target = r.yielding ? depot : net.byId.get(route[l.next % route.length]);
    if (!target) return;
    const starts: Point[] = parked || !l.position ? net.connectors(depot, "rail") : [[Math.round(l.position[0]), Math.round(l.position[1])]];
    const allEnds = net.connectors(target, "rail");
    const avoid = heldByOthers(s, l);
    const freeEnds = allEnds.filter(([x, z]) => !avoid.has(x + "," + z));
    const tr = r.trail;
    const facing: Point | undefined =
      !parked && tr.length > 1
        ? (() => {
            const dx = tr[0][0] - tr[1][0],
              dz = tr[0][1] - tr[1][1];
            return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
          })()
        : undefined;
    const path =
      net.railPath(starts, freeEnds.length ? freeEnds : allEnds, avoid, 30, facing) || net.railPath(starts, allEnds, avoid, 30, facing);
    // Someone has waited a long time behind this train: get out of the way if moving on would not help them.
    if (path && !parked && !r.yielding && starvingBehind(s, l, path, net.railPath(starts, net.connectors(depot, "rail"), new Set()))) {
      r.yielding = "clear";
      l.version = -1;
      return;
    }
    if (!path) {
      r.reservation = undefined;
      const issue = net.diagnose(starts, perimeter(target), "rail");
      l.status = issue.reason;
      l.blocker = issue.blocker;
      l.blocked = true;
      l.path = [];
      return;
    }
    if (parked) {
      l.position = path[0];
      if (!r.yielding) (m.departed ??= {})[key + "|" + startStop] = { t: s.activePlaySec, train: l.id };
    } else if (l.position && path.length > 1) {
      // Re-planned mid-leg: continue from where the head actually is, not from the tile centre.
      const [hx, hz] = l.position,
        [ax, az] = path[0],
        [bx, bz] = path[1];
      if (Math.hypot(hx - ax, hz - az) > 0.01)
        path.splice(0, (hx - ax) * (bx - ax) + (hz - az) * (bz - az) > 0 ? 1 : 0, [hx, hz]);
    }
    l.path = prepareRailLeg(l, path, net, freeEnds.length ? freeEnds : allEnds, avoid);
    // A train leaving the depot stays inside the shed (off the running line) until its leg is clear.
    if (parked) r.trail = [];
    l.progress = 0;
    l.blocked = false;
    l.blocker = undefined;
    r.reservation = undefined;
    r.speed = 0;
  }
  if (l.blocked || !l.path.length) return;
  const target = r.yielding ? depot : net.byId.get(route[l.next % route.length])!;
  if (!r.reservation || r.claimEnd !== undefined || r.waitingSince !== undefined) {
    const was = r.waitingSince !== undefined;
    if (!claimRailLeg(s, l, net)) {
      const other = s.mobility!.lines.find((o) => o.id === r.blockedBy);
      l.status = "Red signal · waiting for " + (other?.rail?.name ? other.rail.name : "the track ahead");
      // Waiting a while: look for a way round (a loop or the other track of a double line).
      if (s.activePlaySec - (r.waitingSince ?? s.activePlaySec) > 1.5 && was && Math.floor(s.activePlaySec) !== Math.floor(s.activePlaySec - dt)) {
        l.path = [];
        r.reservation = undefined;
      }
      return;
    }
  }
  if (!l.at || l.at !== target.id) l.at = undefined;
  if (r.circuitStart === undefined && !r.yielding && l.next % route.length === 1 % route.length) r.circuitStart = s.activePlaySec;
  const arrived = moveRail(s, l, dt, net);
  if (!arrived) {
    l.status =
      r.ghost ? "Squeezing past on single track · build a passing loop"
      : r.claimEnd !== undefined && (r.speed ?? 0) < 0.05 ? "Signal at caution · following " + (s.mobility!.lines.find((o) => o.id === r.blockedBy)?.rail?.name ?? "a train")
      : r.yielding === "clear" ? "Clearing the line · heading to the depot"
      : r.yielding ? "Returning to the depot"
      : "En route to " + stationName(s, target);
    return;
  }
  // Arrival.
  const wasGhost = r.ghost;
  delete r.ghost;
  l.path = [];
  l.progress = 0;
  r.dist = 0;
  r.speed = 0;
  delete r.claimEnd;
  if (target.id === l.depot) {
    clearRailBlock(l);
    r.trail = [];
    r.rearCab = false;
    l.at = l.depot;
    const hours = r.yielding === "hours";
    if (r.yielding !== "recall") delete r.yielding;
    l.dwell = hours ? 0 : 2.5;
    l.status = "Parked in the depot";
    return;
  }
  r.reservation = undefined;
  completeStop(s, m, l, target, net);
  l.departures++;
  l.at = target.id;
  const index = l.next % route.length;
  l.next = (l.next + 1) % route.length;
  if (index === 0 && r.circuitStart !== undefined) {
    const lap = s.activePlaySec - r.circuitStart;
    if (lap > 1) r.circuit = r.circuit ? r.circuit * 0.6 + lap * 0.4 : lap;
    r.circuitStart = undefined;
  }
  const terminus = index === 0 || (r.pattern === "shuttle" && index === route.length - 1 && route.length > 1) || route.length <= 2;
  let dwell = (r.service === "freight" ? 3.2 : 1.5) + (r.cars.length * 0.3) / Math.sqrt(target.level);
  if (r.service === "freight" && s.railYard?.works?.[target.id]?.crane) dwell *= 0.7;
  if (terminus) dwell = Math.max(dwell, Math.min(r.frequency, 90) * (nightNow(s) ? 1.4 : 1) * 0.5);
  l.dwell = dwell;
  if (index === 0) (m.departed ??= {})[key + "|" + target.id] = { t: s.activePlaySec + dwell, train: l.id };
  l.status = (wasGhost ? "Squeezed past · build a passing loop · " : "") + (r.service === "freight" ? "Loading at " : "Boarding at ") + stationName(s, target);
}
function stepLine(s: GameState, m: MobilityState, l: Run, seconds: number, net: TravelNetwork, version: number) {
  if (l.mode === "rail") return stepRailLine(s, m, l, seconds, net, version);
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
  l.at = undefined;
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
  // Home-port service is judged with the vessel's Lv.1 hull, so upgrading a boat never strands it from
  // the harbor it was built for (a larger hull may still find some open-water routes too narrow).
  const hull = vesselHull({ ...e, level: 1 }),
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
  advanceRailFreightStock(s,net,dt);
  // Trains already running move first and release track; then waiting trains claim it, longest wait first.
  const order = m.lines
    .map((l, i) => ({ l, i, w: l.mode === "rail" ? (l.rail?.waitingSince ?? -Infinity) : -Infinity }))
    .sort((a, b) => a.w - b.w || a.i - b.i);
  for (const { l } of order) stepLine(s, m, l, dt, net, revision);
  resolveRailConflicts(s);
  for (const e of vessels) {
    const v = (m.voyages[e.id] ??= newVoyage(e));
    stepVoyage(s, e, v, dt, net, revision);
  }
  const current = new Set(vessels.map((e) => e.id));
  for (const id of Object.keys(m.voyages)) if (!current.has(id)) delete m.voyages[id];
  m.deliveries = m.deliveries.filter((r) => s.activePlaySec - r.time <= 120);
  if (m.lost) m.lost = m.lost.filter((r) => s.activePlaySec - r.time <= 120);
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
  /** Riders per minute who gave up waiting (they drive instead). */
  lost: number;
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
  // Report flows per minute so they compare with per-minute street trips (the window is two minutes).
  const wait = served ? sumWait / served : 0;
  served /= 2;
  freight /= 2;
  const lost = (m?.lost ?? []).filter((r) => s.activePlaySec - r.time <= 120).reduce((n, r) => n + r.count, 0) / 2;
  const pressure = Math.max(0, Math.ceil(Math.sqrt(s.population) * 0.7 * (m?.demand ?? 1)));
  const districts = new Map<string, string>();
  let potential = 0,
    covered = 0;
  if (lines.length) {
    const net = getTravelNetwork(s);
    const passenger = lines.filter((l) => l.mode !== "freight" && l.rail?.service!=="freight");
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
      const weight = ((d?.popBase ?? 0) + (d?.jobs ?? 0)) * levelMultiplier("output", e.level);
      potential += weight;
      if (reachable.has(e.id)) covered += weight;
    }
  }
  const coverage = potential ? Math.round((100 * covered) / potential) : 0;
  const scheduled =
    m?.lines.filter((l) => l.mode !== "freight" && l.rail?.service!=="freight" && l.enabled && servingNow(s, { ...l, blocked: false })).length ??
    0;
  const reliability = scheduled
    ? Math.round((100 * lines.filter((l) => l.mode !== "freight" && l.rail?.service!=="freight").length) / scheduled)
    : 0;
  const score = served
    ? Math.round(
        40 * Math.min(1, served / Math.max(1, pressure)) +
          0.25 * coverage +
          0.2 * reliability +
          15 * Math.max(0, 1 - wait / 45),
      )
    : 0;
  return { score, served, freight, coverage, wait, reliability, pressure, lost, reachable, districts };
}
export function reliefAtStops(s: GameState): Map<string, number> {
  const relief = new Map<string, number>();
  for (const r of s.mobility?.deliveries ?? [])
    if (s.activePlaySec - r.time <= 120)
      // Per-minute riders (two-minute window), the same unit as the street trips they replace.
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
