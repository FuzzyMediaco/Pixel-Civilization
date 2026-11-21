import React, { useState } from "react";
import { Briefcase, ChevronDown, Car, Droplets, Factory, Flame, Gem, GraduationCap, Route, Shield, Siren, Trash2, Trees, Utensils, Waves, Zap } from "lucide-react";
import { cityIssues, type IssueFix } from "../game/cityIssues";
import { type GameState, type HeatmapKind } from "../game/simulation";
import { BottomSheet, Button, Chip, ChipRow, ListRow, type SheetHeight } from "./ui";

type Readout = {value: string; status?: string; bad?: boolean};
const ratio = (supply: number, demand: number, unit = ""): Readout => ({
  value: Math.round(supply).toLocaleString() + " / " + Math.round(demand).toLocaleString() + unit,
  status: demand <= 0 ? "no demand yet" : supply >= demand ? "surplus " + Math.round(supply - demand).toLocaleString() : "short by " + Math.round(demand - supply).toLocaleString(),
  bad: demand > 0 && supply < demand,
});

export const LAYERS: {id: Exclude<HeatmapKind, "none">; label: string; group: "main" | "services" | "networks"; Icon: typeof Zap;
  legend: [string, string]; read: (s: GameState) => Readout}[] = [
  {id: "power", label: "Power", group: "main", Icon: Zap, legend: ["unpowered", "powered"], read: s => ratio(s.metrics.powerSupply, s.metrics.powerDemand)},
  {id: "water", label: "Water", group: "main", Icon: Droplets, legend: ["dry", "supplied"], read: s => ratio(s.metrics.waterSupply, s.metrics.waterDemand)},
  {id: "traffic", label: "Traffic", group: "main", Icon: Car, legend: ["congested", "light"], read: s => ({value: (s.metrics.congestion ?? 0) + "% of road capacity", status: (s.metrics.transitShare ?? 0) + "% ride transit", bad: (s.metrics.congestion ?? 0) > 100})},
  {id: "landvalue", label: "Land value", group: "main", Icon: Gem, legend: ["low", "high"], read: s => ({value: "Average " + (s.metrics.landValueAvg ?? 0.5).toFixed(2), status: "parks and water raise it"})},
  {id: "pollution", label: "Pollution", group: "main", Icon: Factory, legend: ["dirty", "clean"], read: s => ({value: "Average " + (s.metrics.pollutionAvg ?? 0).toFixed(1), status: "industry and traffic add it", bad: (s.metrics.pollutionAvg ?? 0) > 3})},
  {id: "food", label: "Food", group: "services", Icon: Utensils, legend: ["missing", "covered"], read: s => ratio(s.metrics.foodSupply, s.metrics.foodDemand, " meals")},
  {id: "education", label: "Schools", group: "services", Icon: GraduationCap, legend: ["missing", "covered"], read: s => ratio(s.metrics.educationSupply, s.metrics.educationDemand, " seats")},
  {id: "parks", label: "Parks", group: "services", Icon: Trees, legend: ["missing", "covered"], read: s => ratio(s.metrics.recreationSupply, s.metrics.recreationDemand)},
  {id: "jobs", label: "Jobs", group: "services", Icon: Briefcase, legend: ["missing", "covered"], read: s => ratio(s.metrics.jobsAvailable, s.metrics.jobsNeeded, " jobs")},
  {id: "waste", label: "Waste", group: "services", Icon: Trash2, legend: ["missing", "covered"], read: s => ratio(s.metrics.wasteCapacity, s.metrics.wasteDemand)},
  {id: "police", label: "Police", group: "services", Icon: Siren, legend: ["uncovered", "covered"], read: s => ({value: s.metrics.crimeUnlocked ? "Crime " + s.metrics.crimeRate + "%" : s.mode === "god" ? "Crime is off" : "Crime starts at stage 5", bad: s.metrics.crimeRate > 40})},
  {id: "fire", label: "Fire", group: "services", Icon: Flame, legend: ["uncovered", "covered"], read: s => ({value: s.metrics.burningCount + " burning", bad: s.metrics.burningCount > 0})},
  {id: "defense", label: "Defense", group: "services", Icon: Shield, legend: ["exposed", "defended"], read: s => ({value: "Readiness " + s.metrics.defenseRating + "%"})},
  {id: "transit", label: "Passenger routes", group: "networks", Icon: Route, legend: ["obstructed", "on route"], read: s => ({value: (s.mobility?.lines.length ?? 0) + " services"})},
  {id: "lanes", label: "Road lanes", group: "networks", Icon: Car, legend: ["2 lanes", "6–8 lanes"], read: () => ({value: "Lane count per road"})},
  {id: "flow", label: "Aqueduct flow", group: "networks", Icon: Waves, legend: ["dry", "flowing"], read: s => ({value: Object.keys(s.infrastructure?.conduits ?? {}).length + " segments"})},
  {id: "clearance", label: "Ferry clearance", group: "networks", Icon: Droplets, legend: ["blocked", "ample room"], read: () => ({value: "Draft, beam and height under crossings"})},
  {id: "neighbors", label: "Shared edges", group: "networks", Icon: Trees, legend: ["missing", "linked"], read: () => ({value: "Linked parcel entrances"})},
];

