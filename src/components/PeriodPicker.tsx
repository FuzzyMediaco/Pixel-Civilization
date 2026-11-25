import { createContext, useContext } from "react";
import { productionPeriod } from "../game/periods";
import { tourId,tourImage } from "../game/periodTours";
import { eraStageTreatment } from "../game/eraStage";
import { ELEMENT_BY_ID } from "../game/catalog";
import { ERA_LABELS, ROME_PILOT_IDS, eraElementName, normalizeEra, type EraKey } from "../game/eraStyles";
import { ElementFavicon } from "./ElementFavicon";
import "./periodPicker.css";

export const EraPresentation = createContext<{era: EraKey; originalNames: boolean}>({era: "original", originalNames: false});
export function usePeriodNames() {
  const {era, originalNames} = useContext(EraPresentation);
  return {era, nameEra: originalNames ? "original" as const : era,
    name: (id: string) => eraElementName(id, originalNames ? "original" : era)};
}
export function EraSelect({value,onChange}: {value: EraKey; onChange: (value: EraKey) => void}) {
  return <label className="era-select">Time period
    <select aria-label="Time period" value={value} onChange={event=>onChange(normalizeEra(event.target.value))}>
      {Object.entries(ERA_LABELS).map(([id,label])=><option value={id} key={id}>{label}</option>)}
    </select></label>;
}
const descriptions: Partial<Record<EraKey,string>> = {
  original:"The island’s original buildings, streets and vehicles.",
  "rome-forum":"Pale travertine, open selling courts and painted shopfronts.",
  "rome-aqueduct":"Brick arcades, deep water channels and terraced workshops.",
};
export function PeriodPicker({stage,saved,selected,ready,error,originalNames,locked,onSelect,onApply,onOriginalNames}: {
  stage: number; saved: EraKey; selected: EraKey; ready: boolean; error: string; originalNames: boolean;
  locked?:boolean;
  onSelect:(value: EraKey)=>void; onApply:()=>void; onOriginalNames:(value:boolean)=>void;
}) {
  return <section className="era-picker" aria-label="Island time period">
    <EraSelect value={selected} onChange={onSelect}/>
    <p>{descriptions[selected] ?? productionPeriod(selected).description} {selected === "rome-forum" && `Alternate Roman designs for ${ROME_PILOT_IDS.length} types.`}</p>
    {selected !== "original" && <p><strong>Stage {stage} · {eraStageTreatment(selected,stage).name}</strong> — {eraStageTreatment(selected,stage).cue}</p>}
    <div className="era-fixtures">
      {(["street","skyline"] as const).map((shot,index)=><a key={shot} href={`./#world=${tourId(selected,index?"skyline":"starter")}&view=0&era=${selected}`} target="_blank" rel="noreferrer">
        <img src={tourImage(selected,shot==="street"?"starter":"skyline")} alt="" width="168" height="77" />
        {index ? "Mature skyline" : "Starter street"} ↗
      </a>)}
    </div>
    <div className="era-samples">{["house","grocery_store","farms","water_treatment_plant","spaceport"].map(id=><span key={id} title={eraElementName(id,selected)}>
      <ElementFavicon def={ELEMENT_BY_ID[id]} era={selected}/><small>{eraElementName(id,selected)}</small>
    </span>)}</div>
    <a className="era-review-link" href={"./eras.html?era="+selected} target="_blank" rel="noreferrer">Compare the time periods ↗</a>
    <label className="era-names"><input type="checkbox" checked={originalNames} onChange={e=>onOriginalNames(e.target.checked)}/> Show original names</label>
    {error && <p role="alert">{error}</p>}
    {selected!==saved && <div className="era-actions">
      <button className="ui-btn is-primary" type="button" disabled={!ready} onClick={onApply}>{ready ? (locked ? "Unlock this time period" : "Apply to island") : "Loading artwork…"}</button>
      <button className="ui-btn" type="button" onClick={()=>onSelect(saved)}>Cancel preview</button>
    </div>}
  </section>;
}
