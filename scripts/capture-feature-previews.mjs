/**
 * Captures actual feature-branch game screenshots, not AI concept art.
 * This preview script only uses browser localStorage and a local Vite server.
 * It never writes the user's real saves or touches production data.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const outDir = path.join(process.cwd(), "previews", "captured");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1550, height: 920 }, deviceScaleFactor: 1 });
const failures = [];
page.on("pageerror", e => failures.push(e.message));

const url = "http://127.0.0.1:4173";
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });

async function seedScenario(scenario) {
  await page.evaluate(async (kind) => {
    const sim = await import("/src/game/simulation.ts");
    const catalog = await import("/src/game/catalog.ts");
    const state = sim.createInitialGameState("god");
    const add = (defId, gx, gz, level = 1, variant = 0) => {
      const def = catalog.ELEMENT_BY_ID[defId];
      if (!def) throw new Error("Unknown fixture element: " + defId);
      const [spanX, spanZ] = catalog.getStandardFootprintForLevel(def, level);
      state.elements.push({
        id: "preview-" + state.elements.length + "-" + defId,
        defId, gx, gz, spanX, spanZ,
        rotation: 0, level, variant, connected: false,
        hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
        maintTimerSec: 0, disrepair: false, onFire: false,
        animProgress: 0, animKind: "place",
      });
    };
    const road = (x1, x2, z, level = 2, id = "roads") => {
      for (let x = x1; x <= x2; x++) add(id, x, z, level);
    };
    if (kind === "schools") {
      road(-14, 14, -9, 3);
      add("high_school", -11, -8, 4);
      add("sports_field", -9, -8, 4);
      add("elementary_school", -5, -8, 3);
      add("country_schoolhouse", -2, -8, 3);
      add("university", 2, -8, 4);
      add("research_institute", 4, -8, 4);
      add("trade_school", 8, -8, 4);
      add("little_parks", 0, -5, 3);
      add("park", 0, -3, 2);
      add("house", -8, -3, 3);
      add("house", -4, -3, 3);
      add("house", 7, -3, 3);
    } else if (kind === "farms") {
      road(-14, -14, -2, 2);
      add("plantations", -13, -2, 4);
      for (let z = -2; z < 5; z++) {
        for (let x = -11; x <= -4; x++) add((x + z) % 2 ? "grain_fields" : "vegetable_fields", x, z, 2);
      }
      add("dairy_farm", -2, -2, 4);
      add("grain_farm", 0, -2, 4);
      add("grazing_pasture", -2, 0, 3);
      add("livestock_pen", -1, 0, 3);
      add("apiary", 3, -2, 4);
      add("orchards", 4, -2, 4);
      add("greenhouse_bay", 2, 2, 3);
      add("feed_silo", 2, 4, 3);
    } else {
      road(-14, -2, -7, 1);
      road(-14, -2, -3, 6);
      road(-14, -2, 1, 11);
      road(2, 14, -7, 3, "two_lane_roads");
      road(2, 14, -3, 6, "highways");
      road(2, 14, 1, 11, "freeways");
      for (let x = -9; x <= 9; x++) add("suspension_bridges", x, 8, 5);
      add("stone_bridges", 10, 8, 5);
      add("bridges", 11, 8, 5);
    }
    sim.recomputeConnectivityAndMetrics(state);
    localStorage.setItem("pixel_civ_save_v1_god", JSON.stringify({ ...state, toasts: [] }));
  }, scenario);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(2600);
}
for (const scenario of ["schools", "farms", "roads-and-bridges"]) {
  await seedScenario(scenario);
  const file = path.join(outDir, scenario + ".png");
  await page.screenshot({ path: file, fullPage: false });
  const size = fs.statSync(file).size;
  if (size < 10000) throw new Error("Suspiciously empty screenshot: " + file);
  console.log("Captured " + file + " (" + size + " bytes)");
}
if (failures.length) {
  console.warn("Browser page errors (inspect screenshots for actual impact):");
  console.warn(failures.slice(0, 12).join("\n"));
}
await browser.close();
