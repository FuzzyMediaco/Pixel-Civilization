// Verify the unpacked release, including offline guide links, real images and a guided camera jump.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "./ui-lib.mjs";
import chapters from "../../src/handbook/chapters.json" with {type:"json"};
import catalog from "../../src/handbook/catalog.json" with {type:"json"};

const root=path.resolve(process.argv[2] ?? "portable");
const game=path.join(root,"Connected Island");
const url=name=>pathToFileURL(path.join(game,name)).href;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader","--num-raster-threads=2"]});
const context=await browser.newContext({viewport:{width:430,height:930}});
const page=await context.newPage();
page.setDefaultTimeout(60000);
const errors=[];
context.on("page",p=>p.on("pageerror",e=>errors.push(e.message)));
page.on("pageerror",e=>errors.push(e.message));
page.on("console",m=>{if(m.type()==="error") errors.push(m.text());});
context.on("request",r=>{if(/^https?:/.test(r.url())) errors.push("Online dependency: "+r.url());});
context.on("requestfailed",r=>{if(r.failure()?.errorText!=="net::ERR_ABORTED") errors.push(r.url());});
const font=async()=>assert.ok(await page.evaluate(async()=> (await document.fonts.load('16px "DM Sans"')).some(f=>f.status==="loaded")));
try {
  const worlds=chapters.find(c=>c.id==="worlds").lessons;
  for(const w of worlds) {
    const launcher=fs.readFileSync(path.join(game,w.title+".html"),"utf8");
    assert.ok(launcher.includes('content="0;url=./index.html#world='+encodeURIComponent(w.world)+'"'),w.title);
  }
  await page.goto(url("Meridian Fair.html"),{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.__pixelWorld?.gameState.exampleWorldId==="meridian-fair");
  await page.goto(url("handbook.html"));
  await page.getByRole("heading",{name:"Playable islands",exact:true}).waitFor();
  assert.equal(await page.locator(".world-cards article").count(),worlds.length);
  await font();
  await page.goto(url("field-guide.html")+"#id=bus_stops&level=5&variant=4");
  await page.getByText(/This saved level has the same footprint/).waitFor();
  assert.equal(await page.locator('[aria-label="Growth stages"] button').count(),5);
  await page.goto(url("handbook.html"));
  await page.goto(url("field-guide.html")+"#id=angkor_wat&level=5&variant=4");
  await page.getByRole("heading",{name:"Angkor Wat",exact:true}).waitFor();
  assert.equal(await page.locator('[aria-label="Growth stages"] button').count(),5);
  assert.equal(await page.locator('[aria-label="Visual variant"] button').count(),4);
  await font();
  await page.getByRole("navigation",{name:"Operating instructions"}).getByRole("link",{name:"Walk the eight historical wonders"}).click();
  await page.locator("#historical-plaza").waitFor();
  await page.locator("#historical-plaza img").first().evaluate(async img=>{await img.decode(); if(!img.naturalWidth) throw Error("Empty wonder photo");});
  await page.locator("#historical-plaza").getByRole("link",{name:"Visit this viewpoint"}).click();
  await page.waitForFunction(()=>window.__pixelWorld?.gameState.exampleWorldId==="meridian-fair" && window.__pixelWorld.gameState.exampleViewpoint===0);
  await page.locator('[data-panel-toggle="build"]').click();
  await page.getByRole("searchbox",{name:"Search buildable items"}).fill("Machu");
  await page.getByRole("listitem",{name:/Machu Picchu/}).waitFor();
  await font();
  await page.goto(pathToFileURL(path.join(root,"Design atlas.html")).href);
  await page.locator("#art").evaluate(async img=>{await img.decode(); if(!img.naturalWidth) throw Error("Empty atlas");});
  assert.ok((await page.locator("body").innerText()).includes(catalog.length+" designs"));
  assert.deepEqual(errors,[]);
  console.log("Offline Chrome verified all world launchers, fonts, illustrated guide, model controls, linked wonder lesson, direct in-game viewpoint, Build search and standalone atlas.");
} finally { await browser.close(); }
