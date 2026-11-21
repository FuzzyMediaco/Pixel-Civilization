import { ExpansionDetails } from "./ExpansionDetails";
import { FaithDetails } from "./FaithDetails";
import React, { useState } from "react";
import { ELEMENT_BY_ID } from "../game/catalog";
import { buildOccupancyMap, PEDESTRIAN_IDS, type GameState, type PlacedElement } from "../game/simulation";
import { getParcelEdges, PARCEL_SIDES, EDGE_LABELS } from "../game/parcelEdges";
import { getRoadTripNetwork } from "../game/roadTraffic";
import { mobilityOf } from "../game/mobility";
import { igniteSite } from "../game/projectOperations";
import type { ChangeCity } from "./MobilityPanel";
export type LinkTarget = "info" | "transit" | "works";
function CarAccess({city, site}: {city: GameState; site: PlacedElement}) {
  const def = ELEMENT_BY_ID[site.defId];
  const isStreet = Boolean(def.isRoadNetwork && !PEDESTRIAN_IDS.has(def.id) && !site.pedestrianDeck);
  if (!isStreet && (def.isNetwork || def.passiveNature || def.domain === "water")) return null;
  const network = getRoadTripNetwork(city);
  const route = isStreet
    ? network.routes.find(trip => trip.path.some(([x,z]) => x === site.gx && z === site.gz))
    : network.routes.find(trip => trip.origin.siteId === site.id || trip.destination.siteId === site.id);
  if (!route) {
    return <p><b>Car access</b> · {isStreet
      ? "No car trips use this tile. Join two building entrances with a continuous drivable street."
      : "No car trips reach this site. Connect its entrance to a second building by local street."}</p>;
  }
  const describe = (id: string) => {
    const stop = city.elements.find(el => el.id === id)!;
    return ELEMENT_BY_ID[stop.defId].name + " (" + stop.gx + ", " + stop.gz + ")";
  };
  return <p><b>Car route</b> · {describe(route.origin.siteId)} → {describe(route.destination.siteId)}</p>;
}
export function Connections({
  s,
  el,
  change,
  go,
}: {
  s: GameState;
  el?: PlacedElement;
  change: ChangeCity;
  go: (tab: LinkTarget) => void;
}) {
  if (!el) return <p>Tap a building or vessel on the island to inspect its neighbors.</p>;
  const d = ELEMENT_BY_ID[el.defId],
    edges = getParcelEdges(el, buildOccupancyMap(s.elements), s);
  return (
    <div className="island-content">
      <h3>{d.name}</h3>
      <p>
        Level {el.level} · Style {String.fromCharCode(65 + el.variant)} · {el.spanX} × {el.spanZ} tiles · {el.gx},{" "}
        {el.gz}
      </p>
      <CarAccess city={s} site={el} />
      <FaithDetails s={s} el={el} change={change} />
      <ExpansionDetails s={s} el={el} />
      {edges.length ? (
        <ul>
          {edges.map((e, i) => (
            <li key={i}>
              <b>{e.side}</b> · {EDGE_LABELS[e.kind]} · {ELEMENT_BY_ID[e.neighbor]?.name ?? e.neighbor}
            </li>
          ))}
        </ul>
      ) : (
        <p>No shared edge here yet. Place a compatible neighbor or connect the front entrance.</p>
      )}
      <div className="island-actions">
        <button onClick={() => go("info")}>Services &amp; upgrade</button>
        <button onClick={() => go("transit")}>Transit nearby</button>
        <button onClick={() => go("works")}>Land &amp; water here</button>
      </div>
      {s.mode === "god" && (
        <fieldset>
          <legend>Site controls</legend>
          {PARCEL_SIDES.map((side) => (
            <label key={side}>
              {side} edge
              <select
                value={el.edgeOverrides?.[side] ?? "auto"}
                onChange={(ev) => {
                  const value = ev.target.value as "auto" | "open" | "closed";
                  change((st) => {
                    const site = st.elements.find((e) => e.id === el.id)!;
                    site.edgeOverrides = { ...site.edgeOverrides, [side]: value };
                  });
                }}
              >
                <option value="auto">Match neighbors</option>
                <option value="open">Open connection</option>
                <option value="closed">Keep boundary</option>
              </select>
            </label>
          ))}
          <label>
            Exterior lighting
            <select
              value={el.exteriorLighting ?? "auto"}
              onChange={(ev) => {
                const value = ev.target.value as "auto" | "dark" | "lit";
                change((st) => {
                  st.elements.find((e) => e.id === el.id)!.exteriorLighting = value;
                });
              }}
            >
              <option value="auto">Follow the city clock</option>
              <option value="lit">Always lit</option>
              <option value="dark">Keep dark</option>
            </select>
          </label>
        </fieldset>
      )}
    </div>
  );
}
interface GodProps {
  s: GameState;
  el?: PlacedElement;
  change: ChangeCity;
  onSave: () => void;
  onRestore: () => void;
  canRestore: boolean;
  onStep: () => void;
  onDistrict: () => void;
}
export function GodControls({
  s,
  el,
  change,
  onSave,
  onRestore,
  canRestore,
  onStep,
  onDistrict,
}: GodProps) {
  const [scope, setScope] = useState<"island" | "district" | "item">("island"),
    [radius, setRadius] = useState(4);
  const [effect, setEffect] = useState("light"),
    [message, setMessage] = useState("");
  const scopeAllowed = scope === "island" || Boolean(el);
  function apply() {
    if (!scopeAllowed) return;
    change((state) => {
      const sites = state.elements.filter(
        (e) =>
          scope === "island" ||
          (el && (scope === "item" ? e.id === el.id : Math.hypot(e.gx - el.gx, e.gz - el.gz) <= radius)),
      );
      let firesStarted = 0;
      for (const e of sites) {
        if (effect === "light" || effect === "dark" || effect === "auto")
          e.exteriorLighting = effect === "light" ? "lit" : effect;
        if (effect === "restore") {
          e.disrepair = false;
          e.onFire = false;
          e.maintTimerSec = 0;
        }
        if (effect === "ignite" && igniteSite(state, e.id)) firesStarted++;
      }
      setMessage(effect === "ignite"
        ? firesStarted ? "Started fire at " + firesStarted + (firesStarted === 1 ? " site." : " sites.")
          : sites.length === 1 && sites[0].defId === "lds_temples" ? "This temple shelters residents and is protected from fire."
          : "No selected building can catch fire here."
        : sites.length + " selected sites updated.");
    });
  }
  return (
    <div className="island-content">
      <div className="island-actions">
        <button onClick={onStep}>Step one second</button>
      </div>
      <fieldset>
        <legend>Travel</legend>
        <label>
          Island travel demand ×
          <input
            type="number"
            min="0"
            max="20"
            step=".25"
            value={s.mobility?.demand ?? 1}
            onChange={(e) => {
              const demand = Math.max(0, Math.min(20, Number(e.target.value)));
              change((st) => {
                mobilityOf(st).demand = demand;
              });
            }}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>Local experiment</legend>
        <label>
          Scope
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="island">Whole island</option>
            <option value="district">Around selected site</option>
            <option value="item">Selected site</option>
          </select>
        </label>
        {scope === "district" && (
          <label>
            District radius · {radius} tiles
            <input
              type="range"
              min="1"
              max="16"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </label>
        )}
        {scope !== "island" && (
          <p>{el ? ELEMENT_BY_ID[el.defId].name + " at " + el.gx + ", " + el.gz : "Select a site on the map."}</p>
        )}
        <label>
          Action
          <select value={effect} onChange={(e) => setEffect(e.target.value)}>
            <option value="light">Hold exterior lights on</option>
            <option value="dark">Hold exterior lights off</option>
            <option value="auto">Resume automatic lighting</option>
            <option value="ignite">Start a fire</option>
            <option value="restore">Extinguish and repair</option>
          </select>
        </label>
        <button disabled={!scopeAllowed} onClick={apply}>
          Apply to scope
        </button>
      </fieldset>
      <fieldset>
        <legend>Experiment snapshots</legend>
        <div className="island-actions">
          <button onClick={onSave}>Save sandbox snapshot</button>
          <button disabled={!canRestore} onClick={onRestore}>
            Restore last snapshot
          </button>
          <button onClick={onDistrict}>Explore the canal district</button>
        </div>
        <p>The canal district saves your current sandbox as a snapshot first.</p>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
