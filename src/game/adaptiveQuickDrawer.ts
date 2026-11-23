/**
 * Adaptive & Manual Top-Right Quick Drawer + Simplified Feature/Settings Catalog.
 *
 * Turns every major Pixel Civilization feature and setting into a lightweight
 * one-tap quick-access action.
 *
 * Modes (available in all 5 game modes — God, Real, Survival, Idle, Manager):
 *   - Adaptive (default): Starts with Bulk Select + 3 Quick Menus + Speed + contextual utility,
 *     then dynamically adapts all 6 floating buttons as you play, handle alerts, and use features.
 *   - Manual: Turn off adaptiveness anytime and hand-pick & reorder up to 6 exact shortcuts
 *     from the full 25-item catalog.
 */
import { alertIssues } from "./cityIssues";
import type { QuickBuildMode } from "./quickBuildTree";
import type { QuickMenuPrefs, SmartBuildFocus } from "./quickMenuPrefs";
import type { GameState, HeatmapKind } from "./simulation";

export type QuickDrawerActionId =
  | "bulk_select"
  | "mode_smart"
  | "mode_quick"
  | "mode_exact"
  | "mode_sculpt"
  | "sim_speed"
  | "undo"
  | "city_issues"
  | "repair_all"
  | "camera_recenter"
  | "camera_orbit"
  | "heatmap_power"
  | "heatmap_water"
  | "heatmap_safety"
  | "heatmap_traffic"
  | "public_works"
  | "save_slots"
  | "handbook"
  | "pix_advise"
  | "quick_edit_order"
  | "after_place_qe"
  | "build_focus"
  | "weather_cycle"
  | "day_night"
  | "game_mode"
  | "settings";

export type QuickDrawerMode = "adaptive" | "manual";

export interface QuickDrawerPrefs {
  mode: QuickDrawerMode;
  manualIds: QuickDrawerActionId[];
}

export type QuickDrawerCatalogGroup = "Quick Menus" | "City & Map" | "Tools & Studio" | "Settings";

export interface QuickDrawerCatalogMeta {
  id: QuickDrawerActionId;
  label: string;
  desc: string;
  group: QuickDrawerCatalogGroup;
  /** Optional mode restriction note displayed in the picker */
  modeNote?: string;
}

export interface QuickDrawerItem {
  id: QuickDrawerActionId;
  label: string;
  title: string;
  active?: boolean;
  tone?: "accent" | "warn" | "danger";
  /** If true, tapping updates live without closing the floating drawer. */
  stayOpen?: boolean;
  disabled?: boolean;
  score: number;
}

export interface QuickDrawerHabits {
  actionCounts: Record<string, number>;
  recentActions: string[];
  totalUses: number;
}

export interface QuickDrawerContext {
  quickBuildMode: QuickBuildMode;
  quickMenuPrefs: QuickMenuPrefs;
  bulkSelectMode: boolean;
  canManualEdit: boolean;
  simSpeed: number;
  activeHeatmap: HeatmapKind;
  autoSpin: boolean;
  canUndo: boolean;
}

const DRAWER_HABITS_KEY = "pixel_civ_quick_drawer_habits_v1";
const DRAWER_PREFS_KEY = "pixel_civ_quick_drawer_prefs_v1";

export const MAX_MANUAL_DRAWER_SLOTS = 7;

export const DEFAULT_MANUAL_DRAWER_IDS: QuickDrawerActionId[] = [
  "bulk_select",
  "mode_smart",
  "mode_quick",
  "mode_exact",
  "mode_sculpt",
  "sim_speed",
  "undo",
];

