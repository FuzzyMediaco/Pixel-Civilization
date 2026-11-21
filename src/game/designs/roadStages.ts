import type { Ctx } from "./kit";
import { roadTier, standardRoadLanes } from "../roadStandards";
import { packVoxKey } from "../voxelCore";

/** Road markings sit on the actual deck. Buildings and overhead bridge spans keep their authored elevations. */
export function paintRoadStage(c: Ctx) {
  const level = roadTier(c.lv),
    mask = c.conn & 15,
    real = mask || (c.conn & 240 ? 0 : 5);
  const lanes = standardRoadLanes(c.id, level);
  const marking = c.id === "dirt_roads" ? "sandDark" : "white";
  function top(x: number, z: number) {
    for (let y = 6; y >= 0; y--) if (c.v.v.has(packVoxKey(x, y, z))) return y;
    return 0;
  }
  for (let side = 0; side < 4; side++) {
    if (!(real & (1 << side))) continue;
    const cell = (t: number, n: number): [number, number] =>
      side === 0 ? [t, -n - 1] : side === 1 ? [n, t] : side === 2 ? [-t - 1, n] : [-n - 1, -t - 1];
    const put = (t: number, n: number, col: string, dy = 0) => {
      const [x, z] = cell(t, n);
      const y = top(x, z);
      if (y <= 5) c.v.put(x, y + dy, z, col);
    };
    // A dashed divider identifies both directions on the first paved street.
    if (level === 1 && ["roads", "two_lane_roads", "pretty_roads"].includes(c.id)) {
      for (const n of [3, 4, 7]) put(0, n, "busYellow");
    }
    if (level <= 5) continue;
    // Beyond civic main streets the cross section gains transit paint, turning pockets and signal hardware.
    for (const t of [-3, 2])
      for (const n of [2, 3, 6, 7]) {
        if (lanes >= 4) put(t, n, marking);
      }
    if (level >= 7) for (const n of [3, 4, 5]) put(-1, n, "busYellow");
    if (level >= 8) {
      for (const n of [2, 3, 4, 5, 6]) put(3, n, "#357f71");
      put(3, 4, "white");
    }
    if (level >= 9) {
      for (const n of [2, 5]) put(-3, n, "#9ccdcc");
      put(-3, 6, "warmGlow", 1);
    }
    if (level >= 9 && (side === 0 || side === 3)) {
      const [x, z] = cell(-5, 4),
        [a, b] = cell(-3, 4);
      // Cantilever heads leave both directions clear beneath the signals.
      const h = level >= 11 ? 7 : 6;
      c.v.box(x, 1, z, x + 1, h + 1, z + 1, "steelDark");
      c.v.box(Math.min(x, a), h, Math.min(z, b), Math.max(x, a) + 1, h + 1, Math.max(z, b) + 1, "steel");
      c.v.put(a, h - 1, b, level === 9 ? "lightGreen" : "warmGlow");
      if (level >= 11) {
        const [j, k] = cell(2, 4);
        c.v.box(Math.min(a, j), h, Math.min(b, k), Math.max(a, j) + 1, h + 1, Math.max(b, k) + 1, "steelDark");
        c.v.put(j, h - 1, k, "lightGreen");
      }
    }
    if (level >= 10) {
      for (const n of [1, 2, 5, 6]) put(0, n, "goldDark", 1);
      put(-3, 3, "white");
    }
    if (level >= 11) {
      for (const n of [2, 3, 4]) {
        put(-4, n, "#406176");
        put(4, n, "#406176");
      }
      put(4, 3, "warmGlow", 1);
      put(-4, 3, "warmGlow", 1);
    }
  }
}
