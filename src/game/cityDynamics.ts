import {standardRoadLanes} from "./roadStandards";
/**
 * City dynamics: spatial fields and systemic simulation layered on top of the core metrics.
 *
 *  - Pollution field   — industry, heavy power, landfills and big roads emit; trees, parks & swamps absorb.
 *  - Land value field  — parks, water, landmarks, faith & schools raise it; pollution drags it down.
 *                        Homes on valuable land house more people; shops on it earn more.
 *  - Traffic           — every connected building generates trips onto its road network; each road tile
 *                        adds capacity (by type & level); bus/train/taxi stations take cars off the road.
 *                        Rush hours (7–9 am, 5–7 pm) spike demand, nights are calm.
 *  - Synergies         — meaningful neighbour combos (Farmstead, Shopping District, Waterfront, Rail Freight…)
 *                        boost an element's output.
 *  - Live power        — solar follows the sun & clouds, wind follows wind speed, hydro loves rain.
 *  - Upkeep            — service & utility buildings cost money to run, so the treasury tells a story.
 *
 * Layout-dependent results are cached on a layout key so the per-tick cost stays tiny.
 */
import { type CivElementDef, ELEMENT_BY_ID } from "./catalog";
import type { PlacedElement } from "./simulation";
import { levelMultiplier, scaledRadius } from "./levelScaling";
import { FARM_ANCHOR_IDS, FARM_MODULE_IDS } from "./expansionCatalog";

import { GRID_MIN, GRID_SIZE } from "./mapBounds";
export const FIELD_MIN=GRID_MIN;
export const FIELD_N=GRID_SIZE;

export function fieldIndex(gx: number, gz: number): number {
  const ix = gx - FIELD_MIN;
  const iz = gz - FIELD_MIN;
  if (ix < 0 || iz < 0 || ix >= FIELD_N || iz >= FIELD_N) return -1;
  return ix * FIELD_N + iz;
}

// ---------------------------------------------------------------------------------------------
// Static per-element tables
// ---------------------------------------------------------------------------------------------

/** Pollution emitted (positive) or absorbed (negative) per element at Lv.1 */
const POLLUTION: Record<string, number> = {
  factories: 6,
  coal_powerplants: 9,
  natural_gas_power_plants: 5,
  trash_burning_plants: 7,
  landfill: 6,
  trash_compacting_plants: 3,
  highways: 1.2,
  freeways: 1.8,
  over_passes: 1.2,
  data_centers: 2,
  shipyards: 4,
  ship_building_areas: 3,
  airforce_base: 4,
  military_base: 2,
  gas_stations: 2,
  blacksmiths: 2,
  geothermal_power_plants: 1,
  nuclear_power_plants: 1.5,
  micro_reactor_nuclear: 0.8,
  naval_base: 2,
  submarine_base: 2,
  bus_depots: 1.5,
  train_depots: 1.5,
  taxi_depots: 1,
  // absorbers
  trees: -1.4,
  pine_trees: -1.4,
  redwood_trees: -2.6,
  plants: -0.5,
  shrubs: -0.6,
  bushes: -0.6,
  park: -2,
  little_parks: -1.2,
  large_parks: -4,
  gardens: -1.6,
  italian_gardens: -2,
  swamps: -2.2,
  orchards: -1.2,
  groves_of_olives: -1.2,
  hills: -0.6,
  mountains: -1.2,
};

/** Desirability contribution [strength, radius in tiles] (negative = undesirable) */
const DESIRABILITY: Record<string, [number, number]> = {
  park: [0.35, 6],
  little_parks: [0.22, 4],
  large_parks: [0.6, 9],
  gardens: [0.3, 5],
  italian_gardens: [0.45, 7],
  water_places: [0.35, 6],
  ponds: [0.25, 4],
  lakes: [0.45, 7],
  beaches: [0.4, 6],
  beach_umbrellas: [0.2, 4],
  school: [0.18, 7],
  community_centers: [0.2, 6],
  churches: [0.15, 5],
  christian_churches: [0.18, 6],
  monasteries: [0.2, 6],
  mosques: [0.2, 6],
  synagogues: [0.2, 6],
  temples: [0.25, 6],
  lds_temples: [0.35, 8],
  large_landmarks: [0.7, 10],
  washington_monument: [0.8, 11],
  white_house: [0.8, 11],
  smithsonian: [0.75, 11],
  eiffel_tower: [1.0, 13],
  the_london_eye: [0.9, 12],
  the_great_pyramids: [1.0, 13],
  restaurants: [0.12, 4],
  cheesesteak_restaurants: [0.12, 4],
  bars: [0.06, 3],
  malls: [0.2, 6],
  shops: [0.08, 3],
  trees: [0.07, 2],
  pine_trees: [0.07, 2],
  redwood_trees: [0.15, 3],
  graveyards: [-0.08, 3],
  prisons: [-0.35, 6],
  jails: [-0.2, 4],
};

