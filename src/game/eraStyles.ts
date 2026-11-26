import { ELEMENT_BY_ID, getElementLevelName, getMaxElementLevel } from "./catalog";
import { FEATURED_TYPES, PERIODS, productionPeriod, type ProductionEra } from "./periods";
import { ART_VARIANTS, productionArtFamily } from "./designs/periodArtCatalog";

export type RomeDirection = "rome-forum" | "rome-aqueduct";
export type EraKey = "original" | "rome-forum" | ProductionEra;
export const ERA_LABELS = {
  original:"Original", ...Object.fromEntries(Object.entries(PERIODS).map(([key,value])=>[key,value.label])),
  "rome-forum":"Rome · Forum City",
} as Record<EraKey,string>;
export type EraActivity = "active" | "idle";
export const normalizeEra = (value: unknown): EraKey => typeof value === "string" && Object.hasOwn(ERA_LABELS,value) ? value as EraKey : "original";

const families = {
  house: {
    levels:["Threshold House","Atrium House","Garden Domus","Peristyle Villa","Two-Court Villa"],
    description:"Bedrooms and tiled wings enclose a small court. The street gate opens onto a shallow rain basin.",
    variants:["Impluvium pool","Mosaic court","Olive court","Votive shrine"], activity:"Household windows take their light from the parcel.",
  },
  apartment: {
    levels:["Street Chambers","Insula Walk-up","Gallery Insula","Arcaded Tenement","Roof-Garden Insula"],
    description:"Stacked apartments rise above a pedestrian arcade. Shared galleries and a stepped roof court mark the upper levels.",
    variants:["Corner belvedere","Split upper wing","Garden terrace","Painted stair tower"],activity:"Occupied windows follow the city lighting.",
  },
  market: {
    levels:["Street Counter","Awning Market","Forum Exchange","Arcaded Market Hall","Grand Macellum"],
    description:"Painted stall awnings enclose an open selling court. Cargo bays remain visible at street level.",
    variants:["Wine and amphorae","Grain and baskets","Olive oil and jars","Woven textiles"],activity:"A working market stocks its tables. Idle counters are bare.",
  },
  farm: {
    levels:["Garden Allotment","Irrigated Plot","Farmstead","Press and Granary","Harvest Estate"],
    description:"Furrows, a stone irrigation leat, and increasingly large farm buildings organize the estate around its working fields.",
    variants:["Wheat rows","Vine trellises","Olive orchard","Market vegetables"],activity:"Supplied irrigation fills the leat; dry channels expose the bed.",
  },
  water: {
    levels:["Public Basin","Settling Baths","Bathhouse Works","Reservoir Court","Imperial Waterworks"],
    description:"A descending feeder channel empties into a stepped basin beside a vaulted bath hall. Larger works add cisterns and a drum roof.",
    variants:["Round plunge pool","Stepped basin","Twin basins","Mosaic bath"],activity:"Connected supply fills the channel and pools. Loss of supply leaves visible dry stone.",
  },
  power: {
    levels:["Sun Mirror","Mirror Court","Solar Foundry","Heliostat Terrace","Imperial Sunworks"],
    description:"Polished bronze mirrors on masonry pedestals collect sunlight for an imagined Roman power works. The central furnace marks its function.",
    variants:["Bronze dishes","Silver reflectors","Fan reflectors","Paired mirrors"],activity:"The receiving hearth brightens when the works are active.",
  },
  road: {
    levels:["Gravel Way","Surveyed Lane","Set-Stone Way","Curbside Way","Market Street","Milestone Way","Processional Road","Paved Avenue","Patrician Avenue","Triumphal Approach","Imperial Via"],
    description:"Coursed paving and a drain trace the existing road deck, curb, ramps and building entrances. Broader roads retain their divided carriageways.",
    variants:["Basalt blocks","Brick herringbone","Travertine courses","Banded stone"],activity:"Traffic continues along the original lanes.",
  },
  track: {
    levels:["Timber Guideway","Bronze Rails","Waymarked Line","Signal Route","Imperial Main Line"],
    description:"Period paving frames a working rail bed. The two rails and their turning paths stay visible through each join.",
    variants:["Brick ballast","Cut stone bed","Clay sleepers","Dark ballast"],activity:"Vehicles follow the actual rail line.",
  },
  bridge: {
    levels:["Stone Crossing","Mason’s Bridge","Cutwater Bridge","Lantern Crossing","Parapet Bridge","Guild Crossing","Waymarked Bridge","Consular Crossing","Processional Span","Triumphal Bridge","Imperial Crossing"],
    description:"Stone courses pick out the canonical deck and parapets. Open spans preserve the view under the bridge.",
    variants:["Limestone coping","Brick arches","Pale banding","Dark masonry"],activity:"Traffic keeps its route across the original deck.",
  },
  aqueduct: {
    levels:["Single Arcade","Feeder Arcade","Double Arcade","High Watercourse","Imperial Aqueduct"],
    description:"Deep masonry arches carry a clearly edged channel. The channel surface follows water service.",
    variants:["Travertine voussoirs","Brick piers","Banded spandrels","Dark cut stone"],activity:"Water in the channel is visible only while supplied.",
  },
  station: {
    levels:["Passenger Halt","Shaded Platform","Arcade Station","Passenger Terminus","Imperial Terminal"],
    description:"A canopy and arch screen frame the boarding edge. The open strip beside the neighboring rails remains the actual passenger platform.",
    variants:["Canvas canopy","Pedimented entrance","Bronze kiosks","Barrel-vault canopy"],activity:"Travelers appear on the platform when a service is present.",
  },
  landmark: {
    levels:["Sky Survey Court","Star Terrace","Orrery Hall","Celestial Observatory","Imperial Star Port"],
    description:"An open-air armillary sphere rises above an astronomical court. Its original gameplay function is a spaceport.",
    variants:["Ecliptic ring","Lunar instrument","Brass zodiac","Stellar globe"],activity:"The astronomical instrument moves when the site operates.",
  },
} as const;

