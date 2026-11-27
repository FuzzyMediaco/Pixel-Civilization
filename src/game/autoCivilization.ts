import { ELEMENT_BY_ID, ELEMENTS, getMaxElementLevel, getStandardFootprintForLevel, STAGES, type CivElementDef } from "./catalog";
import { AUTHORITY_BUILDINGS, buildingCharges, transfer } from "./cityEconomy";
import { cellFromIndex, cellIndex, GRID_MIN, GRID_MAX, GRID_SIZE, withinMap } from "./mapBounds";
import {
  buildingLockReason, buildOccupancyMap, checkPlacementValid, makeElementId,
  planConstruction, recomputeConnectivityAndMetrics, upgradeElementDirect,
  type GameState, type PlacedElement,
} from "./simulation";
import { settleStreetFacing } from "./streetFacing";
import { VEHICLE_ROADS } from "./roadStandards";
import { addLine, eligibleDepots, eligibleStops } from "./mobility";
import { applyInfrastructureStroke, applyLandformPlacement, freshWaterFactor, getTerrainCell, requiredToolStage } from "./terrain";

export type LayoutStyle = "grid" | "ring" | "avenue" | "coastal_spine";

export interface AutoCivProfile {
  seed: number;
  layoutStyle: LayoutStyle;
  blockW: number;
  blockH: number;
  originX: number;
  originZ: number;
  preferredVariant: number;
}

const directions = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] } as const;
type Direction = keyof typeof directions;
type Zone = Direction | "coast" | "center";
type Point = [number, number];
const neighbors = Object.values(directions);
const key = (x: number, z: number) => `${x},${z}`;

export interface ManagerChoice {
  id: string;
  label: string;
  detail: string;
  action:
    | { kind: "build"; defId: string; zoneHint?: Zone }
    | { kind: "upgrade_best" }
    | { kind: "expand_roads"; direction: Direction }
    | { kind: "continue" }
    | { kind: "skip" };
}

export interface ManagerDecision {
  id: string;
  kicker: string;
  question: string;
  context: string;
  choices: ManagerChoice[];
}

export interface AutoStepOutcome {
  didAct: boolean;
  summary: string;
  placedDefId?: string;
  focusGrid?: Point;
}

const idle = (summary: string): AutoStepOutcome => ({ didAct: false, summary });
const action = (summary: string, el: PlacedElement): AutoStepOutcome => ({
  didAct: true, summary, placedDefId: el.defId, focusGrid: [el.gx, el.gz],
});

