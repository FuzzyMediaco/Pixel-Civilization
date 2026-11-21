import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENT_BY_ID, STAGES, getStandardFootprintForLevel } from "../src/game/catalog";
import { advanceEconomy, economyOf, taxRateOf, unlockWealth } from "../src/game/cityEconomy";
import { upkeepFor } from "../src/game/cityDynamics";
import { CITY_GRANTS, payEarnedGrants } from "../src/game/cityGrants";
import {
  MAINTENANCE_INTERVAL_SEC,
  createInitialGameState,
  maintainElement,
  maintenancePrice,
  perCapitaDemandScale,
  recomputeConnectivityAndMetrics as recalc,
  stepSimulation,
  taxHappiness,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";

function put(s: GameState, defId: string, gx: number, gz: number, level = 1): PlacedElement {
  const [spanX, spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[defId], level);
  const p: PlacedElement = {
    id: defId + "@" + gx + "," + gz, defId, gx, gz: gz < 0 ? -spanZ : gz, spanX, spanZ, level,
    rotation: gz > 0 ? 2 : 0, variant: 0, connected: false, disrepair: false, onFire: false,
    hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0, maintTimerSec: 0, animKind: "place", animProgress: 0,
  };
  s.elements.push(p);
  return p;
}
function town(mode: GameState["mode"] = "real", extra: (s: GameState) => void = () => {}) {
  const s = createInitialGameState(mode);
  s.timeLocked = s.weatherLocked = true;
  for (let i = -14; i < 16; i++) put(s, "roads", i, 0);
  for (let i = -14; i < -2; i++) put(s, "house", i, 1);
  put(s, "solar_panels", -12, -1);
  put(s, "solar_panels", -11, -1);
  put(s, "solar_panels", -10, -1);
  put(s, "wells", -9, -1);
  put(s, "wells", -8, -1);
  put(s, "businesses", -6, -1);
  put(s, "grocery_store", -2, 1);
  put(s, "shops", 0, 1);
  extra(s);
  recalc(s);
  return s;
}

test("the population limiter names the need that caps growth and the growth step obeys it", () => {
  const s = town("real");
  const limit = s.metrics.populationLimiter;
  assert.ok(limit.cap >= s.metrics.housingBase && limit.cap > 0);
  // No landfill: garbage is the wall.
  assert.equal(limit.limitingNeed, "waste");
  for (let i = 0; i < 120; i++) stepSimulation(s, 1, true);
  assert.ok(s.population <= Math.ceil(s.metrics.populationLimiter.cap * 1.02), `${s.population} vs ${s.metrics.populationLimiter.cap}`);
  assert.ok(s.diagnostics.some((d) => d.id === "growth_limit" && d.title.includes("Garbage")) || s.population < 0.97 * s.metrics.populationLimiter.cap);
  // Adding a landfill lifts the waste cap.
  const before = s.metrics.populationLimiter.cap;
  put(s, "landfill", 6, -1);
  recalc(s);
  assert.ok(s.metrics.populationLimiter.cap > before);
});

test("trade tax is collected before wages, households spend at commerce, and the treasury no longer funds every import", () => {
  const s = town("real");
  for (let i = 0; i < 60; i++) stepSimulation(s, 1, true);
  const e = economyOf(s);
  const byLabel = (label: string) => e.ledger.filter((x) => x.label === label).reduce((n, x) => n + x.amount, 0);
  assert.ok(byLabel("Trade tax") > 0, "trade tax");
  assert.ok(byLabel("Household spending") > 0, "household spending");
  assert.ok(byLabel("Sales tax") > 0, "sales tax");
  assert.ok(byLabel("Grocer working capital") <= 0.25 * byLabel("Payroll tax") + 1e-6);
});

test("earning sites pay upkeep, the tax rate defaults to 12% and moves happiness, and unlocks ignore household savings", () => {
  assert.ok(upkeepFor(ELEMENT_BY_ID.malls, 1) > 0 && upkeepFor(ELEMENT_BY_ID.banks, 3) > upkeepFor(ELEMENT_BY_ID.banks, 1));
  assert.equal(upkeepFor(ELEMENT_BY_ID.house, 3), 0);
  const s = createInitialGameState("real");
  assert.equal(taxRateOf(s), 12);
  s.taxRate = 40;
  assert.equal(taxRateOf(s), 25);
  assert.ok(taxHappiness(12) > 0 && taxHappiness(15) === 0 && taxHappiness(25) < 0);
  economyOf(s).households = 1e6;
  assert.equal(unlockWealth(s), s.money + economyOf(s).businesses);
});

test("stage thresholds top out at 1.55M and per-capita demand eases with stage", () => {
  assert.equal(STAGES[19].minPop, 1_550_000);
  for (let i = 1; i < STAGES.length; i++) assert.ok(STAGES[i].minPop > STAGES[i - 1].minPop);
  assert.equal(perCapitaDemandScale(1), 1);
  assert.equal(perCapitaDemandScale(20), 0.5);
  assert.ok(perCapitaDemandScale(10) < perCapitaDemandScale(5));
});

test("defense and police requirements scale with the square root / a fixed share of population", () => {
  const s = town("god", (st) => { st.godCrimeEnabled = true; });
  s.growthPool = 500_000 - s.population;
  recalc(s);
  const pop = s.population;
  assert.equal(s.metrics.requiredDefensePower, Math.round(200 + 220 * s.metrics.stageAttackSeverity + 6 * Math.sqrt(pop)));
  assert.ok(s.metrics.requiredDefensePower < 6000);
});

test("survival maintenance is staggered and paid; real-mode fire damage repairs itself", () => {
  const s = town("survival", (st) => {
    for (let i = 2; i < 14; i++) put(st, "landfill", i, -1);
  });
  s.money = 1e6;
  for (let t = 0; t < 400; t++) {
    stepSimulation(s, 1, true);
    if (s.elements.some((el) => el.disrepair)) break;
  }
  const maintained = s.elements.filter((el) => ELEMENT_BY_ID[el.defId].needsMaintenance);
  assert.ok(maintained.length > 3);
  const failing = maintained.filter((el) => el.disrepair).length;
  assert.ok(failing < maintained.length, "not every building fails at once");
  const victim = maintained.find((el) => el.disrepair)!;
  const money = s.money;
  assert.ok(maintainElement(s, victim.id));
  assert.equal(s.money, money - maintenancePrice(victim));
  assert.ok(MAINTENANCE_INTERVAL_SEC > 0);

  const r = town("real");
  const site = r.elements.find((el) => el.defId === "businesses")!;
  site.disrepair = true;
  recalc(r);
  assert.ok(r.diagnostics.some((d) => d.id === "fire_recovery"));
  for (let i = 0; i < 61; i++) stepSimulation(r, 1, true);
  assert.equal(site.disrepair, false);
});

test("stage milestones pay development grants once", () => {
  const s = town("real");
  s.highestStageReached = 3;
  recalc(s);
  const paid = payEarnedGrants(s).map((g) => g.id);
  assert.ok(paid.includes("stage_2") && paid.includes("stage_3") && !paid.includes("stage_4"));
  assert.ok(CITY_GRANTS.filter((g) => g.id.startsWith("stage_")).length >= 10);
  assert.ok(!payEarnedGrants(s).some((g) => g.id === "stage_2"));
});

test("an unpowered night does not swing happiness: power and traffic read day-average values", () => {
  const s = town("real", (st) => put(st, "landfill", 6, -1));
  s.timeOfDay = 12;
  recalc(s);
  const noon = s.happiness, steady = s.metrics.powerSupplySteady;
  s.timeOfDay = 23;
  recalc(s);
  assert.equal(s.metrics.powerSupplySteady, steady);
  assert.ok(Math.abs(s.happiness - noon) <= 2, `${noon} vs ${s.happiness}`);
});
