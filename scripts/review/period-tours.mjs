// Run with node --import tsx and the production or development game URL.
import fs from "node:fs";
import {createHash} from "node:crypto";
import { chromium } from "./ui-lib.mjs";
import { PERIOD_TOURS } from "../../src/game/periodTours.ts";
const origin=process.env.PERIOD_TEST_ORIGIN || "http://127.0.0.1:5393";
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"]});
const out="public/handbook/worlds";
const page=await browser.newPage({viewport:{width:920,height:560}});
page.setDefaultTimeout(60000);
const records=[];
try {
  for(const {era,size,world} of PERIOD_TOURS) {
    if(process.env.PERIOD_CAPTURE_RESUME && fs.existsSync(out+"/"+world.id+".webp"))continue;
    await page.goto("about:blank");
    await page.goto(origin+"/#world="+world.id,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(([id,era])=>window.__pixelWorld?.gameState.exampleWorldId===id && window.__pixelWorld.appearanceEra===era,[world.id,era]);
    const {image,sites,camera,stage,dimensions}=await page.evaluate(async size=>{
      const w=window.__pixelWorld;
      w.gameState.playSpeed=0;w.gameState.timeOfDay=14;w.gameState.timeLocked=true;w.gameState.weatherLocked=true;
      w.gameState.weather="clear";w.focusGrid(size==="starter"?0:-1,size==="skyline"?-1:0,size==="starter"?29:size==="district"?64:82);
      w.restoreCameraView({...w.getCameraView(),phi:.89,theta:.68,autoSpin:false});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      w.renderer.render(w.scene,w.camera);
      const c=document.createElement("canvas");c.width=720;c.height=Math.round(720*w.canvas.height/w.canvas.width);
      c.getContext("2d").drawImage(w.canvas,0,0,c.width,c.height);
      const camera=w.getCameraView();
      return {image:c.toDataURL("image/webp",.9).split(",")[1],
        sites:w.gameState.elements.map(e=>[e.defId,e.gx,e.gz,e.spanX,e.spanZ,e.rotation,e.level,e.variant]).sort(),
        camera:{radius:camera.radius,theta:camera.theta,phi:camera.phi,target:camera.target},
        stage:w.gameState.currentStage,dimensions:[c.width,c.height]};
    },size);
    if(image.length<800)throw Error("Empty image for "+world.id);
    fs.writeFileSync(out+"/"+world.id+".webp",Buffer.from(image,"base64"));
    records.push({era,world:world.id,sites:sites.length,layout:createHash("sha256").update(JSON.stringify(sites)).digest("hex"),camera,stage,dimensions});
    console.log(world.id);
  }
  if(records.length===PERIOD_TOURS.length){
    const review="docs/review/period-production/cities";fs.mkdirSync(review,{recursive:true});
    fs.writeFileSync(review+"/tours.json",JSON.stringify(records,null,2)+"\n");
  }
} finally {await browser.close();}
