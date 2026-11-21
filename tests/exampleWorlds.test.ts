import assert from "node:assert/strict";
import test from "node:test";
import { cityWealth, economyOf, hasAuthority, siteOf } from "../src/game/cityEconomy";
import { createExampleWorld, EXAMPLE_WORLDS } from "../src/game/exampleWorlds";
import { getParcelEdges } from "../src/game/parcelEdges";
import { getProjectActors, operationsOf } from "../src/game/projectOperations";
import { cloneGameStateSnapshot } from "../src/game/saveSlots";
import {
  buildOccupancyMap,
  maintainElement,
  recomputeConnectivityAndMetrics,
  stepSimulation,
  type GameState,
} from "../src/game/simulation";
import {
  applyInfrastructureStroke,
  buildWaterNavigation,
  getTerrainCell,
  hydroHead,
  hydraulics,
  readWaterService,
  undoInfrastructure,
} from "../src/game/terrain";
import { getTravelNetwork, vesselHull } from "../src/game/travelNetwork";
const find = (s: GameState, id: string) => {
  const el = s.elements.find((e) => e.defId === id);
  assert.ok(el, id);
  return el;
};
function edges(s: GameState, id: string) {
  return getParcelEdges(find(s, id), buildOccupancyMap(s.elements), s);
}
function play(s: GameState, seconds: number) {
  s.weatherLocked = s.timeLocked = true;
  for (let i = 0; i < seconds; i++) stepSimulation(s, 1, true);
}
function supplied(s: GameState) {
  assert.ok(s.population > 100 && s.happiness > 60);
  assert.ok(s.metrics.powerSupply >= s.metrics.powerDemand && s.metrics.waterSupply >= s.metrics.waterDemand);
  assert.ok(economyOf(s).report.consumed >= economyOf(s).report.required * 0.9);
  assert.ok(s.money > 1000 && economyOf(s).households > 0 && economyOf(s).businesses > 0);
  assert.equal(economyOf(s).holds.length, 0);
  assert.ok(hasAuthority(s));
}
test("Pelican Reach carries real passengers across the lift and ocean-going vessels between its quay and the deep sea", () => {
  const s = createExampleWorld("pelican-reach");
  supplied(s);
  const sub = find(s, "submarines"),
    patrol = find(s, "naval_vessels"),
    net = getTravelNetwork(s);
  assert.equal(s.exampleWorldId, EXAMPLE_WORLDS[0].id);
  assert.ok(s.metrics.defenseRating > 0);
  assert.equal(getTerrainCell(s, 38, 0).water, "salt");
  assert.ok(getTerrainCell(s, 38, 0).depth > 3);
  for (const e of [sub, patrol]) {
    const hull = vesselHull(e);
    assert.ok(net.path(net.connectors(e, "ferry", hull), [[38, 0]], "ferry", hull));
    assert.ok((s.mobility?.voyages[e.id].position[0] ?? 0) > e.gx + 2);
  }
  assert.ok(edges(s, "churches").some((edge) => edge.kind === "cloister" && edge.neighbor === "graveyards"));
  const lift = find(s, "canal_boat_lift"),
    skiff = find(s, "boats"),
    hull = vesselHull(skiff),
    nav = buildWaterNavigation(s);
  assert.ok(lift.connected && nav.canStep(-6, 5, -6, 6, hull) && nav.canStep(-6, 6, -6, 7, hull));
  assert.ok(nav.cell(-6, 7).level > nav.cell(-6, 5).level + 1);
  assert.ok([...new Set(Object.values(s.infrastructure!.spans).map((span) => span.shape))].includes("lift"));
  const before = s.mobility!.lines.map((l) => l.delivered);
  play(s, 75);
  supplied(s);
  assert.ok(s.mobility!.lines.every((l, i) => l.delivered > before[i] && !l.blocked));
  assert.ok(operationsOf(s).completed[find(s, "regional_airport").id] > 0);
});
test("Copper Gorge supplies five fields across the canyon and offers reversible gates, real mine exports and live transfers", () => {
  const s = createExampleWorld("copper-gorge");
  supplied(s);
  const fields = s.elements.filter((e) => e.defId === "fields"),
    farm = edges(s, "farm_houses").filter((e) => e.kind === "farm" && e.neighbor === "fields");
  assert.equal(farm.length, 5);
  assert.equal(fields.length, 5);
  assert.ok(fields.every((e) => siteOf(s, e).harvested > 0 && readWaterService(s, e).irrigation > 0));
  assert.ok(hydraulics(s).runs.get("-63,-21")!.flow > 0);
  assert.ok(s.infrastructure?.spans["-63,-19"] && getTerrainCell(s, -63, -19).elevation < 0);
  const reservoir = find(s, "municipal_reservoir"),
    hydro = find(s, "hydro_electric_power_plants"),
    head = hydroHead(s, hydro);
  assert.ok(readWaterService(s, reservoir).stored > 0 && hydro.connected && head > 0);
  assert.ok(applyInfrastructureStroke(s, { kind: "dam", gate: "open" }, [{ gx: -63, gz: -13 }]).valid);
  assert.ok(hydroHead(s, hydro) < head);
  assert.ok(undoInfrastructure(s));
  assert.equal(hydroHead(s, hydro), head);
  assert.ok(siteOf(s, find(s, "open_pit_mine")).exportRate > 0);
  const home = s.elements.find((e) => e.defId === "house")!;
  assert.equal(getTerrainCell(s, home.gx, home.gz).material, "sand");
  const gate = find(s, "teleportation_depot"),
    trips = s.mobility!.lines[0].delivered;
  play(s, 62);
  supplied(s);
  assert.ok(operationsOf(s).completed[gate.id] > 0);
  assert.ok(s.mobility!.lines[0].delivered > trips);
});
test("Switchyard starts at night with working public transport, shopfronts, paid project journeys and a containable shop fire", () => {
  const s = createExampleWorld("switchyard-city");
  supplied(s);
  const locals = s.mobility!.lines.filter(line => line.mode === "rail");
  assert.equal(locals.length, 2);
  assert.ok(locals[0].group && locals[0].group === locals[1].group);
  assert.ok(s.elements.filter(e => e.defId === "train_stops").length > locals[0].stops.length);
  assert.ok(s.timeOfDay >= 21);
  assert.equal(find(s, "cheesesteak_restaurants").level, 5);
  assert.ok(edges(s, "atms").some((e) => e.kind === "arcade" && e.neighbor === "banks"));
  assert.ok(edges(s, "medium_sized_homes").some((e) => e.kind === "garden"));
  assert.ok(edges(s, "townhomes").some((e) => e.kind === "party"));
  assert.ok(edges(s, "house").some((e) => e.kind === "yard" && e.neighbor === "house"));
  assert.ok(edges(s, "train_stops").some((e) => e.kind === "platform"));
  assert.ok(siteOf(s, find(s, "freight_rail_terminal")).exportRate > 0);
  const servers = find(s, "data_centers"),
    cooled = siteOf(s, servers).exportRate;
  assert.ok(readWaterService(s, servers).freshwater > 0 && cooled > 0);
  assert.ok(
    applyInfrastructureStroke(s, { kind: "erase", eraseLayer: "aqueduct" }, [
      { gx: -1, gz: 52 },
      { gx: 0, gz: 52 },
    ]).valid,
  );
  recomputeConnectivityAndMetrics(s);
  assert.equal(readWaterService(s, servers).freshwater, 0);
  const dry = siteOf(s, servers).exportRate;
  assert.ok(dry < cooled);
  assert.ok(undoInfrastructure(s));
  recomputeConnectivityAndMetrics(s);
  assert.ok(readWaterService(s, servers).freshwater > 0 && siteOf(s, servers).exportRate > dry * 1.8);
  assert.ok(Object.values(s.infrastructure!.streets).some((e) => e.lanes === 8));
  assert.ok(Object.values(s.infrastructure!.streets).some((e) => e.layout === "diamond"));
  assert.equal(cityWealth(s) >= 1_000_000, true);
  const burning = s.elements.find((e) => e.onFire)!;
  assert.ok(burning);
  assert.ok(getProjectActors(s).some((a) => a.kind === "engine" && a.siteId === burning.id));
  const time = s.activePlaySec,
    clone = cloneGameStateSnapshot(s);
  const before = clone.mobility!.lines.map((l) => l.delivered);
  play(clone, 80);
  supplied(clone);
  assert.equal(clone.exampleWorldId, "switchyard-city");
  assert.ok(clone.mobility!.lines.every((l, i) => l.delivered > before[i] && !l.blocked));
  assert.ok(operationsOf(clone).completed[find(clone, "spaceport").id] > 0);
  assert.ok(
    clone.elements
      .filter((e) => e.defId === "flying_car_depot")
      .some((e) => operationsOf(clone).completed[e.id] > 0),
  );
  assert.equal(operationsOf(clone).rescued, 1);
  assert.ok(maintainElement(clone, burning.id));
  assert.equal(s.activePlaySec, time);
  assert.ok(burning.onFire);
});
