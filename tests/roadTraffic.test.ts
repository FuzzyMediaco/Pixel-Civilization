import assert from "node:assert/strict";
import { test } from "node:test";
import { Group } from "three";
import "../src/game/designs/index";
import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "../src/game/catalog";
import { getRoadTripNetwork, roadTripPoints, trafficFleetTarget } from "../src/game/roadTraffic";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { ensureInfrastructure, getTerrainCell } from "../src/game/terrain";
import { PixelWorldRenderer } from "../src/game/worldRenderer";
import { TILE_SIZE } from "../src/game/voxelCore";

function lot(defId: string, gx: number, gz: number, rotation = 0): PlacedElement {
  return {
    id: defId + "@" + gx + "," + gz,
    defId,
    gx,
    gz,
    rotation,
    level: 1,
    variant: 1,
    spanX: 1,
    spanZ: 1,
    connected: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 0,
    animKind: "place",
  };
}
function island(elements: PlacedElement[], hour = 12) {
  const s = createInitialGameState("god");
  s.timeOfDay = hour;
  s.elements = elements;
  recomputeConnectivityAndMetrics(s);
  return s;
}
function street(end: number) {
  return [
    ...Array.from({ length: end + 1 }, (_, x) => lot("roads", x, 0)),
    lot("shops", 0, -1),
    lot("shops", end, 1, 2),
  ];
}
// Exercise the actual scene actors and road geometry without opening a WebGL window in CI.
function trafficView(s: GameState) {
  const view = Object.assign(Object.create(PixelWorldRenderer.prototype), {
    gameState: s,
    trafficGroup: new Group(),
    trafficAgents: [],
    streets: new Map(),
    carClock: 0,
    availableAfter: [],
    departureTimer: 0,
    routeCursor: 0,
    carSequence: 0,
    isSoftwareGl: false,
  }) as {
    gameState: GameState;
    refreshNetworkCache: () => void;
    stepAmbientCars: (dt: number) => void;
    ambientCarTrips: PixelWorldRenderer["ambientCarTrips"];
  };
  view.refreshNetworkCache();
  return view;
}
test("a one-tile local street provides real door-to-door service before residents arrive", () => {
  const s = island(street(0));
  s.population = 0;
  const graph = getRoadTripNetwork(s);
  assert.equal(graph.routes.length, 2);
  assert.equal(trafficFleetTarget(graph, 0, s.metrics.trafficTrips, 60, 12), 1);
  const view = trafficView(s),
    arrivals = new Set<string>();
  for (let frame = 0; frame < 600; frame++) {
    view.stepAmbientCars(0.05);
    for (const car of view.ambientCarTrips()) {
      assert.notEqual(car.origin.siteId, car.destination.siteId);
      assert.deepEqual(car.path, [[0, 0]]);
      assert.ok(car.kind !== "bus" && car.kind !== "taxi");
      if (car.arrived) {
        const g = car.destination;
        assert.ok(
          Math.hypot(
            car.position[0] - (g.gx + 0.5 + g.dx * 0.5) * TILE_SIZE,
            car.position[1] - (g.gz + 0.5 + g.dz * 0.5) * TILE_SIZE,
          ) < 0.03,
        );
        arrivals.add(g.siteId);
      }
    }
  }
  assert.equal(arrivals.size, 2);
});
test("a spur with no destination, a broken street and a pedestrian bridge cannot carry a through car", () => {
  const s = island([...street(4), lot("roads", 2, 1), lot("roads", 2, 2), lot("roads", 8, 8)]);
  const graph = getRoadTripNetwork(s);
  assert.deepEqual([...graph.tiles].sort(), ["0,0", "1,0", "2,0", "3,0", "4,0"]);
  const route = graph.routes[0],
    points = roadTripPoints(route);
  assert.equal(points.length, route.path.length + 2);
  const view = trafficView(s);
  view.stepAmbientCars(0.05);
  assert.equal(view.ambientCarTrips().length, 1);
  const middle = s.elements.find((e) => e.gx === 2 && e.gz === 0)!;
  s.elements = s.elements.filter((e) => e !== middle);
  recomputeConnectivityAndMetrics(s);
  view.refreshNetworkCache();
  assert.equal(view.ambientCarTrips().length, 0);
  for (const defId of ["walking_paths", "train_tracks"]) {
    middle.defId = defId;
    s.elements.push(middle);
    assert.equal(getRoadTripNetwork(s).routes.length, 0);
    s.elements.pop();
  }
  middle.defId = "roads";
  s.elements.push(middle);
  middle.pedestrianDeck = true;
  assert.equal(getRoadTripNetwork(s).routes.length, 0);
  middle.pedestrianDeck = false;
  const loaded = JSON.parse(JSON.stringify(s)) as GameState;
  recomputeConnectivityAndMetrics(loaded);
  view.gameState = loaded;
  view.refreshNetworkCache();
  view.stepAmbientCars(0.05);
  assert.equal(view.ambientCarTrips().length, 1);
  const shop = loaded.elements.find((e) => e.defId === "shops")!;
  shop.edgeOverrides = { front: "closed" };
  view.refreshNetworkCache();
  assert.equal(view.ambientCarTrips().length, 0);
  shop.edgeOverrides = { front: "auto" };
  shop.rotation = 2;
  assert.ok(getRoadTripNetwork(loaded).routes.length > 0, "roads automatically connect to adjacent buildings from any side");
});
test("separated decks, restricted approaches and a permanent lift opening break invalid journeys", () => {
  const s = island([
    lot("over_passes", 0, 0),
    lot("roads", -2, 0),
    lot("over_passes", -1, 0),
    lot("over_passes", 1, 0),
    lot("roads", 0, -1),
    lot("roads", 0, 1),
    lot("house", -3, 0, 1),
    lot("shops", 0, 2, 2),
  ]);
  assert.equal(getRoadTripNetwork(s).routes.length, 0);
  const st = island(street(4));
  const i = ensureInfrastructure(st);
  i.streets["2,0"] = { lanes: 2, signal: "north", period: 12 };
  i.revision++;
  assert.equal(getRoadTripNetwork(st).routes.length, 0);
  i.streets["2,0"].signal = "yield";
  i.streets["2,0"].ports = 5;
  i.revision++;
  assert.equal(getRoadTripNetwork(st).routes.length, 0);
  i.streets["2,0"].ports = 10;
  i.spans["2,0"] = {
    mode: "road",
    shape: "lift",
    axis: "x",
    end: false,
    deck: 0,
    startHeight: 0,
    endHeight: 0,
    direction: 1,
    ramp: false,
    run: "test-lift",
    lift: "open",
  };
  i.revision++;
  assert.equal(getRoadTripNetwork(st).routes.length, 0);
  i.spans["2,0"].lift = "closed";
  i.revision++;
  assert.equal(getRoadTripNetwork(st).routes.length, 2);
  delete i.spans["2,0"];
  i.cells["2,0"] = { ...getTerrainCell(st, 2, 0), elevation: 5 };
  i.revision++;
  assert.equal(getRoadTripNetwork(st).routes.length, 0);
});
test("a fleet capped at one car completes fewer departures after dark even under heavy demand", (t) => {
  function departures(hour: number) {
    const tower = lot("skyscrapers", 0, 0),
      shops = lot("shops", -1, 1, 2);
    for (const site of [tower, shops]) {
      site.level = 5;
      [site.spanX, site.spanZ] = getStandardFootprintForLevel(ELEMENT_BY_ID[site.defId], 5);
    }
    tower.gz = -tower.spanZ;
    const s = island([tower, shops, lot("roads", 0, 0)], hour);
    assert.ok(s.population > 0);
    assert.equal(
      trafficFleetTarget(getRoadTripNetwork(s), s.population, s.metrics.trafficTrips, 60, hour),
      1,
    );
    const view = trafficView(s),
      ids = new Set<number>();
    for (let frame = 0; frame < 1800; frame++) {
      view.stepAmbientCars(0.05);
      for (const car of view.ambientCarTrips()) ids.add(car.id);
    }
    return ids.size;
  }
  const day = departures(12),
    night = departures(1);
  t.diagnostic(day + " daytime departures and " + night + " overnight departures in 90 seconds");
  assert.ok(day >= 8 && night > 0 && night <= day * 0.65, `day ${day}, night ${night}`);
});
test("cars wait at an automatic signal and complete the same trip when the approach turns green", () => {
  const s = island(street(3));
  const infra = ensureInfrastructure(s);
  infra.streets["1,0"] = { lanes: 2, signal: "auto", period: 12 };
  infra.revision++;
  s.activePlaySec = 0; // North/south has the green phase on this tile.
  const view = trafficView(s);
  for (let k = 0; k < 120; k++) view.stepAmbientCars(0.05);
  const waiting = view.ambientCarTrips().find((car) => car.id === 0)!;
  assert.ok(waiting && !waiting.arrived && waiting.position[0] < TILE_SIZE);
  for (let k = 0; k < 40; k++) view.stepAmbientCars(0.05);
  assert.deepEqual(view.ambientCarTrips().find((car) => car.id === waiting.id)?.position, waiting.position);
  s.activePlaySec = 5;
  let reached = false;
  for (let k = 0; k < 240; k++) {
    view.stepAmbientCars(0.05);
    reached ||= view.ambientCarTrips().some((car) => car.id === waiting.id && car.arrived);
  }
  assert.ok(reached);
});
