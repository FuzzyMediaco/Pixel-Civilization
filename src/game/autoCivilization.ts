/**
 * Algorithmic Civilization Builder for Idle Mode & Manager Mode.
 *
 * Purely deterministic/randomized algorithmic city planning (zero LLM calls).
 * Every run selects a distinct seeded street-grid style, district orientation,
 * starting palette, and building mix so no two cities grow identically, while
 * strictly obeying road connectivity, bridge spans, stage unlocks, utilities,
 * food, commerce, safety, defense, and Stage 1 -> Stage 20 progression!
 */
import {
  type CivElementDef,
  ELEMENT_BY_ID,
  ELEMENTS,
  getMaxElementLevel,
  STAGES,
} from "./catalog";
import { buildingCharges, transfer } from "./cityEconomy";
import {
  type GameState,
  type PlacedElement,
  buildingLockReason,
  makeElementId,
  planConstruction,
  pushToast,
  randomVariant,
  recomputeConnectivityAndMetrics,
  upgradeElementDirect,
} from "./simulation";
import { settleStreetFacing } from "./streetFacing";
import { applyLandformPlacement, getTerrainCell } from "./terrain";
import { listCustomElements } from "./customElements";

export type LayoutStyle = "grid" | "ring" | "avenue" | "coastal_spine";

export interface AutoCivProfile {
  seed: number;
  layoutStyle: LayoutStyle;
  blockW: number;
  blockH: number;
  originX: number;
  originZ: number;
  preferredVariant: number;
  commerceBias: number;
  defenseBias: number;
  greenBias: number;
}

export interface ManagerChoice {
  id: string;
  label: string;
  detail: string;
  action:
    | { kind: "build"; defId: string; zoneHint?: "north" | "south" | "east" | "west" | "coast" | "center" }
    | { kind: "upgrade_best" }
    | { kind: "expand_roads"; direction: "north" | "south" | "east" | "west" }
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
  focusGrid?: [number, number];
}

function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 1337;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createAutoCivProfile(seed = Date.now() ^ Math.floor(Math.random() * 0xfffffff)): AutoCivProfile {
  const rng = makeRng(seed);
  const styles: LayoutStyle[] = ["grid", "ring", "avenue", "coastal_spine"];
  return {
    seed,
    layoutStyle: styles[Math.floor(rng() * styles.length)],
    blockW: 4 + Math.floor(rng() * 3), // 4..6 tiles between parallel streets
    blockH: 4 + Math.floor(rng() * 3),
    originX: -4 + Math.floor(rng() * 9),
    originZ: -4 + Math.floor(rng() * 9),
    preferredVariant: Math.floor(rng() * 4),
    commerceBias: rng(),
    defenseBias: rng(),
    greenBias: rng(),
  };
}

function isRoadCoord(state: GameState, gx: number, gz: number): boolean {
  return state.elements.some((el) => {
    if (gx < el.gx || gx >= el.gx + el.spanX || gz < el.gz || gz >= el.gz + el.spanZ) return false;
    return Boolean(ELEMENT_BY_ID[el.defId]?.isRoadNetwork);
  });
}

function hasAdjacentRoad(state: GameState, gx: number, gz: number, spanX: number, spanZ: number): boolean {
  for (let x = gx; x < gx + spanX; x++) {
    if (isRoadCoord(state, x, gz - 1) || isRoadCoord(state, x, gz + spanZ)) return true;
  }
  for (let z = gz; z < gz + spanZ; z++) {
    if (isRoadCoord(state, gx - 1, z) || isRoadCoord(state, gx + spanX, z)) return true;
  }
  return false;
}

