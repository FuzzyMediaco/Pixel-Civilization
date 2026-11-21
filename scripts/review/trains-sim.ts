// Review helper: npx tsx scripts/review/trains-sim.ts
// Runs Switchyard City + Orchard Valley practice yard headless and samples train state / effects.
import { createExampleWorld } from "../../src/game/exampleWorlds";
import { visitPracticeRailway } from "../../src/game/practiceRailway";
import { stepSimulation, recomputeConnectivityAndMetrics } from "../../src/game/simulation";
import { transitReadout } from "../../src/game/mobility";
import { railCapacity, trainFor, freightAvailable } from "../../src/game/railOperations";

const base = createExampleWorld("switchyard-city");
recomputeConnectivityAndMetrics(base);
const { state: s } = visitPracticeRailway(base);
const rail = () => s.mobility!.lines.filter((l) => l.mode === "rail");
console.log("rail lines:", rail().map((l) => `${l.id} ${trainFor(l).name} ${trainFor(l).engine}+${trainFor(l).cars.join(",")} cap=${railCapacity(trainFor(l))} depot=${l.depot} stops=${l.stops.length} pattern=${trainFor(l).pattern}`));
const statusTime: Record<string, Record<string, number>> = {};
const moving: Record<string, number> = {};
const dt = 0.1, T = 600;
let bothMoving = 0;
for (let t = 0; t < T; t += dt) {
  stepSimulation(s, dt, true);
  let m = 0;
  for (const l of rail()) {
    const k = l.status.replace(/ to .*| at .*/, "");
    (statusTime[l.id] ??= {})[k] = ((statusTime[l.id] ??= {})[k] ?? 0) + dt;
    if (l.status.startsWith("En route")) { moving[l.id] = (moving[l.id] ?? 0) + dt; m++; }
  }
  if (m >= 2) bothMoving += dt;
}
for (const l of rail()) {
  const r = trainFor(l);
  console.log(`\n${r.name}: departures=${l.departures} delivered=${l.delivered} riders=${l.riders.reduce((n, x) => n + x.count, 0)} ` +
    (r.contract ? `contract ${r.contract.type} delivered=${r.contract.delivered} stockAtSource=${freightAvailable(s, r.contract.source, r.contract.type)}` : ""));
  for (const [k, v] of Object.entries(statusTime[l.id]).sort((a, b) => b[1] - a[1])) console.log(`  ${(100 * v / T).toFixed(0).padStart(3)}%  ${k}`);
}
console.log(`\nseconds with >=2 rail trains moving simultaneously: ${bothMoving.toFixed(1)} / ${T}`);
const rep = transitReadout(s);
console.log("transit readout:", { score: rep.score, served: rep.served, freight: rep.freight, coverage: rep.coverage, wait: rep.wait.toFixed(1), reliability: rep.reliability, pressure: rep.pressure });
console.log("metrics transitTrips/share:", (s as any).metrics?.transitTrips, (s as any).metrics?.transitShare);
console.log("all lines:", s.mobility!.lines.map((l) => `${l.mode}:${l.delivered}`).join(" "));
// the island's own main line (default formation)
