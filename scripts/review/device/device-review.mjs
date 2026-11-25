import { appearances, canonicalLayout, measureOrbit } from "./period-orbit.mjs";

const $ = id => document.getElementById(id);
const display = ["Original","Ancient Egypt","Ancient China","Rome","Ancient Greece","Medieval Europe","Renaissance Italy","World War II","Art Deco","3027","Post-apocalyptic"];
const label = era => display[appearances.indexOf(era)] || era;
let build, report, controller, savedKey;
const hex = data => Array.from(new Uint8Array(data),i=>i.toString(16).padStart(2,"0")).join("");
const digest = text => crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)).then(hex);
function showReport() {
  $("results").hidden = !report;
  if (!report) return;
  $("count").textContent = `${report.runs.length} of ${report.expectedSamples} samples · ${report.runs.reduce((n,r)=>n+r.frames,0)} measured frames · ${report.state}`;
  $("rows").replaceChildren();
  for (const r of report.runs) {
    const row=$("rows").insertRow();
    for (const v of [label(r.era),r.run,r.frames,r.medianMs,r.p95Ms,r.worldReadyMs,r.atlasFirstModelMs]) row.insertCell().textContent=v;
  }
  $("json").value=JSON.stringify(report,null,2);
}
function persist() {
  try {localStorage.setItem(savedKey,JSON.stringify(report));} catch { /* Download remains available. */ }
  showReport();
}
function openView(path) {
  const f=document.createElement("iframe");
  f.title="Pixel Civilization review";
  f.tabIndex=-1;
  f.src=new URL(path,location.origin).href;
  $("stage").replaceChildren(f);
  return f;
}
async function until(check,signal) {
  const start=performance.now();
  while(!check()) {
    signal.throwIfAborted();
    if(performance.now()-start>180000) throw Error("The preview did not finish loading within three minutes.");
    await new Promise(resolve=>setTimeout(resolve,30));
  }
  signal.throwIfAborted();
}
async function sample(era,run,signal) {
  const start=performance.now();
  const city=openView("/#world=rome-skyline&era="+era);
  await until(()=>city.contentWindow.__pixelWorld?.gameState.exampleWorldId==="rome-skyline" &&
    city.contentWindow.__pixelWorld.appearanceEra===era,signal);
  const worldReadyMs=Math.round(performance.now()-start);
  const {layout,graphics,...orbit}=await measureOrbit(city.contentWindow,signal,false);
  const sha256=await digest(JSON.stringify(layout));
  if(layout.length!==canonicalLayout.sites || sha256!==canonicalLayout.sha256) throw Error("The city layout differs from the desktop reference.");
  if(orbit.frames!==60) throw Error("The renderer did not produce the required 60 frames.");
  // Release the game's GPU before replacing its document on memory-constrained phones.
  signal.throwIfAborted();
  const atlasStart=performance.now();
  $("progress").textContent=`${label(era)} · run ${run} · drawing the Atlas model`;
  const atlas=openView("/field-guide.html?id=apartments&level=4&variant=3&era="+era);
  const marker='[data-model-ready="true"][data-model-selection="'+era+'/apartments/4/3/single"]';
  await until(()=>atlas.contentDocument?.querySelector(marker),signal);
  return {era,run,...orbit,graphics,layoutSha256:sha256,worldReadyMs,atlasFirstModelMs:Math.round(performance.now()-atlasStart)};
}
async function runReview() {
  if (controller || !build) return;
  const repeats=Number($("repeats").value);
  if(![1,3].includes(repeats))return;
  controller=new AbortController();
  const signal=controller.signal;
  $("start").disabled=true;$("repeats").disabled=true;$("bar").hidden=false;
  report={format:1,edition:build.edition,release:build.release,gameCommit:build.gameCommit,world:"rome-skyline",
    fixture:canonicalLayout,repeats,expectedSamples:repeats*appearances.length,cache:"same browser profile",state:"in progress",runs:[]};
  try {
    for(let n=1;n<=repeats;n++)for(const era of appearances) {
      $("progress").textContent=`${report.runs.length+1}/${report.expectedSamples} · ${label(era)} · loading city and orbiting`;
      const result=await sample(era,n,signal);
      const first=report.runs[0]?.graphics;
      if(first && (first.viewport.join()!==result.graphics.viewport.join() ||
        first.buffer.join()!==result.graphics.buffer.join() || first.dpr!==result.graphics.dpr)) {
        throw Error("The display dimensions changed. Keep the same orientation and run again.");
      }
      report.runs.push(result);persist();
    }
    report.state="complete";$("status").textContent="Review complete. Every sample matched the desktop layout.";
  } catch(e) {
    report.state="incomplete";
    report.reason=e.message || "The review was stopped.";
    $("status").textContent=report.reason+" Completed samples are available below.";
  } finally {
    $("stage").replaceChildren();$("bar").hidden=true;
    $("start").disabled=false;$("repeats").disabled=false;$("start").textContent="Start another review";
    controller=null;persist();
  }
}
function stop(message) {controller?.abort(new Error(message));}
$("stop").onclick=()=>stop("Review stopped.");
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop("The page left the foreground.");});
$("start").onclick=runReview;
$("copy").onclick=async()=>{
  try {await navigator.clipboard.writeText($("json").value);$("status").textContent="Copied results.";}
  catch {$("json").closest("details").open=true;$("json").focus();$("json").select();$("status").textContent="Select Copy to copy these results.";}
};
$("download").onclick=()=>{
  const url=URL.createObjectURL(new Blob([$("json").value],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="pixel-device-review-"+build.release.slice(0,12)+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};
try {
  const res=await fetch("./device-review-build.json",{cache:"no-store"});
  if(!res.ok)throw Error();
  build=await res.json();
  const manifest=await (await fetch("/offline-index.json",{cache:"no-store"})).json();
  const shell=await (await fetch("/sw.js",{cache:"no-store"})).text();
  if(build.release!==manifest.release || !shell.includes('"'+build.edition+'"')) throw Error();
  for(const [key,value] of [["Game build",build.release],["City layout · 156 sites",canonicalLayout.sha256]]) {
    const term=document.createElement("dt"),desc=document.createElement("dd");
    term.textContent=key;desc.textContent=value;$("build").append(term,desc);
  }
  savedKey="pixel-device-review-v1-"+build.release;
  try {report=JSON.parse(localStorage.getItem(savedKey));} catch {}
  if(report?.state==="in progress"){report.state="incomplete";report.reason="The previous run was interrupted.";persist();}
  showReport();$("start").disabled=false;
  $("status").textContent=report?"Previous results are available below.":"Ready to run.";
} catch {$("status").textContent="The review build could not be verified. Reload this page.";}
