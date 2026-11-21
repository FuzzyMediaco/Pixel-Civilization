/** Axis of a through deck at a separated crossing. 0 is north–south, 1 is east–west. */
export function separatedDeckAxis(mask: number): number {
  const arms = mask & 15;
  const ramps = (mask >> 8) & arms;
  if (ramps === 5 && arms & 10) return 1;
  if (ramps === 10 && arms & 5) return 0;
  return -1;
}

export type RoadAccessKind = "drive" | "freight" | "bus";
export const roadPortalWidth: Record<RoadAccessKind, number> = { drive: 6, freight: 8, bus: 10 };

export function encodeRoadSitePort(direction: number, kind: RoadAccessKind): number {
  const bit = 1 << direction;
  return (bit << 4) | (kind === "freight" ? bit << 13 : kind === "bus" ? bit << 17 : 0);
}

export function roadSitePortKind(mask: number, direction: number): RoadAccessKind | undefined {
  const bit = 1 << direction;
  if (!(mask & (bit << 4))) return undefined;
  if (mask & (bit << 13)) return "freight";
  if (mask & (bit << 17)) return "bus";
  return "drive";
}