function noise(seed: number, x: number, z: number) {
  let a = seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(z, 0x27d4eb2d);
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

export function createAutoCivProfile(seed = Date.now() ^ Math.floor(Math.random() * 0xfffffff)): AutoCivProfile {
  const layoutStyles: LayoutStyle[] = ["grid", "ring", "avenue", "coastal_spine"];
  const layoutStyle = layoutStyles[Math.floor(noise(seed, 2, 5) * layoutStyles.length)];
  return {
    seed, layoutStyle,
    blockW: layoutStyle === "avenue" ? 7 : 4 + Math.floor(noise(seed, 4, 5) * 3),
    blockH: layoutStyle === "avenue" ? 4 : 4 + Math.floor(noise(seed, 5, 5) * 3),
    originX: -5 + Math.floor(noise(seed, 6, 5) * 11),
    originZ: -5 + Math.floor(noise(seed, 7, 5) * 11),
    preferredVariant: Math.floor(noise(seed, 8, 5) * 4),
  };
}

type Survey = ReturnType<typeof survey>;
const vehicleRoad = (el?: PlacedElement) => !!el && VEHICLE_ROADS.has(el.defId);
const dry = (state: GameState, x: number, z: number) => {
  const cell = getTerrainCell(state, x, z);
  return cell.kind === "land" && cell.depth <= .15;
};

function survey(state: GameState, profile: AutoCivProfile) {
  const occupancy = buildOccupancyMap(state.elements);
  const roads = state.elements.filter(vehicleRoad);
  const counts = new Map<string, number>();
  const categories = new Map<string, number>();
  const districts = new Map<string, number>();
  const districtKey = (x: number, z: number) => key(Math.floor(x / 12), Math.floor(z / 12));
  for (const {defId,gx,gz} of state.elements) {
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
    const category = ELEMENT_BY_ID[defId]?.category;
    if (category && !ELEMENT_BY_ID[defId]?.isNetwork) {
      categories.set(category, (categories.get(category) ?? 0) + 1);
      const district = districtKey(gx,gz);
      districts.set(district,(districts.get(district) ?? 0) + 1);
    }
  }
  const distance = (x: number, z: number) => {
    const dx = Math.abs(x - profile.originX);
    const dz = Math.abs(z - profile.originZ);
    if (profile.layoutStyle === "ring") return Math.max(dx, dz);
    if (profile.layoutStyle === "coastal_spine") return dx * .7 + dz * 1.15;
    return Math.hypot(dx, dz);
  };
  const roadLine = (x: number, z: number) =>
    (x - profile.originX) % profile.blockW === 0 || (z - profile.originZ) % profile.blockH === 0;
  return { occupancy, roads, counts, categories, districts, districtKey, distance, roadLine };
}

type Construction = ReturnType<typeof planConstruction>;

function place(
  state: GameState, site: Survey, plan: Construction, x: number, z: number, variant: number,
): PlacedElement | undefined {
  if (!plan.valid || (buildingCharges(state) && state.money < plan.def.cost)) return;
  if (buildingCharges(state)) transfer(state, "treasury", "outside", plan.def.cost, "Auto-Construction");
  const el: PlacedElement = {
    id: makeElementId(), defId: plan.def.id, gx: x, gz: z, spanX: plan.spanX, spanZ: plan.spanZ,
    level: plan.level, rotation: plan.rotation, variant,
    connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
    maintTimerSec: 0, disrepair: false, onFire: false, animProgress: 1, animKind: "place",
    ...(plan.overWater ? { overWater: true } : {}),
    ...(plan.roadAxis ? { roadAxis: plan.roadAxis } : {}),
    ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
  };
  if (plan.replaceId) {
    el.waterUnderlay = state.elements.find(e => e.id === plan.replaceId);
    state.elements = state.elements.filter(e => e.id !== plan.replaceId);
  }
  state.elements.push(el);
  applyLandformPlacement(state, el);
  for (let dx = 0; dx < el.spanX; dx++) {
    for (let dz = 0; dz < el.spanZ; dz++) site.occupancy.set(key(x + dx, z + dz), el);
  }
  if (!plan.def.isNetwork) settleStreetFacing(state, el, false);
  return el;
}

function buildRoad(state: GameState, site: Survey, points: Point[], profile: AutoCivProfile, turn: number): AutoStepOutcome {
  let last: PlacedElement | undefined;
  let built = 0;
  for (const [x, z] of points) {
    if (!dry(state, x, z) || site.occupancy.has(key(x, z))) break;
    const arterial = (x - profile.originX) % (3 * profile.blockW) === 0 ||
      (z - profile.originZ) % (3 * profile.blockH) === 0;
    const previous = points[built - 1] ?? points[1];
    const axis = previous && previous[1] === z ? "x" : "z";
    const through = axis === "x"
      ? (z - profile.originZ) % (3 * profile.blockH) === 0
      : (x - profile.originX) % (3 * profile.blockW) === 0;
    const wide = through && arterial && points.length >= 5 && previous && state.highestStageReached >= 9;
    const preferred = wide && state.highestStageReached >= 15 && turn % 3 === 0 ? "freeways"
      : wide ? "highways" : arterial ? "two_lane_roads" : "pretty_roads";
    const options = (turn + profile.seed) % 4 === 0 ? ["roads"] : [preferred,"roads"];
    const plan = options.map(id => planConstruction(state,ELEMENT_BY_ID[id],x,z,1,0,false,axis,site.occupancy))
      .find(candidate => candidate.valid);
    if (!plan) break;
    const builtRoad = place(state, site, plan, x, z, profile.preferredVariant);
    if (!builtRoad) break;
    built++;
    last = builtRoad;
  }
  if (!last) return idle("Finding a new street route");
  recomputeConnectivityAndMetrics(state);
  return action(built === 1 ? "Connected a street tile" : `Opened a new street · ${built} tiles`, last);
}

function extendRoad(state: GameState, site: Survey, profile: AutoCivProfile, turn: number, direction?: Direction) {
  if (!site.roads.length) {
    const start: Point = [profile.originX, profile.originZ];
    const step = profile.seed % 2 === 0 ? directions.east : directions.south;
    const options: Point[] = [start];
    for (let r = 1; r <= 30; r++) for (const [dx, dz] of neighbors) options.push([start[0] + dx*r, start[1] + dz*r]);
    for (const [x, z] of options) {
      if (!dry(state, x, z) || site.occupancy.has(key(x, z))) continue;
      return buildRoad(state, site, Array.from({length: 6}, (_, i) => [x + step[0]*i, z + step[1]*i]), profile, turn);
    }
    return idle("No open starter street site");
  }
  const choices: {points: Point[]; score: number}[] = [];
  const extension = direction ? [directions[direction]] : neighbors;
  const spread = turn % 3 === 0;
  for (const {gx, gz} of site.roads) {
    for (const [dx, dz] of extension) {
      const x = gx + dx, z = gz + dz;
      if (!withinMap(x, z) || site.occupancy.has(key(x, z)) || !dry(state, x, z)) continue;
      const aligned = dx ? (gz - profile.originZ) % profile.blockH === 0 : (gx - profile.originX) % profile.blockW === 0;
      const points: Point[] = [];
      for (let i = 1; i <= 6; i++) {
        const px = gx + i*dx, pz = gz + i*dz;
        if (!withinMap(px, pz) || site.occupancy.has(key(px, pz)) || !dry(state, px, pz)) break;
        points.push([px, pz]);
      }
      const occupiedNeighbors = neighbors.filter(([a,b]) => site.occupancy.has(key(x+a,z+b))).length;
      if (!aligned && occupiedNeighbors >= 3) continue;
      const score = (aligned ? 32 : 0) + points.length*2 - occupiedNeighbors*4 +
        (spread ? .56 : -.34)*site.distance(gx, gz) + noise(profile.seed + turn, x, z)*11 -
        (site.districts.get(site.districtKey(x,z)) ?? 0) * (spread ? 1.1 : .2);
      choices.push({points, score});
    }
  }
  choices.sort((a,b) => b.score - a.score);
  for (const {points} of choices.slice(0, 8)) {
    const outcome = buildRoad(state, site, points, profile, turn);
    if (outcome.didAct) return outcome;
  }
  return idle("No open road extension in this direction");
}

/**
 * Survey dry land by connected component. A crossing must end on a different shore, not
 * grow an open-ended pier. Scan both axes for feasible spans and retain alternate approaches.
 */
function mapCrossings(state: GameState) {
  const land = new Int32Array(GRID_SIZE * GRID_SIZE);
  for (let z = GRID_MIN; z <= GRID_MAX; z++) for (let x = GRID_MIN; x <= GRID_MAX; x++) {
    if (dry(state, x, z)) land[cellIndex(x, z)] = -1;
  }
  const sizes = [0];
  for (let i = 0; i < land.length; i++) {
    if (land[i] !== -1) continue;
    const region = sizes.length;
    const queue = [i];
    land[i] = region;
    for (let j = 0; j < queue.length; j++) {
      const [x,z] = cellFromIndex(queue[j]);
      for (const [dx,dz] of neighbors) {
        if (!withinMap(x+dx,z+dz)) continue;
        const next = cellIndex(x+dx,z+dz);
        if (land[next] !== -1) continue;
        land[next] = region;
        queue.push(next);
      }
    }
    sizes.push(queue.length);
  }
  const crossings: {a: Point; b: Point; length: number; first: number; second: number}[] = [];
  for (const horizontal of [true, false]) for (let line = GRID_MIN; line <= GRID_MAX; line++) {
    let last: Point | undefined;
    let first = 0;
    for (let along = GRID_MIN; along <= GRID_MAX; along++) {
      const point: Point = horizontal ? [along, line] : [line, along];
      const second = land[cellIndex(...point)];
      if (!second) continue;
      if (last && first !== second && sizes[first] >= 25 && sizes[second] >= 25) {
        crossings.push({a: last, b: point, first, second, length: Math.abs(point[0]-last[0])+Math.abs(point[1]-last[1])+1});
      }
      last = point;
      first = second;
    }
  }
  return { land, crossings };
}

const baseCrossings = new Map<number, ReturnType<typeof mapCrossings>>();
function crossingSurvey(state: GameState) {
  if (Object.keys(state.infrastructure?.cells ?? {}).length) return mapCrossings(state);
  const version = state.terrainVersion ?? 1;
  let survey = baseCrossings.get(version);
  if (!survey) {
    survey = mapCrossings(state);
    baseCrossings.set(version, survey);
  }
  return survey;
}

/** Search dry, open streets outward from all existing roads. */
function approachNetwork(site: Survey, land: Int32Array) {
  const parent = new Int32Array(land.length).fill(-2);
  const steps = new Uint16Array(land.length);
  const queue: number[] = [];
  for (const road of site.roads) {
    const idx = cellIndex(road.gx, road.gz);
    if (!land[idx] || parent[idx] !== -2) continue;
    parent[idx] = -1;
    queue.push(idx);
  }
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    const [x,z] = cellFromIndex(from);
    for (const [dx,dz] of neighbors) {
      const nx = x+dx, nz = z+dz;
      if (!withinMap(nx,nz) || site.occupancy.has(key(nx,nz))) continue;
      const next = cellIndex(nx,nz);
      if (!land[next] || parent[next] !== -2) continue;
      parent[next] = from;
      steps[next] = steps[from] + 1;
      queue.push(next);
    }
  }
  return {parent,steps};
}

