import { normalizeEra } from "./eraStyles";
import { artOutsideWorkerControl, keepViewedEra, prepareOfflineShell } from "../offlineShell";
import type { Ink, ProductionEra } from "./designs/periodArtCatalog";

type RomeArt = typeof import("./designs/romePilot");
type Engine = typeof import("./designs/periodArchitecture");
const imports = {
  "ancient-china": () => import("./designs/periods/pack-ancient-china"),
  "ancient-egypt": () => import("./designs/periods/pack-ancient-egypt"),
  "rome-aqueduct": () => import("./designs/periods/pack-rome-aqueduct"),
  "ancient-greece": () => import("./designs/periods/pack-ancient-greece"),
  "medieval-europe": () => import("./designs/periods/pack-medieval-europe"),
  "renaissance-italy": () => import("./designs/periods/pack-renaissance-italy"),
  "world-war-ii": () => import("./designs/periods/pack-world-war-ii"),
  "art-deco": () => import("./designs/periods/pack-art-deco"),
  "future-3027": () => import("./designs/periods/pack-future-3027"),
  "post-apocalyptic": () => import("./designs/periods/pack-post-apocalyptic"),
} satisfies Record<ProductionEra, () => Promise<{default: Ink}>>;
let rome: RomeArt | undefined;
let romePromise: Promise<RomeArt> | undefined;
let engine: Engine | undefined;
const inks = new Map<ProductionEra, Ink>();
const pending = new Map<string, Promise<void>>();
let revision = 0;

export const currentRomeArt = () => rome;
export const eraArtRevision = () => revision;
export const currentProductionArt = (era:string) => {
  const ink=inks.get(era as ProductionEra);
  return engine && ink ? {engine,ink} : undefined;
};
export function isEraArtReady(value:unknown) {
  const era=normalizeEra(value) as string;
  if(era==="original")return true;
  if(era==="rome-forum")return Boolean(rome);
  return inks.has(era as ProductionEra) && (era!=="rome-aqueduct" || Boolean(rome));
}

function loadRomanPilot() {
  romePromise ??= import("./designs/romePilot").then(module => rome=module)
    .catch(error=>{romePromise=undefined;throw error;});
  return romePromise;
}
export async function loadEraArt(value: unknown): Promise<void> {
  const era=normalizeEra(value) as string;
  if(isEraArtReady(era))return;
  const existing=pending.get(era);
  if(existing)return existing;
  const loading=prepareOfflineShell().then(async()=>{
    const retainInitialPack=artOutsideWorkerControl();
    if(era==="rome-forum"){await loadRomanPilot();}
    else if(Object.hasOwn(imports,era)){
      const key=era as ProductionEra;
      const [module,kit]=await Promise.all([import("./designs/periodArchitecture"),imports[key](),
        era==="rome-aqueduct"?loadRomanPilot():undefined]);
      engine=module;inks.set(key,kit.default);
    }
    if(retainInitialPack)await keepViewedEra(era);
    revision++;
  }).finally(()=>pending.delete(era));
  pending.set(era,loading);
  return loading;
}
