import { railFreightBonus, railServedSites } from "./railOperations";
import {syncCatalogBridges} from "./catalogBridge";
import {chooseRoadAxis,corridorConflict} from "./roadCorridors";
import {roadWidth,type RoadAxis} from "./roadStandards";
import {railSpanAllows, crossingPieces, crossingUpgradePrice, bridgeTier} from "./bridgeWorks";
import { activeBlessing, advanceFaith, BLESSINGS, evacuate, faithServices, isSanctuary, repelInvasion, rehouseResidents, sanctuaryPopulation, type FaithRecord } from "./faith";
import { advancePatrol, findPatrolDispatch } from "./policeDispatch";
import { collectFarms,hasFarmRoad,setDistrictReport } from "./farmNetworks";
import { FARM_MODULE_IDS } from "./expansionCatalog";
import { GRID_MIN, GRID_MAX } from "./mapBounds";
export { GRID_MIN, GRID_MAX, GRID_HALF } from "./mapBounds";
import { hasNavigableHarbor, stepMobility, transitLayer, transitReadout, type MobilityState } from "./mobility";
import { advanceEconomy, buildingCharges, cityWealth, unlockWealth, taxRateOf, economyOf, effective, enforceAccountHolds, evaluateEconomy, hasAuthority, professionalStaff, transfer, upgradeReadiness, type Economy } from "./cityEconomy";
import { advanceOperations, type ProjectOps } from "./projectOperations";
import { vesselIds,waterHull } from "./travelNetwork";
import {
  CRIME_UNLOCK_MIN_POP,
  CRIME_UNLOCK_STAGE,
  type CivElementDef,
  ELEMENTS,
  ELEMENT_BY_ID,
  type GameMode,
  STAGES,
  getStandardFootprintForLevel,
  MAX_FOOTPRINT,
  getUpgradeCost,
  getMaxElementLevel,
} from "./catalog";
import { markInfrastructureChanged, advanceReservoirs, getTerrainCell, islandMargin, freshWaterFactor, hydroHead, roadPortOpen, hydraulics, buildWaterNavigation, type Infrastructure } from "./terrain";
import { streetDemand } from "./streetDemand";
import { generationExposure } from "./parcelExposure";
import { roadSiteAccess, autoFrontageRotation, cellBeyondEdge, parcelAccessSteps, getParcelEdges, getParcelEffectSummary, PARCEL_SIDES, type LocalSide, type EdgeOverride } from "./parcelEdges";
import { separatedDeckAxis, encodeRoadSitePort } from "./roadTopology";
import { TILE_SIZE } from "./voxelCore";
import { payEarnedGrants } from "./cityGrants";
import {
  ACHIEVEMENTS,
  analyzeLayout,
  fieldIndex,
  landValuePopMultiplier,
  powerKind,
  powerOutputFactor,
  sampleFieldAvg,
  synergyMultiplier,
  elementLevelStats,
  steadyPowerOutputFactor,
  AVERAGE_RUSH_FACTOR,
  rushHourFactor,
} from "./cityDynamics";
import { levelMultiplier, scaledRadius } from "./levelScaling";

/** Occupied road tiles in this city's last traffic report, including a freshly reloaded save. */
const trafficByReport = new WeakMap<CityMetrics, Map<string, number>>();
let lastTrafficLoad = new Map<string, number>();
export function getTrafficLoadMap(state?: GameState): Map<string, number> {
  if (!state) return lastTrafficLoad;
  let load = trafficByReport.get(state.metrics);
  if (!load) {
    load = streetDemand(state).load;
    trafficByReport.set(state.metrics, load);
  }
  return load;
}

function isCoastalTile(gx: number, gz: number, state?: GameState): boolean {
  if (getTileTerrainKind(gx, gz, state) !== "land") return true;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
    if (getTileTerrainKind(gx + dx, gz + dz,state) !== "land") return true;
  }
  return false;
}

export const MAINTENANCE_INTERVAL_SEC = 300; // 5 minutes of active in-app play

export type TerrainCellKind = "land" | "coast" | "water";

export interface PlacedElement {
  id: string;
  defId: string;
  gx: number; // anchor minimum grid X
  gz: number; // anchor minimum grid Z
  spanX: number;
  spanZ: number;
  rotation: number; // 0, 1, 2, 3 (90 deg steps)
  level: number; // 1..5
  variant: number; // 0..3
  edgeOverrides?: Partial<Record<LocalSide, EdgeOverride>>;
  awaitingStreet?: boolean;
  autoDrive?: {side:LocalSide;slot:number};
  exteriorLighting?: "auto" | "dark" | "lit";
  connected: boolean;
  hasPoliceCover: boolean;
  hasFireCover: boolean;
  nuisancePenalty: number;
  /** Active play seconds since last maintained (Survival Mode) */
  maintTimerSec: number;
  /** Real/God mode: seconds a fire-damaged building has been recovering (clears at 60) */
  repairTimerSec?: number;
  /** Survival: the first maintenance deadline has been staggered for this building */
  maintStaggered?: boolean;
  disrepair: boolean;
  onFire: boolean;
  /** Active neighbour synergies (ids from SYNERGY_RULES) */
  synergies?: string[];
  /** Land value 0..2 sampled under this element */
  landValue?: number;
  /** Pollution sampled under this element */
  pollution?: number;
  /** Network piece that replaced a placed river/canal/lake tile (bridge over water) */
  overWater?: boolean;
  /** Waterway temporarily covered by a bridge. Restored when the deck is moved or removed. */
  waterUnderlay?: PlacedElement;
  sculptsTerrain?: boolean;
  roadAxis?: RoadAxis;
  crossingAxis?: "x" | "z";
  pedestrianDeck?: boolean;
  lockCycleAt?: number;
  /** 1 -> 0 animation progress for newly placed / merged / upgraded buildings */
  animProgress: number;
  animKind: "place" | "upgrade" | "merge";
}

export interface AdvisorDiagnostic {
  id: string;
  severity: "critical" | "warning" | "good" | "info";
  title: string;
  detail: string;
  fixHint: string;
  deltaHappiness?: number;
}

export type WeatherKind = "clear" | "cloudy" | "rain" | "storm";

export type HeatmapKind =
  | "transit"
  | "neighbors"
  | "none"
  | "water"
  | "power"
  | "jobs"
  | "waste"
  | "food"
  | "education"
  | "parks"
  | "police"
  | "fire"
  | "defense"
  | "flow" | "clearance" | "lanes"
  | "landvalue"
  | "pollution"
  | "traffic";

export type SelectionFilter = "all" | "roads" | "buildings" | "water" | "power" | "waste";

export function matchesSelectionFilter(def: CivElementDef, filter: SelectionFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "roads":
      return Boolean(def.isRoadNetwork || def.isRailNetwork || def.category === "roads_transit");
    case "buildings":
      return !def.isNetwork && !def.passiveNature;
    case "water":
      return Boolean(def.isWaterFeature || def.category === "water_util" || (def.water ?? 0) > 0);
    case "power":
      return Boolean((def.category === "power_waste" && !def.waste && def.id !== "factories") || (def.power ?? 0) > 0);
    case "waste":
      return Boolean(
        (def.waste ?? 0) > 0 ||
          def.id === "landfill" ||
          def.id === "trash_compacting_plants" ||
          def.id === "trash_burning_plants",
      );
  }
}

export interface CrimeIncident {
  id: string;
  targetElementId: string;
  targetGx: number;
  targetGz: number;
  policeOriginId: string | null;
  policeGx: number | null;
  policeGz: number | null;
  progressSec: number;
  maxSec: number;
  policeArrived: boolean;
  policeRoute?: [number,number][];
  policeTravel?: number;
  policeSpeed?: number;
  policeDeparted?: boolean;
  policeHeading?: 0 | 1;
}

export interface AttackUnit {
  id: string;
  kind: "ship" | "tank" | "soldier";
  x: number; // world X
  z: number; // world Z
  targetElementId: string | null;
  hp: number;
  maxHp: number;
  fireCooldown: number;
}

export type DefenseUnitKind =
  | "soldier"
  | "tank"
  | "boat"
  | "cop"
  | "cop_car"
  | "swat"
  | "swat_car";

export interface DefenseUnit {
  id: string;
  kind: DefenseUnitKind;
  x: number;
  z: number;
  originElementId: string;
  targetUnitId: string | null;
  hp: number;
  maxHp: number;
  damage: number;
  fireCooldown: number;
  speed: number;
}

export interface ActiveAttackState {
  id: string;
  startedAt: number;
  elapsedSec?: number;
  initialExposed?: number;
  severity: number; // 1..5
  units: AttackUnit[];
  defenders: DefenseUnit[];
  totalUnitsSpawned: number;
  unitsDefeated: number;
  buildingsDestroyed: number;
  casualties: number;
  defensePower: number;
  defenseCooldown: number;
}

export interface CityMetrics {
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
  wasteCapacity: number;
  wasteDemand: number;
  jobsAvailable: number;
  jobsNeeded: number;
  foodSupply: number;
  foodDemand: number;
  educationSupply: number;
  educationDemand: number;
  recreationSupply: number;
  recreationDemand: number;
  govSupply: number;
  govDemand: number;
  crimeRate: number; // 0..100 (active Stage 5+ when Police unlock, or when toggled ON in God Mode)
  crimeUnlocked: boolean;
  isNightCrimeSurge: boolean;
  defenseRating: number; // 0..100 (active Stage 10+ or God Mode)
  defenseUnlocked: boolean;
  soldiersCount: number;
  tanksCount: number;
  navalBoatsCount: number;
  copsCount: number;
  swatCount: number;
  totalDefenders: number;
  defensePower: number;
  requiredDefensePower: number;
  stageAttackSeverity: number;
  connectedHouses: number;
  disconnectedBuildings: number;
  nuisanceAffectedHomes: number;
  disrepairCount: number;
  burningCount: number;
  netIncomePerTick: number;
  grossIncomePerTick: number;
  upkeepPerTick: number;
  pollutionAvg: number;
  landValueAvg: number;
  trafficTrips: number;
  trafficCapacity: number;
  /** 0..200+ % of road capacity used (after transit relief, at the current hour) */
  congestion: number;
  transitTrips: number;
  transitShare: number;
  renewablePct: number;
  solarFactor: number;
  windFactor: number;
  synergyCount: number;
  /** Population the city's services can hold right now, and the need that sets that limit. */
  populationLimiter: PopulationLimiter;
  /** Residents housed directly by connected homes (land value, synergy and walking included) */
  housingBase: number;
  /** Highest stage reached (mirrors state.highestStageReached for grants and readouts) */
  stageReached: number;
  /** Power supply at day-average sun and wind; drives happiness and growth so night dips don't swing the city */
  powerSupplySteady: number;
  /** Congestion averaged over the day's rush-hour curve (drives happiness) */
  congestionDaily: number;
  /** Crime averaged over day and night (drives happiness) */
  crimeDaily: number;
  /** Water plants running on 50% groundwater because no river reaches them */
  groundwaterPlants: number;
  /** Buildings recovering from fire damage (real mode repairs them automatically) */
  recoveringBuildings: number;
}

export type LimitingNeed = "housing" | "jobs" | "food" | "waste" | "water" | "power";
export interface PopulationLimiter {
  cap: number;
  limitingNeed: LimitingNeed;
}

export interface HistorySample {
  wealth?:number;
  t: number;
  pop: number;
  money: number;
  happy: number;
}

export interface GameEventToast {
  id: string;
  kind: "stage" | "merge" | "alert" | "raid";
  title: string;
  subtitle: string;
  createdAt: number;
}

export interface GameState {
  railYard?: import("./railOperations").RailState;
  faith?: FaithRecord;
  exampleWorldId?: import("./exampleWorlds").ExampleWorldId;
  exampleReturnMode?: GameMode;
  exampleViewpoint?: number;
  cameraView?: import("./worldRenderer").IslandCameraView;
  /** Absent on original island saves. */
  terrainVersion?: 1|2;
  playSpeed?: number;
  constructionHistory?: import("./constructionHistory").BuildingEdit[];
  economy?: Economy;
  projectOps?: ProjectOps;
  infrastructure?: Infrastructure;
  mobility?: MobilityState;
  mode: GameMode;
  money: number;
  population: number;
  /** Thriving town settlement bonus accumulated smoothly over time when needs are met */
  growthPool: number;
  happiness: number; // 0..100
  currentStage: number; // 1..20
  highestStageReached: number; // 1..20
  gameOver: boolean;
  gameOverReason: string;
  activePlaySec: number;
  /** 24-hour clock (0..24) driving day/night cycle */
  timeOfDay: number;
  timeLocked: boolean;
  weather: WeatherKind;
  weatherLocked: boolean;
  weatherIntensity: number;
  windSpeed: number;
  weatherTimerSec: number;
  raidCooldownSec: number;
  crimeCooldownSec: number;
  /** Whether crime & burglar/police response animations are toggled ON in God Mode */
  godCrimeEnabled: boolean;
  elements: PlacedElement[];
  crimeIncidents: CrimeIncident[];
  activeAttack: ActiveAttackState | null;
  metrics: CityMetrics;
  diagnostics: AdvisorDiagnostic[];
  toasts: GameEventToast[];
  /** Rolling stat history for sparklines */
  history?: HistorySample[];
  historyTimerSec?: number;
  /** Unlocked achievement ids */
  achievements?: string[];
  /** Public works payments already credited to this city's treasury. */
  awardedGrants?: string[];
  /** Player tax rate in percent (5–25, default 12). Above 15 costs happiness, below 15 adds some. */
  taxRate?: number;
  /** Survival: pay 1.25× the maintenance price automatically when a building falls due. */
  autoMaintain?: boolean;
}

/** True when a site's footprint or its ring of neighbouring cells holds fresh surface water. */
function touchesFreshWater(state: GameState, el: PlacedElement): boolean {
  for (let x = el.gx - 1; x <= el.gx + el.spanX; x++)
    for (let z = el.gz - 1; z <= el.gz + el.spanZ; z++) {
      const c = getTerrainCell(state, x, z);
      if (c.depth > 0.1 && c.water === "fresh") return true;
    }
  return false;
}

/** Per-capita service demand shrinks with city size (economies of scale): 1.0 at Stage 1 … 0.5 floor. */
export function perCapitaDemandScale(stage: number): number {
  return Math.max(0.5, 1 - 0.03 * (Math.max(1, stage) - 1));
}

/** Happiness change from the tax rate: +0.4 per point under 15%, −0.6 per point over it. */
export function taxHappiness(rate: number): number {
  return rate <= 15 ? (15 - rate) * 0.4 : -(rate - 15) * 0.6;
}

/**
 * The population the city's services can hold, and which need sets it. Each cap converts a supply into
 * residents with the same per-resident rate the demand side charges, so the limiter is exact: at the cap
 * the limiting need sits at 100%.
 */
export function populationLimiterFor(state: GameState, m: CityMetrics, housingBase: number, perCapita: number): PopulationLimiter {
  const economy = economyOf(state).report;
  const foodPerResident = (state.mode === "survival" ? 0.32 : 0.28) * perCapita;
  const caps: [LimitingNeed, number][] = [
    ["housing", Math.max(housingBase, economy.capacity || housingBase)],
    // Half of all residents work (cityEconomy workforce), so this is the population the reachable jobs employ.
    ["jobs", economy.reachable / 0.5],
    // Food reaches homes through their own district's shops and farm gates (cityEconomy.foodResidents).
    ["food", Math.min(m.foodSupply / foodPerResident,
      economy.foodResidents ?? Infinity)],
    ["waste", m.wasteCapacity / (WASTE_PER_UNIT / 5 * perCapita)],
    ["water", state.population + (m.waterSupply - m.waterDemand) * RESIDENTS_PER_WATER / perCapita],
    ["power", state.population + (m.powerSupplySteady - m.powerDemand) * RESIDENTS_PER_POWER / perCapita],
  ];
  let [limitingNeed, cap] = caps[0];
  for (const [need, value] of caps) if (value < cap) [limitingNeed, cap] = [need, value];
  if (cap < housingBase) { cap = housingBase; }
  return { cap: Math.max(0, Math.round(cap)), limitingNeed };
}

const LIMITER_LABELS: Record<LimitingNeed, { name: string; fix: string }> = {
  housing: { name: "Housing", fix: "Build or upgrade homes; every home also attracts settlers around it." },
  jobs: { name: "Jobs", fix: "Add businesses, shops, farms or factories reachable from the homes." },
  food: { name: "Food", fix: "Connect food producers (farms, orchards, gardens) to homes; grocers add extra variety." },
  waste: { name: "Garbage", fix: "Add or upgrade landfills, compactors or trash plants." },
  water: { name: "Water", fix: "Add or upgrade water plants, towers or wells." },
  power: { name: "Power", fix: "Add steady generation; solar alone averages about half its daytime output." },
};

/** Garbage demand per citizen unit (5 residents): 0.16 per resident. */
const WASTE_PER_UNIT = 0.8;
/** Extra residents one surplus unit of water / power supports (and the matching per-resident draw). */
const RESIDENTS_PER_WATER = 30;
const RESIDENTS_PER_POWER = 35;

export function isNightTime(timeOfDay: number): boolean {
  return timeOfDay >= 19.5 || timeOfDay < 5.5;
}