function approachPath(end:Point, parent:Int32Array) {
  const points:Point[]=[];
  let tile=cellIndex(...end);
  while(parent[tile]>=0) {
    points.push(cellFromIndex(tile));
    tile=parent[tile];
  }
  return points.reverse();
}

function openDistrict(state:GameState, site:Survey, profile:AutoCivProfile, turn:number) {
  const {land}=crossingSurvey(state);
  const {parent,steps}=approachNetwork(site,land);
  const ranked: {point:Point; score:number}[]=[];
  for(let z=GRID_MIN+6;z<GRID_MAX;z+=12) for(let x=GRID_MIN+6;x<GRID_MAX;x+=12) {
    if((site.districts.get(site.districtKey(x,z))??0)>=4) continue;
    const snapX=x-(x-profile.originX)%profile.blockW;
    const snapZ=z-(z-profile.originZ)%profile.blockH;
    const point:Point=[snapX,snapZ];
    const i=cellIndex(...point);
    if(steps[i]<5 || !neighbors.every(([dx,dz])=>dry(state,snapX+dx,snapZ+dz))) continue;
    const score=steps[i]+noise(profile.seed+turn,x,z)*12;
    ranked.push({point,score});
  }
  ranked.sort((a,b)=>a.score-b.score);
  const target=ranked[0];
  if(!target) return idle("Surveying open neighborhoods");
  return buildRoad(state,site,approachPath(target.point,parent).slice(0,10),profile,turn);
}

