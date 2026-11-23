/** Motor-road standards apply to both legacy centerline roads and new reserved corridors. */
export const VEHICLE_ROADS = new Set([
  "roads",
  "two_lane_roads",
  "pretty_roads",
  "dirt_roads",
  "highways",
  "freeways",
  "bridges",
  "stone_bridges",
  "suspension_bridges",
  "over_passes",
  "underpasses",
]);
export const ROAD_TIERS = [
  "Two-lane access",
  "Marked approaches",
  "Passing bays",
  "Turning pockets",
  "Refuges and islands",
  "Collector lanes",
  "Protected turns",
  "Priority lanes",
  "Adaptive junctions",
  "Express approaches",
  "Metropolitan corridor",
] as const;
export const roadTier = (level: number) => Math.max(1, Math.min(11, Math.floor(level) || 1));
export function standardRoadLanes(id: string, level: number) {
  const base = id === "freeways" ? 6 : id === "highways" ? 4 : 2;
  return Math.min(12, base + 2 * Math.floor((roadTier(level) - 1) / 3));
}
export const roadWidth = (id: string) => (id === "freeways" ? 3 : id === "highways" ? 2 : 1);
export type RoadAxis = "x" | "z";
export function frontageWidth(id: string) {
  return roadWidth(id) === 3
    ? "Three-tile right of way"
    : roadWidth(id) === 2
      ? "Eight-unit right of way · two equal shoulders"
      : "One-tile street";
}
export function roadStageName(id: string, level: number) {
  const name = ROAD_TIERS[roadTier(level) - 1];
  return level === 1 && (id === "freeways" || id === "highways")
    ? id === "freeways"
      ? "Six-lane limited access"
      : "Four-lane divided highway"
    : name;
}
