// Run from any directory with two local game previews. The civic camera records both builds identically.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [before, after, era = "original"] = process.argv.slice(2);
assert.ok(before && after, "Provide the local before and after URLs.");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = "docs/review/government-services";
const run = spawnSync(process.execPath, [
  "--import", "tsx", "scripts/review/civic-neighborhood.mjs", before, after, era, output, output + "/island.json",
], { cwd: root, stdio: "inherit" });
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
