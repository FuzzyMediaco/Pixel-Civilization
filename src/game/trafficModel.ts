import { ELEMENT_BY_ID, getRoadLaneCount, isVehicleRoad } from "./catalog";
import type { PlacedElement } from "./simulation";

export interface TrafficSnapshot {
  capacity: number;
  demand: number;
  congestion: number;
  congestedRoads: number;
  busiestRoadId: string | null;
  loadByRoadId: Map<string, number>;
}

/**
 * Deterministic sample of real home-to-work trips on the motor-road network.
 * Unlike purely decorative car counts, a low-capacity corridor can now be overloaded.
 * Keeping route samples bounded avoids quadratic work on large God Mode cities.
 */
export function analyzeTraffic(elements: PlacedElement[]): TrafficSnapshot {
  const roads = elements.filter(el => {
    const def = ELEMENT_BY_ID[el.defId];
    return def && isVehicleRoad(def);
  });
  const roadAt = new Map<string, PlacedElement>();
  for (const road of roads) roadAt.set(`${road.gx},${road.gz}`, road);
  const capacityByRoad = new Map<string, number>();
  let capacity = 0;
  for (const road of roads) {
    const lanes = getRoadLaneCount(ELEMENT_BY_ID[road.defId], road.level);
    // Every upgrade increases throughput, even when a second paint/geometry tier is pending.
    const throughput = Math.max(10, lanes * 10 + Math.max(0, road.level - 1) * 5);
    capacityByRoad.set(road.id, throughput);
    capacity += throughput;
  }

  const access = (el: PlacedElement): PlacedElement | null => {
    for (let dx = 0; dx < el.spanX; dx++) for (let dz = 0; dz < el.spanZ; dz++) {
      const x = el.gx + dx, z = el.gz + dz;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const road = roadAt.get(`${x + ox},${z + oz}`);
        if (road) return road;
      }
    }
    return null;
  };
  const homes: Array<{ road: PlacedElement; weight: number }> = [];
  const jobs: Array<{ road: PlacedElement; weight: number }> = [];
  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def || !el.connected || el.onFire || def.isNetwork) continue;
    const road = access(el);
    if (!road) continue;
    const lv = Math.pow(2, Math.min(5, el.level) - 1);
    if (def.popBase) homes.push({ road, weight: Math.max(1, (def.popBase * lv) / 14) });
    if (def.jobs) jobs.push({ road, weight: Math.max(1, (def.jobs * lv) / 18) });
  }

  const loadByRoadId = new Map<string, number>();
  const directions: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let demand = 0;
  // Include commuting demand even when there are only shops or homes; scenic vehicles still circulate.
  for (const h of homes) demand += h.weight;
  for (const j of jobs) demand += j.weight * 0.35;
  const maxSamples = 120;
  const stride = Math.max(1, Math.ceil(homes.length / maxSamples));
  const sampleFactor = Math.max(1, stride);
  for (let i = 0; i < homes.length; i += stride) {
    const home = homes[i];
    const destination = jobs.length ? jobs[(i * 7 + 3) % jobs.length] : null;
    if (!destination) break;
    const start = `${home.road.gx},${home.road.gz}`;
    const finish = `${destination.road.gx},${destination.road.gz}`;
    const queue = [start];
    const cameFrom = new Map<string, string | null>([[start, null]]);
    for (let q = 0; q < queue.length && !cameFrom.has(finish); q++) {
      const [x, z] = queue[q].split(",").map(Number);
      for (const [dx, dz] of directions) {
        const key = `${x + dx},${z + dz}`;
        if (!roadAt.has(key) || cameFrom.has(key)) continue;
        cameFrom.set(key, queue[q]);
        queue.push(key);
      }
    }
    if (!cameFrom.has(finish)) continue;
    const weight = Math.max(1, home.weight * sampleFactor);
    let step: string | null = finish;
    let count = 0;
    while (step !== null && count++ <= roadAt.size) {
      const road = roadAt.get(step);
      if (road) loadByRoadId.set(road.id, (loadByRoadId.get(road.id) ?? 0) + weight);
      step = cameFrom.get(step) ?? null;
    }
  }

  let congestedRoads = 0;
  let peak = 0;
  let busiestRoadId: string | null = null;
  for (const road of roads) {
    const utilization = (loadByRoadId.get(road.id) ?? 0) / (capacityByRoad.get(road.id) ?? 1);
    if (utilization > 1) congestedRoads++;
    if (utilization > peak) { peak = utilization; busiestRoadId = road.id; }
  }
  return {
    capacity: Math.round(capacity), demand: Math.round(demand),
    congestion: Math.round(peak * 100) / 100,
    congestedRoads, busiestRoadId, loadByRoadId,
  };
}
