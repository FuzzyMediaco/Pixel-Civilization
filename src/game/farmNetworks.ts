import { ELEMENT_BY_ID } from "./catalog";
import { FARM_ANCHOR_IDS, FARM_MODULE_IDS } from "./expansionCatalog";
import { analyzeDistrictSynergies } from "./districtSynergies";
import { cellBeyondEdge, getParcelEdges, type ParcelEdge } from "./parcelEdges";
import { buildOccupancyMap, type GameState, type PlacedElement } from "./simulation";

export function hasFarmRoad(
  el: PlacedElement,
  occ: ReadonlyMap<string, PlacedElement>,
  edges: readonly ParcelEdge[],
) {
  return edges.some((edge) => {
    if (
      !["drive", "freight", "bus", "walk"].includes(edge.kind) ||
      !ELEMENT_BY_ID[edge.neighbor]?.isRoadNetwork
    )
      return false;
    const [x, z] = cellBeyondEdge(el, edge.side, edge.slot),
      road = occ.get(x + "," + z);
    return !!road && !road.disrepair && !road.onFire;
  });
}
export const isFarmPiece = (id: string) => FARM_ANCHOR_IDS.has(id) || FARM_MODULE_IDS.has(id);
export const animationTier = (count: number) =>
  count >= 50 ? 4 : count >= 25 ? 3 : count >= 10 ? 2 : count >= 5 ? 1 : 0;
export const complexBoost = (count: number) => 1 + 1.6 * (1 - Math.exp(-count / 38));
export interface FarmComplex {
  anchors: PlacedElement[];
  modules: PlacedElement[];
  owner: Map<string, PlacedElement>;
  count: Map<string, number>;
  tier: number;
  live: boolean;
}
export interface DistrictReport {
  farms: Map<string, FarmComplex>;
  bonuses: ReturnType<typeof analyzeDistrictSynergies>;
}
const reports = new WeakMap<GameState, DistrictReport>();

/** Walk each shared parcel edge once. Each parcel produces once and has one accountable anchor.
 * The nearest road-facing anchor wins, then the stable save ID breaks ties. */
export function collectFarms(
  s: GameState,
  occupancy: ReadonlyMap<string, PlacedElement>,
  access: (el: PlacedElement) => boolean,
  edges?: ReadonlyMap<string, ParcelEdge[]>,
) {
  const farms = s.elements.filter((el) => isFarmPiece(el.defId) && !el.onFire && !el.disrepair);
  const neighbors = new Map<string, Set<PlacedElement>>();
  const collection = new Map<string, FarmComplex>();
  for (const f of farms) {
    const touching = new Set<PlacedElement>();
    const edgeList = edges?.get(f.id) ?? getParcelEdges(f, occupancy, s);
    for (const edge of edgeList) {
      if (!["farm", "orchard"].includes(edge.kind)) continue;
      const [gx, gz] = cellBeyondEdge(f, edge.side, edge.slot);
      const next = occupancy.get(gx + "," + gz);
      if (next && isFarmPiece(next.defId) && !next.onFire && !next.disrepair) touching.add(next);
    }
    neighbors.set(f.id, touching);
  }
  for (const farm of farms) {
    if (collection.has(farm.id)) continue;
    const net: FarmComplex = {
      anchors: [],
      modules: [],
      owner: new Map(),
      count: new Map(),
      tier: 0,
      live: false,
    };
    const queue = [farm];
    collection.set(farm.id, net);
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i];
      (FARM_ANCHOR_IDS.has(f.defId) ? net.anchors : net.modules).push(f);
      for (const neighbor of neighbors.get(f.id)!)
        if (!collection.has(neighbor.id)) {
          collection.set(neighbor.id, net);
          queue.push(neighbor);
        }
    }
    const starts = net.anchors.filter(access).sort((a, b) => a.id.localeCompare(b.id));
    net.live = starts.length > 0;
    if (!net.live) continue;
    const wave = [...starts];
    for (const anchor of starts) {
      net.owner.set(anchor.id, anchor);
      net.count.set(anchor.id, 0);
    }
    for (let i = 0; i < wave.length; i++) {
      const f = wave[i],
        owner = net.owner.get(f.id)!;
      for (const next of neighbors.get(f.id)!) {
        if (net.owner.has(next.id)) continue;
        net.owner.set(next.id, owner);
        if (FARM_MODULE_IDS.has(next.defId)) net.count.set(owner.id, (net.count.get(owner.id) ?? 0) + 1);
        wave.push(next);
      }
    }
    net.tier = animationTier(net.modules.length);
  }
  return collection;
}

export function setDistrictReport(
  s: GameState,
  farms: Map<string, FarmComplex>,
  occupancy = buildOccupancyMap(s.elements),
  existing?: ReadonlyMap<string, ParcelEdge[]>,
) {
  const connections = new Map<string, Set<string>>();
  function linked(a: PlacedElement, b: PlacedElement) {
    let partners = connections.get(a.id);
    if (!partners) {
      partners = new Set();
      for (const edge of existing?.get(a.id) ?? getParcelEdges(a, occupancy, s)) {
        if (!["farm", "orchard", "ceremonial"].includes(edge.kind)) continue;
        const [x, z] = cellBeyondEdge(a, edge.side, edge.slot),
          other = occupancy.get(x + "," + z);
        if (other) partners.add(other.id);
      }
      connections.set(a.id, partners);
    }
    return partners.has(b.id);
  }
  const report = { farms, bonuses: analyzeDistrictSynergies(s.elements, linked) };
  reports.set(s, report);
  return report;
}
export function districtReport(s: GameState) {
  const stored = reports.get(s);
  if (stored) return stored;
  const occ = buildOccupancyMap(s.elements);
  return setDistrictReport(
    s,
    collectFarms(s, occ, (el) => el.connected && hasFarmRoad(el, occ, getParcelEdges(el, occ, s))),
  );
}
export const SCHOOL_SPECIALTIES: Record<string, string> = {
  preschool: "Family happiness rises by up to four points as preschool places cover children.",
  country_schoolhouse: "A one-room rural school provides 40 starting places with modest operating costs.",
  elementary_school: "Elementary classrooms add neighborhood recreation and support family settlement.",
  middle_school: "Science and arts classes supply education and additional recreation.",
  high_school:
    "Gym and extracurricular places grow with the school. An adjoining sports field creates an Athletic Campus.",
  trade_school: "Workshops expand district industrial employment by up to 16% and production by up to 18%.",
  community_college:
    "Workforce courses expand local business employment by up to 12% and receipts by up to 14%.",
  university:
    "Advanced study raises skilled employment and supports up to 12% additional high-skill positions.",
  research_university:
    "Research laboratories support up to 18% additional advanced-industry receipts and skilled jobs.",
};