export const QUICK_DRAWER_CATALOG_META: QuickDrawerCatalogMeta[] = [
  // Quick Menus & Selection
  { id: "bulk_select", label: "Bulk Select", desc: "Draw to select & delete multiple items", group: "Quick Menus", modeNote: "Manual build modes" },
  { id: "mode_smart", label: "Smart Build", desc: "3-click adaptive categories → elements", group: "Quick Menus", modeNote: "Manual build modes" },
  { id: "mode_quick", label: "Quick Build", desc: "2-click instant adaptive elements", group: "Quick Menus", modeNote: "Manual build modes" },
  { id: "mode_exact", label: "Exact Build", desc: "4-click fixed 7×7×6 decision tree", group: "Quick Menus", modeNote: "Manual build modes" },
  { id: "mode_sculpt", label: "Quick Sculpt", desc: "1-tap 0.25m voxel sculpt spiral menu", group: "Quick Menus", modeNote: "Manual build modes" },
  { id: "quick_edit_order", label: "QE Order", desc: "Toggle Quick Edit fixed vs adaptive order", group: "Quick Menus" },
  { id: "after_place_qe", label: "Auto Quick Edit", desc: "Open Quick Edit right after placing", group: "Quick Menus" },
  { id: "build_focus", label: "Build Focus", desc: "Cycle Balanced / Needs / Habits / Nearby", group: "Quick Menus" },

  // City & Map
  { id: "sim_speed", label: "Speed", desc: "Cycle 1× → 2× → 4× → Pause", group: "City & Map" },
  { id: "city_issues", label: "Alerts", desc: "Jump straight to active city issues", group: "City & Map" },
  { id: "repair_all", label: "Repair All", desc: "Repair buildings in disrepair", group: "City & Map", modeNote: "Survival" },
  { id: "camera_recenter", label: "Center Map", desc: "Recenter camera on the island", group: "City & Map" },
  { id: "camera_orbit", label: "360° Spin", desc: "Toggle smooth 360° camera orbit", group: "City & Map" },
  { id: "heatmap_power", label: "Power Map", desc: "Toggle Power coverage overlay", group: "City & Map" },
  { id: "heatmap_water", label: "Water Map", desc: "Toggle Water coverage overlay", group: "City & Map" },
  { id: "heatmap_safety", label: "Safety Map", desc: "Toggle Police & Fire overlay", group: "City & Map" },
  { id: "heatmap_traffic", label: "Traffic Map", desc: "Toggle Traffic & Transit overlay", group: "City & Map" },

  // Tools & Studio
  { id: "undo", label: "Undo", desc: "Undo last building edit", group: "Tools & Studio", modeNote: "Manual build modes" },
  { id: "public_works", label: "Land & Bridges", desc: "Open land, canal & bridge tools", group: "Tools & Studio", modeNote: "Manual build modes" },
  { id: "pix_advise", label: "Pix Advisor", desc: "Open live city coaching in Pix Studio", group: "Tools & Studio" },
  { id: "save_slots", label: "Quick Save", desc: "Open island save slots", group: "Tools & Studio" },
  { id: "handbook", label: "Handbook", desc: "Open compact Playbook & 3D Atlas", group: "Tools & Studio" },

  // Settings & World
  { id: "weather_cycle", label: "Weather", desc: "Cycle Clear / Cloudy / Rain / Storm", group: "Settings", modeNote: "God mode" },
  { id: "day_night", label: "Day / Night", desc: "Switch between bright noon and lit night", group: "Settings", modeNote: "God mode" },
  { id: "game_mode", label: "Switch Mode", desc: "Switch God / Real / Survival / Idle / Manager", group: "Settings" },
  { id: "settings", label: "All Settings", desc: "Open full Settings & Quick Menus", group: "Settings" },
];

export const ALL_QUICK_DRAWER_IDS: QuickDrawerActionId[] = QUICK_DRAWER_CATALOG_META.map((m) => m.id);
const VALID_DRAWER_ID_SET = new Set<QuickDrawerActionId>(ALL_QUICK_DRAWER_IDS);

export function createDefaultQuickDrawerPrefs(): QuickDrawerPrefs {
  return {
    mode: "adaptive",
    manualIds: [...DEFAULT_MANUAL_DRAWER_IDS],
  };
}

