import { isGiftDesignKey } from "./giftDesignKeys.mjs";
import { isSaveSlotIndex, INITIAL_SAVE_SLOTS, MAX_SAVE_SLOTS } from "./saveSlotLimits";

/** Large islands live in IndexedDB. A per-profile read cache keeps the simulation's synchronous reads cheap. */
export interface Player {
  id: string;
  email: string;
}
export interface SaveRecord {
  profile: string;
  key: string;
  data: string;
  rev: string;
  version: number;
  dirty: boolean;
}
export interface Recovery {
  profile: string;
  key: string;
  label: string;
  data: string;
  saved: number;
}
const GUEST = "guest";
const LEGACY_SLOTS = "pixel_civ_saved_slots_v1";
export const slotKey = (i: number) => "pixel_civ_slot_" + i;
export const isPlayerKey = (key: string) => {
  if (isGiftDesignKey(key)) return true;
  const slot = /^pixel_civ_slot_(0|[1-9]\d*)$/.exec(key);
  return slot ? isSaveSlotIndex(Number(slot[1])) :
    /^pixel_civ_(save_v1_[a-z0-9-]+|lab_snapshot|last_mode|example_origin|place_hints|pix_custom_elements_v1|playbook_checks_v1|course_checks_v1|build_habits_v1|quick_drawer_(habits|prefs)_v1|quick_build_mode_v1|quick_menu_prefs_v1)$/.test(key);
};
let db: IDBDatabase | undefined, boot: Promise<void> | undefined;
let player: Player | null = null,
  frozen = false,
  issue = "";
const cache = new Map<string, SaveRecord>();
const pending = new Set<Promise<void>>();
const blocked = new Set<string>();
const listeners = new Set<() => void>();
const errors = new Map<string, string>();
const revisionId = () =>
  globalThis.crypto?.randomUUID?.() ??
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
const tabId = () => (sessionId ??= revisionId());
let sessionId: string | undefined;
let profileChanges: BroadcastChannel | undefined;
export const currentPlayer = () => player;
export const scope = () => player?.id ?? GUEST;
export const deviceReady = () => !!db;
export const deviceIssue = () => issue || [...errors.values()][0] || "";
export function onDeviceChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify() {
  for (const fn of listeners) fn();
}
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? Error("Device storage transaction cancelled."));
  });
}
function collect<T>(s: string, who: string): Promise<T[]> {
  return request(
    db!.transaction(s).objectStore(s).index("profile").getAll(who),
  );
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("pixel-civilization-player-data", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("meta");
      r.result
        .createObjectStore("saves", { keyPath: ["profile", "key"] })
        .createIndex("profile", "profile");
      r.result
        .createObjectStore("backups", { keyPath: ["profile", "key", "label"] })
        .createIndex("profile", "profile");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const newRow = (profile: string, key: string, data: string): SaveRecord => ({
  profile,
  key,
  data,
  rev: revisionId(),
  version: 0,
  dirty: true,
});

async function importLegacy() {
  const legacy = new Map<string, string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (isPlayerKey(k) || k === LEGACY_SLOTS)) {
        const value = localStorage.getItem(k);
        if (value !== null) legacy.set(k, value);
      }
    }
  } catch {
    return;
  }
  if (!legacy.size) return;
  const rows = new Map(legacy),
    slots = rows.get(LEGACY_SLOTS);
  rows.delete(LEGACY_SLOTS);
  if (slots) {
    try {
      const parsed = JSON.parse(slots);
      if (!Array.isArray(parsed)) throw Error();
      parsed.slice(0, MAX_SAVE_SLOTS).forEach((s, i) => {
        if (!rows.has(slotKey(i)) && (s || i >= INITIAL_SAVE_SLOTS)) rows.set(slotKey(i), JSON.stringify(s));
      });
    } catch {
      legacy.delete(LEGACY_SLOTS);
    } // leave unreadable originals available for recovery
  }
  const tx = db!.transaction(["saves", "backups"], "readwrite"),
    done = complete(tx),
    store = tx.objectStore("saves");
  for (const [key, data] of rows) {
    const check = store.get([GUEST, key]);
    check.onsuccess = () => {
      if (check.result === undefined) store.put(newRow(GUEST, key, data));
      else if (check.result.data !== data)
        tx.objectStore("backups").put({
          profile: GUEST,
          key,
          label: "Previous browser copy",
          data,
          saved: Date.now(),
        });
    };
  }
  await done;
  for (const [key, data] of legacy) {
    try {
      if (localStorage.getItem(key) === data) localStorage.removeItem(key);
    } catch {
      /* imported successfully */
    }
  }
}
export function openDeviceSaves(): Promise<void> {
  return (boot ??= (async () => {
    try {
      db = await open();
      db.onversionchange = () => {
        db?.close();
        location.reload();
      };
      if (typeof BroadcastChannel !== "undefined") {
        profileChanges = new BroadcastChannel("pixel-civilization-player");
        profileChanges.onmessage = async () => {
          const selected = await request<Player | null | undefined>(
            db!.transaction("meta").objectStore("meta").get("player"),
          );
          if ((selected?.id ?? GUEST) === scope()) return;
          window.dispatchEvent(new Event("pixel-save-before-switch"));
          freezeWrites(true);
          try {
            await flushDevice();
          } finally {
            reopenSavedIsland();
          }
        };
      }
      await importLegacy();
      player =
        (await request(
          db.transaction("meta").objectStore("meta").get("player"),
        )) ?? null;
      for (const row of await collect<SaveRecord>("saves", scope()))
        cache.set(row.key, row);
    } catch {
      db?.close();
      db = undefined;
      issue =
        "Device database unavailable. This session uses limited browser storage.";
    }
  })());
}
export const isCloudSavePending = (key: string) => cache.get(key)?.dirty === true;