function connectIsland(state: GameState, site: Survey, profile: AutoCivProfile, turn: number): AutoStepOutcome {
  const arch = {kind: "bridge", shape: "arch", height: 2} as const;
  const suspension = {kind: "bridge", shape: "suspension", height: 2} as const;
  if (state.highestStageReached < requiredToolStage(arch)) return idle("Bridge engineering is still locked");

  const {land, crossings} = crossingSurvey(state);
  const served = new Set(site.roads.map(r => land[cellIndex(r.gx, r.gz)]).filter(Boolean));
  const candidates = crossings.flatMap(({a,b,first,second,length}) => {
    if (served.has(first) === served.has(second)) return [];
    if (length > 24 && state.highestStageReached < requiredToolStage(suspension)) return [];
    let start = a, end = b;
    if (served.has(second)) [start,end] = [b,a];
    const dx = Math.sign(end[0]-start[0]), dz = Math.sign(end[1]-start[1]);
    for (let i = 0; i < length; i++) {
      const x = start[0]+dx*i, z = start[1]+dz*i;
      const el = site.occupancy.get(key(x,z));
      if (state.infrastructure?.spans[key(x,z)] || el && !vehicleRoad(el)) return [];
    }
    return [{start,end,length}];
  });
  if (!candidates.length) return idle("Surveying the next island crossing");

  const {parent,steps} = approachNetwork(site,land);
  const ranked = candidates.filter(c => parent[cellIndex(...c.start)] !== -2)
    .map(c => ({...c, score: steps[cellIndex(...c.start)] + c.length*1.8 + noise(profile.seed,...c.start)*3}))
    .sort((a,b) => a.score-b.score);
  for (const {start,end,length} of ranked.slice(0, 8)) {
    const approach = approachPath(start,parent);
    if (approach.length) return buildRoad(state, site, approach.slice(0, 14), profile, turn);
    const tool = length > 24 ? suspension : arch;
    const input = [start,end].map(([gx,gz])=>({gx,gz}));
    const built = applyInfrastructureStroke(state, tool, input);
    if (!built.valid) continue;
    recomputeConnectivityAndMetrics(state);
    const bridge = state.elements.find(e => e.gx === end[0] && e.gz === end[1]);
    if (bridge) return action(`Opened a bridge to another island · ${length} tiles`, bridge);
  }
  return idle("Awaiting funds or a clear bridge approach");
}

type Need = { label: string; weight: number; output: (d: CivElementDef) => number };
const housing: Need = {label: "New homes", weight: 1, output: d => d.popBase ?? 0};
const displayCategories = new Set(["nature_terrain","landmarks","faith","maritime","wealth_projects","roads_transit","civic_parks","police_military"]);
const deficit = (supply: number, demand: number) => demand > 0 ? Math.max(0, 1 - supply/demand) : 0;

function dependableWater(d:CivElementDef) {
  if(d.category==="nature_terrain" || d.isWaterFeature) return 0;
  if(["municipal_reservoir","water_towers","water_pumping_station","aqueduct","water_places"].includes(d.id)) return 0;
  return (d.water??0)*(d.id==="water_treatment_plant" ? .5 : 1);
}

