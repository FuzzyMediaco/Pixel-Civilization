import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { COURSE, applyCourseAction, makeCourseIsland, tileAt } from "../src/handbook/course";
import { ELEMENT_BY_ID } from "../src/game/catalog";
import { isPlayerKey } from "../src/game/deviceSaves";

test("each handbook exercise uses a valid isolated action and real catalog designs", () => {
  for (const lesson of COURSE) {
    assert.ok(existsSync("public/handbook/" + lesson.image),lesson.id);
    assert.ok(lesson.elements.every(id => ELEMENT_BY_ID[id]),lesson.id);
    const state = makeCourseIsland(lesson);
    const before = tileAt(state,...lesson.action.at);
    const result = applyCourseAction(state,lesson.action);
    assert.equal(result.ok,true,lesson.id + ": " + result.detail);
    const after = tileAt(state,...lesson.action.at);
    assert.notDeepEqual(after,before,lesson.id);
    assert.deepEqual(tileAt(makeCourseIsland(lesson),...lesson.action.at),before,lesson.id);
  }
  assert.equal(isPlayerKey("pixel_civ_course_checks_v1"),true);
});
