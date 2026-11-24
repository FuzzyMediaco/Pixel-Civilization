import { ELEMENT_BY_ID } from "../game/catalog";
import type { ExampleWorldId } from "../game/exampleWorlds";
import { createInitialGameState, planConstruction, recomputeConnectivityAndMetrics, type GameState, type PlacedElement } from "../game/simulation";
import { applyInfrastructureStroke, applyLandformPlacement, getTerrainCell, type InfrastructureTool } from "../game/terrain";

type Point = [number, number];
type Build = { element: string; at: Point };
type Works = { tool: InfrastructureTool; at: Point; end?: Point };
export type CourseAction = Build | Works;
type Lesson = {
  id: string; title: string; goal: string; coach: string; image: string; alt: string;
  tool: string; action: CourseAction; prep?: Build[]; elements: string[];
  reference: string; tour?: { world: ExampleWorldId; view: number; label: string };
};

export const COURSE: Lesson[] = [
  { id:"frontage", title:"Lay out a first neighborhood", goal:"Give a home a direct street frontage.",
    coach:"Start with a road you can extend. Look at how the entrance meets the street. On your island, leave space behind the street for another row of parcels.",
    image:"neighbors/street-entrances.webp", alt:"Buildings face the sidewalks of a neighborhood street",
    tool:"Build House", action:{element:"house",at:[0,1]}, prep:[{element:"roads",at:[0,0]}], elements:["house","roads","townhomes"], reference:"quick_menus" },
  { id:"services", title:"Supply the people who move in", goal:"Add power to a connected residential block.",
    coach:"Each new household creates demand. Put utilities on a connected street, then inspect Power, Water, and Waste separately before adding more homes.",
    image:"travel/map-layers.jpg", alt:"A map layer overlays service information on the island",
    tool:"Build Solar Panels", action:{element:"solar_panels",at:[0,-1]}, prep:[{element:"roads",at:[0,0]},{element:"house",at:[0,1]}], elements:["solar_panels","water_treatment_plant","landfill"], reference:"city" },
  { id:"economy", title:"Balance jobs and the treasury", goal:"Add jobs without making the whole district commercial.",
    coach:"A home needs useful destinations. Add a business with street access. In Real and Survival, check the operating balance and keep a reserve before paying for upkeep or another expansion.",
    image:"scenes/round2-phone-money.webp", alt:"The Money panel shows cash flow and city accounts",
    tool:"Build Business", action:{element:"businesses",at:[1,1]}, prep:[{element:"roads",at:[0,0]},{element:"roads",at:[1,0]},{element:"house",at:[0,1]}], elements:["businesses","grocery_store","farms"], reference:"city" },
  { id:"ridge", title:"Sculpt land at the right scale", goal:"Raise a ridge and compare its elevation with the surrounding land.",
    coach:"Shape big slopes first, then use small brushes to refine the edges. Inspect the height before placing road approaches. Leave space for gentler grades.",
    image:"works/tool-gallery-land.webp", alt:"Land sculpting tools grouped by the changes they make",
    tool:"Sculpt Mountain Ridge", action:{tool:{kind:"mountain",radius:1},at:[0,0]}, elements:["hills","mountains","canyons"], reference:"works" },
  { id:"river", title:"Shape waterways and shorelines", goal:"Cut a continuous channel across three cells.",
    coach:"Start with the intended flow and leave room on the banks. Plan a crossing and check the terrain next to the water before placing a beach or waterside building.",
    image:"works/graded-coast.webp", alt:"An engineered coast with water and a gradual shoreline",
    tool:"Draw River", action:{tool:{kind:"river",radius:0},at:[-1,0],end:[1,0]}, elements:["rivers","beaches","ferry_landings"], reference:"works" },
  { id:"crossing", title:"Connect two banks", goal:"Complete a corridor across a channel.",
    coach:"Check both banks before building the deck. A crossing needs a usable approach on each side. In an active shipping channel, inspect clearance and lift timing.",
    image:"works/lift-crossings.webp", alt:"Crossings with raised decks and navigable channels",
    tool:"Lay the Crossing Approach", action:{element:"roads",at:[1,0]}, prep:[{element:"roads",at:[-1,0]},{element:"roads",at:[0,0]}], elements:["roads","highways","suspension_bridges"], reference:"works",
    tour:{world:"pelican-reach",view:0,label:"Visit a working lift crossing"} },
  { id:"rail", title:"Lay track before dispatching trains", goal:"Extend a continuous track approach.",
    coach:"Track, platforms, and service assignment are separate. Inspect the route in Rail Operations before dispatching a train. On your island, leave clear approaches and room for freight or passenger platforms.",
    image:"scenes/round2-rail-yard.webp", alt:"A rail yard with tracks, rolling stock, and operations controls",
    tool:"Lay Train Track", action:{element:"train_tracks",at:[1,0]}, prep:[{element:"train_tracks",at:[0,0]}], elements:["train_tracks","bus_stops","ferry_landings"], reference:"railworks",
    tour:{world:"switchyard-city",view:0,label:"Visit the rail network"} },
  { id:"protection", title:"Protect the next district", goal:"Place a road-accessible fire station.",
    coach:"Compare the Fire and Police layers as the city grows. Put responders where the streets reach the buildings they protect. Check any staffing or coverage warning in the inspector.",
    image:"city/fire-response.webp", alt:"Fire response at a city building",
    tool:"Build Fire Department", action:{element:"fire_department",at:[0,1]}, prep:[{element:"roads",at:[0,0]}], elements:["fire_department","police_precinct","landfill"], reference:"safety_military" },
  { id:"parks", title:"Build for more than population", goal:"Add recreation to a growing neighborhood.",
    coach:"Read the current stage goals in City. Add recreation and services where people can actually reach them. As you expand, compare both output and demand before upgrading a landmark.",
    image:"scenes/round2-wonders.webp", alt:"A developed island with high-stage civic projects",
    tool:"Build Park", action:{element:"park",at:[0,1]}, prep:[{element:"roads",at:[0,0]}], elements:["park","school","large_landmarks"], reference:"projects",
    tour:{world:"meridian-fair",view:0,label:"Tour an advanced civic district"} },
];

