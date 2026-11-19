#!/usr/bin/env node
// Usage: node scripts/shoot-game.mjs out.png [setupScript.js]
// Loads the game from the dev server (GALLERY_PORT, default 5199) and screenshots it.
// Optional setup script runs in page context after load (e.g. to seed localStorage then reload).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = process.argv[2] ?? "game.png";
const setup = process.argv[3] ? fs.readFileSync(process.argv[3], "utf8") : null;
const port = process.env.GALLERY_PORT ?? "5199";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error") logs.push(`[error] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(2500);
if (setup) {
  await page.evaluate(setup);
  await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
}
await page.screenshot({ path: out });
console.log(logs.slice(0, 15).join("\n"));
console.log(`saved ${out}`);
await browser.close();
