// Run a few minutes of Real-mode play on each island at the local server or in the portable preview.
// PREVIEW_URL may also be a file:/// path to the packaged index.html. CHROME_PATH selects a system browser.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "./ui-lib.mjs";
import chapters from "../../src/handbook/chapters.json" with {type:"json"};

const worlds = chapters.find(c => c.id === "worlds").lessons.map(l => l.world);
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:5347/";
const output = path.resolve(process.env.OUT ?? "scratchpad/round2-playcheck");
const seconds = Number(process.env.PLAY_SECONDS ?? 180);
const selected = process.argv.slice(2);
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH, args:[
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--num-raster-threads=2", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
]});
async function play(id, phone) {
  const context = await browser.newContext({viewport:phone ? {width:430,height:930} : {width:1400,height:900},hasTouch:phone});
  const errors = [];
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", e=>errors.push(e.message));
  page.on("console", m=>{ if(m.type()==="error") errors.push(m.text()); });
  page.on("requestfailed", req=>{ if(req.failure()?.errorText!=="net::ERR_ABORTED") errors.push(req.url()+" "+req.failure()?.errorText); });
  try {
    const startUrl = new URL(base);
    startUrl.hash = new URLSearchParams({world:id,mode:"real"}).toString();
    await page.goto(startUrl.href,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(id=>window.__pixelWorld?.gameState.exampleWorldId===id && window.__pixelWorld.gameState.mode==="real",id);
    const sample = ()=>page.evaluate(()=>{
      const s=window.__pixelWorld.gameState;
      return {mode:s.mode,elapsed:s.activePlaySec,population:s.population,treasury:Math.round(s.money),limiter:s.metrics.populationLimiter?.limitingNeed,sites:s.elements.length,lines:s.mobility?.lines.length??0};
    });
    const first=await sample();
    const speed=page.getByRole("button",{name:/Change speed/});
    for(let i=0;i<4 && !(await speed.getAttribute("aria-label")).includes("4×");i++) await speed.click();
    const guide=page.locator(".world-guide-toggle");
    if(await guide.getAttribute("aria-expanded")!=="true") await guide.click();
    const views=page.locator(".world-guide select");
    await views.selectOption({index:1});
    if(await guide.getAttribute("aria-expanded")==="true") await guide.click();
    const start=Date.now();
    await page.locator('[data-panel-toggle="city"]').click();
    await page.getByRole("tab",{name:"Money"}).click();
    await page.getByRole("slider",{name:"Tax rate"}).press("ArrowRight");
    await page.getByRole("button",{name:"Close City"}).click();
    await page.waitForFunction(({start,seconds})=>window.__pixelWorld.gameState.activePlaySec-start>=seconds,{start:first.elapsed,seconds},{timeout:Math.max(240000,seconds*3000)});
    const remaining=seconds*1000-(Date.now()-start);
    if(remaining>0) await page.waitForTimeout(remaining);
    const last=await sample();
    assert.equal(last.mode,"real");
    assert.ok(last.elapsed-first.elapsed>=seconds && last.population>0 && Number.isFinite(last.treasury));
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,id+".png"),timeout:120000});
    const result={id,viewport:page.viewportSize(),wallSeconds:Math.round((Date.now()-start)/1000),first,last,errors};
    fs.writeFileSync(path.join(output,id+".json"),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  } finally { await context.close(); }
}
try {
  for (const id of selected.length ? selected : worlds) {
    assert.ok(worlds.includes(id),"Unknown world "+id);
    await play(id,worlds.indexOf(id)%2===1);
  }
} finally { await browser.close(); }
