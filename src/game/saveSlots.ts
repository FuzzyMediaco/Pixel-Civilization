import { readPlayerItem, slotKey, writePlayerItem, insertPlayerSlot } from "./deviceSaves";
import { listCustomElements, type CustomElementSpec } from "./customElements";
import { type GameMode, STAGES } from "./catalog";
import { type GameState, migrateCenteredHighways, recomputeConnectivityAndMetrics } from "./simulation";

export const MAX_SAVE_SLOTS = 3;
const SLOTS_STORAGE_KEY = "pixel_civ_saved_slots_v1";

export interface CivilizationSaveSlot {
  slotIndex: number; // 0, 1, 2
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
  return [null, null, null];
}

export function loadSaveSlots(): (CivilizationSaveSlot | null)[] {
  const result = createEmptySlots();
  try {
    const legacy = readPlayerItem(SLOTS_STORAGE_KEY);
    const previous = legacy ? JSON.parse(legacy) : [];
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const raw = readPlayerItem(slotKey(i));
      const item: CivilizationSaveSlot | null = raw === null ? previous?.[i] : JSON.parse(raw);
      if (item && item.state && Array.isArray(item.state.elements)) {
        result[i] = {
          ...item,
          slotIndex: i,
        };
      }
    }
  } catch {
    // Ignore malformed storage
  }
  return result;
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
  recomputeConnectivityAndMetrics(cloned);
  return cloned;
}

function makeSlot(index: number, name: string, state: GameState): CivilizationSaveSlot {
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
  const idx = Math.max(0, Math.min(MAX_SAVE_SLOTS - 1, slotIndex));
  slots[idx] = makeSlot(idx, customName, cloneGameStateSnapshot(state));
  writePlayerItem(slotKey(idx), JSON.stringify(slots[idx]));
  return slots;
}

export async function saveImportedCivilization(slotIndex: number, name: string, state: GameState, additions: CustomElementSpec[]) {
  if (slotIndex < 0 || slotIndex >= MAX_SAVE_SLOTS || loadSaveSlots()[slotIndex]) {
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
  if (slotIndex >= 0 && slotIndex < MAX_SAVE_SLOTS) {
    slots[slotIndex] = null;
    writePlayerItem(slotKey(slotIndex), JSON.stringify(slots[slotIndex]));
  }
  return slots;
}
