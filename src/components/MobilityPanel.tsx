import { trainFor } from "../game/railOperations";
import { GRID_MIN, GRID_MAX } from "../game/mapBounds";
import React, { useEffect, useRef, useState } from "react";
import { ELEMENT_BY_ID } from "../game/catalog";
import type { GameState, PlacedElement } from "../game/simulation";
import {
  addLine,
  addTrainToLine,
  autoStops,
  dispatchVessel,
  eligibleDepots,
  eligibleStops,
  lineKey,
  lineTrains,
  modeNames,
  transitReadout,
  type Point,
  type TravelMode,
} from "../game/mobility";
import { vesselHull, vesselIds } from "../game/travelNetwork";

export type ChangeCity = (fn: (s: GameState) => void) => void;
export interface TransportProps {
  state: GameState;
  mutate: ChangeCity;
  selected?: PlacedElement;
  onFocus: (id: string) => void;
  focusLine?: string;
  following?: string;
  onGrid: (x: number, z: number, line: string) => void;
  onFollow: (id?: string) => void;
  onPickDestination: (id: string) => void;
  onRailOps: (depot: string) => void;
}
const placeName = (e: PlacedElement) => ELEMENT_BY_ID[e.defId].name + " · " + e.gx + ", " + e.gz;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function MobilityPanel({
  state,
  mutate,
  selected,
  onFollow,
  following,
  onFocus,
  onGrid,
  onPickDestination,
  onRailOps,
  focusLine,
}: TransportProps) {
  const [mode, setMode] = useState<TravelMode>("bus"),
    [depot, setDepot] = useState(""),
    [stops, setStops] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState(""),
    [showBuilder, setShowBuilder] = useState(false);
  const editorRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (focusLine) document.getElementById("service-" + focusLine)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusLine]);
  useEffect(() => {
    if (showBuilder) editorRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [showBuilder, editing]);
  const [waypoint, setWaypoint] = useState<Point>([0, 0]);
  const depots = eligibleDepots(state, mode),
    available = eligibleStops(state, mode),
    chosen = depots.some((d) => d.id === depot) ? depot : (depots[0]?.id ?? "");
  const readout = transitReadout(state),
    fleet = state.elements.filter((e) => vesselIds.has(e.defId));
  const [shipId, setShipId] = useState(selected && vesselIds.has(selected.defId) ? selected.id : "");
  useEffect(() => {
    if (selected && vesselIds.has(selected.defId)) setShipId(selected.id);
  }, [selected?.id]);
  const ship = fleet.find((e) => e.id === shipId) ?? fleet[0],
    voyage = ship && state.mobility?.voyages[ship.id];
  const follow = (id: string) => {
    const next = following === id ? "" : id;
    onFollow(next || undefined);
  };
  const suggest = () => {
    const list = autoStops(state, mode, chosen);
    setStops(list);
    setMessage(
      list.length < 2
        ? "This depot needs two reachable stops. Connect their curb, track or berth first."
        : "Suggested stops are in travel order. Select a stop again to remove it.",
    );
  };
  const create = () => {
    mutate((s) => {
      try {
        const id = addLine(s, mode, chosen, stops);
        if (editing) {
          const prior = s.mobility!.lines.find((l) => l.id === editing),
            replacement = s.mobility!.lines.find((l) => l.id === id)!;
          if (prior) {
            replacement.id = editing;
            replacement.delivered = prior.delivered;
            replacement.departures = prior.departures;
            replacement.enabled = prior.enabled;
            if (prior.mode === mode && prior.depot === chosen) {
              replacement.riders = prior.riders.filter((r) => stops.includes(r.destination));
              replacement.position = prior.position ?? replacement.position;
              replacement.at = prior.at && [chosen, ...stops].includes(prior.at) ? prior.at : undefined;
              replacement.waiting = prior.waiting;
              replacement.lastBoarding = prior.lastBoarding;
              const calls = [chosen, ...stops.filter((x) => x !== chosen)];
              const previous = [prior.depot, ...prior.stops.filter((x) => x !== prior.depot)];
              const next = calls.indexOf(previous[prior.next]);
              replacement.next = next >= 0 ? next : 1;
            }
            replacement.schedule = prior.schedule;
            replacement.interval = prior.interval;
            replacement.demandScale = prior.demandScale;
          }
          s.mobility!.lines = s.mobility!.lines.filter((l) => l !== prior);
        }
        setEditing("");
        setShowBuilder(false);
        setMessage(editing ? "Route updated." : "Service started. Follow the vehicle to see its first trip.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "This line could not start.");
      }
    });
  };
  return (
    <div className="ui-transit-content ui-city-section">
      <section className="ui-panel-card">
        <div className="ui-card-head ui-transit-heading">
          <strong>Public transit</strong>
          <button
            type="button"
            className="ui-transit-primary"
            aria-expanded={showBuilder}
            aria-controls="transit-line-editor"
            onClick={() => {
              setEditing("");
              setStops([]);
              setShowBuilder(!showBuilder);
              setMessage("");
            }}
          >
            {showBuilder ? "Close line editor" : "Plan a line"}
          </button>
        </div>
        <dl className="ui-transit-stats">
          <div><dt>Transit score</dt><dd>{readout.pressure ? readout.score + " / 100" : "—"}</dd></div>
          <div><dt>Trips in 2 min</dt><dd>{readout.served}</dd></div>
          <div><dt>Walkable access</dt><dd>{readout.coverage}%</dd></div>
        </dl>
        <p className="ui-card-meta">{readout.pressure || state.mobility?.lines.length
          ? `Demand ${readout.pressure} · ${readout.reliability}% reliable · ${readout.wait.toFixed(1)}s average wait · ${readout.freight} freight delivered`
          : "Transit demand appears once residents have places to go."}</p>
      </section>
      {showBuilder && (
        <fieldset id="transit-line-editor" className="ui-transit-fields" ref={editorRef}>
          <legend>{editing ? "Edit service" : "New service"}</legend>
          <label>
            Service
            <select
              aria-label="Service"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as TravelMode);
                setDepot("");
                setStops([]);
              }}
            >
              {Object.entries(modeNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Departure depot or landing
            <select
              value={chosen}
              onChange={(e) => {
                setDepot(e.target.value);
                setStops([]);
              }}
            >
              {!depots.length && <option value="">Place a compatible depot or landing</option>}
              {depots.map((e) => (
                <option key={e.id} value={e.id}>
                  {placeName(e)}
                </option>
              ))}
            </select>
          </label>
          <p className="ui-card-meta">{!chosen
            ? "Place a compatible depot or landing for this service."
            : available.length < 2
              ? "Place at least two compatible stops and connect them to the depot."
              : `Select stops in travel order · ${stops.length} selected`}</p>
          <div className="ui-transit-stops">
            {available.map((e) => (
              <button
                key={e.id}
                aria-pressed={stops.includes(e.id)}
                onClick={() =>
                  setStops((ids) => (ids.includes(e.id) ? ids.filter((x) => x !== e.id) : [...ids, e.id]))
                }
              >
                {stops.includes(e.id) ? stops.indexOf(e.id) + 1 + ". " : ""}
                {placeName(e)}
              </button>
            ))}
          </div>
          <div className="ui-transit-actions">
            <button disabled={!chosen} onClick={suggest}>
              Suggest reachable stops
            </button>
            <button className="ui-transit-primary" disabled={!chosen || stops.length < 2} onClick={create}>
              {editing ? "Apply route" : "Start service"}
            </button>
          </div>
        </fieldset>
      )}
      {message && <p className="ui-panel-card ui-card-copy" role="status">{message}</p>}
      {(state.mobility?.lines.length ?? 0) === 0 && !showBuilder &&
        <p className="ui-panel-card ui-card-copy">No services yet. Plan a line to connect a depot or landing to two stops.</p>}
      {(state.mobility?.lines ?? []).map((l) => (
        <details className="ui-fold" key={l.id} id={"service-" + l.id} open={focusLine === l.id || undefined}>
          <summary>
            <span>{l.mode === "rail" ? (l.rail?.name ?? "Rail line") + " · Train" : modeNames[l.mode]} {l.id.replace("line-", "#")}</span>
            <small>{l.enabled ? l.status : "Paused"}</small>
          </summary>
          <div className="ui-fold-body ui-transit-fields">
          <p className="ui-card-meta">
            {l.delivered} delivered · {l.riders.reduce((sum, r) => sum + r.count, 0)} aboard
          </p>
          <ol>
            {l.stops.map((id) => {
              const e = state.elements.find((el) => el.id === id);
              return (
                <li key={id}>
                  <button disabled={!e} onClick={() => onFocus(id)}>
                    {e ? placeName(e) : "Stop removed"}
                  </button>
                </li>
              );
            })}
          </ol>
          <label>
            {l.mode === "rail" ? "Line layover (seconds)" : "Depot layover (seconds)"}
            <input
              type="number"
              min={1}
              max={120}
              value={l.interval}
              onChange={(e) =>
                mutate((s) => {
                  const interval = clamp(Number(e.target.value), 1, 120);
                  for (const vehicle of lineTrains(s, lineKey(l))) {
                    vehicle.interval = interval;
                    if (vehicle.mode === "rail") trainFor(vehicle).frequency = interval;
                  }
                })
              }
            />
          </label>
          <label>
            Service hours
            <select
              value={l.schedule}
              onChange={(e) =>
                mutate((s) => {
                  const schedule = e.target.value as typeof l.schedule;
                  for (const vehicle of lineTrains(s, lineKey(l))) {
                    vehicle.schedule = schedule;
                    if (vehicle.mode === "rail") trainFor(vehicle).schedule = schedule;
                  }
                })
              }
            >
              <option value="all">All day</option>
              <option value="day">Day shift</option>
              <option value="night">Night service</option>
            </select>
          </label>
          {state.mode === "god" && (
            <label>
              Passenger demand ×
              <input
                type="number"
                min="0"
                max="20"
                step=".25"
                value={l.demandScale}
                onChange={(e) =>
                  mutate((s) => {
                    s.mobility!.lines.find((a) => a.id === l.id)!.demandScale = clamp(
                      Number(e.target.value),
                      0,
                      20,
                    );
                  })
                }
              />
            </label>
          )}
          <div className="ui-transit-actions">
            <button disabled={!l.enabled} onClick={() => follow(l.id)}>
              {following === l.id ? "Stop following" : "Follow vehicle"}
            </button>
            <button
              onClick={() =>
                mutate((s) => {
                  const enabled = !l.enabled;
                  for (const vehicle of lineTrains(s, lineKey(l))) vehicle.enabled = enabled;
                })
              }
            >
              {l.enabled ? "Pause service" : "Resume service"}
            </button>
            <button
              onClick={() =>
                mutate((s) => {
                  try {
                    if (l.mode === "rail") {
                      addTrainToLine(s, lineKey(l));
                      setMessage("Another train joins " + (l.rail?.name ?? "the line") + ".");
                      return;
                    }
                    const id = addLine(s, l.mode, l.depot, l.stops);
                    const extra = s.mobility!.lines.find((line) => line.id === id)!;
                    extra.interval = l.interval;
                    extra.schedule = l.schedule;
                    extra.demandScale = l.demandScale;
                    extra.dwell = l.interval / 2 + 3;
                    setMessage("An extra vehicle will leave the depot after a staggered start.");
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Depot unavailable.");
                  }
                })
              }
            >
              Add vehicle from depot
            </button>
            <button
              onClick={() => {
                if (l.mode === "rail") {
                  onRailOps(l.depot);
                  return;
                }
                setMode(l.mode);
                setDepot(l.depot);
                setStops([...l.stops]);
                setEditing(l.id);
                setShowBuilder(true);
              }}
            >
              {l.mode === "rail" ? "Rail Operations" : "Edit route"}
            </button>
            {l.blocker && (
              <button onClick={() => onGrid(l.blocker![0], l.blocker![1], l.id)}>Show obstruction</button>
            )}
            <button
              onClick={() =>
                mutate((s) => {
                  s.mobility!.lines = s.mobility!.lines.filter((a) => lineKey(a) !== lineKey(l));
                })
              }
            >
              Remove line
            </button>
          </div>
          </div>
        </details>
      ))}
      {!!fleet.length && (
        <fieldset className="ui-transit-fields">
          <legend>Harbor master</legend>
          <label>
            Vessel
            <select value={ship?.id} onChange={(e) => setShipId(e.target.value)}>
              {fleet.map((e) => (
                <option key={e.id} value={e.id}>
                  {placeName(e)}
                </option>
              ))}
            </select>
          </label>
          {ship && (
            <>
              <p>
                {voyage?.status ?? "At berth"} · Beam {vesselHull(ship).beam.toFixed(1)} m · Draft{" "}
                {vesselHull(ship).draft.toFixed(1)} m · Headroom {vesselHull(ship).height.toFixed(1)} m
                {vesselHull(ship).turningWidth &&
                  " · Turning basin " + vesselHull(ship).turningWidth!.toFixed(1) + " m"}
              </p>
              <div className="ui-transit-actions">
                {(["sail", "recall", "moor"] as const).map((a) => (
                  <button key={a} onClick={() => mutate((s) => dispatchVessel(s, ship.id, a))}>
                    {a === "sail" ? "Patrol" : a === "recall" ? "Return to berth" : "Hold position"}
                  </button>
                ))}
                <button onClick={() => follow(ship.id)}>
                  {following === ship.id ? "Stop following" : "Follow ship"}
                </button>
              </div>
              <div className="ui-transit-actions">
                {["East", "South"].map((name, i) => (
                  <label key={name}>
                    {name}
                    <input
                      aria-label={"Destination " + name}
                      type="number"
                      min={GRID_MIN}
                      max={GRID_MAX}
                      value={waypoint[i]}
                      onChange={(e) => {
                        const p: Point = [...waypoint];
                        p[i] = clamp(Math.round(Number(e.target.value)), GRID_MIN, GRID_MAX);
                        setWaypoint(p);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="ui-transit-actions">
                <button onClick={() => onPickDestination(ship.id)}>Choose destination on map</button>
                <button onClick={() => mutate((s) => dispatchVessel(s, ship.id, "sail", waypoint))}>
                  Sail to coordinates
                </button>
              </div>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
