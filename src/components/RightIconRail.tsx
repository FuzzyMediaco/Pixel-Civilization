import React from "react";
import {
  CloudLightning,
  Compass,
  Crosshair,
  EyeOff,
  Flame,
  Hammer,
  Info,
  LayoutGrid,
  RefreshCw,
  Save,
  Shield,
} from "lucide-react";
import { MAX_SAVE_SLOTS } from "../game/saveSlots";
import { type GameState, type HeatmapKind } from "../game/simulation";

interface RightIconRailProps {
  state: GameState;
  topMenuOpen: boolean;
  bottomMenuOpen: boolean;
  heatmapsOpen: boolean;
  viewEnvOpen: boolean;
  activeHeatmap: HeatmapKind;
  autoSpin: boolean;
  savedCount: number;
  issueCount: number;
  isMerging: boolean;
  onToggleTopMenu: () => void;
  onToggleBottomMenu: () => void;
  onToggleHeatmaps: () => void;
  onToggleWeatherStudio: () => void;
  onToggleDefensePanel: () => void;
  onToggleAutoSpin: () => void;
  onLaunchAttack: () => void;
  onOpenAdvisor: () => void;
  onOpenSaves: () => void;
  onHideAllMenus: () => void;
}

interface RailButtonProps {
  active?: boolean;
  danger?: boolean;
  label: string;
  badge?: string | number;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const RailButton: React.FC<RailButtonProps> = ({
  active,
  danger,
  label,
  badge,
  disabled,
  onClick,
  children,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`group relative flex h-8 w-8 items-center justify-center rounded-lg border shadow-md transition-colors sm:h-9 sm:w-9 ${
      disabled
        ? "cursor-not-allowed border-stone-300 bg-stone-200/80 text-stone-400"
        : danger
          ? "border-rose-700 bg-rose-600 text-white hover:bg-rose-700"
          : active
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-900/15 bg-[#fcfaf5]/95 text-stone-800 hover:border-stone-900/35 hover:bg-white"
    }`}
  >
    {children}
    {badge !== undefined && badge !== 0 && (
      <span className="font-mono-num absolute -left-1.5 -top-1 rounded bg-amber-600 px-1 py-0.5 text-[8px] font-extrabold leading-none text-white shadow-xs">
        {badge}
      </span>
    )}
    <span className="pointer-events-none absolute right-10 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-[11px] font-bold text-white shadow-lg group-hover:block">
      {label}
    </span>
  </button>
);

export const RightIconRail: React.FC<RightIconRailProps> = ({
  state,
  topMenuOpen,
  bottomMenuOpen,
  heatmapsOpen,
  viewEnvOpen,
  activeHeatmap,
  autoSpin,
  savedCount,
  issueCount,
  isMerging,
  onToggleTopMenu,
  onToggleBottomMenu,
  onToggleHeatmaps,
  onToggleWeatherStudio,
  onToggleDefensePanel,
  onToggleAutoSpin,
  onLaunchAttack,
  onOpenAdvisor,
  onOpenSaves,
  onHideAllMenus,
}) => {
  const anyMenuOpen = topMenuOpen || bottomMenuOpen || heatmapsOpen || viewEnvOpen;

  return (
    <nav
      className="pointer-events-auto fixed right-2 top-[calc(50%-1.5rem)] z-35 flex max-h-[calc(100vh-5.5rem)] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto py-0.5"
      aria-label="Island Controls Rail"
    >
      <RailButton
        active={topMenuOpen}
        disabled={isMerging}
        label={topMenuOpen ? "Close Top Menu (T)" : "Open Top Menu (T)"}
        onClick={onToggleTopMenu}
      >
        <LayoutGrid className="h-4 w-4" />
      </RailButton>

      <RailButton
        active={bottomMenuOpen}
        disabled={isMerging}
        label={bottomMenuOpen ? "Close Elements Menu (B)" : "Open Elements Menu (B)"}
        onClick={onToggleBottomMenu}
      >
        <Hammer className="h-4 w-4" />
      </RailButton>

      <RailButton
        active={heatmapsOpen || activeHeatmap !== "none"}
        disabled={isMerging}
        badge={activeHeatmap !== "none" ? "ON" : undefined}
        label="Civilization Heat Maps (H)"
        onClick={onToggleHeatmaps}
      >
        <Flame className="h-4 w-4" />
      </RailButton>

      <RailButton
        active={viewEnvOpen}
        disabled={isMerging}
        label="Weather Studio & 360° View (V)"
        onClick={onToggleWeatherStudio}
      >
        <CloudLightning className="h-4 w-4" />
      </RailButton>

      <RailButton
        active={autoSpin}
        label={autoSpin ? "Stop 360° Auto-Spin" : "Spin Island 360°"}
        onClick={onToggleAutoSpin}
      >
        {autoSpin ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
      </RailButton>

      {(state.metrics.defenseUnlocked || state.mode === "god") && (
        <RailButton
          active={Boolean(state.activeAttack)}
          danger={Boolean(state.activeAttack)}
          badge={state.metrics.defenseUnlocked ? `${state.metrics.defenseRating}%` : undefined}
          label="Defense Metric & Invasion Panel"
          onClick={onToggleDefensePanel}
        >
          <Shield className="h-4 w-4" />
        </RailButton>
      )}

      {state.mode === "god" && (
        <RailButton
          danger={Boolean(state.activeAttack)}
          label={state.activeAttack ? "Send Another Attack Wave" : "Launch Island Attack"}
          onClick={onLaunchAttack}
        >
          <Crosshair className="h-4 w-4" />
        </RailButton>
      )}

      <div className="my-0.5 h-px w-5 bg-stone-900/20" />

      <RailButton
        badge={issueCount > 0 ? issueCount : undefined}
        label="City Info & 20-Stage Advisor"
        onClick={onOpenAdvisor}
      >
        <Info className="h-4 w-4" />
      </RailButton>

      <RailButton
        badge={`${savedCount}/${MAX_SAVE_SLOTS}`}
        label="Saved Civilizations (3 Slots)"
        onClick={onOpenSaves}
      >
        <Save className="h-4 w-4" />
      </RailButton>

      {anyMenuOpen && (
        <RailButton label="Hide All Menus (Clean Island View)" onClick={onHideAllMenus}>
          <EyeOff className="h-4 w-4" />
        </RailButton>
      )}
    </nav>
  );
};
