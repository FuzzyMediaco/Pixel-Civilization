// Review: dump element stats, footprint by level, and upkeep to CSV-ish table.
import { ELEMENTS, getStandardFootprintForLevel, getUpgradeCost, getMaxElementLevel } from "../../src/game/catalog";
import { upkeepFor } from "../../src/game/cityDynamics";
const keys = ["popBase","jobs","power","water","waste","food","education","recreation","government","police","policeRadius","fireRadius","military","nuisanceRadius","income"] as const;
const only = process.argv[2];
console.log(["id","cat","stg","cost","maxL",...keys,"upk1","upk5","upgCostTo5","fp1","fp5"].join("\t"));
for (const d of ELEMENTS) {
  if (only && d.category !== only) continue;
  if (d.isNetwork && only !== "net") continue;
  const fp1 = getStandardFootprintForLevel(d,1), fp5 = getStandardFootprintForLevel(d,5);
  let up = 0; for (let l=1;l<5;l++) up += getUpgradeCost(d,l);
  console.log([d.id,d.category,d.stage,d.cost,getMaxElementLevel(d.id),...keys.map(k=>(d as any)[k]??""),upkeepFor(d,1).toFixed(1),upkeepFor(d,5).toFixed(1),up,fp1.join("x"),fp5.join("x")].join("\t"));
}
