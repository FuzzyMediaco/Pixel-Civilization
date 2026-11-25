import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, Cloud, Copy, Eye, Globe2, Hammer, History, Link2, MapPin, Mountain, Move, RotateCw, TrainFront, Trash2, Undo2, UserPlus, Users, Wrench, X } from "lucide-react";
import { CATEGORY_META, ELEMENTS, ELEMENT_BY_ID, getMaxElementLevel } from "../game/catalog";
import { eligibleDepots, eligibleStops, modeNames, type TravelMode } from "../game/mobility";
import { maintenanceStatus, type GameState } from "../game/simulation";
import { SCULPT_TOOLS, type SharedTool } from "../game/sharedIsland";
import { MODE_NAMES, sharedError, sharedRequest } from "../game/sharedClient";
import { useSharedIsland } from "../game/useSharedIsland";
import { PixelWorldRenderer, type BuildBrush, type PendingNetworkStroke } from "../game/worldRenderer";
import { type GridPoint, type InfrastructureTool } from "../game/terrain";
import { ElementFavicon } from "./ElementFavicon";
import { GameDialog } from "./GameDialog";
import { IslandMapFallback } from "./IslandMapFallback";
import "./sharedIslands.css";

const emptyBrush: BuildBrush = { kind:"none", rotation:0, level:1, variantMode:-1 };
const tools = [ ["build", "Build", Hammer], ["sculpt", "Sculpt", Mountain], ["transit", "Transit", TrainFront], ["activity", "History", History] ] as const;
type Shelf = typeof tools[number][0] | "people" | "selection" | null;
const noProjection = () => {};
const modeTitle = (mode: string) => mode[0].toUpperCase() + mode.slice(1);

export default function SharedIslandView({ id, token }: { id: string; token: string | null }) {
  const [profile, setProfile] = useState("");
  const [admitted, setAdmitted] = useState(!token);
  if (!admitted) return <main className="shared-entry">
    <form className="shared-lobby-card" onSubmit={e => {e.preventDefault();setAdmitted(true);}}>
      <span className="shared-mark"><Users size={23} /></span>
      <h1>Join a shared island</h1>
      <label>Display name <small>Optional</small><input value={profile} maxLength={22} onChange={e => setProfile(e.target.value)} placeholder="Name other builders will see" /></label>
      <div className="shared-actions"><button type="submit" className="shared-primary">Join island</button><a href="#">Back to my island</a></div>
    </form>
  </main>;
  return <SharedGame id={id} token={token} profile={profile} />;
}

