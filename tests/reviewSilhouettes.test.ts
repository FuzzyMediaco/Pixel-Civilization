import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import "../src/game/designs/index";
import {
  elementSilhouette,
  silhouetteDistance,
} from "../scripts/review/silhouette";

test("bridge comparisons reach level eleven and stop at each neighbor's actual maximum", (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "parcel-silhouettes-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const slots of ["matching", "all"]) {
    const filename = path.join(temp, slots + ".json");
    execFileSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/review/near-silhouette.mjs",
      "ids=bridges,stone_bridges,windmills",
      "eras=original",
      "min=1",
      `slots=${slots}`,
      `json=${filename}`,
    ]);
    const report = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.equal(report.parts, "base");
    const style = report.styles.original;
    assert.equal(
      style.pairComparisons,
      (11 + 5 + 5) * (slots === "all" ? 16 : 4),
    );
    const pairs: [string, string, number, string, number][] =
      style.lookalikePairs;
    assert.ok(
      pairs.some(
        ([a, b, level, slot]) =>
          a === "bridges" &&
          b === "stone_bridges" &&
          level === 11 &&
          slot === (slots === "all" ? "A/D" : "A"),
      ),
    );
    assert.ok(pairs.every(([, , level]) => level <= 11));
    assert.ok(
      pairs
        .filter(([, b]) => b === "windmills")
        .every(([, , level]) => level <= 5),
    );
  }
});

test("optional parked silhouettes include the same blade hub and tips as the static windmill", () => {
  const base = elementSilhouette("windmills", 5, 0);
  assert.deepEqual(
    base,
    elementSilhouette("windmills", 5, 0, "original", "base"),
  );
  const parked = elementSilhouette("windmills", 5, 0, "original", "parked");
  assert.ok(parked.top > base.top);
  assert.ok(silhouetteDistance(base, parked) > 0.05);
});
