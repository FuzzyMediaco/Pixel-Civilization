import { useEffect, useMemo, useState } from "react";
import { GameDialog } from "./GameDialog";
import {
  ELEMENT_BY_ID,
  getUpgradeCost,
  getStandardFootprintForLevel,
} from "../game/catalog";
import { addLine, replanRailStops, type Run } from "../game/mobility";
import { getTravelNetwork } from "../game/travelNetwork";
import {
  upgradeElementDirect,
  type GameState,
  type PlacedElement,
} from "../game/simulation";
import {
  CARS,
  CARGO,
  LOCOMOTIVES,
  YARD_WORKS,
  assignContract,
  changeFormation,
  defaultFormation,
  exchangeEngines,
  formationPrice,
  formationChangePrice,
  freightSites,
  freightAvailable,
  installYardWork,
  isRailStation,
  platformLimit,
  railCapacity,
  setTurnout,
  stationLabel,
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
import { getHandbookFrame } from "../game/handbookLayout";
import "./railOperations.css";
const tabs = [
  "Overview",
  "Lines",
  "Trains",
  "Cars",
  "Cargo",
  "Upgrades",
] as const;
type Tab = (typeof tabs)[number];
const stock = (kind: string) => "./handbook/rail/" + kind + ".webp";
function TrainStrip({ f }: { f: RailFormation }) {
  return (
    <div className="rail-formation" aria-label="Formation preview">
      {[f.engine, ...f.cars].map((id, i) => (
        <img
          key={i + "-" + id}
          src={stock(id)}
          alt={
            id in LOCOMOTIVES
              ? LOCOMOTIVES[id as Engine].name
              : CARS[id as RailCar].name
          }
        />
      ))}
    </div>
  );
}
function TrackMap({
  sites,
  tracks,
  lines,
  focus,
  select,
}: {
  sites: PlacedElement[];
  tracks: PlacedElement[];
  lines: Run[];
  focus: string;
  select: (id: string) => void;
}) {
  if (!tracks.length)
    return (
      <p className="rail-empty">
        Lay track along the rear of a platform to bring it into service.
      </p>
    );
  const current = sites.find((e) => e.id === focus);
  if (current) {
    const near = (e: PlacedElement) =>
      Math.max(Math.abs(e.gx - current.gx), Math.abs(e.gz - current.gz)) <= 26;
    sites = sites.filter(near);
    tracks = tracks.filter(near);
  }
  const all = [...sites, ...tracks],
    minX = Math.min(...all.map((e) => e.gx)) - 1,
    minZ = Math.min(...all.map((e) => e.gz)) - 1;
  const width = Math.max(
      5,
      Math.max(...all.map((e) => e.gx + e.spanX)) + 1 - minX,
    ),
    height = Math.max(
      4,
      Math.max(...all.map((e) => e.gz + e.spanZ)) + 1 - minZ,
    );
  const tiles = new Set(tracks.map((e) => e.gx + "," + e.gz)),
    segments = tracks
      .flatMap((e) =>
        [
          [1, 0],
          [0, 1],
        ]
          .filter(([dx, dz]) => tiles.has(e.gx + dx + "," + (e.gz + dz)))
          .map(
            ([dx, dz]) =>
              "M" + (e.gx + 0.5) + "," + (e.gz + 0.5) + "l" + dx + "," + dz,
          ),
      )
      .join(" ");
  return (
    <figure className="rail-diagram">
      <svg
        className="rail-map"
        role="img"
        aria-label="Live railway map"
        viewBox={[minX, minZ, width, height].join(" ")}
      >
        <path
          d={segments}
          fill="none"
          stroke="#6b7063"
          strokeWidth=".68"
          strokeLinecap="round"
        />
        <path
          d={segments}
          fill="none"
          stroke="#c3c5ab"
          strokeWidth=".31"
          strokeDasharray=".10 .19"
        />
        {sites.map((e) => (
          <g key={e.id} onClick={() => select(e.id)}>
            <title>{stationLabel(e)}</title>
            <rect
              x={e.gx + 0.05}
              y={e.gz + 0.05}
              width={e.spanX - 0.1}
              height={e.spanZ - 0.1}
              rx=".15"
              fill={
                e.id === focus
                  ? "#bd6338"
                  : e.defId === "freight_rail_terminal"
                    ? "#98763f"
                    : "#296551"
              }
            />
          </g>
        ))}
        {lines
          .filter(
            (l) => l.enabled && l.position && l.at !== l.depot && !l.blocked,
          )
          .map((l) => (
            <circle
              key={l.id}
              cx={l.position![0] + 0.5}
              cy={l.position![1] + 0.5}
              r=".36"
              fill={l.rail?.service === "freight" ? "#b54e2b" : "#165d8a"}
              stroke="#fff"
              strokeWidth=".12"
            >
              <title>{l.rail?.name ?? "Train"}</title>
            </circle>
          ))}
      </svg>
      <figcaption>
        <span>Selected site</span>
        <span>Passenger platform</span>
        <span>Freight platform</span>
      </figcaption>
    </figure>
  );
}
const description: Record<YardWork, string> = Object.fromEntries(
  Object.entries(YARD_WORKS).map(([id, w]) => [id, w.detail]),
) as Record<YardWork, string>;
type Props = {
  state: GameState;
  selected: PlacedElement;
  change: (fn: (s: GameState) => void) => void;
  onClose: () => void;
  onTrack: (e: PlacedElement) => void;
  onFocus: (e: PlacedElement) => void;
};
export function RailOperations({
  state,
  selected,
  change,
  onClose,
  onTrack,
  onFocus,
}: Props) {
  const stations = state.elements.filter((e) => isRailStation(e.defId)),
    depots = stations.filter((e) => e.defId === "train_depots");
  const [siteId, setSite] = useState(selected.id),
    site = stations.find((e) => e.id === siteId) ?? selected;
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const t = sessionStorage.getItem("pixel-rail-tab");
      return tabs.includes(t as Tab) ? (t as Tab) : "Overview";
    } catch {
      return "Overview";
    }
  });
  const go = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem("pixel-rail-tab", t);
    } catch {}
  };
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const lines = state.mobility?.lines.filter((l) => l.mode === "rail") ?? [];
  const [id, setId] = useState(
    lines.find((l) => l.depot === selected.id || l.stops.includes(selected.id))
      ?.id ??
      lines[0]?.id ??
      "",
  );
  const line = lines.find((l) => l.id === id),
    live = line ? trainFor(line) : undefined;
  const [base, setBase] = useState(
    (selected.defId === "train_depots" ? selected : depots[0])?.id ?? "",
  );
  const depot = depots.find((e) => e.id === base);
  const [draft, setDraft] = useState<RailFormation>(() =>
    line
      ? { ...trainFor(line), cars: [...trainFor(line).cars] }
      : defaultFormation(),
  );
  const [stops, setStops] = useState<string[]>(line?.stops ?? []),
    [routeEdit, setRouteEdit] = useState(false);
  const [carFilter, setCarFilter] = useState<"all" | RailService>("all"),
    [cargo, setCargo] = useState<Cargo>("grain");
  const [pickup, setPickup] = useState(""),
    [drop, setDrop] = useState(""),
    [source, setSource] = useState(""),
    [sink, setSink] = useState("");
  const [exchange, setExchange] = useState(""),
    [work, setWork] = useState<YardWork>("platform"),
    [switchKey, setSwitchKey] = useState("");
  const net = getTravelNetwork(state);
  const { tracks, junctions } = useMemo(() => {
    const tracks = state.elements.filter(
      (e) => ELEMENT_BY_ID[e.defId]?.isRailNetwork,
    );
    const junctions = tracks.filter(
      (e) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([x, z]) => net.canUse(e.gx + x, e.gz + z, "rail")).length >=
        3,
    );
    return { tracks, junctions };
  }, [net]);
  const apply = (fn: (s: GameState) => void, confirmation: string) => {
    try {
      change(fn);
      setMessage(confirmation);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to apply the change.");
      setMessage("");
      return false;
    }
  };
  const load = (l: Run) => {
    const f = trainFor(l);
    setId(l.id);
    setBase(l.depot);
    setDraft({ ...f, cars: [...f.cars] });
    setStops([...l.stops]);
    setRouteEdit(false);
    const c = f.contract;
    if (c) {
      setCargo(c.type);
      setPickup(c.pickup);
      setDrop(c.drop);
      setSource(c.source);
      setSink(c.sink);
    }
    setError("");
    setMessage("");
  };
  const create = (service: RailService) => {
    setId("");
    setDraft(defaultFormation(service));
    setBase(site.defId === "train_depots" ? site.id : (depots[0]?.id ?? ""));
    setStops([]);
    setRouteEdit(false);
    setError("");
    setMessage("");
    go("Lines");
  };
  const eligible = stations.filter(
    (e) =>
      e.defId ===
      (draft.service === "passenger" ? "train_stops" : "freight_rail_terminal"),
  );
  const makeLine = () => {
    let next = "";
    if (
      apply((s) => {
        next = addLine(s, "rail", base, stops, {
          ...draft,
          cars: [...draft.cars],
        });
      }, "Line dispatched.")
    ) {
      setId(next);
      setRouteEdit(false);
    }
  };
  const updateLine = () =>
    apply((s) => {
      const l = s.mobility?.lines.find((v) => v.id === id);
      if (!l) throw Error("Select a train.");
      changeFormation(s, id, draft);
      if (routeEdit) replanRailStops(s, l, stops);
    }, "Railway changes saved.");
  const add = (c: RailCar) => {
    if (CARS[c].service !== draft.service) {
      setError("Choose a " + draft.service + " car for this formation.");
      return;
    }
    setDraft({ ...draft, cars: [...draft.cars, c] });
  };
  const reorder = (i: number, dir: number) => {
    const a = [...draft.cars],
      j = i + dir;
    [a[i], a[j]] = [a[j], a[i]];
    setDraft({ ...draft, cars: a });
  };
  const fleetSelect = (
    <label>
      Train assignment
      <select
        value={id}
        onChange={(e) => {
          const l = lines.find((l) => l.id === e.target.value);
          if (l) load(l);
        }}
      >
        <option value="">Select a train</option>
        {lines.map((l) => (
          <option key={l.id} value={l.id}>
            {trainFor(l).name} · {trainFor(l).trainId}
          </option>
        ))}
      </select>
    </label>
  );
  const formationControls = (
    <>
      <label>
        Locomotive
        <select
          value={draft.engine}
          onChange={(e) =>
            setDraft({ ...draft, engine: e.target.value as Engine })
          }
        >
          {Object.entries(LOCOMOTIVES)
            .filter(([, e]) => draft.service === "passenger" || e.freight)
            .map(([k, e]) => (
              <option key={k} value={k}>
                {e.name} · depot {e.level}
              </option>
            ))}
        </select>
      </label>
      <TrainStrip f={draft} />
      <p>
        {draft.cars.length} cars · {railCapacity(draft)}{" "}
        {draft.service === "passenger" ? "seats" : "cargo units"}
      </p>
    </>
  );
  const quote =
    state.mode === "god"
      ? "Free in God mode"
      : "$" +
        (live ? formationChangePrice(live, draft) : formationPrice(draft));
  const editButtons = (
    <div className="rail-actions">
      <small>{quote}</small>
      <button className="rail-primary" onClick={line ? updateLine : makeLine}>
        {line ? "Apply changes" : "Create line"}
      </button>
      <button onClick={() => (line ? load(line) : create(draft.service))}>
        Discard draft
      </button>
    </div>
  );
  const oneStation = (sid: string) => net.byId.get(sid);
  const endpoints = (line?.stops ?? [])
    .map(oneStation)
    .filter(
      (p): p is PlacedElement => !!p && p.defId === "freight_rail_terminal",
    );
  const from = endpoints.find((e) => e.id === pickup) ?? endpoints[0];
  const to =
    endpoints.find((e) => e.id === drop && e !== from) ??
    endpoints.find((e) => e !== from);
  const factories = from ? freightSites(net, from, cargo, true) : [],
    buyers = to ? freightSites(net, to, cargo, false) : [];
  const producer = factories.find((e) => e.id === source) ?? factories[0],
    buyer = buyers.find((e) => e.id === sink) ?? buyers[0];
  const opts = (entries: PlacedElement[]) =>
    entries.map((e) => (
      <option key={e.id} value={e.id}>
        {stationLabel(e)}
      </option>
    ));
  const facility = ELEMENT_BY_ID[site.defId],
    nextLevel = Math.min(5, site.level + 1),
    nextSize = getStandardFootprintForLevel(facility, nextLevel);
  const turnout =
    junctions.find((e) => e.gx + "," + e.gz === switchKey) ?? junctions[0];
  useEffect(() => {
    setMessage("");
    setError("");
  }, [tab]);
  return (
    <GameDialog
      label="Rail Operations"
      className="rail-dialog"
      onDismiss={onClose}
    >
      <div className="rail-window">
        <header>
          <div>
            <small>
              {stationLabel(site)} · Level {site.level} · {state.mode} mode
            </small>
            <h2>Rail Operations</h2>
          </div>
          <button
            data-dialog-focus
            onClick={onClose}
            aria-label="Close Rail Operations"
          >
            Close
          </button>
        </header>
        <nav aria-label="Rail Operations sections">
          {tabs.map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => go(t)}>
              {t}
            </button>
          ))}
        </nav>
        <main key={tab}>
          {tab === "Overview" && (
            <>
              <div className="rail-metrics">
                {[
                  [
                    stations.filter((e) => net.connectors(e, "rail").length)
                      .length +
                      "/" +
                      stations.length,
                    "Linked sites",
                  ],
                  [lines.length, "Lines"],
                  [
                    lines.filter((l) => l.enabled && !l.blocked).length,
                    "In service",
                  ],
                  [
                    lines.reduce((n, l) => n + trainFor(l).cars.length, 0),
                    "Cars",
                  ],
                ].map(([n, t]) => (
                  <div key={t}>
                    <b>{n}</b>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <TrackMap
                sites={stations}
                tracks={tracks}
                lines={lines}
                focus={site.id}
                select={setSite}
              />
              <label>
                Station or depot
                <select
                  value={site.id}
                  onChange={(e) => setSite(e.target.value)}
                >
                  {opts(stations)}
                </select>
              </label>
              <p>
                {net.connectors(site, "rail").length
                  ? net.connectors(site, "rail").length +
                    " track connection(s) at the platform."
                  : "No track at this platform. Lay rail alongside the rear edge, or rotate the building to face an existing track."}
              </p>
              <div className="rail-actions">
                <button onClick={() => onFocus(site)}>Show site on map</button>
                <button onClick={() => onTrack(site)}>
                  Lay approach track
                </button>
              </div>
              <div className="rail-actions">
                <button onClick={() => create("passenger")}>
                  New passenger line
                </button>
                <button onClick={() => create("freight")}>
                  New freight line
                </button>
              </div>
              {junctions.length > 0 && (
                <fieldset>
                  <legend>Track switches</legend>
                  <label>
                    Junction
                    <select
                      value={turnout.gx + "," + turnout.gz}
                      onChange={(e) => setSwitchKey(e.target.value)}
                    >
                      {junctions.map((e) => (
                        <option key={e.id} value={e.gx + "," + e.gz}>
                          Junction {e.gx}, {e.gz}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Points and signal
                    <select
                      value={
                        state.railYard?.turnouts[
                          turnout.gx + "," + turnout.gz
                        ] ?? "auto"
                      }
                      onChange={(e) =>
                        apply(
                          (s) =>
                            setTurnout(
                              s,
                              turnout.gx,
                              turnout.gz,
                              e.target.value as SwitchSetting,
                            ),
                          "Switch set.",
                        )
                      }
                    >
                      <option value="auto">Automatic routing</option>
                      <option value="east-west">Straight east–west</option>
                      <option value="north-south">Straight north–south</option>
                      <option value="closed">Hold all trains</option>
                    </select>
                  </label>
                </fieldset>
              )}
            </>
          )}
          {tab === "Lines" && (
            <>
              {lines.length > 0 && (
                <div className="rail-lines">
                  {lines.map((l) => (
                    <button
                      key={l.id}
                      aria-pressed={l.id === id}
                      onClick={() => load(l)}
                    >
                      <strong>{trainFor(l).name}</strong>
                      <span>
                        {trainFor(l).service} · {trainFor(l).cars.length} cars ·{" "}
                        {l.interval}s · {l.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="rail-actions">
                <button onClick={() => create("passenger")}>
                  New passenger line
                </button>
                <button onClick={() => create("freight")}>
                  New freight line
                </button>
              </div>
              <label>
                Line name
                <input
                  maxLength={42}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Home depot
                <select
                  value={base}
                  disabled={!!line}
                  onChange={(e) => setBase(e.target.value)}
                >
                  <option value="">Select a depot</option>
                  {opts(depots)}
                </select>
              </label>
              {line && (
                <div className="rail-actions">
                  <button
                    onClick={() =>
                      apply((s) => {
                        const l = s.mobility!.lines.find((l) => l.id === id)!;
                        l.enabled = !l.enabled;
                      }, "Service updated.")
                    }
                  >
                    {line.enabled ? "Pause service" : "Resume service"}
                  </button>
                  <button onClick={() => setRouteEdit(true)}>
                    Replan stops
                  </button>
                </div>
              )}
              <fieldset>
                <legend>Stops in travel order</legend>
                {eligible.length === 0 ? (
                  <p>
                    Build two{" "}
                    {draft.service === "freight"
                      ? "freight terminals"
                      : "train stops"}{" "}
                    and connect both to this depot.
                  </p>
                ) : (
                  eligible.map((e) => (
                    <label className="rail-check" key={e.id}>
                      <input
                        type="checkbox"
                        checked={stops.includes(e.id)}
                        disabled={!!line && !routeEdit}
                        onChange={() =>
                          setStops(
                            stops.includes(e.id)
                              ? stops.filter((v) => v !== e.id)
                              : [...stops, e.id],
                          )
                        }
                      />
                      <span>
                        {stops.includes(e.id)
                          ? stops.indexOf(e.id) + 1 + ". "
                          : ""}
                        {stationLabel(e)}
                      </span>
                    </label>
                  ))
                )}
              </fieldset>
              <div className="rail-grid">
                <label>
                  Frequency (seconds)
                  <input
                    type="number"
                    min="2"
                    max="90"
                    value={draft.frequency}
                    onChange={(e) =>
                      setDraft({ ...draft, frequency: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Service hours
                  <select
                    value={draft.schedule}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        schedule: e.target.value as RailFormation["schedule"],
                      })
                    }
                  >
                    <option value="all">All day</option>
                    <option value="day">Daylight</option>
                    <option value="night">Night</option>
                  </select>
                </label>
                <label>
                  Route pattern
                  <select
                    value={draft.pattern}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        pattern: e.target.value as RailFormation["pattern"],
                      })
                    }
                  >
                    <option value="circuit">Ordered circuit</option>
                    <option value="shuttle">Return via each stop</option>
                  </select>
                </label>
                <label>
                  Dispatch priority
                  <select
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        priority: e.target.value as RailFormation["priority"],
                      })
                    }
                  >
                    <option value="normal">Regular</option>
                    <option value="express">Express</option>
                  </select>
                </label>
              </div>
              {formationControls}
              <div className="rail-actions">
                <button
                  disabled={draft.cars.length <= 1}
                  onClick={() =>
                    setDraft({ ...draft, cars: draft.cars.slice(0, -1) })
                  }
                >
                  Remove last car
                </button>
                <button
                  disabled={draft.cars.length >= 8}
                  onClick={() =>
                    add(draft.service === "passenger" ? "coach" : "box")
                  }
                >
                  Add car
                </button>
              </div>
              {depot && (
                <p>{platformLimit(state, depot)} cars fit this depot.</p>
              )}
              {editButtons}
            </>
          )}
          {tab === "Trains" && (
            <>
              {fleetSelect}
              {line && live ? (
                <>
                  <p>
                    <b>{live.trainId}</b> · {line.status} ·{" "}
                    {line.blocked
                      ? "Blocked"
                      : line.enabled
                        ? "In service"
                        : "Parked"}
                  </p>
                  {formationControls}
                  <p>
                    {line.riders.reduce((n, r) => n + r.count, 0)} onboard ·{" "}
                    {line.delivered} delivered · {line.departures} station calls
                  </p>
                  {editButtons}
                  <fieldset>
                    <legend>Exchange assignments at the depot</legend>
                    <select
                      aria-label="Other train"
                      value={exchange}
                      onChange={(e) => setExchange(e.target.value)}
                    >
                      <option value="">Choose another train</option>
                      {lines
                        .filter((l) => l.id !== id && l.depot === line.depot)
                        .map((l) => (
                          <option value={l.id} key={l.id}>
                            {trainFor(l).name}
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={!exchange}
                      onClick={() =>
                        apply(
                          (s) =>
                            exchangeEngines(
                              s,
                              s.mobility!.lines.find((x) => x.id === id)!,
                              s.mobility!.lines.find((x) => x.id === exchange)!,
                            ),
                          "Train assignments exchanged.",
                        )
                      }
                    >
                      Exchange trains
                    </button>
                  </fieldset>
                </>
              ) : (
                <p>Create or select a railway line to manage its locomotive.</p>
              )}
            </>
          )}
          {tab === "Cars" && (
            <>
              {fleetSelect}
              <div className="rail-actions">
                {(["all", "passenger", "freight"] as const).map((k) => (
                  <button
                    key={k}
                    aria-pressed={carFilter === k}
                    onClick={() => setCarFilter(k)}
                  >
                    {k === "all"
                      ? "All cars"
                      : k === "freight"
                        ? "Freight"
                        : "Passenger"}
                  </button>
                ))}
              </div>
              <div className="rail-catalog">
                {Object.entries(CARS)
                  .filter(
                    ([, c]) => carFilter === "all" || c.service === carFilter,
                  )
                  .map(([k, c]) => (
                    <button
                      key={k}
                      disabled={
                        !line ||
                        draft.service !== c.service ||
                        draft.cars.length >= 8
                      }
                      onClick={() => add(k as RailCar)}
                    >
                      <img src={stock(k)} alt="" />
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.capacity}{" "}
                          {c.service === "passenger" ? "seats" : "units"} ·{" "}
                          {state.mode === "god" ? "Free" : "$" + c.cost}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
              {line && (
                <>
                  <h3>Draft formation</h3>
                  <TrainStrip f={draft} />
                  {draft.cars.map((c, i) => (
                    <div className="rail-car-row" key={i}>
                      <span>
                        {i + 1}. {CARS[c].name}
                      </span>
                      <button
                        aria-label={"Move car " + (i + 1) + " forward"}
                        disabled={!i}
                        onClick={() => reorder(i, -1)}
                      >
                        ←
                      </button>
                      <button
                        aria-label={"Move car " + (i + 1) + " back"}
                        disabled={i === draft.cars.length - 1}
                        onClick={() => reorder(i, 1)}
                      >
                        →
                      </button>
                      <button
                        aria-label={"Remove car " + (i + 1)}
                        disabled={draft.cars.length <= 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            cars: draft.cars.filter((_, j) => j !== i),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {editButtons}
                </>
              )}
            </>
          )}
          {tab === "Cargo" && (
            <>
              {fleetSelect}
              <label>
                Commodity
                <select
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value as Cargo)}
                >
                  {Object.entries(CARGO).map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Requires{" "}
                {CARGO[cargo].cars.map((c) => CARS[c].name).join(" or ")}. Both
                industries gain a temporary 8% benefit after delivery.
              </p>
              {live?.service !== "freight" ? (
                <p>
                  Select a freight line serving two terminals to assign
                  shipments.
                </p>
              ) : (
                <>
                  <div className="rail-grid">
                    <label>
                      Loading platform
                      <select
                        value={from?.id ?? ""}
                        onChange={(e) => setPickup(e.target.value)}
                      >
                        {opts(endpoints)}
                      </select>
                    </label>
                    <label>
                      Unloading platform
                      <select
                        value={to?.id ?? ""}
                        onChange={(e) => setDrop(e.target.value)}
                      >
                        {opts(endpoints.filter((e) => e !== from))}
                      </select>
                    </label>
                    <label>
                      Producer
                      <select
                        value={producer?.id ?? ""}
                        onChange={(e) => setSource(e.target.value)}
                      >
                        {factories.length ? (
                          opts(factories)
                        ) : (
                          <option value="">No connected producer</option>
                        )}
                      </select>
                    </label>
                    <label>
                      Recipient
                      <select
                        value={buyer?.id ?? ""}
                        onChange={(e) => setSink(e.target.value)}
                      >
                        {buyers.length ? (
                          opts(buyers)
                        ) : (
                          <option value="">No connected recipient</option>
                        )}
                      </select>
                    </label>
                  </div>
                  <button
                    className="rail-primary"
                    disabled={!from || !to || !producer || !buyer}
                    onClick={() =>
                      apply(
                        (s) =>
                          assignContract(
                            s,
                            s.mobility!.lines.find((l) => l.id === id)!,
                            {
                              type: cargo,
                              pickup: from!.id,
                              drop: to!.id,
                              source: producer!.id,
                              sink: buyer!.id,
                            },
                          ),
                        "Freight contract assigned.",
                      )
                    }
                  >
                    Assign contract
                  </button>
                  {live.contract && (
                    <p>
                      {CARGO[live.contract.type].name} · {live.contract.loaded}{" "}
                      onboard · {live.contract.delivered} delivered ·{" "}
                      {freightAvailable(
                        state,
                        live.contract.source,
                        live.contract.type,
                      )}{" "}
                      ready at source
                    </p>
                  )}
                  {(!producer || !buyer) && (
                    <p>
                      Place an eligible industry beside the corresponding
                      terminal or join it to the terminal by a short street
                      connection.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {tab === "Upgrades" && (
            <>
              <label>
                Facility
                <select
                  value={site.id}
                  onChange={(e) => setSite(e.target.value)}
                >
                  {opts(stations)}
                </select>
              </label>
              <h3>
                {facility.name} · Level {site.level}
              </h3>
              <p>
                {platformLimit(state, site)}-car platform
                {site.defId === "train_depots"
                  ? " · " + yardCapacity(state, site) + " train berths"
                  : ""}
              </p>
              {site.level < 5 && (
                <fieldset>
                  <legend>Next building level</legend>
                  <span
                    className="rail-level-preview"
                    role="img"
                    aria-label={facility.name + " at level " + nextLevel}
                    style={{
                      ...getHandbookFrame(nextLevel, site.variant),
                      backgroundImage:
                        "url(./handbook/catalog/" + site.defId + ".webp)",
                    }}
                  />
                  <p>
                    Level {nextLevel} · {nextSize.join(" × ")} tiles ·{" "}
                    {state.mode === "god"
                      ? "Free"
                      : "$" + getUpgradeCost(facility, site.level)}
                  </p>
                  <button
                    onClick={() =>
                      apply((s) => {
                        const result = upgradeElementDirect(s, site.id);
                        if (!result.ok) throw Error(result.reason);
                      }, "Facility upgraded.")
                    }
                  >
                    Upgrade building
                  </button>
                </fieldset>
              )}
              <label>
                Yard improvement
                <select
                  value={work}
                  onChange={(e) => setWork(e.target.value as YardWork)}
                >
                  {Object.entries(YARD_WORKS).map(([key, w]) => (
                    <option value={key} key={key}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {description[work]} Site level {YARD_WORKS[work].level} ·{" "}
                {state.mode === "god" ? "Free" : "$" + YARD_WORKS[work].cost}
              </p>
              <button
                disabled={!!state.railYard?.works?.[site.id]?.[work]}
                onClick={() =>
                  apply(
                    (s) =>
                      installYardWork(
                        s,
                        s.elements.find((e) => e.id === site.id)!,
                        work,
                      ),
                    "Improvement installed.",
                  )
                }
              >
                {state.railYard?.works?.[site.id]?.[work]
                  ? "Installed"
                  : "Install improvement"}
              </button>
            </>
          )}
        </main>
        {(error || message) && (
          <p
            className={error ? "rail-feedback rail-error" : "rail-feedback"}
            role={error ? "alert" : "status"}
          >
            {error || message}
          </p>
        )}
      </div>
    </GameDialog>
  );
}
