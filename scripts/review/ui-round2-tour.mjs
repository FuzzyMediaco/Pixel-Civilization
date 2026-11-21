#!/usr/bin/env node
// Screenshot tour of the round-2 phone UI plus a tap-target and overlap audit.
// Usage: node scripts/review/ui-round2-tour.mjs <outDir> <realSave.json> [phone|desk]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const [outDir, savePath, device = "phone"] = process.argv.slice(2);
const port = process.env.GALLERY_PORT ?? "5199";
fs.mkdirSync(outDir, { recursive: true });
const realSave = fs.readFileSync(savePath, "utf8");
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const viewport = device === "phone" ? { width: 430, height: 930 } : { width: 1400, height: 900 };
const report = [];

async function open(seed, hash = "") {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: device === "phone" ? 2 : 1, hasTouch: device === "phone" });
  await ctx.addInitScript(([save, mode]) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("pixel_civ_place_hints", "3");
    if (save) { localStorage.setItem("pixel_civ_save_v1_real", save); localStorage.setItem("pixel_civ_last_mode", mode); }
  }, [seed ? realSave : "", "real"]);
  const page = await ctx.newPage();
  page.on("pageerror", e => report.push("[pageerror] " + e.message));
  await page.goto(`http://localhost:${port}/${hash}`);
  await page.waitForTimeout(3500);
  if (seed) {
    const cam = JSON.parse(realSave)._cam;
    if (cam) await page.evaluate(c => window.__pixelWorld?.focusGrid(c.gx, c.gz, c.zoom), cam);
    await page.waitForTimeout(800);
  }
  return { ctx, page };
}

async function audit(page, name) {
  const res = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    const small = [];
    for (const el of document.querySelectorAll("button, a[href], select, input, summary, [role=button]")) {
      if (!vis(el) || el.closest(".rail-dialog") || el.closest("canvas")) continue;
      if (el.closest(".ui-sheet-body") && !el.closest(".ui-sheet-body").contains(el)) continue;
      const r = el.getBoundingClientRect();
      // Inline text links inside paragraphs are exempt.
      if (el.tagName === "A" && el.closest("p,li")) continue;
      if (el.type === "checkbox" || el.type === "radio") continue;
      if (r.width < 43.5 || r.height < 43.5) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const panels = [".ui-hud", ".ui-alert", ".ui-nav", ".ui-sheet", ".ui-placebar", ".ui-placebar-hint", ".world-guide", ".ui-toast", ".ui-layer-chip", ".ui-banner"]
      .flatMap(sel => [...document.querySelectorAll(sel)].filter(vis).map(el => ({ sel, r: el.getBoundingClientRect() })));
    const overlaps = [];
    for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i], b = panels[j];
      if ([a.sel, b.sel].includes(".ui-sheet") && [a.sel, b.sel].includes(".ui-nav")) continue; // the sheet runs behind the floating nav by design
      if (a.sel === b.sel) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 1 && y > 1) overlaps.push(`${a.sel} x ${b.sel}`);
    }
    const hscroll = document.documentElement.scrollWidth > innerWidth;
    return { small, overlaps, hscroll };
  });
  report.push(`## ${name}\n  small(<44): ${res.small.length ? res.small.join("; ") : "none"}\n  overlaps: ${res.overlaps.join("; ") || "none"}${res.hscroll ? "\n  HORIZONTAL SCROLL" : ""}`);
}
async function shot(page, name) { await page.waitForTimeout(600); await page.screenshot({ path: `${outDir}/${device}-${name}.png` }); await audit(page, name); }
const tap = (page, sel) => page.locator(sel).first().click();

// Real-mode city
{
  const { ctx, page } = await open(true);
  await shot(page, "idle");
  await tap(page, '[data-panel-toggle="build"]'); await shot(page, "build");
  await tap(page, '.ui-chip:has-text("Homes")'); await shot(page, "build-homes");
  await tap(page, '.ui-card:not([disabled])');
  await page.mouse.move(viewport.width / 2, viewport.height / 2 - 60); await shot(page, "placing");
  await page.keyboard.press("Escape");
  // Find a building to inspect.
  for (const [fx, fy] of [[.5, .45], [.45, .5], [.55, .4], [.4, .4], [.6, .55], [.5, .35], [.35, .55], [.65, .45]]) {
    await page.mouse.click(viewport.width * fx, viewport.height * fy);
    await page.waitForTimeout(400);
    if (await page.locator("#sheet-inspector").count()) break;
  }
  if (await page.locator("#sheet-inspector").count()) {
    await shot(page, "inspector");
    await tap(page, '[aria-label="More actions"]'); await shot(page, "inspector-menu");
    await page.keyboard.press("Escape");
  } else report.push("## inspector: no building found");
  await page.keyboard.press("Escape");
  await tap(page, '.ui-stat:nth-child(2)'); await shot(page, "why-unhappy");
  await tap(page, '[data-panel-toggle="layers"]'); await tap(page, '.ui-chip:has-text("Power")'); await shot(page, "layers");
  await tap(page, '[data-panel-toggle="city"]'); await tap(page, '[role=tab]:has-text("Money")'); await shot(page, "city-money");
  await tap(page, '[data-panel-toggle="more"]'); await shot(page, "more");
  await tap(page, '.ui-row:has-text("Settings")'); await shot(page, "more-settings");
  await ctx.close();
}
// God-mode example island with trains
{
  const { ctx, page } = await open(false, "#world=switchyard-city");
  await shot(page, "guide");
  await tap(page, ".world-guide-toggle"); await shot(page, "guide-open");
  await tap(page, ".world-guide-toggle");
  await tap(page, '[data-panel-toggle="transit"]'); await shot(page, "transit");
  await tap(page, '[data-panel-toggle="more"]'); await tap(page, '.ui-row:has-text("View")'); await shot(page, "more-view");
  await tap(page, '[data-panel-toggle="build"]'); await tap(page, '.ui-chip:has-text("Land & water")'); await shot(page, "build-works");
  await tap(page, '.ui-chip:has-text("Roads")'); await tap(page, '.ui-card:not([disabled])'); await page.mouse.move(viewport.width / 2, viewport.height / 2); await shot(page, "placing-road");
  await ctx.close();
}
fs.writeFileSync(`${outDir}/${device}-audit.txt`, report.join("\n"));
console.log(report.join("\n"));
await browser.close();
