import { useMemo, useState } from "react";
import { GameDialog } from "./GameDialog";
import { ELEMENT_BY_ID, getUpgradeCost, getStandardFootprintForLevel } from "../game/catalog";
import {
  addLine,
  addTrainToLine,
  lineHeadway,
  lineKey,
  removeTrainFromLine,
  replanRailStops,
  stopCrowd,
  type Run,
} from "../game/mobility";
import { getTravelNetwork, type Point } from "../game/travelNetwork";
import { upgradeElementDirect, type GameState, type PlacedElement } from "../game/simulation";
import {
  CARS,
  CARGO,
  LOCOMOTIVES,
  YARD_WORKS,
  assignContract,
  changeFormation,
  defaultFormation,
  formationPrice,
  formationChangePrice,
  freightSites,
  freightAvailable,
  installYardWork,
  isRailStation,
  lineColor,
  platformLimit,
  railCapacity,
  railFreightBonus,
  renameStation,
  setTurnout,
  stationName,
  trainFor,
  yardCapacity,
  type Cargo,
  type Engine,
  type RailCar,
  type RailFormation,
  type RailService,
  type SwitchSetting,
  type YardWork,
} from "../game/railOperations";
import { vehicleLength } from "../game/railMovement";
import "./railOperations.css";

const tabs = ["Lines", "Fleet", "Freight", "Yard"] as const;
type Tab = (typeof tabs)[number];
const BODY: Record<string, string> = {
  steam: "#2a3133", diesel: "line", commuter: "#e9e4d6", electric: "#2f6f68", express: "#efeee6",
  coach: "#40624f", observation: "#8a4632", sleeper: "#2e4a68", hopper: "#a6814c", gondola: "#5e5955",
  reefer: "#e8e6d6", livestock: "#a5824f", waste: "#4f7a58", flat: "#8a6646", tanker: "#94b0b3",
  container: "#c96b44", box: "#a34e3c",
};
/** Side elevation of a consist: every vehicle at its real length, in its body colour, with the line stripe. */
function Consist({ f, colour, loads }: { f: RailFormation; colour: string; loads?: number[] }) {
  const models = [f.engine, ...f.cars];
  let x = 0;
  const parts = models.map((m, i) => {
    const w = vehicleLength(m) * 16;
    const body = BODY[m] === "line" ? colour : BODY[m] ?? "#777";
    const part = (
      <g key={i} transform={`translate(${x} 0)`}>
        <title>{m in LOCOMOTIVES ? LOCOMOTIVES[m as Engine].name : CARS[m as RailCar].name}</title>
        <rect x="0" y="2" width={w} height="7" rx="1" fill={body} stroke="#1d2427" strokeWidth=".5" />
        {i > 0 && CARS[m as RailCar]?.service === "passenger" && <rect x="0" y="6" width={w} height="1" fill={colour} />}
        {i > 0 && loads?.[i - 1] ? <rect x="1" y={9 - 6 * loads[i - 1]} width={w - 2} height={6 * loads[i - 1]} fill="#e1bf62" opacity=".85" /> : null}
        {i === 0 && m === "steam" && <rect x={w - 4} y="-1" width="2" height="3" fill="#1d2427" />}
        <circle cx="2.5" cy="10" r="1.3" fill="#121618" />
        <circle cx={w - 2.5} cy="10" r="1.3" fill="#121618" />
      </g>
    );
    x += w + 1;
    return part;
  });
  return (
    <svg className="rail-consist" viewBox={`-1 -2 ${x + 1} 14`} role="img" aria-label="Train formation">
      {parts}
    </svg>
  );
}
function short(name: string) {
  return name.replace(/ (Halt|Station|Central|Yard|Depot)$/, "");
}
type Props = {
  state: GameState;
  selected: PlacedElement;
  change: (fn: (s: GameState) => void) => void;
  onClose: () => void;
  onTrack: (e: PlacedElement) => void;
  onFocus: (e: PlacedElement) => void;
};
type Draft = { key?: string; depot: string; stops: string[]; f: RailFormation };
export function RailOperations({ state, selected, change, onClose, onTrack, onFocus }: Props) {
  const net = getTravelNetwork(state);
  const stations = state.elements.filter((e) => isRailStation(e.defId)),
    depots = stations.filter((e) => e.defId === "train_depots");
  const name = (e?: PlacedElement) => (e ? stationName(state, e) : "—");
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = sessionStorage.getItem("pixel-rail-tab2");
      return tabs.includes(t as Tab) ? (t as Tab) : "Lines";
    } catch {
      return "Lines";
    }
  });
  const go = (t: Tab) => {
    setTab(t);
    setDraft(undefined);
    setError("");
    try {
      sessionStorage.setItem("pixel-rail-tab2", t);
    } catch {}
  };
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const apply = (fn: (s: GameState) => void, ok: string) => {
    try {
      change(fn);
      setMessage(ok);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to apply the change.");
      setMessage("");
      return false;
    }
  };
  const rails = state.mobility?.lines.filter((l) => l.mode === "rail") ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const l of rails) map.set(lineKey(l), [...(map.get(lineKey(l)) ?? []), l]);
    return [...map.entries()];
  }, [rails]);
  const [draft, setDraft] = useState<Draft>();
  // Stations reachable by rail from a depot: only those can be put on its lines.
  const reachable = useMemo(() => {
    const cache = new Map<string, Set<string>>();
    return (depotId: string) => {
      const hit = cache.get(depotId);
      if (hit) return hit;
      const depot = net.byId.get(depotId),
        out = new Set<string>();
      const from: Point[] = depot ? net.connectors(depot, "rail") : [];
      if (from.length)
        for (const e of stations)
          if (e.id !== depotId && net.connectors(e, "rail").length && net.path(from, net.connectors(e, "rail"), "rail")) out.add(e.id);
      cache.set(depotId, out);
      return out;
    };
  }, [net, stations]);

  const startLine = (service: RailService) => {
    const depot = (selected.defId === "train_depots" ? selected : depots[0])?.id ?? "";
    setDraft({ depot, stops: [], f: { ...defaultFormation(service), name: service === "passenger" ? "New line" : "Goods line" } });
    setError("");
    setMessage("");
  };
  const editLine = (key: string) => {
    const lead = rails.find((l) => lineKey(l) === key);
    if (!lead) return;
    const f = trainFor(lead);
    setDraft({ key, depot: lead.depot, stops: [...lead.stops], f: { ...f, cars: [...f.cars] } });
    setError("");
    setMessage("");
  };
  const saveDraft = () => {
    if (!draft) return;
    if (!draft.key) {
      if (apply((s) => void addLine(s, "rail", draft.depot, draft.stops, { ...draft.f, cars: [...draft.f.cars] }), "Line opened — first train leaving the depot."))
        setDraft(undefined);
      return;
    }
    if (
      apply((s) => {
        const trains = s.mobility!.lines.filter((l) => lineKey(l) === draft.key);
        for (const t of trains) changeFormation(s, t.id, { ...draft.f, cars: [...draft.f.cars] });
        if (trains[0] && trains[0].stops.join() !== draft.stops.join()) replanRailStops(s, trains[0], draft.stops);
      }, "Line updated.")
    )
      setDraft(undefined);
  };

  /* ------------------------------------------------------------ line editor */
  const editor = draft && (() => {
    const service = draft.f.service;
    const depot = net.byId.get(draft.depot);
    const ok = reachable(draft.depot);
    const candidates = stations.filter((e) => e.defId === (service === "passenger" ? "train_stops" : "freight_rail_terminal") && ok.has(e.id));
    const set = (f: Partial<RailFormation>) => setDraft({ ...draft, f: { ...draft.f, ...f } });
    const trains = draft.key ? rails.filter((l) => lineKey(l) === draft.key) : [];
    const price = draft.key ? formationChangePrice(trainFor(trains[0]), draft.f) * Math.max(1, trains.length) : formationPrice(draft.f);
    const limit = Math.min(8, ...[depot, ...draft.stops.map((id) => net.byId.get(id))].filter(Boolean).map((e) => platformLimit(state, e!)));
    return (
      <section className="rail-editor" aria-label="Line editor">
        <input aria-label="Line name" maxLength={42} value={draft.f.name} onChange={(e) => set({ name: e.target.value })} />
        {depots.length > 1 && !draft.key && (
          <label>
            Depot
            <select value={draft.depot} onChange={(e) => setDraft({ ...draft, depot: e.target.value, stops: [] })}>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>
                  {name(d)}
                </option>
              ))}
            </select>
          </label>
        )}
        <h4>Tap stations in travel order</h4>
        {candidates.length < 2 ? (
          <p className="rail-hint">
            Only stations joined to {name(depot)} by track are listed. Build {service === "passenger" ? "two train stops" : "two freight terminals"} with track along their back edge.
          </p>
        ) : (
          <div className="rail-chips">
            {candidates.map((e) => {
              const n = draft.stops.indexOf(e.id);
              return (
                <button
                  key={e.id}
                  aria-pressed={n >= 0}
                  onClick={() =>
                    setDraft({ ...draft, stops: n >= 0 ? draft.stops.filter((id) => id !== e.id) : [...draft.stops, e.id] })
                  }
                >
                  {n >= 0 && <b>{n + 1}</b>}
                  {name(e)}
                </button>
              );
            })}
          </div>
        )}
        <div className="rail-seg" role="group" aria-label="Route shape">
          <button aria-pressed={draft.f.pattern === "circuit"} onClick={() => set({ pattern: "circuit" })}>
            ⟳ Loop
          </button>
          <button aria-pressed={draft.f.pattern === "shuttle"} onClick={() => set({ pattern: "shuttle" })}>
            ⇄ Back &amp; forth
          </button>
        </div>
        <h4>Train</h4>
        <div className="rail-engines">
          {(Object.entries(LOCOMOTIVES) as [Engine, (typeof LOCOMOTIVES)[Engine]][])
            .filter(([, e]) => service === "passenger" || e.freight)
            .map(([k, e]) => {
              const locked = (depot?.level ?? 1) < e.level && !(k === "electric" && state.railYard?.works?.[draft.depot]?.wire);
              return (
                <button key={k} aria-pressed={draft.f.engine === k} disabled={locked} onClick={() => set({ engine: k })} title={locked ? "Needs a level " + e.level + " depot" : e.name}>
                  <small>{e.era}</small>
                  {e.name}
                  {(k === "electric" || k === "express") && <em>needs Lv4+ wired track</em>}
                </button>
              );
            })}
        </div>
        <Consist f={draft.f} colour={draft.key ? lineColor({ id: draft.key }) : "#2f7fc1"} />
        <div className="rail-cars">
          {(Object.entries(CARS) as [RailCar, (typeof CARS)[RailCar]][])
            .filter(([, c]) => c.service === service)
            .map(([k, c]) => {
              const n = draft.f.cars.filter((x) => x === k).length;
              return (
                <div key={k}>
                  <span>
                    {c.name} <small>{c.capacity}</small>
                  </span>
                  <button aria-label={"Remove " + c.name} disabled={!n} onClick={() => { const i = draft.f.cars.lastIndexOf(k); set({ cars: draft.f.cars.filter((_, j) => j !== i) }); }}>
                    −
                  </button>
                  <b>{n}</b>
                  <button aria-label={"Add " + c.name} disabled={draft.f.cars.length >= limit} onClick={() => set({ cars: [...draft.f.cars, k] })}>
                    +
                  </button>
                </div>
              );
            })}
        </div>
        <p className="rail-hint">
          {draft.f.cars.length}/{limit} cars (shortest platform) · {railCapacity(draft.f)} {service === "passenger" ? "seats" : "cargo units"}
        </p>
        <details>
          <summary>Advanced</summary>
          <div className="rail-grid">
            <label>
              Layover at the ends (s)
              <input type="number" min="2" max="90" value={draft.f.frequency} onChange={(e) => set({ frequency: Number(e.target.value) })} />
            </label>
            <label>
              Hours
              <select value={draft.f.schedule} onChange={(e) => set({ schedule: e.target.value as RailFormation["schedule"] })}>
                <option value="all">All day</option>
                <option value="day">Daytime</option>
                <option value="night">Night</option>
              </select>
            </label>
            <label>
              Priority
              <select value={draft.f.priority} onChange={(e) => set({ priority: e.target.value as RailFormation["priority"] })}>
                <option value="normal">Normal</option>
                <option value="express">Express (wins ties)</option>
              </select>
            </label>
          </div>
        </details>
        <div className="rail-actions rail-sticky">
          <small>{state.mode === "god" ? "Free" : "$" + price}</small>
          <button onClick={() => setDraft(undefined)}>Cancel</button>
          <button className="rail-primary" disabled={draft.stops.length < 2} onClick={saveDraft}>
            {draft.key ? "Save line" : "Open line"}
          </button>
        </div>
      </section>
    );
  })();

  /* ------------------------------------------------------------ line cards */
  const card = ([key, trains]: [string, Run[]]) => {
    const lead = trains[0],
      f = trainFor(lead),
      colour = lineColor(lead);
    const stops = lead.stops.map((id) => net.byId.get(id)).filter((e): e is PlacedElement => !!e);
    const crowds = stops.map((e) => ({ e, ...stopCrowd(state, e.id) }));
    const worst = [...crowds].sort((a, b) => b.lost * 3 + b.waiting - (a.lost * 3 + a.waiting))[0];
    const headway = lineHeadway(state, key);
    const trouble = trains.find((t) => t.blocked) ?? trains.find((t) => t.rail?.ghost);
    const health = trouble
      ? trouble.status
      : f.service === "freight"
        ? f.contract
          ? CARGO[f.contract.type].name + " · " + trains.reduce((n, t) => n + (t.rail?.contract?.delivered ?? 0), 0) + " delivered"
          : "No cargo assigned — open Freight"
        : worst && worst.lost > 4
          ? `Busy: ${worst.lost} gave up at ${short(name(worst.e))} — add a train`
          : worst && worst.waiting > 0
            ? `${worst.waiting} waiting at ${short(name(worst.e))}`
            : "Running smoothly";
    return (
      <article key={key} className="rail-card" style={{ ["--line" as string]: colour }}>
        <header>
          <i aria-hidden />
          <strong>{f.name}</strong>
          <small>{f.service === "freight" ? "Freight" : "Passenger"}</small>
          <button onClick={() => editLine(key)}>Edit</button>
        </header>
        <ol className="rail-strip">
          {crowds.map(({ e, waiting }) => (
            <li key={e.id} title={name(e)}>
              <span>{short(name(e))}</span>
              {waiting > 0 && <em>{waiting}</em>}
            </li>
          ))}
          {trains.map((t, i) => {
            const at = t.at ? lead.stops.indexOf(t.at) : t.next - 0.5;
            const pos = t.at === t.depot ? -1 : Math.max(0, Math.min(stops.length - 1, at));
            return pos < 0 ? null : (
              <b key={t.id} className="rail-pill" style={{ left: `calc(${(pos / Math.max(1, stops.length - 1)) * 100}% - 7px)`, top: 2 + (i % 2) * 6 }} title={t.status} />
            );
          })}
        </ol>
        <footer>
          <div className="rail-count" role="group" aria-label="Trains on this line">
            <button aria-label="Remove a train" disabled={trains.length < 2} onClick={() => apply((s) => removeTrainFromLine(s, key), "Train retired to the depot.")}>
              −
            </button>
            <span>
              <b>{trains.length}</b> train{trains.length > 1 ? "s" : ""}
            </span>
            <button aria-label="Add a train" onClick={() => apply((s) => void addTrainToLine(s, key), "Another train joins the line.")}>
              +
            </button>
          </div>
          <span className="rail-headway">every ~{Math.max(1, Math.round(headway))}s</span>
          <button
            className="rail-ghost"
            onClick={() => apply((s) => s.mobility!.lines.filter((l) => lineKey(l) === key).forEach((l) => (l.enabled = !l.enabled)), lead.enabled ? "Line paused." : "Line resumed.")}
          >
            {lead.enabled ? "Pause" : "Resume"}
          </button>
        </footer>
        <p className={trouble ? "rail-health rail-bad" : health.startsWith("Busy") ? "rail-health rail-busy" : "rail-health"}>{health}</p>
      </article>
    );
  };

  /* ------------------------------------------------------------ fleet */
  const fleet = (
    <>
      {rails.length === 0 && <p className="rail-hint">No trains yet. Open a line first.</p>}
      {rails.map((l) => {
        const f = trainFor(l);
        const load = f.service === "passenger" ? l.riders.reduce((n, r) => n + r.count, 0) / Math.max(1, railCapacity(f)) : (f.contract?.loaded ?? 0) / Math.max(1, railCapacity(f));
        return (
          <article key={l.id} className="rail-train" style={{ ["--line" as string]: lineColor(l) }}>
            <header>
              <i aria-hidden />
              <strong>{f.name}</strong>
              <small>{f.trainId}</small>
            </header>
            <Consist f={f} colour={lineColor(l)} loads={f.service === "freight" ? undefined : undefined} />
            <p>
              {l.status}
              {(f.speed ?? 0) > 0.05 ? ` · ${Math.round((f.speed ?? 0) * 40)} km/h` : ""}
            </p>
            <meter min={0} max={1} value={load} aria-label="Load" />
          </article>
        );
      })}
      {depots.map((d) => (
        <p key={d.id} className="rail-hint">
          {name(d)}: {rails.filter((l) => l.depot === d.id).length}/{yardCapacity(state, d)} berths used · {rails.filter((l) => l.depot === d.id && l.at === d.id && !l.rail?.trail.length).length} parked
        </p>
      ))}
    </>
  );

  /* ------------------------------------------------------------ freight */
  const [cargoPick, setCargoPick] = useState<Record<string, { type: Cargo; source?: string; sink?: string }>>({});
  const freight = (
    <>
      {groups.filter(([, t]) => trainFor(t[0]).service === "freight").length === 0 && (
        <p className="rail-hint">Freight lines run between freight terminals. Open one from Lines, then choose what it carries here.</p>
      )}
      {groups
        .filter(([, t]) => trainFor(t[0]).service === "freight")
        .map(([key, trains]) => {
          const lead = trains[0],
            f = trainFor(lead);
          const terms = lead.stops.map((id) => net.byId.get(id)).filter((e): e is PlacedElement => e?.defId === "freight_rail_terminal");
          const pick = cargoPick[key] ?? { type: f.contract?.type ?? "grain" };
          const [a, b] = [terms[0], terms[terms.length - 1]];
          const sources = a ? freightSites(net, a, pick.type, true) : [],
            sinks = b ? freightSites(net, b, pick.type, false) : [];
          const source = sources.find((e) => e.id === pick.source) ?? sources[0],
            sink = sinks.find((e) => e.id === pick.sink) ?? sinks[0];
          const c = f.contract;
          return (
            <article key={key} className="rail-card" style={{ ["--line" as string]: lineColor(lead) }}>
              <header>
                <i aria-hidden />
                <strong>{f.name}</strong>
                <small>{trains.length} train{trains.length > 1 ? "s" : ""}</small>
              </header>
              {c && (
                <p>
                  {CARGO[c.type].name}: {name(net.byId.get(c.source))} → {name(net.byId.get(c.sink))} · {freightAvailable(state, c.source, c.type)} waiting · output ×
                  {Math.max(railFreightBonus(state, c.source, c.type), railFreightBonus(state, c.sink, c.type)).toFixed(2)}
                </p>
              )}
              <div className="rail-chips">
                {(Object.keys(CARGO) as Cargo[])
                  .filter((k) => f.cars.some((car) => (CARGO[k].cars as readonly string[]).includes(car)))
                  .map((k) => (
                    <button key={k} aria-pressed={pick.type === k} onClick={() => setCargoPick({ ...cargoPick, [key]: { type: k } })}>
                      {CARGO[k].name}
                    </button>
                  ))}
              </div>
              <div className="rail-grid">
                <label>
                  From
                  <select value={source?.id ?? ""} onChange={(e) => setCargoPick({ ...cargoPick, [key]: { ...pick, source: e.target.value } })}>
                    {sources.length ? sources.map((e) => <option key={e.id} value={e.id}>{ELEMENT_BY_ID[e.defId].name}</option>) : <option value="">Nothing loads here</option>}
                  </select>
                </label>
                <label>
                  To
                  <select value={sink?.id ?? ""} onChange={(e) => setCargoPick({ ...cargoPick, [key]: { ...pick, sink: e.target.value } })}>
                    {sinks.length ? sinks.map((e) => <option key={e.id} value={e.id}>{ELEMENT_BY_ID[e.defId].name}</option>) : <option value="">Nobody takes it here</option>}
                  </select>
                </label>
              </div>
              <button
                disabled={!source || !sink || !a || !b}
                onClick={() =>
                  apply((s) => {
                    for (const t of s.mobility!.lines.filter((l) => lineKey(l) === key))
                      assignContract(s, t, { type: pick.type, pickup: a!.id, drop: b!.id, source: source!.id, sink: sink!.id });
                  }, "Cargo assigned.")
                }
              >
                Carry {CARGO[pick.type].name.toLowerCase()}
              </button>
            </article>
          );
        })}
    </>
  );

  /* ------------------------------------------------------------ yard */
  const [siteId, setSite] = useState(selected.id);
  const site = stations.find((e) => e.id === siteId) ?? selected;
  const [work, setWork] = useState<YardWork>("platform");
  const [rename, setRename] = useState<string>();
  const junctions = useMemo(
    () =>
      state.elements.filter(
        (e) => ELEMENT_BY_ID[e.defId]?.isRailNetwork && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([x, z]) => net.canUse(e.gx + x, e.gz + z, "rail")).length >= 3,
      ),
    [net, state.elements],
  );
  const facility = ELEMENT_BY_ID[site.defId],
    nextLevel = Math.min(5, site.level + 1);
  const yard = (
    <>
      <TrackMap state={state} lines={rails} focus={site.id} select={setSite} name={name} />
      <div className="rail-chips">
        {stations.map((e) => (
          <button key={e.id} aria-pressed={e.id === site.id} onClick={() => setSite(e.id)}>
            {name(e)}
          </button>
        ))}
      </div>
      <h3>
        {rename === undefined ? (
          <>
            {name(site)} <button className="rail-ghost" onClick={() => setRename(name(site))}>Rename</button>
          </>
        ) : (
          <span className="rail-rename">
            <input aria-label="Station name" value={rename} maxLength={32} onChange={(e) => setRename(e.target.value)} />
            <button onClick={() => apply((s) => renameStation(s, site.id, rename), "Renamed.") && setRename(undefined)}>Save</button>
          </span>
        )}
      </h3>
      <p className="rail-hint">
        {facility.name} · Level {site.level} · {platformLimit(state, site)}-car platform
        {site.defId === "train_depots" ? " · " + yardCapacity(state, site) + " train berths" : ""} ·{" "}
        {net.connectors(site, "rail").length ? "track connected" : "no track at the back edge"}
      </p>
      <div className="rail-actions">
        <button onClick={() => onFocus(site)}>Show on map</button>
        <button onClick={() => onTrack(site)}>Lay approach track</button>
        {site.level < 5 && (
          <button
            onClick={() =>
              apply((s) => {
                const r = upgradeElementDirect(s, site.id);
                if (!r.ok) throw Error(r.reason);
              }, "Upgraded.")
            }
          >
            Upgrade to Lv{nextLevel} · {getStandardFootprintForLevel(facility, nextLevel).join("×")} · {state.mode === "god" ? "free" : "$" + getUpgradeCost(facility, site.level)}
          </button>
        )}
      </div>
      <div className="rail-grid">
        <label>
          Improvement
          <select value={work} onChange={(e) => setWork(e.target.value as YardWork)}>
            {Object.entries(YARD_WORKS).map(([k, w]) => (
              <option key={k} value={k}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!!state.railYard?.works?.[site.id]?.[work]}
          onClick={() => apply((s) => installYardWork(s, s.elements.find((e) => e.id === site.id)!, work), "Installed.")}
        >
          {state.railYard?.works?.[site.id]?.[work] ? "Installed" : "Install · " + (state.mode === "god" ? "free" : "$" + YARD_WORKS[work].cost)}
        </button>
      </div>
      <p className="rail-hint">{YARD_WORKS[work].detail} Needs site level {YARD_WORKS[work].level}.</p>
      <details>
        <summary>How track works</summary>
        <p className="rail-hint">
          Trains reserve track one stretch at a time and wait in passing loops for oncoming trains, so loops and double track add capacity.
          Track level sets the speed limit (Lv1 slow … Lv5 high-speed). Lv2+ track carries signals, letting trains follow closer. Electric and
          high-speed trains need Lv4+ wired track or they crawl.
        </p>
      </details>
      {junctions.length > 0 && (
        <details>
          <summary>Junctions ({junctions.length})</summary>
          {junctions.map((j) => {
            const k = j.gx + "," + j.gz;
            return (
              <label key={j.id}>
                Junction near {short(name([...stations].sort((a, b) => Math.hypot(a.gx - j.gx, a.gz - j.gz) - Math.hypot(b.gx - j.gx, b.gz - j.gz))[0]))}
                <select value={state.railYard?.turnouts[k] ?? "auto"} onChange={(e) => apply((s) => setTurnout(s, j.gx, j.gz, e.target.value as SwitchSetting), "Points set.")}>
                  <option value="auto">Automatic</option>
                  <option value="east-west">Straight east–west</option>
                  <option value="north-south">Straight north–south</option>
                  <option value="closed">Closed (hold trains)</option>
                </select>
              </label>
            );
          })}
        </details>
      )}
    </>
  );

  return (
    <GameDialog label="Rail Operations" className="rail-dialog" onDismiss={onClose}>
      <div className="rail-window">
        <header>
          <div>
            <small>{name(selected)}</small>
            <h2>Rail</h2>
          </div>
          <button data-dialog-focus onClick={onClose} aria-label="Close Rail Operations">
            ✕
          </button>
        </header>
        <nav aria-label="Rail Operations sections">
          {tabs.map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => go(t)}>
              {t}
            </button>
          ))}
        </nav>
        <main key={tab + (draft ? "-edit" : "")}>
          {tab === "Lines" &&
            (editor ?? (
              <>
                {groups.map(card)}
                {groups.length === 0 && <p className="rail-hint">Lines carry trains between stations. Tap stations in order and the line draws itself along the track.</p>}
                <div className="rail-actions">
                  <button className="rail-primary" onClick={() => startLine("passenger")} disabled={!depots.length}>
                    + Passenger line
                  </button>
                  <button onClick={() => startLine("freight")} disabled={!depots.length}>
                    + Freight line
                  </button>
                </div>
              </>
            ))}
          {tab === "Fleet" && fleet}
          {tab === "Freight" && freight}
          {tab === "Yard" && yard}
        </main>
        {(error || message) && (
          <p className={error ? "rail-feedback rail-error" : "rail-feedback"} role={error ? "alert" : "status"}>
            {error || message}
          </p>
        )}
      </div>
    </GameDialog>
  );
}

