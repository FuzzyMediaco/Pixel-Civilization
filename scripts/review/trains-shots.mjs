#!/usr/bin/env node
// Review helper: node scripts/review/trains-shots.mjs <outDir> [width height]
// Opens Switchyard City, opens the Orchard Valley rail yard, screenshots trains, depot, Rail Operations tabs.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = process.argv[2] ?? ".";
const W = Number(process.argv[3] ?? 430), H = Number(process.argv[4] ?? 930);
const tag = W < 700 ? "phone" : "desk";
const port = process.env.GALLERY_PORT ?? "5199";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on("pageerror", (e) => logs.push("[pageerror] " + e.message));
page.on("console", (m) => { if (m.type() === "error") logs.push("[error] " + m.text()); });
await page.goto(`http://localhost:${port}/#world=switchyard-city`);
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.goto(`http://localhost:${port}/#world=switchyard-city`);
await page.reload();
await page.waitForTimeout(5000);
const shot = async (n) => { await page.screenshot({ path: `${out}/${tag}-${n}.png` }); console.log("saved", n); };
await shot("01-island");
const click = async (re, opts = {}) => {
  const b = page.getByRole("button", { name: re }).first();
  if (await b.count()) { await b.click({ timeout: 2000 }).catch(async () => { console.log("covered, DOM-click", re); await b.evaluate((e) => e.click()); }); await page.waitForTimeout(opts.wait ?? 800); return true; }
  console.log("no button", re); return false;
};
await click(/Island guide/);
await click(/Open Orchard Valley rail yard/, { wait: 2500 });
await shot("02-yard-dialog-overview");
// Tabs
for (const t of ["Lines", "Trains", "Cars", "Cargo", "Upgrades"]) {
  const b = page.locator('nav[aria-label="Rail Operations sections"] button', { hasText: t });
  if (await b.count()) { await b.click(); await page.waitForTimeout(600); await shot("03-tab-" + t); 
    // full scroll capture of main
    const main = page.locator(".rail-window main");
    if (await main.count()) { const h = await main.evaluate((m) => m.scrollHeight); console.log(t, "main scrollHeight", h); }
  }
}
await click(/Close Rail Operations/);
await page.waitForTimeout(1200);
const cx0 = W / 2, cy0 = H * 0.45; await page.mouse.move(cx0, cy0);
for (let i = 0; i < Number(process.env.OUT ?? 3); i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
await page.keyboard.press("Escape").catch(()=>{});
await page.waitForTimeout(1500);
await shot("04-yard-world");
// motion frames
for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await shot("05-frame-" + i); }
// zoom in via wheel
const cx = W / 2, cy = H / 2;
await page.mouse.move(cx, cy);
for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(150); }
await page.waitForTimeout(1500);
await shot("06-yard-zoom");
for (let i = 0; i < 4; i++) { await page.waitForTimeout(600); await shot("07-zoomframe-" + i); }
// night
const perf = await page.evaluate(() => {
  return new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); });
});
console.log("fps(swiftshader)", perf);
console.log(logs.slice(0, 8).join("\n"));
await browser.close();
