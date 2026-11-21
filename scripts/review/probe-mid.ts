// Mid-game probe: a stage 3-5 sized town (real mode), industry on the far street.
import { gridCity, run } from "./cityKit";
const mode = (process.argv[2] ?? "real") as any;
const { s, failed } = gridCity(mode, [
  { id: "townhomes", level: 2, count: 16 }, { id: "medium_sized_homes", level: 2, count: 12 }, { id: "apartments", level: 2, count: 6 },
  { id: "businesses", level: 3, count: 12 }, { id: "shops", level: 2, count: 6 }, { id: "grocery_store", level: 3, count: 4 }, { id: "restaurants", level: 2, count: 4 },
  { id: "wind_turbines", level: 3, count: 8 }, { id: "water_towers", level: 3, count: 4 }, { id: "water_treatment_plant", level: 3, count: 2 },
  { id: "school", level: 3, count: 3 }, { id: "elementary_school", level: 2, count: 3 }, { id: "high_school", level: 2, count: 1 },
  { id: "park", level: 3, count: 6 }, { id: "little_parks", level: 2, count: 8 }, { id: "city_offices", level: 2, count: 2 }, { id: "fire_department", level: 2, count: 2 },
  { id: "police_precinct", level: 2, count: 3 }, { id: "tax_collecting_office", level: 1, count: 1 },
], { rows: 5, money: 20000, x0: -66, x1: 6, industry: [{ id: "landfill", level: 3, count: 6 }, { id: "trash_compacting_plants", level: 2, count: 3 }, { id: "factories", level: 2, count: 3 }] });
console.log("failed", failed, "elements", s.elements.length);
run(s, Number(process.argv[3] ?? 1200), 100);