/** Live schematic: track, stations (tap to select), each line's trains as coloured dots. */
function TrackMap({ state, lines, focus, select, name }: { state: GameState; lines: Run[]; focus: string; select: (id: string) => void; name: (e: PlacedElement) => string }) {
  let tracks = state.elements.filter((e) => ELEMENT_BY_ID[e.defId]?.isRailNetwork);
  let sites = state.elements.filter((e) => isRailStation(e.defId));
  if (!tracks.length) return <p className="rail-hint">Lay track along the back edge of a platform to bring it into service.</p>;
  const current = sites.find((e) => e.id === focus);
  if (current) {
    const near = (e: PlacedElement) => Math.max(Math.abs(e.gx - current.gx), Math.abs(e.gz - current.gz)) <= 22;
    sites = sites.filter(near);
    tracks = tracks.filter(near);
  }
  const all = [...sites, ...tracks];
  const minX = Math.min(...all.map((e) => e.gx)) - 1,
    minZ = Math.min(...all.map((e) => e.gz)) - 1;
  const width = Math.max(6, Math.max(...all.map((e) => e.gx + e.spanX)) + 1 - minX),
    height = Math.max(4, Math.max(...all.map((e) => e.gz + e.spanZ)) + 1 - minZ);
  const tiles = new Set(tracks.map((e) => e.gx + "," + e.gz));
  const d = tracks
    .flatMap((e) =>
      [
        [1, 0],
        [0, 1],
      ]
        .filter(([dx, dz]) => tiles.has(e.gx + dx + "," + (e.gz + dz)))
        .map(([dx, dz]) => "M" + (e.gx + 0.5) + "," + (e.gz + 0.5) + "l" + dx + "," + dz),
    )
    .join(" ");
  return (
    <svg className="rail-map" role="img" aria-label="Live railway map" viewBox={[minX, minZ, width, height].join(" ")}>
      <path d={d} fill="none" stroke="#6b7063" strokeWidth=".55" strokeLinecap="round" />
      {lines.flatMap((l) =>
        l.path.length > 1 && l.enabled
          ? [<polyline key={"p" + l.id} points={l.path.map((p) => p[0] + 0.5 + "," + (p[1] + 0.5)).join(" ")} fill="none" stroke={lineColor(l)} strokeWidth=".3" opacity=".75" />]
          : [],
      )}
      {sites.map((e) => (
        <g key={e.id} onClick={() => select(e.id)} style={{ cursor: "pointer" }}>
          <title>{name(e)}</title>
          <rect x={e.gx + 0.08} y={e.gz + 0.08} width={e.spanX - 0.16} height={e.spanZ - 0.16} rx=".2" fill={e.id === focus ? "#bd6338" : e.defId === "freight_rail_terminal" ? "#98763f" : e.defId === "train_depots" ? "#5a5f66" : "#296551"} />
        </g>
      ))}
      {lines
        .filter((l) => l.enabled && l.position && l.at !== l.depot)
        .map((l) => (
          <circle key={l.id} cx={l.position![0] + 0.5} cy={l.position![1] + 0.5} r=".42" fill={lineColor(l)} stroke={l.rail?.waitingSince !== undefined ? "#e23b2e" : "#fff"} strokeWidth=".14">
            <title>{l.rail?.name + " · " + l.status}</title>
          </circle>
        ))}
    </svg>
  );
}
