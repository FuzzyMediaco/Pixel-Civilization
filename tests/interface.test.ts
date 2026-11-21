import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InfrastructurePanel } from "../src/components/InfrastructurePanel";
import { createInitialGameState } from "../src/game/simulation";
import type { InfrastructureTool } from "../src/game/terrain";

test("engineering forms expose the measurements and actions that apply to the chosen tool", () => {
  const state = createInitialGameState("god");
  function panel(tool: InfrastructureTool) {
    return renderToStaticMarkup(createElement(InfrastructurePanel, {
      state, tool, mutate() {}, onToolChange() {}, onPreview() {}, onClose() {}, onUseMap() {},
    }));
  }
  const bridge = panel({kind:"bridge",shape:"lift",height:2});
  assert.match(bridge,/aria-label="Span"/);
  assert.match(bridge,/aria-label="Lift gate"/);
  assert.doesNotMatch(bridge,/aria-label="Brush width"/);
  assert.doesNotMatch(panel({kind:"bridge",shape:"arch"}),/aria-label="Lift gate"/);
  assert.doesNotMatch(panel({kind:"street",signal:"yield"}),/aria-label="Cycle \(seconds\)"/);
  assert.match(panel({kind:"street",signal:"auto"}),/aria-label="Cycle \(seconds\)"/);
  assert.match(panel({kind:"canyon",height:3}),/aria-label="Cut depth \(m\)"[^>]+value="6"/);
  assert.match(panel({kind:"river",flow:4}),/aria-label="Source flow"[^>]+value="4"/);
  assert.match(panel({kind:"river",flow:4}),/aria-label="Brush width"/);
});
