import { railFreightBonus } from "./railOperations";
import { activeBlessing } from "./faith";
import { FARM_ANCHOR_IDS,FARM_MODULE_IDS } from "./expansionCatalog";
import { complexBoost,districtReport } from "./farmNetworks";
import {VEHICLE_ROADS} from "./roadStandards";
import type { getParcelEffectSummary } from "./parcelEdges";
import { ELEMENT_BY_ID, STAGES } from "./catalog";
import type { CityMetrics, GameState, PlacedElement } from "./simulation";
import { hydraulics } from "./terrain";
import { PROJECT_BY_ID } from "./wealthProjects";

export type Account = "treasury" | "households" | "businesses";
export interface Entry {
  time: number;
  from: Account | "outside";
  to: Account | "outside";
  amount: number;
  label: string;
}
type Control = { label: string; min: number; max: number };
export const CONTROLS = {
  population: { label: "Residents", min: 0, max: 100_000_000 },
  happiness: { label: "Happiness (%)", min: 0, max: 100 },
  treasury: { label: "Treasury ($)", min: 0, max: 1_000_000_000 },
  households: { label: "Household savings ($)", min: 0, max: 1_000_000_000 },
  businesses: { label: "Business cash ($)", min: 0, max: 1_000_000_000 },
  tax: { label: "Local tax (%)", min: 0, max: 50 },
  upkeep: { label: "Operating cost (%)", min: 0, max: 300 },
  authority: { label: "Civic authority (0/1)", min: 0, max: 1 },
  stage: { label: "Population stage", min: 1, max: 20 },
  water: { label: "Drinking water supply", min: 0, max: 5_000_000 },
  power: { label: "Electric supply", min: 0, max: 5_000_000 },
  jobs: { label: "Reachable workplaces", min: 0, max: 5_000_000 },
  food: { label: "Food distribution capacity", min: 0, max: 5_000_000 },
  meals: { label: "Food stock at selected site", min: 0, max: 5_000_000 },
  activity: { label: "Upgrade work at selected site", min: 0, max: 1_000_000 },
  access: { label: "Ignore parcel access (0/1)", min: 0, max: 1 },
  workforce: { label: "Working residents", min: 0, max: 50_000_000 },
  waste: { label: "Waste collection capacity", min: 0, max: 5_000_000 },
  schools: { label: "School places", min: 0, max: 5_000_000 },
  parks: { label: "Park capacity", min: 0, max: 5_000_000 },
  harvest: { label: "Local harvest (%)", min: 0, max: 500 },
  crime: { label: "Crime pressure (%)", min: 0, max: 100 },
  defense: { label: "Defense readiness (%)", min: 0, max: 100 },
  staffing: { label: "Crew staffing (%)", min: 0, max: 200 },
  waterAtSite: { label: "Water available at site", min: 0, max: 1000 },
  stageRules: { label: "Apply stage requirements (0/1)", min: 0, max: 1 },
  upgradeRules: { label: "Require earned upgrades (0/1)", min: 0, max: 1 },
  charge: { label: "Charge construction (0/1)", min: 0, max: 1 },
  stageScale: { label: "Population thresholds (%)", min: 1, max: 300 },
  wealthScale: { label: "Wealth thresholds (%)", min: 1, max: 300 },
  banking: { label: "Banking access multiplier (%)", min: 0, max: 300 },
  demand: { label: "Service demand (%)", min: 0, max: 300 },
  turnaround: { label: "Project turnaround (seconds)", min: 1, max: 300 },
  risk: { label: "Fire risk (%)", min: 0, max: 100 },
  imports: { label: "Food import price (%)", min: 0, max: 500 },
} satisfies Record<string, Control>;
export type ControlKey = keyof typeof CONTROLS;
export const isLocalControl = (k: ControlKey) => ["activity", "meals", "waterAtSite", "turnaround"].includes(k);
type Setting = { key: ControlKey; value: number; site?: string; expires?: number };
export interface SiteAccount {
  work: number;
  food: number;
  cistern?: number;
  irrigationIn?: number;
  irrigationOut?: number;
  bulkStorage?: boolean;
  harvested: number;
  served: number;
  level: number;
  group: string;
  workers: number;
  yieldRate: number;
  retail: number;
  exportRate: number;
  attendees: number;
  jobs: number;
  tripCounts?: Record<string, number>;
}
export interface Economy {
  households: number;
  businesses: number;
  peak: number;
  previousDay: number;
  day: number;
  clock: number;
  recovery: number;
  holds: Setting[];
  once: Setting[];
  raw: Record<string, number>;
  ledger: Entry[];
  sites: Record<string, SiteAccount>;
  report: {
    workers: number;
    occupied: number;
    capacity: number;
    skilled: number;
    jobs: number;
    reachable: number;
    meals: number;
    required: number;
    consumed: number;
    shortage: number;
    utilityStrain?: number;
    imports: number;
    harvest: number;
    spoiled: number;
    exports: number;
    wages: number;
    tax: number;
    reservePower: number;
    treasuryNet?: number;
    reserveOutput?: number;
    potable: number;
    farms: number;
    shopping: number;
  };
}
export function economyOf(s: GameState): Economy {
  if (s.economy) return s.economy;
  if (s.mode === "god" && s.money === 999999999) {
    s.money = 2800;
    s.highestStageReached = 1;
  }
  const value: Economy = {
    households: 0,
    businesses: 0,
    peak: s.money,
    previousDay: s.money,
    day: Math.floor(s.activePlaySec / 120),
    clock: 0,
    recovery: 0,
    holds: [],
    once: [],
    raw: {},
    ledger: [],
    sites: {},
    report: {
      workers: 0,
      occupied: 0,
      capacity: 0,
      skilled: 0,
      jobs: 0,
      reachable: 0,
      meals: 0,
      required: 0,
      consumed: 0,
      shortage: 0,
      imports: 0,
      harvest: 0,
      spoiled: 0,
      exports: 0,
      wages: 0,
      tax: 0,
      reservePower: 0,
      potable: 0,
      farms: 0,
      shopping: 0,
    },
  };
  return (s.economy = value);
}
export const cityWealth = (s: GameState) => {
  const e = economyOf(s);
  return s.money + e.households + e.businesses;
};
export const siteOf = (s: GameState, e: PlacedElement): SiteAccount =>
  (economyOf(s).sites[e.id] ??= {
    work: 0,
    food: 0,
    harvested: 0,
    served: 0,
    level: e.level,
    group: "",
    workers: 0,
    yieldRate: 0,
    retail: 0,
    exportRate: 0,
    attendees: 0,
    jobs: 0,
  });
