// Plays the default Real Mode tutorial on the live 3D map like a new player (draw a road, place a house,
// a grocery and solar panels, tap a building, open City, Layers, Sculpt and More) and logs each step.
// Usage: bash scripts/gallery-server.sh && node scripts/review/tutorial-map-walkthrough.mjs [outDir]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = process.argv[2] ?? "/tmp/tutorial-map"; (await import("node:fs")).mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://localhost:5199/");
await page.waitForTimeout(7000);
const step = async () => page.evaluate(() => document.querySelector(".ui-tut-title")?.textContent ?? "(none)");
const click = async (re) => page.evaluate((src) => { const r = new RegExp(src, "i"); const b = [...document.querySelectorAll("button,[role=button]")].find((x) => r.test(((x.getAttribute("aria-label") || "") + " " + (x.textContent || "")).trim()) && x.offsetParent); if (b) { b.click(); return true; } return false; }, re);
const shot = async (n) => page.screenshot({ path: `${out}/${n}.png` });
const log = async (label) => console.log(label.padEnd(26), "→", await step());
await log("start");
await click("Let.s go"); await page.waitForTimeout(800); await log("after Let's go");
await click("^Build"); await page.waitForTimeout(1500); await log("after open Build");
// pick Roads and drag a street across the middle of the map
console.log("pick roads", await click("^Roads, Road")); await page.waitForTimeout(1200); await shot("0-roadtool"); console.log(await page.evaluate(() => [...document.querySelectorAll("button")].filter(b=>b.offsetParent).map(b=>(b.getAttribute("aria-label")||b.textContent||"").trim().slice(0,24)).join(" | ")));
await page.mouse.move(110, 430); await page.mouse.down(); await page.mouse.move(200, 470, { steps: 12 }); await page.mouse.move(290, 510, { steps: 12 }); await page.mouse.up();
await page.waitForTimeout(1500);
console.log("confirm", await click("^(Build|Confirm|Place|Done)\\b.*road|^Confirm|Build road|^Place"));
await page.waitForTimeout(2000); await shot("1-road"); await log("after road");
// house next to the road
for (let i=0;i<3;i++){ if(await click("^Done placing")) await page.waitForTimeout(700); }
await click("^Build"); await page.waitForTimeout(800);
await click("^Suggested$"); await page.waitForTimeout(600); console.log("TILES:", await page.evaluate(() => [...document.querySelectorAll("button")].filter(b=>b.offsetParent).map(b=>(b.getAttribute("aria-label")||b.textContent||"").trim().slice(0,22)).join(" | "))); await shot("1b-build"); console.log("pick house", await click("^House, "));
await page.waitForTimeout(800);
for (const [x, y] of [[200, 440], [170, 425], [230, 455], [200, 500]]) { await page.mouse.click(x, y); await page.waitForTimeout(700); if (!/home/i.test(await step())) break; }
await click("^Done placing"); await page.waitForTimeout(1800); await shot("2-house"); await log("after house");
for (let i=0;i<3;i++){ if(await click("^Done placing")) await page.waitForTimeout(700); }
await click("^Build"); await page.waitForTimeout(800);
await click("^Suggested$"); await page.waitForTimeout(600); console.log("pick grocery", await click("^Grocery Store, "));
for (const [x, y] of [[300, 470], [270, 535], [110, 470], [330, 520], [100, 430], [250, 560]]) { await page.mouse.click(x, y); await page.waitForTimeout(700); if (!/jobs/i.test(await step())) break; }
await click("^Done placing"); await page.waitForTimeout(1800); await shot("3-jobs"); await log("after grocery");
for (let i=0;i<3;i++){ if(await click("^Done placing")) await page.waitForTimeout(700); }
await click("^Build"); await page.waitForTimeout(800); await click("^Power & Waste"); await page.waitForTimeout(700);
const util = await page.evaluate(() => [...document.querySelectorAll("button")].filter(b=>b.offsetParent).map(b=>(b.getAttribute("aria-label")||"")).filter(t=>/power|solar|water|well|wind/i.test(t)).join(" | "));
console.log("utility tiles:", util);
console.log("pick utility", await click("^(Solar Panels|Water Plant|Well|Wind)[^,]*, "));
for (const [x, y] of [[60, 470], [330, 600], [80, 600], [200, 640], [340, 420], [60, 380]]) { await page.mouse.click(x, y); await page.waitForTimeout(700); if (!/power and water/i.test(await step())) break; }
for (let i=0;i<3;i++){ if(await click("^Done placing")) await page.waitForTimeout(700); } await page.waitForTimeout(1200); await shot("4-utility"); await log("after utility");
for (const [x, y] of [[200, 440], [200, 470], [230, 455]]) { await page.mouse.click(x, y); await page.waitForTimeout(900); if (!/tap a building/i.test(await step())) break; }
await page.waitForTimeout(1500); await shot("5-select"); await log("after tapping building");
await page.keyboard.press("Escape"); await page.waitForTimeout(600);
await click("^City"); await page.waitForTimeout(1500); await log("after City");
await click("^Close"); await page.waitForTimeout(600);
await click("^Layers"); await page.waitForTimeout(1000); console.log("LAYER BTNS", await page.evaluate(() => [...document.querySelectorAll("#sheet-layers button, [id*=layers] button")].map(b=>(b.getAttribute("aria-label")||b.textContent||"").trim().slice(0,18)).join(" | "))); await click("^Power$"); await page.waitForTimeout(1500); await log("after Layers overlay");
await click("^Close"); await page.waitForTimeout(600);
await click("^Sculpt"); await page.waitForTimeout(1500); await log("after Sculpt");
await click("^Close"); await page.waitForTimeout(600);
await click("More \\(M\\)"); await page.waitForTimeout(2000); await shot("6-done"); await log("after More (finish)");
console.log("errors:", errs.slice(0, 3));
await browser.close();
