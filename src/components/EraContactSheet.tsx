import { useEffect, useRef, useState } from "react";
import { getMaxElementLevel, type CivElementDef } from "../game/catalog";
import type { EraKey } from "../game/eraStyles";
import { eraSheet, hasBakedSheet, renderIsometricVoxelThumb } from "./ElementFavicon";
import { useEraArt } from "./useEraArt";

export function EraContactSheet({def,era,originalImage,caption}:{def:CivElementDef;era:EraKey;originalImage:string;caption:string}) {
  const [open,setOpen]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const baked=hasBakedSheet(def.id,era);
  const dynamic=era!=="original" && !baked;
  const {ready}=useEraArt(open&&dynamic ? era : "original");
  const max=getMaxElementLevel(def.id);
  useEffect(()=>{
    const context=canvas.current?.getContext("2d");
    if(!dynamic||!open||!context||!ready)return;
    let canceled=false,frame=0;
    context.clearRect(0,0,max*96,384);
    async function next(index:number) {
      if(canceled||index>=max*4)return;
      const level=index%max+1,variant=Math.floor(index/max);
      const data=renderIsometricVoxelThumb(def,level,variant,0,96,era);
      if(data) {
        const img=new Image();img.src=data;await img.decode();
        if(canceled)return;
        context!.drawImage(img,(level-1)*96,variant*96,96,96);
      }
      frame=requestAnimationFrame(()=>void next(index+1));
    }
    void next(0);
    return ()=>{canceled=true;cancelAnimationFrame(frame);};
  },[dynamic,open,ready,def,max,era]);
  return <details className="pc-atlas-nest" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>2D sprite sheet (all levels &amp; styles)</span></summary>
    {open && <div className="pc-atlas-nest-body"><div className="pc-atlas-sheet-wrap">
      {dynamic ? <canvas style={{width:"100%",height:"auto"}} ref={canvas} width={96*max} height={384} aria-label={caption} role="img"/> :
        <img src={baked ? eraSheet(def.id,era) : originalImage} alt={caption}/>}
    </div></div>}
  </details>;
}
