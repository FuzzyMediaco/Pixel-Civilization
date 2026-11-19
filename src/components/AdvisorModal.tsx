import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Layers, Trophy, X } from "lucide-react";
import { ELEMENTS, STAGES } from "../game/catalog";
import { type GameState } from "../game/simulation";

interface AdvisorModalProps {
  state: GameState;
  open: boolean;
  onClose: () => void;
}

export const AdvisorModal: React.FC<AdvisorModalProps> = ({ state, open, onClose }) => {
  const [tab, setTab] = useState<"needs" | "stages" | "rules">("needs");
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;

  const m = state.metrics;

  const meters = [
    { label: "Power Grid", supply: m.powerSupply, demand: m.powerDemand },
    { label: "Clean Water", supply: m.waterSupply, demand: m.waterDemand },
    { label: "Garbage Capacity", supply: m.wasteCapacity, demand: m.wasteDemand },
    { label: "Jobs & Workplaces", supply: m.jobsAvailable, demand: m.jobsNeeded },
    { label: "Food & Groceries", supply: m.foodSupply, demand: m.foodDemand },
    { label: "Schools & Education", supply: m.educationSupply, demand: m.educationDemand },
    { label: "Parks & Leisure", supply: m.recreationSupply, demand: m.recreationDemand },
    ...(m.govDemand > 0
      ? [{ label: "Government Services (Stage 3+)", supply: m.govSupply, demand: m.govDemand }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/60 p-4">
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-stone-900/20 bg-[#fcfaf5] shadow-2xl transition-all ${
          expanded ? "max-h-[92vh] max-w-5xl" : "max-h-[72vh] max-w-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-extrabold text-stone-900">
              Island Civilization Report
            </h2>
            <p className="text-xs font-medium text-stone-500">
              {ELEMENTS.length} Base Elements · 5 Levels · 4 Visual Variants (
              {(ELEMENTS.length * 5 * 4).toLocaleString()} Unique Pixel Creations)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
              title={expanded ? "Compact Modal" : "Expand Modal"}
              aria-label={expanded ? "Compact Modal" : "Expand Modal"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 border-b border-stone-200 bg-stone-100/80 px-3 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => setTab("needs")}
            className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold ${
              tab === "needs"
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
            }`}
          >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Needs</span>
            <span className="hidden sm:inline">City Needs & Missing</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("stages")}
            className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold ${
              tab === "stages"
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">20 Stages</span>
            <span className="hidden sm:inline">All 20 Stages</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("rules")}
            className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold ${
              tab === "rules"
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Rules</span>
            <span className="hidden sm:inline">Merging & Mode Rules</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "needs" && (
            <div className="space-y-5">
              {/* Diagnostics */}
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-stone-800">
                  Advisor Diagnostics ({state.happiness}% Happiness)
                </h3>
                {state.diagnostics.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      d.severity === "critical"
                        ? "border-rose-300 bg-rose-50"
                        : d.severity === "warning"
                          ? "border-amber-300 bg-amber-50"
                          : d.severity === "good"
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-stone-200 bg-white"
                    }`}
                  >
                    {d.severity === "good" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    ) : d.severity === "info" ? (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                    ) : (
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          d.severity === "critical" ? "text-rose-700" : "text-amber-700"
                        }`}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stone-900">{d.title}</span>
                        {d.deltaHappiness !== undefined && (
                          <span className="font-mono-num text-xs font-bold text-rose-700">
                            {d.deltaHappiness}% Happiness
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-700">{d.detail}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-900">
                        Fix: {d.fixHint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Supply vs Demand Meters */}
              {state.mode !== "god" && (
                <div>
                  <h3 className="font-display mb-2.5 text-sm font-bold text-stone-800">
                    Service Supply vs Citizen Demand
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {meters.map((row) => {
                      const ok = row.supply >= row.demand;
                      const pct =
                        row.demand === 0
                          ? 100
                          : Math.min(100, Math.round((row.supply / row.demand) * 100));
                      return (
                        <div
                          key={row.label}
                          className="rounded-lg border border-stone-200 bg-white p-2.5"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-stone-700">{row.label}</span>
                            <span
                              className={`font-mono-num font-bold ${
                                ok ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {row.supply} / {row.demand}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-xs bg-stone-200">
                            <div
                              className={`h-full ${ok ? "bg-emerald-600" : "bg-rose-600"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Defense Roster & Readiness Breakdown */}
              {(m.defenseUnlocked || m.totalDefenders > 0) && (
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-stone-800">
                      Island Defense Readiness ({m.defenseRating}%)
                    </h3>
                    <span className="font-mono-num text-xs font-bold text-stone-600">
                      Power {m.defensePower} / Target {m.requiredDefensePower}
                      {state.mode !== "god" && state.currentStage >= 10
                        ? ` · Stage Raid Sev ${m.stageAttackSeverity.toFixed(1)}`
                        : ""}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-emerald-900">
                        {m.soldiersCount}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">Soldiers</div>
                    </div>
                    <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-emerald-900">
                        {m.tanksCount}
                      </div>
                      <div className="text-[10px] font-bold text-emerald-700">Tanks</div>
                    </div>
                    <div className="rounded border border-sky-200 bg-sky-50/70 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-sky-900">
                        {m.navalBoatsCount}
                      </div>
                      <div className="text-[10px] font-bold text-sky-700">Patrol Boats</div>
                    </div>
                    <div className="rounded border border-blue-200 bg-blue-50/60 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-blue-900">
                        {m.copsCount}
                      </div>
                      <div className="text-[10px] font-bold text-blue-700">Police</div>
                    </div>
                    <div className="rounded border border-indigo-200 bg-indigo-50/60 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-indigo-900">
                        {m.swatCount}
                      </div>
                      <div className="text-[10px] font-bold text-indigo-700">SWAT</div>
                    </div>
                    <div className="rounded border border-stone-200 bg-stone-50 p-2 text-center">
                      <div className="font-mono-num text-sm font-extrabold text-stone-900">
                        {m.totalDefenders}
                      </div>
                      <div className="text-[10px] font-bold text-stone-600">Total Force</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-stone-500">
                    Army & naval bases generate the majority of island defense power; police and SWAT respond alongside defenders with light tactical support.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "stages" && (
            <div className="space-y-2">
              {STAGES.map((st) => {
                const reached = state.highestStageReached >= st.stage || state.mode === "god";
                const items = ELEMENTS.filter((e) =>
                  st.stage === 1 ? e.isStarter : e.stage === st.stage,
                );
                return (
                  <div
                    key={st.stage}
                    className={`rounded-lg border p-3 ${
                      reached
                        ? "border-emerald-300 bg-white"
                        : "border-stone-200 bg-stone-100/70 opacity-75"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono-num rounded px-2 py-0.5 text-xs font-extrabold ${
                            reached ? "bg-emerald-700 text-white" : "bg-stone-300 text-stone-700"
                          }`}
                        >
                          Stage {st.stage}
                        </span>
                        <span className="font-display text-sm font-bold text-stone-900">
                          {st.name}
                        </span>
                      </div>
                      <span className="font-mono-num text-xs font-bold text-stone-600">
                        {st.minPop.toLocaleString()} population
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600">{st.note}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {items.map((it) => (
                        <span
                          key={it.id}
                          className="rounded-xs border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] font-medium text-stone-700"
                        >
                          {it.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "rules" && (
            <div className="space-y-4 text-xs leading-relaxed text-stone-700">
              <div className="rounded-lg border border-stone-200 bg-white p-3.5">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Manual Merging & 5 Levels × 4 Visual Variants
                </h4>
                <p className="mt-1">
                  Every newly placed element starts at <strong>Level 1</strong> and randomly selects{" "}
                  <strong>1 of 4 visual variants</strong>. Place two matching elements of the same
                  level right next to each other, select the first, click{" "}
                  <strong>Select Twin to Merge</strong> (or hold <strong>Shift+Click</strong>), and
                  press <strong>Merge</strong>!
                </p>
                <p className="mt-1.5">
                  Merged buildings grow horizontally up to <strong>Level 4–5 (3×3 max)</strong>,
                  adding richer architectural tiers, spires, and rooftop details at every upgrade.
                  Roads, paths, bridges, and train tracks keep their 1×1 lane tiles when upgraded or
                  merged.
                </p>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3.5">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Auto-Generated Cars, Trains & Pixel Villagers
                </h4>
                <p className="mt-1">
                  You never need to manually place cars or people. As soon as you connect buildings
                  with Roads or Train Tracks, pixel villagers, sedans, sports cars, Mini Coopers,
                  Cybertrucks, delivery trucks, buses, taxis, and trains automatically bring your
                  island to life!
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="font-display font-bold text-stone-900">God Mode</div>
                  <p className="mt-1">
                    Infinite money, all 148+ elements unlocked, place or switch any Level (1–5) or
                    Visual Variant (1–4) at will, and toggle Crime simulation ON or OFF anytime.
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="font-display font-bold text-stone-900">Real Mode</div>
                  <p className="mt-1">
                    Begin at Stage 1: Village with 10 core starters. Link homes to jobs & utilities
                    via roads, keep Happiness above 65%, manage Crime & Police (Stage 5+) and
                    Defense (Stage 10+), and progress through all 20 Stages.
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="font-display font-bold text-stone-900">Survival Mode</div>
                  <p className="mt-1">
                    Dropping below your current stage's population benchmark (Stage 2+) is{" "}
                    <strong>Game Over</strong>. Service buildings require maintenance every 5 active
                    minutes, happiness below 50% sparks fires, and Stage 10+ brings border raids!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
