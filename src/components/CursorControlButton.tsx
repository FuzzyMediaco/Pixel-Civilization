import React, { useEffect, useRef, useState } from "react";
import {
  Building2,
  Droplets,
  Hammer,
  Layers,
  MousePointer,
  Move,
  Route,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { type SelectionFilter } from "../game/simulation";
import { type BuildBrush } from "../game/worldRenderer";

export type CursorBehavior = "auto" | "select" | "place";

interface CursorControlButtonProps {
  brush: BuildBrush;
  cursorBehavior: CursorBehavior;
  selectionFilter: SelectionFilter;
  onReturnToSelect: () => void;
  onChangeCursorBehavior: (mode: CursorBehavior) => void;
  onChangeSelectionFilter: (filter: SelectionFilter) => void;
}

const BEHAVIOR_OPTIONS: {
  id: CursorBehavior;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "auto", label: "Smart placement", hint: "Place a building once, or continue drawing a network", icon: Sparkles },
  { id: "select", label: "Place once", hint: "Every placement returns straight to Select", icon: MousePointer },
  { id: "place", label: "Keep placing", hint: "Keep building brush active after placing", icon: Hammer },
];

const FILTER_OPTIONS: {
  id: SelectionFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "all", label: "All", icon: Layers },
  { id: "roads", label: "Roads", icon: Route },
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "water", label: "Water", icon: Droplets },
  { id: "power", label: "Power", icon: Zap },
  { id: "waste", label: "Waste", icon: Trash2 },
];

export const CursorControlButton: React.FC<CursorControlButtonProps> = ({
  brush,
  cursorBehavior,
  selectionFilter,
  onReturnToSelect,
  onChangeCursorBehavior,
  onChangeSelectionFilter,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=="Escape" || document.querySelector("dialog[open]")) return;
      event.preventDefault();event.stopPropagation();setPopoverOpen(false);
      containerRef.current?.querySelector<HTMLButtonElement>('[aria-label="Cursor Settings"], [aria-label="Cursor Tool Control"]')?.focus();
    };
    window.addEventListener("keydown",onKey,true);
    window.addEventListener("pointerdown", onDown);
    return () => {window.removeEventListener("pointerdown",onDown);window.removeEventListener("keydown",onKey,true);};
  }, [popoverOpen]);

  const activeBrushDef = brush.kind === "place" && brush.defId ? ELEMENT_BY_ID[brush.defId] : undefined;
  const isPlacing = brush.kind === "place";
  const isMoving = brush.kind === "move";
  const isBusyTool = isPlacing || isMoving;
  const filterActive = selectionFilter !== "all";

  const handlePrimaryClick = () => {
    if (isBusyTool) {
      onReturnToSelect();
      return;
    }
    setPopoverOpen((prev) => !prev);
  };

  const ActiveIcon = isMoving
    ? Move
    : isPlacing
      ? Hammer
      : MousePointer;

  const buttonLabel = isMoving
    ? "Moving"
    : isPlacing
      ? activeBrushDef?.name ?? "Build"
      : "Select";

  return (
    <div ref={containerRef} className="cursor-tools pointer-events-auto fixed bottom-2.5 right-2 z-35 flex flex-col items-end">
      {popoverOpen && (
        <div className="mb-2 w-68 max-w-[calc(100vw-1rem)] rounded-xl border border-stone-900/20 bg-[#fcfaf5]/96 p-2.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
            <div>
              <h4 className="font-display text-xs font-extrabold text-stone-900">
                Placement & selection
              </h4>
              <p className="text-[10px] text-stone-500">
                Choose placement behavior or click filter
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="rounded border border-stone-300 bg-white p-1 text-stone-600 hover:bg-stone-100"
              aria-label="Close Cursor Menu"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isBusyTool && (
            <button
              type="button"
              onClick={() => {
                onReturnToSelect();
                setPopoverOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-stone-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-stone-800"
            >
              <MousePointer className="h-3.5 w-3.5 text-amber-300" />
              <span>Return to Select Tool</span>
            </button>
          )}

          <div className="mt-2">
            <div className="mb-1 text-[10px] font-extrabold text-stone-500">
              Cursor Behavior
            </div>
            <div className="grid grid-cols-2 gap-1">
              {BEHAVIOR_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = cursorBehavior === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                  onClick={() => onChangeCursorBehavior(opt.id)}
                    title={opt.hint}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-left text-[11px] font-bold transition-colors ${
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-800 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-amber-300" : "text-stone-600"}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-stone-500">
              {BEHAVIOR_OPTIONS.find((b) => b.id === cursorBehavior)?.hint}
            </p>
          </div>

          <div className="mt-2.5 border-t border-stone-200 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-stone-500">
                Layer Click Filter
              </span>
              {filterActive && (
                <button
                  type="button"
                  onClick={() => onChangeSelectionFilter("all")}
                  className="text-[10px] font-bold text-emerald-700 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {FILTER_OPTIONS.map((f) => {
                const Icon = f.icon;
                const active = selectionFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                  onClick={() => onChangeSelectionFilter(f.id)}
                    className={`flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-1.5 text-[10px] font-bold transition-colors ${
                      active
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-stone-200 bg-white text-stone-800 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1">
        {isBusyTool && (
          <button
            type="button"
            onClick={() => setPopoverOpen((prev) => !prev)}
            title="Open Cursor Mode & Layer Filter"
            aria-label="Cursor Settings" aria-expanded={popoverOpen}
            className={`flex h-11 w-9 items-center justify-center rounded-xl border shadow-xl transition-colors ${
              popoverOpen
                ? "border-emerald-600 bg-emerald-700 text-white"
                : "border-stone-300 bg-[#fcfaf5]/96 text-stone-800 hover:bg-white"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={handlePrimaryClick}
          title={
            isBusyTool
              ? "Tap to cancel & return to Select Tool"
              : "Tap to open Cursor Mode & Layer Click Filter"
          }
          aria-label="Cursor Tool Control" aria-expanded={isBusyTool ? undefined : popoverOpen}
          className={`relative flex h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-extrabold shadow-xl transition-colors ${
            isPlacing || isMoving
              ? "border-amber-500 bg-amber-500 text-stone-950 hover:bg-amber-400"
              : popoverOpen
                  ? "border-emerald-600 bg-stone-800 text-white ring-2 ring-emerald-500/50"
                  : "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
          }`}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
          <span className="hidden max-w-[84px] truncate sm:inline">{buttonLabel}</span>
          {filterActive && (
            <span
              className="absolute -left-1 -top-1 rounded border border-white bg-emerald-600 px-1 py-0.5 text-[8px] font-extrabold uppercase leading-none text-white shadow-xs"
              title={`Layer Filter: ${selectionFilter}`}
            >
              {selectionFilter}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
