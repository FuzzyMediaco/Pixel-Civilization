import {VEHICLE_ROADS,roadWidth,standardRoadLanes,frontageWidth} from "../game/roadStandards";
import {streetLaneFactor} from "../game/terrain";
import {roadCapacity} from "../game/cityDynamics";
import { fireServiceReadiness } from "../game/projectOperations";
import React, { useEffect, useState } from "react";
import {
  ELEMENT_BY_ID,
  getMaxElementLevel,
  getStandardFootprintForLevel,

  STAGES,
} from "../game/catalog";
import {
  allocateWealth,
  buildingCharges,
  cityWealth,
  closeSites,
  CONTROLS,
  controlValue,
  economyOf,
  hasAuthority,
  isLocalControl,
  operational,
  releaseControl,
  setEconomicControl,
  siteOf,
  upgradeReadiness,
  wealthTiers,
  type ControlKey,
} from "../game/cityEconomy";
import { dispatchFire, igniteSite, operationsOf, requestProjectJourney } from "../game/projectOperations";
import {
  maintainElement,
  resizeElementForLevel,
  legacyRoadWidening,widenLegacyRoad,placedUpgradeCost,
  getTrafficLoadMap,
  upgradeElementDirect,
  type GameState,
  type PlacedElement,
} from "../game/simulation";
import { readWaterService } from "../game/terrain";
import { PROJECT_BY_ID, WEALTH_PROJECTS } from "../game/wealthProjects";

const n = (v: number) => Math.round(v).toLocaleString(),
  money = (v: number) => "$" + n(v),
  rate = (x: number) => x.toFixed(1);
