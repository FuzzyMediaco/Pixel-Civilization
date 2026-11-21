// Crime / defense / fire snapshot on the late city at forced population levels (real mode).
import { gridCity } from "./cityKit";
import { recomputeConnectivityAndMetrics, stepSimulation } from "../../src/game/simulation";
import { fireServiceReadiness } from "../../src/game/projectOperations";
import { faithServices } from "../../src/game/faith";
const policeCount = Number(process.argv[2] ?? 4);
const { s } = gridCity("real", [
  { id: "apartment_buildings", level: 5, count: 6 }, { id: "condos", level: 4, count: 4 },
  { id: "buildings", level: 5, count: 6 }, { id: "banks", level: 4, count: 2 }, { id: "malls", level: 4, count: 2 },
  { id: "cheesesteak_restaurants", level: 5, count: 6 }, { id: "grocery_store", level: 5, count: 4 },
  { id: "natural_gas_power_plants", level: 5, count: 3 }, { id: "municipal_reservoir", level: 5, count: 4 },
  { id: "university", level: 5, count: 3 }, { id: "high_school", level: 5, count: 3 }, { id: "large_parks", level: 5, count: 4 }, { id: "italian_gardens", level: 5, count: 4 },
  { id: "government_buildings", level: 5, count: 3 }, { id: "courthouses", level: 4, count: 2 }, { id: "fire_department", level: 4, count: 3 },
  { id: "police_departments", level: 5, count: policeCount }, { id: "military_base", level: 5, count: 3 }, { id: "christian_churches", level: 4, count: 3 },
], { rows: 6, money: 500000, x0: -76, x1: 12, z0: -52, industry: [{ id: "trash_burning_plants", level: 5, count: 8 }, { id: "factories", level: 5, count: 4 }] });
for (let t = 0; t < 60; t++) stepSimulation(s, 1, true); // staff the economy
for (const [stage, pop] of [[5, 90000], [7, 210000], [10, 500000], [13, 1_020_000], [16, 1_900_000]] as const) {
  s.highestStageReached = stage;
  for (const hour of [12, 23]) {
    s.timeOfDay = hour;
    s.growthPool = pop - (s.population - s.growthPool);
    recomputeConnectivityAndMetrics(s);
    const m = s.metrics, f = fireServiceReadiness(s), faith = faithServices(s);
    const covered = s.elements.filter(e => e.hasPoliceCover).length;
    console.log(`stage ${stage} pop ${s.population} hour ${hour}: crime ${m.crimeRate}% (unlocked ${m.crimeUnlocked}) policeCover ${covered} | defense ${m.defenseRating}% power ${m.defensePower}/${m.requiredDefensePower} | fire crews ${f.crews}/${f.required} coverage ${f.coverage.toFixed(2)} chance ${f.chance.toFixed(1)}% | faith +${faith.happiness} hap -${faith.crime} crime | hap ${s.happiness} :: ${s.diagnostics.filter(d => d.deltaHappiness).map(d => d.id + d.deltaHappiness).join(",")}`);
  }
}
