// Review helper: npx tsx scripts/review/trains-perf.ts — times stepMobility and rail path calls in the practice yard.
import { createExampleWorld } from "../../src/game/exampleWorlds";
import { visitPracticeRailway } from "../../src/game/practiceRailway";
import { recomputeConnectivityAndMetrics } from "../../src/game/simulation";
import { stepMobility } from "../../src/game/mobility";
import { getTravelNetwork, TravelNetwork } from "../../src/game/travelNetwork";
const base = createExampleWorld("switchyard-city"); recomputeConnectivityAndMetrics(base);
const { state: s } = visitPracticeRailway(base);
let t0 = performance.now();
for (let i = 0; i < 6000; i++) { s.activePlaySec = (s.activePlaySec ?? 0) + 0.1; stepMobility(s, 0.1); }
console.log("stepMobility x6000 (600s game):", (performance.now() - t0).toFixed(0), "ms");
const net = getTravelNetwork(s);
const rails = s.elements.filter((e) => e.defId === "train_tracks");
t0 = performance.now();
for (let i = 0; i < 2000; i++) { const a = rails[i % rails.length], b = rails[(i * 7) % rails.length]; net.path([[a.gx, a.gz]], [[b.gx, b.gz]], "rail"); }
console.log("rail net.path x2000:", (performance.now() - t0).toFixed(0), "ms, tiles", rails.length);
t0 = performance.now(); for (let i = 0; i < 20; i++) new TravelNetwork(s); console.log("new TravelNetwork x20:", (performance.now() - t0).toFixed(0), "ms");