function pickUnlockedByPool(
  state: GameState,
  pool: string[],
  rng: () => number,
  maxCost?: number,
): CivElementDef | undefined {
  const valid = pool
    .map((id) => ELEMENT_BY_ID[id])
    .filter((d): d is CivElementDef => {
      if (!d) return false;
      if (buildingLockReason(d, state)) return false;
      if (maxCost !== undefined && buildingCharges(state) && d.cost > maxCost) return false;
      return true;
    });
  if (!valid.length) return undefined;
  // Prefer higher-stage variety as the city matures, with randomness every run
  valid.sort((a, b) => b.stage - a.stage);
  const topSlice = valid.slice(0, Math.min(4, valid.length));
  return topSlice[Math.floor(rng() * topSlice.length)];
}

/** Place an element cleanly using the real simulation rules (including auto-bridges over water!) */
export function placeAlgorithmicElement(
  state: GameState,
  def: CivElementDef,
  gx: number,
  gz: number,
  preferredVariant?: number,
): PlacedElement | null {
  const plan = planConstruction(state, def, gx, gz, 1, 0, false);
  if (!plan.valid) return null;
  const charged = buildingCharges(state) ? plan.def.cost : 0;
  if (charged && state.money < charged) return null;
  if (charged) transfer(state, "treasury", "outside", plan.def.cost, "Auto-Construction");

  const placed: PlacedElement = {
    id: makeElementId(),
    defId: plan.def.id,
    gx,
    gz,
    spanX: plan.spanX,
    spanZ: plan.spanZ,
    rotation: plan.rotation,
    level: plan.level,
    variant: preferredVariant !== undefined && Math.random() < 0.65 ? preferredVariant : randomVariant(),
    connected: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    animProgress: 1.0,
    animKind: "place",
    ...(plan.overWater ? { overWater: true } : {}),
    ...(plan.roadAxis ? { roadAxis: plan.roadAxis } : {}),
    ...(plan.pedestrianDeck ? { pedestrianDeck: true } : {}),
  };
  if (plan.replaceId) {
    placed.waterUnderlay = state.elements.find((e) => e.id === plan.replaceId);
    state.elements = state.elements.filter((e) => e.id !== plan.replaceId);
  }
  state.elements.push(placed);
  applyLandformPlacement(state, placed);
  settleStreetFacing(state, placed, false);
  recomputeConnectivityAndMetrics(state);
  return placed;
}

/** Find a valid road-adjacent tile (or coastal/water tile) for a given element */
function findBuildSpot(
  state: GameState,
  def: CivElementDef,
  profile: AutoCivProfile,
  rng: () => number,
  zoneHint?: "north" | "south" | "east" | "west" | "coast" | "center",
): [number, number] | null {
  const candidates: [number, number, number][] = [];
  const roads = state.elements.filter((el) => ELEMENT_BY_ID[el.defId]?.isRoadNetwork);

  // For water / coastal elements, scan the coastline and open water ring
  if (def.domain === "water" || def.domain === "coast_or_water") {
    for (let gx = -28; gx <= 28; gx += 2) {
      for (let gz = -28; gz <= 28; gz += 2) {
        const plan = planConstruction(state, def, gx, gz, 1, 0, false);
        if (!plan.valid) continue;
        const dist = Math.hypot(gx - profile.originX, gz - profile.originZ);
        const roadBonus = hasAdjacentRoad(state, gx, gz, plan.spanX, plan.spanZ) ? -12 : 0;
        candidates.push([gx, gz, dist + roadBonus + rng() * 6]);
      }
    }
    candidates.sort((a, b) => a[2] - b[2]);
    return candidates.length ? [candidates[0][0], candidates[0][1]] : null;
  }

  // Land buildings: search adjacent to existing road tiles first
  const checked = new Set<string>();
  const offsets: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [0, -2], [-2, 0], [1, 1], [-1, -1],
  ];
  for (const r of roads) {
    for (const [dx, dz] of offsets) {
      const gx = r.gx + dx;
      const gz = r.gz + dz;
      const key = `${gx},${gz}`;
      if (checked.has(key)) continue;
      checked.add(key);
      const plan = planConstruction(state, def, gx, gz, 1, 0, false);
      if (!plan.valid) continue;
      if (!hasAdjacentRoad(state, gx, gz, plan.spanX, plan.spanZ)) continue;

      let score = Math.hypot(gx - profile.originX, gz - profile.originZ) + rng() * 5;
      // Keep polluting structures slightly farther from center
      if ((def.nuisanceRadius ?? 0) > 0) score = -score * 0.4 + Math.abs(Math.hypot(gx, gz) - 16) + rng() * 5;
      if (zoneHint === "north") score += gz * 0.8;
      if (zoneHint === "south") score -= gz * 0.8;
      if (zoneHint === "east") score -= gx * 0.8;
      if (zoneHint === "west") score += gx * 0.8;
      if (zoneHint === "center") score += Math.hypot(gx - profile.originX, gz - profile.originZ) * 0.7;
      candidates.push([gx, gz, score]);
    }
  }
  candidates.sort((a, b) => a[2] - b[2]);
  return candidates.length ? [candidates[0][0], candidates[0][1]] : null;
}

