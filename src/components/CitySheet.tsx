import React from "react";
import { AlertTriangle, ArrowUpRight, Coins, Eye, Hammer, TrainFront, Trophy, Users, Wrench } from "lucide-react";
import { ELEMENT_BY_ID, STAGES } from "../game/catalog";
import { WEALTH_PROJECTS } from "../game/wealthProjects";
import {
  buildingCharges,
  cityWealth,
  economyOf,
  effective,
  treasuryUpkeepRate,
  claimSurvivalGrant,
  canClaimSurvivalGrant,
  SURVIVAL_RECOVERY_SEC,
  SURVIVAL_REBUILD_GRANT,
  taxRateOf,
  stagePopulationThreshold,
  unlockWealth,
  wealthTiers,
} from "../game/cityEconomy";
import { cityIssues, type CityIssue, type IssueFix } from "../game/cityIssues";
import { isEssentialUtility, MAINTENANCE_INTERVAL_SEC, maintenanceStatus, type GameState, type HeatmapKind, type PlacedElement } from "../game/simulation";
import { CityEconomyPanel } from "./CityEconomyPanel";
import { CityReport } from "./CityReport";
import { growthLimit } from "./Hud";
import { TransitContent, type TransitContentProps } from "./TransitSheet";
import { BottomSheet, ListRow, type SheetHeight, Tabs } from "./ui";

export type CityTab = "issues" | "people" | "money" | "goals" | "transit";

const fmtMoney = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs).toLocaleString("en")}`;
};

const fmtSignedRate = (perMin: number) => {
  const abs = Math.abs(perMin);
  const sign = perMin > 0.05 ? "+" : perMin < -0.05 ? "−" : "";
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k/min`;
  return `${sign}$${Math.round(abs).toLocaleString("en")}/min`;
};

function MiniSparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  if (values.length < 2) {
    return (
      <div className="ui-spark-empty" aria-label={label}>
        <span>{label}</span>
        <small>Recording trend…</small>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - ((v - min) / span) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const delta = values[values.length - 1] - values[0];
  return (
    <div className="ui-spark-card">
      <div className="ui-spark-head">
        <span>{label}</span>
        <strong className={delta < 0 ? "is-bad" : delta > 0 ? "is-good" : ""}>
          {delta >= 0 ? "+" : ""}
          {fmtMoney(delta)}
        </strong>
      </div>
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="ui-spark-svg" aria-hidden="true">
        <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
      </svg>
    </div>
  );
}

export function CitySheet({
  state,
  tab,
  onTab,
  mutate,
  selected,
  onFocus,
  onFix,
  onShowLayer,
  onShowPanel,
  onMaintainAll,
  transitProps,
  height,
  onHeight,
  onClose,
}: {
  state: GameState;
  tab: CityTab;
  onTab: (t: CityTab) => void;
  mutate: (fn: (s: GameState) => void) => void;
  selected?: PlacedElement;
  onFocus: (id: string) => void;
  onFix: (fix: IssueFix) => void;
  onShowLayer: (layer: HeatmapKind) => void;
  onShowPanel: (p: "transit" | "money" | "people") => void;
  onMaintainAll: () => void;
  transitProps?: Omit<TransitContentProps, "state" | "mutate" | "selected" | "onFocus">;
  height: SheetHeight;
  onHeight: (h: SheetHeight) => void;
  onClose: () => void;
}) {
  const issues = cityIssues(state);
  const problems = issues.filter((i) => i.severity === "critical" || i.severity === "warning");
  const limit = growthLimit(state);
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const next = state.currentStage < 20 ? STAGES[state.currentStage] : undefined;
  const growthIssue = issues.find((i) => i.id === "growth_limit");
  const tax = taxRateOf(state);
  const charges = buildingCharges(state);
  const econ = economyOf(state);
  const nextUtility = state.mode === "survival" ? state.elements.reduce<PlacedElement | undefined>((next, site) => {
    if (!isEssentialUtility(site) || maintenanceStatus(state, site) === "none") return next;
    const priority = (item: PlacedElement) => item.disrepair ? Infinity : item.maintTimerSec;
    return !next || priority(site) > priority(next) ? site : next;
  }, undefined) : undefined;
  const totalWealth = cityWealth(state);
  const peakWealth = unlockWealth(state);
  const wealthDeltaToday = totalWealth - econ.previousDay;
  const netPerMin = (state.metrics.netIncomePerTick ?? 0) * 60;
  const taxPerMin = (state.metrics.grossIncomePerTick ?? 0) * 60;
  const upkeepPerMin = treasuryUpkeepRate(state) * 60;
  const history = state.history ?? [];
  const moneySeries = history.slice(-30).map((h) => h.money);
  const wealthSeries = history.slice(-30).map((h) => h.wealth ?? h.money);
  const upcomingTier = wealthTiers().find((t) => t > peakWealth);
  const transitLineCount = state.mobility?.lines.length ?? 0;

  const trailing = (i: CityIssue) =>
    i.repairAll ? (
      <button
        type="button"
        className="ui-row-action-icon"
        aria-label="Repair all"
        title="Repair all"
        onClick={onMaintainAll}
      >
        <Wrench size={14} />
      </button>
    ) : i.fix ? (
      <button
        type="button"
        className="ui-row-action-icon"
        aria-label={i.fix.label}
        title={i.fix.label}
        onClick={() => onFix(i.fix!)}
      >
        <Hammer size={14} />
      </button>
    ) : i.show && "layer" in i.show ? (
      <button
        type="button"
        className="ui-row-action-icon"
        aria-label="Show map layer"
        title="Show map layer"
        onClick={() => onShowLayer((i.show as { layer: HeatmapKind }).layer)}
      >
        <Eye size={14} />
      </button>
    ) : i.show && "panel" in i.show ? (
      <button
        type="button"
        className="ui-row-action-icon"
        aria-label="Open panel"
        title="Open panel"
        onClick={() => {
          const panel = (i.show as { panel: "transit" | "money" | "people" }).panel;
          onTab(panel);
          onShowPanel(panel);
        }}
      >
        <ArrowUpRight size={14} />
      </button>
    ) : undefined;

  return (
    <BottomSheet
      id="sheet-city"
      title="City"
      subtitle={state.mode === "god" ? "God mode" : "Stage " + stage.stage + " · " + stage.name}
      height={height}
      onHeightChange={onHeight}
      onClose={onClose}
      closeLabel="Close City"
      scrollKey={tab}
      dock={
        <div className="ui-sheet-dock">
          <Tabs
            label="City sections"
            value={tab}
            onChange={onTab}
            items={[
              { id: "issues", label: "Issues", icon: <AlertTriangle size={13} />, badge: problems.length },
              { id: "people", label: "People", icon: <Users size={13} /> },
              { id: "money", label: "Money", icon: <Coins size={13} /> },
              { id: "goals", label: "Goals", icon: <Trophy size={13} /> },
              { id: "transit", label: "Transit", icon: <TrainFront size={13} />, badge: transitLineCount > 0 ? undefined : 0 },
            ]}
          />
        </div>
      }
    >
      {tab === "issues" && (
        <div className="ui-city-section">
          <div className="ui-list">
            {limit && (
              <ListRow
                icon="👥"
                tone={limit.atCap ? "warn" : undefined}
                title={limit.atCap ? "Growth capped by " + limit.need : "Room for " + limit.cap.toLocaleString() + " people"}
                subtitle={state.population.toLocaleString() + " / " + limit.cap.toLocaleString() + " · next need: " + limit.need}
                trailing={growthIssue ? trailing(growthIssue) : undefined}
              />
            )}
            {issues
              .filter((i) => i.severity !== "good" && i.id !== "growth_limit")
              .map((i) => (
                <ListRow
                  key={i.id}
                  icon={i.severity === "info" ? "ⓘ" : "⚠"}
                  tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : undefined}
                  title={i.title}
                  subtitle={(i.deltaHappiness ? i.deltaHappiness + "% · " : "") + i.fixHint}
                  trailing={trailing(i)}
                />
              ))}
            {!problems.length && (
              <ListRow
                icon="✓"
                title="No pressing problems"
                subtitle={issues.find((i) => i.severity === "good")?.title ?? "Residents are content."}
              />
            )}
          </div>

          {state.mode === "survival" && (
            <>
              <label className="ui-row" style={{ marginTop: 6 }}>
                <span className="ui-row-body">
                  <b>Free auto-maintenance</b>
                  <small>Tap marked sites to maintain them yourself, or choose automatic service.</small>
                </span>
                <select aria-label="Automatic maintenance coverage"
                  value={state.autoMaintain ? (state.autoMaintainUtilitiesOnly ? "essential" : "all") : "manual"}
                  onChange={event => {
                    const coverage = event.target.value;
                    mutate(city => {
                      city.autoMaintain = coverage !== "manual";
                      city.autoMaintainUtilitiesOnly = coverage === "essential";
                    });
                  }}>
                  <option value="manual">Manual</option>
                  <option value="essential">Essential utilities</option>
                  <option value="all">All buildings</option>
                </select>
              </label>
              {nextUtility && <ListRow
                icon={<Wrench size={14} />}
                title={ELEMENT_BY_ID[nextUtility.defId].name + " maintenance"}
                subtitle={nextUtility.disrepair || nextUtility.maintTimerSec >= MAINTENANCE_INTERVAL_SEC
                  ? "Due now · Free to restore. Reduced output until serviced."
                  : "Due in " + Math.ceil(MAINTENANCE_INTERVAL_SEC - nextUtility.maintTimerSec) + " simulation seconds · Free."}
              />}
              {econ.recovery > 0 && <ListRow
                icon={<AlertTriangle size={14} />}
                title="City recovery window"
                subtitle={Math.max(0, Math.ceil(SURVIVAL_RECOVERY_SEC - econ.recovery)) + " simulation seconds to restore happiness to 45% or rebuild population."}
              />}
              {canClaimSurvivalGrant(state) && <button className="ui-btn" type="button" onClick={() => mutate(city => { claimSurvivalGrant(city); })}>
                Claim ${SURVIVAL_REBUILD_GRANT} emergency infrastructure grant
              </button>}
            </>
          )}

          <details className="ui-fold" open>
            <summary>
              <span>Service supply vs demand</span>
            </summary>
            <div className="ui-fold-body">
              <CityReport state={state} tab="meters" />
            </div>
          </details>

          <details className="ui-fold">
            <summary>
              <span>Fire, crime &amp; emergency crews</span>
              <small>{state.metrics.burningCount > 0 ? `${state.metrics.burningCount} burning` : `Crime ${state.metrics.crimeRate}%`}</small>
            </summary>
            <div className="ui-fold-body">
              <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="safety" />
            </div>
          </details>
        </div>
      )}

      {tab === "people" && (
        <div className="ui-city-section">
          <div className="ui-kpi-strip" role="group" aria-label="Population overview">
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">Population</span>
              <strong className="ui-kpi-val">{state.population.toLocaleString("en")}</strong>
              <small className="ui-kpi-sub">
                {limit ? `Cap ${limit.cap.toLocaleString("en")} (${limit.need})` : `Stage ${stage.stage}`}
              </small>
            </div>
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">Happiness</span>
              <strong className={"ui-kpi-val" + (state.happiness < 55 ? " is-bad" : state.happiness < 70 ? " is-warn" : " is-good")}>
                {Math.round(state.happiness)}%
              </strong>
              <small className="ui-kpi-sub">
                {problems.length > 0 ? "Service shortages" : "Balanced services"}
              </small>
            </div>
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">Jobs filled</span>
              <strong className="ui-kpi-val">
                {Object.values(econ.sites).reduce((sum, s) => sum + s.workers, 0).toLocaleString("en")}
              </strong>
              <small className="ui-kpi-sub">of {Math.round(econ.report.jobs).toLocaleString("en")} jobs</small>
            </div>
          </div>
          <div className="ui-panel-card">
            <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="population" />
          </div>
          <details className="ui-fold" open>
            <summary>
              <span>Wellbeing &amp; household needs</span>
              <small>{Math.round(state.happiness)}% happy</small>
            </summary>
            <div className="ui-fold-body">
              <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="happiness" />
            </div>
          </details>
        </div>
      )}

      {tab === "money" && (
        <div className="ui-city-section">
          {/* Primary Money Hero: clearly separates Spendable Cash, City Wealth (Unlocks), and Net Cash Flow */}
          <div className="ui-kpi-strip" role="group" aria-label="City finances summary">
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">Spendable Cash</span>
              <strong className={"ui-kpi-val" + (charges && state.money < 0 ? " is-bad" : "")}>
                {charges ? fmtMoney(state.money) : "Free"}
              </strong>
              <small className="ui-kpi-sub">{charges ? "Treasury balance" : "Sandbox (no build cost)"}</small>
            </div>
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">City Wealth</span>
              <strong className="ui-kpi-val">{fmtMoney(totalWealth)}</strong>
              <small className={"ui-kpi-sub" + (wealthDeltaToday < 0 ? " is-bad" : wealthDeltaToday > 0 ? " is-good" : "")}>
                {wealthDeltaToday >= 0 ? "+" : ""}
                {fmtMoney(wealthDeltaToday)} today · Unlocks
              </small>
            </div>
            <div className="ui-kpi-card">
              <span className="ui-kpi-label">Net Cash Flow</span>
              <strong className={"ui-kpi-val" + (netPerMin < -0.05 ? " is-bad" : netPerMin > 0.05 ? " is-good" : "")}>
                {fmtSignedRate(netPerMin)}
              </strong>
              <small className="ui-kpi-sub">
                Tax {fmtSignedRate(taxPerMin)} · Upkeep −{fmtMoney(upkeepPerMin)}/m
              </small>
            </div>
          </div>

          {/* Live Simulation Trend Sparklines */}
          <div className="ui-spark-grid">
            {state.mode === "survival" && <p className="ui-muted">Treasury funds construction and public works. Businesses open for free and earn taxes through trade, sales and payroll.</p>}
            <MiniSparkline values={moneySeries} color="#1e6243" label="Treasury trend" />
            <MiniSparkline values={wealthSeries} color="#b4781f" label="City wealth trend" />
          </div>

          {/* Tax control (non-God modes) */}
          {state.mode !== "god" && (
            <div className="ui-panel-card ui-tax-card">
              <div className="ui-card-head">
                <label htmlFor="city-tax">
                  <strong>Tax rate · {tax}%</strong>
                </label>
                <span className="ui-card-sub">
                  {tax > 15 ? `−${(tax - 15) * 2}% happiness` : tax < 15 ? `+${Math.round((15 - tax) * 1.2)}% happiness` : "Neutral mood"}
                </span>
              </div>
              <input
                id="city-tax"
                type="range"
                min={5}
                max={25}
                step={1}
                value={tax}
                aria-label="Tax rate"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  mutate((s) => {
                    s.taxRate = v;
                  });
                }}
              />
            </div>
          )}

          {/* Expandable Financial Breakdowns */}
          <details className="ui-fold" open>
            <summary>
              <span>Income, upkeep &amp; accounts</span>
              <small>{fmtSignedRate(netPerMin)}</small>
            </summary>
            <div className="ui-fold-body">
              <div className="ui-fin-rows">
                <div><span>Tax revenue</span><strong className="is-good">+{fmtMoney(taxPerMin)}/min</strong></div>
                <div><span>Building &amp; service upkeep</span><strong className="is-bad">−{fmtMoney(upkeepPerMin)}/min</strong></div>
                <div><span>Worker wages</span><strong>{fmtMoney(econ.report.wages * 60)}/min</strong></div>
                <div><span>Spendable treasury</span><strong>{fmtMoney(state.money)}</strong></div>
                <div><span>Household savings</span><strong>{fmtMoney(econ.households)}</strong></div>
                <div><span>Business cash</span><strong>{fmtMoney(econ.businesses)}</strong></div>
                <div><span>Peak city wealth (unlocks)</span><strong>{fmtMoney(peakWealth)}</strong></div>
              </div>
            </div>
          </details>

          <details className="ui-fold">
            <summary>
              <span>Recent transfers &amp; ledger</span>
              <small>{econ.ledger.length} entries</small>
            </summary>
            <div className="ui-fold-body">
              {econ.ledger.length ? (
                <ul className="ui-ledger-list">
                  {econ.ledger
                    .slice(-12)
                    .reverse()
                    .map((entry, i) => (
                      <li key={i}>
                        <span>
                          <b>{entry.label}</b>
                          <small>{entry.from} → {entry.to}</small>
                        </span>
                        <strong>{fmtMoney(entry.amount)}</strong>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="ui-muted">Taxes, wages, upkeep, and trade appear here as the city runs.</p>
              )}
            </div>
          </details>

          <details className="ui-fold">
            <summary>
              <span>Wealth project unlocks</span>
              <small>{upcomingTier ? `${fmtMoney(Math.max(0, upcomingTier - peakWealth))} to next` : "All unlocked"}</small>
            </summary>
            <div className="ui-fold-body">
              <div className="ui-wealth-tiers">
                {wealthTiers().map((tier) => {
                  const unlocked = state.mode === "god" || peakWealth >= tier;
                  return (
                    <div key={tier} className={"ui-wealth-tier" + (unlocked ? " is-unlocked" : "")}>
                      <div className="ui-wealth-tier-head">
                        <strong>{fmtMoney(tier)}</strong>
                        <span>{state.mode === "god" ? "Sandbox" : unlocked ? "Unlocked" : "Upcoming"}</span>
                      </div>
                      <p>
                        {WEALTH_PROJECTS.filter((p) => p.wealthThreshold === tier)
                          .map((p) => p.name)
                          .join(" · ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>

          {state.mode === "god" && (
            <details className="ui-fold">
              <summary>
                <span>God economic controls</span>
                <small>Live overrides</small>
              </summary>
              <div className="ui-fold-body">
                <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="controls" />
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "goals" && (
        <div className="ui-city-section">
          {state.mode === "god" ? (
            <div className="ui-panel-card">
              <div className="ui-card-head">
                <strong>Sandbox · All 20 Stages Open</strong>
                <span className="ui-card-sub">{state.population.toLocaleString()} pop</span>
              </div>
              <p className="ui-card-meta">Every element, level, and landmark is unlocked in God mode.</p>
            </div>
          ) : next ? (
            <div className="ui-panel-card">
              <div className="ui-card-head">
                <strong>Next: Stage {next.stage} · {next.name}</strong>
                <span className="ui-card-sub">
                  {state.population.toLocaleString()} / {stagePopulationThreshold(state,next.minPop).toLocaleString()}
                </span>
              </div>
              <div className="ui-meter">
                <i
                  style={{
                    width:
                      Math.max(
                        0,
                        Math.min(100, ((state.population - stagePopulationThreshold(state,stage.minPop)) / Math.max(1, stagePopulationThreshold(state,next.minPop) - stagePopulationThreshold(state,stage.minPop))) * 100),
                      ) + "%",
                  }}
                />
              </div>
              <p className="ui-card-meta">
                {Math.max(0, stagePopulationThreshold(state,next.minPop) - state.population).toLocaleString()} more residents needed
                {limit?.atCap ? ` · currently capped by ${limit.need}` : ""}.
              </p>
            </div>
          ) : (
            <div className="ui-panel-card">
              <div className="ui-card-head">
                <strong>Stage 20 · {stage.name}</strong>
                <span className="ui-card-sub">Max stage reached</span>
              </div>
              <p className="ui-card-meta">Your island has reached the highest civilization stage.</p>
            </div>
          )}

          <details className="ui-fold" open>
            <summary><span>Stages &amp; unlocks</span></summary>
            <div className="ui-fold-body">
              <CityReport state={state} tab="stages" />
            </div>
          </details>

          <details className="ui-fold">
            <summary><span>Trends &amp; trophies</span></summary>
            <div className="ui-fold-body">
              <CityReport state={state} tab="trends" />
            </div>
          </details>

          <details className="ui-fold">
            <summary><span>Upgrade &amp; mode rules</span></summary>
            <div className="ui-fold-body">
              <CityReport state={state} tab="rules" />
            </div>
          </details>
        </div>
      )}

      {tab === "transit" && transitProps && (
        <TransitContent
          state={state}
          mutate={mutate}
          selected={selected}
          onFocus={onFocus}
          {...transitProps}
        />
      )}
    </BottomSheet>
  );
}