function needs(state: GameState, site: Survey, turn: number): Need[] {
  const m = state.metrics;
  const missing = (test: (d: CivElementDef) => boolean) =>
    !state.elements.some(e => { const d = ELEMENT_BY_ID[e.defId]; return !!d && test(d); });
  const urgency = Math.max(deficit(m.powerSupplySteady,m.powerDemand), deficit(m.waterSupply,m.waterDemand),
    deficit(m.wasteCapacity,m.wasteDemand), deficit(m.jobsAvailable,m.jobsNeeded));
  const rows: Need[] = [
    {...housing, weight: !m.housingBase ? 35 : turn%7===2 ? 11 : urgency < .32 ? 4.2 : 1.4},
    {label:"Power grid", weight: 13*deficit(m.powerSupplySteady, m.powerDemand*1.15) + (missing(d=>(d.power??0)>0) ? 6 : 0), output:d=>d.power??0},
    {label:"Drinking water", weight: 14*deficit(m.waterSupply, m.waterDemand*1.15) + (missing(d=>(d.water??0)>0) ? 6 : 0), output:dependableWater},
    {label:"Waste collection", weight: 13*deficit(m.wasteCapacity, m.wasteDemand*1.12) + (m.housingBase > 0 && missing(d=>(d.waste??0)>0) ? 4 : 0), output:d=>d.waste??0},
    {label:"Local food supply", weight: 8*deficit(m.foodSupply, m.foodDemand*1.16) + (m.housingBase > 0 && missing(d=>(d.food??0)>0) ? 5 : 0), output:d=>d.food??0},
    {label:"Local jobs", weight: 13*deficit(m.jobsAvailable,m.jobsNeeded*1.12), output:d=>d.jobs??0},
    {label:"Schools", weight: 4*deficit(m.educationSupply,m.educationDemand), output:d=>d.education??0},
    {label:"Parks and culture", weight: 4*deficit(m.recreationSupply,m.recreationDemand), output:d=>d.recreation??0},
    {label:"Public services", weight: 5*deficit(m.govSupply,m.govDemand) + (state.highestStageReached >= 3 && missing(d=>AUTHORITY_BUILDINGS.has(d.id)) ? 8 : 0), output:d=>AUTHORITY_BUILDINGS.has(d.id) ? d.government??1 : 0},
    {label:"Fire and rescue", weight: state.elements.some(e => (ELEMENT_BY_ID[e.defId]?.fireRadius??0)>0) ? Math.min(5,m.burningCount*2) : state.highestStageReached >= 4 ? 5 : 0, output:d=>d.fireRadius??0},
    {label:"Public safety", weight: Math.min(6, m.crimeDaily/4), output:d=>d.policeRadius??0},
    {label:"Civil defense", weight: state.highestStageReached >= 10 ? Math.min(5, 5*deficit(m.defenseRating,90)) : 0, output:d=>d.military??0},
  ];
  if (state.highestStageReached >= 11 && turn%9===7) rows.push({
    label:"Public transport", weight:9,
    output:d=>d.id==="bus_depots" && !site.counts.has(d.id) ? 15 :
      d.id==="bus_stops" && (site.counts.get(d.id)??0)<Math.max(4,site.districts.size/3) ? 12 : 0,
  });
  if (site.roads.length >= 12) rows.push({
    label:"District feature", weight: turn % 7 === 5 ? 12 : 1.4,
    output: d => (site.counts.get(d.id) ?? 0) === 0 && !VEHICLE_ROADS.has(d.id) ? (displayCategories.has(d.category) ? 14 : 7) : 0,
  });
  return rows.filter(r=>r.weight>0).sort((a,b)=>b.weight-a.weight);
}


function proposals(state: GameState, site: Survey, rows: Need[], profile: AutoCivProfile, turn: number) {
  const defs = ELEMENTS.filter(d => !buildingLockReason(d,state) && (!buildingCharges(state) || d.cost <= state.money));
  const seen = new Set<string>();
  const result: {label:string; def:CivElementDef}[] = [];
  // Keep alternates for each need. A big reservoir with no waterfront must not suppress wells,
  // homes, or the next service. Repeated buildings have to compete with the unlocked catalog.
  for (const need of rows) {
    const candidates = defs.flatMap((def,i) => {
      const output = need.output(def);
      if (!(output > 0) || seen.has(def.id)) return [];
      const count = site.counts.get(def.id) ?? 0;
      const [w,h] = getStandardFootprintForLevel(def,1);
      const repeated = need.label==="District feature" ? 2.3 : need.label===housing.label ? 1.8 : .95;
      const outputValue = need.label==="Power grid" && ["solar_panels","solar_farms"].includes(def.id) ? output*.58 : output;
      const score = 2.9*Math.log2(1+outputValue) - .7*Math.log2(w*h) -
        repeated*Math.log2(1+count) - .35*Math.log2(1+(site.categories.get(def.category)??0)) +
        (count === 0 ? 2 : 0) + noise(profile.seed+turn,i,9)*2.6;
      return [{def,score}];
    }).sort((a,b)=>b.score-a.score);
    for (const {def} of candidates.slice(0, 4)) {
      seen.add(def.id);
      result.push({label:need.label,def});
    }
  }
  return result;
}