/** Extend the city's interconnected road network (auto-bridging across channels/water!) */
function extendRoadNetwork(
  state: GameState,
  profile: AutoCivProfile,
  rng: () => number,
  direction?: "north" | "south" | "east" | "west",
): AutoStepOutcome {
  const roadDef =
    pickUnlockedByPool(state, ["two_lane_roads", "pretty_roads", "roads"], rng, state.money) ??
    ELEMENT_BY_ID["roads"];
  if (!roadDef) return { didAct: false, summary: "No road tool available" };

  const roads = state.elements.filter((el) => ELEMENT_BY_ID[el.defId]?.isRoadNetwork);
  if (roads.length === 0) {
    // Lay an initial starter crossroad of 5 connected road tiles around origin
    let placedAny = false;
    for (let i = -2; i <= 2; i++) {
      if (placeAlgorithmicElement(state, roadDef, profile.originX + i, profile.originZ, profile.preferredVariant)) {
        placedAny = true;
      }
    }
    return {
      didAct: placedAny,
      summary: "Laid starter Main Street",
      placedDefId: roadDef.id,
      focusGrid: [profile.originX, profile.originZ],
    };
  }

  // Pick a frontier road tile and extend a clean 3..5 tile street segment following profile's layout style
  const dirs: [number, number][] =
    direction === "north"
      ? [[0, -1]]
      : direction === "south"
        ? [[0, 1]]
        : direction === "east"
          ? [[1, 0]]
          : direction === "west"
            ? [[-1, 0]]
            : [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];

  const shuffled = [...roads].sort(() => rng() - 0.5).slice(0, 28);
  for (const anchor of shuffled) {
    // Encourage neat spacing between parallel avenues based on profile.blockW / blockH
    const alignedX = Math.abs(anchor.gx - profile.originX) % profile.blockW === 0;
    const alignedZ = Math.abs(anchor.gz - profile.originZ) % profile.blockH === 0;
    const tryDirs = [...dirs].sort(() => rng() - 0.5);
    for (const [dx, dz] of tryDirs) {
      if (!direction && dx !== 0 && !alignedZ && profile.layoutStyle === "grid") continue;
      if (!direction && dz !== 0 && !alignedX && profile.layoutStyle === "grid") continue;
      let builtCount = 0;
      let lastPos: [number, number] = [anchor.gx, anchor.gz];
      const segLen = 3 + Math.floor(rng() * 3);
      for (let step = 1; step <= segLen; step++) {
        const nx = anchor.gx + dx * step;
        const nz = anchor.gz + dz * step;
        if (Math.abs(nx) > 24 || Math.abs(nz) > 24) break;
        if (isRoadCoord(state, nx, nz)) break;
        const cell = getTerrainCell(state, nx, nz);
        const stepDef =
          cell.kind === "water"
            ? (pickUnlockedByPool(state, ["suspension_bridges", "stone_bridges", "bridges"], rng, state.money) ??
              ELEMENT_BY_ID["bridges"] ??
              roadDef)
            : roadDef;
        const placed = placeAlgorithmicElement(state, stepDef, nx, nz, profile.preferredVariant);
        if (!placed) break;
        builtCount++;
        lastPos = [nx, nz];
      }
      if (builtCount > 0) {
        return {
          didAct: true,
          summary: `Extended street corridor (${builtCount} tiles)`,
          placedDefId: roadDef.id,
          focusGrid: lastPos,
        };
      }
    }
  }
  return { didAct: false, summary: "Road network saturated" };
}

