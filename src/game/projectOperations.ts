import { activeBlessing, evacuate, faithServices, isSanctuary } from "./faith";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "./catalog";
import {
  closeSites,
  economyOf,
  effective,
  hasAuthority,
  operational,
  professionalStaff,
  siteOf,
  transfer,
} from "./cityEconomy";
import type { GameState, PlacedElement } from "./simulation";
import { getTravelNetwork, type Point, waterHull, travelSignature } from "./travelNetwork";
import { freshWaterFactor, readWaterService, requestVesselPassage, roadTravelOpen } from "./terrain";

export type ActorKind = "plane" | "airTaxi" | "teleport" | "rocket" | "engine" | "fireboat" | "volunteer";
export interface ProjectActor {
  id: string;
  siteId: string;
  kind: ActorKind;
  gx: number;
  gz: number;
  height: number;
  heading: number;
  progress: number;
}
type Waypoint = [number, number, number];
interface Flight {
  kind: ActorKind;
  origin: string;
  dest: string;
  progress: number;
  duration: number;
  path: Waypoint[];
  capacity: number;
}
interface Call {
  id?: string;
  target: string;
  origin?: string;
  kind: "engine" | "fireboat" | "volunteer";
  path: Point[];
  travel: number;
  service: number;
  age: number;
  status: string;
  revision?: string;
  stalled?: boolean;
  escaped: boolean;
  retiring?: boolean;
}
export interface ProjectOps {
  flights: Flight[];
  next: Record<string, number>;
  status: Record<string, string>;
  completed: Record<string, number>;
  calls: Call[];
  sinceBoom?: number;
  nextFire: number;
  fires: number;
  rescued: number;
  funded: boolean;
  clock: number;
}
export const operationsOf = (s: GameState): ProjectOps =>
  (s.projectOps ??= {
    flights: [],
    next: {},
    status: {},
    completed: {},
    calls: [],
    nextFire: 0,
    fires: 0,
    rescued: 0,
    funded: false,
    clock: 0,
  });
