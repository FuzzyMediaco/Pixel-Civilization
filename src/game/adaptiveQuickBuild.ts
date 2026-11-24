import { readPlayerItem, writePlayerItem } from "./deviceSaves";
/**
 * Adaptive & Context-Aware Quick-Build Recommendation Engine.
 *
 * Powers the two-stage empty-tile radial spiral menu:
 *  Stage 1: Recommends 6 adaptive element categories based on:
 *    - City needs & urgent diagnostics (power, water, food, waste, jobs, housing, safety, roads)
 *    - Spatial / terrain / neighbor context right around the tapped tile (gx, gz)
 *    - Current game stage, population & mode
 *    - Learned player building habits (persisted per-category, per-element, recency & spatial context)
 *    - Affordability & actual placeability at (gx, gz)
 *  Stage 2: Recommends 6 adaptive elements inside the chosen category using real parcel edge
 *    synergy (`getParcelEdges`), city need match, stage fit, role diversity, and player habits.
 */
import {
  type CivElementDef,
  ELEMENTS,
  ELEMENT_BY_ID,
  type ElementCategory,
} from "./catalog";
import { constructionCost, buildingCharges } from "./cityEconomy";
import { alertIssues, suppliesNeed, type FixNeed } from "./cityIssues";
import { isCustomElementId } from "./customElements";
import { getParcelEdges } from "./parcelEdges";
import {
  buildOccupancyMap,
  buildingLockReason,
  isWaterTile,
  planConstruction,
  type GameState,
  type PlacedElement,
} from "./simulation";
import { getTerrainCell } from "./terrain";
import type { SmartBuildFocus } from "./quickMenuPrefs";

export type QuickBuildCategoryId = ElementCategory | "custom";

function focusMultipliers(focus: SmartBuildFocus): { need: number; habit: number; local: number } {
  switch (focus) {
    case "needs":
      return { need: 1.45, habit: 0.72, local: 0.9 };
    case "habits":
      return { need: 0.85, habit: 1.65, local: 0.95 };
    case "local":
      return { need: 0.9, habit: 0.82, local: 1.5 };
    default:
      return { need: 1, habit: 1, local: 1 };
  }
}

export interface PlayerBuildHabits {
  categoryCounts: Record<string, number>;
  elementCounts: Record<string, number>;
  recentElements: string[];
  recentCategories: string[];
  /** Tracks category choices by spatial context tag (e.g. "near_road", "waterfront", "near_housing"). */
  contextPairs: Record<string, Record<string, number>>;
}

export interface TileSpatialContext {
  gx: number;
  gz: number;
  isWater: boolean;
  isShoreline: boolean;
  adjRoad: boolean;
  adjRail: boolean;
  adjHousing: boolean;
  adjCommerce: boolean;
  adjFarm: boolean;
  adjCivic: boolean;
  adjFaith: boolean;
  nearbyHousing: number;
  nearbyCommerce: number;
  nearbyFarm: number;
  nearbyPower: number;
  nearbyRoads: number;
  needsLocalPolice: boolean;
  needsLocalFire: boolean;
  contextTag: string;
}

export interface QuickCategorySuggestion {
  category: QuickBuildCategoryId;
  score: number;
  reason: string;
  urgent: boolean;
  topDefId: string;
}

export interface QuickElementSuggestion {
  def: CivElementDef;
  cost: number;
  canAfford: boolean;
  score: number;
  reason: string;
}

const HABITS_STORAGE_KEY = "pixel_civ_build_habits_v1";

export const ALL_QUICK_CATEGORIES: QuickBuildCategoryId[] = [
  "housing",
  "roads_transit",
  "commerce",
  "agriculture",
  "power_waste",
  "water_util",
  "civic_parks",
  "police_military",
  "faith",
  "maritime",
  "nature_terrain",
  "landmarks",
  "wealth_projects",
  "custom",
];

export function createEmptyBuildHabits(): PlayerBuildHabits {
  return {
    categoryCounts: {},
    elementCounts: {},
    recentElements: [],
    recentCategories: [],
    contextPairs: {},
  };
}

export function loadBuildHabits(): PlayerBuildHabits {
  try {
    if (typeof localStorage === "undefined") return createEmptyBuildHabits();
    const raw = readPlayerItem(HABITS_STORAGE_KEY);
    if (!raw) return createEmptyBuildHabits();
    const parsed = JSON.parse(raw) as Partial<PlayerBuildHabits>;
    return {
      categoryCounts: parsed.categoryCounts && typeof parsed.categoryCounts === "object" ? parsed.categoryCounts : {},
      elementCounts: parsed.elementCounts && typeof parsed.elementCounts === "object" ? parsed.elementCounts : {},
      recentElements: Array.isArray(parsed.recentElements) ? parsed.recentElements.slice(0, 20) : [],
      recentCategories: Array.isArray(parsed.recentCategories) ? parsed.recentCategories.slice(0, 20) : [],
      contextPairs: parsed.contextPairs && typeof parsed.contextPairs === "object" ? parsed.contextPairs : {},
    };
  } catch {
    return createEmptyBuildHabits();
  }
}