/** Upgrade an existing connected building (drives growth smoothly toward Stage 20!) */
function tryUpgradeExisting(state: GameState, rng: () => number): AutoStepOutcome {
  const candidates = state.elements.filter((el) => {
    const def = ELEMENT_BY_ID[el.defId];
    if (!def || def.isNetwork || def.passiveNature) return false;
    if (!el.connected) return false;
    return el.level < getMaxElementLevel(el.defId);
  });
  if (!candidates.length) return { didAct: false, summary: "No upgrade candidates" };

  // Prioritize housing, power, water, food, and jobs when close to stage thresholds
  candidates.sort((a, b) => {
    const da = ELEMENT_BY_ID[a.defId];
    const db = ELEMENT_BY_ID[b.defId];
    const score = (el: PlacedElement, d?: CivElementDef) =>
      ((d?.popBase ?? 0) > 0 ? 40 : 0) +
      ((d?.power ?? 0) > 0 || (d?.water ?? 0) > 0 || (d?.food ?? 0) > 0 ? 25 : 0) +
      ((d?.jobs ?? 0) > 0 ? 20 : 0) -
      el.level * 12 +
      rng() * 14;
    return score(b, db) - score(a, da);
  });

  for (const target of candidates.slice(0, 6)) {
    const res = upgradeElementDirect(state, target.id);
    if (res.ok) {
      const def = ELEMENT_BY_ID[target.defId];
      recomputeConnectivityAndMetrics(state);
      return {
        didAct: true,
        summary: `Upgraded ${def?.name ?? target.defId} to Lv ${target.level}`,
        placedDefId: target.defId,
        focusGrid: [target.gx, target.gz],
      };
    }
  }
  return { didAct: false, summary: "Awaiting budget or space for upgrade" };
}

