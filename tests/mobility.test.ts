import assert from "node:assert/strict";
import { test } from "node:test";
import { createCanalDistrict } from "../src/game/canalDistrict";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  relocatePlacedElement,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import {
  addLine,
  autoStops,
  dispatchVessel,
  hasNavigableHarbor,
  visualFootprint,
  mobilityOf,
  previewWaterPassage,
  stepMobility,
  transitReadout,
} from "../src/game/mobility";
import { getTravelNetwork, vesselHull, vesselIds } from "../src/game/travelNetwork";
import { applyInfrastructureStroke } from "../src/game/terrain";

function site(s: GameState, defId: string, gx: number, gz: number, rotation = 0): PlacedElement {
  const e: PlacedElement = {
    id: defId + "-" + gx + "-" + gz,
    defId,
    gx,
    gz,
    spanX: 1,
    spanZ: 1,
    rotation,
    level: 1,
    variant: 0,
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
  s.elements.push(e);
  return e;
}
function run(s: GameState, seconds: number) {
  for (let i = 0; i < seconds * 2; i++) {
    s.activePlaySec += 0.5;
    stepMobility(s, 0.5);
  }
  recomputeConnectivityAndMetrics(s);
}

test("placed hulls cruise in their own basin without a port and obey moor, recall and relocation", () => {
  for (const defId of ["harbor_tugboat", "coastal_corvette", "naval_vessels", "naval_patrol_cutter", "naval_frigate_ship", "naval_minesweeper", "naval_hospital_ship"]) {
    const s = createInitialGameState("god");
    assert.ok(applyInfrastructureStroke(s, { kind: "pond", depth: 5, radius: 4 }, [{ gx: 0, gz: 0 }]).valid);
    s.mode = "real";
    const ship = site(s, defId, 0, 0);
    ship.level = 5;
    const net = getTravelNetwork(s);
    assert.equal(hasNavigableHarbor(s, ship), false);
    const hull = vesselHull(ship);
    stepMobility(s, .25);
    const v = s.mobility!.voyages[ship.id];
    assert.ok(v.path.length >= 4, defId);
    for (let i = 1; i < v.path.length; i++) assert.ok(net.water.canStep(...v.path[i - 1], ...v.path[i], hull));
    for (let i = 0; i < 10; i++) stepMobility(s, .25);
    assert.ok(Math.hypot(...v.position) > 1.5, defId);
    dispatchVessel(s, ship.id, "moor");
    const rest = structuredClone(v.position);
    stepMobility(s, 1);
    assert.deepEqual(v.position, rest);
    dispatchVessel(s, ship.id, "recall");
    for (let i = 0; i < 40; i++) stepMobility(s, .25);
    assert.ok(v.moored, defId);
    assert.ok(Math.hypot(...v.position) <= 1);
    dispatchVessel(s, ship.id, "sail", [20, 0]);
    stepMobility(s, .25);
    assert.equal(v.path.length, 0, "a manual waypoint across land must stay blocked");
    assert.deepEqual(v.target, [20, 0]);
    assert.ok(relocatePlacedElement(s, ship, 1, 1));
    stepMobility(s, .25);
    assert.ok(Math.hypot(s.mobility!.voyages[ship.id].position[0] - 1, s.mobility!.voyages[ship.id].position[1] - 1) < 1);
  }
  for (const id of ["boats", "sail_boats", "speed_boats", "submarines", "aircraft_carriers"]) assert.ok(vesselIds.has(id));
  assert.ok(!vesselIds.has("docks") && !vesselIds.has("ocean_habitat_ring"));
});

test("replanning on unrelated edits preserves sailing progress and map bounds follow a rotated hull", () => {
  const s = createInitialGameState("god");
  const ship = site(s, "naval_vessels", 42, 30, 1);
  ship.spanX = 4; ship.spanZ = 2;
  stepMobility(s, .25);
  const v = s.mobility!.voyages[ship.id];
  assert.ok(v.path.length > 3);
  const course = structuredClone(v.path);
  for (let i = 0; i < 6; i++) {
    site(s, "house", i, 0);
    stepMobility(s, .25);
  }
  assert.deepEqual(v.path, course);
  assert.ok(v.progress > 1);
  assert.deepEqual(visualFootprint(ship, { position: [14.5, 9.5], heading: Math.PI / 2 }), {gx:13, gz:9, spanX:4, spanZ:2});
  const north = visualFootprint(ship, {position:[14.5, 9.5], heading:0});
  assert.ok(Math.abs(north.spanX - 2) < 1e-8 && Math.abs(north.spanZ - 4) < 1e-8);
});

test("the editable canal district carries people by water and keeps voyages across a save", () => {
  const s = createCanalDistrict();
  assert.equal(transitReadout(s).served, 0);
  run(s, 68);
  for (const l of s.mobility!.lines) assert.ok(l.delivered > 0, l.mode);
  const ship = s.elements.find((e) => e.defId === "sail_boats")!;
  dispatchVessel(s, ship.id, "sail", [21, 0]);
  run(s, 2);
  assert.ok(s.mobility!.voyages[ship.id].path.length > 0);
  const restored = JSON.parse(JSON.stringify(s)) as GameState;
  const before = transitReadout(restored).served;
  run(restored, 4);
  assert.ok(transitReadout(restored).served >= before);
  assert.ok(transitReadout(restored).coverage > 0);
});
test("a shallow crossing interrupts a ferry line and service returns after repair", () => {
  const s = createCanalDistrict(),
    line = s.mobility!.lines.find((l) => l.mode === "ferry")!;
  const cut = Array.from({ length: 3 }, (_, i) => ({ gx: 1, gz: i - 1 }));
  assert.equal(applyInfrastructureStroke(s, { kind: "canal", depth: 0.3, radius: 0 }, cut).valid, true);
  run(s, 50);
  assert.ok(line.blocked, line.status);
  assert.match(line.status, /channel|water|clearance/i);
  const delivered = line.delivered;
  run(s, 12);
  assert.equal(line.delivered, delivered);
  assert.ok(applyInfrastructureStroke(s, { kind: "canal", depth: 2, radius: 0 }, cut).valid);
  run(s, 70);
  assert.ok(line.delivered > delivered);
});
test("the depot, curb orientation and rails govern which stops can actually be reached", () => {
  const s = createInitialGameState("god");
  for (let x = 0; x < 7; x++) site(s, "roads", x, 0);
  const depot = site(s, "bus_depots", 0, -1),
    a = site(s, "bus_stops", 1, -1),
    b = site(s, "bus_stops", 5, -1);
  site(s, "house", 1, 1).rotation = 2;
  site(s, "businesses", 5, 1).rotation = 2;
  assert.deepEqual(autoStops(s, "bus", depot.id), [a.id, b.id]);
  b.rotation = 2;
  assert.deepEqual(autoStops(s, "bus", depot.id), [a.id, b.id]);
  const offRoad = site(s, "bus_stops", 5, -3);
  assert.deepEqual(autoStops(s, "bus", depot.id), [a.id, b.id]);
  assert.throws(() => addLine(s, "bus", depot.id, [a.id, offRoad.id]));
  b.rotation = 0;
  recomputeConnectivityAndMetrics(s);
  const id = addLine(s, "bus", depot.id, [a.id, b.id]);
  run(s, 60);
  const l = mobilityOf(s).lines.find((l) => l.id === id)!;
  assert.ok(l.delivered > 0);
  l.enabled = false;
  const delivered = l.delivered;
  run(s, 10);
  assert.equal(l.delivered, delivered);
});
test("a ship cannot service a nearby harbor across dry land", () => {
  const s = createInitialGameState("real");
  s.highestStageReached = 14;
  s.currentStage = 14;
  s.money = 10000;
  applyInfrastructureStroke(s, { kind: "pond", depth: 2, radius: 0 }, [{ gx: 0, gz: 0 }]);
  applyInfrastructureStroke(s, { kind: "pond", depth: 2, radius: 0 }, [{ gx: 4, gz: 0 }]);
  const ship = site(s, "boats", 0, 0);
  site(s, "docks", 4, 0);
  assert.equal(hasNavigableHarbor(s, ship), false);
  assert.ok(
    applyInfrastructureStroke(s, { kind: "canal", depth: 2 }, [
      { gx: 1, gz: 0 },
      { gx: 3, gz: 0 },
    ]).valid,
  );
  assert.equal(hasNavigableHarbor(s, ship), true);
});

test("long hulls need a turning basin and a restored city uses its own water map", () => {
  const s = createInitialGameState("god");
  const works = (kind: "canal" | "pond", points: [number, number][], radius = 0) =>
    assert.ok(
      applyInfrastructureStroke(
        s,
        { kind, depth: 2, radius },
        points.map(([gx, gz]) => ({ gx, gz })),
      ).valid,
    );
  works("canal", [
    [-4, 0],
    [0, 0],
    [0, 4],
  ]);
  const small = { beam: 1, draft: 0.25, height: 0.8 },
    long = { ...small, turningWidth: 9 };
  const route = (state: GameState, hull: typeof small) =>
    getTravelNetwork(state).path([[-4, 0]], [[0, 4]], "ferry", hull);
  assert.ok(route(s, small));
  assert.equal(route(s, long), null);
  assert.match(getTravelNetwork(s).diagnose([[-4, 0]], [[0, 4]], "ferry", long).reason, /turning basin/);
  works("pond", [[0, 0]], 2);
  assert.ok(route(s, long));
  const other = structuredClone(s);
  const bank = other.infrastructure!.cells["-3,0"];
  bank.elevation = 4;
  bank.depth = 0;
  bank.water = "dry";
  bank.kind = "land";
  assert.equal(route(other, long), null);
  assert.ok(route(s, long));
});

test("the engineering preview warns about a ferry cutoff without spending or changing the island", () => {
  const s = createCanalDistrict(),
    before = JSON.stringify(s);
  const cut = [
    { gx: 1, gz: -1 },
    { gx: 1, gz: 1 },
  ];
  const result = previewWaterPassage(s, { kind: "canal", depth: 0.3, radius: 0 }, cut);
  assert.ok(result.some((note) => /ferry/i.test(note) && note.includes("new passage")));
  assert.equal(JSON.stringify(s), before);
});

test("a line must have one continuous return circuit through all its berths", () => {
  const s = createInitialGameState("god");
  for (const z of [0, 2])
    applyInfrastructureStroke(s, { kind: "canal", radius: 0, depth: 2 }, [
      { gx: 0, gz: z },
      { gx: 6, gz: z },
    ]);
  const depot = site(s, "docks", 0, 1),
    left = site(s, "ferry_landings", 2, -1),
    both = site(s, "docks", 5, 1),
    right = site(s, "ferry_landings", 2, 3);
  assert.throws(() => addLine(s, "gondola", depot.id, [left.id, both.id, right.id]));
  const stops = autoStops(s, "gondola", depot.id);
  assert.ok(stops.length >= 2);
  assert.doesNotThrow(() => addLine(s, "gondola", depot.id, stops));
});

test("a night-only line cannot supply daytime access and an empty city generates no passengers", () => {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = 0; x < 6; x++) site(s, "roads", x, 0);
  const depot = site(s, "bus_depots", 0, -1),
    a = site(s, "bus_stops", 2, -1),
    b = site(s, "bus_stops", 5, -1);
  addLine(s, "bus", depot.id, [a.id, b.id]);
  const line = s.mobility!.lines[0];
  line.schedule = "night";
  assert.equal(transitReadout(s).reachable.size, 0);
  s.timeOfDay = 23;
  assert.ok(transitReadout(s).reachable.size > 0);
  run(s, 65);
  assert.equal(line.delivered, 0);
});

test("cargo holds cannot board passengers who are waiting for a ferry transfer", () => {
  const s = createInitialGameState("god");
  applyInfrastructureStroke(s, { kind: "canal", radius: 1, depth: 2 }, [
    { gx: -3, gz: 0 },
    { gx: 6, gz: 0 },
  ]);
  const a = site(s, "docks", -2, -1),
    b = site(s, "docks", 4, -1);
  addLine(s, "freight", a.id, [a.id, b.id]);
  const m = s.mobility!,
    line = m.lines[0];
  m.transfers[b.id] = [{ destination: a.id, count: 3, boarded: 0 }];
  for (let i = 0; i < 25; i++) {
    s.activePlaySec += 0.5;
    stepMobility(s, 0.5);
  }
  assert.ok(line.departures > 0);
  assert.equal(m.transfers[b.id][0].count, 3);
  assert.equal(line.riders.length, 0);
});

test("out-of-bounds targets cannot wrap to a tile in the next row", () => {
  const s = createInitialGameState("god");
  const n = getTravelNetwork(s);
  assert.equal(n.path([[-96, 1]], [[96, 0]], "ferry", { beam: 1, draft: 0.2, height: 0.5 }), null);
});
