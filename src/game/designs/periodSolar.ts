import type { Ctx } from "./kit";
import type { Ink } from "./periodArtCatalog";

/** Each collector faces its receiver. The rows stay inside the purchase footprint at each level. */
export function periodSolar(c:Ctx,p:Ink,active:boolean){
  const {v,hx,hz,lv,variant:s}=c, farm=c.id==="solar_farms";
  const receiverX=Math.min(hx-3,Math.floor(hx*.52)), receiverZ=-hz+3;
  const h=4+lv+(farm?2:0), mirror=p.era==="future-3027"?p.glass:
    p.era==="rome-aqueduct"||p.era==="ancient-china"||p.era==="ancient-egypt"||p.era==="art-deco"?p.sign:p.rim;
  const countX=Math.min(farm?5:3,Math.max(1,Math.floor(hx/4))), countZ=Math.min(farm?4:3,Math.max(1,Math.floor(hz/5)));
  const left=-hx+2,right=hx-2,back=-hz+3,front=hz-3;
  for(let row=0;row<countZ;row++)for(let col=0;col<countX;col++){
    const x=Math.round(left+(col+.5)*(right-left)/countX),z=Math.round(back+(row+.5)*(front-back)/countZ);
    const base=2+(s===1?1:0)+(farm && col%2===0?1:0),r=s===3?3:2;
    v.box(x-1,0,z-1,x+2,1,z+2,p.floor);
    v.box(x,1,z,x+1,base+1,z+1,p.frame);
    if(p.era==="world-war-ii"){
      v.cylinderY(x+.5,z+.5,1,base+1,1.5,p.frame);
      v.box(x-r,base+1,z-1,x+r+1,base+2,z+2,p.shade);
    }
    if(p.era==="ancient-china"||p.era==="ancient-egypt"||p.era==="ancient-greece"||p.era==="world-war-ii"){
      // Round bronze disc, painted ceremonial solar disc, glass lens or civil searchlight.
      for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
        const radius=dx*dx+dy*dy;
        if(radius>r*r+.5)continue;
        const zz=z-Math.floor((dy+r)/2)+(s===2?Math.sign(dx):0);
        v.put(x+dx,base+r+dy,zz,radius>r*r-2?p.frame:mirror);
        if(dx===0 && dy===0)v.put(x,base+r,zz+1,active?p.lamp:p.rim,active?.28:0);
      }
    }else if(p.era==="future-3027"){
      for(let j=0;j<6+s%2;j++){
        const span=j<3?j+1:6-j;
        v.box(x-span,base+j,z-Math.floor(j/2),x+span+1,base+j+1,z-Math.floor(j/2)+1,j%3===0?p.rim:p.glass);
      }
    }else if(p.era==="art-deco"){
      for(let dx=-r;dx<=r;dx++){
        const height=r+2-Math.abs(dx);
        v.box(x+dx,base+1,z,x+dx+1,base+height+1,z+1,dx%2?p.rim:p.sign);
      }
    }else{
      // Leaded priory glass, a studio cheval mirror or recovered, differently sized mirror shards.
      for(let dx=-r;dx<=r;dx++)for(let dz=0;dz<3;dz++){
        if(p.era==="post-apocalyptic" && dx===-r && dz===2)continue;
        const y=base+1+dz+(s===1 && dx>0?1:0);
        v.put(x+dx,y,z-dz,Math.abs(dx)===r || (p.era==="medieval-europe" && dx===0)?p.frame:mirror);
      }
    }
    if(lv>=3)v.box(x-1,1,z,x+2,2,z+1,p.rim);
  }
  for(let k=0;k<Math.min(3,lv);k++){
    const a=3-k;v.box(receiverX-a,k,receiverZ-a,receiverX+a+1,k+1,receiverZ+a+1,p.rim);
  }
  v.box(receiverX-1,1,receiverZ-1,receiverX+2,h,receiverZ+2,p.wall);
  v.box(receiverX-2,h-1,receiverZ-1,receiverX+3,h,receiverZ+2,p.frame);
  v.cylinderY(receiverX+.5,receiverZ+.5,h,h+2,1.5,active?p.lamp:p.sign,active?.36:0);
  if(s===2||s===3)v.box(receiverX-2,1,receiverZ+2,receiverX-1,h-1,receiverZ+3,p.frame);
  if(farm)v.box(left,0,front,right,1,front+1,p.floor);
}
