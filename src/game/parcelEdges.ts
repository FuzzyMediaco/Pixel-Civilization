import { SKYLINE_GOVERNMENT_IDS } from "./skylineCatalog";
import { FARM_ANCHOR_IDS,FARM_MODULE_IDS,SCHOOL_IDS } from "./expansionCatalog";
import { ELEMENT_BY_ID, type CivElementDef } from "./catalog";
import type { RoadAccessKind } from "./roadTopology";
import { getTerrainCell, roadPortOpen } from "./terrain";
import type { GameState, PlacedElement } from "./simulation";

export type LocalSide = "back" | "right" | "front" | "left";
export type EdgeOverride = "auto" | "open" | "closed";
export type ParcelPose = Pick<PlacedElement, "defId" | "gx" | "gz" | "spanX" | "spanZ" | "rotation"> & {
  edgeOverrides?: Partial<Record<LocalSide, EdgeOverride>>;
  autoDrive?: {side:LocalSide;slot:number};
};
export const PARCEL_SIDES: readonly LocalSide[] = ["back", "right", "front", "left"];
const offsets = [[0,-1],[1,0],[0,1],[-1,0]] as const;

export type JoinKind = "yard" | "party" | "garden" | "farm" | "orchard" | "cloister" | "arcade" | "drive"
  | "road" | "rail" | "channel" | "walk" | "platform" | "bus" | "freight" | "intake" | "irrigation" | "quay" | "beach"
  | "habitat" | "buffer" | "service" | "power" | "ceremonial" | "heat" | "dock" | "transfer" | "skywalk";
/** Used by the field guide and build preview so decorative boundaries and working connections
 * have distinct explanations. A water fitting can be visible while waiting for supply. */
export const EDGE_LABELS: Record<JoinKind,string> = {
  road:"Road lanes",rail:"Through railway",channel:"Waterway",yard:"Shared yard",party:"Shared side wall",
  garden:"Kitchen garden gate",farm:"Shared farm lane",orchard:"Pollinator planting",cloister:"Churchyard gate",
  arcade:"Shared shopping frontage",drive:"Driveway",walk:"Footpath",platform:"Trackside boarding",
  bus:"Curbside boarding",freight:"Loading access",intake:"Water intake",irrigation:"Irrigation turnout",
  quay:"Quay",beach:"Continuous sand",habitat:"Habitat corridor",buffer:"Planted buffer",service:"Service access",
  power:"Power connection",ceremonial:"Public promenade",heat:"Shared heat pipe",dock:"Berth",
  transfer:"Passenger access",skywalk:"Glazed skybridge",
};

