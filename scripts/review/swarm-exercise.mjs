// Capture the live island display at repeatable game times. The exported island is independently playable.
// node --import tsx scripts/review/swarm-exercise.mjs http://127.0.0.1:5396 /tmp/swarm-review
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { chromium } from "./ui-lib.mjs";
import { place, road } from "./cityKit.ts";
import {
  createInitialGameState,
  launchIslandAttack,
  recomputeConnectivityAndMetrics,
  stepSimulation,
} from "../../src/game/simulation.ts";
import { readWorldFile, serializeWorld } from "../../src/game/worldTransfer.ts";
import { hashStr, makeRng } from "../../src/game/designs/kit.ts";
import { exerciseSecond } from "../../src/game/defenseDisplay.ts";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5396");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "Pass a local integrated game build.");
const out = path.resolve(process.argv[3] ?? "scratchpad/swarm-review");
fs.mkdirSync(out, { recursive: true });
const droneId = "review-swarm-base";
const siloId = "review-silo";
const city = createInitialGameState("god");
city.islandId = "lantern-yard-review";
city.timeOfDay = 14;
city.timeLocked = city.weatherLocked = true;
city.weather = "clear";
road(city, "roads", -5, 1, 17, 1);
const depot = place(city, "drone_swarm_base", -1, -2, 4, 1);
const silo = place(city, "underground_missile_silo", 0, 2, 3, 0);
assert.ok(depot && silo, "The two exercise parcels must fit beside the road.");
depot.id = droneId;
silo.id = siloId;
assert.equal(depot.rotation, 1);
// An operating district provides the real staffing, city authority and raid defenders.
assert.ok(place(city, "military_base", 9, 2, 4));
assert.ok(place(city, "apartments", 9, 0, 4));
assert.ok(place(city, "city_offices", 14, 0));
recomputeConnectivityAndMetrics(city);
for (let i = 0; i < 3; i++) stepSimulation(city, 1, true);
assert.ok(depot.connected && silo.connected && city.population > 0);
const transfer = serializeWorld("Lantern Yard", city);
assert.equal(readWorldFile(transfer)[0].state.elements.length, city.elements.length);
fs.writeFileSync(path.join(out, "lantern-yard.json"), transfer + "\n");

const seed = hashStr(droneId);
let trainingStart = 0;
while (trainingStart < 300 && exerciseSecond(trainingStart, seed) !== 0) trainingStart++;
assert.ok(trainingStart > 2 && trainingStart < 300, "Expected an exercise after an initial idle period.");
const frames = [];
function snapshot(label) {
  frames.push({ label, state: { ...structuredClone(city), playSpeed: 0 } });
}
snapshot("cold");
city.activePlaySec = trainingStart - 2;
snapshot("idle");
for (const t of [0, 0.7, 1.4, 2.2, 3.5, 7, 10, 14, 17, 19, 20.25]) {
  city.activePlaySec = trainingStart + t;
  snapshot(t === 7 ? "training" : t > 20 ? "training-returned" : "");
}

