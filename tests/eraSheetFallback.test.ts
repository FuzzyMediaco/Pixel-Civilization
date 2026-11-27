import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ERA_SIGNATURE_NAMES } from "../src/game/eraNames";
import { getMaxElementLevel } from "../src/game/catalog";
import type { EraKey } from "../src/game/eraStyles";
import { bakedEraSheet } from "../src/handbook/eraSheets";

test("named era presentations have transparent fallback artwork for every saved level and variant", () => {
  for (const [era, names] of Object.entries(ERA_SIGNATURE_NAMES)) {
    for (const id of Object.keys(names)) {
      const href = bakedEraSheet(id, era as EraKey);
      assert.ok(href, era + "/" + id);
      const bytes = readFileSync(new URL(href));
      // A transparent, lossy WebP has a VP8X header with 24-bit width / height minus one.
      assert.equal(bytes.toString("ascii", 8, 16), "WEBPVP8X", era + "/" + id);
      assert.ok(bytes[20] & 0x10, id + " preserves transparency");
      assert.equal(bytes.readUIntLE(24, 3) + 1, 96 * getMaxElementLevel(id));
      assert.equal(bytes.readUIntLE(27, 3) + 1, 96 * 4);
    }
  }
});

test("Roman pilot sheets keep their existing paths and unbaked selections keep their live thumbnail", () => {
  assert.equal(bakedEraSheet("house", "rome-forum"), "./handbook/era-pilot/models/rome-forum/house.webp");
  assert.equal(bakedEraSheet("house", "rome-aqueduct"), "./handbook/era-pilot/models/rome-aqueduct/house.webp");
  assert.equal(bakedEraSheet("house", "original"), undefined);
  assert.equal(bakedEraSheet("missing-saved-id", "ancient-egypt"), undefined);
});
