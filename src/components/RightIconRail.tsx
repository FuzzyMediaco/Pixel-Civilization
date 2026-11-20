import React from "react";
import { ChartNoAxesCombined, CloudSun, Hammer, Layers } from "lucide-react";

export type IslandPanel = "build" | "layers" | "view" | "status";
const sections=[
  {id:"build",text:"Build",name:"Elements Menu",key:"B",Icon:Hammer},
  {id:"layers",text:"Layers",name:"Civilization Heat Maps",key:"H",Icon:Layers},
  {id:"view",text:"View",name:"Weather Studio & 360° View",key:"V",Icon:CloudSun},
  {id:"status",text:"Status",name:"Top Menu",key:"T",Icon:ChartNoAxesCombined},
] as const;
export function RightIconRail({active,onToggle}:{active:IslandPanel|null;onToggle:(panel:IslandPanel)=>void}) {
  return <nav className="island-rail" aria-label="Island controls">
    {sections.map(({id,text,name,key,Icon})=><button key={id} type="button" data-panel-toggle={id}
      aria-expanded={active===id} aria-controls={"island-panel-"+id} aria-keyshortcuts={key}
      aria-label={(active===id?"Close ":"Open ")+name+" ("+key+")"} title={name+" ("+key+")"} onClick={()=>onToggle(id)}>
      <Icon size={18} aria-hidden="true"/><span>{text}</span>
    </button>)}
  </nav>;
}
