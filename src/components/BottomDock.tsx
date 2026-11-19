import React, { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  GitMerge,
  Grid2x2,
  Lock,
  MousePointer,
  Move,
  RotateCw,
  Search,
  Shuffle,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  CATEGORY_META,
  type CivElementDef,
  ELEMENTS,
  ELEMENT_BY_ID,
  type ElementCategory,
  getUpgradeCost,
} from "../game/catalog";
import {
  MAINTENANCE_INTERVAL_SEC,
  type GameState,
  canMergePair,
  isElementUnlocked,
} from "../game/simulation";
import { type BuildBrush } from "../game/worldRenderer";
import { ElementFavicon } from "./ElementFavicon";

interface BottomDockProps {
  open: boolean;
  isMerging: boolean;
  state: GameState;
  brush: BuildBrush;
  selectedIds: string[];
  pairSelectMode: boolean;
  hoverInfo: { gx: number; gz: number; valid: boolean; reason?: string } | null;
  onSelectBrushDef: (defId: string | null) => void;
  onUpdateBrushSettings: (patch: Partial<BuildBrush>) => void;
  onStartMoveSelected: (id: string) => void;
  onTogglePairSelectMode: () => void;
  onMergeSelectedPair: () => void;
  onUpgradeSelected: (id: string) => void;
  onMaintainSelected: (id: string) => void;
  onGodMutateSelected: (id: string, patch: { level?: number; variant?: number; rotation?: number }) => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onClose: () => void;
}

const ALL_CATEGORIES: { id: ElementCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  ...CATEGORY_META,
];

function formatElementStatSummary(def: CivElementDef): string {
  if (def.popBase) return `+${def.popBase} Pop`;
  if (def.jobs) return `+${def.jobs} Jobs`;
  if (def.power && def.power > 0) return `+${def.power} Pwr`;
  if (def.water && def.water > 0) return `+${def.water} Wtr`;
  if (def.waste) return `+${def.waste} Waste`;
  if (def.food) return `+${def.food} Food`;
  if (def.education) return `+${def.education} Edu`;
  if (def.recreation) return `+${def.recreation} Park`;
  if (def.government) return `+${def.government} Gov`;
  if (def.policeRadius) return `Pol R${def.policeRadius}`;
  if (def.fireRadius) return `Fire R${def.fireRadius}`;
  if (def.military) return `+${def.military} Mil`;
  if (def.income) return `+$${def.income}`;
  if (def.isRoadNetwork) return "Traffic";
  if (def.isRailNetwork) return "Trains";
  if (def.isWaterFeature) return "Waterway";
  return "Scenic";
}

