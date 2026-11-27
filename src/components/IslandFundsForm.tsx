import { useRef, useState } from "react";
import { sendIslandGift, type GiftRecipient } from "../game/accountSync";
import { newIslandId } from "../game/islandGifts.mjs";

export function IslandFundsForm({ issuer, recipient }: { issuer:string; recipient:GiftRecipient }) {
  const [key, setKey] = useState(recipient.islands.find(i => i.active)?.key ?? (recipient.islands.length === 1 ? recipient.islands[0].key : ""));
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const pending = useRef<{ intent:string; id:string } | null>(null);
  const storageKey = "pixel.island-gift.pending." + issuer;
  const island = recipient.islands.find(item => item.key === key);
  const dollars = Number(amount);
  const valid = Boolean(island && Number.isSafeInteger(dollars) && dollars > 0);
  async function give() {
    if (locked.current || !valid || !island) return;
    locked.current = true;
    setBusy(true); setNotice(""); setError("");
    try {
      const intent = JSON.stringify([recipient.recipientId, island.key, island.islandId, dollars]);
      try { pending.current ??= JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); } catch { /* A memory copy covers retries. */ }
      if (pending.current?.intent !== intent) pending.current = { intent, id:newIslandId() };
      try { sessionStorage.setItem(storageKey, JSON.stringify(pending.current)); } catch { /* Private browsing. */ }
      const receipt = await sendIslandGift(issuer, recipient.recipientId, island, dollars, pending.current.id);
      pending.current = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* Private browsing. */ }
      setAmount("");
      setNotice("$" + receipt.amount.toLocaleString() + " added to " + island.name + ".");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send funds."); }
    finally { locked.current = false; setBusy(false); }
  }
  if (!recipient.islands.length) return <p>This player has no synced islands yet.</p>;
  return <form className="player-auth" onSubmit={e => { e.preventDefault(); void give(); }}>
    <label>Island<select aria-label="Island" className="ui-select" required value={key} disabled={busy} onChange={e => { setKey(e.target.value); setNotice(""); }}>
      <option value="" disabled>Choose an island</option>
      {recipient.islands.map(i => <option key={i.key} value={i.key}>{i.name} · {i.mode}{i.active ? " · Active" : ""}</option>)}
    </select></label>
    <label>Amount in game dollars<input type="number" inputMode="numeric" min={1} step={1} required value={amount} disabled={busy}
      onChange={e => { setAmount(e.target.value); setNotice(""); }} /></label>
    <button className="ui-btn is-primary" disabled={busy || !valid}>{busy ? "Sending…" : valid ? "Give $" + dollars.toLocaleString() : "Give funds"}</button>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </form>;
}
