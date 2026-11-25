import { ELEMENT_BY_ID } from "./catalog";
import type { GameState, PlacedElement } from "./simulation";

type LayoutSite=ReturnType<typeof snapshot>;
function snapshot(el:PlacedElement){
  return {id:el.id,def:ELEMENT_BY_ID[el.defId],gx:el.gx,gz:el.gz,sx:el.spanX,sz:el.spanZ,rotation:el.rotation,level:el.level,
    variant:el.variant,axis:el.roadAxis,crossing:el.crossingAxis,overWater:el.overWater,under:el.waterUnderlay?.defId,
    underLevel:el.waterUnderlay?.level,sculpt:el.sculptsTerrain,side:el.autoDrive?.side,slot:el.autoDrive?.slot,
    front:el.edgeOverrides?.front,back:el.edgeOverrides?.back,left:el.edgeOverrides?.left,right:el.edgeOverrides?.right,
    wellActive:el.defId==="wells" && !el.disrepair && !el.onFire};
}
function same(s:LayoutSite,e:PlacedElement):boolean {
  const edges=e.edgeOverrides,drive=e.autoDrive;
  return s.id===e.id && s.def===ELEMENT_BY_ID[e.defId] && s.gx===e.gx && s.gz===e.gz && s.sx===e.spanX && s.sz===e.spanZ &&
    s.rotation===e.rotation && s.level===e.level && s.variant===e.variant && s.axis===e.roadAxis && s.crossing===e.crossingAxis &&
    s.overWater===e.overWater && s.under===e.waterUnderlay?.defId && s.underLevel===e.waterUnderlay?.level && s.sculpt===e.sculptsTerrain &&
    s.side===drive?.side && s.slot===drive?.slot && s.front===edges?.front && s.back===edges?.back && s.left===edges?.left && s.right===edges?.right &&
    s.wellActive===(e.defId==="wells" && !e.disrepair && !e.onFire);
}
/** Spatial inputs are copied by value so in-place game edits and cloned ticks are both handled. */
export class ParcelLayoutRevision {
  private sites:LayoutSite[]=[];
  private terrainVersion=-1;
  private revision=-1;
  private stamp?:string;
  private cells?:NonNullable<GameState["infrastructure"]>["cells"];
  private voxels?:NonNullable<GameState["infrastructure"]>["voxels"];
  private spans?:NonNullable<GameState["infrastructure"]>["spans"];
  private streets?:NonNullable<GameState["infrastructure"]>["streets"];
  update(state: GameState): boolean {
    const i=state.infrastructure,version=state.terrainVersion??1;
    if(this.terrainVersion===version && this.revision===(i?.revision??0) && this.stamp===i?.stamp &&
      this.cells===i?.cells && this.voxels===i?.voxels && this.spans===i?.spans && this.streets===i?.streets &&
      this.sites.length===state.elements.length && this.sites.every((s,n)=>same(s,state.elements[n])))return false;
    this.terrainVersion=version;this.revision=i?.revision??0;this.stamp=i?.stamp;
    this.cells=i?.cells;this.voxels=i?.voxels;this.spans=i?.spans;this.streets=i?.streets;
    this.sites=state.elements.map(snapshot);
    return true;
  }
}