/** Road capacity in traversals per quarter hour on a level-one tile */
const ROAD_CAPACITY: Record<string, number> = {
  dirt_roads: 5,
  paths: 2,
  walking_paths: 3,
  trails: 2,
  side_walks: 3,
  roads: 10,
  two_lane_roads: 16,
  pretty_roads: 12,
  highways: 30,
  freeways: 46,
  over_passes: 30,
  underpasses: 26,
  bridges: 14,
  stone_bridges: 11,
  suspension_bridges: 32,
  boardwalks: 3,
};


// ---------------------------------------------------------------------------------------------
// Synergies
// ---------------------------------------------------------------------------------------------

type Pred = (d: CivElementDef) => boolean;
const ids = (...list: string[]): Pred => {
  const s = new Set(list);
  return (d) => s.has(d.id);
};
const isHome: Pred = (d) => Boolean(d.popBase) && d.category === "housing";
const isAgri: Pred = (d) => d.category === "agriculture";
const isRetail: Pred = ids("shops", "clothing_stores", "thrift_stores", "shoe_stores", "grocery_store", "malls");
const isFood: Pred = ids("restaurants", "cheesesteak_restaurants", "bars", "grocery_store");
const isOffice: Pred = ids("businesses", "buildings", "banks", "data_centers", "city_offices", "government_buildings");
const isTransit: Pred = (d) => d.archetype === "transit_stop" || d.archetype === "transit_depot";
const isWater: Pred = (d) => Boolean(d.isWaterFeature) || ["ponds", "lakes", "wells", "water_towers", "aqueduct", "municipal_reservoir"].includes(d.id);
const isPark: Pred = (d) => (d.recreation ?? 0) > 0 && d.category === "civic_parks";
const isRail: Pred = (d) => Boolean(d.isRailNetwork) || d.id === "train_stops" || d.id === "train_depots";
const isPowerGen: Pred = (d) => (d.power ?? 0) > 0;
const isLandmark: Pred = (d) => d.category === "landmarks";
const isBeach: Pred = ids("beaches", "sand", "beach_umbrellas");
const isNaval: Pred = ids("naval_base", "submarine_base", "shipyards", "ship_building_areas", "docks");

export interface SynergyRule {
  id: string;
  label: string;
  emoji: string;
  who: Pred;
  near: Pred;
  radius: number;
  /** minimum number of matching neighbours */
  min?: number;
  /** also counts when this element sits on a coast / water-adjacent tile */
  coastal?: boolean;
}