export function saveBuildHabits(habits: PlayerBuildHabits): void {
  try {
    if (typeof localStorage === "undefined") return;
    writePlayerItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  } catch {
    // Ignore private-mode / quota errors
  }
}

export function recordBuildHabit(
  habits: PlayerBuildHabits,
  def: CivElementDef,
  contextTag?: string,
): PlayerBuildHabits {
  const cat: QuickBuildCategoryId = isCustomElementId(def.id)
    ? "custom"
    : def.category;

  const next: PlayerBuildHabits = {
    categoryCounts: { ...habits.categoryCounts, [cat]: (habits.categoryCounts[cat] ?? 0) + 1 },
    elementCounts: { ...habits.elementCounts, [def.id]: (habits.elementCounts[def.id] ?? 0) + 1 },
    recentElements: [def.id, ...habits.recentElements.filter((x) => x !== def.id)].slice(0, 20),
    recentCategories: [cat, ...habits.recentCategories].slice(0, 20),
    contextPairs: { ...habits.contextPairs },
  };

  if (contextTag) {
    const prevCtx = next.contextPairs[contextTag] ?? {};
    next.contextPairs[contextTag] = {
      ...prevCtx,
      [cat]: (prevCtx[cat] ?? 0) + 1,
    };
  }

  return next;
}

/** Inspect terrain, orthogonal neighbors, neighborhood composition, and local safety gaps around (gx, gz). */
export function analyzeTileContext(state: GameState, gx: number, gz: number): TileSpatialContext {
  const occ = buildOccupancyMap(state.elements);
  const isWater = isWaterTile(occ, gx, gz, state);
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let isShoreline = false;
  let adjRoad = false;
  let adjRail = false;
  let adjHousing = false;
  let adjCommerce = false;
  let adjFarm = false;
  let adjCivic = false;
  let adjFaith = false;

  for (const [dx, dz] of dirs) {
    const nx = gx + dx;
    const nz = gz + dz;
    if (!isWater && isWaterTile(occ, nx, nz, state)) isShoreline = true;
    const el = occ.get(`${nx},${nz}`);
    if (!el) continue;
    const d = ELEMENT_BY_ID[el.defId];
    if (!d) continue;
    if (d.isRoadNetwork) adjRoad = true;
    if (d.isRailNetwork) adjRail = true;
    if (d.category === "housing") adjHousing = true;
    if (d.category === "commerce") adjCommerce = true;
    if (d.category === "agriculture") adjFarm = true;
    if (d.category === "civic_parks") adjCivic = true;
    if (d.category === "faith") adjFaith = true;
    if (d.isWaterFeature && !isWater) isShoreline = true;
  }

  let nearbyHousing = 0;
  let nearbyCommerce = 0;
  let nearbyFarm = 0;
  let nearbyPower = 0;
  let nearbyRoads = 0;
  let coveredPolice = false;
  let coveredFire = false;

  for (const el of state.elements) {
    const d = ELEMENT_BY_ID[el.defId];
    if (!d) continue;
    const cx = el.gx + el.spanX * 0.5;
    const cz = el.gz + el.spanZ * 0.5;
    const dist = Math.hypot(cx - (gx + 0.5), cz - (gz + 0.5));
    if (dist <= 4.5) {
      if (d.category === "housing") nearbyHousing++;
      if (d.category === "commerce") nearbyCommerce++;
      if (d.category === "agriculture") nearbyFarm++;
      if (d.category === "power_waste") nearbyPower++;
      if (d.isRoadNetwork) nearbyRoads++;
    }
    if ((d.policeRadius ?? 0) > 0 && dist <= (d.policeRadius ?? 0) + el.level * 1.5) coveredPolice = true;
    if ((d.fireRadius ?? 0) > 0 && dist <= (d.fireRadius ?? 0) + el.level * 1.5) coveredFire = true;
  }

  const inhabitedNearby = nearbyHousing + nearbyCommerce >= 2;
  const needsLocalPolice = inhabitedNearby && !coveredPolice && (state.mode === "god" || state.currentStage >= 4);
  const needsLocalFire = inhabitedNearby && !coveredFire && (state.mode === "god" || state.currentStage >= 3);

  const contextTag = isWater
    ? "on_water"
    : isShoreline
      ? "waterfront"
      : adjRail
        ? "near_rail"
        : adjFarm
          ? "near_farm"
          : adjRoad && adjHousing
            ? "near_housing"
            : adjRoad
              ? "near_road"
              : state.elements.length === 0
                ? "fresh_island"
                : "isolated";

  return {
    gx,
    gz,
    isWater,
    isShoreline,
    adjRoad,
    adjRail,
    adjHousing,
    adjCommerce,
    adjFarm,
    adjCivic,
    adjFaith,
    nearbyHousing,
    nearbyCommerce,
    nearbyFarm,
    nearbyPower,
    nearbyRoads,
    needsLocalPolice,
    needsLocalFire,
    contextTag,
  };
}

/** Check whether `def` can physically be placed at (gx, gz) ignoring treasury (so affordability can be scored separately). */
function canSpatiallyPlaceAt(state: GameState, def: CivElementDef, gx: number, gz: number, level: number): boolean {
  const richState: GameState =
    state.mode === "god"
      ? state
      : { ...state, money: Math.max(state.money, def.cost + 1_000_000) };
  return planConstruction(richState, def, gx, gz, level, 0, false).valid;
}

