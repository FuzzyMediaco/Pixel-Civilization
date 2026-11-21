import React, { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Flame, MoreHorizontal, Move, RotateCw, Shuffle, Trash2, TrainFront, Wrench } from "lucide-react";
import { type CivElementDef, getElementLevelName, getMaxElementLevel, getStandardFootprintForLevel } from "../game/catalog";
import { SYNERGY_RULES } from "../game/cityDynamics";
import { buildingCharges, upgradeReadiness } from "../game/cityEconomy";
import { alertIssues, type IssueFix } from "../game/cityIssues";
import { type GameState, type HeatmapKind, MAINTENANCE_INTERVAL_SEC, type PlacedElement, placedUpgradeCost } from "../game/simulation";
import { BottomSheet, Button, IconButton, InspectorCard, ListRow, type SheetHeight, Tabs, Tag } from "./ui";

export const RAIL_SITES = ["train_depots", "train_stops", "freight_rail_terminal"];
type InspectorTab = "needs" | "links" | "info" | "trains";

export function InspectorSheet({state, el, def, height, onHeight, onClose, onUpgrade, onLevelDown, onMove, onRotate, onVariant, onMaintain, onDemolish, onRailOps, onFix, onShowLayer, links, info}: {
  state: GameState; el: PlacedElement; def: CivElementDef;
  height: SheetHeight; onHeight: (h: SheetHeight) => void; onClose: () => void;
  onUpgrade: () => void; onLevelDown: () => void; onMove: () => void; onRotate: () => void; onVariant: () => void;
  onMaintain: () => void; onDemolish: () => void; onRailOps: () => void;
  onFix: (fix: IssueFix) => void; onShowLayer: (layer: HeatmapKind) => void;
  links: React.ReactNode; info: React.ReactNode;
}) {
  const [tab, setTab] = useState<InspectorTab>("needs");
  const [menu, setMenu] = useState(false);
  const god = state.mode === "god";
  const max = getMaxElementLevel(el.defId);
  const atMax = el.level >= max;
  const charges = buildingCharges(state);
  const cost = atMax ? 0 : placedUpgradeCost(state, el);
  const ready = upgradeReadiness(state, el);
  const short = charges && !atMax && state.money < cost;
  const blocked = !atMax && (short || !ready.ready);
  const levelName = getElementLevelName(def, el.level);
  const next = atMax ? undefined : getElementLevelName(def, el.level + 1);
  const nextSize = !atMax && !def.isNetwork ? " (" + getStandardFootprintForLevel(def, el.level + 1).join("×") + ")" : "";
  const isRail = RAIL_SITES.includes(def.id);
  const building = !def.isNetwork && !def.passiveNature;
  const lv = el.landValue ?? 0.5;
  const needsMaint = state.mode === "survival" && def.needsMaintenance;
  const cityNeeds = alertIssues(state).filter(i => i.fix).slice(0, 3);

  const tabs: {id: InspectorTab; label: string}[] = [
    {id: "needs", label: "Needs"}, {id: "links", label: "Links"}, {id: "info", label: "Info"},
    ...(isRail ? [{id: "trains" as const, label: "Trains"}] : []),
  ];

  return <BottomSheet id="sheet-inspector" context height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close inspector"
    title={def.name}
    header={<InspectorCard def={def} title={def.name + " · Lv " + el.level}
      subtitle={"“" + levelName + "”" + (next ? " → Lv " + (el.level + 1) + " “" + next + "”" + nextSize : " · top level")}/>}>
    <div className="ui-tags" aria-label="Status">
      {building && !god && <Tag tone={el.connected ? "good" : "bad"}>{el.connected ? "Road ✓" : "No road"}</Tag>}
      {el.awaitingStreet && <Tag tone="warn">Needs a street</Tag>}
      {el.onFire && <Tag tone="bad" icon={<Flame size={13}/>}>On fire</Tag>}
      {el.disrepair && <Tag tone="bad">Disrepair</Tag>}
      {needsMaint && !el.disrepair && <Tag tone="warn">Service in {Math.max(0, Math.ceil(MAINTENANCE_INTERVAL_SEC - el.maintTimerSec))}s</Tag>}
      {building && el.landValue !== undefined && <Tag tone={lv >= 1 ? "good" : lv < 0.45 ? "bad" : "info"} title="Parks, water and landmarks raise land value; pollution lowers it">Land value {lv.toFixed(2)}</Tag>}
      {(el.pollution ?? 0) > 1 && <Tag tone="bad">Pollution {(el.pollution ?? 0).toFixed(1)}</Tag>}
      {(el.synergies?.length ?? 0) > 0 && <Tag tone="info" title={(el.synergies ?? []).map(id => SYNERGY_RULES.find(r => r.id === id)?.label ?? id).join(", ")}>
        +{Math.min(4, el.synergies!.length) * 12}% neighbours</Tag>}
    </div>

    <div className="ui-actions" style={{position: "relative"}}>
      {el.onFire
        ? <Button variant="primary" icon={<Flame size={18}/>} label="Send fire crew" onClick={onMaintain}/>
        : <Button variant="primary" icon={<ArrowUp size={18}/>} disabled={atMax || (blocked && !god)} onClick={onUpgrade}
          label={atMax ? "Top level" : god || !charges ? "Upgrade to Lv " + (el.level + 1) : "Upgrade · $" + cost.toLocaleString()}/>}
      {needsMaint && !el.onFire && <Button icon={<Wrench size={18}/>} label="Repair" onClick={onMaintain}/>}
      {god && <Button icon={<Move size={18}/>} label="Move" onClick={onMove}/>}
      {god && !def.isNetwork && <IconButton aria-label="Rotate 90°" icon={<RotateCw size={18}/>} onClick={onRotate}/>}
      <IconButton aria-label="More actions" aria-expanded={menu} icon={<MoreHorizontal size={20}/>} onClick={() => setMenu(m => !m)}/>
      {menu && <div className="ui-menu" role="menu" style={{top: "100%"}} onClick={() => setMenu(false)}>
        {god && <Button role="menuitem" icon={<Shuffle size={18}/>} label="Next style" onClick={onVariant}/>}
        {god && <Button role="menuitem" icon={<ArrowDown size={18}/>} label="Level down" disabled={el.level <= 1} onClick={onLevelDown}/>}
        <a className="ui-btn" role="menuitem" href={`./field-guide.html?id=${def.id}&level=${el.level}&variant=${el.variant + 1}`} target="_blank" rel="noreferrer">
          <BookOpen size={18} aria-hidden="true"/><span>Field guide</span></a>
        <Button role="menuitem" variant="danger" icon={<Trash2 size={18}/>} label="Demolish…" onClick={onDemolish}/>
      </div>}
    </div>
    {!atMax && blocked && <p className="ui-upgrade-note">{short ? "Need $" + cost.toLocaleString() + " to upgrade. " : ""}{ready.reasons.join(" ")}</p>}

    <Tabs label="Building details" items={tabs} value={tab} onChange={setTab}/>
    {tab === "needs" && <div className="ui-list">
      {!atMax && building && ready.goal > 0 && <ListRow icon="⬆" tone={ready.value >= ready.goal ? undefined : "warn"}
        title={"To reach Lv " + (el.level + 1) + ": " + ready.label}
        subtitle={Math.floor(ready.value) + " / " + ready.goal + (ready.value >= ready.goal ? " · ready" : "")}/>}
      {building && !god && !el.connected && <ListRow icon="🛣" tone="bad" title="Not connected" subtitle="Join the front entrance to a road"
        trailing={<Button small variant="quiet" label="Fix →" onClick={() => onFix({label: "Build roads", category: "roads_transit"})}/>}/>}
      {building && !el.hasFireCover && <ListRow icon="🚒" title="No fire cover" subtitle="Fires here spread unchecked"
        trailing={<Button small variant="quiet" label="Show" onClick={() => onShowLayer("fire")}/>}/>}
      {building && state.metrics.crimeUnlocked && !el.hasPoliceCover && <ListRow icon="🚓" title="No police cover" subtitle="Raises crime nearby"
        trailing={<Button small variant="quiet" label="Show" onClick={() => onShowLayer("police")}/>}/>}
      {el.nuisancePenalty > 0 && <ListRow icon="🔊" tone="warn" title="Noisy neighbours" subtitle={"−" + Math.round(el.nuisancePenalty) + "% here"}
        trailing={<Button small variant="quiet" label="Show" onClick={() => onShowLayer("pollution")}/>}/>}
      {cityNeeds.map(i => <ListRow key={i.id} icon="⚠" tone={i.severity === "critical" ? "bad" : "warn"} title={i.title} subtitle={"City-wide" + (i.deltaHappiness ? " · " + i.deltaHappiness + "% happiness" : "")}
        trailing={<Button small variant="quiet" label="Fix →" onClick={() => onFix(i.fix!)}/>}/>)}
      {(el.synergies ?? []).map(id => {const r = SYNERGY_RULES.find(x => x.id === id); return r && <ListRow key={id} icon={r.emoji ?? "✨"} title={r.label} subtitle="Neighbour bonus"/>;})}
      {building && el.connected && !cityNeeds.length && !el.nuisancePenalty && <p className="ui-muted">Nothing missing. {atMax ? "" : "Upgrade when the requirement above is met."}</p>}
    </div>}
    {tab === "links" && links}
    {tab === "info" && info}
    {tab === "trains" && <div className="ui-list">
      <ListRow icon={<TrainFront size={18}/>} title="Rail Operations" subtitle="Lines, trains, cars and cargo for this site" onClick={onRailOps} trailing="Open →"/>
    </div>}
  </BottomSheet>;
}
