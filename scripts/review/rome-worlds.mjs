// Capture the real game's camera and meshes. Run the preview first.
// ROME_ORIGIN=http://127.0.0.1:5382 node scripts/review/rome-worlds.mjs [images|performance]
// ROME_CDP connects to an already running test browser such as Android WebView.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";

const local=process.env.ROME_ORIGIN ?? "http://127.0.0.1:5382";
const review=path.resolve("docs/review/rome-pilot");
const thumbnails=path.resolve("public/handbook/era-pilot");
const worlds=path.resolve("public/handbook/worlds");
const method=process.argv[2] ?? "images";
const hardware=process.env.ROME_DEVICE ?? "desktop";
const remote=process.env.ROME_CDP;
for(const dir of [review,thumbnails,worlds]) fs.mkdirSync(dir,{recursive:true});
const browser=remote ? await chromium.connectOverCDP(remote) : await chromium.launch({
  executablePath:process.env.CHROME_PATH, headless:true,
  args:["--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"],
});
const context=remote ? browser.contexts()[0] : await browser.newContext({viewport:{width:920,height:560},deviceScaleFactor:1});
const page=remote ? context.pages()[0] : await context.newPage();
page.setDefaultTimeout(90000);
const cases=[
  ["street","rome-starter",0,0,29],
  ["district","rome-district",-1,0,66],
  ["crossing","rome-district",8,-2,38],
  ["skyline","rome-skyline",-1,-1,82],
];
const eras=["original","rome-forum","rome-aqueduct"];
const errors=[];
page.on("pageerror",e=>errors.push(e.message));

async function openFixture(id,era) {
  // A full document load uses the normal scene route, including offline shape loading.
  await page.goto("about:blank");
  await page.goto(local+"/#world="+id+"&era="+era,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(([id,era])=>window.__pixelWorld?.gameState.exampleWorldId===id && window.__pixelWorld.appearanceEra===era,[id,era]);
}
async function frame(x,z,zoom,hour=14) {
  await page.evaluate(([x,z,zoom,hour])=>{
    const w=window.__pixelWorld;
    w.gameState.playSpeed=0;
    w.gameState.timeOfDay=hour;w.gameState.timeLocked=true;w.gameState.weather="clear";w.gameState.weatherLocked=true;
    w.focusGrid(x,z,zoom);w.restoreCameraView({...w.getCameraView(),phi:.89,theta:.68,autoSpin:false});
  },[x,z,zoom,hour]);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function pixels(file,maxWidth=920,grey=false) {
  const data=await page.evaluate(([maxWidth,grey])=>{
    const w=window.__pixelWorld;
    w.renderer.render(w.scene,w.camera);
    const copy=document.createElement("canvas");
    copy.width=Math.min(maxWidth,w.canvas.width);copy.height=Math.round(copy.width*w.canvas.height/w.canvas.width);
    const ctx=copy.getContext("2d");if(grey)ctx.filter="grayscale(1)";ctx.drawImage(w.canvas,0,0,copy.width,copy.height);
    return copy.toDataURL("image/webp",.88).split(",")[1];
  },[maxWidth,grey]);
  if (!data || data.length<500) throw Error("Empty game capture "+file);
  fs.writeFileSync(file,Buffer.from(data,"base64"));
}
try{
  if(method==="images"){
    const benchmarks=new Map(), captureLog=[];
    for(const [key,id,x,z,zoom] of cases){
      await openFixture(id,"rome-forum");
      // Keep this exact fixture instance for all three shots. Construction UUIDs
      // and traffic positions would otherwise differ across fresh simulations.
      await page.evaluate(()=>{
        const w=window.__pixelWorld, copy=structuredClone(w.gameState), render=w.syncState.bind(w);
        copy.playSpeed=0;copy.timeLocked=true;copy.weatherLocked=true;copy.weather="clear";copy.timeOfDay=14;
        w.syncState=(_state,selection)=>render(copy,selection);
        w.syncState(copy,[]);
      });
      for(const era of eras){
      await page.evaluate(era=>window.__pixelWorld.setAppearanceEra(era),era);
      await frame(x,z,zoom);
      const record=await page.evaluate(()=>{
        const w=window.__pixelWorld, cam=w.getCameraView();
        return {
          elements:w.gameState.elements.map(e=>[e.id,e.defId,e.gx,e.gz,e.rotation,e.spanX,e.spanZ,e.level,e.variant]).sort((a,b)=>a[0].localeCompare(b[0])),
          target:cam.target,radius:cam.radius,theta:cam.theta,phi:cam.phi,fov:cam.fov,stage:w.gameState.currentStage,hour:w.gameState.timeOfDay,
          viewport:[innerWidth,innerHeight]
        };
      });
      const {elements,...camera}=record;
      const hash=createHash("sha256").update(JSON.stringify(elements)).digest("hex");
      const match={hash,count:elements.length,...camera};
      if(benchmarks.has(key)) assert.deepEqual(match,benchmarks.get(key),"Unmatched camera, stage or parcels in "+key);
      else benchmarks.set(key,match);
      captureLog.push({era,fixture:id,view:key,...match});
      await pixels(path.join(review,era+"-"+key+".webp"));
      if(key==="street"||key==="skyline")await pixels(path.join(thumbnails,era+"-"+key+".webp"),384);
      if(key==="skyline")await pixels(path.join(review,era+"-silhouette.webp"),640,true);
      if(era==="rome-aqueduct"&&key!=="crossing")await pixels(path.join(worlds,id+".webp"),720);
      if(key==="district"&&era!=="original"){await frame(x,z,zoom,18.8);await pixels(path.join(review,era+"-dusk.webp"),720);}
      console.log(era,key);
      }
    }
    fs.writeFileSync(path.join(review,"captures.json"),JSON.stringify(captureLog,null,2)+"\n");
  }else{
    if (["localhost","127.0.0.1"].includes(new URL(local).hostname)) {
      // Measure the compiled game with this checkout's current instrument even
      // if the static test server predates an improvement to the instrument.
      await page.route("**/handbook/era-pilot/benchmark.mjs",route=>route.fulfill({
        path:path.resolve("public/handbook/era-pilot/benchmark.mjs"),contentType:"application/javascript"
      }));
    }
    await page.goto(local+"/handbook/era-pilot/benchmark.html");
    await page.getByRole("button",{name:"Run device test"}).click();
    await page.waitForFunction(()=>document.querySelector("#start")?.disabled===false,null,{timeout:20*60*1000});
    const status=await page.locator("#status").innerText();
    assert.equal(status,"Nine runs completed.");
    const downloaded=page.waitForEvent("download");
    await page.getByRole("button",{name:"Save results"}).click();
    await (await downloaded).saveAs(path.join(review,"performance-"+hardware+".json"));
    console.log(await page.locator("#summary").innerText());
  }
  if(errors.length)throw Error(errors.join("\n"));
}finally{ await browser.close(); }
