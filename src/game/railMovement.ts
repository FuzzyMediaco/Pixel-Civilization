import type { Run } from "./mobility";
import { ELEMENT_BY_ID } from "./catalog";
import { CARS, LOCOMOTIVES, cargoByCar, trainFor, type RailRun } from "./railOperations";
import type { GameState, PlacedElement } from "./simulation";
import type { Point, TravelNetwork } from "./travelNetwork";

/**
 * Rail running model (round 2).
 *
 * - Lines run between their stations; the depot only stores trains (spawn, out of hours, clearing a line).
 * - A train reserves the tiles of its *current leg* (to the next station) plus the tiles under its body,
 *   and releases tiles as its tail leaves them. Several trains therefore share track, and loops / double
 *   track add capacity because leg planning routes around tiles other trains hold.
 * - On signalled track (track Lv2+, or a depot with Block signals) a train may follow another one in the
 *   same direction up to two tiles behind its tail (moving block).
 * - Deadlocks (A waits for B, B waits for A) are resolved by sending the lower-priority train to its depot;
 *   if even that is impossible the train squeezes past and the line reports that it needs a passing loop.
 * - Speed: acceleration from engine power vs. consist mass, braking curves to the stopping point, track-level
 *   limits, curve and junction limits; electric stock crawls on unelectrified track.
 */

export const GAP = 1 / 16;
/** Vehicle body length in tiles (the voxel models are built on the same 16-voxel tile grid). */
export function vehicleLength(model: string): number {
  const def =
    (LOCOMOTIVES as Record<string, { length: number }>)[model] ?? (CARS as Record<string, { length: number }>)[model];
  return (def?.length ?? 12) / 16;
}
export const vehiclePitch = (model: string) => vehicleLength(model) + GAP;
export function trainLength(r: { engine: string; cars: readonly string[] }) {
  return [r.engine, ...r.cars].reduce((n, m) => n + vehiclePitch(m), 0);
}
/** Average coupling pitch; kept for older callers. */
export const CAR_PITCH = 13 / 16;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const key = (x: number, z: number) => Math.round(x) + "," + Math.round(z);
function same(a: Point, b: Point) {
  return dist(a, b) < 0.00001;
}
export function atDistance(points: Point[], distance: number): { point: Point; heading: number; complete: boolean } {
  let heading = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = dist(a, b);
    if (!len) continue;
    heading = Math.atan2(a[0] - b[0], a[1] - b[1]);
    if (distance <= len + 0.00001) {
      const t = Math.min(1, distance / len);
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading, complete: true };
    }
    distance -= len;
  }
  return { point: points[points.length - 1] ?? [0, 0], heading, complete: false };
}
export interface RailBody {
  model: string;
  point: Point;
  heading: number;
  complete: boolean;
  length: number;
  index: number;
}
/** Each vehicle sits on two bogies on the recorded trail, so cars chord around the drawn arcs. */
export function railBodies(l: Run): RailBody[] {
  if (!l.enabled || l.at === l.depot) return [];
  const r = trainFor(l),
    trail = r.trail.length ? r.trail : l.position ? [l.position] : [];
  const models: string[] = [r.engine, ...r.cars];
  const order = models.map((_, i) => i);
  if (r.rearCab) order.reverse();
  const result: RailBody[] = [];
  let offset = 0;
  for (const index of order) {
    const model = models[index],
      length = vehicleLength(model);
    const front = atDistance(trail, offset + length * 0.2),
      back = atDistance(trail, offset + length * 0.8);
    const heading =
      dist(front.point, back.point) > 0.001
        ? Math.atan2(front.point[0] - back.point[0], front.point[1] - back.point[1])
        : front.heading;
    result.push({
      model,
      point: [(front.point[0] + back.point[0]) / 2, (front.point[1] + back.point[1]) / 2],
      heading,
      complete: back.complete,
      length,
      index,
    });
    offset += length + GAP;
  }
  return result.filter((p, i) => p.complete || i === 0);
}
export function railTrail(r: RailRun, point: Point) {
  if (r.trail.length && same(point, r.trail[0])) return;
  const a = r.trail[0],
    b = r.trail[1];
  if (a && b) {
    const dx = a[0] - point[0],
      dz = a[1] - point[1],
      ex = b[0] - a[0],
      ez = b[1] - a[1];
    if (Math.abs(dx * ez - dz * ex) < 0.000001 && dx * ex + dz * ez > 0) r.trail.shift();
  }
  r.trail.unshift([point[0], point[1]]);
  const limit = trainLength(r) + 0.8;
  let total = 0;
  for (let i = 1; i < r.trail.length; i++) {
    total += dist(r.trail[i - 1], r.trail[i]);
    if (total >= limit) {
      r.trail.length = i + 1;
      break;
    }
  }
}
/** Tiles under the consist (head to tail). */
export function bodyTiles(r: RailRun, position?: Point): string[] {
  const out = new Set<string>();
  const trail = r.trail.length ? r.trail : position ? [position] : [];
  if (!trail.length) return [];
  const length = trainLength(r);
  for (let d = 0; d <= length + 0.001; d += 0.2) {
    const p = atDistance(trail, Math.min(d, length));
    out.add(key(p.point[0], p.point[1]));
    if (!p.complete) break;
  }
  return [...out];
}

