import { GameDialog } from "./GameDialog";
import React, { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Layers, Trophy, X } from "lucide-react";
import { ELEMENTS, STAGES } from "../game/catalog";
import { ACHIEVEMENTS, SYNERGY_RULES } from "../game/cityDynamics";
import { CITY_GRANTS, grantProgress } from "../game/cityGrants";
import { type GameState, type HistorySample } from "../game/simulation";

const Sparkline: React.FC<{ data: HistorySample[]; pick: (h: HistorySample) => number; color: string; label: string; fmt: (n: number) => string }> = ({
  data,
  pick,
  color,
  label,
  fmt,
}) => {
  const w = 220;
  const h = 46;
  const vals = data.map(pick);
  const last = vals.length ? vals[vals.length - 1] : 0;
  const first = vals.length ? vals[0] : 0;
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const pts = vals
    .map((v, i) => `${(i / Math.max(1, vals.length - 1)) * w},${h - 3 - ((v - min) / Math.max(1e-6, max - min)) * (h - 6)}`)
    .join(" ");
  const delta = last - first;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold text-stone-600">{label}</span>
        <span className="font-mono-num text-sm font-extrabold text-stone-900">{fmt(last)}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
        {vals.length > 1 ? (
          <>
            <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={0.12} stroke="none" />
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          </>
        ) : (
          <text x={4} y={h / 2} fontSize={10} fill="#a8a29e">
            collecting data…
          </text>
        )}
      </svg>
      <div className={`font-mono-num text-[10px] font-bold ${delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
        {delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(delta))} over {Math.round(((data[data.length - 1]?.t ?? 0) - (data[0]?.t ?? 0)) / 60)} min
      </div>
    </div>
  );
};

interface AdvisorModalProps {
  state: GameState;
  open: boolean;
  onClose: () => void;
  onShowMetric?:(metric:string)=>void;
}

export const AdvisorModal: React.FC<AdvisorModalProps> = ({ state, open, onClose, onShowMetric }) => {
  const [tab, setTab] = useState<"needs" | "trends" | "stages" | "rules">("needs");
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
    <GameDialog label="Island civilization report" onDismiss={onClose} className="island-modal fixed inset-0 z-40 flex items-center justify-center bg-stone-950/60 p-4">
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
              Current needs, service trends and population milestones
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
              aria-label="Close island civilization report"
              data-dialog-focus
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-stone-200 bg-stone-100/80 px-3 py-2 sm:px-5">
          <button
            type="button"
            aria-pressed={tab === "needs"}
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
            aria-pressed={tab === "trends"}
            onClick={() => setTab("trends")}
            className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold ${
              tab === "trends"
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
            }`}
          >
            <Activity className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Trends</span>
            <span className="hidden sm:inline">Trends & Trophies</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === "stages"}
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
            aria-pressed={tab === "rules"}
            onClick={() => setTab("rules")}
            className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-bold ${
              tab === "rules"
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">Rules</span>
            <span className="hidden sm:inline">Upgrades & Modes</span>
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
                        {d.fixHint}
                      </p>
                      {onShowMetric&&<button className="mt-1 text-xs font-bold underline" onClick={()=>onShowMetric(d.id)}>Inspect on island</button>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Supply vs Demand Meters */}
              {(
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

          {tab === "trends" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Sparkline data={state.history ?? []} pick={(h) => h.pop} color="#0369a1" label="Population" fmt={(n) => Math.round(n).toLocaleString()} />
                <Sparkline data={state.history ?? []} pick={(h) => h.wealth??h.money} color="#b45309" label="City wealth" fmt={(n) => `$${Math.round(n).toLocaleString()}`} />
                <Sparkline data={state.history ?? []} pick={(h) => h.happy} color="#047857" label="Happiness" fmt={(n) => `${Math.round(n)}%`} />
              </div>

              <section className="rounded-lg border border-stone-200 bg-white p-3">
                <h4 className="font-display text-sm font-bold text-stone-900">Public works grants</h4>
                <p className="mt-1 text-xs text-stone-600">
                  {state.mode === "god" ? "Explore the goals used in Real and Survival modes." : "Meet all targets at once to earn a one-time treasury payment."}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {CITY_GRANTS.map(grant => {
                    const paid = state.awardedGrants?.includes(grant.id);
                    return (
                      <div key={grant.id} className="rounded-md border border-stone-200 p-2">
                        <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
                          <span>{grant.name}</span>
                          <span className="text-emerald-700">{paid ? "Received " : ""}${grant.reward.toLocaleString()}</span>
                        </div>
                        {!paid && grantProgress(grant, m).map(target => (
                          <div key={target.label} className="mt-1 flex justify-between gap-2 text-[11px] text-stone-600">
                            <span>{target.label}</span>
                            <span className="font-mono-num">{target.current}{target.unit} / {target.goal}{target.unit}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {[
                  { k: "Cash flow", v: `${(m.netIncomePerTick ?? 0) >= 0 ? "+" : ""}${(m.netIncomePerTick ?? 0).toFixed(1)}/s`, sub: `in ${m.grossIncomePerTick ?? 0} · upkeep ${m.upkeepPerTick ?? 0}` },
                  { k: "Traffic", v: `${m.congestion ?? 0}%`, sub: `${m.trafficTrips ?? 0} trips · ${m.transitShare ?? 0}% transit` },
                  { k: "Power mix", v: `${m.renewablePct ?? 0}% green`, sub: `☀ ${Math.round((m.solarFactor ?? 1) * 100)}% · 🌬 ${Math.round((m.windFactor ?? 1) * 100)}%` },
                  { k: "Land value", v: (m.landValueAvg ?? 0.5).toFixed(2), sub: `pollution ${(m.pollutionAvg ?? 0).toFixed(1)}` },
                ].map((c) => (
                  <div key={c.k} className="rounded-lg border border-stone-200 bg-white p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{c.k}</div>
                    <div className="font-mono-num text-sm font-extrabold text-stone-900">{c.v}</div>
                    <div className="text-[10px] text-stone-500">{c.sub}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Neighbourhood Synergies · {m.synergyCount ?? 0} active
                </h4>
                <p className="mt-0.5 text-[11px] text-stone-500">Each synergy adds +12% output (up to +48%). Build smart neighbours!</p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
                  {SYNERGY_RULES.map((r) => {
                    const n = state.elements.filter((e) => e.synergies?.includes(r.id)).length;
                    return (
                      <div key={r.id} className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 ${n > 0 ? "bg-violet-50 text-violet-900" : "text-stone-500"}`}>
                        <span>{r.emoji}</span>
                        <span className="font-bold">{r.label}</span>
                        <span className="ml-auto font-mono-num">{n > 0 ? `×${n}` : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <h4 className="font-display text-sm font-bold text-stone-900">
                  Trophies · {(state.achievements ?? []).length}/{ACHIEVEMENTS.length}
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {ACHIEVEMENTS.map((a) => {
                    const got = (state.achievements ?? []).includes(a.id);
                    return (
                      <div
                        key={a.id}
                        className={`rounded-md border px-2 py-1.5 ${got ? "border-amber-400 bg-amber-50" : "border-stone-200 bg-stone-50 opacity-60"}`}
                        title={a.detail}
                      >
                        <div className="text-[11px] font-extrabold text-stone-900">
                          {got ? a.emoji : "🔒"} {a.title}
                        </div>
                        <div className="text-[10px] leading-tight text-stone-500">{a.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "stages" && (
            <div className="space-y-2">
              {STAGES.map((st) => {
                const reached = state.highestStageReached >= st.stage || state.mode === "god";
                const items = ELEMENTS.filter((e) =>
                  st.stage === 1 ? e.isStarter : !e.wealthThreshold && e.stage === st.stage,
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
                  Earned upgrades and architectural styles
                </h4>
                <p className="mt-1">
                  Select a site to see its next level, price, land requirement and work to date. Farms
                  earn upgrades by harvesting food, homes by staying occupied and supplied, restaurants
                  by serving customers, and depots by completing trips. Each site keeps its chosen style.
                </p>
                <p className="mt-1.5">
                  Every element grows <strong>in its own way</strong>: farms, parks and bases sprawl
                  outward (up to 4×4), towers and turbines shoot skyward, factories become compounds,
                  temples and landmarks gain grandeur, and ships climb hull classes. Each level has its
                  own name — check the inspector to see what's next. Roads, bridges and tracks stay 1×1
                  but gain lanes, lights and capacity.
                </p>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3.5">
                <h4 className="font-display text-sm font-bold text-stone-900">Living City Systems</h4>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li><strong>Traffic:</strong> every building makes trips; roads have capacity by type & level. Rush hour makes journeys slower. Completed passenger trips relieve demand near their stops.</li>
                  <li><strong>Pollution & Land Value:</strong> industry, coal and landfills spread smog; trees, parks and swamps absorb it. Parks, water, landmarks and temples raise land value — homes on valuable land hold up to 2× the people, shops earn more.</li>
                  <li><strong>Synergies:</strong> smart neighbours boost output (Farmstead, Shopping District, Waterfront, Rail Freight…).</li>
                  <li><strong>Live power:</strong> solar follows the sun and clouds, wind turbines follow the wind, hydro loves rain.</li>
                  <li><strong>Auto-bridges:</strong> drag any road across water and it becomes a bridge, with ramps where it lands.</li>
                  <li><strong>Upkeep:</strong> utilities and services cost money to run — keep your cash flow green.</li>
                </ul>
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
                    Build freely with every project, level and style available. Accounts, food and
                    services operate live. Open God controls to experiment with a value or trigger an incident.
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
                    Three island days below an earned population benchmark trigger a collapse.
                    Rebuild within the recovery period. Professional crews need government authorization,
                    access and water. Routine fires begin at Boomtown after a grace period.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </GameDialog>
  );
};
