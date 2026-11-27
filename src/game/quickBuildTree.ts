import { SKYLINE_GOVERNMENT_IDS } from "./skylineCatalog";
import { CHRISTMAS_GROUPS } from "./christmasCatalog";
import { readPlayerItem, writePlayerItem } from "./deviceSaves";
/** Stable paths through Exact Build. The seven original branches retain their layout. */
import {
  type CivElementDef,
  ELEMENTS,
  ELEMENT_BY_ID,
} from "./catalog";
import { constructionCost } from "./cityEconomy";
import { isCustomElementId } from "./customElements";
import {
  buildingLockReason,
  planConstruction,
  type GameState,
} from "./simulation";

export type QuickBuildMode = "adaptive" | "instant" | "tree" | "sculpt";

const QUICK_BUILD_MODE_KEY = "pixel_civ_quick_build_mode_v1";

export function loadQuickBuildMode(): QuickBuildMode {
  try {
    if (typeof localStorage === "undefined") return "adaptive";
    const raw = readPlayerItem(QUICK_BUILD_MODE_KEY);
    if (raw === "tree" || raw === "instant" || raw === "sculpt") return raw;
    return "adaptive";
  } catch {
    return "adaptive";
  }
}

export function saveQuickBuildMode(mode: QuickBuildMode): void {
  try {
    if (typeof localStorage === "undefined") return;
    writePlayerItem(QUICK_BUILD_MODE_KEY, mode);
  } catch {
    // Ignore private-mode storage errors
  }
}

export type DecisionTreeParentId =
  | "christmas_village"
  | "homes_retail"
  | "roads_harbor"
  | "farms_nature"
  | "power_water_tech"
  | "civic_culture_faith"
  | "police_military"
  | "landmarks_projects";

export interface DecisionTreeSubcategory {
  id: string;
  label: string;
  /** Representative element ID used for the subcategory thumbnail favicon. */
  iconDefId: string;
  elementIds: string[];
}

export interface DecisionTreeParent {
  id: DecisionTreeParentId;
  label: string;
  shortDesc: string;
  subcategories: DecisionTreeSubcategory[];
}

export interface DecisionTreeLeafElement {
  def: CivElementDef;
  cost: number;
  canAfford: boolean;
  canPlace: boolean;
  lockReason: string | null;
  placeReason: string | null;
}

