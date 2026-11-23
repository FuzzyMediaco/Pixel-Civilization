import type { PlacedElement } from "./simulation";
import { GRID_MIN, GRID_MAX } from "./mapBounds";
import { VEHICLE_ROADS, roadWidth, type RoadAxis } from "./roadStandards";

type RoadSite = Pick<PlacedElement, "gx" | "gz" | "defId" | "roadAxis">;
const key = (x: number, z: number) => x + "," + z;
export function chooseRoadAxis(gx: number, gz: number, rot: number, occ: ReadonlyMap<string, PlacedElement>): RoadAxis {
  const score = (axis: RoadAxis) =>
    [-1, 1].reduce((n, sign) => {
      const e = occ.get(key(gx + (axis === "x" ? sign : 0), gz + (axis === "z" ? sign : 0)));
      return n + (e && VEHICLE_ROADS.has(e.defId) ? 1 : 0);
    }, 0);
  const x = score("x"),
    z = score("z");
  return x === z ? (rot % 2 ? "x" : "z") : x > z ? "x" : "z";
}
/** Bounds in tile coordinates, centered on the routing tile for every road class. */
export function roadBounds(site: RoadSite & Partial<Pick<PlacedElement, "spanX" | "spanZ">>) {
  const { gx, gz, roadAxis } = site;
  if (!roadAxis) return { minX: gx, minZ: gz, maxX: gx + (site.spanX ?? 1), maxZ: gz + (site.spanZ ?? 1) };
  const shoulder = (roadWidth(site.defId) - 1) / 2;
  const x = roadAxis === "z" ? shoulder : 0, z = roadAxis === "x" ? shoulder : 0;
  return { minX: gx - x, minZ: gz - z, maxX: gx + 1 + x, maxZ: gz + 1 + z };
}

export function roadReservation(site: RoadSite): [number, number][] {
  const { minX, minZ, maxX, maxZ } = roadBounds(site);
  const tiles: [number, number][] = [];
  for (let x = Math.floor(minX); x < maxX; x++) {
    for (let z = Math.floor(minZ); z < maxZ; z++) tiles.push([x, z]);
  }
  return tiles;
}

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const intersects = (a: ReturnType<typeof roadBounds>, b: ReturnType<typeof roadBounds>) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

export function shoulderAt(x: number, z: number, occ: ReadonlyMap<string, PlacedElement>, sample?: [number, number]) {
  for (const [dx, dz] of directions) {
    const road = occ.get(key(x + dx, z + dz));
    if (!road?.roadAxis) continue;
    const bounds = roadBounds(road);
    if (sample) {
      const [sx, sz] = sample;
      if (sx >= bounds.minX && sx < bounds.maxX && sz >= bounds.minZ && sz < bounds.maxZ) return road;
    } else if (intersects(bounds, { minX: x, minZ: z, maxX: x + 1, maxZ: z + 1 })) {
      return road;
    }
  }
}
function parallelFeeder(x: number, z: number, axis: RoadAxis, occ: ReadonlyMap<string, PlacedElement>) {
  return [-1, 1].some((d) => {
    const e = occ.get(key(x + (axis === "x" ? d : 0), z + (axis === "z" ? d : 0)));
    return e && VEHICLE_ROADS.has(e.defId) && (!e.roadAxis || e.roadAxis === axis);
  });
}
/** Shoulders are occupied land, but never extra routing nodes. A perpendicular street may cross to the centerline. */
export function corridorConflict(
  gx: number,
  gz: number,
  w: number,
  h: number,
  id: string,
  roadAxis: RoadAxis | undefined,
  occ: ReadonlyMap<string, PlacedElement>,
  dry: (x: number, z: number, bounds: ReturnType<typeof roadBounds>) => boolean,
): string | undefined {
  const bounds = roadBounds({ gx, gz, spanX: w, spanZ: h, defId: id, roadAxis });
  const seen = new Set<string>();
  const checkNeighbor = (other: PlacedElement | undefined) => {
    if (!other || seen.has(other.id)) return;
    seen.add(other.id);
    // Core tile occupancy is handled by the caller. Only test pairs with a shoulder.
    if (other.gx === gx && other.gz === gz || !roadAxis && !other.roadAxis) return;
    if (!intersects(bounds, roadBounds(other))) return;
    if (other.sculptsTerrain) return;

    const bothRoads = VEHICLE_ROADS.has(id) && VEHICLE_ROADS.has(other.defId);
    if (bothRoads) {
      if (roadAxis && other.roadAxis && roadAxis !== other.roadAxis) return;
      if (roadAxis && !other.roadAxis && !parallelFeeder(other.gx, other.gz, roadAxis, occ)) return;
      if (!roadAxis && other.roadAxis && !parallelFeeder(gx, gz, other.roadAxis, occ)) return;
    }
    return "A carriageway shoulder overlaps an existing site. Clear the right of way.";
  };
  const tiles = roadAxis ? roadReservation({ gx, gz, defId: id, roadAxis })
    : Array.from({ length: w * h }, (_, n) => [gx + n % w, gz + Math.floor(n / w)]);
  for (const [x, z] of tiles) {
    if (roadAxis && (x < GRID_MIN || z < GRID_MIN || x > GRID_MAX || z > GRID_MAX || !dry(x, z, bounds)))
      return "The full carriageway needs dry ground. Extend the bank or build a crossing.";
    const direct = checkNeighbor(occ.get(key(x, z)));
    if (direct) return direct;
    for (const [dx, dz] of directions) {
      const neighbor = occ.get(key(x + dx, z + dz));
      if (!neighbor?.roadAxis) continue;
      const conflict = checkNeighbor(neighbor);
      if (conflict) return conflict;
    }
  }
}

/** Use the outgoing heading at turns and the incoming heading at a stroke's end. */
export function strokeRoadAxis(points: readonly { gx: number; gz: number }[], index: number): RoadAxis | undefined {
  const point = points[index], neighbor = points[index + 1] ?? points[index - 1];
  if (!neighbor) return undefined;
  return Math.abs(point.gx - neighbor.gx) >= Math.abs(point.gz - neighbor.gz) ? "x" : "z";
}

export interface CorridorArt {
  axis: RoadAxis;
  width: number;
  minus: number;
  plus: number;
  station: number;
}
export function corridorArt(site: RoadSite, occ: ReadonlyMap<string, PlacedElement>): CorridorArt | undefined {
  if (!site.roadAxis) return;
  const axis = site.roadAxis,
    width = roadWidth(site.defId);
  const adjacent = (sign: number) => {
    const e = occ.get(key(site.gx + (axis === "x" ? sign : 0), site.gz + (axis === "z" ? sign : 0)));
    return e && VEHICLE_ROADS.has(e.defId) ? (e.roadAxis === axis ? roadWidth(e.defId) : 1) : width;
  };
  return {
    axis,
    width,
    station: (((axis === "x" ? site.gx : site.gz) % 6) + 6) % 6,
    minus: Math.min(width, adjacent(-1)),
    plus: Math.min(width, adjacent(1)),
  };
}
export const CARRIAGEWAY_TAPER_START = 0.75;

/** World-local transverse transformation. Shared edge values narrow a divided road cleanly into its approach. */
export function corridorTransform(art: CorridorArt, along: number, across: number) {
  const edge = along < 0 ? art.minus : art.plus;
  const t = Math.min(1, Math.max(0, (Math.abs(along) - CARRIAGEWAY_TAPER_START) / (2 - CARRIAGEWAY_TAPER_START)));
  return across * (art.width * (1 - t) + edge * t);
}
