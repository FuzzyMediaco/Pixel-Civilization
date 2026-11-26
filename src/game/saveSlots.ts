import { restoreBeachGround } from "./terrainInteraction";
import { readPlayerItem, slotKey, writePlayerItem, writePlayerItems, insertPlayerSlot } from "./deviceSaves";
import { listCustomElements, type CustomElementSpec } from "./customElements";
import { type GameMode, STAGES } from "./catalog";
import { type GameState, migrateCenteredHighways, recomputeConnectivityAndMetrics } from "./simulation";

import { INITIAL_SAVE_SLOTS, isSaveSlotIndex, MAX_SAVE_SLOTS } from "./saveSlotLimits";
export { MAX_SAVE_SLOTS } from "./saveSlotLimits";
const SLOTS_STORAGE_KEY = "pixel_civ_saved_slots_v1";

export interface CivilizationSaveSlot {
  slotIndex: number;
  name: string;
  mode: GameMode;
  savedAt: number;
  population: number;
  happiness: number;
  currentStage: number;
  stageName: string;
  money: number;
  elementCount: number;
  state: GameState;
}

export function createEmptySlots(): (CivilizationSaveSlot | null)[] {
  return Array.from({ length: INITIAL_SAVE_SLOTS }, () => null);
}

export function loadSaveSlots(): (CivilizationSaveSlot | null)[] {
  const result = createEmptySlots();
  let previous: unknown[] = [];
  try {
    const legacy = JSON.parse(readPlayerItem(SLOTS_STORAGE_KEY) ?? "null");
    if (Array.isArray(legacy)) previous = legacy;
  } catch { /* Legacy data can be corrupt while individual slots are usable. */ }
  for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
    try {
      const raw = readPlayerItem(slotKey(i));
      if (i < INITIAL_SAVE_SLOTS || raw !== null || i < previous.length) {
        while (result.length <= i) result.push(null);
        const item: CivilizationSaveSlot | null = raw === null ? (previous[i] as CivilizationSaveSlot | undefined) ?? null : JSON.parse(raw);
        if (item?.state && Array.isArray(item.state.elements)) result[i] = { ...item, slotIndex: i };
      }
    } catch { /* Keep reading the other slots. */ }
  }
  return result;
}

export async function addCivilizationSlot(): Promise<(CivilizationSaveSlot | null)[]> {
  const next = loadSaveSlots().length;
  if (!isSaveSlotIndex(next)) throw Error("All ten save slots are available.");
  await insertPlayerSlot(next, "null");
  return loadSaveSlots();
}

export function cloneGameStateSnapshot(state: GameState): GameState {
  const cloned = JSON.parse(JSON.stringify({ ...state, toasts: [] })) as GameState;
  for (const el of cloned.elements) {
    el.animProgress = 0;
  }
  cloned.toasts = [];
  if (typeof cloned.timeOfDay !== "number") cloned.timeOfDay = 10.5;
  if (typeof cloned.timeLocked !== "boolean") cloned.timeLocked = false;
  if (!cloned.weather) cloned.weather = "clear";
  if (typeof cloned.weatherLocked !== "boolean") cloned.weatherLocked = false;
  if (typeof cloned.weatherIntensity !== "number") cloned.weatherIntensity = 1.0;
  if (typeof cloned.windSpeed !== "number") cloned.windSpeed = 1.0;
  if (typeof cloned.weatherTimerSec !== "number") cloned.weatherTimerSec = 55;
  if (typeof cloned.crimeCooldownSec !== "number") cloned.crimeCooldownSec = 12;
  if (typeof cloned.godCrimeEnabled !== "boolean") {
    cloned.godCrimeEnabled = false;
    cloned.crimeIncidents = [];
  }
  if (!Array.isArray(cloned.crimeIncidents)) cloned.crimeIncidents = [];
  if (cloned.activeAttack === undefined) cloned.activeAttack = null;
  migrateCenteredHighways(cloned);
  restoreBeachGround(cloned);
  recomputeConnectivityAndMetrics(cloned);
  return cloned;
}

export function makeSlot(index: number, name: string, state: GameState): CivilizationSaveSlot {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  return {
    slotIndex: index,
    name: name.trim() || `Civilization ${index + 1}`,
    mode: state.mode,
    savedAt: Date.now(),
    population: state.population,
    happiness: state.happiness,
    currentStage: state.currentStage,
    stageName: state.mode === "god" ? "Sandbox" : stage.name,
    money: Math.floor(state.money),
    elementCount: state.elements.length,
    state,
  };
}

export function saveCivilizationToSlot(
  slotIndex: number,
  customName: string,
  state: GameState,
): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  if (!isSaveSlotIndex(slotIndex) || slotIndex >= slots.length) throw Error("Add this save slot first.");
  const idx = slotIndex;
  slots[idx] = makeSlot(idx, customName, cloneGameStateSnapshot(state));
  writePlayerItem(slotKey(idx), JSON.stringify(slots[idx]));
  return slots;
}

export function persistNamedIsland(index: number, name: string, state: GameState) {
  if (!isSaveSlotIndex(index)) throw Error("Invalid save slot.");
  const slot = makeSlot(index, name, { ...state, toasts: [] });
  // The resume pointer and the world belong to the same device transaction.
  writePlayerItems([
    [slotKey(index), JSON.stringify(slot)],
    ["pixel_civ_last_mode", "slot-" + index],
  ]);
}

export async function saveImportedCivilization(slotIndex: number, name: string, state: GameState, additions: CustomElementSpec[]) {
  const slots = loadSaveSlots();
  if (!isSaveSlotIndex(slotIndex) || slotIndex >= slots.length || slots[slotIndex]) {
    throw Error("Choose an empty slot to import this world.");
  }
  const custom: [string, string] | undefined = additions.length
    ? ["pixel_civ_pix_custom_elements_v1", JSON.stringify([...listCustomElements(), ...additions])] : undefined;
  // Preserve the source state, including its camera and earthworks. Load refreshes derived metrics.
  await insertPlayerSlot(slotIndex, JSON.stringify(makeSlot(slotIndex, name, state)), custom);
  return loadSaveSlots();
}

export function renameCivilizationSlot(
  slotIndex: number,
  newName: string,
): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  const slot = slots[slotIndex];
  if (slot && newName.trim()) {
    slot.name = newName.trim();
    writePlayerItem(slotKey(slotIndex), JSON.stringify(slots[slotIndex]));
  }
  return slots;
}

export function deleteCivilizationSlot(slotIndex: number): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  if (isSaveSlotIndex(slotIndex) && slotIndex < slots.length) {
    slots[slotIndex] = null;
    writePlayerItem(slotKey(slotIndex), JSON.stringify(slots[slotIndex]));
  }
  return slots;
}
