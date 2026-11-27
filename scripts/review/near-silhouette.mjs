// Flags look-alike candidates for visual review (docs/redesign/ART-BRIEF.md step 8).
//   node --import tsx scripts/review/near-silhouette.mjs [ids=a,b] [eras=original,ancient-egypt] [min=0.12] [json=out.json]
// Reports, per style: (1) pairs of the listed ids at the same level and variant whose silhouettes are closer than
// `min`; (2) variants of one id/level closer than `min`; (3) adjacent levels of one id/variant closer than min/2.
import fs from "node:fs";
import "../../src/game/designs/index.ts";
import { getMaxElementLevel } from "../../src/game/catalog.ts";
import { loadEraArt } from "../../src/game/eraArtLoader.ts";
import { PRODUCTION_ERAS } from "../../src/game/designs/periodArtCatalog.ts";
import { elementSilhouette, silhouetteDistance } from "./silhouette.ts";

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const ids = (opt.ids ?? "public_library,post_offices,courthouses,city_offices,banks").split(",");
const eras = opt.eras ? opt.eras.split(",") : ["original", ...PRODUCTION_ERAS];
const min = Number(opt.min ?? 0.12);
const report = { min, ids, styles: {} };
for (const era of eras) {
  if (era !== "original") await loadEraArt(era);
  const sil = new Map();
  const get = (id, lv, s) => {
    const key = `${id}|${lv}|${s}`;
    if (!sil.has(key)) sil.set(key, elementSilhouette(id, lv, s, era));
    return sil.get(key);
  };
  const pairs = [], variants = [], levels = [];
  let worstPair = 1;
  for (let lv = 1; lv <= 5; lv++) for (let s = 0; s < 4; s++) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (lv > getMaxElementLevel(ids[i]) || lv > getMaxElementLevel(ids[j])) continue;
      const d = silhouetteDistance(get(ids[i], lv, s), get(ids[j], lv, s));
      worstPair = Math.min(worstPair, d);
      if (d < min) pairs.push([ids[i], ids[j], lv, "ABCD"[s], +d.toFixed(3)]);
    }
  }
  for (const id of ids) for (let lv = 1; lv <= getMaxElementLevel(id); lv++) {
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const d = silhouetteDistance(get(id, lv, a), get(id, lv, b));
      if (d < min) variants.push([id, lv, "ABCD"[a] + "ABCD"[b], +d.toFixed(3)]);
    }
    if (lv > 1) for (let s = 0; s < 4; s++) {
      const d = silhouetteDistance(get(id, lv - 1, s), get(id, lv, s));
      if (d < min / 2) levels.push([id, `${lv - 1}→${lv}`, "ABCD"[s], +d.toFixed(3)]);
    }
  }
  report.styles[era] = { worstPair: +worstPair.toFixed(3), lookalikePairs: pairs, closeVariants: variants, flatUpgrades: levels };
  console.log(era.padEnd(18), "worst pair", worstPair.toFixed(3), "| look-alike pairs", pairs.length, "| close variants", variants.length, "| flat upgrades", levels.length);
}
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(report, null, 1) + "\n");
