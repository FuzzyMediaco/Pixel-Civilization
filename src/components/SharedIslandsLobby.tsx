import { useEffect, useRef, useState } from "react";
import { ArrowRight, Cloud, Copy, Globe2, Plus, Users, X } from "lucide-react";
import { SHARED_MODES, sharedMode, type SharedMode } from "../game/sharedIsland";
import { MODE_NAMES, sharedError, sharedRequest, sharedRoute } from "../game/sharedClient";
import type { SharedAccess } from "../game/sharedProtocol";
import type { GameState } from "../game/simulation";
import type { CivilizationSaveSlot } from "../game/saveSlots";
import { GameDialog } from "./GameDialog";
import "./sharedIslands.css";

export function SharedIslandsLobby({ state, saves, onClose }: {
  state: GameState; saves: (CivilizationSaveSlot | null)[]; onClose: () => void;
}) {
  const [rooms, setRooms] = useState<SharedAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [mode, setMode] = useState<SharedMode>("god");
  const [source, setSource] = useState("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    sharedRequest<{ rooms: SharedAccess[] }>("rooms", undefined, controller.signal)
      .then(reply => setRooms(reply.rooms))
      .catch(err => { if (!controller.signal.aborted) setError(sharedError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const selected = source === "current" ? state : saves[Number(source)]?.state;
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const chosenMode = source === "new" ? mode : selected?.mode;
      if (!sharedMode(chosenMode)) throw Error("Choose a God, Real or Survival island.");
      const world = source === "new" ? undefined : selected;
      const { room } = await sharedRequest<{ room: SharedAccess }>("rooms", {
        requestId: requestId.current ??= crypto.randomUUID(), name, profile, mode: chosenMode,
        world: world && { ...world, toasts: [], constructionHistory: [] },
      });
      onClose();
      location.hash = sharedRoute(room.id);
    } catch (e) {
      setError(sharedError(e));
    } finally { setBusy(false); }
  }

  return (
    <GameDialog className="shared-lobby" label="Shared Islands" onDismiss={onClose}>
      <section className="shared-lobby-card">
        <header className="shared-lobby-head">
          <span className="shared-mark"><Globe2 size={23} /></span>
          <div><h1>Shared Islands</h1><p>Build a civilization together.</p></div>
          <button className="shared-icon" type="button" aria-label="Close shared islands" onClick={onClose}><X size={20} /></button>
        </header>
        {creating ? <form className="shared-stack" onSubmit={create}>
          <label>Island name<input required maxLength={36} value={name} onChange={e => setName(e.target.value)} placeholder="Harbor Together" /></label>
          <label>Display name <small>Optional</small><input maxLength={22} value={profile} onChange={e => setProfile(e.target.value)} placeholder="Name other builders will see" /></label>
          <label>Start with<select value={source} onChange={e => setSource(e.target.value)}>
            <option value="new">New island</option>
            {sharedMode(state.mode) && <option value="current">Copy current island</option>}
            {saves.map((save, index) => save && sharedMode(save.state.mode) &&
              <option key={index} value={String(index)}>Copy {save.name}</option>)}
          </select></label>
          {source === "new" ? <label>Game mode<select value={mode} onChange={e => setMode(e.target.value as SharedMode)}>
            {SHARED_MODES.map(value => <option key={value} value={value}>{MODE_NAMES[value]} mode</option>)}
          </select></label> : <p className="shared-notice"><Copy size={16} /> Your original island stays in your personal saves.</p>}
          <div className="shared-actions">
            <button type="submit" className="shared-primary" disabled={busy}>{busy ? "Creating…" : "Create shared island"}</button>
            <button type="button" disabled={busy} onClick={() => { setCreating(false); setError(""); }}>Back</button>
          </div>
        </form> : <>
          <div className="shared-lobby-intro"><Users size={19} /><p>Invite up to three friends. Build together, or give visitors a seat to watch.</p></div>
          <div className="shared-rooms">
            {loading ? <p role="status">Loading your islands…</p> : rooms.length ? rooms.map(room =>
              <a key={room.id} href={sharedRoute(room.id)} onClick={onClose}>
                <span className="shared-room-icon"><Globe2 size={19} /></span>
                <span><b>{room.name}</b><small>{MODE_NAMES[room.mode]} mode · {room.role}</small></span>
                <ArrowRight size={17} />
              </a>
            ) : <p className="shared-empty">Your shared islands will appear here.</p>}
          </div>
          <button type="button" className="shared-primary" onClick={() => { setCreating(true); requestId.current = undefined; setError(""); }}><Plus size={18} /> New shared island</button>
          <p className="shared-foot"><Cloud size={15} /> Automatically saved to the cloud</p>
        </>}
        {error && <p className="shared-notice is-error" role="alert">{error}</p>}
      </section>
    </GameDialog>
  );
}
