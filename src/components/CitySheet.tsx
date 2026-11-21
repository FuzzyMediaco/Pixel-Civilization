import React from "react";
import { STAGES } from "../game/catalog";
import { taxRateOf } from "../game/cityEconomy";
import { cityIssues, type CityIssue, type IssueFix } from "../game/cityIssues";
import type { GameState, HeatmapKind, PlacedElement } from "../game/simulation";
import { CityEconomyPanel } from "./CityEconomyPanel";
import { CityReport } from "./CityReport";
import { growthLimit } from "./Hud";
import { BottomSheet, Button, ListRow, type SheetHeight, Tabs } from "./ui";

export type CityTab = "issues" | "people" | "money" | "goals";

export function CitySheet({state, tab, onTab, mutate, selected, onFocus, onFix, onShowLayer, onShowPanel, onMaintainAll, height, onHeight, onClose}: {
  state: GameState; tab: CityTab; onTab: (t: CityTab) => void;
  mutate: (fn: (s: GameState) => void) => void; selected?: PlacedElement; onFocus: (id: string) => void;
  onFix: (fix: IssueFix) => void; onShowLayer: (layer: HeatmapKind) => void; onShowPanel: (p: "transit" | "money" | "people") => void;
  onMaintainAll: () => void;
  height: SheetHeight; onHeight: (h: SheetHeight) => void; onClose: () => void;
}) {
  const issues = cityIssues(state);
  const problems = issues.filter(i => i.severity === "critical" || i.severity === "warning");
  const limit = growthLimit(state);
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const next = state.currentStage < 20 ? STAGES[state.currentStage] : undefined;
  const urgent = state.metrics.disrepairCount + state.metrics.burningCount;
  const tax = taxRateOf(state);
  const trailing = (i: CityIssue) => i.repairAll ? <Button small variant="quiet" label="Repair all" onClick={onMaintainAll}/>
    : i.fix ? <Button small variant="quiet" label={i.fix.label + " →"} onClick={() => onFix(i.fix!)}/>
    : i.show && "layer" in i.show ? <Button small variant="quiet" label="Show" onClick={() => onShowLayer((i.show as {layer: HeatmapKind}).layer)}/>
    : i.show && "panel" in i.show ? <Button small variant="quiet" label="Open" onClick={() => onShowPanel((i.show as {panel: "transit" | "money" | "people"}).panel)}/>
    : undefined;

  return <BottomSheet id="sheet-city" title="City" subtitle={state.mode === "god" ? "God mode · all stages open" : "Stage " + stage.stage + " · " + stage.name}
    height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close City">
    <Tabs label="City sections" value={tab} onChange={onTab} items={[
      {id: "issues", label: "Issues", badge: problems.length}, {id: "people", label: "People"}, {id: "money", label: "Money"}, {id: "goals", label: "Goals"},
    ]}/>
    {tab === "issues" && <>
      <div className="ui-list">
        {limit && <ListRow icon="👥" tone={limit.atCap ? "warn" : undefined}
          title={limit.atCap ? "Growth limited by " + limit.need : "Room for " + limit.cap.toLocaleString() + " people"}
          subtitle={state.population.toLocaleString() + " / " + limit.cap.toLocaleString() + " · " + limit.need + " sets the cap"}/>}
        {state.mode === "survival" && urgent > 0 && <ListRow icon="🔧" tone="bad" title={urgent + " buildings need repair"} subtitle="Maintain all and put out fires"
          trailing={<Button small variant="quiet" label="Repair all" onClick={onMaintainAll}/>}/>}
        {issues.filter(i => i.severity !== "good" && i.id !== "growth_limit").map(i => <ListRow key={i.id}
          icon={i.severity === "info" ? "ⓘ" : "⚠"} tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : undefined}
          title={i.title} subtitle={(i.deltaHappiness ? i.deltaHappiness + "% happiness · " : "") + i.fixHint} trailing={trailing(i)}/>)}
        {!problems.length && <ListRow icon="✓" title="No pressing problems" subtitle={issues.find(i => i.severity === "good")?.title ?? "Residents are content."}/>}
      </div>
      {state.mode === "survival" && <label className="ui-row" style={{marginTop: 8}}>
        <input type="checkbox" checked={!!state.autoMaintain} onChange={e => {const on = e.target.checked; mutate(s => {s.autoMaintain = on;});}}/>
        <span className="ui-row-body"><b>Auto-maintain</b><small>Pay 1.25× and repair buildings as they fall due</small></span>
      </label>}
      <p className="ui-section-title">Supply vs demand</p>
      <CityReport state={state} tab="meters"/>
      <p className="ui-section-title">Fire &amp; safety</p>
      <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="safety"/>
    </>}
    {tab === "people" && <>
      <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="population"/>
      <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="happiness"/>
    </>}
    {tab === "money" && <>
      {state.mode !== "god" && <div className="ui-row" style={{display: "block", marginBottom: 8}}>
        <label htmlFor="city-tax" className="ui-row-body"><b>Tax rate · {tax}%</b>
          <small>{tax > 15 ? "Above 15% residents get unhappy and leave sooner" : tax < 15 ? "Below 15% residents are happier; less revenue" : "15% is neutral for happiness"}</small></label>
        <input id="city-tax" type="range" min={5} max={25} step={1} value={tax} style={{width: "100%"}} aria-label="Tax rate"
          onChange={e => {const v = Number(e.target.value); mutate(s => {s.taxRate = v;});}}/>
      </div>}
      <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="wealth"/>
      {state.mode === "god" && <>
        <p className="ui-section-title">Set or hold city values</p>
        <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="controls"/>
      </>}
    </>}
    {tab === "goals" && <>
      {state.mode !== "god" && next && <div className="ui-row" style={{display: "block"}}>
        <b>Next: stage {next.stage} · {next.name}</b>
        <div className="ui-muted">{state.population.toLocaleString()} / {next.minPop.toLocaleString()} people</div>
        <div className="ui-meter"><i style={{width: Math.max(0, Math.min(100, (state.population - stage.minPop) / Math.max(1, next.minPop - stage.minPop) * 100)) + "%"}}/></div>
      </div>}
      <p className="ui-section-title">Stages</p>
      <CityReport state={state} tab="stages"/>
      <p className="ui-section-title">Trends &amp; trophies</p>
      <CityReport state={state} tab="trends"/>
      <details className="ui-row" style={{display: "block", marginTop: 10}}>
        <summary><b>Upgrade &amp; mode rules</b></summary>
        <CityReport state={state} tab="rules"/>
      </details>
    </>}
  </BottomSheet>;
}