/** Determine the single highest-priority civilization need right now */
function pickPriorityDef(
  state: GameState,
  profile: AutoCivProfile,
  rng: () => number,
): { reason: string; def?: CivElementDef; zoneHint?: "north" | "south" | "east" | "west" | "coast" | "center" } {
  const m = state.metrics;
  const stage = state.currentStage;
  const budget = state.money;

  // 1. Ensure Stage 3+ civic authority exists so police/fire/military unlock smoothly
  if (stage >= 2 && m.govSupply < Math.max(12, m.govDemand + 6)) {
    const def = pickUnlockedByPool(
      state,
      ["government_buildings", "courthouses", "city_offices", "tax_collecting_office"],
      rng,
      budget,
    );
    if (def) return { reason: "Establish civic authority", def, zoneHint: "center" };
  }

  // 2. Power supply buffer
  if (m.powerSupplySteady <= m.powerDemand + 12 || (m.powerSupply === 0 && state.elements.length > 3)) {
    const def = pickUnlockedByPool(
      state,
      [
        "nuclear_power_plants",
        "micro_reactor_nuclear",
        "geothermal_power_plants",
        "wind_farms",
        "solar_farms",
        "natural_gas_power_plants",
        "wind_turbines",
        "windmills",
        "solar_panels",
      ],
      rng,
      budget,
    );
    if (def) return { reason: "Expand clean electric capacity", def };
  }

  // 3. Clean water buffer
  if (m.waterSupply <= m.waterDemand + 10 || (m.waterSupply === 0 && state.elements.length > 4)) {
    const def = pickUnlockedByPool(
      state,
      ["desalination_plant", "municipal_reservoir", "water_pumping_station", "water_towers", "water_treatment_plant", "wells"],
      rng,
      budget,
    );
    if (def) return { reason: "Increase drinking water supply", def };
  }

  // 4. Waste capacity
  if (m.wasteCapacity <= m.wasteDemand + 8 && state.population > 10) {
    const def = pickUnlockedByPool(state, ["trash_compacting_plants", "trash_burning_plants", "landfill"], rng, budget);
    if (def) return { reason: "Add waste collection capacity", def };
  }

  // 5. Food & groceries
  if (m.foodSupply <= m.foodDemand + 14 || (m.foodSupply === 0 && state.elements.length > 5)) {
    const def = pickUnlockedByPool(
      state,
      ["seafood_pier", "night_market", "artisan_bakery", "orchards", "farms", "grocery_store", "gardens", "retro_diner"],
      rng,
      budget,
    );
    if (def) return { reason: "Grow local food & dining", def };
  }

  // 6. Jobs & vibrant commercial variety (incorporating the 20 new commercial buildings!)
  if (m.jobsAvailable <= m.jobsNeeded + 18 || (m.jobsAvailable === 0 && state.elements.length > 5)) {
    const def = pickUnlockedByPool(
      state,
      [
        "tech_startup_hub",
        "department_store",
        "boutique_hotel",
        "coworking_loft",
        "auto_dealership",
        "furniture_showroom",
        "cinema_theater",
        "bowling_alley",
        "retro_arcade",
        "jazz_club",
        "art_gallery",
        "indie_bookstore",
        "coffee_roastery",
        "hardware_store",
        "flower_shop",
        "neighborhood_pharmacy",
        "artisan_bakery",
        "retro_diner",
        "malls",
        "banks",
        "shops",
        "businesses",
      ],
      rng,
      budget,
    );
    if (def) return { reason: "Create commercial jobs & tax base", def };
  }

  // 7. Fire, Police, Emergency Helicopters & Safety (Stage 4+)
  if (stage >= 4 && (m.crimeDaily > 8 || state.elements.filter((e) => ELEMENT_BY_ID[e.defId]?.fireRadius).length < Math.ceil(stage / 3))) {
    const def = pickUnlockedByPool(
      state,
      [
        "police_heli_pad",
        "medevac_heli_pad",
        "fire_heli_base",
        "emergency_dispatch",
        "k9_police_unit",
        "forensic_crime_lab",
        "fire_academy",
        "coast_rescue_station",
        "harbor_patrol_pier",
        "traffic_precinct",
        "hazmat_response",
        "search_rescue_hq",
        "riot_command_center",
        "police_departments",
        "police_precinct",
        "fire_department",
      ],
      rng,
      budget,
    );
    if (def) return { reason: "Strengthen police, fire & air rescue", def };
  }

  // 8. National Defense — Army, Naval, Air Force & Marine Corps (Stage 10+)
  if (stage >= 10 && (m.defenseRating < 90 || rng() < 0.22 + profile.defenseBias * 0.15)) {
    const def = pickUnlockedByPool(
      state,
      [
        "strategic_bomber_wing",
        "stealth_bomber_hangar",
        "fighter_wing_base",
        "airlift_cargo_base",
        "awacs_radar_base",
        "drone_recon_base",
        "marine_aviation_wing",
        "marine_corps_base",
        "marine_amphib_base",
        "naval_carrier_berth",
        "naval_destroyer_dock",
        "naval_shipyard_base",
        "naval_coast_guard_base",
        "naval_amphibious_dock",
        "naval_frigate_ship",
        "naval_patrol_cutter",
        "naval_hospital_ship",
        "army_garrison",
        "army_airborne_school",
        "army_signal_corps",
        "army_logistics_depot",
        "army_medical_corps",
        "airforce_base",
        "naval_base",
        "military_base",
      ],
      rng,
      budget,
    );
    if (def) return { reason: "Build air, naval & defense wings", def };
  }

  // 9. Schools, Faith, Transit, Pix Custom & Landmarks (including Stage 20 Spaceport!)
  if (stage >= 18 && !state.elements.some((e) => e.defId === "spaceport") && ELEMENT_BY_ID["spaceport"]) {
    const sp = ELEMENT_BY_ID["spaceport"];
    if (!buildingLockReason(sp, state)) {
      return { reason: "Construct Stage 20 Spaceport centerpiece", def: sp, zoneHint: "center" };
    }
  }
  const customPool = listCustomElements().map((c) => c.id);
  if (customPool.length > 0 && rng() < 0.14) {
    const cDef = pickUnlockedByPool(state, customPool, rng, budget);
    if (cDef) return { reason: "Feature player PixBuilder creation", def: cDef };
  }
  if (m.educationSupply < m.educationDemand + 10) {
    const def = pickUnlockedByPool(state, ["university", "high_school", "indie_bookstore", "art_gallery", "school"], rng, budget);
    if (def) return { reason: "Add schools & cultural learning", def };
  }
  if (m.recreationSupply < m.recreationDemand + 12 || rng() < 0.14 + profile.greenBias * 0.08) {
    const def = pickUnlockedByPool(
      state,
      ["eiffel_tower", "the_london_eye", "colosseum", "parthenon", "lds_temples", "churches", "large_parks", "italian_gardens", "cinema_theater", "flower_shop", "park", "little_parks"],
      rng,
      budget,
    );
    if (def) return { reason: "Lift happiness with parks, faith & landmarks", def };
  }

  // 10. Default primary driver: Housing to climb smoothly toward Stage 20!
  const housing = pickUnlockedByPool(
    state,
    [
      "skyscrapers",
      "condos",
      "apartment_buildings",
      "apartments",
      "villas",
      "mansions",
      "townhomes",
      "large_homes",
      "medium_sized_homes",
      "cottages",
      "house",
    ],
    rng,
    budget,
  );
  return { reason: "Expand housing for new residents", def: housing };
}