export interface ParcelEdge {
  side: LocalSide;
  /** Tile offset increasing along the local x or z axis, even on the opposite side. */
  slot: number;
  kind: JoinKind;
  neighbor: string;
  /** True only where this actual contact meets replenished surface water. */
  flowing?: boolean;
  /** Metres from this bank to an adjoining utility maintenance landing. */
  stairRise?: number;
}
const ids = (members: string) => new Set(members.split(" "));
const farms = new Set([...FARM_ANCHOR_IDS,...FARM_MODULE_IDS,...ids("farm_houses farms fields orchards groves_of_olives plantations solar_canopy_orchard terraced_glasshouses")]);
const rows = new Set([...FARM_ANCHOR_IDS,...FARM_MODULE_IDS]);
const greens = ids("supertree_grove park little_parks large_parks gardens italian_gardens floodplain_park shoreline_overlook");
const foodOutlets = ids("grocery_store restaurants cheesesteak_restaurants growers_exchange bakery_coop");
const publicFaith = ids("churches christian_churches monasteries temples synagogues mosques lds_temples bell_tower_chapel stone_abbey zen_shrine meditation_pavilion");
const viewers = ids("guggenheim_bilbao large_landmarks washington_monument white_house smithsonian eiffel_tower the_london_eye the_great_pyramids colosseum stonehenge parthenon great_wall chichen_itza moai_statues angkor_wat machu_picchu civic_observatory solar_spire_arcology");
const fresh = ids("rivers wide_rivers canals aqueduct municipal_reservoir");
const basins = ids("rivers wide_rivers canals water_tile lakes ponds swamps municipal_reservoir");
const shore = ids("beaches beach_houses beach_umbrellas sand boardwalks shoreline_overlook tidal_pool_walk");
const publicWalks = ids("paths walking_paths side_walks pretty_roads trails boardwalks");
const ports = ids("docks naval_base submarine_base shipyards ship_building_areas ferry_landings ferry_exchange canal_boat_lift maritime_college ocean_habitat_ring coast_rescue_station harbor_patrol_pier naval_shipyard_base naval_coast_guard_base naval_destroyer_dock naval_carrier_berth naval_amphibious_dock marine_amphib_base seafood_pier boatyard_slipway colossus_lighthouse maritime_museum");
export const vesselIds = ids("boats sail_boats speed_boats naval_vessels submarines aircraft_carriers naval_patrol_cutter naval_frigate_ship naval_minesweeper naval_hospital_ship harbor_tugboat coastal_corvette");
const fuelIndustry = ids("factories trash_burning_plants trash_compacting_plants landfill coal_powerplants natural_gas_power_plants");
const industrial = ids("factories landfill trash_compacting_plants coal_powerplants natural_gas_power_plants trash_burning_plants blacksmiths data_centers open_pit_mine materials_foundry freight_rail_terminal nuclear_power_plants geothermal_power_plants micro_reactor_nuclear recycling_center compost_works");
const wetUtil = ids("water_treatment_plant water_pumping_station hydro_electric_power_plants municipal_reservoir aqueduct water_reuse_works pumped_storage_station tidal_sluice");
const supply = ids("water_treatment_plant water_pumping_station municipal_reservoir aqueduct wells water_towers desalination_plant rainwater_cathedral water_reuse_works spring_house tidal_sluice");
const civic = new Set([...SKYLINE_GOVERNMENT_IDS, "city_offices", "government_buildings", "courthouses", "post_offices", "community_centers", "tax_collecting_office", "public_library"]);
const agencies = ids("police_precinct police_departments jails prisons military_base swat_team_hq airforce_base fire_department police_heli_pad medevac_heli_pad fire_heli_base emergency_dispatch k9_police_unit forensic_crime_lab hazmat_response fire_academy traffic_precinct riot_command_center search_rescue_hq civil_defense_bunker army_garrison army_signal_corps army_logistics_depot army_airborne_school army_engineer_base army_medical_corps strategic_bomber_wing stealth_bomber_hangar fighter_wing_base airlift_cargo_base awacs_radar_base drone_recon_base marine_corps_base marine_aviation_wing");
const flora = ids("trees plants shrubs bushes pine_trees redwood_trees swamps ponds lakes hills mountains canyons deserts tubbleweeds alligators");
const hardRoad = ids("highways freeways over_passes underpasses suspension_bridges stone_bridges bridges");
const localRoad = (d: CivElementDef) => d.isRoadNetwork && !hardRoad.has(d.id) && !["paths","walking_paths","trails","side_walks","boardwalks"].includes(d.id);
const heatUsers = ids("community_centers apartments apartment_buildings condos malls factories terraced_glasshouses hanging_garden_arcology mixed_use_midrise");
const transit = ids("bus_stops train_stops bus_depots taxi_ranks taxi_depots ferry_landings ferry_exchange regional_airport flying_car_depot teleportation_depot tram_station");
const tall = ids("skyscrapers buildings hanging_garden_arcology skybridge_university penthouse_tower solar_spire_arcology");
const pupils = new Set([...SCHOOL_IDS,...ids("school community_centers smithsonian skybridge_university maritime_college public_library")]);
const heatSources = ids("trash_burning_plants geothermal_power_plants data_centers district_heat_works");
const frontage = (d: CivElementDef) => d.category === "commerce" && !industrial.has(d.id) && d.id !== "gas_stations";
const electric = (d: CivElementDef) => (d.power ?? 0) > 0;
const pair = (a: string, b: string, x: string, y: string) => (a === x && b === y) || (a === y && b === x);
const sideIndex = (s: LocalSide) => PARCEL_SIDES.indexOf(s);
const normalized = (r: number) => ((r % 4) + 4) % 4;

