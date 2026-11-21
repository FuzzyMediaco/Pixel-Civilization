// Save robustness: unknown element ids, level > max, missing economy.
import { gridCity } from "./cityKit";
import { cloneGameStateSnapshot } from "../../src/game/saveSlots";
import { stepSimulation } from "../../src/game/simulation";
const { s } = gridCity("real", [{ id: "house", level: 1, count: 6 }, { id: "businesses", level: 1, count: 2 }, { id: "windmills", level: 1, count: 1 }], { rows: 1 });
const json = JSON.parse(JSON.stringify(s));
json.elements[json.elements.length - 1].defId = "removed_building";
try { const c = cloneGameStateSnapshot(json); for (let i = 0; i < 5; i++) stepSimulation(c, 1, true); console.log("unknown id: ok, pop", c.population); } catch (e) { console.log("unknown id: CRASH", (e as Error).message); }
const j2 = JSON.parse(JSON.stringify(s)); const h = j2.elements.find((e: any) => e.defId === "house"); h.level = 9;
try { const c = cloneGameStateSnapshot(j2); console.log("level 9 house: ok pop", c.population); } catch (e) { console.log("level9 CRASH", (e as Error).message); }
const j3 = JSON.parse(JSON.stringify(s)); delete j3.economy; delete j3.mobility; delete j3.faith;
try { const c = cloneGameStateSnapshot(j3); for (let i = 0; i < 5; i++) stepSimulation(c, 1, true); console.log("no economy: ok pop", c.population); } catch (e) { console.log("no economy CRASH", (e as Error).message); }
const j4 = JSON.parse(JSON.stringify(s)); const r = j4.elements.find((e: any) => e.defId === "roads"); r.defId = "removed_road";
try { const c = cloneGameStateSnapshot(j4); for (let i = 0; i < 5; i++) stepSimulation(c, 1, true); console.log("unknown road id: ok"); } catch (e) { console.log("unknown road id: CRASH", (e as Error).message); }
