// Analytic: for each stage threshold, cheapest-per-dollar L-n buildings that satisfy the pop-cap supply rules.
import { ELEMENTS, STAGES, getStandardFootprintForLevel, getUpgradeCost, type CivElementDef } from "../../src/game/catalog";
import { upkeepFor } from "../../src/game/cityDynamics";
const L = Number(process.argv[2] ?? 5);
const sortBy = process.argv[3] ?? "cost"; // or "tiles"
const cost = (d: CivElementDef) => { let c = d.cost; for (let l = 1; l < L; l++) c += getUpgradeCost(d, l); return c; };
const tiles = (d: CivElementDef) => { const [a, b] = getStandardFootprintForLevel(d, L); return a * b; };
const mult = 2 ** (L - 1);
const needs: Record<string, { per: number; val: (d: CivElementDef) => number }> = {
  housing: { per: 1 / 21 / 1.2, val: d => d.category === "housing" ? (d.popBase ?? 0) * mult : 0 },
  waste: { per: 0.28, val: d => Math.max(0, d.waste ?? 0) * mult },
  food_retail: { per: 0.28, val: d => d.id === "grocery_store" || d.archetype === "restaurant_bar" ? (d.food ?? 24) * 1.45 * 2.25 ** (L - 1) : 0 },
  jobs: { per: 0.54, val: d => Math.max(0, d.jobs ?? 0) * mult },
  education: { per: 0.26, val: d => Math.max(0, d.education ?? 0) * mult },
  recreation: { per: 0.24, val: d => Math.max(0, d.recreation ?? 0) * mult },
  government: { per: 0.30, val: d => Math.max(0, d.government ?? 0) * mult },
};
for (const s of STAGES.filter(s => [2, 3, 5, 8, 10, 13, 16, 20].includes(s.stage))) {
  const P = s.minPop;
  const avail = ELEMENTS.filter(d => d.stage <= s.stage && !d.isNetwork && !d.wealthThreshold);
  let totCost = 0, totTiles = 0, totUpk = 0; const parts: string[] = [];
  for (const [k, n] of Object.entries(needs)) {
    if (k === "government" && s.stage < 3) continue;
    const metric = (d: CivElementDef, v: number) => sortBy === "tiles" ? v / tiles(d) : v / cost(d);
    const best = avail.map(d => ({ d, v: n.val(d) })).filter(x => x.v > 0).sort((a, b) => metric(b.d, b.v) - metric(a.d, a.v))[0];
    if (!best) { parts.push(k + ":NONE"); continue; }
    const count = Math.ceil(P * n.per / best.v);
    totCost += count * cost(best.d); totTiles += count * tiles(best.d); totUpk += count * upkeepFor(best.d, L) * 0.06;
    parts.push(`${k}:${count}x${best.d.id}`);
  }
  console.log(`S${s.stage} pop ${P}: L${L} cost ${Math.round(totCost)} tiles ${totTiles} upkeep/s ${totUpk.toFixed(0)}  ${parts.join(" ")}`);
}