/* ------------------------------------------------------------------ leg geometry */
export interface RailLeg {
  pts: Point[];
  cum: number[];
  total: number;
  /** Path tile keys and the distance along the leg at which each tile's centre (or arc middle) is passed. */
  tiles: string[];
  at: number[];
  /** Speed limit (tiles/s) and electrification per path tile. */
  limit: number[];
  wired: boolean[];
}
export const TRACK_SPEED = [1.5, 1.9, 2.4, 2.8, 3.5];
export const CURVE_SPEED = (level: number) => (level >= 3 ? 1.35 : 1.15);
const JUNCTION_SPEED = 1.6;
const legs = new WeakMap<Point[], RailLeg>();
function railLevel(net: TravelNetwork, x: number, z: number) {
  const e = net.occupancy.get(x + "," + z);
  return e && ELEMENT_BY_ID[e.defId]?.isRailNetwork ? e.level : 1;
}
function railDegree(net: TravelNetwork, x: number, z: number) {
  let n = 0;
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    if (net.canUse(x + dx, z + dz, "rail")) n++;
  return n;
}
export function railLeg(path: Point[], net: TravelNetwork): RailLeg {
  const cached = legs.get(path);
  if (cached) return cached;
  const pts: Point[] = [],
    tiles: string[] = [],
    at: number[] = [],
    limit: number[] = [],
    wired: boolean[] = [];
  const cum: number[] = [];
  let total = 0;
  const push = (p: Point) => {
    if (pts.length) total += dist(pts[pts.length - 1], p);
    pts.push(p);
    cum.push(total);
  };
  const sign = (v: number) => (Math.abs(v) < 0.001 ? 0 : v > 0 ? 1 : -1);
  for (let i = 0; i < path.length; i++) {
    const cur = path[i],
      tx = Math.round(cur[0]),
      tz = Math.round(cur[1]);
    const level = railLevel(net, tx, tz);
    let v = TRACK_SPEED[Math.max(0, Math.min(4, level - 1))];
    let arc = false;
    if (i > 0 && i < path.length - 1) {
      const prev = path[i - 1],
        next = path[i + 1];
      let ix = sign(tx - prev[0]),
        iz = sign(tz - prev[1]);
      if (ix && iz) Math.abs(tx - prev[0]) > Math.abs(tz - prev[1]) ? (iz = 0) : (ix = 0);
      const ox = sign(next[0] - tx),
        oz = sign(next[1] - tz);
      if ((ix || iz) && ix * ox + iz * oz === 0 && (ox || oz)) {
        arc = true;
        // Quarter circle of radius half a tile around the inside corner, exactly like buildRails.
        const cx = tx - ix * 0.5 + ox * 0.5,
          cz = tz - iz * 0.5 + oz * 0.5;
        for (let k = 0; k <= 6; k++) {
          const t = (k / 6) * (Math.PI / 2),
            p: Point = [cx - ox * 0.5 * Math.cos(t) + ix * 0.5 * Math.sin(t), cz - oz * 0.5 * Math.cos(t) + iz * 0.5 * Math.sin(t)];
          push(p);
          if (k === 3) at.push(total);
        }
        v = Math.min(v, CURVE_SPEED(level));
      }
    }
    if (!arc) {
      push([cur[0], cur[1]]);
      at.push(total);
      if (railDegree(net, tx, tz) >= 3) v = Math.min(v, JUNCTION_SPEED);
    }
    tiles.push(tx + "," + tz);
    limit.push(v);
    wired.push(level >= 4);
  }
  const leg = { pts, cum, total, tiles, at, limit, wired };
  legs.set(path, leg);
  return leg;
}
export function legPoint(leg: RailLeg, d: number): { point: Point; heading: number } {
  const { pts, cum } = leg;
  if (pts.length < 2) return { point: pts[0] ?? [0, 0], heading: 0 };
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1],
    b = pts[i],
    len = cum[i] - cum[i - 1] || 1,
    t = Math.max(0, Math.min(1, (d - cum[i - 1]) / len));
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
function tileIndexAt(leg: RailLeg, d: number) {
  let i = 0;
  while (i < leg.at.length - 1 && (leg.at[i] + leg.at[i + 1]) / 2 < d) i++;
  return i;
}