export type RomeFamily = keyof typeof families;
const entries = {
  house:["house","Domus"], townhomes:["apartment","Street Insulae"], apartments:["apartment","Insula"], apartment_buildings:["apartment","Great Insula"],
  grocery_store:["market","Forum Market"], businesses:["market","Tabernae"], shops:["market","Provision Arcade"],
  farms:["farm","Villa Rustica"], farm_houses:["farm","Estate Farmhouse"], fields:["farm","Irrigated Fields"],
  water_treatment_plant:["water","Bathhouse Waterworks"], water_pumping_station:["water","Castellum Aquae"],
  solar_panels:["power","Helios Mirror Court"], solar_farms:["power","Imperial Mirror Field"],
  roads:["road","Via"], two_lane_roads:["road","Merchant Road"], highways:["road","Consular Highway"], freeways:["road","Imperial Highway"],
  train_tracks:["track","Bronze Guideway"], bridges:["bridge","Pons"], stone_bridges:["bridge","Masons’ Crossing"], aqueduct:["aqueduct","Aqua Claudia"],
  train_stops:["station","Passenger Terminus"], train_depots:["station","Waystation Depot"], spaceport:["landmark","Celestial Observatory"],
} as const satisfies Record<string,readonly [RomeFamily,string]>;

export const ROME_PILOT_IDS: readonly string[] = Object.keys(entries);
export interface RomeElementSpec {
  name:string; family:RomeFamily | ReturnType<typeof productionArtFamily>; levels:readonly string[]; variants:readonly string[];
  description:string; activity:string; aliases: readonly string[];
}
const specs = new Map<string,RomeElementSpec>(Object.entries(entries).map(([id,[family,name]]) => [
  id,{...families[family],family,name,aliases:[id.replaceAll("_"," "),name]},
]));
const productionSpecs = new Map<string,RomeElementSpec>();
export function eraElementSpec(id:string, era:unknown):RomeElementSpec | undefined {
  const key=normalizeEra(era);
  if(key==="original") return undefined;
  if(key==="rome-forum" || (key==="rome-aqueduct" && specs.has(id))) return specs.get(id);
  const def=ELEMENT_BY_ID[id];
  if(!def || def.category==="christmas") return undefined;
  const cacheKey=key+"/"+id;
  const cached=productionSpecs.get(cacheKey);
  if(cached) return cached;
  const period=productionPeriod(key);
  const featured=FEATURED_TYPES.findIndex(type=>type===id);
  const family=productionArtFamily(id);
  let hash=0;
  for(const char of id) hash=(hash*31+char.charCodeAt(0))>>>0;
  const name=featured>=0 ? period.names[featured] : period.districts[hash%period.districts.length]+" "+def.name;
  const levels=Array.from({length:getMaxElementLevel(id)},(_,i)=>name+" · "+getElementLevelName(def,i+1));
  const activity=family==="market" ? families.market.activity : family==="station" ? families.station.activity :
    family==="aqueduct" ? families.aqueduct.activity : family==="water" || family==="farm" ? families.water.activity :
    def.isNetwork ? "Vehicles and services use the original connections." : "Service and maintenance use the island’s normal rules.";
  const result={name,family,levels,variants:ART_VARIANTS[key],description:period.description,activity,aliases:[name,def.name,id.replaceAll("_"," ")]};
  productionSpecs.set(cacheKey,result);return result;
}
export function eraElementName(id:string, era:unknown): string {
  return eraElementSpec(id,era)?.name ?? ELEMENT_BY_ID[id]?.name ?? id;
}
export function eraLevelName(id:string, level:number, era:unknown): string {
  const names=eraElementSpec(id,era)?.levels;
  if(names) return names[Math.min(names.length-1,Math.max(0,Math.floor(level)-1))];
  return ELEMENT_BY_ID[id] ? getElementLevelName(ELEMENT_BY_ID[id],level) : `Level ${level}`;
}