/** The design front is +Z. A positive THREE quarter turn sends +Z to +X. */
function localSide(world: number, rotation: number): LocalSide {
  return PARCEL_SIDES[normalized(world + rotation)];
}
function slotAt(e: ParcelPose, worldSide: number, gx: number, gz: number): number {
  const x = gx - e.gx, z = gz - e.gz;
  const rotation = normalized(e.rotation);
  const lx = [x, e.spanZ - z - 1, e.spanX - x - 1, z][rotation];
  const lz = [z, x, e.spanZ - z - 1, e.spanX - x - 1][rotation];
  return normalized(worldSide + rotation) % 2 === 0 ? lx : lz;
}

function joint(a: CivElementDef, b: CivElementDef, sa: LocalSide, sb: LocalSide, aligned: boolean, explicit: boolean): JoinKind | undefined {
  const x = a.id, y = b.id;
  if (a.isNetwork && b.isNetwork) {
    if(a.isRoadNetwork && b.isRoadNetwork) return publicWalks.has(x) || publicWalks.has(y) ? "walk" : "road";
    if(a.isRailNetwork && b.isRailNetwork) return "rail";
    if(a.isWaterFeature && b.isWaterFeature) return "channel";
  }
  const bothHomes = a.category === "housing" && b.category === "housing";
  if (tall.has(x) && tall.has(y) && aligned && (sa==="left" || sa==="right")) return "skywalk";
  if (bothHomes) {
    if (x === "townhomes" && y === "townhomes" && aligned && (sa === "left" || sa === "right")) return "party";
    return sa !== "front" && sb !== "front" ? "yard" : undefined;
  }
  if ((a.category === "housing" && y === "gardens" && (sa === "back" || explicit)) ||
      (b.category === "housing" && x === "gardens" && (sb === "back" || explicit))) return "garden";
  if ((x==="high_school"&&y==="sports_field")||(y==="high_school"&&x==="sports_field")||(["university","skybridge_university"].includes(x)&&["research_institute","research_university"].includes(y))||(["university","skybridge_university"].includes(y)&&["research_institute","research_university"].includes(x))) return "ceremonial";
  if (farms.has(x) && farms.has(y)) return "farm";
  if (pair(x,y,"gardens","orchards") || pair(x,y,"plants","orchards") || pair(x,y,"gardens","groves_of_olives")) return "orchard";
  if ((farms.has(x) && foodOutlets.has(y)) || (farms.has(y) && foodOutlets.has(x)) || pair(x,y,"windmills","fields") ||
      pair(x,y,"blacksmiths","farms")) return "freight";
  if ((x === "graveyards" && publicFaith.has(y)) || (y === "graveyards" && publicFaith.has(x))) return "cloister";
  if ((transit.has(x) && (frontage(b) || greens.has(y) || transit.has(y) || (b.category==="housing" && (sb==="front" || explicit)))) ||
      (transit.has(y) && (frontage(a) || greens.has(x) || (a.category==="housing" && (sa==="front" || explicit))))) return "transfer";
  // A cashpoint has one public face. The bank's secure rear and a shop's blank wall
  // cannot meet its order screen, even when the rectangles happen to touch.
  if (frontage(a) && frontage(b) && !explicit &&
      ((x==="atms" && sa!=="front") || (y==="atms" && sb!=="front") || sa==="back" || sb==="back")) return undefined;
  if (frontage(a) && frontage(b) && (x === "banks" || y === "banks" || x === "atms" || y === "atms" || x === "shops" || y === "shops")) return "arcade";
  if ((x === "gardens" || rows.has(x)) && (fresh.has(y) || supply.has(y))) return "irrigation";
  if ((y === "gardens" || rows.has(y)) && (fresh.has(x) || supply.has(x))) return "irrigation";
  if ((wetUtil.has(x) && fresh.has(y)) || (wetUtil.has(y) && fresh.has(x))) return "intake";
  if (supply.has(x) && supply.has(y)) return "service";
  if ((x === "water_places" && supply.has(y)) || (y === "water_places" && supply.has(x))) return "service";
  if ((ports.has(x) && vesselIds.has(y)) || (ports.has(y) && vesselIds.has(x))) return "dock";
  if ((ports.has(x) && (basins.has(y) || ports.has(y))) || (ports.has(y) && basins.has(x))) return "quay";
  if ((flora.has(x) && flora.has(y)) || ((x === "alligators" || y === "alligators") && (basins.has(x) || basins.has(y)))) return "habitat";
  if ((shore.has(x) && (shore.has(y) || basins.has(y))) || (shore.has(y) && basins.has(x))) return "beach";
  if ((industrial.has(x) && (flora.has(y) || greens.has(y))) || (industrial.has(y) && (flora.has(x) || greens.has(x)))) return "buffer";
  if ((heatSources.has(x) && heatUsers.has(y)) || (heatSources.has(y) && heatUsers.has(x))) return "heat";
  if ((electric(a) && (electric(b) || industrial.has(y) || y === "desalination_plant")) ||
      (electric(b) && (industrial.has(x) || x === "desalination_plant"))) return "power";
  if ((civic.has(x) || publicFaith.has(x) || viewers.has(x) || x === "school") && (greens.has(y) || civic.has(y) || viewers.has(y))) return "ceremonial";
  if ((civic.has(y) || publicFaith.has(y) || viewers.has(y) || y === "school") && (greens.has(x) || civic.has(x) || viewers.has(x))) return "ceremonial";
  if ((pupils.has(x) && (pupils.has(y) || publicFaith.has(y))) || (pupils.has(y) && publicFaith.has(x))) return "ceremonial";
  if ((x==="thrift_stores" && b.category==="housing") || (y==="thrift_stores" && a.category==="housing")) return "service";
  if ((ports.has(x) && (industrial.has(y) || transit.has(y))) || (ports.has(y) && (industrial.has(x) || transit.has(x)))) return "freight";
  if ((agencies.has(x) && (agencies.has(y) || civic.has(y))) || (agencies.has(y) && civic.has(x))) return "service";
  if ((industrial.has(x) && fuelIndustry.has(y)) || (industrial.has(y) && fuelIndustry.has(x))) return "freight";
  // Rail stops border the continuous line along the rear edge of their model.
  const network = a.isNetwork ? a : b.isNetwork ? b : undefined;
  if (network && !(a.isNetwork && b.isNetwork)) {
    const d = a === network ? b : a, side = a === network ? sb : sa;
    if (network.isRailNetwork && (d.id === "train_stops" || d.id === "train_depots")) return side === "back" || explicit ? "platform" : undefined;
    if (network.isRailNetwork && (industrial.has(d.id) || d.id === "post_offices" || ports.has(d.id))) return side !== "front" || explicit ? "freight" : undefined;
    if ((d.id === "bus_stops" || d.id === "taxi_ranks") && localRoad(network)) return "bus";
    if (localRoad(network) && side === "back" && (industrial.has(d.id) || ports.has(d.id) || d.id === "post_offices" || d.id === "grocery_store")) return "freight";
    if (localRoad(network) && !d.passiveNature) return "drive";
    if (localRoad(network) && greens.has(d.id)) return "walk";
    if (publicWalks.has(network.id) && !vesselIds.has(d.id)) return "walk";
    if (network.isRoadNetwork && !vesselIds.has(d.id) && !d.passiveNature) return "drive";
  }
  if (frontage(a) && frontage(b)) return "arcade";
  if ((publicFaith.has(x) && supply.has(y)) || (publicFaith.has(y) && supply.has(x))) return "service";
  if (greens.has(x) && greens.has(y)) return "walk";
  if ((greens.has(x) && (a.category === b.category || b.category === "housing" || b.category === "commerce")) ||
      (greens.has(y) && (a.category === b.category || a.category === "housing" || a.category === "commerce"))) return "walk";
  return undefined;
}

