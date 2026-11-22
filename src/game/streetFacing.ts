import { ELEMENT_BY_ID } from "./catalog";
import {PARCEL_SIDES, cellBeyondEdge, getParcelEdges, roadSiteAccess } from "./parcelEdges";
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
export function firstCompatibleDrive(site:PlacedElement,occupancy:ReadonlyMap<string,PlacedElement>,state:GameState){
 const d=ELEMENT_BY_ID[site.defId];
 if(!d||d.isNetwork||d.passiveNature||d.domain!=="land"||site.edgeOverrides)return;
 for(const side of PARCEL_SIDES)for(let slot=0;slot<(side==="front"||side==="back"?(site.rotation%2?site.spanZ:site.spanX):(site.rotation%2?site.spanX:site.spanZ));slot++){
   const [x,z]=cellBeyondEdge(site,side,slot),road=occupancy.get(x+","+z);
   if(!road||!ELEMENT_BY_ID[road.defId]?.isRoadNetwork)continue;
   const candidate={...site,autoDrive:{side,slot}}, local=new Map<string,PlacedElement>();
   for(const [dx,dz] of directions){const k=(x+dx)+","+(z+dz),p=occupancy.get(k);if(p)local.set(k,p.id===site.id?candidate:p);}
   if(roadSiteAccess(road,local,state).some(g=>g.site.id===site.id))return candidate.autoDrive;
 }
}
export function planFirstStreetFacing(
  road: Street,
  occupancy: ReadonlyMap<string, PlacedElement>,
  state: GameState,
) {
  const result: { site: PlacedElement; rotation: number;autoDrive?:PlacedElement["autoDrive"] }[] = [];
  if (!ELEMENT_BY_ID[road.defId]?.isRoadNetwork) return result;
  for (const [dx, dz] of directions) {
    const site = occupancy.get(`${road.gx + dx},${road.gz + dz}`);
    if (!site?.awaitingStreet || site.edgeOverrides) continue;
    const established = getParcelEdges(site, occupancy, state).some((edge) => {
      const [x, z] = cellBeyondEdge(site, edge.side, edge.slot);
      return x !== road.gx || z !== road.gz;
    });
    if (established && getParcelEdges(site,occupancy,state).some(e=>["drive","bus","freight"].includes(e.kind))) continue;
    // Only an edge neighbor can reach this tile. Substitute its candidate pose in a private
    // occupancy map so the same garage slot, grade and frontage checks used by cars decide.
    const candidate = { ...site };
    const neighbors = new Map<string, PlacedElement>();
    for (const [nx, nz] of directions) {
      const key = `${road.gx + nx},${road.gz + nz}`;
      const other = occupancy.get(key);
      if (other) neighbors.set(key, other.id === site.id ? candidate : other);
    }
    for (let turn = 0; turn < (established?1:4); turn++) {
      if (turn % 2 && site.spanX !== site.spanZ) continue;
      candidate.rotation = (site.rotation + turn) % 4;
      if (roadSiteAccess(road, neighbors, state).some((gate) => gate.site.id === site.id && gate.side === "front")) {
        result.push({ site, rotation: candidate.rotation });
        break;
      }
    }
    if(!result.some(r=>r.site.id===site.id)){
      const adjacent=new Map(occupancy);adjacent.set(road.gx+","+road.gz,{...road,id:"prospective-street",rotation:0,spanX:1,spanZ:1} as PlacedElement);
      const gate=firstCompatibleDrive(site,adjacent,state);
      if(gate)result.push({site,rotation:site.rotation,autoDrive:gate});
    }
  }
  return result;
}

export function settleStreetFacing(state: GameState, placed: PlacedElement, manualFacing: boolean) {
  const def = ELEMENT_BY_ID[placed.defId];
  const occupancy = buildOccupancyMap(state.elements);
  if (def.isRoadNetwork) {
    for (const { site, rotation,autoDrive } of planFirstStreetFacing(placed, occupancy, state)) {
      site.rotation = rotation;
      if(autoDrive)site.autoDrive=autoDrive;
      delete site.awaitingStreet;
    }
  } else if (
    !manualFacing &&
    def.domain === "land" &&
    !def.isNetwork &&
    !def.passiveNature &&
    !placed.edgeOverrides
  ) {
    const contacts=getParcelEdges(placed,occupancy,state);
    if(!contacts.some(e=>["drive","bus","freight"].includes(e.kind)))placed.autoDrive=firstCompatibleDrive(placed,occupancy,state);
    if (!placed.autoDrive && !contacts.some(e=>["drive","bus","freight"].includes(e.kind))) placed.awaitingStreet = true;
    else delete placed.awaitingStreet;
  }
}