export const SYNERGY_RULES: SynergyRule[] = [
  { id: "farmstead", label: "Farmstead", emoji: "🌾", who: ids("farms", "fields", "orchards", "plantations", "groves_of_olives"), near: ids("farm_houses", "windmills"), radius: 4 },
  { id: "irrigated", label: "Irrigated", emoji: "💧", who: isAgri, near: isWater, radius: 4, coastal: false },
  { id: "farm_to_table", label: "Farm-to-Table", emoji: "🥗", who: isFood, near: isAgri, radius: 7 },
  { id: "shopping_district", label: "Shopping District", emoji: "🛍️", who: isRetail, near: isRetail, radius: 3, min: 2 },
  { id: "foodie_street", label: "Foodie Street", emoji: "🍽️", who: isFood, near: isHome, radius: 4, min: 2 },
  { id: "walk_to_school", label: "Walk to School", emoji: "🎒", who: isHome, near: ids("school", "community_centers"), radius: 6 },
  { id: "park_view", label: "Park View", emoji: "🌳", who: isHome, near: isPark, radius: 4 },
  { id: "waterfront", label: "Waterfront", emoji: "🌊", who: (d) => isHome(d) || isFood(d), near: (d) => isWater(d) || isBeach(d), radius: 3, coastal: true },
  { id: "transit_oriented", label: "Transit-Oriented", emoji: "🚉", who: (d) => isOffice(d) || isRetail(d) || isHome(d), near: isTransit, radius: 5 },
  { id: "rail_freight", label: "Rail Freight", emoji: "🚂", who: ids("factories", "coal_powerplants", "trash_compacting_plants", "plantations", "data_centers"), near: isRail, radius: 3 },
  { id: "grid_adjacent", label: "Grid-Adjacent", emoji: "⚡", who: ids("data_centers", "factories", "desalination_plant"), near: isPowerGen, radius: 6 },
  { id: "tourist_magnet", label: "Tourist Magnet", emoji: "📸", who: (d) => isFood(d) || isRetail(d) || ids("bars", "the_london_eye")(d), near: isLandmark, radius: 8 },
  { id: "parish", label: "Parish", emoji: "⛪", who: (d) => d.category === "faith" && d.id !== "graveyards", near: (d) => isHome(d) || d.id === "graveyards", radius: 5, min: 2 },
  { id: "harbor_cluster", label: "Harbor Cluster", emoji: "⚓", who: isNaval, near: isNaval, radius: 6 },
  { id: "beachfront", label: "Beachfront", emoji: "🏖️", who: ids("beach_houses", "villas", "restaurants", "bars", "beach_umbrellas"), near: isBeach, radius: 3, coastal: true },
  { id: "civic_center", label: "Civic Center", emoji: "🏛️", who: (d) => (d.government ?? 0) > 0, near: (d) => (d.government ?? 0) > 0 || isPark(d), radius: 5 },
  { id: "safe_streets", label: "Safe Streets", emoji: "🚓", who: isRetail, near: (d) => (d.policeRadius ?? 0) > 0, radius: 6 },
];

// ---------------------------------------------------------------------------------------------
// Layout analysis (cached)
// ---------------------------------------------------------------------------------------------

export interface LayoutAnalysis {
  key: string;
  pollution: Float32Array;
  landValue: Float32Array;
  /** element id -> active synergy ids */
  synergies: Map<string, string[]>;
}

let cached: LayoutAnalysis | null = null;
let coastalMask:{key:string|number,values:Uint8Array}|undefined;

function layoutKey(elements: PlacedElement[]): string {
  let s = "";
  for (const e of elements) s += `${e.id}:${e.defId}@${e.gx},${e.gz},${e.spanX}x${e.spanZ}L${e.level}${e.onFire ? "F" : ""};`;
  return s;
}

function centerOf(e: PlacedElement): [number, number] {
  return [e.gx + e.spanX * 0.5, e.gz + e.spanZ * 0.5];
}

/** Edge-to-edge tile distance between two footprints (0 = touching) */
function footprintGap(a: PlacedElement, b: PlacedElement): number {
  const dx = Math.max(0, Math.max(a.gx - (b.gx + b.spanX), b.gx - (a.gx + a.spanX)));
  const dz = Math.max(0, Math.max(a.gz - (b.gz + b.spanZ), b.gz - (a.gz + a.spanZ)));
  return Math.hypot(dx, dz);
}