/* ------------------------------------------------------------------ physics */
export function engineIsElectric(engine: string) {
  return engine === "electric" || engine === "express";
}
function consistMass(r: RailRun) {
  const loads = cargoByCar(r).reduce((n, f) => n + f, 0);
  return 1 + r.cars.length * 0.08 + loads * 0.06;
}
export function brakeRate(r: RailRun) {
  return r.engine === "express" ? 1.2 : r.engine === "steam" ? 0.75 : 0.95;
}
/** Highest speed allowed at distance d given the limits ahead and the stopping point. */
function allowedSpeed(s: GameState, r: RailRun, leg: RailLeg, d: number, stopAt: number) {
  const b = brakeRate(r),
    storm = s.weather === "storm" ? 0.78 : 1;
  const electric = engineIsElectric(r.engine);
  const vmax = LOCOMOTIVES[r.engine].speed * storm;
  let v = Math.min(vmax, Math.sqrt(2 * b * Math.max(0, stopAt - d)));
  const here = tileIndexAt(leg, d);
  for (let i = here; i < leg.tiles.length; i++) {
    const from = i === here ? d : (leg.at[i - 1] + leg.at[i]) / 2;
    if (from - d > (vmax * vmax) / (2 * b) + 0.6) break;
    let lim = leg.limit[i] * storm;
    if (electric && !leg.wired[i]) lim = Math.min(lim, 0.55);
    v = Math.min(v, Math.sqrt(lim * lim + 2 * b * Math.max(0, from - d)));
  }
  return v;
}
/** Advance a running train along its leg. Returns true on arrival. */
export function moveRail(s: GameState, l: Run, dt: number, net: TravelNetwork): boolean {
  const r = trainFor(l),
    leg = railLeg(l.path, net);
  const d = r.dist ?? 0,
    stopAt = Math.min(leg.total, r.claimEnd ?? leg.total);
  let v = r.speed ?? 0;
  const limit = allowedSpeed(s, r, leg, d, stopAt);
  const accel = LOCOMOTIVES[r.engine].accel / consistMass(r);
  if (v < limit) v = Math.min(limit, v + accel * dt);
  else v = Math.max(limit, v - brakeRate(r) * 2 * dt);
  // Creep the last few centimetres instead of stalling on the square-root braking curve.
  if (v < 0.12 && stopAt - d > 0.005) v = Math.min(0.12, (stopAt - d) / dt);
  const next = Math.min(stopAt, d + v * dt);
  for (let i = 0; i < leg.pts.length; i++) if (leg.cum[i] > d && leg.cum[i] <= next) railTrail(r, leg.pts[i]);
  const p = legPoint(leg, next);
  railTrail(r, p.point);
  l.position = p.point;
  l.heading = p.heading;
  l.progress = tileIndexAt(leg, next);
  r.dist = next;
  r.speed = next >= stopAt - 0.0001 ? 0 : v;
  if (next >= leg.total - 0.0001) return true;
  refreshReservation(l, leg, next);
  return false;
}
function refreshReservation(l: Run, leg: RailLeg, d: number) {
  const r = trainFor(l);
  if (!r.reservation) return;
  const end = r.claimEnd === undefined ? leg.tiles.length - 1 : lastTileBefore(leg, r.claimEnd);
  const keep = new Set(bodyTiles(r, l.position));
  for (let i = tileIndexAt(leg, d); i <= end; i++) keep.add(leg.tiles[i]);
  r.reservation = [...keep];
}
function lastTileBefore(leg: RailLeg, d: number) {
  let i = 0;
  while (i < leg.at.length - 1 && leg.at[i + 1] <= d + 0.0001) i++;
  return i;
}

