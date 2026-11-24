import { ELEMENT_BY_ID } from "./catalog";
import { taxRateOf, transfer } from "./cityEconomy";
import { rememberBuildingEdit } from "./constructionHistory";
import { GRID_MAX, GRID_MIN } from "./mapBounds";
import {
  type GameState,
  type PlacedElement,
  buildingLockReason,
  makeElementId,
  planConstruction,
  randomVariant,
  recomputeConnectivityAndMetrics,
} from "./simulation";
import { settleStreetFacing } from "./streetFacing";
import {
  applyInfrastructureStroke,
  applyLandformPlacement,
  getTerrainCell,
  type GridPoint,
  type InfrastructureTool,
} from "./terrain";

export interface PixTerrainOp {
  kind: "canal" | "canyon" | "river" | "pond" | "mountain" | "raise" | "lower" | "paint_sand" | "bridge";
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  radius: number;
  depthOrHeight?: number;
}

export interface PixRoadLine {
  roadId: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface PixPlacementOp {
  elementId: string;
  gx: number;
  gz: number;
  level?: number;
  rot?: number;
}

export interface PixWorldPlan {
  summary: string;
  terrainOps: PixTerrainOp[];
  roadLines: PixRoadLine[];
  placements: PixPlacementOp[];
}

export interface PixWorldApplyResult {
  terrainOpsApplied: number;
  roadsPlaced: number;
  buildingsPlaced: number;
  skipped: string[];
  terrainDirty: boolean;
}

function clampCoord(n: number): number {
  return Math.max(GRID_MIN + 2, Math.min(GRID_MAX - 2, Math.round(n)));
}

function bresenhamPoints(x0: number, z0: number, x1: number, z1: number): GridPoint[] {
  const pts: GridPoint[] = [];
  let cx = clampCoord(x0);
  let cz = clampCoord(z0);
  const tx = clampCoord(x1);
  const tz = clampCoord(z1);
  const dx = Math.abs(tx - cx);
  const dz = Math.abs(tz - cz);
  const sx = cx < tx ? 1 : -1;
  const sz = cz < tz ? 1 : -1;
  let err = dx - dz;
  for (let steps = 0; steps < 140; steps++) {
    pts.push({ gx: cx, gz: cz });
    if (cx === tx && cz === tz) break;
    const e2 = err * 2;
    if (e2 > -dz) {
      err -= dz;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cz += sz;
    }
  }
  return pts;
}

function placeSingle(
  state: GameState,
  defId: string,
  gx: number,
  gz: number,
  level: number,
  rot: number,
): { ok: boolean; reason?: string } {
  const def = ELEMENT_BY_ID[defId];
  if (!def) return { ok: false, reason: `Unknown element "${defId}"` };
  const lock = buildingLockReason(def, state);
  if (lock) return { ok: false, reason: lock };

  const planned = planConstruction(state, def, gx, gz, level, rot, false);
  if (!planned.valid) {
    return { ok: false, reason: planned.reason || "Blocked site" };
  }
  let waterUnderlay: PlacedElement | undefined;
  if (planned.replaceId) {
    const idx = state.elements.findIndex((e) => e.id === planned.replaceId);
    if (idx >= 0) {
      const existing = state.elements[idx];
      if (ELEMENT_BY_ID[existing.defId]?.isWaterFeature) waterUnderlay = existing;
      state.elements.splice(idx, 1);
    }
  }

  const placed: PlacedElement = {
    id: makeElementId(),
    defId: planned.def.id,
    gx,
    gz,
    spanX: planned.spanX,
    spanZ: planned.spanZ,
    rotation: planned.rotation,
    level: planned.level,
    variant: randomVariant(),
    connected: false,
    hasPoliceCover: false,
    hasFireCover: false,
    nuisancePenalty: 0,
    maintTimerSec: 0,
    disrepair: false,
    onFire: false,
    overWater: planned.overWater,
    waterUnderlay,
    roadAxis: planned.roadAxis,
    pedestrianDeck: planned.pedestrianDeck,
    animProgress: 1,
    animKind: "place",
  };

  state.elements.push(placed);
  if (planned.cost > 0) {
    transfer(state, "treasury", "outside", planned.cost, "Construction");
  }
  applyLandformPlacement(state, placed);
  settleStreetFacing(state, placed, false);
  return { ok: true };
}

function findNearbyValidSpot(
  state: GameState,
  defId: string,
  targetX: number,
  targetZ: number,
  level: number,
  rot: number,
): [number, number] | null {
  const def = ELEMENT_BY_ID[defId];
  if (!def) return null;
  const cx = clampCoord(targetX);
  const cz = clampCoord(targetZ);
  if (planConstruction(state, def, cx, cz, level, rot, false).valid) return [cx, cz];
  for (let r = 1; r <= 7; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const gx = clampCoord(cx + dx);
        const gz = clampCoord(cz + dz);
        if (planConstruction(state, def, gx, gz, level, rot, false).valid) {
          return [gx, gz];
        }
      }
    }
  }
  return null;
}

