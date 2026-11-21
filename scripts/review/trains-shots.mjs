#!/usr/bin/env node
// Serve the built preview or Vite, then run node scripts/review/trains-shots.mjs [outDir] [width height].
// GALLERY_PORT defaults to 5199. CHROME_PATH can point to an installed Chromium browser.
// Captures use the live scene, Playwright and the same @napi-rs/canvas used by the handbook atlas.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { tsImport } from "tsx/esm/api";
import { chromium } from "./ui-lib.mjs";

const out = path.resolve(process.argv[2] ?? "public/handbook/scenes");
const sizes = process.argv[3] ? [[Number(process.argv[3]), Number(process.argv[4])]] : [[430, 930], [1280, 800]];
const port = process.env.GALLERY_PORT ?? "5199";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking"],
});

async function saveUI(page, name) {
  const pic = await loadImage(await page.screenshot());
  const canvas = createCanvas(pic.width, pic.height);
  canvas.getContext("2d").drawImage(pic, 0, 0);
  await fs.writeFile(path.join(out, name), await canvas.encode("webp", 91));
}

// Wait for actual trains to meet on separate tracks, using the normal movement and mesh updates.
async function capturePassingTrains(page) {
  const { stepMobility } = await tsImport("../../src/game/mobility.ts", import.meta.url);
  const { railBodies } = await tsImport("../../src/game/railMovement.ts", import.meta.url);
  const city = await page.evaluate(() => window.__pixelWorld.gameState);
  const passing = (() => {
    const trains = city.mobility.lines.filter(t => t.rail?.name === "Market Local");
    if (trains.length !== 2 || trains[0].group !== trains[1].group) throw Error("The example needs two trains on Market Local.");
    for (let i = 0; i < 6000; i++) {
      city.activePlaySec += .15;
      stepMobility(city, .15);
      const bodies = trains.map(railBodies);
      if (bodies.some(b => b.length !== 3)) continue;
      const [a, b] = bodies.map(cars => cars[1].point);
      if (Math.abs(a[1] - b[1]) < 1.95 || [a, b].some(p => p[0] < 8 || p[0] > 12) || Math.abs(a[0] - b[0]) > 2.5) continue;
      return true;
    }
    return false;
  })();
  assert.ok(passing, "The two scheduled trains never passed on separate tracks.");
  const frame = await page.evaluate(city => {
    const world = window.__pixelWorld;
    const original = world.gameState, view = world.getCameraView();
    city.timeOfDay = 13;
    city.timeLocked = true;
    city.weather = "clear";
    world.hoverGrid = null;
    world.updateHoverOverlay();
    world.renderer.setPixelRatio(1);
    world.onResize();
    world.syncState(city, []);
    world.restoreCameraView({ ...view, mode: "pan", target: [42, 1, 270], radius: 33, theta: Math.PI - .35, phi: .88, autoSpin: false });
    world.tick();
    world.mobilityVisuals.update(city, 1, world.activeTravel);
    world.renderer.render(world.scene, world.camera);
    const result = world.canvas.toDataURL("image/webp", .94).split(",")[1];
    world.syncState(original, []);
    world.restoreCameraView(view);
    return result;
  }, city);
  await fs.writeFile(path.join(out, "round2-rail-yard.webp"), Buffer.from(frame, "base64"));
}