export function sanitizeQuickDrawerPrefs(raw: Partial<QuickDrawerPrefs> | null | undefined): QuickDrawerPrefs {
  const def = createDefaultQuickDrawerPrefs();
  if (!raw || typeof raw !== "object") return def;
  const mode: QuickDrawerMode = raw.mode === "manual" ? "manual" : "adaptive";
  const manualIds: QuickDrawerActionId[] = [];
  if (Array.isArray(raw.manualIds)) {
    for (const id of raw.manualIds) {
      if (
        VALID_DRAWER_ID_SET.has(id as QuickDrawerActionId) &&
        !manualIds.includes(id as QuickDrawerActionId) &&
        manualIds.length < MAX_MANUAL_DRAWER_SLOTS
      ) {
        manualIds.push(id as QuickDrawerActionId);
      }
    }
  }
  return {
    mode,
    manualIds: manualIds.length > 0 ? manualIds : [...DEFAULT_MANUAL_DRAWER_IDS],
  };
}

export function loadQuickDrawerPrefs(): QuickDrawerPrefs {
  try {
    if (typeof localStorage === "undefined") return createDefaultQuickDrawerPrefs();
    const raw = localStorage.getItem(DRAWER_PREFS_KEY);
    if (!raw) return createDefaultQuickDrawerPrefs();
    return sanitizeQuickDrawerPrefs(JSON.parse(raw) as Partial<QuickDrawerPrefs>);
  } catch {
    return createDefaultQuickDrawerPrefs();
  }
}

export function saveQuickDrawerPrefs(prefs: QuickDrawerPrefs): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DRAWER_PREFS_KEY, JSON.stringify(sanitizeQuickDrawerPrefs(prefs)));
  } catch {
    // Ignore storage errors
  }
}

export function toggleManualDrawerAction(prefs: QuickDrawerPrefs, id: QuickDrawerActionId): QuickDrawerPrefs {
  if (!VALID_DRAWER_ID_SET.has(id)) return prefs;
  const exists = prefs.manualIds.includes(id);
  if (exists) {
    // Always keep at least 1 shortcut so the drawer is never empty
    if (prefs.manualIds.length <= 1) return prefs;
    return {
      ...prefs,
      manualIds: prefs.manualIds.filter((x) => x !== id),
    };
  }
  if (prefs.manualIds.length >= MAX_MANUAL_DRAWER_SLOTS) {
    return prefs;
  }
  return {
    ...prefs,
    manualIds: [...prefs.manualIds, id],
  };
}

export function moveManualDrawerAction(
  prefs: QuickDrawerPrefs,
  id: QuickDrawerActionId,
  delta: -1 | 1,
): QuickDrawerPrefs {
  const list = [...prefs.manualIds];
  const idx = list.indexOf(id);
  const nextIdx = idx + delta;
  if (idx < 0 || nextIdx < 0 || nextIdx >= list.length) return prefs;
  const [item] = list.splice(idx, 1);
  list.splice(nextIdx, 0, item);
  return { ...prefs, manualIds: list };
}

export function createEmptyQuickDrawerHabits(): QuickDrawerHabits {
  return {
    actionCounts: {},
    recentActions: [],
    totalUses: 0,
  };
}

export function loadQuickDrawerHabits(): QuickDrawerHabits {
  try {
    if (typeof localStorage === "undefined") return createEmptyQuickDrawerHabits();
    const raw = localStorage.getItem(DRAWER_HABITS_KEY);
    if (!raw) return createEmptyQuickDrawerHabits();
    const parsed = JSON.parse(raw) as Partial<QuickDrawerHabits>;
    const actionCounts: Record<string, number> = {};
    if (parsed.actionCounts && typeof parsed.actionCounts === "object") {
      for (const [k, v] of Object.entries(parsed.actionCounts)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          actionCounts[k] = Math.floor(v);
        }
      }
    }
    const recentActions = Array.isArray(parsed.recentActions) ? parsed.recentActions.slice(0, 24) : [];
    const totalUses =
      typeof parsed.totalUses === "number" && Number.isFinite(parsed.totalUses)
        ? Math.max(0, Math.floor(parsed.totalUses))
        : Object.values(actionCounts).reduce((a, b) => a + b, 0);
    return { actionCounts, recentActions, totalUses };
  } catch {
    return createEmptyQuickDrawerHabits();
  }
}

