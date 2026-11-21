import assert from "node:assert/strict";
import { test } from "node:test";
import { rememberBuildingEdit, undoBuildingEdit } from "../src/game/constructionHistory";
import { roadSiteAccess } from "../src/game/parcelEdges";
import {
  buildOccupancyMap,
  computeHeatmapCells,
  createInitialGameState,
  recomputeConnectivityAndMetrics,
  type GameState,
  type PlacedElement,
} from "../src/game/simulation";
import { planFirstStreetFacing, settleStreetFacing } from "../src/game/streetFacing";

function add(city: GameState, defId: string, gx: number, gz: number, rotation = 0): PlacedElement {
  const site: PlacedElement = {
    id: defId + gx + "," + gz,
    defId,
    gx,
    gz,
    rotation,
    spanX: 1,
    spanZ: 1,
    level: 1,
    variant: 0,
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
  city.elements.push(site);
  return site;
}

test("an empty lot faces its first street and undo returns both the lot and its orientation", () => {
  const city = createInitialGameState("god");
  const house = add(city, "house", 0, 0);
  settleStreetFacing(city, house, false);
  const beforeStreet = structuredClone(city);
  const road = add(city, "roads", 0, -1);
  const preview = planFirstStreetFacing(road, buildOccupancyMap(city.elements), city);
  assert.equal(preview[0]?.rotation, 2);
  assert.equal(house.rotation, 0);
  settleStreetFacing(city, road, false);
  assert.equal(house.rotation, 2);
  assert.equal(house.awaitingStreet, undefined);
  assert.equal(roadSiteAccess(road, buildOccupancyMap(city.elements), city)[0]?.site.id, house.id);
  rememberBuildingEdit(beforeStreet, city, "Place road");
  assert.ok(undoBuildingEdit(city).ok);
  assert.deepEqual([house.rotation, house.awaitingStreet], [0, true]);
});

test("manual and legacy facings, yards and rectangular lots keep their intended boundaries", () => {
  for (const scenario of ["manual", "legacy", "garden", "rectangle", "freeway"]) {
    const city = createInitialGameState("god");
    const house = add(city, "house", 0, 0);
    if (scenario === "rectangle") house.spanZ = 2;
    if (scenario !== "legacy") settleStreetFacing(city, house, scenario === "manual");
    if (scenario === "garden") add(city, "gardens", 0, -1);
    const road = add(city, scenario === "freeway" ? "freeways" : "roads", 1, 0);
    settleStreetFacing(city, road, false);
    assert.equal(house.rotation, 0, scenario);
  }
});

test("the traffic layer and hourly demand use the two destinations, exclude an empty spur and follow the island clock", () => {
  const city = createInitialGameState("god");
  add(city, "house", -3, 0, 1);
  add(city, "shops", 3, 0, 3);
  for (let x = -2; x <= 2; x++) add(city, "roads", x, 0);
  add(city, "roads", 0, 1);
  city.timeOfDay = 12;
  recomputeConnectivityAndMetrics(city);
  const day = city.metrics.trafficTrips;
  assert.ok(day > 0);
  const keys = (s: GameState) =>
    computeHeatmapCells(s, "traffic")
      .map((cell) => [cell.gx, cell.gz].join(","))
      .sort();
  assert.deepEqual(keys(city), ["-1,0", "-2,0", "0,0", "1,0", "2,0"]);
  const night = structuredClone(city);
  night.timeOfDay = 23;
  recomputeConnectivityAndMetrics(night);
  assert.ok(night.metrics.trafficTrips < day);
  const cut = structuredClone(city);
  cut.elements = cut.elements.filter((site) => site.gx !== 0 || site.gz !== 0);
  recomputeConnectivityAndMetrics(cut);
  assert.equal(cut.metrics.trafficTrips, 0);
  assert.equal(cut.metrics.trafficCapacity, 0);
  assert.deepEqual(keys(cut), []);
  assert.equal(keys(city).length, 5);
});