export const QUICK_BUILD_TREE: DecisionTreeParent[] = [
  {
    id: "homes_retail",
    label: "Homes & Retail",
    shortDesc: "Housing, cafés, shops & malls",
    subcategories: [
      {
        id: "hr_starter_homes",
        label: "Houses & Cottages",
        iconDefId: "cottages",
        elementIds: ["house", "tiny_homes", "trailer_home", "cottages", "rowhouse_duplex", "medium_sized_homes"],
      },
      {
        id: "hr_villas",
        label: "Townhomes & Villas",
        iconDefId: "villas",
        elementIds: ["townhomes", "large_homes", "beach_houses", "villas", "courtyard_villa", "mansions"],
      },
      {
        id: "hr_towers",
        label: "Apartments & Towers",
        iconDefId: "skyscrapers",
        elementIds: ["apartments", "apartment_buildings", "mixed_use_midrise", "condos", "penthouse_tower", "skyscrapers"],
      },
      {
        id: "hr_dining",
        label: "Cafés & Eateries",
        iconDefId: "artisan_bakery",
        elementIds: [
          "grocery_store",
          "restaurants",
          "cheesesteak_restaurants",
          "artisan_bakery",
          "coffee_roastery",
          "retro_diner",
        ],
      },
      {
        id: "hr_boutiques",
        label: "Shops & Boutiques",
        iconDefId: "flower_shop",
        elementIds: [
          "shops",
          "clothing_stores",
          "thrift_stores",
          "shoe_stores",
          "indie_bookstore",
          "flower_shop",
        ],
      },
      {
        id: "hr_services",
        label: "Trades & Auto",
        iconDefId: "hardware_store",
        elementIds: [
          "businesses",
          "blacksmiths",
          "hardware_store",
          "neighborhood_pharmacy",
          "gas_stations",
          "auto_dealership",
        ],
      },
      {
        id: "hr_retail_hubs",
        label: "Malls, Hotels & Piers",
        iconDefId: "malls",
        elementIds: [
          "malls",
          "department_store",
          "furniture_showroom",
          "boutique_hotel",
          "night_market",
          "seafood_pier",
        ],
      },
    ],
  },
  {
    id: "roads_harbor",
    label: "Roads, Rail & Harbor",
    shortDesc: "Streets, bridges, trains & ships",
    subcategories: [
      {
        id: "tr_paths",
        label: "Paths & Local Roads",
        iconDefId: "roads",
        elementIds: ["paths", "walking_paths", "trails", "side_walks", "dirt_roads", "roads"],
      },
      {
        id: "tr_highways",
        label: "Streets & Highways",
        iconDefId: "highways",
        elementIds: ["two_lane_roads", "pretty_roads", "highways", "freeways", "over_passes", "underpasses"],
      },
      {
        id: "tr_bridges",
        label: "Bridges & Bus Transit",
        iconDefId: "suspension_bridges",
        elementIds: ["bridges", "stone_bridges", "suspension_bridges", "boardwalks", "bus_stops", "bus_depots"],
      },
      {
        id: "tr_rail",
        label: "Rail, Tram & Taxi",
        iconDefId: "train_depots",
        elementIds: ["train_tracks", "train_stops", "tram_station", "train_depots", "taxi_ranks", "taxi_depots"],
      },
      {
        id: "tr_ports",
        label: "Docks, Piers & Rescue",
        iconDefId: "ferry_landings",
        elementIds: [
          "ferry_landings",
          "docks",
          "ship_building_areas",
          "shipyards",
          "harbor_patrol_pier",
          "coast_rescue_station",
        ],
      },
      {
        id: "tr_boats",
        label: "Boats, Tugs & Patrol",
        iconDefId: "sail_boats",
        elementIds: ["boats", "sail_boats", "speed_boats", "harbor_tugboat", "naval_patrol_cutter", "naval_hospital_ship"],
      },
      {
        id: "tr_warships",
        label: "Naval Warships",
        iconDefId: "aircraft_carriers",
        elementIds: ["naval_vessels", "coastal_corvette", "submarines", "aircraft_carriers", "naval_frigate_ship", "naval_minesweeper"],
      },
    ],
  },
  {
    id: "farms_nature",
    label: "Farms & Nature",
    shortDesc: "Crops, ranches, forests & terrain",
    subcategories: [
      {
        id: "fn_crop_farms",
        label: "Crop Farms",
        iconDefId: "farms",
        elementIds: ["farms", "farm_houses", "vegetable_farm", "grain_farm", "rice_farm", "plantations"],
      },
      {
        id: "fn_specialty",
        label: "Orchards & Greenhouses",
        iconDefId: "orchards",
        elementIds: ["orchards", "groves_of_olives", "vineyard", "apiary", "greenhouse_farm", "vertical_farm"],
      },
      {
        id: "fn_ranches",
        label: "Ranches & Livestock",
        iconDefId: "dairy_farm",
        elementIds: ["dairy_farm", "poultry_farm", "cattle_ranch", "horse_ranch", "livestock_pen", "chicken_coop"],
      },
      {
        id: "fn_fields",
        label: "Fields & Silos",
        iconDefId: "grain_fields",
        elementIds: ["fields", "vegetable_fields", "grain_fields", "orchard_block", "grazing_pasture", "feed_silo"],
      },
      {
        id: "fn_trees",
        label: "Forests & Farm Bays",
        iconDefId: "pine_trees",
        elementIds: ["irrigation_pond", "greenhouse_bay", "trees", "pine_trees", "redwood_trees", "plants"],
      },
      {
        id: "fn_flora_coast",
        label: "Shrubs & Beaches",
        iconDefId: "beaches",
        elementIds: ["shrubs", "bushes", "sand", "beaches", "beach_umbrellas", "tubbleweeds"],
      },
      {
        id: "fn_landforms",
        label: "Hills, Canyons & Overlooks",
        iconDefId: "mountains",
        elementIds: ["hills", "mountains", "canyons", "deserts", "shoreline_overlook", "alligators"],
      },
    ],
  },
  {
    id: "power_water_tech",
    label: "Power, Water & Tech",
    shortDesc: "Energy, waterworks, waste & offices",
    subcategories: [
      {
        id: "pw_clean_power",
        label: "Solar, Wind & Tidal",
        iconDefId: "wind_turbines",
        elementIds: ["solar_panels", "solar_farms", "windmills", "wind_turbines", "wind_farms", "tidal_turbine_array"],
      },
      {
        id: "pw_heavy_power",
        label: "Fuel, Hydro & Nuclear",
        iconDefId: "nuclear_power_plants",
        elementIds: [
          "coal_powerplants",
          "natural_gas_power_plants",
          "hydro_electric_power_plants",
          "geothermal_power_plants",
          "micro_reactor_nuclear",
          "nuclear_power_plants",
        ],
      },
      {
        id: "pw_waste_factory",
        label: "Factories & Recycling",
        iconDefId: "factories",
        elementIds: [
          "factories",
          "landfill",
          "recycling_center",
          "compost_works",
          "trash_compacting_plants",
          "trash_burning_plants",
        ],
      },
      {
        id: "pw_water_supply",
        label: "Springs, Towers & Pumps",
        iconDefId: "water_towers",
        elementIds: [
          "wells",
          "spring_house",
          "water_towers",
          "water_pumping_station",
          "water_treatment_plant",
          "desalination_plant",
        ],
      },
      {
        id: "pw_waterworks",
        label: "Canals, Sluices & Basins",
        iconDefId: "aqueduct",
        elementIds: ["water_places", "canals", "tidal_sluice", "municipal_reservoir", "aqueduct", "water_tile"],
      },
      {
        id: "pw_waterways",
        label: "Rivers, Lakes & Tide Pools",
        iconDefId: "rivers",
        elementIds: ["ponds", "rivers", "wide_rivers", "lakes", "swamps", "tidal_pool_walk"],
      },
      {
        id: "pw_finance_tech",
        label: "Banks, Offices & Data",
        iconDefId: "banks",
        elementIds: ["atms", "banks", "buildings", "coworking_loft", "tech_startup_hub", "data_centers"],
      },
    ],
  },
  {
    id: "civic_culture_faith",
    label: "Civic, Culture & Faith",
    shortDesc: "Schools, city hall, parks & worship",
    subcategories: [
      {
        id: "cf_schools_early",
        label: "Primary Schools & Library",
        iconDefId: "school",
        elementIds: ["school", "preschool", "country_schoolhouse", "elementary_school", "middle_school", "public_library"],
      },
      {
        id: "cf_colleges",
        label: "Colleges & Research",
        iconDefId: "university",
        elementIds: [
          "high_school",
          "trade_school",
          "community_college",
          "university",
          "research_university",
          "research_institute",
        ],
      },
      {
        id: "cf_gov",
        label: "City Hall & Civic",
        iconDefId: "city_offices",
        elementIds: [
          "city_offices",
          "post_offices",
          "tax_collecting_office",
          "courthouses",
          "government_buildings",
          "community_centers",
        ],
      },
      { id: "cf_government", label: "Government Offices & Assemblies", iconDefId: "borough_assembly", elementIds: SKYLINE_GOVERNMENT_IDS },
      {
        id: "cf_parks",
        label: "Parks & Gardens",
        iconDefId: "park",
        elementIds: ["park", "little_parks", "large_parks", "gardens", "italian_gardens", "sports_field"],
      },
      {
        id: "cf_nightlife",
        label: "Arts & Nightlife",
        iconDefId: "cinema_theater",
        elementIds: ["cinema_theater", "bowling_alley", "retro_arcade", "art_gallery", "jazz_club", "bars"],
      },
      {
        id: "cf_churches",
        label: "Churches, Chapels & Abbeys",
        iconDefId: "churches",
        elementIds: ["churches", "christian_churches", "bell_tower_chapel", "monasteries", "stone_abbey", "graveyards"],
      },
      {
        id: "cf_sanctuaries",
        label: "Global Sanctuaries",
        iconDefId: "lds_temples",
        elementIds: ["mosques", "synagogues", "temples", "zen_shrine", "meditation_pavilion", "lds_temples"],
      },
    ],
  },
  {
    id: "police_military",
    label: "Police, Fire & Military",
    shortDesc: "Safety, SWAT, fire & armed forces",
    subcategories: [
      {
        id: "pm_police",
        label: "Police & Corrections",
        iconDefId: "police_departments",
        elementIds: ["police_precinct", "police_departments", "k9_police_unit", "traffic_precinct", "jails", "prisons"],
      },
      {
        id: "pm_tactical",
        label: "SWAT, Crime Lab & Heli",
        iconDefId: "swat_team_hq",
        elementIds: [
          "swat_team_hq",
          "forensic_crime_lab",
          "emergency_dispatch",
          "riot_command_center",
          "civil_defense_bunker",
          "police_heli_pad",
        ],
      },
      {
        id: "pm_fire_rescue",
        label: "Fire & Air Rescue",
        iconDefId: "fire_department",
        elementIds: [
          "fire_department",
          "fire_academy",
          "fire_heli_base",
          "medevac_heli_pad",
          "hazmat_response",
          "search_rescue_hq",
        ],
      },
      {
        id: "pm_army",
        label: "Army Bases & Corps",
        iconDefId: "military_base",
        elementIds: [
          "military_base",
          "army_garrison",
          "army_signal_corps",
          "army_logistics_depot",
          "army_airborne_school",
          "army_engineer_base",
        ],
      },
      {
        id: "pm_navy",
        label: "Naval & Sub Bases",
        iconDefId: "naval_base",
        elementIds: [
          "naval_base",
          "submarine_base",
          "naval_shipyard_base",
          "naval_coast_guard_base",
          "naval_destroyer_dock",
          "naval_carrier_berth",
        ],
      },
      {
        id: "pm_airforce",
        label: "Air Force Bases",
        iconDefId: "airforce_base",
        elementIds: [
          "airforce_base",
          "strategic_bomber_wing",
          "stealth_bomber_hangar",
          "fighter_wing_base",
          "airlift_cargo_base",
          "awacs_radar_base",
        ],
      },
      {
        id: "pm_marines_spec",
        label: "Marines, Recon & Med",
        iconDefId: "marine_corps_base",
        elementIds: [
          "marine_corps_base",
          "marine_amphib_base",
          "marine_aviation_wing",
          "naval_amphibious_dock",
          "drone_recon_base",
          "army_medical_corps",
        ],
      },
    ],
  },
  {
    id: "landmarks_projects",
    label: "Landmarks & Projects",
    shortDesc: "Wonders, monuments & mega-projects",
    subcategories: [
      { id: "lm_modern", label: "Modern Wonders", iconDefId: "mega_skyscraper", elementIds: ["mega_skyscraper","supertree_grove","guggenheim_bilbao"] },
      {
        id: "lm_ancient",
        label: "Ancient Wonders",
        iconDefId: "the_great_pyramids",
        elementIds: ["the_great_pyramids", "stonehenge", "moai_statues", "parthenon", "colosseum", "chichen_itza"],
      },
      {
        id: "lm_heritage",
        label: "World Heritage",
        iconDefId: "eiffel_tower",
        elementIds: ["great_wall", "angkor_wat", "machu_picchu", "colossus_lighthouse", "eiffel_tower", "the_london_eye"],
      },
      {
        id: "lm_monuments",
        label: "Capitol & Monuments",
        iconDefId: "white_house",
        elementIds: ["large_landmarks", "washington_monument", "white_house", "smithsonian", "civic_observatory", "maritime_museum"],
      },
      {
        id: "lm_trade_works",
        label: "Trade & Civic Works",
        iconDefId: "freight_rail_terminal",
        elementIds: [
          "growers_exchange",
          "bakery_coop",
          "ferry_exchange",
          "open_pit_mine",
          "freight_rail_terminal",
          "maritime_college",
        ],
      },
      {
        id: "lm_eco_works",
        label: "Water & Eco Works",
        iconDefId: "terraced_glasshouses",
        elementIds: [
          "water_reuse_works",
          "terraced_glasshouses",
          "district_heat_works",
          "pumped_storage_station",
          "solar_canopy_orchard",
          "floodplain_park",
        ],
      },
      {
        id: "lm_transit_mega",
        label: "Mega Transit & Slipways",
        iconDefId: "spaceport",
        elementIds: ["regional_airport", "canal_boat_lift", "boatyard_slipway", "flying_car_depot", "teleportation_depot", "spaceport"],
      },
      {
        id: "lm_arcologies",
        label: "Future Arcologies",
        iconDefId: "hanging_garden_arcology",
        elementIds: [
          "hanging_garden_arcology",
          "materials_foundry",
          "rainwater_cathedral",
          "skybridge_university",
          "ocean_habitat_ring",
          "solar_spire_arcology",
        ],
      },
    ],
  },
  { id: "christmas_village", label: "Christmas Village", shortDesc: "North Pole homes, winter fairs and holiday scenes", subcategories: CHRISTMAS_GROUPS },
];