/* ------------------------------------------------------------------ reservations */
export function clearRailBlock(l: Run) {
  if (l.rail) {
    delete l.rail.reservation;
    delete l.rail.waitingSince;
    delete l.rail.blockPlan;
    delete l.rail.blockedBy;
    delete l.rail.claimEnd;
  }
}
/** Physically present on the running lines (not parked in the depot, not paused). */
export function onTrack(l: Run) {
  return l.mode === "rail" && l.enabled && l.at !== l.depot && !!l.rail?.trail.length;
}
export function occupiedTiles(l: Run): Set<string> {
  const r = trainFor(l);
  if (!onTrack(l) || r.ghost) return new Set();
  const set = new Set(bodyTiles(r, l.position));
  for (const k of r.reservation ?? []) set.add(k);
  return set;
}
function railLines(s: GameState) {
  return s.mobility?.lines.filter((o) => o.mode === "rail") ?? [];
}
/** Tiles held by every other train, for routing around them (loops, double track). */
export function heldByOthers(s: GameState, l: Run): Set<string> {
  const held = new Set<string>();
  const own = new Set(bodyTiles(trainFor(l), l.position));
  for (const o of railLines(s)) if (o !== l) for (const k of occupiedTiles(o)) if (!own.has(k)) held.add(k);
  return held;
}
/** Track with signals: Lv2+ rail tiles, or any tile on a line whose depot has Block signals. */
function signalled(s: GameState, l: Run, net: TravelNetwork, tile: string) {
  if (s.railYard?.works?.[l.depot]?.signal) return true;
  const e = net.occupancy.get(tile);
  return !!e && (e.level ?? 1) >= 2;
}
export function claimRailLeg(s: GameState, l: Run, net: TravelNetwork): boolean {
  const r = trainFor(l);
  const leg = railLeg(l.path, net);
  const body = bodyTiles(r, l.position);
  if (r.ghost) {
    r.reservation = [...new Set([...body, ...leg.tiles])];
    delete r.claimEnd;
    delete r.waitingSince;
    delete r.blockedBy;
    return true;
  }
  const from = tileIndexAt(leg, r.dist ?? 0);
  const held = { reservation: r.reservation, claimEnd: r.claimEnd };
  // Auto-blocks: claim through the next junction(s) up to the end of the first plain stretch beyond them that
  // can hold the whole train - a safe place to stand. Trains therefore wait in passing loops, not at stations.
  const degree = leg.tiles.map((k) => {
    const [x, z] = k.split(",").map(Number);
    return railDegree(net, x, z);
  });
  let horizon = leg.tiles.length - 1;
  {
    const need = Math.ceil(trainLength(r));
    let seenJunction = degree[from] >= 3,
      run = 0;
    for (let i = from + 1; i < leg.tiles.length; i++) {
      if (degree[i] >= 3) {
        if (seenJunction && run >= need) {
          horizon = i - 1;
          break;
        }
        seenJunction = true;
        run = 0;
      } else if (seenJunction) run++;
    }
  }
  const owners = new Map<string, Run>();
  for (const o of railLines(s)) if (o !== l) for (const k of occupiedTiles(o)) owners.set(k, o);
  let conflict = -1,
    blocker: Run | undefined;
  for (const k of body)
    if (owners.has(k)) {
      conflict = from;
      blocker = owners.get(k);
      break;
    }
  if (!blocker)
    for (let i = from; i <= horizon; i++)
      if (owners.has(leg.tiles[i])) {
        conflict = i;
        blocker = owners.get(leg.tiles[i]);
        break;
      }
  if (!blocker) {
    r.reservation = [...new Set([...body, ...leg.tiles.slice(from, horizon + 1)])];
    if (horizon < leg.tiles.length - 1) {
      r.claimEnd = leg.at[horizon];
      delete r.blockedBy;
      return true;
    }
    delete r.claimEnd;
    delete r.waitingSince;
    delete r.blockedBy;
    return true;
  }
  // Partial claims. (a) Moving block: follow a train running away from us on signalled track, two tiles
  // behind its tail. (b) Passing place: an oncoming or crossing train has reserved track further ahead; run up
  // to two tiles short of it (typically into a loop) and wait there - its route does not touch ours.
  const end = conflict - 2;
  if (end > from && blocker.rail && blocker.path.length && blocker.dwell <= 0) {
    const prefix = leg.tiles.slice(from, end + 1);
    const ahead = new Set(blocker.rail.reservation ?? []);
    const towardUs = prefix.some((k) => ahead.has(k));
    const theirBody = new Set(bodyTiles(blocker.rail, blocker.position));
    const following = theirBody.has(leg.tiles[conflict]) && (blocker.rail.speed ?? 0) > 0;
    const merge = degree.slice(end + 1, conflict + 1).some((d) => d >= 3);
    const passing = merge && !theirBody.has(leg.tiles[conflict]) && !blocker.path.some((p) => prefix.includes(key(p[0], p[1])));
    if (!towardUs && ((following && prefix.every((k) => signalled(s, l, net, k))) || passing)) {
      r.reservation = [...new Set([...body, ...prefix])];
      r.claimEnd = leg.at[end];
      r.blockedBy = blocker.id;
      return true;
    }
  }
  r.blockedBy = blocker.id;
  // Keep whatever stretch was already granted: run on to its end and wait there.
  if (held.claimEnd !== undefined && held.reservation && held.claimEnd > (r.dist ?? 0) + 0.01) {
    r.reservation = held.reservation;
    r.claimEnd = held.claimEnd;
    return true;
  }
  r.waitingSince ??= s.activePlaySec;
  r.reservation = onTrack(l) ? bodyTiles(r, l.position) : undefined;
  return false;
}
/**
 * Break waiting cycles. The lowest-priority train in a cycle goes to its depot to clear the line;
 * if it is still stuck after 25 s it squeezes past (ghost) and the line reports the missing loop.
 * A train that has starved another for 25 s also yields the next time it is ready to leave.
 */
