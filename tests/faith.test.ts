import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENTS } from "../src/game/catalog";
import { advanceEconomy, economyOf } from "../src/game/cityEconomy";
import {
  activeBlessing,
  advanceFaith,
  bedsAt,
  evacuate,
  faithOf,
  faithServices,
  invokeBlessing,
  rehouseResidents,
  repelInvasion,
} from "../src/game/faith";
import { igniteSite } from "../src/game/projectOperations";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import {
  createInitialGameState,
  gridToWorldCenter,
  launchIslandAttack,
  recomputeConnectivityAndMetrics,
  stepSimulation,
  type PlacedElement,
} from "../src/game/simulation";
import { streetDemand } from "../src/game/streetDemand";
function lot(defId: string, gx: number, gz: number, level = 1): PlacedElement {
  return {
    id: defId + "@" + gx + "," + gz,
    defId,
    gx,
    gz,
    level,
    variant: 0,
    rotation: 0,
    spanX: 1,
    spanZ: 1,
    connected: true,
    onFire: false,
    disrepair: false,
    hasPoliceCover: false,
    hasFireCover: false,
    maintTimerSec: 0,
    nuisancePenalty: 0,
    animKind: "place",
    animProgress: 0,
  };
}
function town() {
  const s = createInitialGameState("god");
  s.elements = [
    ...Array.from({ length: 7 }, (_, i) => lot("roads", i, 0)),
    lot("house", 1, -1, 4),
    lot("lds_temples", 3, -1),
    lot("farms", 5, -1),
    lot("businesses", 6, -1),
  ];
  recomputeConnectivityAndMetrics(s);
  return { s, t: s.elements.find((e) => e.defId === "lds_temples")! };
}
test("eight faith services scale with level, attendance and population, and keep citywide relief capped", () => {
  const s = createInitialGameState("real");
  for (const def of ELEMENTS.filter((e) => e.category === "faith")) {
    const el = lot(def.id, 0, 0);
    s.elements = [el];
    s.population = 150;
    const low = faithServices(s);
    assert.ok(low.happiness > 0 && low.volunteerSupport > 0);
    el.level = 5;
    const high = faithServices(s);
    assert.ok(high.civicRelief > low.civicRelief);
    el.connected = false;
    assert.equal(faithServices(s).happiness, 0);
    el.connected = true;
    s.elements = Array.from({ length: 100 }, () => ({ ...el }));
    const all = faithServices(s);
    assert.ok(
      all.happiness <= 8 &&
        all.crime <= 12 &&
        all.civicRelief < 0.15 &&
        all.volunteerSupport < 0.22,
    );
  }
  assert.equal(ELEMENTS.filter((e) => e.category === "faith").length, 8);
});
test("blessings affect actual food and street demand, expire in play time and survive saves", () => {
  const { s, t } = town();
  const base = economyOf(s).report.harvest,
    trips = streetDemand(s).carTrips;
  assert.ok(base > 0 && trips > 0 && t.connected);
  assert.ok(invokeBlessing(s, t, "harvest"));
  recomputeConnectivityAndMetrics(s);
  assert.ok(Math.abs(economyOf(s).report.harvest / base - 1.2) < 1e-6);
  invokeBlessing(s, t, "roads");
  assert.ok(Math.abs(streetDemand(s).carTrips / trips - 0.82) < 1e-6);
  const copy = cloneGameStateSnapshot(s);
  assert.equal(activeBlessing(copy), "roads");
  copy.activePlaySec = copy.faith!.active!.until;
  assert.equal(activeBlessing(copy), undefined);
  assert.equal(
    advanceFaith(copy, () => 0),
    undefined,
  );
  copy.activePlaySec = copy.faith!.nextCheck;
  assert.equal(
    advanceFaith(copy, () => 0),
    "harvest",
  );
  assert.equal(
    advanceFaith(copy, () => 0),
    undefined,
  );
  s.mode = "real";
  assert.equal(invokeBlessing(s, t, "joy"), false);
});
test("invasion blessing resolves before spawning attackers or casualties and cannot be rerolled during cooldown", () => {
  const { s } = town();
  const population = s.population;
  launchIslandAttack(s, 5, () => 0);
  assert.equal(s.activeAttack, null);
  assert.equal(s.population, population);
  assert.equal(activeBlessing(s), "protection");
  assert.equal(s.toasts[0].title, "Safe harbor");
  assert.equal(
    repelInvasion(s, () => 0),
    false,
  );
  const { s: other } = town();
  assert.equal(
    repelInvasion(other, () => 0.99),
    false,
  );
  assert.equal(
    repelInvasion(other, () => 0),
    false,
  );
});
test("protected buildings survive fire, legacy saves, invasion and total loss of housing; residents can rehouse once", () => {
  const { s, t } = town();
  s.mode = "survival";
  s.highestStageReached = 4;
  assert.equal(igniteSite(s, t.id), false);
  launchIslandAttack(s, 1, () => 0.99);
  assert.ok(s.activeAttack!.units.every((u) => u.targetElementId !== t.id));
  assert.equal(s.faith!.sheltered, 8);
  s.activeAttack = null;
  s.elements = [t];
  t.onFire = true;
  t.disrepair = true;
  s.money = 0;
  const restored = cloneGameStateSnapshot(s);
  assert.equal(restored.population, 8);
  assert.ok(!restored.elements[0].onFire && !restored.elements[0].disrepair);
  economyOf(restored).recovery = 359;
  advanceEconomy(restored, 3);
  assert.equal(restored.gameOver, false);
  stepSimulation(restored, 1, true);
  assert.ok(restored.money >= 200);
  assert.equal(restored.faith?.recoveryGrant, true);
  assert.equal(rehouseResidents(restored), 0);
  restored.elements.push(
    ...Array.from({ length: 4 }, (_, i) => lot("roads", i, 0)),
    lot("house", 1, -1, 2),
  );
  recomputeConnectivityAndMetrics(restored);
  const before = restored.population;
  assert.equal(rehouseResidents(restored), 8);
  recomputeConnectivityAndMetrics(restored);
  assert.equal(restored.population, before);
  assert.equal(rehouseResidents(restored), 0);
  const empty = createInitialGameState("survival");
  empty.elements = [t];
  evacuate(empty);
  recomputeConnectivityAndMetrics(empty);
  assert.equal(empty.population, 0);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((level) => bedsAt({ ...t, level })),
    [8, 15, 25, 40, 60],
  );
});

test("an invasion destroys two homes once each and counts sheltered residents as survivors", () => {
  const s = createInitialGameState("real"),
    a = lot("house", 0, -1),
    b = lot("house", 4, -1),
    temple = lot("lds_temples", 2, -1);
  s.elements = [
    ...Array.from({ length: 5 }, (_, i) => lot("roads", i, 0)),
    a,
    b,
    temple,
  ];
  recomputeConnectivityAndMetrics(s);
  const originalPopulation = s.population;
  assert.ok(originalPopulation > 8);
  launchIslandAttack(s, 2, () => 0.99);
  const attack = s.activeAttack!;
  for (const unit of attack.units) {
    const home = unit.kind === "tank" ? a : b;
    const [x, z] = gridToWorldCenter(home.gx, home.gz);
    Object.assign(unit, { targetElementId: home.id, x, z, fireCooldown: 0 });
  }
  for (let t = 0; t < 45 && s.activeAttack; t++) stepSimulation(s, 1, true);
  assert.equal(s.activeAttack, null);
  assert.equal(attack.buildingsDestroyed, 2);
  assert.equal(attack.casualties, originalPopulation - 8);
  assert.equal(s.population, 8);
  assert.ok(!temple.onFire);
});
