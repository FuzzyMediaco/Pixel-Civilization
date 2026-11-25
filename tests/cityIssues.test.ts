import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { cityIssues, suppliesNeed } from "../src/game/cityIssues";
import { createInitialGameState, isUnconnectedBuilding, recomputeConnectivityAndMetrics, type PlacedElement } from "../src/game/simulation";

test("home shortage and housing-limited growth both lead to buildings that house residents", () => {
  const state = createInitialGameState("real");
  state.metrics.populationLimiter = {cap: 5, limitingNeed: "housing"};
  state.diagnostics = ["no_homes", "growth_limit"].map(id => ({
    id, severity: "warning", title: "More housing needed", detail: "", fixHint: "",
  }));

  for (const {fix} of cityIssues(state)) {
    assert.equal(fix?.need, "population");
    assert.ok(suppliesNeed(ELEMENT_BY_ID.house, fix!.need!));
    assert.equal(suppliesNeed(ELEMENT_BY_ID.roads, fix!.need!), false);
  }
});

test("the unconnected building alert advances as roads connect the counted sites", () => {
  const state = createInitialGameState("real");
  const site = (id: string, defId: string, gx: number, gz: number): PlacedElement => ({
    id, defId, gx, gz, level: 1, variant: 0, rotation: 0, spanX: 1, spanZ: 1,
    connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
    maintTimerSec: 0, disrepair: false, onFire: false, animProgress: 0, animKind: "place",
  });
  const first = site("first", "house", 0, -2);
  const second = site("second", "house", 0, 2);
  state.elements = [site("road", "roads", 0, 0), site("nature", "trees", 4, 0),
    first, second, site("west", "house", -1, 0), site("east", "house", 1, 0)];

  recomputeConnectivityAndMetrics(state);
  assert.equal(cityIssues(state).find(i => i.id === "disconnected")?.title, "2 Unconnected Buildings");
  assert.equal(state.elements.find(isUnconnectedBuilding)?.id, first.id);

  state.elements.push(site("north-road", "roads", 0, -1));
  recomputeConnectivityAndMetrics(state);
  assert.equal(cityIssues(state).find(i => i.id === "disconnected")?.title, "1 Unconnected Building");
  assert.equal(state.elements.find(isUnconnectedBuilding)?.id, second.id);

  state.elements.push(site("south-road", "roads", 0, 1));
  recomputeConnectivityAndMetrics(state);
  assert.equal(state.elements.find(isUnconnectedBuilding), undefined);
  assert.equal(cityIssues(state).find(i => i.id === "disconnected"), undefined);
});