export function resolveRailConflicts(s: GameState) {
  const lines = railLines(s).filter((l) => l.enabled);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const waiting = (l?: Run) => !!l && l.rail?.waitingSince !== undefined && !!l.rail.blockedBy;
  for (const t of lines) {
    if (!waiting(t)) continue;
    const cycle: Run[] = [t];
    let cur: Run | undefined = byId.get(t.rail!.blockedBy!);
    let closed = false;
    for (let n = 0; n < 12 && cur; n++) {
      if (cur === t) {
        closed = true;
        break;
      }
      if (!waiting(cur) || cycle.includes(cur)) break;
      cycle.push(cur);
      cur = byId.get(cur.rail!.blockedBy!);
    }
    if (!closed) continue;
    const since = Math.min(...cycle.map((l) => l.rail!.waitingSince!));
    if (s.activePlaySec - since < 2) continue;
    const victim = [...cycle].sort(
      (a, b) =>
        Number(a.rail!.priority === "express") - Number(b.rail!.priority === "express") ||
        Number(!!a.riders.length) - Number(!!b.riders.length) ||
        b.rail!.waitingSince! - a.rail!.waitingSince! ||
        (a.id < b.id ? 1 : -1),
    )[0];
    const r = victim.rail!;
    if (r.yielding !== "clear" && r.yielding !== "recall") {
      r.yielding = "clear";
      victim.path = [];
      r.dist = 0;
      r.speed = 0;
      delete r.claimEnd;
    } else if (s.activePlaySec - since > 25) r.ghost = true;
  }
}
/**
 * Someone has waited 25 s (45 s behind an express) for this standing train. Yield to the depot when the
 * planned leg would leave the train in their way again (head-on, or standing on their route), and the trip
 * to the depot does not itself run through them.
 */
export function starvingBehind(s: GameState, l: Run, next?: Point[], toDepot?: Point[] | null) {
  const mine = new Set((next ?? []).map((p) => key(p[0], p[1])));
  const end = new Set((next ?? []).slice(-4).map((p) => key(p[0], p[1])));
  return railLines(s).some((o) => {
    if (o === l || !o.enabled || o.rail?.blockedBy !== l.id || o.rail.waitingSince === undefined) return false;
    const limit = l.rail?.priority === "express" && o.rail.priority !== "express" ? 45 : 25;
    if (s.activePlaySec - o.rail.waitingSince <= limit) return false;
    const body = new Set(onTrack(o) ? bodyTiles(o.rail, o.position) : []);
    const theirs = new Set(o.path.map((p) => key(p[0], p[1])));
    const stuck = [...mine].some((k) => body.has(k)) || [...end].some((k) => theirs.has(k));
    if (!stuck) return false;
    return !(toDepot ?? []).some((p) => body.has(key(p[0], p[1])));
  });
}

