import React, { useEffect, useRef, useState } from "react";
import { productionPeriod } from "../game/periods";
import { tourId } from "../game/periodTours";
import { ELEMENT_BY_ID } from "../game/catalog";
import { ERA_LABELS, eraElementName, type EraKey } from "../game/eraStyles";
import { createRomePractice, dispatchPracticeTrain, followPracticeTrain, outletFlow, ROME_LESSONS, takeRomeAction, type RomeLesson } from "../handbook/romePractice";
import { renderIsometricVoxelThumb } from "./ElementFavicon";
import { useEraArt } from "./useEraArt";

type OpenModel = (id:string,level:number,variant:number,lesson:string) => void;
export function RomeCourse({era,lessonId,onLesson,onAtlas,visible}:{
  era:EraKey; lessonId?:string; onLesson:(id:string)=>void; onAtlas:OpenModel; visible:boolean;
}) {
  const lesson = ROME_LESSONS.find(item=>item.id===lessonId) ?? ROME_LESSONS[0];
  return <section className="pc-course" aria-label="Time period practice islands">
    <header className="pc-course-intro"><div><p className="pc-course-kicker">{ERA_LABELS[era]}</p><h1>{era.startsWith("rome-") ? "Build a Roman district" : "Build "+productionPeriod(era).places[1]}</h1>
      <p>Try a working street, railway, water channel and home upgrade on resettable practice islands.</p></div></header>
    <div className="pc-course-layout">
      <nav className="pc-course-outline" aria-label="District exercises">{ROME_LESSONS.map((l,i)=><button key={l.id} type="button" aria-current={l===lesson ? "step" : undefined}
        onClick={()=>onLesson(l.id)}><span>{i+1}</span>{l.name}</button>)}</nav>
      <Practice key={lesson.id} era={era} lesson={lesson} onAtlas={onAtlas} visible={visible}/>
    </div>
    <section className="pc-course-atlas"><h3>Explore the three islands</h3><div>
      {([["rome-starter","Starter street"],["rome-district","Working district"],["rome-skyline","Mature skyline"]] as const).map(([id,name])=>
        <a className="pc-atlas-toggle-btn" key={id} href={"./index.html#"+new URLSearchParams({world:tourId(era,id==="rome-starter"?"starter":id==="rome-district"?"district":"skyline"),view:"0",era})} target="_blank" rel="noopener">{productionPeriod(era).places[id==="rome-starter"?0:id==="rome-district"?1:2]} · {name} ↗</a>)}
    </div></section>
  </section>;
}

