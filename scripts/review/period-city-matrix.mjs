// Run against a compiled preview. Each column reuses identical parcel IDs, ports, camera and time.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createCanvas,loadImage} from "@napi-rs/canvas";
import {chromium} from "./ui-lib.mjs";
import {PRODUCTION_ERAS,PERIODS} from "../../src/game/periods.ts";

const origin=process.env.PERIOD_TEST_ORIGIN || "http://127.0.0.1:5396";
const out=path.resolve("docs/review/period-production/cities");
fs.mkdirSync(out,{recursive:true});
const eras=["original",...PRODUCTION_ERAS];
const views=[
  {fixture:"rome-starter", shots:[["street",0,0,29,14]]},
  {fixture:"rome-district",shots:[["district",-1,0,66,14],["crossing",8,-2,38,14],["dusk",-1,0,66,18.8]]},
  {fixture:"rome-skyline",shots:[["skyline",-1,-1,82,14],["silhouette",-1,-1,82,14]]},
];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:920,height:560},deviceScaleFactor:1});
page.setDefaultTimeout(90000);
const errors=[];page.on("pageerror",e=>errors.push(e.message));
const captures=[],reference=new Map(),compiledAssets=new Set();
try{
  for(const {fixture,shots} of views){
    await page.goto("about:blank");
    await page.goto(origin+"/#world="+fixture+"&era=original&view=0",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(id=>window.__pixelWorld?.gameState.exampleWorldId===id,fixture);
    await page.evaluate(()=>{
      const w=window.__pixelWorld,city=structuredClone(w.gameState),sync=w.syncState.bind(w);
      city.playSpeed=0;city.timeLocked=true;city.weather="clear";city.weatherLocked=true;
      w.syncState=(_state,selection)=>sync(city,selection);w.syncState(city,[]);
    });
    const nav=page.getByRole("navigation",{name:"Main"});
    await nav.getByRole("button",{name:/^More/i}).click();
    await page.getByRole("button",{name:"View",exact:true}).click();
    const selector=page.getByLabel("Time period",{exact:true});
    for(const era of eras){
      fs.mkdirSync(path.join(out,era),{recursive:true});
      await selector.selectOption(era);
      await page.waitForFunction(era=>window.__pixelWorld.appearanceEra===era,era);
      for(const [name,gx,gz,radius,hour] of shots){
        const result=await page.evaluate(async ({name,gx,gz,radius,hour})=>{
          const w=window.__pixelWorld;
          w.gameState.timeOfDay=hour;
          w.focusGrid(gx,gz,radius);w.restoreCameraView({...w.getCameraView(),theta:.68,phi:.89,autoSpin:false});
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          w.renderer.render(w.scene,w.camera);
          const canvas=document.createElement("canvas");canvas.width=800;canvas.height=Math.round(800*w.canvas.height/w.canvas.width);
          const ctx=canvas.getContext("2d");if(name==="silhouette")ctx.filter="grayscale(1)";
          ctx.drawImage(w.canvas,0,0,canvas.width,canvas.height);
          const sites=w.gameState.elements.map(e=>[e.id,e.defId,e.level,e.variant,e.gx,e.gz,e.spanX,e.spanZ,e.rotation]).sort((a,b)=>a[0].localeCompare(b[0]));
          const camera=w.getCameraView();
          return {sites,camera:{radius:camera.radius,theta:camera.theta,phi:camera.phi,target:camera.target,fov:camera.fov},
            hour:w.gameState.timeOfDay,stage:w.gameState.currentStage,dimensions:[canvas.width,canvas.height],
            image:canvas.toDataURL("image/webp",.9).split(",")[1]};
        },{name,gx,gz,radius,hour});
        const {image,sites,...record}=result;
        assert.ok(image.length>700,fixture+" missing image");
        const layout=createHash("sha256").update(JSON.stringify(sites)).digest("hex");
        const same={layout,sites:sites.length,...record};
        if(reference.has(name))assert.deepEqual(same,reference.get(name),era+"/"+name);else reference.set(name,same);
        const file=era+"/"+name+".webp";
        fs.writeFileSync(path.join(out,file),Buffer.from(image,"base64"));
        captures.push({era,fixture,view:name,file,...same});
        for(const file of await page.evaluate(()=>performance.getEntriesByType("resource").map(e=>new URL(e.name).pathname).filter(p=>/\/assets\/(island|voxelArchitect|periodArchitecture|pack-|romePilot)/.test(p)))) compiledAssets.add(file);
      }
      console.log(fixture,era,shots.length);
    }
  }
  assert.equal(captures.length,66);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,"render-build.json"),JSON.stringify([...compiledAssets].sort(),null,2)+"\n");
  fs.writeFileSync(path.join(out,"captures.json"),JSON.stringify(captures,null,2)+"\n");
  for(const view of ["street","skyline","crossing","silhouette","dusk","district"]){
    const pairs=[...PRODUCTION_ERAS],canvas=createCanvas(1000,5*182),ctx=canvas.getContext("2d");
    ctx.fillStyle="#f6f2e8";ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const [i,era] of pairs.entries()){
      const img=await loadImage(path.join(out,era,view+".webp")),column=i%2,row=Math.floor(i/2);
      const x=column*500+5,y=row*182+3;
      ctx.font="bold 14px sans-serif";ctx.fillStyle="#25392f";ctx.fillText(PERIODS[era].label,x+4,y+14);
      // Preserve aspect ratio when fitting the renderer's wide and narrow viewports.
      const scale=Math.min(488/img.width,158/img.height);
      ctx.drawImage(img,x+(490-img.width*scale)/2,y+18,img.width*scale,img.height*scale);
    }
    fs.writeFileSync(path.join(out,"compare-"+view+".webp"),canvas.encodeSync("webp",90));
  }
}finally{await browser.close();}
