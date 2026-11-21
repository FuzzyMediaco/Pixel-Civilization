import { ELEMENT_BY_ID, getStandardFootprintForLevel } from "./catalog";
import { transfer } from "./cityEconomy";
import { addLine, addTrainToLine, dispatchVessel } from "./mobility";
import { defaultFormation, installYardWork } from "./railOperations";
import { dispatchFire, igniteSite } from "./projectOperations";
import {
  createInitialGameState,
  planConstruction,
  recomputeConnectivityAndMetrics,
  stepSimulation,
  type GameState,
  type PlacedElement,
} from "./simulation";
import { applyInfrastructureStroke, applyLandformPlacement, type InfrastructureTool } from "./terrain";

export type ExampleWorldId = "pelican-reach" | "copper-gorge" | "switchyard-city" | "meridian-fair";
export type ExampleMode = "god" | "real";
type Camera = { gx: number; gz: number; zoom: number };
export type ExampleViewpoint = Camera & { name: string; tryThis: string };
export interface ExampleWorld {
  id: ExampleWorldId;
  name: string;
  description: string;
  camera: Camera;
  viewpoints: ExampleViewpoint[];
}
const camera = (gx: number, gz: number, zoom: number): Camera => ({ gx, gz, zoom });
const view = (name: string, gx: number, gz: number, zoom: number, tryThis: string): ExampleViewpoint => ({
  name,
  gx,
  gz,
  zoom,
  tryThis,
});