export function LayersSheet({state, active, onSelect, height, onHeight, onClose, onFix}: {
  state: GameState; active: HeatmapKind; onSelect: (k: HeatmapKind) => void;
  height: SheetHeight; onHeight: (h: SheetHeight) => void; onClose: () => void; onFix: (fix: IssueFix) => void;
}) {
  const [group, setGroup] = useState<"services" | "networks" | null>(null);
  const layer = LAYERS.find(l => l.id === active);
  const read = layer?.read(state);
  const issues = cityIssues(state).filter(i => i.severity !== "good" && (!layer || ("layer" in (i.show ?? {}) && (i.show as {layer: HeatmapKind}).layer === layer.id)));
  return <BottomSheet id="sheet-layers" title={layer ? layer.label : "Layers"} subtitle={read ? read.value + (read.status ? " · " + read.status : "") : "Tint the map to see coverage"}
    height={height} onHeightChange={onHeight} onClose={onClose} closeLabel="Close Layers">
    <ChipRow label="Map layers">
      {LAYERS.filter(l => l.group === "main" || l.id === active).map(l => <Chip key={l.id} label={l.label} icon={<l.Icon size={15}/>} selected={active === l.id} onClick={() => onSelect(active === l.id ? "none" : l.id)}/>)}
      <Chip label="Services" icon={<ChevronDown size={15}/>} selected={group === "services"} onClick={() => setGroup(group === "services" ? null : "services")}/>
      <Chip label="Networks" icon={<ChevronDown size={15}/>} selected={group === "networks"} onClick={() => setGroup(group === "networks" ? null : "networks")}/>
    </ChipRow>
    {group && <ChipRow label={group === "services" ? "Service layers" : "Network layers"}>
      {LAYERS.filter(l => l.group === group && l.id !== active).map(l => <Chip key={l.id} label={l.label} icon={<l.Icon size={15}/>} onClick={() => {onSelect(l.id); setGroup(null);}}/>)}
    </ChipRow>}
    {layer && <>
      <div className="ui-legend" aria-hidden="true"/>
      <div className="ui-legend-labels"><span>{layer.legend[0]}</span><span>{layer.legend[1]}</span></div>
    </>}
    {issues.length > 0 && <p className="ui-section-title">{layer ? "What's wrong here" : "Problems to look at"}</p>}
    <div className="ui-list">
      {issues.slice(0, 6).map(i => {
        const showLayer = i.show && "layer" in i.show ? i.show.layer : undefined;
        return <ListRow key={i.id} icon="⚠" tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : undefined}
          title={i.title} subtitle={(i.deltaHappiness ? i.deltaHappiness + "% happiness · " : "") + i.fixHint}
          trailing={i.fix ? <Button small variant="quiet" label={i.fix.label + " →"} onClick={() => onFix(i.fix!)}/>
            : showLayer && showLayer !== active ? <Button small variant="quiet" label="Show" onClick={() => onSelect(showLayer)}/> : undefined}/>;
      })}
    </div>
    {active !== "none" && <Button block label="Clear layer" onClick={() => onSelect("none")} style={{marginTop: 10}}/>}
  </BottomSheet>;
}
