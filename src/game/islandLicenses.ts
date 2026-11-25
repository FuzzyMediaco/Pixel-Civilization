import { currentPlayer, readPlayerItem } from "./deviceSaves";
import { loadSaveSlots } from "./saveSlots";
import { cachedStoreAccess } from "./storeAccess";
import { canUseProduct, productForMode } from "./storeCatalog.mjs";
import { lastActiveSlot, loadModeState, resumeIsland } from "./activeIsland";
import type { GameState } from "./simulation";

const marker="pixel.civ.pre-store-device-modes.v1";
let guestGrants:string[]=[];
/** Capture pre-store local play once, before this edition has written any islands. */
export function preserveExistingDeviceModes() {
  try {
    const prior=localStorage.getItem(marker);
    if(prior!==null){guestGrants=JSON.parse(prior);return;}
    if(currentPlayer())return;
    const played=loadSaveSlots().flatMap(s=>s&&!s.state.exampleWorldId&&s.state.elements.length?[s.mode]:[]);
    for(const mode of ["god","survival"] as const) {
      const raw=readPlayerItem("pixel_civ_save_v1_"+mode);
      if(raw && JSON.parse(raw).elements?.length)played.push(mode);
    }
    guestGrants=[...new Set(played.map(productForMode).filter((id):id is string=>Boolean(id)))];
    localStorage.setItem(marker,JSON.stringify(guestGrants));
  } catch {guestGrants=[];}
}
export function islandProductAvailable(id:string|undefined) {
  if (typeof location!=="undefined" && location.hostname==="pixel-civilization-rome-preview.fuzzymedia.workers.dev")return true;
  return canUseProduct(cachedStoreAccess(),id) || (!currentPlayer() && !!id && guestGrants.includes(id));
}
export function resumeAccessibleIsland(hash:string):{city:GameState;slot:number|null} {
  const city=resumeIsland(hash);
  if(!city.exampleWorldId && !islandProductAvailable(productForMode(city.mode)))return {city:loadModeState("real"),slot:null};
  return {city,slot:lastActiveSlot(hash)};
}
