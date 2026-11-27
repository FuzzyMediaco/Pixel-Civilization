import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Coins, Gift, Search, Shapes } from "lucide-react";
import {
  autosync, directoryPage, giveReward, ownerDesigns, playerIslands, playerRewards,
  type DirectoryPlayer, type GiftRecipient, type PlayerRewards, type RewardKind,
} from "../game/accountSync";
import { newIslandId } from "../game/islandGifts.mjs";
import { productById, STORE_PRODUCTS } from "../game/storeCatalog.mjs";
import { fetchStoreAccess } from "../game/storeAccess";
import { IslandFundsForm } from "./IslandFundsForm";

const groups = [["mode","Game modes"],["era","Time periods"],["subscription","30-day Pix passes"]] as const;
const message = (err:unknown) => err instanceof Error ? err.message : "Could not load account controls.";
type Action = "funds" | RewardKind;

function Funds({issuer, player}: {issuer:string; player:string}) {
  const [recipient, setRecipient] = useState<GiftRecipient>(), [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void playerIslands(issuer, player).then(data => { if (active) setRecipient(data); })
      .catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [issuer,player,attempt]);
  if (error) return <><p role="alert">{error}</p><button className="ui-btn" onClick={() => retry(n => n+1)}>Retry islands</button></>;
  return recipient ? <IslandFundsForm issuer={issuer} recipient={recipient}/> : <p role="status">Finding islands…</p>;
}

