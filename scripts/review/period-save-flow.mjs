// Start the game on the supplied origin. This check only writes an isolated browser profile.
import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";
const origin = process.env.PERIOD_TEST_ORIGIN ?? "http://127.0.0.1:5382";
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader"]});
try {
  const page = await browser.newPage({viewport:{width:1050,height:770}});
  page.setDefaultTimeout(45000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const world=()=>page.waitForFunction(()=>!!window.__pixelWorld?.gameState);
  const state=()=>page.evaluate(()=>({saved:window.__pixelWorld.gameState.appearanceEra??"original",
    drawn:window.__pixelWorld.appearanceEra,count:window.__pixelWorld.gameState.elements.length}));
  const nav=page.getByRole("navigation",{name:"Main"});
  async function view(){
    await nav.getByRole("button",{name:/^More/i}).click();
    await page.getByRole("button",{name:"View",exact:true}).click();
  }
  const choose=async value=>{
    await page.getByLabel("Time period",{exact:true}).selectOption(value);
    await page.waitForFunction(v=>window.__pixelWorld.appearanceEra===v,value);
  };
  await page.goto(origin+"/#world=rome-starter&era=original&view=0");await world();
  const initial=await state();assert.equal(initial.saved,"original");assert.ok(initial.count>0);
  await view();await choose("rome-forum");
  assert.deepEqual(await state(),{...initial,drawn:"rome-forum"});
  await page.getByRole("button",{name:"Cancel preview"}).click();
  await page.waitForFunction(()=>window.__pixelWorld.appearanceEra==="original");
  await choose("rome-aqueduct");await page.getByRole("button",{name:"Apply to island"}).click();
  await page.reload();await world();await page.waitForFunction(()=>window.__pixelWorld.appearanceEra==="rome-aqueduct");
  assert.deepEqual(await state(),{...initial,saved:"rome-aqueduct",drawn:"rome-aqueduct"});
  await view(); await choose("original");await page.getByRole("button",{name:"Apply to island"}).click();
  await page.reload();await world();assert.deepEqual(await state(),initial);
  await nav.getByRole("button",{name:/^More/i}).click();
  await page.getByRole("button",{name:/^Saves/}).click();
  await page.getByRole("button",{name:"New island",exact:true}).click();
  await page.getByLabel("Island name",{exact:true}).fill("Praeneste");
  await page.getByLabel("Time period",{exact:true}).selectOption("rome-forum");
  await page.getByRole("button",{name:"Create island",exact:true}).click();
  await page.waitForFunction(()=>window.__pixelWorld.gameState.appearanceEra==="rome-forum"&&!window.__pixelWorld.gameState.exampleWorldId);
  await page.reload();await world();assert.equal((await state()).saved,"rome-forum");
  assert.deepEqual(errors,[]);console.log("Preview, cancel, apply, reload, round trip and named island setup passed.");
} catch (error) { for (const context of browser.contexts()) for (const page of context.pages()) console.error((await page.locator("body").innerText()).slice(-1400)); throw error; } finally { await browser.close(); }
