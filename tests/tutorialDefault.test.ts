import { test } from "node:test";
import assert from "node:assert/strict";
import { TUTORIAL_FLOWS, placementEvents } from "../src/game/tutorialFlows";
import { shouldAutoStartTutorial } from "../src/game/tutorialProgress";
import { ELEMENT_BY_ID } from "../src/game/catalog";

test("Real tutorial teaches the city loop in order and reveals menus one at a time", () => {
  const steps = TUTORIAL_FLOWS.real;
  assert.deepEqual(steps.map((s) => s.id).slice(0, 6), ["real-welcome", "real-open-build", "real-road", "real-home", "real-jobs", "real-utility"]);
  assert.equal(steps[0].visibleNav.length, 0, "the welcome step hides every menu");
  let prev = 0;
  for (const s of steps) {
    assert.ok(s.visibleNav.length >= prev, `${s.id} never hides a menu that was already taught`);
    prev = s.visibleNav.length;
  }
  assert.deepEqual(steps[steps.length - 1].visibleNav, ["build", "layers", "city", "sculpt", "more"]);
});

test("placing starter elements satisfies the matching tutorial steps", () => {
  assert.ok(placementEvents(ELEMENT_BY_ID["roads"]).includes("place_road"));
  assert.ok(placementEvents(ELEMENT_BY_ID["house"]).includes("place_home"));
  assert.ok(placementEvents(ELEMENT_BY_ID["grocery_store"]).includes("place_job"));
  const utility = Object.values(ELEMENT_BY_ID).find((d) => d.isStarter && ((d.power ?? 0) > 0 || (d.water ?? 0) > 0));
  assert.ok(utility, "a starter power or water utility exists for the utility step");
  assert.ok(placementEvents(utility).includes("place_utility"));
  assert.ok(!placementEvents(ELEMENT_BY_ID["house"]).includes("place_job"), "homes are not jobs");
});

test("tutorial starts by default for new players and resumes only an unfinished run", () => {
  assert.equal(shouldAutoStartTutorial(null, 0, "real"), true);
  assert.equal(shouldAutoStartTutorial(null, 12, "real"), false, "an existing island is not interrupted");
  assert.equal(shouldAutoStartTutorial({ mode: "real", stepIndex: 4, status: "active" }, 30, "real"), true);
  assert.equal(shouldAutoStartTutorial({ mode: "real", stepIndex: 4, status: "paused" }, 0, "real"), false, "a paused tutorial waits for More → Tutorial");
  assert.equal(shouldAutoStartTutorial({ mode: "real", stepIndex: 10, status: "done" }, 0, "real"), false);
});
