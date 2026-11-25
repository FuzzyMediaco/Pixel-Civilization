import {
  acceptCloud,
  acknowledgeUpload,
  backupCloudCopy,
  copyGuestIslands,
  currentPlayer,
  deviceReady,
  flushDevice,
  freezeWrites,
  isPlayerKey,
  readRecords,
  rememberPlayer,
  reopenSavedIsland,
  pendingSignout,
  setPendingSignout,
  type Player,
  type SaveRecord,
} from "./deviceSaves";

type CloudSave = {
  key: string;
  version: number;
  updatedAt?: number;
  deleted?: boolean;
};
type SyncState = {
  message: string;
  busy: boolean;
  conflicts: string[];
  updates: boolean;
  lastSync: number;
};
let state: SyncState = {
  message: "",
  busy: false,
  conflicts: [],
  updates: false,
  lastSync: 0,
};
const watchers = new Set<() => void>();
const update = (value: Partial<SyncState>) => {
  state = { ...state, ...value };
  for (const fn of watchers) fn();
};
export const syncState = () => state;
export function watchSync(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}
export const cloudAvailable = () =>
  deviceReady() && /^https?:$/.test(location.protocol) && location.hostname !== "pixel-civilization-rome-preview.fuzzymedia.workers.dev";
class AccountError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
  who?: string,
  signal?: AbortSignal,
): Promise<T> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const response = await fetch("/api/account" + url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(who ? { "X-Game-Account": who } : {}),
    },
    body: payload,
    keepalive: url === "/saves" || (method === "PUT" && payload !== undefined &&
      payload.length < 48000 && new TextEncoder().encode(payload).length < 60000),
    signal: signal ?? AbortSignal.timeout(30000),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok || !value)
    throw new AccountError(
      value?.error ?? "Account service is unavailable.",
      value?.code ?? String(response.status),
    );
  return value;
}
function base64(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i += 16384)
    str += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(str);
}
export async function encodeSave(data: string): Promise<string> {
  if (data.length < 16000 || typeof CompressionStream === "undefined")
    return data;
  const zipped = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return (
    "pcgz1:" + base64(new Uint8Array(await new Response(zipped).arrayBuffer()))
  );
}
export async function decodeSave(value: string): Promise<string> {
  if (!value.startsWith("pcgz1:")) return value;
  const raw = atob(value.slice(6)),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const decoded = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(decoded).text();
}
const pathFor = (key: string) => "/saves/" + encodeURIComponent(key);
async function remote(who: string, meta: CloudSave, signal?: AbortSignal) {
  if (meta.deleted) return { version: meta.version, data: "null" };
  const v = await api<CloudSave & { data: string | null }>(
    pathFor(meta.key),
    "GET",
    undefined,
    who,
    signal,
  );
  return {
    version: v.version,
    data: v.data === null ? "null" : await decodeSave(v.data),
  };
}
async function send(
  who: string,
  row: SaveRecord,
  baseVersion: number,
  signal?: AbortSignal,
) {
  const res = await api<CloudSave>(
    pathFor(row.key),
    "PUT",
    { baseVersion, data: await encodeSave(row.data) },
    who,
    signal,
  );
  await acknowledgeUpload(row, res.version);
}
let inFlight: Promise<void> | undefined;
async function reconcile(who: string, download: boolean, signal?: AbortSignal) {
  await flushDevice();
  const { saves } = await api<{ saves: CloudSave[] }>(
    "/saves",
    "GET",
    undefined,
    who,
    signal,
  );
  const local = new Map((await readRecords(who)).map((r) => [r.key, r]));
  const cloud = new Map(
    saves.filter((s) => isPlayerKey(s.key)).map((s) => [s.key, s]),
  );
  const conflicts: string[] = [];
  let updates = false;
  const keys = new Set([...cloud.keys(), ...local.keys()]);
  const resumeKey = "pixel_civ_last_mode";
  if (keys.delete(resumeKey)) keys.add(resumeKey);
  for (const key of keys) {
    const r = local.get(key),
      c = cloud.get(key);
    if (c && c.version !== (r?.version ?? 0)) {
      if (r?.dirty) {
        // A response might have been lost after a successful commit. Identical contents need no conflict dialog.
        const payload = await remote(who, c, signal);
        if (payload.data === r.data) {
          await acknowledgeUpload(r, payload.version);
          continue;
        }
        conflicts.push(key);
        continue;
      }
      // New named islands can appear in the saves list without replacing the active island
      // or any device save. Existing records continue through the explicit refresh flow.
      if (!download && (r || !key.startsWith("pixel_civ_slot_"))) {
        updates = true;
        continue;
      }
      const payload = await remote(who, c, signal);
      if (!(await acceptCloud(who, key, payload.version, payload.data, r?.rev)))
        updates = true;
      continue;
    }
    if (r?.dirty) {
      try {
        await send(who, r, r.version, signal);
      } catch (err) {
        if (err instanceof AccountError && err.code === "conflict") {
          conflicts.push(key);
          continue;
        }
        throw err;
      }
    }
  }
  update({
    conflicts,
    updates,
    lastSync: Date.now(),
    message: conflicts.length
      ? "Choose a version for the saves edited on two devices."
      : updates
        ? "Account updates are ready to open on this device."
        : "Account saves are up to date.",
  });
}
async function sync(who: string, download: boolean, signal?: AbortSignal) {
  if (inFlight) await inFlight;
  update({ busy: true });
  const work = reconcile(who, download, signal);
  inFlight = work;
  try {
    await work;
  } finally {
    if (inFlight === work) inFlight = undefined;
    update({ busy: false });
  }
}
function errorText(e: unknown) {
  if (
    e instanceof AccountError &&
    (e.code === "unauthorized" ||
      e.code === "401" ||
      e.code === "account_changed")
  )
    return "Sign in again to sync. Your local islands are available.";
  if (
    e instanceof TypeError ||
    (e instanceof DOMException &&
      ["TimeoutError", "AbortError"].includes(e.name))
  )
    return "Offline or unable to reach your account. Changes stay on this device.";
  return e instanceof Error
    ? e.message
    : "Could not sync. Changes stay on this device.";
}
async function finishSignout() {
  if (!cloudAvailable() || !navigator.onLine || currentPlayer()) return;
  const id = await pendingSignout();
  if (!id) return;
  try {
    await api("/logout", "POST", {}, id, AbortSignal.timeout(3000));
  } catch (e) {
    if (
      !(e instanceof AccountError) ||
      !["account_changed", "unauthorized", "401"].includes(e.code)
    )
      return;
  }
  await setPendingSignout(null);
}
export async function bootAccountSync(requireAccount = false): Promise<boolean> {
  const local = currentPlayer();
  if (!cloudAvailable()) return !requireAccount;
  await finishSignout();
  if (!navigator.onLine) return !requireAccount || Boolean(local);

  let user = local;
  if (requireAccount) {
    try {
      ({ user } = await api<{ user: Player | null }>("/me", "GET", undefined, undefined, AbortSignal.timeout(4500)));
    } catch (error) {
      update({ message: errorText(error) });
      return Boolean(local);
    }
    if (!user) return false;
    if (local?.id !== user.id) {
      // A browser may remember its cookie even after the device profile was cleared.
      // Do not start the simulation in the old profile while opening the signed-in one.
      await rememberPlayer(user);
      reopenSavedIsland();
      return false;
    }
  }
  if (user) {
    try {
      await sync(user.id, true, AbortSignal.timeout(12000));
    } catch (error) {
      update({ message: errorText(error) });
    }
  }
  return true;
}
let switchInProgress = false;
let scheduledSync: ReturnType<typeof setTimeout> | undefined;

