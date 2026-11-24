import {VEHICLE_ROADS,roadWidth,standardRoadLanes,frontageWidth} from "../game/roadStandards";
import {streetLaneFactor} from "../game/terrain";
import {roadCapacity} from "../game/cityDynamics";
import { fireServiceReadiness } from "../game/projectOperations";
import React, { useEffect, useState } from "react";
import {
  CATEGORY_META,
  ELEMENT_BY_ID,
  getMaxElementLevel,
  getStandardFootprintForLevel,
  type CivElementDef,
  STAGES,
} from "../game/catalog";
import { levelMultiplier, scaledRadius } from "../game/levelScaling";
import { isFarmPiece } from "../game/farmNetworks";
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
  stagePopulationThreshold,
  upgradeReadiness,
  wealthTiers,
  type ControlKey,
  type SiteAccount,
} from "../game/cityEconomy";
import { dispatchFire, igniteSite, operationsOf, requestProjectJourney } from "../game/projectOperations";
import {
  maintainElement,
  resizeElementForLevel,
  legacyRoadWidening, widenLegacyRoad, placedUpgradeCost,
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
  mutate: (fn: (s: GameState) => void, buildingEdit?: string) => void;
  selected?: PlacedElement | null;
  onFocus?: (id: string) => void;
  initialPanel?: EconomyTab;
  /** True inside InspectorSheet so site title and top upgrade button are not duplicated. */
  compactSite?: boolean;
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
    <dl className="ui-stat-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="ui-stat-box">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const DOMAIN_LABELS: Record<string, string> = {
  land: "Land",
  water: "Open water",
  coast_or_water: "Coast or water",
  any: "Any terrain",
};

