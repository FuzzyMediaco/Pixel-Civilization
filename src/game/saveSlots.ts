import { type GameMode, STAGES } from "./catalog";
import { type GameState, recomputeConnectivityAndMetrics } from "./simulation";

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
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (!raw) return result;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return result;
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
      const item = parsed[i] as CivilizationSaveSlot | null | undefined;
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

function persistSlots(slots: (CivilizationSaveSlot | null)[]): void {
  localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots));
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
  recomputeConnectivityAndMetrics(cloned);
  return cloned;
}

export function saveCivilizationToSlot(
  slotIndex: number,
  customName: string,
  state: GameState,
): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  const idx = Math.max(0, Math.min(MAX_SAVE_SLOTS - 1, slotIndex));
  const stageObj = STAGES[Math.max(0, Math.min(STAGES.length - 1, state.currentStage - 1))];
  const cleanName = customName.trim() || `Civilization ${idx + 1}`;
  const snapshot = cloneGameStateSnapshot(state);

  slots[idx] = {
    slotIndex: idx,
    name: cleanName,
    mode: snapshot.mode,
    savedAt: Date.now(),
    population: snapshot.population,
    happiness: snapshot.happiness,
    currentStage: snapshot.currentStage,
    stageName: snapshot.mode === "god" ? "Sandbox" : stageObj.name,
    money: Math.floor(snapshot.money),
    elementCount: snapshot.elements.length,
    state: snapshot,
  };

  persistSlots(slots);
  return slots;
}

export function renameCivilizationSlot(
  slotIndex: number,
  newName: string,
): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  const slot = slots[slotIndex];
  if (slot && newName.trim()) {
    slot.name = newName.trim();
    persistSlots(slots);
  }
  return slots;
}

export function deleteCivilizationSlot(slotIndex: number): (CivilizationSaveSlot | null)[] {
  const slots = loadSaveSlots();
  if (slotIndex >= 0 && slotIndex < MAX_SAVE_SLOTS) {
    slots[slotIndex] = null;
    persistSlots(slots);
  }
  return slots;
}