function acceptsDriveSlot(e: ParcelPose, side: LocalSide, slot: number): boolean {
  const alongLocalX=side==="front" || side==="back";
  const width=(e.rotation%2===0)===alongLocalX ? e.spanX : e.spanZ;
  if (width < 2) return true;
  if (side === "front") {
    if (e.defId === "medium_sized_homes" || e.defId === "large_homes") return slot === Math.min(1,width-1);
    if (e.defId === "mansions") return slot === 0;
  }
  return true;
}

export function getParcelEdges(el: ParcelPose, occupancy: ReadonlyMap<string, PlacedElement>, state?: GameState): ParcelEdge[] {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return [];
  const out: ParcelEdge[] = [];
  for (let world = 0; world < 4; world++) {
    const [dx,dz] = offsets[world], side = localSide(world, def.isNetwork ? 0 : el.rotation);
    if (el.edgeOverrides?.[side] === "closed") continue;
    const length = dx ? el.spanZ : el.spanX;
    for (let i = 0; i < length; i++) {
      const gx = el.gx + (dx > 0 ? el.spanX - 1 : dx === 0 ? i : 0);
      const gz = el.gz + (dz > 0 ? el.spanZ - 1 : dz === 0 ? i : 0);
      const n = occupancy.get(`${gx + dx},${gz + dz}`);
      const slot = slotAt(el,world,gx,gz);
      if (state) {
        const ground = getTerrainCell(state,gx,gz);
        const adjacent = getTerrainCell(state,gx+dx,gz+dz);
        if (!n && adjacent.depth > 0.08) {
          let kind: JoinKind | undefined;
          if (shore.has(def.id)) kind = "beach";
          else if (ports.has(def.id)) kind = "quay";
          else if (wetUtil.has(def.id) && side==="back" && adjacent.water==="fresh" && adjacent.source>0) kind = "intake";
          else if (def.id==="desalination_plant" && side==="back" && adjacent.water==="salt") kind = "intake";
          else if (rows.has(def.id) && adjacent.water==="fresh" && adjacent.source>0) kind = "irrigation";
          else if (flora.has(def.id)) kind = "habitat";
          if(kind) out.push({side,slot,kind,neighbor:adjacent.water==="salt" ? "sea" : "freshwater",flowing:adjacent.source>0});
        }
        if(Math.abs(ground.elevation-adjacent.elevation)>1.25 && !ports.has(def.id) && !wetUtil.has(def.id) && !ports.has(n?.defId??"") && !wetUtil.has(n?.defId??"")) continue;
      }
      if (!n || n === el) continue;
      const other = ELEMENT_BY_ID[n.defId], otherSide = localSide((world + 2) % 4, other?.isNetwork ? 0 : n.rotation);
      if (!other || n.edgeOverrides?.[otherSide] === "closed") continue;
      let kind = joint(def, other, side, otherSide, normalized(n.rotation) === normalized(el.rotation),
        el.edgeOverrides?.[side] === "open" || n.edgeOverrides?.[otherSide] === "open");
      const otherSlot=slotAt(n,(world+2)%4,gx+dx,gz+dz);
      const automatic=Boolean(localRoad(def)&&n.autoDrive?.side===otherSide&&n.autoDrive.slot===otherSlot || localRoad(other)&&el.autoDrive?.side===side&&el.autoDrive.slot===slot);
      if(automatic && !kind)kind="drive";
      if (!automatic && kind === "drive") {
        // Keep wide homes' single neat front garage curb cut when the preferred garage slot is already served by a road;
        // otherwise link automatically on any touching tile so a building next to a road is never left disconnected.
        const checkSlot = (sitePose: ParcelPose, s: LocalSide, sl: number) => {
          if (acceptsDriveSlot(sitePose, s, sl)) return true;
          const prefSlot = sitePose.defId === "mansions" ? 0 : 1;
          const [px, pz] = cellBeyondEdge(sitePose, s, prefSlot);
          const prefNeighbor = occupancy.get(`${px},${pz}`);
          return !(prefNeighbor && ELEMENT_BY_ID[prefNeighbor.defId]?.isRoadNetwork);
        };
        if ((!def.isNetwork && !checkSlot(el, side, slot)) || (!other.isNetwork && !checkSlot(n, otherSide, otherSlot))) continue;
      }
      let stairRise:number|undefined;
      if ((kind==="drive" || kind==="freight" || kind==="bus") && (def.isRoadNetwork || other.isRoadNetwork)) {
        const rx=def.isRoadNetwork?gx:gx+dx, rz=def.isRoadNetwork?gz:gz+dz;
        const dirX=def.isRoadNetwork?dx:-dx, dirZ=def.isRoadNetwork?dz:-dz;
        if(!roadPortOpen(state,rx,rz,dirX,dirZ))continue;
        if(state){
          const span=state.infrastructure?.spans[rx+","+rz];
          const along=span?.axis==="x"?dirX:dirZ;
          // A bridge's outer landing may meet a gate. Its suspended edges and steep inner ramp cannot.
          const roadHeight=span ? (along===span.direction ? span.endHeight : span.startHeight) :
            getTerrainCell(state,rx,rz).elevation;
          if(span && (!span.ramp || !along || roadHeight>Math.min(span.startHeight,span.endHeight)+.05))continue;
          const siteHeight=getTerrainCell(state,rx+dirX,rz+dirZ).elevation;
          const rise=siteHeight-roadHeight;
          if(Math.abs(rise)>1.25){
            const siteDef=def.isRoadNetwork?other:def;
            if(!(wetUtil.has(siteDef.id)||ports.has(siteDef.id)) || Math.abs(rise)>3)continue;
            kind="walk";
            stairRise=def.isRoadNetwork?rise:-rise;
          }
        }
      }
      if (kind === "skywalk" && "level" in el && el.level !== n.level) continue;
      if (kind) {
        const water = state && kind === "irrigation" ? getTerrainCell(state,gx+dx,gz+dz) : undefined;
        // A well can feed the adjacent field turnout directly. Towers, ponds and empty
        // canals need actual water delivery before they can irrigate another site.
        const well = n.defId==="wells" && !n.onFire && !n.disrepair && (!water || water.water!=="salt");
        out.push({side,slot,kind,neighbor:n.defId,stairRise,flowing:well || Boolean(water && water.water==="fresh" && water.depth>0 && water.source>0)});
      }
    }
  }
  return out.sort((a,b) => sideIndex(a.side)-sideIndex(b.side) || a.slot-b.slot);
}

