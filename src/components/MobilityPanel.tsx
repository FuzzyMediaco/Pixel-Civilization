import { replanRailStops } from "../game/mobility";
import { GRID_MIN, GRID_MAX } from "../game/mapBounds";
import React, { useEffect, useState } from "react";
import { ELEMENT_BY_ID } from "../game/catalog";
import type { GameState, PlacedElement } from "../game/simulation";
import {
  addLine,
  autoStops,
  dispatchVessel,
  eligibleDepots,
  eligibleStops,
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
  focusLine,
}: TransportProps) {
  const [mode, setMode] = useState<TravelMode>("bus"),
    [depot, setDepot] = useState(""),
    [stops, setStops] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState(""),
    [showBuilder, setShowBuilder] = useState(false);
  useEffect(() => {
    if (focusLine) document.getElementById("service-" + focusLine)?.scrollIntoView({ block: "nearest" });
  }, [focusLine]);
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
        const existing=s.mobility?.lines.find(l=>l.id===editing);
        if(existing?.mode==="rail"){
          if(mode!=="rail"||existing.depot!==chosen)throw Error("Reassign this train in Rail Operations.");
          replanRailStops(s,existing,stops);setEditing("");setShowBuilder(false);setMessage("Updated the railway timetable.");return;
        }
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
        setMessage("Service started. Follow the vehicle to see its first trip.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "This line could not start.");
      }
    });
  };
  return (
    <div className="island-content">
      <h3>Public transit</h3>
      <div className="island-stats">
        <div>
          <strong>{readout.pressure ? readout.score + " / 100" : "Low demand"}</strong>
          <small>Transit score</small>
        </div>
        <div>
          <strong>{readout.served}</strong>
          <small>Trips in two minutes</small>
        </div>
        <div>
          <strong>{readout.coverage}%</strong>
          <small>Walkable access</small>
        </div>
      </div>
      <p>
        Demand {readout.pressure} · Reliability {readout.reliability}% · Average wait {readout.wait.toFixed(1)}s ·
        Freight delivered {readout.freight}
      </p>
      <button
        onClick={() => {
          setEditing("");
          setShowBuilder(!showBuilder);
          setMessage("");
        }}
      >
        {" "}
        {showBuilder ? "Close line editor" : "Plan a line"}{" "}
      </button>
      {showBuilder && (
        <fieldset>
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
          <div className="island-actions">
            <button disabled={!chosen} onClick={suggest}>
              Suggest reachable stops
            </button>
            <button disabled={stops.length < 2} onClick={create}>
              {editing ? "Apply route" : "Start service"}
            </button>
          </div>
          <p>Select stops in the order you want the vehicle to visit.</p>
          <div className="stop-picker">
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
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
      {(state.mobility?.lines ?? []).map((l) => (
        <details key={l.id} id={"service-" + l.id} open={focusLine === l.id || undefined}>
          <summary>
            {modeNames[l.mode]} {l.id.replace("line-", "#")} · {l.enabled ? l.status : "Paused"}
          </summary>
          <p>
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
            Depot layover (seconds)
            <input
              type="number"
              min={1}
              max={120}
              value={l.interval}
              onChange={(e) =>
                mutate((s) => {
                  s.mobility!.lines.find((a) => a.id === l.id)!.interval = clamp(Number(e.target.value), 1, 120);
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
                  s.mobility!.lines.find((a) => a.id === l.id)!.schedule = e.target.value as typeof l.schedule;
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
          <div className="island-actions">
            <button disabled={!l.enabled} onClick={() => follow(l.id)}>
              {following === l.id ? "Stop following" : "Follow vehicle"}
            </button>
            <button
              onClick={() =>
                mutate((s) => {
                  const line = s.mobility!.lines.find((a) => a.id === l.id)!;
                  line.enabled = !line.enabled;
                })
              }
            >
              {l.enabled ? "Pause service" : "Resume service"}
            </button>
            <button
              onClick={() =>
                mutate((s) => {
                  try {
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
                setMode(l.mode);
                setDepot(l.depot);
                setStops([...l.stops]);
                setEditing(l.id);
                setShowBuilder(true);
              }}
            >
              Edit route
            </button>
            {l.blocker && (
              <button onClick={() => onGrid(l.blocker![0], l.blocker![1], l.id)}>Show obstruction</button>
            )}
            <button
              onClick={() =>
                mutate((s) => {
                  s.mobility!.lines = s.mobility!.lines.filter((a) => a.id !== l.id);
                })
              }
            >
              Remove line
            </button>
          </div>
        </details>
      ))}
      {!!fleet.length && (
        <fieldset>
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
              <div className="island-actions">
                {(["sail", "recall", "moor"] as const).map((a) => (
                  <button key={a} onClick={() => mutate((s) => dispatchVessel(s, ship.id, a))}>
                    {a === "sail" ? "Patrol" : a === "recall" ? "Return to berth" : "Hold position"}
                  </button>
                ))}
                <button onClick={() => follow(ship.id)}>
                  {following === ship.id ? "Stop following" : "Follow ship"}
                </button>
              </div>
              <div className="island-actions">
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
              <div className="island-actions">
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
