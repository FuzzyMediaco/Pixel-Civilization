import React, { useMemo } from "react";
import { Lock, Mountain, Search, Sparkles, X } from "lucide-react";
import { type CivElementDef, ELEMENTS, type ElementCategory } from "../game/catalog";
import { elementLevelStats } from "../game/cityDynamics";
import { buildingCharges } from "../game/cityEconomy";
import { alertIssues, type IssueFix, suppliesNeed } from "../game/cityIssues";
import { type GameState, buildingLockReason } from "../game/simulation";
import type { BuildBrush } from "../game/worldRenderer";
import { BottomSheet, Chip, ChipRow, type SheetHeight } from "./ui";

export type BuildCategory = "suggested" | "all" | "works" | ElementCategory;

/** Short, plain names for the build chips (one name per concept). */
export const BUILD_CHIPS: {id: BuildCategory; label: string}[] = [
  {id: "suggested", label: "Suggested"},
  {id: "housing", label: "Homes"},
  {id: "roads_transit", label: "Roads & transit"},
  {id: "commerce", label: "Shops & work"},
  {id: "agriculture", label: "Food"},
  {id: "power_waste", label: "Power & waste"},
  {id: "water_util", label: "Water"},
  {id: "civic_parks", label: "Civic & parks"},
  {id: "police_military", label: "Safety"},
  {id: "faith", label: "Faith"},
  {id: "maritime", label: "Harbor"},
  {id: "nature_terrain", label: "Nature"},
  {id: "landmarks", label: "Landmarks"},
  {id: "wealth_projects", label: "Wealth"},
  {id: "works", label: "Land & water"},
  {id: "all", label: "All"},
];

const n = (x: number) => Math.round(x).toLocaleString();
/** What a building gives, in words. */
export function effectSummary(def: CivElementDef, level = 1): string {
  const v = elementLevelStats(def, level);
  if (v.population) return `+${n(v.population)} people`;
  if (v.jobs) return `+${n(v.jobs)} jobs`;
  if (v.power) return `+${n(v.power)} power`;
  if (v.water) return `+${n(v.water)} water`;
  if (v.waste) return `+${n(v.waste)} waste cap`;
  if (v.food) return `+${n(v.food)} food`;
  if (v.education) return `+${n(v.education)} school seats`;
  if (v.recreation) return `+${n(v.recreation)} leisure`;
  if (v.government) return `+${n(v.government)} civic`;
  if (v.policeRadius) return `Police · ${n(v.policeRadius)} tiles`;
  if (v.fireRadius) return `Fire cover · ${n(v.fireRadius)} tiles`;
  if (v.military) return `+${n(v.military)} defense`;
  if (v.income) return `+$${n(v.income)} income`;
  if (def.isRoadNetwork) return "Road · drag to draw";
  if (def.isRailNetwork) return "Track · drag to draw";
  if (def.isWaterFeature) return "Waterway";
  return "Scenery";
}

export function lockLabel(def: CivElementDef, lock: string) {
  return lock.startsWith("Staff") ? "Needs city office" : def.wealthThreshold ? lock.replace("Reach ", "") : "Stage " + def.stage;
}

function suggested(state: GameState): CivElementDef[] {
  const open = ELEMENTS.filter(d => !buildingLockReason(d, state));
  const picks: CivElementDef[] = [];
  const add = (d?: CivElementDef) => {if (d && !picks.includes(d)) picks.push(d);};
  for (const issue of alertIssues(state)) {
    const need = issue.fix?.need;
    if (need) open.filter(d => suppliesNeed(d, need)).sort((a, b) => a.cost - b.cost).slice(0, 3).forEach(add);
  }
  ELEMENTS.filter(d => d.isStarter).forEach(add);
  return picks.slice(0, 15);
}

export function BuildSheet({state, brush, cat, onCat, query, onQuery, fix, onClearFix, onPick, works, height, onHeight, onClose}: {
  state: GameState;
  brush: BuildBrush;
  cat: BuildCategory;
  onCat: (c: BuildCategory) => void;
  query: string;
  onQuery: (q: string) => void;
  fix?: IssueFix;
  onClearFix: () => void;
  onPick: (defId: string) => void;
  works: React.ReactNode;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
}) {
  const charges = buildingCharges(state);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: CivElementDef[];
    if (q) list = ELEMENTS.filter(el => el.name.toLowerCase().includes(q) || el.description.toLowerCase().includes(q) || el.category.toLowerCase().includes(q)
      || (q.includes("feed") && (el.food ?? 0) > 0) || ((q.includes("span") || q.includes("bridge")) && el.archetype.startsWith("bridge")));
    else if (fix) list = ELEMENTS.filter(el => fix.need ? suppliesNeed(el, fix.need) : el.category === fix.category);
    else if (cat === "suggested") return suggested(state);
    else if (cat === "all") list = ELEMENTS;
    else list = ELEMENTS.filter(el => el.category === cat);
    return [...list].sort((a, b) => {
      const ua = buildingLockReason(a, state) ? 1 : 0, ub = buildingLockReason(b, state) ? 1 : 0;
      return ua - ub || a.stage - b.stage || a.cost - b.cost;
    });
  }, [cat, query, fix, state]);

  const showWorks = cat === "works" && !query && !fix;
  return <BottomSheet id="sheet-build" title="Build" subtitle={charges ? "Treasury $" + Math.floor(state.money).toLocaleString() : "God mode · building is free"}
    height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close Build">
    <label className="ui-search">
      <Search size={18} aria-hidden="true"/>
      <input type="search" aria-label="Find a building" placeholder={`Search ${ELEMENTS.length} buildings…`} value={query} onChange={e => onQuery(e.target.value)}/>
      {query && <button type="button" className="ui-btn is-quiet ui-iconbtn" aria-label="Clear search" onClick={() => onQuery("")}><X size={18}/></button>}
    </label>
    <ChipRow label="Building categories">
      {fix && <Chip label={fix.label} icon={<X size={14}/>} selected onClick={onClearFix} title="Clear this filter"/>}
      {BUILD_CHIPS.map(c => <Chip key={c.id} label={c.label} selected={!fix && !query && cat === c.id}
        icon={c.id === "suggested" ? <Sparkles size={15}/> : c.id === "works" ? <Mountain size={15}/> : undefined}
        onClick={() => {onClearFix(); onQuery(""); onCat(c.id);}}/>)}
    </ChipRow>
    {showWorks ? <div className="desk-works">{works}</div> : items.length === 0
      ? <p className="ui-empty">No buildings match “{query}”.</p>
      : <div className="ui-cards">
        {items.map(def => {
          const lock = buildingLockReason(def, state);
          const selected = brush.kind === "place" && brush.defId === def.id;
          const afford = !charges || state.money >= def.cost;
          return <button key={def.id} type="button" className="ui-card" disabled={!!lock} aria-pressed={selected}
            title={lock ?? def.description} onClick={() => onPick(def.id)}
            aria-label={def.name + ", " + effectSummary(def) + (lock ? ", locked: " + lock : charges ? ", costs $" + def.cost.toLocaleString() : "")}>
            <img src={"./handbook/catalog/thumbs/" + def.id + ".webp"} alt="" loading="lazy" decoding="async" width={56} height={56}/>
            <b>{def.name}</b>
            <small>{lock ? <><Lock size={11} aria-hidden="true"/> {lockLabel(def, lock)}</> : effectSummary(def)}</small>
            <span className={"ui-cost" + (afford ? "" : " is-bad")}>{charges ? "$" + def.cost.toLocaleString() : "Free"}</span>
          </button>;
        })}
      </div>}
  </BottomSheet>;
}
