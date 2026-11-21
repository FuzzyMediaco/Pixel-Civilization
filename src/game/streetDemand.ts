import { activeBlessing } from "./faith";
import { ELEMENT_BY_ID } from "./catalog";
import { roadCapacity, tripsFor } from "./cityDynamics";
import { reliefAtStops } from "./mobility";
import { ambientTrafficFactor, getRoadTripNetwork } from "./roadTraffic";
import type { GameState } from "./simulation";
import { streetLaneFactor } from "./terrain";
import { getTravelNetwork } from "./travelNetwork";
import { levelMultiplier } from "./levelScaling";

// Four quarter-hour traffic samples make up the hourly capacity shown to players.
const SAMPLES_PER_HOUR = 4;

/** A site's hourly trip demand is divided among its usable gate-to-gate routes. A busy
 * shared stretch carries every journey that passes through it, even between distant doors. */
export function streetDemand(state: GameState) {
  const network = getRoadTripNetwork(state);
  const byId = new Map(state.elements.map((site) => [site.id, site]));
  const hourly = new Map<string, number>();
  const factor = ambientTrafficFactor(state.timeOfDay ?? 10.5);
  let trips = 0;
  // Homes generate trips from the residents they actually hold (a share of the whole population, so
  // settlers in the growth pool drive too); workplaces from their staff. Anything else, or a site the
  // economy has not staffed yet, falls back to its nominal level-scaled trip rate.
  let homeWeight = 0;
  for (const site of state.elements) {
    const d = ELEMENT_BY_ID[site.defId];
    if (d?.popBase && site.connected && !site.onFire) homeWeight += d.popBase * levelMultiplier("output", site.level);
  }
  const sites = state.economy?.sites;
  for (const id of network.siteIds) {
    const site = byId.get(id)!;
    const def = ELEMENT_BY_ID[site.defId];
    const nominal = Math.max(1, tripsFor(def)) * levelMultiplier("trips", site.level);
    const residents = def.popBase && homeWeight ? (state.population * def.popBase * levelMultiplier("output", site.level)) / homeWeight : 0;
    const workers = sites?.[id]?.workers ?? 0;
    const visitors = ((def.category === "commerce" ? 2 : 0) + (def.category === "landmarks" ? 6 : 0)) * levelMultiplier("reach", site.level);
    const people = residents / 6 + workers / 10 + visitors;
    const generation = (people > 0 && (residents > 0 || sites?.[id]) ? Math.max(1, people) : nominal) * factor;
    hourly.set(id, generation);
    trips += generation;
  }

  // Trips completed at a stop replace nearby road journeys. A stop across a broken
  // footway cannot relieve the street, even when it is only one tile from a building.
  const relief = new Map<string, number>();
  const delivered = reliefAtStops(state);
  if (delivered.size && hourly.size) {
    const walk = getTravelNetwork(state);
    for (const [id, riders] of delivered) {
      const stop = byId.get(id);
      if (!stop) continue;
      const served = walk.catchment(stop);
      let demand = 0;
      for (const site of served) demand += hourly.get(site) ?? 0;
      if (!demand) continue;
      for (const site of served) {
        const local = hourly.get(site);
        if (local) relief.set(site, (relief.get(site) ?? 0) + (riders * local) / demand);
      }
    }
  }

  const appearances = new Map<string, number>();
  for (const route of network.routes) {
    for (const id of [route.origin.siteId, route.destination.siteId]) {
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
    }
  }
  let carTrips = 0;
  for (const [id, gross] of hourly) {
    const net = (gross - Math.min(0.7 * gross, relief.get(id) ?? 0)) * (activeBlessing(state) === "roads" ? .82 : 1);
    hourly.set(id, net / appearances.get(id)!);
    carTrips += net;
  }
  const volume = new Map<string, number>();
  let traversalCount = 0;
  for (const route of network.routes) {
    const count = hourly.get(route.origin.siteId)! + hourly.get(route.destination.siteId)!;
    for (const [x, z] of route.path) {
      const coord = x + "," + z;
      volume.set(coord, (volume.get(coord) ?? 0) + count);
      traversalCount += count;
    }
  }

  const load = new Map<string, number>();
  let tileCapacity = 0;
  for (const road of state.elements) {
    const key = road.gx + "," + road.gz;
    const count = volume.get(key);
    if (count === undefined || !ELEMENT_BY_ID[road.defId].isRoadNetwork) continue;
    const capacity =
      roadCapacity(ELEMENT_BY_ID[road.defId], road.level) * streetLaneFactor(state, road) * SAMPLES_PER_HOUR;
    tileCapacity += capacity;
    load.set(key, count / capacity);
  }
  const congestedSites = new Set<string>();
  for (const route of network.routes) {
    if (route.path.some(([x, z]) => (load.get(x + "," + z) ?? 0) > 1.15)) {
      congestedSites.add(route.origin.siteId);
      congestedSites.add(route.destination.siteId);
    }
  }
  // Convert tile traversals/hour to complete journeys/hour for the status panel.
  const capacity = traversalCount ? (tileCapacity * carTrips) / traversalCount : 0;
  const congestion = tileCapacity ? (100 * traversalCount) / tileCapacity : 0;
  return { trips, carTrips, capacity, congestion, load, congestedSites };
}
