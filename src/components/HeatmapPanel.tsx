import React, { useState } from "react";
import {
  Briefcase,
  Car,
  ChevronDown,
  Factory,
  Gem,
  ChevronUp,
  Droplets,
  Flame,
  GraduationCap,
  Shield,
  Siren,
  Trash2,
  Trees,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { type GameState, type HeatmapKind } from "../game/simulation";

interface HeatmapPanelProps {
  open: boolean;
  activeHeatmap: HeatmapKind;
  state: GameState;
  onSelectHeatmap: (kind: HeatmapKind) => void;
  onClose: () => void;
}

const HEATMAP_OPTIONS: {
  id: HeatmapKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getSummary: (s: GameState) => string;
}[] = [
  {id:"transit",label:"Passenger routes",icon:Car,getSummary:s=>(s.mobility?.lines.length??0)+" services"},
  {id:"neighbors",label:"Shared edges",icon:Trees,getSummary:()=>"Linked parcel entrances"},
  {id:"flow",label:"Aqueduct flow",icon:Droplets,getSummary:s=>Object.keys(s.infrastructure?.conduits??{}).length+" segments"},
  {id:"clearance",label:"Ferry clearance",icon:Droplets,getSummary:()=>"Ferry draft, beam & height"},
  {id:"lanes",label:"Road lanes",icon:Car,getSummary:()=>"2 to 8 lanes"},
  {
    id: "landvalue",
    label: "Land Value",
    icon: Gem,
    getSummary: (s) => `avg ${(s.metrics.landValueAvg ?? 0.5).toFixed(2)}`,
  },
  {
    id: "pollution",
    label: "Pollution",
    icon: Factory,
    getSummary: (s) => `avg ${(s.metrics.pollutionAvg ?? 0).toFixed(1)}`,
  },
  {
    id: "traffic",
    label: "Traffic",
    icon: Car,
    getSummary: (s) => `${s.metrics.congestion ?? 0}%`,
  },
  {
    id: "water",
    label: "Water",
    icon: Droplets,
    getSummary: (s) => `${s.metrics.waterSupply}/${s.metrics.waterDemand}`,
  },
  {
    id: "power",
    label: "Power",
    icon: Zap,
    getSummary: (s) => `${s.metrics.powerSupply}/${s.metrics.powerDemand}`,
  },
  {
    id: "jobs",
    label: "Work",
    icon: Briefcase,
    getSummary: (s) => `${s.metrics.jobsAvailable}/${s.metrics.jobsNeeded}`,
  },
  {
    id: "waste",
    label: "Waste",
    icon: Trash2,
    getSummary: (s) => `${s.metrics.wasteCapacity}/${s.metrics.wasteDemand}`,
  },
  {
    id: "food",
    label: "Food",
    icon: Utensils,
    getSummary: (s) => `${s.metrics.foodSupply}/${s.metrics.foodDemand}`,
  },
  {
    id: "education",
    label: "School",
    icon: GraduationCap,
    getSummary: (s) => `${s.metrics.educationSupply}/${s.metrics.educationDemand}`,
  },
  {
    id: "parks",
    label: "Parks",
    icon: Trees,
    getSummary: (s) => `${s.metrics.recreationSupply}/${s.metrics.recreationDemand}`,
  },
  {
    id: "police",
    label: "Police",
    icon: Siren,
    getSummary: (s) =>
      s.metrics.crimeUnlocked
        ? `${s.metrics.crimeRate}%`
        : s.mode === "god"
          ? "Off"
          : "S5+",
  },
  {
    id: "fire",
    label: "Fire",
    icon: Flame,
    getSummary: (s) => `${s.metrics.burningCount} Fire`,
  },
  {
    id: "defense",
    label: "Defense",
    icon: Shield,
    getSummary: (s) => `${s.metrics.defenseRating}%`,
  },
];

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  open,
  activeHeatmap,
  state,
  onSelectHeatmap,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;
  const legend=activeHeatmap==="clearance"?["Ample room","Close fit","Blocked"]:activeHeatmap==="lanes"?["6–8 lanes","4 lanes","2 lanes"]:activeHeatmap==="flow"?["Flowing","Low flow","Dry"]:activeHeatmap==="transit"?["Vehicle route","Limited","Obstruction"]:["Good","Edge","Missing"];

  return (
    <aside id="island-panel-layers" aria-label="Map layers"
      className={`map-drawer pointer-events-auto fixed right-13 top-14 z-30 max-w-[calc(100vw-4.5rem)] overflow-y-auto rounded-xl border border-stone-900/20 bg-[#fcfaf5]/96 p-2.5 shadow-2xl transition-all ${
        expanded ? "max-h-[calc(100vh-8rem)] w-80 sm:w-96" : "max-h-[46vh] w-64"
      }`}
    >
      <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
        <div>
          <h3 className="font-display text-xs font-extrabold text-stone-900">
            Civilization Heat Maps
          </h3>
          <p className="text-[10px] text-stone-500">Tap any layer to inspect coverage</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md border border-stone-300 bg-white p-1 text-stone-600 hover:bg-stone-100"
            title={expanded ? "Compact Panel" : "Expand Panel"}
            aria-label={expanded ? "Compact Panel" : "Expand Panel"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 bg-white p-1 text-stone-600 hover:bg-stone-100"
            title="Close Heat Maps"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1">
        {HEATMAP_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = activeHeatmap === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectHeatmap(active ? "none" : opt.id)}
              className={`flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition-colors ${
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <Icon className={`h-3 w-3 shrink-0 ${active ? "text-amber-300" : "text-stone-600"}`} />
                <span
                  className={`font-mono-num truncate text-[9px] font-bold ${
                    active ? "text-emerald-300" : "text-stone-500"
                  }`}
                >
                  {opt.getSummary(state)}
                </span>
              </div>
              <span className="mt-0.5 text-[11px] font-bold leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Compact Legend */}
      <div className="mt-2 rounded-md border border-stone-200 bg-white p-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-stone-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-emerald-500" />
            {legend[0]}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-amber-500" />
            {legend[1]}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-rose-500" />
            {legend[2]}
          </span>
        </div>
        {activeHeatmap !== "none" && (
          <button
            type="button"
            onClick={() => onSelectHeatmap("none")}
            className="mt-1.5 w-full rounded border border-stone-300 bg-stone-100 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-200"
          >
            Clear Heat Map
          </button>
        )}
      </div>
    </aside>
  );
};
