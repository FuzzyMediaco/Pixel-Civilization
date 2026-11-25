import { ELEMENT_BY_ID, getStandardFootprintForLevel, type CivElementDef } from "../game/catalog";
import { getGuideVariant, getNeighborPreview } from "../game/connectionPreview";
import { guideCarriageway } from "../game/designs/carriageways";
import type { EraKey } from "../game/eraStyles";
import type { ParcelAppearance } from "../game/parcelGeometry";
import { roadWidth } from "../game/roadStandards";

export interface ModelPlot {
  def: CivElementDef;
  level: number;
  variant: number;
  span: [number, number];
  mask: number;
  appearance: ParcelAppearance;
  x: number;
  z: number;
  rotation: number;
}

/** Both the live viewer and its camera-angle illustrations use this placement list. */
export function atlasPlots(def: CivElementDef, level: number, variant: number, era: EraKey, joined: boolean, active: boolean): ModelPlot[] {
  const appearance: ParcelAppearance = {era, eraActivity: active ? "active" : "idle"};
  const neighbors = joined ? getNeighborPreview(def.id, level) : [];
  if (neighbors.length) return neighbors.map(({el,mask,edges}, index) => {
    const other = ELEMENT_BY_ID[el.defId];
    return {def:other, level:el.level, variant:getGuideVariant(def.id, other.id, variant, index),
      span:getStandardFootprintForLevel(other, el.level), mask, appearance:{...appearance, edges},
      x:el.gx + el.spanX / 2, z:el.gz + el.spanZ / 2, rotation:other.isNetwork ? 0 : el.rotation};
  });
  if (roadWidth(def.id) > 1) return [0,1,2].map(i => ({
    def, level, variant, span:[1,1], mask:10, appearance:{...appearance, corridor:guideCarriageway(def.id,i)},
    x:i - 1, z:0, rotation:0,
  }));
  return [{def, level, variant, span:getStandardFootprintForLevel(def,level), mask:def.isNetwork ? 5 : 0, appearance, x:0,z:0,rotation:0}];
}