export function analyzeLayout(
  elements: PlacedElement[],
  isCoastal: (gx: number, gz: number) => boolean,
  terrainRevision: string | number = 0,
): LayoutAnalysis {
  const key = terrainRevision + "|" + layoutKey(elements);
  if (cached && cached.key === key) return cached;

  const pollution = new Float32Array(FIELD_N * FIELD_N);
  const landValue = new Float32Array(FIELD_N * FIELD_N).fill(0.5);

  const splat = (field: Float32Array, cx: number, cz: number, strength: number, radius: number) => {
    const r = Math.ceil(radius);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > radius) continue;
        const idx = fieldIndex(Math.floor(cx + dx), Math.floor(cz + dz));
        if (idx < 0) continue;
        field[idx] += strength * (1 - d / (radius + 0.75));
      }
    }
  };

  for (const e of elements) {
    const def = ELEMENT_BY_ID[e.defId];
    if (!def) continue;
    const [cx, cz] = centerOf(e);
    const p = basePollution(def);
    if (p !== 0) {
      // Emitters pollute more and absorbers (trees, parks) clean more as they level up.
      const strength = p * levelMultiplier("pollution", e.level);
      const radius = p > 0 ? 2.5 + Math.sqrt(strength) * 1.6 : 2 + Math.sqrt(-strength) * 1.2;
      splat(pollution, cx, cz, strength * (e.onFire ? 1.5 : 1), radius);
    }
    const des = DESIRABILITY[def.id];
    if (des) splat(landValue, cx, cz, des[0] * levelMultiplier("desirability", e.level), des[1] + (levelMultiplier("desirability", e.level) - 1) * 3);
  }

  // Ordinary construction changes the pollution field, while the much larger coastline rarely changes.
  if(!coastalMask||coastalMask.key!==terrainRevision){
    const values=new Uint8Array(FIELD_N*FIELD_N);
    for(let x=0;x<FIELD_N;x++)for(let z=0;z<FIELD_N;z++)values[x*FIELD_N+z]=Number(isCoastal(x+FIELD_MIN,z+FIELD_MIN));
    coastalMask={key:terrainRevision,values};
  }
  // Coast & water adjacency bonus, pollution penalty
  for (let ix = 0; ix < FIELD_N; ix++) {
    for (let iz = 0; iz < FIELD_N; iz++) {
      const idx = ix * FIELD_N + iz;
      if (pollution[idx] < 0) pollution[idx] *= 0.6;
      pollution[idx] = Math.max(-2, Math.min(12, pollution[idx]));
      if(coastalMask.values[idx])landValue[idx]+=.25;
      landValue[idx] -= Math.max(0, pollution[idx]) * 0.11;
      landValue[idx] += Math.max(0, -pollution[idx]) * 0.05;
      landValue[idx] = Math.max(0, Math.min(2, landValue[idx]));
    }
  }

  // Synergies — O(n²) but cached per layout
  const synergies = new Map<string, string[]>();
  const builds = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return d && !(d.isNetwork && !d.isRailNetwork && !d.isWaterFeature);
  });
  for (const e of builds) {
    const def = ELEMENT_BY_ID[e.defId]!;
    if (def.isNetwork) continue;
    const active: string[] = [];
    for (const rule of SYNERGY_RULES) {
      if (!rule.who(def)) continue;
      let count = 0;
      const need = rule.min ?? 1;
      if (rule.coastal) {
        const [cx, cz] = centerOf(e);
        if (isCoastal(Math.floor(cx), Math.floor(cz))) count = need;
      }
      if (count < need) {
        for (const o of builds) {
          if (o === e || o.onFire) continue;
          const od = ELEMENT_BY_ID[o.defId]!;
          if (!rule.near(od)) continue;
          if (footprintGap(e, o) <= rule.radius) {
            count += 1;
            if (count >= need) break;
          }
        }
      }
      if (count >= need) active.push(rule.id);
    }
    if (active.length > 0) synergies.set(e.id, active);
  }

  cached = { key, pollution, landValue, synergies };
  return cached;
}

export function sampleFieldAvg(field: Float32Array, e: PlacedElement): number {
  let sum = 0;
  let n = 0;
  for (let dx = 0; dx < e.spanX; dx++) {
    for (let dz = 0; dz < e.spanZ; dz++) {
      const idx = fieldIndex(e.gx + dx, e.gz + dz);
      if (idx >= 0) {
        sum += field[idx];
        n += 1;
      }
    }
  }
  return n ? sum / n : 0;
}

/** Output multiplier from active synergies: +12% each, capped at +48% */
export function synergyMultiplier(count: number): number {
  return 1 + Math.min(4, count) * 0.12;
}

/** Housing population multiplier from land value (0..2) → 0.75..1.55 */
export function landValuePopMultiplier(lv: number): number {
  return 0.75 + Math.min(2, Math.max(0, lv)) * 0.4;
}

export function roadCapacity(def: CivElementDef, level: number): number {
  const base = ROAD_CAPACITY[def.id] ?? (def.isRoadNetwork ? 8 : 0);
  return base * standardRoadLanes(def.id,level) / standardRoadLanes(def.id,1) * (1 + (level - 1) * .17);
}

/** Trips removed from the road network by transit (per Lv.1 station) */
const TRANSIT_RELIEF: Record<string, number> = {
  bus_stops: 14,
  bus_depots: 40,
  train_stops: 45,
  train_depots: 90,
  taxi_depots: 22,
};

/** Nominal relief rating of a stop/station (reference figure; live relief comes from mobility.reliefAtStops). */
export function transitRelief(def: CivElementDef, level: number): number {
  const base = TRANSIT_RELIEF[def.id] ?? 0;
  return base * levelMultiplier("output", level) * 0.6;
}

/** Trips a building puts on the road at Lv.1 (before level scaling) */
export function tripsFor(def: CivElementDef): number {
  if (def.isNetwork || def.passiveNature) return 0;
  let t = 0;
  if (def.popBase) t += def.popBase / 6;
  if (def.jobs) t += def.jobs / 10;
  if (def.category === "commerce") t += 2;
  if (def.category === "landmarks") t += 6;
  return t;
}

