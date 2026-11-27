// Flags look-alike candidates for visual review (docs/redesign/ART-BRIEF.md step 8).
//   node --import tsx scripts/review/near-silhouette.mjs [ids=a,b] [eras=original,ancient-egypt] [slots=matching|all] [parts=base|parked] [min=0.12] [json=out.json]
// Cross-building slots share a playable level. The report also checks same-building variants (min)
// and consecutive levels of each variant (min/2).
import fs from "node:fs";
import "../../src/game/designs/index.ts";
import { ELEMENT_BY_ID, getMaxElementLevel } from "../../src/game/catalog.ts";
import { loadEraArt } from "../../src/game/eraArtLoader.ts";
import { PRODUCTION_ERAS } from "../../src/game/designs/periodArtCatalog.ts";
import { elementSilhouette, silhouetteDistance } from "./silhouette.ts";

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const ids = (opt.ids ?? "public_library,post_offices,courthouses,city_offices,banks").split(",");
const eras = opt.eras ? opt.eras.split(",") : ["original", ...PRODUCTION_ERAS];
const min = Number(opt.min ?? 0.12);
const slots = opt.slots ?? "matching";
const parts = opt.parts ?? "base";
if (!["matching", "all"].includes(slots)) throw new Error("slots must be matching or all");
if (!["base", "parked"].includes(parts)) throw new Error("parts must be base or parked");
if (!Number.isFinite(min) || min < 0) throw new Error("min must be a nonnegative finite distance");
for (const id of ids) if (!ELEMENT_BY_ID[id]) throw new Error(`Unknown element: ${id}`);
for (const era of eras) if (era !== "original" && !PRODUCTION_ERAS.includes(era)) throw new Error(`Unknown era: ${era}`);
const maxLevels = new Map(ids.map(id => [id, getMaxElementLevel(id)]));
// Older reports used the same base-voxel metric, with cross-element comparisons capped at level five.
const report = { metric: "parcel-height-field-v1", parts, slots, min, ids,
  maxLevels: Object.fromEntries(maxLevels), styles: {} };
console.log(`parcel-height-field-v1 · ${parts} parts · ${slots} cross-element slots`);
for (const era of eras) {
  if (era !== "original") await loadEraArt(era);
  const sil = new Map();
  const get = (id, lv, s) => {
    const key = `${id}|${lv}|${s}`;
    if (!sil.has(key)) sil.set(key, elementSilhouette(id, lv, s, era, parts));
    return sil.get(key);
  };
  const pairs = [], variants = [], levels = [];
  let worstPair = Infinity, pairComparisons = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const left = ids[i], right = ids[j];
    const lastSharedLevel = Math.min(maxLevels.get(left), maxLevels.get(right));
    for (let lv = 1; lv <= lastSharedLevel; lv++) for (let a = 0; a < 4; a++) {
      const first = slots === "all" ? 0 : a, last = slots === "all" ? 3 : a;
      for (let b = first; b <= last; b++) {
        const d = silhouetteDistance(get(left, lv, a), get(right, lv, b));
        pairComparisons++;
        worstPair = Math.min(worstPair, d);
        const label = slots === "matching" ? "ABCD"[a] : `${"ABCD"[a]}/${"ABCD"[b]}`;
        if (d < min) pairs.push([left, right, lv, label, +d.toFixed(3)]);
      }
    }
  }
  for (const id of ids) for (let lv = 1; lv <= maxLevels.get(id); lv++) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const d = silhouetteDistance(get(id, lv, a), get(id, lv, b));
      if (d < min) variants.push([id, lv, "ABCD"[a] + "ABCD"[b], +d.toFixed(3)]);
    }
    if (lv > 1) for (let s = 0; s < 4; s++) {
      const d = silhouetteDistance(get(id, lv - 1, s), get(id, lv, s));
      if (d < min / 2) levels.push([id, `${lv - 1}→${lv}`, "ABCD"[s], +d.toFixed(3)]);
    }
  }
  report.styles[era] = { pairComparisons, worstPair: pairComparisons ? +worstPair.toFixed(3) : null, lookalikePairs: pairs, closeVariants: variants, flatUpgrades: levels };
  console.log(era.padEnd(18), pairComparisons, "cross-element comparisons | worst pair", pairComparisons ? worstPair.toFixed(3) : "n/a", "| look-alike pairs", pairs.length, "| close variants", variants.length, "| flat upgrades", levels.length);
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(report, null, 1) + "\n");
