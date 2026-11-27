import type { GameState, PlacedElement } from "./simulation";
import type { Crossing, SpanShape } from "./terrain";
import type { PixelVox } from "./voxelCore";
export type RailBridgeKind = "timber" | "viaduct" | "steel" | "elevated" | "highlevel";
export const RAIL_BRIDGES: Record<RailBridgeKind, string> = {
  timber: "Timber trestle",
  viaduct: "Stone railway viaduct",
  steel: "Riveted railway truss",
  elevated: "Modern elevated railway",
  highlevel: "High-level cable-stayed crossing",
};
export const railShape: Record<RailBridgeKind, SpanShape> = {
  timber: "truss",
  viaduct: "arch",
  steel: "truss",
  elevated: "beam",
  highlevel: "suspension",
};
export const railClearHeight: Record<RailBridgeKind, number> = {
  timber: 1,
  viaduct: 1.5,
  steel: 2,
  elevated: 2.5,
  highlevel: 3.5,
};
export function railSpanAllows(state: GameState | undefined, gx: number, gz: number, dx: number, dz: number): boolean {
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;
  for (const [x, z] of [
    [gx, gz],
    [gx + dx, gz + dz],
  ]) {
    const s = state?.infrastructure?.spans[x + "," + z];
    if (s && (s.mode !== "rail" || (s.axis === "x") !== Boolean(dx))) return false;
  }
  return true;
}
export function bridgeTier(span: Crossing | undefined) {
  return Math.max(1, Math.min(11, span?.tier ?? 1));
}
export function bridgeFamily(span: Crossing) {
  if (span.mode === "rail") return RAIL_BRIDGES[span.railType ?? (span.shape === "arch" ? "viaduct" : "steel")];
  return {
    truss: "Steel truss",
    arch: "Stone arch",
    lift: "Vertical lift",
    suspension: "Suspension",
    beam: "Concrete viaduct",
  }[span.shape];
}
export function crossingPieces(state: GameState, element: Pick<PlacedElement, "gx" | "gz">) {
  const key = element.gx + "," + element.gz,
    span = state.infrastructure?.spans[key];
  if (!span || span.run.startsWith("junction-")) return [];
  return Object.entries(state.infrastructure!.spans).filter(([, s]) => s.run === span.run);
}
export function crossingUpgradePrice(span: Crossing, tiles: number) {
  return Math.ceil((35 + tiles * (span.mode === "rail" ? 22 : 17)) * (1 + 0.34 * bridgeTier(span)));
}

export type BridgeForm = "suspension" | "gothic" | "arch" | "lift" | "fan" | "trestle" | "rail-truss" | "rail-arch" | "girder";

function bridgeForm(span: Crossing): BridgeForm {
  if (span.mode === "rail") {
    switch (span.railType ?? (span.shape === "arch" ? "viaduct" : "steel")) {
      case "timber": return "trestle";
      case "viaduct": return "rail-arch";
      case "steel": return "rail-truss";
      case "elevated": return "girder";
      case "highlevel": return "fan";
    }
  }
  return ({ arch: "gothic", truss: "arch", lift: "lift", suspension: "suspension", beam: "fan" } as const)[span.shape];
}

export function bridgeLandmark(span: Crossing, length: number) {
  if (span.mode === "rail" || length < 3 || bridgeTier(span) < 4) return bridgeFamily(span);
  const major = length >= 6 && bridgeTier(span) >= 8;
  switch (bridgeForm(span)) {
    case "suspension": return major ? "Golden Gate suspension bridge" : "Harbor suspension span";
    case "gothic": return major ? "Brooklyn Gothic crossing" : "Gothic stone crossing";
    case "arch": return major ? "Sydney Harbour through-arch" : "Harbor through-arch";
    case "lift": return major ? "Tower Bridge lift crossing" : "Towered vertical lift";
    default: return major ? "Fan-stayed motorway" : "Cable-stayed viaduct";
  }
}

