#!/usr/bin/env node
// Usage: node scripts/shoot-gallery.mjs "<query string>" out.png
//   e.g. node scripts/shoot-gallery.mjs "cat=housing&ids=house,cottages&mode=full" /tmp/x.png
// Requires the dev gallery server:  npx vite --port 5199 --strictPort  (see scripts/gallery-server.sh)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const query = process.argv[2] ?? "cat=all";
const out = process.argv[3] ?? "gallery.png";
const port = process.env.GALLERY_PORT ?? "5199";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${port}/gallery.html?${query}`);
try {
  await page.waitForFunction(() => window.__galleryDone || window.__galleryError, null, { timeout: 240000 });
} catch (e) {
  console.error("Timed out waiting for gallery", e.message);
}
const err = await page.evaluate(() => window.__galleryError);
if (err) console.error("GALLERY ERROR:\n" + err);
const el = await page.$("#out");
await el.screenshot({ path: out });
if (logs.length) console.error(logs.slice(0, 20).join("\n"));
console.log(`saved ${out}`);
await browser.close();
