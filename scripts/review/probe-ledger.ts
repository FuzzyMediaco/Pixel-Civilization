// Ledger breakdown: money flows per label over a window, for the mid-game town.
import { gridCity } from "./cityKit";
import { stepSimulation } from "../../src/game/simulation";
import { economyOf } from "../../src/game/cityEconomy";
const preset = process.argv[2] ?? "mid";
const specs: any = {
  early: [[{ id: "house", level: 1, count: 20 }, { id: "businesses", level: 1, count: 4 }, { id: "shops", level: 1, count: 2 }, { id: "grocery_store", level: 1, count: 2 }, { id: "windmills", level: 1, count: 3 }, { id: "water_treatment_plant", level: 1, count: 1 }, { id: "school", level: 1, count: 1 }, { id: "park", level: 1, count: 2 }], [{ id: "landfill", level: 1, count: 3 }]],
  mid: [[{ id: "townhomes", level: 2, count: 16 }, { id: "medium_sized_homes", level: 2, count: 12 }, { id: "apartments", level: 2, count: 6 }, { id: "businesses", level: 3, count: 12 }, { id: "shops", level: 2, count: 6 }, { id: "grocery_store", level: 3, count: 4 }, { id: "restaurants", level: 2, count: 4 }, { id: "wind_turbines", level: 3, count: 8 }, { id: "water_towers", level: 3, count: 4 }, { id: "water_treatment_plant", level: 3, count: 2 }, { id: "school", level: 3, count: 3 }, { id: "elementary_school", level: 2, count: 3 }, { id: "high_school", level: 2, count: 1 }, { id: "park", level: 3, count: 6 }, { id: "little_parks", level: 2, count: 8 }, { id: "city_offices", level: 2, count: 2 }, { id: "fire_department", level: 2, count: 2 }, { id: "police_precinct", level: 2, count: 3 }, { id: "tax_collecting_office", level: 1, count: 1 }], [{ id: "landfill", level: 3, count: 10 }, { id: "trash_compacting_plants", level: 2, count: 3 }, { id: "factories", level: 2, count: 3 }]],
};
const [a, b] = specs[preset];
const { s } = gridCity("real", a, { rows: 5, money: 20000, x0: -66, x1: 6, industry: b });
for (let t = 0; t < 300; t++) stepSimulation(s, 1, true);
const e = economyOf(s); e.ledger.length = 0;
for (let t = 0; t < 120; t++) stepSimulation(s, 1, true);
const sums: Record<string, number> = {};
for (const x of e.ledger) { const k = `${x.from}->${x.to} ${x.label}`; sums[k] = (sums[k] ?? 0) + x.amount; }
for (const [k, v] of Object.entries(sums).sort((p, q) => q[1] - p[1])) console.log((v / 120).toFixed(1).padStart(9), "/s ", k);
console.log("pop", s.population, "hap", s.happiness, "money", Math.round(s.money), "hh", Math.round(e.households), "biz", Math.round(e.businesses));