/**
 * Execute one algorithmic city-building step (used continuously in Idle Mode,
 * and on demand in Manager Mode after the player makes a choice).
 */
export function runAutoCivStep(state: GameState, profile: AutoCivProfile, stepIndex: number): AutoStepOutcome {
  if (state.gameOver) return { didAct: false, summary: "Island collapsed" };
  const rng = makeRng(profile.seed + stepIndex * 7919);

  // Give Idle/Manager cities a gentle municipal growth grant if treasury runs low early
  // so an unattended showcase world never stalls permanently before reaching Stage 20.
  if (state.money < 180) {
    state.money += 350;
  }

  // Step 0: Always ensure we have starter roads
  const roads = state.elements.filter((el) => ELEMENT_BY_ID[el.defId]?.isRoadNetwork);
  if (roads.length < 4) {
    return extendRoadNetwork(state, profile, rng);
  }

  // Periodically upgrade existing structures (key to reaching Stage 20 population!)
  if (state.elements.length >= 10 && rng() < 0.34) {
    const up = tryUpgradeExisting(state, rng);
    if (up.didAct) return up;
  }

  // Pick the highest-priority needed building
  const pick = pickPriorityDef(state, profile, rng);
  if (pick.def) {
    const spot = findBuildSpot(state, pick.def, profile, rng, pick.zoneHint);
    if (spot) {
      const placed = placeAlgorithmicElement(state, pick.def, spot[0], spot[1], profile.preferredVariant);
      if (placed) {
        return {
          didAct: true,
          summary: `${pick.reason}: built ${pick.def.name}`,
          placedDefId: pick.def.id,
          focusGrid: spot,
        };
      }
    }
  }

  // If no open road frontage was available, extend roads (and auto-bridge water if needed)
  const ext = extendRoadNetwork(state, profile, rng);
  if (ext.didAct) return ext;

  // Fallback: upgrade whatever can grow
  return tryUpgradeExisting(state, rng);
}