/** Rush hour demand curve by time of day */
export function rushHourFactor(timeOfDay: number): number {
  const t = ((timeOfDay % 24) + 24) % 24;
  const peak = (center: number, w: number) => Math.exp(-((t - center) ** 2) / (2 * w * w));
  // Departures ramp up before the morning commute and taper off after sunset.
  const daytime = Math.max(0, Math.min(1, (t - 5) / 2.5, (22 - t) / 3.5));
  return 0.23 + 0.62 * daytime + 0.55 * peak(8, 0.9) + 0.55 * peak(17.75, 1.0);
}

/** Daylight 0..1 */
export function daylight(timeOfDay: number): number {
  const t = ((timeOfDay % 24) + 24) % 24;
  if (t < 6 || t > 19.5) return 0;
  return Math.max(0, Math.sin(((t - 6) / 13.5) * Math.PI));
}

export type PowerKind = "solar" | "wind" | "hydro" | "fossil" | "nuclear" | "geo" | "waste";

export function powerKind(def: CivElementDef): PowerKind | null {
  if ((def.power ?? 0) <= 0) return null;
  if (def.id === "solar_panels" || def.id === "solar_farms" || def.id === "solar_canopy_orchard") return "solar";
  if (def.id === "windmills" || def.id === "wind_turbines" || def.id === "wind_farms") return "wind";
  if (def.id === "hydro_electric_power_plants") return "hydro";
  if (def.id === "nuclear_power_plants" || def.id === "micro_reactor_nuclear") return "nuclear";
  if (def.id === "geothermal_power_plants") return "geo";
  if (def.id === "trash_burning_plants") return "waste";
  return "fossil";
}

/** Live output factor for power sources given the sky */
export function powerOutputFactor(
  kind: PowerKind,
  timeOfDay: number,
  weather: string,
  windSpeed: number,
): number {
  const cloud = weather === "storm" ? 0.3 : weather === "rain" ? 0.45 : weather === "cloudy" ? 0.65 : 1;
  switch (kind) {
    case "solar":
      // panels include a little battery buffer so nights aren't pitch-black
      return 0.18 + 0.95 * daylight(timeOfDay) * cloud;
    case "wind": {
      const storm = weather === "storm" ? 1.35 : weather === "rain" ? 1.1 : 1;
      return Math.max(0.35, Math.min(1.7, (0.45 + 0.6 * windSpeed) * storm));
    }
    case "hydro":
      return weather === "rain" || weather === "storm" ? 1.25 : 1;
    default:
      return 1;
  }
}

/** $ per tick to keep a building running (services & utilities without their own income) */
export function upkeepFor(def: CivElementDef, level: number): number {
  if (def.isNetwork) return def.isRoadNetwork || def.isRailNetwork ? 0.04 * level : 0;
  if (def.passiveNature) return 0;
  if (def.popBase && def.category === "housing") return 0;
  if ((def.income ?? 0) > 0) return 0;
  return def.cost * 0.008 * levelMultiplier("upkeep", level);
}

/** Lv.1 pollution an element emits (positive) or absorbs (negative). */
export function basePollution(def: CivElementDef): number {
  return POLLUTION[def.id] ?? (def.nuisanceRadius ? def.nuisanceRadius * 0.6 : 0);
}

/**
 * Nominal per-element contribution at a level, before situational factors (road access, staffing,
 * weather, synergies, disrepair, district bonuses). The simulation and economy multiply these same
 * figures by those factors, so this is both the production formula and what inspectors report.
 * Positive numbers are supplied, `powerDraw`/`waterDraw` are consumed.
 */
export interface ElementLevelStats {
  level: number;
  population: number;
  jobs: number;
  power: number;
  powerDraw: number;
  water: number;
  waterDraw: number;
  waste: number;
  /** Harvest (farms, fields, modules) or retail food throughput (grocers, restaurants) basis */
  food: number;
  education: number;
  recreation: number;
  government: number;
  police: number;
  military: number;
  /** Export earnings basis ($ per tick) */
  income: number;
  policeRadius: number;
  fireRadius: number;
  nuisanceRadius: number;
  /** Pollution emitted (> 0) or absorbed (< 0) */
  pollution: number;
  upkeep: number;
  trips: number;
}

