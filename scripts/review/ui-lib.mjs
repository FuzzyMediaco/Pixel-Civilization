// Shared helpers for the UI review screenshots (read-only review tooling).
import fs from "node:fs";
import { createHash, X509Certificate } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium } = (() => {
  try { return require("playwright"); } catch { return require("playwright-core"); }
})();
// A throwaway, loopback-only TLS origin can exercise preview access without contacting the public site.
export function localPreviewArgs(origin) {
  const file = process.env.PERIOD_QA_CERT;
  if (!file) return [];
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.hostname !== "pixel-civilization-rome-preview.fuzzymedia.workers.dev" || !url.port) {
    throw new Error("PERIOD_QA_CERT requires the preview host and an explicit local HTTPS port");
  }
  const key = new X509Certificate(fs.readFileSync(file)).publicKey.export({type:"spki",format:"der"});
  return ["--no-proxy-server", "--host-resolver-rules=MAP " + url.hostname + " 127.0.0.1",
    "--ignore-certificate-errors-spki-list=" + createHash("sha256").update(key).digest("base64")];
}
export const PORT = process.env.GALLERY_PORT ?? "5311";
export const OUT = process.env.OUT ?? path.resolve("scratchpad", "review_ui");
export const PHONE = { viewport: { width: 430, height: 930 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESK = { viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 };
export async function launch() {
  fs.mkdirSync(OUT, {recursive: true});
  return chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
}
export async function open(browser, ctxOpts, hash = "") {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(`http://localhost:${PORT}/${hash}`);
  await page.getByRole("navigation", {name:"Main navigation"}).waitFor();
  await page.waitForFunction(() => !!window.__pixelWorld?.gameState);
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
