// Review: confirm passive nature elements supply services with no road / upkeep.
import { ELEMENTS } from "../../src/game/catalog";
import { createInitialGameState, recomputeConnectivityAndMetrics } from "../../src/game/simulation";
import { place } from "./cityKit";
for (const d of ELEMENTS.filter(d => d.passiveNature && !d.isNetwork && ((d.water ?? 0) > 0 || (d.recreation ?? 0) > 0 || (d.waste ?? 0) > 0 || (d.food ?? 0) > 0 || (d.power ?? 0) > 0))) {
  const s = createInitialGameState("god");
  let n = 0;
  for (let i = 0; i < 10; i++) if (place(s, d.id, -50 + i * 5, -30, 1)) n++;
  s.mode = "real";
  recomputeConnectivityAndMetrics(s);
  console.log(d.id.padEnd(16), "placed", n, "water", s.metrics.waterSupply, "rec", s.metrics.recreationSupply, "waste", s.metrics.wasteCapacity, "food", s.metrics.foodSupply, "upk", s.metrics.upkeepPerTick, "isWaterFeature", !!d.isWaterFeature, "cost", d.cost);
}
