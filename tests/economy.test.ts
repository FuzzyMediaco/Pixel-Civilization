import { createCanalDistrict } from "../src/game/canalDistrict";
import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import {
  activityRule,
  advanceEconomy,
  allocateWealth,
  cityWealth,
  controlValue,
  economyOf,
  evaluateEconomy,
  hasAuthority,
  releaseControl,
  setEconomicControl,
  siteOf,
  transfer,
  upgradeReadiness,
} from "../src/game/cityEconomy";
import {
  advanceOperations,
  dispatchFire,
  fireServiceReadiness,
  getProjectActors,
  igniteSite,
  operationsOf,
  requestProjectJourney,
} from "../src/game/projectOperations";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import {
  createInitialGameState,
  buildingLockReason,
  isElementUnlocked,
  maintainElement,
  recomputeConnectivityAndMetrics as recalc,
  stepSimulation,
  upgradeElementDirect,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { applyInfrastructureStroke } from "../src/game/terrain";
import { WEALTH_PROJECTS } from "../src/game/wealthProjects";
function put(s: GameState, defId: string, gx: number, gz: number): PlacedElement {
  const [spanX, spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[defId], 1);
  const p: PlacedElement = {
    id: defId + "@" + gx + "," + gz,
    defId,
    gx,
    gz,
    spanX,
    spanZ,
    level: 1,
    rotation: gz > 0 ? 2 : 0,
    variant: 0,
    connected: false,
    disrepair: false,
    onFire: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    animKind: "place",
    animProgress: 0,
  };
  s.elements.push(p);
  return p;
}
function neighborhood(mode: GameState["mode"] = "real") {
  const s = createInitialGameState(mode);
  for (let i = -10; i < 12; i++) put(s, "roads", i, 0);
  for (let i = -10; i < 0; i++) put(s, "house", i, 1);
  put(s, "solar_panels", -8, -1);
  put(s, "solar_panels", -7, -1);
  put(s, "wells", -5, -1);
  put(s, "businesses", -4, -1);
  s.timeLocked = s.weatherLocked = true;
  recalc(s);
  return s;
}
test("wealth balances internal transfers, limits spending and retains earned project tiers", () => {
  const s = createInitialGameState("real"),
    initial = cityWealth(s);
  transfer(s, "treasury", "businesses", 300, "Working capital");
  transfer(s, "businesses", "households", 70, "Wages");
  transfer(s, "households", "businesses", 18, "Bread");
  transfer(s, "businesses", "treasury", 10, "Tax");
  assert.equal(cityWealth(s), initial);
  assert.equal(transfer(s, "households", "outside", 1000, "Imports"), 52);
  assert.equal(transfer(s, "households", "outside", -60, "Bad input"), 0);
  assert.equal(transfer(s, "outside", "treasury", NaN, "Bad input"), 0);
  assert.equal(cityWealth(s), initial - 52);
  const before = economyOf(s).ledger.length;
  transfer(s, "outside", "businesses", 5000, "Visitors");
  assert.equal(economyOf(s).ledger.length, before + 1);
  assert.ok(isElementUnlocked(ELEMENT_BY_ID.growers_exchange, s));
  transfer(s, "businesses", "outside", 5000, "Imports");
  const copy = cloneGameStateSnapshot(s);
  assert.ok(isElementUnlocked(ELEMENT_BY_ID.growers_exchange, copy));
  assert.equal(cityWealth(copy), cityWealth(s));
  assert.equal(WEALTH_PROJECTS.length, 22);
  assert.ok(!isElementUnlocked(ELEMENT_BY_ID.spaceport, copy));
});
test("working residents can reach local jobs, a local harvest stocks grocers, and a broken street separates the market", () => {
  const s = neighborhood(),
    field = put(s, "farms", 6, 1),
    shop = put(s, "grocery_store", 8, 1);
  recalc(s);
  assert.ok(siteOf(s, field).workers > 0 && siteOf(s, shop).workers > 0);
  advanceEconomy(s, 5);
  recalc(s);
  assert.ok(siteOf(s, field).harvested > 0 && siteOf(s, shop).served > 0 && siteOf(s, shop).food > 0);
  const prevSales = siteOf(s, shop).served;
  s.elements = s.elements.filter((e) => !(e.defId === "roads" && e.gx === 3));
  recalc(s);
  advanceEconomy(s, 5);
  assert.equal(siteOf(s, shop).workers, 0);
  assert.equal(siteOf(s, shop).served, prevSales);
});
test("grocers import only affordable food, wage and grocery transfers keep double-entry books", () => {
  const s = neighborhood();
  put(s, "grocery_store", 4, 1);
  recalc(s);
  const start = cityWealth(s);
  advanceEconomy(s, 4);
  const e = economyOf(s),
    outside = e.ledger.reduce(
      (sum, t) => sum + (t.from === "outside" ? t.amount : 0) - (t.to === "outside" ? t.amount : 0),
      0,
    );
  assert.ok(e.report.imports > 0);
  assert.ok(e.report.consumed > 0);
  assert.ok(Math.abs(cityWealth(s) - start - outside) < 1e-6);
  const poor = createInitialGameState("real");
  put(poor, "house", 0, 1);
  put(poor, "roads", 0, 0);
  put(poor, "roads", 1, 0);
  put(poor, "grocery_store", 1, 1);
  poor.money = 0;
  recalc(poor);
  advanceEconomy(poor, 5);
  assert.equal(poor.money, 0);
  assert.equal(economyOf(poor).report.imports, 0);
  assert.equal(economyOf(poor).report.consumed, 0);
});
test("god values act on the live economy, support local holds and survive a snapshot", () => {
  const s = neighborhood("god"),
    house = s.elements.find((e) => e.defId === "house")!,
    initial = s.population;
  setEconomicControl(s, "happiness", 18, true);
  setEconomicControl(s, "activity", 98, true, house.id);
  allocateWealth(s, 10000, 25, 45, true);
  recalc(s);
  assert.equal(s.happiness, 18);
  assert.deepEqual([s.money, economyOf(s).households, economyOf(s).businesses], [2500, 4500, 3000]);
  assert.notEqual(economyOf(s).raw.happiness, 18);
  stepSimulation(s, 2, true);
  assert.ok(s.population < initial);
  assert.equal(upgradeReadiness(s, house).value, 98);
  const after = cloneGameStateSnapshot(s);
  assert.equal(after.happiness, 18);
  assert.equal(economyOf(after).holds.length, 5);
  releaseControl(after);
  recalc(after);
  assert.notEqual(after.happiness, 18);
  assert.equal(s.happiness, 18);
  const legacy = structuredClone(s);
  delete legacy.economy;
  legacy.money = 999999999;
  assert.equal(cityWealth(legacy), 2800);
});
test("earned upgrades count local work and a failed request never spends", () => {
  const s = neighborhood(),
    field = put(s, "fields", 5, 1);
  s.highestStageReached = 2;
  recalc(s);
  const start = s.money;
  assert.equal(upgradeElementDirect(s, field.id).ok, false);
  assert.equal(s.money, start);
  for (let i = 0; i < 20; i++) {
    advanceEconomy(s, 1);
    recalc(s);
  }
  assert.ok(siteOf(s, field).harvested >= activityRule(field).goal, "harvest " + siteOf(s, field).harvested);
  const upgraded = upgradeElementDirect(s, field.id);
  assert.ok(upgraded.ok, upgraded.reason);
  assert.equal(field.level, 2);
  assert.equal(siteOf(s, field).work, 0);
  assert.ok(s.money < start);
});
test("fire crews need civic staff, a real route and water to finish, then the site reopens", () => {
  const s = neighborhood();
  s.highestStageReached = 4;
  const office = put(s, "city_offices", 1, 1),
    fire = put(s, "fire_department", 4, 1),
    target = put(s, "shops", 9, 1);
  recalc(s);
  assert.ok(hasAuthority(s));
  assert.ok(siteOf(s, fire).workers >= 1);
  const well = s.elements.find((e) => e.defId === "wells")!;
  s.elements = s.elements.filter((e) => e !== well);
  igniteSite(s, target.id);
  assert.equal(maintainElement(s, target.id), false);
  assert.ok(dispatchFire(s, target.id));
  assert.equal(operationsOf(s).calls[0].kind, "engine");
  assert.equal(getProjectActors(s)[0].kind, "engine");
  for (let i = 0; i < 28; i++) {
    s.activePlaySec++;
    advanceOperations(s, 1);
  }
  assert.ok(target.onFire);
  assert.match(operationsOf(s).calls[0].status, /water/);
  put(s, "wells", 8, -1);
  recalc(s);
  for (let i = 0; i < 14; i++) {
    s.activePlaySec++;
    advanceOperations(s, 1);
  }
  assert.ok(!target.onFire && target.disrepair);
  assert.ok(maintainElement(s, target.id));
  assert.ok(!target.disrepair);
  s.elements = s.elements.filter((e) => e !== office);
  recalc(s);
  assert.ok(!hasAuthority(s));
});
test("paired sky and portal services actually complete journeys, and a single airport can visit the mainland", () => {
  for (const [defId, kind] of [
    ["flying_car_depot", "airTaxi"],
    ["teleportation_depot", "teleport"],
    ["regional_airport", "plane"],
    ["spaceport", "rocket"],
  ]) {
    const s = neighborhood("god"),
      a = put(s, defId, 2, 1);
    setEconomicControl(s, "power", 1000, true);
    setEconomicControl(s, "water", 1000, true);
    setEconomicControl(s, "workforce", 200, true);
    allocateWealth(s, 2000, 40, 20, false);
    recalc(s);
    if (kind === "airTaxi" || kind === "teleport") {
      assert.equal(requestProjectJourney(s, a.id), false);
      put(s, defId, 8, 1);
      recalc(s);
    }
    assert.ok(requestProjectJourney(s, a.id), kind + " · " + operationsOf(s).status[a.id]);
    assert.ok(!requestProjectJourney(s, a.id));
    const actor = getProjectActors(s)[0];
    assert.equal(actor.kind, kind);
    assert.equal(operationsOf(s).completed[a.id], undefined);
    s.activePlaySec += 8;
    advanceOperations(s, kind === "teleport" ? 3 : 8);
    assert.ok(getProjectActors(s).some((x) => x.id === a.id && x.progress > 0));
    const copy = cloneGameStateSnapshot(s);
    for (let i = 0; i < 40 && !operationsOf(copy).completed[a.id]; i++) {
      copy.activePlaySec++;
      advanceOperations(copy, 1);
    }
    assert.equal(operationsOf(copy).completed[a.id], 1);
    assert.ok(siteOf(copy, copy.elements.find((el) => el.id === a.id)!).work >= 1);
    assert.ok(!requestProjectJourney(copy, a.id));
  }
});
test("survival collapse runs on three full active days and a recovered benchmark resets the clock", () => {
  const s = neighborhood("survival");
  s.highestStageReached = 2;
  recalc(s);
  assert.ok(!s.gameOver);
  advanceEconomy(s, 170);
  assert.ok(!s.gameOver && economyOf(s).recovery === 170);
  s.population = 1100;
  advanceEconomy(s, 1);
  assert.equal(economyOf(s).recovery, 0);
  s.population = 80;
  advanceEconomy(s, 359);
  assert.ok(!s.gameOver);
  advanceEconomy(s, 1);
  assert.ok(s.gameOver);
});

test("two isolated transit districts keep jobs and food separate until a real interchange joins them", () => {
  const s = createInitialGameState("real"),
    home = put(s, "house", 0, 0),
    local = put(s, "businesses", 3, 0),
    remote = put(s, "grocery_store", 9, 0);
  for (const el of s.elements) el.connected = true;
  s.population = 25;
  const streets = new Map([
    [home.id, new Set([1])],
    [local.id, new Set([2])],
    [remote.id, new Set([3])],
  ]);
  const served = new Set(s.elements.map((el) => el.id)),
    districts = new Map([
      [home.id, "west"],
      [local.id, "west"],
      [remote.id, "east"],
    ]);
  evaluateEconomy(s, s.metrics, 10, streets, served, undefined, districts);
  assert.ok(siteOf(s, local).workers > 0);
  assert.equal(siteOf(s, remote).workers, 0);
  assert.notEqual(siteOf(s, remote).group, siteOf(s, home).group);
  const hub = put(s, "bus_stops", 6, 0);
  hub.connected = true;
  streets.set(hub.id, new Set([2]));
  districts.set(hub.id, "east");
  served.add(hub.id);
  evaluateEconomy(s, s.metrics, 10, streets, served, undefined, districts);
  assert.equal(siteOf(s, remote).group, siteOf(s, home).group);
  assert.ok(siteOf(s, remote).workers > 0);
});
test("a funded Real starter town can earn its first wealth milestone from ordinary businesses", () => {
  const s = createInitialGameState("real");
  s.weatherLocked = s.timeLocked = true;
  const buy = (id: string, x: number, z: number) => {
    assert.ok(ELEMENT_BY_ID[id].isStarter && s.money >= ELEMENT_BY_ID[id].cost);
    transfer(s, "treasury", "outside", ELEMENT_BY_ID[id].cost, "Construction");
    return put(s, id, x, z);
  };
  for (let x = -12; x <= 12; x++) buy("roads", x, 0);
  let x = -11;
  for (const id of [
    ...Array(11).fill("house"),
    ...Array(5).fill("businesses"),
    "grocery_store",
    "grocery_store",
  ]) {
    const el = buy(id, x, 1);
    x += el.spanX;
  }
  x = -10;
  for (const id of [
    "landfill",
    "water_treatment_plant",
    "school",
    "park",
    "solar_panels",
    "solar_panels",
    "solar_panels",
    "businesses",
  ]) {
    const def = ELEMENT_BY_ID[id],
      [w, h] = getStandardFootprintForLevel(def, 1);
    buy(id, x, -h);
    x += w;
  }
  recalc(s);
  assert.ok(!isElementUnlocked(ELEMENT_BY_ID.growers_exchange, s));
  for (let tick = 0; tick < 480 && !isElementUnlocked(ELEMENT_BY_ID.growers_exchange, s); tick++)
    stepSimulation(s, 3, true);
  assert.ok(isElementUnlocked(ELEMENT_BY_ID.growers_exchange, s), "peak wealth " + economyOf(s).peak);
  assert.ok(s.money >= ELEMENT_BY_ID.growers_exchange.cost);
  assert.ok(economyOf(s).ledger.some((entry) => entry.label === "Local exports"));
});
test("a canal can deliver a fireboat to an otherwise isolated waterfront fire", () => {
  const s = createInitialGameState("god");
  const channel = applyInfrastructureStroke(s, { kind: "canal", depth: 2 }, [
    { gx: 0, gz: 0 },
    { gx: 8, gz: 0 },
  ]);
  assert.ok(channel.valid, channel.reason);
  const station = put(s, "fire_department", 0, 1),
    target = put(s, "shops", 7, 1);
  setEconomicControl(s, "authority", 1, true);
  station.connected = target.connected = true;
  siteOf(s, station).workers = 5;
  igniteSite(s, target.id);
  assert.ok(dispatchFire(s, target.id));
  assert.equal(operationsOf(s).calls[0].kind, "fireboat");
  const start = getProjectActors(s)[0];
  s.activePlaySec++;
  advanceOperations(s, 1);
  const underway = getProjectActors(s)[0];
  assert.ok(underway.gx !== start.gx || underway.gz !== start.gz);
  for (let t = 0; t < 24; t++) {
    s.activePlaySec++;
    advanceOperations(s, 1);
  }
  assert.equal(target.onFire, false);
});
test("the canal district opens supplied and remains solvent through two live island days", () => {
  const s = createCanalDistrict(),
    opening = cityWealth(s),
    treasury = s.money;
  assert.equal(economyOf(s).holds.length, 0);
  assert.ok(s.elements.every((e) => e.connected));
  assert.deepEqual(s.mobility!.lines.map((l) => l.mode).sort(), ["bus", "ferry", "gondola"]);
  for (let i = 0; i < 240; i++) stepSimulation(s, 1, true);
  const report = economyOf(s).report;
  assert.ok(s.happiness >= 80 && s.population >= 1800);
  assert.ok(s.money >= treasury && cityWealth(s) > opening);
  assert.ok(report.consumed >= report.required * 0.95);
  assert.ok(s.metrics.waterSupply >= s.metrics.waterDemand && s.metrics.powerSupply >= s.metrics.powerDemand);
  assert.ok(s.mobility!.lines.every((l) => l.delivered > 0));
  assert.equal(economyOf(s).holds.length, 0);
});

test("a market counts its own purchases, the tax report reconciles sales, and a rain cistern is never counted as food", () => {
  const s = neighborhood(),
    first = put(s, "restaurants", 0, 1),
    empty = put(s, "restaurants", 4, 1),
    church = put(s, "rainwater_cathedral", 8, 1);
  const water = siteOf(s, church);
  water.food = 45;
  delete water.cistern;
  recalc(s);
  const stocked = siteOf(s, first),
    unused = siteOf(s, empty);
  assert.equal(water.cistern, 45);
  assert.equal(water.food, 0);
  assert.ok(stocked.retail > 0 && unused.retail > 0);
  stocked.food = 30;
  recalc(s);
  assert.equal(economyOf(s).report.meals, 30);
  advanceEconomy(s, 1);
  const { report, ledger } = economyOf(s);
  assert.ok(stocked.served > 0);
  assert.equal(stocked.served, report.consumed);
  assert.deepEqual([unused.served, unused.work], [0, 0]);
  const taxes = ledger
    .filter((x) => ["Sales tax", "Payroll tax", "Trade tax"].includes(x.label))
    .reduce((sum, x) => sum + x.amount, 0);
  assert.ok(ledger.some((x) => x.label === "Sales tax"));
  assert.ok(Math.abs(report.tax - taxes) < 1e-8);
});

test("freight needs a real loading edge on a track component with an open platform", () => {
  const s = neighborhood(),
    terminal = put(s, "freight_rail_terminal", 2, 1);
  put(s, "train_tracks", 2, 2);
  recalc(s);
  assert.equal(siteOf(s, terminal).exportRate, 0);
  put(s, "train_tracks", 2, 3);
  const station = put(s, "train_stops", 3, 3);
  station.rotation = 1;
  recalc(s);
  assert.ok(siteOf(s, terminal).exportRate > 0);
  station.disrepair = true;
  recalc(s);
  assert.equal(siteOf(s, terminal).exportRate, 0);
});

test("God settings respect each selected site, expire one-time values, discard removed sites and drive real fire checks", () => {
  const s = neighborhood("god"),
    a = s.elements.find((x) => x.defId === "house")!,
    b = s.elements.find((x) => x !== a && x.defId === "house")!;
  setEconomicControl(s, "turnaround", 61, true, a.id);
  setEconomicControl(s, "turnaround", 7, false, b.id);
  assert.equal(controlValue(s, "turnaround", a.id), 61);
  assert.equal(controlValue(s, "turnaround", b.id), 7);
  s.activePlaySec = 3;
  assert.equal(controlValue(s, "turnaround", b.id), 14);
  const copy = cloneGameStateSnapshot(s);
  copy.elements = copy.elements.filter((x) => x.id !== a.id);
  advanceEconomy(copy, 1);
  assert.ok(!economyOf(copy).holds.some((x) => x.site === a.id));
  assert.equal(economyOf(s).holds.length, 1);
  setEconomicControl(s, "risk", 0, true);
  advanceOperations(s, 1);
  s.activePlaySec += 500;
  advanceOperations(s, 1);
  assert.equal(operationsOf(s).fires, 0);
  setEconomicControl(s, "risk", 100, true);
  advanceOperations(s, 1);
  s.activePlaySec += 100;
  advanceOperations(s, 1);
  assert.equal(operationsOf(s).fires, 1);
});

test("paired gates honor destination turnaround and temporary outages, alternate departures and debit a single fare", () => {
  const s = neighborhood("god"),
    a = put(s, "teleportation_depot", 0, 1),
    b = put(s, "teleportation_depot", 4, 1),
    c = put(s, "teleportation_depot", 8, 1);
  setEconomicControl(s, "power", 1000, true);
  setEconomicControl(s, "workforce", 200, true);
  allocateWealth(s, 2000, 40, 20, false);
  recalc(s);
  const op = operationsOf(s);
  op.next[b.id] = 500;
  assert.ok(requestProjectJourney(s, a.id));
  const f = op.flights[0];
  assert.equal(f.dest, c.id);
  c.onFire = true;
  advanceOperations(s, 3);
  assert.equal(f.progress, 0);
  assert.match(op.status[a.id], /paused/);
  c.onFire = false;
  const before = economyOf(s).businesses;
  setEconomicControl(s, "turnaround", 30, true, c.id);
  s.activePlaySec = 7;
  advanceOperations(s, 7);
  assert.equal(op.completed[a.id], 1);
  assert.equal(op.next[c.id], 37);
  assert.ok(Math.abs(economyOf(s).businesses - before - f.capacity * 0.8) < 1e-8);
  assert.ok(!requestProjectJourney(s, b.id));
  s.activePlaySec = 21;
  advanceOperations(s, 1);
  assert.equal(op.flights.length, 0);
  s.activePlaySec = 38;
  advanceOperations(s, 1);
  assert.equal(op.flights[0].origin, c.id);
  assert.equal(op.flights[0].dest, a.id);
});

test("sky taxis meet their respective deck heights and runway travel follows the terminal rotation", () => {
  const s = neighborhood("god"),
    a = put(s, "flying_car_depot", 0, 1),
    b = put(s, "flying_car_depot", 6, 1);
  b.level = 3;
  [b.spanX, b.spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[b.defId], 3);
  setEconomicControl(s, "power", 1000, true);
  setEconomicControl(s, "workforce", 200, true);
  recalc(s);
  assert.ok(requestProjectJourney(s, a.id));
  const op = operationsOf(s),
    path = op.flights[0].path;
  assert.equal(path[0][2], 1.25);
  assert.equal(path[path.length - 1][2], 3.25);
  const runway = put(s, "regional_airport", 2, -2);
  runway.rotation = 1;
  runway.connected = true;
  siteOf(s, runway).workers = 8;
  assert.ok(requestProjectJourney(s, runway.id));
  const roll = op.flights.find((f) => f.kind === "plane")!.path;
  assert.equal(roll[1][0], roll[2][0]);
  assert.ok(roll[2][1] < roll[1][1]);
});

test("same-pass staffing controls coverage and an engine keeps its position across new construction", () => {
  const s = neighborhood("god");
  put(s, "city_offices", 0, 1);
  const station = put(s, "fire_department", 2, 1),
    shop = put(s, "shops", 10, 1);
  put(s, "wells", 2, -1);
  s.highestStageReached = 4;
  s.weather = "clear";
  recalc(s);
  assert.ok(shop.hasFireCover);
  setEconomicControl(s, "workforce", 0, true);
  recalc(s);
  assert.ok(!shop.hasFireCover);
  releaseControl(s, "workforce");
  recalc(s);
  assert.ok(shop.hasFireCover);
  igniteSite(s, shop.id);
  assert.ok(dispatchFire(s, shop.id));
  const call = operationsOf(s).calls[0];
  s.activePlaySec++;
  advanceOperations(s, 1);
  const prev = call.travel;
  put(s, "roads", -11, 0);
  recalc(s);
  s.activePlaySec++;
  advanceOperations(s, 1);
  assert.ok(call.travel > prev);
  assert.ok(getProjectActors(s).some((a) => a.siteId === shop.id && a.kind === "engine"));
  for (let t = 0; t < 18; t++) {
    s.activePlaySec++;
    advanceOperations(s, 1);
  }
  assert.ok(!shop.onFire && shop.disrepair);
  assert.ok(station.connected);
});

test("a long simulation tick cannot land an aircraft on a burning runway or pay a visitor reward", () => {
  const s = neighborhood("god"),
    airport = put(s, "regional_airport", 2, 1);
  setEconomicControl(s, "power", 1000, true);
  setEconomicControl(s, "workforce", 200, true);
  recalc(s);
  assert.ok(requestProjectJourney(s, airport.id));
  const op = operationsOf(s),
    f = op.flights[0],
    before = cityWealth(s);
  airport.onFire = true;
  advanceOperations(s, 60);
  assert.equal(op.completed[airport.id], undefined);
  assert.ok(f.progress < f.duration);
  assert.equal(cityWealth(s), before);
  assert.match(op.status[airport.id], /safe landing/);
  airport.onFire = false;
  advanceOperations(s, 20);
  assert.equal(op.completed[airport.id], 1);
  assert.equal(cityWealth(s), before + f.capacity * 9);
});
test("a held island food limit is shared between separate districts", () => {
  const s = createInitialGameState("god"),
    components = new Map<string, Set<number>>();
  for (let i = 0; i < 2; i++) {
    const home = put(s, "house", i * 10, 0),
      shop = put(s, "restaurants", i * 10 + 1, 0);
    for (const el of [home, shop]) {
      el.connected = true;
      components.set(el.id, new Set([i]));
    }
    siteOf(s, shop).food = 20;
  }
  s.population = 1000;
  allocateWealth(s, 2000, 40, 40, false);
  setEconomicControl(s, "food", 1, true);
  evaluateEconomy(s, s.metrics, 10, components, new Set());
  advanceEconomy(s, 1);
  assert.equal(economyOf(s).report.consumed, 1);
  const stores = s.elements.filter((x) => x.defId === "restaurants").map((x) => siteOf(s, x));
  assert.equal(
    stores.reduce((sum, a) => sum + a.served, 0),
    1,
  );
});


test("growth raises household utility demand, gardens draw water and connected crops can feed a neighborhood", () => {
  const town = neighborhood();
  const starting = {water: town.metrics.waterDemand, power: town.metrics.powerDemand};
  town.growthPool += 100;
  recalc(town);
  assert.ok(town.metrics.waterDemand > starting.water && town.metrics.powerDemand > starting.power);
  const water = town.metrics.waterDemand;
  put(town, "gardens", 1, -1);
  recalc(town);
  assert.equal(town.metrics.waterDemand, water + 1);
  for (const x of [2,3,4,5]) put(town, "farms", x, -1).level = 3;
  recalc(town);
  assert.ok(town.metrics.foodSupply >= town.metrics.foodDemand);
});

test("public safety needs a government and its crew requirement follows residents, staffing and coverage", () => {
  for (const mode of ["real","survival"] as const) {
    const town = neighborhood(mode);
    town.highestStageReached = 20;
    for (const id of ["fire_department","police_departments","military_base"]) {
      assert.match(buildingLockReason(ELEMENT_BY_ID[id],town) ?? "", /Staff a City Office/);
    }
    put(town,"city_offices",1,-1);
    const station = put(town, "fire_department",2,-1);
    recalc(town);
    assert.equal(buildingLockReason(ELEMENT_BY_ID.fire_department,town),undefined);
    const supported = fireServiceReadiness(town);
    assert.equal(supported.crews,1);
    town.population = 150000;
    const crowded = fireServiceReadiness(town);
    assert.equal(crowded.required,3);
    assert.ok(crowded.chance > supported.chance);
    station.disrepair = true;
    recalc(town);
    assert.equal(fireServiceReadiness(town).crews,0);
  }
  assert.equal(buildingLockReason(ELEMENT_BY_ID.fire_department, createInitialGameState("god")),undefined);
});

test("even happy households leave after an extended loss of essentials in Real and Survival", () => {
  for (const mode of ["real","survival"] as const) {
    const town = neighborhood(mode);
    town.growthPool = 25;
    recalc(town);
    const before = town.growthPool;
    town.happiness = 96;
    economyOf(town).report.shortage = 0.9;
    stepSimulation(town, 0.1, true);
    assert.ok(town.growthPool < before, mode);
  }
});
