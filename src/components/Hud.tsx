import React from "react";
import { AlertTriangle, ChevronRight, Pause, Play } from "lucide-react";
import { buildingCharges, cityWealth } from "../game/cityEconomy";
import type { CityIssue } from "../game/cityIssues";
import type { GameState, LimitingNeed } from "../game/simulation";

export type HudStat = "people" | "happy" | "money" | "power";

const compact = (v: number) => new Intl.NumberFormat("en", {
  notation: Math.abs(v) >= 10000 ? "compact" : "standard", maximumFractionDigits: Math.abs(v) >= 10000 ? 1 : 0,
}).format(v);

const NEED_NAMES: Record<LimitingNeed, string> = {housing: "homes", jobs: "jobs", food: "food", waste: "waste", water: "water", power: "power"};

/** Population cap from the simulation, when it reports one. */
export function growthLimit(s: GameState) {
  const lim = s.metrics?.populationLimiter;
  if (!lim || (lim.cap === 0 && s.population === 0)) return undefined;
  return {cap: lim.cap, need: NEED_NAMES[lim.limitingNeed] ?? lim.limitingNeed, atCap: s.population >= 0.97 * lim.cap};
}

/** One row: four status chips and the speed control. Each chip opens its own explanation. */
export function Hud({state, speed, onSpeed, onStat}: {state: GameState; speed: number; onSpeed: (v: number) => void; onStat: (s: HudStat) => void}) {
  const m = state.metrics;
  const limit = growthLimit(state);
  const charges = buildingCharges(state);
  const powerSupply = m.powerSupplySteady ?? m.powerSupply;
  const powerNet = Math.round(powerSupply - m.powerDemand);
  const happyTone = state.happiness < 55 ? " is-bad" : state.happiness < 70 ? " is-warn" : "";
  const next = speed === 0 ? 1 : speed === 1 ? 2 : speed === 2 ? 4 : 0;
  return <header className="ui-hud" aria-label="City status">
    <div className="ui-hud-stats">
      <button type="button" className={"ui-stat" + (limit?.atCap ? " is-warn" : "")} onClick={() => onStat("people")}
        aria-label={"Population " + state.population.toLocaleString() + (limit ? ", room for " + limit.cap.toLocaleString() + ", limited by " + limit.need : "")}>
        <b>{compact(state.population)}</b><small>{limit?.atCap ? "max · " + limit.need : "people"}</small>
      </button>
      <button type="button" className={"ui-stat" + happyTone} onClick={() => onStat("happy")} aria-label={"Happiness " + Math.round(state.happiness) + " percent, show why"}>
        <b>{Math.round(state.happiness)}%</b><small>happy</small>
      </button>
      <button type="button" className={"ui-stat" + (charges && state.money < 0 ? " is-bad" : "")} onClick={() => onStat("money")}
        aria-label={charges ? "Treasury $" + Math.floor(state.money).toLocaleString() : "City wealth $" + Math.floor(cityWealth(state)).toLocaleString()}>
        <b>${compact(Math.floor(charges ? state.money : cityWealth(state)))}</b><small>{charges ? "treasury" : "wealth"}</small>
      </button>
      <button type="button" className={"ui-stat" + (m.powerDemand > 0 && powerNet < 0 ? " is-bad" : "")} onClick={() => onStat("power")}
        aria-label={"Power " + Math.round(powerSupply) + " supplied for " + Math.round(m.powerDemand) + " demand"}>
        <b>{m.powerDemand > 0 ? (powerNet >= 0 ? "+" : "−") + compact(Math.abs(powerNet)) : "—"}</b><small>power</small>
      </button>
    </div>
    <button type="button" className={"ui-speed" + (speed === 0 ? " is-paused" : "")} onClick={() => onSpeed(next)}
      aria-label={(speed === 0 ? "Paused" : "Speed " + speed + "×") + ". Change speed"} title="Pause / 1× / 2× / 4×">
      {speed === 0 ? <Pause size={16}/> : <Play size={16}/>}<span>{speed === 0 ? "Paused" : speed + "×"}</span>
    </button>
  </header>;
}

/** Shown only when something is wrong. */
export function AlertPill({issues, onOpen}: {issues: CityIssue[]; onOpen: () => void}) {
  if (!issues.length) return null;
  const top = issues[0];
  const title = top.title.replace(/\s*\(\d[\d,]*\/\d[\d,]*\)$/, "");
  return <button type="button" className={"ui-alert" + (top.severity === "critical" ? "" : " is-info")} onClick={onOpen} aria-label={"City issues: " + top.title + (issues.length > 1 ? " and " + (issues.length - 1) + " more" : "")}>
    <AlertTriangle size={16} aria-hidden="true"/>
    <span>{title}{issues.length > 1 ? " · " + (issues.length - 1) + " more" : ""}</span>
    <span className="ui-alert-count">{issues.length}</span>
    <ChevronRight size={16} aria-hidden="true"/>
  </button>;
}
