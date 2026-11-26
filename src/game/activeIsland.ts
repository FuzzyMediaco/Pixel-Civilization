import { restoreBeachGround } from "./terrainInteraction";
import { normalizeEra } from "./eraStyles";
import { readPlayerItem, writePlayerItems } from "./deviceSaves";
import { cloneGameStateSnapshot, loadSaveSlots } from "./saveSlots";
import { isSaveSlotIndex } from "./saveSlotLimits";
import type { GameMode } from "./catalog";
import { createInitialGameState, migrateCenteredHighways, recomputeConnectivityAndMetrics, type GameState } from "./simulation";
import { EXAMPLE_WORLDS, createExampleWorld, type ExampleMode, type ExampleWorldId } from "./exampleWorlds";
const SAVE_PREFIX = "pixel_civ_save_v1_";

const exampleById = (value: string) => EXAMPLE_WORLDS.find(w => w.id === value)?.id;
const saveName = (mode: GameMode, exampleId?: ExampleWorldId) => exampleId
  ? "example-" + (mode === "real" ? "real-" : "") + exampleId
  : mode;

export function loadModeState(mode: GameMode, exampleId?: ExampleWorldId): GameState {
  try {
    const raw = readPlayerItem(SAVE_PREFIX + saveName(mode, exampleId));
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && Array.isArray(parsed.elements) && parsed.mode === mode && parsed.exampleWorldId === exampleId) {
        for (const el of parsed.elements) {
          el.animProgress = 0;
        }
        parsed.toasts = [];
        if (typeof parsed.timeOfDay !== "number") parsed.timeOfDay = 10.5;
        if (typeof parsed.timeLocked !== "boolean") parsed.timeLocked = false;
        if (!parsed.weather) parsed.weather = "clear";
        if (typeof parsed.weatherLocked !== "boolean") parsed.weatherLocked = false;
        if (typeof parsed.weatherIntensity !== "number") parsed.weatherIntensity = 1.0;
        if (typeof parsed.windSpeed !== "number") parsed.windSpeed = 1.0;
        if (typeof parsed.weatherTimerSec !== "number") parsed.weatherTimerSec = 55;
        if (typeof parsed.crimeCooldownSec !== "number") parsed.crimeCooldownSec = 12;
        if (typeof parsed.godCrimeEnabled !== "boolean") {
          parsed.godCrimeEnabled = false;
          parsed.crimeIncidents = [];
        }
        if (!Array.isArray(parsed.crimeIncidents)) parsed.crimeIncidents = [];
        if (parsed.activeAttack === undefined) parsed.activeAttack = null;
        if (parsed.activeAttack) {
          if (!Array.isArray(parsed.activeAttack.defenders)) parsed.activeAttack.defenders = [];
          if (typeof parsed.activeAttack.severity !== "number") parsed.activeAttack.severity = 1;
        }
        migrateCenteredHighways(parsed);
        restoreBeachGround(parsed);
        recomputeConnectivityAndMetrics(parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore storage read issues
  }
  return exampleId ? createExampleWorld(exampleId, mode === "real" ? "real" : "god") : createInitialGameState(mode);
}

export function readExampleRoute(hash: string): { id: ExampleWorldId; mode: ExampleMode; viewIndex?: number } | undefined {
  const route = new URLSearchParams(hash.replace(/^#/, ""));
  const world = EXAMPLE_WORLDS.find(item => item.id === route.get("world"));
  if (!world) return undefined;
  const view = route.get("view");
  const index = Number(view);
  const validView = view !== null && /^\d+$/.test(view) && world.viewpoints[index];
  return { id: world.id, mode: route.get("mode") === "real" ? "real" : "god", viewIndex: validView ? index : undefined };
}

export function lastActiveSlot(hash = ""): number | null {
  if (readExampleRoute(hash)) return null;
  try {
    const match = /^slot-(\d+)$/.exec(readPlayerItem("pixel_civ_last_mode") ?? "");
    const index = match ? Number(match[1]) : -1;
    return isSaveSlotIndex(index) && loadSaveSlots()[index] ? index : null;
  } catch {
    return null;
  }
}

export const islandSaveKey = (state: GameState) => SAVE_PREFIX + saveName(state.mode, state.exampleWorldId);

export function resumeIsland(hash = ""): GameState {
  let last = "god";
  try { last = readPlayerItem("pixel_civ_last_mode") ?? last; } catch { /* A private session can still play. */ }
  const requested = readExampleRoute(hash);
  if (requested) {
    const city = loadModeState(requested.mode, requested.id);
    if (requested.viewIndex !== undefined) {
      city.exampleViewpoint = requested.viewIndex;
      delete city.cameraView;
    }
    let origin = last;
    if (last.startsWith("example-")) {
      try { origin = readPlayerItem("pixel_civ_example_origin") ?? "god"; } catch { origin = "god"; }
    }
    city.exampleReturnMode =
      origin === "real" || origin === "survival" || origin === "idle" || origin === "manager" ? origin : "god";
    const era = new URLSearchParams(hash.slice(1)).get("era");
    if (era != null && requested.id.startsWith("rome-")) city.appearanceEra = normalizeEra(era);
    return city;
  }
  if (last.startsWith("slot-")) {
    const index = lastActiveSlot(hash);
    const slot = index === null ? null : loadSaveSlots()[index];
    if (slot) return cloneGameStateSnapshot(slot.state);
  }
  if (last === "real" || last === "survival" || last === "idle" || last === "manager") return loadModeState(last);
  if (last.startsWith("example-real-")) {
    const id = exampleById(last.slice("example-real-".length));
    if (id) return loadModeState("real", id);
  }
  return loadModeState("god", last.startsWith("example-") ? exampleById(last.slice(8)) : undefined);
}

export function persistMode(state: GameState): boolean {
  try {
    const slim: GameState = {
      ...state,
      toasts: [],
    };
    const key = saveName(state.mode, state.exampleWorldId);
    const items: [string, string][] = [[SAVE_PREFIX + key, JSON.stringify(slim)]];
    if (state.exampleWorldId) items.push(["pixel_civ_example_origin", state.exampleReturnMode ?? "god"]);
    items.push(["pixel_civ_last_mode", key]);
    writePlayerItems(items);
    return true;
  } catch {
    return false;
  }
}
