import type { JoinKind } from "./parcelEdges";

const instructions: Record<JoinKind, string> = {
  garden: "Put a garden against the rear of the home to open a gate into its edible beds.",
  drive: "Rotate the building entrance toward a local street and connect that street to the rest of the town.",
  party: "Place townhomes side by side, facing the same direction, to close the gap between their side walls.",
  farm: "Place fields against the farm boundary. Several bordering plots can share field lanes with one farmhouse.",
  freight: "Put working plots or loading yards on the same boundary. Keep road or rail access for deliveries.",
  orchard: "Let the planted plots share an edge to connect their pollinator beds.",
  cloister: "Put the burial ground against the place of worship to align the opening in the churchyard wall.",
  arcade:
    "Place the shops beside each other to share their shopping frontage. Turn a cashpoint toward the shop it serves.",
  transfer: "Give residents or shops a direct entrance to the stop and complete a route to another destination.",
  platform: "Lay a continuous track along the rear boarding edge of the station. Keep the rails clear of buildings.",
  bus: "Face the pickup point toward a local road. Extend it past the curb and connect a depot and a second stop for a route.",
  ceremonial: "Place the public grounds against the institution to carry a promenade across the boundary.",
  walk: "Place a walking route or a public garden against an accessible edge to continue the pedestrian path.",
  irrigation:
    "Bring a supplied canal or aqueduct to the farm edge to irrigate it. An isolated decorative pool provides no supply.",
  heat: "Put heat-producing equipment next to a compatible consumer to add a pipe across the shared edge.",
  intake:
    "Place the water intake beside replenished water. A fitting is visible even when a decorative basin supplies no water.",
  quay: "Place the shoreline facility beside navigable water and provide access from land.",
  dock: "Put a berth beside a vessel and check the approach is deep and clear enough for its draft.",
  service: "Put the facility beside a compatible neighbor so the service entrance meets the adjoining parcel.",
  habitat: "Continue woodland or wetland habitat across an adjoining edge.",
  buffer: "Put planting between industry and the surrounding neighborhood to form a green buffer.",
  beach: "Continue sand across the shoreline and keep beach facilities on the dry side.",
  road: "Connect street tiles along their edges. The road surface follows the directions of adjoining streets.",
  rail: "Continue the line with track tiles. Put stations beside the track and connect a depot for service.",
  channel: "Continue the waterway across neighboring tile edges and connect a water source for sustained flow.",
  power: "Place a generator beside a compatible consumer or plant to join their utility fittings.",
  yard: "Place neighboring homes side by side to open the shared yard.",
  skywalk: "Align two towers side by side to join their occupied floors with an enclosed walkway.",
};
const specific: Record<string, string> = {
  hydro_electric_power_plants:
    "Span a river or supplied channel with a drop in water level. Open ocean has no usable head.",
  deserts: "Place desert to paint buildable sandy ground. Add tumbleweed or a house directly on the dry surface.",
  sand: "Place sand to paint a buildable shore and soften the transition into beach or water.",
  rivers: "Continue the river downstream and connect a fresh-water source for pumps, farms, or a dam.",
  wide_rivers: "Join wide river reaches and supply an upstream source. Clear, deep channels can carry boats.",
  canals: "Dig a continuous canal and join replenished water to carry flow to fields, pumps, or locks.",
  water_tile:
    "Use water tiles for ponds and connected waterways. Check supply and depth before relying on a water intake or boat route.",
  wells: "Place a well on land and connect the town to its fresh-water supply.",
  water_treatment_plant: "Face the intake toward flowing water and connect the works to the town.",
  desalination_plant: "Site the plant on the coast with access to seawater, electricity, and the town.",
  train_stops:
    "Lay track along the rear boarding edge; run it uninterrupted past the platform. Supply a depot, a second stop, and street access.",
  bus_stops:
    "Face the pole toward a neighborhood road. Connect a bus depot and another stop on the same network to operate a service.",
  ferry_landings: "Use two reachable landings, navigable water between their berths, and walkable access for passengers.",
  taxi_ranks: "Face the rank toward a local street and connect a taxi depot and a destination by road.",
  blacksmiths: "Face the workshop toward a local road for access. A bordering farm opens a loading connection.",
  wind_turbines: "Leave an unobstructed approach to the rotor. Large neighboring structures affect its wind exposure.",
  wind_farms: "Leave room around the turbines and clear their upwind approach to protect generation.",
  solar_panels: "Keep tall buildings out of the sunlight reaching the panels and connect the array to its consumers.",
  solar_farms: "Place the arrays on an open site where taller neighbors cast little shade.",
  guggenheim_bilbao: "Connect the museum to a road for education and recreation. Its public galleries also lift resident happiness by 2 to 6 points as it grows. The strongest operating museum sets that bonus.",
  supertree_grove: "Connect the grove to the city for recreation and education. Upgrade to level 3 to open the canopy walk and visit after dusk to see the crown lights.",
  mega_skyscraper: "Serve the tower with utilities, a road and nearby transit. Upgrade through five occupied skyline districts.",
  bars: "Build a connected nightlife district. The bar signs brighten at night.",
  farms:
    "Place fields along the farm boundary, connect a local road for workers, and supply irrigation to increase harvests.",
  farm_houses: "Surround the farmhouse with fields. A two-tile farmhouse can share lanes with five separate field plots.",
  townhomes: "Line up the same-facing side walls to form a continuous row, with each front facing the street.",
  school: "Give the school a route to nearby homes. A public green adjoining the campus opens a shared promenade.",
};

export function getGuideUsage(id: string, kind: JoinKind | undefined, fallback: string): string {
  return specific[id] ?? (kind && instructions[kind]) ?? fallback;
}
