import { ELEMENTS, ELEMENT_BY_ID, getStandardFootprintForLevel } from "./catalog";
import { cellBeyondEdge, getParcelEdges, PARCEL_SIDES, type ParcelEdge } from "./parcelEdges";
import { buildOccupancyMap, getNetworkConnMask, type PlacedElement } from "./simulation";

const partners: Record<string,string> = {};
function meets(members: string, neighbor: string) {
  for (const id of members.split(" ")) partners[id]=neighbor;
}
meets("house cottages large_homes mansions", "gardens");
meets("tiny_homes trailer_home medium_sized_homes", "roads");
meets("townhomes","townhomes");
meets("apartments apartment_buildings condos villas skyscrapers","bus_stops");
meets("beach_houses beach_umbrellas sand","beaches");
meets("deserts","tubbleweeds");
meets("businesses shops clothing_stores shoe_stores malls atms","banks");
meets("banks","atms");
meets("grocery_store restaurants cheesesteak_restaurants blacksmiths","farms");
meets("bars buildings thrift_stores","shops");
meets("gas_stations bus_stops bus_depots taxi_depots taxi_ranks","two_lane_roads");
meets("data_centers geothermal_power_plants trash_burning_plants district_heat_works","apartments");
meets("farms farm_houses plantations orchards groves_of_olives windmills","fields");
meets("fields","farm_houses");
meets("solar_panels solar_canopy_orchard","solar_farms");
meets("solar_farms coal_powerplants natural_gas_power_plants micro_reactor_nuclear nuclear_power_plants","factories");
meets("landfill trash_compacting_plants factories","trees");
meets("wind_turbines wind_farms","wind_farms");
meets("hydro_electric_power_plants water_treatment_plant water_pumping_station","rivers");
meets("wells water_towers water_places aqueduct desalination_plant rainwater_cathedral","municipal_reservoir");
meets("municipal_reservoir","aqueduct");
meets("water_tile canals wide_rivers rivers","canals");
meets("roads two_lane_roads","house");
meets("dirt_roads","farm_houses");
meets("paths walking_paths trails side_walks pretty_roads","park");
meets("train_tracks","train_stops");
meets("train_stops train_depots freight_rail_terminal","train_tracks");
meets("bridges stone_bridges boardwalks highways freeways over_passes underpasses suspension_bridges","roads");
meets("school tax_collecting_office city_offices post_offices courthouses government_buildings community_centers","park");
meets("park little_parks large_parks italian_gardens","walking_paths");
meets("gardens","house");
meets("police_precinct police_departments jails prisons military_base swat_team_hq airforce_base fire_department","city_offices");
meets("churches christian_churches monasteries mosques synagogues temples lds_temples","graveyards");
meets("graveyards","churches");
meets("docks naval_base submarine_base shipyards ship_building_areas ferry_landings","boats");
meets("boats sail_boats speed_boats naval_vessels submarines aircraft_carriers","docks");
meets("trees shrubs bushes pine_trees redwood_trees swamps ponds lakes hills mountains canyons tubbleweeds alligators","trees");
meets("plants","orchards");
meets("beaches","water_tile");
meets("large_landmarks washington_monument white_house smithsonian eiffel_tower the_london_eye the_great_pyramids","italian_gardens");
meets("colosseum stonehenge parthenon great_wall chichen_itza moai_statues angkor_wat machu_picchu","italian_gardens");
meets("growers_exchange bakery_coop","fields");
meets("ferry_exchange canal_boat_lift maritime_college ocean_habitat_ring","docks");
meets("water_reuse_works pumped_storage_station","aqueduct");
meets("open_pit_mine materials_foundry","factories");
meets("terraced_glasshouses","farm_houses");
meets("regional_airport flying_car_depot teleportation_depot","bus_stops");
meets("floodplain_park hanging_garden_arcology skybridge_university spaceport","paths");

meets("preschool country_schoolhouse elementary_school middle_school trade_school community_college","roads");
meets("high_school","sports_field");
meets("sports_field","high_school");
meets("university","research_institute");
meets("research_institute research_university","university");
meets("vegetable_farm","vegetable_fields");
meets("grain_farm","dairy_farm");
meets("dairy_farm","grain_farm");
meets("poultry_farm","chicken_coop");
meets("cattle_ranch horse_ranch","grazing_pasture");
meets("apiary","orchard_block");
meets("orchard_block","apiary");
meets("vineyard rice_farm","irrigation_pond");
meets("greenhouse_farm vertical_farm","greenhouse_bay");
meets("vegetable_fields grain_fields grazing_pasture livestock_pen chicken_coop feed_silo irrigation_pond greenhouse_bay","farm_houses");
function model(id:string,level:number,rotation:number): PlacedElement {
  const [w,h]=getStandardFootprintForLevel(ELEMENT_BY_ID[id],level);
  return {id:id+"-guide",defId:id,gx:0,gz:0,rotation,level,spanX:rotation%2?h:w,spanZ:rotation%2?w:h,
    variant:0,connected:true,hasPoliceCover:false,hasFireCover:false,nuisancePenalty:0,maintTimerSec:0,
    disrepair:false,onFire:false,animProgress:0,animKind:"place"};
}
export interface NeighborPreview { el:PlacedElement; edges:ParcelEdge[]; mask:number }
export const getGuidePartner = (id:string) => partners[id];

