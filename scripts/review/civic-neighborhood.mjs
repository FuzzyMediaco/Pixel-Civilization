// Compare two running local game builds with the same importable island and game camera.
// node --import tsx scripts/review/civic-neighborhood.mjs <before-origin> <after-origin> [era] [output-dir] [view-plan.json or island.json]
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createCanvas, loadImage} from "@napi-rs/canvas";
import {chromium} from "./ui-lib.mjs";
import {PERIODS, PRODUCTION_ERAS} from "../../src/game/periods.ts";
import {readWorldFile} from "../../src/game/worldTransfer.ts";

const [before, after, era = "original", output = "docs/review/civic-neighborhood", planFile] = process.argv.slice(2);
assert.ok([before, after].every(Boolean), "Provide a before origin and an after origin");
const origins = [before, after].map(value => new URL(value));
assert.ok(origins.every(url => ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)), "Use local previews");
assert.ok(era === "original" || PRODUCTION_ERAS.includes(era), "Unknown production era");
const defaultIsland = new URL("../../docs/review/civic-neighborhood/island.json", import.meta.url);
const input = planFile ? JSON.parse(fs.readFileSync(planFile, "utf8")) : null;
const plan = input?.fixture ? input : {};
const fixture = plan.fixture ? path.resolve(path.dirname(planFile), plan.fixture) : planFile ?? defaultIsland;
const transfer = fs.readFileSync(fixture, "utf8");
const title = plan.title ?? JSON.parse(transfer).name ?? "Civic neighborhood";
const {state} = readWorldFile(transfer)[0];
const viewport = {width:390, height:844};
const views = plan.views ?? [
  {name:"district", gx:0, gz:-.5, radius:143, theta:.38, phi:.67},
  {name:"street", gx:0, gz:-1.5, radius:85, theta:.17, phi:.85},
  {name:"overhead", gx:0, gz:-1.5, radius:104, theta:0, phi:.27}
];
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH, args:["--enable-unsafe-swiftshader"]});
const pairs = new Map(views.map(view => [view.name, []]));
const records = [];
try {
  assert.ok(state.elements.every(e => !e.animProgress), "Capture the settled city after construction finishes");
  const omitted = new Set(plan.omitBefore ?? []);
  assert.equal(omitted.size, plan.omitBefore?.length ?? 0, "duplicate before-lot ID");
  assert.equal(state.elements.filter(e => omitted.has(e.id)).length, omitted.size, "unknown before-lot ID");
  for (const [index,origin] of origins.entries()) {
    const elements = state.elements.filter(e => index===1 || !omitted.has(e.id));
    const expected = elements.map(e=>[e.id,e.defId,e.gx,e.gz,e.spanX,e.spanZ,e.rotation,e.level,e.variant]);
    const page = await browser.newPage({viewport, deviceScaleFactor:1, reducedMotion:"reduce"});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // New districts can begin on an empty starter island. This keeps the fixture's
    // full neighborhood in memory without also building the unrelated Roman showcase.
    const useStarter = Boolean(plan.fixture) && era === "original";
    const route = useStarter ? "/" : "/#world=rome-starter&era=" + era;
    await page.goto(new URL(route, origin).href);
    await page.waitForFunction(({era,useStarter}) => window.__pixelWorld?.appearanceEra === era &&
      window.__pixelWorld.gameState && (useStarter || window.__pixelWorld.gameState.exampleWorldId === "rome-starter"),
      {era,useStarter}, {timeout:90000});
    await page.evaluate(({state, era}) => {
      const world = window.__pixelWorld;
      state.appearanceEra = era;
      const sync = world.syncState.bind(world);
      world.syncState = () => sync(state, []);
      world.syncState();
    }, {state:{...state,elements}, era});
    for (const view of views) {
      const result = await page.evaluate(async ({name, gx, gz, theta, phi, radius, targetY}) => {
        const world = window.__pixelWorld;
        world.focusGrid(gx, gz, radius);
        const camera = world.getCameraView();
        if (targetY !== undefined) camera.target[1] = targetY;
        world.restoreCameraView({...camera, theta, phi, autoSpin:false});
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        world.renderer.render(world.scene, world.camera);
        const bounds = world.canvas.getBoundingClientRect();
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bounds.width);
        canvas.height = Math.round(bounds.height);
        const ctx = canvas.getContext("2d");
        if (name === "overhead") ctx.filter = "grayscale(1)";
        ctx.drawImage(world.canvas, 0, 0, canvas.width, canvas.height);
        const {target, radius:r, theta:t, phi:p, fov} = world.getCameraView();
        const city = world.gameState;
        return {
          layout:city.elements.map(e => [e.id, e.defId, e.gx, e.gz, e.spanX, e.spanZ, e.rotation, e.level, e.variant]),
          camera:{target,radius:r,theta:t,phi:p,fov},
          era:world.appearanceEra, time:city.timeOfDay, weather:city.weather, stage:city.currentStage, width:canvas.width, height:canvas.height,
          pixels:canvas.toDataURL("image/png").split(",")[1]
        };
      }, view);
      const {layout, pixels, ...record} = result;
      assert.equal(record.era, era);
      assert.equal(record.width, viewport.width);
      assert.equal(record.height, viewport.height);
      assert.equal(record.time, state.timeOfDay);
      assert.equal(record.weather, state.weather);
      assert.equal(record.stage, state.currentStage);
      assert.deepEqual(layout,expected);
      const layoutHash = createHash("sha256").update(JSON.stringify(layout)).digest("hex");
      const receipt = {view:view.name, ...record, elements:layout.length, layoutHash};
      const pair = pairs.get(view.name);
      const previous = records.find(r => r.view === view.name);
      if (pair.length && omitted.size) {
        assert.deepEqual(record.camera, previous.camera);
        previous.afterElements = layout.length;
        previous.afterLayoutHash = layoutHash;
      } else if (pair.length) assert.deepEqual(receipt,previous);
      else records.push(receipt);
      pair.push(await loadImage(Buffer.from(pixels, "base64")));
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }

fs.mkdirSync(output, {recursive:true});
for (const [name, [original, redesigned]] of pairs) {
  const width = viewport.width, height = viewport.height;
  const sheet = createCanvas(width * 2 + 36, height + 77), ctx = sheet.getContext("2d");
  ctx.fillStyle = "#faf9f1";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = "#19392f";
  ctx.font = "bold 19px sans-serif";
  const eraName = era === "original" ? "Original" : PERIODS[era].label;
  ctx.fillText(title + "  /  " + eraName + "  /  " + name, 12, 25);
  ctx.font = "14px sans-serif";
  ctx.fillText("Before", 12, 55);
  ctx.fillText("After", width + 24, 55);
  ctx.drawImage(original, 12, 65);
  ctx.drawImage(redesigned, width + 24, 65);
  fs.writeFileSync(path.join(output, era + "-" + name + ".webp"), sheet.encodeSync("webp", 92));
}
fs.writeFileSync(path.join(output, era + "-views.json"), JSON.stringify({viewport,fixtureSha256:createHash("sha256").update(transfer).digest("hex"),records}, null, 2) + "\n");