export function saveQuickDrawerHabits(habits: QuickDrawerHabits): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DRAWER_HABITS_KEY, JSON.stringify(habits));
  } catch {
    // Ignore storage errors
  }
}

export function recordQuickDrawerAction(
  habits: QuickDrawerHabits,
  actionId: QuickDrawerActionId,
  weight = 1,
): QuickDrawerHabits {
  const inc = Math.max(1, Math.round(weight));
  return {
    actionCounts: {
      ...habits.actionCounts,
      [actionId]: (habits.actionCounts[actionId] ?? 0) + inc,
    },
    recentActions: [actionId, ...habits.recentActions.filter((x) => x !== actionId)].slice(0, 24),
    totalUses: habits.totalUses + inc,
  };
}

const FOCUS_SHORT: Record<SmartBuildFocus, string> = {
  balanced: "Balanced",
  needs: "Needs",
  habits: "Habits",
  local: "Nearby",
};

/** Builds a single live QuickDrawerItem for any catalog ID in any game mode. */
export function buildQuickDrawerItem(
  id: QuickDrawerActionId,
  state: GameState,
  ctx: QuickDrawerContext,
  score = 100,
): QuickDrawerItem {
  const issues = alertIssues(state);
  const hasCritical = issues.some((i) => i.severity === "critical");
  const disrepairCount =
    state.mode === "survival" ? state.elements.filter((e) => e.disrepair || e.onFire).length : 0;
  const isGod = state.mode === "god";
  const isNight = state.timeOfDay < 6 || state.timeOfDay >= 19;
  const speedLabel = ctx.simSpeed === 0 ? "Paused" : `Speed ${ctx.simSpeed}×`;

  switch (id) {
    case "bulk_select":
      return {
        id,
        label: ctx.bulkSelectMode ? "Exit Bulk" : "Bulk Select",
        title: ctx.canManualEdit
          ? "Draw to bulk select & delete roads or buildings"
          : "Bulk Select is available in God, Real & Survival modes",
        active: ctx.bulkSelectMode,
        tone: ctx.bulkSelectMode ? "danger" : undefined,
        disabled: !ctx.canManualEdit,
        score,
      };
    case "mode_smart":
      return {
        id,
        label: "Smart Build",
        title: ctx.canManualEdit
          ? "3-click adaptive categories → elements"
          : "Smart Build is available in God, Real & Survival modes",
        active: ctx.canManualEdit && ctx.quickBuildMode === "adaptive",
        tone: ctx.canManualEdit && ctx.quickBuildMode === "adaptive" ? "accent" : undefined,
        stayOpen: true,
        disabled: !ctx.canManualEdit,
        score,
      };
    case "mode_quick":
      return {
        id,
        label: "Quick Build",
        title: ctx.canManualEdit
          ? "2-click super-adaptive elements"
          : "Quick Build is available in God, Real & Survival modes",
        active: ctx.canManualEdit && ctx.quickBuildMode === "instant",
        tone: ctx.canManualEdit && ctx.quickBuildMode === "instant" ? "accent" : undefined,
        stayOpen: true,
        disabled: !ctx.canManualEdit,
        score,
      };
    case "mode_exact":
      return {
        id,
        label: "Exact Build",
        title: ctx.canManualEdit
          ? "4-click non-adaptive 7×7×6 tree"
          : "Exact Build is available in God, Real & Survival modes",
        active: ctx.canManualEdit && ctx.quickBuildMode === "tree",
        tone: ctx.canManualEdit && ctx.quickBuildMode === "tree" ? "accent" : undefined,
        stayOpen: true,
        disabled: !ctx.canManualEdit,
        score,
      };
    case "mode_sculpt":
      return {
        id,
        label: "Quick Sculpt",
        title: ctx.canManualEdit
          ? "1-tap 0.25m voxel sculpt spiral menu"
          : "Quick Sculpt is available in God, Real & Survival modes",
        active: ctx.canManualEdit && ctx.quickBuildMode === "sculpt",
        tone: ctx.canManualEdit && ctx.quickBuildMode === "sculpt" ? "accent" : undefined,
        stayOpen: true,
        disabled: !ctx.canManualEdit,
        score,
      };
    case "sim_speed":
      return {
        id,
        label: speedLabel,
        title: "Cycle simulation speed: 1× → 2× → 4× → Pause",
        active: ctx.simSpeed === 0 || ctx.simSpeed > 1,
        tone: ctx.simSpeed === 0 ? "warn" : undefined,
        stayOpen: true,
        score,
      };
    case "undo":
      return {
        id,
        label: "Undo",
        title: !ctx.canManualEdit
          ? "Undo is available in God, Real & Survival modes"
          : ctx.canUndo
            ? "Undo last building edit"
            : "No building edits to undo yet",
        stayOpen: true,
        disabled: !ctx.canManualEdit || !ctx.canUndo,
        score,
      };
    case "city_issues":
      return {
        id,
        label: issues.length > 0 ? `Alerts (${issues.length})` : "City Health",
        title: issues.length > 0 ? "Jump straight to active city alerts" : "Open City Issues & Supply overview",
        tone: hasCritical ? "danger" : issues.length > 0 ? "warn" : undefined,
        score,
      };
    case "repair_all":
      return {
        id,
        label: disrepairCount > 0 ? `Repair (${disrepairCount})` : "Repair All",
        title:
          state.mode === "survival"
            ? disrepairCount > 0
              ? "Maintain and repair buildings in disrepair"
              : "All buildings are currently maintained"
            : "Repairs are used in Survival mode",
        tone: disrepairCount > 0 ? "warn" : undefined,
        disabled: state.mode !== "survival" || disrepairCount === 0,
        score,
      };
    case "camera_recenter":
      return {
        id,
        label: "Center Map",
        title: "Recenter camera on the island",
        score,
      };
    case "camera_orbit":
      return {
        id,
        label: ctx.autoSpin ? "Stop Spin" : "360° Spin",
        title: "Toggle smooth 360° island orbit",
        active: ctx.autoSpin,
        stayOpen: true,
        score,
      };
    case "heatmap_power":
      return {
        id,
        label: "Power Map",
        title: "Toggle Power coverage layer",
        active: ctx.activeHeatmap === "power",
        stayOpen: true,
        score,
      };
    case "heatmap_water":
      return {
        id,
        label: "Water Map",
        title: "Toggle Water coverage layer",
        active: ctx.activeHeatmap === "water",
        stayOpen: true,
        score,
      };
    case "heatmap_safety":
      return {
        id,
        label: "Safety Map",
        title: "Toggle Police & Fire coverage layer",
        active: ctx.activeHeatmap === "police",
        stayOpen: true,
        score,
      };
    case "heatmap_traffic":
      return {
        id,
        label: "Traffic Map",
        title: "Toggle Traffic & Transit layer",
        active: ctx.activeHeatmap === "traffic",
        stayOpen: true,
        score,
      };
    case "public_works":
      return {
        id,
        label: "Land & Bridges",
        title: ctx.canManualEdit
          ? "Open land, canal & bridge tools"
          : "Public Works is available in God, Real & Survival modes",
        disabled: !ctx.canManualEdit,
        score,
      };
    case "save_slots":
      return {
        id,
        label: "Quick Save",
        title: "Open island save slots",
        score,
      };
    case "handbook":
      return {
        id,
        label: "Handbook",
        title: "Open Mode Playbook & 3D Atlas",
        score,
      };
    case "pix_advise":
      return {
        id,
        label: "Pix Advisor",
        title: "Open live city advisor in Pix Studio",
        score,
      };
    case "quick_edit_order":
      return {
        id,
        label: ctx.quickMenuPrefs.quickEdit.orderMode === "adaptive" ? "QE: Adaptive" : "QE: Fixed",
        title: "Toggle Quick Edit button order between Fixed and Adapt to clicks",
        active: ctx.quickMenuPrefs.quickEdit.orderMode === "adaptive",
        stayOpen: true,
        score,
      };
    case "after_place_qe":
      return {
        id,
        label: ctx.quickMenuPrefs.openQuickEditAfterPlace ? "Auto QE: On" : "Auto QE: Off",
        title: "Toggle opening Quick Edit right after placing",
        active: ctx.quickMenuPrefs.openQuickEditAfterPlace,
        stayOpen: true,
        score,
      };
    case "build_focus":
      return {
        id,
        label: `Focus: ${FOCUS_SHORT[ctx.quickMenuPrefs.smartFocus]}`,
        title: "Cycle Smart/Quick Build focus: Balanced → Needs → Habits → Nearby",
        active: ctx.quickMenuPrefs.smartFocus !== "balanced",
        stayOpen: true,
        score,
      };
    case "weather_cycle":
      return {
        id,
        label: `Weather: ${state.weather[0].toUpperCase() + state.weather.slice(1)}`,
        title: isGod ? "Cycle island weather" : "Weather control is available in God mode",
        stayOpen: true,
        disabled: !isGod,
        score,
      };
    case "day_night":
      return {
        id,
        label: isNight ? "Set Daytime" : "Set Night",
        title: isGod ? "Toggle between bright noon and lit night" : "Time control is available in God mode",
        active: isGod && isNight,
        stayOpen: true,
        disabled: !isGod,
        score,
      };
    case "game_mode":
      return {
        id,
        label: "Switch Mode",
        title: "Switch between God, Real, Survival, Idle & Manager",
        score,
      };
    case "settings":
    default:
      return {
        id: "settings",
        label: "All Settings",
        title: "Open full Settings & Quick Menus customization",
        score,
      };
  }
}

