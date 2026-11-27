import { bench, type Ctx, type PixelVox } from "../../kit";
import type { SignatureBuilder } from "../../periodArtCatalog";
import { amber, beam, black, citizen, counter, cream, glass, iron, maroon, platform, sage, shadeLamp, soot, steps, tan, tin, wood, yard } from "./streets";

// Retired passenger coaches expose their shelves and warm reading seats to the platform.
function coach(v:PixelVox,x:number,X:number,z:number,y:number,depth:number,active:boolean,paint=sage){
  const Z=z+depth;
  for(const px of [x+2,X-3])for(const pz of [z,Z-1]){
    v.box(px-1,y,pz,px+2,y+2,pz+1,black);v.put(px,y+1,pz,tin);
  }
  v.box(x,y+2,z,X,y+3,Z,iron);
  v.box(x+1,y+3,z,X-1,y+7,z+1,paint);
  for(const px of [x,X-2]) v.box(px,y+3,z+1,px+2,y+7,Z-1,paint);
  v.box(x+1,y+3,Z-1,X-1,y+4,Z,paint);
  for(let q=x+2;q<X-2;q+=4){
    v.box(q,y+4,Z-1,q+1,y+7,Z,paint);
    v.put(q+1,y+4,z+1,maroon);v.put(q+1,y+5,z+1,cream);
    if(q+2<X-1)v.put(q+2,y+4,z+1,tan);
  }
  v.box(x,y+7,z,X,y+8,Z,iron);
  v.box(x+1,y+8,z+1,X-1,y+9,Z-1,tin);
  if(X-x>11)v.box(x+3,y+9,z+2,X-3,y+10,Z-2,glass,.13);
  const mid=Math.floor((x+X)/2);
  v.clear(mid-1,y+3,Z-1,mid+1,y+6,Z);
  shadeLamp(v,mid+1,y+3,Z-1,active);
}
function parallel(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,x=-hx+2,X=hx-2,rear=-hz+2;
  coach(v,x,X,rear,1,5,active);
  platform(v,x,rear+5,X,rear+8);counter(v,x+3,3,rear+6,active);
  if(lv>=2){coach(v,-2,X,1,1,5,active,maroon);steps(v,x+6,rear+8,2,2);}
  if(lv>=3){coach(v,x+3,X-2,5,1,6,active,maroon);v.box(-3,0,rear+9,2,1,hz-2,sage);bench(v,1,1,3);}
  if(lv>=4){const px=x+7;v.box(px-2,9,rear+3,px+2,10,8,iron);for(let z=rear+4;z<8;z++){v.put(px-2,10,z,glass,.22);v.put(px+1,10,z,glass,.22);}v.box(px-2,12,rear+3,px+2,13,8,tin);}
  if(lv>=5){coach(v,1,X-2,hz-9,1,6,active);platform(v,x+3,9,X-2,13);bench(v,x+6,3,10);citizen(v,x+9,3,11,active);}
}
function splayed(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,z0=-hz+2,len=lv<3?9:Math.min(2*hz-6,17+lv),base=lv===1?1:3;
  for(const s of [-1,1])for(let i=0;i<len;i++){
    const x=s*(base+Math.floor(i*(lv<3?.33:.40))), z=z0+i;
    // Reading shelters split around an open wedge of platform. Glass sits above the passengers.
    v.box(x-1,1,z,x+2,3,z+1,wood);v.put(x,3,z,lv>=3&&i%3===0?maroon:cream);
    v.box(x-2,6+Math.floor(i/8),z,x+3,7+Math.floor(i/8),z+1,i%6>3?glass:sage,i%6>3?.12:0);
    if(i%5===1)v.box(x,3,z,x+1,6+Math.floor(i/8),z+1,iron);
  }
  counter(v,0,1,lv<3?3:0,active);
  if(lv>=2){coach(v,-hx+2,-2,-hz+2,1,4,active,maroon);}
  if(lv>=3){const z=hz-6;platform(v,-7,z,8,z+3);bench(v,-4,3,z+1);bench(v,2,3,z+1);}
  if(lv>=4){coach(v,hx-14,hx-2,1,1,5,active);beam(v,[6,7,0],[hx-8,9,2],cream,2);}
  if(lv>=5){const z=hz-10;coach(v,-hx+3,-2,z,1,6,active);v.box(-2,5,z,7,6,z+4,glass,.24);v.box(5,1,z,6,5,z+1,iron);}
}
function archive(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,rear=-hz+2,x=-hx+2;
  const end=lv===1?5:Math.min(hx-2,6+lv);
  coach(v,x,end,rear,1,6,active,maroon);
  if(lv===1){platform(v,-3,1,4,4);counter(v,0,3,3,active);}
  if(lv>=2){coach(v,x+1,x+12,rear+1,9,4,active);steps(v,end-4,1,2,3);counter(v,end-5,1,4,active);}
  if(lv>=3){coach(v,-3,hx-2,3,1,6,active);platform(v,x,0,1,4);bench(v,x+3,3,2);}
  if(lv>=4){coach(v,hx-15,hx-3,4,9,4,active,maroon);v.box(-9,10,1,hx-8,11,4,iron);v.box(-9,11,3,hx-8,13,4,glass,.25);}
  if(lv>=5){const z=hz-9;coach(v,x+3,hx-4,z,1,6,active);platform(v,-2,6,3,z+2);for(let n=0;n<3;n++)bench(v,4+4*n,1,10);}
}
function wagon(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,x=-hx+2,X=lv<3?hx-2:Math.min(hx-5,7+lv),z=-hz+3;
  coach(v,x,X,z,1,5,active,maroon);const mid=Math.floor((x+X)/2);
  for(let i=0;i<4+lv;i++)v.box(x+1,7-Math.floor(i/3),z+4+i,X-1,8-Math.floor(i/3),z+5+i,i%3?cream:maroon);
  platform(v,x+1,z+5,X,z+8);
  counter(v,mid,3,z+6,active);
  if(lv>=2){beam(v,[x+2,3,z+8],[x+2,7,z+4],iron);v.box(X-6,3,z+6,X-1,6,z+7,sage);}
  if(lv>=3){v.box(-7,1,3,6,3,8,wood);for(let n=0;n<3;n++){const xx=-5+n*4;v.box(xx,3,3,xx+2,6+n,4,[sage,maroon,tan][n]);}bench(v,-2,1,11);}
  if(lv>=4){coach(v,hx-13,hx-2,3,1,5,active);beam(v,[2,7,-1],[hx-6,9,4],cream,2);}
  if(lv>=5){for(let n=0;n<3;n++){const zz=9+n*3;platform(v,-8-n*2,zz,9+n*2,zz+2,n+1);bench(v,1,n+2,zz);}v.box(-13,4,4,-12,12,5,iron);v.box(-13,11,4,0,12,5,cream);shadeLamp(v,-3,9,4,active);}
}
// Platform library, splayed waiting-room reading walks, stacking coach archive and traveling story wagon.
export const library:SignatureBuilder=(c,_p,on)=>{yard(c,2);[parallel,splayed,archive,wagon][c.variant](c,on);};
