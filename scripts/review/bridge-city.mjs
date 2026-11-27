// Regenerate the review island from the built-in Pelican Reach save.
// CHROME_PATH=... node --import tsx scripts/review/bridge-city.mjs <before-origin> <after-origin>
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExampleWorld } from "../../src/game/exampleWorlds.ts";
import { upgradeElementDirect } from "../../src/game/simulation.ts";
import { serializeWorld } from "../../src/game/worldTransfer.ts";

const [before, after] = process.argv.slice(2);
assert.ok(before && after, "Supply a local before and after origin");
const city = createExampleWorld("pelican-reach");
const road = city.elements.find(e => e.gx === 4 && e.gz === 0);
assert.ok(road && city.infrastructure.spans["4,0"].shape === "lift");
for (let tier = 2; tier <= 11; tier++) assert.ok(upgradeElementDirect(city, road.id).ok);
for (const span of Object.values(city.infrastructure.spans)) {
  if (span.shape === "lift") span.lift = "closed";
}
for (const piece of city.elements) piece.animProgress = 0;

const root = fileURLToPath(new URL("../../", import.meta.url));
const folder = await mkdtemp(path.join(tmpdir(), "pixel-marina-cut-"));
try {
  await writeFile(path.join(folder, "island.json"), serializeWorld("Marina Cut", city));
  const plan = path.join(folder, "views.json");
  await writeFile(plan, JSON.stringify({
    title: "Pelican Reach · Marina Cut", fixture: "island.json",
    views: [
      { name: "harbor", gx: 4, gz: 0, targetY: 2.5, radius: 78, theta: 1.14, phi: 0.94 },
      { name: "lift", gx: 4, gz: 0, targetY: 3.5, radius: 62, theta: 2.29, phi: 1.08 },
    ],
  }));
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/review/civic-neighborhood.mjs",
    before, after, "original", "docs/review/bridge-runs", plan], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(folder, { recursive: true, force: true });
}