/**
 * Applies a structured PixBuilder world plan onto the live GameState.
 * Honors mode rules: terrain sculpting requires God mode; non-God modes respect budget and unlocks.
 * Records construction history so Ctrl+Z cleanly undoes placements.
 */
export function applyPixWorldPlan(state: GameState, plan: PixWorldPlan): PixWorldApplyResult {
  const beforeSnapshot: GameState = {
    ...state,
    elements: state.elements.map((e) => ({ ...e })),
  };

  let terrainOpsApplied = 0;
  let roadsPlaced = 0;
  let buildingsPlaced = 0;
  const skipped: string[] = [];
  let terrainDirty = false;

  const isGod = state.mode === "god";
  const isSurvival = state.mode === "survival";
  const maxTerrainOps = isGod ? 14 : 0;
  const maxRoadLines = isGod ? 24 : isSurvival ? 4 : 8;
  const maxPlacements = isGod ? 90 : isSurvival ? 6 : 18;

  const rawOps = Array.isArray(plan.terrainOps) ? plan.terrainOps : [];
  const ops = rawOps.slice(0, maxTerrainOps);

  if (rawOps.length > 0 && !isGod) {
    skipped.push("Terrain sculpting & elevated public-works bridges require God mode (roads & unlocked buildings still applied).");
  } else if (ops.length > 0) {
    for (const op of ops) {
      const pts = bresenhamPoints(op.x0, op.z0, op.x1, op.z1);
      const radius = Math.max(1, Math.min(4, Math.round(op.radius || 2)));
      const mag = Math.max(0.5, Math.min(6, Number(op.depthOrHeight) || 1.8));
      let tool: InfrastructureTool;
      if (op.kind === "paint_sand") {
        tool = { kind: "paint", radius, material: "sand" };
      } else if (op.kind === "bridge") {
        tool = { kind: "bridge", height: Math.max(1.5, Math.min(6, mag)) };
      } else if (op.kind === "canal" || op.kind === "river" || op.kind === "pond" || op.kind === "canyon" || op.kind === "lower") {
        tool = { kind: op.kind, radius, depth: Math.min(3.5, mag) };
      } else {
        tool = { kind: op.kind === "mountain" ? "mountain" : "raise", radius, height: Math.min(3.5, mag) };
      }
      const res = applyInfrastructureStroke(state, tool, pts);
      if (res.valid) {
        terrainOpsApplied++;
        terrainDirty = true;
      } else if (res.reason) {
        skipped.push(`Terrain (${op.kind}): ${res.reason}`);
      }
    }
  }

  const normalizeRoadId = (raw: string): string => {
    const map: Record<string, string> = {
      road: "roads",
      roads: "roads",
      two_lane_road: "two_lane_roads",
      two_lane_roads: "two_lane_roads",
      pretty_road: "pretty_roads",
      pretty_roads: "pretty_roads",
      highway: "highways",
      highways: "highways",
      bridge: "bridges",
      bridges: "bridges",
      stone_bridge: "stone_bridges",
      stone_bridges: "stone_bridges",
      suspension_bridge: "suspension_bridges",
      suspension_bridges: "suspension_bridges",
    };
    return map[raw] ?? "roads";
  };

  for (const line of (plan.roadLines ?? []).slice(0, maxRoadLines)) {
    const pts = bresenhamPoints(line.x0, line.z0, line.x1, line.z1);
    const requestedId = normalizeRoadId(line.roadId);
    for (const pt of pts) {
      const cell = getTerrainCell(state, pt.gx, pt.gz);
      let roadId = requestedId;
      if (cell.kind === "water" && !["bridges", "stone_bridges", "suspension_bridges"].includes(roadId)) {
        roadId = "bridges";
      }
      if (!ELEMENT_BY_ID[roadId] || buildingLockReason(ELEMENT_BY_ID[roadId], state)) {
        roadId = cell.kind === "water" ? "bridges" : "roads";
      }
      const res = placeSingle(state, roadId, pt.gx, pt.gz, 1, 0);
      if (res.ok) roadsPlaced++;
    }
  }

  for (const p of (plan.placements ?? []).slice(0, maxPlacements)) {
    const def = ELEMENT_BY_ID[p.elementId];
    if (!def) {
      skipped.push(`Unknown element "${p.elementId}" skipped.`);
      continue;
    }
    const lock = buildingLockReason(def, state);
    if (lock) {
      skipped.push(`${def.name}: ${lock}`);
      continue;
    }
    const level = isGod ? Math.max(1, Math.min(5, Math.round(p.level || 2))) : 1;
    const rot = ((Math.round(p.rot || 0) % 4) + 4) % 4;
    const spot = findNearbyValidSpot(state, def.id, p.gx, p.gz, level, rot);
    if (!spot) {
      skipped.push(`No clear site near (${p.gx}, ${p.gz}) for ${def.name}.`);
      continue;
    }
    const res = placeSingle(state, def.id, spot[0], spot[1], level, rot);
    if (res.ok) {
      buildingsPlaced++;
    } else if (res.reason) {
      skipped.push(`${def.name}: ${res.reason}`);
    }
  }

  if (roadsPlaced > 0 || buildingsPlaced > 0 || terrainOpsApplied > 0) {
    recomputeConnectivityAndMetrics(state);
    rememberBuildingEdit(beforeSnapshot, state, "PixBuilder batch build");
  }

  return {
    terrainOpsApplied,
    roadsPlaced,
    buildingsPlaced,
    skipped: skipped.slice(0, 6),
    terrainDirty,
  };
}