export function getDecisionTreeParent(parentId: DecisionTreeParentId): DecisionTreeParent | undefined {
  return QUICK_BUILD_TREE.find((p) => p.id === parentId);
}

export function getDecisionTreeSubcategory(
  parentId: DecisionTreeParentId,
  subId: string,
): DecisionTreeSubcategory | undefined {
  return getDecisionTreeParent(parentId)?.subcategories.find((s) => s.id === subId);
}

/** Count how many elements exist under a parent category. */
export function countParentElements(parent: DecisionTreeParent): number {
  return parent.subcategories.reduce((sum, s) => sum + s.elementIds.length, 0);
}

/**
 * Evaluate the 4–6 elements inside a chosen Decision Tree leaf subcategory for tile (gx, gz).
 * Keeps every element visible in the spiral so players always have predictable muscle-memory
 * positions, while cleanly marking locked, unaffordable, or wrong-terrain items.
 */
export function getDecisionTreeLeafElements(
  state: GameState,
  parentId: DecisionTreeParentId,
  subId: string,
  gx: number,
  gz: number,
): DecisionTreeLeafElement[] {
  const sub = getDecisionTreeSubcategory(parentId, subId);
  if (!sub) return [];

  const out: DecisionTreeLeafElement[] = [];
  for (const id of sub.elementIds) {
    const def = ELEMENT_BY_ID[id];
    if (!def) continue;
    const lockReason = buildingLockReason(def, state) ?? null;
    const cost = constructionCost(state, def);
    const canAfford = constructionCost(state, def) <= Math.max(0, state.money);
    const richState: GameState =
      state.mode === "god"
        ? state
        : { ...state, money: Math.max(state.money, def.cost + 1_000_000) };
    const plan = planConstruction(richState, def, gx, gz, 1, 0, false);
    out.push({
      def,
      cost,
      canAfford,
      canPlace: plan.valid && !lockReason,
      lockReason,
      placeReason: plan.valid ? null : plan.reason || "Won't fit here",
    });
  }
  return out;
}

