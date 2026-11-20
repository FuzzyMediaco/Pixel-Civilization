import {
  CRIME_UNLOCK_MIN_POP,
  CRIME_UNLOCK_STAGE,
  type CivElementDef,
  ELEMENTS,
  ELEMENT_BY_ID,
  type GameMode,
  STAGES,
  getStandardFootprintForLevel,
  getUpgradeCost,
  getElementMaxLevel,
} from "./catalog";
import { FARM_ANCHOR_IDS, FARM_MODULE_IDS, SCHOOL_IDS } from "./expansionCatalog";
import { analyzeFarmNetworks } from "./farmNetworks";
import { analyzeTraffic } from "./trafficModel";
import { TILE_SIZE } from "./voxelCore";

export const GRID_HALF = 32; // tiles from -32 .. +31 (64x64 grid = 256m x 256m)
export const GRID_MIN = -GRID_HALF;
export const GRID_MAX = GRID_HALF - 1;
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
  level: number; // 1..5 for buildings; 1..11 for motor roads
  variant: number; // 0..3
  connected: boolean;
  hasPoliceCover: boolean;
  hasFireCover: boolean;
  nuisancePenalty: number;
  /** Active play seconds since last maintained (Survival Mode) */
  maintTimerSec: number;
  disrepair: boolean;
  onFire: boolean;
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
  | "defense";

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
  farmModuleCount: number;
  farmNetworkCount: number;
  specializedSchoolJobs: number;
  specializedSchoolIncome: number;
  trafficCapacity: number;
  trafficDemand: number;
  trafficCongestion: number;
  congestedRoads: number;
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
}

export interface GameEventToast {
  id: string;
  kind: "stage" | "merge" | "alert" | "raid";
  title: string;
  subtitle: string;
  createdAt: number;
}

export interface GameState {
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
}

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
export function islandMarginAtWorld(x: number, z: number): number {
  const halfExtent = 108; // ~27 tiles radius so outer 5 tiles on each side are beach & ocean!
  const nx = Math.abs(x) / halfExtent;
  const nz = Math.abs(z) / halfExtent;
  const superR = Math.pow(Math.pow(nx, 3.6) + Math.pow(nz, 3.6), 1 / 3.6);
  const angle = Math.atan2(z, x);
  const coveWobble =
    0.045 * Math.sin(angle * 3.0 + 0.7) +
    0.03 * Math.cos(angle * 5.0 - 1.1) +
    0.02 * Math.sin(angle * 7.0 + 2.2);
  return (1.0 + coveWobble - superR) * halfExtent;
}

export function gridToWorldCenter(gx: number, gz: number, spanX = 1, spanZ = 1): [number, number] {
  return [(gx + spanX * 0.5) * TILE_SIZE, (gz + spanZ * 0.5) * TILE_SIZE];
}

export function worldToGrid(wx: number, wz: number): [number, number] {
  return [Math.floor(wx / TILE_SIZE), Math.floor(wz / TILE_SIZE)];
}

export function getTileTerrainKind(gx: number, gz: number): TerrainCellKind {
  const [wx, wz] = gridToWorldCenter(gx, gz, 1, 1);
  const margin = islandMarginAtWorld(wx, wz);
  if (margin >= 2.2) return "land";
  if (margin >= -6.5) return "coast";
  return "water";
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
    farmModuleCount: 0,
    farmNetworkCount: 0,
    specializedSchoolJobs: 0,
    specializedSchoolIncome: 0,
    trafficCapacity: 0,
    trafficDemand: 0,
    trafficCongestion: 0,
    congestedRoads: 0,
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
  };
}