export function scheduleAccountSync() {
  if (!currentPlayer() || scheduledSync !== undefined) return;
  scheduledSync = setTimeout(() => {
    scheduledSync = undefined;
    void autosync();
  }, 750);
}
export async function autosync() {
  await finishSignout();
  const user = currentPlayer();
  if (!user || !cloudAvailable() || switchInProgress) return;
  if (inFlight) {
    scheduleAccountSync();
    return;
  }
  clearTimeout(scheduledSync);
  scheduledSync = undefined;
  if (!navigator.onLine) {
    update({ message: "Offline. Changes stay on this device." });
    return;
  }
  try {
    await sync(user.id, false);
  } catch (e) {
    update({ message: errorText(e) });
  }
}
export async function signIn(
  email: string,
  password: string,
  creating: boolean,
  includeGuest: boolean,
) {
  if (!cloudAvailable())
    throw Error("Open the hosted or installed game online to sign in.");
  if (inFlight) await inFlight.catch(() => {});
  const { user } = await api<{ user: Player }>(
    creating ? "/register" : "/login",
    "POST",
    { email: email.trim(), password },
  );
  if (!user?.id) throw Error("Account response was incomplete.");
  switchInProgress = true;
  freezeWrites(true);
  try {
    await flushDevice();
    // Load existing account records before importing. A guest save never overwrites an account save.
    await sync(user.id, true);
    if (includeGuest && !currentPlayer()) {
      await copyGuestIslands(user.id);
      await sync(user.id, true);
    }
    await setPendingSignout(null);
    await rememberPlayer(user);
    reopenSavedIsland();
  } catch (e) {
    switchInProgress = false;
    freezeWrites(false);
    throw Error(errorText(e));
  }
}
export async function signOut() {
  const user = currentPlayer();
  if (!user) return;
  switchInProgress = true;
  freezeWrites(true);
  try {
    if (inFlight) await inFlight.catch(() => {});
    await flushDevice();
    // Give an online sign-out a final chance to send the last edits. Offline saves stay in this profile.
    if (navigator.onLine) {
      try {
        await sync(user.id, false, AbortSignal.timeout(6000));
      } catch {
        /* A device copy remains available on the next sign-in. */
      }
    }
    // Leave a pinned revocation request when offline. Guest mode cannot sync the former profile.
    try {
      if (navigator.onLine) await api("/logout", "POST", {}, user.id);
      else await setPendingSignout(user.id);
    } catch (e) {
      if (e instanceof TypeError || e instanceof DOMException)
        await setPendingSignout(user.id);
      else if (
        !(e instanceof AccountError) ||
        !["account_changed", "unauthorized", "401"].includes(e.code)
      )
        throw e;
    }
    await rememberPlayer(null);
    reopenSavedIsland();
  } catch (e) {
    switchInProgress = false;
    freezeWrites(false);
    throw Error(errorText(e));
  }
}
export async function openCloudChanges() {
  const user = currentPlayer();
  if (!user) return;
  switchInProgress = true;
  freezeWrites(true);
  try {
    await sync(user.id, true);
    reopenSavedIsland();
  } catch (e) {
    switchInProgress = false;
    freezeWrites(false);
    throw Error(errorText(e));
  }
}
export async function resolveSave(key: string, choice: "device" | "account") {
  const who = currentPlayer()?.id;
  if (!who) return;
  switchInProgress = true;
  freezeWrites(true);
  try {
    if (inFlight) await inFlight.catch(() => {});
    await flushDevice();
    const row = (await readRecords(who)).find((r) => r.key === key);
    const { saves } = await api<{ saves: CloudSave[] }>(
      "/saves",
      "GET",
      undefined,
      who,
    );
    const latest = saves.find((s) => s.key === key);
    if (!row || !latest)
      throw Error("The save changed. Sync again to see its current version.");
    const cloud = await remote(who, latest);
    if (choice === "account") {
      if (
        !(await acceptCloud(who, key, cloud.version, cloud.data, row.rev, true))
      )
        throw Error("The device save changed. Try again.");
    } else {
      await backupCloudCopy(who, key, cloud.data);
      await send(who, row, cloud.version);
    }
    reopenSavedIsland();
  } catch (e) {
    switchInProgress = false;
    freezeWrites(false);
    throw Error(errorText(e));
  }
}
export function saveLabel(key: string) {
  if (key.startsWith("pixel_civ_slot_"))
    return "Named island " + (Number(key.slice("pixel_civ_slot_".length)) + 1);
  if (key.startsWith("pixel_civ_save_v1_"))
    return (
      key
        .slice(18)
        .replace(/^example-/, "")
        .replaceAll("-", " ") + " island"
    );
  return key
    .replace(/^pixel_civ_/, "")
    .replace(/_v1$/, "")
    .replaceAll("_", " ");
}
