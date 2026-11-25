import assert from "node:assert/strict";
import {chromium, localPreviewArgs} from "./ui-lib.mjs";

const origin = process.env.ROME_PREVIEW_URL ?? "http://127.0.0.1:5384";
const era = process.env.OFFLINE_TEST_ERA ?? "rome-forum";
const packStem = era === "rome-forum" ? "romePilot-" : "pack-" + era + "-";
const expected = era === "rome-forum" ? [packStem] : [packStem, "periodArchitecture-"];
if (era === "rome-aqueduct") expected.push("romePilot-");
const selection = era + "/house/2/3/single";
const modelSelector = '[data-model-ready="true"][data-model-selection="' + selection + '"]';
const atlas = "/field-guide.html?id=house&era=" + era + "&level=2&variant=3";
const handbook = "/handbook.html#design=house&era=" + era + "&level=2&style=3&course=rome-upgrade";
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,
  args:["--enable-unsafe-swiftshader","--num-raster-threads=2", ...localPreviewArgs(origin)]});
const failures = [];
function watch(page) {page.on("pageerror", err => failures.push(err.message));}
async function verifyFont(page) {
  const result = await page.evaluate(async () => {
    const css = await (await fetch("/ui/typography.css", {cache:"reload"})).text();
    const font = await fetch("/ui/dm-sans-latin.woff2", {cache:"reload"});
    const bytes = new Uint8Array(await font.arrayBuffer());
    const faces = await document.fonts.load('500 16px "DM Sans"', "Pixel Civilization");
    const visibleControl = [...document.querySelectorAll("button")].find(button => button.getClientRects().length);
    return {css:css.includes("dm-sans-latin.woff2"), signature:String.fromCharCode(...bytes.slice(0,4)),
      bytes:bytes.length, faces:faces.map(f => f.status), controlFont:getComputedStyle(visibleControl).fontFamily};
  });
  assert.ok(result.css);assert.equal(result.signature, "wOF2");assert.ok(result.bytes > 1000);
  assert.ok(result.faces.includes("loaded"));assert.match(result.controlFont, /^["']?DM Sans/i);return result;
}
const getArtSlots = () => {
  return caches.keys().then(async keys => {
    const requests = (await Promise.all(keys.filter(k => k.startsWith("pixel-civ-shell-")).map(async k => (await caches.open(k)).keys()))).flat();
    return requests.map(r => new URL(r.url).pathname).filter(p => /\/(romePilot-|pack-|periodArchitecture-)[\w-]+\.js$/.test(p)).sort();
  });
};
try {
  const ctx = await browser.newContext({viewport:{width:390,height:780},hasTouch:true,reducedMotion:"reduce"});
  const page = await ctx.newPage();
  watch(page);page.setDefaultTimeout(60000);
  const loads = [];
  ctx.on("request", r=>{if(new URL(r.url()).pathname.includes("/"+packStem)&&r.serviceWorker()) loads.push(r.url());});
  const ready = () => page.waitForFunction(() => window.__pixelWorld?.gameState?.exampleWorldId === "rome-starter");
  await page.goto(origin + "/#world=rome-starter&view=0&era=original");await ready();
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller);
  assert.deepEqual(await page.evaluate(getArtSlots), []);assert.deepEqual(loads, []);
  await page.locator('[data-panel-toggle="more"]').tap();
  await page.getByRole("button", {name:"View",exact:true}).tap();
  await page.getByRole("combobox", {name:"Time period",exact:true}).selectOption(era);
  await page.getByRole("button", {name:/^Apply/}).tap();
  await page.waitForFunction(value => window.__pixelWorld?.gameState?.appearanceEra === value, era);
  await page.evaluate(() => {window.dispatchEvent(new Event("pagehide"));history.replaceState(null,"","#world=rome-starter&view=0");});
  await page.waitForFunction(async stems => {
    const keys = (await Promise.all((await caches.keys()).map(async k=>(await caches.open(k)).keys()))).flat();
    return stems.every(stem=>keys.some(key=>key.url.includes("/"+stem)));
  }, expected);
  const pack = await page.evaluate(getArtSlots);
  assert.equal(pack.length,expected.length);assert.equal(loads.length,1);
  await ctx.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});await ready();
  await page.waitForFunction(value => window.__pixelWorld.appearanceEra === value, era);
  assert.ok(await page.locator("canvas").first().isVisible());
  const island = await page.evaluate(()=>({era:window.__pixelWorld.gameState.appearanceEra, sites:window.__pixelWorld.gameState.elements.length}));
  assert.equal(island.era,era);assert.ok(island.sites>4);
  const font = await verifyFont(page);
  await page.goto(origin+atlas);
  await page.locator(modelSelector).waitFor();
  const rotate=page.getByRole("button",{name:"Rotate model right"});await rotate.focus();await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Reset view",exact:true}).tap();
  assert.deepEqual(await page.evaluate(getArtSlots),pack);assert.equal(loads.length,1);
  await ctx.close();
  for (const path of [atlas,handbook]) {
    const fresh = await browser.newContext();
    try {
      const first = await fresh.newPage();watch(first);
      await first.goto(origin+path);
      await first.locator(modelSelector).waitFor({timeout:60000});
      await first.waitForFunction(() => !!navigator.serviceWorker.controller);
      assert.deepEqual(await first.evaluate(getArtSlots), pack, "First visit did not retain its selected art at " + path);
      await fresh.setOffline(true);
      await first.reload({waitUntil:"domcontentloaded"});
      await first.locator(modelSelector).waitFor({timeout:60000});
      await verifyFont(first);
    } finally { await fresh.close(); }
  }
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({initialPackRequests:0,pack,selectedPackDownloads:loads.length,offlineIsland:island,
    offlineAtlas:selection,keyboardRotate:true,touchReset:true,standaloneFirstVisits:[atlas,handbook],offlineFont:font},null,2));
} finally {await browser.close();}
