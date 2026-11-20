import { economyOf, transfer, type SiteAccount } from "./cityEconomy";
import { ELEMENT_BY_ID } from "./catalog";
import { ensureInfrastructure, markInfrastructureChanged, type TerrainCell, type Crossing, type Conduit, type StreetControl } from "./terrain";
import { recomputeConnectivityAndMetrics, type GameState, type PlacedElement } from "./simulation";

type GroundLayers = {cells:TerrainCell; spans:Crossing; conduits:Conduit; streets:StreetControl};
type GroundKey = keyof GroundLayers;
interface GroundEdit {key:string; layer:GroundKey; before?:GroundLayers[GroundKey]; after?:GroundLayers[GroundKey]}
interface SiteEdit {id:string; before?:PlacedElement; after?:PlacedElement; previousAccount?:SiteAccount; workAfter?:number}
export interface BuildingEdit {
  label:string;
  sites:SiteEdit[];
  ground:GroundEdit[];
  guardedGround:string;
  routes:string;
  refund:number;
}
const layers:GroundKey[]=["cells","spans","conduits","streets"];
const authored = ["defId","gx","gz","spanX","spanZ","rotation","level","variant","edgeOverrides","exteriorLighting",
  "overWater","waterUnderlay","sculptsTerrain","crossingAxis","pedestrianDeck","awaitingStreet"] as const;

function layout(el:PlacedElement | undefined):string {
  return JSON.stringify(el ? authored.map(k=>k==="waterUnderlay" ? layout(el.waterUnderlay) : el[k]) : null);
}
function footprint(e:PlacedElement, keys:Set<string>) {
  for(let x=e.gx;x<e.gx+e.spanX;x++) for(let z=e.gz;z<e.gz+e.spanZ;z++) keys.add(x+","+z);
}
function groundAt(state:GameState,layer:GroundKey,key:string) {
  return state.infrastructure?.[layer][key];
}
function physicalValue(value:GroundLayers[GroundKey] | undefined) {
  if(value && "requestedAt" in value) {
    const {requestedAt:_,...structure}=value;
    return structure;
  }
  return value;
}
function groundSignature(state:GameState, sites:SiteEdit[]) {
  const keys=new Set<string>();
  for(const site of sites) {if(site.before) footprint(site.before,keys);if(site.after) footprint(site.after,keys);}
  return JSON.stringify([...keys].map(k => layers.map(layer=>physicalValue(groundAt(state,layer,k)))));
}
function routeSignature(state:GameState, sites:SiteEdit[]) {
  const ids=new Set(sites.map(s=>s.id));
  return JSON.stringify((state.mobility?.lines??[]).filter(l=>ids.has(l.depot)||l.stops.some(s=>ids.has(s)))
    .map(l=>[l.id,l.depot,l.mode,l.stops]));
}
function paid(state:GameState) {
  const bucket=Math.floor(state.activePlaySec/10)*10;
  return (state.economy?.ledger??[]).reduce((total,t)=>total+(t.time===bucket && t.from==="treasury" && t.to==="outside" &&
    (t.label==="Construction" || t.label==="Building upgrade") ? t.amount:0),0);
}

/** Compare the two states already owned by the App transaction. Only the touched
 * parcels, affected infrastructure layers and exact paid amount enter the journal. */
export function rememberBuildingEdit(before:GameState, after:GameState, label:string):void {
  const old=new Map(before.elements.map(e=>[e.id,e])), next=new Map(after.elements.map(e=>[e.id,e]));
  const sites:SiteEdit[]=[];
  for(const id of new Set([...old.keys(),...next.keys()])) {
    const previous=old.get(id), current=next.get(id);
    if(layout(previous)===layout(current)) continue;
    sites.push({id,before:previous && structuredClone(previous),after:current && structuredClone(current),
      previousAccount:structuredClone(before.economy?.sites[id]),workAfter:after.economy?.sites[id]?.work});
  }
  if(!sites.length) return;
  const ground:GroundEdit[]=[];
  if(before.infrastructure?.revision!==after.infrastructure?.revision) {
    for(const layer of layers) {
      const keys=new Set([...Object.keys(before.infrastructure?.[layer]??{}),...Object.keys(after.infrastructure?.[layer]??{})]);
      for(const key of keys) {
        const prev=groundAt(before,layer,key), now=groundAt(after,layer,key);
        if(JSON.stringify(physicalValue(prev))!==JSON.stringify(physicalValue(now)))
          ground.push({key,layer,before:structuredClone(prev),after:structuredClone(now)});
      }
    }
  }
  const edit:BuildingEdit={label,sites,ground,guardedGround:groundSignature(after,sites),routes:routeSignature(after,sites),
    refund:Math.max(0,paid(after)-paid(before))};
  after.constructionHistory=[...(after.constructionHistory??[]).slice(-23),edit];
}

