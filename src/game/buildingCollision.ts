import { ELEMENT_BY_ID } from "./catalog";
import type { PlacedElement } from "./simulation";
import { TILE_SIZE } from "./voxelCore";

type Bounds={order:number;left:number;right:number;top:number;bottom:number};
const indexedMargin=.45;

/** Nearby solid parcels, ordered exactly as the two-pass walking resolver visits them. */
export class BuildingCollisionIndex {
  private readonly columns=new Map<number,Map<number,Bounds[]>>();
  private readonly all:Bounds[]=[];
  constructor(elements: readonly PlacedElement[]) {
    for(const el of elements) {
      const def=ELEMENT_BY_ID[el.defId];
      if(!def || def.isNetwork || def.passiveNature || def.domain!=="land")continue;
      const box={order:this.all.length,left:el.gx*TILE_SIZE,right:(el.gx+el.spanX)*TILE_SIZE,
        top:el.gz*TILE_SIZE,bottom:(el.gz+el.spanZ)*TILE_SIZE};
      this.all.push(box);
      const x0=Math.floor((box.left-indexedMargin)/TILE_SIZE),x1=Math.floor((box.right+indexedMargin)/TILE_SIZE);
      const z0=Math.floor((box.top-indexedMargin)/TILE_SIZE),z1=Math.floor((box.bottom+indexedMargin)/TILE_SIZE);
      for(let gx=x0;gx<=x1;gx++){
        let column=this.columns.get(gx);
        if(!column){column=new Map();this.columns.set(gx,column);}
        for(let gz=z0;gz<=z1;gz++){
          const cell=column.get(gz);
          if(cell)cell.push(box);else column.set(gz,[box]);
        }
      }
    }
  }
  resolve(x:number,z:number,margin=.45):[number,number] {
    let gx=Math.floor(x/TILE_SIZE),gz=Math.floor(z/TILE_SIZE);
    const indexed=margin<=indexedMargin;
    for(let pass=0;pass<2;pass++){
      let candidates=indexed?this.columns.get(gx)?.get(gz):this.all;
      let index=0,moved=false;
      while(candidates && index<candidates.length){
        const box=candidates[index++];
        const left=box.left-margin,right=box.right+margin,top=box.top-margin,bottom=box.bottom+margin;
        if(x<=left || x>=right || z<=top || z>=bottom)continue;
        const dist=Math.min(x-left,right-x,z-top,bottom-z);
        if(dist===x-left)x=left;
        else if(dist===right-x)x=right;
        else if(dist===z-top)z=top;
        else z=bottom;
        moved=true;
        const nextX=Math.floor(x/TILE_SIZE),nextZ=Math.floor(z/TILE_SIZE);
        if(indexed && (nextX!==gx || nextZ!==gz)){
          gx=nextX;gz=nextZ;candidates=this.columns.get(gx)?.get(gz);index=0;
          // A push can cross a tile boundary. Continue the same pass only with later parcels.
          while(candidates && index<candidates.length && candidates[index].order<=box.order)index++;
        }
      }
      if(!moved)break;
    }
    return [x,z];
  }
}
