import { PERIODS, PRODUCTION_ERAS, type ProductionEra } from "./periods";
import { ROME_WORLDS, buildRomeFixture, type RomeWorldId } from "./romeFixtures";
import type { District, ExampleMode, ExampleWorld } from "./exampleWorlds";
import { recomputeConnectivityAndMetrics } from "./simulation";

const sizes=["starter","district","skyline"] as const;
type Size=typeof sizes[number];
export type PeriodTourId = `${Exclude<ProductionEra,"rome-aqueduct">}-${Size}`;
export const tourId=(era:string,size:Size) => era==="original" || era.startsWith("rome-") ? "rome-"+size : era+"-"+size;
export const tourImage=(era:string,size:Size) => era==="original" || era.startsWith("rome-") ?
  (size==="district" ? "/handbook/worlds/rome-district.webp" : "/handbook/era-pilot/"+era+"-"+(size==="starter"?"street":"skyline")+".webp") :
  "/handbook/worlds/"+tourId(era,size)+".webp";

const signatures: Record<ProductionEra,readonly [string,string,string]> = {
  "ancient-china":["gardens","grocery_store","school"], "ancient-egypt":["fields","farms","water_pumping_station"],
  "rome-aqueduct":["gardens","aqueduct","churches"], "ancient-greece":["groves_of_olives","park","school"],
  "medieval-europe":["farm_houses","shops","churches"], "renaissance-italy":["gardens","banks","churches"],
  "world-war-ii":["fields","train_depots","neighborhood_pharmacy"], "art-deco":["park","apartments","banks"],
  "future-3027":["solar_panels","solar_farms","water_treatment_plant"], "post-apocalyptic":["gardens","wells","farm_houses"],
};
export const PERIOD_TOURS = PRODUCTION_ERAS.filter(era=>era!=="rome-aqueduct").flatMap(era=>sizes.map((size,index)=>{
  const identity=PERIODS[era], template=ROME_WORLDS[index];
  const tasks=[
    "Build a home on the open parcel and check its street access.",
    "Follow a passenger to the second platform and trace spring water to the waterworks.",
    "Inspect the skyline landmark and compare the four apartment courtyards in the Atlas.",
  ];
  const world:ExampleWorld={...template,id:tourId(era,size) as PeriodTourId,name:identity.places[index],
    description:identity.description+" "+tasks[index],viewpoints:template.viewpoints.map((v,i)=>({
      ...v,name:i===0 ? identity.places[index] : v.name,tryThis:i===0 ? tasks[index] : v.tryThis
        .replace("the baths","the waterworks").replace("the observatory",identity.names[9])
    }))};
  return {era,size,world};
}));
export function buildPeriodTour(d:District, tour:typeof PERIOD_TOURS[number], mode:ExampleMode) {
  const state=buildRomeFixture(d,("rome-"+tour.size) as RomeWorldId,mode);
  const [garden,trade,civic]=signatures[tour.era];
  if(tour.size==="starter") {
    d.plant(garden,1,[[-5,1],[4,-1]],1);
  } else {
    d.plant(trade,2,[[10,1],[-11,1],[-8,5],[5,1]],1);
    d.plant(garden,2,[[-9,2],[-6,3],[4,2],[11,-7]],2);
    if(tour.size==="skyline")d.plant(civic,3,[[-15,-6],[-13,-8],[2,-9],[0,7]],2);
  }
  state.appearanceEra=tour.era;
  recomputeConnectivityAndMetrics(state);
  return state;
}
