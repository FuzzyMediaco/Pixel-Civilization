import { useState } from "react";
import {
  activeBlessing,
  bedsAt,
  BLESSINGS,
  faithServices,
  invokeBlessing,
  isSanctuary,
  rehouseResidents,
  type Blessing,
} from "../game/faith";
import { ELEMENT_BY_ID } from "../game/catalog";
import {
  pushToast,
  type GameState,
  type PlacedElement,
} from "../game/simulation";
import type { ChangeCity } from "./MobilityPanel";

export function FaithDetails({
  s,
  el,
  change,
}: {
  s: GameState;
  el: PlacedElement;
  change: ChangeCity;
}) {
  const [choice, setChoice] =
    useState<Exclude<Blessing, "protection">>("harvest");
  if (ELEMENT_BY_ID[el.defId]?.category !== "faith") return null;
  const service = faithServices(s),
    active = activeBlessing(s),
    temple = isSanctuary(el);
  return (
    <section className="island-content ui-insp-tab" aria-label="Faith and sanctuary">
      <div className="ui-panel-card">
        <div className="ui-card-head">
          <strong>Community services</strong>
          <span className="ui-card-sub">
            {el.connected && !el.onFire && !el.disrepair
              ? "Serving this community"
              : "Reconnect or restore to resume services"}
          </span>
        </div>
        <p className="ui-card-copy">
          Island-wide · +{service.happiness} happiness · −{service.crime} crime
          points · {Math.round(service.civicRelief * 100)}% less government
          demand · {Math.round(service.volunteerSupport * 100)}% faster
          firefighting.
        </p>
      </div>
      {temple && (
        <div className="ui-panel-card">
          <div className="ui-card-head">
            <strong>Temple sanctuary</strong>
            <span className="ui-card-sub">
              {bedsAt(el)} places here · {s.faith?.sheltered ?? 0} sheltered /{" "}
              {service.beds} island-wide
            </span>
          </div>
          {!!s.faith?.sheltered && (
            <>
              <p className="ui-card-copy">
                Connect enough safe homes for the people staying here, then help
                them move home.
              </p>
              <div className="ui-quick-links" style={{marginBottom: 6}}>
                <button
                  type="button"
                  className="ui-btn is-small is-primary"
                  onClick={() =>
                    change((st) => {
                      const moved = rehouseResidents(st);
                      pushToast(
                        st,
                        moved ? "stage" : "alert",
                        moved
                          ? "Residents returned home"
                          : "Housing still needed",
                        moved
                          ? moved + " people returned to safe homes."
                          : "End the invasion and connect enough safe housing for everyone in shelter.",
                      );
                    })
                  }
                >
                  Rehouse residents
                </button>
              </div>
            </>
          )}
          <p className="ui-card-copy">
            {active
              ? BLESSINGS[active].name +
                " · " +
                Math.ceil(s.faith!.active!.until - s.activePlaySec) +
                "s remaining. " +
                BLESSINGS[active].detail
              : "Quiet at the temple. Blessings sometimes begin while a connected temple is in service."}
          </p>
          {!!s.faith?.history.length && (
            <details style={{marginTop: 6}}>
              <summary>Recent blessings</summary>
              <ul>
                {s.faith.history.map((e, i) => (
                  <li key={i}>
                    {BLESSINGS[e.kind].name} ·{" "}
                    {Math.floor(Math.max(0, s.activePlaySec - e.at))}s ago
                  </li>
                ))}
              </ul>
            </details>
          )}
          {s.mode === "god" && (
            <div style={{marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--ui-line)"}}>
              <label className="ui-field">
                <span>Temple blessing</span>
                <select
                  className="ui-select"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value as typeof choice)}
                >
                  {Object.entries(BLESSINGS)
                    .filter(([k]) => k !== "protection")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="ui-quick-links" style={{marginTop: 6}}>
                <button
                  type="button"
                  className="ui-btn is-small"
                  disabled={!el.connected}
                  onClick={() =>
                    change((st) => {
                      const site = st.elements.find((e) => e.id === el.id);
                      if (site && invokeBlessing(st, site, choice))
                        pushToast(
                          st,
                          "stage",
                          BLESSINGS[choice].name,
                          BLESSINGS[choice].detail,
                        );
                    })
                  }
                >
                  Invoke blessing
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
