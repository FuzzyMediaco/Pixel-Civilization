export const appearances = ["original","ancient-egypt","ancient-china","rome-aqueduct","ancient-greece","medieval-europe","renaissance-italy","world-war-ii","art-deco","future-3027","post-apocalyptic"];
export const canonicalLayout = { sites:156, sha256:"5dc9a1b5824069a4ef13157ffea3f4d160b3c3ba102769db9631b5002c1e27c2" };

// This function also runs inside Playwright's page.evaluate. Keep its dependencies in the function.
export async function measureOrbit(target, signal, includeGpu = true) {
  const view = target || window;
  const world = view.__pixelWorld;
  const frame = () => new Promise((resolve,reject) => {
    if (!signal) {view.requestAnimationFrame(resolve);return;}
    if (signal.aborted) {reject(signal.reason);return;}
    const abort = () => {view.cancelAnimationFrame(id);reject(signal.reason);};
    const id = view.requestAnimationFrame(now => {signal.removeEventListener("abort",abort);resolve(now);});
    signal.addEventListener("abort",abort,{once:true});
  });
  world.gameState.timeOfDay = 14;
  world.gameState.timeLocked = true;
  world.gameState.weather = "clear";
  world.gameState.weatherLocked = true;
  world.focusGrid(-1,-1,82);
  const cam = {...world.getCameraView(),theta:.68,phi:.89,autoSpin:false};
  const layout = world.gameState.elements.map(e => [e.defId,e.gx,e.gz,e.rotation,e.spanX,e.spanZ,e.level,e.variant]).sort();
  for (let i=0;i<8;i++) await frame();
  let last = await frame(), rendered = world.renderer.info.render.frame;
  const times=[];
  for (let step=0;step<60;step++) {
    world.restoreCameraView({...cam,theta:cam.theta+step/120});
    let now;
    do {
      now = await frame();
      if (now-last>10000) throw Error("Rendering stalled");
    } while (world.renderer.info.render.frame===rendered);
    rendered=world.renderer.info.render.frame;
    times.push(now-last);
    last=now;
  }
  const ordered=times.slice().sort((a,b)=>a-b);
  const gl=world.renderer.getContext();
  const info=includeGpu && gl.getExtension("WEBGL_debug_renderer_info");
  return {
    layout,graphics:{renderer:includeGpu?gl.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER):null,
      viewport:[view.innerWidth,view.innerHeight],buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:view.devicePixelRatio},
    frames:times.length,medianMs:+((ordered[29]+ordered[30])/2).toFixed(2),p95Ms:+ordered[56].toFixed(2),
    heapBytes:view.performance.memory?.usedJSHeapSize??null
  };
}
