/**
 * "Why?" answers for the UI. Ranks the advisor diagnostics the simulation already computes and gives
 * each one a Show target (a map layer or a panel) and a Fix target (a pre-filtered Build list).
 * Pure: reads state, never changes it.
 */
import type { CivElementDef, ElementCategory } from "./catalog";
import type { AdvisorDiagnostic, GameState, HeatmapKind, LimitingNeed } from "./simulation";

/** Numeric stat a Build "fix" filter looks for (elements that supply it). */
export type FixNeed = "power" | "water" | "waste" | "jobs" | "food" | "education" | "recreation" | "government"
  | "policeRadius" | "fireRadius" | "military" | "population";

export interface IssueFix { label: string; need?: FixNeed; category?: ElementCategory }
export type IssueShow = { layer: HeatmapKind } | { panel: "transit" | "money" | "people" };

export interface CityIssue extends AdvisorDiagnostic {
  show?: IssueShow;
  fix?: IssueFix;
  /** Survival repairs can be fixed in one tap. */
  repairAll?: boolean;
}

const NEED_TARGETS: Record<string, {layer?: HeatmapKind; fix?: IssueFix; panel?: "transit" | "money" | "people"}> = {
  power: {layer: "power", fix: {label: "Build power", need: "power"}},
  water: {layer: "water", fix: {label: "Build water", need: "water"}},
  waste: {layer: "waste", fix: {label: "Build waste", need: "waste"}},
  jobs: {layer: "jobs", fix: {label: "Build jobs", need: "jobs"}},
  food: {layer: "food", fix: {label: "Build food", need: "food"}},
  edu: {layer: "education", fix: {label: "Build schools", need: "education"}},
  rec: {layer: "parks", fix: {label: "Build parks", need: "recreation"}},
  gov: {fix: {label: "Build civic", need: "government"}},
  traffic: {layer: "traffic", fix: {label: "Build transit", category: "roads_transit"}},
  crime: {layer: "police", fix: {label: "Build police", need: "policeRadius"}},
  defense: {layer: "defense", fix: {label: "Build defense", need: "military"}},
  fire: {layer: "fire", fix: {label: "Build fire cover", need: "fireRadius"}},
  disconnected: {layer: "transit", fix: {label: "Build roads", category: "roads_transit"}},
  no_homes: {fix: {label: "Build homes", need: "population"}},
  no_port: {fix: {label: "Build harbor", category: "maritime"}},
  nuisance: {layer: "pollution"},
  tax: {panel: "money"},
  administration: {panel: "money"},
  recovery: {panel: "people", fix: {label: "Build homes", need: "population"}},
  fire_recovery: {layer: "fire"},
  groundwater: {layer: "water"},
};

const LIMITER_TARGETS: Record<LimitingNeed, string> = {
  housing: "no_homes", jobs: "jobs", food: "food", waste: "waste", water: "water", power: "power",
};

const RANK: Record<AdvisorDiagnostic["severity"], number> = {critical: 0, warning: 1, info: 2, good: 3};

export function cityIssues(state: GameState): CityIssue[] {
  const limiter = state.metrics?.populationLimiter;
  return (state.diagnostics ?? []).map(d => {
    const key = d.id === "growth_limit" && limiter ? LIMITER_TARGETS[limiter.limitingNeed] : d.id;
    const t = NEED_TARGETS[key] ?? {};
    const issue: CityIssue = {...d};
    if (t.layer) issue.show = {layer: t.layer};
    else if (t.panel) issue.show = {panel: t.panel};
    if (t.fix) issue.fix = t.fix;
    if (d.id === "disrepair" && state.mode === "survival") issue.repairAll = true;
    return issue;
  }).sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.deltaHappiness ?? 0) - (b.deltaHappiness ?? 0));
}

/** Problems worth an alert pill: critical and warning only. */
export function alertIssues(state: GameState): CityIssue[] {
  return cityIssues(state).filter(i => i.severity === "critical" || i.severity === "warning");
}

/** Does this element help with a Build fix filter? */
export function suppliesNeed(def: CivElementDef, need: FixNeed): boolean {
  return ((def as unknown as Record<string, number | undefined>)[need] ?? 0) > 0;
}
