import type { Ctx } from "./kit";
import { packVoxKey } from "../voxelCore";
import { bulbs, cream, gold, pine, red, wreath } from "./christmasKit";

/** Hang lights on the exposed eaves of the actual model, including its era and architectural variant. */
export function hangChristmasTrim(c:Ctx, mall:boolean) {
  const {v,hx,hz}=c, width=2*hx;
  const roof=new Int16Array(width*2*hz);
  const index=(x:number,z:number)=>(z+hz)*width+x+hx;
  const height=(x:number,z:number)=>x>=-hx && x<hx && z>=-hz && z<hz ? roof[index(x,z)] : 0;
  for(const key of v.v.keys()){
    const x=((key>>>20)&1023)-512, z=(key&1023)-512, y=((key>>>10)&1023)-512;
    if(x>=-hx && x<hx && z>=-hz && z<hz && y>height(x,z)) roof[index(x,z)]=y;
  }
  // Find the front of a wall wide enough to support a wreath, skipping chimneys and yard props.
  let face:{x:number;y:number;z:number;r:number}|undefined;
  let best=-Infinity;
  for(let z=-hz;z<hz-1;z++)for(let x=-hx+2;x<hx-2;x++){
    const h=height(x,z);
    if(h<5 || height(x,z+1)>=h-2) continue;
    const r=mall && hx>=13 && h>=8?3:1;
    const y=Math.max(3,Math.min(h-r-1,Math.round(h*.65)));
    if(y+r>=h || ![-r,0,r].every(dx=>v.v.has(packVoxKey(x+dx,y,z)) && !v.v.has(packVoxKey(x+dx,y,z+1))))continue;
    const score=z*.9-Math.abs(x)*.6+Math.min(h,16)*.35;
    if(score>best){best=score;face={x,y,z:z+1,r};}
  }
  for(let z=-hz;z<hz;z++)for(let x=-hx;x<hx;x++){
    const y=height(x,z);
    if(y<4)continue;
    for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){
      if(height(x+dx,z+dz)>y-4)continue;
      const along=dx?z+hz:x+hx;
      const yy=y-(along%8>=3 && along%8<=5?1:0);
      v.put(x+dx,yy,z+dz,pine);
      if(along%3===0)v.put(x+dx,yy-1,z+dz,bulbs[(Math.floor(along/3)+(dx?2:0))%bulbs.length],1);
    }
  }
  if(face){
    const {x,y,z,r}=face;
    wreath(v,x,y,z,r);
    if(r>=3){
      for(let i=-1;i<=1;i++)v.put(x+i,y-r,z+1,red);
      v.put(x-1,y-r-1,z+1,red).put(x+1,y-r-1,z+1,red).put(x,y-r,z+1,gold,0.4);
    }else v.put(x,y-1,z+1,red).put(x-1,y+1,z,cream,0.35);
  }
}
