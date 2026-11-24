import { GameDialog } from "./GameDialog";
import React, { useEffect, useState } from "react";
import { Download, Upload, Check, ChevronDown, ChevronUp, FolderOpen, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { type GameMode } from "../game/catalog";
import { type CivilizationSaveSlot, MAX_SAVE_SLOTS } from "../game/saveSlots";
import { type GameState } from "../game/simulation";

import { MAX_TRANSFER_BYTES, readWorldFile, type TransferWorld } from "../game/worldTransfer";

interface SaveSlotsModalProps {
  error?:string;
  open: boolean;
  slots: (CivilizationSaveSlot | null)[];
  activeSlotIndex: number | null;
  currentState: GameState;
  onClose: () => void;
  onExportWorld: (slotIndex?: number) => void;
  onImportWorld: (slotIndex: number, world: TransferWorld) => Promise<boolean>;
  linkedWorlds: TransferWorld[];
  onAddSlot: () => Promise<number | undefined>;
  onSaveToSlot: (slotIndex: number, name: string) => void;
  onLoadSlot: (slotIndex: number) => void;
  onRenameSlot: (slotIndex: number, name: string) => void;
  onDeleteSlot: (slotIndex: number) => void;
}

function modeBadge(mode: GameMode): { label: string; cls: string } {
  if (mode === "god") return { label: "God Mode", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" };
  if (mode === "idle") return { label: "Idle", cls: "bg-sky-100 text-sky-800 border-sky-200" };
  if (mode === "manager") return { label: "Manager", cls: "bg-amber-100 text-amber-800 border-amber-200" };
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
  onClose, onExportWorld, onImportWorld, linkedWorlds,
  onAddSlot, onSaveToSlot,
  onLoadSlot,
  onRenameSlot,error,
  onDeleteSlot,
}) => {
  const [draftNames, setDraftNames] = useState<string[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{index: number; action: "overwrite" | "delete"} | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fileWorlds, setFileWorlds] = useState<TransferWorld[]>([]);
  const [worldIndex, setWorldIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const worlds = fileWorlds.length ? fileWorlds : linkedWorlds;
  const selectedWorld = worlds[worldIndex];
  const emptySlot = slots.findIndex(slot => slot === null);

  async function readFile(file: File) {
    setBusy(true);
    setFileWorlds([]);
    setWorldIndex(0);
    setTransferMessage("");
    try {
      if (file.size > MAX_TRANSFER_BYTES) throw Error("This file exceeds 16 MiB.");
      setFileWorlds(readWorldFile(await file.text()));
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : "This backup could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (busy || !selectedWorld) return;
    setBusy(true);
    setTransferMessage("");
    try {
      const index = emptySlot < 0 ? await onAddSlot() : emptySlot;
      if (index === undefined) return;
      if (await onImportWorld(index, selectedWorld)) {
        setFileWorlds(fileWorlds.filter((_, i) => i !== worldIndex));
        setWorldIndex(0);
        setTransferMessage(`Saved “${selectedWorld.name}” in Slot ${index + 1}.`);
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setDraftNames(
      Array.from({ length: slots.length }, (_, idx) => {
        const s = slots[idx];
        return s ? s.name : `Civilization ${idx + 1}`;
      }),
    );
    setEditingIdx(null);
    setConfirm(null);
  }, [open, slots]);

  if (!open) return null;

  const filledCount = slots.filter(Boolean).length;

  return (
    <GameDialog label="Saved civilizations" onDismiss={onClose} className="island-modal fixed inset-0 z-40 flex items-center justify-center bg-stone-950/60 p-4">
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-stone-900/20 bg-[#fcfaf5] shadow-2xl transition-all ${
          expanded ? "max-h-[92dvh] max-w-4xl" : "max-h-[84dvh] max-w-xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg font-extrabold text-stone-900">
              Saved islands ({filledCount}/{slots.length})
            </h2>
            <p className="text-xs font-medium text-stone-500">
              Save a snapshot of your island. Sign in to sync it across devices.
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
              aria-label="Close saved civilizations"
              data-dialog-focus
              className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-600 hover:bg-stone-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Current Island Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-100/80 px-5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-700">Current island</span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${
                modeBadge(currentState.mode).cls
              }`}
            >
              {modeBadge(currentState.mode).label}
            </span>
            <span className="font-mono-num font-semibold text-stone-700">
              {currentState.population.toLocaleString()} pop · {currentState.elements.length.toLocaleString()} placed
            </span>
          </div>
          {activeSlotIndex !== null && (
            <span className="text-[11px] font-semibold text-emerald-700">
              Loaded from slot {activeSlotIndex + 1}
            </span>
          )}
        </div>

        {error&&<p role="alert" className="bg-amber-100 px-5 py-2 text-sm text-amber-950">{error}</p>}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <section aria-label="World transfer" className="space-y-2 rounded-xl border border-stone-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onExportWorld()} className="ui-btn">
                <Download size={15} aria-hidden="true" /> Export current island
              </button>
              <label className="relative inline-flex min-h-9 items-center gap-2 rounded-md border border-stone-300 px-3 font-semibold focus-within:outline-2">
                <Upload size={15} aria-hidden="true" /> Import JSON backup
                <input type="file" accept=".json,application/json" disabled={busy} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Import JSON backup" onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void readFile(file);
                  }}/>
              </label>
            </div>
            {selectedWorld && (
              <div className="space-y-2">
                {worlds.length > 1 && <label className="block">World to import
                  <select className="ml-2 rounded border px-2 py-1" value={worldIndex} onChange={event => setWorldIndex(Number(event.target.value))}>
                    {worlds.map((world, i) => <option key={i} value={i}>{world.name}</option>)}
                  </select>
                </label>}
                <p>{selectedWorld.name} · {selectedWorld.state.elements.length.toLocaleString()} items · {modeBadge(selectedWorld.state.mode).label}</p>
                {emptySlot < 0 && slots.length >= MAX_SAVE_SLOTS ? <p>All ten slots are full. Export an island before making room.</p> :
                  <button type="button" disabled={busy} onClick={() => void importSelected()} className="ui-btn">
                    {emptySlot < 0 ? "Add a slot and import" : `Import into slot ${emptySlot + 1}`}
                  </button>}
              </div>
            )}
            {transferMessage && <p role="status">{transferMessage}</p>}
          </section>
          {Array.from({ length: slots.length }, (_, idx) => {
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
                      aria-label={`Island name for slot ${idx + 1}`}
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
                          aria-label={`Rename island in slot ${idx + 1}`}
                          autoFocus
                          onChange={(e) =>
                            setDraftNames((prev) =>
                              prev.map((v, i) => (i === idx ? e.target.value : v)),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingIdx(null);
                              setDraftNames(names => names.map((value, index) => index === idx ? slot.name : value));
                            }
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
                      onClick={() => setConfirm({index: idx, action: "overwrite"})}
                      className="flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-100"
                      title="Overwrite this slot with your current island"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Overwrite</span>
                    </button>
                    <button type="button" onClick={() => onExportWorld(idx)} className="ui-btn"
                      aria-label={`Export ${slot.name}`}><Download size={15} aria-hidden="true" /> Export</button>
                    <button
                      type="button"
                      onClick={() => setConfirm({index: idx, action: "delete"})}
                      aria-label={`Delete ${slot.name}`}
                      className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                      title="Delete Saved Civilization"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {confirm?.index === idx && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3 text-sm">
                    <span>{confirm.action === "delete" ? `Delete “${slot.name}”?` : `Replace “${slot.name}” with the current island?`}</span>
                    <button type="button" className="ui-btn" onClick={() => setConfirm(null)}>Cancel</button>
                    <button type="button" className="ui-btn" onClick={() => {
                      setConfirm(null);
                      if (confirm.action === "delete") onDeleteSlot(idx);
                      else onSaveToSlot(idx, slot.name);
                    }}>{confirm.action === "delete" ? "Delete island" : "Replace island"}</button>
                  </div>
                )}
              </div>
            );
          })}
          {slots.length < MAX_SAVE_SLOTS && (
            <button type="button" disabled={busy} className="ui-btn w-full justify-center" onClick={async () => {
              setBusy(true);
              try { await onAddSlot(); } finally { setBusy(false); }
            }}><Plus size={16} aria-hidden="true" /> Add save slot · up to {MAX_SAVE_SLOTS}</button>
          )}
        </div>
      </div>
    </GameDialog>
  );
};