export function formatTimeOfDay(timeOfDay: number): string {
  const h24 = ((Math.floor(timeOfDay) % 24) + 24) % 24;
  const mins = Math.floor((timeOfDay - Math.floor(timeOfDay)) * 60);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Island superellipse shape function shared with the 3D terrain renderer.
 * Returns > 0 on the flat grass plateau, ~0 along the beach coast, < 0 in the ocean.
 */
export function islandMarginAtWorld(x: number, z: number, terrainVersion=1): number {
  return islandMargin(x,z,terrainVersion);
}

export function gridToWorldCenter(gx: number, gz: number, spanX = 1, spanZ = 1): [number, number] {
  return [(gx + spanX * 0.5) * TILE_SIZE, (gz + spanZ * 0.5) * TILE_SIZE];
}

export function worldToGrid(wx: number, wz: number): [number, number] {
  return [Math.floor(wx / TILE_SIZE), Math.floor(wz / TILE_SIZE)];
}

export function getTileTerrainKind(gx: number, gz: number, state?: GameState): TerrainCellKind {
  return getTerrainCell(state,gx,gz).kind;
}

export function isDomainCompatible(domain: CivElementDef["domain"], cellKind: TerrainCellKind): boolean {
  switch (domain) {
    case "any":
      return true;
    case "land":
      return cellKind === "land" || cellKind === "coast";
    case "coast_or_water":
      return cellKind === "coast" || cellKind === "water";
    case "water":
      return cellKind === "water" || cellKind === "coast";
  }
}

export function randomVariant(): number {
  return Math.floor(Math.random() * 4);
}

let idCounter = 1;
export function makeElementId(): string {
  idCounter += 1;
  return `el_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function createEmptyMetrics(): CityMetrics {
  return {
    powerSupply: 0,
    powerDemand: 0,
    waterSupply: 0,
    waterDemand: 0,
    wasteCapacity: 0,
    wasteDemand: 0,
    jobsAvailable: 0,
    jobsNeeded: 0,
    foodSupply: 0,
    foodDemand: 0,
    educationSupply: 0,
    educationDemand: 0,
    recreationSupply: 0,
    recreationDemand: 0,
    govSupply: 0,
    govDemand: 0,
    crimeRate: 0,
    crimeUnlocked: false,
    isNightCrimeSurge: false,
    defenseRating: 0,
    defenseUnlocked: false,
    soldiersCount: 0,
    tanksCount: 0,
    navalBoatsCount: 0,
    copsCount: 0,
    swatCount: 0,
    totalDefenders: 0,
    defensePower: 0,
    requiredDefensePower: 180,
    stageAttackSeverity: 1,
    connectedHouses: 0,
    disconnectedBuildings: 0,
    nuisanceAffectedHomes: 0,
    disrepairCount: 0,
    burningCount: 0,
    netIncomePerTick: 0,
    grossIncomePerTick: 0,
    upkeepPerTick: 0,
    pollutionAvg: 0,
    landValueAvg: 0.5,
    trafficTrips: 0,
    trafficCapacity: 0,
    congestion: 0,
    transitTrips: 0,
    transitShare: 0,
    renewablePct: 0,
    solarFactor: 1,
    windFactor: 1,
    synergyCount: 0,
    populationLimiter: { cap: 0, limitingNeed: "housing" },
    housingBase: 0,
    stageReached: 1,
    powerSupplySteady: 0,
    congestionDaily: 0,
    crimeDaily: 0,
    groundwaterPlants: 0,
    recoveringBuildings: 0,
  };
}

export function createInitialGameState(mode: GameMode): GameState {
  const state: GameState = {
    mode,
    terrainVersion:2,
    money: mode === "survival" ? 2_200 : 2_800,
    population: 0,
    growthPool: 0,
    happiness: 100,
    currentStage: 1,
    highestStageReached: 1,
    gameOver: false,
    gameOverReason: "",
    activePlaySec: 0,
    timeOfDay: 10.5,
    timeLocked: false,
    weather: "clear",
    weatherLocked: false,
    weatherIntensity: 1.0,
    windSpeed: 1.0,
    weatherTimerSec: 55,
    raidCooldownSec: 75,
    crimeCooldownSec: 12,
    godCrimeEnabled: false,
    elements: [],
    crimeIncidents: [],
    activeAttack: null,
    metrics: createEmptyMetrics(),
    diagnostics: [],
    toasts: [],
  };
  recomputeConnectivityAndMetrics(state);
  return state;
}

export function buildingLockReason(def: CivElementDef, state: GameState): string | undefined {
  if (state.mode === "god" && !effective(state, "stageRules", 0)) return;
  if (def.wealthThreshold) {
    const threshold = Math.ceil(def.wealthThreshold * effective(state, "wealthScale", 100) / 100);
    if (Math.max(economyOf(state).peak, unlockWealth(state)) < threshold) return "Reach $" + threshold.toLocaleString() + " in treasury and business capital";
  } else if (state.highestStageReached === 1 ? !def.isStarter : def.stage > state.highestStageReached) {
    return "Unlocks at Stage " + def.stage;
  }
  if ((def.category === "police_military" || def.id === "fire_department") && !hasAuthority(state)) {
    return "Staff a City Office, Government Building, Courthouse or Tax Collecting Office first";
  }
}

export function isElementUnlocked(def: CivElementDef, state: GameState): boolean {
  return buildingLockReason(def, state) === undefined;
}

export function buildOccupancyMap(elements: PlacedElement[], ignoreIds?: Set<string>): Map<string, PlacedElement> {
  const map = new Map<string, PlacedElement>();
  for (const el of elements) {
    if (ignoreIds?.has(el.id)) continue;
    for (let dx = 0; dx < el.spanX; dx++) {
      for (let dz = 0; dz < el.spanZ; dz++) {
        map.set(`${el.gx + dx},${el.gz + dz}`, el);
      }
    }
  }
  return map;
}

export function checkPlacementValid(
  state: GameState,
  def: CivElementDef,
  gx: number,
  gz: number,
  spanX: number,
  spanZ: number,
  ignoreIds?: Set<string>,
): { valid: boolean; reason?: string } {
  if (gx < GRID_MIN || gz < GRID_MIN || gx + spanX - 1 > GRID_MAX || gz + spanZ - 1 > GRID_MAX) {
    return { valid: false, reason: "Outside island bounds" };
  }
  const lock = buildingLockReason(def, state);
  if (lock && !ignoreIds?.size) return { valid: false, reason: lock };
  const occ = buildOccupancyMap(state.elements, ignoreIds);
  const shoulder = corridorConflict(gx,gz,spanX,spanZ,def.id,undefined,occ,()=>true);
  if(shoulder)return {valid:false,reason:shoulder};
  let waterAccess = false;
  for (let dx = 0; dx < spanX; dx++) {
    for (let dz = 0; dz < spanZ; dz++) {
      const tx = gx + dx;
      const tz = gz + dz;
      const existing=occ.get(`${tx},${tz}`);
      const terrainLayer=existing?.sculptsTerrain && (!ELEMENT_BY_ID[existing.defId]?.isWaterFeature || def.domain==="water" || def.domain==="coast_or_water");
      if (existing && !terrainLayer) {
        return { valid: false, reason: "Space already occupied" };
      }
      const cellKind = getTileTerrainKind(tx, tz, state);
      // Placed water tiles allow boats/bridges on them, handled via empty check above
      if (def.domain === "coast_or_water") {
        if (cellKind !== "land" || [[1,0],[-1,0],[0,1],[0,-1]].some(([x,z]) => getTerrainCell(state,tx+x,tz+z).depth > .1)) waterAccess = true;
        continue;
      }
      if (def.archetype === "hydro_plant") continue;
      if (!isDomainCompatible(def.domain, cellKind)) {
        if (def.domain === "land") {
          return { valid: false, reason: "Must be placed on island land" };
        }
        return { valid: false, reason: "Must be placed on coast or water" };
      }
    }
  }
  if(def.domain==="coast_or_water"&&!waterAccess)return {valid:false,reason:"Place the water-facing edge beside a channel or coast."};
  if(def.archetype==="hydro_plant" && !hydroHead(state,{gx,gz,spanX,spanZ}))return {valid:false,reason:"Span a flowing river with two banks and a fall or dam gate."};
  return { valid: true };
}

/** Vertical class of a network piece: elevated decks ramp down to ground roads, sunken ones ramp up. */
export function networkDeckClass(def: CivElementDef): "elevated" | "sunken" | "ground" {
  if (def.archetype === "bridge_span" || def.archetype === "bridge_suspension" || def.archetype === "road_overpass") {
    return "elevated";
  }
  if (def.archetype === "road_underpass") return "sunken";
  return "ground";
}

/** True when a tile is open water (ocean/coast terrain) or holds a placed water feature. */
export function isWaterTile(elements: PlacedElement[] | Map<string, PlacedElement>, gx: number, gz: number, state?: GameState): boolean {
  if (getTileTerrainKind(gx, gz, state) !== "land") return true;
  const occ = elements instanceof Map ? elements : buildOccupancyMap(elements);
  const here = occ.get(`${gx},${gz}`);
  if (!here) return false;
  if (here.overWater) return true;
  const d = ELEMENT_BY_ID[here.defId];
  return Boolean(d?.isWaterFeature);
}

export interface NetworkPlacementPlan {
  ok: boolean;
  reason?: string;
  /** Element actually placed (a road dragged over water becomes a bridge) */
  defId: string;
  /** Existing water-feature tile replaced by the bridge */
  replaceId?: string;
  overWater?: boolean;
}

/**
 * Smart road placement: dragging a ground road across water automatically builds a bridge
 * (steel truss, stone arch, or suspension span for highways), and bridges can be laid right
 * over rivers, canals & ponds — the water keeps flowing underneath.
 */
export function planNetworkPlacement(state: GameState, def: CivElementDef, gx: number, gz: number): NetworkPlacementPlan {
  const base = checkPlacementValid(state, def, gx, gz, 1, 1);
  if (!isElementUnlocked(def, state)) return { ok: false, reason: base.reason, defId: def.id };
  if (base.valid) {
    return { ok: true, defId: def.id, overWater: networkDeckClass(def) === "elevated" && getTileTerrainKind(gx, gz, state) !== "land" };
  }
  if (!def.isRoadNetwork && !def.isRailNetwork) return { ok: false, reason: base.reason, defId: def.id };
  if (gx < GRID_MIN || gz < GRID_MIN || gx > GRID_MAX || gz > GRID_MAX) {
    return { ok: false, reason: base.reason, defId: def.id };
  }
  const occ = buildOccupancyMap(state.elements);
  const here = occ.get(`${gx},${gz}`);
  const hereDef = here ? ELEMENT_BY_ID[here.defId] : undefined;
  const waterUnder = here
    ? Boolean(hereDef?.isWaterFeature && hereDef.isNetwork)
    : getTileTerrainKind(gx, gz, state) === "water";
  if (!waterUnder) return { ok: false, reason: base.reason, defId: def.id };

  let bridgeId = def.id;
  if (networkDeckClass(def) !== "elevated" && !def.isRailNetwork) {
    const prefs =
      def.id === "highways" || def.id === "freeways"
        ? ["suspension_bridges", "bridges", "stone_bridges"]
        : def.id === "pretty_roads" || def.id === "walking_paths" || def.id === "paths" || def.id === "trails" || def.id === "side_walks"
          ? ["stone_bridges", "bridges"]
          : ["bridges", "stone_bridges", "suspension_bridges"];
    if (def.id === "boardwalks") prefs.unshift("boardwalks");
    const pick = prefs.find((id) => {
      const d = ELEMENT_BY_ID[id];
      return d && isElementUnlocked(d, state);
    });
    if (!pick) {
      return { ok: false, reason: "Water! Bridges unlock at Stage 6 — then roads auto-bridge across", defId: def.id };
    }
    bridgeId = pick;
  }
  return { ok: true, defId: bridgeId, replaceId: here?.id, overWater: Boolean(here) || getTileTerrainKind(gx, gz, state) !== "land" };
}

/** Choose a valid shoreline orientation. Facing is scored per edge tile so a wide side has no inherent advantage. */
function shoreRotation(state: GameState, def: CivElementDef, gx: number, gz: number, sx: number, sz: number, preferred: number): number {
  const rearIntake = ["water_pumping_station", "desalination_plant", "hydro_electric_power_plants"].includes(def.id);
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let best = preferred;
  let bestScore = -1;
  for (let turn = 0; turn < 4; turn++) {
    const rot = (preferred + turn) % 4;
    const [w, h] = rot % 2 ? [sz, sx] : [sx, sz];
    if (!checkPlacementValid(state, def, gx, gz, w, h).valid) continue;
    const [dx, dz] = directions[(rot + (rearIntake ? 2 : 0)) % 4];
    const edge = dx ? h : w;
    let score = 0;
    for (let k = 0; k < edge; k++) {
      for (let d = 1; d <= 3; d++) {
        const x = dx > 0 ? gx + w - 1 + d : dx < 0 ? gx - d : gx + k;
        const z = dz > 0 ? gz + h - 1 + d : dz < 0 ? gz - d : gz + k;
        if (getTerrainCell(state,x,z).depth>.1) score += (4 - d) / edge;
      }
    }
    if (score > bestScore + 0.001) {
      best = rot;
      bestScore = score;
    }
  }
  return best;
}

export function planConstruction(state: GameState, selected: CivElementDef, gx: number, gz: number, brushLevel: number, preferred: number, faceManually=false) {
  const network = selected.isNetwork ? planNetworkPlacement(state, selected, gx, gz) : undefined;
  const def = ELEMENT_BY_ID[network?.defId ?? selected.id];
  const level = state.mode === "god" ? Math.min(getMaxElementLevel(def.id), Math.max(1, brushLevel)) : 1;
  const [sx, sz] = getStandardFootprintForLevel(def, level);
  const rotation = faceManually && !def.isNetwork ? preferred : def.domain === "coast_or_water" && !def.isNetwork
    ? shoreRotation(state, def, gx, gz, sx, sz, preferred)
    : autoFrontageRotation(def, gx, gz, sx, sz, preferred, buildOccupancyMap(state.elements),
      (width,height)=>checkPlacementValid(state,def,gx,gz,width,height).valid);
  const [spanX, spanZ] = rotation % 2 ? [sz, sx] : [sx, sz];
  const check = network ? { valid: network.ok, reason: network.reason } : checkPlacementValid(state, def, gx, gz, spanX, spanZ);
  const occupancy=buildOccupancyMap(state.elements);
  const roadAxis=roadWidth(def.id)>1?chooseRoadAxis(gx,gz,preferred,occupancy):undefined;
  if(check.valid&&roadAxis){const reason=corridorConflict(gx,gz,1,1,def.id,roadAxis,occupancy,(x,z)=>getTerrainCell(state,x,z).depth<=.1);if(reason){check.valid=false;check.reason=reason;}}
  const lock = buildingLockReason(selected, state);
  if (check.valid && lock) {
    check.valid = false;
    check.reason = lock;
  }
  if (check.valid && buildingCharges(state) && state.money < def.cost) {
    check.valid = false;
    check.reason = `Need $${def.cost.toLocaleString()} to build ${def.name}.`;
  }
  return { ...check, def, level, rotation, spanX, spanZ, roadAxis, overWater: Boolean(network?.overWater), replaceId: network?.replaceId, pedestrianDeck: !!network?.overWater && PEDESTRIAN_IDS.has(selected.id) };
}

export function planRelocation(state: GameState, el: PlacedElement, gx: number, gz: number) {
  if(state.infrastructure?.spans[`${el.gx},${el.gz}`])return {valid:false,reason:"Move the entire crossing by removing its deck in Public works and drawing a new run.",underlay:undefined};
  const def = ELEMENT_BY_ID[el.defId];
  const ignore = new Set([el.id]);
  let underlay: PlacedElement | undefined;
  if (def.isRailNetwork || (def.isRoadNetwork && (networkDeckClass(def) === "elevated" || def.id === "boardwalks"))) {
    const occupied = buildOccupancyMap(state.elements).get(`${gx},${gz}`);
    const water = occupied && ELEMENT_BY_ID[occupied.defId];
    if (water?.isNetwork && water.isWaterFeature) {
      underlay = occupied;
      ignore.add(occupied!.id);
    }
  }
  if(el.roadAxis){const reason=corridorConflict(gx,gz,1,1,el.defId,el.roadAxis,buildOccupancyMap(state.elements,ignore),(x,z)=>getTerrainCell(state,x,z).depth<=.1);if(reason)return {valid:false,reason,underlay};}
  return { ...checkPlacementValid(state, def, gx, gz, el.spanX, el.spanZ, ignore), underlay };
}

export function relocatePlacedElement(state: GameState, el: PlacedElement, gx: number, gz: number): boolean {
  if (el.gx === gx && el.gz === gz) return true;
  const plan = planRelocation(state, el, gx, gz);
  if (!plan.valid) return false;
  if (plan.underlay) state.elements = state.elements.filter(e => e.id !== plan.underlay!.id);
  if (el.waterUnderlay) state.elements.push(el.waterUnderlay);
  el.waterUnderlay = plan.underlay;
  el.overWater = Boolean(plan.underlay) || (ELEMENT_BY_ID[el.defId].isRoadNetwork && getTileTerrainKind(gx, gz, state) !== "land");
  el.gx = gx;
  el.gz = gz;
  el.animProgress = 0.85;
  el.animKind = "place";
  return true;
}

export function removePlacedElements(state: GameState, ids: Set<string>): void {
  const i=state.infrastructure;
  if(i){let changed=false;for(const e of state.elements)if(ids.has(e.id)){const k=`${e.gx},${e.gz}`;if(i.spans[k]||i.streets[k]){delete i.spans[k];delete i.streets[k];changed=true;}}if(changed)i.revision++;}
  state.elements = state.elements.flatMap(el => {
    if (!ids.has(el.id)) return [el];
    return el.waterUnderlay ? [el.waterUnderlay] : [];
  });
}

export function getNetworkConnMask(
  elements: PlacedElement[],
  el: Pick<PlacedElement, "defId" | "gx" | "gz" | "overWater" | "crossingAxis" | "edgeOverrides">,
  occIn?: Map<string, PlacedElement>,
  state?: GameState,
): number {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def?.isNetwork) return 0;
  const occ = occIn ?? buildOccupancyMap(elements);
  let mask = 0;
  // Bits 0..3 (1,2,4,8)        = connected same-network neighbours N(-Z), E(+X), S(+Z), W(-X)
  // Bits 4..7 encode real curb cuts, bits 8..11 ramps, bit 12 water underneath.
  // Bits 13..16 and 17..20 identify freight and boarding entrances, respectively.
  const neighbors: [number, number, number, number][] = [
    [0, -1, 1, 256],
    [1, 0, 2, 512],
    [0, 1, 4, 1024],
    [-1, 0, 8, 2048],
  ];
  const myDeck = networkDeckClass(def);
  if (def.isRoadNetwork) {
    for(const access of roadSiteAccess(el,occ,state)){
      const dir=access.dx===1?1:access.dx===-1?3:access.dz===1?2:0;
      mask |= encodeRoadSitePort(dir,access.kind);
    }
  }
  for (const [dx, dz, roadBit, rampBit] of neighbors) {
    const nb = occ.get(`${el.gx + dx},${el.gz + dz}`);
    if (!nb) {
      if (state && def.isWaterFeature && getTerrainCell(state,el.gx+dx,el.gz+dz).depth>.1) mask |= roadBit;
      continue;
    }
    const nbDef = ELEMENT_BY_ID[nb.defId];
    if (!nbDef) continue;
    if (def.isRailNetwork) {
      if (nbDef.isRailNetwork && railSpanAllows(state,el.gx,el.gz,dx,dz)) {
        mask |= roadBit;
      }
    } else if (def.isWaterFeature) {
      if (nbDef.isWaterFeature || nb.waterUnderlay || nb.overWater || nbDef.archetype === "dock_pier") mask |= roadBit;
    } else if (def.isRoadNetwork) {
      if (nbDef.isRoadNetwork && roadPortOpen(state,el.gx,el.gz,dx,dz)) {
        mask |= roadBit;
        if (networkDeckClass(nbDef) !== myDeck) mask |= rampBit;
      }
    }
  }
  if(el.crossingAxis)mask=(mask&~3840)|(((el.crossingAxis==="x"?5:10)&mask)<<8);
  if (el.overWater || getTileTerrainKind(el.gx, el.gz,state) !== "land") mask |= 4096;
  return mask;
}

export function resizeElementForLevel(
  state: GameState,
  el: PlacedElement,
  targetLevel: number,
): boolean {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return false;
  const nextLevel = Math.max(1, Math.min(getMaxElementLevel(el.defId), Math.round(targetLevel)));
  if (nextLevel === el.level) return false;

  if (!def.isNetwork) {
    const [stdX, stdZ] = getStandardFootprintForLevel(def, nextLevel);
    const rotSwap = el.rotation % 2 === 1;
    const wantX = Math.min(MAX_FOOTPRINT, rotSwap ? stdZ : stdX);
    const wantZ = Math.min(MAX_FOOTPRINT, rotSwap ? stdX : stdZ);
    const ignore = new Set([el.id]);
    let fitted = false;
    const tryDims: [number, number][] = [[wantX, wantZ]];
    if (wantX !== wantZ) tryDims.push([wantZ, wantX]);
    for (const [tx, tz] of tryDims) {
      // Candidate anchors that keep the old footprint inside/overlapping, nearest-to-centre first
      const cands: [number, number, number][] = [];
      for (let ox = -(tx - 1); ox <= el.spanX - 1; ox++) {
        for (let oz = -(tz - 1); oz <= el.spanZ - 1; oz++) {
          const cx = el.gx + ox + tx / 2 - (el.gx + el.spanX / 2);
          const cz = el.gz + oz + tz / 2 - (el.gz + el.spanZ / 2);
          cands.push([ox, oz, cx * cx + cz * cz]);
        }
      }
      cands.sort((p, q) => p[2] - q[2]);
      for (const [ox, oz] of cands) {
        if (checkPlacementValid(state, def, el.gx + ox, el.gz + oz, tx, tz, ignore).valid) {
          el.gx += ox;
          el.gz += oz;
          el.spanX = tx;
          el.spanZ = tz;
          if (tx !== wantX || tz !== wantZ) el.rotation = (el.rotation + 1) % 4;
          fitted = true;
          break;
        }
      }
      if (fitted) break;
    }
    if (!fitted) return false;
  }

  el.level = nextLevel;
  el.maintTimerSec = 0;
  el.disrepair = false;
  el.animProgress = 0.9;
  el.animKind = "upgrade";
  return true;
}

export function resizeCrossing(state:GameState,el:PlacedElement,nextLevel:number){
  const pieces=crossingPieces(state,el),span=pieces[0]?.[1];
  if(!span)return false;
  const level=bridgeTier(span),cap=span.mode==="foot"||span.mode==="rail"?5:11;
  if(!Number.isInteger(nextLevel)||nextLevel<1||nextLevel>cap)return false;
  if(pieces.some(([key,part])=>(state.infrastructure!.conduits[key]?.height??Infinity)<part.deck+.125*(nextLevel-level)+.7))return false;
    const ordered=pieces.slice().sort(([a],[b])=>(Number(a.split(",")[span.axis==="x"?0:1])-Number(b.split(",")[span.axis==="x"?0:1]))*span.direction);
    const ramps=ordered.filter(([,p])=>p.ramp).length/2 || 1, rise=.125*(nextLevel-level), occ=buildOccupancyMap(state.elements);
    for(let n=0;n<ordered.length;n++){
      const [key,part]=ordered[n];
      const frac=(j:number)=>Math.max(0,Math.min(1,j/ramps,(ordered.length-j)/ramps));
      part.startHeight+=rise*frac(n);part.endHeight+=rise*frac(n+1);part.deck+=rise;part.tier=nextLevel;
      const road=occ.get(key);if(road){road.level=Math.min(nextLevel,getMaxElementLevel(road.defId));road.animKind="upgrade";road.animProgress=1;road.disrepair=false;road.maintTimerSec=0;}
    }
    markInfrastructureChanged(state.infrastructure!);
  return true;
}
/** Existing islands can widen a compact motorway in place when its full right of way is free. */
export function legacyRoadWidening(state:GameState,el:PlacedElement){
  const width=roadWidth(el.defId),cost=buildingCharges(state)?ELEMENT_BY_ID[el.defId].cost*(width-1):0;
  const occ=buildOccupancyMap(state.elements,new Set([el.id])),axis=chooseRoadAxis(el.gx,el.gz,el.rotation,occ);
  const reason=width===1||el.roadAxis?"Already at its design width.":state.infrastructure?.spans[el.gx+","+el.gz]?"Change the whole crossing in Public works.":
    corridorConflict(el.gx,el.gz,1,1,el.defId,axis,occ,(x,z)=>getTerrainCell(state,x,z).depth<=.1)??(state.money<cost?"Insufficient treasury for widening.":undefined);
  return {axis,cost,reason};
}
export function widenLegacyRoad(state:GameState,el:PlacedElement){
  const {axis,cost,reason}=legacyRoadWidening(state,el);
  if(reason)return {ok:false,reason};
  el.roadAxis=axis;
  transfer(state,"treasury","outside",cost,"Carriageway widening");recomputeConnectivityAndMetrics(state);
  return {ok:true};
}
export function placedUpgradeCost(state:GameState,el:PlacedElement){
  const pieces=crossingPieces(state,el);
  return pieces.length?crossingUpgradePrice(pieces[0][1],pieces.length):getUpgradeCost(ELEMENT_BY_ID[el.defId],el.level);
}
export function upgradeElementDirect(state: GameState, id: string): { ok: boolean; reason?: string } {
  const el = state.elements.find((e) => e.id === id);
  if (!el) return { ok: false, reason: "Element not found" };
  const pieces=crossingPieces(state,el), span=pieces[0]?.[1];
  const level=span?bridgeTier(span):el.level;
  if (level >= (span && (span.mode==="foot"||span.mode==="rail")?5:getMaxElementLevel(el.defId))) return { ok: false, reason: "Already at maximum level" };

  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return { ok: false, reason: "Unknown element" };

  const cost = buildingCharges(state) ? placedUpgradeCost(state,el) : 0;
  if (state.money < cost) {
    return { ok: false, reason: `Need $${cost.toLocaleString()} to upgrade` };
  }

  const ready = upgradeReadiness(state, el);
  if (!ready.ready) return {ok:false,reason:ready.reasons.join(" ")};
  if(span){
    if(!resizeCrossing(state,el,level+1))return {ok:false,reason:"Raise the aqueduct above the upgraded deck."};
    transfer(state,"treasury","outside",cost,"Crossing upgrade");
    recomputeConnectivityAndMetrics(state);return {ok:true};
  }
  if (!resizeElementForLevel(state, el, el.level + 1)) {
    const [w, h] = getStandardFootprintForLevel(def, el.level + 1);
    return { ok: false, reason: `Clear a ${w}×${h} site touching this ${def.name} to expand.` };
  }
  transfer(state, "treasury", "outside", cost, "Building upgrade");
  el.animProgress = 1.0;

  recomputeConnectivityAndMetrics(state);
  return { ok: true };
}

export function pushToast(
  state: GameState,
  kind: GameEventToast["kind"],
  title: string,
  subtitle: string,
): void {
  state.toasts = [
    {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      title,
      subtitle,
      createdAt: Date.now(),
    },
    ...state.toasts,
  ].slice(0, 4);
}

interface RoadNetworkAnalysis {
  roadCompsByCoord: Map<string, number[]>;
  buildingsInRoadComp: Map<number, Set<string>>;
  elementRoadComps: Map<string, Set<number>>;
}

function analyzeRoadNetwork(elements: PlacedElement[], state?:GameState): RoadNetworkAnalysis {
  const occ = buildOccupancyMap(elements);
  // A bridge deck and the street passing underneath occupy one cell but cannot exchange traffic.
  const roadTiles = new Set<string>();
  const split = new Set<string>();
  for (const e of elements) {
    const d = ELEMENT_BY_ID[e.defId];
    if (!d?.isRoadNetwork) continue;
    const key = `${e.gx},${e.gz}`;
    roadTiles.add(key);
    if (networkDeckClass(d) !== "ground" && separatedDeckAxis(getNetworkConnMask(elements, e, occ,state)) >= 0) split.add(key);
  }
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const nodeKey = (coord: string, dx: number) => dx !== 0 && split.has(coord) ? coord + "/ew" : coord;
  const component = new Map<string, number>();
  const roadCompsByCoord = new Map<string, number[]>();
  let sequence = 0;
  for (const coord of roadTiles) {
    const [x, z] = coord.split(",").map(Number);
    for (const startAxis of split.has(coord) ? [0, 1] : [0]) {
      const start = nodeKey(coord, startAxis);
      if (component.has(start)) continue;
      sequence++;
      const queue = [[x, z, startAxis]];
      component.set(start, sequence);
      for (let head = 0; head < queue.length; head++) {
        const [cx, cz, axis] = queue[head];
        const here = `${cx},${cz}`;
        for (const [dx, dz] of directions) {
          if (split.has(here) && (dx !== 0) !== (axis !== 0)) continue;
          const nx = cx + dx, nz = cz + dz;
          const neighbor = `${nx},${nz}`;
          const next = nodeKey(neighbor, dx);
          if (!roadTiles.has(neighbor) || component.has(next) || !roadPortOpen(state,cx,cz,dx,dz)) continue;
          component.set(next, sequence);
          queue.push([nx, nz, Math.abs(dx)]);
        }
      }
    }
  }
  for (const coord of roadTiles) {
    const main = component.get(coord)!;
    const second = component.get(coord + "/ew");
    roadCompsByCoord.set(coord, second && second !== main ? [main, second] : [main]);
  }
  const buildingsInRoadComp = new Map<number, Set<string>>();
  const elementRoadComps = new Map<string, Set<number>>();

  const shared = new Map<string,Set<string>>();
  const sites = elements.filter(el=>ELEMENT_BY_ID[el.defId] && !ELEMENT_BY_ID[el.defId].isNetwork);
  for (const el of sites) {
    const comps = new Set<number>(), neighbors = new Set<string>();
    for (const step of parcelAccessSteps(el,occ,state)) {
      const next=ELEMENT_BY_ID[step.neighbor.defId];
      if (next.isRoadNetwork) {
        const horizontal=step.gx<el.gx || step.gx>=el.gx+el.spanX;
        const id=component.get(nodeKey(step.gx+","+step.gz,horizontal ? 1:0));
        if(id!==undefined) comps.add(id);
      } else if (!next.isNetwork) neighbors.add(step.neighbor.id);
    }
    elementRoadComps.set(el.id,comps);
    shared.set(el.id,neighbors);
  }
  // A foot gate or cart lane can serve the parcels behind a streetfront. It never
  // joins the actual road decks or gives cars a shortcut through a private property.
  const visited = new Set<string>();
  for (const el of sites) {
    if(visited.has(el.id)) continue;
    const group=[el.id], accessible=new Set<number>();visited.add(el.id);
    for(let i=0;i<group.length;i++) {
      for(const c of elementRoadComps.get(group[i])!) accessible.add(c);
      for(const id of shared.get(group[i])!) {
        if(!visited.has(id) && shared.has(id)) {visited.add(id); group.push(id);}
      }
    }
    for(const id of group) elementRoadComps.set(id,accessible);
  }
  for(const el of sites) {
    if(ELEMENT_BY_ID[el.defId].passiveNature) continue;
    for(const id of elementRoadComps.get(el.id)!) {
      let members=buildingsInRoadComp.get(id);
      if(!members) {members=new Set();buildingsInRoadComp.set(id,members);}
      members.add(el.id);
    }
  }
  return { roadCompsByCoord, buildingsInRoadComp, elementRoadComps };
}

/**
 * Street and footpath components with two occupied destinations, including shared pedestrian courts.
 * Walkers can explore a component. Motor traffic uses complete entrance-to-entrance journeys.
 */
export function getConnectedRoadCoordSet(elements: PlacedElement[],state?:GameState): Set<string> {
  const { roadCompsByCoord, buildingsInRoadComp } = analyzeRoadNetwork(elements,state);
  const validCoords = new Set<string>();
  for (const [coord, comps] of roadCompsByCoord) {
    if (comps.some(id => (buildingsInRoadComp.get(id)?.size ?? 0) >= 2)) {
      validCoords.add(coord);
    }
  }
  return validCoords;
}

/**
 * Returns rail coordinates belonging to rail components touching a working train stop or depot.
 */
export function getConnectedRailCoordSet(elements: PlacedElement[]): Set<string> {
  const occ = buildOccupancyMap(elements);
  const railCompByCoord = new Map<string, number>();
  let compSeq = 0;

  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def?.isRailNetwork) continue;
    const startKey = `${el.gx},${el.gz}`;
    if (railCompByCoord.has(startKey)) continue;

    compSeq += 1;
    const queue: [number, number][] = [[el.gx, el.gz]];
    railCompByCoord.set(startKey, compSeq);
    while (queue.length > 0) {
      const [cx, cz] = queue.shift()!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const nz = cz + dz;
        const nKey = `${nx},${nz}`;
        if (railCompByCoord.has(nKey)) continue;
        const nb = occ.get(nKey);
        const nbDef = nb ? ELEMENT_BY_ID[nb.defId] : undefined;
        if (nbDef?.isRailNetwork) {
          railCompByCoord.set(nKey, compSeq);
          queue.push([nx, nz]);
        }
      }
    }
  }

  const activeComps = new Set<number>();
  for (const el of elements) {
    if ((el.defId !== "train_stops" && el.defId !== "train_depots") || el.onFire || el.disrepair) continue;
    for (const edge of getParcelEdges(el,occ)) {
      if(edge.kind!=="platform") continue;
      const [x,z] = cellBeyondEdge(el,edge.side,edge.slot);
      const component = railCompByCoord.get(x+","+z);
      if(component!==undefined) activeComps.add(component);
    }
  }

  const valid = new Set<string>();
  for (const [coord, compId] of railCompByCoord.entries()) {
    if (activeComps.has(compId)) valid.add(coord);
  }
  return valid;
}

/**
 * Computes road network connected components, coverage radii (Police, Fire, Nuisance),
 * and full city supply/demand metrics + Advisor diagnostics.
 */
const HARBOR_IDS = new Set([
  "docks",
  "shipyards",
  "ship_building_areas",
  "naval_base",
  "submarine_base",
  "naval_shipyard_base",
  "naval_coast_guard_base",
  "naval_destroyer_dock",
  "naval_carrier_berth",
  "naval_amphibious_dock",
  "coast_rescue_station",
  "harbor_patrol_pier",
  "marine_amphib_base",
]);

/** Foot-traffic-only network pieces (cars stay off; villagers love them) */
export const PEDESTRIAN_IDS = new Set(["paths", "walking_paths", "trails", "side_walks", "boardwalks"]);

export function recomputeConnectivityAndMetrics(state: GameState): void {
  syncCatalogBridges(state);
  // Normalize old saves that predate protected sanctuaries.
  for (const site of state.elements) if (isSanctuary(site)) {site.onFire = false; site.disrepair = false;}
  const elements = state.elements;
  const parcelOccupancy = buildOccupancyMap(elements);
  const waterSystem=hydraulics(state);
  const waterAtSites = waterSystem.services;
  const parcelEdges = new Map(elements.map(el => [el.id,getParcelEdges(el,parcelOccupancy,state)]));
  const borderEffects = new Map(elements.map(el => [el.id,getParcelEffectSummary(parcelEdges.get(el.id)!)]));
  let unportedVessels = 0;
  const freeAccess=state.mode==="god"&&effective(state,"access",0)>0;
  const service = transitReadout(state);
  const { buildingsInRoadComp, elementRoadComps } = analyzeRoadNetwork(elements,state);

  // An element is connected if:
  // - In God Mode: always active, or
  // - It is passiveNature / water / maritime vessel on water, or
  // - It touches a road component shared with at least 1 other placed building!
  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) {
      el.connected = false;
      continue;
    }
    if (def.isNetwork || def.passiveNature) {
      el.connected = true;
      continue;
    }
    if (def.domain === "water" && el.defId!=="ocean_habitat_ring") {
      el.connected = freeAccess || !vesselIds.has(el.defId) || hasNavigableHarbor(state, el);
      if (!el.connected) unportedVessels += 1;
      continue;
    }
    const comps = elementRoadComps.get(el.id);
    let linked = false;
    if (comps) {
      for (const cId of comps) {
        if ((buildingsInRoadComp.get(cId)?.size ?? 0) >= 2) {
          linked = true;
          break;
        }
      }
    }
    el.connected = freeAccess || linked || service.reachable.has(el.id);
  }

  const farms = collectFarms(state,parcelOccupancy,el=>hasFarmRoad(el,parcelOccupancy,parcelEdges.get(el.id)!),parcelEdges);
  for(const el of elements){
    const complex = farms.get(el.id);
    if(complex?.live) el.connected=true;
    else if(FARM_MODULE_IDS.has(el.defId) && el.defId!=="fields") el.connected=false;
  }
  const districts=setDistrictReport(state,farms,parcelOccupancy,parcelEdges);
  // 3. Spatial radii: Police coverage, Fire coverage, and Nuisance proximity
  const waterUnderlays = elements.flatMap(e => e.waterUnderlay ? [e.waterUnderlay] : []);
  const layout = analyzeLayout(waterUnderlays.length ? [...elements, ...waterUnderlays] : elements, (x,z) => isCoastalTile(x,z,state),String(state.terrainVersion??1)+"/"+(state.infrastructure?.stamp ?? state.infrastructure?.revision??0));
  const railServed = railServedSites(state);

  for (const el of elements) {
    el.nuisancePenalty = 0;
    const def = ELEMENT_BY_ID[el.defId];
    const border = borderEffects.get(el.id)!;
    const pol = Math.max(0,sampleFieldAvg(layout.pollution, el)-border.cooling);
    el.pollution = Math.round(pol * 10) / 10;
    el.landValue = Math.round(sampleFieldAvg(layout.landValue, el) * 100) / 100;
    // Rail Freight needs a running freight line serving the site, not just nearby track.
    el.synergies = (layout.synergies.get(el.id) ?? []).filter(tag => tag !== "irrigated" && (tag !== "rail_freight" || railServed.has(el.id)));
    if (def?.category==="agriculture" && (border.bankWater || (waterAtSites.get(el.id)?.irrigation ?? 0)>0))
      el.synergies.push("irrigated");
    if (def?.popBase && pol > 1.2) {
      el.nuisancePenalty = Math.round((pol - 1.2) * 3);
    }
  }

  // 4. Aggregate Supplies, Demands, Population & Happiness
  const m = createEmptyMetrics();
  m.waterSupply += Math.round(waterSystem.channelDelivery);
  for (const water of waterUnderlays) {
    const feature = ELEMENT_BY_ID[water.defId];
    const scale = levelMultiplier("output", water.level);
    m.waterSupply += (feature?.water ?? 0) * scale * freshWaterFactor(state,water);
    m.recreationSupply += (feature?.recreation ?? 0) * scale;
  }
  let baseHousingPop = 0;
  let policePoints = 0;
  let uncoveredBuildings = 0;
  let coverableBuildings = 0;
  let militaryPower = 0;
  let upkeepSum = 0;
  let instantPower = 0, steadyPower = 0;
  let renewableOut = 0;
  let landValueSum = 0;

  const demand = streetDemand(state);
  const congestedEls = demand.congestedSites;
  trafficByReport.set(m, demand.load);
  lastTrafficLoad = demand.load;
  m.trafficTrips = Math.round(demand.carTrips);
  m.trafficCapacity = Math.round(demand.capacity);
  m.congestion = Math.round(demand.congestion);
  m.congestionDaily = Math.round(demand.congestion * AVERAGE_RUSH_FACTOR / Math.max(0.05, rushHourFactor(state.timeOfDay ?? 10.5)));
  m.transitTrips = Math.round(service.served);
  // Riders are counted per real minute; street trips per game hour (1 game hour = 5 real seconds).
  const servedPerGameHour = service.served / 12;
  m.transitShare = servedPerGameHour ? Math.round(100 * servedPerGameHour / Math.max(servedPerGameHour, demand.trips)) : 0;
  m.solarFactor = Math.round(powerOutputFactor("solar", state.timeOfDay ?? 10.5, state.weather, state.windSpeed ?? 1) * 100) / 100;
  m.windFactor = Math.round(powerOutputFactor("wind", state.timeOfDay ?? 10.5, state.weather, state.windSpeed ?? 1) * 100) / 100;

  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) continue;

    if (el.disrepair) m.disrepairCount += 1;
    if (el.disrepair && state.mode !== "survival") m.recoveringBuildings += 1;
    if (el.onFire) m.burningCount += 1;

    if (!def.isNetwork && !def.passiveNature && !el.connected && def.domain === "land") {
      m.disconnectedBuildings += 1;
    }

    if (!el.connected || el.onFire) continue;

    // Level scaling (see levelScaling.ts): every output below starts from the nominal per-level
    // figure in elementLevelStats (doubling per level: 1, 2, 4, 8, 16), then neighbour synergies.
    const synCount = el.synergies?.length ?? 0;
    m.synergyCount += synCount;
    const synMult = synergyMultiplier(synCount);
    const lv = elementLevelStats(def, el.level);
    // Flat parcel-edge bonuses (cloister, service yard, heat exchange…) grow with the site's level.
    const edgeRaw = borderEffects.get(el.id)!, amenity = levelMultiplier("amenity", el.level);
    const edgeEffect = { ...edgeRaw, recreation: edgeRaw.recreation * amenity, waste: edgeRaw.waste * amenity,
      education: edgeRaw.education * amenity, heat: edgeRaw.heat * amenity };
    // Disrepair in Survival Mode cuts positive service output by 75%
    const serviceHealth = (el.disrepair ? 0.25 : 1.0) * synMult;
    upkeepSum += lv.upkeep;

    // Shared edible beds feed their household. Ceremonial walks and connected habitat are small
    // local amenities, so a ten-tile boundary grants the same benefit as one working gate.
    if (def.recreation || def.id === "graveyards") m.recreationSupply += Math.round(edgeEffect.recreation * serviceHealth);
    // Wild nature is a land-value and clean-air asset; as a city service it counts at 25%, and it
    // only supplies drinking water where it touches a fresh river, lake or canal.
    const wild = def.passiveNature && def.category === "nature_terrain" && !def.isWaterFeature;
    if (def.popBase) {
      // Count access to a river or canal once per home, regardless of the length of its bank.
      const waterfront = state.infrastructure && PARCEL_SIDES.some(side => {
        const len = (side==="front" || side==="back") === (el.rotation%2===0) ? el.spanX : el.spanZ;
        for(let slot=0;slot<len;slot++){
          const [x,z]=cellBeyondEdge(el,side,slot), bank=state.infrastructure!.cells[x+","+z];
          if(bank&&(bank.form==="river"||bank.form==="canal")&&getTerrainCell(state,x,z).depth>.1)return true;
        }
        return false;
      });
      if(waterfront)m.recreationSupply+=2*levelMultiplier("output",el.level);
      const lvPop = landValuePopMultiplier(el.landValue ?? 0.5);
      landValueSum += el.landValue ?? 0.5;
      baseHousingPop += lv.population * lvPop * synMult * (1 + edgeEffect.walking);
      m.connectedHouses += 1;
      if (el.nuisancePenalty > 0) {
        m.nuisanceAffectedHomes += 1;
      }
    }

    if (def.power) {
      const pk = powerKind(def);
      if (def.power > 0 && pk) {
        const live = powerOutputFactor(pk, state.timeOfDay ?? 10.5, state.weather, state.windSpeed ?? 1) * generationExposure(pk, state, el, parcelOccupancy);
        const railSupply=def.id==="coal_powerplants"?railFreightBonus(state,el.id,"coal"):def.id==="natural_gas_power_plants"?railFreightBonus(state,el.id,"fuel"):1;
        const head = pk==="hydro"?Math.min(1,hydroHead(state,el)/1.5):1;
        const out = Math.round(lv.power * railSupply * serviceHealth * live * head);
        const steady = lv.power * railSupply * serviceHealth * head * steadyPowerOutputFactor(pk, state.weather, state.windSpeed ?? 1) * generationExposure(pk, state, el, parcelOccupancy);
        instantPower += out; steadyPower += steady;
        m.powerSupply += out;
        if (pk === "solar" || pk === "wind" || pk === "hydro" || pk === "geo") renewableOut += out;
      }
      else m.powerDemand += Math.max(0, lv.powerDraw - edgeEffect.heat);
    }
    if (def.water) {
      if (def.water > 0) {
        const fresh = wild ? (touchesFreshWater(state, el) ? 1 : 0) : freshWaterFactor(state,el);
        if (def.id === "water_treatment_plant" && fresh > 0 && fresh < 1) m.groundwaterPlants += 1;
        m.waterSupply += Math.round(lv.water * serviceHealth * fresh);
      }
      else m.waterDemand += lv.waterDraw;
    }
    if (def.waste) {
      m.wasteCapacity += Math.round((lv.waste + edgeEffect.waste) * serviceHealth * railFreightBonus(state,el.id,"waste"));
    }
    if (def.jobs) {
      m.jobsAvailable += Math.round(lv.jobs * serviceHealth);
    }
    if (def.education) {
      m.educationSupply += Math.round((lv.education + edgeEffect.education) * serviceHealth * (districts.bonuses.educationMultiplier.get(el.id)??1));
    }
    if (def.recreation) {
      m.recreationSupply += Math.round(lv.recreation * (wild ? 0.25 : 1) * serviceHealth * (districts.bonuses.recreationMultiplier.get(el.id)??1) * (el.defId==="middle_school"?1.16:el.defId==="elementary_school"?1.1:1));
    }
    if (def.government) {
      m.govSupply += Math.round(lv.government * serviceHealth);
    }

  }

  // Population calculation:
  // Immediate connected housing base (Lv1 House = 5) + thriving settlement pool bounded by housing capacity
  if (baseHousingPop === 0) {
    state.population = 0;
    state.growthPool = 0;
  } else {
    // Allow thriving towns to attract denser settlement up to stage-scaled neighborhood capacity
    const maxSettlementBonus = baseHousingPop * (state.mode==="god"?30:20);
    state.growthPool = Math.max(-baseHousingPop * 0.8, Math.min(maxSettlementBonus, state.growthPool));
    state.population = Math.max(0, Math.round(baseHousingPop + state.growthPool));
  }

  state.population = Math.round(effective(state,"population",sanctuaryPopulation(state, state.population)));
  const community = faithServices(state);

  // Update stage progression before evaluating stage-gated systems (Crime & Defense)
  {
    let stageNow = 1;
    for (const s of STAGES) {
      if (state.population >= s.minPop*effective(state,"stageScale",100)/100) {
        stageNow = s.stage;
      }
    }
    stageNow = Math.round(effective(state,"stage",stageNow));
    state.currentStage = stageNow;

    if (stageNow > state.highestStageReached) {
      for (let st = state.highestStageReached + 1; st <= stageNow; st++) {
        const stMeta = STAGES[st - 1];
        const unlockedCount = ELEMENTS.filter((e) => e.stage === st).length;
        if(state.mode !== "god") pushToast(
          state,
          "stage",
          `Stage ${st}: ${stMeta.name} Unlocked!`,
          `${unlockedCount} new elements unlocked · ${stMeta.note}`,
        );
      }
      state.highestStageReached = stageNow;
    }
  }

  // Scale citizen service demands gently against active building units so Stage 1..20 feels fair and readable
  // Per-capita service demand eases as the city grows (economies of scale, floor 50%).
  const perCapita = perCapitaDemandScale(state.highestStageReached);
  const citizenUnits = Math.max(0, Math.ceil(state.population / 5*effective(state,"demand",100)/100*perCapita));
  // The basic household draw is already charged per building. Additional residents
  // settling in that housing also need drinking water and electricity.
  const additionalResidents = Math.max(0, state.population - Math.ceil(baseHousingPop));
  m.waterDemand += Math.ceil(additionalResidents * perCapita / RESIDENTS_PER_WATER);
  m.powerDemand += Math.ceil(additionalResidents * perCapita / RESIDENTS_PER_POWER);
  m.wasteDemand = Math.ceil(citizenUnits * WASTE_PER_UNIT);
  m.housingBase = Math.round(baseHousingPop);
  m.stageReached = state.highestStageReached;
  m.foodDemand = Math.ceil(citizenUnits * (state.mode==="survival"?1.6:1.4));
  m.educationDemand = Math.ceil(citizenUnits * 1.3);
  m.recreationDemand = Math.ceil(citizenUnits * 1.2);
  m.govDemand = state.highestStageReached >= 3 ? Math.ceil(citizenUnits * 1.5 * (1-community.civicRelief)) : 0;

  m.educationSupply=effective(state,"schools",m.educationSupply);
  m.wasteCapacity=effective(state,"waste",m.wasteCapacity);
  m.recreationSupply=effective(state,"parks",m.recreationSupply);
  const freightSites = elements.filter(el => el.defId === "freight_rail_terminal");
  const freightRail = new Set<string>();
  if (freightSites.length) {
    const tracks = getConnectedRailCoordSet(elements);
    for (const el of freightSites) {
      if (getParcelEdges(el,parcelOccupancy,state).some(edge => edge.kind === "freight" && tracks.has(cellBeyondEdge(el,edge.side,edge.slot).join(",")))) freightRail.add(el.id);
    }
  }
  evaluateEconomy(state,m,baseHousingPop,elementRoadComps,service.reachable,borderEffects,service.districts,congestedEls,freightRail);
  // Day-average power: same plants and reserve, with the sun averaged over a whole day.
  m.powerSupplySteady = state.mode === "god" ? m.powerSupply : Math.max(0, Math.round(m.powerSupply + steadyPower - instantPower));
  m.populationLimiter = populationLimiterFor(state, m, baseHousingPop, perCapita);

  // Dispatch and incident risk use the workforce just calculated for this layout.
  const authorized = hasAuthority(state);
  const policeSources = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return authorized && e.connected && !e.onFire && !e.disrepair && professionalStaff(state,e)>=1 && (d?.policeRadius ?? 0) > 0;
  });
  const fireSources = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return authorized && e.connected && !e.onFire && !e.disrepair && professionalStaff(state,e)>=1 && (d?.fireRadius ?? 0) > 0;
  });
  for(const el of elements){
    el.hasPoliceCover = false;
    el.hasFireCover = false;

    const cx = el.gx + el.spanX * 0.5;
    const cz = el.gz + el.spanZ * 0.5;

    for (const p of policeSources) {
      const pDef = ELEMENT_BY_ID[p.defId]!;
      const rad = p.disrepair ? (pDef.policeRadius ?? 10) * 0.45 : scaledRadius(pDef.policeRadius ?? 10, p.level);
      const dist = Math.hypot(cx - (p.gx + p.spanX * 0.5), cz - (p.gz + p.spanZ * 0.5));
      if (dist <= rad) {
        el.hasPoliceCover = true;
        break;
      }
    }

    for (const f of fireSources) {
      const fDef = ELEMENT_BY_ID[f.defId]!;
      const rad = f.disrepair ? (fDef.fireRadius ?? 12) * 0.5 : scaledRadius(fDef.fireRadius ?? 12, f.level);
      const dist = Math.hypot(cx - (f.gx + f.spanX * 0.5), cz - (f.gz + f.spanZ * 0.5));
      if (dist <= rad) {
        el.hasFireCover = true;
        break;
      }
    }

    const def=ELEMENT_BY_ID[el.defId]; if(!def||!el.connected||el.onFire)continue;
    const lv=elementLevelStats(def,el.level),serviceHealth=(el.disrepair?.25:1)*synergyMultiplier(el.synergies?.length??0);
    if (authorized && professionalStaff(state,el)>=1 && def.police) {
      policePoints += Math.round(lv.police * serviceHealth);
    }
    if (authorized && professionalStaff(state,el)>=1 && def.military) {
      militaryPower += Math.round(lv.military * serviceHealth);
    }
    if (!def.isNetwork && !def.passiveNature && (def.popBase || def.jobs)) {
      coverableBuildings += 1;
      if (!el.hasPoliceCover) uncoveredBuildings += 1;
    }
  }
  // Crime strictly unlocks only when Police elements become available (Stage 5 · 85,000 pop) in Real/Survival,
  // or when explicitly toggled ON via godCrimeEnabled in God Mode.
  m.crimeUnlocked =
    state.mode === "god"
      ? Boolean(state.godCrimeEnabled)
      : state.highestStageReached >= CRIME_UNLOCK_STAGE &&
        state.population >= CRIME_UNLOCK_MIN_POP;

  if (!m.crimeUnlocked && Array.isArray(state.crimeIncidents) && state.crimeIncidents.length > 0) {
    state.crimeIncidents = [];
  }

  // Defense metric unlocks at Stage 10+ in Real/Survival modes (or immediately in God Mode when military/police or combat exists)
  m.defenseUnlocked =
    state.mode === "god"
      ? !!state.activeAttack || state.currentStage >= 10 || elements.some(e=>(ELEMENT_BY_ID[e.defId]?.military??0)>0)
      : state.highestStageReached >= 10;

  // Stage-preset severity for Real & Survival (1.0 at Stage 10 .. 5.0 at Stage 20)
  m.stageAttackSeverity =
    state.mode === "god"
      ? 1
      : Math.max(1, Math.min(5, Math.round((1 + Math.max(0, state.highestStageReached - 10) * 0.4) * 10) / 10));

  // Count defender roster per security/military building:
  // Military provides the bulk of defense strength; Police & SWAT contribute comparatively little.
  const roster = aggregateDefenseRoster(state);
  m.soldiersCount = roster.soldiersCount;
  m.tanksCount = roster.tanksCount;
  m.navalBoatsCount = roster.navalBoatsCount;
  m.copsCount = roster.copsCount;
  m.swatCount = roster.swatCount;
  m.totalDefenders = roster.totalDefenders;
  m.defensePower = Math.round(roster.weightedPower + militaryPower * 0.15);

  const night = isNightTime(state.timeOfDay ?? 10.5);
  m.isNightCrimeSurge = Boolean(m.crimeUnlocked && night);

  if (m.crimeUnlocked && coverableBuildings > 0) {
    const uncovRatio = uncoveredBuildings / coverableBuildings;
    // Police capacity: 0.06 points per resident (≈12 Lv.5 departments for 500k).
    const capRatio = Math.min(1, policePoints / Math.max(12, state.population * 0.06));
    const economy = economyOf(state).report;
    const unemployment = 1 - Math.min(1,m.jobsAvailable/Math.max(1,m.jobsNeeded));
    const amenities = Math.min(14,m.recreationSupply/Math.max(1,m.recreationDemand)*6+economy.farms*.6+service.score*.04);
    const stress = Math.min(8, Math.max(0, 65 - state.happiness) * 0.16);
    let rawCrime = Math.round(uncovRatio*42+(1-capRatio)*20+unemployment*17+economy.shortage*18+stress-amenities);
    if (state.mode === "survival" && state.happiness < 50) {
      rawCrime = Math.max(rawCrime, Math.round((55 - state.happiness) * 1.7));
    }
    const nightCrime = Math.round(rawCrime * 1.25 + 4);
    const clamp = (v: number) => Math.max(0, Math.min(100, v - community.crime));
    // Night is 10 of 24 hours; happiness reads the day's average, incidents the current hour.
    m.crimeDaily = Math.round(clamp(rawCrime) * 14 / 24 + clamp(nightCrime) * 10 / 24);
    m.crimeRate = clamp(night ? nightCrime : rawCrime);
  } else {
    m.crimeRate = 0;
    m.crimeDaily = 0;
  }

  if(m.crimeUnlocked){const held=effective(state,"crime",m.crimeRate);if(held!==m.crimeRate)m.crimeDaily=held;m.crimeRate=held;}
  // Deterrence grows with the square root of population: ≈4.7k at 500k (4 Lv.5 bases), ≈13k at 3.8M.
  m.requiredDefensePower = Math.round(200 + 220 * m.stageAttackSeverity + 6 * Math.sqrt(Math.max(0, state.population)));
  if (m.defenseUnlocked) {
    m.defenseRating = Math.max(
      0,
      Math.min(100, Math.round((m.defensePower / m.requiredDefensePower) * 100)),
    );
  } else {
    m.defenseRating = 100;
  }

  if(m.defenseUnlocked)m.defenseRating=effective(state,"defense",m.defenseRating);
  const ledger = economyOf(state);
  m.grossIncomePerTick = Math.round(ledger.report.tax*10)/10;
  m.upkeepPerTick = Math.round(upkeepSum * 10) / 10;
  m.netIncomePerTick = Math.round((ledger.report.treasuryNet ?? -m.upkeepPerTick*.06)*10)/10;
  m.renewablePct = m.powerSupply > 0 ? Math.round((renewableOut / m.powerSupply) * 100) : 0;
  m.landValueAvg = m.connectedHouses > 0 ? Math.round((landValueSum / m.connectedHouses) * 100) / 100 : 0.5;
  {
    let pSum = 0;
    let pN = 0;
    for (const el of elements) {
      const d = ELEMENT_BY_ID[el.defId];
      if (!d || d.isNetwork || d.passiveNature) continue;
      pSum += Math.max(0, el.pollution ?? 0);
      pN += 1;
    }
    m.pollutionAvg = pN ? Math.round((pSum / pN) * 10) / 10 : 0;
  }

  // 5. Compute Happiness & Diagnostics ("What's Missing?")
  const diags: AdvisorDiagnostic[] = [];
  let happiness = 100;

  if (m.disconnectedBuildings > 0) {
    diags.push({
      id: "disconnected",
      severity: "warning",
      title: `${m.disconnectedBuildings} Unconnected Building${m.disconnectedBuildings > 1 ? "s" : ""}`,
      detail: "Houses and services only operate when linked by road to at least one other building.",
      fixHint: "Build Roads touching both your Houses and workplaces/utilities.",
    });
  }

  if (unportedVessels > 0) {
    diags.push({
      id: "no_port",
      severity: "warning",
      title: `${unportedVessels} Vessel${unportedVessels > 1 ? "s" : ""} Without a Home Port`,
      detail: "Boats and ships only earn, patrol and defend when a Dock, Shipyard or Naval Base is nearby.",
      fixHint: "Build a Dock (or a Naval Base for warships) on the coast within a few tiles of your fleet.",
    });
  }

  if (m.connectedHouses === 0) {
    diags.push({
      id: "no_homes",
      severity: "info",
      title: "No Connected Homes Yet",
      detail: "Your island starts at 0 population and 100% happiness.",
      fixHint: "Place a House, a Road, and a Business or Utility touching the road to welcome your first 5 citizens!",
    });
  } else {
    const checkNeed = (
      id: string,
      label: string,
      supply: number,
      demand: number,
      maxPenalty: number,
      fixHint: string,
    ) => {
      if (demand <= 0 || supply >= demand) return;
      const deficitRatio = (demand - supply) / demand;
      // Rounding at the population cap leaves a sliver of shortage; ignore anything within 1%.
      if (deficitRatio <= 0.01) return;
      const pen = Math.max(3, Math.round(deficitRatio * maxPenalty));
      happiness -= pen;
      diags.push({
        id,
        severity: pen >= 12 ? "critical" : "warning",
        title: `${label} Shortage (${supply}/${demand})`,
        detail: `Not enough ${label.toLowerCase()} for all connected homes and businesses.`,
        fixHint,
        deltaHappiness: -pen,
      });
    };

    checkNeed("power", "Power", m.powerSupplySteady, m.powerDemand, 22, m.solarFactor < 0.6 ? `Solar is only at ${Math.round(m.solarFactor * 100)}% (night/clouds) — mix in Wind, Coal, Gas or Nuclear for steady power.` : "Place Solar Panels, Windmills, or Power Plants connected by road.");
    checkNeed("water", "Clean Water", m.waterSupply, m.waterDemand, 24, "Build a Water Plant, Water Tower, or Wells connected to roads.");
    checkNeed("waste", "Garbage Pickup", m.wasteCapacity, m.wasteDemand, 16, "Add a Landfill or Trash Plant (keep a few tiles away from homes!).");
    checkNeed("jobs", "Jobs", m.jobsAvailable, m.jobsNeeded, 18, "Build Businesses, Shops, Farms, or Factories so citizens can work.");
    checkNeed("food", "Food & Groceries", Math.min(m.foodSupply,Math.round(m.foodDemand*(1-ledger.report.shortage))), m.foodDemand, 18, "Connect farms, orchards, gardens or a funded grocer to the affected homes.");
    checkNeed("edu", "Schools & Education", m.educationSupply, m.educationDemand, 13, "Build or upgrade schools so families stay happy.");
    checkNeed("rec", "Parks & Leisure", m.recreationSupply, m.recreationDemand, 12, "Add Parks, Gardens, Plazas, or Landmarks.");

    if (m.govDemand > 0) {
      checkNeed("gov", "Government Services", m.govSupply, m.govDemand, 6, "Stage 3+ requires City Offices, Tax Offices, Courthouses, or Government Buildings.");
    }

    if (m.nuisanceAffectedHomes > 0) {
      const pen = Math.min(22, m.nuisanceAffectedHomes * 5);
      happiness -= pen;
      diags.push({
        id: "nuisance",
        severity: "warning",
        title: `${m.nuisanceAffectedHomes} Home${m.nuisanceAffectedHomes > 1 ? "s" : ""} Breathing Polluted Air`,
        detail: "Smog from factories, coal & gas plants, landfills and big highways drifts into nearby homes (see the Pollution heatmap).",
        fixHint: "Move heavy industry away from homes, or plant trees, parks and gardens as green buffers — they soak up pollution.",
        deltaHappiness: -pen,
      });
    }

    if (m.trafficTrips > 20 && m.congestionDaily > 100) {
      const pen = Math.min(16, Math.round((m.congestionDaily - 100) * 0.12) + 3);
      happiness -= pen;
      diags.push({
        id: "traffic",
        severity: m.congestion >= 160 ? "critical" : "warning",
        title: `Gridlock: Roads at ${m.congestionDaily}% Capacity (daily average)`,
        detail: `${m.trafficTrips.toLocaleString()} trips this hour vs ${m.trafficCapacity.toLocaleString()} capacity. Jammed shops earn 25% less. Rush hours (8am & 6pm) are worst.`,
        fixHint: "Widen the busiest corridor or start a bus, train or ferry line serving nearby homes and jobs.",
        deltaHappiness: -pen,
      });
    }

    if (m.crimeUnlocked && m.crimeDaily > 12) {
      const pen = Math.round(m.crimeDaily * 0.28);
      happiness -= pen;
      diags.push({
        id: "crime",
        severity: m.crimeRate >= 45 ? "critical" : "warning",
        title: m.isNightCrimeSurge
          ? `Nighttime Crime Surge (${m.crimeRate}%)`
          : `Crime Rate at ${m.crimeRate}%`,
        detail: m.isNightCrimeSurge
          ? "Crime escalates at night! Neighborhoods outside Police patrol radius face frequent burglaries."
          : "Neighborhoods outside Police patrol radius experience rising crime.",
        fixHint: "Build Police Departments, Precincts, or Jails so their blue radius covers your homes.",
        deltaHappiness: -pen,
      });
    }

    if (m.defenseUnlocked && m.defenseRating < 75) {
      // Without raids (real mode) weak deterrence is a worry, not a crisis.
      const pen = Math.min(state.mode === "survival" ? 19 : 8, Math.round((75 - m.defenseRating) * 0.25));
      happiness -= pen;
      diags.push({
        id: "defense",
        severity: m.defenseRating < 40 ? "critical" : "warning",
        title: `National Defense Weak (${m.defenseRating}%)`,
        detail: "Stage 10+ nations need strong military deterrence.",
        fixHint: "Build Military Bases, Naval Bases, Airforce Bases, or Naval Vessels.",
        deltaHappiness: -pen,
      });
    }

    if (state.mode === "survival" && m.disrepairCount > 0) {
      const pen = Math.min(20, 2 * m.disrepairCount);
      happiness -= pen;
      diags.push({
        id: "disrepair",
        severity: pen >= 14 ? "critical" : "warning",
        title: `${m.disrepairCount} Building${m.disrepairCount > 1 ? "s" : ""} Need Maintenance`,
        detail: "In Survival Mode, service buildings need paid maintenance every few active minutes.",
        fixHint: "Click buildings with an amber wrench, press 'Maintain All', or turn on auto-maintenance.",
        deltaHappiness: -pen,
      });
    }

    if (m.burningCount > 0) {
      const pen = Math.min(35, m.burningCount * 9);
      happiness -= pen;
      diags.push({
        id: "fire",
        severity: "critical",
        title: `${m.burningCount} Building${m.burningCount > 1 ? "s" : ""} On Fire!`,
        detail: "Active fires rapidly drive away citizens and disable buildings.",
        fixHint: "Dispatch a crew by road or water, and supply water at the scene.",
        deltaHappiness: -pen,
      });
    }

    // Bonus for abundant parks, landmarks & faith
    if (m.recreationSupply > m.recreationDemand * 1.6 && m.connectedHouses > 0) {
      happiness += 5;
    }
    // Beautiful, valuable neighbourhoods make people happier
    if (m.landValueAvg >= 1.0) happiness += Math.min(6, Math.round((m.landValueAvg - 0.9) * 10));
  }

  if (m.connectedHouses && ledger.report.harvest > 0) {
    happiness += Math.min(3, Math.round(3 * Math.min(1, ledger.report.harvest / Math.max(1, ledger.report.required))));
  }
  const preschoolSeats=elements.reduce((n,el)=>n+(el.defId==="preschool"&&el.connected&&!el.onFire&&!el.disrepair?30*levelMultiplier("output",el.level):0),0);
  happiness += community.happiness + (activeBlessing(state) === "joy" ? 6 : 0);
  happiness = Math.min(100, happiness+4*Math.min(1,preschoolSeats/Math.max(1,state.population*.16)));
  if (authorized && state.population > 0) {
    const administration = Math.min(3, Math.max(1, Math.ceil(m.govSupply / state.population)));
    happiness -= administration;
    diags.push({id:"administration",severity:"info",title:"Cost of civic administration",
      detail:"A staffed government authorizes fire, police and defense services.",
      fixHint:"Keep the offices connected to workers.", deltaHappiness:-administration});
  }
  if (state.mode !== "god" && m.connectedHouses > 0) {
    const rate = taxRateOf(state), mood = Math.round(taxHappiness(rate));
    happiness += mood;
    if (mood) diags.push({ id: "tax", severity: mood < 0 ? "warning" : "info", title: `Tax rate ${rate}%`,
      detail: mood < 0 ? "Taxes above 15% make residents unhappy and more likely to leave." : "Low taxes keep residents content.",
      fixHint: "Raise taxes for revenue or lower them for happiness (15% is neutral).", deltaHappiness: mood });
  }
  const limit = m.populationLimiter;
  if (m.connectedHouses > 0 && state.population >= 0.97 * limit.cap) {
    const label = LIMITER_LABELS[limit.limitingNeed];
    diags.push({ id: "growth_limit", severity: "info", title: `Growth limited by ${label.name}`,
      detail: `Population ${state.population.toLocaleString()} / ${limit.cap.toLocaleString()}. ${label.name} supports no more residents.`,
      fixHint: label.fix });
  }
  if (m.groundwaterPlants > 0) diags.push({ id: "groundwater", severity: "info",
    title: `${m.groundwaterPlants} Water Plant${m.groundwaterPlants > 1 ? "s" : ""} on Groundwater`,
    detail: "No river reaches these treatment plants, so they pump groundwater at 50% output.",
    fixHint: "Route a river or canal to the plant to restore full output." });
  if (m.recoveringBuildings > 0) diags.push({ id: "fire_recovery", severity: "info",
    title: `${m.recoveringBuildings} Burned Building${m.recoveringBuildings > 1 ? "s" : ""} at 25%`,
    detail: "Fire-damaged buildings work at a quarter of their output while crews repair them (about a minute).",
    fixHint: "Click Maintain on a damaged building to repair it now." });
  state.happiness = Math.round(effective(state,"happiness",Math.max(0,Math.min(100,happiness))));
  checkAchievements(state, m);

  if (!diags.some(d => d.severity === "warning" || d.severity === "critical") && m.connectedHouses > 0) {
    diags.push({
      id: "thriving",
      severity: "good",
      title: "Civilization Thriving!",
      detail: "All citizen utilities, workplaces, groceries, schools, and parks are well balanced.",
      fixHint: "Keep homes supplied and upgrade productive sites to welcome more neighbors.",
    });
  }

  if(ledger.recovery>0)diags.push({id:"recovery",severity:"warning",title:"Population recovery period",detail:Math.ceil(360-ledger.recovery)+" active seconds remain to regain the stage benchmark.",fixHint:"Restore housing, paid work and food access."});
  if(state.highestStageReached===3)diags.push({id:"fire_preparation",severity:"info",title:"Boomtown fire service",detail:"Routine fire calls begin after settling into Stage 4.",fixHint:"Site a fire department with staffed government, road access and a water supply."});
  state.metrics = m;
  state.diagnostics = diags;
}

function checkAchievements(state: GameState, m: CityMetrics): void {
  if (!Array.isArray(state.achievements)) state.achievements = [];
  const have = new Set(state.achievements);
  const els = state.elements;
  const count = (pred: (e: PlacedElement) => boolean) => els.reduce((n, e) => n + (pred(e) ? 1 : 0), 0);
  const tests: Record<string, () => boolean> = {
    first_citizens: () => state.population > 0,
    pop_1k: () => state.population >= 1_000,
    pop_100k: () => state.population >= 100_000,
    pop_1m: () => state.population >= 1_000_000,
    legendary: () => els.some((e) => e.level >= 5),
    five_legends: () => count((e) => e.level >= 5) >= 5,
    bridge_builder: () =>
      els.some((e) => {
        const d = ELEMENT_BY_ID[e.defId];
        return Boolean(d && (d.archetype === "bridge_span" || d.archetype === "bridge_suspension") && (e.overWater || getTileTerrainKind(e.gx, e.gz, state) !== "land"));
      }),
    skyline: () => count((e) => e.defId === "skyscrapers") >= 5,
    green_grid: () => m.powerSupply >= 200 && m.renewablePct >= 80,
    synergist: () => m.synergyCount >= 25,
    free_flow: () => m.trafficTrips >= 100 && m.congestion < 40,
    clean_air: () => count((e) => !ELEMENT_BY_ID[e.defId]?.isNetwork && !ELEMENT_BY_ID[e.defId]?.passiveNature) >= 30 && m.pollutionAvg <= 0.15,
    prime_real_estate: () => m.connectedHouses >= 5 && m.landValueAvg > 1.2,
    transit_city: () => m.trafficTrips >= 60 && m.transitShare >= 40,
    wonder: () => els.some((e) => e.level >= 5 && ELEMENT_BY_ID[e.defId]?.category === "landmarks"),
    admiral: () => els.some((e) => e.defId === "aircraft_carriers"),
    happy_place: () => state.mode !== "god" && state.happiness >= 100 && state.population >= 5_000,
    tycoon: () => state.mode !== "god" && state.money >= 1_000_000,
  };
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    const t = tests[a.id];
    if (t && t()) {
      state.achievements.push(a.id);
      pushToast(state, "stage", `${a.emoji} Achievement: ${a.title}`, a.detail);
    }
  }
}

/**
 * Advances simulation by `dtSec` (scaled by speed), respecting tab visibility for Survival timers.
 */
interface DefenderContribution {
  soldiers: number;
  tanks: number;
  boats: number;
  cops: number;
  swat: number;
  hasCopCars: boolean;
  hasSwatCars: boolean;
}

function getElementDefenderContribution(el: PlacedElement,state:GameState): DefenderContribution | null {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def || el.onFire || !el.connected) return null;
  const lvScale = levelMultiplier("reach", el.level);
  const health = el.disrepair ? 0.45 : 1.0;
  const staff=professionalStaff(state,el);
  if((def.jobs??0)>0&&staff<1)return null;
  const staffing=(def.jobs??0)>0?Math.min(1,staff/Math.max(1,(def.jobs??0)*.35)):1;
  const supply=state.metrics.powerSupply>=state.metrics.powerDemand&&state.metrics.waterSupply>=state.metrics.waterDemand?1:.55;
  const m=lvScale*health*staffing*supply;

  switch (el.defId) {
    case "military_base":
      return {
        soldiers: Math.max(1, Math.round(12 * m)),
        tanks: Math.max(1, Math.round(2 * m)),
        boats: 0,
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "airforce_base":
      return {
        soldiers: Math.max(1, Math.round(10 * m)),
        tanks: Math.max(1, Math.round(2 * m)),
        boats: 0,
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "naval_base":
    case "submarine_base":
      return {
        soldiers: Math.max(1, Math.round(4 * m)),
        tanks: 0,
        boats: Math.max(1, Math.round(3 * m)),
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "naval_vessels":
    case "submarines":
      return {
        soldiers: 0,
        tanks: 0,
        boats: Math.max(1, Math.round(2 * m)),
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "aircraft_carriers":
      return {
        soldiers: Math.max(1, Math.round(6 * m)),
        tanks: 0,
        boats: Math.max(2, Math.round(4 * m)),
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "shipyards":
      return {
        soldiers: 0,
        tanks: 0,
        boats: Math.max(1, Math.round(1 * m)),
        cops: 0,
        swat: 0,
        hasCopCars: false,
        hasSwatCars: false,
      };
    case "white_house":
      return {
        soldiers: Math.max(1, Math.round(6 * m)),
        tanks: 0,
        boats: 0,
        cops: 0,
        swat: Math.max(1, Math.round(4 * m)),
        hasCopCars: false,
        hasSwatCars: true,
      };
    case "swat_team_hq":
      return {
        soldiers: 0,
        tanks: 0,
        boats: 0,
        cops: 0,
        swat: Math.max(1, Math.round(6 * m)),
        hasCopCars: false,
        hasSwatCars: true,
      };
    case "police_departments":
      return {
        soldiers: 0,
        tanks: 0,
        boats: 0,
        cops: Math.max(1, Math.round(6 * m)),
        swat: 0,
        hasCopCars: true,
        hasSwatCars: false,
      };
    case "police_precinct":
      return {
        soldiers: 0,
        tanks: 0,
        boats: 0,
        cops: Math.max(1, Math.round(3 * m)),
        swat: 0,
        hasCopCars: true,
        hasSwatCars: false,
      };
    case "prisons":
      return {
        soldiers: 0,
        tanks: 0,
        boats: 0,
        cops: Math.max(1, Math.round(4 * m)),
        swat: 0,
        hasCopCars: true,
        hasSwatCars: false,
      };
    case "jails":
    case "courthouses":
      return {
        soldiers: 0,
        tanks: 0,
        boats: 0,
        cops: Math.max(1, Math.round(2 * m)),
        swat: 0,
        hasCopCars: el.defId === "jails",
        hasSwatCars: false,
      };
    default:
      if (def.military && def.military > 0) {
        return {
          soldiers: Math.max(1, Math.round((def.military / 30) * m)),
          tanks: 0,
          boats: 0,
          cops: 0,
          swat: 0,
          hasCopCars: false,
          hasSwatCars: false,
        };
      }
      return null;
  }
}

function aggregateDefenseRoster(state: GameState): {
  soldiersCount: number;
  tanksCount: number;
  navalBoatsCount: number;
  copsCount: number;
  swatCount: number;
  totalDefenders: number;
  weightedPower: number;
} {
  let soldiersCount = 0;
  let tanksCount = 0;
  let navalBoatsCount = 0;
  let copsCount = 0;
  let swatCount = 0;

  const staffedGov = hasAuthority(state);
  for (const el of state.elements) {
    const c = staffedGov ? getElementDefenderContribution(el,state) : null;
    if (!c) continue;
    soldiersCount += c.soldiers;
    tanksCount += c.tanks;
    navalBoatsCount += c.boats;
    copsCount += c.cops;
    swatCount += c.swat;
  }

  // Military dominates readiness; Police & SWAT help a bit comparatively
  const weightedPower =
    soldiersCount * 14 +
    tanksCount * 55 +
    navalBoatsCount * 65 +
    swatCount * 6 +
    copsCount * 2;

  return {
    soldiersCount,
    tanksCount,
    navalBoatsCount,
    copsCount,
    swatCount,
    totalDefenders: soldiersCount + tanksCount + navalBoatsCount + copsCount + swatCount,
    weightedPower,
  };
}

function computeDefensePower(state: GameState): number {
  return Math.round(aggregateDefenseRoster(state).weightedPower);
}

export function launchIslandAttack(state: GameState, severityInput = 1, random = Math.random): void {
  if (state.activeAttack) return;
  if (repelInvasion(state, random)) {
    pushToast(state, "stage", BLESSINGS.protection.name, BLESSINGS.protection.detail);
    return;
  }
  evacuate(state);
  // Real & Survival preset severity based on Stage (10..20 -> 1.0..5.0)
  const stagePreset = Math.max(
    1,
    Math.min(5, 1 + Math.max(0, state.highestStageReached - 10) * 0.4),
  );
  const severity =
    state.mode === "god"
      ? Math.max(0.5, Math.min(5, severityInput))
      : stagePreset;

  const units: AttackUnit[] = [];
  const shipsCount = Math.max(1, Math.round(1.5 + severity * 1.4));
  const tanksCount = Math.max(2, Math.round(1.5 + severity * 1.8));
  const soldiersCount = Math.max(4, Math.round(3 + severity * 3.4));

  const targets = state.elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return d && !d.isNetwork && !d.passiveNature && !isSanctuary(e);
  });

  const pickTargetId = () =>
    targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;

  // Pick a random coastal direction for invasion
  const baseAngle = Math.random() * Math.PI * 2;
  const enemyHpScale = 0.8 + severity * 0.22;

  for (let i = 0; i < shipsCount; i++) {
    const ang = baseAngle + (i - shipsCount * 0.5) * 0.22;
    const dist = 122 + Math.random() * 18;
    const hp = Math.round(85 * enemyHpScale);
    units.push({
      id: `atk_ship_${Date.now()}_${i}`,
      kind: "ship",
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      targetElementId: pickTargetId(),
      hp,
      maxHp: hp,
      fireCooldown: 1.5 + Math.random() * 2,
    });
  }

  for (let i = 0; i < tanksCount; i++) {
    const ang = baseAngle + (i - tanksCount * 0.5) * 0.2;
    const dist = 94 + Math.random() * 10;
    const hp = Math.round(65 * enemyHpScale);
    units.push({
      id: `atk_tank_${Date.now()}_${i}`,
      kind: "tank",
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      targetElementId: pickTargetId(),
      hp,
      maxHp: hp,
      fireCooldown: 1.2 + Math.random() * 1.5,
    });
  }

  for (let i = 0; i < soldiersCount; i++) {
    const ang = baseAngle + (Math.random() - 0.5) * 0.85;
    const dist = 88 + Math.random() * 14;
    const hp = Math.round(25 * enemyHpScale);
    units.push({
      id: `atk_sol_${Date.now()}_${i}`,
      kind: "soldier",
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      targetElementId: pickTargetId(),
      hp,
      maxHp: hp,
      fireCooldown: 0.8 + Math.random() * 1.2,
    });
  }

  // Spawn animated defenders directly from placed Military, Naval, Police & SWAT elements!
  const defenders: DefenseUnit[] = [];
  let defSeq = 0;
  const pushDef = (
    kind: DefenseUnitKind,
    x: number,
    z: number,
    originElementId: string,
    hp: number,
    damage: number,
    speed: number,
  ) => {
    defSeq += 1;
    defenders.push({
      id: `def_${kind}_${Date.now()}_${defSeq}`,
      kind,
      x,
      z,
      originElementId,
      targetUnitId: null,
      hp,
      maxHp: hp,
      damage,
      fireCooldown: Math.random() * 0.9,
      speed,
    });
  };

  let spawnedSol = 0;
  let spawnedTank = 0;
  let spawnedBoat = 0;
  let spawnedCop = 0;
  let spawnedCopCar = 0;
  let spawnedSwat = 0;
  let spawnedSwatCar = 0;

  const staffedGov = hasAuthority(state);
  for (const el of state.elements) {
    const c = staffedGov ? getElementDefenderContribution(el,state) : null;
    if (!c) continue;
    const [bx, bz] = gridToWorldCenter(el.gx, el.gz, el.spanX, el.spanZ);
    const perimeterDist = Math.max(el.spanX, el.spanZ) * TILE_SIZE * 0.5 + 0.85;
    const spawnOutside = (): [number, number] => {
      const ang = Math.random() * Math.PI * 2;
      return pushOutsideSolidBuildings(
        state,
        bx + Math.cos(ang) * perimeterDist,
        bz + Math.sin(ang) * perimeterDist,
        0.55,
      );
    };

    for (let i = 0; i < c.tanks && spawnedTank < 8; i++) {
      spawnedTank += 1;
      const [sx, sz] = spawnOutside();
      pushDef("tank", sx, sz, el.id, 130, 32, 7.2);
    }
    for (let i = 0; i < Math.min(4, c.soldiers) && spawnedSol < 18; i++) {
      spawnedSol += 1;
      const [sx, sz] = spawnOutside();
      pushDef("soldier", sx, sz, el.id, 48, 16, 9.0);
    }
    for (let i = 0; i < c.boats && spawnedBoat < 8; i++) {
      spawnedBoat += 1;
      const bAng = baseAngle + (spawnedBoat - 2) * 0.3;
      const bDist = 104 + Math.random() * 6;
      pushDef("boat", Math.cos(bAng) * bDist, Math.sin(bAng) * bDist, el.id, 140, 36, 6.4);
    }
    if (c.hasSwatCars && spawnedSwatCar < 4) {
      spawnedSwatCar += 1;
      const [sx, sz] = spawnOutside();
      pushDef("swat_car", sx, sz, el.id, 65, 11, 10.5);
    }
    for (let i = 0; i < Math.min(2, c.swat) && spawnedSwat < 8; i++) {
      spawnedSwat += 1;
      const [sx, sz] = spawnOutside();
      pushDef("swat", sx, sz, el.id, 34, 7, 8.6);
    }
    if (c.hasCopCars && spawnedCopCar < 5) {
      spawnedCopCar += 1;
      const [sx, sz] = spawnOutside();
      pushDef("cop_car", sx, sz, el.id, 42, 6, 10.2);
    }
    for (let i = 0; i < Math.min(2, c.cops) && spawnedCop < 8; i++) {
      spawnedCop += 1;
      const [sx, sz] = spawnOutside();
      pushDef("cop", sx, sz, el.id, 24, 4, 8.2);
    }
  }

  const defPower = computeDefensePower(state);
  state.activeAttack = {
    id: `atk_${Date.now()}`,
    startedAt: Date.now(),
    elapsedSec: 0,
    initialExposed: Math.max(0, state.population - (state.faith?.sheltered ?? 0)),
    severity,
    units,
    defenders,
    totalUnitsSpawned: units.length,
    unitsDefeated: 0,
    buildingsDestroyed: 0,
    casualties: 0,
    defensePower: defPower,
    defenseCooldown: 1.4,
  };

  pushToast(
    state,
    "raid",
    `Severity ${severity.toFixed(1)} Invasion Incoming!`,
    defenders.length > 0
      ? `${shipsCount} Ships, ${tanksCount} Tanks & ${soldiersCount} Soldiers vs ${defenders.length} active defenders!`
      : `${shipsCount} Ships, ${tanksCount} Tanks & ${soldiersCount} Soldiers landing — NO DEFENDERS!`,
  );
}

function pushOutsideSolidBuildings(
  state: GameState,
  px: number,
  pz: number,
  margin = 0.5,
): [number, number] {
  let x = px;
  let z = pz;
  for (let pass = 0; pass < 2; pass++) {
    for (const el of state.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      if (!def || def.isNetwork || def.passiveNature || def.domain !== "land") continue;
      const minX = el.gx * TILE_SIZE - margin;
      const maxX = (el.gx + el.spanX) * TILE_SIZE + margin;
      const minZ = el.gz * TILE_SIZE - margin;
      const maxZ = (el.gz + el.spanZ) * TILE_SIZE + margin;
      if (x > minX && x < maxX && z > minZ && z < maxZ) {
        const dLeft = x - minX;
        const dRight = maxX - x;
        const dTop = z - minZ;
        const dBot = maxZ - z;
        const m = Math.min(dLeft, dRight, dTop, dBot);
        if (m === dLeft) x = minX;
        else if (m === dRight) x = maxX;
        else if (m === dTop) z = minZ;
        else z = maxZ;
      }
    }
  }
  return [x, z];
}

function moveGroundUnitAroundBuildings(
  state: GameState,
  x: number,
  z: number,
  dx: number,
  dz: number,
  dist: number,
  step: number,
  margin: number,
): [number, number] {
  const dirX = dx / Math.max(0.001, dist);
  const dirZ = dz / Math.max(0.001, dist);
  const candX = x + dirX * step;
  const candZ = z + dirZ * step;
  const [px, pz] = pushOutsideSolidBuildings(state, candX, candZ, margin);
  // If straight line pushed us sideways against a wall, also bias a slight tangential slide around it
  if (Math.hypot(px - candX, pz - candZ) > 0.05) {
    const perpX = -dirZ;
    const perpZ = dirX;
    const sign = Math.sign((px - candX) * perpX + (pz - candZ) * perpZ) || 1;
    return pushOutsideSolidBuildings(
      state,
      px + perpX * sign * step * 0.65,
      pz + perpZ * sign * step * 0.65,
      margin,
    );
  }
  return [px, pz];
}

function stepActiveAttack(state: GameState, dtSec: number): boolean {
  const atk = state.activeAttack;
  if (!atk) return false;
  if (!Array.isArray(atk.defenders)) atk.defenders = [];

  atk.defensePower = computeDefensePower(state);
  let changed = false;

  // Step animated defending units (Soldiers, Tanks, Naval Boats, SWAT & Police)
  for (const defUnit of atk.defenders) {
    if (atk.units.length === 0) break;

    let targetEnemy = atk.units.find((u) => u.id === defUnit.targetUnitId);
    if (!targetEnemy) {
      // Boats prefer ships; ground defenders prefer ground units first (or ships along coast)
      const preferred =
        defUnit.kind === "boat"
          ? atk.units.filter((u) => u.kind === "ship")
          : atk.units.filter((u) => u.kind !== "ship");
      const pool = preferred.length > 0 ? preferred : atk.units;
      let bestDist = Infinity;
      for (const cand of pool) {
        const d = Math.hypot(cand.x - defUnit.x, cand.z - defUnit.z);
        if (d < bestDist) {
          bestDist = d;
          targetEnemy = cand;
        }
      }
      defUnit.targetUnitId = targetEnemy?.id ?? null;
    }

    if (targetEnemy) {
      const dx = targetEnemy.x - defUnit.x;
      const dz = targetEnemy.z - defUnit.z;
      const dist = Math.hypot(dx, dz);
      const engRange =
        defUnit.kind === "boat"
          ? 24
          : defUnit.kind === "tank"
            ? 20
            : defUnit.kind === "cop_car" || defUnit.kind === "swat_car"
              ? 14
              : 11;

      if (dist > engRange) {
        if (defUnit.kind === "boat") {
          const curAng = Math.atan2(defUnit.z, defUnit.x);
          const targAng = Math.atan2(targetEnemy.z, targetEnemy.x);
          const diff = Math.atan2(Math.sin(targAng - curAng), Math.cos(targAng - curAng));
          const nextAng = curAng + Math.sign(diff) * Math.min(Math.abs(diff), dtSec * 0.42);
          const r = 107;
          defUnit.x = Math.cos(nextAng) * r;
          defUnit.z = Math.sin(nextAng) * r;
        } else {
          // Keep land defenders inside plateau edge (~96m) and outside all building walls!
          const step = Math.min(dist - engRange, defUnit.speed * dtSec);
          const margin = defUnit.kind === "tank" || defUnit.kind === "swat_car" || defUnit.kind === "cop_car" ? 0.8 : 0.5;
          const [nextX, nextZ] = moveGroundUnitAroundBuildings(
            state,
            defUnit.x,
            defUnit.z,
            dx,
            dz,
            dist,
            step,
            margin,
          );
          if (targetEnemy.kind !== "ship" || Math.hypot(nextX, nextZ) < 96) {
            defUnit.x = nextX;
            defUnit.z = nextZ;
          }
        }
      } else {
        defUnit.fireCooldown -= dtSec;
        if (defUnit.fireCooldown <= 0) {
          defUnit.fireCooldown =
            defUnit.kind === "tank" || defUnit.kind === "boat" ? 1.5 : 1.15;
          // Heavy bases boost unit punch subtly without cluttering the map
          const scaleBonus = Math.min(2.2, 1 + atk.defensePower / 600);
          targetEnemy.hp -= defUnit.damage * scaleBonus;
          if (targetEnemy.hp <= 0) {
            atk.units = atk.units.filter((u) => u.id !== targetEnemy!.id);
            atk.unitsDefeated += 1;
            defUnit.targetUnitId = null;
          }
          changed = true;
        }
      }
    }
  }

  // Fallback coastal artillery / naval batteries if large bases still have defensePower when spawned squad is trimmed
  if (atk.defensePower > 0 && atk.units.length > 0 && atk.defenders.length === 0) {
    atk.defenseCooldown -= dtSec;
    if (atk.defenseCooldown <= 0) {
      atk.defenseCooldown = Math.max(0.6, 2.2 - Math.min(1.5, atk.defensePower / 240));
      const targetUnit = atk.units[Math.floor(Math.random() * atk.units.length)];
      targetUnit.hp -= Math.max(18, Math.min(75, atk.defensePower * 0.25));
      if (targetUnit.hp <= 0) {
        atk.units = atk.units.filter((u) => u.id !== targetUnit.id);
        atk.unitsDefeated += 1;
      }
      changed = true;
    }
  }

  // Advance enemy units toward island buildings (or intercept nearby defenders)
  atk.initialExposed ??= atk.casualties + Math.max(0, state.population - (state.faith?.sheltered ?? 0));
  const exposed = () => Math.max(0, Math.min(state.population - (state.faith?.sheltered ?? 0), atk.initialExposed! - atk.casualties));
  const buildingPool = state.elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return d && !d.isNetwork && !d.passiveNature && !isSanctuary(e);
  });

  for (const unit of atk.units) {
    // Check if an island defender is close enough to duel
    let nearestDef: DefenseUnit | null = null;
    let nearestDefDist = 18;
    for (const df of atk.defenders) {
      if (unit.kind === "ship" && df.kind !== "boat") continue;
      if (unit.kind !== "ship" && df.kind === "boat") continue;
      const dd = Math.hypot(df.x - unit.x, df.z - unit.z);
      if (dd < nearestDefDist) {
        nearestDefDist = dd;
        nearestDef = df;
      }
    }

    if (nearestDef) {
      unit.fireCooldown -= dtSec;
      if (unit.fireCooldown <= 0) {
        unit.fireCooldown = unit.kind === "ship" ? 2.4 : unit.kind === "tank" ? 1.9 : 1.6;
        const enemyDmg = unit.kind === "ship" ? 24 : unit.kind === "tank" ? 20 : 10;
        nearestDef.hp -= enemyDmg * (0.85 + (atk.severity ?? 1) * 0.12);
        if (nearestDef.hp <= 0) {
          atk.defenders = atk.defenders.filter((d) => d.id !== nearestDef!.id);
        }
        changed = true;
      }
    }

    let targetEl = buildingPool.find((e) => e.id === unit.targetElementId);
    if (!targetEl && buildingPool.length > 0) {
      let bestDist = Infinity;
      for (const cand of buildingPool) {
        const [cx, cz] = gridToWorldCenter(cand.gx, cand.gz, cand.spanX, cand.spanZ);
        const d = Math.hypot(cx - unit.x, cz - unit.z);
        if (d < bestDist) {
          bestDist = d;
          targetEl = cand;
        }
      }
      unit.targetElementId = targetEl?.id ?? null;
    }

    if (targetEl) {
      const [tx, tz] = gridToWorldCenter(targetEl.gx, targetEl.gz, targetEl.spanX, targetEl.spanZ);
      const dx = tx - unit.x;
      const dz = tz - unit.z;
      const dist = Math.hypot(dx, dz);

      const bHalf = Math.max(targetEl.spanX, targetEl.spanZ) * TILE_SIZE * 0.5;
      const stopRange =
        unit.kind === "ship" ? 115 : unit.kind === "tank" ? bHalf + 7.5 : bHalf + 3.5;
      const speed = unit.kind === "ship" ? 3.2 : unit.kind === "tank" ? 6.5 : 8.2;

      if (dist > stopRange) {
        const step = Math.min(dist - stopRange, speed * dtSec);
        if (unit.kind === "ship") {
          const curAng = Math.atan2(unit.z, unit.x);
          const targAng = Math.atan2(tz, tx);
          const diff = Math.atan2(Math.sin(targAng - curAng), Math.cos(targAng - curAng));
          const nextAng = curAng + Math.sign(diff) * Math.min(Math.abs(diff), dtSec * 0.28);
          const r = 114;
          unit.x = Math.cos(nextAng) * r;
          unit.z = Math.sin(nextAng) * r;
        } else {
          const margin = unit.kind === "tank" ? 0.8 : 0.5;
          const [nx, nz] = moveGroundUnitAroundBuildings(
            state,
            unit.x,
            unit.z,
            dx,
            dz,
            dist,
            step,
            margin,
          );
          unit.x = nx;
          unit.z = nz;
        }
      } else if (!nearestDef) {
        unit.fireCooldown -= dtSec;
        if (unit.fireCooldown <= 0) {
          unit.fireCooldown = unit.kind === "ship" ? 3.2 : unit.kind === "tank" ? 2.4 : 2.0;

          const shieldChance =
            atk.defenders.length > 0 ? Math.min(0.65, atk.defensePower / 300) : 0;
          if (Math.random() > shieldChance) {
            const tDef = ELEMENT_BY_ID[targetEl.defId];
            if (!targetEl.onFire) {
              targetEl.onFire = true;
              changed = true;
            } else {
              if (targetEl.level > 1 && Math.random() < 0.38) {
                resizeElementForLevel(state, targetEl, targetEl.level - 1);
                targetEl.animProgress = 0.8;
                targetEl.animKind = "place";
              } else {
                removePlacedElements(state, new Set([targetEl.id]));
                buildingPool.splice(buildingPool.indexOf(targetEl), 1);
                atk.buildingsDestroyed += 1;
                if (tDef?.popBase) {
                  const lost = Math.min(exposed(), tDef.popBase * levelMultiplier("output", targetEl.level));
                  atk.casualties += lost;
                  state.growthPool = Math.max(-state.population, state.growthPool - lost);
                } else if (state.population > 0) {
                  const lost = Math.min(exposed(), 12);
                  atk.casualties += lost;
                  state.growthPool -= lost;
                }
                unit.targetElementId = null;
              }
              changed = true;
            }
          }
        }
      }
    }
  }

  // End invasion automatically once all attackers are defeated OR after timeout if defenders are gone
  const elapsedSec = atk.elapsedSec = (atk.elapsedSec ?? 0) + dtSec;
  if (atk.units.length === 0 || (atk.defenders.length === 0 && (buildingPool.length === 0 || elapsedSec > 34))) {
    const survived = atk.units.length === 0;
    pushToast(
      state,
      "raid",
      survived ? "Invasion Repelled!" : "Invasion Ended",
      survived
        ? `Defenders defeated all ${atk.totalUnitsSpawned} attackers (${atk.buildingsDestroyed} buildings lost).`
        : `${atk.buildingsDestroyed} buildings destroyed · ${atk.casualties.toLocaleString()} citizens lost.`,
    );
    state.activeAttack = null;
    changed = true;
  }

  return changed;
}

const WEATHER_ORDER: WeatherKind[] = ["clear", "cloudy", "rain", "storm"];

export function triggerCrimeIncident(state: GameState, announce = true): boolean {
  if (state.mode === "god" && !state.godCrimeEnabled) return false;
  if (state.mode !== "god" && !state.metrics.crimeUnlocked) return false;
  if (!Array.isArray(state.crimeIncidents)) state.crimeIncidents = [];
  if (state.crimeIncidents.length >= 4) return false;

  let targets = state.elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return (
      e.connected &&
      !e.onFire &&
      (d?.popBase || d?.category === "commerce" || d?.jobs) &&
      !d?.isNetwork &&
      !d?.passiveNature &&
      !state.crimeIncidents.some((c) => c.targetElementId === e.id)
    );
  });

  if (targets.length === 0 && announce) {
    targets = state.elements.filter((e) => {
      const d = ELEMENT_BY_ID[e.defId];
      return (
        !e.onFire &&
        !d?.isNetwork &&
        !d?.passiveNature &&
        !state.crimeIncidents.some((c) => c.targetElementId === e.id)
      );
    });
  }

  if (targets.length === 0) return false;

  // Prefer uncovered homes/businesses first, falling back to any active building
  const uncovered = targets.filter((t) => !t.hasPoliceCover);
  const pool = uncovered.length > 0 ? uncovered : targets;
  const victim = pool[Math.floor(Math.random() * pool.length)];

  // Find nearest police/jail/swat station to dispatch a cruiser!
  const policeStations = state.elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return hasAuthority(state) && e.connected && !e.onFire && !e.disrepair && professionalStaff(state,e)>=1 && (d?.policeRadius ?? 0) > 0;
  });
  const dispatch=findPatrolDispatch(state,policeStations,victim);
  const nearestPolice=dispatch?.station;

  state.crimeIncidents.push({
    id: `crm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    targetElementId: victim.id,
    targetGx: victim.gx,
    targetGz: victim.gz,
    policeOriginId: nearestPolice?.id ?? null,
    policeRoute: dispatch?.path,
    policeTravel: 0,
    policeGx: nearestPolice?.gx ?? null,
    policeGz: nearestPolice?.gz ?? null,
    progressSec: 0,
    maxSec: nearestPolice ? 12.5 : 9.0,
    policeArrived: false,
  });

  if (announce) {
    const vDef = ELEMENT_BY_ID[victim.defId];
    pushToast(
      state,
      "alert",
      `Break-In at ${vDef?.name ?? "Building"}!`,
      nearestPolice
        ? "Police cruiser & officer dispatched to intercept the burglar!"
        : "No Police nearby — burglar is looting the neighborhood!",
    );
  }
  return true;
}

