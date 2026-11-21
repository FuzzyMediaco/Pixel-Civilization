// Does the water treatment plant need a river once terrain infrastructure exists?
import { gridCity } from "./cityKit";
import { recomputeConnectivityAndMetrics } from "../../src/game/simulation";
import { applyInfrastructureStroke, freshWaterFactor } from "../../src/game/terrain";
const { s } = gridCity("real", [{ id: "house", level: 1, count: 6 }, { id: "businesses", level: 1, count: 2 }, { id: "water_treatment_plant", level: 1, count: 1 }, { id: "wells", level: 1, count: 1 }], { rows: 1 });
const wtp = s.elements.find(e => e.defId === "water_treatment_plant")!;
console.log("infrastructure?", !!s.infrastructure, "water", s.metrics.waterSupply, "wtp factor", freshWaterFactor(s, wtp));
s.mode = "god"; const r = applyInfrastructureStroke(s, { kind: "raise", radius: 1, height: 0.3 } as any, [{ gx: 40, gz: -30 }]); s.mode = "real";
recomputeConnectivityAndMetrics(s);
console.log("after unrelated terrain edit (valid " + r.valid + "): infrastructure?", !!s.infrastructure, "water", s.metrics.waterSupply, "wtp factor", freshWaterFactor(s, wtp));