export function cachedGiftDesigns() {
  return [...cache.values()].filter(row => isGiftDesignKey(row.key) && !row.dirty);
}
export function readPlayerItem(key: string): string | null {
  return db ? (cache.get(key)?.data ?? null) : localStorage.getItem(key);
}
export function writePlayerItem(key: string, data: string) {
  writePlayerItems([[key, data]]);
}
export function writePlayerItems(items: [string, string][]) {
  if (frozen) return;
  if (!db) {
    for (const [key, data] of items) localStorage.setItem(key, data);
    return;
  }
  const changes = items.filter(([key, data]) => {
    if (!isPlayerKey(key)) throw Error("Unknown player data key.");
    return cache.get(key)?.data !== data || errors.has(key);
  });
  if (!changes.length) return;
  const tx = db.transaction(["saves", "backups"], "readwrite");
  const store = tx.objectStore("saves");
  const hadError = changes.some(([key]) => errors.has(key));
  for (const [key, data] of changes) {
    const old = cache.get(key);
    const row = { ...newRow(scope(), key, data), version: old?.version ?? 0 };
    cache.set(key, row);
    const stored = store.get([row.profile, key]);
    stored.onsuccess = () => {
      const disk = stored.result as SaveRecord | undefined;
      const navigation =
        key === "pixel_civ_last_mode" || key === "pixel_civ_example_origin";
      if (
        !navigation &&
        (blocked.has(key) ||
          (disk?.rev !== old?.rev &&
            disk?.data !== old?.data &&
            !errors.has(key)))
      ) {
        // Another tab got here first. Preserve both branches until the player chooses one.
        tx.objectStore("backups").put({
          profile: row.profile,
          key,
          label: "Other tab " + tabId(),
          data,
          saved: Date.now(),
        });
        blocked.add(key);
        issue =
          "Another tab changed this save. Your version is kept in Account → Recovery copies. Reload to open the current version.";
      } else {
        store.put({ ...row, version: disk?.version ?? 0 });
      }
    };
  }
  const job = complete(tx).then(
    () => {
      for (const [key] of changes) errors.delete(key);
    },
    () => {
      for (const [key] of changes)
        errors.set(
          key,
          "Saving to this device failed. Keep the game open and free device storage.",
        );
    },
  );
  pending.add(job);
  void job.then(() => {
    pending.delete(job);
    if (hadError || deviceIssue()) notify();
  });
}
/** Install an imported slot and any new design definitions as one operation. */
export async function insertPlayerSlot(index: number, data: string, custom?: [string, string]) {
  if (!isSaveSlotIndex(index)) throw Error("This slot number is unavailable.");
  await flushDevice();
  if (frozen) throw Error("Wait for the account switch to finish, then try again.");
  const key = slotKey(index);
  const who = scope();
  const items: [string, string][] = [[key, data]];
  if (custom) items.push(custom);
  if (!db) {
    const disk = localStorage.getItem(key);
    if (disk !== null && disk !== "null") throw Error("This slot is already occupied.");
    // A storage quota error must leave the original save and library intact.
    const previous = custom && localStorage.getItem(custom[0]);
    if (custom) localStorage.setItem(...custom);
    try {
      localStorage.setItem(key, data);
    } catch (error) {
      if (custom) {
        if (previous == null) localStorage.removeItem(custom[0]);
        else localStorage.setItem(custom[0], previous);
      }
      throw error;
    }
    return;
  }

  const tx = db.transaction("saves", "readwrite");
  const done = complete(tx);
  const store = tx.objectStore("saves");
  let conflict = false;
  const rows: SaveRecord[] = [];
  // Read and write in callbacks of the same transaction, including on Safari.
  for (const [itemKey, value] of items) {
    const expected = cache.get(itemKey);
    const get = store.get([who, itemKey]);
    get.onsuccess = () => {
      const disk = get.result as SaveRecord | undefined;
      if (itemKey === key ? disk && disk.data !== "null" : disk?.rev !== expected?.rev) {
        conflict = true;
        tx.abort();
        return;
      }
      const row = { ...newRow(who, itemKey, value), version: disk?.version ?? 0 };
      rows.push(row);
      store.put(row);
    };
  }
  const work = done.then(() => {
    if (scope() === who) {
      for (const row of rows) cache.set(row.key, row);
      notify();
    }
  });
  // Account switches and cloud sync flush any transfer already in flight.
  const tracked = work.catch(() => {});
  pending.add(tracked);
  try {
    await work;
  } catch (error) {
    if (conflict) throw Error("This slot or its Pix designs changed on another device. Reload and try again.");
    throw error;
  } finally {
    pending.delete(tracked);
  }
}
export async function flushDevice() {
  await Promise.all([...pending]);
  if (errors.size) throw Error(deviceIssue());
}
export const freezeWrites = (value: boolean) => {
  frozen = value;
};
export const readRecords = (who: string) => collect<SaveRecord>("saves", who);
export const listRecovery = () => collect<Recovery>("backups", scope());
export function reopenSavedIsland() {
  const u = new URL(location.href);
  const hash = new URLSearchParams(u.hash.slice(1));
  for (const k of ["world", "mode", "view"]) hash.delete(k);
  u.hash = hash.toString();
  history.replaceState(null, "", u);
  location.reload();
}
export async function rememberPlayer(next: Player | null) {
  const tx = db!.transaction("meta", "readwrite");
  tx.objectStore("meta").put(next, "player");
  await complete(tx);
  profileChanges?.postMessage("changed");
}
export async function copyGuestIslands(to: string) {
  const guest = await readRecords(GUEST);
  const tx = db!.transaction(["saves", "backups"], "readwrite"),
    done = complete(tx),
    store = tx.objectStore("saves");
  for (const r of guest) {
    const req = store.get([to, r.key]);
    req.onsuccess = () => {
      if (!req.result) store.put(newRow(to, r.key, r.data));
      else if (req.result.data !== r.data)
        tx.objectStore("backups").put({
          profile: to,
          key: r.key,
          label: "Imported guest copy",
          data: r.data,
          saved: Date.now(),
        });
    };
  }
  await done;
}
/** Compare local revisions inside the transaction, since another tab can edit while the network is in flight. */
export async function acceptCloud(
  who: string,
  key: string,
  version: number,
  data: string,
  expectedRev: string | undefined,
  keepLocal = false,
): Promise<boolean> {
  const tx = db!.transaction(["saves", "backups"], "readwrite"),
    done = complete(tx),
    store = tx.objectStore("saves");
  const req = store.get([who, key]);
  let accepted = false;
  req.onsuccess = () => {
    const local = req.result as SaveRecord | undefined;
    if (local?.rev !== expectedRev) return;
    if (keepLocal && local && local.data !== data)
      tx.objectStore("backups").put({
        profile: who,
        key,
        label: "Before cloud restore",
        data: local.data,
        saved: Date.now(),
      });
    const row = { ...newRow(who, key, data), version, dirty: false };
    store.put(row);
    accepted = true;
    tx.addEventListener("complete", () => {
      if (who === scope() && cache.get(key)?.rev === expectedRev) {
        cache.set(key, row);
        if (key.startsWith("pixel_civ_slot_") || isGiftDesignKey(key)) notify();
      }
    });
  };
  await done;
  return accepted;
}
export async function acknowledgeUpload(row: SaveRecord, version: number) {
  const tx = db!.transaction("saves", "readwrite"),
    done = complete(tx),
    store = tx.objectStore("saves");
  const req = store.get([row.profile, row.key]);
  req.onsuccess = () => {
    const local = req.result as SaveRecord | undefined;
    if (!local || local.version > version) return;
    store.put({ ...local, version, dirty: local.rev !== row.rev });
    tx.addEventListener("complete", () => {
      const entry = cache.get(row.key);
      if (entry && row.profile === scope()) {
        entry.version = version;
        if (entry.rev === row.rev) entry.dirty = false;
      }
    });
  };
  await done;
}
export async function backupCloudCopy(who: string, key: string, data: string) {
  const tx = db!.transaction("backups", "readwrite");
  tx.objectStore("backups").put({
    profile: who,
    key,
    label: "Previous cloud version",
    data,
    saved: Date.now(),
  });
  await complete(tx);
}

export async function restoreRecovery(copy: Recovery) {
  if (copy.profile !== scope())
    throw Error("This recovery copy belongs to another player.");
  await flushDevice();
  const tx = db!.transaction(["saves", "backups"], "readwrite"),
    done = complete(tx),
    store = tx.objectStore("saves");
  const req = store.get([copy.profile, copy.key]);
  req.onsuccess = () => {
    const old = req.result as SaveRecord | undefined;
    if (old)
      tx.objectStore("backups").put({
        profile: scope(),
        key: copy.key,
        label: "Before device restore",
        data: old.data,
        saved: Date.now(),
      });
    store.put({
      ...newRow(scope(), copy.key, copy.data),
      version: old?.version ?? 0,
    });
  };
  await done;
}
export async function setPendingSignout(id: string | null) {
  const tx = db!.transaction("meta", "readwrite");
  tx.objectStore("meta").put(id, "pendingSignout");
  await complete(tx);
}
export function pendingSignout(): Promise<string | undefined> {
  return request(
    db!.transaction("meta").objectStore("meta").get("pendingSignout"),
  );
}