export function getParcelEdgeKey(edges: readonly ParcelEdge[]) {
  return edges.map(e => sideIndex(e.side) + "." + e.slot + "." + e.kind + (e.stairRise ? "."+Math.round(e.stairRise*4):"")).join("/");
}
export function getParcelEffectSummary(edges: readonly ParcelEdge[]) {
  const touched = new Set(edges.map(e => e.kind));
  return {
    food: Number(touched.has("garden")) * 3 + Number(touched.has("orchard")) * 2,
    recreation: Number(touched.has("cloister")) * 5 + Number(touched.has("ceremonial")) * 3 + Number(touched.has("habitat")),
    agriculture: Math.min(0.2, edges.filter(e => e.kind === "farm").length * 0.025),
    commerce: Number(touched.has("arcade")) * 0.08 + Number(touched.has("freight")) * 0.04,
    waste: Number(touched.has("service")) * 2,
    cooling: Number(touched.has("buffer")) * 0.2,
    walking: Number(touched.has("transfer") || touched.has("skywalk")) * 0.04,
    education: Number(touched.has("ceremonial")) * 2,
    heat: Number(touched.has("heat")) * 2,
    bankWater: edges.some(e=>e.kind==="irrigation" && e.flowing),
  };
}

/** Prefer a compatible existing edge, preserve the selected rotation on ties. */
export function autoFrontageRotation(def: CivElementDef, gx: number, gz: number, sx: number, sz: number,
  preferred: number, occupancy: ReadonlyMap<string, PlacedElement>, fits?: (w:number,h:number)=>boolean): number {
  if (def.isNetwork || def.passiveNature || def.domain !== "land") return preferred;
  let best = preferred, bestScore = 0;
  for (let turn = 0; turn < 4; turn++) {
    const r = normalized(preferred + turn);
    const candidate = {defId:def.id,gx,gz,spanX:r%2?sz:sx,spanZ:r%2?sx:sz,rotation:r};
    let overlapping = false;
    for (let x = gx; x < gx + candidate.spanX; x++) for (let z = gz; z < gz + candidate.spanZ; z++) {
      if (occupancy.has(`${x},${z}`)) overlapping = true;
    }
    if (overlapping) continue;
    const score = getParcelEdges(candidate, occupancy).reduce((sum,e) => sum + (
      e.kind==="drive" || e.kind==="freight" || e.kind==="bus" ? 18 : e.kind === "party" || e.kind === "platform" || (def.id==="atms" && e.kind==="arcade") ? 6 : e.kind === "garden" ? 3 : e.kind === "walk" ? 2 : e.kind==="arcade" ? 1 : 0),0);
    if (score > bestScore && (!fits || fits(candidate.spanX,candidate.spanZ))) {best = r; bestScore = score;}
  }
  return best;
}

