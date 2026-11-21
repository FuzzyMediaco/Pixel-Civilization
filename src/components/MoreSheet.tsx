import React from "react";
import { BookOpen, ChevronLeft, Cloud, Compass, FlaskConical, Map, RotateCcw, Save, Settings, Sparkles, Undo2 } from "lucide-react";
import { type GameMode, STAGES } from "../game/catalog";
import { MAX_SAVE_SLOTS } from "../game/saveSlots";
import type { GameState, SelectionFilter } from "../game/simulation";
import { BottomSheet, Button, Chip, ChipRow, ListRow, type SheetHeight } from "./ui";

export type CursorBehavior = "auto" | "select" | "place";
export type MorePage = "view" | "mode" | "god" | "settings" | null;

const MODES: {id: GameMode; title: string; desc: string}[] = [
  {id: "god", title: "God mode", desc: "Sandbox: build freely, shape land and water, control weather and time."},
  {id: "real", title: "Real mode", desc: "Grow from a stage 1 village to a stage 20 megalopolis on a budget."},
  {id: "survival", title: "Survival", desc: "Reserves, repairs and defense; long shortages can collapse the city."},
];
const BEHAVIORS: {id: CursorBehavior; label: string; hint: string}[] = [
  {id: "auto", label: "Smart", hint: "Buildings place once; roads and tracks keep drawing until you tap ✓."},
  {id: "select", label: "Place once", hint: "Every placement returns to selecting."},
  {id: "place", label: "Keep placing", hint: "The brush stays active until you tap ✓."},
];
const FILTERS: {id: SelectionFilter; label: string}[] = [
  {id: "all", label: "Everything"}, {id: "roads", label: "Roads"}, {id: "buildings", label: "Buildings"},
  {id: "water", label: "Water"}, {id: "power", label: "Power"}, {id: "waste", label: "Waste"},
];
const KEYS: [string, string][] = [
  ["B / L / C / T / M", "Build, Layers, City, Transit, More"], ["R", "Rotate"], ["Del", "Demolish selection (asks first)"],
  ["Ctrl+Z", "Undo last building edit"], ["Esc", "Close placement, then panel, then selection"], ["+ / −", "Zoom"],
];
const TITLES: Record<Exclude<MorePage, null>, string> = {view: "View", mode: "Game mode", god: "God tools", settings: "Settings"};

export function MoreSheet({state, page, onPage, height, onHeight, onClose, savedCount, onSaves, onExamples, onChangeMode, onCopyIsland, onReset,
  view, godTools, cursorBehavior, onCursorBehavior, selectionFilter, onSelectionFilter, onUndo}: {
  state: GameState; page: MorePage; onPage: (p: MorePage) => void;
  height: SheetHeight; onHeight: (h: SheetHeight) => void; onClose: () => void;
  savedCount: number; onSaves: () => void; onExamples: () => void; onChangeMode: (m: GameMode) => void; onCopyIsland: () => void; onReset: () => void;
  onUndo: () => void;
  view: React.ReactNode; godTools: React.ReactNode;
  cursorBehavior: CursorBehavior; onCursorBehavior: (b: CursorBehavior) => void;
  selectionFilter: SelectionFilter; onSelectionFilter: (f: SelectionFilter) => void;
}) {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const modeName = MODES.find(m => m.id === state.mode)?.title ?? state.mode;
  return <BottomSheet id="sheet-more" title={page ? TITLES[page] : "More"} height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close More"
    subtitle={page ? undefined : modeName + (state.mode === "god" ? "" : " · stage " + stage.stage + " " + stage.name)}>
    {page && <Button variant="quiet" small icon={<ChevronLeft size={18}/>} label="More" onClick={() => onPage(null)} style={{marginBottom: 6}}/>}
    {!page && <div className="ui-list">
      <ListRow icon={<Cloud size={18}/>} title="View" subtitle={state.mode === "god" ? "Weather · time · camera · defense" : "Camera · 360° · defense"} trailing="›" onClick={() => onPage("view")}/>
      <ListRow icon={<Save size={18}/>} title="Saves" subtitle={savedCount + " of " + MAX_SAVE_SLOTS + " slots used"} trailing="›" onClick={onSaves}/>
      <ListRow icon={<Sparkles size={18}/>} title="Game mode" subtitle={modeName + " · switch or copy to God mode"} trailing="›" onClick={() => onPage("mode")}/>
      <ListRow icon={<Map size={18}/>} title="Example islands" subtitle="Explore finished cities" trailing="›" onClick={onExamples}/>
      <a className="ui-row" href="./handbook.html"><span className="ui-row-icon"><BookOpen size={18}/></span><span className="ui-row-body"><b>Player handbook</b><small>How every system works</small></span><span className="ui-row-trail">›</span></a>
      <a className="ui-row" href="./field-guide.html"><span className="ui-row-icon"><Compass size={18}/></span><span className="ui-row-body"><b>3D field guide</b><small>Every building at every level</small></span><span className="ui-row-trail">›</span></a>
      {state.mode === "god" && <ListRow icon={<FlaskConical size={18}/>} title="God tools" subtitle="Clock · experiments · snapshots · crime" trailing="›" onClick={() => onPage("god")}/>}
      <ListRow icon={<Settings size={18}/>} title="Settings" subtitle="Placement · tap filter · shortcuts" trailing="›" onClick={() => onPage("settings")}/>
      <p className="ui-section-title">Danger zone</p>
      <Button block variant="danger" icon={<RotateCcw size={18}/>} label="Reset this island…" onClick={onReset}/>
    </div>}
    {page === "view" && <>
      {state.mode !== "god" && <p className="ui-muted" style={{marginBottom: 8}}>Weather and time of day run on their own outside God mode.</p>}
      {view}
    </>}
    {page === "god" && godTools}
    {page === "mode" && <div className="ui-modes">
      {MODES.map(m => <button key={m.id} type="button" className="ui-mode" aria-pressed={state.mode === m.id} onClick={() => onChangeMode(m.id)}>
        <b>{m.title}{state.mode === m.id ? " · current" : ""}</b><small>{m.desc}</small></button>)}
      {state.mode !== "god" && <Button block label="Experiment in a God-mode copy" icon={<FlaskConical size={18}/>} onClick={onCopyIsland}/>}
    </div>}
    {page === "settings" && <>
      <Button block label="Undo last building edit" icon={<Undo2 size={18}/>} disabled={!state.constructionHistory?.length} onClick={onUndo}/>
      <p className="ui-section-title">After placing</p>
      <ChipRow label="Placement behaviour">{BEHAVIORS.map(b => <Chip key={b.id} label={b.label} selected={cursorBehavior === b.id} onClick={() => onCursorBehavior(b.id)}/>)}</ChipRow>
      <p className="ui-muted">{BEHAVIORS.find(b => b.id === cursorBehavior)?.hint}</p>
      <p className="ui-section-title">Tapping the map selects</p>
      <ChipRow label="Tap filter">{FILTERS.map(f => <Chip key={f.id} label={f.label} selected={selectionFilter === f.id} onClick={() => onSelectionFilter(f.id)}/>)}</ChipRow>
      <p className="ui-section-title">Keyboard shortcuts</p>
      <div className="ui-keys">{KEYS.map(([k, v]) => <React.Fragment key={k}><kbd>{k}</kbd><span>{v}</span></React.Fragment>)}</div>
    </>}
  </BottomSheet>;
}