export function allocateWealth(
  s: GameState,
  total: number,
  treasuryPct: number,
  householdPct: number,
  hold: boolean,
) {
  if (s.mode !== "god" || ![total, treasuryPct, householdPct].every(Number.isFinite)) return;
  const treasury = Math.max(0, Math.min(100, treasuryPct)),
    households = Math.max(0, Math.min(100 - treasury, householdPct));
  const peak = economyOf(s).peak;
  const amount = Math.max(0, Math.min(1e9, total));
  setEconomicControl(s, "treasury", (amount * treasury) / 100, hold);
  setEconomicControl(s, "households", (amount * households) / 100, hold);
  setEconomicControl(s, "businesses", (amount * (100 - households - treasury)) / 100, hold);
  economyOf(s).peak = Math.max(peak, cityWealth(s));
}
export const buildingCharges = (s: GameState) => s.mode !== "god" || effective(s, "charge", 0) > 0;
function balance(s: GameState, a: Account) {
  return a === "treasury" ? s.money : economyOf(s)[a];
}
function adjust(s: GameState, a: Account, amount: number) {
  if (a === "treasury") s.money += amount;
  else economyOf(s)[a] += amount;
}
export function transfer(s: GameState, from: Entry["from"], to: Entry["to"], value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || from === to) return 0;
  const amount = from === "outside" ? value : Math.min(value, Math.max(0, balance(s, from)));
  if (amount <= 0) return 0;
  if (from !== "outside") adjust(s, from, -amount);
  if (to !== "outside") adjust(s, to, amount);
  const e = economyOf(s),
    time = Math.floor(s.activePlaySec / 10) * 10;
  const recent = e.ledger.find((x) => x.time === time && x.label === label && x.from === from && x.to === to);
  if (recent) recent.amount += amount;
  else e.ledger.push({ time, from, to, amount, label });
  if (e.ledger.length > 100) e.ledger.splice(0, e.ledger.length - 100);
  e.peak = Math.max(e.peak, cityWealth(s));
  return amount;
}
const token = (k: ControlKey, site?: string) => (site ? k + "@" + site : k);
export function effective(s: GameState, k: ControlKey, raw: number, site?: string) {
  const e = economyOf(s);
  e.raw[token(k, site)] = raw;
  if (s.mode !== "god") return raw;
  return (
    [...e.holds, ...e.once].find(
      (x) => x.key === k && x.site === site && (x.expires ?? Infinity) > s.activePlaySec,
    )?.value ?? raw
  );
}
export function setEconomicControl(s: GameState, k: ControlKey, value: number, hold: boolean, site?: string) {
  if (s.mode !== "god" || !Number.isFinite(value)) return;
  const e = economyOf(s),
    scoped = isLocalControl(k);
  if (scoped && !s.elements.some((el) => el.id === site)) return;
  if (!scoped) site = undefined;
  const val = Math.min(CONTROLS[k].max, Math.max(CONTROLS[k].min, value));
  releaseControl(s, k, site);
  const previous = controlValue(s, k, site);
  e.raw[token(k, site)] = previous;
  if (hold) e.holds.push({ key: k, value: val, site });
  else e.once.push({ key: k, value: val, site, expires: s.activePlaySec + 2 });
  if (k === "population") {
    s.growthPool += val - s.population;
    s.population = val;
  }
  if (k === "happiness") s.happiness = val;
  if (k === "treasury" || k === "households" || k === "businesses") adjust(s, k, val - balance(s, k));
  if (site && (k === "activity" || k === "meals")) {
    const a = siteOf(s, s.elements.find((el) => el.id === site)!);
    if (k === "activity") a.work = val;
    else a.food = val;
  }
  e.peak = Math.max(e.peak, cityWealth(s));
}
export function releaseControl(s: GameState, k?: ControlKey, site?: string) {
  const e = economyOf(s),
    keep = (x: Setting) => !!k && (x.key !== k || x.site !== site);
  e.holds = e.holds.filter(keep);
  e.once = e.once.filter(keep);
}
export function controlValue(s: GameState, k: ControlKey, site?: string) {
  const e = economyOf(s);
  if (k === "treasury" || k === "households" || k === "businesses") return balance(s, k);
  if (k === "activity" || k === "meals")
    return site ? ((k === "activity" ? e.sites[site]?.work : e.sites[site]?.food) ?? 0) : 0;
  const defaults = {
    population: s.population,
    happiness: s.happiness,
    stage: s.currentStage,
    tax: 15,
    upkeep: 100,
    water: s.metrics.waterSupply,
    power: s.metrics.powerSupply,
    jobs: s.metrics.jobsAvailable,
    food: s.metrics.foodSupply,
    authority: Number(hasAuthority(s)),
    risk: s.mode === "god" ? 0 : s.mode === "survival" ? 12 : 4,
    imports: 100,
    access: 0,
    workforce: e.report.workers,
    waste: s.metrics.wasteCapacity,
    schools: s.metrics.educationSupply,
    parks: s.metrics.recreationSupply,
    harvest: 100,
    crime: s.metrics.crimeRate,
    defense: s.metrics.defenseRating,
    staffing: 100,
    waterAtSite: 0,
    stageRules: 0,
    upgradeRules: 0,
    charge: 0,
    stageScale: 100,
    wealthScale: 100,
    banking: 100,
    demand: 100,
    turnaround: 14,
  };
  return (
    [...e.holds, ...e.once].find(
      (x) => x.key === k && x.site === site && (x.expires ?? Infinity) > s.activePlaySec,
    )?.value ??
    e.raw[token(k, site)] ??
    defaults[k]
  );
}
const govIds = new Set(["city_offices", "government_buildings", "courthouses", "tax_collecting_office"]);
export const operational = (e: PlacedElement) => e.connected && !e.onFire && !e.disrepair;
export function professionalStaff(s: GameState, el: PlacedElement) {
  return ((economyOf(s).sites[el.id]?.workers ?? 0) * effective(s, "staffing", 100)) / 100;
}
export function hasAuthority(s: GameState) {
  return !!effective(
    s,
    "authority",
    Number(s.elements.some((e) => govIds.has(e.defId) && operational(e) && professionalStaff(s, e) >= 1)),
  );
}
const crops = new Set([
  ...FARM_ANCHOR_IDS,...FARM_MODULE_IDS,
  "farms",
  "fields",
  "orchards",
  "groves_of_olives",
  "plantations",
  "gardens",
  "terraced_glasshouses",
  "solar_canopy_orchard",
  "ocean_habitat_ring",
]);
const skilledIds = new Set([
  "regional_airport",
  "spaceport",
  "materials_foundry",
  "teleportation_depot",
  "flying_car_depot",
  "skybridge_university",
  "hospitals",
  "banks",
]);
const industry = (id: string) =>
  [
    "factories",
    "data_centers",
    "open_pit_mine",
    "materials_foundry",
    "freight_rail_terminal",
    "shipyards",
    "blacksmiths",
  ].includes(id);
