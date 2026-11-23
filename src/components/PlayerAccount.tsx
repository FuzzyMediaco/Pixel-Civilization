import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  autosync,
  cloudAvailable,
  openCloudChanges,
  resolveSave,
  saveLabel,
  signIn,
  signOut,
  syncState,
  watchSync,
} from "../game/accountSync";
import {
  currentPlayer,
  deviceIssue,
  freezeWrites,
  listRecovery,
  onDeviceChange,
  restoreRecovery,
  type Recovery,
} from "../game/deviceSaves";

export function PlayerAccount({ saveNow }: { saveNow: () => boolean }) {
  const progress = useRef<HTMLDialogElement>(null);
  const user = currentPlayer();
  const sync = useSyncExternalStore(watchSync, syncState);
  const device = useSyncExternalStore(onDeviceChange, deviceIssue);
  const [create, setCreate] = useState(false),
    [email, setEmail] = useState(user?.email ?? ""),
    [pass, setPass] = useState("");
  const [importGuest, setImportGuest] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [login, setLogin] = useState(false),
    [backups, setBackups] = useState<Recovery[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);
  useEffect(() => {
    const dialog = progress.current;
    if (busy && dialog && !dialog.open) dialog.showModal();
    else if (!busy && dialog?.open) dialog.close();
  }, [busy]);
  useEffect(() => {
    if (showRecovery)
      void listRecovery()
        .then(setBackups)
        .catch(() => setError("Recovery copies could not be opened."));
  }, [showRecovery]);
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!saveNow())
        throw Error("Save your island to this device before switching.");
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function recover(b: Recovery) {
    freezeWrites(true);
    try {
      await restoreRecovery(b);
      location.reload();
    } catch (e) {
      freezeWrites(false);
      throw e;
    }
  }
  const form = (!user || login) && (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void act(() => signIn(email, pass, create, importGuest));
      }}
      className="player-auth"
    >
      <div role="group" aria-label="Account action" className="player-buttons">
        <button
          type="button"
          className="ui-btn"
          aria-pressed={!create}
          onClick={() => setCreate(false)}
        >
          Sign in
        </button>
        {!user && (
          <button
            type="button"
            className="ui-btn"
            aria-pressed={create}
            onClick={() => setCreate(true)}
          >
            Create account
          </button>
        )}
      </div>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete={create ? "new-password" : "current-password"}
          required
          minLength={create ? 8 : 1}
          maxLength={256}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
      </label>
      {create && <small>Use at least eight characters.</small>}
      {!user && (
        <label className="player-checkbox">
          <input
            type="checkbox"
            checked={importGuest}
            onChange={(e) => setImportGuest(e.target.checked)}
          />
          Include this device’s guest islands. Existing account islands keep
          their own copy.
        </label>
      )}
      <button
        type="submit"
        className="ui-btn is-primary"
        disabled={busy || !cloudAvailable()}
      >
        {busy
          ? "Connecting…"
          : create
            ? "Create account & sync"
            : "Sign in & sync"}
      </button>
    </form>
  );
  return (
    <section className="player-account" aria-label="Player account">
      <dialog
        className="player-progress"
        ref={progress}
        onCancel={(e) => e.preventDefault()}
        aria-label="Updating your saves"
      >
        <span role="status">Updating your saves…</span>
      </dialog>
      <h3>{user ? user.email : "Play on more than one device"}</h3>
      <p>
        {user
          ? "This device keeps its own playable copy. While online, islands and settings sync to your account."
          : "Your guest islands save on this device. Sign in to bring them to another phone or computer."}
      </p>
      {device && <p role="alert">{device}</p>}
      {!cloudAvailable() && (
        <p>
          Account sync is available in the installed apps and on the hosted
          game.
        </p>
      )}
      {user && (
        <>
          <p role="status">
            {sync.busy ? "Syncing…" : sync.message || "Local copy ready."}
            {sync.lastSync > 0 && !sync.busy && (
              <> Last checked {new Date(sync.lastSync).toLocaleTimeString()}.</>
            )}
          </p>
          <div className="player-buttons">
            <button
              className="ui-btn"
              disabled={busy || sync.busy}
              onClick={() => void act(autosync)}
            >
              Sync now
            </button>
            {sync.updates && (
              <button
                className="ui-btn"
                disabled={busy || sync.busy}
                onClick={() => void act(openCloudChanges)}
              >
                Load account updates
              </button>
            )}
            <button
              className="ui-btn"
              disabled={busy}
              onClick={() => setLogin(!login)}
            >
              {login ? "Close sign in" : "Sign in again"}
            </button>
            <button
              className="ui-btn"
              disabled={busy}
              onClick={() => void act(signOut)}
            >
              Sign out
            </button>
          </div>
          {sync.conflicts.map((k) => (
            <div className="player-conflict" key={k}>
              <b>{saveLabel(k)}</b>
              <p>
                Both devices changed this save. The other version stays in
                Recovery copies.
              </p>
              <div className="player-buttons">
                <button
                  className="ui-btn"
                  disabled={busy}
                  onClick={() => void act(() => resolveSave(k, "device"))}
                >
                  Use this device
                </button>
                <button
                  className="ui-btn"
                  disabled={busy}
                  onClick={() => void act(() => resolveSave(k, "account"))}
                >
                  Use account save
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {form}
      {cloudAvailable() && (
        <button
          className="ui-btn"
          aria-expanded={showRecovery}
          onClick={() => setShowRecovery(!showRecovery)}
        >
          Recovery copies
        </button>
      )}
      {showRecovery &&
        (backups.length ? (
          backups.map((b) => (
            <div className="player-conflict" key={b.key + b.label}>
              <b>{saveLabel(b.key)}</b>
              <small>
                {b.label} · {new Date(b.saved).toLocaleString()}
              </small>
              <button
                className="ui-btn"
                disabled={busy}
                onClick={() => void act(() => recover(b))}
              >
                Restore this copy
              </button>
            </div>
          ))
        ) : (
          <p>No recovery copies yet.</p>
        ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