/**
 * Computes the floating quick-access buttons under the far-right HUD icon.
 * - If `prefs?.mode === "manual"`, returns the player's exact chosen buttons in their chosen order
 *   across every game mode (God, Real, Survival, Idle, Manager).
 * - Otherwise (`"adaptive"`), starts with Bulk Select + 3 Quick Menus + Speed + contextual utility
 *   and dynamically adapts all 6 slots across the 25-item catalog as you play.
 */
export function recommendQuickDrawerActions(
  state: GameState,
  ctx: QuickDrawerContext,
  habits: QuickDrawerHabits,
  limit = 6,
  prefs?: QuickDrawerPrefs,
): QuickDrawerItem[] {
  if (prefs?.mode === "manual") {
    const manualList = prefs.manualIds.length > 0 ? prefs.manualIds : DEFAULT_MANUAL_DRAWER_IDS;
    return manualList
      .slice(0, limit)
      .map((id, idx) => buildQuickDrawerItem(id, state, ctx, 200 - idx));
  }

  const issues = alertIssues(state);
  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasPowerIssue =
    issues.some((i) => i.fix?.need === "power") ||
    (state.metrics.powerDemand > 0 && state.metrics.powerSupply < state.metrics.powerDemand);
  const hasWaterIssue =
    issues.some((i) => i.fix?.need === "water") ||
    (state.metrics.waterDemand > 0 && state.metrics.waterSupply < state.metrics.waterDemand);
  const hasSafetyIssue = issues.some((i) => i.fix?.need === "policeRadius" || i.fix?.need === "fireRadius");
  const disrepairCount =
    state.mode === "survival" ? state.elements.filter((e) => e.disrepair || e.onFire).length : 0;
  const isGod = state.mode === "god";
  const stage = state.currentStage;

  // Fresh-start weight fades gently as the player develops personal usage habits,
  // so the starter 6 starts exactly as expected and becomes fully adaptive over time.
  const adaptBlend = Math.min(1, habits.totalUses / 14);
  const defaultAnchor = (base: number) => base * (1 - adaptBlend * 0.58);

  const habitBoost = (id: QuickDrawerActionId): number => {
    const count = habits.actionCounts[id] ?? 0;
    const recentIdx = habits.recentActions.indexOf(id);
    let b = 0;
    if (count > 0) {
      b += Math.min(46, Math.log1p(count) * 14.5 + count * 1.6);
    }
    if (recentIdx >= 0 && recentIdx < 10) {
      b += Math.max(4, 20 - recentIdx * 2);
    }
    return b;
  };

  const candidates: QuickDrawerItem[] = [];
  const push = (id: QuickDrawerActionId, baseScore: number) => {
    candidates.push(buildQuickDrawerItem(id, state, ctx, baseScore + habitBoost(id)));
  };

  // 1. Bulk Select (Default #1 in manual-edit modes)
  if (ctx.canManualEdit) {
    push("bulk_select", (ctx.bulkSelectMode ? 120 : defaultAnchor(96)) + (state.elements.length >= 6 ? 8 : 0));
  }

  // 2–5. The 4 Fast Quick Menus (Smart, Quick, Exact, Quick Sculpt)
  if (ctx.canManualEdit) {
    push("mode_smart", defaultAnchor(92) + (ctx.quickBuildMode === "adaptive" ? 4 : 0));
    push("mode_quick", defaultAnchor(90) + (ctx.quickBuildMode === "instant" ? 4 : 0));
    push("mode_exact", defaultAnchor(88) + (ctx.quickBuildMode === "tree" ? 4 : 0));
    push("mode_sculpt", defaultAnchor(84) + (ctx.quickBuildMode === "sculpt" ? 12 : 0));
  }

  // 5. Simulation Speed (always available in every mode)
  push("sim_speed", defaultAnchor(82) + (ctx.simSpeed === 0 ? 28 : 4));

  // 6+. Simplified Feature & Settings Quick-Access Catalog
  if (ctx.canUndo && ctx.canManualEdit) {
    push("undo", defaultAnchor(76) + 10);
  }
  if (issues.length > 0) {
    push("city_issues", hasCritical ? 86 : 64);
  }
  if (disrepairCount > 0) {
    push("repair_all", 84);
  }

  push("camera_recenter", defaultAnchor(68) + (state.elements.length === 0 ? 6 : 0));
  push("camera_orbit", ctx.autoSpin ? 72 : 30 + (stage >= 8 ? 8 : 0));
  push("heatmap_power", (ctx.activeHeatmap === "power" ? 74 : 26) + (hasPowerIssue ? 44 : 0));
  push("heatmap_water", (ctx.activeHeatmap === "water" ? 74 : 24) + (hasWaterIssue ? 44 : 0));
  push("heatmap_safety", (ctx.activeHeatmap === "police" ? 74 : 22) + (hasSafetyIssue ? 40 : 0) + (stage >= 4 ? 8 : 0));
  push("heatmap_traffic", (ctx.activeHeatmap === "traffic" ? 72 : 20) + (stage >= 5 ? 10 : 0));

  if (ctx.canManualEdit) {
    push("public_works", 34 + (stage >= 3 ? 10 : 0));
  }

  push("save_slots", 34 + (state.elements.length >= 12 ? 12 : 0));
  push("handbook", 32 + (stage <= 2 && state.elements.length < 6 ? 16 : 0));
  push("pix_advise", 28 + (issues.length >= 2 ? 14 : 0));

  push("quick_edit_order", 26);
  push("after_place_qe", 24);
  push("build_focus", 26);

  if (isGod) {
    push("weather_cycle", 36);
    push("day_night", 34);
  }

  push("game_mode", 22);
  push("settings", 28);

  candidates.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return candidates.slice(0, limit);
}
