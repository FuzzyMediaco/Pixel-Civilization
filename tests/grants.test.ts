import assert from "node:assert/strict";
import test from "node:test";
import { CITY_GRANTS, grantProgress, payEarnedGrants } from "../src/game/cityGrants";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  stepSimulation,
  type PlacedElement,
} from "../src/game/simulation";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";

function building(defId: string, gx: number, gz: number): PlacedElement {
  const [spanX, spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[defId], 1);
  return {
    id: defId + "_" + gx + "_" + gz,
    defId,
    gx,
    gz,
    spanX,
    spanZ,
    level: 1,
    variant: 0,
    rotation: 0,
    connected: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animKind: "place",
    animProgress: 0,
  };
}

for (const mode of ["real", "survival"] as const) {
  test(mode + " pays starter grants during active play and remembers them across saves", () => {
    const city = createInitialGameState(mode);
    for (let x = 0; x < 4; x++) city.elements.push(building("roads", x, 0));
    city.elements.push(
      building("house", 0, 1),
      building("house", 1, 1),
      building("house", 2, 1),
      building("grocery_store", 3, 1),
    );
    const treasury = city.money;
    // Older saves have no grant ledger. Inspection, metrics and storage are all read-only for rewards.
    delete city.awardedGrants;
    recomputeConnectivityAndMetrics(city);
    const snapshot = cloneGameStateSnapshot(city);
    assert.equal(snapshot.money, treasury);
    assert.equal(snapshot.awardedGrants, undefined);
    stepSimulation(snapshot, 1, false);
    assert.equal(snapshot.money, treasury);

    const paidControl = cloneGameStateSnapshot(city);
    paidControl.awardedGrants = ["first_street", "market_town"];
    stepSimulation(paidControl, 0.1, true);
    stepSimulation(snapshot, 0.1, true);
    assert.deepEqual(snapshot.awardedGrants, paidControl.awardedGrants);
    assert.equal(Math.round(snapshot.money - paidControl.money), 360);
    const restored = cloneGameStateSnapshot(snapshot);
    assert.deepEqual(payEarnedGrants(restored), []);
    assert.equal(restored.money, snapshot.money);
  });
}

test("late grants are attainable from connected services and displayed requirements include local demand", () => {
  const city = createInitialGameState("real");
  const south = [
    ...Array(8).fill("house"),
    ...Array(5).fill("grocery_store"),
    ...Array(8).fill("businesses"),
  ];
  const north = [...Array(9).fill("solar_panels"), ...Array(8).fill("bus_stops")];
  for (const [row, side] of [
    [south, 1],
    [north, -1],
  ] as const) {
    let x = -15;
    for (const id of row) {
      const el = building(id, x, 0);
      el.gz = side === 1 ? 1 : -el.spanZ;
      city.elements.push(el);
      x += el.spanX;
    }
  }
  for (let x = -15; x <= 15; x++) city.elements.push(building("roads", x, 0));
  recomputeConnectivityAndMetrics(city);
  assert.deepEqual(
    payEarnedGrants(city)
      .map((g) => g.id)
      .sort(),
    CITY_GRANTS.map((g) => g.id).sort(),
  );
  const grid = CITY_GRANTS.find((g) => g.id === "clean_power")!;
  city.metrics.powerDemand = city.metrics.powerSupply + 1;
  assert.equal(
    grantProgress(grid, city.metrics).find((t) => t.label === "Power supply")?.goal,
    city.metrics.powerDemand,
  );
  city.awardedGrants = [];
  assert.ok(!payEarnedGrants(city).some((g) => g.id === grid.id));
});

test("a sandbox can track goals without cash payments", () => {
  const city = createInitialGameState("god");
  const treasury = city.money;
  city.metrics.connectedHouses = 2;
  assert.equal(grantProgress(CITY_GRANTS[0], city.metrics)[0].current, 2);
  assert.deepEqual(payEarnedGrants(city), []);
  assert.equal(city.money, treasury);
});