/** Coordinates immediately across a local tile edge, including reversed tile order at half turns. */
export function cellBeyondEdge(el: ParcelPose, side: LocalSide, slot: number): [number,number] {
  const r=normalized(el.rotation), w=r%2 ? el.spanZ : el.spanX, h=r%2 ? el.spanX : el.spanZ;
  const x=side==="left" ? -1 : side==="right" ? w : slot;
  const z=side==="back" ? -1 : side==="front" ? h : slot;
  return [el.gx+[x,z,w-1-x,h-1-z][r],el.gz+[z,w-1-x,h-1-z,x][r]];
}

const traversable = new Set<JoinKind>(["walk","drive","bus","garden","farm","orchard","arcade","cloister","ceremonial","transfer","freight","quay","dock","skywalk"]);
const sharedCourts = ids("tiny_homes trailer_home cottages apartments apartment_buildings condos");

export interface AccessStep { gx:number; gz:number; neighbor:PlacedElement }
/** Boundaries that can carry people or local deliveries. A service pipe, power cable,
 * adjoining wall, habitat strip or planted buffer never supplies road access. */
export function parcelAccessSteps(el:PlacedElement, occupancy:ReadonlyMap<string,PlacedElement>, state?:GameState, edges=getParcelEdges(el,occupancy,state)):AccessStep[] {
  const steps:AccessStep[]=[];
  for(const edge of edges) {
    if(!traversable.has(edge.kind) && !(edge.kind==="yard" && sharedCourts.has(el.defId) && sharedCourts.has(edge.neighbor))) continue;
    const [gx,gz]=cellBeyondEdge(el,edge.side,edge.slot);
    const neighbor=occupancy.get(gx+","+gz);
    if(neighbor) steps.push({gx,gz,neighbor});
  }
  return steps;
}

