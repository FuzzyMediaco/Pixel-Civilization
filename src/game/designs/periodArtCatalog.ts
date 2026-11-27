import { ELEMENT_BY_ID } from "../catalog";
import type { Ctx } from "./kit";

export const ART_VARIANTS = {
  "ancient-china": ["Lantern gate", "Canal arcade", "Jade garden", "Ridge pavilion"],
  "ancient-egypt": ["Painted pylon", "Reed-shade porch", "Date court", "Roof terrace"],
  "rome-aqueduct": ["Brick gate", "Merchant arcade", "Cypress court", "Tower cistern"],
  "ancient-greece": ["Painted stoa", "Timber portico", "Olive terrace", "Marble pediment"],
  "medieval-europe": ["Timber gate", "Guild awning", "Herb yard", "Watch turret"],
  "renaissance-italy": ["Marble portal", "Merchant loggia", "Cypress garden", "Lantern cupola"],
  "world-war-ii": ["Brick terrace", "Loading canopy", "Allotment court", "Signal loft"],
  "art-deco": ["Sunburst portal", "Streamline canopy", "Palm terrace", "Setback crown"],
  "future-3027": ["Ceramic airlock", "Cantilever dock", "Biogarden", "Beacon mast"],
  "post-apocalyptic": ["Spliced gate", "Canvas lean-to", "Salvage garden", "Lookout cistern"],
} as const;
export type ProductionEra = keyof typeof ART_VARIANTS;
export const PRODUCTION_ERAS = Object.keys(ART_VARIANTS) as ProductionEra[];
export const PRODUCTION_ART_IDS = Object.values(ELEMENT_BY_ID).filter(def => def.category !== "christmas").map(def => def.id);
export type ArtFamily = "house" | "apartment" | "tower" | "market" | "hall" | "school" |
  "workshop" | "farm" | "water" | "power" | "station" | "dock" | "vessel" | "road" |
  "track" | "bridge" | "aqueduct" | "landscape" | "faith" | "landmark" | "defense";

const archetypes: Record<ArtFamily,string> = {
  house:"house_gable tiny_cabin trailer villa_mansion", apartment:"midrise_residential", tower:"skyscraper",
  market:"shop_front restaurant_bar atm_kiosk mall_plaza", hall:"civic_hall office_commercial",
  school:"school_campus", workshop:"gas_station datacenter factory_mill waste_plant",
  farm:"farm_field barn_farmhouse orchard_grove", water:"water_plant well_spring water_tower fountain_plaza",
  power:"solar_array windmill_classic wind_turbine power_heavy hydro_plant nuclear_plant",
  station:"transit_stop transit_depot", dock:"dock_pier shipyard",
  vessel:"boat_small sailboat naval_ship submarine aircraft_carrier",
  road:"road_dirt road_pretty road_highway road_asphalt", track:"rail_track",
  bridge:"road_overpass road_underpass bridge_span bridge_suspension", aqueduct:"",
  landscape:"park_green garden_formal graveyard water_tile tree_broadleaf shrub_flora tree_conifer hill_mountain beach_sand beach_umbrella canyon_mesa tumbleweed swamp_marsh alligator",
  faith:"church_steeple mosque_dome synagogue_hall temple_pagoda lds_temple",
  landmark:"landmark_obelisk landmark_whitehouse landmark_smithsonian landmark_eiffel landmark_londoneye landmark_pyramids",
  defense:"fire_station police_station prison_complex military_compound airbase",
};
const byArchetype = new Map<string,ArtFamily>();
for (const [family, keys] of Object.entries(archetypes)) {
  for (const key of keys.split(" ").filter(Boolean)) byArchetype.set(key,family as ArtFamily);
}
const overrides: Partial<Record<ArtFamily,string>> = {
  aqueduct:"aqueduct", market:"growers_exchange bakery_coop auto_dealership", house:"boutique_hotel",
  farm:"terraced_glasshouses solar_canopy_orchard vertical_farm", water:"water_reuse_works pumped_storage_station rainwater_cathedral",
  power:"district_heat_works", workshop:"open_pit_mine materials_foundry", tower:"hanging_garden_arcology",
  station:"freight_rail_terminal ferry_exchange regional_airport flying_car_depot teleportation_depot",
  school:"maritime_college skybridge_university", landscape:"floodplain_park",
  dock:"canal_boat_lift ocean_habitat_ring", landmark:"spaceport civic_observatory colossus_lighthouse",
};
const byId = new Map<string,ArtFamily>();
for (const [family,ids] of Object.entries(overrides)) {
  for (const id of ids.split(" ")) byId.set(id,family as ArtFamily);
}
export function productionArtFamily(id: string): ArtFamily | undefined {
  if (ELEMENT_BY_ID[id]?.category === "christmas") return undefined;
  return byId.get(id) ?? byArchetype.get(ELEMENT_BY_ID[id]?.archetype);
}

export type Ink = {
  era: ProductionEra; wall:string; shade:string; roof:string; rim:string; frame:string;
  sign:string; floor:string; leaf:string; glass:string; lamp:string; cloth:string;
  bay: number; storey: number;
  /**
   * Deliberate per-element designs for this era (see src/game/designs/eraArt/). An element listed here
   * owns its footprint composition, roofline, openings and service side instead of passing through the
   * shared family builders. Display names live in src/game/eraNames/ so menus never wait for art.
   */
  signatures?: Readonly<Record<string, SignatureBuilder>>;
};
export type SignatureBuilder = (c: Ctx, p: Ink, active: boolean) => void;