const flightProject = (id: string) =>
  ["regional_airport", "flying_car_depot", "spaceport", "teleportation_depot"].includes(id);
export const closeSites = (a: PlacedElement, b: PlacedElement, r: number) =>
  Math.max(0, a.gx - b.gx - b.spanX, b.gx - a.gx - a.spanX) +
    Math.max(0, a.gz - b.gz - b.spanZ, b.gz - a.gz - a.spanZ) <=
  r;
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
export function evaluateEconomy(
  s: GameState,
  m: CityMetrics,
  base: number,
  components: Map<string, Set<number>>,
  transit: Set<string>,
  joins?: ReadonlyMap<string, ReturnType<typeof getParcelEffectSummary>>,
  districts: ReadonlyMap<string, string> = new Map(),
  congested: ReadonlySet<string> = new Set(),
  freightRail: ReadonlySet<string> = new Set(),
) {
  const e = economyOf(s),
    r = e.report,
    live = s.elements.filter(operational);
  // Only a real shared service district joins disconnected street components.
  const parent = new Map<string, string>();
  const find = (node: string): string => {
    let root = node;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    while (parent.has(node) && parent.get(node) !== root) {
      const next = parent.get(node)!;
      parent.set(node, root);
      node = next;
    }
    return root;
  };
  const roadNodes = (el: PlacedElement) => Array.from(components.get(el.id) ?? []).map((id) => "road:" + id);
  const districtNode = (el: PlacedElement) =>
    transit.has(el.id) && districts.has(el.id) ? "line:" + districts.get(el.id) : undefined;
  for (const el of live) {
    const district = districtNode(el);
    if (!district) continue;
    for (const road of roadNodes(el)) {
      const root = find(road),
        joined = find(district);
      if (root !== joined) parent.set(root, joined);
    }
  }
  const ownGroup = (el: PlacedElement) => find(districtNode(el) ?? roadNodes(el).sort()[0] ?? "site:" + el.id);
  const farmDistrict = districtReport(s);
  const group = (el:PlacedElement)=>ownGroup(farmDistrict.farms.get(el.id)?.owner.get(el.id)??el);
  const homes = live.filter((el) => ELEMENT_BY_ID[el.defId]?.popBase),
    regions = new Map<string, number>();
  const weighted = sum(homes.map((x) => (ELEMENT_BY_ID[x.defId].popBase ?? 0) * 2 ** (x.level - 1)));
  for (const h of homes) {
    const key = group(h);
    regions.set(
      key,
      (regions.get(key) ?? 0) +
        (s.population * (ELEMENT_BY_ID[h.defId].popBase ?? 0) * 2 ** (h.level - 1)) / Math.max(1, weighted),
    );
  }
  const water = hydraulics(s).services,
    report = districtReport(s),
    reuse = live.filter((x) => x.defId === "water_reuse_works"),
    exchanges = live.filter((x) => x.defId === "growers_exchange");
  const farms = live.filter((x) => crops.has(x.defId));
  const pondCoverage=new Map<string,number>(), bulkStorage=new Set<string>();
  for(const farm of new Set(report.farms.values())){
    if(!farm.live)continue;
    const growers=[...farm.anchors,...farm.modules].filter(el=>el.defId!=="irrigation_pond");
    if(farm.modules.some(el=>el.defId==="feed_silo"))for(const el of growers)bulkStorage.add(el.id);
    const ponds=farm.modules.filter(el=>el.defId==="irrigation_pond");
    if(!ponds.length)continue;
    const rain=s.weather==="rain"||s.weather==="storm";
    const dry=growers.filter(el=>!rain&&!water.get(el.id)?.irrigation&&!joins?.get(el.id)?.bankWater);
    const outlets=ponds.map(pond=>{
      const site=siteOf(s,pond),capacity=.8*pond.level;
      site.irrigationIn=Math.min(capacity,water.get(pond.id)?.irrigation??0)+(rain?.95*pond.level:0);
      return {site,rate:Math.min(capacity,Math.max(0,site.cistern??0)/4)};
    });
    const supply=outlets.reduce((n,p)=>n+p.rate,0),wanted=dry.length*.18;
    const coverage=wanted?Math.min(1,supply/wanted):0;
    for(const el of dry)pondCoverage.set(el.id,coverage);
    for(const p of outlets)p.site.irrigationOut=supply?Math.min(supply,wanted)*p.rate/supply:0;
  }
  const banks = live.filter((x) => x.defId === "banks" || x.defId === "atms"),
    factories = live.filter((x) => industry(x.defId));
  let potable = 0,
    powerSaved = 0;
  r.workers = Math.round(effective(s, "workforce", s.population * 0.54));
  r.capacity = Math.round(base * (s.mode==="god"?31:21));
  r.occupied = s.population;
  r.skilled = Math.round(
    r.workers * Math.min(0.72, 0.08 + (0.6 * m.educationSupply) / Math.max(1, m.educationDemand)),
  );
  r.jobs = 0;
  r.reachable = 0;
  r.meals = 0;
  r.harvest = 0;
  r.exports = 0;
  r.farms = farms.length;
  r.shopping = 0;
  const schools=new Map<string,Map<string,number>>();
  for(const site of live){
    if(!["trade_school","community_college","university","research_university"].includes(site.defId))continue;
    const district=group(site), local=schools.get(district)??new Map<string,number>();
    local.set(site.defId,(local.get(site.defId)??0)+(ELEMENT_BY_ID[site.defId].education??0)*2**(site.level-1));
    schools.set(district,local);
  }
  const trained=(g:string,id:string)=>Math.min(1,(schools.get(g)?.get(id)??0)/Math.max(1,(regions.get(g)??0)*.35));
  const graduateShare=[...regions].reduce((n,[g,pop])=>n+pop*Math.max(trained(g,"university"),trained(g,"research_university")),0)/Math.max(1,s.population);
  r.skilled=Math.min(r.workers,Math.round(r.skilled+r.workers*.12*graduateShare));
  const jobsByGroup = new Map<string, number>();
  for (const el of s.elements) {
    const d = ELEMENT_BY_ID[el.defId];
    if (!d || d.isNetwork || (d.passiveNature && !crops.has(d.id))) continue;
    const a = siteOf(s, el),
      g = group(el),
      scale = 2 ** (el.level - 1);
    a.group = g;
    a.bulkStorage=bulkStorage.has(el.id);
    if(d.id==="irrigation_pond" && !report.farms.get(el.id)?.live){a.irrigationIn=0;a.irrigationOut=0;}
    a.jobs = 0;
    a.workers = 0;
    a.exportRate = 0;
    a.yieldRate = 0;
    a.retail = 0;
    a.attendees = 0;
    if (a.level !== el.level) {
      a.level = el.level;
      a.work = 0;
    }
    if (!operational(el)) continue;
    const residents = regions.get(g) ?? 0,
      irrigation = water.get(el.id)?.irrigation ?? 0,
      rain = s.weather === "rain" || s.weather === "storm";
    const edge = joins?.get(el.id);
    const cooled =
      effective(s, "waterAtSite", irrigation, el.id) > 0 ||
      reuse.some((x) => closeSites(x, el, 3)) ||
      edge?.bankWater;
    const capacity =
      (d.jobs ?? 0) *
      scale *
      (skilledIds.has(d.id) ? Math.min(1, 0.25 + (r.skilled / Math.max(1, r.workers)) * 1.7) : 1);
    const industrial=industry(d.id),commercial=d.category==="commerce",advanced=skilledIds.has(d.id)||["data_centers","research_institute","research_university","university"].includes(d.id);
    const employment=1+(industrial?.16*trained(g,"trade_school"):0)+(commercial?.12*trained(g,"community_college"):0)+(advanced?.12*Math.max(trained(g,"university"),trained(g,"research_university")):0);
    a.jobs = Math.round(capacity*Math.min(1.32,employment)*(report.bonuses.jobsMultiplier.get(el.id)??1));
    r.jobs += a.jobs;
    if (residents > 0) {
      r.reachable += a.jobs;
      jobsByGroup.set(g, (jobsByGroup.get(g) ?? 0) + a.jobs);
    }
    if (crops.has(d.id)) {
      a.yieldRate =
        (d.food ?? 8) *
        2.35 ** (el.level - 1) *
        0.10 *
        (cooled ? 1.42 : rain ? 1.05 : .62+.8*(pondCoverage.get(el.id)??0)) *
        complexBoost(report.farms.get(el.id)?.count.get(el.id)??0) *
        (exchanges.some((x) => closeSites(x, el, 4)) ? 1.15 : 1);
      if (d.id === "terraced_glasshouses" && m.powerSupply < m.powerDemand) a.yieldRate *= 0.3;
    }
    if (d.id === "farm_houses") a.yieldRate = .55 * 2.35**(el.level-1)*complexBoost(report.farms.get(el.id)?.count.get(el.id)??0);
    a.yieldRate *= report.bonuses.foodMultiplier.get(el.id)??1;
    if(a.yieldRate>0 && s.railYard?.benefits[el.id])a.yieldRate *= Math.max(railFreightBonus(s,el.id,"dairy"),railFreightBonus(s,el.id,"grain"),railFreightBonus(s,el.id,"livestock"));
    if (edge) {
      a.yieldRate *= 1 + edge.agriculture;
      if (d.category === "housing" || d.id === "orchards")
        a.yieldRate += edge.food * 0.16 * (cooled || rain ? 1.35 : 1);
    }
    if (d.id === "floodplain_park" && rain) m.wasteCapacity += el.level * 2;
    if (d.id === "rainwater_cathedral") {
      // Early project saves used the food field to store rain in this building.
      if (a.cistern === undefined) {
        a.cistern = a.food;
        a.food = 0;
      }
      potable += Math.min(36 * scale, a.cistern);
    }
    if (d.id === "district_heat_works" && factories.some((x) => closeSites(x, el, 3)))
      powerSaved += homes.filter((x) => closeSites(x, el, 4)).length * el.level * 2;
    const bank = banks.some((x) => group(x) === g && closeSites(x, el, 5))
      ? effective(s, "banking", 100) / 100
      : 0;
    if (
      d.id === "grocery_store" ||
      d.id === "growers_exchange" ||
      d.id === "bakery_coop" ||
      d.archetype === "restaurant_bar"
    )
      a.retail = (d.food ?? 24) * 1.45 * 2.25**(el.level-1) * (1 + bank * 0.15);
    if(a.retail>0 && s.railYard?.benefits[el.id]) a.retail *= Math.max(...(["goods","dairy","grain","livestock"] as const).map(c=>railFreightBonus(s,el.id,c)));
    if (edge) a.retail *= 1 + edge.commerce;
    if (residents > 0 && (d.id !== "grocery_store" || a.food > 0 || s.money + e.businesses > 0))
      r.shopping += a.retail;
    if (residents > 0 && (a.retail > 0 || a.yieldRate > 0)) r.meals += a.food;
    const railOK = d.id !== "freight_rail_terminal" || freightRail.has(el.id);
    if (
      railOK &&
      !(d.id === "materials_foundry" && m.wasteDemand === 0) &&
      !flightProject(d.id) &&
      (industry(d.id) ||
        (FARM_ANCHOR_IDS.has(d.id)&&!!d.income)||["university","research_university","research_institute","community_college","businesses", "shops", "plantations", "orchards", "growers_exchange", "bakeries"].includes(d.id))
    )
      a.exportRate =
        (d.income ?? 5) * scale * 0.24 * (industry(d.id) && !cooled ? 0.42 : 1) * (1 + bank * 0.15);
    if(a.exportRate>0 && s.railYard?.benefits[el.id]) a.exportRate *= Math.max(...(["goods","timber","fuel"] as const).map(c=>railFreightBonus(s,el.id,c)));
    a.exportRate *= (report.bonuses.incomeMultiplier.get(el.id)??1)*
      (1+(industrial?.18*trained(g,"trade_school"):0)+(commercial?.14*trained(g,"community_college"):0)+(advanced?.18*trained(g,"research_university"):0));
    const trafficFactor = congested.has(el.id) ? 0.75 : 1;
    a.exportRate *= trafficFactor * (0.8 + Math.min(2, el.landValue ?? 0.5) * 0.3);
    if (edge) a.exportRate *= 1 + edge.commerce;
  }
  let accessibleHarvest = 0;
  const rawReachable = r.reachable;
  r.reachable = Math.round(effective(s, "jobs", rawReachable));
  const hiring = rawReachable ? r.reachable / rawReachable : 0;
  for (const el of live) {
    const a = e.sites[el.id];
    if (!a) continue;
    const residents = regions.get(a.group) ?? 0;
    if (residents > 0) a.jobs *= hiring;
    a.workers =
      a.jobs *
      Math.min(
        1,
        (residents * r.workers) /
          Math.max(1, s.population) /
          Math.max(1, (jobsByGroup.get(a.group) ?? 0) * hiring),
      );
    a.exportRate *= Math.min(1, a.workers / Math.max(1, a.jobs));
    a.yieldRate *= (effective(s, "harvest", 100) / 100) * (activeBlessing(s) === "harvest" ? 1.2 : 1);
    a.yieldRate *= a.jobs ? 0.42 + (0.58 * a.workers) / Math.max(1, a.jobs) : 1;
    a.attendees = Math.min(
      residents,
      (ELEMENT_BY_ID[el.defId].education ?? ELEMENT_BY_ID[el.defId].recreation ?? 0) * el.level,
    );
    r.harvest += a.yieldRate;
    if (residents > 0) accessibleHarvest += a.yieldRate;
    r.exports += a.exportRate;
  }
  m.jobsAvailable = r.reachable;
  m.jobsNeeded = r.workers;
  r.required = s.population / (s.mode==="survival"?103:115);
  // Farm gates distribute 52% of their harvest directly. Convert those meals per second
  // into the same resident supply units as the food demand shown on the HUD.
  const foodCap = r.shopping + accessibleHarvest * 0.52 * (r.required > 0 ? m.foodDemand / r.required : 0);
  m.foodSupply = Math.round(effective(s, "food", foodCap));
  r.potable = potable;
  m.waterSupply = effective(
    s,
    "water",
    m.waterSupply + potable + sum([...water.values()].map((w) => w.potable)),
  );
  m.powerDemand = Math.max(0, m.powerDemand - powerSaved);
  r.reserveOutput = Math.min(r.reservePower, Math.max(0, m.powerDemand - m.powerSupply));
  m.powerSupply = effective(s, "power", m.powerSupply + r.reserveOutput);
  e.peak = Math.max(cityWealth(s), e.peak);
}
export function activityRule(el: PlacedElement) {
  const d = ELEMENT_BY_ID[el.defId];
  if (crops.has(d.id)) return { label: "Harvested local food", goal: 12 * el.level };
  if (["grocery_store", "growers_exchange", "bakery_coop"].includes(d.id) || d.archetype === "restaurant_bar")
    return { label: "Customers served", goal: 4 * el.level };
  if (flightProject(d.id) || ["bus_depots", "taxi_depots", "train_depots", "ferry_exchange"].includes(d.id))
    return { label: "Completed journeys", goal: 2 * el.level };
  if (d.popBase) return { label: "Occupied, supplied home time", goal: 18 * el.level };
  if (d.education || d.recreation) return { label: "Attendance", goal: 12 * el.level };
  if (d.jobs) return { label: "Staffed operating time", goal: 16 * el.level };
  return { label: "Service time", goal: 12 * el.level };
}
export function upgradeReadiness(s: GameState, el: PlacedElement) {
  const rule = activityRule(el),
    a = siteOf(s, el),
    value = effective(s, "activity", a.work, el.id);
  const reasons: string[] = [];
  if (s.mode !== "god" || effective(s, "upgradeRules", 0) > 0) {
    if (!el.connected) reasons.push("Connect this site to its neighborhood.");
    if (el.onFire || el.disrepair) reasons.push("Restore this site to service.");
    if (!VEHICLE_ROADS.has(el.defId) && !s.infrastructure?.spans[el.gx+","+el.gz] && value < rule.goal) reasons.push(rule.label + " " + Math.floor(value) + " / " + rule.goal + ".");
  }
  return { ...rule, value, ready: reasons.length === 0, reasons };
}
/** One active-time accounting period. Inspection and save snapshots never make sales or pay wages. */
export function advanceEconomy(s: GameState, dt: number) {
  const e = economyOf(s);
  e.clock += dt;
  if (e.clock < 0.75) return false;
  const t = e.clock;
  e.clock = 0;
  const openingTreasury = s.money;
  const r = e.report,
    day = Math.floor(s.activePlaySec / 120);
  if (day !== e.day) {
    e.day = day;
    e.previousDay = cityWealth(s);
  }
  e.once = e.once.filter((x) => (x.expires ?? 0) > s.activePlaySec);
  for (const a of ["treasury", "households", "businesses"] as const) {
    const held = e.holds.find((x) => x.key === a);
    if (held) adjust(s, a, held.value - balance(s, a));
  }
  const present = new Set(s.elements.map((x) => x.id));
  for (const id of Object.keys(e.sites))
    if (!present.has(id)) {
      delete e.sites[id];
      for (const k of Object.keys(CONTROLS) as ControlKey[]) delete e.raw[token(k, id)];
    }
  e.holds = e.holds.filter((x) => !x.site || present.has(x.site));
  e.once = e.once.filter((x) => !x.site || present.has(x.site));
  const live = s.elements.filter(operational);
  const homes = live.filter((x) => ELEMENT_BY_ID[x.defId]?.popBase);
  const groups = new Map<string, { people: number; suppliers: PlacedElement[]; shops: PlacedElement[] }>();
  const homeWeight = sum(homes.map((x) => ELEMENT_BY_ID[x.defId].popBase! * 2 ** (x.level - 1)));
  const getGroup = (id: string) => {
    let g = groups.get(id);
    if (!g) {
      g = { people: 0, suppliers: [], shops: [] };
      groups.set(id, g);
    }
    return g;
  };
  let workers = 0,
    spoil = 0;
  for (const el of live) {
    const a = e.sites[el.id];
    if (!a) continue;
    const d = ELEMENT_BY_ID[el.defId],
      g = getGroup(a.group);
    workers += a.workers;
    if (d.popBase) g.people += (s.population * d.popBase * 2 ** (el.level - 1)) / Math.max(1, homeWeight);
    if(d.id==="irrigation_pond"){
      a.cistern=Math.max(0,Math.min(36*el.level,(a.cistern??0)+((a.irrigationIn??0)-(a.irrigationOut??0))*t));
    }
    if (d.id === "rainwater_cathedral") {
      a.cistern = Math.max(
        0,
        Math.min(
          el.level * 180,
          (a.cistern ?? 0) + (s.weather === "storm" || s.weather === "rain" ? 3 : -0.08) * t,
        ),
      );
      continue;
    }
    if (a.retail > 0) g.shops.push(el);
    if (a.yieldRate > 0 || a.retail > 0) {
      g.suppliers.push(el);
      const production = a.yieldRate * t;
      a.food += production;
      a.harvested += production;
      const spoiled = Math.min(a.food, a.food * t * (a.retail ? 0.0008 : a.bulkStorage ? .0012 : 0.0018));
      a.food -= spoiled;
      spoil += spoiled;
    }
  }
  // Vacancies already reduce export capacity. Resident confidence and crime affect what outside buyers spend.
  const tradeIncome = r.exports * t * (activeBlessing(s) === "prosperity" ? 1.15 : 1) * (0.75 + 0.25 * s.happiness / 100) * (1 - 0.20 * s.metrics.crimeRate / 100);
  transfer(s, "outside", "businesses", tradeIncome, "Local exports");
  // A connected shop can obtain working capital from the public treasury; it only imports an affordable shortfall.
  const importPrice = (0.8 * effective(s, "imports", 100)) / 100;
  let imported = 0,
    consumed = 0;
  let remainingCapacity = s.metrics.foodSupply * t;
  const wages = transfer(s, "businesses", "households", workers * 0.34 * t, "Local wages");
  const taxFraction = effective(s, "tax", 15) / 100;
  let taxes =
    transfer(s, "households", "treasury", wages * taxFraction, "Payroll tax") +
    transfer(s, "businesses", "treasury", tradeIncome * taxFraction, "Trade tax");
  for (const g of groups.values()) {
    if (!g.people) continue;
    const need = (g.people / (s.mode==="survival"?103:115)) * t;
    let stock = sum(g.suppliers.map((el) => e.sites[el.id].food));
    // Deliver the current harvest into nearby shops. Each district owns its own crop and store inventory.
    for (const supplier of g.suppliers.filter((el) => e.sites[el.id].yieldRate > 0)) {
      const farm = e.sites[supplier.id];
      for (const shop of g.shops) {
        const dest = e.sites[shop.id],
          qty = Math.min(farm.food, Math.max(0, dest.retail * 0.65 - dest.food), dest.retail * t * 0.12);
        farm.food -= qty;
        dest.food += qty;
        if (
          (shop.defId === "bakery_coop" || ELEMENT_BY_ID[shop.defId].archetype === "restaurant_bar") &&
          dest.workers >= 1 &&
          s.metrics.powerSupply >= s.metrics.powerDemand
        ) {
          const baked = qty * (shop.defId === "bakery_coop" ? .32 : .18);
          dest.food += baked;
          dest.harvested += baked;
          stock += baked;
        }
        if (farm.food <= 0) break;
      }
    }
    for (const importer of g.shops.filter((el) => el.defId === "grocery_store" || ELEMENT_BY_ID[el.defId].archetype==="restaurant_bar")) {
      const wanted = Math.min(Math.max(0, need * 4 + 3 - stock), e.sites[importer.id].retail * t * (importer.defId === "grocery_store" ? .36 : .14));
      if (wanted > 0) {
        const credit = Math.max(0, wanted * importPrice - e.businesses);
        transfer(s, "treasury", "businesses", credit, "Grocer working capital");
        const spent = transfer(s, "businesses", "outside", wanted * importPrice, "Imported groceries");
        const qty = importPrice ? spent / importPrice : wanted;
        e.sites[importer.id].food += qty;
        imported += qty;
        stock += qty;
      }
    }
    // Farmers' gates sell modest amounts directly. Markets and restaurants increase local distribution.
    const retail = sum(g.shops.map((el) => e.sites[el.id].retail)) * t * 0.15;
    const gates = sum(g.suppliers.map((el) => e.sites[el.id].yieldRate)) * t * 0.52;
    let portion = Math.min(stock, need, retail + gates, remainingCapacity);
    const voucher = Math.max(0, portion * 0.65 - e.households);
    transfer(s, "treasury", "households", voucher, "Household food assistance");
    portion = Math.min(portion, e.households / 0.65);
    let left = portion;
    for (const el of [...g.shops, ...g.suppliers.filter((el) => !g.shops.includes(el))]) {
      const a = e.sites[el.id],
        qty = Math.min(a.food, left);
      a.food -= qty;
      if (a.retail > 0) {
        a.served += qty;
        a.work += qty;
      }
      left -= qty;
      if (left <= 0) break;
    }
    consumed += portion;
    remainingCapacity -= portion;
    const sale = transfer(s, "households", "businesses", portion * 0.65, "Household groceries");
    taxes += transfer(s, "businesses", "treasury", sale * 0.04, "Sales tax");
  }
  const m = s.metrics;
  const utilityDeficit = Math.max(0, m.waterDemand ? 1 - m.waterSupply / m.waterDemand : 0,
    m.powerDemand ? 1 - m.powerSupply / m.powerDemand : 0);
  const previousStrain = r.utilityStrain ?? 0;
  r.utilityStrain = previousStrain + (utilityDeficit - previousStrain) * (1 - Math.exp(-t / 24));
  r.spoiled = spoil / t;
  r.consumed = consumed / t;
  r.imports = imported / t;
  r.wages = wages / t;
  r.tax = taxes / t;
  r.shortage +=
    (Math.max(0, 1 - r.consumed / Math.max(0.001, r.required)) * (r.required > 0 ? 1 : 0) - r.shortage) *
    (1 - Math.exp(-t / 24));
  transfer(
    s,
    "treasury",
    "outside",
    (s.metrics.upkeepPerTick * t * 0.06 * effective(s, "upkeep", 100)) / 100,
    "Imported upkeep supplies",
  );
  s.metrics.grossIncomePerTick = r.tax;
  r.treasuryNet = (s.money - openingTreasury) / t;
  s.metrics.netIncomePerTick = r.treasuryNet;
  const lines = s.mobility?.lines ?? [];
  for (const el of live) {
    const a = siteOf(s, el),
      d = ELEMENT_BY_ID[el.defId];
    if (a.level !== el.level) {
      a.level = el.level;
      a.work = 0;
    }
    if (crops.has(d.id)) a.work += a.yieldRate * t;
    else if (["bus_depots", "taxi_depots", "train_depots", "ferry_exchange"].includes(d.id)) {
      const counters = (a.tripCounts ??= {});
      for (const line of lines.filter((l) => l.depot === el.id)) {
        a.work += Math.max(0, line.departures - (counters[line.id] ?? 0));
        counters[line.id] = line.departures;
      }
    } else if (!flightProject(d.id) && a.retail === 0) {
      if (d.popBase) {
        if (
          s.population > 0 &&
          s.metrics.waterSupply >= s.metrics.waterDemand &&
          s.metrics.powerSupply >= s.metrics.powerDemand
        )
          a.work += t * (1 - r.shortage);
      } else if (d.education || d.recreation) a.work += Math.min(3, a.attendees / 5) * t;
      else if (d.jobs) a.work += (a.workers / Math.max(1, a.jobs)) * t;
      else a.work += t;
    }
    a.work = effective(s, "activity", a.work, el.id);
    a.food = effective(s, "meals", a.food, el.id);
  }
  const storage = live
    .filter((el) => el.defId === "pumped_storage_station")
    .reduce((a, b) => a + b.level * 65, 0);
  if (storage) {
    const surplus = s.metrics.powerSupply - (r.reserveOutput ?? 0) - s.metrics.powerDemand;
    r.reservePower = Math.max(
      0,
      Math.min(
        storage,
        r.reservePower + (surplus > 0 ? Math.min(4, surplus * 0.25) : -(r.reserveOutput ?? 0)) * t,
      ),
    );
  } else r.reservePower = 0;
  if (
    s.mode === "survival" &&
    s.highestStageReached >= 2 &&
    !s.faith?.sheltered &&
    s.population < (STAGES[s.highestStageReached - 1]?.minPop ?? 0)
  ) {
    e.recovery += t;
    if (e.recovery >= 360) {
      s.gameOver = true;
      s.gameOverReason = "The city stayed below its population benchmark for three island days.";
    }
  } else e.recovery = 0;
  enforceAccountHolds(s);
  e.peak = Math.max(e.peak, cityWealth(s));
  return true;
}
export function wealthTiers() {
  return [...new Set(Object.values(PROJECT_BY_ID).map((p) => p.wealthThreshold))];
}

export function enforceAccountHolds(s: GameState) {
  if (s.mode !== "god") return;
  const e = economyOf(s);
  for (const h of e.holds)
    if (h.key === "treasury" || h.key === "businesses" || h.key === "households") {
      const calculated = balance(s, h.key);
      if (calculated !== h.value) e.raw[h.key] = calculated;
      adjust(s, h.key, h.value - calculated);
    }
}