function SharedGame({ id, token, profile }: { id: string; token: string | null; profile: string }) {
  const session = useSharedIsland(id, token, profile);
  const { room, snapshot, online, status, notice, pending, cursors } = session;
  const world = snapshot?.world;
  const [shelf, setShelf] = useState<Shelf>("people");
  const [invite, setInvite] = useState(false);
  const [brush, setBrush] = useState<BuildBrush>(emptyBrush);
  const [sculpt, setSculpt] = useState<InfrastructureTool | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stroke, setStroke] = useState<PendingNetworkStroke | null>(null);
  const [map2d, setMap2d] = useState(false);
  const [focus, setFocus] = useState<[number, number]>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<PixelWorldRenderer | null>(null);
  const markers = useRef(new Map<string, HTMLSpanElement>());
  const canEdit = status === "live" && !!room && room.role !== "visitor";
  const ready = Boolean(world);
  const state = useRef({ session, world, brush, sculpt, canEdit, shelf });
  state.current = { session, world, brush, sculpt, canEdit, shelf };
  const picked = world?.elements.find(e => e.id === selected);
  const format = new Intl.NumberFormat("en", { notation:"compact", maximumFractionDigits:1 });

  function handlePoints(points: GridPoint[]) {
    const { session, brush, sculpt, canEdit } = state.current;
    if (!canEdit || !points.length || session.pending) return;
    if (sculpt) {
      session.edit({ kind:"sculpt", tool:sculpt.kind as SharedTool, points:points.slice(0, 64), radius:sculpt.voxelRadius ?? 0 });
    } else if (brush.kind === "move" && brush.movingElementId) {
      session.edit({ kind:"move", id:brush.movingElementId, gx:points[0].gx, gz:points[0].gz });
      setBrush(emptyBrush);
    } else if (brush.kind === "place" && brush.defId) {
      session.edit({ kind:"place", defId:brush.defId, points, level:brush.level, rotation:brush.rotation });
      if (!ELEMENT_BY_ID[brush.defId]?.isNetwork) setBrush(emptyBrush);
    }
  }

  function select(elementId: string | null) {
    setSelected(elementId);
    setShelf(current => elementId ? "selection" : current === "selection" ? null : current);
  }

  useEffect(() => {
    if (!canvas.current || !state.current.world) return;
    let engine: PixelWorldRenderer;
    try {
      engine = new PixelWorldRenderer(canvas.current, state.current.world, {
        onTilePlace: (gx, gz) => handlePoints([{ gx, gz }]),
        onPendingNetworkStroke: setStroke,
        onCancelPendingStroke: () => setStroke(null),
        onTileMoveCommit: (_id, gx, gz) => handlePoints([{ gx, gz }]),
        onInfrastructureStroke: (_tool, points) => handlePoints(points),
        onSelectElement: select,
        onEmptyTileTap: () => select(null),
        onGridPointer: (gx, gz) => state.current.session.cursor(gx, gz),
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("WebGL context")) throw error;
      setMap2d(true);
      return;
    }
    renderer.current = engine;
    const view = state.current.world.elements.find(e => !ELEMENT_BY_ID[e.defId]?.isNetwork);
    if (view) engine.focusGrid(view.gx, view.gz, 85);
    let frame = 0;
    const track = () => {
      for (const [user, node] of markers.current) {
        const point = cursors.current.get(user);
        const p = point && Date.now() - point.at < 6000 && engine.projectGrid(point.gx, point.gz);
        node.hidden = !p || !p.visible;
        if (p && p.visible) node.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
      }
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => { cancelAnimationFrame(frame); renderer.current = null; engine.dispose(); };
  }, [ready, cursors]);

  useEffect(() => {
    if (world) renderer.current?.syncState(world, picked ? [picked.id] : []);
  }, [world, picked]);
  useEffect(() => {
    renderer.current?.setBrush(canEdit ? brush : emptyBrush);
    renderer.current?.setInfrastructureTool(canEdit ? sculpt : null);
  }, [canEdit, brush, sculpt]);
  useEffect(() => {
    renderer.current?.setPendingNetworkStroke(stroke);
  }, [stroke]);
  useEffect(() => {
    if (canEdit) return;
    setBrush(emptyBrush);
    setSculpt(null);
    setStroke(null);
  }, [canEdit]);

  function openShelf(next: Shelf) {
    setShelf(shelf === next ? null : next);
    setBrush(emptyBrush);
    setSculpt(null);
    setStroke(null);
  }

  if (!world || !room) return <main className="shared-entry"><section className="shared-lobby-card">
    <span className="shared-mark"><Globe2 size={22} /></span>
    <h1>{status === "closed" ? "Island unavailable" : "Opening shared island…"}</h1>
    {notice && <p className="shared-notice is-error" role="alert">{notice}</p>}
    <a href="#">Back to my island</a>
  </section></main>;

  const def = picked && ELEMENT_BY_ID[picked.defId];
  const toolLabel = sculpt ? modeTitle(sculpt.kind) : brush.kind === "move" ? "Move element" : brush.defId ? ELEMENT_BY_ID[brush.defId]?.name : "";
  const peerList = room.members.filter(member => member.id !== room.self && online.includes(member.id));

  return <main className="island-app shared-game">
    {map2d ? <IslandMapFallback state={world} focus={focus} draw={!!toolLabel && canEdit} onStopFollowing={() => {}} heatmap="none"
      onStroke={handlePoints} onTap={() => false} onRingProjection={noProjection} onInspect={point => {
        session.cursor(point.gx, point.gz);
        select(world.elements.find(el => point.gx >= el.gx && point.gx < el.gx + el.spanX && point.gz >= el.gz && point.gz < el.gz + el.spanZ)?.id ?? null);
      }} /> : <canvas ref={canvas} aria-label="Shared island 3D map" />}
    {peerList.map(member => <span className="shared-cursor" hidden key={member.id} ref={node => {
      if (node) markers.current.set(member.id, node); else markers.current.delete(member.id);
    }} style={{ "--peer-color": member.color } as React.CSSProperties}><MapPin size={16} /> {member.name}</span>)}
    <div className="shared-top">
      <a className="shared-icon" href="#" aria-label="Leave shared island" title="Back to personal island"><ArrowLeft size={19} /></a>
      <section className="shared-title">
        <div><h1>{room.name}</h1><span>{MODE_NAMES[room.mode]} mode · {room.role}</span></div>
        <p className={"shared-live is-" + status}><i />{status === "live" ? "Live" : status === "closed" ? "Disconnected" : "Reconnecting"}</p>
      </section>
      <button type="button" className="shared-crew" aria-label="Players" onClick={() => openShelf("people")}><Users size={18} /><b>{online.length}/{room.members.length}</b></button>
    </div>
    <div className="shared-metrics" aria-label="Shared city stats">
      <span><b>{format.format(world.population)}</b> population</span>
      <span><b>{Math.round(world.happiness)}%</b> happiness</span>
      <span><b>{room.mode === "god" ? "Free" : "$" + format.format(world.money)}</b> treasury</span>
      {room.role === "owner" && <label>Speed <select aria-label="Simulation speed" disabled={!canEdit || pending} value={world.playSpeed ?? 1} onChange={e => session.edit({ kind: "speed", value: Number(e.target.value) })}>
        <option value={0}>Paused</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
      </select></label>}
    </div>
    <div className="shared-dock">
      {status === "closed" && <div className="shared-tool-note" role="alert">{notice} <a href="#">Exit island</a></div>}
      {status !== "closed" && notice && <div className="shared-tool-note" role="status">{notice}</div>}
      {stroke && <div className="shared-tool-note"><span>{stroke.points.length} tiles ready</span>
        <button type="button" disabled={pending || !canEdit} onClick={() => {handlePoints(stroke.points);setStroke(null);}}><Check size={16} /> Build route</button>
        <button type="button" onClick={() => setStroke(null)}>Cancel</button></div>}
      {!!toolLabel && !stroke && <div className="shared-tool-note">
        <span>{toolLabel} · {sculpt ? "Drag along terrain" : brush.kind === "move" ? "Tap destination" : "Tap the map"}</span>
        <button type="button" onClick={() => {setBrush(emptyBrush);setSculpt(null);}}>Done</button>
      </div>}
      {shelf && <section className="shared-panel" aria-label={shelf === "selection" ? "Element actions" : shelf}>
        <header className="shared-panel-head">
          <div><h2>{shelf === "people" ? "Island crew" : shelf === "selection" ? def?.name ?? "Element" : modeTitle(shelf)}</h2>
            {shelf === "people" && <p>{online.length} online · {room.members.length} of 4 seats</p>}
            {shelf === "selection" && picked && <p>Level {picked.level} · {picked.gx}, {picked.gz}</p>}
          </div>
          <button type="button" className="shared-icon" aria-label="Close panel" onClick={() => setShelf(null)}><ChevronDown size={19} /></button>
        </header>
        <div className="shared-panel-body">
          {shelf === "people" && <>
            <ul className="shared-members">
              {room.members.map(member => <li key={member.id}>
                <span className="shared-avatar" style={{ backgroundColor: member.color }}>{member.name.slice(0, 1).toUpperCase()}</span>
                <span><b>{member.name}{member.id === room.self ? " (you)" : ""}</b><small>{online.includes(member.id) ? "Online" : "Offline"}</small></span>
                <span className="shared-role">{modeTitle(member.role)}</span>
              </li>)}
            </ul>
            {room.role === "owner" ? <button type="button" className="shared-primary" onClick={() => setInvite(true)}><UserPlus size={17} /> Invite &amp; manage access</button>
            : <p className="shared-foot"><Eye size={15} />{room.role === "visitor" ? "Visiting with view-only access" : "Building with the island crew"}</p>}
            <a className="shared-download" href={"/api/shared/rooms/" + id + "/export"} download={room.name + ".json"}><Cloud size={15} /> Export island backup</a>
          </>}
          {shelf === "build" && <SharedBuild disabled={!canEdit || pending} onPick={(defId, level) => {
            setBrush({ ...emptyBrush, kind:"place", defId, level });
            setSculpt(null); setShelf(null);
          }} mode={room.mode} />}
          {shelf === "sculpt" && <>
            <p>Choose a tool, then drag it across the map.</p>
            <div className="shared-options">{SCULPT_TOOLS.map(tool => <button type="button" key={tool} disabled={!canEdit || pending}
              onClick={() => {
                setSculpt({ kind:tool, radius:1, voxelRadius:3, precision: ["bridge","river","mountain","valley","canyon"].includes(tool) ? "tile" : "voxel" });
                setBrush(emptyBrush);setShelf(null);
              }}><Mountain size={16} /> {modeTitle(tool)}</button>)}</div>
          </>}
          {shelf === "transit" && <SharedTransit world={world} disabled={!canEdit || pending} start={(mode, depot, stops) => session.edit({ kind:"transit", mode, depot, stops })} />}
          {shelf === "activity" && <>
            {snapshot.history.length === 0 ? <p>Island edits will show here as the crew builds.</p> :
              <ol className="shared-feed">{[...snapshot.history].reverse().map((event, index) =>
                <li key={event.at + ":" + index}><History size={15} /><span><b>{event.label}</b><small>{event.by} · {new Date(event.at).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" })}</small></span></li>)}</ol>}
            <button type="button" disabled={!canEdit || pending || snapshot.undoActor !== room.self} onClick={() => session.edit({ kind:"undo" })}><Undo2 size={16} /> Undo last build edit</button>
          </>}
          {shelf === "selection" && picked && def && <div className="shared-actions">
            <button disabled={!canEdit || pending || picked.level >= getMaxElementLevel(def.id)} onClick={() => session.edit({ kind:"upgrade", id:picked.id })}><ArrowUp size={15} /> Upgrade</button>
            <button disabled={!canEdit || pending} onClick={() => {setBrush({ ...emptyBrush, kind:"move", movingElementId:picked.id });setShelf(null);}}><Move size={15} /> Move</button>
            <button disabled={!canEdit || pending || def.isNetwork} onClick={() => session.edit({ kind:"rotate", id:picked.id })}><RotateCw size={15} /> Rotate</button>
            <button disabled={!canEdit || pending || ["none","healthy"].includes(maintenanceStatus(world,picked))} onClick={() => session.edit({ kind:"maintain", id:picked.id })}><Wrench size={15} /> Repair</button>
            <button disabled={!canEdit || pending} className="shared-danger" onClick={() => session.edit({ kind:"demolish", id:picked.id })}><Trash2 size={15} /> Demolish</button>
          </div>}
        </div>
      </section>}
      <nav className="shared-toolbar" aria-label="Shared island tools">
        {tools.map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={shelf === key} onClick={() => openShelf(key)}><Icon size={19} />{label}</button>)}
      </nav>
    </div>
    {invite && <InvitePanel room={room} onClose={() => setInvite(false)} />}
  </main>;
}

function SharedBuild({ disabled, mode, onPick }: {
  disabled: boolean; mode: GameState["mode"]; onPick: (id: string, level: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState(1);
  const matches = useMemo(() => ELEMENTS.filter(def => !def.id.startsWith("custom_") &&
    (!category || def.category === category) && def.name.toLowerCase().includes(search.toLowerCase().trim())), [category, search]);
  const [limit, setLimit] = useState(36);
  return <>
    <div className="shared-fields">
      <label>Search elements<input value={search} onChange={e => {setSearch(e.target.value);setLimit(36);}} placeholder="Roads, houses, wells…" /></label>
      <label>Category<select value={category} onChange={e => {setCategory(e.target.value);setLimit(36);}}>
        <option value="">All elements</option>{CATEGORY_META.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
      </select></label>
      {mode === "god" && <label>Starting level<input type="number" min={1} max={10} value={level} onChange={e => setLevel(Math.max(1, Math.min(10, Number(e.target.value))))} /></label>}
    </div>
    <div className="shared-elements">
      {matches.slice(0,limit).map(def => <button type="button" key={def.id} disabled={disabled} onClick={() => onPick(def.id, level)}><ElementFavicon def={def} /><b>{def.name}</b></button>)}
    </div>
    {matches.length === 0 && <p>No elements match that search.</p>}
    {matches.length > limit && <button type="button" onClick={() => setLimit(limit + 36)}>Show more elements</button>}
  </>;
}

function SharedTransit({ world, disabled, start }: { world:GameState; disabled:boolean; start:(mode:TravelMode, depot:string, stops:string[])=>void }) {
  const [mode, setMode] = useState<TravelMode>("bus");
  const [depotId, setDepotId] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const depots = eligibleDepots(world,mode);
  const depot = depots.some(d => d.id === depotId) ? depotId : depots[0]?.id ?? "";
  const available = eligibleStops(world,mode).filter(stop => stop.id !== depot);
  return <div className="shared-stack">
    <p>{world.mobility?.lines.filter(line=>line.enabled).length ?? 0} running services · {Math.round(world.metrics.transitShare ?? 0)}% of commutes</p>
    <div className="shared-fields">
      <label>Service<select value={mode} onChange={e => {setMode(e.target.value as TravelMode);setDepotId("");setStops([]);}}>
        {Object.entries(modeNames).map(([key,name]) => <option value={key} key={key}>{name}</option>)}
      </select></label>
      <label>Departure<select value={depot} onChange={e => {setDepotId(e.target.value);setStops([]);}}>
        {!depot && <option value="">Place a compatible depot</option>}
        {depots.map(el => <option value={el.id} key={el.id}>{ELEMENT_BY_ID[el.defId].name} at {el.gx}, {el.gz}</option>)}
      </select></label>
    </div>
    <p>{stops.length ? `${stops.length} stops selected in travel order` : "Choose stops in travel order or use reachable stops."}</p>
    {depot && <div className="shared-options">
      {available.map(el => <button type="button" key={el.id} aria-pressed={stops.includes(el.id)} onClick={() => setStops(items => items.includes(el.id) ? items.filter(s => s !== el.id) : [...items, el.id])}>
        {stops.includes(el.id) ? (stops.indexOf(el.id) + 1) + ". " : ""}{ELEMENT_BY_ID[el.defId].name} · {el.gx}, {el.gz}
      </button>)}
    </div>}
    <button type="button" className="shared-primary" disabled={disabled || !depot || (stops.length === 1)} onClick={() => start(mode,depot,stops)}>
      <TrainFront size={16} />{stops.length ? "Start service" : "Start with suggested stops"}
    </button>
  </div>;
}

function InvitePanel({ room, onClose }: { room: NonNullable<ReturnType<typeof useSharedIsland>["room"]>; onClose: () => void }) {
  const [role, setRole] = useState<"builder"|"visitor">("builder");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = "rooms/" + room.id + "/";
  async function perform(fn: () => Promise<void>) {
    setBusy(true);setError("");
    try { await fn(); } catch (e) {setError(sharedError(e));}
    finally { setBusy(false); }
  }
  return (
    <GameDialog label="Invite players" className="shared-lobby" onDismiss={onClose}>
      <section className="shared-lobby-card">
        <header className="shared-lobby-head"><span className="shared-mark"><UserPlus size={23} /></span><div><h1>Invite players</h1><p>{room.name} · {room.members.length} of 4 seats</p></div>
          <button type="button" className="shared-icon" onClick={onClose} aria-label="Close invites"><X size={20} /></button></header>
        <label>Invite as<select value={role} onChange={e => {setRole(e.target.value as "builder"|"visitor");setLink("");setCopied(false);}}>
          <option value="builder">Builder · Can build and edit</option><option value="visitor">Visitor · Can explore</option>
        </select></label>
        <button type="button" className="shared-primary" disabled={busy || room.members.length >= 4} onClick={() => void perform(async () => {
          const { token } = await sharedRequest<{ token:string }>(path + "invite", { role });
          setCopied(false);
          setLink(location.origin + "/#island=" + room.id + "&invite=" + token);
        })}><Link2 size={16} /> Generate invite link</button>
        {link && <label>One-use link<input readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>}
        {link && <button type="button" onClick={() => void perform(async () => {await navigator.clipboard.writeText(link);setCopied(true);})}><Copy size={16} /> {copied ? "Copied" : "Copy link"}</button>}
        <p className="shared-foot">Links expire in 48 hours. Generating a new link replaces the previous link for that role.</p>
        <label className="shared-switch"><input type="checkbox" checked={room.away} disabled={busy} onChange={e => {
          const away = e.target.checked;
          void perform(async () => {await sharedRequest(path + "member", { away });});
        }} /><span><b>Keep running when empty</b><small>Continue for up to five minutes after the last player leaves.</small></span></label>
        {room.members.filter(member => member.role !== "owner").map(member => <label key={member.id}>{member.name}
          <select value={member.role} disabled={busy} onChange={e => {
            const next = e.target.value;
            if (next === "remove" && !confirm("Remove " + member.name + " from this island?")) return;
            void perform(async () => {await sharedRequest(path + "member", { user: member.id, role: next });});
          }}><option value="builder">Builder</option><option value="visitor">Visitor</option><option value="remove">Remove access</option></select>
        </label>)}
        {error && <p className="shared-notice is-error" role="alert">{error}</p>}
      </section>
    </GameDialog>
  );
}
