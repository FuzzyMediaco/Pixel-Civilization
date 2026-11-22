import React from "react";
import { AlertTriangle, ArrowUpRight, Coins, Eye, Hammer, Trophy, Users, Wrench } from "lucide-react";
import { STAGES } from "../game/catalog";
import { taxRateOf } from "../game/cityEconomy";
import { cityIssues, type CityIssue, type IssueFix } from "../game/cityIssues";
import type { GameState, HeatmapKind, PlacedElement } from "../game/simulation";
import { CityEconomyPanel } from "./CityEconomyPanel";
import { CityReport } from "./CityReport";
import { growthLimit } from "./Hud";
import { BottomSheet, ListRow, type SheetHeight, Tabs } from "./ui";

export type CityTab = "issues" | "people" | "money" | "goals";

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
        onClick={() => onShowPanel((i.show as { panel: "transit" | "money" | "people" }).panel)}
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
            ]}
          />
        </div>
      }
    >
      {tab === "issues" && (
        <>
          <div className="ui-list">
            {limit && (
              <ListRow
                icon="👥"
                tone={limit.atCap ? "warn" : undefined}
                title={limit.atCap ? "Capped by " + limit.need : "Cap " + limit.cap.toLocaleString()}
                subtitle={state.population.toLocaleString() + " / " + limit.cap.toLocaleString() + " · " + limit.need}
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
            <label className="ui-row" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={!!state.autoMaintain}
                onChange={(e) => {
                  const on = e.target.checked;
                  mutate((s) => {
                    s.autoMaintain = on;
                  });
                }}
              />
              <span className="ui-row-body">
                <b>Auto-maintain</b>
                <small>Pay 1.25× and repair buildings as they fall due</small>
              </span>
            </label>
          )}
          <p className="ui-section-title">Supply vs demand</p>
          <CityReport state={state} tab="meters" />
          <p className="ui-section-title">Fire &amp; safety</p>
          <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="safety" />
        </>
      )}
      {tab === "people" && (
        <>
          <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="population" />
          <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="happiness" />
        </>
      )}
      {tab === "money" && (
        <>
          {state.mode !== "god" && (
            <div className="ui-row" style={{ display: "block", marginBottom: 6 }}>
              <label htmlFor="city-tax" className="ui-row-body">
                <b>Tax rate · {tax}%</b>
                <small>
                  {tax > 15
                    ? "Above 15% lowers happiness"
                    : tax < 15
                      ? "Below 15% boosts happiness"
                      : "15% is neutral"}
                </small>
              </label>
              <input
                id="city-tax"
                type="range"
                min={5}
                max={25}
                step={1}
                value={tax}
                style={{ width: "100%" }}
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
          <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="wealth" />
          {state.mode === "god" && (
            <>
              <p className="ui-section-title">Set or hold city values</p>
              <CityEconomyPanel state={state} mutate={mutate} selected={selected} onFocus={onFocus} initialPanel="controls" />
            </>
          )}
        </>
      )}
      {tab === "goals" && (
        <>
          {state.mode !== "god" && next && (
            <div className="ui-row" style={{ display: "block" }}>
              <b>
                Next: Stage {next.stage} · {next.name}
              </b>
              <div className="ui-muted">
                {state.population.toLocaleString()} / {next.minPop.toLocaleString()} people
              </div>
              <div className="ui-meter">
                <i
                  style={{
                    width:
                      Math.max(
                        0,
                        Math.min(100, ((state.population - stage.minPop) / Math.max(1, next.minPop - stage.minPop)) * 100),
                      ) + "%",
                  }}
                />
              </div>
            </div>
          )}
          <p className="ui-section-title">Stages</p>
          <CityReport state={state} tab="stages" />
          <p className="ui-section-title">Trends &amp; trophies</p>
          <CityReport state={state} tab="trends" />
          <details className="ui-row" style={{ display: "block", marginTop: 8 }}>
            <summary>
              <b>Upgrade &amp; mode rules</b>
            </summary>
            <CityReport state={state} tab="rules" />
          </details>
        </>
      )}
    </BottomSheet>
  );
}
