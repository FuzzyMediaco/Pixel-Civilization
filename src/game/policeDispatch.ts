import type { CrimeIncident, GameState, PlacedElement } from "./simulation";
import { getTravelNetwork, type TravelNetwork, type Point } from "./travelNetwork";
import { roadTravelOpen, surfaceTravelHeight } from "./terrain";

const evaluated = new WeakMap<CrimeIncident, TravelNetwork>();

export function findPatrolDispatch(state: GameState, stations: PlacedElement[], victim: PlacedElement) {
  if (!stations.length) return undefined;
  const network = getTravelNetwork(state),
    ends = network.connectors(victim, "taxi");
  if (!ends.length) return undefined;
  let winner: { station: PlacedElement; path: Point[] } | undefined;
  for (const station of stations) {
    const route = network.path(network.connectors(station, "taxi"), ends, "taxi");
    if (route && (!winner || route.length < winner.path.length)) winner = { station, path: route };
  }
  return winner;
}

function withdraw(incident: CrimeIncident) {
  incident.policeOriginId = null;
  incident.policeGx = null;
  incident.policeGz = null;
  delete incident.policeRoute;
  delete incident.policeTravel;
  return true;
}

/** Move and resolve the same road journey that the renderer displays. */
export function advancePatrol(state: GameState, incident: CrimeIncident, seconds: number) {
  if (!incident.policeOriginId || (incident.policeArrived && incident.policeRoute)) return false;
  const network = getTravelNetwork(state);
  if (incident.policeArrived) {
    // Older saves recorded an arrival without its route. Preserve the completed response.
    if (evaluated.get(incident) === network) return false;
    evaluated.set(incident, network);
    const station = network.byId.get(incident.policeOriginId),
      victim = network.byId.get(incident.targetElementId);
    if (!station || !victim) return false;
    const path = network.path(
      network.connectors(station, "taxi"),
      network.connectors(victim, "taxi"),
      "taxi",
    );
    if (!path) return false;
    incident.policeRoute = path;
    incident.policeTravel = path.length - 1;
    return true;
  }
  let path = incident.policeRoute,
    position = incident.policeTravel ?? 0;
  if (!path || evaluated.get(incident) !== network) {
    const station = network.byId.get(incident.policeOriginId),
      victim = network.byId.get(incident.targetElementId);
    if (!station || !victim) return withdraw(incident);
    const i = Math.floor(position),
      at = path?.[i];
    const starts =
      at && (incident.policeDeparted || position > 0) ? [at] : network.connectors(station, "taxi");
    const route = network.path(
      starts,
      network.connectors(victim, "taxi"),
      "taxi",
      undefined,
      incident.policeHeading,
    );
    if (!route) return withdraw(incident);
    const next = path?.[i + 1];
    // Retain progress along an unchanged edge when unrelated parcels change.
    position = next && next[0] === route[1]?.[0] && next[1] === route[1]?.[1] ? position - i : 0;
    path = incident.policeRoute = route;
    evaluated.set(incident, network);
  }
  // Preserve the established five-second response on open streets and wait at actual gates.
  const duration = Math.min(5, incident.maxSec * 0.4);
  incident.policeSpeed ??= Math.max(1, path.length - 1) / duration;
  let distance = seconds * incident.policeSpeed;
  while (distance > 0 && position < path.length - 1) {
    const i = Math.floor(position),
      a = path[i],
      b = path[i + 1];
    if (!roadTravelOpen(state, b[0], b[1], b[0] - a[0], b[1] - a[1])) break;
    const delta = Math.min(distance, i + 1 - position);
    position += delta;
    distance -= delta;
    incident.policeHeading = a[0] === b[0] ? 0 : 1;
  }
  incident.policeTravel = position;
  if (position > 0) incident.policeDeparted = true;
  if (position >= path.length - 1 && incident.progressSec >= duration) {
    incident.policeArrived = true;
    return true;
  }
  return false;
}

/** Location in continuous grid coordinates. The first visible point is the actual station curb. */
export function patrolPosition(state: GameState, incident: CrimeIncident, network?: TravelNetwork) {
  const route = incident.policeRoute;
  if (!incident.policeOriginId || !route?.length) return undefined;
  const t = incident.policeArrived
    ? route.length - 1
    : Math.min(route.length - 1, Math.max(0, incident.policeTravel ?? 0));
  const i = Math.floor(t),
    a = route[i],
    b = route[Math.min(i + 1, route.length - 1)],
    previous = route[Math.max(0, i - 1)];
  const from = i === route.length - 1 ? previous : a;
  const gx = a[0] + 0.5 + (b[0] - a[0]) * (t - i),
    gz = a[1] + 0.5 + (b[1] - a[1]) * (t - i);
  if (network && !network.canUse(Math.floor(gx), Math.floor(gz), "taxi")) return undefined;
  const dx = b[0] - from[0],
    dz = b[1] - from[1];
  const axis = dx ? "x" : dz ? "z" : (state.infrastructure?.spans[a.join(",")]?.axis ?? "z");
  const f = axis === "x" ? gx - Math.floor(gx) : gz - Math.floor(gz);
  return { gx, gz, dx, dz, height: surfaceTravelHeight(state, Math.floor(gx), Math.floor(gz), axis, f) };
}
