import chapters from "./chapters.json";
import neighbors from "../../public/handbook/neighbors/index.json";

const categoryLesson: Record<string, string> = {
  agriculture: "city-food",
  civic_parks: "balance",
  commerce: "balance",
  faith: "joined-sites",
  housing: "grow-in-place",
  landmarks: "city-growth",
  maritime: "own-ships",
  nature_terrain: "land-and-coasts",
  police_military: "night",
  power_waste: "try-first-town",
  roads_transit: "road-junctions",
  water_util: "aqueducts",
  wealth_projects: "all-projects",
};

const topics: Record<string, string[]> = {
  "city-plane": ["regional_airport"],
  "city-rocket": ["spaceport"],
  "city-airTaxi": ["flying_car_depot"],
  "city-teleport": ["teleportation_depot"],
  "city-food": [
    "grocery_store",
    "gardens",
    "growers_exchange",
    "bakery_coop",
    "terraced_glasshouses",
    "solar_canopy_orchard",
  ],
  "city-staffing": ["materials_foundry", "freight_rail_terminal", "open_pit_mine"],
  "city-fire": ["fire_department"],
  "boat-lift": ["canal_boat_lift"],
  "by-water": ["canals", "ferry_landings", "ferry_exchange", "docks", "shipyards", "ship_building_areas"],
  "harbor-voyages": ["naval_base", "submarine_base", "naval_vessels", "aircraft_carriers", "submarines"],
  "rail-services": ["train_tracks", "train_stops", "train_depots"],
  "street-services": ["bus_stops", "bus_depots", "taxi_ranks", "taxi_depots"],
  "bridge-clearance": ["bridges", "stone_bridges", "suspension_bridges", "boardwalks"],
  "river-gates": ["hydro_electric_power_plants", "municipal_reservoir", "pumped_storage_station"],
};

const lessonLinks = new Map(
  chapters.flatMap((chapter) =>
    chapter.lessons.map(
      (lesson) => [lesson.id, { section: chapter.id, id: lesson.id, title: lesson.title }] as const,
    ),
  ),
);

export function relatedLessons(id: string, category: string) {
  const specific = Object.entries(topics).find(([, ids]) => ids.includes(id))?.[0];
  const pairs = neighbors.filter((pair) => pair.ids.includes(id)).map((pair) => "neighbor-" + pair.id);
  const expansion = chapters.flatMap(chapter=>chapter.lessons.filter(lesson=>
    "designs" in lesson && Array.isArray(lesson.designs) && lesson.designs.includes(id)
  ).map(lesson=>lesson.id));
  const ids = new Set([...expansion, specific, ...pairs, categoryLesson[category]].filter(Boolean));
  return [...ids].flatMap((key) => {
    const lesson = key && lessonLinks.get(key);
    return lesson ? [lesson] : [];
  });
}