const aviation: Record<string, ActorKind> = {
  regional_airport: "plane",
  flying_car_depot: "airTaxi",
  teleportation_depot: "teleport",
  spaceport: "rocket",
};
const center = (e: PlacedElement): Point => [e.gx + e.spanX / 2, e.gz + e.spanZ / 2];
const limit = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
function waypoints(kind: ActorKind, from: PlacedElement, to: PlacedElement): Waypoint[] {
  const at = (e: PlacedElement, ahead: number, side: number, height: number): Waypoint => {
    const [x, z] = center(e),
      angle = (e.rotation * Math.PI) / 2;
    const dx = Math.round(Math.cos(angle)),
      dz = -Math.round(Math.sin(angle));
    return [x + dx * ahead - dz * side, z + dz * ahead + dx * side, height];
  };
  const pad = (a: number, b: number, h: number) => at(from, a, b, h);
  if (kind === "plane") {
    const [width, depth] = from.rotation % 2 ? [from.spanZ, from.spanX] : [from.spanX, from.spanZ];
    const r = width * 0.4,
      lane = depth / 4;
    const far = 38 + Math.abs(from.rotation % 2 ? from.gz : from.gx);
    return [
      pad(-r, 0.1, 0.28),
      pad(-r, lane, 0.28),
      pad(r, lane, 0.28),
      pad(r + 3, lane, 2),
      pad(r + 9, lane, 8),
      pad(far, -4, 15),
      pad(far, 7, 15),
      pad(-12, 6, 9),
      pad(-5, lane, 3),
      pad(-r, lane, 0.28),
      pad(r, lane, 0.28),
      pad(r, 0.1, 0.28),
    ];
  }
  if (kind === "rocket")
    return [
      pad(-0.4, 0, 0.4),
      pad(0, 0, 0.4),
      pad(0, 0, 0.4),
      pad(0, 0, 0.4),
      pad(0, 0, 1.8),
      pad(0, 0, 7),
      pad(0.4, 0, 19),
      pad(2, 0, 38),
      pad(4, 0, 65),
    ];
  // Land on the marked roof deck or the sidewalk-side portal arch. Old sites scale the
  // model to their saved lot dimensions, so their boarding positions scale with the art.
  const platform = (e: PlacedElement) => {
    const [w, d] = getStandardFootprintForLevel(ELEMENT_BY_ID[e.defId], e.level);
    const [width, depth] = e.rotation % 2 ? [e.spanZ, e.spanX] : [e.spanX, e.spanZ];
    const fit = Math.min(1, width / w, depth / d);
    const localZ = kind === "airTaxi" ? 3 : d * 8 - 4;
    const top = kind === "airTaxi" ? 4 * e.level + 1 : 3;
    return at(e, 0, (localZ * fit) / 16, (1 + (top - 1) * fit) / 4);
  };
  const start = platform(from),
    end = platform(to);
  const [x, z, h] = start,
    [u, v, j] = end,
    cruise = Math.max(h, j) + 5;
  return [
    start,
    start,
    [x, z, h + 2],
    [x + (u - x) * 0.25, z + (v - z) * 0.25, cruise],
    [(x + u) / 2, (z + v) / 2, cruise + 1],
    [u, v, j + 2],
    end,
    end,
  ];
}
function interpolate(path: Waypoint[], p: number) {
  const k = limit(p) * (path.length - 1),
    i = Math.min(path.length - 2, Math.floor(k)),
    a = path[i],
    b = path[i + 1],
    f = k - i;
  return {
    gx: a[0] + (b[0] - a[0]) * f,
    gz: a[1] + (b[1] - a[1]) * f,
    height: a[2] + (b[2] - a[2]) * f,
    heading: Math.atan2(b[0] - a[0], b[1] - a[1]),
  };
}
function flightStatus(f: Flight) {
  const p = f.progress / f.duration;
  if (f.kind === "rocket")
    return p < 0.2
      ? "Rolling rocket to launch pad"
      : p < 0.47
        ? "Boarding crew and counting down"
        : "Launching research mission";
  if (f.kind === "teleport")
    return p < 0.35
      ? "Charging paired gates"
      : p < 0.72
        ? "Transferring passengers"
        : "Materializing passengers";
  if (f.kind === "airTaxi")
    return p < 0.25 ? "Boarding sky taxi" : p < 0.74 ? "Flying to partner pad" : "Landing and unloading";
  return p < 0.18
    ? "Boarding and taxiing"
    : p < 0.4
      ? "Takeoff and climb"
      : p < 0.68
        ? "Mainland visit and return"
        : "Approach, landing and unloading";
}
export function requestProjectJourney(s: GameState, originId: string) {
  const op = operationsOf(s),
    origin = s.elements.find((el) => el.id === originId),
    kind = origin && aviation[origin.defId];
  if (!origin || !kind) return false;
  const fail = (msg: string) => {
    op.status[originId] = msg;
    return false;
  };
  if (op.flights.some((f) => f.origin === originId || f.dest === originId))
    return fail("Pad occupied by a live journey");
  if ((op.next[originId] ?? 0) > s.activePlaySec)
    return fail("Turnaround · " + Math.ceil(op.next[originId] - s.activePlaySec) + " s");
  if (!operational(origin)) return fail("Connect and repair this terminal");
  if (s.metrics.powerSupply < s.metrics.powerDemand) return fail("Waiting for reliable electric power");
  const a = siteOf(s, origin);
  if (a.workers < 1 || s.population < 2) return fail("Waiting for local passengers and staff");
  if (kind === "rocket" && (s.metrics.waterDemand > s.metrics.waterSupply || a.workers < 3))
    return fail("Crew and launch water required");
  let dest = origin;
  if (kind === "airTaxi" || kind === "teleport") {
    const partners = s.elements.filter((el) => el.id !== originId && el.defId === origin.defId);
    if (!partners.length) return fail("Build a second partner terminal");
    const staffed = partners.filter((el) => operational(el) && siteOf(s, el).workers >= 1);
    if (!staffed.length) return fail("Connect, repair and staff a partner terminal");
    const available = staffed.find(
      (el) =>
        (op.next[el.id] ?? 0) <= s.activePlaySec &&
        !op.flights.some((f) => f.origin === el.id || f.dest === el.id),
    );
    if (!available) return fail("Waiting for partner terminal turnaround");
    dest = available;
  }
  if (kind === "rocket" && economyOf(s).businesses < 18)
    return fail("Launch supplies cost $18 from business cash");
  if (kind === "rocket") transfer(s, "businesses", "outside", 18, "Rocket propellant");
  const duration =
    kind === "plane"
      ? 34
      : kind === "rocket"
        ? 23
        : kind === "teleport"
          ? 7
          : 9 + Math.hypot(dest.gx - origin.gx, dest.gz - origin.gz) * 0.24;
  op.flights.push({
    kind,
    origin: originId,
    dest: dest.id,
    path: waypoints(kind, origin, dest),
    progress: 0,
    duration,
    capacity: Math.max(
      1,
      Math.round(
        Math.min(
          a.workers,
          s.population,
          kind === "plane" ? 24 : kind === "airTaxi" ? 4 : kind === "rocket" ? 6 : 12,
        ),
      ),
    ),
  });
  op.status[originId] = "Boarding";
  return true;
}
export function igniteSite(s: GameState, id: string) {
  const el = s.elements.find((x) => x.id === id),
    d = el && ELEMENT_BY_ID[el.defId];
  if (!el || !d || d.isNetwork || d.passiveNature || el.onFire || isSanctuary(el)) return false;
  if (d.popBase) evacuate(s);
  el.onFire = true;
  operationsOf(s).fires++;
  return true;
}
function stationCrews(s: GameState, station: PlacedElement) {
  return Math.min(station.level, Math.floor(professionalStaff(s, station)));
}

