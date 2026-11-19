import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  Crosshair,
  Eye,
  Lock,
  Moon,
  Move,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Shield,
  ShieldAlert,
  Sun,
  Sunrise,
  Sunset,
  Unlock,
  Wind,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CRIME_UNLOCK_MIN_POP, CRIME_UNLOCK_STAGE } from "../game/catalog";
import { type GameState, type WeatherKind, formatTimeOfDay, isNightTime } from "../game/simulation";
import { type CameraMode } from "../game/worldRenderer";

export type ViewEnvTab = "weather" | "camera" | "defense";

interface ViewEnvPanelProps {
  open: boolean;
  activeTab: ViewEnvTab;
  state: GameState;
  cameraMode: CameraMode;
  autoSpin: boolean;
  attackSeverity: number;
  onChangeTab: (tab: ViewEnvTab) => void;
  onChangeCameraMode: (mode: CameraMode) => void;
  onSpinLeft: () => void;
  onSpinRight: () => void;
  onToggleAutoSpin: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
  onSetTimeOfDay: (hour: number) => void;
  onToggleTimeLocked: () => void;
  onSetWeather: (weather: WeatherKind) => void;
  onToggleWeatherLocked: () => void;
  onSetWeatherIntensity: (val: number) => void;
  onSetWindSpeed: (val: number) => void;
  onTriggerLightning: () => void;
  onChangeAttackSeverity: (severity: number) => void;
  onLaunchAttack: (severity: number) => void;
  onClearAttack: () => void;
  onToggleGodCrime?: () => void;
  onTriggerCrime?: () => void;
  onClose: () => void;
}

const WEATHER_BTNS: {
  id: WeatherKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "clear", label: "Sunny", icon: Sun },
  { id: "cloudy", label: "Cloudy", icon: Cloud },
  { id: "rain", label: "Rain", icon: CloudRain },
  { id: "storm", label: "Storm", icon: CloudLightning },
];

const TIME_PRESETS = [
  { label: "Dawn", hour: 6.2, icon: Sunrise },
  { label: "Day", hour: 12.0, icon: Sun },
  { label: "Sunset", hour: 18.2, icon: Sunset },
  { label: "Night", hour: 23.0, icon: Moon },
];