export interface RoadSiteAccess {
  gx: number;
  gz: number;
  dx: number;
  dz: number;
  site: PlacedElement;
  kind: RoadAccessKind;
  /** Building-local side and frontage slot, including rotated rectangular lots. */
  side: LocalSide;
  slot: number;
}

/** The same physical curb cuts feed the road model, daily traffic and the placement ghost. */
export function roadSiteAccess(
  road: Pick<ParcelPose,"defId" | "gx" | "gz" | "edgeOverrides">,
  occupancy: ReadonlyMap<string,PlacedElement>,
  state?: GameState,
): RoadSiteAccess[] {
  const d=ELEMENT_BY_ID[road.defId];
  if (!d || !localRoad(d)) return [];
  if (!offsets.some(([dx,dz])=>{
    const neighbor=occupancy.get((road.gx+dx)+","+(road.gz+dz));
    return neighbor && !ELEMENT_BY_ID[neighbor.defId]?.isNetwork;
  })) return [];
  const result:RoadSiteAccess[]=[];
  for(const edge of getParcelEdges({...road,spanX:1,spanZ:1,rotation:0},occupancy,state)){
    if(edge.kind!=="drive" && edge.kind!=="freight" && edge.kind!=="bus")continue;
    const direction=sideIndex(edge.side), [dx,dz]=offsets[direction];
    const x=road.gx+dx,z=road.gz+dz, site=occupancy.get(x+","+z);
    if(!site || ELEMENT_BY_ID[site.defId]?.isNetwork)continue;
    const facing=(direction+2)%4;
    result.push({gx:road.gx,gz:road.gz,dx,dz,site,kind:edge.kind,
      side:localSide(facing,site.rotation),slot:slotAt(site,facing,x,z)});
  }
  return result;
}
