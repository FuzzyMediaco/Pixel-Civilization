import { ELEMENT_BY_ID, getMaxElementLevel } from "./catalog";
import { rememberBuildingEdit, undoBuildingEdit } from "./constructionHistory";
import { transfer } from "./cityEconomy";
import { addLine, autoStops, modeNames, type TravelMode } from "./mobility";
import { withinMap } from "./mapBounds";
import {
  checkPlacementValid, createInitialGameState, maintenanceStatus, maintainElement,
  planConstruction, recomputeConnectivityAndMetrics, relocatePlacedElement, removePlacedElements,
  upgradeElementDirect, type GameState, type PlacedElement,
} from "./simulation";
import { settleStreetFacing } from "./streetFacing";
import { applyInfrastructureStroke, applyLandformPlacement, type GridPoint } from "./terrain";
import { VOXELS_PER_TILE } from "./voxelCore";

export const SHARED_MODES = ["god", "real", "survival"] as const;
export type SharedMode = typeof SHARED_MODES[number];
export type IslandRole = "owner" | "builder" | "visitor";
export const SCULPT_TOOLS = ["raise", "lower", "smooth", "flatten", "mountain", "valley", "canyon", "river", "bridge"] as const;
export type SharedTool = typeof SCULPT_TOOLS[number];
export type SharedCommand =
  | { kind: "place"; defId: string; points: GridPoint[]; rotation: number; level: number }
  | { kind: "upgrade" | "demolish" | "rotate" | "maintain"; id: string }
  | { kind: "move"; id: string; gx: number; gz: number }
  | { kind: "sculpt"; tool: SharedTool; points: GridPoint[]; radius: number }
  | { kind: "transit"; mode: TravelMode; depot: string; stops: string[] }
  | { kind: "speed"; value: number }
  | { kind: "undo" };

export const sharedMode = (value: unknown): value is SharedMode => SHARED_MODES.some(mode => mode === value);

export function sharedWorld(mode: SharedMode, raw?: GameState): GameState {
  if (!sharedMode(mode)) throw Error("Choose God, Real or Survival mode.");
  const state = createInitialGameState(mode);
  if (!raw) return state;
  if (raw.mode !== mode || !Array.isArray(raw.elements) || raw.elements.length > 8000 ||
      ![raw.money, raw.population, raw.happiness, raw.activePlaySec, raw.currentStage, raw.highestStageReached].every(Number.isFinite) ||
      raw.currentStage < 1 || raw.currentStage > 20 ||
      ![undefined, 1, 2].includes(raw.terrainVersion)) throw Error("This copy has unsupported game data.");

  const ids = new Set<string>();
  for (const el of raw.elements) {
    if (!el || typeof el.id !== "string" || el.id.length > 100 || ids.has(el.id) ||
        !Object.hasOwn(ELEMENT_BY_ID, el.defId) || el.defId.startsWith("custom_") ||
        !sitePoint(el) || ![el.spanX, el.spanZ, el.level, el.variant, el.rotation].every(Number.isInteger) ||
        el.spanX < 1 || el.spanZ < 1 || el.spanX > 64 || el.spanZ > 64 ||
        !withinMap(el.gx + el.spanX - 1, el.gz + el.spanZ - 1) ||
        el.level < 1 || el.level > getMaxElementLevel(el.defId) || el.variant < 0 || el.variant > 3 ||
        el.rotation < 0 || el.rotation > 3) throw Error("This copy contains unsupported elements or custom designs.");
    ids.add(el.id);
  }

  const copy = { ...state, ...raw, toasts: [], constructionHistory: [] };
  delete copy.exampleWorldId;
  delete copy.exampleViewpoint;
  delete copy.exampleReturnMode;
  delete copy.cameraView;
  recomputeConnectivityAndMetrics(copy);
  return copy;
}

function sitePoint(p: GridPoint) {
  return p && Number.isInteger(p.gx) && Number.isInteger(p.gz) && withinMap(p.gx, p.gz);
}

function commandPoints(points: GridPoint[], limit: number, voxel = false): GridPoint[] {
  if (!Array.isArray(points) || !points.length || points.length > limit || !points.every(sitePoint)) {
    throw Error("Choose a shorter stroke inside the island map.");
  }
  return points.map(({ gx, gz, vx, vz }) => {
    if (!voxel || vx === undefined || vz === undefined) return { gx, gz };
    if (!Number.isInteger(vx) || !Number.isInteger(vz) ||
        Math.floor(vx / VOXELS_PER_TILE) !== gx || Math.floor(vz / VOXELS_PER_TILE) !== gz) throw Error("Invalid sculpt point.");
    return { gx, gz, vx, vz };
  });
}

