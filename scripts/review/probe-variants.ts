// Compare early-town variants: steady-state pop, happiness and treasury net/s after 10 minutes (real mode).
import { gridCity } from "./cityKit";
import { stepSimulation } from "../../src/game/simulation";
import { economyOf } from "../../src/game/cityEconomy";
const base = [
  { id: "house", level: 1, count: 20 }, { id: "businesses", level: 1, count: 4 }, { id: "shops", level: 1, count: 2 },
  { id: "windmills", level: 1, count: 3 }, { id: "water_treatment_plant", level: 1, count: 1 }, { id: "school", level: 1, count: 1 }, { id: "park", level: 1, count: 2 },
];
const variants: Record<string, { specs: any[]; ind: any[] }> = {
  grocers: { specs: [...base, { id: "grocery_store", level: 1, count: 2 }], ind: [{ id: "landfill", level: 1, count: 3 }] },
  farms: { specs: [...base, { id: "farms", level: 1, count: 3 }], ind: [{ id: "landfill", level: 1, count: 3 }] },
  farms_grocer: { specs: [...base, { id: "farms", level: 1, count: 3 }, { id: "grocery_store", level: 1, count: 1 }], ind: [{ id: "landfill", level: 1, count: 3 }] },
  solar_only: { specs: [...base.filter(x => x.id !== "windmills"), { id: "solar_panels", level: 1, count: 3 }, { id: "grocery_store", level: 1, count: 2 }], ind: [{ id: "landfill", level: 1, count: 3 }] },
  more_waste: { specs: [...base, { id: "grocery_store", level: 1, count: 2 }], ind: [{ id: "landfill", level: 1, count: 8 }] },
  upgraded: { specs: [{ id: "house", level: 3, count: 10 }, { id: "businesses", level: 3, count: 2 }, { id: "shops", level: 2, count: 2 }, { id: "windmills", level: 3, count: 2 }, { id: "water_treatment_plant", level: 3, count: 1 }, { id: "school", level: 3, count: 1 }, { id: "park", level: 3, count: 1 }, { id: "grocery_store", level: 3, count: 1 }], ind: [{ id: "landfill", level: 3, count: 3 }] },
};
for (const [name, v] of Object.entries(variants)) {
  const { s } = gridCity("real", v.specs, { rows: 3, money: 2800, industry: v.ind });
  for (let t = 0; t < 480; t++) stepSimulation(s, 1, true);
  const m0 = s.money; let minH = 100, maxH = 0, minP = 1e9, maxP = 0;
  for (let t = 0; t < 240; t++) { stepSimulation(s, 1, true); minH = Math.min(minH, s.happiness); maxH = Math.max(maxH, s.happiness); minP = Math.min(minP, s.population); maxP = Math.max(maxP, s.population); }
  const m = s.metrics, r = economyOf(s).report;
  console.log(name.padEnd(13), `pop ${minP}-${maxP} hap ${minH}-${maxH} treasury/s ${((s.money - m0) / 240).toFixed(2)} hh ${Math.round(economyOf(s).households)} | W${m.waterSupply}/${m.waterDemand} Ws${m.wasteCapacity}/${m.wasteDemand} F${m.foodSupply}/${m.foodDemand} J${m.jobsAvailable}/${m.jobsNeeded} P${m.powerSupply}/${m.powerDemand} short ${r.shortage.toFixed(2)} harvest ${r.harvest.toFixed(2)} imports ${r.imports.toFixed(2)} | ${s.diagnostics.filter(d => d.deltaHappiness).map(d => d.id + d.deltaHappiness).join(",")}`);
}