function elementsInQuickCategory(category: QuickBuildCategoryId): CivElementDef[] {
  if (category === "custom") return ELEMENTS.filter((d) => isCustomElementId(d.id));
  return ELEMENTS.filter((d) => !isCustomElementId(d.id) && d.category === category);
}

/** Map active city issues & population limiters into boosted categories + priority FixNeeds. */
function collectCityNeedSignals(state: GameState): {
  categoryBoost: Map<QuickBuildCategoryId, { boost: number; reason: string; urgent: boolean }>;
  activeNeeds: Set<FixNeed>;
} {
  const categoryBoost = new Map<QuickBuildCategoryId, { boost: number; reason: string; urgent: boolean }>();
  const activeNeeds = new Set<FixNeed>();
  const bump = (cat: QuickBuildCategoryId, boost: number, reason: string, urgent: boolean) => {
    const prev = categoryBoost.get(cat);
    if (!prev || boost > prev.boost) {
      categoryBoost.set(cat, { boost, reason, urgent: urgent || Boolean(prev?.urgent) });
    }
  };

  const issues = alertIssues(state);
  for (const issue of issues) {
    const urgent = issue.severity === "critical";
    const weight = urgent ? 52 : 34;
    const need = issue.fix?.need;
    if (need) activeNeeds.add(need);

    if (need === "power") bump("power_waste", weight, "Power needed", urgent);
    else if (need === "waste") bump("power_waste", weight - 2, "Waste capacity low", urgent);
    else if (need === "water") bump("water_util", weight, "Water needed", urgent);
    else if (need === "food") bump("agriculture", weight - 2, "Food supply low", urgent);
    else if (need === "jobs") bump("commerce", weight - 4, "Jobs needed", urgent);
    else if (need === "population") bump("housing", weight - 2, "Homes needed", urgent);
    else if (need === "education") bump("civic_parks", weight - 6, "Schools needed", urgent);
    else if (need === "recreation") bump("civic_parks", weight - 8, "Parks boost happiness", urgent);
    else if (need === "government") bump("civic_parks", weight - 4, "Civic office needed", urgent);
    else if (need === "policeRadius") bump("police_military", weight - 2, "Police needed", urgent);
    else if (need === "fireRadius") bump("police_military", weight, "Fire cover needed", urgent);
    else if (need === "military") bump("police_military", weight, "Defense needed", urgent);
    else if (issue.fix?.category === "roads_transit") bump("roads_transit", weight, "Connect roads", urgent);
    else if (issue.fix?.category === "maritime") bump("maritime", weight - 6, "Build harbor", urgent);
  }

  // Also check proactive population limiter before it becomes critical
  const lim = state.metrics?.populationLimiter;
  if (lim && lim.cap > 0 && state.population >= lim.cap * 0.8) {
    switch (lim.limitingNeed) {
      case "housing":
        activeNeeds.add("population");
        bump("housing", 40, "Grow population", false);
        break;
      case "jobs":
        activeNeeds.add("jobs");
        bump("commerce", 38, "More jobs to grow", false);
        break;
      case "food":
        activeNeeds.add("food");
        bump("agriculture", 38, "More food to grow", false);
        break;
      case "water":
        activeNeeds.add("water");
        bump("water_util", 40, "More water to grow", false);
        break;
      case "power":
        activeNeeds.add("power");
        bump("power_waste", 40, "More power to grow", false);
        break;
      case "waste":
        activeNeeds.add("waste");
        bump("power_waste", 36, "Waste cap near limit", false);
        break;
    }
  }

  // Subtle balance nudges when starting out
  const m = state.metrics;
  if (state.elements.length > 0) {
    const hasRoad = state.elements.some((e) => Boolean(ELEMENT_BY_ID[e.defId]?.isRoadNetwork));
    const hasHousing = state.elements.some((e) => ELEMENT_BY_ID[e.defId]?.category === "housing");
    if (!hasRoad) bump("roads_transit", 48, "Start a street", true);
    if (!hasHousing) bump("housing", 42, "Build first homes", false);
    if (m.foodSupply <= 0 && hasHousing) {
      activeNeeds.add("food");
      bump("agriculture", 34, "Feed residents", false);
    }
    if (m.jobsAvailable <= 0 && hasHousing) {
      activeNeeds.add("jobs");
      bump("commerce", 32, "Create jobs", false);
    }
    if (m.waterDemand > 0 && m.waterSupply < m.waterDemand) {
      activeNeeds.add("water");
      bump("water_util", 68, "Water shortage", true);
    } else if (m.waterSupply <= 0 && hasHousing) {
      activeNeeds.add("water");
      bump("water_util", 38, "Add water supply", false);
    }
    if (m.powerDemand > 0 && m.powerSupply < m.powerDemand) {
      activeNeeds.add("power");
      bump("power_waste", 70, "Power shortfall", true);
    }
  }

  return { categoryBoost, activeNeeds };
}

/**
 * Stage 1 of the Quick-Build Spiral Menu:
 * Returns up to 6 intelligently and adaptively ranked element categories for the tapped empty tile.
 */
