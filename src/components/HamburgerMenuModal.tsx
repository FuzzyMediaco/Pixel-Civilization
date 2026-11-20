import React from "react";
import {
  CloudLightning,
  Flame,
  Info,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Save,
  Shield,
  Siren,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type GameMode, STAGES } from "../game/catalog";
import { MAX_SAVE_SLOTS } from "../game/saveSlots";
import { type GameState } from "../game/simulation";

interface HamburgerMenuModalProps {
  open: boolean;
  state: GameState;
  simSpeed: number;
  savedCount: number;
  onClose: () => void;
  onChangeMode: (mode: GameMode) => void;
  onChangeSimSpeed: (speed: number) => void;
  onOpenWeatherStudio: () => void;
  onOpenHeatmaps: () => void;
  onOpenAdvisor: () => void;
  onOpenSaves: () => void;
  onOpenIsland: (tab: "works"|"transit"|"city"|"god") => void;
  onCopyIsland: () => void;
  onToggleGodCrime?: () => void;
  onResetIsland: () => void;
}

const MODE_CARDS: {
  id: GameMode;
  title: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: "god",
    title: "God Mode",
    badge: "Sandbox",
    desc: "Build freely, shape land and water, run services and experiment with the live economy.",
  },
  {
    id: "real",
    title: "Real Mode",
    badge: "20 Stages",
    desc: "Grow from Stage 1 Village to Stage 20 Megalopolis. Manage utilities, crime, defense & treasury.",
  },
  {
    id: "survival",
    title: "Survival Mode",
    badge: "Hardcore",
    desc: "Manage essential reserves, fire response and defense with a recovery period for sustained shortages.",
  },
];

