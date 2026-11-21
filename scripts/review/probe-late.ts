// Late-game probe: a dense L4-L5 city aiming at Stage 8-10 (real mode).
import { gridCity, run } from "./cityKit";
import { economyOf } from "../../src/game/cityEconomy";
const mode = (process.argv[2] ?? "real") as any;
const { s, failed } = gridCity(mode, [
  { id: "apartment_buildings", level: 5, count: 6 }, { id: "condos", level: 4, count: 4 },
  { id: "buildings", level: 5, count: 6 }, { id: "banks", level: 4, count: 2 }, { id: "malls", level: 4, count: 2 },
  { id: "cheesesteak_restaurants", level: 5, count: 6 }, { id: "grocery_store", level: 5, count: 4 },
  { id: "natural_gas_power_plants", level: 5, count: 3 }, { id: "municipal_reservoir", level: 5, count: 4 }, { id: "water_pumping_station", level: 5, count: 0 },
  { id: "university", level: 5, count: 3 }, { id: "high_school", level: 5, count: 3 }, { id: "large_parks", level: 5, count: 4 }, { id: "italian_gardens", level: 5, count: 4 },
  { id: "government_buildings", level: 5, count: 3 }, { id: "courthouses", level: 4, count: 2 }, { id: "fire_department", level: 4, count: 3 },
  { id: "police_departments", level: 5, count: 4 }, { id: "military_base", level: 5, count: 3 }, { id: "christian_churches", level: 4, count: 3 },
], { rows: 6, money: 500000, x0: -76, x1: 12, z0: -52, industry: [{ id: "trash_burning_plants", level: 5, count: 8 }, { id: "factories", level: 5, count: 4 }] });
console.log("failed", failed, "elements", s.elements.length);
s.highestStageReached = 10;
run(s, Number(process.argv[3] ?? 900), 100);
console.log("roster soldiers", s.metrics.soldiersCount, "tanks", s.metrics.tanksCount, "defPower", s.metrics.defensePower, "required", s.metrics.requiredDefensePower);
