// Review: L1 vs L5 output per tile and per dollar for each stat, to spot footprint/level outliers.
import { ELEMENTS, getStandardFootprintForLevel, getUpgradeCost } from "../../src/game/catalog";
const stat = (process.argv[2] ?? "power") as any;
const rows = ELEMENTS.filter(d => (d as any)[stat] > 0 && !d.isNetwork).map(d => {
  const [a, b] = getStandardFootprintForLevel(d, 1), [c, e] = getStandardFootprintForLevel(d, 5);
  let cost = d.cost; for (let l = 1; l < 5; l++) cost += getUpgradeCost(d, l);
  const v = (d as any)[stat];
  return { id: d.id, stg: d.stage, v1: v, perTile1: v / (a * b), perTile5: v * 16 / (c * e), tiles5: c * e, perK1: 1000 * v / d.cost, perK5: 1000 * v * 16 / cost, nature: !!d.passiveNature };
}).sort((x, y) => y.perTile5 - x.perTile5);
for (const r of rows) console.log(r.id.padEnd(26), "S" + r.stg, "base", r.v1, "tiles5", r.tiles5, "perTile L1", r.perTile1.toFixed(1), "L5", r.perTile5.toFixed(1), " per$1k L1", r.perK1.toFixed(0), "L5", r.perK5.toFixed(0), r.nature ? "NATURE(no upkeep/road)" : "");
