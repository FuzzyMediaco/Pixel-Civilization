import { ROME_PILOT_IDS, type EraKey } from "../game/eraStyles";
import { ERA_SIGNATURE_NAMES } from "../game/eraNames";

/** Resolve an illustrated selection without loading its optional geometry pack. */
export function bakedEraSheet(id: string, era: EraKey): string | undefined {
  // The eagerly loaded name manifest and Vite's hashed image URL table work before an art pack loads.
  // render-era-sheets.mjs produces one image for every named, deliberate presentation.
  if (Object.hasOwn(ERA_SIGNATURE_NAMES[era] ?? {}, id)) {
    return new URL(`./eraSheetArt/${era}/era-sheet-${id}.webp`, import.meta.url).href;
  }
  if ((era === "rome-forum" || era === "rome-aqueduct") && ROME_PILOT_IDS.includes(id)) {
    return "./handbook/era-pilot/models/" + era + "/" + id + ".webp";
  }
  return undefined;
}
