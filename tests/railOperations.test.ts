import assert from "node:assert/strict";
import test from "node:test";
import {
  ELEMENT_BY_ID,
  getStandardFootprintForLevel,
} from "../src/game/catalog";
import { addLine, stepMobility } from "../src/game/mobility";
import { siteOf, advanceEconomy } from "../src/game/cityEconomy";
import { railBodies } from "../src/game/railMovement";
import {
  assignContract,
  advanceRailFreightStock,
  freightCall,
  freightAvailable,
  changeFormation,
  defaultFormation,
  installYardWork,
  railFreightBonus,
  setTurnout,
  trainFor,
} from "../src/game/railOperations";
import {
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { getTravelNetwork } from "../src/game/travelNetwork";
import { visitPracticeRailway } from "../src/game/practiceRailway";
import { buildRailModel } from "../src/game/railModels";

function put(
  s: GameState,
  id: string,
  x: number,
  z: number,
  level = 1,
  rotation = 0,
) {
  const [sx, sz] = getStandardFootprintForLevel(ELEMENT_BY_ID[id], level);
  const e: PlacedElement = {
    id: id + x + "," + z,
    defId: id,
    gx: x,
    gz: z,
    spanX: rotation % 2 ? sz : sx,
    spanZ: rotation % 2 ? sx : sz,
    level,
    rotation,
    variant: 1,
    connected: true,
    hasPoliceCover: true,
    hasFireCover: true,
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
function district() {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = -9; x <= 10; x++) put(s, "train_tracks", x, 0);
  for (let x = -10; x <= 11; x++) put(s, "roads", x, 3);
  const depot = put(s, "train_depots", -9, 1, 2),
    a = put(s, "train_stops", -4, 1, 2),
    b = put(s, "train_stops", 7, 1, 2);
  const cargoA = put(s, "freight_rail_terminal", -6, -1, 1, 2),
    cargoB = put(s, "freight_rail_terminal", 5, -1, 1, 2);
  const farm = put(s, "farms", -7, -1),
    shop = put(s, "grocery_store", 7, -1);
  put(s, "train_tracks", 1, -1);
  put(s, "train_tracks", 1, -2);
  put(s, "train_tracks", 2, -2);
  for (let x = -8; x <= 9; x++) if (x % 3 === 0) put(s, "house", x, 4, 1, 2);
  s.population = 60;
  return { s, depot, a, b, cargoA, cargoB, farm, shop };
}
function step(s: GameState, seconds: number) {
  for (let t = 0; t < seconds; t += 0.25) {
    s.activePlaySec += 0.25;
    stepMobility(s, 0.25);
  }
}
test("a rotated platform, turnout and a closed section govern actual paths; formations retain a rail-centred tail across turns and reversals", () => {
  const { s, depot, a, b } = district();
  const net = getTravelNetwork(s);
  assert.ok(net.connectors(a, "rail").length);
  a.rotation = 2;
  assert.equal(getTravelNetwork(s).connectors(a, "rail").length, 0);
  a.rotation = 0;
  const uid = addLine(s, "rail", depot.id, [a.id, b.id], {
    ...defaultFormation(),
    cars: ["coach", "sleeper", "observation"],
  });
  const l = s.mobility!.lines.find((l) => l.id === uid)!;
  let full = false,
    changedCab = false;
  for (let t = 0; t < 160; t += 0.25) {
    s.activePlaySec += 0.25;
    stepMobility(s, 0.25);
    const bodies = railBodies(l);
    if (bodies.length === 4) {
      full = true;
      for (const {
        point: [x, z],
      } of bodies) {
        assert.ok(net.canUse(Math.round(x), Math.round(z), "rail"));
      }
    }
    if (l.rail!.rearCab) changedCab = true;
  }
  assert.ok(full && changedCab);
  assert.ok(l.departures >= 4);
  const before = l.departures;
  l.enabled = false;
  step(s, 1);
  setTurnout(s, 1, 0, "north-south");
  l.enabled = true;
  step(s, 55);
  assert.ok(l.blocked && l.departures < before + 4);
  setTurnout(s, 1, 0, "auto");
  step(s, 50);
  assert.ok(!l.blocked && l.departures > before);
  const restored = JSON.parse(JSON.stringify(s)) as GameState;
  step(restored, 2);
  assert.equal(restored.mobility!.lines[0].rail!.cars.length, 3);
});
test("shared block reservations release fairly, enforce platform length and reject unfunded purchases", () => {
  const { s, depot, a, b } = district(),
    f = defaultFormation();
  const one = addLine(s, "rail", depot.id, [a.id, b.id], f);
  addLine(s, "rail", depot.id, [b.id, a.id], {
    ...f,
    name: "Express",
    priority: "express",
  });
  let wait = false;
  for (let t = 0; t < 165; t += 0.25) {
    s.activePlaySec += 0.25;
    stepMobility(s, 0.25);
    const [a, b] = s.mobility!.lines,
      held = a.rail?.reservation ?? [];
    assert.ok(!(b.rail?.reservation ?? []).some((k) => held.includes(k)));
    for (const first of railBodies(a))
      for (const other of railBodies(b))
        assert.ok(
          Math.hypot(
            first.point[0] - other.point[0],
            first.point[1] - other.point[1],
          ) > 0.48,
        );
    wait ||= s.mobility!.lines.some((l) => l.status.includes("Red signal"));
  }
  assert.ok(wait && s.mobility!.lines.every((l) => l.departures > 1));
  assert.throws(
    () => changeFormation(s, one, { ...f, cars: Array(8).fill("coach") }),
    /shortest platform/,
  );
  assert.throws(
    () => changeFormation(s, one, { ...f, cars: ["gondola"] }),
    /matching/,
  );
  installYardWork(s, depot, "wire");
  changeFormation(s, one, { ...f, engine: "electric" });
  s.mode = "real";
  s.money = 0;
  assert.throws(() => installYardWork(s, depot, "siding"), /Treasury/);
});
test("freight uses compatible cars, explicit terminal industries and completed deliveries, then its optional benefit expires", () => {
  const { s, depot, cargoA, cargoB, farm, shop } = district();
  const id = addLine(s, "rail", depot.id, [cargoA.id, cargoB.id], {
    ...defaultFormation("freight"),
    engine: "diesel",
    cars: ["hopper", "gondola"],
  });
  const l = s.mobility!.lines.find((l) => l.id === id)!;
  const proposal = {
    type: "grain",
    pickup: cargoA.id,
    drop: cargoB.id,
    source: farm.id,
    sink: shop.id,
  } as const;
  assert.equal(railFreightBonus(s, farm.id, "grain"), 1);
  assert.throws(
    () => assignContract(s, l, { ...proposal, type: "fuel" }),
    /compatible/,
  );
  siteOf(s, farm).food = 30;
  siteOf(s, farm).yieldRate = 1;
  assignContract(s, l, proposal);
  const oldForm = structuredClone(trainFor(l));
  let loaded = false;
  for (let t = 0; t < 85; t++) {
    step(s, 1);
    loaded ||= trainFor(l).contract!.loaded > 0;
  }
  assert.ok(loaded && trainFor(l).contract!.delivered >= 22 && l.delivered > 0);
  const delivered = l.rail!.contract!.delivered,
    trail = structuredClone(l.rail!.trail);
  changeFormation(s, l.id, { ...oldForm, frequency: 12 });
  assert.equal(l.rail!.contract!.delivered, delivered);
  assert.deepEqual(l.rail!.trail, trail);
  assert.equal(railFreightBonus(s, shop.id, "grain"), 1.08);
  l.enabled = false;
  assert.equal(railFreightBonus(s, farm.id, "grain"), 1);
  s.activePlaySec += 100;
  l.enabled = true;
  assert.equal(railFreightBonus(s, shop.id, "grain"), 1);
});
test("real locomotive and rolling-stock meshes are distinct and loaded open cars change their silhouette", () => {
  const signatures = new Set<string>();
  for (const id of [
    "steam",
    "diesel",
    "electric",
    "commuter",
    "express",
    "hopper",
    "coach",
    "sleeper",
    "observation",
  ]) {
    const g = buildRailModel(id);
    const pos = g.getAttribute("position");
    assert.ok(pos.count > 50);
    signatures.add(Array.from(pos.array).join(","));
    g.dispose();
  }
  assert.equal(signatures.size, 9);
  for (const id of ["hopper", "gondola", "flat", "container", "waste"]) {
    const a = buildRailModel(id),
      b = buildRailModel(id + "/full");
    assert.notDeepEqual(
      a.getAttribute("position").array,
      b.getAttribute("position").array,
    );
    a.dispose();
    b.dispose();
  }
});

test("Switchyard opens the practice railway once and both services work around the bend", () => {
  const original = createInitialGameState("god");
  original.exampleWorldId = "switchyard-city";
  original.timeOfDay = 12;
  const { state: s, depot } = visitPracticeRailway(original);
  assert.equal(original.elements.length, 0);
  const again = visitPracticeRailway(s);
  assert.equal(again.state, s);
  assert.equal(again.depot, depot);
  const [passenger, goods] = s.mobility!.lines;
  let bent = false;
  for (let t = 0; t < 230; t += 0.25) {
    step(s, 0.25);
    advanceEconomy(s, 0.25);
    const cars = railBodies(passenger);
    if (
      cars.length === 4 &&
      cars.some((c) => c.point[1] < -0.05) &&
      cars.some((c) => c.point[1] === 0)
    ) {
      for (const c of cars)
        assert.ok(
          getTravelNetwork(s).canUse(
            Math.round(c.point[0]),
            Math.round(c.point[1]),
            "rail",
          ),
        );
      bent = true;
    }
  }
  assert.ok(bent && passenger.delivered > 0);
  assert.ok(goods.rail!.contract!.delivered > 0);
  const restored = JSON.parse(JSON.stringify(s)) as GameState;
  assert.equal(visitPracticeRailway(restored).depot, depot);
});

test("competing freight trains share real stocks; unloading moves meals and unstaffed industries earn no goods", () => {
  const { s, depot, cargoA, cargoB, farm, shop } = district(),
    proposal = {
      type: "grain",
      pickup: cargoA.id,
      drop: cargoB.id,
      source: farm.id,
      sink: shop.id,
    } as const;
  for (let i = 0; i < 2; i++)
    addLine(s, "rail", depot.id, [cargoA.id, cargoB.id], {
      ...defaultFormation("freight"),
      cars: ["hopper"],
    });
  const [a, b] = s.mobility!.lines,
    net = getTravelNetwork(s),
    grower = siteOf(s, farm);
  grower.food = 28;
  grower.yieldRate = 1;
  for (const train of [a, b]) {
    assignContract(s, train, proposal);
    freightCall(s, train, cargoA, net);
  }
  assert.equal(a.rail!.contract!.loaded, 22);
  assert.equal(b.rail!.contract!.loaded, 6);
  assert.equal(grower.food, 0);
  for (const train of [a, b]) {
    freightCall(s, train, cargoB, net);
    freightCall(s, train, cargoA, net);
  }
  assert.equal(siteOf(s, shop).food, 28);
  assert.equal(s.railYard!.received![shop.id].grain, 28);
  assert.equal(a.rail!.contract!.loaded + b.rail!.contract!.loaded, 0);
  const factory = put(s, "factories", -6, -2);
  const nav = getTravelNetwork(s),
    operations = siteOf(s, factory);
  for (const train of [a, b]) {
    train.rail!.cars = ["box"];
    assignContract(s, train, {
      ...proposal,
      type: "goods",
      source: factory.id,
    });
  }
  operations.jobs = 10;
  operations.workers = 0;
  advanceRailFreightStock(s, nav, 10);
  assert.equal(freightAvailable(s, factory.id, "goods"), 0);
  operations.workers = 10;
  advanceRailFreightStock(s, nav, 10);
  assert.equal(freightAvailable(s, factory.id, "goods"), 6);
  for (const train of [a, b]) freightCall(s, train, cargoA, nav);
  assert.equal(a.rail!.contract!.loaded + b.rail!.contract!.loaded, 6);
  assert.equal(freightAvailable(s, factory.id, "goods"), 0);
  factory.onFire = true;
  advanceRailFreightStock(s, nav, 100);
  assert.equal(freightAvailable(s, factory.id, "goods"), 0);
});

// ---------------------------------------------------------------- round 2: blocks, lines with N trains, physics
import { addTrainToLine, lineHeadway, transitReadout } from "../src/game/mobility";
import { railLeg } from "../src/game/railMovement";
function loopDistrict(withLoop: boolean) {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = -12; x <= 12; x++) put(s, "train_tracks", x, 0);
  if (withLoop) {
    for (const x of [-3, 3]) put(s, "train_tracks", x, -1);
    for (let x = -3; x <= 3; x++) put(s, "train_tracks", x, -2);
  }
  for (let x = -13; x <= 13; x++) put(s, "roads", x, 3);
  const depot = put(s, "train_depots", -12, 1, 2),
    west = put(s, "train_stops", -9, 1, 2),
    east = put(s, "train_stops", 9, 1, 2),
    eastDepot = put(s, "train_depots", 11, 1, 2);
  for (let x = -11; x <= 11; x += 2) put(s, "house", x, 4, 1, 2);
  s.population = 80;
  return { s, depot, west, east, eastDepot };
}
function runYard(s: GameState, seconds: number) {
  const red: Record<string, number> = {};
  let ghosts = 0;
  for (let t = 0; t < seconds; t += 0.25) {
    s.activePlaySec += 0.25;
    stepMobility(s, 0.25);
    const rails = s.mobility!.lines.filter((l) => l.mode === "rail");
    for (const l of rails) {
      if (l.status.startsWith("Red signal")) red[l.id] = (red[l.id] ?? 0) + 0.25;
      if (l.rail!.ghost) ghosts++;
    }
    for (let i = 0; i < rails.length; i++)
      for (let j = 0; j < i; j++) {
        const a = new Set(rails[i].rail!.reservation ?? []);
        const both = (rails[j].rail!.reservation ?? []).filter((k) => a.has(k));
        assert.ok(!both.length, "two trains hold the same tile " + both + " at " + s.activePlaySec + ": " + rails[i].status + " / " + rails[j].status + " ghost " + rails[i].rail!.ghost + rails[j].rail!.ghost);
      }
  }
  return { red, ghosts };
}
test("a passing loop lets opposing trains pass; without one they time-share the single track, never deadlocking", () => {
  const result: { departures: number; red: number }[] = [];
  for (const loop of [false, true]) {
    const { s, depot, west, east, eastDepot } = loopDistrict(loop);
    addLine(s, "rail", depot.id, [west.id, east.id], defaultFormation());
    addLine(s, "rail", eastDepot.id, [east.id, west.id], { ...defaultFormation(), name: "Counter" });
    const { red, ghosts } = runYard(s, 300);
    assert.equal(ghosts, 0);
    assert.ok(s.mobility!.lines.every((l) => l.departures >= 3));
    result.push({
      departures: s.mobility!.lines.reduce((n, l) => n + l.departures, 0),
      red: Object.values(red).reduce((a, b) => a + b, 0),
    });
  }
  assert.ok(result[1].departures > result[0].departures && result[1].red < result[0].red, JSON.stringify(result));
});
function ringDistrict() {
  const s = createInitialGameState("god");
  s.timeOfDay = 12;
  for (let x = -6; x <= 6; x++) for (const z of [0, -4]) put(s, "train_tracks", x, z);
  for (let z = -3; z <= -1; z++) for (const x of [-6, 6]) put(s, "train_tracks", x, z);
  for (let x = -8; x <= 8; x++) put(s, "roads", x, 3);
  const west = put(s, "train_stops", -4, 1, 2),
    east = put(s, "train_stops", 3, 1, 2),
    depot = put(s, "train_depots", -1, 1, 2);
  for (let x = -7; x <= 7; x += 2) put(s, "house", x, 4, 1, 2);
  s.population = 90;
  return { s, depot, west, east };
}
test("a line runs N trains: adding a train halves the headway and riders wait less", () => {
  const waits: number[] = [];
  for (const trains of [1, 2]) {
    const { s, depot, west, east } = ringDistrict();
    const id = addLine(s, "rail", depot.id, [west.id, east.id], defaultFormation());
    const single = lineHeadway(s, id);
    if (trains === 2) {
      addTrainToLine(s, id);
      assert.ok(Math.abs(lineHeadway(s, id) - single / 2) < 0.01);
      assert.equal(s.mobility!.lines.filter((l) => (l.group ?? l.id) === id).length, 2);
    }
    const { ghosts } = runYard(s, 360);
    assert.equal(ghosts, 0);
    const rep = transitReadout(s);
    assert.ok(rep.served > 0);
    waits.push(rep.wait);
  }
  assert.ok(waits[1] < waits[0], waits.join(" vs "));
  assert.ok(waits[1] < 60);
});
test("trains ride the drawn arcs and never turn on a diamond crossing", () => {
  const s = createInitialGameState("god");
  for (let x = 0; x <= 4; x++) put(s, "train_tracks", x, 0);
  for (let z = 1; z <= 3; z++) put(s, "train_tracks", 4, z);
  const net = getTravelNetwork(s);
  const leg = railLeg(net.path([[0, 0]], [[4, 3]], "rail")!, net);
  // Every sample of the corner tile lies on the quarter circle of radius 0.5 around the inner corner (3.5, 0.5).
  for (const [x, z] of leg.pts) if (x > 3.5 && z < 0.5) assert.ok(Math.abs(Math.hypot(x - 3.5, z - 0.5) - 0.5) < 0.1);
  assert.ok(leg.total < 7 && leg.total > 6.7);
  const d = createInitialGameState("god");
  for (let x = -2; x <= 2; x++) put(d, "train_tracks", x, 0);
  for (const z of [-2, -1, 1, 2]) put(d, "train_tracks", 0, z);
  const route = getTravelNetwork(d).path([[-2, 0]], [[0, -2]], "rail");
  assert.equal(route, null);
});
test("track level sets the speed limit and electric stock crawls on unelectrified track", () => {
  const times: number[] = [];
  for (const level of [1, 4]) {
    const { s, depot, west, east } = loopDistrict(false);
    for (const e of s.elements) if (e.defId === "train_tracks") e.level = level;
    installYardWork(s, depot, "wire");
    const id = addLine(s, "rail", depot.id, [west.id, east.id], { ...defaultFormation(), engine: "electric" });
    const l = s.mobility!.lines.find((l) => l.id === id)!;
    let t = 0;
    while (l.departures < 3 && t < 400) {
      s.activePlaySec += 0.25;
      stepMobility(s, 0.25);
      t += 0.25;
    }
    times.push(t);
  }
  assert.ok(times[1] < times[0] * 0.6, times.join(" vs "));
});
test("the Orchard Valley yard: freight rarely waits at red signals thanks to its passing loop", () => {
  const original = createInitialGameState("god");
  original.exampleWorldId = "switchyard-city";
  original.timeOfDay = 12;
  const { state: s } = visitPracticeRailway(original);
  const { red, ghosts } = runYard(s, 300);
  const freight = s.mobility!.lines.find((l) => l.rail?.service === "freight")!;
  assert.equal(ghosts, 0);
  assert.ok((red[freight.id] ?? 0) < 0.15 * 300, String(red[freight.id]));
  assert.ok(freight.departures >= 6, String(freight.departures));
});
