import type { Ctx,PixelVox } from "../../kit";
import type { SignatureBuilder } from "../../periodArtCatalog";
import { amber,beam,black,brick,citizen,counter,cream,glass,iron,maroon,mortar,parcel,platform,sage,shadeLamp,steel,tan,tin,wood,yard } from "./streets";

function roof(v:PixelVox,x:number,z:number,X:number,Z:number,h:number,bay:number){
  for(let q=x;q<X;q++){
    const tooth=(q-x)%bay, y=h+Math.floor(tooth*.65);
    v.box(q,y,z,q+1,y+1,Z,tin);
    if(tooth===bay-1)v.box(q,h,z,q+1,y,Z,glass,.3);
  }
  for(let q=x+1;q<X-1;q+=bay){
    v.box(q,1,z,q+1,h,z+1,brick);v.box(q,1,Z-2,q+1,h,Z-1,iron);
  }
}
function cart(v:PixelVox,x:number,z:number,active:boolean,van=false){
  for(const q of [-2,1])for(const side of [-1,1])v.box(x+q,1,z+side,x+q+2,3,z+side+1,black);
  v.box(x-2,2,z-1,x+3,3,z+2,wood);
  if(van){
    v.box(x-2,3,z-1,x+1,6,z+2,maroon);v.box(x+1,3,z-1,x+3,5,z+2,cream);
    v.put(x+2,5,z,glass,.12);
  } else {parcel(v,x-2,3,z-1);v.put(x+2,3,z,iron);}
  if(active)v.put(x+1,3,z+1,amber,.21);
}
function bayGate(v:PixelVox,x:number,z:number,r:number,h:number){
  for(const side of [-1,1]){const xx=x+side*r;v.box(xx-1,1,z,xx+1,h,z+2,iron);}
  v.box(x-r-1,h,z,x+r+1,h+1,z+2,mortar);beam(v,[x-r,h-3,z],[x-r+4,h,z],iron);
}
function railTransfer(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,x=-hx+2,X=hx-2,z=-hz+2;
  const hallEnd=lv===1?X:lv===2?4:X-5;
  roof(v,x,z,hallEnd,z+5,5,lv<3?5:7);platform(v,x,z+5,hallEnd,z+7);counter(v,x+3,2,z+7,active);
  cart(v,lv===1?3:hx-6,hz-4,active);
  if(lv>=2){v.box(5,1,z,7,2,hz-2,iron);v.box(9,1,z,11,2,hz-2,iron);parcel(v,3,1,1);}
  if(lv>=3){for(let i=0;i<3;i++)cart(v,-8+i*7,5,active);v.box(x,1,1,X,2,3,cream);}
  if(lv>=4){bayGate(v,6,5,6,10);v.box(5,7,5,7,10,6,steel);parcel(v,4,5,5);}
  if(lv>=5){roof(v,x,6,-6,hz-2,9,5);v.box(x+2,7,3,-8,8,7,steel);cart(v,hx-6,1,active,true);}
}
function bag(v:PixelVox,x:number,y:number,z:number){
  v.box(x-1,y,z-1,x+2,y+3,z+2,tan);v.put(x,y+3,z,wood);v.put(x+1,y+1,z+2,cream);
}
function bagGantry(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,x=-hx+2,X=hx-2,z=-hz+3,h=8+lv;
  bayGate(v,0,z,Math.min(hx-3,4+lv),h);bag(v,0,h-5,z);
  counter(v,x+3,1,3,active);
  if(lv>=2){roof(v,x,z+2,-2,z+7,5,5);cart(v,X-4,3,active);}
  if(lv>=3){bayGate(v,0,4,8,h);v.box(-1,h,z,1,h+1,6,steel);for(let q=z+4;q<4;q+=5)bag(v,0,h-6,q);}
  if(lv>=4){roof(v,3,z,X,z+6,7,6);platform(v,x+2,6,8,10);cart(v,4,10,active);}
  if(lv>=5){const east=X-5;bayGate(v,east,3,4,14);beam(v,[3,h,z],[east,14,3],steel,2);bag(v,east,7,3);roof(v,x,3,x+11,hz-3,6,4);}
}
function rounds(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,x=-hx+2,z=-hz+2;
  const bays=lv<3?lv:lv+1,w=lv===1?7:Math.min(8,Math.floor((2*hx-5)/bays));
  for(let i=0;i<bays;i++){
    const xx=x+i*w,zz=z+Math.floor(i*i*.45),h=5+(i%2);
    roof(v,xx,zz,xx+w-1,zz+5,h,Math.max(3,w-1));
    v.box(xx,1,zz,xx+1,h,zz+5,brick);
    cart(v,xx+3,zz+7,active,true);
  }
  counter(v,lv===1?3:x+3,1,lv<3?3:hz-4,active);
  if(lv>=2){v.box(x,1,z,x+6,5,z+2,maroon);shadeLamp(v,x+2,2,z+2,active);}
  if(lv>=3){platform(v,x,4,0,8);parcel(v,x+3,3,5);}
  if(lv>=4){bayGate(v,-5,5,4,9);beam(v,[-9,9,6],[-1,11,6],steel);}
  if(lv>=5){const xx=hx-6;v.hollowBox(xx-3,1,z,xx+3,11,z+7,brick);v.box(xx-4,11,z-1,xx+4,12,z+8,tin);v.clear(xx-2,2,z+5,xx+1,6,z+7);shadeLamp(v,xx,6,z+7,active);}
}
function chute(c:Ctx,active:boolean){
  const {v,hx,hz,lv}=c,z=-hz+3,x=-hx+2,X=hx-2,h=8+lv;
  const origin=lv===1?-3:x+4;
  v.hollowBox(origin-2,1,z-1,origin+3,h,z+4,brick);
  v.clear(origin-1,3,z+2,origin+2,6,z+5);v.box(origin-3,h,z-2,origin+4,h+1,z+5,tin);
  const end=lv===1?4:Math.min(X-2,origin+13);
  beam(v,[origin,h-2,z+2],[end,3,z+5],iron,2);parcel(v,end-1,2,z+5);
  counter(v,lv===1?-2:origin,1,lv<3?4:2,active);
  if(lv>=2){roof(v,1,z,X,z+5,5,5);cart(v,X-3,4,active);}
  if(lv>=3){beam(v,[origin+1,h-3,z+3],[origin+4,3,8],steel,2);cart(v,origin+6,9,active);platform(v,1,2,X,5);}
  if(lv>=4){bayGate(v,4,3,5,10);for(let i=0;i<3;i++)parcel(v,0+i*4,3,3);}
  if(lv>=5){v.hollowBox(4,1,4,10,13,9,brick);roof(v,2,3,12,10,13,5);beam(v,[9,9,6],[X-3,2,10],steel,2);cart(v,X-5,10,active,true);}
}
// Rail baggage platform, hanging mailbag gantry, staggered van rounds and branching parcel chute.
export const post:SignatureBuilder=(c,_p,on)=>{yard(c,2);[railTransfer,bagGantry,rounds,chute][c.variant](c,on);};