type Lot = {x:number; z:number; rotation:number; score:number};
function findLot(
  state: GameState, site: Survey, def: CivElementDef, profile: AutoCivProfile, turn: number, zone?: Zone, near?: Point,
) {
  const [w,h] = getStandardFootprintForLevel(def,1);
  const candidates: Lot[] = [];
  const seen = new Set<string>();
  const waterfront = def.domain === "coast_or_water" || def.domain === "water";
  const score = (x:number,z:number) => {
    const dist = site.distance(x,z);
    const district = noise(profile.seed, Math.floor((x-profile.originX)/profile.blockW), Math.floor((z-profile.originZ)/profile.blockH));
    const target = def.popBase ? .28 : (def.nuisanceRadius??0)>0 ? .84 : def.category==="commerce" ? .52 : .62;
    const directional = zone && zone in directions ? directions[zone as Direction] : null;
    const openingDistrict = state.highestStageReached>=5 && turn%4>=2 && dist>10;
    const built = site.districts.get(site.districtKey(x,z)) ?? 0;
    const nearby = near ? Math.hypot(x-near[0],z-near[1]) : 0;
    return dist*(openingDistrict ? -.29 : .18) + (openingDistrict ? built*.7 : 0) + nearby*.55 +
      Math.abs(district-target)*10 + noise(profile.seed+turn,x,z)*7 -
      (directional ? (directional[0]*x+directional[1]*z)*1.5 : 0) + (zone==="center" ? dist*.7 : 0);
  };
  const consider = (x:number,z:number,width:number,height:number,rotation:number) => {
    const id = key(x,z)+":"+rotation;
    if (seen.has(id) || !withinMap(x,z) || !withinMap(x+width-1,z+height-1)) return;
    seen.add(id);
    let wet = false, avoidsRoads = true;
    for (let dx=0; dx<width; dx++) for (let dz=0; dz<height; dz++) {
      const nx=x+dx,nz=z+dz;
      if (site.occupancy.has(key(nx,nz))) return;
      const isDry = dry(state,nx,nz);
      if (def.domain==="land" && !isDry || def.domain==="water" && isDry) return;
      wet ||= !isDry;
      if (isDry && site.roadLine(nx,nz)) avoidsRoads=false;
    }
    if (!avoidsRoads && w*h < 16) return;
    if (def.id==="desalination_plant") {
      let oceanIntake = false;
      for(let dx=-1;dx<=width;dx++) for(let dz=-1;dz<=height;dz++) {
        const water = getTerrainCell(state,x+dx,z+dz);
        if(water.depth>.1 && water.water==="salt") oceanIntake = true;
      }
      if(!oceanIntake) return;
    }
    if ((waterfront || zone==="coast") && !wet && !neighbors.some(([dx,dz])=>!dry(state,x+dx*width,z+dz*height))) return;
    candidates.push({x,z,rotation,score:score(x,z) + (avoidsRoads ? 0 : 14)});
  };
  for (const {gx,gz} of site.roads) {
    for (let rot = 0; rot < (w===h ? 1 : 2); rot++) {
      const [width,height]=rot ? [h,w] : [w,h];
      for (let i=0;i<width;i++) {
        consider(gx-i,gz+1,width,height,rot);
        consider(gx-i,gz-height,width,height,rot);
      }
      for (let i=0;i<height;i++) {
        consider(gx+1,gz-i,width,height,rot);
        consider(gx-width,gz-i,width,height,rot);
      }
    }
  }
  // Vessels need room alongside harbors instead of sitting on the roadway, while coast
  // facilities with services still require frontage like any other city building.
  if (def.domain==="water" && def.id!=="ocean_habitat_ring") {
    for (const el of state.elements) {
      if (ELEMENT_BY_ID[el.defId]?.category !== "maritime" || !el.connected) continue;
      for (const [dx,dz] of neighbors) for (let dist=1;dist<=5;dist++) {
        consider(el.gx+dx*(dist+w),el.gz+dz*(dist+h),w,h,0);
        if(w!==h) consider(el.gx+dx*(dist+h),el.gz+dz*(dist+w),h,w,1);
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  const candidatesByHealth = candidates.slice(0, 24).map(lot => {
    const nuisance = def.nuisanceRadius ?? 0;
    let conflicts = 0;
    if (def.popBase || nuisance) {
      const radius = Math.min(7,nuisance || 5);
      for (let dx=-radius;dx<=radius;dx++) for(let dz=-radius;dz<=radius;dz++){
        const el=site.occupancy.get(key(lot.x+dx,lot.z+dz));
        if (!el || el.gx!==lot.x+dx || el.gz!==lot.z+dz) continue;
        const other=ELEMENT_BY_ID[el.defId];
        if (nuisance && (other?.popBase??0)>0 || def.popBase && (other?.nuisanceRadius??0)>0) conflicts++;
      }
    }
    return {...lot, score:lot.score + conflicts*2.8};
  }).sort((a,b)=>a.score-b.score);
  for (const {x,z,rotation} of candidatesByHealth) {
    const plan = planConstruction(state,def,x,z,1,rotation,w!==h && !waterfront,undefined,site.occupancy);
    if (plan.valid && checkPlacementValid(state,plan.def,x,z,plan.spanX,plan.spanZ,undefined,site.occupancy).valid)
      return {plan,x,z};
  }
}

function placeLot(
  state:GameState, site:Survey, def:CivElementDef, profile:AutoCivProfile, turn:number, zone?:Zone, near?:Point,
) {
  const lot = findLot(state,site,def,profile,turn,zone,near);
  if (!lot) return;
  const {plan,x,z} = lot;
  const variant = noise(profile.seed,x,z) < .38 ? profile.preferredVariant : Math.floor(noise(profile.seed+turn,z,x)*4);
  return place(state,site,plan,x,z,variant);
}

function buildNeighborhood(
  state:GameState, site:Survey, profile:AutoCivProfile, turn:number, priorities:Need[],
) {
  const options = proposals(state,site,priorities,profile,turn);
  for(const {label,def} of options) {
    const first=placeLot(state,site,def,profile,turn);
    if(!first) continue;
    const progress=state.highestStageReached;
    const capacity=progress>=15 ? 4 : progress>=8 ? 3 : progress>=5 ? 2 : 1;
    const built=[first];
    const usedLabels=new Set([label]);
    for(const next of options) {
      if(built.length>=capacity) break;
      if(usedLabels.has(next.label)) continue;
      const supplied=placeLot(state,site,next.def,profile,turn+1,undefined,[first.gx,first.gz]);
      if(!supplied) continue;
      usedLabels.add(next.label);
      built.push(supplied);
    }
    recomputeConnectivityAndMetrics(state);
    if(built.length===1) return action(`${label} · ${ELEMENT_BY_ID[first.defId].name}`,first);
    return action(`${label} · ${built.map(el=>ELEMENT_BY_ID[el.defId].name).join(", ")}`,first);
  }
}

function upgrade(state: GameState, profile: AutoCivProfile, turn: number, priorities: Need[]) {
  const options = state.elements.flatMap((el,i)=>{
    const d=ELEMENT_BY_ID[el.defId];
    if (!d || d.isNetwork || d.passiveNature || !el.connected || el.level >= getMaxElementLevel(el.defId)) return [];
    let score = 0;
    for (const need of priorities) {
      const output=need.output(d);
      if(output<=0 || need.label==="Drinking water" && !freshWaterFactor(state,el)) continue;
      score=Math.max(score, need.weight + Math.log2(1+output));
    }
    return [{el,score:score*2 - el.level*1.7 + noise(profile.seed+turn,i,8)*9}];
  }).sort((a,b)=>b.score-a.score);
  for (const {el} of options.slice(0,32)) {
    if (upgradeElementDirect(state,el.id).ok) return action(`Upgraded ${ELEMENT_BY_ID[el.defId].name} to level ${el.level}`,el);
  }
  return idle("Existing buildings are still developing");
}

function startTransit(state: GameState) {
  for (const mode of ["bus", "ferry"] as const) {
    const stops = eligibleStops(state,mode);
    for (const depot of eligibleDepots(state,mode)) {
      if (state.mobility?.lines.some(run=>run.mode===mode && run.depot===depot.id)) continue;
      const closest = stops.filter(stop=>stop.id!==depot.id).map(stop=>({
        stop, distance: Math.hypot(stop.gx-depot.gx,stop.gz-depot.gz),
      })).sort((a,b)=>a.distance-b.distance).slice(0,8);
      const first = stops.find(stop=>stop.id===depot.id) ?? closest.shift()?.stop;
      if (!first) continue;
      for (const {stop} of closest) {
        try {
          addLine(state,mode,depot.id,[first.id,stop.id]);
          return action(mode==="bus" ? "Started neighborhood bus service" : "Started a passenger ferry",depot);
        } catch {
          // Try another pair when the transport network cannot yet reach this stop.
        }
      }
    }
  }
}

function capitalBudget(state: GameState) {
  // A predictable construction reserve keeps an unattended project moving. Operations,
  // unlocks, siting and upkeep still use the same simulation rules as the other modes.
  const reserve = 1500 + state.highestStageReached*750;
  if (state.money < reserve) transfer(state,"outside","treasury",reserve-state.money,"City development grant");
}

function getProfile(state:GameState, fallback:AutoCivProfile) {
  const seed=state.autoCiv?.seed;
  return typeof seed==="number" && Number.isSafeInteger(seed) && seed!==fallback.seed ? createAutoCivProfile(seed) : fallback;
}

function grow(state:GameState, profile:AutoCivProfile, turn:number):AutoStepOutcome {
  capitalBudget(state);
  const site=survey(state,profile);
  if (!site.roads.length) return extendRoad(state,site,profile,turn);
  const priorities = needs(state,site,turn);

  if (turn%19===0) {
    const line = startTransit(state);
    if (line) return line;
  }
  if (turn%7===0) {
    const crossing=connectIsland(state,site,profile,turn);
    if(crossing.didAct) return crossing;
  }
  if (turn%5===0 || site.roads.length < 12 && turn%3===1 && state.metrics.housingBase>0) {
    if (turn%15===0) {
      const district=openDistrict(state,site,profile,turn);
      if(district.didAct) return district;
    }
    const streets=extendRoad(state,site,profile,turn);
    if(streets.didAct) return streets;
  }
  if (turn%6===0 && state.metrics.housingBase>0) {
    const updated=upgrade(state,profile,turn,priorities);
    if(updated.didAct) return updated;
  }
  const projects=buildNeighborhood(state,site,profile,turn,priorities);
  if(projects) return projects;
  const streets=extendRoad(state,site,profile,turn);
  if(streets.didAct) return streets;
  return upgrade(state,profile,turn,priorities);
}

function nextTurn(state:GameState, fallback:AutoCivProfile, hint:number) {
  const profile=getProfile(state,fallback);
  const previous = state.autoCiv?.turn;
  const turn=(typeof previous === "number" && Number.isSafeInteger(previous) && previous >= 0 ? previous : Math.max(0,hint-1))+1;
  state.autoCiv={seed:profile.seed,turn};
  return {profile,turn};
}

export function runAutoCivStep(state:GameState, fallback:AutoCivProfile, stepIndex:number):AutoStepOutcome {
  if (state.gameOver) return idle("Island collapsed");
  const {profile,turn}=nextTurn(state,fallback,stepIndex);
  return grow(state,profile,turn);
}

export function generateManagerDecision(state:GameState, fallback:AutoCivProfile, turnIndex:number):ManagerDecision {
  const profile=getProfile(state,fallback);
  const turn=(state.autoCiv?.turn??turnIndex)+1;
  const site=survey(state,profile);
  const stage=STAGES[Math.max(0,Math.min(STAGES.length-1,state.currentStage-1))];
  const choices:ManagerChoice[]=[];
  const options=proposals(state,site,needs(state,site,turn),profile,turn);
  for(const {label,def} of options.slice(0,10)){
    if(!findLot(state,site,def,profile,turn)) continue;
    choices.push({id:def.id,label:`Build ${def.name}`,detail:label,action:{kind:"build",defId:def.id}});
    if(choices.length>=2) break;
  }
  choices.push(
    {id:"delegate",label:"Let city planners decide",detail:"Use the same growth plan as Idle Mode",action:{kind:"continue"}},
    {id:"streets",label:"Open another street",detail:"Connect the next block or island",action:{kind:"expand_roads",direction:turn%2===0?"east":"south"}},
  );
  return {
    id:`mgr-${turn}`, kicker:`Stage ${stage.stage} · ${stage.name}`,
    question:"What should the city build next?",
    context:`${state.population.toLocaleString()} residents · ${site.roads.length} road tiles`,
    choices,
  };
}

export function applyManagerChoice(state:GameState, fallback:AutoCivProfile, choice:ManagerChoice, turnIndex:number):AutoStepOutcome {
  if (state.gameOver) return idle("Island collapsed");
  if (choice.action.kind==="skip") return idle("Held decision");
  const {profile,turn}=nextTurn(state,fallback,turnIndex);
  capitalBudget(state);
  const site=survey(state,profile);
  if(choice.action.kind==="build"){
    const def=ELEMENT_BY_ID[choice.action.defId];
    const placed=def && placeLot(state,site,def,profile,turn,choice.action.zoneHint);
    if(placed) {
      recomputeConnectivityAndMetrics(state);
      return action(`Approved by Manager · ${def.name}`,placed);
    }
    return idle("That site is no longer available");
  }
  if(choice.action.kind==="expand_roads"){
    const crossing=connectIsland(state,site,profile,turn);
    if(crossing.didAct) return crossing;
    const extended=extendRoad(state,site,profile,turn,choice.action.direction);
    if(extended.didAct) return extended;
    return extendRoad(state,site,profile,turn);
  }
  if(choice.action.kind==="upgrade_best") return upgrade(state,profile,turn,needs(state,site,turn));
  return grow(state,profile,turn);
}
