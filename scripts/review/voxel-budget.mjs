// Voxel counts and build errors for redesigned elements (docs/redesign/CIVIC-FIVE-SPEC.md budget: ~15k typical, 40k max).
//   node --import tsx scripts/review/voxel-budget.mjs [ids=a,b] [eras=original,ancient-egypt]
// Prints, per style and id, the largest model (level/variant) and flags builds that threw (magenta box) or exceed 40k.
import "../../src/game/designs/index.ts";
import { ELEMENT_BY_ID, getMaxElementLevel, getStandardFootprintForLevel } from "../../src/game/catalog.ts";
import { loadEraArt } from "../../src/game/eraArtLoader.ts";
import { PRODUCTION_ERAS } from "../../src/game/designs/periodArtCatalog.ts";
import { buildDesignVoxels } from "../../src/game/voxelArchitect.ts";

const opt = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
const ids = (opt.ids ?? "public_library,post_offices,courthouses,city_offices,banks").split(",");
const eras = opt.eras ? opt.eras.split(",") : ["original", ...PRODUCTION_ERAS];
let failures = 0;
const errors = [];
const origError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(" ")); };
for (const era of eras) {
  if (era !== "original") await loadEraArt(era);
  const parts = [];
  for (const id of ids) {
    const def = ELEMENT_BY_ID[id];
    let max = 0, at = "", sum = 0, n = 0;
    for (let lv = 1; lv <= getMaxElementLevel(id); lv++) for (let s = 0; s < 4; s++) {
      const [w, d] = getStandardFootprintForLevel(def, lv);
      errors.length = 0;
      const c = buildDesignVoxels(def, lv, s, w, d, def.isNetwork ? 5 : 0, era === "original" ? {} : { era, eraActivity: "active" });
      let count = c.v.v.size;
      for (const r of c.rotors) count += r.vox.v.size;
      if (errors.length) { failures++; origError(`  THREW ${era} ${id} L${lv} ${"ABCD"[s]}: ${errors[0].slice(0, 200)}`); }
      if (count > 40000) { failures++; origError(`  OVER 40k ${era} ${id} L${lv} ${"ABCD"[s]}: ${count}`); }
      sum += count; n++;
      if (count > max) { max = count; at = `L${lv}${"ABCD"[s]}`; }
    }
    parts.push(`${id} max ${max} (${at}) avg ${Math.round(sum / n)}`);
  }
  console.log(era.padEnd(18), parts.join(" | "));
}
console.error = origError;
if (failures) { console.log(`${failures} problem build(s)`); process.exitCode = 1; }
