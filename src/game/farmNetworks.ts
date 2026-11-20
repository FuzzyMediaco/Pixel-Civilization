import { FARM_ANCHOR_IDS, FARM_MODULE_IDS } from "./expansionCatalog";
import type { PlacedElement } from "./simulation";

export interface FarmNetworkResult {
  /** A field belongs to exactly one connected anchor, even when complexes touch. */
  ownerByModuleId: Map<string, string>;
  moduleCountByAnchorId: Map<string, number>;
  connectedModuleIds: Set<string>;
  /** Rounded exponential boost with a safety cap for enormous operations. */
  multiplierByAnchorId: Map<string, number>;
  animationTierByAnchorId: Map<string, number>;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function eachFootprintCell(el: PlacedElement, fn: (x: number, z: number) => void): void {
  for (let dx = 0; dx < el.spanX; dx++) {
    for (let dz = 0; dz < el.spanZ; dz++) fn(el.gx + dx, el.gz + dz);
  }
}

/**
 * Farm anchors and modules form a cardinally adjacent, transit-independent mesh.
 * A single road-linked anchor powers every module reachable through its farm network.
 * Multiple anchors do not duplicate modules, food or synergy.
 */
export function analyzeFarmNetworks(
  elements: PlacedElement[],
  roadConnectedAnchorIds: Set<string>,
): FarmNetworkResult {
  const farms = elements.filter(el => FARM_ANCHOR_IDS.has(el.defId) || FARM_MODULE_IDS.has(el.defId));
  const byId = new Map(farms.map(el => [el.id, el]));
  const occupancy = new Map<string, string>();
  for (const el of farms) eachFootprintCell(el, (x, z) => occupancy.set(`${x},${z}`, el.id));

  const neighbors = new Map<string, Set<string>>();
  for (const el of farms) {
    const adjacent = new Set<string>();
    eachFootprintCell(el, (x, z) => {
      for (const [dx, dz] of DIRS) {
        const id = occupancy.get(`${x + dx},${z + dz}`);
        if (id && id !== el.id) adjacent.add(id);
      }
    });
    neighbors.set(el.id, adjacent);
  }

  const ownerByModuleId = new Map<string, string>();
  const connectedModuleIds = new Set<string>();
  const moduleCountByAnchorId = new Map<string, number>();
  const multiplierByAnchorId = new Map<string, number>();
  const animationTierByAnchorId = new Map<string, number>();

  // Multi-source breadth-first assignment avoids choosing one giant anchor arbitrarily.
  // Sorting guarantees identical results for saves loaded in a different element order.
  const starts = farms
    .filter(el => FARM_ANCHOR_IDS.has(el.defId) && roadConnectedAnchorIds.has(el.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const visited = new Set<string>();
  const queue: Array<{ id: string; anchor: string }> = [];
  for (const a of starts) {
    visited.add(a.id);
    queue.push({ id: a.id, anchor: a.id });
    moduleCountByAnchorId.set(a.id, 0);
  }

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const nextId of [...(neighbors.get(current.id) ?? [])].sort()) {
      if (visited.has(nextId)) continue;
      const next = byId.get(nextId);
      if (!next) continue;
      // An anchor is never owned by another anchor; it is an independent building.
      if (FARM_ANCHOR_IDS.has(next.defId)) continue;
      visited.add(next.id);
      queue.push({ id: next.id, anchor: current.anchor });
      ownerByModuleId.set(next.id, current.anchor);
      connectedModuleIds.add(next.id);
      moduleCountByAnchorId.set(current.anchor, (moduleCountByAnchorId.get(current.anchor) ?? 0) + 1);
    }
  }

  for (const a of starts) {
    const count = moduleCountByAnchorId.get(a.id) ?? 0;
    multiplierByAnchorId.set(a.id, Math.min(6, Math.pow(1.018, Math.min(100, count))));
    animationTierByAnchorId.set(a.id, count >= 50 ? 4 : count >= 25 ? 3 : count >= 10 ? 2 : count >= 5 ? 1 : 0);
  }

  return {
    ownerByModuleId, moduleCountByAnchorId, connectedModuleIds,
    multiplierByAnchorId, animationTierByAnchorId,
  };
}
