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
    <section className="island-content" aria-label="Faith and sanctuary">
      <h4>Community services</h4>
      <p>
        {el.connected && !el.onFire && !el.disrepair
          ? "Serving this community"
          : "Reconnect or restore this site to resume services."}
      </p>
      <p>
        Island-wide · +{service.happiness} happiness · −{service.crime} crime
        points · {Math.round(service.civicRelief * 100)}% less demand for
        government services · {Math.round(service.volunteerSupport * 100)}%
        faster firefighting.
      </p>
      {temple && (
        <>
          <h4>Temple sanctuary</h4>
          <p>
            {bedsAt(el)} emergency places here. {s.faith?.sheltered ?? 0}{" "}
            residents sheltered across {service.beds} places island-wide.
          </p>
          {!!s.faith?.sheltered && (
            <>
              <p>
                Connect enough safe homes for the people staying here, then help
                them move home.
              </p>
              <button
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
            </>
          )}
          <p>
            {active
              ? BLESSINGS[active].name +
                " · " +
                Math.ceil(s.faith!.active!.until - s.activePlaySec) +
                "s remaining. " +
                BLESSINGS[active].detail
              : "Quiet at the temple. Blessings sometimes begin while a connected temple is in service."}
          </p>
          {!!s.faith?.history.length && (
            <details>
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
            <fieldset>
              <legend>God controls</legend>
              <label>
                Temple blessing{" "}
                <select
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
              <button
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
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
