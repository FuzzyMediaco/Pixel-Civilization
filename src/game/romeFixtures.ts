import type { District, ExampleMode, ExampleWorld } from "./exampleWorlds";
import { addLine } from "./mobility";
import { setEconomicControl } from "./cityEconomy";
import { recomputeConnectivityAndMetrics } from "./simulation";

export type RomeWorldId = "rome-starter" | "rome-district" | "rome-skyline";
const stop = (name: string, gx: number, gz: number, zoom: number, tryThis: string) => ({ name, gx, gz, zoom, tryThis });
export const ROME_WORLDS: readonly ExampleWorld[] = [
  {
    id: "rome-starter", name: "Via delle Vigne", description: "A farm lane, a courtyard home, and a market. The open parcel is yours to build on.",
    camera: {gx: 0, gz: 0, zoom: 39},
    viewpoints: [
      stop("The vineyard street", 0, 0, 34, "Compare the courtyard roofs on opposite sides of the lane. Use More → View to view this same street in the other Rome direction."),
      stop("The open parcel", 3, 0, 24, "Build a house by the street, inspect its access, and use Undo to return to the original block."),
    ],
  },
  {
    id: "rome-district", name: "Porta Fluminis", description: "Two neighborhoods meet at a river crossing. A passenger railway runs from the market to the baths.",
    camera: {gx: 0, gz: 0, zoom: 80},
    viewpoints: [
      stop("The market block", -3, 0, 40, "Read the home, market, and bathhouse entrances. Compare both directions at the same distance."),
      stop("The bridge and spring", 7, -2, 38, "Inspect the aqueduct bend and follow the water from the hillside spring towards the baths."),
      stop("The passenger railway", -1, 6, 50, "Open City → Transit, select the passenger service and follow a train between stations."),
    ],
  },
  {
    id: "rome-skyline", name: "Colonia Alta", description: "A hilltop observatory rises over a dense riverside quarter. From the bridge, follow the rail line back to the forum.",
    camera: {gx: 1, gz: 0, zoom: 107},
    viewpoints: [
      stop("The hilltop skyline", 0, -4, 77, "Compare the observatory with the housing below. Both directions preserve the same plots and levels."),
      stop("The four insulae", -4, -5, 43, "Compare the four residential variants. Open Details and follow the model into the Atlas."),
      stop("Crossing to the quay", 8, 0, 45, "Follow the bridge deck into the street and compare the aqueduct route above it."),
    ],
  },
];

/** Both directions use these exact parcels, tasks and camera bookmarks. */
export function buildRomeFixture(d: District, id: RomeWorldId, mode: ExampleMode) {
  const mature = id === "rome-skyline";
  if (id === "rome-starter") {
    d.path("roads", [-4, 0], [4, 0]);
    d.front("house", -3, 0, -1);
    d.front("house", -1, 0, -1, 2, 1);
    d.front("grocery_store", 1, 0, -1, 1, 2);
    d.front("farms", -3, 0, 1, 1, 3);
    d.front("solar_panels", 0, 0, 1);
    d.front("wells", 2, 0, 1);
  } else {
    // A real river, spring, embankment and bridge separate the living district from the coast road.
    d.works({kind:"raise", height:1.45, radius:2}, [-8,-7], [-3,-8], [2,-7]);
    d.works({kind:"river", depth:2.6, radius:1, flow:8}, [8,-10], [8,4], [14,9], [26,9]);
    d.works({kind:"bay", depth:3.2, radius:3}, [16,9], [31,9]);
    d.works({kind:"spring", depth:.6, flow:26, waterLevel:6}, [3,-7]);
    d.works({kind:"bridge", shape:"arch", mode:"road", height:2.5}, [6,0], [10,0]);
    d.path("roads", [-10,0], [6,0]);
    d.path("highways", [10,0], [15,0]);
    d.path("freeways", [15,0], [15,-5]);
    d.path("roads", [-10,0], [-10,4], [4,4], [4,0]);
    d.path("train_tracks", [-10,6], [4,6]);
    const depot = d.front("train_depots", -10,4,1);
    const first = d.front("train_stops", -6,4,1,2,1);
    const second = d.front("train_stops", 2,4,1,2,3);
    d.front("house", -8,0,-1,1,0);
    d.front("house", -6,0,-1,2,1);
    d.front("apartments", -4,0,-1,mature ? 5 : 2,2);
    d.front("grocery_store", -1,0,-1,mature ? 4 : 2,1);
    d.front("water_treatment_plant", 2,0,-1,mature ? 4 : 2,2);
    d.front("farms", -8,0,1,2,3);
    d.front("grocery_store", -5,0,1,1,0);
    d.front("apartments", -2,0,1,1,1);
    d.front("solar_panels", 1,0,1,mature ? 4 : 2,0);
    d.place("farm_houses", 11,-3,2,0,1);
    d.place("fields", 11,-5,2,0,2);
    d.works({kind:"aqueduct", height:2.8, style:2}, [3,-7], [6,-7], [6,-2], [3,-2]);
    d.place("aqueduct", 11,2,2,0,2);
    d.plant("groves_of_olives",1,[[-8,2],[-6,2],[-3,2],[1,3],[4,-4],[11,-6]]);
    d.plant("trees",1,[[-9,1],[-8,3],[-4,3],[0,3],[5,-4],[11,1],[12,1],[13,1]]);
    if (mature) {
      d.path("roads", [-10,0], [-10,-6], [4,-6]);
      d.front("spaceport", -7,-6,-1,5,2);
      for (let v=0;v<4;v++) d.front("apartments", -8+3*v,-6,1,3,v);
      d.front("grocery_store", -2,-6,-1,5,3);
      d.front("water_treatment_plant", 1,-6,-1,4,0);
      d.path("roads", [-10,-6], [-14,-6], [-14,4], [-10,4]);
      d.plant("apartments",4,[[-13,-5],[-13,-2],[-13,1]],1);
      d.plant("house",3,[[-9,-4],[-6,-4],[-3,-4],[0,-4],[3,-4],[-9,3],[-6,3],[-3,3],[0,3]],2);
      d.plant("shops",2,[[-9,-2],[-7,-2],[-2,-2],[1,-3],[-11,2],[-11,0],[3,2]],0);
      d.plant("grocery_store",3,[[-13,5],[-11,5],[-10,-8],[-11,-4]],1);
      d.plant("farm_houses",2,[[-14,7],[-11,7]],2);
      d.plant("fields",2,[[-13,8],[-11,8],[-10,7],[-14,8]],2);
      d.plant("gardens",3,[[-10,-7],[-13,-7],[-7,-3],[-4,-3],[-1,-3],[2,-3],[-11,3]],0);
      d.plant("groves_of_olives",2,[[-12,-7],[-8,-10],[-3,-9],[3,-8],[5,-6],[5,-5],[11,-7],[11,2]],0);
    }
    recomputeConnectivityAndMetrics(d.state);
    addLine(d.state,"rail",depot.id,[first.id,second.id]);
  }
  const state = d.finish(mature ? 180000 : id === "rome-district" ? 50000 : 4000, 14, id === "rome-starter" ? 0 : 12);
  // These two God-mode tours exhibit specific stages using the game's own
  // editable control. Real mode always derives its stage from the population.
  if (mode === "god" && id !== "rome-starter") {
    setEconomicControl(state, "stage", mature ? 20 : 8, true);
    recomputeConnectivityAndMetrics(state);
  }
  state.appearanceEra = "rome-aqueduct";
  return state;
}