export function stepSimulation(state: GameState, dtSec: number, isTabVisible: boolean): boolean {
  if (state.gameOver) return false;
  let dirty = false;

  // Decay placement/merge animations smoothly
  for (const el of state.elements) {
    if (el.animProgress > 0) {
      el.animProgress = Math.max(0, el.animProgress - dtSec * 1.9);
    }
  }

  // Prune old toasts (> 8s)
  const now = Date.now();
  if (state.toasts.some((t) => now - t.createdAt > 8500)) {
    state.toasts = state.toasts.filter((t) => now - t.createdAt <= 8500);
    dirty = true;
  }

  if (!isTabVisible) return dirty;
  const previousBlessing = activeBlessing(state);
  state.activePlaySec += dtSec;
  const blessing = advanceFaith(state);
  if (blessing) pushToast(state, "stage", BLESSINGS[blessing].name, BLESSINGS[blessing].detail);
  if (blessing || previousBlessing !== activeBlessing(state)) dirty = true;
  advanceReservoirs(state,dtSec);
  if (stepMobility(state, dtSec)) dirty = true;

  // Rolling stat history (every 6 s of play, last 150 samples ≈ 15 min)
  state.historyTimerSec = (state.historyTimerSec ?? 0) + dtSec;
  if (state.historyTimerSec >= 6) {
    dirty = true;
    state.historyTimerSec %= 6;
    const hist = Array.isArray(state.history) ? state.history : [];
    hist.push({
      t: Math.round(state.activePlaySec),
      pop: state.population,
      money: Math.round(state.money),
      wealth: Math.round(cityWealth(state)),
      happy: state.happiness,
    });
    state.history = hist.length > 150 ? hist.slice(hist.length - 150) : hist;
  }

  // 0. Day/Night Cycle (respecting timeLocked) & Weather Cycle (respecting weatherLocked)
  if (!state.timeLocked) {
    const prevNight = isNightTime(state.timeOfDay ?? 10.5);
    state.timeOfDay = ((state.timeOfDay ?? 10.5) + dtSec * 0.2) % 24;
    const nowNight = isNightTime(state.timeOfDay);
    if (prevNight !== nowNight) {
      dirty = true;
    }
  }

  if (!state.weatherLocked) {
    state.weatherTimerSec = (state.weatherTimerSec ?? 50) - dtSec;
    if (state.weatherTimerSec <= 0) {
      state.weatherTimerSec = 42 + Math.random() * 28;
      const roll = Math.random();
      let nextWeather: WeatherKind = "clear";
      if (roll < 0.45) nextWeather = "clear";
      else if (roll < 0.72) nextWeather = "cloudy";
      else if (roll < 0.9) nextWeather = "rain";
      else nextWeather = "storm";
      if (nextWeather !== state.weather) {
        state.weather = nextWeather;
        dirty = true;
      }
      // Outside the sandbox the wind follows the weather instead of a slider.
      if (state.mode !== "god") {
        const base = nextWeather === "storm" ? 1.8 : nextWeather === "rain" ? 1.3 : nextWeather === "cloudy" ? 1.05 : 0.85;
        state.windSpeed = Math.round((base + (Math.random() - 0.5) * 0.4) * 100) / 100;
      }
    }
  }

  // Active Invasion (God Mode manual attack OR Survival raid)
  if (state.activeAttack) {
    if (stepActiveAttack(state, dtSec)) {
      dirty = true;
    }
  }

  // Active Crime Incidents & Police Car Dispatch (strictly gated by crimeUnlocked)
  if (!Array.isArray(state.crimeIncidents)) state.crimeIncidents = [];
  if (!state.metrics.crimeUnlocked) {
    if (state.crimeIncidents.length > 0) {
      state.crimeIncidents = [];
      dirty = true;
    }
  } else {
    for (let i = state.crimeIncidents.length - 1; i >= 0; i--) {
      const inc = state.crimeIncidents[i];
      inc.progressSec += dtSec;
      if (advancePatrol(state,inc,dtSec)) dirty = true;
      if (inc.progressSec >= inc.maxSec) {
        if (inc.policeArrived) {
          transfer(state,"businesses","treasury",25,"Recovered local funds");
        } else {
          transfer(state,"businesses","outside",35,"Stolen goods");
          state.growthPool -= 3;
        }
        state.crimeIncidents.splice(i, 1);
        dirty = true;
      }
    }

    const nightNow = isNightTime(state.timeOfDay);
    if ((state.metrics.crimeRate > 2 || nightNow) && state.crimeIncidents.length < 3) {
      state.crimeCooldownSec = (state.crimeCooldownSec ?? 5) - dtSec;
      if (state.crimeCooldownSec <= 0) {
        const nightBoost = nightNow ? 0.5 : 1.0;
        state.crimeCooldownSec = Math.max(4.5, (16 - state.metrics.crimeRate * 0.11) * nightBoost);
        if (triggerCrimeIncident(state, false)) {
          dirty = true;
        }
      }
    }
  }

  // 1. Survival Mode active maintenance timers (first deadline staggered over 180–360 s)
  if (state.mode === "survival") {
    for (const el of state.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      if (!def?.needsMaintenance || !el.connected) continue;
      if (!el.maintStaggered) {
        el.maintStaggered = true;
        if (el.maintTimerSec === 0) el.maintTimerSec = MAINTENANCE_INTERVAL_SEC - (180 + (hashId(el.id) % 181));
      }
      el.maintTimerSec += dtSec;
      if (el.maintTimerSec >= MAINTENANCE_INTERVAL_SEC && !el.disrepair) {
        const autoPrice = maintenancePrice(el) * 1.25;
        if (state.autoMaintain && state.money >= autoPrice) {
          transfer(state, "treasury", "outside", autoPrice, "Automatic maintenance");
          el.maintTimerSec = 0;
        } else el.disrepair = true;
        dirty = true;
      }
    }
  } else {
    // Real and god mode: crews repair fire damage on their own within a minute.
    for (const el of state.elements) {
      if (!el.disrepair || el.onFire) { if (el.repairTimerSec) el.repairTimerSec = 0; continue; }
      el.repairTimerSec = (el.repairTimerSec ?? 0) + dtSec;
      if (el.repairTimerSec >= 60) {
        el.disrepair = false;
        el.repairTimerSec = 0;
        dirty = true;
      }
    }
  }

  if (advanceEconomy(state,dtSec)) dirty = true;
  if (advanceOperations(state,dtSec)) dirty = true;

  // 4. Survival Mode Stage 10+ Periodic Attacks / Raids (launches animated invasion!)
  if (state.mode === "survival" && state.highestStageReached >= 10 && !state.activeAttack) {
    state.raidCooldownSec -= dtSec;
    if (state.raidCooldownSec <= 0) {
      state.raidCooldownSec = 85;
      launchIslandAttack(state, 1.0);
      dirty = true;
    }
  }

  // 5. Treasury income & Population growth / emigration
  if (state.metrics.connectedHouses > 0) {
    const economy = economyOf(state).report;

    const m=state.metrics;
    // The same housing base and service cap the metrics report (see populationLimiterFor).
    const baseHousingPop = m.housingBase;
    const essentialDeficit = Math.max(economy.shortage, economy.utilityStrain ?? 0);
    const supplied = m.populationLimiter.cap;
    const directedMood=state.mode==="god" && [...economyOf(state).holds,...economyOf(state).once].some(setting=>setting.key==="happiness");
    if(state.mode==="god" && !effective(state,"stageRules",0) && !(directedMood&&state.happiness<65)){
      // Open the first homes quickly. Large settlements grow toward the services this city actually built.
      const welcoming=Math.max(baseHousingPop+Math.min(80,baseHousingPop*1.4),supplied*.97);
      const room=Math.max(0,Math.min(economy.capacity,welcoming)-state.population);
      const arrival=Math.min(room,Math.max(3,baseHousingPop*.55)*dtSec);
      if(arrival>0){state.growthPool+=arrival;dirty=true;}
    } else if (state.happiness >= 68 && essentialDeficit <= 0.35 && state.metrics.burningCount === 0) {
      // Smooth thriving growth toward neighborhood settlement capacity
      const happyFactor = Math.max(.15,(state.happiness - 58) / 42);
      const employed = Math.min(1,economy.reachable/Math.max(1,economy.workers));
      const growthRate = Math.max(1.2,baseHousingPop*.36)*happyFactor*(.18+.82*employed)*(1-.8*economy.shortage);
      // Prospective households compare the work, groceries and sanitation they can actually reach.
      const supported=supplied;
      const arrivals=Math.min(Math.max(0,supported-state.population),growthRate*dtSec);
      if(arrivals>0){state.growthPool+=arrivals;dirty=true;}
    } else if (state.happiness < 65 || essentialDeficit > 0.35) {
      // Happiness below 65%: citizens leave slowly (or rapidly if < 50% in Survival / fires active!)
      const severity = Math.max(0, (65 - state.happiness) / 65);
      const fireAccel = state.mode === "survival" && (state.happiness < 50 || state.metrics.burningCount > 0) ? 3.4 : 1.0;
      const taxPressure = 1 + 0.01 * Math.max(0, taxRateOf(state) - 15);
      const lossRate = Math.max(1.5, state.population * 0.025 + 4) * severity * fireAccel * taxPressure;
      const shortageLoss = state.population * Math.max(0, (essentialDeficit - 0.35) / 0.65) * (state.mode === "survival" ? 0.0024 : 0.0012);
      state.growthPool -= Math.max(lossRate, shortageLoss) * dtSec;
      dirty = true;
    }
  }

  // Residents who can't be fed, employed, housed or served drift away slowly (0.2%/s) until the city is
  // back at its cap. Weather-driven water/power dips are left to happiness and utility strain instead.
  if (state.metrics.connectedHouses > 0 && dtSec > 0) {
    const limit = state.metrics.populationLimiter;
    const held = state.mode === "god" && economyOf(state).holds.some((h) => h.key === "population");
    if (!held && limit.limitingNeed !== "water" && limit.limitingNeed !== "power" && state.population > limit.cap * 1.02) {
      state.growthPool -= Math.min(state.population - limit.cap, Math.max(1, state.population * 0.002) * dtSec);
      dirty = true;
    }
  }
  if (dirty) {
    recomputeConnectivityAndMetrics(state);
  }
  if (dtSec > 0) {
    if (state.faith?.sheltered && state.activePlaySec >= (state.faith.nextHomeCheck ?? 0)) {
      state.faith.nextHomeCheck = state.activePlaySec + 45;
      const moved = rehouseResidents(state);
      if (moved) pushToast(state, "stage", "Residents returned home", moved + " people moved from the sanctuary to safe housing.");
    }
    if (state.faith?.sheltered && !state.faith.recoveryGrant && !state.metrics.connectedHouses && state.money < 200 && state.mode !== "god") {
      const amount = transfer(state,"outside","treasury",200-state.money,"Sanctuary rebuilding fund");
      state.faith.recoveryGrant = true;
      pushToast(state,"stage","Sanctuary rebuilding fund","Emergency aid of $"+Math.ceil(amount)+" is ready for housing and roads.");
    }
    for (const grant of payEarnedGrants(state)) {
      pushToast(state, "stage", grant.name, `Public works grant received · +$${grant.reward.toLocaleString()}`);
      dirty = true;
    }
  }
  enforceAccountHolds(state);
  return dirty;
}

