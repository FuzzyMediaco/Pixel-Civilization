import { useState } from "react";
import { ArrowLeft, Compass, MapPin, X } from "lucide-react";
import { EXAMPLE_WORLDS, type ExampleWorld, type ExampleWorldId } from "../game/exampleWorlds";
import { GameDialog } from "./GameDialog";
import "./exampleIslands.css";

export function ExampleIslands({current, error, onOpen, onReturn, onClose}: {
  current?: ExampleWorldId;
  error: boolean;
  onOpen: (id: ExampleWorldId) => void;
  onReturn: () => void;
  onClose: () => void;
}) {
  return <GameDialog label="Example islands" className="example-islands" onDismiss={onClose}>
    <header><div><h2>Example islands</h2><p>Explore a working city in God mode. Each island keeps its own edits.</p></div>
      <button type="button" aria-label="Close example islands" data-dialog-dismiss onClick={onClose}><X size={18}/></button></header>
    {error && <p className="world-save-alert" role="alert">There is not enough browser storage to switch safely. Your current island is still open.</p>}
    <div className="world-cards">{EXAMPLE_WORLDS.map(world=>
      <button type="button" className="world-card" key={world.id} onClick={()=>onOpen(world.id)}>
        <img src={"./handbook/worlds/"+world.id+".webp"} alt="" width="900" height="560"/>
        <span><strong>{world.name}</strong><span>{world.description}</span>
        <b>{world.id===current?"Continue exploring":"Explore island"} <span aria-hidden="true">→</span></b></span>
      </button>
    )}</div>
    {current && <footer><button type="button" onClick={onReturn}><ArrowLeft size={15}/> Return to my island</button></footer>}
  </GameDialog>;
}

export function WorldGuide({world, selected, onVisit, onBrowse}: {
  world: ExampleWorld;
  selected?: number;
  onVisit: (index: number) => void;
  onBrowse: () => void;
}) {
  const [open,setOpen]=useState(false);
  const point = world.viewpoints[selected ?? -1];
  return <aside className={"world-guide"+(open?" is-open":"")} aria-label={world.name+" island guide"}>
    <button type="button" className="world-guide-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <Compass size={16}/><strong>{world.name}</strong><span>{open?"Close guide":"Island guide"}</span>
    </button>
    {open && <div className="world-stops">
      <label><MapPin size={15}/> Visit a place
        <select value={selected ?? -1} onChange={e=>onVisit(Number(e.target.value))}>
          <option value={-1}>Island overview</option>
          {world.viewpoints.map((v,i)=><option key={v.name} value={i}>{v.name}</option>)}
        </select>
      </label>
      <p>{point?.tryThis ?? world.description}</p>
      <div><button type="button" onClick={()=>onVisit(((selected ?? -1)+1)%world.viewpoints.length)}>Next stop →</button>
        <button type="button" onClick={onBrowse}>Example islands</button></div>
    </div>}
  </aside>;
}
