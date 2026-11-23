import React from "react";
import {
  AlertTriangle,
  BookOpen,
  Car,
  ChevronRight,
  CloudSun,
  Compass,
  Crosshair,
  Droplets,
  FastForward,
  GitBranch,
  Hammer,
  ListChecks,
  Moon,
  Mountain,
  Pause,
  Play,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Undo2,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react";
import { buildingCharges, cityWealth } from "../game/cityEconomy";
import type { CityIssue } from "../game/cityIssues";
import type { QuickDrawerActionId, QuickDrawerItem } from "../game/adaptiveQuickDrawer";
import type { GameState, LimitingNeed } from "../game/simulation";

export type HudStat = "people" | "happy" | "money" | "power";

const compact = (v: number) =>
  new Intl.NumberFormat("en", {
    notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(v) >= 10000 ? 1 : 0,
  }).format(v);

const NEED_NAMES: Record<LimitingNeed, string> = {
  housing: "homes",
  jobs: "jobs",
  food: "food",
  waste: "waste",
  water: "water",
  power: "power",
};

/** Population cap from the simulation, when it reports one. */
export function growthLimit(s: GameState) {
  const lim = s.metrics?.populationLimiter;
  if (!lim || (lim.cap === 0 && s.population === 0)) return undefined;
  return { cap: lim.cap, need: NEED_NAMES[lim.limitingNeed] ?? lim.limitingNeed, atCap: s.population >= 0.97 * lim.cap };
}

export function DrawerActionIcon({ id, speed = 1, size = 14 }: { id: QuickDrawerActionId; speed?: number; size?: number }) {
  switch (id) {
    case "bulk_select":
      return <ListChecks size={size} aria-hidden="true" />;
    case "mode_smart":
      return <Sparkles size={size} aria-hidden="true" />;
    case "mode_quick":
      return <Zap size={size} aria-hidden="true" />;
    case "mode_exact":
      return <GitBranch size={size} aria-hidden="true" />;
    case "mode_sculpt":
      return <Mountain size={size} aria-hidden="true" />;
    case "sim_speed":
      return speed === 0 ? (
        <Pause size={size} aria-hidden="true" />
      ) : speed > 1 ? (
        <FastForward size={size} aria-hidden="true" />
      ) : (
        <Play size={size} aria-hidden="true" />
      );
    case "undo":
      return <Undo2 size={size} aria-hidden="true" />;
    case "city_issues":
      return <AlertTriangle size={size} aria-hidden="true" />;
    case "repair_all":
      return <Wrench size={size} aria-hidden="true" />;
    case "camera_recenter":
      return <Crosshair size={size} aria-hidden="true" />;
    case "camera_orbit":
      return <RefreshCw size={size} aria-hidden="true" />;
    case "heatmap_power":
      return <Zap size={size} aria-hidden="true" />;
    case "heatmap_water":
      return <Droplets size={size} aria-hidden="true" />;
    case "heatmap_safety":
      return <Shield size={size} aria-hidden="true" />;
    case "heatmap_traffic":
      return <Car size={size} aria-hidden="true" />;
    case "public_works":
      return <Hammer size={size} aria-hidden="true" />;
    case "save_slots":
      return <Save size={size} aria-hidden="true" />;
    case "handbook":
      return <BookOpen size={size} aria-hidden="true" />;
    case "pix_advise":
      return <Wand2 size={size} aria-hidden="true" />;
    case "quick_edit_order":
      return <Sliders size={size} aria-hidden="true" />;
    case "after_place_qe":
      return <Target size={size} aria-hidden="true" />;
    case "build_focus":
      return <Compass size={size} aria-hidden="true" />;
    case "weather_cycle":
      return <CloudSun size={size} aria-hidden="true" />;
    case "day_night":
      return <Moon size={size} aria-hidden="true" />;
    case "game_mode":
      return <Sun size={size} aria-hidden="true" />;
    case "settings":
    default:
      return <Settings size={size} aria-hidden="true" />;
  }
}

/**
 * Slim top status bar:
 *  - Four compact floating status chips (people, happy, treasury/wealth, power)
 *  - Compact Pix button (sparkles + "Pix")
 *  - Far-right icon-only Quick Drawer button that drops down 6 floating pills
 *    with NO background container directly over the map (Adaptive or Manual in every mode).
 */
export function Hud({
  state,
  speed,
  onStat,
  onOpenPix,
  quickDrawerOpen,
  quickDrawerManual,
  bulkSelectActive,
  drawerItems,
  onToggleQuickDrawer,
  onPickDrawerItem,
  onCustomizeQuickDrawer,
  hiddenForRing,
}: {
  state: GameState;
  speed: number;
  onStat: (s: HudStat) => void;
  onOpenPix?: () => void;
  quickDrawerOpen: boolean;
  quickDrawerManual?: boolean;
  bulkSelectActive?: boolean;
  drawerItems: QuickDrawerItem[];
  onToggleQuickDrawer: () => void;
  onPickDrawerItem: (item: QuickDrawerItem) => void;
  onCustomizeQuickDrawer?: () => void;
  hiddenForRing?: boolean;
}) {
  const m = state.metrics;
  const limit = growthLimit(state);
  const charges = buildingCharges(state);
  const powerSupply = m.powerSupplySteady ?? m.powerSupply;
  const powerNet = Math.round(powerSupply - m.powerDemand);
  const happyTone = state.happiness < 55 ? " is-bad" : state.happiness < 70 ? " is-warn" : "";

  return (
    <header
      className={"ui-hud" + (hiddenForRing ? " is-chrome-hidden" : "")}
      aria-label="City status"
      aria-hidden={hiddenForRing || undefined}
      // @ts-expect-error inert prevents focus/hit-test during coordinated ring fade-out
      inert={hiddenForRing ? "" : undefined}
    >
      <div className="ui-hud-stats">
        <button
          type="button"
          className={"ui-stat" + (limit?.atCap ? " is-warn" : "")}
          onClick={() => onStat("people")}
          aria-label={
            "Population " +
            state.population.toLocaleString() +
            (limit ? ", room for " + limit.cap.toLocaleString() + ", limited by " + limit.need : "")
          }
        >
          <b>{compact(state.population)}</b>
          <small>{limit?.atCap ? "max · " + limit.need : "people"}</small>
        </button>
        <button
          type="button"
          className={"ui-stat" + happyTone}
          onClick={() => onStat("happy")}
          aria-label={"Happiness " + Math.round(state.happiness) + " percent, show why"}
        >
          <b>{Math.round(state.happiness)}%</b>
          <small>happy</small>
        </button>
        <button
          type="button"
          className={"ui-stat" + (charges && state.money < 0 ? " is-bad" : "")}
          onClick={() => onStat("money")}
          aria-label={
            charges
              ? "Treasury $" + Math.floor(state.money).toLocaleString()
              : "City wealth $" + Math.floor(cityWealth(state)).toLocaleString()
          }
        >
          <b>${compact(Math.floor(charges ? state.money : cityWealth(state)))}</b>
          <small>{charges ? "treasury" : "wealth"}</small>
        </button>
        <button
          type="button"
          className={"ui-stat" + (m.powerDemand > 0 && powerNet < 0 ? " is-bad" : "")}
          onClick={() => onStat("power")}
          aria-label={"Power " + Math.round(powerSupply) + " supplied for " + Math.round(m.powerDemand) + " demand"}
        >
          <b>{m.powerDemand > 0 ? (powerNet >= 0 ? "+" : "−") + compact(Math.abs(powerNet)) : "—"}</b>
          <small>power</small>
        </button>
      </div>

      {onOpenPix && (
        <button
          type="button"
          className="ui-pix-trigger"
          onClick={onOpenPix}
          aria-label="Open PixBuilder Studio and Pix Advisor"
          title="PixBuilder Studio & Advisor"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Pix</span>
        </button>
      )}

      <div className="ui-hud-quick-anchor">
        <button
          type="button"
          className={
            "ui-quick-trigger" +
            (quickDrawerOpen ? " is-open" : "") +
            (bulkSelectActive ? " is-bulk" : "") +
            (speed === 0 ? " is-paused" : "")
          }
          aria-expanded={quickDrawerOpen}
          aria-haspopup="menu"
          aria-label="Quick tools & menus"
          title={quickDrawerManual ? "Quick menu (Manual slots)" : "Quick menu (Adaptive)"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleQuickDrawer();
          }}
        >
          <ListChecks size={17} strokeWidth={2.25} aria-hidden="true" />
        </button>

        {quickDrawerOpen && drawerItems.length > 0 && (
          <div
            className="ui-hud-drawer"
            role="menu"
            aria-label={quickDrawerManual ? "Manual quick actions" : "Adaptive quick actions"}
          >
            {drawerItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={
                  "ui-hud-drop-btn" +
                  (item.active ? " is-active" : "") +
                  (item.tone ? ` is-${item.tone}` : "")
                }
                style={{ "--drop-idx": idx } as React.CSSProperties}
                title={item.title}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onPickDrawerItem(item);
                }}
              >
                <DrawerActionIcon id={item.id} speed={speed} />
                <span>{item.label}</span>
              </button>
            ))}
            {onCustomizeQuickDrawer && (
              <button
                type="button"
                role="menuitem"
                className="ui-hud-drop-btn is-customize"
                style={{ "--drop-idx": drawerItems.length } as React.CSSProperties}
                aria-label="Customize Top-Right Quick Menu"
                title={quickDrawerManual ? "Edit manual buttons or switch to Adaptive" : "Switch to Manual & pick buttons"}
                onClick={(e) => {
                  e.stopPropagation();
                  onCustomizeQuickDrawer();
                }}
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/** Shown only when something is wrong. */
export function AlertPill({ issues, onOpen }: { issues: CityIssue[]; onOpen: () => void }) {
  if (!issues.length) return null;
  const top = issues[0];
  const title = top.title.replace(/\s*\(\d[\d,]*\/\d[\d,]*\)$/, "");
  return (
    <button
      type="button"
      className={"ui-alert" + (top.severity === "critical" ? "" : " is-info")}
      onClick={onOpen}
      aria-label={"City issues: " + top.title + (issues.length > 1 ? " and " + (issues.length - 1) + " more" : "")}
    >
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        {title}
        {issues.length > 1 ? " · " + (issues.length - 1) + " more" : ""}
      </span>
      <span className="ui-alert-count">{issues.length}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}
