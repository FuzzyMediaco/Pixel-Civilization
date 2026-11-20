import { ELEMENT_BY_ID } from "./catalog";
import { cellBeyondEdge, getParcelEdges, roadSiteAccess } from "./parcelEdges";
import { buildOccupancyMap, type GameState, type PlacedElement } from "./simulation";

type Street = Pick<PlacedElement, "defId" | "gx" | "gz" | "edgeOverrides">;
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** A new freestanding building may face its first local street without moving any occupied tile.
 * Manual orientations, older cities and established neighboring parcels keep their facing. */
export function planFirstStreetFacing(
  road: Street,
  occupancy: ReadonlyMap<string, PlacedElement>,
  state: GameState,
) {
  const result: { site: PlacedElement; rotation: number }[] = [];
  if (!ELEMENT_BY_ID[road.defId]?.isRoadNetwork) return result;
  for (const [dx, dz] of directions) {
    const site = occupancy.get(`${road.gx + dx},${road.gz + dz}`);
    if (!site?.awaitingStreet || site.edgeOverrides) continue;
    const established = getParcelEdges(site, occupancy, state).some((edge) => {
      const [x, z] = cellBeyondEdge(site, edge.side, edge.slot);
      return x !== road.gx || z !== road.gz;
    });
    if (established) continue;
    // Only an edge neighbor can reach this tile. Substitute its candidate pose in a private
    // occupancy map so the same garage slot, grade and frontage checks used by cars decide.
    const candidate = { ...site };
    const neighbors = new Map<string, PlacedElement>();
    for (const [nx, nz] of directions) {
      const key = `${road.gx + nx},${road.gz + nz}`;
      const other = occupancy.get(key);
      if (other) neighbors.set(key, other.id === site.id ? candidate : other);
    }
    for (let turn = 0; turn < 4; turn++) {
      if (turn % 2 && site.spanX !== site.spanZ) continue;
      candidate.rotation = (site.rotation + turn) % 4;
      if (roadSiteAccess(road, neighbors, state).some((gate) => gate.site.id === site.id)) {
        result.push({ site, rotation: candidate.rotation });
        break;
      }
    }
  }
  return result;
}

export function settleStreetFacing(state: GameState, placed: PlacedElement, manualFacing: boolean) {
  const def = ELEMENT_BY_ID[placed.defId];
  const occupancy = buildOccupancyMap(state.elements);
  if (def.isRoadNetwork) {
    for (const { site, rotation } of planFirstStreetFacing(placed, occupancy, state)) {
      site.rotation = rotation;
      delete site.awaitingStreet;
    }
  } else if (
    !manualFacing &&
    def.domain === "land" &&
    !def.isNetwork &&
    !def.passiveNature &&
    !placed.edgeOverrides
  ) {
    if (getParcelEdges(placed, occupancy, state).length === 0) placed.awaitingStreet = true;
    else delete placed.awaitingStreet;
  }
}