function buildSiteSpecificRows(
  s: GameState,
  site: PlacedElement,
  def: CivElementDef,
  a: SiteAccount,
): { rows: [string, string][]; utilityLine: string | null } {
  const lv = site.level;
  const out = levelMultiplier("output", lv);
  const draw = levelMultiplier("draw", lv);
  const rows: [string, string][] = [];
  const push = (label: string, val: string) => {
    if (!rows.some(([l]) => l === label)) rows.push([label, val]);
  };

  const farm = isFarmPiece(site.defId) || site.defId === "irrigation_pond" || site.defId === "feed_silo" || def.category === "agriculture";
  const eduCampus =
    (def.category === "civic_parks" && (def.education ?? 0) > 0) ||
    site.defId === "school" ||
    site.defId === "university" ||
    site.defId === "research_institute" ||
    site.defId === "sports_field" ||
    site.defId === "research_university";

  // 1. Housing
  if (def.popBase) {
    push("Housing capacity", n(def.popBase * out) + " residents");
    if (site.landValue !== undefined) push("Land value", site.landValue.toFixed(2));
    if (def.power) push("Power draw", n(Math.abs(def.power) * draw));
    if (def.water) push("Water draw", n(Math.abs(def.water) * draw));
    if (a.jobs > 0) push("Staff", n(a.workers) + " / " + n(a.jobs));
    if (a.food > 0.05) push("Food stored", rate(a.food));
  }
  // 2. Farms, orchards, irrigation & food producers
  else if (farm) {
    if (site.defId === "irrigation_pond") {
      push("Cistern reserve", rate(a.cistern ?? 0));
      push("Water supplied", rate(a.irrigationOut ?? 0) + "/s");
    } else {
      const cropOut = (def.food ?? 0) * levelMultiplier("crop", lv);
      push("Harvest output", a.yieldRate > 0 ? rate(a.yieldRate) + "/s" : cropOut > 0 ? "+" + n(cropOut) : "Support module");
      push("Farm water", rate(readWaterService(s, site).irrigation) + "/s");
    }
    if (a.jobs > 0 || (def.jobs ?? 0) > 0) push("Staff", n(a.workers) + " / " + n(a.jobs));
    if (a.harvested > 0 || a.served > 0 || a.food > 0.05) {
      push("Stored / harvested", rate(a.food) + " · " + n(a.harvested));
    }
  }
  // 3. Education & Research Campuses
  else if (eduCampus) {
    push("Attending", n(a.attendees));
    if (a.jobs > 0 || (def.jobs ?? 0) > 0) push("Staff", n(a.workers) + " / " + n(a.jobs));
    if (def.education) push("Education output", "+" + n(def.education * out));
    if (def.recreation) push("Campus recreation", "+" + n(def.recreation * out));
    if (def.income) push("Research income", money(def.income * out) + "/s");
    if (site.landValue !== undefined) push("Land value", site.landValue.toFixed(2));
  }
  // 4. Police, Fire, Military & Civic Government
  else if (def.fireRadius || def.policeRadius || def.police || def.military || def.government) {
    if (a.jobs > 0 || (def.jobs ?? 0) > 0) push("Crew / staff", n(a.workers) + " / " + n(a.jobs));
    if (def.fireRadius) push("Fire radius", n(scaledRadius(def.fireRadius, lv)) + " tiles");
    if (def.policeRadius) push("Patrol radius", n(scaledRadius(def.policeRadius, lv)) + " tiles");
    if (def.police) push("Policing power", "+" + n(def.police * out));
    if (def.military) push("Defense rating", "+" + n(def.military * out));
    if (def.government) push("Civic reach", "+" + n(def.government * out));
    if (site.landValue !== undefined) push("Land value", site.landValue.toFixed(2));
  }
  // 5. Power, Water & Waste Utilities
  else if ((def.power ?? 0) > 0 || (def.water ?? 0) > 0 || (def.waste ?? 0) > 0 || site.defId === "rainwater_cathedral") {
    if (def.power && def.power > 0) push("Power output", "+" + n(def.power * out));
    if (def.water && def.water > 0) push("Water output", "+" + n(def.water * out));
    if (def.waste && def.waste > 0) push("Waste capacity", "+" + n(def.waste * out));
    if (site.defId === "rainwater_cathedral") push("Cistern reserve", rate(a.cistern ?? 0));
    if (a.jobs > 0 || (def.jobs ?? 0) > 0) push("Staff", n(a.workers) + " / " + n(a.jobs));
    if (def.nuisanceRadius) push("Pollution radius", n(scaledRadius(def.nuisanceRadius, lv)) + " tiles");
    if (site.landValue !== undefined) push("Land value", site.landValue.toFixed(2));
  }
  // 6. Commerce, Maritime, Faith, Parks, Landmarks, Rail & Nature
  else {
    if (a.jobs > 0 || (def.jobs ?? 0) > 0) push("Staff", n(a.workers) + " / " + n(a.jobs));
    if ((def.food ?? 0) > 0 || a.food > 0.05 || a.served > 0) {
      push("Food stock / served", rate(a.food) + " · " + n(a.served));
    }
    if (a.spending && a.spending > 0) push("Spending absorbed", money(a.spending) + "/s");
    else if (def.income && def.income > 0) push(def.category === "landmarks" ? "Tourism income" : "Site income", money(def.income * out) + "/s");
    if (def.recreation) push(def.category === "landmarks" ? "Visitor draw" : "Park / recreation", "+" + n(def.recreation * out));
    if (def.education) push("Education bonus", "+" + n(def.education * out));
    if (def.category === "faith") push("Faith service", elConnectedLabel(site));
    if (def.nuisanceRadius) push("Noise / smog radius", n(scaledRadius(def.nuisanceRadius, lv)) + " tiles");
    if (site.landValue !== undefined && !def.isNetwork && !def.passiveNature) {
      push("Land value", site.landValue.toFixed(2));
    }
  }

  // Ensure every element type (even purely decorative trees, parks, rail tracks, boats) shows meaningful info
  if (rows.length < 2) {
    const cat = CATEGORY_META.find((c) => c.id === def.category)?.label ?? def.category;
    push("Category", cat);
    push("Stage unlock", "Stage " + def.stage);
    push("Placement domain", DOMAIN_LABELS[def.domain] ?? def.domain);
    push("Build cost", def.cost > 0 ? money(def.cost) : "Free");
  }

  const utilParts: string[] = [];
  if ((def.power ?? 0) < 0 && !rows.some(([l]) => l === "Power draw")) {
    utilParts.push("Power −" + n(Math.abs(def.power!) * draw));
  }
  if ((def.water ?? 0) < 0 && !rows.some(([l]) => l === "Water draw")) {
    utilParts.push("Water −" + n(Math.abs(def.water!) * draw));
  }
  if (def.jobs && def.jobs > 0 && def.popBase) {
    utilParts.push("Jobs +" + n(def.jobs * out));
  }
  if (site.pollution && site.pollution > 0) {
    utilParts.push("Local pollution " + site.pollution.toFixed(1));
  }

  return { rows: rows.slice(0, 6), utilityLine: utilParts.length ? utilParts.join(" · ") : null };
}

