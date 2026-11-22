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
type ParcelSide = (typeof PARCEL_SIDES)[number];

const SIDE_LABELS: Record<ParcelSide, string> = {
  back: "Back edge",
  right: "Right edge",
  front: "Front edge",
  left: "Left edge",
};

function CarAccess({city, site}: {city: GameState; site: PlacedElement}) {
  const def = ELEMENT_BY_ID[site.defId];
  const isStreet = Boolean(def.isRoadNetwork && !PEDESTRIAN_IDS.has(def.id) && !site.pedestrianDeck);
  if (!isStreet && (def.isNetwork || def.passiveNature || def.domain === "water")) return null;
  const network = getRoadTripNetwork(city);
  const route = isStreet
    ? network.routes.find(trip => trip.path.some(([x,z]) => x === site.gx && z === site.gz))
    : network.routes.find(trip => trip.origin.siteId === site.id || trip.destination.siteId === site.id);
  if (!route) {
    return (
      <div className="ui-panel-card">
        <div className="ui-card-head">
          <strong>Car access</strong>
        </div>
        <p className="ui-card-copy">
          {isStreet
            ? "No car trips use this tile. Join two building entrances with a continuous drivable street."
            : "No car trips reach this site. Connect its entrance to a second building by local street."}
        </p>
      </div>
    );
  }
  const describe = (id: string) => {
    const stop = city.elements.find(el => el.id === id)!;
    return ELEMENT_BY_ID[stop.defId].name + " (" + stop.gx + ", " + stop.gz + ")";
  };
  return (
    <div className="ui-panel-card">
      <div className="ui-card-head">
        <strong>Active car route</strong>
      </div>
      <p className="ui-card-copy">{describe(route.origin.siteId)} → {describe(route.destination.siteId)}</p>
    </div>
  );
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
  if (!el) return <p className="ui-muted">Tap a building or vessel on the island to inspect its neighbors.</p>;
  const edges = getParcelEdges(el, buildOccupancyMap(s.elements), s);
  const lighting = el.exteriorLighting ?? "auto";
  return (
    <div className="island-content ui-insp-tab">
      <p className="ui-site-meta">
        Lv {el.level} · Style {String.fromCharCode(65 + el.variant)} · {el.spanX}×{el.spanZ} tiles · Plot ({el.gx}, {el.gz})
      </p>
      <CarAccess city={s} site={el} />
      <FaithDetails s={s} el={el} change={change} />
      <ExpansionDetails s={s} el={el} />
      {edges.length ? (
        <div className="ui-panel-card">
          <div className="ui-card-head">
            <strong>Shared edges ({edges.length})</strong>
          </div>
          <ul className="ui-edge-list">
            {edges.map((e, i) => (
              <li key={i}>
                <b>{SIDE_LABELS[e.side] ?? e.side}</b>
                <span>{EDGE_LABELS[e.kind]} · {ELEMENT_BY_ID[e.neighbor]?.name ?? e.neighbor}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ui-muted">No adjacent neighbors yet. Any road placed beside a building links automatically.</p>
      )}
      <div className="ui-quick-links">
        <button type="button" className="ui-btn is-small" onClick={() => go("info")}>Services &amp; upgrade</button>
        <button type="button" className="ui-btn is-small" onClick={() => go("transit")}>Transit nearby</button>
        <button type="button" className="ui-btn is-small" onClick={() => go("works")}>Land &amp; water</button>
      </div>
      {s.mode === "god" && (
        <div className="ui-panel-card">
          <div className="ui-card-head">
            <strong>Site lighting</strong>
            <span className="ui-card-sub">Roads link automatically to neighbors</span>
          </div>
          <div className="ui-field-block">
            <span className="ui-field-label">Exterior lighting</span>
            <div className="ui-seg-bar" role="group" aria-label="Exterior lighting">
              {([
                ["auto", "City clock"],
                ["lit", "Always lit"],
                ["dark", "Keep dark"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  aria-pressed={lighting === val}
                  onClick={() => {
                    change((st) => {
                      st.elements.find((e) => e.id === el.id)!.exteriorLighting = val;
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
    <div className="island-content ui-insp-tab">
      <div className="ui-panel-card">
        <div className="ui-card-head">
          <strong>Simulation &amp; travel</strong>
        </div>
        <div className="ui-quick-links">
          <button type="button" className="ui-btn is-small" onClick={onStep}>Step one second</button>
        </div>
        <label className="ui-field" style={{marginTop: 8}}>
          <span>Island travel demand ×</span>
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
      </div>
      <div className="ui-panel-card">
        <div className="ui-card-head">
          <strong>Local experiment</strong>
        </div>
        <label className="ui-field">
          <span>Scope</span>
          <select className="ui-select" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="island">Whole island</option>
            <option value="district">Around selected site</option>
            <option value="item">Selected site</option>
          </select>
        </label>
        {scope === "district" && (
          <label className="ui-field">
            <span>District radius · {radius} tiles</span>
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
          <p className="ui-card-meta">{el ? ELEMENT_BY_ID[el.defId].name + " at (" + el.gx + ", " + el.gz + ")" : "Select a site on the map."}</p>
        )}
        <label className="ui-field">
          <span>Action</span>
          <select className="ui-select" value={effect} onChange={(e) => setEffect(e.target.value)}>
            <option value="light">Hold exterior lights on</option>
            <option value="dark">Hold exterior lights off</option>
            <option value="auto">Resume automatic lighting</option>
            <option value="ignite">Start a fire</option>
            <option value="restore">Extinguish and repair</option>
          </select>
        </label>
        <div className="ui-quick-links" style={{marginTop: 8}}>
          <button type="button" className="ui-btn is-small is-primary" disabled={!scopeAllowed} onClick={apply}>
            Apply to scope
          </button>
        </div>
      </div>
      <div className="ui-panel-card">
        <div className="ui-card-head">
          <strong>Experiment snapshots</strong>
          <span className="ui-card-sub">Canal district auto-saves your sandbox first</span>
        </div>
        <div className="ui-quick-links">
          <button type="button" className="ui-btn is-small" onClick={onSave}>Save snapshot</button>
          <button type="button" className="ui-btn is-small" disabled={!canRestore} onClick={onRestore}>
            Restore snapshot
          </button>
          <button type="button" className="ui-btn is-small" onClick={onDistrict}>Explore canal district</button>
        </div>
      </div>
      {message && <p className="ui-card-meta" role="status">{message}</p>}
    </div>
  );
}
