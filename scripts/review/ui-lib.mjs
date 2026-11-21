// Shared helpers for the UI review screenshots (read-only review tooling).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");
export const PORT = process.env.GALLERY_PORT ?? "5311";
export const OUT = process.env.OUT ?? "/tmp/claude-0/-home-user-Pixel-Civilization/82636313-3a2d-5962-b203-fb2d54579198/scratchpad/review_ui";
export const PHONE = { viewport: { width: 430, height: 930 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESK = { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 };
export async function launch() {
  return chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
}
export async function open(browser, ctxOpts, hash = "") {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(`http://localhost:${PORT}/${hash}`);
  await page.waitForTimeout(3500);
  return { ctx, page };
}
// Inventory of visible interactive controls with sizes; flags tiny targets and overlaps.
export async function inventory(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("button, a[href], input, select, [role=button], summary")];
    const vis = els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.display === "none") return null;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.value || "").trim().replace(/\s+/g, " ").slice(0, 50);
      return { tag: el.tagName.toLowerCase(), label, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize };
    }).filter(Boolean);
    const tiny = vis.filter((v) => v.w < 40 || v.h < 40);
    return { count: vis.length, tiny: tiny.length, items: vis };
  });
}
// Panels/fixed overlays currently visible with their boxes, to compute screen coverage.
export async function panels(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      if (el.tagName === "CANVAS") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 24) continue;
      if (el.parentElement && ["fixed"].includes(getComputedStyle(el.parentElement).position)) continue;
      out.push({ cls: (el.className?.baseVal ?? el.className ?? "").toString().split(" ").slice(0, 2).join("."), tag: el.tagName, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  });
}