/**
 * Runtime/test audit helper verifying that all non-custom catalog elements are
 * partitioned cleanly across the decision tree without omissions or duplicates.
 */
export function auditDecisionTreeCoverage(): {
  parentCount: number;
  subcategoryCount: number;
  maxLeafSize: number;
  minLeafSize: number;
  missingIds: string[];
  unknownIds: string[];
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const unknownIds: string[] = [];
  let subcategoryCount = 0;
  let maxLeafSize = 0;
  let minLeafSize = Infinity;

  for (const parent of QUICK_BUILD_TREE) {
    for (const sub of parent.subcategories) {
      subcategoryCount++;
      if (sub.elementIds.length > maxLeafSize) maxLeafSize = sub.elementIds.length;
      if (sub.elementIds.length < minLeafSize) minLeafSize = sub.elementIds.length;
      for (const id of sub.elementIds) {
        if (!ELEMENT_BY_ID[id]) unknownIds.push(id);
        if (seen.has(id)) duplicateIds.push(id);
        seen.add(id);
      }
    }
  }

  const missingIds = ELEMENTS
    .filter((e) => !isCustomElementId(e.id) && !seen.has(e.id))
    .map((e) => e.id);

  return {
    parentCount: QUICK_BUILD_TREE.length,
    subcategoryCount,
    maxLeafSize,
    minLeafSize,
    missingIds,
    unknownIds,
    duplicateIds,
  };
}
