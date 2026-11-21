// Review helper: procedurally lay out a grid city so balance probes can run in real/survival mode.
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../../src/game/catalog";
import {
  createInitialGameState, planConstruction, recomputeConnectivityAndMetrics, stepSimulation,
  type GameState, type PlacedElement,
} from "../../src/game/simulation";
import { economyOf, transfer, cityWealth } from "../../src/game/cityEconomy";
import { applyLandformPlacement } from "../../src/game/terrain";

let seq = 0;
export function place(s: GameState, id: string, gx: number, gz: number, level = 1, rotation = 0): PlacedElement | null {
  const def = ELEMENT_BY_ID[id];
  if (!def) throw new Error("unknown " + id);
  const mode = s.mode; s.mode = "god";
  const plan = planConstruction(s, def, gx, gz, level, rotation, true);
  s.mode = mode;
  if (!plan.valid) return null;
  const el: PlacedElement = {
    id: "rv" + seq++ + "/" + plan.def.id, defId: plan.def.id, gx, gz, spanX: plan.spanX, spanZ: plan.spanZ,
    level: plan.level, variant: 0, rotation: plan.rotation, connected: false, onFire: false, disrepair: false,
    hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0, animKind: "place",
    animProgress: 0, overWater: plan.overWater, roadAxis: plan.roadAxis, pedestrianDeck: plan.pedestrianDeck,
  } as PlacedElement;
  if (plan.replaceId) { el.waterUnderlay = s.elements.find(e => e.id === plan.replaceId); s.elements = s.elements.filter(e => e.id !== plan.replaceId); }
  s.elements.push(el);
  applyLandformPlacement(s, el);
  return el;
}
export function road(s: GameState, id: string, x1: number, z1: number, x2: number, z2: number) {
  const dx = Math.sign(x2 - x1), dz = Math.sign(z2 - z1);
  for (let n = 0; n <= Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1)); n++) {
    const x = x1 + n * dx, z = z1 + n * dz;
    if (s.elements.some(e => e.gx === x && e.gz === z)) continue;
    place(s, id, x, z, 1, dx ? 0 : 1);
  }
}
export interface Spec { id: string; level: number; count: number }
/** Grid: horizontal streets every 9 rows from z0 downward count rows; buildings front both sides. */
export function gridCity(mode: "real" | "survival" | "god", specs: Spec[], opts: { x0?: number; x1?: number; z0?: number; rows?: number; roadId?: string; money?: number; industry?: Spec[] } = {}) {
  const s = createInitialGameState("god");
  const x0 = opts.x0 ?? -60, x1 = opts.x1 ?? 4, z0 = opts.z0 ?? -46, rows = opts.rows ?? 5, rid = opts.roadId ?? "roads";
  const streets: number[] = [];
  for (let r = 0; r < rows; r++) streets.push(z0 + r * 9);
  for (const z of streets) road(s, rid, x0 - 1, z, x1 + 1, z);
  road(s, rid, x0 - 1, streets[0], x0 - 1, streets[streets.length - 1]);
  road(s, rid, x1 + 1, streets[0], x1 + 1, streets[streets.length - 1]);
  // slots: each (street, side) has a cursor along x
  const slots: { z: number; side: 1 | -1; x: number }[] = [];
  for (const z of streets) { slots.push({ z, side: -1, x: x0 }); slots.push({ z, side: 1, x: x0 }); }
  const failed: Record<string, number> = {};
  const fill = (list: Spec[], slots: { z: number; side: 1 | -1; x: number }[]) => {
  const queue: { id: string; level: number }[] = [];
  for (const sp of list) for (let i = 0; i < sp.count; i++) queue.push({ id: sp.id, level: sp.level });
  let si = 0;
  for (const q of queue) {
    const def = ELEMENT_BY_ID[q.id];
    let ok = false;
    for (let tries = 0; tries < slots.length && !ok; tries++) {
      const slot = slots[(si + tries) % slots.length];
      const [w, d] = getStandardFootprintForLevel(def, q.level);
      for (let x = slot.x; x + w - 1 <= x1 && !ok; x++) {
        const gz = slot.side === 1 ? slot.z + 1 : slot.z - d;
        const el = place(s, q.id, x, gz, q.level, slot.side === 1 ? 2 : 0);
        if (el) { ok = true; slot.x = el.gx + el.spanX; si = (si + tries + 1) % slots.length; }
      }
    }
    if (!ok) failed[q.id] = (failed[q.id] ?? 0) + 1;
  }
  };
  const indSlots = opts.industry ? slots.splice(slots.length - 1, 1) : [];
  fill(specs, slots);
  if (opts.industry) fill(opts.industry, indSlots);
  s.mode = mode;
  if (mode !== "god") { s.money = opts.money ?? 50000; }
  s.timeOfDay = 10; s.weather = "clear";
  recomputeConnectivityAndMetrics(s);
  return { s, failed };
}
export function row(s: GameState, t: number) {
  const m = s.metrics, r = economyOf(s).report;
  return [t, "pop " + s.population, "hap " + s.happiness, "stg " + s.currentStage, "$" + Math.round(s.money), "pool " + Math.round(s.growthPool),
    `P${m.powerSupply}/${m.powerDemand}`, `W${Math.round(m.waterSupply)}/${m.waterDemand}`, `Ws${m.wasteCapacity}/${m.wasteDemand}`,
    `J${m.jobsAvailable}/${m.jobsNeeded}`, `F${m.foodSupply}/${m.foodDemand}`, `E${m.educationSupply}/${m.educationDemand}`,
    `R${m.recreationSupply}/${m.recreationDemand}`, `G${m.govSupply}/${m.govDemand}`, `cr${m.crimeRate}`, `cg${m.congestion}`, `def${m.defenseRating}`,
    `tax${r.tax.toFixed(1)} net${(r.treasuryNet ?? 0).toFixed(1)} upk${(m.upkeepPerTick * 0.06).toFixed(1)} wage${r.wages.toFixed(0)} exp${r.exports.toFixed(1)}`,
    `hh${Math.round(economyOf(s).households)} biz${Math.round(economyOf(s).businesses)}`, `short${r.shortage.toFixed(2)} strain${(r.utilityStrain ?? 0).toFixed(2)}`,
    s.diagnostics.filter(d => d.deltaHappiness).map(d => d.id + d.deltaHappiness).join(","), s.gameOver ? "GAMEOVER" : ""].join(" | ");
}
export function run(s: GameState, secs: number, every = 60, log = true, lockTime = false) {
  s.timeLocked = lockTime; s.weatherLocked = lockTime;
  for (let t = 0; t <= secs; t++) {
    if (log && t % every === 0) console.log(row(s, t));
    if (s.gameOver) { console.log("GAME OVER at", t, s.gameOverReason); break; }
    stepSimulation(s, 1, true);
  }
}
export { cityWealth, economyOf };
