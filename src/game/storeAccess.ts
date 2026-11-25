import defaultLeaseKey from "./storeLeasePublic.json";
import { currentPlayer, onDeviceChange } from "./deviceSaves";
import type { StoreAccess } from "./storeCatalog.mjs";
export type { StoreAccess, StoreProduct } from "./storeCatalog.mjs";
export type StoreReceipt = {
  platform: "apple" | "google";
  productId: string;
  transactionId?: string;
  signedTransaction?: string;
  purchaseToken?: string;
};
type Verified = StoreAccess & { lease?: string | null };
const blank: StoreAccess = {
  accountId: null,
  owned: [],
  plan: null,
  providers: [],
  readyStores: [],
  validUntil: 0,
  usage: { messages: 0, spendMicros: 0, limit: 0, budgetMicros: 0, periodEnd: 0 },
};
const listeners = new Set<() => void>();
let current: StoreAccess = blank,
  knownUser: string | null = null;
let refreshing: Promise<StoreAccess> | undefined,
  generation = 0;
const notify = () => {
  for (const fn of listeners) fn();
};
const key = (id: string) => "pixel.store.lease.v1." + id;
function decode(input: string) {
  return Uint8Array.from(atob(input.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}
async function offline(id: string | null): Promise<StoreAccess | null> {
  if (!id) return null;
  try {
    const publicKey = import.meta.env.VITE_STORE_LEASE_PUBLIC_JWK;
    const token = localStorage.getItem(key(id));
    if (!token) return null;
    const [header, body, sig, ...extra] = token.split(".");
    if (!sig || extra.length || JSON.parse(new TextDecoder().decode(decode(header))).alg !== "ES256")
      return null;
    const leaseKey = await crypto.subtle.importKey(
      "jwk",
      publicKey ? JSON.parse(publicKey) : defaultLeaseKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      leaseKey,
      decode(sig),
      new TextEncoder().encode(header + "." + body),
    );
    if (!valid) return null;
    const grant = JSON.parse(new TextDecoder().decode(decode(body)));
    if (
      grant.aud !== "pixel-civilization-offline" ||
      grant.sub !== id ||
      grant.exp * 1000 <= Date.now() ||
      !Array.isArray(grant.owned)
    )
      return null;
    return { ...blank, accountId: id, owned: grant.owned, plan: grant.plan, validUntil: grant.exp * 1000 };
  } catch {
    return null;
  }
}
function put(snapshot: Verified, id: string | null) {
  if ((currentPlayer()?.id ?? null) !== id) return cachedStoreAccess();
  if (id && snapshot.accountId === id) {
    try {
      if (snapshot.lease) localStorage.setItem(key(id), snapshot.lease);
      else localStorage.removeItem(key(id));
    } catch {
      /* This browser may disable storage. Online access is still authoritative. */
    }
  } else if (id) {
    try {
      localStorage.removeItem(key(id));
    } catch {}
  }
  const { lease: _, ...access } = snapshot;
  current = access;
  notify();
  return current;
}
export function cachedStoreAccess(): StoreAccess {
  if (current.accountId !== null && current.accountId !== currentPlayer()?.id) return blank;
  return current;
}
export function subscribeStoreAccess(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
async function api<T>(path: string, body?: unknown, who = currentPlayer()?.id): Promise<T> {
  const response = await fetch("/api/commerce/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(who ? { "X-Game-Account": who } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(path === "access" ? 6000 : 30000),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok || !value)
    throw Object.assign(new Error(value?.error || "The game store is unavailable."), {
      status: response.status,
      code: value?.code,
    });
  return value;
}
export function fetchStoreAccess(): Promise<StoreAccess> {
  const id = currentPlayer()?.id ?? null;
  if (refreshing && knownUser === id) return refreshing;
  knownUser = id;
  const serial = ++generation;
  refreshing = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Offline");
      const access = await api<Verified>("access", undefined, id ?? undefined);
      if (serial !== generation) return cachedStoreAccess();
      return put(access, id);
    } catch (error) {
      if (serial !== generation) return cachedStoreAccess();
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 409) return put(blank, id);
      const lease = await offline(id);
      if (serial === generation && (currentPlayer()?.id ?? null) === id) {
        current = lease || (current.accountId === id && current.validUntil > Date.now() ? current : blank);
        notify();
      }
      return cachedStoreAccess();
    } finally {
      if (serial === generation) refreshing = undefined;
    }
  })();
  return refreshing;
}
onDeviceChange(() => {
  const id = currentPlayer()?.id ?? null;
  if (id !== knownUser) {
    knownUser = id;
    generation++;
    refreshing = undefined;
    current = blank;
    notify();
    void fetchStoreAccess();
  }
});
export async function confirmStorePurchase(receipt: StoreReceipt): Promise<StoreAccess> {
  const id = currentPlayer()?.id;
  if (!id) throw new Error("Sign in to restore purchases.");
  return put(await api<Verified>("purchase", receipt, id), id);
}
export async function startWebCheckout(productId: string): Promise<string> {
  return (await api<{ url: string }>("checkout", { productId })).url;
}
export async function stopPixRenewal(): Promise<StoreAccess> {
  const id = currentPlayer()?.id;
  if (!id) throw new Error("Sign in to manage your Pix plan.");
  return put(await api<Verified>("pix/cancel-renewal", {}, id), id);
}
export async function openBillingPortal(): Promise<string> {
  return (await api<{ url: string }>("portal", {})).url;
}
export async function finishWebCheckout(sessionId: string): Promise<StoreAccess> {
  const id = currentPlayer()?.id;
  if (!id) throw new Error("Sign in to the account that opened checkout.");
  return put(await api<Verified>("checkout/complete", { sessionId }, id), id);
}
