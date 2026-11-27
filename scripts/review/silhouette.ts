/**
 * Near-silhouette comparison for the illustrated-catalog review (docs/redesign/ART-BRIEF.md step 8).
 * Exact-hash checks miss a one-voxel trim or a recolor; this compares what a player reads from the game
 * camera: the overhead height field and the two street elevations, normalised to the parcel.
 */
import { parkedVoxels } from "./parkedVoxels";
import { buildDesignVoxels } from "../../src/game/voxelArchitect";
import { ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel } from "../../src/game/catalog";
import type { EraKey } from "../../src/game/eraStyles";

const N = 12;
export interface Silhouette { plan: Float32Array; front: Float32Array; side: Float32Array; top: number }

export function silhouetteOf(map: Map<number, number>, hx: number, hz: number): Silhouette {
  const plan = new Float32Array(N * N), front = new Float32Array(N), side = new Float32Array(N);
  let top = 0;
  for (const k of map.keys()) {
    const x = ((k >>> 20) & 1023) - 512, y = ((k >>> 10) & 1023) - 512, z = (k & 1023) - 512;
    if (y < 1) continue;
    const gx = Math.min(N - 1, Math.max(0, Math.floor(((x + hx) / (2 * hx)) * N)));
    const gz = Math.min(N - 1, Math.max(0, Math.floor(((z + hz) / (2 * hz)) * N)));
    const h = y + 1;
    if (h > plan[gz * N + gx]) plan[gz * N + gx] = h;
    if (h > front[gx]) front[gx] = h;
    if (h > side[gz]) side[gz] = h;
    if (h > top) top = h;
  }
  return { plan, front, side, top };
}

/** 0 = the same read from above and from the street; ~0.3+ = clearly different massing. */
export function silhouetteDistance(a: Silhouette, b: Silhouette): number {
  const scale = Math.max(a.top, b.top, 1);
  const mean = (p: Float32Array, q: Float32Array) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) s += Math.abs(p[i] - q[i]);
    return s / p.length / scale;
  };
  let inter = 0, union = 0;
  for (let i = 0; i < a.plan.length; i++) {
    const pa = a.plan[i] > 1, pb = b.plan[i] > 1;
    if (pa && pb) inter++;
    if (pa || pb) union++;
  }
  const footprint = union ? 1 - inter / union : 0;
  return 0.4 * mean(a.plan, b.plan) + 0.2 * mean(a.front, b.front) + 0.2 * mean(a.side, b.side) + 0.2 * footprint;
}

export type SilhouetteParts = "base" | "parked";

export function elementSilhouette(
  id: string, level: number, variant: number, era: EraKey = "original", parts: SilhouetteParts = "base",
): Silhouette {
  const def = ELEMENT_BY_ID[id];
  const lv = Math.min(level, getMaxElementLevel(id));
  const [w, d] = getStandardFootprintForLevel(def, lv);
  const c = buildDesignVoxels(def, lv, variant, w, d, def.isNetwork ? 5 : 0, era === "original" ? {} : { era, eraActivity: "active" });
  return silhouetteOf(parts === "parked" ? parkedVoxels(c) : c.v.v, c.hx, c.hz);
}
