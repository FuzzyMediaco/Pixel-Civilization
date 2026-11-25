import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {chromium} from "../ui-lib.mjs";
import {canonicalLayout,appearances} from "../period-orbit.mjs";

const url=new URL(process.argv[2]||"http://127.0.0.1:5517/device-review");
assert.ok(["127.0.0.1","localhost","pixel-civilization-device-review.fuzzymedia.workers.dev"].includes(url.hostname));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:["--enable-gpu","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"]});
try {
  const page=await browser.newPage({viewport:{width:1000,height:700},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url.href,{waitUntil:"domcontentloaded"});
  const start=page.getByRole("button",{name:"Start review",exact:true});
  await start.waitFor();
  await start.click();
  await page.waitForFunction(()=>{
    const value=document.querySelector("#json").value;
    if(!value || !document.querySelector("#bar").hidden) return false;
    return ["complete","incomplete"].includes(JSON.parse(value).state);
  },null,{timeout:12*60*1000});
  const report=JSON.parse(await page.locator("#json").inputValue());
  assert.equal(report.state,"complete",report.reason);
  assert.equal(report.runs.length,11);
  assert.deepEqual(report.runs.map(r=>r.era),appearances);
  assert.deepEqual(report.fixture,canonicalLayout);
  assert.ok(report.runs.every(r=>r.frames===60 && r.layoutSha256===canonicalLayout.sha256 &&
    r.graphics.renderer===null && r.medianMs>0 && r.p95Ms>=r.medianMs && r.atlasFirstModelMs>0));
  assert.equal(await page.locator("#rows tr").count(),11);
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+"\n");
  await page.reload();
  await page.getByText("Previous results are available below.").waitFor();
  assert.equal(JSON.parse(await page.locator("#json").inputValue()).runs.length,11);
  await page.locator("#repeats").selectOption("3");
  await page.getByRole("button",{name:"Start review",exact:true}).click();
  await page.getByRole("button",{name:"Stop",exact:true}).click();
  await page.waitForFunction(()=>document.getElementById("bar").hidden&&JSON.parse(document.getElementById("json").value).state==="incomplete");
  const stopped=JSON.parse(await page.locator("#json").inputValue());
  assert.equal(stopped.expectedSamples,33);assert.ok(stopped.runs.length<33);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({release:report.release,complete:report.runs.length,frames:report.runs.reduce((a,r)=>a+r.frames,0),fixture:report.fixture,hardware:"desktop Chromium"}));
} finally {await browser.close();}
