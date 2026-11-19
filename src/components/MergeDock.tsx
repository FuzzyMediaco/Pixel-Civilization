import React from "react";
import { ArrowRight, CheckCircle2, GitMerge, X, AlertTriangle } from "lucide-react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { type GameState, canMergePair } from "../game/simulation";
import { ElementFavicon } from "./ElementFavicon";

interface MergeDockProps {
  state: GameState;
  selectedIds: string[];
  pairSelectMode: boolean;
  onMergeNow: () => void;
  onCancelMerge: () => void;
}

export const MergeDock: React.FC<MergeDockProps> = ({
  state,
  selectedIds,
  pairSelectMode,
  onMergeNow,
  onCancelMerge,
}) => {
  const elA = selectedIds[0] ? state.elements.find((e) => e.id === selectedIds[0]) : undefined;
  const elB = selectedIds[1] ? state.elements.find((e) => e.id === selectedIds[1]) : undefined;

  if (!elA || (!pairSelectMode && !elB)) return null;

  const defA = ELEMENT_BY_ID[elA.defId];
  const defB = elB ? ELEMENT_BY_ID[elB.defId] : undefined;
  if (!defA) return null;

  const mergeCheck = elB ? canMergePair(state, elA.id, elB.id) : null;

  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-0 z-25 flex justify-end p-1.5 pr-13 sm:p-2 sm:pr-15"
      aria-label="Merge Civilization Elements"
    >
      <div className="pointer-events-auto flex w-auto max-w-3xl flex-col items-end gap-2 rounded-xl border border-stone-900/20 bg-[#fcfaf5]/96 p-2.5 shadow-2xl sm:flex-row sm:items-center sm:justify-end">
        {/* Twin Slots */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2 py-1">
            <ElementFavicon def={defA} className="h-5 w-5 shrink-0" />
            <div>
              <div className="text-[11px] font-extrabold text-stone-900">{defA.name}</div>
              <div className="font-mono-num text-[9.5px] font-semibold text-stone-500">
                Lv.{elA.level} · V{elA.variant + 1}
              </div>
            </div>
          </div>

          <span className="text-xs font-extrabold text-stone-400">+</span>

          {elB && defB ? (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                mergeCheck?.ok
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-rose-400 bg-rose-50"
              }`}
            >
              <ElementFavicon def={defB} className="h-5 w-5 shrink-0" />
              <div>
                <div className="text-[11px] font-extrabold text-stone-900">{defB.name}</div>
                <div className="font-mono-num text-[9.5px] font-semibold text-stone-600">
                  Lv.{elB.level} · V{elB.variant + 1}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-600 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
              <span>Tap adjacent Lv.{elA.level} {defA.name}</span>
            </div>
          )}

          {mergeCheck?.ok && (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
              <div className="flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-700 px-2 py-1 text-white">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
                <div>
                  <div className="font-mono-num text-[11px] font-extrabold leading-tight">
                    Lv.{mergeCheck.nextLevel} {defA.name}
                  </div>
                  <div className="font-mono-num text-[9.5px] text-emerald-100">
                    {mergeCheck.spanX}×{mergeCheck.spanZ}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Cancel on Left, Primary Merge Button on Far Right for Right Thumb */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {mergeCheck && !mergeCheck.ok && (
            <span className="flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{mergeCheck.reason}</span>
            </span>
          )}

          <button
            type="button"
            onClick={onCancelMerge}
            className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100"
            title="Cancel Merge & Restore Menus (Esc)"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>

          <button
            type="button"
            disabled={!mergeCheck?.ok}
            onClick={onMergeNow}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
              mergeCheck?.ok
                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                : "cursor-not-allowed bg-stone-200 text-stone-400"
            }`}
            title="Merge Both Elements (Shortcut: M)"
          >
            <GitMerge className="h-3.5 w-3.5" />
            <span>{elB ? `Merge Lv.${elA.level + 1}` : "Pick Twin..."}</span>
          </button>
        </div>
      </div>
    </section>
  );
};
