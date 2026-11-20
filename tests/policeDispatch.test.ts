import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialGameState,
  stepSimulation,
  triggerCrimeIncident,
  type GameState,
  type PlacedElement,
  type CrimeIncident,
} from "../src/game/simulation";
import { setEconomicControl, economyOf } from "../src/game/cityEconomy";
import { advancePatrol, findPatrolDispatch, patrolPosition } from "../src/game/policeDispatch";
import { getTravelNetwork } from "../src/game/travelNetwork";
import { applyInfrastructureStroke } from "../src/game/terrain";

function place(state: GameState, defId: string, gx: number, gz: number, rotation = 0) {
  const el: PlacedElement = {
    defId,
    id: defId + "-" + gx + "-" + gz,
    gx,
    gz,
    rotation,
    spanX: 1,
    spanZ: 1,
    variant: 0,
    level: 1,
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
  state.elements.push(el);
  return el;
}
function town() {
  const s = createInitialGameState("god");
  s.elements = [];
  s.godCrimeEnabled = true;
  s.metrics.crimeUnlocked = true;
  return s;
}
function incident(s: GameState, station: PlacedElement, home: PlacedElement): CrimeIncident {
  const route = findPatrolDispatch(s, [station], home);
  assert.ok(route);
  return {
    id: "call",
    targetElementId: home.id,
    targetGx: home.gx,
    targetGz: home.gz,
    policeGx: station.gx,
    policeGz: station.gz,
    policeOriginId: station.id,
    policeArrived: false,
    progressSec: 0,
    maxSec: 12.5,
    policeRoute: route.path,
    policeTravel: 0,
  };
}

test("no responding cruiser or automatic recovery exists across detached streets", () => {
  const s = town(),
    station = place(s, "police_departments", 16, 5),
    victim = place(s, "house", 21, 5);
  station.hasPoliceCover = true;
  setEconomicControl(s, "authority", 1, true);
  economyOf(s).sites[station.id] = { workers: 4 } as ReturnType<typeof economyOf>["sites"][string];
  assert.equal(findPatrolDispatch(s, [station], victim), undefined);
  place(s, "roads", 16, 6);
  place(s, "roads", 21, 6);
  assert.equal(findPatrolDispatch(s, [station], victim), undefined);
  assert.ok(triggerCrimeIncident(s));
  const call = s.crimeIncidents.at(-1)!;
  assert.equal(call.targetElementId, victim.id);
  assert.equal(call.policeOriginId, null);
  assert.equal(patrolPosition(s, call), undefined);
  call.progressSec = call.maxSec - 0.2;
  s.crimeCooldownSec = 100;
  stepSimulation(s, 0.3, true);
  assert.ok(!s.crimeIncidents.includes(call));
  assert.equal(call.policeArrived, false);
});

test("a gate-to-gate patrol departs from its real curb, follows the deck and waits when a lift blocks it", () => {
  const s = town();
  assert.ok(
    applyInfrastructureStroke(s, { kind: "canal", depth: 2 }, [
      { gx: 15, gz: 5 },
      { gx: 15, gz: 9 },
    ]).valid,
  );
  assert.ok(
    applyInfrastructureStroke(s, { kind: "bridge", shape: "lift", mode: "road", height: 2, lift: "closed" }, [
      { gx: 14, gz: 7 },
      { gx: 16, gz: 7 },
    ]).valid,
  );
  for (const x of [12, 13, 17, 18]) place(s, "roads", x, 7);
  const station = place(s, "police_departments", 12, 6),
    home = place(s, "house", 18, 6),
    call = incident(s, station, home);
  assert.deepEqual([patrolPosition(s, call)!.gx, patrolPosition(s, call)!.gz], [12.5, 7.5]);
  call.progressSec = 2.5;
  advancePatrol(s, call, 2.5);
  const pose = patrolPosition(s, call)!;
  assert.deepEqual([pose.gx, pose.gz, pose.height], [15.5, 7.5, 2]);
  const blocked = incident(s, station, home);
  assert.ok(
    applyInfrastructureStroke(s, { kind: "bridge", shape: "lift", mode: "road", height: 2, lift: "open" }, [
      { gx: 15, gz: 7 },
    ]).valid,
  );
  blocked.progressSec = 6;
  advancePatrol(s, blocked, 6);
  assert.ok(patrolPosition(s, blocked)!.gx < 15);
  assert.equal(blocked.policeArrived, false);
  assert.ok(
    applyInfrastructureStroke(s, { kind: "bridge", shape: "lift", mode: "road", height: 2, lift: "closed" }, [
      { gx: 15, gz: 7 },
    ]).valid,
  );
  blocked.progressSec = 11;
  advancePatrol(s, blocked, 5);
  assert.equal(blocked.policeArrived, true);
});

test("a road cut or closed victim gate during a police response prevents a phantom arrival", () => {
  for (const removeStreet of [false, true]) {
    const s = town(),
      station = place(s, "police_departments", -8, 6),
      victim = place(s, "house", -1, 6);
    for (let x = -8; x <= -1; x++) place(s, "roads", x, 7);
    const call = incident(s, station, victim);
    call.progressSec = 1;
    advancePatrol(s, call, 1);
    if (removeStreet) s.elements = s.elements.filter((e) => !(e.gx === -3 && e.gz === 7));
    else victim.edgeOverrides = { front: "closed" };
    call.progressSec = 6;
    advancePatrol(s, call, 5);
    assert.equal(call.policeOriginId, null);
    assert.equal(call.policeArrived, false);
    assert.equal(patrolPosition(s, call), undefined);
  }
});

test("scheduled motor vehicles and fire engines use working gates while a maintenance stair serves walkers", () => {
  const s = town();
  assert.ok(applyInfrastructureStroke(s, { kind: "lower", height: 2 }, [{ gx: 7, gz: 1 }]).valid);
  const hydro = place(s, "hydro_electric_power_plants", 7, 1),
    road = place(s, "roads", 7, 2);
  const stop = place(s, "bus_stops", 4, 1);
  place(s, "freeways", 4, 2);
  const net = getTravelNetwork(s);
  assert.deepEqual(net.connectors(hydro, "walk"), [[road.gx, road.gz]]);
  assert.deepEqual(net.connectors(hydro, "taxi"), []);
  assert.deepEqual(net.connectors(stop, "bus"), []);
  s.elements.find((e) => e.defId === "freeways")!.defId = "roads";
  const open = getTravelNetwork(s);
  assert.deepEqual(open.connectors(stop, "bus"), [[4, 2]]);
  stop.edgeOverrides = { front: "closed" };
  assert.deepEqual(getTravelNetwork(s).connectors(stop, "taxi"), []);
});

test("a nearer isolated station is skipped and an old saved response resolves from the reachable station", () => {
  const s = town(),
    detached = place(s, "police_precinct", 8, 0),
    home = place(s, "house", 10, 0),
    station = place(s, "police_departments", 4, 4, 2);
  for (let z = 1; z <= 3; z++) place(s, "roads", 4, z);
  for (let x = 5; x <= 10; x++) place(s, "roads", x, 1);
  detached.edgeOverrides = { front: "closed" };
  const dispatch = findPatrolDispatch(s, [detached, station], home);
  assert.equal(dispatch?.station, station);
  const old = incident(s, station, home);
  delete old.policeRoute;
  old.policeArrived = true;
  assert.ok(advancePatrol(s, old, 0.2));
  const pose = patrolPosition(s, old);
  assert.equal(pose?.gx, 10.5);
  s.elements = s.elements.filter((e) => !(e.gx === 10 && e.gz === 1));
  assert.equal(patrolPosition(s, old, getTravelNetwork(s)), undefined);
  assert.equal(old.policeArrived, true);
});
