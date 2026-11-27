#!/usr/bin/env node
// Usage: node scripts/shoot-gallery.mjs "<query string>" out.png
// Optional CHROME_PATH points to a local Chromium executable. GALLERY_PORT defaults to 5199.
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const query = process.argv[2] ?? "cat=all";
const out = process.argv[3] ?? "gallery.png";
const port = process.env.GALLERY_PORT ?? "5199";
const formats = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const format = formats[extname(out).toLowerCase()];
if (!format) throw new Error("Choose a .png, .jpg, or .webp output file.");

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageFailure = new Promise((_, reject) => {
    page.on("pageerror", reject);
    page.on("crash", () => reject(new Error("Gallery tab crashed.")));
    page.on("console", (message) => {
      if (message.type() === "error") reject(new Error(message.text()));
      if (message.type() === "warning") console.warn(message.text());
    });
  });
  async function capture() {
    const response = await page.goto(`http://localhost:${port}/gallery.html?${query}`);
    if (!response?.ok()) throw new Error(`Gallery returned HTTP ${response?.status() ?? "no response"}.`);
    const image = await page.waitForFunction((mime) => {
      if (window.__galleryError) throw new Error(window.__galleryError);
      if (!window.__galleryDone) return false;
      const canvas = document.querySelector("#out");
      const data = canvas.toDataURL(mime);
      if (!data.startsWith(`data:${mime};base64,`)) {
        throw new Error(`Could not encode the ${canvas.width} × ${canvas.height} gallery. Try fewer element IDs or a smaller cell.`);
      }
      return data.slice(data.indexOf(",") + 1);
    }, format, { timeout: 240000 });
    return image.jsonValue();
  }
  const encoded = await Promise.race([capture(), pageFailure]);
  await writeFile(out, Buffer.from(encoded, "base64"));
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