/**
 * Generate an interactive executive decision card for Manager Mode!
 */
export function generateManagerDecision(
  state: GameState,
  profile: AutoCivProfile,
  turnIndex: number,
): ManagerDecision {
  const rng = makeRng(profile.seed + turnIndex * 3571 + state.elements.length * 17);
  const m = state.metrics;
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const id = `mgr-${turnIndex}-${Date.now()}`;

  // Decision Type 1: Power shortage choice
  if (m.powerSupplySteady <= m.powerDemand + 10) {
    const optA = pickUnlockedByPool(state, ["solar_farms", "solar_panels"], rng) ?? ELEMENT_BY_ID["solar_panels"];
    const optB =
      pickUnlockedByPool(state, ["wind_farms", "wind_turbines", "windmills", "natural_gas_power_plants"], rng) ??
      ELEMENT_BY_ID["solar_panels"];
    return {
      id,
      kicker: `Stage ${stage.stage} · Power Advisory`,
      question: "Electric demand is catching up with our grid. How should we expand?",
      context: `Current steady supply: ${Math.round(m.powerSupplySteady)} vs ${Math.round(m.powerDemand)} demand.`,
      choices: [
        { id: "a", label: `Build ${optA.name}`, detail: `+$${optA.cost.toLocaleString()} · Clean solar generation`, action: { kind: "build", defId: optA.id } },
        { id: "b", label: optB.id !== optA.id ? `Build ${optB.name}` : "Upgrade existing grid", detail: optB.id !== optA.id ? `Steady backup output` : "Boost installed plants", action: optB.id !== optA.id ? { kind: "build", defId: optB.id } : { kind: "upgrade_best" } },
      ],
    };
  }

  // Decision Type 2: Water shortage
  if (m.waterSupply <= m.waterDemand + 8) {
    const optA = pickUnlockedByPool(state, ["water_towers", "water_treatment_plant"], rng) ?? ELEMENT_BY_ID["water_treatment_plant"];
    const optB = pickUnlockedByPool(state, ["desalination_plant", "municipal_reservoir", "water_pumping_station", "wells"], rng);
    return {
      id,
      kicker: `Stage ${stage.stage} · Water Utilities`,
      question: "Neighborhoods need more clean water. Which project do you approve?",
      context: `Water supply is ${Math.round(m.waterSupply)} against ${Math.round(m.waterDemand)} demand.`,
      choices: [
        { id: "a", label: `Approve ${optA.name}`, detail: "Connect straight into the street grid", action: { kind: "build", defId: optA.id } },
        { id: "b", label: optB ? `Build ${optB.name}` : "Upgrade existing water plant", detail: optB ? "Alternative water source" : "Expand capacity in place", action: optB ? { kind: "build", defId: optB.id } : { kind: "upgrade_best" } },
      ],
    };
  }

  // Decision Type 3: Safety / Police / Military proposal (Yes / No or branch choice)
  if (state.currentStage >= 5 && turnIndex % 3 === 1) {
    const special = pickUnlockedByPool(
      state,
      state.currentStage >= 14
        ? ["strategic_bomber_wing", "stealth_bomber_hangar", "naval_destroyer_dock", "fighter_wing_base", "marine_aviation_wing", "police_heli_pad"]
        : ["police_heli_pad", "medevac_heli_pad", "fire_heli_base", "coast_rescue_station", "emergency_dispatch", "k9_police_unit", "police_precinct"],
      rng,
    );
    if (special) {
      return {
        id,
        kicker: `Stage ${stage.stage} · Safety & Defense Proposal`,
        question: `Commission a new ${special.name}?`,
        context: special.description,
        choices: [
          { id: "yes", label: `Yes — Build ${special.name}`, detail: "Planner will site & connect it automatically", action: { kind: "build", defId: special.id } },
          { id: "no", label: "No — Focus on city growth instead", detail: "Expand commerce & housing instead", action: { kind: "upgrade_best" } },
        ],
      };
    }
  }

  // Decision Type 4: District placement / commercial showcase
  const feature = pickUnlockedByPool(
    state,
    [
      "artisan_bakery",
      "coffee_roastery",
      "retro_diner",
      "cinema_theater",
      "bowling_alley",
      "retro_arcade",
      "boutique_hotel",
      "art_gallery",
      "night_market",
      "tech_startup_hub",
      "department_store",
      "indie_bookstore",
      "flower_shop",
      "jazz_club",
      "apartments",
      "townhomes",
      "house",
    ],
    rng,
  );
  if (feature && turnIndex % 2 === 0) {
    return {
      id,
      kicker: `Stage ${stage.stage} · District Zoning`,
      question: `Where should we zone our next ${feature.name}?`,
      context: `Population: ${state.population.toLocaleString()} · Happiness: ${Math.round(state.happiness)}%`,
      choices: [
        { id: "north", label: "North District", detail: `Build ${feature.name} toward the northern shore`, action: { kind: "build", defId: feature.id, zoneHint: "north" } },
        { id: "east", label: "East Boulevard", detail: `Build ${feature.name} along the eastern corridor`, action: { kind: "build", defId: feature.id, zoneHint: "east" } },
        { id: "upgrade", label: "Upgrade existing buildings", detail: "Grow taller instead of sprawling out", action: { kind: "upgrade_best" } },
      ],
    };
  }

  // Decision Type 5: Road expansion direction
  return {
    id,
    kicker: `Stage ${stage.stage} · City Expansion`,
    question: "How should our planners expand the island next?",
    context: `Stage ${stage.stage} (${stage.name}) · ${state.elements.length} structures placed.`,
    choices: [
      { id: "roads_e", label: "Extend streets East", detail: "Open fresh blocks & auto-bridge channels", action: { kind: "expand_roads", direction: "east" } },
      { id: "roads_s", label: "Extend streets South", detail: "Open waterfront avenues to the south", action: { kind: "expand_roads", direction: "south" } },
      { id: "up", label: "Upgrade key districts", detail: "Level up homes, shops and utilities", action: { kind: "upgrade_best" } },
    ],
  };
}