export function cycleWeatherKind(current: WeatherKind): WeatherKind {
  const idx = WEATHER_ORDER.indexOf(current);
  return WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
}

export interface HeatmapTileSample {
  gx: number;
  gz: number;
  /** -1 = critical shortage/danger, 0 = neutral, +1 = strong supply/protection */
  score: number;
}

/**
 * Evaluates spatial heatmap coverage across placed buildings and nearby neighborhood tiles
 * for any civilization need (Water, Power, Work, Waste, Food, Education, Parks, Police, Fire, Defense).
 */
export function computeHeatmapCells(state: GameState, kind: HeatmapKind): HeatmapTileSample[] {
  if (kind === "none") return [];
  if (kind === "transit") return transitLayer(state).map(p=>({gx:p.gx,gz:p.gz,score:p.intensity}));
  if (kind === "neighbors") {
    const occupied=buildOccupancyMap(state.elements);
    return state.elements.filter(e=>!ELEMENT_BY_ID[e.defId]?.isNetwork).map(e=>({
      gx:e.gx,gz:e.gz,score:Math.min(1,getParcelEdges(e,occupied,state).length/3)
    }));
  }

  const samples = new Map<string, HeatmapTileSample>();
  const setSample = (gx: number, gz: number, score: number) => {
    if (gx < GRID_MIN || gx > GRID_MAX || gz < GRID_MIN || gz > GRID_MAX) return;
    const key = `${gx},${gz}`;
    const prev = samples.get(key);
    if (!prev || Math.abs(score) > Math.abs(prev.score)) {
      samples.set(key, { gx, gz, score: Math.max(-1, Math.min(1, score)) });
    }
  };

  const paintRadius = (cx: number, cz: number, rad: number, score: number) => {
    const rCeil = Math.ceil(rad);
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        const d = Math.hypot(dx, dz);
        if (d <= rad) {
          const falloff = 1 - (d / (rad + 0.5)) * 0.45;
          setSample(Math.round(cx + dx), Math.round(cz + dz), score * falloff);
        }
      }
    }
  };

  if (kind === "landvalue" || kind === "pollution") {
    const layout = analyzeLayout(state.elements, (x,z)=>isCoastalTile(x,z,state),String(state.terrainVersion??1)+"/"+(state.infrastructure?.stamp ?? state.infrastructure?.revision??0));
    const field = kind === "landvalue" ? layout.landValue : layout.pollution;
    for (let gx = GRID_MIN; gx <= GRID_MAX; gx++) {
      for (let gz = GRID_MIN; gz <= GRID_MAX; gz++) {
        if (getTileTerrainKind(gx, gz, state) === "water") continue;
        const v = field[fieldIndex(gx, gz)];
        if (kind === "landvalue") {
          setSample(gx, gz, Math.max(-1, Math.min(1, (v - 0.75) / 0.6)));
        } else if (Math.abs(v) > 0.15) {
          setSample(gx, gz, Math.max(-1, Math.min(1, -v / 4)));
        }
      }
    }
    return Array.from(samples.values());
  }
  if(kind==="flow"||kind==="clearance"||kind==="lanes"){
    const i=state.infrastructure;
    if(kind==="flow")for(const [k,flow] of hydraulics(state).channels){const [x,z]=k.split(",").map(Number);setSample(x,z,Math.min(1,.5+flow/40));}
    if(kind==="flow")for(const [k,r] of hydraulics(state).runs){const [x,z]=k.split(",").map(Number);setSample(x,z,r.flow?Math.min(1,.5+r.flow/40):-1);}
    if(kind==="clearance"){const water=buildWaterNavigation(state);for(let x=GRID_MIN;x<=GRID_MAX;x++)for(let z=GRID_MIN;z<=GRID_MAX;z++){const c=water.cell(x,z);if(c.depth>0)setSample(x,z,water.canPass(x,z,waterHull.ferry)?Math.min(1,Math.max(0,Math.min(c.width/waterHull.ferry.beam,c.depth/waterHull.ferry.draft,c.clearance/waterHull.ferry.height)-1)*2):-1);}}
    if(kind==="lanes")for(const e of state.elements){const d=ELEMENT_BY_ID[e.defId];if(!d?.isRoadNetwork)continue;const lane=i?.streets[`${e.gx},${e.gz}`]?.lanes??(d.id==="freeways"?6:d.id==="highways"?4:2);setSample(e.gx,e.gz,lane/4-1);}
    return Array.from(samples.values());
  }
  if (kind === "traffic") {
    for (const [coord, load] of getTrafficLoadMap(state)) {
      const [gx, gz] = coord.split(",").map(Number);
      setSample(gx, gz, Math.max(-1, Math.min(1, 1 - load * 1.6)));
    }
    return Array.from(samples.values());
  }

  const providers: { el: PlacedElement; rad: number; strength: number }[] = [];
  const consumers: PlacedElement[] = [];

  for (const el of state.elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) continue;

    if (kind === "water") {
      if ((def.water ?? 0) > 0) providers.push({ el, rad: scaledRadius(14, el.level), strength: 1 });
      else if ((def.water ?? 0) < 0 || def.popBase) consumers.push(el);
    } else if (kind === "power") {
      if ((def.power ?? 0) > 0) providers.push({ el, rad: scaledRadius(14, el.level), strength: 1 });
      else if ((def.power ?? 0) < 0 || def.popBase) consumers.push(el);
    } else if (kind === "jobs") {
      if ((def.jobs ?? 0) > 0) providers.push({ el, rad: scaledRadius(12.8, el.level), strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "waste") {
      if ((def.waste ?? 0) > 0) {
        providers.push({ el, rad: scaledRadius(15, el.level), strength: 0.9 });
        if (def.nuisanceRadius) {
          paintRadius(el.gx + el.spanX * 0.5, el.gz + el.spanZ * 0.5, scaledRadius(def.nuisanceRadius, el.level), -0.95);
        }
      } else if (def.popBase || def.jobs) {
        consumers.push(el);
      }
    } else if (kind === "food") {
      if ((def.food ?? 0) > 0) providers.push({ el, rad: scaledRadius(12.8, el.level), strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "education") {
      if ((def.education ?? 0) > 0) providers.push({ el, rad: scaledRadius(14, el.level), strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "parks") {
      if ((def.recreation ?? 0) > 0) providers.push({ el, rad: scaledRadius(10.5, el.level), strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "police") {
      if ((def.policeRadius ?? 0) > 0) {
        const rad = scaledRadius(def.policeRadius ?? 10, el.level);
        providers.push({ el, rad, strength: 1 });
      } else if (def.popBase || def.jobs) {
        consumers.push(el);
      }
    } else if (kind === "fire") {
      if ((def.fireRadius ?? 0) > 0) {
        const rad = scaledRadius(def.fireRadius ?? 12, el.level);
        providers.push({ el, rad, strength: 1 });
      } else if (!def.isNetwork && !def.passiveNature) {
        consumers.push(el);
      }
    } else if (kind === "defense") {
      if (def.military || def.id === "swat_team_hq") {
        providers.push({ el, rad: scaledRadius(18.5, el.level), strength: 1 });
      } else if (!def.isNetwork && !def.passiveNature) {
        consumers.push(el);
      }
    }
  }

  for (const p of providers) {
    const cx = p.el.gx + p.el.spanX * 0.5;
    const cz = p.el.gz + p.el.spanZ * 0.5;
    paintRadius(cx, cz, p.rad, p.el.disrepair ? 0.35 : p.strength);
  }

  // Evaluate consumers against nearby providers & city-wide deficit
  const m = state.metrics;
  const globalDeficit =
    (kind === "water" && m.waterDemand > m.waterSupply) ||
    (kind === "power" && m.powerDemand > m.powerSupply) ||
    (kind === "jobs" && m.jobsNeeded > m.jobsAvailable) ||
    (kind === "waste" && m.wasteDemand > m.wasteCapacity) ||
    (kind === "food" && m.foodDemand > m.foodSupply) ||
    (kind === "education" && m.educationDemand > m.educationSupply) ||
    (kind === "parks" && m.recreationDemand > m.recreationSupply) ||
    (kind === "police" && m.crimeRate > 25) ||
    (kind === "defense" && m.defenseRating < 75);

  for (const c of consumers) {
    const cx = c.gx + c.spanX * 0.5;
    const cz = c.gz + c.spanZ * 0.5;
    const coveredLocally = providers.some(
      (p) => Math.hypot(cx - (p.el.gx + p.el.spanX * 0.5), cz - (p.el.gz + p.el.spanZ * 0.5)) <= p.rad,
    );

    let tileScore = coveredLocally && !globalDeficit ? 0.85 : coveredLocally ? -0.25 : -0.95;
    if (kind === "police" && state.crimeIncidents?.some((inc) => inc.targetElementId === c.id)) {
      tileScore = -1.0;
    }
    if (kind === "fire" && c.onFire) {
      tileScore = -1.0;
    }

    for (let dx = 0; dx < c.spanX; dx++) {
      for (let dz = 0; dz < c.spanZ; dz++) {
        setSample(c.gx + dx, c.gz + dz, tileScore);
      }
    }
  }

  return Array.from(samples.values());
}

/** Survival maintenance price: 2% of the build cost per level. */
export function maintenancePrice(el: PlacedElement): number {
  const def = ELEMENT_BY_ID[el.defId];
  return Math.round((def?.cost ?? 0) * 0.02 * Math.max(1, el.level));
}
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function maintainElement(state: GameState, id: string): boolean {
  const el = state.elements.find((e) => e.id === id);
  if (!el || el.onFire) return false;
  if (state.mode === "survival") {
    const price = maintenancePrice(el);
    if (state.money < price) return false;
    transfer(state, "treasury", "outside", price, "Maintenance");
  }
  el.maintTimerSec = 0;
  el.repairTimerSec = 0;
  el.disrepair = false;

  el.animProgress = 0.65;
  el.animKind = "place";
  recomputeConnectivityAndMetrics(state);
  return true;
}

export function maintainAllElements(state: GameState): number {
  let count = 0;
  for (const el of state.elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!el.onFire && (el.disrepair || (def?.needsMaintenance && el.maintTimerSec > 30))) {
      if (state.mode === "survival") {
        const price = maintenancePrice(el);
        if (state.money < price) continue;
        transfer(state, "treasury", "outside", price, "Maintenance");
      }
      el.maintTimerSec = 0;
      el.disrepair = false;
      count += 1;
    }
  }
  if (count > 0) {
    recomputeConnectivityAndMetrics(state);
  }
  return count;
}
