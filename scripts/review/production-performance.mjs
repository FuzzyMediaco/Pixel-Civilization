// Run against a local static production build with no traffic from other benchmarks.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {appearances as eras,canonicalLayout,measureOrbit} from "./period-orbit.mjs";
import {chromium} from "./ui-lib.mjs";

const origin = new URL(process.env.PERIOD_BENCH_ORIGIN ?? "http://127.0.0.1:5402");
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const out = process.env.PERIOD_BENCH_OUTPUT ?? "docs/review/period-production/desktop-performance.json";
const worker = await (await fetch(new URL("/sw.js",origin))).text();
const edition = worker.match(/pixel-civ-shell-[0-9a-f]{16}/)?.[0];
assert.ok(edition, "Run against a compiled production build");
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,args:[
  "--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader","--enable-precise-memory-info"
]});
const report = {edition,world:"rome-skyline",fixture:null,graphics:null,software:browser.version(),runs:[]};
try {
  for (let n=1;n<=3;n++) for(const era of eras) {
    const ctx=await browser.newContext({viewport:{width:1000,height:700},deviceScaleFactor:1});
    try {
      const packResponses=[];
      ctx.on("response", res => {
        const resource = new URL(res.url());
        if(resource.origin!==origin.origin || !/^\/assets\/(pack-|periodArchitecture-|romePilot-)/.test(resource.pathname) || res.fromServiceWorker())return;
        packResponses.push((async () => {
          await res.finished();
          const size = await res.request().sizes().catch(()=>null);
          const body = size?.responseBodySize || (await res.body()).length;
          return {file:resource.pathname.split("/").pop(),body};
        })());
      });
      const page=await ctx.newPage();page.setDefaultTimeout(90000);
      const start=Date.now();
      await page.goto(new URL("/#world=rome-skyline&era="+era,origin).href,{waitUntil:"domcontentloaded"});
      await page.waitForFunction(v=>window.__pixelWorld?.gameState.exampleWorldId==="rome-skyline" &&
        window.__pixelWorld.appearanceEra===v,era);
      const worldReadyMs=Date.now()-start;
      const {layout,graphics,...data}=await page.evaluate(measureOrbit);
      const fixture={sites:layout.length,sha256:createHash("sha256").update(JSON.stringify(layout)).digest("hex")};
      assert.deepEqual(fixture,canonicalLayout);report.fixture??=fixture;report.graphics??=graphics;assert.deepEqual(graphics,report.graphics);
      const atlasStart=Date.now();
      await page.goto(new URL("/field-guide.html?id=apartments&level=4&variant=3&era="+era,origin).href,{waitUntil:"domcontentloaded"});
      await page.locator('[data-model-ready="true"][data-model-selection="'+era+'/apartments/4/3/single"]').waitFor();
      const atlasFirstModelMs=Date.now()-atlasStart;
      const packs=await Promise.all(packResponses);
      if(era==="original")assert.equal(packs.length,0);else assert.ok(packs.length>=2 && packs.some(p=>p.file.startsWith("pack-"+era+"-")));
      report.runs.push({era,run:n,...data,worldReadyMs,atlasFirstModelMs,packResponseBodyBytes:packs.reduce((sum,p)=>sum+p.body,0),packs});
      fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
      console.log(era,n,data.medianMs,atlasFirstModelMs,packs.length);
    } finally {await ctx.close();}
  }
} finally {await browser.close();}
