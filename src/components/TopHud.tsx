import {cityWealth, economyOf} from "../game/cityEconomy";
import React, { useState } from "react";
import {
  Car,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudLightning,
  CloudRain,
  Crosshair,
  Heart,
  Info,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Shield,
  Siren,
  Sun,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { STAGES } from "../game/catalog";
import { type GameState, formatTimeOfDay, isNightTime } from "../game/simulation";

interface TopHudProps {
  open: boolean;
  state: GameState;
  simSpeed: number;
  autoSpin: boolean;
  onChangeSimSpeed: (speed: number) => void;
  onSpinLeft: () => void;
  onSpinRight: () => void;
  onToggleAutoSpin: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
  onOpenWeatherStudio: () => void;
  onToggleDayNight: () => void;
  onToggleGodCrime?: () => void;
  onOpenDefenseTab: () => void;
  onOpenAdvisor: () => void;
  onOpenScore?: (tab:"population"|"happiness"|"wealth")=>void;
  onMaintainAll: () => void;
  onClose: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  open,
  state,
  simSpeed,
  autoSpin,
  onChangeSimSpeed,
  onSpinLeft,
  onSpinRight,
  onToggleAutoSpin,
  onZoomIn,
  onZoomOut,
  onRecentre,
  onOpenWeatherStudio,
  onToggleDayNight,
  onToggleGodCrime,
  onOpenDefenseTab,
  onOpenAdvisor,
  onOpenScore,
  onMaintainAll,
  onClose,
}) => {
  const [controlsOpen, setControlsOpen] = useState(false);
  if (!open) return null;

  const m = state.metrics;
  const stageObj = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const issueCount = state.diagnostics.filter(
    (d) => d.severity === "critical" || d.severity === "warning",
  ).length;
  const urgentMaintCount = m.disrepairCount + m.burningCount;

  const happyColor =
    state.happiness >= 75
      ? "text-emerald-700"
      : state.happiness >= 55
        ? "text-amber-700"
        : "text-rose-700";

  const night = isNightTime(state.timeOfDay ?? 10.5);
  const WeatherIcon =
    state.weather === "storm"
      ? CloudLightning
      : state.weather === "rain"
        ? CloudRain
        : state.weather === "cloudy"
          ? Cloud
          : Sun;

  const nextSpeed = simSpeed === 0 ? 1 : simSpeed === 1 ? 2 : simSpeed === 2 ? 4 : 0;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-end p-1.5 pl-12 pr-13 sm:p-2 sm:pl-14 sm:pr-15">
      <div className="pointer-events-auto w-auto max-w-full rounded-lg border border-stone-900/15 bg-[#fcfaf5]/96 px-2 py-1 shadow-md">
        {/* Primary Zero-Scroll Metrics Row (Right-Aligned for Right-Handed Thumb Reach) */}
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {/* Close Top Bar on Left Edge */}
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-stone-300 bg-white p-0.5 text-stone-600 hover:bg-stone-100"
            title="Close Top Menu (T)"
            aria-label="Close Top Menu"
          >
            <X className="h-3 w-3" />
          </button>

          {/* Stage / Mode Label on Desktop */}
          <div className="hidden items-center gap-1.5 border-r border-stone-200 pr-2 lg:flex">
            <span className="font-mono-num text-[11px] font-extrabold text-stone-900">
              {state.mode === "god" ? "God Mode" : `S${stageObj.stage} · ${stageObj.name}`}
            </span>
          </div>

          <button onClick={()=>onOpenScore?.("population")} className="flex items-center gap-0.5" title="Population and jobs">
            <Users className="h-3.5 w-3.5 text-sky-700"/><b className="font-mono-num text-xs">{state.population.toLocaleString()}{economyOf(state).holds.some(h=>h.key==="population")&&" · Held"}</b>
          </button>
          <button onClick={()=>onOpenScore?.("happiness")} className="flex items-center gap-0.5" title="Happiness and household needs">
            <Heart className={`h-3.5 w-3.5 ${happyColor}`}/><b className={`font-mono-num text-xs ${happyColor}`}>{state.happiness}%{economyOf(state).holds.some(h=>h.key==="happiness")&&" · Held"}</b>
          </button>
          <button onClick={()=>onOpenScore?.("wealth")} className="flex items-center gap-0.5" title={"City wealth · treasury $"+Math.floor(state.money).toLocaleString()}>
            <Wallet className="h-3.5 w-3.5 text-amber-700"/><b className="font-mono-num text-xs">${Math.floor(cityWealth(state)).toLocaleString()}{economyOf(state).holds.some(h=>["treasury","businesses","households"].includes(h.key))&&" · Held"}</b>
          </button>

          {/* Live power (solar follows the sun, wind follows the weather) */}
          {m.powerDemand > 0 && (
            <div
              className="flex items-center gap-0.5"
              title={`Power ${m.powerSupply}/${m.powerDemand} · ${m.renewablePct ?? 0}% renewable · solar ${Math.round((m.solarFactor ?? 1) * 100)}% · wind ${Math.round((m.windFactor ?? 1) * 100)}%`}
            >
              <Zap className={`h-3.5 w-3.5 ${m.powerSupply >= m.powerDemand ? "text-yellow-600" : "text-rose-600"}`} />
              <span
                className={`font-mono-num text-xs font-extrabold ${m.powerSupply >= m.powerDemand ? "text-stone-900" : "text-rose-700"}`}
              >
                {Math.round((m.powerSupply / Math.max(1, m.powerDemand)) * 100)}%
              </span>
            </div>
          )}

          {/* Traffic congestion */}
          {(m.trafficTrips ?? 0) > 10 && (
            <div
              className="flex items-center gap-0.5"
              title={`Traffic: ${m.trafficTrips} trips vs ${m.trafficCapacity} road capacity · ${m.transitShare ?? 0}% on transit`}
            >
              <Car
                className={`h-3.5 w-3.5 ${(m.congestion ?? 0) <= 70 ? "text-emerald-700" : (m.congestion ?? 0) <= 100 ? "text-amber-600" : "text-rose-600"}`}
              />
              <span
                className={`font-mono-num text-xs font-extrabold ${(m.congestion ?? 0) <= 70 ? "text-stone-900" : (m.congestion ?? 0) <= 100 ? "text-amber-700" : "text-rose-700"}`}
              >
                {m.congestion ?? 0}%
              </span>
            </div>
          )}

          {/* Crime Metric: Toggleable ON/OFF in God Mode, or Stage 5+ in Real/Survival */}
          {state.mode === "god" && onToggleGodCrime ? (
            <button
              type="button"
              onClick={onToggleGodCrime}
              className={`flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors ${
                state.godCrimeEnabled
                  ? "bg-rose-50 hover:bg-rose-100"
                  : "opacity-65 hover:bg-stone-200/70 hover:opacity-100"
              }`}
              title={
                state.godCrimeEnabled
                  ? `Crime ON (${m.crimeRate}%) — Tap to turn Crime OFF`
                  : "Crime OFF — Tap to turn Crime ON"
              }
            >
              <Siren
                className={`h-3.5 w-3.5 ${
                  !state.godCrimeEnabled
                    ? "text-stone-400"
                    : m.isNightCrimeSurge
                      ? "text-rose-600"
                      : "text-blue-700"
                }`}
              />
              <span
                className={`font-mono-num text-xs font-extrabold ${
                  !state.godCrimeEnabled
                    ? "text-stone-500"
                    : m.crimeRate <= 15
                      ? "text-emerald-700"
                      : m.crimeRate <= 40
                        ? "text-amber-700"
                        : "text-rose-700"
                }`}
              >
                {state.godCrimeEnabled ? `${m.crimeRate}%` : "Off"}
              </span>
            </button>
          ) : (
            m.crimeUnlocked && (
              <div
                className="flex items-center gap-0.5"
                title={
                  m.isNightCrimeSurge
                    ? `Nighttime Crime Surge: ${m.crimeRate}%`
                    : `Crime Rate: ${m.crimeRate}%`
                }
              >
                <Siren className={`h-3.5 w-3.5 ${m.isNightCrimeSurge ? "text-rose-600" : "text-blue-700"}`} />
                <span
                  className={`font-mono-num text-xs font-extrabold ${
                    m.crimeRate <= 15
                      ? "text-emerald-700"
                      : m.crimeRate <= 40
                        ? "text-amber-700"
                        : "text-rose-700"
                  }`}
                >
                  {m.crimeRate}%
                </span>
              </div>
            )
          )}

          {/* Defense Metric (Stage 10+ in Real/Survival, always in God Mode) */}
          {m.defenseUnlocked && (
            <button
              type="button"
              onClick={onOpenDefenseTab}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-stone-200/70"
              title={`Defense Readiness ${m.defenseRating}% · ${m.soldiersCount} Soldiers, ${m.tanksCount} Tanks, ${m.navalBoatsCount} Boats, ${m.copsCount} Cops, ${m.swatCount} SWAT`}
            >
              <Shield
                className={`h-3.5 w-3.5 ${
                  m.defenseRating >= 75
                    ? "text-emerald-700"
                    : m.defenseRating >= 35
                      ? "text-amber-600"
                      : "text-rose-600"
                }`}
              />
              <span
                className={`font-mono-num text-xs font-extrabold ${
                  m.defenseRating >= 75
                    ? "text-emerald-700"
                    : m.defenseRating >= 35
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {m.defenseRating}%
              </span>
            </button>
          )}

          {/* Maintain All (Survival) */}
          {state.mode === "survival" && urgentMaintCount > 0 && (
            <button
              type="button"
              onClick={onMaintainAll}
              className="flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700"
              title="Maintain all & put out fires"
            >
              <Wrench className="h-3 w-3" />
              <span className="font-mono-num">{urgentMaintCount}</span>
            </button>
          )}

          {/* City Advisor (Right-Handed Position) */}
          <button
            type="button"
            onClick={onOpenAdvisor}
            className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-bold ${
              issueCount > 0
                ? "border-amber-400 bg-amber-50 text-amber-900"
                : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
            }`}
            title="City Advisor & 20 Stages"
          >
            <Info className="h-3 w-3" />
            {issueCount > 0 && <span className="font-mono-num">{issueCount}</span>}
          </button>

          {/* Nested Quick Controls Drawer Toggle (Rightmost Closest to Thumb) */}
          <button
            type="button"
            onClick={() => setControlsOpen((c) => !c)}
            className={`rounded border p-0.5 transition-colors ${
              controlsOpen
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
            }`}
            title={controlsOpen ? "Hide Quick Controls" : "Show Time, Speed & Camera Controls"}
            aria-label={controlsOpen ? "Hide Quick Controls" : "Show Quick Controls"}
          >
            {controlsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nested Expandable Second Row: Right-Aligned Controls */}
        {controlsOpen && (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 border-t border-stone-200 pt-1">
            <span className="font-mono-num mr-auto text-[10px] font-bold text-stone-600 lg:hidden">
              {state.mode === "god" ? "God Sandbox" : `S${stageObj.stage} · ${stageObj.name}`}
            </span>

            {/* Zoom + Center */}
            <div className="flex items-center rounded border border-stone-300 bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={onRecentre}
                className="rounded p-0.5 text-stone-700 hover:bg-stone-200"
                title="Recenter Island"
                aria-label="Recenter Island"
              >
                <Crosshair className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onZoomOut}
                className="rounded p-0.5 text-stone-700 hover:bg-stone-200"
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                className="rounded p-0.5 text-stone-700 hover:bg-stone-200"
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>

            {/* 360° Spin */}
            <div className="flex items-center rounded border border-stone-300 bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={onSpinLeft}
                className="rounded p-0.5 text-stone-700 hover:bg-stone-200"
                title="Spin Left"
                aria-label="Spin Left"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onToggleAutoSpin}
                className={`rounded px-1 py-0.5 text-[10px] font-extrabold ${
                  autoSpin ? "bg-sky-700 text-white" : "text-stone-700 hover:bg-stone-200"
                }`}
                title="360° Auto-Spin"
              >
                {autoSpin ? <RefreshCw className="h-3 w-3 animate-spin" /> : "360°"}
              </button>
              <button
                type="button"
                onClick={onSpinRight}
                className="rounded p-0.5 text-stone-700 hover:bg-stone-200"
                title="Spin Right"
                aria-label="Spin Right"
              >
                <RotateCw className="h-3 w-3" />
              </button>
            </div>

            {/* Day/Night + Weather Studio */}
            <div className="flex items-center gap-0.5 rounded border border-stone-300 bg-stone-100 p-0.5">
              <button
                type="button"
                onClick={onToggleDayNight}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold text-stone-700 hover:bg-stone-200"
                title={`Toggle Day / Night (${formatTimeOfDay(state.timeOfDay ?? 10.5)})`}
              >
                {night ? (
                  <Moon className="h-3 w-3 text-indigo-600" />
                ) : (
                  <Sun className="h-3 w-3 text-amber-500" />
                )}
                <span className="font-mono-num text-[10px]">
                  {formatTimeOfDay(state.timeOfDay ?? 10.5)}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenWeatherStudio}
                className="rounded p-0.5 text-sky-700 hover:bg-stone-200"
                title="Open Weather Studio"
                aria-label="Open Weather Studio"
              >
                <WeatherIcon className="h-3 w-3" />
              </button>
            </div>

            {/* Sim Speed Cycle (Closest to Right Thumb) */}
            <button
              type="button"
              onClick={() => onChangeSimSpeed(nextSpeed)}
              className="font-mono-num flex items-center gap-0.5 rounded border border-stone-300 bg-stone-900 px-1.5 py-0.5 text-[11px] font-extrabold text-white hover:bg-stone-800"
              title="Cycle Speed (Pause / 1× / 2× / 4×)"
            >
              {simSpeed === 0 ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{simSpeed === 0 ? "0×" : `${simSpeed}×`}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