export const ViewEnvPanel: React.FC<ViewEnvPanelProps> = ({
  open,
  activeTab,
  state,
  cameraMode,
  autoSpin,
  attackSeverity,
  onChangeTab,
  onChangeCameraMode,
  onSpinLeft,
  onSpinRight,
  onToggleAutoSpin,
  onZoomIn,
  onZoomOut,
  onRecentre,
  onSetTimeOfDay,
  onToggleTimeLocked,
  onSetWeather,
  onToggleWeatherLocked,
  onSetWeatherIntensity,
  onSetWindSpeed,
  onTriggerLightning,
  onChangeAttackSeverity,
  onLaunchAttack,
  onClearAttack,
  onToggleGodCrime,
  onTriggerCrime,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;

  const m = state.metrics;
  const night = isNightTime(state.timeOfDay ?? 10.5);
  const intensity = state.weatherIntensity ?? 1.0;
  const wind = state.windSpeed ?? 1.0;

  return (
    <aside
      className={`pointer-events-auto fixed right-13 top-14 z-30 max-w-[calc(100vw-4.5rem)] overflow-y-auto rounded-xl border border-stone-900/20 bg-[#fcfaf5]/96 p-2.5 shadow-2xl transition-all ${
        expanded ? "max-h-[calc(100vh-8rem)] w-80 sm:w-96" : "max-h-[46vh] w-68"
      }`}
    >
      {/* Compact Header + Tabs */}
      <div className="flex items-center justify-between gap-1.5 border-b border-stone-200 pb-2">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-md bg-stone-200/75 p-0.5">
          <button
            type="button"
            onClick={() => onChangeTab("weather")}
            className={`flex items-center justify-center gap-1 rounded py-1 text-[10px] font-extrabold transition-colors ${
              activeTab === "weather" ? "bg-stone-900 text-white shadow-xs" : "text-stone-700 hover:bg-white/70"
            }`}
          >
            <CloudLightning className="h-3 w-3" />
            <span>Weather</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("camera")}
            className={`flex items-center justify-center gap-1 rounded py-1 text-[10px] font-extrabold transition-colors ${
              activeTab === "camera" ? "bg-stone-900 text-white shadow-xs" : "text-stone-700 hover:bg-white/70"
            }`}
          >
            <Compass className="h-3 w-3" />
            <span>360°</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("defense")}
            className={`flex items-center justify-center gap-1 rounded py-1 text-[10px] font-extrabold transition-colors ${
              activeTab === "defense" ? "bg-stone-900 text-white shadow-xs" : "text-stone-700 hover:bg-white/70"
            }`}
          >
            <Shield className="h-3 w-3" />
            <span>Defense</span>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md border border-stone-300 bg-white p-1 text-stone-600 hover:bg-stone-100"
            title={expanded ? "Compact Panel" : "Expand Panel"}
            aria-label={expanded ? "Compact Panel" : "Expand Panel"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 bg-white p-1 text-stone-600 hover:bg-stone-100"
            title="Close Studio Drawer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* TAB 1: WEATHER STUDIO */}
      {activeTab === "weather" && (
        <div className="mt-2.5 space-y-2.5">
          {/* Weather Presets + Lock */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                Weather Studio
              </span>
              <button
                type="button"
                onClick={onToggleWeatherLocked}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                  state.weatherLocked
                    ? "border-amber-600 bg-amber-100 text-amber-900"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }`}
                title={state.weatherLocked ? "Weather locked" : "Weather cycles automatically"}
              >
                {state.weatherLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                <span>{state.weatherLocked ? "Locked" : "Auto"}</span>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {WEATHER_BTNS.map((w) => {
                const Icon = w.icon;
                const active = state.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSetWeather(w.id)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border py-1 text-[10px] font-bold transition-colors ${
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 24h Time Scrubber + Lock */}
          <div className="border-t border-stone-200 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono-num flex items-center gap-1 text-[11px] font-extrabold text-stone-900">
                {night ? <Moon className="h-3 w-3 text-indigo-600" /> : <Sun className="h-3 w-3 text-amber-500" />}
                {formatTimeOfDay(state.timeOfDay ?? 10.5)}
              </span>
              <button
                type="button"
                onClick={onToggleTimeLocked}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                  state.timeLocked
                    ? "border-indigo-600 bg-indigo-100 text-indigo-900"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }`}
                title={state.timeLocked ? "Clock frozen" : "Day/Night clock advancing"}
              >
                {state.timeLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                <span>{state.timeLocked ? "Frozen" : "Live"}</span>
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={23.9}
              step={0.1}
              value={state.timeOfDay ?? 10.5}
              onChange={(e) => onSetTimeOfDay(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer accent-stone-900"
              aria-label="Time of Day Slider"
            />
            <div className="mt-1 grid grid-cols-4 gap-1">
              {TIME_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onSetTimeOfDay(p.hour)}
                    className="flex items-center justify-center gap-1 rounded border border-stone-300 bg-white py-1 text-[10px] font-bold text-stone-800 hover:bg-stone-100"
                  >
                    <Icon className="h-3 w-3 text-stone-600" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Intensity & Wind Sliders + Manual Lightning */}
          <div className="space-y-2 border-t border-stone-200 pt-2">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-stone-700">
                <span>Weather Intensity</span>
                <span className="font-mono-num">{Math.round(intensity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={1.5}
                step={0.05}
                value={intensity}
                onChange={(e) => onSetWeatherIntensity(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-sky-700"
                aria-label="Weather Intensity"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-stone-700">
                <span className="flex items-center gap-1">
                  <Wind className="h-3 w-3 text-sky-700" />
                  Wind Speed
                </span>
                <span className="font-mono-num">{wind.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.1}
                value={wind}
                onChange={(e) => onSetWindSpeed(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-sky-700"
                aria-label="Wind Speed"
              />
            </div>

            <button
              type="button"
              onClick={onTriggerLightning}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-400 bg-indigo-50 py-1.5 text-[11px] font-extrabold text-indigo-900 hover:bg-indigo-100"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Trigger Lightning Strike</span>
            </button>
          </div>

          {night && m.crimeUnlocked && (
            <div className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-900">
              Night Crime Surge Active (+45% risk)
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 360 CAMERA */}
      {activeTab === "camera" && (
        <div className="mt-2.5 space-y-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
            360° Island Camera & Zoom
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: "pan", label: "Pan", icon: Move },
                { id: "orbit", label: "Orbit", icon: Compass },
                { id: "walk", label: "Walk", icon: Eye },
              ] as const
            ).map((c) => {
              const Icon = c.icon;
              const active = cameraMode === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChangeCameraMode(c.id)}
                  className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] font-bold transition-colors ${
                    active
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={onSpinLeft}
              className="flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1.5 text-[11px] font-bold text-stone-800 hover:bg-stone-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>-45°</span>
            </button>
            <button
              type="button"
              onClick={onToggleAutoSpin}
              className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-[11px] font-bold transition-colors ${
                autoSpin
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${autoSpin ? "animate-spin" : ""}`} />
              <span>360°</span>
            </button>
            <button
              type="button"
              onClick={onSpinRight}
              className="flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1.5 text-[11px] font-bold text-stone-800 hover:bg-stone-100"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>+45°</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={onZoomIn}
              className="flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1.5 text-[11px] font-bold text-stone-800 hover:bg-stone-100"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              <span>In</span>
            </button>
            <button
              type="button"
              onClick={onZoomOut}
              className="flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1.5 text-[11px] font-bold text-stone-800 hover:bg-stone-100"
            >
              <ZoomOut className="h-3.5 w-3.5" />
              <span>Out</span>
            </button>
            <button
              type="button"
              onClick={onRecentre}
              className="flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1.5 text-[11px] font-bold text-stone-800 hover:bg-stone-100"
            >
              <span>Center</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DEFENSE METRIC & ATTACK */}
      {activeTab === "defense" && (
        <div className="mt-2.5 space-y-2.5">
          {/* Readiness Bar */}
          <div className="rounded-lg border border-stone-200 bg-white p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                Defense Metric
              </span>
              <span
                className={`font-mono-num text-xs font-extrabold ${
                  m.defenseRating >= 75
                    ? "text-emerald-700"
                    : m.defenseRating >= 35
                      ? "text-amber-700"
                      : "text-rose-700"
                }`}
              >
                {m.defenseRating}% Ready
              </span>
            </div>

            <div className="mt-1 h-2 w-full overflow-hidden rounded-xs bg-stone-200">
              <div
                className={`h-full transition-all ${
                  m.defenseRating >= 75
                    ? "bg-emerald-600"
                    : m.defenseRating >= 35
                      ? "bg-amber-500"
                      : "bg-rose-600"
                }`}
                style={{ width: `${m.defenseRating}%` }}
              />
            </div>

            <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-stone-500">
              <span className="font-mono-num">Power: {m.defensePower}</span>
              <span className="font-mono-num">Target: {m.requiredDefensePower}</span>
            </div>
          </div>

          {/* Defender Forces Roster */}
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="rounded border border-emerald-200 bg-emerald-50/70 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-emerald-900">
                {m.soldiersCount}
              </div>
              <div className="text-[9px] font-bold text-emerald-700">Soldiers</div>
            </div>
            <div className="rounded border border-emerald-200 bg-emerald-50/70 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-emerald-900">
                {m.tanksCount}
              </div>
              <div className="text-[9px] font-bold text-emerald-700">Tanks</div>
            </div>
            <div className="rounded border border-sky-200 bg-sky-50/70 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-sky-900">
                {m.navalBoatsCount}
              </div>
              <div className="text-[9px] font-bold text-sky-700">Naval</div>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50/60 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-blue-900">
                {m.copsCount}
              </div>
              <div className="text-[9px] font-bold text-blue-700">Police</div>
            </div>
            <div className="rounded border border-indigo-200 bg-indigo-50/60 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-indigo-900">
                {m.swatCount}
              </div>
              <div className="text-[9px] font-bold text-indigo-700">SWAT</div>
            </div>
            <div className="rounded border border-stone-200 bg-stone-100 px-1 py-1">
              <div className="font-mono-num text-xs font-extrabold text-stone-900">
                {m.totalDefenders}
              </div>
              <div className="text-[9px] font-bold text-stone-600">Total</div>
            </div>
          </div>

          <p className="text-[10px] leading-snug text-stone-500">
            Military & naval bases supply most island defense; police & SWAT pitch in with minor support during raids.
          </p>

          {/* Attack Modulator (God Mode) vs Stage Preset (Real / Survival) */}
          <div className="border-t border-stone-200 pt-2">
            {state.mode === "god" ? (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-stone-800">
                    <span className="uppercase tracking-wider text-rose-700">
                      Attack Severity
                    </span>
                    <span className="font-mono-num rounded bg-rose-100 px-1.5 py-0.5 text-rose-900">
                      Lv {attackSeverity.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.5}
                    value={attackSeverity}
                    onChange={(e) => onChangeAttackSeverity(Number(e.target.value))}
                    className="mt-1 h-1.5 w-full cursor-pointer accent-rose-600"
                    aria-label="Attack Severity"
                  />
                </div>

                {state.activeAttack ? (
                  <div className="space-y-1.5 rounded-lg border border-rose-300 bg-rose-50 p-2">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-rose-900">
                      <span className="flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Wave Active
                      </span>
                      <span className="font-mono-num">
                        {state.activeAttack.units.length} vs {state.activeAttack.defenders.length}
                      </span>
                    </div>
                    <div className="font-mono-num text-[10px] text-rose-800">
                      Lost Buildings: {state.activeAttack.buildingsDestroyed} · Pop:{" "}
                      {state.activeAttack.casualties}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => onLaunchAttack(attackSeverity)}
                        className="rounded bg-rose-600 py-1 text-[10px] font-extrabold text-white hover:bg-rose-700"
                      >
                        +Reinforce
                      </button>
                      <button
                        type="button"
                        onClick={onClearAttack}
                        className="rounded border border-rose-400 bg-white py-1 text-[10px] font-bold text-rose-800 hover:bg-rose-100"
                      >
                        Call Off
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLaunchAttack(attackSeverity)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-rose-600 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>Launch Attack (Sev {attackSeverity.toFixed(1)})</span>
                  </button>
                )}

                {onToggleGodCrime && (
                  <div className="space-y-1.5 rounded-lg border border-stone-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-extrabold text-stone-900">
                          Crime & Police Prowls
                        </div>
                        <div className="text-[9.5px] font-medium text-stone-500">
                          {state.godCrimeEnabled
                            ? `Active (${m.crimeRate}% risk · ${state.crimeIncidents.length} prowling)`
                            : "Disabled — zero crime or prowlers"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleGodCrime}
                        className={`shrink-0 rounded-md px-2.5 py-1 text-[10.5px] font-extrabold transition-colors ${
                          state.godCrimeEnabled
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200"
                        }`}
                      >
                        {state.godCrimeEnabled ? "Crime: ON" : "Crime: OFF"}
                      </button>
                    </div>

                    {state.godCrimeEnabled && onTriggerCrime && (
                      <button
                        type="button"
                        onClick={onTriggerCrime}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-fuchsia-400 bg-fuchsia-50 py-1 text-[10.5px] font-extrabold text-fuchsia-900 hover:bg-fuchsia-100"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 text-fuchsia-700" />
                        <span>Trigger Crime Prowl ({state.crimeIncidents.length} active)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-stone-200 bg-white p-2 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-stone-800">
                    <span>Crime & Police</span>
                    <span className="font-mono-num rounded bg-stone-900 px-1.5 py-0.5 text-[10px] text-white">
                      {m.crimeUnlocked
                        ? `${m.crimeRate}% Crime`
                        : `Stage ${CRIME_UNLOCK_STAGE} (${(CRIME_UNLOCK_MIN_POP / 1000).toFixed(0)}k)`}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-stone-500">
                    {m.crimeUnlocked
                      ? "Police Precincts & Jails unlocked — cover homes to keep crime low."
                      : `No crime or prowlers until Stage ${CRIME_UNLOCK_STAGE} (${CRIME_UNLOCK_MIN_POP.toLocaleString()} pop) when Police unlock.`}
                  </p>
                </div>

                <div className="rounded-lg border border-stone-200 bg-white p-2 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-stone-800">
                    <span>Stage Raid Severity</span>
                    <span className="font-mono-num rounded bg-stone-900 px-1.5 py-0.5 text-[10px] text-white">
                      {state.currentStage >= 10
                        ? `Stage ${state.currentStage} · Sev ${m.stageAttackSeverity.toFixed(1)}`
                        : "Unlocks Stage 10"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-stone-500">
                    {state.activeAttack
                      ? `Active Raid: ${state.activeAttack.units.length} enemies vs ${state.activeAttack.defenders.length} island defenders.`
                      : state.currentStage >= 10
                        ? "Attack wave severity scales automatically with your current stage."
                        : "Build military bases and police before Stage 10 raids begin."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
