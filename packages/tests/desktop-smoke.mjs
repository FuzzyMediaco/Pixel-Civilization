// Launch a test copy with a separate LOCALAPPDATA and WebView2 remote debugging port first.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require("playwright");} catch {playwright=require("playwright-core");}
const b=await playwright.chromium.connectOverCDP(process.env.PIXEL_TEST_CDP || "http://127.0.0.1:9755");
const p=b.contexts().flatMap(c=>c.pages()).find(t=>t.url().startsWith("https://pixelcivilization.app/"));
if(!p)throw Error("Missing offline app window");
p.setDefaultTimeout(45000);
try {
  const ctx=p.context();
  await ctx.setOffline(true);
  await p.reload({waitUntil:"domcontentloaded"});
  await p.waitForFunction(()=>!!window.__pixelWorld?.gameState,{},{timeout:60000});
  assert.ok(await p.evaluate(()=>isSecureContext && !!indexedDB && navigator.userAgent.includes("PixelCivilizationOffline")));
  const build=p.getByRole("navigation").getByRole("button",{name:/^Build/i});
  await build.click();
  await p.getByText("House",{exact:true}).first().click();
  const sites=await p.evaluate(()=>window.__pixelWorld.gameState.elements.length);
  const canvas=p.locator("canvas").first();
  const bounds=await canvas.boundingBox();
  await canvas.click({position:{x:Math.floor(bounds.width/2),y:Math.floor(bounds.height/2)}});
  await p.waitForFunction(n=>window.__pixelWorld.gameState.elements.length>n,sites);
  await p.waitForTimeout(700);
  await p.reload({waitUntil:"domcontentloaded"});
  await p.waitForFunction(n=>window.__pixelWorld?.gameState.elements.length>n,sites,{timeout:60000});
  // The handbook, designs and pictures must open without ever having been visited online.
  await p.goto("https://pixelcivilization.app/field-guide.html",{waitUntil:"domcontentloaded"});
  await p.getByRole("searchbox").first().waitFor();
  assert.ok(await p.evaluate(()=>document.fonts.check('14px "DM Sans"')));
  const results=await p.evaluate(async()=>{
    const resources=await Promise.all(["/handbook/worlds/meridian-fair.webp","/handbook.html","/pwa-192x192.png"].map(async path=>{
      const r=await fetch(path);return {ok:r.ok,length:(await r.arrayBuffer()).byteLength};
    }));
    return resources.every(r=>r.ok && r.length>512);
  });assert.ok(results);
  await p.goto("https://pixelcivilization.app/downloads",{waitUntil:"domcontentloaded"});
  await p.getByRole("heading",{name:"Take your island offline."}).waitFor();
  for (const name of ["Pixel-Civilization-Android.apk","Pixel-Civilization-Windows-x64.zip"]) {
    assert.equal(await p.locator('a[href$="'+name+'"]').getAttribute("href"),"https://github.com/FuzzyMediaco/Pixel-Civilization/releases/latest/download/"+name);
  }
  await p.getByRole("link",{name:/back to the island/i}).click();
  await p.waitForFunction(n=>window.__pixelWorld?.gameState.elements.length>n,sites,{timeout:60000});
  console.log("Windows WebView2 loaded an offline island, persisted a house, opened the field guide, artwork and handbook, and returned to the same island from Downloads.");
} finally {await b.close();}