export interface BridgeRunProfile {
  lo: number;
  length: number;
  family: BridgeForm;
  tier: number;
  variant: number;
  /** Zero-based interior tile indices in increasing world coordinates, independent of stroke direction. */
  towers: readonly number[];
  towerHeight: number;
}

/** Structure coordinates use the ordinary 16 voxels per tile. y=0 is the deck;
 * x=-8..7 is longitudinal, z is transverse; box upper bounds are exclusive. */
export interface BridgeBay extends BridgeRunProfile {
  index: number;
  halfWidth: number;
  bed: number;
  fixed: PixelVox;
  moving: PixelVox;
  weights: PixelVox;
}

export function bridgeRunProfile(span: Crossing, lo: number, length: number, variant = 0): BridgeRunProfile {
  const tier = bridgeTier(span);
  const family = bridgeForm(span);
  // Keep two main towers on classic long spans. Beyond fourteen tiles, subdivide
  // the waterway again instead of stretching one unsupported central channel.
  const count = length < 3 ? 0 : length < 6 ? 1 : 2 + Math.max(0, Math.floor((length - 7) / 8));
  const towers: number[] = [];
  for (let i = 0; i < count; i++) {
    if (2 * i + 1 === count) towers.push(Math.floor((length - 1) / 2));
    else if (2 * i + 1 > count) towers.push(length - 1 - towers[count - 1 - i]);
    else towers.push(Math.floor((i + 0.5) * (length - 1) / count));
  }
  const height = 6 + Math.round(1.5 * tier) + Math.floor(Math.min(length, 24) * 2 / 3);
  return { lo, length, family, tier, variant: ((variant | 0) % 4 + 4) % 4, towers, towerHeight: family === "lift" ? Math.max(26, height + 5) : height };
}

/** A catalog crossing's middle water tile selects its design, just as in syncCatalogBridges.
 * Works-created spans carry their own family. Neither route needs an extra saved field. */
export function bridgeRunProfiles(state: GameState): Map<string, BridgeRunProfile> {
  const spans = state.infrastructure?.spans ?? {};
  type Tile = { key: string; coord: number; span: Crossing };
  const runs = new Map<string, Tile[]>();
  for (const [key, span] of Object.entries(spans)) {
    if (span.end || span.run.startsWith("junction-")) continue;
    const [x, z] = key.split(",").map(Number);
    const coord = span.axis === "x" ? x : z;
    const lane = span.axis === "x" ? z : x;
    const id = [span.run, span.axis, lane, span.mode, bridgeForm(span), span.corridorWidth ?? 1].join("/");
    const tiles = runs.get(id);
    const tile = { key, coord, span };
    if (tiles) tiles.push(tile);
    else runs.set(id, [tile]);
  }
  const profiles = new Map<string, BridgeRunProfile>();
  if (!runs.size) return profiles;
  const catalogVariants = new Map<string, number>();
  for (const e of state.elements) {
    if (e.defId === "bridges" || e.defId === "stone_bridges" || e.defId === "suspension_bridges" || e.defId === "train_tracks")
      catalogVariants.set(e.gx + "," + e.gz, e.variant ?? 0);
  }
  for (const tiles of runs.values()) {
    tiles.sort((a, b) => a.coord - b.coord);
    // A replacement junction or a gap in an old save terminates the structure.
    for (let start = 0; start < tiles.length;) {
      let end = start + 1;
      while (end < tiles.length && tiles[end].coord === tiles[end - 1].coord + 1) end++;
      const length = end - start;
      const center = tiles[start + Math.floor(length / 2)];
      const variant = center.span.catalog ? catalogVariants.get(center.key) : 0;
      const profile = bridgeRunProfile(center.span, tiles[start].coord, length, variant);
      for (let i = start; i < end; i++) profiles.set(tiles[i].key, profile);
      start = end;
    }
  }
  return profiles;
}