function Rewards({issuer, player, kind}: {issuer:string; player:string; kind:RewardKind}) {
  const [info, setInfo] = useState<PlayerRewards>(), [designs, setDesigns] = useState<{id:string; name:string}[]>([]);
  const [item, setItem] = useState(""), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [attempt, retry] = useState(0);
  const lock = useRef(false);
  const pending = useRef({ item:"", requestId:"" });
  useEffect(() => {
    let active = true;
    setError(""); setInfo(undefined);
    const load = async () => {
      const [summary, library] = await Promise.all([playerRewards(issuer, player), kind === "design" ?
        ownerDesigns(issuer) : Promise.resolve({designs:[]})]);
      if (active) { setInfo(summary); setDesigns(library.designs); }
    };
    void load().catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [issuer,player,kind,attempt]);

  const hasGift = (id:string) => info?.rewards.some(r => r.kind === kind && r.itemId === id);
  const owned = (id:string) => Boolean(hasGift(id) || (kind === "product" && info?.owned.includes(id)));
  const sku = kind === "product" ? productById(item) : undefined;
  const label = sku?.label ?? designs.find(d => d.id === item)?.name;
  async function send() {
    if (lock.current || !info || !label || owned(item)) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    if (pending.current.item !== item) pending.current = { item, requestId:newIslandId() };
    try {
      const r = await giveReward(issuer,player,kind,item,pending.current.requestId);
      setNotice(r.alreadyGiven ? r.label + " is already on this account." : r.label + " given to " + info.player.email + ".");
      setInfo({ ...info, rewards:[...info.rewards, {kind, itemId:item, label:r.label, expiresAt:r.expiresAt}] });
      if (player === issuer) { void fetchStoreAccess(); if (kind === "design") void autosync(); }
      setItem("");
    } catch (err) { setError(message(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  const prior = info?.rewards.filter(r => r.kind === kind);
  return <div className="pc-owner-action player-auth">
    {!info ? !error && <p role="status">Loading gifts…</p> : <>
      {kind === "product" ? <label>Store item<select aria-label="Store item" className="ui-select" value={item} disabled={busy} onChange={e => {setItem(e.target.value); setNotice("");}}>
        <option value="">Choose an item</option>
        {groups.map(([type,title]) => <optgroup label={title} key={type}>{STORE_PRODUCTS.filter(p => p.kind === type).map(p =>
          <option key={p.id} value={p.id} disabled={owned(p.id)}>{p.label}{owned(p.id) ? " · Owned" : ""}</option>)}</optgroup>)}
      </select></label> : designs.length ? <label>Your saved Pix designs<select aria-label="Your saved Pix designs" className="ui-select" value={item} disabled={busy} onChange={e => {setItem(e.target.value); setNotice("");}}>
        <option value="">Choose a design</option>{designs.map(d => <option key={d.id} value={d.id} disabled={owned(d.id)}>{d.name}{owned(d.id) ? " · Given" : ""}</option>)}
      </select></label> : <p>Create a design in Pix Builder and sync your account to give it here.</p>}
      {item && <p>{kind === "design" ? "Appears in Build → Custom. Free to place on this player’s islands." :
        sku?.kind === "subscription" ? "Includes 30 days of Pix and the items in this tier. The pass ends automatically." :
        "Permanently unlocks this item on the player’s account."}</p>}
      {(kind === "product" || designs.length > 0) && <button className="ui-btn is-primary" onClick={() => void send()} disabled={busy || !label || owned(item)}>
        {busy ? "Giving…" : label ? "Give " + label : kind === "design" ? "Give custom element" : "Give store item"}
      </button>}
      {kind === "design" && !designs.length && <button className="ui-btn" onClick={async () => { await autosync(); retry(n => n+1); }}>Refresh designs</button>}
      {prior && prior.length > 0 && <details className="pc-owner-history"><summary>Gifts on this account ({prior.length})</summary>
        <ul>{prior.map(r => <li key={r.itemId}>{r.label}{r.expiresAt && " · Through " + new Date(r.expiresAt).toLocaleDateString()}</li>)}</ul>
      </details>}
    </>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {!info && error && <button className="ui-btn" onClick={() => retry(n => n+1)}>Retry gifts</button>}
  </div>;
}

function Directory({issuer, canGiveFunds}: {issuer:string; canGiveFunds:boolean}) {
  const [query, setQuery] = useState(""), [rows, setRows] = useState<DirectoryPlayer[]>([]);
  const [next, setNext] = useState<string | null>(null), [busy, setBusy] = useState(true);
  const [player, setPlayer] = useState<DirectoryPlayer>(), [action, setAction] = useState<Action>(canGiveFunds ? "funds" : "product");
  const [error, setError] = useState(""), [attempt, retry] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const serial = ++sequence.current;
    setBusy(true); setRows([]); setNext(null); setError("");
    const timer = window.setTimeout(() => {
      void directoryPage(issuer,query).then(page => {
        if (serial === sequence.current) { setRows(page.players); setNext(page.next); }
      }).catch(err => { if (serial === sequence.current) setError(message(err)); })
        .finally(() => { if (serial === sequence.current) setBusy(false); });
    }, query.trim() ? 180 : 0);
    return () => { clearTimeout(timer); ++sequence.current; };
  }, [issuer, query, attempt]);
  async function more() {
    if (busy || !next) return;
    const serial = sequence.current; setBusy(true); setError("");
    try {
      const page = await directoryPage(issuer, query, next);
      if (serial === sequence.current) { setRows(items => [...items,...page.players]); setNext(page.next); }
    } catch (err) { if (serial === sequence.current) setError(message(err)); }
    finally { if (serial === sequence.current) setBusy(false); }
  }
  if (player) return <div className="pc-owner-body">
    <button className="ui-btn pc-owner-back" onClick={() => setPlayer(undefined)}><ArrowLeft size={15}/>All players</button>
    <h4 className="pc-owner-email">{player.email}</h4>
    <div className="pc-owner-tabs" role="group" aria-label="Gift type">
      {canGiveFunds && <button className="ui-btn" aria-pressed={action === "funds"} onClick={() => setAction("funds")}><Coins size={17}/>Funds</button>}
      <button className="ui-btn" aria-pressed={action === "product"} onClick={() => setAction("product")}><Gift size={17}/>Store item</button>
      <button className="ui-btn" aria-pressed={action === "design"} onClick={() => setAction("design")}><Shapes size={17}/>Custom element</button>
    </div>
    {action === "funds" ? <Funds key={player.id} issuer={issuer} player={player.id}/> :
      <Rewards key={player.id+action} issuer={issuer} player={player.id} kind={action}/>}
  </div>;
  return <div className="pc-owner-body player-auth">
    <label>Find a player<span className="pc-owner-search"><Search size={16}/><input type="search" placeholder="Search email" autoComplete="off" maxLength={254}
      value={query} onChange={e => setQuery(e.target.value)}/></span></label>
    {!!rows.length && <ul className="pc-owner-list" aria-label="Players">{rows.map(row =>
      <li key={row.id}><button className="ui-btn" onClick={() => {setPlayer(row); setAction(canGiveFunds ? "funds" : "product");}}>
        <span>{row.email}</span><ChevronRight size={17}/></button></li>)}</ul>}
    {busy && <p role="status">Loading players…</p>}
    {!busy && !error && !rows.length && <p>No players match this search.</p>}
    {error && <><p role="alert">{error}</p>{!next && <button className="ui-btn" onClick={() => retry(n => n+1)}>Retry directory</button>}</>}
    {next && <button className="ui-btn" disabled={busy} onClick={() => void more()}>Show more players</button>}
  </div>;
}

export function AccountControls(props:{ issuer:string; canGiveFunds:boolean }) {
  const [open, setOpen] = useState(false);
  return <details className="island-gifts pc-owner" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>Player directory &amp; gifts</summary>
    {open && <Directory {...props}/>}
  </details>;
}