function overlaps(a:PlacedElement,b:PlacedElement) {
  return a.gx < b.gx+b.spanX && b.gx < a.gx+a.spanX && a.gz < b.gz+b.spanZ && b.gz < a.gz+a.spanZ;
}
function conflict(state:GameState,edit:BuildingEdit) {
  const live=new Map(state.elements.map(e=>[e.id,e])), ids=new Set(edit.sites.map(s=>s.id));
  if(edit.sites.some(s=>layout(live.get(s.id))!==layout(s.after))) return "A later edit changed one of these buildings.";
  if(routeSignature(state,edit.sites)!==edit.routes) return "A transit line now uses an edited site. Update that route first.";
  if(groundSignature(state,edit.sites)!==edit.guardedGround || edit.ground.some(g=>
    JSON.stringify(physicalValue(groundAt(state,g.layer,g.key)))!==JSON.stringify(physicalValue(g.after))))
    return "Later public works changed the ground or crossing at this site.";
  for(const site of edit.sites) {
    const restoring=site.before;
    if(!restoring || (site.after && site.after.gx===restoring.gx && site.after.gz===restoring.gz &&
      site.after.spanX===restoring.spanX && site.after.spanZ===restoring.spanZ)) continue;
    for(const other of state.elements) {
      if(ids.has(other.id) || !overlaps(restoring,other)) continue;
      // Terrain elements intentionally support a building or would already have
      // been legal beneath a saved legacy footprint.
      if(other.sculptsTerrain && !ELEMENT_BY_ID[other.defId]?.isWaterFeature) continue;
      if(restoring.sculptsTerrain && !ELEMENT_BY_ID[restoring.defId]?.isWaterFeature) continue;
      return "The former footprint is occupied. Move the newer building first.";
    }
  }
  // An intervening building can legitimately be placed on a sculpted lot, but
  // refunding that first paint/earthwork could leave the new building underwater.
  for(const g of edit.ground) if(g.layer==="cells") {
    const [x,z]=g.key.split(",").map(Number);
    if(state.elements.some(e=>!ids.has(e.id)&&!e.sculptsTerrain&&x>=e.gx&&x<e.gx+e.spanX&&z>=e.gz&&z<e.gz+e.spanZ))
      return "A building now uses ground altered by this edit.";
  }
}

export function undoBuildingEdit(state:GameState): {ok:boolean; reason?:string; label?:string; refunded?:number} {
  const edit=state.constructionHistory?.at(-1);
  if(!edit) return {ok:false,reason:"No building edits to undo."};
  const reason=conflict(state,edit);
  if(reason) return {ok:false,reason};
  const live=new Map(state.elements.map(e=>[e.id,e]));
  const remove=new Set(edit.sites.filter(s=>!s.before).map(s=>s.id));
  state.elements=state.elements.filter(e=>!remove.has(e.id));
  for(const site of edit.sites) {
    const prev=site.before, current=live.get(site.id);
    if(!prev) continue;
    if(current) {
      // Preserve live fires, maintenance time, inventories and time since the build.
      for(const k of authored) {
        if(k==="waterUnderlay" ? layout(prev.waterUnderlay)===layout(site.after?.waterUnderlay) : JSON.stringify(prev[k])===JSON.stringify(site.after?.[k])) continue;
        if(prev[k]===undefined) delete current[k];
        else Object.assign(current,{[k]:structuredClone(prev[k])});
      }
      const account=state.economy?.sites[site.id];
      if(current.level!==site.after?.level && account && site.previousAccount) {
        account.level=prev.level;
        account.work=site.previousAccount.work+Math.max(0,account.work-(site.workAfter??0));
      }
    } else {
      state.elements.push(structuredClone(prev));
      if(site.previousAccount) economyOf(state).sites[site.id]=structuredClone(site.previousAccount);
    }
  }
  if(edit.ground.length) {
    const inf=ensureInfrastructure(state);
    for(const g of edit.ground) {
      const records:Record<string,GroundLayers[GroundKey]>=inf[g.layer];
      if(g.before===undefined) delete records[g.key];
      else records[g.key]=structuredClone(g.before);
    }
    markInfrastructureChanged(inf);
  }
  if(edit.refund) transfer(state,"outside","treasury",edit.refund,"Building edit refund");
  state.constructionHistory!.pop();
  recomputeConnectivityAndMetrics(state);
  return {ok:true,label:edit.label,refunded:edit.refund};
}