export function applyManagerChoice(
  state: GameState,
  profile: AutoCivProfile,
  choice: ManagerChoice,
  turnIndex: number,
): AutoStepOutcome {
  const rng = makeRng(profile.seed + turnIndex * 4219);
  if (state.money < 220) state.money += 450;

  if (choice.action.kind === "build") {
    const def = ELEMENT_BY_ID[choice.action.defId];
    if (def) {
      let spot = findBuildSpot(state, def, profile, rng, choice.action.zoneHint);
      if (!spot) {
        extendRoadNetwork(state, profile, rng);
        spot = findBuildSpot(state, def, profile, rng, choice.action.zoneHint);
      }
      if (spot) {
        const placed = placeAlgorithmicElement(state, def, spot[0], spot[1], profile.preferredVariant);
        if (placed) {
          pushToast(state, "stage", `Manager Approved: ${def.name}`, "Planners built and connected the site.");
          return { didAct: true, summary: `Built ${def.name}`, placedDefId: def.id, focusGrid: spot };
        }
      }
    }
    return runAutoCivStep(state, profile, turnIndex);
  }
  if (choice.action.kind === "expand_roads") {
    return extendRoadNetwork(state, profile, rng, choice.action.direction);
  }
  if (choice.action.kind === "upgrade_best") {
    const up = tryUpgradeExisting(state, rng);
    if (up.didAct) return up;
    return runAutoCivStep(state, profile, turnIndex);
  }
  return { didAct: false, summary: "Held decision" };
}
