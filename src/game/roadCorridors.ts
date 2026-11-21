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
export function corridorOffsets(id: string) {
  return roadWidth(id) === 3 ? [-1, 0, 1] : roadWidth(id) === 2 ? [0, 1] : [0];
}
export function roadReservation(site: RoadSite): [number, number][] {
  return (site.roadAxis ? corridorOffsets(site.defId) : [0]).map((d) => [
    site.gx + (site.roadAxis === "z" ? d : 0),
    site.gz + (site.roadAxis === "x" ? d : 0),
  ]);
}
export function shoulderAt(x: number, z: number, occ: ReadonlyMap<string, PlacedElement>) {
  for (const [dx, dz] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    const e = occ.get(key(x + dx, z + dz));
    if (e?.roadAxis && roadReservation(e).some(([a, b]) => a === x && b === z)) return e;
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
  dry: (x: number, z: number) => boolean,
): string | undefined {
  const cells = roadAxis
    ? roadReservation({ gx, gz, defId: id, roadAxis })
    : Array.from({ length: w * h }, (_, k) => [gx + (k % w), gz + Math.floor(k / w)]);
  for (const [x, z] of cells) {
    if (roadAxis && (x < GRID_MIN || z < GRID_MIN || x > GRID_MAX || z > GRID_MAX || !dry(x, z)))
      return "The full carriageway needs dry ground. Extend the bank or build a crossing.";
    if (roadAxis && (x !== gx || z !== gz)) {
      const e = occ.get(key(x, z));
      if (
        e &&
        !e.sculptsTerrain &&
        (!VEHICLE_ROADS.has(e.defId) || e.roadAxis === roadAxis || (!e.roadAxis && parallelFeeder(x, z, roadAxis, occ)))
      )
        return "The carriageway shoulder would occupy an existing site. Clear the right of way.";
    }
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const e = occ.get(key(x + dx, z + dz));
      if (!e?.roadAxis || !roadReservation(e).some(([a, b]) => a === x && b === z)) continue;
      if (!VEHICLE_ROADS.has(id) || roadAxis === e.roadAxis || (!roadAxis && parallelFeeder(x, z, e.roadAxis, occ)))
        return "This land is reserved for the adjacent carriageway.";
    }
  }
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
/** World-local transverse transformation. Shared edge values narrow a divided road cleanly into its approach. */
export function corridorTransform(art: CorridorArt, along: number, across: number) {
  const edge = along < 0 ? art.minus : art.plus;
  const t = Math.min(1, Math.max(0, (Math.abs(along) - 0.75) / 1.25));
  const stretch = (w: number) => (w === 3 ? 2.85 : w === 2 ? 1.85 : 1);
  const center = (w: number) => (w === 2 ? 1.8 : 0);
  return across * (stretch(art.width) * (1 - t) + stretch(edge) * t) + center(art.width) * (1 - t) + center(edge) * t;
}
