// Early-game probe: a starter town in real mode.
import { gridCity, run } from "./cityKit";
const mode = (process.argv[2] ?? "real") as any;
const { s, failed } = gridCity(mode, [
  { id: "house", level: 1, count: 20 }, { id: "businesses", level: 1, count: 4 }, { id: "shops", level: 1, count: 2 },
  { id: "grocery_store", level: 1, count: 2 }, { id: "solar_panels", level: 1, count: 2 }, { id: "water_treatment_plant", level: 1, count: 1 },
  { id: "landfill", level: 1, count: 2 }, { id: "school", level: 1, count: 1 }, { id: "park", level: 1, count: 2 },
], { rows: 2, money: 2800 });
console.log("failed", failed, "elements", s.elements.length);
run(s, Number(process.argv[3] ?? 900), 60);