/** Station capacity and neighborhood coverage both matter as the population grows. */
const baseFireRisk = (s: GameState) => effective(s, "risk", s.mode === "god" ? 0 : s.mode === "survival" ? 12 : 4);
export function fireServiceReadiness(s: GameState) {
  const authority = hasAuthority(s);
  let crews = 0, protectedSites = 0, occupiedSites = 0;
  for (const site of s.elements) {
    const def = ELEMENT_BY_ID[site.defId];
    if (!def || !site.connected || def.isNetwork || def.passiveNature) continue;
    occupiedSites++;
    if (site.hasFireCover) protectedSites++;
    if (!authority || !def.fireRadius || !operational(site)) continue;
    crews += stationCrews(s, site);
  }
  const required = Math.max(1, Math.ceil(s.population / 50000));
  const coverage = occupiedSites ? protectedSites / occupiedSites : 1;
  const readiness = Math.min(1, crews / required, coverage);
  const base = baseFireRisk(s);
  const chance = s.mode === "god" ? base : Math.min(100, base * (0.6 + (1 - readiness) * 3.4));
  return { crews, required, coverage, readiness, chance };
}

const fireHull = { beam: 1.4, draft: 0.38, height: 1 };
function routeCrew(s: GameState, c: Call, target: PlacedElement) {
  const op = operationsOf(s),
    net = getTravelNetwork(s),
    authority = hasAuthority(s);
  const busy = new Map<string, number>();
  for (const call of op.calls) {
    if (call !== c && call.origin) busy.set(call.origin, (busy.get(call.origin) ?? 0) + 1);
  }
  const professional = s.elements.filter(
    (el) =>
      operational(el) &&
      authority &&
      (ELEMENT_BY_ID[el.defId]?.fireRadius ?? 0) > 0 &&
      stationCrews(s, el) > (busy.get(el.id) ?? 0),
  );
  const local = s.elements.filter(
    (el) =>
      el.id !== target.id && operational(el) && !busy.has(el.id) && (ELEMENT_BY_ID[el.defId]?.popBase ?? 0) > 0,
  );
  let options: { el: PlacedElement; kind: Call["kind"]; path: Point[] }[] = [];
  for (const el of professional) {
    for (const kind of ["engine", "fireboat"] as const) {
      const mode = kind === "engine" ? "taxi" : "gondola",
        hull = kind === "fireboat" ? fireHull : undefined;
      const path = net.path(net.connectors(el, mode, hull), net.connectors(target, mode, hull), mode, hull);
      if (path) options.push({ el, kind, path });
    }
  }
  if (!options.length && (s.highestStageReached < 4 || (!op.rescued && op.fires <= 1))) {
    for (const el of local) {
      const path = net.path(net.connectors(el, "walk"), net.connectors(target, "walk"), "walk");
      if (path) options.push({ el, kind: "volunteer", path });
      else if (closeSites(el, target, 0))
        options.push({
          el,
          kind: "volunteer",
          path: [
            [el.gx, el.gz],
            [target.gx, target.gz],
          ],
        });
    }
  }
  const best = options.sort((a, b) => a.path.length - b.path.length)[0];
  if (best) {
    c.origin = best.el.id;
    c.path = best.path;
    c.travel = 0;
    c.kind = best.kind;
    c.status = "Crew dispatched";
  } else c.status = "Waiting for staffed road or boat access";
  c.revision = travelSignature(s);
}
export function dispatchFire(s: GameState, targetId: string) {
  const el = s.elements.find((x) => x.id === targetId);
  if (!el?.onFire) return false;
  const op = operationsOf(s);
  let call = op.calls.find((c) => c.target === targetId && !c.retiring);
  if (!call) {
    call = {
      id: "crew-" + targetId + "-" + op.fires,
      target: targetId,
      kind: "volunteer",
      path: [],
      travel: 0,
      service: 0,
      age: 0,
      status: "Calling for assistance",
      escaped: false,
    };
    op.calls.push(call);
  }
  if (!call.origin) routeCrew(s, call, el);
  return !!call.origin;
}
export function advanceOperations(s: GameState, dt: number) {
  if (dt <= 0) return false;
  const op = operationsOf(s);
  op.clock += dt;
  const plan = op.clock >= 1;
  if (plan) op.clock %= 1;
  let changed = false;
  for (const f of [...op.flights]) {
    const origin = s.elements.find((el) => el.id === f.origin),
      dest = s.elements.find((el) => el.id === f.dest);
    if (!origin || !dest) {
      op.flights.splice(op.flights.indexOf(f), 1);
      op.status[f.origin] = "Journey cancelled · terminal removed";
      changed = true;
      continue;
    }
    const powered = s.metrics.powerSupply >= s.metrics.powerDemand;
    const receiving = operational(dest) && siteOf(s, dest).workers >= 1 && powered;
    if (f.kind === "teleport" && (!operational(origin) || siteOf(s, origin).workers < 1 || !receiving)) {
      op.status[f.origin] = op.status[f.dest] = "Gate paused · restore both terminals, staff and power";
      continue;
    }
    const approach = f.kind === "plane" ? 0.68 : 0.74;
    if (
      (f.kind === "airTaxi" || f.kind === "plane") &&
      f.progress + dt >= f.duration * approach &&
      !receiving
    ) {
      // Stop counting toward arrival, even if a long active tick spans the whole approach.
      f.progress = Math.max(f.progress, f.duration * approach);
      op.status[f.origin] = op.status[f.dest] = "Holding for a safe landing";
      continue;
    }
    f.progress += dt;
    op.status[f.origin] = op.status[f.dest] = flightStatus(f);
    if (f.progress < f.duration) continue;
    op.flights.splice(op.flights.indexOf(f), 1);
    op.completed[f.origin] = (op.completed[f.origin] ?? 0) + 1;
    const site = s.elements.find((x) => x.id === f.origin)!;
    siteOf(s, site).work++;
    if (f.kind === "plane" || f.kind === "rocket")
      transfer(
        s,
        "outside",
        "businesses",
        f.capacity * (f.kind === "rocket" ? 22 : 9),
        f.kind === "rocket" ? "Research mission" : "Mainland visitors",
      );
    else transfer(s, "households", "businesses", f.capacity * 0.8, "Passenger fares");
    op.next[f.origin] = s.activePlaySec + effective(s, "turnaround", f.kind === "rocket" ? 45 : 14, f.origin);
    op.next[f.dest] = s.activePlaySec + effective(s, "turnaround", f.kind === "rocket" ? 45 : 14, f.dest);
    op.status[f.origin] = op.status[f.dest] = "Completed · " + f.capacity + " passengers served";
    changed = true;
  }
  if (plan) {
    // Alternating origins lets both ends of a two-pad line earn departure experience.
    const ready = s.elements
      .filter((el) => aviation[el.defId] && (op.next[el.id] ?? 0) <= s.activePlaySec)
      .sort((a, b) => (op.completed[a.id] ?? 0) - (op.completed[b.id] ?? 0));
    for (const el of ready)
      if (!op.flights.some((f) => f.origin === el.id || f.dest === el.id))
        changed = requestProjectJourney(s, el.id) || changed;
    for (const el of s.elements) {
      if (el.onFire && !op.calls.some((c) => !c.retiring && c.target === el.id)) {
        dispatchFire(s, el.id);
        changed = true;
      }
    }
    if (s.mode === "god" || s.highestStageReached >= 4) {
      const risk = baseFireRisk(s);
      if (risk > 0 && op.sinceBoom === undefined) {
        op.sinceBoom = s.activePlaySec;
        op.nextFire = s.activePlaySec + 100;
      }
      if (risk > 0 && s.activePlaySec >= op.nextFire) {
        op.nextFire = s.activePlaySec + 90 + Math.random() * 130;
        const vulnerable = s.elements.filter(
          (e) =>
            e.connected &&
            !e.onFire && !isSanctuary(e) &&
            !ELEMENT_BY_ID[e.defId]?.isNetwork &&
            !ELEMENT_BY_ID[e.defId]?.passiveNature,
        );
        if (vulnerable.length && Math.random() < fireServiceReadiness(s).chance / 100) {
          vulnerable.sort(
            (a, b) =>
              3 * (Number(a.hasFireCover) - Number(b.hasFireCover)) +
              Number(b.disrepair) -
              Number(a.disrepair) +
              (ELEMENT_BY_ID[b.defId].nuisanceRadius ?? 0) -
              (ELEMENT_BY_ID[a.defId].nuisanceRadius ?? 0),
          );
          changed =
            igniteSite(
              s,
              vulnerable[Math.floor(Math.random() * Math.max(1, Math.ceil(vulnerable.length / 2)))].id,
            ) || changed;
        }
      }
    }
  }
  for (const c of [...op.calls]) {
    const target = s.elements.find((x) => x.id === c.target);
    if (!target || (!target.onFire && !c.retiring)) {
      op.calls.splice(op.calls.indexOf(c), 1);
      changed = true;
      continue;
    }
    c.age += dt;
    if (c.age > 45 && !c.retiring && !c.escaped && s.mode === "survival") {
      c.escaped = true;
      const next = s.elements.find(
        (x) =>
          x.id !== target.id &&
          closeSites(x, target, 0) &&
          operational(x) &&
          ELEMENT_BY_ID[x.defId]?.needsMaintenance,
      );
      if (next && Math.random() < 0.15) igniteSite(s, next.id);
    }
    if (!c.origin && plan) routeCrew(s, c, target);
    if (!c.origin) continue;
    const station = s.elements.find((x) => x.id === c.origin);
    if (!station || !operational(station)) {
      if (c.retiring) op.calls.splice(op.calls.indexOf(c), 1);
      else {
        c.origin = undefined;
        c.path = [];
        c.stalled = false;
      }
      continue;
    }
    if (plan && c.revision !== travelSignature(s)) {
      // Replan from the crew's present road or channel. An unrelated parcel edit
      // must not teleport an en-route engine or a returning boat to its station.
      const mode = c.kind === "engine" ? "taxi" : c.kind === "fireboat" ? "gondola" : "walk";
      const hull = c.kind === "fireboat" ? fireHull : undefined;
      const goal = c.retiring ? station : target;
      const i = Math.floor(c.travel),
        net = getTravelNetwork(s),
        current = c.path[i];
      const reroute = net.path([current], net.connectors(goal, mode, hull), mode, hull);
      c.revision = travelSignature(s);
      if (reroute) {
        if (c.path[i + 1]?.join(",") !== reroute[1]?.join(",")) c.travel = i;
        c.path = [...c.path.slice(0, i), ...reroute];
        c.stalled = false;
      } else c.stalled = !(c.kind === "volunteer" && closeSites(station, target, 0));
    }
    if (c.stalled) {
      c.status = "Waiting for a route to reopen";
      continue;
    }
    const end = c.path.length - 1;
    if (c.travel < end) {
      const i = Math.floor(c.travel),
        a = c.path[i],
        b = c.path[i + 1];
      const open =
        c.kind === "fireboat"
          ? requestVesselPassage(s, b[0], b[1], fireHull.height)
          : c.kind === "volunteer" || roadTravelOpen(s, b[0], b[1], b[0] - a[0], b[1] - a[1]);
      if (open) {
        c.travel = Math.min(
          end,
          c.travel + dt * (c.kind === "engine" ? 1.9 : c.kind === "fireboat" ? 1 : 0.65),
        );
        c.status = c.retiring ? "Crew returning" : "Crew en route";
      } else c.status = "Crew waiting at crossing";
      continue;
    }
    if (c.retiring) {
      op.calls.splice(op.calls.indexOf(c), 1);
      changed = true;
      continue;
    }
    const wet = s.weather === "rain" || s.weather === "storm",
      localWater = readWaterService(s, target).freshwater || readWaterService(s, station).freshwater;
    const nearbyWater = s.elements.some(
      (x) =>
        operational(x) &&
        [
          "wells",
          "water_towers",
          "municipal_reservoir",
          "desalination_plant",
          "water_pumping_station",
          "water_treatment_plant",
        ].includes(x.defId) &&
        (closeSites(x, target, 3) || closeSites(x, station, 3)) &&
        freshWaterFactor(s, x) > 0,
    );
    if (
      !wet &&
      !effective(s, "waterAtSite", Number(localWater) || Number(nearbyWater), target.id) &&
      c.kind !== "fireboat" &&
      c.kind !== "volunteer"
    ) {
      c.status = "Crew on scene · connect water or add a well";
      continue;
    }
    c.service += dt * (wet ? 1.35 : 1) * (1 + faithServices(s).volunteerSupport) * (activeBlessing(s) === "recovery" ? 1.4 : 1);
    c.status = "Drawing water and extinguishing fire";
    if (c.service >= (c.kind === "volunteer" ? 20 : 8)) {
      target.onFire = false;
      target.disrepair = true;
      target.maintTimerSec = 300;
      c.retiring = true;
      c.path.reverse();
      c.travel = 0;
      c.status = "Returning to station";
      op.rescued++;
      changed = true;
      if (!op.funded && s.mode !== "god" && s.money < 650) {
        transfer(s, "outside", "treasury", 120, "Fire recovery grant");
        op.funded = true;
      }
    }
  }
  return changed || plan;
}
export function getProjectActors(s: GameState): ProjectActor[] {
  const op = s.projectOps;
  if (!op) return [];
  const actors: ProjectActor[] = [];
  for (const f of op.flights) {
    const p = limit(f.progress / f.duration);
    // Portal pulses appear on the two gate platforms; no passenger travels visibly across the intervening city.
    if (f.kind === "teleport") {
      const idx = p < 0.55 ? 0 : f.path.length - 1;
      const a = f.path[idx];
      actors.push({
        id: f.origin,
        siteId: f.origin,
        kind: f.kind,
        gx: a[0],
        gz: a[1],
        height: a[2] + Math.sin(p * Math.PI * 6) * 0.35,
        heading: p * 10,
        progress: p,
      });
    } else
      actors.push({ id: f.origin, siteId: f.origin, kind: f.kind, ...interpolate(f.path, p), progress: p });
  }
  for (const c of op.calls) {
    if (!c.origin || !c.path.length) continue;
    const i = Math.min(Math.floor(c.travel), c.path.length - 1),
      a = c.path[i],
      b = c.path[Math.min(i + 1, c.path.length - 1)],
      off = c.travel - i;
    const gx = a[0] + (b[0] - a[0]) * off + 0.5,
      gz = a[1] + (b[1] - a[1]) * off + 0.5;
    actors.push({
      id: c.id ?? "crew-" + c.target,
      siteId: c.target,
      kind: c.kind,
      gx,
      gz,
      height: c.kind === "fireboat" ? 0.15 : 0.1,
      heading: Math.atan2(b[0] - a[0], b[1] - a[1]),
      progress: c.travel / Math.max(1, c.path.length - 1),
    });
  }
  return actors;
}
