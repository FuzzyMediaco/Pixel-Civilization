// Device-isolated copy of an existing save. Only localhost accepts the diagnostic fixture.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";
const origin=new URL(process.env.PROFILE_ORIGIN||"http://127.0.0.1:5393");
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const state=JSON.parse(fs.readFileSync(process.env.PROFILE_FIXTURE,"utf8"));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"]});
try {
  const page=await browser.newPage({viewport:{width:1050,height:690},deviceScaleFactor:1});
  page.setDefaultTimeout(180000);
  await page.goto(new URL("/favicon.ico",origin).href);
  await page.evaluate(async world=>{
    const saves=await import("/src/game/deviceSaves.ts");
    await saves.openDeviceSaves();
    world.exampleWorldId="rome-skyline";
    saves.writePlayerItem("pixel_civ_save_v1_example-rome-skyline",JSON.stringify(world));
    await saves.flushDevice();
  },state);
  await page.goto(new URL("/#world=rome-skyline",origin).href,{waitUntil:"domcontentloaded",timeout:180000});
  await page.waitForFunction(n=>window.__pixelWorld?.gameState.elements.length===n,state.elements.length);
  const warmup=Number(process.env.PROFILE_WARMUP_MS || 0);
  if(warmup>0)await page.evaluate(async duration=>{
    window.__pixelWorld.focusGrid(0,0,100);
    const start=performance.now();
    do{await new Promise(resolve=>requestAnimationFrame(resolve));}while(performance.now()-start<duration);
  },warmup);
  const debug=await page.context().newCDPSession(page);
  await debug.send("Profiler.enable");await debug.send("Profiler.start");
  const samples=await page.evaluate(async()=>{
    const w=window.__pixelWorld;
    const data={count:w.gameState.elements.length,triangles:0,calls:0,mode:w.gameState.mode,frames:[],sync:[],renderer:""};
    const gl=w.renderer.getContext(),info=gl.getExtension("WEBGL_debug_renderer_info");data.renderer=gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER);
    const sync=w.syncState.bind(w);w.syncState=(...args)=>{const start=performance.now();try{return sync(...args);}finally{data.sync.push(performance.now()-start);}};
    w.focusGrid(0,0,100);let last=performance.now(), rendered=w.renderer.info.render.frame;const start=last;
    while(performance.now()-start<16000 || data.frames.length<12){
      const now=await new Promise(resolve=>requestAnimationFrame(resolve));
      if(w.renderer.info.render.frame!==rendered){data.frames.push(now-last);last=now;rendered=w.renderer.info.render.frame;}
      if(now-start>90000)break;
    }
    data.calls=w.renderer.info.render.calls;data.triangles=w.renderer.info.render.triangles;
    return data;
  });
  const {profile}=await debug.send("Profiler.stop");
  const tree=new Map(profile.nodes.map(n=>[n.id,n])),time=new Map();
  profile.samples?.forEach((id,i)=>{const f=tree.get(id)?.callFrame;if(!f)return;const name=f.functionName+" "+f.url.split("?")[0].split("/").slice(-1)[0];time.set(name,(time.get(name)||0)+profile.timeDeltas[i]);});
  const pct=(a,p)=>a.length?Math.round(a.toSorted((x,y)=>x-y)[Math.floor((a.length-1)*p)]*10)/10:null;
  const report={sites:samples.count,mode:samples.mode,renderer:samples.renderer,draws:samples.calls,triangles:samples.triangles,
    frames:samples.frames.length,medianFrameMs:pct(samples.frames,.5),p95FrameMs:pct(samples.frames,.95),maxFrameMs:pct(samples.frames,1),
    syncs:samples.sync.length,medianSyncMs:pct(samples.sync,.5),p95SyncMs:pct(samples.sync,.95),
    sampledCPU:[...time].sort((a,b)=>b[1]-a[1]).slice(0,28).map(([f,us])=>[f,Math.round(us/1000)])};
  fs.writeFileSync(process.env.PROFILE_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
