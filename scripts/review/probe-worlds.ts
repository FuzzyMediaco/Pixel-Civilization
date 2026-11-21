// Review probe: run example worlds in god/real modes and print key metrics over time.
import { createExampleWorld, EXAMPLE_WORLDS } from "../../src/game/exampleWorlds";
import { stepSimulation, recomputeConnectivityAndMetrics, type GameState } from "../../src/game/simulation";
import { economyOf, cityWealth } from "../../src/game/cityEconomy";
import { ELEMENT_BY_ID } from "../../src/game/catalog";
const mode = (process.argv[2] ?? "real") as any;
const secs = Number(process.argv[3] ?? 600);
function row(s: GameState, t: number) {
  const m = s.metrics, r = economyOf(s).report;
  return [t, s.population, s.happiness, s.currentStage, Math.round(s.money), Math.round(s.growthPool),
    `P${m.powerSupply}/${m.powerDemand}`, `W${m.waterSupply}/${m.waterDemand}`, `Ws${m.wasteCapacity}/${m.wasteDemand}`,
    `J${m.jobsAvailable}/${m.jobsNeeded}`, `F${m.foodSupply}/${m.foodDemand}`, `E${m.educationSupply}/${m.educationDemand}`,
    `R${m.recreationSupply}/${m.recreationDemand}`, `G${m.govSupply}/${m.govDemand}`, `cr${m.crimeRate}`, `cg${m.congestion}`,
    `tax${r.tax.toFixed(1)} net${(r.treasuryNet??0).toFixed(1)} upk${m.upkeepPerTick} exp${r.exports.toFixed(1)}`, `short${r.shortage.toFixed(2)} cap${r.capacity}`,
    s.diagnostics.filter(d=>d.deltaHappiness).map(d=>d.id+d.deltaHappiness).join(",")].join(" | ");
}
for (const w of EXAMPLE_WORLDS) {
  const s = createExampleWorld(w.id as any);
  s.mode = mode;
  s.timeLocked = false; s.weatherLocked = false;
  recomputeConnectivityAndMetrics(s);
  const counts: Record<string, number> = {};
  for (const e of s.elements) { const d = ELEMENT_BY_ID[e.defId]; if (!d.isNetwork && !d.passiveNature) counts[e.defId] = (counts[e.defId] ?? 0) + 1; }
  console.log("\n=== " + w.id + " mode=" + mode + " elements=" + s.elements.length);
  console.log(Object.entries(counts).map(([k, v]) => k + "x" + v).join(" "));
  for (let t = 0; t <= secs; t++) {
    if (t % Math.max(1, Math.floor(secs / 12)) === 0) console.log(row(s, t));
    stepSimulation(s, 1, true);
    if (s.gameOver) { console.log("GAME OVER", s.gameOverReason); break; }
  }
  console.log("wealth", Math.round(cityWealth(s)), "hh", Math.round(economyOf(s).households), "biz", Math.round(economyOf(s).businesses));
}
