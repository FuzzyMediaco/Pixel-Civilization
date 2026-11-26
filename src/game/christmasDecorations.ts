import type { CivElementDef } from "./catalog";
import type { PlacedElement } from "./simulation";

export function canDecorateForChristmas(def: CivElementDef | undefined) {
  if (!def || def.domain !== "land" || def.isNetwork) return false;
  return def.category === "housing" ||
    (def.category === "commerce" && ["shop_front","restaurant_bar","mall_plaza","office_commercial","skyscraper"].includes(def.archetype)) ||
    (def.category === "civic_parks" && ["school_campus","civic_hall","office_commercial"].includes(def.archetype));
}

export const christmasActionLabel = (el: PlacedElement) =>
  el.christmasDecorated ? "Remove Christmas decorations" : "Decorate for Christmas";

export function toggleChristmasDecorations(el: PlacedElement, def: CivElementDef) {
  if (!canDecorateForChristmas(def)) return false;
  if (el.christmasDecorated) delete el.christmasDecorated;
  else el.christmasDecorated = true;
  return true;
}