export type EconomyTab = "population" | "happiness" | "wealth" | "site" | "safety" | "controls";
export interface EconomyPanelProps {
  state: GameState;
  mutate: (fn: (s: GameState) => void) => void;
  selected?: PlacedElement | null;
  onFocus?: (id: string) => void;
  initialPanel?: EconomyTab;
}
const titles: Record<EconomyTab, string> = {
  population: "People",
  happiness: "Wellbeing",
  wealth: "Accounts",
  site: "Selected site",
  safety: "Fire & safety",
  controls: "Experiments",
};
function Figures({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded border border-stone-300 bg-white p-2">
          <dt className="text-xs text-stone-600">{label}</dt>
          <dd className="font-bold text-stone-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function CityEconomyPanel({
  state: s,
  mutate,
  selected,
  onFocus,
  initialPanel = "wealth",
}: EconomyPanelProps) {
  const [tab, setTab] = useState<EconomyTab>(initialPanel),
    [message, setMessage] = useState(""),
    [key, setKey] = useState<ControlKey>("happiness"),
    [value, setValue] = useState("85"),
    [scope, setScope] = useState("site"),
    [allocation, setAllocation] = useState("5000"),
    [treasury, setTreasury] = useState("30"),
    [households, setHouseholds] = useState("40");
  useEffect(() => {
    setTab(initialPanel);
    setMessage("");
  }, [initialPanel]);
  const e = economyOf(s),
    r = e.report,
    m = s.metrics,
    op = operationsOf(s),
    site = selected,
    def = site && ELEMENT_BY_ID[site.defId],
    a = site && siteOf(s, site);
  const upcoming = wealthTiers().find((x) => x > e.peak),
    nextStage = STAGES[s.currentStage],
    total = cityWealth(s),
    authority = hasAuthority(s);
  const fireService = tab === "safety" ? fireServiceReadiness(s) : undefined;
  const scopeTargets = site
    ? scope === "district"
      ? s.elements.filter((x) => closeSites(x, site, 4) && !ELEMENT_BY_ID[x.defId]?.isNetwork)
      : [site]
    : [];
  const local = isLocalControl(key),
    scoped = local && site ? site.id : undefined;
  const calc = e.raw[scoped ? key + "@" + scoped : key] ?? controlValue(s, key, scoped);
  function setControl(hold: boolean) {
    mutate((st) => {
      if (local) {
        for (const target of scopeTargets) setEconomicControl(st, key, Number(value), hold, target.id);
      } else setEconomicControl(st, key, Number(value), hold);
    });
    setMessage(hold ? "Hold applied." : "Value applied for this experiment.");
  }
  const show = (el: PlacedElement, reason: string) => (
    <button key={el.id} onClick={() => onFocus?.(el.id)}>
      {ELEMENT_BY_ID[el.defId].name} · {el.gx}, {el.gz} · {reason}
    </button>
  );
  const trouble = s.elements.filter(
    (el) =>
      el.onFire ||
      el.disrepair ||
      !el.connected ||
      ((ELEMENT_BY_ID[el.defId]?.jobs ?? 0) > 0 && !(e.sites[el.id]?.workers ?? 0)),
  );
  const topPlaces = (els: PlacedElement[], label: (el: PlacedElement) => string) => (
    <div className="island-actions">{els.slice(0, 6).map((el) => show(el, label(el)))}</div>
  );
  const upgrade = site && upgradeReadiness(s, site),
    growth = site && def && site.level < getMaxElementLevel(site.defId);
  const next = site && def ? getStandardFootprintForLevel(def, Math.min(getMaxElementLevel(site.defId), site.level + 1)) : [1, 1];
  const widening=site&&roadWidth(site.defId)>1&&!site.roadAxis?legacyRoadWidening(s,site):undefined;
  const price = site && def && buildingCharges(s) ? placedUpgradeCost(s,site) : 0;
  const preview = site && growth ? { ...site } : undefined;
  const fits = preview && tab === "site" ? resizeElementForLevel(s, preview, preview.level + 1) : true;
  const runSite = (fn: (st: GameState, el: PlacedElement) => string) => {
    if (!site) return;
    mutate((st) => {
      const el = st.elements.find((x) => x.id === site.id);
      if (el) setMessage(fn(st, el));
    });
  };
  return (
    <div className="island-content">
      <nav className="island-actions" aria-label="City reports">
        {(Object.keys(titles) as EconomyTab[])
          .filter((t) => t !== "controls" || s.mode === "god")
          .map((t) => (
            <button
              key={t}
              aria-pressed={t === tab}
              onClick={() => {
                setTab(t);
                setMessage("");
              }}
            >
              {titles[t]}
            </button>
          ))}
      </nav>
      {tab === "wealth" && (
        <>
          <h3>City wealth · {money(total)}</h3>
          <p>
            {total >= e.previousDay ? "+" : "−"}
            {money(Math.abs(total - e.previousDay))} since the start of this island day. Construction draws from
            the treasury.
          </p>
          <Figures
            rows={[
              ["Treasury", money(s.money)],
              ["Household savings", money(e.households)],
              ["Business cash", money(e.businesses)],
              ["Highest city wealth", money(e.peak)],
            ]}
          />
          <h4>Project milestones</h4>
          {upcoming && <p>{money(Math.max(0, upcoming - e.peak))} to the next group.</p>}
          {wealthTiers().map((tier) => (
            <details key={tier} open={tier === upcoming || undefined}>
              <summary>
                {money(tier)} · {s.mode === "god" ? "Sandbox access" : e.peak >= tier ? "Unlocked" : "Upcoming"}
              </summary>
              <ul>
                {WEALTH_PROJECTS.filter((p) => p.wealthThreshold === tier).map((p) => (
                  <li key={p.id}>
                    <b>{p.name}</b> · {money(p.cost)}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <h4>Transactions</h4>
          {e.ledger.length ? (
            <ul>
              {e.ledger
                .slice(-10)
                .reverse()
                .map((entry, i) => (
                  <li key={i}>
                    <b>{entry.label}</b> · {money(entry.amount)} · {entry.from} → {entry.to}
                  </li>
                ))}
            </ul>
          ) : (
            <p>Trading, wages, spending and grant payments appear as the city operates.</p>
          )}
        </>
      )}
      {tab === "population" && (
        <>
          <h3>{n(s.population)} residents</h3>
          <p>
            Stage {s.currentStage} · {STAGES[s.currentStage - 1]?.name}
            {nextStage &&
              " · " + n(Math.max(0, nextStage.minPop - s.population)) + " residents to " + nextStage.name}
            .
          </p>
          <Figures
            rows={[
              ["Occupied / capacity", n(s.population) + " / " + n(r.capacity)],
              ["Working residents", n(r.workers)],
              ["Filled local jobs", n(Object.values(e.sites).reduce((sum, site) => sum + site.workers, 0))],
              ["Reachable jobs / all jobs", n(r.reachable) + " / " + n(r.jobs)],
              ["Skilled workers", n(r.skilled)],
              ["Wages per second", money(r.wages)],
            ]}
          />
          <h4>Local workplaces</h4>
          {topPlaces(
            s.elements
              .filter((el) => e.sites[el.id]?.jobs)
              .sort((a, b) => e.sites[b.id].jobs - e.sites[a.id].jobs),
            (el) => n(e.sites[el.id].workers) + " / " + n(e.sites[el.id].jobs) + " staff",
          )}
          {e.recovery > 0 && (
            <p role="alert">Population recovery has {n(360 - e.recovery)} active seconds remaining.</p>
          )}
        </>
      )}
      {tab === "happiness" && (
        <>
          <h3>Wellbeing · {n(s.happiness)}%</h3>
          <Figures
            rows={[
              ["Local food stock", rate(r.meals) + " meals"],
              ["Harvest per second", rate(r.harvest)],
              ["Imports per second", rate(r.imports)],
              ["Eaten / needed per second", rate(r.consumed) + " / " + rate(r.required)],
              ["Spoilage per second", rate(r.spoiled)],
              ["Potable from local works", n(r.potable)],
            ]}
          />
          <h4>What households need</h4>
          <ul>
            {s.diagnostics.slice(0, 7).map((d) => (
              <li key={d.id}>
                <b>{d.title}</b> · {d.fixHint}
              </li>
            ))}
          </ul>
          {topPlaces(trouble, (el) =>
            el.onFire
              ? "Fire call"
              : el.disrepair
                ? "Needs repair"
                : !el.connected
                  ? "Missing access"
                  : "No workers",
          )}
        </>
      )}
      {tab === "safety" && (
        <>
          <h3>Emergency service</h3>
          <p>
            {authority
              ? "Professional services authorized."
              : "A staffed City Office, Government Building, Courthouse or Tax Collecting Office authorizes professional crews."}
          </p>
          <Figures
            rows={[
              [
                "Routine fires",
                s.mode === "god"
                  ? (fireService!.chance ? "Sandbox risk enabled" : "Manual triggers")
                  : s.highestStageReached < 4
                    ? "At Boomtown"
                    : s.activePlaySec - (op.sinceBoom ?? s.activePlaySec) < 100
                      ? "Settling-in period"
                      : "Active",
              ],
              [
                "Active calls / completed",
                n(op.calls.filter((c) => !c.retiring).length) + " / " + n(op.rescued),
              ],
              [
                "Staffed fire stations",
                n(
                  s.elements.filter(
                    (el) =>
                      authority &&
                      operational(el) &&
                      !!ELEMENT_BY_ID[el.defId]?.fireRadius &&
                      siteOf(s, el).workers >= 1,
                  ).length,
                ),
              ],
              ["Fire crews / needed", fireService!.crews + " / " + fireService!.required],
              ["Sites in station range", Math.round(100 * fireService!.coverage) + "%"],
              ["Fire chance per check", Math.round(fireService!.chance) + "%"],
              ["Crime / defense", n(m.crimeRate) + "% / " + n(m.defenseRating) + "%"],
            ]}
          />
          {op.calls.map((c) => {
            const el = s.elements.find((x) => x.id === c.target);
            return (
              el && (
                <div key={c.target}>
                  {show(el, c.status)}
                  <p>
                    {c.kind} · {n(c.age)} s since call · {n(Math.max(0, c.path.length - 1 - c.travel))} tiles
                    remaining
                  </p>
                </div>
              )
            );
          })}
          {!op.calls.length && (
            <p>
              Crews need road or water access. Volunteers handle early emergencies. Professional engines draw
              water near the station or the incident.
            </p>
          )}
        </>
      )}
      {tab === "site" &&
        (site && def && a && upgrade ? (
          <>
            <h3>
              {def.name} · {PROJECT_BY_ID[site.defId]?.levels[site.level - 1] ?? "Level " + site.level}
            </h3>
            <p>
              {site.gx}, {site.gz} · {site.spanX} × {site.spanZ} tiles ·{" "}
              {operational(site)
                ? "Operating"
                : site.onFire
                  ? "On fire"
                  : site.disrepair
                    ? "Awaiting repairs"
                    : "Needs access"}
            </p>
            {VEHICLE_ROADS.has(site.defId)?<>
              <h4>Street operations</h4>
              <Figures rows={[
                ["Capacity",Math.round(4*roadCapacity(def,site.level)*streetLaneFactor(s,site))+" traversals/hour"],
                ["Current demand",Math.round((getTrafficLoadMap(s).get(site.gx+","+site.gz)??0)*4*roadCapacity(def,site.level)*streetLaneFactor(s,site))+" traversals/hour"],
                ["Capacity used",Math.round(100*(getTrafficLoadMap(s).get(site.gx+","+site.gz)??0))+"%"],
                ["Lane allocation",(s.infrastructure?.streets[site.gx+","+site.gz]?.lanes??standardRoadLanes(site.defId,site.level))+" lanes"],
              ]}/>
              <p>{site.roadAxis?frontageWidth(site.defId):"One-tile street"} · {(getTrafficLoadMap(s).get(site.gx+","+site.gz)??0)>1?"Upgrade this bottleneck, add a parallel route or link busy origins with transit.":"Traffic uses connected origin and destination gates. Compare the load here with adjoining streets."}</p>
              {widening&&<><button disabled={Boolean(widening.reason)} onClick={()=>runSite((st,el)=>{const outcome=widenLegacyRoad(st,el);return outcome.ok?"Carriageway widened.":outcome.reason??"Unavailable.";})}>Widen existing carriageway · {money(widening.cost)}</button>{widening.reason&&<p>{widening.reason}</p>}</>}
            </>:<Figures
              rows={[
                ["Staff", n(a.workers) + " / " + n(a.jobs)],
                site.defId === "rainwater_cathedral"
                  ? ["Cistern reserve", rate(a.cistern ?? 0)]
                  : ["Food in store", rate(a.food)],
                ["Farm water", rate(readWaterService(s, site).irrigation)],
                ["Produced / served", n(a.harvested) + " / " + n(a.served)],
              ]}
            />}
            {growth && (
              <fieldset>
                <legend>Upgrade · {money(price)}</legend>
                <p>
                  {VEHICLE_ROADS.has(site.defId)?"Next stage adds capacity and street equipment.":<>{upgrade.label} · {rate(upgrade.value)} / {upgrade.goal} · {next.join(" × ")} tiles.</>}
                </p>
                {preview && fits && !def.isNetwork && (
                  <p>
                    Expansion from {preview.gx}, {preview.gz} · {preview.spanX} × {preview.spanZ}.
                  </p>
                )}
                {!fits && <p>Clear a neighboring {next.join(" × ")} footprint.</p>}

                {upgrade.reasons.map((x) => (
                  <p key={x}>{x}</p>
                ))}
                <button
                  disabled={!upgrade.ready || !fits || price > s.money}
                  onClick={() =>
                    runSite((st, el) => {
                      const result = upgradeElementDirect(st, el.id);
                      return result.ok ? "Upgraded." : (result.reason ?? "Check this site.");
                    })
                  }
                >
                  Upgrade to level {site.level + 1}
                </button>
              </fieldset>
            )}
            {op.status[site.id] && (
              <p>
                Journey · {op.status[site.id]} · {op.completed[site.id] ?? 0} completed.
              </p>
            )}
            <div className="island-actions">
              {["regional_airport", "spaceport", "teleportation_depot", "flying_car_depot"].includes(
                site.defId,
              ) && (
                <button
                  onClick={() =>
                    runSite((st, el) =>
                      requestProjectJourney(st, el.id) ? "Journey dispatched." : operationsOf(st).status[el.id],
                    )
                  }
                >
                  Dispatch journey
                </button>
              )}
              {site.onFire && (
                <button
                  onClick={() =>
                    runSite((st, el) =>
                      dispatchFire(st, el.id) ? "Crew dispatched." : "Waiting for a reachable crew.",
                    )
                  }
                >
                  Dispatch fire crew
                </button>
              )}
              {site.disrepair && !site.onFire && (
                <button
                  onClick={() =>
                    runSite((st, el) => (maintainElement(st, el.id) ? "Site reopened." : "Repair unavailable."))
                  }
                >
                  Repair and reopen
                </button>
              )}
              {s.mode === "god" && <button onClick={() => setTab("controls")}>Experiment here</button>}
            </div>
          </>
        ) : (
          <p>Choose a building on the island to inspect its operations and next upgrade.</p>
        ))}
      {tab === "controls" && s.mode === "god" && (
        <>
          <h3>God controls</h3>
          <fieldset>
            <legend>Experiment with a value</legend>
            <label>
              Control
              <select
                value={key}
                onChange={(ev) => {
                  const k = ev.target.value as ControlKey;
                  setKey(k);
                  setValue(String(Math.round(controlValue(s, k, isLocalControl(k) ? site?.id : undefined))));
                }}
              >
                {Object.entries(CONTROLS).map(([id, c]) => (
                  <option key={id} value={id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {local ? (
              <label>
                Scope
                <select value={scope} onChange={(ev) => setScope(ev.target.value)}>
                  <option value="site">Selected site</option>
                  <option value="district">District within four tiles</option>
                </select>
              </label>
            ) : (
              <p>Scope · Island</p>
            )}
            {local && !site && <p>Choose the center site on the map.</p>}
            <label>
              Value
              <input
                type="number"
                min={CONTROLS[key].min}
                max={CONTROLS[key].max}
                value={value}
                onChange={(ev) => setValue(ev.target.value)}
              />
            </label>
            <p>Calculated · {rate(calc)}</p>
            <div className="island-actions">
              <button disabled={(local && !site) || value === ""} onClick={() => setControl(false)}>
                Set once
              </button>
              <button disabled={(local && !site) || value === ""} onClick={() => setControl(true)}>
                Hold
              </button>
            </div>
          </fieldset>
          <details>
            <summary>Allocate total city wealth</summary>
            <label>
              Total $
              <input type="number" value={allocation} onChange={(ev) => setAllocation(ev.target.value)} />
            </label>
            <label>
              Treasury %
              <input
                type="number"
                min={0}
                max={100}
                value={treasury}
                onChange={(ev) => setTreasury(ev.target.value)}
              />
            </label>
            <label>
              Households %
              <input
                type="number"
                min={0}
                max={100 - Number(treasury)}
                value={households}
                onChange={(ev) => setHouseholds(ev.target.value)}
              />
            </label>
            <p>Businesses receive {Math.max(0, 100 - Number(treasury) - Number(households))}%.</p>
            <div className="island-actions">
              {[false, true].map((hold) => (
                <button
                  key={String(hold)}
                  disabled={Number(allocation) < 0 || Number(treasury) + Number(households) > 100}
                  onClick={() =>
                    mutate((st) =>
                      allocateWealth(st, Number(allocation), Number(treasury), Number(households), hold),
                    )
                  }
                >
                  {hold ? "Hold allocation" : "Set allocation"}
                </button>
              ))}
            </div>
          </details>
          <fieldset>
            <legend>Active holds · {e.holds.length}</legend>
            {e.holds.map((h) => (
              <button
                key={h.key + (h.site ?? "")}
                onClick={() => mutate((st) => releaseControl(st, h.key, h.site))}
              >
                {CONTROLS[h.key].label} · {n(h.value)}
                {h.site ? " · " + h.site : ""} · Release
              </button>
            ))}
            {e.holds.length > 0 && (
              <button onClick={() => mutate((st) => releaseControl(st))}>Release all holds</button>
            )}
          </fieldset>
          {site && (
            <fieldset>
              <legend>Trigger · {def?.name}</legend>
              <div className="island-actions">
                <button
                  onClick={() =>
                    runSite((st, el) =>
                      igniteSite(st, el.id) ? "Fire started." : "Choose a building that can burn.",
                    )
                  }
                >
                  Start fire
                </button>
                <button
                  onClick={() =>
                    runSite((st, el) => {
                      el.onFire = false;
                      return "Fire cleared.";
                    })
                  }
                >
                  Clear fire
                </button>
                <button
                  onClick={() =>
                    runSite((st, el) =>
                      dispatchFire(st, el.id)
                        ? "Crew dispatched."
                        : "Awaiting an active call and accessible crew.",
                    )
                  }
                >
                  Dispatch crew
                </button>
              </div>
            </fieldset>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
