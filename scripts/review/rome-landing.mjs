import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";

const origin = process.env.ROME_ORIGIN || "http://127.0.0.1:5382";
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH});
try {
  const page = await browser.newPage({viewport: {width: 1120, height: 870}});
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const route = new URL("/rome-review", origin);
  const response = await page.goto(route.href);
  assert.equal(response?.ok(), true);
  for (const shot of ["street", "district", "crossing", "skyline", "dusk", "silhouette"]) {
    await page.getByLabel("Camera").selectOption(shot);
    await page.locator("#candidates img").evaluateAll(images => Promise.all(images.map(img => img.decode())));
    assert.equal(await page.locator("#candidates img").count(), 2);
    assert.equal(await page.locator("#baseline").isVisible(), shot !== "dusk");
  }
  await page.getByLabel("Camera").selectOption("skyline");
  await page.locator("#candidates img").evaluateAll(images => Promise.all(images.map(img => img.decode())));
  if (process.env.ROME_REVIEW_SCREENSHOT) await page.screenshot({path: process.env.ROME_REVIEW_SCREENSHOT});
  await page.getByRole("button", {name: "Hide names"}).click();
  assert.equal(await page.locator("#candidates a").count(), 0);
  await page.getByRole("button", {name: "Reveal names"}).click();
  for (const pass of ["0", "1", "2"]) {
    await page.getByLabel("Art pass").selectOption(pass);
    await page.locator("#plate").evaluate(img => img.decode());
  }
  await page.locator("#events").evaluate(img => img.decode());
  const links = await page.locator(".routes a").evaluateAll(anchors => anchors.map(a => a.href));
  for (const url of links) assert.equal((await page.request.get(url)).ok(), true, url);
  await page.setViewportSize({width:320,height:720});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(route.href + "?study=1");
  const study = page.locator("main figure");
  assert.equal(await study.count(), 6);
  await study.locator("img").evaluateAll(images => Promise.all(images.map(img => img.decode())));
  assert.equal(await page.locator("main details ol").isVisible(), false);
  await page.getByText("Reveal the answer key").click();
  assert.equal(await page.locator("main details li").count(), 6);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("All twelve comparison images, three revisions, event plate, five tour links, six study images and phone layout passed.");
} finally { await browser.close(); }
