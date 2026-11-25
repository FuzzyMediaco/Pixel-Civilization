import assert from "node:assert/strict";
import { chromium } from "./ui-lib.mjs";

const origin=process.env.PERIOD_TEST_ORIGIN ?? "http://127.0.0.1:5393";
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-unsafe-swiftshader","--num-raster-threads=2"]});
const errors=[];
try {
  for (const width of [320,1180]) {
    const page=await browser.newPage({viewport:{width,height:820},reducedMotion:"reduce"});
    page.setDefaultTimeout(60000);
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(origin+"/eras.html");
    await page.locator("#periods button").first().waitFor();
    const eras=await page.locator("#era option").evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.equal(new Set(eras).size,10);
    const towns=new Set(),photos=new Set();
    for(const era of eras) {
      await page.selectOption("#era",era);
      for(const size of ["starter","district","skyline"]) {
        await page.selectOption("#size",size);
        const scene=await page.locator("#scene").evaluate(async img=>{
          await img.decode();
          return {width:img.naturalWidth,src:img.currentSrc};
        });
        photos.add(scene.src);
        assert.ok(scene.width>=320);
        const play=await page.locator("#play").getAttribute("href");
        towns.add(play);
        assert.ok(play.includes("era="+era));
        assert.ok((await page.locator("#place").textContent()).trim());
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    assert.equal(towns.size,30);
    assert.equal(photos.size,30);
    assert.ok(await page.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('16px "DM Sans"')&&getComputedStyle(document.querySelector("select")).fontFamily.includes("DM Sans");}));
    for(const era of (width===320?eras:[eras[0],eras.at(-1)])) {
      await page.goto(origin+"/field-guide.html?id=house&era="+era+"&level=2&variant=3");
      await page.locator(".pc-atlas-viewport[data-model-ready=true]").first().waitFor();
      assert.equal(await page.getByLabel("Handbook time period").inputValue(),era);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(page.url().includes("variant=3"));
    }
    await page.goto(origin+"/eras.html?era=future-3027&size=starter");
    await page.locator("#play").click();
    await page.waitForFunction(()=>window.__pixelWorld?.appearanceEra==="future-3027" && window.__pixelWorld.gameState.elements.length>0);
    await page.getByRole("navigation",{name:"Main",exact:true}).getByRole("button",{name:/^More/i}).click();
    await page.getByRole("button",{name:/Island Store/i}).first().click();
    const shop=page.getByRole("dialog",{name:/Island Store/i});
    await shop.waitFor();
    await shop.getByRole("button",{name:"Pix plans",exact:true}).click();
    assert.match(await shop.innerText(),/99\.99/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    console.log(width+"px: 30 illustrated tours, "+(width===320?10:2)+" Atlas models, playable 3027 and Pix catalog passed.");
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
