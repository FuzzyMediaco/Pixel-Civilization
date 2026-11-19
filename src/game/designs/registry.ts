/**
 * Element design registry.
 *
 * Every civilization element registers a `DesignEntry` here (from one of the category files in
 * this folder). An entry carries:
 *  - `footprints`: the [spanX, spanZ] footprint in grid tiles for Levels 1..5 (local, unrotated).
 *  - `levels`: a short, element-specific name for each of the 5 levels (e.g. "Seedling Plot").
 *  - `growth`: one-line description of how this element grows when it levels up.
 *  - `build(ctx)`: the voxel builder.
 *
 * This file deliberately imports nothing from the game so it can be shared by the catalog,
 * the simulation, the renderer and the standalone gallery without import cycles.
 */
import type { Ctx } from "./kit";

export type Footprint = [number, number];

export interface DesignEntry {
  /** [spanX, spanZ] for Lv.1..Lv.5 (local axes, before rotation). Each axis 1..4, non-decreasing. */
  footprints: [Footprint, Footprint, Footprint, Footprint, Footprint];
  /** Display names for Lv.1..Lv.5 */
  levels: [string, string, string, string, string];
  /** Short description of how the element evolves as it levels */
  growth: string;
  build: (c: Ctx) => void;
}

export const DESIGNS: Record<string, DesignEntry> = {};

export function defineDesigns(entries: Record<string, DesignEntry>): void {
  for (const [id, entry] of Object.entries(entries)) {
    DESIGNS[id] = entry;
  }
}

export function getDesign(id: string): DesignEntry | undefined {
  return DESIGNS[id];
}

export function getLevelName(id: string, level: number): string | undefined {
  const d = DESIGNS[id];
  if (!d) return undefined;
  return d.levels[Math.max(0, Math.min(4, (level | 0) - 1))];
}