// Every saved place below uses actual island grid coordinates. Camera distance is in world meters.
export const EXAMPLE_WORLDS: readonly ExampleWorld[] = [
  {
    id: "pelican-reach",
    name: "Pelican Reach",
    description: "A saltwater estuary with a working ferry, a naval quay and an ocean patrol.",
    camera: camera(6, -1, 76),
    viewpoints: [
      view(
        "The lift at Marina Cut",
        4,
        0,
        39,
        "Follow the passenger ferry in Transit. Open the lift for the boat, then return it to Automatic and watch the road reopen.",
      ),
      view(
        "Admiralty Quay",
        12,
        -3,
        39,
        "Select the submarine or patrol vessel in Transit and follow it out of the estuary. Inspect Defense to see what the staffed naval base contributes.",
      ),
      view(
        "The upper pond",
        -6,
        6,
        42,
        "Recall the small boat to the western canal. Send it back to the raised pond at (−6, 8) and watch the chamber align the two levels.",
      ),
      view(
        "Calder airfield",
        3,
        -12,
        42,
        "Select the Regional Airport to read its flight status. Track the aircraft from the runway to its mainland visit and back.",
      ),
      view(
        "Pelican Shoal",
        38,
        0,
        54,
        "Send the submarine to the deep water east of the bay. Recall it to its quay, then try a small boat in the narrow western canal.",
      ),
      view(
        "The sand spit",
        17,
        5,
        39,
        "Inspect the reclaimed sand and beach. Extend its tip with Peninsula, then undo the stroke to see the shoreline return.",
      ),
      view(
        "The chapel and its yard",
        -5,
        -6,
        31,
        "Inspect the church’s shared boundary with the graveyard. Follow the quayside walk east to the passenger landing.",
      ),
    ],
  },
  {
    id: "copper-gorge",
    name: "Copper Gorge",
    description: "Two canyon rims share spring water, a mine and five fields around one farmhouse.",
    camera: camera(-62, -18, 81),
    viewpoints: [
      view(
        "The blue crossing",
        -63,
        -20,
        45,
        "Select an aqueduct bend in Public works. Follow the spring water across the gorge to the reservoir and compare the outlets’ flow.",
      ),
      view(
        "Five Fields Farm",
        -57,
        -15,
        39,
        "Select the farmhouse and the five neighboring fields. Follow their harvested meals to the grocer and compare the farm’s water and output.",
      ),
      view(
        "The millrace",
        -63,
        -14,
        40,
        "Inspect the river dam and its hydro plant. Open the gate and inspect the head and power again, then restore its closed position.",
      ),
      view(
        "Sandstone lane",
        -74,
        -15,
        30,
        "Inspect the cottage on the joined desert plots. Paint a sandy extension, place another home facing the dirt road, and compare its ground.",
      ),
      view(
        "Copperbank mine",
        -69,
        -22,
        35,
        "Select the open-pit mine to inspect its jobs and exports. Paint or smooth a nearby bench, then undo the edit.",
      ),
      view(
        "Gorge gates",
        -53,
        -14,
        36,
        "Select the teleportation depot and inspect its partner on the western rim. A successful transfer moves local fares into the business account.",
      ),
      view(
        "The western spring",
        -70,
        -23,
        37,
        "Inspect the spring on the mountain and follow its water through the aqueduct. Redirect the final outlet to make a spill, or erase one segment and use Undo to restore the flow.",
      ),
      view("The east campus and creamery", -46, -19, 38,
        "Inspect the dairy and grain farms, follow the modules across the pens, and select the high school beside the sports field."),
      view("The sanctuary on the ridge", -38, -20, 25,
        "Inspect the LDS Temple in Connections. Try a blessing in God controls or help sheltered residents return to rebuilt homes."),
    ],
  },
  {
    id: "switchyard-city",
    name: "Switchyard City",
    description: "A night market, passenger railway and spaceport run beside a freeway interchange.",
    camera: camera(10, 61, 85),
    viewpoints: [
      view(
        "Market and cashpoint",
        10,
        60,
        37,
        "Inspect the bank, its facing ATM and shops. Open Accounts to compare treasury, household savings and business cash as people shop.",
      ),
      view(
        "Cheesesteak Row",
        3,
        60,
        39,
        "Find the giant Level 5 Cheesesteak Spot opposite the joined townhouses. The houses share walls, and the restaurant serves meals from local stock.",
      ),
      view(
        "Switchyard passing loop",
        10,
        65,
        51,
        "Watch the two Market Local trains share the signaled tracks. In Transit, open Rail Operations and compare their stops, headway and passengers.",
      ),
      view(
        "Rocket works",
        0,
        64,
        44,
        "Select the Spaceport to see its crew and turnaround. Follow the rocket up from the pad, then look for research revenue in Accounts.",
      ),
      view(
        "Northgate interchange",
        19,
        57,
        44,
        "Inspect the freeway lanes, signals and ramps in Public works. Adjust the signal cycle and watch the next vehicle queue.",
      ),
      view(
        "Private gardens",
        11,
        62,
        30,
        "Inspect the garden on the rear edge of the medium-sized home. Compare it with the shared fences and driveways on either side.",
      ),
      view(
        "Engine company",
        8,
        53,
        40,
        "Open Fire & safety. Follow the engine from the staffed station to the incident. After containment, repair and reopen the shop.",
      ),
    ],
  },
  {
    id: "meridian-fair",
    name: "Meridian Fair",
    description: "Walk through eight wonders, meet the herds, tour the schools and ride a ferry to a floating neighborhood.",
    camera: camera(5, 4, 155),
    viewpoints: [
      view("The eight-wonder promenade", -8, -8, 54, "Follow the garden walk from Stonehenge to Machu Picchu. Tap a monument to inspect its level and style."),
      view("Four-herd valley", -8, 4, 37, "Watch the horses, dairy cows, beef cattle and hens in the four paddocks. Pinch to see their coats and movements."),
      view("College Walk", 6, -8, 54, "Compare the little schoolhouse and preschool with the observatory and university quadrangle across the street."),
      view("Tomorrow Quay", 13, 6, 70, "Watch a rocket and the paired teleportation depots. Follow the ferry from the quay to the ocean habitat."),
    ],
  },
];
type Tile = [number, number];
class District {
  readonly state = createInitialGameState("god");
  constructor(
    readonly id: ExampleWorldId,
    readonly ox = 0,
    readonly oz = 0,
  ) {
    this.state.exampleWorldId = id;
  }
  works(tool: InfrastructureTool, ...points: Tile[]) {
    const result = applyInfrastructureStroke(
      this.state,
      tool,
      points.map(([x, z]) => ({ gx: x + this.ox, gz: z + this.oz })),
    );
    if (!result.valid)
      throw new Error(this.id + " " + tool.kind + " " + JSON.stringify(points) + ": " + result.reason);
  }
  place(id: string, x: number, z: number, level = 1, rotation = 0, variant = 0) {
    const s = this.state,
      def = ELEMENT_BY_ID[id],
      gx = x + this.ox,
      gz = z + this.oz;
    if (!def) throw new Error("Unknown example element " + id);
    const plan = planConstruction(s, def, gx, gz, level, rotation, true);
    if (!plan.valid) throw new Error(this.id + " " + id + " " + [x, z] + ": " + plan.reason);
    const el: PlacedElement = {
      id: this.id + "/" + id + "/" + gx + "," + gz,
      defId: plan.def.id,
      gx,
      gz,
      spanX: plan.spanX,
      spanZ: plan.spanZ,
      level: plan.level,
      variant,
      rotation: plan.rotation,
      connected: false,
      onFire: false,
      disrepair: false,
      hasPoliceCover: false,
      hasFireCover: false,
      nuisancePenalty: 0,
      maintTimerSec: 0,
      animKind: "place",
      animProgress: 0,
      overWater: plan.overWater,
      roadAxis: plan.roadAxis,
      pedestrianDeck: plan.pedestrianDeck,
    };
    if (plan.replaceId) {
      el.waterUnderlay = s.elements.find((e) => e.id === plan.replaceId);
      s.elements = s.elements.filter((e) => e.id !== plan.replaceId);
    }
    s.elements.push(el);
    applyLandformPlacement(s, el);
    return el;
  }
  path(id: string, ...bends: Tile[]) {
    for (let k = 1; k < bends.length; k++) {
      const [x, z] = bends[k - 1],
        [endX, endZ] = bends[k],
        dx = Math.sign(endX - x),
        dz = Math.sign(endZ - z);
      if (dx && dz) throw new Error("Use orthogonal network strokes.");
      for (let n = 0; n <= Math.max(Math.abs(endX - x), Math.abs(endZ - z)); n++) {
        const i = x + n * dx,
          j = z + n * dz,
          e = this.state.elements.find((e) => e.gx === i + this.ox && e.gz === j + this.oz);
        if (e && ELEMENT_BY_ID[e.defId].isNetwork) continue;
        this.place(id, i, j);
      }
    }
  }
  front(id: string, x: number, streetZ: number, side: -1 | 1, level = 1, variant = 0) {
    const [, depth] = getStandardFootprintForLevel(ELEMENT_BY_ID[id], level);
    return this.place(id, x, side === 1 ? streetZ + 1 : streetZ - depth, level, side === 1 ? 2 : 0, variant);
  }
  plant(id: string, level: number, positions: Tile[], rotation = 0) {
    for (const [i, [x, z]] of positions.entries()) {
      const plan = planConstruction(
        this.state,
        ELEMENT_BY_ID[id],
        x + this.ox,
        z + this.oz,
        level,
        rotation,
        true,
      );
      if (plan.valid) this.place(id, x, z, level, rotation, (i + level) % 4);
    }
  }
  finish(wealth: number, time: number, seconds: number) {
    const s = this.state;
    transfer(s, "outside", "treasury", wealth, "City endowment");
    transfer(s, "treasury", "households", wealth * 0.35, "Opening household savings");
    transfer(s, "treasury", "businesses", wealth * 0.3, "Opening business capital");
    s.timeOfDay = time;
    s.weather = "clear";
    s.timeLocked = s.weatherLocked = true;
    recomputeConnectivityAndMetrics(s);
    for (let i = 0; i < seconds; i++) stepSimulation(s, 1, true);
    s.timeLocked = s.weatherLocked = false;
    if (s.infrastructure) s.infrastructure.undo = [];
    s.toasts = []; // Events earned during scenario preparation are already in its history.
    return s;
  }
}
function pelicanReach() {
  const d = new District("pelican-reach"),
    s = d.state;
  d.works({ kind: "bay", depth: 5, radius: 3 }, [19, 0], [32, 0]);
  d.works({ kind: "river", depth: 4, radius: 2, flow: 7 }, [-3, 0], [20, 0]);
  // The broad turning basin and its scalloped seaward lip leave the dredged fairway uninterrupted.
  d.works({ kind: "bay", depth: 3.6, radius: 2 }, [17, 1], [20, 2], [23, 2]);
  d.works({ kind: "bay", depth: 2.4, radius: 2 }, [22, -2], [24, -4], [26, -4]);
  d.works({ kind: "paint", material: "sand", radius: 3 }, [12, 8], [17, 7], [22, 6]);
  d.works({ kind: "raise", height: 0.6, radius: 1 }, [15, 8], [17, 8], [19, 7]);
  d.works({ kind: "raise", height: 0.45, radius: 1 }, [19, 8], [21, 7]);
  d.works({ kind: "canal", depth: 1.6 }, [-3, 0], [-8, 0], [-8, 4], [-4, 4]);
  d.works({ kind: "lock", gate: "open", height: 0.45 }, [-8, 2]);
  d.works({ kind: "peninsula", height: 1.1, radius: 1, material: "sand" }, [16, 5], [22, 5]);
  d.works({ kind: "paint", material: "sand", radius: 1 }, [14, 5], [21, 5]);
  d.works({ kind: "bridge", shape: "lift", mode: "road", height: 1.7, lift: "auto" }, [4, -3], [4, 3]);
  d.path("pretty_roads", [-9, -5], [16, -5]);
  d.path("roads", [-9, -9], [16, -9]);
  d.path("roads", [-9, -9], [-9, -5]);
  d.path("roads", [7, -9], [7, -5]);
  d.path("roads", [4, -5], [4, -3]);
  d.path("pretty_roads", [-2, 3], [14, 3]);
  d.path("walking_paths", [0, -5], [0, -3]);
  d.path("boardwalks", [14, 3], [14, 5], [18, 5]);
  const quay = d.place("ferry_landings", 0, -2, 2),
    pier = d.place("ferry_landings", 11, 2, 2, 2, 3);
  d.place("naval_base", 9, -4, 2, 2, 1);
  d.place("submarine_base", 14, -4, 1, 2, 2);
  const sub = d.place("submarines", 14, 0, 2, 1, 3),
    ship = d.place("naval_vessels", 17, 1, 2, 1, 2);
  d.place("sail_boats", -4, 0, 1, 0, 2);
  const skiff = d.place("boats", -7, 0, 1, 0, 3);
  d.works({ kind: "pond", radius: 1, depth: 1.8, waterLevel: 2.3 }, [-6, 8], [-4, 8]);
  d.works({ kind: "canal", depth: 1.8, waterLevel: 0 }, [-6, 4], [-6, 5]);
  d.place("canal_boat_lift", -6, 6, 1, 0, 2).edgeOverrides = { right: "open" };
  d.path("walking_paths", [-2, 3], [-2, 6], [-4, 6]);
  d.path("walking_paths", [-4, 6], [-4, 5], [-5, 5]);
  dispatchVessel(s, skiff.id, "sail", [-6, 8]);
  d.place("beaches", 19, 5, 2, 0, 2);
  d.front("beach_houses", 9, 3, 1, 2, 2);
  d.front("churches", -6, -5, -1, 2, 1);
  d.front("graveyards", -8, -5, -1, 2, 0);
  for (let i = 0; i < 4; i++) d.front("townhomes", -4 + i * 2, -5, -1, 2, i);
  d.front("restaurants", 4, -5, -1, 3, 2);
  d.front("shops", 8, -5, -1, 2, 1);
  d.front("city_offices", 10, -5, -1, 2, 2);
  d.front("fire_department", 12, -5, -1, 2, 0);
  d.front("school", -7, -9, -1, 3, 1);
  d.front("park", -4, -9, -1, 3, 2);
  d.front("businesses", 0, -9, -1, 4, 3);
  d.front("water_treatment_plant", 4, -9, -1, 4, 0);
  d.front("geothermal_power_plants", 8, -9, -1, 2, 1);
  d.front("trash_burning_plants", 11, -9, -1, 3, 2);
  d.front("wells", 15, -9, -1, 4);
  d.front("maritime_college", -5, -9, 1, 2, 2);
  d.front("grocery_store", 0, -9, 1, 3, 2);
  d.front("terraced_glasshouses", 0, 3, 1, 4, 1);
  d.front("wells", 4, 3, 1, 3);
  d.front("grocery_store", 5, 3, 1, 3, 3);
  d.front("townhomes", 13, -9, -1, 2, 3);
  d.path("roads", [16, -9], [16, -12], [-3, -12]);
  d.front("regional_airport", 1, -12, -1, 3, 1);
  d.front("wind_turbines", 6, -12, -1, 3, 2);
  d.front("businesses", 10, -12, -1, 3, 0);
  recomputeConnectivityAndMetrics(s);
  addLine(s, "ferry", quay.id, [quay.id, pier.id]);
  addLine(s, "gondola", pier.id, [pier.id, quay.id]);
  dispatchVessel(s, sub.id, "sail", [38, 0]);
  dispatchVessel(s, ship.id, "sail", [36, 4]);
  // Broadleaf groups shelter the inland gardens. The low sand flora keeps the harbor in view.
  d.plant("trees", 3, [
    [-13, -8],
    [-12, -7],
    [-13, -5],
    [-11, -4],
    [-10, -12],
    [-8, -13],
    [-6, -12],
    [-8, 7],
    [-10, 8],
    [-10, 6],
    [-2, 8],
    [0, 9],
  ]);
  d.plant("pine_trees", 3, [
    [-14, -10],
    [-12, -11],
    [-14, -7],
    [-10, 9],
    [-9, 11],
    [12, 9],
    [14, 9],
    [15, 10],
    [17, 10],
    [16, 11],
  ]);
  d.plant("shrubs", 2, [
    [-10, -4],
    [-9, -3],
    [-7, -2],
    [-3, -3],
    [-1, -3],
    [2, -3],
    [7, -3],
    [9, 6],
    [11, 6],
    [15, 7],
    [16, 7],
    [19, 6],
    [21, 6],
    [22, 7],
    [-4, 8],
    [-7, 9],
  ]);
  d.plant("plants", 2, [
    [-6, -3],
    [-4, -3],
    [1, -3],
    [3, -3],
    [6, -3],
    [8, -3],
    [6, 7],
    [8, 7],
    [12, 7],
    [18, 6],
    [20, 7],
    [22, 6],
  ]);
  d.plant("orchards", 2, [
    [1, 7],
    [3, 7],
    [5, 7],
  ]);
  d.plant("beach_umbrellas", 2, [
    [17, 6],
    [19, 7],
    [21, 5],
  ]);
  return d.finish(85000, 9.2, 19);
}
export function createExampleWorld(id: ExampleWorldId, mode: ExampleMode = "god"): GameState {
  const factories = { "pelican-reach": pelicanReach, "copper-gorge": copperGorge, "switchyard-city": switchyardCity, "meridian-fair": meridianFair };
  const city = factories[id]();
  if (mode !== city.mode) {
    city.mode = mode;
    recomputeConnectivityAndMetrics(city);
  }
  return city;
}

