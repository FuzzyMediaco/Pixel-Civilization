import type { Run } from "./mobility";
import { trainFor, type RailRun } from "./railOperations";
import type { GameState } from "./simulation";
import type { Point, TravelNetwork } from "./travelNetwork";

export const CAR_PITCH = 0.56;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function same(a: Point, b: Point) {
  return dist(a, b) < 0.00001;
}
export function atDistance(
  points: Point[],
  distance: number,
): { point: Point; heading: number; complete: boolean } {
  let heading = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = dist(a, b);
    if (!len) continue;
    heading = Math.atan2(a[0] - b[0], a[1] - b[1]);
    if (distance <= len + 0.00001) {
      const t = Math.min(1, distance / len);
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading,
        complete: true,
      };
    }
    distance -= len;
  }
  return {
    point: points[points.length - 1] ?? [0, 0],
    heading,
    complete: false,
  };
}
export function railBodies(l: Run) {
  if (l.at === l.depot || l.blocked || !l.enabled) return [];
  const r = trainFor(l),
    trail = r.trail.length ? r.trail : l.position ? [l.position] : [];
  const models: string[] = [r.engine, ...r.cars];
  if (r.rearCab) models.reverse();
  return models
    .map((model, i) => ({ model, ...atDistance(trail, i * CAR_PITCH) }))
    .filter((p, i) => p.complete || i === 0);
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
    if (Math.abs(dx * ez - dz * ex) < 0.000001 && dx * ex + dz * ez > 0)
      r.trail.shift();
  }
  r.trail.unshift([...point]);
  const limit = CAR_PITCH * 9 + 0.7;
  let total = 0;
  for (let i = 1; i < r.trail.length; i++) {
    total += dist(r.trail[i - 1], r.trail[i]);
    if (total >= limit) {
      r.trail.length = i + 1;
      break;
    }
  }
}
export function noteRailTravel(
  r: RailRun,
  path: Point[],
  start: number,
  end: number,
  p: Point,
) {
  for (let n = Math.ceil(start); n <= Math.floor(end); n++)
    if (path[n]) railTrail(r, path[n]);
  railTrail(r, p);
}
export function prepareRailLeg(
  l: Run,
  path: Point[],
  net: TravelNetwork,
  ends: Point[],
) {
  const r = trainFor(l);
  if (!path.length) return path;
  if (!r.trail.length) {
    r.trail = [path[0]];
    // A departing consist pulls successive coaches out of the depot; their first visible point is always track.
    return path;
  }
  if (path.length < 2 || r.trail.length < 2) return path;
  const [head, behind] = r.trail,
    a = path[0],
    b = path[1],
    dx = b[0] - a[0],
    dz = b[1] - a[1];
  if (dx * (behind[0] - head[0]) + dz * (behind[1] - head[1]) <= 0.001)
    return path;
  const length = r.cars.length * CAR_PITCH,
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
    back = net.path([tile], ends, "rail");
  if (!back?.length) return path;
  let ahead = back;
  if (back.length > 1) {
    const v = back[1];
    if (
      (tile[0] - tail.point[0]) * (v[0] - tile[0]) +
        (tile[1] - tail.point[1]) * (v[1] - tile[1]) <
      0
    )
      ahead = back.slice(1);
  }
  r.trail = hull.reverse();
  r.rearCab = !r.rearCab;
  l.position = tail.point;
  return same(tail.point, ahead[0]) ? ahead : [tail.point, ...ahead];
}
export function clearRailBlock(l: Run) {
  if (l.rail) {
    delete l.rail.reservation;
    delete l.rail.waitingSince;
    delete l.rail.blockPlan;
  }
}
// A stop along a single track is not a passing loop. Keep the shared running
// rails through boarding, the next stations and the trip back into the depot.
export function remainingRailBlock(
  l: Run,
  net: TravelNetwork,
  route: string[],
) {
  const keys = new Set(l.path.map((p) => p[0] + "," + p[1]));
  let start: Point | undefined = l.path[l.path.length - 1];
  for (
    let n = 1;
    n <= route.length && start && route[l.next % route.length] !== l.depot;
    n++
  ) {
    const id = route[(l.next + n) % route.length],
      site = net.byId.get(id);
    if (!site) break;
    const path = net.path([start], net.connectors(site, "rail"), "rail");
    if (!path?.length) break;
    for (const p of path) keys.add(p[0] + "," + p[1]);
    start = path[path.length - 1];
    if (id === l.depot) break;
  }
  return [...keys];
}
export function claimRailBlock(s: GameState, l: Run) {
  const r = trainFor(l);
  if (r.reservation) return true;
  r.waitingSince ??= s.activePlaySec;
  const keys =
    r.blockPlan ?? l.path.map((p) => Math.round(p[0]) + "," + Math.round(p[1]));
  const overlap = (other: string[]) => other.some((k) => keys.includes(k));
  const occupied = s.mobility!.lines.some(
    (o) =>
      o !== l &&
      o.enabled &&
      !o.blocked &&
      o.rail?.reservation &&
      overlap(o.rail.reservation),
  );
  if (occupied) return false;
  // Older waiting trains get the block first. Express trains break ties before line ID.
  const ahead = s.mobility!.lines.some((o) => {
    if (
      o === l ||
      !o.enabled ||
      o.blocked ||
      !o.rail ||
      o.rail.waitingSince === undefined ||
      o.rail.reservation ||
      !o.path.length
    )
      return false;
    if (
      !overlap(
        o.rail.blockPlan ??
          o.path.map((p) => Math.round(p[0]) + "," + Math.round(p[1])),
      )
    )
      return false;
    return (
      o.rail.waitingSince < r.waitingSince! ||
      (o.rail.waitingSince === r.waitingSince &&
        (o.rail.priority !== r.priority
          ? o.rail.priority === "express"
          : o.id < l.id))
    );
  });
  if (ahead) return false;
  r.reservation = keys;
  delete r.waitingSince;
  return true;
}