export const BottomDock: React.FC<BottomDockProps> = ({
  open,
  isMerging,
  state,
  brush,
  selectedIds,
  pairSelectMode,
  hoverInfo,
  onSelectBrushDef,
  onUpdateBrushSettings,
  onStartMoveSelected,
  onTogglePairSelectMode,
  onMergeSelectedPair,
  onUpgradeSelected,
  onMaintainSelected,
  onGodMutateSelected,
  onDeleteSelected,
  onClearSelection,
  onClose,
}) => {
  const [activeCat, setActiveCat] = useState<ElementCategory | "all">("starter");
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filteredElements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ELEMENTS.filter((el) => {
      if (q) {
        return (
          el.name.toLowerCase().includes(q) ||
          el.description.toLowerCase().includes(q) ||
          el.category.toLowerCase().includes(q)
        );
      }
      if (activeCat === "all") return true;
      if (activeCat === "starter") return Boolean(el.isStarter);
      return el.category === activeCat;
    }).sort((a, b) => {
      const ua = isElementUnlocked(a, state) ? 0 : 1;
      const ub = isElementUnlocked(b, state) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (a.stage !== b.stage) return a.stage - b.stage;
      return a.cost - b.cost;
    });
  }, [activeCat, searchQuery, state]);

  const primaryEl = selectedIds[0]
    ? state.elements.find((e) => e.id === selectedIds[0])
    : undefined;
  const secondaryEl = selectedIds[1]
    ? state.elements.find((e) => e.id === selectedIds[1])
    : undefined;

  const primaryDef = primaryEl ? ELEMENT_BY_ID[primaryEl.defId] : undefined;
  const mergeCheck =
    primaryEl && secondaryEl ? canMergePair(state, primaryEl.id, secondaryEl.id) : null;

  const activeBrushDef = brush.kind === "place" && brush.defId ? ELEMENT_BY_ID[brush.defId] : undefined;
  const activeCatLabel =
    ALL_CATEGORIES.find((c) => c.id === activeCat)?.label ?? "Starter 10";

  if (isMerging) return null;

  const showInspector = Boolean(primaryEl && primaryDef);
  const showInvalidHint = Boolean(brush.kind !== "none" && hoverInfo && !hoverInfo.valid && hoverInfo.reason);
  if (!open && !showInspector && !showInvalidHint) return null;

  return (
    <section className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-end gap-1 p-1.5 pr-13 sm:p-2 sm:pr-15">
      {/* Hover placement status hint */}
      {showInvalidHint && hoverInfo?.reason && (
        <div className="rounded-md border border-rose-500/40 bg-rose-950/92 px-2 py-0.5 text-[10.5px] font-bold text-rose-100 shadow-md">
          {hoverInfo.reason}
        </div>
      )}

      {/* Right-Handed Compact Selected Element Inspector */}
      {primaryEl && primaryDef && (
        <div className="pointer-events-auto relative flex w-auto max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-lg border border-stone-900/20 bg-[#fcfaf5]/96 px-2 py-1 shadow-lg">
          {/* Element Identity (Favicon + Tiny Color Square + Name & Micro Metadata) */}
          <div className="flex min-w-0 items-center gap-1.5">
            <ElementFavicon def={primaryDef} className="h-5 w-5 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="font-display flex items-center gap-1 truncate text-[11px] font-extrabold text-stone-900">
                <svg className="h-1.5 w-1.5 shrink-0" viewBox="0 0 6 6" aria-hidden="true">
                  <rect width="6" height="6" rx="1" fill={primaryDef.accentHex} />
                </svg>
                <span className="truncate">
                  {primaryDef.name} · Lv.{primaryEl.level}
                </span>
              </div>
              <div className="font-mono-num flex flex-wrap items-center gap-1 text-[9.5px] font-semibold text-stone-500">
                <span>
                  V{primaryEl.variant + 1} · {primaryEl.spanX}×{primaryEl.spanZ}
                </span>
                {state.mode !== "god" && !primaryDef.isNetwork && !primaryDef.passiveNature && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={primaryEl.connected ? "text-emerald-700" : "text-rose-700"}>
                      {primaryEl.connected ? "Linked" : "No Road"}
                    </span>
                  </>
                )}
                {state.mode === "survival" && primaryDef.needsMaintenance && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={primaryEl.disrepair ? "font-bold text-rose-700" : "text-amber-700"}>
                      {primaryEl.disrepair
                        ? "Disrepair"
                        : `${Math.max(0, Math.ceil(MAINTENANCE_INTERVAL_SEC - primaryEl.maintTimerSec))}s`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right-Aligned Action Cluster: Secondary/Destructive on Left, Primary Actions Closest to Right Thumb */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={onClearSelection}
              className="flex h-6.5 w-6.5 items-center justify-center rounded border border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
              title="Clear Selection"
              aria-label="Clear Selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onDeleteSelected}
              className="flex h-6.5 w-6.5 items-center justify-center rounded border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
              title="Demolish"
              aria-label="Demolish"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {state.mode === "god" && !secondaryEl && (
              <>
                {!primaryDef.isNetwork && (
                  <button
                    type="button"
                    onClick={() =>
                      onGodMutateSelected(primaryEl.id, { rotation: (primaryEl.rotation + 1) % 4 })
                    }
                    className="flex h-6.5 w-6.5 items-center justify-center rounded border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                    title="Rotate 90°"
                    aria-label="Rotate 90 degrees"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onGodMutateSelected(primaryEl.id, { variant: (primaryEl.variant + 1) % 4 })
                  }
                  className="flex h-6.5 w-6.5 items-center justify-center rounded border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                  title="Cycle Visual Variant"
                  aria-label="Cycle Visual Variant"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onStartMoveSelected(primaryEl.id)}
                  className="flex h-6.5 w-6.5 items-center justify-center rounded border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                  title="Move element"
                  aria-label="Move element"
                >
                  <Move className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {(primaryEl.onFire || (state.mode === "survival" && primaryDef.needsMaintenance)) && (
              <button
                type="button"
                onClick={() => onMaintainSelected(primaryEl.id)}
                className="flex h-6.5 w-6.5 items-center justify-center rounded bg-amber-500 text-stone-950 hover:bg-amber-400"
                title={primaryEl.onFire ? "Extinguish Fire" : "Maintain Building"}
                aria-label={primaryEl.onFire ? "Extinguish Fire" : "Maintain Building"}
              >
                {primaryEl.onFire ? <Flame className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
              </button>
            )}

            {primaryEl.level < 5 && !secondaryEl && (
              <button
                type="button"
                onClick={onTogglePairSelectMode}
                className={`flex h-6.5 w-6.5 items-center justify-center rounded border transition-colors ${
                  pairSelectMode
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                }`}
                title="Select adjacent twin to Merge"
                aria-label="Merge with twin"
              >
                <GitMerge className="h-3.5 w-3.5" />
              </button>
            )}

            {secondaryEl && (
              <button
                type="button"
                disabled={!mergeCheck?.ok}
                onClick={onMergeSelectedPair}
                className={`flex h-6.5 items-center gap-1 whitespace-nowrap rounded px-2 text-[10.5px] font-extrabold ${
                  mergeCheck?.ok
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "cursor-not-allowed bg-stone-200 text-stone-400"
                }`}
                title={`Confirm Merge to Level ${primaryEl.level + 1}`}
              >
                <GitMerge className="h-3.5 w-3.5" />
                <span>Lv.{primaryEl.level + 1}</span>
              </button>
            )}

            {/* Direct Level-Down & Level-Up Twin Buttons (Rightmost for Right-Handed Thumb Reach) */}
            {state.mode === "god" && !secondaryEl && (
              <button
                type="button"
                disabled={primaryEl.level <= 1}
                onClick={() =>
                  onGodMutateSelected(primaryEl.id, { level: Math.max(1, primaryEl.level - 1) })
                }
                className="flex h-6.5 w-6.5 items-center justify-center rounded bg-stone-900 text-sky-400 transition-opacity hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-35"
                title={
                  primaryEl.level > 1
                    ? `Level Down to Lv.${primaryEl.level - 1}`
                    : "Minimum Level (Lv.1)"
                }
                aria-label="Level Down"
              >
                <ArrowDownCircle className="h-3.5 w-3.5" />
              </button>
            )}

            {!secondaryEl && (
              <button
                type="button"
                disabled={primaryEl.level >= 5}
                onClick={() => onUpgradeSelected(primaryEl.id)}
                className="flex h-6.5 w-6.5 items-center justify-center rounded bg-stone-900 text-amber-300 transition-opacity hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-35"
                title={
                  primaryEl.level >= 5
                    ? "Max Level (Lv.5)"
                    : state.mode === "god"
                      ? `Level Up to Lv.${primaryEl.level + 1}`
                      : `Upgrade to Lv.${primaryEl.level + 1} ($${getUpgradeCost(primaryDef, primaryEl.level)})`
                }
                aria-label="Level Up"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact Right-Aligned Builder Tab (Strictly 1-Row Skinny Strip by Default) */}
      {open && (
        <div className="pointer-events-auto w-full max-w-3xl rounded-xl border border-stone-900/20 bg-[#fcfaf5]/96 shadow-xl">
          {/* Header Row: Utility Icons on Left, Primary Controls (Category & Select) Flush Right for Right Thumb */}
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-stone-200 px-1.5 py-1">
            {searchOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Search className="h-3.5 w-3.5 shrink-0 text-stone-500" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${ELEMENTS.length} elements...`}
                  className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                  className="shrink-0 rounded bg-stone-900 px-2 py-0.5 text-[10.5px] font-bold text-white hover:bg-stone-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Left: Less-frequent utility controls */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    title="Close Builder Tab (B)"
                    aria-label="Close Builder Tab"
                  >
                    <X className="h-3 w-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    title={expanded ? "Show Single-Row Strip" : "Expand Multi-Row Grid"}
                    aria-label={expanded ? "Show Single-Row Strip" : "Expand Multi-Row Grid"}
                  >
                    {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                      searchQuery
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                    title={`Search ${ELEMENTS.length} elements`}
                    aria-label="Search elements"
                  >
                    <Search className="h-3 w-3" />
                  </button>
                </div>

                {/* Right: Primary Thumb Controls (Rotate, Brush Level Down/Up, Category, Select) */}
                <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
                  {brush.kind === "place" && activeBrushDef && !activeBrushDef.isNetwork && (
                    <button
                      type="button"
                      onClick={() => onUpdateBrushSettings({ rotation: (brush.rotation + 1) % 4 })}
                      className="flex h-6 w-6 items-center justify-center rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                      title="Rotate 90° (R)"
                      aria-label="Rotate 90 degrees"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  )}

                  {state.mode === "god" && brush.kind === "place" && (
                    <div className="flex items-center gap-0.5 rounded border border-stone-200 bg-stone-100 px-0.5 py-0.5">
                      <button
                        type="button"
                        disabled={brush.level <= 1}
                        onClick={() =>
                          onUpdateBrushSettings({ level: Math.max(1, brush.level - 1) })
                        }
                        className="flex h-5 w-5 items-center justify-center rounded bg-stone-900 text-sky-400 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-35"
                        title="Decrease Placement Level"
                        aria-label="Decrease Placement Level"
                      >
                        <ArrowDownCircle className="h-3 w-3" />
                      </button>
                      <span className="font-mono-num px-0.5 text-[9.5px] font-extrabold text-stone-800">
                        L{brush.level}
                      </span>
                      <button
                        type="button"
                        disabled={brush.level >= 5}
                        onClick={() =>
                          onUpdateBrushSettings({ level: Math.min(5, brush.level + 1) })
                        }
                        className="flex h-5 w-5 items-center justify-center rounded bg-stone-900 text-amber-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-35"
                        title="Increase Placement Level"
                        aria-label="Increase Placement Level"
                      >
                        <ArrowUpCircle className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setCatMenuOpen((prev) => !prev)}
                    className={`flex h-6 min-w-0 items-center gap-1 rounded border px-1.5 text-[10.5px] font-bold transition-colors ${
                      catMenuOpen
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                    }`}
                    title="Browse all 14 element categories"
                  >
                    <Grid2x2 className="h-3 w-3 shrink-0" />
                    <span className="max-w-[84px] truncate sm:max-w-[140px]">{activeCatLabel}</span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 transition-transform ${catMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectBrushDef(null)}
                    className={`flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 text-[10.5px] font-bold transition-colors ${
                      brush.kind === "none"
                        ? "bg-stone-900 text-white"
                        : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                    title="Select / Inspect tool (Esc)"
                  >
                    <MousePointer className="h-3 w-3" />
                    <span>Select</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Expandable Wrapped Category Drawer (Zero Horizontal Scroll) */}
          {catMenuOpen && !searchOpen && (
            <div className="grid max-h-[30vh] grid-cols-3 gap-1 overflow-y-auto overflow-x-hidden border-b border-stone-200 bg-stone-100/90 p-1.5 sm:grid-cols-5">
              {ALL_CATEGORIES.map((cat) => {
                const active = !searchQuery && activeCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCat(cat.id);
                      setCatMenuOpen(false);
                    }}
                    className={`truncate rounded border px-1.5 py-1 text-center text-[10px] font-bold transition-colors ${
                      active
                        ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                        : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Horizontal Side-Scrolling 1-Row Element Strip (ONLY element buttons side-scroll!) */}
          <div
            className={
              expanded
                ? "grid max-h-[36vh] grid-cols-3 gap-1 overflow-y-auto overflow-x-hidden px-1.5 py-1.5 sm:grid-cols-4 md:grid-cols-5"
                : "flex flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden px-1.5 py-1 touch-pan-x"
            }
          >
            {filteredElements.length === 0 ? (
              <div className="col-span-full flex h-[34px] w-full items-center justify-center text-[11px] font-semibold text-stone-500">
                No matching elements for "{searchQuery}"
              </div>
            ) : (
              filteredElements.map((def) => {
                const unlocked = isElementUnlocked(def, state);
                const selected = brush.kind === "place" && brush.defId === def.id;
                const canAfford = state.mode === "god" || state.money >= def.cost;

                return (
                  <button
                    key={def.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onSelectBrushDef(selected ? null : def.id)}
                    title={`${def.name} — ${def.description}`}
                    className={`flex h-[34px] min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left transition-colors ${
                      expanded ? "w-full" : "w-[114px] shrink-0"
                    } ${
                      !unlocked
                        ? "cursor-not-allowed border-stone-200 bg-stone-100/80 opacity-55"
                        : selected
                          ? "border-stone-900 bg-stone-900 text-white shadow-xs"
                          : "border-stone-200 bg-white text-stone-900 hover:border-stone-400 hover:bg-stone-50"
                    }`}
                  >
                    {/* Tiny Level-1 Voxel Favicon */}
                    <ElementFavicon def={def} className="h-[22px] w-[22px] shrink-0" />

                    {/* Skinny Compact Info Stack: Tiny Color Square + Name + Stat */}
                    <div className="min-w-0 flex-1 leading-none">
                      <div className="flex items-center gap-1">
                        <svg className="h-1.5 w-1.5 shrink-0" viewBox="0 0 6 6" aria-hidden="true">
                          <rect width="6" height="6" rx="1" fill={def.accentHex} />
                        </svg>
                        <span className="truncate text-[9.5px] font-extrabold leading-tight">
                          {def.name}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center justify-between gap-0.5 text-[8px] font-semibold leading-none">
                        <span className={`truncate ${selected ? "text-stone-300" : "text-stone-500"}`}>
                          {formatElementStatSummary(def)}
                        </span>

                        {!unlocked ? (
                          <span className="font-mono-num inline-flex shrink-0 items-center gap-0.5 text-stone-400">
                            <Lock className="h-2 w-2" />
                            S{def.stage}
                          </span>
                        ) : state.mode !== "god" ? (
                          <span
                            className={`font-mono-num shrink-0 font-bold ${
                              selected
                                ? "text-amber-300"
                                : canAfford
                                  ? "text-stone-700"
                                  : "text-rose-600"
                            }`}
                          >
                            ${def.cost}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
};