function meridianFair() {
  const d = new District("meridian-fair");
  // A tidal inlet reaches the native eastern shore. Its northern bank carries utilities and a launch road.
  d.works({ kind: "bay", depth: 5, radius: 3 }, [13, 8], [32, 8]);
  d.works({ kind: "raise", height: 1.1, radius: 2 }, [-16, -15], [-9, -16], [-4, -15]);
  d.works({ kind: "raise", height: 1.5, radius: 2 }, [-15, 12], [-9, 13], [-5, 12]);
  d.path("pretty_roads", [-15, -8], [13, -8]);
  d.path("roads", [-15, -1], [15, -1]);
  d.path("pretty_roads", [-15, 5], [2, 5], [2, 3], [15, 3]);
  d.path("roads", [-1, -8], [-1, 5]);
  d.path("roads", [14, -1], [14, 3]);
  d.path("roads", [-15, -8], [-18, -8], [-18, -1], [-15, -1]);
  // Arrange the smaller monuments in front, keeping the towers and terraces visible over their roofs.
  d.front("colosseum", -15, -8, -1, 4, 1);
  d.front("angkor_wat", -12, -8, -1, 4, 0);
  d.front("machu_picchu", -8, -8, -1, 5, 2);
  d.front("chichen_itza", -4, -8, -1, 3, 1);
  d.front("stonehenge", -14, -8, 1, 2, 2);
  d.front("great_wall", -12, -8, 1, 5, 0);
  d.front("parthenon", -8, -8, 1, 3, 3);
  d.front("moai_statues", -4, -8, 1, 1, 0);
  d.front("italian_gardens", -3, -8, 1, 2, 3);

  d.front("country_schoolhouse", 0, -8, 1, 2, 0);
  d.front("preschool", 2, -8, 1, 3, 1);
  d.front("elementary_school", 5, -8, 1, 4, 2);
  d.front("trade_school", 9, -8, 1, 3, 3);
  d.front("high_school", 0, -8, -1, 3, 1);
  d.front("community_college", 3, -8, -1, 3, 2);
  d.front("university", 6, -8, -1, 5, 0);
  d.front("research_university", 10, -8, -1, 4, 2);
  d.front("middle_school", 12, -8, 1, 2, 1);

  d.front("dairy_farm", -13, 5, -1, 4, 0);
  d.front("cattle_ranch", -9, 5, -1, 4, 1);
  d.front("poultry_farm", -12, 5, 1, 4, 3);
  d.front("horse_ranch", -8, 5, 1, 4, 2);
  d.front("farm_houses", -5, 5, -1, 2, 2);
  d.front("fields", -3, 5, -1, 2, 1);
  d.front("orchards", -5, 5, 1, 2, 0);

  d.front("spaceport", 4, 3, -1, 4, 0);
  d.front("teleportation_depot", 8, 3, -1, 3, 1);
  d.front("teleportation_depot", 3, 3, 1, 2, 2);
  d.front("hanging_garden_arcology", 7, 3, 1, 4, 1);
  const pier = d.place("ferry_landings", 13, 4, 2);
  const ring = d.place("ocean_habitat_ring", 16, 7, 4, 0, 2);

  d.front("farm_houses", -15, -1, -1, 3, 0);
  d.front("grocery_store", -12, -1, -1, 4, 2);
  d.front("terraced_glasshouses", -9, -1, -1, 4, 0);
  d.front("apartments", -5, -1, -1, 3, 1);
  d.front("water_treatment_plant", 1, -1, -1, 5, 1);
  d.front("geothermal_power_plants", 5, -1, -1, 4, 0);
  d.front("trash_compacting_plants", 9, -1, -1, 4, 1);
  d.front("city_offices", 12, -1, -1, 3, 0);
  d.front("wells", -14, -1, 1, 5, 2);
  d.front("fire_department", -11, -1, 1, 3, 0);
  d.front("townhomes", -6, -1, 1, 3, 2);
  d.front("police_precinct", -3, -1, 1, 2, 0);
  d.front("banks", -18, -8, -1, 3, 1);
  d.path("roads", [15, 3], [19, 3]);
  d.front("desalination_plant", 16, 3, 1, 2, 2);
  d.front("trash_burning_plants", -17, -1, 1, 3, 1);
  d.plant("trees", 2, [[-15,-4], [-12,-4], [-6,-4], [-3,-5], [1,-5], [4,-5], [8,-5], [11,-5], [-14,8], [-4,10], [0,8], [2,10]]);
  d.plant("shrubs", 2, [[-15,-7], [-5,-7], [-4,-6], [1,-7], [4,-7], [8,-7], [11,-7], [-15,6], [-7,8], [1,7], [8,7], [10,5]]);
  d.plant("trees", 3, [[-20,-8], [-19,-11], [-17,-13], [-14,-14], [-10,-14], [-7,-15], [-2,-14], [1,-14], [5,-15], [9,-14], [14,-13], [16,-10], [16,-7], [17,-5]]);
  d.plant("pine_trees", 3, [[-20,0], [-19,3], [-18,5], [-18,8], [-16,10], [-14,11], [-13,13], [-10,13], [-6,12], [-3,12], [1,11], [4,9], [7,9]]);
  d.plant("orchards", 2, [[-14,9], [-12,10], [-9,10], [-7,10], [-3,8], [-2,10]]);
  d.plant("plants", 2, [[-17,-12], [-11,-12], [-5,-13], [-1,-12], [4,-12], [10,-13], [15,-10], [16,-6], [-17,7], [-14,8], [-3,10], [1,9], [6,8], [10,5]]);
  recomputeConnectivityAndMetrics(d.state);
  addLine(d.state, "ferry", pier.id, [pier.id, ring.id]);
  return d.finish(1_600_000, 10.5, 20);
}
function copperGorge() {
  const d = new District("copper-gorge", -63, -18),
    s = d.state;
  // The dark, stepped canyon bed lies below both rims; the spring is perched on the western ridge.
  d.works({ kind: "mountain", radius: 3, height: 2.7 }, [-10, -8], [-7, -5]);
  d.works({ kind: "raise", radius: 2, height: 1.3 }, [-10, -1], [-8, -1]);
  d.works({ kind: "lower", radius: 1, height: 1 }, [-8, 0], [-6, 0]);
  d.works({ kind: "smooth", radius: 2 }, [-7, -3], [-6, -2]);
  d.works({ kind: "paint", radius: 3, material: "clay" }, [-13, -4], [-6, -5]);
  // Tributary cuts and shallow shelves open the upper canyon. The two narrow bridge throats remain dry at either end.
  const gorge: Tile[] = [
    [-6, -16],
    [-5, -14],
    [-2, -13],
    [-2, -11],
    [1, -10],
    [2, -8],
    [2, -7],
    [0, -5],
    [0, -1],
    [-1, 1],
    [0, 3],
    [0, 6],
    [2, 8],
    [2, 9],
  ];
  d.works({ kind: "canyon", height: 0.9, radius: 2 }, [-5, -14], [-2, -12], [0, -10], [2, -9]);
  d.works({ kind: "canyon", height: 1.05, radius: 2 }, [5, -11], [4, -9], [2, -8]);
  d.works({ kind: "canyon", height: 0.85, radius: 1 }, [-4, -8], [-3, -6], [-1, -5]);
  d.works({ kind: "canyon", height: 0.8, radius: 2 }, [0, 6], [3, 8], [5, 10]);
  d.works({ kind: "raise", height: 1.1, radius: 2 }, [5, -13], [7, -12], [7, -9]);
  d.works({ kind: "raise", height: 1.2, radius: 2 }, [-6, 5], [-7, 6], [-6, 8]);
  d.works({ kind: "canyon", height: 2, radius: 1 }, ...gorge);
  d.works({ kind: "river", depth: 1.8, flow: 12, waterLevel: -2.7 }, ...gorge);
  d.works({ kind: "pond", radius: 2, depth: 2.5, waterLevel: -2.7 }, [2, 10]);
  d.works({ kind: "dam", gate: "closed", height: 2 }, [0, 5]);
  d.works({ kind: "spring", depth: 0.7, flow: 32, waterLevel: 6.4 }, [-7, -5]);
  d.works({ kind: "bridge", shape: "truss", mode: "road", height: 2 }, [-3, -1], [3, -1]);
  d.works({ kind: "bridge", shape: "arch", mode: "foot", height: 1.4 }, [-3, 3], [1, 3]);
  d.path("roads", [-12, -1], [-3, -1]);
  d.path("roads", [3, -1], [12, -1], [12, 5], [9, 5]);
  d.path("roads", [-12, -1], [-12, -6], [-6, -6]);
  d.path("roads", [-6, -1], [-6, 3], [-3, 3]);
  d.path("walking_paths", [2, -1], [2, 4], [8, 4], [8, 0], [3, 0]);
  d.path("walking_paths", [3, 0], [3, 3]);
  d.path("walking_paths", [6, 3], [6, 4]);
  d.place("farm_houses", 5, 2, 2, 0, 1);
  d.place("fields", 4, 2, 1, 3, 0);
  d.place("fields", 7, 2, 1, 1, 1);
  d.place("fields", 5, 1, 1, 2, 2);
  d.place("fields", 6, 1, 1, 2, 3);
  d.place("fields", 5, 3, 1, 0, 0);
  // The eastern road leads from the original five-field farm to the new campus and creamery.
  d.path("roads", [12,-1], [27,-1]);
  d.front("dairy_farm", 14, -1, 1, 3, 0);
  d.front("grain_farm", 16, -1, 1, 3, 1);
  d.place("grazing_pasture", 14, 2, 1, 0, 0);
  d.place("livestock_pen", 15, 2, 1, 0, 1);
  d.place("feed_silo", 16, 2, 1, 0, 0);
  d.place("grain_fields", 17, 2, 1, 0, 1);
  d.place("grain_fields", 18, 2, 1, 0, 2);
  d.front("high_school", 17, -1, -1, 3, 1);
  d.front("sports_field", 20, -1, -1, 2, 2);
  d.front("lds_temples", 24, -1, -1, 4, 0);
  d.front("grocery_store", 8, -1, -1, 3, 1);
  d.front("townhomes", 10, -1, 1, 1, 0);
  d.front("municipal_reservoir", 5, -1, -1, 3, 0);
  d.front("school", 10, -1, -1, 2, 3);
  d.place("water_treatment_plant", 10, 2, 3, 1, 2);
  d.front("open_pit_mine", -10, -6, 1, 4, 1);
  d.front("water_reuse_works", -6, -6, -1, 2, 2);
  d.front("townhomes", -11, -1, 1, 2, 0);
  d.front("townhomes", -9, -1, 1, 2, 3);
  d.front("townhomes", -5, -1, -1, 2, 1);
  d.front("city_offices", -12, -6, -1, 2, 2);
  d.front("fire_department", -10, -6, -1, 2, 1);
  d.front("geothermal_power_plants", -5, -1, 1, 1, 0);
  d.front("trash_burning_plants", -11, -1, -1, 2, 0);
  d.front("park", 10, 5, 1, 3, 3);
  d.front("businesses", 9, 5, -1, 2, 0);
  d.place("hydro_electric_power_plants", -1, 5, 1, 3, 1);
  d.path("roads", [-4, 3], [-4, 6], [-2, 6]);
  d.place("deserts", -12, 3, 2, 0, 0);
  d.place("deserts", -10, 3, 2, 0, 1);
  d.front("medium_sized_homes", -12, -1, 1, 1, 1);
  d.path("dirt_roads", [-12, -1], [-13, -1], [-13, 2], [-9, 2]);
  d.front("house", -11, 2, 1, 1, 0);
  d.front("gardens", -10, 2, 1, 1, 2);
  d.works({ kind: "aqueduct", height: 3.5, style: 2 }, [-7, -5], [-7, -3], [-4, -3], [5, -3]);
  d.works({ kind: "aqueduct", height: 3, style: 1 }, [3, -3], [3, 2], [4, 2]);
  d.works({ kind: "aqueduct", height: 3, style: 1 }, [4, -3], [4, -5], [5, -5]);
  d.works({ kind: "aqueduct", height: 2, style: 1 }, [3, 0], [7, 0], [7, 1]);
  d.works({ kind: "aqueduct", height: 2, style: 1 }, [3, 2], [3, 3], [5, 3]);
  d.front("teleportation_depot", -7, -1, 1, 1, 3);
  d.front("teleportation_depot", 9, 5, 1, 1, 2);
  const coach = d.front("bus_depots", -8, -6, -1, 1, 0),
    mineStop = d.front("bus_stops", -7, -1, -1),
    farmStop = d.front("bus_stops", 9, -1, 1);
  recomputeConnectivityAndMetrics(s);
  addLine(s, "bus", coach.id, [mineStop.id, farmStop.id]);
  d.path("walking_paths", [8, 4], [8, 7], [3, 7]);
  d.plant("groves_of_olives", 2, [
    [3, 5],
    [5, 5],
  ]);
  d.plant(
    "orchards",
    2,
    [
      [3, 8],
      [5, 8],
      [7, 8],
    ],
    2,
  );
  d.plant("pine_trees", 3, [
    [-11, -11],
    [-9, -11],
    [-8, -9],
    [-6, -9],
    [-5, -10],
    [-4, -9],
    [6, -11],
    [7, -10],
    [8, -12],
    [9, -10],
    [6, -8],
    [8, -6],
    [-6, 5],
    [-7, 7],
    [-5, 8],
    [-6, 10],
  ]);
  d.plant("trees", 2, [
    [-4, -11],
    [-3, -9],
    [-3, -7],
    [4, -8],
    [6, -6],
    [7, -5],
    [10, -6],
    [12, -5],
    [-4, 7],
    [-3, 9],
    [0, 12],
    [4, 12],
    [6, 10],
  ]);
  d.plant("shrubs", 2, [
    [-4, -8],
    [-2, -7],
    [0, -7],
    [5, -6],
    [7, -7],
    [8, -8],
    [1, -4],
    [-2, -2],
    [-3, 1],
    [1, 2],
    [3, 6],
    [4, 8],
    [5, 9],
    [7, 8],
    [-6, 6],
    [-4, 9],
  ]);
  d.plant("bushes", 1, [
    [8, 1],
    [8, 3],
    [8, 5],
    [9, 6],
    [11, 6],
    [4, 4],
    [5, 4],
    [7, 3],
  ]);
  return d.finish(42000, 14, 24);
}
function switchyardCity() {
  const d = new District("switchyard-city", 10, 62),
    s = d.state;
  d.works({ kind: "interchange", layout: "diamond", orientation: 0, signal: "auto", lanes: 6 }, [10, -6]);
  d.path("freeways", [-14, -6], [15, -6]);
  d.works({ kind: "street", lanes: 8, signal: "auto", period: 12 }, [-13, -6], [-8, -6]);
  d.path("pretty_roads", [-13, -2], [15, -2]);
  d.path("roads", [-13, -2], [-13, 2], [13, 2], [13, -2]);
  d.path("pretty_roads", [-5, -2], [-5, 2]);
  d.path("roads", [-13, -2], [-13, -5]);
  d.path("roads", [-12, -9], [4, -9], [4, -3]);
  d.path("roads", [-12, -9], [-12, -6]);
  d.works({ kind: "street", signal: "east", lanes: 4, period: 14 }, [-5, -2]);
  // Signaled main and a separate return track between the market and the utility works.
  d.path("train_tracks", [-13, 4], [15, 4]);
  d.path("train_tracks", [-2, 4], [-2, 6], [2, 6], [2, 4]);
  for (const rail of s.elements.filter(e => e.defId === "train_tracks")) rail.level = 2;
  const train = d.front("train_depots", -13, 2, 1, 1, 0),
    stationA = d.front("train_stops", -6, 2, 1, 2, 2),
    stationB = d.front("train_stops", 6, 2, 1, 2, 1);
  d.front("train_stops", 11, 2, 1, 2, 0);
  const bus = d.front("bus_depots", -12, -2, -1, 2, 1),
    stopA = d.front("bus_stops", -3, -2, -1, 1, 3),
    stopB = d.front("bus_stops", 9, -2, -1, 1, 0);
  const taxi = d.front("taxi_depots", 6, -2, -1, 2, 1),
    rankA = d.front("taxi_ranks", -2, 2, -1, 1, 0),
    rankB = d.front("taxi_ranks", 10, 2, -1, 1, 3);
  d.front("cheesesteak_restaurants", -8, -2, -1, 5, 1);
  d.front("bars", -5, -2, -1, 3, 3);
  for (let i = 0; i < 3; i++) d.front("townhomes", -12 + i * 2, -2, 1, 2, i);
  d.front("banks", 0, -2, -1, 3, 0);
  d.place("atms", -1, -3, 1, 1, 1);
  d.front("shops", 2, -2, -1, 2, 1);
  d.front("medium_sized_homes", 0, -2, 1, 2, 3);
  d.place("gardens", 0, 0, 2, 0, 1);
  d.front("house", 2, -2, 1, 1, 1);
  d.front("house", 3, -2, 1, 1, 2);
  d.front("grocery_store", 6, 2, -1, 3, 1);
  d.front("thrift_stores", 4, -2, 1, 1, 2);
  d.front("spaceport", -11, 2, -1, 3, 1);
  d.front("terraced_glasshouses", -12, 7, -1, 3, 2);
  d.front("wells", -8, 7, -1, 5, 0);
  d.path("roads", [-14, 2], [-14, 7], [14, 7], [14, 2]);
  d.front("water_treatment_plant", -7, 7, -1, 4, 2);
  d.front("water_towers", -4, 7, -1, 4);
  d.front("freight_rail_terminal", 3, 7, -1, 3, 2);
  d.front("geothermal_power_plants", 6, 7, -1, 2, 1);
  d.front("trash_burning_plants", 9, 7, -1, 3, 2);
  d.front("data_centers", -10, -9, -1, 2, 1);
  d.front("city_offices", -5, -9, -1, 2, 2);
  d.front("fire_department", -2, -9, -1, 3, 1);
  d.front("police_departments", 0, -9, -1, 2, 2);
  d.front("water_towers", 3, -9, -1, 3, 2);
  const call = d.front("shops", -6, -9, 1, 2, 0);
  d.front("school", -8, -9, -1, 3, 0);
  d.front("park", 6, 7, 1, 3, 1);
  d.front("grocery_store", -2, 7, 1, 3, 1);
  d.front("townhomes", 1, 7, 1, 3, 0);
  d.front("flying_car_depot", -12, 7, 1, 3, 1);
  d.front("flying_car_depot", 12, 7, 1, 3, 2);
  d.front("businesses", 4, 7, 1, 4, 2);
  d.front("wells", -11, -9, -1, 5, 1);
  d.front("wells", -3, -9, -1, 2, 0);
  d.works({ kind: "aqueduct", height: 1, style: 2 }, [-11, -10], [-10, -10]);
  d.works({ kind: "aqueduct", height: 1, style: 2 }, [-8, 6], [-6, 6]);
  d.works({ kind: "aqueduct", height: 1, style: 2 }, [-8, 6], [-10, 6]);
  recomputeConnectivityAndMetrics(s);
  installYardWork(s, train, "siding");
  const marketLine = addLine(s, "rail", train.id, [stationA.id, stationB.id], {
    ...defaultFormation(), name: "Market Local", pattern: "shuttle",
  });
  addTrainToLine(s, marketLine);
  addLine(s, "bus", bus.id, [stopA.id, stopB.id]);
  addLine(s, "taxi", taxi.id, [rankA.id, rankB.id]);
  // Wooded berms separate the freeway from housing. Pocket parks and a lit garden walk continue the station frontage.
  d.path("walking_paths", [14, 7], [16, 7], [16, 4]);
  d.path("walking_paths", [-14, 7], [-14, 10], [-10, 10]);
  d.plant("little_parks", 2, [
    [-8, 0],
    [-3, -1],
    [3, 0],
    [11, -1],
    [-7, 7],
    [13, 8],
    [15, 5],
    [-13, 9],
  ]);
  d.plant("gardens", 2, [
    [-1, 1],
    [8, 0],
    [12, 0],
    [-8, 8],
    [10, 8],
    [14, 8],
    [-10, 9],
  ]);
  d.plant("trees", 2, [
    [-12, -4],
    [-10, -4],
    [-7, -5],
    [-5, -5],
    [-3, -5],
    [1, -5],
    [5, -5],
    [7, -4],
    [9, -4],
    [11, -4],
    [14, -3],
    [15, 1],
    [15, 4],
    [15, 6],
    [-13, 8],
    [-11, 8],
    [-9, 8],
    [-7, 8],
    [-5, 8],
    [3, 8],
    [8, 8],
  ]);
  d.plant("pine_trees", 3, [
    [6, -10],
    [7, -11],
    [8, -10],
    [9, -12],
    [11, -11],
    [13, -10],
    [14, -9],
    [16, -6],
    [17, -7],
    [16, -5],
    [-16, 4],
    [-17, 6],
    [-16, 8],
    [-15, 9],
  ]);
  d.plant("bushes", 2, [
    [7, -7],
    [8, -8],
    [9, -5],
    [11, -7],
    [12, -8],
    [13, -7],
    [14, -5],
    [15, -4],
    [-1, -5],
    [2, -5],
    [4, 1],
    [8, 1],
    [9, 1],
    [11, 1],
    [-11, 9],
    [-9, 9],
  ]);
  d.plant("plants", 2, [
    [-9, -1],
    [-6, -1],
    [-4, -1],
    [-2, -1],
    [4, -1],
    [7, -1],
    [8, -1],
    [-6, 5],
    [0, 6],
    [8, 6],
    [12, 6],
    [13, 3],
    [15, 3],
  ]);
  const ready = d.finish(1_250_000, 21.15, 12);
  igniteSite(ready, call.id);
  recomputeConnectivityAndMetrics(ready);
  dispatchFire(ready, call.id);
  return ready;
}
