import { ELEMENT_BY_ID } from "./catalog";
import {
  bridgeGrade,
  ensureInfrastructure,
  getTerrainCell,
  markInfrastructureChanged,
  tileKey,
  type Crossing,
} from "./terrain";
import type { GameState, PlacedElement } from "./simulation";
const forms: Record<string, Crossing["shape"]> = {
  bridges: "truss",
  stone_bridges: "arch",
  suspension_bridges: "suspension",
};
/** Promote a completed brush-laid crossing to one span, including the dry approach on each bank.
 * An unfinished, bent or branched span retains its individual editable tiles. */
export function syncCatalogBridges(state: GameState) {
  const core = state.elements.filter((e) => forms[e.defId] || (e.defId === "train_tracks" && e.overWater));
  const prior = state.infrastructure?.spans;
  if (!core.length && !Object.values(prior ?? {}).some((s) => s.catalog)) return;
  const map = new Map(
    state.elements.filter((e) => ELEMENT_BY_ID[e.defId]?.isNetwork).map((e) => [tileKey(e.gx, e.gz), e]),
  );
  const seen = new Set<string>(),
    keep = new Set<string>();
  let dirty = false;
  for (const seed of core) {
    if (seen.has(seed.id)) continue;
    const rail = seed.defId === "train_tracks";
    const bridge = (e: PlacedElement | undefined) =>
      e && (rail ? e.defId === "train_tracks" && e.overWater : !!forms[e.defId]);
    const group = [seed];
    seen.add(seed.id);
    for (let i = 0; i < group.length; i++)
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const e = map.get(tileKey(group[i].gx + dx, group[i].gz + dz));
        if (e && bridge(e) && !seen.has(e.id)) {
          seen.add(e.id);
          group.push(e);
        }
      }
    for (const axis of ["x", "z"] as const) {
      const x = axis === "x" ? 1 : 0,
        z = 1 - x;
      if (!group.every((e) => (axis === "x" ? e.gz === seed.gz : e.gx === seed.gx))) continue;
      group.sort((a, b) => x * (a.gx - b.gx) + z * (a.gz - b.gz));
      const first = group[0],
        last = group.at(-1)!;
      const a = map.get(tileKey(first.gx - x, first.gz - z)),
        b = map.get(tileKey(last.gx + x, last.gz + z));
      if (
        !a ||
        !b ||
        [a, b].some((e) => (rail ? !ELEMENT_BY_ID[e.defId]?.isRailNetwork : !ELEMENT_BY_ID[e.defId]?.isRoadNetwork))
      )
        continue;
      if ([a, b].some((e) => getTerrainCell(state, e.gx, e.gz).depth > 0.12 || e.overWater)) continue;
      if (!group.some((e) => e.overWater || getTerrainCell(state, e.gx, e.gz).depth > 0.1)) continue;
      const pieces = [a, ...group, b],
        run = "catalog-" + first.id + "-" + last.id,
        keys = pieces.map((e) => tileKey(e.gx, e.gz));
      if (keys.some((k) => prior?.[k] && !prior[k].catalog)) continue;
      if (keys.every((k) => prior?.[k]?.run === run)) {
        keys.forEach((k) => keep.add(k));
        break;
      }
      const i = ensureInfrastructure(state),
        shape = rail ? "truss" : forms[group[Math.floor(group.length / 2)].defId];
      const level = Math.max(1, ...group.map((e) => e.level));
      const rise = (rail ? 1.6 : shape === "suspension" ? 2 : shape === "arch" ? 1.45 : 1.65) + 0.125 * (level - 1);
      const mode = rail ? "rail" : group.every((e) => e.pedestrianDeck) ? "foot" : "road";
      const g = bridgeGrade(state, pieces, rise),
        deck = g.deck;
      for (let n = 0; n < pieces.length; n++) {
        const k = keys[n];
        keep.add(k);
        const bank = n === 0 || n === pieces.length - 1;
        i.spans[k] = {
          catalog: true,
          run,
          axis,
          mode,
          shape,
          tier: level,
          railType: rail ? "steel" : undefined,
          deck,
          startHeight: n === 0 ? getTerrainCell(state, a.gx, a.gz).elevation : deck,
          endHeight: n === pieces.length - 1 ? getTerrainCell(state, b.gx, b.gz).elevation : deck,
          direction: 1,
          end: bank,
          ramp: bank,
          lift: "closed",
        };
      }
      dirty = true;
      break;
    }
  }
  if (prior)
    for (const [k, s] of Object.entries(prior))
      if (s.catalog && !keep.has(k)) {
        delete prior[k];
        dirty = true;
      }
  if (dirty) markInfrastructureChanged(ensureInfrastructure(state));
}
