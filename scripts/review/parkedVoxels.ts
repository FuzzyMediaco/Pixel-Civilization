// The resting model shared by illustrated Handbook cells and optional moving-part silhouette reviews.
import type { Ctx } from "../../src/game/designs/kit";
import { buildCritterPens, critterModel, CRITTER_UNIT, restingCritters } from "../../src/game/critterModels";
import { packVoxKey, VOXEL_SIZE } from "../../src/game/voxelCore";

/** Finish a fresh design context in-place, using the same pivot and pen placements as the static preview. */
export function parkedVoxels(c: Ctx): Map<number, number> {
  const map = c.v.v;
  for (const r of c.rotors)
    for (const [k, s] of r.vox.v)
      map.set(
        packVoxKey(
          ((k >>> 20) & 1023) - 512 + Math.round(r.pivot[0]),
          ((k >>> 10) & 1023) - 512 + Math.round(r.pivot[1]),
          (k & 1023) - 512 + Math.round(r.pivot[2]),
        ),
        s,
      );
  // Plate cells use design voxels. Project the game's half-voxel resting poses into that grid.
  for (const [index, pen] of buildCritterPens(c.critterPens, VOXEL_SIZE, 0, 1).entries()) {
    const animal = critterModel(pen.kind, pen.coat).restVoxels;
    for (const pose of restingCritters(pen, index)) {
      const cos = Math.cos(pose.heading), sin = Math.sin(pose.heading);
      for (const [key, style] of animal.v) {
        const x = (((key >>> 20) & 1023) - 511.5) * CRITTER_UNIT;
        const y = (((key >>> 10) & 1023) - 511.5) * CRITTER_UNIT;
        const z = ((key & 1023) - 511.5) * CRITTER_UNIT;
        map.set(packVoxKey(
          Math.floor((pose.x + cos * x + sin * z) / VOXEL_SIZE),
          Math.floor((pose.y + y) / VOXEL_SIZE),
          Math.floor((pose.z - sin * x + cos * z) / VOXEL_SIZE),
        ), style);
      }
    }
  }
  return map;
}
