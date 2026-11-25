import { ParcelLayoutRevision } from "./parcelLayoutRevision";
import { ELEMENT_BY_ID, type CivElementDef } from "./catalog";
import { BuildingCollisionIndex } from "./buildingCollision";
import { getParcelEdges, getParcelEdgeKey } from "./parcelEdges";
import { getParcelSoils } from "./parcelGeometry";
import { corridorArt } from "./roadCorridors";
import { buildOccupancyMap, getNetworkConnMask, gridToWorldCenter, type GameState, type PlacedElement } from "./simulation";
import { getTerrainCell, tileKey } from "./terrain";
import { stripsFlatGroundSlabInWorld } from "./terrainInteraction";

function renderParcel(state:GameState,el:PlacedElement,def:CivElementDef,occupancy:Map<string,PlacedElement>,
  ground:(def:CivElementDef,x:number,z:number)=>number){
  const connMask=def.isNetwork?getNetworkConnMask(state.elements,el,occupancy,state):0;
  const swapped=!def.isNetwork && el.rotation%2===1;
  const localSpanX=swapped?el.spanZ:el.spanX, localSpanZ=swapped?el.spanX:el.spanZ;
  const worksSpan=state.infrastructure?.spans[tileKey(el.gx,el.gz)];
  const pose=def.isNetwork?{...el,rotation:0}:el;
  const edges=getParcelEdges(pose,occupancy,state).filter(e=>e.kind!=="road" && e.kind!=="rail" && e.kind!=="channel");
  const soils=def.domain==="land"?getParcelSoils(state,pose):undefined;
  const corridor=corridorArt(el,occupancy);
  const strip=el.sculptsTerrain || stripsFlatGroundSlabInWorld(el.defId);
  let terrainOverbuilt=false,worldSculpted=false;
  if(strip){
    for(let dx=0;dx<el.spanX;dx++)for(let dz=0;dz<el.spanZ;dz++){
      const x=el.gx+dx,z=el.gz+dz,k=tileKey(x,z);
      if(el.sculptsTerrain && !def.isNetwork && occupancy.get(k)?.id!==el.id)terrainOverbuilt=true;
      if(state.infrastructure?.voxels?.[k] || (!el.sculptsTerrain && getTerrainCell(state,x,z).kind==="coast"))worldSculpted=true;
    }
  }
  const [wx,wz]=gridToWorldCenter(el.gx,el.gz,el.spanX,el.spanZ);
  const baseY=ground(def,wx,wz);
  const key=[JSON.stringify(corridor)??"",terrainOverbuilt?"coexist":"",worldSculpted?"ws":"",worksSpan?.run??"",
    el.defId,localSpanX+"x"+localSpanZ,"R"+el.rotation,"C"+connMask,getParcelEdgeKey(edges),soils??""].join("|");
  return {localSpanX,localSpanZ,connMask,edges,soils,corridor,worldSculpted,terrainOverbuilt,worksSpan,wx,wz,baseY,key};
}
/** Render-only cache: simulation object identity may change on ticks or be edited in place. */
export class RenderLayout {
  private topology=new ParcelLayoutRevision();
  parcels=new Map<string,ReturnType<typeof renderParcel>>();
  blockers=new BuildingCollisionIndex([]);
  update(state:GameState,ground:(def:CivElementDef,x:number,z:number)=>number):boolean{
    if(!this.topology.update(state))return false;
    const occupancy=buildOccupancyMap(state.elements);
    this.parcels.clear();
    for(const el of state.elements){
      const def=ELEMENT_BY_ID[el.defId];if(def)this.parcels.set(el.id,renderParcel(state,el,def,occupancy,ground));
    }
    this.blockers=new BuildingCollisionIndex(state.elements);
    return true;
  }
}
