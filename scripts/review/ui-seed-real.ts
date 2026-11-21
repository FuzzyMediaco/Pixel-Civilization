// Writes a real-mode save (built from an example island) for UI screenshots: npx tsx scripts/review/ui-seed-real.ts out.json [worldId]
import fs from "node:fs";
import { EXAMPLE_WORLDS, createExampleWorld, type ExampleWorldId } from "../../src/game/exampleWorlds";
import { recomputeConnectivityAndMetrics } from "../../src/game/simulation";
const id = (process.argv[3] ?? "copper-gorge") as ExampleWorldId;
const s = createExampleWorld(id);
(s as unknown as {_cam: unknown})._cam = EXAMPLE_WORLDS.find(w => w.id === id)!.camera;
s.mode = "real";
delete s.exampleWorldId; delete s.exampleViewpoint; delete s.exampleReturnMode;
s.money = 48250; s.highestStageReached = Math.max(s.highestStageReached ?? 1, 6); s.currentStage = Math.max(s.currentStage, 6);
// Knock out some power so the alert pill has something to say.
s.elements = s.elements.filter(e => !/solar|wind|power_plant|coal|gas_plant|nuclear/.test(e.defId) || Math.random() < 0.3);
recomputeConnectivityAndMetrics(s);
s.toasts = [];
fs.writeFileSync(process.argv[2], JSON.stringify(s));
console.log("pop", s.population, "happy", s.happiness, "diags", s.diagnostics.map(d => d.severity + ":" + d.title).join(" | "));