export function createInitialGameState(mode: GameMode): GameState {
  const state: GameState = {
    mode,
    money: mode === "god" ? 999_999_999 : mode === "survival" ? 2_200 : 2_800,
    population: 0,
    growthPool: 0,
    happiness: 100,
    currentStage: mode === "god" ? 20 : 1,
    highestStageReached: mode === "god" ? 20 : 1,
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

export function isElementUnlocked(def: CivElementDef, state: GameState): boolean {
  if (state.mode === "god") return true;
  if (state.highestStageReached === 1) {
    return Boolean(def.isStarter);
  }
  return def.stage <= state.highestStageReached;
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
  if (!isElementUnlocked(def, state)) {
    return { valid: false, reason: `Unlocks at Stage ${def.stage}` };
  }
  const occ = buildOccupancyMap(state.elements, ignoreIds);
  for (let dx = 0; dx < spanX; dx++) {
    for (let dz = 0; dz < spanZ; dz++) {
      const tx = gx + dx;
      const tz = gz + dz;
      if (occ.has(`${tx},${tz}`)) {
        return { valid: false, reason: "Space already occupied" };
      }
      const cellKind = getTileTerrainKind(tx, tz);
      // Placed water tiles allow boats/bridges on them, handled via empty check above
      if (!isDomainCompatible(def.domain, cellKind)) {
        if (def.domain === "land") {
          return { valid: false, reason: "Must be placed on island land" };
        }
        return { valid: false, reason: "Must be placed on coast or water" };
      }
    }
  }
  return { valid: true };
}

export function getNetworkConnMask(elements: PlacedElement[], el: PlacedElement): number {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def?.isNetwork) return 0;
  const occ = buildOccupancyMap(elements);
  let mask = 0;
  // Bits 0..3 (1,2,4,8) = connected road/rail/waterway neighbors
  // Bits 4..7 (16,32,64,128) = adjacent buildings so roads render driveways right up to building edges
  const neighbors: [number, number, number, number][] = [
    [0, -1, 1, 16],  // N (-Z)
    [1, 0, 2, 32],   // E (+X)
    [0, 1, 4, 64],   // S (+Z)
    [-1, 0, 8, 128], // W (-X)
  ];
  for (const [dx, dz, roadBit, bldgBit] of neighbors) {
    const nb = occ.get(`${el.gx + dx},${el.gz + dz}`);
    if (!nb) continue;
    const nbDef = ELEMENT_BY_ID[nb.defId];
    if (!nbDef) continue;
    if (
      def.isRailNetwork &&
      (nbDef.isRailNetwork || nbDef.archetype === "transit_stop" || nbDef.archetype === "transit_depot")
    ) {
      mask |= roadBit;
    } else if (def.isWaterFeature && (nbDef.isWaterFeature || nbDef.domain !== "land")) {
      mask |= roadBit;
    } else if (def.isRoadNetwork) {
      if (nbDef.isRoadNetwork) {
        mask |= roadBit;
      } else if (!nbDef.isNetwork && !nbDef.passiveNature) {
        mask |= bldgBit;
      }
    }
  }
  return mask;
}

/**
 * Checks whether two placed elements can be manually merged into level + 1.
 */
export function canMergePair(
  state: GameState,
  idA: string,
  idB: string,
): { ok: boolean; reason?: string; nextLevel?: number; targetGx?: number; targetGz?: number; spanX?: number; spanZ?: number } {
  if (idA === idB) return { ok: false, reason: "Select two separate elements" };
  const a = state.elements.find((e) => e.id === idA);
  const b = state.elements.find((e) => e.id === idB);
  if (!a || !b) return { ok: false, reason: "Element not found" };
  if (a.defId !== b.defId) {
    return { ok: false, reason: "Must be the same element type to merge" };
  }
  if (a.level !== b.level) {
    return { ok: false, reason: `Both must be the same level (Lv.${a.level} vs Lv.${b.level})` };
  }
  const maxLevel = getElementMaxLevel(ELEMENT_BY_ID[a.defId]);
  if (a.level >= maxLevel) {
    return { ok: false, reason: `Already at maximum Level ${maxLevel}` };
  }

  // Check cardinal adjacency between footprint A and footprint B
  let adjacent = false;
  for (let ax = a.gx; ax < a.gx + a.spanX; ax++) {
    for (let az = a.gz; az < a.gz + a.spanZ; az++) {
      for (let bx = b.gx; bx < b.gx + b.spanX; bx++) {
        for (let bz = b.gz; bz < b.gz + b.spanZ; bz++) {
          if (Math.abs(ax - bx) + Math.abs(az - bz) === 1) {
            adjacent = true;
          }
        }
      }
    }
  }
  if (!adjacent) {
    return { ok: false, reason: "Elements must be right next to each other to merge" };
  }

  const def = ELEMENT_BY_ID[a.defId];
  if (!def) return { ok: false, reason: "Unknown element" };
  const nextLevel = a.level + 1;

  // Network elements (roads, highways, bridges, tracks, canals) keep 1x1 footprint!
  if (def.isNetwork) {
    return {
      ok: true,
      nextLevel,
      targetGx: a.gx,
      targetGz: a.gz,
      spanX: 1,
      spanZ: 1,
    };
  }

  const [stdX, stdZ] = getStandardFootprintForLevel(def, nextLevel);
  const oddRotA = a.rotation % 2 === 1;
  const prefX = Math.min(3, oddRotA ? stdZ : stdX);
  const prefZ = Math.min(3, oddRotA ? stdX : stdZ);

  // Adjacent 1x1 + 1x1 merging into a 2x1 or 1x2 footprint naturally occupies their combined pair!
  if (
    a.spanX === 1 &&
    a.spanZ === 1 &&
    b.spanX === 1 &&
    b.spanZ === 1 &&
    ((stdX === 2 && stdZ === 1) || (stdX === 1 && stdZ === 2))
  ) {
    const minX = Math.min(a.gx, b.gx);
    const minZ = Math.min(a.gz, b.gz);
    const spanX = a.gx !== b.gx ? 2 : 1;
    const spanZ = a.gz !== b.gz ? 2 : 1;
    return {
      ok: true,
      nextLevel,
      targetGx: minX,
      targetGz: minZ,
      spanX,
      spanZ,
    };
  }

  const ignore = new Set([a.id, b.id]);
  const minX = Math.min(a.gx, b.gx);
  const maxX = Math.max(a.gx + a.spanX - 1, b.gx + b.spanX - 1);
  const minZ = Math.min(a.gz, b.gz);
  const maxZ = Math.max(a.gz + a.spanZ - 1, b.gz + b.spanZ - 1);

  const dimAttempts: [number, number][] = [[prefX, prefZ]];
  if (prefX !== prefZ) dimAttempts.push([prefZ, prefX]);
  if (a.spanX !== prefX || a.spanZ !== prefZ) {
    dimAttempts.push([a.spanX, a.spanZ]);
  }

  for (const [tx, tz] of dimAttempts) {
    const candidates: [number, number][] = [
      [a.gx, a.gz],
      [minX, minZ],
    ];
    for (let cx = minX - (tx - 1); cx <= maxX; cx++) {
      for (let cz = minZ - (tz - 1); cz <= maxZ; cz++) {
        candidates.push([cx, cz]);
      }
    }
    for (const [cx, cz] of candidates) {
      if (checkPlacementValid(state, def, cx, cz, tx, tz, ignore).valid) {
        return {
          ok: true,
          nextLevel,
          targetGx: cx,
          targetGz: cz,
          spanX: tx,
          spanZ: tz,
        };
      }
    }
  }

  return {
    ok: false,
    reason: `Need clear ${prefX}×${prefZ} space around pair for Lv.${nextLevel} ${def.name}`,
  };
}

export function mergeElementsInState(state: GameState, idA: string, idB: string): { ok: boolean; mergedId?: string; reason?: string } {
  const plan = canMergePair(state, idA, idB);
  if (!plan.ok || !plan.nextLevel || plan.targetGx === undefined || plan.targetGz === undefined || !plan.spanX || !plan.spanZ) {
    return { ok: false, reason: plan.reason };
  }

  const a = state.elements.find((e) => e.id === idA)!;
  const def = ELEMENT_BY_ID[a.defId]!;

  // Remove both A and B (except for network elements, where B stays as road connectivity and A upgrades)
  if (def.isNetwork) {
    a.level = plan.nextLevel;
    a.variant = randomVariant();
    a.animProgress = 1.0;
    a.animKind = "merge";
    const b = state.elements.find((e) => e.id === idB);
    if (b) {
      b.level = plan.nextLevel;
      b.variant = randomVariant();
      b.animProgress = 1.0;
      b.animKind = "merge";
    }
    pushToast(state, "merge", `${def.name} Merged to Lv.${plan.nextLevel}`, "Upgraded road design without widening footprint");
    recomputeConnectivityAndMetrics(state);
    return { ok: true, mergedId: a.id };
  }

  const [stdX, stdZ] = getStandardFootprintForLevel(def, plan.nextLevel);
  let mergedRot = a.rotation;
  if (stdX !== stdZ) {
    const needsOddRot = plan.spanX === stdZ && plan.spanZ === stdX;
    if (needsOddRot && mergedRot % 2 === 0) mergedRot = 1;
    else if (!needsOddRot && mergedRot % 2 === 1) mergedRot = 0;
  }

  const merged: PlacedElement = {
    id: makeElementId(),
    defId: a.defId,
    gx: plan.targetGx,
    gz: plan.targetGz,
    spanX: plan.spanX,
    spanZ: plan.spanZ,
    rotation: mergedRot,
    level: plan.nextLevel,
    variant: randomVariant(),
    connected: true,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 1.0,
    animKind: "merge",
  };

  state.elements = state.elements.filter((e) => e.id !== idA && e.id !== idB);
  state.elements.push(merged);
  pushToast(
    state,
    "merge",
    `Merged into Lv.${merged.level} ${def.name}`,
    `Variant #${merged.variant + 1} · ${merged.spanX}×${merged.spanZ} footprint`,
  );
  recomputeConnectivityAndMetrics(state);
  return { ok: true, mergedId: merged.id };
}

export function resizeElementForLevel(
  state: GameState,
  el: PlacedElement,
  targetLevel: number,
): boolean {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return false;
  const nextLevel = Math.max(1, Math.min(getElementMaxLevel(def), Math.round(targetLevel)));
  if (nextLevel === el.level) return false;

  if (!def.isNetwork) {
    const [stdX, stdZ] = getStandardFootprintForLevel(def, nextLevel);
    const rotSwap = el.rotation % 2 === 1;
    let targetSpanX = Math.min(3, rotSwap ? stdZ : stdX);
    let targetSpanZ = Math.min(3, rotSwap ? stdX : stdZ);
    const ignore = new Set([el.id]);

    if (targetSpanX !== el.spanX || targetSpanZ !== el.spanZ) {
      const tryDims: [number, number][] = [[targetSpanX, targetSpanZ]];
      if (targetSpanX !== targetSpanZ) tryDims.push([targetSpanZ, targetSpanX]);
      const altOffsets: [number, number][] = [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [1, 0],
        [0, 1],
      ];
      let fitted = false;
      for (const [dxSpan, dzSpan] of tryDims) {
        for (const [ox, oz] of altOffsets) {
          if (checkPlacementValid(state, def, el.gx + ox, el.gz + oz, dxSpan, dzSpan, ignore).valid) {
            el.gx += ox;
            el.gz += oz;
            targetSpanX = dxSpan;
            targetSpanZ = dzSpan;
            if (stdX !== stdZ) {
              const needsOdd = dxSpan === stdZ && dzSpan === stdX;
              if (needsOdd && el.rotation % 2 === 0) el.rotation = 1;
              else if (!needsOdd && el.rotation % 2 === 1) el.rotation = 0;
            }
            fitted = true;
            break;
          }
        }
        if (fitted) break;
      }
      if (!fitted) {
        targetSpanX = el.spanX;
        targetSpanZ = el.spanZ;
      }
    }

    el.spanX = targetSpanX;
    el.spanZ = targetSpanZ;
  }

  el.level = nextLevel;
  el.maintTimerSec = 0;
  el.disrepair = false;
  el.animProgress = 0.9;
  el.animKind = "upgrade";
  return true;
}

export function upgradeElementDirect(state: GameState, id: string): { ok: boolean; reason?: string } {
  const el = state.elements.find((e) => e.id === id);
  if (!el) return { ok: false, reason: "Element not found" };
  const def = ELEMENT_BY_ID[el.defId];
  if (!def) return { ok: false, reason: "Unknown element" };
  const maxLevel = getElementMaxLevel(def);
  if (el.level >= maxLevel) return { ok: false, reason: `Already at max Level ${maxLevel}` };

  const cost = state.mode === "god" ? 0 : getUpgradeCost(def, el.level);
  if (state.mode !== "god" && state.money < cost) {
    return { ok: false, reason: `Need $${cost.toLocaleString()} to upgrade` };
  }

  if (state.mode !== "god") {
    state.money -= cost;
  }

  resizeElementForLevel(state, el, el.level + 1);
  el.variant = randomVariant();
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
  roadCompByCoord: Map<string, number>;
  buildingsInRoadComp: Map<number, Set<string>>;
  elementRoadComps: Map<string, Set<number>>;
}

function analyzeRoadNetwork(elements: PlacedElement[]): RoadNetworkAnalysis {
  const occ = buildOccupancyMap(elements);
  const roadCompByCoord = new Map<string, number>();
  let compSeq = 0;

  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def?.isRoadNetwork) continue;
    const startKey = `${el.gx},${el.gz}`;
    if (roadCompByCoord.has(startKey)) continue;

    compSeq += 1;
    const queue: [number, number][] = [[el.gx, el.gz]];
    roadCompByCoord.set(startKey, compSeq);

    while (queue.length > 0) {
      const [cx, cz] = queue.shift()!;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        const nKey = `${nx},${nz}`;
        if (roadCompByCoord.has(nKey)) continue;
        const nb = occ.get(nKey);
        if (!nb) continue;
        const nbDef = ELEMENT_BY_ID[nb.defId];
        if (nbDef?.isRoadNetwork) {
          roadCompByCoord.set(nKey, compSeq);
          queue.push([nx, nz]);
        }
      }
    }
  }

  const buildingsInRoadComp = new Map<number, Set<string>>();
  const elementRoadComps = new Map<string, Set<number>>();

  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def || def.isNetwork || def.passiveNature) continue;

    const comps = new Set<number>();
    for (let dx = 0; dx < el.spanX; dx++) {
      for (let dz = 0; dz < el.spanZ; dz++) {
        const tx = el.gx + dx;
        const tz = el.gz + dz;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [ox, oz] of dirs) {
          const cId = roadCompByCoord.get(`${tx + ox},${tz + oz}`);
          if (cId !== undefined) {
            comps.add(cId);
            let set = buildingsInRoadComp.get(cId);
            if (!set) {
              set = new Set();
              buildingsInRoadComp.set(cId, set);
            }
            set.add(el.id);
          }
        }
      }
    }
    elementRoadComps.set(el.id, comps);
  }

  return { roadCompByCoord, buildingsInRoadComp, elementRoadComps };
}