export function applyCourseAction(state: GameState, action: CourseAction, point = action.at) {
  const [gx, gz] = point;
  if ("tool" in action) {
    const points = [{gx, gz}];
    if (action.end) points.push({gx:gx + action.end[0] - action.at[0],gz:gz + action.end[1] - action.at[1]});
    const result = applyInfrastructureStroke(state, action.tool, points);
    return { ok:result.valid, detail:result.reason };
  }
  const plan = planConstruction(state,ELEMENT_BY_ID[action.element],gx,gz,1,0);
  if (!plan.valid) return {ok:false,detail:plan.reason};
  const site: PlacedElement = {
    id:"study-" + gx + "-" + gz, defId:plan.def.id, gx,gz,spanX:plan.spanX,spanZ:plan.spanZ,
    rotation:plan.rotation,level:plan.level,variant:0,connected:false,hasPoliceCover:false,hasFireCover:false,
    nuisancePenalty:0,maintTimerSec:0,disrepair:false,onFire:false,animProgress:1,animKind:"place",overWater:plan.overWater,roadAxis:plan.roadAxis,
  };
  state.elements.push(site);
  applyLandformPlacement(state,site);
  recomputeConnectivityAndMetrics(state);
  return {ok:true,detail:undefined};
}

export function makeCourseIsland(lesson: Lesson) {
  const state = createInitialGameState("god");
  if (lesson.id === "crossing") {
    applyCourseAction(state,{tool:{kind:"river",radius:0},at:[0,-2],end:[0,2]});
  }
  for (const build of lesson.prep ?? []) applyCourseAction(state,build);
  return state;
}

export function tileAt(state: GameState, gx: number, gz: number) {
  return {
    cell:getTerrainCell(state,gx,gz),
    placed:state.elements.find((site) => gx >= site.gx && gx < site.gx + site.spanX && gz >= site.gz && gz < site.gz + site.spanZ),
  };
}