// Use the existing raid command and simulation all the way through its own cleared state.
city.activePlaySec += 3;
const raid = structuredClone(city);
// The legacy raid command also samples Math.random for unit placement. Seed only this review process.
const originalRandom = Math.random;
Math.random = makeRng(778);
launchIslandAttack(raid, 0.5, makeRng(31415));
assert.ok(raid.activeAttack, "The fixture must enter a normal God-mode raid.");
const recordRaid = (label) => frames.push({ label, state: { ...structuredClone(raid), playSpeed: 0 } });
recordRaid("");
let previous;
let lastAlert;
for (let i = 1; i <= 720 && raid.activeAttack; i++) {
  previous = structuredClone(raid);
  stepSimulation(raid, 0.25, true);
  if ([2, 4, 6, 8, 12, 16, 24, 28].includes(i) && raid.activeAttack) recordRaid(i === 16 ? "alert" : "");
  if (raid.activeAttack) lastAlert = raid.activeAttack.elapsedSec;
}
assert.equal(raid.activeAttack, null, "The normal raid should end in the fixture.");
assert.ok(
  lastAlert >= 4 && previous && raid.elements.some((e) => e.id === droneId) && raid.elements.some((e) => e.id === siloId),
);
Math.random = originalRandom;
const settled = structuredClone(raid);
// Show the last live attack pose before the real cleared snapshot so the return starts at its current height.
frames.push({ label: "", state: { ...previous, playSpeed: 0 } });
for (const t of [0, 0.5, 1.25, 2, 3]) {
  frames.push({
    label: t === 1.25 ? "return" : t === 3 ? "docked" : "",
    state: { ...structuredClone(settled), activePlaySec: settled.activePlaySec + t, playSpeed: 0 },
  });
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const report = [];
try {
  for (const [width, height, reduced] of [
    [390, 844, false],
    [360, 740, false],
    [390, 844, true],
  ]) {
    const dir = path.join(out, width + (reduced ? "-reduced" : "-standard"));
    const frameDir = fs.mkdtempSync(path.join(tmpdir(), "swarm-exercise-"));
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("/#world=rome-starter&era=original", origin).href);
    await page.waitForFunction(() => window.__pixelWorld?.gameState?.exampleWorldId === "rome-starter", undefined, {
      timeout: 90000,
    });
    await page.evaluate(() => {
      const world = window.__pixelWorld;
      const sync = world.syncState.bind(world);
      window.__exerciseSync = sync;
      // Isolate the disposable view from the app's background save ticks and render the real frame on demand.
      world.syncState = () => {};
      world.scheduleNextFrame = () => {};
      world.hoverGrid = null;
      world.updateHoverOverlay();
      world.renderer.setPixelRatio(1);
      world.onResize();
    });
    const records = [];
    let camera;
    for (const [index, frame] of frames.entries()) {
      const shot = await page.evaluate(
        ({ state, droneId, siloId, index }) => {
          const w = window.__pixelWorld;
          window.__exerciseSync(state, []);
          let unbuilt;
          if (!index) {
            w.focusGrid(0.65, 0.6, 44);
            w.restoreCameraView({ ...w.getCameraView(), mode: "pan", theta: 0.48, phi: 0.79, autoSpin: false });
            const vacant = { ...state, elements: state.elements.filter((e) => e.id !== droneId && e.id !== siloId) };
            window.__exerciseSync(vacant, []);
            w.tick();
            w.renderer.render(w.scene, w.camera);
            unbuilt = w.canvas.toDataURL("image/webp", 0.87).split(",")[1];
            window.__exerciseSync(state, []);
          }
          w.tick();
          w.renderer.render(w.scene, w.camera);
          const view = w.getCameraView();
          const info = (id) => {
            const group = w.placedEntries.get(id)?.group;
            const display = group?.userData.defenseDisplay;
            if (!display?.parts.length) throw Error("Integrated display parts unavailable for " + id);
            return {
              rotation: group.rotation.y,
              parts: display.parts.map((p) => ({
                kind: p.motion.kind,
                index: p.motion.index ?? 0,
                distance: p.pivot.position.distanceTo(p.home),
              })),
            };
          };
          return {
            unbuilt,
            camera: [...view.target, view.radius, view.theta, view.phi, view.fov],
            depot: info(droneId),
            silo: info(siloId),
            image: w.canvas.toDataURL("image/webp", 0.87).split(",")[1],
          };
        },
        { state: frame.state, droneId, siloId, index },
      );
      const { image, unbuilt, ...record } = shot;
      if (unbuilt) fs.writeFileSync(path.join(dir, "unbuilt.webp"), Buffer.from(unbuilt, "base64"));
      assert.ok(image.length > 1000);
      if (camera) assert.deepEqual(shot.camera, camera, "Camera moved between state captures");
      else camera = shot.camera;
      assert.ok(Math.abs(record.depot.rotation - Math.PI / 2) < 0.001, "The test base should be rotated in the real world.");
      const filename = String(index).padStart(3, "0") + ".webp";
      fs.writeFileSync(path.join(frameDir, filename), Buffer.from(image, "base64"));
      if (frame.label) fs.copyFileSync(path.join(frameDir, filename), path.join(dir, frame.label + ".webp"));
      records.push({
        label: frame.label,
        activePlaySec: frame.state.activePlaySec,
        raidAge: frame.state.activeAttack?.elapsedSec ?? null,
        ...record,
      });
      if (frame.label === "alert") {
        const later = await page.evaluate(
          async ({ droneId }) => {
            await new Promise((resolve) => setTimeout(resolve, 120));
            const w = window.__pixelWorld;
            w.tick();
            return w.placedEntries
              .get(droneId)
              .group.userData.defenseDisplay.parts.map((p) => p.pivot.position.distanceTo(p.home));
          },
          { droneId },
        );
        assert.deepEqual(
          later,
          record.depot.parts.map((p) => p.distance),
          "Pause moved a drone.",
        );
      }
    }

    if (width === 390 && !reduced) {
      const photos = [
        ["Unbuilt parcels", "unbuilt"],
        ["Docked", "cold"],
        ["Training exercise", "training"],
        ["Raid alert", "alert"],
        ["Returning", "return"],
        ["Docked after raid", "docked"],
      ].map(([label, file]) => ({
        label,
        image: "data:image/webp;base64," + fs.readFileSync(path.join(dir, file + ".webp")).toString("base64"),
      }));
      const board = await page.evaluate(async (shots) => {
        const canvas = document.createElement("canvas");
        const w = 210,
          h = Math.round((w * 844) / 390),
          gap = 8,
          top = 52,
          label = 28;
        canvas.width = 3 * w + 4 * gap;
        canvas.height = top + 2 * (h + label + gap) + gap;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f3eee1";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#265b49";
        ctx.font = "bold 22px system-ui";
        ctx.fillText("Lantern Yard", gap, 31);
        for (const [i, shot] of shots.entries()) {
          const im = new Image();
          im.src = shot.image;
          await im.decode();
          const x = gap + (i % 3) * (w + gap),
            y = top + Math.floor(i / 3) * (h + label + gap);
          ctx.fillStyle = "#265b49";
          ctx.fillRect(x, y, w, label);
          ctx.fillStyle = "white";
          ctx.font = "bold 14px system-ui";
          ctx.fillText(shot.label, x + 8, y + 19);
          ctx.drawImage(im, x, y + label, w, h);
        }
        return canvas.toDataURL("image/webp", 0.87).split(",")[1];
      }, photos);
      fs.writeFileSync(path.join(out, "lantern-yard-phases.webp"), Buffer.from(board, "base64"));
    }
    await page.close();
    const get = (l) => records.find((r) => r.label === l);
    const moving = (r, type) => r[type].parts.filter((p) => p.distance > 0.01).length;
    const offset = (r, type) => r[type].parts.reduce((sum, p) => sum + p.distance, 0);
    for (const label of ["cold", "idle", "training-returned", "docked"])
      assert.equal(moving(get(label), "depot") + moving(get(label), "silo"), 0, label);
    const plenary = get("training").depot.parts.filter((p) => p.kind === "drone").length;
    assert.ok(plenary > 2, "Use an upgraded base with at least three drones.");
    for (const label of ["training", "alert"]) assert.equal(moving(get(label), "depot"), reduced ? 2 : plenary, label);
    assert.equal(moving(get("training"), "silo"), 0);
    assert.ok(moving(get("alert"), "silo") > 0);
    assert.ok(offset(get("return"), "silo") > 0 && offset(get("return"), "silo") < offset(get("alert"), "silo"));
    assert.deepEqual(errors, []);
    const animation = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        "3",
        "-i",
        path.join(frameDir, "%03d.webp"),
        "-frames:v",
        String(records.length),
        "-c:v",
        "libwebp_anim",
        "-loop",
        "0",
        "-quality",
        "72",
        path.join(dir, "exercise.webp"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(animation.status, 0, animation.error?.message ?? animation.stderr);
    fs.rmSync(frameDir, { recursive: true, force: true });
    const early = records.find(
      (record) =>
        exerciseSecond(record.activePlaySec, seed) === 0.7 ||
        Math.abs(exerciseSecond(record.activePlaySec, seed) - 0.7) < 0.001,
    );
    report.push({
      viewport: { width, height },
      reduced,
      camera,
      earlyLift: offset(early, "depot"),
      frames: records
        .filter((r) => r.label)
        .map((r) => ({
          label: r.label,
          play: r.activePlaySec,
          raid: r.raidAge,
          flying: moving(r, "depot"),
          available: plenary,
          openHatches: moving(r, "silo"),
          hatchOffset: Number(offset(r, "silo").toFixed(3)),
        })),
    });
  }
} finally {
  await browser.close();
}
assert.ok(report[2].earlyLift < report[0].earlyLift, "Reduced-motion takeoff should be slower.");
fs.writeFileSync(path.join(out, "motion-check.json"), JSON.stringify(report, null, 2) + "\n");
