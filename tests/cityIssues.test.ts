import assert from "node:assert/strict";
import test from "node:test";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { cityIssues, suppliesNeed } from "../src/game/cityIssues";
import { createInitialGameState } from "../src/game/simulation";

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