export const HamburgerMenuModal: React.FC<HamburgerMenuModalProps> = ({
  open,
  state,
  simSpeed,
  savedCount,
  onClose,
  onChangeMode,
  onChangeSimSpeed,
  onOpenWeatherStudio,
  onOpenHeatmaps,
  onOpenAdvisor,
  onOpenSaves, onOpenIsland, onCopyIsland,
  onToggleGodCrime,
  onResetIsland,
}) => {
  if (!open) return null;

  const stageObj = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const nextStage = state.currentStage < 20 ? STAGES[state.currentStage] : null;
  let stageProgress = 100;
  if (state.mode !== "god" && nextStage) {
    const span = Math.max(1, nextStage.minPop - stageObj.minPop);
    stageProgress = Math.max(
      0,
      Math.min(100, Math.round(((state.population - stageObj.minPop) / span) * 100)),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f6f2e9] text-stone-900"
      role="dialog"
      aria-modal="true"
      aria-label="Civilization Main Menu"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-stone-900/10 bg-[#fcfaf5] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded bg-stone-900 p-1">
            <span className="bg-[#86c864]" />
            <span className="bg-[#3fa4de]" />
            <span className="bg-[#f4c44e]" />
            <span className="bg-[#e07a5f]" />
          </div>
          <div>
            <h2 className="font-display text-base font-extrabold leading-none text-stone-900">
              Pixel Civilization
            </h2>
            <p className="text-xs font-medium text-stone-500">
              {state.mode === "god"
                ? "God Mode · All 20 Stages Open"
                : `Stage ${stageObj.stage}/20 · ${stageObj.name}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-extrabold text-stone-800 hover:bg-stone-100"
        >
          <X className="h-4 w-4" />
          <span>Resume Island</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6">
        {/* Game Mode Selector */}
        <section>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-stone-500">
            <Layers className="h-3.5 w-3.5" />
            <span>Select Game Mode</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {MODE_CARDS.map((m) => {
              const active = state.mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChangeMode(m.id);
                    onClose();
                  }}
                  className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                    active
                      ? "border-stone-900 bg-stone-900 text-white shadow-md"
                      : "border-stone-900/15 bg-white text-stone-900 hover:border-stone-900/40"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-display text-sm font-extrabold">{m.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? "bg-amber-400 text-stone-950" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 text-xs leading-relaxed ${
                      active ? "text-stone-300" : "text-stone-600"
                    }`}
                  >
                    {m.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Live Island Summary & Stage Benchmark */}
        <section className="rounded-xl border border-stone-900/15 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-stone-400">Population</div>
              <div className="font-mono-num text-lg font-extrabold text-stone-900">
                {state.population.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-stone-400">Happiness</div>
              <div className="font-mono-num text-lg font-extrabold text-emerald-700">
                {state.happiness}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-stone-400">Treasury</div>
              <div className="font-mono-num text-lg font-extrabold text-stone-900">
                {state.mode === "god" ? "∞" : `$${Math.floor(state.money).toLocaleString()}`}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-stone-400">Defense</div>
              <div className="font-mono-num flex items-center gap-1 text-lg font-extrabold text-indigo-700">
                <Shield className="h-4 w-4" />
                <span>{state.metrics.defenseUnlocked ? `${state.metrics.defenseRating}%` : "S10+"}</span>
              </div>
            </div>
          </div>

          {state.mode !== "god" && nextStage && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                <span>
                  Next Stage ({nextStage.stage}): {nextStage.name}
                </span>
                <span className="font-mono-num">
                  {state.population.toLocaleString()} / {nextStage.minPop.toLocaleString()} pop
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-xs bg-stone-200">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Simulation Speed & Quick Shortcuts */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-900/15 bg-white p-3.5">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-stone-500">
              Simulation Speed
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeSimSpeed(spd)}
                  className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-extrabold ${
                    simSpeed === spd
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {spd === 0 ? <Pause className="h-3.5 w-3.5" /> : spd === 1 ? <Play className="h-3.5 w-3.5" /> : null}
                  <span className="font-mono-num">{spd === 0 ? "Pause" : `${spd}×`}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href="./handbook.html" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-50 p-2 text-xs font-bold text-emerald-950">Illustrated player handbook ↗</a>
            <a href="./field-guide.html" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white p-2 text-xs font-bold text-stone-800 hover:bg-stone-50">
              <Layers className="h-4 w-4 text-emerald-700" /> Island field guide ↗
            </a>
            {(["works","transit","city", ...(state.mode==="god"?["god"]:[])] as const).map(id=><button key={id} className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-left text-xs font-extrabold" onClick={()=>{onClose();onOpenIsland(id as "works"|"transit"|"city"|"god");}}>{{works:"Land & public works",transit:"Transit & harbor",city:"City ledger & services",god:"God controls"}[id]}</button>)}
            {state.mode!=="god"&&<button className="rounded-xl border border-emerald-700 bg-white p-3 text-left text-xs font-bold" onClick={()=>{onClose();onCopyIsland();}}>Experiment in a God-mode copy</button>}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWeatherStudio();
              }}
              className="flex items-center gap-2 rounded-xl border border-stone-900/15 bg-white px-3.5 py-3 text-left text-xs font-extrabold text-stone-800 hover:bg-stone-50"
            >
              <CloudLightning className="h-4 w-4 text-sky-600" />
              <span>Weather Studio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHeatmaps();
              }}
              className="flex items-center gap-2 rounded-xl border border-stone-900/15 bg-white px-3.5 py-3 text-left text-xs font-extrabold text-stone-800 hover:bg-stone-50"
            >
              <Flame className="h-4 w-4 text-amber-600" />
              <span>Heat Maps</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdvisor();
              }}
              className="flex items-center gap-2 rounded-xl border border-stone-900/15 bg-white px-3.5 py-3 text-left text-xs font-extrabold text-stone-800 hover:bg-stone-50"
            >
              <Info className="h-4 w-4 text-indigo-600" />
              <span>City Report & Stages</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSaves();
              }}
              className="flex items-center gap-2 rounded-xl border border-stone-900/15 bg-white px-3.5 py-3 text-left text-xs font-extrabold text-stone-800 hover:bg-stone-50"
            >
              <Save className="h-4 w-4 text-emerald-700" />
              <span>
                Saves ({savedCount}/{MAX_SAVE_SLOTS})
              </span>
            </button>
          </div>
        </section>

        {state.mode === "god" && onToggleGodCrime && (
          <section className="flex items-center justify-between rounded-xl border border-stone-900/15 bg-white px-4 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-stone-900">
                <Siren className="h-4 w-4 text-blue-600" />
                <span>God Mode Crime Simulation</span>
              </div>
              <p className="text-[11px] text-stone-600">
                {state.godCrimeEnabled
                  ? "Crime & burglar/police response animations are active on your island."
                  : "Crime is turned OFF — zero crime or burglar animations will occur."}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleGodCrime}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-extrabold transition-colors ${
                state.godCrimeEnabled
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {state.godCrimeEnabled ? "Crime: ON" : "Crime: OFF"}
            </button>
          </section>
        )}

        {/* Danger Zone: Reset Island */}
        <section className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-900">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Start Fresh on Current Mode</span>
            </div>
            <p className="text-[11px] text-rose-700">
              Clears elements in the current mode while keeping your 3 saved slots intact.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onResetIsland();
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <RotateCcw className="hidden h-3 w-3 sm:inline" />
            <span>Reset</span>
          </button>
        </section>
      </div>
    </div>
  );
};
