import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, Cloud, Download, Ellipsis, HardDrive, Plus, Upload, X } from "lucide-react";
import { GameDialog } from "./GameDialog";
import { MODE_TUTORIAL_LABELS } from "../game/tutorialFlows";
import { syncState, watchSync } from "../game/accountSync";
import { currentPlayer, isCloudSavePending, readPlayerItem, slotKey } from "../game/deviceSaves";
import { type CivilizationSaveSlot, MAX_SAVE_SLOTS } from "../game/saveSlots";
import { islandProductAvailable } from "../game/islandLicenses";
import { productForEra, productForMode, productById } from "../game/storeCatalog.mjs";
import { EraSelect } from "./PeriodPicker";
import type { EraKey } from "../game/eraStyles";
import { createInitialGameState } from "../game/simulation";
import type { GameState } from "../game/simulation";
import { MAX_TRANSFER_BYTES, readWorldFile, type TransferWorld } from "../game/worldTransfer";
import "./saveSlots.css";

type Props = {
  error?: string;
  deviceError?: string;
  open: boolean;
  slots: (CivilizationSaveSlot | null)[];
  activeSlotIndex: number | null;
  currentState: GameState;
  saveKey: string;
  onClose: () => void;
  onShop: (productId:string) => void;
  onExportWorld: (slotIndex?: number) => void;
  onImportWorld: (slotIndex: number, world: TransferWorld) => Promise<boolean>;
  linkedWorlds: TransferWorld[];
  onAddSlot: () => Promise<number | undefined>;
  onSaveToSlot: (slotIndex: number, name: string) => Promise<void>;
  onLoadSlot: (slotIndex: number) => void;
  onRenameSlot: (slotIndex: number, name: string) => void;
  onDeleteSlot: (slotIndex: number) => void;
};

const modeLabel = (mode: GameState["mode"]) =>
  MODE_TUTORIAL_LABELS[mode];

export function SaveSlotsModal({ open, ...props }: Props) {
  return open ? <SavedIslands {...props} /> : null;
}

