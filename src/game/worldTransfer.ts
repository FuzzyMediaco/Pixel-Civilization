import { ELEMENT_BY_ID, MAX_FOOTPRINT, STAGES, type GameMode } from "./catalog";
import { enforceModeBalance, getCustomElementSpec, listCustomElements, registerCustomElement, type CustomElementSpec } from "./customElements";
import { withinMap } from "./mapBounds";
import { MAX_SAVE_SLOTS, saveImportedCivilization } from "./saveSlots";
import type { GameState } from "./simulation";

export const MAX_TRANSFER_BYTES = 16 * 1024 * 1024;
const FORMAT = "pixel_civ_world_v1";
const MODES: readonly GameMode[] = ["god", "real", "survival", "idle", "manager"];
const CUSTOM_KEY = "pixel_civ_pix_custom_elements_v1";

export interface TransferWorld {
  name: string;
  state: GameState;
  customElements: CustomElementSpec[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function parseJson(text: string): unknown {
  if (new Blob([text]).size > MAX_TRANSFER_BYTES) throw Error("This file exceeds 16 MiB.");
  return JSON.parse(text, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") throw new SyntaxError("Invalid data key");
    return value;
  });
}

function checkedWorld(raw: unknown, label: unknown, definitions: unknown): TransferWorld {
  const state = record(raw);
  if (!state || !MODES.includes(state.mode as GameMode) ||
      !["money", "population", "happiness", "activePlaySec", "growthPool", "currentStage", "highestStageReached"].every(key => Number.isFinite(state[key])) ||
      Number(state.currentStage) < 1 || Number(state.currentStage) > STAGES.length ||
      !Array.isArray(state.elements) || state.elements.length > 40000 ||
      (state.terrainVersion !== undefined && state.terrainVersion !== 1 && state.terrainVersion !== 2)) {
    throw Error("This world has invalid or unsupported save data.");
  }
  const specs = new Map<string, CustomElementSpec>();
  for (const rawSpec of Array.isArray(definitions) ? definitions : []) {
    const spec = record(rawSpec);
    if (!spec || typeof spec.id !== "string" || !/^custom_[a-z0-9_]{1,60}$/.test(spec.id)) continue;
    const mode = MODES.includes(spec.createdInMode as GameMode) ? spec.createdInMode as GameMode : state.mode as GameMode;
    specs.set(spec.id, enforceModeBalance(spec, mode, spec.id).spec);
  }

  const used = new Set<string>();
  const placed = new Set<string>();
  for (const entry of state.elements) {
    const el = record(entry);
    if (!el || typeof el.id !== "string" || placed.has(el.id) || typeof el.defId !== "string" ||
        !["gx", "gz", "spanX", "spanZ", "rotation", "level", "variant"].every(key => Number.isInteger(el[key])) ||
        Number(el.spanX) < 1 || Number(el.spanZ) < 1 || Number(el.spanX) > MAX_FOOTPRINT || Number(el.spanZ) > MAX_FOOTPRINT ||
        !withinMap(Number(el.gx), Number(el.gz)) ||
        !withinMap(Number(el.gx) + Number(el.spanX) - 1, Number(el.gz) + Number(el.spanZ) - 1)) {
      throw Error("This world contains invalid building placements.");
    }
    placed.add(el.id);
    if (specs.has(el.defId)) used.add(el.defId);
    else if (!Object.hasOwn(ELEMENT_BY_ID, el.defId)) throw Error(`Missing element “${el.defId.slice(0, 70)}”. Use a compatible game version or include its Pix design.`);
  }
  if (state.infrastructure != null) {
    const infra = record(state.infrastructure);
    if (!infra || !["cells", "spans", "conduits", "streets", "storage"].every(key => record(infra[key])) || !Array.isArray(infra.undo)) {
      throw Error("This world contains invalid terrain or infrastructure data.");
    }
  }

  return {
    name: typeof label === "string" && label.trim() ? label.trim().slice(0, 36) : "Imported Civilization",
    state: state as unknown as GameState,
    customElements: [...used].map(id => specs.get(id)!),
  };
}

export function readWorldFile(text: string): TransferWorld[] {
  let raw: Record<string, unknown> | undefined;
  try { raw = record(parseJson(text)); }
  catch (err) {
    if (err instanceof SyntaxError || err instanceof RangeError) throw Error("Choose a valid Pixel Civilization JSON backup.");
    throw err;
  }
  if (raw?.format === FORMAT) return [checkedWorld(raw.state, raw.name, raw.customElements)];
  if (raw?.format !== "pixel_civ_backup_v1") throw Error("This file format is not a Pixel Civilization world or backup.");
  const storage = record(raw.storage);
  const storedSpecs = storage?.[CUSTOM_KEY];
  const custom = typeof storedSpecs === "string" ? parseJson(storedSpecs) : [];
  const worlds = [];
  if (raw.activeState) worlds.push(checkedWorld(raw.activeState, "Imported Civilization", custom));
  for (const value of Array.isArray(raw.slots) ? raw.slots.slice(0, MAX_SAVE_SLOTS) : []) {
    const slot = record(value);
    if (slot?.state) worlds.push(checkedWorld(slot.state, slot.name, custom));
  }
  if (!worlds.length) throw Error("This backup does not contain any worlds.");
  return worlds;
}

export function serializeWorld(name: string, state: GameState): string {
  const ids = new Set(state.elements.map(el => el.defId));
  const customElements = listCustomElements().filter(spec => ids.has(spec.id));
  const text = JSON.stringify({ format: FORMAT, name, savedAt: Date.now(), state: { ...state, toasts: [] }, customElements });
  if (new Blob([text]).size > MAX_TRANSFER_BYTES) throw Error("This world exceeds the 16 MiB transfer limit.");
  return text;
}

export async function importWorldIntoSlot(index: number, world: TransferWorld) {
  const additions = world.customElements.filter(spec => {
    const existing = getCustomElementSpec(spec.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(spec)) {
      throw Error(`A different Pix design named “${spec.name}” already exists in this profile.`);
    }
    return !existing;
  });
  const slots = await saveImportedCivilization(index, world.name, world.state, additions);
  for (const spec of additions) registerCustomElement(spec, false);
  return slots;
}

export function downloadWorld(name: string, state: GameState) {
  const url = URL.createObjectURL(new Blob([serializeWorld(name, state)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pixel-civilization"}-world.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const base64UrlBytes = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

export async function readLinkedWorld(link: string, signal: AbortSignal): Promise<TransferWorld[]> {
  const [id, secret, extra] = link.split(".");
  if (extra !== undefined || !/^[a-f0-9]{32}$/.test(id) || !/^[a-zA-Z0-9_-]{43}$/.test(secret)) {
    throw Error("The private world link is invalid.");
  }
  const response = await fetch(`/world-transfers/${id}.bin`, { signal, cache: "no-store" });
  if (!response.ok) throw Error("This private link is unavailable. You can still import the original JSON backup.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 29 || bytes.length > MAX_TRANSFER_BYTES) throw Error("The private world file is invalid.");
  const key = await crypto.subtle.importKey("raw", base64UrlBytes(secret), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  const expanded = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return readWorldFile(expanded);
}
