import assert from "node:assert/strict";
import {chromium} from "./ui-lib.mjs";

const origin=process.env.ROME_PREVIEW_URL ?? "http://127.0.0.1:5384";
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader","--num-raster-threads=2"]});
try {
  const ctx=await browser.newContext({viewport:{width:390,height:780},hasTouch:true,reducedMotion:"reduce"});
  const page=await ctx.newPage();
  page.setDefaultTimeout(60000);
  const failures=[],loads=[];
  ctx.on("request",r=>{if(/\/assets\/romePilot-[\w-]+\.js/.test(r.url())) loads.push({url:new URL(r.url()).pathname,worker:!!r.serviceWorker()});});
  page.on("pageerror",err=>failures.push(err.message));
  const slots=()=>page.evaluate(async()=>{
    const keys=await caches.keys();
    const requests=(await Promise.all(keys.filter(k=>k.startsWith("pixel-civ-shell-")).map(async k=>(await caches.open(k)).keys()))).flat();
    return requests.map(r=>new URL(r.url).pathname).filter(p=>/\/romePilot-[\w-]+\.js$/.test(p));
  });
  const ready=()=>page.waitForFunction(()=>window.__pixelWorld?.gameState?.exampleWorldId==="rome-starter");
  await page.goto(origin+"/#world=rome-starter&view=0&era=original");
  await ready();
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller);
  assert.deepEqual(await slots(),[]);assert.deepEqual(loads,[]);
  await page.locator('[data-panel-toggle="more"]').tap();
  await page.getByRole("button",{name:"View",exact:true}).tap();
  const picker=page.getByRole("combobox",{name:"Time period",exact:true});
  await picker.selectOption("rome-forum");await page.getByRole("button",{name:/^Apply/}).tap();
  await page.waitForFunction(()=>window.__pixelWorld?.gameState?.appearanceEra==="rome-forum");
  // Save an applied appearance and remove the initial explicit Original override from the bookmark.
  await page.evaluate(()=>{window.dispatchEvent(new Event("pagehide"));history.replaceState(null,"","#world=rome-starter&view=0");});
  await page.waitForFunction(async()=>{
    for(const key of await caches.keys()) {
      const cache=await caches.open(key);
      if((await cache.keys()).some(r=>r.url.includes("/romePilot-")))return true;
    }
    return false;
  });
  const pack=await slots();assert.equal(pack.length,1);
  const firstLoad=[...loads];
  assert.equal(firstLoad.filter(r=>r.worker).length,1);
  await ctx.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});await ready();
  await page.waitForFunction(()=>window.__pixelWorld.gameState.appearanceEra==="rome-forum");
  assert.ok(await page.locator("canvas").first().isVisible());
  const island=await page.evaluate(()=>({era:window.__pixelWorld.gameState.appearanceEra,sites:window.__pixelWorld.gameState.elements.length}));
  assert.ok(island.sites>4);
  await page.goto(origin+"/field-guide.html?id=house&era=rome-forum&level=2&variant=3");
  await page.locator('[data-model-ready="true"][data-model-selection="rome-forum/house/2/3/single"]').waitFor();
  const rotate=page.getByRole("button",{name:"Rotate model right"});await rotate.focus();await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Reset view",exact:true}).tap();
  assert.deepEqual(await slots(),pack);
  assert.deepEqual(failures,[]);
  assert.equal(loads.filter(r=>r.worker).length,1);
  await ctx.close();

  const standalone = [
    "/field-guide.html?id=house&era=rome-forum&level=2&variant=3",
    "/handbook.html#design=house&era=rome-forum&level=2&style=3&course=rome-upgrade",
  ];
  for (const path of standalone) {
    const fresh = await browser.newContext();
    try {
      const first = await fresh.newPage();
      first.on("pageerror",err=>failures.push(err.message));
      const model=first.locator('[data-model-ready="true"][data-model-selection="rome-forum/house/2/3/single"]');
      await first.goto(origin+path);
      await model.waitFor({timeout:60000});
      await first.waitForFunction(()=>!!navigator.serviceWorker.controller);
      await fresh.setOffline(true);
      await first.reload({waitUntil:"domcontentloaded"});
      await model.waitFor({timeout:60000});
    } finally { await fresh.close(); }
  }
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({initialPackRequests:0,pack:pack[0],networkDownloads:1,offlineIsland:island,offlineAtlas:"rome-forum/house/2/3",keyboardRotate:true,touchReset:true,standaloneFirstVisits:standalone},null,2));
}finally{await browser.close();}
