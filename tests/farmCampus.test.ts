import assert from "node:assert/strict";
import { test } from "node:test";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics as recalc,
  stepSimulation,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { districtReport, complexBoost } from "../src/game/farmNetworks";
import { farmActivityRuns, farmJobPose } from "../src/game/farmActivity";
import { advanceEconomy, siteOf, economyOf } from "../src/game/cityEconomy";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
function put(s: GameState, id: string, x: number, z: number, r = 0, level = 1) {
  const [w, h] = getStandardFootprintForLevel(ELEMENT_BY_ID[id], level);
  const e: PlacedElement = {
    id: id + "@" + x + "," + z,
    defId: id,
    gx: x,
    gz: z,
    spanX: r % 2 ? h : w,
    spanZ: r % 2 ? w : h,
    rotation: r,
    level,
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
  s.elements.push(e);
  return e;
}
function strip(s: GameState, id: string, x: number, side: number, level = 1) {
  const [, h] = getStandardFootprintForLevel(ELEMENT_BY_ID[id], level);
  return put(s, id, x, side > 0 ? 1 : -h, side > 0 ? 2 : 0, level);
}
function farming(count: number) {
  const s = createInitialGameState("real");
  put(s, "roads", 0, -1);
  put(s, "house", 0, -2);
  const anchor = put(s, "grain_farm", 0, 0, 2);
  for (let i = 0; i < count; i++)
    put(s, i === 3 || i === 7 ? "grazing_pasture" : "grain_fields", 1 + (i % 11), Math.floor(i / 11));
  recalc(s);
  return { s, anchor };
}
test("farm complexes count 5, 10, 25, 50 and 110 working modules; every moving actor stays on its parcels", (t) => {
  const summaries = [];
  for (const [count, tier] of [
    [4, 0],
    [5, 1],
    [10, 2],
    [25, 3],
    [50, 4],
    [110, 4],
  ]) {
    const { s, anchor } = farming(count),
      farm = districtReport(s).farms.get(anchor.id)!;
    assert.equal(farm.live, true);
    assert.equal(farm.tier, tier);
    assert.equal(farm.count.get(anchor.id), count);
    assert.ok(
      farm.modules.every(
        (m) => m.connected && siteOf(s, m).group === siteOf(s, anchor).group && siteOf(s, m).yieldRate > 0,
      ),
    );
    const jobs = farmActivityRuns(s),
      cells = new Set(farm.modules.map((m) => m.gx + "," + m.gz));
    for (const run of jobs) {
      assert.notDeepEqual(farmJobPose(run, 1), farmJobPose(run, 2));
      for (let j = 0; j < 49; j++) {
        const pose = farmJobPose(run, (j * run.period) / 48);
        assert.ok(cells.has(Math.floor(pose.x) + "," + Math.floor(pose.z)), run.job);
      }
    }
    if (tier >= 1) assert.ok(jobs.some((r) => r.job === "tractor"));
    if (tier >= 2) assert.ok(jobs.some((r) => r.job === "herd") && jobs.some((r) => r.job === "grower"));
    if (tier >= 3) assert.ok(jobs.some((r) => r.job === "combine"));
    if (tier >= 4) assert.ok(jobs.some((r) => r.job === "delivery") && jobs.some((r) => r.job === "grainCart"));
    assert.ok(complexBoost(count) < 2.61);
    summaries.push([count, tier, jobs.length, Number(siteOf(s, anchor).yieldRate.toFixed(2))]);
    if (count === 110) {
      const second = put(s, "dairy_farm", 9, -1, 2);
      put(s, "roads", 9, -2);
      recalc(s);
      const combined = districtReport(s).farms.get(second.id)!;
      assert.equal(combined.modules.length, 110);
      assert.equal(
        [...combined.count.values()].reduce((a, b) => a + b, 0),
        110,
      );
      assert.ok((combined.count.get(second.id) ?? 0) > 0);
      const loaded = cloneGameStateSnapshot(s);
      loaded.elements.reverse();
      recalc(loaded);
      assert.deepEqual(
        [...districtReport(loaded).farms.get(second.id)!.owner].map(([id, a]) => [id, a.id]).sort(),
        [...combined.owner].map(([id, a]) => [id, a.id]).sort(),
      );
      for (const road of s.elements.filter((e) => e.defId === "roads")) road.onFire = true;
      recalc(s);
      assert.equal(farmActivityRuns(s).length, 0);
      s.elements = s.elements.filter((e) => e.defId !== "roads");
      recalc(s);
      assert.equal(farmActivityRuns(s).length, 0);
      assert.ok(combined.modules.every((e) => !e.connected && siteOf(s, e).yieldRate === 0));
    }
  }
  t.diagnostic(JSON.stringify(summaries));
});
function city(mode: GameState["mode"], level = 1) {
  const s = createInitialGameState(mode),
    spans = (id: string) => getStandardFootprintForLevel(ELEMENT_BY_ID[id], level)[0];
  let x = -11;
  for (const id of [
    "house",
    "medium_sized_homes",
    "apartments",
    "businesses",
    "grocery_store",
    "school",
    "park",
    "businesses",
    "businesses",
  ]) {
    strip(s, id, x, 1, level);
    x += spans(id);
  }
  let south = -11;
  for (const id of [
    "water_towers",
    "solar_panels",
    "landfill",
    "grain_farm",
    "community_centers",
    "shops",
    "restaurants",
    "landfill",
    "landfill",
    "solar_panels",
    "water_towers",
  ]) {
    strip(s, id, south, -1, level);
    south += spans(id);
  }
  for (let col = -11; col < Math.max(x, south); col++) put(s, "roads", col, 0);
  recalc(s);
  return s;
}
test("early, developed and advanced settlements feed residents and grow in God, Real and Survival", (t) => {
  for (const mode of ["god", "real", "survival"] as const) {
    const rows = [];
    for (const level of [1, 3, 5]) {
      const s = city(mode, level),
        opening = s.population;
      for (let n = 0; n < 14; n++) stepSimulation(s, 1, true);
      const r = economyOf(s).report;
      assert.ok(r.harvest > 0 && r.consumed > 0 && r.shopping > 0);
      assert.ok(s.metrics.foodSupply >= s.metrics.foodDemand, mode + " L" + level);
      assert.ok(r.shortage < 0.2, mode + " L" + level + " shortage " + r.shortage);
      assert.ok(
        s.population > opening,
        mode +
          " L" +
          level +
          " growth " +
          opening +
          "→" +
          s.population +
          " happiness " +
          s.happiness +
          " jobs " +
          r.reachable +
          "/" +
          r.workers +
          " water " +
          s.metrics.waterSupply +
          "/" +
          s.metrics.waterDemand +
          " power " +
          s.metrics.powerSupply +
          "/" +
          s.metrics.powerDemand +
          " waste " +
          s.metrics.wasteCapacity +
          "/" +
          s.metrics.wasteDemand,
      );
      rows.push([level, opening, s.population, Math.round(r.harvest), s.happiness]);
    }
    t.diagnostic(mode + " [level, opening residents, settled, meals/s, happiness] " + JSON.stringify(rows));
  }
});
test("all four physical districts change their participants, and extra neighbors never multiply a repeated bonus", () => {
  const cases = [
    ["high_school", "sports_field", "educationMultiplier", 1.16],
    ["dairy_farm", "grain_farm", "foodMultiplier", 1.24],
    ["university", "research_institute", "jobsMultiplier", 1.12],
    ["orchards", "apiary", "foodMultiplier", 1.18],
  ] as const;
  for (const [aId, bId, metric, expected] of cases) {
    const s = city("god"),
      a = strip(s, aId, 1, 1),
      b = strip(s, bId, 1 + a.spanX, 1);
    // Place the pair independently of the original residential blocks.
    const keep = new Set([a, b, ...s.elements.filter((e) => e.gz <= 0)]);
    s.elements = s.elements.filter((e) => keep.has(e));
    for (let x = 0; x < 7; x++) if (!s.elements.some((e) => e.gx === x && e.gz === 0)) put(s, "roads", x, 0);
    recalc(s);
    assert.equal(districtReport(s).bonuses[metric].get(a.id), expected, aId);
    const [, bh] = getStandardFootprintForLevel(ELEMENT_BY_ID[bId], 1);
    const b2 = put(s, bId, a.gx, a.gz + a.spanZ);
    recalc(s);
    assert.ok(bh >= 1);
    assert.equal(districtReport(s).bonuses[metric].get(a.id), expected);
    b2.onFire = true;
    b.onFire = true;
    recalc(s);
    assert.equal(districtReport(s).bonuses[metric].get(a.id), undefined);
    b.onFire = false;
    b.edgeOverrides = { right: "closed", left: "closed" };
    recalc(s);
    assert.equal(districtReport(s).bonuses[metric].get(a.id), undefined);
  }
});
test("every school delivers its specialty through the town's live services, hiring, exports or family mood", (t) => {
  const rows = [];
  for (const id of [
    "preschool",
    "country_schoolhouse",
    "elementary_school",
    "middle_school",
    "high_school",
    "trade_school",
    "community_college",
    "university",
    "research_university",
  ]) {
    const s = createInitialGameState("real");
    s.money = 20000;
    for (let x = -12; x <= 13; x++) put(s, "roads", x, 0);
    for (let x = -12; x < 0; x += 2)
      strip(s, id === "preschool" ? "house" : "skyscrapers", x, 1, id === "preschool" ? 1 : 2);
    const factory = strip(s, "factories", -3, -1),
      tech = strip(s, "data_centers", 0, -1),
      shop = strip(s, "shops", 3, -1);
    strip(s, "solar_panels", 7, -1, 3);
    strip(s, "water_towers", 10, -1);
    recalc(s);
    const before = {
      education: s.metrics.educationSupply,
      rec: s.metrics.recreationSupply,
      happy: s.happiness,
      skilled: economyOf(s).report.skilled,
      trade: siteOf(s, factory).jobs,
      sales: siteOf(s, shop).exportRate,
      factory: siteOf(s, factory).exportRate,
      tech: siteOf(s, tech).jobs,
      exports: siteOf(s, tech).exportRate,
    };
    const school = strip(s, id, 2, 1);
    recalc(s);
    const d = ELEMENT_BY_ID[id],
      after = economyOf(s).report;
    assert.ok(
      school.connected && s.metrics.educationSupply > before.education && siteOf(s, school).attendees > 0,
      id,
    );
    if (id === "preschool") assert.ok(s.happiness > before.happy);
    if (id === "country_schoolhouse")
      assert.ok(d.cost < ELEMENT_BY_ID.school.cost && s.metrics.educationSupply >= 40);
    if (["elementary_school", "middle_school", "high_school"].includes(id))
      assert.ok(s.metrics.recreationSupply > before.rec);
    if (id === "trade_school")
      assert.ok(siteOf(s, factory).jobs > before.trade && siteOf(s, factory).exportRate > before.factory);
    if (id === "community_college") assert.ok(siteOf(s, shop).exportRate > before.sales);
    if (id === "university" || id === "research_university")
      assert.ok(after.skilled > before.skilled && siteOf(s, tech).jobs > before.tech);
    if (id === "research_university") assert.ok(siteOf(s, tech).exportRate > before.exports);
    rows.push([id, s.metrics.educationSupply - before.education, siteOf(s, school).attendees]);
  }
  t.diagnostic(JSON.stringify(rows));
});

test("an irrigation pond stores water and releases a finite shared supply in dry weather, and a connected silo protects stored crops", () => {
  const { s, anchor } = farming(5),
    pond = put(s, "irrigation_pond", 2, 1),
    silo = put(s, "feed_silo", 3, 1);
  s.weather = "clear";
  recalc(s);
  const crop = siteOf(s, anchor),
    store = siteOf(s, pond),
    dry = crop.yieldRate;
  assert.equal(store.cistern ?? 0, 0);
  assert.equal(store.irrigationOut, 0);
  assert.equal(crop.bulkStorage, true);
  s.weather = "rain";
  recalc(s);
  advanceEconomy(s, 4);
  assert.ok((store.cistern ?? 0) > 0);
  s.weather = "clear";
  recalc(s);
  assert.ok(crop.yieldRate > dry);
  const balance = store.cistern!,
    out = store.irrigationOut!;
  assert.ok(out > 0 && out <= 0.800001, "outlet rate " + out);
  advanceEconomy(s, 1);
  assert.ok(store.cistern! < balance && store.cistern! >= 0);
  silo.disrepair = true;
  store.cistern = 0;
  recalc(s);
  assert.equal(crop.bulkStorage, false);
  assert.equal(store.irrigationOut, 0);
});
