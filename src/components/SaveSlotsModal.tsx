import React, { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, FolderOpen, Pencil, Save, Trash2, X } from "lucide-react";
import { type GameMode } from "../game/catalog";
import { type CivilizationSaveSlot, MAX_SAVE_SLOTS } from "../game/saveSlots";
import { type GameState } from "../game/simulation";

interface SaveSlotsModalProps {
  error?:string;
  open: boolean;
  slots: (CivilizationSaveSlot | null)[];
  activeSlotIndex: number | null;
  currentState: GameState;
  onClose: () => void;
  onSaveToSlot: (slotIndex: number, name: string) => void;
  onLoadSlot: (slotIndex: number) => void;
  onRenameSlot: (slotIndex: number, name: string) => void;
  onDeleteSlot: (slotIndex: number) => void;
}

function modeBadge(mode: GameMode): { label: string; cls: string } {
  if (mode === "god") return { label: "God Mode", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" };
  if (mode === "survival") return { label: "Survival", cls: "bg-rose-100 text-rose-800 border-rose-200" };
  return { label: "Real Mode", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
}

function formatSavedTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({
  open,
  slots,
  activeSlotIndex,
  currentState,
  onClose,
  onSaveToSlot,
  onLoadSlot,
  onRenameSlot,error,
  onDeleteSlot,
}) => {
  const [draftNames, setDraftNames] = useState<string[]>([
    "Civilization 1",
    "Civilization 2",
    "Civilization 3",
  ]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftNames(
      Array.from({ length: MAX_SAVE_SLOTS }, (_, idx) => {
        const s = slots[idx];
        return s ? s.name : `Civilization ${idx + 1}`;
      }),
    );
    setEditingIdx(null);
  }, [open, slots]);

  if (!open) return null;

  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/60 p-4">
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-stone-900/20 bg-[#fcfaf5] shadow-2xl transition-all ${
          expanded ? "max-h-[92vh] max-w-4xl" : "max-h-[70vh] max-w-xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-extrabold text-stone-900">
              Saved Civilizations ({filledCount}/{MAX_SAVE_SLOTS})
            </h2>
            <p className="text-xs font-medium text-stone-500">
              Save up to 3 islands and switch between them anytime — progress stays saved in your browser.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
              title={expanded ? "Compact Modal" : "Expand Modal"}
              aria-label={expanded ? "Compact Modal" : "Expand Modal"}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Current Island Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-100/80 px-5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-700">Current Island:</span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${
                modeBadge(currentState.mode).cls
              }`}
            >
              {modeBadge(currentState.mode).label}
            </span>
            <span className="font-mono-num font-semibold text-stone-700">
              {currentState.population.toLocaleString()} pop · {currentState.elements.length} items
            </span>
          </div>
          {activeSlotIndex !== null && (
            <span className="text-[11px] font-semibold text-emerald-700">
              Active Slot #{activeSlotIndex + 1}
            </span>
          )}
        </div>

        {error&&<p role="alert" className="bg-amber-100 px-5 py-2 text-sm text-amber-950">{error}</p>}
        {/* 3 Save Slots */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {Array.from({ length: MAX_SAVE_SLOTS }, (_, idx) => {
            const slot = slots[idx];
            const isActive = activeSlotIndex === idx;
            const draftName = draftNames[idx] ?? `Civilization ${idx + 1}`;
            const isEditing = editingIdx === idx;

            if (!slot) {
              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-dashed border-stone-300 bg-white/80 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Slot {idx + 1} · Empty
                    </div>
                    <input
                      type="text"
                      value={draftName}
                      maxLength={36}
                      onChange={(e) =>
                        setDraftNames((prev) =>
                          prev.map((v, i) => (i === idx ? e.target.value : v)),
                        )
                      }
                      placeholder={`Civilization ${idx + 1}`}
                      className="mt-1 w-full max-w-xs rounded-md border border-stone-300 bg-white px-2.5 py-1 text-sm font-bold text-stone-900 focus:border-stone-900 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onSaveToSlot(idx, draftName)}
                    className="flex items-center justify-center gap-1.5 rounded-md bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800"
                  >
                    <Save className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Save Here</span>
                  </button>
                </div>
              );
            }

            const badge = modeBadge(slot.mode);
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 transition-colors ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                    : "border-stone-200 bg-white shadow-xs"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Slot {idx + 1}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {isActive && (
                        <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Loaded
                        </span>
                      )}
                      <span className="text-[11px] text-stone-400">
                        {formatSavedTime(slot.savedAt)}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={draftName}
                          maxLength={36}
                          autoFocus
                          onChange={(e) =>
                            setDraftNames((prev) =>
                              prev.map((v, i) => (i === idx ? e.target.value : v)),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onRenameSlot(idx, draftName);
                              setEditingIdx(null);
                            }
                          }}
                          className="w-56 rounded-md border border-stone-400 bg-white px-2.5 py-1 text-sm font-bold text-stone-900 focus:border-stone-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onRenameSlot(idx, draftName);
                            setEditingIdx(null);
                          }}
                          className="rounded-md bg-emerald-700 p-1.5 text-white hover:bg-emerald-800"
                          title="Confirm Name"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1.5">
                        <h3 className="font-display truncate text-base font-extrabold text-stone-900">
                          {slot.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setEditingIdx(idx)}
                          className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                          title="Rename Civilization"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="font-mono-num mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-600">
                      <span>
                        Stage {slot.currentStage} ({slot.stageName})
                      </span>
                      <span>{slot.population.toLocaleString()} pop</span>
                      <span>{slot.happiness}% happy</span>
                      <span>{slot.elementCount} placed</span>
                      <span>{slot.mode === "god" ? "∞" : `$${slot.money.toLocaleString()}`}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLoadSlot(idx)}
                      className="flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span>Load</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveToSlot(idx, draftName)}
                      className="flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100"
                      title="Overwrite this slot with your current island"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Overwrite</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSlot(idx)}
                      className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                      title="Delete Saved Civilization"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