export function recommendQuickCategories(
  state: GameState,
  gx: number,
  gz: number,
  habits: PlayerBuildHabits,
  limit = 6,
  focus: SmartBuildFocus = "balanced",
): QuickCategorySuggestion[] {
  const ctx = analyzeTileContext(state, gx, gz);
  const { categoryBoost } = collectCityNeedSignals(state);
  const charges = buildingCharges(state);
  const stage = state.currentStage;
  const pop = state.population;
  const isFresh = state.elements.length === 0;
  const placeLevel = 1;
  const mult = focusMultipliers(focus);

  const totalHabitCount = Math.max(
    1,
    Object.values(habits.categoryCounts).reduce((a, b) => a + b, 0),
  );
  const ctxHabits = habits.contextPairs[ctx.contextTag] ?? {};

  const scored: QuickCategorySuggestion[] = [];

  for (const cat of ALL_QUICK_CATEGORIES) {
    const defs = elementsInQuickCategory(cat);
    if (defs.length === 0) continue;

    // Must have at least 1 unlocked & spatially valid element at (gx, gz)
    const placeable: CivElementDef[] = [];
    for (const d of defs) {
      if (buildingLockReason(d, state)) continue;
      if (canSpatiallyPlaceAt(state, d, gx, gz, placeLevel)) {
        placeable.push(d);
      }
    }
    if (placeable.length === 0) continue;

    const affordable = placeable.filter((d) => constructionCost(state, d) <= Math.max(0, state.money));

    let score = 10;
    let reason = "Fits this spot";
    let bestSignalWeight = 0;
    let urgent = false;

    const addReason = (w: number, text: string) => {
      if (w > bestSignalWeight) {
        bestSignalWeight = w;
        reason = text;
      }
    };

    // 1. City Needs & Diagnostics
    const needSig = categoryBoost.get(cat);
    if (needSig) {
      const nb = needSig.boost * mult.need;
      score += nb;
      urgent = needSig.urgent;
      addReason(nb, needSig.reason);
    }

    // 2. Spatial & Neighbor Context at (gx, gz)
    const beforeLocal = score;
    if (ctx.isWater) {
      if (cat === "maritime") { score += 54; addReason(54, "Harbor & boats"); }
      else if (cat === "roads_transit") { score += 42; addReason(42, "Bridge over water"); }
      else if (cat === "water_util") { score += 24; addReason(24, "Water intake"); }
      else if (cat === "power_waste") { score += 20; addReason(20, "Hydro power"); }
      else if (cat === "nature_terrain") { score += 16; addReason(16, "Water feature"); }
    } else if (isFresh) {
      if (cat === "roads_transit") { score += 44; addReason(44, "Start with a street"); }
      else if (cat === "housing") { score += 40; addReason(40, "First homes"); }
      else if (cat === "agriculture") { score += 32; addReason(32, "Early food"); }
      else if (cat === "commerce") { score += 30; addReason(30, "First shops"); }
      else if (cat === "water_util") { score += 26; addReason(26, "Water supply"); }
      else if (cat === "power_waste") { score += 24; addReason(24, "Starter power"); }
      else if (cat === "nature_terrain") { score += 12; addReason(12, "Landscape"); }
    } else {
      if (ctx.isShoreline) {
        if (cat === "maritime") { score += 38; addReason(38, "Waterfront pier"); }
        else if (cat === "water_util") { score += 28; addReason(28, "Waterfront pump"); }
        else if (cat === "nature_terrain") { score += 16; addReason(16, "Beach & shore"); }
        else if (cat === "housing") { score += 12; addReason(12, "Waterfront homes"); }
      }
      if (ctx.adjRail) {
        if (cat === "roads_transit") { score += 42; addReason(42, "Beside rail line"); }
        else if (cat === "commerce") { score += 22; addReason(22, "Station commerce"); }
        else if (cat === "power_waste") { score += 16; addReason(16, "Rail freight"); }
      }
      if (ctx.adjFarm || ctx.nearbyFarm >= 2) {
        if (cat === "agriculture") { score += 34; addReason(34, "Expand farmland"); }
        else if (cat === "water_util") { score += 18; addReason(18, "Irrigate fields"); }
      }
      if (ctx.adjRoad) {
        if (cat === "housing") { score += 28; addReason(28, "Ready street lot"); }
        else if (cat === "commerce") { score += 26; addReason(26, "Streetfront shop"); }
        else if (cat === "roads_transit") { score += 22; addReason(22, "Extend street"); }
        else if (cat === "civic_parks" && ctx.nearbyHousing >= 1) { score += 20; addReason(20, "Neighborhood park"); }
        else if (cat === "faith" && ctx.nearbyHousing >= 2) { score += 14; addReason(14, "Community sanctuary"); }
      } else {
        // Isolated land tile away from roads
        if (cat === "roads_transit") { score += 34; addReason(34, "Extend road here"); }
        else if (cat === "agriculture") { score += 20; addReason(20, "Open farmland"); }
        else if (cat === "nature_terrain") { score += 18; addReason(18, "Natural terrain"); }
        else if (cat === "power_waste") { score += 14; addReason(14, "Utility site"); }
      }
      if (ctx.needsLocalPolice || ctx.needsLocalFire) {
        if (cat === "police_military") {
          const boost = ctx.needsLocalFire ? 26 : 22;
          score += boost;
          addReason(boost, ctx.needsLocalFire ? "Unprotected block" : "Needs patrol cover");
        }
      }
      if (ctx.adjHousing && cat === "civic_parks") {
        score += 12;
        addReason(18, "Near homes");
      }
      if (ctx.adjCommerce && cat === "commerce") {
        score += 10;
        addReason(16, "Grow market row");
      }
      if (ctx.adjCivic && (cat === "civic_parks" || cat === "landmarks")) {
        score += 12;
        addReason(16, "Civic plaza");
      }
      if (ctx.adjFaith && cat === "faith") {
        score += 14;
        addReason(18, "Sacred precinct");
      }
    }
    if (mult.local !== 1) {
      score = beforeLocal + (score - beforeLocal) * mult.local;
    }

    // 3. Stage & Population Progression
    if (stage <= 2 && pop < 15_000) {
      if (cat === "housing" || cat === "roads_transit" || cat === "agriculture" || cat === "commerce") score += 10;
      if (cat === "water_util" || cat === "power_waste") score += 7;
    } else if (stage <= 5) {
      if (cat === "civic_parks" || cat === "police_military" || cat === "roads_transit") score += 10;
      if (cat === "housing" || cat === "commerce") score += 6;
    } else if (stage <= 9) {
      if (cat === "power_waste" || cat === "civic_parks" || cat === "police_military" || cat === "faith") score += 9;
      if (cat === "landmarks") score += 8;
    } else {
      if (cat === "landmarks" || cat === "wealth_projects" || cat === "police_military") score += 12;
      if (cat === "civic_parks" || cat === "commerce") score += 7;
    }

    if (state.mode === "god") {
      if (cat === "landmarks" || cat === "nature_terrain") score += 6;
      if (cat === "custom") { score += 16; addReason(16, "Your Pix creation"); }
    } else if (cat === "custom") {
      score += 14;
      addReason(14, "Your Pix creation");
    }

    // 4. Learned Player Habits (frequency + recency + spatial context pair)
    const count = habits.categoryCounts[cat] ?? 0;
    if (count > 0) {
      const freqShare = count / totalHabitCount;
      const freqBoost = Math.min(14, Math.log1p(count) * 3.8 + freqShare * 10) * mult.habit;
      score += freqBoost;
    }
    const recentIdx = habits.recentCategories.indexOf(cat);
    if (recentIdx >= 0 && recentIdx < 10) {
      const recencyBoost = Math.max(2, 11 - recentIdx) * mult.habit;
      score += recencyBoost;
      if (recentIdx <= 1 && bestSignalWeight < 18) addReason(recencyBoost, "Recently built");
    }
    const ctxCount = ctxHabits[cat] ?? 0;
    if (ctxCount > 0) {
      const pairBoost = Math.min(12, Math.log1p(ctxCount) * 5.2) * mult.habit;
      score += pairBoost;
      if (ctxCount >= 2 && bestSignalWeight < 20) addReason(pairBoost + 10, "Your usual pick here");
    }

    // 5. Affordability in Real / Survival
    if (charges && affordable.length === 0) {
      score -= 28;
    } else if (charges && affordable.length > 0) {
      score += 8;
    }

    const rep = (affordable[0] ?? placeable[0]).id;
    scored.push({
      category: cat,
      score,
      reason,
      urgent,
      topDefId: rep,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));
  return scored.slice(0, limit);
}

/** Determine distinct sub-role inside a category so the 6 spiral picks offer smart variety. */
function elementRoleBucket(def: CivElementDef): string {
  if (def.isRailNetwork || def.id.includes("train")) return "rail";
  if (def.id.includes("bus") || def.id.includes("taxi")) return "transit_stop";
  if (def.archetype.startsWith("bridge")) return "bridge";
  if (def.id.includes("highway") || def.id.includes("freeway") || def.id.includes("over_pass")) return "highway";
  if (def.id.includes("path") || def.id.includes("trail") || def.id.includes("side_walk")) return "walk";
  if (def.isRoadNetwork) return "street";
  if ((def.fireRadius ?? 0) > 0 && !(def.policeRadius ?? 0)) return "fire";
  if ((def.policeRadius ?? 0) > 0) return "police";
  if ((def.military ?? 0) > 0) return "military";
  if ((def.waste ?? 0) > 0 && (def.power ?? 0) <= 0) return "waste";
  if ((def.power ?? 0) > 0) return "power";
  if ((def.education ?? 0) > 0) return "education";
  if ((def.government ?? 0) > 0) return "government";
  if ((def.recreation ?? 0) > 0) return "park";
  if (def.archetype) return def.archetype;
  return def.id;
}

/**
 * Stage 2 of the Quick-Build Spiral Menu:
 * Returns up to 6 intelligently and adaptively ranked elements inside `category` for `(gx, gz)`.
 */
export function recommendQuickElements(
  state: GameState,
  category: QuickBuildCategoryId,
  gx: number,
  gz: number,
  habits: PlayerBuildHabits,
  limit = 6,
  focus: SmartBuildFocus = "balanced",
): QuickElementSuggestion[] {
  const ctx = analyzeTileContext(state, gx, gz);
  const { activeNeeds } = collectCityNeedSignals(state);
  const charges = buildingCharges(state);
  const stage = state.currentStage;
  const occ = buildOccupancyMap(state.elements);
  const placeLevel = 1;
  const mult = focusMultipliers(focus);

  // Check if the terrain cell has a coastal/river elevation hint
  const cell = getTerrainCell(state, gx, gz);
  const defs = elementsInQuickCategory(category);
  const candidates: QuickElementSuggestion[] = [];

  for (const def of defs) {
    if (buildingLockReason(def, state)) continue;
    if (!canSpatiallyPlaceAt(state, def, gx, gz, placeLevel)) continue;

    const cost = constructionCost(state, def);
    const canAfford = constructionCost(state, def) <= Math.max(0, state.money);

    let score = 15;
    let reason = "Good fit here";
    let bestW = 0;
    const setReason = (w: number, text: string) => {
      if (w > bestW) {
        bestW = w;
        reason = text;
      }
    };

    // 1. Direct City Need Match (critical power/water shortfalls get top priority over general category matches)
    const m = state.metrics;
    if (m.powerDemand > 0 && m.powerSupply < m.powerDemand && (def.power ?? 0) > 0) {
      score += 56 * mult.need;
      setReason(56 * mult.need, "Fixes power shortage");
    } else if (m.waterDemand > 0 && m.waterSupply < m.waterDemand && (def.water ?? 0) > 0) {
      score += 56 * mult.need;
      setReason(56 * mult.need, "Fixes water shortage");
    } else {
      for (const need of activeNeeds) {
        if (suppliesNeed(def, need)) {
          score += 36 * mult.need;
          setReason(36 * mult.need, `Supplies ${need === "policeRadius" ? "police" : need === "fireRadius" ? "fire cover" : need}`);
          break;
        }
      }
    }

    // 2. Real Parcel Edge Synergy at (gx, gz)
    const plan = planConstruction(
      state.mode === "god" ? state : { ...state, money: Math.max(state.money, def.cost + 1_000_000) },
      def,
      gx,
      gz,
      placeLevel,
      0,
      false,
    );
    if (plan.valid) {
      const probe: PlacedElement = {
        id: "__quick_probe__",
        defId: def.id,
        gx,
        gz,
        spanX: plan.spanX,
        spanZ: plan.spanZ,
        rotation: plan.rotation,
        level: plan.level,
        variant: 0,
        connected: false,
        hasPoliceCover: false,
        hasFireCover: false,
        nuisancePenalty: 0,
        maintTimerSec: 0,
        disrepair: false,
        onFire: false,
        animProgress: 0,
        animKind: "place",
      };
      const edges = getParcelEdges(probe, occ, state);
      if (edges.length > 0) {
        let synBoost = 0;
        for (const e of edges) {
          if (e.kind === "platform") { synBoost = Math.max(synBoost, 40); setReason(40, "Joins rail line"); }
          else if (e.kind === "garden" || e.kind === "farm" || e.kind === "orchard") { synBoost = Math.max(synBoost, 30); setReason(30, "Neighbor synergy"); }
          else if (e.kind === "bus" || e.kind === "dock" || e.kind === "arcade" || e.kind === "party") { synBoost = Math.max(synBoost, 28); setReason(28, "Joins neighbor"); }
          else if (e.kind === "drive") { synBoost = Math.max(synBoost, 18); setReason(18, "Links to road"); }
          else if (e.kind === "ceremonial" || e.kind === "cloister" || e.kind === "walk") { synBoost = Math.max(synBoost, 16); setReason(16, "Scenic neighbor"); }
        }
        score += synBoost;
      }
    }

    // 3. Context-Specific Role Boosts
    if (category === "roads_transit") {
      if (ctx.isWater && def.archetype.startsWith("bridge")) { score += 45; setReason(45, "Spans water"); }
      if (ctx.adjRail && (def.id === "train_stops" || def.id === "train_depots" || def.isRailNetwork)) {
        score += 42;
        setReason(42, "Matches rail track");
      }
      if (!ctx.isWater && def.id === "roads") { score += 22; setReason(22, "Core street"); }
      if (!ctx.isWater && def.id === "two_lane_roads" && stage >= 3) { score += 20; setReason(20, "Wider avenue"); }
      if (ctx.adjRoad && (def.id === "bus_stops" || def.id === "taxi_ranks") && stage >= 4) {
        score += 20;
        setReason(20, "Curbside transit");
      }
    }
    if (category === "police_military") {
      if (ctx.needsLocalFire && (def.fireRadius ?? 0) > 0) { score += 28; setReason(28, "Fire coverage"); }
      if (ctx.needsLocalPolice && (def.policeRadius ?? 0) > 0) { score += 26; setReason(26, "Crime patrol"); }
      if (ctx.isShoreline && def.domain === "coast_or_water") { score += 24; setReason(24, "Coastal defense"); }
    }
    if (category === "water_util" && (ctx.isShoreline || ctx.isWater || cell.water === "fresh")) {
      if (def.id === "water_pumping_station" || def.id === "desalination_plant" || def.id === "hydro_electric_power_plants") {
        score += 24;
        setReason(24, "Waterfront intake");
      }
    }
    if (category === "housing" && ctx.isShoreline && def.id === "beach_houses") {
      score += 28;
      setReason(28, "Beachfront home");
    }

    // 4. Stage & Population Fit
    const stageDelta = Math.abs(def.stage - stage);
    if (state.mode === "god") {
      if (def.isStarter) score += 8;
      // Gently favor iconic / versatile builds across stages
      score += Math.max(0, 10 - stageDelta * 0.8);
    } else {
      if (def.stage <= stage) {
        score += Math.max(2, 16 - stageDelta * 1.6);
        if (def.isStarter && stage <= 3) score += 10;
      }
    }

    // 5. Player Element Habits & Recency
    const elCount = habits.elementCounts[def.id] ?? 0;
    if (elCount > 0) {
      const hBoost = Math.min(20, Math.log1p(elCount) * 6.5) * mult.habit;
      score += hBoost;
      if (elCount >= 2 && bestW < 22) setReason(hBoost + 8, "Frequent pick");
    }
    const rIdx = habits.recentElements.indexOf(def.id);
    if (rIdx >= 0 && rIdx < 12) {
      const rBoost = Math.max(3, 14 - rIdx) * mult.habit;
      score += rBoost;
      if (rIdx <= 2 && bestW < 20) setReason(rBoost + 8, "Recently built");
    }

    // 6. Affordability in Real / Survival
    if (charges) {
      if (canAfford) {
        score += 30;
        // Favor high bang-for-buck when treasury is tight
        if (constructionCost(state, def) <= state.money * 0.45) score += 6;
      } else {
        score -= 32;
      }
    }

    candidates.push({ def, cost, canAfford, score, reason });
  }

  candidates.sort((a, b) => b.score - a.score || a.cost - b.cost || a.def.name.localeCompare(b.def.name));

  // Diversity-aware top-6 selection: avoid filling all 6 slots with near-identical archetypes when other good roles exist
  const chosen: QuickElementSuggestion[] = [];
  const bucketCounts = new Map<string, number>();
  const deferred: QuickElementSuggestion[] = [];

  for (const item of candidates) {
    if (chosen.length >= limit) break;
    const bucket = elementRoleBucket(item.def);
    const seen = bucketCounts.get(bucket) ?? 0;
    if (seen < 2) {
      chosen.push(item);
      bucketCounts.set(bucket, seen + 1);
    } else {
      deferred.push(item);
    }
  }
  for (const item of deferred) {
    if (chosen.length >= limit) break;
    chosen.push(item);
  }

  return chosen;
}

/**
 * Super-Adaptive 2-Tap Quick-Build Engine ("Instant smart" mode):
 * Skips category picking and immediately surfaces up to 6 placeable elements tailored to:
 *  - Active city needs & crises (guarantees an affordable fix when power/water/food/safety is critical)
 *  - Current game stage, population & mode
 *  - Exact tapped location on the island (water, shoreline, beside rail, street lot, farm cluster, neighbor continuation)
 *  - Recent gameplay activity & learned building habits (repeat-build & block-continuation awareness)
 *  - Category diversity so the 6 icons cover the player's most likely immediate next actions.
 */
export function recommendInstantQuickElements(
  state: GameState,
  gx: number,
  gz: number,
  habits: PlayerBuildHabits,
  limit = 6,
  focus: SmartBuildFocus = "balanced",
): QuickElementSuggestion[] {
  const ctx = analyzeTileContext(state, gx, gz);
  const { activeNeeds } = collectCityNeedSignals(state);
  const charges = buildingCharges(state);
  const occ = buildOccupancyMap(state.elements);
  const mult = focusMultipliers(focus);

  // Inspect orthogonal neighbor defIds for effortless row/street/farm continuation
  const adjDefIds = new Set<string>();
  const adjDirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dz] of adjDirs) {
    const neighbor = occ.get(`${gx + dx},${gz + dz}`);
    if (neighbor) adjDefIds.add(neighbor.defId);
  }

  // 1. Gather top adaptive categories and their best elements at (gx, gz)
  const topCategories = recommendQuickCategories(state, gx, gz, habits, 8, focus);
  const catRankById = new Map<QuickBuildCategoryId, QuickCategorySuggestion>();
  for (const c of topCategories) catRankById.set(c.category, c);

  interface InstantPoolEntry {
    item: QuickElementSuggestion;
    category: QuickBuildCategoryId;
    urgentFix: boolean;
    combinedScore: number;
  }

  const poolById = new Map<string, InstantPoolEntry>();
  const m = state.metrics;
  const criticalPower = m.powerDemand > 0 && m.powerSupply < m.powerDemand;
  const criticalWater = m.waterDemand > 0 && m.waterSupply < m.waterDemand;

  const isSpecificUrgentFix = (def: CivElementDef, catSig?: QuickCategorySuggestion): boolean => {
    if (criticalPower && (def.power ?? 0) > 0) return true;
    if (criticalWater && (def.water ?? 0) > 0) return true;
    if (!catSig?.urgent) return false;
    if (catSig.category === "power_waste") {
      if (activeNeeds.has("power") && (def.power ?? 0) > 0) return true;
      if (activeNeeds.has("waste") && (def.waste ?? 0) > 0 && !criticalPower) return true;
      return false;
    }
    for (const need of activeNeeds) {
      if (suppliesNeed(def, need)) return true;
    }
    return false;
  };

  const considerItem = (item: QuickElementSuggestion, cat: QuickBuildCategoryId) => {
    const catSig = catRankById.get(cat);
    const catScore = catSig?.score ?? 25;
    const isUrgentFix = isSpecificUrgentFix(item.def, catSig);
    let solvesActiveNeed = false;
    for (const need of activeNeeds) {
      if (suppliesNeed(item.def, need)) {
        solvesActiveNeed = true;
        break;
      }
    }

    let combined = item.score + catScore * 0.62;
    let reason = item.reason;

    if (isUrgentFix) {
      combined += 38 * mult.need;
      reason = catSig?.reason ?? item.reason;
    } else if (solvesActiveNeed) {
      combined += 14 * mult.need;
    }

    // Gameplay activity & continuation boosts:
    // If the player just built this exact element, or tapped directly beside it, make continuing effortless
    const recentIdx = habits.recentElements.indexOf(item.def.id);
    if (recentIdx === 0) {
      combined += 48 * mult.habit;
      if (!isUrgentFix) reason = "Continue building";
    } else if (recentIdx === 1) {
      combined += 24 * mult.habit;
    } else if (recentIdx === 2) {
      combined += 12 * mult.habit;
    }

    if (adjDefIds.has(item.def.id)) {
      combined += 42 * mult.local;
      if (!isUrgentFix) reason = "Extend next door";
    } else if (ctx.adjRoad && item.def.isRoadNetwork && item.def.id === "roads") {
      combined += 12 * mult.local;
    }

    // On a completely fresh island, guarantee a classic balanced starter ring (road, home, farm, shop, water, power)
    if (state.elements.length === 0 && !ctx.isWater && item.def.isStarter) {
      combined += 12;
    }

    const prev = poolById.get(item.def.id);
    if (!prev || combined > prev.combinedScore) {
      poolById.set(item.def.id, {
        item: { ...item, score: combined, reason },
        category: cat,
        urgentFix: isUrgentFix && item.canAfford,
        combinedScore: combined,
      });
    }
  };

  for (const catSig of topCategories) {
    const els = recommendQuickElements(state, catSig.category, gx, gz, habits, 4, focus);
    for (const el of els) {
      considerItem(el, catSig.category);
    }
  }

  // Also explicitly evaluate orthogonal neighbor defIds & top 6 recent elements even if they weren't in a category's top 4
  const extraIds = new Set<string>([...adjDefIds, ...habits.recentElements.slice(0, 6)]);
  for (const defId of extraIds) {
    if (poolById.has(defId)) continue;
    const def = ELEMENT_BY_ID[defId];
    if (!def) continue;
    if (buildingLockReason(def, state)) continue;
    if (!canSpatiallyPlaceAt(state, def, gx, gz, 1)) continue;
    const cat: QuickBuildCategoryId = isCustomElementId(def.id) ? "custom" : def.category;
    const cost = constructionCost(state, def);
    const canAfford = constructionCost(state, def) <= Math.max(0, state.money);
    const baseScore = 44 + (canAfford ? 24 : -30);
    considerItem(
      {
        def,
        cost,
        canAfford,
        score: baseScore,
        reason: adjDefIds.has(def.id) ? "Extend next door" : "Recently built",
      },
      cat,
    );
  }

  const ranked = [...poolById.values()].sort(
    (a, b) =>
      b.combinedScore - a.combinedScore ||
      Number(b.item.canAfford) - Number(a.item.canAfford) ||
      a.item.cost - b.item.cost ||
      a.item.def.name.localeCompare(b.item.def.name),
  );

  const chosen: QuickElementSuggestion[] = [];
  const chosenIds = new Set<string>();
  const catCounts = new Map<QuickBuildCategoryId, number>();

  const pick = (entry: InstantPoolEntry) => {
    chosen.push(entry.item);
    chosenIds.add(entry.item.def.id);
    catCounts.set(entry.category, (catCounts.get(entry.category) ?? 0) + 1);
  };

  // Pass 1: Lock in the #1 urgent affordable crisis-solver if one exists
  const urgentSolver = ranked.find((e) => e.urgentFix);
  if (urgentSolver && chosen.length < limit) {
    pick(urgentSolver);
  }

  // Pass 2: Pick diverse top elements (max 1 per category first so all 6 slots span rich, distinct options)
  for (const entry of ranked) {
    if (chosen.length >= limit) break;
    if (chosenIds.has(entry.item.def.id)) continue;
    if ((catCounts.get(entry.category) ?? 0) >= 1) continue;
    pick(entry);
  }

  // Pass 3: If fewer than `limit` distinct categories fit this tile (e.g. open water), allow a 2nd/3rd from top categories
  for (const entry of ranked) {
    if (chosen.length >= limit) break;
    if (chosenIds.has(entry.item.def.id)) continue;
    pick(entry);
  }

  // Re-sort final 6 so the highest-priority pick sits cleanly at 12 o'clock
  chosen.sort((a, b) => b.score - a.score);
  return chosen.slice(0, limit);
}