/** Builds compact live telemetry for Pix Advisor & World Builder without bloat. */
export function buildCompactIslandTelemetry(state: GameState) {
  const counts: Record<string, number> = {};
  const hotspots: { label: string; gx: number; gz: number; issue: string }[] = [];
  for (const el of state.elements) {
    counts[el.defId] = (counts[el.defId] || 0) + 1;
    const def = ELEMENT_BY_ID[el.defId];
    if (el.onFire && hotspots.length < 6) {
      hotspots.push({ label: def?.name ?? el.defId, gx: el.gx, gz: el.gz, issue: "on fire" });
    } else if (!el.connected && def && !def.isNetwork && !def.passiveNature && hotspots.length < 6) {
      hotspots.push({ label: def.name, gx: el.gx, gz: el.gz, issue: "disconnected from road/utility grid" });
    } else if (el.disrepair && hotspots.length < 6) {
      hotspots.push({ label: def?.name ?? el.defId, gx: el.gx, gz: el.gz, issue: "needs repair" });
    } else if (def && (def.water ?? 0) > 0 && !el.connected && hotspots.length < 6) {
      hotspots.push({ label: def.name, gx: el.gx, gz: el.gz, issue: "water source not connected to street network" });
    } else if (def && (def.food ?? 0) > 0 && !el.connected && hotspots.length < 6) {
      hotspots.push({ label: def.name, gx: el.gx, gz: el.gz, issue: "food producer not connected to street network" });
    }
  }
  const topCounts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18);

  const m = state.metrics;
  return {
    mode: state.mode,
    stage: state.currentStage,
    playMinutes: Math.round(state.activePlaySec / 60),
    population: Math.round(state.population),
    housingCapacity: Math.round(m.housingBase),
    jobsAvailable: Math.round(m.jobsAvailable),
    jobsNeeded: Math.round(m.jobsNeeded),
    money: Math.round(state.money),
    netIncomePerTick: Math.round(m.netIncomePerTick),
    taxRatePct: Math.round(taxRateOf(state) * 100),
    happiness: Math.round(state.happiness),
    limitingNeed: m.populationLimiter.limitingNeed,
    powerNet: Math.round(m.powerSupplySteady - m.powerDemand),
    waterNet: Math.round(m.waterSupply - m.waterDemand),
    foodNet: Math.round(m.foodSupply - m.foodDemand),
    wasteNet: Math.round(m.wasteCapacity - m.wasteDemand),
    crimeRate: Math.round(m.crimeRate),
    defenseRating: Math.round(m.defenseRating),
    congestionPct: Math.round(m.congestionDaily),
    pollutionAvg: Math.round(m.pollutionAvg),
    burningCount: m.burningCount,
    disrepairCount: m.disrepairCount,
    disconnectedBuildings: m.disconnectedBuildings,
    totalStructures: state.elements.length,
    topStructures: topCounts,
    hotspots,
  };
}