export function findGuideElements(query: string, category: string) {
  const term = query.trim().toLowerCase().replaceAll("_", " ");
  return ELEMENTS.filter(def =>
    (!category || (category === "starter" ? def.isStarter : def.category === category)) &&
    (def.name.toLowerCase().includes(term) || def.id.replaceAll("_"," ").includes(term)));
}

/** Continuation tiles belong to the selected network's style, including its markings and track bed. */
export function getGuideVariant(primary: string, other: string, variant: number, index: number) {
  return index === 0 || (primary === other && ELEMENT_BY_ID[primary].isNetwork) ? variant : (variant + 1) % 4;
}

/** Build actual adjoining sites using the same sockets and network masks as the island. */
export function getNeighborPreview(id:string,level:number): NeighborPreview[] {
  const a=model(id,level,0), other=partners[id];
  if(!other || !ELEMENT_BY_ID[other]) return [];
  let best:PlacedElement[] = [], bestScore=0;
  for(const side of [1,2,0,3]) for(let rotation=0;rotation<4;rotation++) {
    const companionLevel=other===id ? level : !ELEMENT_BY_ID[other].isNetwork && other!=="fields" ? Math.min(3,Math.max(1,level-1)) : 1;
    const b=model(other,companionLevel,rotation); b.id+="-neighbor";
    const horizontal=side===0||side===2;
    const maxOffset=Math.max(0,horizontal?a.spanX-b.spanX:a.spanZ-b.spanZ);
    const center=Math.floor(maxOffset/2);
    for(let n=0;n<=maxOffset;n++) {
      const offset=(n+center)%(maxOffset+1);
      b.gx=horizontal?offset:side===1?a.spanX:-b.spanX;
      b.gz=horizontal?(side===2?a.spanZ:-b.spanZ):offset;
      const pair=[a,b], occ=buildOccupancyMap(pair), edges=getParcelEdges(a,occ);
      if(!edges.length) continue;
      const score = Math.max(...edges.map(edge => ["garden","party","platform","bus","dock","cloister","skywalk"].includes(edge.kind) ? 5 :
        edge.kind === "walk" || edge.kind === "yard" ? 1 : 3));
      if(score>bestScore) {best=pair.map(e=>({...e}));bestScore=score;}
    }
  }
  if(best.length===0) return [];
  const occupancy=buildOccupancyMap(best);
  const site=best.find(e=>!ELEMENT_BY_ID[e.defId].isNetwork);
  const line=best.find(e=>ELEMENT_BY_ID[e.defId].isNetwork);
  if(site && line) {
    const edge=getParcelEdges(site,occupancy).find(e=>e.kind==="platform" || e.kind==="bus" || e.kind==="drive");
    if(edge) {
      const [x,z]=cellBeyondEdge(site,edge.side,edge.slot);
      const alongX=x>=site.gx && x<site.gx+site.spanX;
      const from=alongX ? site.gx : site.gz;
      const end=from+(alongX ? site.spanX : site.spanZ);
      for(let i=from-1;i<=end;i++) {
        const gx=alongX ? i : x, gz=alongX ? z : i;
        if (!occupancy.has(gx+","+gz)) best.push({...line,id:line.id+"@"+i,gx,gz});
      }
    }
  }
  if(id==="farm_houses") {
    // The guide shows a working cluster. Small homesteads have four free sides.
    for(const side of PARCEL_SIDES) {
      const length=side==="front" || side==="back" ? a.spanX : a.spanZ;
      for(let slot=0;slot<length && best.length<6;slot++) {
        const [gx,gz]=cellBeyondEdge(a,side,slot);
        if(occupancy.has(gx+","+gz)) continue;
        best.push({...best[1],id:"field@"+gx+","+gz,gx,gz});
      }
    }
  }
  const occ=buildOccupancyMap(best);
  return best.map(el=>({el,edges:getParcelEdges(el,occ),mask:getNetworkConnMask(best,el,occ)}));
}