function SavedIslands({
  slots, activeSlotIndex, currentState, saveKey, error, deviceError, linkedWorlds,
  onClose, onShop, onExportWorld, onImportWorld, onAddSlot, onSaveToSlot, onLoadSlot, onRenameSlot, onDeleteSlot,
}: Omit<Props, "open">) {
  const sync = useSyncExternalStore(watchSync, syncState);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);
  const [fileWorlds, setFileWorlds] = useState<TransferWorld[]>([]);
  const [worldIndex, setWorldIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState<number | null>(null);
  const [form, setForm] = useState<{ action: "create" | "name" | "rename" | "delete" | "replace"; index: number } | null>(null);
  const [name, setName] = useState("");
  const [newEra, setNewEra] = useState<EraKey>("original");
  const [newMode, setNewMode] = useState<GameState["mode"]>("real");
  const worlds = fileWorlds.length ? fileWorlds : linkedWorlds;
  const selectedWorld = worlds[worldIndex];
  const emptySlot = slots.findIndex(slot => slot === null);
  const canAdd = emptySlot >= 0 || slots.length < MAX_SAVE_SLOTS;
  const activeIsland = activeSlotIndex === null ? undefined : slots[activeSlotIndex];
  const key = activeSlotIndex === null ? saveKey : slotKey(activeSlotIndex);
  const signedIn = Boolean(currentPlayer());
  const pending = isCloudSavePending(key) || isCloudSavePending("pixel_civ_last_mode");
  const conflict = sync.conflicts.includes(key) || sync.conflicts.includes("pixel_civ_last_mode");
  const upToDate = signedIn && online && sync.lastSync > 0 && readPlayerItem(key) !== null && !pending && !conflict && !deviceError;
  const status = deviceError ? deviceError
    : conflict ? "Resolve the account conflict in More → Account."
    : !signedIn ? "Autosave on this device"
    : !online ? "Offline · Sync resumes when you reconnect"
    : upToDate ? "Saved to your account"
    : sync.busy ? "Syncing to your account…"
    : "Autosave on · Account sync pending";

  async function readFile(file: File) {
    setBusy(true);
    setFileWorlds([]);
    setWorldIndex(0);
    setMessage("");
    try {
      if (file.size > MAX_TRANSFER_BYTES) throw Error("This file exceeds 16 MiB.");
      setFileWorlds(readWorldFile(await file.text()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This backup could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function importSelected() {
    if (busy || !selectedWorld) return;
    setBusy(true);
    setMessage("");
    try {
      const index = emptySlot >= 0 ? emptySlot : await onAddSlot();
      if (index !== undefined && await onImportWorld(index, selectedWorld)) {
        setFileWorlds(fileWorlds.filter((_, i) => i !== worldIndex));
        setWorldIndex(0);
        setMessage(`Imported “${selectedWorld.name}”.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!form || busy) return;
    const { action, index } = form;
    setBusy(true);
    try {
      if (action === "create") {
        const locked=[productForMode(newMode),productForEra(newEra)].find(id=>!islandProductAvailable(id));
        if(locked){setMessage("Unlock "+productById(locked)?.label+" to use it on this island.");onShop(locked);return;}
        const slot = index >= 0 ? index : await onAddSlot();
        if (slot === undefined) return;
        const state = createInitialGameState(newMode);
        state.appearanceEra = newEra;
        if (!await onImportWorld(slot, {name:name.trim(), state, customElements:[]})) return;
        onLoadSlot(slot);
      } else if (action === "name") {
        const slot = index >= 0 ? index : await onAddSlot();
        if (slot === undefined) return;
        await onSaveToSlot(slot, name);
      } else if (action === "rename") onRenameSlot(index, name);
      else if (action === "replace") await onSaveToSlot(index, slots[index]?.name ?? "");
      else onDeleteSlot(index);
      setForm(null);
      setOptions(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GameDialog label="Saved islands" onDismiss={onClose} className="island-modal save-dialog">
      <div className="save-panel">
        <header className="save-header">
          <h2>Saved islands</h2>
          <button className="save-icon" type="button" aria-label="Close saved islands" onClick={onClose} data-dialog-focus>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="save-body">
          <section className="save-current" aria-label="Current island">
            <div className="save-current-title">
              <h3>{activeIsland?.name ?? "Current island"}</h3>
              <span className="save-mode">{modeLabel(currentState.mode)}</span>
            </div>
            <p className="save-status" role={deviceError || conflict ? "alert" : "status"}>
              {signedIn ? <Cloud size={17} aria-hidden="true" /> : <HardDrive size={16} aria-hidden="true" />}
              {status}
            </p>
            <p className="save-detail">{currentState.population.toLocaleString()} residents · {Math.round(currentState.happiness)}% happy</p>
            {canAdd && <button className="save-button" type="button" disabled={busy} onClick={() => {
              setName(activeIsland ? activeIsland.name + " copy" : "");
              setForm({ action: "name", index: emptySlot });
            }}><Plus size={16} aria-hidden="true" />{activeIsland ? "Make a copy" : "Name this island"}</button>}
            {canAdd && <button className="save-button" type="button" disabled={busy} onClick={()=>{
              setName(""); setNewEra("original"); setNewMode(islandProductAvailable(productForMode(currentState.mode))?currentState.mode:"real"); setForm({action:"create",index:emptySlot});
            }}><Plus size={16} aria-hidden="true"/> New island</button>}
          </section>

          {error && <p className="save-error" role="alert">{error}</p>}

          {form && (
            <form className="save-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
              {form.action === "create" || form.action === "name" || form.action === "rename" ? (
                <label>
                  {form.action === "rename" ? "New island name" : "Island name"}
                  <input autoFocus value={name} maxLength={36} placeholder="Island name"
                    onChange={event => setName(event.currentTarget.value)} />
                </label>
              ) : <p>{form.action === "delete" ? "Delete" : "Replace"} “{slots[form.index]?.name}”?</p>}
              {form.action === "create" && <>
                <label>Game mode<select value={newMode} onChange={e=>setNewMode(e.target.value as GameState["mode"])}>
                  {(["god","real","survival","idle","manager"] as const).map(mode=><option value={mode} key={mode}>{modeLabel(mode)}</option>)}
                </select></label>
                <EraSelect value={newEra} onChange={setNewEra}/>
              </>}
              <div className="save-actions">
                <button type="button" className="save-button" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
                <button className={form.action === "delete" ? "save-button save-danger" : "save-button save-primary"} type="submit"
                  disabled={busy || ((form.action === "create" || form.action === "name" || form.action === "rename") && !name.trim())}>
                  {form.action === "create" ? "Create island" : form.action === "delete" ? "Delete island" : form.action === "replace" ? "Replace island" : "Save name"}
                </button>
              </div>
            </form>
          )}

          <section aria-label="Named islands" className="save-library">
            <div className="save-library-heading"><h3>Your islands</h3><span>{slots.filter(Boolean).length} / {MAX_SAVE_SLOTS}</span></div>
            {!slots.some(Boolean) && <p className="save-detail">Name your current island to find it here.</p>}
            {slots.map((slot, index) => {
              if (!slot) return null;
              const active = index === activeSlotIndex;
              return <article className={"save-island" + (active ? " is-active" : "")} key={index}>
                <div className="save-island-row">
                  <div className="save-island-info">
                    <h4>{slot.name}</h4>
                    <p className="save-detail">{modeLabel(slot.mode)} · {active ? "Playing" : "Stage " + slot.currentStage}</p>
                    {!active && <p className="save-detail">{slot.population.toLocaleString()} residents</p>}
                  </div>
                  {!active && <button className="save-button save-primary" type="button" disabled={busy} onClick={() => onLoadSlot(index)}
                    aria-label={`Open ${slot.name}`}>Open <ArrowRight size={15} aria-hidden="true" /></button>}
                  <button className="save-icon" type="button" aria-label={`Options for ${slot.name}`} aria-expanded={options === index}
                    onClick={() => setOptions(options === index ? null : index)}><Ellipsis size={20} aria-hidden="true" /></button>
                </div>
                {options === index && <div className="save-options">
                  <button type="button" onClick={() => { setName(slot.name); setForm({ action: "rename", index }); }}>Rename</button>
                  <button type="button" onClick={() => onExportWorld(index)}>Export</button>
                  {!active && <button type="button" onClick={() => setForm({ action: "replace", index })}>Replace with current</button>}
                  <button type="button" className="save-danger" onClick={() => setForm({ action: "delete", index })}>Delete</button>
                </div>}
              </article>;
            })}
          </section>

          <details className="save-backups" open={selectedWorld ? true : undefined}>
            <summary>Import &amp; export</summary>
            <div className="save-actions">
              <button type="button" className="save-button" onClick={() => onExportWorld()}><Download size={16} aria-hidden="true" /> Export current</button>
              <label className="save-button save-upload"><Upload size={16} aria-hidden="true" /> Import backup
                <input type="file" accept=".json,application/json" disabled={busy} aria-label="Import JSON backup"
                  onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void readFile(file);
                  }} />
              </label>
            </div>
            {selectedWorld && <>
              {worlds.length > 1 && <label>World to import <select value={worldIndex} onChange={event => setWorldIndex(Number(event.currentTarget.value))}>
                {worlds.map((world, i) => <option key={i} value={i}>{world.name}</option>)}
              </select></label>}
              <p className="save-detail">{selectedWorld.name} · {modeLabel(selectedWorld.state.mode)}</p>
              {canAdd ? <button type="button" disabled={busy} className="save-button save-primary" onClick={() => void importSelected()}>Import island</button>
                : <p>All ten slots are full.</p>}
            </>}
            {message && <p role="status">{message}</p>}
          </details>
        </div>
      </div>
    </GameDialog>
  );
}