/** Sites whose food output is a harvest (yield follows the "crop" curve). */
export const CROP_SITE_IDS: ReadonlySet<string> = new Set([
  ...FARM_ANCHOR_IDS,
  ...FARM_MODULE_IDS,
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
/** Sites whose food output is retail throughput (follows the "retail" curve). */
export const isRetailFoodSite = (def: CivElementDef) =>
  def.id === "grocery_store" || def.id === "growers_exchange" || def.id === "bakery_coop" || def.id === "malls" || def.archetype === "restaurant_bar";

export function elementLevelStats(def: CivElementDef, level: number): ElementLevelStats {
  const out = levelMultiplier("output", level);
  const draw = levelMultiplier("draw", level);
  const pos = (v?: number) => Math.max(0, v ?? 0);
  const neg = (v?: number) => Math.max(0, -(v ?? 0));
  const isRetail = isRetailFoodSite(def);
  const food = CROP_SITE_IDS.has(def.id) || def.id === "farm_houses"
    ? pos(def.food ?? 8) * levelMultiplier("crop", level)
    : isRetail
      ? pos(def.food ?? 24) * levelMultiplier("retail", level)
      : pos(def.food) * out;
  return {
    level: Math.min(5, Math.max(1, Math.floor(level) || 1)),
    population: pos(def.popBase) * out,
    jobs: pos(def.jobs) * out,
    power: pos(def.power) * out,
    powerDraw: neg(def.power) * draw,
    water: pos(def.water) * out,
    waterDraw: neg(def.water) * draw,
    waste: pos(def.waste) * out,
    food,
    education: pos(def.education) * out,
    recreation: pos(def.recreation) * out,
    government: pos(def.government) * out,
    police: pos(def.police) * out,
    military: pos(def.military) * out,
    income: pos(def.income) * out,
    policeRadius: scaledRadius(pos(def.policeRadius), level),
    fireRadius: scaledRadius(pos(def.fireRadius), level),
    nuisanceRadius: scaledRadius(pos(def.nuisanceRadius), level),
    pollution: basePollution(def) * levelMultiplier("pollution", level),
    upkeep: upkeepFor(def, level),
    trips: tripsFor(def) * levelMultiplier("trips", level),
  };
}

// ---------------------------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------------------------

export interface AchievementDef {
  id: string;
  title: string;
  detail: string;
  emoji: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_citizens", title: "First Citizens", detail: "Welcome your first residents.", emoji: "🏡" },
  { id: "pop_1k", title: "Small Town", detail: "Reach 1,000 population.", emoji: "🏘️" },
  { id: "pop_100k", title: "Big City", detail: "Reach 100,000 population.", emoji: "🌆" },
  { id: "pop_1m", title: "Megacity", detail: "Reach 1,000,000 population.", emoji: "🌃" },
  { id: "legendary", title: "Legendary", detail: "Level any element up to Lv.5.", emoji: "🌟" },
  { id: "five_legends", title: "Hall of Legends", detail: "Own five Lv.5 elements.", emoji: "🏆" },
  { id: "bridge_builder", title: "Bridge Builder", detail: "Span water with a bridge.", emoji: "🌉" },
  { id: "skyline", title: "Skyline", detail: "Build 5 skyscrapers.", emoji: "🏙️" },
  { id: "green_grid", title: "Green Grid", detail: "Run on 80%+ renewable power with 200+ supply.", emoji: "🌱" },
  { id: "synergist", title: "Synergist", detail: "Have 25 active synergies at once.", emoji: "✨" },
  { id: "free_flow", title: "Free Flowing", detail: "Keep congestion under 40% with 100+ trips.", emoji: "🚦" },
  { id: "clean_air", title: "Clean Air", detail: "Average pollution near zero with 30+ buildings.", emoji: "🍃" },
  { id: "prime_real_estate", title: "Prime Real Estate", detail: "Average home land value above 1.2.", emoji: "💎" },
  { id: "transit_city", title: "Transit City", detail: "Carry 40% of trips on transit.", emoji: "🚇" },
  { id: "wonder", title: "Wonder of the World", detail: "Complete a landmark at Lv.5.", emoji: "🗼" },
  { id: "admiral", title: "Admiral", detail: "Float an aircraft carrier.", emoji: "⚓" },
  { id: "happy_place", title: "Happiest Place", detail: "100% happiness with 5,000+ citizens.", emoji: "😄" },
  { id: "tycoon", title: "Tycoon", detail: "Hold $1,000,000 in the treasury.", emoji: "💰" },
];