function Practice({era,lesson,onAtlas,visible}:{era:EraKey;lesson:RomeLesson;onAtlas:OpenModel;visible:boolean}) {
  const [island,setIsland]=useState(()=>createRomePractice(lesson.id));
  const [feedback,setFeedback]=useState("");
  const [complete,setComplete]=useState(false);
  const [platform,setPlatform]=useState(0);
  const [follow,setFollow]=useState(false);
  const [compared,setCompared]=useState(false);
  const [mode,setMode]=useState<"practice"|"demo">("practice");
  const [revision,setRevision]=useState(0);
  const reduced=useRef(typeof matchMedia!=="undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const {ready,failed,retry}=useEraArt(era);
  const isTrain=lesson.id==="rome-transit";
  const line=island.mobility?.lines[0];
  const home=island.elements.find(e=>e.defId==="house");
  const station=island.elements.filter(e=>e.defId==="train_stops")[platform];
  const model=lesson.id==="rome-upgrade" || lesson.id==="rome-access" ? home : isTrain ? station : undefined;
  const level=model?.level ?? 1;
  const variant=(model?.variant ?? 0)+1;
  const flowing=lesson.id==="rome-flow" && outletFlow(island)>0;
  const live=flowing || !!line?.departures;
  const illustration=ready ? renderIsometricVoxelThumb(ELEMENT_BY_ID[lesson.element],level,variant-1,0,264,era,live) : null;
  const name=eraElementName(lesson.element,era);
  // Every displayed position comes from the vehicle on this island's track graph.
  useEffect(()=>{
    if (!visible || !follow || !isTrain) return;
    const tick=()=>{
      let result;
      for(let i=0;i<(reduced.current ? 1440 : 3);i++) {
        result=followPracticeTrain(island);
        if(result.ok || result.blocked) break;
      }
      if(!result)return;
      setRevision(n=>n+1);setFeedback(result.detail);
      if(result.ok || result.blocked) {setComplete(result.ok);setFollow(false);}
    };
    const interval=window.setInterval(tick,100);
    return ()=>window.clearInterval(interval);
  },[follow,visible,isTrain,island]);
  const reset=()=>{
    setFollow(false);setIsland(createRomePractice(lesson.id));setFeedback("");setComplete(false);
    setMode("practice");setCompared(false);setRevision(0);
  };
  const act=(demo:boolean)=>{
    const s=demo ? createRomePractice(lesson.id) : island;
    if(demo){setIsland(s);setMode("demo");setComplete(false);}
    if(lesson.id==="rome-transit"){
      if(!s.mobility?.lines.length)dispatchPracticeTrain(s,platform);
      setFollow(true);setFeedback("Following the train from its depot.");return;
    }
    const result=takeRomeAction(s,lesson.id);setRevision(n=>n+1);setFeedback(result.detail);setComplete(result.ok);
  };
  return <div className="pc-course-content">
    <h2>{lesson.name}</h2><p className="pc-course-goal">{lesson.goal}</p><p>{lesson.hint}</p>
    <div className="pc-practice-scene" aria-label="Practice model and live state">
      {illustration ? <img src={illustration} width="175" height="175" alt={name+", level "+level+", variant "+variant}/> :
        <span>{failed ? <button onClick={retry}>Reload illustration</button> : "Loading illustration…"}</span>}
      <div><strong>{name}</strong><small>Level {level} · Variant {variant}</small>
        <p>{isTrain ? line?.status ?? "Train in depot" : lesson.id==="rome-flow" ? (flowing ? "Receiving pool supplied" : "Receiving pool disconnected")
          : lesson.id==="rome-upgrade" ? island.metrics.housingBase+" housing capacity" : (home?.connected ? "Home connected to market" : "Street and market ready")}</p>
        <button type="button" className="pc-atlas-toggle-btn" onClick={()=>{setCompared(true);onAtlas(lesson.element,level,variant,lesson.id);}}>Inspect this model in Atlas</button>
      </div>
    </div>
    {isTrain && <div className="pc-practice-track" aria-label="Train position along the practice track">
      <div className="pc-practice-rail"/><span className="pc-practice-engine" style={{left:(5+90*((line?.position?.[0] ?? -6)+6)/12)+"%"}} aria-hidden="true">◆</span>
      <div className="pc-practice-stations">{["Depot","West platform","East platform"].map(label=><span key={label}>{label}</span>)}</div>
    </div>}
    {isTrain && <label>First stop <select value={platform} disabled={!!line} onChange={e=>setPlatform(Number(e.target.value))}>
      <option value={0}>West platform</option><option value={1}>East platform</option></select></label>}
    <div className="pc-course-actions">
      <button type="button" disabled={follow} onClick={()=>act(true)}>Show me</button>
      {follow ? <button type="button" onClick={()=>setFollow(false)}>Pause train</button> :
        <button type="button" disabled={complete || (lesson.id==="rome-upgrade" && !compared)} onClick={()=>act(false)}>{line ? "Follow train" : lesson.action}</button>}
      <button type="button" onClick={reset}>Reset practice</button>
    </div>
    <p className="pc-course-feedback" role="status" data-complete={complete && mode==="practice"} data-revision={revision}>
      {complete ? (mode==="demo" ? "Demonstration complete. Reset to try it yourself. " : "Goal met. ") : ""}{feedback || "Ready for your move."}
    </p>
  </div>;
}
