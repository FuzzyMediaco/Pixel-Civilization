const frame=document.querySelector("iframe"), status=document.querySelector("#status"), start=document.querySelector("#start"), save=document.querySelector("#save");
const report={build:null,edition:null,viewport:null,runs:[]};
const eras=["original","rome-forum","rome-aqueduct"];
const label={"original":"Original","rome-forum":"Forum City","rome-aqueduct":"Aqueduct City"};
const nextFrame=w=>new Promise(resolve=>w.requestAnimationFrame(resolve));
async function waitFor(predicate) {
  const deadline=performance.now()+90000;
  for(;;) {
    let result;try {result=predicate();}catch { /* The previous document is unloading. */ }
    if(result)return result;
    if(performance.now()>deadline)throw Error("The game or 3D viewer took more than 90 seconds to load.");
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}
async function load(url,complete) {
  const begun=performance.now();
  await new Promise(resolve=>{frame.onload=resolve;frame.src="about:blank";});
  frame.onload=null;frame.src=url;
  return {value:await waitFor(()=>complete(frame.contentWindow)),elapsed:performance.now()-begun};
}
function downloads(w) {
  const js=w.performance.getEntriesByType("resource").filter(r=>r.initiatorType==="script"||r.name.endsWith(".js"));
  return {scripts:js.length,transferredBytes:js.reduce((n,r)=>n+r.transferSize,0),decodedBytes:js.reduce((n,r)=>n+r.decodedBodySize,0)};
}
async function measure(era,n) {
  status.textContent=label[era]+" · run "+n+" of 3 · opening Colonia Alta";
  const {value:world,elapsed}=await load("/#world=rome-skyline&era="+era,w=>
    w.__pixelWorld?.gameState.exampleWorldId==="rome-skyline" && w.__pixelWorld.appearanceEra===era && w.__pixelWorld);
  const w=frame.contentWindow;
  world.focusGrid(-1,-1,82);
  const camera={...world.getCameraView(),theta:.68,phi:.89,autoSpin:false};
  world.gameState.timeOfDay=14; world.gameState.timeLocked=true;world.gameState.weather="clear";world.gameState.weatherLocked=true;
  for(let warm=0;warm<8;warm++)await nextFrame(w);
  let previous=await nextFrame(w);
  let rendered=world.renderer.info.render.frame;
  const samples=[];
  for(let step=0;step<60;step++){
    if(document.hidden)throw Error("The page was hidden. Keep it visible and start the three runs again.");
    world.restoreCameraView({...camera,theta:camera.theta+step/120});
    let now;
    do {
      now=await nextFrame(w);
      if(now-previous>10000)throw Error("The game stopped rendering. Restart the test with this page visible.");
    } while (world.renderer.info.render.frame===rendered);
    rendered=world.renderer.info.render.frame;
    samples.push(now-previous);previous=now;
  }
  const gl=world.renderer.getContext(), info=gl.getExtension("WEBGL_debug_renderer_info");
  const ordered=samples.toSorted((a,b)=>a-b);
  const row={run:n,era,medianMs:(ordered[29]+ordered[30])/2,p95Ms:ordered[56],frames:samples.length,
    worldReadyMs:elapsed,sites:world.gameState.elements.length,gameWindow:[w.innerWidth,w.innerHeight],
    drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:w.devicePixelRatio,ua:w.navigator.userAgent,
    renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    heapBytes:w.performance.memory?.usedJSHeapSize??null,downloads:downloads(w)};
  status.textContent=label[era]+" · run "+n+" of 3 · opening Insula at level 4, variant 3";
  const model=await load("/field-guide.html?id=apartments&level=4&variant=3&era="+era,w=>
    w.document.querySelector('.pc-atlas-viewport[data-model-ready="true"][data-model-selection="'+era+'/apartments/4/3/single"]'));
  row.atlasFirstModelMs=model.elapsed;
  return row;
}
start.addEventListener("click",async()=>{
  start.disabled=true;save.disabled=true;report.runs=[];report.viewport=[innerWidth,innerHeight];
  document.querySelector("#summary").textContent="";
  try {
    try{report.build=(await (await fetch("/api/health")).json()).sourceCommit??null;}catch{/* Optional on local preview. */}
    try{report.edition=(await (await fetch("/offline-index.json")).json()).release??null;}catch{/* Optional on development builds. */}
    for(let n=1;n<=3;n++) for(const era of eras){
      const row=await measure(era,n);report.runs.push(row);
      document.querySelector("#summary").textContent+=label[era]+" · "+row.medianMs.toFixed(1)+" ms ("+(1000/row.medianMs).toFixed(1)+" fps) · Atlas "+Math.round(row.atlasFirstModelMs)+" ms\n";
    }
    status.textContent="Nine runs completed.";save.disabled=false;
  }catch(error){status.textContent=error.message;save.disabled=!report.runs.length;}
  finally{start.disabled=false;frame.src="about:blank";}
});
save.addEventListener("click",()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="pixel-rome-device-test.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
