import React, { useState } from "react";
import {
  Briefcase,
  Car,
  Droplets,
  Eye,
  Factory,
  Flame,
  Gem,
  GraduationCap,
  Hammer,
  Network,
  Route,
  Shield,
  Siren,
  Sparkles,
  Trash2,
  Trees,
  Utensils,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { cityIssues, type IssueFix } from "../game/cityIssues";
import { type GameState, type HeatmapKind } from "../game/simulation";
import { BottomSheet, ListRow, type SheetHeight } from "./ui";

type Readout = { value: string; status?: string; bad?: boolean };
const ratio = (supply: number, demand: number, unit = ""): Readout => ({
  value: Math.round(supply).toLocaleString() + " / " + Math.round(demand).toLocaleString() + unit,
  status:
    demand <= 0
      ? "no demand yet"
      : supply >= demand
        ? "surplus " + Math.round(supply - demand).toLocaleString()
        : "short by " + Math.round(demand - supply).toLocaleString(),
  bad: demand > 0 && supply < demand,
});

export const LAYERS: {
  id: Exclude<HeatmapKind, "none">;
  label: string;
  group: "main" | "services" | "networks";
  Icon: typeof Zap;
  legend: [string, string];
  read: (s: GameState) => Readout;
}[] = [
  { id: "power", label: "Power", group: "main", Icon: Zap, legend: ["unpowered", "powered"], read: (s) => ratio(s.metrics.powerSupply, s.metrics.powerDemand) },
  { id: "water", label: "Water", group: "main", Icon: Droplets, legend: ["dry", "supplied"], read: (s) => ratio(s.metrics.waterSupply, s.metrics.waterDemand) },
  { id: "traffic", label: "Traffic", group: "main", Icon: Car, legend: ["congested", "light"], read: (s) => ({ value: (s.metrics.congestion ?? 0) + "% capacity", status: (s.metrics.transitShare ?? 0) + "% transit", bad: (s.metrics.congestion ?? 0) > 100 }) },
  { id: "landvalue", label: "Value", group: "main", Icon: Gem, legend: ["low", "high"], read: (s) => ({ value: "Avg " + (s.metrics.landValueAvg ?? 0.5).toFixed(2), status: "parks & water boost it" }) },
  { id: "pollution", label: "Pollution", group: "main", Icon: Factory, legend: ["dirty", "clean"], read: (s) => ({ value: "Avg " + (s.metrics.pollutionAvg ?? 0).toFixed(1), status: "industry & traffic", bad: (s.metrics.pollutionAvg ?? 0) > 3 }) },
  { id: "food", label: "Food", group: "services", Icon: Utensils, legend: ["missing", "covered"], read: (s) => ratio(s.metrics.foodSupply, s.metrics.foodDemand, " meals") },
  { id: "education", label: "Schools", group: "services", Icon: GraduationCap, legend: ["missing", "covered"], read: (s) => ratio(s.metrics.educationSupply, s.metrics.educationDemand, " seats") },
  { id: "parks", label: "Parks", group: "services", Icon: Trees, legend: ["missing", "covered"], read: (s) => ratio(s.metrics.recreationSupply, s.metrics.recreationDemand) },
  { id: "jobs", label: "Jobs", group: "services", Icon: Briefcase, legend: ["missing", "covered"], read: (s) => ratio(s.metrics.jobsAvailable, s.metrics.jobsNeeded, " jobs") },
  { id: "waste", label: "Waste", group: "services", Icon: Trash2, legend: ["missing", "covered"], read: (s) => ratio(s.metrics.wasteCapacity, s.metrics.wasteDemand) },
  { id: "police", label: "Police", group: "services", Icon: Siren, legend: ["uncovered", "covered"], read: (s) => ({ value: s.metrics.crimeUnlocked ? "Crime " + s.metrics.crimeRate + "%" : s.mode === "god" ? "Crime off" : "Stage 5+", bad: s.metrics.crimeRate > 40 }) },
  { id: "fire", label: "Fire", group: "services", Icon: Flame, legend: ["uncovered", "covered"], read: (s) => ({ value: s.metrics.burningCount + " burning", bad: s.metrics.burningCount > 0 }) },
  { id: "defense", label: "Defense", group: "services", Icon: Shield, legend: ["exposed", "defended"], read: (s) => ({ value: "Readiness " + s.metrics.defenseRating + "%" }) },
  { id: "transit", label: "Routes", group: "networks", Icon: Route, legend: ["obstructed", "on route"], read: (s) => ({ value: (s.mobility?.lines.length ?? 0) + " lines" }) },
  { id: "lanes", label: "Lanes", group: "networks", Icon: Car, legend: ["2 lanes", "6–8 lanes"], read: () => ({ value: "Lane count per road" }) },
  { id: "flow", label: "Flow", group: "networks", Icon: Waves, legend: ["dry", "flowing"], read: (s) => ({ value: Object.keys(s.infrastructure?.conduits ?? {}).length + " segments" }) },
  { id: "clearance", label: "Clearance", group: "networks", Icon: Droplets, legend: ["blocked", "ample room"], read: () => ({ value: "Bridge & ferry clearance" }) },
  { id: "neighbors", label: "Edges", group: "networks", Icon: Trees, legend: ["missing", "linked"], read: () => ({ value: "Shared parcel entrances" }) },
];

export function LayersSheet({
  state,
  active,
  onSelect,
  height,
  onHeight,
  onClose,
  onFix,
}: {
  state: GameState;
  active: HeatmapKind;
  onSelect: (k: HeatmapKind) => void;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
  onFix: (fix: IssueFix) => void;
}) {
  const [group, setGroup] = useState<"services" | "networks" | null>(null);
  const layer = LAYERS.find((l) => l.id === active);
  const read = layer?.read(state);
  const issues = cityIssues(state).filter(
    (i) => i.severity !== "good" && (!layer || ("layer" in (i.show ?? {}) && (i.show as { layer: HeatmapKind }).layer === layer.id)),
  );

  return (
    <BottomSheet
      id="sheet-layers"
      title={layer ? layer.label : "Layers"}
      subtitle={read ? read.value + (read.status ? " · " + read.status : "") : "Coverage overlays"}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close Layers"
      dock={
        <div className="ui-sheet-dock">
          <div className="ui-icon-strip" role="group" aria-label="Map layers">
            {active !== "none" && (
              <button
                type="button"
                className="ui-layer-pill is-clear"
                title="Clear active layer"
                aria-label="Clear active layer"
                onClick={() => onSelect("none")}
              >
                <X size={14} />
              </button>
            )}
            {LAYERS.filter((l) => l.group === "main" || l.id === active).map((l) => (
              <button
                key={l.id}
                type="button"
                className={"ui-layer-pill" + (active === l.id ? " is-active" : "")}
                aria-pressed={active === l.id}
                title={l.label}
                onClick={() => onSelect(active === l.id ? "none" : l.id)}
              >
                <l.Icon size={14} aria-hidden="true" />
                <span>{l.label}</span>
              </button>
            ))}
            <button
              type="button"
              className={"ui-layer-pill" + (group === "services" ? " is-active" : "")}
              aria-pressed={group === "services"}
              title="Service layers"
              onClick={() => setGroup(group === "services" ? null : "services")}
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>Services</span>
            </button>
            <button
              type="button"
              className={"ui-layer-pill" + (group === "networks" ? " is-active" : "")}
              aria-pressed={group === "networks"}
              title="Network layers"
              onClick={() => setGroup(group === "networks" ? null : "networks")}
            >
              <Network size={14} aria-hidden="true" />
              <span>Networks</span>
            </button>
          </div>
          {group && (
            <div className="ui-icon-strip" role="group" aria-label={group === "services" ? "Service layers" : "Network layers"}>
              {LAYERS.filter((l) => l.group === group && l.id !== active).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="ui-layer-pill"
                  title={l.label}
                  onClick={() => {
                    onSelect(l.id);
                    setGroup(null);
                  }}
                >
                  <l.Icon size={14} aria-hidden="true" />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
          {layer && (
            <div className="ui-legend-card">
              <div className="ui-legend" aria-hidden="true" />
              <div className="ui-legend-labels">
                <span>{layer.legend[0]}</span>
                <span>{layer.legend[1]}</span>
              </div>
            </div>
          )}
        </div>
      }
    >
      {issues.length > 0 && (
        <div className="ui-list">
          {issues.slice(0, 6).map((i) => {
            const showLayer = i.show && "layer" in i.show ? i.show.layer : undefined;
            return (
              <ListRow
                key={i.id}
                icon="⚠"
                tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : undefined}
                title={i.title}
                subtitle={(i.deltaHappiness ? i.deltaHappiness + "% · " : "") + i.fixHint}
                trailing={
                  i.fix ? (
                    <button
                      type="button"
                      className="ui-row-action-icon"
                      aria-label={i.fix.label}
                      title={i.fix.label}
                      onClick={() => onFix(i.fix!)}
                    >
                      <Hammer size={14} />
                    </button>
                  ) : showLayer && showLayer !== active ? (
                    <button
                      type="button"
                      className="ui-row-action-icon"
                      aria-label="Show layer"
                      title="Show layer"
                      onClick={() => onSelect(showLayer)}
                    >
                      <Eye size={14} />
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
