// Run against a production build. Exercise the installed offline shell and a fresh pack request that fails online.
// ERA_SHEET_PREVIEW_URL=http://127.0.0.1:5376 node scripts/review/era-sheet-offline.mjs [era] [id]
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";

const [era = "ancient-egypt", id = "public_library"] = process.argv.slice(2);
const origin = process.env.ERA_SHEET_PREVIEW_URL ?? "http://127.0.0.1:5376";
const select = (level, style) =>
  "/handbook.html#design=" + id + "&era=" + era + "&level=" + level + "&style=" + style;

async function verify(page, level, style) {
  await page.getByRole("button", { name: "Retry interactive artwork" }).waitFor({ timeout: 60000 });
  const cell = page.locator(".pc-model-loading svg[role=img]");
  assert.equal(await cell.getAttribute("viewBox"), [96 * (level - 1), 96 * (style - 1), 96, 96].join(" "));
  assert.equal(await page.getByRole("button",{name:"Rotate model right"}).count(),0);
  const href = await cell.locator("image").getAttribute("href");
  assert.ok(href.includes("era-sheet-" + id + "-"), href);
  const pixels = await page.evaluate(
    async ({ href, level, style }) => {
      const img = new Image();
      img.src = href;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, (level - 1) * 96, (style - 1) * 96, 96, 96, 0, 0, 96, 96);
      const rgba = ctx.getImageData(0, 0, 96, 96).data;
      let filled = 0;
      for (let alpha = 3; alpha < rgba.length; alpha += 4) if (rgba[alpha] > 100) filled++;
      return filled;
    },
    { href, level, style },
  );
  assert.ok(pixels > 100 && pixels < 96 * 96, "Cell has a visible model on a transparent background");
  return { level, style, pixels };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const installed = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await installed.newPage();
  await page.goto(origin + "/handbook.html#design=house&era=original");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const inventory = await page.evaluate(async () => {
    const entries = (
      await Promise.all((await caches.keys()).map(async (name) => (await caches.open(name)).keys()))
    ).flat();
    return entries.map((key) => new URL(key.url).pathname);
  });
  assert.ok(inventory.some((file) => file.includes("era-sheet-" + id + "-")));
  assert.ok(
    !inventory.some((file) => file.includes("/pack-" + era + "-")),
    "The cold optional pack was not preloaded",
  );
  await installed.setOffline(true);
  await page.goto(origin + select(4, 3));
  const offline = await verify(page, 4, 3);
  if (process.env.ERA_SHEET_EVIDENCE) await page.screenshot({ path: process.env.ERA_SHEET_EVIDENCE });
  await installed.close();

  const fresh = await browser.newContext({ serviceWorkers: "block", viewport: { width: 360, height: 740 } });
  await fresh.route("**/assets/pack-" + era + "-*.js", (route) => route.abort("failed"));
  const failed = await fresh.newPage();
  await failed.goto(origin + select(2, 4));
  const failure = await verify(failed, 2, 4);
  await fresh.unrouteAll({ behavior: "wait" });
  await failed.getByRole("button", {name:"Retry interactive artwork"}).click();
  await failed.locator(".pc-atlas-viewport[data-model-ready=true]").first().waitFor({ timeout: 60000 });
  await fresh.close();
  console.log(JSON.stringify({ offline, failure, interactiveRecovered: true }, null, 2));
} finally {
  await browser.close();
}