/* ------------------------------------------------------------------ reversal at termini */
export function prepareRailLeg(l: Run, path: Point[], net: TravelNetwork, ends: Point[], avoid?: Set<string>) {
  const r = trainFor(l);
  r.dist = 0;
  delete r.claimEnd;
  if (!path.length) return path;
  if (!r.trail.length) {
    r.trail = [path[0]];
    r.rearCab = false;
    // A departing consist pulls successive coaches out of the depot; their first visible point is always track.
    return path;
  }
  if (path.length < 2 || r.trail.length < 2) return path;
  const [head, behind] = r.trail,
    a = path[0],
    b = path[1],
    dx = b[0] - a[0],
    dz = b[1] - a[1];
  if (dx * (behind[0] - head[0]) + dz * (behind[1] - head[1]) <= 0.001) return path;
  // The leg leaves backwards: the driver changes ends and the old tail becomes the head.
  const length = trainLength(r) - GAP,
    tail = atDistance(r.trail, length);
  if (!tail.complete) return path;
  let walked = 0;
  const hull: Point[] = [head];
  for (let i = 1; i < r.trail.length; i++) {
    walked += dist(r.trail[i - 1], r.trail[i]);
    if (walked >= length) break;
    hull.push(r.trail[i]);
  }
  hull.push(tail.point);
  const tile: Point = [Math.round(tail.point[0]), Math.round(tail.point[1])],
    back = (avoid && net.path([tile], ends, "rail", undefined, undefined, avoid)) || net.path([tile], ends, "rail");
  if (!back?.length) return path;
  let ahead = back;
  if (back.length > 1) {
    const v = back[1];
    if ((tile[0] - tail.point[0]) * (v[0] - tile[0]) + (tile[1] - tail.point[1]) * (v[1] - tile[1]) < 0) ahead = back.slice(1);
  }
  r.trail = hull.reverse();
  r.rearCab = !r.rearCab;
  l.position = tail.point;
  return same(tail.point, ahead[0]) ? ahead : [tail.point, ...ahead];
}

/* ------------------------------------------------------------------ depot parking (visual) */
/**
 * Where each vehicle of a parked train stands inside its depot: on the shed roads drawn by the depot model
 * (designs/transit.ts buildTrainDepot: tracks along local x at z = -hz + 4 + 8i voxels, open shed end at +x),
 * nose at the shed door. Local -z is the back edge that meets the running line.
 */
export function parkedBodies(depot: PlacedElement, l: Run, slot: number): RailBody[] {
  const r = trainFor(l);
  const models = [r.engine, ...r.cars];
  const rot = ((depot.rotation % 4) + 4) % 4;
  const wide = rot % 2 ? depot.spanZ : depot.spanX,
    deep = rot % 2 ? depot.spanX : depot.spanZ;
  const hx = wide * 8,
    hz = deep * 8,
    lv = Math.max(1, Math.min(5, depot.level));
  const lanes: number[] = [];
  for (let i = 0; i < [1, 2, 3, 3, 4][lv - 1]; i++) {
    const z = -hz + 4 + i * 8;
    if (z + 3 > hz) break;
    lanes.push(z + 0.5);
  }
  const lane = lanes[slot % Math.max(1, lanes.length)] ?? 0;
  const shedEnd = -hx + 1 + [18, 20, 22, 26, 30][lv - 1];
  const turn = (x: number, z: number): Point => {
    let [a, b] = [x, z];
    for (let i = 0; i < rot; i++) [a, b] = [b, -a];
    return [a, b];
  };
  const cx = depot.gx + depot.spanX / 2 - 0.5,
    cz = depot.gz + depot.spanZ / 2 - 0.5;
  const [fx, fz] = turn(1, 0);
  const heading = Math.atan2(fx, fz);
  const out: RailBody[] = [];
  let nose = Math.min(hx - 1, shedEnd + 3) - Math.floor(slot / Math.max(1, lanes.length)) * 2;
  for (const [index, model] of models.entries()) {
    const length = vehicleLength(model) * 16;
    const mid = nose - length / 2;
    const [ox, oz] = turn(mid / 16, lane / 16);
    out.push({ model, point: [cx + ox, cz + oz], heading, complete: nose - length >= -hx - 0.5, length: length / 16, index });
    nose -= length + 1;
  }
  return out.filter((b) => b.complete);
}
export function stationOf(net: TravelNetwork, id: string) {
  return net.byId.get(id);
}
