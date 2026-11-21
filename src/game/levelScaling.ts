/**
 * Level scaling — the single source of truth for how an element's contribution grows from Lv.1 to Lv.5.
 *
 * Every simulation/economy system that turns a placed element into a number (power, water, waste,
 * jobs, food, schooling, parks, government, police, military, housing, exports, radii, pollution,
 * upkeep, traffic…) multiplies its Lv.1 figure by `levelMultiplier(curve, level)`. The curves:
 *
 *   curve          formula (L = level, clamped 1..5)   Lv1   Lv2   Lv3   Lv4   Lv5    used for
 *   output         2^(L-1)                              1     2     4     8    16     primary outputs
 *   crop           2.35^(L-1)                           1   2.35  5.52  13.0  30.5   farm/field harvest (fields sprawl)
 *   retail         2.25^(L-1)                           1   2.25  5.06  11.4  25.6   grocer/restaurant/mall throughput
 *   draw           max(1, round(0.75·2^(L-1)))          1     2     3     6    12     consumer power/water draw
 *   trips          1.7^(L-1)                            1   1.7   2.89  4.91  8.35   trips & transit riders generated
 *   reach          2^(0.75(L-1))                        1   1.68  2.83  4.76  8.00   saturating services: faith
 *                                                                                    strength, defender rosters
 *   storage        2^(0.75(L-1))                        1   1.68  2.83  4.76  8.00   cisterns, reservoirs, stockpiles
 *   radius         1 + 0.25(L-1)                        1  1.25  1.50  1.75  2.00   coverage radii (2× reach, 4× area)
 *   amenity        2^((L-1)/2)                          1  1.41  2.00  2.83  4.00   flat parcel-edge bonuses
 *   pollution      2^((L-1)/2)                          1  1.41  2.00  2.83  4.00   emitted (and absorbed) pollution
 *   desirability   1 + 0.25(L-1)                        1  1.25  1.50  1.75  2.00   land-value lift
 *   upkeep         2^(0.6(L-1))                         1  1.52  2.30  3.48  5.28   running cost
 *
 * Rationale: primary outputs double per level (an upgrade costs ×2.1 per level); coverage radii grow
 * sublinearly; side effects of a bigger site — upkeep, pollution, traffic, utility draw — rise too, so
 * a high level is never free (a Lv.5 coal plant makes 16× the power for 4× the smog and 5.3× the
 * upkeep). Existing curves (crop, retail, trips, draw) were kept to avoid rebalancing farms and shops.
 * Roads (levels up to 11) use their own lane/capacity model in cityDynamics.roadCapacity.
 */
export type LevelCurve =
  | "output"
  | "crop"
  | "retail"
  | "draw"
  | "trips"
  | "radius"
  | "reach"
  | "storage"
  | "amenity"
  | "pollution"
  | "desirability"
  | "upkeep";

export const MAX_SCALED_LEVEL = 5;

/** Clamp to the 1..5 range every non-road element uses. Fractional / bad input degrades to Lv.1. */
export function scaledLevel(level: number): number {
  const n = Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.max(1, Math.min(MAX_SCALED_LEVEL, n));
}

export function levelMultiplier(curve: LevelCurve, level: number): number {
  const s = scaledLevel(level) - 1;
  switch (curve) {
    case "output":
      return 2 ** s;
    case "crop":
      return 2.35 ** s;
    case "retail":
      return 2.25 ** s;
    case "draw":
      return Math.max(1, Math.round(0.75 * 2 ** s));
    case "trips":
      return 1.7 ** s;
    case "radius":
      return 1 + 0.25 * s;
    case "reach":
    case "storage":
      return 2 ** (0.75 * s);
    case "amenity":
    case "pollution":
      return 2 ** (s / 2);
    case "desirability":
      return 1 + 0.25 * s;
    case "upkeep":
      return 2 ** (0.6 * s);
  }
}

/** A coverage radius (tiles) at a level, from its Lv.1 value. */
export const scaledRadius = (base: number, level: number) => base * levelMultiplier("radius", level);