/**
 * Returns road coordinates belonging to road components touching at least 2 active buildings.
 * Isolated roads or stubs touching 0 or 1 building never spawn cars or pedestrians.
 */
export function getConnectedRoadCoordSet(elements: PlacedElement[]): Set<string> {
  const { roadCompByCoord } = analyzeRoadNetwork(elements);
  // Streets connect immediately, even before the second building is placed.
  return new Set(roadCompByCoord.keys());
}

/**
 * Returns rail coordinates belonging to rail components touching at least 1 transit stop/depot or building.
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
    const def = ELEMENT_BY_ID[el.defId];
    if (!def || def.isNetwork || def.passiveNature) continue;
    for (let dx = 0; dx < el.spanX; dx++) {
      for (let dz = 0; dz < el.spanZ; dz++) {
        const tx = el.gx + dx;
        const tz = el.gz + dz;
        for (const [ox, oz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const cId = railCompByCoord.get(`${tx + ox},${tz + oz}`);
          if (cId !== undefined) {
            activeComps.add(cId);
          }
        }
      }
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
export function recomputeConnectivityAndMetrics(state: GameState): void {
  const elements = state.elements;
  const { elementRoadComps } = analyzeRoadNetwork(elements);

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
    if (def.isNetwork || def.passiveNature || def.domain === "water") {
      el.connected = true;
      continue;
    }
    const comps = elementRoadComps.get(el.id);
    // A building connected to any adjacent road is live; no second building required.
    el.connected = state.mode === "god" || Boolean(comps && comps.size > 0);
  }

  // Propagate one anchor's street connection through every touching field,
  // pasture or auxiliary barn, across arbitrarily large farm complexes.
  const connectedAnchors = new Set(
    elements.filter(el => FARM_ANCHOR_IDS.has(el.defId) && el.connected).map(el => el.id),
  );
  const farmNetworks = analyzeFarmNetworks(elements, connectedAnchors);
  for (const el of elements) {
    if (FARM_MODULE_IDS.has(el.defId)) {
      el.connected = state.mode === "god" || farmNetworks.connectedModuleIds.has(el.id);
    }
  }

  // 3. Spatial radii: Police coverage, Fire coverage, and Nuisance proximity
  const policeSources = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return e.connected && !e.onFire && (d?.policeRadius ?? 0) > 0;
  });
  const fireSources = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return e.connected && !e.onFire && (d?.fireRadius ?? 0) > 0;
  });
  const nuisanceSources = elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return (d?.nuisanceRadius ?? 0) > 0;
  });

  for (const el of elements) {
    el.hasPoliceCover = false;
    el.hasFireCover = false;
    el.nuisancePenalty = 0;

    const cx = el.gx + el.spanX * 0.5;
    const cz = el.gz + el.spanZ * 0.5;

    for (const p of policeSources) {
      const pDef = ELEMENT_BY_ID[p.defId]!;
      const effMult = p.disrepair ? 0.45 : 1 + (p.level - 1) * 0.18;
      const rad = (pDef.policeRadius ?? 10) * effMult;
      const dist = Math.hypot(cx - (p.gx + p.spanX * 0.5), cz - (p.gz + p.spanZ * 0.5));
      if (dist <= rad) {
        el.hasPoliceCover = true;
        break;
      }
    }

    for (const f of fireSources) {
      const fDef = ELEMENT_BY_ID[f.defId]!;
      const effMult = f.disrepair ? 0.5 : 1 + (f.level - 1) * 0.18;
      const rad = (fDef.fireRadius ?? 12) * effMult;
      const dist = Math.hypot(cx - (f.gx + f.spanX * 0.5), cz - (f.gz + f.spanZ * 0.5));
      if (dist <= rad) {
        el.hasFireCover = true;
        break;
      }
    }

    const def = ELEMENT_BY_ID[el.defId];
    if (def?.popBase) {
      for (const n of nuisanceSources) {
        const nDef = ELEMENT_BY_ID[n.defId]!;
        const rad = nDef.nuisanceRadius ?? 6;
        const dist = Math.hypot(cx - (n.gx + n.spanX * 0.5), cz - (n.gz + n.spanZ * 0.5));
        if (dist <= rad) {
          el.nuisancePenalty += Math.max(1, Math.round((rad - dist + 1) * 2.5));
        }
      }
    }
  }

  // 4. Aggregate Supplies, Demands, Population & Happiness
  const m = createEmptyMetrics();
  let baseHousingPop = 0;
  let policePoints = 0;
  let uncoveredBuildings = 0;
  let coverableBuildings = 0;
  let militaryPower = 0;
  let incomeSum = 0;
  let industrialJobs = 0;
  let commercialJobs = 0;
  let commercialIncome = 0;
  let tradeSchoolStrength = 0;
  let communityCollegeStrength = 0;
  let universityStrength = 0;
  let researchStrength = 0;
  let preschoolStrength = 0;
  let countrySchoolStrength = 0;
  m.farmModuleCount = farmNetworks.connectedModuleIds.size;
  m.farmNetworkCount = connectedAnchors.size;

  for (const el of elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) continue;

    if (el.disrepair) m.disrepairCount += 1;
    if (el.onFire) m.burningCount += 1;

    if (!def.isNetwork && !def.passiveNature && !el.connected && def.domain === "land") {
      m.disconnectedBuildings += 1;
    }

    if (!el.connected || el.onFire) continue;

    // Standard building output doubles through Level 5.
    const lvMult = Math.pow(2, Math.min(5, el.level) - 1);
    const schoolStrength = 1 + Math.max(0, Math.min(5, el.level) - 1) * 0.18;
    if (SCHOOL_IDS.has(el.defId)) {
      if (el.defId === "trade_school") tradeSchoolStrength += schoolStrength;
      if (el.defId === "community_college") communityCollegeStrength += schoolStrength;
      if (el.defId === "university") universityStrength += schoolStrength;
      if (el.defId === "research_university") researchStrength += schoolStrength;
      if (el.defId === "preschool") preschoolStrength += schoolStrength;
      if (el.defId === "country_schoolhouse") countrySchoolStrength += schoolStrength;
    }
    // Disrepair in Survival Mode cuts positive service output by 75%
    const serviceHealth = el.disrepair ? 0.25 : 1.0;

    if (def.popBase) {
      baseHousingPop += def.popBase * lvMult;
      m.connectedHouses += 1;
      if (el.nuisancePenalty > 0) {
        m.nuisanceAffectedHomes += 1;
      }
    }

    if (def.power) {
      if (def.power > 0) m.powerSupply += Math.round(def.power * lvMult * serviceHealth);
      else m.powerDemand += Math.abs(def.power) * Math.max(1, Math.round(lvMult * 0.75));
    }
    if (def.water) {
      if (def.water > 0) m.waterSupply += Math.round(def.water * lvMult * serviceHealth);
      else m.waterDemand += Math.abs(def.water) * Math.max(1, Math.round(lvMult * 0.75));
    }
    if (def.waste) {
      m.wasteCapacity += Math.round(def.waste * lvMult * serviceHealth);
    }
    if (def.jobs) {
      const jobPoints = Math.round(def.jobs * lvMult * serviceHealth);
      m.jobsAvailable += jobPoints;
      if (def.archetype === "factory_mill" || def.archetype === "power_heavy") industrialJobs += jobPoints;
      if (def.category === "commerce") commercialJobs += jobPoints;
    }
    if (def.food) {
      // All farms, grocers and food-service elements start with stronger output.
      // Food grows 2.4x per upgrade rather than the legacy 2x.
      const foodLevelMult = Math.pow(2.4, Math.max(0, Math.min(5, el.level) - 1));
      const foodBaseMult = def.category === "agriculture" ? 2.7 : 2.15;
      const linkedFarmBonus = FARM_ANCHOR_IDS.has(el.defId)
        ? (farmNetworks.multiplierByAnchorId.get(el.id) ?? 1)
        : 1;
      m.foodSupply += Math.round(def.food * foodLevelMult * foodBaseMult * linkedFarmBonus * serviceHealth);
    }
    if (def.education) {
      m.educationSupply += Math.round(def.education * lvMult * serviceHealth);
    }
    if (def.recreation) {
      m.recreationSupply += Math.round(def.recreation * lvMult * serviceHealth);
    }
    if (def.government) {
      m.govSupply += Math.round(def.government * lvMult * serviceHealth);
    }
    if (def.police) {
      policePoints += Math.round(def.police * lvMult * serviceHealth);
    }
    if (def.military) {
      militaryPower += Math.round(def.military * lvMult * serviceHealth);
    }
    if (def.income) {
      const elementIncome = Math.round(def.income * lvMult * serviceHealth);
      incomeSum += elementIncome;
      if (def.category === "commerce") commercialIncome += elementIncome;
    }

    if (!def.isNetwork && !def.passiveNature && (def.popBase || def.jobs)) {
      coverableBuildings += 1;
      if (!el.hasPoliceCover) uncoveredBuildings += 1;
    }
  }

  // Schools specialize their economies: trade colleges help factories and skilled
  // jobs, while universities improve the productivity of commercial districts.
  const industrialMultiplier = Math.min(0.38, tradeSchoolStrength * 0.08 + researchStrength * 0.05);
  const commercialWorkMultiplier = Math.min(0.22, communityCollegeStrength * 0.05 + universityStrength * 0.04);
  m.specializedSchoolJobs = Math.round(industrialJobs * industrialMultiplier + commercialJobs * commercialWorkMultiplier);
  m.jobsAvailable += m.specializedSchoolJobs;
  m.specializedSchoolIncome = Math.round(commercialIncome * Math.min(0.32, universityStrength * 0.10 + researchStrength * 0.07));
  incomeSum += m.specializedSchoolIncome;

  const traffic = analyzeTraffic(elements);
  m.trafficCapacity = traffic.capacity;
  m.trafficDemand = traffic.demand;
  m.trafficCongestion = traffic.congestion;
  m.congestedRoads = traffic.congestedRoads;

  // Population calculation:
  // Immediate connected housing base (Lv1 House = 5) + thriving settlement pool bounded by housing capacity
  if (baseHousingPop === 0) {
    state.population = 0;
    state.growthPool = 0;
  } else if (state.mode === "god") {
    state.population = Math.max(0, Math.round(baseHousingPop + state.growthPool));
  } else {
    // Allow thriving towns to attract denser settlement up to stage-scaled neighborhood capacity
    const maxSettlementBonus = baseHousingPop * 18;
    state.growthPool = Math.max(-baseHousingPop * 0.8, Math.min(maxSettlementBonus, state.growthPool));
    state.population = Math.max(0, Math.round(baseHousingPop + state.growthPool));
  }

  // Update stage progression before evaluating stage-gated systems (Crime & Defense)
  if (state.mode !== "god") {
    let stageNow = 1;
    for (const s of STAGES) {
      if (state.population >= s.minPop) {
        stageNow = s.stage;
      }
    }
    state.currentStage = stageNow;

    if (stageNow > state.highestStageReached) {
      for (let st = state.highestStageReached + 1; st <= stageNow; st++) {
        const stMeta = STAGES[st - 1];
        const unlockedCount = ELEMENTS.filter((e) => e.stage === st).length;
        pushToast(
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
  const citizenUnits = Math.max(0, Math.ceil(baseHousingPop / 5));
  m.wasteDemand = Math.ceil(citizenUnits * 1.4);
  m.jobsNeeded = Math.ceil(citizenUnits * 2.2);
  m.foodDemand = Math.ceil(citizenUnits * 1.8);
  m.educationDemand = Math.ceil(citizenUnits * 1.3);
  m.recreationDemand = Math.ceil(citizenUnits * 1.2);
  m.govDemand = state.highestStageReached >= 3 && state.mode !== "god" ? Math.ceil(citizenUnits * 1.5) : 0;

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
      ? true
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
    const capRatio = Math.min(1, policePoints / Math.max(12, citizenUnits * 1.6));
    let rawCrime = Math.round(uncovRatio * 68 + (1 - capRatio) * 32);
    if (state.mode === "survival" && state.happiness < 50) {
      rawCrime = Math.max(rawCrime, Math.round((55 - state.happiness) * 1.7));
    }
    if (night) {
      rawCrime = Math.round(rawCrime * 1.45 + 10);
    }
    m.crimeRate = Math.max(0, Math.min(100, rawCrime));
  } else {
    m.crimeRate = 0;
  }

  m.requiredDefensePower = Math.max(
    180,
    Math.round(m.stageAttackSeverity * 140 + citizenUnits * 1.3),
  );
  if (m.defenseUnlocked) {
    m.defenseRating = Math.max(
      0,
      Math.min(100, Math.round((m.defensePower / m.requiredDefensePower) * 100)),
    );
  } else {
    m.defenseRating = 100;
  }

  const taxFromPop = Math.round(Math.sqrt(state.population) * 0.9);
  m.netIncomePerTick = incomeSum + taxFromPop;

  // 5. Compute Happiness & Diagnostics ("What's Missing?")
  const diags: AdvisorDiagnostic[] = [];
  let happiness = 100;

  if (state.mode === "god") {
    state.happiness = 100;
    if (elements.length === 0) {
      diags.push({
        id: "god_welcome",
        severity: "info",
        title: "God Mode Sandbox Ready",
        detail: "All 148+ elements, 5 levels, and 4 visual variants are unlocked with infinite treasury.",
        fixHint: "Place buildings anywhere, merge adjacent twins, or toggle levels & variants freely.",
      });
    }
    state.metrics = m;
    state.diagnostics = diags;
    return;
  }

  if (m.disconnectedBuildings > 0) {
    diags.push({
      id: "disconnected",
      severity: "warning",
      title: `${m.disconnectedBuildings} Unconnected Building${m.disconnectedBuildings > 1 ? "s" : ""}`,
      detail: "Houses and services only operate when linked by road to at least one other building.",
      fixHint: "Build Roads touching both your Houses and workplaces/utilities.",
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

    checkNeed("power", "Power", m.powerSupply, m.powerDemand, 22, "Place Solar Panels, Windmills, or Power Plants connected by road.");
    checkNeed("water", "Clean Water", m.waterSupply, m.waterDemand, 24, "Build a Water Plant, Water Tower, or Wells connected to roads.");
    checkNeed("waste", "Garbage Pickup", m.wasteCapacity, m.wasteDemand, 16, "Add a Landfill or Trash Plant (keep a few tiles away from homes!).");
    checkNeed("jobs", "Jobs", m.jobsAvailable, m.jobsNeeded, 18, "Build Businesses, Shops, Farms, or Factories so citizens can work.");
    checkNeed("food", "Food & Groceries", m.foodSupply, m.foodDemand, 18, "Place Grocery Stores, Farms, Orchards, or Restaurants.");
    checkNeed("edu", "Schools & Education", m.educationSupply, m.educationDemand, 13, "Build or merge Schools so families stay happy.");
    checkNeed("rec", "Parks & Leisure", m.recreationSupply, m.recreationDemand, 12, "Add Parks, Gardens, Plazas, or Landmarks.");

    if (m.congestedRoads > 0 && m.trafficCongestion > 1.1) {
      const congestionPenalty = Math.min(10, Math.max(2, Math.round((m.trafficCongestion - 1) * 4)));
      happiness -= congestionPenalty;
      diags.push({
        id: "traffic",
        severity: m.trafficCongestion >= 1.8 ? "warning" : "info",
        title: `${m.congestedRoads} Congested Road${m.congestedRoads === 1 ? "" : "s"}`,
        detail: "Commuter routes exceed the capacity of one or more road segments.",
        fixHint: "Select a busy road and upgrade it in place. Widening increases actual traffic throughput.",
        deltaHappiness: -congestionPenalty,
      });
    }

    if (m.govDemand > 0) {
      checkNeed("gov", "Government Services", m.govSupply, m.govDemand, 16, "Stage 3+ requires City Offices, Tax Offices, Courthouses, or Government Buildings.");
    }

    if (m.nuisanceAffectedHomes > 0) {
      const pen = Math.min(22, m.nuisanceAffectedHomes * 5);
      happiness -= pen;
      diags.push({
        id: "nuisance",
        severity: "warning",
        title: `${m.nuisanceAffectedHomes} Home${m.nuisanceAffectedHomes > 1 ? "s" : ""} Near Pollution/Trash`,
        detail: "Landfills, Coal Plants, and heavy Factories lower happiness when built right next to houses.",
        fixHint: "Place Landfills & heavy industry down the road away from residential blocks.",
        deltaHappiness: -pen,
      });
    }

    if (m.crimeUnlocked && m.crimeRate > 12) {
      const pen = Math.round(m.crimeRate * 0.28);
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
      const pen = Math.round((75 - m.defenseRating) * 0.25);
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
      const disrepairRatio = m.disrepairCount / Math.max(1, elements.length);
      const pen = Math.max(4, Math.min(35, Math.round(m.disrepairCount * 4 + disrepairRatio * 30)));
      happiness -= pen;
      diags.push({
        id: "disrepair",
        severity: pen >= 14 ? "critical" : "warning",
        title: `${m.disrepairCount} Building${m.disrepairCount > 1 ? "s" : ""} Need Maintenance`,
        detail: "In Survival Mode, service buildings need maintenance every 5 active minutes.",
        fixHint: "Click buildings with an amber wrench or press 'Maintain All' in the top bar.",
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
        fixHint: "Select burning buildings to extinguish them or build a Fire Department nearby!",
        deltaHappiness: -pen,
      });
    }

    // Schools improve quality of life, particularly for small towns and families.
    if (m.connectedHouses > 0) happiness += Math.min(6, preschoolStrength * 1.5 + countrySchoolStrength);
    // Bonus for abundant parks, landmarks & faith
    if (m.recreationSupply > m.recreationDemand * 1.6 && m.connectedHouses > 0) {
      happiness += 5;
    }
  }

  state.happiness = Math.max(0, Math.min(100, happiness));

  if (diags.length === 0 && m.connectedHouses > 0) {
    diags.push({
      id: "thriving",
      severity: "good",
      title: "Civilization Thriving!",
      detail: "All citizen utilities, workplaces, groceries, schools, and parks are well balanced.",
      fixHint: "Keep expanding neighborhoods and merging twins to reach the next Stage!",
    });
  }

  // Survival Mode instant Game Over check: dropping below entry benchmark of highest reached stage (Stage 2+)
  if (state.mode === "survival" && state.highestStageReached >= 2) {
    const floorStage = STAGES[state.highestStageReached - 1];
    if (state.population < floorStage.minPop) {
      state.gameOver = true;
      state.gameOverReason = `Population fell to ${state.population.toLocaleString()}, below Stage ${floorStage.stage} (${floorStage.name}) minimum of ${floorStage.minPop.toLocaleString()}.`;
    }
  }

  state.metrics = m;
  state.diagnostics = diags;
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

function getElementDefenderContribution(el: PlacedElement): DefenderContribution | null {
  const def = ELEMENT_BY_ID[el.defId];
  if (!def || el.onFire || !el.connected) return null;
  const lvScale = 1 + (el.level - 1) * 0.55;
  const health = el.disrepair ? 0.45 : 1.0;
  const m = lvScale * health;

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

  for (const el of state.elements) {
    const c = getElementDefenderContribution(el);
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

export function launchIslandAttack(state: GameState, severityInput = 1): void {
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
    return d && !d.isNetwork && !d.passiveNature;
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

  for (const el of state.elements) {
    const c = getElementDefenderContribution(el);
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
  const buildingPool = state.elements.filter((e) => {
    const d = ELEMENT_BY_ID[e.defId];
    return d && !d.isNetwork && !d.passiveNature;
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
                targetEl.level -= 1;
                targetEl.animProgress = 0.8;
                targetEl.animKind = "place";
              } else {
                state.elements = state.elements.filter((e) => e.id !== targetEl!.id);
                atk.buildingsDestroyed += 1;
                if (tDef?.popBase) {
                  const lost = tDef.popBase * Math.pow(2, targetEl.level - 1);
                  atk.casualties += lost;
                  state.growthPool = Math.max(-state.population, state.growthPool - Math.max(5, lost * 2));
                } else if (state.population > 0) {
                  const lost = Math.min(state.population, 12);
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
  const elapsedSec = (Date.now() - atk.startedAt) / 1000;
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
    return e.connected && !e.onFire && (d?.policeRadius ?? 0) > 0;
  });
  let nearestPolice: PlacedElement | null = null;
  let bestDist = Infinity;
  for (const p of policeStations) {
    const d = Math.hypot(p.gx - victim.gx, p.gz - victim.gz);
    if (d < bestDist) {
      bestDist = d;
      nearestPolice = p;
    }
  }

  state.crimeIncidents.push({
    id: `crm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    targetElementId: victim.id,
    targetGx: victim.gx,
    targetGz: victim.gz,
    policeOriginId: nearestPolice?.id ?? null,
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
  state.activePlaySec += dtSec;

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
    }
  }

  // Rain & Storm gently help extinguish building fires!
  if (state.weather === "rain" || state.weather === "storm") {
    for (const el of state.elements) {
      if (el.onFire && Math.random() < dtSec * 0.28) {
        el.onFire = false;
        dirty = true;
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
      if (inc.policeOriginId && !inc.policeArrived && inc.progressSec >= Math.min(5.0, inc.maxSec * 0.4)) {
        inc.policeArrived = true;
        dirty = true;
      }
      if (inc.progressSec >= inc.maxSec) {
        if (inc.policeArrived) {
          if (state.mode !== "god") state.money += 25;
        } else if (state.mode !== "god") {
          state.money = Math.max(0, state.money - 35);
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

  if (state.mode === "god") {
    if (dirty) recomputeConnectivityAndMetrics(state);
    return dirty;
  }

  // 1. Survival Mode 5-minute active maintenance timers
  if (state.mode === "survival") {
    for (const el of state.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      if (!def?.needsMaintenance || !el.connected) continue;
      el.maintTimerSec += dtSec;
      if (el.maintTimerSec >= MAINTENANCE_INTERVAL_SEC && !el.disrepair) {
        el.disrepair = true;
        dirty = true;
      }
    }
  }

  // 2. Fire Departments automatically extinguish nearby fires over a few seconds
  for (const el of state.elements) {
    if (el.onFire && el.hasFireCover && Math.random() < dtSec * 0.45) {
      el.onFire = false;
      dirty = true;
    }
  }

  // 3. Survival Mode: < 50% Happiness triggers early crime & fires + rapid population loss!
  if (state.mode === "survival" && state.happiness < 50 && state.metrics.connectedHouses > 0) {
    if (Math.random() < dtSec * 0.22) {
      const candidates = state.elements.filter((e) => {
        const d = ELEMENT_BY_ID[e.defId];
        return e.connected && !e.onFire && !d?.isNetwork && !d?.passiveNature && !e.hasFireCover;
      });
      if (candidates.length > 0) {
        const victim = candidates[Math.floor(Math.random() * candidates.length)];
        victim.onFire = true;
        const vDef = ELEMENT_BY_ID[victim.defId];
        pushToast(
          state,
          "alert",
          `Unrest Fire at ${vDef?.name ?? "Building"}!`,
          "Happiness fell below 50% — restore services or dispatch Fire Dept fast!",
        );
        dirty = true;
      }
    }
  }

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
    state.money += state.metrics.netIncomePerTick * (dtSec * 0.45);

    let baseHousingPop = 0;
    for (const el of state.elements) {
      const def = ELEMENT_BY_ID[el.defId];
      if (el.connected && !el.onFire && def?.popBase) {
        baseHousingPop += def.popBase * Math.pow(2, el.level - 1);
      }
    }

    if (state.happiness >= 72 && state.metrics.burningCount === 0) {
      // Smooth thriving growth toward neighborhood settlement capacity
      const happyFactor = (state.happiness - 65) / 35;
      const growthRate = Math.max(1.2, baseHousingPop * 0.28) * happyFactor;
      state.growthPool += growthRate * dtSec;
      dirty = true;
    } else if (state.happiness < 65) {
      // Happiness below 65%: citizens leave slowly (or rapidly if < 50% in Survival / fires active!)
      const severity = (65 - state.happiness) / 65;
      const fireAccel = state.mode === "survival" && (state.happiness < 50 || state.metrics.burningCount > 0) ? 3.4 : 1.0;
      const lossRate = Math.max(1.5, state.population * 0.025 + 4) * severity * fireAccel;
      state.growthPool -= lossRate * dtSec;
      dirty = true;
    }
  }

  if (dirty) {
    recomputeConnectivityAndMetrics(state);
  }
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

  const providers: { el: PlacedElement; rad: number; strength: number }[] = [];
  const consumers: PlacedElement[] = [];

  for (const el of state.elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def) continue;

    if (kind === "water") {
      if ((def.water ?? 0) > 0) providers.push({ el, rad: 12 + el.level * 2, strength: 1 });
      else if ((def.water ?? 0) < 0 || def.popBase) consumers.push(el);
    } else if (kind === "power") {
      if ((def.power ?? 0) > 0) providers.push({ el, rad: 12 + el.level * 2, strength: 1 });
      else if ((def.power ?? 0) < 0 || def.popBase) consumers.push(el);
    } else if (kind === "jobs") {
      if ((def.jobs ?? 0) > 0) providers.push({ el, rad: 11 + el.level * 1.8, strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "waste") {
      if ((def.waste ?? 0) > 0) {
        providers.push({ el, rad: 13 + el.level * 2, strength: 0.9 });
        if (def.nuisanceRadius) {
          paintRadius(el.gx + el.spanX * 0.5, el.gz + el.spanZ * 0.5, def.nuisanceRadius, -0.95);
        }
      } else if (def.popBase || def.jobs) {
        consumers.push(el);
      }
    } else if (kind === "food") {
      if ((def.food ?? 0) > 0) providers.push({ el, rad: 11 + el.level * 1.8, strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "education") {
      if ((def.education ?? 0) > 0) providers.push({ el, rad: 12 + el.level * 2, strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "parks") {
      if ((def.recreation ?? 0) > 0) providers.push({ el, rad: 9 + el.level * 1.5, strength: 1 });
      else if (def.popBase) consumers.push(el);
    } else if (kind === "police") {
      if ((def.policeRadius ?? 0) > 0) {
        const rad = (def.policeRadius ?? 10) * (1 + (el.level - 1) * 0.18);
        providers.push({ el, rad, strength: 1 });
      } else if (def.popBase || def.jobs) {
        consumers.push(el);
      }
    } else if (kind === "fire") {
      if ((def.fireRadius ?? 0) > 0) {
        const rad = (def.fireRadius ?? 12) * (1 + (el.level - 1) * 0.18);
        providers.push({ el, rad, strength: 1 });
      } else if (!def.isNetwork && !def.passiveNature) {
        consumers.push(el);
      }
    } else if (kind === "defense") {
      if (def.military || def.id === "swat_team_hq") {
        providers.push({ el, rad: 16 + el.level * 2.5, strength: 1 });
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

export function maintainElement(state: GameState, id: string): boolean {
  const el = state.elements.find((e) => e.id === id);
  if (!el) return false;
  el.maintTimerSec = 0;
  el.disrepair = false;
  if (el.onFire) {
    el.onFire = false;
  }
  el.animProgress = 0.65;
  el.animKind = "place";
  recomputeConnectivityAndMetrics(state);
  return true;
}

export function maintainAllElements(state: GameState): number {
  let count = 0;
  for (const el of state.elements) {
    const def = ELEMENT_BY_ID[el.defId];
    if (el.disrepair || el.onFire || (def?.needsMaintenance && el.maintTimerSec > 30)) {
      el.maintTimerSec = 0;
      el.disrepair = false;
      el.onFire = false;
      count += 1;
    }
  }
  if (count > 0) {
    recomputeConnectivityAndMetrics(state);
  }
  return count;
}