function place(state: GameState, cmd: Extract<SharedCommand, { kind: "place" }>, id: () => string) {
  if (!Object.hasOwn(ELEMENT_BY_ID, cmd.defId) || cmd.defId.startsWith("custom_")) throw Error("Choose a catalog element.");
  const def = ELEMENT_BY_ID[cmd.defId];
  const points = commandPoints(cmd.points, def.isNetwork ? 64 : 1);
  if (state.elements.length + points.length > 8000) throw Error("This shared island has reached its element limit.");
  const rotation = Number.isInteger(cmd.rotation) && cmd.rotation >= 0 && cmd.rotation <= 3 ? cmd.rotation : 0;
  const level = Number.isInteger(cmd.level) ? cmd.level : 1;
  for (const [i, { gx, gz }] of points.entries()) {
    const prior = points[i - 1];
    if (prior && Math.abs(prior.gx - gx) + Math.abs(prior.gz - gz) !== 1) throw Error("The route must be continuous.");
    const plan = planConstruction(state, def, gx, gz, level, rotation);
    if (!plan.valid) throw Error(plan.reason || "This space is already occupied or unsuitable.");
    const placed: PlacedElement = {
      id: id(), defId: plan.def.id, gx, gz, level: plan.level, rotation: plan.rotation,
      spanX: plan.spanX, spanZ: plan.spanZ, variant: Math.floor(Math.random() * 4),
      connected: false, hasPoliceCover: false, hasFireCover: false, nuisancePenalty: 0,
      maintTimerSec: 0, disrepair: false, onFire: false, animProgress: 1, animKind: "place",
      overWater: plan.overWater, roadAxis: plan.roadAxis, pedestrianDeck: plan.pedestrianDeck,
    };
    if (plan.replaceId) {
      placed.waterUnderlay = state.elements.find(e => e.id === plan.replaceId);
      state.elements = state.elements.filter(e => e.id !== plan.replaceId);
    }
    if (plan.cost) transfer(state, "treasury", "outside", plan.cost, "Construction");
    state.elements.push(placed);
    applyLandformPlacement(state, placed);
    settleStreetFacing(state, placed, false);
  }
  return "Built " + def.name + (points.length > 1 ? " ×" + points.length : "");
}

export function applySharedCommand(before: GameState, cmd: SharedCommand, id = () => crypto.randomUUID()) {
  const state = structuredClone(before);
  let label: string;
  if (cmd.kind === "speed") {
    if (![0, 1, 2, 4].includes(cmd.value)) throw Error("Invalid simulation speed.");
    state.playSpeed = cmd.value;
    return { state, label: cmd.value ? "Set speed to " + cmd.value + "×" : "Paused simulation", undoable: false };
  }
  if (cmd.kind === "undo") {
    const result = undoBuildingEdit(state);
    if (!result.ok) throw Error(result.reason || "There is no edit to undo.");
    return { state, label: "Undid " + (result.label ?? "an edit"), undoable: false };
  }
  if (state.gameOver) throw Error("This island has reached the end of its Survival run.");
  if (cmd.kind === "place") label = place(state, cmd, id);
  else if (cmd.kind === "sculpt") {
    if (!SCULPT_TOOLS.includes(cmd.tool)) throw Error("Choose a sculpting tool.");
    const radius = Number.isInteger(cmd.radius) ? Math.max(0, Math.min(8, cmd.radius)) : 0;
    const precision = ["raise", "lower", "smooth", "flatten"].includes(cmd.tool) ? "voxel" : "tile";
    const plan = applyInfrastructureStroke(state, { kind: cmd.tool, precision, voxelRadius: radius, radius: 1 }, commandPoints(cmd.points, 64, precision === "voxel"));
    if (!plan.valid) throw Error(plan.reason);
    label = "Sculpted " + cmd.tool;
  } else if (cmd.kind === "transit") {
    if (!Object.hasOwn(modeNames, cmd.mode) || typeof cmd.depot !== "string" || !Array.isArray(cmd.stops) ||
        cmd.stops.length > 24 || !cmd.stops.every(s => typeof s === "string")) throw Error("Choose a service and valid stops.");
    addLine(state, cmd.mode, cmd.depot, cmd.stops.length ? cmd.stops : autoStops(state, cmd.mode, cmd.depot).slice(0, 24));
    recomputeConnectivityAndMetrics(state);
    return { state, label: "Started " + modeNames[cmd.mode] + " service", undoable: false };
  } else {
    if (!("id" in cmd) || typeof cmd.id !== "string") throw Error("Unknown edit.");
    const el = state.elements.find(item => item.id === cmd.id);
    if (!el) throw Error("That element has moved or been removed.");
    const def = ELEMENT_BY_ID[el.defId];
    if (cmd.kind === "move") {
      if (!sitePoint(cmd) || !relocatePlacedElement(state, el, cmd.gx, cmd.gz)) throw Error("That element does not fit there.");
      settleStreetFacing(state, el, false);
      label = "Moved " + def.name;
    } else if (cmd.kind === "demolish") {
      if (state.infrastructure?.spans[`${el.gx},${el.gz}`]) throw Error("Use Public Works to change established crossings.");
      removePlacedElements(state, new Set([el.id]));
      label = "Removed " + def.name;
    } else if (cmd.kind === "upgrade") {
      const result = upgradeElementDirect(state, el.id);
      if (!result.ok) throw Error(result.reason || "This element cannot upgrade.");
      label = "Upgraded " + def.name;
    } else if (cmd.kind === "rotate") {
      if (def.isNetwork) throw Error("Select a building to rotate.");
      if (!checkPlacementValid(state, def, el.gx, el.gz, el.spanZ, el.spanX, new Set([el.id])).valid) throw Error("There is not enough space to rotate.");
      [el.spanX, el.spanZ] = [el.spanZ, el.spanX];
      el.rotation = (el.rotation + 1) % 4;
      settleStreetFacing(state, el, true);
      label = "Rotated " + def.name;
    } else if (cmd.kind === "maintain") {
      const status = maintenanceStatus(state, el);
      if (status === "none" || status === "healthy") throw Error("This element does not need maintenance.");
      maintainElement(state, el.id);
      recomputeConnectivityAndMetrics(state);
      return { state, label: "Maintained " + def.name, undoable: false };
    } else throw Error("Unknown edit.");
  }
  recomputeConnectivityAndMetrics(state);
  const previousJournal = state.constructionHistory;
  rememberBuildingEdit(before, state, label);
  return { state, label, undoable: state.constructionHistory !== previousJournal };
}
