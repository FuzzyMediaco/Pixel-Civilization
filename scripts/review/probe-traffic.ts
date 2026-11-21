// Traffic: does congestion depend on population? And how does it swing over a day?
import { gridCity } from "./cityKit";
import { recomputeConnectivityAndMetrics } from "../../src/game/simulation";
const { s } = gridCity("real", [
  { id: "townhomes", level: 2, count: 16 }, { id: "medium_sized_homes", level: 2, count: 12 }, { id: "apartments", level: 2, count: 6 },
  { id: "businesses", level: 3, count: 12 }, { id: "shops", level: 2, count: 6 }, { id: "grocery_store", level: 3, count: 4 },
  { id: "wind_turbines", level: 3, count: 8 }, { id: "water_towers", level: 3, count: 4 }, { id: "school", level: 3, count: 3 }, { id: "park", level: 3, count: 6 },
], { rows: 4, money: 20000, industry: [{ id: "landfill", level: 3, count: 10 }] });
for (const pool of [0, 5000, 50000]) {
  s.growthPool = pool; s.timeOfDay = 8;
  recomputeConnectivityAndMetrics(s);
  console.log(`pop ${s.population}: trips ${s.metrics.trafficTrips} capacity ${s.metrics.trafficCapacity} congestion ${s.metrics.congestion}%`);
}
s.growthPool = 0;
const out: string[] = [];
for (let h = 0; h < 24; h += 2) { s.timeOfDay = h; recomputeConnectivityAndMetrics(s); out.push(`${h}h:${s.metrics.congestion}%`); }
console.log("daily congestion", out.join(" "));