async function play(width, height) {
  const phone = width < 700;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const activate = el => phone ? el.tap() : el.click();
  try {
    page.setDefaultTimeout(60000);
    await page.goto(`http://127.0.0.1:${port}/#world=switchyard-city&mode=real`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__pixelWorld?.gameState.exampleWorldId === "switchyard-city", undefined, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__pixelWorld.gameState.mode), "real");
    // Leave the final live frame on screen while the UI is inspected on software-rendered hosts.
    await page.evaluate(() => { window.__pixelWorld.scheduleNextFrame = () => {}; });
    if (!phone) await capturePassingTrains(page);
    await activate(page.locator('[data-panel-toggle="transit"]'));
    await activate(page.getByRole("button", { name: /Rail Operations.*Train Depot/i }).first());
    const dialog = page.getByRole("dialog", { name: "Rail Operations" });
    const button = name => dialog.getByRole("button", { name, exact: true });
    const tabs = dialog.getByRole("navigation", { name: "Rail Operations sections" });
    assert.deepEqual(await tabs.getByRole("button").allTextContents(), ["Lines", "Fleet", "Freight", "Yard"]);
    const tab = name => activate(tabs.getByRole("button", { name, exact: true }));
    await tab("Lines");
    const card = dialog.locator("article").filter({ hasText: "Market Local" });
    await card.getByText("2 trains", { exact: true }).waitFor();
    if (phone) await saveUI(page, "round2-rail-lines.webp");
    await activate(card.getByRole("button", { name: "Add a train" }));
    await card.getByText("3 trains", { exact: true }).waitFor();
    await activate(card.getByRole("button", { name: "Remove a train" }));
    await card.getByText("2 trains", { exact: true }).waitFor();
    await tab("Fleet");
    assert.equal(await dialog.locator("article.rail-train").count(), 2);
    await tab("Freight");
    await dialog.getByText(/Freight lines run between freight terminals/).waitFor();
    await tab("Yard");
    const junctions = dialog.locator("details").filter({ has: page.locator("summary", { hasText: "Junctions" }) });
    await activate(junctions.locator("summary"));
    const turnout = junctions.locator("select").first();
    await turnout.selectOption("closed");
    await turnout.selectOption("auto");
    await tab("Lines");
    await activate(card.getByRole("button", { name: "Edit" }));
    const editor = dialog.getByRole("region", { name: "Line editor" });
    const chips = editor.locator(".rail-chips button");
    assert.equal(await chips.count(), 3);
    // Clear the old list, then select three connected stops in reverse geographic order.
    while (await editor.locator('.rail-chips [aria-pressed="true"]').count())
      await activate(editor.locator('.rail-chips [aria-pressed="true"]').first());
    for (const i of [2, 1, 0]) await activate(chips.nth(i));
    assert.deepEqual(await editor.locator(".rail-chips b").allTextContents(), ["3", "2", "1"]);
    if (phone) await saveUI(page, "round2-rail-phone.webp");
    await activate(button("Save line"));
    await dialog.getByText("Line updated.", { exact: true }).waitFor();
    assert.equal(await card.locator(".rail-strip li").count(), 3);
    const retained = await page.evaluate(() => window.__pixelWorld.gameState.mobility.lines.filter(l => l.rail?.name === "Market Local").map(l => l.stops));
    assert.equal(retained.length, 2);
    assert.equal(retained[0].length, 3);
    assert.deepEqual(retained[0], retained[1]);
    await activate(button("Close Rail Operations"));
    await dialog.waitFor({ state: "hidden" });
    const service = page.locator("#service-line-1");
    await activate(service.locator("summary"));
    await activate(service.getByRole("button", { name: "Add vehicle from depot" }));
    await activate(service.getByRole("button", { name: "Rail Operations", exact: true }));
    await card.getByText("3 trains", { exact: true }).waitFor();
    await activate(card.getByRole("button", { name: "Remove a train" }));
    await card.getByText("2 trains", { exact: true }).waitFor();
    const layout = await dialog.locator("main").evaluate(el => ({ available: el.clientWidth, content: el.scrollWidth }));
    assert.ok(layout.content <= layout.available + 1, "The rail controls overflow the viewport.");
    await activate(button("Close Rail Operations"));
    await dialog.waitFor({ state: "hidden" });
    if (!phone) {
      await activate(page.getByRole("button", { name: "Close Transit", exact: true }));
      const guide = page.getByRole("complementary", { name: "Switchyard City island guide" });
      await activate(guide.getByRole("button", { name: /Island guide/ }));
      await activate(guide.getByRole("button", { name: "Open Orchard Valley rail yard" }));
      await tab("Freight");
      const freight = dialog.locator("article").filter({ hasText: "Harvest Freight" });
      await freight.getByText(/Grain & produce:.*waiting/).waitFor();
      assert.ok(await freight.getByRole("button", { name: "Carry grain & produce", exact: true }).isEnabled());
      await activate(button("Close Rail Operations"));
    }
    assert.deepEqual(errors, []);
    console.log(`${width}×${height}: Lines, Fleet, Freight, Yard; added and retired rolling stock, changed a turnout, saved all three stops on both trains; console clean.`);
  } finally {
    await page.close();
  }
}

try {
  for (const [width, height] of sizes) await play(width, height);
} finally {
  await browser.close();
}
