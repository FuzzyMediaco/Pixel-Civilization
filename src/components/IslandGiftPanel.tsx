import { useEffect, useRef, useState } from "react";
import { findGiftIslands, giftAccess, sendIslandGift, type GiftRecipient } from "../game/accountSync";
import { newIslandId } from "../game/islandGifts.mjs";

export function IslandGiftPanel({ issuer }: { issuer: string }) {
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [recipient, setRecipient] = useState<GiftRecipient>();
  const [key, setKey] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const pending = useRef<{ intent: string; id: string } | null>(null);
  const storageKey = "pixel.island-gift.pending." + issuer;
  const island = recipient?.islands.find(item => item.key === key);

  useEffect(() => {
    let active = true;
    const refresh = () => { void giftAccess(issuer).then(result => {
      if (active) setAllowed(result.canGive);
    }).catch(() => { if (active) setAllowed(false); }); };
    refresh();
    window.addEventListener("online", refresh);
    return () => { active = false; window.removeEventListener("online",refresh); };
  }, [issuer]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : "Try again."); }
    finally { locked.current = false; setBusy(false); }
  }

  async function lookup() {
    setRecipient(undefined); setKey("");
    const found = await findGiftIslands(issuer, email);
    setRecipient(found);
    setKey(found.islands.find(item => item.active)?.key ?? (found.islands.length === 1 ? found.islands[0].key : ""));
    if (!found.islands.length) setNotice("This player has no synced islands yet.");
  }

  async function give() {
    const dollars = Number(amount);
    if (!recipient || !island || !Number.isSafeInteger(dollars) || dollars < 1) return;
    const intent = JSON.stringify([recipient.recipientId, island.key, island.islandId, dollars]);
    try { pending.current ??= JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); } catch { /* Memory still covers retries. */ }
    if (pending.current?.intent !== intent) pending.current = { intent, id: newIslandId() };
    try { sessionStorage.setItem(storageKey, JSON.stringify(pending.current)); } catch { /* Private browsing. */ }
    const receipt = await sendIslandGift(issuer, recipient.recipientId, island, dollars, pending.current.id);
    pending.current = null;
    try { sessionStorage.removeItem(storageKey); } catch { /* Private browsing. */ }
    setAmount("");
    setNotice("$" + receipt.amount.toLocaleString() + " added to " + island.name + ".");
  }

  if (!allowed) return null;
  return <details className="island-gifts">
    <summary>Give island funds</summary>
    <p>Add in-game money to a player's island treasury.</p>
    <form className="player-auth" onSubmit={event => { event.preventDefault(); void run(lookup); }}>
      <label>Player email<input type="email" required maxLength={254} autoComplete="off" value={email} disabled={busy}
        onChange={event => { setEmail(event.target.value); setRecipient(undefined); setKey(""); setNotice(""); setError(""); }} /></label>
      <button className="ui-btn" disabled={busy || !email.trim()}>Find islands</button>
    </form>
    {!!recipient?.islands.length && <form className="player-auth" onSubmit={event => { event.preventDefault(); void run(give); }}>
      <label>Island<select className="ui-select" required value={key} disabled={busy} onChange={event => { setKey(event.target.value); setNotice(""); }}>
        <option value="" disabled>Choose an island</option>
        {recipient.islands.map(item => <option key={item.key} value={item.key}>{item.name} · {item.mode}{item.active ? " · Active" : ""}</option>)}
      </select></label>
      <label>Amount in game dollars<input type="number" inputMode="numeric" min={1} step={1} required value={amount} disabled={busy}
        onChange={event => { setAmount(event.target.value); setNotice(""); }} /></label>
      <button className="ui-btn is-primary" disabled={busy || !island || !Number.isSafeInteger(Number(amount)) || Number(amount) < 1}>
        {busy ? "Sending…" : Number(amount) > 0 ? "Give $" + Number(amount).toLocaleString() : "Give funds"}
      </button>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