function elConnectedLabel(site: PlacedElement): string {
  if (site.onFire) return "On fire";
  if (site.disrepair) return "Needs repair";
  return site.connected ? "Active sanctuary" : "Needs road access";
}
export function CityEconomyPanel({
  state: s,
  mutate,
  selected,
  onFocus,
  initialPanel = "wealth",
  compactSite = false,
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
  const runSite = (fn: (st: GameState, el: PlacedElement) => string, buildingEdit?: string) => {
    if (!site) return;
    mutate((st) => {
      const el = st.elements.find((x) => x.id === site.id);
      if (el) setMessage(fn(st, el));
    }, buildingEdit);
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
              " · " + n(Math.max(0, stagePopulationThreshold(s,nextStage.minPop) - s.population)) + " residents to " + nextStage.name}
            .
          </p>
          <Figures
            rows={[
              ...(s.metrics.populationLimiter?.cap
                ? [["Room for", n(s.metrics.populationLimiter.cap) + " · limited by " + ({housing:"homes",jobs:"jobs",food:"food",waste:"waste",water:"water",power:"power"} as Record<string,string>)[s.metrics.populationLimiter.limitingNeed]] as [string, string]]
                : []),
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
        (site && def && a && upgrade ? (() => {
          const specific = VEHICLE_ROADS.has(site.defId) ? null : buildSiteSpecificRows(s, site, def, a);
          const statusLabel = operational(site)
            ? "Operating"
            : site.onFire
              ? "On fire"
              : site.disrepair
                ? "Awaiting repairs"
                : def.passiveNature || def.isNetwork
                  ? "Placed"
                  : "Needs road access";
          const catLabel = CATEGORY_META.find((c) => c.id === def.category)?.label ?? def.category;
          return (
            <div className="ui-insp-tab">
              {!compactSite && (
                <h3>
                  {def.name} · {PROJECT_BY_ID[site.defId]?.levels[site.level - 1] ?? "Level " + site.level}
                </h3>
              )}
              <p className="ui-site-meta">
                Plot ({site.gx}, {site.gz}) · {site.spanX}×{site.spanZ} tiles · {catLabel} · Stage {def.stage} · {statusLabel}
              </p>
              {def.description && <p className="ui-site-desc">{def.description}</p>}
              {VEHICLE_ROADS.has(site.defId) ? (
                <>
                  <div className="ui-card-head" style={{marginBottom: 6}}>
                    <strong>Street operations</strong>
                  </div>
                  <Figures
                    rows={[
                      ["Capacity", Math.round(4 * roadCapacity(def, site.level) * streetLaneFactor(s, site)) + " trips/hr"],
                      ["Current demand", Math.round((getTrafficLoadMap(s).get(site.gx + "," + site.gz) ?? 0) * 4 * roadCapacity(def, site.level) * streetLaneFactor(s, site)) + " trips/hr"],
                      ["Capacity used", Math.round(100 * (getTrafficLoadMap(s).get(site.gx + "," + site.gz) ?? 0)) + "%"],
                      ["Lanes", (s.infrastructure?.streets[site.gx + "," + site.gz]?.lanes ?? standardRoadLanes(site.defId, site.level)) + " lanes"],
                    ]}
                  />
                  <p className="ui-card-meta">
                    {site.roadAxis ? frontageWidth(site.defId) : "One-tile street"} ·{" "}
                    {(getTrafficLoadMap(s).get(site.gx + "," + site.gz) ?? 0) > 1
                      ? "Upgrade this bottleneck, add a parallel route, or link busy origins with transit."
                      : "Traffic uses connected origin and destination gates."}
                  </p>
                  {widening && (
                    <div className="ui-quick-links" style={{marginTop: 6}}>
                      <button
                        type="button"
                        className="ui-btn is-small"
                        disabled={Boolean(widening.reason)}
                        onClick={() =>
                          runSite((st, el) => {
                            const outcome = widenLegacyRoad(st, el);
                            return outcome.ok ? "Carriageway widened." : (outcome.reason ?? "Unavailable.");
                          }, "Widen carriageway")
                        }
                      >
                        Widen carriageway · {money(widening.cost)}
                      </button>
                      {widening.reason && <p className="ui-card-meta">{widening.reason}</p>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Figures rows={specific!.rows} />
                  {specific!.utilityLine && <p className="ui-card-meta">{specific!.utilityLine}</p>}
                </>
              )}
              {growth && (
                <div className="ui-panel-card">
                  <div className="ui-card-head">
                    <strong>Next level · Lv {site.level + 1}</strong>
                    <span className="ui-card-sub">{price > 0 ? money(price) : "Free"}</span>
                  </div>
                  <p className="ui-card-copy">
                    {VEHICLE_ROADS.has(site.defId)
                      ? "Next stage adds capacity and street equipment."
                      : `${upgrade.label} · ${Math.floor(upgrade.value).toLocaleString()} / ${upgrade.goal.toLocaleString()}${!def.isNetwork ? ` · ${next.join("×")} tiles` : ""}.`}
                  </p>
                  {preview && !def.isNetwork && (site.spanX !== next[0] || site.spanZ !== next[1]) && (
                    <p className="ui-card-meta">
                      {fits
                        ? `Footprint expands cleanly to ${next.join("×")} tiles.`
                        : `Clear neighboring space for a ${next.join("×")} footprint.`}
                    </p>
                  )}
                  {!fits && (site.spanX === next[0] && site.spanZ === next[1]) && (
                    <p className="ui-card-meta">Clear a neighboring {next.join("×")} footprint.</p>
                  )}
                  {upgrade.reasons.map((x) => (
                    <p key={x} className="ui-card-meta">{x}</p>
                  ))}
                  {!compactSite && (
                    <div className="ui-quick-links" style={{marginTop: 8}}>
                      <button
                        type="button"
                        className="ui-btn is-small is-primary"
                        disabled={!upgrade.ready || !fits || price > s.money}
                        onClick={() =>
                          runSite((st, el) => {
                            const result = upgradeElementDirect(st, el.id);
                            return result.ok ? "Upgraded." : (result.reason ?? "Check this site.");
                          })
                        }
                      >
                        Upgrade to Lv {site.level + 1}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {op.status[site.id] && (
                <p className="ui-card-meta">
                  Journey · {op.status[site.id]} · {op.completed[site.id] ?? 0} completed.
                </p>
              )}
              <div className="ui-quick-links">
                {["regional_airport", "spaceport", "teleportation_depot", "flying_car_depot"].includes(
                  site.defId,
                ) && (
                  <button
                    type="button"
                    className="ui-btn is-small"
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
                    type="button"
                    className="ui-btn is-small is-danger"
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
                    type="button"
                    className="ui-btn is-small"
                    onClick={() =>
                      runSite((st, el) => (maintainElement(st, el.id) ? "Site reopened." : "Repair unavailable."))
                    }
                  >
                    Repair and reopen
                  </button>
                )}
                {s.mode === "god" && (
                  <button type="button" className="ui-btn is-small" onClick={() => setTab("controls")}>
                    Experiment here
                  </button>
                )}
              </div>
            </div>
          );
        })() : (
          <p className="ui-muted">Choose a building on the island to inspect its operations and next upgrade.</p>
        ))}
      {tab === "controls" && s.mode === "god" && (
        <div className="ui-insp-tab">
          {compactSite && (
            <div className="ui-quick-links">
              <button type="button" className="ui-btn is-small" onClick={() => setTab("site")}>
                ← Back to site info
              </button>
            </div>
          )}
          <div className="ui-panel-card">
            <div className="ui-card-head">
              <strong>Experiment with a value</strong>
            </div>
            <label className="ui-field">
              <span>Control</span>
              <select
                className="ui-select"
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
              <label className="ui-field">
                <span>Scope</span>
                <select className="ui-select" value={scope} onChange={(ev) => setScope(ev.target.value)}>
                  <option value="site">Selected site</option>
                  <option value="district">District within four tiles</option>
                </select>
              </label>
            ) : (
              <p className="ui-card-meta">Scope · Island</p>
            )}
            {local && !site && <p className="ui-card-meta">Choose the center site on the map.</p>}
            <label className="ui-field">
              <span>Value</span>
              <input
                type="number"
                min={CONTROLS[key].min}
                max={CONTROLS[key].max}
                value={value}
                onChange={(ev) => setValue(ev.target.value)}
              />
            </label>
            <p className="ui-card-meta">Calculated · {rate(calc)}</p>
            <div className="ui-quick-links" style={{marginTop: 6}}>
              <button type="button" className="ui-btn is-small" disabled={(local && !site) || value === ""} onClick={() => setControl(false)}>
                Set once
              </button>
              <button type="button" className="ui-btn is-small is-primary" disabled={(local && !site) || value === ""} onClick={() => setControl(true)}>
                Hold
              </button>
            </div>
          </div>
          <div className="ui-panel-card">
            <details>
              <summary>Allocate total city wealth</summary>
              <div className="ui-edge-grid" style={{marginTop: 8}}>
                <label className="ui-field">
                  <span>Total $</span>
                  <input type="number" value={allocation} onChange={(ev) => setAllocation(ev.target.value)} />
                </label>
                <label className="ui-field">
                  <span>Treasury %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={treasury}
                    onChange={(ev) => setTreasury(ev.target.value)}
                  />
                </label>
                <label className="ui-field">
                  <span>Households %</span>
                  <input
                    type="number"
                    min={0}
                    max={100 - Number(treasury)}
                    value={households}
                    onChange={(ev) => setHouseholds(ev.target.value)}
                  />
                </label>
              </div>
              <p className="ui-card-meta">Businesses receive {Math.max(0, 100 - Number(treasury) - Number(households))}%.</p>
              <div className="ui-quick-links" style={{marginTop: 6}}>
                {[false, true].map((hold) => (
                  <button
                    key={String(hold)}
                    type="button"
                    className="ui-btn is-small"
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
          </div>
          {e.holds.length > 0 && (
            <div className="ui-panel-card">
              <div className="ui-card-head">
                <strong>Active holds · {e.holds.length}</strong>
              </div>
              <div className="ui-quick-links">
                {e.holds.map((h) => (
                  <button
                    key={h.key + (h.site ?? "")}
                    type="button"
                    className="ui-btn is-small"
                    onClick={() => mutate((st) => releaseControl(st, h.key, h.site))}
                  >
                    {CONTROLS[h.key].label} · {n(h.value)}
                    {h.site ? " · " + h.site : ""} · Release
                  </button>
                ))}
                <button type="button" className="ui-btn is-small is-danger" onClick={() => mutate((st) => releaseControl(st))}>
                  Release all holds
                </button>
              </div>
            </div>
          )}
          {site && (
            <div className="ui-panel-card">
              <div className="ui-card-head">
                <strong>Trigger · {def?.name}</strong>
              </div>
              <div className="ui-quick-links">
                <button
                  type="button"
                  className="ui-btn is-small is-danger"
                  onClick={() =>
                    runSite((st, el) =>
                      igniteSite(st, el.id) ? "Fire started." : "Choose a building that can burn.",
                    )
                  }
                >
                  Start fire
                </button>
                <button
                  type="button"
                  className="ui-btn is-small"
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
                  type="button"
                  className="ui-btn is-small"
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
            </div>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
