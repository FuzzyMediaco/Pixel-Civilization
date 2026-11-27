/** Eager display names for per-era signature designs. The voxel builders load lazily with each era pack. */
import type { EraNameTable } from "./types";
import ancient_china from "./ancient-china";
import ancient_egypt from "./ancient-egypt";
import rome_aqueduct from "./rome-aqueduct";
import ancient_greece from "./ancient-greece";
import medieval_europe from "./medieval-europe";
import renaissance_italy from "./renaissance-italy";
import world_war_ii from "./world-war-ii";
import art_deco from "./art-deco";
import future_3027 from "./future-3027";
import post_apocalyptic from "./post-apocalyptic";
export type { EraNameTable, SignatureNames } from "./types";

export const ERA_SIGNATURE_NAMES: Readonly<Record<string, EraNameTable>> = {
  "ancient-china": ancient_china,
  "ancient-egypt": ancient_egypt,
  "rome-aqueduct": rome_aqueduct,
  "ancient-greece": ancient_greece,
  "medieval-europe": medieval_europe,
  "renaissance-italy": renaissance_italy,
  "world-war-ii": world_war_ii,
  "art-deco": art_deco,
  "future-3027": future_3027,
  "post-apocalyptic": post_apocalyptic,
};
