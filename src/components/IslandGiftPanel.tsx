import { useEffect, useState } from "react";
import { findGiftIslands, giftAccess, type GiftRecipient } from "../game/accountSync";
import { IslandFundsForm } from "./IslandFundsForm";
import { AccountControls } from "./AccountControls";

export function IslandGiftPanel({ issuer }: { issuer:string }) {
  const [access, setAccess] = useState({ canGive:false, canManageAccounts:false });
  const [email, setEmail] = useState(""), [recipient, setRecipient] = useState<GiftRecipient>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => { void giftAccess(issuer).then(result => {
      if (active) setAccess({ canGive:result.canGive, canManageAccounts:!!result.canManageAccounts });
    }).catch(() => { if (active) setAccess({ canGive:false, canManageAccounts:false }); }); };
    refresh(); window.addEventListener("online", refresh);
    return () => { active = false; window.removeEventListener("online", refresh); };
  }, [issuer]);
  if (access.canManageAccounts) return <AccountControls issuer={issuer} canGiveFunds={access.canGive} />;
  if (!access.canGive) return null;
  return <details className="island-gifts">
    <summary>Give island funds</summary>
    <p>Add in-game money to a player's island treasury.</p>
    <form className="player-auth" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(""); setRecipient(undefined);
      try { setRecipient(await findGiftIslands(issuer,email)); }
      catch (err) { setError(err instanceof Error ? err.message : "Could not find islands."); }
      finally { setBusy(false); }
    }}>
      <label>Player email<input type="email" required maxLength={254} autoComplete="off" value={email} disabled={busy}
        onChange={e => { setEmail(e.target.value); setRecipient(undefined); setError(""); }} /></label>
      <button className="ui-btn" disabled={busy || !email.trim()}>Find islands</button>
    </form>
    {recipient && <IslandFundsForm issuer={issuer} recipient={recipient}/>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
